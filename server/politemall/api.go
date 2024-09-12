package politemall

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"politeshop/siren"
	"slices"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/sync/errgroup"
)

// PolitemallClient is a client for interacting with the PoliteMall API.
type PolitemallClient struct {
	httpClient       *http.Client
	brightspaceToken string
	userId           string
	tenantId         string
	politeDomain     string
}

// NewClient creates a new PolitemallClient with the given *.polite.edu.sg subdomain
// (nplms / splms / etc.) and authentication, leaving tenantId initially empty.
func NewClient(politeDomain, d2lSessionVal, d2lSecureSessionVal, brightspaceJwt string) (*PolitemallClient, error) {
	// The POLITEMall frontend interfaces with both *.polite.edu.sg and *.api.brightspace.com APIs.
	// *.polite.edu.sg APIs use the d2lSessionVal and d2lSecureSessionVal cookies for authentication,
	// while *.api.brightspace.com APIs use a JWT bearer token in the Authorization header.

	// Cookie jar for *.polite.edu.sg authentication
	jar, err := cookiejar.New(nil)
	if err != nil {
		panic(err)
	}

	cookieUrl, err := url.Parse("https://" + politeDomain + ".polite.edu.sg/")
	if err != nil {
		return nil, fmt.Errorf("invalid subdomain: %w", err)
	}

	authCookies, err := http.ParseCookie("d2lSessionVal=" + d2lSessionVal + "; d2lSecureSessionVal=" + d2lSecureSessionVal)
	if err != nil {
		return nil, fmt.Errorf("invalid cookie format: %w", err)
	}

	jar.SetCookies(cookieUrl, authCookies)

	token, _, err := jwt.NewParser().ParseUnverified(brightspaceJwt, jwt.MapClaims{})
	if err != nil {
		return nil, fmt.Errorf("invalid JWT: %w", err)
	}

	// Extract the user ID from the JWT
	sub, err := token.Claims.GetSubject()
	if err != nil {
		return nil, fmt.Errorf("missing sub in Brightspace JWT: %w", err)
	}

	return &PolitemallClient{
		httpClient:       &http.Client{Jar: jar},
		politeDomain:     politeDomain,
		brightspaceToken: brightspaceJwt,
		userId:           sub,
	}, nil
}

// GetSemesters returns the semesters that the user has access to. This also populates tenantId.
func (pm *PolitemallClient) GetSemesters() (semesters []Semester, err error) {
	resp, err := pm.httpClient.Get("https://" + pm.politeDomain + ".polite.edu.sg/d2l/api/le/manageCourses/courses-searches/" + pm.userId + "/BySemester?desc=1")
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	} else if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("request failed with status %d", resp.StatusCode)
	}

	// Decode the Siren JSON entity
	var entity siren.Entity
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(&entity); err != nil {
		return nil, fmt.Errorf("failed to decode JSON: %w", err)
	}

	// Gather the semester information from the Siren entity
	for _, action := range entity.Actions {
		semesters = append(semesters, Semester{
			name: strings.TrimSpace(action.Title),
			id:   action.Name,
		})

		// Set pm.tenantId if not already set
		if pm.tenantId != "" {
			continue
		}

		href, err := url.Parse(action.Href)
		if err != nil {
			panic(err)
		}

		// The host should look something like 746e9230-82d6-4d6b-bd68-5aa40aa19cce.enrollments.api.brightspace.com
		pm.tenantId = strings.Split(href.Host, ".")[0]

	}

	return semesters, nil
}

// GetModules returns the modules that the user has access to.
func (pm *PolitemallClient) GetModules() ([]Module, error) {
	entity, err := pm.getBrightspaceEntity("https://" + pm.tenantId + ".enrollments.api.brightspace.com/users/" + pm.userId)
	if err != nil {
		return nil, err
	}

	modulesChan := make(chan Module, len(entity.Entities))
	eg, _ := errgroup.WithContext(context.Background()) // TODO: Use context

	// Asynchronously fetch each module
	for _, subEntity := range entity.Entities {
		eg.Go(func() error {
			mod, err := pm.getModuleFromEnrollmentHref(subEntity.Href)
			if err != nil {
				return err
			}

			modulesChan <- mod
			return nil
		})
	}

	if eg.Wait() != nil {
		return nil, fmt.Errorf("failed to fetch modules: %w", err)
	}

	// Collect all the modules into a slice
	close(modulesChan)
	var modules []Module
	for module := range modulesChan {
		modules = append(modules, module)
	}

	return modules, nil
}

// getModuleFromEnrollmentHref fetches the module information from the
// given URL (as found in the sub-entities of the enrollments entity).
func (pm *PolitemallClient) getModuleFromEnrollmentHref(enrollHref string) (Module, error) {
	enrollEntity, err := pm.getBrightspaceEntity(enrollHref)
	if err != nil {
		return Module{}, err
	}

	// Find the organization link of the enrollment
	var orgHref string
	for _, link := range enrollEntity.Links {
		if slices.Equal(link.Rel, []string{"https://api.brightspace.com/rels/organization"}) {
			orgHref = link.Href
			break
		}
	}
	if orgHref == "" {
		return Module{}, fmt.Errorf("no organization link found in enrollment entity")
	}

	orgEntity, err := pm.getBrightspaceEntity(orgHref)
	if err != nil {
		return Module{}, err
	}

	// Extract the ID of the semester that the module belongs to
	var moduleSemesterId string
	for _, link := range orgEntity.Links {
		// Look for the parent-semester rel
		if !slices.Equal(link.Rel, []string{"https://api.brightspace.com/rels/parent-semester"}) {
			continue
		}

		semesterUrl, err := url.Parse(link.Href)
		if err != nil {
			return Module{}, fmt.Errorf("broken parent semester URL: %w", err)
		}

		// The URL should look something like https://746e9230-82d6-4d6b-bd68-5aa40aa19cce.organizations.api.brightspace.com/332340?localeId=3
		moduleSemesterId = strings.Trim(semesterUrl.Path, "/")
		break

	}
	if moduleSemesterId == "" {
		return Module{}, fmt.Errorf("semester ID of module not found")
	}

	orgUrl, err := url.Parse(orgHref)
	if err != nil {
		panic(fmt.Errorf("broken organization URL: %w", err))
	}

	// TODO: Don't use type assertions
	return Module{
		id:         strings.Trim(orgUrl.Path, "/"),
		name:       orgEntity.Properties["name"].(string),
		code:       orgEntity.Properties["code"].(string),
		semesterId: moduleSemesterId,
	}, nil
}

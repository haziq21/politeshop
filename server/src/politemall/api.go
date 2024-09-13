package politemall

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"politeshop/siren"
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
	// Fetch the enrollment entity
	enrollEntity, err := pm.getBrightspaceEntity(enrollHref)
	if err != nil {
		return Module{}, err
	}

	// Find the organization link of the enrollment
	link := enrollEntity.FindLinkWithRel("https://api.brightspace.com/rels/organization")
	if link == nil {
		return Module{}, fmt.Errorf("missing organization link in enrollment entity")
	}
	orgHref := link.Href

	// Fetch the organization entity
	orgEntity, err := pm.getBrightspaceEntity(orgHref)
	if err != nil {
		return Module{}, err
	}

	// Extract the ID of the semester that the module belongs to
	link = orgEntity.FindLinkWithRel("https://api.brightspace.com/rels/parent-semester")
	if link == nil {
		return Module{}, fmt.Errorf("missing parent semester link in organization entity")
	}
	semesterUrl, err := url.Parse(link.Href)
	if err != nil {
		return Module{}, fmt.Errorf("broken parent semester URL: %w", err)
	}
	// The URL should look something like https://746e9230-82d6-4d6b-bd68-5aa40aa19cce.organizations.api.brightspace.com/332340?localeId=3
	moduleSemesterId := strings.Trim(semesterUrl.Path, "/")

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

func (pm *PolitemallClient) GetModuleContent(moduleId string) ([]ContentGroup, []ActivityGroup, error) {
	entity, err := pm.getBrightspaceEntity("https://" + pm.tenantId + ".sequences.api.brightspace.com/" + moduleId + "?deepEmbedEntities=1&embedDepth=1&filterOnDatesAndDepth=0")
	if err != nil {
		return nil, nil, err
	}

	contentGroups := make([]ContentGroup, 0, len(entity.Entities))
	var activityGroups []ActivityGroup

	for _, contentGroupEntity := range entity.Entities {
		// Extract the ID of the content group from the self link
		link := contentGroupEntity.FindLinkWithRel("self", "describes")
		if link == nil {
			return nil, nil, fmt.Errorf("missing content group link")
		}
		contentGroupId, err := pm.getActivityIdFromUrl(link.Href)
		if err != nil {
			return nil, nil, err
		}

		contentGroups = append(contentGroups, ContentGroup{
			id:       contentGroupId,
			name:     contentGroupEntity.Properties["title"].(string),
			moduleId: moduleId,
		})

		activityGroupsInContentGroup, err := pm.getActivityGroupsFromContentGroupEntity(&contentGroupEntity)
		if err != nil {
			return nil, nil, err
		}

		activityGroups = append(activityGroups, activityGroupsInContentGroup...)
	}

	return contentGroups, activityGroups, nil
}

// getActivityIdFromUrl extracts the activity ID from the given activity URI.
func (pm *PolitemallClient) getActivityIdFromUrl(activityUrl string) (string, error) {
	url, err := url.Parse(activityUrl)
	if err != nil {
		return "", fmt.Errorf("broken activity URL: %w", err)
	}

	// The URL should look like https://abc123.sequences.api.brightspace.com/468314/activity/8130117?filterOnDatesAndDepth=0
	return strings.Split(strings.Trim(url.Path, "/"), "/")[2], nil
}

func (pm *PolitemallClient) getActivityGroupsFromContentGroupEntity(contentGroupEnt *siren.Entity) (activityGroups []ActivityGroup, err error) {
	link := contentGroupEnt.FindLinkWithRel("self", "describes")
	if link == nil {
		return nil, fmt.Errorf("missing content group link")
	}
	contentGroupId, err := pm.getActivityIdFromUrl(link.Href)
	if err != nil {
		return nil, err
	}

	for _, activityGroupEnt := range contentGroupEnt.Entities {
		// Skip entities that are not activity groups
		if !activityGroupEnt.ClassIs("release-condition-fix", "sequence", "sequence-description") {
			continue
		}

		// Extract the ID of the activity group from the self link
		link := activityGroupEnt.FindLinkWithRel("self", "describes")
		if link == nil {
			return nil, fmt.Errorf("missing activity group link")
		}
		activityGroupId, err := pm.getActivityIdFromUrl(link.Href)
		if err != nil {
			return nil, err
		}

		activityGroups = append(activityGroups, ActivityGroup{
			id:             activityGroupId,
			name:           activityGroupEnt.Properties["title"].(string),
			contentGroupId: contentGroupId,
			transparent:    false,
		})
	}

	return activityGroups, nil
}

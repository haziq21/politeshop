package politemall

import (
	"context"
	"errors"
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
func NewClient(politeDomain, d2lSessionVal, d2lSecureSessionVal, brightspaceToken string) (*PolitemallClient, error) {
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

	token, _, err := jwt.NewParser().ParseUnverified(brightspaceToken, jwt.MapClaims{})
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
		brightspaceToken: brightspaceToken,
		userId:           sub,
	}, nil
}

// GetSemesters returns the semesters that the user has access to. This also populates tenantId.
func (pm *PolitemallClient) GetSemesters() (semesters []Semester, err error) {
	ent, err := pm.getBrightspaceEntity("https://" + pm.politeDomain + ".polite.edu.sg/d2l/api/le/manageCourses/courses-searches/" + pm.userId + "/BySemester?desc=1")
	if err != nil {
		return nil, err
	}

	// Gather the semester information
	for _, action := range ent.Actions {
		semesters = append(semesters, Semester{
			Name: strings.TrimSpace(action.Title),
			Id:   action.Name,
		})

		// Set pm.tenantId if not already set
		if pm.tenantId != "" {
			continue
		}

		href, err := url.Parse(action.Href)
		if err != nil {
			panic(err)
		}

		// The host should look something like abc123.enrollments.api.brightspace.com
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
		return Module{}, errors.New("missing organization link in enrollment entity")
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
		return Module{}, errors.New("missing parent semester link in organization entity")
	}
	semesterUrl, err := url.Parse(link.Href)
	if err != nil {
		return Module{}, fmt.Errorf("broken parent semester URL: %w", err)
	}
	// The URL should look something like https://746e9230-82d6-4d6b-bd68-5aa40aa19cce.organizations.api.brightspace.com/332340?localeId=3
	moduleSemesterId := strings.Trim(semesterUrl.Path, "/")

	orgUrl, err := url.Parse(orgHref)
	if err != nil {
		return Module{}, fmt.Errorf("broken organization URL: %w", err)
	}

	name, ok := orgEntity.StringProperty("name")
	if !ok {
		return Module{}, errors.New("missing name property")
	}
	code, ok := orgEntity.StringProperty("code")
	if !ok {
		return Module{}, errors.New("missing code property")
	}

	return Module{
		Id:         strings.Trim(orgUrl.Path, "/"),
		Name:       name,
		Code:       code,
		SemesterId: moduleSemesterId,
	}, nil
}

func (pm *PolitemallClient) GetModuleContent(moduleId string) ([]Unit, error) {
	ent, err := pm.getBrightspaceEntity("https://" + pm.tenantId + ".sequences.api.brightspace.com/" + moduleId + "?deepEmbedEntities=1&embedDepth=1&filterOnDatesAndDepth=0")
	if err != nil {
		return nil, err
	}

	units := make([]Unit, 0, len(ent.Entities))

	for _, unitEnt := range ent.Entities {
		unit, err := pm.parseUnit(&unitEnt)
		if err != nil {
			return nil, err
		}
		units = append(units, unit)
	}

	return units, nil
}

func (pm *PolitemallClient) parseUnit(ent *siren.Entity) (Unit, error) {
	// Extract the ID of the unit from the self link
	link := ent.FindLinkWithRel("self", "describes")
	if link == nil {
		return Unit{}, errors.New("missing unit link")
	}
	unitId, err := getActivityIdFromUrl(link.Href)
	if err != nil {
		return Unit{}, err
	}

	// Get the title of the unit
	unitTitle, ok := ent.StringProperty("title")
	if !ok {
		return Unit{}, errors.New("missing title property")
	}

	// Parse the lessons in the unit
	lessons := make([]Lesson, 0, len(ent.Entities))
	for _, subEnt := range ent.Entities {
		if !subEnt.ClassIs("release-condition-fix", "sequence", "sequence-description") {
			continue
		}

		lesson, err := pm.parseLesson(&subEnt)
		if err != nil {
			return Unit{}, err
		}
		lessons = append(lessons, lesson)
	}

	return Unit{
		Id:      unitId,
		Title:   unitTitle,
		Lessons: lessons,
	}, nil
}

// parseLesson parses a Siren entity into a Lesson.
func (pm *PolitemallClient) parseLesson(ent *siren.Entity) (Lesson, error) {
	// Extract the ID of the lesson from the self link
	link := ent.FindLinkWithRel("self", "describes")
	if link == nil {
		return Lesson{}, errors.New("missing lesson link")
	}
	lessonId, err := getActivityIdFromUrl(link.Href)
	if err != nil {
		return Lesson{}, err
	}

	// Get the title of the lesson
	lessonTitle, ok := ent.StringProperty("title")
	if !ok {
		return Lesson{}, errors.New("missing title property")
	}

	// Parse the activities in the lesson
	activities := make([]Activity, 0, len(ent.Entities))
	for _, subEnt := range ent.Entities {
		if !subEnt.ClassIs("release-condition-fix", "sequenced-activity") {
			continue
		}

		activity, err := pm.parseActivity(&subEnt)
		if err != nil {
			return Lesson{}, err
		}
		activities = append(activities, activity)
	}

	return Lesson{
		Id:          lessonId,
		Title:       lessonTitle,
		Transparent: false,
		Activities:  activities,
	}, nil
}

// parseActivity parses a Siren entity into an Activity.
func (pm *PolitemallClient) parseActivity(ent *siren.Entity) (Activity, error) {
	// Get the title of the activity
	title, ok := ent.StringProperty("title")
	if !ok {
		return Activity{}, errors.New("missing title property")
	}

	// Extract the ID of the activity from the self link
	link := ent.FindLinkWithRel("self", "describes")
	if link == nil {
		return Activity{}, errors.New("missing activity link")
	}
	activityId, err := getActivityIdFromUrl(link.Href)
	if err != nil {
		return Activity{}, err
	}

	return Activity{
		Id:    activityId,
		Title: title,
	}, nil
}

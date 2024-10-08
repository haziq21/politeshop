package politemall

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"politeshop/services"
	"politeshop/siren"
	"strings"

	"golang.org/x/sync/errgroup"
)

// GetNewBrightspaceToken fetches a new Brightspace token from the PoliteMall API.
func (pm *Client) GetNewBrightspaceToken(csrfToken string) (string, error) {
	req, err := http.NewRequest(
		"POST",
		"https://"+pm.politeDomain+".polite.edu.sg/d2l/lp/auth/oauth2/token",
		strings.NewReader(url.Values{"scope": {"*:*:*"}}.Encode()),
	)
	if err != nil {
		return "", fmt.Errorf("failed to build request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("X-Csrf-Token", csrfToken)
	resp, err := pm.cli.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}

	var jsonResp struct {
		AccessToken string `json:"access_token"`
	}
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(&jsonResp); err != nil {
		return "", fmt.Errorf("failed to decode JSON: %w", err)
	}

	if jsonResp.AccessToken == "" {
		return "", fmt.Errorf("missing access token in response")
	}
	return jsonResp.AccessToken, nil
}

func (pm *Client) GetUserAndSchool() (services.User, services.School, error) {
	userEnt, err := pm.getBrightspaceEntity("https://" + pm.tenantID + ".enrollments.api.brightspace.com/users/" + pm.UserID)
	if err != nil {
		return services.User{}, services.School{}, err
	}
	orgLink, ok := userEnt.FindLinkWithRel("https://api.brightspace.com/rels/organization")
	if !ok {
		return services.User{}, services.School{}, errors.New("missing organization link in user entity")
	}

	orgEnt, err := pm.getBrightspaceEntity(orgLink.Href)
	if err != nil {
		return services.User{}, services.School{}, err
	}
	school, err := pm.parseSchool(orgEnt)
	if err != nil {
		return services.User{}, services.School{}, err
	}

	user, err := pm.getUserWithoutSchool()
	if err != nil {
		return services.User{}, services.School{}, err
	}
	user.School = school.ID

	return user, school, nil
}

func (pm *Client) getUserWithoutSchool() (services.User, error) {
	resp, err := pm.cli.Get("https://" + pm.politeDomain + ".polite.edu.sg/d2l/api/lp/1.0/users/whoami")
	if err != nil {
		return services.User{}, fmt.Errorf("request failed: %w", err)
	} else if resp.StatusCode != http.StatusOK {
		return services.User{}, fmt.Errorf("request failed with status %s", resp.Status)
	}

	defer resp.Body.Close()
	var whoAmI struct{ Identifier, FirstName string }
	if err := json.NewDecoder(resp.Body).Decode(&whoAmI); err != nil {
		return services.User{}, fmt.Errorf("failed to decode JSON: %w", err)
	}

	return services.User{
		ID:   whoAmI.Identifier,
		Name: whoAmI.FirstName,
	}, nil
}

func (pm *Client) parseSchool(ent siren.Entity) (services.School, error) {
	schoolName, ok := ent.StringProperty("name")
	if !ok {
		return services.School{}, errors.New("missing school name in organization entity")
	}

	link, ok := ent.FindLinkWithRel("self")
	if !ok {
		return services.School{}, errors.New("missing self link in school entity")
	}
	schoolID, err := lastPathComponent(link.Href)
	if err != nil {
		return services.School{}, fmt.Errorf("cannot extract school ID from self link: %w", err)
	}

	return services.School{
		ID:   schoolID,
		Name: schoolName,
	}, nil
}

// GetSemesters returns the semesters that the user has access to.
func (pm *Client) GetSemesters() (semesters []services.Semester, err error) {
	ent, err := pm.getBrightspaceEntity("https://" + pm.politeDomain + ".polite.edu.sg/d2l/api/le/manageCourses/courses-searches/" + pm.UserID + "/BySemester?desc=1")
	if err != nil {
		return nil, err
	}

	// Gather the semester information
	for _, action := range ent.Actions {
		semesters = append(semesters, services.Semester{
			Name: strings.TrimSpace(action.Title), // Sometimes they have leading spaces...
			ID:   action.Name,
		})
	}

	return semesters, nil
}

// GetModules returns the modules that the user has access to.
func (pm *Client) GetModules() ([]services.Module, error) {
	ent, err := pm.getBrightspaceEntity("https://" + pm.tenantID + ".enrollments.api.brightspace.com/users/" + pm.UserID)
	if err != nil {
		return nil, err
	}

	modulesChan := make(chan services.Module, len(ent.Entities))
	eg, _ := errgroup.WithContext(context.Background()) // TODO: Use context

	// Asynchronously fetch each module
	for _, subEnt := range ent.Entities {
		eg.Go(func() error {
			mod, err := pm.getModuleFromEnrollmentHref(subEnt.Href)
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
	var modules []services.Module
	for m := range modulesChan {
		modules = append(modules, m)
	}

	return modules, nil
}

// getModuleFromEnrollmentHref fetches the module information from the
// given URL (as found in the sub-entities of the enrollments entity).
func (pm *Client) getModuleFromEnrollmentHref(enrollHref string) (services.Module, error) {
	// Fetch the enrollment entity
	enrollmentEnt, err := pm.getBrightspaceEntity(enrollHref)
	if err != nil {
		return services.Module{}, err
	}

	// Find the organization link of the enrollment
	link, ok := enrollmentEnt.FindLinkWithRel("https://api.brightspace.com/rels/organization")
	if !ok {
		return services.Module{}, errors.New("missing organization link in enrollment entity")
	}
	orgHref := link.Href

	// Fetch the organization entity
	orgEntity, err := pm.getBrightspaceEntity(orgHref)
	if err != nil {
		return services.Module{}, err
	}

	// Extract the ID of the semester that the module belongs to
	link, ok = orgEntity.FindLinkWithRel("https://api.brightspace.com/rels/parent-semester")
	if !ok {
		return services.Module{}, errors.New("missing parent semester link in organization entity")
	}
	semesterUrl, err := url.Parse(link.Href)
	if err != nil {
		return services.Module{}, fmt.Errorf("broken parent semester URL: %w", err)
	}
	// The URL should look something like https://746e9230-82d6-4d6b-bd68-5aa40aa19cce.organizations.api.brightspace.com/332340?localeId=3
	moduleSemesterId := strings.Trim(semesterUrl.Path, "/")

	orgUrl, err := url.Parse(orgHref)
	if err != nil {
		return services.Module{}, fmt.Errorf("broken organization URL: %w", err)
	}

	name, ok := orgEntity.StringProperty("name")
	if !ok {
		return services.Module{}, errors.New("missing name property")
	}
	code, ok := orgEntity.StringProperty("code")
	if !ok {
		return services.Module{}, errors.New("missing code property")
	}

	return services.Module{
		ID:       strings.Trim(orgUrl.Path, "/"),
		Name:     name,
		Code:     code,
		Semester: moduleSemesterId,
	}, nil
}

// GetModuleUnits fetches the units in a module.
func (pm *Client) GetModuleUnits(moduleId string) (*[]services.Unit, error) {
	ent, err := pm.getBrightspaceEntity("https://" + pm.tenantID + ".sequences.api.brightspace.com/" + moduleId + "?deepEmbedEntities=1&embedDepth=1&filterOnDatesAndDepth=0")
	if err != nil {
		return nil, err
	}

	units := make([]services.Unit, 0, len(ent.Entities))
	for _, unitEnt := range ent.Entities {
		unit, err := pm.parseUnit(&unitEnt)
		if err != nil {
			return nil, err
		}
		units = append(units, *unit)
	}

	return &units, nil
}

// parseUnit parses a Siren entity into a Unit.
func (pm *Client) parseUnit(ent *siren.Entity) (*services.Unit, error) {
	// Extract the ID of the unit from the self link
	link, ok := ent.FindLinkWithRel("self", "describes")
	if !ok {
		return nil, errors.New("missing unit link")
	}
	unitID, err := lastPathComponent(link.Href)
	if err != nil {
		return nil, fmt.Errorf("cannot extract unit ID: %w", err)
	}

	// Extract the ID of the module that contains this unit
	link, ok = ent.FindLinkWithRel("up")
	if !ok {
		return nil, errors.New("missing up link")
	}
	moduleID, err := lastPathComponent(link.Href)
	if err != nil {
		return nil, fmt.Errorf("cannot extract module ID: %w", err)
	}

	// Get the title of the unit
	unitTitle, ok := ent.StringProperty("title")
	if !ok {
		return nil, errors.New("missing title property")
	}

	// Parse the lessons in the unit
	lessons := make([]services.Lesson, 0, len(ent.Entities))
	for _, subEnt := range ent.Entities {
		if !subEnt.ClassIs("release-condition-fix", "sequence", "sequence-description") {
			continue
		}

		lesson, err := pm.parseLesson(&subEnt)
		if err != nil {
			return nil, err
		}
		lessons = append(lessons, *lesson)
	}

	return &services.Unit{
		ID:       unitID,
		ModuleID: moduleID,
		Title:    unitTitle,
		Lessons:  lessons,
	}, nil
}

// parseLesson parses a Siren entity into a Lesson.
func (pm *Client) parseLesson(ent *siren.Entity) (*services.Lesson, error) {
	// Extract the ID of the lesson from the self link
	link, ok := ent.FindLinkWithRel("self", "describes")
	if !ok {
		return nil, errors.New("missing lesson link")
	}
	lessonID, err := lastPathComponent(link.Href)
	if err != nil {
		return nil, fmt.Errorf("cannot extract lesson ID: %w", err)
	}

	// Extract the ID of the unit that contains this lesson
	link, ok = ent.FindLinkWithRel("up")
	if !ok {
		return nil, errors.New("missing up link")
	}
	unitID, err := lastPathComponent(link.Href)
	if err != nil {
		return nil, fmt.Errorf("cannot extract unit ID: %w", err)
	}

	// Get the title of the lesson
	lessonTitle, ok := ent.StringProperty("title")
	if !ok {
		return nil, errors.New("missing title property")
	}

	// Parse the activities in the lesson
	activities := make([]services.Activity, 0, len(ent.Entities))
	for _, subEnt := range ent.Entities {
		if !subEnt.ClassIs("release-condition-fix", "sequenced-activity") {
			continue
		}

		activity, err := pm.parseActivity(&subEnt)
		if err != nil {
			return nil, err
		}
		activities = append(activities, *activity)
	}

	return &services.Lesson{
		ID:          lessonID,
		UnitID:      unitID,
		Title:       lessonTitle,
		Transparent: false,
		Activities:  activities,
	}, nil
}

// parseActivity parses a Siren entity into an Activity.
func (pm *Client) parseActivity(ent *siren.Entity) (*services.Activity, error) {
	// Extract the ID of the activity from the self link
	link, ok := ent.FindLinkWithRel("self", "describes")
	if !ok {
		return nil, errors.New("missing activity link")
	}
	activityID, err := lastPathComponent(link.Href)
	if err != nil {
		return nil, fmt.Errorf("cannot extract activity ID: %w", err)
	}

	// Extract the ID of the lesson that contains this activity
	link, ok = ent.FindLinkWithRel("up")
	if !ok {
		return nil, errors.New("missing up link")
	}
	lessonID, err := lastPathComponent(link.Href)
	if err != nil {
		return nil, fmt.Errorf("cannot extract lesson ID: %w", err)
	}

	// Get the title of the activity
	title, ok := ent.StringProperty("title")
	if !ok {
		return nil, errors.New("missing title property")
	}

	return &services.Activity{
		ID:       activityID,
		LessonID: lessonID,
		Title:    title,
	}, nil
}

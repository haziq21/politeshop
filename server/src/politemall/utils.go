package politemall

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"politeshop/siren"
	"strings"
)

// getBrightspaceEntity fetches a Siren entity from the Brightspace API.
func (pm *PolitemallClient) getBrightspaceEntity(href string) (siren.Entity, error) {
	req, err := http.NewRequest("GET", href, nil)
	if err != nil {
		return siren.Entity{}, fmt.Errorf("failed to build request: %w", err)
	}

	req.Header.Add("Authorization", "Bearer "+pm.brightspaceToken)
	res, err := pm.httpClient.Do(req)
	if err != nil {
		return siren.Entity{}, fmt.Errorf("request failed: %w", err)
	} else if res.StatusCode != http.StatusOK {
		return siren.Entity{}, fmt.Errorf("request failed with status %d", res.StatusCode)
	}

	var entity siren.Entity
	defer res.Body.Close()
	if err := json.NewDecoder(res.Body).Decode(&entity); err != nil {
		return siren.Entity{}, fmt.Errorf("failed to decode JSON: %w", err)
	}

	return entity, nil
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

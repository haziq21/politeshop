package politemall

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"politeshop/siren"
	"strings"
)

// getBrightspaceEntity fetches a Siren entity from the Brightspace API.
func (pm *Client) getBrightspaceEntity(href string) (siren.Entity, error) {
	req, err := http.NewRequest("GET", href, nil)
	if err != nil {
		return siren.Entity{}, fmt.Errorf("failed to build request: %w", err)
	}

	req.Header.Add("Authorization", "Bearer "+pm.brightspaceJWT)
	resp, err := pm.cli.Do(req)
	if err != nil {
		return siren.Entity{}, fmt.Errorf("request failed: %w", err)
	} else if resp.StatusCode != http.StatusOK {
		return siren.Entity{}, fmt.Errorf("request failed with status %s", resp.Status)
	}

	var entity siren.Entity
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(&entity); err != nil {
		return siren.Entity{}, fmt.Errorf("failed to decode JSON: %w", err)
	}

	return entity, nil
}

// lastPathComponent returns the last path component of a URL.
func lastPathComponent(u string) (string, error) {
	parsedURL, err := url.Parse(u)
	if err != nil {
		return "", fmt.Errorf("broken URL: %w", err)
	}

	components := strings.Split(strings.Trim(parsedURL.Path, "/"), "/")
	if len(components) == 1 && components[0] == "" {
		return "", errors.New("URL has no path components")
	}

	return components[len(components)-1], nil
}

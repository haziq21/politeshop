package politemall

import (
	"encoding/json"
	"fmt"
	"net/http"
	"politeshop/siren"
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

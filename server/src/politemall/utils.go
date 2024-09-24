package politemall

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"politeshop/siren"
	"strings"
)

type AuthSecrets struct {
	D2lSessionVal, D2lSecureSessionVal, BrightspaceToken string
}

func AuthSecretsFromEnv() AuthSecrets {
	return AuthSecrets{
		D2lSessionVal:       os.Getenv("D2L_SESSION_VAL"),
		D2lSecureSessionVal: os.Getenv("D2L_SECURE_SESSION_VAL"),
		BrightspaceToken:    os.Getenv("BRIGHTSPACE_TOKEN"),
	}
}

func AuthSecretsFromHeader(header *http.Header) (AuthSecrets, bool) {
	d2lSessionVal := header.Get("X-D2l-Session-Val")
	d2lSecureSessionVal := header.Get("X-D2l-Secure-Session-Val")
	brightspaceToken := header.Get("X-Brightspace-Token")

	if d2lSessionVal == "" || d2lSecureSessionVal == "" || brightspaceToken == "" {
		return AuthSecrets{}, false
	}
	return AuthSecrets{
		D2lSessionVal:       d2lSessionVal,
		D2lSecureSessionVal: d2lSecureSessionVal,
		BrightspaceToken:    brightspaceToken,
	}, true
}

// getBrightspaceEntity fetches a Siren entity from the Brightspace API.
func (pm *PolitemallClient) getBrightspaceEntity(href string) (siren.Entity, error) {
	req, err := http.NewRequest("GET", href, nil)
	if err != nil {
		return siren.Entity{}, fmt.Errorf("failed to build request: %w", err)
	}

	req.Header.Add("Authorization", "Bearer "+pm.brightspaceToken)
	resp, err := pm.httpClient.Do(req)
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
		return "", fmt.Errorf("broken activity URL: %w", err)
	}

	components := strings.Split(strings.Trim(parsedURL.Path, "/"), "/")
	if len(components) == 0 {
		return "", errors.New("URL has no path components")
	}

	return components[len(components)-1], nil
}

package main

import (
	"errors"
	"net/url"
	"strings"
)

// firstSubdomain returns the first domain of a URL.
func firstSubdomain(u string) (string, error) {
	parsedURL, err := url.Parse(u)
	if err != nil {
		return "", err
	}

	hostname := parsedURL.Hostname()
	if hostname == "" {
		return "", errors.New("URL has no hostname")
	}
	return strings.Split(hostname, ".")[0], nil
}

package main

import (
	"net/url"
	"strings"
)

func firstSubdomain(u string) (string, error) {
	parsed, err := url.Parse(u)
	if err != nil {
		return "", err
	}
	return strings.Split(parsed.Hostname(), ".")[0], nil
}

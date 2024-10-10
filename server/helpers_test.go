package main

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFirstSubdomain(t *testing.T) {
	tests := []struct {
		url      string
		expected string
		hasError bool
	}{
		{"https://example.com/path", "example", false},
		{"https://subdomain.example.com/path", "subdomain", false},
		{"https://another.subdomain.example.com/path", "another", false},
		{"https://", "", true},
		{"", "", true},
	}

	for _, tt := range tests {
		result, err := firstSubdomain(tt.url)
		if tt.hasError {
			require.Error(t, err, "firstSubdomain(%q) expected an error but got none", tt.url)
		} else {
			require.NoError(t, err, "firstSubdomain(%q) expected no error but got %v", tt.url, err)
			require.Equal(t, tt.expected, result, "firstSubdomain(%q) = %v, want %v", tt.url, result, tt.expected)
		}
	}
}

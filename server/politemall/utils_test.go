package politemall

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLastPathComponent(t *testing.T) {
	tests := []struct {
		url      string
		expected string
		hasError bool
	}{
		{"https://brightspace.com/000/activity/123?q=0", "123", false},
		{"https://brightspace.com/000/unit/789?q=0", "789", false},
		{"https://brightspace.com/000", "000", false},
		{"https://brightspace.com/", "", true},
	}

	for _, tt := range tests {
		result, err := lastPathComponent(tt.url)
		if tt.hasError {
			require.Error(t, err, "lastPathComponent(%q) expected an error but got none", tt.url)
		} else {
			require.NoError(t, err, "lastPathComponent(%q) expected no error but got %v", tt.url, err)
			require.Equal(t, tt.expected, result, "lastPathComponent(%q) = %v, want %v", tt.url, result, tt.expected)
		}
	}
}

package main

import (
	"encoding/base64"
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

// parsePoliteshopJWT parses a POLITEShop JWT and returns the user ID contained within.
func parsePoliteshopJWT(signingKey, token string) (string, error) {
	// POLITEShop JWTs use HMAC (which requires a []byte key)
	keyBytes, err := base64.StdEncoding.DecodeString(signingKey)
	if err != nil {
		return "", fmt.Errorf("invalid base64 SIGNING_KEY: %w", err)
	}

	parsedToken, err := jwt.Parse(
		token,
		func(*jwt.Token) (interface{}, error) { return keyBytes, nil },
		jwt.WithValidMethods([]string{"HS256"}),
	)
	if err != nil {
		return "", err
	}

	sub, err := parsedToken.Claims.GetSubject()
	if err != nil {
		return "", err
	} else if sub == "" {
		return "", errors.New("missing sub claim")
	}

	return sub, nil
}

// generatePoliteshopJWT generates a POLITEShop JWT with the given user ID.
func generatePoliteshopJWT(signingKey, userID string) (string, error) {
	// HMAC requires a []byte key
	keyBytes, err := base64.StdEncoding.DecodeString(signingKey)
	if err != nil {
		return "", fmt.Errorf("invalid base64 SIGNING_KEY: %w", err)
	}

	token, err := jwt.NewWithClaims(
		jwt.SigningMethodHS256,
		jwt.MapClaims{"sub": userID},
	).SignedString(keyBytes)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}
	return token, nil
}

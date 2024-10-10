package politemall

import (
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

// BrightspaceJWTPayload represents the payload of a Brightspace JWT used for authentication.
type BrightspaceJWTPayload struct {
	UserID   string
	TenantID string
}

// ParseBrightspaceJWT parses a Brightspace JWT and returns the payload.
func ParseBrightspaceJWT(token string) (BrightspaceJWTPayload, error) {
	parsedToken, _, err := jwt.NewParser().ParseUnverified(token, jwt.MapClaims{})
	if err != nil {
		return BrightspaceJWTPayload{}, err
	}

	rawTenantID, found := parsedToken.Claims.(jwt.MapClaims)["tenantid"]
	if !found {
		return BrightspaceJWTPayload{}, errors.New("missing tenantid claim")
	}

	tenantID, ok := rawTenantID.(string)
	if !ok {
		return BrightspaceJWTPayload{}, fmt.Errorf("tenantid claim is a %T", rawTenantID)
	}

	userID, err := parsedToken.Claims.GetSubject()
	if err != nil {
		return BrightspaceJWTPayload{}, err
	}
	if userID == "" {
		return BrightspaceJWTPayload{}, errors.New("missing sub claim")
	}

	return BrightspaceJWTPayload{
		UserID:   userID,
		TenantID: tenantID,
	}, nil
}

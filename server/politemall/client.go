package politemall

import (
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/url"
)

// Client is a per-user client for interacting with the POLITEMall API.
//
// A client is fully-initialized after calling [Client.UseD2lTokens], [Client.UseBrightspaceToken]
// (or [Client.UseBrightspaceTokenWithPayload]), and [Client.UseUserID], though you only need to
// call the necessary methods for whatever APIs you're using.
type Client struct {
	// UserID is the ID of the POLITEMall user.
	UserID string
	// cli is a HTTP client with cookies for requests to POLITEMall APIs (*.polite.edu.sg).
	cli *http.Client
	// brightspaceJWT is the JWT used for authentication to Brightspace APIs (*.api.brightspace.com).
	brightspaceJWT string
	// tenantID is the tenant ID of the Brightspace instance.
	tenantID string
	// politeDomain is the subdomain of the POLITEMall site used (e.g. "nplms" for nplms.polite.edu.sg).
	politeDomain string
}

// UseD2lTokens allows the client to authenticate further requests to POLITEMall APIs (*.polite.edu.sg).
// An error is returned if the politeDomain results in an invalid URL.
func (pm *Client) UseD2lTokens(d2lSessionVal, d2lSecureSessionVal, politeDomain string) error {
	jar, err := cookiejar.New(nil)
	if err != nil {
		panic(err) // This should be impossible
	}

	cookieUrl, err := url.Parse("https://" + politeDomain + ".polite.edu.sg/")
	if err != nil {
		return fmt.Errorf("invalid subdomain: %w", err)
	}

	jar.SetCookies(cookieUrl, []*http.Cookie{
		{Name: "d2lSessionVal", Value: d2lSessionVal},
		{Name: "d2lSecureSessionVal", Value: d2lSecureSessionVal},
	})

	pm.cli = &http.Client{Jar: jar}
	pm.politeDomain = politeDomain
	return nil
}

// UseBrightspaceToken allows the client to authenticate further requests to Brightspace APIs (*.api.brightspace.com).
// An error is returned if the JWT is syntactically invalid or doesn't contain valid tenant ID.
//
// The subject of the JWT is not used to set [Client.UserID] as it is
// not guaranteed to be legitimate (since we can't verify the JWT).
func (pm *Client) UseBrightspaceToken(token string) error {
	payload, err := ParseBrightspaceJWT(token)
	if err != nil {
		return fmt.Errorf("invalid Brightspace JWT: %w", err)
	}

	pm.UseBrightspaceTokenWithPayload(token, payload)
	return nil
}

// UseBrightspaceTokenWithPayload allows the client to authenticate further requests to Brightspace APIs (*.api.brightspace.com).
// Unlike [Client.UseBrightspaceToken], this skips parsing of the JWT and instead uses the provided payload.
func (pm *Client) UseBrightspaceTokenWithPayload(token string, payload BrightspaceJWTPayload) {
	pm.brightspaceJWT = token
	pm.tenantID = payload.TenantID
}

// UseUserID sets [Client.UserID] directly. Ensure that userID is derived from a trusted source.
func (pm *Client) UseUserID(userID string) {
	pm.UserID = userID
}

package main

import (
	"net/http"
	"politeshop/politemall"
)

// UserAuth is a middleware that adds a PolitemallClient to the request context.
func UserAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		secrets, ok := authSecretsFromHeader(&r.Header)
		if !ok {
			http.Error(w, "Missing authorization", http.StatusForbidden)
			return
		}

		politeDomain := r.Header.Get("X-Polite-Domain")
		pm, err := politemall.NewClient(politeDomain, secrets)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// token, found := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		// var verifiedUserID string

		// // Generate the POLITEShop JWT and include it in the response
		// if !found {
		// 	// TODO: Verify the sub
		// 	// TODO: Generate the token
		// 	// TODO: Include the token in the response
		// }

		// Reject requests that might be using tampered or stolen Brightspace tokens
		// if pm.UserID != verifiedUserID {
		// 	http.Error(w, "Unauthorized", http.StatusForbidden)
		// 	return
		// }

		next.ServeHTTP(w, r.WithContext(ctxWithPm(r.Context(), pm)))
	})
}

// authSecretsFromHeader extracts the politemall.AuthSecrets from a http.Header.
func authSecretsFromHeader(header *http.Header) (politemall.AuthSecrets, bool) {
	d2lSessionVal := header.Get("X-D2l-Session-Val")
	d2lSecureSessionVal := header.Get("X-D2l-Secure-Session-Val")
	brightspaceToken := header.Get("X-Brightspace-Token")

	if d2lSessionVal == "" || d2lSecureSessionVal == "" || brightspaceToken == "" {
		return politemall.AuthSecrets{}, false
	}
	return politemall.AuthSecrets{
		D2lSessionVal:       d2lSessionVal,
		D2lSecureSessionVal: d2lSecureSessionVal,
		BrightspaceToken:    brightspaceToken,
	}, true
}

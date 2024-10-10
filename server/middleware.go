package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"politeshop/politemall"
)

// UserAuth is a middleware that adds a fully-initialized [politemall.Client] to the request context.
// This returns a HTTP error response if any of the required authentication tokens are missing.
func UserAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		pm := politemall.Client{}

		redirectOrError := func(error string, code int) {
			if r.URL.Path == "/login" {
				http.Error(w, error, code)
			} else {
				u := "/login?redirect=" + url.QueryEscape(r.URL.String())
				slog.Info(fmt.Sprintf("Redirecting to %s (%s)", u, error))
				http.Redirect(w, r, u, http.StatusFound)
			}
		}

		// Set credentials for POLITEMall APIs
		d2lSessionVal, err1 := r.Cookie("d2lSessionVal")
		d2lSecureSessionVal, err2 := r.Cookie("d2lSecureSessionVal")
		if err1 != nil || err2 != nil {
			redirectOrError("Missing D2L credentials", http.StatusForbidden)
			return
		}
		politeDomain, err := r.Cookie("politeDomain")
		if err != nil {
			redirectOrError("Missing politeDomain", http.StatusBadRequest)
			return
		}
		if err := pm.UseD2lTokens(d2lSessionVal.Value, d2lSecureSessionVal.Value, politeDomain.Value); err != nil {
			redirectOrError("Invalid politeDomain", http.StatusBadRequest)
			return
		}

		// Set credentials for Brightspace APIs
		brightspaceJWT, err := r.Cookie("brightspaceToken")
		if err != nil {
			redirectOrError("Missing Brightspace token", http.StatusForbidden)
			return
		}
		brightspaceJWTPayload, err := politemall.ParseBrightspaceJWT(brightspaceJWT.Value)
		if err != nil {
			redirectOrError("Invalid Brightspace JWT", http.StatusBadRequest)
			return
		}
		pm.UseBrightspaceTokenWithPayload(brightspaceJWT.Value, brightspaceJWTPayload)

		signingKey := os.Getenv("SIGNING_KEY")
		if signingKey == "" {
			slog.Error("missing SIGNING_KEY environment variable")
			redirectOrError("Internal server error", http.StatusInternalServerError)
			return
		}
		politeshopJWT, err := r.Cookie("politeshopToken")
		var verifiedUserID string

		// Generate a POLITEShop JWT if it's missing
		if err != nil {
			csrfToken, err := r.Cookie("csrfToken")
			if err != nil {
				redirectOrError("Missing CSRF token", http.StatusForbidden)
				return
			}

			newBrightspaceJWT, err := pm.GetNewBrightspaceToken(csrfToken.Value)
			if err != nil {
				// TODO: Be more specific - add PolitemallAuthError type
				slog.Error(err.Error())
				redirectOrError("Failed to generate new Brightspace token", http.StatusInternalServerError)
				return
			}

			newBrightspaceJWTPayload, err := politemall.ParseBrightspaceJWT(newBrightspaceJWT)
			if err != nil {
				redirectOrError("Invalid Brightspace token received from Brightspace", http.StatusBadGateway)
				return
			}

			// If the user ID provided by Brightspace doesn't match the one in the
			// cookie, the client is probably trying to impersonate another user...
			if brightspaceJWTPayload.UserID != newBrightspaceJWTPayload.UserID {
				redirectOrError("User ID mismatch", http.StatusBadRequest)
				return
			}

			verifiedUserID = newBrightspaceJWTPayload.UserID
			newPoliteshopJWT, err := generatePoliteshopJWT(signingKey, verifiedUserID)
			if err != nil {
				redirectOrError("Failed to generate POLITEShop token", http.StatusInternalServerError)
				return
			}
			http.SetCookie(w, &http.Cookie{
				Name:   "politeshopToken",
				Value:  newPoliteshopJWT,
				MaxAge: 604800, // 1 week
			})
		} else {
			verifiedUserID, err = parsePoliteshopJWT(signingKey, politeshopJWT.Value)
			if err != nil {
				redirectOrError("Invalid POLITEShop token", http.StatusBadRequest)
				return
			}
		}
		pm.UseUserID(verifiedUserID)

		next.ServeHTTP(w, r.WithContext(
			context.WithValue(r.Context(), PolitemallClientContextKey, &pm),
		))
	})
}

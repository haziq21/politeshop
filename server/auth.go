package main

import (
	"context"
	"net/http"
	"politeshop/politemall"
	"strings"
)

func UserAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		politeDomain, err := firstSubdomain(r.Header.Get("Origin"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		secrets, ok := politemall.AuthSecretsFromHeader(&r.Header)
		if !ok {
			http.Error(w, "Missing authorization", http.StatusForbidden)
			return
		}

		token, found := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")

		// Set the authorization header if it's not already there
		if !found {

		}

		pm, err := politemall.NewClient(politeDomain, secrets)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// TODO: Verify sub in secrets.BrightspaceToken

		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), "pm", pm)))
	})
}

// PolitemallClient.VerifyUserID(correctUserID string) error

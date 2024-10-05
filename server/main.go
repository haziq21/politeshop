package main

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"politeshop/services"
	"politeshop/templates"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	_ "github.com/lib/pq"
)

func main() {
	sc, err := services.NewClient()
	if err != nil {
		panic(err)
	}
	if err := sc.RunMigrations(); err != nil {
		panic(err)
	}

	// Router setup and middleware
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*.polite.edu.sg"},
		AllowedHeaders:   []string{"X-D2l-Session-Val", "X-D2l-Secure-Session-Val", "X-Brightspace-Token"},
		AllowCredentials: true,
	}))
	r.Use(middleware.WithValue(ScCtxKey, sc))
	r.Use(middleware.Recoverer)

	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
	r.Get("/login", getLogin)

	r.Route("/d2l", func(r chi.Router) {
		r.Use(UserAuth)
		r.Get("/home", getHomepage)
	})

	http.ListenAndServe(fmt.Sprintf(":%s", os.Getenv("PORT")), r)
}

func getHomepage(w http.ResponseWriter, r *http.Request) {
	pm := pmFromCtx(r.Context())
	sc := scFromCtx(r.Context())

	user, sch, err := pm.GetUserAndSchool()
	if err != nil {
		panic(err)
	}
	if err := sc.UpsertSchool(sch); err != nil {
		panic(err)
	}
	if err := sc.UpsertUser(user); err != nil {
		panic(err)
	}

	sems, err := pm.GetSemesters()
	if err != nil {
		panic(err)
	}
	if err := sc.UpsertSemesters(sems); err != nil {
		panic(err)
	}

	mods, err := pm.GetModules()
	if err != nil {
		panic(err)
	}
	if err := sc.UpsertUserModules(user.ID, mods); err != nil {
		panic(err)
	}

	if len(mods) == 0 {
		mods, err = pm.GetModules()
		if err != nil {
			panic(err)
		}
		if err := sc.UpsertUserModules(pm.UserID, mods); err != nil {
			panic(err)
		}
	}

	templates.Home(&mods).Render(r.Context(), w)
}

func getLogin(w http.ResponseWriter, r *http.Request) {
	var redirect string
	var err error
	if q := r.URL.Query()["redirect"]; len(q) == 1 {
		redirect, err = url.QueryUnescape(q[0])
		if err != nil {
			http.Error(w, "Malformed redirect URL", http.StatusBadRequest)
			return
		}
	} else {
		http.Error(w, "Query should have one 'redirect' key", http.StatusBadRequest)
		return
	}

	templates.Login(redirect).Render(r.Context(), w)
}

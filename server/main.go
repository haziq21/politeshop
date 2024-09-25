package main

import (
	"net/http"
	"politeshop/store"
	"politeshop/templates"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	_ "github.com/lib/pq"
)

// func test() error {
// 	ps, err := politestore.Connect()
// 	if err != nil {
// 		return err
// 	}
// 	if err := ps.RunMigrations(); err != nil {
// 		return err
// 	}

// 	pm, err := politemall.NewClient("nplms", politemall.AuthSecretsFromEnv())
// 	if err != nil {
// 		return err
// 	}

// 	sems, err := pm.GetSemesters()
// 	if err != nil {
// 		return err
// 	}
// 	fmt.Println(sems)

// 	if err := ps.UpsertSemesters(sems); err != nil {
// 		return err
// 	}

// 	mods, err := pm.GetModules()
// 	if err != nil {
// 		return err
// 	}
// 	fmt.Println(mods)

// 	if err := ps.UpsertModules(mods); err != nil {
// 		return err
// 	}

// 	user, sch, err := pm.GetUserAndSchool()
// 	if err != nil {
// 		return err
// 	}
// 	fmt.Println(sch)
// 	fmt.Println(user)

// 	if err := ps.UpsertSchool(sch); err != nil {
// 		return err
// 	}
// 	if err := ps.UpsertUser(user); err != nil {
// 		return err
// 	}

// 	return nil
// }

func main() {
	sc, err := store.Connect()
	if err != nil {
		panic(err)
	}
	if err := sc.RunMigrations(); err != nil {
		panic(err)
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"https://*.polite.edu.sg"},
		AllowedHeaders:   []string{"X-D2l-Session-Val", "X-D2l-Secure-Session-Val", "X-Brightspace-Token"},
		AllowCredentials: true,
	}))
	r.Use(UserAuth)
	r.Use(middleware.WithValue(ScCtxKey, sc))
	r.Use(middleware.Recoverer)

	r.Get("/d2l/home", getHomepage)

	http.ListenAndServe(":8080", r)
}

func getHomepage(w http.ResponseWriter, r *http.Request) {
	pm := pmFromCtx(r.Context())
	sc := scFromCtx(r.Context())

	// mods, err := pm.GetModules()
	// if err != nil {
	// 	panic(err)
	// }
	// if err := ps.UpsertModules(mods); err != nil {
	// 	panic(err)
	// }

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

	mods, err := sc.GetUserModules(pm.UserID)
	if err != nil {
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

package main

import (
	"fmt"
	"log"
	"net/http"
	"politeshop/politemall"
	"politeshop/politestore"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	_ "github.com/lib/pq"
)

func test() error {
	ps, err := politestore.Connect()
	if err != nil {
		return err
	}
	if err := ps.RunMigrations(); err != nil {
		return err
	}

	pm, err := politemall.NewClient("nplms", politemall.AuthSecretsFromEnv())
	if err != nil {
		return err
	}

	sems, err := pm.GetSemesters()
	if err != nil {
		return err
	}
	fmt.Println(sems)

	if err := ps.UpsertSemesters(sems); err != nil {
		return err
	}

	mods, err := pm.GetModules()
	if err != nil {
		return err
	}
	fmt.Println(mods)

	if err := ps.UpsertModules(mods); err != nil {
		return err
	}

	user, sch, err := pm.GetUserAndSchool()
	if err != nil {
		return err
	}
	fmt.Println(sch)
	fmt.Println(user)

	if err := ps.UpsertSchool(sch); err != nil {
		return err
	}
	if err := ps.UpsertUser(user); err != nil {
		return err
	}

	return nil
}

func main() {
	if err := test(); err != nil {
		log.Fatal(err)
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.AllowAll().Handler)

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		auth, ok := politemall.AuthSecretsFromHeader(&r.Header)
		if !ok {
			fmt.Fprintf(w, "Missing auth!")
			w.WriteHeader(http.StatusForbidden)
			return
		}

		politeDomain := r.Header.Get("X-Polite-Domain")
		pm, err := politemall.NewClient(politeDomain, auth)
		if err != nil {
			panic(err)
		}

		user, school, err := pm.GetUserAndSchool()
		if err != nil {
			panic(err)
		}

		log.Printf("%+v", user)
		log.Printf("%+v", school)
	})

	http.ListenAndServe(":8080", r)

	// pm, err := politemall.NewClient("nplms", os.Getenv("D2L_SESSION_VAL"), os.Getenv("D2L_SECURE_SESSION_VAL"), os.Getenv("BRIGHTSPACE_TOKEN"))
	// if err != nil {
	// 	fmt.Println(err)
	// 	return
	// }

	// _, err = pm.GetSemesters()
	// if err != nil {
	// 	fmt.Println(err)
	// 	return
	// }

	// // fmt.Println("Semesters:", semesters)

	// // modules, err := pm.GetModules()
	// // if err != nil {
	// // 	fmt.Println(err)
	// // 	return
	// // }

	// // fmt.Println(modules)

	// units, err := pm.GetModuleUnits("468283")
	// if err != nil {
	// 	fmt.Println(err)
	// 	return
	// }

	// fmt.Printf("%+v", units)
}

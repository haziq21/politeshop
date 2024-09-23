package main

import (
	"fmt"
	"log"
	"os"
	"politeshop/politemall"
	"politeshop/politestore"

	_ "github.com/lib/pq"
)

func test() error {
	// Database setup
	ps, err := politestore.Connect()
	if err != nil {
		return err
	}
	if err := ps.RunMigrations(); err != nil {
		return err
	}

	pm, err := politemall.NewClient("nplms", os.Getenv("D2L_SESSION_VAL"), os.Getenv("D2L_SECURE_SESSION_VAL"), os.Getenv("BRIGHTSPACE_TOKEN"))
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

	return nil
}

func main() {
	if err := test(); err != nil {
		log.Fatal(err)
	}

	// r := chi.NewRouter()
	// r.Use(middleware.Logger)
	// r.Use(middleware.Recoverer)

	// r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
	// 	w.Write([]byte("pong"))
	// })

	// http.ListenAndServe(":8080", r)

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

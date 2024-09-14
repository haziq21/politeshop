package main

import (
	"fmt"
	"os"
	"politeshop/politemall"
)

func main() {
	pm, err := politemall.NewClient("nplms", os.Getenv("D2L_SESSION_VAL"), os.Getenv("D2L_SECURE_SESSION_VAL"), os.Getenv("BRIGHTSPACE_TOKEN"))
	if err != nil {
		fmt.Println(err)
		return
	}

	_, err = pm.GetSemesters()
	if err != nil {
		fmt.Println(err)
		return
	}

	// fmt.Println("Semesters:", semesters)

	// modules, err := pm.GetModules()
	// if err != nil {
	// 	fmt.Println(err)
	// 	return
	// }

	// fmt.Println(modules)

	units, err := pm.GetModuleContent("468283")
	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Printf("%+v", units)
}

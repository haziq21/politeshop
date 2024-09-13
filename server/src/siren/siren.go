package siren

import (
	"slices"
)

type Entity struct {
	Actions    []Action
	Entities   []Entity
	Links      []Link
	Properties map[string]interface{}
	Class      []string
	Href       string
}

func (e *Entity) ClassIs(classes ...string) bool {
	return slices.Equal(e.Class, classes)
}

func (e *Entity) FindLinkWithRel(rels ...string) *Link {
	for _, link := range e.Links {
		if slices.Equal(link.Rel, rels) {
			return &link
		}
	}
	return nil
}

type Action struct {
	Class                     []string
	Name, Method, Href, Title string
	Typ                       string `json:"type"`
	Fields                    []Field
}

type Field struct {
	Name, Title string
	Typ         string `json:"type"`
	Value       interface{}
}

type Link struct {
	Rel  []string
	Href string
}

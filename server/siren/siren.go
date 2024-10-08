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

// FindLinkWithRel returns the first link with the given rels.
func (e *Entity) FindLinkWithRel(rels ...string) (*Link, bool) {
	for _, link := range e.Links {
		if slices.Equal(link.Rel, rels) {
			return &link, true
		}
	}
	return nil, false
}

func (e *Entity) StringProperty(key string) (string, bool) {
	if value, ok := e.Properties[key].(string); ok {
		return value, true
	}
	return "", false
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

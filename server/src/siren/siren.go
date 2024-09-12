package siren

type Entity struct {
	Actions    []Action
	Entities   []SubEntity
	Links      []Link
	Properties map[string]interface{}
}

type SubEntity struct {
	Entity
	Href string
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

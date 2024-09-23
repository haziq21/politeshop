package politemall

import (
	"politeshop/politestore"
	"politeshop/siren"
	"testing"

	"github.com/google/go-cmp/cmp"
)

var activityEnt = siren.Entity{
	Properties: map[string]interface{}{"title": "activity"},
	Class:      []string{"release-condition-fix", "sequenced-activity"},
	Links: []siren.Link{
		{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/activity/123?q=0"},
		{Rel: []string{"up"}, Href: "https://brightspace.com/000/activity/456?q=0"},
	},
}

var activityEntNoTitle = siren.Entity{
	Class: []string{"release-condition-fix", "sequenced-activity"},
	Links: []siren.Link{
		{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/activity/123?q=0"},
		{Rel: []string{"up"}, Href: "https://brightspace.com/000/activity/456?q=0"},
	},
}

var lessonEnt = siren.Entity{
	Properties: map[string]interface{}{"title": "lesson"},
	Class:      []string{"release-condition-fix", "sequence", "sequence-description"},
	Links: []siren.Link{
		{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/activity/456?q=0"},
		{Rel: []string{"up"}, Href: "https://brightspace.com/000/activity/789?q=0"},
	},
	Entities: []siren.Entity{activityEnt},
}

var lessonEntNoActivities = siren.Entity{
	Properties: map[string]interface{}{"title": "lesson"},
	Class:      []string{"release-condition-fix", "sequence", "sequence-description"},
	Links: []siren.Link{
		{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/activity/456?q=0"},
		{Rel: []string{"up"}, Href: "https://brightspace.com/000/activity/789?q=0"},
	},
	Entities: []siren.Entity{},
}

var lessonEntNoTitle = siren.Entity{
	Class: []string{"release-condition-fix", "sequence", "sequence-description"},
	Links: []siren.Link{
		{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/activity/456?q=0"},
		{Rel: []string{"up"}, Href: "https://brightspace.com/000/activity/789?q=0"},
	},
	Entities: []siren.Entity{activityEnt},
}

var unitEnt = siren.Entity{
	Properties: map[string]interface{}{"title": "unit"},
	Links: []siren.Link{
		{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/unit/789?q=0"},
		{Rel: []string{"up"}, Href: "https://brightspace.com/000?q=0"},
	},
	Entities: []siren.Entity{lessonEntNoActivities},
}

var unitEntNoLessons = siren.Entity{
	Properties: map[string]interface{}{"title": "unit"},
	Links: []siren.Link{
		{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/unit/789?q=0"},
		{Rel: []string{"up"}, Href: "https://brightspace.com/000?q=0"},
	},
	Entities: []siren.Entity{},
}

var unitEntNoTitle = siren.Entity{
	Links: []siren.Link{
		{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/unit/789?q=0"},
		{Rel: []string{"up"}, Href: "https://brightspace.com/000?q=0"},
	},
	Entities: []siren.Entity{lessonEntNoActivities},
}

func TestParseUnit(t *testing.T) {
	pm := PolitemallClient{}
	tests := []struct {
		ent  siren.Entity
		want *politestore.Unit
	}{
		{unitEntNoLessons, &politestore.Unit{ID: "789", ModuleID: "000", Title: "unit", Lessons: []politestore.Lesson{}}},
		{unitEnt, &politestore.Unit{ID: "789", ModuleID: "000", Title: "unit", Lessons: []politestore.Lesson{{ID: "456", UnitID: "789", Title: "lesson", Activities: []politestore.Activity{}}}}},
		{unitEntNoTitle, nil},
	}

	for _, tt := range tests {
		got, err := pm.parseUnit(&tt.ent)

		if !cmp.Equal(got, tt.want) {
			t.Errorf("got %+v, want %+v", got, tt.want)
		} else if got == nil && err == nil {
			t.Error("missing error")
		}
	}
}

func TestParseLesson(t *testing.T) {
	pm := PolitemallClient{}
	tests := []struct {
		ent  siren.Entity
		want *politestore.Lesson
	}{
		{lessonEntNoActivities, &politestore.Lesson{ID: "456", UnitID: "789", Title: "lesson", Activities: []politestore.Activity{}}},
		{lessonEnt, &politestore.Lesson{ID: "456", UnitID: "789", Title: "lesson", Activities: []politestore.Activity{{ID: "123", LessonID: "456", Title: "activity"}}}},
		{lessonEntNoTitle, nil},
	}

	for _, tt := range tests {
		got, err := pm.parseLesson(&tt.ent)

		if !cmp.Equal(got, tt.want) {
			t.Errorf("got %+v, want %+v", got, tt.want)
		} else if got == nil && err == nil {
			t.Error("missing error")
		}
	}
}

func TestParseActivity(t *testing.T) {
	pm := PolitemallClient{}
	tests := []struct {
		ent  siren.Entity
		want *politestore.Activity
	}{
		{activityEnt, &politestore.Activity{ID: "123", LessonID: "456", Title: "activity"}},
		{activityEntNoTitle, nil},
	}

	for _, tt := range tests {
		got, err := pm.parseActivity(&tt.ent)

		if !cmp.Equal(got, tt.want) {
			t.Errorf("got %+v, want %+v", got, tt.want)
		} else if got == nil && err == nil {
			t.Error("missing error")
		}
	}
}

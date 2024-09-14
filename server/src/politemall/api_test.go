package politemall

import (
	"politeshop/siren"
	"testing"

	"github.com/google/go-cmp/cmp"
)

var dummyActivityEnt = siren.Entity{
	Properties: map[string]interface{}{"title": "test title"},
	Class:      []string{"release-condition-fix", "sequenced-activity"},
	Links:      []siren.Link{{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/activity/123?q=0"}},
}

var dummyLessonEnt = siren.Entity{
	Properties: map[string]interface{}{"title": "lesson"},
	Class:      []string{"release-condition-fix", "sequence", "sequence-description"},
	Links:      []siren.Link{{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/activity/123?q=0"}},
	Entities:   []siren.Entity{dummyActivityEnt},
}

func TestParseUnit(t *testing.T) {
	pm := PolitemallClient{}
	tests := []struct {
		ent     siren.Entity
		want    Unit
		wantErr bool
	}{
		{siren.Entity{
			Properties: map[string]interface{}{"title": "test title"},
			Links:      []siren.Link{{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/unit/123?q=0"}},
		}, Unit{Id: "123", Title: "test title", Lessons: []Lesson{}}, false},
		{siren.Entity{
			Properties: map[string]interface{}{"title": "test title"},
			Links:      []siren.Link{{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/unit/123?q=0"}},
			Entities:   []siren.Entity{dummyLessonEnt},
		}, Unit{Id: "123", Title: "test title", Lessons: []Lesson{{Id: "123", Title: "lesson", Activities: []Activity{{Id: "123", Title: "test title"}}}}}, false},
		{siren.Entity{
			Links: []siren.Link{{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/unit/123?q=0"}},
		}, Unit{}, true},
		{siren.Entity{
			Properties: map[string]interface{}{"title": "test title"},
		}, Unit{}, true},
	}

	for _, tt := range tests {
		got, err := pm.parseUnit(&tt.ent)

		if err != nil && !tt.wantErr {
			t.Errorf("unexpected err: %v", err)
		} else if err == nil && tt.wantErr {
			t.Errorf("expected err, got nil")
		} else if !cmp.Equal(got, tt.want) {
			t.Errorf("got %+v, want %+v", got, tt.want)
		}
	}
}

func TestParseLesson(t *testing.T) {
	pm := PolitemallClient{}
	tests := []struct {
		ent     siren.Entity
		want    Lesson
		wantErr bool
	}{
		{siren.Entity{
			Properties: map[string]interface{}{"title": "test title"},
			Links:      []siren.Link{{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/lesson/123?q=0"}},
		}, Lesson{Id: "123", Title: "test title", Activities: []Activity{}}, false},
		{dummyLessonEnt, Lesson{Id: "123", Title: "lesson", Activities: []Activity{{Id: "123", Title: "test title"}}}, false},
		{siren.Entity{
			Links: []siren.Link{{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/lesson/123?q=0"}},
		}, Lesson{}, true},
		{siren.Entity{
			Properties: map[string]interface{}{"title": "test title"},
		}, Lesson{}, true},
	}

	for _, tt := range tests {
		got, err := pm.parseLesson(&tt.ent)

		if err != nil && !tt.wantErr {
			t.Errorf("unexpected err: %v", err)
		} else if err == nil && tt.wantErr {
			t.Errorf("expected err, got nil")
		} else if !cmp.Equal(got, tt.want) {
			t.Errorf("got %+v, want %+v", got, tt.want)
		}
	}
}

func TestParseActivity(t *testing.T) {
	pm := PolitemallClient{}
	tests := []struct {
		ent     siren.Entity
		want    Activity
		wantErr bool
	}{
		{dummyActivityEnt, Activity{Id: "123", Title: "test title"}, false},
		{siren.Entity{
			Links: []siren.Link{{Rel: []string{"self", "describes"}, Href: "https://brightspace.com/000/activity/123?q=0"}},
		}, Activity{}, true},
		{siren.Entity{
			Properties: map[string]interface{}{"title": "test title"},
		}, Activity{}, true},
	}

	for _, tt := range tests {
		got, err := pm.parseActivity(&tt.ent)

		if err != nil && !tt.wantErr {
			t.Errorf("unexpected err: %v", err)
		} else if err == nil && tt.wantErr {
			t.Errorf("expected err, got nil")
		} else if got != tt.want {
			t.Errorf("got %+v, want %+v", got, tt.want)
		}
	}
}

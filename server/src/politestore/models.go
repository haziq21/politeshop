package politestore

type User struct {
	ID, Name, School string
}

type School struct {
	ID, Name string
}

type Semester struct {
	ID, Name string
}

type Module struct {
	ID, Name, Code, Semester string
}

type Unit struct {
	ID, ModuleID, Title string
	Lessons             []Lesson
}

type Lesson struct {
	ID, UnitID, Title string
	Transparent       bool
	Activities        []Activity
}

type Activity struct {
	ID, LessonID, Title string
}

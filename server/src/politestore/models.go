package db

type Module struct {
	ID, Name, Code, Semester string
}

type Semester struct {
	ID, Name string
}

type User struct {
	ID, Name string
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

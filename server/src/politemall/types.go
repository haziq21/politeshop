package politemall

type Semester struct {
	Id, Name string
}

type Module struct {
	Id, Name, Code, SemesterId string
}

type Unit struct {
	Id, Title string
	Lessons   []Lesson
}

type Lesson struct {
	Id, Title   string
	Transparent bool
	Activities  []Activity
}

type Activity struct {
	Id, Title string
}

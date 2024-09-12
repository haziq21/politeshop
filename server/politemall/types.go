package politemall

type Semester struct {
	id   string
	name string
}

type Module struct {
	id         string
	name       string
	code       string
	semesterId string
}

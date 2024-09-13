package politemall

type Semester struct {
	id, name string
}

type Module struct {
	id, name, code, semesterId string
}

type ContentGroup struct {
	id, name, moduleId string
}

type ActivityGroup struct {
	id, name, contentGroupId string
	transparent              bool
	activities               []*Activity
}

type Activity struct {
	id, name, activityGroupId string
}

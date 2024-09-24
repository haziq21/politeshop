package politestore

import (
	"embed"
	"os"

	"github.com/jmoiron/sqlx"
	"github.com/pressly/goose/v3"
)

type PolitestoreClient struct {
	*sqlx.DB
}

func Connect() (*PolitestoreClient, error) {
	conn, err := sqlx.Connect("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		return nil, err
	}

	return &PolitestoreClient{DB: conn}, nil
}

//go:embed migrations/*.sql
var embedMigrations embed.FS

func (ps *PolitestoreClient) RunMigrations() error {
	goose.SetBaseFS(embedMigrations)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	if err := goose.Up(ps.DB.DB, "migrations"); err != nil {
		return err
	}
	return nil
}

func (ps *PolitestoreClient) UpsertUser(user User) error {
	_, err := ps.NamedExec(`
		INSERT INTO users (id, name, school)
		VALUES (:id, :name, :school)
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, school = EXCLUDED.school`,
		user)
	return err
}

func (ps *PolitestoreClient) UpsertSchool(sch School) error {
	_, err := ps.NamedExec(`
		INSERT INTO schools (id, name)
		VALUES (:id, :name)
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
		sch)
	return err
}

func (ps *PolitestoreClient) UpsertSemesters(sems []Semester) error {
	_, err := ps.NamedExec(`
		INSERT INTO semesters (id, name)
		VALUES (:id, :name)
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
		sems,
	)
	return err
}

func (ps *PolitestoreClient) UpsertModules(mods []Module) error {
	_, err := ps.NamedExec(`
		INSERT INTO modules (id, name, code, semester)
		VALUES (:id, :name, :code, :semester)
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, semester = EXCLUDED.semester`,
		mods,
	)
	return err
}

// func (ps *PolitestoreClient) UpsertUnits(units []Unit) error {
// 	_, err := ps.NamedExec()
// }

package services

import (
	"embed"

	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

func (sc *ServiceClient) RunMigrations() error {
	goose.SetBaseFS(embedMigrations)
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	if err := goose.Up(sc.DB.DB, "migrations"); err != nil {
		return err
	}
	return nil
}

func (sc *ServiceClient) UpsertUser(user User) error {
	_, err := sc.NamedExec(`
		INSERT INTO users (id, name, school)
		VALUES (:id, :name, :school)
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, school = EXCLUDED.school`,
		user)
	return err
}

func (sc *ServiceClient) UpsertSchool(sch School) error {
	_, err := sc.NamedExec(`
		INSERT INTO schools (id, name)
		VALUES (:id, :name)
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
		sch)
	return err
}

func (sc *ServiceClient) UpsertSemesters(sems []Semester) error {
	_, err := sc.NamedExec(`
		INSERT INTO semesters (id, name)
		VALUES (:id, :name)
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
		sems,
	)
	return err
}

func (sc *ServiceClient) UpsertUserModules(userID string, mods []Module) error {
	tx := sc.MustBegin()
	tx.NamedExec(`
		INSERT INTO modules (id, name, code, semester)
		VALUES (:id, :name, :code, :semester)
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, semester = EXCLUDED.semester`,
		mods,
	)

	for _, mod := range mods {
		tx.MustExec(`
			INSERT INTO user_modules (user_id, module_id)
			VALUES ($1, $2)
			ON CONFLICT (user_id, module_id) DO NOTHING`,
			userID,
			mod.ID,
		)
	}

	return tx.Commit()
}

func (sc *ServiceClient) GetUserModules(userID string) ([]Module, error) {
	var mods []Module
	err := sc.Select(
		&mods,
		`SELECT modules.id AS id, modules.name AS name, modules.code AS code, modules.semester AS semester
		FROM modules
		INNER JOIN user_modules ON modules.id = user_modules.module_id
		INNER JOIN users ON users.id = user_modules.user_id
		WHERE users.id = $1`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	return mods, nil
}

// func (sc *PolitestoreClient) UpsertUnits(units []Unit) error {
// 	_, err := sc.NamedExec()
// }

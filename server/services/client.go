package services

import (
	"github.com/jmoiron/sqlx"
)

type ServiceClient struct {
	*sqlx.DB
}

func NewClient() (*ServiceClient, error) {
	conn, err := sqlx.Connect("postgres", "postgres://postgres:password@0.0.0.0:5432/postgres")
	if err != nil {
		return nil, err
	}

	return &ServiceClient{DB: conn}, nil
}

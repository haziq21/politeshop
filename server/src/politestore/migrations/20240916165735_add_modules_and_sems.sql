-- +goose Up
-- +goose StatementBegin
CREATE TABLE semesters (
    id   text PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE modules (
    id       text PRIMARY KEY,
    name     text NOT NULL,
    code     text NOT NULL,
    semester text NOT NULL REFERENCES semesters ON UPDATE CASCADE ON DELETE CASCADE
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE modules;
DROP TABLE semesters;
-- +goose StatementEnd

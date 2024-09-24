-- +goose Up
-- +goose StatementBegin
CREATE TABLE schools (
    id   text PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE users (
    id     text PRIMARY KEY,
    name   text NOT NULL,
    school text REFERENCES schools ON UPDATE CASCADE ON DELETE CASCADE
);

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

CREATE TABLE user_modules (
    user_id   text REFERENCES users ON UPDATE CASCADE ON DELETE CASCADE,
    module_id text REFERENCES modules ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (user_id, module_id)
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE user_modules;
DROP TABLE modules;
DROP TABLE semesters;
DROP TABLE users;
DROP TABLE schools;
-- +goose StatementEnd

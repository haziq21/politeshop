-- +goose Up
-- +goose StatementBegin
CREATE TABLE users (
    id   text PRIMARY KEY,
    name text NOT NULL
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
DROP TABLE users;
-- +goose StatementEnd

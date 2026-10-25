# Migrations

The initial schema lives in `../schema.sql` (apply it with `npm run db:schema` / `db:schema:local`).
Future schema changes go here as `0001_<name>.sql`, `0002_…` and are applied with
`wrangler d1 migrations apply focuspoint` (add `--local` for the dev database).

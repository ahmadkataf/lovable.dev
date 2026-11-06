# Migrations

The initial schema lives in `../schema.sql` (apply it with `npm run db:schema` / `db:schema:local`).
Future schema changes go here as `0001_<name>.sql`, `0002_…` and are applied with
`wrangler d1 migrations apply focuspoint` (add `--local` for the dev database).

Every migration only adds tables/indexes with `IF NOT EXISTS`, and `../schema.sql` carries the same statements, so
`deploy.mjs` (which applies schema.sql) creates them too. `0002_site_editor.sql`: site_content, site_content_history,
media, room_photos (the site editor, docs/cms/DESIGN.md).

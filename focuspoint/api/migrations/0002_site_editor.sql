-- Migration 0002: the site editor's tables (content overrides + undo history, uploaded media, room photos).
-- schema.sql has the same statements (deploy.mjs applies it, idempotent); this file is for `wrangler d1 migrations apply`.
CREATE TABLE IF NOT EXISTS site_content (            -- single row, id = 1
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL,
  updated_at TEXT,
  updated_by INTEGER
);
CREATE TABLE IF NOT EXISTS site_content_history (    -- undo: a section's value from before each save / reset (last 20 per section)
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL,
  data TEXT,                                         -- JSON of the section before the change; NULL = it was the default
  saved_at TEXT,
  saved_by INTEGER
);
CREATE INDEX IF NOT EXISTS site_content_history_section ON site_content_history(section, id);
CREATE TABLE IF NOT EXISTS media (                   -- images uploaded from the editor (≤ 1,000,000 bytes), served at /media/<id>.<ext>
  id TEXT PRIMARY KEY,                               -- 16 random hex characters
  mime TEXT NOT NULL,                                -- image/webp | image/jpeg | image/png
  data BLOB NOT NULL,
  w INTEGER,
  h INTEGER,
  bytes INTEGER,
  created_at TEXT,
  created_by INTEGER
);
CREATE INDEX IF NOT EXISTS media_created ON media(created_at);
CREATE TABLE IF NOT EXISTS room_photos (             -- Room.photos, in order (≤ 8); deleted with the room
  room_id INTEGER NOT NULL,
  sort INTEGER NOT NULL,
  src TEXT NOT NULL,                                 -- /img/… or /media/…
  alt TEXT NOT NULL DEFAULT '',
  w INTEGER,
  h INTEGER,
  small TEXT,                                        -- optional ≤720 px variant (Photo.small)
  PRIMARY KEY (room_id, sort)
);

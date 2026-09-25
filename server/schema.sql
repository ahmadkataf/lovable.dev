-- Activation codes. A code is sold once and then belongs to one phone.
CREATE TABLE IF NOT EXISTS codes (
  code       TEXT PRIMARY KEY,          -- 12 characters, shown as XXXX-XXXX-XXXX
  book       TEXT NOT NULL,             -- which app it opens: g12, g11, g8
  created_at INTEGER NOT NULL,          -- ms since 1970
  expires_at INTEGER,                   -- ms; NULL = never
  note       TEXT NOT NULL DEFAULT '',  -- student name, payment, anything
  seller     TEXT NOT NULL DEFAULT '',  -- teacher, bookshop or "direct"
  device     TEXT,                      -- the phone it was activated on
  bound_at   INTEGER,
  last_seen  INTEGER,
  revoked    INTEGER NOT NULL DEFAULT 0,
  moves      INTEGER NOT NULL DEFAULT 0 -- times it was moved to a new phone
);
CREATE INDEX IF NOT EXISTS codes_book ON codes(book);
CREATE INDEX IF NOT EXISTS codes_device ON codes(device);

-- What happened, for support and to spot abuse.
CREATE TABLE IF NOT EXISTS events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     INTEGER NOT NULL,
  kind   TEXT NOT NULL,                 -- activate, activate-fail, session, content, admin
  code   TEXT,
  device TEXT,
  ip     TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS events_ip_at ON events(ip, at);
CREATE INDEX IF NOT EXISTS events_code ON events(code);

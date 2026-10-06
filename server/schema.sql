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

-- A student's request for a code after paying (Sham Cash): the seller approves it with one tap in the
-- panel, the server makes the code, and the student's app picks it up and activates itself.
CREATE TABLE IF NOT EXISTS requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  book       TEXT NOT NULL,
  device     TEXT NOT NULL,             -- the phone that asked; only it can collect the code
  name       TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',  -- WhatsApp number
  pay_ref    TEXT NOT NULL DEFAULT '',  -- Sham Cash operation number, if given
  invite     TEXT,                      -- invite code of the friend who brought them
  price      TEXT NOT NULL DEFAULT '',  -- what the app showed them to pay
  created_at INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',   -- pending, approved, rejected
  decided_at INTEGER,
  code       TEXT,                      -- the code made on approval
  ip         TEXT
);
CREATE INDEX IF NOT EXISTS requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS requests_device ON requests(device);
CREATE INDEX IF NOT EXISTS requests_invite ON requests(invite);

-- Every subscriber's invite code (6 characters), tied to their activation code.
CREATE TABLE IF NOT EXISTS invites (
  invite     TEXT PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- Free codes earned by inviting friends.
CREATE TABLE IF NOT EXISTS gifts (
  code       TEXT PRIMARY KEY,
  invite     TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gifts_invite ON gifts(invite);

-- Seller settings (the invite discount and how many friends earn a free code).
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

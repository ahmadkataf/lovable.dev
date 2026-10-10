-- Activation codes. A code binds to up to max_devices devices; the seller can revoke it, extend it or
-- release a device from it at any time from the codes page.
CREATE TABLE IF NOT EXISTS codes (
  code        TEXT PRIMARY KEY,           -- 12 characters, shown as XXXX-XXXX-XXXX
  plan        TEXT NOT NULL DEFAULT 'full',
  created_at  INTEGER NOT NULL,           -- ms since 1970
  expires_at  INTEGER,                    -- ms; NULL = lifetime
  max_devices INTEGER NOT NULL DEFAULT 1,
  note        TEXT NOT NULL DEFAULT '',   -- customer name, shop, payment… anything
  seller      TEXT NOT NULL DEFAULT '',
  revoked     INTEGER NOT NULL DEFAULT 0,
  moves       INTEGER NOT NULL DEFAULT 0, -- times the customer moved it to another device by himself
  cloud_until INTEGER                     -- ms; the cloud backup subscription (yearly) runs until then; NULL = none
);
CREATE INDEX IF NOT EXISTS codes_created ON codes(created_at);

-- Every device that ever talked to us: licensed (code set) or on a trial. One row per device hash.
CREATE TABLE IF NOT EXISTS devices (
  device        TEXT PRIMARY KEY,         -- hex SHA-256 of kaseb:<platform>:<deviceId>
  device_code   TEXT NOT NULL DEFAULT '', -- the short code the customer reads to the seller (XXXX-XXXX)
  name          TEXT NOT NULL DEFAULT '',
  platform      TEXT NOT NULL DEFAULT '', -- electron, android, web
  version       TEXT NOT NULL DEFAULT '',
  build         TEXT NOT NULL DEFAULT '',
  sig           TEXT NOT NULL DEFAULT '', -- the app signature it reported
  code          TEXT,                     -- the code bound to this device, NULL = none
  bound_at      INTEGER,
  trial_started INTEGER,                  -- NULL = never had a trial (one trial per device, ever)
  trial_ends    INTEGER,
  first_seen    INTEGER NOT NULL,
  last_seen     INTEGER NOT NULL,
  ip            TEXT,
  blocked       INTEGER NOT NULL DEFAULT 0 -- 1 = the seller blocked this device: activate/check/trial answer 'blocked'
);
-- Databases made before `blocked` existed get the column from the deploy workflow (ALTER TABLE … || true) and, as a
-- fallback, from the worker itself at startup (src/index.ts ensureSchema): SQLite has no ADD COLUMN IF NOT EXISTS.
CREATE INDEX IF NOT EXISTS devices_code ON devices(code);
CREATE INDEX IF NOT EXISTS devices_last_seen ON devices(last_seen);
CREATE INDEX IF NOT EXISTS devices_device_code ON devices(device_code);

-- What happened, for support, the dashboard and rate limiting.
CREATE TABLE IF NOT EXISTS events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     INTEGER NOT NULL,
  kind   TEXT NOT NULL,                   -- activate, activate-fail, trial, trial-fail, check, check-fail, release, admin
  code   TEXT,
  device TEXT,
  ip     TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS events_ip_at ON events(ip, at);
CREATE INDEX IF NOT EXISTS events_code ON events(code);
CREATE INDEX IF NOT EXISTS events_device ON events(device);
CREATE INDEX IF NOT EXISTS events_kind_at ON events(kind, at);   -- dashboard: binds / trials / failures per period without scanning the table

-- Seller settings shown on the activation screen and used by the checks:
-- price, whatsapp, trial_days, grace_days, min_version, android_signature, message.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Cloud backups (the yearly plan): one row per snapshot; the compressed file is in KV under key b:<code>:<id>.
CREATE TABLE IF NOT EXISTS backups (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  device     TEXT NOT NULL,
  at         INTEGER NOT NULL,
  size       INTEGER NOT NULL,           -- compressed bytes
  meta       TEXT NOT NULL DEFAULT '{}'  -- { counts, appVersion, exportedAt, name }
);
CREATE INDEX IF NOT EXISTS backups_code_at ON backups(code, at);

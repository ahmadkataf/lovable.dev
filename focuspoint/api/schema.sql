-- Focus Point booking system — D1 (SQLite) schema. Times are ISO-8601 UTC text.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,            -- normalised: digits only, Syrian local form 09XXXXXXXX
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','staff','admin')),
  pass_hash TEXT NOT NULL,               -- pbkdf2$<iterations>$<salt b64>$<hash b64>
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('private','meeting','desk','hall')),
  capacity INTEGER NOT NULL DEFAULT 1,
  contents TEXT NOT NULL DEFAULT '{"chairs":1,"tables":1}',   -- JSON RoomContents
  price_hour INTEGER NOT NULL DEFAULT 0,
  price_day INTEGER,
  color TEXT,
  plan TEXT,                             -- JSON PlanRect or NULL
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  description TEXT
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_payment','awaiting_verification','confirmed','rejected','expired','cancelled','completed')),
  price INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'shamcash' CHECK (method IN ('shamcash','cash','free')),
  payment_ref TEXT,
  paid_at TEXT,
  verified_by INTEGER REFERENCES users(id),
  note TEXT,
  reject_reason TEXT,
  people INTEGER,
  hold_until TEXT,
  reminded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS bookings_room_time ON bookings(room_id, start, end);
CREATE INDEX IF NOT EXISTS bookings_user ON bookings(user_id, created_at);
CREATE INDEX IF NOT EXISTS bookings_status ON bookings(status, hold_until);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  booking_id INTEGER REFERENCES bookings(id),
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, read, created_at);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  failures INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (                -- single row, id = 1
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL                                 -- JSON Settings (without vapid_public_key, which comes from the env)
);
CREATE TABLE IF NOT EXISTS payment_events (          -- raw inbound events (webhook) for audit
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  ref TEXT,
  amount INTEGER,
  payload TEXT NOT NULL,
  matched_booking INTEGER REFERENCES bookings(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS login_attempts (          -- rate limiting
  key TEXT PRIMARY KEY,                              -- "phone:<phone>" or "ip:<ip>"
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

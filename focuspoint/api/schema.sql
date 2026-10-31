-- Focus Point booking system — D1 (SQLite) schema. Times are ISO-8601 UTC text.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,            -- normalised: digits only, Syrian local form 09XXXXXXXX
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff','admin')),   -- team accounts only; customers are guests
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
  customer_phone TEXT NOT NULL,          -- normalised 09XXXXXXXX
  customer_name TEXT NOT NULL,
  device_id TEXT,                        -- the customer's app/browser (X-Device); NULL for walk-ins
  client_id TEXT UNIQUE,                 -- idempotency key for bookings created from the offline queue
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
CREATE INDEX IF NOT EXISTS bookings_phone ON bookings(customer_phone, created_at);
CREATE INDEX IF NOT EXISTS bookings_device ON bookings(device_id, created_at);
CREATE INDEX IF NOT EXISTS bookings_updated ON bookings(updated_at);
CREATE INDEX IF NOT EXISTS bookings_status ON bookings(status, hold_until);
CREATE INDEX IF NOT EXISTS bookings_status_end ON bookings(status, end);       -- pending verifications still to come, stale ones for the cron
CREATE TABLE IF NOT EXISTS booking_devices (     -- extra customer devices that adopted a booking by code + phone (GET /v1/bookings/lookup)
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  device_id TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (booking_id, device_id)
);
CREATE INDEX IF NOT EXISTS booking_devices_device ON booking_devices(device_id);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),      -- a team account …
  device_id TEXT,                            -- … or a customer device (exactly one is set)
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  booking_id INTEGER REFERENCES bookings(id),
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, read, created_at);
CREATE INDEX IF NOT EXISTS notifications_device ON notifications(device_id, read, created_at);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),      -- team account or
  device_id TEXT,                            -- customer device
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
CREATE TABLE IF NOT EXISTS blocked_customers (phone TEXT PRIMARY KEY, reason TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TABLE IF NOT EXISTS sync_ops (                -- replayed offline operations (idempotency)
  client_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  result TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS login_attempts (          -- rate limiting
  key TEXT PRIMARY KEY,                              -- "phone:<phone>" or "ip:<ip>"
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deleted_rooms (        -- rooms hard-deleted by the admin, so offline team apps can drop them on sync
  id INTEGER PRIMARY KEY,
  deleted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- Site editor (docs/cms/DESIGN.md §2, §6). The admin's overrides of the site content: JSON { [section]: value } holding
-- only the sections they saved; everything else comes from DEFAULT_CONTENT (shared/content.ts) at read time.
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

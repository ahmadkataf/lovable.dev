-- Every record of every shop, as the devices send it. seq grows with every change, so a device asks
-- "everything after the seq I last saw" and gets exactly what changed since.
CREATE TABLE IF NOT EXISTS records (
  shop TEXT NOT NULL,
  col TEXT NOT NULL,
  id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  PRIMARY KEY (shop, col, id)
);
CREATE INDEX IF NOT EXISTS records_shop_seq ON records (shop, seq);
CREATE TABLE IF NOT EXISTS auth_failures (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_failures_ip_at ON auth_failures (ip, at);
-- a request that reserved sequence numbers and is still writing them (deleted when done; stale after 2 minutes)
CREATE TABLE IF NOT EXISTS reservations (
  shop TEXT NOT NULL,
  start INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (shop, start)
);
CREATE TABLE IF NOT EXISTS shops (
  shop TEXT PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

-- Activation codes sold to shops. A code belongs to the devices it was activated on (a computer and a phone).
CREATE TABLE IF NOT EXISTS licenses (
  code        TEXT PRIMARY KEY,          -- 12 characters, shown as XXXX-XXXX-XXXX
  plan        TEXT NOT NULL DEFAULT 'year',
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER,                   -- ms; NULL = never
  note        TEXT NOT NULL DEFAULT '',
  seller      TEXT NOT NULL DEFAULT '',
  shop_name   TEXT NOT NULL DEFAULT '',
  max_devices INTEGER NOT NULL DEFAULT 2,
  revoked     INTEGER NOT NULL DEFAULT 0,
  moves       INTEGER NOT NULL DEFAULT 0,
  last_seen   INTEGER
);
CREATE TABLE IF NOT EXISTS license_devices (
  code      TEXT NOT NULL,
  device    TEXT NOT NULL,
  name      TEXT NOT NULL DEFAULT '',
  bound_at  INTEGER NOT NULL,
  last_seen INTEGER,
  PRIMARY KEY (code, device)
);
CREATE TABLE IF NOT EXISTS license_events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     INTEGER NOT NULL,
  kind   TEXT NOT NULL,                  -- activate, activate-fail, admin
  code   TEXT,
  device TEXT,
  ip     TEXT,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS license_events_ip_at ON license_events (ip, at);
CREATE INDEX IF NOT EXISTS license_events_code ON license_events (code);

-- The shared product catalogue, filled from barcode scans. What each device named a product (one vote per device
-- per number; a later one replaces its own). Only the product's own details: never prices, stock, shop names,
-- addresses or licence codes.
CREATE TABLE IF NOT EXISTS catalog_contrib (
  gtin     TEXT NOT NULL,                -- GTIN-14 key (EAN-8/13 and UPC-A/E padded with zeros)
  device   TEXT NOT NULL,
  name     TEXT NOT NULL,
  brand    TEXT,
  category TEXT,
  unit     TEXT,
  at       INTEGER NOT NULL,
  PRIMARY KEY (gtin, device)
);
CREATE INDEX IF NOT EXISTS catalog_contrib_gtin ON catalog_contrib (gtin);
-- a lookup counts only votes of devices still bound to a live licence
CREATE INDEX IF NOT EXISTS license_devices_device ON license_devices (device);
-- what the outside services (Open Food Facts, UPCitemdb) answered, found or not, so each is asked once
CREATE TABLE IF NOT EXISTS catalog_cache (
  gtin      TEXT PRIMARY KEY,
  found     INTEGER NOT NULL,
  name      TEXT,
  brand     TEXT,
  category  TEXT,
  quantity  TEXT,
  image_url TEXT,
  source    TEXT,                        -- openfoodfacts, upcitemdb
  at        INTEGER NOT NULL
);
-- per UTC day: lookups per device ('d:') and per address ('i:', a keyed hash that changes daily), contributed items
-- per device ('c:'), UPCitemdb asks for the whole server ('upc'), per device ('ud:') and per address ('ui:'), Open
-- Food Facts asks per minute ('o:<minute>'), and until when UPCitemdb is not asked after its 429 ('upc-pause', n = ms)
CREATE TABLE IF NOT EXISTS catalog_quota (
  k   TEXT NOT NULL,
  day INTEGER NOT NULL,
  n   INTEGER NOT NULL,
  PRIMARY KEY (k, day)
);

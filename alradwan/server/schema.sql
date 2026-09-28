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
CREATE TABLE IF NOT EXISTS shops (
  shop TEXT PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

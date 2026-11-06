-- Migration 0003: the centre's price list (shared/pricing.ts). Run ONCE on a database created before 2026-11-06
-- (deploy.mjs runs it automatically when bookings.seats is missing; schema.sql already has the columns).
--   * bookings: currency (SYP/USD), kind (hourly/week/month), seats (open-space seats), tier (training hall group)
--   * amounts move to new Syrian pounds (1 new = 100 old): room prices and recorded booking prices ÷ 100
--   * the open space is priced per seat: 100 per person per hour
--   * the meeting room becomes the training hall (its price comes from the hall price groups in the settings)
--   * the floor plan: room 1 sits next to reception (rooms 1–4 were laid out in reverse)
ALTER TABLE bookings ADD COLUMN currency TEXT NOT NULL DEFAULT 'SYP' CHECK (currency IN ('SYP','USD'));
ALTER TABLE bookings ADD COLUMN kind TEXT NOT NULL DEFAULT 'hourly' CHECK (kind IN ('hourly','week','month'));
ALTER TABLE bookings ADD COLUMN seats INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bookings ADD COLUMN tier TEXT CHECK (tier IN ('org','gov'));
UPDATE bookings SET price = CAST(ROUND(price / 100.0) AS INTEGER);
UPDATE bookings SET seats = MAX(1, MIN(COALESCE(people, 1), (SELECT capacity FROM rooms r WHERE r.id = bookings.room_id)))
  WHERE room_id IN (SELECT id FROM rooms WHERE type = 'desk');
UPDATE rooms SET price_hour = CAST(ROUND(price_hour / 100.0) AS INTEGER), price_day = CAST(ROUND(price_day / 100.0) AS INTEGER);
UPDATE rooms SET price_hour = 100, price_day = NULL WHERE type IN ('desk','private');   -- 100 per person per hour
-- The open space: 5 tables × 4 chairs = 20 seats (each booking takes chairs, not whole tables).
UPDATE rooms SET capacity = 20, contents = json_set(contents, '$.tables', 5, '$.chairs', 20) WHERE type = 'desk' AND name = 'المساحة المفتوحة';
UPDATE bookings SET seats = MAX(1, MIN(COALESCE(people, 1), (SELECT capacity FROM rooms r WHERE r.id = bookings.room_id)))
  WHERE room_id IN (SELECT id FROM rooms WHERE type = 'private');
UPDATE rooms SET price_hour = 1000, price_day = NULL WHERE type IN ('meeting','hall');   -- = the government hour (the hall's customer prices come from the settings)
UPDATE rooms SET name = 'القاعة التدريبية' WHERE type = 'meeting' AND name = 'قاعة الاجتماعات';
CREATE TABLE IF NOT EXISTS _plan_swap AS SELECT id, name, plan FROM rooms WHERE name IN ('غرفة 1','غرفة 2','غرفة 3','غرفة 4');
UPDATE rooms SET plan = (SELECT s.plan FROM _plan_swap s WHERE s.name = 'غرفة ' || (5 - CAST(substr(rooms.name, 6) AS INTEGER)))
  WHERE name IN ('غرفة 1','غرفة 2','غرفة 3','غرفة 4') AND (SELECT COUNT(*) FROM _plan_swap) = 4;
DROP TABLE _plan_swap;
-- When amounts became new pounds: the team's offline queue may still replay ops recorded before (old-pound prices);
-- api/src/routes/sync.ts converts those. Not in schema.sql: a fresh database has no old ops.
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
INSERT OR IGNORE INTO meta (k, v) VALUES ('new_pounds_at', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
-- Team panels pull changes by updated_at: mark recent bookings changed so open panels fetch the new prices.
UPDATE bookings SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE end >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-60 days');

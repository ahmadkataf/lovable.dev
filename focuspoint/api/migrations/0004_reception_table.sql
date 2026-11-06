-- Migration 0004 (2026-11-06): the U-shaped table at reception, 8 seats booked one by one like the open space
-- (100 per person per hour). Idempotent: deploy.mjs runs it on every deploy; it acts once (meta 'reception_table').
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
INSERT INTO rooms (name, type, capacity, contents, price_hour, price_day, color, plan, active, sort, description)
  SELECT 'طاولة الاستقبال', 'desk', 8, '{"chairs":8,"tables":1,"ac":true,"wifi":true}', 100, NULL, '#0d9488',
    '{"x":1190,"y":40,"w":190,"h":260}', 1, 7, 'طاولة على شكل U بالاستقبال، 8 مقاعد'
  WHERE NOT EXISTS (SELECT 1 FROM meta WHERE k = 'reception_table')
    AND NOT EXISTS (SELECT 1 FROM rooms WHERE name = 'طاولة الاستقبال');
-- A saved floor plan that is still the original default gets the wider layout (room for the table).
UPDATE settings SET data = json_set(data, '$.plan.width', 1400, '$.plan.walls[0].w', 1400)
  WHERE id = 1 AND NOT EXISTS (SELECT 1 FROM meta WHERE k = 'reception_table')
    AND json_extract(data, '$.plan.width') = 1200 AND json_extract(data, '$.plan.walls[0].w') = 1200;
INSERT OR IGNORE INTO meta (k, v) VALUES ('reception_table', strftime('%Y-%m-%dT%H:%M:%fZ','now'));

-- Migration 0001: bookings adopted by several devices (GET /v1/bookings/lookup) + an index for pending/stale verifications.
-- Only needed for a database created from schema.sql before 2026-10-25; schema.sql itself already contains both.
CREATE TABLE IF NOT EXISTS booking_devices (
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  device_id TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (booking_id, device_id)
);
CREATE INDEX IF NOT EXISTS booking_devices_device ON booking_devices(device_id);
CREATE INDEX IF NOT EXISTS bookings_status_end ON bookings(status, end);

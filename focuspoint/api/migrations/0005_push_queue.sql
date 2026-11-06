-- Migration 0005 (2026-11-06): queue for customer announcement pushes. A Worker on the free plan may make only ~50
-- outbound requests per invocation, so announce() pushes the first batch at once and the */5 cron sends the rest.
-- Idempotent; schema.sql carries the same statement (deploy.mjs applies it on every deploy).
CREATE TABLE IF NOT EXISTS push_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

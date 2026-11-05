// Fixed-window rate limiting stored in the Durable Object's SQLite, so the limit holds across isolates and restarts
// (the in-memory RateLimiter in auth.ts stays as a cheap first line). Pure functions over a tiny `exec` interface so the
// same code runs against `ctx.storage.sql` in the Worker and against node:sqlite in vitest.

/** The subset of SqlStorage the limiter needs (`ctx.storage.sql.exec(sql, ...params).toArray()`). */
export interface SqlLike { exec(sql: string, ...params: unknown[]): { toArray(): Record<string, unknown>[] } }

export interface Window { limit: number; windowMs: number }
export const LOGIN_WINDOW: Window = { limit: 20, windowMs: 10 * 60 * 1000 }   // 20 login attempts per 10 minutes per IP
export const ADMIN_WINDOW: Window = { limit: 10, windowMs: 60 * 1000 }        // 10 admin calls per minute per IP

export interface Verdict { allowed: boolean; remaining: number }

/** One row per key («login:<ip>», «admin:<ip>»): the start of the current window and the attempts made in it. */
export function ensureAttemptsTable(sql: SqlLike): void {
  sql.exec('CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL)').toArray()
}

/** Records one attempt for `key` and says whether it is still within the window's limit. */
export function recordAttempt(sql: SqlLike, key: string, win: Window, now = Date.now()): Verdict {
  // Expired windows are dropped as we go, so the table never grows beyond the active keys.
  sql.exec('DELETE FROM login_attempts WHERE window_start < ?', now - win.windowMs).toArray()
  const row = sql.exec('SELECT window_start, count FROM login_attempts WHERE ip = ?', key).toArray()[0] as { window_start: number; count: number } | undefined
  let count = 1
  if (!row || now - Number(row.window_start) >= win.windowMs) {
    sql.exec('INSERT OR REPLACE INTO login_attempts (ip, window_start, count) VALUES (?, ?, 1)', key, now).toArray()
  } else {
    count = Number(row.count) + 1
    sql.exec('UPDATE login_attempts SET count = ? WHERE ip = ?', count, key).toArray()
  }
  return { allowed: count <= win.limit, remaining: Math.max(0, win.limit - count) }
}

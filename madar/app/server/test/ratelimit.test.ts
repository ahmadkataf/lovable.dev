// The durable rate limiter, run against node:sqlite exactly as the Durable Object runs it against ctx.storage.sql.
import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { ADMIN_WINDOW, LOGIN_WINDOW, clearAttempts, ensureAttemptsTable, recordAttempt, type SqlLike } from '../src/ratelimit'

function sqlLike(): SqlLike & { db: DatabaseSync } {
  const db = new DatabaseSync(':memory:')
  return { db, exec: (sql, ...p) => ({ toArray: () => db.prepare(sql).all(...(p as never[])) as Record<string, unknown>[] }) }
}

describe('durable login limiter', () => {
  it('creates its table lazily and allows 20 attempts per 10 minutes per key', () => {
    const sql = sqlLike()
    ensureAttemptsTable(sql)
    ensureAttemptsTable(sql)   // idempotent
    const t0 = 1_700_000_000_000
    for (let i = 0; i < 20; i++) {
      const v = recordAttempt(sql, 'login:1.2.3.4', LOGIN_WINDOW, t0 + i * 1000)
      expect(v.allowed).toBe(true)
      expect(v.remaining).toBe(19 - i)
    }
    expect(recordAttempt(sql, 'login:1.2.3.4', LOGIN_WINDOW, t0 + 21_000)).toEqual({ allowed: false, remaining: 0 })
    expect(recordAttempt(sql, 'login:1.2.3.4', LOGIN_WINDOW, t0 + 22_000)).toEqual({ allowed: false, remaining: 0 })
    // another address and another prefix are unaffected
    expect(recordAttempt(sql, 'login:5.6.7.8', LOGIN_WINDOW, t0 + 21_000).allowed).toBe(true)
    expect(recordAttempt(sql, 'admin:1.2.3.4', ADMIN_WINDOW, t0 + 21_000)).toEqual({ allowed: true, remaining: 9 })
  })

  it('opens a fresh window after ten minutes and prunes expired rows', () => {
    const sql = sqlLike()
    ensureAttemptsTable(sql)
    const t0 = 1_700_000_000_000
    for (let i = 0; i < 25; i++) recordAttempt(sql, 'login:1.2.3.4', LOGIN_WINDOW, t0 + i)
    expect(recordAttempt(sql, 'login:1.2.3.4', LOGIN_WINDOW, t0 + 100).allowed).toBe(false)
    const later = t0 + LOGIN_WINDOW.windowMs + 1
    expect(recordAttempt(sql, 'login:1.2.3.4', LOGIN_WINDOW, later)).toEqual({ allowed: true, remaining: 19 })
    const rows = sql.db.prepare('SELECT ip, count FROM login_attempts').all() as { ip: string; count: number }[]
    expect(rows).toEqual([{ ip: 'login:1.2.3.4', count: 1 }])   // the old window's row was replaced, nothing else lingers
  })

  it('admin calls are limited to ten per minute', () => {
    const sql = sqlLike()
    ensureAttemptsTable(sql)
    const t0 = 1_700_000_000_000
    for (let i = 0; i < 10; i++) expect(recordAttempt(sql, 'admin:x', ADMIN_WINDOW, t0 + i).allowed).toBe(true)
    expect(recordAttempt(sql, 'admin:x', ADMIN_WINDOW, t0 + 11).allowed).toBe(false)
    expect(recordAttempt(sql, 'admin:x', ADMIN_WINDOW, t0 + 60_001).allowed).toBe(true)
  })

  it('clearAttempts forgets one key only', () => {
    const sql = sqlLike(); ensureAttemptsTable(sql)
    const t0 = 1_700_000_000_000
    for (let i = 0; i < 20; i++) recordAttempt(sql, 'login:a', LOGIN_WINDOW, t0 + i)
    recordAttempt(sql, 'login:b', LOGIN_WINDOW, t0)
    expect(recordAttempt(sql, 'login:a', LOGIN_WINDOW, t0 + 30).allowed).toBe(false)
    clearAttempts(sql, 'login:a')
    expect(recordAttempt(sql, 'login:a', LOGIN_WINDOW, t0 + 40)).toEqual({ allowed: true, remaining: 19 })
    expect(recordAttempt(sql, 'login:b', LOGIN_WINDOW, t0 + 40)).toEqual({ allowed: true, remaining: 18 })
  })
})

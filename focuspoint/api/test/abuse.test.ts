// Launch-review fixes against a real SQLite database (node:sqlite behind a tiny D1 shim, schema.sql + seed.sql):
// booking limits per phone OR device, idempotent customer bookings (client_id), the customer view of a booking,
// the team alert when a customer cancels after paying, login lock-out per phone+IP, the per-IP limit, push batching.
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import { assertLoginAllowed, hitLimit, recordLoginFailure } from '../src/auth'
import { toCustomerBooking } from '../src/db'
import type { Env } from '../src/env'
import { HttpError } from '../src/http'
import { announce } from '../src/notify'
import { PUSH_BATCH, drainPushQueue } from '../src/push'
import { isPushServiceUrl } from '../src/routes/public'
import { cancelBooking, createCustomerBooking, submitPayment, type Deps } from '../src/service'
import SCHEMA from '../schema.sql?raw'
import SEED from '../seed.sql?raw'

/** Just enough of D1 for the code under test: prepare/bind/first/all/run and a sequential batch. */
function d1(db: DatabaseSync): D1Database {
  const plain = (r: unknown) => (r ? { ...(r as object) } : null)
  const stmt = (sql: string, params: unknown[] = []): D1PreparedStatement => {
    const p = () => db.prepare(sql)
    const args = params as (string | number | null)[]
    return {
      bind: (...ps: unknown[]) => stmt(sql, ps),
      first: async () => plain(p().get(...args)),
      all: async () => ({ results: p().all(...args).map(plain), success: true, meta: {} }),
      run: async () => {
        if (/\bRETURNING\b/i.test(sql)) { p().all(...args); return { results: [], success: true, meta: { changes: 1, last_row_id: 0 } } }
        const r = p().run(...args)
        return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
      },
    } as unknown as D1PreparedStatement
  }
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: D1PreparedStatement[]) => { const out = []; for (const s of list) out.push(await s.run()); return out },
  } as unknown as D1Database
}

let sqlite: DatabaseSync
let env: Env
let pending: Promise<unknown>[]
const now = new Date('2026-11-07T05:00:00.000Z')                  // Saturday 08:00 in Daraa (UTC+3)
const deps = (): Deps => ({ env, exec: { waitUntil: (p: Promise<unknown>) => { pending.push(p) } } as unknown as ExecutionContext, now })
const at = (h: number) => `2026-11-07T${String(h - 3).padStart(2, '0')}:00:00.000Z`   // local hour → UTC ISO
const DEVICE = '11111111-2222-4333-8444-555555555555'
const err = async (p: Promise<unknown>) => { try { await p; return null } catch (e) { return e instanceof HttpError ? `${e.status} ${e.code}` : String(e) } }
const count = (sql: string, ...a: (string | number)[]) => Number((sqlite.prepare(sql).get(...a) as { n: number }).n)

let deskId: number, privateIds: number[]
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(SCHEMA)
  sqlite.exec(SEED)
  sqlite.prepare(`INSERT INTO users (phone, name, role, pass_hash) VALUES ('0999000000', 'Staff', 'staff', 'x')`).run()
  env = { DB: d1(sqlite), PUBLIC_URL: 'https://example.test' } as unknown as Env
  pending = []
  deskId = (sqlite.prepare(`SELECT id FROM rooms WHERE type = 'desk' ORDER BY capacity DESC LIMIT 1`).get() as { id: number }).id
  privateIds = (sqlite.prepare(`SELECT id FROM rooms WHERE type = 'private' ORDER BY id`).all() as { id: number }[]).map((r) => r.id)
})

const book = (over: Record<string, unknown> = {}, device = DEVICE) => createCustomerBooking(deps(), device, {
  name: 'أحمد', phone: '0933000001', room_id: deskId, start: at(10), end: at(12), ...over,
})

describe('customer booking limits (phone OR device)', () => {
  it('counts live holds per device even when the phone number changes', async () => {
    for (let i = 1; i <= 3; i++) await book({ phone: `093300000${i}` })
    expect(await err(book({ phone: '0933000009' }))).toBe('429 too_many_pending')
    // another device and phone is not affected
    expect(await err(book({ phone: '0944000001' }, 'aaaaaaaa-2222-4333-8444-555555555555'))).toBeNull()
  })
  it('a made-up reference does not escape the limit: future bookings waiting for the team count too (looser cap)', async () => {
    for (let i = 1; i <= 6; i++) {
      const b = await book({ phone: `09330000${10 + i}` })
      await submitPayment(deps(), b, `REF-${i}-xyz`)
    }
    expect(count(`SELECT COUNT(*) AS n FROM bookings WHERE status = 'awaiting_verification'`)).toBe(6)
    expect(await err(book({ phone: '0933000099' }))).toBe('429 too_many_pending')
  })
  it('only one unpaid subscription at a time', async () => {
    await book({ kind: 'week', date: '2026-11-08', start: undefined, end: undefined })
    expect(await err(book({ kind: 'month', date: '2026-11-09', start: undefined, end: undefined }))).toBe('429 too_many_pending')
    expect(await err(book())).toBeNull()        // an hourly booking is still fine
  })
})

describe('idempotent customer booking (client_id)', () => {
  it('a retry of the same form returns the first booking instead of a second seat or «slot taken»', async () => {
    const first = await book({ client_id: 'form-1' })
    const again = await book({ client_id: 'form-1' })
    expect(again.id).toBe(first.id)
    expect(count('SELECT COUNT(*) AS n FROM bookings')).toBe(1)
    // a private room: the retry must not answer slot_taken against itself
    const room = await book({ room_id: privateIds[0], client_id: 'form-2' })
    expect((await book({ room_id: privateIds[0], client_id: 'form-2' })).id).toBe(room.id)
    // the team is told once per booking
    expect(count(`SELECT COUNT(*) AS n FROM notifications WHERE kind = 'booking_created'`)).toBe(2)
  })
  it('the same client_id from another device is a different form', async () => {
    const a = await book({ client_id: 'same' })
    const b = await book({ client_id: 'same', phone: '0944000001' }, 'bbbbbbbb-2222-4333-8444-555555555555')
    expect(b.id).not.toBe(a.id)
  })
})

describe('customer view of a booking', () => {
  it('leaves out the device id, the staff id and the internal note', async () => {
    const b = await book({ note: 'قرب الشباك' })
    const out = toCustomerBooking(b) as Record<string, unknown>
    expect(out).not.toHaveProperty('device_id')
    expect(out).not.toHaveProperty('verified_by')
    expect(out).not.toHaveProperty('note')
    expect(out).not.toHaveProperty('client_id')
    expect(out).toMatchObject({ id: b.id, code: b.code, status: 'pending_payment' })
  })
})

describe('customer cancels after sending a payment', () => {
  it('alerts the team with the reference', async () => {
    const b = await submitPayment(deps(), await book(), 'SC-778899')
    const before = count(`SELECT COUNT(*) AS n FROM notifications WHERE user_id IS NOT NULL`)
    await cancelBooking(deps(), b, 'customer')
    const rows = sqlite.prepare(`SELECT title, body FROM notifications WHERE user_id IS NOT NULL ORDER BY id DESC LIMIT 1`).all() as { title: string; body: string }[]
    expect(count(`SELECT COUNT(*) AS n FROM notifications WHERE user_id IS NOT NULL`)).toBe(before + 1)
    expect(rows[0]?.title).toBe('زبون ألغى بعد الدفع')
    expect(rows[0]?.body).toContain('SC-778899')
    expect(rows[0]?.body).toContain(b.code)
  })
  it('no team alert for an unpaid hold', async () => {
    const b = await book()
    const before = count(`SELECT COUNT(*) AS n FROM notifications WHERE user_id IS NOT NULL`)
    await cancelBooking(deps(), b, 'customer')
    expect(count(`SELECT COUNT(*) AS n FROM notifications WHERE user_id IS NOT NULL`)).toBe(before)
  })
})

describe('rate limits', () => {
  it('failed logins lock a phone on that IP only; the IP cap still applies', async () => {
    for (let i = 0; i < 5; i++) await recordLoginFailure(env.DB, '0999000000', '1.1.1.1', now)
    expect(await err(assertLoginAllowed(env.DB, '0999000000', '1.1.1.1', now))).toBe('429 too_many_attempts')
    expect(await err(assertLoginAllowed(env.DB, '0999000000', '2.2.2.2', now))).toBeNull()
    for (let i = 0; i < 15; i++) await recordLoginFailure(env.DB, `09990000${10 + i}`, '1.1.1.1', now)
    expect(await err(assertLoginAllowed(env.DB, '0999111111', '1.1.1.1', now))).toBe('429 too_many_attempts')
  })
  it('hitLimit allows max hits per window, then 429, and restarts after the window', async () => {
    for (let i = 0; i < 20; i++) expect(await err(hitLimit(env.DB, 'book:ip:9.9.9.9', 20, 3600_000, now))).toBeNull()
    expect(await err(hitLimit(env.DB, 'book:ip:9.9.9.9', 20, 3600_000, now))).toBe('429 too_many_requests')
    expect(await err(hitLimit(env.DB, 'book:ip:9.9.9.9', 20, 3600_000, new Date(now.getTime() + 3600_001)))).toBeNull()
  })
})

describe('push subscriptions and announcement batches', () => {
  it('accepts only browser push services', () => {
    expect(isPushServiceUrl('https://fcm.googleapis.com/fcm/send/abc')).toBe(true)
    expect(isPushServiceUrl('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true)
    expect(isPushServiceUrl('https://web.push.apple.com/QAbc')).toBe(true)
    expect(isPushServiceUrl('https://wns2-db5p.notify.windows.com/w/?token=abc')).toBe(true)
    expect(isPushServiceUrl('https://evil.example.com/fcm.googleapis.com')).toBe(false)
    expect(isPushServiceUrl('https://fcm.googleapis.com.evil.com/x')).toBe(false)
    expect(isPushServiceUrl('not a url')).toBe(false)
  })
  it('announce pushes the first batch now and queues the rest; the cron drains the queue', async () => {
    const insert = sqlite.prepare(`INSERT INTO push_subscriptions (device_id, endpoint, p256dh, auth) VALUES (?, ?, 'p256dh-key-xxxxxxxxxxxx', 'auth-key-xx')`)
    const total = PUSH_BATCH + 7
    for (let i = 0; i < total; i++) insert.run(`dev-${i}`, `https://fcm.googleapis.com/fcm/send/${i}`)
    const devices = await announce(env, deps().exec, 'customers', 'عنوان', 'نص')
    expect(devices).toBe(total)
    expect(count(`SELECT COUNT(*) AS n FROM notifications WHERE kind = 'announcement'`)).toBe(total)
    expect(count('SELECT COUNT(*) AS n FROM push_queue')).toBe(7)
    sqlite.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(`https://fcm.googleapis.com/fcm/send/${total - 1}`)   // gone meanwhile
    expect(await drainPushQueue(env, now)).toBe(6)
    expect(count('SELECT COUNT(*) AS n FROM push_queue')).toBe(0)
    expect(await drainPushQueue(env, now)).toBe(0)
  })
})

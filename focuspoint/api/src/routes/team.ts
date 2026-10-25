// Team routes (staff + admin): login, bookings management, walk-ins, dashboard, customers.
import type { Booking, BookingStatus, Customer } from '../../../shared/types'
import { assertLoginAllowed, clearLoginFailures, hashPassword, recordLoginFailure, signToken, validatePassword, verifyPassword } from '../auth'
import { BOOKING_SELECT, toBooking, toUser, type BookingRow, type UserRow } from '../db'
import { HttpError, json, readJson } from '../http'
import { idParam, requireUser, route, type Ctx, type Route } from '../router'
import { cancelBooking, confirmBooking, createManualBooking, editBooking, rejectBooking } from '../service'
import { loadStoredSettings } from '../settings'
import { addDays, isDateString, localDayRange, localParts, localToUtc } from '../tz'
import { normalisePhone, requirePhone, requireString } from '../validate'

const deps = (c: Ctx) => ({ env: c.env, exec: c.exec, now: c.now })
const STATUSES: readonly BookingStatus[] = ['pending_payment', 'awaiting_verification', 'confirmed', 'rejected', 'expired', 'cancelled', 'completed']
const DEAD = `('expired','rejected','cancelled')`

/** "YYYY-MM-DD" (local day, inclusive) or an ISO instant → UTC ISO bound. */
function bound(v: string, tz: string, edge: 'from' | 'to'): string {
  if (isDateString(v)) {
    const r = localDayRange(v, tz)
    return (edge === 'from' ? r.from : r.to).toISOString()
  }
  const t = Date.parse(v)
  if (Number.isNaN(t)) throw new HttpError(400, 'invalid_date')
  return new Date(t).toISOString()
}

async function listBookings(c: Ctx): Promise<Booking[]> {
  const q = c.url.searchParams
  const { timezone } = await loadStoredSettings(c.env.DB)
  const where: string[] = [], args: (string | number)[] = []
  const from = q.get('from'), to = q.get('to')
  if (from) { where.push('b.end > ?'); args.push(bound(from, timezone, 'from')) }
  if (to) { where.push('b.start < ?'); args.push(bound(to, timezone, 'to')) }
  if (!from && !to) { where.push('b.end > ?'); args.push(localDayRange(localParts(c.now, timezone).date, timezone).from.toISOString()) }
  const status = q.get('status')
  if (status) {
    const list = status.split(',').filter((s): s is BookingStatus => (STATUSES as readonly string[]).includes(s))
    if (list.length === 0) throw new HttpError(400, 'invalid_status')
    where.push(`b.status IN (${list.map(() => '?').join(',')})`); args.push(...list)
  }
  const roomId = q.get('room_id')
  if (roomId) { where.push('b.room_id = ?'); args.push(Number(roomId) || 0) }
  const text = q.get('q')?.trim()
  if (text) {
    const phone = normalisePhone(text)
    where.push('(b.customer_name LIKE ? OR b.customer_phone LIKE ? OR b.code = ? OR b.payment_ref = ?)')
    args.push(`%${text}%`, `%${phone ?? text}%`, text.toUpperCase(), text)
  }
  const rows = (await c.env.DB.prepare(`${BOOKING_SELECT} WHERE ${where.join(' AND ')} ORDER BY b.start LIMIT 500`).bind(...args).all<BookingRow>()).results
  return rows.map(toBooking)
}

const CUSTOMERS_SQL = `
  SELECT phone, name, bookings, last_booking, blocked FROM (
    SELECT b.customer_phone AS phone, b.customer_name AS name, COUNT(*) AS bookings, MAX(b.start) AS last_booking,
           CASE WHEN bc.phone IS NULL THEN 0 ELSE 1 END AS blocked
    FROM bookings b LEFT JOIN blocked_customers bc ON bc.phone = b.customer_phone
    GROUP BY b.customer_phone
    UNION ALL
    SELECT bc.phone, '' AS name, 0 AS bookings, NULL AS last_booking, 1 AS blocked
    FROM blocked_customers bc WHERE NOT EXISTS (SELECT 1 FROM bookings x WHERE x.customer_phone = bc.phone)
  )`

async function customer(db: D1Database, phone: string): Promise<Customer> {
  const row = await db.prepare(`${CUSTOMERS_SQL} WHERE phone = ?`).bind(phone).first<Customer>()
  return row ?? { phone, name: '', bookings: 0, last_booking: null, blocked: 0 }
}

export const teamRoutes: Route[] = [
  route('POST', '/v1/team/login', 'public', async (c) => {
    const body = await readJson(c.req)
    const phone = requirePhone(body.phone)
    const password = requireString(body.password, 'invalid_credentials', 1, 128)
    const ip = c.req.headers.get('CF-Connecting-IP') ?? 'unknown'
    await assertLoginAllowed(c.env.DB, phone, ip, c.now)
    const row = await c.env.DB.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first<UserRow>()
    if (!row || !(await verifyPassword(password, row.pass_hash))) {
      await recordLoginFailure(c.env.DB, phone, ip, c.now)
      throw new HttpError(401, 'invalid_credentials')
    }
    if (row.disabled) throw new HttpError(401, 'account_disabled')
    await clearLoginFailures(c.env.DB, phone)
    const user = toUser(row)
    return json({ token: await signToken(c.env, user, c.now), user })
  }),

  route('GET', '/v1/team/me', 'team', (c) => json(requireUser(c))),

  route('PATCH', '/v1/team/me', 'team', async (c) => {
    const user = requireUser(c)
    const body = await readJson(c.req)
    const name = body.name !== undefined ? requireString(body.name, 'invalid_name', 2, 40) : user.name
    const hash = body.password !== undefined ? await hashPassword(validatePassword(body.password)) : null
    await c.env.DB.prepare(`UPDATE users SET name = ?, pass_hash = COALESCE(?, pass_hash) WHERE id = ?`).bind(name, hash, user.id).run()
    return json(toUser((await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<UserRow>())!))
  }),

  route('GET', '/v1/team/bookings', 'team', async (c) => json(await listBookings(c))),

  route('POST', '/v1/team/bookings/manual', 'team', async (c) =>
    json(await createManualBooking(deps(c), requireUser(c), await readJson(c.req)), 201)),

  route('POST', '/v1/team/bookings/:id/confirm', 'team', async (c) => json(await confirmBooking(deps(c), idParam(c), requireUser(c).id))),

  route('POST', '/v1/team/bookings/:id/reject', 'team', async (c) => {
    const body = await readJson(c.req)
    return json(await rejectBooking(deps(c), idParam(c), body.reason))
  }),

  // Convenience alias of POST /v1/bookings/:id/cancel for the team app (same logic).
  route('POST', '/v1/team/bookings/:id/cancel', 'team', async (c) => {
    const b = await c.env.DB.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).bind(idParam(c)).first<BookingRow>()
    if (!b) throw new HttpError(404, 'booking_not_found')
    return json(await cancelBooking(deps(c), toBooking(b), 'team'))
  }),

  route('PATCH', '/v1/team/bookings/:id', 'team', async (c) => json(await editBooking(deps(c), idParam(c), await readJson(c.req)))),

  route('GET', '/v1/team/dashboard', 'team', async (c) => {
    const { timezone } = await loadStoredSettings(c.env.DB)
    const date = c.url.searchParams.get('date') || localParts(c.now, timezone).date
    if (!isDateString(date)) throw new HttpError(400, 'invalid_date')
    const day = localDayRange(date, timezone)
    const weekEnd = localToUtc(addDays(date, 7), '00:00', timezone)
    const monthStart = localToUtc(`${date.slice(0, 7)}-01`, '00:00', timezone)
    const [y, m] = date.split('-').map(Number) as [number, number]
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    const monthEnd = localToUtc(nextMonth, '00:00', timezone)
    const db = c.env.DB
    const [today, pending, week, revenue] = await Promise.all([
      db.prepare(`${BOOKING_SELECT} WHERE b.start < ? AND b.end > ? AND b.status NOT IN ${DEAD} ORDER BY b.start`).bind(day.to.toISOString(), day.from.toISOString()).all<BookingRow>(),
      db.prepare(`${BOOKING_SELECT} WHERE b.status = 'awaiting_verification' ORDER BY b.paid_at, b.id`).all<BookingRow>(),
      db.prepare(`SELECT COUNT(*) AS n FROM bookings b WHERE b.start >= ? AND b.start < ? AND b.status NOT IN ${DEAD}`).bind(day.from.toISOString(), weekEnd.toISOString()).first<{ n: number }>(),
      db.prepare(`SELECT COALESCE(SUM(price), 0) AS total FROM bookings WHERE start >= ? AND start < ? AND status IN ('confirmed','completed')`).bind(monthStart.toISOString(), monthEnd.toISOString()).first<{ total: number }>(),
    ])
    return json({
      today: today.results.map(toBooking), pending: pending.results.map(toBooking),
      counts: { today: today.results.length, week: week?.n ?? 0, pending: pending.results.length },
      revenue_month: revenue?.total ?? 0,
    })
  }),

  route('GET', '/v1/team/customers', 'team', async (c) => {
    const q = c.url.searchParams.get('q')?.trim() ?? ''
    const phone = normalisePhone(q)
    const rows = (await c.env.DB.prepare(`${CUSTOMERS_SQL} WHERE (? = '' OR phone LIKE ? OR name LIKE ?) ORDER BY last_booking DESC LIMIT 200`)
      .bind(q, `%${phone ?? q}%`, `%${q}%`).all<Customer>()).results
    return json(rows)
  }),

  route('POST', '/v1/team/customers/:phone/block', 'team', async (c) => {
    const phone = requirePhone(c.params.phone)
    const body = await readJson(c.req)
    if (body.blocked !== 0 && body.blocked !== 1) throw new HttpError(400, 'invalid_blocked')
    if (body.blocked === 1) {
      await c.env.DB.prepare('INSERT INTO blocked_customers (phone, reason) VALUES (?, ?) ON CONFLICT(phone) DO NOTHING').bind(phone, `by user ${requireUser(c).id}`).run()
    } else {
      await c.env.DB.prepare('DELETE FROM blocked_customers WHERE phone = ?').bind(phone).run()
    }
    return json(await customer(c.env.DB, phone))
  }),
]

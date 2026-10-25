// Admin routes: rooms, settings, team accounts, announcements, reports, and the one-time bootstrap.
import type { Role } from '../../../shared/types'
import { hashPassword, signToken, validatePassword } from '../auth'
import { BOOKING_SELECT, toUser, toBooking, type BookingRow, type UserRow } from '../db'
import { HttpError, json, readJson, safeEqual } from '../http'
import { announce } from '../notify'
import { idParam, requireUser, route, type Route } from '../router'
import { createRoom, deleteRoom, patchRoom } from '../service'
import { loadSettings, loadStoredSettings, saveSettings, validateSettingsPatch } from '../settings'
import { isDateString, localDayRange, localParts } from '../tz'
import { oneOf, requirePhone, requireString } from '../validate'

const ROLES: readonly Role[] = ['staff', 'admin']

export const adminRoutes: Route[] = [
  route('POST', '/v1/admin/rooms', 'admin', async (c) => json(await createRoom(c.env.DB, await readJson(c.req)), 201)),
  route('PATCH', '/v1/admin/rooms/:id', 'admin', async (c) => json(await patchRoom(c.env.DB, idParam(c), await readJson(c.req)))),
  route('DELETE', '/v1/admin/rooms/:id', 'admin', async (c) => {
    const outcome = await deleteRoom(c.env.DB, idParam(c), c.now)
    return json({ ok: true, outcome })
  }),

  route('GET', '/v1/admin/settings', 'admin', async (c) => json(await loadSettings(c.env.DB, c.env))),
  route('PATCH', '/v1/admin/settings', 'admin', async (c) => {
    const body = await readJson(c.req)
    const patch = validateSettingsPatch(body, await loadStoredSettings(c.env.DB))
    await saveSettings(c.env.DB, patch)
    return json(await loadSettings(c.env.DB, c.env))
  }),

  route('GET', '/v1/admin/team', 'admin', async (c) => {
    const rows = (await c.env.DB.prepare('SELECT * FROM users ORDER BY id').all<UserRow>()).results
    return json(rows.map(toUser))
  }),
  route('POST', '/v1/admin/team', 'admin', async (c) => {
    const body = await readJson(c.req)
    const phone = requirePhone(body.phone)
    const name = requireString(body.name, 'invalid_name', 2, 40)
    const role = oneOf(body.role, ROLES, 'invalid_role')
    const hash = await hashPassword(validatePassword(body.password))
    if (await c.env.DB.prepare('SELECT 1 FROM users WHERE phone = ?').bind(phone).first()) throw new HttpError(409, 'phone_taken')
    const res = await c.env.DB.prepare('INSERT INTO users (phone, name, role, pass_hash) VALUES (?, ?, ?, ?)').bind(phone, name, role, hash).run()
    const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(res.meta.last_row_id).first<UserRow>()
    return json(toUser(row!), 201)
  }),
  route('PATCH', '/v1/admin/team/:id', 'admin', async (c) => {
    const me = requireUser(c), id = idParam(c)
    const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
    if (!row) throw new HttpError(404, 'user_not_found')
    const body = await readJson(c.req)
    const role = body.role !== undefined ? oneOf(body.role, ROLES, 'invalid_role') : row.role
    const disabled = body.disabled !== undefined ? body.disabled : row.disabled
    if (disabled !== 0 && disabled !== 1) throw new HttpError(400, 'invalid_disabled')
    const name = body.name !== undefined ? requireString(body.name, 'invalid_name', 2, 40) : row.name
    const hash = body.password !== undefined ? await hashPassword(validatePassword(body.password)) : null
    // An admin cannot lock themselves out (disable or demote their own account).
    if (id === me.id && (disabled === 1 || role !== 'admin')) throw new HttpError(400, 'cannot_change_self')
    await c.env.DB.prepare('UPDATE users SET role = ?, disabled = ?, name = ?, pass_hash = COALESCE(?, pass_hash) WHERE id = ?').bind(role, disabled, name, hash, id).run()
    return json(toUser((await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>())!))
  }),

  route('POST', '/v1/admin/announce', 'admin', async (c) => {
    const body = await readJson(c.req)
    const title = requireString(body.title, 'invalid_title', 1, 80)
    const text = requireString(body.body, 'invalid_body', 1, 500)
    const to = oneOf(body.to, ['customers', 'team'] as const, 'invalid_audience')
    return json({ sent: await announce(c.env, c.exec, to, title, text) })
  }),

  // Paid bookings (confirmed/completed) in a local date range, revenue and hours per room. Defaults to the current month.
  route('GET', '/v1/admin/report', 'admin', async (c) => {
    const { timezone } = await loadStoredSettings(c.env.DB)
    const today = localParts(c.now, timezone).date
    const from = c.url.searchParams.get('from') || `${today.slice(0, 7)}-01`
    const to = c.url.searchParams.get('to') || today
    if (!isDateString(from) || !isDateString(to) || from > to) throw new HttpError(400, 'invalid_date')
    const range = { from: localDayRange(from, timezone).from, to: localDayRange(to, timezone).to }
    const rows = (await c.env.DB.prepare(`${BOOKING_SELECT} WHERE b.start >= ? AND b.start < ? AND b.status IN ('confirmed','completed') ORDER BY b.start LIMIT 5000`)
      .bind(range.from.toISOString(), range.to.toISOString()).all<BookingRow>()).results
    const bookings = rows.map(toBooking)
    const hours_by_room: Record<string, number> = {}
    let revenue = 0
    for (const b of bookings) {
      revenue += b.price
      const key = b.room_name ?? String(b.room_id)
      hours_by_room[key] = Math.round(((hours_by_room[key] ?? 0) + (Date.parse(b.end) - Date.parse(b.start)) / 3600000) * 10) / 10
    }
    return json({ bookings, revenue, hours_by_room })
  }),

  // First admin, once: needs ADMIN_SETUP_KEY and an empty admin table.
  route('POST', '/v1/admin/bootstrap', 'public', async (c) => {
    const body = await readJson(c.req)
    const key = typeof body.setup_key === 'string' ? body.setup_key : ''
    if (!c.env.ADMIN_SETUP_KEY || !safeEqual(key, c.env.ADMIN_SETUP_KEY)) throw new HttpError(403, 'forbidden')
    if (await c.env.DB.prepare(`SELECT 1 FROM users WHERE role = 'admin'`).first()) throw new HttpError(409, 'already_bootstrapped')
    const phone = requirePhone(body.phone)
    const name = requireString(body.name, 'invalid_name', 2, 40)
    const hash = await hashPassword(validatePassword(body.password))
    const res = await c.env.DB.prepare(`INSERT INTO users (phone, name, role, pass_hash) VALUES (?, ?, 'admin', ?)`).bind(phone, name, hash).run()
    const user = toUser((await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(res.meta.last_row_id).first<UserRow>())!)
    return json({ token: await signToken(c.env, user, c.now), user }, 201)
  }),
]

// Customer-facing routes (no accounts: X-Device identifies the app; name + phone identify the booking).
import type { Booking, PaymentInfo } from '../../../shared/types'
import { normaliseCode } from '../bookings'
import { ACTIVE_SQL } from '../bookings'
import { BOOKING_SELECT, getBooking, toBooking, toRoom, type BookingRow, type RoomRow } from '../db'
import { HttpError, json, readJson } from '../http'
import { idParam, requireDevice, route, type Ctx, type Route } from '../router'
import { cancelBooking, createCustomerBooking, submitPayment } from '../service'
import { loadSettings, publicSettings } from '../settings'
import { isDateString, localDayRange } from '../tz'
import { isPlainObject, requirePhone, requireString } from '../validate'

const deps = (c: Ctx) => ({ env: c.env, exec: c.exec, now: c.now })

/** The device that made the booking, the phone owner via lookup, or any team account. */
async function ownedBooking(c: Ctx): Promise<Booking> {
  const b = await getBooking(c.env.DB, idParam(c))
  if (!b) throw new HttpError(404, 'booking_not_found')
  if (c.user) return b
  const device = requireDevice(c)
  if (b.device_id !== device) throw new HttpError(403, 'forbidden')
  return b
}

function paymentInfo(b: Booking, s: Awaited<ReturnType<typeof loadSettings>>): PaymentInfo | null {
  if (b.method !== 'shamcash') return null
  return {
    method: b.method, amount: b.price, code: b.code, shamcash_number: s.shamcash_number, shamcash_name: s.shamcash_name,
    shamcash_qr: s.shamcash_qr, instructions: s.payment_instructions, hold_until: b.hold_until, ref: b.payment_ref,
  }
}

/** Who owns the inbox / push subscription for this request: a team account, else the device. */
function owner(c: Ctx): { user_id: number | null; device_id: string | null } {
  if (c.user) return { user_id: c.user.id, device_id: null }
  return { user_id: null, device_id: requireDevice(c) }
}

export const publicRoutes: Route[] = [
  route('GET', '/v1/health', 'public', (c) => json({ ok: true, now: c.now.toISOString() })),

  route('GET', '/v1/settings', 'public', async (c) => json(publicSettings(await loadSettings(c.env.DB, c.env)))),

  route('GET', '/v1/rooms', 'public', async (c) => {
    const rows = (await c.env.DB.prepare('SELECT * FROM rooms WHERE active = 1 ORDER BY sort, id').all<RoomRow>()).results
    return json(rows.map(toRoom))
  }),

  // Every live booking of the day, for every room, in one call (the floor plan colours itself from this).
  route('GET', '/v1/availability', 'public', async (c) => {
    const date = c.url.searchParams.get('date')
    if (!isDateString(date)) throw new HttpError(400, 'invalid_date')
    const { timezone } = await loadSettings(c.env.DB, c.env)
    const { from, to } = localDayRange(date, timezone)
    const rows = (await c.env.DB.prepare(
      `SELECT b.room_id, b.start, b.end, b.status FROM bookings b WHERE b.start < ? AND b.end > ? AND ${ACTIVE_SQL} ORDER BY b.start`)
      .bind(to.toISOString(), from.toISOString(), c.now.toISOString()).all<Pick<Booking, 'room_id' | 'start' | 'end' | 'status'>>()).results
    return json(rows)
  }),

  route('POST', '/v1/bookings', 'public', async (c) => {
    const device = requireDevice(c)
    return json(await createCustomerBooking(deps(c), device, await readJson(c.req)), 201)
  }),

  // This device's bookings: everything upcoming plus the last 90 days, newest first.
  route('GET', '/v1/bookings/mine', 'public', async (c) => {
    const device = requireDevice(c)
    const since = new Date(c.now.getTime() - 90 * 86400000).toISOString()
    const rows = (await c.env.DB.prepare(`${BOOKING_SELECT} WHERE b.device_id = ? AND (b.created_at >= ? OR b.end >= ?) ORDER BY b.created_at DESC LIMIT 200`)
      .bind(device, since, c.now.toISOString()).all<BookingRow>()).results
    return json(rows.map(toBooking))
  }),

  // Find a booking by code + phone; the phone proves ownership, and the device is attached when the booking has none.
  route('GET', '/v1/bookings/lookup', 'public', async (c) => {
    const device = requireDevice(c)
    const code = normaliseCode(c.url.searchParams.get('code'))
    if (!code) throw new HttpError(400, 'invalid_code')
    const phone = requirePhone(c.url.searchParams.get('phone'))
    const row = await c.env.DB.prepare(`${BOOKING_SELECT} WHERE b.code = ? AND b.customer_phone = ?`).bind(code, phone).first<BookingRow>()
    if (!row) throw new HttpError(404, 'booking_not_found')
    if (row.device_id === null) {
      await c.env.DB.prepare('UPDATE bookings SET device_id = ? WHERE id = ? AND device_id IS NULL').bind(device, row.id).run()
      row.device_id = device
    }
    return json(toBooking(row))
  }),

  route('GET', '/v1/bookings/:id', 'public', async (c) => {
    const b = await ownedBooking(c)
    const s = await loadSettings(c.env.DB, c.env)
    return json({ ...b, payment: paymentInfo(b, s) })
  }),

  route('POST', '/v1/bookings/:id/payment', 'public', async (c) => {
    const b = await ownedBooking(c)
    const body = await readJson(c.req)
    return json(await submitPayment(deps(c), b, body.ref))
  }),

  route('POST', '/v1/bookings/:id/cancel', 'public', async (c) => {
    const b = await ownedBooking(c)
    return json(await cancelBooking(deps(c), b, c.user ? 'team' : 'customer'))
  }),

  route('GET', '/v1/notifications', 'public', async (c) => {
    const o = owner(c)
    const rows = (await c.env.DB.prepare(
      `SELECT id, kind, title, body, user_id, device_id, booking_id, read, created_at FROM notifications
       WHERE ${o.user_id ? 'user_id = ?' : 'device_id = ?'} ORDER BY created_at DESC, id DESC LIMIT 100`)
      .bind(o.user_id ?? o.device_id).all()).results
    return json(rows)
  }),

  route('POST', '/v1/notifications/read', 'public', async (c) => {
    const o = owner(c)
    const body = await readJson(c.req)
    const where = o.user_id ? 'user_id = ?' : 'device_id = ?'
    const key = o.user_id ?? o.device_id
    if (Array.isArray(body.ids)) {
      const ids = body.ids.filter((n): n is number => Number.isInteger(n)).slice(0, 200)
      if (ids.length > 0) {
        await c.env.DB.prepare(`UPDATE notifications SET read = 1 WHERE ${where} AND id IN (${ids.map(() => '?').join(',')})`).bind(key, ...ids).run()
      }
    } else {
      await c.env.DB.prepare(`UPDATE notifications SET read = 1 WHERE ${where} AND read = 0`).bind(key).run()
    }
    return json({ ok: true })
  }),

  route('POST', '/v1/push/subscribe', 'public', async (c) => {
    const o = owner(c)
    const body = await readJson(c.req)
    const sub = body.subscription
    if (!isPlainObject(sub) || !isPlainObject(sub.keys)) throw new HttpError(400, 'invalid_subscription')
    const endpoint = requireString(sub.endpoint, 'invalid_subscription', 10, 2000)
    if (!endpoint.startsWith('https://')) throw new HttpError(400, 'invalid_subscription')
    const p256dh = requireString(sub.keys.p256dh, 'invalid_subscription', 20, 300)
    const auth = requireString(sub.keys.auth, 'invalid_subscription', 10, 100)
    await c.env.DB.prepare(
      `INSERT INTO push_subscriptions (user_id, device_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, device_id = excluded.device_id, p256dh = excluded.p256dh, auth = excluded.auth, failures = 0`)
      .bind(o.user_id, o.device_id, endpoint, p256dh, auth).run()
    return json({ ok: true })
  }),

  route('POST', '/v1/push/unsubscribe', 'public', async (c) => {
    const o = owner(c)
    const body = await readJson(c.req)
    const endpoint = requireString(body.endpoint, 'invalid_subscription', 10, 2000)
    await c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND ${o.user_id ? 'user_id = ?' : 'device_id = ?'}`)
      .bind(endpoint, o.user_id ?? o.device_id).run()
    return json({ ok: true })
  }),
]

// Customer-facing routes (no accounts: X-Device identifies the app; name + phone identify the booking).
import type { Booking, PaymentInfo, PushMessage } from '../../../shared/types'
import { normaliseCode } from '../bookings'
import { ACTIVE_SQL } from '../bookings'
import { BOOKING_SELECT, getBooking, toBooking, toRoom, type BookingRow, type RoomRow } from '../db'
import { HttpError, json, readJson } from '../http'
import { idParam, requireDevice, route, type Ctx, type Route } from '../router'
import { cancelBooking, createCustomerBooking, submitPayment } from '../service'
import { loadSettings, publicSettings } from '../settings'
import { pushConfigured, sendPush, type SubscriptionRow } from '../push'
import { absoluteUrl } from '../env'
import { isDateString, localDayRange } from '../tz'
import { isPlainObject, requirePhone, requireString } from '../validate'

const deps = (c: Ctx) => ({ env: c.env, exec: c.exec, now: c.now })

/** A device that owns the booking: the one that made it, or one that adopted it by code + phone (booking_devices). */
async function deviceOwns(db: D1Database, b: Booking, device: string): Promise<boolean> {
  if (b.device_id === device) return true
  return Boolean(await db.prepare('SELECT 1 FROM booking_devices WHERE booking_id = ? AND device_id = ?').bind(b.id, device).first())
}

/** The device that made the booking, a device that adopted it via lookup, or any team account. */
async function ownedBooking(c: Ctx): Promise<Booking> {
  const b = await getBooking(c.env.DB, idParam(c))
  if (!b) throw new HttpError(404, 'booking_not_found')
  if (c.user) return b
  const device = requireDevice(c)
  if (!(await deviceOwns(c.env.DB, b, device))) throw new HttpError(403, 'forbidden')
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

  // This device's bookings (made here or adopted by code + phone): everything upcoming plus the last 90 days, newest first.
  route('GET', '/v1/bookings/mine', 'public', async (c) => {
    const device = requireDevice(c)
    const since = new Date(c.now.getTime() - 90 * 86400000).toISOString()
    const rows = (await c.env.DB.prepare(
      `${BOOKING_SELECT} WHERE (b.device_id = ? OR b.id IN (SELECT booking_id FROM booking_devices WHERE device_id = ?))
       AND (b.created_at >= ? OR b.end >= ?) ORDER BY b.created_at DESC LIMIT 200`)
      .bind(device, device, since, c.now.toISOString()).all<BookingRow>()).results
    return json(rows.map(toBooking))
  }),

  // Find a booking by code + phone. The phone proves ownership, so the calling device always adopts the booking
  // (booking_devices); the original device keeps its access too. /mine, /:id, payment and cancel then work from here.
  route('GET', '/v1/bookings/lookup', 'public', async (c) => {
    const device = requireDevice(c)
    const code = normaliseCode(c.url.searchParams.get('code'))
    if (!code) throw new HttpError(400, 'invalid_code')
    const phone = requirePhone(c.url.searchParams.get('phone'))
    const row = await c.env.DB.prepare(`${BOOKING_SELECT} WHERE b.code = ? AND b.customer_phone = ?`).bind(code, phone).first<BookingRow>()
    if (!row) throw new HttpError(404, 'booking_not_found')
    if (row.device_id !== device) {
      const stmts = [
        c.env.DB.prepare('INSERT INTO booking_devices (booking_id, device_id, added_at) VALUES (?, ?, ?) ON CONFLICT(booking_id, device_id) DO NOTHING')
          .bind(row.id, device, c.now.toISOString()),
      ]
      // A walk-in (no device yet) becomes this device's booking outright, so it also gets the push for it.
      if (row.device_id === null) stmts.push(c.env.DB.prepare('UPDATE bookings SET device_id = ? WHERE id = ? AND device_id IS NULL').bind(device, row.id))
      await c.env.DB.batch(stmts)
      if (row.device_id === null) row.device_id = device
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

  // The customer inbox is always THIS device's own — even on a phone that is also signed in to the team panel
  // (the app sends the team token with every request). Team alerts reach staff by push and the live panel instead,
  // so a staff phone's customer side never lists other people's bookings.
  route('GET', '/v1/notifications', 'public', async (c) => {
    const device = requireDevice(c)
    const rows = (await c.env.DB.prepare(
      `SELECT id, kind, title, body, user_id, device_id, booking_id, read, created_at FROM notifications
       WHERE device_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`)
      .bind(device).all()).results
    return json(rows)
  }),

  route('POST', '/v1/notifications/read', 'public', async (c) => {
    const body = await readJson(c.req)
    const where = 'device_id = ?'
    const key = requireDevice(c)
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
    // A phone has ONE push endpoint for this site, used both by its customer side and, when someone from the team is
    // signed in on it, by the team panel. Keep both owners on the row so customer and team notifications both arrive.
    const user_id = c.user?.id ?? null, device_id = c.device ?? null
    if (!user_id && !device_id) throw new HttpError(401, 'device_required')
    await c.env.DB.prepare(
      `INSERT INTO push_subscriptions (user_id, device_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, device_id = COALESCE(excluded.device_id, push_subscriptions.device_id),
         p256dh = excluded.p256dh, auth = excluded.auth, failures = 0`)
      .bind(user_id, device_id, endpoint, p256dh, auth).run()
    return json({ ok: true })
  }),

  // Sends a test notification to this phone's subscriptions and reports what the push service answered,
  // so the owner can check delivery from the app ("أرسل إشعاراً تجريبياً").
  route('POST', '/v1/push/test', 'public', async (c) => {
    const user_id = c.user?.id ?? null, device_id = c.device ?? null
    if (!user_id && !device_id) throw new HttpError(401, 'device_required')
    const subs = (await c.env.DB.prepare(
      `SELECT id, endpoint, p256dh, auth, failures FROM push_subscriptions WHERE (? IS NOT NULL AND user_id = ?) OR (? IS NOT NULL AND device_id = ?)`)
      .bind(user_id, user_id, device_id, device_id).all<SubscriptionRow>()).results
    const results = []
    for (const sub of subs) {
      const r = await sendPush(c.env, sub, { kind: 'announcement', booking_id: null, url: absoluteUrl(c.env, user_id ? '/team' : '/inbox'), title: 'إشعار تجريبي', body: 'الإشعارات تعمل على هذا الجهاز ✓', tag: 'fp-test' } as PushMessage)
      results.push({ host: new URL(sub.endpoint).host, ...r })
    }
    return json({ subscriptions: subs.length, configured: pushConfigured(c.env), results })
  }),

  route('POST', '/v1/push/unsubscribe', 'public', async (c) => {
    const o = owner(c)
    const body = await readJson(c.req)
    const endpoint = requireString(body.endpoint, 'invalid_subscription', 10, 2000)
    await c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND (user_id = ? OR device_id = ?)`)
      .bind(endpoint, o.user_id ?? -1, c.device ?? o.device_id ?? '').run()
    return json({ ok: true })
  }),
]

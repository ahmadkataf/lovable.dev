// Sham Cash webhook (for the day a callback exists): authenticated by X-Webhook-Secret, logged to payment_events,
// matched to a booking by transaction reference or by the booking code written in the transfer note.
import { CODE_ALPHABET } from '../bookings'
import { BOOKING_SELECT, toBooking, type BookingRow } from '../db'
import { HttpError, json, readJson, safeEqual } from '../http'
import { route, type Route } from '../router'
import { confirmBooking } from '../service'

const CODE_IN_TEXT = new RegExp(`(?<![${CODE_ALPHABET}])[${CODE_ALPHABET}]{6}(?![${CODE_ALPHABET}])`, 'g')
const OPEN = `b.status IN ('pending_payment','awaiting_verification')`

export const paymentRoutes: Route[] = [
  route('POST', '/v1/payments/shamcash/webhook', 'public', async (c) => {
    const given = c.req.headers.get('X-Webhook-Secret') ?? ''
    if (!c.env.WEBHOOK_SECRET || !safeEqual(given, c.env.WEBHOOK_SECRET)) throw new HttpError(401, 'invalid_secret')
    const body = await readJson(c.req)
    const ref = typeof body.ref === 'string' ? body.ref.trim().slice(0, 80) : ''
    const amount = typeof body.amount === 'number' && Number.isFinite(body.amount) && body.amount >= 0 ? Math.round(body.amount) : null
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : ''
    if (!ref || amount === null) throw new HttpError(400, 'invalid_event')
    const db = c.env.DB
    const ev = await db.prepare(`INSERT INTO payment_events (provider, ref, amount, payload) VALUES ('shamcash', ?, ?, ?)`)
      .bind(ref, amount, JSON.stringify(body).slice(0, 4000)).run()

    // 1. by reference the customer typed; 2. by a booking code in the transfer note.
    let row = await db.prepare(`${BOOKING_SELECT} WHERE b.payment_ref = ? AND ${OPEN} ORDER BY b.id DESC`).bind(ref).first<BookingRow>()
    if (!row) {
      for (const code of note.toUpperCase().match(CODE_IN_TEXT) ?? []) {
        row = await db.prepare(`${BOOKING_SELECT} WHERE b.code = ? AND ${OPEN}`).bind(code).first<BookingRow>()
        if (row) break
      }
    }
    if (!row) {
      // Already confirmed with this reference (duplicate delivery) counts as matched.
      const done = await db.prepare(`SELECT id FROM bookings WHERE payment_ref = ? AND status IN ('confirmed','completed')`).bind(ref).first<{ id: number }>()
      if (done) await db.prepare('UPDATE payment_events SET matched_booking = ? WHERE id = ?').bind(done.id, ev.meta.last_row_id).run()
      return json({ matched: Boolean(done) })
    }
    const booking = toBooking(row)
    if (amount < booking.price) return json({ matched: false })
    if (!booking.payment_ref) await db.prepare('UPDATE bookings SET payment_ref = ? WHERE id = ? AND payment_ref IS NULL').bind(ref, booking.id).run()
    await confirmBooking({ env: c.env, exec: c.exec, now: c.now }, booking.id, null)
    await db.prepare('UPDATE payment_events SET matched_booking = ? WHERE id = ?').bind(booking.id, ev.meta.last_row_id).run()
    return json({ matched: true })
  }),
]

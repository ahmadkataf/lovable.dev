// Notifications: stored in the `notifications` inbox AND pushed (best effort, in ctx.waitUntil).
// Team accounts get booking_created / payment_submitted; the customer's device gets the outcome of its booking.
// Links are absolute, built from env.PUBLIC_URL (no domain is hard-coded anywhere): team → /team/bookings?id=, customer → /b/:id.
import type { Booking, NotificationKind } from '../../shared/types'
import { absoluteUrl, type Env } from './env'
import { sendPushToAll, type PushPayload, type SubscriptionRow } from './push'
import { formatWhen } from './tz'

interface Message { kind: NotificationKind; title: string; body: string; booking_id: number | null }

const payloadFor = (env: Env, m: Message, path: string): PushPayload =>
  ({ kind: m.kind, booking_id: m.booking_id, url: absoluteUrl(env, path), title: m.title, body: m.body, tag: m.booking_id ? `booking-${m.booking_id}` : m.kind })

/** Where a notification opens in the app. */
export const teamPath = (bookingId: number | null): string => (bookingId ? `/team/bookings?id=${bookingId}` : '/team')
export const customerPath = (bookingId: number | null): string => (bookingId ? `/b/${bookingId}` : '/inbox')

/** All enabled team accounts: inbox row each + push to every team subscription. Returns the number of accounts. */
export async function notifyTeam(env: Env, ctx: ExecutionContext, m: Message): Promise<number> {
  const users = (await env.DB.prepare('SELECT id FROM users WHERE disabled = 0').all<{ id: number }>()).results
  if (users.length === 0) return 0
  const insert = env.DB.prepare('INSERT INTO notifications (user_id, kind, title, body, booking_id) VALUES (?, ?, ?, ?, ?)')
  await env.DB.batch(users.map((u) => insert.bind(u.id, m.kind, m.title, m.body, m.booking_id)))
  const subs = (await env.DB.prepare('SELECT id, endpoint, p256dh, auth, failures FROM push_subscriptions WHERE user_id IN (SELECT id FROM users WHERE disabled = 0)')
    .all<SubscriptionRow>()).results
  ctx.waitUntil(sendPushToAll(env, subs, payloadFor(env, m, teamPath(m.booking_id))))
  return users.length
}

/**
 * The customer devices of a booking: the one that made it plus every device that adopted it by code + phone
 * (booking_devices). Walk-ins with no device → nothing to do.
 */
export async function notifyDevice(env: Env, ctx: ExecutionContext, deviceId: string | null, m: Message): Promise<void> {
  const devices = new Set<string>()
  if (deviceId) devices.add(deviceId)
  if (m.booking_id) {
    const extra = (await env.DB.prepare('SELECT device_id FROM booking_devices WHERE booking_id = ?').bind(m.booking_id).all<{ device_id: string }>()).results
    for (const r of extra) devices.add(r.device_id)
  }
  if (devices.size === 0) return
  const ids = [...devices]
  const insert = env.DB.prepare('INSERT INTO notifications (device_id, kind, title, body, booking_id) VALUES (?, ?, ?, ?, ?)')
  await env.DB.batch(ids.map((d) => insert.bind(d, m.kind, m.title, m.body, m.booking_id)))
  const subs = (await env.DB.prepare(`SELECT id, endpoint, p256dh, auth, failures FROM push_subscriptions WHERE device_id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids).all<SubscriptionRow>()).results
  ctx.waitUntil(sendPushToAll(env, subs, payloadFor(env, m, customerPath(m.booking_id))))
}

/** Announcement to every customer device that has a push subscription, or to every team account. */
export async function announce(env: Env, ctx: ExecutionContext, to: 'customers' | 'team', title: string, body: string): Promise<number> {
  const m: Message = { kind: 'announcement', title, body, booking_id: null }
  if (to === 'team') return notifyTeam(env, ctx, m)
  const devices = (await env.DB.prepare('SELECT DISTINCT device_id FROM push_subscriptions WHERE device_id IS NOT NULL').all<{ device_id: string }>()).results
  if (devices.length === 0) return 0
  const insert = env.DB.prepare('INSERT INTO notifications (device_id, kind, title, body, booking_id) VALUES (?, ?, ?, ?, NULL)')
  for (let i = 0; i < devices.length; i += 50) {   // D1 batches: keep them modest
    await env.DB.batch(devices.slice(i, i + 50).map((d) => insert.bind(d.device_id, m.kind, m.title, m.body)))
  }
  const subs = (await env.DB.prepare('SELECT id, endpoint, p256dh, auth, failures FROM push_subscriptions WHERE device_id IS NOT NULL').all<SubscriptionRow>()).results
  ctx.waitUntil(sendPushToAll(env, subs, payloadFor(env, m, customerPath(null))))
  return devices.length
}

// ---- Arabic message texts (UI language), built from a booking ----
type B = Pick<Booking, 'id' | 'code' | 'customer_name' | 'customer_phone' | 'room_name' | 'start' | 'end' | 'price' | 'method' | 'payment_ref' | 'reject_reason' | 'device_id'>
export const PAY_ON_ARRIVAL = 'دفع عند الوصول'
const syp = (n: number) => `${n.toLocaleString('en-US')} ل.س`
const room = (b: B) => b.room_name ?? 'الغرفة'

export const texts = {
  booking_created: (b: B, tz: string): Message => ({
    kind: 'booking_created', booking_id: b.id, title: 'حجز جديد',
    body: `${b.customer_name} · ${room(b)} · ${formatWhen(b.start, b.end, tz)} · ${syp(b.price)} · الرمز ${b.code}`,
  }),
  payment_submitted: (b: B, tz: string): Message => ({
    kind: 'payment_submitted', booking_id: b.id, title: 'دفعة بانتظار التحقق',
    body: `${b.customer_name} · ${syp(b.price)} · ${b.method === 'cash' ? PAY_ON_ARRIVAL : `رقم العملية ${b.payment_ref ?? ''}`} · ${room(b)} ${formatWhen(b.start, b.end, tz)}`,
  }),
  booking_confirmed: (b: B, tz: string): Message => ({
    kind: 'booking_confirmed', booking_id: b.id, title: 'تم تأكيد حجزك',
    body: `${room(b)} · ${formatWhen(b.start, b.end, tz)} · الرمز ${b.code}. نراك في فوكس بوينت!`,
  }),
  booking_rejected: (b: B, tz: string): Message => ({
    kind: 'booking_rejected', booking_id: b.id, title: 'لم يتم تأكيد الدفع',
    body: `${room(b)} · ${formatWhen(b.start, b.end, tz)}${b.reject_reason ? ` · السبب: ${b.reject_reason}` : ''}. تواصل معنا إن كان هناك خطأ.`,
  }),
  booking_expired: (b: B, tz: string): Message => ({
    kind: 'booking_expired', booking_id: b.id, title: 'انتهت مهلة الحجز',
    body: `لم يصلنا رقم عملية الدفع لحجز ${room(b)} · ${formatWhen(b.start, b.end, tz)}. يمكنك الحجز من جديد.`,
  }),
  booking_cancelled: (b: B, tz: string, phone = ''): Message => ({
    kind: 'booking_cancelled', booking_id: b.id, title: 'تم إلغاء حجزك',
    body: `${room(b)} · ${formatWhen(b.start, b.end, tz)}. تواصل معنا${phone ? ` على ${phone}` : ''} لأي استفسار.`,
  }),
  booking_reminder: (b: B, tz: string): Message => ({
    kind: 'booking_reminder', booking_id: b.id, title: 'حجزك بعد ساعة',
    body: `${room(b)} · ${formatWhen(b.start, b.end, tz)} · الرمز ${b.code}. ننتظرك!`,
  }),
}

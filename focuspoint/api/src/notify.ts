// Notifications: stored in the `notifications` inbox AND pushed (best effort, in ctx.waitUntil).
// Team accounts get booking_created / payment_submitted; the customer's device gets the outcome of its booking.
import type { Booking, NotificationKind } from '../../shared/types'
import type { Env } from './env'
import { sendPushToAll, type PushPayload, type SubscriptionRow } from './push'
import { formatWhen } from './tz'

interface Message { kind: NotificationKind; title: string; body: string; booking_id: number | null }

const payloadFor = (m: Message, url: string): PushPayload =>
  ({ title: m.title, body: m.body, kind: m.kind, booking_id: m.booking_id, url, tag: m.booking_id ? `booking-${m.booking_id}` : m.kind })

/** All enabled team accounts: inbox row each + push to every team subscription. Returns the number of accounts. */
export async function notifyTeam(env: Env, ctx: ExecutionContext, m: Message): Promise<number> {
  const users = (await env.DB.prepare('SELECT id FROM users WHERE disabled = 0').all<{ id: number }>()).results
  if (users.length === 0) return 0
  const insert = env.DB.prepare('INSERT INTO notifications (user_id, kind, title, body, booking_id) VALUES (?, ?, ?, ?, ?)')
  await env.DB.batch(users.map((u) => insert.bind(u.id, m.kind, m.title, m.body, m.booking_id)))
  const subs = (await env.DB.prepare('SELECT id, endpoint, p256dh, auth, failures FROM push_subscriptions WHERE user_id IN (SELECT id FROM users WHERE disabled = 0)')
    .all<SubscriptionRow>()).results
  ctx.waitUntil(sendPushToAll(env, subs, payloadFor(m, m.booking_id ? `/admin/bookings/${m.booking_id}` : '/admin')))
  return users.length
}

/** The customer device that owns a booking. Walk-ins have no device → nothing to do. */
export async function notifyDevice(env: Env, ctx: ExecutionContext, deviceId: string | null, m: Message): Promise<void> {
  if (!deviceId) return
  await env.DB.prepare('INSERT INTO notifications (device_id, kind, title, body, booking_id) VALUES (?, ?, ?, ?, ?)')
    .bind(deviceId, m.kind, m.title, m.body, m.booking_id).run()
  const subs = (await env.DB.prepare('SELECT id, endpoint, p256dh, auth, failures FROM push_subscriptions WHERE device_id = ?')
    .bind(deviceId).all<SubscriptionRow>()).results
  ctx.waitUntil(sendPushToAll(env, subs, payloadFor(m, m.booking_id ? `/bookings/${m.booking_id}` : '/')))
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
  ctx.waitUntil(sendPushToAll(env, subs, payloadFor(m, '/')))
  return devices.length
}

// ---- Arabic message texts (UI language), built from a booking ----
type B = Pick<Booking, 'id' | 'code' | 'customer_name' | 'customer_phone' | 'room_name' | 'start' | 'end' | 'price' | 'payment_ref' | 'reject_reason' | 'device_id'>
const syp = (n: number) => `${n.toLocaleString('en-US')} ل.س`
const room = (b: B) => b.room_name ?? 'الغرفة'

export const texts = {
  booking_created: (b: B, tz: string): Message => ({
    kind: 'booking_created', booking_id: b.id, title: 'حجز جديد',
    body: `${b.customer_name} · ${room(b)} · ${formatWhen(b.start, b.end, tz)} · ${syp(b.price)} · الرمز ${b.code}`,
  }),
  payment_submitted: (b: B, tz: string): Message => ({
    kind: 'payment_submitted', booking_id: b.id, title: 'دفعة بانتظار التحقق',
    body: `${b.customer_name} · ${syp(b.price)} · رقم العملية ${b.payment_ref ?? ''} · ${room(b)} ${formatWhen(b.start, b.end, tz)}`,
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
  booking_cancelled: (b: B, tz: string): Message => ({
    kind: 'booking_cancelled', booking_id: b.id, title: 'تم إلغاء حجزك',
    body: `${room(b)} · ${formatWhen(b.start, b.end, tz)}. تواصل معنا على 0985258963 لأي استفسار.`,
  }),
  booking_reminder: (b: B, tz: string): Message => ({
    kind: 'booking_reminder', booking_id: b.id, title: 'حجزك بعد ساعة',
    body: `${room(b)} · ${formatWhen(b.start, b.end, tz)} · الرمز ${b.code}. ننتظرك!`,
  }),
}

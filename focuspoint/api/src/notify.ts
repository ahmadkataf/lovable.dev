// Notifications: stored in the `notifications` inbox AND pushed (best effort, in ctx.waitUntil).
// Team accounts get booking_created / payment_submitted; the customer's device gets the outcome of its booking.
// Links are absolute, built from env.PUBLIC_URL (no domain is hard-coded anywhere): team → /team/bookings?id=, customer → /b/:id.
import { DEFAULT_CONTENT, fillTemplate, reminderLabel, type SiteContent } from '../../shared/content'
import type { Booking, NotificationKind, Settings } from '../../shared/types'
import { loadContent } from './content'
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

// ---- Arabic message texts, from the admin-editable templates (content.messages, see shared/content.ts) ----
// With the default content every title and body is exactly what the hard-coded texts said before the site editor
// (test/notify.test.ts compares them for every kind). Any content problem falls back to the defaults: a broken
// template must never stop a booking from being created or confirmed.
type B = Pick<Booking, 'id' | 'code' | 'customer_name' | 'customer_phone' | 'room_name' | 'start' | 'end' | 'price' | 'method' | 'payment_ref' | 'reject_reason' | 'device_id'>
type Messages = SiteContent['messages']

/** What every message needs besides the booking: the centre's zone and facts, and the templates. */
export interface MessageCtx {
  tz: string; phone: string; name: string
  reminder: string           // {reminder}: settings.reminder_minutes in words (60 → «ساعة»)
  messages: Messages
}

/** Loads the templates (isolate-cached content); on any error the default templates. */
export async function messageCtx(db: D1Database, s: Pick<Settings, 'timezone' | 'phone' | 'centre_name' | 'reminder_minutes'>): Promise<MessageCtx> {
  let messages: Messages = DEFAULT_CONTENT.messages
  try { messages = (await loadContent(db)).messages } catch (err) { console.error('notify: content unavailable, using the default texts', err) }
  return { tz: s.timezone, phone: s.phone, name: s.centre_name, reminder: reminderLabel(s.reminder_minutes), messages }
}

/** The default templates only (tests, and callers without a database). */
export const defaultMessageCtx = (tz: string, phone = '', name = '', reminderMinutes = 60): MessageCtx =>
  ({ tz, phone, name, reminder: reminderLabel(reminderMinutes), messages: DEFAULT_CONTENT.messages })

const syp = (n: number) => `${n.toLocaleString('en-US')} ل.س`
const room = (b: B) => b.room_name ?? 'الغرفة'

/**
 * Optional values (the reject reason, the centre phone) used to be left out together with their label when empty
 * ("· السبب: …", "على …"). Same here: the placeholder and the one word / "·" in front of it go.
 */
const OPTIONAL_VARS = ['reason', 'phone'] as const
function dropEmpty(t: string, vars: Record<string, string>): string {
  let out = t
  for (const k of OPTIONAL_VARS) {
    if (vars[k] === '') out = out.replace(new RegExp(`(\\s*·)?\\s*[^\\s·{}]+\\s*\\{${k}\\}`, 'g'), '')
  }
  return out
}

function build(kind: NotificationKind, b: B, ctx: MessageCtx, tpl: { title: string; body: string }): Message {
  const vars: Record<string, string> = {
    customer_name: b.customer_name, room: room(b), when: formatWhen(b.start, b.end, ctx.tz), price: syp(b.price), code: b.code,
    ref: b.payment_ref ?? '', reason: b.reject_reason ?? '', phone: ctx.phone, name: ctx.name, reminder: ctx.reminder,
  }
  const fill = (t: string) => fillTemplate(dropEmpty(t, vars), vars)
  return { kind, booking_id: b.id, title: fill(tpl.title), body: fill(tpl.body) }
}

export const texts = {
  booking_created: (b: B, ctx: MessageCtx): Message => build('booking_created', b, ctx, ctx.messages.booking_created),
  /** Pay-on-arrival bookings (method cash) use body_cash: there is no transfer reference to check. */
  payment_submitted: (b: B, ctx: MessageCtx): Message => {
    const m = ctx.messages.payment_submitted
    return build('payment_submitted', b, ctx, { title: m.title, body: b.method === 'cash' ? m.body_cash : m.body })
  },
  booking_confirmed: (b: B, ctx: MessageCtx): Message => build('booking_confirmed', b, ctx, ctx.messages.booking_confirmed),
  booking_rejected: (b: B, ctx: MessageCtx): Message => build('booking_rejected', b, ctx, ctx.messages.booking_rejected),
  /** body_unverified: it expired while waiting for the team (a reference was sent, or pay on arrival), not for lack of payment. */
  booking_expired: (b: B, ctx: MessageCtx): Message => {
    const m = ctx.messages.booking_expired
    return build('booking_expired', b, ctx, { title: m.title, body: b.payment_ref || b.method === 'cash' ? m.body_unverified : m.body })
  },
  booking_cancelled: (b: B, ctx: MessageCtx): Message => build('booking_cancelled', b, ctx, ctx.messages.booking_cancelled),
  booking_reminder: (b: B, ctx: MessageCtx): Message => build('booking_reminder', b, ctx, ctx.messages.booking_reminder),
}

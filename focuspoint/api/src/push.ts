// Web Push for Workers: VAPID (ES256) + RFC 8291 aes128gcm via @block65/webcrypto-web-push (WebCrypto only).
// A subscription that answers 404/410 is gone and is deleted; other failures are counted and the row dropped after 8.
import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push'
import type { PushMessage } from '../../shared/types'
import type { Env } from './env'

export interface SubscriptionRow { id: number; endpoint: string; p256dh: string; auth: string; failures: number }

/** The JSON a push carries — {kind, booking_id, url, title, body} so the service worker can show it and forward it to open clients. */
export type PushPayload = PushMessage

export const pushConfigured = (env: Env): boolean => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT)

/** What the push service answered for one subscription (status null = the request itself failed). */
export interface PushResult { status: number | null; error?: string }

/** Sends one notification. Never throws: push is best effort; the in-app inbox is the source of truth. */
export async function sendPush(env: Env, sub: SubscriptionRow, payload: PushPayload): Promise<PushResult> {
  if (!pushConfigured(env)) return { status: null, error: 'push_not_configured' }
  const subscription: PushSubscription = { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } }
  try {
    const req = await buildPushPayload(
      { data: payload as unknown as Record<string, string | number | null>, options: { ttl: 24 * 3600, urgency: 'high' } },
      subscription,
      { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
    )
    const res = await fetch(subscription.endpoint, { method: req.method, headers: req.headers, body: req.body as BodyInit })
    if (res.status === 404 || res.status === 410) {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run()
    } else if (!res.ok) {
      console.warn('push rejected', res.status, sub.endpoint.slice(0, 60), (await res.text().catch(() => '')).slice(0, 200))
      await env.DB.prepare('UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?').bind(sub.id).run()
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ? AND failures >= 8').bind(sub.id).run()
    } else if (sub.failures > 0) {
      await env.DB.prepare('UPDATE push_subscriptions SET failures = 0 WHERE id = ?').bind(sub.id).run()
    }
    return { status: res.status }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.warn('push failed', sub.endpoint.slice(0, 60), error)
    return { status: null, error }
  }
}

export async function sendPushToAll(env: Env, subs: SubscriptionRow[], payload: PushPayload): Promise<void> {
  // Sequential on purpose: a handful of team devices / a batch of customers, and D1 likes it calmer.
  for (const sub of subs) await sendPush(env, sub, payload)
}

/**
 * Pushes sent in one Worker invocation. The free plan allows ~50 outbound requests (and 50 D1 queries) per invocation;
 * past that, fetches fail silently — so a big announcement goes out in batches: the first now, the rest from push_queue
 * by the 5-minute cron (drainPushQueue).
 */
export const PUSH_BATCH = 30

/** Queues `payload` for every customer subscription with id > afterId (one INSERT … SELECT). Throws if the table is missing. */
export async function queueCustomerPushes(env: Env, afterId: number, payload: PushPayload): Promise<number> {
  const r = await env.DB.prepare(
    `INSERT INTO push_queue (subscription_id, payload) SELECT id, ? FROM push_subscriptions WHERE device_id IS NOT NULL AND id > ?`)
    .bind(JSON.stringify(payload), afterId).run()
  return r.meta.changes ?? 0
}

/** Sends up to PUSH_BATCH queued pushes (oldest first) and removes them; rows older than a day or whose subscription is gone are dropped. */
export async function drainPushQueue(env: Env, now = new Date()): Promise<number> {
  const rows = (await env.DB.prepare(
    `SELECT q.id AS qid, q.payload, q.created_at, s.id, s.endpoint, s.p256dh, s.auth, s.failures
     FROM push_queue q LEFT JOIN push_subscriptions s ON s.id = q.subscription_id ORDER BY q.id LIMIT ?`)
    .bind(PUSH_BATCH).all<SubscriptionRow & { qid: number; payload: string; created_at: string }>()).results
  if (rows.length === 0) return 0
  // Remove first (one statement), then send: a run cut short loses a few pushes rather than repeating them.
  await env.DB.prepare(`DELETE FROM push_queue WHERE id IN (${rows.map(() => '?').join(',')})`).bind(...rows.map((r) => r.qid)).run()
  const dayAgo = now.getTime() - 24 * 3600 * 1000
  let sent = 0
  for (const r of rows) {
    if (!r.endpoint || Date.parse(r.created_at) < dayAgo) continue
    let payload: PushPayload
    try { payload = JSON.parse(r.payload) as PushPayload } catch { continue }
    await sendPush(env, r, payload)
    sent++
  }
  return sent
}

// Web Push for Workers: VAPID (ES256) + RFC 8291 aes128gcm via @block65/webcrypto-web-push (WebCrypto only).
// A subscription that answers 404/410 is gone and is deleted; other failures are counted and the row dropped after 8.
import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push'
import type { Env } from './env'

export interface SubscriptionRow { id: number; endpoint: string; p256dh: string; auth: string; failures: number }

export interface PushPayload {
  title: string; body: string; kind: string; booking_id: number | null; url: string; tag?: string
}

export const pushConfigured = (env: Env): boolean => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT)

/** Sends one notification. Never throws: push is best effort; the in-app inbox is the source of truth. */
export async function sendPush(env: Env, sub: SubscriptionRow, payload: PushPayload): Promise<void> {
  if (!pushConfigured(env)) return
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
      await env.DB.prepare('UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?').bind(sub.id).run()
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ? AND failures >= 8').bind(sub.id).run()
    } else if (sub.failures > 0) {
      await env.DB.prepare('UPDATE push_subscriptions SET failures = 0 WHERE id = ?').bind(sub.id).run()
    }
  } catch (err) {
    console.warn('push failed', sub.endpoint.slice(0, 60), err instanceof Error ? err.message : err)
  }
}

export async function sendPushToAll(env: Env, subs: SubscriptionRow[], payload: PushPayload): Promise<void> {
  // Sequential on purpose: a handful of team devices / a few hundred customers at most, and D1 likes it calmer.
  for (const sub of subs) await sendPush(env, sub, payload)
}

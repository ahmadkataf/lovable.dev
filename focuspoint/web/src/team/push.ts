// Web Push for the team: subscribe this device with the centre's VAPID key and register it with the API.
// The server ties the subscription to the signed-in account (Authorization header), so staff get new-booking
// and payment-submitted notifications on this device.
import { api } from '../api'

const KEY = 'fp_team_push_endpoint'

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied'

export function pushState(): PushState {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  return Notification.permission as PushState
}

function toKey(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  const reg = await navigator.serviceWorker.getRegistration()
  if (reg?.active) return reg
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))])
}

/** Ask for permission (needs a user gesture) and register the subscription for this team account. */
export async function enableTeamPush(vapidPublicKey: string): Promise<PushState> {
  const state = pushState()
  if (state === 'unsupported' || !vapidPublicKey) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm as PushState
  const reg = await registration()
  if (!reg) return 'unsupported'
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidPublicKey) as BufferSource })
  await api.post('/v1/push/subscribe', { subscription: sub.toJSON() })
  try { localStorage.setItem(KEY, sub.endpoint) } catch { /* ignore */ }
  return 'granted'
}

/** Permission already granted but this account not yet registered on this device → register silently. */
export async function ensureTeamPush(vapidPublicKey: string): Promise<void> {
  if (pushState() !== 'granted' || !vapidPublicKey) return
  const reg = await registration()
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  let known: string | null = null
  try { known = localStorage.getItem(KEY) } catch { /* ignore */ }
  if (known === sub.endpoint) return
  await api.post('/v1/push/subscribe', { subscription: sub.toJSON() })
  try { localStorage.setItem(KEY, sub.endpoint) } catch { /* ignore */ }
}

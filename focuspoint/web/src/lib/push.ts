// Web Push on the customer side: subscribe with the centre's VAPID key and register the subscription with the API.
import { api } from '../api'
import { flag, setFlag } from './store'

const ENDPOINT_KEY = 'fp_push_endpoint'

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}
export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}
/** Should we offer the notification prompt right now? */
export function canOfferPush(): boolean {
  return pushSupported() && Notification.permission === 'default' && !flag('fp_push_asked')
}

function toKey(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return null
  if (reg.active) return reg
  // Wait briefly for a fresh install to activate.
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))])
}

/** Permission already granted: make sure this device has a subscription the server knows about. */
export async function ensurePushSubscription(vapidPublicKey: string): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted' || !vapidPublicKey) return false
  const reg = await registration()
  if (!reg) return false
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidPublicKey) as BufferSource })
  }
  let known: string | null = null
  try { known = localStorage.getItem(ENDPOINT_KEY) } catch { /* ignore */ }
  if (known !== sub.endpoint) {
    await api.post('/v1/push/subscribe', { subscription: sub.toJSON() })
    try { localStorage.setItem(ENDPOINT_KEY, sub.endpoint) } catch { /* ignore */ }
  }
  return true
}

/** Ask for permission (user gesture) and subscribe. */
export async function enablePush(vapidPublicKey: string): Promise<'granted' | 'denied' | 'unsupported'> {
  setFlag('fp_push_asked')
  if (!pushSupported()) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  const ok = await ensurePushSubscription(vapidPublicKey)
  return ok ? 'granted' : 'unsupported'
}

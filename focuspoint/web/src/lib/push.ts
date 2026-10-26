// Web Push on the customer side: subscribe with the centre's VAPID key and register the subscription with the API.
import type { PushMessage } from '@shared/types'
import { api } from '../api'
import { flag, setFlag } from './store'

/** A push the service worker forwarded to this window ({type: 'push', payload}) — see sw.ts. */
export interface PushEventMessage { type: 'push'; payload: PushMessage; at: number }

/** Listen for pushes forwarded by the service worker while the app is open; returns the unsubscribe function. */
export function onPushMessage(cb: (p: PushMessage) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => { /* nothing */ }
  const handler = (e: MessageEvent) => {
    const m = e.data as Partial<PushEventMessage> | null
    if (m && m.type === 'push' && m.payload) cb(m.payload)
  }
  navigator.serviceWorker.addEventListener('message', handler)
  return () => navigator.serviceWorker.removeEventListener('message', handler)
}

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
  // Wait for a fresh install to activate (it precaches the app first, slow on a slow connection).
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 15000))])
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
  // always (re)register: idempotent on the server, and it heals a lost row or a phone shared with the team panel
  await api.post('/v1/push/subscribe', { subscription: sub.toJSON() })
  try { localStorage.setItem(ENDPOINT_KEY, sub.endpoint) } catch { /* ignore */ }
  return true
}

/** Ask for permission (user gesture) and subscribe. */
export async function enablePush(vapidPublicKey: string): Promise<'granted' | 'denied' | 'unsupported'> {
  setFlag('fp_push_asked')
  if (!pushSupported()) return 'unsupported'
  // never wait forever: an app build without the permission bridge never answered this call
  const perm = await Promise.race([Notification.requestPermission(), new Promise<NotificationPermission>((r) => setTimeout(() => r('default'), 30000))])
  if (perm !== 'granted') return 'denied'
  const ok = await ensurePushSubscription(vapidPublicKey)
  return ok ? 'granted' : 'unsupported'
}

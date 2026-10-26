// Web Push on the customer side: subscribe with the centre's VAPID key and register the subscription with the API.
import type { PushMessage } from '@shared/types'
import { api } from '../api'
import { flag, setFlag } from './store'
import { appNotifHint } from './appHint'

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

/** Rejects with `code` when `p` takes longer than `ms`, so nothing can spin forever. */
export function withTimeout<T>(p: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(code)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

let permissionRun: Promise<NotificationPermission> | null = null
/** One permission request at a time for the whole page (customer side and team panel share it). Never hangs:
 *  after 30 s it rejects with 'permission_timeout'. */
export function requestPermissionOnce(): Promise<NotificationPermission> {
  if (!permissionRun) {
    permissionRun = withTimeout(Notification.requestPermission(), 30000, 'permission_timeout')
    permissionRun.finally(() => { permissionRun = null }).catch(() => { /* the caller handles it */ })
  }
  return permissionRun
}

/** In the Android app with notifications allowed (?np=1) but Chrome still saying "not asked yet": ask through
 *  Chrome — it passes the request to the app, which answers "granted" at once, without a dialog. */
export async function adoptAppPermission(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'default' || appNotifHint() !== '1') return
  await requestPermissionOnce()
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
  const perm = await requestPermissionOnce().catch((): NotificationPermission => 'default')
  if (perm !== 'granted') return 'denied'
  const ok = await ensurePushSubscription(vapidPublicKey)
  return ok ? 'granted' : 'unsupported'
}

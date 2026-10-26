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

/** Rejects with `code` when `p` takes longer than `ms` — so no step can leave the button spinning forever. */
function withTimeout<T>(p: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(code)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

/** Tells every notification card on the page that the permission / subscription state may have changed. */
const STATE_EVENT = 'fp-team-push'
function announce() { try { window.dispatchEvent(new Event(STATE_EVENT)) } catch { /* ignore */ } }
export function onPushStateChange(fn: () => void): () => void {
  const vis = () => { if (document.visibilityState === 'visible') fn() }   // back from the phone's settings
  window.addEventListener(STATE_EVENT, fn); document.addEventListener('visibilitychange', vis)
  return () => { window.removeEventListener(STATE_EVENT, fn); document.removeEventListener('visibilitychange', vis) }
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  const reg = await navigator.serviceWorker.getRegistration()
  if (reg?.active) return reg
  // a fresh install can take a while on a slow connection (it precaches the app first)
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 15000))])
}

/** Creates the push subscription if this phone has none yet, and (re)registers it for the signed-in account.
 *  Idempotent on the server (upsert by endpoint), so it runs on every panel load. Throws on failure. */
async function subscribeAndRegister(vapidPublicKey: string): Promise<void> {
  const reg = await registration()
  if (!reg) throw new Error('sw_not_ready')
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidPublicKey) as BufferSource }), 20000, 'subscribe_timeout')
  await withTimeout(api.post('/v1/push/subscribe', { subscription: sub.toJSON() }), 20000, 'network_timeout')
  try { localStorage.setItem(KEY, sub.endpoint) } catch { /* ignore */ }
}

/** Ask for permission (needs a user gesture) and register this phone for the signed-in team account. */
export async function enableTeamPush(vapidPublicKey: string): Promise<PushState> {
  const state = pushState()
  if (state === 'unsupported' || !vapidPublicKey) return 'unsupported'
  const perm = Notification.permission === 'granted' ? 'granted'
    : await withTimeout(Notification.requestPermission(), 30000, 'permission_timeout')
  announce()
  if (perm !== 'granted') return perm as PushState
  await subscribeAndRegister(vapidPublicKey)
  announce()
  return 'granted'
}

/** Permission already granted (the installed app often starts that way): make sure this phone is subscribed and
 *  registered for this account. Creating the subscription needs no prompt once permission is granted. */
export async function ensureTeamPush(vapidPublicKey: string): Promise<void> {
  if (pushState() !== 'granted' || !vapidPublicKey) return
  await subscribeAndRegister(vapidPublicKey)
}

/** Runs once when the team panel opens. Notifications are mandatory for the team, so nobody has to press a button:
 *  - permission already granted (the Android app asks for it natively at first launch) → subscribe right away;
 *  - not asked yet → ask now, and again on the first tap anywhere (some browsers only show the prompt after a tap).
 *  Returns a cleanup function. */
export function autoEnableTeamPush(vapidPublicKey: string): () => void {
  if (!vapidPublicKey || pushState() === 'unsupported') return () => {}
  if (pushState() === 'granted') { ensureTeamPush(vapidPublicKey).catch(() => { /* the card shows the problem */ }); return () => {} }
  if (pushState() !== 'default') return () => {}
  let asked = false
  const ask = () => {
    if (asked || pushState() !== 'default') return
    asked = true
    enableTeamPush(vapidPublicKey).catch(() => { /* the card shows the problem */ }).finally(() => { if (pushState() === 'default') asked = false })
  }
  ask()
  const onTap = () => ask()
  document.addEventListener('pointerdown', onTap, { capture: true })
  return () => document.removeEventListener('pointerdown', onTap, { capture: true })
}

export interface PushTestResult { subscriptions: number; configured: boolean; results: { host: string; status: number | null; error?: string }[] }
/** Asks the server to push a test notification to this phone and returns what the push service answered. */
export const testPush = () => api.post<PushTestResult>('/v1/push/test')

/** A readable Arabic reason for a failed subscription. */
export function pushErrorText(err: unknown): string {
  const name = (err as { name?: string })?.name || '', msg = (err as { message?: string })?.message || String(err)
  if (msg === 'permission_timeout') return 'لم يصل ردّ على طلب الإذن — حدّث التطبيق من Google Play (أو أغلقه وافتحه) ثم أعد المحاولة.'
  if (msg === 'subscribe_timeout') return 'خدمة الإشعارات في الهاتف (خدمات Google) لم تستجب — تأكد من الإنترنت ثم أعد المحاولة.'
  if (msg === 'network_timeout') return 'لا يوجد اتصال بالخادم الآن — سيُعاد التسجيل تلقائياً عند عودة الإنترنت.'
  if (msg === 'sw_not_ready') return 'التطبيق لم يجهز بعد — أغلقه وافتحه مرة ثانية ثم أعد المحاولة.'
  if (name === 'AbortError' || /push service|registration failed/i.test(msg)) return 'خدمة الإشعارات في الهاتف (خدمات Google) غير متاحة أو محجوبة على هذا الجهاز/الشبكة.'
  if (name === 'NotAllowedError') return 'الإشعارات مرفوضة لهذا التطبيق — فعّلها من إعدادات الهاتف ← التطبيقات ← فوكس بوينت ← الإشعارات.'
  return msg
}

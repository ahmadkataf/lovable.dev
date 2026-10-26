// Web Push for the team: subscribe this device with the centre's VAPID key and register it with the API.
// The server ties the subscription to the signed-in account (Authorization header), so staff get new-booking
// and payment-submitted notifications on this device.
//
// Notifications are mandatory for the team. The module keeps ONE shared status — permission, whether this phone is
// registered, the last problem — so every card on the page shows the same truth and no failure is silently dropped.
import { api, teamToken } from '../api'

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

/** Rejects with `code` when `p` takes longer than `ms` — so no step can leave a button spinning forever. */
function withTimeout<T>(p: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(code)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

// ── shared status ────────────────────────────────────────────────────────────────────────────────────────────────
let registeredFor: string | null = null   // the team session (token) this phone was registered for on this page load
let problem: string | null = null      // the last failure, in Arabic; cleared by the next success
let inflight: Promise<PushState> | null = null

/** Registered for the account signed in NOW (signing out and in as someone else must register again). */
export const pushRegistered = () => registeredFor !== null && registeredFor === teamToken()
export const pushProblem = () => problem
export const pushBusy = () => inflight !== null

/** Tells every notification card on the page that the status may have changed. */
const STATE_EVENT = 'fp-team-push'
function announce() { try { window.dispatchEvent(new Event(STATE_EVENT)) } catch { /* ignore */ } }
export function setPushProblem(p: string | null) { problem = p; announce() }
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
 *  Idempotent on the server (upsert by endpoint), so it is safe to repeat. Throws on failure. */
async function subscribeAndRegister(vapidPublicKey: string): Promise<void> {
  const reg = await registration()
  if (!reg) throw new Error('sw_not_ready')
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidPublicKey) as BufferSource }), 20000, 'subscribe_timeout')
  await withTimeout(api.post('/v1/push/subscribe', { subscription: sub.toJSON() }), 20000, 'network_timeout')
  try { localStorage.setItem(KEY, sub.endpoint) } catch { /* ignore */ }
  registeredFor = teamToken()
  problem = null
}

/** Ask for permission if needed and register this phone for the signed-in team account. One run at a time: a tap
 *  on the card and the first-tap auto prompt share the same run instead of asking twice. Failures are kept in the
 *  shared status (shown by the card) and rethrown. */
export function enableTeamPush(vapidPublicKey: string): Promise<PushState> {
  if (inflight) return inflight
  if (pushState() === 'unsupported' || !vapidPublicKey) return Promise.resolve('unsupported')
  const run = (async (): Promise<PushState> => {
    try {
      const perm = Notification.permission === 'granted' ? 'granted'
        : await withTimeout(Notification.requestPermission(), 30000, 'permission_timeout')
      if (perm !== 'granted') return perm as PushState
      await subscribeAndRegister(vapidPublicKey)
      return 'granted'
    } catch (err) {
      problem = pushErrorText(err)
      throw err
    }
  })()
  inflight = run
  announce()
  run.finally(() => { inflight = null; announce() }).catch(() => { /* reported through `problem` */ })
  return run
}

/** The push service no longer knows this phone's subscription (404/410 — e.g. Google rotated it): drop the stale
 *  subscription in the browser and register a fresh one. */
export async function resubscribeTeamPush(vapidPublicKey: string): Promise<PushState> {
  if (inflight) await inflight.catch(() => { /* retried below */ })
  try {
    const reg = await registration()
    const sub = await reg?.pushManager.getSubscription()
    await sub?.unsubscribe()
  } catch { /* a fresh subscribe below still helps */ }
  registeredFor = null
  return enableTeamPush(vapidPublicKey)
}

/** Permission already granted (the Android app asks for it natively at first launch): make sure this phone is
 *  subscribed and registered for this account. Creating the subscription needs no prompt once granted. */
export async function ensureTeamPush(vapidPublicKey: string): Promise<void> {
  if (pushState() !== 'granted' || !vapidPublicKey) return
  await enableTeamPush(vapidPublicKey)
}

/** Runs while the team panel is open. Nobody has to press a button:
 *  - permission granted → register now, and again whenever the phone comes back online / to the foreground or the
 *    permission changes, until it has succeeded (a failure is shown on the card and retried, never dropped);
 *  - not asked yet → ask once on the first tap anywhere (every browser shows the prompt for a tap; asking again
 *    and again after a dismissal would get the site auto-blocked by Chrome).
 *  Returns a cleanup function. */
export function autoEnableTeamPush(vapidPublicKey: string): () => void {
  if (!vapidPublicKey || pushState() === 'unsupported') return () => {}
  let askedThisLoad = false
  const sync = () => {
    const s = pushState()
    if (s === 'granted' && (!pushRegistered() || problem)) enableTeamPush(vapidPublicKey).catch(() => { /* on the card */ })
    announce()
  }
  const onTap = () => {
    if (askedThisLoad || pushState() !== 'default') return
    askedThisLoad = true
    enableTeamPush(vapidPublicKey).catch(() => { /* on the card */ })
  }
  const onVisible = () => { if (document.visibilityState === 'visible') sync() }
  sync()
  document.addEventListener('pointerdown', onTap, { capture: true })
  window.addEventListener('online', sync)
  document.addEventListener('visibilitychange', onVisible)
  let status: PermissionStatus | null = null, dropped = false
  navigator.permissions?.query({ name: 'notifications' as PermissionName })
    .then((st) => { if (dropped) return; status = st; st.onchange = sync })
    .catch(() => { /* not supported: visibility / online cover it */ })
  return () => {
    dropped = true
    document.removeEventListener('pointerdown', onTap, { capture: true })
    window.removeEventListener('online', sync)
    document.removeEventListener('visibilitychange', onVisible)
    if (status) status.onchange = null
  }
}

/** Signing out: this phone must stop receiving the team's alerts (they name customers). Re-registering the same
 *  subscription without the team token keeps it for this device's own bookings only. If this fails (offline), the
 *  customer side re-registers it the same way on the next app start. */
export async function unlinkTeamPush(): Promise<void> {
  registeredFor = null
  problem = null
  try {
    if (pushState() !== 'granted') return
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub && !teamToken()) await api.post('/v1/push/subscribe', { subscription: sub.toJSON() })
  } catch { /* see above */ }
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
  if ((err as { offline?: boolean })?.offline) return 'لا يوجد اتصال بالإنترنت — سيُعاد التسجيل تلقائياً عند عودته.'
  return msg
}

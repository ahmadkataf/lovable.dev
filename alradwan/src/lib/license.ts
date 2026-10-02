// Activation (the app is sold with codes made in the seller's control panel, see server/src/license.ts).
//
// The app asks the server when it opens: a valid code gives a signed session that is renewed every time
// there is internet. Without internet the app keeps working for GRACE_DAYS after the last check, so a
// shop with a bad connection is not interrupted; a code that is cancelled or expired stops at the next check.
import { create } from 'zustand'
import { API_URL } from './platform'
import { SALES } from '../sales'

export type LicenseState = 'off' | 'loading' | 'trial' | 'active' | 'grace' | 'expired' | 'revoked' | 'moved' | 'none' | 'blocked'
export interface License { state: LicenseState; until: number | null; code: string; device: string; lastCheck: number; trialEnds: number; shopName: string; devices: number; maxDevices: number; notice: string }

const KEY = 'alradwan.license'
const FIRST = 'alradwan.firstRun'
const RAW = 'alradwan.deviceRaw'
const GRACE_DAYS = 14
const CHECK_EVERY = 6 * 3600000
const DAY = 86400000

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* ignore */ } }

export const useLicense = create<License>(() => ({ state: API_URL ? 'loading' : 'off', until: null, code: '', device: '', lastCheck: 0, trialEnds: 0, shopName: '', devices: 0, maxDevices: 0, notice: '' }))

/** The device's own id: Android's id, the Windows app's stored id, or a random id kept by the browser. */
async function rawDeviceId(): Promise<string> {
  try { const a = window.GarageAndroid?.deviceId?.(); if (a) return `a:${a}` } catch { /* not android */ }
  try { const d = await window.garageDesktop?.deviceId?.(); if (d) return `w:${d}` } catch { /* not desktop */ }
  let r = read(RAW)
  if (!r) { r = `b:${crypto.randomUUID()}`; write(RAW, r) }
  return r
}
async function serverDevice(): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`alradwan:${await rawDeviceId()}`)))
  return [...h].slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join('')
}
/** Shown to the shop for support: 8 characters of the device id. */
export const shortDevice = (d: string) => d.slice(0, 8).toUpperCase().replace(/(.{4})/, '$1-')

type Saved = { token: string; until: number | null; code: string; lastCheck: number; shopName?: string; devices?: number; maxDevices?: number }
const saved = (): Saved | null => { try { return JSON.parse(read(KEY) || 'null') } catch { return null } }

async function post(path: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000)
  try {
    const r = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal })
    return { status: r.status, data: await r.json().catch(() => ({})) }
  } finally { clearTimeout(t) }
}

const NOTICE: Record<string, string> = {
  revoked: 'أُلغي كود التفعيل لهذا البرنامج. تواصل مع البائع إن كان هذا خطأً.',
  expired: 'انتهى الاشتراك. جدّده لتعود إلى العمل — بياناتك محفوظة ولا تضيع.',
  used: 'هذا الكود مستخدم على العدد الأقصى من الأجهزة.',
  moved: 'فُكّ هذا الجهاز عن الكود. أدخل الكود مرة أخرى أو تواصل مع البائع.',
  session: 'انتهت جلسة التفعيل. اتصل بالإنترنت ثم أعد فتح البرنامج.',
  blocked: `لم يتصل البرنامج بالخادم منذ أكثر من ${GRACE_DAYS} يوماً. اتصل بالإنترنت لتجديد التفعيل.`,
}

let devicePromise: Promise<string> | null = null
const device = () => (devicePromise ??= serverDevice())

function trialEnds(): number {
  if (!SALES.trialDays) return 0
  let first = Number(read(FIRST))
  if (!first) { first = Date.now(); write(FIRST, String(first)) }
  return first + SALES.trialDays * DAY
}

/** Works out the state from what is stored, then asks the server when it is time. */
export async function checkLicense(force = false): Promise<void> {
  if (!API_URL) { useLicense.setState({ state: 'off' }); return }
  const dev = await device()
  const s = saved()
  const te = trialEnds()
  if (!s) { useLicense.setState({ state: te > Date.now() ? 'trial' : 'none', device: dev, trialEnds: te, notice: '' }); return }
  const now = Date.now()
  const stale = now - s.lastCheck
  const fromStore = (state: LicenseState, notice = '') => useLicense.setState({ state, until: s.until, code: s.code, device: dev, lastCheck: s.lastCheck, trialEnds: te, shopName: s.shopName ?? '', devices: s.devices ?? 0, maxDevices: s.maxDevices ?? 0, notice })
  if (s.until && s.until < now) { fromStore('expired', NOTICE.expired); if (!force && stale < CHECK_EVERY) return }
  else fromStore(stale > GRACE_DAYS * DAY ? 'blocked' : 'active', stale > GRACE_DAYS * DAY ? NOTICE.blocked : '')
  if (!force && stale < CHECK_EVERY && !(s.until && s.until < now)) return
  if (!navigator.onLine) { if (stale > GRACE_DAYS * DAY) fromStore('blocked', NOTICE.blocked); return }
  let res
  try { res = await post('/api/license/session', { token: s.token, device: dev }) }
  catch { if (stale > GRACE_DAYS * DAY) fromStore('blocked', NOTICE.blocked); return }
  if (res.status === 200) {
    const next: Saved = { token: String(res.data.token), until: res.data.until ? Number(res.data.until) : null, code: String(res.data.code || s.code), lastCheck: now, shopName: String(res.data.shopName || ''), devices: Number(res.data.devices || 0), maxDevices: Number(res.data.maxDevices || 0) }
    write(KEY, JSON.stringify(next))
    useLicense.setState({ state: 'active', until: next.until, code: next.code, device: dev, lastCheck: now, shopName: next.shopName, devices: next.devices, maxDevices: next.maxDevices, notice: '' })
    return
  }
  if (res.status >= 500 || res.status === 429) { if (stale > GRACE_DAYS * DAY) fromStore('blocked', NOTICE.blocked); return }   // the server, not the code
  const why = String(res.data.error || 'session')
  // the server said no: the stored session is no longer good
  if (why === 'expired') { write(KEY, JSON.stringify({ ...s, until: s.until ?? now - 1, lastCheck: now })); fromStore('expired', NOTICE.expired); return }
  write(KEY, null)
  useLicense.setState({ state: why === 'revoked' ? 'revoked' : why === 'moved' ? 'moved' : 'none', until: null, code: '', device: dev, lastCheck: 0, trialEnds: te, notice: NOTICE[why] ?? NOTICE.session })
}

/** Enters a code bought from the seller; returns 'ok' or the reason it was refused. */
export async function activate(code: string, name: string): Promise<string> {
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (clean.length !== 12) return 'format'
  if (!API_URL) return 'off'
  if (!navigator.onLine) return 'network'
  const dev = await device()
  let res
  try { res = await post('/api/license/activate', { code: clean, device: dev, name }) }
  catch { return 'network' }
  if (res.status !== 200) return String(res.data.error || 'server')
  const now = Date.now()
  write(KEY, JSON.stringify({ token: String(res.data.token), until: res.data.until ? Number(res.data.until) : null, code: String(res.data.code), lastCheck: now, shopName: String(res.data.shopName || ''), devices: Number(res.data.devices || 0), maxDevices: Number(res.data.maxDevices || 0) } satisfies Saved))
  await checkLicense(false)
  return 'ok'
}

/** The app may be used: free build, trial, active, or inside the offline grace. */
export const licenseAllows = (st: LicenseState) => st === 'off' || st === 'trial' || st === 'active' || st === 'loading'

export function startLicenseChecks() {
  checkLicense().catch(() => {})
  setInterval(() => checkLicense().catch(() => {}), 30 * 60000)
  window.addEventListener('online', () => checkLicense(true).catch(() => {}))
}

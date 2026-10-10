// The license client (docs/LICENSE-SPEC.md): activation, the stored token, periodic verification.
//
//   init()        read + verify the stored token, answer at once, then check in the background
//   activate()    POST /api/activate with a code      startTrial()  POST /api/trial
//   check()       POST /api/check (every 6 hours, on 'online', when the app comes back to the front)
//   release()     POST /api/release: free this device so the code can move
//   fetchInfo()   GET /api/info (price, WhatsApp, trial days…), cached in storage for offline use
//   subscribe()   every status change
//
// Storage (platform.license, outside the page on Electron/Android): JSON { token, lastCheck, maxSeenTime, skew, info, denied }.
// Nothing here ever waits for the network before answering init().
import './i18n'
import { platform } from '../lib/platform'
import { sha256Hex } from '../lib/hash'
import { DEFAULT_INFO, type LicenseState, type LicenseStatus, type SellerInfo } from './types'
import {
  type TokenPayload, cleanCode, formatCode, deviceCodeOf, verifyToken, clockRolledBack, deriveState, errorMessageKey, stateForCheckError, newNonce,
} from './crypto'

const API = (typeof __POS_API__ === 'string' ? __POS_API__ : '').trim().replace(/\/+$/, '')
const PUBLIC_KEY = typeof __POS_PUBLIC_KEY__ === 'string' ? __POS_PUBLIC_KEY__.trim() : ''
const VERSION = typeof __POS_VERSION__ === 'string' ? __POS_VERSION__ : ''
const BUILD = typeof __POS_BUILD__ === 'string' ? __POS_BUILD__ : ''
const CHECK_EVERY = 6 * 3600000
const RE_DERIVE_EVERY = 60000          // a running app notices exp / grace passing within a minute
const FETCH_TIMEOUT = 15000

type Denied = Extract<LicenseState, 'revoked' | 'expired' | 'tampered'>
interface Stored {
  token: string | null
  lastCheck?: number
  maxSeenTime?: number       // the newest local clock reading ever seen (the rollback guard; never includes server time)
  skew?: number              // serverTime - local time at the last successful check: exp / grace are judged on local time + skew
  info?: SellerInfo
  denied?: { state: Denied; at: number }   // the server refused the stored token: blocked until a check succeeds again
}
interface Issued { token: string; status: { plan: 'full' | 'trial'; expiresAt: number | null; graceUntil: number; serverTime: number } }
type Result<T> = { ok: true; data: T } | { ok: false; error: string; message?: string; network: boolean }

const isOnline = (): boolean => (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true)

let status: LicenseStatus = { state: API ? 'none' : 'demo', deviceCode: '', checking: false, online: isOnline() }
let stored: Stored = { token: null }
let payload: TokenPayload | null = null
let device = ''            // hex SHA-256 of kaseb:<platform>:<deviceId>
let deviceName = ''
let sig = 'web'
let clockBad = false       // a clock rollback is suspected: locked until a check succeeds
let initPromise: Promise<LicenseStatus> | null = null
let queue: Promise<unknown> = Promise.resolve()
let background = false
const listeners = new Set<(s: LicenseStatus) => void>()

function publish(patch: Partial<LicenseStatus>): LicenseStatus {
  status = { ...status, ...patch }
  listeners.forEach(cb => { try { cb(status) } catch { /* a listener must not break the others */ } })
  return status
}

// ---------- storage ----------
async function readStored(): Promise<Stored> {
  try {
    const raw = await platform.license.get()
    if (!raw) return { token: null }
    const v = JSON.parse(raw) as Partial<Stored>
    if (!v || typeof v !== 'object') return { token: null }
    const out: Stored = { token: typeof v.token === 'string' ? v.token : null }
    if (typeof v.lastCheck === 'number') out.lastCheck = v.lastCheck
    if (typeof v.maxSeenTime === 'number') out.maxSeenTime = v.maxSeenTime
    if (typeof v.skew === 'number' && Number.isFinite(v.skew)) out.skew = v.skew
    if (v.info && typeof v.info === 'object' && typeof v.info.price === 'string') out.info = { ...DEFAULT_INFO, ...v.info }
    if (v.denied && (v.denied.state === 'revoked' || v.denied.state === 'expired' || v.denied.state === 'tampered')) out.denied = { state: v.denied.state, at: Number(v.denied.at) || 0 }
    return out
  } catch { return { token: null } }
}
async function save(patch: Partial<Stored>): Promise<void> {
  stored = { ...stored, ...patch }
  for (const k of Object.keys(stored) as (keyof Stored)[]) if (stored[k] === undefined) delete stored[k]
  try { await platform.license.set(JSON.stringify(stored)) } catch { /* the token stays in memory for this run */ }
}

// ---------- state ----------
/** Our best idea of the server's time: the local clock corrected by the offset measured at the last successful check. */
const serverNow = (now = Date.now()): number => now + (stored.skew ?? 0)
function derive(now = Date.now()): LicenseState {
  if (!API) return 'demo'
  if (stored.denied) return stored.denied.state
  if (!payload) return 'none'
  return deriveState(payload, serverNow(now), clockBad)
}
function fromPayload(p: TokenPayload | null): Partial<LicenseStatus> {
  if (!p) return { code: undefined, plan: undefined, expiresAt: undefined, graceUntil: undefined, cloudUntil: undefined }
  return { code: p.code ? formatCode(p.code) : undefined, plan: p.p, expiresAt: p.exp, graceUntil: p.gr, cloudUntil: typeof p.cl === 'number' ? p.cl : null }
}
/** Bumps the newest time we ever saw (the clock-rollback guard), never lowering it. */
async function bumpSeen(...times: number[]): Promise<void> {
  const m = Math.max(stored.maxSeenTime ?? 0, ...times)
  if (m > (stored.maxSeenTime ?? 0)) await save({ maxSeenTime: m })
}
async function discardToken(): Promise<void> {
  payload = null
  await save({ token: null, lastCheck: undefined, denied: undefined })
}

// ---------- network ----------
async function call<T>(path: string, body?: Record<string, unknown>): Promise<Result<T>> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal, cache: 'no-store',
    })
    let data: unknown = null
    try { data = await res.json() } catch { data = null }
    const d = (data && typeof data === 'object' ? data : {}) as { error?: unknown; message?: unknown }
    if (res.ok && data) return { ok: true, data: data as T }
    if (res.status >= 500 || !data) return { ok: false, error: 'unknown', network: res.status >= 500, message: typeof d.message === 'string' ? d.message : undefined }
    return { ok: false, error: typeof d.error === 'string' ? d.error : 'unknown', message: typeof d.message === 'string' ? d.message : undefined, network: false }
  } catch {
    return { ok: false, error: 'network', network: true }
  } finally { clearTimeout(timer) }
}
const clientInfo = (nonce: string) => ({ device, deviceCode: status.deviceCode, name: deviceName, platform: platform.kind, version: VERSION || platform.appVersion(), build: BUILD, sig, nonce })

/** Runs network actions one after the other, with `checking` on while they run. */
function run(task: () => Promise<void>): Promise<LicenseStatus> {
  const p = queue.then(async () => {
    publish({ checking: true })
    try { await task() } finally { publish({ checking: false }) }
    return status
  })
  queue = p.catch(() => undefined)
  return p
}

/** A fresh token from activate / trial / check: verify it, store it, publish. */
async function accept(r: Result<Issued>, nonce: string): Promise<boolean> {
  if (!r.ok) return false
  const p = await verifyToken(r.data.token, PUBLIC_KEY, device, nonce)
  if (!p) { publish({ online: true, error: 'license.err.invalid_token', errorText: undefined }); return false }
  const now = Date.now()
  payload = p
  clockBad = false
  // The server's time is not mixed into maxSeenTime (a clock running an hour slow would then look rolled back after
  // every check); it is kept as an offset instead, so exp and the grace deadline are judged on corrected time
  // whatever the local clock says — a clock set back before activation gains nothing.
  const serverTime = Number(r.data.status?.serverTime)
  const skew = Number.isFinite(serverTime) && serverTime > 0 ? serverTime - now : stored.skew
  await save({ token: r.data.token, lastCheck: now, denied: undefined, skew, maxSeenTime: Math.max(stored.maxSeenTime ?? 0, now) })
  publish({ state: derive(now), ...fromPayload(p), lastCheck: now, online: true, error: undefined, errorText: undefined })
  return true
}
function failed(r: Extract<Result<unknown>, { ok: false }>): void {
  if (r.network) publish({ online: r.error !== 'network', error: errorMessageKey(r.error), errorText: r.message })
  else publish({ online: true, error: errorMessageKey(r.error), errorText: r.message })
}

// ---------- background checks ----------
const checkDue = (): boolean => !!stored.token && (!stored.lastCheck || Date.now() - stored.lastCheck > CHECK_EVERY || status.state === 'locked' || clockBad)
function startBackground(): void {
  if (background || typeof window === 'undefined') return
  background = true
  const kick = (): void => { if (!isOnline()) return; if (checkDue()) void license.check(); void license.fetchInfo() }
  kick()
  window.setInterval(() => {
    const now = Date.now()
    if (clockRolledBack(now, stored.maxSeenTime)) clockBad = true; else void bumpSeen(now)
    const st = derive(now)
    if (st !== status.state) publish({ state: st })
    if (isOnline() && checkDue()) void license.check()
  }, RE_DERIVE_EVERY)
  window.setInterval(() => { if (isOnline() && stored.token) void license.check() }, CHECK_EVERY)
  window.addEventListener('online', () => { publish({ online: true }); kick() })
  window.addEventListener('offline', () => publish({ online: false }))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick() })
}

export const license = {
  /** Reads and verifies the stored license. Returns the status right away; the network runs in the background. */
  async init(): Promise<LicenseStatus> {
    if (initPromise) return initPromise
    initPromise = (async () => {
      try {
        const id = await platform.deviceId()
        device = await sha256Hex(`kaseb:${platform.kind}:${id}`)
        deviceName = await platform.deviceName()
        sig = await platform.appSignature()
      } catch { /* the hash of whatever we got is still stable */ }
      const deviceCode = device ? deviceCodeOf(device) : ''
      if (!API) return publish({ state: 'demo', deviceCode, checking: false, online: true })
      stored = await readStored()
      const now = Date.now()
      clockBad = clockRolledBack(now, stored.maxSeenTime)
      // without a device identity (the bridge failed this run) nothing can be verified: the token is kept for the next run
      payload = stored.token && device ? await verifyToken(stored.token, PUBLIC_KEY, device) : null
      if (stored.token && device && !payload) await discardToken()        // forged, for another device, or signed by another server
      if (!clockBad) await bumpSeen(now)
      publish({ state: derive(now), deviceCode, ...fromPayload(payload), lastCheck: stored.lastCheck, info: stored.info, checking: false, online: isOnline(), error: undefined, errorText: undefined })
      startBackground()
      return status
    })()
    return initPromise
  },

  get(): LicenseStatus { return status },

  /** The server address this build talks to ('' in demo mode). */
  api(): string { return API },

  /** What cloud calls need to prove who they are: the stored token and this device's hash, or null when not licensed. */
  credentials(): { token: string; device: string } | null {
    return stored.token && device && payload?.p === 'full' ? { token: stored.token, device } : null
  },

  subscribe(cb: (s: LicenseStatus) => void): () => void {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  },

  /** Binds a code to this device. The result is in the returned status (state, error). */
  async activate(raw: string): Promise<LicenseStatus> {
    if (!API) return status
    const code = cleanCode(raw)
    if (!code) return publish({ error: 'license.err.invalid_code', errorText: undefined })
    return run(async () => {
      const nonce = newNonce()
      const r = await call<Issued>('/api/activate', { code, ...clientInfo(nonce) })
      if (await accept(r, nonce)) return
      if (!r.ok) {
        failed(r)
        if (r.error === 'tampered') { await save({ denied: { state: 'tampered', at: Date.now() } }); publish({ state: derive() }) }
      }
    })
  },

  /** One free trial per device. */
  async startTrial(): Promise<LicenseStatus> {
    if (!API) return status
    return run(async () => {
      const nonce = newNonce()
      const r = await call<Issued>('/api/trial', clientInfo(nonce))
      if (await accept(r, nonce)) return
      if (!r.ok) {
        failed(r)
        if (r.error === 'tampered') { await save({ denied: { state: 'tampered', at: Date.now() } }); publish({ state: derive() }) }
      }
    })
  },

  /** Asks the server whether the stored license is still good and gets a fresh token. Without a token it refreshes the seller info. */
  async check(): Promise<LicenseStatus> {
    if (!API) return status
    if (!stored.token) { await license.fetchInfo(); return status }
    return run(async () => {
      const nonce = newNonce()
      const r = await call<Issued>('/api/check', { token: stored.token, ...clientInfo(nonce) })
      if (await accept(r, nonce)) return
      if (!r.ok) {
        failed(r)
        if (r.network) return                              // keep the state: the grace period covers this
        const st = stateForCheckError(r.error)
        if (st === 'none') await discardToken()
        else if (st) await save({ denied: { state: st, at: Date.now() } })
        publish({ state: derive(), ...fromPayload(payload) })
      }
    })
  },

  /** Frees this device so the code can be used on another one (the app goes back to "not activated"). */
  async release(): Promise<LicenseStatus> {
    if (!API) return status
    if (!stored.token) return status
    return run(async () => {
      const r = await call<{ ok: boolean }>('/api/release', { token: stored.token, device })
      if (r.ok) {
        await discardToken()
        publish({ state: derive(), ...fromPayload(null), lastCheck: undefined, online: true, error: undefined, errorText: undefined })
        return
      }
      failed(r)
      if (!r.network && (r.error === 'invalid_token' || r.error === 'device_mismatch')) {
        await discardToken()
        publish({ state: derive(), ...fromPayload(null) })
      }
    })
  },

  /** Price, WhatsApp, trial days… cached in storage so the activation screen works offline. */
  async fetchInfo(): Promise<SellerInfo> {
    if (!API) return status.info ?? DEFAULT_INFO
    const r = await call<Partial<SellerInfo>>('/api/info')
    if (r.ok && r.data && typeof r.data === 'object') {
      const d = r.data
      const info: SellerInfo = {
        price: typeof d.price === 'string' && d.price.trim() ? d.price.trim() : DEFAULT_INFO.price,
        whatsapp: String(d.whatsapp ?? '').replace(/\D/g, ''),
        trialDays: Number.isFinite(Number(d.trialDays)) ? Math.max(0, Number(d.trialDays)) : DEFAULT_INFO.trialDays,
        message: typeof d.message === 'string' ? d.message : '',
        minVersion: typeof d.minVersion === 'string' ? d.minVersion : '',
        graceDays: Number.isFinite(Number(d.graceDays)) ? Number(d.graceDays) : DEFAULT_INFO.graceDays,
        cloudPrice: typeof d.cloudPrice === 'string' && d.cloudPrice.trim() ? d.cloudPrice.trim() : DEFAULT_INFO.cloudPrice,
      }
      await save({ info })
      publish({ info, online: true })
      return info
    }
    if (!r.ok && r.network && r.error === 'network') publish({ online: false })
    return status.info ?? stored.info ?? DEFAULT_INFO
  },
}

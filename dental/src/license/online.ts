// Licence keys (docs/LICENCE-KEYS.md): the seller sells a key without knowing the clinic's device, and the app turns
// it into the usual signed activation code once, online. This is the only request the app ever makes to a server, and
// it carries two values: the key and the device number. What comes back is trusted for nothing: Settings → Licence
// hands the code to lic.activate(), which checks its signature, device, plan and last day with the app's own public
// key, exactly like a code the seller sent. A wrong or forged answer cannot activate anything.
// No React, no database (covered by tests/licence-online.test.ts).
import { cleanCode, cleanDevice, formatCode } from './core'

export const ACTIVATION_ORIGIN = 'https://dentora.raqeem.dev'
export const ACTIVATION_URL = `${ACTIVATION_ORIGIN}/api/activate`
/** The public activation page (a clinic whose app cannot reach the internet, or app 1.0.0); English: ACTIVATION_PAGE_EN. */
export const ACTIVATION_PAGE = `${ACTIVATION_ORIGIN}/activate`
export const ACTIVATION_PAGE_EN = `${ACTIVATION_ORIGIN}/en/activate`
/** How long the app waits for the server before it calls the attempt offline. */
export const REDEEM_TIMEOUT_MS = 20_000

// ---- reading a key ------------------------------------------------------------------------------------------------
/** 16 characters of the codes' alphabet (no 0/O or 1/I): 80 random bits, shown XXXX-XXXX-XXXX-XXXX. */
const KEY_RE = /^[2-9A-HJ-NP-Z]{16}$/
/** A key written in fours inside longer text, and not four groups out of a longer dash-grouped code. */
const KEY_IN_TEXT = /(?<![0-9A-Z-])[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}(?![0-9A-Z-])/g

/** Is this a licence key alone? Any case, with or without dashes or spaces, Arabic-Indic digits allowed (as the server reads it). */
export const isLicenceKey = (input: string) => KEY_RE.test(cleanCode(input))
/** The key as the server stores it and the seller's message shows it: 'XXXX-XXXX-XXXX-XXXX'. */
export const formatKey = (input: string) => formatCode(cleanCode(input))

/**
 * The key inside whatever was pasted: the key alone (in any shape), or the seller's whole message around it, where
 * the key stands in four dashed groups. Null when there is none, or when the text holds two different keys.
 */
export function extractKey(text: string): string | null {
  if (isLicenceKey(text)) return formatKey(text)
  const upper = (text || '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).toUpperCase()
  const found = new Set(upper.match(KEY_IN_TEXT) ?? [])
  return found.size === 1 ? [...found][0] : null
}

/** The activation page for this device in the interface language; the page fills the device number in. */
export function activationPageUrl(device: string, lang: 'ar' | 'en'): string {
  const page = lang === 'en' ? ACTIVATION_PAGE_EN : ACTIVATION_PAGE
  const dev = cleanDevice(device)
  return dev.length === 8 ? `${page}?device=${formatCode(dev)}` : page
}

// ---- redeeming a key ----------------------------------------------------------------------------------------------
/**
 * Why a key gave no code: no connection or no answer in time (offline), the server refused the key or the device
 * (key, device), no such key (unknown), already activated on another device (used), refunded or cancelled (void),
 * a dated key past its day (expired), too many failed attempts from this address (locked, retryAfter in seconds),
 * or anything else the server answered (server).
 */
export type RedeemFailure = 'offline' | 'key' | 'device' | 'unknown' | 'used' | 'void' | 'expired' | 'locked' | 'server'
export type RedeemResult = { ok: true; code: string } | { ok: false; reason: RedeemFailure; retryAfter?: number }

/** The errors each refusal status may carry; any other status or body (a proxy's page, a 5xx) is 'server'. */
const REFUSALS: Partial<Record<number, RedeemFailure[]>> = { 400: ['key', 'device'], 404: ['unknown'], 409: ['used'], 410: ['void', 'expired'] }

/**
 * Sends the key and the device number to the activation server, once, and answers its activation code (not checked
 * here: the caller passes it to lic.activate()). Never throws. No cookies, no referrer, no cache.
 */
export async function redeemKey(key: string, device: string): Promise<RedeemResult> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REDEEM_TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await fetch(ACTIVATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: formatKey(key), device: formatCode(cleanDevice(device)) }),
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: ctrl.signal,
      })
    } catch {
      return { ok: false, reason: 'offline' }        // no connection, a blocked request, or the time ran out
    }
    let body: { code?: unknown; error?: unknown; retryAfter?: unknown } | null = null
    try { body = await res.json() } catch { if (ctrl.signal.aborted) return { ok: false, reason: 'offline' } }
    if (!body || typeof body !== 'object') body = null
    if (res.ok) return typeof body?.code === 'string' && body.code ? { ok: true, code: body.code } : { ok: false, reason: 'server' }
    if (res.status === 429) {
      const wait = Number(body?.retryAfter ?? res.headers.get('Retry-After'))
      return { ok: false, reason: 'locked', ...(Number.isFinite(wait) && wait > 0 ? { retryAfter: Math.ceil(wait) } : {}) }
    }
    const reason = REFUSALS[res.status]?.find(r => r === body?.error)
    return { ok: false, reason: reason ?? 'server' }
  } finally {
    clearTimeout(timer)
  }
}

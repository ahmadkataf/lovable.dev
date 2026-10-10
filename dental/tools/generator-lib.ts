// Seller-side helpers shared by the code generator CLI (scripts/code-generator.mjs) and the offline page
// (tools/code-generator.html). Never imported by the app. Plain TypeScript that Node 22.18+ runs directly.
// Codes are signed with the seller's PRIVATE key (license-private.jwk); the app only has the public key.
import {
  PUBLIC_KEY, checkCode, cleanCode, expiryDay, formatCode, packCode, signedMessage, PLANS, type CodeCheck, type Plan,
} from '../src/license/core.ts'

export { checkCode, formatCode, PLANS }
export type { CodeCheck, Plan }

/** The private key file as written by `node scripts/code-generator.mjs keygen`. */
export interface PrivateKeyFile extends JsonWebKey { product?: string; created?: string }

/** Parses a key file and checks it is the private half of the key built into the app. */
export function parsePrivateKey(text: string): { ok: true; jwk: PrivateKeyFile } | { ok: false; reason: 'format' | 'mismatch' } {
  let jwk: PrivateKeyFile
  try { jwk = JSON.parse(text) } catch { return { ok: false, reason: 'format' } }
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d || !jwk.x || !jwk.y) return { ok: false, reason: 'format' }
  if (jwk.x !== PUBLIC_KEY.x || jwk.y !== PUBLIC_KEY.y) return { ok: false, reason: 'mismatch' }
  return { ok: true, jwk }
}
export async function importSigningKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

/** Seller side: the code for one device. `until` null = lifetime. */
export async function makeCode(device: string, plan: Plan, until: Date | null, signingKey: CryptoKey): Promise<string> {
  const day = expiryDay(until)
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, signedMessage(device, plan, day)))
  return packCode(plan, day, sig)
}

/** Characters the device number and the codes use (no 0/O or 1/I). */
const DEVICE_RE = /^[2-9A-HJ-NP-Z]{8}$/

/** What a device field shows while typing: upper case, grouped XXXX-XXXX. */
export function formatDeviceInput(raw: string): string {
  return formatCode(cleanCode(raw || '').slice(0, 8))
}
export function isDeviceNumber(s: string): boolean {
  return DEVICE_RE.test(cleanCode(s || ''))
}
export function isPlan(s: string): s is Plan {
  return (PLANS as string[]).includes(s)
}

export type Validity = '1y' | '2y' | 'lifetime' | 'date'
export const VALIDITIES: Validity[] = ['1y', '2y', 'lifetime', 'date']

/**
 * The last valid day of a code: '1y' / '2y' from today, 'lifetime' (null), or an explicit 'YYYY-MM-DD'.
 * Returns undefined for anything else (or a date in the past). Dates are UTC midnights, as the codes store days.
 */
export function parseUntil(v: string, now: Date = new Date()): Date | null | undefined {
  const s = (v || '').trim().toLowerCase()
  if (s === 'lifetime' || s === 'forever' || s === 'life') return null
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate()
  const years = /^(\d{1,2})y$/.exec(s)
  if (years) { const n = Number(years[1]); return n >= 1 ? new Date(Date.UTC(y + n, m, d)) : undefined }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!iso) return undefined
  const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
  if (date.getUTCFullYear() !== Number(iso[1]) || date.getUTCMonth() !== Number(iso[2]) - 1 || date.getUTCDate() !== Number(iso[3])) return undefined
  if (date.getTime() < Date.UTC(y, m, d)) return undefined
  return date
}
/** 'YYYY-MM-DD' of a code's last day, or null for lifetime. */
export function untilISO(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null
}

export interface Issued { code: string; device: string; plan: Plan; until: string | null }
/** Makes a code and checks it back with the app's own verifier, so a bad code can never be handed out. */
export async function issueCode(device: string, plan: Plan, until: Date | null, signingKey: CryptoKey, publicKey: JsonWebKey = PUBLIC_KEY): Promise<Issued> {
  if (!isDeviceNumber(device)) throw new Error('device')
  const dev = formatDeviceInput(device)
  const code = await makeCode(dev, plan, until, signingKey)
  const back = await checkCode(dev, code, new Date(), publicKey)
  if (!back.ok || back.plan !== plan) throw new Error('self-check')
  return { code, device: dev, plan, until: untilISO(until) }
}

/**
 * A date, device number or code inside Arabic text. Without a left-to-right mark in front, bidi turns 2027-10-10
 * into 10-10-2027 and a device number like 2345-ABCD into ABCD-2345 (digits after Arabic letters become separate
 * Arabic numbers). The mark is invisible in WhatsApp, e-mail and terminals.
 */
export const ltr = (s: string) => `\u200E${s}`

const PLAN_NAME = { ar: { standard: 'الباقة الأساسية', pro: 'الباقة الاحترافية' }, en: { standard: 'Standard plan', pro: 'Pro plan' } }
/** The ready-to-send message for the clinic. */
export function clinicMessage(i: Pick<Issued, 'code' | 'plan' | 'until' | 'device'>, lang: 'ar' | 'en' = 'ar', clinic = ''): string {
  if (lang === 'en') {
    return [
      `Hello${clinic ? ` ${clinic}` : ''},`,
      'Here is your Dentora activation code:',
      i.code,
      `${PLAN_NAME.en[i.plan]} — ${i.until ? `valid until ${i.until}` : 'lifetime license'}`,
      `Device number: ${i.device}`,
      'Open Settings → License, enter the code and press “Activate”. Thank you!',
    ].join('\n')
  }
  return [
    `مرحباً${clinic ? ` ${clinic}` : ''}،`,
    'هذا رمز تفعيل برنامج Dentora الخاص بكم:',
    ltr(i.code),
    `${PLAN_NAME.ar[i.plan]} — ${i.until ? `صالح حتى ${ltr(i.until)}` : 'ترخيص دائم'}`,
    `رقم الجهاز: ${ltr(i.device)}`,
    'افتحوا الإعدادات ← الترخيص، وأدخلوا الرمز ثم اضغطوا «تفعيل». شكراً لثقتكم!',
  ].join('\n')
}

// ---- the local log of issued codes ----------------------------------------------------------------
export interface LogEntry extends Issued { at: string; note: string }
export const LOG_KEY = 'dentora.generator.log'

export function parseLog(raw: string | null): LogEntry[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter(e => e && typeof e.code === 'string' && typeof e.device === 'string') : []
  } catch { return [] }
}
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
/** CSV with a BOM so Excel opens Arabic notes correctly. */
export function toCSV(rows: LogEntry[]): string {
  const head = ['issued_at', 'device', 'plan', 'valid_until', 'code', 'note']
  const lines = rows.map(r => [r.at, r.device, r.plan, r.until ?? 'lifetime', r.code, r.note].map(csvCell).join(','))
  return '﻿' + [head.join(','), ...lines].join('\r\n')
}

/** wa.me link for the clinic's number; local numbers starting with 0 get the default country code. */
export function waLink(phone: string, text: string, defaultCountry = '963'): string {
  let d = (phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '')
  if (d.startsWith('0')) d = defaultCountry + d.slice(1)
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}

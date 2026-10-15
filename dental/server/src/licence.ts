// Making and checking codes with the seller's own library (tools/generator-lib.ts on top of the app's
// src/license/core.ts), so every code the panel (or a key's activation) hands out is byte-for-byte what the app
// accepts, and is checked back with the app's verifier before it is saved. The private key comes from the
// LICENSE_PRIVATE_JWK secret and stays in this isolate's memory: nothing returns it, logs it or stores it.
// Licence keys (docs/LICENCE-KEYS.md) are plain random strings in the codes' alphabet; they are not signed.
import {
  checkCode, checkResetCode, clinicMessage, formatDeviceInput, importSigningKey, issueCode, issueResetCode, ltr,
  parsePrivateKey, parseUntil, resetClinicMessage, waLink, type Issued, type IssuedReset,
} from '../../tools/generator-lib.ts'
import { cleanCode, codeKind, dayISO, extractCode, formatCode, PUBLIC_KEY, RESET_VALID_DAYS, toBase32, type Plan } from '../../src/license/core.ts'
import { ORIGIN, type CustomerMessage, type Env, type KeyStatus, type Lang, type Licence, type ResetCode, type VerifyResult } from './types'

export { formatDeviceInput, isDeviceNumber, isPlan, parseUntil, VALIDITIES } from '../../tools/generator-lib.ts'

export type SigningError = 'missing' | 'format' | 'mismatch'
export type Signer = { ok: true; key: CryptoKey } | { ok: false; error: SigningError }

/** Reads the key secret: missing, not a P-256 private key (format), or not the key the app trusts (mismatch). */
export async function loadSigner(text: string | undefined): Promise<Signer> {
  const raw = (text ?? '').trim()
  if (!raw) return { ok: false, error: 'missing' }
  const parsed = parsePrivateKey(raw)
  if (!parsed.ok) return { ok: false, error: parsed.reason }
  let key: CryptoKey
  try { key = await importSigningKey(parsed.jwk) } catch { return { ok: false, error: 'format' } }
  // x/y match the app's public key; a probe signature proves d does too, so a damaged secret shows in the panel
  // (signing: false) instead of failing on the first sale.
  try { await issueResetCode('23456789', key) } catch { return { ok: false, error: 'mismatch' } }
  return { ok: true, key }
}

let cached: { text: string | undefined; signer: Promise<Signer> } | null = null
/** The signer of this isolate (secrets only change with a new deployment, which starts new isolates). */
export function getSigner(env: Env): Promise<Signer> {
  if (!cached || cached.text !== env.LICENSE_PRIVATE_JWK) cached = { text: env.LICENSE_PRIVATE_JWK, signer: loadSigner(env.LICENSE_PRIVATE_JWK) }
  return cached.signer
}

/** An activation code for a device; `publicKey` is only overridden by tests (which sign with a throwaway key). */
export function makeActivation(key: CryptoKey, device: string, plan: Plan, until: Date | null, publicKey: JsonWebKey = PUBLIC_KEY): Promise<Issued> {
  return issueCode(device, plan, until, key, publicKey)
}
/** A PIN reset code for a device, dated today (UTC). */
export function makeReset(key: CryptoKey, device: string, now = new Date(), publicKey: JsonWebKey = PUBLIC_KEY): Promise<IssuedReset> {
  return issueResetCode(device, key, now, publicKey)
}

/** wa.me link to a customer's number, or null when the number is too short or long to be one. */
export function whatsappTo(phone: string, text: string): string | null {
  const digits = (phone || '').replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 ? waLink(phone, text) : null
}
/** The ready-to-send message of a sale: its code, or the key while no device has activated it. The wa.me link carries the Arabic one. */
export function licenceMessage(l: Licence): CustomerMessage {
  if (isWaitingKey(l)) return keyMessage(l)
  const name = l.clinic || l.customer
  const ar = clinicMessage(l, 'ar', name), en = clinicMessage(l, 'en', name)
  return { ar, en, whatsappUrl: whatsappTo(l.phone, ar) }
}
/** The message that sells a key: the key, the plan and its term, and the two ways to activate it. */
export function keyMessage(l: Licence): CustomerMessage {
  const name = l.clinic || l.customer
  const ar = keyClinicMessage(l, 'ar', name), en = keyClinicMessage(l, 'en', name)
  return { ar, en, whatsappUrl: whatsappTo(l.phone, ar) }
}
export function resetMessage(r: ResetCode): CustomerMessage {
  const ar = resetClinicMessage(r, 'ar', r.customer), en = resetClinicMessage(r, 'en', r.customer)
  return { ar, en, whatsappUrl: whatsappTo(r.phone, ar) }
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
/** Checks a code (or a whole pasted message) for a device with the app's own checkers. */
export async function verifyCode(device: string, code: string, now = new Date(), publicKey: JsonWebKey = PUBLIC_KEY): Promise<VerifyResult> {
  const dev = formatDeviceInput(device)
  const kind = codeKind(extractCode(code))
  if (kind === 'activation') {
    const r = await checkCode(dev, code, now, publicKey)
    if (r.ok) return { kind, ok: true, plan: r.plan, until: iso(r.until) }
    return r.reason === 'expired' ? { kind, ok: false, reason: r.reason, plan: r.plan, until: iso(r.until) } : { kind, ok: false, reason: r.reason }
  }
  if (kind === 'reset') {
    const r = await checkResetCode(dev, code, now, publicKey)
    return r.ok ? { kind, ok: true, until: dayISO(r.day + RESET_VALID_DAYS - 1) } : { kind, ok: false, reason: r.reason }
  }
  return { kind: null, ok: false, reason: 'format' }
}

// ---- licence keys --------------------------------------------------------------------------------------------------
/** A key: 16 characters of the codes' alphabet (no 0/O/1/I), 80 random bits, shown XXXX-XXXX-XXXX-XXXX. */
const KEY_RE = /^[2-9A-HJ-NP-Z]{16}$/
/** A new random key (10 random bytes are exactly 16 characters of base32). */
export const newKey = () => formatCode(toBase32(crypto.getRandomValues(new Uint8Array(10))))
/**
 * The key in what was typed, as stored ("XXXX-XXXX-XXXX-XXXX"): any case, with or without dashes and spaces,
 * Arabic-Indic digits allowed (cleaned like the app cleans a code). Null when it is not one.
 */
export function cleanKey(input: string): string | null {
  const c = cleanCode(input)
  return KEY_RE.test(c) ? formatCode(c) : null
}
/** A key sold but not activated on any device yet. */
export const isWaitingKey = (l: Pick<Licence, 'key' | 'device'>) => l.key !== null && l.device === ''

/**
 * The last day of the code a key makes when activated at `now` (null = lifetime): 1y/2y count from the activation
 * day (UTC) with parseUntil's arithmetic; 'date' is the day chosen at sale. Undefined when the key can no longer be
 * activated: a 'date' key after its day.
 */
export function keyUntil(l: Pick<Licence, 'validity' | 'until'>, now = new Date()): Date | null | undefined {
  return parseUntil((l.validity === 'date' ? l.until : l.validity) ?? '', now)
}

const PLAN_NAME = { ar: { standard: 'الباقة الأساسية', pro: 'الباقة الاحترافية' }, en: { standard: 'Standard plan', pro: 'Pro plan' } }
/** What the key gives: "lifetime", "one year from activation", "until 2027-12-31". */
function keyTerm(l: Pick<Licence, 'validity' | 'until'>, lang: Lang): string {
  if (lang === 'en') {
    return l.validity === '1y' ? 'valid for one year from activation' : l.validity === '2y' ? 'valid for two years from activation'
      : l.until ? `valid until ${l.until}` : 'lifetime licence'
  }
  return l.validity === '1y' ? 'صالح لسنة واحدة من يوم التفعيل' : l.validity === '2y' ? 'صالح لسنتين من يوم التفعيل'
    : l.until ? `صالح حتى ${ltr(l.until)}` : 'ترخيص دائم'
}
/** The clinic's message for a key, in the shape of the code message (tools/generator-lib.ts clinicMessage). */
export function keyClinicMessage(l: Pick<Licence, 'key' | 'plan' | 'validity' | 'until'>, lang: Lang, clinic = ''): string {
  const key = l.key ?? ''
  if (lang === 'en') {
    return [
      `Hello${clinic ? ` ${clinic}` : ''},`,
      'Here is your Dentora licence key:',
      key,
      `${PLAN_NAME.en[l.plan]} — ${keyTerm(l, 'en')}`,
      'To activate (Dentora 1.1.0 or later): open Dentora, go to Settings → Licence, paste the key and press “Activate”. This needs an internet connection once, and only the key and the device number are sent.',
      'Or, with any version, activate it from any device connected to the internet on the page below: enter the key and the device number shown in Settings → Licence, then paste the activation code the page gives you into Dentora.',
      `${ORIGIN}/en/activate`,
      'The key works on one device only. Thank you!',
    ].join('\n')
  }
  return [
    `مرحباً${clinic ? ` ${clinic}` : ''}،`,
    'هذا مفتاح ترخيص برنامج Dentora الخاص بكم:',
    ltr(key),
    `${PLAN_NAME.ar[l.plan]} — ${keyTerm(l, 'ar')}`,
    'للتفعيل (في الإصدار 1.1.0 فما بعده): افتحوا Dentora ثم الإعدادات ← الترخيص، والصقوا المفتاح واضغطوا «تفعيل». يتطلب ذلك اتصالاً بالإنترنت مرة واحدة فقط، ولا يُرسَل سوى المفتاح ورقم الجهاز.',
    'أو، مع أي إصدار، فعّلوه من أي جهاز متصل بالإنترنت عبر الصفحة التالية: أدخلوا المفتاح ورقم الجهاز الظاهر في الإعدادات ← الترخيص، ثم الصقوا في البرنامج رمز التفعيل الذي تعرضه الصفحة.',
    `${ORIGIN}/activate`,
    'يعمل المفتاح على جهاز واحد فقط. شكراً لثقتكم!',
  ].join('\n')
}

/**
 * POST /api/verify for a key: where it stands, and what is known of it. `ok` = waiting or activated, not refunded or
 * void, and not past its last day (reason 'expired': a waiting 'date' key can no longer be activated, an activated
 * key's code has ended). A waiting 1y/2y key has no `until` yet.
 */
export function verifyKey(l: Licence | null, now = new Date()): VerifyResult {
  if (!l || !l.key) return { kind: 'key', ok: false, status: 'unknown' }
  const waiting = l.device === ''
  const status: KeyStatus = l.status !== 'active' ? l.status : waiting ? 'pending' : 'activated'
  const out: VerifyResult = { kind: 'key', ok: status === 'pending' || status === 'activated', status, plan: l.plan }
  if (l.validity) out.validity = l.validity
  if (!waiting || l.validity === 'lifetime' || l.validity === 'date') out.until = l.until
  if (!waiting) { out.device = l.device; if (l.activatedAt) out.activatedAt = l.activatedAt }
  if (out.ok && l.until && l.until < now.toISOString().slice(0, 10)) { out.ok = false; out.reason = 'expired' }
  return out
}

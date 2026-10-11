// Making and checking codes with the seller's own library (tools/generator-lib.ts on top of the app's
// src/license/core.ts), so every code the panel hands out is byte-for-byte what the app accepts, and is checked back
// with the app's verifier before it is saved. The private key comes from the LICENSE_PRIVATE_JWK secret and stays
// in this isolate's memory: nothing returns it, logs it or stores it.
import {
  checkCode, checkResetCode, clinicMessage, formatDeviceInput, importSigningKey, issueCode, issueResetCode,
  parsePrivateKey, resetClinicMessage, waLink, type Issued, type IssuedReset,
} from '../../tools/generator-lib.ts'
import { codeKind, dayISO, extractCode, PUBLIC_KEY, RESET_VALID_DAYS, type Plan } from '../../src/license/core.ts'
import type { CustomerMessage, Env, Licence, ResetCode } from './types'

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
/** The ready-to-send message of a licence; the wa.me link carries the Arabic one. */
export function licenceMessage(l: Licence): CustomerMessage {
  const name = l.clinic || l.customer
  const ar = clinicMessage(l, 'ar', name), en = clinicMessage(l, 'en', name)
  return { ar, en, whatsappUrl: whatsappTo(l.phone, ar) }
}
export function resetMessage(r: ResetCode): CustomerMessage {
  const ar = resetClinicMessage(r, 'ar', r.customer), en = resetClinicMessage(r, 'en', r.customer)
  return { ar, en, whatsappUrl: whatsappTo(r.phone, ar) }
}

/** What POST /api/verify answers. `until`: an activation code's last day (null = lifetime), a reset code's last day. */
export interface VerifyResult {
  kind: 'activation' | 'reset' | null
  ok: boolean
  plan?: Plan
  until?: string | null
  reason?: 'format' | 'device' | 'kind' | 'expired'
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

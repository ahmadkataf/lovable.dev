// Activation codes that need no server, and that cannot be forged from the app.
//
// The clinic shows a device number; the seller signs (device, plan, last day) with a PRIVATE key that never
// leaves the seller (secrets-for-user/dentora/license-private.jwk) and sends the code. The app only holds the
// PUBLIC key below, which can check a signature but cannot make one: reading the app's code or this
// repository does not let anyone produce a valid code.
//
// Code layout (70 bytes → 112 characters of base32, shown in groups of 4):
//   [version 2][plan][last day, 2 bytes][ECDSA P-256 / SHA-256 signature, 64 bytes][CRC-16 of the 68 bytes before]
// The CRC tells a mistyped code (format) apart from a code made for another device (device).
// Signed message: "dentora|2|<device 8 chars>|<plan byte>|<day>".

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'   // no 0/O or 1/I
export const CODE_VERSION = 2
const EPOCH = Date.UTC(2026, 0, 1)
const DAY = 86_400_000
export const PRODUCT = 'dentora'
export const CODE_BYTES = 70
export const CODE_CHARS = 112

/** The public half of the seller's licence key (P-256). Replacing it invalidates every code issued so far. */
export const PUBLIC_KEY: JsonWebKey = {
  kty: 'EC', crv: 'P-256',
  x: 'zIHBaaLrDksS5MVO2PHPk2UZo8bj9RN51MATYL3YHyE',
  y: 'wX7L7HdbN--A3cHj7QuIsi_rmvlHBOW3mBhYwkAROcQ',
}

export type Plan = 'standard' | 'pro'
export const PLANS: Plan[] = ['standard', 'pro']
export const PLAN_CODE: Record<Plan, number> = { standard: 1, pro: 2 }

const enc = new TextEncoder()
async function sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> { return new Uint8Array(await crypto.subtle.digest('SHA-256', data)) }

export function toBase32(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = ''
  for (const b of bytes) { value = ((value << 8) | b) & 0xffff; bits += 8; while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 } }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}
export function fromBase32(s: string): Uint8Array<ArrayBuffer> | null {
  let bits = 0, value = 0; const out: number[] = []
  for (const ch of s) { const i = ALPHABET.indexOf(ch); if (i < 0) return null; value = ((value << 5) | i) & 0xffff; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 } }
  return new Uint8Array(out)
}
/** CRC-16/CCITT-FALSE: catches any single mistyped character. */
export function crc16(bytes: Uint8Array): number {
  let crc = 0xffff
  for (const b of bytes) { crc ^= b << 8; for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff }
  return crc
}

/** Upper case, Arabic-Indic digits as Latin, without the spaces, dashes and line breaks people add. */
export const cleanCode = (s: string) => (s || '')
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .toUpperCase().replace(/[^0-9A-Z]/g, '')
export const formatCode = (s: string) => (s.match(/.{1,4}/g) || []).join('-')
export const cleanDevice = (s: string) => cleanCode(s).slice(0, 8)

/** The device number shown in Settings → License: 8 characters, stable for this installation. */
export async function deviceNumber(rawId: string): Promise<string> {
  return formatCode(toBase32(await sha256(enc.encode(`device:${PRODUCT}:${rawId}`))).slice(0, 8))
}
export const expiryDay = (date: Date | null) => (date ? Math.max(1, Math.floor((date.getTime() - EPOCH) / DAY)) : 0)
export const expiryDate = (day: number) => (day ? new Date(EPOCH + day * DAY) : null)

/** The exact bytes the seller signs for one device, plan and last day. */
export function signedMessage(device: string, plan: Plan, day: number): Uint8Array<ArrayBuffer> {
  return enc.encode(`${PRODUCT}|${CODE_VERSION}|${cleanDevice(device)}|${PLAN_CODE[plan]}|${day}`)
}
/** Packs a signature into the code the clinic types or pastes. */
export function packCode(plan: Plan, day: number, signature: Uint8Array): string {
  if (signature.length !== 64) throw new Error('signature must be 64 bytes (r‖s)')
  const bytes = new Uint8Array(CODE_BYTES)
  bytes[0] = CODE_VERSION; bytes[1] = PLAN_CODE[plan]; bytes[2] = day >> 8; bytes[3] = day & 255
  bytes.set(signature, 4)
  const crc = crc16(bytes.subarray(0, CODE_BYTES - 2))
  bytes[CODE_BYTES - 2] = crc >> 8; bytes[CODE_BYTES - 1] = crc & 255
  return formatCode(toBase32(bytes))
}

let verifyKey: Promise<CryptoKey> | null = null
function importVerifyKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
}

export type CodeCheck = { ok: true; plan: Plan; until: Date | null } | { ok: false; reason: 'format' | 'device' | 'expired' }

/** App side: does this code open Dentora on this device today? `publicKey` is only overridden by tests. */
export async function checkCode(device: string, code: string, now = new Date(), publicKey: JsonWebKey = PUBLIC_KEY): Promise<CodeCheck> {
  const c = cleanCode(code)
  const bytes = c.length === CODE_CHARS ? fromBase32(c) : null
  if (!bytes || bytes.length !== CODE_BYTES || bytes[0] !== CODE_VERSION) return { ok: false, reason: 'format' }
  const crc = crc16(bytes.subarray(0, CODE_BYTES - 2))
  if (bytes[CODE_BYTES - 2] !== crc >> 8 || bytes[CODE_BYTES - 1] !== (crc & 255)) return { ok: false, reason: 'format' }
  const plan = (Object.keys(PLAN_CODE) as Plan[]).find(p => PLAN_CODE[p] === bytes[1])
  if (!plan) return { ok: false, reason: 'format' }
  const day = (bytes[2] << 8) | bytes[3]
  const key = publicKey === PUBLIC_KEY ? (verifyKey ??= importVerifyKey(PUBLIC_KEY)) : importVerifyKey(publicKey)
  let valid = false
  try { valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await key, bytes.slice(4, 68), signedMessage(device, plan, day)) }
  catch { valid = false }
  if (!valid) return { ok: false, reason: 'device' }
  const until = expiryDate(day)
  if (until && now.getTime() > until.getTime() + DAY) return { ok: false, reason: 'expired' }
  return { ok: true, plan, until }
}

export const TRIAL_DAYS = 7

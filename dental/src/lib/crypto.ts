const enc = new TextEncoder()
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('')

export async function sha256Hex(s: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))))
}
export function randomHex(bytes = 16): string {
  const b = new Uint8Array(bytes); crypto.getRandomValues(b)
  return hex(b)
}

// ---- PINs ---------------------------------------------------------------------------------------------------
// A PIN is stored as PBKDF2-HMAC-SHA256 over a per-user random salt, written as
//   "pbkdf2-sha256$<iterations>$<pin length>$<hex>"
// The length lets the sign-in screen go on by itself once the user's number of digits is typed (a PIN is 4–6
// digits, so it says almost nothing to an attacker). Older installations stored SHA-256(salt:pin) as 64 hex
// characters: those still sign in, and are rewritten in the new form at that sign-in (see needsRehash).

/** Work factor of new PIN hashes: about 0.1 s on a desktop and well under a second on a modest phone. */
export const PIN_ITERATIONS = 200_000
const PREFIX = 'pbkdf2-sha256'
const LEGACY = /^[0-9a-f]{64}$/

interface Parsed { iterations: number; length: number; hash: string }
function parse(stored: string): Parsed | null {
  const m = /^pbkdf2-sha256\$(\d{1,8})\$(\d)\$([0-9a-f]{64})$/.exec(stored || '')
  if (!m) return null
  const iterations = Number(m[1]), length = Number(m[2])
  return iterations > 0 ? { iterations, length, hash: m[3] } : null
}

async function pbkdf2(pin: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256)
  return hex(new Uint8Array(bits))
}
/** Compares two strings in time that does not depend on where they differ. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

/** The stored form of a PIN for a user's salt (see the format above). */
export async function hashPin(pin: string, salt: string, iterations = PIN_ITERATIONS): Promise<string> {
  const p = pin.trim()
  return `${PREFIX}$${iterations}$${p.length}$${await pbkdf2(p, salt, iterations)}`
}
/** True when `pin` is the PIN behind `stored` (new PBKDF2 form or the older SHA-256 form). */
export async function verifyPin(pin: string, salt: string, stored: string): Promise<boolean> {
  const p = pin.trim()
  const parsed = parse(stored)
  if (parsed) return p.length === parsed.length && sameText(await pbkdf2(p, salt, parsed.iterations), parsed.hash)
  if (LEGACY.test(stored || '')) return sameText(await sha256Hex(`${salt}:${p}`), stored)
  return false
}
/** A hash that should be rewritten after the next successful sign-in: the old SHA-256 form, or fewer iterations than today. */
export function needsRehash(stored: string): boolean {
  const parsed = parse(stored)
  return !parsed || parsed.iterations < PIN_ITERATIONS
}
/** How many digits the PIN behind `stored` has, or null when the hash does not say (older installations). */
export function pinLengthOf(stored: string | undefined): number | null {
  const parsed = parse(stored || '')
  return parsed && parsed.length >= 4 && parsed.length <= 6 ? parsed.length : null
}
export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin.trim())

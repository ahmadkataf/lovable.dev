// Passwords and encryption, all with the browser's own WebCrypto: nothing leaves the device.

const enc = new TextEncoder()
const dec = new TextDecoder()

function toHex(bytes: ArrayBuffer | Uint8Array): string { return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('') }
function fromHex(hex: string): Uint8Array<ArrayBuffer> { const bytes = (hex.match(/../g) ?? []).map(h => parseInt(h, 16)); const u = new Uint8Array(new ArrayBuffer(bytes.length)); u.set(bytes); return u }
function toB64(bytes: ArrayBuffer | Uint8Array): string { const u = new Uint8Array(bytes); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }
function fromB64(s: string): Uint8Array<ArrayBuffer> { const bin = atob(s); const u = new Uint8Array(new ArrayBuffer(bin.length)); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u }

export const PIN_ITERATIONS = 150000

/** A PIN is stored as PBKDF2-SHA256 with a random salt: a stolen database does not give away the PINs. */
export async function hashPin(pin: string, salt?: string, iterations = PIN_ITERATIONS): Promise<{ hash: string; salt: string; iterations: number }> {
  const s = salt ?? toHex(crypto.getRandomValues(new Uint8Array(16)))
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(s), iterations }, key, 256)
  return { hash: toHex(bits), salt: s, iterations }
}

export async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

/** Checks a PIN against a user record; old records (plain SHA-256, before salting) are still accepted. */
export async function verifyPin(pin: string, user: { pinHash: string; pinSalt?: string; pinIterations?: number }): Promise<boolean> {
  if (user.pinSalt) return (await hashPin(pin, user.pinSalt, user.pinIterations ?? PIN_ITERATIONS)).hash === user.pinHash
  return (await sha256Hex(pin)) === user.pinHash
}

const MAGIC = 'ALRADWAN-ENC-1'

/** Encrypts a text with a password (PBKDF2 → AES-256-GCM). The result is a small JSON envelope. */
export async function encryptText(text: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 200000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
  return JSON.stringify({ magic: MAGIC, salt: toHex(salt), iv: toHex(iv), data: toB64(data) })
}

export function isEncrypted(text: string): boolean {
  const head = text.slice(0, 64)
  return head.includes(MAGIC)
}

export async function decryptText(envelope: string, password: string): Promise<string> {
  const e = JSON.parse(envelope) as { magic: string; salt: string; iv: string; data: string }
  if (e.magic !== MAGIC) throw new Error('الملف ليس نسخة مشفّرة')
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(e.salt), iterations: 200000 }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
  try {
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromHex(e.iv) }, key, fromB64(e.data))
    return dec.decode(data)
  } catch {
    throw new Error('كلمة السر غير صحيحة')
  }
}

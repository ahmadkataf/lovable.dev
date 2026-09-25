// Activation codes that work with no server and no internet.
//
// Each phone shows a short device number. The seller turns it into a 16-character code for one app
// (Grade 8, 11 or 12) with the code generator; the app checks the code by itself. A code only opens
// the app it was made for, on the phone it was made for, until the date written inside it.
//
// Code layout (10 bytes, written as 16 characters): [version][expiry day, 2 bytes][7-byte signature].
// The signature is an HMAC over the app, the device number and the expiry, keyed per app.

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'   // no 0/O or 1/I, so it can be read out and typed
const VERSION = 1
const EPOCH = Date.UTC(2025, 0, 1)                  // expiry is stored as days after this date; 0 = never
const DAY = 86400000
// Shared by the apps and the seller's code generator. Changing it invalidates every code already sold.
const MASTER = 'emar-3f9c1d7a52b84e06a1c7d2e95b40f8a6-2025'

const enc = new TextEncoder()

async function sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
}
async function hmac(key: Uint8Array<ArrayBuffer>, msg: string): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))
}
const appKey = (bookId: string) => sha256(enc.encode(`${MASTER}:${bookId}`))

function toBase32(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = ''
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}
function fromBase32(s: string): Uint8Array | null {
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of s) {
    const i = ALPHABET.indexOf(ch)
    if (i < 0) return null
    value = (value << 5) | i; bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return new Uint8Array(out)
}

/** Upper case, without the spaces and dashes people add when they copy or type a code. */
export function cleanCode(s: string): string {
  return s.toUpperCase().replace(/[^0-9A-Z]/g, '')
}
export function formatCode(s: string): string { return (s.match(/.{1,4}/g) || []).join('-') }

/** The device number shown to the student: 8 characters, the same every time on this phone for this app. */
export async function deviceNumber(bookId: string, rawId: string): Promise<string> {
  const h = await sha256(enc.encode(`device:${bookId}:${rawId}`))
  return formatCode(toBase32(h).slice(0, 8))
}
export function cleanDevice(s: string): string { return cleanCode(s).slice(0, 8) }

export function expiryDay(date: Date | null): number {
  return date ? Math.max(1, Math.floor((date.getTime() - EPOCH) / DAY)) : 0
}
export function expiryDate(day: number): Date | null { return day ? new Date(EPOCH + day * DAY) : null }

async function signature(bookId: string, device: string, day: number): Promise<Uint8Array> {
  return (await hmac(await appKey(bookId), `EMAR|${VERSION}|${bookId}|${cleanDevice(device)}|${day}`)).slice(0, 7)
}

/** Seller side: the code for one app on one phone. `until` null means it never expires. */
export async function makeCode(bookId: string, device: string, until: Date | null): Promise<string> {
  const day = expiryDay(until)
  const bytes = new Uint8Array(10)
  bytes[0] = VERSION; bytes[1] = day >> 8; bytes[2] = day & 255
  bytes.set(await signature(bookId, device, day), 3)
  return formatCode(toBase32(bytes))
}

export type CodeCheck = { ok: true; until: Date | null } | { ok: false; reason: 'format' | 'device' | 'expired' }

/** App side: is this code valid for this app on this phone today? */
export async function checkCode(bookId: string, device: string, code: string, now = new Date()): Promise<CodeCheck> {
  const c = cleanCode(code)
  const bytes = c.length === 16 ? fromBase32(c) : null
  if (!bytes || bytes.length !== 10 || bytes[0] !== VERSION) return { ok: false, reason: 'format' }
  const day = (bytes[1] << 8) | bytes[2]
  const want = await signature(bookId, device, day)
  let same = true
  for (let i = 0; i < 7; i++) if (want[i] !== bytes[3 + i]) same = false
  if (!same) return { ok: false, reason: 'device' }
  const until = expiryDate(day)
  if (until && now.getTime() > until.getTime() + DAY) return { ok: false, reason: 'expired' }
  return { ok: true, until }
}

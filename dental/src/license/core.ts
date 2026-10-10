// Activation codes that need no server: the clinic shows a device number, the seller turns it into a
// 16-character code with the generator (scripts/code-generator), the app checks it offline.
// Code layout (10 bytes → 16 chars of base32): [version][plan][expiry day, 2 bytes][6-byte HMAC].
// Changing MASTER invalidates every code sold so far.

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'   // no 0/O or 1/I
const VERSION = 1
const EPOCH = Date.UTC(2026, 0, 1)
const DAY = 86_400_000
const MASTER = 'dentora-8c41f2a9e7b34d06-5f1e9c7a2b84-2026'
export const PRODUCT = 'dentora'

export type Plan = 'standard' | 'pro'
export const PLANS: Plan[] = ['standard', 'pro']
const PLAN_CODE: Record<Plan, number> = { standard: 1, pro: 2 }

const enc = new TextEncoder()
async function sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> { return new Uint8Array(await crypto.subtle.digest('SHA-256', data)) }
async function hmac(key: Uint8Array<ArrayBuffer>, msg: string): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))
}
const productKey = () => sha256(enc.encode(`${MASTER}:${PRODUCT}`))

function toBase32(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = ''
  for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 } }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}
function fromBase32(s: string): Uint8Array | null {
  let bits = 0, value = 0; const out: number[] = []
  for (const ch of s) { const i = ALPHABET.indexOf(ch); if (i < 0) return null; value = (value << 5) | i; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 } }
  return new Uint8Array(out)
}

export const cleanCode = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '')
export const formatCode = (s: string) => (s.match(/.{1,4}/g) || []).join('-')
export const cleanDevice = (s: string) => cleanCode(s).slice(0, 8)

/** The device number shown in Settings → License: 8 characters, stable for this installation. */
export async function deviceNumber(rawId: string): Promise<string> {
  return formatCode(toBase32(await sha256(enc.encode(`device:${PRODUCT}:${rawId}`))).slice(0, 8))
}
export const expiryDay = (date: Date | null) => (date ? Math.max(1, Math.floor((date.getTime() - EPOCH) / DAY)) : 0)
export const expiryDate = (day: number) => (day ? new Date(EPOCH + day * DAY) : null)

async function signature(device: string, plan: number, day: number): Promise<Uint8Array> {
  return (await hmac(await productKey(), `${PRODUCT}|${VERSION}|${cleanDevice(device)}|${plan}|${day}`)).slice(0, 6)
}

/** Seller side. `until` null = lifetime. */
export async function makeCode(device: string, plan: Plan, until: Date | null): Promise<string> {
  const day = expiryDay(until)
  const bytes = new Uint8Array(10)
  bytes[0] = VERSION; bytes[1] = PLAN_CODE[plan]; bytes[2] = day >> 8; bytes[3] = day & 255
  bytes.set(await signature(device, PLAN_CODE[plan], day), 4)
  return formatCode(toBase32(bytes))
}

export type CodeCheck = { ok: true; plan: Plan; until: Date | null } | { ok: false; reason: 'format' | 'device' | 'expired' }

/** App side: does this code open this product on this device today? */
export async function checkCode(device: string, code: string, now = new Date()): Promise<CodeCheck> {
  const c = cleanCode(code)
  const bytes = c.length === 16 ? fromBase32(c) : null
  if (!bytes || bytes.length !== 10 || bytes[0] !== VERSION) return { ok: false, reason: 'format' }
  const planCode = bytes[1]
  const plan = (Object.keys(PLAN_CODE) as Plan[]).find(p => PLAN_CODE[p] === planCode)
  if (!plan) return { ok: false, reason: 'format' }
  const day = (bytes[2] << 8) | bytes[3]
  const want = await signature(device, planCode, day)
  let same = true
  for (let i = 0; i < 6; i++) if (want[i] !== bytes[4 + i]) same = false
  if (!same) return { ok: false, reason: 'device' }
  const until = expiryDate(day)
  if (until && now.getTime() > until.getTime() + DAY) return { ok: false, reason: 'expired' }
  return { ok: true, plan, until }
}

export const TRIAL_DAYS = 30

// Keys, tokens and the small pure helpers the API and the panel share.
//
// The signing key never leaves this worker: its Ed25519 seed is SHA-256(LICENSE_SECRET). The app ships
// with the public key only, so a license token can be made here and nowhere else.
import * as ed from '@noble/ed25519'

export const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'   // no 0/O/1/I: codes are read out loud
export const DAY = 86400000
export const SRV = 'kaseb'

export interface TokenPayload {
  v: 1
  code: string            // '' for a trial
  d: string               // device hash (hex)
  p: 'full' | 'trial'
  iat: number
  exp: number | null
  gr: number              // grace until: the app must reach /api/check before this time
  n: string               // the nonce the client sent
  srv: typeof SRV
}

// ---------- codes ----------
/** 12 characters of the alphabet, or null. Case, dashes and spaces are ignored. */
export function cleanCode(s: unknown): string | null {
  const c = String(s ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  return c.length === 12 && [...c].every(ch => ALPHABET.includes(ch)) ? c : null
}
export const formatCode = (c: string): string => `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`
export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return [...bytes].map(b => ALPHABET[b % 32]).join('')   // 32 divides 256: every character equally likely
}

// ---------- devices ----------
export const validDevice = (d: unknown): d is string => typeof d === 'string' && /^[a-f0-9]{64}$/.test(d)
export const validNonce = (n: unknown): n is string => typeof n === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(n)
export const validPlatform = (p: unknown): p is string => p === 'electron' || p === 'android' || p === 'web'

/** The short code the customer reads to the seller: base32 of the device hash, first 8 characters, XXXX-XXXX. */
export function deviceCodeOf(deviceHex: string): string {
  const bytes = hexToBytes(deviceHex.slice(0, 10))   // 8 base32 characters = 40 bits = 5 bytes
  let bits = 0, acc = 0, out = ''
  for (const b of bytes) {
    acc = (acc << 8) | b; bits += 8
    while (bits >= 5 && out.length < 8) { out += ALPHABET[(acc >>> (bits - 5)) & 31]; bits -= 5 }
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}`
}

/** Short text people type: control characters removed, trimmed, cut to n. */
export const clip = (v: unknown, n: number): string => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n)

// ---------- bytes ----------
const enc = new TextEncoder()
export const b64url = (bytes: Uint8Array): string => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const fromB64url = (s: string): Uint8Array => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), c => c.charCodeAt(0))
}
export const bytesToHex = (b: Uint8Array): string => [...b].map(x => x.toString(16).padStart(2, '0')).join('')
export const hexToBytes = (h: string): Uint8Array => {
  const out = new Uint8Array(Math.floor(h.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return out
}
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]
  return d === 0
}
export const sameText = (a: string, b: string): boolean => sameBytes(enc.encode(a), enc.encode(b))

// ---------- keys ----------
let cached: { secret: string; seed: Uint8Array; pub: Uint8Array } | null = null
/** The seed and public key for this LICENSE_SECRET (derived once per isolate). */
export async function keys(secret: string): Promise<{ seed: Uint8Array; pub: Uint8Array }> {
  if (cached && cached.secret === secret) return cached
  const seed = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(secret)))
  const pub = await ed.getPublicKeyAsync(seed)
  cached = { secret, seed, pub }
  return cached
}
export const publicKeyHex = async (secret: string): Promise<string> => bytesToHex((await keys(secret)).pub)

// ---------- tokens ----------
/** token = base64url(payloadJson) + '.' + base64url(ed25519(payloadBytes)) */
export async function signToken(secret: string, payload: TokenPayload): Promise<string> {
  const { seed } = await keys(secret)
  const bytes = enc.encode(JSON.stringify(payload))
  const sig = await ed.signAsync(bytes, seed)
  return `${b64url(bytes)}.${b64url(sig)}`
}
/** The payload of a token this server signed, or null (bad shape, bad signature, another service). */
export async function verifyToken(secret: string, token: unknown): Promise<TokenPayload | null> {
  if (typeof token !== 'string' || token.length > 4096) return null
  const dot = token.indexOf('.')
  if (dot <= 0 || token.indexOf('.', dot + 1) !== -1) return null
  try {
    const bytes = fromB64url(token.slice(0, dot))
    const sig = fromB64url(token.slice(dot + 1))
    if (sig.length !== 64) return null
    const { pub } = await keys(secret)
    if (!(await ed.verifyAsync(sig, bytes, pub))) return null
    const p = JSON.parse(new TextDecoder().decode(bytes)) as TokenPayload
    if (!p || p.v !== 1 || p.srv !== SRV || !validDevice(p.d) || (p.p !== 'full' && p.p !== 'trial')) return null
    if (typeof p.iat !== 'number' || typeof p.gr !== 'number' || (p.exp !== null && typeof p.exp !== 'number')) return null
    return p
  } catch { return null }
}

// ---------- versions ----------
/** Numeric compare of "1.2.3"-like versions: negative when a < b, 0 when equal, positive when a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = String(a).split(/[^0-9]+/).filter(Boolean).map(Number)
  const pb = String(b).split(/[^0-9]+/).filter(Boolean).map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

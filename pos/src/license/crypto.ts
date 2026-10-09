// Pure license helpers: codes, the device code, token parsing and verification, state derivation.
// No I/O here, so every rule is unit-tested (crypto.test.ts).
import { verifyAsync } from '@noble/ed25519'
import type { LicenseState } from './types'

export const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'   // no 0/O/1/I: codes are read out loud
export const SRV = 'kaseb'
export const HOUR = 3600000
export const ROLLBACK_SLACK = HOUR   // the clock may drift back this much before we suspect a rollback

export interface TokenPayload {
  v: 1
  code: string            // '' for a trial
  d: string               // device hash (hex)
  p: 'full' | 'trial'
  iat: number
  exp: number | null
  gr: number              // grace until
  n: string               // the nonce the client sent
  srv: typeof SRV
}

// ---------- codes ----------
/** The 12 characters of a code, or null when the text is not a complete code. Case, dashes and spaces are ignored. */
export function cleanCode(s: unknown): string | null {
  const c = String(s ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  return c.length === 12 && [...c].every(ch => ALPHABET.includes(ch)) ? c : null
}
export const formatCode = (c: string): string => `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`
/** What the code input shows while typing: uppercase, letters and digits only, a dash after every four, at most 12. */
export function formatTyping(s: string): string {
  const c = s.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 12)
  return c.replace(/(.{4})(?=.)/g, '$1-')
}

// ---------- bytes ----------
export const hexToBytes = (h: string): Uint8Array => {
  const clean = h.trim().toLowerCase()
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2) return new Uint8Array(0)
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}
export const bytesToHex = (b: Uint8Array): string => [...b].map(x => x.toString(16).padStart(2, '0')).join('')
export const b64url = (bytes: Uint8Array): string => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const fromB64url = (s: string): Uint8Array => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b + '='.repeat((4 - (b.length % 4)) % 4)), c => c.charCodeAt(0))
}

// ---------- device ----------
/** The short code shown to the user: base32 (our alphabet) of the device hash, first 8 characters, as XXXX-XXXX. */
export function deviceCodeOf(deviceHex: string): string {
  const bytes = hexToBytes(deviceHex.slice(0, 10))   // 8 base32 characters = 40 bits = 5 bytes
  let bits = 0, acc = 0, out = ''
  for (const b of bytes) {
    acc = (acc << 8) | b; bits += 8
    while (bits >= 5 && out.length < 8) { out += ALPHABET[(acc >>> (bits - 5)) & 31]; bits -= 5 }
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}`
}

// ---------- tokens ----------
/** Splits a token into its payload (parsed and shape-checked), the signed bytes and the signature. */
export function parseToken(token: unknown): { payload: TokenPayload; bytes: Uint8Array; sig: Uint8Array } | null {
  if (typeof token !== 'string' || token.length > 4096) return null
  const dot = token.indexOf('.')
  if (dot <= 0 || token.indexOf('.', dot + 1) !== -1) return null
  try {
    const bytes = fromB64url(token.slice(0, dot))
    const sig = fromB64url(token.slice(dot + 1))
    if (sig.length !== 64) return null
    const p = JSON.parse(new TextDecoder().decode(bytes)) as TokenPayload
    if (!p || typeof p !== 'object' || p.v !== 1 || p.srv !== SRV) return null
    if (typeof p.d !== 'string' || !/^[a-f0-9]{64}$/.test(p.d) || (p.p !== 'full' && p.p !== 'trial')) return null
    if (typeof p.code !== 'string' || typeof p.n !== 'string') return null
    if (typeof p.iat !== 'number' || typeof p.gr !== 'number' || (p.exp !== null && typeof p.exp !== 'number')) return null
    return { payload: p, bytes, sig }
  } catch { return null }
}

/**
 * The payload of a token signed by the server's key and made for this device, or null.
 * `nonce` is checked only when given (fresh responses); a stored token is verified without it.
 */
export async function verifyToken(token: unknown, publicKeyHex: string, device: string, nonce?: string): Promise<TokenPayload | null> {
  const t = parseToken(token)
  if (!t) return null
  const pub = hexToBytes(publicKeyHex)
  if (pub.length !== 32) return null
  try { if (!(await verifyAsync(t.sig, t.bytes, pub))) return null } catch { return null }
  if (t.payload.d !== device) return null
  if (nonce !== undefined && t.payload.n !== nonce) return null
  return t.payload
}

// ---------- state ----------
/** True when the clock went backwards by more than the slack since the newest time we ever saw. */
export const clockRolledBack = (now: number, maxSeenTime: number | undefined): boolean => !!maxSeenTime && now < maxSeenTime - ROLLBACK_SLACK

/** The state a valid token gives at `now`. `clockBad` = a clock rollback is suspected (locked until a check). */
export function deriveState(p: TokenPayload, now: number, clockBad = false): Extract<LicenseState, 'trial' | 'active' | 'expired' | 'locked'> {
  if (p.exp !== null && now >= p.exp) return 'expired'
  if (clockBad || now >= p.gr) return 'locked'
  return p.p === 'trial' ? 'trial' : 'active'
}

export const ERROR_KEYS = ['invalid_code', 'revoked', 'expired', 'device_limit', 'tampered', 'rate_limited', 'min_version', 'no_trial', 'invalid_token', 'device_mismatch', 'move_limit', 'network', 'unknown'] as const
export type ErrorKey = (typeof ERROR_KEYS)[number]
/** 'license.err.<key>' for a server error key, 'license.err.unknown' for anything else. */
export const errorMessageKey = (error: string): string => `license.err.${(ERROR_KEYS as readonly string[]).includes(error) ? error : 'unknown'}`

/** What a /api/check refusal means for the stored license (undefined = keep the state, just show the error). */
export function stateForCheckError(error: string): Extract<LicenseState, 'revoked' | 'expired' | 'tampered' | 'none'> | undefined {
  switch (error) {
    case 'revoked': return 'revoked'
    case 'expired': return 'expired'
    case 'device_mismatch': return 'revoked'
    case 'tampered': return 'tampered'
    case 'invalid_token': return 'none'
    default: return undefined
  }
}

/** A random nonce for one request. */
export function newNonce(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

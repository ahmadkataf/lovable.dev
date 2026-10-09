// Admin password (PBKDF2) and session tokens, on WebCrypto so the same code runs on Workers and Node.
import type { Database } from './db'
import { getKV, setKV } from './db'

const enc = new TextEncoder()
const toHex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('')
const randomHex = (n: number) => toHex(crypto.getRandomValues(new Uint8Array(n)).buffer as ArrayBuffer)

async function derive(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 }, key, 256)
  return toHex(bits)
}

export async function hasPassword(db: Database) {
  return !!(await getKV(db, 'admin_password'))
}

export async function setPassword(db: Database, password: string) {
  const salt = randomHex(16)
  const hash = await derive(password, salt)
  await setKV(db, 'admin_password', `${salt}:${hash}`)
}

export async function verifyPassword(db: Database, password: string) {
  const stored = await getKV(db, 'admin_password')
  if (!stored) return false
  const [salt, hash] = stored.split(':')
  const got = await derive(password, salt)
  if (got.length !== hash.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i)
  return diff === 0
}

const SESSION_DAYS = 30

export async function createSession(db: Database) {
  const token = randomHex(32)
  const expires = Date.now() + SESSION_DAYS * 86400000
  await db.prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()).run()
  await db.prepare('INSERT INTO sessions (token, expires) VALUES (?, ?)').bind(token, expires).run()
  return token
}

export async function checkSession(db: Database, req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return false
  const row = await db.prepare('SELECT expires FROM sessions WHERE token = ?').bind(token).first<{ expires: number }>()
  return !!row && row.expires > Date.now()
}

export async function destroySession(db: Database, req: Request) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
}

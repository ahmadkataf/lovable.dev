// The owner's recovery code: shown once at setup (and whenever the owner makes a new one), kept only as a
// salted PBKDF2 hash in the settings. It is the way back in when the owner forgets the PIN.
import { hashPin, verifyPin } from './crypto'

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'   // 32 letters: a byte % 32 is unbiased; no 0/O, 1/I

export function newRecoveryCode(): string {
  const s = [...crypto.getRandomValues(new Uint8Array(12))].map(b => ALPHABET[b % 32]).join('')
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
}
export const cleanRecovery = (c: string) => c.toUpperCase().replace(/[^0-9A-Z]/g, '')

export async function hashRecovery(code: string): Promise<{ hash: string; salt: string; iterations: number }> {
  return hashPin(cleanRecovery(code))
}
export async function checkRecovery(code: string, rec: { hash: string; salt: string; iterations: number }): Promise<boolean> {
  const c = cleanRecovery(code)
  if (c.length !== 12) return false
  return verifyPin(c, { pinHash: rec.hash, pinSalt: rec.salt, pinIterations: rec.iterations })
}

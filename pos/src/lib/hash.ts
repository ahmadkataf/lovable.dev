const enc = new TextEncoder()
export async function sha256Hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(s))
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')
}
const PIN_SALT = 'kasher-pin-v1:'
export const hashPin = (pin: string): Promise<string> => sha256Hex(PIN_SALT + pin.trim())
export async function checkPin(pin: string, hash?: string): Promise<boolean> {
  if (!hash) return true
  return (await hashPin(pin)) === hash
}

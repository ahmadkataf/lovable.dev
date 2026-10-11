const enc = new TextEncoder()
export async function sha256Hex(s: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))
  return Array.from(h, b => b.toString(16).padStart(2, '0')).join('')
}
export function randomHex(bytes = 16): string {
  const b = new Uint8Array(bytes); crypto.getRandomValues(b)
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('')
}
/** PIN storage: a per-user salt and SHA-256(salt:pin). Good enough for a local PIN; never sent anywhere. */
export async function hashPin(pin: string, salt: string): Promise<string> { return sha256Hex(`${salt}:${pin.trim()}`) }
export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> { return (await hashPin(pin, salt)) === hash }
export const isValidPin = (pin: string) => /^\d{4,6}$/.test(pin.trim())

const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz'
/** A short unique id: time (sortable) + 8 random characters. */
export function uid(): string {
  let r = ''
  const bytes = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256)
  for (const b of bytes) r += ALPHA[b % 36]
  return Date.now().toString(36) + r
}

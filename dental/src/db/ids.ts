/** Short, sortable, collision-safe ids: time prefix + random tail. */
const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyz'
export function newId(): string {
  const t = Date.now().toString(36)
  let r = ''
  const bytes = new Uint8Array(10)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  for (const b of bytes) r += ALPHA[b % 36]
  return `${t}${r}`
}
export const nowISO = () => new Date().toISOString()
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// A random id that identifies this browser/app install. Customers have no accounts: their bookings and
// notifications are tied to this id (sent as the X-Device header) and to the phone number they type.
const KEY = 'fp_device'
let memo: string | null = null

function uuid(): string {
  const c: Crypto & { randomUUID?: () => string } = crypto
  if (typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  c.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function deviceId(): string {
  if (memo) return memo
  let id: string | null = null
  try { id = localStorage.getItem(KEY) } catch { /* private mode / blocked storage */ }
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = uuid()
    try { localStorage.setItem(KEY, id) } catch { /* keep it in memory for this session */ }
  }
  memo = id
  return id
}

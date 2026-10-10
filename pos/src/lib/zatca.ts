// The QR code of a Saudi simplified tax invoice (ZATCA phase 1): a base64 TLV of five fields.
//   1 seller name · 2 VAT registration number · 3 timestamp (ISO 8601) · 4 total with VAT · 5 VAT amount
const enc = new TextEncoder()

function tlv(tag: number, value: string): Uint8Array {
  const v = enc.encode(value)
  if (v.length > 255) throw new Error('tlv value too long')
  const out = new Uint8Array(2 + v.length)
  out[0] = tag; out[1] = v.length; out.set(v, 2)
  return out
}
function b64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

/** The longest prefix of `s` that fits in `max` UTF-8 bytes (a TLV length is one byte; Arabic letters take two). */
function fitBytes(s: string, max = 255): string {
  let out = ''
  for (const ch of s) { if (enc.encode(out + ch).length > max) break; out += ch }
  return out
}

export interface ZatcaFields { seller: string; vat: string; time: Date; total: number; vatAmount: number }

/** The base64 text to put in the QR. Amounts are written with two decimals, as the spec asks. */
export function zatcaQr(f: ZatcaFields): string {
  const parts = [tlv(1, fitBytes(f.seller.trim())), tlv(2, f.vat.replace(/\s/g, '')), tlv(3, f.time.toISOString().replace(/\.\d{3}Z$/, 'Z')), tlv(4, f.total.toFixed(2)), tlv(5, f.vatAmount.toFixed(2))]
  const len = parts.reduce((n, p) => n + p.length, 0)
  const all = new Uint8Array(len)
  let o = 0
  for (const p of parts) { all.set(p, o); o += p.length }
  return b64(all)
}

/** Reads a QR back into its fields (for tests and support). */
export function parseZatcaQr(text: string): Record<number, string> {
  const bin = atob(text)
  const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0))
  const out: Record<number, string> = {}
  const dec = new TextDecoder()
  for (let i = 0; i + 1 < bytes.length;) {
    const tag = bytes[i], len = bytes[i + 1]
    out[tag] = dec.decode(bytes.subarray(i + 2, i + 2 + len))
    i += 2 + len
  }
  return out
}

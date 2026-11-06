// The shop's phone number: required (the seller follows up with shops on the free trial, and it is printed on the
// receipt). Typed on a phone keyboard it may hold Arabic-Indic digits, spaces, dashes or brackets, and people write
// the same Syrian number many ways (0944…, 944…, +963 944…, +963 0944…, 00963…). One canonical form is kept so the
// seller's WhatsApp link reaches the right person: a local number with its 0, or "+" and the international digits.

const AR = '٠١٢٣٤٥٦٧٨٩', FA = '۰۱۲۳۴۵۶۷۸۹'
/** The canonical form: "٠٩٤٤ ١٢٣ ٤٥٦" → "0944123456", "944123456" → "0944123456", "+963 0944 123 456" → "+963944123456". */
export function cleanPhone(raw: string): string {
  const s = String(raw ?? '').trim()
    .replace(/[٠-٩]/g, ch => String(AR.indexOf(ch))).replace(/[۰-۹]/g, ch => String(FA.indexOf(ch)))
  let plus = /^(\+|00)/.test(s)
  let d = s.replace(/\D/g, '')
  if (s.startsWith('00')) d = d.replace(/^00/, '')
  if (!d) return ''
  if (!plus && /^963\d{9,10}$/.test(d)) plus = true          // 963944123456 written without the +
  if (plus) return '+' + (d.startsWith('9630') ? '963' + d.slice(4) : d)   // +963 0944… → +963944…
  if (/^9\d{8}$/.test(d)) return '0' + d                       // a Syrian mobile written without its 0
  return d
}

/** A number someone can be called or messaged on: 9 to 15 digits; a local (Syrian) number is 0 + 9 digits
 *  (mobile 09xxxxxxxx, landline 011xxxxxxx…); a number from another country is written with its code (+90…). */
export function validPhone(raw: string): boolean {
  const p = cleanPhone(raw)
  if (p.startsWith('+0')) return false                         // no country code starts with 0
  const d = p.replace(/^\+/, '')
  if (d.length < 9 || d.length > 15) return false
  if (!p.startsWith('+') && d.startsWith('0')) return d.length === 10
  return true
}

/** The international digits WhatsApp links need: 0944123456 → 963944123456 (a local number is taken as Syrian). */
export function intlPhone(raw: string): string {
  const p = cleanPhone(raw)
  if (!p) return ''
  if (p.startsWith('+')) return p.slice(1)
  if (p.startsWith('0')) return '963' + p.slice(1)
  return p
}

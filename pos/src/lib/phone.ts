// The shop's phone number: required (the seller follows up with shops on the free trial, and it is printed on the
// receipt). Typed on a phone keyboard it may hold Arabic-Indic digits, spaces, dashes or brackets.

const AR = '٠١٢٣٤٥٦٧٨٩', FA = '۰۱۲۳۴۵۶۷۸۹'
/** Western digits, an optional leading "+", nothing else: "٠٩٤٤ ١٢٣ ٤٥٦" → "0944123456". */
export function cleanPhone(raw: string): string {
  const s = String(raw ?? '').trim()
    .replace(/[٠-٩]/g, ch => String(AR.indexOf(ch))).replace(/[۰-۹]/g, ch => String(FA.indexOf(ch)))
  const plus = /^\s*(\+|00)/.test(s)
  const digits = s.replace(/\D/g, '').replace(/^00/, '')
  return digits ? (plus ? '+' : '') + digits : ''
}

/** A number someone can be called or messaged on: 9 to 15 digits; a Syrian number written locally is 0 + 9 digits
 *  (mobile 09xxxxxxxx, landline 011xxxxxxx…). */
export function validPhone(raw: string): boolean {
  const p = cleanPhone(raw)
  const d = p.replace(/^\+/, '')
  if (d.length < 9 || d.length > 15) return false
  if (!p.startsWith('+') && d.startsWith('0')) return d.length === 10   // local Syrian form
  return true
}

/** The international form WhatsApp links need, digits only: 0944123456 → 963944123456 (a local number is taken as Syrian). */
export function intlPhone(raw: string): string {
  const p = cleanPhone(raw)
  if (!p) return ''
  if (p.startsWith('+')) return p.slice(1)
  if (p.startsWith('0')) return '963' + p.slice(1)
  return p
}

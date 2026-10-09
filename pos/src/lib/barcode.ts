// Barcodes: validation, EAN-13 check digits, and the in-store barcodes we make for products without one.

export function cleanBarcode(s: string): string {
  return s.replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch))).replace(/\s+/g, '').trim()
}

export function ean13CheckDigit(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}
export function isValidEan13(s: string): boolean {
  return /^\d{13}$/.test(s) && ean13CheckDigit(s.slice(0, 12)) === Number(s[12])
}
export function ean8CheckDigit(digits7: string): number {
  let sum = 0
  for (let i = 0; i < 7; i++) sum += Number(digits7[i]) * (i % 2 === 0 ? 3 : 1)
  return (10 - (sum % 10)) % 10
}
export function isValidEan8(s: string): boolean {
  return /^\d{8}$/.test(s) && ean8CheckDigit(s.slice(0, 7)) === Number(s[7])
}
export function isValidUpcA(s: string): boolean {
  if (!/^\d{12}$/.test(s)) return false
  let sum = 0
  for (let i = 0; i < 11; i++) sum += Number(s[i]) * (i % 2 === 0 ? 3 : 1)
  return (10 - (sum % 10)) % 10 === Number(s[11])
}

/** What a scanner is likely to give us: 4..48 printable characters, no spaces. */
export function looksLikeBarcode(s: string): boolean {
  return /^[A-Za-z0-9\-_.+/:]{4,48}$/.test(s)
}

/** In-store EAN-13 (prefix 2xx, reserved for store use): 200 + 9 digits + check digit. */
export function makeInternalEan13(seq: number): string {
  const body = '200' + String(seq % 1_000_000_000).padStart(9, '0')
  return body + ean13CheckDigit(body)
}
/** A random in-store code, for when no sequence is at hand. */
export function randomInternalEan13(): string {
  const n = Math.floor(Math.random() * 1_000_000_000)
  return makeInternalEan13(n)
}

/** The format JsBarcode should use for a value. */
export function barcodeFormat(value: string): 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' {
  if (isValidEan13(value)) return 'EAN13'
  if (isValidEan8(value)) return 'EAN8'
  if (isValidUpcA(value)) return 'UPC'
  return 'CODE128'
}

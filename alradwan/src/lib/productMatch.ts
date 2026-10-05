// Which product a scanned code belongs to: its barcode (any form of the same product number), its own code,
// or a manufacturer/OEM part number printed as a barcode on the box.
import type { Product } from '../db/types'
import { norm } from './format'
import { splitOem } from './vin'
import { codeFacts, gtinKeys, parseGs1, productNumber } from './gs1'

/** Letters and digits only, lower case: "0 986-452.041" and "0986452041" are the same part number. */
export const compact = (s: string) => norm(s).replace(/[^0-9a-z؀-ۿ]/g, '')

export type MatchVia = 'barcode' | 'code' | 'gtin' | 'oem'

/** Car-part labels (Mopar / Stellantis, GM, Ford, VW… in the AIAG / ANSI MH10 style) print each Code 39 with a
 *  "data identifier" in front: P (or 1P, 30P) the part number, Q the quantity in the box. `P9818914980` is part
 *  number 98 189 149 80. */
export function labelPartNumber(text: string): string | null {
  const m = /^(?:1P|30P|P)([0-9A-Z][0-9A-Z.\-/ ]{4,39})$/.exec(text.trim().toUpperCase())
  return m && (m[1].match(/\d/g)?.length ?? 0) >= 4 ? m[1].trim() : null
}
/** Why a reading is not a product's code (a label's quantity, a box's authenticity link), or null when it may be one. */
export function notAProductCode(text: string): string | null {
  const t = text.trim()
  if (/^\d{0,2}Q\d{1,6}$/i.test(t)) return 'هذا باركود الكمية على اللصاقة (Q)، وليس رقم القطعة. امسح الباركود الذي بجانب (P) أو الرقم الكبير.'
  if (/^(https?:\/\/|www\.)/i.test(t)) return 'هذا رمز QR فيه رابط (للتحقق من أصالة العلبة أو موقع الشركة)، وهو مختلف لكل علبة. امسح الباركود الخطي الذي عليه رقم القطعة.'
  return null
}
export function findProductByScan(products: Iterable<Product>, text: string): { product: Product; via: MatchVia } | null {
  const raw = text.trim()
  if (!raw) return null
  const n = norm(raw), c = compact(raw)
  // the part number a car-part label carries after its P
  const pn = labelPartNumber(raw), cp = pn ? compact(pn) : ''
  const keys = new Set(gtinKeys(raw))
  const inside = productNumber(raw)
  if (inside) keys.add(inside)
  let byGtin: Product | null = null, byOem: Product | null = null
  for (const p of products) {
    const codes = splitOem(p.barcode)
    if (codes.some(b => norm(b) === n)) return { product: p, via: 'barcode' }
    if (norm(p.code) === n) return { product: p, via: 'code' }
    if (!byGtin && keys.size && codes.some(b => gtinKeys(b).some(k => keys.has(k)))) byGtin = p
    if (!byOem && c.length >= 4 && (splitOem(p.oemNumbers).some(o => compact(o) === c) || compact(p.code) === c || codes.some(b => compact(b) === c))) byOem = p
    if (!byOem && cp.length >= 4 && (splitOem(p.oemNumbers).some(o => compact(o) === cp) || compact(p.code) === cp || codes.some(b => compact(b) === cp))) byOem = p
  }
  if (byGtin) return { product: byGtin, via: 'gtin' }
  if (byOem) return { product: byOem, via: 'oem' }
  return null
}

/** Adds a barcode to a product's list (comma separated) unless it is already there. */
export function withBarcode(list: string | undefined, code: string): string {
  const all = splitOem(list)
  if (all.some(b => norm(b) === norm(code))) return all.join(', ')
  return [...all, code].join(', ')
}

/** A GTIN-14 key back in the form printed on the box: EAN-8, UPC-A (12), EAN-13 or GTIN-14. */
export function shortGtin(g14: string): string {
  if (g14.startsWith('000000')) return g14.slice(6)
  if (g14.startsWith('00')) return g14.slice(2)
  if (g14.startsWith('0')) return g14.slice(1)
  return g14
}

/** What to save as the barcode of a scanned code: for GS1 data (Data Matrix, GS1-128, Digital Link) the
 *  product number inside it, not the batch or the expiry that change from box to box; otherwise the code. */
export function barcodeToSave(text: string): string {
  const t = text.trim()
  const g = parseGs1(t) ? productNumber(t) : null
  return g ? shortGtin(g) : t
}

/** The fields a new product gets from the code scanned for it. */
export function prefillFromScan(text: string): Partial<Product> {
  const t = text.trim()
  const pn = labelPartNumber(t)
  return { barcode: barcodeToSave(t), ...(pn ? { oemNumbers: pn } : codeFacts(t).looksLikePartNumber ? { oemNumbers: t } : {}) }
}

/** Another product that already carries this barcode (the same number in any form), if any. */
export function barcodeOwner(products: Iterable<Product>, code: string, exceptId?: string): Product | null {
  const n = norm(code)
  const keys = new Set(gtinKeys(code))
  for (const p of products) {
    if (p.id === exceptId) continue
    const codes = splitOem(p.barcode)
    if (codes.some(b => norm(b) === n || (keys.size > 0 && gtinKeys(b).some(k => keys.has(k))))) return p
  }
  return null
}

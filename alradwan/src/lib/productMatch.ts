// Which product a scanned code belongs to: its barcode (any form of the same product number), its own code,
// or a manufacturer/OEM part number printed as a barcode on the box.
import type { Product } from '../db/types'
import { norm } from './format'
import { splitOem } from './vin'
import { codeFacts, gtinKeys, parseGs1, productNumber } from './gs1'

/** Letters and digits only, lower case: "0 986-452.041" and "0986452041" are the same part number. */
export const compact = (s: string) => norm(s).replace(/[^0-9a-z؀-ۿ]/g, '')

export type MatchVia = 'barcode' | 'code' | 'gtin' | 'oem'
export function findProductByScan(products: Iterable<Product>, text: string): { product: Product; via: MatchVia } | null {
  const raw = text.trim()
  if (!raw) return null
  const n = norm(raw), c = compact(raw)
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
  return { barcode: barcodeToSave(t), ...(codeFacts(t).looksLikePartNumber ? { oemNumbers: t } : {}) }
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

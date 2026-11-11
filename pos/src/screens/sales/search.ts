// Finding products the way a cashier types: Arabic-friendly, by name / barcode / sku. Pure, tested.
import type { Product, ProductPack } from '../../db/types'
import { cleanBarcode, looksLikeBarcode } from '../../lib/barcode'

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/** Lower-case, no diacritics, unified alef / yaa / taa-marbuta, western digits, single spaces. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')                 // tashkeel + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, ch => String(AR_DIGITS.indexOf(ch)))
    .replace(/[۰-۹]/g, ch => String(FA_DIGITS.indexOf(ch)))
    .replace(/\s+/g, ' ')
    .trim()
}

export function searchTokens(query: string): string[] {
  return normalizeText(query).split(' ').filter(Boolean)
}

export function productMatches(p: Product, tokens: string[]): boolean {
  if (!tokens.length) return true
  const name = normalizeText(p.name)
  const sku = p.sku ? normalizeText(p.sku) : ''
  const codes = p.barcodes.map(b => b.toLowerCase())
  return tokens.every(tk => name.includes(tk) || sku.includes(tk) || codes.some(c => c.includes(tk)))
}

/** Favourites first, then by name (Arabic-aware). Stable for equal names. */
export function sortProducts(products: Product[]): Product[] {
  return products.slice().sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    return a.name.localeCompare(b.name, 'ar')
  })
}

export function filterProducts(products: Product[], query: string, opts: { categoryId?: string; favorites?: boolean } = {}): Product[] {
  const tokens = searchTokens(query)
  return products.filter(p => {
    if (!p.active) return false
    if (opts.favorites && !p.favorite) return false
    if (opts.categoryId && p.categoryId !== opts.categoryId) return false
    return productMatches(p, tokens)
  })
}

export function findByBarcode(products: Product[], code: string): Product | undefined {
  const c = cleanBarcode(code)
  if (!c) return undefined
  return products.find(p => p.active && p.barcodes.includes(c)) ?? products.find(p => p.active && p.barcodes.some(b => b.toLowerCase() === c.toLowerCase()))
}

/** A pack's own barcode (the carton code printed by the maker). */
export function findPackByBarcode(products: Product[], code: string): { product: Product; pack: ProductPack } | undefined {
  const c = cleanBarcode(code)
  if (!c) return undefined
  const lc = c.toLowerCase()
  for (const p of products) {
    if (!p.active || !p.packs?.length) continue
    const pack = p.packs.find(k => k.barcode && k.qty > 0 && k.barcode.toLowerCase() === lc)
    if (pack) return { product: p, pack }
  }
  return undefined
}

/** A whole code as a scanner would type it (8+ digits, or a long alphanumeric code). */
export function isFullCode(code: string): boolean {
  return /^\d{8,}$/.test(code) || (looksLikeBarcode(code) && /^[A-Z0-9\-]{10,}$/i.test(code) && /\d/.test(code))
}

export type EntryAction =
  | { kind: 'product'; product: Product; scanned: boolean }
  | { kind: 'quickAdd'; barcode: string }
  | { kind: 'none' }

/**
 * What Enter in the search box (or a scanner) should do with `text`:
 * an exact barcode adds the product; a full code nobody has opens "new product";
 * otherwise exactly one search match adds it, a no-match that looks like a code opens "new product".
 */
export function resolveEntry(text: string, products: Product[], visible?: Product[]): EntryAction {
  const raw = text.trim()
  if (!raw) return { kind: 'none' }
  const code = cleanBarcode(raw)
  const exact = findByBarcode(products, code)
  if (exact) return { kind: 'product', product: exact, scanned: true }
  if (isFullCode(code)) return { kind: 'quickAdd', barcode: code }
  const matches = visible ?? filterProducts(products, raw)
  if (matches.length === 1) return { kind: 'product', product: matches[0], scanned: false }
  if (matches.length === 0 && looksLikeBarcode(code)) return { kind: 'quickAdd', barcode: code }
  return { kind: 'none' }
}

/** How many of a product may still be added, given what the cart already holds (Infinity when not limited). */
export function availableQty(p: Product, inCart: number, allowNegative: boolean): number {
  if (!p.trackStock || allowNegative) return Infinity
  return Math.max(0, p.stock - inCart)
}

/** Quick-cash buttons: the sensible round-ups merged with the shop's own notes, only those that cover the total. */
export function mergeQuickAmounts(auto: number[], custom: number[], total: number, max = 6): number[] {
  const set = new Set<number>()
  for (const n of [...auto, ...custom]) if (Number.isFinite(n) && n > 0 && n >= total) set.add(n)
  return [...set].sort((a, b) => a - b).slice(0, max)
}

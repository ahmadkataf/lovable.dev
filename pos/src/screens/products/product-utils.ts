// Pure helpers for the products screen: search, filters, sorting, stock state, CSV rows.
import { isExpiring, hasFxAnchor, isFxPriced } from '../../db/types'
import type { Category, Product, ProductPack, SecondCurrency } from '../../db/types'
import { cleanBarcode } from '../../lib/barcode'
import { round } from '../../lib/money'
import { derivePrices } from '../../lib/fx'
import { t } from '../../i18n'

/** 'fx' = products with a price or cost anchored in the second currency (they follow the exchange rate). */
export type ProductFilter = 'all' | 'low' | 'out' | 'inactive' | 'favorites' | 'expiring' | 'fx'
export type ProductSort = 'name' | 'price' | 'stock' | 'recent'
/** 'all' = every product, 'none' = products without a category, else a category id. */
export type CategoryPick = 'all' | 'none' | string
export type StockState = 'untracked' | 'ok' | 'low' | 'out'

export const UNIT_KEYS = ['piece', 'kg', 'g', 'l', 'ml', 'm', 'box', 'pack', 'dozen'] as const
export const PRODUCT_COLORS = ['#0e9f6e', '#3b6cf6', '#e9a007', '#e5484d', '#8b5cf6', '#0ea5e9', '#f97316', '#14b8a6', '#ec4899', '#64748b']

/** Lowercase, western digits, no diacritics, unified alef / taa marbuta / yaa — so "أحمد" finds "احمد". */
export function normalizeText(s: string): string {
  return (s ?? '').toLowerCase()
    .replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
    .replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesSearch(p: Product, q: string): boolean {
  if (!q) return true
  if (normalizeText(p.name).includes(q)) return true
  if (p.sku && normalizeText(p.sku).includes(q)) return true
  const code = cleanBarcode(q)
  return code !== '' && p.barcodes.some(b => b.includes(code))
}

export function stockState(p: Product): StockState {
  if (!p.trackStock) return 'untracked'
  if (p.stock <= 0) return 'out'
  if (p.lowStock > 0 && p.stock <= p.lowStock) return 'low'
  return 'ok'
}

export interface FilterOptions { search: string; category: CategoryPick; filter: ProductFilter }
/** Inactive products are hidden unless the filter asks for them or a search is typed (so a barcode search always finds its product). */
export function filterProducts(products: Product[], o: FilterOptions): Product[] {
  const q = normalizeText(o.search)
  return products.filter(p => {
    if (o.category === 'none' ? !!p.categoryId : o.category !== 'all' && p.categoryId !== o.category) return false
    switch (o.filter) {
      case 'inactive': if (p.active) return false; break
      case 'low': if (!p.active || (stockState(p) !== 'low' && stockState(p) !== 'out')) return false; break
      case 'out': if (!p.active || stockState(p) !== 'out') return false; break
      case 'expiring': if (!p.active || !isExpiring(p)) return false; break
      case 'favorites': if (!p.active || !p.favorite) return false; break
      case 'fx': if (!p.active || !hasFxAnchor(p)) return false; break
      default: if (!p.active && !q) return false
    }
    return matchesSearch(p, q)
  })
}

export function sortProducts(products: Product[], sort: ProductSort, lang: 'ar' | 'en' = 'ar'): Product[] {
  const out = products.slice()
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, lang === 'ar' ? 'ar' : 'en')
  switch (sort) {
    case 'price': out.sort((a, b) => a.price - b.price || byName(a, b)); break
    case 'stock': out.sort((a, b) => {
      const sa = a.trackStock ? a.stock : Number.POSITIVE_INFINITY, sb = b.trackStock ? b.stock : Number.POSITIVE_INFINITY
      return sa - sb || byName(a, b)
    }); break
    case 'recent': out.sort((a, b) => b.updatedAt - a.updatedAt || byName(a, b)); break
    default: out.sort(byName)
  }
  return out
}

/** Cost value of what is on the shelf (tracked products only, negative stock counts as 0). */
export function stockValue(products: Product[], decimals = 2): number {
  return round(products.reduce((s, p) => s + (p.trackStock && p.stock > 0 ? p.stock * p.cost : 0), 0), decimals)
}

/** A product's unit as shown to people: a known key is translated, free text is kept. */
export function unitLabel(unit: string): string {
  if (!unit) return t('unit.piece')
  const k = `unit.${unit}`
  const s = t(k)
  return s === k ? unit : s
}

export function exactBarcodeMatch(products: Product[], raw: string): Product | undefined {
  const code = cleanBarcode(raw)
  if (!code) return undefined
  return products.find(p => p.barcodes.includes(code))
}

/** Profit margin as a percentage of the price (null when it cannot be computed). */
export function marginPct(price: number, cost: number): number | null {
  if (!(price > 0) || !(cost >= 0)) return null
  return round(((price - cost) / price) * 100, 1)
}

export const CSV_HEADERS = ['name/الاسم', 'barcode/الباركود', 'sku/الرمز', 'category/الفئة', 'price/السعر', 'cost/التكلفة', 'stock/المخزون', 'lowStock/حد التنبيه', 'unit/الوحدة', 'active/نشط', 'notes/ملاحظات'] as const

/** The second-currency column headers: `price_USD/السعر بالدولار` for dollars, `price_{code}/السعر بـ{code}` for any other code. */
export function fxCsvHeaders(c2: Pick<SecondCurrency, 'code'>): { price: string; cost: string } {
  const usd = c2.code === 'USD'
  return {
    price: usd ? 'price_USD/السعر بالدولار' : `price_${c2.code}/السعر بـ${c2.code}`,
    cost: usd ? 'cost_USD/التكلفة بالدولار' : `cost_${c2.code}/التكلفة بـ${c2.code}`,
  }
}

export interface CsvOptions {
  includeCost: boolean
  /** When pricing in it is on, the export carries the anchor columns next to price (and cost). */
  currency2?: Pick<SecondCurrency, 'code' | 'pricing'>
}

/** The header row for the given options (price_USD after price, cost_USD after cost). */
export function csvHeaders(opts: CsvOptions): string[] {
  const fx = opts.currency2?.pricing ? fxCsvHeaders(opts.currency2) : null
  const out: string[] = []
  for (const h of CSV_HEADERS) {
    if (h.startsWith('cost/') && !opts.includeCost) continue
    out.push(h)
    if (fx && h.startsWith('price/')) out.push(fx.price)
    if (fx && h.startsWith('cost/')) out.push(fx.cost)
  }
  return out
}

export function productsToCsv(products: Product[], categories: Category[], opts: CsvOptions): (string | number)[][] {
  const cat = new Map(categories.map(c => [c.id, c.name]))
  const fx = !!opts.currency2?.pricing
  const rows: (string | number)[][] = [csvHeaders(opts)]
  for (const p of products) {
    const row: (string | number)[] = [
      p.name, p.barcodes.join('|'), p.sku ?? '', p.categoryId ? cat.get(p.categoryId) ?? '' : '',
      p.price, ...(fx ? [p.fxPrice ?? ''] : []),
      ...(opts.includeCost ? [p.cost, ...(fx ? [p.fxCost ?? ''] : [])] : []),
      p.trackStock ? p.stock : '', p.trackStock ? p.lowStock : '',
      p.unit, p.active ? 1 : 0, p.notes ?? '',
    ]
    rows.push(row)
  }
  return rows
}

export function templateCsv(currency2?: Pick<SecondCurrency, 'code' | 'pricing' | 'rate'>): (string | number)[][] {
  const opts: CsvOptions = { includeCost: true, currency2 }
  const fx = !!currency2?.pricing
  const rate = currency2?.rate && currency2.rate > 0 ? currency2.rate : 13000
  const rows: (string | number)[][] = [
    csvHeaders(opts),
    ['حليب كامل الدسم 1 لتر', '6291041500213', 'MLK-1', 'ألبان', 1500, ...(fx ? [''] : []), 1200, ...(fx ? [''] : []), 24, 5, 'piece', 1, ''],
    ['سكر', '', 'SGR', 'مواد غذائية', 900, ...(fx ? [''] : []), 750, ...(fx ? [''] : []), 50, 10, 'kg', 1, 'يباع بالوزن'],
  ]
  if (fx) rows.push(['زيت زيتون 1 لتر', '', 'OIL-1', 'مواد غذائية', round(9.99 * rate, 0), 9.99, round(8.5 * rate, 0), 8.5, 12, 3, 'piece', 1, 'السعر بالدولار؛ سعر الليرة يُحسب من سعر الصرف'])
  return rows
}

/* ---------- bulk price / anchor helpers (pure; the modals apply what these return) ---------- */

export type BulkPriceMode = 'pct' | 'amount'
export type BulkDir = 'up' | 'down'

export function newPrice(price: number, mode: BulkPriceMode, dir: BulkDir, value: number, decimals: number): number {
  const delta = mode === 'pct' ? (price * value) / 100 : value
  return Math.max(0, round(dir === 'up' ? price + delta : price - delta, decimals))
}

export type Fx2 = Pick<SecondCurrency, 'rate' | 'roundTo' | 'roundMode' | 'decimals'>

/**
 * What a bulk price change writes on one product. Unanchored: `price` as before. Anchored (`fxPrice`): a percentage
 * scales the anchors (`fxPrice`, `fxWholesalePrice`, `packs[].fxPrice`) and the primary figures follow through
 * `derivePrices`; a fixed amount cannot apply to an anchor → null (the caller reports it as skipped).
 */
export function bulkPricePatch(p: Product, mode: BulkPriceMode, dir: BulkDir, value: number, decimals: number, c2: Fx2 | undefined, at = Date.now()): Partial<Product> | null {
  if (!isFxPriced(p) || !c2) return { price: newPrice(p.price, mode, dir, value, decimals) }
  if (mode === 'amount') return null
  const fd = c2.decimals
  const patch: Partial<Product> = { fxPrice: newPrice(p.fxPrice!, 'pct', dir, value, fd) }
  if (typeof p.fxWholesalePrice === 'number') patch.fxWholesalePrice = newPrice(p.fxWholesalePrice, 'pct', dir, value, fd)
  if (p.packs?.some(k => typeof k.fxPrice === 'number')) {
    patch.packs = p.packs.map(k => (typeof k.fxPrice === 'number' ? { ...k, fxPrice: newPrice(k.fxPrice, 'pct', dir, value, fd) } : k))
  }
  const derived = derivePrices({ ...p, ...patch }, c2, decimals, at)
  return derived ? { ...patch, ...derived } : patch
}

/**
 * Converting a product's pricing: to the second currency (anchors from today's primary figures at the rate, then the
 * primary figures re-derived so they sit on the rounding step) or back to the primary (anchors dropped, prices frozen).
 * Returns the full product to put. `null` when converting to the second currency without a usable rate.
 */
export function anchorProduct(p: Product, to: 'secondary' | 'primary', c2: Fx2, decimals: number, at = Date.now()): Product | null {
  if (to === 'primary') {
    const { fxPrice: _a, fxCost: _b, fxWholesalePrice: _c, ...rest } = p
    const packs: ProductPack[] | undefined = p.packs?.map(k => { const { fxPrice: _d, ...kr } = k; return kr })
    return { ...rest, ...(packs ? { packs } : {}) }
  }
  if (!(c2.rate > 0)) return null
  const fd = c2.decimals
  const next: Product = {
    ...p,
    fxPrice: round(p.price / c2.rate, fd),
    fxCost: p.cost > 0 ? round(p.cost / c2.rate, fd) : undefined,
    fxWholesalePrice: p.wholesalePrice && p.wholesalePrice > 0 ? round(p.wholesalePrice / c2.rate, fd) : undefined,
    packs: p.packs?.map(k => ({ ...k, fxPrice: round(k.price / c2.rate, fd) })),
  }
  if (!next.fxCost) delete next.fxCost
  if (!next.fxWholesalePrice) delete next.fxWholesalePrice
  if (!next.packs) delete next.packs
  const derived = derivePrices(next, c2, decimals, at)
  return derived ? { ...next, ...derived } : next
}

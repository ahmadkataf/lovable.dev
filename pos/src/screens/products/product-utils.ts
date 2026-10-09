// Pure helpers for the products screen: search, filters, sorting, stock state, CSV rows.
import type { Category, Product } from '../../db/types'
import { cleanBarcode } from '../../lib/barcode'
import { round } from '../../lib/money'
import { t } from '../../i18n'

export type ProductFilter = 'all' | 'low' | 'out' | 'inactive' | 'favorites'
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
      case 'favorites': if (!p.active || !p.favorite) return false; break
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

export function productsToCsv(products: Product[], categories: Category[], opts: { includeCost: boolean }): (string | number)[][] {
  const cat = new Map(categories.map(c => [c.id, c.name]))
  const headers = CSV_HEADERS.filter(h => opts.includeCost || !h.startsWith('cost/'))
  const rows: (string | number)[][] = [[...headers]]
  for (const p of products) {
    const row: (string | number)[] = [
      p.name, p.barcodes.join('|'), p.sku ?? '', p.categoryId ? cat.get(p.categoryId) ?? '' : '',
      p.price, ...(opts.includeCost ? [p.cost] : []), p.trackStock ? p.stock : '', p.trackStock ? p.lowStock : '',
      p.unit, p.active ? 1 : 0, p.notes ?? '',
    ]
    rows.push(row)
  }
  return rows
}

export function templateCsv(): (string | number)[][] {
  return [
    [...CSV_HEADERS],
    ['حليب كامل الدسم 1 لتر', '6291041500213', 'MLK-1', 'ألبان', 1500, 1200, 24, 5, 'piece', 1, ''],
    ['سكر', '', 'SGR', 'مواد غذائية', 900, 750, 50, 10, 'kg', 1, 'يباع بالوزن'],
  ]
}

import { describe, it, expect } from 'vitest'
import type { Product } from '../../db/types'
import { normalizeText, filterProducts, sortProducts, stockState, stockValue, productsToCsv, marginPct, exactBarcodeMatch } from './product-utils'

const mk = (over: Partial<Product>): Product => ({
  id: over.id ?? Math.random().toString(36).slice(2), name: 'x', barcodes: [], price: 10, cost: 5, trackStock: true, stock: 10, lowStock: 3,
  unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0, ...over,
})
const products: Product[] = [
  mk({ id: 'a', name: 'حليب كامل', barcodes: ['6291041500213'], price: 1500, cost: 1200, stock: 2, updatedAt: 5, categoryId: 'c1' }),
  mk({ id: 'b', name: 'أرز بسمتي', barcodes: ['111'], sku: 'RICE-1', price: 9000, cost: 7000, stock: 0, updatedAt: 9 }),
  mk({ id: 'c', name: 'سكر', price: 900, cost: 700, stock: 50, updatedAt: 1, favorite: true }),
  mk({ id: 'd', name: 'قديم', price: 100, cost: 50, trackStock: false, stock: 0, active: false, updatedAt: 3 }),
]

describe('normalizeText', () => {
  it('unifies Arabic letters and digits', () => {
    expect(normalizeText('أَرُزّ ١٢٣')).toBe('ارز 123')
    expect(normalizeText('مكتبة')).toBe('مكتبه')
    expect(normalizeText('  Milk  Full ')).toBe('milk full')
  })
})

describe('filterProducts', () => {
  it('hides inactive products by default but finds them by search', () => {
    expect(filterProducts(products, { search: '', category: 'all', filter: 'all' }).map(p => p.id)).toEqual(['a', 'b', 'c'])
    expect(filterProducts(products, { search: 'قديم', category: 'all', filter: 'all' }).map(p => p.id)).toEqual(['d'])
  })
  it('searches name, sku and barcode (with Arabic digits)', () => {
    expect(filterProducts(products, { search: 'ارز', category: 'all', filter: 'all' }).map(p => p.id)).toEqual(['b'])
    expect(filterProducts(products, { search: 'rice', category: 'all', filter: 'all' }).map(p => p.id)).toEqual(['b'])
    expect(filterProducts(products, { search: '٦٢٩١٠٤', category: 'all', filter: 'all' }).map(p => p.id)).toEqual(['a'])
  })
  it('applies the stock filters and categories', () => {
    expect(filterProducts(products, { search: '', category: 'all', filter: 'low' }).map(p => p.id)).toEqual(['a', 'b'])
    expect(filterProducts(products, { search: '', category: 'all', filter: 'out' }).map(p => p.id)).toEqual(['b'])
    expect(filterProducts(products, { search: '', category: 'all', filter: 'inactive' }).map(p => p.id)).toEqual(['d'])
    expect(filterProducts(products, { search: '', category: 'all', filter: 'favorites' }).map(p => p.id)).toEqual(['c'])
    expect(filterProducts(products, { search: '', category: 'c1', filter: 'all' }).map(p => p.id)).toEqual(['a'])
    expect(filterProducts(products, { search: '', category: 'none', filter: 'all' }).map(p => p.id)).toEqual(['b', 'c'])
  })
})

describe('sortProducts', () => {
  it('sorts by price, stock (untracked last) and recency', () => {
    expect(sortProducts(products, 'price').map(p => p.id)).toEqual(['d', 'c', 'a', 'b'])
    expect(sortProducts(products, 'stock').map(p => p.id)).toEqual(['b', 'a', 'c', 'd'])
    expect(sortProducts(products, 'recent').map(p => p.id)).toEqual(['b', 'a', 'd', 'c'])
  })
})

describe('stock helpers', () => {
  it('classifies stock', () => {
    expect(stockState(products[0])).toBe('low')
    expect(stockState(products[1])).toBe('out')
    expect(stockState(products[2])).toBe('ok')
    expect(stockState(products[3])).toBe('untracked')
  })
  it('values stock at cost, tracked products only', () => {
    expect(stockValue(products, 0)).toBe(2 * 1200 + 50 * 700)
  })
  it('computes the margin', () => {
    expect(marginPct(1500, 1200)).toBe(20)
    expect(marginPct(0, 5)).toBeNull()
  })
  it('finds a product by an exact barcode', () => {
    expect(exactBarcodeMatch(products, ' ٦٢٩١٠٤١٥٠٠٢١٣ ')?.id).toBe('a')
    expect(exactBarcodeMatch(products, '629104')).toBeUndefined()
  })
})

describe('productsToCsv', () => {
  it('writes bilingual headers and hides cost for cashiers', () => {
    const rows = productsToCsv(products.slice(0, 1), [{ id: 'c1', name: 'ألبان', color: '#000', sort: 1, createdAt: 0 }], { includeCost: true })
    expect(rows[0][0]).toBe('name/الاسم')
    expect(rows[1]).toEqual(['حليب كامل', '6291041500213', '', 'ألبان', 1500, 1200, 2, 3, 'piece', 1, ''])
    const noCost = productsToCsv(products.slice(0, 1), [], { includeCost: false })
    expect(noCost[0]).not.toContain('cost/التكلفة')
    expect(noCost[1]).toEqual(['حليب كامل', '6291041500213', '', '', 1500, 2, 3, 'piece', 1, ''])
  })
})

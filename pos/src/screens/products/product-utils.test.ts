import { describe, it, expect } from 'vitest'
import type { Product } from '../../db/types'
import { normalizeText, filterProducts, sortProducts, stockState, stockValue, productsToCsv, templateCsv, csvHeaders, CSV_HEADERS, marginPct, exactBarcodeMatch, bulkPricePatch, anchorProduct } from './product-utils'

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

describe('second-currency pricing helpers', () => {
  const c2 = { code: 'USD', pricing: true, rate: 13000, roundTo: 100, roundMode: 'nearest' as const, decimals: 2 }
  const anchored = mk({ id: 'fx', name: 'زيت', price: 129900, fxPrice: 9.99, cost: 110500, fxCost: 8.5, stock: 3, trackStock: true, wholesalePrice: 123500, fxWholesalePrice: 9.5, packs: [{ id: 'k1', name: 'كرتونة', qty: 12, price: 1404000, fxPrice: 108 }, { id: 'k2', name: 'علبة', qty: 6, price: 700000 }] })

  it("the 'fx' filter keeps active anchored products only", () => {
    const f = filterProducts
    const costOnly = mk({ id: 'co', name: 'c', fxCost: 1 })
    const inactive = mk({ id: 'in', name: 'i', fxPrice: 1, active: false })
    expect(f([...products, anchored, costOnly, inactive], { search: '', category: 'all', filter: 'fx' }).map(p => p.id)).toEqual(['fx', 'co'])
  })

  it('exports the USD columns next to price and cost when pricing is on', () => {
    const rows = productsToCsv([anchored, products[0]], [], { includeCost: true, currency2: c2 })
    expect(rows[0]).toEqual(['name/الاسم', 'barcode/الباركود', 'sku/الرمز', 'category/الفئة', 'price/السعر', 'price_USD/السعر بالدولار', 'cost/التكلفة', 'cost_USD/التكلفة بالدولار', 'stock/المخزون', 'lowStock/حد التنبيه', 'unit/الوحدة', 'active/نشط', 'notes/ملاحظات'])
    expect(rows[1]).toEqual(['زيت', '', '', '', 129900, 9.99, 110500, 8.5, 3, 3, 'piece', 1, ''])
    expect(rows[2]).toEqual(['حليب كامل', '6291041500213', '', '', 1500, '', 1200, '', 2, 3, 'piece', 1, ''])
    const cashier = productsToCsv([anchored], [], { includeCost: false, currency2: c2 })
    expect(cashier[0]).toEqual(['name/الاسم', 'barcode/الباركود', 'sku/الرمز', 'category/الفئة', 'price/السعر', 'price_USD/السعر بالدولار', 'stock/المخزون', 'lowStock/حد التنبيه', 'unit/الوحدة', 'active/نشط', 'notes/ملاحظات'])
    expect(cashier[1]).toEqual(['زيت', '', '', '', 129900, 9.99, 3, 3, 'piece', 1, ''])
  })
  it('keeps the plain columns when pricing is off, and names other codes by code', () => {
    expect(productsToCsv([anchored], [], { includeCost: true, currency2: { ...c2, pricing: false } })[0]).toEqual([...CSV_HEADERS])
    expect(productsToCsv([anchored], [], { includeCost: true, currency2: { ...c2, code: 'EUR' } })[0]).toContain('price_EUR/السعر بـEUR')
    expect(csvHeaders({ includeCost: false, currency2: { ...c2, code: 'EUR' } })).toContain('price_EUR/السعر بـEUR')
    expect(csvHeaders({ includeCost: false, currency2: { ...c2, code: 'EUR' } })).not.toContain('cost_EUR/التكلفة بـEUR')
  })
  it('the template carries the columns and one anchored sample row', () => {
    const plain = templateCsv()
    expect(plain[0]).toEqual([...CSV_HEADERS])
    expect(plain).toHaveLength(3)
    const fx = templateCsv(c2)
    expect(fx[0]).toContain('price_USD/السعر بالدولار')
    expect(fx).toHaveLength(4)
    const sample = fx[3]
    expect(sample[5]).toBe(9.99)
    expect(sample[4]).toBe(129870)
    expect(sample[7]).toBe(8.5)
    expect(fx[1]).toHaveLength(fx[0].length)
    expect(sample).toHaveLength(fx[0].length)
  })

  it('bulk percent scales the anchors and re-derives the lira prices; amount skips anchored products', () => {
    const up = bulkPricePatch(anchored, 'pct', 'up', 10, 0, c2, 5)!
    expect(up.fxPrice).toBe(10.99)
    expect(up.fxWholesalePrice).toBe(10.45)
    expect(up.packs!.map(k => k.fxPrice)).toEqual([118.8, undefined])
    expect(up.price).toBe(142900)                    // 10.99 × 13,000 = 142,870 → step 100
    expect(up.wholesalePrice).toBe(135900)
    expect(up.packs![0].price).toBe(1544400)
    expect(up.packs![1].price).toBe(700000)          // the unanchored pack is untouched
    expect(up.repricedAt).toBe(5)
    expect(up.cost).toBeUndefined()                  // a price change never touches the cost
    expect(bulkPricePatch(anchored, 'amount', 'up', 500, 0, c2)).toBeNull()
    expect(bulkPricePatch(products[0], 'amount', 'up', 500, 0, c2)).toEqual({ price: 2000 })
    expect(bulkPricePatch(products[0], 'pct', 'down', 10, 0, c2)).toEqual({ price: 1350 })
    // currency2 off: the anchor is ignored and the lira price changes as before
    expect(bulkPricePatch(anchored, 'amount', 'up', 100, 0, undefined)).toEqual({ price: 130000 })
  })

  it('anchors a product at the rate and un-anchors it back', () => {
    const p = mk({ id: 'p', name: 'p', price: 130000, cost: 100000, wholesalePrice: 120000, packs: [{ id: 'k', name: 'k', qty: 10, price: 1250000 }] })
    const fx = anchorProduct(p, 'secondary', c2, 0, 9)!
    expect(fx.fxPrice).toBe(10)
    expect(fx.fxCost).toBe(7.69)
    expect(fx.fxWholesalePrice).toBe(9.23)
    expect(fx.packs![0].fxPrice).toBe(96.15)
    expect(fx.price).toBe(130000)
    expect(fx.cost).toBe(99970)                      // cost is exact at the rate, never step-rounded
    expect(fx.wholesalePrice).toBe(120000)           // 119,990 → step 100
    expect(fx.packs![0].price).toBe(1250000)         // 1,249,950 → step 100
    expect(fx.repricedAt).toBe(9)
    const back = anchorProduct(fx, 'primary', c2, 0)!
    expect(back.fxPrice).toBeUndefined()
    expect(back.fxCost).toBeUndefined()
    expect(back.fxWholesalePrice).toBeUndefined()
    expect(back.packs![0].fxPrice).toBeUndefined()
    expect(back.price).toBe(130000)
    expect(back.cost).toBe(99970)                    // the lira figures freeze where they are
    expect(anchorProduct(p, 'secondary', { ...c2, rate: 0 }, 0)).toBeNull()
    const noCost = anchorProduct(mk({ id: 'q', name: 'q', price: 1000, cost: 0 }), 'secondary', c2, 0)!
    expect('fxCost' in noCost).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { emptyCart, addToCart, lineFromProduct, computeTotals, setLineQty, toSaleItems } from './cart'
import type { Product } from '../db/types'

const p = (over: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'Milk', barcodes: ['123'], price: 1000, cost: 800, trackStock: true, stock: 10, lowStock: 2, unit: 'piece',
  allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0, ...over,
})
const noTax = { enabled: false, rate: 0, inclusive: true, label: '' }

describe('cart', () => {
  it('merges the same product into one line', () => {
    let c = addToCart(emptyCart(), lineFromProduct(p()))
    c = addToCart(c, lineFromProduct(p()))
    c = addToCart(c, lineFromProduct(p({ id: 'p2', name: 'Bread', price: 500 })))
    expect(c.lines).toHaveLength(2)
    expect(c.lines[0].qty).toBe(2)
    const t = computeTotals(c, noTax, 0)
    expect(t.subtotal).toBe(2500); expect(t.total).toBe(2500); expect(t.itemCount).toBe(3); expect(t.cost).toBe(2400)
  })
  it('removes a line when its quantity drops to zero', () => {
    let c = addToCart(emptyCart(), lineFromProduct(p()))
    c = setLineQty(c, c.lines[0].key, 0)
    expect(c.lines).toHaveLength(0)
  })
  it('applies a percentage sale discount and spreads it over lines', () => {
    let c = addToCart(emptyCart(), lineFromProduct(p(), 2))
    c = addToCart(c, lineFromProduct(p({ id: 'p2', price: 3000 })))
    c = { ...c, discountPct: 10 }
    const t = computeTotals(c, noTax, 0)
    expect(t.subtotal).toBe(5000); expect(t.discount).toBe(500); expect(t.total).toBe(4500)
    expect(t.lines.map(l => l.net)).toEqual([1800, 2700])
  })
  it('never discounts below zero', () => {
    const c = { ...addToCart(emptyCart(), lineFromProduct(p())), discount: 99999 }
    expect(computeTotals(c, noTax, 0).total).toBe(0)
  })
  it('computes exclusive tax', () => {
    const c = addToCart(emptyCart(), lineFromProduct(p({ price: 100 }), 1, 15))
    const t = computeTotals(c, { enabled: true, rate: 15, inclusive: false, label: 'VAT' }, 2)
    expect(t.tax).toBe(15); expect(t.total).toBe(115)
  })
  it('computes inclusive tax without changing the total', () => {
    const c = addToCart(emptyCart(), lineFromProduct(p({ price: 115 }), 1, 15))
    const t = computeTotals(c, { enabled: true, rate: 15, inclusive: true, label: 'VAT' }, 2)
    expect(t.tax).toBe(15); expect(t.total).toBe(115)
  })
  it('rounds the spread discount so the parts add up', () => {
    let c = emptyCart()
    for (let i = 0; i < 3; i++) c = addToCart(c, lineFromProduct(p({ id: 'x' + i, price: 10 })))
    c = { ...c, discount: 10 }
    const t = computeTotals(c, noTax, 2)
    expect(t.lines.reduce((s, l) => s + l.net, 0)).toBeCloseTo(20, 2)
  })
  it('turns lines into receipt items', () => {
    const c = addToCart(emptyCart(), lineFromProduct(p(), 2))
    const items = toSaleItems(c, computeTotals(c, noTax, 0), 0)
    expect(items[0]).toMatchObject({ productId: 'p1', qty: 2, total: 2000, cost: 800 })
  })
})

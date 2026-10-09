import { describe, it, expect } from 'vitest'
import { emptyCart, addToCart, lineFromProduct, computeTotals, setLineQty, toSaleItems, lineUnits } from './cart'
import { productPrice, type Product } from '../db/types'

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

  it('sells packs: own price, stock in base units, merges only with the same pack', () => {
    const carton = { id: 'k1', name: 'كرتونة', qty: 24, price: 20000, barcode: '999' }
    const prod = p({ packs: [carton], wholesalePrice: 900 })
    let c = addToCart(emptyCart(), lineFromProduct(prod, 1, 0, { pack: carton }))
    c = addToCart(c, lineFromProduct(prod, 1, 0, { pack: carton }))
    c = addToCart(c, lineFromProduct(prod, 3))
    expect(c.lines).toHaveLength(2)
    expect(c.lines[0]).toMatchObject({ qty: 2, price: 20000, unitsPerQty: 24, packName: 'كرتونة', unit: 'كرتونة', barcode: '999', allowFraction: false, cost: 19200 })
    expect(lineUnits(c.lines[0])).toBe(48)
    expect(c.lines[1]).toMatchObject({ qty: 3, price: 1000, cost: 800 })
    expect(lineUnits(c.lines[1])).toBe(3)
    const tot = computeTotals(c, noTax, 0)
    expect(tot.subtotal).toBe(43000); expect(tot.cost).toBe(40800)
    const items = toSaleItems(c, tot, 0)
    expect(items[0]).toMatchObject({ unitsPerQty: 24, packName: 'كرتونة', qty: 2, total: 40000 })
    expect(items[1].unitsPerQty).toBeUndefined()
  })
  it('prices by customer tier: wholesale when set, retail otherwise; packs keep their own price', () => {
    const prod = p({ wholesalePrice: 900, packs: [{ id: 'k', name: 'box', qty: 6, price: 5500 }] })
    expect(productPrice(prod, 'wholesale')).toBe(900)
    expect(productPrice(prod, 'retail')).toBe(1000)
    expect(productPrice(prod, undefined)).toBe(1000)
    expect(productPrice(p({ wholesalePrice: 0 }), 'wholesale')).toBe(1000)
    expect(lineFromProduct(prod, 1, 0, { tier: 'wholesale' })).toMatchObject({ price: 900, originalPrice: 900 })
    expect(lineFromProduct(prod, 1, 0, { tier: 'wholesale', pack: prod.packs![0] })).toMatchObject({ price: 5500, originalPrice: 5500 })
  })
})

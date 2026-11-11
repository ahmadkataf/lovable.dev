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
  it('spreads a discount over many small lines without piling the rounding on the last one', () => {
    let c = emptyCart()
    for (let i = 0; i < 100; i++) c = addToCart(c, lineFromProduct(p({ id: 'x' + i, price: 1 }), 1, 10))
    c = { ...c, discount: 50 }
    const t = computeTotals(c, { enabled: true, rate: 10, inclusive: true, label: 'VAT' }, 0)
    expect(t.total).toBe(50)
    expect(t.lines.reduce((s, l) => s + l.net, 0)).toBe(50)
    expect(t.lines.every(l => l.net === 0 || l.net === 1)).toBe(true)   // not 0, 0, … 0, 50
    expect(t.lines[99].net).toBeLessThanOrEqual(1)
    // the usual case is unchanged: 2000 + 3000 with 500 off
    let c2 = addToCart(emptyCart(), lineFromProduct(p(), 2))
    c2 = addToCart(c2, lineFromProduct(p({ id: 'p2', price: 3000 })))
    expect(computeTotals({ ...c2, discount: 500 }, noTax, 0).lines.map(l => l.net)).toEqual([1800, 2700])
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

describe('second-currency anchors in the cart', () => {
  it('lineFromProduct carries the $ list price and cost of the product, the wholesale anchor or the pack', async () => {
    const { lineFromProduct } = await import('./cart')
    const prod = p({ fxPrice: 1, fxCost: 0.8, wholesalePrice: 900, fxWholesalePrice: 0.9, packs: [{ id: 'k', name: 'box', qty: 6, price: 5500, fxPrice: 5.5 }] })
    expect(lineFromProduct(prod)).toMatchObject({ fxPrice: 1, fxCost: 0.8 })
    expect(lineFromProduct(prod, 1, 0, { tier: 'wholesale' })).toMatchObject({ price: 900, fxPrice: 0.9, fxCost: 0.8 })
    expect(lineFromProduct(prod, 1, 0, { pack: prod.packs![0] })).toMatchObject({ price: 5500, fxPrice: 5.5, fxCost: 4.8 })
    // a wholesale price in lira only: the charged price is not the anchored one, so no $ list price
    expect(lineFromProduct(p({ fxPrice: 1, wholesalePrice: 900 }), 1, 0, { tier: 'wholesale' }).fxPrice).toBeUndefined()
    const plain = lineFromProduct(p())
    expect(plain.fxPrice).toBeUndefined(); expect(plain.fxCost).toBeUndefined()
  })
  it('toSaleItems keeps fxCost always and fxPrice only when the list price was charged', async () => {
    const { lineFromProduct, toSaleItems, computeTotals, addToCart, emptyCart, updateLine } = await import('./cart')
    let c = addToCart(emptyCart(), lineFromProduct(p({ fxPrice: 1, fxCost: 0.8 })))
    c = addToCart(c, lineFromProduct(p({ id: 'p2', fxPrice: 2, fxCost: 1.5, price: 2000 })))
    c = updateLine(c, c.lines[1].key, { price: 1800 })
    const items = toSaleItems(c, computeTotals(c, noTax, 0), 0)
    expect(items[0]).toMatchObject({ fxPrice: 1, fxCost: 0.8 })
    expect(items[1].fxPrice).toBeUndefined()
    expect(items[1].fxCost).toBe(1.5)
  })
  it('refreshCartPrices re-derives list-price lines and leaves overridden, discounted, custom and unknown lines alone', async () => {
    const { lineFromProduct, addToCart, emptyCart, updateLine, refreshCartPrices } = await import('./cart')
    const carton = { id: 'k1', name: 'كرتونة', qty: 24, price: 20000, fxPrice: 1.6 }
    const old = p({ fxPrice: 0.08, fxCost: 0.06, packs: [carton], wholesalePrice: 900, fxWholesalePrice: 0.07 })
    let c = addToCart(emptyCart(), lineFromProduct(old, 2))                                   // list price → refreshed
    c = addToCart(c, lineFromProduct(old, 1, 0, { pack: carton }))                            // pack line → refreshed from the pack
    c = addToCart(c, { ...lineFromProduct(old), key: 'ov', price: 950 })                     // overridden
    c = addToCart(c, { ...lineFromProduct(old), key: 'disc', discount: 100 })                 // discounted
    c = addToCart(c, { ...lineFromProduct(old), key: 'custom', productId: undefined, name: 'خدمة' })
    c = addToCart(c, { ...lineFromProduct(old), key: 'gone', productId: 'missing' })
    c = updateLine(c, c.lines[0].key, {})
    const fresh = { ...old, price: 1100, cost: 850, fxCost: 0.065, packs: [{ ...carton, price: 21000 }] }
    const { cart, changed } = refreshCartPrices(c, [fresh])
    expect(changed).toBe(2)
    expect(cart.lines[0]).toMatchObject({ price: 1100, originalPrice: 1100, cost: 850, fxPrice: 0.08, fxCost: 0.065, qty: 2 })
    expect(cart.lines[1]).toMatchObject({ price: 21000, originalPrice: 21000, fxPrice: 1.6, cost: 20400, unitsPerQty: 24 })
    expect(cart.lines.find(l => l.key === 'ov')).toMatchObject({ price: 950, originalPrice: 1000 })
    expect(cart.lines.find(l => l.key === 'disc')).toMatchObject({ price: 1000, discount: 100 })
    expect(cart.lines.find(l => l.key === 'custom')!.price).toBe(1000)
    expect(cart.lines.find(l => l.key === 'gone')!.price).toBe(1000)
    // wholesale tier: the wholesale price and anchor
    expect(refreshCartPrices(c, new Map([[fresh.id, fresh]]), 'wholesale').cart.lines[0]).toMatchObject({ price: 900, fxPrice: 0.07 })
    // nothing to do: the same cart object comes back
    const again = refreshCartPrices(cart, [fresh])
    expect(again.changed).toBe(0); expect(again.cart).toBe(cart)
  })
})

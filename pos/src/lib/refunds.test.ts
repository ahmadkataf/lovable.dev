import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { DEFAULT_SETTINGS, type Product, type Refund, type Sale, type Settings, type User } from '../db/types'
import { emptyCart, addToCart, lineFromProduct, computeTotals, type Cart } from './cart'
import { completeSale, planPayment } from './sales'
import { createRefund, remainingQty, refundTotal, refundLineTotal, refundableTotal, canRefund, unitRefundPrice, RefundError, refundErrorText } from './refunds'

const settings: Settings = { ...DEFAULT_SETTINGS, store: { ...DEFAULT_SETTINGS.store, name: 'متجر الأمل' } }
const user: User = { id: 'u1', name: 'أحمد', role: 'cashier', active: true, createdAt: 0 }
const milk: Product = { id: 'p1', name: 'حليب', barcodes: ['6291041500213'], price: 1000, cost: 800, trackStock: true, stock: 10, lowStock: 2, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0 }
const bread: Product = { id: 'p2', name: 'خبز', barcodes: [], price: 500, cost: 300, trackStock: false, stock: 0, lowStock: 0, unit: 'piece', allowFraction: false, favorite: true, active: true, createdAt: 0, updatedAt: 0 }
const rice: Product = { id: 'p3', name: 'رز', barcodes: [], price: 3000, cost: 2000, trackStock: true, stock: 20, lowStock: 0, unit: 'kg', allowFraction: true, favorite: false, active: true, createdAt: 0, updatedAt: 0 }

function cartWith(lines: [Product, number][], extra: Partial<Cart> = {}): Cart {
  let c = emptyCart()
  for (const [p, q] of lines) c = addToCart(c, lineFromProduct(p, q, settings.tax.rate))
  return { ...c, ...extra }
}
async function sell(cart: Cart, o: { method?: 'cash' | 'card' | 'transfer' | 'credit'; tendered?: number } = {}): Promise<Sale> {
  const totals = computeTotals(cart, settings.tax, settings.currency.decimals)
  const plan = planPayment({ total: totals.total, method: o.method ?? 'cash', tendered: o.tendered ?? totals.total, hasCustomer: !!cart.customerId, decimals: 0 })
  return completeSale({ cart, totals, payments: plan.payments, paid: plan.paid, change: plan.change, credit: plan.credit, user, shift: null, settings })
}
const refund = (sale: Sale, items: { index: number; qty: number }[], o: Partial<Parameters<typeof createRefund>[0]> = {}) =>
  createRefund({ sale, items, method: 'cash', restock: true, user, shift: null, settings, ...o })

beforeEach(async () => {
  await db.delete(); await db.open()
  await db.products.bulkAdd([milk, bread, rice])
  await db.customers.add({ id: 'c1', name: 'علي', balance: 2000, createdAt: 0, updatedAt: 0 })
})

describe('createRefund', () => {
  it('takes back the loyalty points earned on the refunded share', async () => {
    const loyal: Settings = { ...settings, loyalty: { enabled: true, earnPer: 1000, pointValue: 10, minRedeem: 100 } }
    await db.customers.put({ id: 'c9', name: 'سعاد', balance: 0, points: 20, createdAt: 0, updatedAt: 0 })
    const cart = { ...cartWith([[milk, 4], [bread, 2]]), customerId: 'c9', customerName: 'سعاد' }   // 5000 → 5 points
    const totals = computeTotals(cart, loyal.tax, 0)
    const sale = await completeSale({ cart, totals, payments: [{ method: 'cash', amount: totals.total }], paid: totals.total, change: 0, credit: 0, user, shift: null, settings: loyal })
    expect(sale.pointsEarned).toBe(5)
    expect((await db.customers.get('c9'))!.points).toBe(25)
    const r1 = await refund(sale, [{ index: 0, qty: 2 }], { settings: loyal })        // 2000 of 5000 → 2 points back
    expect(r1.pointsTaken).toBe(2)
    expect((await db.customers.get('c9'))!.points).toBe(23)
    const r2 = await refund(sale, [{ index: 0, qty: 2 }, { index: 1, qty: 2 }], { settings: loyal })   // the rest → the remaining 3
    expect(r2.pointsTaken).toBe(3)
    expect((await db.customers.get('c9'))!.points).toBe(20)
    expect((await db.sales.get(sale.id))!.status).toBe('refunded')
  })

  it('restocks a refunded carton as 24 pieces', async () => {
    const carton = { id: 'k1', name: 'كرتونة', qty: 24, price: 20000 }
    await db.products.put({ ...milk, stock: 50, packs: [carton] })
    const prod = (await db.products.get('p1'))!
    const sale = await sell(addToCart(emptyCart(), lineFromProduct(prod, 2, 0, { pack: carton })))
    expect((await db.products.get('p1'))!.stock).toBe(2)
    const r = await refund(sale, [{ index: 0, qty: 1 }])
    expect(r.items[0]).toMatchObject({ qty: 1, price: 20000, total: 20000, unitsPerQty: 24 })
    expect((await db.products.get('p1'))!.stock).toBe(26)
    const mv = await db.stockMoves.where('refId').equals(r.id).first()
    expect(mv).toMatchObject({ qty: 24, before: 2, after: 26 })
  })

  it('partial then full refund: statuses, totals, stock back with moves', async () => {
    const sale = await sell(cartWith([[milk, 2], [bread, 1]]))        // 2500
    expect((await db.products.get('p1'))!.stock).toBe(8)

    const r1 = await refund(sale, [{ index: 0, qty: 1 }], { reason: 'تالف' })
    expect(r1.total).toBe(1000)
    expect(r1.items).toEqual([{ productId: 'p1', name: 'حليب', qty: 1, price: 1000, total: 1000 }])
    expect(r1.saleNumber).toBe(sale.number); expect(r1.method).toBe('cash'); expect(r1.restock).toBe(true); expect(r1.reason).toBe('تالف')
    let s = (await db.sales.get(sale.id))!
    expect(s.status).toBe('partial'); expect(s.refunded).toBe(1000)
    expect((await db.products.get('p1'))!.stock).toBe(9)
    const moves = await db.stockMoves.where('refId').equals(r1.id).toArray()
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({ productId: 'p1', qty: 1, type: 'refund', before: 8, after: 9, userId: 'u1' })
    expect(remainingQty(s, await db.refunds.where('saleId').equals(sale.id).toArray(), 0)).toEqual([1, 1])
    expect(refundableTotal(s, 0)).toBe(1500)

    const r2 = await refund(s, [{ index: 0, qty: 1 }, { index: 1, qty: 1 }])
    expect(r2.total).toBe(1500)
    s = (await db.sales.get(sale.id))!
    expect(s.status).toBe('refunded'); expect(s.refunded).toBe(2500)
    expect((await db.products.get('p1'))!.stock).toBe(10)
    expect(await db.stockMoves.where('productId').equals('p2').count()).toBe(0)   // bread does not track stock
    const all = await db.refunds.where('saleId').equals(sale.id).toArray()
    expect(all).toHaveLength(2)
    expect(remainingQty(s, all, 0)).toEqual([0, 0])
    expect(canRefund(s, all, 0)).toBe(false)
    expect(await db.ledger.count()).toBe(0)
  })

  it('refuses more than what is left and writes nothing', async () => {
    const sale = await sell(cartWith([[milk, 2]]))
    await refund(sale, [{ index: 0, qty: 1 }])
    const s = (await db.sales.get(sale.id))!
    await expect(refund(s, [{ index: 0, qty: 2 }])).rejects.toMatchObject({ key: 'refunds.err.overRefund', vars: { name: 'حليب', qty: '1' } })
    // two lines of the same item in one request add up
    await expect(refund(s, [{ index: 0, qty: 0.5 }, { index: 0, qty: 0.6 }])).rejects.toBeInstanceOf(RefundError)
    expect(await db.refunds.count()).toBe(1)
    expect((await db.products.get('p1'))!.stock).toBe(9)
    expect((await db.sales.get(sale.id))!.refunded).toBe(1000)
  })

  it('refuses a fully refunded sale, an empty request and a bad line', async () => {
    const sale = await sell(cartWith([[bread, 1]]))
    await refund(sale, [{ index: 0, qty: 1 }])
    const s = (await db.sales.get(sale.id))!
    await expect(refund(s, [{ index: 0, qty: 1 }])).rejects.toMatchObject({ key: 'refunds.err.nothingLeft' })
    await expect(refund(sale, [])).rejects.toMatchObject({ key: 'refunds.err.noItems' })
    await expect(refund(sale, [{ index: 0, qty: 0 }])).rejects.toMatchObject({ key: 'refunds.err.noItems' })
    await expect(refund(sale, [{ index: 5, qty: 1 }])).rejects.toMatchObject({ key: 'refunds.err.badLine' })
    expect(refundErrorText(new RefundError('refunds.err.noItems'), k => k)).toBe('refunds.err.noItems')
    expect(refundErrorText(new Error('x'), k => k)).toBe('common.error')
  })

  it('credit: takes the money off the customer account with a ledger entry', async () => {
    const sale = await sell(cartWith([[milk, 3]], { customerId: 'c1', customerName: 'علي' }), { method: 'credit' })   // balance 2000 -> 5000
    expect((await db.customers.get('c1'))!.balance).toBe(5000)
    const r = await refund(sale, [{ index: 0, qty: 2 }], { method: 'credit', restock: false })
    expect(r.total).toBe(2000); expect(r.customerId).toBe('c1')
    expect((await db.customers.get('c1'))!.balance).toBe(3000)
    const rows = await db.ledger.where('customerId').equals('c1').sortBy('createdAt')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ type: 'refund', amount: -2000, balanceAfter: 3000, refId: r.id, method: 'credit', userId: 'u1' })
    // restock off: stock and moves untouched
    expect((await db.products.get('p1'))!.stock).toBe(7)
    expect(await db.stockMoves.where('type').equals('refund').count()).toBe(0)
    expect((await db.sales.get(sale.id))!.status).toBe('partial')
  })

  it('refuses credit without a customer', async () => {
    const sale = await sell(cartWith([[milk, 1]]))
    await expect(refund(sale, [{ index: 0, qty: 1 }], { method: 'credit' })).rejects.toMatchObject({ key: 'refunds.err.creditNoCustomer' })
    expect(await db.refunds.count()).toBe(0)
    expect(await db.ledger.count()).toBe(0)
  })

  it('a discounted sale refunds what was paid, and the last refund closes it exactly', async () => {
    // 3 × 1000 with a 10% sale discount: paid 2700, each unit is worth 900 on a refund
    const sale = await sell(cartWith([[milk, 3]], { discountPct: 10, discount: 0 }))
    expect(sale.total).toBe(2700)
    expect(unitRefundPrice(sale, 0, 0)).toBe(900)
    const r1 = await refund(sale, [{ index: 0, qty: 1 }])
    expect(r1.total).toBe(900)
    const r2 = await refund((await db.sales.get(sale.id))!, [{ index: 0, qty: 2 }])
    expect(r2.total).toBe(1800)
    const s = (await db.sales.get(sale.id))!
    expect(s.refunded).toBe(2700); expect(s.status).toBe('refunded')
  })

  it('fractions and rounding: the closing refund never leaves a stray unit', async () => {
    // 3 units for 1000 total with 0 decimals: 333 + 333 + 334
    await db.products.update('p1', { price: 1000 })
    const cart = cartWith([[milk, 3]])
    cart.lines[0].price = 333.3333
    const sale = await sell({ ...cart, lines: [{ ...cart.lines[0], price: 1000 / 3 }] })
    expect(sale.total).toBe(1000)
    const a = await refund(sale, [{ index: 0, qty: 1 }])
    const b = await refund((await db.sales.get(sale.id))!, [{ index: 0, qty: 1 }])
    const c = await refund((await db.sales.get(sale.id))!, [{ index: 0, qty: 1 }])
    expect(a.total + b.total + c.total).toBe(1000)
    expect((await db.sales.get(sale.id))!).toMatchObject({ refunded: 1000, status: 'refunded' })
    // weighed goods: a quarter kilo back
    const weighed = await sell(cartWith([[rice, 1.5]]))    // 4500
    const w = await refund(weighed, [{ index: 0, qty: 0.25 }])
    expect(w.total).toBe(750)
    expect((await db.products.get('p3'))!.stock).toBe(18.75)
    expect(remainingQty((await db.sales.get(weighed.id))!, [w], 0)).toEqual([1.25])
  })

  it('a sale whose money ran out before its items can still take the rest back (and restock it)', async () => {
    // 1000 + 500 with 1499 off: the customer paid 1. Refunding the milk hands back that 1 (0.67 rounds up)…
    const sale = await sell(cartWith([[milk, 1], [bread, 1]], { discount: 1499 }))
    expect(sale.total).toBe(1)
    const r1 = await refund(sale, [{ index: 0, qty: 1 }])
    expect(r1.total).toBe(1)
    let s = (await db.sales.get(sale.id))!
    expect(s.status).toBe('partial')                       // …but the bread is still out
    expect(canRefund(s, [r1], 0)).toBe(true)
    const r2 = await refund(s, [{ index: 1, qty: 1 }])
    expect(r2.total).toBe(0)                                // nothing more to hand back
    s = (await db.sales.get(sale.id))!
    expect(s).toMatchObject({ refunded: 1, status: 'refunded' })
    expect(remainingQty(s, [r1, r2], 0)).toEqual([0, 0])
    // a free sale (100% off) behaves the same way
    const free = await sell(cartWith([[milk, 2]], { discountPct: 100, discount: 0 }))
    expect(free.total).toBe(0)
    await refund(free, [{ index: 0, qty: 1 }])
    expect((await db.sales.get(free.id))!.status).toBe('partial')
    await refund((await db.sales.get(free.id))!, [{ index: 0, qty: 1 }])
    expect((await db.sales.get(free.id))!.status).toBe('refunded')
    expect((await db.products.get('p1'))!.stock).toBe(10)   // both milks back on the shelf
  })

  it('records the shift on the refund and its ledger entry', async () => {
    const shift = { id: 'sh1', userId: 'u1', userName: 'أحمد', openedAt: 0, openingCash: 0, cashIn: 0, cashOut: 0, status: 'open' as const }
    const sale = await sell(cartWith([[bread, 2]], { customerId: 'c1', customerName: 'علي' }), { method: 'credit' })
    const r = await refund(sale, [{ index: 0, qty: 2 }], { method: 'credit', shift })
    expect(r.shiftId).toBe('sh1')
    expect((await db.ledger.where('refId').equals(r.id).first())!.shiftId).toBe('sh1')
    expect(await db.refunds.where('shiftId').equals('sh1').count()).toBe(1)
  })
})

describe('pure helpers', () => {
  const base: Sale = {
    id: 's1', number: 7, createdAt: 0, subtotal: 2500, discount: 0, tax: 0, total: 2500, cost: 0, payments: [{ method: 'cash', amount: 2500 }],
    paid: 2500, change: 0, credit: 0, userId: 'u1', userName: 'x', status: 'completed', refunded: 0,
    items: [
      { name: 'حليب', productId: 'p1', unit: 'piece', qty: 2, price: 1000, originalPrice: 1000, cost: 0, discount: 0, taxRate: 0, tax: 0, total: 2000 },
      { name: 'خبز', unit: 'piece', qty: 1, price: 500, originalPrice: 500, cost: 0, discount: 0, taxRate: 0, tax: 0, total: 500 },
      { name: 'حليب', productId: 'p1', unit: 'piece', qty: 1, price: 800, originalPrice: 1000, cost: 0, discount: 0, taxRate: 0, tax: 0, total: 800 },
    ],
  }
  const sale: Sale = { ...base, subtotal: 3300, total: 3300, paid: 3300 }
  const mk = (items: Refund['items']): Refund => ({ id: 'r', saleId: 's1', saleNumber: 7, createdAt: 0, items, total: 0, method: 'cash', restock: true, userId: 'u1', userName: 'x' })

  it('remainingQty matches refunded items to the line with the same product, name and price', () => {
    expect(remainingQty(sale, [], 0)).toEqual([2, 1, 1])
    // the 800 line is matched by its price, not the first milk line
    expect(remainingQty(sale, [mk([{ productId: 'p1', name: 'حليب', qty: 1, price: 800, total: 800 }])], 0)).toEqual([2, 1, 0])
    // more than one line's worth spills over to the next line of the same product
    expect(remainingQty(sale, [mk([{ productId: 'p1', name: 'حليب', qty: 3, price: 1000, total: 3000 }])], 0)).toEqual([0, 1, 0])
    // a refund of another sale is ignored; custom lines match by name
    expect(remainingQty(sale, [{ ...mk([{ name: 'خبز', qty: 1, price: 500, total: 500 }]), saleId: 'other' }, mk([{ name: 'خبز', qty: 1, price: 500, total: 500 }])], 0)).toEqual([2, 0, 1])
  })

  it('refundTotal follows the effective unit price and is capped by what is left', () => {
    expect(refundLineTotal(sale, 0, 1, 0)).toBe(1000)
    expect(refundLineTotal(sale, 2, 1, 0)).toBe(800)
    expect(refundTotal(sale, [{ index: 0, qty: 2 }, { index: 1, qty: 1 }, { index: 2, qty: 1 }], 0)).toBe(3300)
    expect(refundTotal({ ...sale, refunded: 3000 }, [{ index: 0, qty: 2 }], 0)).toBe(300)
    expect(refundTotal(sale, [{ index: 0, qty: 0 }, { index: 9, qty: 1 }], 0)).toBe(0)
    // a sale discount lowers every line in proportion
    const disc: Sale = { ...sale, discount: 330, total: 2970 }
    expect(unitRefundPrice(disc, 0, 0)).toBe(900)
    expect(refundLineTotal(disc, 1, 1, 0)).toBe(450)
    expect(refundTotal(disc, [{ index: 0, qty: 2 }, { index: 1, qty: 1 }, { index: 2, qty: 1 }], 0)).toBe(2970)
    expect(canRefund({ ...sale, status: 'refunded' }, [], 0)).toBe(false)
    expect(canRefund(sale, [], 0)).toBe(true)
  })
})

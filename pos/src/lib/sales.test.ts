import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { DEFAULT_SETTINGS, type Product, type Settings, type User } from '../db/types'
import { emptyCart, addToCart, lineFromProduct, computeTotals, type Cart } from './cart'
import { completeSale, planPayment, SaleError, balanceAfterSale, saleErrorText } from './sales'

const settings: Settings = { ...DEFAULT_SETTINGS, store: { ...DEFAULT_SETTINGS.store, name: 'متجر الأمل' } }
const user: User = { id: 'u1', name: 'أحمد', role: 'cashier', active: true, createdAt: 0 }
const milk: Product = { id: 'p1', name: 'حليب', barcodes: ['6291041500213'], price: 1000, cost: 800, trackStock: true, stock: 10, lowStock: 2, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0 }
const bread: Product = { id: 'p2', name: 'خبز', barcodes: [], price: 500, cost: 300, trackStock: false, stock: 0, lowStock: 0, unit: 'piece', allowFraction: false, favorite: true, active: true, createdAt: 0, updatedAt: 0 }

function cartWith(lines: [Product, number][], extra: Partial<Cart> = {}): Cart {
  let c = emptyCart()
  for (const [p, q] of lines) c = addToCart(c, lineFromProduct(p, q, settings.tax.rate))
  return { ...c, ...extra }
}
function sell(cart: Cart, o: { method?: 'cash' | 'card' | 'transfer' | 'credit'; tendered?: number; shift?: null } = {}) {
  const totals = computeTotals(cart, settings.tax, settings.currency.decimals)
  const plan = planPayment({ total: totals.total, method: o.method ?? 'cash', tendered: o.tendered ?? totals.total, hasCustomer: !!cart.customerId, decimals: 0 })
  return completeSale({ cart, totals, payments: plan.payments, paid: plan.paid, change: plan.change, credit: plan.credit, user, shift: null, settings })
}

beforeEach(async () => {
  await db.delete(); await db.open()
  await db.products.bulkAdd([milk, bread])
  await db.customers.add({ id: 'c1', name: 'علي', balance: 2000, createdAt: 0, updatedAt: 0 })
})

describe('completeSale', () => {
  it('a carton takes 24 pieces off the stock and is refused when they are not there', async () => {
    const carton = { id: 'k1', name: 'كرتونة', qty: 24, price: 20000 }
    await db.products.put({ ...milk, stock: 30, packs: [carton] })
    const prod = (await db.products.get('p1'))!
    let cart = addToCart(emptyCart(), lineFromProduct(prod, 1, 0, { pack: carton }))
    cart = addToCart(cart, lineFromProduct(prod, 2))
    const s = await sell(cart)
    expect(s.total).toBe(22000); expect(s.cost).toBe(19200 + 1600)
    expect(s.items[0]).toMatchObject({ qty: 1, unitsPerQty: 24, packName: 'كرتونة' })
    expect((await db.products.get('p1'))!.stock).toBe(4)
    const moves = await db.stockMoves.where('refId').equals(s.id).sortBy('qty')
    expect(moves.map(m => m.qty)).toEqual([-24, -2])
    // 4 left: another carton does not fit
    const strict: Settings = { ...settings, pos: { ...settings.pos, allowNegativeStock: false } }
    const again = addToCart(emptyCart(), lineFromProduct(prod, 1, 0, { pack: carton }))
    const totals = computeTotals(again, strict.tax, 0)
    await expect(completeSale({ cart: again, totals, payments: [{ method: 'cash', amount: totals.total }], paid: totals.total, change: 0, credit: 0, user, shift: null, settings: strict })).rejects.toMatchObject({ key: 'sales.err.outOfStock' })
    expect((await db.products.get('p1'))!.stock).toBe(4)
  })

  it('writes the sale, decreases stock and numbers receipts 1, 2, 3', async () => {
    const s1 = await sell(cartWith([[milk, 2], [bread, 1]]))
    const s2 = await sell(cartWith([[bread, 3]]))
    const s3 = await sell(cartWith([[milk, 1]]))
    expect([s1.number, s2.number, s3.number]).toEqual([1, 2, 3])
    expect(s1.total).toBe(2500); expect(s1.status).toBe('completed'); expect(s1.items).toHaveLength(2)
    expect(s1.userName).toBe('أحمد'); expect(s1.cost).toBe(1900)
    expect((await db.products.get('p1'))!.stock).toBe(7)
    const moves = await db.stockMoves.where('productId').equals('p1').sortBy('createdAt')
    expect(moves.map(m => [m.type, m.qty, m.before, m.after, m.refId])).toEqual([['sale', -2, 10, 8, s1.id], ['sale', -1, 8, 7, s3.id]])
    expect(await db.stockMoves.where('productId').equals('p2').count()).toBe(0)   // bread does not track stock
    expect(await db.sales.count()).toBe(3)
    expect((await db.sales.get(s2.id))!.number).toBe(2)
  })

  it('computes change for cash', async () => {
    const s = await sell(cartWith([[milk, 2]]), { tendered: 5000 })
    expect(s.total).toBe(2000); expect(s.paid).toBe(5000); expect(s.change).toBe(3000); expect(s.credit).toBe(0)
    expect(s.payments).toEqual([{ method: 'cash', amount: 2000 }])
  })

  it('books the remainder on the customer account and writes a ledger entry', async () => {
    const cart = cartWith([[milk, 3]], { customerId: 'c1', customerName: 'علي' })
    const s = await sell(cart, { tendered: 1000 })
    expect(s.credit).toBe(2000); expect(s.paid).toBe(1000); expect(s.change).toBe(0)
    expect(s.payments).toEqual([{ method: 'cash', amount: 1000 }, { method: 'credit', amount: 2000 }])
    expect((await db.customers.get('c1'))!.balance).toBe(4000)
    const rows = await db.ledger.where('customerId').equals('c1').toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'sale', amount: 2000, balanceAfter: 4000, refId: s.id, method: 'credit', userId: 'u1' })
    expect(await balanceAfterSale(s)).toBe(4000)
  })

  it('puts the whole total on credit', async () => {
    const s = await sell(cartWith([[bread, 2]], { customerId: 'c1', customerName: 'علي' }), { method: 'credit' })
    expect(s.credit).toBe(1000); expect(s.paid).toBe(0); expect(s.payments).toEqual([{ method: 'credit', amount: 1000 }])
    expect((await db.customers.get('c1'))!.balance).toBe(3000)
  })

  it('refuses credit without a customer and writes nothing', async () => {
    const cart = cartWith([[milk, 1]])
    const totals = computeTotals(cart, settings.tax, 0)
    await expect(completeSale({ cart, totals, payments: [{ method: 'credit', amount: 1000 }], paid: 0, change: 0, credit: 1000, user, shift: null, settings }))
      .rejects.toMatchObject({ key: 'sales.err.creditNoCustomer' })
    expect(await db.sales.count()).toBe(0)
    expect((await db.products.get('p1'))!.stock).toBe(10)
    expect(await db.ledger.count()).toBe(0)
  })

  it('refuses an empty cart and amounts that do not add up', async () => {
    const empty = emptyCart()
    await expect(completeSale({ cart: empty, totals: computeTotals(empty, settings.tax, 0), payments: [], paid: 0, change: 0, credit: 0, user, shift: null, settings })).rejects.toBeInstanceOf(SaleError)
    const cart = cartWith([[milk, 1]])
    const totals = computeTotals(cart, settings.tax, 0)
    await expect(completeSale({ cart, totals, payments: [{ method: 'cash', amount: 500 }], paid: 500, change: 0, credit: 0, user, shift: null, settings })).rejects.toMatchObject({ key: 'sales.err.paymentMismatch' })
    expect(await db.sales.count()).toBe(0)
  })

  it('refuses to sell more than the stock when negative stock is not allowed, and rolls back', async () => {
    const strict: Settings = { ...settings, pos: { ...settings.pos, allowNegativeStock: false } }
    const cart = cartWith([[bread, 1], [milk, 11]])
    const totals = computeTotals(cart, strict.tax, 0)
    const plan = planPayment({ total: totals.total, method: 'cash', tendered: totals.total, hasCustomer: false, decimals: 0 })
    await expect(completeSale({ cart, totals, payments: plan.payments, paid: plan.paid, change: plan.change, credit: plan.credit, user, shift: null, settings: strict }))
      .rejects.toMatchObject({ key: 'sales.err.outOfStock', vars: { name: 'حليب' } })
    expect(await db.sales.count()).toBe(0)
    expect(await db.stockMoves.count()).toBe(0)
    expect((await db.kv.get('counter:sale'))).toBeUndefined()   // the number was not consumed
    // with negative stock allowed the same sale goes through
    const s = await sell(cart)
    expect(s.number).toBe(1)
    expect((await db.products.get('p1'))!.stock).toBe(-1)
  })

  it('translates errors', () => {
    const t = (k: string, vars?: Record<string, string | number>) => `${k}${vars ? JSON.stringify(vars) : ''}`
    expect(saleErrorText(new SaleError('sales.err.outOfStock', { name: 'x' }), t)).toBe('sales.err.outOfStock{"name":"x"}')
    expect(saleErrorText(new Error('boom'), t)).toBe('common.error')
  })
})

describe('planPayment', () => {
  it('cash with change', () => {
    const p = planPayment({ total: 4500, method: 'cash', tendered: 5000, hasCustomer: false, decimals: 0 })
    expect(p).toMatchObject({ valid: true, paid: 5000, change: 500, credit: 0, short: 0, payments: [{ method: 'cash', amount: 4500 }] })
  })
  it('exact card payment never gives change', () => {
    const p = planPayment({ total: 100.5, method: 'card', tendered: 200, hasCustomer: false, decimals: 2 })
    expect(p).toMatchObject({ valid: true, paid: 100.5, change: 0, credit: 0 })
  })
  it('short without a customer is not valid', () => {
    const p = planPayment({ total: 1000, method: 'cash', tendered: 700, hasCustomer: false, decimals: 0 })
    expect(p).toMatchObject({ valid: false, short: 300, credit: 0, reason: 'sales.pay.shortNoCustomer' })
  })
  it('short with a customer puts the rest on credit', () => {
    const p = planPayment({ total: 1000, method: 'transfer', tendered: 700, hasCustomer: true, decimals: 0 })
    expect(p).toMatchObject({ valid: true, paid: 700, credit: 300, payments: [{ method: 'transfer', amount: 700 }, { method: 'credit', amount: 300 }] })
  })
  it('zero received with a customer asks for an amount (use the credit method instead)', () => {
    const p = planPayment({ total: 1000, method: 'cash', tendered: 0, hasCustomer: true, decimals: 0 })
    expect(p).toMatchObject({ valid: false, reason: 'sales.pay.enterAmount' })
  })
  it('credit needs a customer', () => {
    expect(planPayment({ total: 1000, method: 'credit', tendered: 0, hasCustomer: false, decimals: 0 })).toMatchObject({ valid: false, reason: 'sales.err.creditNoCustomer' })
    expect(planPayment({ total: 1000, method: 'credit', tendered: 0, hasCustomer: true, decimals: 0 })).toMatchObject({ valid: true, credit: 1000, paid: 0, change: 0 })
  })
})

describe('second currency on a sale', () => {
  it('keeps what was received in the second currency', async () => {
    const { db } = await import('../db')
    const { completeSale, planPayment } = await import('./sales')
    const { emptyCart, addToCart, lineFromProduct, computeTotals } = await import('./cart')
    const { DEFAULT_SETTINGS } = await import('../db/types')
    await db.delete(); await db.open()
    const product = { id: 'fxp', name: 'x', barcodes: [], price: 14000, cost: 10000, trackStock: false, stock: 0, lowStock: 0, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0 }
    await db.products.add(product)
    const cart = addToCart(emptyCart(), lineFromProduct(product))
    const settings = { ...DEFAULT_SETTINGS, currency2: { enabled: true, code: 'USD', symbol: '$', decimals: 2, symbolAfter: false, rate: 13000 } }
    const totals = computeTotals(cart, settings.tax, 0)
    const plan = planPayment({ total: totals.total, method: 'cash', tendered: 26000, hasCustomer: false, decimals: 0 })
    const fx = { code: 'USD', symbol: '$', symbolAfter: false, decimals: 2, rate: 13000, received: 2, receivedPrimary: 26000 }
    const user = { id: 'u', name: 'u', role: 'admin' as const, active: true, createdAt: 0 }
    const sale = await completeSale({ cart, totals, payments: plan.payments, paid: plan.paid, change: plan.change, credit: plan.credit, fx, user, shift: null, settings })
    expect(sale.change).toBe(12000)
    expect(sale.fx).toEqual(fx)
    const { receiptText } = await import('./receipt')
    const text = receiptText(sale, settings)
    expect(text).toContain('$')
    expect(text).toMatch(/13,000/)
  })
})

describe('loyalty on a sale', () => {
  it('earns points on the total and redeems what the cart asked for', async () => {
    const { db } = await import('../db')
    const { completeSale, planPayment } = await import('./sales')
    const { emptyCart, addToCart, lineFromProduct, computeTotals } = await import('./cart')
    const { DEFAULT_SETTINGS } = await import('../db/types')
    await db.delete(); await db.open()
    const product = { id: 'lp', name: 'x', barcodes: [], price: 10000, cost: 8000, trackStock: false, stock: 0, lowStock: 0, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0 }
    await db.products.add(product)
    await db.customers.add({ id: 'c1', name: 'Ali', balance: 0, points: 150, createdAt: 0, updatedAt: 0 })
    const settings = { ...DEFAULT_SETTINGS, loyalty: { enabled: true, earnPer: 1000, pointValue: 10, minRedeem: 100 } }
    let cart = addToCart(emptyCart(), lineFromProduct(product, 2))
    cart = { ...cart, customerId: 'c1', customerName: 'Ali', redeemPoints: 150, discount: 1500 }
    const totals = computeTotals(cart, settings.tax, 0)
    expect(totals.total).toBe(18500)
    const plan = planPayment({ total: totals.total, method: 'cash', tendered: 18500, hasCustomer: true, decimals: 0 })
    const user = { id: 'u', name: 'u', role: 'admin' as const, active: true, createdAt: 0 }
    const sale = await completeSale({ cart, totals, payments: plan.payments, paid: plan.paid, change: plan.change, credit: plan.credit, user, shift: null, settings })
    expect(sale.pointsRedeemed).toBe(150)
    expect(sale.pointsEarned).toBe(18)
    expect((await db.customers.get('c1'))!.points).toBe(18)
  })

  it('never takes more points than the discount is worth, and refuses points the customer no longer has', async () => {
    const { db } = await import('../db')
    const { completeSale, planPayment } = await import('./sales')
    const { emptyCart, addToCart, lineFromProduct, computeTotals } = await import('./cart')
    const { DEFAULT_SETTINGS } = await import('../db/types')
    await db.delete(); await db.open()
    const product = { id: 'lp', name: 'x', barcodes: [], price: 1000, cost: 800, trackStock: false, stock: 0, lowStock: 0, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0 }
    await db.products.add(product)
    await db.customers.add({ id: 'c1', name: 'Ali', balance: 0, points: 150, createdAt: 0, updatedAt: 0 })
    const settings = { ...DEFAULT_SETTINGS, loyalty: { enabled: true, earnPer: 1000, pointValue: 10, minRedeem: 100 } }
    const user = { id: 'u', name: 'u', role: 'admin' as const, active: true, createdAt: 0 }
    // 150 points (1500) were redeemed, then the cart shrank to one item of 1000: the discount is capped at 1000…
    const cart = { ...addToCart(emptyCart(), lineFromProduct(product, 1)), customerId: 'c1', customerName: 'Ali', redeemPoints: 150, discount: 1500 }
    const totals = computeTotals(cart, settings.tax, 0)
    expect(totals.discount).toBe(1000); expect(totals.total).toBe(0)
    const plan = planPayment({ total: 0, method: 'cash', tendered: 0, hasCustomer: true, decimals: 0 })
    const sale = await completeSale({ cart, totals, payments: plan.payments, paid: plan.paid, change: plan.change, credit: plan.credit, user, shift: null, settings })
    expect(sale.pointsRedeemed).toBe(100)                      // …so only 100 points are consumed
    expect((await db.customers.get('c1'))!.points).toBe(50)
    // the 50 left do not cover another 100-point redeem: refused, nothing written
    const again = { ...addToCart(emptyCart(), lineFromProduct(product, 1)), customerId: 'c1', customerName: 'Ali', redeemPoints: 100, discount: 1000 }
    const t2 = computeTotals(again, settings.tax, 0)
    await expect(completeSale({ cart: again, totals: t2, payments: plan.payments, paid: 0, change: 0, credit: 0, user, shift: null, settings })).rejects.toMatchObject({ key: 'sales.err.points' })
    expect(await db.sales.count()).toBe(1)
    expect((await db.customers.get('c1'))!.points).toBe(50)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import type { Product, User } from '../db/types'
import { createPurchase, paySupplier, deletePurchase, purchaseTotal, purchaseRemaining, isSupplierPayment, PurchaseError, type PurchaseRecord } from './purchases'
import { openShift } from './shifts'

const user: User = { id: 'u1', name: 'Sami', role: 'admin', active: true, createdAt: 0 }
const product = (id: string, o: Partial<Product> = {}): Product => ({
  id, name: id, barcodes: [], price: 100, cost: 60, trackStock: true, stock: 5, lowStock: 0, unit: 'piece', allowFraction: false,
  favorite: false, active: true, createdAt: 0, updatedAt: 0, ...o,
})

beforeEach(async () => {
  await db.delete(); await db.open()
  await db.products.bulkAdd([product('a'), product('b', { allowFraction: true, stock: 2.5 }), product('c', { trackStock: false })])
  await db.suppliers.add({ id: 'sup', name: 'Al-Noor', balance: 100, createdAt: 0 })
})

describe('purchaseTotal / purchaseRemaining', () => {
  it('sums rounded line totals', () => {
    expect(purchaseTotal([{ qty: 2, cost: 10.005 }, { qty: 0.5, cost: 3 }], 2)).toBe(21.51)
    expect(purchaseTotal([], 0)).toBe(0)
    expect(purchaseRemaining({ total: 100, paid: 40 }, 0)).toBe(60)
  })
})

describe('createPurchase', () => {
  it('numbers, moves stock in, updates cost (not price) and books the supplier balance in one go', async () => {
    const p = await createPurchase({
      supplierId: 'sup', user, decimals: 0, paid: 150, method: 'cash', note: ' inv 77 ',
      items: [{ productId: 'a', name: 'a', qty: 10, cost: 55 }, { productId: 'b', name: 'b', qty: 1.25, cost: 40 }, { productId: 'c', name: 'c', qty: 3, cost: 7 }],
    })
    expect(p.number).toBe(1)
    expect(p.total).toBe(10 * 55 + 50 + 21)
    expect(p.paid).toBe(150)
    expect(p.method).toBe('cash')
    expect(p.note).toBe('inv 77')
    expect(p.supplierName).toBe('Al-Noor')
    expect(isSupplierPayment(p)).toBe(false)
    const a = (await db.products.get('a'))!
    expect(a.stock).toBe(15)
    expect(a.cost).toBe(55)
    expect(a.price).toBe(100)
    expect((await db.products.get('b'))!.stock).toBe(3.75)
    // untracked product: no stock move, but the cost still updates
    const c = (await db.products.get('c'))!
    expect(c.stock).toBe(5)
    expect(c.cost).toBe(7)
    const moves = await db.stockMoves.where('refId').equals(p.id).toArray()
    expect(moves.map(m => [m.productId, m.qty, m.type, m.before, m.after])).toEqual([['a', 10, 'purchase', 5, 15], ['b', 1.25, 'purchase', 2.5, 3.75]])
    expect((await db.suppliers.get('sup'))!.balance).toBe(100 + 621 - 150)
    const second = await createPurchase({ user, paid: 0, items: [{ productId: 'a', name: 'a', qty: 1, cost: 55 }] })
    expect(second.number).toBe(2)
    expect(second.method).toBeUndefined()
    expect(second.supplierId).toBeUndefined()
  })

  it('refuses empty or inconsistent input without writing anything', async () => {
    await expect(createPurchase({ user, paid: 0, items: [] })).rejects.toMatchObject({ key: 'inventory.err.noItems' })
    await expect(createPurchase({ user, paid: 0, items: [{ productId: 'a', name: 'a', qty: 0, cost: 1 }] })).rejects.toMatchObject({ key: 'inventory.err.noItems' })
    await expect(createPurchase({ user, paid: 500, items: [{ productId: 'a', name: 'a', qty: 1, cost: 10 }] })).rejects.toBeInstanceOf(PurchaseError)
    await expect(createPurchase({ user, paid: 0, items: [{ productId: 'a', name: 'a', qty: 1, cost: -1 }] })).rejects.toMatchObject({ key: 'inventory.err.cost' })
    expect(await db.purchases.count()).toBe(0)
    expect(await db.stockMoves.count()).toBe(0)
    expect((await db.products.get('a'))!.stock).toBe(5)
  })

  it('takes cash out of an open drawer when asked', async () => {
    const shift = await openShift({ user, openingCash: 1000, decimals: 0 })
    const p = await createPurchase({ user, paid: 200, method: 'cash', drawerShiftId: shift.id, decimals: 0, items: [{ productId: 'a', name: 'a', qty: 4, cost: 50 }] })
    expect(p.shiftId).toBe(shift.id)
    const moves = await db.cashMoves.where('shiftId').equals(shift.id).toArray()
    expect(moves.map(m => [m.type, m.amount, m.note])).toEqual([['out', 200, '#1']])
    expect((await db.shifts.get(shift.id))!.cashOut).toBe(200)
    // card payments never touch the drawer
    const q = await createPurchase({ user, paid: 50, method: 'card', drawerShiftId: shift.id, decimals: 0, items: [{ productId: 'a', name: 'a', qty: 1, cost: 50 }] })
    expect(q.shiftId).toBeUndefined()
    expect(await db.cashMoves.count()).toBe(1)
  })
})

describe('paySupplier', () => {
  it('lowers the balance and is listed as an item-less purchase', async () => {
    const pay = await paySupplier({ supplierId: 'sup', amount: 60, method: 'transfer', user, decimals: 0 })
    expect(isSupplierPayment(pay)).toBe(true)
    expect(pay.total).toBe(0)
    expect(pay.paid).toBe(60)
    expect(pay.number).toBe(1)
    expect((await db.suppliers.get('sup'))!.balance).toBe(40)
    await expect(paySupplier({ supplierId: 'sup', amount: 0, user })).rejects.toMatchObject({ key: 'inventory.err.amount' })
    await expect(paySupplier({ supplierId: 'ghost', amount: 5, user })).rejects.toMatchObject({ key: 'inventory.err.noSupplier' })
    expect(await db.purchases.count()).toBe(1)
  })
})

describe('deletePurchase', () => {
  it('reverses stock, supplier balance and open-drawer cash', async () => {
    const shift = await openShift({ user, openingCash: 0, decimals: 0 })
    const p = await createPurchase({ supplierId: 'sup', user, paid: 100, method: 'cash', drawerShiftId: shift.id, decimals: 0, items: [{ productId: 'a', name: 'a', qty: 3, cost: 50 }] })
    expect((await db.suppliers.get('sup'))!.balance).toBe(150)
    await deletePurchase(p.id, user, 0)
    expect(await db.purchases.get(p.id)).toBeUndefined()
    expect((await db.products.get('a'))!.stock).toBe(5)
    expect((await db.suppliers.get('sup'))!.balance).toBe(100)
    const adj = await db.stockMoves.where('type').equals('adjust').toArray()
    expect(adj.map(m => [m.qty, m.before, m.after, m.note])).toEqual([[-3, 8, 5, '#1']])
    const moves = await db.cashMoves.where('shiftId').equals(shift.id).sortBy('createdAt')
    expect(moves.map(m => [m.type, m.amount])).toEqual([['out', 100], ['in', 100]])
    const sh = (await db.shifts.get(shift.id))!
    expect(sh.cashIn).toBe(100); expect(sh.cashOut).toBe(100)
  })
  it('reverses a supplier payment and tolerates a missing purchase', async () => {
    const pay = await paySupplier({ supplierId: 'sup', amount: 30, user, decimals: 0 })
    await deletePurchase(pay.id, user, 0)
    expect((await db.suppliers.get('sup'))!.balance).toBe(100)
    await deletePurchase('missing', user)
    expect(await db.purchases.count()).toBe(0)
  })
  it('keeps the record shape readable as PurchaseRecord', async () => {
    const p = await createPurchase({ user, paid: 10, method: 'card', items: [{ productId: 'a', name: 'a', qty: 1, cost: 10 }] })
    const row = (await db.purchases.get(p.id)) as PurchaseRecord
    expect(row.method).toBe('card')
  })
})

describe('invoices in the second currency', () => {
  const usd = { code: 'USD', symbol: '$', decimals: 2, symbolAfter: false, rate: 13000 }
  it('derives the lira figures at the invoice rate, keeps the $ invoice, sets the products\' fxCost and moves fxBalance only', async () => {
    const p = await createPurchase({
      supplierId: 'sup', user, decimals: 0, paid: 10, method: 'cash', fx: usd,
      items: [{ productId: 'a', name: 'a', qty: 10, cost: 0, fxCost: 1.25 }, { productId: 'b', name: 'b', qty: 2, cost: 19500 }],   // b typed in lira: derived
    })
    expect(p.items[0]).toMatchObject({ cost: 16250, fxCost: 1.25 })
    expect(p.items[1]).toMatchObject({ cost: 19500, fxCost: 1.5 })
    expect(p.fx).toEqual({ ...usd, total: 15.5, paid: 10 })
    expect(p.total).toBe(201500); expect(p.paid).toBe(130000)
    const a = (await db.products.get('a'))!
    expect(a.cost).toBe(16250); expect(a.fxCost).toBe(1.25); expect(a.price).toBe(100); expect(a.stock).toBe(15)
    const sup = (await db.suppliers.get('sup'))!
    expect(sup.balance).toBe(100); expect(sup.fxBalance).toBe(5.5)
    // paying in dollars lowers fxBalance; the record keeps the lira equivalent as paid
    const pay = await paySupplier({ supplierId: 'sup', amount: 2, user, decimals: 0, fx: usd })
    expect(pay.paid).toBe(26000); expect(pay.fx).toEqual({ ...usd, total: 0, paid: 2 })
    expect((await db.suppliers.get('sup'))!.fxBalance).toBe(3.5)
    // deleting reverses by the same rule
    await deletePurchase(p.id, user, 0)
    expect((await db.suppliers.get('sup'))!.fxBalance).toBe(-2)
    expect((await db.suppliers.get('sup'))!.balance).toBe(100)
    await deletePurchase(pay.id, user, 0)
    expect((await db.suppliers.get('sup'))!.fxBalance).toBe(0)
  })
  it('validates the $ figures and refuses a missing rate', async () => {
    await expect(createPurchase({ user, paid: 0, fx: { ...usd, rate: 0 }, items: [{ productId: 'a', name: 'a', qty: 1, cost: 0, fxCost: 1 }] })).rejects.toMatchObject({ key: 'inventory.err.rate' })
    await expect(createPurchase({ user, paid: 1.01, fx: usd, items: [{ productId: 'a', name: 'a', qty: 1, cost: 0, fxCost: 1 }] })).rejects.toMatchObject({ key: 'inventory.err.paid' })
    await expect(createPurchase({ user, paid: 0, fx: usd, items: [{ productId: 'a', name: 'a', qty: 1, cost: 0, fxCost: -1 }] })).rejects.toMatchObject({ key: 'inventory.err.cost' })
    await expect(paySupplier({ supplierId: 'sup', amount: 1, user, fx: { ...usd, rate: 0 } })).rejects.toMatchObject({ key: 'inventory.err.rate' })
    expect(await db.purchases.count()).toBe(0)
  })
  it('a lira invoice on a product bought in dollars re-expresses fxCost at the current rate, or drops it', async () => {
    await db.products.put(product('a', { cost: 16250, fxCost: 1.25 }))
    await createPurchase({ user, paid: 0, decimals: 0, currency2: { rate: 14000 }, items: [{ productId: 'a', name: 'a', qty: 1, cost: 14000 }] })
    expect((await db.products.get('a'))).toMatchObject({ cost: 14000, fxCost: 1 })
    await createPurchase({ user, paid: 0, decimals: 0, items: [{ productId: 'a', name: 'a', qty: 1, cost: 15000 }] })
    const a = (await db.products.get('a'))!
    expect(a.cost).toBe(15000); expect(a.fxCost).toBeUndefined()
  })
  it('takes the lira equivalent out of the drawer', async () => {
    const shift = await openShift({ user, openingCash: 0, decimals: 0 })
    const p = await createPurchase({ user, paid: 1, method: 'cash', drawerShiftId: shift.id, decimals: 0, fx: usd, items: [{ productId: 'a', name: 'a', qty: 1, cost: 0, fxCost: 1 }] })
    expect(p.shiftId).toBe(shift.id)
    expect((await db.shifts.get(shift.id))!.cashOut).toBe(13000)
  })
})

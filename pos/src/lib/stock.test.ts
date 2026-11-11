import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db'
import { applyStock, setStock } from './stock'
import { applyLedger } from './ledger'

beforeEach(async () => { await db.delete(); await db.open() })

describe('stock', () => {
  it('moves stock and records before/after', async () => {
    await db.products.add({ id: 'p', name: 'x', barcodes: [], price: 1, cost: 1, trackStock: true, stock: 5, lowStock: 0, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0 })
    await applyStock([{ productId: 'p', qty: -2, type: 'sale', refId: 's1' }])
    expect((await db.products.get('p'))!.stock).toBe(3)
    await setStock('p', 10)
    expect((await db.products.get('p'))!.stock).toBe(10)
    const moves = await db.stockMoves.where('productId').equals('p').sortBy('createdAt')
    expect(moves.map(m => [m.before, m.after])).toEqual([[5, 3], [3, 10]])
  })
  it('skips products that do not track stock', async () => {
    await db.products.add({ id: 'q', name: 'y', barcodes: [], price: 1, cost: 1, trackStock: false, stock: 0, lowStock: 0, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0 })
    await applyStock([{ productId: 'q', qty: -2, type: 'sale' }])
    expect((await db.products.get('q'))!.stock).toBe(0)
    expect(await db.stockMoves.count()).toBe(0)
  })
  it('works inside a wider transaction', async () => {
    await db.products.add({ id: 'p', name: 'x', barcodes: [], price: 1, cost: 1, trackStock: true, stock: 5, lowStock: 0, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0 })
    await db.transaction('rw', db.products, db.stockMoves, db.sales, async () => {
      await applyStock([{ productId: 'p', qty: -1, type: 'sale' }])
    })
    expect((await db.products.get('p'))!.stock).toBe(4)
  })
})

describe('ledger', () => {
  it('keeps the running balance', async () => {
    await db.customers.add({ id: 'c', name: 'Ali', balance: 0, createdAt: 0, updatedAt: 0 })
    await applyLedger({ customerId: 'c', type: 'sale', amount: 1500, userId: 'u' }, 0)
    const b = await applyLedger({ customerId: 'c', type: 'payment', amount: -500, userId: 'u', method: 'cash' }, 0)
    expect(b).toBe(1000)
    expect((await db.customers.get('c'))!.balance).toBe(1000)
    const rows = await db.ledger.where('customerId').equals('c').sortBy('createdAt')
    expect(rows.map(r => r.balanceAfter)).toEqual([1500, 1000])
  })
})

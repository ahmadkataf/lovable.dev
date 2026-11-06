import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../db'
import type { Product } from '../../db/types'
import { runImport } from './import-run'

const base: Product = { id: 'p1', name: 'حليب', barcodes: ['6291041500213'], price: 1000, cost: 800, trackStock: true, stock: 5, lowStock: 2, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 1, updatedAt: 1 }

beforeEach(async () => { await db.delete(); await db.open() })

describe('runImport', () => {
  it('updates by barcode, creates the rest, and books stock as import moves', async () => {
    await db.products.add(base)
    const report = await runImport([
      { line: 2, name: 'حليب كامل', barcodes: ['6291041500213'], price: 1500, cost: 1100, stock: 12, category: 'ألبان' },
      { line: 3, name: 'سكر', barcodes: [], price: 900, stock: 30, category: 'مواد غذائية', unit: 'kg' },
      { line: 4, name: 'خبز', barcodes: ['111'] },                     // no price: skipped
      { line: 5, name: '', barcodes: [] },                              // empty: skipped
    ], { stockMapped: true, decimals: 0, userId: 'u1' })

    expect(report.created).toBe(1)
    expect(report.updated).toBe(1)
    expect(report.categoriesCreated).toBe(2)
    expect(report.skipped.map(s => s.reason)).toEqual(['noPrice', 'empty'])

    const milk = (await db.products.get('p1'))!
    expect(milk.price).toBe(1500)
    expect(milk.cost).toBe(1100)
    expect(milk.stock).toBe(12)
    expect(milk.name).toBe('حليب')                 // an existing name is kept
    expect(milk.categoryId).toBeTruthy()
    const sugar = (await db.products.where('name').equals('سكر').first())!
    expect(sugar.price).toBe(900)
    expect(sugar.trackStock).toBe(true)
    expect(sugar.stock).toBe(30)
    expect(sugar.unit).toBe('kg')

    const moves = await db.stockMoves.toArray()
    expect(moves).toHaveLength(2)
    expect(moves.every(m => m.type === 'import')).toBe(true)
    expect(moves.find(m => m.productId === 'p1')).toMatchObject({ qty: 7, before: 5, after: 12, userId: 'u1' })
    expect(moves.find(m => m.productId === sugar.id)).toMatchObject({ qty: 30, before: 0, after: 30 })
    expect(await db.categories.count()).toBe(2)
  })

  it('matches by exact name when there is no barcode and adds new barcodes', async () => {
    await db.products.add({ ...base, barcodes: [] })
    const report = await runImport([{ line: 2, name: 'حليب', barcodes: ['999'], price: 1200 }], { stockMapped: false, decimals: 0 })
    expect(report.updated).toBe(1)
    const p = (await db.products.get('p1'))!
    expect(p.barcodes).toEqual(['999'])
    expect(p.price).toBe(1200)
    expect(p.stock).toBe(5)                       // stock untouched when no stock column was mapped
    expect(await db.stockMoves.count()).toBe(0)
  })

  it('reuses categories by name regardless of case and spacing', async () => {
    await db.categories.add({ id: 'c1', name: 'ألبان', color: '#000', sort: 1, createdAt: 0 })
    const report = await runImport([
      { line: 2, name: 'a', barcodes: [], price: 1, category: ' ألبان ' },
      { line: 3, name: 'b', barcodes: [], price: 1, category: 'ألبان' },
    ], { stockMapped: false })
    expect(report.categoriesCreated).toBe(0)
    const all = await db.products.toArray()
    expect(all.every(p => p.categoryId === 'c1')).toBe(true)
  })

  it('does not touch stock on a product that tracks nothing unless a stock column is mapped', async () => {
    await db.products.add({ ...base, trackStock: false, stock: 0 })
    await runImport([{ line: 2, name: 'حليب', barcodes: ['6291041500213'], price: 1000, stock: 4 }], { stockMapped: false })
    expect((await db.products.get('p1'))!.trackStock).toBe(false)
    await runImport([{ line: 2, name: 'حليب', barcodes: ['6291041500213'], price: 1000, stock: 4 }], { stockMapped: true })
    const p = (await db.products.get('p1'))!
    expect(p.trackStock).toBe(true)
    expect(p.stock).toBe(4)
  })
})

describe('runImport with a second currency', () => {
  const c2 = { rate: 13000, roundTo: 100, roundMode: 'nearest' as const, decimals: 2 }

  it('a row with fxPrice anchors the product and ignores the price cell; a new one is created from the anchor', async () => {
    await db.products.add(base)
    const report = await runImport([
      { line: 2, name: 'حليب', barcodes: ['6291041500213'], price: 999999, fxPrice: 1.25, fxCost: 0.97 },
      { line: 3, name: 'زيت', barcodes: [], fxPrice: 9.99 },                      // no lira price at all: fine
    ], { stockMapped: false, decimals: 0, currency2: c2 })
    expect(report.updated).toBe(1)
    expect(report.created).toBe(1)
    expect(report.skipped).toEqual([])
    const milk = (await db.products.get('p1'))!
    expect(milk.fxPrice).toBe(1.25)
    expect(milk.price).toBe(16300)                  // 16,250 → step 100, not the 999,999 cell
    expect(milk.fxCost).toBe(0.97)
    expect(milk.cost).toBe(12610)                   // exact
    expect(milk.repricedAt).toBeTypeOf('number')
    const oil = (await db.products.where('name').equals('زيت').first())!
    expect(oil.fxPrice).toBe(9.99)
    expect(oil.price).toBe(129900)
    expect(oil.fxCost).toBeUndefined()
    expect(oil.cost).toBe(0)
  })

  it('a row with only a lira price on an anchored product sets it and un-anchors it (explicit lira wins)', async () => {
    await db.products.add({ ...base, price: 16300, fxPrice: 1.25, fxWholesalePrice: 1.1, wholesalePrice: 14300, fxCost: 0.97, cost: 12610, packs: [{ id: 'k', name: 'كرتونة', qty: 12, price: 190000, fxPrice: 14.6 }] })
    const report = await runImport([{ line: 2, name: 'حليب', barcodes: ['6291041500213'], price: 17000 }], { stockMapped: false, decimals: 0, currency2: c2 })
    expect(report.updated).toBe(1)
    const p = (await db.products.get('p1'))!
    expect(p.price).toBe(17000)
    expect(p.fxPrice).toBeUndefined()
    expect(p.fxWholesalePrice).toBeUndefined()
    expect(p.packs![0].fxPrice).toBeUndefined()
    expect(p.packs![0].price).toBe(190000)
    expect(p.fxCost).toBe(0.97)                     // the cost anchor is kept: no cost cell in the row
    expect(p.cost).toBe(12610)
    // a lira cost cell drops the cost anchor the same way
    await runImport([{ line: 2, name: 'حليب', barcodes: ['6291041500213'], cost: 13000 }], { stockMapped: false, decimals: 0, currency2: c2 })
    const q = (await db.products.get('p1'))!
    expect(q.fxCost).toBeUndefined()
    expect(q.cost).toBe(13000)
    expect(q.price).toBe(17000)
  })

  it('a row with a lira price on an unanchored product behaves as before, and a lira row on an anchored product without a rate still un-anchors', async () => {
    await db.products.add({ ...base, fxPrice: 1.25, price: 16300 })
    await runImport([{ line: 2, name: 'حليب', barcodes: ['6291041500213'], price: 2000 }], { stockMapped: false, decimals: 0 })
    const p = (await db.products.get('p1'))!
    expect(p.price).toBe(2000)
    expect(p.fxPrice).toBeUndefined()
  })

  it("skips rows with fxPrice / fxCost when there is no usable rate ('noRate')", async () => {
    await db.products.add(base)
    const noRate = await runImport([
      { line: 2, name: 'حليب', barcodes: ['6291041500213'], fxPrice: 1.25 },
      { line: 3, name: 'زيت', barcodes: [], fxCost: 8.5, price: 1000 },
      { line: 4, name: 'سكر', barcodes: [], price: 900 },
    ], { stockMapped: false, decimals: 0, currency2: { ...c2, rate: 0 } })
    expect(noRate.skipped.map(s => [s.line, s.reason])).toEqual([[2, 'noRate'], [3, 'noRate']])
    expect(noRate.created).toBe(1)
    expect((await db.products.get('p1'))!.price).toBe(1000)      // untouched
    const none = await runImport([{ line: 2, name: 'حليب', barcodes: ['6291041500213'], fxPrice: 1.25 }], { stockMapped: false, decimals: 0 })
    expect(none.skipped.map(s => s.reason)).toEqual(['noRate'])
    const neg = await runImport([{ line: 2, name: 'x', barcodes: [], fxPrice: -1 }], { stockMapped: false, decimals: 0, currency2: c2 })
    expect(neg.skipped.map(s => s.reason)).toEqual(['badPrice'])
  })

  it('still refuses tobacco rows, anchored or not', async () => {
    const report = await runImport([{ line: 2, name: 'مارلبورو', barcodes: [], fxPrice: 2 }], { stockMapped: false, decimals: 0, currency2: c2 })
    expect(report.skipped.map(s => s.reason)).toEqual(['policy'])
    expect(await db.products.count()).toBe(0)
  })
})

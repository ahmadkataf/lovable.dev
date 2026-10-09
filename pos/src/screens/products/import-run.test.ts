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

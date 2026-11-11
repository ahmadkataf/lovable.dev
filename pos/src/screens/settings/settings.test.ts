import { describe, it, expect, beforeEach } from 'vitest'
import type { User } from '../../db/types'
import { DEFAULT_SETTINGS } from '../../db/types'
import { deleteBlock, deactivateBlock, demoteBlock, isLastActiveAdmin, validatePin, normalizePin, addQuickAmount, QUICK_MAX } from './users'
import { fitSize } from './logo'
import { sampleSale } from './sample'
import { buildSampleRows, insertSampleProducts, SAMPLE_PRODUCTS, SAMPLE_CATEGORIES } from './sampleData'
import { db } from '../../db'
import { isValidEan13 } from '../../lib/barcode'
import './i18n'

const u = (id: string, role: User['role'], active = true): User => ({ id, name: id, role, active, createdAt: 0 })

describe('user guards', () => {
  const admin = u('a', 'admin'), admin2 = u('b', 'admin'), cashier = u('c', 'cashier'), offAdmin = u('d', 'admin', false)
  it('the last active admin cannot be deleted, deactivated or demoted', () => {
    const users = [admin, cashier, offAdmin]
    expect(isLastActiveAdmin(users, admin)).toBe(true)
    expect(deleteBlock(users, admin, 'c')).toBe('lastAdmin')
    expect(deactivateBlock(users, admin, 'c')).toBe('lastAdmin')
    expect(demoteBlock(users, admin)).toBe('lastAdmin')
  })
  it('a second active admin frees the first', () => {
    const users = [admin, admin2, cashier]
    expect(isLastActiveAdmin(users, admin)).toBe(false)
    expect(deleteBlock(users, admin, 'b')).toBeNull()
    expect(demoteBlock(users, admin)).toBeNull()
    expect(deactivateBlock(users, admin, 'b')).toBeNull()
  })
  it('an inactive admin does not count', () => {
    expect(isLastActiveAdmin([admin, offAdmin], admin)).toBe(true)
    expect(isLastActiveAdmin([admin, offAdmin], offAdmin)).toBe(false)
  })
  it('you cannot delete or deactivate yourself', () => {
    const users = [admin, admin2]
    expect(deleteBlock(users, admin, 'a')).toBe('self')
    expect(deactivateBlock(users, admin, 'a')).toBe('self')
    expect(deleteBlock(users, cashier, 'a')).toBeNull()
  })
})

describe('pin', () => {
  it('validates 4–6 digits and the confirmation', () => {
    expect(validatePin('1234', '1234')).toBeNull()
    expect(validatePin('123456', '123456')).toBeNull()
    expect(validatePin('123', '123')).toBe('format')
    expect(validatePin('1234567', '1234567')).toBe('format')
    expect(validatePin('12a4', '12a4')).toBe('format')
    expect(validatePin('1234', '1235')).toBe('match')
  })
  it('normalizes Arabic digits and strips the rest', () => {
    expect(normalizePin('١٢٣٤')).toBe('1234')
    expect(normalizePin('۱۲۳۴')).toBe('1234')
    expect(normalizePin('12-34 x')).toBe('1234')
    expect(normalizePin('12345678')).toBe('123456')
  })
})

describe('quick amounts', () => {
  it('adds, sorts, rounds and rejects duplicates / bad values / too many', () => {
    expect(addQuickAmount([5000], 1000, 0)).toEqual({ list: [1000, 5000] })
    expect(addQuickAmount([5000], 5000, 0)).toEqual({ list: [5000], error: 'dup' })
    expect(addQuickAmount([5000], 0, 0)).toEqual({ list: [5000], error: 'invalid' })
    expect(addQuickAmount([5000], -3, 0)).toEqual({ list: [5000], error: 'invalid' })
    expect(addQuickAmount([5000], NaN, 0)).toEqual({ list: [5000], error: 'invalid' })
    expect(addQuickAmount([], 10.005, 2).list).toEqual([10.01])
    const full = Array.from({ length: QUICK_MAX }, (_, i) => (i + 1) * 100)
    expect(addQuickAmount(full, 5, 0)).toEqual({ list: full, error: 'max' })
  })
})

describe('logo size', () => {
  it('caps the long side and never upscales', () => {
    expect(fitSize(1024, 512, 256)).toEqual({ w: 256, h: 128 })
    expect(fitSize(300, 900, 256)).toEqual({ w: 85, h: 256 })
    expect(fitSize(100, 50, 256)).toEqual({ w: 100, h: 50 })
    expect(fitSize(0, 0, 256)).toEqual({ w: 1, h: 1 })
  })
})

describe('sample sale', () => {
  it('has three items and totals that add up (exclusive tax)', () => {
    const s = { ...DEFAULT_SETTINGS, currency: { ...DEFAULT_SETTINGS.currency, decimals: 2 }, tax: { enabled: true, rate: 10, inclusive: false, label: 'VAT' } }
    const sale = sampleSale(s, { id: 'u', name: 'Admin' })
    expect(sale.items).toHaveLength(3)
    const subtotal = sale.items.reduce((a, i) => a + i.total, 0)
    expect(sale.subtotal).toBeCloseTo(subtotal, 2)
    expect(sale.tax).toBeCloseTo(subtotal * 0.1, 2)
    expect(sale.total).toBeCloseTo(subtotal * 1.1, 2)
    expect(sale.paid - sale.change).toBeCloseTo(sale.total, 2)
    expect(sale.userName).toBe('Admin')
  })
  it('scales amounts for zero-decimal currencies', () => {
    const sale = sampleSale(DEFAULT_SETTINGS, null)
    expect(sale.items.every(i => Number.isInteger(i.price) && i.price >= 1000)).toBe(true)
    expect(sale.tax).toBe(0)
    expect(sale.total).toBe(sale.subtotal)
  })
})

describe('sample products', () => {
  beforeEach(async () => { await db.delete(); await db.open() })
  it('builds 12 products in 4 categories with valid barcodes, in the chosen language', () => {
    const { categories, products } = buildSampleRows('en', 2)
    expect(categories).toHaveLength(4)
    expect(products).toHaveLength(12)
    expect(SAMPLE_PRODUCTS).toHaveLength(12)
    expect(SAMPLE_CATEGORIES).toHaveLength(4)
    expect(products.every(p => isValidEan13(p.barcodes[0]))).toBe(true)
    expect(new Set(products.map(p => p.barcodes[0])).size).toBe(12)
    expect(products.every(p => categories.some(c => c.id === p.categoryId))).toBe(true)
    expect(products[0].name).toBe('Mineral water 1.5 L')
    expect(buildSampleRows('ar', 0).products[0].name).toBe('مياه معدنية 1.5 لتر')
    expect(buildSampleRows('ar', 0).products[0].price).toBe(1500)
  })
  it('inserts them with stock movements, reusing categories on a second run', async () => {
    const n = await insertSampleProducts('ar', 0, 'u1')
    expect(n).toBe(12)
    expect(await db.products.count()).toBe(12)
    expect(await db.categories.count()).toBe(4)
    expect(await db.stockMoves.count()).toBe(12)
    const p = (await db.products.toArray()).find(x => x.name === 'مياه معدنية 1.5 لتر')!
    expect(p.stock).toBe(48)
    const m = await db.stockMoves.where('productId').equals(p.id).first()
    expect(m).toMatchObject({ type: 'initial', before: 0, after: 48, userId: 'u1' })
    await insertSampleProducts('ar', 0)
    expect(await db.categories.count()).toBe(4)
    expect(await db.products.count()).toBe(24)
  })
})

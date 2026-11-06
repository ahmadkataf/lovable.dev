// Quantities with their unit in real Arabic plural forms, the history check of one item, the movements sort.
import { db, resetDatabase } from '../src/db'
import { translate } from '../src/i18n'
import { qtyWithUnit, unitFor } from '../src/features/inventory/parts'
import { hasRealMovements } from '../src/features/inventory/actions'
import { sortMovements } from '../src/features/inventory/lib'

const tAr = (k: string, p?: Record<string, string | number>) => translate('ar', k, p)
const tEn = (k: string, p?: Record<string, string | number>) => translate('en', k, p)

describe('inventory: counted units', () => {
  it('says “3 علب”, “علبتان”, “11 علبة” and “1 box / 3 boxes”', () => {
    expect([1, 2, 3, 10, 11, 100].map(n => qtyWithUnit(tAr, 'ar', n, 'box'))).toEqual(['علبة واحدة', 'علبتان', '3 علب', '10 علب', '11 علبة', '100 علبة'])
    expect(qtyWithUnit(tAr, 'ar', 2.5, 'pack')).toBe('2.5 عبوة')
    expect(qtyWithUnit(tAr, 'ar', 250, 'ml')).toBe('250 مل')
    expect(qtyWithUnit(tAr, 'ar', 4, 'أنبوب')).toBe('4 أنبوب')
    expect(qtyWithUnit(tAr, 'ar', 1200, 'piece')).toBe('1,200 قطعة')
    expect([1, 3].map(n => qtyWithUnit(tEn, 'en', n, 'box'))).toEqual(['1 box', '3 boxes'])
    expect(qtyWithUnit(tEn, 'en', 2, 'piece')).toBe('2 pieces')
  })
  it('gives the unit word that goes under a number shown on its own', () => {
    expect([1, 2, 3, 11].map(n => unitFor(tAr, 'box', n))).toEqual(['علبة', 'علبتان', 'علب', 'علبة'])
    expect(unitFor(tEn, 'pack', 1)).toBe('pack')
    expect(unitFor(tEn, 'pack', 5)).toBe('packs')
    expect(unitFor(tAr, 'أنبوب', 5)).toBe('أنبوب')
  })
  it('the low-stock notification reads naturally', () => {
    expect(translate('ar', 'search.stock.low', { q: qtyWithUnit(tAr, 'ar', 3, 'box'), min: qtyWithUnit(tAr, 'ar', 5, 'box') })).toBe('المتوفر 3 علب — الحد الأدنى 5 علب')
  })
})

describe('inventory: history and movements at scale', () => {
  it('checks one item’s history by index, stopping at the first real movement', async () => {
    await resetDatabase()
    const m = (id: string, itemId: string, reason: 'initial' | 'use') => ({ id, itemId, delta: 1, reason, date: '2026-10-01', createdAt: '2026-10-01T10:00:00.000Z' })
    await db.stock.bulkAdd([m('a', 'i1', 'initial'), m('b', 'i2', 'initial'), m('c', 'i2', 'use')])
    expect(await hasRealMovements('i1')).toBe(false)
    expect(await hasRealMovements('i2')).toBe(true)
    expect(await hasRealMovements('none')).toBe(false)
  })
  it('sorts 20,000 movements newest first quickly, by day then time', () => {
    const list = Array.from({ length: 20_000 }, (_, i) => ({ date: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString() }))
    const t0 = performance.now()
    const sorted = sortMovements(list)
    expect(performance.now() - t0).toBeLessThan(400)
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i]
      expect(a.date > b.date || (a.date === b.date && a.createdAt >= b.createdAt)).toBe(true)
    }
  })
})

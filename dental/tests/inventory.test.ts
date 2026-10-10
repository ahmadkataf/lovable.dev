import type { InventoryItem, StockMovement } from '../src/db/types'
import {
  canDeleteItem, customCategories, daysToExpiry, expiryState, filterItems, inventoryStats, isLowStock, isOutOfStock, itemValue, parseCategoryInput, signedDelta, sortItems,
  sortMovements, stockValue, suggestReorderQty, toCSV, unitPriceDecimals, validateItem, validateMove, validatePurchase, purchaseTotal, withRunningBalance,
} from '../src/features/inventory/lib'
import { matches } from '../src/lib/format'
import { translate } from '../src/i18n'
import { pluralRule, tn } from '../src/features/inventory/plural'

const base = { id: 'x', name: 'x', category: 'consumables', unit: 'piece', quantity: 0, minQuantity: 0, active: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
const item = (p: Partial<InventoryItem>): InventoryItem => ({ ...base, ...p })

describe('inventory: stock levels', () => {
  it('low stock when quantity reaches the threshold', () => {
    expect(isLowStock({ quantity: 5, minQuantity: 5 })).toBe(true)
    expect(isLowStock({ quantity: 4, minQuantity: 5 })).toBe(true)
    expect(isLowStock({ quantity: 6, minQuantity: 5 })).toBe(false)
    expect(isLowStock({ quantity: 0, minQuantity: 0 })).toBe(true)     // empty is always low
    expect(isLowStock({ quantity: 1, minQuantity: 0 })).toBe(false)
    expect(isOutOfStock({ quantity: 0 })).toBe(true)
  })
  it('stock value is Σ quantity × cost', () => {
    expect(itemValue({ quantity: 3, costPrice: 2.5 })).toBe(7.5)
    expect(itemValue({ quantity: 3 })).toBe(0)
    expect(stockValue([{ quantity: 3, costPrice: 2.5 }, { quantity: 10, costPrice: 0.1 }, { quantity: -2, costPrice: 9 }])).toBe(8.5)
  })
})

describe('inventory: expiry', () => {
  const today = '2026-10-10'
  it('classifies dates around the 60-day window', () => {
    expect(expiryState(undefined, today)).toBe('none')
    expect(expiryState('2026-10-09', today)).toBe('expired')
    expect(expiryState('2026-10-10', today)).toBe('soon')         // today still counts as soon, not expired
    expect(expiryState('2026-12-09', today)).toBe('soon')         // exactly 60 days
    expect(expiryState('2026-12-10', today)).toBe('ok')           // 61 days
    expect(expiryState('2026-10-20', today, 5)).toBe('ok')
    expect(daysToExpiry('2026-10-05', today)).toBe(-5)
    expect(daysToExpiry(undefined, today)).toBeNull()
  })
  it('stats count only active items', () => {
    const items = [
      item({ id: 'a', quantity: 2, minQuantity: 5, costPrice: 10 }),                      // low
      item({ id: 'b', quantity: 20, minQuantity: 5, costPrice: 1, expiryDate: '2026-11-01' }), // expiring soon
      item({ id: 'c', quantity: 20, minQuantity: 5, costPrice: 1, expiryDate: '2026-01-01' }), // expired
      item({ id: 'd', quantity: 1, minQuantity: 5, costPrice: 100, active: false }),       // inactive: ignored
    ]
    expect(inventoryStats(items, today)).toEqual({ count: 3, low: 1, expiring: 2, value: 60 })
  })
})

describe('inventory: filters and ordering', () => {
  const items = [
    item({ id: 'a', name: 'قفازات لاتكس', sku: 'GL-01', category: 'consumables', quantity: 2, minQuantity: 5, supplier: 'شركة النور' }),
    item({ id: 'b', name: 'Composite A2', category: 'materials', quantity: 10, minQuantity: 2 }),
    item({ id: 'c', name: 'Old item', category: 'office', quantity: 0, minQuantity: 0, active: false }),
    item({ id: 'd', name: 'Articaine', category: 'medications', quantity: 30, minQuantity: 5, expiryDate: '2026-10-20' }),
  ]
  it('search is Arabic-aware and covers sku and supplier', () => {
    expect(filterItems(items, { q: 'قفازات' }, matches).map(i => i.id)).toEqual(['a'])
    expect(filterItems(items, { q: 'gl-01' }, matches).map(i => i.id)).toEqual(['a'])
    expect(filterItems(items, { q: 'النور' }, matches).map(i => i.id)).toEqual(['a'])
    expect(filterItems(items, { q: 'composite' }, matches).map(i => i.id)).toEqual(['b'])
  })
  it('hides inactive unless asked, filters by category and low stock', () => {
    expect(filterItems(items, {}, matches).map(i => i.id)).toEqual(['a', 'b', 'd'])
    expect(filterItems(items, { showInactive: true }, matches)).toHaveLength(4)
    expect(filterItems(items, { category: 'materials' }, matches).map(i => i.id)).toEqual(['b'])
    expect(filterItems(items, { lowOnly: true }, matches).map(i => i.id)).toEqual(['a'])
  })
  it('sorts urgent items first', () => {
    expect(sortItems(items, '2026-10-10').map(i => i.id)).toEqual(['a', 'd', 'b', 'c'])
  })
  it('collects custom categories', () => {
    expect(customCategories([{ category: 'consumables' }, { category: 'تعقيم' }, { category: 'Lab' }, { category: 'تعقيم' }, { category: ' ' }])).toEqual(['Lab', 'تعقيم'])
  })
})

describe('inventory: movements', () => {
  it('signed deltas and validation', () => {
    expect(signedDelta(3, 'out')).toBe(-3)
    expect(signedDelta(3, 'in')).toBe(3)
    expect(validateMove(null, 'in', 10)).toBe('amount')
    expect(validateMove(0, 'in', 10)).toBe('amount')
    expect(validateMove(-2, 'in', 10)).toBe('amount')
    expect(validateMove(11, 'out', 10)).toBe('notEnough')
    expect(validateMove(10, 'out', 10)).toBeNull()
    expect(validateMove(500, 'in', 0)).toBeNull()
  })
  it('running balance walks backwards from the current quantity', () => {
    const m = (id: string, date: string, delta: number, createdAt = `${date}T10:00:00.000Z`): StockMovement => ({ id, itemId: 'a', delta, reason: 'adjust', date, createdAt })
    const rows = withRunningBalance([m('1', '2026-10-01', 10), m('2', '2026-10-05', -3), m('3', '2026-10-05', 5, '2026-10-05T12:00:00.000Z'), m('4', '2026-10-07', -2)], 10)
    expect(rows.map(r => r.id)).toEqual(['4', '3', '2', '1'])
    expect(rows.map(r => r.after)).toEqual([10, 12, 7, 10])
  })
  it('purchase validation and total', () => {
    expect(validatePurchase([]).ok).toBe(false)
    const r = validatePurchase([{ itemId: '', quantity: 1, costPrice: 1 }, { itemId: 'a', quantity: 0, costPrice: 1 }, { itemId: 'b', quantity: 2, costPrice: 3 }, { itemId: 'b', quantity: 1, costPrice: 1 }])
    expect(r.ok).toBe(false)
    expect(r.errors).toEqual(['item', 'quantity', null, 'duplicate'])
    expect(validatePurchase([{ itemId: 'a', quantity: 2, costPrice: null }]).ok).toBe(true)
    expect(purchaseTotal([{ itemId: 'a', quantity: 2, costPrice: 3.5 }, { itemId: 'b', quantity: 1, costPrice: null }])).toBe(7)
  })
  it('csv quotes commas, quotes and newlines and starts with a BOM', () => {
    const csv = toCSV([['name', 'qty'], ['Gloves, L', 3], ['He said "hi"', null], ['multi\nline', undefined]])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1).split('\r\n')).toEqual(['name,qty', '"Gloves, L",3', '"He said ""hi""",', '"multi\nline",'])
  })
})

describe('inventory: deletion, re-order, form helpers', () => {
  it('only items whose history is the opening stock can be deleted', () => {
    expect(canDeleteItem([])).toBe(true)
    expect(canDeleteItem([{ reason: 'initial' }])).toBe(true)
    expect(canDeleteItem([{ reason: 'initial' }, { reason: 'use' }])).toBe(false)
    expect(canDeleteItem([{ reason: 'purchase' }])).toBe(false)
  })
  it('suggests restocking up to twice the threshold', () => {
    expect(suggestReorderQty({ quantity: 3, minQuantity: 5 })).toBe(7)
    expect(suggestReorderQty({ quantity: 0, minQuantity: 2 })).toBe(4)
    expect(suggestReorderQty({ quantity: -1, minQuantity: 2 })).toBe(4)       // negative never counts
    expect(suggestReorderQty({ quantity: 0, minQuantity: 0 })).toBe(1)        // at least one
    expect(suggestReorderQty({ quantity: 12, minQuantity: 5 })).toBe(1)
  })
  it('category box maps preset labels in either language to the key', () => {
    const labels = { consumables: ['مستهلكات', 'Consumables'], materials: ['مواد', 'Materials'] }
    expect(parseCategoryInput(' مستهلكات ', labels)).toBe('consumables')
    expect(parseCategoryInput('materials', labels)).toBe('materials')
    expect(parseCategoryInput('MATERIALS', labels)).toBe('materials')
    expect(parseCategoryInput('تعقيم', labels)).toBe('تعقيم')
    expect(parseCategoryInput('   ', labels)).toBe('')
  })
  it('validates the item form', () => {
    const v = { name: 'Gloves', quantity: 0, minQuantity: 0, costPrice: null, expiryDate: '', unit: 'box' }
    expect(validateItem(v)).toEqual({})
    expect(validateItem({ ...v, name: ' ', unit: '' })).toEqual({ name: 'required', unit: 'required' })
    expect(validateItem({ ...v, quantity: -1, minQuantity: -2, costPrice: -3 })).toEqual({ quantity: 'min', minQuantity: 'min', costPrice: 'min' })
    expect(validateItem({ ...v, expiryDate: '10/10/2026' })).toEqual({ expiryDate: 'date' })
    expect(validateItem({ ...v, quantity: null, minQuantity: null })).toEqual({})
  })
  it('sorts movements newest first and keeps cents on unit prices', () => {
    const m = [{ id: 'a', date: '2026-10-01', createdAt: '2026-10-01T09:00:00Z' }, { id: 'b', date: '2026-10-02', createdAt: '2026-10-02T08:00:00Z' }, { id: 'c', date: '2026-10-02', createdAt: '2026-10-02T09:00:00Z' }]
    expect(sortMovements(m).map(x => x.id)).toEqual(['c', 'b', 'a'])
    expect(unitPriceDecimals(6, 0)).toBe(0)
    expect(unitPriceDecimals(2.5, 0)).toBe(2)
    expect(unitPriceDecimals(0.01, 0)).toBe(2)
    expect(unitPriceDecimals(2.5, 2)).toBe(2)
    expect(unitPriceDecimals(12, 2)).toBe(2)
  })
})

describe('counted strings use real plural forms', () => {
  const tAr = (k: string, p?: Record<string, string | number>) => translate('ar', k, p)
  const tEn = (k: string, p?: Record<string, string | number>) => translate('en', k, p)
  it('Arabic: one, two, few, many, other (zero falls back to other)', () => {
    expect(pluralRule(5, 'ar')).toBe('few')
    expect(tn(tAr, 'ar', 'inventory.itemsCount', 1)).toBe('صنف واحد')
    expect(tn(tAr, 'ar', 'inventory.itemsCount', 2)).toBe('صنفان')
    expect(tn(tAr, 'ar', 'inventory.itemsCount', 5)).toBe('5 أصناف')
    expect(tn(tAr, 'ar', 'inventory.itemsCount', 12)).toBe('12 صنفاً')
    expect(tn(tAr, 'ar', 'inventory.itemsCount', 100)).toBe('100 صنف')
    expect(tn(tAr, 'ar', 'inventory.itemsCount', 0)).toBe('0 صنف')
    expect(tn(tAr, 'ar', 'inventory.expiresIn', 1)).toBe('ينتهي غداً')
    expect(tn(tAr, 'ar', 'expenses.period.days', 31)).toBe('31 يوماً')
  })
  it('English: one and other', () => {
    expect(tn(tEn, 'en', 'expenses.period.days', 1)).toBe('1 day')
    expect(tn(tEn, 'en', 'expenses.period.days', 30)).toBe('30 days')
    expect(tn(tEn, 'en', 'expenses.entries', 3)).toBe('3 entries')
  })
})

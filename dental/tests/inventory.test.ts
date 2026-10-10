import type { InventoryItem, StockMovement } from '../src/db/types'
import {
  customCategories, daysToExpiry, expiryState, filterItems, inventoryStats, isLowStock, isOutOfStock, itemValue, signedDelta, sortItems, stockValue,
  toCSV, validateMove, validatePurchase, purchaseTotal, withRunningBalance,
} from '../src/features/inventory/lib'
import { matches } from '../src/lib/format'

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

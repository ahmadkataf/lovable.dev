import { describe, it, expect } from 'vitest'
import type { Product } from '../../db/types'
import { stockStatus, normalize, matchesProduct, stockCounts, filterProducts, productValue, stockValue, countSummary, addCountLine, addPurchaseLine, signedQty, countDiff, convertLines, lineCost, lineFxCost, purchaseTotals, fxCurrency, fxRemaining } from './logic'

const p = (id: string, o: Partial<Product> = {}): Product => ({
  id, name: id, barcodes: [], price: 10, cost: 4, trackStock: true, stock: 10, lowStock: 0, unit: 'piece', allowFraction: false,
  favorite: false, active: true, createdAt: 0, updatedAt: 0, ...o,
})

describe('stock status and filters', () => {
  it('classifies stock', () => {
    expect(stockStatus(p('a', { trackStock: false }))).toBe('untracked')
    expect(stockStatus(p('a', { stock: 0 }))).toBe('out')
    expect(stockStatus(p('a', { stock: -2 }))).toBe('out')
    expect(stockStatus(p('a', { stock: 3, lowStock: 5 }))).toBe('low')
    expect(stockStatus(p('a', { stock: 5, lowStock: 5 }))).toBe('low')
    expect(stockStatus(p('a', { stock: 6, lowStock: 5 }))).toBe('ok')
    expect(stockStatus(p('a', { stock: 1, lowStock: 0 }))).toBe('ok')
  })
  it('folds Arabic letter variants when searching', () => {
    expect(normalize('  أحمد ')).toBe('احمد')
    expect(normalize('مكتبة')).toBe('مكتبه')
    expect(matchesProduct({ name: 'شاي أخضر', barcodes: ['6291000'], sku: 'TEA-1' }, 'اخضر')).toBe(true)
    expect(matchesProduct({ name: 'شاي أخضر', barcodes: ['6291000'], sku: 'TEA-1' }, '6291')).toBe(true)
    expect(matchesProduct({ name: 'شاي أخضر', barcodes: ['6291000'], sku: 'TEA-1' }, 'tea')).toBe(true)
    expect(matchesProduct({ name: 'شاي أخضر', barcodes: ['6291000'], sku: 'TEA-1' }, 'قهوة')).toBe(false)
    expect(matchesProduct({ name: 'x', barcodes: [] }, '   ')).toBe(true)
  })
  it('counts and filters', () => {
    const list = [p('a', { stock: 0 }), p('b', { stock: 2, lowStock: 3 }), p('c', { trackStock: false }), p('d')]
    expect(stockCounts(list)).toEqual({ all: 4, low: 1, out: 1, untracked: 1, expiring: 0 })
    expect(filterProducts(list, { q: '', filter: 'low', sort: 'name' }).map(x => x.id)).toEqual(['b'])
    expect(filterProducts(list, { q: '', filter: 'out', sort: 'name' }).map(x => x.id)).toEqual(['a'])
    expect(filterProducts(list, { q: '', filter: 'untracked', sort: 'name' }).map(x => x.id)).toEqual(['c'])
    expect(filterProducts(list, { q: 'd', filter: 'all', sort: 'name' }).map(x => x.id)).toEqual(['d'])
  })
  it('sorts by lowest stock (untracked last) and by value', () => {
    const list = [p('a', { stock: 7 }), p('b', { stock: 1 }), p('c', { trackStock: false }), p('d', { stock: 3, cost: 100 })]
    expect(filterProducts(list, { q: '', filter: 'all', sort: 'lowest' }).map(x => x.id)).toEqual(['b', 'd', 'a', 'c'])
    expect(filterProducts(list, { q: '', filter: 'all', sort: 'value' }).map(x => x.id)).toEqual(['d', 'a', 'b', 'c'])
  })
  it('values stock at cost, ignoring untracked and negative stock', () => {
    expect(productValue(p('a', { stock: 2.5, cost: 3.3 }), 2)).toBe(8.25)
    expect(productValue(p('a', { stock: -3 }))).toBe(0)
    expect(productValue(p('a', { trackStock: false }))).toBe(0)
    expect(stockValue([p('a', { stock: 2, cost: 5 }), p('b', { stock: 1, cost: 0.5 })], 0)).toBe(11)
  })
})

describe('stock-take', () => {
  it('adds, increments and summarises differences', () => {
    let lines = addCountLine([], p('a'), 4)
    lines = addCountLine(lines, p('b', { allowFraction: true }), 1.25)
    lines = addCountLine(lines, p('a'), 1, 'increment')
    lines = addCountLine(lines, p('b', { allowFraction: true }), 2, 'set')
    expect(lines.map(l => [l.productId, l.counted])).toEqual([['b', 2], ['a', 5]])
    const system = (id: string) => ({ a: 10, b: 2 }[id] ?? 0)
    expect(countDiff(lines[1], 10)).toBe(-5)
    expect(countSummary(lines, system)).toEqual({ items: 2, withDiff: 1, plus: 0, minus: 5 })
    lines = addCountLine(lines, p('c'), 3)
    expect(countSummary(lines, system)).toEqual({ items: 3, withDiff: 2, plus: 3, minus: 5 })
  })
  it('formats signed quantities', () => {
    expect(signedQty(3)).toBe('+3')
    expect(signedQty(-1.5)).toBe('-1.5')
    expect(signedQty(0)).toBe('0')
  })
})

describe('purchase lines', () => {
  it('adds a product once and grows its quantity on a repeat', () => {
    let lines = addPurchaseLine([], p('a', { cost: 7 }), 'k1')
    lines = addPurchaseLine(lines, p('b'), 'k2')
    lines = addPurchaseLine(lines, p('a', { cost: 7 }), 'k3')
    expect(lines.map(l => [l.productId, l.qty, l.cost])).toEqual([['a', 2, 7], ['b', 1, 4]])
  })
  it('seeds fxCost on a second-currency invoice: the product anchor, else cost ÷ rate', () => {
    const fx = { rate: 13000, decimals: 2 }
    let lines = addPurchaseLine([], p('a', { cost: 12610, fxCost: 0.97 }), 'k1', fx)
    lines = addPurchaseLine(lines, p('b', { cost: 6500 }), 'k2', fx)
    expect(lines.map(l => [l.productId, l.fxCost])).toEqual([['a', 0.97], ['b', 0.5]])
    // a repeat grows the quantity and keeps the typed dollar cost
    lines = lines.map(l => (l.productId === 'b' ? { ...l, fxCost: 0.55 } : l))
    lines = addPurchaseLine(lines, p('b', { cost: 6500 }), 'k3', fx)
    expect(lines[1]).toMatchObject({ qty: 2, fxCost: 0.55 })
    // no fx, or no rate: no dollar cost at all
    expect(addPurchaseLine([], p('c'), 'k4')[0].fxCost).toBeUndefined()
    expect(addPurchaseLine([], p('c'), 'k4', { rate: 0 })[0].fxCost).toBeUndefined()
  })
  it('derives the other currency of a line at the invoice rate', () => {
    expect(lineCost({ cost: 1, fxCost: 1.25 }, true, 13000, 0)).toBe(16250)
    expect(lineCost({ cost: 700, fxCost: 1.25 }, false, 13000, 0)).toBe(700)
    expect(lineCost({ cost: 700 }, true, 13000, 0)).toBe(0)
    expect(lineFxCost({ cost: 16250 }, false, 13000)).toBe(1.25)
    expect(lineFxCost({ cost: 16250, fxCost: 2 }, true, 13000)).toBe(2)
    expect(lineFxCost({ cost: 16250 }, false, 0)).toBe(0)
  })
  it('converts typed lines when the invoice switches currency', () => {
    const base = addPurchaseLine([], p('a', { cost: 13000 }), 'k1')
    const inFx = convertLines(base, 'fx', 13000, 0)
    expect(inFx[0]).toMatchObject({ cost: 13000, fxCost: 1 })
    const back = convertLines(inFx.map(l => ({ ...l, fxCost: 1.5 })), 'primary', 13000, 0)
    expect(back[0]).toMatchObject({ cost: 19500, fxCost: 1.5 })
    expect(convertLines(base, 'fx', 0, 0)).toBe(base)
  })
  it('totals an invoice in both currencies, exact in the one it is written in', () => {
    const lines = [{ qty: 3, cost: 16250, fxCost: 1.25 }, { qty: 1.5, cost: 13000, fxCost: 1 }]
    expect(purchaseTotals(lines, true, 13000, 0)).toEqual({ fxTotal: 5.25, total: 68250 })
    expect(purchaseTotals(lines, false, 13000, 0)).toEqual({ total: 68250, fxTotal: 5.25 })
    expect(purchaseTotals(lines, false, 0, 0)).toEqual({ total: 68250, fxTotal: 0 })
    expect(purchaseTotals([{ qty: 1, cost: 5 }], true, 13000, 0)).toEqual({ fxTotal: 0, total: 0 })
  })
  it('reads a stored second-currency invoice', () => {
    const fx = { code: 'USD', symbol: '$', decimals: 2, symbolAfter: false, rate: 13000, total: 10, paid: 2.5 }
    expect(fxCurrency(fx)).toEqual({ code: 'USD', symbol: '$', decimals: 2, symbolAfter: false })
    expect(fxRemaining(fx)).toBe(7.5)
  })
})

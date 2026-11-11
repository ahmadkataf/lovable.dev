import { describe, it, expect, beforeEach } from 'vitest'
import { db, loadSettings, saveSettings } from '../db'
import { DEFAULT_SETTINGS, hasFxAnchor, isFxPriced, type Product, type RateHistoryEntry, type Settings, type User } from '../db/types'
import { fxToPrimary, derivePrices, repriceAll, rateAge, isRateStale, rateAt, stockValueFx, setExchangeRate, loadRateHistory, currencyForCode, formatRate, FX_HISTORY_KEY } from './fx'

const c2 = { ...DEFAULT_SETTINGS.currency2, enabled: true, pricing: true, rate: 13000 }
const settings: Settings = { ...DEFAULT_SETTINGS, currency2: c2 }
const user: User = { id: 'u1', name: 'المدير', role: 'admin', active: true, createdAt: 0 }
const product = (id: string, o: Partial<Product> = {}): Product => ({
  id, name: id, barcodes: [], price: 100, cost: 60, trackStock: true, stock: 5, lowStock: 0, unit: 'piece', allowFraction: false,
  favorite: false, active: true, createdAt: 0, updatedAt: 7, ...o,
})

describe('fxToPrimary / derivePrices', () => {
  it('step-rounds selling prices and rounds costs exactly (the worked example of the spec)', () => {
    expect(fxToPrimary(9.99, c2, 0, 'price')).toBe(129900)
    expect(fxToPrimary(1.25, c2, 0, 'price')).toBe(16300)
    expect(fxToPrimary(9.99, { ...c2, roundTo: 500, roundMode: 'up' }, 0, 'price')).toBe(130000)
    expect(fxToPrimary(0.97, c2, 0, 'cost')).toBe(12610)
    expect(fxToPrimary(0.05, c2, 0, 'price')).toBe(700)                                       // 650 at step 100 (no shrink: 650 ≥ 4 × 100)
    expect(fxToPrimary(0.05, { ...c2, roundTo: 500 }, 0, 'price')).toBe(650)                  // shrink guard: step 500 → 10
    expect(fxToPrimary(1, { ...c2, rate: 0 }, 0, 'price')).toBe(0)
  })
  it('returns only what changes, from the anchor, and null when nothing does', () => {
    const p = product('a', { fxPrice: 9.99, fxCost: 0.97, fxWholesalePrice: 9, wholesalePrice: 1, packs: [{ id: 'k', name: 'box', qty: 6, price: 1, fxPrice: 55 }, { id: 'j', name: 'bag', qty: 2, price: 250 }] })
    const patch = derivePrices(p, c2, 0, 123)!
    expect(patch).toEqual({ price: 129900, cost: 12610, wholesalePrice: 117000, packs: [{ id: 'k', name: 'box', qty: 6, price: 715000, fxPrice: 55 }, { id: 'j', name: 'bag', qty: 2, price: 250 }], repricedAt: 123 })
    expect('updatedAt' in patch).toBe(false)
    const done = { ...p, ...patch }
    expect(derivePrices(done, c2, 0)).toBeNull()
    // a drifted lira price comes back from the anchor, never from itself
    expect(derivePrices({ ...done, price: 999 }, c2, 0)!.price).toBe(129900)
    // only the cost anchored: the price is left alone
    expect(derivePrices(product('b', { fxCost: 1 }), c2, 0)).toMatchObject({ cost: 13000 })
    expect(derivePrices(product('b', { fxCost: 1 }), c2, 0)!.price).toBeUndefined()
    expect(derivePrices(product('c'), c2, 0)).toBeNull()
    expect(derivePrices(p, { ...c2, rate: 0 }, 0)).toBeNull()
    expect(isFxPriced(p)).toBe(true); expect(isFxPriced(product('x', { fxCost: 1 }))).toBe(false)
    expect(hasFxAnchor(product('x', { fxCost: 1 }))).toBe(true)
    expect(hasFxAnchor(product('x', { packs: [{ id: 'k', name: 'b', qty: 2, price: 1, fxPrice: 1 }] }))).toBe(true)
    expect(hasFxAnchor(product('x'))).toBe(false)
  })
})

describe('repriceAll / setExchangeRate', () => {
  beforeEach(async () => {
    await db.delete(); await db.open()
    await saveSettings(settings)
    await db.products.bulkAdd([
      product('a', { fxPrice: 10, fxCost: 8 }),
      product('b', { fxPrice: 2, price: 26000, cost: 60 }),
      product('c'),
    ])
  })
  it('rewrites anchored products only, leaves updatedAt alone and is idempotent', async () => {
    const r1 = await repriceAll(c2, 0)
    expect(r1).toEqual({ anchored: 2, changed: 1 })      // b already matches its anchor at 13,000
    const a = (await db.products.get('a'))!
    expect(a).toMatchObject({ price: 130000, cost: 104000, updatedAt: 7 })
    expect(a.repricedAt).toBeGreaterThan(0)
    expect((await db.products.get('c'))!.price).toBe(100)
    const r2 = await repriceAll(c2, 0)
    expect(r2).toEqual({ anchored: 2, changed: 0 })
  })
  it('changes the rate atomically: products, settings and history in one go, then an audit row', async () => {
    const res = await setExchangeRate({ rate: 13500, settings, user, source: 'dialog' })
    expect(res.prev).toBe(13000); expect(res.repriced).toBe(2)
    expect(res.settings.currency2).toMatchObject({ rate: 13500, rateUpdatedBy: 'المدير' })
    expect(res.settings.currency2.rateUpdatedAt).toBeGreaterThan(0)
    expect((await loadSettings()).currency2.rate).toBe(13500)
    expect((await db.products.get('a'))!.price).toBe(135000)
    expect((await db.products.get('b'))!.price).toBe(27000)
    const hist = await loadRateHistory()
    expect(hist).toHaveLength(1)
    expect(hist[0]).toMatchObject({ rate: 13500, prev: 13000, repriced: 2, userId: 'u1', userName: 'المدير', source: 'dialog' })
    await new Promise(r => setTimeout(r, 5))
    const audit = await db.audit.toArray()
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ kind: 'rate.change', amount: 13500, userId: 'u1' })
    expect(audit[0].detail).toBe('USD: 13,000 → 13,500 (+3.8%) · 2')
    // the same rate again: no product writes, but the history and the timestamp refresh
    const again = await setExchangeRate({ rate: 13500, settings: res.settings, user, source: 'settings' })
    expect(again.repriced).toBe(0)
    expect((await loadRateHistory()).map(h => h.source)).toEqual(['settings', 'dialog'])
    expect(again.settings.currency2.rateUpdatedAt).toBeGreaterThanOrEqual(res.settings.currency2.rateUpdatedAt!)
  })
  it('does not reprice while pricing is off (or currency2 disabled) but still records the rate', async () => {
    const off: Settings = { ...settings, currency2: { ...c2, pricing: false } }
    const res = await setExchangeRate({ rate: 14000, settings: off, user: null, source: 'settings' })
    expect(res.repriced).toBe(0)
    expect((await db.products.get('a'))!.price).toBe(100)
    expect((await loadSettings()).currency2.rate).toBe(14000)
    expect((await loadRateHistory())[0]).toMatchObject({ rate: 14000, userId: undefined, userName: undefined })
  })
  it('refuses a bad rate without writing anything, and rounds the rate', async () => {
    for (const bad of [0, -1, NaN, Infinity]) await expect(setExchangeRate({ rate: bad, settings, user, source: 'dialog' })).rejects.toThrow('fx.err.rate')
    expect(await loadRateHistory()).toEqual([])
    expect((await loadSettings()).currency2.rate).toBe(13000)
    const r = await setExchangeRate({ rate: 13000.004, settings, user, source: 'dialog' })
    expect(r.settings.currency2.rate).toBe(13000)
    const dec: Settings = { ...settings, currency: { ...settings.currency, decimals: 2 } }
    expect((await setExchangeRate({ rate: 1.08256, settings: dec, user, source: 'dialog' })).settings.currency2.rate).toBe(1.0826)
    expect(formatRate(13000, settings)).toBe('13,000'); expect(formatRate(1.0826, dec)).toBe('1.0826'); expect(formatRate(1.5, dec)).toBe('1.5')
  })
  it('caps the history at 400 rows', async () => {
    const old: RateHistoryEntry[] = Array.from({ length: 400 }, (_, i) => ({ at: 1000 - i, rate: 1, prev: 1, repriced: 0, source: 'dialog' as const }))
    await db.kv.put({ key: FX_HISTORY_KEY, value: old })
    await setExchangeRate({ rate: 13100, settings, user, source: 'dialog' })
    const hist = await loadRateHistory()
    expect(hist).toHaveLength(400); expect(hist[0].rate).toBe(13100); expect(hist[399].at).toBe(old[398].at)   // the oldest row fell off
  })
})

describe('rate age and history lookups', () => {
  it('counts local calendar days across midnight', () => {
    const noon = new Date(2026, 9, 9, 12).getTime()
    const lateYesterday = new Date(2026, 9, 8, 23, 50).getTime()
    expect(rateAge({ rateUpdatedAt: noon }, noon)).toEqual({ days: 0, updatedToday: true })
    expect(rateAge({ rateUpdatedAt: lateYesterday }, new Date(2026, 9, 9, 0, 10).getTime())).toEqual({ days: 1, updatedToday: false })
    expect(rateAge({ rateUpdatedAt: noon - 3 * 86400000 }, noon).days).toBe(3)
    expect(rateAge({}, noon)).toEqual({ days: Number.POSITIVE_INFINITY, updatedToday: false })
    const base = { pricing: true, staleAfterDays: 2 }
    expect(isRateStale({ ...base, rateUpdatedAt: lateYesterday }, noon)).toBe(false)
    expect(isRateStale({ ...base, rateUpdatedAt: noon - 2 * 86400000 }, noon)).toBe(true)
    expect(isRateStale({ ...base }, noon)).toBe(true)
    expect(isRateStale({ ...base, pricing: false }, noon)).toBe(false)
    expect(isRateStale({ ...base, staleAfterDays: 0 }, noon)).toBe(false)
  })
  it('rateAt picks the entry in force at a moment, else the oldest', () => {
    const h: RateHistoryEntry[] = [
      { at: 300, rate: 3, prev: 2, repriced: 0, source: 'dialog' },
      { at: 200, rate: 2, prev: 1, repriced: 0, source: 'dialog' },
      { at: 100, rate: 1, prev: 0, repriced: 0, source: 'settings' },
    ]
    expect(rateAt(h, 250)).toBe(2); expect(rateAt(h, 300)).toBe(3); expect(rateAt(h, 1000)).toBe(3)
    expect(rateAt(h, 50)).toBe(1)
    expect(rateAt(h.slice().reverse(), 250)).toBe(2)   // order does not matter
    expect(rateAt([], 250)).toBeUndefined()
  })
  it('stockValueFx uses fxCost, else cost at the rate, over tracked products in stock', () => {
    const rows = [
      product('a', { stock: 10, fxCost: 1.25, cost: 999 }),
      product('b', { stock: 2, cost: 13000 }),
      product('c', { stock: 0, fxCost: 5 }),
      product('d', { trackStock: false, stock: 4, fxCost: 5 }),
      product('e', { stock: -3, fxCost: 5 }),
    ]
    expect(stockValueFx(rows, { rate: 13000 })).toBe(14.5)
    expect(stockValueFx(rows, { rate: 0 })).toBe(12.5)
  })
  it('currencyForCode uses the configured currency2 for its code, the catalog otherwise', () => {
    expect(currencyForCode('USD', settings)).toEqual({ code: 'USD', symbol: '$', decimals: 2, symbolAfter: false })
    expect(currencyForCode(undefined, settings).code).toBe('USD')
    expect(currencyForCode('EUR', settings)).toMatchObject({ symbol: '€' })
    expect(currencyForCode('ZZZ', settings)).toMatchObject({ code: 'ZZZ', symbol: 'ZZZ' })
  })
})

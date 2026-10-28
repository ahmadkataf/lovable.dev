import { describe, it, expect } from 'vitest'
import type { Product } from '../../db/types'
import { normalizeText, filterProducts, sortProducts, resolveEntry, findByBarcode, availableQty, mergeQuickAmounts, isFullCode } from './search'

const p = (over: Partial<Product>): Product => ({
  id: 'x', name: 'x', barcodes: [], price: 1, cost: 0, trackStock: false, stock: 0, lowStock: 0, unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: 0, updatedAt: 0, ...over,
})
const products: Product[] = [
  p({ id: 'milk', name: 'حليب كامل الدسم', barcodes: ['6291041500213'], sku: 'MLK-1' }),
  p({ id: 'bread', name: 'خبز عربي', barcodes: ['2000000000017'], favorite: true }),
  p({ id: 'tea', name: 'شاي أحمد', barcodes: ['12345'] }),
  p({ id: 'cola', name: 'Coca Cola 1L', barcodes: ['5449000000996'] }),
  p({ id: 'old', name: 'منتج قديم', barcodes: ['999999'], active: false }),
]

describe('normalizeText', () => {
  it('unifies Arabic letter variants, strips tashkeel and converts digits', () => {
    expect(normalizeText('أحْمَد')).toBe('احمد')
    expect(normalizeText('إبراهيم')).toBe('ابراهيم')
    expect(normalizeText('مكتبة')).toBe('مكتبه')
    expect(normalizeText('مصطفى')).toBe('مصطفي')
    expect(normalizeText('  Coca   COLA ١٢ ')).toBe('coca cola 12')
  })
})

describe('filterProducts', () => {
  it('matches by name tokens, barcode and sku, Arabic-friendly, active only', () => {
    expect(filterProducts(products, 'حليب').map(x => x.id)).toEqual(['milk'])
    expect(filterProducts(products, 'احمد').map(x => x.id)).toEqual(['tea'])
    expect(filterProducts(products, 'كامل دسم').map(x => x.id)).toEqual(['milk'])
    expect(filterProducts(products, '62910').map(x => x.id)).toEqual(['milk'])
    expect(filterProducts(products, 'mlk').map(x => x.id)).toEqual(['milk'])
    expect(filterProducts(products, 'cola').map(x => x.id)).toEqual(['cola'])
    expect(filterProducts(products, 'قديم')).toEqual([])
    expect(filterProducts(products, '')).toHaveLength(4)
  })
  it('filters by category and favourites', () => {
    const cat = [p({ id: 'a', name: 'a', categoryId: 'c1' }), p({ id: 'b', name: 'b', categoryId: 'c2', favorite: true })]
    expect(filterProducts(cat, '', { categoryId: 'c1' }).map(x => x.id)).toEqual(['a'])
    expect(filterProducts(cat, '', { favorites: true }).map(x => x.id)).toEqual(['b'])
  })
})

describe('sortProducts', () => {
  it('puts favourites first, then by name', () => {
    expect(sortProducts(products).map(x => x.id)).toEqual(['bread', 'milk', 'tea', 'old', 'cola'])   // Arabic names first in the ar collation, Latin after
  })
})

describe('resolveEntry', () => {
  it('adds the product with the exact barcode', () => {
    expect(resolveEntry('6291041500213', products)).toMatchObject({ kind: 'product', scanned: true, product: { id: 'milk' } })
    expect(resolveEntry(' ٦٢٩١٠٤١٥٠٠٢١٣ ', products)).toMatchObject({ kind: 'product', product: { id: 'milk' } })
  })
  it('opens quick-add for a full code nobody has, even when it is a prefix of another barcode', () => {
    expect(resolveEntry('62910415', products)).toEqual({ kind: 'quickAdd', barcode: '62910415' })
    expect(resolveEntry('4006381333931', products)).toEqual({ kind: 'quickAdd', barcode: '4006381333931' })
  })
  it('adds the only search match, otherwise does nothing', () => {
    expect(resolveEntry('حليب', products)).toMatchObject({ kind: 'product', scanned: false, product: { id: 'milk' } })
    expect(resolveEntry('ح', products)).toEqual({ kind: 'none' })
    expect(resolveEntry('', products)).toEqual({ kind: 'none' })
  })
  it('opens quick-add for a code-like text with no match, but not for plain words with no match', () => {
    expect(resolveEntry('ABC-9001', products)).toEqual({ kind: 'quickAdd', barcode: 'ABC-9001' })
    expect(resolveEntry('شوكولا', products)).toEqual({ kind: 'none' })
  })
  it('ignores inactive products', () => {
    expect(findByBarcode(products, '999999')).toBeUndefined()
    expect(isFullCode('12345678')).toBe(true)
    expect(isFullCode('1234')).toBe(false)
  })
})

describe('stock and quick amounts', () => {
  it('limits what can be added when negative stock is off', () => {
    const tracked = p({ trackStock: true, stock: 3 })
    expect(availableQty(tracked, 1, false)).toBe(2)
    expect(availableQty(tracked, 5, false)).toBe(0)
    expect(availableQty(tracked, 5, true)).toBe(Infinity)
    expect(availableQty(p({ trackStock: false }), 5, false)).toBe(Infinity)
  })
  it('merges the shop quick amounts, keeps only those covering the total, sorted, max six', () => {
    expect(mergeQuickAmounts([1250, 1500, 2000, 5000], [500, 1000, 2000, 10000, 50000], 1250)).toEqual([1250, 1500, 2000, 5000, 10000, 50000])
    expect(mergeQuickAmounts([1250, 1500], [100000, 200000, 500000, 1000000, 2000000], 1250)).toHaveLength(6)
  })
})

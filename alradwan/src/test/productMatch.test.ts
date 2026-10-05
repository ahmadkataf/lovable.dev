import { describe, expect, it } from 'vitest'
import { barcodeOwner, barcodeToSave, findProductByScan, prefillFromScan, shortGtin, withBarcode } from '../lib/productMatch'
import type { Product } from '../db/types'

const p = (id: string, x: Partial<Product>): Product => ({ id, updatedAt: 0, createdAt: 0, code: id, name: id, unit: 'قطعة', cost: 0, price: 0, minStock: 0, kind: 'product', ...x } as Product)
const list = [
  p('oil', { barcode: '6291041500213' }),
  p('upc', { barcode: '012345000065' }),
  p('filter', { oemNumbers: '26300-35503, 0 986 452 041' }),
  p('pad', { code: 'BP-1020', barcode: '4006381333931, 96385074' }),
]
describe('finding the product of a scan', () => {
  it('matches the barcode as stored', () => expect(findProductByScan(list, '6291041500213')?.product.id).toBe('oil'))
  it('matches another form of the same product number', () => {
    expect(findProductByScan(list, '06291041500213')?.via).toBe('gtin')
    expect(findProductByScan(list, '01234565')?.product.id).toBe('upc')          // UPC-E from a USB scanner
    expect(findProductByScan(list, '0012345000065')?.product.id).toBe('upc')     // the camera's EAN-13 form
    expect(findProductByScan(list, '0106291041500213\x1d10LOT7')?.product.id).toBe('oil')   // GS1 Data Matrix
  })
  it('matches a second barcode of a product and its own code', () => {
    expect(findProductByScan(list, '96385074')?.product.id).toBe('pad')
    expect(findProductByScan(list, 'bp-1020')?.via).toBe('code')
  })
  it('matches OEM part numbers however they are spaced', () => {
    expect(findProductByScan(list, '0986452041')?.product.id).toBe('filter')
    expect(findProductByScan(list, '2630035503')?.product.id).toBe('filter')
  })
  it('finds nothing for unknown codes', () => expect(findProductByScan(list, '5901234123457')).toBeNull())
  it('adds a barcode once', () => {
    expect(withBarcode('111', '222')).toBe('111, 222')
    expect(withBarcode('111, 222', '222')).toBe('111, 222')
    expect(withBarcode('', '333')).toBe('333')
  })
})

describe('what a scan saves', () => {
  it('keeps the product number of GS1 data, not its batch or expiry', () => {
    expect(barcodeToSave('01095011015300031727123110AB12')).toBe('9501101530003')
    expect(barcodeToSave('(01)00036000291452(17)271231')).toBe('036000291452')
    expect(barcodeToSave(' 6291041500213 ')).toBe('6291041500213')
    expect(barcodeToSave('ABC-123')).toBe('ABC-123')
  })
  it('turns GTIN-14 keys back into printed forms', () => {
    expect(shortGtin('00000096385074')).toBe('96385074')
    expect(shortGtin('00036000291452')).toBe('036000291452')
    expect(shortGtin('06291041500213')).toBe('6291041500213')
    expect(shortGtin('10095011015300')).toBe('10095011015300')
  })
  it('prefills a part number scanned from a label', () => {
    expect(prefillFromScan('26300-35503')).toEqual({ barcode: '26300-35503', oemNumbers: '26300-35503' })
    expect(prefillFromScan('6291041500213')).toEqual({ barcode: '6291041500213' })
  })
  it('finds who already owns a barcode in any of its forms', () => {
    const list = [p('a', { barcode: '036000291452' }), p('b', { barcode: 'X1' })]
    expect(barcodeOwner(list, '0036000291452')?.id).toBe('a')
    expect(barcodeOwner(list, '0036000291452', 'a')).toBeNull()
    expect(barcodeOwner(list, 'x1')?.id).toBe('b')
  })
})


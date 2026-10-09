import { describe, it, expect } from 'vitest'
import { isValidEan13, makeInternalEan13, ean13CheckDigit, barcodeFormat, isValidEan8, cleanBarcode, looksLikeBarcode } from './barcode'

describe('barcode', () => {
  it('checks EAN-13', () => {
    expect(isValidEan13('6291041500213')).toBe(true)
    expect(isValidEan13('6291041500214')).toBe(false)
    expect(ean13CheckDigit('629104150021')).toBe(3)
  })
  it('checks EAN-8', () => { expect(isValidEan8('96385074')).toBe(true); expect(isValidEan8('96385075')).toBe(false) })
  it('makes valid in-store codes', () => {
    const c = makeInternalEan13(42)
    expect(c).toMatch(/^200000000042\d$/)
    expect(isValidEan13(c)).toBe(true)
  })
  it('picks a format', () => {
    expect(barcodeFormat('6291041500213')).toBe('EAN13')
    expect(barcodeFormat('ABC-123')).toBe('CODE128')
  })
  it('cleans what people type', () => {
    expect(cleanBarcode(' ٦٢٩١ 041500213 ')).toBe('6291041500213')
    expect(looksLikeBarcode('6291041500213')).toBe(true)
    expect(looksLikeBarcode('ab')).toBe(false)
  })
})

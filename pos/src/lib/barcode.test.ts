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

describe('scale barcodes', () => {
  it('decodes weight labels (2 + PLU 5 + grams 5 + check)', async () => {
    const { parseScaleBarcode, ean13CheckDigit, matchesPlu } = await import('./barcode')
    const body = '2' + '00123' + '001250'                // PLU 123, 1.250 kg (6 value digits after a 1-digit prefix)
    const code = body + ean13CheckDigit(body)
    const f = { prefix: '2', pluDigits: 5 as const, value: 'weight' as const, valueDecimals: 3 }
    expect(parseScaleBarcode(code, f)).toEqual({ plu: '123', value: 1.25, kind: 'weight' })
    expect(parseScaleBarcode(body + ((Number(code[12]) + 1) % 10), f)).toBeNull()   // bad check digit
    expect(parseScaleBarcode('6291041500213', f)).toBeNull()                           // a normal product
    expect(matchesPlu(['00123'], '123')).toBe(true); expect(matchesPlu(['1234'], '123')).toBe(false)
  })
  it('decodes priced labels with 4-digit PLUs', async () => {
    const { parseScaleBarcode, ean13CheckDigit } = await import('./barcode')
    const body = '20' + '0045' + '012500'                 // prefix 20, PLU 45, price 12500 (0 decimals)
    const code = body + ean13CheckDigit(body)
    expect(parseScaleBarcode(code, { prefix: '20', pluDigits: 4, value: 'price', valueDecimals: 0 })).toEqual({ plu: '45', value: 12500, kind: 'price' })
  })
})

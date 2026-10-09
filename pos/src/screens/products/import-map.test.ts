import { describe, it, expect } from 'vitest'
import { autoMap, parseAmount, parseImportRow, splitBarcodes, unitFromText, looksLikeHeader, mappingOk } from './import-map'

describe('import mapping', () => {
  it('maps the exported headers (name/الاسم style)', () => {
    const m = autoMap(['name/الاسم', 'barcode/الباركود', 'sku/الرمز', 'category/الفئة', 'price/السعر', 'cost/التكلفة', 'stock/المخزون', 'lowStock/حد التنبيه', 'unit/الوحدة', 'active/نشط', 'notes/ملاحظات'])
    expect(m).toEqual({ name: 0, barcode: 1, sku: 2, category: 3, price: 4, cost: 5, stock: 6, lowStock: 7, unit: 8, notes: 10 })
  })
  it('maps Arabic headers', () => {
    const m = autoMap(['الصنف', 'الباركود', 'سعر البيع', 'سعر الشراء', 'الكمية', 'التصنيف', 'الوحدة'])
    expect(m).toEqual({ name: 0, barcode: 1, price: 2, cost: 3, stock: 4, category: 5, unit: 6 })
  })
  it('maps English headers with spaces and case', () => {
    const m = autoMap(['Product Name', 'EAN', 'Sell Price', 'Cost Price', 'Qty', 'Group', 'SKU'])
    expect(m).toEqual({ name: 0, barcode: 1, price: 2, cost: 3, stock: 4, category: 5, sku: 6 })
  })
  it('does not use one column twice and leaves unknown columns alone', () => {
    const m = autoMap(['price', 'something', 'price'])
    expect(m.price).toBe(0)
    expect(Object.values(m)).not.toContain(1)
  })
  it('needs a name or a barcode column to run', () => {
    expect(mappingOk({ price: 0 })).toBe(false)
    expect(mappingOk({ barcode: 0 })).toBe(true)
    expect(mappingOk({ name: 2 })).toBe(true)
  })
  it('tells a header row from data', () => {
    expect(looksLikeHeader(['الاسم', 'السعر'])).toBe(true)
    expect(looksLikeHeader(['حليب', '1500'])).toBe(false)
  })
})

describe('import parsing', () => {
  it('reads prices with Arabic digits and thousands separators', () => {
    expect(parseAmount('١٢٥٠')).toBe(1250)
    expect(parseAmount('١٬٢٥٠٫٥')).toBe(1250.5)
    expect(parseAmount('1,250.50')).toBe(1250.5)
    expect(parseAmount('1 500 ل.س')).toBe(1500)
    expect(parseAmount('')).toBeUndefined()
    expect(parseAmount('n/a')).toBeUndefined()
    expect(parseAmount(undefined)).toBeUndefined()
  })
  it('splits several barcodes in one cell', () => {
    expect(splitBarcodes('6291041500213|96385074')).toEqual(['6291041500213', '96385074'])
    expect(splitBarcodes(' ٦٢٩١٠٤١٥٠٠٢١٣ ; 123 123 ')).toEqual(['6291041500213', '123'])
    expect(splitBarcodes('')).toEqual([])
  })
  it('recognises units in both languages', () => {
    expect(unitFromText('كغ')).toBe('kg')
    expect(unitFromText('Kilo')).toBe('kg')
    expect(unitFromText('قطعة')).toBe('piece')
    expect(unitFromText('box')).toBe('box')
    expect(unitFromText('شوال')).toBe('شوال')
    expect(unitFromText('')).toBeUndefined()
  })
  it('reads a whole row through the mapping', () => {
    const row = parseImportRow(['حليب', '6291041500213', '١٥٠٠', '1200', '٢٤', 'ألبان', 'قطعة', 'MLK'], { name: 0, barcode: 1, price: 2, cost: 3, stock: 4, category: 5, unit: 6, sku: 7 }, 2)
    expect(row).toEqual({ line: 2, name: 'حليب', barcodes: ['6291041500213'], price: 1500, cost: 1200, stock: 24, category: 'ألبان', unit: 'piece', sku: 'MLK' })
  })
  it('leaves unmapped and blank fields out', () => {
    const row = parseImportRow(['سكر', '', ''], { name: 0, barcode: 1, price: 2 }, 3)
    expect(row).toEqual({ line: 3, name: 'سكر', barcodes: [] })
    expect(row.price).toBeUndefined()
  })
})

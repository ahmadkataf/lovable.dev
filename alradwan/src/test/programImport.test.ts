import { describe, expect, it } from 'vitest'
import { mapAmeen, parseTable, rankTables, type SourceTable } from '../lib/programImport'

const G1 = 'b155dda5-2753-4c15-b9b0-55b0085dfea1', M3 = 'ec8ca0e8-52c1-4827-b430-ac125ea8e7af'
const head = ['GUID', 'Number', 'Code', 'Name', 'LatinName', 'BarCode', 'BarCode2', 'Unity', 'Qty', 'Whole', 'Half', 'Retail', 'EndUser', 'Export', 'Vendor', 'LastPrice', 'AvgPrice', 'GroupGUID', 'Company', 'Origin', 'Low', 'bHide']

describe('الأمين', () => {
  const rows = mapAmeen({
    materials: [head,
      ['a', 1, 'F-100', 'فلتر زيت تويوتا', 'Toyota oil filter', '4011558744502', null, 'قطعة', 12, 1.8, 0, 2.2, 2.5, 0, 0, 1.5, 1.6, G1.toUpperCase(), 'Bosch', 'ألمانيا', 3, false],
      ['b', 2, 'O-200', 'زيت محرك 5W30 4 لتر', null, '5011987654321', '5011987654338', 'علبة', 7, 0, 0, 0, 14, 0, 0, 0, 11, null, 'Shell', null, 0, false],
      [M3, 3, 'B-300', 'فحمات فرام أمامي', null, null, null, 'طقم', 4, 0, 0, 0, 0, 0, 0, 6, 0, G1, null, null, 0, false],
      ['d', 4, 'X-999', 'مادة مخفية', null, null, null, 'قطعة', 0, 0, 0, 0, 5, 0, 0, 0, 0, null, null, null, 0, true]],
    groups: [['GUID', 'Name'], [G1, 'فلاتر']],
    priceItems: [['MaterialGUID', 'Unit1Price', 'ParentGUID'], [M3.toUpperCase(), 9.5, 'l1'], [M3, 8, 'l2']],
  })
  it('reads its materials with prices, cost, group, barcodes and quantity', () => {
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual(expect.objectContaining({ code: 'F-100', name: 'فلتر زيت تويوتا', barcode: '4011558744502', category: 'فلاتر', brand: 'Bosch', unit: 'قطعة', cost: 1.6, price: 2.5, wholesalePrice: 1.8, stock: 12, minStock: 3 }))
    expect(rows[1]).toEqual(expect.objectContaining({ barcode: '5011987654321, 5011987654338', price: 14, cost: 11 }))
  })
  it('takes the price lists when the material carries no price', () => {
    expect(rows[2]).toEqual(expect.objectContaining({ code: 'B-300', price: 9.5, wholesalePrice: 8, cost: 6, category: 'فلاتر' }))
  })
  it('leaves hidden materials out', () => { expect(rows.some(r => r.code === 'X-999')).toBe(false) })
})

describe('any program', () => {
  const tables: SourceTable[] = [
    { name: 'Settings', rows: 1, columns: ['K', 'V'] },
    { name: 'Customers', rows: 2, columns: ['ID', 'CustomerName', 'Mobile', 'Address', 'Balance'] },
    { name: 'Items', rows: 2, columns: ['ItemID', 'ItemCode', 'ItemName', 'Barcode', 'CostPrice', 'SalePrice', 'Qty', 'Unit', 'CategoryName'] },
    { name: 'Suppliers', rows: 1, columns: ['ID', 'SupplierName', 'Phone', 'Debit', 'Credit'] },
    { name: 'EmptyItems', rows: 0, columns: ['ItemName', 'SalePrice'] },
  ]
  it('finds the products, customers and suppliers tables', () => {
    expect(rankTables(tables, 'products')[0].name).toBe('Items')
    expect(rankTables(tables, 'customers')[0].name).toBe('Customers')
    expect(rankTables(tables, 'suppliers')[0].name).toBe('Suppliers')
    expect(rankTables(tables, 'products').some(t => t.name === 'Settings' || t.name === 'EmptyItems')).toBe(false)
  })
  it('reads English database columns', () => {
    const p = parseTable([['ItemID', 'ItemCode', 'ItemName', 'Barcode', 'CostPrice', 'SalePrice', 'Qty', 'Unit', 'CategoryName'], [1, 'A1', 'بواجي NGK', '4012345678901', 60000, 90000, 20, 'طقم', 'كهرباء']], 'products')
    expect(p.rows[0]).toEqual(expect.objectContaining({ code: 'A1', name: 'بواجي NGK', barcode: '4012345678901', cost: 60000, price: 90000, stock: 20, unit: 'طقم', category: 'كهرباء' }))
    const s = parseTable([['ID', 'SupplierName', 'Phone', 'Debit', 'Credit'], [1, 'مستودع الشرق', '0112233444', 0, 750000]], 'suppliers')
    expect(s.kind !== 'products' && s.signKnown).toBe(true)
    expect(s.rows[0]).toEqual(expect.objectContaining({ name: 'مستودع الشرق', phone: '0112233444', balance: -750000 }))
  })
})

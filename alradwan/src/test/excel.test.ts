import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { readProductsFile } from '../lib/excel'

const file = (aoa: unknown[][], bookType: XLSX.BookType = 'xlsx', name = 'list.xlsx') => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1')
  const out = XLSX.write(wb, { type: 'array', bookType }) as ArrayBuffer
  return new File([out], name)
}

describe('reading a product list', () => {
  it('reads a list with column titles', async () => {
    const { rows, guessed } = await readProductsFile(file([['الكود', 'اسم القطعة', 'سعر الشراء', 'سعر البيع', 'الكمية'], ['A1', 'فلتر زيت', 2, 3.5, 10]]))
    expect(guessed).toBeUndefined()
    expect(rows).toEqual([expect.objectContaining({ code: 'A1', name: 'فلتر زيت', cost: 2, price: 3.5, stock: 10 })])
  })

  it('finds the titles under a heading and skips the totals line', async () => {
    const { rows } = await readProductsFile(file([['قائمة المواد'], ['', ''], ['اسم المادة', 'الرمز', 'المبيع', 'الكلفة'], ['بواجي', 'B-7', 5, 3], ['المجموع', '', 5, 3]]))
    expect(rows).toEqual([expect.objectContaining({ code: 'B-7', name: 'بواجي', cost: 3, price: 5 })])
  })

  // the list another shop program exported: name, purchase price, sale price, no titles at all
  it('works out a list with no column titles from what is in it', async () => {
    const aoa = [['إسوارة علم', 0.16, 0.4, ''], ['فلتر هواء', 2, 3, ''], ['زيت 5W30', 7.5, 9, ''], ['لمبة', 0.5, 0.45, '']]
    const { rows, guessed } = await readProductsFile(file(aoa, 'biff8', 'قائمة المواد.xls'))
    expect(rows).toHaveLength(4)
    expect(rows[0]).toEqual(expect.objectContaining({ name: 'إسوارة علم', code: '', cost: 0.16, price: 0.4 }))
    expect(rows[3]).toEqual(expect.objectContaining({ name: 'لمبة', cost: 0.5, price: 0.45 }))
    expect(guessed).toContain('العمود A = الاسم')
    expect(guessed).toContain('العمود B = سعر الشراء')
    expect(guessed).toContain('العمود C = سعر البيع')
  })

  it('tells a barcode column and a quantity apart from the prices', async () => {
    const aoa = [['6291041500213', 'شامبو سيارات', 1, 1.5, 12], ['6281007030137', 'معطر', 0.7, 1, 30], ['5011321300016', 'منظف زجاج', 2, 2.75, 4]]
    const { rows } = await readProductsFile(file(aoa, 'csv', 'list.csv'))
    expect(rows[0]).toEqual(expect.objectContaining({ barcode: '6291041500213', name: 'شامبو سيارات', cost: 1, price: 1.5, stock: 12 }))
  })
})

import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { readPartiesFile, readProductsFile } from '../lib/excel'

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

describe('reading customers and suppliers', () => {
  it('reads an account-balances report with debit and credit columns', async () => {
    const { rows, signKnown } = await readPartiesFile(file([['تقرير أرصدة الحسابات'], [], ['رقم الحساب', 'اسم الحساب', 'الهاتف', 'مدين', 'دائن'], [101, 'ورشة الأمانة', '0933555111', 150000, 0], [102, 'أبو محمد', '', 0, 20000], ['', 'المجموع', '', 150000, 20000]]))
    expect(signKnown).toBe(true)
    expect(rows).toEqual([
      expect.objectContaining({ name: 'ورشة الأمانة', phone: '0933555111', balance: 150000 }),
      expect.objectContaining({ name: 'أبو محمد', balance: -20000 }),
    ])
  })
  it('a side column says which way the balance goes', async () => {
    const { rows } = await readPartiesFile(file([['اسم المورد', 'الرصيد', 'طبيعة الرصيد'], ['مستودع الشرق', 500000, 'دائن'], ['شركة النور', 30000, 'مدين']]))
    expect(rows.map(r => r.balance)).toEqual([-500000, 30000])
  })
  it('works out a list with no titles: running number, name, phone, balance', async () => {
    const { rows, guessed, signKnown } = await readPartiesFile(file([[1, 'خالد الحسن', 955777888, 75000], [2, 'سامر', '0944123456', 0], [3, 'محل الوفاء', '0933000111', 12500]]))
    expect(signKnown).toBe(false)
    expect(rows[0]).toEqual(expect.objectContaining({ name: 'خالد الحسن', phone: '0955777888', balance: 75000 }))
    expect(guessed).toContain('= الاسم')
    expect(guessed).toContain('= الهاتف')
    expect(guessed).toContain('= الرصيد')
  })
})

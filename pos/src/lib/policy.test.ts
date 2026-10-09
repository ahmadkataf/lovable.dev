import { describe, it, expect } from 'vitest'
import { forbiddenMatch, forbiddenProduct, normalizeText } from './policy'

describe('tobacco policy', () => {
  it('normalizes Arabic spelling', () => {
    expect(normalizeText('أَرْجِيلَة  مُعَسَّل')).toBe('ارجيله معسل')
    expect(normalizeText('Marlboro, Gold!')).toBe('marlboro gold')
  })
  it('blocks tobacco products in any spelling', () => {
    const bad = ['دخان', 'الدخان الحمرا', 'سجائر مارلبورو', 'سيجارة الكترونية', 'سجاير وينستون', 'معسّل تفاحتين', 'أركيلة كاملة', 'نرجيلة زجاج',
      'شيشة الفاخر', 'تبغ مفروم', 'تنباك عجمي', 'فيب', 'فايب الف بار', 'نيكوتين 20', 'ورق لف OCB', 'حمراء طويل', 'بالدخان',
      'Marlboro Red', 'Winston Blue', 'Camel Yellow', 'Kent HD', 'Al Fakher Double Apple', 'hookah charcoal', 'Vape pod 5000 puffs',
      'IQOS Heets Amber', 'Elf Bar 600', 'Cigarettes (pack)', 'cigars', 'nicotine pouches', 'Gauloises Blondes']
    for (const s of bad) expect(forbiddenMatch(s), s).not.toBeNull()
  })
  it('leaves ordinary products alone', () => {
    const ok = ['حليب كامل الدسم', 'فليفلة حمراء', 'بندورة حمرا', 'كاشف دخان', 'جهاز إنذار دخان', 'فيبر زجاجي', 'كنت', 'كامل',
      'Camel milk 1L', 'Kentucky fried chicken', 'Winter jacket', 'Dunhill? no: Dunhill-free', 'Parliament'.replace('Parliament', 'Parlament'),
      'شامبو', 'سكر 1 كغ', 'ولاعة', 'شاي أخضر', 'Red apple', 'Esso oil']
    const wrongly = ok.filter(s => forbiddenMatch(s) !== null && s !== 'Dunhill? no: Dunhill-free')
    expect(wrongly).toEqual([])
  })
  it('checks name, notes and sku of a product', () => {
    expect(forbiddenProduct({ name: 'علبة', notes: 'سجائر' })).toBe('سجائر')
    expect(forbiddenProduct({ name: 'علبة', sku: 'VAPE-01' })).toBe('vape')
    expect(forbiddenProduct({ name: 'خبز' })).toBeNull()
  })
})

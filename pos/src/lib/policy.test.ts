import { describe, it, expect } from 'vitest'
import { forbiddenMatch, forbiddenProduct, normalizeText, policyMatch } from './policy'

describe('content policy', () => {
  it('normalizes Arabic spelling', () => {
    expect(normalizeText('أَرْجِيلَة  مُعَسَّل')).toBe('ارجيله معسل')
    expect(normalizeText('Marlboro, Gold!')).toBe('marlboro gold')
  })
  it('blocks tobacco products in any spelling', () => {
    const bad = ['دخان', 'الدخان الحمرا', 'سجائر مارلبورو', 'سيجارة الكترونية', 'سجاير وينستون', 'معسّل تفاحتين', 'أركيلة كاملة', 'نرجيلة زجاج', 'تتن عجمي',
      'شيشة الفاخر', 'تبغ مفروم', 'تنباك عجمي', 'فيب', 'فايب الف بار', 'نيكوتين 20', 'ورق لف OCB', 'حمراء طويل', 'بالدخان', 'غليون خشب', 'جيك بار 15000',
      'Marlboro Red', 'Winston Blue', 'Camel Yellow', 'Kent HD', 'Al Fakher Double Apple', 'hookah charcoal', 'Vape pod 5000 puffs', 'Lost Mary BM600',
      'IQOS Heets Amber', 'Elf Bar 600', 'Cigarettes (pack)', 'cigars', 'nicotine pouches', 'Gauloises Blondes', 'Cohiba Robusto', 'Snus']
    for (const s of bad) expect(policyMatch(s)?.kind, s).toBe('tobacco')
  })
  it('blocks alcoholic drinks in any spelling', () => {
    const bad = ['خمر', 'خمور مستوردة', 'نبيذ أحمر', 'بيرة هاينكن', 'بيره 500 مل', 'ويسكي بلاك ليبل', 'فودكا', 'عرق الريان', 'عرق زحلاوي', 'مشروبات كحولية', 'كحول للشرب', 'شمبانيا', 'جعة',
      'Heineken 330ml', 'Red wine 750', 'Whisky Chivas 12', 'Vodka Absolut', 'Gin tonic', 'Jack Daniels', 'Beer Almaza', 'Tequila', 'Arak', 'Hard seltzer', 'Baileys', 'alcoholic beverage']
    for (const s of bad) expect(policyMatch(s)?.kind, s).toBe('alcohol')
  })
  it('leaves ordinary products alone', () => {
    const ok = ['حليب كامل الدسم', 'فليفلة حمراء', 'بندورة حمرا', 'كاشف دخان', 'جهاز إنذار دخان', 'فيبر زجاجي', 'كنت', 'كامل', 'كحول طبي 70%', 'كحول معقم', 'سبيرتو',
      'جل معقم كحولي', 'عطر بدون كحول', 'بيرة بدون كحول باربيكان', 'مشروب شعير موسي', 'عرق سوس', 'مزيل عرق نيفيا', 'خل نبيذ', 'كوكتيل فواكه', 'عصير كوكتيل', 'خل التفاح', 'جنة',
      'Camel milk 1L', 'Kentucky fried chicken', 'Winter jacket', 'Parlament', 'Esso oil', 'Ginger ale', 'Root beer', 'Apple cider vinegar', 'Non-alcoholic beer', 'Alcohol-free perfume',
      'Rubbing alcohol 70%', 'Hand sanitizer gel', 'Fruit cocktail juice', 'Wine vinegar', 'Ginger', 'Drum sticks', 'Rum raisin ice cream', 'Malt drink', 'Sakura tea',
      'شامبو', 'سكر 1 كغ', 'ولاعة', 'شاي أخضر', 'Red apple', 'سمك سالمون', 'مارتن لوثر', 'Martin boots']
    const wrongly = ok.filter(s => forbiddenMatch(s) !== null).map(s => `${s} → ${forbiddenMatch(s)}`)
    expect(wrongly).toEqual([])
  })
  it('checks name, notes and sku of a product', () => {
    expect(forbiddenProduct({ name: 'علبة', notes: 'سجائر' })).toBe('سجائر')
    expect(forbiddenProduct({ name: 'علبة', sku: 'VAPE-01' })).toBe('vape')
    expect(forbiddenProduct({ name: 'قنينة', notes: 'نبيذ' })).toBe('نبيذ')
    expect(forbiddenProduct({ name: 'خبز' })).toBeNull()
  })
})

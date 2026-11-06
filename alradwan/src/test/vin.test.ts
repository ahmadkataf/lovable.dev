import { describe, expect, it } from 'vitest'
import { decodeVinLocal, normalizeVin, splitOem } from '../lib/vin'
import { matchCarModels } from '../ui/cars'
import type { CarModel } from '../db/types'

describe('vin', () => {
  it('reads the maker, the country and the year without internet', () => {
    const r = decodeVinLocal('kmhdh41ebeu123456')
    expect(r.valid).toBe(true); expect(r.make).toBe('هيونداي'); expect(r.country).toBe('كوريا'); expect(r.year).toBe(2014)
    expect(decodeVinLocal('JTDBR32E570123456').make).toBe('تويوتا')
    expect(decodeVinLocal('WDB2030461A123456').make).toBe('مرسيدس')
    expect(decodeVinLocal('KNADM4A3XF6412345').year).toBe(2015)
  })
  it('rejects short numbers and strips the letters a VIN never holds', () => {
    expect(normalizeVin(' kna-dm4a3xf6412345 ')).toBe('KNADM4A3XF6412345')
    expect(decodeVinLocal('KNA').valid).toBe(false)
    expect(splitOem('26300-35503, 26300-35504؛ 1234')).toEqual(['26300-35503', '26300-35504', '1234'])
  })
  it('matches decoded english names to the shop\'s arabic models', () => {
    const models: CarModel[] = [
      { id: 'a', updatedAt: 0, make: 'هيونداي', model: 'إلنترا', yearFrom: 2011, yearTo: 2016 },
      { id: 'b', updatedAt: 0, make: 'هيونداي', model: 'إلنترا', yearFrom: 2017, yearTo: 2020 },
      { id: 'c', updatedAt: 0, make: 'كيا', model: 'ريو', yearFrom: 2012, yearTo: 2017 },
    ]
    expect(matchCarModels(models, 'Hyundai', 'Elantra', 2014).map(m => m.id)).toEqual(['a'])
    expect(matchCarModels(models, 'Hyundai', 'Elantra', 2019).map(m => m.id)).toEqual(['b'])
    expect(matchCarModels(models, 'Kia', undefined, 2015).map(m => m.id)).toEqual(['c'])
    expect(matchCarModels(models, 'Toyota', 'Corolla', 2010)).toEqual([])
  })
})

describe('vin — local tables', () => {
  it('names the model line of the common makes without internet', () => {
    const m = (v: string) => decodeVinLocal(v).model
    expect(m('KMHDH41EBEU123456')).toContain('إلنترا')
    expect(m('KMHCT41BAFU123456')).toContain('أكسنت')
    expect(m('KNADM4A3XF6412345')).toContain('ريو')
    expect(m('KNAPB811BC7123456')).toContain('سبورتاج')
    expect(m('JTDBR32E570123456')).toContain('كورولا')
    expect(m('JTEBU29J200123456')).toContain('برادو')
    expect(m('JN1TANT31U0123456')).toContain('إكس تريل')
    expect(m('JHMFD16507S123456')).toContain('سيفيك')
    expect(m('JMBSNCS3A7U123456')).toContain('لانسر')
    expect(m('WDD2040491A123456')).toContain('C-Class')
    expect(m('WDC1648221A123456')).toContain('ML')
    expect(m('WVWZZZ1KZ8W123456')).toContain('جولف')
    expect(m('TMBAG7NE0G0123456')).toContain('أوكتافيا')
    expect(m('JM1BL1SF1A1123456')).toContain('مازدا 3')
    expect(m('XTA219010D0123456')).toContain('غرانتا')
    expect(m('KL1JD69E39K123456')).toContain('كروز')
    expect(m('WBA3A5C50DF123456')).toContain('الفئة الثالثة')
    expect(m('VF1LSRB0H45123456')).toContain('لوغان')
  })
  it('knows makers from every region and prefers the longest prefix', () => {
    const k = (v: string) => decodeVinLocal(v)
    expect(k('LVVDB11B5CD123456').make).toBe('شيري')
    expect(k('LSJW14U67HS123456').make).toBe('MG')
    expect(k('NAAM01CA0CE123456').make).toContain('إيران خودرو')
    expect(k('MALAM51BLBM123456').make).toContain('هيونداي')
    expect(k('MALAM51BLBM123456').country).toBe('الهند')
    expect(k('1HGCM56476A123456').make).toContain('هوندا')
    expect(k('KMJWA37HABU123456').make).toContain('هيونداي')
    expect(k('5YJ3E1EA7KF123456').make).toBe('تسلا')
    expect(k('ZZZ12345678901234').make).toBeUndefined()
    expect(k('ZZZ12345678901234').country).toBe('سلوفينيا')
  })
})

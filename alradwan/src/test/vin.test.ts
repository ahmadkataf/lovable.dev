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

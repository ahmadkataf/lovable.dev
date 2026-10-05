import { describe, expect, it } from 'vitest'
import { codeFacts, gs1CheckDigit, gs1Country, gtin14, gtinKeys, parseGs1, productNumber, upcEtoA, validGtin } from '../lib/gs1'

describe('product numbers', () => {
  it('checks GS1 check digits', () => {
    expect(gs1CheckDigit('629104150021')).toBe(3)
    expect(validGtin('6291041500213')).toBe(true)
    expect(validGtin('6291041500214')).toBe(false)
    expect(validGtin('96385074')).toBe(true)           // EAN-8
    expect(validGtin('036000291452')).toBe(true)       // UPC-A
    expect(validGtin('15400141288763')).toBe(true)     // GTIN-14 / ITF-14
  })
  it('expands UPC-E to UPC-A', () => {
    expect(upcEtoA('01234565')).toBe('012345000065')
    expect(upcEtoA('04252614')).toBe('042100005264')
    expect(upcEtoA('12345678')).toBeNull()
  })
  it('gives every form of the same product one key', () => {
    expect(gtin14('036000291452')).toBe('00036000291452')
    expect(gtin14('0036000291452')).toBe('00036000291452')
    expect(gtin14('01234565')).toBe(gtin14('012345000065'))
    expect(gtin14('0012345000065')).toBe(gtin14('01234565'))   // what the camera returns for that UPC-E
    expect(gtin14('6291041500213')).toBe('06291041500213')
    expect(gtinKeys('01234565')).toEqual(['00012345000065', '00000001234565'])
    expect(gtinKeys('96385074')).toEqual(['00000096385074'])
    expect(gtin14('BOSCH-0986')).toBeNull()
    expect(gtin14('6291041500214')).toBeNull()
  })
  it('names the GS1 organisation that issued the prefix', () => {
    expect(gs1Country('6211234567891'.slice(0, 12) + gs1CheckDigit('621123456789'))).toBe('سوريا')
    expect(gs1Country('6291041500213')).toBe('الإمارات')
    expect(gs1Country('4006381333931')).toBe('ألمانيا')
    expect(gs1Country('8690504000013'.slice(0, 12) + gs1CheckDigit('869050400001'))).toBe('تركيا')
    expect(gs1Country('036000291452')).toBe('الولايات المتحدة وكندا')
    expect(gs1Country('15400141288763')).toBe('بلجيكا ولوكسمبورغ')
  })
})

describe('GS1 element strings', () => {
  it('reads Data Matrix / GS1-128 with group separators', () => {
    const f = parseGs1('0109501101530003\x1d10AB12\x1d17271231')!
    expect(f.map(x => [x.ai, x.value])).toEqual([['01', '09501101530003'], ['10', 'AB12'], ['17', '2027-12-31']])
  })
  it('reads fixed-length fields without separators', () => {
    const f = parseGs1('010950110153000317271231' + '10AB12')!
    expect(f.map(x => x.ai)).toEqual(['01', '17', '10'])
  })
  it('reads the bracketed human form', () => {
    expect(parseGs1('(01)09501101530003(10)AB12(17)271231')!.length).toBe(3)
  })
  it('reads GS1 Digital Link URLs from QR codes', () => {
    const f = parseGs1('https://id.gs1.org/01/09501101530003/10/AB12?17=271231')!
    expect(f.map(x => [x.ai, x.value])).toEqual([['01', '09501101530003'], ['10', 'AB12'], ['17', '2027-12-31']])
    expect(parseGs1('https://example.com/about')).toBeNull()
  })
  it('does not take plain barcodes or part numbers for GS1', () => {
    expect(parseGs1('6291041500213')).toBeNull()
    expect(parseGs1('09501101530003')).toBeNull()
    expect(parseGs1('0 986 452 041')).toBeNull()
    expect(parseGs1('0112345678901234')).toBeNull()   // wrong GTIN check digit
  })
  it('finds the product number in any form', () => {
    expect(productNumber('0109501101530003\x1d10AB12')).toBe('09501101530003')
    expect(productNumber('https://id.gs1.org/01/09501101530003')).toBe('09501101530003')
    expect(productNumber('9501101530003')).toBe('09501101530003')
    expect(productNumber('W 712/52')).toBeNull()
  })
  it('describes a scan', () => {
    expect(codeFacts('0986452041').looksLikePartNumber).toBe(true)
    expect(codeFacts('W 712/52').looksLikePartNumber).toBe(true)
    expect(codeFacts('6291041500213').looksLikePartNumber).toBe(false)
    expect(codeFacts('6291041500213').country).toBe('الإمارات')
    expect(codeFacts('6291041500214').validCheckDigit).toBe(false)
  })
})

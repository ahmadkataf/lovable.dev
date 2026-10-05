import { describe, expect, it } from 'vitest'
import { brandHint, codeFacts, gs1CheckDigit, gs1Country, gs1Date, gtin14, gtinKeys, learnBrandPrefixes, parseGs1, parseGs1Detailed, productNumber, publicGtin, upcEtoA, validGtin } from '../lib/gs1'

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
    expect(gs1Country('036000291452')).toBe('الولايات المتحدة')       // GS1 US in the official list
    expect(gs1Country('15400141288763')).toBe('بلجيكا ولوكسمبورغ')
  })
  it('follows the official GS1 prefix list', () => {
    const withCheck = (body: string) => body + gs1CheckDigit(body)
    expect(gs1Country(withCheck('623123456789'))).toBeNull()    // GS1 Global Office, not Brunei
    expect(gs1Country(withCheck('894123456789'))).toBeNull()    // GS1 Global Office, not Bangladesh
    expect(gs1Country(withCheck('381123456789'))).toBe('كوسوفو')
    expect(gs1Country(withCheck('605123456789'))).toBe('أوغندا')
    expect(gs1Country(withCheck('606123456789'))).toBe('أنغولا')
    expect(gs1Country(withCheck('607123456789'))).toBe('عُمان')
    expect(gs1Country(withCheck('617123456789'))).toBe('الكاميرون')
    expect(gs1Country(withCheck('632123456789'))).toBe('رواندا')
    expect(gs1Country(withCheck('680123456789'))).toBe('الصين')
    expect(gs1Country(withCheck('681123456789'))).toBe('الصين')
    expect(gs1Country(withCheck('887123456789'))).toBe('لاوس')
    expect(gs1Country(withCheck('978014300723'))).toBe('كتب (ISBN)')
    expect(gs1Country(withCheck('977123456789'))).toBe('دوريات (ISSN)')
    for (const p of ['200', '290', '952', '980', '982', '990', '999', '950', '961'])
      expect(gs1Country(withCheck(p + '123456789'))).toBeNull()
    expect(gs1Country(withCheck('21234567890'))).toBeNull()     // UPC number system 2: regional
    expect(gs1Country(withCheck('41234567890'))).toBeNull()     // UPC number system 4: in-store
    expect(gs1Country(withCheck('51234567890'))).toBeNull()     // reserved
    expect(gs1Country('000123456784')).toBe('الولايات المتحدة') // prefix 0001
    // EAN-8 has its own prefix; 960-969 are GS1 Global Office, 0 and 2 a shop's own
    expect(gs1Country(withCheck('6211234'))).toBe('سوريا')
    expect(gs1Country('96385074')).toBeNull()
    expect(gs1Country(withCheck('2123456'))).toBeNull()
  })
})

const GS = '\x1d'

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
  it('reads Digital Link on any host and path, percent-decoded, with GTINs padded and checked', () => {
    const f = parseGs1('https://shop.example.com/p/en/01/9501101530003/10/AB%2F12?17=271231;linkType=gs1:pip&3102=001234')!
    expect(f.map(x => [x.ai, x.value])).toEqual([['01', '09501101530003'], ['10', 'AB/12'], ['17', '2027-12-31'], ['3102', '12.34']])
    expect(productNumber('https://example.com/01/036000291452')).toBe('00036000291452')       // GTIN-12
    expect(productNumber('https://example.com/01/96385074')).toBe('00000096385074')           // GTIN-8
    expect(parseGs1('https://example.com/01/09501101530004')).toBeNull()                      // wrong check digit
    expect(parseGs1('https://example.com/01/AB')).toBeNull()
    const keys: [string, string][] = [
      ['00', '106141412345678908'], ['253', '9501101000006ABC'], ['255', '9501101000006123'], ['401', 'AB-123'],
      ['402', '95011010000000013'], ['414', '9501101000006'], ['415', '9501101000006'], ['417', '9501101000006'],
      ['8003', '09501101530003A1'], ['8004', 'ASSET-7'], ['8006', '095011015300030102'], ['8010', 'C-12'],
      ['8013', 'GMN-12'], ['8017', '950110100000000016'], ['8018', '950110100000000016'],
    ]
    for (const [ai, v] of keys) expect(parseGs1(`https://id.example.org/x/${ai}/${encodeURIComponent(v)}`)?.[0]).toMatchObject({ ai, value: v })
    expect(parseGs1('https://example.com/414/9501101000006/254/A1')!.map(x => x.ai)).toEqual(['414', '254'])
  })
  it('uses the GS1 century window and the last day of the month for day 00', () => {
    const now = new Date(2026, 9, 5)
    expect(gs1Date('271231', now)).toBe('2027-12-31')
    expect(gs1Date('760101', now)).toBe('2076-01-01')   // 50 years ahead
    expect(gs1Date('770101', now)).toBe('1977-01-01')   // 51 ahead is too far: last century
    expect(gs1Date('990615', now)).toBe('1999-06-15')
    expect(gs1Date('290101', new Date(2080, 0, 1))).toBe('2129-01-01')
    expect(gs1Date('310101', new Date(2080, 0, 1))).toBe('2031-01-01')
    expect(gs1Date('240200', now)).toBe('2024-02-29')   // was 2024-02-28 before (day 00 always became 28)
    expect(gs1Date('250200', now)).toBe('2025-02-28')
    expect(gs1Date('270400', now)).toBe('2027-04-30')
    expect(gs1Date('271300', now)).toBeNull()
    expect(gs1Date('270230', now)).toBeNull()
    expect(parseGs1('(01)09501101530003(17)271100')!.find(x => x.ai === '17')).toMatchObject({ value: '2027-11-30', raw: '271100' })
  })
  it('applies decimals to measures and amounts, and names countries', () => {
    const f = parseGs1('0109501101530003' + '3102001234' + '3300000150' + '3922' + '1250' + GS + '3932840995' + GS + '422760' + GS + '423760792' + GS + '421760DAM01')!
    expect(f.map(x => [x.ai, x.label, x.value])).toEqual([
      ['01', 'رقم المنتج GTIN', '09501101530003'],
      ['3102', 'الوزن الصافي (كغ)', '12.34'],
      ['3300', 'الوزن الإجمالي (كغ)', '150'],
      ['3922', 'السعر', '12.50'],
      ['3932', 'السعر', '9.95 USD'],
      ['422', 'بلد المنشأ', 'سوريا'],
      ['423', 'بلد المعالجة الأولية', 'سوريا، تركيا'],
      ['421', 'الرمز البريدي مع البلد', 'سوريا DAM01'],
    ])
    expect(f.find(x => x.ai === '422')!.raw).toBe('760')
    expect(parseGs1('(01)09501101530003(3105)000500')!.find(x => x.ai === '3105')!.value).toBe('0.00500')
  })
  it('reads the other AIs a parts box may carry', () => {
    const f = parseGs1('(03)09501101530003(20)07(22)CPV1(235)TPX(240)W712/75(241)C-9(242)12(243)P1(250)S2(251)R3(254)E4'
      + '(30)12(37)24(400)PO1(401)G1(402)95011010000000013(403)R(410)9501101000006(420)1234(424)276(425)156(426)392(427)SY-DI'
      + '(7001)1234567890123(7003)2712311430(7006)270101(7007)270101270105(7010)01(7020)RF(7021)OK(7022)B(7023)A1'
      + '(8001)12345678901234(8005)001250(8008)27013114(8012)1.2(8013)GMN(8020)PAY(8200)https://x.y(90)IN(91)CO')!
    const v = Object.fromEntries(f.map(x => [x.ai, x.value]))
    expect(f.every(x => !x.label.startsWith('AI '))).toBe(true)
    expect(v['424']).toBe('ألمانيا')
    expect(v['425']).toBe('الصين')
    expect(v['426']).toBe('اليابان')
    expect(v['7003']).toBe('2027-12-31 14:30')
    expect(v['7006']).toBe('2027-01-01')
    expect(v['7007']).toBe('2027-01-01 – 2027-01-05')
    expect(v['8008']).toBe('2027-01-31 14:00')
  })
  it('ends a field whose format is fixed but whose length is not predefined at the separator', () => {
    const f = parseGs1Detailed('0109501101530003' + '70032712311430' + GS + '10AB' + GS + '7001' + '1234567890123' + GS + '17271231')!
    expect(f.fields.map(x => [x.ai, x.value])).toEqual([['01', '09501101530003'], ['7003', '2027-12-31 14:30'], ['10', 'AB'], ['7001', '1234567890123'], ['17', '2027-12-31']])
    expect(f.complete).toBe(true)
    // a fixed field may or may not be followed by a separator
    expect(parseGs1('0109501101530003' + GS + '17271231' + GS + '10AB')!.map(x => x.ai)).toEqual(['01', '17', '10'])
    expect(parseGs1('0109501101530003' + '422276')!.map(x => x.value)).toEqual(['09501101530003', 'ألمانيا'])
  })
  it('says when it could not read everything', () => {
    const unknown = parseGs1Detailed('0109501101530003' + '7240ABC')!   // 7240 is not in our table
    expect(unknown).toEqual({ fields: [expect.objectContaining({ ai: '01' })], complete: false })
    expect(parseGs1('0109501101530003' + '7240ABC')!.map(x => x.ai)).toEqual(['01'])
    // the separator after 422 was lost: the rest cannot be split, so it is not taken as the country
    const lost = parseGs1Detailed('0109501101530003' + '422276' + '10AB12')!
    expect(lost.fields.map(x => x.ai)).toEqual(['01'])
    expect(lost.complete).toBe(false)
    const cut = parseGs1Detailed('0109501101530003' + '1727')!                 // cut off date
    expect(cut.complete).toBe(false)
    expect(parseGs1Detailed('0109501101530003' + '17271399')!.complete).toBe(false) // month 13
    expect(parseGs1Detailed('0109501101530003' + GS + '10AB12')!.complete).toBe(true)
    expect(parseGs1Detailed('(01)09501101530003(10)AB12')!.complete).toBe(true)
  })
  it('understands GS1 symbology identifiers', () => {
    expect(parseGs1(']d20109501101530003' + '10AB12')!.map(x => x.ai)).toEqual(['01', '10'])
    expect(parseGs1(']C10109501101530003' + '10AB12' + GS + '17271231')!.map(x => x.ai)).toEqual(['01', '10', '17'])
    // '%' is data in a GS1 QR Code, not a separator (GS1 General Specifications §7.8.5): only GS ends a field
    expect(parseGs1(']Q30109501101530003' + '10AB12%17271231')!.map(x => [x.ai, x.value])).toEqual([['01', '09501101530003'], ['10', 'AB12%17271231']])
    expect(parseGs1(']Q30109501101530003' + '10AB12' + GS + '17271231')!.map(x => [x.ai, x.value])).toEqual([['01', '09501101530003'], ['10', 'AB12'], ['17', '2027-12-31']])
    expect(productNumber(']Q1https://example.com/01/09501101530003')).toBe('09501101530003')
  })
  it('does not take plain barcodes or part numbers for GS1', () => {
    expect(parseGs1('6291041500213')).toBeNull()
    expect(parseGs1('1234567890128')).toBeNull()      // starts like AI 12, but month 34
    expect(parseGs1('15400141288763')).toBeNull()     // ITF-14, starts like AI 15
    expect(parseGs1('036000291452')).toBeNull()       // UPC-A, starts like AI 03
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
  it('reads a code that holds only the product number (GS1 DataBar)', () => {
    expect(parseGs1('0109501101530003')).toEqual([{ ai: '01', label: expect.any(String), value: '09501101530003' }])
    expect(productNumber('0109501101530003')).toBe('09501101530003')
    expect(productNumber(']e00109501101530003')).toBe('09501101530003')
  })
  it('does not break on a field without the shape its AI needs', () => {
    expect(parseGs1('(01)09501101530003(423)')?.[1]).toMatchObject({ ai: '423', value: '' })
    expect(parseGs1('(423)ABC')?.[0]).toMatchObject({ ai: '423', value: 'ABC' })
    expect(parseGs1('https://id.gs1.org/01/09501101530003?425=XYZ')?.[1]).toMatchObject({ ai: '425', value: 'XYZ' })
    expect(parseGs1('(3102)ABC')?.[0].value).toBe('ABC')
    expect(codeFacts('(01)09501101530003(423)').gtin).toBe('09501101530003')
  })
  it('describes a scan', () => {
    expect(codeFacts('0986452041').looksLikePartNumber).toBe(true)
    expect(codeFacts('W 712/52').looksLikePartNumber).toBe(true)
    expect(codeFacts('6291041500213').looksLikePartNumber).toBe(false)
    expect(codeFacts('6291041500213').country).toBe('الإمارات')
    expect(codeFacts('6291041500214').validCheckDigit).toBe(false)
  })
  it('gives the real origin and the part number from GS1 data', () => {
    const f = codeFacts('0109501101530003' + '240W 712/75' + GS + '422276')
    expect(f.origin).toBe('ألمانيا')
    expect(f.partNumber).toBe('W 712/75')
    expect(f.country).toBe(gs1Country('09501101530003'))  // where the number was registered, not made
    expect(codeFacts('(01)09501101530003(241)C-9(426)760').origin).toBe('سوريا')
    expect(codeFacts('(01)09501101530003(241)C-9(426)760').partNumber).toBe('C-9')
    expect(codeFacts('(01)09501101530003(422)999').origin).toBeNull()
    expect(codeFacts('(01)09501101530003(422)999(426)760').origin).toBe('سوريا')  // 422 unknown: use 426
    expect(codeFacts('6291041500213')).toMatchObject({ origin: null, partNumber: null })
  })
})

describe('parts makers from the barcode', () => {
  const withCheck = (body: string) => body + gs1CheckDigit(body)
  it('knows some makers and the part numbers they put in the barcode', () => {
    expect(brandHint('4011558744502')).toEqual({ brand: 'Mann-Filter' })
    expect(brandHint('4009026037935')).toEqual({ brand: 'Mahle' })
    expect(brandHint('3165143187111')).toEqual({ brand: 'Bosch' })
    expect(brandHint('4027816473947')).toEqual({ brand: 'febi bilstein', partNumber: '47394' })
    expect(brandHint('4054224042717')).toEqual({ brand: 'febi bilstein' })
    expect(brandHint('3276428376004')).toEqual({ brand: 'Valeo', partNumber: '837600' })
    expect(brandHint('3276428375472')).toEqual({ brand: 'Valeo', partNumber: '837547' })
    expect(brandHint('087295469620')).toEqual({ brand: 'NGK', partNumber: '6962' })
    expect(brandHint('0087295469620')).toEqual({ brand: 'NGK', partNumber: '6962' })
    expect(brandHint('087295169629')).toEqual({ brand: 'NGK', partNumber: '6962' })
    expect(brandHint(withCheck('1402781647394'))).toEqual({ brand: 'febi bilstein', partNumber: '47394' }) // a carton
    expect(brandHint('01040278164739471727123110AB')).toEqual({ brand: 'febi bilstein', partNumber: '47394' })
    expect(brandHint('6291041500213')).toBeNull()
    expect(brandHint('4027816473948')).toBeNull()   // wrong check digit
    expect(brandHint('W 712/52')).toBeNull()
  })
  it('prefers the shop\'s own names and the longer prefix', () => {
    expect(brandHint('6291041500213', new Map([['6291041', 'A']]))).toEqual({ brand: 'A' })
    expect(brandHint('6291041500213', new Map([['6291041', 'A'], ['62910415', 'B']]))).toEqual({ brand: 'B' })
    expect(brandHint('4011558744502', new Map([['4011558', 'Mann']]))).toEqual({ brand: 'Mann' })
    expect(brandHint('3276428376004', new Map([['3276428', 'VALEO']]))).toEqual({ brand: 'VALEO', partNumber: '837600' })
    expect(brandHint(withCheck('200123456789'), new Map([['2001234', 'A']]))).toBeNull() // a shop's own number
  })
  it('learns company prefixes from the shop\'s products', () => {
    const m = learnBrandPrefixes([
      { barcode: withCheck('629104150001'), brand: 'Bosch' },
      { barcode: 'P-1, ' + withCheck('629104150002'), brand: ' BOSCH ' },
      { barcode: withCheck('629104160001'), brand: 'Valeo' },
      { barcode: withCheck('629104160002'), brand: '' },
      { barcode: withCheck('629104160003') },
      { barcode: withCheck('200123456789'), brand: 'Store' },
      { barcode: withCheck('6211234'), brand: 'Eight' },
      { brand: 'NoCode' },
    ])
    expect([...m.entries()].sort()).toEqual([['6291041', 'Bosch'], ['62910415', 'Bosch'], ['62910416', 'Valeo']])
    expect(brandHint(withCheck('629104160099'), m)).toEqual({ brand: 'Valeo' })
    expect(brandHint(withCheck('629104170001'), m)).toEqual({ brand: 'Bosch' })
    expect(brandHint(withCheck('629104260001'), m)).toBeNull()
  })
})

describe('which numbers are shared between shops', () => {
  const withCheck = (body: string) => body + gs1CheckDigit(body)
  it('accepts real product numbers in every length', () => {
    expect(publicGtin('6291041500213')).toBe('06291041500213')
    expect(publicGtin('036000291452')).toBe('00036000291452')
    expect(publicGtin('96385074')).toBe('00000096385074')
    expect(publicGtin('01234565')).toBe('00012345000065')       // UPC-E
    expect(publicGtin(withCheck('978014300723'))).not.toBeNull() // a book
    expect(publicGtin('01095011015300031727123110AB12')).toBe('09501101530003') // GS1 data: its product number
  })
  it('refuses a shop\'s own numbers and anything else', () => {
    expect(publicGtin(withCheck('200123456789'))).toBeNull()  // in-store EAN-13 (2xx)
    expect(publicGtin(withCheck('21234567899'))).toBeNull()   // UPC number system 2 (weighed goods)
    expect(publicGtin(withCheck('41234567899'))).toBeNull()   // UPC number system 4 (store use)
    expect(publicGtin(withCheck('991234567890'))).toBeNull()  // coupon
    expect(publicGtin(withCheck('2123456'))).toBeNull()       // EAN-8 starting with 2
    expect(publicGtin('6291041500214')).toBeNull()            // wrong check digit
    expect(publicGtin('P-0001')).toBeNull()
    expect(publicGtin('26300-35503')).toBeNull()
  })
})


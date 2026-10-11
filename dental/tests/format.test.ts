import { formatMoney, matches, normalizeText, initials } from '../src/lib/format'
import { addDays, addMonths, ageFrom, combine, startOfWeek, timeOf, toISODate, fromISODate } from '../src/lib/dates'

const usd = { currency: 'USD', currencySymbol: '$', currencyDecimals: 2 }
describe('format', () => {
  it('money in both languages', () => {
    expect(formatMoney(1250, usd, 'en')).toBe('$1,250.00')
    expect(formatMoney(1250, usd, 'ar')).toBe('1,250.00 $')
    expect(formatMoney(-30, { currency: 'SYP', currencySymbol: 'ل.س', currencyDecimals: 0 }, 'ar')).toBe('-30 ل.س')
    expect(formatMoney(1500000, usd, 'en', { compact: true })).toBe('$1.5M')
  })
  it('arabic-insensitive search', () => {
    expect(normalizeText('أحمد')).toBe('احمد')
    expect(matches('فاطمة الزهراء', 'فاطمه')).toBe(true)
    expect(matches('Ahmad Khatib', 'khat')).toBe(true)
    expect(matches('٠٩٤٤', '0944')).toBe(true)
    expect(initials('أحمد الخطيب')).toBe('أخ')
    expect(initials('د. ليلى حداد')).toBe('لح')
    expect(initials('Dr. Sara Haddad')).toBe('SH')
  })
  it('dates', () => {
    expect(toISODate(fromISODate('2026-03-05'))).toBe('2026-03-05')
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-03-31', -1)).toBe('2028-02-29')
    expect(addMonths('2026-10-10', 3)).toBe('2027-01-10')
    expect(startOfWeek('2026-10-07', 6)).toBe('2026-10-03')   // Wednesday → previous Saturday
    expect(timeOf(combine('2026-10-07', '14:30'))).toBe('14:30')
    expect(ageFrom('2000-10-10', new Date(2026, 9, 9))).toBe(25)
    expect(ageFrom('2000-10-10', new Date(2026, 9, 10))).toBe(26)
  })
})

describe('money rounding and countries', () => {
  it('rounds half up exactly for 0–3 decimals', async () => {
    const { roundTo, round2, countryCodeFor, whatsappLink, setDefaultCountryCode } = await import('../src/lib/format')
    expect(roundTo(1.005, 2)).toBe(1.01)
    expect(roundTo(2.675, 2)).toBe(2.68)
    expect(roundTo(-1.005, 2)).toBe(-1.01)
    expect(roundTo(0.1 + 0.2, 2)).toBe(0.3)
    expect(roundTo(12.3456, 3)).toBe(12.346)
    expect(roundTo(2.5, 0)).toBe(3)
    expect(roundTo(99.995, 2)).toBe(100)
    expect(round2(33.33 * 3 * 1.05)).toBe(104.99)
    expect(countryCodeFor('sar')).toBe('966')
    setDefaultCountryCode('966')
    expect(whatsappLink('0501234567')).toBe('https://wa.me/966501234567')
    setDefaultCountryCode('963')
  })
  it('switches Arabic month names by region', async () => {
    const { fmtMonth, setArabicMonthStyle } = await import('../src/lib/dates')
    setArabicMonthStyle('standard'); expect(fmtMonth('2026-10-01', 'ar')).toContain('أكتوبر')
    setArabicMonthStyle('levant'); expect(fmtMonth('2026-10-01', 'ar')).toContain('تشرين')
  })
})

describe('phones and WhatsApp follow the clinic country', () => {
  it('keeps the spacing the clinic typed and groups bare numbers by country', async () => {
    const { formatPhone } = await import('../src/lib/format')
    // typed with spaces: kept as typed (landlines are not regrouped as mobiles)
    expect(formatPhone('011 222 3344', '963')).toBe('011 222 3344')
    expect(formatPhone('011  456   7890', '966')).toBe('011 456 7890')
    expect(formatPhone('0944-123-456', '963')).toBe('0944-123-456')
    // bare numbers
    expect(formatPhone('0944123456', '963')).toBe('0944 123 456')
    expect(formatPhone('0112223344', '963')).toBe('011 222 3344')
    expect(formatPhone('0551234567', '966')).toBe('055 123 4567')
    expect(formatPhone('0114567890', '966')).toBe('011 456 7890')
    expect(formatPhone('01012345678', '20')).toBe('010 1234 5678')
    expect(formatPhone('07701234567', '964')).toBe('0770 123 4567')
    expect(formatPhone('+963944123456')).toBe('+963 944 123 456')
    expect(formatPhone('+201012345678')).toBe('+20 101 234 5678')
    expect(formatPhone('12345')).toBe('12345')
    expect(formatPhone(undefined)).toBe('')
  })
  it('a local number gets the clinic country code, an international one keeps its own', async () => {
    const { whatsappLink, setDefaultCountryCode, countryCodeFor } = await import('../src/lib/format')
    for (const [cur, cc] of [['SAR', '966'], ['AED', '971'], ['EGP', '20'], ['JOD', '962'], ['IQD', '964'], ['KWD', '965'], ['SYP', '963']]) expect(countryCodeFor(cur)).toBe(cc)
    expect(countryCodeFor('USD')).toBe('')
    setDefaultCountryCode('966')
    expect(whatsappLink('055 123 4567')).toBe('https://wa.me/966551234567')
    expect(whatsappLink('+963 944 123 456')).toBe('https://wa.me/963944123456')
    expect(whatsappLink('00963944123456', 'مرحبا')).toBe(`https://wa.me/963944123456?text=${encodeURIComponent('مرحبا')}`)
    expect(whatsappLink('0551234567', undefined, '971')).toBe('https://wa.me/971551234567')
    setDefaultCountryCode('963')
    expect(whatsappLink('0944123456')).toBe('https://wa.me/963944123456')
  })
  it('dates use the Gregorian calendar and Latin digits with either month style', async () => {
    const { dateLocale, dateFormat, setArabicMonthStyle, fmtDate } = await import('../src/lib/dates')
    setArabicMonthStyle('standard')
    expect(dateLocale('ar')).toBe('ar-EG-u-ca-gregory-nu-latn')
    expect(fmtDate('2026-10-11', 'ar', 'long')).toBe('11 أكتوبر 2026')
    expect(dateFormat('ar', { month: 'long' }).format(new Date(2026, 7, 1))).toBe('أغسطس')
    setArabicMonthStyle('levant')
    expect(fmtDate('2026-10-11', 'ar', 'long')).toBe('11 تشرين الأول 2026')
    expect(dateFormat('ar', { month: 'long' }).format(new Date(2026, 7, 1))).toBe('آب')
    expect(fmtDate('2026-10-11', 'en', 'long')).toBe('11 October 2026')
  })
})

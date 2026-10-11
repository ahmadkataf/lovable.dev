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

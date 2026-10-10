import { formatMoney, matches, normalizeText, initials } from '../src/lib/format'
import { addDays, ageFrom, combine, startOfWeek, timeOf, toISODate, fromISODate } from '../src/lib/dates'

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
    expect(startOfWeek('2026-10-07', 6)).toBe('2026-10-03')   // Wednesday → previous Saturday
    expect(timeOf(combine('2026-10-07', '14:30'))).toBe('14:30')
    expect(ageFrom('2000-10-10', new Date(2026, 9, 9))).toBe(25)
    expect(ageFrom('2000-10-10', new Date(2026, 9, 10))).toBe(26)
  })
})

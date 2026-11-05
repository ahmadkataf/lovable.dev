import { describe, expect, it } from 'vitest'
import { addDays, dayPhrase, daysPhrase, firstName, li, periodsPhrase, today } from '../src/util'

describe('Arabic phrasing helpers', () => {
  it('keeps compound first names whole', () => {
    expect(firstName('محمد خالد')).toBe('محمد')
    expect(firstName('عبد الرحمن يوسف')).toBe('عبد الرحمن')
    expect(firstName('عبد الله سعيد')).toBe('عبد الله')
    expect(firstName('أبو بكر الصدّيق')).toBe('أبو بكر')
    expect(firstName('أم كلثوم')).toBe('أم كلثوم')
    expect(firstName('أ. سامر حسن')).toBe('سامر')
    expect(firstName('  ليان  ')).toBe('ليان')
    expect(firstName('')).toBe('')
  })

  it('attaches the preposition ل without a tatweel', () => {
    expect(li('محمد')).toBe('لمحمد')
    expect(li('الحسن')).toBe('للحسن')
    expect(li('عبد الرحمن')).toBe('لعبد الرحمن')
    expect(li('')).toBe('')
  })

  it('spells out consecutive days up to ten, then uses digits with the accusative', () => {
    expect(daysPhrase(1)).toBe('يوم واحد')
    expect(daysPhrase(2)).toBe('يومان متتاليان')
    expect(daysPhrase(3)).toBe('ثلاثة أيام متتالية')
    expect(daysPhrase(10)).toBe('عشرة أيام متتالية')
    expect(daysPhrase(12)).toBe('١٢ يوماً متتالياً')
  })

  it('names the day with the Levantine month and uses tanwīn after the alif', () => {
    expect(dayPhrase(today())).toBe('اليوم')
    expect(dayPhrase('2026-11-06')).toBe('يوم الجمعة ٦ تشرين الثاني')
    expect(dayPhrase('2027-01-03')).toBe('يوم الأحد ٣ كانون الثاني')
    expect(dayPhrase(addDays(today(), 400))).toMatch(/^يوم \S+ [٠-٩]+ /)
    expect(periodsPhrase(1)).toBe('حصّة واحدة')
    expect(periodsPhrase(2)).toBe('حصّتان')
    expect(periodsPhrase(4)).toBe('٤ حصص')
    expect(periodsPhrase(11)).toBe('١١ حصّة')
  })
})

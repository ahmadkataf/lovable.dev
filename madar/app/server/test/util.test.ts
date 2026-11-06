import { describe, expect, it } from 'vitest'
import { addDays, dayPhrase, daysPhrase, ellipsize, firstName, guardiansPhrase, lastSchoolDay, li, periodsPhrase, reportDate, schoolsPhrase, today, weekday } from '../src/util'

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
    expect(dayPhrase('2025-11-06')).toBe('يوم الخميس ٦ تشرين الثاني')
    expect(dayPhrase('2027-01-03')).toBe('يوم الأحد ٣ كانون الثاني')
    expect(dayPhrase(addDays(today(), 400))).toMatch(/^يوم \S+ [٠-٩]+ /)
    expect(periodsPhrase(1)).toBe('حصّة واحدة')
    expect(periodsPhrase(2)).toBe('حصّتان')
    expect(periodsPhrase(4)).toBe('٤ حصص')
    expect(periodsPhrase(11)).toBe('١١ حصّة')
  })
})

describe('report day and text helpers', () => {
  it('the report day is today on a school day and the Thursday before on the weekend', () => {
    expect(lastSchoolDay('2026-11-05')).toBe('2026-11-05')   // Thursday
    expect(lastSchoolDay('2026-11-06')).toBe('2026-11-05')   // Friday
    expect(lastSchoolDay('2026-11-07')).toBe('2026-11-05')   // Saturday
    expect(lastSchoolDay('2026-11-08')).toBe('2026-11-08')   // Sunday
    expect(weekday(reportDate())).toBeLessThanOrEqual(4)
    expect(reportDate() <= today()).toBe(true)
  })

  it('shortens long bodies at a word boundary with «…», never mid-word', () => {
    expect(ellipsize('نصّ قصير', 100)).toBe('نصّ قصير')
    const long = 'تحديث بيانات الطلاب وأولياء الأمور على المنصّة قبل نهاية الأسبوع الحالي من دون استثناء'
    const cut = ellipsize(long, 40)
    expect(cut.endsWith('…')).toBe(true)
    expect(cut.length).toBeLessThanOrEqual(41)
    expect(long.startsWith(cut.slice(0, -1))).toBe(true)
    expect(long.charAt(cut.length - 1)).toBe(' ')          // the cut falls on a space of the original
    expect(ellipsize('كلمة،  ' + 'طويلة'.repeat(30), 20)).toMatch(/^كلمة…$|^كلمة، طويلة.*…$/)
    expect(ellipsize('   ', 10)).toBe('')
    expect(ellipsize(null, 10)).toBe('')
  })

  it('counts schools and guardians with Arabic agreement', () => {
    expect(schoolsPhrase(1)).toBe('مدرسة واحدة')
    expect(schoolsPhrase(2)).toBe('مدرستان')
    expect(schoolsPhrase(10)).toBe('١٠ مدارس')
    expect(schoolsPhrase(12)).toBe('١٢ مدرسة')
    expect(guardiansPhrase(1)).toBe('وليّ أمر واحد')
    expect(guardiansPhrase(5)).toBe('٥ أولياء أمور')
    expect(guardiansPhrase(84)).toBe('٨٤ وليّ أمر')
  })
})

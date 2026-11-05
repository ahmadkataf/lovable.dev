import { describe, expect, it } from 'vitest'
import { rankCandidates, suggest, suggestionNote, weeklyLoad, type Candidate, type EngineContext, type Slot, type TimetableRow } from '../src/substitute'

// A small school: the absent maths teacher (1) and five colleagues.
const T = (id: number, name: string, subject_id: number | null, subject: string | null) => ({ id, name, subject_id, subject })
const teachers = [
  T(2, 'ماهر', 2, 'الرياضيات'),       // same subject
  T(3, 'هبة', 1, 'اللغة العربية'),    // teaches the section
  T(4, 'لينا', 4, 'اللغة الإنكليزية'),// teaches the section, lighter load
  T(5, 'عمر', 6, 'التربية الرياضية'), // other section only
  T(6, 'خالد', 5, 'الدراسات'),        // busy at that period
]
const row = (teacher_id: number, day: number, period: number, section_id: number): TimetableRow => ({ teacher_id, day, period, section_id })
const timetable: TimetableRow[] = [
  row(1, 4, 3, 10), row(1, 4, 5, 11),          // the absent teacher's Thursday: period 3 in section 10, period 5 in section 11
  row(2, 4, 1, 11), row(2, 0, 1, 10), row(2, 1, 1, 10),
  row(3, 4, 1, 10), row(3, 4, 2, 10), row(3, 0, 2, 10), row(3, 1, 2, 10), row(3, 2, 2, 10), row(3, 3, 2, 10),
  row(4, 4, 4, 10), row(4, 0, 3, 10),
  row(5, 4, 6, 11), row(5, 0, 4, 11),
  row(6, 4, 3, 11), row(6, 4, 5, 10),
]
const slot3: Slot = { timetable_id: 1, period: 3, section_id: 10, section_label: 'الخامس (ب)', subject_id: 2, subject: 'الرياضيات' }
const slot5: Slot = { timetable_id: 2, period: 5, section_id: 11, section_label: 'السادس (أ)', subject_id: 2, subject: 'الرياضيات' }
const base: EngineContext = { day: 4, weeklyCap: 28, teachers, timetable, absent: [1], assigned: [], monthCount: {}, weekCount: {} }

describe('rankCandidates', () => {
  it('excludes teachers who are busy, absent or already assigned at that period', () => {
    const ids = rankCandidates(slot3, base).map(c => c.teacher_id)
    expect(ids).not.toContain(6)      // teaches section 11 at Thursday period 3
    expect(ids).not.toContain(1)      // the absent teacher
    expect(rankCandidates(slot3, { ...base, absent: [1, 2] }).map(c => c.teacher_id)).not.toContain(2)
    expect(rankCandidates(slot3, { ...base, assigned: [{ teacher_id: 2, period: 3 }] }).map(c => c.teacher_id)).not.toContain(2)
    expect(rankCandidates(slot3, { ...base, assigned: [{ teacher_id: 2, period: 5 }] }).map(c => c.teacher_id)).toContain(2)   // other period: fine
  })

  it('ranks by tier: same subject, then teaches the section, then others', () => {
    const ranked = rankCandidates(slot3, base)
    expect(ranked.map(c => c.teacher_id)).toEqual([2, 4, 3, 5])
    expect(ranked.map(c => c.tier)).toEqual([1, 2, 2, 3])
    expect(ranked[0].reason).toContain('المادّة نفسها')
    expect(ranked[1].reason).toContain('من معلّمي الشعبة')
    expect(ranked[3].reason).toContain('حصّة فراغ')
  })

  it('within a tier prefers fewer substitutions this month, then fewer weekly periods, then the name', () => {
    // Tier 2 holds هبة (6 periods) and لينا (2 periods): لينا first by load…
    expect(rankCandidates(slot3, base).slice(1, 3).map(c => c.name)).toEqual(['لينا', 'هبة'])
    // …unless she already covered more periods this month.
    const ctx = { ...base, monthCount: { 4: 2 } }
    expect(rankCandidates(slot3, ctx).slice(1, 3).map(c => c.name)).toEqual(['هبة', 'لينا'])
    expect(rankCandidates(slot3, ctx).find(c => c.name === 'لينا')!.reason).toContain('تعويضان هذا الشهر')
    // Equal load and equal month count: alphabetical.
    const tie = { ...base, timetable: timetable.filter(r => r.teacher_id !== 3).concat([row(3, 4, 1, 10), row(3, 0, 2, 10)]) }
    expect(rankCandidates(slot3, tie).slice(1, 3).map(c => c.name)).toEqual(['لينا', 'هبة'])   // ل before ه
  })

  it('applies the weekly cap (weekly periods + substitutions this week)', () => {
    expect(rankCandidates(slot3, { ...base, weeklyCap: 6 }).map(c => c.teacher_id)).not.toContain(3)   // هبة has 6 periods
    expect(rankCandidates(slot3, { ...base, weeklyCap: 7 }).map(c => c.teacher_id)).toContain(3)
    expect(rankCandidates(slot3, { ...base, weeklyCap: 7, weekCount: { 3: 1 } }).map(c => c.teacher_id)).not.toContain(3)
  })

  it('counts weekly load from the timetable', () => {
    expect(weeklyLoad(timetable)).toMatchObject({ 1: 2, 3: 6, 4: 2 })
  })
})

describe('suggest', () => {
  it('keeps the top three per slot and names the first as the substitute', () => {
    const [s3, s5] = suggest([slot3, slot5], base)
    expect(s3.candidates).toHaveLength(3)
    expect(s3.candidates.map(c => c.teacher_id)).toEqual([2, 4, 3])
    expect(s3.substitute_teacher_id).toBe(2)
    expect(s5.candidates.map(c => c.teacher_id)).toEqual([2, 5, 4])   // period 5: 6 is busy, 5 teaches section 11
    expect(s5.substitute_teacher_id).toBe(2)
  })

  it('returns no candidates (and no substitute) when nobody is free', () => {
    const everyoneBusy = { ...base, timetable: timetable.concat(teachers.map(t => row(t.id, 4, 3, 99))) }
    const [s] = suggest([slot3], everyoneBusy)
    expect(s.candidates).toEqual([])
    expect(s.substitute_teacher_id).toBeNull()
  })
})

describe('suggestionNote', () => {
  const c = (tier: 1 | 2 | 3): Candidate => ({ teacher_id: 9, name: 'x', subject: 's', tier, reason: 'r' })
  it('explains a list that no same-subject teacher heads, and an empty one', () => {
    expect(suggestionNote('suggested', 'العلوم', [c(1), c(3)])).toBeNull()
    expect(suggestionNote('suggested', 'العلوم', [c(2), c(3)])).toBe('لا معلّم العلوم متاحاً في هذه الحصّة، فاقتُرح معلّمون من مواد أخرى')
    expect(suggestionNote('suggested', 'التربية الرياضية', [c(3)])).toBe('لا معلّم التربية الرياضية متاحاً في هذه الحصّة، فاقتُرح معلّمون من مواد أخرى')
    expect(suggestionNote('suggested', 'العلوم', [])).toBe('لا معلّم متاحاً في هذه الحصّة — تعلّم ذاتي موجَّه')
    expect(suggestionNote('approved', 'العلوم', [c(3)])).toBeNull()   // decided: nothing left to explain
    expect(suggestionNote('self_study', 'العلوم', [])).toBeNull()
  })
  it('keeps the reason texts neutral and the tanwīn after the alif', () => {
    const ranked = rankCandidates(slot3, base)
    expect(ranked.map(x => x.reason).join(' ')).not.toMatch(/ًا|غير متخصّص|يدرّس الشعبة/)
    expect(ranked.find(x => x.tier === 2)!.reason).toMatch(/^من معلّمي الشعبة · حصّة فراغ · /)
    expect(ranked.find(x => x.tier === 3)!.reason).toMatch(/^حصّة فراغ · /)
  })
})

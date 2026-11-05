// Substitute engine (docs/mvp-spec.md §6): pure ranking over plain arrays + one thin D1 wrapper.
import type { Env } from './types'
import { fanOut, notify, schoolAccounts } from './notify'
import { addDays, countPhrase, dayPhrase, monthStart, nextMonthStart, periodsPhrase, weekStart, weekday } from './util'

export interface TeacherInfo { id: number; name: string; subject_id: number | null; subject: string | null }
/** One affected period of the absent teacher. */
export interface Slot { timetable_id: number; period: number; section_id: number; section_label: string; subject_id: number; subject: string }
export interface TimetableRow { teacher_id: number; day: number; period: number; section_id: number }
export interface EngineContext {
  day: number                                           // weekday of the absence (0 = الأحد)
  weeklyCap: number                                     // WEEKLY_CAP (default 28)
  teachers: TeacherInfo[]                               // same school, the absent teacher excluded
  timetable: TimetableRow[]                             // the school's whole weekly timetable
  absent: number[]                                      // teachers absent on that date
  assigned: { teacher_id: number; period: number }[]   // substitutions already given that date (other absences)
  monthCount: Record<number, number>                   // approved substitutions this month, per teacher
  weekCount: Record<number, number>                    // approved substitutions this week, per teacher
}
export interface Candidate { teacher_id: number; name: string; subject: string | null; tier: 1 | 2 | 3; reason: string }
export interface Suggestion { slot: Slot; candidates: Candidate[]; substitute_teacher_id: number | null }

export const DEFAULT_WEEKLY_CAP = 28
export const TOP_N = 3

const TIER_TEXT: Record<1 | 2 | 3, string> = { 1: 'المادّة نفسها', 2: 'من معلّمي الشعبة', 3: 'حصّة فراغ' }
const monthPhrase = (n: number) => n === 0 ? 'بلا تعويضات هذا الشهر'
  : countPhrase(n, { one: 'تعويض واحد هذا الشهر', two: 'تعويضان هذا الشهر', few: 'تعويضات هذا الشهر', many: 'تعويضاً هذا الشهر' })

/** Weekly timetable periods per teacher. */
export function weeklyLoad(timetable: TimetableRow[]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const r of timetable) out[r.teacher_id] = (out[r.teacher_id] ?? 0) + 1
  return out
}

/** Every eligible candidate for one slot, best first (tier, then fairness, then load, then name). */
export function rankCandidates(slot: Slot, ctx: EngineContext): Candidate[] {
  const load = weeklyLoad(ctx.timetable)
  const busy = new Set(ctx.timetable.filter(r => r.day === ctx.day && r.period === slot.period).map(r => r.teacher_id))
  const teachesSection = new Set(ctx.timetable.filter(r => r.section_id === slot.section_id).map(r => r.teacher_id))
  const assigned = new Set(ctx.assigned.filter(a => a.period === slot.period).map(a => a.teacher_id))
  const absent = new Set(ctx.absent)
  const month = (id: number) => ctx.monthCount[id] ?? 0
  const week = (id: number) => ctx.weekCount[id] ?? 0

  return ctx.teachers
    .filter(t => !busy.has(t.id) && !absent.has(t.id) && !assigned.has(t.id))
    .filter(t => (load[t.id] ?? 0) + week(t.id) < ctx.weeklyCap)            // weekly cap
    .map(t => {
      const tier: 1 | 2 | 3 = t.subject_id !== null && t.subject_id === slot.subject_id ? 1 : teachesSection.has(t.id) ? 2 : 3
      const reason = (tier === 3 ? TIER_TEXT[3] : `${TIER_TEXT[tier]} · حصّة فراغ`) + ' · ' + monthPhrase(month(t.id))
      return { teacher_id: t.id, name: t.name, subject: t.subject, tier, reason }
    })
    .sort((a, b) => a.tier - b.tier
      || month(a.teacher_id) - month(b.teacher_id)
      || (load[a.teacher_id] ?? 0) - (load[b.teacher_id] ?? 0)
      || a.name.localeCompare(b.name, 'ar'))
}

/** Top candidates for every affected slot; the first one becomes the suggested substitute. */
export function suggest(slots: Slot[], ctx: EngineContext): Suggestion[] {
  return slots.map(slot => {
    const candidates = rankCandidates(slot, ctx).slice(0, TOP_N)
    return { slot, candidates, substitute_teacher_id: candidates[0]?.teacher_id ?? null }
  })
}

// ---------- D1 wrapper ----------
export interface AffectedRow {
  substitution_id: number; timetable_id: number; period: number; section_id: number; section_label: string; subject: string
  status: string; substitute_teacher_id: number | null; substitute: string | null; lesson_note: string | null; candidates: Candidate[]
  no_candidate: boolean   // still 'suggested' but nobody is free: the UI shows «لا بديل متاح — تعلّم ذاتي موجَّه»
}
export interface EngineResult { absence_id: number; teacher_id: number; teacher: string; date: string; affected: AffectedRow[] }

type AbsenceRow = { id: number; teacher_id: number; date: string; reason: string | null; teacher: string; school_id: number }

const counts = (rows: { id: number; n: number }[]): Record<number, number> => Object.fromEntries(rows.map(r => [r.id, r.n]))

/** The substitution rows of an absence as the API returns them. */
export async function affectedRows(db: D1Database, absenceId: number): Promise<AffectedRow[]> {
  const { results } = await db.prepare(`
    SELECT s.id AS substitution_id, s.timetable_id, t.period, t.section_id, sec.label AS section_label, sj.name AS subject,
           s.status, s.substitute_teacher_id, u.name AS substitute, s.lesson_note, s.candidates
    FROM substitutions s JOIN timetable t ON t.id = s.timetable_id JOIN sections sec ON sec.id = t.section_id
    JOIN subjects sj ON sj.id = t.subject_id LEFT JOIN users u ON u.id = s.substitute_teacher_id
    WHERE s.absence_id = ? ORDER BY t.period`).bind(absenceId).all<Omit<AffectedRow, 'candidates'> & { candidates: string }>()
  return results.map(r => {
    const candidates = JSON.parse(r.candidates || '[]') as Candidate[]
    return { ...r, candidates, no_candidate: r.status === 'suggested' && candidates.length === 0 }
  })
}

/**
 * Runs the engine for one absence: creates the missing `substitutions` rows (INSERT OR IGNORE, so re-running is
 * harmless) and tells the school account how many periods need cover. Returns the absence with its affected periods.
 */
export async function runEngine(db: D1Database, env: Pick<Env, 'WEEKLY_CAP'>, absenceId: number): Promise<EngineResult | null> {
  const absence = await db.prepare(
    'SELECT a.id, a.teacher_id, a.date, a.reason, u.name AS teacher, u.school_id FROM absences a JOIN users u ON u.id = a.teacher_id WHERE a.id = ?')
    .bind(absenceId).first<AbsenceRow>()
  if (!absence) return null
  const day = weekday(absence.date)
  const slots = day > 4 ? [] : (await db.prepare(`
    SELECT t.id AS timetable_id, t.period, t.section_id, sec.label AS section_label, t.subject_id, sj.name AS subject
    FROM timetable t JOIN sections sec ON sec.id = t.section_id JOIN subjects sj ON sj.id = t.subject_id
    WHERE t.teacher_id = ? AND t.day = ? ORDER BY t.period`).bind(absence.teacher_id, day).all<Slot>()).results

  let created = 0
  if (slots.length) {
    const ws = weekStart(absence.date)
    const [teachers, timetable, absent, assigned, month, week] = await Promise.all([
      db.prepare(`SELECT u.id, u.name, u.subject_id, sj.name AS subject FROM users u LEFT JOIN subjects sj ON sj.id = u.subject_id
                  WHERE u.role = 'teacher' AND u.school_id = ? AND u.id <> ?`).bind(absence.school_id, absence.teacher_id).all<TeacherInfo>(),
      db.prepare('SELECT t.teacher_id, t.day, t.period, t.section_id FROM timetable t JOIN sections sec ON sec.id = t.section_id WHERE sec.school_id = ?')
        .bind(absence.school_id).all<TimetableRow>(),
      db.prepare('SELECT a.teacher_id FROM absences a JOIN users u ON u.id = a.teacher_id WHERE a.date = ? AND u.school_id = ?')
        .bind(absence.date, absence.school_id).all<{ teacher_id: number }>(),
      db.prepare(`SELECT s.substitute_teacher_id AS teacher_id, t.period FROM substitutions s JOIN absences a ON a.id = s.absence_id
                  JOIN timetable t ON t.id = s.timetable_id JOIN users u ON u.id = a.teacher_id
                  WHERE a.date = ? AND u.school_id = ? AND a.id <> ? AND s.substitute_teacher_id IS NOT NULL AND s.status IN ('suggested', 'approved')`)
        .bind(absence.date, absence.school_id, absence.id).all<{ teacher_id: number; period: number }>(),
      db.prepare(`SELECT s.substitute_teacher_id AS id, COUNT(*) AS n FROM substitutions s JOIN absences a ON a.id = s.absence_id
                  WHERE s.status = 'approved' AND a.date >= ? AND a.date < ? GROUP BY s.substitute_teacher_id`)
        .bind(monthStart(absence.date), nextMonthStart(absence.date)).all<{ id: number; n: number }>(),
      db.prepare(`SELECT s.substitute_teacher_id AS id, COUNT(*) AS n FROM substitutions s JOIN absences a ON a.id = s.absence_id
                  WHERE s.status = 'approved' AND a.date >= ? AND a.date <= ? GROUP BY s.substitute_teacher_id`)
        .bind(ws, addDays(ws, 6)).all<{ id: number; n: number }>(),
    ])
    const ctx: EngineContext = {
      day, weeklyCap: Number(env.WEEKLY_CAP) || DEFAULT_WEEKLY_CAP,
      teachers: teachers.results, timetable: timetable.results,
      absent: absent.results.map(r => r.teacher_id), assigned: assigned.results,
      monthCount: counts(month.results), weekCount: counts(week.results),
    }
    const suggestions = suggest(slots, ctx)
    const results = await db.batch(suggestions.map(s => db.prepare(
      'INSERT OR IGNORE INTO substitutions (absence_id, timetable_id, substitute_teacher_id, status, candidates) VALUES (?, ?, ?, ?, ?)')
      .bind(absence.id, s.slot.timetable_id, s.substitute_teacher_id, 'suggested', JSON.stringify(s.candidates))))
    created = results.reduce((n, r) => n + (r.meta?.changes ?? 0), 0)
  }
  if (created > 0) {
    const body = `غياب أ. ${absence.teacher} ${dayPhrase(absence.date)}: ${periodsPhrase(slots.length)} بحاجة إلى تغطية`
    await notify(db, fanOut(await schoolAccounts(db, absence.school_id), 'absence_teacher', body, `/absences/${absence.id}`))
  }
  return { absence_id: absence.id, teacher_id: absence.teacher_id, teacher: absence.teacher, date: absence.date, affected: await affectedRows(db, absence.id) }
}

/** Runs the engine for every absence on `date` (of one school, or all) that has no substitution rows yet — e.g. the seeded one. */
export async function ensureSubstitutions(db: D1Database, env: Pick<Env, 'WEEKLY_CAP'>, date: string, schoolId: number | null): Promise<void> {
  if (weekday(date) > 4) return
  const { results } = await db.prepare(`
    SELECT a.id FROM absences a JOIN users u ON u.id = a.teacher_id
    WHERE a.date = ? AND (? IS NULL OR u.school_id = ?) AND NOT EXISTS (SELECT 1 FROM substitutions s WHERE s.absence_id = a.id)`)
    .bind(date, schoolId, schoolId).all<{ id: number }>()
  for (const r of results) await runEngine(db, env, r.id)
}

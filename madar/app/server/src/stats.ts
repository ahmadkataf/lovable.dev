// Dashboard numbers shared by the school and directorate routes and the CSV report.
import { placeholders, schoolDaysBack, isSchoolDay } from './util'

export interface DayStatus { student_id: number; section_id: number; grade: number; school_id: number; status: 'present' | 'absent' | 'late' | null }

/** One row per student: the status of the first recorded period of `date` (null = nothing recorded). */
export async function dayStatuses(db: D1Database, date: string, schoolId: number | null): Promise<DayStatus[]> {
  const { results } = await db.prepare(`
    SELECT st.id AS student_id, sec.id AS section_id, sec.grade, sec.school_id,
           (SELECT a.status FROM attendance a WHERE a.student_id = st.id AND a.date = ? ORDER BY a.period LIMIT 1) AS status
    FROM students st JOIN sections sec ON sec.id = st.section_id WHERE ? IS NULL OR sec.school_id = ?`).bind(date, schoolId, schoolId).all<DayStatus>()
  return results
}

export const isPresent = (s: DayStatus['status']) => s === 'present' || s === 'late'
export const pct = (part: number, whole: number): number | null => whole > 0 ? Math.round((100 * part) / whole) : null

export interface SchoolStats {
  id: number; name: string; complex: string
  students: number; recorded: number; present: number; present_pct: number | null; attendance_uploaded: boolean
  attendance_confirmed: boolean   // the school has confirmed that day's attendance (POST /api/attendance/confirm)
  teachers: number; teachers_present: number
  affected_periods: number; covered_periods: number; uncovered_periods: number; coverage_pct: number
  homework_today: number
  attendance_by_grade: { grade: number; pct: number | null }[]
}

export async function schoolStats(db: D1Database, schoolId: number, date: string): Promise<SchoolStats | null> {
  const school = await db.prepare('SELECT id, name, complex FROM schools WHERE id = ?').bind(schoolId).first<{ id: number; name: string; complex: string }>()
  if (!school) return null
  const [statuses, teachers, absent, subs, homework, confirmed] = await Promise.all([
    dayStatuses(db, date, schoolId),
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'teacher' AND school_id = ?").bind(schoolId).first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) AS n FROM absences a JOIN users u ON u.id = a.teacher_id WHERE a.date = ? AND u.school_id = ?').bind(date, schoolId).first<{ n: number }>(),
    db.prepare(`SELECT s.status, COUNT(*) AS n FROM substitutions s JOIN absences a ON a.id = s.absence_id JOIN users u ON u.id = a.teacher_id
                WHERE a.date = ? AND u.school_id = ? GROUP BY s.status`).bind(date, schoolId).all<{ status: string; n: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM homework h JOIN sections sec ON sec.id = h.section_id WHERE sec.school_id = ? AND date(h.created_at, '+3 hours') = ?`)
      .bind(schoolId, date).first<{ n: number }>(),
    db.prepare(`SELECT 1 AS x FROM attendance a JOIN students st ON st.id = a.student_id JOIN sections sec ON sec.id = st.section_id
                WHERE a.date = ? AND sec.school_id = ? AND a.confirmed = 1 LIMIT 1`).bind(date, schoolId).first<{ x: number }>(),
  ])
  const recorded = statuses.filter(s => s.status !== null)
  const present = recorded.filter(s => isPresent(s.status)).length
  const affected = subs.results.reduce((n, r) => n + r.n, 0)
  const covered = subs.results.filter(r => r.status === 'approved' || r.status === 'self_study').reduce((n, r) => n + r.n, 0)
  const grades = [...new Set(statuses.map(s => s.grade))].sort((a, b) => a - b)
  return {
    ...school,
    students: statuses.length, recorded: recorded.length, present, present_pct: pct(present, recorded.length), attendance_uploaded: recorded.length > 0,
    attendance_confirmed: confirmed !== null,
    teachers: teachers?.n ?? 0, teachers_present: Math.max(0, (teachers?.n ?? 0) - (absent?.n ?? 0)),
    affected_periods: affected, covered_periods: covered, uncovered_periods: affected - covered, coverage_pct: affected ? Math.round((100 * covered) / affected) : 100,
    homework_today: homework?.n ?? 0,
    attendance_by_grade: grades.map(grade => {
      const rows = recorded.filter(s => s.grade === grade)
      return { grade, pct: pct(rows.filter(s => isPresent(s.status)).length, rows.length) }
    }),
  }
}

export interface ThreeDayAbsence { student_id: number; student_name: string; section_label: string; school: string; school_id: number; days: number }

/** Students absent on `date` (or the last school day before it) and on the preceding school days — streaks of three or more. */
export async function threeDayAbsences(db: D1Database, date: string, schoolId: number | null): Promise<ThreeDayAbsence[]> {
  const dates = schoolDaysBack(isSchoolDay(date) ? date : date, 10)
  const { results } = await db.prepare(`
    SELECT a.student_id, a.date, a.status, u.name AS student_name, sec.label AS section_label, sc.name AS school, sc.id AS school_id
    FROM attendance a JOIN students st ON st.id = a.student_id JOIN users u ON u.id = st.user_id
    JOIN sections sec ON sec.id = st.section_id JOIN schools sc ON sc.id = sec.school_id
    WHERE a.date IN (${placeholders(dates.length)}) AND (? IS NULL OR sec.school_id = ?)
      AND a.period = (SELECT MIN(b.period) FROM attendance b WHERE b.student_id = a.student_id AND b.date = a.date)`)
    .bind(...dates, schoolId, schoolId).all<{ student_id: number; date: string; status: string; student_name: string; section_label: string; school: string; school_id: number }>()
  const recordedDays = new Set(results.map(r => `${r.school_id}|${r.date}`))   // days the school uploaded anything
  const byStudent = new Map<number, typeof results>()
  for (const r of results) byStudent.set(r.student_id, [...(byStudent.get(r.student_id) ?? []), r])
  const out: ThreeDayAbsence[] = []
  for (const rows of byStudent.values()) {
    const byDate = new Map(rows.map(r => [r.date, r.status]))
    let days = 0
    for (const d of dates) {
      if (!recordedDays.has(`${rows[0].school_id}|${d}`)) continue   // nothing uploaded that day: neutral
      if (byDate.get(d) === 'absent') days++
      else break
    }
    if (days >= 3) out.push({ student_id: rows[0].student_id, student_name: rows[0].student_name, section_label: rows[0].section_label, school: rows[0].school, school_id: rows[0].school_id, days })
  }
  return out.sort((a, b) => b.days - a.days || a.student_name.localeCompare(b.student_name, 'ar'))
}

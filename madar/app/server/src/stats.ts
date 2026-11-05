// Dashboard numbers shared by the school and directorate routes, the directorate's school page, the weekly report and the CSV.
import { placeholders, schoolDaysBack } from './util'

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
  id: number; name: string; complex: string; principal: string | null; phone: string | null
  students: number; recorded: number
  present: number; absent: number; late: number   // the recorded students' day statuses (present + absent + late = recorded)
  present_pct: number | null                      // present and late over recorded
  attendance_uploaded: boolean
  attendance_confirmed: boolean   // the school has confirmed that day's attendance (POST /api/attendance/confirm)
  uploaded_at: string | null      // when the first attendance row of the day came in (UTC, like every created_at)
  teachers: number; teachers_present: number
  affected_periods: number; covered_periods: number; uncovered_periods: number; coverage_pct: number
  homework_today: number
  attendance_by_grade: { grade: number; pct: number | null }[]
}

export async function schoolStats(db: D1Database, schoolId: number, date: string): Promise<SchoolStats | null> {
  const school = await db.prepare('SELECT id, name, complex, principal, phone FROM schools WHERE id = ?').bind(schoolId)
    .first<{ id: number; name: string; complex: string; principal: string | null; phone: string | null }>()
  if (!school) return null
  const [statuses, teachers, absent, subs, homework, upload] = await Promise.all([
    dayStatuses(db, date, schoolId),
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'teacher' AND school_id = ?").bind(schoolId).first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) AS n FROM absences a JOIN users u ON u.id = a.teacher_id WHERE a.date = ? AND u.school_id = ?').bind(date, schoolId).first<{ n: number }>(),
    db.prepare(`SELECT s.status, COUNT(*) AS n FROM substitutions s JOIN absences a ON a.id = s.absence_id JOIN users u ON u.id = a.teacher_id
                WHERE a.date = ? AND u.school_id = ? GROUP BY s.status`).bind(date, schoolId).all<{ status: string; n: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM homework h JOIN sections sec ON sec.id = h.section_id WHERE sec.school_id = ? AND date(h.created_at, '+3 hours') = ?`)
      .bind(schoolId, date).first<{ n: number }>(),
    db.prepare(`SELECT MIN(a.created_at) AS first_at, MAX(a.confirmed) AS confirmed FROM attendance a JOIN students st ON st.id = a.student_id
                JOIN sections sec ON sec.id = st.section_id WHERE a.date = ? AND sec.school_id = ?`).bind(date, schoolId).first<{ first_at: string | null; confirmed: number | null }>(),
  ])
  const recorded = statuses.filter(s => s.status !== null)
  const present = recorded.filter(s => s.status === 'present').length, late = recorded.filter(s => s.status === 'late').length
  const affected = subs.results.reduce((n, r) => n + r.n, 0)
  const covered = subs.results.filter(r => r.status === 'approved' || r.status === 'self_study').reduce((n, r) => n + r.n, 0)
  const grades = [...new Set(statuses.map(s => s.grade))].sort((a, b) => a - b)
  return {
    ...school,
    students: statuses.length, recorded: recorded.length, present, absent: recorded.length - present - late, late,
    present_pct: pct(present + late, recorded.length), attendance_uploaded: recorded.length > 0,
    attendance_confirmed: (upload?.confirmed ?? 0) === 1,
    uploaded_at: upload?.first_at ?? null,
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

/**
 * Students absent on `date` (or the last school day before it) and on the preceding school days — streaks of three or
 * more. Only first-period absences are read (a few hundred rows), then the streak is walked back day by day; a day on
 * which the school uploaded nothing is neutral (skipped), a recorded day without an absence ends the streak.
 */
export async function threeDayAbsences(db: D1Database, date: string, schoolId: number | null): Promise<ThreeDayAbsence[]> {
  const dates = schoolDaysBack(date, 10)
  const [absent, uploaded] = await Promise.all([
    db.prepare(`
      SELECT a.student_id, a.date, u.name AS student_name, sec.label AS section_label, sc.name AS school, sc.id AS school_id
      FROM attendance a JOIN students st ON st.id = a.student_id JOIN users u ON u.id = st.user_id
      JOIN sections sec ON sec.id = st.section_id JOIN schools sc ON sc.id = sec.school_id
      WHERE a.date IN (${placeholders(dates.length)}) AND a.status = 'absent' AND (? IS NULL OR sec.school_id = ?)
        AND a.period = (SELECT MIN(b.period) FROM attendance b WHERE b.student_id = a.student_id AND b.date = a.date)`)
      .bind(...dates, schoolId, schoolId).all<{ student_id: number; date: string; student_name: string; section_label: string; school: string; school_id: number }>(),
    db.prepare(`
      SELECT DISTINCT sec.school_id, a.date FROM attendance a JOIN students st ON st.id = a.student_id JOIN sections sec ON sec.id = st.section_id
      WHERE a.date IN (${placeholders(dates.length)}) AND (? IS NULL OR sec.school_id = ?)`)
      .bind(...dates, schoolId, schoolId).all<{ school_id: number; date: string }>(),
  ])
  const recordedDays = new Set(uploaded.results.map(r => `${r.school_id}|${r.date}`))   // days the school uploaded anything
  const byStudent = new Map<number, typeof absent.results>()
  for (const r of absent.results) byStudent.set(r.student_id, [...(byStudent.get(r.student_id) ?? []), r])
  const out: ThreeDayAbsence[] = []
  for (const rows of byStudent.values()) {
    const absentDates = new Set(rows.map(r => r.date))
    let days = 0
    for (const d of dates) {
      if (!recordedDays.has(`${rows[0].school_id}|${d}`)) continue   // nothing uploaded that day: neutral
      if (absentDates.has(d)) days++
      else break
    }
    if (days >= 3) out.push({ student_id: rows[0].student_id, student_name: rows[0].student_name, section_label: rows[0].section_label, school: rows[0].school, school_id: rows[0].school_id, days })
  }
  return out.sort((a, b) => b.days - a.days || a.student_name.localeCompare(b.student_name, 'ar'))
}

/** Per school and date in [from, to]: how many students had a day status and how many of them attended (present or late). */
export interface DayAttendance { school_id: number; date: string; recorded: number; attended: number }
export async function attendanceByDay(db: D1Database, from: string, to: string, schoolId: number | null): Promise<DayAttendance[]> {
  const { results } = await db.prepare(`
    WITH first AS (SELECT student_id, date, MIN(period) AS p FROM attendance WHERE date BETWEEN ? AND ? GROUP BY student_id, date)
    SELECT sec.school_id, f.date, COUNT(*) AS recorded, SUM(CASE WHEN a.status IN ('present', 'late') THEN 1 ELSE 0 END) AS attended
    FROM first f JOIN attendance a ON a.student_id = f.student_id AND a.date = f.date AND a.period = f.p
    JOIN students st ON st.id = f.student_id JOIN sections sec ON sec.id = st.section_id
    WHERE ? IS NULL OR sec.school_id = ?
    GROUP BY sec.school_id, f.date ORDER BY f.date, sec.school_id`).bind(from, to, schoolId, schoolId).all<DayAttendance>()
  return results
}

/** Per school in [from, to]: teacher absences and what became of their periods (uncovered = still suggested, or marked uncovered). */
export interface CoverageCounts { school_id: number; absences: number; affected: number; approved: number; self_study: number; uncovered: number }
export async function coverageCounts(db: D1Database, from: string, to: string): Promise<CoverageCounts[]> {
  const { results } = await db.prepare(`
    SELECT u.school_id, COUNT(DISTINCT a.id) AS absences, COUNT(s.id) AS affected,
           SUM(CASE WHEN s.status = 'approved' THEN 1 ELSE 0 END) AS approved,
           SUM(CASE WHEN s.status = 'self_study' THEN 1 ELSE 0 END) AS self_study,
           SUM(CASE WHEN s.status IN ('suggested', 'uncovered') THEN 1 ELSE 0 END) AS uncovered
    FROM absences a JOIN users u ON u.id = a.teacher_id LEFT JOIN substitutions s ON s.absence_id = a.id
    WHERE a.date BETWEEN ? AND ? GROUP BY u.school_id`).bind(from, to).all<CoverageCounts>()
  return results
}

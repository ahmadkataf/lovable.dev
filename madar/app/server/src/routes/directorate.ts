// Directorate routes: cross-school dashboard, alerts and the CSV report.
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { requireAuth } from '../auth'
import { countPhrase, daysPhrase, isDate, isSchoolDay, today } from '../util'
import { ensureSubstitutions } from '../substitute'
import { schoolStats, threeDayAbsences, type SchoolStats } from '../stats'
import { csvResponse, type Cell } from '../csv'

const r = new Hono<AppEnv>()

async function allSchoolStats(db: D1Database, date: string): Promise<SchoolStats[]> {
  const { results } = await db.prepare('SELECT id FROM schools ORDER BY id').all<{ id: number }>()
  const out: SchoolStats[] = []
  for (const s of results) { const st = await schoolStats(db, s.id, date); if (st) out.push(st) }
  return out
}

r.get('/api/directorate/dashboard', requireAuth('directorate'), async c => {
  const db = c.env.DB
  const date = isDate(c.req.query('date')) ? c.req.query('date')! : today()
  await ensureSubstitutions(db, c.env, date, null)
  const schools = await allSchoolStats(db, date)
  const three = await threeDayAbsences(db, date, null)
  const alerts: { kind: 'no_attendance' | 'uncovered' | 'three_days'; school: string; school_id: number; text: string }[] = []
  for (const s of schools) {
    if (isSchoolDay(date) && !s.attendance_uploaded) alerts.push({ kind: 'no_attendance', school: s.name, school_id: s.id, text: 'لم يُرفع الحضور بعد' })
    if (s.uncovered_periods > 0) alerts.push({ kind: 'uncovered', school: s.name, school_id: s.id,
      text: `${countPhrase(s.uncovered_periods, { one: 'حصّة واحدة', two: 'حصّتان', few: 'حصص', many: 'حصّة' })} من دون تغطية` })
  }
  for (const t of three) alerts.push({ kind: 'three_days', school: t.school, school_id: t.school_id,
    text: `${t.student_name} (${t.section_label}): غياب ${daysPhrase(t.days)}` })
  const recorded = schools.reduce((n, s) => n + s.recorded, 0), present = schools.reduce((n, s) => n + s.present, 0)
  const affected = schools.reduce((n, s) => n + s.affected_periods, 0), covered = schools.reduce((n, s) => n + s.covered_periods, 0)
  return c.json({
    date,
    schools: schools.map(s => ({ id: s.id, name: s.name, complex: s.complex, students: s.students, present_pct: s.present_pct, attendance_uploaded: s.attendance_uploaded,
      uncovered_periods: s.uncovered_periods, coverage_pct: s.coverage_pct, homework_today: s.homework_today, teachers: s.teachers, teachers_present: s.teachers_present })),
    totals: {
      schools_connected: schools.length,
      present_pct: recorded ? Math.round((100 * present) / recorded) : null,
      coverage_pct: affected ? Math.round((100 * covered) / affected) : 100,
      alerts_count: alerts.length,
    },
    alerts,
    three_day_absences: three.map(t => ({ student_name: t.student_name, school: t.school, section_label: t.section_label, days: t.days })),
  })
})

r.get('/api/directorate/report.csv', requireAuth('directorate'), async c => {
  const db = c.env.DB
  const date = isDate(c.req.query('date')) ? c.req.query('date')! : today()
  await ensureSubstitutions(db, c.env, date, null)
  const schools = await allSchoolStats(db, date)
  const three = await threeDayAbsences(db, date, null)
  const rows: Cell[][] = [
    ['تقرير اليوم', date],
    [],
    ['المدرسة', 'المجمّع', 'عدد الطلاب', 'نسبة الحضور %', 'رُفع الحضور', 'المعلّمون', 'المعلّمون الحاضرون', 'حصص من دون تغطية', 'نسبة التغطية %', 'واجبات اليوم'],
    ...schools.map(s => [s.name, s.complex, s.students, s.present_pct, s.attendance_uploaded, s.teachers, s.teachers_present, s.uncovered_periods, s.coverage_pct, s.homework_today] as Cell[]),
  ]
  if (three.length) {
    rows.push([], ['غياب ثلاثة أيام متتالية'], ['الطالب', 'الشعبة', 'المدرسة', 'الأيام'])
    for (const t of three) rows.push([t.student_name, t.section_label, t.school, t.days])
  }
  return csvResponse(rows, `madar-report-${date}.csv`)
})

export default r

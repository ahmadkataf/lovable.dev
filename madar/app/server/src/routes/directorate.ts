// Directorate routes: the cross-school dashboard with its alerts (also stored as notifications), one school's day, the
// weekly report and the CSV exports. Dates default to the report day: today, or on the weekend the last school day.
import { Hono } from 'hono'
import type { AppEnv, Env } from '../types'
import { requireAuth } from '../auth'
import { addDays, bad, countPhrase, dayPhrase, daysPhrase, firstName, intParam, isDate, isSchoolDay, notFound, reportDate, schoolDaysBack, weekStart } from '../util'
import { affectedRows, ensureSubstitutions } from '../substitute'
import { attendanceByDay, coverageCounts, pct, schoolStats, threeDayAbsences, type SchoolStats, type ThreeDayAbsence } from '../stats'
import { csvResponse, type Cell } from '../csv'
import { notify, type Notice } from '../notify'

const r = new Hono<AppEnv>()

export type AlertKind = 'no_attendance' | 'uncovered' | 'three_days'
export interface Alert { kind: AlertKind; school: string; school_id: number; text: string; student_id?: number }
export interface Overview { date: string; schools: SchoolStats[]; three: ThreeDayAbsence[]; alerts: Alert[] }

async function allSchoolStats(db: D1Database, date: string): Promise<SchoolStats[]> {
  const { results } = await db.prepare('SELECT id FROM schools ORDER BY id').all<{ id: number }>()
  const out: SchoolStats[] = []
  for (const s of results) { const st = await schoolStats(db, s.id, date); if (st) out.push(st) }
  return out
}

/** The day's alerts: a school day without an upload, periods still without cover, and three-day absence streaks. */
export function buildAlerts(schools: SchoolStats[], three: ThreeDayAbsence[], date: string): Alert[] {
  const alerts: Alert[] = []
  for (const s of schools) {
    if (isSchoolDay(date) && !s.attendance_uploaded) alerts.push({ kind: 'no_attendance', school: s.name, school_id: s.id, text: 'لم يُرفع الحضور بعد' })
    if (s.uncovered_periods > 0) alerts.push({ kind: 'uncovered', school: s.name, school_id: s.id,
      text: `${countPhrase(s.uncovered_periods, { one: 'حصّة واحدة', two: 'حصّتان', few: 'حصص', many: 'حصّة' })} من دون تغطية` })
  }
  for (const t of three) alerts.push({ kind: 'three_days', school: t.school, school_id: t.school_id, student_id: t.student_id,
    text: `${t.student_name} (${t.section_label}): غياب ${daysPhrase(t.days)}` })
  return alerts
}

/** The notification body of an alert: it names the school (the bell has no table around it) and students by first name only. */
function alertBody(a: Alert, date: string, three: ThreeDayAbsence[]): string {
  const when = dayPhrase(date)
  if (a.kind === 'no_attendance') return `${a.school}: لم يُرفع حضور ${when} بعد`
  if (a.kind === 'uncovered') return `${a.school}: حصص من دون تغطية ${when}`
  const t = three.find(x => x.student_id === a.student_id)
  return `${a.school} — ${firstName(t?.student_name ?? '')} (${t?.section_label ?? ''}): غياب ${daysPhrase(t?.days ?? 3)}`
}

/** Stores the day's alerts as notifications for every directorate user, once per (user, day, kind, school or student). */
export async function storeDirectorateAlerts(db: D1Database, date: string, alerts: Alert[], three: ThreeDayAbsence[]): Promise<number> {
  const { results } = await db.prepare("SELECT id FROM users WHERE role = 'directorate'").all<{ id: number }>()
  const notices: Notice[] = []
  for (const u of results) for (const a of alerts) {
    const subject = a.kind === 'three_days' ? `student:${a.student_id}` : `school:${a.school_id}`
    notices.push({ user_id: u.id, kind: a.kind, body: alertBody(a, date, three), link: `/directorate/school/${a.school_id}?date=${date}`, dedupe_key: `dir:${u.id}:${date}:${a.kind}:${subject}` })
  }
  return notify(db, notices)
}

/**
 * The day's cross-school picture (engine rows for the day's absences are completed first). On the current report day
 * the alerts are also stored as directorate notifications — the dashboard and the daily reseed both call this, so the
 * bell is filled before anyone has opened a page, and refreshing never duplicates (dedupe_key).
 */
export async function directorateOverview(db: D1Database, env: Pick<Env, 'WEEKLY_CAP'>, date: string): Promise<Overview> {
  await ensureSubstitutions(db, env, date, null)
  const schools = await allSchoolStats(db, date)
  const three = await threeDayAbsences(db, date, null)
  const alerts = buildAlerts(schools, three, date)
  if (date === reportDate()) await storeDirectorateAlerts(db, date, alerts, three)
  return { date, schools, three, alerts }
}

const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((n, r) => n + f(r), 0)

r.get('/api/directorate/dashboard', requireAuth('directorate'), async c => {
  const db = c.env.DB
  const date = isDate(c.req.query('date')) ? c.req.query('date')! : reportDate()
  const { schools, three, alerts } = await directorateOverview(db, c.env, date)
  const threeBySchool = new Map<number, number>()
  for (const t of three) threeBySchool.set(t.school_id, (threeBySchool.get(t.school_id) ?? 0) + 1)
  const recorded = sum(schools, s => s.recorded), present = sum(schools, s => s.present + s.late)
  const affected = sum(schools, s => s.affected_periods), covered = sum(schools, s => s.covered_periods)
  return c.json({
    date,
    schools: schools.map(s => ({
      id: s.id, name: s.name, complex: s.complex, principal: s.principal, phone: s.phone, students: s.students, present_pct: s.present_pct,
      attendance_uploaded: s.attendance_uploaded, uploaded_at: s.uploaded_at, attendance_confirmed: s.attendance_confirmed,
      uncovered_periods: s.uncovered_periods, coverage_pct: s.coverage_pct, homework_today: s.homework_today,
      teachers: s.teachers, teachers_present: s.teachers_present, three_days: threeBySchool.get(s.id) ?? 0,
    })),
    totals: {
      schools_connected: schools.length,
      present_pct: pct(present, recorded),
      coverage_pct: affected ? Math.round((100 * covered) / affected) : 100,
      alerts_count: alerts.length,
    },
    alerts,
    three_day_absences: three.map(t => ({ student_name: t.student_name, school: t.school, school_id: t.school_id, section_label: t.section_label, days: t.days })),
  })
})

/** One school's day as the directorate sees it: contacts, attendance, every absence with its periods, early warnings, a 7-day trend. */
r.get('/api/directorate/school/:id', requireAuth('directorate'), async c => {
  const db = c.env.DB
  const id = intParam(c.req.param('id'))
  if (id === null) throw bad()
  const date = isDate(c.req.query('date')) ? c.req.query('date')! : reportDate()
  await ensureSubstitutions(db, c.env, date, id)
  const st = await schoolStats(db, id, date)
  if (!st) throw notFound('المدرسة غير موجودة')
  const { results: absences } = await db.prepare(`
    SELECT a.id, u.name AS teacher, sj.name AS subject, a.reason FROM absences a JOIN users u ON u.id = a.teacher_id LEFT JOIN subjects sj ON sj.id = u.subject_id
    WHERE a.date = ? AND u.school_id = ? ORDER BY u.name`).bind(date, id).all<{ id: number; teacher: string; subject: string | null; reason: string | null }>()
  const uncovered: { teacher: string; subject: string; period: number; section: string }[] = []
  const withPeriods = []
  for (const a of absences) {
    const rows = await affectedRows(db, a.id)
    const periods = rows.map(s => ({
      period: s.period, section: s.section_label, subject: s.subject,
      status: (s.status === 'suggested' ? 'pending' : s.status) as 'approved' | 'self_study' | 'pending' | 'uncovered',
      substitute: s.substitute, lesson_note: s.lesson_note, note: s.note,
    }))
    for (const p of periods) if (p.status === 'pending' || p.status === 'uncovered') uncovered.push({ teacher: a.teacher, subject: p.subject, period: p.period, section: p.section })
    withPeriods.push({ absence_id: a.id, teacher: a.teacher, subject: a.subject ?? '', reason: a.reason, periods })
  }
  uncovered.sort((a, b) => a.period - b.period)
  const three = await threeDayAbsences(db, date, id)
  const trendDays = schoolDaysBack(date, 7).reverse()
  const byDay = await attendanceByDay(db, trendDays[0], date, id)
  return c.json({
    date,
    school: { id: st.id, name: st.name, complex: st.complex, principal: st.principal, phone: st.phone, students: st.students, teachers: st.teachers },
    day: { attendance_pct: st.present_pct, present: st.present, absent: st.absent, late: st.late, uploaded_at: st.uploaded_at, confirmed: st.attendance_confirmed,
      teachers_present: st.teachers_present, coverage_pct: st.coverage_pct, homework_today: st.homework_today },
    absences: withPeriods,
    uncovered,
    three_days: three.map(t => ({ student: t.student_name, section: t.section_label, days: t.days })),
    trend: trendDays.map(d => { const a = byDay.find(x => x.date === d); return { date: d, attendance_pct: a ? pct(a.attended, a.recorded) : null } }),
  })
})

// ---------- weekly report (Sunday–Thursday) ----------
export interface WeeklyNumbers { attendance_avg_pct: number | null; days_uploaded: number; absences: number; substitutions_approved: number; self_study: number; uncovered: number; three_days: number }
export interface WeeklyRow extends WeeklyNumbers { id: number; name: string; complex: string; principal: string | null; phone: string | null; students: number; teachers: number }
export interface WeeklyReport { from: string; to: string; school_days: number; schools: WeeklyRow[]; totals: WeeklyNumbers }

/** The week (Sun–Thu) that contains `anchor`, per school. Attendance is weighted over the week's recorded day statuses. */
export async function weeklyReport(db: D1Database, env: Pick<Env, 'WEEKLY_CAP'>, anchor: string): Promise<WeeklyReport> {
  const from = weekStart(anchor), to = addDays(from, 4)
  const days = [0, 1, 2, 3, 4].map(i => addDays(from, i)).filter(d => d <= reportDate())
  for (const d of days) await ensureSubstitutions(db, env, d, null)
  const [schools, att, cov, pupils, staff] = await Promise.all([
    db.prepare('SELECT id, name, complex, principal, phone FROM schools ORDER BY id').all<{ id: number; name: string; complex: string; principal: string | null; phone: string | null }>(),
    attendanceByDay(db, from, to, null),
    coverageCounts(db, from, to),
    db.prepare(`SELECT sc.id AS school_id, COALESCE((SELECT COUNT(*) FROM students st JOIN sections sec ON sec.id = st.section_id WHERE sec.school_id = sc.id), 0) AS n_rows, sc.enrolled FROM schools sc`)
      .all<{ school_id: number; n_rows: number; enrolled: number | null }>().then(r => ({ results: r.results.map(x => ({ school_id: x.school_id, n: x.n_rows || x.enrolled || 0 })) })),
    db.prepare("SELECT school_id, COUNT(*) AS n FROM users WHERE role = 'teacher' GROUP BY school_id").all<{ school_id: number; n: number }>(),
  ])
  const threeBySchool = new Map<number, Set<number>>()
  for (const d of days) for (const t of await threeDayAbsences(db, d, null)) threeBySchool.set(t.school_id, new Set([...(threeBySchool.get(t.school_id) ?? []), t.student_id]))
  const rows: WeeklyRow[] = schools.results.map(s => {
    const a = att.filter(x => x.school_id === s.id), cv = cov.find(x => x.school_id === s.id)
    return {
      id: s.id, name: s.name, complex: s.complex, principal: s.principal, phone: s.phone,
      students: pupils.results.find(x => x.school_id === s.id)?.n ?? 0, teachers: staff.results.find(x => x.school_id === s.id)?.n ?? 0,
      attendance_avg_pct: pct(sum(a, x => x.attended), sum(a, x => x.recorded)), days_uploaded: a.length,
      absences: cv?.absences ?? 0, substitutions_approved: cv?.approved ?? 0, self_study: cv?.self_study ?? 0, uncovered: cv?.uncovered ?? 0,
      three_days: threeBySchool.get(s.id)?.size ?? 0,
    }
  })
  return {
    from, to, school_days: 5, schools: rows,
    totals: {
      attendance_avg_pct: pct(sum(att, x => x.attended), sum(att, x => x.recorded)),
      days_uploaded: sum(rows, x => x.days_uploaded),   // school-days with an upload (out of schools × 5)
      absences: sum(rows, x => x.absences), substitutions_approved: sum(rows, x => x.substitutions_approved),
      self_study: sum(rows, x => x.self_study), uncovered: sum(rows, x => x.uncovered), three_days: sum(rows, x => x.three_days),
    },
  }
}

r.get('/api/directorate/report', requireAuth('directorate'), async c => {
  const anchor = isDate(c.req.query('week')) ? c.req.query('week')! : reportDate()
  return c.json(await weeklyReport(c.env.DB, c.env, anchor))
})

const WEEKLY_HEADER: Cell[] = ['المدرسة', 'المجمّع', 'المدير', 'الهاتف', 'عدد الطلاب', 'المعلّمون', 'متوسّط الحضور %', 'أيام رُفع فيها الحضور', 'غيابات المعلّمين', 'تعويضات معتمدة', 'تعلّم ذاتي', 'حصص من دون تغطية', 'إنذارات غياب ثلاثة أيام']
const weeklyCells = (s: WeeklyRow): Cell[] => [s.name, s.complex, s.principal, s.phone, s.students, s.teachers, s.attendance_avg_pct, s.days_uploaded, s.absences, s.substitutions_approved, s.self_study, s.uncovered, s.three_days]

/** The day's table (default) or, with ?week=, the weekly report as CSV (UTF-8 BOM for Excel). */
r.get('/api/directorate/report.csv', requireAuth('directorate'), async c => {
  const db = c.env.DB
  if (isDate(c.req.query('week'))) {
    const w = await weeklyReport(db, c.env, c.req.query('week')!)
    const rows: Cell[][] = [['التقرير الأسبوعي', `${w.from} — ${w.to}`], [], WEEKLY_HEADER, ...w.schools.map(weeklyCells),
      ['المجموع', '', '', '', sum(w.schools, s => s.students), sum(w.schools, s => s.teachers), w.totals.attendance_avg_pct, w.totals.days_uploaded, w.totals.absences, w.totals.substitutions_approved, w.totals.self_study, w.totals.uncovered, w.totals.three_days]]
    return csvResponse(rows, `madar-week-${w.from}.csv`)
  }
  const date = isDate(c.req.query('date')) ? c.req.query('date')! : reportDate()
  const { schools, three } = await directorateOverview(db, c.env, date)
  const rows: Cell[][] = [
    ['تقرير اليوم', date],
    [],
    ['المدرسة', 'المجمّع', 'المدير', 'الهاتف', 'عدد الطلاب', 'نسبة الحضور %', 'رُفع الحضور', 'المعلّمون', 'المعلّمون الحاضرون', 'حصص من دون تغطية', 'نسبة التغطية %', 'واجبات اليوم'],
    ...schools.map(s => [s.name, s.complex, s.principal, s.phone, s.students, s.present_pct, s.attendance_uploaded, s.teachers, s.teachers_present, s.uncovered_periods, s.coverage_pct, s.homework_today] as Cell[]),
  ]
  if (three.length) {
    rows.push([], ['غياب ثلاثة أيام متتالية'], ['الطالب', 'الشعبة', 'المدرسة', 'الأيام'])
    for (const t of three) rows.push([t.student_name, t.section_label, t.school, t.days])
  }
  return csvResponse(rows, `madar-report-${date}.csv`)
})

export default r

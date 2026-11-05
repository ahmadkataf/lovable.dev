// Generates seed.sql (docs/mvp-spec.md §8). Deterministic, no dependencies: `node scripts/gen-seed.mjs`.
// The timetable is built by a small backtracking search so no teacher is double-booked and the pitch's
// anchor points hold (الخامس (ب) on Thursday, سامر free in period 5, ماهر free in period 3).
// All dates in the generated SQL are relative to "today" in Damascus (UTC+3): date('now','+3 hours').
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const TODAY = "date('now','+3 hours')"   // Syria has been on UTC+3 all year since 2022
const q = (s) => `'${String(s).replace(/'/g, "''")}'`

// ---------- static data ----------
const SUBJECTS = [[1, 'اللغة العربية'], [2, 'الرياضيات'], [3, 'العلوم'], [4, 'اللغة الإنكليزية'], [5, 'الدراسات الاجتماعية'], [6, 'التربية الرياضية']]
const SCHOOLS = [[1, 'مدرسة درعا النموذجية', 'درعا المدينة'], [2, 'مدرسة (ب)', 'مجمّع إزرع'], [3, 'مدرسة (ج)', 'مجمّع طفس']]
// [id, role, name, school_id, phone, code, subject_id]
const ACCOUNTS = [
  [1, 'directorate', 'مديرية التربية · درعا', null, null, 'DIR-DARAA', null],
  [2, 'school', 'إدارة مدرسة درعا النموذجية', 1, null, 'SCH-1', null],
  [3, 'school', 'إدارة مدرسة (ب)', 2, null, 'SCH-2', null],
  [4, 'school', 'إدارة مدرسة (ج)', 3, null, 'SCH-3', null],
  [11, 'teacher', 'سامر حسن', 1, '0930000011', 'T-SAMER', 2],
  [12, 'teacher', 'رنا سعيد', 1, '0930000012', 'T-RANA', 3],
  [13, 'teacher', 'ماهر عادل', 1, '0930000013', 'T-MAHER', 3],
  [14, 'teacher', 'هبة سليم', 1, '0930000014', 'T-HIBA', 1],
  [15, 'teacher', 'خالد نور', 1, '0930000015', 'T-KHALED', 5],
  [16, 'teacher', 'لينا فارس', 1, '0930000016', 'T-LINA', 4],
  [17, 'teacher', 'عمر سعد', 1, '0930000017', 'T-OMAR', 6],
  [21, 'teacher', 'أحمد قاسم', 2, '0930000021', 'T-B-AHMAD', 1],
  [22, 'teacher', 'سلمى حمد', 2, '0930000022', 'T-B-SALMA', 2],
  [31, 'teacher', 'محمود ناصر', 3, '0930000031', 'T-C-MAHMOUD', 3],
  [32, 'teacher', 'رهف خليل', 3, '0930000032', 'T-C-RAHAF', 4],
]
// [id, school_id, grade, label, code prefix]
const SECTIONS = [[1, 1, 5, 'الخامس (أ)', '5A'], [2, 1, 5, 'الخامس (ب)', '5B'], [3, 1, 6, 'السادس (أ)', '6A'], [4, 2, 4, 'الرابع (أ)', 'B4A'], [5, 3, 6, 'السادس (أ)', 'C6A']]
const STUDENT_NAMES = {
  1: ['عمر فراس', 'ريم نبيل', 'زيد وائل', 'لين ماجد', 'حمزة سمير', 'تالا أيمن', 'كرم عدنان', 'سما غسان', 'يزن عماد', 'جود هاني', 'رغد منير', 'إياد طلال'],
  2: ['محمد خالد', 'ليان أحمد', 'عبد الرحمن يوسف', 'سارة عمر', 'يوسف علي', 'هبة سامي', 'أحمد فادي', 'نور حسام', 'كرم رامي', 'جنى باسل', 'مريم طارق', 'آدم زياد'],
  3: ['سارة خالد', 'علي حسين', 'رنيم فؤاد', 'معاذ جمال', 'شام رياض', 'أنس عدنان', 'غنى وليد', 'بشر نضال', 'لمى عصام', 'سليم بسام', 'ميرا جهاد', 'فارس أكرم'],
  4: ['حسن محمود', 'ديمة نزار', 'طارق سهيل', 'لجين عامر', 'عبادة مروان', 'سدرة خليل', 'مجد رائد', 'تيم عدي'],
  5: ['نادر فايز', 'سلاف حكمت', 'رائد كمال', 'آية صالح', 'وسيم جابر', 'بتول مازن', 'لؤي شادي', 'هيا منذر'],
}
const SURNAMES = ['محمود', 'رامز', 'نبيل', 'سليمان', 'حمدان', 'رشيد', 'كمال', 'نعيم', 'عبد الله', 'صالح', 'حسين', 'إبراهيم', 'فهد', 'مصطفى', 'جميل', 'أنور', 'حسن', 'عثمان', 'ياسين', 'نذير', 'عادل', 'بشير', 'منصور', 'سعيد']
const THREE_DAY_STUDENT = 9   // يزن عماد (الخامس (أ)): absent the last three school days → directorate alert

// ---------- timetable search ----------
const QUOTA = { 1: 7, 2: 6, 3: 4, 4: 5, 5: 4, 6: 4 }   // periods per week per section (= 30)
const MAX_PER_DAY = { 1: 2, 2: 2, 3: 1, 4: 1, 5: 1, 6: 1 }
const teacherOf = (section, subject) => subject === 3 ? (section === 3 ? 13 : 12) : { 1: 14, 2: 11, 4: 16, 5: 15, 6: 17 }[subject]
// Fixed cells: [section, day, period] → subject.  Thursday الخامس (ب) exactly as the pitch; period 5 Thursday:
// رنا in الخامس (أ) and ماهر in السادس (أ) (so سامر is the free candidate); period 3 Thursday: ماهر must be free.
const FIXED = new Map()
;[1, 2, 3, 4, 5, 6].forEach((s, i) => FIXED.set(`2,4,${i + 1}`, s))
FIXED.set('1,4,5', 3); FIXED.set('3,4,5', 3)
const FORBIDDEN = new Map([['3,4,3', new Set([3])], ['1,4,3', new Set([3])]])

let rnd = 7   // tiny LCG so the layout is deterministic yet varied
const next = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
function buildSchool1() {
  // Cells are visited Thursday first (its fixed cells constrain the quotas), then Sun–Wed, slot by slot.
  // A bounded DFS with random restarts: the constraints are loose, so a few thousand steps normally suffice.
  const DAYS = [4, 0, 1, 2, 3]
  const cells = []
  for (const day of DAYS) for (let period = 1; period <= 6; period++) for (const s of [1, 2, 3]) cells.push([s, day, period])
  for (let attempt = 0; attempt < 200; attempt++) {
    const grid = new Map()      // "s,d,p" → subject
    const left = { 1: { ...QUOTA }, 2: { ...QUOTA }, 3: { ...QUOTA } }
    const busy = new Set()      // "teacher,d,p"
    const perDay = {}           // "s,d,subject" → count
    const ok = (s, d, p, subj) => {
      if (left[s][subj] <= 0) return false
      if ((perDay[`${s},${d},${subj}`] ?? 0) >= MAX_PER_DAY[subj]) return false
      if (FORBIDDEN.get(`${s},${d},${p}`)?.has(subj)) return false
      if (busy.has(`${teacherOf(s, subj)},${d},${p}`)) return false
      if (d === 4 && p === 5 && subj === 2) return false   // Thursday period 5: سامر stays free (no maths anywhere)
      return true
    }
    const place = (s, d, p, subj, on) => {
      const k = `${s},${d},${subj}`, b = `${teacherOf(s, subj)},${d},${p}`
      if (on) { grid.set(`${s},${d},${p}`, subj); left[s][subj]--; perDay[k] = (perDay[k] ?? 0) + 1; busy.add(b) }
      else { grid.delete(`${s},${d},${p}`); left[s][subj]++; perDay[k]--; busy.delete(b) }
    }
    // Pruning: the rest of this day must still be fillable, and every leftover quota must fit in the days to come.
    const feasible = (s, d, p) => {
      const futureDays = DAYS.length - 1 - DAYS.indexOf(d)
      let cap = 0
      for (const x of [1, 2, 3, 4, 5, 6]) {
        const today = MAX_PER_DAY[x] - (perDay[`${s},${d},${x}`] ?? 0)
        cap += Math.min(left[s][x], today)
        if (left[s][x] > today + MAX_PER_DAY[x] * futureDays) return false
      }
      return cap >= 6 - p
    }
    let steps = 0
    const dfs = (i) => {
      if (i === cells.length) return true
      if (++steps > 20000) return false
      const [s, d, p] = cells[i]
      const fixed = FIXED.get(`${s},${d},${p}`)
      const options = fixed ? [fixed] : [1, 2, 3, 4, 5, 6].map(x => [x, left[s][x] + 2 * next()]).sort((a, b) => b[1] - a[1]).map(x => x[0])
      for (const subj of options) {
        if (!ok(s, d, p, subj)) continue
        place(s, d, p, subj, true)
        if (feasible(s, d, p) && dfs(i + 1)) return true
        place(s, d, p, subj, false)
      }
      return false
    }
    if (dfs(0)) {
      const rows = []
      for (const [k, subj] of grid) { const [s, d, p] = k.split(',').map(Number); rows.push([s, d, p, subj, teacherOf(s, subj)]) }
      return rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
    }
  }
  throw new Error('timetable search failed')
}
function buildSmall(section, teachers) {
  const rows = []
  for (let d = 0; d < 5; d++) for (let p = 1; p <= 6; p++) {
    const [tid, subj] = teachers[(p + d) % 2]
    rows.push([section, d, p, subj, tid])
  }
  return rows
}
const timetable = [...buildSchool1(), ...buildSmall(4, [[21, 1], [22, 2]]), ...buildSmall(5, [[31, 3], [32, 4]])]

// sanity: anchors from the spec
const at = (s, d, p) => timetable.find(r => r[0] === s && r[1] === d && r[2] === p)
const assert = (c, m) => { if (!c) throw new Error('seed invariant: ' + m) }
assert([1, 2, 3, 4, 5, 6].every((subj, i) => at(2, 4, i + 1)[3] === subj), 'الخامس (ب) Thursday')
assert(!timetable.some(r => r[1] === 4 && r[2] === 5 && r[4] === 11), 'سامر free Thu P5')
assert(!timetable.some(r => r[1] === 4 && r[2] === 3 && r[4] === 13), 'ماهر free Thu P3')
const seen = new Set()
for (const r of timetable) { const k = `${r[4]},${r[1]},${r[2]}`; assert(!seen.has(k), 'double booking ' + k); seen.add(k) }

// ---------- students and guardians ----------
const students = []   // [id, user_id, section_id, guardian_user_id, registry_no, name, code]
const guardians = []  // [user_id, name, phone, code]
let sid = 0, guardianId = 401, pn = 1
for (const [secId, , , , prefix] of SECTIONS) {
  STUDENT_NAMES[secId].forEach((name, i) => {
    sid++
    const userId = secId <= 3 ? 100 + sid : secId === 4 ? 200 + i + 1 : 300 + i + 1
    let code = `S-${prefix}-${String(i + 1).padStart(2, '0')}`
    if (name === 'ليان أحمد') code = 'S-LAYAN'
    let guardian = null
    if (secId <= 3 && i < 8) {
      if (name === 'سارة خالد') guardian = 409   // second child of the demo parent خالد (P-KHALED)
      else {
        guardian = guardianId++
        const father = name.split(' ')[1]
        const code = guardian === 409 ? 'P-KHALED' : `P-${pn}`
        pn++
        guardians.push([guardian, `${father} ${SURNAMES[(guardian - 401) % SURNAMES.length]}`, `09400${String(guardian).padStart(5, '0')}`, code])
      }
    }
    students.push([sid, userId, secId, guardian, `${2026}-${String(sid).padStart(4, '0')}`, name, code])
  })
}

// ---------- SQL ----------
const out = []
out.push(`-- Madar demo seed (docs/mvp-spec.md §8). GENERATED by scripts/gen-seed.mjs — edit that file, not this one.
-- Idempotent (INSERT OR IGNORE / NOT EXISTS); dates are relative to today in Damascus: ${TODAY}.
-- Apply after schema.sql: npx wrangler d1 execute madar --local --file=seed.sql
-- The substitute suggestions for today's absence of رنا سعيد are produced by the engine itself the first time the
-- school dashboard (or the teacher's home) is opened — see README.`)
out.push(`INSERT OR IGNORE INTO schools (id, name, complex, shifts) VALUES\n` + SCHOOLS.map(([id, n, c]) => `  (${id}, ${q(n)}, ${q(c)}, 1)`).join(',\n') + ';')
out.push(`INSERT OR IGNORE INTO subjects (id, name) VALUES\n` + SUBJECTS.map(([id, n]) => `  (${id}, ${q(n)})`).join(',\n') + ';')
const userRow = ([id, role, name, school, phone, code, subj]) =>
  `  (${id}, ${q(role)}, ${q(name)}, ${school ?? 'NULL'}, ${phone ? q(phone) : 'NULL'}, ${q(code)}, ${subj ?? 'NULL'})`
out.push(`INSERT OR IGNORE INTO users (id, role, name, school_id, phone, code, subject_id) VALUES\n` + ACCOUNTS.map(userRow).join(',\n') + ';')
out.push(`INSERT OR IGNORE INTO users (id, role, name, school_id, phone, code, subject_id) VALUES\n` +
  students.map(([, uid, sec, , , name, code]) => userRow([uid, 'student', name, SECTIONS[sec - 1][1], null, code, null])).join(',\n') + ';')
out.push(`INSERT OR IGNORE INTO users (id, role, name, school_id, phone, code, subject_id) VALUES\n` +
  guardians.map(([uid, name, phone, code]) => userRow([uid, 'parent', name, 1, phone, code, null])).join(',\n') + ';')
out.push(`INSERT OR IGNORE INTO sections (id, school_id, grade, label, shift) VALUES\n` + SECTIONS.map(([id, sc, g, l]) => `  (${id}, ${sc}, ${g}, ${q(l)}, 1)`).join(',\n') + ';')
out.push(`INSERT OR IGNORE INTO students (id, user_id, section_id, guardian_user_id, registry_no) VALUES\n` +
  students.map(([id, uid, sec, g, reg]) => `  (${id}, ${uid}, ${sec}, ${g ?? 'NULL'}, ${q(reg)})`).join(',\n') + ';')
out.push(`INSERT OR IGNORE INTO timetable (id, section_id, day, period, subject_id, teacher_id) VALUES\n` +
  timetable.map((r, i) => `  (${i + 1}, ${r[0]}, ${r[1]}, ${r[2]}, ${r[3]}, ${r[4]})`).join(',\n') + ';')

out.push(`-- Homework: the pitch's maths homework for الخامس (ب) due in three days, plus a little variety.
INSERT OR IGNORE INTO homework (id, section_id, subject_id, teacher_id, title, details, book_page, due_date, created_at) VALUES
  (1, 2, 2, 11, 'تمارين الكسور العشرية ص ٤٢', 'حلّ التمارين من ١ إلى ٨ في الدفتر، مع كتابة خطوات الحلّ.', '42', date('now','+3 hours','+3 days'), datetime('now','-1 day')),
  (2, 2, 1, 14, 'قراءة نصّ «الوطن» وإجابة الأسئلة', 'الإجابة عن أسئلة الفهم والاستيعاب في الدفتر.', '17', date('now','+3 hours','+1 day'), datetime('now','-2 days')),
  (3, 1, 3, 12, 'تلخيص درس دورة الماء في الطبيعة', NULL, '55', date('now','+3 hours','+2 days'), datetime('now','-1 day')),
  (4, 3, 2, 11, 'مسائل النسبة والتناسب ص ٣٠', 'المسائل ١ و٢ و٣.', '30', date('now','+3 hours','+4 days'), datetime('now','-1 day'));
INSERT OR IGNORE INTO submissions (homework_id, student_id, status, submitted_at) VALUES
  (1, 15, 'done', datetime('now','-5 hours')), (1, 16, 'done', datetime('now','-4 hours')), (1, 17, 'done', datetime('now','-3 hours')),
  (1, 18, 'done', datetime('now','-2 hours')), (1, 19, 'done', datetime('now','-1 hours')),
  (2, 13, 'done', datetime('now','-1 day')), (2, 15, 'done', datetime('now','-1 day')), (2, 16, 'done', datetime('now','-1 day')), (2, 17, 'done', datetime('now','-1 day')),
  (2, 18, 'done', datetime('now','-1 day')), (2, 19, 'done', datetime('now','-1 day')), (2, 20, 'done', datetime('now','-1 day')), (2, 21, 'done', datetime('now','-1 day')),
  (3, 1, 'done', datetime('now','-3 hours')), (3, 2, 'done', datetime('now','-3 hours')), (3, 3, 'done', datetime('now','-2 hours')),
  (4, 25, 'done', datetime('now','-2 hours')), (4, 26, 'done', datetime('now','-2 hours'));`)

out.push(`-- Attendance for the last five school days (Sun–Thu) up to and including today; today only periods 1–2 are in
-- (the day is "in progress"), earlier days are confirmed. About 94% present, a few late arrivals in period 1,
-- and student ${THREE_DAY_STUDENT} absent on the last three school days (the directorate's three-day alert).
-- School 3 has not uploaded today's attendance (the directorate's «لم يُرفع الحضور» alert).
WITH RECURSIVE days(d, n) AS (
    SELECT ${TODAY}, 0
    UNION ALL SELECT date(d, '-1 day'), n + 1 FROM days WHERE n < 14
  ),
  school_days AS (
    SELECT d, row_number() OVER (ORDER BY d DESC) AS rn FROM days WHERE CAST(strftime('%w', d) AS INTEGER) NOT IN (5, 6)
  ),
  recent AS (SELECT d, rn FROM school_days WHERE rn <= 5),
  periods(p) AS (VALUES (1), (2), (3), (4), (5), (6)),
  roster AS (
    SELECT st.id AS student_id, sec.id AS section_id, sec.school_id FROM students st JOIN sections sec ON sec.id = st.section_id
  ),
  cells AS (
    SELECT r.student_id, r.section_id, r.school_id, rd.d, rd.rn, p.p,
           (r.student_id * 31 + CAST(julianday(rd.d) AS INTEGER)) % 16 AS h,
           (r.student_id * 7 + CAST(julianday(rd.d) AS INTEGER)) % 19 AS l
    FROM roster r CROSS JOIN recent rd CROSS JOIN periods p
    WHERE rd.d < ${TODAY} OR (p.p <= 2 AND r.school_id <> 3)
  )
INSERT OR IGNORE INTO attendance (student_id, date, period, status, recorded_by, confirmed)
SELECT c.student_id, c.d, c.p,
       CASE WHEN (c.student_id = ${THREE_DAY_STUDENT} AND c.rn <= 3) OR c.h = 0 THEN 'absent'
            WHEN c.p = 1 AND c.l = 1 THEN 'late'
            ELSE 'present' END,
       COALESCE((SELECT t.teacher_id FROM timetable t WHERE t.section_id = c.section_id AND t.day = CAST(strftime('%w', c.d) AS INTEGER) AND t.period = c.p),
                (SELECT u.id FROM users u WHERE u.role = 'school' AND u.school_id = c.school_id)),
       CASE WHEN c.d < ${TODAY} THEN 1 ELSE 0 END
FROM cells c;`)

out.push(`-- Today's teacher absence (رنا سعيد, reported by the school). Its substitute suggestions are created by the engine
-- on the first dashboard/home load (or by POST /api/absences), so they always match today's weekday.
INSERT OR IGNORE INTO absences (teacher_id, date, reason, reported_by) VALUES (12, ${TODAY}, 'إجازة صحيّة', 2);`)

out.push(`-- One school announcement and one directorate circular.
INSERT OR IGNORE INTO announcements (id, school_id, title, body, urgent, created_by, created_at) VALUES
  (1, 1, 'اجتماع أولياء الأمور', 'يُعقد اجتماع أولياء الأمور يوم الأحد القادم في الساعة العاشرة صباحًا في قاعة المدرسة. حضوركم يهمّنا.', 0, 2, datetime('now','-1 day')),
  (2, NULL, 'تعميم: تحديث بيانات الطلاب', 'يُرجى من إدارات المدارس استكمال تحديث بيانات الطلاب وأولياء الأمور على المنصّة قبل نهاية الأسبوع.', 0, 1, datetime('now','-2 days'));`)

// A few notifications so the demo accounts' bells are not empty (guarded by NOT EXISTS → idempotent).
const notice = (uid, kind, body, link, sms, age) =>
  `INSERT INTO notifications (user_id, kind, body, link, sms, created_at)
SELECT ${uid}, ${q(kind)}, ${q(body)}, ${q(link)}, ${sms}, datetime('now','${age}')
WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = ${uid} AND kind = ${q(kind)} AND body = ${q(body)});`
const layan = students.find(s => s[6] === 'S-LAYAN')
out.push(`-- Notifications for the demo student, the demo parent and the school account.`)
out.push(notice(layan[1], 'homework', 'واجب جديد في الرياضيات: تمارين الكسور العشرية ص ٤٢ — يُسلَّم بعد ٣ أيام', '/homework/1', 0, '-1 day'))
out.push(notice(layan[1], 'announcement', 'إعلان من المدرسة: اجتماع أولياء الأمور', '/announcements/1', 0, '-1 day'))
out.push(notice(409, 'homework', 'واجب جديد لمحمد في الرياضيات، يُسلَّم بعد ٣ أيام', '/homework/1', 0, '-1 day'))
out.push(notice(409, 'announcement', 'إعلان من المدرسة: اجتماع أولياء الأمور', '/announcements/1', 0, '-1 day'))
out.push(notice(2, 'announcement', 'تعميم من المديرية: تحديث بيانات الطلاب', '/announcements/2', 0, '-2 days'))
out.push(notice(3, 'announcement', 'تعميم من المديرية: تحديث بيانات الطلاب', '/announcements/2', 0, '-2 days'))
out.push(notice(4, 'announcement', 'تعميم من المديرية: تحديث بيانات الطلاب', '/announcements/2', 0, '-2 days'))

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed.sql')
writeFileSync(file, out.join('\n\n') + '\n')
console.log(`seed.sql written: ${timetable.length} timetable rows, ${students.length} students, ${guardians.length} guardians`)

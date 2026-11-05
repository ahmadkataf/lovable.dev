// Generates seed.sql (docs/mvp-spec.md §8, round 2: a ten-school pilot). Deterministic, no dependencies:
//   node scripts/gen-seed.mjs
//
// Shape of the data
//   • 10 schools of the Daraa governorate (neutral names). Schools 1–3 are the "deep" demo schools with the printed
//     demo codes (DIR-DARAA, SCH-1…, T-SAMER, T-RANA, T-MAHER, S-LAYAN, P-KHALED…); schools 4–10 carry sections,
//     students, teachers, timetables, attendance and absences so the directorate dashboard shows real numbers.
//   • Timetables: the three pitch sections of school 1 are built by the anchored backtracking search (الخامس (ب) on
//     Thursday exactly as the pitch, سامر free Thu P5, ماهر free Thu P3). Every other section belongs to a "block" of
//     four sections that share six teachers (one per subject); the block's week is one 30-slot sequence that each
//     section reads with a different offset, so no teacher is ever double-booked and the weekly quotas hold.
//   • Dates are relative to the demo day: the latest school day on or before today in Damascus (Fri/Sat → Thursday).
//     The seed creates the table demo_days (rn 1 = demo day, 2 = the school day before, …) and drops it at the end.
//   • The demo day's teacher absences are pre-decided in SQL (approved to a free same-subject teacher when one exists,
//     else a teacher of the section, else self-study) except a handful of "pending" periods that the substitute engine
//     fills with ranked candidates on the first dashboard load — those are the live decisions and the uncovered ones.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const TODAY = "date('now','+3 hours')"   // Syria has been on UTC+3 all year since 2022
// The demo day: today if it is a school day, otherwise the Thursday before (the weekend is Friday + Saturday).
const DEMO_DAY = `(CASE CAST(strftime('%w', ${TODAY}) AS INTEGER) WHEN 5 THEN date(${TODAY}, '-1 day') WHEN 6 THEN date(${TODAY}, '-2 days') ELSE ${TODAY} END)`
const D1 = '(SELECT d FROM demo_days WHERE rn = 1)'   // the demo day as a scalar subquery
const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const nul = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : q(v))
const assert = (c, m) => { if (!c) throw new Error('seed invariant: ' + m) }

// Tiny LCG so the data is deterministic yet varied.
let rndState = 7
const rnd = () => (rndState = (rndState * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))

// ---------- static data ----------
const SUBJECTS = [[1, 'اللغة العربية'], [2, 'الرياضيات'], [3, 'العلوم'], [4, 'اللغة الإنكليزية'], [5, 'الدراسات الاجتماعية'], [6, 'التربية الرياضية']]
const QUOTA = { 1: 7, 2: 6, 3: 4, 4: 5, 5: 4, 6: 4 }        // periods per week per section (= 30)
const MAX_PER_DAY = { 1: 2, 2: 2, 3: 1, 4: 1, 5: 1, 6: 1 }

// id, school account id, code letter, name, complex (the client prefixes «مجمّع»), principal, absence rate (%), sections
// layout: 'deep1' = the pitch's three sections + eight block sections; 8 and 12 = block sections only.
const SCHOOLS = [
  { id: 1, acct: 2, code: '1', name: 'مدرسة درعا النموذجية', complex: 'درعا المدينة', principal: 'عماد الحوراني', rate: 7, layout: 'deep1' },
  { id: 2, acct: 3, code: 'B', name: 'مدرسة إزرع الأولى', complex: 'إزرع', principal: 'سهى درويش', rate: 9, layout: 8 },
  { id: 3, acct: 4, code: 'C', name: 'مدرسة طفس الثانية', complex: 'طفس', principal: 'محمد نور الشامي', rate: 8, layout: 8 },
  { id: 4, acct: 51, code: 'D', name: 'مدرسة نوى الأولى', complex: 'نوى', principal: 'رائد سلامة', rate: 10, layout: 8 },
  { id: 5, acct: 52, code: 'E', name: 'مدرسة الصنمين المختلطة', complex: 'الصنمين', principal: 'منال الخطيب', rate: 6, layout: 12 },
  { id: 6, acct: 53, code: 'F', name: 'مدرسة جاسم الثانية', complex: 'جاسم', principal: 'أيمن زيتون', rate: 20, layout: 8 },     // the weak school (≈ 80 %)
  { id: 7, acct: 54, code: 'G', name: 'مدرسة الحراك الأولى', complex: 'الحراك', principal: 'هيام النجّار', rate: 9, layout: 8 },
  { id: 8, acct: 55, code: 'H', name: 'مدرسة بصرى الشام الأولى', complex: 'بصرى الشام', principal: 'غسان عودة', rate: 12, layout: 12 },   // has not uploaded today
  { id: 9, acct: 56, code: 'I', name: 'مدرسة داعل', complex: 'داعل', principal: 'ريم بركات', rate: 7, layout: 8 },
  { id: 10, acct: 57, code: 'J', name: 'مدرسة المزيريب', complex: 'المزيريب', principal: 'خالد شاهين', rate: 11, layout: 8 },
]
const NO_UPLOAD_SCHOOL = 8
const schoolPhone = (id) => `09551${String(100 + id * 7).padStart(5, '0')}`   // 0955… never looks like a person's 0930/0940 number
const schoolById = (id) => SCHOOLS.find(s => s.id === id)

// [id, role, name, school_id, phone, code, subject_id] — the fixed accounts of the spec
const ACCOUNTS = [
  [1, 'directorate', 'مديرية التربية · درعا', null, null, 'DIR-DARAA', null],
  ...SCHOOLS.map(s => [s.acct, 'school', `إدارة ${s.name}`, s.id, null, `SCH-${s.id}`, null]),
]
const PITCH_TEACHERS = [
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
// Sections that already existed in round 1 keep their ids and labels: [id, school_id, grade, label, code prefix]
const FIXED_SECTIONS = [[1, 1, 5, 'الخامس (أ)', '5A'], [2, 1, 5, 'الخامس (ب)', '5B'], [3, 1, 6, 'السادس (أ)', '6A'], [4, 2, 4, 'الرابع (أ)', 'B4A'], [5, 3, 6, 'السادس (أ)', 'C6A']]
const FIXED_STUDENT_NAMES = {
  1: ['عمر فراس', 'ريم نبيل', 'زيد وائل', 'لين ماجد', 'حمزة سمير', 'تالا أيمن', 'كرم عدنان', 'سما غسان', 'يزن عماد', 'جود هاني', 'رغد منير', 'إياد طلال'],
  2: ['محمد خالد', 'ليان أحمد', 'عبد الرحمن يوسف', 'سارة عمر', 'يوسف علي', 'هبة سامي', 'أحمد فادي', 'نور حسام', 'كرم رامي', 'جنى باسل', 'مريم طارق', 'آدم زياد'],
  3: ['سارة خالد', 'علي حسين', 'رنيم فؤاد', 'معاذ جمال', 'شام رياض', 'أنس عدنان', 'غنى وليد', 'بشر نضال', 'لمى عصام', 'سليم بسام', 'ميرا جهاد', 'فارس أكرم'],
  4: ['حسن محمود', 'ديمة نزار', 'طارق سهيل', 'لجين عامر', 'عبادة مروان', 'سدرة خليل', 'مجد رائد', 'تيم عدي'],
  5: ['نادر فايز', 'سلاف حكمت', 'رائد كمال', 'آية صالح', 'وسيم جابر', 'بتول مازن', 'لؤي شادي', 'هيا منذر'],
}
const THREE_DAY_STUDENT = 9   // يزن عماد (الخامس (أ)): absent the last three school days → the directorate's early-warning alert

// Name pools (Syrian, varied; compound given names stay whole).
const BOYS = ['محمد', 'أحمد', 'عمر', 'علي', 'يوسف', 'عبد الرحمن', 'عبد الله', 'حمزة', 'كرم', 'يزن', 'زيد', 'آدم', 'أنس', 'معاذ', 'بشر', 'سليم', 'فارس', 'إياد', 'حسن', 'حسين',
  'خالد', 'طارق', 'مجد', 'تيم', 'عبادة', 'رائد', 'وسيم', 'لؤي', 'نادر', 'باسل', 'رامي', 'فادي', 'حسام', 'عماد', 'هاني', 'وائل', 'فراس', 'ماجد', 'أيمن', 'وليد', 'عصام', 'مازن',
  'أسامة', 'قاسم', 'عبد الكريم', 'محمد نور', 'ضياء', 'براء', 'مصطفى', 'إبراهيم', 'عثمان', 'ياسين', 'سعيد', 'جاد', 'ليث', 'غيث', 'نور الدين', 'مهند', 'حذيفة', 'كنان', 'يامن',
  'جواد', 'سيف', 'أويس', 'قصي', 'مؤمن', 'إلياس', 'راشد', 'بلال', 'عدي', 'زياد', 'محمود', 'عبد الهادي', 'تمام', 'حيان', 'عبد العزيز', 'رأفت']
const GIRLS = ['ليان', 'سارة', 'هبة', 'نور', 'جنى', 'مريم', 'ريم', 'لين', 'تالا', 'سما', 'رغد', 'رنيم', 'شام', 'غنى', 'لمى', 'ميرا', 'ديمة', 'لجين', 'سدرة', 'سلاف', 'آية', 'بتول',
  'هيا', 'ملك', 'جوري', 'فرح', 'زينة', 'تسنيم', 'حلا', 'رؤى', 'سجى', 'بيان', 'رزان', 'آلاء', 'دانة', 'شهد', 'نغم', 'ماسة', 'يارا', 'تيماء', 'ريتاج', 'جودي', 'ندى', 'لارا',
  'سيلين', 'ألين', 'أسيل', 'لميس', 'ميار', 'روان', 'عائشة', 'فاطمة', 'خديجة', 'حنين', 'إسراء', 'أمل', 'ياسمين', 'جمانة', 'بشرى', 'رقية', 'مرح', 'تقى', 'سدين', 'جنان', 'سوسن',
  'وعد', 'إيمان', 'منار', 'رواء', 'ولاء', 'سهى', 'لينا', 'رنا', 'سلمى', 'رهف', 'ريما', 'نهى']
const FATHERS = ['خالد', 'أحمد', 'يوسف', 'عمر', 'علي', 'سامي', 'فادي', 'حسام', 'رامي', 'باسل', 'طارق', 'زياد', 'فراس', 'نبيل', 'وائل', 'ماجد', 'سمير', 'أيمن', 'عدنان', 'غسان',
  'عماد', 'هاني', 'منير', 'طلال', 'حسين', 'فؤاد', 'جمال', 'رياض', 'وليد', 'نضال', 'عصام', 'بسام', 'جهاد', 'أكرم', 'محمود', 'نزار', 'سهيل', 'عامر', 'مروان', 'خليل', 'رائد',
  'عدي', 'فايز', 'حكمت', 'كمال', 'صالح', 'جابر', 'مازن', 'شادي', 'منذر', 'محمد', 'إبراهيم', 'عبد الله', 'عبد الرحمن', 'مصطفى', 'حسن', 'ياسر', 'نذير', 'بشير', 'منصور', 'سعيد',
  'جميل', 'أنور', 'عثمان', 'ياسين', 'فهد', 'رشيد', 'حمدان', 'سليمان', 'نعيم', 'رامز', 'ناصر', 'قاسم', 'عادل', 'حمد', 'ثائر', 'رضوان', 'عبد الكريم', 'زهير', 'هشام', 'مأمون',
  'ماهر', 'نواف', 'فيصل', 'بلال', 'راتب', 'فوزي', 'رفعت', 'حاتم', 'غالب', 'عبد المجيد', 'إحسان', 'لؤي', 'وسيم', 'مهند', 'أسامة', 'عبد العزيز', 'عزام', 'تيسير', 'نهاد', 'سهيل']
const SURNAMES = ['محمود', 'رامز', 'نبيل', 'سليمان', 'حمدان', 'رشيد', 'كمال', 'نعيم', 'عبد الله', 'صالح', 'حسين', 'إبراهيم', 'فهد', 'مصطفى', 'جميل', 'أنور', 'حسن', 'عثمان', 'ياسين',
  'نذير', 'عادل', 'بشير', 'منصور', 'سعيد', 'الأحمد', 'الخطيب', 'الحلبي', 'العلي', 'الصالح', 'النجّار', 'الحدّاد', 'الشامي', 'الحوراني', 'درويش', 'عيد', 'زيتون', 'سلامة', 'نجم',
  'بركات', 'شاهين', 'عوض', 'سلطان', 'عبّاس', 'ديب', 'حمّود', 'مرعي', 'الشيخ', 'الحاج', 'عودة', 'قاسم', 'خليل', 'ناصر', 'سعد', 'فارس', 'نور', 'سليم']
const COMPOUND_FIRST = new Set(['عبد', 'أبو', 'أم', 'محمد', 'نور'])
/** The given name: compound names («عبد الرحمن», «محمد نور», «نور الدين») are kept whole. */
const givenName = (name) => {
  const p = name.trim().split(/\s+/)
  if (p[0] === 'محمد' && p[1] === 'نور' && p.length > 2) return 'محمد نور'
  if (p[0] === 'نور' && p[1] === 'الدين' && p.length > 2) return 'نور الدين'
  return (p[0] === 'عبد' || p[0] === 'أبو' || p[0] === 'أم') && p.length > 1 ? `${p[0]} ${p[1]}` : p[0]
}
const fatherOf = (name) => name.trim().slice(givenName(name).length).trim()

// ---------- sections, blocks and teachers ----------
const GRADE = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس']
const LETTER = { A: 'أ', B: 'ب', C: 'ج' }
const sections = []     // {id, school, grade, label, prefix, size}
const blocks = []       // {school, sections: [ids], teachers: {subject: teacherId}}
const teachers = []     // [id, role, name, school, phone, code, subject]
const usedTeacherNames = new Set(PITCH_TEACHERS.map(t => t[2]))
for (const t of PITCH_TEACHERS) teachers.push(t)

function teacherName() {
  for (;;) {
    const name = `${rnd() < 0.55 ? pick(GIRLS) : pick(BOYS)} ${pick(SURNAMES)}`
    if (!usedTeacherNames.has(name)) { usedTeacherNames.add(name); return name }
  }
}
function layoutOf(s) {
  const entries = (s.layout === 12
    ? [[1, 'A'], [1, 'B'], [2, 'A'], [2, 'B'], [3, 'A'], [3, 'B'], [4, 'A'], [4, 'B'], [5, 'A'], [5, 'B'], [6, 'A'], [6, 'B']]
    : s.layout === 8 ? [[1, 'A'], [1, 'B'], [2, 'A'], [2, 'B'], [3, 'A'], [4, 'A'], [5, 'A'], [6, 'A']]
    : [[1, 'A'], [1, 'B'], [2, 'A'], [2, 'B'], [3, 'A'], [3, 'B'], [4, 'A'], [4, 'B']])
  return entries.map(([grade, L]) => ({ grade, L, existing: FIXED_SECTIONS.find(f => f[1] === s.id && f[0] >= 4 && f[2] === grade && f[3] === `${GRADE[grade]} (${LETTER[L]})`) }))
}
for (const s of SCHOOLS) {
  if (s.layout === 'deep1') for (const f of FIXED_SECTIONS.filter(f => f[1] === 1)) sections.push({ id: f[0], school: 1, grade: f[2], label: f[3], prefix: f[4], size: 28 })
  let nextSection = 20 * s.id + 1, nextTeacher = 1000 + s.id * 20 + 1, n = 0
  const ids = layoutOf(s).map(e => {
    const id = e.existing ? e.existing[0] : nextSection++
    const prefix = e.existing ? e.existing[4] : `${s.code === '1' ? '' : s.code}${e.grade}${e.L}`
    sections.push({ id, school: s.id, grade: e.grade, label: `${GRADE[e.grade]} (${LETTER[e.L]})`, prefix, size: e.existing ? 28 : between(25, 33) })
    return id
  })
  for (let b = 0; b < ids.length; b += 4) {
    const block = { school: s.id, sections: ids.slice(b, b + 4), teachers: {} }
    for (const [subj] of SUBJECTS) {
      // Round-1 teachers keep their schools and subjects: they teach the block that holds their old section.
      const inherited = block.sections.some(id => id <= 5) ? PITCH_TEACHERS.find(t => t[3] === s.id && t[6] === subj && t[0] >= 21) : null
      if (inherited) { block.teachers[subj] = inherited[0]; continue }
      if (s.id === 1 && b === 4 && subj === 3) { block.teachers[subj] = 13; continue }   // ماهر عادل also teaches science to the second block
      const id = nextTeacher++
      n++
      teachers.push([id, 'teacher', teacherName(), s.id, `0930${String(id).padStart(6, '0')}`, `T-${s.code}-${String(n).padStart(2, '0')}`, subj])
      block.teachers[subj] = id
    }
    blocks.push(block)
  }
}

// ---------- block timetables: one 30-slot sequence per block, read with a different offset by each section ----------
// Equal subjects are kept ≥ 4 slots apart (Arabic, maths: ≤ 2 a day) or ≥ 6 apart (the rest: ≤ 1 a day), cyclically;
// four sections read the sequence at offsets k = 0..3, so in any slot they get four different subjects = four teachers.
const MIN_GAP = { 1: 4, 2: 4, 3: 6, 4: 6, 5: 6, 6: 6 }
function findSequence() {
  for (let attempt = 0; attempt < 500; attempt++) {
    const seq = new Array(30).fill(0), left = { ...QUOTA }, last = {}, first = {}
    let steps = 0
    const ok = (i, s) => left[s] > 0 && !(last[s] !== undefined && i - last[s] < MIN_GAP[s]) && !(first[s] !== undefined && first[s] + 30 - i < MIN_GAP[s])
    const dfs = (i) => {
      if (i === 30) return true
      if (++steps > 4000) return false
      const opts = [1, 2, 3, 4, 5, 6].map(s => [s, rnd()]).sort((a, b) => a[1] - b[1]).map(x => x[0])
      for (const s of opts) {
        if (!ok(i, s)) continue
        const prevLast = last[s], fresh = first[s] === undefined
        seq[i] = s; left[s]--; last[s] = i; if (fresh) first[s] = i
        if (dfs(i + 1)) return true
        left[s]++; last[s] = prevLast; if (fresh) delete first[s]
      }
      return false
    }
    if (dfs(0)) return seq
  }
  throw new Error('no block sequence found')
}
const slotOf = (d, p) => d * 6 + p - 1
const blockBusy = (seq, offset, slot) => [0, 1, 2, 3].some(k => seq[(slot + k + offset) % 30] === 3)   // is the block's science teacher busy in that slot?
function blockRows(block, seq, offset) {
  const rows = []
  block.sections.forEach((sec, k) => {
    for (let d = 0; d < 5; d++) for (let p = 1; p <= 6; p++) { const subj = seq[(slotOf(d, p) + k + offset) % 30]; rows.push([sec, d, p, subj, block.teachers[subj]]) }
  })
  return rows
}
const blockTimetable = []
for (const block of blocks) {
  const seq = findSequence()
  let offset = Math.floor(rnd() * 30)
  if (block.school === 1 && block.sections[0] === 21) {
    // Block A of school 1: its science teacher is busy on Thursday period 3, so ماهر stays the only free science teacher for the pitch's slot.
    offset = [...Array(30).keys()].find(r => blockBusy(seq, r, slotOf(4, 3)))
  }
  if (block.school === 1 && block.teachers[3] === 13) {
    // Block B of school 1 (ماهر's block): ماهر must be free on Thursday period 3 and period 5 (the 6A anchor needs him there).
    offset = [...Array(30).keys()].find(r => !blockBusy(seq, r, slotOf(4, 3)) && !blockBusy(seq, r, slotOf(4, 5)))
  }
  assert(offset !== undefined, 'block offset for school 1')
  block.seq = seq; block.offset = offset
  blockTimetable.push(...blockRows(block, seq, offset))
}
const maherBlockSlots = new Set(blockTimetable.filter(r => r[4] === 13).map(r => `${r[1]},${r[2]}`))

// ---------- the pitch sections of school 1: anchored backtracking search ----------
const teacherOf = (section, subject) => subject === 3 ? (section === 3 ? 13 : 12) : { 1: 14, 2: 11, 4: 16, 5: 15, 6: 17 }[subject]
// Fixed cells: [section, day, period] → subject.  Thursday الخامس (ب) exactly as the pitch; period 5 Thursday:
// رنا in الخامس (أ) and ماهر in السادس (أ) (so سامر is a free candidate); period 3 Thursday: ماهر must be free.
const FIXED = new Map()
;[1, 2, 3, 4, 5, 6].forEach((s, i) => FIXED.set(`2,4,${i + 1}`, s))
FIXED.set('1,4,5', 3); FIXED.set('3,4,5', 3)
const FORBIDDEN = new Map([['3,4,3', new Set([3])], ['1,4,3', new Set([3])]])
// Demo story on every weekday: رنا teaches a period in which ماهر is free, so the seeded «رنا absent → ماهر approved»
// holds whatever day the reseed runs (Thursday is covered by the pitch anchors: 5B period 3). One cell per day Sun–Wed,
// alternating between الخامس (أ) and الخامس (ب), in a period ماهر's block leaves free; 6A science is kept out of it.
for (let d = 0; d < 4; d++) {
  const free = [1, 2, 3, 4, 5, 6].filter(p => !maherBlockSlots.has(`${d},${p}`)).sort((a, b) => Math.abs(a - 3.5) - Math.abs(b - 3.5))
  assert(free.length, 'ماهر has a free period on day ' + d)
  FIXED.set(`${d % 2 === 0 ? 1 : 2},${d},${free[0]}`, 3)
  FORBIDDEN.set(`3,${d},${free[0]}`, new Set([3]))
}

function buildPitchSections() {
  // Cells are visited Thursday first (its fixed cells constrain the quotas), then Sun–Wed, slot by slot.
  // A bounded DFS with random restarts: the constraints are loose, so a few thousand steps normally suffice.
  const DAYS = [4, 0, 1, 2, 3]
  const cells = []
  for (const day of DAYS) for (let period = 1; period <= 6; period++) for (const s of [1, 2, 3]) cells.push([s, day, period])
  for (let attempt = 0; attempt < 200; attempt++) {
    const grid = new Map()      // "s,d,p" → subject
    const left = { 1: { ...QUOTA }, 2: { ...QUOTA }, 3: { ...QUOTA } }
    const busy = new Set([...maherBlockSlots].map(k => `13,${k}`))   // "teacher,d,p" — ماهر's block periods are taken
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
      const options = fixed ? [fixed] : [1, 2, 3, 4, 5, 6].map(x => [x, left[s][x] + 2 * rnd()]).sort((a, b) => b[1] - a[1]).map(x => x[0])
      for (const subj of options) {
        if (!ok(s, d, p, subj)) continue
        place(s, d, p, subj, true)
        if (feasible(s, d, p) && dfs(i + 1)) return true
        place(s, d, p, subj, false)
      }
      return false
    }
    if (!dfs(0)) continue
    const rows = []
    for (const [k, subj] of grid) { const [s, d, p] = k.split(',').map(Number); rows.push([s, d, p, subj, teacherOf(s, subj)]) }
    return rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
  }
  throw new Error('timetable search failed')
}
const timetable = [...buildPitchSections(), ...blockTimetable]

// sanity: anchors from the spec, quotas, no double booking
const at = (s, d, p) => timetable.find(r => r[0] === s && r[1] === d && r[2] === p)
assert([1, 2, 3, 4, 5, 6].every((subj, i) => at(2, 4, i + 1)[3] === subj), 'الخامس (ب) Thursday')
assert(!timetable.some(r => r[1] === 4 && r[2] === 5 && r[4] === 11), 'سامر free Thu P5')
assert(!timetable.some(r => r[1] === 4 && r[2] === 3 && r[4] === 13), 'ماهر free Thu P3')
assert(timetable.some(r => r[1] === 4 && r[2] === 5 && r[4] === 13), 'ماهر busy Thu P5')
assert(teachers.filter(t => t[3] === 1 && t[6] === 3 && t[0] !== 12 && t[0] !== 13).every(t => timetable.some(r => r[1] === 4 && r[2] === 3 && r[4] === t[0])), 'other science teachers of school 1 busy Thu P3')
// every weekday: رنا has a period in which ماهر is free (the seeded approval), and ماهر never has two sections at once
const maherBusyAll = new Set(timetable.filter(r => r[4] === 13).map(r => `${r[1]},${r[2]}`))
assert([0, 1, 2, 3, 4].every(d => timetable.some(r => r[4] === 12 && r[1] === d && !maherBusyAll.has(`${d},${r[2]}`))), 'رنا has a ماهر-free period every weekday')
const seen = new Set()
for (const r of timetable) { const k = `${r[4]},${r[1]},${r[2]}`; assert(!seen.has(k), 'double booking ' + k); seen.add(k) }
for (const sec of sections) {
  const rows = timetable.filter(r => r[0] === sec.id)
  assert(rows.length === 30, `section ${sec.id} has ${rows.length} periods`)
  for (const [subj] of SUBJECTS) assert(rows.filter(r => r[3] === subj).length === QUOTA[subj], `quota ${subj} in section ${sec.id}`)
}

// ---------- students and guardians ----------
// A guardian is named after the student's father (the second part of the student's name) plus a surname.
const students = []   // [id, user_id, section_id, guardian_user_id, registry_no, name, code, school_id]
const guardians = []  // [user_id, name, phone, code, school_id]
const namesInSection = new Map()
let sid = 0, guardianId = 401, pn = 1
// Round-1 students keep their ids, names, codes and guardians (P-1…P-24, P-KHALED with two children).
for (const [secId, schoolId, , , prefix] of FIXED_SECTIONS) {
  FIXED_STUDENT_NAMES[secId].forEach((name, i) => {
    sid++
    const userId = secId <= 3 ? 100 + sid : secId === 4 ? 200 + i + 1 : 300 + i + 1
    const code = name === 'ليان أحمد' ? 'S-LAYAN' : `S-${prefix}-${String(i + 1).padStart(2, '0')}`
    let guardian = null
    if (secId <= 3 && i < 8) {
      if (name === 'سارة خالد') guardian = 409   // second child of the demo parent خالد (P-KHALED)
      else {
        guardian = guardianId++
        const code = guardian === 409 ? 'P-KHALED' : `P-${pn}`
        pn++
        guardians.push([guardian, `${fatherOf(name)} ${SURNAMES[(guardian - 401) % 24]}`, `0940${String(guardian).padStart(6, '0')}`, code, schoolId])
      }
    }
    students.push([sid, userId, secId, guardian, `2026-${String(sid).padStart(4, '0')}`, name, code, schoolId])
    namesInSection.set(secId, new Set([...(namesInSection.get(secId) ?? []), name]))
  })
}
// Everyone else: sections are filled to their size with fresh names; about 70 % of the students have a guardian account.
for (const sec of [...sections].sort((a, b) => a.school - b.school || a.id - b.id)) {
  const used = namesInSection.get(sec.id) ?? new Set()
  let i = used.size
  while (i < sec.size) {
    let name
    do name = `${rnd() < 0.5 ? pick(GIRLS) : pick(BOYS)} ${pick(FATHERS)}`; while (used.has(name))
    used.add(name)
    sid++; i++
    const userId = 10000 + sid
    let guardian = null
    if ((sid * 7) % 10 < 7) {
      guardian = 20000 + sid
      guardians.push([guardian, `${fatherOf(name)} ${pick(SURNAMES)}`, `0940${String(sid).padStart(6, '0')}`, `P-${pn++}`, sec.school])
    }
    students.push([sid, userId, sec.id, guardian, `2026-${String(sid).padStart(4, '0')}`, name, `S-${sec.prefix}-${String(i).padStart(2, '0')}`, sec.school])
  }
}
const codes = new Set()
for (const c of [...ACCOUNTS, ...teachers].map(x => x[5]).concat(students.map(s => s[6]), guardians.map(g => g[3]))) { assert(!codes.has(c), 'duplicate code ' + c); codes.add(c) }

// ---------- the demo day's stories ----------
// Teacher absences: [teacher_id, rn (1 = demo day, 2 = the school day before, …), reason]. The demo day's are chosen by
// hand; earlier days get one or two per school so the weekly report has substitutions to count.
const REASONS = ['إجازة صحيّة', 'ظرف عائلي', 'دورة تدريبية', 'مهمّة رسمية', 'إجازة إدارية']
const blockTeacher = (school, blockIndex, subj) => blocks.filter(b => b.school === school)[blockIndex].teachers[subj]
const absences = [
  [12, 1, 'إجازة صحيّة'],                         // رنا سعيد — pre-decided (ماهر approved)
  [blockTeacher(1, 0, 1), 1, 'ظرف عائلي'],        // school 1, Arabic of block A — the last two periods stay pending (live decision)
  [blockTeacher(2, 0, 4), 1, 'دورة تدريبية'],
  [blockTeacher(4, 1, 2), 1, 'إجازة صحيّة'],      // school 4 — last period pending
  [blockTeacher(5, 0, 5), 1, 'مهمّة رسمية'],
  [blockTeacher(5, 2, 1), 1, 'إجازة صحيّة'],      // school 5 — last period pending
  [blockTeacher(6, 0, 2), 1, 'ظرف عائلي'],        // school 6 — last two periods pending
  [blockTeacher(6, 1, 6), 1, 'إجازة صحيّة'],
  [blockTeacher(7, 1, 3), 1, 'إجازة إدارية'],
  [blockTeacher(10, 0, 4), 1, 'إجازة صحيّة'],
]
// pending: [teacher_id, how many of the day's last periods the engine fills with suggestions]
const PENDING = [[blockTeacher(1, 0, 1), 2], [blockTeacher(4, 1, 2), 1], [blockTeacher(5, 2, 1), 1], [blockTeacher(6, 0, 2), 2]]
for (const s of SCHOOLS) for (let rn = 2; rn <= 5; rn++) {
  const n = (s.id * 3 + rn) % 3 === 0 ? 0 : (s.id + rn) % 2 === 0 ? 2 : 1
  const pool = teachers.filter(t => t[3] === s.id).map(t => t[0])
  for (let i = 0; i < n; i++) { const t = pool[(s.id * 7 + rn * 5 + i * 3) % pool.length]; if (!absences.some(a => a[0] === t && a[1] === rn)) absences.push([t, rn, REASONS[(s.id + rn + i) % REASONS.length]]) }
}
const acctOf = (teacherId) => schoolById(teachers.find(t => t[0] === teacherId)[3]).acct

// ---------- SQL ----------
const out = []
const rows = (table, cols, list, chunk = 300) => {
  for (let i = 0; i < list.length; i += chunk) out.push(`INSERT OR IGNORE INTO ${table} (${cols}) VALUES\n` + list.slice(i, i + chunk).join(',\n') + ';')
}
out.push(`-- Madar demo seed (docs/mvp-spec.md §8, ten-school pilot). GENERATED by scripts/gen-seed.mjs — edit that file, not this one.
-- Idempotent (INSERT OR IGNORE); dates are relative to the demo day = the latest school day on or before today in Damascus.
-- Apply after schema.sql (POST /api/admin/sql or scripts/apply-sql.mjs). The remaining substitute suggestions for the
-- demo day's absences are produced by the engine itself on the first dashboard load (ensureSubstitutions) — see README.`)

out.push(`CREATE TABLE IF NOT EXISTS demo_days (rn INTEGER PRIMARY KEY, d TEXT NOT NULL, wd INTEGER NOT NULL);
DELETE FROM demo_days;
WITH RECURSIVE days(d, n) AS (SELECT ${DEMO_DAY}, 0 UNION ALL SELECT date(d, '-1 day'), n + 1 FROM days WHERE n < 24),
  school_days AS (SELECT d, CAST(strftime('%w', d) AS INTEGER) AS wd FROM days WHERE CAST(strftime('%w', d) AS INTEGER) NOT IN (5, 6))
INSERT INTO demo_days (rn, d, wd) SELECT row_number() OVER (ORDER BY d DESC), d, wd FROM school_days;`)

out.push(`INSERT OR IGNORE INTO schools (id, name, complex, shifts, principal, phone) VALUES\n` +
  SCHOOLS.map(s => `  (${s.id}, ${q(s.name)}, ${q(s.complex)}, 1, ${q(s.principal)}, ${q(schoolPhone(s.id))})`).join(',\n') + ';')
out.push(`INSERT OR IGNORE INTO subjects (id, name) VALUES\n` + SUBJECTS.map(([id, n]) => `  (${id}, ${q(n)})`).join(',\n') + ';')
const userRow = ([id, role, name, school, phone, code, subj]) => `  (${id}, ${q(role)}, ${q(name)}, ${nul(school)}, ${nul(phone)}, ${q(code)}, ${nul(subj)})`
const USER_COLS = 'id, role, name, school_id, phone, code, subject_id'
rows('users', USER_COLS, ACCOUNTS.map(userRow))
rows('users', USER_COLS, teachers.map(userRow))
rows('users', USER_COLS, students.map(([, uid, , , , name, code, school]) => userRow([uid, 'student', name, school, null, code, null])))
rows('users', USER_COLS, guardians.map(([uid, name, phone, code, school]) => userRow([uid, 'parent', name, school, phone, code, null])))
rows('sections', 'id, school_id, grade, label, shift', sections.map(s => `  (${s.id}, ${s.school}, ${s.grade}, ${q(s.label)}, 1)`))
rows('students', 'id, user_id, section_id, guardian_user_id, registry_no', students.map(([id, uid, sec, g, reg]) => `  (${id}, ${uid}, ${sec}, ${nul(g)}, ${q(reg)})`))
rows('timetable', 'id, section_id, day, period, subject_id, teacher_id', timetable.map((r, i) => `  (${i + 1}, ${r[0]}, ${r[1]}, ${r[2]}, ${r[3]}, ${r[4]})`))

// Homework: the pitch's maths homework for الخامس (ب) due in three days, a little variety in school 1, and one or two
// pieces "today" in every other school so homework_today is not zero across the dashboard.
const hw = [
  [1, 2, 2, 11, 'تمارين الكسور العشرية ص ٤٢', 'حلّ التمارين من ١ إلى ٨ في الدفتر، مع كتابة خطوات الحلّ.', '42', 3, ' 08:10:00', 0],
  [2, 2, 1, 14, 'قراءة نصّ «الوطن» والإجابة عن الأسئلة', 'الإجابة عن أسئلة الفهم والاستيعاب في الدفتر.', '17', 1, ' 09:00:00', -2],
  [3, 1, 3, 12, 'تلخيص درس دورة الماء في الطبيعة', null, '55', 2, ' 10:30:00', -1],
  [4, 3, 2, 11, 'مسائل النسبة والتناسب ص ٣٠', 'المسائل ١ و٢ و٣.', '30', 4, ' 11:15:00', -1],
]
const HW_TITLES = [['تمارين الدرس ص ١٨', '18'], ['قراءة النصّ والإجابة عن الأسئلة', '22'], ['حفظ جدول الضرب ٦ و٧', '35'], ['تلخيص الدرس في الدفتر', '40'], ['كتابة فقرة عن فصل الخريف', '12'], ['حلّ مسائل الصفحة ٢٤', '24'], ['تحضير درس الغد', '47'], ['مراجعة المفردات الجديدة', '9']]
let hwId = 5
for (const b of blocks.filter(b => b.school !== 1)) {
  if ((b.school + b.sections[0]) % 2 === 0) continue
  const subj = [1, 2, 4][(b.school + b.sections[0]) % 3], [title, page] = HW_TITLES[hwId % HW_TITLES.length]
  hw.push([hwId++, b.sections[(b.school) % 4], subj, b.teachers[subj], title, null, page, 2 + (b.school % 3), ` 0${8 + (b.school % 2)}:${20 + b.school}:00`, 0])
}
out.push(`INSERT OR IGNORE INTO homework (id, section_id, subject_id, teacher_id, title, details, book_page, due_date, created_at) VALUES\n` +
  hw.map(([id, sec, subj, t, title, details, page, due, time, dayOff]) =>
    `  (${id}, ${sec}, ${subj}, ${t}, ${q(title)}, ${nul(details)}, ${q(page)}, date(${D1}, '+${due} days'), datetime(${D1} || ${q(time)}, '-3 hours'${dayOff ? `, '${dayOff} days'` : ''}))`).join(',\n') + ';')
out.push(`INSERT OR IGNORE INTO submissions (homework_id, student_id, status, submitted_at) VALUES
  (1, 15, 'done', datetime('now','-5 hours')), (1, 16, 'done', datetime('now','-4 hours')), (1, 17, 'done', datetime('now','-3 hours')),
  (1, 18, 'done', datetime('now','-2 hours')), (1, 19, 'done', datetime('now','-1 hours')),
  (2, 13, 'done', datetime('now','-1 day')), (2, 15, 'done', datetime('now','-1 day')), (2, 16, 'done', datetime('now','-1 day')), (2, 17, 'done', datetime('now','-1 day')),
  (2, 18, 'done', datetime('now','-1 day')), (2, 19, 'done', datetime('now','-1 day')), (2, 20, 'done', datetime('now','-1 day')), (2, 21, 'done', datetime('now','-1 day')),
  (3, 1, 'done', datetime('now','-3 hours')), (3, 2, 'done', datetime('now','-3 hours')), (3, 3, 'done', datetime('now','-2 hours')),
  (4, 25, 'done', datetime('now','-2 hours')), (4, 26, 'done', datetime('now','-2 hours'));`)

// Attendance: the demo day and the four school days before it. Earlier days: six periods, confirmed. The demo day is in
// progress: periods 1–2 only, unconfirmed, and school 8 has not uploaded anything yet. A student's status is the same
// all day (absent = the whole day); a few arrive late in period 1. Absence rates differ per school (one weak school);
// the hash step of 17 makes streaks of three impossible, so the only three-day streak is student 9's.
const rateCase = 'CASE c.school_id ' + SCHOOLS.map(s => `WHEN ${s.id} THEN ${s.rate}`).join(' ') + ' END'
out.push(`WITH recent AS (SELECT rn, d, wd FROM demo_days WHERE rn <= 5),
  periods(p) AS (VALUES (1), (2), (3), (4), (5), (6)),
  roster AS (SELECT st.id AS student_id, sec.id AS section_id, sec.school_id FROM students st JOIN sections sec ON sec.id = st.section_id),
  cells AS (
    SELECT r.student_id, r.section_id, r.school_id, rd.d, rd.rn, rd.wd, p.p,
           (r.student_id * 31 + CAST(julianday(rd.d) AS INTEGER) * 17) % 100 AS h,
           (r.student_id * 7 + CAST(julianday(rd.d) AS INTEGER)) % 23 AS l
    FROM roster r CROSS JOIN recent rd CROSS JOIN periods p
    WHERE rd.rn > 1 OR (p.p <= 2 AND r.school_id <> ${NO_UPLOAD_SCHOOL})
  )
INSERT OR IGNORE INTO attendance (student_id, date, period, status, recorded_by, confirmed, created_at)
SELECT c.student_id, c.d, c.p,
       CASE WHEN (c.student_id = ${THREE_DAY_STUDENT} AND c.rn <= 3) OR c.h < (${rateCase}) THEN 'absent'
            WHEN c.p = 1 AND c.l = 1 THEN 'late'
            ELSE 'present' END,
       COALESCE((SELECT t.teacher_id FROM timetable t WHERE t.section_id = c.section_id AND t.day = c.wd AND t.period = c.p),
                (SELECT u.id FROM users u WHERE u.role = 'school' AND u.school_id = c.school_id)),
       CASE WHEN c.rn > 1 THEN 1 ELSE 0 END,
       datetime(c.d || ' 07:30:00', '-3 hours', '+' || (12 + (c.p - 1) * 50) || ' minutes')
FROM cells c;`)

// Teacher absences (the demo day's and the week's), reported by the school accounts at 07:05 local time.
out.push(`WITH v(teacher_id, rn, reason, reported_by) AS (VALUES\n` +
  absences.map(([t, rn, reason]) => `  (${t}, ${rn}, ${q(reason)}, ${acctOf(t)})`).join(',\n') + `)
INSERT OR IGNORE INTO absences (teacher_id, date, reason, reported_by, created_at)
SELECT v.teacher_id, dd.d, v.reason, v.reported_by, datetime(dd.d || ' 07:05:00', '-3 hours') FROM v JOIN demo_days dd ON dd.rn = v.rn ORDER BY v.rn DESC, v.teacher_id;`)

// Pre-decided substitutions: for each affected period, approve a free teacher of the same subject (tier 1) or, failing
// that, a free teacher who teaches the section (tier 2); nobody takes two periods at once; otherwise guided self-study.
// On earlier days about one period in twelve stayed uncovered. The pending periods of the demo day are skipped here.
const pendingSql = PENDING.map(([t, n]) => `(s.teacher_id = ${t} AND s.period > s.last_period - ${n})`).join(' OR ')
const ORD = (col) => `CASE ${col} WHEN 1 THEN 'الأولى' WHEN 2 THEN 'الثانية' WHEN 3 THEN 'الثالثة' WHEN 4 THEN 'الرابعة' WHEN 5 THEN 'الخامسة' WHEN 6 THEN 'السادسة' ELSE 'السابعة' END`
out.push(`WITH slots AS (
    SELECT a.id AS absence_id, a.teacher_id, a.date, dd.rn, dd.wd, u.school_id, t.id AS timetable_id, t.period, t.section_id, t.subject_id,
           (SELECT MAX(x.period) FROM timetable x WHERE x.teacher_id = a.teacher_id AND x.day = dd.wd) AS last_period,
           (a.teacher_id * 13 + t.period * 7 + dd.rn * 3) % 100 AS h
    FROM absences a JOIN users u ON u.id = a.teacher_id JOIN demo_days dd ON dd.d = a.date
    JOIN timetable t ON t.teacher_id = a.teacher_id AND t.day = dd.wd
  ),
  picks AS (
    SELECT s.*,
      (SELECT c.id FROM users c WHERE c.role = 'teacher' AND c.school_id = s.school_id AND c.id <> s.teacher_id AND c.subject_id = s.subject_id
         AND NOT EXISTS (SELECT 1 FROM timetable x WHERE x.teacher_id = c.id AND x.day = s.wd AND x.period = s.period)
         AND NOT EXISTS (SELECT 1 FROM absences b WHERE b.teacher_id = c.id AND b.date = s.date)
       ORDER BY c.id LIMIT 1) AS same_subject,
      (SELECT c.id FROM users c WHERE c.role = 'teacher' AND c.school_id = s.school_id AND c.id <> s.teacher_id
         AND EXISTS (SELECT 1 FROM timetable y WHERE y.teacher_id = c.id AND y.section_id = s.section_id)
         AND NOT EXISTS (SELECT 1 FROM timetable x WHERE x.teacher_id = c.id AND x.day = s.wd AND x.period = s.period)
         AND NOT EXISTS (SELECT 1 FROM absences b WHERE b.teacher_id = c.id AND b.date = s.date)
       ORDER BY c.id LIMIT 1) AS section_teacher
    FROM slots s
    WHERE NOT (s.rn = 1 AND (${pendingSql}))
  ),
  chosen AS (
    SELECT p.*, COALESCE(p.same_subject, p.section_teacher) AS sub, CASE WHEN p.same_subject IS NOT NULL THEN 1 WHEN p.section_teacher IS NOT NULL THEN 2 END AS tier,
           (p.rn > 1 AND p.h < 8) AS left_uncovered
    FROM picks p
  ),
  ranked AS (SELECT c.*, row_number() OVER (PARTITION BY c.school_id, c.date, c.period, c.sub ORDER BY c.absence_id) AS dup FROM chosen c)
INSERT OR IGNORE INTO substitutions (absence_id, timetable_id, substitute_teacher_id, status, candidates, lesson_note, approved_by, approved_at)
SELECT r.absence_id, r.timetable_id,
       CASE WHEN r.left_uncovered THEN NULL WHEN r.sub IS NOT NULL AND r.dup = 1 THEN r.sub END,
       CASE WHEN r.left_uncovered THEN 'uncovered' WHEN r.sub IS NOT NULL AND r.dup = 1 THEN 'approved' ELSE 'self_study' END,
       CASE WHEN NOT r.left_uncovered AND r.sub IS NOT NULL AND r.dup = 1 THEN json_array(json_object(
              'teacher_id', r.sub, 'name', (SELECT name FROM users WHERE id = r.sub),
              'subject', (SELECT sj.name FROM users u2 JOIN subjects sj ON sj.id = u2.subject_id WHERE u2.id = r.sub), 'tier', r.tier,
              'reason', CASE r.tier WHEN 1 THEN 'المادّة نفسها · حصّة فراغ · بلا تعويضات هذا الشهر' ELSE 'من معلّمي الشعبة · حصّة فراغ · بلا تعويضات هذا الشهر' END))
            ELSE '[]' END,
       CASE WHEN r.left_uncovered THEN NULL
            WHEN r.sub IS NOT NULL AND r.dup = 1 THEN CASE r.h % 3 WHEN 0 THEN 'متابعة الدرس من الكتاب' WHEN 1 THEN 'حلّ تمارين الدرس السابق' ELSE NULL END
            ELSE 'قراءة الدرس وحلّ أسئلته في الدفتر' END,
       CASE WHEN r.left_uncovered THEN NULL ELSE (SELECT id FROM users WHERE role = 'school' AND school_id = r.school_id) END,
       CASE WHEN r.left_uncovered THEN NULL ELSE datetime(r.date || ' 07:20:00', '-3 hours') END
FROM ranked r;`)

out.push(`INSERT OR IGNORE INTO announcements (id, school_id, title, body, urgent, created_by, created_at) VALUES
  (1, 1, 'اجتماع أولياء الأمور', 'يُعقد اجتماع أولياء الأمور يوم الأحد القادم في الساعة العاشرة صباحاً في قاعة المدرسة. حضوركم يهمّنا.', 0, 2, datetime(${D1} || ' 12:30:00', '-3 hours', '-1 day')),
  (2, NULL, 'تعميم: تحديث بيانات الطلاب', 'يُرجى من إدارات المدارس استكمال تحديث بيانات الطلاب وأولياء الأمور على المنصّة قبل نهاية الأسبوع.', 0, 1, datetime(${D1} || ' 10:00:00', '-3 hours', '-2 days')),
  (3, 2, 'تطعيم الصفّ الأول', 'تزور وحدة التطعيم المدرسة يوم الثلاثاء القادم؛ يُرجى إحضار البطاقة الصحيّة للطالب.', 0, 3, datetime(${D1} || ' 11:00:00', '-3 hours', '-1 day'));`)

// Notifications that the day's events would have produced (guarded by dedupe_key, so re-applying the seed adds nothing):
// the school account hears about each fully decided absence, every substitute gets the assignment, the affected sections
// (students and guardians) hear about the change, plus the demo student's/parent's homework and announcement notices.
const DIGIT = (expr) => `substr('٠١٢٣٤٥٦٧٨٩', ${expr} + 1, 1)`
out.push(`INSERT OR IGNORE INTO notifications (user_id, kind, body, link, sms, created_at, dedupe_key)
SELECT sa.id, 'absence_teacher',
       'غياب أ. ' || u.name || ' اليوم: ' || CASE n.c WHEN 1 THEN 'حصّة واحدة' WHEN 2 THEN 'حصّتان' ELSE ${DIGIT('n.c')} || ' حصص' END || ' بحاجة إلى تغطية',
       '/absences/' || a.id, 0, datetime(a.date || ' 07:06:00', '-3 hours'), 'seed:absence:' || a.id
FROM absences a JOIN users u ON u.id = a.teacher_id JOIN users sa ON sa.role = 'school' AND sa.school_id = u.school_id
JOIN (SELECT s.absence_id, COUNT(*) AS c FROM substitutions s GROUP BY s.absence_id) n ON n.absence_id = a.id
WHERE a.date = ${D1} AND a.teacher_id NOT IN (${PENDING.map(p => p[0]).join(', ')});`)
out.push(`INSERT OR IGNORE INTO notifications (user_id, kind, body, link, sms, created_at, dedupe_key)
SELECT s.substitute_teacher_id, 'substitution',
       'تكليفك بتغطية الحصّة ' || ${ORD('t.period')} || ' اليوم — ' || sec.label || ' · ' || sj.name || COALESCE(' · خطّة الدرس: ' || s.lesson_note, ''),
       '/substitutions/' || s.id, 0, s.approved_at, 'seed:sub:' || s.id
FROM substitutions s JOIN absences a ON a.id = s.absence_id JOIN timetable t ON t.id = s.timetable_id
JOIN sections sec ON sec.id = t.section_id JOIN subjects sj ON sj.id = t.subject_id
WHERE a.date = ${D1} AND s.status = 'approved' AND s.substitute_teacher_id IS NOT NULL;`)
out.push(`INSERT OR IGNORE INTO notifications (user_id, kind, body, link, sms, created_at, dedupe_key)
SELECT x.uid, 'change', x.body, x.link, 0, x.at, 'seed:change:' || x.sid || ':' || x.uid FROM (
  SELECT st.user_id AS uid, s.id AS sid, s.approved_at AS at,
         CASE WHEN s.status = 'approved' THEN 'تغيّر معلّم الحصّة ' || ${ORD('t.period')} || ' اليوم'
              ELSE 'الحصّة ' || ${ORD('t.period')} || ' اليوم تعلّم ذاتي موجَّه: ' || s.lesson_note END AS body,
         '/timetable?date=' || a.date || '&section_id=' || t.section_id AS link
  FROM substitutions s JOIN absences a ON a.id = s.absence_id JOIN timetable t ON t.id = s.timetable_id JOIN students st ON st.section_id = t.section_id
  WHERE a.date = ${D1} AND s.status IN ('approved', 'self_study')
  UNION
  SELECT DISTINCT st.guardian_user_id, s.id, s.approved_at,
         CASE WHEN s.status = 'approved' THEN 'تغيّر معلّم الحصّة ' || ${ORD('t.period')} || ' اليوم'
              ELSE 'الحصّة ' || ${ORD('t.period')} || ' اليوم تعلّم ذاتي موجَّه: ' || s.lesson_note END,
         '/timetable?date=' || a.date || '&section_id=' || t.section_id
  FROM substitutions s JOIN absences a ON a.id = s.absence_id JOIN timetable t ON t.id = s.timetable_id JOIN students st ON st.section_id = t.section_id
  WHERE a.date = ${D1} AND s.status IN ('approved', 'self_study') AND st.guardian_user_id IS NOT NULL
) x;`)
const notice = (uid, kind, body, link, time, key) =>
  `INSERT OR IGNORE INTO notifications (user_id, kind, body, link, sms, created_at, dedupe_key) VALUES (${uid}, ${q(kind)}, ${q(body)}, ${q(link)}, 0, datetime(${D1} || ${q(time)}, '-3 hours'${key.includes('circular') ? ", '-2 days'" : key.includes('announce') ? ", '-1 day'" : ''}), ${q(key)});`
const layan = students.find(s => s[6] === 'S-LAYAN'), mohammad = students.find(s => s[5] === 'محمد خالد')
out.push(notice(layan[1], 'homework', 'واجب جديد في الرياضيات: تمارين الكسور العشرية ص ٤٢ — يُسلَّم بعد ٣ أيام', '/homework/1', ' 08:12:00', 'seed:hw1:layan'))
out.push(notice(layan[1], 'announcement', 'إعلان من المدرسة: اجتماع أولياء الأمور', '/announcements/1', ' 12:31:00', 'seed:announce1:layan'))
out.push(notice(409, 'homework', 'واجب جديد لمحمد في الرياضيات، يُسلَّم بعد ٣ أيام', `/homework/1?student_id=${mohammad[0]}`, ' 08:12:00', 'seed:hw1:khaled'))
out.push(notice(409, 'announcement', 'إعلان من المدرسة: اجتماع أولياء الأمور', '/announcements/1', ' 12:31:00', 'seed:announce1:khaled'))
out.push(`INSERT OR IGNORE INTO notifications (user_id, kind, body, link, sms, created_at, dedupe_key)
SELECT id, 'circular', 'تعميم من المديرية: تحديث بيانات الطلاب', '/announcements/2', 0, datetime(${D1} || ' 10:01:00', '-3 hours', '-2 days'), 'seed:circular2:' || id FROM users WHERE role = 'school';`)

// About 55 % of the guardians have opened the app at least once (a login in the audit log). Guardians without the app
// are the ones who would receive the pilot's SMS; the demo version only simulates those messages (see notify.ts).
out.push(`INSERT INTO audit_log (user_id, action, target, created_at)
SELECT u.id, 'login', NULL, datetime(${D1} || ' 19:00:00', '-3 hours', '-' || (1 + u.id % 6) || ' days')
FROM users u WHERE u.role = 'parent' AND (u.id % 100) < 55 AND NOT EXISTS (SELECT 1 FROM audit_log al WHERE al.user_id = u.id AND al.action = 'login');`)

out.push(`DROP TABLE IF EXISTS demo_days;`)

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed.sql')
const sql = out.join('\n\n') + '\n'
writeFileSync(file, sql)
const perSchool = SCHOOLS.map(s => `${s.id}:${students.filter(x => x[7] === s.id).length}/${teachers.filter(t => t[3] === s.id).length}`).join(' ')
console.log(`seed.sql written (${(sql.length / 1024).toFixed(0)} KB): ${SCHOOLS.length} schools, ${sections.length} sections, ${students.length} students, ${guardians.length} guardians, ${teachers.length} teachers, ${timetable.length} timetable rows, ${absences.length} absences`)
console.log(`students/teachers per school: ${perSchool}`)

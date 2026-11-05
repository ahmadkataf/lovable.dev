/* In-memory implementation of the whole API contract (docs/mvp-spec.md §5),
   seeded from data that mirrors §8 (same names and codes). Used when
   `VITE_MOCK=1` or when the real API is unreachable at login, so the app can
   be demonstrated without the server. State lives in memory and is mirrored
   to sessionStorage so a page reload during a demo keeps what was done. */

import {
  addDays, consecutiveDays, count, dayIndex, firstName, fmtClock, fmtDate, li, NOUNS, periodName, periodOrdinal, todayISO,
} from './format';
import type {
  AbsenceResult, AffectedPeriod, Candidate, Context, DirectorateAbsence, DirectorateAlert, DirectorateDashboard,
  DirectoratePeriod, DirectoratePeriodStatus, DirectorateSchool, DirectorateSchoolDay, DirectorateWeeklyReport, DirectorateWeeklyRow,
  HomeworkDetail, Me, Notification, ParentChild, ParentHome, Role, SchoolDashboard, StudentHome,
  TeacherHome, Thread, TimetableRow, User,
} from './types';

export interface MockResponse { status: number; body: unknown; contentType?: string }

type AttStatus = 'present' | 'absent' | 'late';

interface School { id: number; name: string; complex: string; shifts: number; principal: string; phone: string; enrolment: number; teachers_n: number }
interface DbUser { id: number; role: Role; name: string; school_id: number | null; phone: string | null; code: string; subject_id: number | null }
interface Subject { id: number; name: string }
interface Section { id: number; school_id: number; grade: number; label: string; shift: number }
interface Student { id: number; user_id: number; section_id: number; guardian_user_id: number | null; registry_no: string }
interface Timetable { id: number; section_id: number; day: number; period: number; subject_id: number; teacher_id: number }
interface Hw { id: number; section_id: number; subject_id: number; teacher_id: number; title: string; details: string | null; book_page: string | null; due_date: string; created_at: string; client_id: string | null }
interface Sub { id: number; homework_id: number; student_id: number; status: string; submitted_at: string }
interface Att { id: number; student_id: number; date: string; period: number; status: AttStatus; recorded_by: number; confirmed: number; created_at: string }
interface Abs { id: number; teacher_id: number; date: string; reason: string | null; reported_by: number; created_at: string }
interface Subst { id: number; absence_id: number; timetable_id: number; substitute_teacher_id: number | null; status: 'suggested' | 'approved' | 'self_study' | 'uncovered'; candidates: Candidate[]; note?: string | null; lesson_note: string | null; approved_by: number | null; approved_at: string | null }
interface Ann { id: number; school_id: number | null; title: string; body: string; urgent: number; created_by: number; created_at: string; notified: number }
interface Msg { id: number; from_user: number; to_user: number; body: string; created_at: string; read_at: string | null }
interface Notif { id: number; user_id: number; kind: string; body: string; link: string | null; sms: number; created_at: string; read_at: string | null }

interface DB {
  version: number;
  seed_date: string;
  seq: number;
  schools: School[];
  users: DbUser[];
  subjects: Subject[];
  sections: Section[];
  students: Student[];
  timetable: Timetable[];
  homework: Hw[];
  submissions: Sub[];
  attendance: Att[];
  absences: Abs[];
  substitutions: Subst[];
  announcements: Ann[];
  messages: Msg[];
  notifications: Notif[];
}

const VERSION = 5;
const WEEKLY_CAP = 28;
const STORAGE_KEY = 'madar-mock';
const TOKEN_PREFIX = 'mock.';

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/* ───────────────────────── seed ───────────────────────── */

const SUBJECTS = ['اللغة العربية', 'الرياضيات', 'العلوم', 'اللغة الإنكليزية', 'الدراسات الاجتماعية', 'التربية الرياضية'];

const NAMES_5B = ['محمد خالد', 'ليان أحمد', 'عبد الرحمن يوسف', 'سارة عمر', 'يوسف علي', 'هبة سامي', 'أحمد فادي', 'نور حسام', 'كرم رامي', 'جنى باسل', 'مريم طارق', 'آدم زياد'];
const NAMES_5A = ['علي حسن', 'رغد سامر', 'حمزة وائل', 'تالا نبيل', 'قصي ماجد', 'لين عماد', 'زيد منير', 'ريتاج فراس', 'عمر غسان', 'شام أيمن', 'مجد طلال', 'غنى وليد'];
const NAMES_6A = ['حسين عادل', 'جود كمال', 'بشار سهيل', 'ميس أنس', 'طارق لؤي', 'سيلين رائد', 'يزن حاتم', 'رهف مازن', 'إياد نزار', 'لمى صفوان', 'فارس هاني', 'تيم رضوان'];
const NAMES_4A = ['أمير جمال', 'دانة سعيد', 'باسل عارف', 'ريم خليل', 'وسيم ناصر', 'هيا فؤاد', 'سامي رشيد', 'لارا زهير'];
const NAMES_3A = ['عدنان بشير', 'نغم صالح', 'فراس عدي', 'جوري ثائر', 'مالك سمير', 'ليال رامز', 'نبيل حافظ', 'ميرا جهاد'];

/** ISO timestamp of a Damascus wall-clock time on a date (Syria is UTC+3 all year). */
function at(date: string, hm: string): string {
  return new Date(`${date}T${hm}:00+03:00`).toISOString();
}
function nowISO(): string { return new Date().toISOString(); }

function rotate<T>(arr: T[], n: number): T[] {
  const k = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

/** The n most recent school days (Sun–Thu) before `date`, oldest first. */
function schoolDaysBefore(date: string, n: number): string[] {
  const out: string[] = [];
  let d = date;
  while (out.length < n) {
    d = addDays(d, -1);
    const w = dayIndex(d);
    if (w <= 4) out.unshift(d);
  }
  return out;
}

function seed(today: string): DB {
  let seq = 1;
  const next = () => seq++;
  const db: DB = {
    version: VERSION, seed_date: today, seq: 1,
    schools: [], users: [], subjects: [], sections: [], students: [], timetable: [], homework: [], submissions: [],
    attendance: [], absences: [], substitutions: [], announcements: [], messages: [], notifications: [],
  };

  // Ten schools of the directorate. The first three carry sections, pupils and timetables (the demo accounts);
  // the other seven appear on the directorate's screens with realistic deterministic figures (see «directorate figures»).
  db.schools = DIR_SCHOOLS.map((s) => ({ ...s, shifts: 1 }));
  db.subjects = SUBJECTS.map((name, i) => ({ id: i + 1, name }));

  const user = (id: number, role: Role, name: string, code: string, school_id: number | null, subject_id: number | null = null, phone: string | null = null): DbUser => {
    const u = { id, role, name, code, school_id, subject_id, phone };
    db.users.push(u);
    return u;
  };
  user(1, 'directorate', 'مديرية التربية · درعا', 'DIR-DARAA', null);
  user(2, 'school', 'إدارة مدرسة درعا النموذجية', 'SCH-1', 1);
  user(3, 'school', 'إدارة مدرسة إزرع الأولى', 'SCH-2', 2);
  user(4, 'school', 'إدارة مدرسة طفس الثانية', 'SCH-3', 3);
  // teachers of school 1 (ids 10–16)
  user(10, 'teacher', 'سامر حسن', 'T-SAMER', 1, 2, '0944000010');
  user(11, 'teacher', 'رنا سعيد', 'T-RANA', 1, 3, '0944000011');
  user(12, 'teacher', 'ماهر عادل', 'T-MAHER', 1, 3, '0944000012');
  user(13, 'teacher', 'هبة سليم', 'T-HIBA', 1, 1, '0944000013');
  user(14, 'teacher', 'خالد نور', 'T-KHALED', 1, 5, '0944000014');
  user(15, 'teacher', 'لينا فارس', 'T-LINA', 1, 4, '0944000015');
  user(16, 'teacher', 'عمر سعد', 'T-OMAR', 1, 6, '0944000016');
  // schools 2 and 3: two teachers each
  user(17, 'teacher', 'نادر صالح', 'T-B1', 2, 1);
  user(18, 'teacher', 'سلمى عيد', 'T-B2', 2, 2);
  user(19, 'teacher', 'فادي حمد', 'T-C1', 3, 1);
  user(20, 'teacher', 'ريم جابر', 'T-C2', 3, 2);

  db.sections = [
    { id: 101, school_id: 1, grade: 5, label: 'الخامس (أ)', shift: 1 },
    { id: 102, school_id: 1, grade: 5, label: 'الخامس (ب)', shift: 1 },
    { id: 103, school_id: 1, grade: 6, label: 'السادس (أ)', shift: 1 },
    { id: 201, school_id: 2, grade: 4, label: 'الرابع (أ)', shift: 1 },
    { id: 301, school_id: 3, grade: 3, label: 'الثالث (أ)', shift: 1 },
  ];

  // students: user ids from 101, student ids from 1001, guardians from 301
  let studentUser = 101, studentId = 1001, guardianUser = 301, guardianN = 1;
  const addStudents = (section: Section, names: string[], codePrefix: string, guardians: number) => {
    names.forEach((name, i) => {
      const uid = studentUser++;
      const sid = studentId++;
      let guardianId: number | null = null;
      if (i < guardians) {
        guardianId = guardianUser++;
        const n = guardianN++;
        const isKhaled = section.id === 102 && i === 0;
        user(guardianId, 'parent', isKhaled ? 'خالد' : `وليّ أمر ${firstName(name)}`, isKhaled ? 'P-KHALED' : `P-${n}`, section.school_id, null, `09330000${String(n).padStart(2, '0')}`);
      }
      const isLayan = section.id === 102 && i === 1;
      user(uid, 'student', name, isLayan ? 'S-LAYAN' : `${codePrefix}-${String(i + 1).padStart(2, '0')}`, section.school_id);
      db.students.push({ id: sid, user_id: uid, section_id: section.id, guardian_user_id: guardianId, registry_no: `${section.grade}${String(sid).slice(-3)}` });
    });
  };
  addStudents(db.sections[0], NAMES_5A, 'S-5A', 8);
  addStudents(db.sections[1], NAMES_5B, 'S-5B', 8);
  addStudents(db.sections[2], NAMES_6A, 'S-6A', 8);
  addStudents(db.sections[3], NAMES_4A, 'S-4A', 4);
  addStudents(db.sections[4], NAMES_3A, 'S-3A', 4);

  // timetable of school 1: six subjects, one period each per day. Thursday order of
  // الخامس (ب) is fixed by the spec; the other sections are cyclic shifts so no
  // teacher is double-booked. سامر is free in period 5 and ماهر in period 3 on Thursday.
  const base = [1, 2, 3, 4, 5, 6]; // عربي رياضيات علوم إنكليزي دراسات رياضة
  const teacherFor = (sectionId: number, subjectId: number): number => {
    switch (subjectId) {
      case 1: return 13;
      case 2: return 10;
      case 3: return sectionId === 103 ? 12 : 11;
      case 4: return 15;
      case 5: return 14;
      default: return 16;
    }
  };
  for (let day = 0; day <= 4; day++) {
    const orderB = rotate(base, day - 4);
    const orders: Record<number, number[]> = { 101: rotate(orderB, 2), 102: orderB, 103: rotate(orderB, 4) };
    for (const sectionId of [101, 102, 103]) {
      orders[sectionId].forEach((subjectId, i) => {
        db.timetable.push({ id: next(), section_id: sectionId, day, period: i + 1, subject_id: subjectId, teacher_id: teacherFor(sectionId, subjectId) });
      });
    }
    // schools 2 and 3: two teachers alternating
    for (const [sectionId, t1, t2] of [[201, 17, 18], [301, 19, 20]] as const) {
      for (let p = 1; p <= 6; p++) {
        db.timetable.push({ id: next(), section_id: sectionId, day, period: p, subject_id: p % 2 === 1 ? 1 : 2, teacher_id: p % 2 === 1 ? t1 : t2 });
      }
    }
  }

  // homework
  const yesterday = addDays(today, -1);
  const hw1 = next();
  db.homework.push({ id: hw1, section_id: 102, subject_id: 2, teacher_id: 10, title: 'تمارين الكسور العشرية ص ٤٢', details: 'حلّ التمارين من ١ إلى ٦ في الدفتر.', book_page: '٤٢', due_date: addDays(today, 3), created_at: at(yesterday, '08:05'), client_id: null });
  const hw2 = next();
  db.homework.push({ id: hw2, section_id: 102, subject_id: 1, teacher_id: 13, title: 'قراءة نصّ «الوطن» والإجابة عن الأسئلة', details: 'الإجابة عن أسئلة الفهم في نهاية النصّ.', book_page: '٥٨', due_date: addDays(today, 4), created_at: at(addDays(today, -2), '10:20'), client_id: null });
  const hw3 = next();
  db.homework.push({ id: hw3, section_id: 101, subject_id: 2, teacher_id: 10, title: 'تمارين الكسور العادية ص ٣٨', details: null, book_page: '٣٨', due_date: addDays(today, 2), created_at: at(addDays(today, -2), '09:10'), client_id: null });
  const hw4 = next();
  db.homework.push({ id: hw4, section_id: 103, subject_id: 3, teacher_id: 12, title: 'نشاط «دورة الماء في الطبيعة»', details: 'رسم مخطّط دورة الماء وكتابة فقرة عنه.', book_page: '٢٧', due_date: addDays(today, 5), created_at: at(yesterday, '11:30'), client_id: null });
  const sec5b = db.students.filter((s) => s.section_id === 102);
  const sec5a = db.students.filter((s) => s.section_id === 101);
  [0, 3, 4, 6].forEach((i) => db.submissions.push({ id: next(), homework_id: hw1, student_id: sec5b[i].id, status: 'done', submitted_at: at(yesterday, i === 0 ? '20:10' : '18:45') }));
  [1, 2, 5].forEach((i) => db.submissions.push({ id: next(), homework_id: hw2, student_id: sec5b[i].id, status: 'done', submitted_at: at(yesterday, '19:00') }));
  [0, 1, 2, 3, 4, 7].forEach((i) => db.submissions.push({ id: next(), homework_id: hw3, student_id: sec5a[i].id, status: 'done', submitted_at: at(yesterday, '17:30') }));

  // attendance: the last 5 school days (~94 % present), كرم رامي absent 3 consecutive days
  const karam = sec5b[8];
  const pastDays = schoolDaysBefore(today, 5);
  const recordedSections = [101, 102, 103, 301];
  pastDays.forEach((date, di) => {
    const w = dayIndex(date);
    for (const sectionId of recordedSections) {
      const rows = db.timetable.filter((t) => t.section_id === sectionId && t.day === w);
      for (const st of db.students.filter((s) => s.section_id === sectionId)) {
        const dayHash = (st.id * 131 + di * 17) % 100;
        const absentAllDay = dayHash < 5 || (st.id === karam.id && di >= 3);
        for (const row of rows) {
          const pHash = (st.id * 7 + row.period * 13 + di * 3) % 100;
          const status: AttStatus = absentAllDay ? 'absent' : pHash < 2 ? 'late' : 'present';
          db.attendance.push({ id: next(), student_id: st.id, date, period: row.period, status, recorded_by: row.teacher_id, confirmed: 1, created_at: at(date, `${String(7 + row.period).padStart(2, '0')}:35`) });
        }
      }
    }
  });
  // today: period 1 recorded for school 1 and school 3 (school 2 has not uploaded yet)
  const todayW = dayIndex(today);
  if (todayW <= 4) {
    for (const sectionId of recordedSections) {
      const row = db.timetable.find((t) => t.section_id === sectionId && t.day === todayW && t.period === 1);
      if (!row) continue;
      for (const st of db.students.filter((s) => s.section_id === sectionId)) {
        const status: AttStatus = st.id === karam.id ? 'absent' : st.id === sec5b[11].id ? 'late' : 'present';
        db.attendance.push({ id: next(), student_id: st.id, date: today, period: 1, status, recorded_by: row.teacher_id, confirmed: 0, created_at: at(today, sectionId === 301 ? '07:40' : '07:35') });
      }
    }
  }

  // announcements
  const ann1 = next();
  db.announcements.push({ id: ann1, school_id: 1, title: 'اجتماع أولياء الأمور', body: 'يُعقد اجتماع أولياء أمور الصف الخامس يوم الثلاثاء القادم الساعة العاشرة صباحاً في قاعة المدرسة.', urgent: 0, created_by: 2, created_at: at(addDays(today, -2), '12:15'), notified: 0 });
  const circ1 = next();
  db.announcements.push({ id: circ1, school_id: null, title: 'مواعيد امتحانات الفصل الأول', body: 'تبدأ امتحانات الفصل الأول يوم الأحد ٢١ كانون الأول، وتُرسل الجداول التفصيلية إلى المدارس قبل أسبوع.', urgent: 0, created_by: 1, created_at: at(addDays(today, -3), '09:00'), notified: 3 });

  db.seq = seq;
  const notify = (user_id: number, kind: string, body: string, link: string | null, created_at: string, sms = 0, read = false) => {
    db.notifications.push({ id: db.seq++, user_id, kind, body, link, sms, created_at, read_at: read ? created_at : null });
  };
  // circular to the school accounts
  for (const s of db.users.filter((u) => u.role === 'school')) notify(s.id, 'circular', 'تعميم من مديرية التربية: مواعيد امتحانات الفصل الأول', '/notifications', at(addDays(today, -3), '09:00'), 0, s.id !== 2);
  // announcement to the parents of school 1
  for (const g of guardiansOfSchool(db, 1)) notify(g, 'announcement', 'اجتماع أولياء الأمور: يُعقد اجتماع أولياء أمور الصف الخامس يوم الثلاثاء القادم الساعة العاشرة صباحاً.', '/notifications', at(addDays(today, -2), '12:15'), 0, true);
  // homework notification for الخامس (ب)
  for (const st of sec5b) {
    notify(st.user_id, 'homework', `واجب جديد في الرياضيات: تمارين الكسور العشرية ص ٤٢ — التسليم ${fmtDate(addDays(today, 3))}`, '/student', at(yesterday, '08:05'));
    if (st.guardian_user_id) notify(st.guardian_user_id, 'homework', `واجب جديد في الرياضيات ${li(firstName(db.users.find((u) => u.id === st.user_id)!.name))}: تمارين الكسور العشرية ص ٤٢ — التسليم ${fmtDate(addDays(today, 3))}`, '/parent', at(yesterday, '08:05'));
  }
  // absence notifications of كرم's guardian for the past days
  if (karam.guardian_user_id) {
    for (const d of pastDays.slice(3)) notify(karam.guardian_user_id, 'absence', `غياب ${firstName(NAMES_5B[8])} يوم ${fmtDate(d)}`, '/parent', at(d, '08:20'), 1, true);
    if (todayW <= 4) notify(karam.guardian_user_id, 'absence', `غياب ${firstName(NAMES_5B[8])} عن الحصّة الأولى اليوم`, '/parent', at(today, '07:36'));
  }
  // a message from the demo parent to the maths teacher, yesterday
  const khaled = db.users.find((u) => u.code === 'P-KHALED')!;
  db.messages.push({ id: db.seq++, from_user: khaled.id, to_user: 10, body: 'أستاذ سامر، هل يمكن تأجيل تسليم واجب الرياضيات يوماً واحداً لظرف عائلي؟', created_at: at(yesterday, '19:20'), read_at: null });
  notify(10, 'message', 'رسالة جديدة من خالد: أستاذ سامر، هل يمكن تأجيل تسليم واجب الرياضيات يوماً واحداً لظرف عائلي؟', '/messages', at(yesterday, '19:20'));
  // رنا سعيد absent today, engine run
  const absence: Abs = { id: db.seq++, teacher_id: 11, date: today, reason: 'مرض', reported_by: 11, created_at: at(today, '06:45') };
  db.absences.push(absence);
  const affected = runEngine(db, absence);
  notify(2, 'alert', `غياب أ. رنا سعيد اليوم: ${periodsNeedCover(affected.length)}`, '/school/absences', at(today, '06:46'));

  // the directorate's morning: the same kinds and links the server emits (no_attendance / uncovered / three_days)
  if (todayW <= 4) {
    const link = (id: number) => `/directorate/school/${id}?date=${today}`;
    for (const s of db.schools) {
      const abs = dayAbsences(db, s, today, today);
      const cov = coverageOf(abs);
      if (cov.uncovered) notify(1, 'uncovered', `${s.name}: ${count(cov.uncovered, NOUNS.period)} من دون تغطية اليوم (غياب ${abs.map((a) => `أ. ${a.teacher}`).join(' و')})`, link(s.id), at(today, s.id === 1 ? '06:46' : '07:50'));
      for (const t of dayThreeDays(db, s, today)) notify(1, 'three_days', `غياب ${t.student} (${t.section}) ${consecutiveDays(t.days)} — ${s.name}`, link(s.id), at(today, '08:05'));
      if (!dayFigures(db, s, today, today).uploaded) notify(1, 'no_attendance', `لم يُرفع حضور ${s.name} حتى الساعة ${fmtClock('08:30')}`, link(s.id), at(today, '08:30'));
    }
  }

  return db;
}

function guardiansOfSchool(db: DB, schoolId: number): number[] {
  const ids = new Set<number>();
  for (const st of db.students) {
    const sec = db.sections.find((s) => s.id === st.section_id);
    if (sec?.school_id === schoolId && st.guardian_user_id) ids.add(st.guardian_user_id);
  }
  return [...ids];
}

function periodsNeedCover(n: number): string {
  if (n === 0) return 'لا حصص تحتاج تغطية';
  if (n === 1) return 'حصّة واحدة تحتاج تغطية';
  if (n === 2) return 'حصّتان تحتاجان تغطية';
  return `${count(n, NOUNS.period)} تحتاج تغطية`;
}

/* ───────────────────────── substitute engine (§6, simplified) ───────────────────────── */

function weekStart(date: string): string {
  const w = dayIndex(date); // 0 = Sunday
  return addDays(date, -w);
}

function rankCandidates(db: DB, row: Timetable, absence: Abs): { candidates: Candidate[]; note: string | null } {
  const absent = db.users.find((u) => u.id === absence.teacher_id)!;
  const absentToday = new Set(db.absences.filter((a) => a.date === absence.date).map((a) => a.teacher_id));
  const busy = new Set(db.timetable.filter((t) => t.day === row.day && t.period === row.period).map((t) => t.teacher_id));
  const assigned = new Set(
    db.substitutions
      .filter((s) => {
        const a = db.absences.find((x) => x.id === s.absence_id);
        const t = db.timetable.find((x) => x.id === s.timetable_id);
        return a && t && a.date === absence.date && t.period === row.period && s.status === 'approved' && s.substitute_teacher_id;
      })
      .map((s) => s.substitute_teacher_id as number),
  );
  const sectionTeachers = new Set(db.timetable.filter((t) => t.section_id === row.section_id).map((t) => t.teacher_id));
  const month = absence.date.slice(0, 7);
  const ws = weekStart(absence.date);
  const we = addDays(ws, 6);
  const weekly = (id: number) => db.timetable.filter((t) => t.teacher_id === id).length;
  const subsIn = (id: number, from: string, to: string) =>
    db.substitutions.filter((s) => {
      if (s.substitute_teacher_id !== id || s.status !== 'approved') return false;
      const a = db.absences.find((x) => x.id === s.absence_id);
      return !!a && a.date >= from && a.date <= to;
    }).length;
  const monthSubs = (id: number) => subsIn(id, `${month}-01`, `${month}-31`);
  const weekSubs = (id: number) => subsIn(id, ws, we);
  const ranked = db.users
    .filter((u) => u.role === 'teacher' && u.school_id === absent.school_id && u.id !== absent.id)
    .filter((u) => !busy.has(u.id) && !absentToday.has(u.id) && !assigned.has(u.id))
    .filter((u) => weekly(u.id) + weekSubs(u.id) < WEEKLY_CAP)
    .map((u) => ({ u, tier: u.subject_id === row.subject_id ? 1 : sectionTeachers.has(u.id) ? 2 : 3, ms: monthSubs(u.id), wp: weekly(u.id) }))
    .sort((a, b) => a.tier - b.tier || a.ms - b.ms || a.wp - b.wp || a.u.name.localeCompare(b.u.name, 'ar'));
  const candidates = ranked.slice(0, 3).map((c) => ({
    teacher_id: c.u.id,
    name: c.u.name,
    subject: subjectName(db, c.u.subject_id),
    tier: c.tier,
    reason: c.tier === 1 ? 'المادّة نفسها · حصّة فراغ' : c.tier === 2 ? 'من معلّمي الشعبة · حصّة فراغ' : 'حصّة فراغ',
  }));
  // No teacher of the same subject is free: say so, as the server does, so the school knows why the chips look odd.
  const note = candidates.length && candidates.every((c) => c.tier !== 1) ? ENGINE_NOTE : null;
  return { candidates, note };
}
const ENGINE_NOTE = 'لا معلّم للمادّة نفسها متاحاً في هذه الحصّة، فاقتُرح معلّمون من مواد أخرى';

function runEngine(db: DB, absence: Abs): AffectedPeriod[] {
  const day = dayIndex(absence.date);
  const rows = db.timetable.filter((t) => t.teacher_id === absence.teacher_id && t.day === day).sort((a, b) => a.period - b.period);
  const out: AffectedPeriod[] = [];
  for (const row of rows) {
    let subst = db.substitutions.find((s) => s.absence_id === absence.id && s.timetable_id === row.id);
    if (!subst) {
      const { candidates, note } = rankCandidates(db, row, absence);
      subst = { id: db.seq++, absence_id: absence.id, timetable_id: row.id, substitute_teacher_id: candidates[0]?.teacher_id ?? null, status: 'suggested', candidates, note, lesson_note: null, approved_by: null, approved_at: null };
      db.substitutions.push(subst);
    }
    out.push({ substitution_id: subst.id, period: row.period, section_label: sectionLabel(db, row.section_id), subject: subjectName(db, row.subject_id), candidates: subst.candidates, note: subst.note ?? null });
  }
  return out;
}

/* ───────────────────────── helpers ───────────────────────── */

function subjectName(db: DB, id: number | null): string {
  return db.subjects.find((s) => s.id === id)?.name ?? '';
}
function sectionLabel(db: DB, id: number): string {
  return db.sections.find((s) => s.id === id)?.label ?? '';
}
function userById(db: DB, id: number | null | undefined): DbUser | undefined {
  return db.users.find((u) => u.id === id);
}
function schoolName(db: DB, id: number | null): string | null {
  return db.schools.find((s) => s.id === id)?.name ?? null;
}
function dayWord(date: string, today: string): string {
  if (date === today) return 'اليوم';
  if (date === addDays(today, 1)) return 'غداً';
  return `يوم ${fmtDate(date)}`;
}
function timeHM(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Damascus', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

function timetableRows(db: DB, rows: Timetable[], today: string): TimetableRow[] {
  return rows
    .slice()
    .sort((a, b) => a.day - b.day || a.period - b.period)
    .map((t) => {
      const subst = db.substitutions.find((s) => {
        if (s.timetable_id !== t.id || (s.status !== 'approved' && s.status !== 'self_study')) return false;
        const a = db.absences.find((x) => x.id === s.absence_id);
        return a?.date === today;
      });
      return {
        id: t.id, day: t.day, period: t.period,
        subject: subjectName(db, t.subject_id), subject_id: t.subject_id,
        teacher: userById(db, t.teacher_id)?.name ?? '', teacher_id: t.teacher_id,
        section_id: t.section_id, section_label: sectionLabel(db, t.section_id),
        substitute: subst ? { teacher: subst.status === 'approved' ? userById(db, subst.substitute_teacher_id)?.name ?? null : null, status: subst.status } : null,
      };
    });
}

function studentOf(db: DB, uid: number): Student | undefined {
  return db.students.find((s) => s.user_id === uid);
}
function teacherSections(db: DB, uid: number): Section[] {
  const ids = new Set(db.timetable.filter((t) => t.teacher_id === uid).map((t) => t.section_id));
  return db.sections.filter((s) => ids.has(s.id));
}
function homeworkCounts(db: DB, hw: Hw) {
  const students = db.students.filter((s) => s.section_id === hw.section_id);
  const submitted = db.submissions.filter((x) => x.homework_id === hw.id && students.some((s) => s.id === x.student_id)).length;
  return { submitted_count: submitted, student_count: students.length };
}
function homeworkSummary(db: DB, hw: Hw) {
  return {
    id: hw.id, section_id: hw.section_id, section_label: sectionLabel(db, hw.section_id), subject_id: hw.subject_id, subject: subjectName(db, hw.subject_id),
    teacher_id: hw.teacher_id, teacher: userById(db, hw.teacher_id)?.name ?? '', title: hw.title, details: hw.details, book_page: hw.book_page,
    due_date: hw.due_date, created_at: hw.created_at, ...homeworkCounts(db, hw),
  };
}
function studentHomework(db: DB, st: Student, withinDays: number | null) {
  const today = todayISO();
  return db.homework
    .filter((h) => h.section_id === st.section_id)
    .filter((h) => h.due_date >= addDays(today, -1) && (withinDays === null || h.due_date <= addDays(today, withinDays)))
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id)
    .map((h) => ({ id: h.id, title: h.title, subject: subjectName(db, h.subject_id), book_page: h.book_page, due_date: h.due_date, done: db.submissions.some((s) => s.homework_id === h.id && s.student_id === st.id) }));
}
function notificationsOf(db: DB, uid: number, limit = 50): Notification[] {
  return db.notifications
    .filter((n) => n.user_id === uid)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
    .slice(0, limit)
    .map(({ id, kind, body, link, created_at, read_at }) => ({ id, kind, body, link, created_at, read_at }));
}
function pushNotification(db: DB, user_id: number, kind: string, body: string, link: string | null, sms = 0) {
  db.notifications.push({ id: db.seq++, user_id, kind, body, link, sms, created_at: nowISO(), read_at: null });
  if (sms) console.info('[SMS]', userById(db, user_id)?.phone ?? '—', body);
}

/** Attendance summary of one school on a date (period-1 or earliest record per student). */
function schoolAttendance(db: DB, schoolId: number, date: string) {
  const sections = db.sections.filter((s) => s.school_id === schoolId);
  const students = db.students.filter((s) => sections.some((x) => x.id === s.section_id));
  let present = 0, recorded = 0, late = 0, confirmed = false;
  let uploaded_at: string | null = null;
  const byGrade = new Map<number, { present: number; recorded: number; total: number }>();
  for (const st of students) {
    const sec = sections.find((x) => x.id === st.section_id)!;
    const g = byGrade.get(sec.grade) ?? { present: 0, recorded: 0, total: 0 };
    g.total++;
    const recs = db.attendance.filter((a) => a.student_id === st.id && a.date === date).sort((a, b) => a.period - b.period);
    if (recs.length) {
      recorded++;
      g.recorded++;
      if (recs[0].status !== 'absent') { present++; g.present++; }
      if (recs[0].status === 'late') late++;
      for (const r of recs) {
        if (r.confirmed) confirmed = true;
        if (uploaded_at === null || r.created_at < uploaded_at) uploaded_at = r.created_at;
      }
    }
    byGrade.set(sec.grade, g);
  }
  const attendance_by_grade = [...byGrade.entries()].sort((a, b) => a[0] - b[0]).map(([grade, g]) => ({ grade, pct: g.recorded ? Math.round((g.present / g.recorded) * 100) : 0 }));
  return { students: students.length, present, recorded, late, confirmed, uploaded_at, present_pct: recorded ? Math.round((present / recorded) * 100) : 0, attendance_by_grade, uploaded: recorded > 0 };
}

function schoolCoverage(db: DB, schoolId: number, date: string) {
  const subs = db.substitutions.filter((s) => {
    const a = db.absences.find((x) => x.id === s.absence_id);
    const t = userById(db, a?.teacher_id);
    return a?.date === date && t?.school_id === schoolId;
  });
  const covered = subs.filter((s) => s.status === 'approved' || s.status === 'self_study').length;
  return { total: subs.length, covered, uncovered: subs.length - covered, pct: subs.length ? Math.round((covered / subs.length) * 100) : 100 };
}

function threeDayAbsences(db: DB, today: string) {
  const out: { student_name: string; school: string; days: number; school_id: number; section_label: string }[] = [];
  const days = [...schoolDaysBefore(today, 10), today].filter((d) => db.attendance.some((a) => a.date === d));
  for (const st of db.students) {
    let run = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const recs = db.attendance.filter((a) => a.student_id === st.id && a.date === days[i]);
      if (recs.length && recs.every((r) => r.status === 'absent')) run++;
      else break;
    }
    if (run >= 3) {
      const sec = db.sections.find((s) => s.id === st.section_id)!;
      out.push({ student_name: userById(db, st.user_id)?.name ?? '', school: schoolName(db, sec.school_id) ?? '', days: run, school_id: sec.school_id, section_label: sec.label });
    }
  }
  return out;
}

/* ───────────────────────── directorate figures ─────────────────────────
   Ten schools of the Daraa directorate. Schools 1–3 carry real rows (sections, pupils, timetable, attendance,
   substitutions); their sample is scaled to the official enrolment so the directorate's figures agree with each
   school's own dashboard percentages. Schools 4–10 get deterministic figures from a hash of (school, date) so the
   demo is stable across reloads and still differs from day to day. */

const DIR_SCHOOLS: Omit<School, 'shifts'>[] = [
  { id: 1, name: 'مدرسة درعا النموذجية', complex: 'درعا المدينة', principal: 'محمود الحريري', phone: '0933412870', enrolment: 412, teachers_n: 28 },
  { id: 2, name: 'مدرسة إزرع الأولى', complex: 'إزرع', principal: 'سميرة الزعبي', phone: '0944228513', enrolment: 538, teachers_n: 34 },
  { id: 3, name: 'مدرسة طفس الثانية', complex: 'طفس', principal: 'أيمن المسالمة', phone: '0955317264', enrolment: 296, teachers_n: 21 },
  { id: 4, name: 'مدرسة الصنمين للتعليم الأساسي', complex: 'الصنمين', principal: 'رائد أبازيد', phone: '0933560192', enrolment: 475, teachers_n: 31 },
  { id: 5, name: 'مدرسة نوى الغربية', complex: 'نوى', principal: 'هناء الرفاعي', phone: '0944873015', enrolment: 362, teachers_n: 24 },
  { id: 6, name: 'مدرسة جاسم المختلطة', complex: 'جاسم', principal: 'باسل العودات', phone: '0932147689', enrolment: 241, teachers_n: 18 },
  { id: 7, name: 'مدرسة الحراك الأولى', complex: 'الحراك', principal: 'منال المحاميد', phone: '0945692038', enrolment: 507, teachers_n: 33 },
  { id: 8, name: 'مدرسة بصرى الشام للبنات', complex: 'بصرى الشام', principal: 'ندى الجباوي', phone: '0956104372', enrolment: 388, teachers_n: 26 },
  { id: 9, name: 'مدرسة داعل الشرقية', complex: 'داعل', principal: 'فراس القداح', phone: '0938751426', enrolment: 329, teachers_n: 22 },
  { id: 10, name: 'مدرسة الشيخ مسكين الثانية', complex: 'الشيخ مسكين', principal: 'عماد الصبيحي', phone: '0947305918', enrolment: 456, teachers_n: 30 },
];
const BASE_PCT: Record<number, number> = { 1: 94, 2: 91, 3: 93, 4: 93, 5: 89, 6: 95, 7: 91, 8: 96, 9: 87, 10: 92 };
const SYNTH_TEACHERS = ['أحمد الخطيب', 'سعاد العلي', 'محمد الحمد', 'رنا جمعة', 'خالد العمر', 'هدى الشامي', 'عمر سليمان', 'لمى الأحمد', 'يوسف درويش', 'منى حسين', 'طارق عيسى', 'نهى زيدان'];
const SYNTH_SECTIONS = ['الرابع (أ)', 'الرابع (ب)', 'الخامس (أ)', 'الخامس (ب)', 'السادس (أ)', 'السادس (ب)', 'الثالث (أ)', 'الثاني (ب)'];
const SYNTH_THREE_DAYS: Record<number, { student: string; section: string; days: number }[]> = {
  5: [{ student: 'سالم حمدان', section: 'الرابع (ب)', days: 3 }],
  8: [{ student: 'ريما العقلة', section: 'الخامس (أ)', days: 4 }, { student: 'جنى المقداد', section: 'الثالث (أ)', days: 3 }],
};

function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Deterministic pseudo-random number in [0, 1) for a key. */
function rnd(...key: (string | number)[]): number {
  return (hash32(key.join('|')) % 100003) / 100003;
}
function isSchoolDay(date: string): boolean { return dayIndex(date) <= 4; }
function validDate(v: string | null): string | null { return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }
/** Schools with sections and pupils in the demo database. */
function liveSchool(d: DB, schoolId: number): boolean { return d.sections.some((x) => x.school_id === schoolId); }

interface DayFigures { uploaded: boolean; uploaded_at: string | null; confirmed: boolean; students: number; present: number; late: number; absent: number; pct: number | null }

function dayFigures(d: DB, s: School, date: string, today: string): DayFigures {
  const students = s.enrolment;
  const none: DayFigures = { uploaded: false, uploaded_at: null, confirmed: false, students, present: 0, late: 0, absent: 0, pct: null };
  if (!isSchoolDay(date) || date > today) return none;
  // The demo school (SCH-1) shows its real rows, scaled to its enrolment; the other two live schools have too small a
  // sample to look like a school (eight pupils → «١٠٠٪»), so they use the synthetic figures, except that إزرع (SCH-2)
  // has not uploaded today, as its own dashboard shows.
  if (s.id === 1 && liveSchool(d, s.id)) {
    const att = schoolAttendance(d, s.id, date);
    if (att.uploaded) {
      const presentAll = Math.round((students * att.present_pct) / 100);
      const late = Math.min(presentAll, Math.round((students * att.late) / Math.max(1, att.recorded)));
      return { uploaded: true, uploaded_at: att.uploaded_at, confirmed: att.confirmed, students, present: presentAll - late, late, absent: students - presentAll, pct: att.present_pct };
    }
    if (date === today) return none; // the live school shows its real state today: nothing uploaded yet
  }
  if (s.id === 2 && date === today && !schoolAttendance(d, s.id, date).uploaded) return none;
  const uploaded = date === today ? s.id !== 7 : rnd(s.id, date, 'up') > 0.07;
  if (!uploaded) return none;
  const pct = Math.max(80, Math.min(99, (BASE_PCT[s.id] ?? 92) + Math.round((rnd(s.id, date, 'pct') - 0.5) * 8)));
  const presentAll = Math.round((students * pct) / 100);
  const late = Math.round(students * (0.01 + rnd(s.id, date, 'late') * 0.02));
  const minutes = 25 + Math.floor(rnd(s.id, date, 'time') * 70);
  const uploaded_at = at(date, `${String(7 + Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  return { uploaded: true, uploaded_at, confirmed: rnd(s.id, date, 'conf') > 0.35, students, present: presentAll - late, late, absent: students - presentAll, pct };
}

/** Teacher absences of one school on a date with each affected period's status. */
function dayAbsences(d: DB, s: School, date: string, today: string): DirectorateAbsence[] {
  if (!isSchoolDay(date) || date > today) return [];
  if (liveSchool(d, s.id)) {
    const teachers = d.users.filter((u) => u.role === 'teacher' && u.school_id === s.id);
    return d.absences.filter((a) => a.date === date && teachers.some((t) => t.id === a.teacher_id)).map((a) => {
      const t = userById(d, a.teacher_id)!;
      const periods: DirectoratePeriod[] = d.substitutions.filter((x) => x.absence_id === a.id).map((x) => {
        const row = d.timetable.find((r) => r.id === x.timetable_id)!;
        const status: DirectoratePeriodStatus = x.status === 'suggested' ? (x.candidates.length ? 'pending' : 'uncovered') : x.status;
        const substitute = x.status === 'approved' ? userById(d, x.substitute_teacher_id)?.name ?? null : status === 'pending' ? x.candidates[0]?.name ?? null : null;
        return { period: row.period, section: sectionLabel(d, row.section_id), subject: subjectName(d, row.subject_id), status, substitute, lesson_note: x.lesson_note };
      }).sort((x, y) => x.period - y.period);
      return { teacher: t.name, subject: subjectName(d, t.subject_id), reason: a.reason, periods };
    });
  }
  const r = rnd(s.id, date, 'abs');
  const n = r < 0.4 ? 0 : r < 0.85 ? 1 : 2;
  const out: DirectorateAbsence[] = [];
  for (let k = 0; k < n; k++) {
    const ti = (Math.floor(rnd(s.id, date, 'teacher', k) * SYNTH_TEACHERS.length) + s.id * 3 + k * 5) % SYNTH_TEACHERS.length;
    const subject = SUBJECTS[Math.floor(rnd(s.id, date, 'subject', k) * SUBJECTS.length)];
    const nPeriods = 2 + Math.floor(rnd(s.id, date, 'periods', k) * 3);
    const used = new Set<number>();
    const periods: DirectoratePeriod[] = [];
    for (let p = 0; p < nPeriods; p++) {
      let period = 1 + Math.floor(rnd(s.id, date, 'period', k, p) * 6);
      while (used.has(period)) period = (period % 6) + 1;
      used.add(period);
      const sr = rnd(s.id, date, 'status', k, p);
      const status: DirectoratePeriodStatus = sr < 0.5 ? 'approved' : sr < 0.65 ? 'self_study' : sr < 0.85 ? 'pending' : 'uncovered';
      const substitute = status === 'approved' || status === 'pending' ? SYNTH_TEACHERS[(ti + 4 + p) % SYNTH_TEACHERS.length] : null;
      periods.push({ period, section: SYNTH_SECTIONS[Math.floor(rnd(s.id, date, 'section', k, p) * SYNTH_SECTIONS.length)], subject, status, substitute, lesson_note: status === 'self_study' ? 'مراجعة الدرس السابق وحلّ تمارينه' : null });
    }
    periods.sort((x, y) => x.period - y.period);
    out.push({ teacher: SYNTH_TEACHERS[ti], subject, reason: rnd(s.id, date, 'reason', k) < 0.6 ? 'مرض' : null, periods });
  }
  return out;
}

function coverageOf(abs: DirectorateAbsence[]) {
  let total = 0, covered = 0, approved = 0, self_study = 0;
  for (const a of abs) for (const p of a.periods) {
    total++;
    if (p.status === 'approved') { approved++; covered++; }
    if (p.status === 'self_study') { self_study++; covered++; }
  }
  return { total, covered, uncovered: total - covered, approved, self_study, pct: total ? Math.round((covered / total) * 100) : 100 };
}

function dayThreeDays(d: DB, s: School, date: string): { student: string; section: string; days: number }[] {
  if (!isSchoolDay(date)) return [];
  if (liveSchool(d, s.id)) return threeDayAbsences(d, date).filter((t) => t.school_id === s.id).map((t) => ({ student: t.student_name, section: t.section_label, days: t.days }));
  return SYNTH_THREE_DAYS[s.id] ?? [];
}

function dirSchoolRow(d: DB, s: School, date: string, today: string) {
  const fig = dayFigures(d, s, date, today);
  const abs = dayAbsences(d, s, date, today);
  const cov = coverageOf(abs);
  const three = dayThreeDays(d, s, date);
  const homework_today = liveSchool(d, s.id)
    ? d.homework.filter((h) => h.created_at.slice(0, 10) === date && d.sections.find((x) => x.id === h.section_id)?.school_id === s.id).length
    : fig.uploaded ? Math.floor(rnd(s.id, date, 'hw') * 7) : 0;
  const row: DirectorateSchool = {
    id: s.id, name: s.name, complex: s.complex, students: s.enrolment, present_pct: fig.pct, attendance_uploaded: fig.uploaded,
    uncovered_periods: cov.uncovered, coverage_pct: cov.pct, homework_today,
    principal: s.principal, phone: s.phone, uploaded_at: fig.uploaded_at, three_days: three.length, teachers: s.teachers_n, teachers_present: Math.max(0, s.teachers_n - abs.length),
  };
  return { row, fig, abs, cov, three };
}

function schoolDayView(d: DB, s: School, date: string, today: string): DirectorateSchoolDay {
  const fig = dayFigures(d, s, date, today);
  const abs = dayAbsences(d, s, date, today);
  const trendDays = isSchoolDay(date) ? [...schoolDaysBefore(date, 6), date] : schoolDaysBefore(date, 7);
  return {
    school: { id: s.id, name: s.name, complex: s.complex, principal: s.principal, phone: s.phone, students: s.enrolment, teachers: s.teachers_n },
    day: { attendance_pct: fig.pct, present: fig.present, absent: fig.absent, late: fig.late, uploaded_at: fig.uploaded_at, confirmed: fig.confirmed },
    absences: abs,
    uncovered: abs.flatMap((a) => a.periods.filter((p) => p.status === 'pending' || p.status === 'uncovered').map((p) => ({ period: p.period, section: p.section, subject: p.subject ?? a.subject }))).sort((x, y) => x.period - y.period),
    three_days: dayThreeDays(d, s, date),
    trend: trendDays.map((x) => ({ date: x, attendance_pct: dayFigures(d, s, x, today).pct })),
  };
}

function weeklyReport(d: DB, week: string, today: string): DirectorateWeeklyReport {
  const from = week, to = addDays(week, 4);
  const days = [0, 1, 2, 3, 4].map((i) => addDays(week, i)).filter((x) => x <= today);
  const last = days[days.length - 1];
  const schools: DirectorateWeeklyRow[] = d.schools.map((s) => {
    let days_uploaded = 0, pctSum = 0, absences = 0, substitutions_approved = 0, self_study = 0, uncovered = 0;
    for (const x of days) {
      const fig = dayFigures(d, s, x, today);
      if (fig.uploaded && fig.pct !== null) { days_uploaded++; pctSum += fig.pct; }
      const abs = dayAbsences(d, s, x, today);
      const cov = coverageOf(abs);
      absences += abs.length; substitutions_approved += cov.approved; self_study += cov.self_study; uncovered += cov.uncovered;
    }
    return { id: s.id, name: s.name, complex: s.complex, students: s.enrolment, attendance_avg_pct: days_uploaded ? Math.round(pctSum / days_uploaded) : null, days_uploaded, absences, substitutions_approved, self_study, uncovered, three_days: last ? dayThreeDays(d, s, last).length : 0 };
  });
  const withPct = schools.filter((x) => x.attendance_avg_pct !== null);
  const sum = (k: 'days_uploaded' | 'absences' | 'substitutions_approved' | 'self_study' | 'uncovered' | 'three_days') => schools.reduce((a, x) => a + x[k], 0);
  return {
    from, to, school_days: days.length, schools,
    totals: { attendance_avg_pct: withPct.length ? Math.round(withPct.reduce((a, x) => a + (x.attendance_avg_pct ?? 0), 0) / withPct.length) : null, days_uploaded: sum('days_uploaded'), absences: sum('absences'), substitutions_approved: sum('substitutions_approved'), self_study: sum('self_study'), uncovered: sum('uncovered'), three_days: sum('three_days') },
  };
}

/* ───────────────────────── state ───────────────────────── */

let db: DB | null = null;

function load(): DB {
  const today = todayISO();
  if (db && db.seed_date === today && db.version === VERSION) return db;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === VERSION && parsed.seed_date === today) {
        db = parsed;
        return db;
      }
    }
  } catch { /* ignore */ }
  db = seed(today);
  save();
  return db;
}

function save() {
  if (!db) return;
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* quota or private mode */ }
}

/** Forget everything done in this demo session and start from the seed again. */
export function resetMock() {
  db = null;
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function isMockToken(token: string | null | undefined): boolean {
  return !!token && token.startsWith(TOKEN_PREFIX);
}

function authUser(d: DB, token: string | null | undefined): DbUser {
  if (!token || !token.startsWith(TOKEN_PREFIX)) throw new ApiError(401, 'انتهت الجلسة، يلزم تسجيل الدخول مجدّداً');
  const uid = Number(token.slice(TOKEN_PREFIX.length).split('.')[0]);
  const u = d.users.find((x) => x.id === uid);
  if (!u) throw new ApiError(401, 'انتهت الجلسة، يلزم تسجيل الدخول مجدّداً');
  return u;
}

function publicUser(d: DB, u: DbUser): User {
  return { id: u.id, role: u.role, name: u.name, school_id: u.school_id, school_name: schoolName(d, u.school_id), subject: subjectName(d, u.subject_id) || null };
}

function contextOf(d: DB, u: DbUser): Context {
  switch (u.role) {
    case 'teacher':
      return { sections: teacherSections(d, u.id).map(({ id, grade, label }) => ({ id, grade, label })), subject: subjectName(d, u.subject_id) || null };
    case 'student': {
      const st = studentOf(d, u.id);
      const sec = d.sections.find((s) => s.id === st?.section_id);
      return { section: sec ? { id: sec.id, grade: sec.grade, label: sec.label } : { id: 0, grade: 0, label: '' }, school_name: schoolName(d, u.school_id) ?? '' };
    }
    case 'parent':
      return {
        children: d.students.filter((s) => s.guardian_user_id === u.id).map((s) => {
          const sec = d.sections.find((x) => x.id === s.section_id)!;
          return { student_id: s.id, name: userById(d, s.user_id)?.name ?? '', section_label: sec.label, section_id: sec.id, school_name: schoolName(d, sec.school_id) ?? '' };
        }),
      };
    case 'school': {
      const s = d.schools.find((x) => x.id === u.school_id)!;
      return { school: { id: s.id, name: s.name, complex: s.complex } };
    }
    default:
      return { schools: d.schools.map(({ id, name, complex }) => ({ id, name, complex })) };
  }
}

function requireRole(u: DbUser, ...roles: Role[]) {
  if (!roles.includes(u.role)) throw new ApiError(403, 'لا تملك صلاحية هذه العملية');
}

function bodyOf(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/* ───────────────────────── request router ───────────────────────── */

export async function mockRequest(method: string, url: string, body?: unknown, token?: string | null): Promise<MockResponse> {
  await new Promise((r) => setTimeout(r, 40 + Math.random() * 80));
  const d = load();
  const u = new URL(url, 'http://mock.local');
  const path = u.pathname.replace(/\/+$/, '');
  const q = u.searchParams;
  const today = todayISO();
  const m = method.toUpperCase();
  try {
    const result = route(d, m, path, q, bodyOf(body), token ?? null, today);
    if (m !== 'GET') save();
    return result;
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, body: { error: e.message } };
    console.error('[mock]', e);
    return { status: 500, body: { error: 'خطأ غير متوقّع في البيانات التجريبية' } };
  }
}

function route(d: DB, m: string, path: string, q: URLSearchParams, b: Record<string, unknown>, token: string | null, today: string): MockResponse {
  const ok = (body: unknown): MockResponse => ({ status: 200, body });

  if (m === 'POST' && path === '/api/login') {
    const code = String(b.code ?? '').trim().toUpperCase();
    const user = d.users.find((x) => x.code.toUpperCase() === code);
    if (!user) throw new ApiError(401, 'رمز الدخول غير صحيح');
    return ok({ token: `${TOKEN_PREFIX}${user.id}.${user.role}`, user: publicUser(d, user) });
  }

  const me = authUser(d, token);

  if (m === 'GET' && path === '/api/me') {
    const res: Me = { user: publicUser(d, me), context: contextOf(d, me) };
    return ok(res);
  }

  if (m === 'GET' && path === '/api/notifications') return ok(notificationsOf(d, me.id));
  if (m === 'POST' && path === '/api/notifications/read') {
    const ids = Array.isArray(b.ids) ? (b.ids as number[]).map(Number) : [];
    const now = nowISO();
    let n = 0;
    for (const x of d.notifications) if (x.user_id === me.id && ids.includes(x.id) && !x.read_at) { x.read_at = now; n++; }
    return ok({ updated: n });
  }

  if (m === 'GET' && path === '/api/timetable') {
    const sectionId = q.get('section_id') ? Number(q.get('section_id')) : null;
    const teacherId = q.get('teacher_id') ? Number(q.get('teacher_id')) : null;
    const day = q.get('day') !== null && q.get('day') !== '' ? Number(q.get('day')) : null;
    let rows = d.timetable;
    if (sectionId) {
      const sec = d.sections.find((s) => s.id === sectionId);
      if (!sec) throw new ApiError(404, 'الشعبة غير موجودة');
      if (me.role === 'school' && sec.school_id !== me.school_id) throw new ApiError(403, 'الشعبة ليست في مدرستك');
      if (me.role === 'teacher' && !teacherSections(d, me.id).some((s) => s.id === sectionId)) throw new ApiError(403, 'لا تدرّس هذه الشعبة');
      if (me.role === 'student' && studentOf(d, me.id)?.section_id !== sectionId) throw new ApiError(403, 'ليست شعبتك');
      if (me.role === 'parent' && !d.students.some((s) => s.guardian_user_id === me.id && s.section_id === sectionId)) throw new ApiError(403, 'ليست شعبة أحد أبنائك');
      rows = rows.filter((t) => t.section_id === sectionId);
    } else if (teacherId) {
      if (me.role === 'teacher' && teacherId !== me.id) throw new ApiError(403, 'لا يمكنك عرض جدول معلّم آخر');
      const t = userById(d, teacherId);
      if (me.role === 'school' && t?.school_id !== me.school_id) throw new ApiError(403, 'المعلّم ليس في مدرستك');
      rows = rows.filter((x) => x.teacher_id === teacherId);
    } else if (me.role === 'teacher') rows = rows.filter((x) => x.teacher_id === me.id);
    else if (me.role === 'student') { const st = studentOf(d, me.id); rows = rows.filter((x) => x.section_id === st?.section_id); }
    else throw new ApiError(400, 'يلزم تحديد الشعبة أو المعلّم');
    if (day !== null) rows = rows.filter((x) => x.day === day);
    return ok(timetableRows(d, rows, today));
  }

  /* ── teacher ── */
  if (m === 'GET' && path === '/api/teacher/home') {
    requireRole(me, 'teacher');
    const day = dayIndex(today);
    const rows = timetableRows(d, d.timetable.filter((t) => t.teacher_id === me.id && t.day === day), today);
    const periods = rows.map((r) => ({ ...r, attendance_taken: d.attendance.some((a) => a.date === today && a.period === r.period && d.students.some((s) => s.id === a.student_id && s.section_id === r.section_id)) }));
    const homework = d.homework.filter((h) => h.teacher_id === me.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10).map((h) => homeworkSummary(d, h));
    const abs = d.absences.find((a) => a.teacher_id === me.id && a.date === today);
    const substitutions_for_me = d.substitutions
      .filter((s) => s.substitute_teacher_id === me.id && s.status === 'approved' && d.absences.find((a) => a.id === s.absence_id)?.date === today)
      .map((s) => { const t = d.timetable.find((x) => x.id === s.timetable_id)!; return { id: s.id, section_label: sectionLabel(d, t.section_id), period: t.period, subject: subjectName(d, t.subject_id), lesson_note: s.lesson_note }; })
      .sort((a, b) => a.period - b.period);
    const res: TeacherHome = { today: { day, periods }, homework, absence_today: abs ? { id: abs.id, teacher_id: abs.teacher_id, date: abs.date, reason: abs.reason } : null, substitutions_for_me };
    return ok(res);
  }

  if (m === 'POST' && path === '/api/homework') {
    requireRole(me, 'teacher', 'school');
    const section_id = Number(b.section_id);
    const sec = d.sections.find((s) => s.id === section_id);
    if (!sec) throw new ApiError(400, 'الشعبة غير موجودة');
    if (me.role === 'teacher' && !teacherSections(d, me.id).some((s) => s.id === section_id)) throw new ApiError(403, 'لا تدرّس هذه الشعبة');
    const title = String(b.title ?? '').trim();
    const due_date = String(b.due_date ?? '').slice(0, 10);
    if (!title) throw new ApiError(400, 'عنوان الواجب مطلوب');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_date)) throw new ApiError(400, 'موعد التسليم غير صحيح');
    const client_id = b.client_id ? String(b.client_id) : null;
    const existing = client_id ? d.homework.find((h) => h.client_id === client_id) : null;
    const subject_id = Number(b.subject_id) || me.subject_id || 1;
    const hw: Hw = existing ?? { id: d.seq++, section_id, subject_id, teacher_id: me.id, title, details: b.details ? String(b.details) : null, book_page: b.book_page ? String(b.book_page) : null, due_date, created_at: nowISO(), client_id };
    if (!existing) d.homework.push(hw);
    const students = d.students.filter((s) => s.section_id === section_id);
    let notified_students = 0, notified_guardians = 0;
    if (!existing) {
      for (const st of students) {
        pushNotification(d, st.user_id, 'homework', `واجب جديد في ${subjectName(d, subject_id)}: ${title} — التسليم ${fmtDate(due_date)}`, '/student');
        notified_students++;
        if (st.guardian_user_id) {
          pushNotification(d, st.guardian_user_id, 'homework', `واجب جديد في ${subjectName(d, subject_id)} ${li(firstName(userById(d, st.user_id)?.name))}: ${title} — التسليم ${fmtDate(due_date)}`, '/parent');
          notified_guardians++;
        }
      }
    }
    return ok({ id: hw.id, notified_students, notified_guardians, duplicate: !!existing });
  }

  if (m === 'GET' && path === '/api/homework') {
    const sectionId = q.get('section_id') ? Number(q.get('section_id')) : null;
    let list: Hw[];
    if (me.role === 'teacher') list = d.homework.filter((h) => h.teacher_id === me.id);
    else if (me.role === 'school') list = d.homework.filter((h) => d.sections.find((s) => s.id === h.section_id)?.school_id === me.school_id);
    else if (me.role === 'student') list = d.homework.filter((h) => h.section_id === studentOf(d, me.id)?.section_id);
    else if (me.role === 'parent') list = d.homework.filter((h) => d.students.some((s) => s.guardian_user_id === me.id && s.section_id === h.section_id));
    else list = d.homework;
    if (sectionId) list = list.filter((h) => h.section_id === sectionId);
    return ok(list.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((h) => homeworkSummary(d, h)));
  }

  const hwMatch = /^\/api\/homework\/(\d+)(\/submit)?$/.exec(path);
  if (hwMatch) {
    const hw = d.homework.find((h) => h.id === Number(hwMatch[1]));
    if (!hw) throw new ApiError(404, 'الواجب غير موجود');
    if (hwMatch[2] && m === 'POST') {
      requireRole(me, 'student');
      const st = studentOf(d, me.id);
      if (!st || st.section_id !== hw.section_id) throw new ApiError(403, 'هذا الواجب ليس لشعبتك');
      if (!d.submissions.some((s) => s.homework_id === hw.id && s.student_id === st.id)) d.submissions.push({ id: d.seq++, homework_id: hw.id, student_id: st.id, status: 'done', submitted_at: nowISO() });
      const points = d.submissions.filter((s) => s.student_id === st.id).length * 10;
      return ok({ done: true, points });
    }
    if (m === 'GET') {
      if (me.role === 'teacher' && hw.teacher_id !== me.id && !teacherSections(d, me.id).some((s) => s.id === hw.section_id)) throw new ApiError(403, 'ليس من واجباتك');
      if (me.role === 'school' && d.sections.find((s) => s.id === hw.section_id)?.school_id !== me.school_id) throw new ApiError(403, 'ليس في مدرستك');
      if (me.role === 'student' && studentOf(d, me.id)?.section_id !== hw.section_id) throw new ApiError(403, 'ليس لشعبتك');
      if (me.role === 'parent' && !d.students.some((s) => s.guardian_user_id === me.id && s.section_id === hw.section_id)) throw new ApiError(403, 'ليس لأحد أبنائك');
      const students = d.students.filter((s) => s.section_id === hw.section_id);
      const subs = d.submissions.filter((s) => s.homework_id === hw.id);
      const res: HomeworkDetail = {
        ...homeworkSummary(d, hw),
        submissions: subs.sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)).map((s) => ({ student_id: s.student_id, student_name: userById(d, d.students.find((x) => x.id === s.student_id)?.user_id)?.name ?? '', status: s.status, submitted_at: s.submitted_at })),
        students: students.map((s) => ({ id: s.id, name: userById(d, s.user_id)?.name ?? '', done: subs.some((x) => x.student_id === s.id) })),
      };
      return ok(res);
    }
  }

  if (m === 'POST' && path === '/api/attendance') {
    requireRole(me, 'teacher', 'school');
    const section_id = Number(b.section_id);
    const sec = d.sections.find((s) => s.id === section_id);
    if (!sec) throw new ApiError(400, 'الشعبة غير موجودة');
    if (me.role === 'teacher' && !teacherSections(d, me.id).some((s) => s.id === section_id)) throw new ApiError(403, 'لا تدرّس هذه الشعبة');
    if (me.role === 'school' && sec.school_id !== me.school_id) throw new ApiError(403, 'الشعبة ليست في مدرستك');
    const date = String(b.date ?? today).slice(0, 10);
    const period = Number(b.period);
    if (!(period >= 1 && period <= 7)) throw new ApiError(400, 'رقم الحصّة غير صحيح');
    const records = Array.isArray(b.records) ? (b.records as { student_id: number; status: AttStatus }[]) : [];
    const confirmed = d.attendance.some((a) => a.date === date && a.confirmed && d.students.some((s) => s.id === a.student_id && d.sections.find((x) => x.id === s.section_id)?.school_id === sec.school_id)) ? 1 : 0;
    const counts = { saved: 0, present: 0, absent: 0, late: 0 };
    for (const r of records) {
      const st = d.students.find((s) => s.id === Number(r.student_id) && s.section_id === section_id);
      if (!st || !['present', 'absent', 'late'].includes(r.status)) continue;
      const existing = d.attendance.find((a) => a.student_id === st.id && a.date === date && a.period === period);
      if (existing) { existing.status = r.status; existing.recorded_by = me.id; }
      else d.attendance.push({ id: d.seq++, student_id: st.id, date, period, status: r.status, recorded_by: me.id, confirmed, created_at: nowISO() });
      counts.saved++;
      counts[r.status]++;
      if (r.status === 'absent' && st.guardian_user_id) {
        const body = `غياب ${firstName(userById(d, st.user_id)?.name)} عن ${periodName(period)} ${dayWord(date, today)}`;
        if (!d.notifications.some((n) => n.user_id === st.guardian_user_id && n.kind === 'absence' && n.body === body && n.created_at.slice(0, 10) === today)) pushNotification(d, st.guardian_user_id, 'absence', body, '/parent', confirmed);
      }
    }
    return ok(counts);
  }

  if (m === 'POST' && path === '/api/attendance/confirm') {
    requireRole(me, 'school');
    const date = String(b.date ?? today).slice(0, 10);
    const schoolStudents = new Set(d.students.filter((s) => d.sections.find((x) => x.id === s.section_id)?.school_id === me.school_id).map((s) => s.id));
    let confirmedRows = 0, sms = 0;
    for (const a of d.attendance) if (a.date === date && schoolStudents.has(a.student_id)) { a.confirmed = 1; confirmedRows++; }
    const guardians = new Set(guardiansOfSchool(d, me.school_id!));
    for (const n of d.notifications) if (n.kind === 'absence' && guardians.has(n.user_id) && n.created_at.slice(0, 10) === date && !n.sms) { n.sms = 1; sms++; console.info('[SMS]', userById(d, n.user_id)?.phone ?? '—', n.body); }
    return ok({ confirmed: confirmedRows, sms });
  }

  if (m === 'POST' && path === '/api/absences') {
    requireRole(me, 'teacher', 'school');
    const teacher_id = me.role === 'teacher' ? me.id : Number(b.teacher_id);
    const teacher = userById(d, teacher_id);
    if (!teacher || teacher.role !== 'teacher') throw new ApiError(400, 'المعلّم غير موجود');
    if (me.role === 'school' && teacher.school_id !== me.school_id) throw new ApiError(403, 'المعلّم ليس في مدرستك');
    const date = String(b.date ?? today).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'التاريخ غير صحيح');
    let abs = d.absences.find((a) => a.teacher_id === teacher_id && a.date === date);
    const isNew = !abs;
    if (!abs) {
      abs = { id: d.seq++, teacher_id, date, reason: b.reason ? String(b.reason) : null, reported_by: me.id, created_at: nowISO() };
      d.absences.push(abs);
    }
    const affected = runEngine(d, abs);
    if (isNew) {
      const schoolAccount = d.users.find((x) => x.role === 'school' && x.school_id === teacher.school_id);
      if (schoolAccount) pushNotification(d, schoolAccount.id, 'alert', `غياب أ. ${teacher.name} ${dayWord(date, today)}: ${periodsNeedCover(affected.length)}`, '/school/absences');
      const school = d.schools.find((x) => x.id === teacher.school_id);
      const directorate = d.users.find((x) => x.role === 'directorate');
      if (school && directorate && affected.length) pushNotification(d, directorate.id, 'uncovered', `${school.name}: غياب أ. ${teacher.name} ${dayWord(date, today)} — ${periodsNeedCover(affected.length)}`, `/directorate/school/${school.id}?date=${date}`);
    }
    const res: AbsenceResult & { existing: boolean } = { absence_id: abs.id, affected, existing: !isNew };
    return ok(res);
  }

  /* ── student ── */
  if (m === 'GET' && path === '/api/student/home') {
    requireRole(me, 'student');
    const st = studentOf(d, me.id);
    if (!st) throw new ApiError(404, 'سجلّ الطالب غير موجود');
    const day = dayIndex(today);
    const res: StudentHome = {
      today: timetableRows(d, d.timetable.filter((t) => t.section_id === st.section_id && t.day === day), today),
      homework: studentHomework(d, st, null),
      notifications_unread: d.notifications.filter((n) => n.user_id === me.id && !n.read_at).length,
      points: d.submissions.filter((s) => s.student_id === st.id).length * 10,
    };
    return ok(res);
  }

  /* ── parent ── */
  if (m === 'GET' && path === '/api/parent/home') {
    requireRole(me, 'parent');
    const children: ParentChild[] = d.students.filter((s) => s.guardian_user_id === me.id).map((st) => {
      const sec = d.sections.find((x) => x.id === st.section_id)!;
      const recs = d.attendance.filter((a) => a.student_id === st.id && a.date === today).sort((a, b) => a.period - b.period);
      const first = recs[0];
      return {
        student_id: st.id, name: userById(d, st.user_id)?.name ?? '', section_label: sec.label, section_id: sec.id, school_name: schoolName(d, sec.school_id) ?? '',
        today: { status: first ? first.status : 'none', first_period_time: first ? timeHM(first.created_at) : null },
        homework: studentHomework(d, st, 7),
        notifications: notificationsOf(d, me.id, 10),
      };
    });
    const res: ParentHome = { children };
    return ok(res);
  }

  if (m === 'POST' && path === '/api/messages') {
    const to = userById(d, Number(b.to_user));
    const text = String(b.body ?? '').trim();
    if (!to) throw new ApiError(400, 'المستلم غير موجود');
    if (!text) throw new ApiError(400, 'نصّ الرسالة فارغ');
    if (me.role === 'student') throw new ApiError(403, 'لا تملك صلاحية هذه العملية');
    const msg: Msg = { id: d.seq++, from_user: me.id, to_user: to.id, body: text, created_at: nowISO(), read_at: null };
    d.messages.push(msg);
    const who = me.role === 'teacher' ? `أ. ${firstName(me.name)}` : me.role === 'school' ? 'إدارة المدرسة' : `${firstName(me.name)} (وليّ أمر الطالب)`;
    pushNotification(d, to.id, 'message', `رسالة جديدة من ${who}: ${text.length > 80 ? text.slice(0, 80) + '…' : text}`, '/messages');
    return ok({ id: msg.id });
  }
  if (m === 'GET' && path === '/api/messages') {
    const mine = d.messages.filter((x) => x.from_user === me.id || x.to_user === me.id);
    const now = nowISO();
    const map = new Map<number, Thread>();
    for (const x of mine.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const otherId = x.from_user === me.id ? x.to_user : x.from_user;
      const other = userById(d, otherId);
      if (!map.has(otherId)) map.set(otherId, { user_id: otherId, name: other?.name ?? '', role: other?.role, messages: [] });
      if (x.to_user === me.id && !x.read_at) x.read_at = now;
      map.get(otherId)!.messages.push({ ...x });
    }
    save();
    return ok([...map.values()].sort((a, b) => b.messages[b.messages.length - 1].created_at.localeCompare(a.messages[a.messages.length - 1].created_at)));
  }

  /* ── school ── */
  if (m === 'GET' && path === '/api/school/dashboard') {
    requireRole(me, 'school');
    const date = q.get('date') || today;
    const schoolId = me.school_id!;
    const att = schoolAttendance(d, schoolId, date);
    const teachers = d.users.filter((x) => x.role === 'teacher' && x.school_id === schoolId);
    const absences = d.absences.filter((a) => a.date === date && teachers.some((t) => t.id === a.teacher_id));
    const cov = schoolCoverage(d, schoolId, date);
    const res: SchoolDashboard = {
      students: att.students, present: att.present, present_pct: att.present_pct,
      teachers: teachers.length, teachers_present: teachers.length - absences.length,
      uncovered_periods: cov.uncovered,
      homework_today: d.homework.filter((h) => h.created_at.slice(0, 10) === date && d.sections.find((s) => s.id === h.section_id)?.school_id === schoolId).length,
      attendance_by_grade: att.attendance_by_grade,
      attendance_confirmed: d.attendance.some((a) => a.date === date && a.confirmed && d.students.some((s) => s.id === a.student_id && d.sections.find((x) => x.id === s.section_id)?.school_id === schoolId)),
      absences: absences.map((a) => {
        const t = userById(d, a.teacher_id)!;
        return {
          absence_id: a.id, teacher: t.name, teacher_id: t.id, subject: subjectName(d, t.subject_id), reason: a.reason,
          substitutions: d.substitutions.filter((s) => s.absence_id === a.id).map((s) => {
            const row = d.timetable.find((x) => x.id === s.timetable_id)!;
            return { id: s.id, period: row.period, section_label: sectionLabel(d, row.section_id), subject: subjectName(d, row.subject_id), status: s.status, substitute: s.status === 'approved' ? userById(d, s.substitute_teacher_id)?.name ?? null : null, candidates: s.candidates, note: s.note ?? null, lesson_note: s.lesson_note };
          }).sort((x, y) => x.period - y.period),
        };
      }),
    };
    return ok(res);
  }

  if (m === 'GET' && path === '/api/school/sections') {
    requireRole(me, 'school', 'teacher');
    const sections = me.role === 'school' ? d.sections.filter((s) => s.school_id === me.school_id) : teacherSections(d, me.id);
    // `id` and `student_id` carry the same value, as on the server (the roster keys on `id`, the attendance POST sends `student_id`).
    return ok(sections.map((s) => ({ id: s.id, grade: s.grade, label: s.label, shift: s.shift, students: d.students.filter((x) => x.section_id === s.id).map((x) => ({ id: x.id, student_id: x.id, name: userById(d, x.user_id)?.name ?? '', has_guardian: x.guardian_user_id !== null })) })));
  }

  const rosterMatch = /^\/api\/sections\/(\d+)\/roster$/.exec(path);
  if (rosterMatch && m === 'GET') {
    requireRole(me, 'school', 'teacher', 'directorate');
    const sec = d.sections.find((s) => s.id === Number(rosterMatch[1]));
    if (!sec) throw new ApiError(404, 'الشعبة غير موجودة');
    if (me.role === 'school' && sec.school_id !== me.school_id) throw new ApiError(403, 'الشعبة ليست في مدرستك');
    if (me.role === 'teacher' && !teacherSections(d, me.id).some((s) => s.id === sec.id)) throw new ApiError(403, 'لا تدرّس هذه الشعبة');
    const date = q.get('date') || today;
    const period = q.get('period') ? Number(q.get('period')) : null;
    const students = d.students.filter((x) => x.section_id === sec.id).map((x) => {
      const recs = d.attendance.filter((a) => a.student_id === x.id && a.date === date && (period === null || a.period === period)).sort((a, b) => a.period - b.period);
      return { id: x.id, student_id: x.id, name: userById(d, x.user_id)?.name ?? '', status: recs[0]?.status ?? null };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return ok({ section: { id: sec.id, grade: sec.grade, label: sec.label, shift: sec.shift }, date, period, students });
  }

  const substMatch = /^\/api\/substitutions\/(\d+)\/(approve|self-study)$/.exec(path);
  if (substMatch && m === 'POST') {
    requireRole(me, 'school');
    const s = d.substitutions.find((x) => x.id === Number(substMatch[1]));
    if (!s) throw new ApiError(404, 'التكليف غير موجود');
    const abs = d.absences.find((x) => x.id === s.absence_id)!;
    const row = d.timetable.find((x) => x.id === s.timetable_id)!;
    const sec = d.sections.find((x) => x.id === row.section_id)!;
    if (sec.school_id !== me.school_id) throw new ApiError(403, 'ليست في مدرستك');
    const sectionStudents = d.students.filter((x) => x.section_id === sec.id);
    const period = periodName(row.period);
    const when = dayWord(abs.date, today);
    let notified = 0;
    if (substMatch[2] === 'approve') {
      const teacher = userById(d, Number(b.teacher_id));
      if (!teacher || teacher.role !== 'teacher' || teacher.school_id !== me.school_id) throw new ApiError(400, 'يلزم اختيار معلّم من المدرسة');
      if (d.timetable.some((t) => t.teacher_id === teacher.id && t.day === row.day && t.period === row.period)) throw new ApiError(409, 'المعلّم لديه حصّة في الوقت نفسه');
      if (d.absences.some((a) => a.teacher_id === teacher.id && a.date === abs.date)) throw new ApiError(409, 'المعلّم غائب في هذا اليوم');
      const clash = d.substitutions.some((x) => x.id !== s.id && x.status === 'approved' && x.substitute_teacher_id === teacher.id && d.absences.find((a) => a.id === x.absence_id)?.date === abs.date && d.timetable.find((t) => t.id === x.timetable_id)?.period === row.period);
      if (clash) throw new ApiError(409, 'المعلّم مكلّف بحصّة بديلة أخرى في الوقت نفسه');
      s.status = 'approved';
      s.substitute_teacher_id = teacher.id;
      s.lesson_note = b.lesson_note ? String(b.lesson_note) : s.lesson_note;
      s.approved_by = me.id;
      s.approved_at = nowISO();
      pushNotification(d, teacher.id, 'substitution', `تكليفك بتغطية ${period} ${when} — ${sec.label} · ${subjectName(d, row.subject_id)}${s.lesson_note ? ` · خطّة الدرس: ${s.lesson_note}` : ''}`, '/teacher');
      notified++;
      for (const st of sectionStudents) {
        pushNotification(d, st.user_id, 'change', `تغيّر معلّم ${period} ${when}`, '/student');
        notified++;
        if (st.guardian_user_id) { pushNotification(d, st.guardian_user_id, 'change', `تغيّر معلّم ${period} ${when} في شعبة ${firstName(userById(d, st.user_id)?.name)}`, '/parent'); notified++; }
      }
      return ok({ id: s.id, status: s.status, substitute: teacher.name, notified });
    }
    const note = String(b.lesson_note ?? '').trim();
    if (!note) throw new ApiError(400, 'تلزم ملاحظة النشاط الذاتي');
    s.status = 'self_study';
    s.substitute_teacher_id = null;
    s.lesson_note = note;
    s.approved_by = me.id;
    s.approved_at = nowISO();
    for (const st of sectionStudents) {
      pushNotification(d, st.user_id, 'change', `${period} ${when} تعلّم ذاتي موجَّه: ${note}`, '/student');
      notified++;
      if (st.guardian_user_id) { pushNotification(d, st.guardian_user_id, 'change', `حصّة ${firstName(userById(d, st.user_id)?.name)} ${periodOrdinal(row.period)} ${when} تعلّم ذاتي موجَّه`, '/parent'); notified++; }
    }
    return ok({ id: s.id, status: s.status, notified });
  }

  if (m === 'POST' && path === '/api/announcements') {
    requireRole(me, 'school', 'directorate');
    const title = String(b.title ?? '').trim();
    const text = String(b.body ?? '').trim();
    if (!title || !text) throw new ApiError(400, 'العنوان والنصّ مطلوبان');
    const urgent = me.role === 'school' && (b.urgent === true || b.urgent === 1 || b.urgent === '1') ? 1 : 0;
    const ann: Ann = { id: d.seq++, school_id: me.role === 'school' ? me.school_id : null, title, body: text, urgent, created_by: me.id, created_at: nowISO(), notified: 0 };
    d.announcements.push(ann);
    if (me.role === 'school') {
      const guardians = guardiansOfSchool(d, me.school_id!);
      for (const g of guardians) pushNotification(d, g, 'announcement', `${urgent ? 'إعلان عاجل: ' : ''}${title} — ${text}`, '/notifications', urgent);
      ann.notified = guardians.length;
      return ok({ id: ann.id, notified_parents: guardians.length, sms: urgent ? guardians.length : 0 });
    }
    const schools = d.users.filter((x) => x.role === 'school');
    for (const s of schools) pushNotification(d, s.id, 'circular', `تعميم من مديرية التربية: ${title} — ${text}`, '/notifications');
    ann.notified = schools.length;
    return ok({ id: ann.id, notified_schools: schools.length });
  }

  if (m === 'GET' && path === '/api/announcements') {
    let list: Ann[];
    if (me.role === 'directorate') list = d.announcements.filter((a) => a.school_id === null);
    else if (me.role === 'school') list = d.announcements.filter((a) => a.school_id === me.school_id || a.school_id === null);
    else list = d.announcements.filter((a) => a.school_id === me.school_id);
    return ok(list.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((a) => ({ ...a, from: a.school_id === null ? 'مديرية التربية' : schoolName(d, a.school_id) })));
  }

  /* ── directorate ── */
  if (m === 'GET' && (path === '/api/directorate/dashboard' || path === '/api/directorate/report.csv')) {
    requireRole(me, 'directorate');
    const date = validDate(q.get('date')) ?? today;
    const rows = d.schools.map((s) => dirSchoolRow(d, s, date, today));
    const schoolDay = isSchoolDay(date);
    const alerts: DirectorateAlert[] = [];
    for (const r of rows) if (schoolDay && !r.row.attendance_uploaded) alerts.push({ kind: 'no_attendance', school: r.row.name, school_id: r.row.id, text: `لم يُرفع الحضور ${date === today ? 'بعد' : dayWord(date, today)}` });
    for (const r of rows) if (r.row.uncovered_periods > 0) alerts.push({ kind: 'uncovered', school: r.row.name, school_id: r.row.id, text: `${count(r.row.uncovered_periods, NOUNS.period)} من دون تغطية ${dayWord(date, today)}` });
    for (const r of rows) for (const t of r.three) alerts.push({ kind: 'three_days', school: r.row.name, school_id: r.row.id, text: `${t.student} (${t.section}): غياب ${consecutiveDays(t.days)}` });
    const up = rows.filter((r) => r.fig.uploaded);
    const presentSum = up.reduce((a, r) => a + r.fig.present + r.fig.late, 0);
    const studentsSum = up.reduce((a, r) => a + r.fig.students, 0);
    const covTotal = rows.reduce((a, r) => a + r.cov.total, 0);
    const covCovered = rows.reduce((a, r) => a + r.cov.covered, 0);
    const res: DirectorateDashboard = {
      date,
      schools: rows.map((r) => r.row),
      totals: { schools_connected: rows.length, present_pct: studentsSum ? Math.round((presentSum / studentsSum) * 100) : null, coverage_pct: covTotal ? Math.round((covCovered / covTotal) * 100) : 100, alerts_count: alerts.length },
      alerts,
      three_day_absences: rows.flatMap((r) => r.three.map((t) => ({ student_name: t.student, school: r.row.name, school_id: r.row.id, section_label: t.section, days: t.days }))),
    };
    if (path.endsWith('.csv')) {
      const esc = (v: string | number | boolean | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [
        ['المدرسة', 'المجمّع', 'المدير', 'الهاتف', 'الطلاب', 'نسبة الحضور', 'رُفع الحضور', 'وقت الرفع', 'حصص غير مغطّاة', 'نسبة التغطية', 'غياب ثلاثة أيام', 'واجبات اليوم'].map(esc).join(','),
        ...res.schools.map((s) => [s.name, s.complex, s.principal, s.phone, s.students, s.present_pct ?? '', s.attendance_uploaded ? 'نعم' : 'لا', s.uploaded_at ? timeHM(s.uploaded_at) : '', s.uncovered_periods, s.coverage_pct, s.three_days ?? 0, s.homework_today].map(esc).join(',')),
      ];
      return { status: 200, body: '\ufeff' + `"تقرير اليوم","${date}"\r\n` + lines.join('\r\n') + '\r\n', contentType: 'text/csv; charset=utf-8' };
    }
    return ok(res);
  }

  if (m === 'GET' && path === '/api/directorate/report') {
    requireRole(me, 'directorate');
    const week = weekStart(validDate(q.get('week')) ?? today);
    return ok(weeklyReport(d, week, today));
  }

  const dirSchoolMatch = /^\/api\/directorate\/school\/(\d+)$/.exec(path);
  if (dirSchoolMatch && m === 'GET') {
    requireRole(me, 'directorate');
    const s = d.schools.find((x) => x.id === Number(dirSchoolMatch[1]));
    if (!s) throw new ApiError(404, 'المدرسة غير موجودة في سجلّ المديرية');
    const date = validDate(q.get('date')) ?? today;
    return ok(schoolDayView(d, s, date, today));
  }

  throw new ApiError(404, `المسار غير موجود: ${m} ${path}`);
}

// The one-tap demo accounts live in src/demo.ts so the login screen never imports this module.

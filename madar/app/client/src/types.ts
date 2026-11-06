/* Types for the API contract (docs/mvp-spec.md §5). */

export type Role = 'directorate' | 'school' | 'teacher' | 'student' | 'parent';

export interface User {
  id: number;
  role: Role;
  name: string;
  school_id: number | null;
  school_name?: string | null;
  subject?: string | null;
}

export interface SectionRef { id: number; grade: number; label: string }

export interface TeacherContext { sections: SectionRef[]; subject: string | null }
export interface StudentContext { section: SectionRef; school_name: string }
export interface ParentChildRef { student_id: number; name: string; section_label: string; section_id?: number; school_name: string }
export interface ParentContext { children: ParentChildRef[] }
export interface SchoolContext { school: { id: number; name: string; complex: string } }
export interface DirectorateContext { schools: { id: number; name: string; complex: string }[] }
export type Context = TeacherContext | StudentContext | ParentContext | SchoolContext | DirectorateContext;

export interface Me { user: User; context: Context }

export interface LoginResponse { token: string; user: User }

export interface Notification {
  id: number;
  kind: string;
  body: string;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export interface Substitute { teacher: string | null; status: string }

export interface TimetableRow {
  id: number;
  day: number;
  period: number;
  subject: string;
  subject_id: number;
  teacher: string;
  teacher_id: number;
  section_id: number;
  section_label: string;
  substitute: Substitute | null;
}

export interface TeacherPeriod extends TimetableRow { attendance_taken: boolean }

export interface Homework {
  id: number;
  section_id: number;
  section_label?: string;
  subject_id: number;
  subject: string;
  teacher_id?: number;
  title: string;
  details?: string | null;
  book_page: string | null;
  due_date: string;
  created_at: string;
  submitted_count?: number;
  student_count?: number;
}

export interface Submission {
  student_id: number;
  student_name?: string;
  name?: string;
  status: string;
  submitted_at: string;
}

export interface HomeworkDetail extends Homework {
  submissions: Submission[];
  students?: { id: number; name: string; done?: boolean }[];
}

export interface Absence {
  id: number;
  teacher_id: number;
  date: string;
  reason: string | null;
}

export interface SubstitutionForMe {
  id: number;
  section_label: string;
  period: number;
  subject: string;
  lesson_note: string | null;
}

export interface TeacherHome {
  today: { day: number; periods: TeacherPeriod[] };
  homework: Homework[];
  absence_today: Absence | null;
  substitutions_for_me: SubstitutionForMe[];
}

export interface Candidate {
  teacher_id: number;
  name: string;
  subject: string;
  tier?: number;
  reason: string;
}

export interface AffectedPeriod {
  substitution_id: number;
  period: number;
  section_label: string;
  subject: string;
  candidates: Candidate[];
  note?: string | null;
}

export interface AbsenceResult { absence_id: number; affected: AffectedPeriod[] }

export interface HomeworkCreateResponse { id: number; notified_students: number; notified_guardians: number }

export interface AttendanceRecord { student_id: number; status: 'present' | 'absent' | 'late' }
export interface AttendanceResponse { present?: number; absent?: number; late?: number; saved?: number; queued?: boolean }

export interface StudentHomework {
  id: number;
  title: string;
  subject: string;
  book_page: string | null;
  due_date: string;
  done: boolean;
}

export interface StudentHome {
  today: TimetableRow[];
  homework: StudentHomework[];
  notifications_unread: number;
  points?: number;   // ١٠ نقاط لكلّ واجب مُسلَّم, counted by the server over every submission
}

export interface ParentChild {
  student_id: number;
  name: string;
  section_label: string;
  section_id?: number;
  school_name: string;
  today: { status: 'present' | 'absent' | 'late' | 'none'; first_period_time: string | null };
  homework: StudentHomework[];
  notifications: Notification[];
}

export interface ParentHome { children: ParentChild[] }

export interface Message {
  id: number;
  from_user: number;
  to_user: number;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Thread {
  user_id: number;
  name: string;
  role?: string;
  unread?: number;
  messages: Message[];
}

/** GET /api/messages as the server returns it: one thread per other user. */
export interface ServerThread {
  with: { id: number; name: string; role?: string };
  unread?: number;
  last_at?: string;
  messages: Message[];
}

export interface SchoolSubstitution {
  id: number;
  period: number;
  section_label: string;
  status: 'suggested' | 'approved' | 'self_study' | 'uncovered';
  substitute: string | null;
  candidates: Candidate[];
  subject?: string;
  lesson_note?: string | null;
  /** Set by the engine when no teacher of the same subject was free: the candidates come from other subjects. */
  note?: string | null;
}

export interface SchoolAbsence {
  absence_id: number;
  teacher: string;
  teacher_id?: number;
  subject: string;
  reason?: string | null;
  substitutions: SchoolSubstitution[];
}

export interface SchoolDashboard {
  students: number;
  present: number;
  present_pct: number;
  teachers: number;
  teachers_present: number;
  uncovered_periods: number;
  homework_today: number;
  attendance_by_grade: { grade: number; pct: number }[];
  absences: SchoolAbsence[];
  attendance_confirmed?: boolean;
}

/** A pupil as the sections and roster endpoints list them (`id` and `student_id` carry the same value). */
export interface RosterStudent { id?: number; student_id?: number; name: string; has_guardian?: boolean }

export interface SectionWithStudents extends SectionRef {
  shift?: number;
  students: RosterStudent[];
}

/** GET /api/sections/:id/roster?date&period — the pupils with the status already saved for that period, if any. */
export interface RosterResponse {
  section: SectionRef & { shift?: number };
  date: string;
  period: number | null;
  students: (RosterStudent & { status: 'present' | 'absent' | 'late' | null })[];
}

/** The pupils of a section with a guaranteed numeric id (rows without one are dropped, never sent). */
export function rosterStudents(students: RosterStudent[] | null | undefined): { id: number; name: string }[] {
  return (students ?? [])
    .map((s) => ({ id: Number(s.id ?? s.student_id), name: s.name }))
    .filter((s) => Number.isInteger(s.id) && s.id > 0);
}

export interface DirectorateSchool {
  id: number;
  name: string;
  complex: string;
  students: number;
  present_pct: number | null;
  attendance_uploaded: boolean;
  uncovered_periods: number;
  coverage_pct: number;
  homework_today: number;
  // round 2: who to call, when the attendance came in, early-warning count
  principal?: string | null;
  phone?: string | null;
  uploaded_at?: string | null;
  three_days?: number;
  teachers?: number;
  teachers_present?: number;
}

export type DirectorateAlertKind = 'no_attendance' | 'uncovered' | 'three_days';
export interface DirectorateAlert { kind: DirectorateAlertKind; school: string; school_id?: number; text: string }

export interface DirectorateThreeDay { student_name: string; school: string; school_id?: number; section_label?: string; days: number }

export interface DirectorateDashboard {
  date?: string;
  schools: DirectorateSchool[];
  totals: { schools_connected: number; present_pct: number | null; coverage_pct: number; alerts_count: number };
  alerts: DirectorateAlert[];
  three_day_absences: DirectorateThreeDay[];
}

/** GET /api/directorate/school/:id?date= — one school's day as the directorate sees it. */
export type DirectoratePeriodStatus = 'approved' | 'self_study' | 'pending' | 'uncovered';
export interface DirectoratePeriod { period: number; section: string; subject?: string; status: DirectoratePeriodStatus; substitute: string | null; lesson_note?: string | null }
export interface DirectorateAbsence { teacher: string; subject: string; reason?: string | null; periods: DirectoratePeriod[] }
export interface DirectorateSchoolDay {
  school: { id: number; name: string; complex: string; principal: string | null; phone: string | null; students: number; teachers: number };
  day: { attendance_pct: number | null; present: number; absent: number; late: number; uploaded_at: string | null; confirmed: boolean };
  absences: DirectorateAbsence[];
  uncovered: { period: number; section: string; subject: string }[];
  three_days: { student: string; section: string; days: number }[];
  trend: { date: string; attendance_pct: number | null }[];
}

/** GET /api/directorate/report?week= — the printable weekly report. */
export interface DirectorateWeeklyNumbers {
  attendance_avg_pct: number | null;
  days_uploaded: number;
  absences: number;
  substitutions_approved: number;
  self_study: number;
  uncovered: number;
  three_days: number;
}
export interface DirectorateWeeklyRow extends DirectorateWeeklyNumbers { id?: number; name: string; complex: string; students?: number }
export interface DirectorateWeeklyReport { from: string; to: string; school_days?: number; schools: DirectorateWeeklyRow[]; totals: DirectorateWeeklyNumbers }

export interface Announcement {
  id: number;
  school_id: number | null;
  title: string;
  body: string;
  urgent: number | boolean;
  created_at: string;
  notified?: number;
}

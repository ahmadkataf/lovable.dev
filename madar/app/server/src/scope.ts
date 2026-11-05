// Authorisation scope (docs/mvp-spec.md §4): who may see which section / student.
import type { User } from './types'
import { forbidden, notFound } from './util'

export interface SectionInfo { id: number; school_id: number; grade: number; label: string; shift: number; school_name: string }
export interface Child { student_id: number; user_id: number; name: string; section_id: number; section_label: string; grade: number; shift: number; school_id: number; school_name: string }

export async function sectionInfo(db: D1Database, sectionId: number): Promise<SectionInfo | null> {
  return db.prepare('SELECT sec.id, sec.school_id, sec.grade, sec.label, sec.shift, sc.name AS school_name FROM sections sec JOIN schools sc ON sc.id = sec.school_id WHERE sec.id = ?')
    .bind(sectionId).first<SectionInfo>()
}

/** Sections a teacher has at least one timetable row in. */
export async function teacherSections(db: D1Database, teacherId: number): Promise<{ id: number; grade: number; label: string }[]> {
  const { results } = await db.prepare(
    'SELECT DISTINCT sec.id, sec.grade, sec.label FROM timetable t JOIN sections sec ON sec.id = t.section_id WHERE t.teacher_id = ? ORDER BY sec.grade, sec.label')
    .bind(teacherId).all<{ id: number; grade: number; label: string }>()
  return results
}

const CHILD_SQL = `SELECT st.id AS student_id, st.user_id, u.name, st.section_id, sec.label AS section_label, sec.grade, sec.shift, sec.school_id, sc.name AS school_name
  FROM students st JOIN users u ON u.id = st.user_id JOIN sections sec ON sec.id = st.section_id JOIN schools sc ON sc.id = sec.school_id`

export async function parentChildren(db: D1Database, parentId: number): Promise<Child[]> {
  return (await db.prepare(`${CHILD_SQL} WHERE st.guardian_user_id = ? ORDER BY sec.grade, u.name`).bind(parentId).all<Child>()).results
}
export async function studentByUser(db: D1Database, userId: number): Promise<Child | null> {
  return db.prepare(`${CHILD_SQL} WHERE st.user_id = ?`).bind(userId).first<Child>()
}
export async function studentById(db: D1Database, studentId: number): Promise<Child | null> {
  return db.prepare(`${CHILD_SQL} WHERE st.id = ?`).bind(studentId).first<Child>()
}

/** May this user read data of this section? */
export async function canSeeSection(db: D1Database, user: User, section: SectionInfo): Promise<boolean> {
  switch (user.role) {
    case 'directorate': return true
    case 'school': return user.school_id === section.school_id
    case 'teacher': return (await teacherSections(db, user.id)).some(s => s.id === section.id)
    case 'student': return (await studentByUser(db, user.id))?.section_id === section.id
    case 'parent': return (await parentChildren(db, user.id)).some(ch => ch.section_id === section.id)
  }
}

/** The section, or a 404/403 ApiError. */
export async function requireSection(db: D1Database, user: User, sectionId: number): Promise<SectionInfo> {
  const section = await sectionInfo(db, sectionId)
  if (!section) throw notFound('الشعبة غير موجودة')
  if (!(await canSeeSection(db, user, section))) throw forbidden('هذه الشعبة خارج نطاق صلاحياتك')
  return section
}

/** The student, or a 404/403 ApiError (student: self only; parent: own children; teacher: own sections; school: own school). */
export async function requireStudent(db: D1Database, user: User, studentId: number): Promise<Child> {
  const st = await studentById(db, studentId)
  if (!st) throw notFound('الطالب غير موجود')
  const ok = user.role === 'directorate' || (user.role === 'school' && user.school_id === st.school_id)
    || (user.role === 'student' && st.user_id === user.id)
    || (user.role === 'parent' && (await parentChildren(db, user.id)).some(ch => ch.student_id === st.student_id))
    || (user.role === 'teacher' && (await teacherSections(db, user.id)).some(s => s.id === st.section_id))
  if (!ok) throw forbidden('هذا الطالب خارج نطاق صلاحياتك')
  return st
}

/** A teacher of the given school, or a 404/403 ApiError. */
export async function requireTeacherOfSchool(db: D1Database, teacherId: number, schoolId: number | null): Promise<{ id: number; name: string; subject_id: number | null }> {
  const t = await db.prepare("SELECT id, name, subject_id, school_id FROM users WHERE id = ? AND role = 'teacher'").bind(teacherId)
    .first<{ id: number; name: string; subject_id: number | null; school_id: number }>()
  if (!t) throw notFound('المعلّم غير موجود')
  if (schoolId !== null && t.school_id !== schoolId) throw forbidden('هذا المعلّم ليس من مدرستك')
  return t
}

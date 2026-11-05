// In-app notifications and the SMS stub. Bodies are short Arabic sentences with first names only.
import { placeholders } from './util'

export interface Notice { user_id: number; kind: string; body: string; link?: string | null; sms?: 0 | 1 }

const ROWS_PER_INSERT = 20   // 5 bound values per row, well under D1's 100-parameter limit

/** Stores the notices and logs an [SMS] line for every notice flagged sms=1. Returns how many were stored. */
export async function notify(db: D1Database, notices: Notice[]): Promise<number> {
  if (!notices.length) return 0
  const statements: D1PreparedStatement[] = []
  for (let i = 0; i < notices.length; i += ROWS_PER_INSERT) {
    const chunk = notices.slice(i, i + ROWS_PER_INSERT)
    const sql = 'INSERT INTO notifications (user_id, kind, body, link, sms) VALUES ' + chunk.map(() => '(?, ?, ?, ?, ?)').join(', ')
    statements.push(db.prepare(sql).bind(...chunk.flatMap(n => [n.user_id, n.kind, n.body, n.link ?? null, n.sms ?? 0])))
  }
  await db.batch(statements)
  await logSms(db, notices.filter(n => n.sms === 1))
  return notices.length
}

/** The SMS gateway is out of scope for the pilot: every SMS is only logged. */
export async function logSms(db: D1Database, notices: Notice[]): Promise<void> {
  if (!notices.length) return
  const ids = [...new Set(notices.map(n => n.user_id))]
  const phones = new Map<number, string | null>()
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50)
    const { results } = await db.prepare(`SELECT id, phone FROM users WHERE id IN (${placeholders(part.length)})`).bind(...part).all<{ id: number; phone: string | null }>()
    for (const r of results) phones.set(r.id, r.phone)
  }
  for (const n of notices) console.log('[SMS]', phones.get(n.user_id) ?? '(no phone)', n.body)
}

/** User ids of a section's students and of their guardians (deduplicated). */
export async function sectionAudience(db: D1Database, sectionId: number): Promise<{ students: number[]; guardians: number[] }> {
  const { results } = await db.prepare('SELECT user_id, guardian_user_id FROM students WHERE section_id = ?').bind(sectionId)
    .all<{ user_id: number; guardian_user_id: number | null }>()
  return {
    students: results.map(r => r.user_id),
    guardians: [...new Set(results.map(r => r.guardian_user_id).filter((g): g is number => g !== null))],
  }
}

/** User ids of every guardian with a child in the school. */
export async function schoolGuardians(db: D1Database, schoolId: number): Promise<number[]> {
  const { results } = await db.prepare(
    'SELECT DISTINCT st.guardian_user_id AS id FROM students st JOIN sections sec ON sec.id = st.section_id WHERE sec.school_id = ? AND st.guardian_user_id IS NOT NULL')
    .bind(schoolId).all<{ id: number }>()
  return results.map(r => r.id)
}

/** School (principal) accounts of one school, or of every school when schoolId is null. */
export async function schoolAccounts(db: D1Database, schoolId: number | null): Promise<number[]> {
  const stmt = schoolId === null
    ? db.prepare("SELECT id FROM users WHERE role = 'school'")
    : db.prepare("SELECT id FROM users WHERE role = 'school' AND school_id = ?").bind(schoolId)
  const { results } = await stmt.all<{ id: number }>()
  return results.map(r => r.id)
}

/** Fan a body out to many users. */
export const fanOut = (userIds: number[], kind: string, body: string, link: string | null = null, sms: 0 | 1 = 0): Notice[] =>
  userIds.map(user_id => ({ user_id, kind, body, link, sms }))

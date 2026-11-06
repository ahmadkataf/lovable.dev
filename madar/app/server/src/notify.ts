// In-app notifications and the SMS simulation. Bodies are short Arabic sentences with first names only.
import { placeholders } from './util'

export interface Notice { user_id: number; kind: string; body: string; link?: string | null; sms?: 0 | 1; dedupe_key?: string | null }

const ROWS_PER_INSERT = 16   // 6 bound values per row, well under D1's 100-parameter limit

/**
 * Stores the notices (a notice with a `dedupe_key` is skipped when that key already exists) and simulates an SMS for
 * every notice flagged sms=1 whose recipient has no app. Returns how many notices were stored and how many SMS were
 * simulated.
 */
export async function notifyCounted(db: D1Database, notices: Notice[]): Promise<{ stored: number; sms: number }> {
  if (!notices.length) return { stored: 0, sms: 0 }
  const statements: D1PreparedStatement[] = []
  for (let i = 0; i < notices.length; i += ROWS_PER_INSERT) {
    const chunk = notices.slice(i, i + ROWS_PER_INSERT)
    const sql = 'INSERT OR IGNORE INTO notifications (user_id, kind, body, link, sms, dedupe_key) VALUES ' + chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    statements.push(db.prepare(sql).bind(...chunk.flatMap(n => [n.user_id, n.kind, n.body, n.link ?? null, n.sms ?? 0, n.dedupe_key ?? null])))
  }
  const results = await db.batch(statements)
  const stored = results.reduce((n, r) => n + (r.meta?.changes ?? 0), 0)
  const sms = await logSms(db, notices.filter(n => n.sms === 1))
  return { stored, sms }
}

/** Stores the notices; returns how many were stored (see notifyCounted for the SMS count). */
export async function notify(db: D1Database, notices: Notice[]): Promise<number> {
  return (await notifyCounted(db, notices)).stored
}

/** The users among `ids` who have opened the app at least once (a login in the audit log) — they need no SMS. */
export async function appUsers(db: D1Database, ids: number[]): Promise<Set<number>> {
  const out = new Set<number>()
  const unique = [...new Set(ids)]
  for (let i = 0; i < unique.length; i += 90) {
    const part = unique.slice(i, i + 90)
    const { results } = await db.prepare(`SELECT DISTINCT user_id FROM audit_log WHERE action = 'login' AND user_id IN (${placeholders(part.length)})`).bind(...part).all<{ user_id: number }>()
    for (const r of results) out.add(r.user_id)
  }
  return out
}

/**
 * The SMS gateway is phase 2. The pilot's SMS would go to guardians who have a phone number and have never opened the
 * app; the demo version only logs those as '[SMS] <phone> <body>' and reports the count (shown as «محاكاة في نسخة
 * العرض»). Returns how many were simulated.
 */
export async function logSms(db: D1Database, notices: Notice[]): Promise<number> {
  if (!notices.length) return 0
  const ids = [...new Set(notices.map(n => n.user_id))]
  const phones = new Map<number, string | null>()
  for (let i = 0; i < ids.length; i += 90) {
    const part = ids.slice(i, i + 90)
    const { results } = await db.prepare(`SELECT id, phone FROM users WHERE id IN (${placeholders(part.length)})`).bind(...part).all<{ id: number; phone: string | null }>()
    for (const r of results) phones.set(r.id, r.phone)
  }
  const withApp = await appUsers(db, ids)
  let n = 0
  for (const notice of notices) {
    const phone = phones.get(notice.user_id)
    if (!phone || withApp.has(notice.user_id)) continue
    console.log('[SMS]', phone, notice.body)
    n++
  }
  return n
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

// The activity log: sensitive actions with who did them. Never throws, never blocks the action it records.
import Dexie from 'dexie'
import { db } from '../db'
import type { AuditEntry, AuditKind, Permissions, Settings, User } from '../db/types'
import { uid } from './ids'

let who: (() => { id: string; name: string } | null) | null = null
/** The store tells the log who is at the till (set once at boot; avoids importing the store here). */
export function setAuditActor(fn: () => { id: string; name: string } | null): void { who = fn }

export async function logAudit(e: { kind: AuditKind; detail: string; refId?: string; amount?: number; user?: { id: string; name: string } | null }): Promise<void> {
  try {
    const u = e.user === undefined ? who?.() ?? null : e.user
    const row: AuditEntry = { id: uid(), createdAt: Date.now(), kind: e.kind, detail: e.detail.slice(0, 300), refId: e.refId, amount: e.amount, userId: u?.id, userName: u?.name }
    // inside someone else's transaction the audit table is out of scope: write after it commits
    if (Dexie.currentTransaction) { setTimeout(() => { void db.audit.add(row).catch(() => undefined) }, 0); return }
    await db.audit.add(row)
  } catch { /* the log must never break the action */ }
}

/** May this user do a cashier-restricted thing? Admins always may. */
export function allowed(user: Pick<User, 'role'> | null | undefined, settings: Pick<Settings, 'permissions'>, perm: keyof Permissions): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return !!settings.permissions[perm]
}

export async function recentAudit(limit = 300): Promise<AuditEntry[]> {
  return db.audit.orderBy('createdAt').reverse().limit(limit).toArray()
}
export async function pruneAudit(keep = 5000): Promise<void> {
  const n = await db.audit.count()
  if (n <= keep) return
  const old = await db.audit.orderBy('createdAt').limit(n - keep).primaryKeys()
  await db.audit.bulkDelete(old)
}

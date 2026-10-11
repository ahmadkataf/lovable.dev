// Pure helpers of the staff module: the role/permission matrix and the guards that keep the clinic manageable
// (someone must always be able to sign in as admin). Covered by tests/auth.test.ts.
import type { Activity, Role, User } from '@/db/types'
import type { Permission } from '@/app/session'
import { normalizeText } from '@/lib/format'
import { isEmail, isPhone, pinError, pinErrorKey, type Errors } from '@/features/auth/lib'

export const ROLES: Role[] = ['admin', 'doctor', 'assistant', 'receptionist']
/** Areas in the order the matrix lists them: daily work first, administration last. */
export const AREAS: Permission[] = ['patients', 'appointments', 'clinical', 'billing', 'inventory', 'reports', 'manage', 'settings', 'staff']
/**
 * What each role may do. Mirrors PERMS in src/app/session.tsx (not exported there); keep both in step.
 */
export const ROLE_PERMS: Record<Role, Permission[]> = {
  admin: ['manage', 'clinical', 'billing', 'reports', 'inventory', 'patients', 'appointments', 'settings', 'staff'],
  doctor: ['clinical', 'billing', 'reports', 'inventory', 'patients', 'appointments'],
  assistant: ['clinical', 'inventory', 'patients', 'appointments'],
  receptionist: ['billing', 'patients', 'appointments', 'inventory'],
}
export function roleCan(role: Role, perm: Permission): boolean { return ROLE_PERMS[role]?.includes(perm) ?? false }
/** Areas a role can use, in matrix order. */
export function roleAreas(role: Role): Permission[] { return AREAS.filter(a => roleCan(role, a)) }

/** Badge tone per role, the same everywhere. */
export const ROLE_TONE: Record<Role, 'primary' | 'info' | 'purple' | 'orange'> = { admin: 'primary', doctor: 'info', assistant: 'purple', receptionist: 'orange' }

/** Ten preset colours for avatars and the calendar (data, stored on the user). */
export const STAFF_COLORS = ['#0E8F86', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0891B2', '#4F46E5', '#CA8A04', '#DC2626']
/** The first preset colour no active member uses yet (falls back to the first). */
export function nextFreeColor(users: Pick<User, 'color' | 'active'>[]): string {
  const used = new Set(users.filter(u => u.active).map(u => u.color.toUpperCase()))
  return STAFF_COLORS.find(c => !used.has(c.toUpperCase())) ?? STAFF_COLORS[0]
}

// ---- guards -----------------------------------------------------------------------------------
type U = Pick<User, 'id' | 'role' | 'active'>
export type Block = 'self' | 'lastAdmin'

export function activeAdmins<T extends U>(users: T[]): T[] { return users.filter(u => u.active && u.role === 'admin') }
/** Would the clinic be left without an active admin if `target` stopped being one? */
function isLastActiveAdmin(target: U, users: U[]): boolean {
  return target.active && target.role === 'admin' && !activeAdmins(users).some(u => u.id !== target.id)
}
/** Why `target` cannot be deactivated (null = allowed). */
export function deactivateBlock(target: U, users: U[], selfId?: string | null): Block | null {
  if (target.id === selfId) return 'self'
  if (isLastActiveAdmin(target, users)) return 'lastAdmin'
  return null
}
/** Why `target` cannot be deleted (null = allowed): not yourself, not the last admin (active or not). */
export function deleteBlock(target: U, users: U[], selfId?: string | null): Block | null {
  if (target.id === selfId) return 'self'
  if (target.role === 'admin' && !users.some(u => u.id !== target.id && u.role === 'admin' && u.active)) return 'lastAdmin'
  return null
}
/** Saving `target` with a new role / active flag must not remove the last active admin, nor lock yourself out. */
export function saveBlock(target: U, next: { role: Role; active: boolean }, users: U[], selfId?: string | null): Block | null {
  if (target.id === selfId && !next.active) return 'self'
  if (isLastActiveAdmin(target, users) && (next.role !== 'admin' || !next.active)) return 'lastAdmin'
  return null
}

// ---- lists ------------------------------------------------------------------------------------
const ROLE_ORDER: Record<Role, number> = { admin: 0, doctor: 1, assistant: 2, receptionist: 3 }
/** Active members first, then by role (admin → reception), then by name. */
export function sortStaff<T extends Pick<User, 'name' | 'role' | 'active'>>(users: T[]): T[] {
  return [...users].sort((a, b) => Number(b.active) - Number(a.active) || ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name, 'ar'))
}
export type StaffFilter = 'all' | 'active' | 'inactive'
export function filterStaff<T extends Pick<User, 'active'>>(users: T[], f: StaffFilter): T[] {
  return f === 'all' ? users : users.filter(u => (f === 'active' ? u.active : !u.active))
}
/** userId → last sign-in instant, from login activity rows (any order). */
export function lastLoginMap(rows: Pick<Activity, 'by' | 'at' | 'action'>[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    if (r.action !== 'login' || !r.by) continue
    if (!out[r.by] || r.at > out[r.by]) out[r.by] = r.at
  }
  return out
}

// ---- form -------------------------------------------------------------------------------------
export interface StaffDraft {
  name: string; title: string; role: Role; specialty: string; phone: string; email: string
  color: string; active: boolean; pin: string; pin2: string
}
/** Field → i18n key. `askPin`: creating, or "set a new PIN" switched on. `others`: the rest of the team (duplicate names). */
export function validateStaff(d: StaffDraft, askPin: boolean, others: Pick<User, 'name'>[] = []): Errors {
  const e: Errors = {}
  if (!d.name.trim()) e.name = 'v.required'
  else if (others.some(o => normalizeText(o.name) === normalizeText(d.name))) e.name = 'staff.v.duplicate'
  if (d.phone.trim() && !isPhone(d.phone)) e.phone = 'v.phone'
  if (d.email.trim() && !isEmail(d.email)) e.email = 'v.email'
  if (askPin) {
    const p = pinError(d.pin)
    if (p) e.pin = pinErrorKey(p)
    else { const c = pinError(d.pin, d.pin2); if (c) e.pin2 = d.pin2 ? pinErrorKey(c) : 'v.required' }
  }
  return e
}

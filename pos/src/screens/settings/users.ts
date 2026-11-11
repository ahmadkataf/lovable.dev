// Pure rules for the users section (tested): who may be deleted, deactivated or demoted, and PIN checks.
import type { User } from '../../db/types'

export type UserBlock = 'self' | 'lastAdmin' | null

export const activeAdmins = (users: User[]): User[] => users.filter(u => u.active && u.role === 'admin')

/** True when `target` is the only active admin, so losing it (delete / deactivate / demote) would lock the store. */
export function isLastActiveAdmin(users: User[], target: User): boolean {
  if (!target.active || target.role !== 'admin') return false
  return activeAdmins(users).every(u => u.id === target.id)
}

/** Why a user cannot be deleted: yourself, or the last active admin. null = allowed. */
export function deleteBlock(users: User[], target: User, meId: string | undefined): UserBlock {
  if (meId && target.id === meId) return 'self'
  if (isLastActiveAdmin(users, target)) return 'lastAdmin'
  return null
}
/** Why a user cannot be deactivated. */
export function deactivateBlock(users: User[], target: User, meId: string | undefined): UserBlock {
  if (meId && target.id === meId) return 'self'
  if (isLastActiveAdmin(users, target)) return 'lastAdmin'
  return null
}
/** Why a user cannot be made a cashier. */
export function demoteBlock(users: User[], target: User): UserBlock {
  return isLastActiveAdmin(users, target) ? 'lastAdmin' : null
}

export const PIN_RE = /^\d{4,6}$/
/** Arabic-Indic digits typed on a phone keyboard become western digits. */
export function normalizePin(s: string): string {
  return s.replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch))).replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch))).replace(/\D/g, '').slice(0, 6)
}
/** 'format' when not 4–6 digits, 'match' when the confirmation differs, null when fine. */
export function validatePin(pin: string, confirm: string): 'format' | 'match' | null {
  if (!PIN_RE.test(pin)) return 'format'
  if (pin !== confirm) return 'match'
  return null
}

export const QUICK_MAX = 8
/** Adds a quick-cash amount: positive, unique, at most QUICK_MAX, kept sorted. */
export function addQuickAmount(list: number[], n: number, decimals: number): { list: number[]; error?: 'invalid' | 'dup' | 'max' } {
  const f = 10 ** decimals
  const v = Math.round(n * f) / f
  if (!Number.isFinite(v) || v <= 0) return { list, error: 'invalid' }
  if (list.includes(v)) return { list, error: 'dup' }
  if (list.length >= QUICK_MAX) return { list, error: 'max' }
  return { list: [...list, v].sort((a, b) => a - b) }
}

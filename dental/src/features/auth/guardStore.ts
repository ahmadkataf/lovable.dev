// Where the sign-in lockout lives: one guard per user, in the settings table and in localStorage. The stricter
// copy wins, so clearing either one (or reloading, or restarting the app) does not reset a lock.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '@/db'
import { FRESH_GUARD, mergeGuards, normalizeGuard, parseGuards, type LoginGuard } from './lib'

export const GUARD_SETTING = 'loginGuard'
const LS_KEY = 'dentora.loginGuard'

function readLocal(): Record<string, LoginGuard> {
  try { return parseGuards(localStorage.getItem(LS_KEY)) } catch { return {} }
}
function writeLocal(map: Record<string, LoginGuard>): void {
  try { if (Object.keys(map).length) localStorage.setItem(LS_KEY, JSON.stringify(map)); else localStorage.removeItem(LS_KEY) } catch { /* private mode */ }
}

/** Every user's guard, both copies merged. */
export async function loadGuards(): Promise<Record<string, LoginGuard>> {
  const stored = await getSetting<unknown>(GUARD_SETTING, null).catch(() => null)
  return mergeGuards(parseGuards(stored), readLocal())
}
export async function guardFor(userId: string, now: number): Promise<LoginGuard> {
  return normalizeGuard((await loadGuards())[userId] ?? FRESH_GUARD, now)
}
/** Stores a user's guard (null = forget it, after a good PIN or a PIN reset) in both places. */
export async function saveGuard(userId: string, g: LoginGuard | null): Promise<void> {
  const map = await loadGuards()
  if (g && (g.fails || g.until || g.locks)) map[userId] = g
  else if (map[userId]) delete map[userId]
  else return
  writeLocal(map)
  try { await db.settings.put({ key: GUARD_SETTING, value: map }) } catch { /* the localStorage copy still holds */ }
}

/** The guard of one user, live (the sign-in screen shows the lock and the countdown from it). */
export function useLoginGuard(userId: string | null | undefined): LoginGuard | undefined {
  return useLiveQuery(async () => {
    if (!userId) return FRESH_GUARD
    const stored = await getSetting<unknown>(GUARD_SETTING, null)
    return mergeGuards(parseGuards(stored), readLocal())[userId] ?? FRESH_GUARD
  }, [userId])
}

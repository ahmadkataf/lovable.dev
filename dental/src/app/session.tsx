import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, logActivity } from '@/db'
import type { Role, User } from '@/db/types'
import { hashPin, needsRehash, randomHex, verifyPin } from '@/lib/crypto'
import { trustedNow } from '@/license/clock'
import { FRESH_GUARD, isLocked, registerFailure, type LoginGuard } from '@/features/auth/lib'
import { guardFor, saveGuard } from '@/features/auth/guardStore'
import {
  LOCK_AFTER_KEY, SESSION_KEY, idleFor, lockAfterMs, parseRunSession, restoredSession, serializeRunSession, shouldLock, type RunSession,
} from './sessionLib'

// The signed-in user lives for one run of the app only (sessionStorage: kept across a reload, gone when the
// window or the app is closed), so every launch asks for a PIN. Auto-lock counts real elapsed time, including
// the time a phone or a PC spent asleep, and is checked again whenever the app comes back to the screen.

export interface Session {
  user: User | null              // signed-in user, null = locked / signed out
  users: User[]                  // all users (for the login screen)
  ready: boolean                 // users loaded
  login: (userId: string, pin: string) => Promise<boolean>
  /** login() with the details the sign-in screen needs: the user's lockout after this attempt. */
  attempt: (userId: string, pin: string) => Promise<{ ok: boolean; guard: LoginGuard }>
  logout: () => void
  lock: () => void
  role: Role | null
  isAdmin: boolean
  can: (perm: Permission) => boolean
}
export type Permission = 'manage' | 'clinical' | 'billing' | 'reports' | 'inventory' | 'patients' | 'appointments' | 'settings' | 'staff'
export const PERMS: Record<Role, Permission[]> = {
  admin: ['manage', 'clinical', 'billing', 'reports', 'inventory', 'patients', 'appointments', 'settings', 'staff'],
  doctor: ['clinical', 'billing', 'reports', 'inventory', 'patients', 'appointments'],
  assistant: ['clinical', 'inventory', 'patients', 'appointments'],
  receptionist: ['billing', 'patients', 'appointments', 'inventory'],
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove', 'scroll'] as const
const CHECK_EVERY_MS = 10_000
const SAVE_EVERY_MS = 5_000

const readLockAfter = () => { try { return lockAfterMs(localStorage.getItem(LOCK_AFTER_KEY)) } catch { return lockAfterMs(null) } }
function readRun(): RunSession | null { try { return parseRunSession(sessionStorage.getItem(SESSION_KEY)) } catch { return null } }
function writeRun(s: RunSession | null): void {
  try { if (s) sessionStorage.setItem(SESSION_KEY, serializeRunSession(s)); else sessionStorage.removeItem(SESSION_KEY) } catch { /* storage blocked: the session stays in memory */ }
}

/**
 * The session this page load starts with. Earlier versions kept the user in localStorage, which signed the
 * last user in at every launch: that copy is removed and never trusted, except as a hand-off from automated
 * test tooling (navigator.webdriver), which no real browser or app window sets.
 */
function initialSession(): RunSession | null {
  let legacy: string | null = null
  try { legacy = localStorage.getItem(SESSION_KEY); if (legacy !== null) localStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  const now = Date.now()
  const run = restoredSession(readRun(), readLockAfter(), now)
  if (run) return run
  const automated = typeof navigator !== 'undefined' && (navigator as { webdriver?: boolean }).webdriver === true
  if (legacy && automated) { const s = { id: legacy, at: now }; writeRun(s); return s }
  writeRun(null)
  return null
}

const Ctx = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const users = useLiveQuery(() => db.users.toArray(), [])
  const [run, setRun] = useState<RunSession | null>(initialSession)
  const userId = run?.id ?? null
  const user = useMemo(() => (users ?? []).find(u => u.id === userId && u.active) ?? null, [users, userId])

  // the last activity: wall-clock time, and monotonic time when it happened during this page load
  const lastRef = useRef<{ wall: number; mono: number | null }>({ wall: run?.at ?? Date.now(), mono: null })
  const start = useCallback((id: string | null) => {
    const s = id ? { id, at: Date.now() } : null
    lastRef.current = { wall: Date.now(), mono: performance.now() }
    writeRun(s); setRun(s)
  }, [])

  const attempt = useCallback(async (id: string, pin: string) => {
    const now = trustedNow()
    const guard = await guardFor(id, now)
    if (isLocked(guard, now)) return { ok: false, guard }
    const u = await db.users.get(id)
    const ok = !!u && u.active && await verifyPin(pin, u.pinSalt, u.pinHash)
    if (!ok) {
      const next = registerFailure(guard, now)
      await saveGuard(id, next)
      return { ok: false, guard: next }
    }
    await saveGuard(id, null)
    // PINs stored by earlier versions (fast SHA-256) are rewritten with the slow hash now that the PIN is known
    if (needsRehash(u.pinHash)) {
      try { const salt = randomHex(); await db.users.update(id, { pinSalt: salt, pinHash: await hashPin(pin, salt) }) } catch { /* next time */ }
    }
    start(id)
    void logActivity({ type: 'system', action: 'login', message: u.name, by: u.id })
    return { ok: true, guard: FRESH_GUARD }
  }, [start])
  const login = useCallback(async (id: string, pin: string) => (await attempt(id, pin)).ok, [attempt])
  const logout = useCallback(() => start(null), [start])
  const lock = useCallback(() => start(null), [start])

  // auto-lock after inactivity; Settings dispatches 'dentora:lockAfter' when the delay changes
  const [lockTick, setLockTick] = useState(0)
  useEffect(() => {
    const h = () => setLockTick(n => n + 1)
    window.addEventListener('dentora:lockAfter', h)
    return () => window.removeEventListener('dentora:lockAfter', h)
  }, [])
  useEffect(() => {
    if (!userId) return
    const after = readLockAfter()
    const last = lastRef.current
    let saved = last.wall
    const idle = () => idleFor(last, { wall: Date.now(), mono: performance.now() })
    const check = () => { if (shouldLock(idle(), after)) { lock(); return true } return false }
    const bump = () => {
      if (check()) return                       // the first touch after a long sleep locks instead of extending
      last.wall = Date.now(); last.mono = performance.now()
      if (last.wall - saved >= SAVE_EVERY_MS) { saved = last.wall; writeRun({ id: userId, at: last.wall }) }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { writeRun({ id: userId, at: last.wall }); saved = last.wall }
      else check()
    }
    if (check()) return
    const id = window.setInterval(check, CHECK_EVERY_MS)
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, bump, { passive: true, capture: true }))
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    document.addEventListener('resume', check)
    window.addEventListener('dentora:resume', check)      // sent by a native shell when the app comes back to the screen
    return () => {
      window.clearInterval(id)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, bump, { capture: true }))
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      document.removeEventListener('resume', check)
      window.removeEventListener('dentora:resume', check)
    }
  }, [userId, lock, lockTick])

  const value = useMemo<Session>(() => ({
    user, users: users ?? [], ready: users !== undefined, login, attempt, logout, lock,
    role: user?.role ?? null, isAdmin: user?.role === 'admin',
    can: (p: Permission) => !!user && PERMS[user.role].includes(p),
  }), [user, users, login, attempt, logout, lock])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useSession(): Session {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession outside SessionProvider')
  return v
}
/** Signs out of this run (for code outside React, e.g. after wiping the database). */
export function clearSession(): void { writeRun(null) }

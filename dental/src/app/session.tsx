import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, logActivity } from '@/db'
import type { Role, User } from '@/db/types'
import { verifyPin } from '@/lib/crypto'

const KEY = 'dentora.session'
const LOCK_AFTER_MS = 15 * 60 * 1000   // auto-lock after inactivity (0 = never); can be changed in Settings later via localStorage 'dentora.lockAfter'

export interface Session {
  user: User | null              // signed-in user, null = locked / signed out
  users: User[]                  // all users (for the login screen)
  ready: boolean                 // users loaded
  login: (userId: string, pin: string) => Promise<boolean>
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

const Ctx = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const users = useLiveQuery(() => db.users.toArray(), [])
  const [userId, setUserId] = useState<string | null>(() => { try { return localStorage.getItem(KEY) } catch { return null } })
  const user = useMemo(() => (users ?? []).find(u => u.id === userId && u.active) ?? null, [users, userId])

  const persist = (id: string | null) => { setUserId(id); try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY) } catch { /* ignore */ } }
  const login = useCallback(async (id: string, pin: string) => {
    const u = await db.users.get(id)
    if (!u || !u.active) return false
    const ok = await verifyPin(pin, u.pinSalt, u.pinHash)
    if (ok) { persist(id); void logActivity({ type: 'system', action: 'login', message: u.name, by: u.id }) }
    return ok
  }, [])
  const logout = useCallback(() => persist(null), [])
  const lock = useCallback(() => persist(null), [])

  // auto-lock after inactivity; Settings dispatches 'dentora:lockAfter' when the delay changes
  const [lockTick, setLockTick] = useState(0)
  useEffect(() => {
    const h = () => setLockTick(n => n + 1)
    window.addEventListener('dentora:lockAfter', h)
    return () => window.removeEventListener('dentora:lockAfter', h)
  }, [])
  useEffect(() => {
    if (!user) return
    let after = LOCK_AFTER_MS
    try { const v = localStorage.getItem('dentora.lockAfter'); if (v !== null) after = Number(v) } catch { /* ignore */ }
    if (!after) return
    let t = window.setTimeout(lock, after)
    const bump = () => { window.clearTimeout(t); t = window.setTimeout(lock, after) }
    const evs = ['mousemove', 'keydown', 'touchstart', 'click']
    evs.forEach(e => window.addEventListener(e, bump, { passive: true }))
    return () => { window.clearTimeout(t); evs.forEach(e => window.removeEventListener(e, bump)) }
  }, [user, lock, lockTick])

  const value = useMemo<Session>(() => ({
    user, users: users ?? [], ready: users !== undefined, login, logout, lock,
    role: user?.role ?? null, isAdmin: user?.role === 'admin',
    can: (p: Permission) => !!user && PERMS[user.role].includes(p),
  }), [user, users, login, logout, lock])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useSession(): Session {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession outside SessionProvider')
  return v
}

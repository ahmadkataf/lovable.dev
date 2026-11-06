// Pure helpers of the session (sign-in per app run, auto-lock by real elapsed time). Covered by tests/auth-session.test.ts.

/** sessionStorage key of the signed-in user for this run of the app. Never kept in localStorage. */
export const SESSION_KEY = 'dentora.session'
/** localStorage key of the auto-lock delay in ms (written by Settings → Preferences; 0 = never). */
export const LOCK_AFTER_KEY = 'dentora.lockAfter'
export const DEFAULT_LOCK_AFTER_MS = 15 * 60 * 1000

/** Who is signed in during this run, and when they last did something (wall-clock ms). */
export interface RunSession { id: string; at: number }

export function parseRunSession(raw: string | null | undefined): RunSession | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    if (v && typeof v.id === 'string' && v.id && Number.isFinite(v.at)) return { id: v.id, at: v.at }
  } catch { /* not ours */ }
  return null
}
export const serializeRunSession = (s: RunSession) => JSON.stringify({ id: s.id, at: s.at })

/** The auto-lock delay: the stored value in ms when it is a sane number (0 = never), else 15 minutes. */
export function lockAfterMs(stored: string | null | undefined): number {
  if (stored === null || stored === undefined || stored.trim() === '') return DEFAULT_LOCK_AFTER_MS
  const ms = Number(stored)
  return Number.isFinite(ms) && ms >= 0 ? ms : DEFAULT_LOCK_AFTER_MS
}

/**
 * How long the user has been away. Two clocks, the larger wins: the wall clock keeps counting while the device
 * sleeps (page timers do not), and the monotonic clock still counts if the wall clock is moved back.
 * `lastMono` is null when the last activity happened in an earlier page load (monotonic time restarts there).
 */
export function idleFor(last: { wall: number; mono: number | null }, now: { wall: number; mono: number }): number {
  const wall = now.wall - last.wall
  const mono = last.mono === null ? 0 : now.mono - last.mono
  return Math.max(wall, mono, 0)
}
export function shouldLock(idleMs: number, lockAfter: number): boolean {
  return lockAfter > 0 && idleMs >= lockAfter
}
/** A run session restored after a reload is still valid only while it has not been idle past the lock delay. */
export function restoredSession(s: RunSession | null, lockAfter: number, now: number): RunSession | null {
  if (!s) return null
  return shouldLock(now - s.at, lockAfter) ? null : s
}

/** "Mac" platforms show ⌘ in shortcut hints; Windows, Linux, Android and the rest show Ctrl. */
export function isApplePlatform(nav: { platform?: string; userAgent?: string; userAgentData?: { platform?: string } } | undefined): boolean {
  if (!nav) return false
  const p = nav.userAgentData?.platform || nav.platform || ''
  if (/mac|iphone|ipad|ipod/i.test(p)) return true
  return !p && /Macintosh|iPhone|iPad/.test(nav.userAgent || '')
}
/** A shortcut hint such as "Ctrl+Shift+N" (or "⌘⇧N" on a Mac). `keys` are 'mod', 'shift' and a letter. */
export function shortcutLabel(keys: string[], apple: boolean): string {
  if (apple) return keys.map(k => (k === 'mod' ? '⌘' : k === 'shift' ? '⇧' : k.toUpperCase())).join('')
  return keys.map(k => (k === 'mod' ? 'Ctrl' : k === 'shift' ? 'Shift' : k.toUpperCase())).join('+')
}

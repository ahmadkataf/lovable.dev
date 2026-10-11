// Sign-in per app run, auto-lock by real elapsed time, the durable lockout, the admin PIN reset, and the shell helpers.
import { db, resetDatabase } from '../src/db'
import { hashPin, pinLengthOf, sha256Hex, verifyPin } from '../src/lib/crypto'
import {
  DEFAULT_LOCK_AFTER_MS, idleFor, isApplePlatform, lockAfterMs, parseRunSession, restoredSession, serializeRunSession, shortcutLabel, shouldLock,
} from '../src/app/sessionLib'
import { isTextEntry, keyboardLikelyOpen } from '../src/app/keyboard'
import { pluralForm, tPlural } from '../src/app/plural'
import { translate } from '../src/i18n'
import { FRESH_GUARD, MAX_ATTEMPTS, isLocked, registerFailure } from '../src/features/auth/lib'
import { GUARD_SETTING, guardFor, loadGuards, saveGuard } from '../src/features/auth/guardStore'
import { RESET_USED_SETTING, applyPinReset, checkReset } from '../src/features/auth/resetPin'
import { deviceNumber, packResetCode, resetMessage, dayNumber } from '../src/license/core'

const MIN = 60_000

describe('session: one run of the app, locked by real elapsed time', () => {
  it('reads and writes the run session defensively', () => {
    expect(parseRunSession(null)).toBeNull()
    expect(parseRunSession('u-admin')).toBeNull()                       // the old localStorage value is not a run session
    expect(parseRunSession('{"id":"u1"}')).toBeNull()
    expect(parseRunSession(serializeRunSession({ id: 'u1', at: 5 }))).toEqual({ id: 'u1', at: 5 })
  })
  it('reads the auto-lock delay (0 = never), 15 minutes by default', () => {
    expect(DEFAULT_LOCK_AFTER_MS).toBe(15 * MIN)
    expect(lockAfterMs(null)).toBe(15 * MIN)
    expect(lockAfterMs('')).toBe(15 * MIN)
    expect(lockAfterMs('300000')).toBe(5 * MIN)
    expect(lockAfterMs('0')).toBe(0)
    expect(lockAfterMs('-4')).toBe(15 * MIN)
    expect(lockAfterMs('soon')).toBe(15 * MIN)
  })
  it('counts the time asleep (wall clock) and a clock moved back (monotonic clock)', () => {
    const last = { wall: 1_000_000, mono: 5_000 }
    // a phone that slept for an hour: page timers stood still (monotonic +2 s), the wall clock moved an hour
    expect(idleFor(last, { wall: 1_000_000 + 60 * MIN, mono: 7_000 })).toBe(60 * MIN)
    expect(shouldLock(idleFor(last, { wall: 1_000_000 + 60 * MIN, mono: 7_000 }), 15 * MIN)).toBe(true)
    // the wall clock set back a day while the app stayed open 20 minutes
    expect(idleFor(last, { wall: 1_000_000 - 24 * 60 * MIN, mono: 5_000 + 20 * MIN })).toBe(20 * MIN)
    // last activity from an earlier page load: only the wall clock is comparable
    expect(idleFor({ wall: 1_000_000, mono: null }, { wall: 1_000_000 + 3 * MIN, mono: 1 })).toBe(3 * MIN)
    expect(shouldLock(14 * MIN, 15 * MIN)).toBe(false)
    expect(shouldLock(99 * 60 * MIN, 0)).toBe(false)                    // "never"
  })
  it('a reload keeps the session only while it has not been idle past the delay', () => {
    const s = { id: 'u1', at: 1_000_000 }
    expect(restoredSession(s, 15 * MIN, 1_000_000 + 2 * MIN)).toBe(s)
    expect(restoredSession(s, 15 * MIN, 1_000_000 + 16 * MIN)).toBeNull()
    expect(restoredSession(s, 0, 1_000_000 + 9e9)).toBe(s)
    expect(restoredSession(null, 15 * MIN, 0)).toBeNull()
  })
  it('the session lives in sessionStorage, never in localStorage', async () => {
    const src = (await import('node:fs')).readFileSync('src/app/session.tsx', 'utf8')
    expect(src).not.toMatch(/localStorage\.setItem\(\s*SESSION_KEY/)
    expect(src).toMatch(/sessionStorage\.setItem\(SESSION_KEY/)
  })
})

describe('shell helpers', () => {
  it('shows Ctrl on Windows, Linux and Android, ⌘ only on Apple devices', () => {
    expect(isApplePlatform({ platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Electron/38' })).toBe(false)
    expect(isApplePlatform({ platform: 'Linux armv8l', userAgent: 'Mozilla/5.0 (Linux; Android 14) Dentora/1.0.0' })).toBe(false)
    expect(isApplePlatform({ platform: 'MacIntel' })).toBe(true)
    expect(isApplePlatform({ userAgentData: { platform: 'macOS' } })).toBe(true)
    expect(isApplePlatform(undefined)).toBe(false)
    expect(shortcutLabel(['mod', 'shift', 'n'], false)).toBe('Ctrl+Shift+N')
    expect(shortcutLabel(['mod', 'k'], false)).toBe('Ctrl+K')
    expect(shortcutLabel(['mod', 'shift', 'a'], true)).toBe('⌘⇧A')
  })
  it('knows when the on-screen keyboard is up', () => {
    expect(keyboardLikelyOpen(640, 340, true)).toBe(true)              // 300 px taken by the keyboard
    expect(keyboardLikelyOpen(640, 340, false)).toBe(false)            // no text field focused
    expect(keyboardLikelyOpen(640, 600, true)).toBe(false)             // the address bar sliding away
    const input = document.createElement('input')
    const box = document.createElement('input'); box.type = 'checkbox'
    const area = document.createElement('textarea')
    const ro = document.createElement('input'); ro.readOnly = true
    expect([input, box, area, ro, document.createElement('button'), null].map(el => isTextEntry(el))).toEqual([true, false, true, false, false, false])
  })
  it('counts with the Arabic plural forms', () => {
    expect([0, 1, 2, 3, 10, 11, 99, 100].map(n => pluralForm(n, 'ar'))).toEqual(['zero', 'one', 'two', 'few', 'few', 'many', 'many', 'other'])
    const t = (k: string, p?: Record<string, string | number>) => translate('ar', k, p)
    expect(tPlural(t, 'ar', 'auth.login.dotsLabel', 1)).toBe('كُتب رقم واحد')
    expect(tPlural(t, 'ar', 'auth.login.dotsLabel', 4)).toBe('كُتبت 4 أرقام')
    expect(tPlural(t, 'ar', 'staff.deleteHistory', 2)).toContain('بسجلّين')
    expect(tPlural(t, 'ar', 'staff.deleteHistory', 12)).toContain('12 سجلاً')
    expect(tPlural((k, p) => translate('en', k, p), 'en', 'staff.deleteHistory', 1)).toContain('linked to 1 record ')
    expect(tPlural(t, 'ar', 'auth.setup.trial', 7)).toContain('7 أيام')
  })
})

describe('sign-in lockout survives a restart', () => {
  beforeEach(async () => { await resetDatabase(); localStorage.clear() })
  it('is stored per user in the database and in localStorage; the stricter copy wins', async () => {
    let g = FRESH_GUARD
    const now = Date.now()
    for (let i = 0; i < MAX_ATTEMPTS; i++) g = registerFailure(g, now)
    await saveGuard('u1', g)
    expect(isLocked(await guardFor('u1', now + 1000), now + 1000)).toBe(true)
    expect(await guardFor('u2', now)).toEqual(FRESH_GUARD)
    // clearing localStorage (or the database copy) does not unlock
    localStorage.clear()
    expect(isLocked(await guardFor('u1', now + 1000), now + 1000)).toBe(true)
    await saveGuard('u1', g)
    await db.settings.delete(GUARD_SETTING)
    expect(isLocked(await guardFor('u1', now + 1000), now + 1000)).toBe(true)
    // a good PIN forgets it everywhere
    await saveGuard('u1', null)
    expect(await loadGuards()).toEqual({})
    expect(localStorage.getItem('dentora.loginGuard')).toBeNull()
  })
})

describe('admin PIN reset with a seller code', () => {
  let keys: { priv: CryptoKey; pub: JsonWebKey }
  beforeAll(async () => {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    keys = { priv: kp.privateKey, pub: await crypto.subtle.exportKey('jwk', kp.publicKey) }
  })
  beforeEach(async () => { await resetDatabase(); localStorage.clear() })
  const code = async (device: string, at: number) => {
    const day = dayNumber(at)
    return packResetCode(day, new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.priv, resetMessage(device, day))))
  }

  it('sets a new PIN for the admin, turns the account back on, clears its lock, and works once', async () => {
    const now = Date.now()
    const device = await deviceNumber('clinic-pc')
    const legacy = await sha256Hex('s:2468')
    await db.users.bulkPut([
      { id: 'owner', name: 'د. سامر', role: 'admin', pinSalt: 's', pinHash: legacy, color: '#000', active: false, createdAt: '', updatedAt: '' },
      { id: 'doc', name: 'ليلى', role: 'doctor', pinSalt: 's', pinHash: legacy, color: '#000', active: true, createdAt: '', updatedAt: '' },
    ])
    let g = FRESH_GUARD
    for (let i = 0; i < MAX_ATTEMPTS; i++) g = registerFailure(g, now)
    await saveGuard('owner', g)
    const c = await code(device, now)
    const message = `مرحباً،\nهذا رمز إعادة تعيين رمز الدخول:\n‎${c}\nرقم الجهاز: ‎${device}`
    expect((await checkReset(device, message, now, keys.pub)).ok).toBe(true)
    // only an admin account can be reset this way, and the PIN must be valid
    await expect(applyPinReset({ device, code: message, userId: 'doc', pin: '1357', now, activityMessage: n => n, publicKey: keys.pub })).rejects.toThrow('user')
    await expect(applyPinReset({ device, code: message, userId: 'owner', pin: '12', now, activityMessage: n => n, publicKey: keys.pub })).rejects.toThrow('pin')
    const r = await applyPinReset({ device, code: message, userId: 'owner', pin: '1357', now, activityMessage: n => `reset ${n}`, publicKey: keys.pub })
    expect(r.ok).toBe(true)
    const owner = (await db.users.get('owner'))!
    expect(owner.active).toBe(true)
    expect(await verifyPin('1357', owner.pinSalt, owner.pinHash)).toBe(true)
    expect(await verifyPin('2468', owner.pinSalt, owner.pinHash)).toBe(false)
    expect(pinLengthOf(owner.pinHash)).toBe(4)
    expect(isLocked(await guardFor('owner', now + 1), now + 1)).toBe(false)
    expect((await db.users.get('doc'))!.pinHash).toBe(legacy)          // nobody else is touched
    // the same code cannot be used twice
    expect(await checkReset(device, c, now, keys.pub)).toEqual({ ok: false, reason: 'used' })
    expect(await applyPinReset({ device, code: c, userId: 'owner', pin: '9999', now, activityMessage: n => n, publicKey: keys.pub })).toEqual({ ok: false, reason: 'used' })
    expect(((await db.settings.get(RESET_USED_SETTING))?.value as unknown[]).length).toBe(1)
    // another device's code, or the app's real key, are refused
    expect(await checkReset(await deviceNumber('other-pc'), c, now, keys.pub)).toEqual({ ok: false, reason: 'device' })
    expect((await checkReset(device, await code(device, now), now)).ok).toBe(false)
    expect((await db.activity.toArray()).some(a => a.message === 'reset د. سامر')).toBe(true)
  })
  it('hashes PINs with PBKDF2 from a reset as from setup', async () => {
    expect(await hashPin('1357', 'x')).toMatch(/^pbkdf2-sha256\$/)
  })
})

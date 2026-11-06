// The trial countdown, the licence status, the licence clock (never runs back) and the read-only guard of the database.
import { db, importBackup, resetDatabase } from '../src/db'
import { TRIAL_DAYS, type CodeCheck } from '../src/license/core'
import { clockBehindBy, instantOf, latestOf, noteTime, resetClockForTests, trustedNow } from '../src/license/clock'
import { evaluateLicense, trialDaysLeft } from '../src/license/state'
import { startTrialOnce } from '../src/license/useLicense'
import { GUARDED_TABLES, installTrialStartGuard, isReadOnlyError, setReadOnlyGuard, trialStartChangeAllowed } from '../src/license/guard'
import { tPlural } from '../src/app/plural'
import { translate } from '../src/i18n'
import license from '../src/i18n/modules/license'
import auth from '../src/i18n/modules/auth'
import staff from '../src/i18n/modules/staff'

const DAY = 86_400_000
const T0 = Date.UTC(2026, 9, 11, 9)
const iso = (t: number) => new Date(t).toISOString()

describe('trial countdown', () => {
  it('counts 7 days down from the start and never more than 7', () => {
    expect(TRIAL_DAYS).toBe(7)
    expect(trialDaysLeft(iso(T0), T0)).toBe(7)
    expect(trialDaysLeft(iso(T0), T0 + 1)).toBe(7)
    expect(trialDaysLeft(iso(T0), T0 + 5 * DAY)).toBe(2)
    expect(trialDaysLeft(iso(T0), T0 + 6.5 * DAY)).toBe(1)
    expect(trialDaysLeft(iso(T0), T0 + 7 * DAY)).toBe(0)
    expect(trialDaysLeft(iso(T0), T0 + 400 * DAY)).toBe(0)
    // a clock set back before the start (or a start edited into the future) gives no extra days
    expect(trialDaysLeft(iso(T0), T0 - 0.5 * DAY)).toBe(7)
    expect(trialDaysLeft(iso(T0), T0 - 400 * DAY)).toBe(0)
    expect(trialDaysLeft('2099-01-01T00:00:00.000Z', T0)).toBe(0)
    expect(trialDaysLeft(null, T0)).toBe(7)          // not written yet (the first second of a new install)
  })
  it('says "licence ended" when a paid code ran out, "trial ended" otherwise', () => {
    const until = new Date(Date.UTC(2027, 9, 10))
    const active: CodeCheck = { ok: true, plan: 'pro', until }
    expect(evaluateLicense(iso(T0 - 30 * DAY), active, T0)).toMatchObject({ status: 'active', ended: null, plan: 'pro', until })
    expect(evaluateLicense(iso(T0), { ok: true, plan: 'standard', until: null }, T0).daysLeft).toBe(9999)
    // on the code's last day there is still one day left
    expect(evaluateLicense(iso(T0), active, until.getTime() + 10 * 3600_000).daysLeft).toBe(1)
    const ended = evaluateLicense(iso(T0 - 400 * DAY), { ok: false, reason: 'expired', plan: 'standard', until }, T0 + 400 * DAY)
    expect(ended).toEqual({ status: 'expired', ended: 'license', plan: 'standard', until, daysLeft: 0 })
    expect(evaluateLicense(iso(T0 - 30 * DAY), null, T0)).toMatchObject({ status: 'expired', ended: 'trial' })
    expect(evaluateLicense(iso(T0 - 2 * DAY), null, T0)).toMatchObject({ status: 'trial', daysLeft: 5 })
    // a code for another device (an old backup) is ignored: the trial decides
    expect(evaluateLicense(iso(T0 - 2 * DAY), { ok: false, reason: 'device' }, T0)).toMatchObject({ status: 'trial' })
  })
})

describe('trial banner wording', () => {
  const ar = (n: number) => tPlural((k, p) => translate('ar', k, p), 'ar', 'license.banner.trial', n)
  const en = (n: number) => tPlural((k, p) => translate('en', k, p), 'en', 'license.banner.trial', n)
  it('uses the Arabic number forms (1, 2, 3–10, 11+) and the English singular', () => {
    expect(ar(1)).toBe('نسخة تجريبية — تبقّى يوم واحد')
    expect(ar(2)).toBe('نسخة تجريبية — تبقّى يومان')
    expect(ar(3)).toBe('نسخة تجريبية — تبقّى 3 أيام')
    expect(ar(7)).toBe('نسخة تجريبية — تبقّى 7 أيام')
    expect(ar(10)).toBe('نسخة تجريبية — تبقّى 10 أيام')
    expect(ar(11)).toBe('نسخة تجريبية — تبقّى 11 يوماً')
    expect(ar(100)).toBe('نسخة تجريبية — تبقّى 100 يوم')
    expect(en(1)).toBe('Trial version — 1 day left')
    expect(en(7)).toBe('Trial version — 7 days left')
    for (const s of [ar(7), ar(2), en(1)]) expect(s).not.toMatch(/يوماً$|1 days/)
  })
  it('uses British "licence" for the noun in English, and keeps ar/en keys in step', () => {
    expect(Object.keys(license.ar).sort()).toEqual(Object.keys(license.en).sort())
    for (const [k, v] of Object.entries(license.en)) expect(v, k).not.toMatch(/\blicense\b/i)
    // the sign-in and staff screens talk about the licence too
    for (const dict of [auth, staff]) {
      expect(Object.keys(dict.ar).sort()).toEqual(Object.keys(dict.en).sort())
      for (const [k, v] of Object.entries(dict.en)) expect(v, k).not.toMatch(/\blicense\b/i)
    }
    expect(translate('en', 'license.status.licenseEnded')).toBe('Licence expired')
    expect(translate('ar', 'license.banner.licenseEnded', { date: '10 تشرين الأول 2027' })).toContain('انتهى ترخيص')
  })
})

describe('the licence clock never runs back', () => {
  beforeEach(() => { resetClockForTests(); localStorage.clear() })
  afterEach(() => { vi.useRealTimers(); resetClockForTests(); localStorage.clear() })
  it('keeps the latest time seen, from the database or localStorage', () => {
    expect(instantOf('2026-10-11T09:00:00.000Z')).toBe(T0)
    expect(instantOf('nope')).toBeNaN()
    expect(instantOf(Date.UTC(2200, 0, 1))).toBeNaN()                  // not a plausible device time
    expect(latestOf([iso(T0), null, T0 + 5, 'x'])).toBe(T0 + 5)
    vi.useFakeTimers(); vi.setSystemTime(T0)
    noteTime(iso(T0 + 3 * DAY))                                          // the database remembers a later day
    expect(trustedNow()).toBe(T0 + 3 * DAY)
    expect(clockBehindBy()).toBe(3 * DAY)
    // after a restart (memory gone), localStorage still remembers
    resetClockForTests()
    expect(trustedNow()).toBe(T0 + 3 * DAY)
    vi.setSystemTime(T0 + 10 * DAY)
    expect(trustedNow()).toBe(T0 + 10 * DAY)
    expect(clockBehindBy()).toBe(0)
  })
  it('so turning the clock back does not revive the trial', () => {
    vi.useFakeTimers(); vi.setSystemTime(T0 + 30 * DAY)
    noteTime()
    vi.setSystemTime(T0 + 2 * DAY)                                       // clock set back 28 days
    expect(trialDaysLeft(iso(T0), Date.now())).toBe(5)                   // what the raw clock would say
    expect(trialDaysLeft(iso(T0), trustedNow())).toBe(0)                 // what the app says
  })
})

describe('read-only mode is enforced by the database', () => {
  beforeEach(async () => { setReadOnlyGuard(false); await resetDatabase() })
  afterAll(() => setReadOnlyGuard(false))
  const patient = { id: 'p1', fileNo: 1, name: 'سامر', phone: '', archived: false, createdAt: '', updatedAt: '' } as any

  it('refuses writes to clinical and financial tables while read-only, and only then', async () => {
    await db.patients.add(patient)
    setReadOnlyGuard(true)
    for (const write of [
      () => db.patients.add({ ...patient, id: 'p2' }),
      () => db.patients.update('p1', { name: 'x' }),
      () => db.patients.put({ ...patient, name: 'y' }),
      () => db.patients.delete('p1'),
      () => db.payments.add({ id: 'pay', patientId: 'p1', amount: 5 } as any),
      () => db.invoices.bulkAdd([{ id: 'i1' } as any]),
      () => db.transaction('rw', db.patients, db.activity, () => db.patients.add({ ...patient, id: 'p3' })),
    ]) {
      const e = await write().then(() => null, err => err)
      expect(isReadOnlyError(e), String(write)).toBe(true)
    }
    expect((await db.patients.get('p1'))?.name).toBe('سامر')
    expect(await db.patients.count()).toBe(1)
    // still allowed: settings (activation), clinic preferences, users (PIN reset), the activity feed
    await db.settings.put({ key: 'license', value: { code: 'x' } })
    await db.clinic.put({ id: 'clinic', name: 'c' } as any)
    await db.users.put({ id: 'u', name: 'u', role: 'admin', active: true } as any)
    await db.activity.add({ id: 'a', type: 'system', action: 'login', message: '', at: '' })
    // a restore or "start over" replaces everything in one transaction over every table
    await importBackup({ app: 'dentora', version: 1, exportedAt: iso(T0), tables: { patients: [{ ...patient, id: 'p9' }] } } as any)
    expect((await db.patients.toArray()).map(p => p.id)).toEqual(['p9'])
    await resetDatabase(['license'])
    expect(await db.patients.count()).toBe(0)
    setReadOnlyGuard(false)
    await db.patients.add(patient)
    expect(await db.patients.count()).toBe(1)
    expect(GUARDED_TABLES).not.toContain('settings')
    expect(GUARDED_TABLES).not.toContain('users')
    expect(GUARDED_TABLES).toContain('payments')
  })
  it('never lets the trial start move later', async () => {
    expect(trialStartChangeAllowed(iso(T0), iso(T0 - DAY), T0)).toBe(true)
    expect(trialStartChangeAllowed(iso(T0), iso(T0 + DAY), T0 + 2 * DAY)).toBe(false)
    expect(trialStartChangeAllowed('2099-01-01T00:00:00.000Z', iso(T0), T0)).toBe(true)   // a broken value may be fixed
    expect(trialStartChangeAllowed(iso(T0), 'nope', T0)).toBe(false)
    installTrialStartGuard()
    await db.settings.put({ key: 'installedAt', value: iso(T0) })
    await expect(db.settings.put({ key: 'installedAt', value: iso(T0 + 3_600_000) })).rejects.toThrow()
    await expect(db.settings.delete('installedAt')).rejects.toThrow()
    await db.settings.put({ key: 'installedAt', value: iso(T0 - DAY) })
    expect((await db.settings.get('installedAt'))?.value).toBe(iso(T0 - DAY))
    // a restore keeps the earliest start (db.mergeDeviceSettings) and is allowed to rewrite the row
    await importBackup({ app: 'dentora', version: 1, exportedAt: iso(T0), tables: { settings: [{ key: 'installedAt', value: '2099-01-01T00:00:00.000Z' }] } } as any)
    expect((await db.settings.get('installedAt'))?.value).toBe(iso(T0 - DAY))
  })
})

describe('the trial start is written once', () => {
  beforeEach(async () => { resetClockForTests(); localStorage.clear(); await resetDatabase() })
  afterEach(() => { vi.useRealTimers(); resetClockForTests(); localStorage.clear() })
  it('writes the licence clock’s "now" only when a fresh read finds no start', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(T0)
    expect(await startTrialOnce()).toBe(true)
    expect((await db.settings.get('installedAt'))?.value).toBe(iso(T0))
    vi.setSystemTime(T0 + 3 * DAY)
    expect(await startTrialOnce()).toBe(false)                                    // a second render, a second window
    expect((await db.settings.get('installedAt'))?.value).toBe(iso(T0))
    await Promise.all([startTrialOnce(), startTrialOnce(), startTrialOnce()])     // racing calls never move it
    expect((await db.settings.get('installedAt'))?.value).toBe(iso(T0))
  })
  it('replaces only a start that cannot be read; a future one stays (it counts as no trial left)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(T0)
    await db.settings.put({ key: 'installedAt', value: 'garbage' })
    expect(await startTrialOnce()).toBe(true)
    expect((await db.settings.get('installedAt'))?.value).toBe(iso(T0))
    await db.transaction('rw', db.tables, () => db.settings.put({ key: 'installedAt', value: '2099-01-01T00:00:00.000Z' }))
    expect(await startTrialOnce()).toBe(false)
    expect(trialDaysLeft('2099-01-01T00:00:00.000Z', T0)).toBe(0)
  })
  it('caps the days left at the trial length and stays expired when the clock is set back', () => {
    expect(trialDaysLeft(iso(T0 + 2 * 3_600_000), T0)).toBe(TRIAL_DAYS)           // a start a little ahead (time zones)
    expect(trialDaysLeft(iso(T0 + 2 * DAY), T0)).toBe(0)                          // more than a day ahead: expired
    noteTime(iso(T0 + 30 * DAY))                                                 // seen 30 days later
    expect(trialDaysLeft(iso(T0), trustedNow(T0))).toBe(0)                        // the device clock back at T0: still expired
  })
})

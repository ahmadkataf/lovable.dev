import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '@/db'
import { rawDeviceId } from '@/platform'
import { checkCode, deviceNumber, extractCode, formatCode, type CodeCheck, type Plan } from './core'
import { clockBehindBy, LAST_SEEN_SETTING, markPersisted, noteTime, shouldPersist, trustedNow } from './clock'
import { evaluateLicense, type EndedReason, type LicenseStatus } from './state'
import { installTrialStartGuard, setReadOnlyGuard } from './guard'

export type ActivateResult = 'ok' | 'format' | 'device' | 'expired' | 'kind'

export interface LicenseState {
  loading: boolean
  status: LicenseStatus                          // expired = no valid code and no trial left
  ended: EndedReason | null                      // expired because the trial ran out, or because a paid licence did
  plan: Plan | null
  until: Date | null                             // active: the licence's last day (null = lifetime); ended licence: its last day
  daysLeft: number                               // trial days left, or licence days left (9999 for lifetime)
  device: string                                 // the number the clinic sends to the seller ('' while unknown)
  deviceError: boolean                           // the Windows/Android shell could not tell the device id (no code can be checked)
  retryDevice: () => void                        // asks the shell for the device id again
  readOnly: boolean                              // true when expired: the app shows data but blocks writes
  clockBehind: boolean                           // the device clock is more than a day behind the latest time seen
  now: () => number                              // the licence clock (never goes back), for other licence checks
  activate: (code: string) => Promise<ActivateResult>
  deactivate: () => Promise<void>
}
interface Stored { code: string; plan: Plan; until: string | null }
const DAY = 86_400_000
const CLOCK_TICK = 5 * 60_000

const Ctx = createContext<LicenseState | null>(null)

/**
 * Works the licence out once for the whole app (above the router), and switches the read-only guard of the
 * database on and off with it. Screens read it with useLicense().
 */
export function LicenseProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState('')
  const [deviceError, setDeviceError] = useState(false)
  const [deviceAsk, setDeviceAsk] = useState(0)
  const [checked, setChecked] = useState<CodeCheck | null | undefined>(undefined)
  const [tick, setTick] = useState(0)
  const installedAt = useLiveQuery(() => getSetting<string | null>('installedAt', null), [])
  const stored = useLiveQuery(() => getSetting<Stored | null>('license', null), [])
  const lastSeen = useLiveQuery(() => getSetting<unknown>(LAST_SEEN_SETTING, null), [])

  useEffect(() => { installTrialStartGuard() }, [])
  // the device number; when the shell cannot tell the id (rawDeviceId retries and falls back to the last one it
  // gave), the licence screen says so and offers to ask again, and no code is taken as valid meanwhile
  useEffect(() => {
    let alive = true
    rawDeviceId().then(id => deviceNumber(id)).then(d => { if (alive) { setDevice(d); setDeviceError(false) } })
      .catch(() => { if (alive) setDeviceError(true) })
    return () => { alive = false }
  }, [deviceAsk])
  const retryDevice = useCallback(() => { setDeviceError(false); setDeviceAsk(n => n + 1) }, [])
  // The trial starts on the first run. The live query can read "absent" for a moment (a restore or a reset replacing
  // the settings), so the start is written only when a fresh read, in the same transaction, finds none.
  useEffect(() => {
    if (installedAt === undefined || isInstant(installedAt)) return
    void startTrialOnce().catch(() => undefined)
  }, [installedAt])

  // the licence clock: take in the stored latest time, then move it on while the app runs (and after a sleep)
  useEffect(() => {
    if (lastSeen === undefined) return
    const latest = noteTime(lastSeen)
    if (shouldPersist(lastSeen)) { markPersisted(latest); void setSetting(LAST_SEEN_SETTING, new Date(latest).toISOString()).catch(() => undefined) }
  }, [lastSeen, tick])
  useEffect(() => {
    const bump = () => { if (document.visibilityState !== 'hidden') setTick(n => n + 1) }
    const id = window.setInterval(bump, CLOCK_TICK)
    document.addEventListener('visibilitychange', bump)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', bump) }
  }, [])

  // the stored code, checked against this device and the licence clock (re-checked each tick: a code can run out while open)
  useEffect(() => {
    let alive = true
    if (!device || stored === undefined) return
    if (!stored) { setChecked(null); return }
    checkCode(device, stored.code, new Date(trustedNow())).then(r => { if (alive) setChecked(r) }).catch(() => { if (alive) setChecked(null) })
    return () => { alive = false }
  }, [device, stored, tick])

  const activate = useCallback(async (code: string): Promise<ActivateResult> => {
    if (!device) return 'device'
    const r = await checkCode(device, code, new Date(trustedNow()))
    if (!r.ok) return r.reason
    await setSetting('license', { code: formatCode(extractCode(code)), plan: r.plan, until: r.until ? r.until.toISOString() : null } satisfies Stored)
    return 'ok'
  }, [device])
  const deactivate = useCallback(async () => { await db.settings.delete('license') }, [])

  // the same object while nothing visible changed, so the regular clock tick does not re-render every screen
  const last = useRef<{ key: string; value: LicenseState } | null>(null)
  const value = useMemo<LicenseState>(() => {
    // without a device id no code can be checked: the trial clock alone decides until the id is back
    const noDevice = !device && deviceError
    const loading = (!device && !deviceError) || installedAt === undefined || stored === undefined || (!noDevice && checked === undefined)
    const e = evaluateLicense(installedAt, noDevice ? null : checked ?? null, trustedNow())
    const next: LicenseState = {
      loading, ...e, device, deviceError: noDevice, retryDevice, readOnly: !loading && e.status === 'expired',
      clockBehind: clockBehindBy() > DAY, now: () => trustedNow(), activate, deactivate,
    }
    const key = JSON.stringify([loading, e.status, e.ended, e.plan, e.until?.getTime() ?? null, e.daysLeft, device, noDevice, next.clockBehind])
    if (last.current && last.current.key === key && last.current.value.activate === activate && last.current.value.deactivate === deactivate) return last.current.value
    last.current = { key, value: next }
    return next
  }, [device, deviceError, installedAt, stored, checked, activate, deactivate, retryDevice, tick])

  useEffect(() => { setReadOnlyGuard(value.readOnly) }, [value.readOnly])
  return createElement(Ctx.Provider, { value }, children)
}

const isInstant = (v: unknown) => typeof v === 'string' && v !== '' && Number.isFinite(new Date(v).getTime())

/**
 * Records the trial start (the licence clock's "now") unless one is already stored. Reads and writes in one
 * transaction, so it never replaces a start written in the meantime; a start that cannot be read is replaced.
 * Resolves true when it wrote one.
 */
export function startTrialOnce(): Promise<boolean> {
  return db.transaction('rw', db.settings, async () => {
    const row = await db.settings.get('installedAt')
    if (row && isInstant(row.value)) return false
    await db.settings.put({ key: 'installedAt', value: new Date(trustedNow()).toISOString() })
    return true
  })
}

export function useLicense(): LicenseState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLicense outside LicenseProvider')
  return v
}

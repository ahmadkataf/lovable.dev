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
  device: string                                 // the number the clinic sends to the seller
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
  const [checked, setChecked] = useState<CodeCheck | null | undefined>(undefined)
  const [tick, setTick] = useState(0)
  const installedAt = useLiveQuery(() => getSetting<string | null>('installedAt', null), [])
  const stored = useLiveQuery(() => getSetting<Stored | null>('license', null), [])
  const lastSeen = useLiveQuery(() => getSetting<unknown>(LAST_SEEN_SETTING, null), [])

  useEffect(() => { installTrialStartGuard() }, [])
  useEffect(() => {
    let alive = true
    rawDeviceId().then(id => deviceNumber(id)).then(d => { if (alive) setDevice(d) }).catch(() => undefined)
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (installedAt === null) void setSetting('installedAt', new Date(trustedNow()).toISOString()).catch(() => undefined)
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
    const r = await checkCode(device, code, new Date(trustedNow()))
    if (!r.ok) return r.reason
    await setSetting('license', { code: formatCode(extractCode(code)), plan: r.plan, until: r.until ? r.until.toISOString() : null } satisfies Stored)
    return 'ok'
  }, [device])
  const deactivate = useCallback(async () => { await db.settings.delete('license') }, [])

  // the same object while nothing visible changed, so the regular clock tick does not re-render every screen
  const last = useRef<{ key: string; value: LicenseState } | null>(null)
  const value = useMemo<LicenseState>(() => {
    const loading = !device || installedAt === undefined || stored === undefined || checked === undefined
    const e = evaluateLicense(installedAt, checked ?? null, trustedNow())
    const next: LicenseState = {
      loading, ...e, device, readOnly: !loading && e.status === 'expired',
      clockBehind: clockBehindBy() > DAY, now: () => trustedNow(), activate, deactivate,
    }
    const key = JSON.stringify([loading, e.status, e.ended, e.plan, e.until?.getTime() ?? null, e.daysLeft, device, next.clockBehind])
    if (last.current && last.current.key === key && last.current.value.activate === activate && last.current.value.deactivate === deactivate) return last.current.value
    last.current = { key, value: next }
    return next
  }, [device, installedAt, stored, checked, activate, deactivate, tick])

  useEffect(() => { setReadOnlyGuard(value.readOnly) }, [value.readOnly])
  return createElement(Ctx.Provider, { value }, children)
}

export function useLicense(): LicenseState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLicense outside LicenseProvider')
  return v
}

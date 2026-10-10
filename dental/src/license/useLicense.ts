import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '@/db'
import { rawDeviceId } from '@/platform'
import { checkCode, deviceNumber, TRIAL_DAYS, type Plan } from './core'

export interface LicenseState {
  loading: boolean
  status: 'trial' | 'active' | 'expired'       // expired = trial over and no valid code
  plan: Plan | null
  until: Date | null                             // subscription end (null = lifetime) when active
  daysLeft: number                               // trial days left, or subscription days left (9999 for lifetime)
  device: string                                 // the number the clinic sends to the seller
  readOnly: boolean                              // true when expired: the app shows data but blocks writes
  activate: (code: string) => Promise<'ok' | 'format' | 'device' | 'expired'>
  deactivate: () => Promise<void>
}
interface Stored { code: string; plan: Plan; until: string | null }
const DAY = 86_400_000

export function useLicense(): LicenseState {
  const [device, setDevice] = useState('')
  const [raw, setRaw] = useState('')
  const [checked, setChecked] = useState<{ ok: boolean; plan: Plan | null; until: Date | null } | null>(null)
  const installedAt = useLiveQuery(() => getSetting<string | null>('installedAt', null), [])
  const stored = useLiveQuery(() => getSetting<Stored | null>('license', null), [])

  useEffect(() => { rawDeviceId().then(async id => { setRaw(id); setDevice(await deviceNumber(id)) }) }, [])
  useEffect(() => {
    if (installedAt === null) void setSetting('installedAt', new Date().toISOString())
  }, [installedAt])
  useEffect(() => {
    let alive = true
    if (!device || stored === undefined) return
    if (!stored) { setChecked({ ok: false, plan: null, until: null }); return }
    checkCode(device, stored.code).then(r => { if (alive) setChecked(r.ok ? { ok: true, plan: r.plan, until: r.until } : { ok: false, plan: null, until: null }) })
    return () => { alive = false }
  }, [device, stored])

  const activate = useCallback(async (code: string) => {
    const r = await checkCode(device, code)
    if (!r.ok) return r.reason
    await setSetting('license', { code, plan: r.plan, until: r.until ? r.until.toISOString() : null } satisfies Stored)
    return 'ok' as const
  }, [device])
  const deactivate = useCallback(async () => { await db.settings.delete('license') }, [])

  return useMemo<LicenseState>(() => {
    const loading = !device || installedAt === undefined || stored === undefined || checked === null
    const start = installedAt ? new Date(installedAt).getTime() : Date.now()
    const trialLeft = Math.max(0, Math.ceil((start + TRIAL_DAYS * DAY - Date.now()) / DAY))
    if (checked?.ok) {
      const left = checked.until ? Math.max(0, Math.ceil((checked.until.getTime() - Date.now()) / DAY)) : 9999
      return { loading, status: 'active', plan: checked.plan, until: checked.until, daysLeft: left, device, readOnly: false, activate, deactivate }
    }
    const status = trialLeft > 0 ? 'trial' : 'expired'
    return { loading, status, plan: null, until: null, daysLeft: trialLeft, device, readOnly: !loading && status === 'expired', activate, deactivate }
  }, [device, installedAt, stored, checked, activate, deactivate, raw])
}

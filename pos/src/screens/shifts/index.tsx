// /shifts: the open shift (or the card to open one), /shifts/history, /shifts/:id.
import './i18n'
import './shifts.css'
import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Clock, Unlock } from 'lucide-react'
import { db } from '../../db'
import { useT } from '../../i18n'
import { Button, Spinner } from '../../components/ui'
import { formatMoney, parseNumber, round } from '../../lib/money'
import { openShift, ShiftError } from '../../lib/shifts'
import { toast, useSettings, useStore, useUser } from '../../state/store'
import { AmountPad } from '../inventory/shared'
import { Dashboard } from './Dashboard'
import { History } from './History'
import { ShiftDetail } from './ShiftDetail'

function CurrentShift() {
  const t = useT()
  const storeShift = useStore(s => s.shift)
  const setShift = useStore(s => s.setShift)
  const open = useLiveQuery(async () => (await db.shifts.where('status').equals('open').first()) ?? null, [])
  // the database is the truth; keep the store in step (another screen may have opened / closed it)
  useEffect(() => { if (open !== undefined && open?.id !== storeShift?.id) setShift(open) }, [open, storeShift?.id, setShift])
  return (
    <div className="page">
      <div className="page-head"><h1>{t('nav.shifts')}</h1></div>
      <div className="page-body">
        {open === undefined ? <div className="empty"><Spinner /></div> : open === null ? <OpenCard /> : <Dashboard shift={open} />}
      </div>
    </div>
  )
}

function OpenCard() {
  const t = useT()
  const user = useUser()
  const setShift = useStore(s => s.setShift)
  const c = useSettings().currency
  const [v, setV] = useState('')
  const [busy, setBusy] = useState(false)
  const last = useLiveQuery(async () => (await db.shifts.where('status').equals('closed').reverse().sortBy('openedAt'))[0], [])
  const lastCash = last?.closingCash !== undefined ? round(last.closingCash, c.decimals) : undefined
  const confirm = async () => {
    if (busy || !user) return
    setBusy(true)
    try {
      const s = await openShift({ user, openingCash: parseNumber(v), decimals: c.decimals })
      setShift(s)
      toast(t('shifts.opened'), 'success')
    } catch (e) { toast(e instanceof ShiftError ? t(e.key) : t('common.error'), 'error'); setBusy(false) }
  }
  return (
    <div className="sh-open">
      <div className="card pad col sh-open-card">
        <div className="empty sh-open-empty">
          <div className="ico"><Clock size={32} /></div>
          <h3>{t('shifts.noOpen')}</h3>
          <p>{t('shifts.noOpenText')}</p>
        </div>
        <div className="label">{t('shifts.openingCash')}</div>
        <AmountPad value={v} onChange={setV} decimals={c.decimals} suffix={c.symbol} onEnter={() => void confirm()}
          quick={lastCash !== undefined && lastCash > 0 ? [{ label: t('shifts.lastClosing', { v: formatMoney(lastCash, c) }), value: String(lastCash) }] : undefined} />
        <Button variant="primary" size="xl" block icon={<Unlock size={20} />} loading={busy} onClick={() => void confirm()}>{t('shifts.open')}</Button>
        <p className="xs faint center">{t('shifts.openAs', { name: user?.name ?? '' })}</p>
      </div>
    </div>
  )
}

export default function ShiftsScreen() {
  return (
    <Routes>
      <Route index element={<CurrentShift />} />
      <Route path="history" element={<History />} />
      <Route path=":id" element={<ShiftDetail />} />
      <Route path="*" element={<Navigate to="/shifts" replace />} />
    </Routes>
  )
}

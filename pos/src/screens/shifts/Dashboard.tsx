// The open shift: who, since when, live numbers, cash in / out, and closing.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Clock, ArrowDownToLine, ArrowUpFromLine, Lock, History as HistoryIcon } from 'lucide-react'
import { db } from '../../db'
import type { Shift } from '../../db/types'
import { useT } from '../../i18n'
import { Avatar, Badge, Button, Field, Input, Modal, Spinner, useIsMobile } from '../../components/ui'
import { formatDateTime, formatTime } from '../../lib/format'
import { formatMoney, parseNumber, round } from '../../lib/money'
import { addCashMove, closeShift, shiftMinutes, shiftSummary, ShiftError } from '../../lib/shifts'
import { toast, useSettings, useStore, useUser } from '../../state/store'
import { AmountPad } from '../inventory/shared'
import { SummaryCards, diffKind } from './SummaryCards'
import { durationLabel } from './report'

function useNow(everyMs: number): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const h = window.setInterval(() => setNow(Date.now()), everyMs); return () => clearInterval(h) }, [everyMs])
  return now
}

export function Dashboard({ shift }: { shift: Shift }) {
  const t = useT()
  const nav = useNavigate()
  const user = useUser()
  const settings = useSettings()
  const c = settings.currency
  const mobile = useIsMobile()
  const now = useNow(30000)
  const [move, setMove] = useState<'in' | 'out' | null>(null)
  const [closing, setClosing] = useState(false)
  const summary = useLiveQuery(() => shiftSummary(shift.id, c.decimals), [shift.id, c.decimals])
  const cashMoves = useLiveQuery(() => db.cashMoves.where('shiftId').equals(shift.id).reverse().sortBy('createdAt'), [shift.id], [])
  const other = !!user && user.id !== shift.userId

  return (
    <div className="col">
      <div className="card pad sh-head">
        <Avatar name={shift.userName} size={44} round />
        <div className="grow truncate">
          <div className="row" style={{ gap: 8 }}><span className="bold truncate">{shift.userName}</span><Badge kind="primary"><Clock size={12} /> {t('shifts.openBadge')}</Badge></div>
          <div className="small muted">{t('shifts.openedAtTime', { t: formatDateTime(shift.openedAt) })} · {durationLabel(shiftMinutes(shift, now))}</div>
        </div>
        <Button variant="ghost" icon={<HistoryIcon size={18} />} iconOnly={mobile} onClick={() => nav('/shifts/history')} title={t('shifts.history')}>{t('shifts.history')}</Button>
      </div>
      {other && <div className="banner warn">{t('shifts.openedByOther', { name: shift.userName })}</div>}

      {!summary ? <div className="empty"><Spinner /></div> : <SummaryCards shift={shift} summary={summary} />}

      <div className="sh-actions">
        <Button variant="soft" size="lg" icon={<ArrowDownToLine size={18} />} onClick={() => setMove('in')}>{t('shifts.cashIn')}</Button>
        <Button variant="soft-danger" size="lg" icon={<ArrowUpFromLine size={18} />} onClick={() => setMove('out')}>{t('shifts.cashOut')}</Button>
        <Button variant="primary" size="lg" icon={<Lock size={18} />} onClick={() => setClosing(true)} disabled={!summary}>{t('shifts.close')}</Button>
      </div>

      <div className="section-title">{t('shifts.cashMoves')}<span className="faint num">{cashMoves.length}</span></div>
      {cashMoves.length === 0 ? <p className="faint small center">{t('shifts.noMoves')}</p> : (
        <div className="card list">
          {cashMoves.map(m => (
            <div key={m.id} className="list-row">
              <span className={`sh-move-ico ${m.type}`}>{m.type === 'in' ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}</span>
              <span className="grow truncate"><span className="title truncate">{m.note ?? (m.type === 'in' ? t('shifts.moveIn') : t('shifts.moveOut'))}</span><span className="sub num">{formatTime(m.createdAt)}</span></span>
              <span className={`end num bold ${m.type === 'in' ? 'sh-pos' : 'sh-neg'}`}>{m.type === 'in' ? '+' : '-'}{formatMoney(m.amount, c)}</span>
            </div>
          ))}
        </div>
      )}

      {move && <CashMoveModal shift={shift} type={move} onClose={() => setMove(null)} />}
      {closing && summary && <CloseModal shift={shift} expected={summary.expectedCash} onClose={() => setClosing(false)} />}
    </div>
  )
}

function CashMoveModal({ shift, type, onClose }: { shift: Shift; type: 'in' | 'out'; onClose: () => void }) {
  const t = useT()
  const user = useUser()
  const c = useSettings().currency
  const [v, setV] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const n = parseNumber(v)
  const confirm = async () => {
    if (!(n > 0) || busy || !user) return
    setBusy(true)
    try {
      await addCashMove({ shiftId: shift.id, type, amount: n, note, user, decimals: c.decimals })
      toast(t('shifts.moveSaved'), 'success')
      onClose()
    } catch (e) { toast(e instanceof ShiftError ? t(e.key) : t('common.error'), 'error'); setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={type === 'in' ? t('shifts.cashIn') : t('shifts.cashOut')} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant={type === 'in' ? 'primary' : 'danger'} disabled={!(n > 0)} loading={busy} onClick={() => void confirm()}>{t('common.confirm')}</Button>
      </>
    }>
      <div className="col">
        <p className="muted small">{type === 'in' ? t('shifts.cashInText') : t('shifts.cashOutText')}</p>
        <AmountPad value={v} onChange={setV} decimals={c.decimals} suffix={c.symbol} onEnter={() => void confirm()} />
        <Field label={t('common.note')}><Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('shifts.notePh')} /></Field>
      </div>
    </Modal>
  )
}

function CloseModal({ shift, expected, onClose }: { shift: Shift; expected: number; onClose: () => void }) {
  const t = useT()
  const nav = useNavigate()
  const user = useUser()
  const setShift = useStore(s => s.setShift)
  const c = useSettings().currency
  const [v, setV] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const n = parseNumber(v)
  const diff = round(n - expected, c.decimals)
  const kind = diffKind(diff)
  const confirm = async () => {
    if (v === '' || busy) return
    setBusy(true)
    try {
      const closerNote = user && user.id !== shift.userId ? t('shifts.closedByNote', { name: user.name }) : ''
      const fullNote = [note.trim(), closerNote].filter(Boolean).join(' — ')
      await closeShift({ shiftId: shift.id, countedCash: n, note: fullNote, decimals: c.decimals })
      setShift(null)
      toast(t('shifts.closed'), 'success')
      nav(`/shifts/${shift.id}?closed=1`, { replace: true })
    } catch (e) { toast(e instanceof ShiftError ? t(e.key) : t('common.error'), 'error'); setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={t('shifts.close')} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={v === ''} loading={busy} onClick={() => void confirm()}>{t('shifts.closeConfirm')}</Button>
      </>
    }>
      <div className="col">
        <div className="sh-close-grid">
          <div><div className="xs faint">{t('shifts.expected')}</div><div className="num bold">{formatMoney(expected, c)}</div></div>
          <div><div className="xs faint">{t('shifts.difference')}</div><div className={`num bold sh-diff-${kind}`}>{v === '' ? '—' : `${diff > 0 ? '+' : ''}${formatMoney(diff, c)}`}</div><div className={`xs sh-diff-${kind}`}>{v === '' ? '' : t('shifts.' + kind)}</div></div>
        </div>
        <div className="small muted">{t('shifts.countedHint')}</div>
        <AmountPad value={v} onChange={setV} decimals={c.decimals} suffix={c.symbol} onEnter={() => void confirm()} quick={[{ label: t('shifts.sameAsExpected'), value: String(round(expected, c.decimals)) }]} />
        <Field label={t('common.note')}><Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('shifts.closeNotePh')} /></Field>
      </div>
    </Modal>
  )
}

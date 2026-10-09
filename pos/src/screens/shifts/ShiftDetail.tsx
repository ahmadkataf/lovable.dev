// A shift's report (closed, or still open): the numbers, the cash moves, print and share.
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Printer, Share2, Clock, CheckCircle2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { db } from '../../db'
import { useT } from '../../i18n'
import { Avatar, Badge, Button, Empty, Spinner } from '../../components/ui'
import { formatDateTime, formatTime } from '../../lib/format'
import { formatMoney } from '../../lib/money'
import { shiftMinutes, shiftSummary } from '../../lib/shifts'
import { toast, useSettings } from '../../state/store'
import { SubHead } from '../inventory/shared'
import { SummaryCards } from './SummaryCards'
import { durationLabel, printShiftReport, shareShiftReport } from './report'

export function ShiftDetail() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const t = useT()
  const nav = useNavigate()
  const settings = useSettings()
  const c = settings.currency
  const shift = useLiveQuery(async () => (await db.shifts.get(id)) ?? null, [id])
  const summary = useLiveQuery(() => shiftSummary(id, c.decimals), [id, c.decimals])
  const cashMoves = useLiveQuery(() => db.cashMoves.where('shiftId').equals(id).sortBy('createdAt'), [id], [])
  if (shift === undefined) return <div className="empty"><Spinner /></div>
  if (shift === null) return <div className="page"><SubHead title={t('shifts.report')} back="/shifts/history" /><Empty icon={<Clock size={32} />} title={t('shifts.notFound')} /></div>
  const closed = shift.status === 'closed'
  const print = async () => { if (summary) await printShiftReport(shift, summary, settings, cashMoves) }
  const share = async () => { if (summary && !(await shareShiftReport(shift, summary, settings))) toast(t('common.error'), 'error') }
  return (
    <div className="page">
      <SubHead title={t('shifts.report')} sub={`${formatDateTime(shift.openedAt)}${closed ? ` – ${formatTime(shift.closedAt!)}` : ''}`} back={closed ? '/shifts/history' : '/shifts'} actions={
        <>
          <Button variant="ghost" iconOnly icon={<Share2 size={18} />} onClick={() => void share()} title={t('common.share')} aria-label={t('common.share')} disabled={!summary} />
          <Button variant="ghost" iconOnly icon={<Printer size={18} />} onClick={() => void print()} title={t('common.print')} aria-label={t('common.print')} disabled={!summary} />
        </>
      } />
      <div className="page-body col">
        {params.get('closed') === '1' && <div className="banner sh-banner-ok"><CheckCircle2 size={18} /> {t('shifts.justClosed')}</div>}
        {!closed && <div className="banner warn">{t('shifts.stillOpen')}<Button size="sm" variant="soft" onClick={() => nav('/shifts')}>{t('shifts.current')}</Button></div>}
        <div className="card pad sh-head">
          <Avatar name={shift.userName} size={44} round />
          <div className="grow truncate">
            <div className="row" style={{ gap: 8 }}><span className="bold truncate">{shift.userName}</span>{closed ? <Badge>{t('shifts.closedBadge')}</Badge> : <Badge kind="primary"><Clock size={12} /> {t('shifts.openBadge')}</Badge>}</div>
            <div className="small muted">{t('shifts.openedAtTime', { t: formatDateTime(shift.openedAt) })}{closed ? ` · ${t('shifts.closedAtTime', { t: formatDateTime(shift.closedAt!) })}` : ''} · {durationLabel(shiftMinutes(shift))}</div>
            {shift.note && <div className="small muted">{t('common.note')}: {shift.note}</div>}
          </div>
        </div>
        {!summary ? <div className="empty"><Spinner /></div> : <SummaryCards shift={shift} summary={summary} />}
        {cashMoves.length > 0 && (
          <>
            <div className="section-title">{t('shifts.cashMoves')}<span className="faint num">{cashMoves.length}</span></div>
            <div className="card list">
              {cashMoves.map(m => (
                <div key={m.id} className="list-row">
                  <span className={`sh-move-ico ${m.type}`}>{m.type === 'in' ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}</span>
                  <span className="grow truncate"><span className="title truncate">{m.note ?? (m.type === 'in' ? t('shifts.moveIn') : t('shifts.moveOut'))}</span><span className="sub num">{formatTime(m.createdAt)}</span></span>
                  <span className={`end num bold ${m.type === 'in' ? 'sh-pos' : 'sh-neg'}`}>{m.type === 'in' ? '+' : '-'}{formatMoney(m.amount, c)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="sh-actions two">
          <Button variant="outline" size="lg" icon={<Printer size={18} />} onClick={() => void print()} disabled={!summary}>{t('shifts.print')}</Button>
          <Button variant="soft" size="lg" icon={<Share2 size={18} />} onClick={() => void share()} disabled={!summary}>{t('common.share')}</Button>
        </div>
      </div>
    </div>
  )
}

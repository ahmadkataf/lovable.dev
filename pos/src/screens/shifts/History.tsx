// Closed shifts, newest first. Cashiers see their own; the admin sees everyone's.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../../db'
import type { Shift } from '../../db/types'
import { useT, useLang } from '../../i18n'
import { Avatar, Badge, Button, Empty, Spinner } from '../../components/ui'
import { formatDay, formatTime } from '../../lib/format'
import { formatMoney } from '../../lib/money'
import { shiftDifference } from '../../lib/shifts'
import { useSettings, useUser, isAdmin } from '../../state/store'
import { SubHead } from '../inventory/shared'
import { diffKind } from './SummaryCards'

const PAGE = 50

export function History() {
  const t = useT()
  const nav = useNavigate()
  const lang = useLang()
  const user = useUser()
  const admin = isAdmin(user)
  const c = useSettings().currency
  const [limit, setLimit] = useState(PAGE)
  const data = useLiveQuery(async () => {
    let coll = db.shifts.where('status').equals('closed')
    if (!admin && user) coll = coll.and(s => s.userId === user.id)
    const rows = await coll.reverse().sortBy('openedAt')
    const totals = new Map<string, number>()
    const page = rows.slice(0, limit)
    const sales = await db.sales.where('shiftId').anyOf(page.map(s => s.id)).toArray()
    for (const s of sales) totals.set(s.shiftId!, (totals.get(s.shiftId!) ?? 0) + s.total)
    return { rows: page, hasMore: rows.length > limit, totals }
  }, [admin, user?.id, limit])
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight
  const diffBadge = (s: Shift) => {
    const d = shiftDifference(s, c.decimals)
    const kind = diffKind(d)
    return <Badge kind={kind === 'exact' ? 'primary' : kind === 'over' ? 'info' : 'danger'} className="num">{kind === 'exact' ? t('shifts.exact') : `${d > 0 ? '+' : ''}${formatMoney(d, c)}`}</Badge>
  }
  return (
    <div className="page">
      <SubHead title={t('shifts.history')} back="/shifts" />
      <div className="page-body col">
        {!data ? <div className="empty"><Spinner /></div> : data.rows.length === 0 ? (
          <Empty icon={<Clock size={32} />} title={t('shifts.noHistory')} text={t('shifts.noHistoryText')} />
        ) : (
          <div className="card list">
            {data.rows.map(s => (
              <button key={s.id} type="button" className="list-row" onClick={() => nav(`/shifts/${s.id}`)}>
                <Avatar name={s.userName} round size={38} />
                <span className="grow truncate">
                  <span className="title truncate">{formatDay(s.openedAt)} <span className="num muted">{formatTime(s.openedAt)} – {s.closedAt ? formatTime(s.closedAt) : ''}</span></span>
                  <span className="sub truncate">{s.userName} · {t('shifts.sales')}: <span className="num">{formatMoney(data.totals.get(s.id) ?? 0, c)}</span></span>
                </span>
                <span className="end">{diffBadge(s)}</span>
                <Chevron size={18} className="faint" />
              </button>
            ))}
          </div>
        )}
        {data?.hasMore && <Button block variant="outline" onClick={() => setLimit(l => l + PAGE)}>{t('common.more')}</Button>}
      </div>
    </div>
  )
}

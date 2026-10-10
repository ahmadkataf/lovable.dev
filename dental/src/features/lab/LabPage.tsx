// /lab — the lab board: every order by status, what is due, what is late and what the lab costs this month.
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlarmClock, CalendarClock, FlaskConical, Plus, Search, Wallet, X } from 'lucide-react'
import { db } from '@/db'
import type { LabOrder, Patient, User } from '@/db/types'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useDebounced, useDoctors, useIsMobile, useMoney, useUsers } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { Alert, Avatar, Button, Card, Chip, DataTable, EmptyState, Input, PageHeader, Pagination, Segmented, Select, Skeleton, StatCard, usePagination, type Column } from '@/ui'
import { fmtDate, fmtMonth } from '@/lib/dates'
import { STATUS_FILTERS, filterOrders, labNames, labStats, sortOrders, statusCounts, type DueFilter, type StatusFilter } from './lib'
import { DueBadge, LabStatusBadge, TeethBadges } from './parts'
import { useElementWidth } from '@/features/prescriptions/parts'
import { LabRowActions } from './LabRowActions'
import LabOrderFormModal from './LabOrderFormModal'
import LabSlipModal from './LabSlip'
import './lab.css'

export default function LabPage() {
  const { t, lang } = useI18n()
  const money = useMoney()
  const mobile = useIsMobile()
  const { readOnly } = useLicense()
  const users = useUsers(false)
  const doctors = useDoctors()
  const today = todayISO()

  const orders = useLiveQuery(() => db.labOrders.toArray(), [])
  const patientIds = useMemo(() => [...new Set((orders ?? []).map(o => o.patientId))], [orders])
  const patients = useLiveQuery(async () => new Map((await db.patients.bulkGet(patientIds)).filter((p): p is Patient => !!p).map(p => [p.id, p])), [patientIds.join(',')])
  const userMap = useMemo(() => new Map<string, User>(users.map(u => [u.id, u])), [users])

  const [status, setStatus] = useState<StatusFilter>('all')
  const [lab, setLab] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [due, setDue] = useState<DueFilter>('')
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [form, setForm] = useState<{ order?: LabOrder } | null>(null)
  const [slipId, setSlipId] = useState<string | null>(null)

  const all = orders ?? []
  const stats = useMemo(() => labStats(all, today), [all, today])
  const labs = useMemo(() => labNames(all), [all])
  const name = (id: string) => patients?.get(id)?.name
  // counts follow every filter except the status itself
  const base = useMemo(() => filterOrders(all, { status: 'all', lab, doctorId, due, q: dq, today, patientName: name }), [all, lab, doctorId, due, dq, today, patients]) // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => statusCounts(base), [base])
  const rows = useMemo(() => sortOrders(status === 'all' ? base : base.filter(o => o.status === status), today), [base, status, today])
  const pg = usePagination(rows, mobile ? 15 : 20)

  // The board picks the roomiest layout that fits the width it really has (sidebar open or collapsed, the chosen
  // font, long lab names): the full table, then the table with icon-only advance buttons, then the card list.
  const [boardRef, boardW] = useElementWidth()
  const boardEl = useRef<HTMLDivElement | null>(null)
  const setBoard = useCallback((el: HTMLDivElement | null) => { boardEl.current = el; boardRef(el) }, [boardRef])
  const [layout, setLayout] = useState<'full' | 'compact' | 'cards'>('full')
  const fitFor = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (mobile) return
    if (fitFor.current !== boardW) { fitFor.current = boardW; if (layout !== 'full') { setLayout('full'); return } }
    if (layout === 'cards') return
    const wrap = boardEl.current?.querySelector('.table-wrap')
    if (wrap && wrap.scrollWidth > wrap.clientWidth + 1) setLayout(layout === 'full' ? 'compact' : 'cards')
  })
  const cards = mobile || layout === 'cards'
  const filtered = !!(lab || doctorId || due || dq || status !== 'all')
  const clearAll = () => { setLab(''); setDoctorId(''); setDue(''); setQ(''); setStatus('all') }

  const patientCell = (o: LabOrder) => {
    const p = patients?.get(o.patientId)
    if (!p) return <span className="muted">{t('unknown')}</span>
    return (
      <Link to={`/patients/${p.id}?tab=lab`} className="lab-patient-link" onClick={e => e.stopPropagation()}>
        <Avatar name={p.name} src={p.photo} size="sm" />
        <span style={{ minWidth: 0 }}><span className="cell-main truncate">{p.name}</span><span className="cell-sub num">#{p.fileNo}</span></span>
      </Link>
    )
  }
  const rowActions = (o: LabOrder) => <LabRowActions order={o} patientName={name(o.patientId) ?? ''} onEdit={() => setForm({ order: o })} onPrint={() => setSlipId(o.id)} compact={!cards && layout === 'compact'} />
  const columns: Column<LabOrder>[] = [
    { key: 'patient', header: t('patient'), render: patientCell },
    { key: 'type', header: t('lab.col.type'), render: o => <div style={{ minWidth: 0 }}><div className="cell-main lab-nowrap">{t(`labType.${o.type}`)}</div>{o.material && <div className="cell-sub truncate lab-fill lab-auto" dir="auto">{o.material}{o.shade ? ` · ${o.shade}` : ''}</div>}</div>, width: 150 },
    { key: 'teeth', header: t('teeth'), render: o => <TeethBadges teeth={o.teeth} max={3} />, className: 'lab-teeth-cell' },
    { key: 'lab', header: t('lab.col.lab'), render: o => <div style={{ minWidth: 0 }}><div className="truncate lab-fill lab-auto" dir="auto">{o.labName}</div>{o.doctorId && <div className="cell-sub truncate lab-fill">{userMap.get(o.doctorId)?.name}</div>}</div>, width: 160, hideBelow: 'lg' },
    {
      key: 'dates', header: t('lab.col.due'), render: o => (
        <div className="lab-dates">
          <DueBadge order={o} today={today} />
          <div className="cell-sub">{o.receivedDate ? t('lab.receivedOn', { date: fmtDate(o.receivedDate, lang) }) : o.sentDate ? t('lab.sentOn', { date: fmtDate(o.sentDate, lang) }) : t('lab.notSent')}</div>
        </div>
      ),
    },
    // a tight table (compact layout) carries the cost under the status, giving its column to the lab name
    ...(layout === 'compact' ? [
      { key: 'status', header: t('status'), render: (o: LabOrder) => <div className="lab-status-cell"><LabStatusBadge status={o.status} /><span className="cell-sub money">{money(o.cost)}</span></div> },
    ] : [
      { key: 'status', header: t('status'), render: (o: LabOrder) => <LabStatusBadge status={o.status} /> },
      { key: 'cost', header: t('lab.col.cost'), render: (o: LabOrder) => <span className="money">{money(o.cost)}</span>, className: 'num', hideBelow: 'md' as const },
    ]),
    { key: 'actions', header: <span className="sr-only">{t('actions')}</span>, render: rowActions, className: 'actions' },
  ]

  const loading = orders === undefined || patients === undefined
  const statLoading = [0, 1, 2, 3].map(i => <div key={i} className="card stat-card"><Skeleton w={46} h={46} r={14} /><div className="grow col gap-2"><Skeleton w="50%" /><Skeleton w="70%" h={22} /></div></div>)

  return (
    <div className="page lab-page">
      <PageHeader title={t('lab.title')} subtitle={t('lab.subtitle')}
        actions={!readOnly && <Button variant="primary" icon={<Plus />} onClick={() => setForm({})}>{t('lab.new')}</Button>} />
      {readOnly && <Alert tone="warning" className="mb-4">{t('trial.readonly')}</Alert>}

      {!loading && all.length === 0 ? (
        <Card>
          <EmptyState icon={<FlaskConical />} title={t('lab.empty.title')} description={t('lab.empty.desc')}
            actions={!readOnly && <Button variant="primary" icon={<Plus />} onClick={() => setForm({})}>{t('lab.new')}</Button>} />
        </Card>
      ) : <>
        <div className="grid grid-stats lab-stats">
          {loading ? statLoading : <>
            <StatCard tone="primary" icon={<FlaskConical />} label={t('lab.stat.open')} value={<span className="num">{stats.open}</span>}
              sub={t('lab.stat.openSub', { atLab: stats.atLab, ready: stats.ready })} />
            <StatCard tone="warning" icon={<CalendarClock />} label={t('lab.stat.dueWeek')} value={<span className="num">{stats.dueWeek}</span>} sub={t('lab.stat.dueWeekSub')}
              onClick={() => { setStatus('all'); setDue(d => (d === 'week' ? '' : 'week')) }} />
            <StatCard tone="danger" icon={<AlarmClock />} label={t('lab.stat.overdue')} value={<span className="num">{stats.overdue}</span>} sub={stats.overdue ? t('lab.stat.overdueSub') : t('lab.stat.overdueNone')}
              onClick={() => { setStatus('all'); setDue(d => (d === 'overdue' ? '' : 'overdue')) }} />
            <StatCard tone="purple" icon={<Wallet />} label={t('lab.stat.cost')} value={<span className="money">{money(stats.monthCost)}</span>} sub={fmtMonth(today, lang)} />
          </>}
        </div>

        <div ref={setBoard}>
        <Card className="lab-board">
          <div className="lab-filters">
            <div className="lab-seg-scroll">
              <Segmented<StatusFilter> value={status} onChange={setStatus} options={STATUS_FILTERS.map(s => ({
                value: s, label: <>{s === 'all' ? t('all') : t(`lab.${s}`)}<span className="lab-seg-count num">{counts[s]}</span></>,
              }))} />
            </div>
            <div className="toolbar lab-toolbar">
              <div className="grow lab-search"><Input iconStart={<Search />} value={q} onChange={e => setQ(e.target.value)} placeholder={t('lab.searchPh')} clearable onClear={() => setQ('')} /></div>
              <Select className="lab-doctor" value={doctorId} onChange={e => setDoctorId(e.target.value)} placeholder={t('lab.filter.allDoctors')} options={doctors.map(d => ({ value: d.id, label: d.name }))} aria-label={t('doctor')} />
              <div className="chips lab-due-chips">
                <Chip active={due === 'overdue'} onClick={() => setDue(d => (d === 'overdue' ? '' : 'overdue'))} icon={<AlarmClock />}>{t('lab.due.overdue')}<span className="num lab-chip-n">{stats.overdue}</span></Chip>
                <Chip active={due === 'week'} onClick={() => setDue(d => (d === 'week' ? '' : 'week'))} icon={<CalendarClock />}>{t('lab.due.week')}<span className="num lab-chip-n">{stats.dueWeek}</span></Chip>
              </div>
            </div>
            {labs.length > 1 && (
              <div className="lab-labs">
                <span className="lab-labs-label">{t('lab.filter.labs')}</span>
                <div className="chips">
                  {labs.map(l => <Chip key={l} active={lab === l} onClick={() => setLab(cur => (cur === l ? '' : l))}><span dir="auto">{l}</span></Chip>)}
                </div>
              </div>
            )}
            {filtered && (
              <div className="lab-filtered">
                <span>{t('lab.filter.showing', { n: rows.length, total: all.length })}</span>
                <Button size="xs" variant="ghost" icon={<X />} onClick={clearAll}>{t('lab.filter.clear')}</Button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="card-body col gap-3">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={48} />)}</div>
          ) : cards ? (
            <div className={`lab-mlist${!mobile && (boardW ?? 0) >= 700 ? ' lab-mlist-grid' : ''}`}>
              {pg.slice.length === 0 ? <EmptyState compact icon={<Search />} title={t('noResults')} description={t('lab.empty.filtered')} /> : pg.slice.map(o => {
                const p = patients.get(o.patientId)
                return (
                  <div key={o.id} className="lab-mcard" onClick={() => (readOnly ? setSlipId(o.id) : setForm({ order: o }))}>
                    <div className="lab-mcard-top">
                      <Avatar name={p?.name ?? '?'} src={p?.photo} size="sm" />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="strong truncate">{p?.name ?? t('unknown')}</div>
                        <div className="text-xs muted truncate lab-auto" dir="auto">{o.labName}</div>
                      </div>
                      <LabStatusBadge status={o.status} />
                    </div>
                    <div className="lab-mcard-mid">
                      <span className="strong">{t(`labType.${o.type}`)}</span>
                      <TeethBadges teeth={o.teeth} max={5} empty={null} />
                      {o.shade && <span className="text-xs muted num">{o.shade}</span>}
                    </div>
                    <div className="lab-mcard-foot">
                      <DueBadge order={o} today={today} />
                      <span className="money text-sm">{money(o.cost)}</span>
                      <span className="grow" />
                      {rowActions(o)}
                    </div>
                  </div>
                )
              })}
              <Pagination {...pg} />
            </div>
          ) : (
            <DataTable className="lab-table" columns={columns} rows={pg.slice} rowKey={o => o.id} onRowClick={o => (readOnly ? setSlipId(o.id) : setForm({ order: o }))}
              rowClassName={o => (o.status === 'cancelled' ? 'lab-row-off' : undefined)}
              empty={<EmptyState compact icon={<Search />} title={t('noResults')} description={t('lab.empty.filtered')} actions={<Button size="sm" variant="secondary" onClick={clearAll}>{t('lab.filter.clear')}</Button>} />}
              footer={<Pagination {...pg} />} />
          )}
        </Card>
        </div>
      </>}

      {form && <LabOrderFormModal open order={form.order} onClose={() => setForm(null)} />}
      {slipId && <LabSlipModal id={slipId} onClose={() => setSlipId(null)} />}
    </div>
  )
}

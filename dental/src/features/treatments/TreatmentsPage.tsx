import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, ArrowUpLeft, ArrowUpRight, CalendarClock, CheckCircle2, Download, Search, SearchX, Timer, Users, Wallet } from 'lucide-react'
import { db } from '@/db'
import { todayISO } from '@/db/ids'
import type { Patient, ProcedureCategory, TreatmentItem, TreatmentStatus } from '@/db/types'
import { PROCEDURE_CATEGORIES } from '@/db/types'
import { useI18n } from '@/i18n'
import { useDebounced, useDoctors, useIsMobile, useMoney, useUsers } from '@/app/hooks'
import { Avatar, Button, Card, Chip, DataTable, EmptyState, IconButton, Input, PageHeader, Pagination, Segmented, Select, Skeleton, StatCard, Switch, usePagination, useToast, type Column } from '@/ui'
import { fmtDate } from '@/lib/dates'
import { matches } from '@/lib/format'
import { saveText } from '@/platform'
import { filterRegister, groupByPatient, itemDate, itemTotal, rangeFor, sortByDateDesc, summarize, surfaceCode, tn, toCSV, type RangePreset } from './lib'
import { CategoryDot, ItemStatusBadge, nameOf, ToothBadge } from './parts'
import { NoPlanBadge } from './PlanBoard'
import './treatments.css'

type StatusFilter = TreatmentStatus | 'all'

export default function TreatmentsPage() {
  const { t, lang, isRTL } = useI18n()
  const money = useMoney()
  const mobile = useIsMobile()
  const toast = useToast()
  const navigate = useNavigate()
  const doctors = useDoctors()
  const users = useUsers(false)
  const today = todayISO()

  // the items and the patients they belong to, read together so names never lag behind rows
  const data = useLiveQuery(async () => {
    const items = await db.treatments.toArray()
    const list = await db.patients.bulkGet([...new Set(items.map(i => i.patientId))])
    return { items, patients: new Map(list.filter((p): p is Patient => !!p).map(p => [p.id, p])) }
  }, [])
  const items = data?.items
  const patients = data?.patients
  const procedures = useLiveQuery(() => db.procedures.toArray(), [])
  const catOf = useMemo(() => { const m = new Map((procedures ?? []).map(p => [p.id, p.category])); return (i: TreatmentItem) => (i.procedureId ? m.get(i.procedureId) : undefined) }, [procedures])

  const [status, setStatus] = useState<StatusFilter>('all')
  const [doctorId, setDoctorId] = useState('')
  const [category, setCategory] = useState<ProcedureCategory | ''>('')
  const [preset, setPreset] = useState<RangePreset>('month')
  const [custom, setCustom] = useState({ from: today.slice(0, 8) + '01', to: today })
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [grouped, setGrouped] = useState(false)

  const range = rangeFor(preset, today, custom)
  const patientName = (i: TreatmentItem) => patients?.get(i.patientId)?.name ?? ''
  const base = useMemo(() => filterRegister(items ?? [], { doctorId, category, range, q: dq }, { categoryOf: catOf, patientName, match: matches }),
    [items, doctorId, category, range?.from, range?.to, dq, catOf, patients]) // eslint-disable-line react-hooks/exhaustive-deps
  const statusCounts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: base.length, planned: 0, in_progress: 0, completed: 0, cancelled: 0 }
    for (const i of base) c[i.status]++
    return c
  }, [base])
  const rows = useMemo(() => sortByDateDesc(status === 'all' ? base : base.filter(i => i.status === status)), [base, status])
  const pg = usePagination(rows, mobile ? 15 : 25)
  const groups = useMemo(() => groupByPatient(rows), [rows])

  // stats: open work, this month's completions, unbilled work (all-time, per doctor filter)
  const scoped = useMemo(() => (items ?? []).filter(i => !doctorId || i.doctorId === doctorId), [items, doctorId])
  const stats = useMemo(() => {
    const s = summarize(scoped)
    const month = rangeFor('month', today)!
    const doneMonth = scoped.filter(i => i.status === 'completed' && i.completedAt && itemDate(i) >= month.from && itemDate(i) <= month.to)
    return { s, doneMonth: { count: doneMonth.length, value: doneMonth.reduce((a, i) => a + itemTotal(i), 0) } }
  }, [scoped, today])

  const exportCsv = async () => {
    const data = [
      [t('date'), t('fileNo'), t('patient'), t('tooth'), t('treatments.col.surfaces'), t('treatments.col.procedure'), t('category'), t('doctor'), t('status'), t('price'), t('discount'), t('total'), t('treatments.col.billed')],
      ...rows.map(i => {
        const p = patients?.get(i.patientId); const c = catOf(i)
        return [itemDate(i), p?.fileNo ?? '', p?.name ?? '', i.tooth ?? '', surfaceCode(i.surfaces), i.procedureName, c ? t(`cat.${c}`) : '', nameOf(users, i.doctorId), t(`tr.${i.status}`), i.price, i.discount || 0, itemTotal(i), i.invoiceId ? t('yes') : t('no')]
      }),
    ]
    await saveText(`treatments-${range ? `${range.from}_${range.to}` : today}.csv`, toCSV(data), 'text/csv;charset=utf-8')
    toast.success(t('treatments.toast.exported'), tn(t, lang, 'treatments.n.items', rows.length))
  }

  const Open = isRTL ? ArrowUpLeft : ArrowUpRight
  const openPatient = (i: TreatmentItem) => navigate(`/patients/${i.patientId}?tab=treatments`)
  const patientCell = (i: TreatmentItem) => {
    const p = patients?.get(i.patientId)
    return (
      <Link to={`/patients/${i.patientId}?tab=treatments`} className="tr-patient" onClick={e => e.stopPropagation()}>
        <Avatar name={p?.name ?? '?'} src={p?.photo} size="xs" />
        <span className="truncate">{p?.name ?? t('unknown')}</span>
      </Link>
    )
  }
  const columns: Column<TreatmentItem>[] = [
    { key: 'date', header: t('date'), width: 130, render: i => <span className="tr-nowrap">{fmtDate(itemDate(i), lang)}</span> },
    ...(!grouped ? [{ key: 'patient', header: t('patient'), render: (i: TreatmentItem) => patientCell(i) }] : []),
    { key: 'tooth', header: t('tooth'), width: 100, hideBelow: 'md', render: i => <ToothBadge tooth={i.tooth} surfaces={i.surfaces} /> },
    {
      key: 'proc', header: t('treatments.col.procedure'), render: i => {
        const c = catOf(i)
        return (
          <div className="tr-proc-name">
            <CategoryDot category={c} />
            <div className="grow"><div className="cell-main">{i.procedureName}</div>
              <div className="cell-sub row gap-2">{c ? t(`cat.${c}`) : null}{!i.planId && <NoPlanBadge />}</div></div>
          </div>
        )
      },
    },
    { key: 'doctor', header: t('doctor'), hideBelow: 'lg', render: i => <span className="text-sm muted tr-nowrap">{nameOf(users, i.doctorId) || '—'}</span> },
    { key: 'price', header: t('total'), className: 'num', width: 120, render: i => <span className={`money${i.status === 'cancelled' ? ' muted' : ''}`}>{money(itemTotal(i))}</span> },
    { key: 'status', header: t('status'), width: 130, render: i => <ItemStatusBadge status={i.status} /> },
    { key: 'open', header: <span className="sr-only">{t('actions')}</span>, className: 'actions', width: 56, render: i => <IconButton variant="ghost" size="sm" label={t('treatments.openPatient')} onClick={e => { e.stopPropagation(); openPatient(i) }}><Open /></IconButton> },
  ]

  const mobileRow = (i: TreatmentItem, withPatient = true) => (
    <div key={i.id} className="tr-mitem clickable" onClick={() => openPatient(i)}>
      <div className="tr-mitem-top">
        <ToothBadge tooth={i.tooth} surfaces={i.surfaces} size="sm" />
        <span className="tr-mitem-name">{i.procedureName}</span>
        <span className={`money${i.status === 'cancelled' ? ' muted' : ''}`}>{money(itemTotal(i))}</span>
      </div>
      <div className="tr-mitem-bottom">
        {withPatient && <span className="truncate text-sm strong">{patientName(i) || t('unknown')}</span>}
        <span className="text-xs muted tr-nowrap">{fmtDate(itemDate(i), lang)}</span>
        <span className="grow" />
        <ItemStatusBadge status={i.status} size="sm" />
      </div>
    </div>
  )

  const loading = data === undefined
  const empty = !loading && (items ?? []).length === 0
  const filtersOn = status !== 'all' || !!doctorId || !!category || preset !== 'all' || !!dq
  const clearFilters = () => { setStatus('all'); setDoctorId(''); setCategory(''); setPreset('all'); setQ('') }
  const statusOptions: StatusFilter[] = ['all', 'planned', 'in_progress', 'completed', 'cancelled']
  const presets: RangePreset[] = ['all', 'today', 'week', 'month', 'custom']

  return (
    <div className="page tr-page">
      <PageHeader title={t('treatments.reg.title')} subtitle={t('treatments.reg.subtitle')}
        actions={<Button variant="secondary" icon={<Download />} disabled={!rows.length} onClick={() => void exportCsv()}>{t('treatments.exportCsv')}</Button>} />

      {/* stats */}
      {!empty && (
        <div className="tr-stats">
          {loading ? [0, 1, 2, 3].map(i => <div key={i} className="card stat-card"><Skeleton w={46} h={46} r={14} /><div className="grow col gap-2"><Skeleton w="50%" /><Skeleton w="70%" h={22} /></div></div>) : <>
            <StatCard tone="info" icon={<CalendarClock />} label={t('treatments.stat.plannedValue')} value={<span className="money">{money(stats.s.planned.value)}</span>} sub={tn(t, lang, 'treatments.n.items', stats.s.planned.count)}
              onClick={() => { setStatus('planned'); setPreset('all') }} />
            <StatCard tone="warning" icon={<Timer />} label={t('treatments.stat.inProgress')} value={<span className="money">{money(stats.s.inProgress.value)}</span>} sub={tn(t, lang, 'treatments.n.items', stats.s.inProgress.count)}
              onClick={() => { setStatus('in_progress'); setPreset('all') }} />
            <StatCard tone="success" icon={<CheckCircle2 />} label={t('treatments.stat.doneMonth')} value={<span className="money">{money(stats.doneMonth.value)}</span>} sub={tn(t, lang, 'treatments.n.items', stats.doneMonth.count)}
              onClick={() => { setStatus('completed'); setPreset('month') }} />
            <StatCard tone="orange" icon={<Wallet />} label={t('treatments.stat.unbilled')} value={<span className="money">{money(stats.s.unbilled.value)}</span>}
              sub={stats.s.unbilled.count ? tn(t, lang, 'treatments.n.items', stats.s.unbilled.count) : t('treatments.stat.allBilled')} />
          </>}
        </div>
      )}

      {empty ? (
        <Card>
          <EmptyState icon={<Activity />} title={t('treatments.reg.emptyTitle')} description={t('treatments.reg.emptyDesc')}
            actions={<Button variant="primary" icon={<Users />} to="/patients">{t('treatments.reg.goPatients')}</Button>} />
        </Card>
      ) : (
        <>
          {/* filters */}
          <Card className="tr-filters">
            <div className="tr-filter-row">
              <Input className="tr-search" iconStart={<Search />} placeholder={t('treatments.reg.search')} value={q} onChange={e => setQ(e.target.value)} clearable onClear={() => setQ('')} aria-label={t('search')} />
              <Select className="tr-cat-select" value={category} onChange={e => setCategory(e.target.value as ProcedureCategory | '')} aria-label={t('category')}
                options={[{ value: '', label: t('treatments.proc.allCategories') }, ...PROCEDURE_CATEGORIES.map(c => ({ value: c, label: t(`cat.${c}`) }))]} />
            </div>
            <div className="tr-seg-scroll">
              <Segmented<StatusFilter> value={status} onChange={setStatus} options={statusOptions.map(s => ({
                value: s, label: <>{s === 'all' ? t('all') : t(`tr.${s}`)} <span className="tr-seg-count num">{statusCounts[s]}</span></>,
              }))} />
            </div>
            <div className="tr-filter-row">
              <div className="tr-seg-scroll">
                <Segmented<RangePreset> value={preset} onChange={setPreset} options={presets.map(p => ({ value: p, label: t(`treatments.range.${p}`) }))} />
              </div>
              {preset === 'custom' && (
                <div className="tr-range">
                  <Input type="date" aria-label={t('from')} value={custom.from} max={custom.to || undefined} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} />
                  <span className="muted">{t('to')}</span>
                  <Input type="date" aria-label={t('to')} value={custom.to} min={custom.from || undefined} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} />
                </div>
              )}
              <span className="grow" />
              <Switch checked={grouped} onChange={e => setGrouped(e.target.checked)} label={t('treatments.reg.group')} />
            </div>
            {doctors.length > 1 && (
              <div className="tr-chips-scroll">
                <Chip active={!doctorId} onClick={() => setDoctorId('')}>{t('treatments.reg.allDoctors')}</Chip>
                {doctors.map(d => <Chip key={d.id} active={doctorId === d.id} onClick={() => setDoctorId(doctorId === d.id ? '' : d.id)} icon={<span className="tr-dot" style={{ background: d.color }} />}>{d.name}</Chip>)}
              </div>
            )}
          </Card>

          <div className="tr-result-bar">
            <span className="text-sm muted">{loading ? t('loading') : tn(t, lang, 'treatments.n.items', rows.length)}{range && !loading && <> · {range.from === range.to ? fmtDate(range.from, lang) : `${fmtDate(range.from, lang)} – ${fmtDate(range.to, lang)}`}</>}</span>
            {!loading && rows.length > 0 && <span className="text-sm">{t('total')}: <span className="money strong">{money(rows.filter(i => i.status !== 'cancelled').reduce((a, i) => a + itemTotal(i), 0))}</span></span>}
          </div>

          {loading ? (
            <Card><div className="card-body col gap-3">{[0, 1, 2, 3, 4].map(i => <div key={i} className="row gap-3"><Skeleton w={90} /><Skeleton w="30%" /><span className="grow" /><Skeleton w={70} /></div>)}</div></Card>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState compact icon={<SearchX />} title={t('noResults')} description={t('treatments.reg.noMatch')}
                actions={filtersOn && <Button variant="secondary" onClick={clearFilters}>{t('treatments.clearFilters')}</Button>} />
            </Card>
          ) : grouped ? (
            <div className="col gap-4">
              {groups.map(g => {
                const p = patients?.get(g.patientId)
                const tot = g.items.filter(i => i.status !== 'cancelled').reduce((a, i) => a + itemTotal(i), 0)
                return (
                  <Card key={g.patientId} className="tr-section">
                    <Link to={`/patients/${g.patientId}?tab=treatments`} className="tr-group-head">
                      <Avatar name={p?.name ?? '?'} src={p?.photo} size="sm" />
                      <span className="grow">
                        <span className="tr-group-name">{p?.name ?? t('unknown')}</span>
                        <span className="text-xs muted">{p && <span className="num">#{p.fileNo}</span>} · {tn(t, lang, 'treatments.n.items', g.items.length)}</span>
                      </span>
                      <span className="money strong">{money(tot)}</span>
                      <Open className="tr-ic" />
                    </Link>
                    {mobile ? <div className="tr-mlist">{g.items.map(i => mobileRow(i, false))}</div>
                      : <DataTable className="tr-flat-table" compact columns={columns} rows={g.items} rowKey={i => i.id} onRowClick={openPatient} rowClassName={i => `st-${i.status}`} />}
                  </Card>
                )
              })}
            </div>
          ) : mobile ? (
            <Card className="tr-section">
              <div className="tr-mlist">{pg.slice.map(i => mobileRow(i))}</div>
              <Pagination {...pg} />
            </Card>
          ) : (
            <DataTable columns={columns} rows={pg.slice} rowKey={i => i.id} onRowClick={openPatient} rowClassName={i => `st-${i.status}`} footer={<Pagination {...pg} />} />
          )}
        </>
      )}
    </div>
  )
}

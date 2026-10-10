import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Calendar, CalendarDays, CalendarPlus, CalendarRange, CalendarX2, Check, ChevronDown, ChevronLeft, ChevronRight, List, ListFilter, Moon, SearchX, Stethoscope, X } from 'lucide-react'
import { db } from '@/db'
import { APPOINTMENT_STATUSES, type Appointment, type AppointmentStatus, type Patient, type User } from '@/db/types'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useClinic, useDoctors, useIsMobile, useUsers } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { Button, Chip, EmptyState, IconButton, Input, Menu, PageHeader, Segmented, Skeleton, type MenuItemDef } from '@/ui'
import { fmtDate, fmtMonth, relativeDay, diffDays, timeToMinutes } from '@/lib/dates'
import {
  CAL_VIEWS, countByDate, generateSlots, gridBounds, isValidDate, isWorkingDay, matchesDoctor, matchesStatus, pxPerMinute, shiftDate, sortByStart, viewRange, weekDates,
  type CalView, type StatusFilter,
} from './lib'
import { AgendaView, DayList, MonthView, TimeGrid, TimeStrip, WeekHead, WeekStrip, type GridColumn } from './CalendarViews'
import { DocDot, PersonAvatar, doctorColor, fmtSpan, useAptActions, useCountLabel, useNow, type AptRow, type CalState } from './shared'
import AppointmentFormModal from './AppointmentFormModal'

const AppointmentDetailsModal = lazy(() => import('./AppointmentDetailsModal'))

const STATE_KEY = 'dentora.appointments.view'
const STATUS_FILTERS: StatusFilter[] = ['all', 'active', ...APPOINTMENT_STATUSES]
function loadState(params: URLSearchParams): CalState {
  let s: CalState = { view: 'day', date: todayISO(), doctorIds: [], status: 'all' }
  try {
    const v = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null')
    if (v && CAL_VIEWS.includes(v.view)) s = { view: v.view, date: isValidDate(v.date) ? v.date : s.date, doctorIds: Array.isArray(v.doctorIds) ? v.doctorIds : [], status: STATUS_FILTERS.includes(v.status) ? v.status : 'all' }
  } catch { /* ignore */ }
  const pv = params.get('view') as CalView | null, pd = params.get('date'), pdoc = params.get('doctor')
  if (pv && CAL_VIEWS.includes(pv)) s.view = pv
  if (pd && isValidDate(pd)) s.date = pd
  if (pdoc) s.doctorIds = [pdoc]
  return s
}

type FormState = { appointment?: Appointment; defaults?: { patientId?: string; date?: string; time?: string; doctorId?: string } }

export default function AppointmentsPage() {
  const { t, lang } = useI18n()
  const clinic = useClinic()
  const doctors = useDoctors()
  const allUsers = useUsers(false)
  const mobile = useIsMobile()
  const { readOnly } = useLicense()
  const actions = useAptActions()
  const countLabel = useCountLabel()
  const now = useNow()
  const [params, setParams] = useSearchParams()

  const [state, setState] = useState<CalState>(() => loadState(params))
  const { view, date, status } = state
  const userMap = useMemo(() => new Map(allUsers.map(u => [u.id, u])), [allUsers])
  // a remembered filter may name a user who was deleted since: ignore it
  const doctorIds = useMemo(() => (userMap.size ? state.doctorIds.filter(id => userMap.has(id)) : state.doctorIds), [state.doctorIds, userMap])
  const patch = useCallback((p: Partial<CalState>) => setState(s => ({ ...s, ...p })), [])
  useEffect(() => { try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)) } catch { /* ignore */ } }, [state])
  useEffect(() => { if (params.get('view') || params.get('date') || params.get('doctor')) setParams({}, { replace: true }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState<FormState | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)

  // ---- data: only the visible range, through the date / [date+doctorId] indexes ----
  const range = useMemo(() => viewRange(view, date), [view, date])
  const docKey = doctorIds.join(',')
  const data = useLiveQuery(async () => {
    const list = range.from === range.to && doctorIds.length === 1
      ? await db.appointments.where('[date+doctorId]').equals([range.from, doctorIds[0]]).toArray()
      : await db.appointments.where('date').between(range.from, range.to, true, true).toArray()
    const pts = await db.patients.bulkGet([...new Set(list.map(a => a.patientId))])
    return { list, patients: new Map(pts.filter((p): p is Patient => !!p).map(p => [p.id, p])) }
  }, [range.from, range.to, docKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const byDoctor = useMemo<AptRow[]>(() => {
    if (!data) return []
    return sortByStart(data.list.filter(a => matchesDoctor(a.doctorId, doctorIds)).map(a => ({ ...a, patient: data.patients.get(a.patientId), doctor: userMap.get(a.doctorId) })))
  }, [data, doctorIds, userMap])
  const rows = useMemo(() => byDoctor.filter(a => matchesStatus(a.status, status)), [byDoctor, status])
  const loading = data === undefined
  const filtered = status !== 'all' || doctorIds.length > 0

  // ---- navigation ----
  const today = todayISO()
  const go = (dir: 1 | -1) => patch({ date: shiftDate(view, date, dir) })
  const openDay = (d: string) => patch({ view: 'day', date: d })
  const toggleDoctor = (id: string) => patch({ doctorIds: doctorIds.includes(id) ? doctorIds.filter(x => x !== id) : [...doctorIds, id] })

  const title = view === 'day' ? fmtDate(date, lang, 'weekday') + ` ${date.slice(0, 4)}`
    : view === 'month' ? fmtMonth(date, lang)
    : fmtSpan(range.from, range.to, lang)
  const rel = view === 'day' && Math.abs(diffDays(today, date)) <= 1 ? relativeDay(date, lang) : null
  const inRange = today >= range.from && today <= range.to
  const visibleCount = view === 'month' ? rows.filter(r => r.date.slice(0, 7) === date.slice(0, 7)).length : rows.length

  // ---- actions ----
  const newDefaults = (): FormState['defaults'] => ({
    date: view === 'day' || (mobile && view === 'week') ? date : inRange ? today : range.from,
    doctorId: doctorIds.length === 1 ? doctorIds[0] : undefined,
  })
  const openNew = (d?: FormState['defaults']) => { if (!readOnly) setForm({ defaults: d ?? newDefaults() }) }
  const onSlot = (d: string, time: string, doctorId?: string) => openNew({ date: d, time, doctorId: doctorId ?? (doctorIds.length === 1 ? doctorIds[0] : undefined) })
  const onOpen = (r: AptRow) => setDetailsId(r.id)
  const onEdit = (r: AptRow) => {
    const { patient: _p, doctor: _d, ...a } = r as AptRow & { creator?: unknown }
    delete (a as { creator?: unknown }).creator
    setDetailsId(null); setForm({ appointment: a })
  }
  const onSaved = async (id: string) => {
    const a = await db.appointments.get(id)
    if (a && (a.date < range.from || a.date > range.to)) patch({ date: a.date })
  }
  const onStep = (r: AptRow, s: AppointmentStatus) => void actions.setStatus(r, s, r.patient?.name)
  const onRemind = (r: AptRow) => actions.remind(r, r.patient)

  // ---- grid geometry ----
  const step = clinic.slotMinutes || 30
  const ppm = pxPerMinute(step)
  const { startMin, endMin } = useMemo(() => gridBounds(clinic.workStart, clinic.workEnd, view === 'day' || view === 'week' ? rows : []), [clinic.workStart, clinic.workEnd, rows, view])
  const workStart = timeToMinutes(clinic.workStart), workEnd = timeToMinutes(clinic.workEnd)
  const slots = useMemo(() => generateSlots(clinic.workStart, clinic.workEnd, step), [clinic.workStart, clinic.workEnd, step])
  const closedDay = !isWorkingDay(date, clinic.workingDays)

  const dayDoctors = useMemo<User[]>(() => {
    if (doctorIds.length) return doctorIds.map(id => userMap.get(id)).filter((u): u is User => !!u)
    const list = [...doctors]
    for (const r of rows) if (!list.some(d => d.id === r.doctorId) && r.doctor) list.push(r.doctor)
    return list
  }, [doctorIds, doctors, rows, userMap])

  const dayColumns = useMemo<GridColumn[]>(() => dayDoctors.map(d => {
    const items = rows.filter(r => r.doctorId === d.id && r.date === date)
    return {
      key: d.id, date, doctorId: d.id, items, off: closedDay, headStyle: { ['--doc' as string]: doctorColor(d) } as CSSProperties,
      head: (
        <div className="apt-dochead">
          <PersonAvatar name={d.name} color={doctorColor(d)} size="sm" />
          <span className="grow">
            <span className="apt-dochead-name truncate">{d.name}</span>
            <span className="apt-dochead-sub">{d.specialty ? <span className="truncate">{d.specialty}</span> : null}<span className="apt-dochead-count num">{countLabel(items.length)}</span></span>
          </span>
        </div>
      ),
    }
  }), [dayDoctors, rows, date, closedDay, countLabel])

  const week = useMemo(() => weekDates(date), [date])
  const counts = useMemo(() => countByDate(rows), [rows])
  const weekColumns = useMemo<GridColumn[]>(() => week.map(d => {
    const off = !isWorkingDay(d, clinic.workingDays)
    return { key: d, date: d, doctorId: doctorIds.length === 1 ? doctorIds[0] : undefined, items: rows.filter(r => r.date === d), off, head: <WeekHead date={d} count={counts.get(d) ?? 0} off={off} onOpen={() => openDay(d)} /> }
  }), [week, rows, counts, clinic.workingDays, doctorIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel = status === 'all' ? t('appointments.statusFilter.all') : status === 'active' ? t('appointments.statusFilter.active') : t(`apt.${status}`)
  const statusItems: MenuItemDef[] = [
    { header: t('appointments.statusFilter.title') },
    ...(['all', 'active'] as StatusFilter[]).map(s => ({ label: t(`appointments.statusFilter.${s}`), icon: status === s ? <Check /> : <span className="apt-menu-sp" />, onClick: () => patch({ status: s }) })),
    { sep: true },
    ...APPOINTMENT_STATUSES.map(s => ({ label: t(`apt.${s}`), icon: status === s ? <Check /> : <span className="apt-menu-dot" style={{ background: `var(--st-${s})` }} />, onClick: () => patch({ status: s }) })),
  ]

  const newBtn = (
    <Button variant="primary" icon={<CalendarPlus />} onClick={() => openNew()} disabled={readOnly} title={readOnly ? t('trial.readonly') : undefined}>{t('nav.newAppointment')}</Button>
  )
  const clearFilters = () => patch({ doctorIds: [], status: 'all' })
  const emptyFiltered = <EmptyState compact icon={<SearchX />} title={t('appointments.empty.filtered.title')} description={t('appointments.empty.filtered.desc')} actions={<Button icon={<X />} onClick={clearFilters}>{t('appointments.clearFilters')}</Button>} />
  const emptyDay = filtered && byDoctor.length > 0 ? emptyFiltered
    : <EmptyState compact icon={<CalendarX2 />} title={t('appointments.empty.day.title')} description={readOnly ? undefined : t('appointments.empty.day.descMobile')} actions={readOnly ? undefined : newBtn} />

  const noDoctors = doctors.length === 0 && allUsers.length > 0 && !loading && rows.length === 0

  // ---- views ----
  let body: React.ReactNode
  if (loading) body = <CalSkeleton view={view} mobile={mobile} />
  else if (noDoctors) body = <EmptyState icon={<Stethoscope />} title={t('appointments.noDoctors.title')} description={t('appointments.noDoctors.desc')} actions={<Button variant="primary" to="/staff">{t('appointments.noDoctors.action')}</Button>} />
  else if (view === 'day') {
    const dayRows = rows.filter(r => r.date === date)
    body = mobile ? (
      <div className="apt-mobile-day">
        {closedDay && <div className="apt-notice"><Moon />{t('appointments.closedDay')}</div>}
        <TimeStrip date={date} slots={slots} rows={byDoctor.filter(r => r.date === date)} step={step} readOnly={readOnly} onPick={time => onSlot(date, time)} />
        {dayRows.length ? <DayList rows={dayRows} onOpen={onOpen} showDoctor={dayDoctors.length > 1} /> : emptyDay}
      </div>
    ) : (
      <>
        {(closedDay || dayRows.length === 0) && (
          <div className={`apt-notice${closedDay ? '' : ' soft'}`}>
            {closedDay ? <Moon /> : <CalendarDays />}
            <span className="grow">{closedDay ? t('appointments.closedDay') : filtered && byDoctor.length ? t('appointments.empty.filtered.title') : t('appointments.empty.day.desc')}</span>
            {filtered && byDoctor.length > 0 && <Button size="sm" variant="ghost" icon={<X />} onClick={clearFilters}>{t('appointments.clearFilters')}</Button>}
          </div>
        )}
        <TimeGrid columns={dayColumns} startMin={startMin} endMin={endMin} step={step} pxPerMin={ppm} workStart={workStart} workEnd={workEnd}
          readOnly={readOnly} now={now} scrollKey={`day:${date}`} onSlot={onSlot} onOpen={onOpen} />
      </>
    )
  } else if (view === 'week') {
    const dayRows = rows.filter(r => r.date === date)
    body = mobile ? (
      <div className="apt-mobile-day">
        <WeekStrip days={week} selected={date} counts={counts} workingDays={clinic.workingDays} onPick={d => patch({ date: d })} />
        <div className="apt-mobile-dayhead">
          <span className="grow">{fmtDate(date, lang, 'weekday')}</span>
          <span className="muted text-sm">{countLabel(dayRows.length)}</span>
        </div>
        {dayRows.length ? <DayList rows={dayRows} onOpen={onOpen} showDoctor={dayDoctors.length > 1} /> : emptyDay}
      </div>
    ) : (
      <TimeGrid columns={weekColumns} startMin={startMin} endMin={endMin} step={step} pxPerMin={ppm} workStart={workStart} workEnd={workEnd} compact
        readOnly={readOnly} now={now} scrollKey={`week:${range.from}`} onSlot={onSlot} onOpen={onOpen} />
    )
  } else if (view === 'month') {
    body = <MonthView date={date} rows={rows} workingDays={clinic.workingDays} mobile={mobile} onDay={openDay} onOpen={onOpen} />
  } else {
    body = rows.length ? <AgendaView rows={rows} mobile={mobile} readOnly={readOnly} onOpen={onOpen} onStep={onStep} onRemind={onRemind} />
      : filtered && byDoctor.length > 0 ? emptyFiltered
      : <EmptyState icon={<CalendarX2 />} title={t('appointments.empty.list.title')} description={t('appointments.empty.list.desc')} actions={readOnly ? undefined : newBtn} />
  }

  const viewOptions = [
    { value: 'day' as CalView, label: t('appointments.view.day'), icon: mobile ? undefined : <CalendarDays /> },
    { value: 'week' as CalView, label: t('appointments.view.week'), icon: mobile ? undefined : <CalendarRange /> },
    { value: 'month' as CalView, label: t('appointments.view.month'), icon: mobile ? undefined : <Calendar /> },
    { value: 'list' as CalView, label: t('appointments.view.list'), icon: mobile ? undefined : <List /> },
  ]

  return (
    <div className="page apt-page">
      <PageHeader title={t('appointments.title')} subtitle={loading ? <Skeleton w={180} h={14} /> : t(`appointments.sub.${view}`, { count: countLabel(visibleCount) })} actions={newBtn} />

      <div className="card apt-cal">
        <div className="apt-bar">
          <div className="apt-nav">
            <IconButton label={t('previous')} className="apt-flip" onClick={() => go(-1)}><ChevronLeft /></IconButton>
            <Button className="apt-today" onClick={() => patch({ date: today })} disabled={date === today && view !== 'list'}>{t('today')}</Button>
            <IconButton label={t('next')} className="apt-flip" onClick={() => go(1)}><ChevronRight /></IconButton>
          </div>
          <div className="apt-title">
            <h2 className="apt-title-main">{title}</h2>
            {rel && <span className="apt-title-rel">{rel}</span>}
          </div>
          <div className="apt-bar-end">
            <div className="apt-datepick">
              <Input type="date" size="sm" value={date} aria-label={t('appointments.goToDate')} title={t('appointments.goToDate')}
                onChange={e => { if (isValidDate(e.target.value)) patch({ date: e.target.value }) }} />
            </div>
            <Segmented<CalView> className="apt-views" value={view} onChange={v => patch({ view: v })} options={viewOptions} block={mobile} />
          </div>
        </div>

        <div className="apt-filters">
          <div className="apt-chips" role="group" aria-label={t('doctor')}>
            <Chip active={doctorIds.length === 0} onClick={() => patch({ doctorIds: [] })}>{t('appointments.allDoctors')}</Chip>
            {doctors.map(d => (
              <Chip key={d.id} active={doctorIds.includes(d.id)} onClick={() => toggleDoctor(d.id)} className="apt-docchip">
                <DocDot doctor={d} /><bdi>{d.name}</bdi>
              </Chip>
            ))}
          </div>
          <Menu align="end" items={statusItems} className="apt-status-menu" trigger={() => (
            <Button size="sm" variant={status === 'all' ? 'secondary' : 'soft'} icon={<ListFilter />} iconEnd={<ChevronDown className="apt-caret" />}>
              <span className="apt-status-label">{statusLabel}</span>
            </Button>
          )} />
        </div>

        <div className={`apt-body apt-body-${view}`}>{body}</div>
      </div>

      {form && <AppointmentFormModal open appointment={form.appointment} defaults={form.defaults} onClose={() => setForm(null)} onSaved={id => void onSaved(id)} />}
      {detailsId && <Suspense fallback={null}><AppointmentDetailsModal id={detailsId} onClose={() => setDetailsId(null)} onEdit={onEdit} /></Suspense>}
    </div>
  )
}

function CalSkeleton({ view, mobile }: { view: CalView; mobile: boolean }) {
  if (mobile || view === 'list') {
    return <div className="apt-skel-list">{Array.from({ length: 5 }, (_, i) => <div key={i} className="row gap-3"><Skeleton w={56} h={40} r={10} /><Skeleton h={64} r={14} /></div>)}</div>
  }
  if (view === 'month') return <div className="apt-skel-month">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} h={96} r={10} />)}</div>
  return (
    <div className="apt-skel-grid">
      <div className="apt-skel-gutter">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} w={44} h={10} />)}</div>
      <div className="apt-skel-cols">{Array.from({ length: view === 'week' ? 7 : 2 }, (_, i) => <div key={i} className="col gap-3"><Skeleton h={44} r={12} /><Skeleton h={72} r={10} /><Skeleton h={48} r={10} style={{ opacity: .6 }} /><Skeleton h={96} r={10} style={{ opacity: .4 }} /></div>)}</div>
    </div>
  )
}

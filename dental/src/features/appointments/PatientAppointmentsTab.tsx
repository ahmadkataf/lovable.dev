import { lazy, Suspense, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarCheck2, CalendarClock, CalendarPlus, CalendarX2, History, UserX } from 'lucide-react'
import { db } from '@/db'
import type { Appointment, User } from '@/db/types'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useUsers } from '@/app/hooks'
import { useLicense } from '@/license/useLicense'
import { Button, Card, CardHeader, EmptyState, Skeleton } from '@/ui'
import { fmtTime, relativeDay, diffDays } from '@/lib/dates'
import { patientSummary } from './lib'
import { DocDot, StatusBadge, aptVars, fmtMonthShort, useCountLabel, useDurationLabel, type AptRow } from './shared'
import { dowName } from './CalendarViews'
import AppointmentFormModal from './AppointmentFormModal'

const AppointmentDetailsModal = lazy(() => import('./AppointmentDetailsModal'))
const PAGE = 8

/** A tab of the patient profile. Receives the patient id and renders its own data. */
export default function PatientAppointmentsTab({ patientId }: { patientId: string }) {
  const { t } = useI18n()
  const { readOnly } = useLicense()
  const users = useUsers(false)
  const countLabel = useCountLabel()
  const [form, setForm] = useState<{ appointment?: Appointment } | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [pastShown, setPastShown] = useState(PAGE)

  const list = useLiveQuery(() => db.appointments.where('patientId').equals(patientId).toArray(), [patientId])
  const userMap = useMemo(() => new Map<string, User>(users.map(u => [u.id, u])), [users])
  const today = todayISO()
  const sum = useMemo(() => patientSummary((list ?? []).map<AptRow>(a => ({ ...a, doctor: userMap.get(a.doctorId) })), today), [list, userMap, today])

  const newBtn = <Button variant="primary" size="sm" icon={<CalendarPlus />} onClick={() => setForm({})} disabled={readOnly} title={readOnly ? t('trial.readonly') : undefined}>{t('nav.newAppointment')}</Button>
  const onEdit = (r: AptRow) => { const { patient: _p, doctor: _d, ...a } = r as AptRow & { creator?: unknown }; delete (a as { creator?: unknown }).creator; setDetailsId(null); setForm({ appointment: a }) }

  let content
  if (list === undefined) {
    content = <div className="apt-ptab-pad col gap-3">{[0, 1, 2].map(i => <Skeleton key={i} h={64} r={14} />)}</div>
  } else if (list.length === 0) {
    content = <EmptyState icon={<CalendarClock />} title={t('appointments.tab.empty.title')} description={t('appointments.tab.empty.desc')} actions={readOnly ? undefined : <Button variant="primary" icon={<CalendarPlus />} onClick={() => setForm({})}>{t('nav.newAppointment')}</Button>} />
  } else {
    content = (
      <>
        <div className="apt-ptab-stats">
          <span className="apt-ptab-stat"><CalendarCheck2 /><b className="num">{sum.visits}</b>{t('appointments.tab.visits')}</span>
          <span className="apt-ptab-stat"><CalendarClock /><b className="num">{sum.upcoming.length}</b>{t('appointments.tab.upcomingCount')}</span>
          <span className={`apt-ptab-stat${sum.noShows ? ' warn' : ''}`}><UserX /><b className="num">{sum.noShows}</b>{t('appointments.tab.noShows')}</span>
          <span className="apt-ptab-stat"><CalendarX2 /><b className="num">{sum.cancelled}</b>{t('appointments.tab.cancelled')}</span>
        </div>
        <section className="apt-ptab-sec">
          <h3 className="apt-ptab-title"><CalendarClock />{t('appointments.tab.upcoming')}<span className="apt-ptab-count num">{sum.upcoming.length}</span></h3>
          {sum.upcoming.length ? (
            <div className="apt-ptab-list">{sum.upcoming.map(a => <TabRow key={a.id} row={a} next={a.id === sum.next?.id} onOpen={() => setDetailsId(a.id)} />)}</div>
          ) : <div className="apt-ptab-none">{t('appointments.tab.noUpcoming')}</div>}
        </section>
        <section className="apt-ptab-sec">
          <h3 className="apt-ptab-title"><History />{t('appointments.tab.past')}<span className="apt-ptab-count num">{sum.past.length}</span></h3>
          {sum.past.length ? (
            <div className="apt-ptab-list">{sum.past.slice(0, pastShown).map(a => <TabRow key={a.id} row={a} past onOpen={() => setDetailsId(a.id)} />)}</div>
          ) : <div className="apt-ptab-none">{t('appointments.tab.noPast')}</div>}
          {sum.past.length > pastShown && (
            <div className="apt-ptab-more"><Button size="sm" variant="ghost" onClick={() => setPastShown(n => n + PAGE * 2)}>{t('appointments.tab.showMore', { n: sum.past.length - pastShown })}</Button></div>
          )}
        </section>
      </>
    )
  }

  return (
    <Card className="apt-ptab">
      <CardHeader title={t('appointments.title')} icon={<CalendarClock />} subtitle={list ? countLabel(list.length) : undefined} actions={list && list.length > 0 ? newBtn : undefined} />
      {content}
      {form && <AppointmentFormModal open appointment={form.appointment} defaults={form.appointment ? undefined : { patientId }} onClose={() => setForm(null)} />}
      {detailsId && <Suspense fallback={null}><AppointmentDetailsModal id={detailsId} onClose={() => setDetailsId(null)} onEdit={onEdit} /></Suspense>}
    </Card>
  )
}

function TabRow({ row, past, next, onOpen }: { row: AptRow; past?: boolean; next?: boolean; onOpen: () => void }) {
  const { t, lang } = useI18n()
  const durLabel = useDurationLabel()
  const near = Math.abs(diffDays(todayISO(), row.date)) <= 1
  return (
    <button type="button" className={`apt-trow is-${row.status}${past ? ' past' : ''}${next ? ' next' : ''}`} style={aptVars(row)} onClick={onOpen}>
      <span className="apt-trow-date">
        <span className="apt-trow-day num">{Number(row.date.slice(8))}</span>
        <span className="apt-trow-mon">{fmtMonthShort(row.date, lang)}</span>
        {row.date.slice(0, 4) !== todayISO().slice(0, 4) && <span className="apt-trow-year num">{row.date.slice(0, 4)}</span>}
      </span>
      <span className="apt-trow-main">
        <span className="apt-trow-top">
          <span className="apt-trow-when">{near ? relativeDay(row.date, lang) : dowName(row.date, lang, 'long')} · <span className="apt-tm">{fmtTime(row.start, lang)}</span></span>
          {next && <span className="apt-trow-next">{t('appointments.tab.next')}</span>}
        </span>
        <span className="apt-trow-sub">
          <span>{t(`aptType.${row.type}`)}</span><span className="sep">·</span><span>{durLabel(row.durationMin)}</span>
          {row.doctor && <><span className="sep">·</span><DocDot doctor={row.doctor} /><bdi className="truncate">{row.doctor.name}</bdi></>}
        </span>
        {row.reason && <span className="apt-trow-reason truncate">{row.reason}</span>}
      </span>
      <span className="apt-trow-status"><StatusBadge status={row.status} /></span>
    </button>
  )
}

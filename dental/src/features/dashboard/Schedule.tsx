import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, CalendarPlus, Check, CheckCheck, DoorOpen, Play } from 'lucide-react'
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Skeleton, toneFor, useToast } from '@/ui'
import { useI18n } from '@/i18n'
import type { Appointment, AppointmentStatus, Patient, User } from '@/db/types'
import { fmtTime, toISODate } from '@/lib/dates'
import { useAptActions } from '@/features/appointments/shared'
import { nextStatuses, nowIndex } from '@/features/reports/queries'
import { usePlural } from '@/features/reports/parts'

const ACTION_ICON: Partial<Record<AppointmentStatus, typeof Check>> = { confirmed: Check, arrived: DoorOpen, in_progress: Play, completed: CheckCheck }

export interface ScheduleProps {
  apts: Appointment[] | undefined
  patients: Map<string, Patient>
  users: User[]
  now: string
  readOnly: boolean
  canWrite: boolean
  onAdd: () => void
}

export function Schedule({ apts, patients, users, now, readOnly, canWrite, onAdd }: ScheduleProps) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const plural = usePlural()
  // the calendar's own status writer: one transaction (status + updatedAt, the patient's last visit kept in step),
  // the activity row and the toast, and it ignores a second click that lands on the button that replaced the first
  const actions = useAptActions()
  const [busy, setBusy] = useState<string | null>(null)
  const list = apts ?? []
  const nowAt = nowIndex(list, now)
  // the count matches the "today's appointments" card: cancelled visits stay listed but are not counted
  const booked = list.filter(a => a.status !== 'cancelled').length
  const remaining = list.filter(a => (a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'arrived') && (a.end || a.start) > now).length
  const doctorOf = (id: string) => users.find(u => u.id === id)

  const change = async (a: Appointment, s: AppointmentStatus) => {
    if (busy) return
    setBusy(a.id)
    try { await actions.setStatus(a, s, patients.get(a.patientId)?.name ?? '') } catch { toast.error(t('error')) } finally { setBusy(null) }
  }

  const nowLine = (
    <li className="rp-now" aria-label={t('dashboard.sched.now')} data-testid="rp-now">
      <span className="rp-now-pill"><span className="rp-now-dot" />{t('dashboard.sched.now')} · <span className="rp-tnum">{fmtTime(now, lang)}</span></span>
    </li>
  )

  return (
    <Card className="rp-sched" data-testid="dash-schedule" style={{ order: 1 }}>
      <CardHeader icon={<CalendarDays />} title={t('dashboard.sched.title')}
        subtitle={apts ? (list.length ? <>{plural('dashboard.n.apts', booked)}{remaining > 0 && <> · {t('dashboard.sched.remaining', { n: remaining })}</>}</> : undefined) : undefined}
        actions={<Button size="sm" variant="ghost" to={`/appointments?view=day&date=${toISODate(new Date(now))}`} iconEnd={<ArrowUpRight className="rp-flip" />}>{t('dashboard.sched.openCalendar')}</Button>} />
      {!apts ? (
        <div className="card-body col gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="row gap-3"><Skeleton w={54} h={30} /><Skeleton w={36} h={36} r={18} /><div className="grow col gap-2"><Skeleton w="50%" /><Skeleton w="30%" h={10} /></div></div>)}</div>
      ) : !list.length ? (
        <EmptyState icon={<CalendarDays />} title={t('dashboard.sched.emptyTitle')} description={t('dashboard.sched.emptyDesc')}
          actions={canWrite ? <Button variant="primary" icon={<CalendarPlus />} onClick={onAdd} disabled={readOnly} title={readOnly ? t('trial.readonly') : undefined}>{t('dashboard.sched.add')}</Button> : undefined} />
      ) : (
        <ul className="rp-sched-list">
          {list.map((a, i) => {
            const p = patients.get(a.patientId)
            const doc = doctorOf(a.doctorId)
            const steps = canWrite ? nextStatuses(a.status) : []
            const past = a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show'
            return (
              <FragmentRow key={a.id} before={i === nowAt ? nowLine : null}>
                <li className={`rp-apt${past ? ' past' : ''}${a.status === 'in_progress' ? ' live' : ''}`} data-testid="dash-apt" data-status={a.status}>
                  <div className="rp-apt-time">
                    <span className="rp-tnum strong">{fmtTime(a.start, lang)}</span>
                    <span className="rp-tnum muted">{fmtTime(a.end, lang)}</span>
                  </div>
                  <span className="rp-apt-bar" style={{ background: doc?.color || 'var(--border-2)' }} />
                  <Avatar name={p?.name ?? '?'} src={p?.photo} size="sm" />
                  <div className="rp-apt-main">
                    {p ? <Link to={`/patients/${p.id}`} className="rp-apt-name truncate"><bdi>{p.name}</bdi></Link> : <span className="rp-apt-name muted">{t('unknown')}</span>}
                    <div className="rp-apt-sub">
                      <span>{t(`aptType.${a.type}`)}</span>
                      {doc && <><span className="subtle">·</span><span className="row gap-1" style={{ minWidth: 0 }}><span className="status-dot" style={{ background: doc.color }} /><span className="truncate"><bdi>{doc.name}</bdi></span></span></>}
                    </div>
                  </div>
                  <Badge tone={toneFor(a.status)} dot className="rp-apt-badge">{t(`apt.${a.status}`)}</Badge>
                  {(
                    <div className={`rp-apt-actions${steps.length ? '' : ' none'}`}>
                      {steps.map((s, si) => {
                        const I = ACTION_ICON[s] ?? Check
                        return (
                          <Button key={s} size="sm" variant={si === 0 ? 'soft' : 'ghost'} icon={<I />} className={si > 0 ? 'rp-apt-secondary' : undefined}
                            disabled={readOnly || busy === a.id} title={readOnly ? t('trial.readonly') : undefined} onClick={() => change(a, s)} data-testid={`apt-do-${s}`}>
                            {t(`dashboard.do.${s}`)}
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </li>
              </FragmentRow>
            )
          })}
          {nowAt === list.length && nowLine}
        </ul>
      )}
    </Card>
  )
}

function FragmentRow({ before, children }: { before: React.ReactNode; children: React.ReactNode }) {
  return <>{before}{children}</>
}

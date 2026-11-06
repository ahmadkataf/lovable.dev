import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Activity, Ban, CalendarClock, CalendarDays, CheckCheck, CircleCheck, Clock, FileText, Hourglass, MessageCircle, Pencil, RotateCcw, Stethoscope, Tag, Trash2, UserCheck, UserX,
} from 'lucide-react'
import { db } from '@/db'
import type { AppointmentStatus } from '@/db/types'
import { useI18n } from '@/i18n'
import { useLicense } from '@/license/useLicense'
import { Button, Modal, Skeleton, type ButtonVariant } from '@/ui'
import { fmtDate, fmtTime, relativeDay, diffDays, today, timeAgo } from '@/lib/dates'
import { formatPhone } from '@/lib/format'
import { safeDuration, STATUS_ACTIONS } from './lib'
import { ContactButtons, DocDot, PatientAvatar, StatusBadge, fmtTimeRange, useAptActions, useDurationLabel, type AptRow } from './shared'

const ACTION_ICON: Record<AppointmentStatus, ReactNode> = {
  scheduled: <RotateCcw />, confirmed: <CheckCheck />, arrived: <UserCheck />, in_progress: <Activity />, completed: <CircleCheck />, cancelled: <Ban />, no_show: <UserX />,
}
const ACTION_VARIANT: Record<AppointmentStatus, ButtonVariant> = {
  scheduled: 'secondary', confirmed: 'soft', arrived: 'secondary', in_progress: 'primary', completed: 'success', cancelled: 'ghost', no_show: 'danger-soft',
}

/** The details of one appointment, live: patient, time, status buttons, reminder, edit and delete. */
export default function AppointmentDetailsModal({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (a: AptRow) => void }) {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const { readOnly } = useLicense()
  const actions = useAptActions()
  const durLabel = useDurationLabel()

  const row = useLiveQuery(async () => {
    if (!id) return null
    const a = await db.appointments.get(id)
    if (!a) return null
    const [patient, doctor, creator] = await Promise.all([db.patients.get(a.patientId), db.users.get(a.doctorId), a.createdBy ? db.users.get(a.createdBy) : undefined])
    return { ...a, patient, doctor, creator } as AptRow & { creator?: { name: string } }
  }, [id])

  if (!id) return null
  const close = actions.guardClose(onClose)
  const a = row ?? undefined
  const p = a?.patient
  const when = a ? (Math.abs(diffDays(today(), a.date)) <= 1 ? `${relativeDay(a.date, lang)} · ${fmtDate(a.date, lang, 'weekday')}` : fmtDate(a.date, lang, 'weekday')) : ''
  const upcoming = !!a && a.date >= today() && (a.status === 'scheduled' || a.status === 'confirmed')

  const remove = async () => {
    if (!a) return
    if (await actions.remove(a, p?.name)) onClose()
  }

  const footer = a ? (
    <>
      {!readOnly && <Button variant="danger-soft" icon={<Trash2 />} className="start" onClick={() => void remove()}>{t('delete')}</Button>}
      <Button variant="ghost" onClick={close}>{t('close')}</Button>
      {!readOnly && <Button variant="primary" icon={<Pencil />} onClick={() => onEdit(a)}>{t('edit')}</Button>}
    </>
  ) : undefined

  return (
    <Modal open onClose={close} size="md" title={t('appointments.details.title')} icon={<CalendarClock />} footer={footer} className="apt-details">
      {row === undefined ? (
        <div className="col gap-3"><Skeleton h={64} r={16} /><Skeleton h={120} r={16} /><Skeleton h={44} r={12} /></div>
      ) : row === null || !a ? (
        <div className="muted" style={{ padding: '24px 0' }}>{t('appointments.details.missing')}</div>
      ) : (
        <div className="apt-det">
          <div className="apt-det-patient">
            <PatientAvatar patient={p} size="lg" />
            <div className="grow">
              {p ? (
                <button type="button" className="apt-det-name" dir="auto" title={p.name} onClick={() => { onClose(); navigate(`/patients/${p.id}`) }}>{p.name}</button>
              ) : <div className="apt-det-name">{t('appointments.deletedPatient')}</div>}
              <div className="apt-det-meta">
                {p && <span className="num">#{p.fileNo}</span>}
                {p?.phone ? <span className="ltr num">{formatPhone(p.phone)}</span> : <span className="subtle">{t('appointments.noPhone')}</span>}
              </div>
            </div>
            <ContactButtons phone={p?.phone} />
          </div>

          <div className="apt-det-status" style={{ ['--st' as string]: `var(--st-${a.status})` }}>
            <StatusBadge status={a.status} size="lg" />
            <span className="muted text-sm grow">{a.creator ? t('appointments.details.bookedBy', { name: a.creator.name, ago: timeAgo(a.createdAt, lang) }) : t('appointments.details.updated', { ago: timeAgo(a.updatedAt || a.createdAt, lang) })}</span>
          </div>

          <dl className="apt-det-grid">
            <div><dt><Stethoscope />{t('doctor')}</dt><dd><DocDot doctor={a.doctor} /><bdi>{a.doctor?.name ?? t('appointments.formerDoctor')}</bdi></dd></div>
            <div><dt><CalendarDays />{t('date')}</dt><dd>{when}</dd></div>
            <div><dt><Clock />{t('time')}</dt><dd className="apt-tm">{fmtTimeRange(a, lang)}</dd></div>
            <div><dt><Hourglass />{t('duration')}</dt><dd>{durLabel(safeDuration(a))}</dd></div>
            <div><dt><Tag />{t('type')}</dt><dd>{t(`aptType.${a.type}`)}</dd></div>
          </dl>

          {(a.reason || a.notes) && (
            <div className="apt-det-notes">
              {a.reason && <div><div className="apt-det-label">{t('appointments.reason')}</div><p>{a.reason}</p></div>}
              {a.notes && <div><div className="apt-det-label"><FileText />{t('notes')}</div><p>{a.notes}</p></div>}
            </div>
          )}

          {!readOnly && (
            <div className="apt-det-actions">
              <div className="apt-det-label">{t('appointments.details.updateStatus')}</div>
              <div className="apt-det-btns">
                {STATUS_ACTIONS[a.status].map(s => (
                  <Button key={s} size="sm" variant={ACTION_VARIANT[s]} icon={ACTION_ICON[s]} className={`apt-act apt-act-${s}`} onClick={() => void actions.setStatus(a, s, p?.name)}>
                    {t(`appointments.action.${s}`)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {upcoming && p && (
            <button type="button" className="apt-remind" onClick={() => actions.remind(a, p)} disabled={!p.phone}>
              <span className="apt-remind-icon"><MessageCircle /></span>
              <span className="grow">
                <span className="apt-remind-title">{t('appointments.reminder')}</span>
                <span className="apt-remind-sub">{p.phone ? t('appointments.reminderHint', { time: fmtTime(a.start, lang) }) : t('appointments.noPhone')}</span>
              </span>
            </button>
          )}
        </div>
      )}
    </Modal>
  )
}

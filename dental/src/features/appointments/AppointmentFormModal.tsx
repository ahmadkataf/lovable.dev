import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, CalendarCog, Clock, Sparkles, Trash2 } from 'lucide-react'
import { db, logActivity } from '@/db'
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES, type Appointment, type AppointmentStatus, type AppointmentType, type Patient } from '@/db/types'
import { newId, nowISO, todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useClinic, useDoctors, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { Alert, Button, Field, Input, Modal, Select, Textarea, useToast } from '@/ui'
import { combine, fmtDate, fmtTime, timeOf, minutesToTime, timeToMinutes, weekdayName } from '@/lib/dates'
import {
  blocksTime, DURATIONS, endFrom, findConflicts, generateSlots, isValidDate, isValidTime, isWorkingDay, nextFreeSlot, safeDuration, slotIsBusy, slotStep, weekdayOf, withinHours,
} from './lib'
import PatientPicker from './PatientPicker'
import { syncLastVisit, useAptActions, useDurationLabel } from './shared'

/** Create / edit an appointment. `defaults` pre-fills a new one (from the calendar or a patient page). */
export interface AppointmentFormModalProps { open: boolean; onClose: () => void; appointment?: Appointment; defaults?: { patientId?: string; date?: string; time?: string; doctorId?: string }; onSaved?: (id: string) => void }
export default function AppointmentFormModal(props: AppointmentFormModalProps) {
  if (!props.open) return null
  return <AppointmentForm {...props} />
}

interface Errors { patient?: string; doctor?: string; date?: string; time?: string }

function AppointmentForm({ onClose, appointment, defaults, onSaved }: AppointmentFormModalProps) {
  const { t, lang } = useI18n()
  const clinic = useClinic()
  const doctors = useDoctors()
  const allUsers = useUsers(false)
  const session = useSession()
  const toast = useToast()
  const { readOnly } = useLicense()
  const actions = useAptActions()
  const durLabel = useDurationLabel()
  const editing = !!appointment

  const [patient, setPatient] = useState<Patient | undefined>()
  const [doctorId, setDoctorId] = useState(appointment?.doctorId ?? defaults?.doctorId ?? '')
  const [date, setDate] = useState(appointment?.date ?? defaults?.date ?? todayISO())
  const [time, setTime] = useState(appointment ? timeOf(appointment.start) : defaults?.time ?? '')
  const [duration, setDuration] = useState<number>(appointment ? safeDuration(appointment) : 0)
  const [type, setType] = useState<AppointmentType>(appointment?.type ?? 'checkup')
  const [status, setStatus] = useState<AppointmentStatus>(appointment?.status ?? 'scheduled')
  const [reason, setReason] = useState(appointment?.reason ?? '')
  const [notes, setNotes] = useState(appointment?.notes ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)   // a double click or a repeated Enter arrives before `saving` re-renders

  // the patient chip: from the edited appointment or the defaults
  const initialPatientId = appointment?.patientId ?? defaults?.patientId
  const initialPatient = useLiveQuery(() => (initialPatientId ? db.patients.get(initialPatientId) : undefined), [initialPatientId])
  const [patientTouched, setPatientTouched] = useState(false)
  useEffect(() => { if (!patientTouched && initialPatient) setPatient(initialPatient) }, [initialPatient, patientTouched])

  // defaults that depend on loaded data: the doctor (me if I treat patients, else the first doctor) and the clinic's usual length
  useEffect(() => {
    if (doctorId || doctors.length === 0) return
    const me = session.user && doctors.find(d => d.id === session.user!.id)
    setDoctorId((me ?? doctors[0]).id)
  }, [doctors, doctorId, session.user])
  useEffect(() => { if (!duration && clinic.defaultAppointmentMinutes) setDuration(clinic.defaultAppointmentMinutes) }, [clinic.defaultAppointmentMinutes, duration])
  const dur = duration > 0 ? duration : clinic.defaultAppointmentMinutes > 0 ? clinic.defaultAppointmentMinutes : 30

  // the doctor's day, for busy slots and the conflict check ([date+doctorId] index)
  const dayKey = `${doctorId}|${date}`
  const dayRes = useLiveQuery(async () => {
    if (!doctorId || !isValidDate(date)) return { key: dayKey, list: [] }
    const list = await db.appointments.where('[date+doctorId]').equals([date, doctorId]).toArray()
    const others = list.filter(a => a.id !== appointment?.id)
    const pts = await db.patients.bulkGet([...new Set(others.map(a => a.patientId))])
    const names = new Map(pts.filter((p): p is Patient => !!p).map(p => [p.id, p.name]))
    return { key: dayKey, list: others.map(a => ({ ...a, patientName: names.get(a.patientId) ?? '' })) }
  }, [doctorId, date, appointment?.id])
  // only trust the result of the current doctor + date (a live query keeps the previous result while the next one loads)
  const day = dayRes && dayRes.key === dayKey ? dayRes.list : undefined

  const slots = useMemo(() => generateSlots(clinic.workStart, clinic.workEnd, clinic.slotMinutes), [clinic.workStart, clinic.workEnd, clinic.slotMinutes])
  // pick the first free slot for a new appointment that came without a time
  useEffect(() => {
    if (time || editing || !day || !doctorId || !isValidDate(date)) return
    const busy = day.filter(a => blocksTime(a.status))
    const isToday = date === todayISO()
    const from = isToday ? minutesToTime(new Date().getHours() * 60 + new Date().getMinutes()) : undefined
    // nothing free: a full day shows its first slot (with the conflict warning); today after hours leaves the time to the user
    setTime(nextFreeSlot(busy, date, dur, clinic, from) ?? (isToday ? '' : slots[0] ?? ''))
  }, [day]) // eslint-disable-line react-hooks/exhaustive-deps

  const validTime = isValidTime(time)
  const validDate = isValidDate(date)
  const start = validTime && validDate ? combine(date, time) : ''
  const end = start ? endFrom(start, dur) : ''
  const conflicts = useMemo(() => (start && doctorId && day ? findConflicts({ id: appointment?.id, doctorId, start, end }, day) : []), [start, end, doctorId, day, appointment?.id])
  const freeSlot = useMemo(() => {
    if (!conflicts.length || !day || !validDate) return null
    return nextFreeSlot(day.filter(a => blocksTime(a.status)), date, dur, clinic, time)
  }, [conflicts.length, day, date, dur, clinic, time, validDate])
  const closedDay = validDate && !isWorkingDay(date, clinic.workingDays)
  const outside = validTime && !withinHours(time, dur, clinic.workStart, clinic.workEnd)

  const slotOptions = useMemo(() => {
    const list = [...slots]
    if (validTime && !list.includes(time)) { list.push(time); list.sort((a, b) => timeToMinutes(a) - timeToMinutes(b)) }
    return list.map(s => {
      const busy = day ? slotIsBusy(day, date, s, slotStep(clinic.slotMinutes)) : false
      return { value: s, label: `${fmtTime(s, lang)}${busy ? ` — ${t('appointments.busy')}` : ''}` }
    })
  }, [slots, time, validTime, day, date, clinic.slotMinutes, lang, t])
  const durOptions = useMemo(() => {
    const list = DURATIONS.includes(dur) ? DURATIONS : [...DURATIONS, dur].sort((a, b) => a - b)
    return list.map(n => ({ value: String(n), label: durLabel(n) }))
  }, [dur, durLabel])
  const doctorOptions = useMemo(() => {
    const opts = doctors.map(d => ({ value: d.id, label: d.name }))
    // an inactive (or deleted) doctor of an edited appointment stays selectable under their name
    if (doctorId && !opts.some(o => o.value === doctorId)) opts.push({ value: doctorId, label: allUsers.find(u => u.id === doctorId)?.name ?? t('appointments.formerDoctor') })
    return opts
  }, [doctors, doctorId, allUsers, t])
  const doctorName = doctorOptions.find(o => o.value === doctorId)?.label ?? ''

  const clear = (k: keyof Errors) => setErrors(e => (e[k] ? { ...e, [k]: undefined } : e))

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (readOnly || saving || savingRef.current) return
    const errs: Errors = {}
    if (!patient) errs.patient = t('v.required')
    if (!doctorId) errs.doctor = t('v.required')
    if (!date) errs.date = t('v.required'); else if (!validDate) errs.date = t('v.date')
    if (!time) errs.time = t('v.required'); else if (!validTime) errs.time = t('appointments.form.badTime')
    setErrors(errs)
    if (Object.values(errs).some(Boolean) || !patient) return
    savingRef.current = true
    setSaving(true)
    try {
      const now = nowISO()
      const fields = {
        patientId: patient.id, doctorId, date, start, end, durationMin: dur, type, status,
        reason: reason.trim() || undefined, notes: notes.trim() || undefined,
      }
      const id = appointment?.id ?? newId()
      await db.transaction('rw', db.appointments, db.patients, async () => {
        if (appointment) await db.appointments.put({ ...appointment, ...fields, updatedAt: now })
        else await db.appointments.add({ id, ...fields, createdAt: now, updatedAt: now, createdBy: session.user?.id })
        // keep Patient.lastVisit in step: a completed visit counts, an edited one that was completed may stop counting
        const wasDone = appointment?.status === 'completed'
        if (wasDone && appointment.patientId !== patient.id) await syncLastVisit(appointment.patientId, now, appointment.start)
        if (status === 'completed' || wasDone) {
          const undone = wasDone && (status !== 'completed' || appointment.start !== start || appointment.patientId !== patient.id) ? appointment.start : undefined
          await syncLastVisit(patient.id, now, appointment?.patientId === patient.id ? undone : undefined)
        }
      })
      const when = `${fmtDate(date, lang)} ${fmtTime(start, lang)}`
      void logActivity({
        type: 'appointment', action: appointment ? 'update' : 'create', entityId: id, patientId: patient.id, by: session.user?.id,
        message: t(appointment ? 'appointments.act.updated' : 'appointments.act.created', { name: patient.name, when }),
      })
      toast.success(t(appointment ? 'appointments.form.savedToast' : 'appointments.form.createdToast'), `${patient.name} · ${fmtDate(date, lang, 'weekday')} · ${fmtTime(start, lang)}`)
      onSaved?.(id)
      onClose()
    } catch {
      savingRef.current = false
      toast.error(t('error'), t('tryAgain'))
    } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!appointment) return
    if (await actions.remove(appointment, patient?.name)) onClose()
  }

  const close = actions.guardClose(onClose)
  const footer = (
    <>
      {editing && !readOnly && <Button variant="danger-soft" icon={<Trash2 />} className="start" onClick={() => void remove()}>{t('delete')}</Button>}
      <Button variant="ghost" onClick={close}>{t('cancel')}</Button>
      <Button variant="primary" type="submit" form="apt-form" loading={saving} disabled={readOnly} title={readOnly ? t('trial.readonly') : undefined} icon={editing ? undefined : <CalendarPlus />}>
        {editing ? t('saveChanges') : t('appointments.form.book')}
      </Button>
    </>
  )

  return (
    <Modal open onClose={close} size="lg" icon={editing ? <CalendarCog /> : <CalendarPlus />} closeOnOverlay={false}
      title={editing ? t('appointments.form.editTitle') : t('appointments.form.newTitle')} subtitle={t('appointments.form.subtitle')} footer={footer}>
      <form id="apt-form" className="apt-form" onSubmit={submit} noValidate>
        {readOnly && <Alert tone="warning">{t('trial.readonly')}</Alert>}
        <PatientPicker value={patient} error={errors.patient} disabled={readOnly} autoFocus={!initialPatientId}
          onChange={p => { setPatient(p); setPatientTouched(true); if (p) clear('patient') }} />

        <div className="form-grid">
          <Select label={t('doctor')} required value={doctorId} error={errors.doctor} options={doctorOptions} placeholder={doctors.length ? undefined : t('appointments.form.noDoctors')}
            onChange={e => { setDoctorId(e.target.value); clear('doctor') }} disabled={readOnly} />
          <Input label={t('date')} required type="date" value={date} error={errors.date} hint={validDate ? fmtDate(date, lang, 'weekday') : undefined}
            onChange={e => { setDate(e.target.value); clear('date') }} disabled={readOnly} />

          <Field label={t('appointments.form.time')} required error={errors.time} hint={!errors.time ? t('appointments.form.timeHint') : undefined}>
            <div className="apt-time-row">
              <Select value={validTime ? time : ''} options={slotOptions} placeholder={validTime ? undefined : t('select')} invalid={!!errors.time}
                onChange={e => { if (e.target.value) { setTime(e.target.value); clear('time') } }} disabled={readOnly} aria-label={t('appointments.form.time')} />
              <Input type="time" value={time} step={300} invalid={!!errors.time} onChange={e => { setTime(e.target.value); clear('time') }} disabled={readOnly}
                aria-label={t('appointments.form.customTime')} className="num" />
            </div>
          </Field>
          <Select label={t('duration')} value={String(dur)} options={durOptions} onChange={e => setDuration(Number(e.target.value))} disabled={readOnly}
            hint={end ? <span className="apt-ends"><Clock />{t('appointments.form.endsAt', { time: fmtTime(end, lang) })}</span> : undefined} />

          <Select label={t('type')} value={type} options={APPOINTMENT_TYPES.map(x => ({ value: x, label: t(`aptType.${x}`) }))} onChange={e => setType(e.target.value as AppointmentType)} disabled={readOnly} />
          <Select label={t('status')} value={status} options={APPOINTMENT_STATUSES.map(x => ({ value: x, label: t(`apt.${x}`) }))} onChange={e => setStatus(e.target.value as AppointmentStatus)} disabled={readOnly} />
        </div>

        {conflicts.length > 0 && (
          <Alert tone="warning" title={t('appointments.form.conflictTitle')} className="apt-conflict"
            action={freeSlot && !readOnly ? <Button size="sm" variant="secondary" icon={<Sparkles />} onClick={() => setTime(freeSlot)}>{t('appointments.form.useSlot', { time: fmtTime(freeSlot, lang) })}</Button> : undefined}>
            {t('appointments.form.conflictDesc', { doctor: doctorName })}
            <ul className="apt-conflict-list">
              {conflicts.slice(0, 3).map(c => <li key={c.id}><span className="apt-tm">{fmtTime(c.start, lang)} – {fmtTime(c.end, lang)}</span> · {c.patientName || t('unknown')}</li>)}
            </ul>
          </Alert>
        )}
        {(closedDay || outside) && (
          <Alert tone="info" title={t('appointments.form.hoursTitle')}>
            {closedDay && <div>{t('appointments.form.closedDay', { day: weekdayName(weekdayOf(date), lang) })}</div>}
            {outside && <div>{t('appointments.form.outsideHours', { from: fmtTime(clinic.workStart, lang), to: fmtTime(clinic.workEnd, lang) })}</div>}
          </Alert>
        )}

        <div className="form-grid">
          <div className="span-2">
            <Input label={t('appointments.reason')} value={reason} placeholder={t('appointments.form.reasonPh')} maxLength={160}
              onChange={e => setReason(e.target.value)} disabled={readOnly} />
          </div>
          <div className="span-2">
            <Textarea label={t('notes')} value={notes} placeholder={t('appointments.form.notesPh')} rows={3} onChange={e => setNotes(e.target.value)} disabled={readOnly} />
          </div>
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}

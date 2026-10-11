// New / edit lab order. Used by the lab board and the patient's lab tab.
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarClock, FlaskConical, Link2, Palette } from 'lucide-react'
import { db } from '@/db'
import type { LabOrder, LabOrderStatus, LabOrderType, Patient } from '@/db/types'
import { LAB_ORDER_STATUSES, LAB_ORDER_TYPES } from '@/db/types'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useClinic, useDoctors, useUsers } from '@/app/hooks'
import { useSession } from '@/app/session'
import { Button, Field, Input, Modal, NumberInput, Select, Textarea, useToast } from '@/ui'
import { ComboInput, PatientSelect } from '@/features/prescriptions/parts'
import { durationLabel } from '@/features/prescriptions/lib'
import { LAB_MATERIALS, SHADE_SWATCH, VITA_SHADES, defaultDueDate, labNames, sortTeeth, usedValues } from './lib'
import { saveLabOrder } from './actions'
import { TeethPicker } from './parts'

export interface LabFormDefaults { patientId?: string; treatmentItemId?: string; type?: LabOrderType; teeth?: number[] }

interface Props {
  open: boolean
  onClose: () => void
  order?: LabOrder
  defaults?: LabFormDefaults
  /** The patient cannot be changed (opened from the patient's profile). */
  lockPatient?: boolean
  onSaved?: (id: string) => void
}

const QUICK_DAYS = [5, 7, 10, 14]

export default function LabOrderFormModal(props: Props) {
  if (!props.open) return null
  return <LabForm {...props} />
}

function LabForm({ onClose, order, defaults, lockPatient, onSaved }: Props) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const session = useSession()
  const doctors = useDoctors()
  const allUsers = useUsers(false)
  const clinic = useClinic()
  const today = todayISO()
  const editing = !!order

  const [patient, setPatient] = useState<Patient | undefined>()
  const [doctorId, setDoctorId] = useState(order?.doctorId ?? '')
  const [labName, setLabName] = useState(order?.labName ?? '')
  const [type, setType] = useState<LabOrderType>(order?.type ?? defaults?.type ?? 'crown')
  const [teeth, setTeeth] = useState<number[]>(order?.teeth ?? defaults?.teeth ?? [])
  const [shade, setShade] = useState(order?.shade ?? '')
  const [material, setMaterial] = useState(order?.material ?? '')
  const [sentDate, setSentDate] = useState(order ? order.sentDate ?? '' : today)
  const [dueDate, setDueDate] = useState(order ? order.dueDate ?? '' : defaultDueDate(today))
  const [dueTouched, setDueTouched] = useState(editing)
  const [receivedDate, setReceivedDate] = useState(order?.receivedDate ?? '')
  const [status, setStatus] = useState<LabOrderStatus>(order?.status ?? 'sent')
  const [cost, setCost] = useState<number | null>(order ? order.cost : null)
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [treatmentItemId, setTreatmentItemId] = useState(order?.treatmentItemId ?? defaults?.treatmentItemId ?? '')
  const [errors, setErrors] = useState<{ patient?: boolean; lab?: boolean; due?: boolean; cost?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const initialPatientId = order?.patientId ?? defaults?.patientId
  const [patientLoading, setPatientLoading] = useState(!!initialPatientId)
  useEffect(() => {
    if (!initialPatientId) return
    let alive = true
    void db.patients.get(initialPatientId).then(p => { if (!alive) return; if (p) setPatient(p); setPatientLoading(false) }, () => { if (alive) setPatientLoading(false) })
    return () => { alive = false }
  }, [initialPatientId])
  // default doctor (until one is picked): the signed-in doctor, else the patient's usual doctor, else the first doctor
  const [doctorTouched, setDoctorTouched] = useState(editing)
  useEffect(() => {
    if (doctorTouched || !doctors.length) return
    const me = session.user
    const next = (me && doctors.some(d => d.id === me.id) ? me.id : undefined) ?? (patient?.doctorId && doctors.some(d => d.id === patient.doctorId) ? patient.doctorId : undefined) ?? doctors[0].id
    if (next !== doctorId) setDoctorId(next)
  }, [doctors, doctorTouched, doctorId, session.user, patient?.doctorId])

  const allOrders = useLiveQuery(() => db.labOrders.toArray(), [])
  const labs = useMemo(() => labNames(allOrders ?? []), [allOrders])
  const materials = useMemo(() => [...usedValues(allOrders ?? [], o => o.material), ...LAB_MATERIALS[lang]], [allOrders, lang])
  const treatments = useLiveQuery(async () => (patient ? (await db.treatments.where('patientId').equals(patient.id).toArray()).filter(i => i.status !== 'cancelled' || i.id === treatmentItemId) : []), [patient?.id, treatmentItemId])

  const pickTreatment = (id: string) => {
    setTreatmentItemId(id)
    const it = treatments?.find(x => x.id === id)
    if (it?.tooth && teeth.length === 0) setTeeth(sortTeeth([it.tooth]))
  }
  const changeSent = (v: string) => { setSentDate(v); if (!dueTouched && /^\d{4}-\d{2}-\d{2}$/.test(v)) setDueDate(defaultDueDate(v)) }
  const changeStatus = (s: LabOrderStatus) => {
    setStatus(s)
    if ((s === 'received' || s === 'fitted') && !receivedDate) setReceivedDate(today)
    if ((s === 'sent' || s === 'in_progress') && !sentDate) changeSent(today)
  }

  const validate = () => {
    const e = { patient: !patient, lab: !labName.trim(), due: !!(sentDate && dueDate && dueDate < sentDate), cost: cost !== null && cost < 0 }
    return Object.values(e).some(Boolean) ? e : null
  }
  const live = errors ? validate() : null
  const submit = async (ev?: FormEvent) => {
    ev?.preventDefault()
    const e = validate()
    setErrors(e ?? {})
    if (e || !patient) return
    setBusy(true)
    try {
      const received = status === 'received' || status === 'fitted' ? receivedDate || today : undefined
      const input = {
        patientId: patient.id, doctorId: doctorId || undefined, labName, type, teeth: sortTeeth(teeth), shade, material, sentDate: sentDate || undefined,
        dueDate: dueDate || undefined, receivedDate: received, status, cost: cost ?? 0, notes, treatmentItemId: treatmentItemId || undefined,
      }
      const typeLabel = t(`labType.${type}`)
      const message = editing && order && order.status !== status
        ? t('lab.act.status', { type: typeLabel, patient: patient.name, status: t(`lab.${status}`) })
        : t(editing ? 'lab.act.updated' : 'lab.act.created', { type: typeLabel, patient: patient.name, lab: labName.trim() })
      const id = await saveLabOrder(input, { id: order?.id, by: session.user?.id, message })
      toast.success(t(editing ? 'lab.toast.updated' : 'lab.toast.created'), `${typeLabel} · ${patient.name}`)
      onSaved?.(id)
      onClose()
    } catch {
      toast.error(t('error'), t('tryAgain'))
    } finally { setBusy(false) }
  }

  const doctorOptions = useMemo(() => {
    const list = [...doctors]
    const cur = doctorId && !list.some(d => d.id === doctorId) ? allUsers.find(u => u.id === doctorId) : undefined
    if (cur) list.push(cur)
    return list.map(d => ({ value: d.id, label: d.name }))
  }, [doctors, allUsers, doctorId])
  const shadeOptions = useMemo(() => VITA_SHADES.map(s => ({ value: s, swatch: SHADE_SWATCH[s] })), [])

  return (
    <Modal open onClose={onClose} size="xl" icon={<FlaskConical />} title={editing ? t('lab.form.editTitle') : t('lab.form.newTitle')} subtitle={t('lab.form.subtitle')} closeOnOverlay={false}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" loading={busy} onClick={() => void submit()}>{editing ? t('saveChanges') : t('lab.form.save')}</Button>
      </>}>
      <form onSubmit={submit} noValidate className="lab-form">
        <div className="form-grid">
          <div className="span-2">
            <PatientSelect value={patient} onChange={p => { setPatient(p); setTreatmentItemId('') }} pending={patientLoading} locked={lockPatient && !!patient} error={live?.patient ? t('v.required') : undefined} autoFocus={!initialPatientId} />
          </div>
          <Select label={t('doctor')} value={doctorId} onChange={e => { setDoctorId(e.target.value); setDoctorTouched(true) }} options={doctorOptions} placeholder={t('lab.form.noDoctor')} />
          <ComboInput label={t('lab.form.lab')} required value={labName} onChange={setLabName} options={labs} placeholder={t('lab.form.labPh')} error={live?.lab ? t('v.required') : undefined} />
        </div>

        <div className="form-section lab-section">
          <div className="form-section-title"><FlaskConical />{t('lab.form.sectionWork')}</div>
          <div className="form-grid form-grid-3 lab-work-grid">
            <Select label={t('lab.form.type')} value={type} onChange={e => setType(e.target.value as LabOrderType)} options={LAB_ORDER_TYPES.map(x => ({ value: x, label: t(`labType.${x}`) }))} />
            <ComboInput label={<span className="row gap-1"><Palette size={14} />{t('lab.form.shade')}</span>} value={shade} onChange={setShade} options={shadeOptions} grid placeholder="A2" />
            <ComboInput label={t('lab.form.material')} value={material} onChange={setMaterial} options={materials} placeholder={t('lab.form.materialPh')} />
          </div>
          <Field label={t('lab.form.teeth')} hint={t('lab.form.teethHint')} className="mt-4">
            <TeethPicker value={teeth} onChange={setTeeth} />
          </Field>
        </div>

        <div className="form-section lab-section">
          <div className="form-section-title"><CalendarClock />{t('lab.form.sectionDates')}</div>
          <div className="form-grid form-grid-3">
            <Input label={t('lab.form.sent')} type="date" value={sentDate} onChange={e => changeSent(e.target.value)} />
            <Field label={t('lab.form.due')} error={live?.due ? t('lab.form.dueBeforeSent') : undefined}>
              <Input type="date" value={dueDate} invalid={!!live?.due} min={sentDate || undefined} onChange={e => { setDueDate(e.target.value); setDueTouched(true) }} />
              <div className="lab-quick-days">
                {QUICK_DAYS.map(n => {
                  const v = defaultDueDate(sentDate || today, n)
                  return <button key={n} type="button" className={`lab-chip-btn${dueDate === v ? ' on' : ''}`} onClick={() => { setDueDate(v); setDueTouched(true) }}>+{durationLabel(n, lang)}</button>
                })}
              </div>
            </Field>
            <Select label={t('status')} value={status} onChange={e => changeStatus(e.target.value as LabOrderStatus)} options={LAB_ORDER_STATUSES.map(s => ({ value: s, label: t(`lab.${s}`) }))} />
            {(status === 'received' || status === 'fitted') && (
              <Input label={t('lab.form.received')} type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
            )}
            <Field label={t('lab.form.cost')} error={live?.cost ? t('v.number') : undefined} className="lab-cost">
              <NumberInput value={cost} onChange={setCost} addon={clinic.currencySymbol || clinic.currency} decimals={clinic.currencyDecimals} min={0} invalid={!!live?.cost} placeholder="0" aria-label={t('lab.form.cost')} />
            </Field>
            <Select label={<span className="row gap-1"><Link2 size={14} />{t('lab.form.treatment')}</span>} value={treatmentItemId} onChange={e => pickTreatment(e.target.value)} disabled={!patient}
              placeholder={t('lab.form.noTreatment')}
              options={(treatments ?? []).map(i => ({ value: i.id, label: `${i.procedureName}${i.tooth ? ` · ${i.tooth}` : ''} — ${t(`tr.${i.status}`)}` }))} />
          </div>
        </div>

        <Textarea label={t('notes')} value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('lab.form.notesPh')} />
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

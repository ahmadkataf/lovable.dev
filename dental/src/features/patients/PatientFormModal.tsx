import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, HeartPulse, ImagePlus, Mail, MapPin, Phone, Trash, UserPen, UserPlus, UserRound, ClipboardList } from 'lucide-react'
import { db, logActivity, nextFileNumber } from '@/db'
import type { BloodType, Gender, Patient } from '@/db/types'
import { newId, nowISO, todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useDoctors } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { Alert, Avatar, Button, Field, Input, Modal, Segmented, Select, Textarea, useToast } from '@/ui'
import { ageFrom } from '@/lib/dates'
import { colorFor, formatPhone } from '@/lib/format'
import { imageToDataUrl, pickFile } from '@/platform'
import { cleanPhone, findDuplicatePhone, sanitizePhoneInput, validatePatient, type PatientErrors, type PatientField } from './lib'
import { ChipInput, usePlural } from './parts'

/** Create / edit a patient. onSaved receives the saved patient's id. */
export interface PatientFormModalProps { open: boolean; onClose: () => void; patient?: Patient; onSaved?: (id: string) => void }

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

interface Draft {
  name: string; gender: Gender; birthDate: string; phone: string; phone2: string; email: string; address: string; nationalId: string; occupation: string; doctorId: string
  bloodType: string; allergies: string[]; chronicDiseases: string[]; medications: string[]; medicalNotes: string
  tags: string[]; referredBy: string; insuranceCompany: string; insuranceNumber: string; notes: string; photo: string
}
function draftOf(p?: Patient): Draft {
  return {
    name: p?.name ?? '', gender: p?.gender ?? 'male', birthDate: p?.birthDate ?? '', phone: formatPhone(p?.phone), phone2: formatPhone(p?.phone2), email: p?.email ?? '', address: p?.address ?? '',
    nationalId: p?.nationalId ?? '', occupation: p?.occupation ?? '', doctorId: p?.doctorId ?? '', bloodType: p?.bloodType ?? '',
    allergies: p?.allergies ?? [], chronicDiseases: p?.chronicDiseases ?? [], medications: p?.medications ?? [], medicalNotes: p?.medicalNotes ?? '',
    tags: p?.tags ?? [], referredBy: p?.referredBy ?? '', insuranceCompany: p?.insuranceCompany ?? '', insuranceNumber: p?.insuranceNumber ?? '', notes: p?.notes ?? '', photo: p?.photo ?? '',
  }
}
const opt = (s: string) => (s.trim() ? s.trim() : undefined)

export default function PatientFormModal({ open, onClose, patient, onSaved }: PatientFormModalProps) {
  const { t } = useI18n()
  const toast = useToast()
  const doctors = useDoctors()
  const session = useSession()
  const { readOnly } = useLicense()
  const plural = usePlural()
  const editing = !!patient
  const [d, setD] = useState<Draft>(() => draftOf(patient))
  const [touched, setTouched] = useState<Partial<Record<PatientField, boolean>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // a fresh form each time the modal opens (or switches patient)
  useEffect(() => { if (open) { setD(draftOf(patient)); setTouched({}); setSubmitted(false); setSaving(false) } }, [open, patient?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const errors: PatientErrors = useMemo(() => validatePatient(d, todayISO()), [d])
  const show = (f: PatientField) => (submitted || touched[f]) && errors[f] ? t(errors[f]!) : undefined
  const blur = (f: PatientField) => () => setTouched(x => ({ ...x, [f]: true }))

  const others = useLiveQuery(() => db.patients.toArray(), [])
  const duplicate = useMemo(() => (others ? findDuplicatePhone(others, d.phone, patient?.id) : undefined), [others, d.phone, patient?.id])
  const tagSuggestions = useMemo(() => {
    const used = new Set<string>()
    for (const p of others ?? []) for (const tg of p.tags ?? []) used.add(tg)
    for (const s of t('patients.tagSuggestions').split('|')) used.add(s)
    return [...used].slice(0, 10)
  }, [others, t])
  const age = ageFrom(d.birthDate || undefined)

  const choosePhoto = async () => {
    const f = await pickFile('image/*')
    if (!f) return
    setPhotoBusy(true)
    try { set('photo', await imageToDataUrl(f, 256)) } catch { toast.error(t('patients.photoFailed')) } finally { setPhotoBusy(false) }
  }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (saving || readOnly) return
    setSubmitted(true)
    if (Object.keys(errors).length) {
      // bring the first problem into view
      window.setTimeout(() => formRef.current?.querySelector<HTMLElement>('.invalid')?.focus(), 0)
      return
    }
    setSaving(true)
    try {
      const now = nowISO()
      const fields = {
        name: d.name.trim().replace(/\s+/g, ' '), gender: d.gender, birthDate: opt(d.birthDate), phone: cleanPhone(d.phone), phone2: d.phone2.trim() ? cleanPhone(d.phone2) : undefined,
        email: opt(d.email), address: opt(d.address), nationalId: opt(d.nationalId), occupation: opt(d.occupation), doctorId: d.doctorId || undefined,
        bloodType: (d.bloodType || undefined) as BloodType | undefined, allergies: d.allergies, chronicDiseases: d.chronicDiseases, medications: d.medications, medicalNotes: opt(d.medicalNotes),
        tags: d.tags, referredBy: opt(d.referredBy), insuranceCompany: opt(d.insuranceCompany), insuranceNumber: opt(d.insuranceNumber), notes: opt(d.notes), photo: d.photo || undefined,
      }
      let id: string
      if (patient) {
        id = patient.id
        await db.patients.put({ ...patient, ...fields, updatedAt: now })
      } else {
        id = newId()
        const fileNo = await nextFileNumber()
        await db.patients.add({ id, fileNo, ...fields, archived: false, createdAt: now, updatedAt: now })
      }
      void logActivity({ type: 'patient', action: patient ? 'update' : 'create', entityId: id, patientId: id, message: fields.name, by: session.user?.id })
      toast.success(t(patient ? 'patients.updatedToast' : 'patients.createdToast'), fields.name)
      onSaved?.(id)
      onClose()
    } catch {
      toast.error(t('patients.saveFailed'))
      setSaving(false)
    }
  }

  const doctorOptions = [{ value: '', label: t('patients.noDoctor') }, ...doctors.map(x => ({ value: x.id, label: x.name }))]
  const errorCount = submitted ? Object.keys(errors).length : 0

  return (
    <Modal open={open} onClose={onClose} size="lg" closeOnOverlay={false}
      icon={editing ? <UserPen /> : <UserPlus />}
      title={editing ? t('patients.editPatient') : t('patients.newPatient')}
      subtitle={editing ? <><span className="num">#{patient!.fileNo}</span> · {patient!.name}</> : t('patients.formSubtitle')}
      footer={<>
        {errorCount > 0 && <span className="start pt-form-errors">{plural('formErrors', errorCount)}</span>}
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" type="submit" form="pt-patient-form" loading={saving} disabled={readOnly}>{editing ? t('saveChanges') : t('patients.savePatient')}</Button>
      </>}>
      <form id="pt-patient-form" ref={formRef} onSubmit={submit} noValidate className="pt-form">
        {readOnly && <Alert tone="warning" className="mb-4">{t('trial.readonly')}</Alert>}

        <div className="form-section">
          <div className="form-section-title"><UserRound />{t('patients.sec.basic')}</div>
          <div className="pt-photo-row">
            <span className="pt-photo-preview">
              {d.photo ? <img src={d.photo} alt="" /> : d.name.trim() ? <Avatar name={d.name} size="lg" color={colorFor((patient?.id ?? '') + d.name)} /> : <span className="pt-photo-empty"><Camera /></span>}
            </span>
            <div className="grow">
              <div className="strong">{t('patients.photo')}</div>
              <div className="field-hint">{t('patients.photoHint')}</div>
            </div>
            <div className="row gap-2 wrap">
              <Button size="sm" icon={<ImagePlus />} onClick={choosePhoto} loading={photoBusy}>{d.photo ? t('patients.changePhoto') : t('patients.pickPhoto')}</Button>
              {d.photo && <Button size="sm" variant="ghost" icon={<Trash />} onClick={() => set('photo', '')}>{t('patients.removePhoto')}</Button>}
            </div>
          </div>
          <div className="form-grid">
            <div className="span-2"><Input label={t('fullName')} required value={d.name} onChange={e => set('name', e.target.value)} onBlur={blur('name')} error={show('name')} placeholder={t('patients.ph.name')} autoComplete="off" maxLength={120} /></div>
            <Field label={t('gender')}>
              <Segmented<Gender> block value={d.gender} onChange={g => set('gender', g)} options={[{ value: 'male', label: t('male') }, { value: 'female', label: t('female') }]} />
            </Field>
            <Input label={t('birthDate')} type="date" value={d.birthDate} max={todayISO()} onChange={e => set('birthDate', e.target.value)} onBlur={blur('birthDate')} error={show('birthDate')}
              hint={d.birthDate ? (age !== null ? <span className="pt-age">{t('patients.agePreview', { age: plural('age', age) })}</span> : undefined) : t('patients.birthHint')} />
            <Input label={t('phone')} required type="tel" inputMode="tel" dir="ltr" className="pt-ltr-input" iconStart={<Phone />} value={d.phone} onChange={e => set('phone', sanitizePhoneInput(e.target.value))} onBlur={blur('phone')} error={show('phone')} placeholder={t('patients.ph.phone')} maxLength={20} />
            <Input label={t('phone2')} type="tel" inputMode="tel" dir="ltr" className="pt-ltr-input" iconStart={<Phone />} value={d.phone2} onChange={e => set('phone2', sanitizePhoneInput(e.target.value))} onBlur={blur('phone2')} error={show('phone2')} placeholder={t('optional')} maxLength={20} />
            {duplicate && (
              <Alert tone="warning" className="span-2 pt-dup">{t('patients.duplicatePhone', { name: duplicate.name, fileNo: duplicate.fileNo })}</Alert>
            )}
            <Input label={t('email')} type="email" dir="ltr" className="pt-ltr-input" iconStart={<Mail />} value={d.email} onChange={e => set('email', e.target.value)} onBlur={blur('email')} error={show('email')} placeholder={t('patients.ph.email')} />
            <Select label={t('patients.usualDoctor')} value={d.doctorId} onChange={e => set('doctorId', e.target.value)} options={doctorOptions} />
            <div className="span-2"><Input label={t('address')} iconStart={<MapPin />} value={d.address} onChange={e => set('address', e.target.value)} placeholder={t('patients.ph.address')} /></div>
            <Input label={t('patients.nationalId')} dir="ltr" className="pt-ltr-input" value={d.nationalId} onChange={e => set('nationalId', e.target.value)} />
            <Input label={t('patients.occupation')} value={d.occupation} onChange={e => set('occupation', e.target.value)} />
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title"><HeartPulse />{t('patients.sec.medical')}</div>
          <div className="form-grid">
            <Select label={t('patients.bloodType')} value={d.bloodType} onChange={e => set('bloodType', e.target.value)}
              options={[{ value: '', label: t('patients.bloodTypeUnknown') }, ...BLOOD_TYPES.map(b => ({ value: b, label: b }))]} />
            <div className="pt-medical-hint">{t('patients.medicalHint')}</div>
            <div className="span-2">
              <ChipInput label={t('patients.allergies')} tone="danger" value={d.allergies} onChange={v => set('allergies', v)} placeholder={t('patients.ph.allergies')} suggestions={t('patients.allergySuggestions').split('|')} hint={t('patients.chipHint')} />
            </div>
            <div className="span-2">
              <ChipInput label={t('patients.chronicDiseases')} tone="warning" value={d.chronicDiseases} onChange={v => set('chronicDiseases', v)} placeholder={t('patients.ph.chronic')} suggestions={t('patients.chronicSuggestions').split('|')} />
            </div>
            <div className="span-2">
              <ChipInput label={t('patients.medications')} tone="info" value={d.medications} onChange={v => set('medications', v)} placeholder={t('patients.ph.medications')} suggestions={t('patients.medicationSuggestions').split('|')} />
            </div>
            <div className="span-2"><Textarea label={t('patients.medicalNotes')} value={d.medicalNotes} onChange={e => set('medicalNotes', e.target.value)} placeholder={t('patients.ph.medicalNotes')} rows={3} /></div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title"><ClipboardList />{t('patients.sec.other')}</div>
          <div className="form-grid">
            <div className="span-2">
              <ChipInput label={t('patients.tags')} value={d.tags} onChange={v => set('tags', v)} placeholder={t('patients.ph.tags')} suggestions={tagSuggestions} />
            </div>
            <Input label={t('patients.insuranceCompany')} value={d.insuranceCompany} onChange={e => set('insuranceCompany', e.target.value)} />
            <Input label={t('patients.insuranceNumber')} dir="ltr" className="pt-ltr-input" value={d.insuranceNumber} onChange={e => set('insuranceNumber', e.target.value)} />
            <div className="span-2"><Input label={t('patients.referredBy')} value={d.referredBy} onChange={e => set('referredBy', e.target.value)} placeholder={t('patients.ph.referredBy')} /></div>
            <div className="span-2"><Textarea label={t('notes')} value={d.notes} onChange={e => set('notes', e.target.value)} placeholder={t('patients.ph.notes')} rows={3} /></div>
          </div>
        </div>
        {/* Enter in a single-line field submits */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}

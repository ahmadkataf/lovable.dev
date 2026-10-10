import { useEffect, useState, type FormEvent } from 'react'
import { Check, ClipboardList, Pencil } from 'lucide-react'
import type { TreatmentPlan } from '@/db/types'
import { logActivity } from '@/db'
import { todayISO } from '@/db/ids'
import { useI18n } from '@/i18n'
import { useDoctors } from '@/app/hooks'
import { useSession } from '@/app/session'
import { Button, Input, Modal, Select, Textarea, useToast } from '@/ui'
import { fmtDate } from '@/lib/dates'
import { createPlan, updatePlan } from './actions'

/** "خطة علاج — 10 تشرين الأول 2026" */
export function useDefaultPlanTitle() {
  const { t, lang } = useI18n()
  return () => t('treatments.plan.defaultTitle', { date: fmtDate(todayISO(), lang) })
}
/** The doctor a new plan / item defaults to: the signed-in doctor, else the patient's usual doctor. */
export function useDefaultDoctor(fallback?: string): string {
  const { user } = useSession()
  const doctors = useDoctors()
  if (user && (user.role === 'doctor' || user.role === 'admin')) return user.id
  return fallback && doctors.some(d => d.id === fallback) ? fallback : ''
}

export default function PlanFormModal({ open, onClose, patientId, plan, patientDoctorId, onCreated }: {
  open: boolean; onClose: () => void; patientId: string; plan?: TreatmentPlan; patientDoctorId?: string; onCreated?: (p: TreatmentPlan) => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const doctors = useDoctors()
  const { user } = useSession()
  const defaultTitle = useDefaultPlanTitle()
  const defaultDoctor = useDefaultDoctor(patientDoctorId)
  const [title, setTitle] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [notes, setNotes] = useState('')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTried(false)
    setTitle(plan?.title ?? defaultTitle())
    setDoctorId(plan ? plan.doctorId ?? '' : defaultDoctor)
    setNotes(plan?.notes ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan?.id])

  const error = !title.trim() ? t('v.required') : undefined
  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setTried(true)
    if (error || saving) return
    setSaving(true)
    try {
      const input = { title, doctorId: doctorId || undefined, notes }
      if (plan) {
        await updatePlan(plan.id, input)
        void logActivity({ type: 'treatment', action: 'update', entityId: plan.id, patientId, by: user?.id, message: t('treatments.log.planUpdated', { title: title.trim() }) })
        toast.success(t('treatments.toast.planUpdated'))
        onClose()
      } else {
        const p = await createPlan(patientId, input)
        void logActivity({ type: 'treatment', action: 'create', entityId: p.id, patientId, by: user?.id, message: t('treatments.log.planCreated', { title: p.title }) })
        toast.success(t('treatments.toast.planCreated'), p.title)
        onClose()
        onCreated?.(p)
      }
    } catch (err) { toast.error(t('error'), String((err as Error)?.message ?? err)) } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} size="md" icon={plan ? <Pencil /> : <ClipboardList />}
      title={plan ? t('treatments.plan.editTitle') : t('treatments.plan.newTitle')} subtitle={plan ? undefined : t('treatments.plan.newSub')}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" icon={<Check />} loading={saving} onClick={() => void submit()}>{plan ? t('saveChanges') : t('treatments.plan.create')}</Button>
      </>}>
      <form onSubmit={submit} className="form-grid" noValidate>
        <div className="span-2"><Input label={t('treatments.plan.titleLabel')} required value={title} onChange={e => setTitle(e.target.value)} error={tried ? error : undefined} autoFocus /></div>
        <div className="span-2">
          <Select label={t('doctor')} value={doctorId} onChange={e => setDoctorId(e.target.value)} placeholder={t('treatments.noDoctor')}
            options={doctors.map(d => ({ value: d.id, label: d.name }))} />
        </div>
        <div className="span-2"><Textarea label={t('notes')} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('treatments.plan.notesPh')} rows={3} /></div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

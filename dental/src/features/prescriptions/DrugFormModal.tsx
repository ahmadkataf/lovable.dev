// Add / edit a drug of the catalogue: names, form, strength and the defaults a prescription row is filled with.
import { useState, type FormEvent } from 'react'
import { Pill } from 'lucide-react'
import type { Drug } from '@/db/types'
import { useI18n } from '@/i18n'
import { Button, Input, Modal, Switch, useToast } from '@/ui'
import { DRUG_FORMS, durationPresets, FREQUENCY_PRESETS, INSTRUCTION_PRESETS } from './lib'
import { saveDrug, type DrugInput } from './actions'
import { ComboInput } from './parts'

export default function DrugFormModal({ drug, onClose, onSaved, forms }: { drug?: Drug; onClose: () => void; onSaved?: (id: string) => void; forms?: string[] }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [f, setF] = useState<DrugInput>(() => ({
    name: drug?.name ?? '', nameEn: drug?.nameEn ?? '', form: drug?.form ?? '', strength: drug?.strength ?? '', defaultDose: drug?.defaultDose ?? '',
    defaultFrequency: drug?.defaultFrequency ?? '', defaultDuration: drug?.defaultDuration ?? '', defaultInstructions: drug?.defaultInstructions ?? '', active: drug?.active ?? true,
  }))
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof DrugInput>(k: K, v: DrugInput[K]) => setF(cur => ({ ...cur, [k]: v }))

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!f.name.trim() && !(f.nameEn ?? '').trim()) { setErr(true); return }
    setBusy(true)
    try {
      // a drug always has a primary name: the English one fills it when only that was typed
      const id = await saveDrug({ ...f, name: f.name.trim() || (f.nameEn ?? '').trim() }, drug?.id)
      toast.success(t(drug ? 'prescriptions.drugs.updated' : 'prescriptions.drugs.created'), f.name || f.nameEn)
      onSaved?.(id)
      onClose()
    } catch {
      toast.error(t('error'), t('tryAgain'))
    } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} size="lg" icon={<Pill />} title={drug ? t('prescriptions.drugs.editTitle') : t('prescriptions.drugs.newTitle')} subtitle={t('prescriptions.drugs.formHint')}
      footer={<>
        <Switch className="start" checked={f.active} onChange={e => set('active', e.target.checked)} label={t('prescriptions.drugs.activeLabel')} />
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" loading={busy} onClick={() => void submit()}>{drug ? t('saveChanges') : t('prescriptions.drugs.add')}</Button>
      </>}>
      <form onSubmit={submit} noValidate>
        <div className="form-section">
          <div className="form-grid">
            <Input label={t('prescriptions.drugs.name')} required value={f.name} onChange={e => { set('name', e.target.value); setErr(false) }} error={err ? t('v.required') : undefined}
              placeholder={t('prescriptions.drugs.namePh')} autoFocus dir="auto" />
            <Input label={t('prescriptions.drugs.nameEn')} value={f.nameEn} onChange={e => { set('nameEn', e.target.value); setErr(false) }} placeholder="Amoxicillin" dir="ltr" />
            <ComboInput label={t('prescriptions.drugs.form')} value={f.form ?? ''} onChange={v => set('form', v)} options={[...DRUG_FORMS[lang], ...(forms ?? [])]} placeholder={DRUG_FORMS[lang][0]} />
            <Input label={t('prescriptions.drugs.strength')} value={f.strength} onChange={e => set('strength', e.target.value)} placeholder="500 mg" dir="auto" />
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">{t('prescriptions.drugs.defaults')}</div>
          <div className="form-grid">
            <Input label={t('prescriptions.item.dose')} value={f.defaultDose} onChange={e => set('defaultDose', e.target.value)} placeholder={t('prescriptions.drugs.dosePh')} dir="auto" />
            <ComboInput label={t('prescriptions.item.frequency')} value={f.defaultFrequency ?? ''} onChange={v => set('defaultFrequency', v)} options={FREQUENCY_PRESETS[lang]} />
            <ComboInput label={t('prescriptions.item.duration')} value={f.defaultDuration ?? ''} onChange={v => set('defaultDuration', v)} options={durationPresets(lang)} />
            <ComboInput label={t('prescriptions.item.instructions')} value={f.defaultInstructions ?? ''} onChange={v => set('defaultInstructions', v)} options={INSTRUCTION_PRESETS[lang]} />
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, ListPlus, Pencil } from 'lucide-react'
import type { Procedure, ProcedureCategory } from '@/db/types'
import { PROCEDURE_CATEGORIES } from '@/db/types'
import { logActivity } from '@/db'
import { useI18n } from '@/i18n'
import { useClinic } from '@/app/hooks'
import { useSession } from '@/app/session'
import { Button, Field, Input, Modal, Select, Switch, useToast } from '@/ui'
import { NumField } from './parts'
import { PROCEDURE_COLORS } from './lib'
import { saveProcedure } from './actions'

interface Form {
  code: string; name: string; nameEn: string; category: ProcedureCategory | ''
  price: number | null; durationMin: number | null; toothSpecific: boolean; color?: string; active: boolean
}
const EMPTY: Form = { code: '', name: '', nameEn: '', category: '', price: null, durationMin: 30, toothSpecific: false, active: true }

/** New / edit / duplicate a procedure. `copyOf` opens a prefilled copy that is saved as a new procedure. */
export default function ProcedureFormModal({ open, onClose, procedure, copyOf, defaultCategory, all }: {
  open: boolean; onClose: () => void; procedure?: Procedure; copyOf?: Procedure; defaultCategory?: ProcedureCategory; all: Procedure[]
}) {
  const { t } = useI18n()
  const clinic = useClinic()
  const toast = useToast()
  const { user } = useSession()
  const [f, setF] = useState<Form>(EMPTY)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const src = procedure ?? copyOf
    setTried(false)
    if (src) setF({
      code: copyOf ? '' : src.code ?? '', name: copyOf ? `${src.name} ${t('treatments.proc.copySuffix')}` : src.name, nameEn: src.nameEn ?? '', category: src.category,
      price: src.price, durationMin: src.durationMin ?? null, toothSpecific: src.toothSpecific, color: src.color, active: copyOf ? true : src.active,
    })
    else setF({ ...EMPTY, category: defaultCategory ?? '', durationMin: clinic.defaultAppointmentMinutes || 30 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, procedure?.id, copyOf?.id])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(s => ({ ...s, [k]: v }))
  const codeTaken = useMemo(() => {
    const c = f.code.trim().toLowerCase()
    return !!c && all.some(p => p.id !== procedure?.id && (p.code ?? '').trim().toLowerCase() === c)
  }, [f.code, all, procedure?.id])
  const errors = {
    name: !f.name.trim() ? t('v.required') : undefined,
    category: !f.category ? t('v.required') : undefined,
    price: f.price === null ? t('v.required') : f.price < 0 ? t('treatments.v.priceNegative') : undefined,
    durationMin: f.durationMin !== null && (f.durationMin < 0 || f.durationMin > 600) ? t('treatments.v.duration') : undefined,
    code: codeTaken ? t('treatments.v.codeTaken') : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)
  const show = (e?: string) => (tried ? e : undefined)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setTried(true)
    if (!valid || saving) return
    setSaving(true)
    try {
      const rec = await saveProcedure({
        code: f.code.trim() || undefined, name: f.name, nameEn: f.nameEn || undefined, category: f.category as ProcedureCategory, price: f.price ?? 0,
        durationMin: f.durationMin ?? undefined, toothSpecific: f.toothSpecific, color: f.color, active: f.active,
      }, procedure?.id)
      void logActivity({ type: 'system', action: procedure ? 'update' : 'create', entityId: rec.id, by: user?.id, message: t(procedure ? 'treatments.log.procUpdated' : 'treatments.log.procCreated', { name: rec.name }) })
      toast.success(t(procedure ? 'treatments.toast.procUpdated' : 'treatments.toast.procCreated'), rec.name)
      onClose()
    } catch (err) {
      toast.error(t('error'), String((err as Error)?.message ?? err))
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} size="md" icon={procedure ? <Pencil /> : <ListPlus />}
      title={procedure ? t('treatments.proc.editTitle') : copyOf ? t('treatments.proc.copyTitle') : t('treatments.proc.newTitle')}
      subtitle={procedure ? procedure.name : t('treatments.proc.formSub')}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant="primary" icon={<Check />} loading={saving} onClick={() => void submit()}>{procedure ? t('saveChanges') : t('save')}</Button>
      </>}>
      <form onSubmit={submit} className="form-grid tr-proc-form" noValidate>
        <Input label={t('treatments.proc.name')} required value={f.name} onChange={e => set('name', e.target.value)} error={show(errors.name)} placeholder={t('treatments.proc.namePh')} autoFocus />
        <Input label={t('treatments.proc.nameEn')} value={f.nameEn} onChange={e => set('nameEn', e.target.value)} dir="ltr" placeholder="Composite filling" hint={t('treatments.proc.nameEnHint')} />
        <Input label={t('code')} value={f.code} onChange={e => set('code', e.target.value)} dir="ltr" placeholder="D2391" error={errors.code} />
        <Select label={t('category')} required value={f.category} onChange={e => set('category', e.target.value as ProcedureCategory)} error={show(errors.category)}
          placeholder={t('select')} options={PROCEDURE_CATEGORIES.map(c => ({ value: c, label: t(`cat.${c}`) }))} />
        <NumField label={t('price')} required value={f.price} onChange={n => set('price', n)} decimals={clinic.currencyDecimals ?? 2} min={0} addon={clinic.currencySymbol || clinic.currency} error={show(errors.price)} />
        <NumField label={t('treatments.proc.duration')} value={f.durationMin} onChange={n => set('durationMin', n)} decimals={0} min={0} addon={t('min')} error={show(errors.durationMin)} />
        <Field className="span-2" label={t('treatments.proc.color')}>
          <div className="tr-swatches" role="radiogroup" aria-label={t('treatments.proc.color')}>
            <button type="button" role="radio" aria-checked={!f.color} className={`tr-swatch tr-swatch-none${!f.color ? ' on' : ''}`} onClick={() => set('color', undefined)} title={t('treatments.proc.colorAuto')} />
            {PROCEDURE_COLORS.map(c => (
              <button key={c} type="button" role="radio" aria-checked={f.color === c} className={`tr-swatch${f.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />
            ))}
          </div>
        </Field>
        <div className="span-2 tr-switches">
          <div className="tr-switch-row">
            <div className="grow"><div className="strong">{t('treatments.proc.toothSpecific')}</div><div className="text-sm muted">{t('treatments.proc.toothSpecificHint')}</div></div>
            <Switch checked={f.toothSpecific} onChange={e => set('toothSpecific', e.target.checked)} aria-label={t('treatments.proc.toothSpecific')} />
          </div>
          <div className="tr-switch-row">
            <div className="grow"><div className="strong">{t('treatments.proc.activeLabel')}</div><div className="text-sm muted">{t('treatments.proc.activeHint')}</div></div>
            <Switch checked={f.active} onChange={e => set('active', e.target.checked)} aria-label={t('treatments.proc.activeLabel')} />
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

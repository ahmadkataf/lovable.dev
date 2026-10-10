import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ClipboardPlus, Lock, Pencil, RefreshCw, Zap } from 'lucide-react'
import { db, logActivity } from '@/db'
import { todayISO } from '@/db/ids'
import type { Procedure, ToothSurface, TreatmentItem, TreatmentPlan } from '@/db/types'
import { useI18n } from '@/i18n'
import { useClinic, useDoctors, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { Alert, Button, Field, Input, Modal, Select, useToast } from '@/ui'
import { round2 } from '@/lib/format'
import { combine, timeOf } from '@/lib/dates'
import { CategoryBadge, CategoryDot, NumField, ProcedurePicker, SurfaceChips, ToothGrid } from './parts'
import { itemTotal, sortTeeth, surfacesForTeeth, tn, validateItem, type ItemErrors } from './lib'
import { addItems, updateItem } from './actions'
import { useDefaultDoctor, useDefaultPlanTitle } from './PlanFormModal'

export const NEW_PLAN = '__new'
export const NO_PLAN = '__none'
export type ItemMode = 'add' | 'edit' | 'quick'

/** When a quick treatment was done: now for today, the same time of day on an earlier date. */
function doneAt(date: string): string {
  const now = new Date().toISOString()
  return !date || date >= todayISO() ? now : combine(date, timeOf(now))
}

export interface ItemFormProps {
  open: boolean
  onClose: () => void
  patientId: string
  mode: ItemMode
  item?: TreatmentItem
  target?: string                    // plan id, NEW_PLAN or NO_PLAN (add mode)
  plans: TreatmentPlan[]             // plans the item can go into
  initialTeeth?: number[]
  marked?: ReadonlySet<number>       // teeth that already have work on them
  patientDoctorId?: string
  onSaved?: (items: TreatmentItem[], mode: ItemMode, procedure: Procedure) => void
  /** True when a follow-up dialog will confirm the save, so no toast is shown (it would cover that dialog on phones). */
  quiet?: (mode: ItemMode, procedure?: Procedure | null) => boolean
}

export default function ItemFormModal({ open, onClose, patientId, mode, item, target: initialTarget, plans, initialTeeth, marked, patientDoctorId, onSaved, quiet }: ItemFormProps) {
  const { t, lang, pick } = useI18n()
  const money = useMoney()
  const clinic = useClinic()
  const toast = useToast()
  const doctors = useDoctors()
  const { user } = useSession()
  const defaultPlanTitle = useDefaultPlanTitle()
  const procedures = useLiveQuery(() => db.procedures.toArray(), []) ?? []
  const active = useMemo(() => procedures.filter(p => p.active || p.id === item?.procedureId), [procedures, item?.procedureId])

  const [procId, setProcId] = useState('')
  const [picking, setPicking] = useState(true)
  const [teeth, setTeeth] = useState<number[]>([])
  const [showTeeth, setShowTeeth] = useState(false)
  const [surfaces, setSurfaces] = useState<ToothSurface[]>([])
  const [price, setPrice] = useState<number | null>(null)
  const [discount, setDiscount] = useState<number | null>(null)
  const [plannedDate, setPlannedDate] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [notes, setNotes] = useState('')
  const [target, setTarget] = useState(NO_PLAN)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)

  const planOf = (id?: string) => plans.find(p => p.id === id)
  const defaultDoctor = useDefaultDoctor(patientDoctorId)

  useEffect(() => {
    if (!open) return
    setTried(false)
    if (mode === 'edit' && item) {
      setProcId(item.procedureId ?? ''); setPicking(false)
      setTeeth(item.tooth ? [item.tooth] : []); setShowTeeth(!!item.tooth)
      setSurfaces(item.surfaces ?? []); setPrice(item.price); setDiscount(item.discount || null)
      setPlannedDate(item.plannedDate ?? ''); setDoctorId(item.doctorId ?? ''); setNotes(item.notes ?? '')
      setTarget(item.planId ?? NO_PLAN)
    } else {
      const tgt = mode === 'quick' ? NO_PLAN : initialTarget ?? NO_PLAN
      setProcId(''); setPicking(true)
      setTeeth(initialTeeth ?? []); setShowTeeth(!!initialTeeth?.length)
      setSurfaces([]); setPrice(null); setDiscount(null)
      setPlannedDate(mode === 'quick' ? todayISO() : '')
      setDoctorId(planOf(tgt)?.doctorId ?? defaultDoctor)
      setNotes(''); setTarget(tgt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, item?.id])

  const proc = procedures.find(p => p.id === procId) ?? null
  const billed = mode === 'edit' && !!item?.invoiceId
  const teethShown = showTeeth || !!proc?.toothSpecific || teeth.length > 0
  const validSurfaces = surfacesForTeeth(teeth)
  const cleanSurfaces = teeth.length ? surfaces.filter(s => validSurfaces.includes(s)) : []

  const choose = (p: Procedure) => {
    setProcId(p.id); setPicking(false)
    if (!billed) setPrice(p.price)
    if (p.toothSpecific) setShowTeeth(true)
  }

  const errs: ItemErrors = billed ? {} : validateItem({ procedure: proc ?? (mode === 'edit' && item && !item.procedureId ? { toothSpecific: false } : null), teeth, price, discount })
  const err = (k: keyof ItemErrors) => (tried && errs[k] ? t(`treatments.${errs[k]}`) : undefined)
  const count = mode === 'edit' ? 1 : Math.max(1, teeth.length)
  const each = itemTotal({ price: price ?? 0, discount: discount ?? 0 })
  const total = round2(each * count)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setTried(true)
    if (Object.keys(errs).length || saving) return
    setSaving(true)
    try {
      const name = proc ? pick(proc.name, proc.nameEn) : item?.procedureName ?? ''
      if (mode === 'edit' && item) {
        const next = await updateItem(item.id, {
          procedureId: proc?.id ?? item.procedureId, procedureName: proc && proc.id !== item.procedureId ? name : item.procedureName,
          tooth: teeth[0], surfaces: cleanSurfaces, price: price ?? 0, discount: discount ?? 0,
          doctorId: doctorId || undefined, plannedDate: plannedDate || undefined, notes,
        })
        void logActivity({ type: 'treatment', action: 'update', entityId: item.id, patientId, by: user?.id, message: t('treatments.log.itemUpdated', { name: next?.procedureName ?? name }) })
        toast.success(t('treatments.toast.itemUpdated'), next?.procedureName)
        onClose()
        return
      }
      const sorted = sortTeeth(teeth)
      const planChoice = target === NEW_PLAN ? { create: { title: defaultPlanTitle(), doctorId: doctorId || undefined } } : target === NO_PLAN ? undefined : { id: target }
      const res = await addItems(patientId, {
        procedure: proc!, procedureName: name, teeth: sorted, surfaces: cleanSurfaces, price: price ?? 0, discount: discount ?? 0,
        doctorId: doctorId || undefined, notes, status: mode === 'quick' ? 'completed' : 'planned',
        ...(mode === 'quick' ? { completedAt: doneAt(plannedDate) } : { plannedDate: plannedDate || undefined }),
      }, planChoice)
      const where = sorted.length ? ` — ${t('treatments.teethList', { list: sorted.join('، ') })}` : ''
      void logActivity({
        type: 'treatment', action: 'create', entityId: res.items[0]?.id, patientId, by: user?.id,
        message: t(mode === 'quick' ? 'treatments.log.quickDone' : 'treatments.log.itemsAdded', { name }) + where,
      })
      if (!(quiet?.(mode, proc) && sorted.length > 0)) toast.success(mode === 'quick' ? t('treatments.toast.quickDone') : tn(t, lang, 'treatments.toast.itemsAdded', res.items.length), name)
      onClose()
      onSaved?.(res.items, mode, proc!)
    } catch (ex) { toast.error(t('error'), String((ex as Error)?.message ?? ex)) } finally { setSaving(false) }
  }

  const title = mode === 'edit' ? t('treatments.item.editTitle') : mode === 'quick' ? t('treatments.item.quickTitle') : t('treatments.item.addTitle')
  const sub = mode === 'quick' ? t('treatments.item.quickSub')
    : mode === 'add' ? (initialTeeth?.length ? t('treatments.item.forTeeth', { list: sortTeeth(initialTeeth).join('، ') }) : t('treatments.item.addSub'))
    : item?.procedureName
  const icon = mode === 'edit' ? <Pencil /> : mode === 'quick' ? <Zap /> : <ClipboardPlus />
  const planOptions = [
    ...plans.map(p => ({ value: p.id, label: p.title })),
    { value: NEW_PLAN, label: t('treatments.item.newPlanOption') },
    { value: NO_PLAN, label: t('treatments.item.noPlanOption') },
  ]

  return (
    <Modal open={open} onClose={onClose} size="lg" icon={icon} title={title} subtitle={sub} className="tr-item-modal"
      footer={<>
        <div className="start tr-total-preview">
          {count > 1 && <span className="muted"><span className="num">{count}</span> × <span className="money">{money(each)}</span> =</span>}
          <span className="money tr-total-big">{money(total)}</span>
        </div>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button variant={mode === 'quick' ? 'success' : 'primary'} icon={<Check />} loading={saving} onClick={() => void submit()}>
          {mode === 'edit' ? t('saveChanges') : mode === 'quick' ? t('treatments.item.saveQuick') : count > 1 ? tn(t, lang, 'treatments.item.addN', count) : t('treatments.item.add')}
        </Button>
      </>}>
      <form onSubmit={submit} noValidate className="tr-item-form">
        {billed && <Alert tone="info" icon={<Lock />} className="mb-4">{t('treatments.item.billedLock')}</Alert>}

        {/* 1 · procedure */}
        <section className="tr-step">
          <div className="tr-step-title"><span className="tr-step-n num">1</span>{t('treatments.item.procedure')}<span className="req">*</span></div>
          {picking && !billed ? (
            <ProcedurePicker procedures={active} value={procId} onPick={choose} error={err('procedure')} />
          ) : (
            <div className="tr-chosen">
              <CategoryDot category={proc?.category} color={proc?.color} />
              <div className="grow">
                <div className="strong">{proc ? pick(proc.name, proc.nameEn) : item?.procedureName}</div>
                <div className="row gap-2 text-sm muted wrap">
                  {proc && <CategoryBadge category={proc.category} size="sm" />}
                  {proc?.code && <span className="num">{proc.code}</span>}
                  {proc && <span className="money">{money(proc.price)}</span>}
                </div>
              </div>
              {!billed && <Button variant="secondary" size="sm" icon={<RefreshCw />} onClick={() => setPicking(true)}>{t('treatments.item.change')}</Button>}
            </div>
          )}
        </section>

        {/* 2 · teeth (also before the procedure when the chart preselected a tooth) */}
        {(proc || mode === 'edit' || teeth.length > 0) && (
          <section className="tr-step">
            <div className="tr-step-title">
              <span className="tr-step-n num">2</span>{mode === 'edit' ? t('tooth') : t('treatments.item.teeth')}
              {proc?.toothSpecific ? <span className="req">*</span> : <span className="tr-optional">{t('optional')}</span>}
              <span className="grow" />
              {teeth.length > 0 && <span className="tr-sel-count">{mode === 'edit' ? teeth[0] : tn(t, lang, 'treatments.n.teethSelected', teeth.length)}</span>}
            </div>
            {teethShown ? (
              <div className={billed ? 'tr-disabled' : undefined}>
                {mode !== 'edit' && teeth.length === 0 && <div className="field-hint mb-2">{t('treatments.item.teethHint')}</div>}
                <ToothGrid value={teeth} onChange={v => { setTeeth(mode === 'edit' ? v.slice(-1) : v) }} multi={mode !== 'edit'} marked={marked} />
                {err('teeth') && <div className="field-error mt-2">{err('teeth')}</div>}
                {teeth.length > 0 && (
                  <Field label={t('treatments.item.surfaces')} className="mt-3" hint={t('treatments.item.surfacesHint')}>
                    <SurfaceChips teeth={teeth} value={cleanSurfaces} onChange={setSurfaces} />
                  </Field>
                )}
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setShowTeeth(true)}>{t('treatments.item.pickTeeth')}</Button>
            )}
          </section>
        )}

        {/* 3 · details */}
        {(proc || mode === 'edit') && (
          <section className="tr-step">
            <div className="tr-step-title"><span className="tr-step-n num">3</span>{t('treatments.item.details')}</div>
            <div className="form-grid">
              <NumField label={mode !== 'edit' && count > 1 ? t('treatments.item.pricePerTooth') : t('price')} required value={price} onChange={setPrice} min={0}
                decimals={clinic.currencyDecimals ?? 2} addon={clinic.currencySymbol || clinic.currency} error={err('price')} disabled={billed} />
              <NumField label={mode !== 'edit' && count > 1 ? t('treatments.item.discountPerTooth') : t('discount')} value={discount} onChange={setDiscount} min={0}
                decimals={clinic.currencyDecimals ?? 2} addon={clinic.currencySymbol || clinic.currency} error={err('discount')} disabled={billed} placeholder="0" />
              <Input type="date" label={mode === 'quick' ? t('treatments.item.doneDate') : t('treatments.item.plannedDate')} value={plannedDate} max={mode === 'quick' ? todayISO() : undefined}
                onChange={e => setPlannedDate(e.target.value)} />
              <Select label={t('doctor')} value={doctorId} onChange={e => setDoctorId(e.target.value)} placeholder={t('treatments.noDoctor')} options={doctors.map(d => ({ value: d.id, label: d.name }))} />
              {mode === 'add' && (
                <Select label={t('treatments.item.plan')} value={target} onChange={e => setTarget(e.target.value)} options={planOptions}
                  hint={target === NEW_PLAN ? t('treatments.item.newPlanHint') : target === NO_PLAN ? t('treatments.item.noPlanHint') : undefined} />
              )}
              <div className={mode === 'add' ? undefined : 'span-2'}>
                <Input label={t('notes')} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('treatments.item.notesPh')} />
              </div>
            </div>
          </section>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

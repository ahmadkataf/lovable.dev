// New / edit stock item. The quantity is typed only when the item is created (it becomes the opening-stock
// movement); afterwards it changes through movements so the history stays complete.
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Boxes, Info, PackagePlus, Pencil } from 'lucide-react'
import { db, logActivity } from '@/db'
import type { InventoryItem } from '@/db/types'
import { Button, Chip, Field, Input, Modal, Select, Switch, Textarea, useToast } from '@/ui'
import { NumberField } from './fields'
import { translate, useI18n } from '@/i18n'
import { useClinic } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { CATEGORY_PRESETS, UNITS, customCategories, parseCategoryInput, validateItem, type ItemFormErrors } from './lib'
import { createItem, updateItem, type ItemDraft } from './actions'
import { catLabel, presetLabels, unitLabel } from './parts'

export interface ItemFormModalProps { open: boolean; onClose: () => void; item?: InventoryItem; onSaved?: (id: string) => void }

interface FormState {
  name: string; sku: string; category: string; unit: string; customUnit: string
  quantity: number | null; minQuantity: number | null; costPrice: number | null
  supplier: string; expiryDate: string; location: string; notes: string; active: boolean
}
const isPresetUnit = (u: string) => (UNITS as readonly string[]).includes(u)

export default function ItemFormModal({ open, onClose, item, onSaved }: ItemFormModalProps) {
  const { t } = useI18n()
  const toast = useToast()
  const clinic = useClinic()
  const { user } = useSession()
  const { readOnly } = useLicense()
  const uid = useId().replace(/:/g, '')
  const live = useLiveQuery(() => db.inventory.toArray(), [])
  const all = useMemo(() => live ?? [], [live])
  const editing = !!item

  const blank = (): FormState => ({ name: '', sku: '', category: '', unit: 'piece', customUnit: '', quantity: null, minQuantity: null, costPrice: null, supplier: '', expiryDate: '', location: '', notes: '', active: true })
  const [f, setF] = useState<FormState>(blank)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)   // a second Enter or click before the first write ends must not save twice

  useEffect(() => {
    if (!open) return
    setTried(false); setBusy(false)
    if (!item) { setF(blank()); return }
    setF({
      name: item.name, sku: item.sku ?? '', category: item.category ? catLabel(t, item.category) : '',
      unit: isPresetUnit(item.unit) ? item.unit : 'other', customUnit: isPresetUnit(item.unit) ? '' : item.unit,
      quantity: item.quantity, minQuantity: item.minQuantity, costPrice: item.costPrice ?? null,
      supplier: item.supplier ?? '', expiryDate: item.expiryDate ?? '', location: item.location ?? '', notes: item.notes ?? '', active: item.active,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(s => ({ ...s, [k]: v }))
  const unitValue = f.unit === 'other' ? f.customUnit.trim() : f.unit
  const errors: ItemFormErrors = validateItem({ name: f.name, quantity: f.quantity, minQuantity: f.minQuantity, costPrice: f.costPrice, expiryDate: f.expiryDate, unit: unitValue })
  const err = (k: keyof ItemFormErrors) => {
    if (!tried || !errors[k]) return undefined
    return errors[k] === 'required' ? t('v.required') : errors[k] === 'date' ? t('v.date') : t('inventory.v.min')
  }

  const labels = useMemo(() => presetLabels((k, p) => translate('ar', k, p), (k, p) => translate('en', k, p)), [])
  const customCats = useMemo(() => customCategories(all), [all])
  const suppliers = useMemo(() => [...new Set(all.map(i => i.supplier?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [all])
  const chosenCat = parseCategoryInput(f.category, labels)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setTried(true)
    if (Object.keys(errors).length) {
      const first = document.querySelector<HTMLElement>(`#${uid}-form .invalid`)
      first?.focus()
      return
    }
    if (readOnly) { toast.warning(t('inventory.toast.readOnly')); return }
    if (saving.current) return
    saving.current = true
    setBusy(true)
    const draft: ItemDraft = {
      name: f.name.trim(), sku: f.sku.trim() || undefined, category: chosenCat, unit: unitValue,
      quantity: f.quantity ?? 0, minQuantity: f.minQuantity ?? 0, costPrice: f.costPrice ?? undefined,
      supplier: f.supplier.trim() || undefined, expiryDate: f.expiryDate || undefined, location: f.location.trim() || undefined,
      notes: f.notes.trim() || undefined, active: editing ? f.active : true,
    }
    try {
      let id: string
      if (item) {
        await updateItem(item.id, draft); id = item.id
        toast.success(t('inventory.toast.updated'), <bdi className="inv-wrap">{draft.name}</bdi>)
        void logActivity({ type: 'inventory', action: 'update', entityId: id, by: user?.id, message: t('inventory.act.updated', { name: draft.name }) })
      } else {
        id = await createItem(draft, user?.id)
        toast.success(t('inventory.toast.created'), <bdi className="inv-wrap">{draft.name}</bdi>)
        void logActivity({ type: 'inventory', action: 'create', entityId: id, by: user?.id, message: t('inventory.act.created', { name: draft.name }) })
      }
      onSaved?.(id)
      onClose()
    } catch {
      toast.error(t('error'), t('tryAgain'))
    } finally { saving.current = false; setBusy(false) }
  }

  const formId = `${uid}-form`
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={editing ? <Pencil /> : <PackagePlus />}
      title={editing ? t('inventory.editItem') : t('inventory.newItem')} subtitle={editing ? <bdi className="inv-wrap">{item?.name}</bdi> : t('inventory.form.subtitle')}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button type="submit" form={formId} variant="primary" loading={busy} disabled={readOnly}>{editing ? t('saveChanges') : t('inventory.form.create')}</Button>
      </>}>
      <form id={formId} onSubmit={submit} noValidate className="inv-form">
        <div className="form-section">
          <div className="form-section-title"><Boxes />{t('inventory.section.basic')}</div>
          <div className="form-grid">
            <div className="span-2"><Input label={t('inventory.field.name')} required placeholder={t('inventory.field.namePlaceholder')} value={f.name} onChange={e => set('name', e.target.value)} error={err('name')} maxLength={120} autoFocus /></div>
            <div className="field">
              <Input label={t('inventory.field.category')} placeholder={t('inventory.field.categoryPlaceholder')} value={f.category} onChange={e => set('category', e.target.value)} list={`${uid}-cats`} clearable onClear={() => set('category', '')} />
              <datalist id={`${uid}-cats`}>
                {CATEGORY_PRESETS.map(c => <option key={c} value={t(`inventory.cat.${c}`)} />)}
                {customCats.map(c => <option key={c} value={c} />)}
              </datalist>
              <div className="inv-cat-picks">
                {CATEGORY_PRESETS.map(c => <Chip key={c} className="inv-chip-sm" active={chosenCat === c} onClick={() => set('category', t(`inventory.cat.${c}`))}>{t(`inventory.cat.${c}`)}</Chip>)}
                {customCats.slice(0, 4).map(c => <Chip key={c} className="inv-chip-sm" active={chosenCat === c} onClick={() => set('category', c)}><span className="inv-chip-label truncate" dir="auto" title={c}>{c}</span></Chip>)}
              </div>
            </div>
            <Input label={t('inventory.field.sku')} value={f.sku} onChange={e => set('sku', e.target.value)} dir="ltr" className="inv-ltr-input" placeholder="GL-M-100" maxLength={40} />
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title"><Info />{t('inventory.section.stock')}</div>
          <div className="form-grid form-grid-3 inv-form-3">
            <div className="field">
              <Select label={t('inventory.field.unit')} value={f.unit} onChange={e => set('unit', e.target.value)} options={UNITS.map(u => ({ value: u, label: u === 'other' ? t('inventory.unit.custom') : unitLabel(t, u) }))} />
              {f.unit === 'other' && <Input placeholder={t('inventory.field.customUnit')} value={f.customUnit} onChange={e => set('customUnit', e.target.value)} error={err('unit')} maxLength={20} aria-label={t('inventory.field.customUnit')} />}
            </div>
            <NumberField label={editing ? t('inventory.field.quantity') : t('inventory.field.initialQty')} value={f.quantity} onChange={v => set('quantity', v)} decimals={2} min={0}
              disabled={editing} error={err('quantity')} hint={editing ? t('inventory.qtyLockedShort') : t('inventory.field.initialHint')} />
            <NumberField label={t('inventory.field.minQuantity')} value={f.minQuantity} onChange={v => set('minQuantity', v)} decimals={2} min={0} error={err('minQuantity')} hint={t('inventory.field.minHint')} />
            <NumberField label={t('inventory.field.costPrice')} value={f.costPrice} onChange={v => set('costPrice', v)} decimals={2} min={0} error={err('costPrice')} hint={t('inventory.field.costHint')} addon={clinic.currencySymbol || clinic.currency} />
            <Input type="date" label={t('inventory.field.expiryDate')} value={f.expiryDate} onChange={e => set('expiryDate', e.target.value)} error={err('expiryDate')} hint={t('inventory.field.expiryHint')} />
            <div className="field">
              <Input label={t('inventory.field.supplier')} value={f.supplier} onChange={e => set('supplier', e.target.value)} list={`${uid}-sup`} maxLength={80} />
              <datalist id={`${uid}-sup`}>{suppliers.map(s => <option key={s} value={s} />)}</datalist>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-grid">
            <Input label={t('inventory.field.location')} placeholder={t('inventory.field.locationPlaceholder')} value={f.location} onChange={e => set('location', e.target.value)} maxLength={80} />
            {editing ? (
              <Field label={t('status')} hint={t('inventory.field.activeHint')}>
                <Switch checked={f.active} onChange={e => set('active', e.target.checked)} label={f.active ? t('inventory.field.active') : t('inventory.inactive')} />
              </Field>
            ) : <div className="hide-below-sm" />}
            <div className="span-2"><Textarea label={t('inventory.field.notes')} value={f.notes} onChange={e => set('notes', e.target.value)} rows={2} maxLength={500} /></div>
          </div>
        </div>
      </form>
    </Modal>
  )
}

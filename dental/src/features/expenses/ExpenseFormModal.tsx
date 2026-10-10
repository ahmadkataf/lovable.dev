// New / edit expense. Opened from the expenses page and from quick-add elsewhere in the app.
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, ReceiptText } from 'lucide-react'
import { db, logActivity } from '@/db'
import { newId, nowISO, todayISO } from '@/db/ids'
import type { Expense, ExpenseCategory, PaymentMethod } from '@/db/types'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/db/types'
import { Button, Input, Modal, Select, useToast } from '@/ui'
import { NumberField } from '@/features/inventory/fields'
import { useI18n } from '@/i18n'
import { useClinic, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { validateExpense, type ExpenseErrors } from './lib'
import './expenses.css'

export interface ExpenseFormModalProps { open: boolean; onClose: () => void; expense?: Expense; onSaved?: (id: string) => void }

interface FormState { category: ExpenseCategory | ''; amount: number | null; date: string; description: string; vendor: string; method: PaymentMethod | '' }

export default function ExpenseFormModal({ open, onClose, expense, onSaved }: ExpenseFormModalProps) {
  const { t } = useI18n()
  const toast = useToast()
  const money = useMoney()
  const clinic = useClinic()
  const { user } = useSession()
  const { readOnly } = useLicense()
  const uid = useId().replace(/:/g, '')
  const editing = !!expense

  const [f, setF] = useState<FormState>({ category: '', amount: null, date: todayISO(), description: '', vendor: '', method: 'cash' })
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setTried(false); setBusy(false)
    setF(expense
      ? { category: expense.category, amount: expense.amount, date: expense.date, description: expense.description, vendor: expense.vendor ?? '', method: expense.method ?? '' }
      : { category: '', amount: null, date: todayISO(), description: '', vendor: '', method: 'cash' })
  }, [open, expense])

  // vendors used before, most recent first, for the suggestions list
  const recent = useLiveQuery(() => (open ? db.expenses.orderBy('date').reverse().limit(400).toArray() : Promise.resolve([] as Expense[])), [open])
  const vendors = useMemo(() => [...new Set((recent ?? []).map(e => e.vendor?.trim()).filter(Boolean) as string[])].slice(0, 30), [recent])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF(s => ({ ...s, [k]: v }))
  const errors: ExpenseErrors = validateExpense({ category: f.category, amount: f.amount, date: f.date, description: f.description })
  const err = (k: keyof ExpenseErrors) => (tried && errors[k] ? (errors[k] === 'positive' ? t('v.positive') : errors[k] === 'date' ? t('v.date') : t('v.required')) : undefined)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setTried(true)
    if (Object.keys(errors).length) {
      window.setTimeout(() => document.querySelector<HTMLElement>(`#${uid}-form .invalid`)?.focus(), 0)
      return
    }
    if (readOnly) { toast.warning(t('expenses.toast.readOnly')); return }
    setBusy(true)
    const data = {
      category: f.category as ExpenseCategory, amount: Math.round((f.amount ?? 0) * 100) / 100, date: f.date, description: f.description.trim(),
      vendor: f.vendor.trim() || undefined, method: (f.method || undefined) as PaymentMethod | undefined,
    }
    try {
      let id: string
      if (expense) {
        id = expense.id
        await db.expenses.put({ ...expense, ...data })
        toast.success(t('expenses.toast.updated'), <><bdi>{data.description}</bdi> · <span className="money">{money(data.amount)}</span></>)
        void logActivity({ type: 'expense', action: 'update', entityId: id, by: user?.id, message: t('expenses.act.updated', { desc: data.description }) })
      } else {
        id = newId()
        await db.expenses.add({ id, ...data, by: user?.id, createdAt: nowISO() })
        toast.success(t('expenses.toast.created'), <><bdi>{data.description}</bdi> · <span className="money">{money(data.amount)}</span></>)
        void logActivity({ type: 'expense', action: 'create', entityId: id, by: user?.id, message: t('expenses.act.created', { desc: data.description, amount: money(data.amount) }) })
      }
      onSaved?.(id)
      onClose()
    } catch {
      toast.error(t('error'), t('tryAgain'))
    } finally { setBusy(false) }
  }

  const formId = `${uid}-form`
  return (
    <Modal open={open} onClose={onClose} size="md" icon={editing ? <Pencil /> : <ReceiptText />}
      title={editing ? t('expenses.editExpense') : t('expenses.newExpense')} subtitle={editing ? undefined : t('expenses.form.subtitle')}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button type="submit" form={formId} variant="primary" loading={busy} disabled={readOnly}>{editing ? t('saveChanges') : t('expenses.form.create')}</Button>
      </>}>
      <form id={formId} onSubmit={submit} noValidate className="inv-exp-form">
        <div className="form-grid">
          <Select label={t('expenses.field.category')} required value={f.category} onChange={e => set('category', e.target.value as ExpenseCategory)} placeholder={t('expenses.field.categoryPlaceholder')}
            error={err('category')} options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: t(`exp.${c}`) }))} />
          <NumberField label={t('expenses.field.amount')} required value={f.amount} onChange={v => set('amount', v)} decimals={clinic.currencyDecimals} min={0}
            addon={clinic.currencySymbol || clinic.currency} error={err('amount')} />
          <Input type="date" label={t('expenses.field.date')} required value={f.date} onChange={e => set('date', e.target.value)} error={err('date')} />
          <div className="span-2">
            <Input label={t('expenses.field.description')} required placeholder={t('expenses.field.descriptionPlaceholder')} value={f.description} onChange={e => set('description', e.target.value)} error={err('description')} maxLength={160} />
          </div>
          <div className="field">
            <Input label={t('expenses.field.vendor')} placeholder={t('expenses.field.vendorPlaceholder')} value={f.vendor} onChange={e => set('vendor', e.target.value)} list={`${uid}-vendors`} maxLength={80} />
            <datalist id={`${uid}-vendors`}>{vendors.map(v => <option key={v} value={v} />)}</datalist>
          </div>
          <Select label={t('expenses.field.method')} value={f.method} onChange={e => set('method', e.target.value as PaymentMethod | '')} placeholder="—"
            options={PAYMENT_METHODS.map(m => ({ value: m, label: t(`pay.${m}`) }))} />
        </div>
      </form>
    </Modal>
  )
}

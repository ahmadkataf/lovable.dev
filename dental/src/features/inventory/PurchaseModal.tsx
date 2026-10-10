// Purchase: several items in one go. Quantities go up, cost prices are refreshed and each line becomes a
// 'purchase' movement; optionally the total is also recorded as a materials expense.
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ShoppingCart, Trash2, TriangleAlert } from 'lucide-react'
import { db, logActivity } from '@/db'
import { todayISO } from '@/db/ids'
import type { InventoryItem } from '@/db/types'
import { Alert, Button, Field, Input, Modal, Select, Switch, useToast } from '@/ui'
import { NumberField } from './fields'
import { useI18n } from '@/i18n'
import { useClinic, useIsMobile, useMoney } from '@/app/hooks'
import { useSession } from '@/app/session'
import { useLicense } from '@/license/useLicense'
import { isLowStock, purchaseTotal, suggestReorderQty, validatePurchase, type PurchaseLine } from './lib'
import { recordPurchase } from './actions'
import { qtyText, unitLabel } from './parts'

interface Row extends PurchaseLine { key: string }
let seq = 0
const newRow = (p: Partial<PurchaseLine> = {}): Row => ({ key: `r${++seq}`, itemId: '', quantity: null, costPrice: null, ...p })

export default function PurchaseModal({ open, onClose, initialItemIds }: { open: boolean; onClose: () => void; initialItemIds?: string[] }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const money = useMoney()
  const clinic = useClinic()
  const mobile = useIsMobile()
  const session = useSession()
  const { readOnly } = useLicense()
  const uid = useId().replace(/:/g, '')
  const items = useLiveQuery(() => db.inventory.filter(i => i.active).toArray(), [])
  const byId = useMemo(() => new Map((items ?? []).map(i => [i.id, i])), [items])
  const sorted = useMemo(() => [...(items ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [items])
  const suppliers = useMemo(() => [...new Set((items ?? []).map(i => i.supplier?.trim()).filter(Boolean) as string[])].sort(), [items])

  const [rows, setRows] = useState<Row[]>([newRow()])
  const [date, setDate] = useState(todayISO())
  const [supplier, setSupplier] = useState('')
  const [reference, setReference] = useState('')
  const [asExpense, setAsExpense] = useState(true)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const canExpense = session.can('manage')

  // fresh form on every open (pre-filled with the given items, e.g. the low-stock ones)
  useEffect(() => {
    if (!open) return
    setDate(todayISO()); setSupplier(''); setReference(''); setTried(false); setBusy(false); setAsExpense(true)
    setRows([newRow()])
    // start on the first line, not on the date (the dialog focuses its first field by itself)
    const id = window.setTimeout(() => document.querySelector<HTMLElement>(`#${uid}-purchase .inv-pl:not(.inv-pl-head) select`)?.focus(), 120)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => {
    if (!open || !items || !initialItemIds?.length) return
    const list = initialItemIds.map(id => byId.get(id)).filter(Boolean) as InventoryItem[]
    if (list.length) setRows(list.map(i => newRow({ itemId: i.id, quantity: suggestReorderQty(i), costPrice: i.costPrice ?? null })))
    // only when opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items === undefined])

  const update = (key: string, patch: Partial<PurchaseLine>) => setRows(rs => rs.map(r => {
    if (r.key !== key) return r
    const next = { ...r, ...patch }
    if (patch.itemId !== undefined && patch.itemId !== r.itemId) {
      const it = byId.get(patch.itemId)
      next.costPrice = it?.costPrice ?? null
      if (next.quantity === null && it) next.quantity = isLowStock(it) ? suggestReorderQty(it) : null
    }
    return next
  }))
  const remove = (key: string) => setRows(rs => (rs.length > 1 ? rs.filter(r => r.key !== key) : [newRow()]))
  const addLow = () => {
    const present = new Set(rows.map(r => r.itemId))
    const low = sorted.filter(i => isLowStock(i) && !present.has(i.id))
    if (!low.length) return
    setRows(rs => [...rs.filter(r => r.itemId || r.quantity !== null), ...low.map(i => newRow({ itemId: i.id, quantity: suggestReorderQty(i), costPrice: i.costPrice ?? null }))])
  }
  const lowCount = sorted.filter(i => isLowStock(i) && !rows.some(r => r.itemId === i.id)).length

  const check = validatePurchase(rows)
  const total = purchaseTotal(rows)
  const rowError = (i: number) => {
    if (!tried) return undefined
    const e = check.errors[i]
    return e === 'item' ? t('inventory.purchase.pickItem') : e === 'duplicate' ? t('inventory.purchase.dup') : e === 'quantity' ? t('inventory.v.amount') : undefined
  }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setTried(true)
    if (!check.ok || !date) return
    if (readOnly) { toast.warning(t('inventory.toast.readOnly')); return }
    setBusy(true)
    try {
      const desc = t('inventory.purchase.expenseDesc', { n: rows.length }) + (supplier.trim() ? ` — ${supplier.trim()}` : '')
      const r = await recordPurchase({
        lines: rows.map(r => ({ itemId: r.itemId, quantity: r.quantity ?? 0, costPrice: r.costPrice })), date, supplier, reference, by: session.user?.id,
        expenseDescription: canExpense && asExpense ? desc : undefined,
      })
      toast.success(t('inventory.toast.purchased', { n: r.count }), r.total > 0 ? money(r.total) : undefined)
      void logActivity({ type: 'inventory', action: 'create', by: session.user?.id, message: t('inventory.act.purchased', { n: r.count }) + (r.total > 0 ? ` (${money(r.total)})` : '') })
      if (r.expenseId) void logActivity({ type: 'expense', action: 'create', entityId: r.expenseId, by: session.user?.id, message: t('expenses.act.created', { desc, amount: money(r.total) }) })
      onClose()
    } catch {
      toast.error(t('error'), t('tryAgain'))
    } finally { setBusy(false) }
  }

  const formId = `${uid}-purchase`
  const empty = items !== undefined && sorted.length === 0
  return (
    <Modal open={open} onClose={onClose} size="xl" icon={<ShoppingCart />} title={t('inventory.purchase.title')} subtitle={t('inventory.purchase.subtitle')}
      footer={<>
        <div className="start inv-purchase-total"><span className="muted">{t('inventory.purchase.total')}</span><span className="money">{money(total)}</span></div>
        <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
        <Button type="submit" form={formId} variant="primary" loading={busy} disabled={readOnly || empty} icon={<ShoppingCart />}>{t('inventory.purchase.save')}</Button>
      </>}>
      {empty ? <Alert tone="info">{t('inventory.purchase.needItems')}</Alert> : (
        <form id={formId} onSubmit={submit} noValidate className="inv-purchase">
          <div className="form-grid form-grid-3 inv-form-3">
            <Input type="date" label={t('inventory.purchase.date')} required value={date} onChange={e => setDate(e.target.value)} error={tried && !date ? t('v.required') : undefined} />
            <div className="field">
              <Input label={t('inventory.purchase.supplier')} value={supplier} onChange={e => setSupplier(e.target.value)} list={`${uid}-sup`} maxLength={80} />
              <datalist id={`${uid}-sup`}>{suppliers.map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <Input label={t('inventory.purchase.reference')} value={reference} onChange={e => setReference(e.target.value)} maxLength={40} dir="ltr" className="inv-ltr-input" />
          </div>

          <div className="inv-purchase-lines">
            {!mobile && (
              <div className="inv-pl inv-pl-head" aria-hidden>
                <span>{t('inventory.purchase.item')}</span><span>{t('inventory.purchase.qty')}</span><span>{t('inventory.purchase.cost')}</span><span className="inv-pl-total">{t('inventory.purchase.lineTotal')}</span><span />
              </div>
            )}
            {rows.map((r, i) => {
              const it = byId.get(r.itemId)
              const e = rowError(i)
              const line = (r.quantity || 0) * (r.costPrice || 0)
              return (
                <div key={r.key} className={`inv-pl${e ? ' has-error' : ''}`}>
                  <div className="inv-pl-item">
                    <Select aria-label={t('inventory.purchase.item')} value={r.itemId} onChange={ev => update(r.key, { itemId: ev.target.value })} placeholder={t('inventory.purchase.pickItem')}
                      invalid={tried && (check.errors[i] === 'item' || check.errors[i] === 'duplicate')}
                      options={sorted.map(o => ({ value: o.id, label: `${o.name}${o.sku ? ` · ${o.sku}` : ''}` }))} />
                    {it && <div className="inv-pl-meta">{t('inventory.move.current')}: <span className="num">{qtyText(it.quantity, lang)}</span> {unitLabel(t, it.unit)}{isLowStock(it) && <span className="inv-text-danger"> · {t('inventory.low')}</span>}</div>}
                  </div>
                  <div className="inv-pl-cell">
                    {mobile && <span className="inv-pl-label">{t('inventory.purchase.qty')}</span>}
                    <NumberField aria-label={t('inventory.purchase.qty')} value={r.quantity} onChange={v => update(r.key, { quantity: v })} decimals={2} min={0} invalid={tried && check.errors[i] === 'quantity'} addon={it ? unitLabel(t, it.unit) : undefined} />
                  </div>
                  <div className="inv-pl-cell">
                    {mobile && <span className="inv-pl-label">{t('inventory.purchase.cost')}</span>}
                    <NumberField aria-label={t('inventory.purchase.cost')} value={r.costPrice} onChange={v => update(r.key, { costPrice: v })} decimals={2} min={0} addon={clinic.currencySymbol || clinic.currency} />
                  </div>
                  <div className="inv-pl-total">{mobile && <span className="inv-pl-label">{t('inventory.purchase.lineTotal')}</span>}<span className="money">{money(line)}</span></div>
                  <div className="inv-pl-remove">
                    <Button variant="ghost" size={mobile ? 'md' : 'sm'} icon={<Trash2 />} aria-label={t('delete')} title={t('delete')} onClick={() => remove(r.key)} />
                  </div>
                  {e && <div className="inv-pl-error field-error" role="alert">{e}</div>}
                </div>
              )
            })}
          </div>
          <div className="row wrap gap-2 mt-3">
            <Button variant="soft" size="sm" icon={<Plus />} onClick={() => setRows(rs => [...rs, newRow()])}>{t('inventory.purchase.addRow')}</Button>
            {lowCount > 0 && <Button variant="ghost" size="sm" icon={<TriangleAlert />} onClick={addLow}>{t('inventory.purchase.addLow', { n: lowCount })}</Button>}
          </div>
          {tried && !rows.some(r => r.itemId) && <div className="field-error mt-2">{t('inventory.purchase.noItems')}</div>}
          {canExpense && (
            <div className="inv-purchase-expense mt-4">
              <Field hint={t('inventory.purchase.asExpenseHint')}>
                <Switch checked={asExpense} onChange={e => setAsExpense(e.target.checked)} label={t('inventory.purchase.asExpense')} />
              </Field>
            </div>
          )}
        </form>
      )}
    </Modal>
  )
}

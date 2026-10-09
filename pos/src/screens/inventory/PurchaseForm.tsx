// فاتورة شراء جديدة: supplier, items by search / camera / USB scanner, what was paid now. The draft lives in
// db.kv 'purchase.draft' so a reload (or a phone call) does not lose forty scanned lines.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Minus, X, UserPlus, ShoppingBag, Trash2 } from 'lucide-react'
import { db } from '../../db'
import type { PaymentMethod, Product } from '../../db/types'
import { useT } from '../../i18n'
import { Button, Empty, Field, Input, NumberInput, Seg, Select, SwitchRow, useIsMobile } from '../../components/ui'
import { formatMoney, formatQty, round } from '../../lib/money'
import { createPurchase, PurchaseError, purchaseTotal } from '../../lib/purchases'
import { toast, confirmDialog, useSettings, useStore, useUser } from '../../state/store'
import { addPurchaseLine, type PurchaseLine } from './logic'
import { NumPadSheet, ProductAvatar, ProductPicker, SubHead, unitLabel } from './shared'
import { SupplierModal } from './SuppliersTab'

const DRAFT_KEY = 'purchase.draft'
interface Draft { supplierId?: string; lines: PurchaseLine[]; paid: number; method: PaymentMethod; note: string; drawer: boolean }
let seq = 0
const lineKey = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`

export function PurchaseForm() {
  const t = useT()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const user = useUser()
  const shift = useStore(s => s.shift)
  const settings = useSettings()
  const c = settings.currency
  const d = c.decimals
  const mobile = useIsMobile()
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), [], [])
  const [state, setState] = useState<Draft>(() => ({
    supplierId: params.get('supplier') ?? undefined, lines: [], paid: 0,
    method: settings.pos.defaultMethod === 'credit' ? 'cash' : settings.pos.defaultMethod, note: '', drawer: !!shift,
  }))
  const [loaded, setLoaded] = useState(false)
  const [restored, setRestored] = useState(false)
  const [newSupplier, setNewSupplier] = useState(false)
  const [paidSheet, setPaidSheet] = useState(false)
  const [busy, setBusy] = useState(false)
  const up = (patch: Partial<Draft>) => setState(s => ({ ...s, ...patch }))

  // restore a draft once
  useEffect(() => {
    let alive = true
    void db.kv.get(DRAFT_KEY).then(row => {
      if (!alive) return
      const dr = row?.value as Draft | undefined
      if (dr && Array.isArray(dr.lines) && dr.lines.length) {
        setState(s => ({ ...s, ...dr, supplierId: params.get('supplier') ?? dr.supplierId, drawer: !!dr.drawer && !!shift }))
        setRestored(true)
      } else if (params.get('low') === '1') {
        // a reorder suggestion: every low-stock product, enough to be back above its threshold twice over
        void db.products.filter(p => p.active && p.trackStock && p.lowStock > 0 && p.stock <= p.lowStock).toArray().then(low => {
          if (!alive || !low.length) return
          let lines: PurchaseLine[] = []
          for (const p of low) {
            lines = addPurchaseLine(lines, p, lineKey())
            const want = Math.max(1, round(p.lowStock * 2 - p.stock, p.allowFraction ? 3 : 0))
            lines = lines.map(l => (l.productId === p.id ? { ...l, qty: want } : l))
          }
          setState(s => ({ ...s, lines }))
        })
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
    return () => { alive = false }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  // keep the draft saved
  useEffect(() => {
    if (!loaded) return
    const h = window.setTimeout(() => { if (state.lines.length) void db.kv.put({ key: DRAFT_KEY, value: state }); else void db.kv.delete(DRAFT_KEY) }, 400)
    return () => clearTimeout(h)
  }, [loaded, state])

  const total = purchaseTotal(state.lines, d)
  const remaining = round(total - state.paid, d)
  const qtySum = round(state.lines.reduce((s, l) => s + l.qty, 0), 3)
  useEffect(() => { if (state.paid > total) up({ paid: total }) }, [total])  // eslint-disable-line react-hooks/exhaustive-deps

  const addProduct = (p: Product) => up({ lines: addPurchaseLine(state.lines, p, lineKey()) })
  const patch = (key: string, x: Partial<PurchaseLine>) => up({ lines: state.lines.map(l => (l.key === key ? { ...l, ...x } : l)) })
  const remove = (key: string) => up({ lines: state.lines.filter(l => l.key !== key) })
  const step = (l: PurchaseLine, dir: 1 | -1) => {
    const q = round(l.qty + dir, 3)
    if (q <= 0) remove(l.key); else patch(l.key, { qty: q })
  }
  const discard = async () => {
    if (!(await confirmDialog({ title: t('inventory.form.discardTitle'), text: t('inventory.form.discardText'), danger: true, okLabel: t('inventory.form.discard') }))) return
    up({ lines: [], paid: 0, note: '' })
    setRestored(false)
    await db.kv.delete(DRAFT_KEY)
  }
  const save = async () => {
    if (!user || busy) return
    if (!state.lines.length) { toast(t('inventory.err.noItems'), 'error'); return }
    if (state.lines.some(l => !(l.qty > 0))) { toast(t('inventory.form.errQty'), 'error'); return }
    if (state.lines.some(l => l.cost < 0)) { toast(t('inventory.err.cost'), 'error'); return }
    if (state.paid > total) { toast(t('inventory.err.paid'), 'error'); return }
    setBusy(true)
    try {
      const p = await createPurchase({
        supplierId: state.supplierId || undefined, paid: state.paid, method: state.method, note: state.note, user, decimals: d,
        items: state.lines.map(l => ({ productId: l.productId, name: l.name, qty: l.qty, cost: l.cost })),
        drawerShiftId: state.drawer && state.method === 'cash' && shift ? shift.id : undefined,
      })
      await db.kv.delete(DRAFT_KEY)
      toast(t('inventory.form.saved', { n: p.number }), 'success')
      nav(`/inventory/purchases/${p.id}`, { replace: true })
    } catch (e) { toast(e instanceof PurchaseError ? t(e.key) : t('common.error'), 'error'); setBusy(false) }
  }

  const totals = (
    <div className="card pad col inv-totals inv-form-side">
      <div className="row between small"><span className="muted">{t('inventory.form.items', { n: state.lines.length })}</span><span className="num muted">{formatQty(qtySum)}</span></div>
      <div className="row between inv-total-line"><span>{t('common.total')}</span><span className="num inv-big">{formatMoney(total, c)}</span></div>
      <div className="divider" />
      <Field label={t('inventory.form.paidNow')}>
        <button type="button" className="input inv-amount-btn num" onClick={() => setPaidSheet(true)}>{formatMoney(state.paid, c)}</button>
      </Field>
      <div className="row">
        <Button size="sm" variant="soft" onClick={() => up({ paid: total })} disabled={total === 0}>{t('inventory.form.full')}</Button>
        <Button size="sm" onClick={() => up({ paid: 0 })} disabled={state.paid === 0}>{t('inventory.form.nothing')}</Button>
      </div>
      {state.paid > 0 && (
        <Seg block value={state.method} onChange={m => up({ method: m })} options={[{ value: 'cash', label: t('common.cash') }, { value: 'card', label: t('common.card') }, { value: 'transfer', label: t('common.transfer') }]} />
      )}
      {state.paid > 0 && state.method === 'cash' && shift && <SwitchRow label={t('inventory.form.drawer')} desc={t('inventory.form.drawerDesc')} on={state.drawer} onChange={v => up({ drawer: v })} />}
      <div className="row between"><span className="muted">{t('inventory.form.remaining')}</span><span className={`num bold ${remaining > 0 ? 'inv-warn' : ''}`}>{formatMoney(remaining, c)}</span></div>
      {remaining > 0 && !state.supplierId && <div className="banner warn">{t('inventory.form.remainingNoSupplier')}</div>}
      <Field label={t('common.note')}><Input value={state.note} onChange={e => up({ note: e.target.value })} placeholder={t('inventory.form.notePh')} /></Field>
      {!mobile && <Button variant="primary" size="lg" block loading={busy} disabled={!state.lines.length} onClick={() => void save()}>{t('inventory.form.save')}</Button>}
    </div>
  )

  return (
    <div className="page">
      <SubHead title={t('inventory.form.title')} back="/inventory/purchases" actions={state.lines.length > 0 ? <Button variant="ghost" iconOnly icon={<Trash2 size={18} />} onClick={() => void discard()} title={t('inventory.form.discard')} aria-label={t('inventory.form.discard')} /> : undefined} />
      <div className="page-body">
        <div className="inv-form-grid">
          <div className="col">
            {restored && <div className="banner warn">{t('inventory.form.draftRestored')}<Button size="sm" variant="soft" onClick={() => void discard()}>{t('inventory.form.discard')}</Button></div>}
            <Field label={t('common.supplier')}>
              <div className="row">
                <Select className="grow" value={state.supplierId ?? ''} onChange={e => { if (e.target.value === '__new') setNewSupplier(true); else up({ supplierId: e.target.value || undefined }) }}>
                  <option value="">{t('inventory.purchases.noSupplier')}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="__new">+ {t('inventory.suppliers.add')}</option>
                </Select>
                <Button iconOnly icon={<UserPlus size={18} />} onClick={() => setNewSupplier(true)} title={t('inventory.suppliers.add')} aria-label={t('inventory.suppliers.add')} />
              </div>
            </Field>
            <Field label={t('inventory.form.addItems')} hint={t('inventory.form.costHint')}>
              <ProductPicker onPick={addProduct} autoFocus={!mobile} placeholder={t('inventory.form.searchPh')} />
            </Field>
            {state.lines.length === 0 ? (
              <Empty icon={<ShoppingBag size={32} />} title={t('inventory.form.noItems')} text={t('inventory.form.noItemsText')} />
            ) : (
              <div className="col" style={{ gap: 8 }}>
                {state.lines.map(l => (
                  <div key={l.key} className="card flat inv-line">
                    <div className="inv-line-main">
                      <ProductAvatar p={{ name: l.name }} size={32} />
                      <div className="grow truncate"><div className="bold truncate">{l.name}</div><div className="xs faint">{unitLabel(l.unit)}</div></div>
                      <Button variant="ghost" iconOnly icon={<X size={18} />} onClick={() => remove(l.key)} aria-label={t('common.delete')} />
                    </div>
                    <div className="inv-line-inputs">
                      <div className="inv-qty">
                        <Button iconOnly icon={<Minus size={16} />} onClick={() => step(l, -1)} aria-label="-" />
                        <NumberInput value={l.qty} onChange={n => patch(l.key, { qty: Math.max(0, n) })} decimals={l.allowFraction ? 3 : 0} aria-label={t('common.qty')} />
                        <Button iconOnly icon={<Plus size={16} />} onClick={() => step(l, 1)} aria-label="+" />
                      </div>
                      <span className="faint">×</span>
                      <NumberInput className="inv-cost" value={l.cost} onChange={n => patch(l.key, { cost: Math.max(0, n) })} decimals={d} aria-label={t('inventory.form.unitCost')} />
                      <span className="num bold inv-line-total">{formatMoney(round(l.qty * l.cost, d), c)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {totals}
        </div>
      </div>
      {mobile && (
        <div className="inv-sticky">
          <div className="grow"><div className="xs faint">{t('common.total')}</div><div className="num bold">{formatMoney(total, c)}</div></div>
          <Button variant="primary" size="lg" loading={busy} disabled={!state.lines.length} onClick={() => void save()}>{t('inventory.form.save')}</Button>
        </div>
      )}
      <SupplierModal open={newSupplier} onClose={() => setNewSupplier(false)} onSaved={s => up({ supplierId: s.id })} />
      <NumPadSheet open={paidSheet} onClose={() => setPaidSheet(false)} title={t('inventory.form.paidNow')} initial={state.paid} decimals={d} suffix={c.symbol} allowZero
        quick={total > 0 ? [{ label: t('inventory.form.full'), value: total }] : undefined} onConfirm={n => up({ paid: Math.min(n, total) })} />
    </div>
  )
}

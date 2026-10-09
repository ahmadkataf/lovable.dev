// The small dialogs of the sales screen: line editor, discount, note, quantity pad, custom item,
// hold / held tickets, customer picker and the "new product from an unknown barcode" form.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Minus, Plus, Trash, RotateCcw, UserPlus, User, Check, CirclePause, Info, Search } from 'lucide-react'
import { db } from '../../db'
import type { Category, Customer, HeldTicket, Product, Settings, User as DbUser } from '../../db/types'
import { type Cart, type CartLine, computeTotals, lineKey } from '../../lib/cart'
import { uid } from '../../lib/ids'
import { applyStock } from '../../lib/stock'
import { formatMoney, formatQty, parseNumber, round } from '../../lib/money'
import { formatDateTime } from '../../lib/format'
import { cleanBarcode } from '../../lib/barcode'
import { useT } from '../../i18n'
import { forbiddenProduct } from '../../lib/policy'
import { PolicyBanner } from '../../components/PolicyBanner'
import { toast } from '../../state/store'
import { Modal, Button, Input, NumberInput, Textarea, Select, Field, Seg, SwitchRow, NumPad, Avatar, Empty, SearchInput, Money } from '../../components/ui'
import { normalizeText } from './search'
import { unitLabel } from './CartPanel'

/** Lets the keyboard drive a NumPad-style value while a dialog is open (digits, dot, backspace, Enter). */
export function useNumKeys(o: { enabled: boolean; value: string; onChange: (v: string) => void; decimals: number; onEnter?: () => void }) {
  const { enabled, value, onChange, decimals, onEnter } = o
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      const inDialog = !!el?.closest('.modal')
      if (inDialog && (el!.tagName === 'INPUT' || el!.tagName === 'TEXTAREA' || el!.tagName === 'SELECT' || el!.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      let k = e.key
      const ar = '٠١٢٣٤٥٦٧٨٩'.indexOf(k)
      if (ar >= 0) k = String(ar)
      if (/^\d$/.test(k)) {
        e.preventDefault()
        if (value.length >= 12) return
        if (value.includes('.') && value.split('.')[1].length >= decimals) return
        onChange(value === '0' ? k : value + k)
      } else if ((k === '.' || k === ',' || k === '٫') && decimals > 0) {
        e.preventDefault()
        if (!value.includes('.')) onChange((value || '0') + '.')
      } else if (k === 'Backspace') { e.preventDefault(); onChange(value.slice(0, -1)) }
      else if (k === 'Enter' && onEnter) {
        if (inDialog && el!.tagName === 'BUTTON') return   // a focused button in the dialog (Cancel, a quick amount) keeps its own Enter
        e.preventDefault(); onEnter()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enabled, value, onChange, decimals, onEnter])
}

const enterSaves = (save: () => void) => (e: React.KeyboardEvent) => {
  const tag = (e.target as HTMLElement).tagName
  if (e.key === 'Enter' && tag === 'INPUT') { e.preventDefault(); save() }
}

/* ---------------- line editor ---------------- */
export function LineEditorDialog({ line, settings, onSave, onRemove, onClose, allowPrice = true, allowDiscount = true }: { line: CartLine; settings: Settings; onSave: (patch: Partial<CartLine>) => void; onRemove: () => void; onClose: () => void; allowPrice?: boolean; allowDiscount?: boolean }) {
  const t = useT()
  const c = settings.currency
  const d = c.decimals
  const [qty, setQty] = useState<number | ''>(line.qty)
  const [price, setPrice] = useState<number | ''>(line.price)
  const [mode, setMode] = useState<'amount' | 'pct'>(line.discountPct !== undefined ? 'pct' : 'amount')
  const [disc, setDisc] = useState<number | ''>(line.discountPct !== undefined ? line.discountPct : line.discount || '')
  const [note, setNote] = useState(line.note ?? '')
  const q = qty === '' ? 0 : qty
  const pr = price === '' ? 0 : price
  const gross = round(pr * q, d)
  const dv = disc === '' ? 0 : disc
  const discount = Math.min(gross, mode === 'pct' ? round((gross * Math.min(100, Math.max(0, dv))) / 100, d) : round(Math.max(0, dv), d))
  const total = round(gross - discount, d)
  const step = line.allowFraction ? 0.5 : 1
  const save = () => {
    if (q <= 0) { onRemove(); return }
    onSave({
      qty: round(q, 3), price: allowPrice ? round(Math.max(0, pr), d) : line.price, discount: allowDiscount ? discount : line.discount, discountPct: allowDiscount ? (mode === 'pct' && dv > 0 ? Math.min(100, dv) : undefined) : line.discountPct, note: note.trim() || undefined,
    })
  }
  return (
    <Modal open onClose={onClose} title={t('sales.lineTitle')} footer={
      <>
        <Button variant="soft-danger" icon={<Trash size={16} />} onClick={onRemove}>{t('sales.lineRemove')}</Button>
        <Button variant="primary" icon={<Check size={16} />} onClick={save}>{t('common.save')}</Button>
      </>
    }>
      <div className="col" style={{ gap: 14 }} onKeyDown={enterSaves(save)}>
        <div className="bold" style={{ fontSize: 16 }}>{line.name}</div>
        <Field label={`${t('common.qty')}${line.unit && line.unit !== 'piece' ? ` (${unitLabel(line.unit, t)})` : ''}`}>
          <div className="qty-stepper">
            <Button iconOnly size="lg" icon={<Minus size={18} />} aria-label="−" onClick={() => setQty(Math.max(0, round(q - step, 3)))} />
            <NumberInput value={qty} onChange={setQty} decimals={line.allowFraction ? 3 : 0} autoFocus style={{ minHeight: 52 }} />
            <Button iconOnly size="lg" icon={<Plus size={18} />} aria-label="+" onClick={() => setQty(round(q + step, 3))} />
          </div>
        </Field>
        <Field label={t('sales.linePrice')} hint={line.price !== line.originalPrice || pr !== line.originalPrice ? t('sales.lineOriginal', { price: formatMoney(line.originalPrice, c) }) : undefined}>
          <div className="row">
            <NumberInput value={price} onChange={setPrice} decimals={d} disabled={!allowPrice} />
            {allowPrice && pr !== line.originalPrice && <Button iconOnly icon={<RotateCcw size={16} />} title={t('sales.lineOriginal', { price: formatMoney(line.originalPrice, c) })} aria-label={t('common.retry')} onClick={() => setPrice(line.originalPrice)} />}
          </div>
        </Field>
        <Field label={t('sales.lineDiscount')}>
          <div className="row">
            <Seg value={mode} onChange={m => { setMode(m); setDisc('') }} options={[{ value: 'amount', label: t('sales.discountAmount') }, { value: 'pct', label: t('sales.discountPct') }]} />
            <NumberInput value={disc} onChange={setDisc} decimals={mode === 'pct' ? 1 : d} placeholder="0" disabled={!allowDiscount} />
          </div>
        </Field>
        <Field label={t('common.note')}>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder={t('sales.notePh')} maxLength={120} />
        </Field>
        <div className="line-editor-total">
          <span>{t('sales.lineTotal')}</span>
          <span className="amt num">{formatMoney(total, c)}</span>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- sale discount ---------------- */
export function DiscountDialog({ cart, subtotal, settings, onSave, onClose }: { cart: Cart; subtotal: number; settings: Settings; onSave: (amount: number, pct?: number) => void; onClose: () => void }) {
  const t = useT()
  const c = settings.currency
  const [mode, setMode] = useState<'amount' | 'pct'>(cart.discountPct !== undefined ? 'pct' : 'amount')
  const [value, setValue] = useState<number | ''>(cart.discountPct !== undefined ? cart.discountPct : cart.discount || '')
  const v = value === '' ? 0 : value
  const tooBig = mode === 'pct' ? v > 100 : v > subtotal
  const amount = mode === 'pct' ? round((subtotal * Math.min(100, v)) / 100, c.decimals) : round(Math.min(v, subtotal), c.decimals)
  const save = () => { if (tooBig) return; if (v <= 0) onSave(0, undefined); else onSave(amount, mode === 'pct' ? v : undefined) }
  return (
    <Modal open onClose={onClose} title={t('sales.discountTitle')} size="narrow" footer={
      <>
        {(cart.discount > 0 || cart.discountPct !== undefined) && <Button variant="soft-danger" onClick={() => onSave(0, undefined)}>{t('sales.removeDiscount')}</Button>}
        <Button variant="primary" onClick={save} disabled={tooBig}>{t('common.save')}</Button>
      </>
    }>
      <div className="col" style={{ gap: 12 }} onKeyDown={enterSaves(save)}>
        <Seg block value={mode} onChange={m => { setMode(m); setValue('') }} options={[{ value: 'amount', label: t('sales.discountAmount') }, { value: 'pct', label: t('sales.discountPct') }]} />
        <NumberInput value={value} onChange={setValue} decimals={mode === 'pct' ? 1 : c.decimals} autoFocus invalid={tooBig} placeholder="0" style={{ fontSize: 22, minHeight: 56, textAlign: 'center', fontWeight: 700 }} />
        {mode === 'pct' && (
          <div className="row wrap">{[5, 10, 15, 20, 25, 50].map(n => <Button key={n} size="sm" variant={value === n ? 'soft' : 'default'} onClick={() => setValue(n)}>{n}%</Button>)}</div>
        )}
        <div className="row between small muted">
          <span>{t('common.discount')}: <Money value={amount} /></span>
          <span>{t('common.total')}: <Money value={round(subtotal - amount, c.decimals)} /></span>
        </div>
        {tooBig && <div className="small" style={{ color: 'var(--danger)' }}>{t('sales.discountTooBig')}</div>}
      </div>
    </Modal>
  )
}

/* ---------------- note ---------------- */
export function NoteDialog({ note, onSave, onClose }: { note: string; onSave: (note: string) => void; onClose: () => void }) {
  const t = useT()
  const [v, setV] = useState(note)
  return (
    <Modal open onClose={onClose} title={t('sales.noteTitle')} size="narrow" footer={<Button variant="primary" onClick={() => onSave(v.trim())}>{t('common.save')}</Button>}>
      <Textarea value={v} onChange={e => setV(e.target.value)} placeholder={t('sales.notePh')} autoFocus maxLength={300} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSave(v.trim()) }} />
    </Modal>
  )
}

/* ---------------- quantity pad ---------------- */
export function QtyDialog({ title, subtitle, initial, decimals, unit, confirmLabel, allowZero, onDone, onClose }: {
  title: string; subtitle?: string; initial?: number; decimals: number; unit?: string; confirmLabel?: (n: number) => string; allowZero?: boolean
  onDone: (n: number) => void; onClose: () => void
}) {
  const t = useT()
  const [v, setV] = useState(initial !== undefined && initial > 0 ? formatQty(initial) : '')
  const n = parseNumber(v)
  const ok = Number.isFinite(n) && (n > 0 || (allowZero && v !== ''))
  const done = () => { if (ok) onDone(round(n, decimals)) }
  useNumKeys({ enabled: true, value: v, onChange: setV, decimals, onEnter: done })
  return (
    <Modal open onClose={onClose} title={title} size="narrow">
      <div className="col" style={{ gap: 12 }}>
        {subtitle && <div className="muted small truncate">{subtitle}</div>}
        <div className="qty-display">{v || <span className="faint">{initial !== undefined ? formatQty(initial) : '0'}</span>}{unit && <span className="unit">{unit}</span>}</div>
        <NumPad value={v} onChange={setV} decimals={decimals} onEnter={ok ? done : undefined} enterLabel={confirmLabel ? confirmLabel(n) : t('common.ok')} />
        {!ok && <Button variant="primary" block disabled>{confirmLabel ? confirmLabel(0) : t('common.ok')}</Button>}
      </div>
    </Modal>
  )
}

/* ---------------- custom item ---------------- */
export function CustomItemDialog({ settings, onAdd, onClose }: { settings: Settings; onAdd: (line: CartLine) => void; onClose: () => void }) {
  const t = useT()
  const d = settings.currency.decimals
  const [name, setName] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [qty, setQty] = useState<number | ''>(1)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const add = () => {
    if (!name.trim()) { setErr(t('sales.customNameRequired')); return }
    if (forbiddenProduct({ name })) { toast(t('policy.tobaccoTitle'), 'error'); return }
    if (price === '' || price < 0) { setErr(t('sales.quickAddPriceRequired')); return }
    const q = qty === '' || qty <= 0 ? 1 : qty
    onAdd({
      key: lineKey(), name: name.trim(), unit: 'piece', price: round(price, d), originalPrice: round(price, d), qty: round(q, 3), cost: 0, discount: 0,
      taxRate: settings.tax.rate, allowFraction: true, trackStock: false, stock: 0, note: note.trim() || undefined,
    })
  }
  return (
    <Modal open onClose={onClose} title={t('sales.customTitle')} size="narrow" footer={<Button variant="primary" icon={<Plus size={16} />} onClick={add}>{t('sales.customAdd')}</Button>}>
      <div className="col" style={{ gap: 12 }} onKeyDown={enterSaves(add)}>
        {forbiddenProduct({ name }) && <PolicyBanner />}
        <Field label={t('sales.customName')} error={err && !name.trim() ? err : undefined}>
          <Input value={name} onChange={e => { setName(e.target.value); setErr(null) }} autoFocus maxLength={80} />
        </Field>
        <div className="row">
          <Field label={t('common.price')} className="grow" error={err && name.trim() && price === '' ? err : undefined}>
            <NumberInput value={price} onChange={v => { setPrice(v); setErr(null) }} decimals={d} placeholder="0" />
          </Field>
          <Field label={t('common.qty')} className="grow">
            <NumberInput value={qty} onChange={setQty} decimals={3} />
          </Field>
        </div>
        <Field label={`${t('common.note')} (${t('common.optional')})`}>
          <Input value={note} onChange={e => setNote(e.target.value)} maxLength={120} />
        </Field>
      </div>
    </Modal>
  )
}

/* ---------------- hold ---------------- */
export function HoldDialog({ onHold, onClose }: { onHold: (name: string) => void; onClose: () => void }) {
  const t = useT()
  const [name, setName] = useState('')
  return (
    <Modal open onClose={onClose} title={t('sales.holdTitle')} size="narrow" footer={<Button variant="primary" icon={<CirclePause size={16} />} onClick={() => onHold(name)}>{t('sales.hold')}</Button>}>
      <Field label={`${t('sales.holdName')} (${t('common.optional')})`}>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('sales.holdNamePh')} autoFocus maxLength={60} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onHold(name) } }} />
      </Field>
    </Modal>
  )
}

/* ---------------- held tickets ---------------- */
export function HeldTicketsDialog({ user, users, settings, onRestore, onDelete, onClose }: { user: DbUser; users: DbUser[]; settings: Settings; onRestore: (tk: HeldTicket) => void; onDelete: (tk: HeldTicket) => void; onClose: () => void }) {
  const t = useT()
  const tickets = useLiveQuery(() => db.heldTickets.orderBy('createdAt').reverse().toArray(), [])
  return (
    <Modal open onClose={onClose} title={t('sales.heldTitle')}>
      {tickets === undefined ? <div className="center" style={{ padding: 24 }}><span className="spinner" /></div>
        : tickets.length === 0 ? <Empty icon={<CirclePause size={30} />} title={t('sales.heldEmpty')} />
        : (
          <div className="list card flat">
            {tickets.map(tk => {
              const cart = tk.cart as Cart
              const lines = Array.isArray(cart?.lines) ? cart.lines : []
              const totals = computeTotals({ ...cart, lines }, settings.tax, settings.currency.decimals)
              const owner = tk.userId === user.id ? null : users.find(u => u.id === tk.userId)?.name ?? t('common.unknown')
              const canDelete = user.role === 'admin' || tk.userId === user.id
              return (
                <div key={tk.id} className="list-row held-row">
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="title truncate">{tk.name || t('sales.heldUnnamed')}{cart.customerName ? ` · ${cart.customerName}` : ''}</div>
                    <div className="sub">
                      {t('sales.items', { n: lines.length })} · <span className="num">{formatMoney(totals.total, settings.currency)}</span> · <span className="num">{formatDateTime(tk.createdAt)}</span>{owner ? ` · ${t('sales.heldBy', { name: owner })}` : ''}
                    </div>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => onRestore(tk)}>{t('sales.heldRestore')}</Button>
                  {canDelete && <Button size="sm" variant="ghost" iconOnly icon={<Trash size={16} />} aria-label={t('common.delete')} title={t('common.delete')} onClick={() => onDelete(tk)} />}
                </div>
              )
            })}
          </div>
        )}
    </Modal>
  )
}

/* ---------------- customer picker ---------------- */
export function CustomerPickerDialog({ selectedId, settings, onPick, onClose }: { selectedId?: string; settings: Settings; onPick: (c: Customer | null) => void; onClose: () => void }) {
  const t = useT()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const customers = useLiveQuery(() => db.customers.toArray(), [])
  const list = useMemo(() => {
    if (!customers) return undefined
    const nq = normalizeText(q)
    const digits = nq.replace(/\D/g, '')
    const rows = customers.filter(c => !nq || normalizeText(c.name).includes(nq) || (digits && (c.phone ?? '').replace(/\D/g, '').includes(digits)))
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'ar')).slice(0, 100)
  }, [customers, q])
  const bal = (c: Customer) => {
    const d = settings.currency
    if (c.balance > 0) return <span className="bal owes num">{t('sales.customerOwes', { amount: formatMoney(c.balance, d) })}</span>
    if (c.balance < 0) return <span className="bal has num">{t('sales.customerHas', { amount: formatMoney(-c.balance, d) })}</span>
    return <span className="bal zero">{t('sales.customerClear')}</span>
  }
  const save = async () => {
    if (!name.trim()) { setErr(t('sales.customerNameRequired')); return }
    setSaving(true)
    try {
      const now = Date.now()
      const c: Customer = { id: uid(), name: name.trim(), phone: phone.trim() || undefined, balance: 0, createdAt: now, updatedAt: now }
      await db.customers.add(c)
      toast(t('sales.customerAdded'), 'success')
      onPick(c)
    } catch { toast(t('common.error'), 'error') }
    finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title={t('sales.customerPick')} footer={adding ? (
      <>
        <Button onClick={() => setAdding(false)}>{t('common.back')}</Button>
        <Button variant="primary" loading={saving} onClick={() => void save()}>{t('common.save')}</Button>
      </>
    ) : undefined}>
      {adding ? (
        <div className="col" style={{ gap: 12 }} onKeyDown={enterSaves(() => void save())}>
          <Field label={t('common.name')} error={err ?? undefined}>
            <Input value={name} onChange={e => { setName(e.target.value); setErr(null) }} autoFocus maxLength={80} />
          </Field>
          <Field label={`${t('common.phone')} (${t('common.optional')})`}>
            <Input ltr value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={30} />
          </Field>
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          <SearchInput value={q} onChange={setQ} placeholder={t('sales.customerSearch')} autoFocus noWedge />
          <Button variant="soft" icon={<UserPlus size={18} />} onClick={() => { setAdding(true); setName(q.replace(/\d/g, '').trim()); setPhone(/^\+?[\d\s-]{5,}$/.test(q.trim()) ? q.trim() : '') }}>{t('sales.customerNew')}</Button>
          <div className="list card flat">
            {selectedId && (
              <button type="button" className="list-row" onClick={() => onPick(null)}>
                <span className="avatar round" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}><User size={18} /></span>
                <div className="grow"><div className="title">{t('sales.customerNone')}</div></div>
              </button>
            )}
            {list === undefined ? <div className="center" style={{ padding: 20 }}><span className="spinner" /></div>
              : list.length === 0 ? <Empty icon={customers?.length ? <Search size={28} /> : <User size={28} />} title={customers?.length ? t('common.noResults') : t('sales.customerEmpty')} />
              : list.map(c => (
                <button type="button" key={c.id} className="list-row cust-row" onClick={() => onPick(c)}>
                  <Avatar name={c.name} round />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="title truncate">{c.name}</div>
                    <div className="sub">{c.phone && <span className="num">{c.phone} · </span>}{bal(c)}</div>
                  </div>
                  {c.id === selectedId && <Check size={18} style={{ color: 'var(--primary)' }} />}
                </button>
              ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ---------------- quick add product ---------------- */
export function QuickAddDialog({ barcode, initialName, categories, settings, admin, userId, onSaved, onClose }: {
  barcode?: string; initialName?: string; categories: Category[]; settings: Settings; admin: boolean; userId: string
  onSaved: (p: Product) => void; onClose: () => void
}) {
  const t = useT()
  const d = settings.currency.decimals
  const [name, setName] = useState(initialName ?? '')
  const [price, setPrice] = useState<number | ''>('')
  const [cost, setCost] = useState<number | ''>('')
  const [categoryId, setCategoryId] = useState('')
  const [track, setTrack] = useState(false)
  const [stock, setStock] = useState<number | ''>('')
  const [code, setCode] = useState(barcode ?? '')
  const [err, setErr] = useState<{ name?: string; price?: string; code?: string }>({})
  const [saving, setSaving] = useState(false)
  const save = async () => {
    const e: typeof err = {}
    if (!name.trim()) e.name = t('sales.quickAddNameRequired')
    if (price === '' || price < 0) e.price = t('sales.quickAddPriceRequired')
    const bc = cleanBarcode(code)
    if (Object.keys(e).length) { setErr(e); return }
    if (forbiddenProduct({ name })) { toast(t('policy.tobaccoTitle'), 'error'); return }
    setSaving(true)
    try {
      if (bc) {
        const taken = await db.products.where('barcodes').equals(bc).first()
        if (taken) { setErr({ code: t('sales.quickAddBarcodeTaken') }); setSaving(false); return }
      }
      const now = Date.now()
      const p: Product = {
        id: uid(), name: name.trim(), barcodes: bc ? [bc] : [], categoryId: categoryId || undefined,
        price: round(price === '' ? 0 : price, d), cost: round(cost === '' ? 0 : cost, d), trackStock: track, stock: 0, lowStock: 0,
        unit: 'piece', allowFraction: false, favorite: false, active: true, createdAt: now, updatedAt: now,
      }
      const initial = track && stock !== '' && stock > 0 ? round(stock, 3) : 0
      await db.transaction('rw', [db.products, db.stockMoves], async () => {
        await db.products.add(p)
        if (initial > 0) await applyStock([{ productId: p.id, qty: initial, type: 'initial', userId }], now)
      })
      toast(t('sales.quickAddAdded'), 'success')
      onSaved({ ...p, stock: initial })
    } catch { toast(t('common.error'), 'error') }
    finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title={t('sales.quickAddTitle')} footer={
      <>
      {forbiddenProduct({ name }) && <PolicyBanner />}
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" loading={saving} icon={<Check size={16} />} onClick={() => void save()}>{t('sales.quickAddSave')}</Button>
      </>
    }>
      <div onKeyDown={enterSaves(() => void save())}>
        {barcode && <div className="quick-add-hint"><Info size={16} style={{ flex: 'none', marginTop: 2 }} /><span>{t('sales.quickAddHint')}</span></div>}
        <div className="form-grid">
          <Field label={t('common.name')} span2 error={err.name}>
            <Input value={name} onChange={e => { setName(e.target.value); setErr(x => ({ ...x, name: undefined })) }} autoFocus maxLength={100} />
          </Field>
          <Field label={t('common.price')} error={err.price}>
            <NumberInput value={price} onChange={v => { setPrice(v); setErr(x => ({ ...x, price: undefined })) }} decimals={d} placeholder="0" />
          </Field>
          {admin && (
            <Field label={`${t('common.cost')} (${t('common.optional')})`}>
              <NumberInput value={cost} onChange={setCost} decimals={d} placeholder="0" />
            </Field>
          )}
          <Field label={t('common.category')}>
            <Select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">{t('sales.noCategory')}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
            </Select>
          </Field>
          <Field label={t('common.barcode')} error={err.code}>
            <Input ltr value={code} onChange={e => { setCode(e.target.value); setErr(x => ({ ...x, code: undefined })) }} className="num" maxLength={48} />
          </Field>
          <div className="span-2">
            <SwitchRow label={t('sales.quickAddTrack')} on={track} onChange={setTrack} />
          </div>
          {track && (
            <Field label={t('sales.quickAddStock')}>
              <NumberInput value={stock} onChange={setStock} decimals={0} placeholder="0" />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  )
}

// Pieces shared by the inventory tabs (and borrowed by the shifts / expenses screens):
// AmountPad + NumPadSheet (a keypad that also takes keyboard digits), ProductPicker (search + camera +
// USB scanner, with quick product creation for unknown barcodes), badges and the sub-page head.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ScanLine, PackagePlus } from 'lucide-react'
import { db } from '../../db'
import type { Product } from '../../db/types'
import { useT, useLang, t as translate } from '../../i18n'
import { Avatar, Badge, Button, Field, Input, Modal, NumPad, NumberInput, SearchInput, Select } from '../../components/ui'
import { ScannerModal } from '../../components/Scanner'
import { useBarcodeWedge } from '../../lib/scanner-input'
import { beep } from '../../lib/audio'
import { formatQty, parseNumber } from '../../lib/money'
import { uid } from '../../lib/ids'
import { toast, useSettings } from '../../state/store'
import { matchesProduct, stockStatus } from './logic'

/** 'kg' → 'كغ'; free text stays as typed. */
export function unitLabel(unit: string): string {
  if (!unit) return ''
  const v = translate('unit.' + unit)
  return v === 'unit.' + unit ? unit : v
}

/* ---------- keypad ---------- */

/** Lets the keyboard drive a keypad value while no text field has focus. */
export function useNumPadKeys(enabled: boolean, value: string, onChange: (v: string) => void, decimals: number, onEnter?: () => void): void {
  const ref = useRef({ value, onChange, onEnter })
  ref.current = { value, onChange, onEnter }
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const { value, onChange, onEnter } = ref.current
      let k = e.key
      const ai = '٠١٢٣٤٥٦٧٨٩'.indexOf(k)
      if (ai >= 0) k = String(ai)
      if (/^[0-9]$/.test(k)) {
        e.preventDefault()
        if (value.length >= 12) return
        if (value.includes('.') && value.split('.')[1].length >= decimals) return
        onChange(value === '0' ? k : value + k)
      } else if (k === '.' || k === ',' || k === '٫') {
        e.preventDefault()
        if (decimals === 0 || value.includes('.')) return
        onChange((value || '0') + '.')
      } else if (k === 'Backspace') { e.preventDefault(); onChange(value.slice(0, -1)) }
      else if (k === 'Delete') { e.preventDefault(); onChange('') }
      else if (k === 'Enter' && onEnter) { e.preventDefault(); onEnter() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enabled, decimals])
}

export interface AmountPadProps {
  value: string
  onChange: (v: string) => void
  decimals: number
  suffix?: string
  onEnter?: () => void
  quick?: { label: string; value: string }[]
  keyboard?: boolean
}
/** The big amount display plus the keypad; `value` is the text typed ("12.5"). */
export function AmountPad({ value, onChange, decimals, suffix, onEnter, quick, keyboard = true }: AmountPadProps) {
  useNumPadKeys(keyboard, value, onChange, decimals, onEnter)
  return (
    <div className="col">
      <div className="amount-display inv-amount"><span>{value || '0'}</span>{suffix && <span className="inv-amount-suffix">{suffix}</span>}</div>
      <NumPad value={value} onChange={onChange} decimals={decimals} extra={quick?.map(q => ({ label: q.label, onClick: () => onChange(q.value) }))} />
    </div>
  )
}

export interface NumPadSheetProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  initial?: number
  decimals: number
  suffix?: string
  onConfirm: (n: number) => void
  quick?: { label: string; value: number }[]
  allowZero?: boolean
  hint?: ReactNode
  confirmLabel?: string
}
/** A modal keypad that resolves to a number. */
export function NumPadSheet({ open, onClose, title, initial = 0, decimals, suffix, onConfirm, quick, allowZero, hint, confirmLabel }: NumPadSheetProps) {
  const t = useT()
  const [v, setV] = useState('')
  useEffect(() => { if (open) setV(initial > 0 ? formatQty(initial) : '') }, [open, initial])
  const n = parseNumber(v)
  const ok = allowZero ? n >= 0 : n > 0
  const confirm = () => { if (!ok) return; onConfirm(n); onClose() }
  return (
    <Modal open={open} onClose={onClose} title={title} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={!ok} onClick={confirm}>{confirmLabel ?? t('common.confirm')}</Button>
      </>
    }>
      {hint && <div className="muted small inv-hint">{hint}</div>}
      <AmountPad value={v} onChange={setV} decimals={decimals} suffix={suffix} onEnter={confirm} quick={quick?.map(q => ({ label: q.label, value: formatQty(q.value) }))} />
    </Modal>
  )
}

/* ---------- product bits ---------- */

export function ProductAvatar({ p, size = 40 }: { p: Pick<Product, 'name' | 'color' | 'image' | 'emoji'>; size?: number }) {
  return <Avatar name={p.name} color={p.color} image={p.image} emoji={p.emoji} size={size} />
}

export function StockBadge({ p }: { p: Product }) {
  const t = useT()
  const st = stockStatus(p)
  if (st === 'untracked') return <Badge>{t('inventory.stock.untracked')}</Badge>
  return <Badge kind={st === 'out' ? 'danger' : st === 'low' ? 'warn' : 'primary'} className="num">{formatQty(p.stock)} {unitLabel(p.unit)}</Badge>
}

/** A live map of every product by id. */
export function useProductsMap(): Map<string, Product> | undefined {
  return useLiveQuery(async () => new Map((await db.products.toArray()).map(p => [p.id, p])), [])
}

/** The head of a sub page (a purchase, a supplier): back arrow, title, actions. */
export function SubHead({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back: string }) {
  const nav = useNavigate()
  const lang = useLang()
  const Icon = lang === 'ar' ? ArrowRight : ArrowLeft
  return (
    <div className="page-head inv-subhead">
      <Button variant="ghost" iconOnly icon={<Icon size={22} />} onClick={() => nav(back)} aria-label={translate('common.back')} />
      <div className="grow truncate"><h1 className="truncate">{title}</h1>{sub && <div className="small faint truncate">{sub}</div>}</div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

/* ---------- picker ---------- */

export type PickVia = 'search' | 'scan' | 'create'
export interface ProductPickerProps {
  onPick: (p: Product, via: PickVia) => void
  placeholder?: string
  autoFocus?: boolean
  /** Refuse products that do not track stock (the stock-take). */
  onlyTracked?: boolean
  /** Camera scanner keeps reading codes (purchases, stock-take). */
  continuous?: boolean
}

/** Search box + camera button + USB-scanner listener. Unknown barcodes offer a quick product creation. */
export function ProductPicker({ onPick, placeholder, autoFocus, onlyTracked, continuous = true }: ProductPickerProps) {
  const t = useT()
  const settings = useSettings()
  const [q, setQ] = useState('')
  const [scan, setScan] = useState(false)
  const [create, setCreate] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useLiveQuery(async () => {
    if (!q.trim()) return [] as Product[]
    return db.products.filter(p => p.active && matchesProduct(p, q)).limit(30).toArray()
  }, [q], [] as Product[])

  const pick = (p: Product, via: PickVia) => {
    if (onlyTracked && !p.trackStock) { beep('error'); toast(t('inventory.count.untracked', { name: p.name }), 'warn'); return }
    onPick(p, via)
    setQ('')
  }
  const handleCode = async (code: string): Promise<void> => {
    const code2 = code.trim()
    if (!code2) return
    setQ('')
    const p = await db.products.where('barcodes').equals(code2).first()
    if (p && p.active) { beep('scan'); pick(p, 'scan'); return }
    beep('error')
    setScan(false)
    setCreate(code2)
  }
  useBarcodeWedge(code => { void handleCode(code) }, { enabled: !scan && create === null })

  const onEnter = (v: string) => {
    if (results.length === 1) { pick(results[0], 'search'); return }
    const exact = results.find(p => p.barcodes.includes(v.trim()))
    if (exact) { pick(exact, 'search'); return }
    if (results.length === 0 && v.trim()) void handleCode(v)
  }

  return (
    <div className="inv-picker">
      <div className="row">
        <SearchInput className="grow" value={q} onChange={setQ} placeholder={placeholder ?? t('inventory.picker.ph')} autoFocus={autoFocus} inputRef={inputRef} onEnter={onEnter} />
        {settings.pos.cameraScanner && <Button variant="soft" iconOnly size="md" icon={<ScanLine size={20} />} onClick={() => setScan(true)} aria-label={t('common.scan')} title={t('common.scan')} />}
      </div>
      {q.trim() && (
        <div className="inv-picker-menu card">
          {results.length === 0 ? (
            <button type="button" className="list-row" onClick={() => setCreate(q.trim())}>
              <span className="inv-picker-ico"><PackagePlus size={20} /></span>
              <span className="grow"><span className="title">{t('inventory.picker.noMatch')}</span><span className="sub">{t('inventory.picker.createHint', { q: q.trim() })}</span></span>
            </button>
          ) : results.map(p => (
            <button key={p.id} type="button" className="list-row" onClick={() => pick(p, 'search')}>
              <ProductAvatar p={p} size={36} />
              <span className="grow truncate">
                <span className="title truncate">{p.name}</span>
                <span className="sub num">{p.barcodes[0] ?? p.sku ?? ''}</span>
              </span>
              <span className="end"><StockBadge p={p} /></span>
            </button>
          ))}
        </div>
      )}
      <ScannerModal open={scan} onClose={() => setScan(false)} continuous={continuous} title={t('inventory.picker.scanTitle')} onScan={code => { void handleCode(code); return !continuous }} />
      <QuickProductModal open={create !== null} barcode={create ?? ''} onClose={() => setCreate(null)} onCreated={p => { setCreate(null); pick(p, 'create') }} />
    </div>
  )
}

const UNITS = ['piece', 'kg', 'g', 'l', 'ml', 'm', 'box', 'pack', 'dozen']

/** Creates a product on the spot (unknown barcode during a purchase or a stock-take). */
export function QuickProductModal({ open, barcode, onClose, onCreated }: { open: boolean; barcode: string; onClose: () => void; onCreated: (p: Product) => void }) {
  const t = useT()
  const settings = useSettings()
  const d = settings.currency.decimals
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [cost, setCost] = useState<number>(0)
  const [unit, setUnit] = useState('piece')
  const [busy, setBusy] = useState(false)
  const isCode = /^[0-9A-Za-z\-]{3,}$/.test(barcode) && !/\s/.test(barcode)
  useEffect(() => { if (open) { setName(isCode ? '' : barcode); setCode(isCode ? barcode : ''); setPrice(0); setCost(0); setUnit('piece'); setBusy(false) } }, [open, barcode, isCode])
  const save = async () => {
    if (!name.trim()) { toast(t('inventory.quick.errName'), 'error'); return }
    setBusy(true)
    try {
      const trimmed = code.trim()
      if (trimmed) {
        const dup = await db.products.where('barcodes').equals(trimmed).first()
        if (dup) { toast(t('inventory.quick.dupBarcode', { name: dup.name }), 'error'); setBusy(false); return }
      }
      const now = Date.now()
      const p: Product = {
        id: uid(), name: name.trim(), barcodes: trimmed ? [trimmed] : [], price: Math.max(0, price), cost: Math.max(0, cost),
        trackStock: true, stock: 0, lowStock: 0, unit, allowFraction: unit === 'kg' || unit === 'g' || unit === 'l' || unit === 'ml' || unit === 'm',
        favorite: false, active: true, createdAt: now, updatedAt: now,
      }
      await db.products.add(p)
      toast(t('inventory.quick.created'), 'success')
      onCreated(p)
    } catch { toast(t('common.error'), 'error'); setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('inventory.quick.title')} size="narrow" footer={
      <>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" loading={busy} onClick={() => void save()}>{t('inventory.quick.create')}</Button>
      </>
    }>
      <p className="muted small inv-hint">{isCode ? t('inventory.quick.unknown') : t('inventory.quick.text')}</p>
      <div className="col">
        <Field label={t('inventory.quick.name')}><Input value={name} onChange={e => setName(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') void save() }} /></Field>
        <Field label={t('common.barcode')}><Input ltr value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" placeholder={t('common.optional')} /></Field>
        <div className="inv-grid-2">
          <Field label={t('inventory.quick.price')}><NumberInput value={price} onChange={setPrice} decimals={d} /></Field>
          <Field label={t('inventory.quick.cost')}><NumberInput value={cost} onChange={setCost} decimals={d} /></Field>
        </div>
        <Field label={t('inventory.quick.unit')}>
          <Select value={unit} onChange={e => setUnit(e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{t('unit.' + u)}</option>)}</Select>
        </Field>
      </div>
    </Modal>
  )
}

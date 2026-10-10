// New / edit product: the modal form with barcodes (typed, scanned or generated), pricing, stock, unit and looks.
// Pricing in the second currency: with `currency2.pricing` on, a Seg switches the price fields to that currency
// (anchors: fxPrice / fxWholesalePrice / packs[].fxPrice, cost has its own toggle → fxCost); the primary figures are
// derived at today's rate on save (lib/fx derivePrices) and follow every rate change afterwards.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, Plus, X, Wand2, Image as ImageIcon, Trash2, MoreVertical, Copy, Printer, AlertTriangle, Smile, Package } from 'lucide-react'
import { db, nextNumber } from '../../db'
import { isFxPriced, type Category, type Product, type ProductPack, type SecondCurrency } from '../../db/types'
import { useT } from '../../i18n'
import { Modal, Button, Input, Textarea, Select, Field, SwitchRow, Seg, Avatar, Spinner, useIsMobile } from '../../components/ui'
import { ScannerModal } from '../../components/Scanner'
import { toast, confirmDialog, useSettings, useUser, isAdmin } from '../../state/store'
import { uid } from '../../lib/ids'
import { parseNumber, round, formatMoney, formatNumber } from '../../lib/money'
import { derivePrices, fxToPrimary, formatRate } from '../../lib/fx'
import { toDateInput, fromDateInput } from '../../lib/format'
import { logAudit } from '../../lib/audit'
import { cleanBarcode, makeInternalEan13 } from '../../lib/barcode'
import { applyStock } from '../../lib/stock'
import { beep } from '../../lib/audio'
import { useBarcodeWedge } from '../../lib/scanner-input'
import { UNIT_KEYS, PRODUCT_COLORS, marginPct, unitLabel } from './product-utils'
import { SHOP_EMOJIS } from './emoji'
import { resizeImageFile } from './image'
import { Menu } from './Menu'
import { deleteProduct, findBarcodeConflicts } from './actions'
import { forbiddenProduct } from '../../lib/policy'
import { PolicyBanner } from '../../components/PolicyBanner'
import { LabelsDialog } from './LabelsDialog'

/** `price` is typed in the form's pricing currency (see FormState.fxMode). */
interface PackDraft { id: string; name: string; qty: string; price: string; barcode: string }
interface FormState {
  name: string; barcodes: string[]; sku: string; categoryId: string; price: string; cost: string
  trackStock: boolean; stock: string; lowStock: string; unit: string; unitOther: string; allowFraction: boolean
  taxRate: string; color: string; emoji: string; image: string; favorite: boolean; active: boolean; notes: string; expiry: string
  wholesalePrice: string; packs: PackDraft[]
  /** Price, wholesale price and pack prices are typed in the second currency (the product is anchored to the rate). */
  fxMode: boolean
  /** The cost is typed in the second currency. */
  fxCostMode: boolean
}
const num = (n: number | undefined): string => (n === undefined || n === null || !Number.isFinite(n) ? '' : String(n))
const emptyForm = (fx = false): FormState => ({
  name: '', barcodes: [], sku: '', categoryId: '', price: '', cost: '', trackStock: false, stock: '0', lowStock: '0',
  unit: 'piece', unitOther: '', allowFraction: false, taxRate: '', color: PRODUCT_COLORS[Math.floor(Math.random() * PRODUCT_COLORS.length)],
  emoji: '', image: '', favorite: false, active: true, notes: '', expiry: '', wholesalePrice: '', packs: [], fxMode: fx, fxCostMode: fx,
})
/** The form for a stored product: anchored products open in the second currency, the rest in the primary. */
function fromProduct(p: Product, c2: Pick<SecondCurrency, 'rate' | 'decimals'>): FormState {
  const known = (UNIT_KEYS as readonly string[]).includes(p.unit)
  const fxMode = isFxPriced(p)
  const fxCostMode = typeof p.fxCost === 'number'
  const toFx = (n: number): number => (c2.rate > 0 ? round(n / c2.rate, c2.decimals) : n)
  return {
    name: p.name, barcodes: p.barcodes.slice(), sku: p.sku ?? '', categoryId: p.categoryId ?? '',
    price: fxMode ? num(p.fxPrice) : num(p.price), cost: fxCostMode ? num(p.fxCost) : num(p.cost),
    trackStock: p.trackStock, stock: num(p.stock), lowStock: num(p.lowStock), unit: known ? p.unit : 'other', unitOther: known ? '' : p.unit,
    allowFraction: p.allowFraction, taxRate: num(p.taxRate), color: p.color ?? PRODUCT_COLORS[0], emoji: p.emoji ?? '', image: p.image ?? '',
    favorite: p.favorite, active: p.active, notes: p.notes ?? '', expiry: p.expiry ? toDateInput(p.expiry) : '',
    wholesalePrice: fxMode ? (p.fxWholesalePrice ? num(p.fxWholesalePrice) : p.wholesalePrice ? num(toFx(p.wholesalePrice)) : '') : p.wholesalePrice ? num(p.wholesalePrice) : '',
    packs: (p.packs ?? []).map(k => ({ id: k.id, name: k.name, qty: num(k.qty), price: fxMode ? num(typeof k.fxPrice === 'number' ? k.fxPrice : toFx(k.price)) : num(k.price), barcode: k.barcode ?? '' })),
    fxMode, fxCostMode,
  }
}
/** Drops undefined keys so a cleared anchor does not linger as `fxPrice: undefined` in the row. */
function strip<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

export interface ProductFormProps {
  open: boolean
  /** Edit this product. */
  productId?: string
  /** Start a new product from a copy of this one. */
  duplicateFrom?: string
  /** A barcode to start a new product with (e.g. an unknown scan on the sales screen). */
  presetBarcode?: string
  onClose: () => void
  onDuplicate?: (id: string) => void
}

export function ProductForm({ open, productId, duplicateFrom, presetBarcode, onClose, onDuplicate }: ProductFormProps) {
  const t = useT()
  const settings = useSettings()
  const user = useUser()
  const admin = isAdmin(user)
  const mobile = useIsMobile()
  const d = settings.currency.decimals
  const c2 = settings.currency2
  const fd = c2.decimals
  const rateOk = c2.enabled && c2.rate > 0
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) ?? []

  const [form, setForm] = useState<FormState>(emptyForm)
  const [original, setOriginal] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; price?: string; stock?: string }>({})
  const [dups, setDups] = useState<Record<string, string>>({})      // barcode -> other product's name
  const [barcodeText, setBarcodeText] = useState('')
  const [scan, setScan] = useState(false)
  const [emojis, setEmojis] = useState(false)
  const [newCat, setNewCat] = useState<string | null>(null)
  const [labels, setLabels] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  // new products start in the currency the settings ask for (only while a rate exists)
  const fxDefault = c2.enabled && c2.pricing && c2.newProductsIn === 'secondary' && c2.rate > 0
  // load
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setErrors({}); setDups({}); setBarcodeText(''); setEmojis(false); setNewCat(null); setScan(false); setLabels(false)
    const load = async () => {
      if (productId) {
        setLoading(true)
        const p = await db.products.get(productId)
        if (cancelled) return
        setLoading(false)
        if (!p) { toast(t('products.notFound'), 'error'); onClose(); return }
        setOriginal(p); setForm(fromProduct(p, c2))
      } else if (duplicateFrom) {
        setLoading(true)
        const p = await db.products.get(duplicateFrom)
        if (cancelled) return
        setLoading(false)
        setOriginal(null)
        const copy = p ? fromProduct(p, c2) : null
        setForm(copy && p ? { ...copy, name: `${p.name} (${t('products.copySuffix')})`, barcodes: [], sku: '', stock: '0', packs: copy.packs.map(k => ({ ...k, id: uid(), barcode: '' })) } : emptyForm(fxDefault))
      } else {
        setOriginal(null)
        const code = presetBarcode ? cleanBarcode(presetBarcode) : ''
        setForm({ ...emptyForm(fxDefault), barcodes: code ? [code] : [] })
      }
      setTimeout(() => nameRef.current?.focus(), 50)
    }
    void load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId, duplicateFrom, presetBarcode])

  const addBarcode = async (raw: string): Promise<boolean> => {
    const code = cleanBarcode(raw)
    if (!code) return false
    if (form.barcodes.includes(code)) { toast(t('products.barcodeAlready'), 'warn'); setBarcodeText(''); return false }
    const [conflict] = await findBarcodeConflicts([code], productId)
    setForm(f => ({ ...f, barcodes: [...f.barcodes, code] }))
    setBarcodeText('')
    if (conflict) {
      beep('error')
      setDups(x => ({ ...x, [code]: conflict.product.name }))
      toast(t('products.barcodeUsedBy', { name: conflict.product.name }), 'error')
      return false
    }
    beep('tap')
    return true
  }
  const removeBarcode = (code: string) => {
    setForm(f => ({ ...f, barcodes: f.barcodes.filter(b => b !== code) }))
    setDups(x => { const n = { ...x }; delete n[code]; return n })
  }
  const generateBarcode = async () => {
    for (let i = 0; i < 5; i++) {
      const code = makeInternalEan13(await nextNumber('barcode'))
      if (await db.products.where('barcodes').equals(code).count()) continue
      setForm(f => ({ ...f, barcodes: [...f.barcodes, code] }))
      toast(t('products.generated'), 'success')
      return
    }
    toast(t('common.error'), 'error')
  }
  const onBarcodeKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); void addBarcode(barcodeText) }
  }
  useBarcodeWedge(code => { void addBarcode(code) }, { enabled: open && !scan && !labels })

  const pickImage = async (file: File | null) => {
    if (!file) return
    try { set('image', await resizeImageFile(file, 256)) } catch { toast(t('products.imageFailed'), 'error') }
    if (fileRef.current) fileRef.current.value = ''
  }

  const createCategory = async () => {
    const name = (newCat ?? '').trim()
    if (!name) return
    const existing = categories.find(c => c.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) { set('categoryId', existing.id); setNewCat(null); return }
    if (forbiddenProduct({ name })) { toast(t('policy.tobaccoCategory'), 'error'); return }
    const c: Category = { id: uid(), name, color: PRODUCT_COLORS[categories.length % PRODUCT_COLORS.length], sort: (categories.reduce((m, x) => Math.max(m, x.sort), 0) + 1), createdAt: Date.now() }
    await db.categories.add(c)
    set('categoryId', c.id); setNewCat(null)
    toast(t('products.categoryCreated'), 'success')
  }

  const price = form.price.trim() === '' ? NaN : parseNumber(form.price)
  const cost = form.cost.trim() === '' ? 0 : parseNumber(form.cost)
  const { fxMode, fxCostMode } = form
  const cur = fxMode ? c2 : settings.currency          // the currency the price fields are typed in
  const pd = fxMode ? fd : d
  const pricePrimary = fxMode ? fxToPrimary(price, c2, d, 'price') : price
  const costPrimary = fxCostMode ? fxToPrimary(cost, c2, d, 'cost') : cost
  // the margin is computed in the anchor currency when price and cost share it, else in the primary
  const mb = fxMode && fxCostMode ? { price, cost, c: c2, dd: fd } : { price: pricePrimary, cost: costPrimary, c: settings.currency, dd: d }
  const margin = Number.isFinite(price) ? marginPct(mb.price, mb.cost) : null
  const showFxSeg = c2.enabled && (c2.pricing || fxMode)
  const showCostToggle = c2.enabled && (c2.pricing || fxCostMode)
  const toPrimaryWarn = !!original && isFxPriced(original) && !fxMode
  /** A typed amount re-expressed in the other currency (blank stays blank). */
  const conv = (s: string, wantFx: boolean, kind: 'price' | 'cost'): string => {
    if (s.trim() === '') return ''
    const n = parseNumber(s)
    return String(wantFx ? round(n / c2.rate, fd) : fxToPrimary(n, c2, d, kind))
  }
  // ل.س → $ prefills ÷ rate; $ → ل.س keeps the lira figures and clears the anchors (the cost follows the switch, then has its own toggle)
  const switchMode = (v: 'primary' | 'secondary') => {
    const wantFx = v === 'secondary'
    if (wantFx === form.fxMode || (wantFx && !rateOk)) return
    if (!wantFx && !(c2.rate > 0)) {
      // no rate to convert with: fall back to the stored lira figures (a new product keeps what was typed)
      setForm(f => ({
        ...f, fxMode: false, fxCostMode: false,
        price: original ? num(original.price) : f.price, wholesalePrice: original?.wholesalePrice ? num(original.wholesalePrice) : original ? '' : f.wholesalePrice,
        cost: original ? num(original.cost) : f.cost,
        packs: f.packs.map(k => { const o = original?.packs?.find(x => x.id === k.id); return o ? { ...k, price: num(o.price) } : k }),
      }))
      return
    }
    setForm(f => ({
      ...f, fxMode: wantFx, fxCostMode: wantFx,
      price: conv(f.price, wantFx, 'price'), wholesalePrice: conv(f.wholesalePrice, wantFx, 'price'),
      cost: f.fxCostMode === wantFx ? f.cost : conv(f.cost, wantFx, 'cost'),
      packs: f.packs.map(k => ({ ...k, price: conv(k.price, wantFx, 'price') })),
    }))
  }
  const toggleCostMode = () => {
    const wantFx = !form.fxCostMode
    if (wantFx && !rateOk) { toast(t('products.fxNoRate'), 'warn'); return }
    setForm(f => ({ ...f, fxCostMode: wantFx, cost: conv(f.cost, wantFx, 'cost') }))
  }
  const stockChanged = !!original && form.trackStock && round(parseNumber(form.stock), 3) !== round(original.stock, 3)
  const forbidden = forbiddenProduct({ name: form.name, notes: form.notes, sku: form.sku }) !== null

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    if (saving || loading) return
    const name = form.name.trim()
    const errs: typeof errors = {}
    if (!name) errs.name = t('products.err.name')
    if (!Number.isFinite(price) || price < 0) errs.price = t('products.err.price')
    if (form.trackStock && form.stock.trim() !== '' && !Number.isFinite(parseNumber(form.stock))) errs.stock = t('products.err.stock')
    setErrors(errs)
    if (Object.keys(errs).length) { nameRef.current?.focus(); return }
    if (forbidden) { toast(t('policy.tobaccoTitle'), 'error'); nameRef.current?.focus(); return }
    if ((fxMode || fxCostMode) && !(c2.rate > 0)) { toast(t('products.fxNoRate'), 'error'); return }
    const wholesale = form.wholesalePrice.trim() === '' ? 0 : parseNumber(form.wholesalePrice)
    const packs: ProductPack[] = []
    for (const k of form.packs) {
      const name = k.name.trim(); const qty = k.qty.trim() === '' ? 0 : parseNumber(k.qty); const pprice = k.price.trim() === '' ? NaN : parseNumber(k.price)
      if (!name && !k.qty && !k.price && !k.barcode.trim()) continue   // an empty row
      if (!name || !(qty > 0) || !Number.isFinite(pprice) || pprice < 0) { toast(t('products.packErr'), 'warn'); return }
      const barcode = cleanBarcode(k.barcode)
      if (barcode && (form.barcodes.includes(barcode) || packs.some(x => x.barcode === barcode))) { toast(t('products.barcodeAlready'), 'warn'); return }
      // packs inherit the product's mode: anchored only on an anchored product (derivePrices fills the primary price)
      if (fxMode) packs.push({ id: k.id || uid(), name, qty: round(qty, 3), price: 0, fxPrice: round(pprice, fd), barcode: barcode || undefined })
      else packs.push({ id: k.id || uid(), name, qty: round(qty, 3), price: round(pprice, d), barcode: barcode || undefined })
    }
    const conflicts = await findBarcodeConflicts([...form.barcodes, ...packs.map(k => k.barcode ?? '').filter(Boolean)], productId)
    if (conflicts.length) {
      setDups(Object.fromEntries(conflicts.map(c => [c.code, c.product.name])))
      toast(t('products.barcodeUsedBy', { name: conflicts[0].product.name }), 'error')
      return
    }
    setSaving(true)
    try {
      const now = Date.now()
      const unit = form.unit === 'other' ? (form.unitOther.trim() || 'piece') : form.unit
      const taxRate = settings.tax.enabled && form.taxRate.trim() !== '' ? Math.max(0, parseNumber(form.taxRate)) : undefined
      const stock = form.trackStock ? round(parseNumber(form.stock), 3) : 0
      const lowStock = form.trackStock ? Math.max(0, round(parseNumber(form.lowStock), 3)) : 0
      // anchors are rounded to the second currency's decimals; the primary figures come from derivePrices below.
      // A non-admin edit keeps the original cost AND its anchor.
      const keepCost = !(admin || !original)
      const fxPrice = fxMode ? round(price, fd) : undefined
      const fxWholesalePrice = fxMode && wholesale > 0 ? round(wholesale, fd) : undefined
      const fxCost = keepCost ? original.fxCost : fxCostMode ? round(Math.max(0, cost), fd) : undefined
      const anchored = fxPrice !== undefined || fxWholesalePrice !== undefined || fxCost !== undefined || packs.some(k => typeof k.fxPrice === 'number')
      const base = {
        name, barcodes: form.barcodes, sku: form.sku.trim() || undefined, categoryId: form.categoryId || undefined,
        price: fxMode ? 0 : round(price, d), fxPrice,
        cost: keepCost ? original.cost : fxCostMode ? 0 : round(Math.max(0, cost), d), fxCost,
        trackStock: form.trackStock, lowStock, unit, allowFraction: form.allowFraction, taxRate,
        color: form.color || undefined, emoji: form.emoji || undefined, image: form.image || undefined,
        favorite: form.favorite, active: form.active, notes: form.notes.trim() || undefined, expiry: form.expiry ? fromDateInput(form.expiry) : undefined, updatedAt: now,
        wholesalePrice: fxMode ? (fxWholesalePrice !== undefined ? 0 : undefined) : wholesale > 0 ? round(wholesale, d) : undefined, fxWholesalePrice,
        packs: packs.length ? packs : undefined,
        repricedAt: anchored ? now : undefined,
      }
      if (anchored) Object.assign(base, derivePrices({ ...(original ?? {}), ...base } as Product, c2, d, now) ?? {})
      const fxFmt = (v: number | undefined) => (v === undefined ? '—' : formatMoney(v, c2))
      if (original) {
        const saved: Product = strip({ ...original, ...base, stock: original.stock })
        await db.transaction('rw', db.products, db.stockMoves, async () => {
          await db.products.put(saved)
          if (saved.price !== original.price || saved.fxPrice !== original.fxPrice) {
            const fxPart = saved.fxPrice !== undefined || original.fxPrice !== undefined ? ` (${fxFmt(original.fxPrice)} → ${fxFmt(saved.fxPrice)})` : ''
            void logAudit({ kind: 'product.price', detail: `${saved.name}: ${original.price} → ${saved.price}${fxPart}`, refId: saved.id, amount: saved.price })
          }
          if (form.trackStock) {
            const diff = round(stock - original.stock, 3)
            if (diff !== 0) await applyStock([{ productId: saved.id, qty: diff, type: original.trackStock ? 'adjust' : 'initial', note: t('products.adjustNote'), userId: user?.id }], now)
          }
        })
        toast(t('products.saved'), 'success')
      } else {
        const saved: Product = strip({ id: uid(), ...base, stock: 0, createdAt: now })
        await db.transaction('rw', db.products, db.stockMoves, async () => {
          await db.products.add(saved)
          if (form.trackStock && stock !== 0) await applyStock([{ productId: saved.id, qty: stock, type: 'initial', note: t('products.initialNote'), userId: user?.id }], now)
        })
        toast(t('products.created'), 'success')
      }
      onClose()
    } catch {
      toast(t('common.error'), 'error')
    } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!original) return
    const ok = await confirmDialog({ title: t('products.deleteTitle', { name: original.name }), text: t('products.deleteText'), danger: true, okLabel: t('common.delete') })
    if (!ok) return
    try {
      const r = await deleteProduct(original.id)
      if (r === 'deleted') toast(t('products.deleted'), 'success')
      else if (r === 'deactivated') toast(t('products.deactivatedKept'), 'warn')
      onClose()
    } catch { toast(t('common.error'), 'error') }
  }

  const title = original ? t('products.editTitle') : t('products.newTitle')
  const hasDups = Object.keys(dups).length > 0
  const defaultTax = settings.tax.rate
  // Escape / backdrop while the scanner or the labels dialog is on top must not close the form underneath
  const close = () => { if (scan || labels) return; onClose() }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      full
      size="wide"
      className="pr-form-modal"
      headExtra={original ? (
        <Menu
          trigger={(_o, toggle) => <Button variant="ghost" iconOnly icon={<MoreVertical size={20} />} onClick={toggle} aria-label={t('common.more')} />}
          items={[
            { key: 'dup', label: t('products.duplicate'), icon: <Copy size={16} />, onClick: () => onDuplicate?.(original.id) },
            { key: 'label', label: t('products.printLabel'), icon: <Printer size={16} />, onClick: () => setLabels(true) },
            { key: 'del', label: t('common.delete'), icon: <Trash2 size={16} />, danger: true, separator: true, onClick: () => void remove() },
          ]}
        />
      ) : undefined}
      footer={
        <>
          <Button onClick={close} disabled={saving}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => void save()} loading={saving} disabled={loading || hasDups}>{t('common.save')}</Button>
        </>
      }
    >
      {loading ? <div className="empty"><Spinner /></div> : (
        <form className="pr-form" onSubmit={save} noValidate>
          {forbidden && <PolicyBanner />}
          <section className="pr-look">
            <Avatar name={form.name || '?'} color={form.color} emoji={form.emoji || undefined} image={form.image || undefined} size={mobile ? 64 : 80} />
            <div className="col grow">
              <Field label={t('common.name')} error={errors.name}>
                <Input ref={nameRef} value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('products.namePh')} invalid={!!errors.name} maxLength={120} />
              </Field>
              <div className="pr-swatches">
                {PRODUCT_COLORS.map(c => (
                  <button key={c} type="button" className={`pr-swatch ${form.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />
                ))}
              </div>
            </div>
          </section>
          <div className="row wrap">
            <Button size="sm" variant={emojis ? 'soft' : 'default'} icon={<Smile size={16} />} onClick={() => setEmojis(v => !v)}>{form.emoji ? `${form.emoji} ${t('products.emoji')}` : t('products.emoji')}</Button>
            <Button size="sm" icon={<ImageIcon size={16} />} onClick={() => fileRef.current?.click()}>{form.image ? t('products.changeImage') : t('products.image')}</Button>
            {form.image && <Button size="sm" variant="ghost" icon={<X size={16} />} onClick={() => set('image', '')}>{t('products.removeImage')}</Button>}
            {form.emoji && !form.image && <Button size="sm" variant="ghost" icon={<X size={16} />} onClick={() => set('emoji', '')}>{t('products.removeEmoji')}</Button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => void pickImage(e.target.files?.[0] ?? null)} />
          </div>
          {emojis && (
            <div className="pr-emojis">
              {SHOP_EMOJIS.map(e => <button key={e} type="button" className={`pr-emoji ${form.emoji === e ? 'on' : ''}`} onClick={() => { set('emoji', e); setEmojis(false) }}>{e}</button>)}
            </div>
          )}

          <Field label={t('common.barcode')} hint={!form.barcodes.length ? t('products.barcodeHint') : undefined}>
            {form.barcodes.length > 0 && (
              <div className="pr-barcodes">
                {form.barcodes.map((b, i) => (
                  <div key={b} className={`pr-bc ${dups[b] ? 'dup' : ''}`}>
                    <span className="num grow">{b}</span>
                    {i === 0 && form.barcodes.length > 1 && <span className="badge">{t('products.mainBarcode')}</span>}
                    {dups[b] && <span className="badge danger"><AlertTriangle size={12} /> {t('products.usedBy', { name: dups[b] })}</span>}
                    <button type="button" className="btn ghost icon sm" onClick={() => removeBarcode(b)} aria-label={t('common.delete')}><X size={16} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="row">
              <Input ltr value={barcodeText} onChange={e => setBarcodeText(e.target.value)} onKeyDown={onBarcodeKey} placeholder={t('products.barcodePh')} inputMode="text" autoComplete="off" data-no-wedge="" className="grow" />
              <Button iconOnly icon={<Plus size={18} />} onClick={() => void addBarcode(barcodeText)} disabled={!barcodeText.trim()} aria-label={t('common.add')} title={t('common.add')} />
              <Button iconOnly variant="soft" icon={<Camera size={18} />} onClick={() => setScan(true)} aria-label={t('common.scan')} title={t('common.scan')} />
            </div>
            <div><Button size="sm" variant="ghost" icon={<Wand2 size={16} />} onClick={() => void generateBarcode()}>{t('products.generate')}</Button></div>
          </Field>

          {showFxSeg && (
            <div className="pr-pricein">
              <span className="bold small">{t('products.priceIn')}</span>
              <div className={rateOk ? '' : 'pr-seg-off'}>
                <Seg value={fxMode ? 'secondary' : 'primary'} onChange={switchMode} options={[{ value: 'primary', label: settings.currency.symbol }, { value: 'secondary', label: c2.symbol }]} />
              </div>
              <span className="small muted">{rateOk ? t('products.fxRateLine', { cur: c2.symbol, rate: formatRate(c2.rate, settings), main: settings.currency.symbol }) : t('products.fxNoRate')}</span>
            </div>
          )}
          {toPrimaryWarn && <div className="banner warn"><AlertTriangle size={16} />{t('products.fxToPrimaryWarn', { main: settings.currency.symbol })}</div>}
          <div className="form-grid">
            <Field label={t('products.sku')}>
              <Input ltr value={form.sku} onChange={e => set('sku', e.target.value)} placeholder={t('common.optional')} maxLength={60} />
            </Field>
            <Field label={t('common.category')}>
              {newCat === null ? (
                <Select value={form.categoryId} onChange={e => { if (e.target.value === '__new') setNewCat(''); else set('categoryId', e.target.value) }}>
                  <option value="">{t('products.noCategory')}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
                  <option value="__new">{t('products.newCategory')}</option>
                </Select>
              ) : (
                <div className="row">
                  <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder={t('products.categoryNamePh')} autoFocus className="grow" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void createCategory() } if (e.key === 'Escape') { e.stopPropagation(); setNewCat(null) } }} />
                  <Button variant="primary" size="sm" onClick={() => void createCategory()} disabled={!newCat.trim()}>{t('common.add')}</Button>
                  <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} onClick={() => setNewCat(null)} aria-label={t('common.cancel')} />
                </div>
              )}
            </Field>
            <Field label={`${t('common.price')} ${fxMode ? `(${c2.symbol}) ` : ''}*`} error={errors.price} hint={!errors.price && Number.isFinite(price) ? (
              fxMode ? <span className="num">{t('products.fxHint', { primary: formatMoney(pricePrimary, settings.currency) })}</span> : formatMoney(price, settings.currency)
            ) : undefined}>
              <Input ltr inputMode={pd > 0 ? 'decimal' : 'numeric'} value={form.price} onChange={e => set('price', e.target.value)} onFocus={e => e.target.select()} invalid={!!errors.price} placeholder="0" />
            </Field>
            {(admin || !original) && (
              <Field label={`${t('common.cost')}${fxCostMode ? ` (${c2.symbol})` : ''}`} hint={
                <>
                  {fxCostMode && cost > 0 && <span className="num">{t('products.fxHint', { primary: formatMoney(costPrimary, settings.currency) })} · </span>}
                  {margin !== null && cost > 0 ? (
                    <span className={margin < 0 ? 'money neg' : ''}>{t('products.margin', { pct: formatNumber(margin, 1, { trim: true }), profit: formatMoney(round(mb.price - mb.cost, mb.dd), mb.c) })}</span>
                  ) : t('products.costHint')}
                </>
              }>
                <div className="row">
                  <Input ltr inputMode={(fxCostMode ? fd : d) > 0 ? 'decimal' : 'numeric'} value={form.cost} onChange={e => set('cost', e.target.value)} onFocus={e => e.target.select()} placeholder="0" className="grow" />
                  {showCostToggle && (
                    <button type="button" className={`pr-cur-toggle ${fxCostMode ? 'on' : ''}`} onClick={toggleCostMode} aria-pressed={fxCostMode} title={`${t('products.fxCostIn')} ${fxCostMode ? c2.symbol : settings.currency.symbol}`}>
                      {fxCostMode ? c2.symbol : settings.currency.symbol}
                    </button>
                  )}
                </div>
              </Field>
            )}
            <Field label={`${t('products.wholesalePrice')}${fxMode ? ` (${c2.symbol})` : ''}`} hint={fxMode && form.wholesalePrice.trim() !== '' ? <span className="num">{t('products.fxHint', { primary: formatMoney(fxToPrimary(parseNumber(form.wholesalePrice), c2, d, 'price'), settings.currency) })}</span> : t('products.wholesalePriceHint')}>
              <Input ltr inputMode={pd > 0 ? 'decimal' : 'numeric'} value={form.wholesalePrice} onChange={e => set('wholesalePrice', e.target.value)} onFocus={e => e.target.select()} placeholder={t('common.optional')} />
            </Field>
            <Field label={t('products.unit')}>
              <div className="col" style={{ gap: 6 }}>
                <Select value={form.unit} onChange={e => set('unit', e.target.value)}>
                  {UNIT_KEYS.map(u => <option key={u} value={u}>{unitLabel(u)}</option>)}
                  <option value="other">{t('products.unitOther')}</option>
                </Select>
                {form.unit === 'other' && <Input value={form.unitOther} onChange={e => set('unitOther', e.target.value)} placeholder={t('products.unitOtherPh')} maxLength={20} />}
              </div>
            </Field>
            {settings.tax.enabled && (
              <Field label={`${t('common.tax')} %`} hint={t('products.taxHint', { rate: defaultTax })}>
                <Input ltr inputMode="decimal" value={form.taxRate} onChange={e => set('taxRate', e.target.value)} placeholder={String(defaultTax)} />
              </Field>
            )}
          </div>

          <div className="card flat pad pr-switches">
            <SwitchRow label={t('products.trackStock')} desc={t('products.trackStockDesc')} on={form.trackStock} onChange={v => set('trackStock', v)} />
            {form.trackStock && (
              <div className="form-grid">
                <Field label={t('products.stock')} error={errors.stock} hint={stockChanged ? t('products.stockAdjustHint') : undefined}>
                  <Input ltr inputMode={form.allowFraction ? 'decimal' : 'numeric'} value={form.stock} onChange={e => set('stock', e.target.value)} onFocus={e => e.target.select()} invalid={!!errors.stock} />
                </Field>
                <Field label={t('products.lowStock')} hint={t('products.lowStockHint')}>
                  <Input ltr inputMode="numeric" value={form.lowStock} onChange={e => set('lowStock', e.target.value)} onFocus={e => e.target.select()} />
                </Field>
              </div>
            )}
            <SwitchRow label={t('products.allowFraction')} desc={t('products.allowFractionDesc')} on={form.allowFraction} onChange={v => set('allowFraction', v)} />
            <SwitchRow label={t('products.favorite')} desc={t('products.favoriteDesc')} on={form.favorite} onChange={v => set('favorite', v)} />
            {original && <SwitchRow label={t('common.active')} desc={t('products.activeDesc')} on={form.active} onChange={v => set('active', v)} />}
          </div>

          <div className="card flat pad pr-packs">
            <div className="row between" style={{ gap: 8 }}>
              <div>
                <div className="bold"><Package size={15} style={{ verticalAlign: -2 }} /> {t('products.packs')}</div>
                <div className="small muted">{t('products.packsHint', { unit: form.unit === 'other' ? form.unitOther || t('products.unitOther') : unitLabel(form.unit) })}</div>
              </div>
              <Button size="sm" variant="soft" icon={<Plus size={16} />} onClick={() => set('packs', [...form.packs, { id: uid(), name: '', qty: '', price: '', barcode: '' }])}>{t('products.packAdd')}</Button>
            </div>
            {form.packs.map((k, i) => {
              const upd = (patch: Partial<PackDraft>) => set('packs', form.packs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
              const qty = k.qty.trim() === '' ? 0 : parseNumber(k.qty); const pp = k.price.trim() === '' ? NaN : parseNumber(k.price)
              const perUnit = qty > 0 && Number.isFinite(pp) ? pp / qty : null
              return (
                <div key={k.id} className="pr-pack">
                  <Input value={k.name} onChange={e => upd({ name: e.target.value })} placeholder={t('products.packNamePh')} maxLength={24} aria-label={t('products.packName')} />
                  <Input ltr inputMode="numeric" value={k.qty} onChange={e => upd({ qty: e.target.value })} placeholder={t('products.packQty')} aria-label={t('products.packQty')} />
                  <Input ltr inputMode={pd > 0 ? 'decimal' : 'numeric'} value={k.price} onChange={e => upd({ price: e.target.value })} placeholder={fxMode ? `${t('products.packPrice')} ${c2.symbol}` : t('products.packPrice')} aria-label={t('products.packPrice')} />
                  <Input ltr value={k.barcode} onChange={e => upd({ barcode: e.target.value })} placeholder={t('products.packBarcode')} aria-label={t('products.packBarcode')} inputMode="text" autoComplete="off" data-no-wedge="" />
                  <Button variant="ghost" size="sm" iconOnly icon={<X size={16} />} onClick={() => set('packs', form.packs.filter((_, j) => j !== i))} aria-label={t('common.delete')} />
                  {perUnit !== null && <div className="small muted num pr-pack-hint">{fxMode ? `${t('products.fxHint', { primary: formatMoney(fxToPrimary(pp, c2, d, 'price'), settings.currency) })} · ` : ''}{t('products.packPerUnit', { price: formatMoney(round(perUnit, pd), cur) })}{price > 0 && perUnit < price ? ` · ${t('products.packSaves', { pct: formatNumber(round((1 - perUnit / price) * 100, 1), 1, { trim: true }) })}` : ''}</div>}
                </div>
              )
            })}
          </div>

          <Field label={t('products.expiry')} hint={t('products.expiryHint')}>
            <Input type="date" ltr value={form.expiry} onChange={e => set('expiry', e.target.value)} />
          </Field>
          <Field label={t('common.notes')}>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t('common.optional')} rows={2} maxLength={500} />
          </Field>
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      )}
      <ScannerModal open={scan} onClose={() => setScan(false)} onScan={code => { void addBarcode(code) }} title={t('products.scanBarcode')} />
      {original && <LabelsDialog open={labels} onClose={() => setLabels(false)} products={[original]} />}
    </Modal>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Plus, Search, X } from 'lucide-react'
import { useCollection, useStore } from '../db/store'
import type { Customer, Product, Supplier } from '../db/types'
import { matches, money, norm } from '../lib/format'
import { stockMap } from '../lib/calc'
import { CameraScanner } from './scanner'
import { findProductByScan } from '../lib/productMatch'

/** Search box with a dropdown of products; a scanned/typed exact code adds at once on Enter. */
/** `onUnknown`: what to do with a camera-read code that matches no product (else it is put in the box). */
export function ProductSearch({ onPick, onUnknown, placeholder, autoFocus, showStock = true, allowServices = true }: { onPick: (p: Product) => void; onUnknown?: (code: string) => void; placeholder?: string; autoFocus?: boolean; showStock?: boolean; allowServices?: boolean }) {
  const products = useCollection('products')
  const movements = useCollection('movements')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [scan, setScan] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  const stock = useMemo(() => (showStock ? stockMap(products, movements) : new Map<string, number>()), [products, movements, showStock])
  const list = useMemo(() => {
    const all = Array.from(products.values()).filter(p => allowServices || p.kind === 'product')
    const r = q.trim() ? all.filter(p => matches(q, p.name, p.code, p.barcode, p.brand, p.cars, p.location, p.oemNumbers)) : all
    return r.sort((a, b) => a.name.localeCompare(b.name, 'ar')).slice(0, 30)
  }, [q, products, allowServices])
  useEffect(() => setIdx(0), [q])
  const pick = (p: Product, focus = true) => { onPick(p); setQ(''); setOpen(false); if (focus) ref.current?.focus() }
  const enter = () => {
    if (!norm(q)) return
    // a typed or pasted code: the same number in any form (EAN/UPC lengths, GS1 data, part numbers)
    const exact = findProductByScan(Array.from(products.values()).filter(p => allowServices || p.kind === 'product'), q)
    if (exact) { pick(exact.product); return }
    if (list[idx]) pick(list[idx])
  }
  return (
    <div style={{ position: 'relative' }}>
      <div className="input-wrap">
        <Search />
        <input ref={ref} className="input lg" value={q} autoFocus={autoFocus} placeholder={placeholder ?? 'ابحث بالاسم أو الكود أو الباركود أو نوع السيارة…'}
          onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); enter() } else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(list.length - 1, i + 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)) } else if (e.key === 'Escape') setOpen(false) }} />
        <button type="button" className="btn ghost icon" style={{ position: 'absolute', left: 6 }} title="مسح باركود بالكاميرا" aria-label="مسح باركود بالكاميرا" onClick={() => setScan(true)}><Camera /></button>
      </div>
      {open && q.trim() !== '' && list.length > 0 && (
        <div className="card" style={{ position: 'absolute', insetInline: 0, top: '100%', marginTop: 4, zIndex: 40, maxHeight: 320, overflowY: 'auto' }}>
          {list.map((p, i) => {
            const st = stock.get(p.id) ?? 0
            return (
              <div key={p.id} className="list-item" style={{ padding: '9px 12px', cursor: 'pointer', background: i === idx ? 'var(--surface-2)' : undefined }} onMouseDown={e => { e.preventDefault(); pick(p) }} onMouseEnter={() => setIdx(i)}>
                <div className="grow"><div className="title">{p.name}</div><div className="sub">{p.code}{p.brand ? ` — ${p.brand}` : ''}{p.cars ? ` — ${p.cars}` : ''}</div>{p.oemNumbers && <div className="sub mono" dir="ltr" style={{ textAlign: 'right' }}>{p.oemNumbers}</div>}</div>
                <div style={{ textAlign: 'left' }}><div className="bold">{money(p.price)}</div>{showStock && p.kind === 'product' && <div className={`small ${st <= 0 ? 'neg-txt' : 'muted'}`}>{st} {p.unit}</div>}</div>
              </div>
            )
          })}
        </div>
      )}
      {scan && <CameraScanner onClose={() => setScan(false)} hint="وجّه الكاميرا نحو باركود القطعة؛ تبقى الكاميرا مفتوحة لمسح عدة قطع، ثم أغلقها." onCode={d => {
        // a known part is added and the camera stays open for the next one
        const hit = findProductByScan(Array.from(products.values()).filter(p => allowServices || p.kind === 'product'), d.text)
        if (hit) { pick(hit.product, false); return true }
        if (onUnknown) onUnknown(d.text); else { setQ(d.text); setOpen(true) }
      }} />}
    </div>
  )
}

/** Picks a customer or a supplier, with a shortcut to add a new one. */
export function PartyPicker({ type, value, onChange, onAddNew }: { type: 'customer' | 'supplier'; value?: string; onChange: (id: string | undefined, name: string) => void; onAddNew?: () => void }) {
  const customers = useCollection('customers')
  const suppliers = useCollection('suppliers')
  const map = (type === 'customer' ? customers : suppliers) as Map<string, Customer | Supplier>
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const selected = value ? map.get(value) : undefined
  const list = useMemo(() => Array.from(map.values()).filter(p => matches(q, p.name, p.phone, (p as Customer).car)).sort((a, b) => a.name.localeCompare(b.name, 'ar')).slice(0, 20), [q, map])
  const walkIn = type === 'customer' ? 'زبون نقدي' : 'مورد غير مسجل'
  if (selected) {
    return (
      <div className="row" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px', background: 'var(--surface-2)' }}>
        <div className="grow" style={{ flex: 1 }}><b>{selected.name}</b>{selected.phone && <span className="muted small" dir="ltr"> {selected.phone}</span>}</div>
        <button type="button" className="btn ghost icon sm" onClick={() => onChange(undefined, walkIn)} aria-label="إزالة"><X /></button>
      </div>
    )
  }
  return (
    <div style={{ position: 'relative' }}>
      <div className="row">
        <div className="input-wrap" style={{ flex: 1 }}>
          <Search />
          <input className="input" role="combobox" aria-expanded={open} aria-autocomplete="list" value={q} placeholder={type === 'customer' ? 'اختر العميل (اتركه فارغاً لزبون نقدي)' : 'اختر المورد'} onChange={e => { setQ(e.target.value); setIdx(0); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setIdx(i => Math.min(list.length - 1, i + 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)) } else if (e.key === 'Enter') { e.preventDefault(); const p = list[idx]; if (p && open) { onChange(p.id, p.name); setQ(''); setOpen(false) } else if (q.trim() && list.length === 0 && onAddNew) onAddNew() } else if (e.key === 'Escape') setOpen(false) }} />
        </div>
        {onAddNew && <button type="button" className="btn icon" title="إضافة جديد" onClick={onAddNew}><Plus /></button>}
      </div>
      {open && (list.length > 0 || q) && (
        <div className="card" style={{ position: 'absolute', insetInline: 0, top: '100%', marginTop: 4, zIndex: 40, maxHeight: 260, overflowY: 'auto' }}>
          {list.map((p, i) => (
            <div key={p.id} className="list-item" role="option" aria-selected={i === idx} style={{ padding: '8px 12px', cursor: 'pointer', background: i === idx ? 'var(--surface-2)' : undefined }} onMouseEnter={() => setIdx(i)} onMouseDown={e => { e.preventDefault(); onChange(p.id, p.name); setQ(''); setOpen(false) }}>
              <div className="grow"><div className="title">{p.name}</div><div className="sub" dir="ltr" style={{ textAlign: 'right' }}>{p.phone}{(p as Customer).car ? ` — ${(p as Customer).car}` : ''}</div></div>
            </div>
          ))}
          {list.length === 0 && <div className="muted" style={{ padding: 12 }}>لا نتائج{onAddNew && <> — <a href="#" onMouseDown={e => { e.preventDefault(); onAddNew() }} style={{ color: 'var(--accent)' }}>إضافة «{q}»</a></>}</div>}
        </div>
      )}
    </div>
  )
}

export function useProductStock() {
  const products = useCollection('products')
  const movements = useCollection('movements')
  const version = useStore(s => s.version)
  return useMemo(() => stockMap(products, movements), [products, movements, version])
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Plus, Search, X } from 'lucide-react'
import { useCollection, useStore } from '../db/store'
import type { Customer, Product, Supplier } from '../db/types'
import { matches, money, norm } from '../lib/format'
import { stockMap } from '../lib/calc'
import { Modal } from './modal'
import { splitOem } from '../lib/vin'

/** Search box with a dropdown of products; a scanned/typed exact code adds at once on Enter. */
export function ProductSearch({ onPick, placeholder, autoFocus, showStock = true, allowServices = true }: { onPick: (p: Product) => void; placeholder?: string; autoFocus?: boolean; showStock?: boolean; allowServices?: boolean }) {
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
  const pick = (p: Product) => { onPick(p); setQ(''); setOpen(false); ref.current?.focus() }
  const enter = () => {
    const nq = norm(q)
    if (!nq) return
    const exact = Array.from(products.values()).find(p => splitOem(p.barcode).some(b => norm(b) === nq) || norm(p.code) === nq || splitOem(p.oemNumbers).some(o => norm(o) === nq))
    if (exact) { pick(exact); return }
    if (list[idx]) pick(list[idx])
  }
  return (
    <div style={{ position: 'relative' }}>
      <div className="input-wrap">
        <Search />
        <input ref={ref} className="input lg" value={q} autoFocus={autoFocus} placeholder={placeholder ?? 'ابحث بالاسم أو الكود أو الباركود أو نوع السيارة…'}
          onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); enter() } else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(list.length - 1, i + 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)) } else if (e.key === 'Escape') setOpen(false) }} />
        {'BarcodeDetector' in window && <button type="button" className="btn ghost icon" style={{ position: 'absolute', left: 6 }} title="مسح باركود بالكاميرا" onClick={() => setScan(true)}><Camera /></button>}
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
      {scan && <BarcodeScanner onClose={() => setScan(false)} onCode={code => { setScan(false); const nq = norm(code); const p = Array.from(products.values()).find(x => splitOem(x.barcode).some(b => norm(b) === nq) || norm(x.code) === nq); if (p) pick(p); else { setQ(code); setOpen(true) } }} />}
    </div>
  )
}

/** Reads a barcode with the camera (where the browser has BarcodeDetector: Android and Chrome). */
export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let stream: MediaStream | null = null
    let stop = false
    const Detector = (window as any).BarcodeDetector
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf'] })
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
      stream = s
      if (video.current) { video.current.srcObject = s; video.current.play() }
      const tick = async () => {
        if (stop) return
        try { if (video.current && video.current.readyState >= 2) { const codes = await detector.detect(video.current); if (codes.length) { onCode(codes[0].rawValue); return } } } catch { /* keep trying */ }
        setTimeout(tick, 200)
      }
      tick()
    }).catch(() => setErr('تعذّر فتح الكاميرا. تأكد من السماح للتطبيق باستخدام الكاميرا.'))
    return () => { stop = true; stream?.getTracks().forEach(t => t.stop()) }
  }, [onCode])
  return (
    <Modal title="مسح الباركود" onClose={onClose} size="narrow">
      {err ? <div className="error">{err}</div> : <video ref={video} muted playsInline style={{ width: '100%', borderRadius: 12, background: '#000' }} />}
      <p className="help mt">وجّه الكاميرا نحو الباركود</p>
    </Modal>
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

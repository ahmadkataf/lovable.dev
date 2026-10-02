import { useMemo, useState } from 'react'
import { Car, Plus, Search, X, Gauge } from 'lucide-react'
import { useCollection } from '../db/store'
import type { Vehicle } from '../db/types'
import { saveVehicle } from '../db/actions'
import { decodeVin, normalizeVin } from '../lib/vin'
import { fmtDate, matches, num } from '../lib/format'
import { Field, NumberInput } from './components'
import { Modal } from './modal'
import { useToast } from './toast'
import { CarModelPick } from './cars'

export function vehicleLabel(v: Vehicle | undefined): string {
  if (!v) return ''
  const name = [v.make, v.model, v.year].filter(Boolean).join(' ')
  return v.plate ? `${name || 'سيارة'} — ${v.plate}` : name || v.vin || 'سيارة'
}

/** Is the car due for service: by date (within 7 days or passed) or by odometer (within 500 km or passed). */
export function serviceDue(v: Vehicle, now = Date.now()): { due: boolean; why: string } {
  const byDate = v.nextServiceDate ? v.nextServiceDate - now <= 7 * 86400000 : false
  const byKm = v.nextServiceKm && v.odometer ? v.nextServiceKm - v.odometer <= 500 : false
  const why = byDate && v.nextServiceDate ? (v.nextServiceDate < now ? `تأخرت الصيانة منذ ${fmtDate(v.nextServiceDate)}` : `موعد الصيانة ${fmtDate(v.nextServiceDate)}`) : byKm ? `الصيانة عند ${num(v.nextServiceKm!)} كم (العداد ${num(v.odometer!)})` : ''
  return { due: byDate || byKm, why }
}

export function VehicleForm({ customerId, initial, onClose, onSaved }: { customerId: string; initial?: Partial<Vehicle>; onClose: () => void; onSaved?: (v: Vehicle) => void }) {
  const [f, setF] = useState<Partial<Vehicle>>({ make: '', model: '', plate: '', vin: '', odometer: 0, notes: '', ...initial })
  const [busy, setBusy] = useState(false)
  const [vinBusy, setVinBusy] = useState(false)
  const toast = useToast()
  const set = (k: keyof Vehicle, v: unknown) => setF(x => ({ ...x, [k]: v }))
  const readVin = async () => {
    setVinBusy(true)
    try {
      const r = await decodeVin(f.vin ?? '')
      if (r.error && !r.make) { toast.error(r.error); return }
      set('vin', r.vin); if (r.make) set('make', r.make); if (r.model) set('model', r.model); if (r.year) set('year', r.year)
      toast.success(r.model ? 'تمت قراءة الشاصي' : 'قُرئت الشركة والسنة؛ أكمل الموديل يدوياً')
    } finally { setVinBusy(false) }
  }
  const save = async () => {
    if (!f.make?.trim() && !f.plate?.trim() && !f.vin?.trim()) { toast.error('اكتب الشركة أو اللوحة أو الشاصي على الأقل'); return }
    setBusy(true)
    try { const v = await saveVehicle({ ...(f as Vehicle), customerId, make: f.make?.trim(), model: f.model?.trim(), plate: f.plate?.trim(), vin: f.vin ? normalizeVin(f.vin) : undefined }); toast.success('تم حفظ السيارة'); onSaved?.(v); onClose() }
    catch (e) { toast.error('تعذّر الحفظ: ' + (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal title={f.id ? 'تعديل سيارة' : 'سيارة جديدة'} onClose={onClose} icon={<Car />} footer={<><button className="btn primary" onClick={save} disabled={busy}>حفظ</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <div className="form-grid">
        <Field label="رقم الشاصي (VIN)" className="full" help="القراءة تملأ الشركة والموديل والسنة من قاعدة البيانات المحلية"><div className="row"><input className="input mono" dir="ltr" style={{ textAlign: 'right' }} value={f.vin ?? ''} onChange={e => set('vin', e.target.value.toUpperCase())} maxLength={20} /><button type="button" className="btn" disabled={vinBusy} onClick={readVin}><Search /> قراءة</button></div></Field>
        <Field label="الشركة"><input className="input" value={f.make ?? ''} onChange={e => set('make', e.target.value)} placeholder="كيا" /></Field>
        <Field label="الموديل"><input className="input" value={f.model ?? ''} onChange={e => set('model', e.target.value)} placeholder="ريو" /></Field>
        <Field label="سنة الصنع"><NumberInput value={f.year ?? 0} onChange={v => set('year', v || undefined)} /></Field>
        <Field label="رقم اللوحة"><input className="input" value={f.plate ?? ''} onChange={e => set('plate', e.target.value)} placeholder="123456 حمص" /></Field>
        <Field label="العداد الحالي (كم)"><NumberInput value={f.odometer ?? 0} onChange={v => set('odometer', v)} suffix="كم" /></Field>
        <Field label="الموديل من الدليل" className="full" help="يربط السيارة بالقطع المناسبة لها في شاشة البيع"><CarModelPick value={f.carModelId} onChange={id => set('carModelId', id)} /></Field>
        <Field label="ملاحظات" className="full"><input className="input" value={f.notes ?? ''} onChange={e => set('notes', e.target.value)} placeholder="لون، زيت مفضّل، أعطال متكررة…" /></Field>
      </div>
    </Modal>
  )
}

/** Picks one of the customer's cars (or adds one) for an invoice. */
export function VehiclePicker({ customerId, value, onChange }: { customerId?: string; value?: string; onChange: (v: Vehicle | undefined) => void }) {
  const vehicles = useCollection('vehicles')
  const [add, setAdd] = useState(false)
  const list = useMemo(() => Array.from(vehicles.values()).filter(v => v.customerId === customerId).sort((a, b) => vehicleLabel(a).localeCompare(vehicleLabel(b), 'ar')), [vehicles, customerId])
  if (!customerId) return null
  const sel = value ? vehicles.get(value) : undefined
  return (
    <div className="stack" style={{ gap: 6 }}>
      {sel ? (
        <div className="row" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px', background: 'var(--surface-2)' }}><Car size={16} /><b style={{ flex: 1 }}>{vehicleLabel(sel)}</b>{sel.odometer ? <span className="small muted"><Gauge size={12} style={{ verticalAlign: -2 }} /> {num(sel.odometer)} كم</span> : null}<button type="button" className="btn ghost icon sm" onClick={() => onChange(undefined)} aria-label="إزالة"><X /></button></div>
      ) : (
        <div className="chips">
          {list.map(v => <button key={v.id} type="button" className="chip" onClick={() => onChange(v)}><Car size={14} /> {vehicleLabel(v)}</button>)}
          <button type="button" className="chip" onClick={() => setAdd(true)}><Plus size={14} /> سيارة</button>
        </div>
      )}
      {add && <VehicleForm customerId={customerId} onClose={() => setAdd(false)} onSaved={v => onChange(v)} />}
    </div>
  )
}

/** The customer's cars with their service history, inside the customer's page. */
export function CustomerVehicles({ customerId, onOpenSale }: { customerId: string; onOpenSale: (id: string) => void }) {
  const vehicles = useCollection('vehicles')
  const sales = useCollection('sales')
  const [form, setForm] = useState<Partial<Vehicle> | null>(null)
  const [q] = useState('')
  const list = useMemo(() => Array.from(vehicles.values()).filter(v => v.customerId === customerId && matches(q, v.make, v.model, v.plate, v.vin)), [vehicles, customerId, q])
  const history = (vid: string) => Array.from(sales.values()).filter(s => s.vehicleId === vid && s.type === 'sale').sort((a, b) => b.date - a.date)
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="between"><b><Car size={16} style={{ verticalAlign: -3 }} /> سيارات العميل</b><button className="btn sm" onClick={() => setForm({})}><Plus /> سيارة</button></div>
      {list.length === 0 && <div className="small muted">لا سيارات مسجلة بعد. سجّل سيارة العميل لتتبّع صيانتها وتذكيره بموعدها.</div>}
      {list.map(v => {
        const h = history(v.id); const due = serviceDue(v)
        return (
          <div key={v.id} className="card pad" style={{ padding: 10 }}>
            <div className="between" style={{ flexWrap: 'wrap', gap: 6 }}>
              <div><b>{vehicleLabel(v)}</b>{v.vin && <div className="small muted mono">{v.vin}</div>}<div className="small muted">{v.odometer ? `العداد ${num(v.odometer)} كم` : ''}{v.nextServiceKm ? ` · الصيانة القادمة عند ${num(v.nextServiceKm)} كم` : ''}{v.nextServiceDate ? ` · ${fmtDate(v.nextServiceDate)}` : ''}</div>{due.due && <span className="badge tone-warning">{due.why}</span>}</div>
              <button className="btn sm ghost" onClick={() => setForm(v)}>تعديل</button>
            </div>
            {h.length > 0 && <div className="small mt">{h.slice(0, 5).map(s => <div key={s.id} className="between" style={{ padding: '3px 0', borderTop: '1px dotted var(--border)', cursor: 'pointer' }} onClick={() => onOpenSale(s.id)}><span>{fmtDate(s.date)}{s.odometer ? ` · ${num(s.odometer)} كم` : ''} — {s.items.map(i => i.name).join('، ')}</span></div>)}{h.length > 5 && <div className="muted">و{h.length - 5} زيارة أخرى</div>}</div>}
          </div>
        )
      })}
      {form && <VehicleForm customerId={customerId} initial={form} onClose={() => setForm(null)} />}
    </div>
  )
}

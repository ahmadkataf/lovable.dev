import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { put, useCollection } from '../db/store'
import type { CarModel, Product } from '../db/types'
import { matches, norm } from '../lib/format'
import { Field, NumberInput } from './components'
import { Modal } from './modal'
import { useToast } from './toast'

export function carLabel(m: CarModel | undefined): string {
  if (!m) return ''
  const years = m.yearFrom || m.yearTo ? ` ${m.yearFrom ?? ''}${m.yearTo && m.yearTo !== m.yearFrom ? `–${m.yearTo}` : ''}` : ''
  return `${m.make} ${m.model}${years}${m.engine ? ` (${m.engine})` : ''}`
}

/** The products that fit a car model: linked explicitly, or whose free-text "cars" mentions the make and model. */
export function productsForCar(products: Iterable<Product>, m: CarModel): Product[] {
  const out: Product[] = []
  for (const p of products) {
    if (p.carModelIds?.includes(m.id)) { out.push(p); continue }
    if (p.cars && norm(p.cars).includes(norm(m.make)) && norm(p.cars).includes(norm(m.model))) out.push(p)
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

/** Finds the car models in the guide that match a decoded VIN (same make and model words, year inside the range). */
export function matchCarModels(models: Iterable<CarModel>, make?: string, model?: string, year?: number): CarModel[] {
  const out: CarModel[] = []
  const nm = norm(make), nmod = norm(model)
  for (const m of models) {
    const okMake = !nm || norm(m.make).includes(nm) || nm.includes(norm(m.make)) || makeAliases(nm).some(a => norm(m.make).includes(a))
    const okModel = !nmod || norm(m.model).includes(nmod) || nmod.includes(norm(m.model)) || modelAliases(nmod).some(a => norm(m.model).includes(a))
    const okYear = !year || ((!m.yearFrom || year >= m.yearFrom) && (!m.yearTo || year <= m.yearTo))
    if (okMake && okModel && okYear) out.push(m)
  }
  return out
}

// English names the decoder gives → how the shop writes them in Arabic
const MAKES: Record<string, string[]> = { hyundai: ['هيونداي', 'هونداي'], kia: ['كيا'], toyota: ['تويوتا'], nissan: ['نيسان'], honda: ['هوندا'], mazda: ['مازدا'], mitsubishi: ['ميتسوبيشي'], suzuki: ['سوزوكي'], mercedes: ['مرسيدس'], 'mercedes-benz': ['مرسيدس'], bmw: ['بي ام دبليو', 'بي إم دبليو'], audi: ['اودي'], volkswagen: ['فولكس', 'فولكس واجن'], chevrolet: ['شيفروليه', 'شفروليه'], ford: ['فورد'], renault: ['رينو'], peugeot: ['بيجو'], citroen: ['ستروين'], fiat: ['فيات'], skoda: ['سكودا'], geely: ['جيلي'], chery: ['شيري'], byd: ['بي واي دي'], mg: ['ام جي'], lexus: ['لكزس'], subaru: ['سوبارو'], daewoo: ['دايو'], ssangyong: ['سانغ يونغ'], jeep: ['جيب'], dodge: ['دودج'] }
const MODELS: Record<string, string[]> = { elantra: ['النترا', 'إلنترا', 'الينترا'], accent: ['اكسنت', 'أكسنت'], sonata: ['سوناتا'], tucson: ['توسان', 'توسون'], 'santa fe': ['سنتافي', 'سانتافي'], rio: ['ريو'], cerato: ['سيراتو'], sportage: ['سبورتاج', 'سبورتج'], sorento: ['سورينتو'], picanto: ['بيكانتو'], optima: ['اوبتيما'], corolla: ['كورولا'], camry: ['كامري'], yaris: ['يارس'], hilux: ['هايلكس', 'هيلوكس'], 'land cruiser': ['لاندكروزر', 'لاند كروزر'], prado: ['برادو'], rav4: ['راف 4', 'راف4'], sunny: ['صني'], sentra: ['سنترا'], altima: ['التيما'], civic: ['سيفيك'], accord: ['اكورد'], 'e-class': ['اي كلاس'], 'c-class': ['سي كلاس'], golf: ['جولف'], passat: ['باسات'], octavia: ['اوكتافيا'], cruze: ['كروز'], aveo: ['افيو'], lanos: ['لانوس'], logan: ['لوجان'], '208': ['208'], '301': ['301'] }
function makeAliases(n: string) { return Object.entries(MAKES).filter(([k]) => n.includes(k)).flatMap(([, v]) => v.map(norm)) }
function modelAliases(n: string) { return Object.entries(MODELS).filter(([k]) => n.includes(k)).flatMap(([, v]) => v.map(norm)) }

/** Chooses several car models for a product (chips with a search box). */
export function CarModelSelect({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const models = useCollection('carModels')
  const [q, setQ] = useState('')
  const [add, setAdd] = useState(false)
  const list = useMemo(() => Array.from(models.values()).filter(m => !value.includes(m.id) && matches(q, m.make, m.model, m.engine)).sort((a, b) => carLabel(a).localeCompare(carLabel(b), 'ar')).slice(0, 12), [models, q, value])
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="chips">{value.map(id => <span key={id} className="chip active">{carLabel(models.get(id)) || 'موديل محذوف'} <button type="button" className="btn ghost sm icon" style={{ minHeight: 0, width: 18, height: 18, padding: 0, color: '#fff' }} onClick={() => onChange(value.filter(x => x !== id))}><X size={12} /></button></span>)}</div>
      <div className="row"><input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث عن موديل لإضافته…" /><button type="button" className="btn icon" title="موديل جديد" onClick={() => setAdd(true)}><Plus /></button></div>
      {q && <div className="chips">{list.map(m => <button key={m.id} type="button" className="chip" onClick={() => { onChange([...value, m.id]); setQ('') }}>+ {carLabel(m)}</button>)}{list.length === 0 && <span className="muted small">لا موديل بهذا الاسم — أضفه بزر +</span>}</div>}
      {add && <CarModelForm onClose={() => setAdd(false)} onSaved={m => onChange([...value, m.id])} />}
    </div>
  )
}

/** Chooses one car model (a customer's car). */
export function CarModelPick({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) {
  const models = useCollection('carModels')
  const [q, setQ] = useState('')
  const [add, setAdd] = useState(false)
  const sel = value ? models.get(value) : undefined
  const list = useMemo(() => Array.from(models.values()).filter(m => matches(q, m.make, m.model, m.engine)).sort((a, b) => carLabel(a).localeCompare(carLabel(b), 'ar')).slice(0, 12), [models, q])
  if (sel) return <div className="row" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px', background: 'var(--surface-2)' }}><b style={{ flex: 1 }}>{carLabel(sel)}</b><button type="button" className="btn ghost icon sm" onClick={() => onChange(undefined)}><X /></button></div>
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row"><input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="اختر الموديل من الدليل…" /><button type="button" className="btn icon" title="موديل جديد" onClick={() => setAdd(true)}><Plus /></button></div>
      {q && <div className="chips">{list.map(m => <button key={m.id} type="button" className="chip" onClick={() => { onChange(m.id); setQ('') }}>{carLabel(m)}</button>)}</div>}
      {add && <CarModelForm onClose={() => setAdd(false)} onSaved={m => onChange(m.id)} />}
    </div>
  )
}

export function CarModelForm({ initial, onClose, onSaved }: { initial?: Partial<CarModel>; onClose: () => void; onSaved?: (m: CarModel) => void }) {
  const [f, setF] = useState<Partial<CarModel>>({ make: '', model: '', engine: '', notes: '', ...initial })
  const toast = useToast()
  const set = (k: keyof CarModel, v: unknown) => setF(x => ({ ...x, [k]: v }))
  const save = async () => {
    if (!f.make?.trim() || !f.model?.trim()) { toast.error('اكتب الشركة والموديل'); return }
    const m = await put('carModels', { ...(f as CarModel), make: f.make.trim(), model: f.model.trim(), yearFrom: f.yearFrom || undefined, yearTo: f.yearTo || undefined })
    toast.success('تم حفظ الموديل'); onSaved?.(m); onClose()
  }
  return (
    <Modal title={f.id ? 'تعديل موديل' : 'موديل سيارة جديد'} onClose={onClose} size="narrow" footer={<><button className="btn primary" onClick={save}>حفظ</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <div className="form-grid">
        <Field label="الشركة" required><input className="input" value={f.make} onChange={e => set('make', e.target.value)} placeholder="كيا" autoFocus list="car-makes" /></Field>
        <Field label="الموديل" required><input className="input" value={f.model} onChange={e => set('model', e.target.value)} placeholder="ريو" /></Field>
        <Field label="من سنة"><NumberInput value={f.yearFrom ?? 0} onChange={v => set('yearFrom', v)} placeholder="2012" /></Field>
        <Field label="إلى سنة"><NumberInput value={f.yearTo ?? 0} onChange={v => set('yearTo', v)} placeholder="2017" /></Field>
        <Field label="المحرك" className="full"><input className="input" value={f.engine} onChange={e => set('engine', e.target.value)} placeholder="1.6 بنزين" /></Field>
        <Field label="ملاحظات" className="full"><input className="input" value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
      <datalist id="car-makes">{Object.values(MAKES).map(v => v[0]).map(n => <option key={n} value={n} />)}</datalist>
    </Modal>
  )
}

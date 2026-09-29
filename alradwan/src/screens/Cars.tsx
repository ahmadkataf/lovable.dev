import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Car, Search, ExternalLink, Plus, Pencil, Trash2, ShoppingCart, Wifi, WifiOff, Package } from 'lucide-react'
import { remove, useCollection, useIsAdmin } from '../db/store'
import type { CarModel } from '../db/types'
import { matches, money } from '../lib/format'
import { catalogueLinks, decodeVin, normalizeVin, type VinInfo } from '../lib/vin'
import { Empty, Field, SearchInput, Tabs } from '../ui/components'
import { useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { useProductStock } from '../ui/pickers'
import { CarModelForm, carLabel, matchCarModels, productsForCar } from '../ui/cars'

/** The car guide: read a chassis number, keep the shop's car models, and see which parts fit each one. */
export function Cars() {
  const models = useCollection('carModels')
  const products = useCollection('products')
  const stock = useProductStock()
  const isAdmin = useIsAdmin()
  const nav = useNavigate()
  const toast = useToast(); const confirm = useConfirm()
  const [tab, setTab] = useState<'vin' | 'models'>('vin')
  const [vin, setVin] = useState('')
  const [info, setInfo] = useState<VinInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [form, setForm] = useState<CarModel | 'new' | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const decode = async () => {
    const v = normalizeVin(vin)
    if (v.length < 3) { toast.error('أدخل رقم الشاصي'); return }
    setBusy(true)
    try { const r = await decodeVin(v); setInfo(r); if (r.error) toast.error(r.error) } finally { setBusy(false) }
  }
  const matched = useMemo(() => (info ? matchCarModels(models.values(), info.make, info.model, info.year) : []), [info, models])
  const list = useMemo(() => Array.from(models.values()).filter(m => matches(q, m.make, m.model, m.engine, m.notes)).sort((a, b) => carLabel(a).localeCompare(carLabel(b), 'ar')), [models, q])
  const sel = selected ? models.get(selected) : undefined
  const parts = useMemo(() => (sel ? productsForCar(products.values(), sel) : []), [sel, products])

  const PartsTable = ({ m }: { m: CarModel }) => {
    const rows = productsForCar(products.values(), m)
    if (rows.length === 0) return <Empty title="لا قطع مربوطة بهذا الموديل بعد" text="اربط القطع بالموديل من بطاقة القطعة (حقل «تناسب الموديلات»)، أو اكتب اسم الشركة والموديل في حقل «تناسب السيارات»." icon={<Package />} />
    return (
      <div className="table-wrap"><table className="table">
        <thead><tr><th>القطعة</th><th className="hide-mobile">OEM</th><th className="num">السعر</th><th className="num">المتوفر</th><th></th></tr></thead>
        <tbody>{rows.map(p => { const st = stock.get(p.id) ?? 0; return (
          <tr key={p.id}><td><div className="bold">{p.name}</div><div className="small muted">{p.code}{p.brand ? ` · ${p.brand}` : ''}{p.location ? ` · ${p.location}` : ''}</div></td><td className="hide-mobile mono small">{p.oemNumbers}</td><td className="num bold">{money(p.price)}</td><td className="num">{p.kind === 'service' ? '—' : <span className={`badge ${st <= 0 ? 'tone-danger' : st <= p.minStock ? 'tone-warning' : 'tone-success'}`}>{st} {p.unit}</span>}</td><td className="actions"><button className="btn sm" onClick={() => nav(`/pos?add=${p.id}`)}><ShoppingCart /> بيع</button></td></tr>
        ) })}</tbody>
      </table></div>
    )
  }

  return (
    <div className="stack">
      <Tabs value={tab} onChange={setTab} items={[{ id: 'vin', label: 'بحث برقم الشاصي' }, { id: 'models', label: `موديلات السيارات (${models.size})` }]} />
      {tab === 'vin' && (
        <div className="stack">
          <div className="card pad">
            <div className="card-title"><h2><Car size={18} style={{ verticalAlign: -3 }} /> رقم الشاصي (VIN)</h2>{navigator.onLine ? <span className="badge tone-success"><Wifi /> متصل</span> : <span className="badge tone-warning"><WifiOff /> بلا إنترنت: تُقرأ الشركة والسنة فقط</span>}</div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <input className="input lg" dir="ltr" style={{ flex: 1, minWidth: 240, fontFamily: 'monospace', letterSpacing: 1 }} value={vin} onChange={e => setVin(e.target.value.toUpperCase())} placeholder="KMHDH41EBEU123456" maxLength={20} onKeyDown={e => e.key === 'Enter' && decode()} autoFocus />
              <button className="btn primary lg" onClick={decode} disabled={busy}><Search /> {busy ? 'جارٍ القراءة…' : 'قراءة'}</button>
            </div>
            <p className="help mt">17 حرفاً ورقماً، تجده على لوحة أسفل الزجاج الأمامي أو على باب السائق أو في رخصة السيارة. القراءة الكاملة (الموديل والمحرك) تحتاج إنترنت.</p>
          </div>
          {info && (
            <div className="grid cols-2">
              <div className="card pad">
                <div className="card-title"><h2>بيانات السيارة</h2><span className="badge tone-muted">{info.source === 'nhtsa' ? 'مفكّك NHTSA' : 'قراءة محلية'}</span></div>
                <dl className="kv">
                  <dt>الشاصي</dt><dd className="mono">{info.vin}</dd>
                  <dt>الشركة</dt><dd>{info.make ?? <span className="muted">غير معروفة</span>}</dd>
                  <dt>الموديل</dt><dd>{info.model ?? <span className="muted">—</span>}</dd>
                  <dt>سنة الصنع</dt><dd>{info.year ?? '—'}</dd>
                  {info.engine && <><dt>المحرك</dt><dd>{info.engine}</dd></>}
                  {info.body && <><dt>الهيكل</dt><dd>{info.body}</dd></>}
                  {info.country && <><dt>بلد الصنع</dt><dd>{info.country}</dd></>}
                </dl>
                {info.error && <p className="error mt">{info.error}</p>}
                <div className="btn-row mt">
                  <button className="btn" onClick={() => setForm({ id: '', updatedAt: 0, make: info.make ?? '', model: info.model ?? '', yearFrom: info.year, yearTo: info.year, engine: info.engine } as CarModel)}><Plus /> إضافة كموديل في الدليل</button>
                  <button className="btn" onClick={() => nav(`/customers?vin=${info.vin}`)}>حفظ عند عميل</button>
                </div>
              </div>
              <div className="card pad">
                <div className="card-title"><h2><ExternalLink size={18} style={{ verticalAlign: -3 }} /> الكتالوج المصوّر</h2></div>
                <p className="muted mb">يفتح كتالوج الشركة الصانعة على هذا الشاصي: الرسومات التفصيلية لكل مجموعة (المحرك، الفرامل، الهيكل…) وأرقام القطع الأصلية. انسخ رقم القطعة وابحث به في شاشة البيع.</p>
                <div className="btn-row">{catalogueLinks(info.vin).map(l => <a key={l.name} className="btn primary" href={l.url} target="_blank" rel="noreferrer"><ExternalLink /> {l.name}</a>)}</div>
              </div>
              <div className="card pad" style={{ gridColumn: '1 / -1' }}>
                <div className="card-title"><h2>القطع المتوفرة لهذه السيارة</h2>{matched.length > 0 && <span className="muted small">{matched.map(carLabel).join('، ')}</span>}</div>
                {matched.length === 0 ? <Empty title="لا موديل مطابق في الدليل" text="أضف هذه السيارة كموديل في الدليل واربط القطع بها، فتظهر هنا في المرة القادمة." icon={<Car />} /> : matched.map(m => <div key={m.id} className="mb"><div className="bold mb">{carLabel(m)}</div><PartsTable m={m} /></div>)}
              </div>
            </div>
          )}
        </div>
      )}
      {tab === 'models' && (
        <div className="grid cols-2">
          <div className="stack">
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <div className="search"><SearchInput value={q} onChange={setQ} placeholder="بحث عن موديل…" /></div>
              <button className="btn primary" onClick={() => setForm('new')}><Plus /> موديل</button>
            </div>
            <div className="card">
              {list.length === 0 ? <Empty title="لا موديلات بعد" text="أضف السيارات التي يتعامل معها المحل، ثم اربط القطع بها من بطاقة القطعة." icon={<Car />} /> : (
                <div className="list" style={{ padding: '0 12px' }}>{list.map(m => (
                  <div key={m.id} className="list-item" style={{ cursor: 'pointer', background: selected === m.id ? 'var(--surface-2)' : undefined }} onClick={() => setSelected(m.id)}>
                    <div className="grow"><div className="title">{carLabel(m)}</div><div className="sub">{productsForCar(products.values(), m).length} قطعة{m.notes ? ` · ${m.notes}` : ''}</div></div>
                    <button className="btn sm ghost icon" onClick={e => { e.stopPropagation(); setForm(m) }}><Pencil /></button>
                    {isAdmin && <button className="btn sm ghost icon" onClick={async e => { e.stopPropagation(); if (await confirm({ title: `حذف ${carLabel(m)}؟`, text: 'تبقى القطع، ويُفك ربطها بهذا الموديل.', danger: true, okText: 'حذف' })) { await remove('carModels', m.id); if (selected === m.id) setSelected(null) } }}><Trash2 /></button>}
                  </div>
                ))}</div>
              )}
            </div>
          </div>
          <div className="card pad">
            {sel ? <><div className="card-title"><h2>{carLabel(sel)}</h2><button className="btn sm" onClick={() => nav(`/pos?car=${sel.id}`)}><ShoppingCart /> بيع لهذه السيارة</button></div>{parts.length ? <PartsTable m={sel} /> : <PartsTable m={sel} />}</> : <Empty title="اختر موديلاً" text="لترى القطع التي تناسبه" icon={<Car />} />}
          </div>
        </div>
      )}
      {form && <CarModelForm initial={form === 'new' ? undefined : form.id ? form : { ...form, id: undefined }} onClose={() => setForm(null)} onSaved={m => { setSelected(m.id); setTab('models') }} />}
      <Field label=""><p className="help">الرسومات التفصيلية للقطع ملك الشركات الصانعة ولا تُضمَّن في البرنامج؛ زر «الكتالوج المصوّر» يفتحها من مصدرها على رقم الشاصي نفسه.</p></Field>
    </div>
  )
}

import React, { useState } from 'react'
import type { RepairTicket } from '@shared/types'
import { DJI_DRONES } from '@shared/dji'
import { Link, navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { compressImage, waLink } from '../lib/format'
import { Icon } from '../components/Icons'
import { Illustration } from '../components/Illustrations'
import { Field, Empty } from '../components/ui'

export function RepairPage() {
  const { settings, toast } = useStore()
  const [f, setF] = useState({ name: '', phone: '', city: settings.shipping.zones[0]?.name || '', deviceType: settings.repair.deviceTypes[0] || 'درون', brand: 'DJI', model: '', issue: '', accessories: '' })
  const [photos, setPhotos] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const upd = (k: string, v: string) => setF(x => ({ ...x, [k]: v }))

  const addPhotos = async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files).slice(0, 4 - photos.length)) {
      try { setPhotos(p => [...p, '']); const data = await compressImage(file, 1000, .78); setPhotos(p => { const i = p.indexOf(''); const n = [...p]; n[i] = data; return n }) } catch { setPhotos(p => p.filter(Boolean)); toast('تعذّر قراءة الصورة', 'err') }
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    if (f.name.trim().length < 2) return setErr('أدخل اسمك')
    if (f.phone.replace(/\D/g, '').length < 9) return setErr('أدخل رقم هاتف صحيح')
    if (f.issue.trim().length < 5) return setErr('صف العطل بجملة واضحة')
    setBusy(true)
    try {
      const uploaded: string[] = []
      for (const ph of photos.filter(Boolean)) { try { uploaded.push(await api.uploadImage(ph)) } catch { /* skip a failed photo */ } }
      const t = await api.createTicket({ customer: { name: f.name, phone: f.phone, city: f.city, address: '' }, deviceType: f.deviceType, brand: f.brand, model: f.model, issue: f.issue, accessories: f.accessories, photos: uploaded })
      sessionStorage.setItem(`sufix_ticket_${t.id}`, JSON.stringify(t))
      navigate(`/repair/done/${t.id}`)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const isDrone = f.deviceType === 'درون' && f.brand === 'DJI'
  return (
    <div className="page container">
      <div className="page-head"><h1>طلب خدمة صيانة</h1><p>{settings.repair.intro}</p></div>
      <div className="cart-layout">
        <form className="card card-pad" onSubmit={submit}>
          <h3 style={{ marginBottom: 14 }}>الجهاز</h3>
          <div className="form-grid">
            <Field label="نوع الجهاز *">
              <div className="chip-list">{settings.repair.deviceTypes.map(d => <button type="button" key={d} className={`chip ${f.deviceType === d ? 'on' : ''}`} onClick={() => upd('deviceType', d)}>{d}</button>)}</div>
            </Field>
            <Field label="الماركة *">
              <select className="select" value={f.brand} onChange={e => upd('brand', e.target.value)}>{settings.repair.brands.map(b => <option key={b}>{b}</option>)}</select>
            </Field>
            <Field label="الطراز *" span2={!isDrone}>
              {isDrone ? (
                <select className="select" value={f.model} onChange={e => upd('model', e.target.value)}>
                  <option value="">اختر طراز DJI…</option>
                  {DJI_DRONES.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  <option value="طراز آخر">طراز آخر</option>
                </select>
              ) : <input className="input" placeholder="مثال: iPhone 13 Pro" value={f.model} onChange={e => upd('model', e.target.value)} />}
            </Field>
            {isDrone && <Field label="الملحقات المرسلة مع الجهاز"><input className="input" placeholder="ريموت، بطاريات، شاحن…" value={f.accessories} onChange={e => upd('accessories', e.target.value)} /></Field>}
            <Field label="وصف العطل *" span2><textarea className="textarea" placeholder="ماذا حدث؟ متى بدأت المشكلة؟ هل سقط الجهاز أو تعرّض للماء؟ ما الرسائل التي تظهر؟" value={f.issue} onChange={e => upd('issue', e.target.value)} /></Field>
            <div className="field span-2">
              <label>صور للعطل (اختياري، حتى 4 صور)</label>
              <label className="upload"><input type="file" accept="image/*" multiple hidden onChange={e => addPhotos(e.target.files)} /><Icon.Image style={{ width: 28, height: 28, margin: '0 auto 6px', display: 'block' }} />اضغط لاختيار الصور أو التقطها بالكاميرا</label>
              {photos.length > 0 && <div className="thumbs-row">{photos.map((p, i) => <div key={i} className="th">{p ? <img src={p} alt="" /> : <div className="skeleton" style={{ width: '100%', height: '100%' }} />}<button type="button" onClick={() => setPhotos(ps => ps.filter((_, k) => k !== i))}>✕</button></div>)}</div>}
            </div>
          </div>
          <div className="divider" />
          <h3 style={{ marginBottom: 14 }}>بيانات التواصل</h3>
          <div className="form-grid">
            <Field label="الاسم *"><input className="input" value={f.name} onChange={e => upd('name', e.target.value)} autoComplete="name" /></Field>
            <Field label="رقم الهاتف (واتساب) *"><input className="input num" dir="ltr" placeholder="09xxxxxxxx" value={f.phone} onChange={e => upd('phone', e.target.value)} inputMode="tel" /></Field>
            <Field label="المحافظة"><select className="select" value={f.city} onChange={e => upd('city', e.target.value)}>{settings.shipping.zones.map(z => <option key={z.name}>{z.name}</option>)}</select></Field>
          </div>
          {err && <p className="error-text" style={{ marginTop: 12 }}>{err}</p>}
          <button className="btn btn-primary btn-lg" style={{ marginTop: 18 }} disabled={busy}><Icon.Wrench />{busy ? 'جارٍ الإرسال…' : 'إرسال طلب الصيانة'}</button>
        </form>
        <div className="stack">
          <div className="card card-pad">
            <h3 style={{ marginBottom: 12 }}>كيف تتم الصيانة؟</h3>
            <div className="timeline">
              {[['استلام الجهاز', 'توصله للمركز أو نستلمه عبر شركة الشحن'], ['فحص مجاني', 'تقرير بالعطل والتكلفة خلال 24 ساعة'], ['موافقتك', 'لا نبدأ قبل موافقتك على السعر'], ['الإصلاح والاختبار', 'قطع أصلية واختبار كامل'], ['التسليم', 'ضمان 7 أيام على الصيانة']].map(([l, d], i) => (
                <div key={i} className="t done"><span className="dot"><Icon.Check /></span><div><div className="lbl">{l}</div><div className="tm">{d}</div></div></div>
              ))}
            </div>
          </div>
          <div className="card card-pad" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ width: 70, flex: 'none' }}><Illustration name="gimbal" /></span>
            <div className="small"><b>تفضّل الحديث مباشرة؟</b><p className="muted">راسلنا على واتساب مع صورة الجهاز.</p><a className="btn btn-wa btn-sm" style={{ marginTop: 8 }} href={waLink(settings.whatsapp, 'مرحباً، جهازي يحتاج صيانة')} target="_blank" rel="noreferrer"><Icon.WhatsApp />واتساب</a></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function buildTicketMessage(t: RepairTicket, siteName: string) {
  return [
    `طلب صيانة جديد — ${siteName}`, `رقم الطلب: #${t.number}`, '',
    `الجهاز: ${t.deviceType} ${t.brand} ${t.model}`.trim(), `العطل: ${t.issue}`, t.accessories ? `الملحقات: ${t.accessories}` : '', '',
    `الاسم: ${t.customer.name}`, `الهاتف: ${t.customer.phone}`, `المحافظة: ${t.customer.city}`, '',
    `تتبّع الحالة: ${window.location.origin}/track?number=${t.number}`,
  ].filter(l => l !== '' || true).join('\n')
}

export function RepairDonePage({ id }: { id: string }) {
  const { settings } = useStore()
  const [t] = useState<RepairTicket | null>(() => { try { return JSON.parse(sessionStorage.getItem(`sufix_ticket_${id}`) || 'null') } catch { return null } })
  if (!t) return <div className="page container"><Empty icon={<Icon.Wrench />} title="لم نجد هذا الطلب" action={<Link to="/track" className="btn btn-primary">تتبّع الطلب</Link>} /></div>
  return (
    <div className="page container">
      <div className="success-box card">
        <div className="ok-ico"><Icon.Check /></div>
        <h1 style={{ fontSize: 26 }}>تم استلام طلب الصيانة</h1>
        <p className="muted" style={{ marginTop: 6 }}>رقم الطلب</p>
        <div className="order-no">#{t.number}</div>
        <p className="muted small">سنتواصل معك على {t.customer.phone} خلال ساعات العمل.</p>
        <div className="wa-callout">
          <h3 style={{ marginBottom: 8 }}>أرسل التفاصيل للفني الآن</h3>
          <p className="muted small" style={{ marginBottom: 16 }}>اضغط الزر ليصل طلبك فوراً عبر واتساب، ويمكنك إرفاق صور أو فيديو للعطل.</p>
          <a className="btn btn-wa btn-lg btn-block" href={waLink(settings.whatsapp, buildTicketMessage(t, settings.siteName))} target="_blank" rel="noreferrer" onClick={() => api.ticketWhatsapp(t.id).catch(() => {})}><Icon.WhatsApp />إرسال عبر واتساب</a>
        </div>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <Link to={`/track?number=${t.number}&phone=${encodeURIComponent(t.customer.phone)}`} className="btn btn-ghost">تتبّع حالة الجهاز</Link>
          <Link to="/" className="btn btn-outline">الرئيسية</Link>
        </div>
      </div>
    </div>
  )
}

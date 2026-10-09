import React from 'react'
import { useStore } from '../lib/store'
import { waLink } from '../lib/format'
import { Icon } from '../components/Icons'
import { Illustration } from '../components/Illustrations'
import { Link } from '../lib/router'

export function AboutPage() {
  const { settings: s } = useStore()
  return (
    <div className="page container">
      <div className="page-head"><h1>{s.about.title}</h1></div>
      <div className="cart-layout">
        <div className="card card-pad"><p className="prose" style={{ fontSize: 17 }}>{s.about.body}</p>
          {s.hero.stats.length > 0 && <div className="hero-stats">{s.hero.stats.map((st, i) => <div key={i}><div className="v">{st.value}</div><div className="l">{st.label}</div></div>)}</div>}
        </div>
        <div className="stack">
          {s.why.map((w, i) => <div key={i} className="card card-pad why-item"><span className="n">{i + 1}</span><div><h3>{w.title}</h3><p>{w.description}</p></div></div>)}
        </div>
      </div>
    </div>
  )
}

export function ContactPage() {
  const { settings: s } = useStore()
  return (
    <div className="page container">
      <div className="page-head"><h1>تواصل معنا</h1><p>نرد على واتساب خلال دقائق في ساعات العمل.</p></div>
      <div className="grid grid-3">
        <a className="svc-card" href={waLink(s.whatsapp, `مرحباً ${s.siteName}`)} target="_blank" rel="noreferrer"><span className="ico" style={{ color: 'var(--wa)', background: 'rgb(37 211 102 / .12)' }}><Icon.WhatsApp /></span><h3>واتساب</h3><p className="num" dir="ltr">+{s.whatsapp}</p><span className="price-tag">الأسرع للرد</span></a>
        <a className="svc-card" href={`tel:${s.phone.replace(/\s/g, '')}`}><span className="ico"><Icon.Phone /></span><h3>اتصال</h3><p className="num" dir="ltr">{s.phone}</p><span className="price-tag">{s.workingHours}</span></a>
        <a className="svc-card" href={`mailto:${s.email}`}><span className="ico"><Icon.Mail /></span><h3>البريد</h3><p>{s.email}</p></a>
        <div className="svc-card"><span className="ico"><Icon.MapPin /></span><h3>العنوان</h3><p>{s.city}، {s.address}</p>{s.mapUrl && <a className="price-tag" href={s.mapUrl} target="_blank" rel="noreferrer">افتح الخريطة ←</a>}</div>
        <div className="svc-card"><span className="ico"><Icon.Clock /></span><h3>ساعات العمل</h3><p>{s.workingHours}</p></div>
        <Link className="svc-card" to="/repair"><span className="ico"><Illustration name="tool" /></span><h3>طلب صيانة</h3><p>أرسل تفاصيل جهازك وصورة العطل.</p></Link>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return <div className="page container center" style={{ padding: '80px 20px' }}><h1 style={{ fontSize: 60 }} className="num">404</h1><p className="muted">الصفحة غير موجودة</p><Link to="/" className="btn btn-primary" style={{ marginTop: 20 }}>الرئيسية</Link></div>
}

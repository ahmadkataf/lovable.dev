import React, { useMemo } from 'react'
import { DJI_DRONES, DJI_SERIES, DRONE_TYPE_LABEL, PART_TYPES } from '@shared/dji'
import { Link, navigate, useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import { Icon } from '../components/Icons'
import { Illustration } from '../components/Illustrations'
import { ProductCard } from '../components/ProductCard'

export function DjiPage() {
  const { search } = useRoute()
  const { products } = useStore()
  const series = search.get('series') || ''
  const countFor = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of products) for (const c of p.compatible) m[c] = (m[c] || 0) + 1
    return m
  }, [products])
  const drones = DJI_DRONES.filter(d => !series || d.series === series)
  const droneProducts = products.filter(p => p.category === 'drones' && (!series || p.compatible.some(m => DJI_DRONES.find(d => d.id === m)?.series === series))).slice(0, 8)

  return (
    <div className="page container">
      <div className="crumbs"><Link to="/">الرئيسية</Link><span>/</span><span>درونات DJI</span></div>
      <div className="page-head">
        <h1>كل طرازات DJI</h1>
        <p>اختر طرازك لتجد الدرون نفسه للبيع، وكل القطع المتوافقة معه: بطاريات، مراوح، موتورات، جيمبال، أذرع، ريموت، شواحن، فلاتر وغيرها.</p>
      </div>
      <div className="series-nav">
        <button className={`chip ${!series ? 'on' : ''}`} onClick={() => navigate('/dji', { scroll: false })}>الكل</button>
        {DJI_SERIES.map(s => <button key={s} className={`chip ${series === s ? 'on' : ''}`} onClick={() => navigate(`/dji?series=${encodeURIComponent(s)}`, { scroll: false })}>DJI {s}</button>)}
      </div>
      <div className="model-grid">
        {drones.map(d => (
          <Link key={d.id} to={`/shop?model=${d.id}`} className="model-card">
            <span className="ico"><Illustration name={d.type === 'fpv' ? 'drone-fpv' : d.type === 'consumer' ? 'drone' : 'drone-pro'} /></span>
            <div><b>{d.name}</b><span>{d.series} · {DRONE_TYPE_LABEL[d.type]}{d.year ? ` · ${d.year}` : ''}</span></div>
            <span className="cnt">{countFor[d.id] ? `${countFor[d.id]} قطعة` : 'اطلب'}</span>
          </Link>
        ))}
      </div>
      <section className="section" style={{ paddingBottom: 0 }}>
        <div className="section-head"><div><span className="kicker">أنواع القطع</span><h2 style={{ fontSize: 24 }}>ماذا نوفّر لكل طراز؟</h2></div></div>
        <div className="chip-list">{PART_TYPES.map(t => <Link key={t} to={`/shop?q=${encodeURIComponent(t.split(' ')[0])}`} className="chip">{t}</Link>)}</div>
        <p className="muted small" style={{ marginTop: 14 }}>لا تجد قطعتك؟ <Link to="/contact" style={{ color: 'var(--primary-text)' }}>تواصل معنا</Link> ونوفّرها لك خلال أيام، أو <Link to="/repair" style={{ color: 'var(--primary-text)' }}>اطلب صيانة</Link> ونحن نؤمّن القطعة ونركّبها.</p>
      </section>
      {droneProducts.length > 0 && (
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="section-head"><h2 style={{ fontSize: 24 }}>درونات {series ? `DJI ${series}` : 'DJI'} للبيع</h2><Link to="/shop?category=drones" className="btn btn-outline btn-sm"><Icon.Cart />كل الدرونات</Link></div>
          <div className="product-grid">{droneProducts.map(p => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}
    </div>
  )
}

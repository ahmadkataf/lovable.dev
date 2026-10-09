import React, { useEffect, useState } from 'react'
import type { Product } from '@shared/types'
import { DJI_BY_ID } from '@shared/dji'
import { Link, navigate, useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { waLink } from '../lib/format'
import { ProductImage, Illustration } from '../components/Illustrations'
import { ProductCard } from '../components/ProductCard'
import { Icon } from '../components/Icons'
import { Price, Spinner, Empty } from '../components/ui'

export function ProductPage({ id }: { id: string }) {
  const { products, categories, settings, addToCart, ready } = useStore()
  const { path } = useRoute()
  const [p, setP] = useState<Product | null>(() => products.find(x => x.id === id) || null)
  const [missing, setMissing] = useState(false)
  const [img, setImg] = useState(0)
  const [qty, setQty] = useState(1)
  const [tab, setTab] = useState<'desc' | 'specs' | 'compat'>('desc')

  useEffect(() => {
    const local = products.find(x => x.id === id)
    if (local) { setP(local); return }
    if (!ready) return
    api.product(id).then(setP).catch(() => setMissing(true))
  }, [id, products, ready])
  useEffect(() => { setImg(0); setQty(1); window.scrollTo({ top: 0 }) }, [path])

  if (missing) return <div className="page container"><Empty icon={<Icon.Package />} title="المنتج غير موجود" action={<Link to="/shop" className="btn btn-primary">العودة للمتجر</Link>} /></div>
  if (!p) return <div className="page container"><Spinner /></div>

  const cat = categories.find(c => c.id === p.category)
  const related = products.filter(x => x.id !== p.id && (x.category === p.category || x.compatible.some(m => p.compatible.includes(m)))).slice(0, 4)
  const compat = p.compatible.map(m => DJI_BY_ID[m]).filter(Boolean)
  const discount = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0

  return (
    <div className="page container">
      <div className="crumbs"><Link to="/">الرئيسية</Link><span>/</span><Link to="/shop">المتجر</Link>{cat && <><span>/</span><Link to={`/shop?category=${cat.id}`}>{cat.name}</Link></>}<span>/</span><span>{p.name}</span></div>
      <div className="product-layout">
        <div className="gallery">
          <div className="main">
            {p.images.length ? <img src={p.images[img] || p.images[0]} alt={p.name} /> : <Illustration name={p.illustration} />}
          </div>
          {p.images.length > 1 && <div className="thumbs">{p.images.map((src, i) => <button key={i} className={i === img ? 'on' : ''} onClick={() => setImg(i)}><img src={src} alt="" /></button>)}</div>}
        </div>
        <div className="pinfo">
          <div className="row wrap">
            <span className="badge badge-primary">{p.brand}</span>
            {cat && <span className="badge">{cat.name}</span>}
            {p.tags.map(t => <span key={t} className="badge badge-accent">{t}</span>)}
            {discount > 0 && <span className="badge badge-accent">وفّر {discount}%</span>}
          </div>
          <h1>{p.name}</h1>
          <p className="muted">{p.short}</p>
          <Price value={p.price} old={p.oldPrice} big />
          <div className="row wrap" style={{ marginBottom: 18 }}>
            {p.stock > 0 ? <span className="badge" style={{ color: 'var(--ok)' }}><Icon.Check width={14} height={14} /> متوفر {p.stock <= 3 ? `— بقي ${p.stock} فقط` : ''}</span> : <span className="badge" style={{ color: 'var(--err)' }}>غير متوفر حالياً</span>}
            {p.sku && <span className="badge num">SKU: {p.sku}</span>}
          </div>
          <div className="row wrap">
            <div className="qty">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="أقل"><Icon.Minus width={16} height={16} /></button>
              <span>{qty}</span>
              <button onClick={() => setQty(q => Math.min(p.stock || 1, q + 1))} aria-label="أكثر"><Icon.Plus width={16} height={16} /></button>
            </div>
            <button className="btn btn-primary btn-lg" disabled={p.stock === 0} onClick={() => addToCart(p, qty)}><Icon.Cart />أضف إلى السلة</button>
            <button className="btn btn-accent btn-lg" disabled={p.stock === 0} onClick={() => { addToCart(p, qty); navigate('/checkout') }}>اشترِ الآن</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <a className="btn btn-wa btn-sm" target="_blank" rel="noreferrer" href={waLink(settings.whatsapp, `مرحباً، أستفسر عن: ${p.name}\n${window.location.origin}/product/${p.id}`)}><Icon.WhatsApp />اسأل عن هذا المنتج</a>
          </div>
          <div className="trust">
            <div><Icon.Shield />ضمان 6 أشهر على القطع</div>
            <div><Icon.Truck />شحن لكل المحافظات</div>
            <div><Icon.Wrench />تركيب مجاني في المركز</div>
          </div>
          <div style={{ marginTop: 24 }}>
            <div className="tabs">
              <button className={tab === 'desc' ? 'on' : ''} onClick={() => setTab('desc')}>الوصف</button>
              {p.specs.length > 0 && <button className={tab === 'specs' ? 'on' : ''} onClick={() => setTab('specs')}>المواصفات</button>}
              {compat.length > 0 && <button className={tab === 'compat' ? 'on' : ''} onClick={() => setTab('compat')}>التوافق</button>}
            </div>
            {tab === 'desc' && <p className="prose">{p.description || p.short}</p>}
            {tab === 'specs' && <div className="specs">{p.specs.map((s, i) => <div key={i}><b>{s.label}</b><span className="num">{s.value}</span></div>)}</div>}
            {tab === 'compat' && <div className="chip-list">{compat.map(m => <Link key={m.id} to={`/shop?model=${m.id}`} className="chip">{m.name}</Link>)}</div>}
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="section" style={{ paddingBottom: 0 }}>
          <div className="section-head"><h2 style={{ fontSize: 24 }}>منتجات ذات صلة</h2></div>
          <div className="product-grid">{related.map(r => <ProductCard key={r.id} p={r} />)}</div>
        </section>
      )}
    </div>
  )
}

export { ProductImage }

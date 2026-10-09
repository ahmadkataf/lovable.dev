import React, { useEffect, useMemo, useState } from 'react'
import { navigate, useRoute } from '../lib/router'
import { useStore } from '../lib/store'
import { ProductCard } from '../components/ProductCard'
import { Empty } from '../components/ui'
import { Icon } from '../components/Icons'
import { DJI_BY_ID } from '@shared/dji'

const SORTS = [['new', 'الأحدث'], ['popular', 'الأكثر طلباً'], ['price-asc', 'السعر: من الأقل'], ['price-desc', 'السعر: من الأعلى']]

export function ShopPage() {
  const { search } = useRoute()
  const { categories, products, ready } = useStore()
  const category = search.get('category') || ''
  const model = search.get('model') || ''
  const brand = search.get('brand') || ''
  const sort = search.get('sort') || 'new'
  const q0 = search.get('q') || ''
  const [q, setQ] = useState(q0)
  const [showFilters, setShowFilters] = useState(false)
  useEffect(() => setQ(q0), [q0])

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(search)
    if (v) p.set(k, v); else p.delete(k)
    navigate(`/shop?${p.toString()}`, { scroll: false })
  }

  const brands = useMemo(() => [...new Set(products.map(p => p.brand))].sort(), [products])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    let out = products.filter(p =>
      (!category || p.category === category || categories.some(c => c.parent === category && c.id === p.category)) &&
      (!model || p.compatible.includes(model)) &&
      (!brand || p.brand === brand) &&
      (!s || [p.name, p.short, p.brand, p.sku, ...p.tags, ...p.compatible.map(m => DJI_BY_ID[m]?.name || m)].join(' ').toLowerCase().includes(s)))
    if (sort === 'price-asc') out = [...out].sort((a, b) => a.price - b.price)
    else if (sort === 'price-desc') out = [...out].sort((a, b) => b.price - a.price)
    else if (sort === 'popular') out = [...out].sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt - a.createdAt)
    else out = [...out].sort((a, b) => b.createdAt - a.createdAt)
    return out
  }, [products, categories, category, model, brand, q, sort])

  const cat = categories.find(c => c.id === category)
  const modelName = model ? DJI_BY_ID[model]?.name || model : ''

  const Filters = (
    <aside className="filters">
      <div className="group">
        <h4>الأقسام</h4>
        <div className="chip-list">
          <button className={`chip ${!category ? 'on' : ''}`} onClick={() => set('category', '')}>الكل</button>
          {categories.map(c => <button key={c.id} className={`chip ${category === c.id ? 'on' : ''}`} onClick={() => set('category', c.id)}>{c.name}</button>)}
        </div>
      </div>
      <div className="group">
        <h4>الماركة</h4>
        <div className="chip-list">
          <button className={`chip ${!brand ? 'on' : ''}`} onClick={() => set('brand', '')}>الكل</button>
          {brands.map(b => <button key={b} className={`chip ${brand === b ? 'on' : ''}`} onClick={() => set('brand', b)}>{b}</button>)}
        </div>
      </div>
      {model && <div className="group"><h4>الطراز</h4><div className="chip-list"><button className="chip on" onClick={() => set('model', '')}>{modelName} ✕</button></div></div>}
    </aside>
  )

  return (
    <div className="page container">
      <div className="crumbs"><a href="/">الرئيسية</a><span>/</span><span>المتجر</span>{cat && <><span>/</span><span>{cat.name}</span></>}</div>
      <div className="page-head">
        <h1>{modelName ? `قطع ${modelName}` : cat ? cat.name : 'المتجر'}</h1>
        <p>{cat?.description || 'درونات DJI بجميع طرازاتها، قطع أصلية، هواتف وإكسسوارات. الدفع عند الاستلام وشحن لكل المحافظات.'}</p>
      </div>
      <div className="toolbar">
        <div className="search-bar" style={{ display: 'block', maxWidth: 360 }}>
          <Icon.Search />
          <input className="input" placeholder="ابحث…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && set('q', q)} />
        </div>
        <select className="select input-sm" style={{ width: 'auto' }} value={sort} onChange={e => set('sort', e.target.value)}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowFilters(f => !f)} style={{ display: 'inline-flex' }}>تصفية</button>
        <span className="muted small num" style={{ marginInlineStart: 'auto' }}>{list.length} منتج</span>
      </div>
      <div className="shop-layout">
        <div style={{ display: showFilters ? 'block' : undefined }} className={showFilters ? '' : 'filters-desktop'}>{Filters}</div>
        <div>
          {!ready ? <div className="product-grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '.75' }} />)}</div>
            : list.length === 0 ? <Empty icon={<Icon.Package />} title="لا توجد منتجات مطابقة" text="جرّب كلمة بحث أخرى أو أزل التصفية." action={<button className="btn btn-ghost" onClick={() => navigate('/shop')}>عرض كل المنتجات</button>} />
            : <div className="product-grid">{list.map(p => <ProductCard key={p.id} p={p} />)}</div>}
        </div>
      </div>
      <style>{`@media (max-width: 1023px) { .filters-desktop { display: none } }`}</style>
    </div>
  )
}

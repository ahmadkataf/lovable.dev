import React from 'react'
import type { Product } from '@shared/types'
import { Link } from '../lib/router'
import { useStore } from '../lib/store'
import { ProductImage } from './Illustrations'
import { Icon } from './Icons'
import { Price } from './ui'

export function ProductCard({ p, className = '' }: { p: Product; className?: string }) {
  const { addToCart } = useStore()
  const discount = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0
  return (
    <article className={`pcard ${className}`}>
      <Link to={`/product/${p.id}`} className="media">
        <ProductImage image={p.images[0]} illustration={p.illustration} alt={p.name} />
        <div className="tags">
          {discount > 0 && <span className="badge badge-accent">خصم {discount}%</span>}
          {p.tags.slice(0, 1).map(t => <span key={t} className="badge badge-primary">{t}</span>)}
          {p.stock === 0 && <span className="badge">نفد</span>}
        </div>
      </Link>
      <div className="body">
        <span className="brand">{p.brand}</span>
        <Link to={`/product/${p.id}`}><h3>{p.name}</h3></Link>
        <p className="short">{p.short}</p>
        <div className="foot">
          <Price value={p.price} old={p.oldPrice} secondary={false} />
          {p.stock > 0 ? <button className="add-btn" onClick={() => addToCart(p)} aria-label="أضف إلى السلة"><Icon.Cart /></button> : <span className="out-of-stock">غير متوفر</span>}
        </div>
      </div>
    </article>
  )
}

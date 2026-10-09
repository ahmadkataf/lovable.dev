// The product side of the sales screen: search / scan bar, category chips and the tappable grid.
import { useRef, type RefObject } from 'react'
import { Camera, Star, PackagePlus, Package, SearchX, Sparkles, Clock } from 'lucide-react'
import { productPrice, type CustomerTier, type ProductPack, type Product, type Category, type Settings } from '../../db/types'
import { useT } from '../../i18n'
import { Button, SearchInput, Empty, Badge, colorFor, useIsMobile } from '../../components/ui'
import { formatMoney, formatQty } from '../../lib/money'

export interface ProductsPanelProps {
  products: Product[] | undefined
  hasAnyProducts: boolean
  categories: Category[]
  settings: Settings
  search: string
  onSearch: (v: string) => void
  onEnter: (v: string) => void
  category: string
  onCategory: (id: string) => void
  onPick: (p: Product) => void
  onPickQty: (p: Product) => void
  /** One of the product's packs (carton, box) was tapped. */
  onPickPack: (p: Product, pack: ProductPack) => void
  /** Prices on the cards follow the cart customer's tier. */
  tier?: CustomerTier
  onScan: () => void
  onCustom: () => void
  onQuickAdd: (name: string) => void
  onGoProducts: () => void
  searchRef: RefObject<HTMLInputElement>
  autoFocus: boolean
  inCart: Map<string, number>
  showKbd: boolean
  noShift?: boolean
  onOpenShift?: () => void
  children?: React.ReactNode
}

export function ProductsPanel(p: ProductsPanelProps) {
  const t = useT()
  const isMobile = useIsMobile()
  const { products, settings } = p
  return (
    <section className="sales-products">
      <div className="sales-toolbar">
        <SearchInput inputRef={p.searchRef} value={p.search} onChange={p.onSearch} onEnter={p.onEnter} placeholder={p.showKbd ? `${t('sales.search')}  (F1)` : t('sales.search')} autoFocus={p.autoFocus} noWedge />
        {settings.pos.cameraScanner && <Button iconOnly size="lg" icon={<Camera size={20} />} title={t('common.scan')} aria-label={t('common.scan')} onClick={p.onScan} />}
        {isMobile
          ? <Button iconOnly size="lg" icon={<Sparkles size={20} />} onClick={p.onCustom} title={t('sales.custom')} aria-label={t('sales.custom')} />
          : <Button size="lg" icon={<Sparkles size={18} />} onClick={p.onCustom} title={t('sales.custom')}>{t('sales.custom')}</Button>}
      </div>
      <div className="chips sales-chips">
        <button type="button" className={`chip ${p.category === 'all' ? 'on' : ''}`} onClick={() => p.onCategory('all')}>{t('common.all')}</button>
        <button type="button" className={`chip ${p.category === 'fav' ? 'on' : ''}`} onClick={() => p.onCategory('fav')}><Star size={14} /> {t('sales.favorites')}</button>
        {p.categories.map(c => (
          <button key={c.id} type="button" className={`chip ${p.category === c.id ? 'on' : ''}`} onClick={() => p.onCategory(c.id)}>
            {c.icon ? <span>{c.icon}</span> : <span className="dot" style={{ background: c.color }} />}
            {c.name}
          </button>
        ))}
      </div>
      {p.noShift && p.onOpenShift && (
        <div className="row" style={{ padding: '0 12px 6px' }}>
          <Badge kind="warn" className="shift-hint"><Clock size={12} /> {t('sales.noShift')} · <a href="#/shifts" onClick={e => { e.preventDefault(); p.onOpenShift?.() }}>{t('sales.openShift')}</a></Badge>
        </div>
      )}
      <div className="sales-grid-wrap">
        {products === undefined ? (
          <div className="product-grid">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton product-skel" />)}</div>
        ) : !p.hasAnyProducts ? (
          <Empty icon={<Package size={34} />} title={t('sales.noProducts')} text={t('sales.noProductsHint')} action={
            <div className="row wrap" style={{ justifyContent: 'center' }}>
              <Button variant="primary" icon={<PackagePlus size={18} />} onClick={p.onGoProducts}>{t('sales.goProducts')}</Button>
              <Button icon={<Sparkles size={18} />} onClick={p.onCustom}>{t('sales.custom')}</Button>
            </div>
          } />
        ) : products.length === 0 ? (
          <Empty icon={<SearchX size={34} />} title={t('common.noResults')} action={
            p.search.trim() ? <Button variant="soft" icon={<PackagePlus size={18} />} onClick={() => p.onQuickAdd(p.search.trim())}>{t('sales.addAsProduct', { q: p.search.trim() })}</Button> : undefined
          } />
        ) : (
          <div className="product-grid">
            {products.map(pr => <ProductCard key={pr.id} p={pr} settings={settings} inCart={p.inCart.get(pr.id) ?? 0} onPick={p.onPick} onPickQty={p.onPickQty} onPickPack={p.onPickPack} tier={p.tier} />)}
          </div>
        )}
      </div>
      {p.children}
    </section>
  )
}

const LONG_PRESS_MS = 450

function ProductCard({ p, settings, inCart, onPick, onPickQty, onPickPack, tier }: { p: Product; settings: Settings; inCart: number; onPick: (p: Product) => void; onPickQty: (p: Product) => void; onPickPack: (p: Product, pack: ProductPack) => void; tier?: CustomerTier }) {
  const t = useT()
  const timer = useRef<number | undefined>(undefined)
  const fired = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = undefined } }
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    fired.current = false
    start.current = { x: e.clientX, y: e.clientY }
    cancel()
    timer.current = window.setTimeout(() => { timer.current = undefined; fired.current = true; onPickQty(p) }, LONG_PRESS_MS)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || !timer.current) return
    if (Math.abs(e.clientX - start.current.x) > 10 || Math.abs(e.clientY - start.current.y) > 10) cancel()
  }
  const onClick = () => { if (fired.current) { fired.current = false; return } onPick(p) }
  const onContextMenu = (e: React.MouseEvent) => { e.preventDefault(); cancel(); if (!fired.current) { fired.current = true; onPickQty(p) } }

  const remaining = p.stock - inCart
  const out = p.trackStock && remaining <= 0
  const low = p.trackStock && !out && p.lowStock > 0 && remaining <= p.lowStock
  const color = p.color || colorFor(p.name)
  const showStock = p.trackStock && settings.pos.showStockOnCards
  const price = productPrice(p, tier)
  const wholesale = price !== p.price
  const packs = (p.packs ?? []).filter(k => k.qty > 0 && k.name.trim()).slice(0, 3)
  return (
    <button
      type="button"
      className={`product-card ${out ? 'out' : ''}`}
      style={{ ['--swatch' as string]: color }}
      onPointerDown={onPointerDown} onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} onPointerMove={onPointerMove}
      onClick={onClick} onContextMenu={onContextMenu}
      title={p.name}
    >
      <div className="thumb" style={{ background: p.image ? 'var(--surface-3)' : color }}>
        {p.image ? <img src={p.image} alt="" loading="lazy" draggable={false} /> : p.emoji ? <span>{p.emoji}</span> : <span className="initial">{p.name.trim().charAt(0)}</span>}
      </div>
      {p.favorite && <Star size={14} className="fav" fill="currentColor" />}
      {showStock && (
        <Badge kind={out ? 'danger' : low ? 'warn' : undefined} className="stock num">{out ? t('sales.stockOut') : formatQty(remaining)}</Badge>
      )}
      <div className="info">
        <div className="name">{p.name}</div>
        <div className="price num">{formatMoney(price, settings.currency)}{wholesale && <span className="tier-tag">{t('sales.wholesaleTag')}</span>}</div>
        {packs.length > 0 && (
          <div className="packs" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            {packs.map(k => (
              <span key={k.id} role="button" tabIndex={0} className="pack" title={`${k.name} × ${formatQty(k.qty)}`}
                onClick={e => { e.stopPropagation(); onPickPack(p, k) }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onPickPack(p, k) } }}>
                <Package size={11} /> {k.name} <span className="num">×{formatQty(k.qty)}</span> · <span className="num">{formatMoney(k.price, settings.currency, { symbol: false })}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

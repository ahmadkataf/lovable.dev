// Products: the catalogue list (search, categories, filters, sort, multi-select) with the form, categories,
// import/export and labels. Routes: /products, /products/new, /products/:id.
import { allowed } from '../../lib/audit'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Routes, Route, Outlet, useNavigate, useParams, useSearchParams, useLocation, useMatch } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Filter, ArrowUpDown, MoreHorizontal, CheckSquare, Star, Package, SearchX, Tag, Printer, Download, Upload, FileText, X, Check, FolderInput, Eye, EyeOff, Trash2, Percent, ScanBarcode, ArrowLeftRight } from 'lucide-react'
import { db } from '../../db'
import { daysToExpiry, EXPIRY_WARN_DAYS, isFxPriced, type Category, type Product } from '../../db/types'
import { useT, useLang } from '../../i18n'
import { Button, SearchInput, Avatar, Badge, Money, Empty, Spinner, useIsMobile } from '../../components/ui'
import { toast, confirmDialog, useSettings, useUser, isAdmin } from '../../state/store'
import { useBarcodeWedge } from '../../lib/scanner-input'
import { beep } from '../../lib/audio'
import { saveCsv } from '../../lib/csv'
import { formatQty, formatMoney } from '../../lib/money'
import { stockValueFx } from '../../lib/fx'
import { cleanBarcode, looksLikeBarcode } from '../../lib/barcode'
import { filterProducts, sortProducts, stockState, stockValue, productsToCsv, templateCsv, unitLabel, exactBarcodeMatch, type ProductFilter, type ProductSort, type CategoryPick } from './product-utils'
import { deleteProduct } from './actions'
import { Menu } from './Menu'
import { ProductForm } from './ProductForm'
import { CategoriesModal } from './CategoriesModal'
import { ImportModal } from './ImportModal'
import { LabelsDialog } from './LabelsDialog'
import { BulkPriceModal, BulkCategoryModal, BulkAnchorModal } from './BulkModals'
import './i18n'
import './products.css'

const VIEW_KEY = 'kaseb.products.view'
const FILTERS: ProductFilter[] = ['all', 'low', 'out', 'expiring', 'favorites', 'inactive', 'fx']
const SORTS: ProductSort[] = ['name', 'price', 'stock', 'recent']

export default function ProductsScreen() {
  return (
    <Routes>
      <Route element={<ListScreen />}>
        <Route index element={null} />
        <Route path="new" element={<FormRoute mode="new" />} />
        <Route path=":id" element={<FormRoute mode="edit" />} />
      </Route>
    </Routes>
  )
}

/** The form lives on its own route so a product link (/products/:id) opens it directly. */
function FormRoute({ mode }: { mode: 'new' | 'edit' }) {
  const t = useT()
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const loc = useLocation()
  const canEdit = allowed(useUser(), useSettings(), 'cashierEditProducts')
  const close = useCallback(() => {
    if (loc.key !== 'default') nav(-1)
    else nav('/products', { replace: true })
  }, [loc.key, nav])
  // the URL (or a scan / search that leads here) must not open the form for a cashier without the permission
  useEffect(() => { if (!canEdit) { toast(t('common.noPermission'), 'warn'); nav('/products', { replace: true }) } }, [canEdit, nav, t])
  if (!canEdit) return null
  return (
    <ProductForm
      open
      productId={mode === 'edit' ? id : undefined}
      duplicateFrom={mode === 'new' ? sp.get('from') ?? undefined : undefined}
      presetBarcode={mode === 'new' ? sp.get('barcode') ?? undefined : undefined}
      onClose={close}
      onDuplicate={from => nav(`/products/new?from=${encodeURIComponent(from)}`, { replace: true })}
    />
  )
}

function loadView(): { filter: ProductFilter; sort: ProductSort } {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as { filter?: ProductFilter; sort?: ProductSort }
    return { filter: FILTERS.includes(v.filter as ProductFilter) ? v.filter! : 'all', sort: SORTS.includes(v.sort as ProductSort) ? v.sort! : 'name' }
  } catch { return { filter: 'all', sort: 'name' } }
}

function ListScreen() {
  const t = useT()
  const lang = useLang()
  const nav = useNavigate()
  const user = useUser()
  const settings = useSettings()
  const admin = isAdmin(user)
  const canEdit = allowed(user, settings, 'cashierEditProducts')
  const seeCost = allowed(user, settings, 'cashierSeeCost')
  const mobile = useIsMobile()
  const formOpen = !!useMatch('/products/:id')
  const d = settings.currency.decimals
  const c2 = settings.currency2
  const fxOn = c2.enabled && c2.pricing

  const products = useLiveQuery(() => db.products.toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) ?? []

  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<CategoryPick>('all')
  const [view, setView] = useState(loadView)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [catsOpen, setCatsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [labelsFor, setLabelsFor] = useState<Product[] | null>(null)
  const [priceOpen, setPriceOpen] = useState(false)
  const [bulkCatOpen, setBulkCatOpen] = useState(false)
  const [anchorOpen, setAnchorOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const { filter, sort } = view
  const setFilter = (f: ProductFilter) => setView(v => persistView({ ...v, filter: f }))
  const setSort = (s: ProductSort) => setView(v => persistView({ ...v, sort: s }))

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const visible = useMemo(() => sortProducts(filterProducts(products ?? [], { search, category: cat, filter }), sort, lang), [products, search, cat, filter, sort, lang])
  const uncategorized = useMemo(() => (products ?? []).some(p => !p.categoryId && p.active), [products])
  const selectedProducts = useMemo(() => (products ?? []).filter(p => selected.has(p.id)), [products, selected])
  const anyModal = formOpen || catsOpen || importOpen || !!labelsFor || priceOpen || bulkCatOpen || anchorOpen

  // a USB scanner anywhere on the page: open that product (or offer to create it)
  useBarcodeWedge(code => {
    const p = exactBarcodeMatch(products ?? [], code)
    if (p) { beep('scan'); nav(`/products/${p.id}`) }
    else { beep('error'); setSearch(cleanBarcode(code)); toast(t('products.unknownBarcode'), 'warn') }
  }, { enabled: !anyModal })

  // F1 focuses the search on desktop
  useEffect(() => {
    if (anyModal) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select() }
      if (e.key === 'Escape' && selectMode) exitSelect()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyModal, selectMode])

  // drop selections of products that vanished
  useEffect(() => {
    if (!products || !selected.size) return
    const ids = new Set(products.map(p => p.id))
    if ([...selected].some(id => !ids.has(id))) setSelected(new Set([...selected].filter(id => ids.has(id))))
  }, [products, selected])

  const openProduct = (p: Product) => nav(`/products/${p.id}`)
  const newProduct = (barcode?: string) => nav(barcode ? `/products/new?barcode=${encodeURIComponent(barcode)}` : '/products/new')
  const openFromSearch = (v: string) => {
    const exact = exactBarcodeMatch(visible, v) ?? (visible.length === 1 ? visible[0] : undefined)
    if (exact) openProduct(exact)
    else if (looksLikeBarcode(cleanBarcode(v)) && !visible.length) newProduct(cleanBarcode(v))
  }
  const toggleFav = async (p: Product) => { await db.products.update(p.id, { favorite: !p.favorite }) }

  const enterSelect = (id?: string) => { setSelectMode(true); if (id) setSelected(s => new Set(s).add(id)) }
  const exitSelect = () => { setSelectMode(false); setSelected(new Set()) }
  const toggleSel = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allVisibleSelected = visible.length > 0 && visible.every(p => selected.has(p.id))
  const selectAllVisible = () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map(p => p.id)))

  const bulkActive = async (active: boolean) => {
    const now = Date.now()
    await db.transaction('rw', db.products, async () => { for (const p of selectedProducts) await db.products.update(p.id, { active, updatedAt: now }) })
    toast(t(active ? 'products.bulk.activated' : 'products.bulk.deactivated', { n: selectedProducts.length }), 'success')
    exitSelect()
  }
  const bulkDelete = async () => {
    const n = selectedProducts.length
    if (!n) return
    const ok = await confirmDialog({ title: t('products.bulk.deleteTitle', { n }), text: t('products.deleteText'), danger: true, okLabel: t('common.delete') })
    if (!ok) return
    let deleted = 0, deactivated = 0
    for (const p of selectedProducts) {
      try { const r = await deleteProduct(p.id); if (r === 'deleted') deleted++; else if (r === 'deactivated') deactivated++ } catch { /* keep going */ }
    }
    toast(deactivated ? t('products.bulk.deleteMixed', { d: deleted, k: deactivated }) : t('products.bulk.deleteDone', { n: deleted }), deactivated ? 'warn' : 'success')
    exitSelect()
  }
  const downloadTemplate = async () => {
    if (await saveCsv('kaseb-products-template.csv', templateCsv(c2))) toast(t('products.import.templateSaved'), 'success')
  }
  const exportCsv = async () => {
    const ok = await saveCsv(`kaseb-products-${new Date().toISOString().slice(0, 10)}.csv`, productsToCsv(sortProducts(products ?? [], 'name', lang), categories, { includeCost: admin, currency2: c2 }))
    if (ok) toast(t('products.exported', { n: (products ?? []).length }), 'success')
  }

  const filterLabel = (f: ProductFilter) => t(`products.filter.${f}`, { cur: c2.symbol })
  const sortLabel = (s: ProductSort) => t(`products.sort.${s}`)
  const filters = fxOn ? FILTERS : FILTERS.filter(f => f !== 'fx')
  const filterMenu = (
    <Menu
      trigger={(_o, toggle) => <Button variant={filter !== 'all' ? 'soft' : 'default'} iconOnly={mobile} icon={<Filter size={18} />} onClick={toggle} aria-label={t('common.filter')} title={t('common.filter')}>{filterLabel(filter)}</Button>}
      items={filters.map(f => ({ key: f, label: filterLabel(f), checked: filter === f, onClick: () => setFilter(f) }))}
    />
  )
  const sortMenu = (
    <Menu
      trigger={(_o, toggle) => <Button iconOnly={mobile} icon={<ArrowUpDown size={18} />} onClick={toggle} aria-label={t('common.sort')} title={t('common.sort')}>{sortLabel(sort)}</Button>}
      items={SORTS.map(s => ({ key: s, label: sortLabel(s), checked: sort === s, onClick: () => setSort(s) }))}
    />
  )
  const moreMenu = (
    <Menu
      trigger={(_o, toggle) => <Button iconOnly icon={<MoreHorizontal size={18} />} onClick={toggle} aria-label={t('common.more')} title={t('common.more')} />}
      items={[
        ...(mobile ? [{ key: 'select', label: t('products.select'), icon: <CheckSquare size={16} />, onClick: () => enterSelect() }] : []),
        { key: 'cats', label: t('products.cats.title'), icon: <Tag size={16} />, onClick: () => setCatsOpen(true) },
        { key: 'labels', label: t('products.labelsVisible', { n: visible.length }), icon: <Printer size={16} />, disabled: !visible.length, onClick: () => setLabelsFor(visible) },
        ...(admin ? [
          { key: 'export', label: t('products.exportCsv'), icon: <Download size={16} />, separator: true, disabled: !(products ?? []).length, onClick: () => void exportCsv() },
          { key: 'import', label: t('products.importCsv'), icon: <Upload size={16} />, onClick: () => setImportOpen(true) },
          { key: 'template', label: t('products.import.template'), icon: <FileText size={16} />, onClick: () => void downloadTemplate() },
        ] : []),
      ]}
    />
  )

  const noProducts = products !== undefined && products.length === 0
  const searchIsCode = looksLikeBarcode(cleanBarcode(search))

  return (
    <div className="page pr-page">
      <div className="page-head">
        <h1>{t('nav.products')}</h1>
        {products && <span className="faint small num">{products.filter(p => p.active).length}</span>}
        {!mobile && (
          <div className="actions">
            <Button variant={selectMode ? 'soft' : 'default'} icon={<CheckSquare size={18} />} onClick={() => (selectMode ? exitSelect() : enterSelect())}>{t('products.select')}</Button>
            {moreMenu}
            {canEdit && <Button variant="primary" icon={<Plus size={18} />} onClick={() => newProduct()}>{t('products.new')}</Button>}
          </div>
        )}
      </div>
      <div className="page-body pr-body">
        <div className="pr-toolbar">
          <SearchInput inputRef={searchRef} value={search} onChange={setSearch} placeholder={t('products.searchPh')} onEnter={openFromSearch} className="pr-search" />
          {filterMenu}
          {sortMenu}
          {mobile && moreMenu}
        </div>
        {(categories.length > 0 || uncategorized) && (
          <div className="chips pr-chips">
            <button type="button" className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>{t('common.all')}</button>
            {categories.map(c => (
              <button key={c.id} type="button" className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(cat === c.id ? 'all' : c.id)}>
                {c.icon ? <span>{c.icon}</span> : <span className="dot" style={{ background: c.color }} />}{c.name}
              </button>
            ))}
            {uncategorized && <button type="button" className={`chip ${cat === 'none' ? 'on' : ''}`} onClick={() => setCat(cat === 'none' ? 'all' : 'none')}>{t('products.noCategory')}</button>}
            <button type="button" className="chip" onClick={() => setCatsOpen(true)} aria-label={t('products.cats.title')} title={t('products.cats.title')}><Tag size={14} />{mobile ? '' : t('products.cats.manage')}</button>
          </div>
        )}

        {products === undefined ? (
          <div className="empty"><Spinner /></div>
        ) : noProducts ? (
          <Empty icon={<Package size={34} />} title={t('products.emptyTitle')} text={t('products.emptyText')} action={
            <div className="row wrap" style={{ justifyContent: 'center' }}>
              <Button variant="primary" icon={<Plus size={18} />} onClick={() => newProduct()}>{t('products.addFirst')}</Button>
              {admin && <Button icon={<Upload size={18} />} onClick={() => setImportOpen(true)}>{t('products.importCsv')}</Button>}
            </div>
          } />
        ) : visible.length === 0 ? (
          <Empty icon={<SearchX size={34} />} title={t('common.noResults')} text={searchIsCode ? t('products.noResultsCode') : t('products.noResultsText')} action={
            <div className="row wrap" style={{ justifyContent: 'center' }}>
              {searchIsCode && <Button variant="primary" icon={<ScanBarcode size={18} />} onClick={() => newProduct(cleanBarcode(search))}>{t('products.createWithBarcode')}</Button>}
              <Button onClick={() => { setSearch(''); setCat('all'); setFilter('all') }}>{t('products.clearFilters')}</Button>
            </div>
          } />
        ) : (
          <>
            <div className="pr-summary">
              <span>{t('products.count', { n: visible.length })}</span>
              {seeCost && <span>· {t('products.stockValue')}: <Money value={stockValue(visible, d)} />{fxOn && c2.rate > 0 && <span className="faint"> ≈ <span className="num">{formatMoney(stockValueFx(visible, c2), c2)}</span></span>}</span>}
              {!mobile && <span className="pr-kbd-hint">· <span className="kbd">F1</span> {t('common.search')}</span>}
            </div>
            <div className={`card flat pr-table ${seeCost ? '' : 'no-cost'} ${mobile ? 'mobile' : ''}`}>
              {!mobile && (
                <div className="pr-thead">
                  <span />
                  <HeadSort label={t('common.name')} active={sort === 'name'} onClick={() => setSort('name')} />
                  <span>{t('common.category')}</span>
                  <span>{t('common.barcode')}</span>
                  <HeadSort label={t('common.price')} active={sort === 'price'} onClick={() => setSort('price')} end />
                  {seeCost && <span className="end">{t('common.cost')}</span>}
                  <HeadSort label={t('products.stock')} active={sort === 'stock'} onClick={() => setSort('stock')} end />
                  <span />
                </div>
              )}
              {visible.map(p => (
                <ProductRow
                  key={p.id}
                  p={p}
                  category={p.categoryId ? catMap.get(p.categoryId) : undefined}
                  admin={seeCost}
                  fx={c2.enabled}
                  mobile={mobile}
                  selectMode={selectMode}
                  selected={selected.has(p.id)}
                  onOpen={() => (selectMode ? toggleSel(p.id) : canEdit ? openProduct(p) : toast(t('common.noPermission'), 'warn'))}
                  onLongPress={() => { if (!selectMode) enterSelect(p.id); else toggleSel(p.id) }}
                  onFav={() => void toggleFav(p)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {mobile && !selectMode && !formOpen && canEdit && (
        <button type="button" className="pr-fab" onClick={() => newProduct()} aria-label={t('products.new')}><Plus size={26} /></button>
      )}

      {selectMode && (
        <div className="pr-bulkbar">
          <div className="row pr-bulk-top">
            <Button variant="ghost" iconOnly icon={<X size={18} />} onClick={exitSelect} aria-label={t('common.close')} />
            <span className="bold">{t('products.selectedCount', { n: selected.size })}</span>
            <Button variant="ghost" size="sm" onClick={selectAllVisible}>{allVisibleSelected ? t('products.deselectAll') : t('products.selectAll')}</Button>
          </div>
          <div className="row wrap pr-bulk-actions">
            <Button size="sm" icon={<FolderInput size={16} />} disabled={!selected.size} onClick={() => setBulkCatOpen(true)}>{t('common.category')}</Button>
            <Button size="sm" icon={<Eye size={16} />} disabled={!selected.size} onClick={() => void bulkActive(true)}>{t('products.bulk.activate')}</Button>
            <Button size="sm" icon={<EyeOff size={16} />} disabled={!selected.size} onClick={() => void bulkActive(false)}>{t('products.bulk.deactivate')}</Button>
            {admin && <Button size="sm" icon={<Percent size={16} />} disabled={!selected.size} onClick={() => setPriceOpen(true)}>{t('products.bulk.price')}</Button>}
            {admin && fxOn && <Button size="sm" icon={<ArrowLeftRight size={16} />} disabled={!selected.size} onClick={() => setAnchorOpen(true)}>{t('products.bulk.convert')}</Button>}
            <Button size="sm" icon={<Printer size={16} />} disabled={!selected.size} onClick={() => setLabelsFor(selectedProducts)}>{t('products.labels.short')}</Button>
            <Button size="sm" variant="soft-danger" icon={<Trash2 size={16} />} disabled={!selected.size} onClick={() => void bulkDelete()}>{t('common.delete')}</Button>
          </div>
        </div>
      )}

      <Outlet />
      <CategoriesModal open={catsOpen} onClose={() => setCatsOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <LabelsDialog open={!!labelsFor} onClose={() => setLabelsFor(null)} products={labelsFor ?? []} />
      <BulkPriceModal open={priceOpen} onClose={() => setPriceOpen(false)} products={selectedProducts} onDone={exitSelect} />
      <BulkCategoryModal open={bulkCatOpen} onClose={() => setBulkCatOpen(false)} products={selectedProducts} onDone={exitSelect} />
      <BulkAnchorModal open={anchorOpen} onClose={() => setAnchorOpen(false)} products={selectedProducts} onDone={exitSelect} />
    </div>
  )
}

function persistView(v: { filter: ProductFilter; sort: ProductSort }) {
  try { localStorage.setItem(VIEW_KEY, JSON.stringify(v)) } catch { /* ignore */ }
  return v
}

function HeadSort({ label, active, onClick, end }: { label: ReactNode; active: boolean; onClick: () => void; end?: boolean }) {
  return <button type="button" className={`pr-th ${active ? 'on' : ''} ${end ? 'end' : ''}`} onClick={onClick}>{label}{active && <ArrowUpDown size={12} />}</button>
}

function StockBadge({ p }: { p: Product }) {
  const t = useT()
  const s = stockState(p)
  const days = daysToExpiry(p)
  const exp = days === null ? null : days < 0 ? <Badge kind="danger">{t('products.expired')}</Badge> : days === 0 ? <Badge kind="danger">{t('products.expiresToday')}</Badge> : days <= EXPIRY_WARN_DAYS ? <Badge kind="warn">{t('products.expiring', { n: days })}</Badge> : null
  if (s === 'untracked') return <>{exp ?? <span className="faint">—</span>}</>
  const qty = <span className="num">{formatQty(p.stock)}</span>
  if (s === 'out') return <>{exp}<Badge kind="danger">{t('products.outOfStock')}</Badge></>
  return <>{exp}<Badge kind={s === 'low' ? 'warn' : undefined}>{qty} <span className="xs">{unitLabel(p.unit)}</span></Badge></>
}

interface RowProps { p: Product; category?: Category; admin: boolean; fx: boolean; mobile: boolean; selectMode: boolean; selected: boolean; onOpen: () => void; onLongPress: () => void; onFav: () => void }
function ProductRow({ p, category, admin, fx, mobile, selectMode, selected, onOpen, onLongPress, onFav }: RowProps) {
  const t = useT()
  const c2 = useSettings().currency2
  // anchored products show their second-currency price under the primary one
  const fxCaption = fx && isFxPriced(p) ? <div className="pr-fx" title={t('products.fxBadge', { cur: c2.symbol })}>{formatMoney(p.fxPrice!, c2)}</div> : null
  const timer = useRef<number | undefined>(undefined)
  const fired = useRef(false)
  const startPt = useRef<{ x: number; y: number } | null>(null)
  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = undefined } }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    fired.current = false
    startPt.current = { x: e.clientX, y: e.clientY }
    cancel()
    timer.current = window.setTimeout(() => { fired.current = true; onLongPress() }, 480)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (startPt.current && Math.hypot(e.clientX - startPt.current.x, e.clientY - startPt.current.y) > 10) cancel()
  }
  const onClick = () => { if (fired.current) { fired.current = false; return } onOpen() }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }
  const check = <span className={`pr-check ${selected ? 'on' : ''}`} aria-hidden><Check size={14} /></span>
  const avatar = <Avatar name={p.name} color={p.color} emoji={p.emoji} image={p.image} size={40} />
  const star = (
    <button type="button" className={`pr-star ${p.favorite ? 'on' : ''}`} onClick={e => { e.stopPropagation(); onFav() }} onPointerDown={e => e.stopPropagation()} aria-label={t('products.favorite')} aria-pressed={p.favorite} title={t('products.favorite')}>
      <Star size={18} fill={p.favorite ? 'currentColor' : 'none'} />
    </button>
  )
  const cls = `${selected ? 'selected' : ''} ${!p.active ? 'inactive' : ''}`
  const inactiveBadge = !p.active ? <Badge>{t('common.inactive')}</Badge> : null

  if (mobile) {
    return (
      <div className={`list-row pr-row-m ${cls}`} role="button" tabIndex={0} onClick={onClick} onKeyDown={onKey} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} onContextMenu={e => e.preventDefault()}>
        {selectMode ? check : avatar}
        <div className="grow truncate">
          <div className="title truncate">{p.name}</div>
          <div className="sub p-sub">
            {category && <span className="truncate">{category.icon ? `${category.icon} ` : ''}{category.name}</span>}
            {category && p.barcodes[0] && <span>·</span>}
            {p.barcodes[0] && <span className="num p-code">{p.barcodes[0]}</span>}
            {inactiveBadge && <> {inactiveBadge}</>}
          </div>
        </div>
        <div className="end">
          <div className="bold"><Money value={p.price} /></div>
          {fxCaption}
          <div className="xs"><StockBadge p={p} /></div>
        </div>
        {!selectMode && star}
      </div>
    )
  }
  return (
    <div className={`pr-row ${cls}`} role="button" tabIndex={0} onClick={onClick} onKeyDown={onKey} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} onContextMenu={e => { e.preventDefault(); onLongPress() }}>
      {selectMode ? check : avatar}
      <div className="truncate">
        <div className="title truncate">{p.name} {inactiveBadge}</div>
        {p.sku && <div className="sub num truncate">{p.sku}</div>}
      </div>
      <div className="truncate">{category ? <span className="chip pr-cat-chip"><span className="dot" style={{ background: category.color }} />{category.icon ? `${category.icon} ` : ''}{category.name}</span> : <span className="faint">—</span>}</div>
      <div className="num truncate">{p.barcodes[0] ?? <span className="faint">—</span>}{p.barcodes.length > 1 && <span className="xs faint"> +{p.barcodes.length - 1}</span>}</div>
      <div className="end bold"><Money value={p.price} />{fxCaption}</div>
      {admin && <div className="end muted"><Money value={p.cost} />{typeof p.fxCost === 'number' && fx && <div className="pr-fx">{formatMoney(p.fxCost, c2)}</div>}</div>}
      <div className="end"><StockBadge p={p} /></div>
      <div className="end">{!selectMode && star}</div>
    </div>
  )
}

// The sales screen: products on one side, the cart on the inline-start side (a sheet on phones),
// scanning by keyboard wedge / camera / typed code, hold & restore, payment, and the receipt afterwards.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShoppingCart } from 'lucide-react'
import { db } from '../../db'
import type { Customer, HeldTicket, Product, Sale } from '../../db/types'
import { type Cart, type CartLine, computeTotals, lineKey } from '../../lib/cart'
import { useStore, toast, confirmDialog } from '../../state/store'
import { useT } from '../../i18n'
import { beep } from '../../lib/audio'
import { uid } from '../../lib/ids'
import { formatMoney, formatQty } from '../../lib/money'
import { cleanBarcode } from '../../lib/barcode'
import { useBarcodeWedge } from '../../lib/scanner-input'
import { platform } from '../../lib/platform'
import { completeSale, balanceAfterSale, saleErrorText, type PaymentPlan } from '../../lib/sales'
import { printSale } from '../../lib/receipt'
import { Modal, Button, useIsMobile } from '../../components/ui'
import { ScannerModal } from '../../components/Scanner'
import { ProductsPanel } from './ProductsPanel'
import { CartPanel, CartHeadActions } from './CartPanel'
import { PaymentModal } from './PaymentModal'
import { DoneDialog } from './DoneDialog'
import { LineEditorDialog, DiscountDialog, NoteDialog, QtyDialog, CustomItemDialog, HoldDialog, HeldTicketsDialog, CustomerPickerDialog, QuickAddDialog } from './dialogs'
import { filterProducts, sortProducts, findByBarcode, resolveEntry, availableQty } from './search'
import './i18n'
import './sales.css'

type Dialog =
  | { kind: 'pay' }
  | { kind: 'done'; sale: Sale; balanceAfter?: number }
  | { kind: 'line'; key: string }
  | { kind: 'fraction'; key: string }
  | { kind: 'qty'; product: Product }
  | { kind: 'discount' }
  | { kind: 'note' }
  | { kind: 'customer' }
  | { kind: 'hold' }
  | { kind: 'held' }
  | { kind: 'custom' }
  | { kind: 'quickAdd'; barcode?: string; name?: string }
  | { kind: 'scanner' }

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => { const id = window.setTimeout(() => setV(value), ms); return () => clearTimeout(id) }, [value, ms])
  return v
}

export default function SalesScreen() {
  const t = useT()
  const nav = useNavigate()
  const isMobile = useIsMobile()
  const settings = useStore(s => s.settings)
  const user = useStore(s => s.user)
  const users = useStore(s => s.users)
  const shift = useStore(s => s.shift)
  const cart = useStore(s => s.cart)
  const addProduct = useStore(s => s.addProduct)
  const addLine = useStore(s => s.addLine)
  const setQty = useStore(s => s.setQty)
  const patchLine = useStore(s => s.patchLine)
  const removeLine = useStore(s => s.removeLine)
  const setCart = useStore(s => s.setCart)
  const clearCart = useStore(s => s.clearCart)
  const setCartDiscount = useStore(s => s.setCartDiscount)
  const setCartCustomer = useStore(s => s.setCartCustomer)
  const setCartNote = useStore(s => s.setCartNote)
  const d = settings.currency.decimals
  const showKbd = !isMobile && !platform.isTouch

  const [search, setSearch] = useState('')
  const q = useDebounced(search, 110)
  const [category, setCategory] = useState('all')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [customerPicker, setCustomerPicker] = useState(false)   // can sit on top of the payment dialog
  const [cartOpen, setCartOpen] = useState(false)
  const [flash, setFlash] = useState<{ key: string; seq: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const flashSeq = useRef(0)

  const allProducts = useLiveQuery(() => db.products.toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('sort').toArray(), []) ?? []
  const heldCount = useLiveQuery(() => db.heldTickets.count(), []) ?? 0
  const customer = useLiveQuery<Customer | undefined>(() => (cart.customerId ? db.customers.get(cart.customerId) : Promise.resolve(undefined)), [cart.customerId])

  const activeProducts = useMemo(() => sortProducts((allProducts ?? []).filter(p => p.active)), [allProducts])
  const visible = useMemo(() => (allProducts === undefined ? undefined : filterProducts(activeProducts, q, { categoryId: category !== 'all' && category !== 'fav' ? category : undefined, favorites: category === 'fav' })), [allProducts, activeProducts, q, category])
  const totals = useMemo(() => computeTotals(cart, settings.tax, d), [cart, settings.tax, d])
  const inCart = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of cart.lines) if (l.productId) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qty)
    return m
  }, [cart.lines])

  // a category that was deleted falls back to "all"
  useEffect(() => { if (category !== 'all' && category !== 'fav' && categories.length && !categories.some(c => c.id === category)) setCategory('all') }, [categories, category])

  const focusSearch = useCallback(() => { const el = searchRef.current; if (el) { el.focus(); el.select() } }, [])
  const close = useCallback(() => setDialog(null), [])
  /** Opens a dialog; whatever had the focus behind it (the search box, a product card) lets go, so keys reach the dialog. */
  const blurActive = () => (document.activeElement as HTMLElement | null)?.blur?.()
  const openDialog = useCallback((d: Dialog) => { blurActive(); setDialog(d) }, [])
  const openCustomerPicker = useCallback(() => { blurActive(); setCustomerPicker(true) }, [])

  const flashLine = useCallback((find: (l: CartLine) => boolean) => {
    const lines = useStore.getState().cart.lines
    for (let i = lines.length - 1; i >= 0; i--) if (find(lines[i])) { setFlash({ key: lines[i].key, seq: ++flashSeq.current }); return }
  }, [])

  /** Adds a product to the cart, respecting the stock rule. Returns whether it went in. */
  const addToCart = useCallback((p: Product, qty = 1, source: 'tap' | 'scan' = 'tap'): boolean => {
    const have = useStore.getState().cart.lines.filter(l => l.productId === p.id).reduce((s, l) => s + l.qty, 0)
    const avail = availableQty(p, have, settings.pos.allowNegativeStock)
    if (avail <= 0) { toast(t('sales.outOfStock', { name: p.name }), 'warn'); beep('error'); return false }
    if (qty > avail) { toast(t('sales.notEnoughStock', { name: p.name, n: formatQty(avail) }), 'warn'); beep('error'); return false }
    addProduct(p, qty)
    if (source === 'scan') beep('scan')
    flashLine(l => l.productId === p.id && l.price === p.price && !l.note && l.discount === 0)
    return true
  }, [addProduct, flashLine, settings.pos.allowNegativeStock, t])

  /** A code from the hardware scanner or the camera. Returns whether it was known. */
  const handleCode = useCallback((raw: string): boolean => {
    const code = cleanBarcode(raw)
    if (!code) return false
    const p = findByBarcode(activeProducts, code)
    if (p) { addToCart(p, 1, 'scan'); return true }
    beep('error')
    toast(t('sales.unknownBarcode'), 'warn')
    openDialog({ kind: 'quickAdd', barcode: code })
    return false
  }, [activeProducts, addToCart, openDialog, t])

  useBarcodeWedge(code => { if (!dialog) handleCode(code) }, { enabled: !dialog })

  const onSearchEnter = (text: string) => {
    const a = resolveEntry(text, activeProducts)
    if (a.kind === 'product') {
      if (addToCart(a.product, 1, a.scanned ? 'scan' : 'tap')) setSearch('')
    } else if (a.kind === 'quickAdd') {
      beep('error')
      setSearch('')
      openDialog({ kind: 'quickAdd', barcode: a.barcode })
    }
  }

  const onPick = (p: Product) => {
    if (addToCart(p, 1, 'tap') && !isMobile) { if (search) setSearch(''); focusSearch() }
  }

  /* ---------- cart tools ---------- */
  const doClear = async () => {
    if (!cart.lines.length) return
    if (await confirmDialog({ title: t('sales.clearTitle'), text: t('sales.clearText'), danger: true, okLabel: t('sales.clear') })) {
      clearCart(); toast(t('sales.cleared'), 'info'); setCartOpen(false)
    }
  }
  const doHold = async (name: string) => {
    if (!user || !cart.lines.length) return
    try {
      await db.heldTickets.add({ id: uid(), name: name.trim(), cart, createdAt: Date.now(), userId: user.id })
      clearCart(); setDialog(null); setCartOpen(false)
      toast(t('sales.holdSaved'), 'success')
      if (!isMobile) focusSearch()
    } catch { toast(t('common.error'), 'error') }
  }
  const doRestore = async (tk: HeldTicket) => {
    const current = useStore.getState().cart
    if (current.lines.length) {
      const ok = await confirmDialog({ title: t('sales.heldReplaceTitle'), text: t('sales.heldReplaceText'), danger: true, okLabel: t('sales.heldRestore') })
      if (!ok) return
    }
    const c = tk.cart as Cart
    const lines = Array.isArray(c?.lines) ? c.lines.map(l => ({ ...l, key: lineKey() })) : []
    setCart({ lines, discount: c?.discount ?? 0, discountPct: c?.discountPct, customerId: c?.customerId, customerName: c?.customerName, note: c?.note })
    try { await db.heldTickets.delete(tk.id) } catch { /* the ticket is already in the cart */ }
    setDialog(null)
    toast(t('sales.heldRestored'), 'success')
  }
  const doDeleteHeld = async (tk: HeldTicket) => {
    if (await confirmDialog({ title: t('sales.heldDeleteTitle'), text: t('common.cannotUndo'), danger: true, okLabel: t('common.delete') })) {
      try { await db.heldTickets.delete(tk.id); toast(t('common.deleted'), 'info') } catch { toast(t('common.error'), 'error') }
    }
  }

  /* ---------- charge ---------- */
  const openCharge = useCallback(() => { if (useStore.getState().cart.lines.length) openDialog({ kind: 'pay' }) }, [openDialog])
  const confirmPayment = async (plan: PaymentPlan) => {
    if (!user || busy) return
    setBusy(true)
    try {
      const current = useStore.getState().cart
      const tot = computeTotals(current, settings.tax, d)
      const sale = await completeSale({ cart: current, totals: tot, payments: plan.payments, paid: plan.paid, change: plan.change, credit: plan.credit, user, shift, settings })
      beep('ok')
      const balanceAfter = plan.credit > 0 ? await balanceAfterSale(sale).catch(() => undefined) : undefined
      clearCart(); setSearch(''); setCartOpen(false); setCustomerPicker(false)
      if (settings.receipt.autoPrint) void printSale(sale, settings, { silent: true, balanceAfter }).catch(() => toast(t('receipt.actions.printFailed'), 'error'))
      if (settings.pos.askPrintAfterSale) openDialog({ kind: 'done', sale, balanceAfter })
      else { setDialog(null); toast(t('sales.doneToast', { n: sale.number }), 'success'); if (!isMobile) focusSearch() }
    } catch (e) {
      beep('error')
      toast(saleErrorText(e, t), 'error')
    } finally { setBusy(false) }
  }
  const closeDone = useCallback(() => { setDialog(null); if (!isMobile) focusSearch() }, [isMobile, focusSearch])

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); if (!dialog) { setCartOpen(false); focusSearch() } return }
      if (e.key === 'F2') { e.preventDefault(); if (!dialog) openCharge(); return }
      if (e.key === 'F4') { e.preventDefault(); if (!dialog && cart.lines.length) openDialog({ kind: 'hold' }); return }
      if (dialog || customerPicker) return
      const el = document.activeElement as HTMLElement | null
      const inField = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      const inEmptySearch = el === searchRef.current && !search
      if (inField && !inEmptySearch) return
      const last = cart.lines[cart.lines.length - 1]
      if (!last) return
      if (e.key === '+' || e.key === '=') { e.preventDefault(); setQty(last.key, last.qty + 1) }
      else if (e.key === '-') { e.preventDefault(); setQty(last.key, last.qty - 1) }
      else if (e.key === 'Delete') { e.preventDefault(); removeLine(last.key) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialog, customerPicker, cart.lines, search, focusSearch, openCharge, setQty, removeLine])

  const editingLine = dialog?.kind === 'line' || dialog?.kind === 'fraction' ? cart.lines.find(l => l.key === dialog.key) : undefined
  useEffect(() => { if ((dialog?.kind === 'line' || dialog?.kind === 'fraction') && !editingLine) setDialog(null) }, [dialog, editingLine])

  const cartPanel = (inSheet: boolean) => (
    <CartPanel
      cart={cart} totals={totals} settings={settings} flash={flash}
      onEditLine={key => openDialog({ kind: 'line', key })}
      onQty={(key, qty) => setQty(key, qty)}
      onFraction={key => openDialog({ kind: 'fraction', key })}
      onCustomer={openCustomerPicker}
      onRemoveCustomer={() => setCartCustomer(undefined, undefined)}
      onDiscount={() => openDialog({ kind: 'discount' })}
      onNote={() => openDialog({ kind: 'note' })}
      onHold={() => openDialog({ kind: 'hold' })}
      onHeld={() => openDialog({ kind: 'held' })}
      heldCount={heldCount}
      onClear={() => void doClear()}
      onCharge={openCharge}
      showKbd={showKbd}
      inSheet={inSheet}
      noShift={!shift}
      onOpenShift={() => nav('/shifts')}
    />
  )

  return (
    <div className="sales" data-grid={settings.pos.gridSize}>
      {!isMobile && cartPanel(false)}
      <ProductsPanel
        products={visible}
        hasAnyProducts={activeProducts.length > 0}
        categories={categories}
        settings={settings}
        search={search} onSearch={setSearch} onEnter={onSearchEnter}
        category={category} onCategory={setCategory}
        onPick={onPick}
        onPickQty={p => openDialog({ kind: 'qty', product: p })}
        onScan={() => openDialog({ kind: 'scanner' })}
        onCustom={() => openDialog({ kind: 'custom' })}
        onQuickAdd={name => openDialog({ kind: 'quickAdd', name })}
        onGoProducts={() => nav('/products')}
        searchRef={searchRef}
        autoFocus={!isMobile}
        inCart={inCart}
        showKbd={showKbd}
        noShift={isMobile && !shift}
        onOpenShift={() => nav('/shifts')}
      >
        {isMobile && (
          <div className="cart-bar">
            <Button variant="primary" size="xl" block onClick={() => setCartOpen(true)} aria-label={t('sales.cartOpen')}>
              <span className="lbl"><ShoppingCart size={20} /> {t('sales.cartBar', { n: formatQty(totals.itemCount) })}</span>
              <span className="num">{formatMoney(totals.total, settings.currency)}</span>
            </Button>
          </div>
        )}
      </ProductsPanel>

      {isMobile && (
        <Modal open={cartOpen} onClose={() => setCartOpen(false)} title={t('sales.cart')} full className="sales-cart-sheet"
          headExtra={<CartHeadActions heldCount={heldCount} hasLines={cart.lines.length > 0} onHeld={() => openDialog({ kind: 'held' })} onHold={() => openDialog({ kind: 'hold' })} onClear={() => void doClear()} showKbd={false} />}>
          {cartPanel(true)}
        </Modal>
      )}

      {dialog?.kind === 'pay' && (
        <PaymentModal cart={cart} totals={totals} settings={settings} customer={customer ?? undefined} busy={busy} frozen={customerPicker}
          onPickCustomer={openCustomerPicker} onConfirm={plan => void confirmPayment(plan)} onClose={() => { if (!busy) setDialog(null) }} />
      )}
      {dialog?.kind === 'done' && <DoneDialog sale={dialog.sale} balanceAfter={dialog.balanceAfter} settings={settings} showKbd={showKbd} onClose={closeDone} />}
      {dialog?.kind === 'line' && editingLine && (
        <LineEditorDialog line={editingLine} settings={settings} onClose={close}
          onSave={patch => { patchLine(editingLine.key, patch); setDialog(null) }}
          onRemove={() => { removeLine(editingLine.key); setDialog(null) }} />
      )}
      {dialog?.kind === 'fraction' && editingLine && (
        <QtyDialog title={t('common.qty')} subtitle={editingLine.name} initial={editingLine.qty} decimals={3} unit={editingLine.unit !== 'piece' ? t(`unit.${editingLine.unit}`) : undefined} allowZero
          onDone={n => { setQty(editingLine.key, n); setDialog(null) }} onClose={close} />
      )}
      {dialog?.kind === 'qty' && (
        <QtyDialog title={t('sales.qtyTitle')} subtitle={dialog.product.name} decimals={dialog.product.allowFraction ? 3 : 0}
          unit={dialog.product.unit !== 'piece' ? t(`unit.${dialog.product.unit}`) : undefined}
          confirmLabel={n => t('sales.qtyAdd', { n: formatQty(n) })}
          onDone={n => { if (addToCart(dialog.product, n, 'tap')) setDialog(null) }} onClose={close} />
      )}
      {dialog?.kind === 'discount' && (
        <DiscountDialog cart={cart} subtotal={totals.subtotal} settings={settings} onClose={close}
          onSave={(amount, pct) => { setCartDiscount(amount, pct); setDialog(null) }} />
      )}
      {dialog?.kind === 'note' && <NoteDialog note={cart.note ?? ''} onClose={close} onSave={n => { setCartNote(n); setDialog(null) }} />}
      {dialog?.kind === 'hold' && <HoldDialog onClose={close} onHold={name => void doHold(name)} />}
      {dialog?.kind === 'held' && user && (
        <HeldTicketsDialog user={user} users={users} settings={settings} onClose={close} onRestore={tk => void doRestore(tk)} onDelete={tk => void doDeleteHeld(tk)} />
      )}
      {dialog?.kind === 'custom' && (
        <CustomItemDialog settings={settings} onClose={close} onAdd={line => { addLine(line); setFlash({ key: line.key, seq: ++flashSeq.current }); setDialog(null) }} />
      )}
      {dialog?.kind === 'quickAdd' && user && (
        <QuickAddDialog barcode={dialog.barcode} initialName={dialog.name} categories={categories} settings={settings} admin={user.role === 'admin'} userId={user.id} onClose={close}
          onSaved={p => { setDialog(null); addToCart(p, 1, 'scan'); if (!isMobile) focusSearch() }} />
      )}
      {dialog?.kind === 'scanner' && (
        <ScannerModal open continuous onClose={() => setDialog(cur => (cur?.kind === 'scanner' ? null : cur))}
          onScan={code => {
            const p = findByBarcode(activeProducts, cleanBarcode(code))
            if (p) { addToCart(p, 1, 'scan'); return false }
            beep('error')
            openDialog({ kind: 'quickAdd', barcode: cleanBarcode(code) })
            return true
          }} />
      )}
      {customerPicker && (
        <CustomerPickerDialog selectedId={cart.customerId} settings={settings} onClose={() => setCustomerPicker(false)}
          onPick={c => { setCartCustomer(c?.id, c?.name); setCustomerPicker(false) }} />
      )}
    </div>
  )
}

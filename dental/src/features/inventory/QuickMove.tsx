// Quick stock movement: amount, reason and note. Used inline (history drawer), as a popover next to the
// +/− buttons on desktop, and as a bottom sheet on the phone.
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownToLine, ArrowUpFromLine, X } from 'lucide-react'
import { logActivity } from '@/db'
import type { InventoryItem, StockReason } from '@/db/types'
import { Button, Chip, Input, Modal, Segmented, useToast } from '@/ui'
import { NumberField } from './fields'
import { useI18n } from '@/i18n'
import { useSession } from '@/app/session'
import { useIsMobile } from '@/app/hooks'
import { REASONS_IN, REASONS_OUT, signedDelta, validateMove, type MoveDirection } from './lib'
import { recordMovement, StockError } from './actions'
import { qtyText, reasonLabel, unitLabel } from './parts'

export function QuickMoveForm({ item, initialDir = 'in', onDone, onCancel, autoFocus = true }: {
  item: InventoryItem; initialDir?: MoveDirection; onDone: () => void; onCancel: () => void; autoFocus?: boolean
}) {
  const { t, lang, isRTL } = useI18n()
  const toast = useToast()
  const { user } = useSession()
  const [dir, setDir] = useState<MoveDirection>(initialDir)
  const [amount, setAmount] = useState<number | null>(null)
  const [reason, setReason] = useState<StockReason>(initialDir === 'in' ? 'purchase' : 'use')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)   // a second Enter or click before the first write ends must not save twice
  const amountId = `inv-move-amount-${useId().replace(/:/g, '')}`
  const focusAmount = () => document.getElementById(amountId)?.focus()

  useEffect(() => { if (autoFocus) { const id = window.setTimeout(focusAmount, 80); return () => window.clearTimeout(id) } }, [autoFocus])
  const changeDir = (d: MoveDirection) => { setDir(d); setReason(d === 'in' ? 'purchase' : 'use') }

  const unit = unitLabel(t, item.unit)
  const error = validateMove(amount, dir, item.quantity)
  const after = amount && amount > 0 ? item.quantity + signedDelta(amount, dir) : null
  const showError = tried || (error === 'notEnough' && amount !== null)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setTried(true)
    if (error || amount === null) { focusAmount(); return }
    if (saving.current) return
    saving.current = true
    setBusy(true)
    try {
      const delta = signedDelta(amount, dir)
      const qty = await recordMovement(item.id, delta, reason, { note, by: user?.id })
      const d = `${delta > 0 ? '+' : '−'}${qtyText(Math.abs(delta), lang)}`
      toast.success(t('inventory.toast.moved'), <><bdi className="inv-wrap">{item.name}</bdi>: <span className="num">{d}</span> {isRTL ? '←' : '→'} <span className="num">{qtyText(qty, lang)}</span> {unit}</>)
      void logActivity({ type: 'inventory', action: 'update', entityId: item.id, by: user?.id, message: t('inventory.act.moved', { reason: reasonLabel(t, reason), name: item.name, delta: `\u2066${d}\u2069` }) })
      onDone()
    } catch (err) {
      toast.error(err instanceof StockError && err.code === 'notEnough' ? t('inventory.v.notEnough', { qty: qtyText(item.quantity, lang) }) : t('error'))
    } finally { saving.current = false; setBusy(false) }
  }

  const reasons = dir === 'in' ? REASONS_IN : REASONS_OUT
  return (
    <form className="inv-move-form" onSubmit={submit} noValidate>
      <Segmented<MoveDirection> block value={dir} onChange={changeDir} options={[
        { value: 'in', label: t('inventory.move.in'), icon: <ArrowDownToLine /> },
        { value: 'out', label: t('inventory.move.out'), icon: <ArrowUpFromLine /> },
      ]} />
      <NumberField label={t('inventory.move.amount')} required value={amount} onChange={setAmount} decimals={2} min={0} id={amountId}
        addon={unit} error={showError && error ? (error === 'amount' ? t('inventory.v.amount') : t('inventory.v.notEnough', { qty: qtyText(item.quantity, lang) })) : undefined} />
      <div className="field">
        <span className="field-label">{t('inventory.move.reason')}</span>
        <div className="inv-reasons">
          {reasons.map(r => <Chip key={r} active={reason === r} onClick={() => setReason(r)}>{reasonLabel(t, r)}</Chip>)}
        </div>
      </div>
      <Input label={t('inventory.move.note')} placeholder={t('inventory.move.notePlaceholder')} value={note} onChange={e => setNote(e.target.value)} maxLength={160} />
      <div className="inv-move-summary">
        <div className="inv-move-col">
          <span className="inv-move-label">{t('inventory.move.current')}</span>
          <span className="inv-move-val"><span className="num">{qtyText(item.quantity, lang)}</span> <small>{unit}</small></span>
        </div>
        <span className="inv-move-arrow" aria-hidden>→</span>
        <div className="inv-move-col">
          <span className="inv-move-label">{t('inventory.move.after')}</span>
          <span className={`inv-move-val${after === null || error === 'notEnough' ? ' muted' : dir === 'in' ? ' inv-text-success' : ' inv-text-warn'}`}>
            {after === null || error === 'notEnough' ? '—' : <><span className="num">{qtyText(after, lang)}</span> <small>{unit}</small></>}
          </span>
        </div>
      </div>
      <div className="inv-move-actions">
        <Button variant="ghost" onClick={onCancel}>{t('cancel')}</Button>
        <Button type="submit" variant="primary" loading={busy} icon={dir === 'in' ? <ArrowDownToLine /> : <ArrowUpFromLine />}>{t('inventory.move.apply')}</Button>
      </div>
    </form>
  )
}

/** Desktop: a panel anchored to the clicked button. Phone: a bottom sheet. */
export function QuickMovePopover({ item, dir, anchor, onClose }: { item: InventoryItem; dir: MoveDirection; anchor: HTMLElement | null; onClose: () => void }) {
  const { t, isRTL } = useI18n()
  const mobile = useIsMobile()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (mobile || !anchor) return
    const place = () => {
      const r = anchor.getBoundingClientRect()
      const el = ref.current
      const w = el?.offsetWidth ?? 320, h = el?.offsetHeight ?? 360
      const vw = window.innerWidth, vh = window.innerHeight
      let left = isRTL ? r.right - w : r.left
      left = Math.min(Math.max(8, left), vw - w - 8)
      let top = r.bottom + 8
      if (top + h > vh - 8) top = Math.max(8, r.top - h - 8)
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [anchor, mobile, isRTL])

  useEffect(() => {
    if (mobile) return
    const down = (e: MouseEvent) => {
      const n = e.target as Node
      if (ref.current?.contains(n) || anchor?.contains(n)) return
      onClose()
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', down)
    window.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('keydown', key) }
  }, [anchor, mobile, onClose])

  const title = <span className="truncate inv-auto" dir="auto">{item.name}</span>
  if (mobile) {
    return (
      <Modal open onClose={onClose} size="sm" title={t('inventory.move.title')} subtitle={<bdi className="inv-wrap">{item.name}</bdi>}>
        <QuickMoveForm item={item} initialDir={dir} onDone={onClose} onCancel={onClose} />
      </Modal>
    )
  }
  return createPortal(
    <div ref={ref} className="inv-popover" role="dialog" aria-label={t('inventory.move.title')} style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}>
      <div className="inv-popover-head">
        <div className="grow">
          <div className="inv-popover-title">{t('inventory.move.title')}</div>
          <div className="inv-popover-sub row gap-1">{title}</div>
        </div>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label={t('close')}><X /></button>
      </div>
      <QuickMoveForm item={item} initialDir={dir} onDone={onClose} onCancel={onClose} />
    </div>, document.body)
}

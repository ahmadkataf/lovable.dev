import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { Button, type ButtonVariant } from './Button'
import { useI18n, useTSafe } from '@/i18n'
import { isTextEntry } from '@/app/keyboard'

let openCount = 0
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    openCount++
    document.body.style.overflow = 'hidden'
    return () => { openCount--; if (openCount <= 0) { openCount = 0; document.body.style.overflow = '' } }
  }, [active])
}
/*
 * One Escape closes only the top-most layer (a confirmation over a form closes the confirmation, nothing else).
 * Layers register in opening order; a single window listener in the bubble phase calls the last one, so inner
 * controls (pickers, dropdowns) that stop the event in their own React handlers still get to handle it first.
 */
const escapeStack: { current: () => void }[] = []
let escapeInstalled = false
function installEscape() {
  if (escapeInstalled || typeof window === 'undefined') return
  escapeInstalled = true
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented) return
    const top = escapeStack[escapeStack.length - 1]
    if (!top) return
    e.preventDefault()
    top.current()
  })
}
/** Closes the top-most layer (dialog, drawer, menu); false when none is open. Used by the Android Back button. */
export function closeTopLayer(): boolean {
  const top = escapeStack[escapeStack.length - 1]
  if (!top) return false
  top.current()
  return true
}
/** Registers a layer that Escape closes while `onClose` is given. Use it for custom overlays too. */
export function useEscapeLayer(onClose?: () => void) {
  const ref = useRef(onClose)
  ref.current = onClose
  const active = !!onClose
  useEffect(() => {
    if (!active) return
    installEscape()
    const entry = { current: () => ref.current?.() }
    escapeStack.push(entry)
    return () => { const i = escapeStack.lastIndexOf(entry); if (i >= 0) escapeStack.splice(i, 1) }
  }, [active])
}
const useEscape = useEscapeLayer

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  footer?: ReactNode
  children: ReactNode
  closeOnOverlay?: boolean
  className?: string
  bodyClassName?: string
}
/** True on a touch screen (a phone or a tablet), where focusing a text field raises the on-screen keyboard. */
export function isCoarsePointer(): boolean {
  try { return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches } catch { return false }
}
/**
 * What a dialog focuses when it opens. An element marked [data-autofocus] always wins. On a touch screen nothing
 * else is focused for the user: a control that already took the focus (a confirm button) keeps it, and otherwise
 * the dialog itself takes it, so opening a dialog never raises the on-screen keyboard. With a mouse and a keyboard,
 * the first text field gets it (else the first control), ready for typing.
 */
export function dialogFocusTarget(root: HTMLElement | null, touch: boolean): HTMLElement | null {
  if (!root) return null
  const chosen = root.querySelector<HTMLElement>('[data-autofocus]')
  if (chosen) return chosen
  if (touch) {
    const active = document.activeElement
    return active instanceof HTMLElement && active !== root && root.contains(active) && !isTextEntry(active) ? active : root
  }
  return root.querySelector<HTMLElement>('[autofocus]')
    ?? root.querySelector<HTMLElement>('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]), textarea:not([disabled])')
    ?? root.querySelector<HTMLElement>('select:not([disabled]), input:not([type=hidden]), button:not(.modal-x)')
}

export function Modal({ open, onClose, title, subtitle, icon, size = 'md', footer, children, closeOnOverlay = true, className, bodyClassName }: ModalProps) {
  useScrollLock(open)
  useEscape(open ? onClose : undefined)
  const ref = useRef<HTMLDivElement>(null)
  const t = useTSafe()
  // A field with React's autoFocus is focused while the dialog is put on the screen. On a touch screen that would
  // raise the keyboard over the dialog, so the focus moves to the dialog in the same task, before the keyboard shows.
  useLayoutEffect(() => {
    if (!open || !isCoarsePointer()) return
    const root = ref.current, active = document.activeElement
    if (root && active && root.contains(active) && isTextEntry(active) && !active.closest('[data-autofocus]')) root.focus({ preventScroll: true })
  }, [open])
  useEffect(() => {
    if (!open) return
    const touch = isCoarsePointer()
    const timer = window.setTimeout(() => {
      const target = dialogFocusTarget(ref.current, touch)
      if (target && target !== document.activeElement) target.focus({ preventScroll: touch && target === ref.current })
    }, 50)
    return () => window.clearTimeout(timer)
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="overlay" onMouseDown={e => { if (closeOnOverlay && e.target === e.currentTarget) onClose() }}>
      <div ref={ref} className={['modal', size !== 'md' && `modal-${size}`, !footer && 'no-footer', className].filter(Boolean).join(' ')} role="dialog" aria-modal="true" tabIndex={-1}>
        {(title || subtitle) && (
          <div className="modal-header">
            <div className="grow"><div className="modal-title">{icon}{title}</div>{subtitle && <div className="modal-sub">{subtitle}</div>}</div>
            <button type="button" className="btn btn-ghost btn-icon btn-sm modal-x" onClick={onClose} aria-label={t('close')} title={t('close')}><X /></button>
          </div>
        )}
        <div className={['modal-body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>, document.body)
}

export interface DrawerProps { open: boolean; onClose: () => void; title?: ReactNode; size?: 'md' | 'lg'; footer?: ReactNode; children: ReactNode; actions?: ReactNode }
export function Drawer({ open, onClose, title, size = 'md', footer, children, actions }: DrawerProps) {
  const t = useTSafe()
  useScrollLock(open)
  useEscape(open ? onClose : undefined)
  if (!open) return null
  return createPortal(
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className={['drawer', size === 'lg' && 'drawer-lg', !footer && 'no-footer'].filter(Boolean).join(' ')} role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div className="drawer-title grow">{title}</div>
          {actions}
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label={t('close')} title={t('close')}><X /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </aside>
    </>, document.body)
}

/** Click-to-open dropdown. `trigger` gets the open state; items close the menu when clicked. */
export interface MenuItemDef { label?: ReactNode; icon?: ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean; shortcut?: string; sep?: boolean; header?: ReactNode }
export function Menu({ trigger, items, align = 'end', vertical = 'bottom', children, className }: { trigger: (open: boolean) => ReactNode; items?: MenuItemDef[]; align?: 'start' | 'end'; vertical?: 'top' | 'bottom'; children?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const trig = useRef<HTMLSpanElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  // The menu lives in a portal with fixed positioning, so a table or a card with overflow never clips it.
  // It opens below the trigger (or above with vertical="top") and flips when there is no room.
  const place = useCallback(() => {
    const t = trig.current?.getBoundingClientRect(), m = menu.current
    if (!t || !m) return
    const w = m.offsetWidth, h = m.offsetHeight, gap = 6, vw = window.innerWidth, vh = window.innerHeight
    const rtl = getComputedStyle(trig.current!).direction === 'rtl'
    const alignRight = (align === 'end') !== rtl          // the menu's right edge meets the trigger's right edge
    let left = alignRight ? t.right - w : t.left
    left = Math.max(8, Math.min(left, vw - w - 8))
    const below = t.bottom + gap, above = t.top - gap - h
    let top = vertical === 'top' ? (above >= 8 ? above : below) : (below + h <= vh - 8 || above < 8 ? below : above)
    top = Math.max(8, Math.min(top, vh - h - 8))
    setPos(p => (p && p.top === top && p.left === left ? p : { top, left }))
  }, [align, vertical])
  useLayoutEffect(() => { if (open) place(); else setPos(null) }, [open, place])
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent | TouchEvent) => {
      const n = e.target as Node
      if (!ref.current?.contains(n) && !menu.current?.contains(n)) setOpen(false)
    }
    // A rotation (the width changes) closes the menu. A height-only resize is the on-screen keyboard showing or hiding
    // (tapping the trigger takes the focus off a field and the keyboard goes down): the menu stays and follows its trigger.
    const width = window.innerWidth
    const onResize = () => { if (Math.abs(window.innerWidth - width) > 1) setOpen(false); else place() }
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h)
    window.addEventListener('resize', onResize); window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h)
      window.removeEventListener('resize', onResize); window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [open, place])
  useEscapeLayer(open ? () => setOpen(false) : undefined)
  return (
    <div ref={ref} className={['menu-anchor', className].filter(Boolean).join(' ')}>
      <span ref={trig} onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex' }}>{trigger(open)}</span>
      {open && createPortal(
        <div ref={menu} className="menu menu-portal" role="menu" onClick={() => setOpen(false)}
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
          {items?.map((it, i) => it.sep ? <div key={i} className="menu-sep" /> : it.header ? <div key={i} className="menu-label">{it.header}</div> : (
            <button key={i} type="button" role="menuitem" className={`menu-item${it.danger ? ' danger' : ''}`} disabled={it.disabled} onClick={it.onClick}>{it.icon}<span className="grow">{it.label}</span>{it.shortcut && <kbd className="kbd">{it.shortcut}</kbd>}</button>
          ))}
          {children}
        </div>, document.body)}
    </div>
  )
}

// ---- confirm dialog as a promise ----
interface ConfirmOptions { title?: ReactNode; description?: ReactNode; confirmLabel?: ReactNode; cancelLabel?: ReactNode; danger?: boolean; variant?: ButtonVariant }
type ConfirmFn = (opts?: ConfirmOptions) => Promise<boolean>
const ConfirmCtx = createContext<ConfirmFn | null>(null)
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null)
  const confirm = useCallback<ConfirmFn>(opts => new Promise(resolve => setState({ opts: opts ?? {}, resolve })), [])
  const close = (v: boolean) => { state?.resolve(v); setState(null) }
  const o = state?.opts
  const value = useMemo(() => confirm, [confirm])
  return (
    <ConfirmCtx.Provider value={value}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} size="sm" title={o?.title ?? t('confirmTitle')} icon={o?.danger ? <AlertTriangle style={{ color: 'var(--danger)' }} /> : undefined}
        footer={<><Button variant="ghost" onClick={() => close(false)}>{o?.cancelLabel ?? t('cancel')}</Button><Button variant={o?.variant ?? (o?.danger ? 'danger' : 'primary')} onClick={() => close(true)} autoFocus>{o?.confirmLabel ?? (o?.danger ? t('delete') : t('confirm'))}</Button></>}>
        {o?.description && <p className="muted" style={{ fontSize: 'var(--fs-md)' }}>{o.description}</p>}
      </Modal>
    </ConfirmCtx.Provider>
  )
}
export function useConfirm(): ConfirmFn {
  const v = useContext(ConfirmCtx)
  if (!v) throw new Error('useConfirm outside ConfirmProvider')
  return v
}
/** The usual "delete this?" with the shared wording. */
export function useConfirmDelete() {
  const confirm = useConfirm(); const { t } = useI18n()
  return (description?: ReactNode) => confirm({ title: t('confirmDeleteTitle'), description: description ?? t('confirmDeleteDesc'), danger: true })
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { Button, type ButtonVariant } from './Button'
import { useI18n } from '@/i18n'

let openCount = 0
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    openCount++
    document.body.style.overflow = 'hidden'
    return () => { openCount--; if (openCount <= 0) { openCount = 0; document.body.style.overflow = '' } }
  }, [active])
}
function useEscape(onClose?: () => void) {
  useEffect(() => {
    if (!onClose) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
}

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
export function Modal({ open, onClose, title, subtitle, icon, size = 'md', footer, children, closeOnOverlay = true, className, bodyClassName }: ModalProps) {
  useScrollLock(open)
  useEscape(open ? onClose : undefined)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const first = ref.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button:not(.modal-x)')
    const t = window.setTimeout(() => first?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="overlay" onMouseDown={e => { if (closeOnOverlay && e.target === e.currentTarget) onClose() }}>
      <div ref={ref} className={['modal', size !== 'md' && `modal-${size}`, className].filter(Boolean).join(' ')} role="dialog" aria-modal="true">
        {(title || subtitle) && (
          <div className="modal-header">
            <div className="grow"><div className="modal-title">{icon}{title}</div>{subtitle && <div className="modal-sub">{subtitle}</div>}</div>
            <button type="button" className="btn btn-ghost btn-icon btn-sm modal-x" onClick={onClose} aria-label="close"><X /></button>
          </div>
        )}
        <div className={['modal-body', bodyClassName].filter(Boolean).join(' ')}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>, document.body)
}

export interface DrawerProps { open: boolean; onClose: () => void; title?: ReactNode; size?: 'md' | 'lg'; footer?: ReactNode; children: ReactNode; actions?: ReactNode }
export function Drawer({ open, onClose, title, size = 'md', footer, children, actions }: DrawerProps) {
  useScrollLock(open)
  useEscape(open ? onClose : undefined)
  if (!open) return null
  return createPortal(
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className={['drawer', size === 'lg' && 'drawer-lg'].filter(Boolean).join(' ')} role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div className="drawer-title grow">{title}</div>
          {actions}
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="close"><X /></button>
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
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h); window.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); window.removeEventListener('keydown', k) }
  }, [open])
  return (
    <div ref={ref} className={['menu-anchor', className].filter(Boolean).join(' ')}>
      <span onClick={() => setOpen(o => !o)} style={{ display: 'inline-flex' }}>{trigger(open)}</span>
      {open && (
        <div className={['menu', align === 'start' && 'align-start', vertical === 'top' && 'align-top'].filter(Boolean).join(' ')} role="menu" onClick={() => setOpen(false)}>
          {items?.map((it, i) => it.sep ? <div key={i} className="menu-sep" /> : it.header ? <div key={i} className="menu-label">{it.header}</div> : (
            <button key={i} type="button" role="menuitem" className={`menu-item${it.danger ? ' danger' : ''}`} disabled={it.disabled} onClick={it.onClick}>{it.icon}<span className="grow">{it.label}</span>{it.shortcut && <kbd className="kbd">{it.shortcut}</kbd>}</button>
          ))}
          {children}
        </div>
      )}
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

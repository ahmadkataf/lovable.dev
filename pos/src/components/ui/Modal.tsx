import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, RotateCcw } from 'lucide-react'
import { t } from '../../i18n'
import { restartApp } from '../../lib/recovery'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'narrow' | 'normal' | 'wide' | 'xl'
  full?: boolean          // whole screen on phones
  headExtra?: ReactNode
  noClose?: boolean
  /** The dialog is waiting for its work to finish (and usually cannot be closed meanwhile). If that lasts too long a
   *  way out appears: before, a save that never finished kept the dialog — and the whole app behind it — locked. */
  busy?: boolean
  /** Changes while busy work moves on (bytes received, rows written): each change restarts the clock, so the notice
   *  appears only when nothing has moved for a while — a long restore on a slow line is not "stuck". */
  progress?: string | number
  className?: string
}

const STUCK_MS = 30000

// The Android shell asks the page to handle the back button: close the topmost dialog when one is open.
if (typeof window !== 'undefined' && !window.onPosBack) {
  window.onPosBack = () => {
    if (!document.querySelector('body > .overlay')) return false
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    return true
  }
}

/** Centred dialog on wide screens, bottom sheet on phones. Escape and the backdrop close it. */
export function Modal({ open, onClose, title, children, footer, size = 'normal', full, headExtra, noClose, busy, progress, className = '' }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    setStuck(false)
    if (!open || !busy) return
    const id = setTimeout(() => setStuck(true), STUCK_MS)
    return () => clearTimeout(id)
  }, [open, busy, progress])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || noClose) return
      // dialogs stack (a confirm over a form): only the one on top answers Escape
      const all = document.querySelectorAll('body > .overlay')
      if (all.length && all[all.length - 1] !== ref.current) return
      e.stopPropagation(); onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose, noClose])
  // give the focus back to whatever had it before the dialog opened (keyboard users land where they were)
  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    return () => { if (before && before !== document.body && before.isConnected) { try { before.focus() } catch { /* ignore */ } } }
  }, [open])
  if (!open) return null
  return createPortal(
    <div ref={ref} className="overlay" onMouseDown={e => { if (e.target === e.currentTarget && !noClose) onClose() }}>
      <div className={`modal ${size !== 'normal' ? size : ''} ${full ? 'full' : ''} ${className}`} role="dialog" aria-modal="true">
        {(title || !noClose) && (
          <div className="modal-head">
            <h2>{title}</h2>
            {headExtra}
            {!noClose && <button type="button" className="btn ghost icon" onClick={onClose} aria-label="close"><X size={20} /></button>}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {busy && stuck && (
          <div className="modal-stuck" role="alert">
            <span>{t('busy.stuck')}</span>
            <button type="button" className="btn sm primary" onClick={() => void restartApp({ ask: true })}><RotateCcw size={15} />{t('boot.restart')}</button>
          </div>
        )}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

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
  className?: string
}

// The Android shell asks the page to handle the back button: close the topmost dialog when one is open.
if (typeof window !== 'undefined' && !window.onPosBack) {
  window.onPosBack = () => {
    if (!document.querySelector('body > .overlay')) return false
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    return true
  }
}

/** Centred dialog on wide screens, bottom sheet on phones. Escape and the backdrop close it. */
export function Modal({ open, onClose, title, children, footer, size = 'normal', full, headExtra, noClose, className = '' }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)
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
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

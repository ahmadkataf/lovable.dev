// Bottom sheet on phones, centered modal on desktop (CSS decides).
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export interface SheetProps { open: boolean; onClose: () => void; title?: string; children: ReactNode }

export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          {title ? <h3 className="sheet-title">{title}</h3> : <span />}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق"><Icon name="x" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

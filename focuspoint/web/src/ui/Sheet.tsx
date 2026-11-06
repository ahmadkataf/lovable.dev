// Bottom sheet on phones, centered modal on desktop (CSS decides).
// Accessibility: on open, focus moves into the sheet, Tab wraps inside it and the app behind is made `inert`
// (so TalkBack/keyboard cannot wander off); on close, focus returns to what opened it.
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export interface SheetProps { open: boolean; onClose: () => void; title?: string; children: ReactNode }

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
let openSheets = 0   // the app root stays inert while any sheet is open

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  // Callers often pass an inline onClose: keep it in a ref so the effect runs only on open/close (not every render,
  // which would yank focus back to the sheet while someone types).
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    if (openSheets++ === 0) root?.setAttribute('inert', '')
    sheetRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return }
      if (e.key !== 'Tab' || !sheetRef.current) return
      const items = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!items.length) { e.preventDefault(); return }
      const first = items[0], last = items[items.length - 1], active = document.activeElement
      if (e.shiftKey && (active === first || active === sheetRef.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (--openSheets === 0) root?.removeAttribute('inert')
      prevFocus?.focus?.()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div ref={sheetRef} tabIndex={-1} style={{ outline: 'none' }} className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
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

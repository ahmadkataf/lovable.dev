import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

// Open dialogs register here so the phone's back button closes the top one instead of leaving the screen.
const openDialogs: (() => void)[] = []
// the page's own scroll setting, kept while any dialog is open (dialogs may close in any order, even together)
let pageOverflow = ''
if (typeof window !== 'undefined') {
  ;(window as any).alradwanBack = () => {
    const top = openDialogs[openDialogs.length - 1]
    if (top) { top(); return true }
    if (location.hash && location.hash !== '#/' && location.hash !== '#') { location.hash = '#/'; return true }
    return false
  }
}

/** How many dialogs are open: a screen's barcode handler stands aside while one is. */
export const dialogDepth = () => openDialogs.length
/** For a component that renders a Modal: whether its dialog is the top one now (nothing opened over it). */
export function useIsTopDialog(): () => boolean {
  const depth = useRef(0)
  // a parent's effect runs after its Modal child registered itself
  useEffect(() => { depth.current = openDialogs.length }, [])
  return useCallback(() => depth.current > 0 && openDialogs.length === depth.current, [])
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ title, onClose, children, footer, size, icon }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'wide' | 'narrow'; icon?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const titleId = useId()
  // the latest onClose through a ref: the dialog registers once, however often its parent re-renders
  const closeRef = useRef(onClose); closeRef.current = onClose
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const close = () => closeRef.current()
    const isTop = () => openDialogs[openDialogs.length - 1] === close
    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return
      if (e.key === 'Escape') { close(); return }
      // Tab stays inside the dialog
      if (e.key === 'Tab' && box.current) {
        const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null)
        if (!items.length) return
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && (document.activeElement === first || !box.current.contains(document.activeElement))) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    if (!openDialogs.length) pageOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    openDialogs.push(close)
    // the first field gets the keyboard, unless something inside asked for it already
    setTimeout(() => { if (box.current && !box.current.contains(document.activeElement)) (box.current.querySelector<HTMLElement>('.modal-body ' + FOCUSABLE) ?? box.current.querySelector<HTMLElement>(FOCUSABLE))?.focus() }, 30)
    return () => {
      window.removeEventListener('keydown', onKey)
      const i = openDialogs.lastIndexOf(close); if (i >= 0) openDialogs.splice(i, 1)
      document.body.style.overflow = openDialogs.length ? 'hidden' : pageOverflow
      opener?.focus?.()
    }
  }, [])
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${size ?? ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box}>
        <div className="modal-head">
          {icon}
          <h2 id={titleId}>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="إغلاق"><X /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

interface ConfirmOpts { title: string; text?: ReactNode; okText?: string; danger?: boolean; cancelText?: string }
type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>
const ConfirmCtx = createContext<ConfirmFn>(async () => false)
export const useConfirm = () => useContext(ConfirmCtx)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const confirm = useCallback<ConfirmFn>(opts => new Promise(resolve => setState({ ...opts, resolve })), [])
  const close = useCallback((v: boolean) => { state?.resolve(v); setState(null) }, [state])
  const value = useMemo(() => confirm, [confirm])
  return (
    <ConfirmCtx.Provider value={value}>
      {children}
      {state && (
        <Modal title={state.title} onClose={() => close(false)} size="narrow" footer={<>
          <button className={`btn ${state.danger ? 'danger' : 'primary'}`} onClick={() => close(true)} autoFocus>{state.okText ?? 'تأكيد'}</button>
          <button className="btn" onClick={() => close(false)}>{state.cancelText ?? 'إلغاء'}</button>
        </>}>
          {state.text && <div>{state.text}</div>}
        </Modal>
      )}
    </ConfirmCtx.Provider>
  )
}

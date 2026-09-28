import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, onClose, children, footer, size, icon }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'wide' | 'narrow'; icon?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${size ?? ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          {icon}
          <h2>{title}</h2>
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

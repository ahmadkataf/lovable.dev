// Toasts: useToast().show() from anywhere; <ToastHost/> mounted once at the root renders them.
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export type ToastKind = 'ok' | 'error' | 'info'
interface Toast { id: number; message: string; kind: ToastKind }

const listeners = new Set<(t: Toast) => void>()
let seq = 0

export function showToast(message: string, kind: ToastKind = 'info') {
  const t: Toast = { id: ++seq, message, kind }
  listeners.forEach((l) => l(t))
}

export function useToast(): { show(message: string, kind?: ToastKind): void } {
  return useMemo(() => ({ show: showToast }), [])
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    const l = (t: Toast) => {
      setItems((x) => [...x.slice(-2), t])
      window.setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), t.kind === 'error' ? 5000 : 3200)
    }
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <Icon name={t.kind === 'ok' ? 'check' : t.kind === 'error' ? 'x' : 'bell'} size={18} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>,
    document.body,
  )
}

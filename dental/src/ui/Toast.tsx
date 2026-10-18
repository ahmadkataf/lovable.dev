import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useTSafe } from '@/i18n'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'
interface Toast { id: number; kind: ToastKind; title: ReactNode; description?: ReactNode }
interface ToastApi {
  toast: (kind: ToastKind, title: ReactNode, description?: ReactNode, ms?: number) => void
  success: (title: ReactNode, description?: ReactNode) => void
  error: (title: ReactNode, description?: ReactNode) => void
  warning: (title: ReactNode, description?: ReactNode) => void
  info: (title: ReactNode, description?: ReactNode) => void
}
const Ctx = createContext<ToastApi | null>(null)
const ICON = { success: CheckCircle2, error: AlertCircle, warning: AlertTriangle, info: Info }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const t = useTSafe()
  const seq = useRef(0)
  const dismiss = useCallback((id: number) => setList(l => l.filter(t => t.id !== id)), [])
  const toast = useCallback((kind: ToastKind, title: ReactNode, description?: ReactNode, ms = kind === 'error' ? 6000 : 3500) => {
    const id = ++seq.current
    setList(l => [...l.slice(-3), { id, kind, title, description }])
    window.setTimeout(() => dismiss(id), ms)
  }, [dismiss])
  const api = useMemo<ToastApi>(() => ({
    toast,
    success: (t, d) => toast('success', t, d), error: (t, d) => toast('error', t, d), warning: (t, d) => toast('warning', t, d), info: (t, d) => toast('info', t, d),
  }), [toast])
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {list.map(item => { const I = ICON[item.kind]; return (
          <div key={item.id} className={`toast toast-${item.kind}`}>
            <I />
            <div className="grow"><div className="toast-title">{item.title}</div>{item.description && <div className="toast-desc">{item.description}</div>}</div>
            <button className="toast-x" onClick={() => dismiss(item.id)} aria-label={t('close')}><X size={16} /></button>
          </div>
        ) })}
      </div>
    </Ctx.Provider>
  )
}
export function useToast(): ToastApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast outside ToastProvider')
  return v
}

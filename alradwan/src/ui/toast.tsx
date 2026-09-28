import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
interface Toast { id: number; text: string; kind: Kind }
interface Ctx { toast: (text: string, kind?: Kind) => void; success: (t: string) => void; error: (t: string) => void }

const ToastCtx = createContext<Ctx>({ toast: () => {}, success: () => {}, error: () => {} })
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const n = useRef(0)
  const toast = useCallback((text: string, kind: Kind = 'info') => {
    const id = ++n.current
    setItems(l => [...l, { id, text, kind }])
    setTimeout(() => setItems(l => l.filter(t => t.id !== id)), kind === 'error' ? 4500 : 2500)
  }, [])
  const value = useMemo<Ctx>(() => ({ toast, success: t => toast(t, 'success'), error: t => toast(t, 'error') }), [toast])
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === 'success' ? <CheckCircle2 /> : t.kind === 'error' ? <AlertCircle /> : <Info />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

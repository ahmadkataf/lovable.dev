import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useStore } from '../../state/store'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { Button } from './Button'
import { Modal } from './Modal'
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export function Badge({ kind, children, className = '' }: { kind?: 'primary' | 'warn' | 'danger' | 'info' | 'accent'; children: ReactNode; className?: string }) {
  return <span className={`badge ${kind ?? ''} ${className}`}>{children}</span>
}

export function Spinner({ small }: { small?: boolean }) { return <span className={`spinner ${small ? 'sm' : ''}`} /> }

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="ico">{icon}</div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

const COLORS = ['#0e9f6e', '#3b6cf6', '#e9a007', '#e5484d', '#8b5cf6', '#0ea5e9', '#f97316', '#14b8a6', '#ec4899', '#64748b']
export function colorFor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}
export function Avatar({ name, color, image, emoji, size = 40, round }: { name: string; color?: string; image?: string; emoji?: string; size?: number; round?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('')
  return (
    <span className={`avatar ${round ? 'round' : ''}`} style={{ width: size, height: size, background: image ? 'transparent' : color ?? colorFor(name), fontSize: size * 0.4 }}>
      {image ? <img src={image} alt="" /> : emoji ? <span style={{ fontSize: size * 0.55 }}>{emoji}</span> : initials}
    </span>
  )
}

/** A money amount, always left-to-right, coloured when asked. */
export function Money({ value, signed, color, className = '', symbol = true }: { value: number; signed?: boolean; color?: boolean; className?: string; symbol?: boolean }) {
  const c = useStore(s => s.settings.currency)
  const cls = `money ${color ? (value > 0 ? 'pos' : value < 0 ? 'neg' : '') : ''} ${className}`
  return <span className={cls}>{formatMoney(value, c, { sign: signed, symbol })}</span>
}

export function useIsMobile(): boolean {
  const [m, setM] = useState(() => window.matchMedia('(max-width: 899px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)')
    const f = (e: MediaQueryListEvent) => setM(e.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return m
}

/** Toasts from the store. Put once in App. */
export function ToastHost() {
  const toasts = useStore(s => s.toasts)
  const dismiss = useStore(s => s.dismissToast)
  if (!toasts.length) return null
  const icons = { success: <CheckCircle2 size={18} />, error: <AlertCircle size={18} />, info: <Info size={18} />, warn: <AlertTriangle size={18} /> }
  return (
    <div className="toasts">
      {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>{icons[t.kind]}<span className="grow">{t.text}</span></div>)}
    </div>
  )
}

/** The confirm() dialog from the store. Put once in App. */
export function ConfirmHost() {
  const req = useStore(s => s.confirmReq)
  const resolve = useStore(s => s.resolveConfirm)
  const t = useT()
  if (!req) return null
  return (
    <Modal open onClose={() => resolve(false)} title={req.title} size="narrow" footer={
      <>
        <Button onClick={() => resolve(false)}>{req.cancelLabel ?? t('common.cancel')}</Button>
        <Button variant={req.danger ? 'danger' : 'primary'} onClick={() => resolve(true)} autoFocus>{req.okLabel ?? t('common.confirm')}</Button>
      </>
    }>
      {req.text && <p className="muted">{req.text}</p>}
    </Modal>
  )
}

// Small, brand-styled building blocks shared by the customer app and the team panel.
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Icon } from './Icon'
import { useOnline } from '../offline'

export type Tone = 'wine' | 'gold' | 'green' | 'grey' | 'red'
const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

// ---- Button ----
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  block?: boolean
}
export function Button({ variant = 'primary', size = 'md', loading = false, block = false, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx('btn', `btn-${variant}`, `btn-${size}`, block && 'btn-block', loading && 'is-loading', className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="spinner spinner-sm" aria-hidden="true" />}
      <span className="btn-label">{children}</span>
    </button>
  )
}

// ---- Card ----
export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={cx('card', padded && 'card-padded', className)}>{children}</div>
}

// ---- Field ----
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className={cx('field', error && 'has-error')}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

// ---- Inputs ----
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx('input', className)} {...rest} />
})
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return <select ref={ref} className={cx('input', 'select', className)} {...rest}>{children}</select>
})
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx('input', 'textarea', className)} {...rest} />
})

// ---- Stepper ----
export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))
  return (
    <div className="stepper" role="group">
      <button type="button" className="stepper-btn" onClick={() => set(value - 1)} disabled={value <= min} aria-label="أقل">−</button>
      <span className="stepper-value" aria-live="polite">{value}</span>
      <button type="button" className="stepper-btn" onClick={() => set(value + 1)} disabled={value >= max} aria-label="أكثر">+</button>
    </div>
  )
}

// ---- Toggle ----
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  )
}

// ---- Badge ----
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cx('badge', `tone-${tone}`)}>{children}</span>
}

// ---- Empty ----
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden="true"><Icon name="calendar" size={28} /></div>
      <h3 className="empty-title">{title}</h3>
      {hint && <p className="muted">{hint}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

// ---- Spinner ----
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return <span className={cx('spinner', size === 'sm' && 'spinner-sm')} role="progressbar" aria-label="جارٍ التحميل" />
}

// ---- Tabs ----
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} className={cx('tab', t.id === value && 'is-active')} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  )
}

// ---- Segmented ----
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={cx('segment', o.value === value && 'is-active')} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

// ---- OfflineBar ----
export function OfflineBar() {
  const online = useOnline()
  if (online) return null
  return (
    <div className="offline-bar" role="status">
      <Icon name="cloudOff" size={16} />
      <span>أنت دون اتصال — سيُحفَظ عملك ويُرسَل عند عودة الإنترنت</span>
    </div>
  )
}

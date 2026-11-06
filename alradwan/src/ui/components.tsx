import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Search, PackageOpen } from 'lucide-react'
import { equiv, money, toNumber } from '../lib/format'
import { useSettings } from '../db/store'

export function Field({ label, children, required, help, className }: { label?: ReactNode; children: ReactNode; required?: boolean; help?: ReactNode; className?: string }) {
  const id = useId()
  // the label points at the control when the child is a bare input/select/textarea
  const only = Children.count(children) === 1 ? Children.toArray(children)[0] : null
  const wired = only && isValidElement(only) && typeof only.type === 'string' && ['input', 'select', 'textarea'].includes(only.type) && !(only.props as { id?: string }).id
  const body = wired ? cloneElement(only as React.ReactElement<{ id?: string }>, { id }) : children
  return (
    <div className={`field ${className ?? ''}`}>
      {label && <label htmlFor={wired ? id : undefined}>{label}{required && <span className="req"> *</span>}</label>}
      {body}
      {help && <div className="help">{help}</div>}
    </div>
  )
}

/** A number box that accepts Arabic digits and thousands separators, and never shows NaN. */
export function NumberInput({ value, onChange, className, placeholder, min, autoFocus, suffix, onEnter, lg, disabled, selectOnFocus = true }: {
  value: number; onChange: (v: number) => void; className?: string; placeholder?: string; min?: number; autoFocus?: boolean; suffix?: string; onEnter?: () => void; lg?: boolean; disabled?: boolean; selectOnFocus?: boolean
}) {
  const [text, setText] = useState(value === 0 ? '' : String(value))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setText(value === 0 ? '' : String(value)) }, [value])
  const input = (
    <input
      className={`input ${lg ? 'lg' : ''} ${className ?? ''}`} inputMode="decimal" dir="ltr" style={{ textAlign: 'right' }}
      value={text} placeholder={placeholder ?? '0'} autoFocus={autoFocus} disabled={disabled}
      onFocus={e => { focused.current = true; if (selectOnFocus) e.target.select() }}
      onBlur={() => { focused.current = false; let n = toNumber(text); if (min !== undefined && n < min) n = min; onChange(n); setText(n === 0 ? '' : String(n)) }}
      onChange={e => { setText(e.target.value); const n = toNumber(e.target.value); onChange(min !== undefined && n < min ? min : n) }}
      onKeyDown={e => { if (e.key === 'Enter' && onEnter) { (e.target as HTMLInputElement).blur(); onEnter() } }}
    />
  )
  if (!suffix) return input
  return <div className="input-wrap">{input}<span className="suffix">{suffix}</span></div>
}

export function SearchInput({ value, onChange, placeholder, autoFocus, onEnter, inputRef, lg }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; onEnter?: (v: string) => void; inputRef?: React.RefObject<HTMLInputElement>; lg?: boolean }) {
  return (
    <div className="input-wrap search">
      <Search />
      <input ref={inputRef} type="search" aria-label={placeholder ?? 'بحث'} className={`input ${lg ? 'lg' : ''}`} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? 'بحث…'} autoFocus={autoFocus}
        onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter(value) }} />
    </div>
  )
}

/** An amount the way the settings say; in "both" mode the other currency sits on a small second line. */
export function Price({ value, rate }: { value: number; rate?: number }) {
  const s = useSettings()
  if (s.display === 'both' && (rate ?? s.rate)) return <span className="price">{money(value, { display: 'base' })}<small>{equiv(value, rate)}</small></span>
  return <>{money(value, { rate })}</>
}

export function Empty({ title, text, icon, action }: { title: string; text?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <PackageOpen />}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action && <div className="mt">{action}</div>}
    </div>
  )
}

export function Stat({ label, value, sub, icon, tone = 'accent', onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; tone?: 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'muted'; onClick?: () => void }) {
  return (
    <div className="card stat" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}>
      <div className={`ic tone-${tone}`}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="lbl">{label}</div>
        <div className="val">{value}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  )
}

export function Badge({ tone, children }: { tone: 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'muted'; children: ReactNode }) {
  return <span className={`badge tone-${tone}`}>{children}</span>
}

export function PayBadge({ status }: { status: 'paid' | 'partial' | 'unpaid' }) {
  if (status === 'paid') return <Badge tone="success">مدفوعة</Badge>
  if (status === 'partial') return <Badge tone="warning">مدفوعة جزئياً</Badge>
  return <Badge tone="danger">غير مدفوعة</Badge>
}

export function Tabs<T extends string>({ value, onChange, items, small }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[]; small?: boolean }) {
  return (
    <div className={`tabs ${small ? 'small' : ''}`} role="tablist">
      {items.map(i => <button key={i.id} role="tab" aria-selected={i.id === value} className={i.id === value ? 'active' : ''} onClick={() => onChange(i.id)}>{i.label}</button>)}
    </div>
  )
}

export function Chips<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[] }) {
  return (
    <div className="chips">
      {items.map(i => <button key={i.id} aria-pressed={i.id === value} className={`chip ${i.id === value ? 'active' : ''}`} onClick={() => onChange(i.id)}>{i.label}</button>)}
    </div>
  )
}

/** Simple bar chart drawn with divs: sales per day, per month… */
export function Bars({ data, format }: { data: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div key={i} className="bar" title={`${d.label}: ${format ? format(d.value) : d.value}`}>
          <i style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  )
}

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <input type="date" aria-label="من تاريخ" className="input" style={{ width: 'auto' }} value={from} onChange={e => onChange(e.target.value, to)} />
      <span className="muted">إلى</span>
      <input type="date" aria-label="إلى تاريخ" className="input" style={{ width: 'auto' }} value={to} onChange={e => onChange(from, e.target.value)} />
    </div>
  )
}

export function usePersistedState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : initial } catch { return initial } })
  return [v, (nv: T) => { setV(nv); try { localStorage.setItem(key, JSON.stringify(nv)) } catch { /* ignore */ } }]
}

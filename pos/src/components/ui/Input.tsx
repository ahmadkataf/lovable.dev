import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'

export interface FieldProps { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string; span2?: boolean }
export function Field({ label, hint, error, children, className = '', span2 }: FieldProps) {
  return (
    <div className={`field ${span2 ? 'span-2' : ''} ${className}`}>
      {label && <label>{label}</label>}
      {children}
      {error ? <span className="error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { invalid?: boolean; ltr?: boolean; start?: ReactNode; end?: ReactNode }
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, ltr, start, end, className = '', ...rest }, ref) {
  const input = <input ref={ref} className={`input ${invalid ? 'invalid' : ''} ${ltr ? 'ltr' : ''} ${className}`} {...rest} />
  if (!start && !end) return input
  return <div className="input-wrap">{start}{input}{end && <div className="input-end">{end}</div>}</div>
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = '', ...rest }, ref) {
  return <textarea ref={ref} className={`textarea ${className}`} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className = '', children, ...rest }, ref) {
  return <select ref={ref} className={`select ${className}`} {...rest}>{children}</select>
})

/** A number field that accepts Arabic digits and shows a clean value. Uses text input mode for a better keyboard. */
export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | ''
  onChange: (n: number) => void
  decimals?: number
  invalid?: boolean
}
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput({ value, onChange, decimals = 2, invalid, className = '', ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={`input ltr ${invalid ? 'invalid' : ''} ${className}`}
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      value={value === '' ? '' : String(value)}
      onChange={e => {
        const raw = e.target.value.replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch))).replace(/[٫,]/g, '.')
        if (raw === '' || raw === '-') { onChange(0); return }
        const n = Number(raw)
        if (Number.isFinite(n)) onChange(n)
      }}
      onFocus={e => e.target.select()}
      {...rest}
    />
  )
})

export function SearchInput({ value, onChange, placeholder, autoFocus, inputRef, onEnter, noWedge, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean
  inputRef?: React.Ref<HTMLInputElement>; onEnter?: (v: string) => void; noWedge?: boolean; className?: string
}) {
  return (
    <div className={`input-wrap ${className}`}>
      <Search size={18} />
      <input
        ref={inputRef}
        className="input"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        data-no-wedge={noWedge ? '' : undefined}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(value) } if (e.key === 'Escape') onChange('') }}
        autoComplete="off"
        spellCheck={false}
      />
      {value && (
        <div className="input-end">
          <button type="button" className="btn ghost icon sm" onClick={() => onChange('')} aria-label="clear"><X size={16} /></button>
        </div>
      )}
    </div>
  )
}

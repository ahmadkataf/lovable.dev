import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Check, X } from 'lucide-react'
import { useTSafe } from '@/i18n'

export interface FieldProps { label?: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode; className?: string; htmlFor?: string }
/** Grid placement classes belong on the field wrapper, not on the <input> inside it. */
function splitGrid(className?: string): [string | undefined, string | undefined] {
  if (!className) return [undefined, undefined]
  const parts = className.split(/\s+/)
  const grid = parts.filter(c => /^span-\d$/.test(c)).join(' ')
  const rest = parts.filter(c => !/^span-\d$/.test(c)).join(' ')
  return [rest || undefined, grid || undefined]
}
export function Field({ label, hint, error, required, children, className, htmlFor }: FieldProps) {
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      {label && <label className="field-label" htmlFor={htmlFor}>{label}{required && <span className="req">*</span>}</label>}
      {children}
      {error ? <div className="field-error" role="alert">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  )
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode; hint?: ReactNode; error?: ReactNode
  iconStart?: ReactNode; iconEnd?: ReactNode; onIconEndClick?: () => void
  size?: 'sm' | 'md' | 'lg'
  invalid?: boolean
  clearable?: boolean
  onClear?: () => void
  /** class for the labelled wrapper (e.g. span-2 in a .form-grid) */
  fieldClassName?: string
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, iconStart, iconEnd, onIconEndClick, size = 'md', invalid, clearable, onClear, className: cls, fieldClassName, required, id, ...rest }, ref) {
  const [className, gridCls] = splitGrid(cls)
  const auto = useId(); const inputId = id || auto
  const t = useTSafe()
  const showClear = clearable && rest.value !== undefined && String(rest.value).length > 0
  const control = (
    <div className="control">
      {iconStart && <span className="icon-start">{iconStart}</span>}
      <input ref={ref} id={inputId} required={required} className={['input', size !== 'md' && `input-${size}`, iconStart && 'has-start', (iconEnd || showClear) && 'has-end', (invalid || error) && 'invalid', className].filter(Boolean).join(' ')} {...rest} />
      {showClear ? <button type="button" className="icon-end clickable" onClick={onClear} aria-label={t('clear')} title={t('clear')}><X /></button>
        : iconEnd ? (onIconEndClick ? <button type="button" className="icon-end clickable" onClick={onIconEndClick}>{iconEnd}</button> : <span className="icon-end">{iconEnd}</span>) : null}
    </div>
  )
  if (!label && !hint && !error) return control
  return <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={[gridCls, fieldClassName].filter(Boolean).join(' ') || undefined}>{control}</Field>
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: ReactNode; hint?: ReactNode; error?: ReactNode; invalid?: boolean; fieldClassName?: string }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, invalid, className: cls, fieldClassName, required, id, ...rest }, ref) {
  const [className, gridCls] = splitGrid(cls)
  const auto = useId(); const tid = id || auto
  const el = <textarea ref={ref} id={tid} required={required} className={['textarea', (invalid || error) && 'invalid', className].filter(Boolean).join(' ')} {...rest} />
  if (!label && !hint && !error) return el
  return <Field label={label} hint={hint} error={error} required={required} htmlFor={tid} className={[gridCls, fieldClassName].filter(Boolean).join(' ') || undefined}>{el}</Field>
})

export interface SelectOption { value: string; label: ReactNode; disabled?: boolean }
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode; hint?: ReactNode; error?: ReactNode; invalid?: boolean; size?: 'sm' | 'md' | 'lg'
  options?: SelectOption[]; placeholder?: string
  fieldClassName?: string
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, hint, error, invalid, size = 'md', options, placeholder, className: cls, fieldClassName, required, id, children, ...rest }, ref) {
  const [className, gridCls] = splitGrid(cls)
  const auto = useId(); const sid = id || auto
  const el = (
    <select ref={ref} id={sid} required={required} className={['select', size !== 'md' && `input-${size}`, (invalid || error) && 'invalid', className].filter(Boolean).join(' ')} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options?.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label as any}</option>)}
      {children}
    </select>
  )
  if (!label && !hint && !error) return el
  return <Field label={label} hint={hint} error={error} required={required} htmlFor={sid} className={[gridCls, fieldClassName].filter(Boolean).join(' ') || undefined}>{el}</Field>
})

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return <label className={['check', className].filter(Boolean).join(' ')}><input type="checkbox" {...rest} /><span className="box"><Check /></span>{label && <span>{label}</span>}</label>
}
export function Radio({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return <label className={['check radio', className].filter(Boolean).join(' ')}><input type="radio" {...rest} /><span className="box" />{label && <span>{label}</span>}</label>
}
export function Switch({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return <label className={['switch', className].filter(Boolean).join(' ')}><input type="checkbox" {...rest} /><span className="track" />{label && <span>{label}</span>}</label>
}

export interface SegmentedProps<T extends string> { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: ReactNode }[]; block?: boolean; className?: string }
export function Segmented<T extends string>({ value, onChange, options, block, className }: SegmentedProps<T>) {
  return (
    <div className={['segmented', block && 'block', className].filter(Boolean).join(' ')} role="tablist">
      {options.map(o => <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>{o.icon}{o.label}</button>)}
    </div>
  )
}

export function Chip({ active, onClick, onRemove, children, icon, className }: { active?: boolean; onClick?: () => void; onRemove?: () => void; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <button type="button" className={['chip', active && 'active', className].filter(Boolean).join(' ')} onClick={onClick}>
      {icon}{children}
      {onRemove && <span className="x" onClick={e => { e.stopPropagation(); onRemove() }}><X /></span>}
    </button>
  )
}

/** Number input that keeps '' while typing and reports a number (or null) upward. */
export interface NumberInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> { value: number | null | undefined; onChange: (n: number | null) => void; decimals?: number; addon?: ReactNode }
export function NumberInput({ value, onChange, decimals = 2, addon, label, hint, error, required, ...rest }: NumberInputProps) {
  const auto = useId(); const nid = rest.id || auto
  // with an addon the label must sit above the group, not inside it
  const inner = addon ? { id: nid, required, invalid: !!error || rest.invalid } : { label, hint, error, required, id: nid }
  const input = (
    <Input type="number" inputMode="decimal" step={decimals ? 1 / Math.pow(10, decimals) : 1} dir="ltr" value={value === null || value === undefined || Number.isNaN(value) ? '' : value}
      onChange={e => { const v = e.target.value; if (v === '') onChange(null); else { const n = Number(v); if (!Number.isNaN(n)) onChange(n) } }}
      onFocus={e => e.target.select()} {...rest} {...inner} />
  )
  if (!addon) return input
  // the addon sits on the reading-end side of the number
  const group = <div className="input-group">{input}<span className="input-addon">{addon}</span></div>
  if (!label && !hint && !error) return group
  return <Field label={label} hint={hint} error={error} required={required} htmlFor={nid}>{group}</Field>
}

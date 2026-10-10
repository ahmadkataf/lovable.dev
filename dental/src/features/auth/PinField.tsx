import { useState, type ReactNode } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { Input } from '@/ui'
import { useI18n } from '@/i18n'
import { PIN_MAX, sanitizePin } from './lib'
import './auth.css'

/** A numeric PIN input shown as dots, with a show/hide toggle. Keeps digits only (Arabic-Indic digits are converted). */
export function PinField({ label, hint, error, value, onChange, required, autoFocus, id }: {
  label: ReactNode; hint?: ReactNode; error?: ReactNode; value: string; onChange: (v: string) => void; required?: boolean; autoFocus?: boolean; id?: string
}) {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  return (
    <Input
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      autoFocus={autoFocus}
      value={value}
      onChange={e => onChange(sanitizePin(e.target.value))}
      type={show ? 'text' : 'password'}
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="new-password"
      maxLength={PIN_MAX}
      dir="ltr"
      className="au-pin-input"
      placeholder="••••"
      aria-label={typeof label === 'string' ? label : undefined}
      title={show ? t('auth.pin.hide') : t('auth.pin.show')}
      iconStart={<KeyRound />}
      iconEnd={show ? <EyeOff /> : <Eye />}
      onIconEndClick={() => setShow(s => !s)}
    />
  )
}

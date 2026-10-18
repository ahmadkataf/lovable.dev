// A labelled number box with an optional unit/currency addon on its end side. Wraps the kit's NumberInput so the
// label sits above the group (not beside it) and the digits follow the reading direction (values here are never negative).
import { useId, type ReactNode } from 'react'
import { Field, NumberInput, type NumberInputProps } from '@/ui'
import { useI18n } from '@/i18n'
import './fields.css'

export function NumberField({ label, hint, error, required, addon, className, id, ...rest }: Omit<NumberInputProps, 'addon'> & { addon?: ReactNode }) {
  const { dir } = useI18n()
  const auto = useId()
  const inputId = id || auto
  const input = <NumberInput id={inputId} dir={dir} invalid={!!error || rest.invalid} required={required} {...rest} />
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId} className={className}>
      {addon ? <div className="input-group inv-addon-group">{input}<span className="input-addon">{addon}</span></div> : input}
    </Field>
  )
}

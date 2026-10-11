import { Delete } from 'lucide-react'
import { useI18n } from '@/i18n'
import { dotCount } from './lib'

/** The PIN dots: filled for typed digits, red and shaking after a wrong attempt (shake = attempt counter). */
export function PinDots({ length, error, shake }: { length: number; error?: boolean; shake: number }) {
  const { t } = useI18n()
  const n = dotCount(length)
  return (
    <div key={shake} className={['pin-dots', error && 'au-dots-error', shake > 0 && 'au-shake'].filter(Boolean).join(' ')} role="status" aria-label={t('auth.login.dotsLabel', { n: length })}>
      {Array.from({ length: n }, (_, i) => <span key={i} className={i < length ? 'on' : ''} />)}
    </div>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** 3×4 keypad: digits, a clear key and backspace. Digits stay in phone-keypad order in both directions. */
export function PinPad({ onDigit, onBack, onClear, disabled }: { onDigit: (d: string) => void; onBack: () => void; onClear: () => void; disabled?: boolean }) {
  const { t } = useI18n()
  return (
    <div className="pin-pad au-pad" dir="ltr">
      {KEYS.map(k => <button key={k} type="button" className="num" disabled={disabled} onClick={() => onDigit(k)}>{k}</button>)}
      <button type="button" className="au-key-text" disabled={disabled} onClick={onClear} dir="auto">{t('auth.login.keyClear')}</button>
      <button type="button" className="num" disabled={disabled} onClick={() => onDigit('0')}>0</button>
      <button type="button" className="au-key-back" disabled={disabled} onClick={onBack} aria-label={t('auth.login.keyBack')} title={t('auth.login.keyBack')}><Delete /></button>
    </div>
  )
}

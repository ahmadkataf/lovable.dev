// The currency picker used by the settings page and the onboarding wizard.
import { AlertTriangle } from 'lucide-react'
import { CURRENCIES, type CurrencySettings } from '../../db/types'
import { useT } from '../../i18n'
import { Field, Input, Select, Seg } from '../../components/ui'
import { formatMoney } from '../../lib/money'

export const CUSTOM_CODE = 'custom'

/** The preset that matches a currency exactly, if any. */
export function matchingPreset(c: CurrencySettings): CurrencySettings | undefined {
  return CURRENCIES.find(p => p.code === c.code && p.symbol === c.symbol && p.decimals === c.decimals && p.symbolAfter === c.symbolAfter)
}

export function CurrencyPicker({ value, onChange, savedDecimals, error }: {
  value: CurrencySettings
  onChange: (c: CurrencySettings) => void
  /** When given, a warning shows while the decimals differ from what is saved. */
  savedDecimals?: number
  error?: string
}) {
  const t = useT()
  const preset = matchingPreset(value)
  const selected = preset ? preset.code : CUSTOM_CODE
  const pick = (code: string) => {
    if (code === CUSTOM_CODE) { onChange({ ...value, code: CUSTOM_CODE }); return }
    const p = CURRENCIES.find(c => c.code === code)
    if (p) onChange({ ...p })
  }
  const set = (patch: Partial<CurrencySettings>) => onChange({ ...value, ...patch })

  return (
    <div className="col" style={{ gap: 14 }}>
      <Field label={t('settings.currency.pick')}>
        <Select value={selected} onChange={e => pick(e.target.value)}>
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{t(`settings.cur.${c.code}`)} ({c.symbol})</option>)}
          <option value={CUSTOM_CODE}>{t('settings.currency.custom')}</option>
        </Select>
      </Field>
      <div className="form-grid">
        <Field label={t('settings.currency.symbol')} error={error}>
          <Input value={value.symbol} onChange={e => set({ symbol: e.target.value })} placeholder={t('settings.currency.symbolPh')} maxLength={8} invalid={!!error} />
        </Field>
        <Field label={t('settings.currency.decimals')}>
          <Seg<'0' | '1' | '2' | '3'> block value={String(value.decimals) as '0' | '1' | '2' | '3'} onChange={v => set({ decimals: Number(v) })}
            options={[{ value: '0', label: <span className="num">0</span> }, { value: '1', label: <span className="num">1</span> }, { value: '2', label: <span className="num">2</span> }, { value: '3', label: <span className="num">3</span> }]} />
        </Field>
        <Field label={t('settings.currency.position')} span2>
          <Seg<'after' | 'before'> block value={value.symbolAfter ? 'after' : 'before'} onChange={v => set({ symbolAfter: v === 'after' })}
            options={[{ value: 'after', label: t('settings.currency.after') }, { value: 'before', label: t('settings.currency.before') }]} />
        </Field>
      </div>
      <div className="currency-preview">
        <span className="small muted bold">{t('settings.currency.preview')}</span>
        <span className="val money">{formatMoney(1234.5, { ...value, symbol: value.symbol || '¤' })}</span>
      </div>
      {savedDecimals !== undefined && savedDecimals !== value.decimals && (
        <div className="settings-note warn"><AlertTriangle size={16} /><span>{t('settings.currency.decimalsWarn')}</span></div>
      )}
    </div>
  )
}

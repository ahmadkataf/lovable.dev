import { Coins, ArrowLeftRight } from 'lucide-react'
import { useStore } from '../../../state/store'
import { useT } from '../../../i18n'
import { CURRENCIES, type CurrencySettings, type SecondCurrency } from '../../../db/types'
import { useDraft, SaveBar, SectionCard, Note } from '../shared'
import { CurrencyPicker } from '../CurrencyPicker'
import { Field, Input, NumberInput, Select, SwitchRow } from '../../../components/ui'
import { formatMoney, toSecondary } from '../../../lib/money'

export default function CurrencySection() {
  const t = useT()
  const currency = useStore(s => s.settings.currency)
  const currency2 = useStore(s => s.settings.currency2)
  const updateSettings = useStore(s => s.updateSettings)
  const d = useDraft<CurrencySettings>(
    currency,
    async draft => updateSettings({ currency: { ...draft, symbol: draft.symbol.trim() } }),
    draft => (draft.symbol.trim() ? null : t('settings.currency.symbolRequired')),
  )
  const d2 = useDraft<SecondCurrency>(
    currency2,
    async draft => updateSettings({ currency2: { ...draft, symbol: draft.symbol.trim() || draft.code } }),
    draft => (draft.enabled && !(draft.rate > 0) ? t('settings.currency2.rateRequired') : null),
  )
  const c2 = d2.draft
  const pick2 = (code: string) => {
    const p = CURRENCIES.find(c => c.code === code)
    d2.setDraft(p ? { ...c2, ...p } : { ...c2, code })
  }
  const sample = 10
  return (
    <>
      <SectionCard title={t('settings.sec.currency')} icon={<Coins size={16} />}>
        <CurrencyPicker value={d.draft} onChange={c => d.setDraft(c)} savedDecimals={currency.decimals} error={d.error ?? undefined} />
      </SectionCard>

      <SectionCard title={t('settings.currency2.title')} icon={<ArrowLeftRight size={16} />}>
        <p className="small muted">{t('settings.currency2.desc')}</p>
        <SwitchRow label={t('settings.currency2.enable')} on={c2.enabled} onChange={v => d2.setDraft({ ...c2, enabled: v })} />
        {c2.enabled && (
          <div className="col" style={{ gap: 14 }}>
            <div className="form-grid">
              <Field label={t('settings.currency2.pick')}>
                <Select value={CURRENCIES.some(c => c.code === c2.code) ? c2.code : 'custom'} onChange={e => pick2(e.target.value)}>
                  {CURRENCIES.filter(c => c.code !== d.draft.code).map(c => <option key={c.code} value={c.code}>{t(`settings.cur.${c.code}`)} ({c.symbol})</option>)}
                  <option value="custom">{t('settings.currency.custom')}</option>
                </Select>
              </Field>
              <Field label={t('settings.currency.symbol')}>
                <Input value={c2.symbol} onChange={e => d2.setDraft({ ...c2, symbol: e.target.value })} maxLength={8} />
              </Field>
              <Field label={t('settings.currency2.rate', { cur: c2.symbol || c2.code, main: d.draft.symbol })} error={d2.error ?? undefined} span2>
                <NumberInput value={c2.rate || ''} onChange={n => d2.setDraft({ ...c2, rate: n })} decimals={d.draft.decimals > 0 ? 4 : 2} placeholder="0" invalid={!!d2.error} />
              </Field>
            </div>
            {c2.rate > 0 && (
              <div className="currency-preview">
                <span className="small muted bold">{t('settings.currency.preview')}</span>
                <span className="val money">{formatMoney(sample, c2)} = {formatMoney(sample * c2.rate, d.draft)} · {formatMoney(1234.5 * (d.draft.decimals ? 1 : 100), d.draft)} ≈ {formatMoney(toSecondary(1234.5 * (d.draft.decimals ? 1 : 100), c2.rate, c2.decimals), c2)}</span>
              </div>
            )}
            <Note kind="info">{t('settings.currency2.note')}</Note>
          </div>
        )}
      </SectionCard>
      <SaveBar dirty={d.dirty || d2.dirty} saving={d.saving || d2.saving} onSave={() => { if (d.dirty) void d.save(); if (d2.dirty) void d2.save() }} onReset={() => { d.reset(); d2.reset() }} />
    </>
  )
}

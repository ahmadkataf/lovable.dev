import { Percent } from 'lucide-react'
import { useStore } from '../../../state/store'
import { useT } from '../../../i18n'
import { Field, Input, NumberInput, Seg, SwitchRow } from '../../../components/ui'
import type { TaxSettings } from '../../../db/types'
import { formatMoney, round } from '../../../lib/money'
import { useDraft, SaveBar, SectionCard, Note } from '../shared'

export default function TaxSection() {
  const t = useT()
  const tax = useStore(s => s.settings.tax)
  const currency = useStore(s => s.settings.currency)
  const updateSettings = useStore(s => s.updateSettings)
  const d = useDraft<TaxSettings>(
    tax,
    async draft => updateSettings({ tax: { ...draft, rate: round(draft.rate, 3), label: draft.label.trim() || t('common.tax') } }),
    draft => (draft.rate < 0 || draft.rate > 100 ? t('settings.tax.rateRange') : null),
  )
  const dec = currency.decimals
  const price = dec === 0 ? 100000 : 100
  const taxAmt = d.draft.inclusive ? round(price - price / (1 + d.draft.rate / 100), dec) : round(price * d.draft.rate / 100, dec)
  const total = d.draft.inclusive ? price : round(price + taxAmt, dec)
  const rateBad = d.draft.rate < 0 || d.draft.rate > 100

  return (
    <>
      <SectionCard title={t('settings.sec.tax')} icon={<Percent size={16} />}>
        <SwitchRow label={t('settings.tax.enabled')} desc={t('settings.tax.enabledDesc')} on={d.draft.enabled} onChange={v => d.patch({ enabled: v })} />
        <div className="form-grid">
          <Field label={t('settings.tax.rate')} error={rateBad ? t('settings.tax.rateRange') : undefined}>
            <NumberInput value={d.draft.rate} onChange={n => d.patch({ rate: n })} decimals={2} invalid={rateBad} disabled={!d.draft.enabled} />
          </Field>
          <Field label={t('settings.tax.label')}>
            <Input value={d.draft.label} onChange={e => d.patch({ label: e.target.value })} placeholder={t('settings.tax.labelPh')} maxLength={30} disabled={!d.draft.enabled} />
          </Field>
          <Field label={t('settings.tax.mode')} hint={d.draft.inclusive ? t('settings.tax.inclusiveDesc') : t('settings.tax.exclusiveDesc')} span2>
            <Seg<'inclusive' | 'exclusive'> block value={d.draft.inclusive ? 'inclusive' : 'exclusive'} onChange={v => d.patch({ inclusive: v === 'inclusive' })}
              options={[{ value: 'inclusive', label: t('settings.tax.inclusive') }, { value: 'exclusive', label: t('settings.tax.exclusive') }]} />
          </Field>
        </div>
        {d.draft.enabled && !rateBad && (
          <div className="tax-example">{t('settings.tax.example', { price: formatMoney(price, currency), tax: formatMoney(taxAmt, currency), total: formatMoney(total, currency) })}</div>
        )}
        <Note>{t('settings.tax.perProduct')}</Note>
      </SectionCard>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => void d.save()} onReset={d.reset} />
    </>
  )
}

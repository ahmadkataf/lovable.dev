import { Coins } from 'lucide-react'
import { useStore } from '../../../state/store'
import { useT } from '../../../i18n'
import type { CurrencySettings } from '../../../db/types'
import { useDraft, SaveBar, SectionCard } from '../shared'
import { CurrencyPicker } from '../CurrencyPicker'

export default function CurrencySection() {
  const t = useT()
  const currency = useStore(s => s.settings.currency)
  const updateSettings = useStore(s => s.updateSettings)
  const d = useDraft<CurrencySettings>(
    currency,
    async draft => updateSettings({ currency: { ...draft, symbol: draft.symbol.trim() } }),
    draft => (draft.symbol.trim() ? null : t('settings.currency.symbolRequired')),
  )
  return (
    <>
      <SectionCard title={t('settings.sec.currency')} icon={<Coins size={16} />}>
        <CurrencyPicker value={d.draft} onChange={c => d.setDraft(c)} savedDecimals={currency.decimals} error={d.error ?? undefined} />
      </SectionCard>
      <SaveBar dirty={d.dirty} saving={d.saving} onSave={() => void d.save()} onReset={d.reset} />
    </>
  )
}

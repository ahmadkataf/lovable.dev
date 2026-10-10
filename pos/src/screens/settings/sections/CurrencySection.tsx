// The main currency and the second one: payments in it, and (optionally) products priced in it with lira prices
// derived from a daily rate. The rate itself is written ONLY through useStore.setExchangeRate (reprice + history +
// audit); the other fields go through updateSettings, followed by a reprice when the rounding rules changed.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Coins, ArrowLeftRight, History } from 'lucide-react'
import { db } from '../../../db'
import { useStore, confirmDialog } from '../../../state/store'
import { useT } from '../../../i18n'
import { CURRENCIES, hasFxAnchor, type CurrencySettings, type SecondCurrency } from '../../../db/types'
import { useDraft, SaveBar, SectionCard, Note } from '../shared'
import { CurrencyPicker } from '../CurrencyPicker'
import { Field, Input, NumberInput, Select, SwitchRow, Seg, Badge } from '../../../components/ui'
import { formatMoney, formatNumber, round, toSecondary } from '../../../lib/money'
import { formatDateTime } from '../../../lib/format'
import { formatRate, fxToPrimary, loadRateHistory, repriceAll } from '../../../lib/fx'

const ROUND_STEPS = [0, 10, 50, 100, 500, 1000]

export default function CurrencySection() {
  const t = useT()
  const currency = useStore(s => s.settings.currency)
  const currency2 = useStore(s => s.settings.currency2)
  const updateSettings = useStore(s => s.updateSettings)
  const setExchangeRate = useStore(s => s.setExchangeRate)
  const anchored = useLiveQuery(() => db.products.filter(p => hasFxAnchor(p)).count(), [], 0)
  const history = useLiveQuery(() => loadRateHistory(), [], [])

  /** Rewrites the anchored products when the rounding rules (or the primary decimals) changed under an unchanged rate. */
  const repriceIfNeeded = async (before: { roundTo: number; roundMode: string; pricing: boolean; enabled: boolean; decimals: number }) => {
    const s = useStore.getState().settings
    const c2 = s.currency2
    if (!c2.enabled || !c2.pricing || !(c2.rate > 0)) return
    const changed = before.roundTo !== c2.roundTo || before.roundMode !== c2.roundMode || !before.pricing || !before.enabled || before.decimals !== s.currency.decimals
    if (!changed) return
    await repriceAll(c2, s.currency.decimals)
    await useStore.getState().refreshCartPrices()
  }
  const snapshot = () => {
    const s = useStore.getState().settings
    return { roundTo: s.currency2.roundTo, roundMode: s.currency2.roundMode, pricing: s.currency2.pricing, enabled: s.currency2.enabled, decimals: s.currency.decimals }
  }

  const d = useDraft<CurrencySettings>(
    currency,
    async draft => {
      const before = snapshot()
      await updateSettings({ currency: { ...draft, symbol: draft.symbol.trim() } })
      await repriceIfNeeded(before)
    },
    draft => (draft.symbol.trim() ? null : t('settings.currency.symbolRequired')),
  )
  const d2 = useDraft<SecondCurrency>(
    currency2,
    async draft => {
      const before = snapshot()
      const prevRate = useStore.getState().settings.currency2.rate
      // the rate and its stamps never travel through updateSettings: setExchangeRate owns them
      const { rate, rateUpdatedAt: _at, rateUpdatedBy: _by, ...rest } = draft
      await updateSettings({ currency2: { ...rest, symbol: rest.symbol.trim() || rest.code } })
      if (rate > 0 && rate !== prevRate) await setExchangeRate(rate, 'settings')
      else await repriceIfNeeded(before)
    },
    draft => {
      if (draft.enabled && !(draft.rate > 0)) return t('settings.currency2.rateRequired')
      if (draft.code !== currency2.code && anchored > 0) return t('settings.currency2.codeLocked', { n: anchored, cur: currency2.symbol || currency2.code, main: currency.symbol })
      return null
    },
  )
  const c2 = d2.draft
  const pick2 = (code: string) => {
    const p = CURRENCIES.find(c => c.code === code)
    d2.setDraft(p ? { ...c2, ...p } : { ...c2, code })
  }
  const sample = 10
  const rateDecimals = d.draft.decimals > 0 ? 4 : 2
  const pricingAllowed = c2.enabled && c2.rate > 0
  const exampleFx = useMemo(() => {
    if (!(c2.rate > 0)) return null
    const fx = c2.decimals > 0 ? 9.99 : 10
    const raw = round(fx * c2.rate, d.draft.decimals)
    return { fx: formatMoney(fx, c2), raw: formatMoney(raw, d.draft), rounded: formatMoney(fxToPrimary(fx, c2, d.draft.decimals, 'price'), d.draft) }
  }, [c2, d.draft])

  const onSave = async () => {
    const turningOff = anchored > 0 && ((currency2.enabled && !c2.enabled) || (currency2.pricing && !c2.pricing))
    if (turningOff && !(await confirmDialog({ title: t('settings.currency2.disableWarn', { n: anchored }), text: t('settings.currency2.disableWarnText'), okLabel: t('common.confirm') }))) return
    if (d.dirty && !(await d.save())) return
    if (d2.dirty) await d2.save()
  }

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
              <Field label={t('settings.currency2.pick')} error={d2.error && c2.code !== currency2.code ? d2.error : undefined}>
                <Select value={CURRENCIES.some(c => c.code === c2.code) ? c2.code : 'custom'} onChange={e => pick2(e.target.value)}>
                  {CURRENCIES.filter(c => c.code !== d.draft.code).map(c => <option key={c.code} value={c.code}>{t(`settings.cur.${c.code}`)} ({c.symbol})</option>)}
                  <option value="custom">{t('settings.currency.custom')}</option>
                </Select>
              </Field>
              <Field label={t('settings.currency.symbol')}>
                <Input value={c2.symbol} onChange={e => d2.setDraft({ ...c2, symbol: e.target.value })} maxLength={8} />
              </Field>
              <Field label={t('settings.currency2.rate', { cur: c2.symbol || c2.code, main: d.draft.symbol })} error={d2.error && c2.code === currency2.code ? d2.error : undefined} span2
                hint={currency2.rateUpdatedAt ? t('settings.currency2.lastUpdated', { when: formatDateTime(currency2.rateUpdatedAt), who: currency2.rateUpdatedBy ?? '' }).replace(/ · $/, '') : undefined}>
                <NumberInput value={c2.rate || ''} onChange={n => d2.setDraft({ ...c2, rate: n })} decimals={rateDecimals} placeholder="0" invalid={!!d2.error && !(c2.rate > 0)} />
              </Field>
            </div>
            {c2.rate > 0 && (
              <div className="currency-preview">
                <span className="small muted bold">{t('settings.currency.preview')}</span>
                <span className="val money">{formatMoney(sample, c2)} = {formatMoney(sample * c2.rate, d.draft)} · {formatMoney(1234.5 * (d.draft.decimals ? 1 : 100), d.draft)} ≈ {formatMoney(toSecondary(1234.5 * (d.draft.decimals ? 1 : 100), c2.rate, c2.decimals), c2)}</span>
              </div>
            )}
            <Note kind="info">{t('settings.currency2.note')}</Note>

            <SwitchRow label={t('settings.currency2.pricing')} desc={t('settings.currency2.pricingDesc', { cur: c2.symbol || c2.code })} on={c2.pricing && pricingAllowed} disabled={!pricingAllowed} onChange={v => d2.setDraft({ ...c2, pricing: v })} />
            {anchored > 0 && <Badge kind="info" className="num">{t('settings.currency2.anchored', { n: anchored, cur: c2.symbol || c2.code })}</Badge>}
            {c2.pricing && pricingAllowed && (
              <div className="col" style={{ gap: 12 }}>
                <div className="form-grid">
                  <Field label={t('settings.currency2.roundTo')}>
                    <Select value={String(ROUND_STEPS.includes(c2.roundTo) ? c2.roundTo : 100)} onChange={e => d2.setDraft({ ...c2, roundTo: Number(e.target.value) })}>
                      {ROUND_STEPS.map(n => <option key={n} value={n}>{n === 0 ? t('settings.currency2.roundNone') : formatNumber(n)}</option>)}
                    </Select>
                  </Field>
                  <Field label={t('settings.currency2.roundModeLabel')} hint={exampleFx ? t('settings.currency2.roundExample', exampleFx) : undefined}>
                    <Seg block value={c2.roundMode} onChange={m => d2.setDraft({ ...c2, roundMode: m })} options={[{ value: 'nearest', label: t('settings.currency2.roundMode.nearest') }, { value: 'up', label: t('settings.currency2.roundMode.up') }]} />
                  </Field>
                  <Field label={t('settings.currency2.newProductsIn')} span2>
                    <Seg value={c2.newProductsIn} onChange={m => d2.setDraft({ ...c2, newProductsIn: m })} options={[{ value: 'primary', label: d.draft.symbol }, { value: 'secondary', label: c2.symbol || c2.code }]} />
                  </Field>
                  <Field label={t('settings.currency2.staleAfterDays')} hint={t('settings.currency2.staleHint')}>
                    <NumberInput value={c2.staleAfterDays} onChange={n => d2.setDraft({ ...c2, staleAfterDays: Math.max(0, Math.min(90, Math.round(n))) })} decimals={0} />
                  </Field>
                </div>
                <SwitchRow label={t('settings.currency2.askOnOpen')} on={c2.askOnOpen} onChange={v => d2.setDraft({ ...c2, askOnOpen: v })} />
                <SwitchRow label={t('settings.currency2.showOnReceipt', { cur: c2.symbol || c2.code })} on={c2.showOnReceipt} onChange={v => d2.setDraft({ ...c2, showOnReceipt: v })} />
              </div>
            )}

            {history.length > 0 && (
              <div className="col" style={{ gap: 6 }}>
                <div className="small muted bold row" style={{ gap: 6 }}><History size={14} /> {t('settings.currency2.history')}</div>
                <div className="list card flat">
                  {history.slice(0, 30).map(h => {
                    const pct = h.prev > 0 ? round(((h.rate - h.prev) / h.prev) * 100, 1) : 0
                    return (
                      <div key={h.at} className="list-row">
                        <div className="grow">
                          <div className="title num" dir="ltr">1 {currency2.symbol} = {formatRate(h.rate, { currency })}</div>
                          <div className="sub"><span className="num">{formatDateTime(h.at)}</span>{h.userName ? ` · ${h.userName}` : ''}{h.repriced > 0 ? ` · ${t('settings.currency2.repriced', { n: h.repriced })}` : ''}</div>
                        </div>
                        {h.prev > 0 && pct !== 0 && <Badge kind={Math.abs(pct) >= 25 ? 'danger' : undefined} className="num">{pct > 0 ? '+' : ''}{formatNumber(pct, 1, { trim: true })}%</Badge>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>
      <SaveBar dirty={d.dirty || d2.dirty} saving={d.saving || d2.saving} onSave={() => void onSave()} onReset={() => { d.reset(); d2.reset() }} />
    </>
  )
}

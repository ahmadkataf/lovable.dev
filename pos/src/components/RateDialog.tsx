// The daily exchange rate: the dialog that sets it (big keypad, delta, a preview of three repriced products, typo
// guards), the top-bar chip that shows it with its age, and the small helpers the Shell and the sales screen share.
// Every rate write goes through useStore.setExchangeRate (lib/fx): products are repriced, history and audit written.
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Check, TriangleAlert } from 'lucide-react'
import { db } from '../db'
import { hasFxAnchor, isFxPriced, type Product, type SecondCurrency } from '../db/types'
import { derivePrices, formatRate, isRateStale, rateAge, FX_PROMPTED_KEY } from '../lib/fx'
import { formatMoney, formatNumber, parseNumber, round } from '../lib/money'
import { formatDateTime, toDateInput } from '../lib/format'
import { allowed } from '../lib/audit'
import { useT, t as tt } from '../i18n'
import { useStore, toast } from '../state/store'
import { Modal, Button, NumPad, SwitchRow, Badge } from './ui'
import { useNumKeys } from '../screens/sales/dialogs'

/** Whether the rate UI (chip, prompt, F6) applies at all: products are priced in the second currency. */
export const ratePricingOn = (c2: Pick<SecondCurrency, 'enabled' | 'pricing'>): boolean => c2.enabled && c2.pricing

/** The age of the rate as the chip shows it, refreshed every minute so "today" turns into "1 day ago" at midnight. */
export function useRateAge(c2: Pick<SecondCurrency, 'rateUpdatedAt' | 'pricing' | 'staleAfterDays'>): { days: number; updatedToday: boolean; stale: boolean; label: string; kind: 'warn' | 'danger' | undefined } {
  const t = useT()
  const [, setTick] = useState(0)
  useEffect(() => { const id = window.setInterval(() => setTick(x => x + 1), 60000); return () => clearInterval(id) }, [])
  const age = rateAge(c2)
  const stale = isRateStale(c2)
  const label = !Number.isFinite(age.days) ? t('fx.never') : age.updatedToday ? t('fx.today') : t('fx.daysAgo', { n: age.days })
  return { ...age, stale, label, kind: stale ? 'danger' : age.updatedToday ? undefined : 'warn' }
}

/** Writes today's date as the "prompted" marker so the morning prompt does not come back before tomorrow. */
export async function markRatePrompted(): Promise<void> {
  try { await db.kv.put({ key: FX_PROMPTED_KEY, value: toDateInput(Date.now()) }) } catch { /* ignore */ }
}

/** "1 $ = 13,000 · اليوم" in the top bar; amber from day one, red when stale. */
export function RateChip({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  const t = useT()
  const settings = useStore(s => s.settings)
  const c2 = settings.currency2
  const age = useRateAge(c2)
  return (
    <button type="button" className={`rate-chip ${age.kind ?? ''} ${className}`} onClick={onClick} title={t('fx.title')}>
      <ArrowLeftRight size={13} />
      <span className="num" dir="ltr">1 {c2.symbol} = {c2.rate > 0 ? formatRate(c2.rate, settings) : '—'}</span>
      <span className="age">· {age.label}</span>
    </button>
  )
}

/** Whether the current user may change the rate; when not, says so in a toast. For the entry points (chip, F6, prompt). */
export function canChangeRate(): boolean {
  const { user, settings } = useStore.getState()
  if (allowed(user, settings, 'cashierChangeRate')) return true
  toast(tt('common.noPermission'), 'warn')
  return false
}

interface Sample { p: Product; before: number }

/** "14000.5" → "14,000.5": the typed digits with thousands separators, the fraction left as typed. */
function groupTyped(v: string): string {
  const [int, frac] = v.split('.')
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac !== undefined ? '.' + frac : '')
}

export function RateDialog({ onClose, prompt }: { onClose: () => void; prompt?: boolean }) {
  const t = useT()
  const settings = useStore(s => s.settings)
  const cart = useStore(s => s.cart)
  const setExchangeRate = useStore(s => s.setExchangeRate)
  const c2 = settings.currency2
  const decimals = settings.currency.decimals > 0 ? 4 : 0
  const prev = c2.rate
  const [v, setV] = useState('')
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [repriceCart, setRepriceCart] = useState(true)
  const [anchored, setAnchored] = useState<number | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const age = useRateAge(c2)
  const cartAnchored = cart.lines.some(l => typeof l.fxPrice === 'number')

  // what the change will touch, computed once when the dialog opens
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [n, rows] = await Promise.all([
          db.products.filter(p => hasFxAnchor(p)).count(),
          db.products.filter(p => p.active && isFxPriced(p)).limit(3).toArray(),
        ])
        if (!alive) return
        setAnchored(n)
        setSamples(rows.map(p => ({ p, before: p.price })))
      } catch { if (alive) setAnchored(0) }
    })()
    return () => { alive = false }
  }, [])

  const rate = round(parseNumber(v), decimals)
  const valid = Number.isFinite(rate) && rate > 0
  const ratio = valid && prev > 0 ? rate / prev : 1
  const pct = prev > 0 && valid ? round((ratio - 1) * 100, 1) : 0
  const big = valid && prev > 0 && (ratio < 0.8 || ratio > 1.25)
  const nonsense = valid && prev > 0 && (ratio < 1 / 50 || ratio > 50)
  const suggestion = nonsense ? round(ratio < 1 ? rate * 1000 : rate / 1000, decimals) : null
  const preview = useMemo(() => {
    if (!valid) return []
    const next = { rate, roundTo: c2.roundTo, roundMode: c2.roundMode }
    return samples.map(s => ({ ...s, after: derivePrices(s.p, next, settings.currency.decimals)?.price ?? s.before }))
  }, [samples, valid, rate, c2.roundTo, c2.roundMode, settings.currency.decimals])

  useEffect(() => { setArmed(false) }, [v])

  const close = () => { if (busy) return; if (prompt) void markRatePrompted(); onClose() }
  const submit = async () => {
    if (!valid || busy || nonsense) return
    if (big && !armed) { setArmed(true); return }
    setBusy(true)
    try {
      await setExchangeRate(rate, 'dialog', repriceCart)
      onClose()
    } catch {
      toast(t('fx.err.rate'), 'error')
      setBusy(false)
    }
  }
  useNumKeys({ enabled: !busy, value: v, onChange: setV, decimals, onEnter: () => void submit() })

  const pctText = `${pct > 0 ? '+' : ''}${formatNumber(pct, 1, { trim: true })}`
  const okLabel = big && !armed ? t('fx.bigChange', { pct: pctText }) : t('common.save')

  return (
    <Modal open onClose={close} title={t('fx.title')} size="narrow" className="rate-dialog" footer={
      <>
        <Button onClick={close} disabled={busy}>{prompt ? t('fx.later') : t('common.cancel')}</Button>
        <Button variant={big && !armed ? 'danger' : 'primary'} icon={big && !armed ? <TriangleAlert size={16} /> : <Check size={16} />} loading={busy} disabled={!valid || nonsense} onClick={() => void submit()}>{okLabel}</Button>
      </>
    }>
      <div className="col" style={{ gap: 12 }}>
        <div className="small muted">
          {prev > 0
            ? t('fx.current', { cur: c2.symbol, rate: formatRate(prev, settings), when: age.label, who: c2.rateUpdatedBy ?? '' }).replace(/ · $/, '')
            : t('fx.never')}
          {prev > 0 && c2.rateUpdatedAt ? <>{' '}<span className="xs faint num" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>({formatDateTime(c2.rateUpdatedAt)})</span></> : null}
        </div>
        <div className="rate-display" dir="ltr">
          <span className="eq">1 {c2.symbol} =</span>
          <span className={`val num ${v ? '' : 'ph'}`}>{v ? groupTyped(v) : prev > 0 ? formatRate(prev, settings) : '0'}</span>
          <span className="eq">{settings.currency.symbol}</span>
        </div>
        <div className="row wrap" style={{ gap: 6, minHeight: 24 }}>
          {valid && prev > 0 && <Badge kind={big ? 'danger' : pct === 0 ? undefined : 'info'} className="num">{t('fx.delta', { pct: pctText })}</Badge>}
          {anchored !== null && anchored > 0 && c2.pricing && <Badge className="num">{t('fx.willReprice', { n: formatNumber(anchored) })}</Badge>}
        </div>
        {suggestion !== null && suggestion > 0 && (
          <button type="button" className="rate-suggest" onClick={() => setV(formatNumber(suggestion, decimals, { trim: true }).replace(/,/g, ''))}>
            <TriangleAlert size={16} /> {t('fx.suggest', { rate: formatRate(suggestion, settings) })}
          </button>
        )}
        {preview.length > 0 && c2.pricing && (
          <div className="rate-preview">
            {preview.map(s => (
              <div key={s.p.id} className="row between small">
                <span className="row truncate" style={{ gap: 4, minWidth: 0 }}><span className="truncate">{s.p.name}</span><span className="faint num" style={{ flex: 'none' }}>({formatMoney(s.p.fxPrice ?? 0, c2)})</span></span>
                <span className="num" dir="ltr">
                  <span className={s.after !== s.before ? 'strike faint' : ''}>{formatMoney(s.before, settings.currency)}</span>
                  {s.after !== s.before && <> → <b>{formatMoney(s.after, settings.currency)}</b></>}
                </span>
              </div>
            ))}
          </div>
        )}
        <NumPad value={v} onChange={setV} decimals={decimals} maxLength={12} />
        {cartAnchored && c2.pricing && <SwitchRow label={t('fx.repriceCart')} on={repriceCart} onChange={setRepriceCart} />}
      </div>
    </Modal>
  )
}

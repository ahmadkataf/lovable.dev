// The shift (Z) report as printable HTML (thermal width) and as plain text for sharing.
import type { CashMove, Settings, Shift } from '../../db/types'
import { addMessages, t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { formatDateTime, formatTime } from '../../lib/format'
import { platform } from '../../lib/platform'
import { shiftDifference, shiftMinutes, type ShiftSummary } from '../../lib/shifts'
import { loadRateHistory, rateAt } from '../../lib/fx'
import { htmlDoc, esc } from '../inventory/print'

addMessages({
  ar: { 'shifts.fxRate': 'سعر الصرف' },
  en: { 'shifts.fxRate': 'Exchange rate' },
})

/** The exchange rate the shift closed at (the history entry in force at `closedAt`; today's for an open shift); undefined when currency2 is off. */
export async function shiftRate(shift: Pick<Shift, 'status' | 'closedAt'>, settings: Settings): Promise<number | undefined> {
  const c2 = settings.currency2
  if (!c2.enabled) return undefined
  try {
    const history = await loadRateHistory()
    const at = shift.status === 'closed' && shift.closedAt ? shift.closedAt : Date.now()
    const r = rateAt(history, at)
    return r && r > 0 ? r : c2.rate > 0 ? c2.rate : undefined
  } catch { return c2.rate > 0 ? c2.rate : undefined }
}
/** "1 $ = 13,000 ل.س" */
const rateLabel = (rate: number, settings: Settings): string => `1 ${settings.currency2.symbol} = ${formatMoney(rate, settings.currency)}`

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60
  return h > 0 ? t('shifts.durationHm', { h, m }) : t('shifts.durationM', { m })
}

interface Line { label: string; value: number; sign?: '+' | '-' | '='; muted?: boolean; bold?: boolean }

/** The rows of the cash reconciliation, in the order they add up. */
export function cashLines(s: ShiftSummary): Line[] {
  const lines: Line[] = [
    { label: t('shifts.openingCash'), value: s.openingCash },
    { label: t('shifts.cashSales'), value: s.byMethod.cash, sign: '+' },
  ]
  if (s.customerPaymentsCash) lines.push({ label: t('shifts.customerPayments'), value: s.customerPaymentsCash, sign: '+' })
  if (s.refundsCash) lines.push({ label: t('shifts.cashRefunds'), value: s.refundsCash, sign: '-' })
  if (s.cashIn) lines.push({ label: t('shifts.cashIn'), value: s.cashIn, sign: '+' })
  if (s.cashOut) lines.push({ label: t('shifts.cashOut'), value: s.cashOut, sign: '-' })
  if (s.expensesCash) lines.push({ label: t('shifts.expenses'), value: s.expensesCash, sign: '-' })
  lines.push({ label: t('shifts.expected'), value: s.expectedCash, sign: '=', bold: true })
  return lines
}

export function methodLines(s: ShiftSummary): Line[] {
  return [
    { label: t('common.cash'), value: s.byMethod.cash },
    { label: t('common.card'), value: s.byMethod.card },
    { label: t('common.transfer'), value: s.byMethod.transfer },
    { label: t('common.credit'), value: s.creditGiven },
  ]
}

export function shiftReportHtml(shift: Shift, summary: ShiftSummary, settings: Settings, cashMoves: CashMove[] = [], rate?: number): string {
  const c = settings.currency
  const money = (n: number) => formatMoney(n, c)
  const row = (l: Line) => `<div class="tot${l.bold ? ' big' : ''}"><span>${l.sign ? `${l.sign} ` : ''}${esc(l.label)}</span><span class="num">${money(l.value)}</span></div>`
  const closed = shift.status === 'closed'
  const diff = shiftDifference(shift, c.decimals)
  const body = `
  <div class="center"><h1>${esc(settings.store.name || t('app.name'))}</h1><div class="muted">${esc(t('shifts.report'))}</div></div>
  <div class="line"></div>
  <div class="tot"><span>${esc(t('shifts.cashier'))}</span><span>${esc(shift.userName)}</span></div>
  <div class="tot"><span>${esc(t('shifts.openedAt'))}</span><span class="num">${formatDateTime(shift.openedAt)}</span></div>
  ${closed ? `<div class="tot"><span>${esc(t('shifts.closedAt'))}</span><span class="num">${formatDateTime(shift.closedAt!)}</span></div>` : ''}
  <div class="tot"><span>${esc(t('shifts.duration'))}</span><span class="num">${esc(durationLabel(shiftMinutes(shift)))}</span></div>
  ${rate ? `<div class="tot"><span>${esc(t('shifts.fxRate'))}</span><span class="num">${esc(rateLabel(rate, settings))}</span></div>` : ''}
  <h2>${esc(t('shifts.sales'))}</h2>
  <div class="tot"><span>${esc(t('shifts.salesCount'))}</span><span class="num">${summary.salesCount}</span></div>
  <div class="tot big"><span>${esc(t('shifts.salesTotal'))}</span><span class="num">${money(summary.salesTotal)}</span></div>
  ${methodLines(summary).map(row).join('')}
  <div class="tot"><span>${esc(t('shifts.refunds'))} (${summary.refundsCount})</span><span class="num">${money(summary.refundsTotal)}</span></div>
  <h2>${esc(t('shifts.cashFlow'))}</h2>
  ${cashLines(summary).map(row).join('')}
  ${closed ? `
  <div class="tot"><span>${esc(t('shifts.counted'))}</span><span class="num">${money(shift.closingCash ?? 0)}</span></div>
  <div class="tot big"><span>${esc(t('shifts.difference'))}</span><span class="num">${diff > 0 ? '+' : ''}${money(diff)} ${diff === 0 ? `(${esc(t('shifts.exact'))})` : diff > 0 ? `(${esc(t('shifts.over'))})` : `(${esc(t('shifts.short'))})`}</span></div>` : ''}
  ${cashMoves.length ? `<h2>${esc(t('shifts.cashMoves'))}</h2>${cashMoves.map(m => `<div class="tot"><span class="num">${formatTime(m.createdAt)}</span><span>${esc(m.note ?? (m.type === 'in' ? t('shifts.moveIn') : t('shifts.moveOut')))}</span><span class="num">${m.type === 'in' ? '+' : '-'}${money(m.amount)}</span></div>`).join('')}` : ''}
  ${shift.note ? `<div class="line"></div><div class="muted">${esc(t('common.note'))}: ${esc(shift.note)}</div>` : ''}
  <div class="line"></div><div class="center muted num">${formatDateTime(Date.now())}</div>`
  return htmlDoc(t('shifts.report'), body, { widthMm: settings.receipt.paper })
}

export function shiftReportText(shift: Shift, summary: ShiftSummary, settings: Settings, rate?: number): string {
  const c = settings.currency
  const money = (n: number) => formatMoney(n, c)
  const closed = shift.status === 'closed'
  const diff = shiftDifference(shift, c.decimals)
  const out: string[] = [
    `${settings.store.name || t('app.name')} — ${t('shifts.report')}`,
    `${t('shifts.cashier')}: ${shift.userName}`,
    `${t('shifts.openedAt')}: ${formatDateTime(shift.openedAt)}`,
  ]
  if (closed) out.push(`${t('shifts.closedAt')}: ${formatDateTime(shift.closedAt!)}`)
  out.push(`${t('shifts.duration')}: ${durationLabel(shiftMinutes(shift))}`)
  if (rate) out.push(`${t('shifts.fxRate')}: ${rateLabel(rate, settings)}`)
  out.push('', `${t('shifts.sales')}: ${summary.salesCount} — ${money(summary.salesTotal)}`)
  for (const l of methodLines(summary)) out.push(`  ${l.label}: ${money(l.value)}`)
  out.push(`${t('shifts.refunds')}: ${money(summary.refundsTotal)}`, '', `${t('shifts.cashFlow')}:`)
  for (const l of cashLines(summary)) out.push(`  ${l.sign ? l.sign + ' ' : ''}${l.label}: ${money(l.value)}`)
  if (closed) {
    out.push(`${t('shifts.counted')}: ${money(shift.closingCash ?? 0)}`)
    out.push(`${t('shifts.difference')}: ${diff > 0 ? '+' : ''}${money(diff)} ${diff === 0 ? t('shifts.exact') : diff > 0 ? t('shifts.over') : t('shifts.short')}`)
  }
  if (shift.note) out.push('', `${t('common.note')}: ${shift.note}`)
  return out.join('\n')
}

export async function printShiftReport(shift: Shift, summary: ShiftSummary, settings: Settings, cashMoves: CashMove[] = []): Promise<boolean> {
  const rate = await shiftRate(shift, settings)
  return platform.print(shiftReportHtml(shift, summary, settings, cashMoves, rate), { printer: settings.receipt.printerName, widthMm: settings.receipt.paper })
}
export async function shareShiftReport(shift: Shift, summary: ShiftSummary, settings: Settings): Promise<boolean> {
  const rate = await shiftRate(shift, settings)
  return platform.share(shiftReportText(shift, summary, settings, rate), t('shifts.report'))
}

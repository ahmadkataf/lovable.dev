// The numbers of a shift: headline tiles, the cash reconciliation and sales by method. Used live on the
// dashboard and on the closed report.
import { Wallet, ShoppingCart, Undo2, Receipt, Banknote, Scale } from 'lucide-react'
import type { Shift } from '../../db/types'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { shiftDifference, type ShiftSummary } from '../../lib/shifts'
import { useSettings } from '../../state/store'
import { cashLines, methodLines } from './report'

export function diffKind(diff: number): 'exact' | 'over' | 'short' { return diff === 0 ? 'exact' : diff > 0 ? 'over' : 'short' }

export function SummaryCards({ shift, summary }: { shift: Shift; summary: ShiftSummary }) {
  const t = useT()
  const c = useSettings().currency
  const closed = shift.status === 'closed'
  const diff = shiftDifference(shift, c.decimals)
  const kind = diffKind(diff)
  return (
    <>
      <div className="stats sh-stats">
        <div className="stat sh-tile-primary"><div className="stat-label"><Wallet size={14} /> {t('shifts.expected')}</div><div className="stat-value num">{formatMoney(summary.expectedCash, c)}</div><div className="stat-sub">{t('shifts.openingCash')}: <span className="num">{formatMoney(summary.openingCash, c)}</span></div></div>
        {closed && <div className="stat"><div className="stat-label"><Banknote size={14} /> {t('shifts.counted')}</div><div className="stat-value num">{formatMoney(shift.closingCash ?? 0, c)}</div></div>}
        {closed && <div className={`stat sh-tile-${kind}`}><div className="stat-label"><Scale size={14} /> {t('shifts.difference')}</div><div className="stat-value num">{diff > 0 ? '+' : ''}{formatMoney(diff, c)}</div><div className="stat-sub">{t('shifts.' + kind)}</div></div>}
        <div className="stat"><div className="stat-label"><ShoppingCart size={14} /> {t('shifts.sales')}</div><div className="stat-value num">{formatMoney(summary.salesTotal, c)}</div><div className="stat-sub">{t('shifts.salesCount', { n: summary.salesCount })}</div></div>
        <div className="stat"><div className="stat-label"><Undo2 size={14} /> {t('shifts.refunds')}</div><div className={`stat-value num ${summary.refundsTotal ? 'sh-neg' : ''}`}>{formatMoney(summary.refundsTotal, c)}</div><div className="stat-sub">{t('shifts.refundsCount', { n: summary.refundsCount })}</div></div>
        <div className="stat"><div className="stat-label"><Receipt size={14} /> {t('shifts.expenses')}</div><div className={`stat-value num ${summary.expensesCash ? 'sh-neg' : ''}`}>{formatMoney(summary.expensesCash, c)}</div><div className="stat-sub">{t('shifts.expensesCount', { n: summary.expensesCount })}</div></div>
      </div>
      <div className="sh-cards">
        <div className="card pad">
          <div className="card-title">{t('shifts.cashFlow')}</div>
          {cashLines(summary).map((l, i) => (
            <div key={i} className={`sh-line ${l.bold ? 'total' : ''}`}>
              <span className="sh-sign num">{l.sign ?? ''}</span>
              <span className="grow">{l.label}</span>
              <span className={`num ${l.sign === '-' && l.value ? 'sh-neg' : ''}`}>{formatMoney(l.value, c)}</span>
            </div>
          ))}
        </div>
        <div className="card pad">
          <div className="card-title">{t('shifts.byMethod')}</div>
          {methodLines(summary).map((l, i) => (
            <div key={i} className="sh-line"><span className="grow">{l.label}</span><span className="num">{formatMoney(l.value, c)}</span></div>
          ))}
          <div className="sh-line total"><span className="grow">{t('shifts.salesTotal')}</span><span className="num">{formatMoney(summary.salesTotal, c)}</span></div>
        </div>
      </div>
    </>
  )
}

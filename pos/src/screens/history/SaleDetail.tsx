// One receipt: the paper preview with print / share, then every detail (items, payments, customer, cashier,
// shift, note) and the refund history. "نسخة" reprints with a COPY banner; "إرجاع" opens the refund sheet.
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Receipt, Copy, Undo2, Printer, User, Clock, ChevronLeft, ChevronRight, PackageCheck, PackageX, Wallet, StickyNote, CheckCircle2 } from 'lucide-react'
import { db } from '../../db'
import type { Refund } from '../../db/types'
import { useT, useLang } from '../../i18n'
import { Badge, Button, Empty, Spinner, useIsMobile } from '../../components/ui'
import { ReceiptView, ReceiptActions } from '../../components/ReceiptView'
import { formatMoney, formatQty, round } from '../../lib/money'
import { formatDateTime } from '../../lib/format'
import { printSale } from '../../lib/receipt'
import { canRefund, remainingQty } from '../../lib/refunds'
import { toast, useSettings, useUser } from '../../state/store'
import { allowed } from '../../lib/audit'
import { SubHead } from '../inventory/shared'
import { RefundDialog } from './RefundDialog'
import { MethodIcon, StatusBadge, methodLabel } from './shared'

export function SaleDetail() {
  const { id = '' } = useParams()
  const t = useT()
  const lang = useLang()
  const nav = useNavigate()
  const settings = useSettings()
  const c = settings.currency
  const mobile = useIsMobile()
  const sale = useLiveQuery(async () => (await db.sales.get(id)) ?? null, [id])
  const refunds = useLiveQuery(() => db.refunds.where('saleId').equals(id).sortBy('createdAt'), [id], [] as Refund[])
  const customer = useLiveQuery(async () => (sale?.customerId ? (await db.customers.get(sale.customerId)) ?? null : null), [sale?.customerId])
  const shift = useLiveQuery(async () => (sale?.shiftId ? (await db.shifts.get(sale.shiftId)) ?? null : null), [sale?.shiftId])
  const [refundOpen, setRefundOpen] = useState(false)
  const [printing, setPrinting] = useState<string | null>(null)
  const user = useUser()

  if (sale === undefined) return <div className="page"><SubHead title={t('history.receipt', { n: '' })} back="/history" /><div className="empty"><Spinner /></div></div>
  if (sale === null) return <div className="page"><SubHead title={t('nav.history')} back="/history" /><Empty icon={<Receipt size={32} />} title={t('history.notFound')} text={t('history.notFoundText')} /></div>

  const refundable = canRefund(sale, refunds, c.decimals) && allowed(user, settings, 'cashierRefund')
  const returned = remainingQty(sale, refunds, c.decimals).map((r, i) => round(sale.items[i].qty - r, 3))
  const anyReturned = returned.some(q => q > 0)
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight

  const printCopy = async () => {
    setPrinting('copy')
    try { const ok = await printSale(sale, settings, { copy: true }); toast(t(ok ? 'history.copyPrinted' : 'receipt.actions.printFailed'), ok ? 'success' : 'error') }
    catch { toast(t('receipt.actions.printFailed'), 'error') }
    finally { setPrinting(null) }
  }
  const printRefund = async (r: Refund) => {
    setPrinting(r.id)
    try { const ok = await printSale(sale, settings, { refund: r }); toast(t(ok ? 'receipt.actions.printed' : 'receipt.actions.printFailed'), ok ? 'success' : 'error') }
    catch { toast(t('receipt.actions.printFailed'), 'error') }
    finally { setPrinting(null) }
  }

  const money = (n: number) => formatMoney(n, c)
  const cashTendered = sale.payments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="page">
      <SubHead title={t('history.receipt', { n: sale.number })} sub={`${formatDateTime(sale.createdAt)} · ${sale.userName}`} back="/history" actions={<StatusBadge sale={sale} />} />
      <div className="page-body hi-detail">
        <div className="hi-receipt">
          <ReceiptView sale={sale} compact={mobile} />
          <ReceiptActions sale={sale} />
          <div className="hi-actions">
            <Button icon={<Copy size={18} />} loading={printing === 'copy'} onClick={() => void printCopy()}>{t('history.copy')}</Button>
            <Button variant={refundable ? 'soft-danger' : 'default'} icon={<Undo2 size={18} />} disabled={!refundable} onClick={() => setRefundOpen(true)} title={refundable ? undefined : t('history.fullyRefunded')}>{t('history.refund')}</Button>
          </div>
        </div>

        <div className="hi-info">
          {sale.status === 'refunded' && <div className="banner danger"><CheckCircle2 size={18} /> {t('history.fullyRefunded')}</div>}

          <div className="card">
            <div className="card-title" style={{ padding: '14px 16px 0' }}>{t('history.items')} <span className="faint num">{sale.items.length}</span></div>
            <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="table hi-table">
                <thead><tr>
                  <th>{t('history.col.item')}</th><th className="num">{t('history.col.qty')}</th><th className="num">{t('history.col.price')}</th>
                  {sale.items.some(i => i.discount > 0) && <th className="num">{t('history.col.discount')}</th>}
                  <th className="num">{t('history.col.total')}</th>
                  {anyReturned && <th className="num">{t('history.col.returned')}</th>}
                </tr></thead>
                <tbody>
                  {sale.items.map((it, i) => (
                    <tr key={i}>
                      <td className="hi-name">{it.name}{it.note && <div className="hi-sub">{it.note}</div>}{it.barcode && <div className="hi-sub num">{it.barcode}</div>}</td>
                      <td className="num">{formatQty(it.qty)}</td>
                      <td className="num">{money(it.price)}{round(it.originalPrice, c.decimals) !== round(it.price, c.decimals) && <span className="strike">{money(it.originalPrice)}</span>}</td>
                      {sale.items.some(x => x.discount > 0) && <td className="num">{it.discount > 0 ? `-${money(it.discount)}` : ''}</td>}
                      <td className="num bold">{money(it.total)}</td>
                      {anyReturned && <td className="num">{returned[i] > 0 ? <Badge kind="warn" className="num">{formatQty(returned[i])}</Badge> : ''}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {(sale.discount > 0 || settings.tax.enabled || sale.tax > 0) && <tr><td colSpan={99}><span className="row between"><span>{t('common.subtotal')}</span><span className="num">{money(sale.subtotal)}</span></span></td></tr>}
                  {sale.discount > 0 && <tr><td colSpan={99}><span className="row between"><span>{t('common.discount')}{sale.discountPct !== undefined ? ` ${formatQty(sale.discountPct)}%` : ''}</span><span className="num">-{money(sale.discount)}</span></span></td></tr>}
                  {(settings.tax.enabled || sale.tax > 0) && <tr><td colSpan={99}><span className="row between"><span>{settings.tax.label || t('common.tax')}</span><span className="num">{money(sale.tax)}</span></span></td></tr>}
                  <tr className="hi-grand"><td colSpan={99}><span className="row between"><span>{t('common.total')}</span><span className="num">{money(sale.total)}</span></span></td></tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="card pad">
            <div className="card-title">{t('history.payments')}</div>
            <div className="hi-kv">
              {sale.payments.filter(p => p.method !== 'credit' && p.amount > 0).map((p, i) => (
                <div key={i}><span className="k"><MethodIcon method={p.method} /> {methodLabel(p.method)}</span><span className="v num">{money(p.method === 'cash' ? round(cashTendered + sale.change, c.decimals) : p.amount)}</span></div>
              ))}
              {sale.change > 0 && <div><span className="k">{t('history.change')}</span><span className="v num">{money(sale.change)}</span></div>}
              {sale.credit > 0 && (
                <div>
                  <span className="k"><Wallet size={16} /> {t('history.onAccount')}</span>
                  <span className="v num">{money(sale.credit)}</span>
                </div>
              )}
              {(sale.customerId || sale.customerName) && (
                <div>
                  <span className="k"><User size={16} /> {t('common.customer')}</span>
                  {customer ? <button type="button" className="hi-link" onClick={() => nav(`/customers/${customer.id}`)}>{customer.name} <Chevron size={16} /></button> : <span className="v">{sale.customerName}</span>}
                </div>
              )}
              {sale.refunded > 0 && <div><span className="k"><Undo2 size={16} /> {t('history.refundTotal')}</span><span className="v num" style={{ color: 'var(--danger)' }}>-{money(sale.refunded)}</span></div>}
            </div>
          </div>

          <div className="card pad">
            <div className="card-title">{t('history.details')}</div>
            <div className="hi-kv">
              <div><span className="k"><User size={16} /> {t('history.cashierLabel')}</span><span className="v">{sale.userName}</span></div>
              <div>
                <span className="k"><Clock size={16} /> {t('history.shift')}</span>
                {sale.shiftId && shift ? <button type="button" className="hi-link" onClick={() => nav(`/shifts/${shift.id}`)}><span className="num">{formatDateTime(shift.openedAt)}</span> <Chevron size={16} /></button> : <span className="v faint">{t('history.noShift')}</span>}
              </div>
              {sale.note && <div><span className="k"><StickyNote size={16} /> {t('history.note')}</span><span className="v hi-note">{sale.note}</span></div>}
            </div>
          </div>

          {refunds.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ padding: '14px 16px 0' }}>{t('history.refunds')} <span className="faint num">{refunds.length}</span></div>
              <div className="list">
                {refunds.map(r => <RefundRow key={r.id} refund={r} busy={printing === r.id} onPrint={() => void printRefund(r)} />)}
              </div>
            </div>
          )}
        </div>
      </div>
      {refundOpen && <RefundDialog sale={sale} refunds={refunds} onClose={() => setRefundOpen(false)} onDone={() => setRefundOpen(false)} />}
    </div>
  )
}

function RefundRow({ refund: r, busy, onPrint }: { refund: Refund; busy: boolean; onPrint: () => void }) {
  const t = useT()
  const c = useSettings().currency
  return (
    <div className="list-row hi-refund-row">
      <span className="hi-rf-ico"><Undo2 size={18} /></span>
      <span className="grow truncate">
        <span className="title">{t('history.refundLine', { v: formatMoney(r.total, c) })} · {r.method === 'credit' ? t('history.toAccount') : methodLabel(r.method)}</span>
        <span className="sub">
          <span className="num">{formatDateTime(r.createdAt)}</span>
          <span>· {r.userName}</span>
          <span>· {t('history.refundItems', { n: r.items.length })}: {r.items.map(i => `${i.name} ×${formatQty(i.qty)}`).join('، ')}</span>
          {r.reason && <span>· {r.reason}</span>}
        </span>
      </span>
      <span className="end row" style={{ gap: 6 }}>
        <Badge kind={r.restock ? 'primary' : undefined}>{r.restock ? <PackageCheck size={12} /> : <PackageX size={12} />} {t(r.restock ? 'history.restocked' : 'history.notRestocked')}</Badge>
        <Button variant="ghost" size="sm" iconOnly icon={<Printer size={16} />} loading={busy} onClick={onPrint} title={t('history.printRefund')} aria-label={t('history.printRefund')} />
      </span>
    </div>
  )
}


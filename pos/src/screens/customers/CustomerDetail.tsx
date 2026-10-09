// One customer: contact card (call / WhatsApp / edit / delete), the balance with payment and adjustment,
// then the statement (ledger with a running balance, period, CSV, print) and the customer's receipts.
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Phone, MessageCircle, Pencil, Trash2, MapPin, Users, Banknote, SlidersHorizontal, ShoppingCart, Undo2, Receipt, Download, Printer, ChevronLeft, ChevronRight, FileText, HandCoins } from 'lucide-react'
import { db } from '../../db'
import type { LedgerEntry, Sale } from '../../db/types'
import { useT, useLang } from '../../i18n'
import { Avatar, Badge, Button, Empty, Field, Input, Seg, Spinner, useIsMobile } from '../../components/ui'
import { formatMoney } from '../../lib/money'
import { formatDate, formatDateTime, startOfMonth, endOfDay, toDateInput, fromDateInput } from '../../lib/format'
import { platform } from '../../lib/platform'
import { saveCsv } from '../../lib/csv'
import { balanceKind, ledgerTypeLabel, reminderText, statementHtml, statementRows, statementSlice, telUrl, voucherHtml, whatsappUrl } from '../../lib/customers'
import { toast, confirmDialog, useSettings, useUser, isAdmin } from '../../state/store'
import { SubHead } from '../inventory/shared'
import { CustomerForm } from './CustomerForm'
import { PaymentDialog, AdjustDialog } from './dialogs'
import { StatusBadge, methodLabel } from '../history/shared'

type Tab = 'ledger' | 'sales'
type LedgerPeriod = 'all' | 'month' | 'custom'

export function CustomerDetail() {
  const { id = '' } = useParams()
  const t = useT()
  const lang = useLang()
  const nav = useNavigate()
  const user = useUser()
  const admin = isAdmin(user)
  const settings = useSettings()
  const c = settings.currency
  const mobile = useIsMobile()
  const customer = useLiveQuery(async () => (await db.customers.get(id)) ?? null, [id])
  const ledger = useLiveQuery(() => db.ledger.where('customerId').equals(id).reverse().sortBy('createdAt'), [id])
  const sales = useLiveQuery(() => db.sales.where('customerId').equals(id).reverse().sortBy('createdAt'), [id])
  const refunds = useLiveQuery(() => db.refunds.where('customerId').equals(id).toArray(), [id], [])
  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const [tab, setTab] = useState<Tab>('ledger')
  const [period, setPeriod] = useState<LedgerPeriod>('all')
  const [custom, setCustom] = useState(() => ({ from: startOfMonth(Date.now()), to: Date.now() }))
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)
  const [adjusting, setAdjusting] = useState(false)

  // refId (a sale or refund id) → the receipt, for links and "Receipt #n" in the statement
  const receiptOf = useMemo(() => {
    const m = new Map<string, Sale>()
    for (const s of sales ?? []) m.set(s.id, s)
    for (const r of refunds) { const s = (sales ?? []).find(x => x.id === r.saleId); if (s) m.set(r.id, s) }
    return m
  }, [sales, refunds])
  const receiptNumbers = useMemo(() => new Map([...receiptOf].map(([k, s]) => [k, s.number])), [receiptOf])
  const range = period === 'all' ? {} : period === 'month' ? { from: startOfMonth(Date.now()), to: endOfDay(Date.now()) } : { from: custom.from, to: endOfDay(custom.to) }
  const slice = useMemo(() => statementSlice(ledger ?? [], range.from, range.to), [ledger, range.from, range.to])
  const rows = useMemo(() => slice.rows.slice().reverse(), [slice])
  const userName = (uid: string) => users.find(u => u.id === uid)?.name ?? ''

  if (customer === undefined) return <div className="page"><SubHead title={t('nav.customers')} back="/customers" /><div className="empty"><Spinner /></div></div>
  if (customer === null) return <div className="page"><SubHead title={t('nav.customers')} back="/customers" /><Empty icon={<Users size={32} />} title={t('customers.notFound')} text={t('customers.notFoundText')} action={<Button onClick={() => nav('/customers')}>{t('common.back')}</Button>} /></div>

  const kind = balanceKind(customer.balance)
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight
  const storeName = settings.store.name.trim() || t('app.name')
  const call = () => { if (customer.phone) platform.openUrl(telUrl(customer.phone)) }
  const whatsapp = () => { if (customer.phone) platform.openUrl(whatsappUrl(customer.phone, reminderText({ storeName, customerName: customer.name, balance: customer.balance, currency: c }))) }
  const del = async () => {
    if (customer.balance !== 0) { toast(t('customers.deleteBlocked'), 'warn'); return }
    if (!(await confirmDialog({ title: t('customers.delete'), text: t('customers.deleteText'), danger: true, okLabel: t('common.delete') }))) return
    await db.customers.delete(customer.id)
    toast(t('customers.deleted'), 'success')
    nav('/customers', { replace: true })
  }
  const statementInput = { customer, entries: ledger ?? [], settings, from: range.from, to: range.to, receipts: receiptNumbers }
  const exportCsv = async () => {
    if (await saveCsv(`statement-${customer.name.replace(/[\\/:*?"<>|]+/g, ' ').trim()}-${toDateInput(Date.now())}.csv`, statementRows(statementInput))) toast(t('customers.exported'), 'success')
  }
  const printStatement = async () => {
    try { const ok = await platform.print(statementHtml(statementInput)); toast(t(ok ? 'customers.printed' : 'customers.printFailed'), ok ? 'success' : 'error') }
    catch { toast(t('customers.printFailed'), 'error') }
  }
  const printVoucher = (e: LedgerEntry) => { void platform.print(voucherHtml({ customer, entry: e, settings, userName: userName(e.userId) || undefined })).catch(() => toast(t('customers.printFailed'), 'error')) }

  return (
    <div className="page">
      <SubHead title={customer.name} sub={customer.phone ? <span className="num">{customer.phone}</span> : undefined} back="/customers" actions={
        !mobile ? <>
          <Button variant="ghost" iconOnly icon={<Pencil size={18} />} onClick={() => setEditing(true)} title={t('common.edit')} aria-label={t('common.edit')} />
          <Button variant="ghost" iconOnly icon={<Trash2 size={18} />} onClick={() => void del()} title={customer.balance !== 0 ? t('customers.deleteBlocked') : t('customers.delete')} aria-label={t('customers.delete')} />
        </> : undefined
      } />
      <div className="page-body cu-detail">
        <div className="cu-side">
          <div className="card pad cu-head">
            <Avatar name={customer.name} size={64} round />
            <h2>{customer.name}</h2>
            {customer.phone ? <span className="cu-line"><Phone size={14} /> <span className="num">{customer.phone}</span></span> : <span className="cu-line faint">{t('customers.noPhone')}</span>}
            {customer.address && <span className="cu-line"><MapPin size={14} /> {customer.address}</span>}
            {customer.notes && <span className="cu-notes">{customer.notes}</span>}
            <span className="xs faint">{t('customers.since', { d: formatDate(customer.createdAt) })}</span>
            <div className="cu-head-actions">
              <Button variant="soft" icon={<Phone size={18} />} disabled={!customer.phone} onClick={call}>{t('customers.call')}</Button>
              <Button variant="soft" icon={<MessageCircle size={18} />} disabled={!customer.phone} onClick={whatsapp}>{t('customers.whatsapp')}</Button>
              <Button icon={<Pencil size={18} />} onClick={() => setEditing(true)}>{t('common.edit')}</Button>
              <Button variant={customer.balance !== 0 ? 'default' : 'soft-danger'} icon={<Trash2 size={18} />} onClick={() => void del()} title={customer.balance !== 0 ? t('customers.deleteBlocked') : undefined}>{t('common.delete')}</Button>
            </div>
          </div>
          <div className="card pad cu-balance">
            <div className="cu-balance-label">{t('customers.balance')}</div>
            <div className={`cu-balance-value num ${kind}`}>{formatMoney(Math.abs(customer.balance), c)}</div>
            <div className={`cu-balance-kind ${kind === 'owes' ? 'cu-amt up' : kind === 'has' ? 'cu-amt down' : 'faint'}`} style={{ fontSize: 13 }}>{t(`customers.balance.${kind}Label`)}</div>
            {settings.loyalty.enabled && <div className="small muted" style={{ marginTop: 4 }}>⭐ <span className="num">{customer.points ?? 0}</span> {t('customers.points')}</div>}
            <div className={`cu-balance-actions ${admin ? 'two' : ''}`}>
              <Button variant="primary" size="lg" icon={<HandCoins size={18} />} onClick={() => setPaying(true)}>{t('customers.pay')}</Button>
              {admin && <Button size="lg" icon={<SlidersHorizontal size={18} />} onClick={() => setAdjusting(true)}>{t('customers.adjust')}</Button>}
            </div>
          </div>
        </div>

        <div className="cu-main">
          <div className="tabs">
            <button type="button" className={tab === 'ledger' ? 'on' : ''} onClick={() => setTab('ledger')}>{t('customers.tab.ledger')} <span className="faint num">{ledger?.length ?? ''}</span></button>
            <button type="button" className={tab === 'sales' ? 'on' : ''} onClick={() => setTab('sales')}>{t('customers.tab.sales')} <span className="faint num">{sales?.length ?? ''}</span></button>
          </div>

          {tab === 'ledger' && (
            <>
              <div className="cu-ledger-bar">
                <Seg value={period} onChange={setPeriod} options={[{ value: 'all', label: t('customers.ledger.period.all') }, { value: 'month', label: t('customers.ledger.period.month') }, { value: 'custom', label: t('customers.ledger.period.custom') }]} />
                <span className="grow" />
                <Button variant="outline" size="sm" icon={<Download size={16} />} iconOnly={mobile} onClick={() => void exportCsv()} disabled={!ledger?.length} title={t('customers.export')} aria-label={t('customers.export')}>{t('customers.export')}</Button>
                <Button variant="outline" size="sm" icon={<Printer size={16} />} iconOnly={mobile} onClick={() => void printStatement()} title={t('customers.printStatement')} aria-label={t('customers.printStatement')}>{t('customers.printStatement')}</Button>
              </div>
              {period === 'custom' && (
                <div className="cu-range">
                  <Field label={t('common.from')}><Input type="date" ltr value={toDateInput(custom.from)} max={toDateInput(custom.to)} onChange={e => e.target.value && setCustom(r => ({ ...r, from: fromDateInput(e.target.value) }))} /></Field>
                  <Field label={t('common.to')}><Input type="date" ltr value={toDateInput(custom.to)} min={toDateInput(custom.from)} onChange={e => e.target.value && setCustom(r => ({ ...r, to: fromDateInput(e.target.value) }))} /></Field>
                </div>
              )}
              {!ledger ? <div className="empty"><Spinner /></div> : ledger.length === 0 ? (
                <Empty icon={<FileText size={32} />} title={t('customers.ledger.empty')} text={t('customers.ledger.emptyText')} />
              ) : (
                <div className="card list">
                  {rows.length === 0 && <div className="empty" style={{ padding: 28 }}><p>{t('customers.ledger.emptyPeriod')}</p></div>}
                  {rows.map(e => {
                    const sale = e.refId ? receiptOf.get(e.refId) : undefined
                    return (
                      <div key={e.id} className="list-row cu-entry">
                        <span className={`cu-ico ${e.type}`}>{e.type === 'sale' ? <ShoppingCart size={18} /> : e.type === 'payment' ? <Banknote size={18} /> : e.type === 'refund' ? <Undo2 size={18} /> : <SlidersHorizontal size={18} />}</span>
                        <span className="grow truncate">
                          <span className="title">
                            <span>{ledgerTypeLabel(e.type)}</span>
                            {e.method && e.type === 'payment' && <Badge>{methodLabel(e.method)}</Badge>}
                            {sale && <button type="button" className="cu-entry-link" onClick={() => nav(`/history/${sale.id}`)}><span className="num">{t('customers.ledger.receipt', { n: sale.number })}</span><Chevron size={14} /></button>}
                          </span>
                          <span className="sub">
                            <span className="num">{formatDateTime(e.createdAt)}</span>
                            {e.note && !(sale && /^#\d+$/.test(e.note)) && <span>· {e.note}</span>}
                            {userName(e.userId) && <span>· {userName(e.userId)}</span>}
                          </span>
                        </span>
                        <span className="end">
                          <span className={`cu-amt num ${e.amount > 0 ? 'up' : e.amount < 0 ? 'down' : ''}`}>{e.amount > 0 ? '+' : e.amount < 0 ? '-' : ''}{formatMoney(Math.abs(e.amount), c)}</span>
                          <span className="cu-after num">{t('customers.ledger.balanceAfter')}: {formatMoney(e.balanceAfter, c)}</span>
                        </span>
                        {e.type !== 'sale' && <Button variant="ghost" size="sm" iconOnly icon={<Printer size={16} />} onClick={() => printVoucher(e)} title={t('customers.ledger.voucher')} aria-label={t('customers.ledger.voucher')} />}
                      </div>
                    )
                  })}
                  {range.from !== undefined && rows.length > 0 && (
                    <div className="list-row cu-opening-row"><span>{t('customers.ledger.opening')} · <span className="num">{formatDate(range.from)}</span></span><span className="num bold">{formatMoney(slice.opening, c)}</span></div>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'sales' && (
            !sales ? <div className="empty"><Spinner /></div> : sales.length === 0 ? (
              <Empty icon={<Receipt size={32} />} title={t('customers.sales.empty')} text={t('customers.sales.emptyText')} />
            ) : (
              <div className="card list">
                {sales.map(s => (
                  <button key={s.id} type="button" className="list-row cu-sale-row" onClick={() => nav(`/history/${s.id}`)}>
                    <span className="cu-ico sale"><Receipt size={18} /></span>
                    <span className="grow truncate">
                      <span className="title"><span className="num">#{s.number}</span>{s.credit > 0 && <span className="muted"> · {t('customers.sales.onAccount', { v: formatMoney(s.credit, c) })}</span>}</span>
                      <span className="sub"><span className="num">{formatDateTime(s.createdAt)}</span> · {t('common.items', { n: s.items.length })} · {s.userName}</span>
                    </span>
                    <span className="end">
                      <span className="bold num">{formatMoney(s.total, c)}</span>
                      <StatusBadge sale={s} />
                    </span>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
      <CustomerForm open={editing} onClose={() => setEditing(false)} customer={customer} />
      {paying && <PaymentDialog customer={customer} onClose={() => setPaying(false)} />}
      {adjusting && admin && <AdjustDialog customer={customer} onClose={() => setAdjusting(false)} />}
    </div>
  )
}


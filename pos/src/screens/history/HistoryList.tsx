// The receipts list: a period, filters, a number search that a USB scanner can drive, and the day groups.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Receipt, SlidersHorizontal, Download, X, Search } from 'lucide-react'
import { db } from '../../db'
import type { PaymentMethod, Sale } from '../../db/types'
import { useT } from '../../i18n'
import { Button, Empty, Field, Input, SearchInput, Select, Spinner, useIsMobile } from '../../components/ui'
import { formatMoney } from '../../lib/money'
import { formatDay, formatTime, formatDate, periodRange, startOfMonth, toDateInput, fromDateInput, type Period } from '../../lib/format'
import { useBarcodeWedge } from '../../lib/scanner-input'
import { beep } from '../../lib/audio'
import { saveCsv } from '../../lib/csv'
import { toast, useSettings } from '../../state/store'
import { filterSales, groupSalesByDay, summarizeSales, parseReceiptNumber, saleMethods, salesCsvRows, lineCount, type StatusFilter } from './logic'
import { MethodIcon, StatusBadge, methodLabel, statusLabel } from './shared'

type HistoryPeriod = Exclude<Period, 'year'>
const PAGE = 100

export function HistoryList() {
  const t = useT()
  const nav = useNavigate()
  const settings = useSettings()
  const c = settings.currency
  const mobile = useIsMobile()
  const [period, setPeriod] = useState<HistoryPeriod>('today')
  const [custom, setCustom] = useState(() => ({ from: startOfMonth(Date.now()), to: Date.now() }))
  const range = periodRange(period, custom)
  const [q, setQ] = useState('')
  const [userId, setUserId] = useState('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [customer, setCustomer] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const searchRef = useRef<HTMLInputElement>(null)
  const number = parseReceiptNumber(q)

  const users = useLiveQuery(() => db.users.toArray(), [], [])
  const totalCount = useLiveQuery(() => db.sales.count(), [])
  const sales = useLiveQuery(async () => {
    if (number !== null) return db.sales.where('number').equals(number).reverse().sortBy('createdAt')
    return db.sales.where('createdAt').between(range.from, range.to, true, true).reverse().sortBy('createdAt')
  }, [number, range.from, range.to])

  const filtersOn = !!(userId || method || status !== 'all' || customer.trim())
  const filtered = useMemo(() => (sales ? filterSales(sales, { userId, method, status, customer }) : undefined), [sales, userId, method, status, customer])
  useEffect(() => { setLimit(PAGE) }, [period, range.from, range.to, number, userId, method, status, customer])
  const visible = filtered ? filtered.slice(0, limit) : []
  const groups = useMemo(() => groupSalesByDay(visible, c.decimals), [visible, c.decimals])
  const summary = filtered ? summarizeSales(filtered, c.decimals) : null

  const openByNumber = async (n: number) => {
    const s = await db.sales.where('number').equals(n).first()
    if (s) { beep('scan'); nav(`/history/${s.id}`) }
    else { beep('error'); toast(t('history.numberNotFound', { n }), 'warn') }
  }
  // a USB / Bluetooth scanner reading the barcode on a receipt opens it straight away
  useBarcodeWedge(code => { const n = parseReceiptNumber(code); if (n !== null) void openByNumber(n) })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const clearFilters = () => { setUserId(''); setMethod(''); setStatus('all'); setCustomer('') }
  const exportCsv = async () => {
    if (!filtered?.length) return
    const rows = salesCsvRows(filtered, {
      number: t('history.search'), date: t('common.date'), time: t('common.time'), customer: t('common.customer'), cashier: t('common.cashier'), items: t('history.items'),
      total: t('common.total'), paid: t('common.paid'), credit: t('common.credit'), refunded: t('history.refundTotal'), status: t('history.status'), methods: t('history.method'), note: t('common.note'),
    }, { date: formatDate, time: formatTime, status: statusLabel, method: methodLabel }, c.decimals)
    if (await saveCsv(`receipts-${toDateInput(range.from)}-${toDateInput(range.to)}.csv`, rows)) toast(t('history.exported'), 'success')
  }

  const periodOptions: { value: HistoryPeriod; label: string }[] = [
    { value: 'today', label: t('history.period.today') }, { value: 'yesterday', label: t('history.period.yesterday') },
    { value: 'week', label: t('history.period.week') }, { value: 'month', label: t('history.period.month') }, { value: 'custom', label: t('history.period.custom') },
  ]
  const filtersVisible = !mobile || showFilters

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t('nav.history')}</h1>
        <div className="actions">
          <Button variant="outline" icon={<Download size={18} />} iconOnly={mobile} onClick={() => void exportCsv()} disabled={!filtered?.length} title={t('history.export')}>{t('history.export')}</Button>
        </div>
      </div>
      <div className="page-body col">
        <div className="hi-toolbar">
          <SearchInput className="grow" value={q} onChange={setQ} placeholder={t('history.search')} inputRef={searchRef} onEnter={v => { const n = parseReceiptNumber(v); if (n !== null) void openByNumber(n) }} />
          {mobile && <Button variant={filtersOn ? 'soft' : 'default'} iconOnly icon={<SlidersHorizontal size={18} />} onClick={() => setShowFilters(v => !v)} aria-label={t('history.filters')} title={t('history.filters')} />}
        </div>
        {number === null ? (
          <>
            <div className="hi-period seg" role="tablist">
              {periodOptions.map(o => <button key={o.value} type="button" role="tab" aria-selected={period === o.value} className={period === o.value ? 'on' : ''} onClick={() => setPeriod(o.value)}>{o.label}</button>)}
            </div>
            {period === 'custom' && (
              <div className="hi-range">
                <Field label={t('common.from')}><Input type="date" ltr value={toDateInput(custom.from)} max={toDateInput(custom.to)} onChange={e => e.target.value && setCustom(r => ({ ...r, from: fromDateInput(e.target.value) }))} /></Field>
                <Field label={t('common.to')}><Input type="date" ltr value={toDateInput(custom.to)} min={toDateInput(custom.from)} onChange={e => e.target.value && setCustom(r => ({ ...r, to: fromDateInput(e.target.value) }))} /></Field>
              </div>
            )}
          </>
        ) : <div className="small muted">{t('history.numberResults', { n: number })}</div>}
        {filtersVisible && (
          <div className="hi-filters">
            <Field label={t('history.cashier')}>
              <Select value={userId} onChange={e => setUserId(e.target.value)}>
                <option value="">{t('common.all')}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            <Field label={t('history.method')}>
              <Select value={method} onChange={e => setMethod(e.target.value as PaymentMethod | '')}>
                <option value="">{t('common.all')}</option>
                {(['cash', 'card', 'transfer', 'credit'] as PaymentMethod[]).map(m => <option key={m} value={m}>{methodLabel(m)}</option>)}
              </Select>
            </Field>
            <Field label={t('history.status')}>
              <Select value={status} onChange={e => setStatus(e.target.value as StatusFilter)}>
                {(['all', 'completed', 'anyRefund', 'refunded', 'partial'] as StatusFilter[]).map(s => <option key={s} value={s}>{t('history.status.' + s)}</option>)}
              </Select>
            </Field>
            <Field label={t('history.customer')}>
              <Input value={customer} onChange={e => setCustomer(e.target.value)} placeholder={t('history.customerPh')} />
            </Field>
            {filtersOn && <Button variant="ghost" icon={<X size={16} />} onClick={clearFilters}>{t('history.clearFilters')}</Button>}
          </div>
        )}

        {summary && filtered && filtered.length > 0 && (
          <div className="hi-summary">
            <span>{t('history.summary', { n: summary.count, total: formatMoney(summary.total, c) })}</span>
            {summary.refunded > 0 && <span className="hi-ref num">· {t('history.summaryRefunded', { v: formatMoney(summary.refunded, c) })}</span>}
          </div>
        )}

        {!filtered ? <div className="empty"><Spinner /></div> : filtered.length === 0 ? (
          totalCount === 0
            ? <Empty icon={<Receipt size={32} />} title={t('history.emptyAll')} text={t('history.emptyAllText')} />
            : <Empty icon={<Search size={32} />} title={t('history.empty')} text={t('history.emptyText')} action={filtersOn ? <Button variant="soft" onClick={clearFilters}>{t('history.clearFilters')}</Button> : undefined} />
        ) : groups.map(g => (
          <div key={g.day} className="hi-group">
            <div className="hi-day">
              <span>{formatDay(g.day)}</span>
              <span className="hi-day-count num">{t('history.receipts', { n: g.count })}</span>
              <span className="hi-day-total num">{formatMoney(g.total, c)}</span>
            </div>
            <div className="card list">
              {g.items.map(s => <SaleRow key={s.id} sale={s} onOpen={() => nav(`/history/${s.id}`)} />)}
            </div>
          </div>
        ))}
        {filtered && filtered.length > visible.length && (
          <div className="hi-more">
            <Button variant="outline" onClick={() => setLimit(l => l + PAGE)}>{t('history.showMore')}</Button>
            <span className="xs faint num">{t('history.shown', { n: visible.length, total: filtered.length })}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SaleRow({ sale, onOpen }: { sale: Sale; onOpen: () => void }) {
  const t = useT()
  const c = useSettings().currency
  const methods = saleMethods(sale)
  const main = methods[0] ?? 'cash'
  return (
    <button type="button" className="list-row hi-row" onClick={onOpen}>
      <span className={`hi-ico ${main}`}><MethodIcon method={main} size={18} /></span>
      <span className="grow truncate">
        <span className="title">
          <span className="hi-num num">#{sale.number}</span>
          {sale.customerName && <span className="hi-cust">{sale.customerName}</span>}
        </span>
        <span className="sub">
          <span className="num">{formatTime(sale.createdAt)}</span>
          <span>· {t('common.items', { n: lineCount(sale) })}</span>
          <span>· {sale.userName}</span>
          {methods.length > 1 && <span className="hi-methods">{methods.slice(1).map(m => <MethodIcon key={m} method={m} size={13} />)}</span>}
        </span>
      </span>
      <span className="end">
        <span className={`hi-total num ${sale.status === 'refunded' ? 'refunded' : ''}`}>{formatMoney(sale.total, c)}</span>
        <StatusBadge sale={sale} />
      </span>
    </button>
  )
}

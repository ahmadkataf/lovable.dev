import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Printer, Pencil, Trash2, Undo2, MessageCircle, FileSpreadsheet, Eye, ArrowRightLeft } from 'lucide-react'
import { useCollection, useSettings, useIsAdmin } from '../db/store'
import type { Sale } from '../db/types'
import { convertQuote, deleteSale, saveSale } from '../db/actions'
import { payStatus, saleDue } from '../lib/calc'
import { addDays, fmtDate, fmtDateTime, fromInputDate, invoiceNo, matches, money, num, toInputDate, endOfDay } from '../lib/format'
import { DateRange, Empty, Field, NumberInput, PayBadge, SearchInput, Tabs } from '../ui/components'
import { Modal, useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { printDocument } from '../print/PrintHost'
import { exportSheet } from '../lib/excel'
import { whatsappLink } from './POS'

export function Sales() {
  const sales = useCollection('sales')
  const customers = useCollection('customers')
  const settings = useSettings()
  const isAdmin = useIsAdmin()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const openId = params.get('open')
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'all' | 'unpaid' | 'returns' | 'quotes'>('all')
  const [conv, setConv] = useState<Sale | null>(null)
  const [from, setFrom] = useState(toInputDate(addDays(Date.now(), -30)))
  const [to, setTo] = useState(toInputDate(Date.now()))
  const [ret, setRet] = useState<Sale | null>(null)
  const toast = useToast(); const confirm = useConfirm()

  const list = useMemo(() => {
    const f = fromInputDate(from); const t = endOfDay(fromInputDate(to))
    return Array.from(sales.values()).filter(s => s.date >= f && s.date <= t)
      .filter(s => tab === 'quotes' ? s.type === 'quote' : s.type === 'quote' ? false : tab === 'all' ? true : tab === 'returns' ? s.type === 'return' : s.type === 'sale' && saleDue(s) > 0)
      .filter(s => matches(q, s.customerName, String(s.number), s.notes, ...s.items.map(i => i.name)))
      .sort((a, b) => b.date - a.date)
  }, [sales, q, tab, from, to])
  const totals = useMemo(() => list.reduce((t, s) => { const k = s.type === 'return' ? -1 : 1; t.total += k * s.total; t.paid += k * s.paid; return t }, { total: 0, paid: 0 }), [list])
  const open = openId ? sales.get(openId) : undefined

  const del = async (s: Sale) => {
    if (await confirm({ title: `حذف الفاتورة ${invoiceNo(s.number)}؟`, text: 'ستعود كميات القطع إلى المخزون ويُلغى أثرها على الصندوق وحساب العميل.', danger: true, okText: 'حذف' })) { await deleteSale(s.id); toast.success('تم حذف الفاتورة'); setParams({}) }
  }
  const exportExcel = () => exportSheet(`المبيعات-${from}-${to}`, list.map(s => ({ 'الرقم': invoiceNo(s.number), 'النوع': s.type === 'return' ? 'مرتجع' : s.type === 'quote' ? 'عرض سعر' : 'بيع', 'التاريخ': fmtDateTime(s.date), 'العميل': s.customerName, 'الأصناف': s.items.map(i => `${i.name} ×${i.qty}`).join('، '), 'الإجمالي': s.total, 'المدفوع': s.paid, 'المتبقي': saleDue(s), 'ملاحظات': s.notes ?? '' })), 'المبيعات')

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="search"><SearchInput value={q} onChange={setQ} placeholder="بحث برقم الفاتورة أو العميل أو القطعة…" /></div>
        <DateRange from={from} to={to} onChange={(a, b) => { setFrom(a); setTo(b) }} />
        <button className="btn" onClick={exportExcel} title="تصدير إلى إكسل"><FileSpreadsheet /> <span className="hide-mobile">إكسل</span></button>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'all', label: 'كل الفواتير' }, { id: 'unpaid', label: 'غير المسددة' }, { id: 'returns', label: 'المرتجعات' }, { id: 'quotes', label: 'عروض الأسعار' }]} />
      <div className="card">
        {list.length === 0 ? <Empty title={tab === 'quotes' ? 'لا عروض أسعار في هذه الفترة' : 'لا فواتير في هذه الفترة'} text={tab === 'quotes' ? 'من شاشة البيع، فعّل «عرض سعر» لتحفظ عرضاً يُطبع للزبون دون أن يمس المخزون' : undefined} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>الرقم</th><th>التاريخ</th><th>العميل</th><th className="hide-mobile">الأصناف</th><th className="num">الإجمالي</th><th className="num hide-mobile">المتبقي</th><th>الحالة</th><th className="actions"></th></tr></thead>
            <tbody>{list.map(s => (
              <tr key={s.id} className="click" onClick={() => setParams({ open: s.id })}>
                <td className="bold">{invoiceNo(s.number)}{s.type === 'return' && <span className="badge tone-danger" style={{ marginInlineStart: 6 }}>مرتجع</span>}{s.type === 'quote' && <span className={`badge ${s.convertedTo ? 'tone-success' : 'tone-info'}`} style={{ marginInlineStart: 6 }}>{s.convertedTo ? 'تحوّل لفاتورة' : 'عرض سعر'}</span>}</td>
                <td className="muted small">{fmtDate(s.date)}</td>
                <td>{s.customerName}</td>
                <td className="hide-mobile muted small" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.items.map(i => `${i.name} ×${num(i.qty, 2)}`).join('، ')}</td>
                <td className="num bold">{money(s.total)}</td>
                <td className="num hide-mobile">{saleDue(s) > 0 ? <span className="neg-txt">{money(saleDue(s))}</span> : '—'}</td>
                <td>{s.type === 'quote' ? (s.validUntil && s.validUntil < Date.now() && !s.convertedTo ? <span className="badge tone-muted">انتهى</span> : null) : <PayBadge status={payStatus(s.total, s.paid)} />}</td>
                <td className="actions" onClick={e => e.stopPropagation()}>
                  <button className="btn sm ghost icon" title="عرض" onClick={() => setParams({ open: s.id })}><Eye /></button>
                  <button className="btn sm ghost icon" title="طباعة" onClick={() => printDocument({ type: 'invoice', sale: s })}><Printer /></button>
                </td>
              </tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={4}>المجموع ({list.length} {tab === 'quotes' ? 'عرض' : 'فاتورة'})</td><td className="num">{money(totals.total)}</td><td className="num hide-mobile">{money(totals.total - totals.paid)}</td><td colSpan={2}></td></tr></tfoot>
          </table></div>
        )}
      </div>

      {open && (
        <Modal title={`${open.type === 'return' ? 'مرتجع' : open.type === 'quote' ? 'عرض سعر' : 'فاتورة'} ${invoiceNo(open.number)}`} onClose={() => setParams({})} size="wide" footer={<>
          <button className="btn primary" onClick={() => printDocument({ type: 'invoice', sale: open })}><Printer /> طباعة</button>
          <a className="btn" href={whatsappLink(open, open.customerId ? customers.get(open.customerId)?.phone : undefined, settings.shopName, settings.currency)} target="_blank" rel="noreferrer"><MessageCircle /> واتساب</a>
          {open.type === 'sale' && <button className="btn" onClick={() => setRet(open)}><Undo2 /> مرتجع</button>}
          {(open.type === 'sale' || (open.type === 'quote' && !open.convertedTo)) && <button className="btn" onClick={() => nav(`/pos?edit=${open.id}`)}><Pencil /> تعديل</button>}
          {open.type === 'quote' && !open.convertedTo && <button className="btn success" onClick={() => setConv(open)}><ArrowRightLeft /> تحويل إلى فاتورة</button>}
          {open.type === 'quote' && open.convertedTo && <button className="btn" onClick={() => setParams({ open: open.convertedTo! })}>عرض الفاتورة</button>}
          {isAdmin && <><span className="grow" /><button className="btn danger" onClick={() => del(open)}><Trash2 /> حذف</button></>}
        </>}>
          <SaleDetails sale={open} />
        </Modal>
      )}
      {ret && <ReturnModal sale={ret} onClose={() => setRet(null)} onDone={r => { setRet(null); setParams({ open: r.id }) }} />}
      {conv && <ConvertModal quote={conv} onClose={() => setConv(null)} onDone={s => { setConv(null); setParams({ open: s.id }) }} />}
    </div>
  )
}

export function SaleDetails({ sale }: { sale: Sale }) {
  const sales = useCollection('sales')
  const orig = sale.returnOf ? sales.get(sale.returnOf) : undefined
  return (
    <div className="stack">
      <div className="kv">
        <dt>التاريخ</dt><dd>{fmtDateTime(sale.date)}</dd>
        <dt>العميل</dt><dd>{sale.customerName}</dd>
        {orig && <><dt>مرتجع من</dt><dd>فاتورة {invoiceNo(orig.number)}</dd></>}
        {sale.type === 'quote' && sale.validUntil && <><dt>صالح حتى</dt><dd>{fmtDate(sale.validUntil)}</dd></>}
        {sale.discountPct ? <><dt>نسبة الخصم</dt><dd>{num(sale.discountPct, 2)}%</dd></> : null}
        {sale.notes && <><dt>ملاحظات</dt><dd>{sale.notes}</dd></>}
      </div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>الصنف</th><th className="num">الكمية</th><th className="num">السعر</th><th className="num">المجموع</th></tr></thead>
        <tbody>{sale.items.map((i, k) => <tr key={k}><td>{i.name}<div className="small muted">{i.code}</div></td><td className="num">{num(i.qty, 2)} {i.unit}</td><td className="num">{money(i.price)}</td><td className="num bold">{money(i.qty * i.price - i.discount)}</td></tr>)}</tbody>
        <tfoot>
          {sale.discount > 0 && <tr><td colSpan={3}>المجموع</td><td className="num">{money(sale.subtotal)}</td></tr>}
          {sale.discount > 0 && <tr><td colSpan={3}>الخصم</td><td className="num">- {money(sale.discount)}</td></tr>}
          <tr><td colSpan={3}>الإجمالي</td><td className="num" style={{ fontSize: 17 }}>{money(sale.total)}</td></tr>
          {sale.type !== 'quote' && <tr><td colSpan={3}>المدفوع</td><td className="num">{money(sale.paid)}</td></tr>}
          {sale.type !== 'quote' && saleDue(sale) > 0 && <tr><td colSpan={3}>المتبقي</td><td className="num neg-txt">{money(saleDue(sale))}</td></tr>}
        </tfoot>
      </table></div>
    </div>
  )
}

/** A quotation becomes an invoice: the parts leave the stock now and the money is recorded. */
function ConvertModal({ quote, onClose, onDone }: { quote: Sale; onClose: () => void; onDone: (s: Sale) => void }) {
  const [paid, setPaid] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const paidValue = paid === null ? quote.total : Math.min(paid, quote.total)
  const go = async () => {
    setBusy(true)
    try { const s = await convertQuote(quote, paidValue); toast.success(`أُنشئت الفاتورة ${invoiceNo(s.number)}`); onDone(s) }
    catch (e) { toast.error('تعذّر التحويل: ' + (e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Modal title={`تحويل عرض السعر ${invoiceNo(quote.number)} إلى فاتورة`} onClose={onClose} size="narrow" footer={<><button className="btn primary" disabled={busy} onClick={go}>إنشاء الفاتورة</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <div className="stack">
        <div className="between"><span className="muted">الإجمالي</span><b style={{ fontSize: 18 }}>{money(quote.total)}</b></div>
        <Field label="المدفوع الآن" help={!quote.customerId && paidValue < quote.total ? 'لا عميل محدد، فلن يُسجَّل المتبقي على أحد' : undefined}><NumberInput value={paidValue} onChange={setPaid} /></Field>
        <div className="btn-row"><button className="btn sm" onClick={() => setPaid(null)}>دفع كامل</button><button className="btn sm" onClick={() => setPaid(0)}>آجل (دين)</button></div>
        <div className="small muted">ستُنقص الكميات من المخزون وتُسجَّل الحركة في الصندوق بتاريخ اليوم.</div>
      </div>
    </Modal>
  )
}

/** Returning parts from an invoice: pick the quantities, the money goes back (cash or off the customer's debt). */
function ReturnModal({ sale, onClose, onDone }: { sale: Sale; onClose: () => void; onDone: (r: Sale) => void }) {
  const [qty, setQty] = useState<number[]>(sale.items.map(() => 0))
  const [refund, setRefund] = useState<number | null>(null)
  const toast = useToast()
  const items = sale.items.map((it, i) => ({ ...it, qty: qty[i], discount: it.qty ? (it.discount * qty[i]) / it.qty : 0 })).filter(it => it.qty > 0)
  const total = items.reduce((s, i) => s + i.qty * i.price - i.discount, 0)
  const refundValue = refund === null ? total : Math.min(refund, total)
  const save = async () => {
    if (items.length === 0) { toast.error('حدد الكمية المرتجعة'); return }
    const r = await saveSale({ type: 'return', date: Date.now(), customerId: sale.customerId, customerName: sale.customerName, items, discount: 0, paid: refundValue, notes: `مرتجع من فاتورة ${invoiceNo(sale.number)}`, returnOf: sale.id })
    toast.success('تم تسجيل المرتجع'); onDone(r)
  }
  return (
    <Modal title={`مرتجع من فاتورة ${invoiceNo(sale.number)}`} onClose={onClose} footer={<><button className="btn primary" onClick={save} disabled={items.length === 0}>تسجيل المرتجع</button><button className="btn" onClick={onClose}>إلغاء</button></>}>
      <div className="stack">
        {sale.items.map((it, i) => (
          <div key={i} className="between" style={{ gap: 8 }}>
            <div><div className="bold">{it.name}</div><div className="small muted">بيع {num(it.qty, 2)} × {money(it.price)}</div></div>
            <div className="row"><span className="small muted">المرتجع</span><div style={{ width: 90 }}><NumberInput value={qty[i]} onChange={v => setQty(a => a.map((x, k) => (k === i ? Math.min(it.qty, v) : x)))} min={0} /></div></div>
          </div>
        ))}
        <div className="between" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}><b>قيمة المرتجع</b><b style={{ fontSize: 18 }}>{money(total)}</b></div>
        <Field label="المبلغ المُعاد نقداً للعميل" help={sale.customerId ? 'ما لا يُعاد نقداً يُخصم من دين العميل' : undefined}><NumberInput value={refundValue} onChange={setRefund} /></Field>
      </div>
    </Modal>
  )
}

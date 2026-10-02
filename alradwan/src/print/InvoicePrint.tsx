import { useSettings } from '../db/store'
import type { Sale } from '../db/types'
import { equiv, fmtDate, fmtDateTime, invoiceNo, money, num } from '../lib/format'
import { saleDue } from '../lib/calc'

// The invoice as printed: A4 or an 80mm receipt, chosen in the settings.
export function InvoicePrint({ sale }: { sale: Sale }) {
  const s = useSettings()
  const receipt = s.printSize === '80mm'
  const quote = sale.type === 'quote'
  const title = sale.type === 'return' ? 'فاتورة مرتجع' : quote ? 'عرض سعر' : 'فاتورة مبيعات'
  const due = saleDue(sale)
  return (
    <div dir="rtl" style={{ fontFamily: 'var(--font)', color: '#000', background: '#fff', width: receipt ? '72mm' : '100%', maxWidth: receipt ? '72mm' : '190mm', margin: '0 auto', fontSize: receipt ? 12 : 14, padding: receipt ? '2mm' : '4mm' }}>
      <style>{`.pt { width:100%; border-collapse:collapse } .pt th, .pt td { border-bottom:1px solid #999; padding:${receipt ? '3px 2px' : '7px 6px'}; text-align:right; vertical-align:top } .pt th { background:#eee; font-size:${receipt ? 11 : 13}px } .pt .n { text-align:left; direction:ltr; white-space:nowrap } .tot { display:flex; justify-content:space-between; padding:3px 0 }`}</style>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 8 }}>
        {s.logo && <img src={s.logo} alt="" style={{ height: receipt ? 40 : 64, marginBottom: 4 }} />}
        <div style={{ fontSize: receipt ? 16 : 22, fontWeight: 800 }}>{s.shopName}</div>
        {s.address && <div>{s.address}</div>}
        {s.phone && <div dir="ltr">{s.phone}</div>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        <div><b>{title}</b> رقم <b>{invoiceNo(sale.number)}</b></div>
        <div>{fmtDateTime(sale.date)}</div>
      </div>
      <div style={{ marginBottom: 8 }}><b>العميل:</b> {sale.customerName}{quote && sale.validUntil && <span style={{ float: 'left' }}>صالح حتى {fmtDate(sale.validUntil)}</span>}</div>
      <table className="pt">
        <thead><tr><th>#</th><th>الصنف</th><th className="n">الكمية</th><th className="n">السعر</th><th className="n">المجموع</th></tr></thead>
        <tbody>
          {sale.items.map((it, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{it.name}{it.code && !receipt ? <div style={{ fontSize: 11, color: '#555' }}>{it.code}</div> : null}</td>
              <td className="n">{num(it.qty, 2)}</td>
              <td className="n">{money(it.price, { currency: false, display: 'base' })}</td>
              <td className="n">{money(it.qty * it.price - (it.discount || 0), { currency: false, display: 'base' })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, marginInlineStart: receipt ? 0 : '50%' }}>
        {(sale.discount > 0 || sale.subtotal !== sale.total) && <div className="tot"><span>المجموع</span><b>{money(sale.subtotal, { display: 'base' })}</b></div>}
        {sale.discount > 0 && <div className="tot"><span>الخصم{sale.discountPct ? ` (${num(sale.discountPct, 2)}%)` : ''}</span><b>- {money(sale.discount, { display: 'base' })}</b></div>}
        <div className="tot" style={{ fontSize: receipt ? 15 : 18, borderTop: '1px solid #000', marginTop: 2 }}><span>الإجمالي</span><b>{money(sale.total, { display: 'base' })}</b></div>
        {(sale.rate ?? s.rate) > 0 && <div className="tot" style={{ fontSize: receipt ? 11 : 12, color: '#444' }}><span>ما يعادل (1 $ = {(sale.rate ?? s.rate).toLocaleString('en-US')} ل.س)</span><b>{equiv(sale.total, sale.rate ?? s.rate).replace('≈ ', '')}</b></div>}
        {!quote && sale.paid !== sale.total && <>
          <div className="tot"><span>المدفوع</span><b>{money(sale.paid, { display: 'base' })}</b></div>
          <div className="tot"><span>{sale.type === 'return' ? 'المتبقي للعميل' : 'المتبقي'}</span><b>{money(due, { display: 'base' })}</b></div>
        </>}
      </div>
      {sale.notes && <div style={{ marginTop: 8, fontSize: 12 }}>ملاحظات: {sale.notes}</div>}
      {quote && <div style={{ marginTop: 8, fontSize: 11, color: '#444' }}>هذا عرض سعر وليس فاتورة؛ الأسعار قابلة للتغيير بعد انتهاء مدة العرض.</div>}
      {s.invoiceFooter && <div style={{ textAlign: 'center', marginTop: 12, borderTop: '1px dashed #999', paddingTop: 6 }}>{s.invoiceFooter}</div>}
    </div>
  )
}

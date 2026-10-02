import { useSettings } from '../db/store'
import { fmtDate, fmtDateTime, money, num } from '../lib/format'

export interface DailyDoc {
  from: number; to: number
  sales: { count: number; total: number; cash: number; credit: number; returns: number; profit?: number }
  purchases: { count: number; total: number; paid: number }
  collected: number; paidOut: number; expenses: { category: string; amount: number }[]; cashIn: number; cashOut: number
  opening: number; closing: number
  byUser: { name: string; count: number; total: number }[]
  topItems: { name: string; qty: number; total: number }[]
}

/** The end-of-day sheet: what was sold, what came in and went out, and what should be in the drawer. */
export function DailyPrint({ from, to, sales, purchases, collected, paidOut, expenses, cashIn, cashOut, opening, closing, byUser, topItems }: DailyDoc) {
  const s = useSettings()
  const oneDay = fmtDate(from) === fmtDate(to)
  const expTotal = expenses.reduce((t, e) => t + e.amount, 0)
  const Row = ({ l, v, bold }: { l: string; v: string; bold?: boolean }) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dotted #ccc', fontWeight: bold ? 700 : 400 }}><span>{l}</span><span dir="ltr">{v}</span></div>
  return (
    <div dir="rtl" style={{ fontFamily: 'var(--font)', color: '#000', background: '#fff', maxWidth: '190mm', margin: '0 auto', fontSize: 13, padding: '4mm' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{s.shopName}</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{oneDay ? `تقرير إغلاق يوم ${fmtDate(from)}` : `تقرير الفترة ${fmtDate(from)} — ${fmtDate(to)}`}</div>
        <div style={{ fontSize: 11, color: '#555' }}>طُبع {fmtDateTime(Date.now())}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>المبيعات</h3>
          <Row l="عدد الفواتير" v={String(sales.count)} />
          <Row l="إجمالي المبيعات" v={money(sales.total, { display: 'base' })} bold />
          <Row l="منها نقداً" v={money(sales.cash, { display: 'base' })} />
          <Row l="منها آجل (دين)" v={money(sales.credit, { display: 'base' })} />
          {sales.returns > 0 && <Row l="مرتجعات (نقد مُعاد)" v={money(sales.returns, { display: 'base' })} />}
          {sales.profit !== undefined && <Row l="ربح المبيعات" v={money(sales.profit, { display: 'base' })} bold />}
          <h3 style={{ margin: '12px 0 4px', fontSize: 14 }}>المشتريات</h3>
          <Row l="عدد الفواتير" v={String(purchases.count)} />
          <Row l="إجمالي المشتريات" v={money(purchases.total, { display: 'base' })} />
          <Row l="المدفوع منها" v={money(purchases.paid, { display: 'base' })} />
        </div>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>الصندوق</h3>
          <Row l="رصيد أول الفترة" v={money(opening, { display: 'base' })} />
          <Row l="+ مبيعات نقدية" v={money(sales.cash - sales.returns, { display: 'base' })} />
          <Row l="+ تحصيل من العملاء" v={money(collected, { display: 'base' })} />
          {cashIn > 0 && <Row l="+ إيداعات" v={money(cashIn, { display: 'base' })} />}
          <Row l="− مشتريات مدفوعة" v={money(purchases.paid, { display: 'base' })} />
          <Row l="− دفع للموردين" v={money(paidOut, { display: 'base' })} />
          <Row l="− مصاريف" v={money(expTotal, { display: 'base' })} />
          {cashOut > 0 && <Row l="− سحوبات" v={money(cashOut, { display: 'base' })} />}
          <Row l="رصيد آخر الفترة (ما يجب أن يكون في الصندوق)" v={money(closing, { display: 'base' })} bold />
          {expenses.length > 0 && <>
            <h3 style={{ margin: '12px 0 4px', fontSize: 14 }}>المصاريف</h3>
            {expenses.map(e => <Row key={e.category} l={e.category} v={money(e.amount, { display: 'base' })} />)}
          </>}
        </div>
      </div>
      {byUser.length > 1 && <><h3 style={{ margin: '12px 0 4px', fontSize: 14 }}>حسب الموظف</h3>{byUser.map(u => <Row key={u.name} l={`${u.name} (${u.count} فاتورة)`} v={money(u.total, { display: 'base' })} />)}</>}
      {topItems.length > 0 && <><h3 style={{ margin: '12px 0 4px', fontSize: 14 }}>الأكثر مبيعاً</h3>{topItems.map(i => <Row key={i.name} l={`${i.name} × ${num(i.qty, 2)}`} v={money(i.total, { display: 'base' })} />)}</>}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>توقيع الموظف: ______________</span><span>توقيع صاحب المحل: ______________</span></div>
    </div>
  )
}

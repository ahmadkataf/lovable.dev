import { useSettings } from '../db/store'
import { fmtDate, money } from '../lib/format'

export interface StatementDoc {
  title: string
  party: { name: string; phone?: string }
  lines: { date: number; label: string; debit: number; credit: number }[]
  opening: number
  closingLabel: string
}

// Account statement of a customer or a supplier: every invoice and payment with the running balance.
export function StatementPrint({ title, party, lines, opening, closingLabel }: StatementDoc) {
  const s = useSettings()
  let bal = opening
  const rows = [...lines].sort((a, b) => a.date - b.date).map(l => { bal += l.debit - l.credit; return { ...l, bal } })
  return (
    <div dir="rtl" style={{ fontFamily: 'var(--font)', color: '#000', background: '#fff', maxWidth: '190mm', margin: '0 auto', fontSize: 13, padding: '4mm' }}>
      <style>{`.pt { width:100%; border-collapse:collapse } .pt th, .pt td { border-bottom:1px solid #999; padding:6px; text-align:right } .pt th { background:#eee } .pt .n { text-align:left; direction:ltr; white-space:nowrap }`}</style>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{s.shopName}</div>
        {s.phone && <div dir="ltr">{s.phone}</div>}
      </div>
      <h2 style={{ margin: '0 0 6px' }}>{title}</h2>
      <div style={{ marginBottom: 10 }}><b>{party.name}</b> {party.phone && <span dir="ltr"> — {party.phone}</span>} <span style={{ float: 'left' }}>تاريخ الطباعة: {fmtDate(Date.now())}</span></div>
      <table className="pt">
        <thead><tr><th>التاريخ</th><th>البيان</th><th className="n">له</th><th className="n">عليه</th><th className="n">الرصيد</th></tr></thead>
        <tbody>
          <tr><td></td><td>رصيد افتتاحي</td><td className="n"></td><td className="n"></td><td className="n">{money(opening, { currency: false })}</td></tr>
          {rows.map((r, i) => <tr key={i}><td>{fmtDate(r.date)}</td><td>{r.label}</td><td className="n">{r.credit ? money(r.credit, { currency: false }) : ''}</td><td className="n">{r.debit ? money(r.debit, { currency: false }) : ''}</td><td className="n">{money(r.bal, { currency: false })}</td></tr>)}
        </tbody>
      </table>
      <div style={{ marginTop: 10, fontSize: 16, textAlign: 'left' }}><b>{closingLabel}: {money(bal)}</b></div>
    </div>
  )
}

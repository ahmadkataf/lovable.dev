import { useSettings } from '../db/store'
import { fmtDateTime } from '../lib/format'

export interface ReportTable { title?: string; columns: { label: string; num?: boolean }[]; rows: (string | number)[][]; footer?: (string | number)[] }
export interface ReportDoc { title: string; subtitle?: string; tables: ReportTable[]; note?: string }

/** Any accounting report as a printed page: the shop's name, a title, one or more tables. */
export function ReportPrint({ title, subtitle, tables, note }: ReportDoc) {
  const s = useSettings()
  return (
    <div dir="rtl" style={{ fontFamily: 'var(--font)', color: '#000', background: '#fff', maxWidth: '190mm', margin: '0 auto', fontSize: 12.5, padding: '4mm' }}>
      <style>{`.rt { width:100%; border-collapse:collapse; margin-bottom:10px } .rt th, .rt td { border-bottom:1px solid #999; padding:5px 6px; text-align:right; vertical-align:top } .rt th { background:#eee; font-size:12px } .rt .n { text-align:left; direction:ltr; white-space:nowrap; font-variant-numeric: tabular-nums } .rt tfoot td { font-weight:700; background:#f3f3f3 }`}</style>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{s.shopName}</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12 }}>{subtitle}</div>}
        <div style={{ fontSize: 11, color: '#555' }}>طُبع {fmtDateTime(Date.now())}</div>
      </div>
      {tables.map((t, i) => (
        <div key={i}>
          {t.title && <h3 style={{ margin: '8px 0 4px', fontSize: 14 }}>{t.title}</h3>}
          <table className="rt">
            <thead><tr>{t.columns.map((c, k) => <th key={k} className={c.num ? 'n' : ''}>{c.label}</th>)}</tr></thead>
            <tbody>{t.rows.map((r, k) => <tr key={k}>{r.map((v, j) => <td key={j} className={t.columns[j]?.num ? 'n' : ''}>{v}</td>)}</tr>)}</tbody>
            {t.footer && <tfoot><tr>{t.footer.map((v, j) => <td key={j} className={t.columns[j]?.num ? 'n' : ''}>{v}</td>)}</tr></tfoot>}
          </table>
        </div>
      ))}
      {note && <div style={{ fontSize: 11, color: '#444', marginTop: 6 }}>{note}</div>}
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import type { ReportData } from '@shared/types'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { daysAgo, fmtMoney, fmtNumber, today } from '../lib/format'
import { Icon } from '../components/Icons'
import { Spinner } from '../components/ui'

const C = { sales: 'var(--primary)', income: '#22c55e', expense: '#ef4444', orders: '#8b5cf6' }

/** A responsive line/area chart drawn with plain SVG. */
function LineChart({ series, labels }: { series: { key: string; color: string; values: number[] }[]; labels: string[] }) {
  const W = 720, H = 240, pl = 44, pr = 12, pt = 14, pb = 30
  const max = Math.max(1, ...series.flatMap(s => s.values))
  const n = labels.length
  const x = (i: number) => pl + (n <= 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1))
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max)
  const ticks = [0, .25, .5, .75, 1].map(f => Math.round(max * f))
  const step = Math.max(1, Math.ceil(n / 8))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {ticks.map(t => <g key={t}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--border)" /><text x={pl - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="Inter">{fmtNumber(t)}</text></g>)}
      {series.map(s => {
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`)
        const path = `M${pts.join(' L')}`
        return (
          <g key={s.key}>
            {n > 1 && <path d={`${path} L${x(n - 1)},${y(0)} L${x(0)},${y(0)}Z`} fill={s.color} opacity=".08" />}
            <path d={path} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={n > 40 ? 0 : 3} fill={s.color}><title>{labels[i]}: {fmtNumber(v)}</title></circle>)}
          </g>
        )
      })}
      {labels.map((l, i) => (i % step === 0 || i === n - 1) && <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-3)" fontFamily="Inter">{l.slice(5)}</text>)}
    </svg>
  )
}

function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const W = 720, H = 220, pl = 44, pr = 12, pt = 14, pb = 30
  const max = Math.max(1, ...data.map(d => d.value))
  const n = Math.max(1, data.length)
  const bw = (W - pl - pr) / n
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {[0, .5, 1].map(f => <g key={f}><line x1={pl} x2={W - pr} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" /><text x={pl - 6} y={y(max * f) + 4} textAnchor="end" fontSize="10" fill="var(--text-3)" fontFamily="Inter">{fmtNumber(Math.round(max * f))}</text></g>)}
      {data.map((d, i) => <g key={i}><rect x={pl + i * bw + bw * .2} y={y(d.value)} width={bw * .6} height={H - pb - y(d.value)} rx="4" fill={color}><title>{d.label}: {fmtNumber(d.value)}</title></rect><text x={pl + i * bw + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-3)" fontFamily="Inter">{d.label}</text></g>)}
    </svg>
  )
}

export function ReportsPage() {
  const { settings, toast } = useStore()
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(today())
  const [r, setR] = useState<ReportData | null>(null)
  useEffect(() => { api.admin.reports(from, to).then(setR).catch(e => toast((e as Error).message, 'err')) }, [from, to])
  const quick = (d: number) => { setFrom(daysAgo(d)); setTo(today()) }
  const daily = useMemo(() => {
    if (!r) return []
    // fill the missing days so the chart has one point per day
    const map = new Map(r.daily.map(d => [d.date, d]))
    const out: ReportData['daily'] = []
    for (let t = new Date(from); t <= new Date(to); t.setDate(t.getDate() + 1)) { const k = t.toISOString().slice(0, 10); out.push(map.get(k) || { date: k, sales: 0, orders: 0, income: 0, expense: 0 }) }
    return out
  }, [r, from, to])
  if (!r) return <Spinner />
  const net = r.totals.income - r.totals.expense
  const incomeCats = r.ledgerByCategory.filter(c => c.type === 'income'), expenseCats = r.ledgerByCategory.filter(c => c.type === 'expense')
  const maxCat = Math.max(1, ...r.ledgerByCategory.map(c => c.amount))
  return (
    <>
      <div className="admin-top"><div><h1>التقارير</h1><p>المبيعات والإيرادات والمصاريف حسب الفترة.</p></div><button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Icon.Printer />طباعة</button></div>
      <div className="toolbar">
        <div className="pill-tabs"><button onClick={() => quick(6)}>7 أيام</button><button onClick={() => quick(29)}>30 يوم</button><button onClick={() => quick(89)}>3 أشهر</button><button onClick={() => quick(364)}>سنة</button></div>
        <input className="input input-sm num" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 'auto' }} /><span className="muted">→</span><input className="input input-sm num" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 'auto' }} />
      </div>
      <div className="kpis">
        <div className="kpi"><span className="ico"><Icon.Package /></span><div className="l">طلبات مؤكّدة</div><div className="v">{r.totals.orders}</div><div className="s">{r.totals.tickets} طلب صيانة</div></div>
        <div className="kpi green"><span className="ico"><Icon.TrendUp /></span><div className="l">الوارد</div><div className="v">{fmtMoney(r.totals.income, settings)}</div></div>
        <div className="kpi red"><span className="ico"><Icon.TrendDown /></span><div className="l">الصادر</div><div className="v">{fmtMoney(r.totals.expense, settings)}</div></div>
        <div className={`kpi ${net >= 0 ? 'green' : 'red'}`}><span className="ico"><Icon.Dollar /></span><div className="l">صافي الربح</div><div className="v">{fmtMoney(net, settings)}</div><div className="s">{r.totals.income ? `هامش ${Math.round((net / r.totals.income) * 100)}%` : ''}</div></div>
      </div>
      <div className="two-col">
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <h3>الوارد والصادر يومياً</h3>
          <LineChart labels={daily.map(d => d.date)} series={[{ key: 'income', color: C.income, values: daily.map(d => d.income) }, { key: 'expense', color: C.expense, values: daily.map(d => d.expense) }, { key: 'sales', color: C.sales, values: daily.map(d => d.sales) }]} />
          <div className="legend"><span><i style={{ background: C.income }} />وارد</span><span><i style={{ background: C.expense }} />صادر</span><span><i style={{ background: C.sales }} />قيمة الطلبات المؤكّدة</span></div>
        </div>
        <div className="panel">
          <h3>المبيعات شهرياً</h3>
          <BarChart data={r.monthly.map(m => ({ label: m.month, value: m.sales }))} color={C.sales} />
        </div>
        <div className="panel">
          <h3>عدد الطلبات شهرياً</h3>
          <BarChart data={r.monthly.map(m => ({ label: m.month, value: m.orders }))} color={C.orders} />
        </div>
        <div className="panel">
          <h3>الأكثر مبيعاً</h3>
          {r.topProducts.length === 0 ? <p className="muted small">لا مبيعات في الفترة</p> : <div className="bar-list">{r.topProducts.map(p => <div key={p.productId} className="b"><span>{p.name} <span className="hint">× {p.qty}</span></span><span className="num">{fmtMoney(p.revenue, settings)}</span><div className="track"><div className="fill" style={{ width: `${(p.revenue / r.topProducts[0].revenue) * 100}%` }} /></div></div>)}</div>}
        </div>
        <div className="panel">
          <h3>حسب التصنيف</h3>
          <div className="bar-list">
            {incomeCats.map(c => <div key={'i' + c.category} className="b"><span>{c.category} <span className="hint">وارد</span></span><span className="num">{fmtMoney(c.amount, settings)}</span><div className="track"><div className="fill" style={{ width: `${(c.amount / maxCat) * 100}%`, background: C.income }} /></div></div>)}
            {expenseCats.map(c => <div key={'e' + c.category} className="b"><span>{c.category} <span className="hint">صادر</span></span><span className="num">{fmtMoney(c.amount, settings)}</span><div className="track"><div className="fill" style={{ width: `${(c.amount / maxCat) * 100}%`, background: C.expense }} /></div></div>)}
            {!r.ledgerByCategory.length && <p className="muted small">لا قيود في الفترة</p>}
          </div>
        </div>
      </div>
    </>
  )
}

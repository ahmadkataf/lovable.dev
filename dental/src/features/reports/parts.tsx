// Building blocks shared by the reports page and the dashboard: KPI cards, chart cards with a table view,
// plural-aware counts, period / bucket labels and the CSV download.
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Minus, Table2, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardBody, CardHeader, DataTable, IconButton, Skeleton, type Column } from '@/ui'
import { useI18n } from '@/i18n'
import type { Lang } from '@/db/types'
import { fmtDate, fmtMonth, fromISODate } from '@/lib/dates'
import { formatNumber } from '@/lib/format'
import { saveText } from '@/platform'
import { toCSV, type Bucket, type Period, type Unit } from './queries'
import './reports.css'

// ---- KPI card -----------------------------------------------------------------------------------------

export type KpiTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'pink' | 'orange'
export interface KpiCardProps {
  label: ReactNode
  value: ReactNode
  icon: ReactNode
  tone?: KpiTone
  /** % change vs the comparison period; null = nothing to compare with. */
  delta?: number | null
  deltaLabel?: ReactNode
  /** Is a rise good news? (revenue yes, no-shows no) */
  upIsGood?: boolean
  sub?: ReactNode
  spark?: ReactNode
  to?: string
  loading?: boolean
  testId?: string
}
export function KpiCard({ label, value, icon, tone = 'primary', delta, deltaLabel, upIsGood = true, sub, spark, to, loading, testId }: KpiCardProps) {
  const body = (
    <>
      <div className="rp-kpi-top"><span className="rp-kpi-icon">{icon}</span><span className="rp-kpi-label">{label}</span></div>
      {loading ? <Skeleton h={30} w="60%" r={8} /> : <div className="rp-kpi-value">{value}</div>}
      {loading ? <div className="rp-kpi-foot"><Skeleton h={12} w="45%" /></div> : <>
        {delta !== undefined && delta !== null && <div className="rp-kpi-foot"><Delta value={delta} upIsGood={upIsGood} />{deltaLabel}</div>}
        {sub && <div className="rp-kpi-sub">{sub}</div>}
        {(delta === undefined || delta === null) && !sub && <div className="rp-kpi-foot" />}
      </>}
      {spark && !loading && <div className="rp-kpi-spark">{spark}</div>}
    </>
  )
  const cls = `card rp-kpi rp-tone-${tone}`
  return to
    ? <Link to={to} className={cls} data-testid={testId}>{body}</Link>
    : <div className={cls} data-testid={testId}>{body}</div>
}

/** Signed % pill; colour = direction × whether up is good. */
export function Delta({ value, upIsGood = true }: { value: number | null; upIsGood?: boolean }) {
  const { lang } = useI18n()
  if (value === null) return null
  const flat = Math.abs(value) < 0.05
  const good = flat ? 'flat' : (value > 0) === upIsGood ? 'good' : 'bad'
  const Icon = flat ? Minus : value > 0 ? TrendingUp : TrendingDown
  const n = Math.abs(value) >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  return <span className={`rp-delta ${good}`}><Icon />{value > 0 ? '+' : ''}{formatNumber(n, lang, Number.isInteger(n) ? 0 : 1)}%</span>
}

// ---- chart card ---------------------------------------------------------------------------------------

export interface TableSpec { columns: { key: string; header: ReactNode; num?: boolean }[]; rows: Record<string, ReactNode>[] }
export function MiniTable({ spec }: { spec: TableSpec }) {
  const cols: Column<Record<string, ReactNode>>[] = spec.columns.map(c => ({ key: c.key, header: c.header, className: c.num ? 'num' : undefined, render: r => r[c.key] }))
  return <div className="rp-mini-table"><DataTable compact columns={cols} rows={spec.rows} rowKey={r => String(spec.rows.indexOf(r))} /></div>
}

export interface ChartCardProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  /** The chart's table twin (a toggle in the header switches to it). */
  table?: TableSpec
  actions?: ReactNode
  loading?: boolean
  /** Shown instead of the chart when there is nothing to plot. */
  empty?: ReactNode
  height?: number
  className?: string
  children?: ReactNode
  testId?: string
}
export function ChartCard({ title, subtitle, icon, table, actions, loading, empty, height = 240, className, children, testId }: ChartCardProps) {
  const { t } = useI18n()
  const [asTable, setAsTable] = useState(false)
  const toggle = table && !loading && !empty
    ? <IconButton size="sm" variant="ghost" label={asTable ? t('reports.showChart') : t('reports.showTable')} onClick={() => setAsTable(v => !v)}>{asTable ? <BarChart3 /> : <Table2 />}</IconButton>
    : null
  return (
    <Card className={['rp-card', className].filter(Boolean).join(' ')} data-testid={testId}>
      <CardHeader title={title} subtitle={subtitle} icon={icon} actions={actions || toggle ? <>{actions}{toggle}</> : undefined} />
      <CardBody>
        {loading ? <ChartSkeleton height={height} />
          : empty ? empty
          : asTable && table ? <MiniTable spec={table} />
          : children}
      </CardBody>
    </Card>
  )
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  const bars = [52, 74, 40, 88, 63, 96, 58, 80, 45, 70]
  return (
    <div style={{ height, display: 'flex', alignItems: 'flex-end', gap: 10, padding: '8px 4px 26px' }} aria-busy="true">
      {bars.map((h, i) => <Skeleton key={i} h={`${h}%`} r={6} style={{ flex: 1 }} />)}
    </div>
  )
}

export function CardEmpty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="rp-card-empty">{icon}<div>{children}</div></div>
}

// ---- words & numbers ----------------------------------------------------------------------------------

const RULES: Record<Lang, Intl.PluralRules> = { ar: new Intl.PluralRules('ar'), en: new Intl.PluralRules('en') }
/** Plural-aware counts: plural('reports.n.patients', 3) → "3 مرضى" / "3 patients" (keys .zero/.one/.two/.few/.many/.other). */
export function usePlural() {
  const { t, lang } = useI18n()
  return (key: string, n: number) => {
    const cat = RULES[lang].select(n)
    const k = `${key}.${cat}`
    const s = t(k, { n: formatNumber(n, lang) })
    return s === k.slice(k.indexOf('.') + 1) ? t(`${key}.other`, { n: formatNumber(n, lang) }) : s
  }
}

const LOCALE = (lang: Lang) => (lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB')
/** "1–31 Oct 2026", "28 Sep – 4 Oct 2026", a whole month as "October 2026". */
export function fmtRange(from: string, to: string, lang: Lang): string {
  if (from === to) return fmtDate(from, lang, 'long')
  const a = fromISODate(from), b = fromISODate(to)
  const lastDay = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate()
  if (a.getDate() === 1 && b.getDate() === lastDay && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return fmtMonth(from, lang)
  const f = new Intl.DateTimeFormat(LOCALE(lang), { day: 'numeric', month: 'short', year: 'numeric' }) as Intl.DateTimeFormat & { formatRange?: (x: Date, y: Date) => string }
  if (typeof f.formatRange === 'function') return f.formatRange(a, b)
  return `${fmtDate(from, lang)} – ${fmtDate(to, lang)}`
}
export const fmtPeriod = (p: Period, lang: Lang) => fmtRange(p.from, p.to, lang)

const dtfCache = new Map<string, Intl.DateTimeFormat>()
function dtf(lang: Lang, o: Intl.DateTimeFormatOptions) {
  const k = lang + JSON.stringify(o)
  let f = dtfCache.get(k)
  if (!f) { f = new Intl.DateTimeFormat(LOCALE(lang), o); dtfCache.set(k, f) }
  return f
}
/** Short x-axis label for a bucket (Latin digits). */
export function bucketLabel(b: Bucket, unit: Unit, lang: Lang, multiYear = false): string {
  const d = fromISODate(b.from)
  if (unit === 'day') return String(d.getDate())
  if (unit === 'week') return `${d.getDate()}/${d.getMonth() + 1}`
  return dtf(lang, multiYear ? { month: 'short', year: '2-digit' } : { month: 'short' }).format(fromISODate(`${b.key}-01`))
}
/** Tooltip heading for a bucket. */
export function bucketTitle(b: Bucket, unit: Unit, lang: Lang): string {
  if (unit === 'day') return fmtDate(b.from, lang, 'weekday')
  if (unit === 'week') return fmtRange(b.from, b.to, lang)
  return fmtMonth(`${b.key}-01`, lang)
}
/** Labels/titles for a bucket list, deciding once whether the axis spans several years. */
export function useBucketText(list: Bucket[], unit: Unit) {
  const { lang } = useI18n()
  return useMemo(() => {
    const multi = list.length > 0 && list[0].from.slice(0, 4) !== list[list.length - 1].from.slice(0, 4)
    return list.map(b => ({ label: bucketLabel(b, unit, lang, multi), title: bucketTitle(b, unit, lang) }))
  }, [list, unit, lang])
}

/** Writes rows as a UTF-8 CSV that Excel opens with Arabic intact (BOM). */
export async function downloadCSV(name: string, rows: (string | number | null | undefined)[][]): Promise<boolean> {
  return saveText(name, '﻿' + toCSV(rows), 'text/csv;charset=utf-8')
}

/** Wraps a number / amount for use inside a sentence so its digits, sign and symbol stay together (LRI … PDI). */
export const iso = (s: string | number) => `\u2066${s}\u2069`

/** Categorical slots in their fixed order. */
export const SLOTS = ['var(--rp-c1)', 'var(--rp-c2)', 'var(--rp-c3)', 'var(--rp-c4)', 'var(--rp-c5)', 'var(--rp-c6)', 'var(--rp-c7)', 'var(--rp-c8)']
export const ORDINAL = ['var(--rp-o1)', 'var(--rp-o2)', 'var(--rp-o3)', 'var(--rp-o4)', 'var(--rp-o5)']

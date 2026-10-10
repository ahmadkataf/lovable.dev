// Hand-written, responsive SVG charts (no libraries). Every chart measures its container with a ResizeObserver,
// draws in a dir="ltr" frame (time reads left → right in both languages), shows a tooltip on hover / tap / keyboard
// focus, labels its axes with Latin digits, and carries an accessible title + description. Colours come from the
// design tokens (see reports.css: --rp-c1…c8, validated with the dataviz palette checker).
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { arcPath, barPath, compactNumber, countTicks, donutAngles, labelStride, monotonePath, niceTicks, share, textWidth } from './chartMath'
import './reports.css'

export interface ChartSeries { id: string; label: string; color: string }
/** One x position: `label` is the axis text, `title` the tooltip heading; values[i] belongs to series[i]. */
export interface ChartDatum { label: string; title?: string; values: number[] }
type Fmt = (n: number) => string

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))
const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '')

// ---- measuring & hovering -----------------------------------------------------------------------------

/** Size of the element, kept current with a ResizeObserver (0 until the first measure). */
export function useSize<T extends HTMLElement = HTMLDivElement>(): [React.RefObject<T | null>, number, number] {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const set = (w: number, h: number) => setSize(prev => (Math.abs(prev.w - w) >= 1 || Math.abs(prev.h - h) >= 1 ? { w: Math.floor(w), h: Math.floor(h) } : prev))
    const r = el.getBoundingClientRect()
    set(r.width, r.height)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => { for (const e of entries) set(e.contentRect.width, e.contentRect.height) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size.w, size.h]
}
/** Width of the element (see useSize). */
export function useWidth<T extends HTMLElement = HTMLDivElement>(): [React.RefObject<T | null>, number] {
  const [ref, w] = useSize<T>()
  return [ref, w]
}

/** Active index for hover / tap / arrow keys; a tap outside the chart clears it. */
function useActive(count: number, mirror = false) {
  const [active, setActive] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (active === null) return
    const h = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setActive(null) }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [active])
  const onKeyDown = (e: KeyboardEvent) => {
    if (!count) return
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (e.key === 'Escape') { setActive(null); return }
    if (!step) return
    e.preventDefault()
    setActive(a => clamp((a ?? (step > 0 ? -1 : count)) + (mirror ? -step : step), 0, count - 1))
  }
  const focusProps = { tabIndex: 0, onKeyDown, onFocus: () => setActive(a => a ?? 0), onBlur: () => setActive(null) }
  const leave = (e: ReactPointerEvent) => { if (e.pointerType === 'mouse') setActive(null) }
  return { active, setActive, root, focusProps, leave }
}

/** Tooltip: measures itself, stays inside the chart, flips below the point near the top edge. */
function Tip({ x, y, frameWidth, children }: { x: number; y: number; frameWidth: number; children: ReactNode }) {
  const { dir } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (el && (el.offsetWidth !== size.w || el.offsetHeight !== size.h)) setSize({ w: el.offsetWidth, h: el.offsetHeight })
  })
  const left = clamp(x - size.w / 2, 2, Math.max(2, frameWidth - size.w - 2))
  const top = y - size.h - 12 < 0 ? y + 14 : y - size.h - 12
  return <div ref={ref} className="rp-tip" dir={dir} role="status" style={{ left, top, visibility: size.w ? 'visible' : 'hidden' }}>{children}</div>
}
export function TipTitle({ children }: { children: ReactNode }) { return <div className="rp-tip-title">{children}</div> }
export function TipRow({ color, value, label, kind = 'line' }: { color?: string; value: ReactNode; label?: ReactNode; kind?: 'line' | 'rect' }) {
  return (
    <div className="rp-tip-row">
      {color && <span className={kind === 'rect' ? 'rp-key-rect' : 'rp-key-line'} style={{ background: color }} />}
      <span className="rp-tip-val">{value}</span>
      {label && <span className="rp-tip-lbl">{label}</span>}
    </div>
  )
}

/** Legend: rect swatches for bars / areas, line keys for lines; text in text tokens, never the series colour. */
export function Legend({ items, className }: { items: { label: ReactNode; color: string; kind?: 'rect' | 'line' }[]; className?: string }) {
  return (
    <ul className={['rp-legend', className].filter(Boolean).join(' ')}>
      {items.map((it, i) => <li key={i}><span className={it.kind === 'line' ? 'rp-key-line' : 'rp-key-rect'} style={{ background: it.color }} />{it.label}</li>)}
    </ul>
  )
}

/** Shared y-axis maths: ticks, their labels, the gutter they need. */
function useYAxis(max: number, min: number, integer: boolean | undefined, axisFormat: Fmt) {
  return useMemo(() => {
    const span = Math.max(max, 0) - Math.min(min, 0)
    let ticks = integer ? countTicks(span) : niceTicks(span)
    let lo = 0
    if (min < 0) {
      const step = ticks[1] - ticks[0]
      if (-min < step / 2 && max > 0) {
        // a small dip (a refund day): extend the plot just below zero, no extra negative gridline
        lo = min * 1.15
        ticks = (integer ? countTicks(max) : niceTicks(max))
      } else {
        lo = Math.floor(min / step) * step; ticks = []
        for (let v = lo; v <= Math.max(max, 0) + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
      }
    }
    const labels = ticks.map(v => axisFormat(v))
    const gutter = Math.ceil(Math.max(...labels.map(s => textWidth(s, 11)))) + 10
    return { ticks, labels, gutter, lo: Math.min(lo, ticks[0], 0), hi: ticks[ticks.length - 1] || 1 }
  }, [max, min, integer, axisFormat])
}

interface FrameProps { title: string; desc?: string; height: number; width: number; children: ReactNode }
function SvgFrame({ title, desc, height, width, children }: FrameProps) {
  const id = safeId(useId())
  return (
    <svg className="rp-svg" viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-labelledby={`${id}t${desc ? ` ${id}d` : ''}`} preserveAspectRatio="xMidYMid meet">
      <title id={`${id}t`}>{title}</title>
      {desc && <desc id={`${id}d`}>{desc}</desc>}
      {children}
    </svg>
  )
}

// ---- BarChart (vertical, optionally grouped) ----------------------------------------------------------

export interface BarChartProps {
  data: ChartDatum[]
  series: ChartSeries[]
  /** Per-bar colours for a single series (an ordinal ramp); otherwise each series has its colour. */
  barColors?: string[]
  height?: number
  format: Fmt
  axisFormat?: Fmt
  integer?: boolean
  title: string
  desc?: string
  /** Mirror the category order in RTL (only for non-time categories). */
  mirror?: boolean
  /** Write the value over the tallest bar. */
  labelPeak?: boolean
  legend?: boolean
  /** Grow to the height of the card (charts paired side by side in a row); `height` is the minimum. */
  fill?: boolean
}
export function BarChart({ data, series, barColors, height: minH = 240, format, axisFormat = compactNumber, integer, title, desc, mirror = false, labelPeak = true, legend, fill }: BarChartProps) {
  const { isRTL } = useI18n()
  const [ref, width, boxH] = useSize()
  const height = fill ? Math.max(minH, boxH) : minH
  const flip = mirror && isRTL
  const n = data.length, k = Math.max(1, series.length)
  const { active, setActive, root, focusProps, leave } = useActive(n, flip)
  const max = Math.max(0, ...data.flatMap(d => d.values))
  const y = useYAxis(max, 0, integer, axisFormat)
  const padTop = labelPeak ? 22 : 10, padBottom = 26
  const plotL = flip ? 6 : y.gutter, plotR = width - (flip ? y.gutter : 6)
  const plotW = Math.max(10, plotR - plotL), plotH = Math.max(10, height - padTop - padBottom)
  const band = n ? plotW / n : plotW
  const barW = clamp((band * 0.72 - 2 * (k - 1)) / k, 2, 24)
  const groupW = barW * k + 2 * (k - 1)
  const slot = (i: number) => (flip ? n - 1 - i : i)
  const cx = (i: number) => plotL + slot(i) * band + band / 2
  const yOf = (v: number) => padTop + plotH - ((v - y.lo) / (y.hi - y.lo || 1)) * plotH
  const labelW = Math.max(0, ...data.map(d => textWidth(d.label, 11)))
  const stride = labelStride(n, plotW, labelW)
  let peak = -1, peakV = 0
  if (labelPeak) data.forEach((d, i) => d.values.forEach(v => { if (v > peakV) { peakV = v; peak = i } }))
  const colorOf = (si: number, i: number) => (barColors && k === 1 ? barColors[i % barColors.length] : series[si]?.color ?? 'var(--rp-c1)')
  const pick = (e: ReactPointerEvent<SVGElement>) => {
    const r = (e.currentTarget.ownerSVGElement ?? (e.currentTarget as unknown as SVGSVGElement)).getBoundingClientRect()
    const vx = ((e.clientX - r.left) / r.width) * width
    const s = Math.floor((vx - plotL) / band)
    setActive(s >= 0 && s < n ? (flip ? n - 1 - s : s) : null)
  }
  const showLegend = legend ?? series.length > 1
  return (
    <div ref={root} className="rp-chart-wrap">
      {showLegend && <Legend items={series.map(s => ({ label: s.label, color: s.color }))} />}
      <div ref={ref} className={`rp-chart${fill ? ' fill' : ''}`} dir="ltr" style={{ minHeight: minH }} {...focusProps} aria-label={title}>
        {width > 0 && (
          <SvgFrame title={title} desc={desc} width={width} height={height}>
            {y.ticks.map((tv, i) => (
              <g key={i}>
                <line x1={plotL} x2={plotR} y1={yOf(tv)} y2={yOf(tv)} className={tv === 0 ? 'rp-base' : 'rp-grid'} />
                <text x={flip ? plotR + 6 : plotL - 8} y={yOf(tv)} dy="0.32em" textAnchor={flip ? 'start' : 'end'} className="rp-tick">{y.labels[i]}</text>
              </g>
            ))}
            {active !== null && <rect x={cx(active) - Math.min(band, groupW + 14) / 2} y={padTop - 4} width={Math.min(band, groupW + 14)} height={plotH + 4} rx={6} className="rp-hoverband" />}
            {data.map((d, i) => (
              <g key={i}>
                {d.values.map((v, si) => {
                  const x = cx(i) - groupW / 2 + si * (barW + 2)
                  const top = yOf(Math.max(0, v))
                  return <path key={si} d={barPath(x, top, barW, yOf(0) - top)} style={{ fill: colorOf(si, i) }} className={active !== null && active !== i ? 'rp-dim' : undefined} />
                })}
                {i % stride === 0 && <text x={cx(i)} y={height - 8} textAnchor="middle" className="rp-tick">{d.label}</text>}
              </g>
            ))}
            {peak >= 0 && peakV > 0 && (
              <text x={clamp(cx(peak), plotL + 20, plotR - 20)} y={yOf(peakV) - 7} textAnchor="middle" className="rp-peak">{format(peakV)}</text>
            )}
            <rect x={plotL} y={0} width={plotW} height={height} fill="transparent" onPointerMove={pick} onPointerDown={pick} onPointerLeave={leave} />
          </SvgFrame>
        )}
        {active !== null && width > 0 && data[active] && (
          <Tip x={cx(active)} y={yOf(Math.max(0, ...data[active].values))} frameWidth={width}>
            <TipTitle>{data[active].title ?? data[active].label}</TipTitle>
            {data[active].values.map((v, si) => <TipRow key={si} kind="rect" color={colorOf(si, active)} value={format(v)} label={series.length > 1 ? series[si]?.label : series[0]?.label} />)}
          </Tip>
        )}
      </div>
    </div>
  )
}

// ---- LineChart / AreaChart ----------------------------------------------------------------------------

export interface LineChartProps {
  data: ChartDatum[]
  series: ChartSeries[]
  area?: boolean
  height?: number
  format: Fmt
  axisFormat?: Fmt
  integer?: boolean
  title: string
  desc?: string
  labelPeak?: boolean
  legend?: boolean
  /** Grow to the height of the card; `height` is the minimum. */
  fill?: boolean
}
export function LineChart({ data, series, area = false, height: minH = 240, format, axisFormat = compactNumber, integer, title, desc, labelPeak = true, legend, fill }: LineChartProps) {
  const [ref, width, boxH] = useSize()
  const height = fill ? Math.max(minH, boxH) : minH
  const gid = safeId(useId())
  const n = data.length
  const { active, setActive, root, focusProps, leave } = useActive(n)
  const all = data.flatMap(d => d.values)
  const y = useYAxis(Math.max(0, ...all), Math.min(0, ...all), integer, axisFormat)
  const padTop = labelPeak ? 24 : 12, padBottom = 26
  const plotL = y.gutter, plotR = width - 10
  const plotW = Math.max(10, plotR - plotL), plotH = Math.max(10, height - padTop - padBottom)
  const xOf = (i: number) => (n <= 1 ? plotL + plotW / 2 : plotL + (i / (n - 1)) * plotW)
  const yOf = (v: number) => padTop + plotH - ((v - y.lo) / (y.hi - y.lo || 1)) * plotH
  const labelW = Math.max(0, ...data.map(d => textWidth(d.label, 11)))
  const stride = labelStride(n, plotW, labelW, 14)
  const paths = series.map((_, si) => {
    const pts = data.map((d, i) => [xOf(i), yOf(d.values[si] ?? 0)] as [number, number])
    const line = monotonePath(pts)
    const fill = pts.length > 1 ? `${line}L${pts[pts.length - 1][0]},${yOf(0)}L${pts[0][0]},${yOf(0)}Z` : ''
    return { line, fill, last: pts[pts.length - 1] }
  })
  let peak = -1, peakV = -Infinity
  if (labelPeak && series.length === 1) data.forEach((d, i) => { if ((d.values[0] ?? 0) > peakV) { peakV = d.values[0] ?? 0; peak = i } })
  const pick = (e: ReactPointerEvent<SVGElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    const vx = ((e.clientX - r.left) / r.width) * width
    setActive(n <= 1 ? 0 : clamp(Math.round(((vx - plotL) / plotW) * (n - 1)), 0, n - 1))
  }
  const showLegend = legend ?? series.length > 1
  return (
    <div ref={root} className="rp-chart-wrap">
      {showLegend && <Legend items={series.map(s => ({ label: s.label, color: s.color, kind: area ? 'rect' : 'line' }))} />}
      <div ref={ref} className={`rp-chart${fill ? ' fill' : ''}`} dir="ltr" style={{ minHeight: minH }} {...focusProps} aria-label={title}>
        {width > 0 && (
          <SvgFrame title={title} desc={desc} width={width} height={height}>
            <defs>
              {series.map((s, si) => (
                <linearGradient key={si} id={`${gid}g${si}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.22 }} />
                  <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0.01 }} />
                </linearGradient>
              ))}
            </defs>
            {y.ticks.map((tv, i) => (
              <g key={i}>
                <line x1={plotL} x2={plotR} y1={yOf(tv)} y2={yOf(tv)} className={tv === 0 ? 'rp-base' : 'rp-grid'} />
                <text x={plotL - 8} y={yOf(tv)} dy="0.32em" textAnchor="end" className="rp-tick">{y.labels[i]}</text>
              </g>
            ))}
            {data.map((d, i) => i % stride === 0 && <text key={i} x={clamp(xOf(i), plotL + labelW / 2, plotR - labelW / 2)} y={height - 8} textAnchor="middle" className="rp-tick">{d.label}</text>)}
            {area && paths.map((p, si) => p.fill && <path key={`a${si}`} d={p.fill} style={{ fill: `url(#${gid}g${si})` }} />)}
            {paths.map((p, si) => <path key={`l${si}`} d={p.line} className="rp-line" style={{ stroke: series[si].color }} />)}
            {active !== null && <line x1={xOf(active)} x2={xOf(active)} y1={padTop - 6} y2={padTop + plotH} className="rp-cross" />}
            {series.map((_, si) => {
              const i = active ?? n - 1
              if (!data[i]) return null
              return <circle key={`d${si}`} cx={xOf(i)} cy={yOf(data[i].values[si] ?? 0)} r={4} className="rp-dot" style={{ fill: series[si].color }} />
            })}
            {peak >= 0 && peakV > 0 && active === null && (
              <text x={clamp(xOf(peak), plotL + 24, plotR - 24)} y={yOf(peakV) - 9} textAnchor="middle" className="rp-peak">{format(peakV)}</text>
            )}
            <rect x={plotL - 6} y={0} width={plotW + 12} height={height} fill="transparent" onPointerMove={pick} onPointerDown={pick} onPointerLeave={leave} />
          </SvgFrame>
        )}
        {active !== null && width > 0 && data[active] && (
          <Tip x={xOf(active)} y={yOf(Math.max(...data[active].values))} frameWidth={width}>
            <TipTitle>{data[active].title ?? data[active].label}</TipTitle>
            {series.map((s, si) => <TipRow key={si} color={s.color} value={format(data[active].values[si] ?? 0)} label={s.label} />)}
          </Tip>
        )}
      </div>
    </div>
  )
}
export function AreaChart(props: Omit<LineChartProps, 'area'>) { return <LineChart {...props} area /> }

// ---- DonutChart ---------------------------------------------------------------------------------------

export interface DonutDatum { id: string; label: string; value: number; color: string }
export interface DonutChartProps {
  data: DonutDatum[]
  format: Fmt
  centerValue: ReactNode
  centerLabel: ReactNode
  title: string
  desc?: string
  size?: number
}
export function DonutChart({ data, format, centerValue, centerLabel, title, desc, size = 176 }: DonutChartProps) {
  const { formatPct } = usePct()
  const [ref, width] = useWidth()
  const list = data.filter(d => d.value > 0)
  const { active, setActive, root, focusProps } = useActive(list.length)
  const total = list.reduce((a, d) => a + d.value, 0)
  const rO = size / 2 - 6, rI = rO - Math.max(16, size * 0.15)
  const angles = donutAngles(list.map(d => d.value), 2 / ((rO + rI) / 2))
  const c = size / 2
  const stacked = width > 0 && width < size + 190
  const cur = active !== null ? list[active] : null
  return (
    <div ref={root} className="rp-chart-wrap">
      <div ref={ref} className={`rp-donut${stacked ? ' stacked' : ''}`}>
        <div className="rp-donut-fig" style={{ width: size, height: size }} dir="ltr" {...focusProps} aria-label={title}>
          <SvgFrame title={title} desc={desc} width={size} height={size}>
            {total <= 0 && <circle cx={c} cy={c} r={(rO + rI) / 2} className="rp-ring-empty" style={{ strokeWidth: rO - rI }} />}
            {list.map((d, i) => (
              <path key={d.id} d={arcPath(c, c, active === i ? rO + 4 : rO, rI, angles[i][0], angles[i][1])} style={{ fill: d.color }}
                className={active !== null && active !== i ? 'rp-dim' : undefined}
                onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null) }} />
            ))}
          </SvgFrame>
          <div className="rp-donut-center" aria-hidden="true">
            {cur ? <><div className="rp-donut-val">{format(cur.value)}</div><div className="rp-donut-lbl">{formatPct(share(cur.value, total))}</div></>
              : <><div className="rp-donut-val">{centerValue}</div><div className="rp-donut-lbl">{centerLabel}</div></>}
          </div>
        </div>
        <ul className="rp-dlegend">
          {list.map((d, i) => (
            <li key={d.id} className={active === i ? 'active' : undefined} onPointerEnter={() => setActive(i)} onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null) }}>
              <span className="rp-key-rect" style={{ background: d.color }} />
              <span className="rp-dl-label truncate"><bdi>{d.label}</bdi></span>
              <span className="rp-dl-val num">{format(d.value)}</span>
              <span className="rp-dl-pct num">{formatPct(share(d.value, total))}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function usePct() {
  const { lang } = useI18n()
  const nf = useMemo(() => new Intl.NumberFormat(lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-US', { maximumFractionDigits: 1 }), [lang])
  return { formatPct: (v: number) => `${nf.format(v)}%` }
}

// ---- HorizontalBars (ranked list with values) ---------------------------------------------------------

export interface HBarDatum { id: string; label: string; value: number; dot?: string; sub?: string; to?: string }
export interface HorizontalBarsProps { data: HBarDatum[]; format: Fmt; color?: string; title: string; desc?: string; max?: number; tipLabel?: string }
/** Ranked bars: label and value on one line, the bar under them, growing from the reading start. */
export function HorizontalBars({ data, format, color = 'var(--rp-c1)', title, desc, max, tipLabel }: HorizontalBarsProps) {
  const { formatPct } = usePct()
  const [ref, width] = useWidth()
  const { active, setActive, root } = useActive(data.length)
  const top = max ?? Math.max(0, ...data.map(d => d.value))
  const total = data.reduce((a, d) => a + Math.max(0, d.value), 0)
  const id = safeId(useId())
  const [tipY, setTipY] = useState(0)
  return (
    <div ref={root} className="rp-chart-wrap">
      <figure ref={ref as React.RefObject<HTMLElement | null> as React.RefObject<HTMLDivElement>} className="rp-hbars" aria-labelledby={`${id}t`}>
        <figcaption id={`${id}t`} className="sr-only">{title}{desc ? ` — ${desc}` : ''}</figcaption>
        <ul>
          {data.map((d, i) => {
            const pct = top > 0 ? Math.max(0, d.value) / top * 100 : 0
            const label = <span className="rp-hb-text truncate"><bdi>{d.label}</bdi></span>
            return (
              <li key={d.id} className={`rp-hb${active === i ? ' active' : ''}`}
                onPointerEnter={e => { setActive(i); setTipY((e.currentTarget as HTMLElement).offsetTop) }}
                onPointerDown={e => { setActive(i); setTipY((e.currentTarget as HTMLElement).offsetTop) }}
                onPointerLeave={e => { if (e.pointerType === 'mouse') setActive(null) }}>
                <div className="rp-hb-head">
                  <span className="rp-hb-label">
                    {d.dot && <span className="status-dot" style={{ background: d.dot }} />}
                    {d.to ? <Link to={d.to} className="rp-hb-link truncate"><bdi>{d.label}</bdi></Link> : label}
                  </span>
                  <span className="rp-hb-val num">{format(d.value)}</span>
                </div>
                <div className="rp-hb-track"><span style={{ width: `${pct}%`, background: color }} /></div>
              </li>
            )
          })}
        </ul>
        {active !== null && data[active] && width > 0 && (
          <Tip x={width / 2} y={tipY + 4} frameWidth={width}>
            <TipTitle><bdi>{data[active].label}</bdi></TipTitle>
            <TipRow color={color} kind="rect" value={format(data[active].value)} label={tipLabel} />
            <div className="rp-tip-sub">{data[active].sub ? <>{data[active].sub} · </> : null}<span className="num">{formatPct(share(Math.max(0, data[active].value), total))}</span></div>
          </Tip>
        )}
      </figure>
    </div>
  )
}

// ---- Sparkline ----------------------------------------------------------------------------------------

export interface SparklineProps { values: number[]; labels?: string[]; format?: Fmt; color?: string; height?: number; title: string }
/** A small trend line with a soft wash and an end dot; hover shows the nearest point. */
export function Sparkline({ values, labels, format, color = 'var(--rp-c1)', height = 40, title }: SparklineProps) {
  const [ref, width] = useWidth()
  const gid = safeId(useId())
  const n = values.length
  const { active, setActive, root, leave } = useActive(n)
  const max = Math.max(0, ...values), min = Math.min(0, ...values)
  const pad = 5
  const xOf = (i: number) => (n <= 1 ? width / 2 : pad + (i / (n - 1)) * (width - pad * 2))
  const yOf = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / (max - min || 1))
  const pts = values.map((v, i) => [xOf(i), yOf(v)] as [number, number])
  const line = monotonePath(pts)
  const fill = n > 1 ? `${line}L${pts[n - 1][0]},${height}L${pts[0][0]},${height}Z` : ''
  const pick = (e: ReactPointerEvent<SVGElement>) => {
    if (!labels || !format) return
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    const vx = ((e.clientX - r.left) / r.width) * width
    setActive(n <= 1 ? 0 : clamp(Math.round(((vx - pad) / (width - pad * 2)) * (n - 1)), 0, n - 1))
  }
  const i = active ?? n - 1
  return (
    <div ref={root} className="rp-spark-wrap">
      <div ref={ref} className="rp-spark" dir="ltr" style={{ height }}>
        {width > 0 && n > 0 && (
          <SvgFrame title={title} width={width} height={height}>
            <defs>
              <linearGradient id={`${gid}s`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.2 }} />
                <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {fill && <path d={fill} style={{ fill: `url(#${gid}s)` }} />}
            <path d={line} className="rp-line rp-line-thin" style={{ stroke: color }} />
            {active !== null && <line x1={xOf(i)} x2={xOf(i)} y1={0} y2={height} className="rp-cross" />}
            <circle cx={xOf(i)} cy={yOf(values[i])} r={3.5} className="rp-dot" style={{ fill: color }} />
            <rect x={0} y={0} width={width} height={height} fill="transparent" onPointerMove={pick} onPointerDown={pick} onPointerLeave={leave} />
          </SvgFrame>
        )}
        {active !== null && labels && format && width > 0 && (
          <Tip x={xOf(active)} y={yOf(values[active])} frameWidth={width}>
            <TipTitle>{labels[active]}</TipTitle>
            <TipRow color={color} value={format(values[active])} />
          </Tip>
        )}
      </div>
    </div>
  )
}

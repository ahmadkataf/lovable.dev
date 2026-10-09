// A hand-written responsive SVG bar chart: one bar per bucket, a grey "previous period" bar beside it when
// comparing, a baseline, 4 gridlines with short labels (1.2k), x labels that never collide, and a hover / tap
// tooltip. Drawn left-to-right whatever the UI direction (the wrapper is dir="ltr"); the tooltip follows the
// UI language. Colours come from the tokens, so dark mode is free.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { useLang, useT } from '../../i18n'
import { niceStep, shortNumber } from '../../lib/reports'

export interface ChartBucket { label: string; title: string; total: number; count: number; refunds: number }
export interface BarChartProps {
  buckets: ChartBucket[]
  prev?: ChartBucket[] | null
  format: (n: number) => string
  height?: number
  /** Roughly how wide an x label is (px), to skip labels that would collide. */
  labelWidth?: number
  ariaLabel?: string
}

/** The rendered width of an element, kept up to date. */
export function useWidth(ref: RefObject<HTMLElement>): number {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => { const cw = entries[0]?.contentRect.width; if (cw) setW(Math.floor(cw)) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

/** A bar with rounded top corners sitting flat on the baseline. */
export function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h))
  if (rr === 0) return `M${x},${y}h${w}v${h}h${-w}Z`
  return `M${x},${y + rr}a${rr},${rr} 0 0 1 ${rr},${-rr}h${w - 2 * rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - rr}h${-w}Z`
}

const PAD = { l: 44, r: 8, t: 14, b: 26 }

export function BarChart({ buckets, prev, format, height = 220, labelWidth = 24, ariaLabel }: BarChartProps) {
  const t = useT()
  const lang = useLang()
  const ref = useRef<HTMLDivElement>(null)
  const width = useWidth(ref)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => { setHover(null) }, [buckets, prev])

  const n = buckets.length
  const plotW = Math.max(0, width - PAD.l - PAD.r)
  const plotH = height - PAD.t - PAD.b
  let max = 0
  for (const b of buckets) if (b.total > max) max = b.total
  if (prev) for (const b of prev) if (b.total > max) max = b.total
  const step = niceStep(max, 4)
  const yMax = step * 4
  const hOf = (v: number) => (v > 0 ? Math.max(2, (v / yMax) * plotH) : 0)
  const slot = n ? plotW / n : plotW
  const gap = Math.min(10, slot * 0.3)
  const inner = Math.max(1, slot - gap)
  const barW = Math.min(44, prev ? Math.max(1, (inner - 2) / 2) : inner)
  const groupW = prev ? barW * 2 + 2 : barW
  const xOf = (i: number) => PAD.l + i * slot + (slot - groupW) / 2
  const labelEvery = Math.max(1, Math.ceil((n * labelWidth) / Math.max(1, plotW)))
  const baseY = PAD.t + plotH

  const indexAt = (clientX: number): number | null => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect || !n) return null
    const x = clientX - rect.left - PAD.l
    if (x < 0 || x > plotW) return null
    return Math.min(n - 1, Math.max(0, Math.floor(x / slot)))
  }
  const onMove = (e: ReactPointerEvent) => { if (e.pointerType === 'mouse') setHover(indexAt(e.clientX)) }
  const onDown = (e: ReactPointerEvent) => { if (e.pointerType === 'mouse') return; const i = indexAt(e.clientX); setHover(h => (h === i ? null : i)) }
  const onLeave = (e: ReactPointerEvent) => { if (e.pointerType === 'mouse') setHover(null) }

  const cur = hover !== null ? buckets[hover] : null
  const was = hover !== null && prev ? prev[hover] ?? null : null
  const tipX = hover !== null ? Math.min(Math.max(PAD.l + hover * slot + slot / 2, 80), Math.max(80, width - 80)) : 0
  const tipY = cur ? baseY - Math.max(hOf(cur.total), was ? hOf(was.total) : 0) : 0

  return (
    <div className="rp-chart" dir="ltr" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerDown={onDown} onPointerLeave={onLeave}>
          {[0, 1, 2, 3, 4].map(i => {
            const gy = baseY - (i / 4) * plotH
            return (
              <g key={i}>
                <line className={i === 0 ? 'base' : 'grid'} x1={PAD.l} x2={width - PAD.r} y1={gy} y2={gy} />
                <text className="axis num" x={PAD.l - 6} y={gy} textAnchor="end" dominantBaseline="middle">{shortNumber(i * step)}</text>
              </g>
            )
          })}
          {buckets.map((b, i) => {
            const dim = hover !== null && hover !== i ? ' dim' : ''
            const x0 = xOf(i)
            const p = prev ? prev[i] : undefined
            const ph = p ? hOf(p.total) : 0
            const ch = hOf(b.total)
            return (
              <g key={i}>
                {ph > 0 && <path className={`bar prev${dim}`} d={barPath(x0, baseY - ph, barW, ph, 4)} />}
                {ch > 0 && <path className={`bar${dim}`} d={barPath(prev ? x0 + barW + 2 : x0, baseY - ch, barW, ch, 4)} />}
                {i % labelEvery === 0 && <text className="axis num" x={PAD.l + i * slot + slot / 2} y={height - 8} textAnchor="middle">{b.label}</text>}
              </g>
            )
          })}
        </svg>
      )}
      {cur && (
        <div className="rp-tip-pos" dir="ltr" style={{ insetInlineStart: tipX, top: tipY }}>
          <div className="rp-tip" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="t">{cur.title}</div>
            <div className="l"><span>{prev ? t('reports.chart.current') : t('reports.tile.gross')}</span><span className="num">{format(cur.total)}</span></div>
            <div className="l"><span>{t('reports.receipts', { n: cur.count })}</span>{cur.refunds > 0 && <span className="num rp-neg">−{format(cur.refunds)}</span>}</div>
            {was && <div className="l prev"><span>{t('reports.chart.previous')}</span><span className="num">{format(was.total)}</span></div>}
          </div>
        </div>
      )}
    </div>
  )
}

// The odontogram: an SVG drawing of both arches with clickable surfaces.
// The drawing is always laid out like a paper chart — the patient's right on the viewer's left — whatever the UI
// direction, so it lives in a dir="ltr" box. Every tooth is drawn in one canonical orientation (buccal up, root up,
// mesial to the right) and mirrored into place with a transform.
import { memo, useId, useLayoutEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { ToothCondition, ToothRecord, ToothSurface } from '@/db/types'
import { useI18n } from '@/i18n'
import { CONDITION_META, LEGEND_ORDER, ROWS, toothInfo, toothLabel, toothShort, type Arch, type Dentition, type ToothInfo, type ToothType } from './teeth'
import { chartView, bridgeLinks, conditionCounts, EMPTY_VIEW, type ToothView } from './lib'
import './chart.css'

// ---- geometry (SVG user units) -------------------------------------------------------------------
interface Geo { cw: number; w: number; h: number; iw: number; ih: number; root: number; rw: number; roots: 1 | 2 }
const GEO: Record<ToothType, Geo> = {
  molar: { cw: 50, w: 40, h: 40, iw: 16, ih: 16, root: 28, rw: 30, roots: 2 },
  premolar: { cw: 42, w: 32, h: 36, iw: 13, ih: 14, root: 32, rw: 17, roots: 1 },
  canine: { cw: 40, w: 30, h: 34, iw: 12, ih: 12, root: 38, rw: 15, roots: 1 },
  incisor: { cw: 38, w: 28, h: 30, iw: 16, ih: 7, root: 33, rw: 13, roots: 1 },
}
const PRIMARY_K = 0.86       // primary teeth are drawn smaller…
const PRIMARY_CW = 0.9       // …in slightly narrower cells
const NUM_ZONE = 20, ROOT_ZONE = 40, CROWN_ZONE = 44, MID = 18, PAD_X = 20, GAP = 40, PAD_Y = 4
const E = 3                  // surface polygons overshoot the crown outline; the clip path trims them

const CROWN_PATH: Record<ToothType, string> = {
  // wide, with two buccal and two lingual cusps
  molar: 'M -14 -20 Q -7 -23.5 0 -20 Q 7 -23.5 14 -20 Q 20 -20 20 -14 Q 21.6 0 20 14 Q 20 20 14 20 Q 7 23.5 0 20 Q -7 23.5 -14 20 Q -20 20 -20 14 Q -21.6 0 -20 -14 Q -20 -20 -14 -20 Z',
  // oval
  premolar: 'M 0 -18 C 9.5 -18 16 -10 16 0 C 16 10 9.5 18 0 18 C -9.5 18 -16 10 -16 0 C -16 -10 -9.5 -18 0 -18 Z',
  // pointed toward the buccal cusp tip
  canine: 'M 0 -18 C 3 -15 15 -10 15 0 C 15 9.5 8.5 17 0 17 C -8.5 17 -15 9.5 -15 0 C -15 -10 -3 -15 0 -18 Z',
  // narrow, flat labial face, rounded cingulum
  incisor: 'M -11 -15 L 11 -15 Q 14 -15 14 -12 L 12.2 9 Q 11 15 0 15 Q -11 15 -12.2 9 L -14 -12 Q -14 -15 -11 -15 Z',
}

function rootPath(g: Geo): string {
  const y0 = -g.h / 2 + 2, L = g.root, r = g.rw / 2
  if (g.roots === 2) {
    return `M ${-r} ${y0} C ${-r} ${y0 - L * 0.5} ${-r * 0.84} ${y0 - L} ${-r * 0.6} ${y0 - L} C ${-r * 0.36} ${y0 - L} ${-r * 0.2} ${y0 - L * 0.55} 0 ${y0 - L * 0.42} `
      + `C ${r * 0.2} ${y0 - L * 0.55} ${r * 0.36} ${y0 - L} ${r * 0.6} ${y0 - L} C ${r * 0.84} ${y0 - L} ${r} ${y0 - L * 0.5} ${r} ${y0} Z`
  }
  return `M ${-r} ${y0} C ${-r} ${y0 - L * 0.55} ${-r * 0.44} ${y0 - L} 0 ${y0 - L} C ${r * 0.44} ${y0 - L} ${r} ${y0 - L * 0.55} ${r} ${y0} Z`
}
function canalPath(g: Geo): string {
  const y0 = -g.h / 2 + 2, L = g.root, r = g.rw / 2
  if (g.roots === 2) return `M ${-r * 0.22} ${y0 + 1} Q ${-r * 0.5} ${y0 - L * 0.4} ${-r * 0.6} ${y0 - L + 3} M ${r * 0.22} ${y0 + 1} Q ${r * 0.5} ${y0 - L * 0.4} ${r * 0.6} ${y0 - L + 3}`
  return `M 0 ${y0 + 1} L 0 ${y0 - L + 3}`
}
function screw(g: Geo): { body: string; threads: string } {
  const y0 = -g.h / 2 + 1, L = g.root + 2, a = Math.min(g.rw / 2, 6.5), b = a * 0.62
  const body = `M ${-a - 1.5} ${y0} L ${a + 1.5} ${y0} L ${a + 1.5} ${y0 - 3} L ${a} ${y0 - 3} L ${b} ${y0 - L + 4} Q 0 ${y0 - L - 1} ${-b} ${y0 - L + 4} L ${-a} ${y0 - 3} L ${-a - 1.5} ${y0 - 3} Z`
  let threads = ''
  for (let i = 1; i <= 4; i++) {
    const y = y0 - 3 - i * ((L - 7) / 5)
    const half = a - (a - b) * ((y0 - 3 - y) / (L - 7))
    threads += `M ${-half} ${y + 1.2} L ${half} ${y - 1.2} `
  }
  return { body, threads }
}

// badges for remarks that do not change the tooth's shape
const BADGE_GLYPH: Partial<Record<ToothCondition, string>> = {
  mobile: 'M -3.2 0 H 3.2 M -3.2 0 L -1.6 -1.5 M -3.2 0 L -1.6 1.5 M 3.2 0 L 1.6 -1.5 M 3.2 0 L 1.6 1.5',
  abscess: 'M 0 -2.8 C 1.9 -0.6 2.4 0.6 2.4 1.1 A 2.4 2.4 0 0 1 -2.4 1.1 C -2.4 0.6 -1.9 -0.6 0 -2.8 Z',
  attrition: 'M -3.2 1.2 L -1.6 -1.2 L 0 1.2 L 1.6 -1.2 L 3.2 1.2',
  other: 'M -2 0 H 2 M 0 -2 V 2',
}
const BADGES: ToothCondition[] = ['mobile', 'abscess', 'attrition', 'other']

// ---- layout ---------------------------------------------------------------------------------------
interface RowLayout { teeth: readonly number[]; arch: Arch; k: number; y: number; h: number; cy: number; numY: number; cx: Map<number, number>; cw: Map<number, number> }
export interface ChartLayout { W: number; H: number; rows: RowLayout[]; occlusalY: number; midX: number }

const cellWidth = (n: number) => { const i = toothInfo(n)!; return GEO[i.type].cw * (i.primary ? PRIMARY_CW : 1) }
const rowWidth = (teeth: readonly number[]) => teeth.reduce((a, n) => a + cellWidth(n), 0) + MID

export function chartLayout(dentition: Dentition): ChartLayout {
  type Def = { teeth: readonly number[]; arch: Arch } | 'gap'
  const defs: Def[] = dentition === 'adult' ? [{ teeth: ROWS.upperAdult, arch: 'upper' }, 'gap', { teeth: ROWS.lowerAdult, arch: 'lower' }]
    : dentition === 'primary' ? [{ teeth: ROWS.upperPrimary, arch: 'upper' }, 'gap', { teeth: ROWS.lowerPrimary, arch: 'lower' }]
    : [{ teeth: ROWS.upperAdult, arch: 'upper' }, { teeth: ROWS.upperPrimary, arch: 'upper' }, 'gap', { teeth: ROWS.lowerPrimary, arch: 'lower' }, { teeth: ROWS.lowerAdult, arch: 'lower' }]
  const W = Math.max(...defs.map(d => d === 'gap' ? 0 : rowWidth(d.teeth))) + PAD_X * 2
  const midX = W / 2
  const rows: RowLayout[] = []
  let y = PAD_Y, occlusalY = 0
  for (const d of defs) {
    if (d === 'gap') { occlusalY = y + GAP / 2; y += GAP; continue }
    const k = toothInfo(d.teeth[0])!.primary ? PRIMARY_K : 1
    const h = NUM_ZONE + (ROOT_ZONE + CROWN_ZONE) * k + 6
    const cy = d.arch === 'upper' ? y + NUM_ZONE + ROOT_ZONE * k + (CROWN_ZONE * k) / 2 + 2 : y + (CROWN_ZONE * k) / 2 + 4
    const numY = d.arch === 'upper' ? y + 14 : y + (CROWN_ZONE + ROOT_ZONE) * k + 6 + 14
    const cx = new Map<number, number>(), cw = new Map<number, number>()
    const half = d.teeth.length / 2
    let x = midX - MID / 2 - d.teeth.slice(0, half).reduce((a, n) => a + cellWidth(n), 0)
    d.teeth.forEach((n, i) => {
      if (i === half) x = midX + MID / 2
      const w = cellWidth(n)
      cx.set(n, x + w / 2); cw.set(n, w); x += w
    })
    rows.push({ teeth: d.teeth, arch: d.arch, k, y, h, cy, numY, cx, cw })
    y += h
  }
  return { W, H: y + PAD_Y, rows, occlusalY, midX }
}

// ---- one tooth ------------------------------------------------------------------------------------
interface Handlers {
  surface: (n: number, s: ToothSurface) => void
  tooth: (n: number) => void
}
interface ToothProps {
  info: ToothInfo
  view: ToothView
  cx: number
  cy: number
  uid: string
  picked?: string                 // surfaces joined, for memo
  interactive: boolean
  handlers: Handlers
}

/** The crown + root of one tooth, canonical orientation mirrored into place. */
const ToothShape = memo(function ToothShape({ info, view, cx, cy, uid, picked, interactive, handlers }: ToothProps) {
  const { t, lang } = useI18n()
  const g = GEO[info.type]
  const k = info.primary ? PRIMARY_K : 1
  const sx = info.side === 'right' ? 1 : -1, sy = info.arch === 'upper' ? 1 : -1
  const whole = new Set(view.whole)
  const missing = whole.has('missing'), implant = whole.has('implant'), crown = whole.has('crown'), bridge = whole.has('bridge')
  const ghost = missing || (implant && !crown && !bridge)
  const W = g.w / 2 + E, H = g.h / 2 + E, x = g.iw / 2, y = g.ih / 2
  const center: ToothSurface = info.anterior ? 'I' : 'O'
  const pickedSet = new Set((picked || '').split('').filter(Boolean) as ToothSurface[])
  const short = toothShort(info.n, lang)

  const fillFor = (s: ToothSurface): string => {
    const c = view.surfaces[s]
    if (c) return CONDITION_META[c].color
    if (s === 'R' && whole.has('root_canal')) return CONDITION_META.root_canal.color
    return ghost ? 'var(--surface)' : 'var(--tooth-healthy)'
  }
  const titleFor = (s: ToothSurface) => {
    const c = view.surfaces[s] ?? (s === 'R' && whole.has('root_canal') ? 'root_canal' : undefined)
    return `${short} · ${t(`surf.${s}`)}${c ? ` — ${t(`cond.${c}`)}` : ''}`
  }
  const surfClass = (s: ToothSurface) => ['ch-surf', view.surfaces[s] || (s === 'R' && whole.has('root_canal')) ? 'is-filled' : 'is-empty', pickedSet.has(s) && 'is-picked'].filter(Boolean).join(' ')
  const click = (s: ToothSurface) => interactive ? (e: MouseEvent) => { e.stopPropagation(); handlers.surface(info.n, s) } : undefined
  const style = (s: ToothSurface) => ({ '--f': fillFor(s) }) as CSSProperties

  const polys: [ToothSurface, string][] = [
    ['B', `${-W},${-H} ${W},${-H} ${x},${-y} ${-x},${-y}`],
    ['M', `${W},${-H} ${W},${H} ${x},${y} ${x},${-y}`],
    ['L', `${W},${H} ${-W},${H} ${-x},${y} ${x},${y}`],
    ['D', `${-W},${H} ${-W},${-H} ${-x},${-y} ${-x},${y}`],
  ]
  const outlineColor = missing ? 'var(--tooth-missing)' : crown ? CONDITION_META.crown.color : bridge ? CONDITION_META.bridge.color : implant ? CONDITION_META.implant.color : undefined
  const badges = BADGES.filter(c => whole.has(c))
  const sc = screw(g)

  return (
    <g transform={`translate(${cx} ${cy}) scale(${sx * k} ${sy * k})`} className={['ch-shape', ghost && 'is-ghost'].filter(Boolean).join(' ')}>
      {/* root (R) — or the implant fixture that replaced it */}
      {implant ? (
        <g className="ch-implant">
          <path d={sc.body} className="ch-screw" data-s="R" onClick={click('R')}><title>{`${short} · ${t('cond.implant')}`}</title></path>
          <path d={sc.threads} className="ch-threads" />
        </g>
      ) : (
        <>
          <path d={rootPath(g)} className={surfClass('R') + ' ch-root' + (missing ? ' is-missing' : '')} style={style('R')} data-s="R" onClick={click('R')}><title>{titleFor('R')}</title></path>
          {whole.has('root_canal') && !missing && <path d={canalPath(g)} className="ch-canal" />}
          {whole.has('impacted') && <path d={rootPath(g)} className="ch-hatch" style={{ fill: `url(#${uid}-hatch)` }} />}
        </>
      )}
      {/* crown: four trapezoids + the occlusal / incisal centre, trimmed to the tooth's outline */}
      <g clipPath={`url(#${uid}-clip-${info.type})`}>
        {polys.map(([s, pts]) => (
          <polygon key={s} points={pts} className={surfClass(s)} style={style(s)} data-s={s} onClick={click(s)}><title>{titleFor(s)}</title></polygon>
        ))}
        <rect x={-x} y={-y} width={x * 2} height={y * 2} rx={info.anterior ? 2.5 : 3.5} className={surfClass(center)} style={style(center)} data-s={center} onClick={click(center)}><title>{titleFor(center)}</title></rect>
        {crown && <path d={CROWN_PATH[info.type]} className="ch-crown-tint" />}
        {whole.has('veneer') && <rect x={-W} y={-H} width={W * 2} height={g.h * 0.24 + E} className="ch-veneer" />}
        {whole.has('impacted') && <path d={CROWN_PATH[info.type]} className="ch-hatch" style={{ fill: `url(#${uid}-hatch)` }} />}
      </g>
      {/* grooves: one for premolars, a cross for molars */}
      {!ghost && info.type === 'premolar' && !view.surfaces[center] && <path d={`M ${-x + 2.5} 0 L ${x - 2.5} 0`} className="ch-groove" />}
      {!ghost && info.type === 'molar' && !view.surfaces[center] && <path d={`M ${-x + 3} 0 L ${x - 3} 0 M 0 ${-y + 3} L 0 ${y - 3}`} className="ch-groove" />}
      <path d={CROWN_PATH[info.type]} className={['ch-outline', crown && 'is-crown', bridge && 'is-bridge', missing && 'is-missing', ghost && !missing && 'is-implant'].filter(Boolean).join(' ')} style={outlineColor ? { stroke: outlineColor } : undefined} />
      {missing && <path d={`M ${-g.w * 0.32} ${-g.h * 0.32} L ${g.w * 0.32} ${g.h * 0.32} M ${g.w * 0.32} ${-g.h * 0.32} L ${-g.w * 0.32} ${g.h * 0.32}`} className="ch-x" />}
      {whole.has('to_extract') && <path d={`M ${-g.w / 2 - 2} ${g.h / 2 + 1} L ${g.w / 2 + 2} ${-g.h / 2 - g.root * 0.78}`} className="ch-strike" />}
      {badges.map((c, i) => (
        <g key={c} transform={`translate(${g.w / 2 - 4} ${-g.h / 2 - 8 - i * 11.5}) scale(${sx} ${sy})`} className="ch-badge">
          <circle r={5.6} style={{ fill: CONDITION_META[c].color }} />
          <path d={BADGE_GLYPH[c]} className={c === 'abscess' ? 'ch-badge-solid' : 'ch-badge-glyph'} />
          <title>{`${short} · ${t(`cond.${c}`)}`}</title>
        </g>
      ))}
    </g>
  )
}, (a, b) => a.view === b.view && a.picked === b.picked && a.cx === b.cx && a.cy === b.cy && a.interactive === b.interactive && a.uid === b.uid && a.info === b.info)

/** Shared <defs>: one clip path per crown type, the hatch pattern. */
function Defs({ uid }: { uid: string }) {
  return (
    <defs>
      {(Object.keys(CROWN_PATH) as ToothType[]).map(type => (
        <clipPath key={type} id={`${uid}-clip-${type}`} clipPathUnits="userSpaceOnUse"><path d={CROWN_PATH[type]} /></clipPath>
      ))}
      <pattern id={`${uid}-hatch`} patternUnits="userSpaceOnUse" width="4.5" height="4.5" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="4.5" className="ch-hatch-line" />
      </pattern>
    </defs>
  )
}

// ---- the chart ------------------------------------------------------------------------------------
export interface DentalChartProps {
  records: ToothRecord[]
  dentition: Dentition
  selected?: number
  selectedSurfaces?: ToothSurface[]
  /** Extra teeth to ring (e.g. the teeth of a lab order). */
  highlight?: number[]
  onToothClick?: (n: number) => void
  onSurfaceClick?: (n: number, surface: ToothSurface) => void
  /** When set, clicks apply this condition straight away through onPaint. */
  paintCondition?: ToothCondition | null
  onPaint?: (n: number, surfaces: ToothSurface[]) => void
  readOnly?: boolean
  compact?: boolean
  /** Shows the colour legend under the drawing (default: true). */
  legend?: boolean
  /** false: a picture only — no hover, no clicks, no focus. */
  interactive?: boolean
  className?: string
}

export function DentalChart({ records, dentition, selected, selectedSurfaces, highlight, onToothClick, onSurfaceClick, paintCondition, onPaint, readOnly, compact, legend = true, interactive = true, className }: DentalChartProps) {
  const { t, lang } = useI18n()
  const uid = 'ch' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const layout = useMemo(() => chartLayout(dentition), [dentition])
  const views = useMemo(() => chartView(records), [records])
  const paint = !readOnly && interactive && paintCondition ? paintCondition : null
  const paintScope = paint ? CONDITION_META[paint].scope : null

  // handlers read the latest props through a ref so memoised teeth never re-render just for new callbacks
  const latest = useRef({ onToothClick, onSurfaceClick, onPaint, paint, paintScope })
  useLayoutEffect(() => { latest.current = { onToothClick, onSurfaceClick, onPaint, paint, paintScope } })
  const handlers = useMemo<Handlers>(() => ({
    surface: (n, s) => {
      const l = latest.current
      if (l.paint && l.onPaint) l.onPaint(n, l.paintScope === 'tooth' ? [] : [s])
      else if (l.onSurfaceClick) l.onSurfaceClick(n, s)
      else l.onToothClick?.(n)
    },
    tooth: n => {
      const l = latest.current
      if (l.paint && l.onPaint) { if (l.paintScope !== 'surface') l.onPaint(n, []) }
      else l.onToothClick?.(n)
    },
  }), [])

  const bridged = useMemo(() => new Set([...views].filter(([, v]) => v.whole.includes('bridge')).map(([n]) => n)), [views])
  const ringed = useMemo(() => new Set(highlight ?? []), [highlight])
  const picked = (selectedSurfaces ?? []).join('')
  const { W, H, rows, occlusalY, midX } = layout
  const quadNum = (q: 'UR' | 'UL' | 'LR' | 'LL') => {
    const adult = { UR: 1, UL: 2, LL: 3, LR: 4 }[q], prim = adult + 4
    return dentition === 'adult' ? String(adult) : dentition === 'primary' ? String(prim) : `${adult}/${prim}`
  }
  const onKey = (n: number) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlers.tooth(n) } }

  const cls = ['ch-chart', compact && 'is-compact', interactive ? 'is-interactive' : 'is-static', paint && 'is-painting', paintScope && `paint-${paintScope}`, className].filter(Boolean).join(' ')
  return (
    <div className={cls} dir="ltr" style={paint ? ({ '--ch-paint': paint === 'healthy' ? 'var(--surface-3)' : CONDITION_META[paint].color } as CSSProperties) : undefined}>
      {/* capped at ~1.5 px per unit so the primary-only chart (a narrower drawing) is not blown up */}
      <svg viewBox={`0 0 ${W.toFixed(1)} ${H.toFixed(1)}`} className="ch-svg" style={{ maxWidth: Math.round(W * 1.5) }} role={interactive ? 'group' : 'img'} aria-label={t(compact || !interactive ? 'chart.aria.mini' : 'chart.aria.chart')} direction="ltr">
        <Defs uid={uid} />
        {/* guides: midline and occlusal plane */}
        <line x1={midX} x2={midX} y1={4} y2={H - 4} className="ch-midline" />
        <line x1={PAD_X} x2={W - PAD_X} y1={occlusalY} y2={occlusalY} className="ch-occlusal" />
        {!compact && (
          <g className="ch-quads">
            {([['UR', 'start', -8], ['UL', 'end', -8], ['LR', 'start', 16], ['LL', 'end', 16]] as const).map(([q, anchor, dy]) => (
              // the number sits on the outer edge; the LRM keeps Arabic bidi from pulling it inside the name
              <text key={q} x={anchor === 'start' ? PAD_X + 2 : W - PAD_X - 2} y={occlusalY + dy} textAnchor={anchor} className="ch-quad">
                {anchor === 'start'
                  ? <><tspan className="ch-quad-n">{quadNum(q)}</tspan>{'\u2002'}{t(`chart.quad.${q}`)}</>
                  : <>{t(`chart.quad.${q}`)}{'\u200E\u2002'}<tspan className="ch-quad-n">{quadNum(q)}</tspan></>}
              </text>
            ))}
          </g>
        )}
        {rows.map((row, ri) => (
          <g key={ri} className="ch-row">
            {/* one cell per tooth: hover / selection background, number, the tooth itself */}
            {row.teeth.map(n => {
              const cx = row.cx.get(n)!, cw = row.cw.get(n)!
              const isSel = selected === n, isRing = ringed.has(n)
              const v = views.get(n)
              return (
                <g key={n} className={['ch-cell', isSel && 'is-selected', isRing && 'is-ring', v && 'is-charted'].filter(Boolean).join(' ')}
                  onClick={interactive ? () => handlers.tooth(n) : undefined} onKeyDown={interactive ? onKey(n) : undefined}
                  tabIndex={interactive ? 0 : undefined} role={interactive ? 'button' : undefined} aria-label={interactive ? toothLabel(n, lang) : undefined} aria-pressed={interactive ? isSel : undefined} data-tooth={n}>
                  <title>{toothLabel(n, lang)}{v?.whole.length ? ` — ${v.whole.map(c => t(`cond.${c}`)).join(lang === 'ar' ? '، ' : ', ')}` : ''}</title>
                  <rect x={cx - cw / 2 + 1.5} y={row.y + 1} width={cw - 3} height={row.h - 2} rx={9} className="ch-cell-bg" />
                  <text x={cx} y={row.numY} textAnchor="middle" className="ch-num">{n}</text>
                  <ToothShape info={toothInfo(n)!} view={v ?? EMPTY_VIEW} cx={cx} cy={row.cy} uid={uid}
                    picked={isSel ? picked : undefined} interactive={interactive} handlers={handlers} />
                </g>
              )
            })}
            {/* bridge connectors between neighbouring bridged teeth */}
            {bridgeLinks(row.teeth, bridged).map(([a, b]) => {
              const yb = row.arch === 'upper' ? row.cy - (CROWN_ZONE * row.k) / 2 + 1 : row.cy + (CROWN_ZONE * row.k) / 2 - 1
              return (
                <g key={`b${a}-${b}`} className="ch-bridge">
                  <line x1={row.cx.get(a)!} x2={row.cx.get(b)!} y1={yb} y2={yb} className="ch-bridge-bar" style={{ strokeWidth: 4.5 * row.k }} />
                  <circle cx={row.cx.get(a)!} cy={yb} r={3.4 * row.k} className="ch-bridge-dot" />
                  <circle cx={row.cx.get(b)!} cy={yb} r={3.4 * row.k} className="ch-bridge-dot" />
                </g>
              )
            })}
          </g>
        ))}
      </svg>
      {legend && <ChartLegend records={records} compact={compact} />}
    </div>
  )
}

/** Colour legend (static). Compact charts show only the conditions present. */
export function ChartLegend({ records, compact }: { records: ToothRecord[]; compact?: boolean }) {
  const { t } = useI18n()
  const counts = useMemo(() => conditionCounts(records), [records])
  const list = compact ? LEGEND_ORDER.filter(c => counts[c] > 0) : LEGEND_ORDER
  if (!list.length) return null
  return (
    <div className="ch-legend" dir="auto">
      {list.map(c => <span key={c} className="ch-legend-item"><ConditionSwatch condition={c} size={16} />{t(`cond.${c}`)}</span>)}
    </div>
  )
}

/** A small drawing of how a condition appears on the chart: colour fill, outline, screw, cross… */
export function ConditionSwatch({ condition, size = 18 }: { condition: ToothCondition; size?: number }) {
  const m = CONDITION_META[condition]
  const c = m.color
  let body: React.ReactNode
  switch (m.glyph) {
    case 'fill': body = <rect x="3" y="3" width="14" height="14" rx="4" style={{ fill: c }} />; break
    case 'none': body = <rect x="3.5" y="3.5" width="13" height="13" rx="4" className="sw-healthy" />; break
    case 'cross': body = <><rect x="3.5" y="3.5" width="13" height="13" rx="4" className="sw-dashed" /><path d="M7 7 L13 13 M13 7 L7 13" className="sw-x" /></>; break
    case 'screw': body = <><path d="M6.5 4 H13.5 V6 H12.5 L11.4 15.5 Q10 17.5 8.6 15.5 L7.5 6 H6.5 Z" style={{ fill: c }} /><path d="M8 8.6 L12 7.4 M8.2 11.2 L11.8 10 M8.5 13.8 L11.5 12.6" className="sw-thread" /></>; break
    case 'outline': body = <rect x="4" y="4" width="12" height="12" rx="4" className="sw-ring" style={{ stroke: c, fill: c }} />; break
    case 'bar': body = <><rect x="2.5" y="8" width="15" height="4" rx="2" style={{ fill: c }} /><circle cx="4.5" cy="10" r="2.6" className="sw-dot" style={{ stroke: c }} /><circle cx="15.5" cy="10" r="2.6" className="sw-dot" style={{ stroke: c }} /></>; break
    case 'band': body = <><rect x="3.5" y="3.5" width="13" height="13" rx="4" className="sw-healthy" /><path d="M3.5 7.5 V7.5 Q3.5 3.5 7.5 3.5 H12.5 Q16.5 3.5 16.5 7.5 Z" style={{ fill: c }} /></>; break
    case 'root': body = <path d="M5 4 H15 C15 9 12.5 16.5 10 16.5 C7.5 16.5 5 9 5 4 Z" style={{ fill: c }} />; break
    case 'strike': body = <><rect x="3.5" y="3.5" width="13" height="13" rx="4" className="sw-healthy" /><path d="M4 16 L16 4" className="sw-strike" style={{ stroke: c }} /></>; break
    case 'hatch': body = <><rect x="3.5" y="3.5" width="13" height="13" rx="4" className="sw-healthy" /><path d="M5 11 L11 5 M5 15.5 L15.5 5 M9.5 15.5 L15.5 9.5" className="sw-hatch" style={{ stroke: c }} /></>; break
    case 'badge': body = <><circle cx="10" cy="10" r="7" style={{ fill: c }} /><path d={BADGE_GLYPH[condition]} transform="translate(10 10) scale(1.25)" className={condition === 'abscess' ? 'ch-badge-solid' : 'ch-badge-glyph'} /></>; break
  }
  return <svg className="ch-swatch" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">{body}</svg>
}

// ---- single tooth, large: the surface picker of the tooth panel ------------------------------------
export function ToothDiagram({ n, records, picked, onToggle, disabled }: { n: number; records: ToothRecord[]; picked: ToothSurface[]; onToggle?: (s: ToothSurface) => void; disabled?: boolean }) {
  const { lang } = useI18n()
  const uid = 'td' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const info = toothInfo(n)
  const view = useMemo(() => chartView(records).get(n) ?? EMPTY_VIEW, [records, n])
  // the memoised tooth keeps its first handlers object, so read the latest onToggle through a ref
  // (a new closure every render would otherwise act on stale form state, e.g. a validation error never cleared)
  const toggle = useRef(onToggle)
  useLayoutEffect(() => { toggle.current = onToggle })
  const handlers = useMemo<Handlers>(() => ({ surface: (_n, s) => toggle.current?.(s), tooth: () => undefined }), [])
  if (!info) return null
  const g = GEO[info.type]
  const sx = info.side === 'right' ? 1 : -1, sy = info.arch === 'upper' ? 1 : -1
  const k = info.primary ? PRIMARY_K : 1
  // a box around crown + root, crown centred
  const top = g.h / 2 + g.root + 6, bottom = g.h / 2 + 6, half = Math.max(g.w, g.rw) / 2 + 14
  const vbY = sy === 1 ? -top : -bottom
  const label = (s: ToothSurface, cxc: number, cyc: number) => {
    const X = sx * cxc, Y = sy * cyc
    const filled = !!view.surfaces[s] || (s === 'R' && view.whole.includes('root_canal'))
    return <text key={s} x={X} y={Y + 2.6} textAnchor="middle" className={['ch-dlabel', filled && 'on-fill', picked.includes(s) && 'on-pick'].filter(Boolean).join(' ')}>{s}</text>
  }
  const x = g.iw / 2, y = g.ih / 2
  const midB = -(g.h / 2 + y) / 2, midM = (g.w / 2 + x) / 2
  return (
    <div className={['ch-diagram', disabled && 'is-disabled'].filter(Boolean).join(' ')} dir="ltr">
      <svg viewBox={`${-half} ${vbY} ${half * 2} ${top + bottom}`} className="ch-svg" role="group" aria-label={toothLabel(n, lang)}>
        <Defs uid={uid} />
        <g transform={`scale(${1 / k})`}>
          <ToothShape info={info} view={view} cx={0} cy={0} uid={uid} picked={picked.join('')} interactive={!disabled && !!onToggle} handlers={handlers} />
        </g>
        {label('B', 0, midB)}
        {label('L', 0, -midB)}
        {label('M', midM, 0)}
        {label('D', -midM, 0)}
        {label(info.anterior ? 'I' : 'O', 0, 0)}
        {label('R', 0, -(g.h / 2 + g.root * (g.roots === 2 ? 0.3 : 0.45)))}
      </svg>
    </div>
  )
}

// ---- read-only overview for other modules ----------------------------------------------------------
/**
 * A small, non-interactive chart. Pass the records you already have, or just a patientId and it loads them.
 * `highlight` rings teeth (e.g. the teeth of a treatment or a lab order).
 */
export function MiniDentalChart({ patientId, records, dentition = 'adult', highlight, legend = true, className }: { patientId?: string; records?: ToothRecord[]; dentition?: Dentition; highlight?: number[]; legend?: boolean; className?: string }) {
  const loaded = useLiveQuery(async (): Promise<ToothRecord[] | undefined> => (records || !patientId ? undefined : db.teeth.where('patientId').equals(patientId).toArray()), [patientId, !!records])
  const list = records ?? loaded ?? []
  return <DentalChart records={list} dentition={dentition} highlight={highlight} compact interactive={false} readOnly legend={legend} className={['ch-mini', className].filter(Boolean).join(' ')} />
}

export default DentalChart

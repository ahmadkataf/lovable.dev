// Geometry and number helpers for the hand-written SVG charts (pure; tests/reports.test.ts).

/** A "nice" axis: 0 → a round maximum in `count` (±1) equal steps of 1/2/2.5/5 × 10ⁿ. */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1]
  const raw = max / count
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / pow
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow
  const top = Math.ceil(max / step - 1e-9) * step
  const out: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out
}
/** Integer-only ticks for counts (never 0.5 of a patient). */
export function countTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  if (max <= count) return Array.from({ length: Math.ceil(max) + 1 }, (_, i) => i)
  const t = niceTicks(max, count)
  return t.every(v => Number.isInteger(v)) ? t : niceTicks(Math.ceil(max / count) * count, count).map(Math.round)
}

/** 0 · 950 · 1.2K · 12K · 1.5M (Latin digits). */
export function compactNumber(n: number): string {
  const a = Math.abs(n), s = n < 0 ? '-' : ''
  const trim = (x: number) => (x >= 100 ? Math.round(x).toString() : (Math.round(x * 10) / 10).toString())
  if (a >= 1e9) return `${s}${trim(a / 1e9)}B`
  if (a >= 1e6) return `${s}${trim(a / 1e6)}M`
  if (a >= 1e3) return `${s}${trim(a / 1e3)}K`
  return `${s}${Number.isInteger(a) ? a : Math.round(a * 10) / 10}`
}

/** Rough rendered width of a label (Arabic glyphs run a little wider than Latin ones). */
export function textWidth(s: string, fontSize = 11): number {
  let w = 0
  for (const ch of s) w += /[؀-ۿ]/.test(ch) ? 0.62 : /[0-9]/.test(ch) ? 0.6 : /[A-Z]/.test(ch) ? 0.68 : ch === ' ' ? 0.3 : 0.55
  return w * fontSize
}

/** Show every n-th x label so that labels never collide (n ≥ 1). */
export function labelStride(count: number, plotWidth: number, labelWidth: number, gap = 10): number {
  if (count <= 1 || plotWidth <= 0) return 1
  const fit = Math.max(1, Math.floor(plotWidth / (labelWidth + gap)))
  return Math.max(1, Math.ceil(count / fit))
}

/** Monotone cubic (Fritsch–Carlson) path through the points: smooth, never overshoots the data. */
export function monotonePath(pts: [number, number][]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`
  if (n === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`
  const dx: number[] = [], m: number[] = []
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = dx[i] ? (pts[i + 1][1] - pts[i][1]) / dx[i] : 0 }
  const t: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i])
  t[n - 1] = m[n - 2]
  const r = (v: number) => Math.round(v * 100) / 100
  let d = `M${r(pts[0][0])},${r(pts[0][1])}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += `C${r(pts[i][0] + h)},${r(pts[i][1] + t[i] * h)} ${r(pts[i + 1][0] - h)},${r(pts[i + 1][1] - t[i + 1] * h)} ${r(pts[i + 1][0])},${r(pts[i + 1][1])}`
  }
  return d
}

/** A column with a 4px rounded data end and a square foot on the baseline. */
export function barPath(x: number, y: number, w: number, h: number, radius = 4): string {
  if (h <= 0 || w <= 0) return ''
  const r = Math.min(radius, w / 2, h)
  const b = y + h
  return `M${x},${b}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${b}Z`
}

/** Donut segment between two angles (radians, 0 = 12 o'clock, clockwise). */
export function arcPath(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number): string {
  const full = a1 - a0 >= Math.PI * 2 - 1e-6
  if (full) {
    // two halves: a single arc cannot draw a full circle
    return arcPath(cx, cy, rOuter, rInner, a0, a0 + Math.PI) + arcPath(cx, cy, rOuter, rInner, a0 + Math.PI, a0 + Math.PI * 2)
  }
  const p = (r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)].map(v => Math.round(v * 100) / 100)
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = p(rOuter, a0), [x1, y1] = p(rOuter, a1), [x2, y2] = p(rInner, a1), [x3, y3] = p(rInner, a0)
  return `M${x0},${y0}A${rOuter},${rOuter} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${rInner},${rInner} 0 ${large} 0 ${x3},${y3}Z`
}

/** Start/end angles for each value, with a constant gap (radians) between neighbouring segments. */
export function donutAngles(values: number[], gap = 0.03): [number, number][] {
  const total = values.reduce((a, v) => a + Math.max(0, v), 0)
  const live = values.filter(v => v > 0).length
  if (total <= 0) return values.map(() => [0, 0])
  const g = live > 1 ? gap : 0
  const avail = Math.PI * 2 - g * live
  let a = 0
  return values.map(v => {
    if (v <= 0) return [a, a]
    const span = (Math.max(0, v) / total) * avail
    const seg: [number, number] = [a + g / 2, a + g / 2 + span]
    a += span + g
    return seg
  })
}

/** Share of a total as a 0–100 number with one decimal (0 when the total is 0). */
export const share = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0)

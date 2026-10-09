// Trophies (دروع). Every design is one or more uprights standing on a base, held by a long tenon under each upright's
// shoulder that runs down through every plate of the base: the step plates, the box top, the hollow inside of the box
// and its bottom (the foot plate underneath covers the ends). Glued in the slots, the uprights stand rigid without clamps.
// Light-wood inlays (a second sheet, material 'light') and a logo disc are glued on their faces.
//
// While designing: millimetres, x to the right from the middle of the base, y up from the top of the top step (the
// shoulder line). Uprights stand in planes one sheet thick, side by side in depth: plane 0 at the front.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, polyLoop, round3, roundedRectHole, oriented, circle, disc as discLoop } from './geom'
import type { PanelSpec } from './joints'

type P2 = { x: number; y: number }

// ------------------------------------------------------------------ polygon helpers (y up, counter-clockwise = positive)

function areaOf(pts: P2[]): number {
  let a = 0
  for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p.x * q.y - q.x * p.y }
  return a / 2
}
const ccw = (pts: P2[]) => (areaOf(pts) < 0 ? [...pts].reverse() : pts)
function centroidOf(pts: P2[]): P2 {
  let a = 0, cx = 0, cy = 0
  for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], k = p.x * q.y - q.x * p.y; a += k; cx += (p.x + q.x) * k; cy += (p.y + q.y) * k }
  return Math.abs(a) < 1e-12 ? { x: 0, y: 0 } : { x: cx / (3 * a), y: cy / (3 * a) }
}
function inPoly(q: P2, pts: P2[]): boolean {
  let c = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j]
    if ((a.y > q.y) !== (b.y > q.y) && q.x < a.x + ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y)) c = !c
  }
  return c
}
function segD(q: P2, a: P2, b: P2): number {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
  const k = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0
  return Math.hypot(q.x - a.x - k * dx, q.y - a.y - k * dy)
}
const bboxOf = (pts: P2[]) => ({ x0: Math.min(...pts.map(q => q.x)), x1: Math.max(...pts.map(q => q.x)), y0: Math.min(...pts.map(q => q.y)), y1: Math.max(...pts.map(q => q.y)) })
const circlePts = (c: P2, r: number, n = Math.max(48, Math.ceil(2 * Math.PI * r / 1.5))): P2[] => Array.from({ length: n }, (_, k) => ({ x: c.x + r * Math.cos((2 * Math.PI * k) / n), y: c.y + r * Math.sin((2 * Math.PI * k) / n) }))
/** A star of k points, outer radius R and inner radius ri, the first point at angle a0 (radians, y up). */
const starPts = (c: P2, R: number, ri: number, k: number, a0 = Math.PI / 2): P2[] =>
  Array.from({ length: 2 * k }, (_, i) => { const r = i % 2 ? ri : R, a = a0 + (i * Math.PI) / k; return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) } })

/** Line segments filed in square cells, for nearest-distance and ray questions on a set of closed loops. */
class SegIndex {
  private cells = new Map<number, number[]>()
  private segs: { a: P2; b: P2; loop: number; i: number }[] = []
  constructor(public loops: P2[][], private cell: number) {
    loops.forEach((l, li) => l.forEach((a, i) => {
      const b = l[(i + 1) % l.length], s = this.segs.length
      this.segs.push({ a, b, loop: li, i })
      for (let cx = Math.floor(Math.min(a.x, b.x) / cell); cx <= Math.floor(Math.max(a.x, b.x) / cell); cx++)
        for (let cy = Math.floor(Math.min(a.y, b.y) / cell); cy <= Math.floor(Math.max(a.y, b.y) / cell); cy++) {
          const k = cx * 100003 + cy, arr = this.cells.get(k)
          if (arr) arr.push(s); else this.cells.set(k, [s])
        }
    }))
  }
  private around(x0: number, y0: number, x1: number, y1: number): number[] {
    const out = new Set<number>()
    for (let cx = Math.floor(x0 / this.cell); cx <= Math.floor(x1 / this.cell); cx++)
      for (let cy = Math.floor(y0 / this.cell); cy <= Math.floor(y1 / this.cell); cy++) for (const s of this.cells.get(cx * 100003 + cy) ?? []) out.add(s)
    return [...out]
  }
  /** distance from q to the nearest segment, or `max` when none is closer: rings of cells outward from q, stopping
   * once a ring lies farther than the best distance found (or past the filed cells) */
  dist(q: P2, max: number): number {
    if (!this.bounds) this.bounds = this.fileBounds()
    const { x0, y0, x1, y1 } = this.bounds, c = this.cell, cx = Math.floor(q.x / c), cy = Math.floor(q.y / c)
    const far = Math.max(Math.abs(cx - x0), Math.abs(cx - x1), Math.abs(cy - y0), Math.abs(cy - y1))
    const last = Math.min(far, Math.ceil(max / c) + 1)
    let d = max
    const visit = (i: number, j: number) => {
      if (i < x0 || i > x1 || j < y0 || j > y1) return
      for (const s of this.cells.get(i * 100003 + j) ?? []) d = Math.min(d, segD(q, this.segs[s].a, this.segs[s].b))
    }
    for (let r = 0; r <= last; r++) {
      if ((r - 1) * c > d) break
      if (r === 0) { visit(cx, cy); continue }
      for (let i = -r; i <= r; i++) { visit(cx + i, cy - r); visit(cx + i, cy + r) }
      for (let j = -r + 1; j < r; j++) { visit(cx - r, cy + j); visit(cx + r, cy + j) }
    }
    return d
  }
  private bounds?: { x0: number; y0: number; x1: number; y1: number }
  private fileBounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const k of this.cells.keys()) { const i = Math.round(k / 100003), j = k - i * 100003; x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j) }
    return { x0, y0, x1, y1 }
  }
  /** how far a ray from q along the unit vector n runs before it meets a segment (not the ones skip() names), up to max */
  ray(q: P2, n: P2, max: number, skip: (loop: number, i: number) => boolean): number {
    const e = { x: q.x + n.x * max, y: q.y + n.y * max }
    let best = max
    for (const s of this.around(Math.min(q.x, e.x), Math.min(q.y, e.y), Math.max(q.x, e.x), Math.max(q.y, e.y))) {
      const g = this.segs[s]
      if (skip(g.loop, g.i)) continue
      const rx = g.b.x - g.a.x, ry = g.b.y - g.a.y, den = n.x * ry - n.y * rx
      if (Math.abs(den) < 1e-12) continue
      const wx = g.a.x - q.x, wy = g.a.y - q.y, sRay = (wx * ry - wy * rx) / den, u = (wx * n.y - wy * n.x) / den
      if (sRay > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, sRay)
    }
    return best
  }
}

/** Where the edges of two closed polygons cross, with their positions along each. */
interface Hit { a: number; ta: number; b: number; tb: number; p: P2; id: number }
function crossings(A: P2[], B: P2[]): Hit[] | null {
  const out: Hit[] = [], na = A.length, nb = B.length
  const bb = B.map((p, j) => { const q = B[(j + 1) % nb]; return [Math.min(p.x, q.x), Math.max(p.x, q.x), Math.min(p.y, q.y), Math.max(p.y, q.y)] })
  for (let i = 0; i < na; i++) {
    const p = A[i], q = A[(i + 1) % na], x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y)
    for (let j = 0; j < nb; j++) {
      const b = bb[j]
      if (b[0] > x1 || b[1] < x0 || b[2] > y1 || b[3] < y0) continue
      const r = B[j], s = B[(j + 1) % nb], d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x)
      if (Math.abs(d) < 1e-12) continue
      const ta = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d, tb = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d
      if (ta < -1e-9 || ta > 1 + 1e-9 || tb < -1e-9 || tb > 1 + 1e-9) continue
      // a crossing at a vertex is ambiguous: the caller moves one polygon a hair and asks again
      if (ta < 1e-7 || ta > 1 - 1e-7 || tb < 1e-7 || tb > 1 - 1e-7) return null
      out.push({ a: i, ta, b: j, tb, p: { x: p.x + ta * (q.x - p.x), y: p.y + ta * (q.y - p.y) }, id: out.length })
    }
  }
  return out
}
/** A polygon cut at the crossing points into chains, each from one crossing to the next. */
function chainsOf(L: P2[], hits: Hit[], own: 'a' | 'b') {
  const pos = (h: Hit) => (own === 'a' ? h.a + h.ta : h.b + h.tb), seg = (h: Hit) => (own === 'a' ? h.a : h.b)
  const s = [...hits].sort((u, v) => pos(u) - pos(v)), n = L.length
  return s.map((h0, k) => {
    const h1 = s[(k + 1) % s.length]
    let steps = (seg(h1) - seg(h0) + n) % n
    if (steps === 0 && pos(h1) <= pos(h0)) steps = n
    const pts = [h0.p]
    for (let m = 0; m < steps; m++) pts.push(L[(seg(h0) + 1 + m) % n])
    pts.push(h1.p)
    return { from: h0.id, to: h1.id, pts }
  })
}
const chainMid = (pts: P2[]) => { const k = Math.max(0, Math.floor((pts.length - 2) / 2)); return { x: (pts[k].x + pts[k + 1].x) / 2, y: (pts[k].y + pts[k + 1].y) / 2 } }
/** Union or difference (A − B) of two simple polygons; the result's outer loops run counter-clockwise. */
function boolOp(A0: P2[], B0: P2[], op: 'union' | 'diff'): P2[][] {
  const A = ccw(A0)
  let B = ccw(B0), hits = crossings(A, B)
  for (let k = 1; !hits && k < 6; k++) { const e = 1e-6 * k; B = B.map(q => ({ x: q.x + e, y: q.y + 0.7 * e })); hits = crossings(A, B) }
  if (!hits) return op === 'union' ? [A, B] : [A]
  if (!hits.length) {
    const bIn = inPoly(B[0], A), aIn = inPoly(A[0], B)
    if (op === 'union') return bIn ? [A] : aIn ? [B] : [A, B]
    return aIn ? [] : bIn ? [A, [...B].reverse()] : [A]
  }
  const ca = chainsOf(A, hits, 'a').filter(c => !inPoly(chainMid(c.pts), B))
  const cbAll = chainsOf(B, hits, 'b')
  const cb = op === 'union' ? cbAll.filter(c => !inPoly(chainMid(c.pts), A)) : cbAll.filter(c => inPoly(chainMid(c.pts), A)).map(c => ({ from: c.to, to: c.from, pts: [...c.pts].reverse() }))
  const all = [...ca, ...cb], byFrom = new Map<number, typeof all[number]>()
  for (const c of all) byFrom.set(c.from, c)
  const used = new Set<typeof all[number]>(), loops: P2[][] = []
  for (const c0 of all) {
    if (used.has(c0)) continue
    const loop: P2[] = []
    let c: typeof all[number] | undefined = c0
    for (let guard = 0; c && !used.has(c) && guard <= all.length; guard++) { used.add(c); loop.push(...c.pts.slice(0, -1)); c = byFrom.get(c.to) }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

/** The closed polygon with every edge moved d to its left (inwards for a counter-clockwise polygon), corners mitred. */
function offsetPoly(pts: P2[], d: number): P2[] {
  const n = pts.length, nrm = (i: number) => { const a = pts[i], b = pts[(i + 1) % n], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l } }
  const ns = Array.from({ length: n }, (_, i) => nrm(i))
  return pts.map((p, i) => {
    const n0 = ns[(i - 1 + n) % n], n1 = ns[i], k = Math.max(0.02, 1 + n0.x * n1.x + n0.y * n1.y)
    return { x: p.x + ((n0.x + n1.x) / k) * d, y: p.y + ((n0.y + n1.y) / k) * d }
  })
}
/** The part of a polygon where nx·x + ny·y ≥ c (one cut, Sutherland–Hodgman). */
function clipHalf(pts: P2[], nx: number, ny: number, c: number): P2[] {
  const out: P2[] = [], f = (q: P2) => nx * q.x + ny * q.y - c
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], fp = f(p), fq = f(q)
    if (fp >= 0) out.push(p)
    if ((fp >= 0) !== (fq >= 0)) { const k = fp / (fp - fq); out.push({ x: p.x + k * (q.x - p.x), y: p.y + k * (q.y - p.y) }) }
  }
  return out
}
/** Drop points closer than `min` to the one kept before them. */
function thin(pts: P2[], min = 0.05): P2[] {
  const out: P2[] = []
  for (const q of pts) if (!out.length || Math.hypot(q.x - out[out.length - 1].x, q.y - out[out.length - 1].y) > min) out.push(q)
  while (out.length > 3 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= min) out.pop()
  return out
}
function selfCrosses(pts: P2[]): boolean {
  const n = pts.length
  const bb = pts.map((p, i) => { const q = pts[(i + 1) % n]; return [Math.min(p.x, q.x), Math.max(p.x, q.x), Math.min(p.y, q.y), Math.max(p.y, q.y)] })
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue
    const a = bb[i], b = bb[j]
    if (a[0] > b[1] || b[0] > a[1] || a[2] > b[3] || b[2] > a[3]) continue
    const p = pts[i], q = pts[(i + 1) % n], r = pts[j], s = pts[(j + 1) % n]
    const o = (u: P2, v: P2, w: P2) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x)
    if (o(p, q, r) * o(p, q, s) < -1e-12 && o(r, s, p) * o(r, s, q) < -1e-12) return true
  }
  return false
}
/** 0 when two closed polygons cross or one holds the other, else the distance between them. */
function polyGap(A: P2[], B: P2[]): number {
  const h = crossings(A, B)
  if (h === null || h.length || inPoly(A[0], B) || inPoly(B[0], A)) return 0
  let d = Infinity
  const ib = new SegIndex([B], 8), ia = new SegIndex([A], 8)
  for (const q of A) d = Math.min(d, ib.dist(q, Math.min(d, 1e4)))
  for (const q of B) d = Math.min(d, ia.dist(q, Math.min(d, 1e4)))
  return d
}

// ------------------------------------------------------------------ smooth outlines

/** A node of an outline: `c` marks a sharp corner where the smooth curve stops and starts again. */
type N = [number, number] | [number, number, 1]
/** A closed outline through the nodes: centripetal Catmull–Rom curves between corners, straight lines between two corners. */
function smooth(nodes: P2[], corner: boolean[], step = 1.5): P2[] {
  const n = nodes.length, out: P2[] = []
  const cr = (p0: P2, p1: P2, p2: P2, p3: P2) => {
    const d = (a: P2, b: P2) => Math.max(1e-6, Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)))
    const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3), m = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step))
    const L = (a: P2, b: P2, ta: number, tb: number, t: number) => ({ x: ((tb - t) * a.x + (t - ta) * b.x) / (tb - ta), y: ((tb - t) * a.y + (t - ta) * b.y) / (tb - ta) })
    for (let k = 0; k < m; k++) {
      const t = t1 + ((t2 - t1) * k) / m
      const A1 = L(p0, p1, 0, t1, t), A2 = L(p1, p2, t1, t2, t), A3 = L(p2, p3, t2, t3, t)
      out.push(L(L(A1, A2, 0, t2, t), L(A2, A3, t1, t3, t), t1, t2, t))
    }
  }
  const ref = (a: P2, b: P2) => ({ x: 2 * a.x - b.x, y: 2 * a.y - b.y })
  for (let i = 0; i < n; i++) {
    const p1 = nodes[i], p2 = nodes[(i + 1) % n]
    if (corner[i] && corner[(i + 1) % n]) { out.push(p1); continue }
    cr(corner[i] ? ref(p1, p2) : nodes[(i - 1 + n) % n], p1, p2, corner[(i + 1) % n] ? ref(p2, p1) : nodes[(i + 2) % n])
  }
  return thin(out)
}
/** Nodes given in design units, scaled: x by sx, y by sy. */
function outline(nodes: N[], sx: number, sy: number, step = 1.5): P2[] {
  return ccw(smooth(nodes.map(v => ({ x: v[0] * sx, y: v[1] * sy })), nodes.map(v => v.length === 3), step))
}

// ------------------------------------------------------------------ the thinness test

/**
 * The narrowest part of a piece: from points every millimetre round the outline (and its holes), a ray straight into
 * the material until it leaves again. Near a pointed corner the material has to get thin, so a stretch as long as the
 * point needs to reach the width (minW / 2 / tan(half its angle)) is not measured.
 */
function narrowest(loops: P2[][], minW: number): { w: number; at: P2 } {
  const idx = new SegIndex(loops, Math.max(4, minW))
  const exempt: { p: P2; r: number }[] = []
  for (const l of loops) for (let i = 0; i < l.length; i++) {
    const a = l[(i - 1 + l.length) % l.length], p = l[i], b = l[(i + 1) % l.length]
    const ux = p.x - a.x, uy = p.y - a.y, vx = b.x - p.x, vy = b.y - p.y
    const turn = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy) // > 0 turns towards the material (left): a convex corner
    if (turn > Math.PI / 6) { const alpha = Math.PI - turn; exempt.push({ p, r: minW / 2 / Math.tan(alpha / 2) + 1 }) }
  }
  let w = minW, at: P2 = { x: 0, y: 0 }
  loops.forEach((l, li) => {
    for (let i = 0; i < l.length; i++) {
      const a = l[i], b = l[(i + 1) % l.length], len = Math.hypot(b.x - a.x, b.y - a.y)
      if (len < 1e-9) continue
      const nrm = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len }, m = Math.max(1, Math.ceil(len))
      for (let k = 0; k < m; k++) {
        const q = { x: a.x + ((b.x - a.x) * (k + 0.5)) / m, y: a.y + ((b.y - a.y) * (k + 0.5)) / m }
        if (exempt.some(e => Math.hypot(q.x - e.p.x, q.y - e.p.y) < e.r)) continue
        const s = idx.ray(q, nrm, w, (lj, j) => lj === li && Math.min((j - i + l.length) % l.length, (i - j + l.length) % l.length) <= 1)
        if (s < w) { w = s; at = q }
      }
    }
  })
  return { w, at }
}

// ------------------------------------------------------------------ the trophy model

interface Up { id: string; name: string; plane: number; pts: P2[]; holes?: P2[][]; tenons: [number, number][]; note: string }
interface Inl { id: string; name: string; host: string; pts: P2[]; frame?: P2[]; note: string }
interface Medal { host: string; c: P2; r: number }
interface Shape { ups: Up[]; inlays: Inl[]; medal?: Medal; errors: string[]; notes: string[] }
/** What a design gets: the base width W and depth D, the free height Hf above the top step, the sheet t. */
interface Geo { W: number; D: number; Hf: number; t: number; minW: number; rim: number; p: Record<string, number> }
interface Spec {
  id: string; name: string; desc: string; icon: string; extra: ParamDef[]; defaults: Record<string, number>
  /** the free height over the design's width (W, or the board for the plaque) must stay in this range */
  ratio: [number, number]; width: (p: Record<string, number>) => number; widthLabel: string
  make: (g: Geo) => Shape
}

const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const mmP = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', ...(hint ? { hint } : {}) })
const intP = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 1, int: true, ...(hint ? { hint } : {}) })

const BASE_PARAMS: ParamDef[] = [
  mmP('H', 'الارتفاع الكلّي', 150, 800, 'من الطاولة إلى أعلى نقطة في الدرع'),
  mmP('W', 'عرض القاعدة', 50, 400, 'عرض الصندوق من الخارج؛ القطع القائمة تكبر وتصغر معه'),
  mmP('D', 'عمق القاعدة', 30, 300),
  { ...intP('kind', 'نوع القاعدة', 1, 2, '1 = صندوق مجوّف بلوحة اسم (كالصورة)، 2 = ألواح مسطّحة مكدّسة (أرخص وأقصر)'), options: ['صندوق بلوحة اسم', 'ألواح مكدّسة'] },
  mmP('hb', 'ارتفاع الصندوق', 15, 200, 'للقاعدة 1: من أسفل الصندوق إلى أعلاه'),
  intP('nl', 'عدد ألواح القاعدة المكدّسة', 1, 15, 'للقاعدة 2: ألواح بمقاس القاعدة فوق بعضها'),
  intP('fj', 'زوايا الصندوق بتعشيق أصابع', 0, 1, '0 = لصق عادي بزوايا نظيفة (كالصورة)، 1 = أصابع متعشّقة'),
  intP('plate', 'لوحة الاسم', 0, 1, 'لوحة فاتحة بزوايا مستديرة على واجهة الصندوق'),
  mmP('nb', 'هامش لوحة الاسم', 2, 20, 'من حافّتي الصندوق الجانبيتين ومن أسفله؛ الهامش العلوي ضعفه'),
  mmP('fo', 'بروز القدم', 0, 20, 'اللوح السفلي أكبر من الصندوق بهذا القدر من كل جهة'),
  intP('ns', 'عدد الدرجات', 0, 3, 'ألواح فوق الصندوق تصغر درجةً درجة، تقف عليها القطع'),
  mmP('si', 'تراجع الدرجة', 1, 20, 'كل درجة أصغر من التي تحتها بهذا القدر من كل جهة'),
  mmP('rim', 'إطار الحشوات', 1.5, 10, 'عرض الخشب الغامق الظاهر حول كل حشوة فاتحة'),
  intP('inl', 'الحشوات', 0, 1, '1 = تُقصّ من لوح فاتح وتُلصق، 0 = يُحفر خطّها فقط على القطعة'),
  intP('disc', 'قرص الشعار', 0, 1, 'قرص غامق عليه قرص فاتح للشعار'),
  mmP('dr', 'إطار القرص', 1, 8, 'الحلقة الغامقة الظاهرة حول القرص الفاتح'),
  intP('n', 'العدد', 1, 30, 'كم درعاً تُقصّ'),
  mmP('fit', 'خلوص الشقوق', 0, 0.5, 'يُضاف إلى عرض الشقّ فوق سماكة اللوح'),
]
const BASE_DEFAULTS = { H: 300, W: 100, D: 65, kind: 1, hb: 50, nl: 4, fj: 0, plate: 1, nb: 4.5, fo: 2.5, ns: 1, si: 3.5, rim: 4, inl: 1, disc: 1, dr: 2, n: 1, fit: 0.15 }

/** The tenons' depth positions: plane k at z = zc(k), the planes side by side round the middle of the base (z toward the front). */
const planeZ = (planes: number, t: number) => (k: number) => ((planes - 1) / 2 - k) * t

export interface TrophyModel {
  shape: Shape
  W: number; D: number; Hf: number; t: number; foot: number; base: number; steps: number
  /** the base seen from the front: rectangles [x0, y0, x1, y1] from the table up, and the nameplate */
  baseRects: { x0: number; y0: number; x1: number; y1: number; kind: 'foot' | 'box' | 'layer' | 'step' | 'plate' }[]
  medalR?: { c: P2; r: number; ri: number }
}

function model(spec: Spec, p: Record<string, number>, c: Common) {
  const t = c.t, errors: string[] = [], warnings: string[] = []
  const { H, W, D, hb, fo, si, rim, fit } = p
  const kind = Math.round(p.kind) === 2 ? 2 : 1, nl = Math.max(1, Math.round(p.nl)), ns = Math.max(0, Math.round(p.ns)), fj = Math.round(p.fj) > 0
  const baseH = kind === 1 ? hb : nl * t, Hf = round3(H - t - baseH - ns * t)
  const minW = Math.max(10, 3 * t)
  const dw = spec.width(p), [rLo, rHi] = spec.ratio
  if (kind === 1 && hb < 2 * t + 8) errors.push(`الصندوق قصير على ألواحه: اجعل ارتفاعه ${Math.ceil(2 * t + 8)} مم على الأقل.`)
  if (Hf < rLo * dw) errors.push(`الدرع قصير على ${spec.widthLabel} ${dw} مم: اجعل الارتفاع الكلّي ${Math.ceil(rLo * dw + H - Hf)} مم على الأقل${kind === 1 ? '، أو قلّل ارتفاع الصندوق' : ''}، أو صغّر ${spec.widthLabel} إلى ${Math.floor(Math.max(0, Hf) / rLo)} مم.`)
  else if (Hf > rHi * dw) errors.push(`الدرع نحيل جداً على ${spec.widthLabel} ${dw} مم: اجعل الارتفاع الكلّي ${Math.floor(rHi * dw + H - Hf)} مم على الأكثر، أو كبّر ${spec.widthLabel} إلى ${Math.ceil(Hf / rHi)} مم.`)
  return { t, errors, warnings, kind, nl, ns, fj, baseH, Hf, minW, W, D, hb, fo, si, rim, fit }
}

function buildTrophy(spec: Spec, p: Record<string, number>, c: Common): { res: BuildResult; m?: TrophyModel } {
  const g = model(spec, p, c)
  const { t, errors, warnings, kind, nl, ns, fj, baseH, Hf, minW, W, D, hb, fo, si, rim, fit } = g
  const n = Math.max(1, Math.round(p.n)), inl = Math.round(p.inl) > 0, withDisc = Math.round(p.disc) > 0, plate = Math.round(p.plate) > 0 && kind === 1
  if (errors.length) return { res: { panels: [], notes: [], warnings, errors, slotted: true } }
  const shape = spec.make({ W, D, Hf, t, minW, rim, p })
  errors.push(...shape.errors)
  const ups = shape.ups, byId = new Map(ups.map(u => [u.id, u]))
  const planes = Math.max(...ups.map(u => u.plane)) + 1, zOf = planeZ(planes, t)

  // ---- the uprights: no thinner than minW (pointed corners aside), and inside the free height
  for (const u of ups) {
    if (selfCrosses(u.pts)) { errors.push(`شكل «${u.name}» يتقاطع مع نفسه بهذه المقاسات: غيّر الارتفاع أو العرض.`); continue }
    const nw = narrowest([u.pts, ...(u.holes ?? []).map(h => [...ccw(h)].reverse())], minW)
    if (nw.w < minW - 1e-6) {
      const k = minW / Math.max(nw.w, 0.1)
      errors.push(`في «${u.name}» جزء عرضه ${f1(nw.w)} مم فقط على ارتفاع ${Math.round(nw.at.y)} مم فوق القاعدة، وأقلّ عرض متين ${f1(minW)} مم بهذه السماكة: كبّر الدرع، مثلاً عرض القاعدة ${Math.ceil(W * k)} مم والارتفاع الكلّي ${Math.ceil(H(p) * k)} مم.`)
    }
  }
  // ---- inlays: inside their piece with the border all round, apart from each other, big enough to glue
  const medal = withDisc ? shape.medal : undefined
  let inlays = shape.inlays
  if (medal) {
    const mc = circlePts(medal.c, medal.r + 1.5)
    inlays = inlays.flatMap(il => {
      if (il.host !== medal.host) return [il]
      const gapIn = inPoly(medal.c, il.pts) ? new SegIndex([il.pts], 8).dist(medal.c, medal.r + 2) - medal.r : -1
      if (gapIn >= 1) return [il] // the disc sits on the inlay
      const gap = polyGap(il.pts, mc)
      if (gap > 0) return [il]
      const parts = boolOp(il.pts, mc, 'diff').filter(q => areaOf(q) > 20)
      return parts.map((q, k) => ({ ...il, id: parts.length > 1 ? `${il.id}-${k + 1}` : il.id, pts: q, frame: undefined }))
    })
  }
  for (const il of inlays) {
    const host = byId.get(il.host)!
    if (selfCrosses(il.pts) || areaOf(il.pts) <= 0) { errors.push(`إطار الحشوات ${rim} مم عريض على «${il.name}»: اجعله ${f1(Math.max(1.5, rim / 2))} مم أو كبّر الدرع.`); continue }
    const b = bboxOf(il.pts)
    if (Math.min(b.x1 - b.x0, b.y1 - b.y0) < 8 || areaOf(il.pts) < 150) { errors.push(`«${il.name}» صغيرة جداً: قلّل إطار الحشوات إلى ${f1(Math.max(1.5, rim / 2))} مم أو كبّر الدرع.`); continue }
    const border = new SegIndex([host.pts, ...(host.holes ?? [])], 8)
    const outside = il.pts.some(q => !inPoly(q, host.pts) || (host.holes ?? []).some(h => inPoly(q, h)))
    const near = Math.min(...il.pts.map(q => border.dist(q, rim + 1)))
    if (outside || near < rim - 0.05 || polyGap(il.pts, host.pts) === 0 && outside) errors.push(`«${il.name}» تقترب من حافّة «${host.name}» (${f1(Math.max(0, near))} مم، والإطار ${rim} مم): قلّل إطار الحشوات أو كبّر الدرع.`)
  }
  for (let i = 0; i < inlays.length; i++) for (let j = i + 1; j < inlays.length; j++)
    if (inlays[i].host === inlays[j].host && polyGap(inlays[i].pts, inlays[j].pts) < 1) errors.push(`«${inlays[i].name}» و«${inlays[j].name}» متلاصقتان: قلّل إطار الحشوات أو كبّر الدرع.`)
  // ---- the disc: glued on its piece, clear of the pieces in the plane in front of that piece
  let medalInfo: TrophyModel['medalR']
  if (medal) {
    const host = byId.get(medal.host)!, ri = medal.r - p.dr
    medalInfo = { c: medal.c, r: medal.r, ri }
    if (ri < 6) errors.push(`القرص صغير على إطاره (${f1(medal.r * 2)} مم): قلّل إطار القرص إلى ${f1(Math.max(1, medal.r - 6))} مم أو كبّر الدرع، أو ألغِ القرص.`)
    let on = 0, all = 0
    for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) {
      const q = { x: medal.c.x + (medal.r * i) / 10, y: medal.c.y + (medal.r * j) / 10 }
      if (Math.hypot(q.x - medal.c.x, q.y - medal.c.y) > medal.r) continue
      all++
      if (inPoly(q, host.pts) && !(host.holes ?? []).some(h => inPoly(q, h))) on++
    }
    if (on < 0.35 * all) errors.push(`القرص لا يستند على «${host.name}» بما يكفي للّصق: غيّر الارتفاع أو العرض، أو ألغِ القرص.`)
    for (const u of ups) if (u.plane === host.plane - 1) {
      const gap = inPoly(medal.c, u.pts) ? -1 : new SegIndex([u.pts], 8).dist(medal.c, medal.r + 3) - medal.r
      if (gap < 2) errors.push(`القرص يلمس «${u.name}» (يلزم 2 مم بينهما): غيّر الارتفاع أو العرض، أو ألغِ القرص.`)
    }
  }
  // ---- tenons and their slots in every plate of the base
  const L = round3(ns * t + baseH - 0.5)
  const slots: { x0: number; x1: number; z: number; up: Up }[] = []
  for (const u of ups) {
    const z = zOf(u.plane), foot = bottomEdge(u.pts)
    for (const [a, b] of u.tenons) {
      if (b - a < Math.max(6, 2 * t) - 1e-6) errors.push(`لسان «${u.name}» ضيّق (${f1(b - a)} مم، وأقلّه ${f1(Math.max(6, 2 * t))} مم): كبّر عرض القاعدة إلى ${Math.ceil((W * Math.max(6, 2 * t)) / Math.max(b - a, 0.1))} مم على الأقل.`)
      if (!foot || a - foot[0] < 2 - 1e-6 || foot[1] - b < 2 - 1e-6) errors.push(`لسان «${u.name}» لا يترك كتفاً على الدرجة: كبّر عرض القاعدة.`)
      slots.push({ x0: a, x1: b, z, up: u })
    }
  }
  const sx = (s: typeof slots[number]) => [s.x0 - fit / 2, s.x1 + fit / 2], sz = (s: typeof slots[number]) => [s.z - (t + fit) / 2, s.z + (t + fit) / 2]
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
    const [a0, a1] = sx(slots[i]), [b0, b1] = sx(slots[j]), [c0, c1] = sz(slots[i]), [d0, d1] = sz(slots[j])
    const gx = Math.max(b0 - a1, a0 - b1), gz = Math.max(d0 - c1, c0 - d1)
    const gap = gx > 0 && gz > 0 ? Math.hypot(gx, gz) : Math.max(gx, gz)
    if (gap < 2 - 1e-6) errors.push(`شقّا «${slots[i].up.name}» و«${slots[j].up.name}» متقاربان (${f1(Math.max(0, gap))} مم، ويلزم 2 مم): كبّر عرض القاعدة.`)
  }
  const xr = slots.length ? Math.max(...slots.map(s => Math.max(-sx(s)[0], sx(s)[1]))) : 0, zr = slots.length ? Math.max(...slots.map(s => Math.max(-sz(s)[0], sz(s)[1]))) : 0
  // the margin round the slots in each plate: the box top and bottom stay t + 2 clear of the box's outer faces
  const plateChecks: { name: string; hw: number; hd: number; m: number }[] = [
    ...(kind === 1 ? [{ name: 'غطاء الصندوق وقاعه', hw: W / 2, hd: D / 2, m: t + 2 }] : [{ name: 'ألواح القاعدة', hw: W / 2, hd: D / 2, m: 2 }]),
    ...(ns ? [{ name: `الدرجة ${ns}`, hw: W / 2 - si * ns, hd: D / 2 - si * ns, m: 2 }] : []),
  ]
  for (const pc of plateChecks) {
    if (xr > pc.hw - pc.m + 1e-6) {
      const needW = Math.ceil(2 * (xr + pc.m + (pc.hw < W / 2 ? si * ns : 0)))
      errors.push(`${pc.name} أضيق من ألسنة القطع: ${ns && pc.hw < W / 2 ? `قلّل تراجع الدرجة إلى ${f1(Math.max(1, (W / 2 - xr - pc.m) / ns))} مم، أو ` : ''}اجعل عرض القاعدة ${needW} مم على الأقل.`)
    }
    if (zr > pc.hd - pc.m + 1e-6) errors.push(`${pc.name} أقلّ عمقاً من الشقوق: ${ns && pc.hd < D / 2 ? `قلّل تراجع الدرجة إلى ${f1(Math.max(1, (D / 2 - zr - pc.m) / ns))} مم، أو ` : ''}اجعل عمق القاعدة ${Math.ceil(2 * (zr + pc.m + (pc.hd < D / 2 ? si * ns : 0)))} مم على الأقل.`)
  }
  if (W - 2 * si * ns < 20 || D - 2 * si * ns < 15) errors.push(`الدرجات تصغر حتى تختفي: قلّل تراجع الدرجة إلى ${f1(Math.max(1, Math.min((W - 20) / (2 * ns || 1), (D - 15) / (2 * ns || 1))))} مم أو عدد الدرجات.`)
  // ---- the nameplate
  const npW = round3(W - 2 * Math.max(p.nb, fj ? t + 1 : 0)), npH = round3(hb - 3 * p.nb), npX = round3((W - npW) / 2), npY = round3(p.nb) // from the box's bottom
  if (plate && (npW < 30 || npH < 12)) errors.push(`لوحة الاسم صغيرة (${f1(npW)} × ${f1(npH)} مم): ${npH < 12 ? `اجعل ارتفاع الصندوق ${Math.ceil(12 + 3 * p.nb)} مم على الأقل أو قلّل هامشها إلى ${f1(Math.max(2, (hb - 12) / 3))} مم` : `اجعل عرض القاعدة ${Math.ceil(30 + 2 * p.nb)} مم على الأقل`}، أو ألغِ اللوحة.`)
  // ---- balance: the centre of mass over the foot
  const baseArea = kind === 1 ? 2 * W * hb + 2 * D * hb + 2 * W * D : nl * W * D
  const footArea = (W + 2 * fo) * (D + 2 * fo), stepArea = Array.from({ length: ns }, (_, i) => (W - 2 * si * (i + 1)) * (D - 2 * si * (i + 1))).reduce((s, v) => s + v, 0)
  let mUp = 0, xUp = 0, yUp = 0
  const addMass = (pts: P2[], sign = 1) => { const a = Math.abs(areaOf(pts)) * sign, cc = centroidOf(pts); mUp += a; xUp += a * cc.x; yUp += a * cc.y }
  for (const u of ups) { addMass(u.pts); for (const h of u.holes ?? []) addMass(h, -1) }
  for (const il of inlays) addMass(il.pts)
  if (medal) { addMass(circlePts(medal.c, medal.r)); addMass(circlePts(medal.c, medal.r - p.dr)) }
  const mBase = baseArea + footArea + stepArea, zBase = t + baseH + ns * t
  const xc = xUp / (mUp + mBase), half = W / 2 + fo
  if (Math.abs(xc) > 0.5 * half) {
    // the base is the counterweight: how deep it must be for the centre to come back to half the foot
    const need = Math.abs(xUp) / (0.5 * half) - mUp, perD = kind === 1 ? 2 * hb + 2 * W : nl * W
    errors.push(`الدرع يميل إلى ${xc > 0 ? 'اليمين' : 'اليسار'} وقد ينقلب: اجعل عمق القاعدة ${Math.ceil(D + Math.max(0, need - mBase) / perD)} مم على الأقل، أو عرضها أكبر.`)
  }
  const yc = (yUp + mUp * zBase) / (mUp + mBase) // roughly: the base's own weight sits low
  if (D / 2 + fo < 0.3 * yc) warnings.push(`القاعدة قليلة العمق على ارتفاع الدرع وقد ينقلب للأمام أو الخلف بلمسة: الأفضل عمق ${Math.ceil(0.6 * yc - 2 * fo)} مم أو أكثر.`)
  if (D < 2 * (zr + 6)) warnings.push('القاعدة قليلة العمق: الألسنة قريبة من الجدران.')

  const m: TrophyModel = {
    shape: { ...shape, inlays }, W, D, Hf, t, foot: t, base: baseH, steps: ns * t, medalR: medalInfo,
    baseRects: [
      { x0: -W / 2 - fo, y0: 0, x1: W / 2 + fo, y1: t, kind: 'foot' },
      ...(kind === 1 ? [{ x0: -W / 2, y0: t, x1: W / 2, y1: t + hb, kind: 'box' as const }] : Array.from({ length: nl }, (_, i) => ({ x0: -W / 2, y0: t + i * t, x1: W / 2, y1: t + (i + 1) * t, kind: 'layer' as const }))),
      ...Array.from({ length: ns }, (_, i) => ({ x0: -W / 2 + si * (i + 1), y0: t + baseH + i * t, x1: W / 2 - si * (i + 1), y1: t + baseH + (i + 1) * t, kind: 'step' as const })),
      ...(plate ? [{ x0: -W / 2 + npX, y0: t + npY, x1: -W / 2 + npX + npW, y1: t + npY + npH, kind: 'plate' as const }] : []),
    ],
  }
  if (errors.length) return { res: { panels: [], notes: [], warnings, errors, slotted: true }, m }

  // ------------------------------------------------------------------ panels
  const panels: PanelSpec[] = []
  const toPanel = (pts: P2[]) => pts.map(q => ({ x: round3(q.x), y: round3(-q.y) }))
  const eng = (pts: P2[]): Loop => ({ closed: true, layer: 'engrave', pts: toPanel(pts) })
  const ch = (b: number, a: number) => Math.min(0.8, (b - a) / 4)
  for (const u of ups) {
    const mine = inlays.filter(il => il.host === u.id)
    const engrave: Loop[] = [...mine.map(il => eng(il.pts)), ...(inl ? [] : mine.filter(il => il.frame).map(il => eng(il.frame!)))]
    // the disc's place: engraved only where it lies on the piece (it may overhang the edge, as in the photo)
    if (medal && medal.host === u.id) {
      const ring = circlePts(medal.c, medal.r, Math.max(48, Math.ceil(2 * Math.PI * medal.r))), on = ring.map(q => inPoly(q, u.pts) && !(u.holes ?? []).some(h => inPoly(q, h)))
      if (on.every(Boolean)) engrave.push(eng(ring))
      else {
        // runs of points on the piece, starting just after a point off it so no run wraps round
        const k0 = on.indexOf(false), runs: P2[][] = []
        let cur: P2[] = []
        for (let i = 1; i <= ring.length; i++) {
          const j = (k0 + i) % ring.length
          if (on[j]) cur.push(ring[j])
          else if (cur.length) { runs.push(cur); cur = [] }
        }
        if (cur.length) runs.push(cur)
        for (const r of runs) if (r.length > 1) engrave.push({ closed: false, layer: 'engrave', pts: toPanel(r) })
      }
    }
    const pts = withTenons(u.pts, u.tenons, L, ch)
    panels.push({
      id: u.id, name: u.name, w: 1, h: 1, count: n, shape: [polyLoop(toPanel(pts), 'outer')],
      holes: (u.holes ?? []).map(h => polyLoop(toPanel(h), 'hole')), engrave, note: u.note,
    })
  }
  if (inl) for (const il of inlays) panels.push({ id: il.id, name: il.name, w: 1, h: 1, count: n, material: 'light', shape: [polyLoop(toPanel(il.pts), 'outer')], engrave: il.frame ? [eng(il.frame)] : [], note: il.note })
  if (medal) {
    const ri = medal.r - p.dr
    panels.push({ id: 'disc', name: 'القرص (غامق)', w: 2 * medal.r, h: 2 * medal.r, count: n, shape: [discLoop(medal.r, medal.r, medal.r)], engrave: [{ ...circle(medal.r, medal.r, ri), layer: 'engrave' }], note: `يُلصق على «${byId.get(medal.host)!.name}» على الدائرة المحفورة` })
    if (inl) panels.push({ id: 'disc-face', name: 'وجه القرص للشعار (فاتح)', w: 2 * ri, h: 2 * ri, count: n, material: 'light', shape: [discLoop(ri, ri, ri)], note: 'يُحفر عليه الشعار ثم يُلصق على القرص الغامق' })
  }
  // the base: every plate has the same slots at the same place; plate-local x from the left edge, y toward the front
  const slotLoops = (w: number, h: number): Loop[] => slots.map(s => {
    const [x0, x1] = sx(s), [z0, z1] = sz(s)
    return polyLoop([{ x: x0, y: z0 }, { x: x1, y: z0 }, { x: x1, y: z1 }, { x: x0, y: z1 }].map(q => ({ x: round3(q.x + w / 2), y: round3(q.y + h / 2) })), 'hole')
  })
  // a front mark: a small triangle pointing at the front edge, tip at depth zTip (from the middle), centred on x
  const mark = (w: number, h: number, x: number, zTip: number, size: number): Loop => ({ closed: true, layer: 'engrave', pts: [{ x: x - size * 0.7, y: zTip - size }, { x: x + size * 0.7, y: zTip - size }, { x, y: zTip }].map(q => ({ x: round3(q.x + w / 2), y: round3(q.y + h / 2) })) })
  const clearOfSlots = (x: number, z0: number, z1: number, hx: number) => slots.every(s => { const [a, b] = sx(s), [c0, c1] = sz(s); return z0 > c1 + 1.5 || z1 < c0 - 1.5 || x - hx > b + 1.5 || x + hx < a - 1.5 })
  // a mark hidden under whatever stands on the plate: the step (inset `cover` from the box's edge), or the front piece's shoulder
  const front = ups.filter(u => u.plane === 0)[0]
  const shoulderMark = (w: number, h: number): Loop | null => {
    const fe = front && bottomEdge(front.pts)
    if (!fe || !front.tenons.length) return null
    const zf = zOf(0), size = Math.min(3, t - 0.8)
    const ts = [...front.tenons].sort((a, b) => a[0] - b[0])
    const room = [[fe[0], ts[0][0] - fit / 2], [ts[ts.length - 1][1] + fit / 2, fe[1]]].filter(([a, b]) => b - a >= 2 * size + 2)
    if (!room.length || size < 1.2) return null
    const x = (room[0][0] + room[0][1]) / 2
    return mark(w, h, x, zf + size / 2, size)
  }
  const coveredMark = (w: number, h: number, cover: number): Loop | null => {
    // under the cover (measured from the box's outer face) and inside this plate, which may sit between the walls
    const size = 4, zTip = Math.min(D / 2 - cover, h / 2) - 1.5
    if (zTip - size < zr + 2 || !clearOfSlots(0, zTip - size, zTip, size)) return null
    return mark(w, h, 0, zTip, size)
  }
  const topMark = (w: number, h: number) => (ns ? coveredMark(w, h, si) : shoulderMark(w, h))
  const markNote: string[] = []
  panels.push({ id: 'foot', name: 'القدم (اللوح السفلي)', w: round3(W + 2 * fo), h: round3(D + 2 * fo), count: n, note: 'تُلصق تحت القاعدة فتغطّي أطراف الألسنة' })
  if (kind === 1) {
    const pw = fj ? W : round3(W - 2 * t), pd = fj ? D : round3(D - 2 * t)
    const tm = topMark(pw, pd), bm = coveredMark(pw, pd, fj ? t + 0.5 : 0.5)
    if (tm && bm) markNote.push('على غطاء الصندوق وقاعه مثلّث صغير محفور رأسه نحو الأمام (جهة لوحة الاسم)، مخفيّ تحت الدرجة وداخل الصندوق: لا تُدِر اللوحين.')
    const edges = fj ? { top: 'male' as const, right: 'male' as const, bottom: 'male' as const, left: 'male' as const } : {}
    panels.push(
      { id: 'box-top', name: 'غطاء الصندوق (بالشقوق)', w: pw, h: pd, count: n, ...edges, holes: slotLoops(pw, pd), engrave: tm ? [tm] : [], note: fj ? 'وجهه المحفور للأعلى' : 'يدخل بين الجدران في أعلاها، ووجهه المحفور للأعلى' },
      { id: 'box-bottom', name: 'قاع الصندوق (بالشقوق)', w: pw, h: pd, count: n, ...edges, holes: slotLoops(pw, pd), engrave: bm ? [bm] : [], note: fj ? 'وجهه المحفور إلى داخل الصندوق' : 'يدخل بين الجدران في أسفلها، ووجهه المحفور إلى داخل الصندوق' },
    )
    const npLoop = (): Loop[] => (plate ? [{ ...oriented(roundedRectHole(npX, round3(hb - npY - npH), npW, npH, Math.min(4, npH / 4)), 'outer'), layer: 'engrave' }] : [])
    if (fj) panels.push(
      { id: 'box-front', name: 'واجهة الصندوق', w: W, h: hb, count: n, top: 'female', bottom: 'female', left: 'male', right: 'male', engrave: npLoop(), note: plate ? 'لوحة الاسم على الخطّ المحفور' : 'الواجهة' },
      { id: 'box-back', name: 'ظهر الصندوق', w: W, h: hb, count: n, top: 'female', bottom: 'female', left: 'male', right: 'male' },
      { id: 'box-side', name: 'جانب الصندوق', w: D, h: hb, count: 2 * n, top: 'female', bottom: 'female', left: 'female', right: 'female' },
    )
    else panels.push(
      { id: 'box-front', name: 'واجهة الصندوق', w: W, h: hb, count: n, engrave: npLoop(), note: plate ? 'بعرض الصندوق كاملاً؛ لوحة الاسم على الخطّ المحفور' : 'بعرض الصندوق كاملاً' },
      { id: 'box-back', name: 'ظهر الصندوق', w: W, h: hb, count: n, note: 'بعرض الصندوق كاملاً' },
      { id: 'box-side', name: 'جانب الصندوق', w: round3(D - 2 * t), h: hb, count: 2 * n, note: 'بين الواجهة والظهر' },
    )
    if (plate) {
      const rr = Math.min(4, npH / 4)
      panels.push({ id: 'nameplate', name: 'لوحة الاسم (فاتح)', w: npW, h: npH, count: n, material: 'light', shape: [oriented(roundedRectHole(0, 0, npW, npH, rr), 'outer')], note: `${f1(npW)} × ${f1(npH)} مم: اكتب الاسم عليها بالحفر` })
    }
  } else {
    const tm = topMark(W, D), lm = coveredMark(W, D, 0.5)
    if (nl > 1 && lm && tm) panels.push({ id: 'layer', name: 'لوح القاعدة', w: W, h: D, count: (nl - 1) * n, holes: slotLoops(W, D), engrave: [lm], note: 'المثلّث المحفور نحو الأمام ووجهه للأعلى' })
    else if (nl > 1) panels.push({ id: 'layer', name: 'لوح القاعدة', w: W, h: D, count: (nl - 1) * n, holes: slotLoops(W, D), note: 'ألواح متطابقة' })
    panels.push({ id: 'layer-top', name: 'لوح القاعدة العلوي', w: W, h: D, count: n, holes: slotLoops(W, D), engrave: tm ? [tm] : [], note: 'يأتي فوق باقي الألواح' })
    if (tm) markNote.push('على ألواح القاعدة مثلّث صغير محفور رأسه نحو الأمام، يختفي تحت اللوح الذي فوقه: اجعل المثلّثات كلّها في جهة واحدة.')
  }
  for (let i = 1; i <= ns; i++) {
    const w = round3(W - 2 * si * i), d = round3(D - 2 * si * i)
    panels.push({ id: `step-${i}`, name: ns > 1 ? `الدرجة ${i}` : 'الدرجة', w, h: d, count: n, holes: slotLoops(w, d), note: i === ns ? 'تقف عليها القطع' : 'فوقها درجة أصغر' })
  }

  // ------------------------------------------------------------------ notes
  const upNames = ups.map(u => `«${u.name}»`).join(' و')
  const notes: string[] = [
    `الدرع ${H(p)} مم: القدم ${f1(t)} + ${kind === 1 ? `الصندوق ${f1(hb)}` : `${nl} ألواح ${f1(nl * t)}`}${ns ? ` + ${ns > 1 ? `${ns} درجات` : 'الدرجة'} ${f1(ns * t)}` : ''} + القطع القائمة ${f1(Hf)} مم. القاعدة ${W} × ${D} مم.`,
    ...shape.notes,
    `تحت كل قطعة قائمة لسان طوله ${f1(L)} مم ينزل من كتفها ${kind === 1 ? `عبر ${ns ? 'الدرجة و' : ''}غطاء الصندوق ثم داخل الصندوق المجوّف إلى قاعه` : `عبر ${ns ? 'الدرجة و' : ''}ألواح القاعدة كلّها`}، فتقف القطعة ثابتة بلا ملاقط. الشقوق في كل الألواح في المكان نفسه تماماً.`,
    ...(inlays.length || plate || (medal && inl) ? [inl ? `الحشوات الفاتحة (${[...inlays.map(i => `«${i.name}»`), ...(plate ? ['لوحة الاسم'] : []), ...(medal ? ['وجه القرص'] : [])].join('، ')}) تُقصّ من لوح خشب أو MDF فاتح بالسماكة نفسها أو أرقّ (2–3 مم)، وتُلصق بغراء الخشب على الخطوط المحفورة، ثم تُكبس تحت ثقل حتى تجفّ.` : 'الحشوات لن تُقصّ: خطوطها محفورة على القطع الغامقة فقط (يمكنك تلوين داخلها).'] : []),
    ...(medal ? [`القرص: ${f1(2 * medal.r)} مم غامق، عليه ${inl ? 'قرص فاتح' : 'دائرة محفورة'} ${f1(2 * (medal.r - p.dr))} مم للشعار. اكتب الشعار أو الرقم في RDWorks على طبقة الحفر داخل الدائرة.`] : []),
    kind === 1
      ? `التجميع: (1) ألصق الحشوات وانتظر أن تجفّ. (2) ركّب الصندوق ${fj ? 'بأصابعه' : 'بلا غطاء: الواجهة والظهر على جانبي القاع، والجانبان بينهما'}، ولا تضع الغطاء. (3) ${ups.length > 1 ? `ألصق ${upNames} وجهاً لوجه بحيث تكون الكتفان على خطّ واحد والألسنة متجاورة` : `أمسك ${upNames}`}. (4) أدخل الألسنة في ${ns ? 'الدرجة ثم في ' : ''}غطاء الصندوق (المثلّث المحفور للأمام) حتى تستند الكتفان. (5) أنزل ذلك كلّه في الصندوق: ${fj ? 'تدخل أصابع الغطاء في أعلى الجدران' : 'يدخل الغطاء بين الجدران'} وتدخل أطراف الألسنة في شقوق القاع؛ غراء في كل الشقوق وحول الغطاء. (6) ألصق القدم تحت الصندوق فتغطّي أطراف الألسنة، ثم ${plate ? 'لوحة الاسم على الواجهة، ثم ' : ''}${medal ? 'القرص.' : 'نظّف الغراء.'}`
      : `التجميع: (1) ألصق الحشوات. (2) ${ups.length > 1 ? `ألصق ${upNames} وجهاً لوجه والكتفان على خطّ واحد. (3) ` : '(3) '}أدخل الألسنة في ${ns ? 'الدرجة ثم ' : ''}ألواح القاعدة من الأعلى إلى الأسفل، بالغراء بين الألواح وفي الشقوق، ثم ألصق القدم تحتها${medal ? '، ثم القرص' : ''}.`,
    ...markNote,
    `الخشب: MDF بقشرة غامقة ${t} مم للقطع والقاعدة، وفاتح للحشوات.`,
  ]
  return { res: { panels, notes, warnings, errors, slotted: true }, m }
}
const H = (p: Record<string, number>) => p.H

/** The bottom edge on y = 0 of a counter-clockwise outline: [x left, x right], or null. */
function bottomEdge(pts: P2[]): [number, number] | null {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    if (Math.abs(a.y) < 1e-6 && Math.abs(b.y) < 1e-6 && b.x > a.x) return [a.x, b.x]
  }
  return null
}
/** The outline with each tenon [a, b] hanging L below its bottom edge (tips chamfered a little so they find their slots). */
function withTenons(pts: P2[], tenons: [number, number][], L: number, ch: (b: number, a: number) => number): P2[] {
  const out: P2[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    out.push(a)
    if (Math.abs(a.y) < 1e-6 && Math.abs(b.y) < 1e-6 && b.x > a.x)
      for (const [x0, x1] of [...tenons].sort((u, v) => u[0] - v[0])) if (x0 > a.x && x1 < b.x) {
        const c = ch(x1, x0)
        out.push({ x: x0, y: 0 }, { x: x0, y: -L + c }, { x: x0 + c, y: -L }, { x: x1 - c, y: -L }, { x: x1, y: -L + c }, { x: x1, y: 0 })
      }
  }
  return out
}

function template(spec: Spec): Template {
  return {
    id: spec.id, name: spec.name, desc: spec.desc, icon: spec.icon,
    params: [...BASE_PARAMS.slice(0, 3), ...spec.extra, ...BASE_PARAMS.slice(3)],
    defaults: { ...BASE_DEFAULTS, ...spec.defaults },
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build: (p, c) => buildTrophy(spec, { ...BASE_DEFAULTS, ...spec.defaults, ...p }, c).res,
  }
}

// ------------------------------------------------------------------ inlay helpers

/** The polygon shrunk about its centre just enough to keep `clear` from the host's outline all round (unchanged if it already does). */
function fitInside(pts: P2[], host: P2[], clear: number): P2[] {
  const idx = new SegIndex([host], 8), c = centroidOf(pts)
  const at = (k: number) => pts.map(q => ({ x: c.x + (q.x - c.x) * k, y: c.y + (q.y - c.y) * k }))
  const ok = (k: number) => at(k).every(q => inPoly(q, host) && idx.dist(q, clear + 1) >= clear)
  if (ok(1)) return pts
  let lo = 0.3, hi = 1
  if (!ok(lo)) return at(lo)
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m }
  return at(lo)
}

/** The polygon moved inwards by d, then cut to the half-planes given as [nx, ny, c] (keep nx·x + ny·y ≥ c). */
function insetCut(pts: P2[], d: number, cuts: [number, number, number][] = []): P2[] {
  // cut a little outside first, so the offset never meets far-away parts of the outline
  let q = pts
  for (const [nx, ny, c] of cuts) { const l = Math.hypot(nx, ny); q = clipHalf(q, nx / l, ny / l, c / l - 2 * d - 4) }
  q = offsetPoly(ccw(thin(q)), d)
  for (const [nx, ny, c] of cuts) { const l = Math.hypot(nx, ny); q = clipHalf(q, nx / l, ny / l, c / l) }
  q = thin(q, 0.2)
  // mitred corners on a sampled curve can come a hair closer than d: shrink the last bit (it never grows)
  return q.length >= 3 && areaOf(q) > 0 ? fitInside(q, pts, d + 0.02) : q
}
/** The half-plane below the line through a and b (the side away from +y): [nx, ny, c] */
const below = (a: P2, b: P2): [number, number, number] => { const nx = a.y - b.y, ny = b.x - a.x, s = ny > 0 ? -1 : 1; return [s * nx, s * ny, s * (nx * a.x + ny * a.y)] }
const above = (y: number): [number, number, number] => [0, 1, y]

// ------------------------------------------------------------------ 1. the photo: two flames (درع الشعلتين)

// Measured on the photo, in base widths: x from the middle of the base, h up from the top of the step. The free height
// in the photo is 2.45 base widths; a different height stretches the shapes upright.
const SW_H = 2.45
const SW_A: N[] = [
  [-0.335, 0, 1], [0.33, 0, 1],
  [0.27, 0.13], [0.205, 0.27], [0.15, 0.41], [0.112, 0.51], [0.082, 0.62], [0.066, 0.73], [0.062, 0.85], [0.068, 0.97], [0.082, 1.1], [0.105, 1.22], [0.14, 1.34], [0.185, 1.46], [0.245, 1.58], [0.33, 1.72], [0.43, 1.87], [0.53, 2.02], [0.62, 2.15], [0.71, 2.28],
  [0.8, 2.41, 1], [0.66, 2.45, 1],
  [0.545, 2.345], [0.43, 2.24], [0.3, 2.09], [0.2, 1.99], [0.1, 1.89], [0.02, 1.79], [-0.035, 1.7], [-0.09, 1.6], [-0.145, 1.5], [-0.193, 1.4], [-0.236, 1.3], [-0.272, 1.2], [-0.305, 1.1], [-0.33, 1.0], [-0.352, 0.9], [-0.367, 0.8], [-0.377, 0.7], [-0.382, 0.6], [-0.382, 0.5], [-0.378, 0.4], [-0.37, 0.3], [-0.358, 0.2], [-0.345, 0.1],
]
const SW_B: N[] = [
  [0.13, 0, 1], [0.365, 0, 1], [0.323, 0.094, 1],
  [0.377, 0.2], [0.435, 0.31], [0.486, 0.41], [0.53, 0.51], [0.575, 0.64], [0.615, 0.8], [0.645, 0.96], [0.665, 1.1], [0.678, 1.22], [0.682, 1.32], [0.677, 1.44], [0.662, 1.56], [0.64, 1.67], [0.615, 1.77], [0.588, 1.88], [0.556, 1.98], [0.52, 2.07], [0.47, 2.17], [0.43, 2.25], [0.41, 2.31],
  [0.39, 2.37, 1], [-0.31, 2.12, 1],
  [-0.255, 2.07], [-0.19, 2.01], [-0.125, 1.95], [-0.06, 1.89], [0.02, 1.79], [0.09, 1.68], [0.155, 1.58], [0.205, 1.5], [0.24, 1.42], [0.268, 1.34], [0.29, 1.26], [0.307, 1.18], [0.317, 1.09], [0.32, 1.0], [0.316, 0.88], [0.305, 0.76], [0.288, 0.62], [0.268, 0.48], [0.25, 0.41], [0.236, 0.36], [0.217, 0.3], [0.19, 0.2], [0.16, 0.1],
]

const swoosh: Spec = {
  id: 'trophyswoosh',
  name: 'درع الشعلتين',
  desc: 'كما في الصورة: شعلتان منحنيتان متلاصقتان، الأمامية بحشوة فاتحة في أسفلها والخلفية بقرص للشعار، فوق صندوق بلوحة اسم فاتحة ودرجة وقدم. كل قطعة بلسان طويل يمرّ عبر الدرجة والصندوق إلى قاعه، فتقف ثابتة.',
  icon: `<path d="M16 50c-2-16 2-30 18-44l6 1c-12 12-16 22-14 34l-3 9z"/><path d="M26 50c8-8 16-18 12-32-2-6-8-8-14-8l-10 4 14-2c8 2 10 10 6 20l-8 18"/><circle cx="36" cy="38" r="6" stroke-width="1.6"/><path d="M12 50h40v10H12z"/><path d="M18 53h28v5H18z" stroke-width="1.3"/>`,
  extra: [],
  defaults: {},
  ratio: [1.6, 3.6], width: p => p.W, widthLabel: 'عرض القاعدة',
  make(g) {
    const { W, Hf, rim } = g, sy = Hf / SW_H
    const A = outline(SW_A, W, sy), B = outline(SW_B, W, sy)
    // the light inlay in the front flame's foot: under a straight line sloping down to the right
    const Ain = insetCut(A, rim, [below({ x: -0.3 * W, y: 0.91 * sy }, { x: 0.05 * W, y: 0.64 * sy }), above(1.4 * rim)])
    const r = 0.3 * Math.min(W, sy)
    return {
      ups: [
        { id: 'flame-front', name: 'الشعلة الأمامية', plane: 0, pts: A, tenons: [[round3(-0.24 * W), round3(0.04 * W)]], note: 'الحشوة الفاتحة على الخطّ المحفور في أسفلها؛ تُلصق أمام الخلفية' },
        { id: 'flame-back', name: 'الشعلة الخلفية', plane: 1, pts: B, tenons: [[round3(0.17 * W), round3(0.32 * W)]], note: 'خلف الأمامية؛ القرص على الدائرة المحفورة' },
      ],
      inlays: [{ id: 'inlay-front', name: 'حشوة الشعلة الأمامية (فاتح)', host: 'flame-front', pts: Ain, note: 'تُلصق في أسفل الشعلة الأمامية' }],
      medal: { host: 'flame-back', c: { x: 0.433 * W, y: 0.833 * sy }, r },
      errors: [], notes: ['الشعلة الأمامية تُلصق على وجه الخلفية حيث تتراكبان (في الأسفل وفي الأعلى خلف الرأس)، والقرص على وجه الخلفية بجانب الأمامية لا يلمسها.'],
    }
  },
}

// ------------------------------------------------------------------ 2. one flame (درع الشعلة)

const FLAME: N[] = [
  [-0.3, 0, 1], [0.3, 0, 1],
  [0.37, 0.04], [0.43, 0.11], [0.46, 0.21], [0.46, 0.31], [0.44, 0.41], [0.43, 0.5], [0.45, 0.58],
  [0.48, 0.66, 1],
  [0.41, 0.62], [0.34, 0.585],
  [0.28, 0.58, 1],
  [0.3, 0.66], [0.29, 0.75], [0.24, 0.84], [0.17, 0.92],
  [0.08, 1.0, 1],
  [0.05, 0.93], [-0.01, 0.86], [-0.07, 0.8],
  [-0.12, 0.74, 1],
  [-0.2, 0.76], [-0.28, 0.79],
  [-0.37, 0.82, 1],
  [-0.38, 0.73], [-0.4, 0.64], [-0.44, 0.53], [-0.47, 0.41], [-0.47, 0.28], [-0.44, 0.16], [-0.38, 0.06],
]
const FLAME_IN: N[] = [
  [0.06, 0.86, 1],
  [0.11, 0.79], [0.155, 0.7], [0.175, 0.6], [0.16, 0.51], [0.1, 0.45], [0.0, 0.43], [-0.1, 0.45], [-0.165, 0.51], [-0.175, 0.6], [-0.125, 0.69], [-0.035, 0.785],
]
const flame: Spec = {
  id: 'trophyflame',
  name: 'درع الشعلة',
  desc: 'شعلة واحدة بثلاثة ألسنة، في قلبها شعلة فاتحة، وقرص للشعار في أسفلها، فوق القاعدة نفسها بلوحة الاسم.',
  icon: `<path d="M22 50c-6-8-6-18 0-26 0 6 2 8 4 8-2-10 4-20 10-26-2 8 2 14 6 18 2-4 2-6 2-8 6 8 6 22-2 34z"/><path d="M30 44c-2-6 0-12 4-16 0 6 4 8 4 12s-2 4-8 4z" stroke-width="1.4"/><path d="M12 50h40v10H12z"/>`,
  extra: [], defaults: {},
  ratio: [1.4, 3.6], width: p => p.W, widthLabel: 'عرض القاعدة',
  make(g) {
    const { W, Hf } = g, withDisc = Math.round(g.p.disc) > 0
    const F = outline(FLAME, W, Hf)
    // the inner flame from just above the disc (or lower when there is none) up to below the tip
    const lift = withDisc ? 0 : -0.12
    const inner = fitInside(outline(FLAME_IN.map(v => (v.length === 3 ? [v[0], v[1], 1] : [v[0], v[1] + lift * (0.86 - v[1]) / 0.43]) as N), W, Hf), F, g.rim + 0.3)
    const r = Math.min(0.19 * W, 0.085 * Hf)
    return {
      ups: [{ id: 'flame', name: 'الشعلة', plane: 0, pts: F, tenons: [[round3(-0.2 * W), round3(0.2 * W)]], note: 'الشعلة الفاتحة على الخطّ المحفور في وسطها' }],
      inlays: [{ id: 'inlay-flame', name: 'قلب الشعلة (فاتح)', host: 'flame', pts: inner, note: 'تُلصق في وسط الشعلة' }],
      medal: { host: 'flame', c: { x: 0, y: Math.max(r + 0.05 * Hf, 0.2 * Hf) }, r },
      errors: [], notes: [],
    }
  },
}

// ------------------------------------------------------------------ 3. a star on a curved stem (درع النجمة)

const starTrophy: Spec = {
  id: 'trophystar',
  name: 'درع النجمة',
  desc: 'نجمة خماسية بحشوة فاتحة على ساق منحنية كالشريط، وعلى الساق قرص للشعار، فوق القاعدة بلوحة الاسم.',
  icon: `<path d="M38 4l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z"/><path d="M26 50c0-12 10-14 8-26M38 50c-2-10 4-16 2-26" /><circle cx="32" cy="40" r="5" stroke-width="1.5"/><path d="M12 50h40v10H12z"/>`,
  extra: [], defaults: { H: 300, W: 100 },
  ratio: [1.5, 3.6], width: p => p.W, widthLabel: 'عرض القاعدة',
  make(g) {
    const { W, Hf, rim, minW } = g
    const Rs = Math.min(0.5 * W, 0.24 * Hf), ri = 0.5 * Rs, S = { x: 0.08 * W, y: Hf - Rs }
    const star = starPts(S, Rs, ri, 5)
    // the stem: a band round a curve from the middle of the foot up into the star's centre
    const Y = S.y - 0.15 * Rs, P0 = { x: 0, y: 0 }, P1 = { x: 0, y: 0.32 * Y }, P2 = { x: -0.42 * W, y: 0.6 * Y }, P3 = { x: S.x, y: Y }
    const bez = (u: number) => ({ x: (1 - u) ** 3 * P0.x + 3 * (1 - u) ** 2 * u * P1.x + 3 * (1 - u) * u * u * P2.x + u ** 3 * P3.x, y: (1 - u) ** 3 * P0.y + 3 * (1 - u) ** 2 * u * P1.y + 3 * (1 - u) * u * u * P2.y + u ** 3 * P3.y })
    const wb = 0.42 * W, wt = Math.max(0.2 * W, minW + 4), K = 80
    const left: P2[] = [], right: P2[] = []
    for (let k = 0; k <= K; k++) {
      const u = k / K, q = bez(u), q2 = bez(Math.min(1, u + 1e-3)), q1 = bez(Math.max(0, u - 1e-3)), l = Math.hypot(q2.x - q1.x, q2.y - q1.y)
      const nx = -(q2.y - q1.y) / l, ny = (q2.x - q1.x) / l, w = (wb + (wt - wb) * Math.sqrt(u)) / 2
      left.push({ x: q.x + nx * w, y: k === 0 ? 0 : q.y + ny * w }); right.push({ x: q.x - nx * w, y: k === 0 ? 0 : q.y - ny * w })
    }
    const stem = ccw([...right, ...left.reverse()])
    const parts = boolOp(stem, star, 'union')
    const errors: string[] = parts.length === 1 ? [] : ['النجمة لا تتّصل بالساق بهذه المقاسات: غيّر الارتفاع أو العرض.']
    const pts = ccw(thin(parts.sort((a, b) => areaOf(b) - areaOf(a))[0], 0.3))
    const um = 0.3, q = bez(um), ws = (wb + (wt - wb) * Math.sqrt(um))
    return {
      ups: [{ id: 'star', name: 'النجمة والساق', plane: 0, pts, tenons: [[round3(-0.15 * W), round3(0.15 * W)]], note: 'النجمة الفاتحة على الخطّ المحفور، والقرص على الساق' }],
      inlays: [{ id: 'inlay-star', name: 'النجمة الفاتحة', host: 'star', pts: offsetPoly(ccw(star), rim), note: 'تُلصق على النجمة' }],
      medal: { host: 'star', c: q, r: 0.62 * ws },
      errors, notes: [],
    }
  },
}

// ------------------------------------------------------------------ 4. a cup (درع الكأس)

/** The cup's right half; its foot's rim is f high (at least the strength width, see make) */
const CUP = (f: number): N[] => [
  [0.31, 0, 1], [0.31, f, 1],
  [0.24, f + 0.015], [0.16, f + 0.045], [0.11, f + 0.08], [0.085, Math.max(0.16, f + 0.12)], [0.078, Math.max(0.21, f + 0.16)], [0.1, 0.25], [0.135, 0.275], [0.1, 0.3], [0.085, 0.34], [0.11, 0.38], [0.18, 0.415], [0.27, 0.45], [0.35, 0.51], [0.405, 0.59], [0.435, 0.69], [0.448, 0.8], [0.452, 0.9],
  [0.455, 0.955, 1], [0.49, 0.965, 1], [0.49, 1.0, 1],
]
const cup: Spec = {
  id: 'trophycup',
  name: 'درع الكأس',
  desc: 'كأس بطولة بمقبضين على ساق بعقدة وقاعدة، عليه شريط فاتح للاسم أو الرقم وقرص للشعار، فوق الصندوق بلوحة الاسم.',
  icon: `<path d="M20 8h24c0 14-4 22-12 24-8-2-12-10-12-24z"/><path d="M20 12c-8 0-8 10 2 12M44 12c8 0 8 10-2 12"/><path d="M32 32v8M26 44h12l-2-4h-8z"/><path d="M21 16h22" stroke-width="3"/><path d="M12 48h40v12H12z"/>`,
  extra: [], defaults: { H: 290, W: 100 },
  ratio: [1.3, 3.2], width: p => p.W, widthLabel: 'عرض القاعدة',
  make(g) {
    const { W, Hf, rim, minW } = g
    const right = CUP(Math.max(0.03, (minW + 2) / Hf)), nodes: N[] = [...right.map(v => [v[0], v[1], ...(v.length === 3 ? [1] : [])] as N), ...[...right].reverse().map(v => [-v[0], v[1], ...(v.length === 3 ? [1] : [])] as N)]
    const body = outline(nodes, W, Hf)
    const xAt = (y: number) => Math.max(...crossX(body, y))
    // handles: an oval ring on each side, its inner part inside the bowl
    const yE = 0.76 * Hf, ry = 0.13 * Hf, wr = Math.max(minW + 1, 0.075 * W), rx = Math.max(0.19 * W, wr + 9), cxE = xAt(yE) + 0.03 * W
    const errors: string[] = []
    let pts = body
    const holes: P2[][] = []
    for (const s of [1, -1]) {
      const c = { x: s * cxE, y: yE }, ear = Array.from({ length: 90 }, (_, k) => { const a = (2 * Math.PI * k) / 90; return { x: c.x + rx * Math.cos(a), y: c.y + ry * Math.sin(a) } })
      const u = boolOp(pts, ear, 'union')
      if (u.length !== 1) { errors.push('مقبضا الكأس لا يتّصلان به بهذه المقاسات: غيّر الارتفاع أو العرض.'); break }
      pts = u[0]
      const holeIn = Array.from({ length: 72 }, (_, k) => { const a = (2 * Math.PI * k) / 72; return { x: c.x + (rx - wr) * Math.cos(a), y: c.y + (ry - wr) * Math.sin(a) } })
      const hole = boolOp(holeIn, offsetPoly(body, -1.5), 'diff').sort((a, b) => areaOf(b) - areaOf(a))[0]
      if (ry - wr < 4 || !hole || areaOf(hole) < 20) errors.push(`مقبضا الكأس بلا فتحة: اجعل الارتفاع الكلّي ${Math.ceil((H0(g) + (wr + 6) / 0.13 - Hf))} مم على الأقل.`)
      else holes.push([...ccw(thin(hole, 0.3))].reverse())
    }
    // the band for a name or number across the bowl, and the disc above it
    const y0 = 0.6 * Hf, y1 = 0.73 * Hf
    const band = insetCut(body, rim, [above(y0), [0, -1, -y1]])
    const r = Math.min(0.17 * W, 0.075 * Hf), yc = Math.min(0.955 * Hf - r - rim - 3, (y1 + 0.955 * Hf) / 2)
    return {
      ups: [{ id: 'cup', name: 'الكأس', plane: 0, pts: ccw(thin(pts, 0.3)), holes, tenons: [[round3(-0.17 * W), round3(0.17 * W)]], note: 'الشريط الفاتح والقرص على الخطوط المحفورة' }],
      inlays: [{ id: 'band', name: 'شريط الاسم (فاتح)', host: 'cup', pts: band, note: 'يُلصق عرضاً على الكأس؛ اكتب عليه الاسم أو الرقم' }],
      medal: { host: 'cup', c: { x: 0, y: yc }, r },
      errors, notes: [`شريط الكأس نحو ${f1(2 * (xAt((y0 + y1) / 2) - rim))} × ${f1(y1 - y0 - 2 * rim)} مم للاسم أو رقم المركز.`],
    }
  },
}
const H0 = (g: Geo) => g.p.H
/** Where the horizontal line y = Y crosses a closed polygon. */
function crossX(pts: P2[], Y: number): number[] {
  const xs: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    if ((a.y <= Y && b.y > Y) || (b.y <= Y && a.y > Y)) xs.push(a.x + ((b.x - a.x) * (Y - a.y)) / (b.y - a.y))
  }
  return xs.length ? xs : [0]
}

// ------------------------------------------------------------------ 5. the classic award plaque (درع تكريم)

function plaqueOutline(style: number, bw: number, Hf: number): P2[] {
  const h = bw / 2, arc = (c: P2, r: number, a0: number, a1: number, k = 48) => Array.from({ length: k + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / k; return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) } })
  if (style === 2) {
    // heraldic shield: a straight top with small shoulders, sides that curve in to a short flat foot
    const fw = 0.24 * bw, ys = 0.58 * Hf, top = Hf, sh = 0.04 * bw
    const side: N[] = [[fw, 0, 1], [0.32 * bw, 0.1 * Hf], [0.43 * bw, 0.27 * Hf], [h, ys], [h, top - sh, 1], [h - sh, top, 1]]
    const nodes: N[] = [[-fw, 0, 1], ...side, ...[...side].reverse().map(v => [-v[0], v[1], ...(v.length === 3 ? [1] : [])] as N).slice(0, -1)]
    return outline(nodes, 1, 1)
  }
  if (style === 3) {
    // mihrab: a pointed arch of two arcs (radius 0.8 bw) on straight sides
    const R = 0.8 * bw, ya = Hf - Math.sqrt(R * R - (R - h) ** 2)
    const right = arc({ x: h - R, y: ya }, R, 0, Math.acos((R - h) / R), 40), left = arc({ x: R - h, y: ya }, R, Math.PI - Math.acos((R - h) / R), Math.PI, 40)
    return ccw([{ x: -h, y: 0 }, { x: h, y: 0 }, ...right, ...left.slice(1)])
  }
  if (style === 4) {
    const c = 0.29 * bw
    return ccw([{ x: -h + c, y: 0 }, { x: h - c, y: 0 }, { x: h, y: c }, { x: h, y: Hf - c }, { x: h - c, y: Hf }, { x: -h + c, y: Hf }, { x: -h, y: Hf - c }, { x: -h, y: c }])
  }
  // round arch on straight sides
  return ccw([{ x: -h, y: 0 }, { x: h, y: 0 }, ...arc({ x: 0, y: Hf - h }, h, 0, Math.PI, 64)])
}
const plaque: Spec = {
  id: 'trophyplaque',
  name: 'درع تكريم',
  desc: 'لوح تكريم قائم بأربعة أشكال (قوس، ترس، محراب، مثمّن)، بلوح داخلي فاتح للنصّ بإطار محفور وقرص للشعار في أعلاه، فوق صندوق بلوحة اسم.',
  icon: `<path d="M18 46V18c0-12 28-12 28 0v28z"/><path d="M22 44V20c0-8 20-8 20 0v24z" stroke-width="1.4"/><circle cx="32" cy="22" r="5" stroke-width="1.4"/><path d="M26 32h12M26 37h12" stroke-width="1.2"/><path d="M12 46h40v14H12z"/>`,
  extra: [
    { ...intP('style', 'شكل اللوح', 1, 4, '1 = قوس دائري، 2 = ترس (درع فارس)، 3 = محراب مدبّب، 4 = مثمّن'), options: ['قوس', 'ترس', 'محراب', 'مثمّن'] },
    mmP('bw', 'عرض اللوح', 50, 400, 'لا يزيد على عرض القاعدة'),
  ],
  defaults: { H: 280, W: 140, D: 70, hb: 45, style: 1, bw: 125 },
  ratio: [1.1, 3.2], width: p => p.bw, widthLabel: 'عرض اللوح',
  make(g) {
    const { W, Hf, rim } = g, style = Math.min(4, Math.max(1, Math.round(g.p.style))), bw = g.p.bw
    const errors: string[] = []
    if (bw > W + 1e-6) errors.push(`اللوح أعرض من القاعدة: اجعل عرض اللوح ${W} مم على الأكثر، أو عرض القاعدة ${Math.ceil(bw)} مم على الأقل.`)
    const B = plaqueOutline(style, bw, Hf)
    const panel = insetCut(B, rim, [above(1.4 * rim)])
    const frame = offsetPoly(ccw(panel), 3)
    const fe = bottomEdge(B) ?? [-bw / 2, bw / 2], fw = fe[1] - fe[0]
    const tw = Math.min(0.62 * fw, Math.max(fw - 12, 0))
    // the disc at the top of the light panel
    const r = style === 1 ? 0.3 * bw : style === 3 ? 0.24 * bw : 0.22 * bw
    const yc = style === 1 ? Hf - bw / 2 : style === 3 ? Hf - 0.62 * bw : style === 2 ? Hf - 0.27 * bw : Hf - 0.36 * bw
    return {
      ups: [{ id: 'board', name: 'لوح التكريم', plane: 0, pts: B, tenons: [[round3(-tw / 2), round3(tw / 2)]], note: 'اللوح الفاتح على الخطّ المحفور' }],
      inlays: [{ id: 'panel', name: 'اللوح الداخلي للنصّ (فاتح)', host: 'board', pts: panel, frame: selfCrosses(frame) || areaOf(frame) <= 0 ? undefined : frame, note: 'عليه إطار محفور؛ اكتب النصّ داخله' }],
      medal: { host: 'board', c: { x: 0, y: yc }, r },
      errors, notes: [`اكتب نصّ التكريم في RDWorks على طبقة الحفر داخل الإطار المحفور على اللوح الداخلي، تحت القرص.`],
    }
  },
}

// ------------------------------------------------------------------ 6. crescent and star (درع الهلال)

const crescent: Spec = {
  id: 'trophycrescent',
  name: 'درع الهلال',
  desc: 'هلال مائل تتّصل به نجمة خماسية في حضنه، بحشوتين فاتحتين وقرص للشعار في أسفل الهلال؛ لمسابقات القرآن ورمضان.',
  icon: `<path d="M40 10a20 20 0 1 0 6 34 16 16 0 1 1-6-34z"/><path d="M44 8l2 5 5 0-4 3 2 5-5-3-4 3 1-5-4-3h5z" stroke-width="1.5"/><path d="M12 50h40v10H12z"/>`,
  extra: [], defaults: { H: 270, W: 140, D: 80 },
  ratio: [1.1, 2.4], width: p => p.W, widthLabel: 'عرض القاعدة',
  make(g) {
    const { Hf, rim, minW } = g
    // drawn with the outer circle's radius 1 round the origin; the inner circle, offset up and to the right, cuts the
    // crescent out, opening up-right; a flat foot cut low on the thick side stands on the base
    const aI = (62 * Math.PI) / 180, dI = 0.42, ri = 0.8, I = { x: dI * Math.cos(aI), y: dI * Math.sin(aI) }, yb = -0.93
    const u = (a: number) => ({ x: Math.cos(a), y: Math.sin(a) })
    // the crescent between circles of radii ro and rin: its horns' angles (seen from the origin) and its width along a radius
    const hornA = (ro: number, rin: number) => { const a = Math.acos(Math.max(-1, Math.min(1, (ro * ro + dI * dI - rin * rin) / (2 * ro * dI)))); return [aI + a, aI - a + 2 * Math.PI] }
    const widthAt = (ro: number, rin: number, a: number) => { const ui = u(a).x * I.x + u(a).y * I.y, sp = ui + Math.sqrt(Math.max(0, ui * ui - dI * dI + rin * rin)); return Math.max(0, ro - sp) }
    // where the band has narrowed to w, walking from the thick side (opposite the inner circle) towards each horn
    const narrowAt = (ro: number, rin: number, w: number) => {
      const [h1, h2] = hornA(ro, rin), thick = aI + Math.PI
      return [h1, h2].map(h => { let lo = thick, hi = h; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (widthAt(ro, rin, m) >= w) lo = m; else hi = m } return lo })
    }
    // a wedge from radius 0.3 to 1.3 between angles a0 and a1: what lies beyond a horn's cut
    const wedge = (a0: number, a1: number) => { const k = 24, pts: P2[] = []; for (let i = 0; i <= k; i++) { const a = a0 + ((a1 - a0) * i) / k; pts.push({ x: 1.3 * Math.cos(a), y: 1.3 * Math.sin(a) }) } for (let i = k; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / k; pts.push({ x: 0.3 * Math.cos(a), y: 0.3 * Math.sin(a) }) } return pts }
    const band = (ro: number, rin: number, wTip: number, floor: number) => {
      let q = boolOp(circlePts({ x: 0, y: 0 }, ro, 360), circlePts(I, rin, 320), 'diff').sort((a, b) => areaOf(b) - areaOf(a))[0] ?? []
      const [h1, h2] = hornA(ro, rin), [c1, c2] = narrowAt(ro, rin, wTip)
      for (const w of [wedge(c1, h1 + 0.3), wedge(h2 - 0.3, c2)]) q = boolOp(q, w, 'diff').sort((a, b) => areaOf(b) - areaOf(a))[0] ?? q
      return clipHalf(q, 0, 1, floor)
    }
    // the star in the crescent's lap, one point pushed into the band just past the upper horn
    const [h1] = hornA(1, ri), aHI = Math.atan2(Math.sin(h1) - I.y, Math.cos(h1) - I.x), phi = aHI + (24 * Math.PI) / 180
    // pushed in 0.6 of its radius: its two neighbouring points stay clear of the band (no pocket between them)
    const Rs = 0.25, sc0 = { x: I.x + (ri - 0.6 * Rs) * Math.cos(phi), y: I.y + (ri - 0.6 * Rs) * Math.sin(phi) }
    const starN = starPts(sc0, Rs, 0.48 * Rs, 5, phi)
    // to millimetres: the highest point at Hf, the foot at 0, the foot's middle at x = 0
    const host0 = band(1, ri, 0, yb)
    const top0 = Math.max(...host0.map(q => q.y), ...starN.map(q => q.y)), k = Hf / (top0 - yb)
    const fe0 = bottomEdge(ccw(host0).map(q => ({ x: q.x, y: Math.abs(q.y - yb) < 1e-9 ? 0 : q.y - yb })))
    const xm = fe0 ? (fe0[0] + fe0[1]) / 2 : 0
    const mm = (pts: P2[]) => pts.map(q => ({ x: round3((q.x - xm) * k), y: Math.abs(q.y - yb) < 1e-9 ? 0 : round3((q.y - yb) * k) }))
    const body = ccw(mm(band(1, ri, 2.5 / k, yb)))
    const star = ccw(mm(starN))
    const parts = boolOp(body, star, 'union'), outers = parts.filter(q => areaOf(q) > 0)
    const errors: string[] = outers.length === 1 && parts.length === 1 ? [] : ['النجمة لا تتّصل بالهلال بهذه المقاسات: غيّر الارتفاع أو العرض.']
    const pts = ccw(thin(outers.sort((a, b) => areaOf(b) - areaOf(a))[0] ?? body, 0.3))
    // the inlays: the band rim inside its edges, horns cut where it is 6 mm wide, clear of the star; the star rim inside it
    const r0 = rim / k
    const bandIn = ccw(mm(band(1 - r0, ri + r0, Math.max(6, minW / 2) / k, yb + (1.4 * rim) / k)))
    const cIn = boolOp(bandIn, offsetPoly(star, -rim - 1.5), 'diff').sort((a, b) => areaOf(b) - areaOf(a))[0] ?? []
    const sIn = offsetPoly(star, rim)
    // the disc on the thick part of the band, a little right of its middle
    const aD = aI + Math.PI - 0.3, wD = widthAt(1, ri, aD), sD = 1 - wD / 2
    const mr = Math.min(0.2, wD / 2 - (rim + 3) / k) * k
    const mc = { x: round3((sD * Math.cos(aD) - xm) * k), y: round3((sD * Math.sin(aD) - yb) * k) }
    const fe = bottomEdge(pts), half = fe ? Math.min(-fe[0], fe[1]) : 0, tw = Math.max(0, Math.min(0.5 * half, half - 8))
    return {
      ups: [{ id: 'crescent', name: 'الهلال والنجمة', plane: 0, pts, tenons: [[round3(-tw), round3(tw)]], note: 'الحشوتان الفاتحتان على الخطوط المحفورة' }],
      inlays: [
        { id: 'inlay-crescent', name: 'الهلال الفاتح', host: 'crescent', pts: cIn, note: 'تُلصق على الهلال' },
        { id: 'inlay-star', name: 'النجمة الفاتحة', host: 'crescent', pts: sIn, note: 'تُلصق على النجمة' },
      ],
      medal: mr > 6 ? { host: 'crescent', c: mc, r: round3(mr) } : undefined,
      errors, notes: [`الهلال ${f1(2 * k)} مم عرضاً تقريباً.`],
    }
  },
}

const SPECS = [swoosh, flame, starTrophy, cup, plaque, crescent]
export const TROPHIES: Template[] = SPECS.map(template)

/** The design behind a trophy template, for previews and tests: the uprights, inlays, disc and the base seen from the front. */
export function trophyModel(id: string, params: Record<string, number>, c: Common): TrophyModel | undefined {
  const spec = SPECS.find(s => s.id === id)
  if (!spec) return undefined
  return buildTrophy(spec, { ...BASE_DEFAULTS, ...spec.defaults, ...params }, c).m
}

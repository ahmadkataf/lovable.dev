// A standing plywood rose with a heart plaque (وردة بقلب على قاعدة), as in the customer's photo: one flat silhouette —
// the rose head, its leaves, the stem, the heart and a tenon under it — with the petals drawn as tapered cut-outs and
// the leaves fretted (the cells between the midrib and the veins cut away); a heart-shaped frame ring glued on the
// heart leaves a recessed panel the customer letters in RDWorks; the tenon drops into a slot through two stacked
// scalloped flower bases.
//
// Everything is built procedurally. The open head is seen from the front: six round petal lobes round a core, a
// wedge cut opening from the notch between two lobes and sweeping inward with the whorl (so the outer petals read as
// separate, overlapping lobes), inside them three rings of three, four and five cupped petals, each petal's edge a
// tapered crescent that starts tucked inside the one before, and a tight spiral at the heart. The bud is seen from the
// side: a teardrop 1.6 times as tall as wide, its outer petals' tips standing out of the outline, two wrapping petals
// drawn by bold curved cuts, a small spiral near the top and a calyx of three pointed sepals flaring out and down.
// Leaves are pointed ellipses (about 2.2 : 1) on short petioles at about 40°, their cells convex polygons clipped
// between the midrib and the veins. The heart is the photo's plump one, built of arcs so the frame ring's hole is its
// exact offset. All the parts merge with the stem and the heart by a small polygon boolean into ONE outline; a pocket
// of air they enclose (a leaf reaching down to the heart) is cut out too when it keeps its web. The wedges stop where
// the rim beside them would get thinner than the web. The petal lines start as curves (spirals, arcs, Béziers) with a width profile and are then clipped to
// the part of the silhouette that keeps at least a 2 mm web from the outline and from every earlier cut, so whatever
// the sizes no bridge is ever thinner than that and the piece always stays in one part.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Vtx, Pt, arcInfo, oriented, rotatedRectHole, round3 } from './geom'
import type { PanelSpec } from './joints'

type P2 = { x: number; y: number }
/** a point of a cut's centreline, with the cut's width there */
type CP = P2 & { w: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', hint })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
/** n of a thing in Arabic: «خلية واحدة», «خليتان», «5 خلايا», «12 خلية» */
const counted = (n: number, one: string, two: string, few: string, many: string) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`)
const rad = (deg: number) => (deg * Math.PI) / 180

/** narrowest bridge of material left between a cut and the outline or another cut */
const WEB = 2.2
/** the least area (mm²) of a pocket of air enclosed between the parts that is cut out rather than left solid */
const POCKET_MIN = 15
/** the narrowest a tapered cut gets (its thin end): still cut cleanly after kerf compensation */
const MIN_CUT = 0.6

// ------------------------------------------------------------------ polygon helpers (screen coordinates, y down; a positive area is an outer contour, as in geom.ts)

function areaOf(pts: P2[]): number {
  let a = 0
  for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p.x * q.y - q.x * p.y }
  return a / 2
}
const asOuter = (pts: P2[]): P2[] => (areaOf(pts) > 0 ? pts : [...pts].reverse())

function pointIn(q: P2, pts: P2[]): boolean {
  let c = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j]
    if ((a.y > q.y) !== (b.y > q.y) && q.x < a.x + ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y)) c = !c
  }
  return c
}
/** pointIn for one polygon asked many times: its edges filed in horizontal rows, so a ray only meets its own row */
function insideTest(pts: P2[]): (q: P2) => boolean {
  const H = 2, rows = new Map<number, [P2, P2][]>()
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j]
    for (let r = Math.floor(Math.min(a.y, b.y) / H); r <= Math.floor(Math.max(a.y, b.y) / H); r++) { const arr = rows.get(r); if (arr) arr.push([a, b]); else rows.set(r, [[a, b]]) }
  }
  return (q: P2) => {
    let c = false
    for (const [a, b] of rows.get(Math.floor(q.y / H)) ?? []) if ((a.y > q.y) !== (b.y > q.y) && q.x < a.x + ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y)) c = !c
    return c
  }
}
function segDist(q: P2, a: P2, b: P2): number {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
  const k = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0
  return Math.hypot(q.x - a.x - k * dx, q.y - a.y - k * dy)
}
/** the points of segments ab and cd closest to each other (segments that do not cross) */
function closestOn(a: P2, b: P2, c: P2, d: P2): [P2, P2] {
  const proj = (q: P2, u: P2, v: P2): P2 => {
    const dx = v.x - u.x, dy = v.y - u.y, l2 = dx * dx + dy * dy, k = l2 ? Math.max(0, Math.min(1, ((q.x - u.x) * dx + (q.y - u.y) * dy) / l2)) : 0
    return { x: u.x + k * dx, y: u.y + k * dy }
  }
  const pairs: [P2, P2][] = [[a, proj(a, c, d)], [b, proj(b, c, d)], [proj(c, a, b), c], [proj(d, a, b), d]]
  return pairs.reduce((best, pq) => (Math.hypot(pq[0].x - pq[1].x, pq[0].y - pq[1].y) < Math.hypot(best[0].x - best[1].x, best[0].y - best[1].y) ? pq : best))
}
type Box = { x0: number; y0: number; x1: number; y1: number }
const boxOf = (pts: P2[]): Box => ({ x0: Math.min(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)), x1: Math.max(...pts.map(p => p.x)), y1: Math.max(...pts.map(p => p.y)) })
const boxDist = (q: P2, b: Box) => Math.hypot(Math.max(b.x0 - q.x, 0, q.x - b.x1), Math.max(b.y0 - q.y, 0, q.y - b.y1))
const boxesTouch = (a: Box, b: Box) => !(a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0)
/** Closed polygons filed in square cells, for nearest-distance questions. */
class Shapes {
  private cells = new Map<number, { a: P2; b: P2 }[]>()
  private cell = 4
  add(pts: P2[]) {
    const n = pts.length, c = this.cell
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], seg = { a, b }
      for (let cx = Math.floor(Math.min(a.x, b.x) / c); cx <= Math.floor(Math.max(a.x, b.x) / c); cx++)
        for (let cy = Math.floor(Math.min(a.y, b.y) / c); cy <= Math.floor(Math.max(a.y, b.y) / c); cy++) {
          const k = cx * 100003 + cy, arr = this.cells.get(k)
          if (arr) arr.push(seg); else this.cells.set(k, [seg])
        }
    }
  }
  /** distance from q to the nearest edge, or `cutoff` when everything is further than that */
  dist(q: P2, cutoff: number): number {
    let best = cutoff
    const c = this.cell, r = Math.ceil(cutoff / c), x0 = Math.floor(q.x / c), y0 = Math.floor(q.y / c)
    for (let cx = x0 - r; cx <= x0 + r; cx++) for (let cy = y0 - r; cy <= y0 + r; cy++) {
      const arr = this.cells.get(cx * 100003 + cy)
      if (arr) for (const s of arr) { const d = segDist(q, s.a, s.b); if (d < best) best = d }
    }
    return best
  }
}

// ------------------------------------------------------------------ sampling curves and shapes

/** Every arc of a closed loop as chords about `step` long. */
function loopPts(l: Loop, step = 1.5): P2[] {
  const out: P2[] = [], n = l.pts.length
  for (let i = 0; i < n; i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n]
    out.push({ x: p.x, y: p.y })
    if (p.b) {
      const a = arcInfo(p, q, p.b), m = Math.max(6, Math.ceil((a.r * a.theta) / step))
      for (let k = 1; k < m; k++) { const ang = a.a0 + (a.ccw ? -1 : 1) * a.theta * (k / m); out.push({ x: a.c.x + a.r * Math.cos(ang), y: a.c.y + a.r * Math.sin(ang) }) }
    }
  }
  return out
}
const circlePts = (c: P2, r: number, step = 1.5): P2[] => {
  const n = Math.max(24, Math.ceil((2 * Math.PI * r) / step))
  return Array.from({ length: n }, (_, k) => { const a = (2 * Math.PI * k) / n + 0.37; return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) } })
}
const ellipsePts = (c: P2, rx: number, ry: number, step = 1.5): P2[] => {
  const n = Math.max(32, Math.ceil((Math.PI * (rx + ry)) / step))
  return Array.from({ length: n }, (_, k) => { const a = (2 * Math.PI * k) / n + 0.37; return { x: c.x + rx * Math.cos(a), y: c.y + ry * Math.sin(a) } })
}
/** A thick segment from a to b, w wide (a stem, a petiole, a branch). */
function barPts(a: P2, b: P2, w: number): P2[] {
  const L = Math.hypot(b.x - a.x, b.y - a.y), nx = (-(b.y - a.y) / L) * (w / 2), ny = ((b.x - a.x) / L) * (w / 2)
  return asOuter([{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }])
}
/** A pointed ellipse (a leaf, a sepal) from base to tip, `w` wide in the middle: two circular arcs. */
function lensPts(base: P2, tip: P2, w: number, step = 1.5): P2[] {
  const L = Math.hypot(tip.x - base.x, tip.y - base.y), s = w / 2, rho = (L * L) / (8 * s) + s / 2
  const ux = (tip.x - base.x) / L, uy = (tip.y - base.y) / L, nx = -uy, ny = ux
  const mx = (base.x + tip.x) / 2, my = (base.y + tip.y) / 2
  const half = Math.asin(Math.min(1, L / 2 / rho)), m = Math.max(8, Math.ceil((2 * half * rho) / step))
  const out: P2[] = []
  for (const side of [1, -1]) {
    const c = { x: mx - side * nx * (rho - s), y: my - side * ny * (rho - s) }
    const a0 = Math.atan2((side === 1 ? base : tip).y - c.y, (side === 1 ? base : tip).x - c.x), a1 = Math.atan2((side === 1 ? tip : base).y - c.y, (side === 1 ? tip : base).x - c.x)
    let d = a1 - a0
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    for (let k = 0; k < m; k++) { const ang = a0 + (d * k) / m; out.push({ x: c.x + rho * Math.cos(ang), y: c.y + rho * Math.sin(ang) }) }
  }
  return asOuter(out)
}
/** A rosebud's body in its unit frame: 1 wide at the shoulders (a little above the middle), 1.6 tall, from the
 *  broad rounded top at (0, −0.8) narrowing to the base at (0, 0.8) that the calyx holds. */
function budBody(step: number): P2[] {
  const n = Math.max(48, Math.ceil(4.4 / step)), out: P2[] = []
  for (let k = 0; k < n; k++) {
    const t = (2 * Math.PI * k) / n, c = Math.cos(t)
    const sn = Math.sin(t)
    out.push({ x: 0.5 * Math.sign(sn) * Math.abs(sn) ** 0.7 * (1 + 0.2 * c - 0.12 * c * c) / 1.01, y: -0.8 * c })
  }
  return asOuter(out)
}

const arcCurve = (c: P2, r: number, a0: number, a1: number, step = 1.5): P2[] => {
  const m = Math.max(4, Math.ceil((Math.abs(a1 - a0) * r) / step))
  return Array.from({ length: m + 1 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / m; return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) } })
}
const spiralCurve = (c: P2, r0: number, r1: number, turns: number, a0: number, step = 1): P2[] => {
  const len = Math.PI * (r0 + r1) * turns, m = Math.max(12, Math.ceil(len / step))
  return Array.from({ length: m + 1 }, (_, k) => { const u = k / m, a = a0 + 2 * Math.PI * turns * u, r = r0 + (r1 - r0) * u; return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) } })
}
const bezierCurve = (p0: P2, p1: P2, p2: P2, step = 1.5): P2[] => {
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y), m = Math.max(6, Math.ceil(len / step))
  return Array.from({ length: m + 1 }, (_, k) => { const u = k / m, v = 1 - u; return { x: v * v * p0.x + 2 * v * u * p1.x + u * u * p2.x, y: v * v * p0.y + 2 * v * u * p1.y + u * u * p2.y } })
}
/** Scale by s about the origin, rotate by `rot`, move to o. */
const place = <T extends P2>(pts: T[], s: number, rot: number, o: P2): T[] => {
  const c = Math.cos(rot), sn = Math.sin(rot)
  return pts.map(p => ({ ...p, x: o.x + s * (p.x * c - p.y * sn), y: o.y + s * (p.x * sn + p.y * c) }))
}
/** The curve with a width at every point, `wf` of the fraction of its length run. */
function widths(pts: P2[], wf: (u: number) => number): CP[] {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const L = cum[cum.length - 1] || 1
  return pts.map((p, i) => ({ x: p.x, y: p.y, w: Math.max(MIN_CUT, wf(cum[i] / L)) }))
}
/** how many turns a spiral from r0 to r1 (mm) can make and still keep its web between the turns, at most `want` */
const spiralTurns = (r0: number, r1: number, line: number, want: number) => Math.max(0.75, Math.min(want, (r1 - r0) / (WEB + 0.8 * line)))
/** width profiles: a petal edge is thin at both ends and `line` wide in the middle; a spiral grows outward; a cut
 *  opening to the outline is widest at its mouth and tapers to a point inside */
const wLens = (line: number) => (u: number) => line * (0.3 + 0.7 * Math.sin(Math.PI * u) ** 0.35)
const wGrow = (line: number) => (u: number) => line * (0.5 + 0.5 * u)
const wMouth = (line: number) => (u: number) => line * (1.8 - 1.4 * u)

// ------------------------------------------------------------------ polygon boolean

/**
 * The outline(s) of (∪ adds) \ (∪ subs), each input its own simple polygon. Every edge is split where it crosses an
 * edge of another polygon; of an added polygon the pieces lying inside another added one or inside a cut are dropped,
 * of a cut those outside every added one or inside another cut, and what remains is linked into loops: outer
 * contours come out positive, enclosed voids negative (holes). The inputs must overlap properly (a shape that merely
 * touches another along an edge is not handled), which the builders ensure.
 */
export function booleanPolys(addIn: P2[][], subIn: P2[][]): P2[][] {
  const adds = addIn.filter(p => p.length >= 3).map(asOuter), subs = subIn.filter(p => p.length >= 3).map(asOuter)
  const polys = [...adds, ...subs], nA = adds.length, boxes = polys.map(boxOf)
  interface Edge { poly: number; p: P2; q: P2; splits: { t: number; pt: P2 }[] }
  const edges: Edge[] = [], byPoly: number[][] = polys.map(() => [])
  // a cut's edges run the other way round, so along them too the material stays on the right
  polys.forEach((pl, i) => pl.forEach((p, j) => { const q = pl[(j + 1) % pl.length]; byPoly[i].push(edges.length); edges.push(i < nA ? { poly: i, p, q, splits: [] } : { poly: i, p: q, q: p, splits: [] }) }))
  const EPS = 1e-9
  for (let a = 0; a < polys.length; a++) for (let b = a + 1; b < polys.length; b++) {
    if (!boxesTouch(boxes[a], boxes[b])) continue
    for (const ia of byPoly[a]) {
      const ea = edges[ia], ax0 = Math.min(ea.p.x, ea.q.x), ax1 = Math.max(ea.p.x, ea.q.x), ay0 = Math.min(ea.p.y, ea.q.y), ay1 = Math.max(ea.p.y, ea.q.y)
      for (const ib of byPoly[b]) {
        const eb = edges[ib]
        if (Math.min(eb.p.x, eb.q.x) > ax1 || Math.max(eb.p.x, eb.q.x) < ax0 || Math.min(eb.p.y, eb.q.y) > ay1 || Math.max(eb.p.y, eb.q.y) < ay0) continue
        const d1x = ea.q.x - ea.p.x, d1y = ea.q.y - ea.p.y, d2x = eb.q.x - eb.p.x, d2y = eb.q.y - eb.p.y
        const den = d1x * d2y - d1y * d2x
        if (Math.abs(den) < 1e-12) continue
        const rx = eb.p.x - ea.p.x, ry = eb.p.y - ea.p.y
        const ta = (rx * d2y - ry * d2x) / den, tb = (rx * d1y - ry * d1x) / den
        if (ta < -EPS || ta > 1 + EPS || tb < -EPS || tb > 1 + EPS) continue
        // a crossing at a vertex uses that very vertex, so the chains link up exactly
        const pt: P2 = ta < EPS ? ea.p : ta > 1 - EPS ? ea.q : tb < EPS ? eb.p : tb > 1 - EPS ? eb.q : { x: ea.p.x + d1x * ta, y: ea.p.y + d1y * ta }
        ea.splits.push({ t: ta, pt }); eb.splits.push({ t: tb, pt })
      }
    }
  }
  interface Seg { a: P2; b: P2; poly: number; used: boolean }
  const segs: Seg[] = []
  for (const e of edges) {
    e.splits.sort((u, v) => u.t - v.t)
    let prev = e.p
    for (const s of e.splits) {
      if (s.t < EPS || s.t > 1 - EPS || s.pt === prev) continue
      if (Math.hypot(s.pt.x - prev.x, s.pt.y - prev.y) < 1e-9) continue
      segs.push({ a: prev, b: s.pt, poly: e.poly, used: false }); prev = s.pt
    }
    if (prev !== e.q && Math.hypot(e.q.x - prev.x, e.q.y - prev.y) > 1e-9) segs.push({ a: prev, b: e.q, poly: e.poly, used: false })
  }
  const tests: ((q: P2) => boolean)[] = []
  const inside = (i: number) => (tests[i] ??= polys[i].length > 24 ? insideTest(polys[i]) : (q: P2) => pointIn(q, polys[i]))
  const kept = segs.filter(s => {
    const m = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }, isCut = s.poly >= nA
    let inAdd = false
    for (let i = 0; i < polys.length; i++) {
      if (i === s.poly || boxDist(m, boxes[i]) > 0 || !inside(i)(m)) continue
      if (i >= nA || !isCut) return false
      inAdd = true
    }
    return isCut ? inAdd : true
  })
  const key = (p: P2) => `${p.x},${p.y}`
  const byStart = new Map<string, Seg[]>()
  for (const s of kept) { const k = key(s.a); const arr = byStart.get(k); if (arr) arr.push(s); else byStart.set(k, [s]) }
  const loops: P2[][] = []
  for (const first of kept) {
    if (first.used) continue
    const pts: P2[] = []
    let cur = first
    for (let guard = 0; guard <= kept.length; guard++) {
      cur.used = true
      pts.push(cur.a)
      let cands = (byStart.get(key(cur.b)) ?? []).filter(s => !s.used)
      if (!cands.length) {
        // a crossing shared by three edges can be computed twice, a hair apart: take the nearest free start
        let best: Seg | null = null, bd = 1e-6
        for (const s of kept) if (!s.used) { const d = Math.hypot(s.a.x - cur.b.x, s.a.y - cur.b.y); if (d < bd) { bd = d; best = s } }
        if (best) cands = [best]
      }
      if (!cands.length) break
      if (cands.length > 1) {
        // at a pinch point take the sharpest right turn, so loops that only touch stay separate
        const dx = cur.b.x - cur.a.x, dy = cur.b.y - cur.a.y
        cands.sort((p, q) => turnAngle(dx, dy, q) - turnAngle(dx, dy, p))
      }
      cur = cands[0]
      if (cur === first || (Math.abs(cur.a.x - first.a.x) < 1e-9 && Math.abs(cur.a.y - first.a.y) < 1e-9)) break
    }
    if (pts.length >= 3 && Math.abs(areaOf(pts)) > 0.05) loops.push(pts)
  }
  return loops
  function turnAngle(dx: number, dy: number, s: Seg) { const ex = s.b.x - s.a.x, ey = s.b.y - s.a.y; return Math.atan2(dx * ey - dy * ex, dx * ex + dy * ey) }
}
/** The outline(s) of the union of closed polygons. */
export const unionPolys = (input: P2[][]): P2[][] => booleanPolys(input, [])

/**
 * Clean a union outline before it is cut: vertices closer than 0.25 mm merge, a vertex where the path turns almost
 * straight back (a hair of a spike or a notch) goes, and a near-pinch — two edges of the loop less than 0.5 mm apart
 * with only a short chain between them — is cut across. Kerf compensation would otherwise fold such hairs into tiny
 * self-crossings, and a tooth hanging on a thread would fall off anyway.
 */
function tidyOutline(input: P2[]): P2[] {
  let pts = input.slice()
  for (let pass = 0; pass < 40; pass++) {
    let changed = false
    // 1. merge near-coincident neighbours
    const merged: P2[] = []
    for (const p of pts) { const l = merged[merged.length - 1]; if (l && Math.hypot(p.x - l.x, p.y - l.y) < 0.25) { changed = true; continue } merged.push(p) }
    if (merged.length > 1 && Math.hypot(merged[0].x - merged[merged.length - 1].x, merged[0].y - merged[merged.length - 1].y) < 0.25) { merged.pop(); changed = true }
    pts = merged
    // 2. drop vertices where the direction reverses
    const kept: P2[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length]
      const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y
      const cosang = (ux * vx + uy * vy) / ((Math.hypot(ux, uy) * Math.hypot(vx, vy)) || 1)
      if (cosang < -0.94) { changed = true; continue }
      kept.push(b)
    }
    pts = kept
    // 3. near-pinches: two edges of the loop a little way apart along it but less than 0.5 mm from each other, with a
    //    small pocket or tooth between them: a hair of a spike, a needle notch, a tooth hanging on a thread. The chain
    //    between them goes (a pocket that narrow cannot be cut, and a tooth on a thread would fall off anyway).
    //    Several cuts that do not overlap are made in one pass.
    const n = pts.length, cuts: [number, number][] = []
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n]
      const x0 = Math.min(a.x, b.x) - 0.5, x1 = Math.max(a.x, b.x) + 0.5, y0 = Math.min(a.y, b.y) - 0.5, y1 = Math.max(a.y, b.y) + 0.5
      let found = -1
      for (let j = i + 2; j <= i + 40 && j < i + n - 1; j++) {
        const c = pts[j % n], d = pts[(j + 1) % n]
        if ((c.x < x0 && d.x < x0) || (c.x > x1 && d.x > x1) || (c.y < y0 && d.y < y0) || (c.y > y1 && d.y > y1)) continue
        if (Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b)) >= 0.5) continue
        const pocket: P2[] = []
        for (let k = i + 1; k <= j; k++) pocket.push(pts[k % n])
        // negative: a pocket of air with a mouth too narrow to cut, filled; positive: a tooth on a thread, dropped
        const a2 = areaOf(pocket)
        if (a2 < 0 ? -a2 <= 60 : a2 <= 10) { found = j; break }
      }
      if (found < 0) continue
      // a cut over the loop's start is made alone
      if (found >= n) { if (!cuts.length) cuts.push([i, found]); break }
      cuts.push([i, found]); i = found
    }
    if (cuts.length) {
      // keep the loop but the chain between edges i and j, and bridge the two edges where they come closest: the
      // chain is the sliver. (Jumping straight from vertex i to vertex j + 1 would tilt a long edge: a stem meeting
      // the heart at an acute corner came out a millimetre wider at its foot.)
      // the bridge is put on the longer edge, so a long straight edge (the stem, the tenon) stays exactly where it was
      const bridge = (i: number, j: number) => {
        const a = pts[i], b = pts[(i + 1) % n], c = pts[j % n], d = pts[(j + 1) % n], [P, Q] = closestOn(a, b, c, d)
        return Math.hypot(b.x - a.x, b.y - a.y) >= Math.hypot(d.x - c.x, d.y - c.y) ? P : Q
      }
      const out: P2[] = []
      if (cuts[0][1] >= n) {
        const [i, j] = cuts[0]
        for (let k = j + 1; k <= i + n; k++) out.push(pts[k % n])
        out.push(bridge(i, j))
      } else {
        let k = 0
        for (const [i, j] of cuts) { for (; k <= i; k++) out.push(pts[k]); out.push(bridge(i, j)); k = j + 1 }
        for (; k < n; k++) out.push(pts[k])
      }
      pts = out; changed = true
    }
    if (!changed) break
  }
  return pts
}

// ------------------------------------------------------------------ cuts

/** The polygon of a tapered cut along the open centreline `cl` (each point as wide as it says, round ends). */
function cutPoly(cl: CP[]): P2[] {
  const n = cl.length, left: P2[] = [], right: P2[] = []
  const tangent = (i: number) => { const a = cl[Math.max(0, i - 1)], b = cl[Math.min(n - 1, i + 1)], L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / L, y: (b.y - a.y) / L } }
  for (let i = 0; i < n; i++) { const t = tangent(i), r = cl[i].w / 2; left.push({ x: cl[i].x - t.y * r, y: cl[i].y + t.x * r }); right.push({ x: cl[i].x + t.y * r, y: cl[i].y - t.x * r }) }
  const tEnd = tangent(n - 1), tStart = tangent(0)
  return [...left, ...endCap(cl[n - 1], tEnd, cl[n - 1].w / 2), ...right.reverse(), ...endCap(cl[0], { x: -tStart.x, y: -tStart.y }, cl[0].w / 2)]
}
/** A tapered cut as a hole. */
const slitLoop = (cl: CP[]): Loop => oriented({ closed: true, pts: cutPoly(cl) }, 'hole')
/** Four points of a semicircle round c from the left of direction t, over its head, to the right. */
function endCap(c: P2, t: P2, r: number): P2[] {
  return [1, 2, 3, 4].map(k => { const a = Math.PI / 2 - (Math.PI * k) / 5, co = Math.cos(a), s = Math.sin(a); return { x: c.x + r * (t.x * co - t.y * s), y: c.y + r * (t.x * s + t.y * co) } })
}

/** The runs of `cl` lying `inside` whose edge keeps WEB from everything in `keep`, each at least `minLen` long. */
function clipCurve(cl: CP[], inside: (p: P2) => boolean, keep: Shapes, minLen: number): CP[][] {
  const runs: CP[][] = []
  let cur: CP[] = []
  const flush = () => { if (cur.length >= 2) { let L = 0; for (let i = 1; i < cur.length; i++) L += Math.hypot(cur[i].x - cur[i - 1].x, cur[i].y - cur[i - 1].y); if (L >= minLen) runs.push(cur) } cur = [] }
  for (const p of cl) { const m = p.w / 2 + WEB; if (inside(p) && keep.dist(p, m) >= m) cur.push(p); else flush() }
  flush()
  return runs
}
/** A convex polygon clipped to where f ≥ 0 (f linear). */
function convexClip(poly: P2[], f: (p: P2) => number): P2[] {
  const out: P2[] = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q)
    if (fp >= 0) out.push(p)
    if (fp >= 0 !== fq >= 0) { const t = fp / (fp - fq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }) }
  }
  return out
}
/** A convex polygon without the vertices closer than `min` to the last one kept (what is left lies inside it). */
function dropShortEdges(poly: P2[], min: number): P2[] {
  const out: P2[] = []
  for (const p of poly) { const l = out[out.length - 1]; if (!l || Math.hypot(p.x - l.x, p.y - l.y) >= min) out.push(p) }
  while (out.length > 3 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < min) out.pop()
  return out
}
/** The narrowest a convex polygon is, across. */
function minWidth(poly: P2[]): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b.x - a.x, b.y - a.y)
    if (L < 1e-9) continue
    let far = 0
    for (const q of poly) far = Math.max(far, Math.abs((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x)) / L)
    best = Math.min(best, far)
  }
  return best
}

// ------------------------------------------------------------------ the rose head, open (seen from the front)

/** The outer petals round the core, in a unit frame (the head is about 2.3 wide and 2.1 tall); angles in screen
 *  degrees (−90 = up). Six lobes: two curled at the top, one each side, two big open ones at the bottom either side
 *  of the stem. They sit on an ellipse a little wider than tall. */
const LOBES = [
  { th: -120, rho: 0.56, r: 0.47 }, { th: -60, rho: 0.56, r: 0.47 }, { th: -2, rho: 0.57, r: 0.48 },
  { th: 58, rho: 0.55, r: 0.5 }, { th: 122, rho: 0.55, r: 0.5 }, { th: 182, rho: 0.57, r: 0.48 },
]
const CORE_R = 0.78, SQUASH = 1.06

/** A petal's edge round the centre o: from angle a0 to a1 (screen degrees, clockwise when a1 > a0) while its radius
 *  goes from r0 to r1 (unit frame scaled by k, the x stretched by SQUASH like the lobes). */
function whorlCurve(o: P2, k: number, r0: number, r1: number, a0: number, a1: number): P2[] {
  const m = Math.max(8, Math.ceil((Math.abs(a1 - a0) * Math.PI / 180) * k * Math.max(r0, r1) / 1.2))
  return Array.from({ length: m + 1 }, (_, i) => {
    const u = i / m, a = rad(a0 + (a1 - a0) * u), r = r0 + (r1 - r0) * u
    return { x: o.x + k * SQUASH * r * Math.cos(a), y: o.y + k * r * Math.sin(a) }
  })
}

/** The open rose: polygons to merge, the wedge cuts that open from the notches between the lobes (subtracted from
 *  the head before anything else joins it) and the inner petal lines (unit frame scaled by k, centred on o). */
function openRose(k: number, o: P2, line: number): { polys: P2[][]; mouths: CP[][]; curves: CP[][] } {
  const at = (rho: number, th: number): P2 => ({ x: o.x + k * SQUASH * rho * Math.cos(rad(th)), y: o.y + k * rho * Math.sin(rad(th)) })
  const lobes = LOBES.map(l => ({ c: at(l.rho, l.th), r: k * l.r }))
  const polys: P2[][] = [ellipsePts(o, k * SQUASH * CORE_R, k * CORE_R), ...lobes.map(l => circlePts(l.c, l.r))]
  const mouths: CP[][] = []
  for (let i = 0; i < lobes.length; i++) {
    // the notch between two lobes: the crossing of their circles further from the centre
    const a = lobes[i], b = lobes[(i + 1) % lobes.length]
    const d = Math.hypot(b.c.x - a.c.x, b.c.y - a.c.y), x = (a.r * a.r - b.r * b.r + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a.r * a.r - x * x))
    const mx = a.c.x + ((b.c.x - a.c.x) * x) / d, my = a.c.y + ((b.c.y - a.c.y) * x) / d, px = (-(b.c.y - a.c.y) / d) * h, py = ((b.c.x - a.c.x) / d) * h
    const cands = [{ x: mx + px, y: my + py }, { x: mx - px, y: my - py }]
    const cusp = cands.sort((p, q) => Math.hypot(q.x - o.x, q.y - o.y) - Math.hypot(p.x - o.x, p.y - o.y))[0]
    // the notch's angle and radius in the (unstretched) unit frame
    const th = Math.atan2((cusp.y - o.y) / k, (cusp.x - o.x) / (k * SQUASH)), rc = Math.hypot((cusp.x - o.x) / (k * SQUASH), (cusp.y - o.y) / k)
    // the notch under the head stays plain: the sepals and the stem cover it
    if (Math.abs(Math.atan2(Math.sin(th - Math.PI / 2), Math.cos(th - Math.PI / 2))) < rad(30)) continue
    // a wedge from outside the notch dives in and sweeps on round with the whorl (clockwise on screen) along the
    // inside of the next lobe, tapering to a point: the edge of that outer petal, tucked under the one before it
    const deg = th * 180 / Math.PI
    const pts = [...whorlCurve(o, k, rc + 0.22, rc, deg - 9, deg).slice(0, -1), ...whorlCurve(o, k, rc, rc - 0.08, deg, deg + 54)]
    mouths.push(widths(pts, wMouth(line)))
  }
  const curves: CP[][] = []
  // the rolled centre: a tight spiral out from the middle, growing wider as it unrolls
  const r0 = 0.03, r1 = 0.17
  curves.push(widths(spiralCurve(o, r0 * k, r1 * k, spiralTurns(r0 * k, r1 * k, line, 1.6), rad(-120)), wGrow(line)))
  // the inner whorl in three rings of three, four and five petals, each petal cupped round the centre and
  // overlapping the next (it starts tucked inside the one before and ends outside it)
  for (const a of [-150, -30, 90]) curves.push(widths(whorlCurve(o, k, 0.27, 0.36, a, a + 150), wLens(line)))
  for (const a of [-105, -15, 75, 165]) curves.push(widths(whorlCurve(o, k, 0.43, 0.52, a, a + 112), wLens(line)))
  for (const a of [-140, -68, 4, 76, 148]) curves.push(widths(whorlCurve(o, k, 0.59, 0.68, a, a + 88), wLens(line)))
  // the big bottom-left petal, the only outer one without a notch cut: its edge, a little inside its outline
  curves.push(widths(whorlCurve(o, k, 0.76, 0.71, 98, 150), wLens(line)))
  return { polys, mouths, curves }
}
/** where the unit frame of the open rose reaches: its width and the top above its centre */
const OPEN_FRAME = (() => {
  const xs = LOBES.flatMap(l => [SQUASH * l.rho * Math.cos(rad(l.th)) - l.r, SQUASH * l.rho * Math.cos(rad(l.th)) + l.r, SQUASH * CORE_R, -SQUASH * CORE_R])
  const ys = LOBES.flatMap(l => [l.rho * Math.sin(rad(l.th)) - l.r, l.rho * Math.sin(rad(l.th)) + l.r, CORE_R, -CORE_R])
  return { w: Math.max(...xs) - Math.min(...xs), top: -Math.min(...ys), bottom: Math.max(...ys), cx: (Math.max(...xs) + Math.min(...xs)) / 2 }
})()

/**
 * The wedges cut back to where their wood holds: each runs on from its mouth only while the wood left between it and
 * the head's outline (or another wedge) is at least WEB wide, and is tapered again to a point there. Swept on round
 * the whorl, a wedge's point otherwise reached the next notch and left the outer petal's whole rim hanging on a
 * fraction of a millimetre of wood. A wedge that never gets that much wood beside it is left out.
 */
function clearMouths(mouths: CP[][], head: P2[], line: number): CP[][] {
  const inHead = insideTest(head), polys = mouths.map(cutPoly), out: CP[][] = []
  mouths.forEach((cl, i) => {
    const idx = new Shapes()
    idx.add(head)
    polys.forEach((q, j) => { if (j !== i) idx.add(q) })
    const room = (p: CP) => inHead(p) && idx.dist(p, p.w / 2 + WEB) >= p.w / 2 + WEB
    const s = cl.findIndex(room)
    if (s < 0) return
    let e = s
    while (e + 1 < cl.length && room(cl[e + 1])) e++
    if (e === cl.length - 1) { out.push(cl); return }
    let L = 0
    for (let k = s + 1; k <= e; k++) L += Math.hypot(cl[k].x - cl[k - 1].x, cl[k].y - cl[k - 1].y)
    if (L < Math.max(3, 2 * line)) return
    out.push(widths(cl.slice(0, e + 1), wMouth(line)))
  })
  return out
}

// ------------------------------------------------------------------ the rosebud (seen from the side) and its calyx

/** the sepals of a calyx, each [angle (screen degrees), length, width] in the bud's unit frame */
const SEPALS = { full: [[134, 0.84, 0.25], [46, 0.66, 0.22], [98, 0.5, 0.2]], small: [[136, 0.62, 0.22], [44, 0.5, 0.2]] }
const CALYX = { x: 0, y: 0.6 }

/** A rosebud in its unit frame (the body 1 wide and 1.6 tall round (0, 0), point up): a teardrop with the outer
 *  petals' tips rising on the left and flaring on the right, a calyx cup and pointed sepals flaring out and down
 *  from its base. The petal edges are bold tapered cuts (each with its width profile), the rolled heart a small
 *  spiral near the tip. `k` (mm per unit) only sets how finely the curves are sampled and how many turns fit. */
function budUnit(k: number, calyx: 'full' | 'small', line: number): { polys: P2[][]; curves: { pts: P2[]; wf: (u: number) => number }[] } {
  const st = 1.5 / k, cs = 1.2 / k
  const polys: P2[][] = [
    budBody(st),
    lensPts({ x: -0.16, y: 0.3 }, { x: -0.6, y: -0.3 }, 0.34, st), // the outer petal's tip on the left
    lensPts({ x: 0.0, y: 0.1 }, { x: 0.62, y: -0.27 }, 0.3, st), // the front petal's rim curling out on the right
    circlePts({ x: 0, y: 0.64 }, 0.24, st),
  ]
  for (const [ang, len, w] of SEPALS[calyx]) polys.push(lensPts(CALYX, { x: CALYX.x + len * Math.cos(rad(ang)), y: CALYX.y + len * Math.sin(rad(ang)) }, w, st))
  const lens = wLens(line)
  const bz = (p0: P2, p1: P2, p2: P2) => ({ pts: bezierCurve(p0, p1, p2, cs), wf: lens })
  const curves = [
    // the rolled heart near the top, its outer turn the lip of the cup
    { pts: spiralCurve({ x: 0.14, y: -0.5 }, 0.03, 0.23, spiralTurns(0.03 * k, 0.23 * k, line, 1.75), rad(-20), cs), wf: wGrow(line) },
    // the outer petal wrapping up the left side to its tip
    bz({ x: -0.36, y: -0.6 }, { x: -0.3, y: 0.1 }, { x: -0.2, y: 0.7 }),
    // the front petal wrapping round the bud: its upper edge rising from the left to the shoulder, its lower edge
    // sweeping up to the curl on the right
    bz({ x: -0.22, y: 0.22 }, { x: -0.02, y: -0.2 }, { x: 0.44, y: -0.28 }),
    bz({ x: -0.2, y: 0.5 }, { x: 0.32, y: 0.44 }, { x: 0.56, y: -0.22 }),
    // the inner petal beside the heart, and the fold of the outer petal near the outline
    bz({ x: -0.18, y: -0.36 }, { x: -0.26, y: -0.56 }, { x: -0.2, y: -0.72 }),
    bz({ x: -0.41, y: -0.2 }, { x: -0.44, y: 0.15 }, { x: -0.38, y: 0.45 }),
    // the calyx's rim holding the bud
    { pts: arcCurve({ x: 0, y: 0.2 }, 0.36, rad(38), rad(142), cs), wf: lens },
  ]
  // each sepal's midrib, from its root out towards its point
  for (const [ang, len] of SEPALS[calyx]) {
    const u = { x: Math.cos(rad(ang)), y: Math.sin(rad(ang)) }
    curves.push({ pts: [0.3, 0.75].map(f => ({ x: CALYX.x + u.x * len * f, y: CALYX.y + u.y * len * f })), wf: (s: number) => line * (1.1 - 0.7 * s) })
  }
  return { polys, curves }
}
/** The bud scaled by k, turned by `rot` and centred on o. */
function bud(k: number, o: P2, rot: number, calyx: 'full' | 'small', line: number): { polys: P2[][]; curves: CP[][] } {
  const u = budUnit(k, calyx, line)
  return { polys: u.polys.map(p => place(p, k, rot, o)), curves: u.curves.map(c => widths(place(c.pts, k, rot, o), c.wf)) }
}
/** where the bud's unit frame reaches, sepals included */
const BUD_FRAME = (() => { const b = boxOf(budUnit(40, 'full', 1.8).polys.flat()); return { w: b.x1 - b.x0, top: -b.y0, bottom: b.y1, cx: (b.x0 + b.x1) / 2 } })()

// ------------------------------------------------------------------ leaves

/** web left between the leaf's cells: the border, the midrib and the veins */
const LEAF_WEB = 2.2

/** A fretted leaf on a short petiole from `root` (a point inside the stem) along direction `ang` (screen radians):
 *  a pointed ellipse whose cells between the midrib and the side veins are cut out, the tip left solid. */
function leaf(root: P2, ang: number, L: number, w: number, stemHalf: number, withCells = true): { polys: P2[][]; lens: P2[]; cells: P2[][] } {
  const u = { x: Math.cos(ang), y: Math.sin(ang) }, nrm = { x: -u.y, y: u.x }
  const base = { x: root.x + u.x * (stemHalf + 0.18 * L), y: root.y + u.y * (stemHalf + 0.18 * L) }
  const tip = { x: base.x + u.x * L, y: base.y + u.y * L }, mid = { x: (base.x + tip.x) / 2, y: (base.y + tip.y) / 2 }
  const lens = lensPts(base, tip, w)
  const polys = [barPts(root, { x: base.x + u.x * 0.1 * L, y: base.y + u.y * 0.1 * L }, Math.max(2.5, 0.1 * w)), lens]
  const cells: P2[][] = []
  const b = LEAF_WEB, s = w / 2, rho = (L * L) / (8 * s) + s / 2, s2 = s - b
  if (withCells && s2 >= 1.6) {
    // the leaf eroded by the border: the same arcs, a border's width smaller, meeting at new tips
    const hl = Math.sqrt(Math.max(0, (rho - b) ** 2 - (rho - s) ** 2))
    const inner = lensPts({ x: mid.x - u.x * hl, y: mid.y - u.y * hl }, { x: mid.x + u.x * hl, y: mid.y + u.y * hl }, 2 * s2, 1)
    const n = Math.max(2, Math.min(4, Math.round(L / 14))), alpha = rad(50)
    const along = (p: P2) => (p.x - mid.x) * u.x + (p.y - mid.y) * u.y
    for (const side of [1, -1]) {
      const across = (p: P2) => ((p.x - mid.x) * nrm.x + (p.y - mid.y) * nrm.y) * side
      // vein i leaves the midrib at sAt(i) and runs out to the edge leaning to the tip; g is the signed distance from it
      const sAt = (i: number) => -hl + (0.14 + (0.58 * i) / n) * 2 * hl
      const g = (p: P2, i: number) => (along(p) - sAt(i)) * Math.sin(alpha) - across(p) * Math.cos(alpha)
      for (let i = 0; i < n; i++) {
        let cell = convexClip(inner, p => across(p) - b / 2)
        if (i > 0) cell = convexClip(cell, p => g(p, i) - b / 2)
        cell = convexClip(cell, p => -g(p, i + 1) - b / 2)
        // a clip line passing a hair from a vertex of the eroded leaf leaves an edge a few hundredths long, which the
        // kerf offset turns inside out (a self-crossing hole): drop such vertices (the cell is convex, so it only shrinks)
        cell = dropShortEdges(cell, 0.8)
        if (cell.length >= 3 && Math.abs(areaOf(cell)) >= 4 && minWidth(cell) >= 1.6) cells.push(asOuter(cell))
      }
    }
  }
  return { polys, lens, cells }
}

// ------------------------------------------------------------------ the heart frame and the scalloped base

function arcBulge(p: Pt, q: Pt, c: Pt, m: Pt): number {
  const tau = 2 * Math.PI, norm = (a: number) => ((a % tau) + tau) % tau, ang = (v: Pt) => Math.atan2(v.y - c.y, v.x - c.x)
  const plus = norm(ang(q) - ang(p)), theta = norm(ang(m) - ang(p)) < plus ? plus : tau - plus
  const side = -(m.x - p.x) * (q.y - p.y) + (m.y - p.y) * (q.x - p.x)
  return Math.sign(side) * Math.tan(theta / 4)
}
/**
 * The heart of the photo, w wide and 0.95 w tall round (cx, cy), drawn in circular arcs so that it can be offset
 * exactly: two big overlapping lobes (radius 0.27 w) meeting in a shallow cleft, and gently rounded sides (radius
 * about 1.5 w) running on from them to a tip of about 108°. With b > 0 it is that heart eroded by b, the hole of a
 * frame b wide: every arc on the same centre and b smaller, and round the cleft a notch of radius b.
 */
const HEART = (() => {
  const R = 0.27, a = 0.23, yl = -0.475 + R, phi = rad(54)
  // the right side leaves the tip at phi from the vertical, its centre on the normal there, touching the right lobe
  const T = { x: 0, y: 0.475 }, nrm = { x: -Math.cos(phi), y: -Math.sin(phi) }, v = { x: T.x - a, y: T.y - yl }
  const Rs = (R * R - (v.x * v.x + v.y * v.y)) / (2 * (v.x * nrm.x + v.y * nrm.y + R))
  return { R, a, yl, Rs, C: { x: T.x + Rs * nrm.x, y: T.y + Rs * nrm.y }, K: { x: 0, y: yl - Math.sqrt(R * R - a * a) } }
})()
function heartLoop(cx: number, cy: number, w: number, b = 0): { loop: Loop; ok: boolean } {
  const { R, a, yl, Rs, C, K } = HEART
  const at = (x: number, y: number): Pt => ({ x: cx + w * x, y: cy + w * y })
  const toward = (o: Pt, d: Pt, len: number): Pt => { const L = Math.hypot(d.x - o.x, d.y - o.y); return { x: o.x + ((d.x - o.x) * len) / L, y: o.y + ((d.y - o.y) * len) / L } }
  const r = w * R - b, rs = w * Rs - b
  const Lr = at(a, yl), Ll = at(-a, yl), Cr = at(C.x, C.y), Cl = at(-C.x, C.y), Kp = at(K.x, K.y)
  // where each lobe runs into its side: on the line through their centres; the tip: where the sides cross the axis
  const Pr = toward(Lr, { x: 2 * Lr.x - Cr.x, y: 2 * Lr.y - Cr.y }, r), Pl = { x: 2 * cx - Pr.x, y: Pr.y }
  const T = { x: cx, y: Cr.y + Math.sqrt(Math.max(0, rs * rs - (cx - Cr.x) ** 2)) }
  const topR = { x: Lr.x, y: Lr.y - r }, topL = { x: Ll.x, y: Ll.y - r }
  const side = (P: Pt, c: Pt) => toward(c, { x: (P.x + T.x) / 2, y: (P.y + T.y) / 2 }, rs)
  const vx = (p: Pt, bb: number): Vtx => ({ x: round3(p.x), y: round3(p.y), b: bb })
  const body = (from: Pt, to: Pt): Vtx[] => [vx(from, arcBulge(from, Pr, Lr, topR)), vx(Pr, arcBulge(Pr, T, Cr, side(Pr, Cr))), vx(T, arcBulge(T, Pl, Cl, side(Pl, Cl))), vx(Pl, arcBulge(Pl, to, Ll, topL))]
  if (b <= 0) return { loop: { closed: true, pts: body(Kp, Kp) }, ok: true }
  const Jr = toward(Lr, Kp, r), Jl = { x: 2 * cx - Jr.x, y: Jr.y }
  const pts = [...body(Jr, Jl), vx(Jl, arcBulge(Jl, Jr, Kp, { x: Kp.x, y: Kp.y + b }))]
  return { loop: { closed: true, pts }, ok: r > 1 && T.y > Kp.y + b + 1 }
}
/** The heart's outline, w wide, centred on (cx, cy). */
const heartOuter = (cx: number, cy: number, w: number): Loop => oriented(heartLoop(cx, cy, w).loop, 'outer')
/** The heart of width w eroded by b: the hole of a frame b wide, and the line engraved where that frame goes. */
function innerHeart(cx: number, cy: number, w: number, b: number): { loop: Loop; ok: boolean } {
  const h = heartLoop(cx, cy, w, b)
  return { loop: oriented(h.loop, 'hole'), ok: h.ok }
}

/** A flower of k round lobes, R across, centred on (cx, cy): true arcs between the cusps. */
export function scallop(cx: number, cy: number, R: number, k: number): Loop {
  const half = Math.PI / k, rl = 1.2 * R * Math.sin(half), rho = R - rl
  const rc = rho * Math.cos(half) + Math.sqrt(rl * rl - rho * rho * Math.sin(half) ** 2)
  const pts: Vtx[] = []
  for (let i = 0; i < k; i++) {
    const th = -Math.PI / 2 + 2 * half * i, ac = th - half
    const cusp = { x: cx + rc * Math.cos(ac), y: cy + rc * Math.sin(ac) }, L = { x: cx + rho * Math.cos(th), y: cy + rho * Math.sin(th) }
    const tip = { x: cx + R * Math.cos(th), y: cy + R * Math.sin(th) }
    const next = { x: cx + rc * Math.cos(th + half), y: cy + rc * Math.sin(th + half) }
    pts.push({ x: round3(cusp.x), y: round3(cusp.y), b: arcBulge(cusp, next, L, tip) })
  }
  return oriented({ closed: true, pts }, 'outer')
}

// ------------------------------------------------------------------ the template

const PARAMS: ParamDef[] = [
  mm('H', 'الارتفاع الكلي', 120, 600, 'من رأس الوردة إلى أسفل اللسان الذي يدخل في القاعدة'),
  mm('W', 'عرض رأس الوردة', 30, 250),
  mm('hw', 'عرض القلب', 40, 300),
  { key: 'style', label: 'الوردة', min: 1, max: 2, step: 1, int: true, options: ['وردة متفتّحة', 'برعم'], hint: 'متفتّحة من الأمام مع برعم جانبي صغير، أو برعم مقفل من الجانب بكأسه' },
  { key: 'leaves', label: 'عدد الأوراق', min: 0, max: 4, step: 1, int: true, hint: 'على جانبي الساق بالتناوب' },
  mm('sw', 'عرض الساق', 5, 16),
  mm('fw', 'عرض إطار القلب', 3, 20, 'حلقة تُلصق فوق القلب فيبقى داخلها مكان النصّ غائراً'),
  { ...mm('line', 'عرض خطوط البتلات', 0.8, 3, 'الشقوق المدبّبة التي ترسم البتلات؛ عروق الأوراق وحدودها تبقى 2 مم'), step: 0.1 },
  mm('base', 'قطر القاعدة', 60, 300, 'الطبقة السفلى؛ العليا أصغر قليلاً'),
  { key: 'lobes', label: 'فصوص القاعدة', min: 5, max: 14, step: 1, int: true },
  { ...mm('fit', 'خلوص الشقّ', 0, 0.5, 'يُضاف لعرض شقّ القاعدة وطوله'), step: 0.05 },
  { key: 'n', label: 'العدد', min: 1, max: 30, step: 1, int: true },
]
const DEFAULTS = { H: 260, W: 75, hw: 90, style: 1, leaves: 2, sw: 8, fw: 5, line: 2.5, base: 120, lobes: 8, fit: 0.2, n: 1 }

/** the leaf slots down the stem, in the order they are filled: the open rose carries its side bud at the top left,
 *  so its leaves go right first, the bud's leaves alternate; `up` leaves point up and out, the others down and out */
const SLOTS: Record<number, { side: number; up: boolean }[]> = {
  1: [{ side: 1, up: true }, { side: -1, up: false }, { side: 1, up: false }, { side: -1, up: true }],
  2: [{ side: 1, up: true }, { side: -1, up: true }, { side: 1, up: false }, { side: -1, up: false }],
}

const LEAF_UP = rad(40), LEAF_DOWN = rad(40)

/** whether polygon A (its edges indexed in idxA) keeps `need` from every polygon of B (indexed in idxB): no vertex of
 *  either within `need` of the other's edges, and neither inside the other */
function clearOf(A: P2[], idxA: Shapes, B: P2[][], idxB: Shapes, need: number): boolean {
  for (const q of A) if (idxB.dist(q, need) < need) return false
  const ba = boxOf(A)
  for (const b of B) {
    for (const q of b) if (q.x > ba.x0 - need && q.x < ba.x1 + need && q.y > ba.y0 - need && q.y < ba.y1 + need && idxA.dist(q, need) < need) return false
    if (pointIn(A[0], b) || pointIn(b[0], A)) return false
  }
  return true
}
const indexOf = (polys: P2[][]) => { const s = new Shapes(); for (const p of polys) s.add(p); return s }

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = []
  const t = c.t, { W, hw, sw, fw, line, fit } = p, base = p.base
  const style = Math.round(p.style), leaves = Math.round(p.leaves), lobes = Math.round(p.lobes), n = Math.round(p.n)
  // the tenon: narrower than the stem by a shoulder each side, as long as the two base layers less a hair
  const shoulder = Math.min(1.5, 0.15 * sw), tw = round3(sw - 2 * shoulder), tenon = round3(2 * t - 0.3)
  const heartH = 0.95 * hw
  // the open rose is W wide across its lobes; the bud's body is 5/8 of that, its sepals spreading a little less than W
  const kOpen = W / OPEN_FRAME.w, kBud = W / Math.max(1.66, BUD_FRAME.w)
  const headH = style === 1 ? kOpen * (OPEN_FRAME.top + OPEN_FRAME.bottom) : kBud * (BUD_FRAME.top + CALYX.y + 0.24)
  const cx = Math.max(W, hw) / 2 + 0.35 * W
  const Ll = 0.5 * W, Lw = Ll / 2.2
  const minW = Math.ceil(28 + 16 * line)
  // the finest lines this head takes (on the 0.1 mm step): 28 + 16 × line ≤ W
  const lineFit = Math.floor((Math.floor(W) - 28) / 1.6) / 10
  if (W < minW) errors.push(`رأس الوردة صغير على خطوط بتلاته (${line} مم): اجعل عرضه ${minW} مم على الأقل${lineFit >= 0.8 ? `، أو رفّع الخطوط إلى ${lineFit} مم` : ''}.`)
  if (hw < 2 * sw + 24) errors.push(`القلب ضيّق على الساق: اجعل عرضه ${Math.ceil(2 * sw + 24)} مم على الأقل.`)
  const fwMax = Math.floor(hw / 4 - 5)
  if (fw > fwMax) errors.push(`إطار القلب عريض على هذا القلب: أقصاه ${Math.max(0, fwMax)} مم، أو كبّر القلب إلى ${Math.ceil(4 * (fw + 5))} مم.`)
  const upper = round3(base - 2 * Math.max(3, base / 30))
  if (upper < tw + 2 * fit + 2 * 8) errors.push(`القاعدة صغيرة على شقّ اللسان: اجعل قطرها ${Math.ceil(tw + 2 * fit + 16 + 2 * Math.max(3, base / 30))} مم على الأقل.`)
  if (tw < 3) errors.push('الساق رفيعة: لسانها يقلّ عن 3 مم. اجعل عرض الساق 5 مم على الأقل.')
  if (base < 0.3 * p.H) warnings.push(`القاعدة (${base} مم) صغيرة لوردة بارتفاع ${p.H} مم وقد تنقلب: الأفضل ${Math.ceil(0.4 * p.H)} مم.`)
  if (errors.length) return { panels: [], notes: [], warnings, errors }

  // ---- the head (and for the open rose its two sepals and the side bud) hang from the top whatever the height
  const head = style === 1 ? openRose(kOpen, { x: cx - kOpen * OPEN_FRAME.cx, y: kOpen * OPEN_FRAME.top }, line) : { ...bud(kBud, { x: cx, y: kBud * BUD_FRAME.top }, 0, 'full', line), mouths: [] as CP[][] }
  const headParts = head.polys.length
  if (style === 1) for (const ang of [124, 56]) head.polys.push(lensPts({ x: cx, y: headH - 0.16 * W }, { x: cx + 0.36 * W * Math.cos(rad(ang)), y: headH - 0.16 * W + 0.36 * W * Math.sin(rad(ang)) }, 0.11 * W))
  const headIdx = indexOf(head.polys)
  const side: { polys: P2[][]; curves: CP[][]; calyx: P2; kb: number } = { polys: [], curves: [], calyx: { x: 0, y: 0 }, kb: 0 }
  if (style === 1) {
    // a small bud on a thin branch to the left, as high as it goes clear of the head
    const kb = 0.3 * W, rot = rad(-28)
    let bc = { x: cx - 0.5 * W, y: headH + 0.8 * kb - 0.06 * W }, sb = bud(kb, bc, rot, 'small', line)
    const clearOfHead = (b: typeof sb) => b.polys.every(q => clearOf(q, indexOf([q]), head.polys, headIdx, 3))
    for (let step = 0; step < 60 && !clearOfHead(sb); step++) { bc = { x: bc.x, y: bc.y + 1 }; sb = bud(kb, bc, rot, 'small', line) }
    Object.assign(side, { polys: sb.polys, curves: sb.curves, calyx: place([CALYX], kb, rot, bc)[0], kb })
  }

  // ---- the arrangement for a given height: the heart above the tenon, the leaves in the zone between it and the
  //      head, each checked for room; the error for a short rose then says which height fits
  type Leaf = ReturnType<typeof leaf>
  interface Plan { ok: boolean; why: string[]; heartCy: number; branch: P2[][]; leaves: Leaf[] }
  const arrange = (H: number): Plan => {
    const heartTipY = H - tenon - 0.12 * H, heartTop = heartTipY - heartH, heartCy = heartTipY - 0.475 * hw
    const zone = heartTop - headH, zoneTop = headH
    const why: string[] = []
    if (zone < 12) why.push('zone')
    const branch: P2[][] = []
    if (style === 1) branch.push(barPts({ x: cx, y: Math.min(side.calyx.y + 0.5 * side.kb, heartTop - 3) }, side.calyx, Math.max(2.5, 0.4 * sw)))
    const blockers = [...head.polys, ...side.polys, ...branch, loopPts(innerHeart(cx, heartCy, hw, fw).loop, 1.5)]
    const idx = indexOf(blockers)
    const planned: Leaf[] = []
    const clear = (lf: Leaf) => clearOf(lf.lens, indexOf([lf.lens]), blockers, idx, 2.5)
    // a leaf pointing up slides down from the head until it is clear of it (and of the side bud and the leaves
    // before it); one pointing down slides up from the heart's frame line; its root stays on the stem in the zone
    const settle = (ang: number, y0: number, dir: number) => {
      if (zone < 12) return null
      for (let y = y0; y >= zoneTop && y <= heartTop - 4; y += 2 * dir) { const lf = leaf({ x: cx, y }, ang, Ll, Lw, sw / 2, false); if (clear(lf)) return leaf({ x: cx, y }, ang, Ll, Lw, sw / 2) }
      return null
    }
    SLOTS[style].slice(0, leaves).forEach((slot, j) => {
      const ang = slot.up ? (slot.side === 1 ? -LEAF_UP : Math.PI + LEAF_UP) : slot.side === 1 ? LEAF_DOWN : Math.PI - LEAF_DOWN
      const below = planned.filter((_, i) => SLOTS[style][i].up).map(o => o.polys[0][0].y)
      const lf = slot.up ? settle(ang, Math.max(zoneTop, ...below.map(y => y + 4)), 1) : settle(ang, heartTop - 4, -1)
      if (lf) { planned.push(lf); blockers.push(lf.lens); idx.add(lf.lens) } else why.push(`leaf ${j}`)
    })
    return { ok: !why.length, why, heartCy, branch, leaves: planned }
  }
  const plan = arrange(p.H)
  TRACE.why = plan.why
  if (!plan.ok) {
    // the least height (in 5 mm steps, up to the largest allowed) at which everything fits
    const HMAX = 600
    if (arrange(HMAX).ok) {
      let lo = p.H, hi = HMAX
      while (hi - lo > 5) {
        const mid = Math.min(hi - 5, Math.max(Math.ceil((lo + 1) / 5) * 5, Math.round((lo + hi) / 10) * 5))
        if (mid <= lo) break
        if (arrange(mid).ok) hi = mid; else lo = mid
      }
      errors.push(`لا مكان ${leaves ? 'للأوراق ' : ''}بين الوردة والقلب: زد الارتفاع الكلي إلى ${hi} مم، أو صغّر رأس الوردة أو القلب.`)
    } else errors.push(`الوردة والأوراق كبيرة على هذا الارتفاع: صغّر رأس الوردة إلى ${Math.floor(0.7 * W)} مم أو قلّل الأوراق.`)
  }
  if (errors.length) return { panels: [], notes: [], warnings, errors }
  const H = p.H, { heartCy } = plan

  // ---- the silhouette, in panel coordinates: the stem on x = cx, the head's top on y = 0
  const polys: P2[][] = [], curves: CP[][] = [...head.curves, ...side.curves]
  // the head first: its lobes merged, then the wedges opening from the notches taken out of it
  const headOnly = unionPolys(head.polys.slice(0, headParts)).filter(l => areaOf(l) > 0)
  const mouths = headOnly.length === 1 ? clearMouths(head.mouths, headOnly[0], line) : head.mouths
  const headCut = headOnly.length === 1 && mouths.length ? booleanPolys(headOnly, mouths.map(cutPoly)).filter(l => areaOf(l) > 0).sort((a, b) => areaOf(b) - areaOf(a)) : headOnly
  if (headCut.length !== 1) errors.push('رأس الوردة لا يخرج قطعة واحدة بهذه المقاسات: غيّر عرض الوردة أو خطوطها قليلاً.')
  polys.push(...headCut, ...head.polys.slice(headParts), ...side.polys, ...plan.branch)
  for (const lf of plan.leaves) polys.push(...lf.polys)
  // the stem from inside the head down to the shoulder, the tenon overlapping its end, the heart
  const headCy = style === 1 ? kOpen * OPEN_FRAME.top : kBud * BUD_FRAME.top
  polys.push(asOuter([{ x: cx - sw / 2, y: headCy }, { x: cx + sw / 2, y: headCy }, { x: cx + sw / 2, y: H - tenon }, { x: cx - sw / 2, y: H - tenon }]))
  polys.push(asOuter([{ x: cx - tw / 2, y: H - tenon - 1 }, { x: cx + tw / 2, y: H - tenon - 1 }, { x: cx + tw / 2, y: H }, { x: cx - tw / 2, y: H }]))
  polys.push(loopPts(heartOuter(cx, heartCy, hw), 1.2))
  // the outer boundary is cut, and so is a pocket of air the parts enclose between them (a leaf reaching down to the
  // heart beside the stem) when it keeps its web all round; a smaller or narrower one stays solid wood
  const merged = errors.length ? [] : unionPolys(polys), outers = merged.filter(l => areaOf(l) > 0)
  TRACE.polys = polys; TRACE.outers = outers
  if (!errors.length && outers.length !== 1) errors.push('أجزاء الوردة لا تلتقي في قطعة واحدة بهذه المقاسات: غيّر الارتفاع أو عرض الوردة قليلاً.')
  const outer = outers.length === 1 ? tidyOutline(outers[0]) : []
  if (errors.length) return { panels: [], notes: [], warnings, errors }
  // the holes: the leaves' cells first (each must still keep its web from the outline and from the cells before it,
  // in case parts have merged), then every petal curve clipped to where it keeps a web from the outline and from
  // the cuts before it
  const keep = new Shapes(), inOuter = insideTest(outer)
  keep.add(outer)
  const holes: Loop[] = [], airTests: ((q: P2) => boolean)[] = []
  /** in the wood: inside the outline and in none of the pockets cut */
  const inWood = (q: P2) => inOuter(q) && !airTests.some(f => f(q))
  const fits = (pts: P2[]) => {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], m = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.2))
      for (let k = 0; k < m; k++) { const q = { x: a.x + ((b.x - a.x) * k) / m, y: a.y + ((b.y - a.y) * k) / m }; if (!inWood(q) || keep.dist(q, WEB) < WEB - 0.15) return false }
    }
    return true
  }
  let pocketCount = 0
  for (const pk of merged.filter(l => areaOf(l) < -POCKET_MIN)) {
    // the air as a loop of its own (a needle of it too narrow to cut filled, a hair of wood in it dropped), then cut
    // only if every point of it keeps the web from the outline and the pockets before it
    const air = tidyOutline([...pk].reverse())
    if (air.length < 3 || areaOf(air) < POCKET_MIN || !fits(air)) continue
    holes.push(oriented({ closed: true, pts: air }, 'hole')); keep.add(air); airTests.push(insideTest(air)); pocketCount++
  }
  let cellCount = 0
  for (const lf of plan.leaves) for (const cell of lf.cells) if (fits(cell)) { holes.push(oriented({ closed: true, pts: cell }, 'hole')); keep.add(cell); cellCount++ }
  let slitCount = 0, headSlits = 0
  curves.forEach((cv, i) => {
    for (const run of clipCurve(cv, inWood, keep, Math.max(4, 3 * line))) {
      const s = slitLoop(run)
      holes.push(s); keep.add(s.pts.map(q => ({ x: q.x, y: q.y }))); slitCount++
      if (i < head.curves.length) headSlits++
    }
  })
  Object.assign(TRACE, { mouths, counts: { head: headSlits + mouths.length, mouths: mouths.length, side: slitCount - headSlits, cells: cellCount, pockets: pocketCount } })
  if (slitCount + mouths.length < 4) errors.push(`رأس الوردة صغير على خطوط بتلاته: كبّر عرضه إلى ${Math.ceil(W * 1.4)} مم أو رفّع الخطوط.`)
  if (errors.length) return { panels: [], notes: [], warnings, errors }
  const shape: Loop[] = [{ closed: true, pts: outer.map(q => ({ x: round3(q.x), y: round3(q.y) })) }]
  const inner = innerHeart(cx, heartCy, hw, fw)
  const bb = boxOf(outer)
  const panels: PanelSpec[] = [
    {
      id: 'rose', name: 'الوردة مع القلب', w: round3(bb.x1 - bb.x0), h: round3(bb.y1 - bb.y0), count: n, shape,
      holes: holes.map(s => ({ closed: true, pts: s.pts.map(q => ({ x: round3(q.x), y: round3(q.y) })) })),
      engrave: [{ ...inner.loop, layer: 'engrave' }],
      note: 'قطعة واحدة: الوردة والأوراق والساق والقلب واللسان؛ الخط الأزرق على القلب موضع الإطار',
    },
    {
      id: 'frame', name: 'إطار القلب', w: hw, h: round3(heartH), count: n,
      shape: [heartOuter(hw / 2, 0.475 * hw, hw)], holes: [innerHeart(hw / 2, 0.475 * hw, hw, fw).loop],
      note: `حلقة بعرض ${fw} مم تُلصق فوق قلب الوردة`,
    },
    {
      id: 'base-low', name: 'القاعدة — الطبقة السفلى', w: base, h: base, count: n,
      shape: [scallop(base / 2, base / 2, base / 2, lobes)], holes: [rotatedRectHole(base / 2, base / 2, round3(tw + fit), round3(t + fit), 0)],
      note: 'زهرة مفصّصة بشقّ في وسطها',
    },
    {
      id: 'base-up', name: 'القاعدة — الطبقة العليا', w: upper, h: upper, count: n,
      shape: [scallop(upper / 2, upper / 2, upper / 2, lobes)], holes: [rotatedRectHole(upper / 2, upper / 2, round3(tw + fit), round3(t + fit), 0)],
      note: 'أصغر من السفلى قليلاً وتُلصق فوقها',
    },
  ]
  const stands = round3(H - tenon)
  const notes = [
    `الوردة ${style === 1 ? 'متفتّحة' : 'برعم'} بعرض ${W} مم على ساق ${sw} مم تمرّ في قلب عرضه ${hw} مم؛ ترتفع ${f1(stands)} مم فوق القاعدة (${base} مم). البتلات شقوق مدبّبة حتى ${line} مم${style === 1 ? ' تنفتح من بين الفصوص الخارجية إلى الحافّة' : ''}، والأوراق مفرّغة بين عرقها الأوسط وعروقها الجانبية${cellCount ? ` (${counted(cellCount, 'خلية واحدة', 'خليتان', 'خلايا', 'خلية')})` : ''}؛ بين كل شقّ وجاره أو الحافّة ${WEB} مم خشب على الأقل فلا تنفصل القطعة.`,
    `القلب فارغ: اكتب نصّك في RDWorks داخل الإطار المحفور (الخط الأزرق) على قطعة الوردة؛ الإطار نفسه حلقة ${fw} مم تُلصق فوق القلب على ذلك الخط فيبقى النصّ غائراً داخله كما في الصورة.`,
    `القاعدة طبقتان مفصّصتان (${base} و${upper} مم، ${counted(lobes, 'فصّ واحد', 'فصّان', 'فصوص', 'فصّاً')}) تُلصقان فوق بعضهما وشقّاهما متطابقان؛ لسان الساق ${tw} × ${t} مم ينزل فيهما حتى ${f1(tenon)} مم (طول الطبقتين إلا قليلاً فلا يبرز من تحت) ويستند كتفا الساق على الطبقة العليا. نقطة غراء في الشقّ تكفي.`,
    'خشب أو MDF 3 مم هو الأنسب؛ اقصّ الشقوق والخلايا قبل الحدود الخارجية (رتّب الطبقات في RDWorks: الأحمر الداخلي أولاً) حتى لا تتحرّك القطعة.',
  ]
  if (leaves === 0) notes.push('بلا أوراق: الساق عارية بين الوردة والقلب.')
  return { panels, notes, warnings, errors, slotted: true }
}

export const ROSE_SIGNS: Template[] = [
  {
    id: 'rosesign',
    name: 'وردة بقلب على قاعدة',
    desc: 'وردة خشبية واقفة كما في الصورة: رأس وردة متفتّحة (أو برعم) ببتلات مرسومة بشقوق مدبّبة، وأوراق مفرّغة بين عروقها، وساق تمرّ في قلب عليه إطار بارز يُلصق فوقه، تقف في قاعدة زهرة مفصّصة بطبقتين. القلب فارغ لتكتب فيه نصّك.',
    icon: `<circle cx="32" cy="14" r="9"/><path d="M28 14a4 4 0 0 1 6-3M31 11a2 2 0 0 1 3 1" stroke-width="1.2"/><path d="M32 23v36" stroke-width="3"/><path d="M32 30l-9-5M32 34l9-5" stroke-width="2"/><path d="M32 50 22 40a6 6 0 0 1 10-6 6 6 0 0 1 10 6z"/><path d="M14 58c0-3 4-4 6-2 2-3 6-3 8 0 2-3 6-3 8 0 2-2 6-1 6 2 3 1 3 5 0 6H14c-3-1-3-5 0-6z" stroke-width="1.3"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build,
  },
]

/** what the last build merged, for tests */
const TRACE: { polys: P2[][]; outers: P2[][]; why: string[]; mouths: CP[][]; counts: { head: number; mouths: number; side: number; cells: number; pockets: number } } = {
  polys: [], outers: [], why: [], mouths: [], counts: { head: 0, mouths: 0, side: 0, cells: 0, pockets: 0 },
}
/** for tests and previews */
export const ROSE_DEBUG = { unionPolys, booleanPolys, scallop, innerHeart, heartOuter, HEART, slitLoop, cutPoly, lensPts, budBody, tidyOutline, leaf, openRose, bud, budUnit, clearMouths, dropShortEdges, WEB, LEAF_WEB, MIN_CUT, TRACE }

// A standing plywood rose with a heart plaque (وردة بقلب على قاعدة), as in the customer's photo: one flat silhouette —
// the rose head, its leaves, the stem, the heart and a tenon under it — with the petals and leaf veins drawn as thin
// cut slits; a heart-shaped frame ring glued on the heart leaves a recessed panel the customer letters in RDWorks;
// the tenon drops into a slot through two stacked scalloped flower bases.
//
// Everything is built procedurally: the head is a union of round petal lobes (or an egg-shaped bud with sepals), the
// leaves pointed ellipses on short petioles, all merged with the stem and the heart by a small polygon union into ONE
// outline. The petal lines and veins start as curves (spirals, arcs, Béziers) and are then clipped to the part of the
// silhouette that keeps at least a 2 mm web from the outline and from every earlier slit, so whatever the sizes no
// bridge is ever thinner than that and the piece always stays in one part.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Vtx, Pt, arcInfo, heart, oriented, rotatedRectHole, round3 } from './geom'
import type { PanelSpec } from './joints'

type P2 = { x: number; y: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', hint })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const rad = (deg: number) => (deg * Math.PI) / 180

/** narrowest bridge of material left between a slit and the outline or another slit */
const WEB = 2.2

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
function segDist(q: P2, a: P2, b: P2): number {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
  const k = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0
  return Math.hypot(q.x - a.x - k * dx, q.y - a.y - k * dy)
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
  /** distance from q to the nearest edge, or `cutoff` when everything is further than that (cutoff at most a cell) */
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
/** An egg standing on its point (a rosebud): `w` wide at the shoulders, `h` tall, centred on c, tilted by `rot`. */
function eggPts(c: P2, w: number, h: number, rot = 0, step = 1.5): P2[] {
  const n = Math.max(40, Math.ceil(((w + h) * 1.6) / step)), out: P2[] = []
  for (let k = 0; k < n; k++) {
    const t = (2 * Math.PI * k) / n, ca = Math.cos(t)
    // wide shoulders a little above the middle, the narrow end below: the width is scaled by where we are on the egg
    const x = 0.5 * w * Math.sin(t) * (0.95 + 0.3 * ca) * (1 - 0.1 * ca * ca), y = -0.5 * h * ca + 0.08 * h * ca * ca
    out.push({ x: c.x + x * Math.cos(rot) - y * Math.sin(rot), y: c.y + x * Math.sin(rot) + y * Math.cos(rot) })
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
const place = (pts: P2[], s: number, rot: number, o: P2): P2[] => {
  const c = Math.cos(rot), sn = Math.sin(rot)
  return pts.map(p => ({ x: o.x + s * (p.x * c - p.y * sn), y: o.y + s * (p.x * sn + p.y * c) }))
}

// ------------------------------------------------------------------ union of polygons

/**
 * The outline(s) of the union of closed polygons, each its own simple polygon. Every edge is split where it crosses an
 * edge of another polygon, the pieces lying inside any other polygon are dropped, and what remains is linked into
 * loops: outer contours keep their positive orientation, enclosed voids come out negative (holes). The inputs must
 * overlap properly (a shape that merely touches another along an edge is not handled), which the builders ensure.
 */
export function unionPolys(input: P2[][]): P2[][] {
  const polys = input.filter(p => p.length >= 3).map(asOuter), boxes = polys.map(boxOf)
  interface Edge { poly: number; p: P2; q: P2; splits: { t: number; pt: P2 }[] }
  const edges: Edge[] = [], byPoly: number[][] = polys.map(() => [])
  polys.forEach((pl, i) => pl.forEach((p, j) => { byPoly[i].push(edges.length); edges.push({ poly: i, p, q: pl[(j + 1) % pl.length], splits: [] }) }))
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
  const kept = segs.filter(s => {
    const m = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }
    for (let i = 0; i < polys.length; i++) if (i !== s.poly && boxDist(m, boxes[i]) === 0 && pointIn(m, polys[i])) return false
    return true
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

/**
 * Clean a union outline before it is cut: vertices closer than 0.25 mm merge, a vertex where the path turns almost
 * straight back (a hair of a spike or a notch) goes, and a near-pinch — two edges of the loop less than 0.5 mm apart
 * with only a short chain between them — is cut across. Kerf compensation would otherwise fold such hairs into tiny
 * self-crossings, and a tooth hanging on a thread would fall off anyway.
 */
function tidyOutline(input: P2[]): P2[] {
  let pts = input.slice()
  for (let pass = 0; pass < 6; pass++) {
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
    const n = pts.length
    let cut: [number, number] | null = null
    for (let i = 0; i < n && !cut; i++) {
      for (let j = i + 2; j <= i + 40 && j < i + n - 1; j++) {
        const a = pts[i], b = pts[(i + 1) % n], c = pts[j % n], d = pts[(j + 1) % n]
        if (Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b)) >= 0.5) continue
        const pocket: P2[] = []
        for (let k = i + 1; k <= j; k++) pocket.push(pts[k % n])
        // negative: a pocket of air with a mouth too narrow to cut, filled; positive: a tooth on a thread, dropped
        const a2 = areaOf(pocket)
        if (a2 < 0 ? -a2 <= 60 : a2 <= 10) { cut = [i, j]; break }
      }
    }
    if (cut) {
      // keep the loop from vertex j + 1 round to vertex i: the chain between them is the sliver
      const [i, j] = cut, out: P2[] = []
      for (let k = j + 1; k <= i + n; k++) out.push(pts[k % n])
      pts = out; changed = true
    }
    if (!changed) break
  }
  return pts
}

// ------------------------------------------------------------------ slits

/** A slit `w` wide along the open curve `cl` (round ends), as a hole. */
function slitLoop(cl: P2[], w: number): Loop {
  const n = cl.length, r = w / 2, left: P2[] = [], right: P2[] = []
  const tangent = (i: number) => { const a = cl[Math.max(0, i - 1)], b = cl[Math.min(n - 1, i + 1)], L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / L, y: (b.y - a.y) / L } }
  for (let i = 0; i < n; i++) { const t = tangent(i); left.push({ x: cl[i].x - t.y * r, y: cl[i].y + t.x * r }); right.push({ x: cl[i].x + t.y * r, y: cl[i].y - t.x * r }) }
  const tEnd = tangent(n - 1), tStart = tangent(0)
  const pts: Vtx[] = [...left, ...endCap(cl[n - 1], tEnd, r), ...right.reverse(), ...endCap(cl[0], { x: -tStart.x, y: -tStart.y }, r)]
  return oriented({ closed: true, pts }, 'hole')
}
/** Four points of a semicircle round c from the left of direction t, over its head, to the right. */
function endCap(c: P2, t: P2, r: number): P2[] {
  return [1, 2, 3, 4].map(k => { const a = Math.PI / 2 - (Math.PI * k) / 5, co = Math.cos(a), s = Math.sin(a); return { x: c.x + r * (t.x * co - t.y * s), y: c.y + r * (t.x * s + t.y * co) } })
}

/** The runs of `cl` lying `inside` that keep `margin` from everything in `keep`, each at least `minLen` long. */
function clipCurve(cl: P2[], inside: (p: P2) => boolean, keep: Shapes, margin: number, minLen: number): P2[][] {
  const runs: P2[][] = []
  let cur: P2[] = []
  const flush = () => { if (cur.length >= 2) { let L = 0; for (let i = 1; i < cur.length; i++) L += Math.hypot(cur[i].x - cur[i - 1].x, cur[i].y - cur[i - 1].y); if (L >= minLen) runs.push(cur) } cur = [] }
  for (const p of cl) { if (inside(p) && keep.dist(p, margin) >= margin) cur.push(p); else flush() }
  flush()
  return runs
}

// ------------------------------------------------------------------ the rose head, open (seen from the front)

/** Petal lobes round the centre, in a unit frame (the head is about 2 wide); angles in screen degrees (−90 = up).
 *  The lower petals are the big open ones, the upper ones smaller and still curled. */
const LOBES = [
  { th: -100, rho: 0.58, r: 0.4 }, { th: -48, rho: 0.62, r: 0.38 }, { th: 2, rho: 0.6, r: 0.42 }, { th: 52, rho: 0.56, r: 0.48 },
  { th: 104, rho: 0.52, r: 0.5 }, { th: 158, rho: 0.58, r: 0.44 }, { th: 212, rho: 0.6, r: 0.38 },
]
const CORE_R = 0.72

/** The open rose: polygons to merge and the petal lines (unit frame scaled by k, centred on o). */
function openRose(k: number, o: P2): { polys: P2[][]; curves: P2[][] } {
  const at = (rho: number, th: number): P2 => ({ x: o.x + k * rho * Math.cos(rad(th)), y: o.y + k * rho * Math.sin(rad(th)) })
  const polys: P2[][] = [circlePts(o, k * CORE_R), ...LOBES.map(l => circlePts(at(l.rho, l.th), k * l.r))]
  const curves: P2[][] = []
  // the rolled centre: a spiral out from the middle
  curves.push(spiralCurve(o, 0.08 * k, 0.3 * k, 1.6, rad(-70)))
  // petals unfolding round it: each a C-shaped edge a golden angle on from the one before, a little bigger and
  // further out, so they overlap like a real rose's; the clipping trims them where they would meet
  for (let i = 0; i < 7; i++) {
    const a = -40 + i * 137.5, e = 0.05 + 0.045 * i, rho = 0.34 + 0.082 * i
    curves.push(arcCurve(at(e, a), k * rho, rad(a - 62 - 2 * i), rad(a + 62 + 2 * i)))
  }
  // the outer lobes: a line following each edge a little inside, the edge of the petal under it
  for (const l of LOBES) curves.push(arcCurve(at(l.rho, l.th), k * (l.r - 0.16), rad(l.th - 58), rad(l.th + 58)))
  return { polys, curves }
}
/** where the unit frame of the open rose reaches: its width and the top above its centre */
const OPEN_FRAME = (() => {
  const xs = LOBES.flatMap(l => [l.rho * Math.cos(rad(l.th)) - l.r, l.rho * Math.cos(rad(l.th)) + l.r, CORE_R, -CORE_R])
  const ys = LOBES.flatMap(l => [l.rho * Math.sin(rad(l.th)) - l.r, l.rho * Math.sin(rad(l.th)) + l.r, CORE_R, -CORE_R])
  return { w: Math.max(...xs) - Math.min(...xs), top: -Math.min(...ys), bottom: Math.max(...ys), cx: (Math.max(...xs) + Math.min(...xs)) / 2 }
})()

// ------------------------------------------------------------------ the rosebud (seen from the side) and its calyx

/** A bud 1 wide and about 1.3 tall in its unit frame, point down at (0, 0.65): an egg body with two petals wrapped
 *  round it that meet in a notch at the tip; the petal edges as curves. */
function bud(k: number, o: P2, rot: number, calyx: 'full' | 'small' | 'none'): { polys: P2[][]; curves: P2[][] } {
  const P = (pts: P2[]) => place(pts, k, rot, o), st = 1.5 / k, cs = 1.5 / k, ss = 1 / k
  const polys: P2[][] = [
    eggPts({ x: 0, y: 0 }, 1, 1.3, 0, st),
    lensPts({ x: 0.1, y: 0.45 }, { x: -0.2, y: -0.64 }, 0.56, st), // the left petal, its tip leaning left
    lensPts({ x: -0.08, y: 0.45 }, { x: 0.27, y: -0.6 }, 0.56, st), // the right petal
  ]
  if (calyx !== 'none') {
    // a cup under the bud and three pointed sepals, two drooping to one side, one to the other; the side bud's are
    // shorter and spread sideways so they stay clear of the leaves below
    polys.push(circlePts({ x: 0, y: 0.5 }, 0.24, st))
    const sepals = calyx === 'full' ? [[125, 0.6], [150, 0.5], [52, 0.4]] : [[135, 0.36], [160, 0.3], [40, 0.24]]
    for (const [ang, len] of sepals) polys.push(lensPts({ x: 0, y: 0.48 }, { x: len * Math.cos(rad(ang)), y: 0.48 + len * Math.sin(rad(ang)) }, 0.16, st))
  }
  const curves: P2[][] = [
    // the big petal wrapping from the lower left up round the right shoulder
    bezierCurve({ x: -0.3, y: 0.4 }, { x: 0.1, y: -0.05 }, { x: 0.34, y: -0.4 }, cs),
    // the left petal's edge, up to its tip
    bezierCurve({ x: -0.4, y: 0.1 }, { x: -0.34, y: -0.32 }, { x: -0.16, y: -0.58 }, cs),
    // a second wrap on the right
    bezierCurve({ x: 0.28, y: 0.42 }, { x: 0.47, y: 0.1 }, { x: 0.4, y: -0.2 }, cs),
    // the rolled heart of the bud
    spiralCurve({ x: 0.06, y: -0.28 }, 0.045, 0.19, 1.4, rad(150), ss),
  ].map(P)
  return { polys: polys.map(P), curves }
}

// ------------------------------------------------------------------ leaves

/** A leaf on a short petiole from `root` (a point inside the stem) along direction `ang` (screen radians); veins as curves. */
function leaf(root: P2, ang: number, L: number, w: number, stemHalf: number): { polys: P2[][]; curves: P2[][] } {
  const u = { x: Math.cos(ang), y: Math.sin(ang) }, nrm = { x: -u.y, y: u.x }
  const base = { x: root.x + u.x * (stemHalf + 0.2 * L), y: root.y + u.y * (stemHalf + 0.2 * L) }
  const tip = { x: base.x + u.x * L, y: base.y + u.y * L }
  const polys = [barPts(root, { x: base.x + u.x * 0.12 * L, y: base.y + u.y * 0.12 * L }, Math.max(2.5, 0.1 * w)), lensPts(base, tip, w)]
  const along = (s: number, side: number, d: number): P2 => ({ x: base.x + u.x * s * L + nrm.x * side * d, y: base.y + u.y * s * L + nrm.y * side * d })
  const curves: P2[][] = [bezierCurve(along(0.02, 0, 0), along(0.5, 1, 0.02 * w), along(0.98, 0, 0))]
  // side veins leave the midrib alternately and run out towards the edge, leaning to the tip
  for (const [s, side] of [[0.14, 1], [0.24, -1], [0.36, 1], [0.46, -1], [0.58, 1], [0.68, -1]]) curves.push(bezierCurve(along(s, 0, 0), along(s + 0.17, side, 0.3 * w), along(s + 0.34, side, 0.5 * w)))
  return { polys, curves }
}

// ------------------------------------------------------------------ the heart frame and the scalloped base

function arcBulge(p: Pt, q: Pt, c: Pt, m: Pt): number {
  const tau = 2 * Math.PI, norm = (a: number) => ((a % tau) + tau) % tau, ang = (v: Pt) => Math.atan2(v.y - c.y, v.x - c.x)
  const plus = norm(ang(q) - ang(p)), theta = norm(ang(m) - ang(p)) < plus ? plus : tau - plus
  const side = -(m.x - p.x) * (q.y - p.y) + (m.y - p.y) * (q.x - p.x)
  return Math.sign(side) * Math.tan(theta / 4)
}
/** The heart of width w eroded by b (the hole of a frame b wide): lobes of radius w/4 − b, sides moved in by b, a notch of radius b. */
function innerHeart(cx: number, cy: number, w: number, b: number): { loop: Loop; ok: boolean } {
  const r = w / 4, top = cy - 0.225 * w, rho = r - b
  const len = Math.hypot(2 * r, 0.7 * w), d = { x: -2 * r / len, y: 0.7 * w / len }, nIn = { x: -0.7 * w / len, y: -2 * r / len }
  const A = { x: cx + 2 * r + b * nIn.x, y: top + b * nIn.y }
  const T = { x: cx, y: A.y + ((cx - A.x) / d.x) * d.y }
  const C = { x: cx + r, y: top }, f = { x: A.x - C.x, y: A.y - C.y }, fd = f.x * d.x + f.y * d.y
  const disc = fd * fd - (f.x * f.x + f.y * f.y) + rho * rho
  const s1 = -fd - Math.sqrt(Math.max(0, disc))
  const PR = { x: A.x + s1 * d.x, y: A.y + s1 * d.y }, PL = { x: 2 * cx - PR.x, y: PR.y }
  const JR = { x: cx + b, y: top }, JL = { x: cx - b, y: top }
  const v = (p: Pt, bb?: number): Vtx => ({ x: round3(p.x), y: round3(p.y), ...(bb ? { b: bb } : {}) })
  const loop = oriented({ closed: true, pts: [
    v(T), v(PR, arcBulge(PR, JR, C, { x: cx + r, y: top - rho })), v(JR, arcBulge(JR, JL, { x: cx, y: top }, { x: cx, y: top + b })),
    v(JL, arcBulge(JL, PL, { x: cx - r, y: top }, { x: cx - r, y: top - rho })), v(PL),
  ] }, 'hole')
  return { loop, ok: disc > 0 && rho > 0 && T.y > top + b + 1 }
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
  mm('line', 'عرض خطوط البتلات', 0.8, 3, 'الشقوق الرفيعة التي ترسم البتلات وعروق الأوراق'),
  mm('base', 'قطر القاعدة', 60, 300, 'الطبقة السفلى؛ العليا أصغر قليلاً'),
  { key: 'lobes', label: 'فصوص القاعدة', min: 5, max: 14, step: 1, int: true },
  mm('fit', 'خلوص الشقّ', 0, 0.5, 'يُضاف لعرض شقّ القاعدة وطوله'),
  { key: 'n', label: 'العدد', min: 1, max: 30, step: 1, int: true },
]
const DEFAULTS = { H: 260, W: 75, hw: 90, style: 1, leaves: 2, sw: 8, fw: 5, line: 1.8, base: 120, lobes: 8, fit: 0.2, n: 1 }

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = []
  const t = c.t, { H, W, hw, sw, fw, line, fit } = p, base = p.base
  const style = Math.round(p.style), leaves = Math.round(p.leaves), lobes = Math.round(p.lobes), n = Math.round(p.n)
  // the tenon: narrower than the stem by a shoulder each side, as long as the two base layers less a hair
  const shoulder = Math.min(1.5, 0.15 * sw), tw = round3(sw - 2 * shoulder), tenon = round3(2 * t - 0.3)
  const stemBelow = 0.17 * H
  const headH = style === 1 ? (W * (OPEN_FRAME.top + OPEN_FRAME.bottom)) / OPEN_FRAME.w : 0.76 * W // the bud; its sepals droop beside the stem
  const heartH = 0.95 * hw
  const heartTipY = H - tenon - stemBelow, heartTop = heartTipY - heartH
  const zoneTop = headH, zone = heartTop - zoneTop
  const needZone = Math.max(style === 1 ? 0.55 * W : 0.35 * W, 12) // the open rose carries a side bud above the leaves
  if (zone < needZone) {
    const needH = Math.ceil((headH + heartH + tenon + needZone) / 0.83)
    errors.push(`لا مكان للأوراق بين الوردة والقلب: زد الارتفاع الكلي إلى ${needH} مم، أو صغّر رأس الوردة أو القلب.`)
  }
  const minW = Math.ceil(28 + 16 * line)
  if (W < minW) errors.push(`رأس الوردة صغير على خطوط بتلاته (${line} مم): اجعل عرضه ${minW} مم على الأقل، أو رفّع الخطوط.`)
  if (hw < 2 * sw + 24) errors.push(`القلب ضيّق على الساق: اجعل عرضه ${Math.ceil(2 * sw + 24)} مم على الأقل.`)
  const fwMax = Math.floor(hw / 4 - 5)
  if (fw > fwMax) errors.push(`إطار القلب عريض على هذا القلب: أقصاه ${Math.max(0, fwMax)} مم، أو كبّر القلب إلى ${Math.ceil(4 * (fw + 5))} مم.`)
  const upper = round3(base - 2 * Math.max(3, base / 30))
  if (upper < tw + 2 * fit + 2 * 8) errors.push(`القاعدة صغيرة على شقّ اللسان: اجعل قطرها ${Math.ceil(tw + 2 * fit + 16 + 2 * Math.max(3, base / 30))} مم على الأقل.`)
  if (tw < 3) errors.push('الساق رفيعة: لسانها يقلّ عن 3 مم. اجعل عرض الساق 5 مم على الأقل.')
  if (base < 0.3 * H) warnings.push(`القاعدة (${base} مم) صغيرة لوردة بارتفاع ${H} مم وقد تنقلب: الأفضل ${Math.ceil(0.4 * H)} مم.`)
  if (errors.length) return { panels: [], notes: [], warnings, errors }

  // ---- the silhouette, in panel coordinates: the stem on x = cx, the head's top on y = 0
  const cx = Math.max(W, hw) / 2 + 0.35 * W
  const polys: P2[][] = [], curves: P2[][] = []
  if (style === 1) {
    const k = W / OPEN_FRAME.w, o = { x: cx - k * OPEN_FRAME.cx, y: k * OPEN_FRAME.top }
    const head = openRose(k, o)
    polys.push(...head.polys); curves.push(...head.curves)
    // two sepals under the head where the stem leaves it
    for (const ang of [114, 66]) polys.push(lensPts({ x: cx, y: headH - 0.14 * W }, { x: cx + 0.3 * W * Math.cos(rad(ang)), y: headH - 0.14 * W + 0.3 * W * Math.sin(rad(ang)) }, 0.12 * W))
    // a small bud on a thin branch to the left, below the head
    const kb = 0.28 * W, bang = rad(-118)
    const bc = { x: cx - 0.5 * W, y: zoneTop + 0.05 * zone + 0.08 * W }
    const by = Math.min(bc.y + 0.45 * W, zoneTop + zone - 2) // where the branch leaves the stem
    polys.push(barPts({ x: cx, y: by }, { x: bc.x + 0.3 * kb * Math.cos(bang + Math.PI), y: bc.y + 0.3 * kb * Math.sin(bang + Math.PI) }, Math.max(2.5, 0.45 * sw)))
    const sb = bud(kb, bc, bang + Math.PI / 2, 'small')
    polys.push(...sb.polys); curves.push(...sb.curves)
  } else {
    const k = W, o = { x: cx, y: 0.64 * k } // the petal tips reach y = 0
    const head = bud(k, o, 0, 'full')
    polys.push(...head.polys); curves.push(...head.curves)
  }
  // the leaves, alternating sides down the zone, pointing up and out
  const Ll = 0.6 * W, Lw = 0.3 * W
  for (let j = 0; j < leaves; j++) {
    const side = j % 2 === 0 ? 1 : -1, y = zoneTop + zone * (0.45 + (0.55 * j) / Math.max(leaves - 1, 1))
    const lf = leaf({ x: cx, y }, side === 1 ? rad(-22) : rad(-168), Ll, Lw, sw / 2)
    polys.push(...lf.polys); curves.push(...lf.curves)
  }
  // the stem from inside the head down to the shoulder, the tenon overlapping its end, the heart
  const headCy = style === 1 ? headH / 2 : 0.5 * W
  polys.push(asOuter([{ x: cx - sw / 2, y: headCy }, { x: cx + sw / 2, y: headCy }, { x: cx + sw / 2, y: H - tenon }, { x: cx - sw / 2, y: H - tenon }]))
  polys.push(asOuter([{ x: cx - tw / 2, y: H - tenon - 1 }, { x: cx + tw / 2, y: H - tenon - 1 }, { x: cx + tw / 2, y: H }, { x: cx - tw / 2, y: H }]))
  const heartCy = heartTipY - 0.475 * hw
  polys.push(loopPts(oriented(heart(cx, heartCy, hw), 'outer'), 1.2))
  // only the outer boundary is cut: a pocket the shapes happen to enclose between them stays solid wood
  const outers = unionPolys(polys).filter(l => areaOf(l) > 0)
  TRACE.polys = polys; TRACE.outers = outers
  if (outers.length !== 1) errors.push('أجزاء الوردة لا تلتقي في قطعة واحدة بهذه المقاسات: غيّر الارتفاع أو عرض الوردة قليلاً.')
  const outer = outers.length === 1 ? tidyOutline(outers[0]) : []
  // the slits: every curve clipped to where it keeps a web from the outline and from the slits before it
  const keep = new Shapes()
  keep.add(outer)
  const slits: Loop[] = []
  for (const cv of curves) for (const run of clipCurve(cv, q => pointIn(q, outer), keep, line / 2 + WEB, Math.max(4, 3 * line))) {
    const s = slitLoop(run, line)
    slits.push(s); keep.add(s.pts.map(q => ({ x: q.x, y: q.y })))
  }
  if (slits.length < 4) errors.push(`رأس الوردة صغير على خطوط بتلاته: كبّر عرضه إلى ${Math.ceil(W * 1.4)} مم أو رفّع الخطوط.`)
  if (errors.length) return { panels: [], notes: [], warnings, errors }
  const shape: Loop[] = [{ closed: true, pts: outer.map(q => ({ x: round3(q.x), y: round3(q.y) })) }]
  const inner = innerHeart(cx, heartCy, hw, fw)
  const bb = boxOf(outer)
  const panels: PanelSpec[] = [
    {
      id: 'rose', name: 'الوردة مع القلب', w: round3(bb.x1 - bb.x0), h: round3(bb.y1 - bb.y0), count: n, shape,
      holes: slits.map(s => ({ closed: true, pts: s.pts.map(q => ({ x: round3(q.x), y: round3(q.y) })) })),
      engrave: [{ ...inner.loop, layer: 'engrave' }],
      note: 'قطعة واحدة: الوردة والأوراق والساق والقلب واللسان؛ الخط الأزرق على القلب موضع الإطار',
    },
    {
      id: 'frame', name: 'إطار القلب', w: hw, h: round3(heartH), count: n,
      shape: [oriented(heart(hw / 2, 0.475 * hw, hw), 'outer')], holes: [innerHeart(hw / 2, 0.475 * hw, hw, fw).loop],
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
    `الوردة ${style === 1 ? 'متفتّحة' : 'برعم'} بعرض ${W} مم على ساق ${sw} مم تمرّ في قلب عرضه ${hw} مم؛ ترتفع ${f1(stands)} مم فوق القاعدة (${base} مم). البتلات وعروق الأوراق شقوق رفيعة ${line} مم لا تقطع القطعة، وبين كل شقّ وجاره أو الحافّة ${WEB} مم خشب على الأقل.`,
    `القلب فارغ: اكتب نصّك في RDWorks داخل الإطار المحفور (الخط الأزرق) على قطعة الوردة؛ الإطار نفسه حلقة ${fw} مم تُلصق فوق القلب على ذلك الخط فيبقى النصّ غائراً داخله كما في الصورة.`,
    `القاعدة طبقتان مفصّصتان (${base} و${upper} مم، ${lobes} فصوص) تُلصقان فوق بعضهما وشقّاهما متطابقان؛ لسان الساق ${tw} × ${t} مم ينزل فيهما حتى ${f1(tenon)} مم (طول الطبقتين إلا قليلاً فلا يبرز من تحت) ويستند كتفا الساق على الطبقة العليا. نقطة غراء في الشقّ تكفي.`,
    'خشب أو MDF 3 مم هو الأنسب؛ اقصّ الشقوق الرفيعة قبل الحدود الخارجية (رتّب الطبقات في RDWorks: الأحمر الداخلي أولاً) حتى لا تتحرّك القطعة.',
  ]
  if (leaves === 0) notes.push('بلا أوراق: الساق عارية بين الوردة والقلب.')
  return { panels, notes, warnings, errors, slotted: true }
}

export const ROSE_SIGNS: Template[] = [
  {
    id: 'rosesign',
    name: 'وردة بقلب على قاعدة',
    desc: 'وردة خشبية واقفة كما في الصورة: رأس وردة متفتّحة (أو برعم) ببتلات مرسومة بشقوق رفيعة، وأوراق بعروق مقصوصة، وساق تمرّ في قلب عليه إطار بارز يُلصق فوقه، تقف في قاعدة زهرة مفصّصة بطبقتين. القلب فارغ لتكتب فيه نصّك.',
    icon: `<circle cx="32" cy="14" r="9"/><path d="M28 14a4 4 0 0 1 6-3M31 11a2 2 0 0 1 3 1" stroke-width="1.2"/><path d="M32 23v36" stroke-width="3"/><path d="M32 30l-9-5M32 34l9-5" stroke-width="2"/><path d="M32 50 22 40a6 6 0 0 1 10-6 6 6 0 0 1 10 6z"/><path d="M14 58c0-3 4-4 6-2 2-3 6-3 8 0 2-3 6-3 8 0 2-2 6-1 6 2 3 1 3 5 0 6H14c-3-1-3-5 0-6z" stroke-width="1.3"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build,
  },
]

/** for tests and previews */
/** what the last build merged, for tests */
const TRACE: { polys: P2[][]; outers: P2[][] } = { polys: [], outers: [] }
export const ROSE_DEBUG = { unionPolys, scallop, innerHeart, slitLoop, lensPts, eggPts, tidyOutline, WEB, TRACE }

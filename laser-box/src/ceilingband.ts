// The customer's frame band (the ceiling decor's style 3, «مثل صورة الزبون بالضبط»), rebuilt from his picture (the
// CNCFILE ceiling frame): one row of square cells along the band, a 12-fold rosette in each, the cells' edges (the
// columns between two rosettes and the two border rows along the band's edges) all of one kind, and a plain rim
// outside the border rows.
//
//   rosette (12-fold):  a 12-gon in the middle · 12 small triangles · 12 petals (pointed root, parallel sides, a
//                       blunt peaked end) · the lace ring: 12 T-shaped holes, a bar on the ring with a spike between
//                       two petals · 12 small rhombi outside the ring on the petal axes
//   cell edge:          a 12-gon at each cell corner, then an oval, an arrow pointing at the edge's middle, the two
//                       rhombi of the rosettes either side, an arrow, an oval, a 12-gon
//   diagonals:          a 4-point star (crown) between the rosette and each cell corner
//
// Every hole is a polygon (straight lines, sharp points). The design's numbers were fitted to an average of the
// picture's cells (lengths of H = half a cell; the lace ring and the petals' ends re-fitted to the picture after
// review). Lattice units below are cells: the rosette at the origin, columns at u = ±1/2, border rows at v = ±1/2,
// the holes clipped at |v| = E (the band's edge).
//
// The wood between neighbours is one uniform strap. Holes are laid out as in the picture, grown by half the
// picture's strap (that gives the straps' centre lines), mapped to millimetres (a cell may be stretched a little
// along the band), and shrunk by half the strap wanted: every strap that is tight in the picture comes out exactly
// `strap` wide, however the cell is stretched (a growing sharp corner is bevelled so it never comes closer).
//
// A strip's cells: the corner cells (a whole rosette centred on the 45° mitre, as in the picture) stay square; the
// cells between share the rest alike; a long strip may hold a rosette at a fixed place (the middle strip's axis).
// Every cut is a straight line through the pattern, with no bar of solid wood along it: a mitre is the 45° line from
// the outer corner to the inner one, a joint a line square across the strip down a column between two cells (the
// cells as they are). Both are mirror lines of the pattern there (the corner cell is square, a column's cells are
// alike), so each hole they cross is halved: its part on each side is a notch in that piece's outline (cutSide,
// cutPiece), and put together the two pieces show it whole, as in the picture. The middle strip is a straight run
// with a column (the same shapes as the border rows) at each end inside its own rim.

export type Pt = { x: number; y: number }
export type Poly = Pt[]

/** The design, lengths of H = half the cell (psi in degrees). */
export const REF = {
  s: 0.08775, // the picture's strap
  rc: 0.15971, // centre 12-gon circumradius
  a: 0.08982, // petal half width
  re: 0.712, // petal end (on its axis)
  te: 0.025, // depth of the petal's peaked end (its shoulders at re − te)
  ro: 0.836, // outer edge of the lace ring's T bars (along their axes)
  rd: 0.91, // centre radius of the 12 small outer rhombi
  Ld: 0.063, // rhombus half length (tangential), 60° tips
  aD: 0.09112, // half width of the cell edge's arrows and ovals
  yb: 0.42814, // arrow back (from the edge's middle)
  psi: 35.29526, // slope of the arrow's notch and the ovals' ends
  LO: 0.13033, // oval half length
  rk: 0.1103, // corner 12-gon circumradius (a strap clear of the crowns)
}
/** The picture's strap and the band's hole clip (from its centre line), of the cell. */
export const TAU = REF.s / 2
export const EDGE = (1 + REF.aD) / 2
/** The crown (4-point star on each cell diagonal), of the cell: its centre kc from the cell corner, its points. */
export const CROWN = { kc: 0.1756, pa: 0.0924, pb: 0.0504, n1: 0.0502, qa: 0.0382, qb: 0.0832, n2: 0.0651, ma: 0.0109, mb: 0.0379 }
/** The corner cells' square zone (lattice units either side of the corner rosette): the cells between stretch. */
export const ZONE = 0.6

const D = Math.PI / 180
const S3 = Math.sqrt(3)
const P = (x: number, y: number): Pt => ({ x, y })
const rotP = (p: Pt, a: number): Pt => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) })
const refl = (p: Pt, a: number): Pt => ({ x: p.x * Math.cos(2 * a) + p.y * Math.sin(2 * a), y: p.x * Math.sin(2 * a) - p.y * Math.cos(2 * a) })
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y
const unit = (a: number): Pt => P(Math.cos(a), Math.sin(a))

type Line = { n: Pt; d: number }
const lineND = (n: Pt, d: number): Line => { const l = Math.hypot(n.x, n.y); return { n: P(n.x / l, n.y / l), d: d / l } }
const lineAt = (p: Pt, n: Pt, off = 0): Line => { const l = Math.hypot(n.x, n.y); const u = P(n.x / l, n.y / l); return { n: u, d: dot(u, p) + off } }
function meet(a: Line, b: Line): Pt {
  const det = a.n.x * b.n.y - a.n.y * b.n.x
  if (Math.abs(det) < 1e-12) throw new Error('band: parallel lines')
  return P((a.d * b.n.y - a.n.y * b.d) / det, (a.n.x * b.d - a.d * b.n.x) / det)
}
export function area(poly: Poly): number { let s = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p.x * q.y - q.x * p.y } return s / 2 }
const ccw = (poly: Poly): Poly => (area(poly) < 0 ? [...poly].reverse() : poly)
/** Repeated and collinear vertices left out. */
export function tidy(poly: Poly, eps = 1e-9): Poly {
  let pts = poly.filter((p, i) => { const q = poly[(i + 1) % poly.length]; return Math.hypot(p.x - q.x, p.y - q.y) > eps })
  let changed = true
  while (changed && pts.length > 3) {
    changed = false
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length]
      const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
      if (Math.abs(cr) < eps * Math.hypot(c.x - a.x, c.y - a.y)) { pts.splice(i, 1); changed = true; break }
    }
  }
  return pts
}
/** The part of a polygon with n·p ≤ d. */
export function clipHalf(poly: Poly, n: Pt, d: number): Poly {
  const out: Poly = []
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length]
    const fp = dot(n, p) - d, fq = dot(n, q) - d
    if (fp <= 1e-12) out.push(p)
    if ((fp < -1e-12 && fq > 1e-12) || (fp > 1e-12 && fq < -1e-12)) { const t = fp / (fp - fq); out.push(P(p.x + t * (q.x - p.x), p.y + t * (q.y - p.y))) }
  }
  return out.length >= 3 ? tidy(out) : []
}
/**
 * The part of a simple polygon with n·p ≤ d, as one polygon per piece (a hollow shape cut across can fall in two):
 * each run inside the half-plane, from where it comes in to where it goes out, is joined along the cut line to the
 * next run that comes in further along it.
 */
export function clipHalfMulti(poly: Poly, n: Pt, d: number): Poly[] {
  const pts = ccw(poly), N = pts.length, f = pts.map(p => dot(n, p) - d)
  if (f.every(v => v <= 1e-12)) return [poly]
  if (f.every(v => v >= -1e-12)) return []
  const inside = (i: number) => f[i] <= 1e-12
  const t = (p: Pt) => -n.y * p.x + n.x * p.y // along the cut line, the kept side on its left
  const cross = (i: number): Pt => { const j = (i + 1) % N, u = f[i] / (f[i] - f[j]); return P(pts[i].x + u * (pts[j].x - pts[i].x), pts[i].y + u * (pts[j].y - pts[i].y)) }
  // the runs: from the edge going in (out → in) to the edge going out (in → out)
  const runs: { a: Pt; pts: Pt[]; b: Pt }[] = []
  const start = f.findIndex((_, i) => !inside(i) && inside((i + 1) % N))
  if (start < 0) return [poly]
  for (let k = 0, i = start; k < N; k++, i = (i + 1) % N) {
    const j = (i + 1) % N
    if (!inside(i) && inside(j)) runs.push({ a: cross(i), pts: [], b: P(0, 0) })
    if (inside(j) && runs.length) runs[runs.length - 1].pts.push(pts[j])
    if (inside(j) && !inside((j + 1) % N) && runs.length) runs[runs.length - 1].b = cross(j)
  }
  const used = new Array(runs.length).fill(false), out: Poly[] = []
  for (let r0 = 0; r0 < runs.length; r0++) {
    if (used[r0]) continue
    const piece: Pt[] = []
    let r = r0
    for (let guard = 0; guard <= runs.length && !used[r]; guard++) {
      used[r] = true
      piece.push(runs[r].a, ...runs[r].pts, runs[r].b)
      // the next run in along the cut line
      const tb = t(runs[r].b)
      let nx = -1
      for (let q = 0; q < runs.length; q++) { const ta = t(runs[q].a); if (ta >= tb - 1e-9 && (nx < 0 || ta < t(runs[nx].a))) nx = q }
      if (nx < 0) break
      r = nx
    }
    const pc = tidy(piece)
    if (pc.length >= 3 && Math.abs(area(pc)) > 1e-12) out.push(pc)
  }
  return out
}
const chain = (lines: Line[]): Pt[] => lines.slice(0, -1).map((l, i) => meet(l, lines[i + 1]))
/** No two edges cross. */
export function isSimple(poly: Poly): boolean {
  const n = poly.length
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if ((j + 1) % n === i || (i + 1) % n === j) continue
    const a = poly[i], b = poly[(i + 1) % n], c = poly[j], d = poly[(j + 1) % n]
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false
  }
  return true
}
export function centroid(poly: Poly): Pt {
  let a = 0, x = 0, y = 0
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; const c = p.x * q.y - q.x * p.y; a += c; x += (p.x + q.x) * c; y += (p.y + q.y) * c }
  return a ? P(x / (3 * a), y / (3 * a)) : poly[0]
}
const perimeter = (p: Poly) => p.reduce((s, q, i) => s + Math.hypot(p[(i + 1) % p.length].x - q.x, p[(i + 1) % p.length].y - q.y), 0)
const segPt = (p: Pt, a: Pt, b: Pt) => {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
function inPoly(q: Pt, pts: Poly): boolean {
  let c = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > q.y) !== (b.y > q.y) && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c }
  return c
}
/** The least distance between two polygons (0 when they overlap). */
export function polyGap(A: Poly, B: Poly): number {
  if (inPoly(A[0], B) || inPoly(B[0], A)) return 0
  let d = Infinity
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
    d = Math.min(d, segPt(A[i], B[j], B[(j + 1) % B.length]), segPt(B[j], A[i], A[(i + 1) % A.length]))
    if (d === 0) return 0
  }
  // crossing edges
  const cr = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
    const a = A[i], b = A[(i + 1) % A.length], c = B[j], e = B[(j + 1) % B.length]
    if (cr(a, b, c) * cr(a, b, e) < 0 && cr(c, e, a) * cr(c, e, b) < 0) return 0
  }
  return d
}

// ───────────────────────────── the cell (units of H, the rosette at the origin, columns at x = ±1) ─────────────────────────────

function derived(r: typeof REF) {
  const ra = 2 * (r.a + r.s) // petal root: its flank one strap off the next petal's
  const w = r.Ld * Math.tan(30 * D) // rhombus half width
  const yt = 2 * (r.s - Math.cos(30 * D) * (1 - r.rd - w)) // arrow flank one strap off the rhombus edge
  const tp = Math.tan(r.psi * D)
  const yo = r.yb - r.aD * tp + r.s / Math.cos(r.psi * D) + r.LO // oval end one strap off the arrow's notch
  return { ...r, ra, w, yt, yo, tp }
}
type Dims = ReturnType<typeof derived>

const ngon = (c: Pt, r: number, n: number, a0: number): Poly => Array.from({ length: n }, (_, k) => P(c.x + r * Math.cos(a0 + (2 * Math.PI * k) / n), c.y + r * Math.sin(a0 + (2 * Math.PI * k) / n)))
const petal0 = (g: Dims): Poly => [P(g.ra, 0), P(g.ra + g.a * S3, g.a), P(g.re - g.te, g.a), P(g.re, 0), P(g.re - g.te, -g.a), P(g.ra + g.a * S3, -g.a)]
const rhomb0 = (g: Dims): Poly => [P(g.rd - g.w, 0), P(g.rd, g.Ld), P(g.rd + g.w, 0), P(g.rd, -g.Ld)]
const arrow0 = (g: Dims): Poly => [P(1, g.yt), P(1 + g.aD, g.yt + g.aD * S3), P(1 + g.aD, g.yb), P(1, g.yb - g.aD * g.tp), P(1 - g.aD, g.yb), P(1 - g.aD, g.yt + g.aD * S3)]
const oval0 = (g: Dims): Poly => { const n = g.aD * g.tp; return [P(1, g.yo - g.LO), P(1 + g.aD, g.yo - g.LO + n), P(1 + g.aD, g.yo + g.LO - n), P(1, g.yo + g.LO), P(1 - g.aD, g.yo + g.LO - n), P(1 - g.aD, g.yo - g.LO + n)] }

/** The small triangle between the centre and the petals at 0° and 30°. */
function innerTri(g: Dims): Poly {
  const R = 2, a15 = 15 * D, a30 = 30 * D
  let poly: Poly = [P(0, 0), P(R, 0), P(R * Math.cos(a30), R * Math.sin(a30))]
  poly = clipHalf(poly, unit(a15 + Math.PI), -(g.rc * Math.cos(a15) + g.s))
  const nf = P(-Math.sin(a30), Math.cos(a30))
  poly = clipHalf(poly, P(-nf.x, -nf.y), -(dot(nf, P(g.ra, 0)) + g.s))
  const nf2 = refl(nf, a15)
  poly = clipHalf(poly, P(-nf2.x, -nf2.y), -(dot(nf2, refl(P(g.ra, 0), a15)) + g.s))
  poly = clipHalf(poly, P(0, -1), -g.s / 2)
  const na = P(Math.sin(a30), -Math.cos(a30))
  return clipHalf(poly, P(-na.x, -na.y), -g.s / 2)
}

/** The lace ring's T on 15°: a bar on the ring (outer edge ro) and a spike between the petals at 0° and 30°. */
function tHole(g: Dims): Poly {
  const a15 = 15 * D
  const L1 = lineND(P(0, 1), g.a + g.s) // the 0° petal's side + strap
  const L2 = lineAt(P(g.re, 0), P(g.a, g.te), g.s) // its peaked end + strap
  const L3 = lineND(P(0, 1), g.s / 2) // half a strap off the 0° axis
  const L4 = lineAt(P(g.rd - g.w, 0), P(-g.Ld, g.w), g.s) // the 0° rhombus + strap
  const L5 = lineND(unit(a15), g.ro) // the ring's outer edge
  const M = lineND(P(-Math.sin(a15), Math.cos(a15)), 0)
  const half = chain([M, L1, L2, L3, L4, L5])
  const mir = [...half.slice(1)].reverse().map(p => refl(p, a15))
  return tidy([half[0], ...half.slice(1), ...mir])
}

/** The crown on the first quadrant's diagonal (its points toward the cell corner (1, 1)), units of H. */
function crown(): Poly {
  const c = CROWN, k = 2, ax = Math.SQRT1_2, ay = Math.SQRT1_2
  const o = P(1 - k * c.kc * ax, 1 - k * c.kc * ay)
  const loc: [number, number][] = [[c.n1, 0], [c.pa, c.pb], [c.ma, c.mb], [-c.qa, c.qb], [-c.n2, 0], [-c.qa, -c.qb], [c.ma, -c.mb], [c.pa, -c.pb]]
  return loc.map(([a, b]) => P(o.x + k * (a * ax - b * ay), o.y + k * (a * ay + b * ax)))
}

const D4: ((p: Pt) => Pt)[] = [p => p, p => P(-p.x, p.y), p => P(p.x, -p.y), p => P(-p.x, -p.y), p => P(p.y, p.x), p => P(-p.y, p.x), p => P(p.y, -p.x), p => P(-p.y, -p.x)]
function d4copies(poly: Poly): Poly[] {
  const out: Poly[] = []
  for (const f of D4) {
    const q = ccw(poly.map(f)), c = centroid(q)
    if (!out.some(o => { const c2 = centroid(o); return Math.hypot(c.x - c2.x, c.y - c2.y) < 1e-9 && Math.abs(area(o) - area(q)) < 1e-12 })) out.push(q)
  }
  return out
}

/** A hole of the cell: 'cell' inside it, 'col' on a column (shared with the next cell), 'vdot' a rhombus of the rosette beyond a band edge. */
export type CellHole = { kind: string; place: 'cell' | 'col' | 'vdot'; pts: Poly }
const CELLS = new Map<string, CellHole[]>()
/**
 * Every hole of one cell in lattice units (the rosette at the origin, columns at u = ±1/2, border rows at v = ±1/2),
 * unclipped. `over` changes the design (for fitting it).
 */
export function unitCell(over: Partial<typeof REF> = {}): CellHole[] {
  const key = JSON.stringify(over)
  const hit = CELLS.get(key)
  if (hit) return hit
  const g = derived({ ...REF, ...over })
  const out: CellHole[] = []
  const add = (kind: string, place: CellHole['place'], pts: Poly) => out.push({ kind, place, pts: ccw(tidy(pts)).map(p => P(p.x / 2, p.y / 2)) })
  add('centre', 'cell', ngon(P(0, 0), g.rc, 12, 0))
  const pet = petal0(g), rh = rhomb0(g), tri = innerTri(g), T = tHole(g)
  for (let k = 0; k < 12; k++) {
    const a = k * 30 * D
    add('petal', 'cell', pet.map(p => rotP(p, a)))
    add('rhombus', 'cell', rh.map(p => rotP(p, a)))
    if (tri.length >= 3) add('triangle', 'cell', tri.map(p => rotP(p, a)))
    add('T', 'cell', T.map(p => rotP(p, a)))
  }
  for (const q of d4copies(crown())) add('star', 'cell', q)
  for (const [kind, base] of [['arrow', arrow0(g)], ['oval', oval0(g)]] as [string, Poly][]) {
    for (const q of d4copies(base)) add(kind, Math.abs(Math.abs(centroid(q).x) - 1) < 1e-9 ? 'col' : 'cell', q)
  }
  for (const sx of [1, -1]) for (const sy of [1, -1]) add('corner', 'col', ngon(P(sx, sy), g.rk, 12, 0))
  for (const sy of [1, -1]) add('rhombus', 'vdot', rh.map(p => { const q = rotP(p, -sy * 90 * D); return P(q.x, q.y + 2 * sy) }))
  for (const h of out) if (!isSimple(h.pts) || area(h.pts) <= 0) throw new Error('band: bad ' + h.kind)
  if (CELLS.size > 8) CELLS.clear()
  CELLS.set(key, out)
  return out
}

// ───────────────────────────── from lattice units to millimetres ─────────────────────────────

/** A breakpoint of the along-band map: lattice u → millimetres x. */
export type Knot = { u: number; x: number }
/** The piecewise-linear map through the knots (sorted by u), extended with slope s past the first and last. */
export function knotMap(knots: Knot[], s: number) {
  const k = [...knots].sort((a, b) => a.u - b.u)
  const seg = (u: number) => { let i = 0; while (i < k.length - 2 && u > k[i + 1].u) i++; return i }
  const slope = (u: number) => {
    if (k.length === 1 || u < k[0].u) return s
    if (u > k[k.length - 1].u) return s
    const i = seg(u)
    return (k[i + 1].x - k[i].x) / (k[i + 1].u - k[i].u)
  }
  const fx = (u: number) => {
    if (k.length === 1) return k[0].x + (u - k[0].u) * s
    if (u <= k[0].u) return k[0].x + (u - k[0].u) * s
    if (u >= k[k.length - 1].u) return k[k.length - 1].x + (u - k[k.length - 1].u) * s
    const i = seg(u)
    return k[i].x + (u - k[i].u) * slope(u)
  }
  return { fx, slope, breaks: k.map(q => q.u) }
}
type KMap = ReturnType<typeof knotMap>

/** Vertices added where edges cross the lines u = xs, so the piecewise-linear map keeps every edge straight. */
function splitAtU(p: Poly, xs: number[]): Poly {
  const o: Poly = []
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length]
    o.push(a)
    const ts: number[] = []
    for (const x of xs) if ((a.x - x) * (b.x - x) < -1e-14) ts.push((x - a.x) / (b.x - a.x))
    ts.sort((s, t) => s - t).forEach(t => o.push(P(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y))))
  }
  return o
}
/**
 * A simple polygon moved out by d (in by −d), corners mitred; an edge that would turn over is dropped and its
 * neighbours meet. With `bevel`, a convex corner (of two edges that met in the polygon) that would come out further
 * than 1.02·d is cut square across at d instead. Null when it closes up.
 */
export function offsetPoly(poly: Poly, d: number, bevel?: (v: Pt) => boolean): Poly | null {
  if (Math.abs(d) < 1e-12) return poly
  const pts = tidy(ccw(poly))
  const N = pts.length
  if (N < 3) return null
  let edges = pts.map((p, i) => {
    const q = pts[(i + 1) % N]
    return { k: i, line: lineAt(p, P(q.y - p.y, -(q.x - p.x)), d), dir: P(q.x - p.x, q.y - p.y) }
  })
  while (edges.length >= 3) {
    const n = edges.length
    let v: Pt[]
    try { v = edges.map((_, i) => meet(edges[(i + n - 1) % n].line, edges[i].line)) } catch { return null }
    const flip = edges.findIndex((e, i) => { const a = v[i], b = v[(i + 1) % n]; return (b.x - a.x) * e.dir.x + (b.y - a.y) * e.dir.y <= 1e-12 })
    if (flip >= 0) { edges = edges.filter((_, i) => i !== flip); continue }
    if (!(area(v) > 1e-12)) return null
    if (!bevel || d <= 0) return v
    const out: Poly = []
    for (let i = 0; i < n; i++) {
      const e0 = edges[(i + n - 1) % n], e1 = edges[i], o = pts[e1.k]
      const convex = e0.dir.x * e1.dir.y - e0.dir.y * e1.dir.x > 0
      if ((e0.k + 1) % N === e1.k && convex && Math.hypot(v[i].x - o.x, v[i].y - o.y) > 1.02 * d && bevel(o)) out.push(P(o.x + d * e0.line.n.x, o.y + d * e0.line.n.y), P(o.x + d * e1.line.n.x, o.y + d * e1.line.n.y))
      else out.push(v[i])
    }
    return out
  }
  return null
}

/**
 * A lattice hole in millimetres: grown by h (lattice: the picture's half strap, so its edges lie on the straps'
 * centre lines), mapped (x = fx(u), y = y0 + v·s), shrunk by g (mm, half the strap wanted). Where the hole ends up
 * larger than the picture's, a convex corner is bevelled at the centre line, so it comes no closer to its neighbour
 * than its edges do. Null when it folds or closes up.
 */
function displace(q: Poly, m: KMap, y0: number, s: number, h: number, g: number): Poly | null {
  const G = offsetPoly(q, h, v => h * m.slope(v.x) - g > 0.1 || h * s - g > 0.1)
  if (!G || !isSimple(G)) return null
  const M = splitAtU(G, m.breaks).map(p => P(m.fx(p.x), y0 + p.y * s))
  const R = offsetPoly(M, -g)
  return R && R.length >= 3 && isSimple(R) ? tidy(R, 1e-7) : null
}

// ───────────────────────────── a run of cells in millimetres ─────────────────────────────

/** The band's sizes across: the cell s (mm), the strap (mm), the holes' clip from the centre line (mm). */
export interface BandSize { s: number; strap: number; clip: number }
/** A joint across a strip: down the column u (= k + 1/2), on its centre line x (mm). */
export type Joint = { u: number; x: number }
export interface RunSpec {
  size: BandSize
  /** rosettes k0 … k1 */
  k0: number; k1: number
  /** the along-band map */
  knots: Knot[]
  /** the band's centre line, across (mm) */
  y0: number
  /** further half-planes a·x + b·y ≤ c every hole is cut to (the ends' rims); a piece left under a quarter of its
   *  shape is left out (no sliver) */
  cuts: [number, number, number][]
  /** half-planes a·u + b·v ≤ c in lattice units, cut like the band's edges (before the holes are grown and mapped:
   *  the corner square's other band) */
  latCuts?: [number, number, number][]
  /** with the rosettes beyond both ends (their shapes inside the cuts are kept: the end columns' rhombi) */
  beyond?: boolean
  /** changes to the design (for fitting it to the picture) */
  design?: Partial<typeof REF>
}
export type BandHole = { kind: string; pts: Poly; c: Pt }

/** A hole is cut only when it is at least 2 mm wide and 4 mm² (the decor's rule). */
const cuttable = (p: Poly) => { const a = Math.abs(area(p)); return a >= 4 && (2 * a) / perimeter(p) >= 1 }

/** A piece of a hole cut by a run's end is kept when it is at least this share of the hole (no slivers). */
const END_SHARE = 0.25

/** The holes of a run of cells in mm, each whole but where the band's edges (and the run's `cuts`) clip it. */
export function bandRun(o: RunSpec): BandHole[] {
  const { size, y0 } = o, { s, strap, clip } = size
  const m = knotMap(o.knots, s), h = TAU / 2, g = strap / 2
  const cell = unitCell(o.design)
  const k0 = o.beyond ? o.k0 - 1 : o.k0, k1 = o.beyond ? o.k1 + 1 : o.k1
  const lat: { kind: string; pts: Poly }[] = []
  for (let k = k0; k <= k1; k++) for (const hl of cell) {
    if (hl.place === 'col' && centroid(hl.pts).x > 0 && k < k1) continue
    lat.push({ kind: hl.kind, pts: hl.pts.map(p => P(p.x + k, p.y)) })
  }
  const cutAll = (ps: Poly[], planes: [number, number, number][]) => planes.reduce((acc, [a, b, c]) => acc.flatMap(p => clipHalfMulti(p, P(a, b), c)), ps)
  const out: BandHole[] = []
  for (const l of lat) {
    // the picture's hole cut at the band's edges first (the clip line is then kept where it is)
    const built = cutAll([l.pts], [[0, 1, EDGE], [0, -1, EDGE], ...(o.latCuts ?? [])]).flatMap(c => {
      const p = displace(c, m, y0, s, h, g) ?? displace(tidy(c, 2e-3), m, y0, s, h, g)
      return p ? [p] : []
    })
    for (const e of cutAll(built, [[0, 1, y0 + clip], [0, -1, -(y0 - clip)]])) {
      const frags = cutAll([e], o.cuts), whole = Math.abs(area(e))
      const touched = frags.length !== 1 || Math.abs(Math.abs(area(frags[0])) - whole) > 1e-9
      for (const p of frags) if (cuttable(p) && (!touched || Math.abs(area(p)) >= END_SHARE * whole)) out.push({ kind: l.kind, pts: p, c: centroid(p) })
    }
  }
  return out
}

// ───────────────────────────── straight cuts through the pattern (the mitres and the joints) ─────────────────────────────

/**
 * The rules at a cut: no wood under `sliver` mm across along it (between a hole and the cut, or a point of wood
 * sharper than `wedge`°, a strip's own 45° corner), no notch or bit of a hole under `frag` mm.
 */
export const CUT = { sliver: 3, frag: 1.5, wedge: 45 }
/** A notch: the part of hole `hole` on a piece's side of a cut, a dip in the piece's outline along the cut. */
export interface Notch { hole: number; pts: Poly; t0: number; t1: number }

/** The convex hull, counter-clockwise. */
function hullOf(ps: Pt[]): Poly {
  const s = [...ps].sort((p, q) => p.x - q.x || p.y - q.y), cr = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lo: Pt[] = [], hi: Pt[] = []
  for (const p of s) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p) }
  for (const p of [...s].reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 1e-12) hi.pop(); hi.push(p) }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)]
}

/**
 * The straight cut a → b through the pattern, for the piece on its left: every hole across it leaves its part on that
 * side as a notch (the piece on the other side, cut b → a, takes the rest, so the two together hold the hole whole).
 * Whatever would leave too little there (CUT) is named in `trouble` and fixed where it is, by one rule on whichever
 * piece has it: a bit of a hole too small to cut stays wood; wood too thin between a hole and the cut goes (the hole
 * reaches the cut, a notch); a point of wood too sharp between the cut and a notch is cut off where it is CUT.sliver
 * across. A fix that would run into another hole is not made: `left` names what is left as it is. `fix` false: the
 * trouble named only.
 */
export function cutSide(a: Pt, b: Pt, holes: Poly[], fix = true): { notches: Notch[]; trouble: string[]; left: string[] } {
  const L = Math.hypot(b.x - a.x, b.y - a.y), u = P((b.x - a.x) / L, (b.y - a.y) / L), n = P(-u.y, u.x), eps = 1e-7
  const sd = (p: Pt) => n.x * (p.x - a.x) + n.y * (p.y - a.y), td = (p: Pt) => u.x * (p.x - a.x) + u.y * (p.y - a.y)
  const notches: Notch[] = [], trouble: string[] = [], left: string[] = [], f2 = (v: number) => v.toFixed(2)
  // (a corner within a thousandth of a millimetre of the cut lies on it: the same on both sides, so they still match)
  const onLine = (p: Pt) => { const s = sd(p); return Math.abs(s) < 1e-3 ? P(p.x - s * n.x, p.y - s * n.y) : p }
  const hs = holes.map(h => h.map(onLine)), fixes: { nt: Notch; word: string }[] = []
  hs.forEach((h, i) => {
    let lo = Infinity, hi = -Infinity, t0 = Infinity, t1 = -Infinity
    for (const p of h) { const s = sd(p), t = td(p); lo = Math.min(lo, s); hi = Math.max(hi, s); t0 = Math.min(t0, t); t1 = Math.max(t1, t) }
    if (hi < eps || lo >= CUT.sliver || t1 < 0 || t0 > L) return
    if (lo > -eps) {
      // wood under CUT.sliver between the hole and the cut: the hole's part within CUT.sliver of it, and its foot on it, go
      const word = `sliver ${f2(lo)} mm at t = ${f2((t0 + t1) / 2)}`
      trouble.push(word)
      if (!fix) return
      const ts = clipHalfMulti(h, n, dot(n, a) + CUT.sliver).flat().map(td), f0 = Math.min(...ts), f1 = Math.max(...ts)
      fixes.push({ nt: { hole: i, pts: hullOf([...h, P(a.x + f0 * u.x, a.y + f0 * u.y), P(a.x + f1 * u.x, a.y + f1 * u.y)]), t0: f0, t1: f1 }, word })
      return
    }
    for (const fr of clipHalfMulti(h, P(-n.x, -n.y), -dot(n, a))) {
      const on = fr.filter(p => Math.abs(sd(p)) < eps).map(td), depth = Math.max(...fr.map(sd))
      const f0 = Math.min(...on), f1 = Math.max(...on), w = (2 * Math.abs(area(fr))) / perimeter(fr)
      if (depth < CUT.frag || f1 - f0 < CUT.frag || w < CUT.frag / 2) { trouble.push(`bit ${f2(Math.min(depth, f1 - f0, 2 * w))} mm at t = ${f2((f0 + f1) / 2)}`); if (fix) continue }
      notches.push({ hole: i, pts: ccw(fr), t0: f0, t1: f1 })
    }
  })
  // (a fix is made only when what it takes away touches no other hole and no other notch)
  const clear = (pts: Poly, own: number) => hs.every((h, k) => k === own || polyGap(h, pts) > 1e-6) && notches.every(o => o.hole === own || polyGap(o.pts, pts) > 1e-6)
  for (const { nt, word } of fixes) if (clear(nt.pts, nt.hole)) notches.push(nt); else left.push(word)
  // a point of wood too sharp between the cut and a notch: off where it is CUT.sliver across (the notch's line edge
  // runs t0 → t1, counter-clockwise; its far end first, so the near one keeps its place)
  for (const nt of notches) {
    const at = (t: number) => nt.pts.findIndex(p => Math.abs(sd(p)) < eps && Math.abs(td(p) - t) < 1e-6)
    for (const end of [1, 0]) {
      const pts = nt.pts, m = pts.length, i0 = at(nt.t0)
      if (i0 < 0 || at(nt.t1) !== (i0 + 1) % m) throw new Error('band: a notch meets its cut more than once')
      const i = end ? (i0 + 1) % m : i0, o = pts[i], q = pts[end ? (i + 1) % m : (i + m - 1) % m], away = end ? u : P(-u.x, -u.y)
      const e = P(q.x - o.x, q.y - o.y), el = Math.hypot(e.x, e.y), ang = Math.acos(Math.max(-1, Math.min(1, dot(away, e) / el))) / D
      if (ang >= CUT.wedge - 1e-9) continue
      const word = `point ${f2(ang)}° at t = ${f2(td(o))}`
      trouble.push(word)
      if (!fix) continue
      const r = Math.min(CUT.sliver / 2 / Math.sin((ang * D) / 2), 0.9 * el), A = P(o.x + r * away.x, o.y + r * away.y), B = P(o.x + (r * e.x) / el, o.y + (r * e.y) / el)
      if (!clear([o, A, B], nt.hole)) { left.push(word); continue }
      pts.splice(i, 1, ...(end ? [A, B] : [B, A]))
      if (end) nt.t1 = td(A); else nt.t0 = td(A)
    }
  }
  notches.sort((p, q) => p.t0 - q.t0)
  for (let k = 1; k < notches.length; k++) if (notches[k].t0 < notches[k - 1].t1 + CUT.sliver - 1e-6) { const w = `notches ${f2(notches[k].t0 - notches[k - 1].t1)} mm apart at t = ${f2(notches[k].t0)}`; trouble.push(w); left.push(w) }
  if (!fix) left.push(...trouble.filter(w => !left.includes(w)))
  return { notches, trouble, left }
}

/**
 * A piece cut from the pattern: its region `base` (a convex polygon, counter-clockwise) of which the edges `cuts`
 * (base[i] → base[i + 1]) are cuts through it. The holes wholly inside are its holes (their indices); each one across
 * a cut is a notch: the outline runs along the cut and dips round the hole's part on the piece's side (cutSide).
 */
export function cutPiece(base: Poly, cuts: number[], holes: Poly[], fix = true): { outline: Poly; holes: number[]; notches: Notch[]; trouble: string[]; left: string[] } {
  const N = base.length, sides = new Map<number, ReturnType<typeof cutSide>>()
  for (const i of cuts) sides.set(i, cutSide(base[i], base[(i + 1) % N], holes, fix))
  const notched = new Set<number>(), trouble: string[] = [], left: string[] = [], outline: Poly = []
  for (let i = 0; i < N; i++) {
    outline.push(base[i])
    const sd = sides.get(i)
    if (!sd) continue
    trouble.push(...sd.trouble)
    left.push(...sd.left)
    for (const nt of sd.notches) {
      notched.add(nt.hole)
      // round the notch with the hole on the right: from where it meets the cut first, back round to where it leaves it
      const m = nt.pts.length, a = base[i], b = base[(i + 1) % N], L = Math.hypot(b.x - a.x, b.y - a.y)
      const td = (p: Pt) => ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L
      const i0 = nt.pts.findIndex(p => Math.abs(td(p) - nt.t0) < 1e-6 && Math.abs(((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / L) < 1e-7)
      for (let k = 0; k < m - 1; k++) outline.push(nt.pts[(i0 - k + m) % m])
      outline.push(nt.pts[(i0 + 1) % m])
    }
  }
  // the holes inside: every point left of every edge (those across a cut are notches, those outside are not this piece's)
  const inside = (h: Poly) => base.every((a, i) => { const b = base[(i + 1) % N], L = Math.hypot(b.x - a.x, b.y - a.y); return h.every(p => ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / L > 1e-7) })
  const own: number[] = []
  holes.forEach((h, k) => {
    if (notched.has(k)) return
    if (inside(h)) { own.push(k); return }
    // (a hole across an edge that is no cut, or a bit of a hole left as wood, is no hole of this piece)
    const across = base.some((a, i) => { const b = base[(i + 1) % N], L = Math.hypot(b.x - a.x, b.y - a.y), s = h.map(p => ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / L); return Math.min(...s) < -1e-7 && Math.max(...s) > 1e-7 })
    if (across && !cuts.some(i => { const a = base[i], b = base[(i + 1) % N], L = Math.hypot(b.x - a.x, b.y - a.y), s = h.map(p => ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / L); return Math.min(...s) < -1e-7 && Math.max(...s) > 1e-7 })) throw new Error('band: a hole across a piece\'s edge that is no cut')
  })
  return { outline: tidy(outline, 1e-9), holes: own, notches: [...sides.values()].flatMap(s => s.notches), trouble, left }
}

// ───────────────────────────── the frame's layout ─────────────────────────────

/** One strip's layout: rosettes k = 0 … n (the corner ones on the mitres), the map's knots and the joints. */
export interface StripLayout {
  L: number
  n: number
  knots: Knot[]
  joints: Joint[]
  /** the rosettes' and the columns' places (mm along the outer edge) */
  rosettes: number[]
  columns: number[]
  /** the interior pitch of each stretch between fixed rosettes (mm) */
  pitches: number[]
  /** the fixed rosette (the middle strip's axis), or -1 */
  axisK: number
}
export interface MidLayout { L: number; k: number; pitch: number; rimEnd: number; knots: Knot[] }
export interface Frame3 {
  size: BandSize
  rim: number
  vc: number
  /** the strips along PW (top and bottom) and along PH (right and left); with the middle strip the long ones hold its axis */
  pw: StripLayout
  ph: StripLayout
  mid: MidLayout | null
  /** the worst stretch along the band of any cell (pitch / s − 1) */
  worst: number
}
export interface Frame3In {
  /** the band's width (rims included) and its centre line from the outer edge (mm) */
  bw: number; vc: number
  PW: number; PH: number
  /** the least strap (mm) and the least plain rim along the band's edges (mm; 0 = a strap) */
  web: number; minRim: number
  /** the middle strip: its axis on the long strips (from their first corner), its visible length and width */
  mid: null | { axisU: number; Lvis: number; midW: number }
  /** the longest piece a strip may be cut into (Infinity: strips are not cut) */
  maxLen: number
  /** a strip of two pieces is cut at its middle */
  halves: boolean
  /** the joints wanted instead (columns u = k + 1/2: their k, from each strip's first corner), for the short and the
   *  long strips; a strip left out is cut as maxLen asks */
  joints?: { short?: number[]; long?: number[] }
  /** the least cell (mm) */
  sMin?: number
}

/** The strap for a cell s: the picture's, at least web. */
export const strapOf = (s: number, web: number) => Math.max(web, Math.round(TAU * s * 10) / 10)
/** The cells are kept this near square along the band when they can be (the picture's own run 2–6.5%). */
export const SQUARE = 0.049

/** Joints' count on a strip L long. */
const piecesOf = (L: number, maxLen: number) => (L > maxLen + 1e-9 ? Math.ceil(L / maxLen - 1e-9) : 1)

/**
 * The layout of a strip L long whose corner rosettes sit at vc and L − vc, the corner cells square (ZONE either
 * side), an optional fixed rosette at axisX, n steps (na + nb with the axis); jointKs are the columns u = k + 1/2
 * that are joints (a joint takes no room: its straight cut runs down the column, through its shapes, each a mirror
 * image about it). `strap` is kept for the callers.
 */
export function stripLayout(L: number, vc: number, s: number, strap: number, n: number, axis: { k: number; x: number } | null, jointKs: number[]): StripLayout {
  void strap
  const z = ZONE, js = [...jointKs].sort((a, b) => a - b)
  // fixed rosettes (u, x): the corners and the axis
  const fixed: { u: number; x: number }[] = [{ u: 0, x: vc }, ...(axis ? [{ u: axis.k, x: axis.x }] : []), { u: n, x: L - vc }]
  const knots: Knot[] = [{ u: 0, x: vc }, { u: z, x: vc + z * s }]
  const pitches: number[] = []
  for (let i = 0; i + 1 < fixed.length; i++) {
    const a = fixed[i], b = fixed[i + 1]
    const ua = a.u === 0 ? z : a.u, xa = a.u === 0 ? vc + z * s : a.x
    const ub = b.u === n ? n - z : b.u, xb = b.u === n ? L - vc - z * s : b.x
    pitches.push((xb - xa) / (ub - ua))
    knots.push({ u: ub, x: xb })
  }
  knots.push({ u: n, x: L - vc })
  const m = knotMap(knots, s)
  // (each joint on a thousandth of a millimetre: the pieces' lengths then add up to the strip's exactly)
  const joints = js.map(k => ({ u: k + 0.5, x: Math.round(m.fx(k + 0.5) * 1000) / 1000 }))
  return { L, n, knots, joints, rosettes: Array.from({ length: n + 1 }, (_, k) => m.fx(k)), columns: Array.from({ length: n }, (_, k) => (js.includes(k) ? joints.find(j => j.u === k + 0.5)!.x : m.fx(k + 0.5))), pitches, axisK: axis ? axis.k : -1 }
}

/** The joints (column indices) cutting a strip into pieces no longer than maxLen, as near alike as they go. */
function chooseJoints(L: number, lay: StripLayout, maxLen: number, halves: boolean, keepOut: [number, number] | null, b: number, strap: number): number[] | null {
  const k = piecesOf(L, maxLen)
  if (k === 1) return []
  const cand = lay.columns.map((x, i) => ({ x, i })).filter(c => c.x >= b + strap && c.x <= L - b - strap && !(keepOut && c.x > keepOut[0] && c.x < keepOut[1]))
  const fits = (x0: number, x1: number) => x1 - x0 <= maxLen + 1e-9
  if (halves && k === 2 && lay.axisK < 0) {
    const m = cand.find(c => Math.abs(c.x - L / 2) < 1e-6)
    if (m && fits(0, m.x) && fits(m.x, L)) return [m.i]
  }
  // a strip that is its own mirror image (no fixed rosette, or one in its middle) is cut at mirror-image columns, so
  // it stays one
  const symm = lay.axisK < 0 || Math.abs(lay.rosettes[lay.axisK] - L / 2) < 1e-6
  if (symm && k <= 5) {
    const mirror = (c: { x: number; i: number }) => cand.find(d => Math.abs(d.x - (L - c.x)) < 1e-6)
    const left = cand.filter(c => c.x < L / 2 - 1e-6 && mirror(c)), middle = cand.find(c => Math.abs(c.x - L / 2) < 1e-6)
    const pairs = Math.floor((k - 1) / 2), needMid = (k - 1) % 2 === 1
    if (!needMid || middle) {
      let best: { v: number; ks: number[] } | null = null
      const t = L / k
      const walk = (from: number, chosen: { x: number; i: number }[]) => {
        if (chosen.length === pairs) {
          const xs = [...chosen.map(c => c.x), ...(needMid ? [L / 2] : []), ...chosen.map(c => L - c.x)].sort((p, q) => p - q), cuts = [0, ...xs, L]
          if (cuts.slice(1).some((x, i) => !fits(cuts[i], x))) return
          const v = Math.max(...cuts.slice(1).map((x, i) => Math.abs(x - cuts[i] - t)))
          if (!best || v < best.v - 1e-9) best = { v, ks: [...chosen.map(c => c.i), ...(needMid ? [middle!.i] : []), ...chosen.map(c => mirror(c)!.i)].sort((p, q) => p - q) }
          return
        }
        for (let q = from; q < left.length; q++) walk(q + 1, [...chosen, left[q]])
      }
      walk(0, [])
      if (best) return (best as { v: number; ks: number[] }).ks
    }
  }
  // fewest pieces, the worst difference from L / pieces least (dynamic programme over the columns)
  for (let kk = k; kk <= cand.length + 1; kk++) {
    const t = L / kk, cuts = [{ x: 0, i: -1 }, ...cand, { x: L, i: -2 }], M = cuts.length
    const best = Array.from({ length: kk + 1 }, () => new Array<number>(M).fill(Infinity)), from = Array.from({ length: kk + 1 }, () => new Array<number>(M).fill(-1))
    best[0][0] = 0
    for (let jj = 1; jj <= kk; jj++) for (let i = 1; i < M; i++) for (let hh = 0; hh < i; hh++) {
      const len = cuts[i].x - cuts[hh].x
      if (!fits(cuts[hh].x, cuts[i].x) || best[jj - 1][hh] === Infinity) continue
      const v = Math.max(best[jj - 1][hh], Math.abs(len - t))
      if (v < best[jj][i] - 1e-9) { best[jj][i] = v; from[jj][i] = hh }
    }
    if (best[kk][M - 1] < Infinity) { const out: number[] = []; for (let jj = kk, i = M - 1; jj > 1; jj--) { i = from[jj][i]; out.unshift(cuts[i].i) } return out }
  }
  return null
}

/**
 * The frame's band: the cell s, the steps of each strip and its joints, the middle strip's. The cell is the largest
 * the band holds with its rims (one strap, as in the picture, or minRim) whose cells all stay within SQUARE of square
 * along the band; when none does, the squarest. Null when the band holds no cell.
 */
export function planFrame3(o: Frame3In): Frame3 | null {
  const W2 = o.bw / 2
  const sMax = Math.min((W2 - Math.max(o.minRim, o.web)) / EDGE, W2 / (EDGE + TAU)), sMin = Math.max(20, o.sMin ?? 0)
  if (!(sMax >= sMin)) return null
  const z = ZONE, lg = (x: number) => Math.abs(Math.log(x)), dev = (p: number, s: number) => Math.abs(p / s - 1)
  const wide = o.PW >= o.PH, Ll = wide ? o.PW : o.PH, Ls = wide ? o.PH : o.PW
  const cutN = (L: number) => piecesOf(L, o.maxLen) - 1
  // the best steps for a stretch D long between two fixed rosettes, `zones` of them corner ones
  const stepsFor = (D: number, zones: number, s: number, odd: boolean) => {
    let best: { n: number; p: number } | null = null
    for (let n = Math.max(zones === 2 ? 2 : 1, Math.floor(D / (1.5 * s))); n <= Math.ceil(D / (0.6 * s)) + 1; n++) {
      if (odd && n % 2 === 0) continue
      const p = (D - zones * z * s) / (n - zones * z)
      if (!(p > 0)) continue
      if (!best || lg(p / s) < lg(best.p / s) - 1e-12) best = { n, p }
    }
    return best
  }
  type Pick = { s: number; strap: number; worst: number; cost: number; nS: number; nA: number; nB: number; nL: number; km: number; pm: number; rimEnd: number }
  let pick: Pick | null = null, square: Pick | null = null
  for (let s = sMax; s >= Math.max(0.8 * sMax, sMin) - 1e-9; s -= 0.25) {
    const strap = strapOf(s, o.web), rim = W2 - EDGE * s
    if (rim < Math.max(strap, o.minRim) - 1e-9) continue
    const sh = stepsFor(Ls - 2 * o.vc, 2, s, o.halves && cutN(Ls) === 1)
    if (!sh) continue
    let worst = dev(sh.p, s), nA = 0, nB = 0, nL = 0, km = 0, pm = 0, rimEnd = 0
    if (o.mid) {
      const a = o.mid.axisU
      const A = stepsFor(a - o.vc, 1, s, false), B = stepsFor(Ll - o.vc - a, 1, s, false)
      if (!A || !B) continue
      nA = A.n; nB = B.n
      worst = Math.max(worst, dev(A.p, s), dev(B.p, s))
      // the middle strip: k cells between its end columns, inside end rims a strap wide at least (the joint with
      // the long strip a strap either side); the least end rim that keeps its cells as square as the frame's (2%
      // at least), else the squarest (none when it is too narrow for the band's cell: the frame's checks say so)
      const midRim = o.mid.midW / 2 - EDGE * s, tol = Math.max(worst, 0.02), room = o.mid.Lvis - 2 * (EDGE - 0.5) * s
      let bm: { k: number; p: number; r: number; fit: boolean; c: number } | null = null
      for (let k = 1; k <= Math.ceil(o.mid.Lvis / (0.6 * s)); k++) {
        const pHi = (room - 2 * strap) / k, pLo = (room - 2 * Math.max(2 * rim, strap)) / k
        if (!(pHi > 0)) continue
        const pFit = Math.min(pHi, s * (1 + tol)), fit = pFit >= Math.max(pLo, s * (1 - tol)) - 1e-9
        const p = fit ? pFit : Math.min(pHi, Math.max(pLo, s)), r = (room - k * p) / 2
        const c = fit ? r : 1e6 + dev(p, s)
        if (!bm || c < bm.c - 1e-9) bm = { k, p, r, fit, c }
      }
      if (bm && midRim >= strap - 1e-9) { km = bm.k; pm = bm.p; rimEnd = bm.r; worst = Math.max(worst, dev(pm, s)) }
    } else {
      const L = stepsFor(Ll - 2 * o.vc, 2, s, o.halves && cutN(Ll) === 1)
      if (!L) continue
      nL = L.n
      worst = Math.max(worst, dev(L.p, s))
    }
    const cand: Pick = { s, strap, worst, cost: worst + 0.02 * (1 - s / sMax), nS: sh.n, nA, nB, nL, km, pm, rimEnd }
    // the largest cell (the narrowest rim) whose cells are near square; else the squarest
    if (!square && worst <= SQUARE) square = cand
    if (!pick || cand.cost < pick.cost - 1e-12) pick = cand
  }
  if (square) pick = square
  if (!pick) return null
  const { s, strap } = pick, size = { s, strap, clip: EDGE * s }, rim = W2 - EDGE * s
  // the strips with their joints (a strip that cannot be cut so keeps none: the frame's checks refuse it)
  const lay = (L: number, n: number, axis: { k: number; x: number } | null, keepOut: [number, number] | null, want?: number[]): StripLayout => {
    const l0 = stripLayout(L, o.vc, s, strap, n, axis, [])
    const ks = want ? want.filter(k => k >= 1 && k < n - 1) : chooseJoints(L, l0, o.maxLen, o.halves, keepOut, o.vc + o.bw / 2, strap)
    return ks && ks.length ? stripLayout(L, o.vc, s, strap, n, axis, ks) : l0
  }
  const short = lay(Ls, pick.nS, null, null, o.joints?.short)
  let long: StripLayout
  let mid: MidLayout | null = null
  if (o.mid) {
    const half = o.mid.midW / 2 + Math.max(2 * strap, s / 4)
    long = lay(Ll, pick.nA + pick.nB, { k: pick.nA, x: o.mid.axisU }, [o.mid.axisU - half, o.mid.axisU + half], o.joints?.long)
    const x0 = pick.rimEnd + (EDGE - 0.5) * s + pick.pm / 2 // the first rosette
    // (knots past both end columns: the rosettes beyond the ends keep the pitch too)
    if (pick.km) mid = { L: o.mid.Lvis, k: pick.km, pitch: pick.pm, rimEnd: pick.rimEnd, knots: [{ u: -1.5, x: x0 - 1.5 * pick.pm }, { u: pick.km + 0.5, x: x0 + (pick.km + 0.5) * pick.pm }] }
  } else long = lay(Ll, pick.nL, null, null, o.joints?.long)
  const worst = Math.max(...[...short.pitches, ...long.pitches, ...(mid ? [mid.pitch] : [])].map(p => dev(p, s)))
  return { size, rim, vc: o.vc, pw: wide ? long : short, ph: wide ? short : long, mid, worst }
}

// ───────────────────────────── the strips' holes ─────────────────────────────

/** The strip's run of holes as the layout lays them out, whole (no mitre, no joint cuts them). */
const runOf = (f: Frame3, lay: StripLayout, cuts: [number, number, number][] = [], latCuts: [number, number, number][] = []) => bandRun({ size: f.size, k0: 0, k1: lay.n, knots: lay.knots, y0: f.vc, cuts, latCuts })
const sideOf = (h: BandHole, m: (p: Pt) => number) => { const v = h.pts.map(m); return Math.min(...v) > 1e-9 ? 1 : Math.max(...v) < -1e-9 ? -1 : 0 }

/**
 * The shapes across a corner's mitre (strip coordinates of a strip's first end: the mitre y = x, the strip on
 * x > y), each whole and cut only at the two bands' edges (it lies in the square where they cross). The corner is a
 * mirror image about its mitre, and so is each of them: the mitre's straight cut halves them (cutSide).
 */
export function cornerShapes(f: Frame3): BandHole[] {
  // (the corner cells are square in every strip: one cell's layout serves them all)
  const one: StripLayout = { L: Infinity, n: 1, knots: [{ u: 0, x: f.vc }], joints: [], rosettes: [], columns: [], pitches: [], axisK: -1 }
  // (cut at the other band's edges as at its own: in the lattice first, then in millimetres)
  const { clip } = f.size
  return runOf(f, one, [[-1, 0, -(f.vc - clip)], [1, 0, f.vc + clip]], [[1, 0, EDGE], [-1, 0, EDGE]]).filter(h => sideOf(h, p => p.x - p.y) === 0)
}

/**
 * A strip's holes (strip coordinates: x along the outer edge from its first corner, y from the outer edge inward;
 * mitres y = x and y = L − x), each whole, as the pattern lies before it is cut: those between its mitres, and the
 * shapes across each mitre (the same at every corner; a straight cut there halves each, cutPiece). dir: the strip
 * runs along PW or PH (by default the layout's own). With `bar` (the one-piece board, as its other styles) the
 * corner rosette is split on each diagonal by a solid bar 2·strap wide instead.
 */
export function stripHoles(f: Frame3, lay: StripLayout, dir: 'pw' | 'ph' = lay === f.ph && lay !== f.pw ? 'ph' : 'pw', bar = false): BandHole[] {
  const L = lay.L
  if (bar) { const r = f.size.strap * Math.SQRT2; return runOf(f, lay, [[-1, 1, -r], [1, 1, L - r]]) }
  const own = runOf(f, lay).filter(h => sideOf(h, p => p.x - p.y) > 0 && sideOf(h, p => L - p.x - p.y) > 0)
  const cs = cornerShapes(f)
  // a strip along PH sees the corner swapped (x ↔ y) in its own coordinates; its second end mirrored (x → L − x)
  const first = dir === 'pw' ? cs : cs.map(h => { const pts = h.pts.map(p => P(p.y, p.x)).reverse(); return { kind: h.kind, pts, c: centroid(pts) } })
  const second = first.map(h => { const pts = h.pts.map(p => P(L - p.x, p.y)).reverse(); return { kind: h.kind, pts, c: centroid(pts) } })
  return [...first, ...own, ...second]
}

/** The middle strip's holes (its own coordinates: x along it from the window's edge 0 … L, y across 0 … width). */
export function midHoles(f: Frame3, width: number): BandHole[] {
  const m = f.mid
  if (!m) return []
  const e = m.rimEnd
  return bandRun({ size: f.size, k0: 0, k1: m.k - 1, knots: m.knots, y0: width / 2, cuts: [[-1, 0, -e], [1, 0, m.L - e]], beyond: true })
}

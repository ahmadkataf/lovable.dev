// A sweets or dates box whose back wall rises into a tall pointed mihrab arch (the customer's photo: a white acrylic
// box with rosette-fretted walls, a flat lid with a brass knob over a gold lozenge, brass feet, and a gold fretted
// band glued round the arch).
//
// Construction: a finger-jointed open box. The back panel is one piece: the wall below, and above it the arch, spliced
// into the wall's top edge after the joints are cut (PanelSpec.shape would skip the joint machinery, so the arch is
// added in the `post` hook instead: one outer loop, fingers on the rectangle's edges). The lid is a plate W × (D − t)
// with a lip frame glued under it; it rests on the front and the sides and butts against the arch's front face. The
// gold band is a separate piece: the arch outline inset by the band width, cut off just above the lid's top face,
// and glued on the arch. The arch's fret keeps clear of the band zone so the band glues onto solid material.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, circle, polyLoop, roundedRectHole, rotatedRectHole, stadiumV, heart, arcInfo, round3, offsetLoop } from './geom'
import { PanelSpec } from './joints'

type P2 = { x: number; y: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', hint })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()

const N = { bottom: 'القاعدة', front: 'الواجهة الأمامية', back: 'الواجهة الخلفية مع المحراب', side: 'الجانب' }

// ------------------------------------------------------------------ the fret patterns (as in templates.ts)

function offsetPolyline(pts: P2[], closed: boolean, d: number): P2[] {
  const n = pts.length, seg = (i: number) => { const a = pts[i], b = pts[(i + 1) % n], l = Math.hypot(b.x - a.x, b.y - a.y); return { a, b, nx: (b.y - a.y) / l, ny: -(b.x - a.x) / l } }
  const segs = Array.from({ length: closed ? n : n - 1 }, (_, i) => seg(i))
  const at = (s: ReturnType<typeof seg>, p: P2) => ({ x: p.x + s.nx * d, y: p.y + s.ny * d })
  const out: P2[] = []
  for (let i = 0; i < n; i++) {
    const s0 = closed ? segs[(i - 1 + n) % n] : segs[i - 1], s1 = closed ? segs[i % n] : segs[i]
    if (!s0) { out.push(at(s1, pts[i])); continue }
    if (!s1) { out.push(at(s0, pts[i])); continue }
    // the two moved edges meet on the bisector, 1 / cos(half the turn) further out
    const bx = s0.nx + s1.nx, by = s0.ny + s1.ny, k = (s0.nx * s1.nx + s0.ny * s1.ny + 1) / 2
    out.push(k > 1e-9 ? { x: pts[i].x + (bx / 2 / k) * d, y: pts[i].y + (by / 2 / k) * d } : at(s1, pts[i]))
  }
  return out
}

/** Decorative holes filling the field [x0,x1]×[y0,y1]: 1 circles, 2 vertical slots, 3 one window, 4 hearts, 5 diamonds, 6 stars, 7 rosettes. */
function pattern(kind: number, x0: number, y0: number, x1: number, y1: number, cell: number): Loop[] {
  const fw = x1 - x0, fh = y1 - y0
  if (fw < cell * 2 || fh < cell * 2) return []
  if (kind === 3) return [roundedRectHole(x0, y0, fw, fh, Math.min(4, cell / 2))]
  const out: Loop[] = []
  if (kind === 7) return rosettes(x0, y0, x1, y1, cell)
  if (kind === 6) {
    const bar = Math.max(2.5, cell * 0.16), P = cell + bar, R = cell / 2, Ri = R * Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8)
    const nx = Math.floor((fw - cell) / P) + 1, ny = Math.floor((fh - cell) / P) + 1
    if (nx < 1 || ny < 1) return out
    const sx = x0 + (fw - (nx - 1) * P) / 2, sy = y0 + (fh - (ny - 1) * P) / 2
    const star = (cx: number, cy: number): Loop => polyLoop(Array.from({ length: 16 }, (_, k) => {
      const a = (k * Math.PI) / 8, r = k % 2 ? Ri : R
      return { x: round3(cx + r * Math.cos(a)), y: round3(cy + r * Math.sin(a)) }
    }), 'hole')
    const sq = (Math.SQRT1_2 * P - R - bar) / Math.SQRT2
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = sx + i * P, y = sy + j * P
      out.push(star(x, y))
      if (sq >= 1.2 && i + 1 < nx && j + 1 < ny) out.push(rotatedRectHole(x + P / 2, y + P / 2, 2 * sq, 2 * sq, 0))
    }
    return out
  }
  if (kind === 5) {
    const bar = Math.max(2.5, cell * 0.18), P = cell + bar * Math.SQRT2, side = cell / Math.SQRT2
    const cols = Math.floor((fw - cell) / P), rows = Math.floor((fh - cell) / (P / 2))
    if (cols < 0 || rows < 0) return out
    const sx = x0 + (fw - cols * P) / 2, sy = y0 + (fh - rows * (P / 2)) / 2
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols - (j % 2); i++) out.push(rotatedRectHole(sx + i * P + (j % 2 ? P / 2 : 0), sy + j * (P / 2), side, side, Math.PI / 4))
    return out
  }
  if (kind === 2) {
    const pitch = cell * 2, n = Math.max(1, Math.floor((fw - cell) / pitch) + 1), sx = x0 + (fw - (n - 1) * pitch) / 2
    for (let i = 0; i < n; i++) out.push(stadiumV(sx + i * pitch, y0 + fh / 2, fh, cell))
    return out
  }
  const pitch = kind === 4 ? cell * 1.45 : cell * 1.7
  const nx = Math.max(1, Math.floor((fw - cell) / pitch) + 1), ny = Math.max(1, Math.floor((fh - cell) / pitch) + 1)
  const sx = x0 + (fw - (nx - 1) * pitch) / 2, sy = y0 + (fh - (ny - 1) * pitch) / 2
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) out.push(kind === 4 ? heart(sx + i * pitch, sy + j * pitch, cell) : circle(sx + i * pitch, sy + j * pitch, cell / 2))
  return out
}

const PATTERN_OPTIONS = ['بلا', 'دوائر', 'شقوق', 'نافذة', 'قلوب', 'معيّنات', 'نجوم', 'وردات']

/** Islamic eight-fold rosettes in strapwork (Hankin's method on the 4.8.8 tiling), as in templates.ts. */
/**
 * `clipTo` trims every face to a region (the arch inside its band, a strip, a lozenge); `near` says whether a tile
 * centred at a point can reach that region at all, so tiles far outside are not even drawn; `strap` overrides the
 * strap width (engraved straps are fine lines).
 */
export function rosettes(x0: number, y0: number, x1: number, y1: number, cell: number, clipTo?: (face: P2[]) => P2[], strap?: number, near?: (c: P2) => boolean): Loop[] {
  const nx = Math.max(1, Math.round((x1 - x0) / (3 * cell))), Pd = (x1 - x0) / nx, ny = Math.floor((y1 - y0) / Pd)
  if (ny < 1) return []
  const w = strap ?? Math.max(2.5, 0.075 * Pd), th = (67.5 * Math.PI) / 180
  const ys = (y0 + y1) / 2 - (ny * Pd) / 2, ye = ys + ny * Pd
  y0 = ys; y1 = ye
  type V = { x: number; y: number }
  const rot = (v: V, a: number) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) })
  const meet = (p: V, u: V, q: V, v: V) => { const den = u.x * v.y - u.y * v.x, k = ((q.x - p.x) * v.y - (q.y - p.y) * v.x) / den; return { x: p.x + k * u.x, y: p.y + k * u.y } }
  const key = (v: V) => Math.round(v.x * 1000) * 4194304 + Math.round(v.y * 1000)
  const faces: V[][] = []
  const around = new Map<number, { at: V; pts: V[] }>()
  const tiles: V[][] = []
  const R8 = 0.5 / Math.cos(Math.PI / 8), s4 = 0.5 - 0.5 * Math.tan(Math.PI / 8)
  const toField = (v: V) => ({ x: x0 + v.x * Pd, y: ys + v.y * Pd })
  for (let i = -1; i <= nx + 1; i++) for (let j = -1; j <= ny + 1; j++) {
    if (!near || near(toField({ x: i, y: j }))) tiles.push(Array.from({ length: 8 }, (_, k) => ({ x: i + R8 * Math.cos(Math.PI / 8 + (k * Math.PI) / 4), y: j + R8 * Math.sin(Math.PI / 8 + (k * Math.PI) / 4) })))
    if (!near || near(toField({ x: i + 0.5, y: j + 0.5 }))) tiles.push([{ x: i + 0.5 + s4, y: j + 0.5 }, { x: i + 0.5, y: j + 0.5 + s4 }, { x: i + 0.5 - s4, y: j + 0.5 }, { x: i + 0.5, y: j + 0.5 - s4 }])
  }
  for (const T of tiles) {
    const n = T.length, M = T.map((a, k) => { const b = T[(k + 1) % n]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } })
    const star: V[] = []
    for (let k = 0; k < n; k++) {
      const a = T[k], b = T[(k + 1) % n], c = T[(k + 2) % n]
      const e0 = { x: b.x - a.x, y: b.y - a.y }, e1 = { x: b.x - c.x, y: b.y - c.y }
      const X = meet(M[k], rot(e0, th), M[(k + 1) % n], rot(e1, -th))
      star.push(M[k], X)
      const g = around.get(key(b)) ?? { at: b, pts: [] }
      g.pts.push(X, M[k], M[(k + 1) % n])
      around.set(key(b), g)
    }
    faces.push(star)
  }
  for (const { at, pts } of around.values()) {
    if (pts.length < 9) continue
    const uniq = [...new Map(pts.map(v => [key(v), v])).values()]
    faces.push(uniq.sort((u, v) => Math.atan2(u.y - at.y, u.x - at.x) - Math.atan2(v.y - at.y, v.x - at.x)))
  }
  const out: Loop[] = []
  const clip = (poly: V[]) => {
    let pts = poly
    if (pts.every(v => v.x >= x0 && v.x <= x1 && v.y >= y0 && v.y <= y1)) return pts
    for (const [ax, sg, lim] of [['x', 1, x0], ['x', -1, x1], ['y', 1, y0], ['y', -1, y1]] as const) {
      const inside = (v: V) => sg * (v[ax] - lim) >= 0, res: V[] = []
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length]
        if (inside(a)) res.push(a)
        if (inside(a) !== inside(b)) { const u = (lim - a[ax]) / (b[ax] - a[ax]); res.push({ x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y) }) }
      }
      pts = res
      if (pts.length < 3) return []
    }
    return pts
  }
  const area = (p: V[]) => p.reduce((sum, a, k) => { const b = p[(k + 1) % p.length]; return sum + a.x * b.y - b.x * a.y }, 0) / 2
  const crosses = (p: V[]) => {
    const n = p.length
    for (let a = 0; a < n; a++) for (let b = a + 2; b < n; b++) {
      if (a === 0 && b === n - 1) continue
      const P1 = p[a], P2 = p[(a + 1) % n], Q1 = p[b], Q2 = p[(b + 1) % n]
      const d = (o: V, q: V, r: V) => (q.x - o.x) * (r.y - o.y) - (q.y - o.y) * (r.x - o.x)
      if (d(P1, P2, Q1) * d(P1, P2, Q2) < 0 && d(Q1, Q2, P1) * d(Q1, Q2, P2) < 0) return true
    }
    return false
  }
  for (const f of faces) {
    let fp = clip(f.map(toField))
    if (fp.length >= 3 && clipTo) fp = clipTo(fp)
    if (fp.length < 3) continue
    const dedup = fp.filter((v, k) => Math.hypot(v.x - fp[(k + 1) % fp.length].x, v.y - fp[(k + 1) % fp.length].y) > 1e-6)
    if (dedup.length < 3) continue
    const A = area(dedup), ins = offsetPolyline(dedup, true, A > 0 ? -w / 2 : w / 2)
    const Ai = area(ins)
    if (Math.sign(Ai) !== Math.sign(A) || Math.abs(Ai) < 4 || crosses(ins)) continue
    // a sliver left by the clipper turns inside out when shrunk: the shrunk face must lie inside the face it came from
    if (ins.some(v => !pointIn(v, dedup))) continue
    let room = Infinity
    for (let a = 0; a < ins.length; a++) for (let b = 0; b < ins.length; b++) {
      if (b === a || (b + 1) % ins.length === a) continue
      const q = ins[a], P1 = ins[b], P2 = ins[(b + 1) % ins.length], dx = P2.x - P1.x, dy = P2.y - P1.y, l2 = dx * dx + dy * dy
      const u = Math.max(0, Math.min(1, ((q.x - P1.x) * dx + (q.y - P1.y) * dy) / l2))
      room = Math.min(room, Math.hypot(q.x - P1.x - u * dx, q.y - P1.y - u * dy))
    }
    if (room < 1.2 || ins.some(v => v.x < x0 + w / 2 - 1e-6 || v.x > x1 - w / 2 + 1e-6 || v.y < y0 + w / 2 - 1e-6 || v.y > y1 - w / 2 + 1e-6)) continue
    out.push(polyLoop(ins.map(v => ({ x: round3(v.x), y: round3(v.y) })), 'hole'))
  }
  return out
}

// ------------------------------------------------------------------ small geometry helpers

/** Points along a loop's outline (arcs sampled), about `step` mm apart. */
function outlinePts(l: Loop, step = 2): P2[] {
  const out: P2[] = [], n = l.pts.length
  for (let i = 0; i < n; i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n]
    out.push({ x: p.x, y: p.y })
    if (p.b) {
      const a = arcInfo(p, q, p.b), m = Math.max(4, Math.ceil((a.r * a.theta) / step))
      for (let k = 1; k < m; k++) { const ang = a.a0 + (a.ccw ? -1 : 1) * a.theta * k / m; out.push({ x: a.c.x + a.r * Math.cos(ang), y: a.c.y + a.r * Math.sin(ang) }) }
    } else {
      const len = Math.hypot(q.x - p.x, q.y - p.y), m = Math.ceil(len / step)
      for (let k = 1; k < m; k++) out.push({ x: p.x + (q.x - p.x) * k / m, y: p.y + (q.y - p.y) * k / m })
    }
  }
  return out
}

export function pointIn(p: P2, poly: P2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < a.x + (b.x - a.x) * (p.y - a.y) / (b.y - a.y)) inside = !inside
  }
  return inside
}

/** The part of a polygon on the inside of the line a → b (`s` = +1 keeps the left in a y-up frame). */
function clipHalf(pts: P2[], a: P2, b: P2, s: number): P2[] {
  const side = (p: P2) => s * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x))
  const out: P2[] = []
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k], q = pts[(k + 1) % pts.length], sp = side(p), sq = side(q)
    if (sp >= 0) out.push(p)
    if ((sp >= 0) !== (sq >= 0)) { const u = sp / (sp - sq); out.push({ x: p.x + u * (q.x - p.x), y: p.y + u * (q.y - p.y) }) }
  }
  return out
}

/**
 * Clips small polygons to a region: by the half-planes of the region's edges near the polygon (the region is convex at
 * the scale of a motif, and where it bends away the tangents clip a hair too much, never too little), then dropped
 * when the rest lies outside the region.
 */
export function regionClipper(region: P2[]): (face: P2[]) => P2[] {
  const area = region.reduce((sum, a, k) => { const b = region[(k + 1) % region.length]; return sum + a.x * b.y - b.x * a.y }, 0)
  const s = area > 0 ? 1 : -1
  const edges = region.map((a, k) => { const b = region[(k + 1) % region.length]; return { a, b, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) } })
  return face => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const q of face) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y) }
    let pts = face
    for (const e of edges) {
      if (e.x1 < x0 - 2 || e.x0 > x1 + 2 || e.y1 < y0 - 2 || e.y0 > y1 + 2) continue
      pts = clipHalf(pts, e.a, e.b, s)
      if (pts.length < 3) return []
    }
    const c = { x: pts.reduce((sum, q) => sum + q.x, 0) / pts.length, y: pts.reduce((sum, q) => sum + q.y, 0) / pts.length }
    return pointIn(c, region) ? pts : []
  }
}

const polyArea = (p: P2[]) => Math.abs(p.reduce((sum, a, k) => { const b = p[(k + 1) % p.length]; return sum + a.x * b.y - b.x * a.y }, 0) / 2)

/** A deep copy of loops (buildPanel moves a panel's loops in place, so two panels must not share one). */
const cloneLoops = (ls: Loop[]): Loop[] => ls.map(l => ({ ...l, pts: l.pts.map(v => ({ ...v })) }))

/** Drop consecutive duplicates. */
const thin = (pts: P2[]) => pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 1e-6)

/** Points of the arc about c from angle a0 to a1 (either way round), about 1.5° apart. */
function arcPts(c: P2, r: number, a0: number, a1: number): P2[] {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / ((1.5 * Math.PI) / 180)))
  return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) } })
}

// ------------------------------------------------------------------ the arch

/** The arch outline in a y-up frame: from the left springing (0, 0) over the apex (W/2, A) to (W, 0); `alpha` is half the apex angle. */
export function archProfile(style: number, W: number, A: number): { pts: P2[]; alpha: number } {
  const half = W / 2
  let left: P2[], alpha: number
  if (style === 3) {
    // a round arch: a semicircle on two straight legs
    const cy = A - half
    left = [{ x: 0, y: 0 }, ...arcPts({ x: half, y: cy }, half, Math.PI, Math.PI / 2)]
    alpha = Math.PI / 2
  } else if (style === 2) {
    // a pointed arch: each side an arc centred on the springing line, vertical at the springing
    const c = (half * half + A * A) / W
    left = arcPts({ x: c, y: 0 }, c, Math.PI, Math.atan2(A, half - c))
    alpha = Math.PI / 2 - Math.atan2(c - half, A)
  } else {
    // the mihrab (ogee): a convex arc up to the inflection at 70 % of the height, then a concave arc turning 12°
    // more into the apex; the lower arc's sweep θ is the one for which the chord from the inflection to the apex
    // bisects that turn
    const k = 0.7, dl = (12 * Math.PI) / 180
    const g = (th: number) => Math.atan2((1 - k) * A, half - k * A * Math.tan(th / 2)) + th - (Math.PI / 2 + dl / 2)
    let lo = 0.001, hi = Math.min(Math.PI / 2 - 0.01, 2 * Math.atan(half / (k * A)) - 1e-4)
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (g(m) < 0) lo = m; else hi = m }
    const th = (lo + hi) / 2, r1 = (k * A) / Math.sin(th)
    const I = { x: k * A * Math.tan(th / 2), y: k * A }, P = { x: half, y: A }
    const nv = { x: -Math.cos(th), y: Math.sin(th) }, d = { x: I.x - P.x, y: I.y - P.y }
    const r2 = -(d.x * d.x + d.y * d.y) / (2 * (nv.x * d.x + nv.y * d.y))
    const C2 = { x: I.x + r2 * nv.x, y: I.y + r2 * nv.y }
    const aI = Math.atan2(I.y - C2.y, I.x - C2.x), aP = Math.atan2(P.y - C2.y, P.x - C2.x)
    let sweep = aP - aI
    while (sweep < 0) sweep += 2 * Math.PI
    left = [...arcPts({ x: r1, y: 0 }, r1, Math.PI, Math.PI - th), ...arcPts(C2, r2, aI, aI + sweep)]
    alpha = th - dl
  }
  left = thin(left)
  left[left.length - 1] = { x: half, y: A }
  left[0] = { x: 0, y: 0 }
  const right = left.slice(0, -1).reverse().map(p => ({ x: W - p.x, y: p.y }))
  return { pts: [...left, ...right], alpha }
}

/**
 * The profile moved `d` inwards, its legs continued straight down, then cut off at height y0: an open path from
 * (d, y0) over the apex to (W − d, y0). Only the left half is offset (continued past the apex along its tangent) and
 * cut where it crosses the axis, then mirrored: the inner apex is where the two sides' offsets meet, without the
 * loop a plain offset leaves at a sharp corner.
 */
export function insetPath(prof: P2[], W: number, d: number, y0: number): P2[] {
  const half = W / 2
  let top = 0
  for (let i = 1; i < prof.length; i++) if (prof[i].y > prof[top].y) top = i
  const raw = prof.slice(0, top + 1)
  const a = raw[raw.length - 2], b = raw[raw.length - 1], len = Math.hypot(b.x - a.x, b.y - a.y), reach = 3 * d + 2
  const ext = [{ x: 0, y: y0 - 50 }, ...raw, { x: b.x + ((b.x - a.x) / len) * reach, y: b.y + ((b.y - a.y) / len) * reach }]
  const off = d ? offsetPolyline(ext, false, d) : ext
  const left: P2[] = []
  for (let i = 0; i < off.length; i++) {
    const p = off[i], q = off[i - 1]
    if (i > 0 && p.x >= half - 1e-9) { const u = (half - q.x) / (p.x - q.x); left.push({ x: half, y: q.y + u * (p.y - q.y) }); break }
    left.push(p)
  }
  // cut off below y0 (the path climbs from under it once)
  const up: P2[] = []
  for (let i = 0; i < left.length; i++) {
    const p = left[i], q = left[i - 1]
    if (p.y < y0) continue
    if (up.length === 0 && q && q.y < y0) { const u = (y0 - q.y) / (p.y - q.y); up.push({ x: q.x + u * (p.x - q.x), y: y0 }) }
    up.push(p)
  }
  const L = thin(up)
  return [...L, ...L.slice(0, -1).reverse().map(q => ({ x: W - q.x, y: q.y }))]
}

/** The height of a symmetric, x-monotone path at x (−∞ outside its reach): one binary search on its left half. */
export function envelope(path: P2[], W: number): (x: number) => number {
  let top = 0
  for (let i = 1; i < path.length; i++) if (path[i].y > path[top].y) top = i
  const L = path.slice(0, top + 1)
  return (x: number) => {
    x = Math.min(x, W - x)
    if (x < L[0].x - 1e-9) return -Infinity
    let lo = 0, hi = L.length - 1
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L[m].x <= x) lo = m; else hi = m - 1 }
    if (lo >= L.length - 1) return L[L.length - 1].y
    const a = L[lo], b = L[lo + 1]
    return b.x - a.x < 1e-9 ? Math.max(a.y, b.y) : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)
  }
}

/** Arc-length parametrisation of the left leg of a path (bottom to apex), and the map from (along, across) to the plane; across > 0 is outwards (left of the climb). */
function bentStrip(path: P2[]) {
  let top = 0
  for (let i = 1; i < path.length; i++) if (path[i].y > path[top].y) top = i
  const leg = path.slice(0, top + 1), cum = [0]
  for (let i = 1; i < leg.length; i++) cum.push(cum[i - 1] + Math.hypot(leg[i].x - leg[i - 1].x, leg[i].y - leg[i - 1].y))
  const L = cum[cum.length - 1]
  const map = (u: number, v: number): P2 => {
    let lo = 0, hi = leg.length - 2
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cum[m] <= u) lo = m; else hi = m - 1 }
    const a = leg[lo], b = leg[lo + 1], len = cum[lo + 1] - cum[lo], tx = (b.x - a.x) / len, ty = (b.y - a.y) / len, s = u - cum[lo]
    return { x: a.x + tx * s - ty * v, y: a.y + ty * s + tx * v }
  }
  return { L, map }
}

/** A lozenge (rhombus with gently bowed sides) w × h centred at (cx, cy), as an outer contour on screen. */
function lozenge(cx: number, cy: number, w: number, h: number): Loop {
  const b = -0.14 // bowed outwards (left of a clockwise outline)
  return polyLoop([{ x: cx - w / 2, y: cy, b }, { x: cx, y: cy - h / 2, b }, { x: cx + w / 2, y: cy, b }, { x: cx, y: cy + h / 2, b }], 'outer')
}

// ------------------------------------------------------------------ the template

const ARCH_STYLES = ['محراب', 'مدبّب', 'مستدير']

export const MIHRAB_BOXES: Template[] = [{
  id: 'mihrabbox',
  name: 'علبة حلويات بمحراب',
  desc: 'علبة تمر أو حلويات بجدران مخرّمة بالوردات الإسلامية، ظهرها يرتفع إلى محراب مدبّب مخرّم يُلصق عليه شريط ذهبي مخرّم، وغطاء مسطّح بمقبض نحاسي فوق معيّن ذهبي، وأرجل نحاسية.',
  icon: `<path d="M10 42h44v14H10z"/><path d="M14 42V30c0-12 10-18 18-28 8 10 18 16 18 28v12" stroke-width="1.6"/><path d="M19 42V31c0-9 7-14 13-21 6 7 13 12 13 21v11" stroke-width="1"/><path d="M30 38h4M32 34v4" stroke-width="1.5"/><path d="M12 58l-3 3M52 58l3 3" stroke-width="2"/><path d="M18 46l2 2-2 2-2-2zM32 46l2 2-2 2-2-2zM46 46l2 2-2 2-2-2z" stroke-width="1.2"/>`,
  params: [
    mm('W', 'العرض', 100, 600), mm('D', 'العمق', 80, 500), mm('H', 'ارتفاع العلبة', 30, 200, 'بلا الغطاء والأرجل'),
    mm('A', 'ارتفاع المحراب', 50, 900, 'فوق حافّة العلبة؛ بين نصف العرض وضعفه'),
    { key: 'style', label: 'شكل القوس', min: 1, max: 3, step: 1, int: true, options: ARCH_STYLES, hint: 'محراب: قوس بصلي برأس مدبّب كما في الصورة' },
    mm('band', 'عرض الشريط الذهبي', 6, 60, 'يتبع حافّة المحراب؛ من نحو 18 مم يُخرّم، والأضيق يُحفر'),
    { key: 'pattern', label: 'الزخرفة', min: 0, max: 7, step: 1, int: true, options: PATTERN_OPTIONS, hint: 'الوردات الإسلامية كما في الصورة' },
    mm('cell', 'حجم الزخرفة', 6, 40, 'في الأكريليك 10 مم أو أكثر'),
    { key: 'lidDeco', label: 'معيّن ذهبي على الغطاء', min: 0, max: 1, step: 1, int: true },
    mm('knob', 'قطر برغي المقبض', 3, 10, 'ثقب المقبض في الغطاء والمعيّن'),
    mm('lipH', 'ارتفاع شفة الغطاء', 4, 40), mm('gap', 'خلوص الشفة', 0.2, 2, 'بين إطار الشفة والجدران'),
    { key: 'n', label: 'عدد العلب', min: 1, max: 20, step: 1, int: true },
  ],
  defaults: { W: 300, D: 220, H: 70, A: 270, style: 1, band: 25, pattern: 7, cell: 12, lidDeco: 1, knob: 4, lipH: 10, gap: 0.5, n: 1 },
  innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
  build(p, c) { return buildMihrab(p, c) },
}]

function buildMihrab(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = []
  const { W, D, H, A, band, cell, lipH, gap, knob } = p, t = c.t
  const style = Math.round(p.style), kind = Math.round(p.pattern), n = Math.max(1, Math.round(p.n))
  const dimName: Record<string, string> = { W: 'العرض', D: 'العمق', H: 'الارتفاع' }
  for (const k of ['W', 'D', 'H']) if (p[k] < 4 * t) errors.push(`${dimName[k]} (${p[k]} مم) أصغر من أربع سماكات (${4 * t} مم)؛ لا مكان للتعشيق.`)
  if (c.kerf > t / 2) warnings.push('عرض الشق (kerf) كبير بشكل غير معتاد.')
  if (W < 4 * t || D < 4 * t || H < 4 * t) return { panels: [], notes: [], warnings, errors }

  // ---- the arch: between half the width (a round top) and twice it (a needle); the geometry is drawn clamped so a preview always exists
  const aMin = Math.ceil(W / 2), aMax = Math.floor(2 * W)
  if (A < aMin) errors.push(`المحراب منخفض لشكله (${A} مم): اجعل ارتفاعه ${aMin} مم على الأقل، نصف العرض.`)
  else if (A > aMax) errors.push(`المحراب طويل جداً لعرضه فيصير رأسه إبرة: اجعل ارتفاعه ${aMax} مم أو أقل، أو وسّع العلبة.`)
  const Au = Math.min(aMax, Math.max(aMin, A))
  const arch = archProfile(style, W, Au)
  const hb = t + 1 // the band and the arch's fret start here above the walls' top edge: just above the lid's top face
  // ---- the band: its inner edge's apex (a mitre, band / sin α deep, deeper still where the sides curve in) must stay
  // well above the lid; the widest band that keeps it 12 mm up is found by halving, the apex sinking as the band grows
  const innerApex = (b: number) => { const path = insetPath(arch.pts, W, b, hb); return Math.max(...path.map(q => q.y)) }
  let bandMax = 0
  if (innerApex(1) >= hb + 12) {
    let lo = 1, hi = Math.floor(W / 6)
    if (innerApex(hi) >= hb + 12) lo = hi
    else for (let i = 0; i < 12 && hi - lo > 0.5; i++) { const m = (lo + hi) / 2; if (innerApex(m) >= hb + 12) lo = m; else hi = m }
    bandMax = Math.floor(lo)
  }
  if (band > bandMax) errors.push(bandMax >= 6
    ? `الشريط الذهبي عريض على هذا المحراب (رأسه الداخلي ينزل كثيراً): اجعل عرضه ${bandMax} مم أو أقل.`
    : `المحراب صغير على شريط ذهبي: ارفع المحراب إلى ${Math.ceil(hb + 12 + 8 / Math.sin(arch.alpha))} مم أو أكثر.`)
  const bu = Math.max(1, Math.min(band, bandMax))
  // ---- the lid's lip frame, as in the lidded gift box; a lip shorter than three thicknesses cannot carry corner
  // fingers, so its corners are butt-glued instead (it is glued to the lid anyway)
  if (lipH > H - t - 4) errors.push(`ارتفاع الشفة أكبر من عمق العلبة: اجعله ${Math.floor(H - t - 4)} مم أو أقل.`)
  const Wl = W - 2 * t - 2 * gap, Dl = D - 2 * t - 2 * gap, lipJoint = lipH >= 3 * t

  // ---- the walls' fret: solid margins 2t + 2 round every edge, and the lip zone at the top left solid
  const fm = 2 * t + 2, top = Math.max(fm, lipH + 2)
  const wallHoles = (w: number, ce: number) => (kind > 0 ? pattern(kind, fm, top, w - fm, H - fm, ce) : [])
  let frontHoles = wallHoles(W, cell)
  if (kind > 0 && frontHoles.length === 0) {
    // the wall is too short or narrow for this cell: say the biggest cell that fits, or that the box must grow
    let fits = 0
    for (let ce = Math.min(cell, 40) - 0.5; ce >= 6; ce -= 0.5) if (wallHoles(W, ce).length > 0) { fits = ce; break }
    errors.push(fits > 0
      ? `الجدران صغيرة على زخرفة بحجم ${cell} مم: اجعل حجم الزخرفة ${fits} مم أو أقل.`
      : `العلبة صغيرة على الزخرفة (الجدار الأمامي ${W} × ${H} مم): ارفع العلبة إلى ${Math.ceil(top + fm + 3 * 6 + 1)} مم أو أكثر أو اختر «بلا» زخرفة.`)
    frontHoles = []
  }
  const sideHoles = wallHoles(D, cell)

  // ---- the arch's fret, clipped to the arch inset by the band and a 2 mm glue margin (panel frame: y down, the wall's top edge at y = 0)
  const archInset = insetPath(arch.pts, W, bu + 2, hb + 2), archIn = envelope(archInset, W)
  const archRegion = archInset.map(q => ({ x: q.x, y: -q.y }))
  // the safety test is a hair looser than the clip: a clipped rosette face sits exactly on the margin, then shrinks by half a strap
  const archIn1 = envelope(insetPath(arch.pts, W, bu + 1, hb + 1), W)
  const inArch = (q: P2) => { const h = -q.y; return h >= hb + 1 && h <= archIn1(q.x) }
  const archHoles: Loop[] = []
  if (kind === 3) {
    const win = insetPath(arch.pts, W, bu + 2 + Math.max(2, t), hb + 2 + Math.max(2, t))
    if (win.length > 3 && Math.max(...win.map(q => q.y)) - (hb + 2) > 10) archHoles.push(polyLoop(win.map(q => ({ x: round3(q.x), y: round3(-q.y) })), 'hole'))
  } else if (kind > 0) {
    const nxA = Math.max(1, Math.round(W / (3 * cell))), Pd = W / nxA
    const yb = -(hb + 2), yt = yb - Math.ceil((Au - hb - 2) / Pd) * Pd
    // tiles whose centre is more than a tile away from the region cannot touch it: the region's top is a height function
    const nearArch = (c: P2) => { const r = 0.8 * Pd, xs = [c.x - r, c.x + r, c.x]; if (c.x - r < W / 2 && c.x + r > W / 2) xs.push(W / 2); return -c.y <= Math.max(...xs.map(archIn)) + r && c.x > bu - r && c.x < W - bu + r }
    const raw = kind === 2 ? [] : kind === 7 ? rosettes(0, yt, W, yb, cell, regionClipper(archRegion), undefined, nearArch) : pattern(kind, 0, yt, W, yb, cell)
    if (kind === 2) {
      // slots: each from the bottom of the field up to the arch above it
      const pitch = 2 * cell, m = Math.max(1, Math.floor((W - 2 * (bu + 2) - cell) / pitch) + 1), sx = W / 2 - ((m - 1) * pitch) / 2
      for (let i = 0; i < m; i++) {
        const x = sx + i * pitch, hTop = Math.min(archIn(x - cell / 2), archIn(x + cell / 2), archIn(x)) - 1
        if (hTop - (hb + 2) > 2 * cell) raw.push(stadiumV(round3(x), round3(-(hb + 2 + hTop) / 2), round3(hTop - hb - 2), cell))
      }
    }
    for (const h of raw) if (outlinePts(h, 2).every(inArch)) archHoles.push(h)
  }
  if (kind > 0 && kind !== 3 && archHoles.length === 0 && !errors.length) warnings.push('المحراب ضيّق على الزخرفة بهذا الحجم: صغّر حجم الزخرفة أو عرض الشريط ليظهر فيه تخريم.')

  // ---- the back panel: the wall with its joints, the arch spliced into its top edge
  const archPanelPts = arch.pts.slice(1, -1).map(q => ({ x: round3(q.x), y: round3(-q.y) }))
  const splice = (loops: Loop[]) => {
    for (const l of loops) {
      if (!l.closed) continue
      const m = l.pts.length
      for (let i = 0; i < m; i++) {
        const a = l.pts[i], b = l.pts[(i + 1) % m]
        if (!a.b && Math.abs(a.x) < 1e-3 && Math.abs(a.y) < 1e-3 && Math.abs(b.x - W) < 1e-3 && Math.abs(b.y) < 1e-3) { l.pts.splice(i + 1, 0, ...archPanelPts); return }
      }
    }
  }
  const wallNote = kind > 0 ? 'مخرّم داخل هامش مصمت' : ''
  const panels: PanelSpec[] = [
    {
      id: 'bottom', name: N.bottom, w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male',
      engrave: W >= 60 && D >= 60 ? [[16, 16], [W - 16, 16], [W - 16, D - 16], [16, D - 16]].map(([x, y]) => ({ ...circle(x, y, 5), layer: 'engrave' as const })) : [],
      note: 'الدوائر المحفورة على وجهها السفلي مواضع الأرجل النحاسية',
    },
    { id: 'front', name: N.front, w: W, h: H, bottom: 'female', left: 'male', right: 'male', holes: frontHoles, note: wallNote },
    {
      id: 'back', name: N.back, w: W, h: H, bottom: 'female', left: 'male', right: 'male', holes: [...cloneLoops(frontHoles), ...archHoles], post: splice,
      note: `قطعة واحدة: الجدار الخلفي وفوقه المحراب بارتفاع ${A} مم؛ الشريط الذهبي يُلصق على وجهه الأمامي فوق مستوى الغطاء`,
    },
    { id: 'side', name: N.side, w: D, h: H, bottom: 'female', left: 'female', right: 'female', count: 2, holes: sideHoles, note: wallNote },
  ]

  // ---- the lid: a plate on the front and sides, butting against the arch, with the knob hole and the lozenge's outline engraved
  const Dlid = D - t, lcx = W / 2, lcy = Dlid / 2
  const lw = Math.round(Math.min(0.3 * W, 0.6 * Dlid)), lh = Math.round((2 * lw) / 3)
  const deco = p.lidDeco > 0 && lw >= 30
  if (p.lidDeco > 0 && !deco) warnings.push('الغطاء صغير على المعيّن الذهبي فأُسقط؛ يبقى ثقب المقبض.')
  if (knob + 6 > Math.min(Wl, Dl) / 2) errors.push(`ثقب المقبض (${knob} مم) كبير على هذا الغطاء.`)
  const rk = knob / 2
  const lidEngrave: Loop[] = deco ? [{ ...lozenge(lcx, lcy, lw, lh), layer: 'engrave' }] : []
  panels.push(
    {
      id: 'lid', name: 'الغطاء — اللوح', w: W, h: Dlid, holes: [circle(lcx, lcy, rk)], engrave: lidEngrave,
      note: `يغطّي الواجهة والجانبين ويستند إلى وجه المحراب؛ ثقب المقبض في وسطه${deco ? ' والخط المحفور موضع المعيّن الذهبي' : ''}`,
    },
    lipJoint
      ? { id: 'lip-fb', name: 'شفة الغطاء — الأمام / الخلف', w: Wl, h: lipH, left: 'male', right: 'male', count: 2 }
      : { id: 'lip-fb', name: 'شفة الغطاء — الأمام / الخلف', w: Wl, h: lipH, count: 2, note: 'بطول الإطار كاملاً؛ الجانبان يُلصقان بينهما' },
    lipJoint
      ? { id: 'lip-side', name: 'شفة الغطاء — الجانب', w: Dl, h: lipH, left: 'female', right: 'female', count: 2 }
      : { id: 'lip-side', name: 'شفة الغطاء — الجانب', w: Dl - 2 * t, h: lipH, count: 2, note: 'أقصر من عمق الإطار بسماكتين؛ يدخل بين قطعتي الأمام والخلف' },
  )
  if (deco) {
    // the gold lozenge: its own knob hole, and a small rosette fret round it (the lattice centred on its small four-pointed star, which the knob replaces)
    const lz = lozenge(lcx, lcy, lw, lh), inner = outlinePts(offsetLoop(lz, -2.5), 1.5)
    const keep = rk + 2.5
    const Pd = lh / 3.5, m = Math.ceil(lw / 2 / Pd) + 1
    const field = rosettes(lcx - (m + 0.5) * Pd, lcy - (m + 0.5) * Pd, lcx + (m + 0.5) * Pd, lcy + (m + 0.5) * Pd, Pd / 3, regionClipper(inner))
    const holes = field.filter(h => outlinePts(h, 1.5).every(q => Math.hypot(q.x - lcx, q.y - lcy) > keep))
    const small = holes.length < 4
    panels.push({
      id: 'lozenge', name: 'المعيّن الذهبي للغطاء', w: lw, h: lh, material: 'gold', shape: [lz],
      holes: [circle(lcx, lcy, rk), ...(small ? [] : holes)],
      engrave: small ? [{ ...offsetLoop(lz, -Math.max(3, lh / 8)), layer: 'engrave' }] : [],
      note: 'يُثبّت تحت المقبض على الغطاء؛ رأساه الطويلان نحو الجانبين',
    })
  }

  // ---- the gold band: the arch outline inset by the band width, cut off just above the lid, with a fret bent along it
  const bandOuter = insetPath(arch.pts, W, 0, hb), bandInner = insetPath(arch.pts, W, bu, hb)
  const toBand = (q: P2) => ({ x: round3(q.x), y: round3(Au - q.y) })
  const bandShape = polyLoop([...bandOuter.map(toBand), ...bandInner.slice().reverse().map(toBand)], 'outer')
  const bandHoles: Loop[] = [], bandEngrave: Loop[] = []
  // the fret bent along the band: a chain of motifs on the band's centre line, each at least `mg` from both edges; cut
  // when the band is wide enough for the motifs to survive, engraved (closer to the edges, smaller) otherwise
  const bandFret = (mg: number): Loop[] => {
    const zone = bu - 2 * mg, out: Loop[] = []
    if (zone < 6) return out
    const hOut = envelope(insetPath(arch.pts, W, mg - 0.5, hb + mg - 0.5), W), hIn = envelope(insetPath(arch.pts, W, bu - mg + 0.5, hb), W)
    const inBand = (q: P2) => q.y >= hb + mg - 0.5 && q.y <= hOut(q.x) && q.y > hIn(q.x)
    const strip = bentStrip(insetPath(arch.pts, W, bu / 2, hb))
    const R = zone / 2
    // the first motif above the band's bottom, the last far enough from the apex that its mirror image keeps a strap away
    const u0 = R + mg, u1 = strip.L - (R * Math.cos(arch.alpha) + 1.25 + 0.5) / Math.sin(arch.alpha)
    const bk = kind === 3 ? 7 : kind
    if (u1 - u0 < 0) return out
    const cnt = Math.floor((u1 - u0) / zone) + 1, uc0 = u0 + (u1 - u0 - (cnt - 1) * zone) / 2
    const stripRect = [{ x: mg, y: -zone / 2 }, { x: u1 + R, y: -zone / 2 }, { x: u1 + R, y: zone / 2 }, { x: mg, y: zone / 2 }]
    // motifs cut by the strip's ends keep only when most of them is left (a sliver of a star looks like a mistake)
    const clipStrip = regionClipper(stripRect), clipBand = (face: P2[]) => { const r = clipStrip(face); return r.length >= 3 && polyArea(r) >= 0.5 * polyArea(face) ? r : [] }
    // engraved straps are fine lines: the faces shrink by less than the cut ones do
    const raw = bk === 7 ? rosettes(uc0 - zone, -zone, uc0 + cnt * zone, zone, zone / 3, clipBand, mg < 2 ? 1 : undefined, c => Math.abs(c.y) < 0.8 * zone && c.x > -0.8 * zone && c.x < u1 + R + 0.8 * zone)
      : pattern(bk, uc0 - R, -zone / 2, uc0 + (cnt - 1) * zone + R, zone / 2, bk === 2 ? zone / 3 : 0.8 * zone)
    for (const h of raw) {
      const bent = outlinePts(h, 2).map(q => strip.map(q.x, q.y))
      if (!bent.every(inBand)) continue
      // nothing reaches the middle: the right leg is the mirror image, and a strap must stay between the two
      if (Math.max(...bent.map(q => q.x)) > W / 2 - 1.25) continue
      out.push(polyLoop(bent.map(toBand), 'hole'), polyLoop(bent.map(q => ({ x: W - q.x, y: q.y })).map(toBand), 'hole'))
    }
    return out
  }
  let bandCut = false
  if (kind > 0) {
    const cut = bu >= 14 ? bandFret(2.5) : []
    if (cut.length >= 6) { bandCut = true; bandHoles.push(...cut) } else for (const l of bandFret(1)) bandEngrave.push({ ...l, layer: 'engrave' })
  }
  const bandDeco = bandHoles.length > 0 || bandEngrave.length > 0
  panels.push({
    id: 'band', name: 'الشريط الذهبي للمحراب', w: W, h: Au - hb, material: 'gold', shape: [bandShape], holes: bandHoles, engrave: bandEngrave,
    note: `يُلصق على وجه المحراب الأمامي مع حافّته الخارجية؛ طرفاه ينتهيان ${f1(hb)} مم فوق حافّة العلبة (فوق سطح الغطاء)`,
  })
  for (const pn of panels) pn.count = (pn.count ?? 1) * n

  const notes = [
    `العلبة ${W} × ${D} × ${H} مم، والمحراب يرتفع ${A} مم فوقها (الارتفاع الكلّي ${f1(H + A)} مم بلا الأرجل). الغطاء ${W} × ${f1(Dlid)} مم يجلس على الواجهة والجانبين ويستند بحافّته الخلفية إلى وجه المحراب، فلا يفتح إلا رفعاً.`,
    `التركيب: ركّب الواجهة الأمامية والخلفية (بالمحراب) مع الجانبين على القاعدة بالتعشيق والغراء. ${lipJoint ? 'عشّق' : 'ألصق'} إطار الشفة (${f1(Wl)} × ${f1(Dl)} × ${lipH} مم${lipJoint ? '' : '؛ زواياه ملصوقة لأن الشفة أقصر من ثلاث سماكات'}) وضعه داخل العلبة، ادهن حافّته العلوية بالغراء وأنزل لوح الغطاء عليه وهو في مكانه، فيلتصق في موضعه الصحيح بخلوص ${gap} مم من كل جهة.`,
    `الشريط الذهبي يُلصق على وجه المحراب الأمامي بحيث تنطبق حافّته الخارجية على حافّة المحراب؛ ينتهي طرفاه ${f1(hb)} مم فوق حافّة العلبة فلا يعيق الغطاء.${bandDeco && !bandCut ? ' الشريط ضيّق على التخريم فزخرفته محفورة؛ من نحو 18 مم فأكثر تُخرَّم.' : ''}`,
    `المستلزمات: مقبض نحاسي ببرغي قطره ${knob} مم (يمرّ في ثقب الغطاء${deco ? ' والمعيّن الذهبي؛ البرغي نفسه يثبّت المعيّن في مكانه' : ''})، أربعة أرجل نحاسية تُلصق أو تُبرغى على الدوائر المحفورة تحت القاعدة، غراء أكريليك (كلوروفورم) أو غراء فوري شفّاف للشريط والمعيّن.`,
    kind > 0 ? 'الزخرفة تبتعد عن التعشيق وعن منطقة الشفة؛ في الأكريليك اجعل حجمها 10 مم أو أكثر. يمكن قصّ الجسم من الأكريليك الأبيض والشريط والمعيّن من المرآة الذهبية كما في الصورة.' : 'الجدران بلا زخرفة؛ يبقى الشريط الذهبي على المحراب.',
  ]
  return { panels, notes, warnings, errors }
}

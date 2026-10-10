// A handled gift box (علبة هدايا بمقبض): an open-top finger-jointed box whose front and back panels carry on above
// the body into two handle panels. A living-hinge band right above the body lets each handle lean inward so the two
// meet at the top; above the band every handle has rounded top corners and a hand hole. The sides' top corners are
// rounded too (as in the photo). Fretwork fills the walls and the handles, and the front carries a blank plaque with
// an engraved ornamental frame (the text is added in RDWorks).
//
// Panel coordinates are millimetres, y down. On the front and the back the handle is at the top (y = 0), then the
// hinge band, then the body with its finger joints; the body alone is jointed to the sides and the bottom, the side
// joints starting below the sides' rounded corners (above them the front and back keep the corner column).
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Vtx, arcInfo, offsetLoop, rect, circle, stadium, stadiumV, heart, roundedRectHole, rotatedRectHole, polyLoop, roundCorner, hingeLines, round3, bbox } from './geom'
import type { PanelSpec, EdgeSpec } from './joints'

type P2 = { x: number; y: number }
const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', hint })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const DEG = Math.PI / 180

// ------------------------------------------------------------------ polygon helpers (raw coordinates, y down)

const areaOf = (p: P2[]) => { let a = 0; for (let i = 0, n = p.length; i < n; i++) { const u = p[i], v = p[(i + 1) % n]; a += u.x * v.y - v.x * u.y } return a / 2 }
const perimOf = (p: P2[]) => { let s = 0; for (let i = 0, n = p.length; i < n; i++) { const u = p[i], v = p[(i + 1) % n]; s += Math.hypot(v.x - u.x, v.y - u.y) } return s }
/** how wide a polygon is across, roughly: a circle's diameter, a long strip's width */
const widthOf = (p: P2[]) => (p.length < 3 ? 0 : (4 * Math.abs(areaOf(p))) / perimOf(p))
const bboxOf = (p: P2[]) => ({ x0: Math.min(...p.map(q => q.x)), x1: Math.max(...p.map(q => q.x)), y0: Math.min(...p.map(q => q.y)), y1: Math.max(...p.map(q => q.y)) })

function pointIn(q: P2, poly: P2[]): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > q.y) !== (b.y > q.y) && q.x < a.x + ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y)) c = !c
  }
  return c
}
/** consecutive points closer than eps merged (the last against the first too) */
function dedupe(p: P2[], eps = 1e-6): P2[] {
  const out: P2[] = []
  for (const q of p) { const l = out[out.length - 1]; if (!l || Math.hypot(l.x - q.x, l.y - q.y) > eps) out.push(q) }
  while (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= eps) out.pop()
  return out
}
/** points on the straight line through their neighbours dropped (closed polygon) */
function dropCollinear(p: P2[]): P2[] {
  let out = p
  let changed = true
  while (changed && out.length > 3) {
    changed = false
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length]
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)
      if (Math.abs(cross) < 1e-7 && dot > 0) { out = [...out.slice(0, i), ...out.slice(i + 1)]; changed = true; break }
    }
  }
  return out
}
const orient3 = (a: P2, b: P2, c: P2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
function segsCross(a: P2, b: P2, c: P2, d: P2): boolean {
  const o1 = orient3(a, b, c), o2 = orient3(a, b, d), o3 = orient3(c, d, a), o4 = orient3(c, d, b)
  return o1 * o2 < -1e-12 && o3 * o4 < -1e-12
}
function selfCrosses(p: P2[]): boolean {
  const n = p.length
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue
    if (segsCross(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return true
  }
  return false
}
/** a closed loop with bulges as a dense polygon (arcs stepped every ~stepDeg) */
function sample(l: Loop, stepDeg = 6): P2[] {
  const out: P2[] = [], n = l.pts.length
  for (let i = 0; i < n; i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n]
    out.push({ x: p.x, y: p.y })
    if (p.b) {
      const a = arcInfo(p, q, p.b), m = Math.max(3, Math.ceil(a.theta / (stepDeg * DEG)))
      for (let k = 1; k < m; k++) { const ang = a.a0 + (a.ccw ? -1 : 1) * a.theta * k / m; out.push({ x: a.c.x + a.r * Math.cos(ang), y: a.c.y + a.r * Math.sin(ang) }) }
    }
  }
  return out
}
/** Bulge of the arc from p to q whose middle point is m (b > 0 bows to the right of p → q on screen, as in geom.ts). */
function bulgeThrough(p: P2, q: P2, m: P2): number {
  const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy)
  const s = ((m.x - (p.x + q.x) / 2) * -dy + (m.y - (p.y + q.y) / 2) * dx) / L
  return (2 * s) / L
}
/** The part of a polygon inside the rectangle (Sutherland–Hodgman; exact for polygons a line meets twice at most). */
function clipRect(poly: P2[], x0: number, y0: number, x1: number, y1: number): P2[] {
  let pts = poly
  for (const [ax, sg, lim] of [['x', 1, x0], ['x', -1, x1], ['y', 1, y0], ['y', -1, y1]] as const) {
    const inside = (v: P2) => sg * (v[ax] - lim) >= 0, res: P2[] = []
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
/** A rounded rectangle as a polygon, corner arcs stepped every ~6°. */
function roundedRectPoly(x: number, y: number, w: number, h: number, r: number): P2[] {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  const out: P2[] = []
  const corners = [{ cx: x + w - r, cy: y + r, a0: -Math.PI / 2 }, { cx: x + w - r, cy: y + h - r, a0: 0 }, { cx: x + r, cy: y + h - r, a0: Math.PI / 2 }, { cx: x + r, cy: y + r, a0: Math.PI }]
  const k = r > 0.05 ? 15 : 0
  for (const c of corners) {
    if (k === 0) { out.push({ x: c.cx, y: c.cy }); continue }
    for (let i = 0; i <= k; i++) { const a = c.a0 + ((Math.PI / 2) * i) / k; out.push({ x: c.cx + r * Math.cos(a), y: c.cy + r * Math.sin(a) }) }
  }
  return dedupe(out)
}

/**
 * The polygon H less the convex polygon C (keep 'out'), or the part of H inside C (keep 'in'): pieces bounded by H's
 * edges outside (inside) C and runs along C's boundary (Weiler–Atherton). H's interior is kept on the left of travel;
 * C is walked with its interior on the right to go round it, on the left to follow it, so every piece comes out with
 * H's orientation. Null when the crossings do not pair up (a touching vertex, say).
 */
function clipConvex(H0: P2[], C0: P2[], keep: 'out' | 'in'): P2[][] | null {
  const inMode = keep === 'in'
  const H = areaOf(H0) > 0 ? H0 : [...H0].reverse(), C = (areaOf(C0) < 0) !== inMode ? C0 : [...C0].reverse()
  const n = H.length, m = C.length, cb = bboxOf(C)
  type X = { i: number; t: number; pos: number; p: P2; visited: boolean; exit: boolean }
  const xs: X[] = []
  for (let i = 0; i < n; i++) {
    const a = H[i], b = H[(i + 1) % n]
    if (Math.max(a.x, b.x) < cb.x0 || Math.min(a.x, b.x) > cb.x1 || Math.max(a.y, b.y) < cb.y0 || Math.min(a.y, b.y) > cb.y1) continue
    for (let j = 0; j < m; j++) {
      const c = C[j], d = C[(j + 1) % m]
      const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
      if (Math.abs(den) < 1e-12) continue
      const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den, u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den
      if (t < 0 || t >= 1 || u < 0 || u >= 1) continue
      xs.push({ i, t, pos: j + u, p: { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }, visited: false, exit: false })
    }
  }
  const none = () => (inMode ? (pointIn(H[0], C) ? [H] : pointIn(C[0], H) ? [C] : []) : pointIn(H[0], C) || pointIn(C[0], H) ? [] : [H])
  if (!xs.length) return none()
  // the hole's vertices and crossings in order; each crossing must change side, else it only touches
  type Node = { p: P2; x?: X }
  const seq: Node[] = []
  // a crossing on a vertex (or two crossings reported at one point) is one node, so no zero-length sub-edge decides a side
  const push = (nd: Node) => {
    const last = seq[seq.length - 1]
    if (last && Math.hypot(last.p.x - nd.p.x, last.p.y - nd.p.y) < 1e-7) { if (nd.x && !last.x) last.x = nd.x; return }
    seq.push(nd)
  }
  for (let i = 0; i < n; i++) {
    push({ p: H[i] })
    for (const x of xs.filter(q => q.i === i).sort((a, b) => a.t - b.t)) push({ p: x.p, x })
  }
  if (seq.length > 1 && Math.hypot(seq[0].p.x - seq[seq.length - 1].p.x, seq[0].p.y - seq[seq.length - 1].p.y) < 1e-7) { if (seq[seq.length - 1].x && !seq[0].x) seq[0].x = seq[seq.length - 1].x; seq.pop() }
  const N = seq.length
  if (N < 3) return null
  const insideAfter = (k: number) => { const a = seq[k].p, b = seq[(k + 1) % N].p; return pointIn({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, C) }
  const live: X[] = []
  for (let k = 0; k < N; k++) {
    const x = seq[k].x
    if (!x) continue
    const before = insideAfter((k + N - 1) % N), after = insideAfter(k)
    if (before === after) { seq[k].x = undefined; continue }
    x.exit = !after
    live.push(x)
  }
  if (live.length % 2) return null
  if (!live.length) return none()
  const after = (x: X): X => { let best: X | null = null, bd = Infinity; for (const y of live) { if (y === x) continue; const d = ((y.pos - x.pos) % m + m) % m; if (d < bd) { bd = d; best = y } } return best! }
  const pieces: P2[][] = []
  for (const start of live) {
    if (start.visited || start.exit === inMode) continue
    const piece: P2[] = [start.p]
    let cur = start
    for (let guard = 0; guard <= live.length; guard++) {
      cur.visited = true
      let k = seq.findIndex(nd => nd.x === cur), entry: X | undefined
      for (let s = 0; s < N; s++) { k = (k + 1) % N; const nd = seq[k]; piece.push(nd.p); if (nd.x) { entry = nd.x; break } }
      if (!entry || entry.exit !== inMode) return null
      entry.visited = true
      const next = after(entry), span = ((next.pos - entry.pos) % m + m) % m
      for (let jj = Math.floor(entry.pos) + 1; ; jj++) {
        const off = ((jj - entry.pos) % m + m) % m
        if (off >= span - 1e-9) break
        piece.push(C[((jj % m) + m) % m])
      }
      if (next === start) break
      if (next.exit === inMode) return null
      piece.push(next.p)
      cur = next
      if (guard === live.length) return null
    }
    pieces.push(piece)
  }
  if (live.some(x => !x.visited)) return null
  return pieces
}
const subtractConvex = (H: P2[], C: P2[]) => clipConvex(H, C, 'out')
/**
 * Corners sharper than minDeg are cut off: the outline is trimmed back along its path either side of the corner (over
 * as many short edges as that takes), far enough that the new edge across is at least minEdge long. A sliver point
 * burns, and the kerf offset would spike it.
 */
function trimAcute(p: P2[], minEdge: number, minDeg = 40): P2[] {
  let pts = p
  const cosMin = Math.cos(minDeg * DEG)
  for (let pass = 0; pass < 16; pass++) {
    const n = pts.length
    if (n < 4) return pts
    let i = -1, cosA = 0
    for (let k = 0; k < n && i < 0; k++) {
      const a = pts[(k + n - 1) % n], b = pts[k], d = pts[(k + 1) % n]
      const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(d.x - b.x, d.y - b.y)
      if (l1 < 1e-9 || l2 < 1e-9) continue
      const cs = ((a.x - b.x) * (d.x - b.x) + (a.y - b.y) * (d.y - b.y)) / (l1 * l2)
      if (cs > cosMin) { i = k; cosA = cs }
    }
    if (i < 0) return pts
    const half = Math.acos(Math.max(-1, Math.min(1, cosA))) / 2
    const c = Math.max(1.2, minEdge / (2 * Math.max(Math.sin(half), 0.05)) + 0.2)
    // walk c along the path from the corner, forward and back: the cut point and the first vertex kept beyond it
    const walk = (dir: 1 | -1) => {
      let acc = 0, k = i
      for (let s = 1; s < n; s++) {
        const a = pts[k], b = pts[(k + dir + n) % n], l = Math.hypot(b.x - a.x, b.y - a.y)
        if (acc + l >= c) { const u = (c - acc) / l; return { steps: s, keep: (k + dir + n) % n, cut: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u } } }
        acc += l
        k = (k + dir + n) % n
      }
      return null
    }
    const fw = walk(1), bk = walk(-1)
    if (!fw || !bk || fw.steps + bk.steps >= n) return pts
    const out: P2[] = [fw.cut]
    for (let k = fw.keep; ; k = (k + 1) % n) { out.push(pts[k]); if (k === bk.keep) break }
    out.push(bk.cut)
    pts = out
  }
  return pts
}
/** narrowest clipped hole worth cutting: this wide across, and this wide in both directions */
const MIN_HOLE = 2.5, MIN_SPAN = 3
/**
 * A clipped polygon as a hole loop, or null when it is a sliver, too small or not simple. Edges shorter than minEdge
 * are merged away and sharp corners trimmed first: the kerf offset shortens every edge at its corners, and an edge
 * shorter than that flips into a hook.
 */
function asHole(p: P2[], minEdge: number): Loop | null {
  let pts = dedupe(p.map(q => ({ x: round3(q.x), y: round3(q.y) })), minEdge)
  pts = dropCollinear(dedupe(trimAcute(pts, minEdge), minEdge))
  if (pts.length < 3 || Math.abs(areaOf(pts)) < 6 || widthOf(pts) < MIN_HOLE) return null
  const b = bboxOf(pts)
  if (Math.min(b.x1 - b.x0, b.y1 - b.y0) < MIN_SPAN || selfCrosses(pts)) return null
  return polyLoop(pts, 'hole')
}

// ------------------------------------------------------------------ the fret patterns

/** The polyline moved sideways by d (to the left of travel on screen when d > 0), corners mitred. */
function offsetPolyline(pts: P2[], closed: boolean, d: number): P2[] {
  const n = pts.length, seg = (i: number) => { const a = pts[i], b = pts[(i + 1) % n], l = Math.hypot(b.x - a.x, b.y - a.y); return { a, b, nx: (b.y - a.y) / l, ny: -(b.x - a.x) / l } }
  const segs = Array.from({ length: closed ? n : n - 1 }, (_, i) => seg(i))
  const at = (s: ReturnType<typeof seg>, p: P2) => ({ x: p.x + s.nx * d, y: p.y + s.ny * d })
  const out: P2[] = []
  for (let i = 0; i < n; i++) {
    const s0 = closed ? segs[(i - 1 + n) % n] : segs[i - 1], s1 = closed ? segs[i % n] : segs[i]
    if (!s0) { out.push(at(s1, pts[i])); continue }
    if (!s1) { out.push(at(s0, pts[i])); continue }
    const bx = s0.nx + s1.nx, by = s0.ny + s1.ny, k = (s0.nx * s1.nx + s0.ny * s1.ny + 1) / 2
    out.push(k > 1e-9 ? { x: pts[i].x + (bx / 2 / k) * d, y: pts[i].y + (by / 2 / k) * d } : at(s1, pts[i]))
  }
  return out
}

/**
 * Islamic eight-fold rosettes in strapwork (the same construction as the lantern and the deco box): Hankin's method
 * on the 4.8.8 tiling, every face shrunk by half the strap width and cut out.
 */
function rosettes(x0: number, y0: number, x1: number, y1: number, cell: number): Loop[] {
  const nx = Math.max(1, Math.round((x1 - x0) / (3 * cell))), Pd = (x1 - x0) / nx, ny = Math.floor((y1 - y0) / Pd)
  if (ny < 1) return []
  const w = Math.max(2.5, 0.075 * Pd), th = (67.5 * Math.PI) / 180
  const ys = (y0 + y1) / 2 - (ny * Pd) / 2, ye = ys + ny * Pd
  y0 = ys; y1 = ye
  type V = { x: number; y: number }
  const rot = (v: V, a: number) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) })
  const meet = (p: V, u: V, q: V, v: V) => { const den = u.x * v.y - u.y * v.x, k = ((q.x - p.x) * v.y - (q.y - p.y) * v.x) / den; return { x: p.x + k * u.x, y: p.y + k * u.y } }
  const key = (v: V) => `${Math.round(v.x * 1000)},${Math.round(v.y * 1000)}`
  const faces: V[][] = []
  const around = new Map<string, { at: V; pts: V[] }>()
  const tiles: V[][] = []
  const R8 = 0.5 / Math.cos(Math.PI / 8), s4 = 0.5 - 0.5 * Math.tan(Math.PI / 8)
  for (let i = -1; i <= nx + 1; i++) for (let j = -1; j <= ny + 1; j++) {
    tiles.push(Array.from({ length: 8 }, (_, k) => ({ x: i + R8 * Math.cos(Math.PI / 8 + (k * Math.PI) / 4), y: j + R8 * Math.sin(Math.PI / 8 + (k * Math.PI) / 4) })))
    tiles.push([{ x: i + 0.5 + s4, y: j + 0.5 }, { x: i + 0.5, y: j + 0.5 + s4 }, { x: i + 0.5 - s4, y: j + 0.5 }, { x: i + 0.5, y: j + 0.5 - s4 }])
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
  const toField = (v: V) => ({ x: x0 + v.x * Pd, y: ys + v.y * Pd })
  for (const f of faces) {
    const fp = clipRect(f.map(toField), x0, y0, x1, y1)
    if (fp.length < 3) continue
    const dd = dedupe(fp)
    if (dd.length < 3) continue
    const A = areaOf(dd), ins = offsetPolyline(dd, true, A > 0 ? -w / 2 : w / 2)
    const Ai = areaOf(ins)
    if (Math.sign(Ai) !== Math.sign(A) || Math.abs(Ai) < 4 || selfCrosses(ins)) continue
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

/** The grid patterns of the deco box: 1 circles, 2 vertical slots, 4 hearts, 5 diamonds, 6 eight-pointed stars, 7 rosettes. */
function pattern(kind: number, x0: number, y0: number, x1: number, y1: number, cell: number): Loop[] {
  const fw = x1 - x0, fh = y1 - y0
  if (fw < cell * 2 || fh < cell * 2) return []
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

/** the ogee tile's proportions (height over width) and its strap as a share of the tile width */
const OGEE = { aspect: 1.5, strap: 0.14 }

/**
 * The interlocking ogee lattice of the photo: onion-shaped tiles (a point top and bottom, S-curved sides of two
 * tangent arcs) in two half-offset lattices, every tile shrunk by half the strap width and cut out. A whole number of
 * columns spans the field, the rows are stretched to fill its height, and the tiles are clipped at its edges.
 */
function ogee(x0: number, y0: number, x1: number, y1: number, cell: number, minEdge: number): Loop[] {
  const fw = x1 - x0, fh = y1 - y0
  if (fw < 0.8 * cell || fh < 1.2 * cell) return []
  const nx = Math.max(1, Math.round(fw / cell)), P = fw / nx
  const ny = Math.max(1, Math.round(fh / (OGEE.aspect * P))), Ht = fh / ny
  const web = Math.max(2.2, OGEE.strap * P), a = P / 2, h = Ht / 2
  // each side is two tangent arcs of the same bend; the bend that makes the tile's points cusps (the curve there
  // runs on smoothly into the neighbouring tile's widest point, as in the real ogee lattice)
  const bulge = Math.tan(Math.atan(a / h) / 2)
  const mid = (p: P2, q: P2) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })
  const tile = (cx: number, cy: number): Loop => {
    const corners = [{ x: cx, y: cy - h }, { x: cx + a, y: cy }, { x: cx, y: cy + h }, { x: cx - a, y: cy }]
    const arcPt = (p: P2, q: P2, inward: boolean): Vtx => {
      const chord = Math.hypot(q.x - p.x, q.y - p.y), s = (bulge * chord) / 2, cm = mid(p, q)
      let nx = -(q.y - p.y) / chord, ny = (q.x - p.x) / chord
      if (((cx - cm.x) * nx + (cy - cm.y) * ny > 0) !== inward) { nx = -nx; ny = -ny }
      return { x: p.x, y: p.y, b: bulgeThrough(p, q, { x: cm.x + s * nx, y: cm.y + s * ny }) }
    }
    const pts: Vtx[] = []
    for (let k = 0; k < 4; k++) {
      const p = corners[k], q = corners[(k + 1) % 4], m = mid(p, q)
      // from a point (top, bottom) the side first bows inward, then outward to the widest point; and back the same way
      pts.push(arcPt(p, m, k % 2 === 0), arcPt(m, q, k % 2 !== 0))
    }
    return polyLoop(pts, 'hole')
  }
  // every tile is the same shape: one hole is built and shrunk at the origin, then copied to each centre; only the
  // copies that cross the field's edge are sampled and clipped
  const base = offsetLoop(tile(0, 0), web / 2), bb = bbox([base]), basePoly = sample(base)
  const out: Loop[] = []
  const place = (c: P2) => {
    if (c.x + bb.minX >= x0 && c.x + bb.maxX <= x1 && c.y + bb.minY >= y0 && c.y + bb.maxY <= y1) { out.push({ closed: true, pts: base.pts.map(v => ({ ...v, x: round3(v.x + c.x), y: round3(v.y + c.y) })) }); return }
    if (c.x + bb.maxX <= x0 || c.x + bb.minX >= x1 || c.y + bb.maxY <= y0 || c.y + bb.minY >= y1) return
    const cut = clipRect(basePoly.map(q => ({ x: q.x + c.x, y: q.y + c.y })), x0, y0, x1, y1)
    if (cut.length < 3) return
    const l = asHole(cut, minEdge)
    if (l) out.push(l)
  }
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    if (i < nx && j < ny) place({ x: x0 + (i + 0.5) * P, y: y0 + (j + 0.5) * Ht })
    place({ x: x0 + i * P, y: y0 + j * Ht })
  }
  return out
}

/** what the fret must stay inside: a convex polygon and the boxes where it differs from the field's rectangle */
type Keep = { poly: P2[]; corners: { x0: number; y0: number; x1: number; y1: number }[] }
/**
 * The fret of `kind` (0 = ogee, else a deco-box pattern) in the field; holes meeting `zone` (a convex polygon) are
 * clipped round it, and holes reaching into a corner of `keep` (the field with rounded corners) are clipped to it
 * (the lattices, clipped at the field's edges anyway), shortened (slots) or left out (whole motifs). Clipped outlines
 * keep no edge shorter than minEdge (set from the kerf).
 */
function fret(kind: number, x0: number, y0: number, x1: number, y1: number, cell: number, minEdge: number, zone?: P2[], keep?: Keep): Loop[] {
  let raw = kind === 0 ? ogee(x0, y0, x1, y1, cell, minEdge) : pattern(kind, x0, y0, x1, y1, cell)
  // a vertex exactly on the polygon's boundary can defeat the walk: the polygon a hair bigger (smaller) clips just as well
  const nudge = (poly: P2[], d: number) => { const b = bboxOf(poly), mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2; return poly.map(q => ({ x: q.x + (q.x > mx ? d : -d), y: q.y + (q.y > my ? 0.85 * d : -0.85 * d) })) }
  if (keep) {
    // inside tests a hair generous: the field's own edges are on the polygon's boundary
    const out: Loop[] = [], roomy = nudge(keep.poly, 0.02)
    for (const hl of raw) {
      const b = bbox([hl])
      if (!keep.corners.some(c => b.maxX > c.x0 && b.minX < c.x1 && b.maxY > c.y0 && b.minY < c.y1)) { out.push(hl); continue }
      const poly = sample(hl)
      if (poly.every(q => pointIn(q, roomy))) { out.push(hl); continue }
      if (kind === 2) {
        // a vertical slot is shortened from its top until it fits under the rounded corner
        const w = b.maxX - b.minX, cx = (b.minX + b.maxX) / 2, slot = (top: number) => stadiumV(cx, (top + b.maxY) / 2, b.maxY - top, w)
        const fits = (top: number) => sample(slot(top)).every(q => pointIn(q, roomy))
        let lo = b.minY, hi = b.maxY - 1.5 * w
        if (hi <= lo || !fits(hi)) continue
        for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m }
        out.push(slot(round3(hi + 0.01)))
        continue
      }
      if (kind !== 0 && kind !== 7) continue
      const pieces = clipConvex(poly, keep.poly, 'in') ?? clipConvex(poly, nudge(keep.poly, -0.013), 'in')
      for (const pc of pieces ?? []) { const l = asHole(pc, minEdge); if (l) out.push(l) }
    }
    raw = out
  }
  if (!zone) return raw
  const zb = bboxOf(zone), out: Loop[] = []
  for (const hl of raw) {
    const b = bbox([hl])
    if (b.maxX < zb.x0 - 0.01 || b.minX > zb.x1 + 0.01 || b.maxY < zb.y0 - 0.01 || b.minY > zb.y1 + 0.01) { out.push(hl); continue }
    const poly = sample(hl)
    const pieces = subtractConvex(poly, zone) ?? subtractConvex(poly, nudge(zone, 0.013))
    if (!pieces) continue
    for (const pc of pieces) { const l = asHole(pc, minEdge); if (l) out.push(l) }
  }
  return out
}

/**
 * The field x0..x1 × y0..y1 with its top corners rounded: arcs of radius r about (x0 + r, cy) and (x1 - r, cy), cut
 * by the field's top edge where they rise above it. Sampled inside the true arcs; `corners` box where it differs.
 */
function archField(x0: number, y0: number, x1: number, y1: number, r: number, cy: number): Keep {
  const k = 18, pts: P2[] = [{ x: x0, y: y1 }]
  const arc = (cx: number, a0: number, a1: number) => { for (let i = 0; i <= k; i++) { const a = a0 + ((a1 - a0) * i) / k; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }) } }
  arc(x0 + r, Math.PI, 1.5 * Math.PI)
  arc(x1 - r, 1.5 * Math.PI, 2 * Math.PI)
  pts.push({ x: x1, y: y1 })
  // the field's top edge cuts off what of the arcs rises above it
  const poly = dropCollinear(dedupe(clipRect(pts, x0, y0, x1, y1), 1e-4))
  return { poly, corners: [{ x0: x0 - 1, y0: y0 - 1, x1: x0 + r, y1: cy }, { x0: x1 - r, y0: y0 - 1, x1: x1 + 1, y1: cy }] }
}

// ------------------------------------------------------------------ the plaque's engraved frame

const SCALLOP = 2
/** Two engraved outlines and a row of little engraved scallops hanging outside the outer one. */
function plaqueFrame(x: number, y: number, w: number, h: number, rr: number): Loop[] {
  const out: Loop[] = [{ ...roundedRectHole(round3(x), round3(y), round3(w), round3(h), rr), layer: 'engrave' }]
  const ins = 3
  if (w - 2 * ins >= 10 && h - 2 * ins >= 10) out.push({ ...roundedRectHole(round3(x + ins), round3(y + ins), round3(w - 2 * ins), round3(h - 2 * ins), Math.max(1, rr - ins)), layer: 'engrave' })
  const rs = SCALLOP, sp = 2 * rs + 1
  const scallop = (c: P2, tx: number, ty: number, nx: number, ny: number): Loop => {
    const p0 = { x: c.x - rs * tx, y: c.y - rs * ty }, p1 = { x: c.x + rs * tx, y: c.y + rs * ty }
    return { closed: false, layer: 'engrave', pts: [{ x: round3(p0.x), y: round3(p0.y), b: bulgeThrough(p0, p1, { x: c.x + rs * nx, y: c.y + rs * ny }) }, { x: round3(p1.x), y: round3(p1.y) }] }
  }
  const sides: [P2, P2, P2][] = [
    [{ x: x + rr, y }, { x: x + w - rr, y }, { x: 0, y: -1 }],
    [{ x: x + w, y: y + rr }, { x: x + w, y: y + h - rr }, { x: 1, y: 0 }],
    [{ x: x + w - rr, y: y + h }, { x: x + rr, y: y + h }, { x: 0, y: 1 }],
    [{ x, y: y + h - rr }, { x, y: y + rr }, { x: -1, y: 0 }],
  ]
  for (const [a, b, nrm] of sides) {
    const L = Math.hypot(b.x - a.x, b.y - a.y), k = Math.floor(L / sp)
    if (k < 1) continue
    const tx = (b.x - a.x) / L, ty = (b.y - a.y) / L, start = (L - (k - 1) * sp) / 2
    for (let i = 0; i < k; i++) { const d = start + i * sp; out.push(scallop({ x: a.x + tx * d, y: a.y + ty * d }, tx, ty, nrm.x, nrm.y)) }
  }
  if (rr >= rs + 0.5) {
    const k = Math.floor(((Math.PI / 2) * rr) / sp)
    const centres = [{ x: x + w - rr, y: y + rr, a0: -Math.PI / 2 }, { x: x + w - rr, y: y + h - rr, a0: 0 }, { x: x + rr, y: y + h - rr, a0: Math.PI / 2 }, { x: x + rr, y: y + rr, a0: Math.PI }]
    for (const c of centres) for (let i = 0; i < k; i++) {
      const ang = c.a0 + ((i + 0.5) * (Math.PI / 2)) / k, nx = Math.cos(ang), ny = Math.sin(ang)
      out.push(scallop({ x: c.x + rr * nx, y: c.y + rr * ny }, -ny, nx, nx, ny))
    }
  }
  return out
}

// ------------------------------------------------------------------ the template

const PATTERNS = ['أوجي متشابك (كالصورة)', 'دوائر', 'قلوب', 'معيّنات', 'نجوم ثمانية', 'وردات إسلامية', 'شقوق عمودية']
/** the option index → the pattern kind (0 = ogee, else the deco-box kind) */
const KIND = [0, 1, 4, 5, 6, 7, 2]

const PARAMS: ParamDef[] = [
  mm('W', 'العرض', 80, 400), mm('D', 'العمق', 40, 300), mm('H', 'ارتفاع الجسم', 40, 400, 'الصندوق نفسه، تحت شريط المفصل'),
  mm('hh', 'ارتفاع المقبض', 60, 250, 'فوق شريط المفصل، حتى قمّته'),
  mm('band', 'ارتفاع شريط المفصل', 10, 80, 'الشريط المخطّط بين الجسم والمقبض الذي ينثني عليه المقبض'),
  mm('hand', 'طول فتحة اليد', 40, 200),
  { key: 'pattern', label: 'الزخرفة', min: 1, max: 7, step: 1, int: true, options: PATTERNS },
  mm('cell', 'حجم الزخرفة', 8, 40, 'عرض الخلية الواحدة؛ تُمدّ قليلاً ليملأ عدد صحيح منها الجدار'),
  { key: 'plaque', label: 'لوحة الإهداء على الواجهة', min: 0, max: 1, step: 1, int: true, hint: 'مستطيل مصمت بإطار محفور مزخرف، يبقى فارغاً لتكتب فيه في RDWorks' },
  mm('pw', 'عرض اللوحة', 20, 200), mm('ph', 'ارتفاع اللوحة', 15, 150),
  mm('seg', 'طول قصّة المفصل', 5, 80), mm('bridge', 'الجسر بين القصّات', 1, 10), mm('pitch', 'المسافة بين الصفوف', 0.6, 6),
  { key: 'n', label: 'العدد', min: 1, max: 20, step: 1, int: true },
]
const DEFAULTS = { W: 150, D: 110, H: 130, hh: 130, band: 30, hand: 95, pattern: 1, cell: 19, plaque: 1, pw: 75, ph: 60, seg: 20, bridge: 3, pitch: 1.5, n: 1 }

const DIM_NAMES: Record<string, string> = { W: 'العرض', D: 'العمق', H: 'الارتفاع' }
/** wood to keep above and beside the hand hole */
const HAND_WEB = 12

/** the hand hole's height and the wood above it, for a handle hh tall */
const holeH = (hh: number) => round3(Math.min(30, Math.max(22, 0.25 * hh)))
const woodAbove = (hh: number) => round3(Math.max(HAND_WEB, 0.12 * hh))
const LIM = Object.fromEntries(PARAMS.map(d => [d.key, d])) as Record<string, ParamDef>

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = [], notes: string[] = []
  const t = c.t, { W, D, H, hh, band, hand, cell, seg, bridge, pitch } = p
  const n = Math.round(p.n), kind = KIND[Math.min(7, Math.max(1, Math.round(p.pattern))) - 1], plaque = Math.round(p.plaque) > 0
  for (const k of ['W', 'D', 'H']) if (p[k] < 4 * t) errors.push(`${DIM_NAMES[k]} (${p[k]} مم) أصغر من أربع سماكات (${4 * t} مم)؛ لا مكان للتعشيق.`)
  if (c.kerf > t / 2) warnings.push('عرض الشق (kerf) كبير بشكل غير معتاد.')
  /** the first value from v up (or down) to the field's limit that passes, or NaN */
  const search = (key: string, v: number, ok: (x: number) => boolean, dir: 1 | -1 = 1, step = 1) => {
    const lim = dir > 0 ? LIM[key].max : LIM[key].min
    for (let x = dir > 0 ? Math.ceil(v / step) * step : Math.floor(v / step) * step; dir > 0 ? x <= lim + 1e-9 : x >= lim - 1e-9; x += dir * step) if (ok(x)) return round3(x)
    return NaN
  }
  const or = (parts: string[]) => parts.filter(Boolean).join(' أو ')

  // -------------------------------------------------------------- the handle: rounded top corners, a hand hole
  const fm = round3(2 * t + 2)                                  // solid margin along every edge
  const mb = round3(Math.max(4, t + 2))                         // solid strip either side of the hinge band
  const rcOf = (w: number) => round3(Math.min(25, w / 6, hh / 4))
  const rc = rcOf(W)                                            // the handle's top corners
  const hw = holeH(hh)                                          // the hand hole's height
  const mt = woodAbove(hh)                                      // wood above it
  const yh = round3(mt + hw / 2)                                // its centre line
  // wood between the hole's rounded ends and the handle's outline (the top corners are round), for a box w wide
  const handWeb = (len: number, w = W) => {
    const r = rcOf(w), ex = w / 2 - len / 2 + hw / 2, inCorner = ex < r && yh < r
    return (inCorner ? r - Math.hypot(ex - r, yh - r) : Math.min(yh, ex)) - hw / 2
  }
  if (hand <= hw + 2) errors.push(`فتحة اليد أقصر من ارتفاعها (${f1(hw)} مم): اجعل طولها ${f1(hw + 10)} مم على الأقل.`)
  else if (handWeb(hand) < HAND_WEB - 1e-9) {
    const okLen = search('hand', hand, x => x > hw + 2 && handWeb(x) >= HAND_WEB, -1)
    const okW = search('W', W, x => handWeb(hand, x) >= HAND_WEB)
    const fix = or([Number.isFinite(okLen) ? `قصّر فتحة اليد إلى ${f1(okLen)} مم` : '', Number.isFinite(okW) ? `وسّع الصندوق إلى ${f1(okW)} مم` : ''])
    const left = handWeb(hand)
    errors.push(`${left > 0 ? `فتحة اليد (${f1(hand)} مم) تترك ${f1(left)} مم فقط من الخشب حولها بدل ${HAND_WEB}` : `فتحة اليد (${f1(hand)} مم) أطول من أن يتّسع لها المقبض بعرض ${f1(W)} مم`}: ${fix || 'قصّر فتحة اليد ووسّع الصندوق'}.`)
  }
  const yHandle0 = round3(mt + hw + fm)                         // the handle's fret starts under the hole
  const yHandle1 = round3(hh - mb)
  const handleRoom = (h: number) => h - mb - (woodAbove(h) + holeH(h) + fm) - 4
  if (handleRoom(hh) < 0) {
    const okH = search('hh', hh, x => handleRoom(x) >= 0)
    errors.push(`المقبض قصير على فتحة اليد وما حولها: ${Number.isFinite(okH) ? `اجعل ارتفاعه ${f1(okH)} مم على الأقل` : 'استعمل لوحاً أرقّ'}.`)
  }

  // -------------------------------------------------------------- the hinge band and how far the handles lean
  const rows = Math.floor(band / pitch)
  if (rows < 3) errors.push(`شريط المفصل (${f1(band)} مم) قصير على صفوف القصّات بمسافة ${f1(pitch)} مم: اجعله ${f1(Math.ceil(3 * pitch))} مم على الأقل أو قرّب الصفوف.`)
  else if (rows < 6) warnings.push(`شريط المفصل فيه ${rows} صفوف فقط وقد يتشقّق عند الثني؛ ${f1(Math.ceil(6 * pitch))} مم أو أكثر أأمن.`)
  if (seg + bridge > W - 2 * bridge) errors.push(`طول قصّة المفصل أكبر من عرض الصندوق: اجعله ${f1(Math.floor(W - 3 * bridge))} مم على الأكثر.`)
  if (bridge >= seg / 2) warnings.push('الجسور طويلة بالنسبة للقصّات؛ المفصل سيكون قاسياً. قلّل الجسر أو أطل القصّة.')
  if (pitch - c.kerf < 1) warnings.push('الصفوف متقاربة جداً: الشريحة بينها أرقّ من 1 مم وقد تحترق أو تنقطع.')
  // the two handles lean in until their inner faces meet at the top: the band bends into an arc of angle θ and the
  // handle above it stays straight at θ; each must move in half the clear depth
  const reach = D / 2 - t
  const lean = (th: number, h = hh) => (band / th) * (1 - Math.cos(th)) + h * Math.sin(th)
  const MAX_LEAN = 75 * DEG, meet = lean(MAX_LEAN) >= reach
  let theta = MAX_LEAN
  if (meet) { let lo = 1e-4, hi = MAX_LEAN; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (lean(m) < reach) lo = m; else hi = m } theta = hi }
  const thetaDeg = Math.round(theta / DEG), R = band / theta
  if (!meet || thetaDeg > 40) {
    // a handle tall enough, or a box shallow enough, for a lean of 35°
    const okH = search('hh', hh, x => lean(35 * DEG, x) >= reach), okD = Math.floor(2 * (lean(35 * DEG) + t))
    const fix = or([Number.isFinite(okH) ? `زد ارتفاع المقبض إلى ${f1(okH)} مم` : '', okD >= LIM.D.min ? `قلّل العمق إلى ${f1(okD)} مم` : ''])
    warnings.push(!meet
      ? `المقبضان لا يلتقيان في القمّة ولو مال كلّ منهما 75°؛ ${fix || 'قلّل العمق'} ليلتقيا وهما يميلان 35°، أو اربطهما بشريط أطول بينهما.`
      : `كل مقبض يميل ${thetaDeg}° ليلتقي بالآخر، وهذا كثير: ${fix || 'قلّل العمق'} ليميل 35° فقط.`)
  }
  if (R < 2 * t) errors.push(`شريط المفصل قصير على انحناء ${thetaDeg}° (نصف قطر ${f1(R)} مم): اجعله ${f1(Math.ceil(2.5 * t * theta))} مم على الأقل.`)
  else if (R - t / 2 < 3 * t) warnings.push(`المفصل ينحني على نصف قطر ${f1(R)} مم فقط وقد يتشقّق؛ شريط بارتفاع ${f1(Math.ceil(3.5 * t * theta + 1))} مم أو أكثر أأمن.`)

  // -------------------------------------------------------------- the plaque on the front handle
  const zoneM = SCALLOP + 2.5                                   // scallops outside the plaque, then clear wood to the fret
  const pw = p.pw, ph = p.ph
  let zone: P2[] | undefined, frame: Loop[] = [], plaqueAt: { x: number; y: number } | undefined
  if (plaque) {
    const gp = 6                                                // from the hand hole to the frame's scallops
    const roomHOf = (h: number) => h - mb - (woodAbove(h) + holeH(h)) - gp, roomWOf = (w: number) => w - 2 * fm - 2 * zoneM
    const roomH = roomHOf(hh), roomW = roomWOf(W), off = 'أوقف لوحة الإهداء'
    if (pw > roomW + 1e-9) {
      const okPw = Math.floor(roomW * 2) / 2, okW = search('W', W, x => roomWOf(x) >= pw - 1e-9)
      errors.push(`لوحة الإهداء أعرض من المقبض: ${or([okPw >= LIM.pw.min ? `اجعل عرضها ${f1(okPw)} مم على الأكثر` : '', Number.isFinite(okW) ? `وسّع الصندوق إلى ${f1(okW)} مم` : '', off])}.`)
    }
    if (ph > roomH + 1e-9) {
      const okPh = Math.floor(roomH * 2) / 2, okHh = search('hh', hh, x => roomHOf(x) >= ph - 1e-9)
      errors.push(`لوحة الإهداء أطول من مكانها تحت فتحة اليد: ${or([okPh >= LIM.ph.min ? `اجعل ارتفاعها ${f1(okPh)} مم على الأكثر` : '', Number.isFinite(okHh) ? `اجعل ارتفاع المقبض ${f1(okHh)} مم على الأقل` : '', off])}.`)
    }
    if (!errors.length) {
      const y0 = mt + hw + gp, y1 = hh - mb
      const rr = Math.min(10, pw / 5, ph / 5)
      plaqueAt = { x: round3(W / 2 - pw / 2), y: round3(Math.min(Math.max(y0, (y0 + y1) / 2 - ph / 2), y1 - ph)) }
      frame = plaqueFrame(plaqueAt.x, plaqueAt.y, pw, ph, rr)
      // the fret is clipped round the frame and its scallops; a strip of fret narrower than minStrip between the
      // zone and the field's edge would be slivers, so the zone swallows it (it only ever grows)
      const minStrip = Math.max(5, 0.35 * cell), fx0 = fm, fx1 = W - fm
      let zx0 = plaqueAt.x - zoneM, zx1 = plaqueAt.x + pw + zoneM, zy0 = plaqueAt.y - zoneM, zy1 = plaqueAt.y + ph + zoneM
      if (zx0 - fx0 < minStrip) zx0 = Math.min(zx0, fx0 - 2)
      if (fx1 - zx1 < minStrip) zx1 = Math.max(zx1, fx1 + 2)
      if (zy0 - yHandle0 < minStrip) zy0 = Math.min(zy0, yHandle0 - 2)
      if (yHandle1 - zy1 < minStrip) zy1 = Math.max(zy1, yHandle1 + 2)
      zone = roundedRectPoly(zx0, zy0, zx1 - zx0, zy1 - zy0, rr + zoneM)
    }
  }

  // -------------------------------------------------------------- the fret on every wall
  const total = round3(hh + band + H)
  // the sides' top corners are rounded (as in the photo); their finger joints start below the rounding
  const rqOf = (d: number, h: number) => round3(Math.min(0.22 * d, 0.3 * h, 30))
  const rq = rqOf(D, H)
  type Field = readonly [number, number, number, number]
  const fieldsFor = (w: number, d: number, h: number, hhv: number) => ({
    body: [fm, hhv + band + mb, w - fm, hhv + band + h - t - fm] as Field,
    side: [fm, fm, d - fm, h - t - fm] as Field,
    handle: [fm, round3(woodAbove(hhv) + holeH(hhv) + fm), w - fm, hhv - mb] as Field,
  })
  /** the sides' fret keeps fm - t from their rounded corners, as it does from the joints' notches */
  const sideKeep = (d: number, h: number): Keep | undefined => { const r = rqOf(d, h), ri = r - (fm - t); return ri > 0.2 ? archField(fm, fm, d - fm, h - t - fm, ri, r) : undefined }
  const fields = fieldsFor(W, D, H, hh)
  const minEdge = Math.max(0.4, 3.5 * c.kerf)
  const holesIn = (f: Field, cl = cell, z?: P2[], keep?: Keep) => (f[2] - f[0] < 1 || f[3] - f[1] < 1 ? [] : fret(kind, f[0], f[1], f[2], f[3], cl, minEdge, z, keep))
  let bodyHoles: Loop[] = [], sideHoles: Loop[] = [], handleHoles: Loop[] = [], frontHandleHoles: Loop[] = []
  if (!errors.length) {
    bodyHoles = holesIn(fields.body)
    sideHoles = holesIn(fields.side, cell, undefined, sideKeep(D, H))
    handleHoles = holesIn(fields.handle)
    frontHandleHoles = plaque ? holesIn(fields.handle, cell, zone) : handleHoles
    // every wall that must carry fret: its name, the sizes that make it bigger, and its fret for a cell and sizes
    type Q = { W: number; D: number; H: number; hh: number }
    type Wall = { name: string; keys: (keyof Q)[]; holes: (cl: number, q: Q) => Loop[] }
    const walls: Wall[] = [
      { name: 'الواجهة', keys: ['H', 'W'], holes: (cl, q) => holesIn(fieldsFor(q.W, q.D, q.H, q.hh).body, cl) },
      { name: 'الجانب', keys: ['H', 'D'], holes: (cl, q) => holesIn(fieldsFor(q.W, q.D, q.H, q.hh).side, cl, undefined, sideKeep(q.D, q.H)) },
    ]
    if (!plaque) walls.push({ name: 'المقبض', keys: ['hh', 'W'], holes: (cl, q) => holesIn(fieldsFor(q.W, q.D, q.H, q.hh).handle, cl) })
    const now = [bodyHoles, sideHoles, handleHoles], bare = walls.find((_, i) => !now[i].length)
    if (bare) {
      // the biggest cell every wall takes with this pattern, and the box sizes that take this cell
      const q0: Q = { W, D, H, hh }, names: Record<keyof Q, string> = { W: 'العرض', D: 'العمق', H: 'ارتفاع الجسم', hh: 'ارتفاع المقبض' }
      const okCell = search('cell', cell - 0.5, cl => walls.every(w => w.holes(cl, q0).length > 0), -1, 0.5)
      const grow = bare.keys.map(k => [k, search(k, q0[k], v => walls.every(w => w.holes(cell, { ...q0, [k]: v }).length > 0))] as const).filter(([, v]) => Number.isFinite(v))
      const fix = or([Number.isFinite(okCell) ? `صغّر «حجم الزخرفة» إلى ${f1(okCell)} مم على الأكثر` : '', ...grow.map(([k, v]) => `اجعل ${names[k]} ${f1(v)} مم`)])
      errors.push(`${bare.name} أصغر من الزخرفة بحجم ${f1(cell)} مم: ${fix || 'كبّر الصندوق أو اختر زخرفة أخرى'}.`)
    } else if (plaque && !frontHandleHoles.length) warnings.push('لوحة الإهداء تملأ مقبض الواجهة فلا تبقى حولها زخرفة؛ كبّر ارتفاع المقبض أو صغّر اللوحة إن أردت الزخرفة حولها.')
  }

  // -------------------------------------------------------------- the panels
  const hinge = hingeLines(0, hh, W, hh + band, seg, bridge, pitch, 'x', { through: true })
  const handlePost = (loops: Loop[]) => { roundCorner(loops, 0, 0, rc); roundCorner(loops, W, 0, rc) }
  const hole = stadium(W / 2, yh, hand, hw)
  const bodyFrom = round3(hh + band)
  // the joints between the walls run below the sides' rounded corners; above them the front and back keep the
  // corner to themselves, so the sides are cut back by t there
  const wallEdge: EdgeSpec = { type: 'male', from: round3(bodyFrom + rq), len: round3(H - rq) }
  const sideEdge: EdgeSpec = { type: 'female', from: rq, len: round3(H - rq) }
  const sidePost = (loops: Loop[]) => { roundCorner(loops, t, 0, rq); roundCorner(loops, D - t, 0, rq) }
  const panels: PanelSpec[] = [
    { id: 'bottom', name: 'القاعدة', w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male', count: n },
    {
      id: 'front', name: 'الواجهة الأمامية + المقبض (اللوحة)', w: W, h: total, count: n,
      bottom: 'female', left: wallEdge, right: wallEdge,
      holes: [hole, ...frontHandleHoles, ...bodyHoles], open: hinge, engrave: frame, post: handlePost,
      note: plaque ? 'المقبض فوق شريط المفصل، وعليه لوحة الإهداء الفارغة' : 'المقبض فوق شريط المفصل',
    },
    {
      id: 'back', name: 'الواجهة الخلفية + المقبض', w: W, h: total, count: n,
      bottom: 'female', left: wallEdge, right: wallEdge,
      holes: [hole, ...handleHoles, ...bodyHoles], open: hinge, post: handlePost,
      note: 'كالواجهة الأمامية بلا لوحة',
    },
    {
      id: 'side', name: 'الجانب', w: D, h: H, bottom: 'female', left: sideEdge, right: sideEdge, count: 2 * n,
      cuts: [rect(0, 0, t, rq), rect(D - t, 0, t, rq)], post: sidePost, holes: sideHoles, note: 'بين الواجهتين، زاويتاه العلويتان مستديرتان',
    },
  ]

  // -------------------------------------------------------------- notes
  const holeCount = bodyHoles.length * 2 + sideHoles.length * 2 + handleHoles.length + frontHandleHoles.length
  notes.push(
    `علبة ${W} × ${D} × ${H} مم مفتوحة من الأعلى بتعشيق أصابع، جانباها مستديرا الزاويتين العلويتين (نصف قطر ${f1(rq)} مم)، وواجهتاها ترتفعان ${f1(band)} مم شريط مفصل ثم ${f1(hh)} مم مقبضاً بزاويتين مستديرتين وفتحة يد ${f1(hand)} × ${f1(hw)} مم؛ الارتفاع الكلّي قائمةً ${f1(total)} مم.`,
    `الزخرفة «${PATTERNS[KIND.indexOf(kind)]}» بحجم ${f1(cell)} مم على الجدران الأربعة والمقبضين (${holeCount} ثقباً)، بهامش مصمت ${f1(fm)} مم حول كل حافّة وحول فتحة اليد؛ الجسور بين الثقوب لا تقلّ عن 2 مم.`,
    plaqueAt
      ? `لوحة الإهداء ${f1(pw)} × ${f1(ph)} مم مصمتة في وسط مقبض الواجهة، بإطار محفور مزدوج تحيط به زخارف صغيرة، والزخرفة مقصوصة حولها. تُترك فارغة: اكتب «مع أطيب الأمنيات» أو اسم المهدى إليه داخل الإطار في RDWorks على طبقة الحفر.`
      : 'بلا لوحة إهداء: المقبضان متماثلان.',
    `التجميع: ألصق القاعدة بين الواجهتين والجانبين بأصابع التعشيق (نقطة غراء خشب في كل أصبع، واضغط حتى يجفّ)؛ الجانبان بين الواجهتين، وحافّتهما العلوية عند أسفل شريط المفصل. ${meet
      ? `ثم اثنِ المقبضين للداخل برفق على شريطَي المفصل حتى يلتقيا في القمّة (كلّ منهما يميل نحو ${thetaDeg}°، على نصف قطر ${f1(R)} مم)، ومرّر شريط ستان في فتحتَي اليد واعقده ليمسكهما معاً ويُحمل منه.`
      : `ثم اثنِ المقبضين للداخل برفق على شريطَي المفصل قدر ما يلين الشريط (لن يلتقيا في القمّة بهذه المقاسات)، ومرّر شريط ستان في فتحتَي اليد واعقده بينهما ليُحمل منه.`}`,
    `المفصل المرن: ${rows} صفوف من القصّات بطول ${f1(seg)} مم وجسور ${f1(bridge)} مم، بين الصفّ والصفّ ${f1(pitch)} مم؛ الصفوف المتناوبة تخرج من الحافّتين. الإعدادات الموصى بها للأبلكاش 3 مم: قصّة 20، جسر 3، مسافة الصفوف 1.5 (وللـ MDF قرّب الصفوف إلى 1.2 واثنِ أبطأ). جرّب الشريط على قطعة صغيرة أولاً، واثنِ المقبض ببطء وبيدين.`,
  )
  for (const sp of panels) if (sp.count && n > 1) sp.note = sp.note ? `${sp.note} — ${n} علب` : `${n} علب`
  return { panels, notes, warnings, errors }
}

export const GIFT_BAGS: Template[] = [
  {
    id: 'giftbag',
    name: 'علبة هدايا بمقبض مخرّمة',
    desc: 'علبة هدايا خشبية مفتوحة من الأعلى، واجهتاها ترتفعان إلى مقبضين بفتحة يد ينثنيان للداخل على شريط مفصل مرن فيلتقيان في القمّة ويُربطان بشريط؛ جدرانها ومقبضاها شبكة مخرّمة (أوجي متشابك كالصورة أو غيره)، وعلى الواجهة لوحة إهداء بإطار محفور تُترك فارغة للكتابة في RDWorks.',
    icon: `<path d="M14 36h36v22H14z"/><path d="M14 36l5-8h26l5 8"/><path d="M19 28c0-10 2-18 5-24h16c3 6 5 14 5 24"/><path d="M27 10h10" stroke-width="3"/><path d="M17 31h30M17 33.5h30" stroke-width="1"/><path d="M22 42l3 4-3 4-3-4zM32 42l3 4-3 4-3-4zM42 42l3 4-3 4-3-4z" stroke-width="1.3"/><path d="M27 17h10v6H27z" stroke-width="1.2"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: t => ({ W: 2 * t, D: 2 * t, H: t }),
    build,
  },
]

/** for tests and previews */
export const GIFTBAG_GEOM = { subtractConvex, clipConvex, clipRect, roundedRectPoly, ogee, fret, sample, asHole, areaOf, widthOf, HAND_WEB, SCALLOP }

// Geometry for laser-cut panels. Units are millimetres, screen coordinates (y grows downward).
//
// A loop is a list of vertices; the segment from vertex i to i+1 is a straight line unless
// vertex i carries a bulge `b` (DXF-style, b = tan(θ/4)): then it is a circular arc.
// Sign convention (screen coords): b > 0 bows to the RIGHT of the direction of travel.
// Every closed loop is oriented so the solid material lies on the RIGHT of the direction of
// travel: outer contours run clockwise on screen, holes counter-clockwise.

export interface Pt { x: number; y: number }
export interface Vtx { x: number; y: number; b?: number }
export interface Loop { pts: Vtx[]; closed: boolean }
export interface Rect { x: number; y: number; w: number; h: number }
export interface BBox { minX: number; minY: number; maxX: number; maxY: number }

const EPS = 1e-6
export const round3 = (v: number) => Math.round(v * 1000) / 1000
export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h })

// ---------------------------------------------------------------- rectilinear union

/** Outline(s) of (∪ add) \ (∪ sub) as loops. Touching rectangles merge; corners come out clean. */
export function unionRects(add: Rect[], sub: Rect[]): Loop[] {
  const xs = new Set<number>(), ys = new Set<number>()
  for (const r of [...add, ...sub]) {
    if (r.w <= 0 || r.h <= 0) continue
    xs.add(round3(r.x)); xs.add(round3(r.x + r.w)); ys.add(round3(r.y)); ys.add(round3(r.y + r.h))
  }
  const X = [...xs].sort((a, b) => a - b), Y = [...ys].sort((a, b) => a - b)
  const nx = X.length - 1, ny = Y.length - 1
  if (nx < 1 || ny < 1) return []
  const inside = (r: Rect, cx: number, cy: number) => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h
  const occ: boolean[][] = []
  for (let i = 0; i < nx; i++) {
    occ.push([])
    for (let j = 0; j < ny; j++) {
      const cx = (X[i] + X[i + 1]) / 2, cy = (Y[j] + Y[j + 1]) / 2
      occ[i][j] = add.some(r => inside(r, cx, cy)) && !sub.some(r => inside(r, cx, cy))
    }
  }
  const at = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < ny && occ[i][j]
  interface E { ax: number; ay: number; bx: number; by: number; used: boolean }
  const edges: E[] = []
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    if (!occ[i][j]) continue
    const x0 = X[i], x1 = X[i + 1], y0 = Y[j], y1 = Y[j + 1]
    if (!at(i, j - 1)) edges.push({ ax: x0, ay: y0, bx: x1, by: y0, used: false }) // top, heading east
    if (!at(i + 1, j)) edges.push({ ax: x1, ay: y0, bx: x1, by: y1, used: false }) // right, heading south
    if (!at(i, j + 1)) edges.push({ ax: x1, ay: y1, bx: x0, by: y1, used: false }) // bottom, heading west
    if (!at(i - 1, j)) edges.push({ ax: x0, ay: y1, bx: x0, by: y0, used: false }) // left, heading north
  }
  const key = (x: number, y: number) => `${x},${y}`
  const byStart = new Map<string, E[]>()
  for (const e of edges) {
    const k = key(e.ax, e.ay)
    if (!byStart.has(k)) byStart.set(k, [])
    byStart.get(k)!.push(e)
  }
  const loops: Loop[] = []
  for (const first of edges) {
    if (first.used) continue
    first.used = true
    const pts: Vtx[] = [{ x: first.ax, y: first.ay }]
    let cur = first
    for (let guard = 0; guard < edges.length + 1; guard++) {
      const cands = (byStart.get(key(cur.bx, cur.by)) ?? []).filter(e => !e.used)
      if (cands.length === 0) break
      const dx = cur.bx - cur.ax, dy = cur.by - cur.ay
      // prefer the sharpest right turn so diagonally touching cells stay in separate loops
      cands.sort((p, q) => turn(dx, dy, q) - turn(dx, dy, p))
      const next = cands[0]
      next.used = true
      pts.push({ x: next.ax, y: next.ay })
      cur = next
      if (cur.bx === first.ax && cur.by === first.ay) break
    }
    loops.push({ pts: simplify(pts), closed: true })
  }
  return loops
  function turn(dx: number, dy: number, e: E) { return dx * (e.by - e.ay) - dy * (e.bx - e.ax) } // > 0 right turn (screen)
}

/** Drop repeated points and interior points of straight runs. */
export function simplify(pts: Vtx[]): Vtx[] {
  const out: Vtx[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS) { if (p.b) last.b = p.b; continue }
    out.push({ ...p })
  }
  if (out.length > 1) {
    const f = out[0], l = out[out.length - 1]
    if (Math.abs(f.x - l.x) < EPS && Math.abs(f.y - l.y) < EPS) out.pop()
  }
  let changed = true
  while (changed && out.length > 2) {
    changed = false
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length]
      if (a.b || b.b) continue
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
      const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)
      if (Math.abs(cross) < EPS && dot > 0) { out.splice(i, 1); changed = true; break }
    }
  }
  return out
}

// ---------------------------------------------------------------- arcs

export interface ArcInfo { c: Pt; r: number; a0: number; a1: number; ccw: boolean; theta: number }

/** Center, radius and angles of the arc from p to q with bulge b. */
export function arcInfo(p: Pt, q: Pt, b: number): ArcInfo {
  const dx = q.x - p.x, dy = q.y - p.y, c = Math.hypot(dx, dy)
  const ux = dx / c, uy = dy / c
  const s = Math.abs(b) * c / 2
  const r = c * (1 + b * b) / (4 * Math.abs(b))
  const sg = Math.sign(b)
  const nx = -uy * sg, ny = ux * sg // unit normal toward the bow
  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2
  const cx = mx + nx * (s - r), cy = my + ny * (s - r)
  const a0 = Math.atan2(p.y - cy, p.x - cx), a1 = Math.atan2(q.y - cy, q.x - cx)
  return { c: { x: cx, y: cy }, r, a0, a1, ccw: b > 0, theta: 4 * Math.atan(Math.abs(b)) }
}

export function bulgeFromAngles(a0: number, a1: number, ccw: boolean): number {
  let d = ccw ? a0 - a1 : a1 - a0 // screen: ccw means decreasing angle
  d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  if (d < 1e-9) d = 2 * Math.PI
  const b = Math.tan(d / 4)
  return ccw ? b : -b
}

// ---------------------------------------------------------------- loop utilities

export function loopLength(l: Loop): number {
  let len = 0
  const n = l.pts.length
  for (let i = 0; i < (l.closed ? n : n - 1); i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n]
    if (p.b) { const a = arcInfo(p, q, p.b); len += a.r * a.theta } else len += Math.hypot(q.x - p.x, q.y - p.y)
  }
  return len
}

export function signedArea(l: Loop): number {
  let a = 0
  const n = l.pts.length
  for (let i = 0; i < n; i++) { const p = l.pts[i], q = l.pts[(i + 1) % n]; a += p.x * q.y - q.x * p.y }
  return a / 2
}

export function bbox(loops: Loop[]): BBox {
  const bb: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const l of loops) {
    const n = l.pts.length
    for (let i = 0; i < n; i++) {
      const p = l.pts[i]
      grow(p.x, p.y)
      if (p.b && (l.closed || i < n - 1)) {
        const q = l.pts[(i + 1) % n], a = arcInfo(p, q, p.b)
        // extreme points of the arc at multiples of 90°
        for (let k = -4; k <= 4; k++) {
          const ang = k * Math.PI / 2
          if (angleOnArc(ang, a)) grow(a.c.x + a.r * Math.cos(ang), a.c.y + a.r * Math.sin(ang))
        }
      }
    }
  }
  if (bb.minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return bb
  function grow(x: number, y: number) { bb.minX = Math.min(bb.minX, x); bb.minY = Math.min(bb.minY, y); bb.maxX = Math.max(bb.maxX, x); bb.maxY = Math.max(bb.maxY, y) }
}

function angleOnArc(ang: number, a: ArcInfo): boolean {
  const norm = (v: number) => ((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const d = a.ccw ? norm(a.a0 - ang) : norm(ang - a.a0)
  return d <= a.theta + 1e-9
}

export function translate(loops: Loop[], dx: number, dy: number): Loop[] {
  return loops.map(l => ({ closed: l.closed, pts: l.pts.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) }))
}

/** A circular hole (counter-clockwise on screen, solid on the right). */
export function circle(cx: number, cy: number, r: number): Loop {
  return { closed: true, pts: [{ x: cx, y: cy - r, b: 1 }, { x: cx, y: cy + r, b: 1 }] }
}

/** A stadium-shaped hole (horizontal), length `len` (overall), height `h`. */
export function stadium(cx: number, cy: number, len: number, h: number): Loop {
  const r = h / 2, xl = cx - (len / 2 - r), xr = cx + (len / 2 - r)
  if (len <= h) return circle(cx, cy, r)
  return { closed: true, pts: [{ x: xr, y: cy - r }, { x: xl, y: cy - r, b: 1 }, { x: xl, y: cy + r }, { x: xr, y: cy + r, b: 1 }] }
}

/** Rounded-rectangle hole with corner radius rr. */
export function roundedRectHole(x: number, y: number, w: number, h: number, rr: number): Loop {
  rr = Math.min(rr, w / 2, h / 2)
  const k = Math.tan(Math.PI / 8)
  // counter-clockwise on screen: top edge westward
  return { closed: true, pts: [
    { x: x + w - rr, y }, { x: x + rr, y, b: k }, { x, y: y + rr }, { x, y: y + h - rr, b: k },
    { x: x + rr, y: y + h }, { x: x + w - rr, y: y + h, b: k }, { x: x + w, y: y + h - rr }, { x: x + w, y: y + rr, b: k },
  ] }
}

const near = (p: Pt, x: number, y: number) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6

/** Replace the right-angle corner vertex at (x, y) with a fillet of radius r. */
export function roundCorner(loops: Loop[], x: number, y: number, r: number): void {
  for (const l of loops) {
    if (!l.closed) continue
    const n = l.pts.length
    const i = l.pts.findIndex(p => near(p, x, y))
    if (i < 0) continue
    const a = l.pts[(i + n - 1) % n], v = l.pts[i], c = l.pts[(i + 1) % n]
    if (a.b || v.b) return
    const l1 = Math.hypot(v.x - a.x, v.y - a.y), l2 = Math.hypot(c.x - v.x, c.y - v.y)
    const rr = Math.min(r, l1, l2)
    if (rr <= 0) return
    const u1 = { x: (v.x - a.x) / l1, y: (v.y - a.y) / l1 }, u2 = { x: (c.x - v.x) / l2, y: (c.y - v.y) / l2 }
    const cross = u1.x * u2.y - u1.y * u2.x // > 0: right turn (convex for our orientation)
    const k = Math.tan(Math.PI / 8)
    const p1: Vtx = { x: v.x - u1.x * rr, y: v.y - u1.y * rr, b: cross > 0 ? -k : k }
    const p2: Vtx = { x: v.x + u2.x * rr, y: v.y + u2.y * rr }
    l.pts.splice(i, 1, p1, p2)
    return
  }
}

/** Cut a semicircular notch of radius r into a straight edge, centred at the edge point (x, y). */
export function edgeNotch(loops: Loop[], x: number, y: number, r: number): void {
  for (const l of loops) {
    if (!l.closed) continue
    const n = l.pts.length
    for (let i = 0; i < n; i++) {
      const p = l.pts[i], q = l.pts[(i + 1) % n]
      if (p.b) continue
      const len = Math.hypot(q.x - p.x, q.y - p.y)
      const ux = (q.x - p.x) / len, uy = (q.y - p.y) / len
      const t = (x - p.x) * ux + (y - p.y) * uy
      const dist = Math.abs((x - p.x) * uy - (y - p.y) * ux)
      if (dist > 1e-6 || t < r - 1e-6 || t > len - r + 1e-6) continue
      const a: Vtx = { x: x - ux * r, y: y - uy * r, b: 1 }, b: Vtx = { x: x + ux * r, y: y + uy * r }
      l.pts.splice(i + 1, 0, a, b)
      return
    }
  }
}

// ---------------------------------------------------------------- offset (kerf)

type Seg = { kind: 'line'; p: Pt; q: Pt } | { kind: 'arc'; c: Pt; r: number; a0: number; a1: number; ccw: boolean; p: Pt; q: Pt }

/**
 * Offset a closed loop by d, moving every edge away from the solid (which lies on the right).
 * d > 0 makes outer contours bigger and holes smaller: exactly what kerf compensation needs.
 */
export function offsetLoop(loop: Loop, d: number): Loop {
  if (!loop.closed || Math.abs(d) < 1e-9 || loop.pts.length < 2) return loop
  const n = loop.pts.length
  const segs: Seg[] = []
  for (let i = 0; i < n; i++) {
    const p = loop.pts[i], q = loop.pts[(i + 1) % n]
    if (p.b) {
      const a = arcInfo(p, q, p.b)
      const r2 = a.r - Math.sign(p.b) * d
      if (r2 <= 1e-6) { segs.push({ kind: 'line', p: { x: p.x, y: p.y }, q: { x: q.x, y: q.y } }); continue }
      const at = (ang: number) => ({ x: a.c.x + r2 * Math.cos(ang), y: a.c.y + r2 * Math.sin(ang) })
      segs.push({ kind: 'arc', c: a.c, r: r2, a0: a.a0, a1: a.a1, ccw: a.ccw, p: at(a.a0), q: at(a.a1) })
    } else {
      const len = Math.hypot(q.x - p.x, q.y - p.y)
      if (len < 1e-9) continue
      const nx = (q.y - p.y) / len * d, ny = -(q.x - p.x) / len * d // left of travel (away from solid)
      segs.push({ kind: 'line', p: { x: p.x + nx, y: p.y + ny }, q: { x: q.x + nx, y: q.y + ny } })
    }
  }
  const m = segs.length
  const out: Vtx[] = []
  for (let i = 0; i < m; i++) {
    const s1 = segs[i], s2 = segs[(i + 1) % m]
    const v = loop.pts[(i + 1) % n]
    if (Math.hypot(s1.q.x - s2.p.x, s1.q.y - s2.p.y) > 1e-7) {
      const cands = intersect(s1, s2)
      let best: Pt | null = null, bd = Infinity
      for (const c of cands) { const dd = Math.hypot(c.x - v.x, c.y - v.y); if (dd < bd) { bd = dd; best = c } }
      if (best && bd < Math.abs(d) * 20 + 1e-3) { setEnd(s1, best); setStart(s2, best) }
    }
  }
  for (const s of segs) {
    if (s.kind === 'line') out.push({ x: s.p.x, y: s.p.y })
    else out.push({ x: s.p.x, y: s.p.y, b: bulgeFromAngles(s.a0, s.a1, s.ccw) })
    // bevel join when the next segment starts somewhere else is implicit: its start point is pushed next
  }
  // insert bevel points where consecutive segments still don't meet
  const pts: Vtx[] = []
  for (let i = 0; i < m; i++) {
    const s = segs[i], nxt = segs[(i + 1) % m]
    pts.push(out[i])
    if (Math.hypot(s.q.x - nxt.p.x, s.q.y - nxt.p.y) > 1e-7) pts.push({ x: s.q.x, y: s.q.y })
  }
  return { closed: true, pts: simplify(pts) }

  function setEnd(s: Seg, p: Pt) { s.q = p; if (s.kind === 'arc') s.a1 = Math.atan2(p.y - s.c.y, p.x - s.c.x) }
  function setStart(s: Seg, p: Pt) { s.p = p; if (s.kind === 'arc') s.a0 = Math.atan2(p.y - s.c.y, p.x - s.c.x) }
}

function intersect(a: Seg, b: Seg): Pt[] {
  if (a.kind === 'line' && b.kind === 'line') {
    const d1x = a.q.x - a.p.x, d1y = a.q.y - a.p.y, d2x = b.q.x - b.p.x, d2y = b.q.y - b.p.y
    const den = d1x * d2y - d1y * d2x
    if (Math.abs(den) < 1e-12) return []
    const t = ((b.p.x - a.p.x) * d2y - (b.p.y - a.p.y) * d2x) / den
    return [{ x: a.p.x + d1x * t, y: a.p.y + d1y * t }]
  }
  if (a.kind === 'line' && b.kind === 'arc') return lineCircle(a.p, a.q, b.c, b.r)
  if (a.kind === 'arc' && b.kind === 'line') return lineCircle(b.p, b.q, a.c, a.r)
  if (a.kind === 'arc' && b.kind === 'arc') return circleCircle(a.c, a.r, b.c, b.r)
  return []
}

function lineCircle(p: Pt, q: Pt, c: Pt, r: number): Pt[] {
  const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy)
  const ux = dx / len, uy = dy / len
  const t0 = (c.x - p.x) * ux + (c.y - p.y) * uy
  const fx = p.x + ux * t0, fy = p.y + uy * t0
  const h2 = r * r - ((fx - c.x) ** 2 + (fy - c.y) ** 2)
  if (h2 < -1e-6) return []
  const h = Math.sqrt(Math.max(0, h2))
  return [{ x: fx + ux * h, y: fy + uy * h }, { x: fx - ux * h, y: fy - uy * h }]
}

function circleCircle(c1: Pt, r1: number, c2: Pt, r2: number): Pt[] {
  const dx = c2.x - c1.x, dy = c2.y - c1.y, d = Math.hypot(dx, dy)
  if (d < 1e-9 || d > r1 + r2 + 1e-6 || d < Math.abs(r1 - r2) - 1e-6) return []
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a))
  const mx = c1.x + dx / d * a, my = c1.y + dy / d * a
  return [{ x: mx + h * -dy / d, y: my + h * dx / d }, { x: mx - h * -dy / d, y: my - h * dx / d }]
}

// ---------------------------------------------------------------- SVG path

export function loopToPath(l: Loop, dx = 0, dy = 0): string {
  const n = l.pts.length
  if (n === 0) return ''
  const f = (v: number) => String(round3(v))
  let d = `M${f(l.pts[0].x + dx)} ${f(l.pts[0].y + dy)}`
  const last = l.closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n]
    if (p.b) {
      const a = arcInfo(p, q, p.b)
      const large = Math.abs(p.b) > 1 ? 1 : 0, sweep = p.b > 0 ? 0 : 1
      d += `A${f(a.r)} ${f(a.r)} 0 ${large} ${sweep} ${f(q.x + dx)} ${f(q.y + dy)}`
    } else d += `L${f(q.x + dx)} ${f(q.y + dy)}`
  }
  if (l.closed) d += 'Z'
  return d
}

import { arcInfo, Loop } from './geom'

// ---------------------------------------------------------------- polygon helpers for the sweep tests
export type P = { x: number; y: number }

/** A closed loop with bulges as a dense polygon (arcs sampled every ~3°). */
export function samplePoly(l: Loop, stepDeg = 3): P[] {
  const out: P[] = []
  const n = l.pts.length
  for (let i = 0; i < n; i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n]
    out.push({ x: p.x, y: p.y })
    if (p.b) {
      const a = arcInfo(p, q, p.b), m = Math.max(4, Math.ceil(a.theta / (stepDeg * Math.PI / 180)))
      for (let k = 1; k < m; k++) { const ang = a.a0 + (a.ccw ? -1 : 1) * a.theta * k / m; out.push({ x: a.c.x + a.r * Math.cos(ang), y: a.c.y + a.r * Math.sin(ang) }) }
    }
  }
  return out
}

/** Material intervals of a panel along the vertical line x = X (ray casting on the outer loop). */
export function materialAt(l: Loop, X: number): [number, number][] {
  const poly = samplePoly(l), ys: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    if ((a.x <= X && b.x > X) || (b.x <= X && a.x > X)) ys.push(a.y + (b.y - a.y) * (X - a.x) / (b.x - a.x))
  }
  ys.sort((u, v) => u - v)
  const iv: [number, number][] = []
  for (let i = 0; i + 1 < ys.length; i += 2) iv.push([Math.round(ys[i] * 1000) / 1000, Math.round(ys[i + 1] * 1000) / 1000])
  return iv
}

const orient = (a: P, b: P, c: P) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
export function segsCross(a: P, b: P, c: P, d: P): boolean {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b)
  return o1 * o2 < -1e-12 && o3 * o4 < -1e-12
}
export function pointIn(p: P, poly: P[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < a.x + (b.x - a.x) * (p.y - a.y) / (b.y - a.y)) inside = !inside
  }
  return inside
}
export function polysOverlap(A: P[], B: P[]): boolean {
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) if (segsCross(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true
  return pointIn(A[0], B) || pointIn(B[0], A)
}
export function segDist(a: P, b: P, c: P, d: P): number {
  const pd = (p: P, u: P, v: P) => { const l2 = (v.x - u.x) ** 2 + (v.y - u.y) ** 2; const tt = l2 ? Math.max(0, Math.min(1, ((p.x - u.x) * (v.x - u.x) + (p.y - u.y) * (v.y - u.y)) / l2)) : 0; return Math.hypot(p.x - (u.x + tt * (v.x - u.x)), p.y - (u.y + tt * (v.y - u.y))) }
  return Math.min(pd(a, c, d), pd(b, c, d), pd(c, a, b), pd(d, a, b))
}
export function polyDistance(A: P[], B: P[]): number {
  let best = Infinity
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) best = Math.min(best, segDist(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length]))
  return best
}

export function selfIntersects(poly: P[]): boolean {
  const n = poly.length
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue
    if (segsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true
  }
  return false
}

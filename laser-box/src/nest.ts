// Nesting: the pieces of a design packed tightly on real sheets (1220 × 2440 by default) by their TRUE outlines,
// arcs included, not their boxes. Placing a piece only moves it and turns it by a quarter turn (never mirrors it:
// a mirrored piece would be cut wrong side up); its guide lines move with it.
//
// How: every piece (in each quarter turn) becomes a raster footprint — the cells its outline, grown by half the
// spacing, touches (exactly: a cell is marked when its square comes closer than spacing/2 to the outline). Two
// footprints that share no cell are therefore at least `spacing` apart. Large holes stay free, so a small piece can go
// into a ring's centre or a frame's window. The sheet is filled bottom-left along its long side (the leftover is
// one clean strip), largest pieces first, every quarter turn tried, several orderings within a time budget; the best
// kept (fewest sheets, then the shortest strip used on the last one). A box packer (MaxRects) is the fallback, and
// whichever is better wins. At the end every pair of pieces is checked exactly on the outlines, not on the raster.
import { Panel } from './joints'
import { Loop, arcInfo, bbox, signedArea } from './geom'

export type Rot = 0 | 90 | 180 | 270
export interface NestOpts {
  /** the least distance between two pieces' cuts, mm */
  spacing: number
  /** the least distance from a piece to the sheet's edge, mm */
  margin: number
  /** the sheet a material is cut from (undefined: the design's main sheet), mm */
  sheet: (material: string | undefined) => { w: number; h: number }
  /** quarter turns allowed (default true) */
  rotate?: boolean
  /** time for the search, ms (default 250); the work is counted, so a result is the same every time */
  budgetMs?: number
}
export interface NestPlaced {
  /** the piece as placed: loops, w and h already turned; its outline box starts at (0, 0) */
  panel: Panel
  /** where the panel's (0, 0) lies on its sheet, mm */
  x: number
  y: number
  copy: number
  sheet: number
  /** quarter turns applied, clockwise as seen on screen (y down) */
  rot: Rot
  sourceId: string
}
export interface NestSheet {
  index: number
  material?: string
  w: number
  h: number
  /** how far the pieces reach from the sheet's corner (0, 0): the rest is free */
  used: { w: number; h: number }
}
export interface NestResult { placed: NestPlaced[]; sheets: NestSheet[]; tooBig: string[] }

// ---------------------------------------------------------------- geometry helpers

/** chord error allowed when arcs become polygons for the raster (mm) */
const SAG = 0.01

const isCut = (l: Loop) => l.layer !== 'engrave' && l.pts.length > 1
/** outline box: closed cuts (as buildPanel normalises), else everything */
function outlineBox(loops: Loop[]) {
  const c = loops.filter(l => l.closed && isCut(l))
  return bbox(c.length ? c : loops)
}
/** the box of everything that is cut (living-hinge cuts run a little past the outline) */
function cutBox(loops: Loop[]) {
  const c = loops.filter(isCut)
  return bbox(c.length ? c : loops)
}

/** The panel turned by k quarter turns (clockwise on screen) and moved so its outline box starts at (0, 0). */
export function rotatePanel(p: Panel, k: number): Panel {
  k = ((k % 4) + 4) % 4
  const f = (x: number, y: number): [number, number] => (k === 0 ? [x, y] : k === 1 ? [-y, x] : k === 2 ? [-x, -y] : [y, -x])
  const turned = k === 0 ? p.loops : p.loops.map(l => ({ ...l, pts: l.pts.map(v => { const [x, y] = f(v.x, v.y); return v.b ? { x, y, b: v.b } : { x, y } }) }))
  const bb = outlineBox(turned)
  if (k === 0 && Math.abs(bb.minX) < 1e-9 && Math.abs(bb.minY) < 1e-9) return p
  const loops = turned.map(l => ({ ...l, pts: l.pts.map(v => ({ ...v, x: v.x - bb.minX, y: v.y - bb.minY })) }))
  return { ...p, loops, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY }
}

/** A loop as a flat polygon [x0, y0, x1, y1, …]: arcs cut into chords no further than `sag` from the arc, nor longer than `chord`. */
export function sampleLoop(l: Loop, sag: number, chord = Infinity): number[] {
  const out: number[] = []
  const n = l.pts.length, last = l.closed ? n : n - 1
  for (let i = 0; i < n; i++) {
    const p = l.pts[i]
    out.push(p.x, p.y)
    if (i >= last || !p.b) continue
    const q = l.pts[(i + 1) % n]
    if (Math.hypot(q.x - p.x, q.y - p.y) < 1e-9) continue
    const a = arcInfo(p, q, p.b)
    const step = sag >= a.r ? Math.PI / 2 : 2 * Math.acos(1 - sag / a.r)
    let m = Math.max(2, Math.ceil(a.theta / Math.min(step, Math.PI / 2)))
    if (chord < Infinity) m = Math.max(m, Math.ceil((a.r * a.theta) / chord))
    for (let k = 1; k < m; k++) {
      const ang = a.a0 + (a.ccw ? -1 : 1) * a.theta * k / m
      out.push(a.c.x + a.r * Math.cos(ang), a.c.y + a.r * Math.sin(ang))
    }
  }
  return out
}

function ptSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

/** distance between two segments (0 when they cross) */
export function segSeg(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number {
  const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax)
  const o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx)
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return 0
  return Math.min(ptSeg(ax, ay, cx, cy, dx, dy), ptSeg(bx, by, cx, cy, dx, dy), ptSeg(cx, cy, ax, ay, bx, by), ptSeg(dx, dy, ax, ay, bx, by))
}

/** distance between the square [x0, x0+c] × [y0, y0+c] and a segment (0 when they meet) */
function squareSeg(x0: number, y0: number, c: number, ax: number, ay: number, bx: number, by: number): number {
  // Liang–Barsky: does the segment enter the square?
  const dx = bx - ax, dy = by - ay
  let t0 = 0, t1 = 1, hit = true
  const P = [-dx, dx, -dy, dy], Q = [ax - x0, x0 + c - ax, ay - y0, y0 + c - ay]
  for (let k = 0; k < 4 && hit; k++) {
    if (P[k] === 0) { if (Q[k] < 0) hit = false; continue }
    const t = Q[k] / P[k]
    if (P[k] < 0) { if (t > t0) t0 = t } else if (t < t1) t1 = t
    if (t0 > t1) hit = false
  }
  if (hit) return 0
  const box = (px: number, py: number) => Math.hypot(Math.max(x0 - px, 0, px - x0 - c), Math.max(y0 - py, 0, py - y0 - c))
  return Math.min(box(ax, ay), box(bx, by), ptSeg(x0, y0, ax, ay, bx, by), ptSeg(x0 + c, y0, ax, ay, bx, by), ptSeg(x0, y0 + c, ax, ay, bx, by), ptSeg(x0 + c, y0 + c, ax, ay, bx, by))
}

// ---------------------------------------------------------------- footprints

/** A piece in one quarter turn as raster cells: per row, spans [a, b) of occupied cells. */
interface Foot {
  k: number
  nx: number
  ny: number
  /** ro[r] … ro[r+1]: the spans of row r in sp */
  ro: Int32Array
  sp: Int32Array
  /** the row holding the widest span, and its width (a quick test before the full one) */
  wide: number
  wideLen: number
  cells: number
  /** the sum of its cells' row numbers (cells × the row of its centre of area) */
  rows: number
  /** the panel's (0, 0) is offX, offY from the footprint's first cell corner plus the grown radius: x = margin + i·c + offX */
  offX: number
  offY: number
  /** the row that collided last: tried first next time */
  hint: number
}

/**
 * The cells of a grid of size c that come closer than rr to the material or any cut of panel p (already turned), the
 * grid starting rr before its cut box. A hole stays free inside only when keepHole says something could go in it; the
 * cut line of every hole is kept clear all the same (a hole may run out over the outline, a notch cut as a hole).
 * r: the grown radius the sheet raster is laid out for (rr - r is the allowance for arcs drawn as chords).
 */
function footprint(p: Panel, k: number, c: number, rr: number, r: number, keepHole: (w: number, h: number) => boolean): Foot {
  const cut = p.loops.filter(isCut)
  const cb = cutBox(p.loops)
  // signed: outlines wind +1, holes kept open -1 (material where the sum is not 0); edges: every cut line
  const signed: number[][] = [], edges: number[][] = [], open: number[][] = []
  for (const l of cut) {
    const P = sampleLoop(l, SAG)
    if (!l.closed) { open.push(P); continue }
    edges.push(P)
    if (signedArea(l) > 0) signed.push(P)
    else { const b = bbox([l]); if (keepHole(b.maxX - b.minX, b.maxY - b.minY)) signed.push(P) }
  }
  if (!signed.length) { const R = [cb.minX, cb.minY, cb.maxX, cb.minY, cb.maxX, cb.maxY, cb.minX, cb.maxY]; signed.push(R); edges.push(R) }
  const gx0 = cb.minX - rr, gy0 = cb.minY - rr
  const nx = Math.max(1, Math.ceil((cb.maxX - cb.minX + 2 * rr) / c - 1e-9))
  const ny = Math.max(1, Math.ceil((cb.maxY - cb.minY + 2 * rr) / c - 1e-9))
  const g = new Uint8Array(nx * ny)
  // inside: cells whose centre lies in the material (nonzero winding; screen y down, an edge going up counts +1)
  const xs: number[][] = Array.from({ length: ny }, () => [])
  for (const P of signed) {
    const n = P.length / 2
    for (let e = 0; e < n; e++) {
      const x1 = P[2 * e], y1 = P[2 * e + 1], x2 = P[(2 * e + 2) % P.length], y2 = P[(2 * e + 3) % P.length]
      if (y1 === y2) continue
      const lo = Math.min(y1, y2), hi = Math.max(y1, y2), d = y2 < y1 ? 1 : -1
      const j0 = Math.max(0, Math.ceil((lo - gy0) / c - 0.5)), j1 = Math.min(ny - 1, Math.ceil((hi - gy0) / c - 0.5) - 1)
      for (let j = j0; j <= j1; j++) { const yc = gy0 + (j + 0.5) * c; xs[j].push(x1 + (yc - y1) * (x2 - x1) / (y2 - y1), d) }
    }
  }
  for (let j = 0; j < ny; j++) {
    const X = xs[j]
    // pairs (x, d) sorted by x: few per row, insertion sort
    for (let q = 2; q < X.length; q += 2) {
      const x = X[q], d = X[q + 1]
      let t = q - 2
      while (t >= 0 && X[t] > x) { X[t + 2] = X[t]; X[t + 3] = X[t + 1]; t -= 2 }
      X[t + 2] = x; X[t + 3] = d
    }
    let wind = 0
    for (let q = 0; q + 2 < X.length; q += 2) {
      wind += X[q + 1]
      if (wind === 0) continue
      const i0 = Math.max(0, Math.ceil((X[q] - gx0) / c - 0.5)), i1 = Math.min(nx - 1, Math.ceil((X[q + 2] - gx0) / c - 0.5) - 1)
      if (i1 >= i0) g.fill(1, j * nx + i0, j * nx + i1 + 1)
    }
  }
  // the edge: every cell closer than r to any cut segment
  const half = c * 0.7072, r0 = r
  r = rr
  const mark = (ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax, dy = by - ay
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - r - gy0) / c)), j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by) + r - gy0) / c))
    for (let j = j0; j <= j1; j++) {
      const y0 = gy0 + j * c
      let t0 = 0, t1 = 1
      if (Math.abs(dy) > 1e-12) {
        let ta = (y0 - r - ay) / dy, tb = (y0 + c + r - ay) / dy
        if (ta > tb) { const t = ta; ta = tb; tb = t }
        t0 = Math.max(0, ta); t1 = Math.min(1, tb)
        if (t0 > t1) continue
      }
      const xa = ax + dx * t0, xb = ax + dx * t1
      const i0 = Math.max(0, Math.floor((Math.min(xa, xb) - r - gx0) / c)), i1 = Math.min(nx - 1, Math.floor((Math.max(xa, xb) + r - gx0) / c))
      for (let i = i0; i <= i1; i++) {
        const idx = j * nx + i
        if (g[idx]) continue
        const x0 = gx0 + i * c, dc = ptSeg(x0 + c / 2, y0 + c / 2, ax, ay, bx, by)
        if (dc >= r + half) continue
        if (dc < r - half || squareSeg(x0, y0, c, ax, ay, bx, by) < r) g[idx] = 1
      }
    }
  }
  for (const P of edges) for (let e = 0; e < P.length; e += 2) mark(P[e], P[e + 1], P[(e + 2) % P.length], P[(e + 3) % P.length])
  for (const P of open) for (let e = 0; e + 3 < P.length; e += 2) mark(P[e], P[e + 1], P[e + 2], P[e + 3])
  // rows of spans
  const ro = new Int32Array(ny + 1), sp: number[] = []
  let wide = 0, wideLen = 0, cells = 0, rows = 0
  for (let j = 0; j < ny; j++) {
    ro[j] = sp.length
    let i = 0
    while (i < nx) {
      if (!g[j * nx + i]) { i++; continue }
      const a = i
      while (i < nx && g[j * nx + i]) i++
      sp.push(a, i); cells += i - a; rows += j * (i - a)
      if (i - a > wideLen) { wideLen = i - a; wide = j }
    }
  }
  ro[ny] = sp.length
  // the panel's (0, 0) from the sheet raster's cell corner: x = margin - r0 + i·c - gx0
  return { k, nx, ny, ro, sp: Int32Array.from(sp), wide, wideLen, cells, rows, offX: -gx0 - r0, offY: -gy0 - r0, hint: 0 }
}

/**
 * The footprint of the piece turned half round more, from f (cells reversed both ways: still covers it, with the
 * rounding slack moved to the other side). w, h: the outline size of f's piece; r: the grown radius.
 */
function reversed(f: Foot, w: number, h: number, c: number, r: number): Foot {
  const ro = new Int32Array(f.ny + 1), sp = new Int32Array(f.sp.length)
  let q = 0
  for (let j = 0; j < f.ny; j++) {
    ro[j] = q
    const src = f.ny - 1 - j
    for (let k = f.ro[src + 1] - 2; k >= f.ro[src]; k -= 2) { sp[q++] = f.nx - f.sp[k + 1]; sp[q++] = f.nx - f.sp[k] }
  }
  ro[f.ny] = q
  // f's grid starts at (r - offX - r … ) = (-offX - r) in its piece; turned, the grid starts at w - (-offX - r) - nx·c
  const gx = w + f.offX + r - f.nx * c, gy = h + f.offY + r - f.ny * c
  return { ...f, k: (f.k + 2) % 4, ro, sp, wide: f.ny - 1 - f.wide, rows: (f.ny - 1) * f.cells - f.rows, offX: -r - gx, offY: -r - gy, hint: 0 }
}

const sameFoot = (a: Foot, b: Foot) => a.nx === b.nx && a.ny === b.ny && a.sp.length === b.sp.length && a.ro.every((v, i) => v === b.ro[i]) && a.sp.every((v, i) => v === b.sp[i])

// ---------------------------------------------------------------- the sheet raster

/** Work done so far (rows and spans tested): the search is bounded by work, not by the clock, so it is repeatable. */
let work = 0

/**
 * A sheet as raster rows; each row is the sorted list of its taken runs of cells [start, end) (merged, so a gap is
 * free), or undefined while nothing is in it.
 */
class Grid {
  rows: (number[] | undefined)[]
  maxRun: Int32Array
  /** rows below are full */
  low = 0
  free: number
  constructor(public W: number, public L: number) {
    this.rows = new Array(L)
    this.maxRun = new Int32Array(L).fill(W)
    this.free = W * L
  }
  /** 0 when f fits at cell (i, j); otherwise how far right it must move at least (past the run in its way) */
  check(f: Foot, i: number, j: number): number {
    const ro = f.ro, sp = f.sp, ny = f.ny, rows = this.rows
    let r = f.hint
    for (let q = 0; q < ny; q++) {
      const I = rows[j + r]
      if (I !== undefined) {
        const n = I.length >> 1
        for (let k = ro[r], e = ro[r + 1]; k < e; k += 2) {
          const x0 = i + sp[k]
          // the first run that ends after x0: in the way if it starts before the span ends
          let lo = 0, hi = n
          while (lo < hi) { const mid = (lo + hi) >> 1; if (I[2 * mid + 1] <= x0) lo = mid + 1; else hi = mid }
          if (lo < n && I[2 * lo] < i + sp[k + 1]) { work += q + 1; f.hint = r; return I[2 * lo + 1] - x0 }
        }
      }
      if (++r === ny) r = 0
    }
    work += ny
    return 0
  }
  /** the lowest row (at most maxJ), then the leftmost cell, where f fits */
  find(f: Foot, maxJ: number): [number, number] | null {
    const iEnd = this.W - f.nx, jEnd = Math.min(this.L - f.ny, maxJ), mr = this.maxRun, wide = f.wide, wl = f.wideLen
    if (iEnd < 0) return null
    for (let j = this.low; j <= jEnd; j++) {
      work++
      if (mr[j + wide] < wl) continue
      let i = 0
      while (i <= iEnd) {
        const s = this.check(f, i, j)
        if (s === 0) return [i, j]
        i += s
      }
    }
    return null
  }
  /** marks f's cells at (i, j); cells off the raster are dropped (a piece that fits the sheet but not the rounded raster) */
  place(f: Foot, i: number, j: number) {
    const ro = f.ro, sp = f.sp, W = this.W
    for (let r = 0; r < f.ny; r++) {
      const y = j + r
      if (ro[r] === ro[r + 1] || y < 0 || y >= this.L) continue
      const I = this.rows[y] ?? (this.rows[y] = [])
      for (let k = ro[r]; k < ro[r + 1]; k += 2) {
        let a = Math.max(0, i + sp[k]), b = Math.min(W, i + sp[k + 1])
        if (b <= a) continue
        // merge with every run it overlaps or touches
        let lo = 0, hi = I.length >> 1
        while (lo < hi) { const mid = (lo + hi) >> 1; if (I[2 * mid + 1] < a) lo = mid + 1; else hi = mid }
        let e = lo, had = 0
        while (2 * e < I.length && I[2 * e] <= b) { had += I[2 * e + 1] - I[2 * e]; a = Math.min(a, I[2 * e]); b = Math.max(b, I[2 * e + 1]); e++ }
        I.splice(2 * lo, 2 * (e - lo), a, b)
        this.free -= b - a - had
      }
      let m = 0, prev = 0
      for (let q = 0; q < I.length; q += 2) { if (I[q] - prev > m) m = I[q] - prev; prev = I[q + 1] }
      this.maxRun[y] = Math.max(m, W - prev)
      work += 1 + (I.length >> 3)
    }
    while (this.low < this.L && this.maxRun[this.low] === 0) this.low++
  }
}

// ---------------------------------------------------------------- packing passes

interface Kind {
  idx: number
  src: Panel
  /** by quarter turn: the turned panel, its cut box and whether that box fits the sheet */
  turned: { p: Panel; cx: number; cy: number; cw: number; ch: number; fits: boolean }[]
  feet: Foot[]
  /** no footprint fits the rounded raster although the piece fits the sheet */
  forced: boolean
  minCells: number
  boxArea: number
  long: number
  short: number
}
/** one copy placed, in the packing frame (the strip runs along +y): where the turned panel's (0, 0) goes */
interface Spot { kind: number; copy: number; k: number; sheet: number; x: number; y: number }
/**
 * len, wid: how far the pieces on the last sheet reach from its corner; area: their bounding box; eff: that area,
 * but never less than a block of the sheet's own proportions as long as it (a thin column along the edge counts as wider)
 */
interface Pack { spots: Spot[]; sheets: number; len: number; wid: number; area: number; eff: number }

interface Ctx {
  kinds: Kind[]
  /** the frame's sheet, mm: W across, L along the strip */
  W: number
  L: number
  m: number
  /** spacing actually kept (at least 0.1 mm) */
  s: number
  c: number
  r: number
  /** the strip may be narrower than the sheet (a compact block can waste less than a full-width row) */
  Wlim: number
  /** raster size in cells (gw for the strip) */
  gw: number
  gl: number
  /** quarter turns allowed */
  ks: number[]
  workLimit: number
  deadline: number
}

/**
 * fewest sheets, then the least area the pieces' bounding box takes on the last sheet (what is used of it), then the
 * block closer to the sheet's own proportions (its leftover more useful), then the shortest strip
 */
const better = (a: Pack, b: Pack | null) => {
  if (!b) return true
  if (a.sheets !== b.sheets) return a.sheets < b.sheets
  const lt = (x: number, y: number) => x < y * (1 - 1e-9) - 1e-6, eq = (x: number, y: number) => !lt(x, y) && !lt(y, x)
  return lt(a.area, b.area) || (eq(a.area, b.area) && (lt(a.eff, b.eff) || (eq(a.eff, b.eff) && a.len < b.len - 1e-6)))
}

function finish(ctx: Ctx, spots: Spot[], sheets: number): Pack {
  let len = 0, wid = 0, x0 = Infinity, y0 = Infinity
  for (const sp of spots) if (sp.sheet === sheets - 1) {
    const t = ctx.kinds[sp.kind].turned[sp.k].p
    len = Math.max(len, sp.y + t.h); wid = Math.max(wid, sp.x + t.w); x0 = Math.min(x0, sp.x); y0 = Math.min(y0, sp.y)
  }
  if (x0 === Infinity) return { spots, sheets, len, wid, area: 0, eff: 0 }
  const area = (len - y0) * (wid - x0)
  return { spots, sheets, len, wid, area, eff: Math.max(area, (len - y0) ** 2 * ctx.W / ctx.L) }
}

/** Bottom-left fill of the raster: each piece in turn at the lowest (crit 0) or lowest-reaching (crit 1) spot, first sheet it fits. */
function blf(ctx: Ctx, order: number[], crit: number): Pack | null {
  const grids: Grid[] = [], noFit: Set<number>[] = [], spots: Spot[] = []
  const copies = ctx.kinds.map(() => 0)
  const open = () => { grids.push(new Grid(ctx.gw, ctx.gl)); noFit.push(new Set()) }
  for (let n = 0; n < order.length; n++) {
    if (work > ctx.workLimit || ((n & 3) === 0 && Date.now() > ctx.deadline)) return null
    const K = ctx.kinds[order[n]]
    if (K.forced) {
      // fits the sheet but not the rounded raster: alone at the corner of a new sheet (its cells off the raster dropped)
      open()
      const f = K.feet[0]
      grids[grids.length - 1].place(f, 0, 0)
      spots.push({ kind: K.idx, copy: copies[K.idx]++, k: f.k, sheet: grids.length - 1, x: ctx.m + f.offX, y: ctx.m + f.offY })
      continue
    }
    for (let s = 0; ; s++) {
      if (s === grids.length) open()
      const G = grids[s]
      if (noFit[s].has(K.idx) || K.minCells > G.free) continue
      let best: [number, number, Foot] | null = null, bestKey = Infinity
      for (const f of K.feet) {
        const maxJ = best ? (crit === 0 ? best[1] : bestKey - f.ny) : Infinity
        if (maxJ < 0) continue
        const at = G.find(f, maxJ)
        if (!at) continue
        const key = crit === 0 ? at[1] : at[1] + f.ny
        // (alike: the leftmost, then the way round whose material sits lower, leaving more room above it)
        if (!best || key < bestKey || (key === bestKey && (at[0] < best[0] || (at[0] === best[0] && f.rows * best[2].cells < best[2].rows * f.cells)))) { best = [at[0], at[1], f]; bestKey = key }
      }
      if (!best) {
        if (G.free === G.W * G.L) return null // not even on an empty sheet (a strip too narrow): this try is void
        noFit[s].add(K.idx); continue
      }
      G.place(best[2], best[0], best[1])
      spots.push({ kind: K.idx, copy: copies[K.idx]++, k: best[2].k, sheet: s, x: ctx.m + best[0] * ctx.c + best[2].offX, y: ctx.m + best[1] * ctx.c + best[2].offY })
      break
    }
  }
  return finish(ctx, spots, grids.length)
}

interface Box { x: number; y: number; w: number; h: number }

/**
 * MaxRects on the cut boxes grown by the spacing; rule 0: lowest top edge then leftmost, rule 1: best short side fit.
 * null when a piece fits no empty strip (only possible on a narrowed strip).
 */
function maxRects(ctx: Ctx, order: number[], rule: number): Pack | null {
  const s = ctx.s, BW = ctx.Wlim - 2 * ctx.m + s, BL = ctx.L - 2 * ctx.m + s
  const bins: Box[][] = [], spots: Spot[] = []
  const copies = ctx.kinds.map(() => 0)
  for (const kid of order) {
    const K = ctx.kinds[kid]
    let placed = false
    for (let b = 0; !placed; b++) {
      if (b === bins.length) bins.push([{ x: 0, y: 0, w: BW, h: BL }])
      let best: { F: Box; k: number; w: number; h: number } | null = null, s1 = Infinity, s2 = Infinity
      for (const k of ctx.ks) {
        const t = K.turned[k]
        if (!t || !t.fits || (k >= 2 && ctx.ks.length > 1)) continue // a box turned half round is the same box
        const w = t.cw + s, h = t.ch + s
        for (const F of bins[b]) {
          if (w > F.w + 1e-9 || h > F.h + 1e-9) continue
          const a = rule === 0 ? F.y + h : Math.min(F.w - w, F.h - h), c = rule === 0 ? F.x : Math.max(F.w - w, F.h - h)
          if (a < s1 - 1e-9 || (a <= s1 + 1e-9 && c < s2)) { s1 = a; s2 = c; best = { F, k, w, h } }
        }
      }
      if (!best) { if (bins[b].length === 1 && bins[b][0].w === BW && bins[b][0].h === BL) return null; continue }
      const P: Box = { x: best.F.x, y: best.F.y, w: best.w, h: best.h }
      bins[b] = splitFree(bins[b], P)
      const t = K.turned[best.k]
      spots.push({ kind: K.idx, copy: copies[K.idx]++, k: best.k, sheet: b, x: ctx.m + P.x - t.cx, y: ctx.m + P.y - t.cy })
      placed = true
    }
  }
  return finish(ctx, spots, bins.length)
}

/** Rows of boxes up to the strip width, tallest first (the old layout), each piece upright or lying flat. */
function shelf(ctx: Ctx, order: number[], flat: boolean): Pack {
  const s = ctx.s, BW = ctx.Wlim - 2 * ctx.m, BL = ctx.L - 2 * ctx.m
  const pick = (K: Kind) => {
    const ok = ctx.ks.filter(k => k < 2 && K.turned[k].fits && K.turned[k].cw <= BW + 1e-9)
    if (!ok.length) return ctx.ks.find(k => K.turned[k].fits)!
    return flat ? ok.reduce((a, k) => (K.turned[k].ch < K.turned[a].ch ? k : a)) : ok[0]
  }
  const its = order.map(kid => ({ K: ctx.kinds[kid], k: pick(ctx.kinds[kid]) }))
  its.sort((a, b) => b.K.turned[b.k].ch - a.K.turned[a.k].ch || b.K.turned[b.k].cw - a.K.turned[a.k].cw)
  const spots: Spot[] = [], copies = ctx.kinds.map(() => 0)
  let x = 0, y = 0, rowH = 0, sheet = 0
  for (const { K, k } of its) {
    const t = K.turned[k]
    if (x > 0 && x + t.cw > BW + 1e-9) { y += rowH + s; x = 0; rowH = 0 }
    if (y > 0 && y + t.ch > BL + 1e-9) { sheet++; y = 0; x = 0; rowH = 0 }
    spots.push({ kind: K.idx, copy: copies[K.idx]++, k, sheet, x: ctx.m + x - t.cx, y: ctx.m + y - t.cy })
    x += t.cw + s; rowH = Math.max(rowH, t.ch)
  }
  return finish(ctx, spots, sheet + 1)
}

/** the same packing problem with the strip limited to wmm (the raster rows shortened to match) */
function narrow(ctx: Ctx, wmm: number): Ctx {
  const gw = Math.min(ctx.gw, Math.floor((wmm - 2 * ctx.m + 2 * ctx.r) / ctx.c + 1e-9))
  return { ...ctx, Wlim: Math.min(ctx.W, wmm), gw }
}

function splitFree(free: Box[], P: Box): Box[] {
  const out: Box[] = []
  for (const F of free) {
    if (P.x >= F.x + F.w || P.x + P.w <= F.x || P.y >= F.y + F.h || P.y + P.h <= F.y) { out.push(F); continue }
    if (P.x > F.x) out.push({ x: F.x, y: F.y, w: P.x - F.x, h: F.h })
    if (P.x + P.w < F.x + F.w) out.push({ x: P.x + P.w, y: F.y, w: F.x + F.w - P.x - P.w, h: F.h })
    if (P.y > F.y) out.push({ x: F.x, y: F.y, w: F.w, h: P.y - F.y })
    if (P.y + P.h < F.y + F.h) out.push({ x: F.x, y: P.y + P.h, w: F.w, h: F.y + F.h - P.y - P.h })
  }
  // drop free boxes inside others
  return out.filter((A, i) => !out.some((B, j) => j !== i && A.x >= B.x && A.y >= B.y && A.x + A.w <= B.x + B.w && A.y + A.h <= B.y + B.h && (j < i || A.x !== B.x || A.y !== B.y || A.w !== B.w || A.h !== B.h)))
}

// ---------------------------------------------------------------- exact check

/** a piece's cut geometry as polygons (arcs every ≤ 0.5 mm, chord error ≤ 0.005 mm), in its own coordinates */
interface LGeo { loops: { pts: number[]; closed: boolean; bb: number[] }[]; bb: number[] }
function lgeo(p: Panel): LGeo {
  const loops = p.loops.filter(isCut).map(l => {
    const pts = sampleLoop(l, 0.005, 0.5)
    const bb = [Infinity, Infinity, -Infinity, -Infinity]
    for (let i = 0; i < pts.length; i += 2) { bb[0] = Math.min(bb[0], pts[i]); bb[1] = Math.min(bb[1], pts[i + 1]); bb[2] = Math.max(bb[2], pts[i]); bb[3] = Math.max(bb[3], pts[i + 1]) }
    return { pts, closed: l.closed, bb }
  })
  const b = cutBox(p.loops)
  return { loops, bb: [b.minX, b.minY, b.maxX, b.maxY] }
}

/** the segments [ax, ay, bx, by, …] of g moved by (dx, dy) that reach into the window w */
function segsIn(g: LGeo, dx: number, dy: number, w: number[]): number[] {
  const out: number[] = []
  for (const l of g.loops) {
    if (l.bb[0] + dx > w[2] || l.bb[2] + dx < w[0] || l.bb[1] + dy > w[3] || l.bb[3] + dy < w[1]) continue
    const P = l.pts, n = P.length / 2, last = l.closed ? n : n - 1
    for (let i = 0; i < last; i++) {
      const ax = P[2 * i] + dx, ay = P[2 * i + 1] + dy, j = (i + 1) % n, bx = P[2 * j] + dx, by = P[2 * j + 1] + dy
      if (Math.min(ax, bx) > w[2] || Math.max(ax, bx) < w[0] || Math.min(ay, by) > w[3] || Math.max(ay, by) < w[1]) continue
      out.push(ax, ay, bx, by)
    }
  }
  return out
}

/** some segment of A comes closer than d to some segment of B */
function closer(A: number[], B: number[], d: number): boolean {
  const na = A.length / 4, nb = B.length / 4
  if (!na || !nb) return false
  const near = (i: number, j: number) => {
    // boxes further apart than d first: most pairs end there
    if (Math.min(A[i], A[i + 2]) - Math.max(B[j], B[j + 2]) >= d || Math.min(B[j], B[j + 2]) - Math.max(A[i], A[i + 2]) >= d) return false
    if (Math.min(A[i + 1], A[i + 3]) - Math.max(B[j + 1], B[j + 3]) >= d || Math.min(B[j + 1], B[j + 3]) - Math.max(A[i + 1], A[i + 3]) >= d) return false
    return segSeg(A[i], A[i + 1], A[i + 2], A[i + 3], B[j], B[j + 1], B[j + 2], B[j + 3]) < d
  }
  if (na * nb <= 40000) {
    for (let i = 0; i < A.length; i += 4) for (let j = 0; j < B.length; j += 4) if (near(i, j)) return true
    return false
  }
  const g = Math.max(2 * d, 2), key = (ix: number, iy: number) => (ix + 1000) * 100000 + iy + 1000
  const cells = new Map<number, number[]>()
  for (let j = 0; j < B.length; j += 4) {
    const x0 = Math.floor(Math.min(B[j], B[j + 2]) / g), x1 = Math.floor(Math.max(B[j], B[j + 2]) / g)
    const y0 = Math.floor(Math.min(B[j + 1], B[j + 3]) / g), y1 = Math.floor(Math.max(B[j + 1], B[j + 3]) / g)
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) { const k = key(ix, iy); const c = cells.get(k); if (c) c.push(j); else cells.set(k, [j]) }
  }
  for (let i = 0; i < A.length; i += 4) {
    const x0 = Math.floor((Math.min(A[i], A[i + 2]) - d) / g), x1 = Math.floor((Math.max(A[i], A[i + 2]) + d) / g)
    const y0 = Math.floor((Math.min(A[i + 1], A[i + 3]) - d) / g), y1 = Math.floor((Math.max(A[i + 1], A[i + 3]) + d) / g)
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) for (const j of cells.get(key(ix, iy)) ?? []) if (near(i, j)) return true
  }
  return false
}

/** (x, y), in g's own coordinates, lies in g's material (even–odd over its closed cuts) */
function inMaterial(g: LGeo, x: number, y: number): boolean {
  let inside = false
  for (const l of g.loops) {
    if (!l.closed || x < l.bb[0] || x > l.bb[2] || y < l.bb[1] || y > l.bb[3]) continue
    const P = l.pts, n = P.length / 2
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = P[2 * i], yi = P[2 * i + 1], xj = P[2 * j], yj = P[2 * j + 1]
      if ((yi > y) !== (yj > y) && x < xi + (xj - xi) * (y - yi) / (yj - yi)) inside = !inside
    }
  }
  return inside
}

export interface CheckPiece { panel: Panel; x: number; y: number }
/**
 * Exact check of pieces on one sheet (W × H): every cut at least margin from the edge, no two pieces closer than
 * spacing − 0.05 anywhere, none inside another's material. Returns the indices of pieces at fault (the later of a pair).
 */
export function checkSheet(pieces: CheckPiece[], W: number, H: number, spacing: number, margin: number, geo?: (i: number) => LGeo): number[] {
  const G = (i: number) => (geo ? geo(i) : (cache[i] ??= lgeo(pieces[i].panel)))
  const cache: LGeo[] = []
  const bad = new Set<number>()
  const d = Math.max(spacing, 0.1) - 0.05, tol = 0.01
  const boxes = pieces.map(pc => { const b = cutBox(pc.panel.loops); return [b.minX + pc.x, b.minY + pc.y, b.maxX + pc.x, b.maxY + pc.y] })
  boxes.forEach((b, i) => { if (b[0] < margin - tol || b[1] < margin - tol || b[2] > W - margin + tol || b[3] > H - margin + tol) bad.add(i) })
  const ord = boxes.map((_, i) => i).sort((a, b) => boxes[a][0] - boxes[b][0] || a - b)
  for (let u = 0; u < ord.length; u++) {
    const a = ord[u], A = boxes[a]
    for (let v = u + 1; v < ord.length; v++) {
      const b = ord[v], B = boxes[b]
      if (B[0] > A[2] + d) break
      if (B[1] > A[3] + d || A[1] > B[3] + d) continue
      const ga = G(a), gb = G(b), pa = pieces[a], pb = pieces[b]
      const win = [Math.max(A[0], B[0]) - d, Math.max(A[1], B[1]) - d, Math.min(A[2], B[2]) + d, Math.min(A[3], B[3]) + d]
      let fault = closer(segsIn(ga, pa.x, pa.y, win), segsIn(gb, pb.x, pb.y, win), d)
      // no edge near the other: a piece wholly inside the other's material (not in a hole) is still wrong
      for (const [g1, p1, g2, p2] of [[ga, pa, gb, pb], [gb, pb, ga, pa]] as const) {
        if (fault) break
        for (const l of g2.loops) if (inMaterial(g1, l.pts[0] + p2.x - p1.x, l.pts[1] + p2.y - p1.y)) { fault = true; break }
      }
      if (fault) bad.add(Math.max(a, b))
    }
  }
  return [...bad].sort((x, y) => x - y)
}

// ---------------------------------------------------------------- the search

/** work units per millisecond of budget (measured on a desktop browser; a slower phone stops on the clock instead) */
const WORK_PER_MS = 30000
/** what the last call did (for tests and tuning) */
export const nestStats = { tries: 0, work: 0, footMs: 0, searchMs: 0, checkMs: 0, cell: 0, repairs: 0 }

function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}


/** the raster cell for a group: fine for small work, coarser when there is a lot of it */
function cellSize(kinds: Kind[], W: number): number {
  let area = 0
  for (const K of kinds) area += K.boxArea * K.src.count
  const c = area < 0.6e6 ? 0.5 : area < 1.5e6 ? 1 : 1.5
  return Math.max(c, W / 20000)
}

interface GroupOut { spots: { panel: Panel; x: number; y: number; copy: number; sheet: number; rot: Rot; sourceId: string }[]; sheets: { w: number; h: number; used: { w: number; h: number } }[]; tooBig: string[] }

function nestGroup(panels: Panel[], sheet: { w: number; h: number }, o: NestOpts, budget: number): GroupOut {
  const t0 = Date.now()
  const rotate = o.rotate !== false, turnFrame = rotate && sheet.w > sheet.h
  const W = turnFrame ? sheet.h : sheet.w, L = turnFrame ? sheet.w : sheet.h
  const m = Math.max(0, o.margin || 0), s = Math.max(o.spacing || 0, 0.1), r = s / 2
  const ks = rotate ? [0, 1, 2, 3] : [0]
  const big: Panel[] = [], kinds: Kind[] = []
  for (const p of panels) {
    if (!(p.count > 0)) continue
    const turned = [0, 1, 2, 3].map(k => {
      const t = rotatePanel(p, k), cb = cutBox(t.loops), cw = cb.maxX - cb.minX, ch = cb.maxY - cb.minY
      return { p: t, cx: cb.minX, cy: cb.minY, cw, ch, fits: ks.includes(k) && cw <= W - 2 * m + 1e-9 && ch <= L - 2 * m + 1e-9 }
    })
    if (!turned.some(t => t.fits)) { big.push(p); continue }
    kinds.push({ idx: kinds.length, src: p, turned, feet: [], forced: false, minCells: 0, boxArea: turned[0].cw * turned[0].ch, long: Math.max(p.w, p.h), short: Math.min(p.w, p.h) })
  }
  const c = cellSize(kinds, W)
  const gw = Math.floor((W - 2 * m + 2 * r) / c + 1e-9), gl = Math.floor((L - 2 * m + 2 * r) / c + 1e-9)
  // a hole stays open only if some piece could go into it
  const keepHole = (w: number, h: number) => kinds.some(K => K.short + 2 * s <= Math.min(w, h) && K.long + 2 * s <= Math.max(w, h))
  const single = kinds.length === 1 && kinds[0].src.count === 1 // one piece: the box packers place it, no raster
  for (const K of kinds) {
    for (const k of single ? [] : ks) {
      const t = K.turned[k]
      if (!t.fits) continue
      const half = k >= 2 && K.turned[k - 2].fits ? K.feet.find(g => g.k === k - 2) ?? (K.forced && K.feet[0].k === k - 2 ? K.feet[0] : null) : null
      const f = half ? reversed(half, K.turned[k - 2].p.w, K.turned[k - 2].p.h, c, r) : footprint(t.p, k, c, r + SAG, r, keepHole)
      if (f.nx > gw || f.ny > gl) { if (!K.feet.length && !K.forced) { K.forced = true; K.feet.push(f) }; continue }
      if (K.forced) { K.forced = false; K.feet = [] }
      if (!K.feet.some(g => sameFoot(g, f))) K.feet.push(f)
    }
    K.minCells = K.feet.length ? Math.min(...K.feet.map(f => f.cells)) : 0
  }
  nestStats.footMs += Date.now() - t0; nestStats.cell = c
  const t1 = Date.now(), w0 = work
  const full: Ctx = { kinds, W, L, m, s, c, r, Wlim: W, gw, gl, ks, workLimit: work + budget * WORK_PER_MS, deadline: t0 + budget * 3 + 50 }
  const items = (ord: Kind[]) => ord.flatMap(K => Array<number>(K.src.count).fill(K.idx))
  const sorted = (f: (a: Kind, b: Kind) => number) => items([...kinds].sort((a, b) => f(a, b) || a.idx - b.idx))
  const orders = [
    sorted((a, b) => b.boxArea - a.boxArea || b.long - a.long),
    sorted((a, b) => b.long - a.long || b.short - a.short),
    sorted((a, b) => b.short - a.short || b.long - a.long),
    sorted((a, b) => b.minCells - a.minCells),
  ]
  let best: Pack | null = null, bestOrder = orders[0], bestCrit = 1, bestCtx = full
  let n = 0
  const offer = (cx: Ctx, p: Pack | null, ord: number[], crit: number) => {
    if (p && better(p, best)) { best = p; bestOrder = ord; bestCrit = crit; bestCtx = cx; return true }
    return false
  }
  // the box packers first: cheap, and the floor any raster result must beat
  const boxes = (cx: Ctx) => {
    for (const ord of orders.slice(0, 2)) for (const rule of [0, 1]) offer(cx, maxRects(cx, ord, rule), ord, -1)
    for (const flat of [false, true]) offer(cx, shelf(cx, orders[0], flat), orders[0], -1)
  }
  // the old layout (rows 400 mm wide, every piece upright) is a candidate too: the result is never worse than it was
  const OLD_W = 400 + 2 * m
  const raster = (cx: Ctx, ord: number[], crit: number) => {
    const p = blf(cx, ord, crit)
    if (p) { n++; nestStats.tries++; offer(cx, p, ord, crit) }
    return !!p
  }
  const nItems = orders[0].length
  if (kinds.length) {
    boxes(full)
    if (OLD_W < W) { const cx = narrow(full, OLD_W); offer(cx, shelf(cx, orders[0], false), orders[0], -1) }
    const tries: [number[], number][] = [[orders[0], 1], [orders[0], 0], [orders[1], 1], [orders[1], 0], [orders[2], 1], [orders[3], 1], [orders[3], 0], [orders[2], 0]]
    let ok = nItems > 1
    for (const [ord, crit] of tries) if (ok) ok = raster(full, ord, crit)
    // a layout on one sheet may waste less as a narrower, longer block: strips down to the widest piece
    if (ok && best!.sheets === 1) {
      const minW = Math.max(...kinds.map(K => Math.min(...K.feet.map(f => f.nx)))) * c + 2 * m - 2 * r
      const sweepLimit = full.workLimit - (full.workLimit - work) * 0.5
      for (let wmm = W * 0.95; wmm >= minW && ok && work < sweepLimit; wmm *= 0.94) {
        const cx = narrow(full, wmm)
        boxes(cx)
        ok = raster(cx, orders[0], 1) && raster(cx, orders[0], 0)
      }
    }
    // then small changes to the best order: two pieces swapped, or one moved; kept when no worse
    const rand = rng(0x5eed + kinds.length * 7919 + nItems)
    let stale = 0
    if (bestCrit < 0) bestCrit = 1
    while (ok && kinds.length > 1 && n < 2000 && stale < 200) {
      const ord = bestOrder.slice(), N = ord.length
      const i = Math.floor(rand() * N), j = Math.floor(rand() * N)
      if (ord[i] === ord[j]) { stale++; continue }
      if (rand() < 0.5) { const t = ord[i]; ord[i] = ord[j]; ord[j] = t } else { const [it] = ord.splice(i, 1); ord.splice(j, 0, it) }
      const crit = rand() < 0.1 ? 1 - bestCrit : bestCrit
      const p = blf(bestCtx, ord, crit)
      if (!p) break
      n++; nestStats.tries++
      if (offer(bestCtx, p, ord, crit)) stale = 0
      else { stale++; if (!better(best!, p)) { bestOrder = ord; bestCrit = crit } }
    }
  }
  nestStats.searchMs += Date.now() - t1; nestStats.work += work - w0
  const t2 = Date.now()
  const spots = best ? repair(full, (best as Pack).spots) : []
  nestStats.checkMs += Date.now() - t2
  // back to the sheet as it lies: the packing frame turned a quarter when the sheet is wider than long
  const outSheets: GroupOut['sheets'] = []
  const nSheets = spots.reduce((a, sp) => Math.max(a, sp.sheet + 1), 0)
  for (let i = 0; i < nSheets; i++) outSheets.push({ w: sheet.w, h: sheet.h, used: { w: 0, h: 0 } })
  const cacheTurn = new Map<string, Panel>()
  const out: GroupOut['spots'] = spots.map(sp => {
    const K = kinds[sp.kind], t = K.turned[sp.k].p
    let panel = t, x = sp.x, y = sp.y, k = sp.k
    if (turnFrame) {
      k = (sp.k + 3) % 4
      const key = `${sp.kind}:${k}`
      panel = cacheTurn.get(key) ?? rotatePanel(K.src, k); cacheTurn.set(key, panel)
      x = sp.y; y = sheet.h - sp.x - t.w
    }
    const u = outSheets[sp.sheet].used
    u.w = Math.max(u.w, x + panel.w); u.h = Math.max(u.h, y + panel.h)
    return { panel, x, y, copy: sp.copy, sheet: sp.sheet, rot: (k * 90) as Rot, sourceId: K.src.id }
  })
  // too big for the sheet either way round: alone on a sheet made big enough, so the file still has it
  for (const p of big) for (let copy = 0; copy < p.count; copy++) {
    const ways = (rotate ? [0, 1] : [0]).map(k => { const t = rotatePanel(p, k), cb = cutBox(t.loops); return { t, k, cb, w: Math.max(sheet.w, cb.maxX - cb.minX + 2 * m), h: Math.max(sheet.h, cb.maxY - cb.minY + 2 * m) } })
    const o1 = ways.reduce((a, b) => (b.w * b.h < a.w * a.h - 1e-6 ? b : a))
    const x = m - o1.cb.minX, y = m - o1.cb.minY
    out.push({ panel: o1.t, x, y, copy, sheet: outSheets.length, rot: (o1.k * 90) as Rot, sourceId: p.id })
    outSheets.push({ w: o1.w, h: o1.h, used: { w: x + o1.t.w, h: y + o1.t.h } })
  }
  return { spots: out, sheets: outSheets, tooBig: big.map(p => p.id) }
}

/** Exact check of a packing; a piece at fault moves past everything on its sheet (or to a new one). Never fails in practice. */
function repair(ctx: Ctx, spots: Spot[]): Spot[] {
  const geo = new Map<string, LGeo>()
  const gOf = (sp: Spot) => { const key = `${sp.kind}:${sp.k}`; let g = geo.get(key); if (!g) { g = lgeo(ctx.kinds[sp.kind].turned[sp.k].p); geo.set(key, g) } return g }
  let cur = spots.slice()
  for (let round = 0; round < 50; round++) {
    const bad: Spot[] = []
    const nS = cur.reduce((a, sp) => Math.max(a, sp.sheet + 1), 0)
    for (let s = 0; s < nS; s++) {
      const on = cur.filter(sp => sp.sheet === s)
      const pcs = on.map(sp => ({ panel: ctx.kinds[sp.kind].turned[sp.k].p, x: sp.x, y: sp.y }))
      for (const i of checkSheet(pcs, ctx.W, ctx.L, ctx.s, ctx.m, i => gOf(on[i]))) bad.push(on[i])
    }
    if (!bad.length) return cur
    nestStats.repairs += bad.length
    cur = cur.filter(sp => !bad.includes(sp))
    for (const sp of bad) {
      const t = ctx.kinds[sp.kind].turned[sp.k]
      let sheet = 0, y = 0
      for (; ; sheet++) {
        const on = cur.filter(q => q.sheet === sheet)
        const top = on.reduce((a, q) => { const u = ctx.kinds[q.kind].turned[q.k]; return Math.max(a, q.y + u.cy + u.ch) }, -Infinity)
        y = on.length ? top + ctx.s + 1 - t.cy : ctx.m - t.cy
        // a fault that stays (round > 3) gets a sheet of its own
        if ((round < 3 || !on.length) && y + t.cy + t.ch <= ctx.L - ctx.m) break
      }
      cur.push({ ...sp, sheet, x: ctx.m - t.cx, y })
    }
  }
  throw new Error('nest: the layout could not be made valid')
}

/** Packs the panels (every copy) on sheets, each material on its own sheets, by their true outlines. */
export function nest(panels: Panel[], opts: NestOpts): NestResult {
  Object.assign(nestStats, { tries: 0, work: 0, footMs: 0, searchMs: 0, checkMs: 0, cell: 0, repairs: 0 })
  const budget = Math.max(1, opts.budgetMs ?? 250)
  const keys: string[] = []
  for (const p of panels) { const k = p.material ?? ''; if (!keys.includes(k)) keys.push(k) }
  keys.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : 0))
  const area = (p: Panel) => Math.max(1, p.w * p.h) * Math.max(0, p.count)
  const total = panels.reduce((a, p) => a + area(p), 0) || 1
  const res: NestResult = { placed: [], sheets: [], tooBig: [] }
  // a piece with no outline drawn (a bare size) nests as its w × h rectangle
  panels = panels.map(p => (p.loops.some(l => isCut(l) && l.closed) ? p : { ...p, loops: [...p.loops, { closed: true, pts: [{ x: 0, y: 0 }, { x: p.w, y: 0 }, { x: p.w, y: p.h }, { x: 0, y: p.h }] }] }))
  for (const key of keys) {
    const group = panels.filter(p => (p.material ?? '') === key)
    // time shared by area; a small group (a few mirror pieces) still gets enough for a proper search
    const share = Math.max(budget * group.reduce((a, p) => a + area(p), 0) / total, Math.min(budget, 15))
    const g = nestGroup(group, opts.sheet(key || undefined), opts, share)
    const base = res.sheets.length
    g.sheets.forEach((sh, i) => res.sheets.push({ index: base + i, ...(key ? { material: key } : {}), w: sh.w, h: sh.h, used: sh.used }))
    for (const sp of g.spots) res.placed.push({ ...sp, sheet: base + sp.sheet })
    res.tooBig.push(...g.tooBig)
  }
  return res
}

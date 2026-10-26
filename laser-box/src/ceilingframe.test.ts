import { describe, it, expect } from 'vitest'
import { CEILING_FRAMES, frameGeom, framePieces, midPieces, midToFrame, cornerPlate, toFrame, CLEAT_REACH, minPatternWidth, minCell, rosetteDims, starDims, ROSE, STAR, decorPieces, medallion2, medDims2, stripCuts, splitPlan, cutAtJoints, setFrameParams, NEST_MARGIN } from './ceilingframe'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, Loop } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, selfIntersects, segsCross, offSheet } from './testutil'

const [T1, T2, T3] = CEILING_FRAMES
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
type P = { x: number; y: number }
type Pn = { id: string; name: string; w: number; h: number; count: number; loops: Loop[]; material?: string }
type Dz = { panels: Pn[]; errors: string[]; warnings: string[]; notes: string[]; layout: never }
type Tp = typeof T1
const gen = (p: Record<string, number>, s: Partial<typeof S0> = {}, tpl: Tp = T1) => generate(tpl, p, { ...S0, ...s }) as never as Dz
const cutOf = (pn: Pn) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const get = (d: { panels: Pn[] }, id: string) => d.panels.find(x => x.id === id)!
const full = (p: Record<string, number>, tpl: Tp = T1) => ({ ...tpl.defaults, ...p })
const SECOND = { PW: 1380, PH: 1080 }
const THICK = [2, 2.7, 3, 3.2, 4, 6]
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const lab = (p: Record<string, number>, tpl: Tp = T1) => `${tpl.id} ${JSON.stringify(p)}`

type Box = { minX: number; minY: number; maxX: number; maxY: number }
const boxOf = (pts: P[]): Box => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const q of pts) { if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x; if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y }
  return { minX, minY, maxX, maxY }
}
const apart = (a: Box, b: Box, d: number) => a.minX > b.maxX + d || b.minX > a.maxX + d || a.minY > b.maxY + d || b.minY > a.maxY + d
const ptSeg = (p: P, a: P, b: P) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
/**
 * The gap between two polygons (0 when they cross or one holds the other), exact for the polygons but quick: only the
 * vertices and edges within `d` of the other's box are compared, and anything at `d` or more comes back as `d`.
 */
function gapUnder(A: P[], B: P[], d: number, a = boxOf(A), b = boxOf(B)): number {
  if (apart(a, b, d)) return d
  const edgesNear = (X: P[], box: Box) => X.map((q, i) => [q, X[(i + 1) % X.length]] as const).filter(([p, q]) => !apart(boxOf([p, q]), box, d))
  const ea = edgesNear(A, b), eb = edgesNear(B, a)
  if (pointIn(A[0], B) || pointIn(B[0], A)) return 0
  let best = d
  for (const [p, q] of ea) for (const [r, s] of eb) {
    if (segsCross(p, q, r, s)) return 0
    best = Math.min(best, ptSeg(p, r, s), ptSeg(q, r, s), ptSeg(r, p, q), ptSeg(s, p, q))
  }
  return best
}
/** The narrowest width of a polygon (of its convex hull). */
function widthOf(pts: P[]): number {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y), cr = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lo: P[] = [], up: P[] = []
  for (const p of s) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p) }
  for (const p of s.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p) }
  const h = [...lo.slice(0, -1), ...up.slice(0, -1)]
  let w = Infinity
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length], l = Math.hypot(b.x - a.x, b.y - a.y)
    if (l < 1e-9) continue
    let m = 0
    for (const q of h) m = Math.max(m, Math.abs(((q.x - a.x) * (b.y - a.y) - (q.y - a.y) * (b.x - a.x)) / l))
    w = Math.min(w, m)
  }
  return w
}

/**
 * The gridsuite's soundness checks, quick enough for thousands of holes: one outer loop, no self-intersection, every
 * hole inside with `edge` mm to the outline and `gap` mm to every other hole, no sliver (a hole under 1.5 mm across or
 * 3 mm²), no zero-length edges, a DXF without NaN.
 */
function soundness(d: Dz, label: string, gap = 0.8, edge = 0.8, step = 6): string[] {
  const bad: string[] = []
  for (const pn of d.panels) {
    const lb = `${label} ${pn.id}`
    if (!(pn.w > 0)) bad.push(`${lb} width`)
    const outers = cutOf(pn).filter(l => signedArea(l) > 0)
    if (outers.length !== 1) { bad.push(`${lb} ${outers.length} outer loops`); continue }
    const outer = samplePoly(outers[0], 2), ob = boxOf(outer)
    const rectOuter = outer.length === 4 && outer.every((q, i) => { const r = outer[(i + 1) % 4]; return Math.abs(q.x - r.x) < 1e-9 || Math.abs(q.y - r.y) < 1e-9 })
    if (selfIntersects(outer)) bad.push(`${lb} self-intersects`)
    for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; if (Math.hypot(q.x - outer[i].x, q.y - outer[i].y) <= 1e-6) bad.push(`${lb} zero-length edge`) }
    const hs = cutOf(pn).filter(l => signedArea(l) < 0).map(h => { const p = samplePoly(h, step); return { p, b: boxOf(p), a: -signedArea(h), l: h } })
    for (const h of hs) {
      for (let i = 0; i < h.l.pts.length; i++) { const p = h.l.pts[i], q = h.l.pts[(i + 1) % h.l.pts.length]; if (Math.hypot(q.x - p.x, q.y - p.y) <= 1e-6) { bad.push(`${lb} hole zero-length edge`); break } }
      if (selfIntersects(h.p)) bad.push(`${lb} hole self-intersects`)
      // on a rectangle only the holes near its sides are measured against it
      if (!rectOuter || h.b.minX - ob.minX < edge + 2 || ob.maxX - h.b.maxX < edge + 2 || h.b.minY - ob.minY < edge + 2 || ob.maxY - h.b.maxY < edge + 2) {
        if (h.p.some(q => !pointIn(q, outer))) bad.push(`${lb} hole outside`)
        let de = Infinity
        for (const q of h.p) for (let i = 0; i < outer.length; i++) de = Math.min(de, ptSeg(q, outer[i], outer[(i + 1) % outer.length]))
        if (de < edge - 0.02) bad.push(`${lb} hole ${de.toFixed(2)} from the edge`)
      }
      const across = Math.min(h.b.maxX - h.b.minX, h.b.maxY - h.b.minY, widthOf(h.p)) // a hull is never narrower than its shape
      if (h.a < 3 || across < 1.5) bad.push(`${lb} sliver hole (${h.a.toFixed(2)} mm², ${across.toFixed(2)} mm)`)
    }
    // a grid of 30 mm cells: each pair of holes is compared once
    const C = 30, cells = new Map<string, number[]>()
    hs.forEach((h, i) => {
      for (let cx = Math.floor((h.b.minX - gap) / C); cx <= Math.floor((h.b.maxX + gap) / C); cx++) for (let cy = Math.floor((h.b.minY - gap) / C); cy <= Math.floor((h.b.maxY + gap) / C); cy++) {
        const k = `${cx},${cy}`
        if (!cells.has(k)) cells.set(k, [])
        cells.get(k)!.push(i)
      }
    })
    const seen = new Set<number>()
    for (const ids of cells.values()) for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
      const i = Math.min(ids[x], ids[y]), j = Math.max(ids[x], ids[y]), key = i * 100000 + j
      if (seen.has(key)) continue
      seen.add(key)
      const g = gapUnder(hs[i].p, hs[j].p, gap, hs[i].b, hs[j].b)
      if (g < gap - 0.02) bad.push(`${lb} holes ${g.toFixed(2)} apart`)
    }
    for (const l of pn.loops) for (const q of l.pts) if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) bad.push(`${lb} non-finite`)
  }
  const dxf = toDXF(d.layout)
  if (dxf.includes('NaN') || dxf.includes('undefined')) bad.push(`${label} dxf`)
  return bad
}

/** The band's cut-outs (as built, no kerf) in frame coordinates, side by side: 0 top, 1 right, 2 bottom, 3 left. */
function frameHoles(p: Record<string, number>, tpl: Tp = T1) {
  const q = full({ kind: 2, ...p }, tpl), res = tpl.build(q, { t: 3, kerf: 0, finger: 0, inner: false }), g = frameGeom(q)
  if (res.errors?.length) return { res, g, strips: [], field: [] }
  const strips = [0, 1, 2, 3].map(s => res.panels.find(x => x.id === (s % 2 ? 'strip-short' : 'strip-long'))!.holes!.map(h => samplePoly({ ...h, pts: h.pts.map(v => ({ ...v, ...toFrame(g, s, v) })) }, 6)))
  const field = res.panels.find(x => x.id === 'field')?.holes?.map(h => samplePoly(h, 6).map(v => ({ x: v.x + g.b + g.fit, y: v.y + g.b + g.fit }))) ?? []
  return { res, g, strips, field }
}
const R4 = (x0: number, y0: number, x1: number, y1: number): P[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
const cen = (h: P[]) => h.reduce((a, q) => ({ x: a.x + q.x / h.length, y: a.y + q.y / h.length }), { x: 0, y: 0 })

/**
 * What the strips (kind 2) must hold, on the pieces as built (no kerf): the rim on the gypsum and the strips' inner
 * rails solid, no cut-out within `web` of a mitre, the field sized to the frame's opening less the fit with its
 * margins solid, no corner plate or glue strip over a cut-out, and each corner a mirror image about its mitre (to
 * within the difference of the two strips' steps). The problems found, as text.
 */
function frameChecks(p: Record<string, number>, tpl: Tp = T1): string[] {
  const bad: string[] = []
  const { res, g, strips, field } = frameHoles(p, tpl)
  if (res.errors?.length) return bad
  for (const s of [0, 1]) {
    const L = s ? g.PH : g.PW
    for (const h of res.panels.find(x => x.id === (s ? 'strip-short' : 'strip-long'))!.holes!) {
      const sp = samplePoly(h, 3)
      const minV = Math.min(...sp.map(q => q.y)), maxV = Math.max(...sp.map(q => q.y))
      const dm = Math.min(...sp.map(q => Math.min(q.x - q.y, L - q.x - q.y) / Math.SQRT2))
      if (minV < g.ov + g.web - 1e-3) bad.push(`hole in the rim on the gypsum (v = ${minV.toFixed(2)})`)
      if (maxV > g.b - g.rail + 1e-3) bad.push(`hole in the inner rail (v = ${maxV.toFixed(2)})`)
      if (dm < g.web - 1e-3) bad.push(`hole ${dm.toFixed(2)} from a mitre`)
    }
  }
  const fp = res.panels.find(x => x.id === 'field')
  if (fp) {
    if (Math.abs(fp.w - (g.PW - 2 * g.b - 2 * g.fit)) > 1e-3 || Math.abs(fp.h - (g.PH - 2 * g.b - 2 * g.fit)) > 1e-3) bad.push('field size')
    const m = field.flat().reduce((a, q) => Math.min(a, q.x - g.b - g.fit, g.PW - g.b - g.fit - q.x, q.y - g.b - g.fit, g.PH - g.b - g.fit - q.y), Infinity) // (a spread overflows the stack on a big field)
    if (m < CLEAT_REACH + g.web - 1e-3) bad.push(`field cut-out ${m.toFixed(2)} from the field's edge`)
  }
  const all = [...strips.flat(), ...field].map(h => ({ p: h, b: boxOf(h) }))
  const covers = (pl: P[], what: string) => { const b = boxOf(pl); for (const h of all) if (gapUnder(pl, h.p, 0.5, b, h.b) < 0.5) { bad.push(`${what} over a cut-out`); return } }
  if (res.panels.some(x => x.id === 'corner')) {
    const plate = cornerPlate(g)!
    for (const f of [(q: P) => q, (q: P) => ({ x: g.PW - q.x, y: q.y }), (q: P) => ({ x: g.PW - q.x, y: g.PH - q.y }), (q: P) => ({ x: q.x, y: g.PH - q.y })]) covers(plate.pts.map(f), 'corner plate')
  }
  const cl = res.panels.find(x => x.id === 'cleat-long'), cs = res.panels.find(x => x.id === 'cleat-short')
  if (cl) {
    const co = CLEAT_REACH, { b, PW, PH } = g
    // the long strips run along the top and bottom joints, co onto the strip and the rest onto the field
    covers(R4(b - co, b - co, b - co + cl.w, b - co + cl.h), 'long glue strip')
    covers(R4(b - co, PH - b + co - cl.h, b - co + cl.w, PH - b + co), 'long glue strip')
    if (cs) {
      const y0 = (PH - cs.w) / 2
      covers(R4(b - co, y0, b - co + cs.h, y0 + cs.w), 'short glue strip')
      covers(R4(PW - b + co - cs.h, y0, PW - b + co, y0 + cs.w), 'short glue strip')
      if (y0 < b - co + cl.h - 1e-6) bad.push('the short glue strips run into the long ones')
    }
  }
  // the top-left corner: every cut-out of the top strip near it has one of the left strip mirrored in y = x, and back
  const tol = 2 * Math.abs(g.p1 - g.p2) + 0.05
  const T = strips[0].map(cen), Lf = strips[3].map(cen)
  for (const [A, B, k] of [[T, Lf, 'x'], [Lf, T, 'y']] as const) for (const c of A) if (c[k] < g.b + 10 && !B.some(o => Math.hypot(o.x - c.y, o.y - c.x) <= tol)) bad.push(`corner cut-out at ${c.x.toFixed(1)},${c.y.toFixed(1)} has no mirror image`)
  return bad
}

/**
 * What the one-piece board (kind 1) must hold, as built (no kerf): the rim on the gypsum solid; no cut-out crossing or
 * within `web` of a corner's diagonal in the band; a solid strap of 2·web between the band and the field; each corner
 * a mirror image about its diagonal (to within the difference of the two steps); the board a mirror image about both
 * centre lines; the engraved lines on the diagonals. The problems found, as text.
 */
function boardChecks(p: Record<string, number>, tpl: Tp = T1): string[] {
  const bad: string[] = [], q = full({ kind: 1, ...p }, tpl), g = frameGeom(q)
  const res = tpl.build(q, { t: 3, kerf: 0, finger: 0, inner: false })
  if (res.errors?.length) return bad
  const board = res.panels.find(x => x.id === 'board')!
  if (Math.abs(board.w - g.PW) > 1e-6 || Math.abs(board.h - g.PH) > 1e-6) bad.push('board size')
  const holes = board.holes!.map(h => samplePoly(h, 4)), { PW, PH, b, web, ov } = g
  const dEdge = (v: P) => Math.min(v.x, v.y, PW - v.x, PH - v.y)
  // the four corners folded onto the top-left one
  const fold = (v: P) => ({ x: Math.min(v.x, PW - v.x), y: Math.min(v.y, PH - v.y) })
  for (const h of holes) {
    let rim = Infinity, strap = false, diag = Infinity
    for (const v of h) {
      const d = dEdge(v), f = fold(v)
      rim = Math.min(rim, d)
      if (d > b - web + 1e-3 && d < b + web - 1e-3) strap = true
      if (f.x < b + 1e-6 && f.y < b + 1e-6) diag = Math.min(diag, Math.abs(f.x - f.y) / Math.SQRT2)
    }
    if (rim < ov + web - 1e-3) bad.push(`hole ${rim.toFixed(2)} from the board's edge`)
    if (strap) bad.push(`hole in the strap between the band and the field at ${cen(h).x.toFixed(1)},${cen(h).y.toFixed(1)}`)
    if (diag < web - 1e-3) bad.push(`hole ${diag.toFixed(2)} from a diagonal at ${cen(h).x.toFixed(1)},${cen(h).y.toFixed(1)}`)
  }
  // mirror images: about both centre lines (exact), and about the diagonal in each corner of the band
  const cs = holes.map(cen), grid = new Map<string, P[]>(), K = 5, key = (v: P) => `${Math.round(v.x / K)},${Math.round(v.y / K)}`
  for (const c of cs) { const k = key(c); if (!grid.has(k)) grid.set(k, []); grid.get(k)!.push(c) }
  const near = (v: P, tol: number) => { const i = Math.round(v.x / K), j = Math.round(v.y / K), r = Math.ceil(tol / K) + 1; for (let a = i - r; a <= i + r; a++) for (let c = j - r; c <= j + r; c++) for (const o of grid.get(`${a},${c}`) ?? []) if (Math.hypot(o.x - v.x, o.y - v.y) <= tol) return true; return false }
  const tol = 2 * Math.abs(g.p1 - g.p2) + 0.05
  for (const c of cs) {
    if (!near({ x: PW - c.x, y: c.y }, 0.02) || !near({ x: c.x, y: PH - c.y }, 0.02)) bad.push(`cut-out at ${c.x.toFixed(1)},${c.y.toFixed(1)} has no mirror image across a centre line`)
    if (c.x < b && c.y < b && !near({ x: c.y, y: c.x }, tol)) bad.push(`corner cut-out at ${c.x.toFixed(1)},${c.y.toFixed(1)} has no mirror image across the diagonal`)
  }
  const eng = (board.engrave ?? []) as Loop[]
  if ((q.line >= 0.5 ? 4 : 0) !== eng.length) bad.push(`${eng.length} engraved lines`)
  for (const l of eng) { const [a, z] = l.pts; if (Math.abs(Math.abs(z.x - a.x) - b) > 1e-3 || Math.abs(Math.abs(z.y - a.y) - b) > 1e-3) bad.push('engraved line off the diagonal') }
  return bad
}

/**
 * How well the field is covered: on a grid over the field (inside its solid margin, outside the medallion and the
 * strap round it), the farthest any point is from a cut-out of the field (mm), and where. Kind 1: board coordinates;
 * kind 2: the field panel's.
 */
function coverage(p: Record<string, number>, tpl: Tp = T1): { worst: number; at: P; lattice: number } {
  const q = full(p, tpl), g = frameGeom(q), { med, lat, center } = decorPieces(q, g)
  const pts: P[] = []
  for (const pc of [...med, ...lat]) {
    const s = samplePoly({ closed: true, pts: pc.pts }, 6)
    for (let i = 0; i < s.length; i++) { const a = s[i], z = s[(i + 1) % s.length], n = Math.max(1, Math.ceil(Math.hypot(z.x - a.x, z.y - a.y) / 3)); for (let k = 0; k < n; k++) pts.push({ x: a.x + ((z.x - a.x) * k) / n, y: a.y + ((z.y - a.y) * k) / n }) }
  }
  const K = 20, grid = new Map<string, P[]>()
  for (const v of pts) { const k = `${Math.floor(v.x / K)},${Math.floor(v.y / K)}`; if (!grid.has(k)) grid.set(k, []); grid.get(k)!.push(v) }
  const nearest = (v: P) => {
    let best = Infinity
    for (let r = 0; r < 40 && best > (r - 1) * K; r++) {
      const i0 = Math.floor(v.x / K), j0 = Math.floor(v.y / K)
      for (let i = i0 - r; i <= i0 + r; i++) for (let j = j0 - r; j <= j0 + r; j++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue
        for (const o of grid.get(`${i},${j}`) ?? []) best = Math.min(best, Math.hypot(o.x - v.x, o.y - v.y))
      }
    }
    return best
  }
  const X = g.Wf / 2 - g.fm, Y = g.Hf / 2 - g.fm, step = q.fcell / 6, A = q.med / 2 + g.web
  const inMed = (dx: number, dy: number) => g.center !== 3 && (g.style === 1 ? [0, 1, 2, 3, 4, 5, 6, 7].every(k => Math.abs(dx * Math.cos((k * Math.PI) / 4) + dy * Math.sin((k * Math.PI) / 4)) <= A) : Math.hypot(dx, dy) <= A)
  let worst = 0, at = { x: 0, y: 0 }
  for (let dx = -X; dx <= X + 1e-9; dx += Math.max(step, (2 * X) / 200)) for (let dy = -Y; dy <= Y + 1e-9; dy += Math.max(step, (2 * Y) / 200)) {
    if (inMed(dx, dy)) continue
    const v = { x: center.x + dx, y: center.y + dy }, d = nearest(v)
    if (d > worst) { worst = d; at = v }
  }
  return { worst, at, lattice: lat.length }
}

describe('ceiling decor', () => {
  it('builds both designs at their defaults, one piece or strips, on every common sheet with no errors or warnings, quickly', () => {
    for (const tpl of [T1, T2]) for (const kind of [1, 2]) for (const t of THICK) for (const kerf of [0, 0.2]) {
      const d = gen(kind === 1 ? {} : { kind }, { t, kerf }, tpl), lb = `${tpl.id} kind ${kind} t=${t} kerf=${kerf}`
      expect(d.errors, lb).toEqual([])
      expect(d.warnings, lb).toEqual([])
    }
    expect(T1.defaults.style).toBe(1)
    expect(T2.defaults.style).toBe(2)
    for (const tpl of [T1, T2]) {
      expect(tpl.defaults.kind).toBe(1)
      gen({}, {}, tpl)
      const t0 = performance.now()
      gen({}, { kerf: 0.2 }, tpl)
      expect(performance.now() - t0, tpl.id).toBeLessThan(300)
    }
    expect(T2.id).toBe('ceilingframe2')
    expect(T2.name).toBe('ديكور سقف: إطار نجوم ثمانية ودائرة')
    for (const w of ['سقف', 'جبس', 'إضاءة', 'ديكور', 'نجوم', 'دائرة']) expect(T2.desc, w).toContain(w)
    expect(T1.params).toBe(T2.params)
  }, 30000)

  it('cuts each decor as one board that fits the 2440 × 1220 sheet, and refuses one bigger than the sheet with a size that fits', () => {
    for (const tpl of [T1, T2]) for (const [p, W, H] of [[{}, 1400, 1050], [SECOND, 1380, 1080]] as const) {
      const d = gen(p, {}, tpl)
      expect(d.panels.map(x => `${x.id}×${x.count}`), lab(p, tpl)).toEqual(['board×1'])
      const bd = get(d, 'board')
      expect(bd.w).toBeCloseTo(W, 6)
      expect(bd.h).toBeCloseTo(H, 6)
      expect(Math.max(bd.w, bd.h) <= 2440 && Math.min(bd.w, bd.h) <= 1220).toBe(true)
      expect(cutOf(bd).filter(l => signedArea(l) < 0).length).toBeGreaterThan(1500)
      // the separate medallion is its own piece, and the acrylic its own sheet
      expect(gen({ ...p, center: 2 }, {}, tpl).panels.map(x => x.id)).toEqual(['board', 'medallion'])
      expect(gen({ ...p, back: 1 }, {}, tpl).panels.map(x => `${x.id}:${x.material ?? ''}`)).toEqual(['board:', 'back:white'])
    }
    for (const tpl of [T1, T2]) {
      const p = { PW: 1300, PH: 2500 }, d = gen(p, {}, tpl), e = d.errors.find(x => /لا يتّسع في لوح/.test(x))
      expect(e, d.errors.join(' | ')).toMatch(/اجعله 1220 × 2440 مم على الأكثر/)
      expect(gen({ PW: 1220, PH: 2440 }, {}, tpl).errors.filter(x => /لا يتّسع في لوح/.test(x))).toEqual([])
      // a decor the strips can make: it says so too, and that clears it
      const e2 = gen({ PW: 2400, PH: 1300 }, {}, tpl).errors.find(x => /لا يتّسع في لوح/.test(x))!
      expect(e2).toMatch(/اجعل الطول الكلّي 1220 مم على الأكثر، أو اختر «أربع شرائح بزوايا 45 ولوح وسط»/)
      expect(gen({ PW: 2400, PH: 1300, kind: 2 }, {}, tpl).errors).toEqual([])
    }
  })

  it('cuts the strips, the field, corner plates and glue strips in the strips mode, each on a 2440 × 1220 sheet', () => {
    for (const tpl of [T1, T2]) for (const [p, W, H] of [[{ kind: 2 }, 1400, 1050], [{ ...SECOND, kind: 2 }, 1380, 1080]] as const) {
      const d = gen(p, {}, tpl), g = frameGeom(full(p, tpl))
      expect(d.panels.map(x => `${x.id}×${x.count}`), lab(p, tpl)).toEqual(['strip-long×2', 'strip-short×2', 'field×1', 'corner×4', 'cleat-long×2', 'cleat-short×2'])
      expect(get(d, 'strip-long').w).toBeCloseTo(W, 6)
      expect(get(d, 'strip-short').w).toBeCloseTo(H, 6)
      expect(get(d, 'field').w).toBeCloseTo(W - 340 - 0.4, 6)
      expect(get(d, 'field').h).toBeCloseTo(H - 340 - 0.4, 6)
      for (const pn of d.panels) expect(Math.max(pn.w, pn.h) <= 2440 && Math.min(pn.w, pn.h) <= 1220, pn.id).toBe(true)
      const o = cutOf(get(d, 'strip-long')).find(l => signedArea(l) > 0)!.pts
      expect(o.map(q => `${Math.round(q.x)},${Math.round(q.y)}`).sort()).toEqual(['0,0', '170,170', `${W - 170},170`, `${W},0`].sort())
      // whole motifs between the corners, both steps alike
      if (tpl === T1) { expect(g.n1 - 1).toBe(10); expect(g.n2 - 1).toBe(7) }
      expect(Math.abs(g.p1 - g.p2) / g.p1).toBeLessThan(0.04)
    }
  })

  it('fits both decors with 0, 30 or 60 mm on the gypsum and every centre, in both modes and both designs', () => {
    for (const tpl of [T1, T2]) for (const size of [{}, SECOND]) for (const ov of [0, 30, 60]) for (const center of [1, 2, 3]) for (const kind of [1, 2]) {
      const p = { ...size, ov, center, kind }, d = gen(p, { kerf: 0.2 }, tpl), lb = lab(p, tpl)
      expect(d.errors, lb).toEqual([])
      expect(d.warnings.filter(w => !(kind === 2 && ov === 0 && /قطع الزوايا/.test(w))), lb).toEqual([])
      for (const pn of d.panels) expect(Math.max(pn.w, pn.h) <= 2440 && Math.min(pn.w, pn.h) <= 1220, `${lb} ${pn.id}`).toBe(true)
      expect(kind === 1 ? boardChecks(p, tpl) : frameChecks(p, tpl), lb).toEqual([])
    }
  }, 60000)

  it('is sound at the defaults and for both decors, thin and thick, with and without kerf; webs never under web', () => {
    for (const tpl of [T1, T2]) for (const p of ([{}, SECOND, { center: 2 }, { center: 3, line: 1 }, { kind: 2 }, { kind: 2, center: 3, cleats: 0 }, { back: 1, fill: 0 }] as Record<string, number>[])) for (const [t, kerf] of [[3, 0], [6, 0.2]]) {
      const d = gen(p, { t, kerf }, tpl)
      expect(d.errors).toEqual([])
      // at kerf 0 every web is at least `web` (3 mm); with the kerf the holes' paths move 0.1 mm into them
      const w = kerf ? 3 + kerf : 3
      expect(soundness(d, `${lab(p, tpl)} t=${t} kerf=${kerf}`, w, w), lab(p, tpl)).toEqual([])
    }
  }, 60000)

  it('keeps every web at least web to the hundredth, also on short strips round the corners', () => {
    // short strips (one or two steps) put the far corner and the strip's middle next to the corner pieces
    for (const tpl of [T1, T2]) for (const p of [{}, { kind: 2 }, { web: 2, center: 3, ov: 0, PH: 391, band: 150, med: 150 }, { web: 5, center: 3, ov: 0, PH: 363, band: 150, med: 150, kind: 2 },
      { ov: 65, band: 131, center: 3, PW: 1054, PH: 1791, kind: 2 }, { web: 8, band: 260, fcell: 120 }, { web: 2, fcell: 45 }] as Record<string, number>[]) {
      const d = gen(p, {}, tpl)
      expect(d.errors, lab(p, tpl)).toEqual([])
      const web = full(p, tpl).web
      expect(soundness(d, lab(p, tpl), web + 0.01, web + 0.01, 3), lab(p, tpl)).toEqual([])
    }
  }, 60000)

  it('never lets a clipped shape grow into a web: a short edge goes with its convex corner, not by filling a notch', () => {
    // the corner star cut on its diagonal, on the board and on the strips: a notch filled in took up to 0.16 mm off a web
    for (const p of [{ PW: 604, PH: 771, ov: 46, band: 164, med: 203, web: 5, fcell: 50 }, { PW: 530, PH: 698, ov: 17, band: 143, kind: 2, med: 164, web: 5, fcell: 129 },
      { PW: 691, PH: 675, ov: 7, band: 99, med: 222, web: 4, fcell: 54 }] as Record<string, number>[]) {
      const d = gen(p, {}, T2)
      expect(d.errors, lab(p, T2)).toEqual([])
      expect(soundness(d, lab(p, T2), p.web + 0.005, p.web + 0.005, 1), lab(p, T2)).toEqual([])
    }
    // the field's stars cut by the strap round the medallion: an inner star and a kite of one star both clipped there
    const q = full({ PW: 2190, PH: 1495, ov: 0, band: 226, kind: 2, med: 317, fit: 1.4, fcell: 32 }, T2), { lat } = decorPieces(q)
    const polys = lat.map(pc => { const s = samplePoly({ closed: true, pts: pc.pts }, 1); return { s, b: boxOf(s), cut: pc.key.endsWith('~') } })
    let worst = Infinity
    for (const a of polys) if (a.cut) for (const o of polys) if (o !== a && !apart(a.b, o.b, 3)) worst = Math.min(worst, gapUnder(a.s, o.s, 3, a.b, o.b))
    expect(worst).toBeGreaterThan(3 - 0.003)
  }, 30000)

  it('carries the same pattern on both halves of every strip, and the corner is a mirror image about the mitre', () => {
    // (the last: two steps 1 mm apart, at which the shapes in the cross's notches fit one strip whole and the other only shrunk)
    for (const tpl of [T1, T2]) for (const kind of [1, 2]) for (const p of ([{}, SECOND, { band: 230, ov: 50 }, { PW: 900, PH: 640, band: 120, center: 3 }, { PW: 1490, PH: 1262, ov: 17, band: 312, web: 5, center: 3 }] as Record<string, number>[])) {
      const g = frameGeom(full({ ...p, kind }, tpl)), { top, side } = framePieces(g), lb = lab({ ...p, kind }, tpl)
      for (const [pcs, L] of [[top, g.PW], [side, g.PH]] as const) {
        // the mirror image of every shape in the strip's middle is a shape of the same kind
        const at = new Map<string, P[]>()
        for (const pc of pcs) { const k = pc.key; if (!at.has(k)) at.set(k, []); at.get(k)!.push(pc.c) }
        for (const pc of pcs) expect(at.get(pc.key)!.some(q => Math.hypot(q.x - (L - pc.c.x), q.y - pc.c.y) < 1e-6), `${lb} ${pc.key} mirrored`).toBe(true)
        // whole motifs, evenly spaced: the rosettes' dots or the stars' inner stars
        const dots = pcs.filter(pc => /^r\d+(dot|s)$/.test(pc.key)).map(pc => pc.c.x).sort((a, b) => a - b)
        expect(dots.length, lb).toBe(Math.round((L - 2 * g.vc) / (L === g.PW ? g.p1 : g.p2)) - 1)
        for (let i = 1; i < dots.length; i++) expect(dots[i] - dots[i - 1]).toBeCloseTo(L === g.PW ? g.p1 : g.p2, 6)
        // a whole number of motifs, symmetric about the strip's middle
        expect(Math.abs(dots[0] - g.vc - (L === g.PW ? g.p1 : g.p2)) < 1e-6 && Math.abs(L - dots[dots.length - 1] - dots[0]) < 1e-6, lb).toBe(true)
      }
      // the top strip's first corner and the left strip's last corner (frame coordinates), reflected in y = x
      const lim = g.b + 5 + Math.max(g.p1, g.p2) / 2, T = top.map(pc => ({ ...pc, f: toFrame(g, 0, pc.c), poly: pc.poly.map(q => toFrame(g, 0, q)) }))
      const Lf = side.map(pc => ({ ...pc, f: toFrame(g, 3, pc.c), poly: pc.poly.map(q => toFrame(g, 3, q)) }))
      const tol = 2 * Math.abs(g.p1 - g.p2) + 1e-6 // shapes up to two steps from the corner move with the step
      for (const [A, B] of [[T.filter(pc => pc.f.x < lim), Lf], [Lf.filter(pc => pc.f.y < lim), T]]) for (const pc of A) {
        const m = B.find(o => o.key === pc.key && Math.hypot(o.f.x - pc.f.y, o.f.y - pc.f.x) <= tol)
        expect(m, `${lb} ${pc.key} at ${pc.f.x.toFixed(1)},${pc.f.y.toFixed(1)} has no mirror image`).toBeTruthy()
        // the corner motif and its kites do not depend on the steps: exact mirror images
        if (/^(C|K)/.test(pc.key)) for (let i = 0; i < pc.poly.length; i++) {
          const q = pc.poly[i], r = m!.poly.reduce((best, o) => Math.min(best, Math.hypot(o.x - q.y, o.y - q.x)), Infinity)
          expect(r).toBeLessThan(1e-6)
        }
        // the shapes between the corner motif and the first whole one: the same size on both strips (only their
        // places follow the step), so neither strip shrinks a set that the other keeps whole
        const near = (o: typeof pc) => Math.min(o.f.x, o.f.y) < g.vc + Math.min(g.p1, g.p2) - 1e-6
        if (m && near(pc) && !/^(C|K|r)/.test(pc.key)) {
          const a = boxOf(pc.poly), z = boxOf(m.poly)
          expect(Math.max(Math.abs((a.maxX - a.minX) - (z.maxY - z.minY)), Math.abs((a.maxY - a.minY) - (z.maxX - z.minX))), `${lb} ${pc.key} at ${pc.f.x.toFixed(1)},${pc.f.y.toFixed(1)} size`).toBeLessThan(1.02 * Math.abs(g.p1 - g.p2) + 0.01) // (a round shape's polygon holds it: a little over its size)
        }
      }
      // the corner motif sits on the mitre; neither of its halves has a piece across it
      const cr = top.filter(pc => pc.key.startsWith('C'))
      expect(cr.length).toBeGreaterThan(10)
      if (tpl === T1) expect(cr.some(pc => pc.key === 'Cp2' || pc.key === 'Cp10')).toBe(false)
    }
  })

  it('assembles into the frame: the four strips tile it along the mitres, and all four corners are alike', () => {
    for (const tpl of [T1, T2]) for (const p of ([{}, SECOND] as Record<string, number>[])) {
      const { res, g, strips } = frameHoles(p, tpl)
      const outline = (s: number) => res.panels.find(x => x.id === (s % 2 ? 'strip-short' : 'strip-long'))!.shape![0].pts.map(q => toFrame(g, s, q))
      const area = (pts: P[]) => Math.abs(pts.reduce((a, q, i) => a + q.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * q.y, 0)) / 2
      const total = [0, 1, 2, 3].reduce((a, s) => a + area(outline(s)), 0)
      expect(total).toBeCloseTo(g.PW * g.PH - (g.PW - 2 * g.b) * (g.PH - 2 * g.b), 6)
      const key = (q: P) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
        const shared = outline(a).map(key).filter(k => outline(b).map(key).includes(k))
        expect(shared.length, `strips ${a} and ${b}`).toBe(2)
      }
      const all = strips.flat().map(cen), has = (q: P) => all.some(o => Math.hypot(o.x - q.x, o.y - q.y) < 2e-3) // the pieces are rounded to 0.001 mm
      for (const c of all) if (c.x < g.b && c.y < g.b) {
        expect(has({ x: g.PW - c.x, y: g.PH - c.y }), 'bottom-right').toBe(true)
        expect(has({ x: g.PW - c.x, y: c.y }), 'top-right').toBe(true)
        expect(has({ x: c.x, y: g.PH - c.y }), 'bottom-left').toBe(true)
      }
    }
  })

  it('runs every mitre or diagonal through solid wood: no cut-out within web of it, a solid bar of 2·web across the corner', () => {
    for (const tpl of [T1, T2]) for (const kind of [1, 2]) for (const p of ([{}, SECOND, { web: 5 }, { band: 120, ov: 10, center: 2 }, { band: 380 }] as Record<string, number>[])) {
      const g = frameGeom(full({ ...p, kind }, tpl)), { top, side } = framePieces(g)
      for (const [pcs, L] of [[top, g.PW], [side, g.PH]] as const) for (const pc of pcs) {
        const sp = samplePoly({ closed: true, pts: pc.pts }, 3)
        const dm = Math.min(...sp.map(q => Math.min(q.x - q.y, L - q.x - q.y) / Math.SQRT2))
        expect(dm, `${lab({ ...p, kind }, tpl)} ${pc.key}`).toBeGreaterThan(g.web - 1e-6)
        expect(Math.min(...sp.map(q => q.y))).toBeGreaterThan(g.ov + g.web - 1e-6) // the rim on the gypsum stays solid
        expect(Math.max(...sp.map(q => q.y))).toBeLessThan(g.b - g.rail + 1e-6)
      }
    }
  })

  it('makes the one-piece board a mirror image about each corner\'s diagonal and both centre lines, with the 45° lines engraved on request', () => {
    for (const tpl of [T1, T2]) for (const p of ([{}, SECOND, { line: 1 }, { ...SECOND, line: 1, center: 3 }, { band: 230, ov: 50, center: 2 }, { band: 380, med: 270 }] as Record<string, number>[])) {
      expect(gen(p, {}, tpl).errors, lab(p, tpl)).toEqual([])
      expect(boardChecks(p, tpl), lab(p, tpl)).toEqual([])
    }
    const d = gen({ line: 1 }), eng = get(d, 'board').loops.filter(l => l.layer === 'engrave')
    expect(eng.length).toBe(4)
    expect(eng.every(l => !l.closed)).toBe(true)
  }, 30000)

  it('glues every plate and strip on solid wood in the strips mode: no cut-out under them', () => {
    for (const tpl of [T1, T2]) for (const p of ([{}, SECOND, { ov: 60, band: 220 }, { center: 2 }, { web: 2 }] as Record<string, number>[])) {
      const q = { ...p, kind: 2 }, g = frameGeom(full(q, tpl))
      expect(cornerPlate(g)).toBeTruthy()
      expect(frameChecks(q, tpl), lab(q, tpl)).toEqual([])
      if (g.field) {
        const co = CLEAT_REACH, { b, fit, PW, PH } = g, d = gen(q, {}, tpl)
        expect(get(d, 'cleat-long').w).toBeCloseTo(PW - 2 * b + 2 * co, 3)
        expect(get(d, 'cleat-short').w).toBeCloseTo(PH - 2 * b - 2 * fit - 2 * co - 2, 3)
        expect(get(d, 'cleat-long').h).toBeCloseTo(2 * co + fit, 3)
      }
    }
  }, 30000)

  // the error's kind (so a fix is judged on that error only), and the fixes it offers: [the keys a value goes to, the value]
  const KINDS: [RegExp, string][] = [
    [/الشريحة الوسطى|شريحة وسطى/, 'mid'],
    [/قليل: لا تتّسع/, 'narrow'], [/كبيرة على عرض الإطار/, 'ov'], [/كبير على ديكور/, 'wide'], [/صغير على إطار فيه ركبة/, 'small'],
    [/أكبر من وسط الديكور|^وسط الديكور .* صغير على/, 'medmid'], [/أكبر من اللوح الأوسط/, 'medfield'], [/اللوح الأوسط .* صغير على/, 'fieldsmall'],
    [/أكبر من فتحة الإطار|فتحة الإطار صغيرة/, 'medopen'], [/خليّة شبكة الوسط/, 'fcell'], [/قطعةً واحدة .* لا يتّسع في لوح/, 'board'],
    [/أطول من «أطول شريحة»/, 'maxlen'], [/أطول من لوح الخشب/, 'long'], [/أعرض من لوح الخشب/, 'sheetwide'], [/اللوح الأوسط .* لا يتّسع في لوح/, 'fieldsheet'], [/لوح الأكريليك/, 'back'],
  ]
  const kindOf = (e: string) => KINDS.find(([re]) => re.test(e))?.[1] ?? 'other'
  function fixesOf(e: string): [string[], number[]][] {
    const out: [string[], number[]][] = [], kind = kindOf(e)
    for (const part of e.split(/: |، أو | أو /)) {
      const two = part.match(/([\d.]+) × ([\d.]+) مم على الأكثر/), m = part.match(/([\d.]+) مم على (?:الأقل|الأكثر)/)
      if (two) out.push([['PW', 'PH'], [Number(two[1]), Number(two[2])]])
      else if (m) {
        const keys = /موضع الشريحة الوسطى/.test(part) ? ['midAt'] : /أطول شريحة/.test(part) ? ['maxLen'] : /عرض الفتحة وطولها/.test(part) ? ['PW', 'PH'] : /عرض الفتحة/.test(part) ? ['PW'] : /طول الفتحة/.test(part) ? ['PH'] : /عرض الشريحة الوسطى/.test(part) ? ['midW']
          : /العرض والطول الكلّيين/.test(part) ? ['PW', 'PH'] : /العرض الكلّي/.test(part) ? ['PW'] : /الطول الكلّي/.test(part) ? ['PH']
          : /الركبة/.test(part) ? ['ov'] : /عرض الإطار/.test(part) ? ['band'] : /اجعله|اجعلها/.test(part) ? [({ medmid: 'med', medfield: 'med', medopen: 'med', fcell: 'fcell' } as Record<string, string>)[kind] ?? 'band'] : []
        if (keys.length) out.push([keys, keys.map(() => Number(m[1]))])
      }
      if (/ألغِه \(0\)/.test(part)) out.push([['back'], [0]])
      if (/ألغِ نقش الوسط \(0\)/.test(part)) out.push([['fill'], [0]])
      if (/ألغِ الشريحة الوسطى \(0\)/.test(part)) out.push([['mid'], [0]])
      if (/«إطار فقط»|«بلا زخرفة وسطى»/.test(part)) out.push([['center'], [3]])
      if (/«قطعة منفصلة»/.test(part)) out.push([['center'], [2]])
      if (/«أربع شرائح بزوايا 45 ولوح وسط»/.test(part)) out.push([['kind'], [2]])
    }
    return out
  }
  /** Every error names a value in range, and each value alone clears its error; the problems found. */
  function fixProblems(p: Record<string, number>, tpl: Tp = T1): string[] {
    const bad: string[] = [], d = gen(p, { kerf: 0.2 }, tpl)
    for (const e of d.errors) {
      const kind = kindOf(e), fixes = fixesOf(e)
      if (kind === 'other' || !fixes.length) { bad.push(`${lab(p, tpl)}: no value in «${e}»`); continue }
      for (const [keys, vs] of fixes) {
        keys.forEach((k, i) => { const def = tpl.params.find(x => x.key === k)!; if (vs[i] < def.min || vs[i] > def.max) bad.push(`${lab(p, tpl)}: ${k} = ${vs[i]} out of range in «${e}»`) })
        const after = gen({ ...p, ...Object.fromEntries(keys.map((k, i) => [k, vs[i]])) }, { kerf: 0.2 }, tpl)
        if (after.errors.some(x => kindOf(x) === kind)) bad.push(`${lab(p, tpl)} with ${keys.join('+')} = ${vs.join('×')}: «${after.errors.find(x => kindOf(x) === kind)}»`)
      }
    }
    return bad
  }

  it('says what to change and to what, and every value it suggests clears that error', () => {
    const cases: [Record<string, number>, RegExp][] = [
      [{ band: 80 }, /عرض الإطار \(80 مم\) قليل/], [{ ov: 120 }, /الركبة على الجبس \(120 مم\) كبيرة/], [{ ov: 200 }, /الركبة على الجبس \(200 مم\) كبيرة/],
      [{ ov: 60, band: 120, web: 5 }, /كبيرة على عرض الإطار|قليل: لا تتّسع/], [{ band: 560 }, /عرض الإطار \(560 مم\) كبير/], [{ PW: 300, PH: 300 }, /كبير على ديكور 300 × 300/],
      [{ med: 800 }, /\(800 مم\) أكبر من وسط الديكور/], [{ med: 800, kind: 2 }, /\(800 مم\) أكبر من اللوح الأوسط/], [{ center: 2, med: 1000 }, /\(1000 مم\) أكبر من وسط الديكور/],
      [{ PW: 760, PH: 400, band: 120, ov: 5, med: 200, kind: 2 }, /صغير على/], [{ PW: 760, PH: 400, band: 150, ov: 5, med: 200 }, /وسط الديكور .* صغير على/],
      [{ center: 2, med: 1000, kind: 2 }, /\(1000 مم\) أكبر من فتحة الإطار/], [{ maxLen: 200, kind: 2 }, /أطول من «أطول شريحة» \(200 مم\)/], [{ sheetL: 400, band: 300, kind: 2, center: 3 }, /أطول من لوح الخشب/],
      [{ PW: 1400, PH: 2510, sizeIs: 2, band: 380, ov: 0, kind: 2, center: 3, mid: 1, midAt: 2200 }, /موضع الشريحة الوسطى \(2200 مم\) بعيد/],
      [{ PW: 1400, PH: 2510, sizeIs: 2, band: 380, ov: 0, kind: 2, center: 3, mid: 1, midAt: 20 }, /موضع الشريحة الوسطى \(20 مم\) قريب/], [{ sheetW: 150, kind: 2 }, /أعرض من لوح الخشب/], [{ PW: 2440, PH: 1700, kind: 2 }, /اللوح الأوسط .* لا يتّسع في لوح/],
      [{ back: 1, PW: 2440, PH: 1300, kind: 2 }, /لوح الأكريليك/], [{ sheetL: 1300 }, /لا يتّسع في لوح 1300 × 1220/], [{ PW: 1300, PH: 2500 }, /اجعله 1220 × 2440 مم على الأكثر/],
      [{ fcell: 30 }, /خليّة شبكة الوسط \(30 مم\) صغيرة/], [{ fcell: 30, kind: 2 }, /خليّة شبكة الوسط/],
      [{ PW: 302, PH: 344, ov: 161, band: 279, center: 3 }, /صغير على إطار فيه ركبة 161 مم|كبيرة على عرض الإطار/],
      [{ PW: 1664, PH: 539, ov: 182, band: 385, center: 3, kind: 2 }, /صغير على إطار فيه ركبة 182 مم|كبيرة على عرض الإطار/],
    ]
    for (const tpl of [T1, T2]) for (const [p, re] of cases) {
      const d = gen(p, {}, tpl), e = d.errors.find(x => re.test(x))
      expect(e, `${lab(p, tpl)}: ${d.errors.join(' | ')}`).toBeTruthy()
      expect(fixesOf(e!).length, e).toBeGreaterThan(0)
      expect(fixProblems(p, tpl)).toEqual([])
    }
    // the wide band the user may try: the medallion's largest size, which then builds, fully patterned
    for (const tpl of [T1, T2]) {
      const e = gen({ band: 380 }, {}, tpl).errors.join(' | ')
      expect(e).toMatch(new RegExp(`\\(450 مم\\) أكبر من وسط الديكور 640 × 290 مم: ${tpl === T1 ? 'اجعله' : 'اجعلها'} 278 مم على الأكثر`))
      expect(gen({ band: 380, med: 278 }, {}, tpl).errors).toEqual([])
    }
  }, 60000)

  it('gives every refusal a value that clears it, across random settings', () => {
    const rnd = seeded(99), bad: string[] = []
    let refused = 0
    for (let i = 0; i < 200; i++) {
      const tpl = CEILING_FRAMES[i % 2], p = {
        PW: Math.round(300 + rnd() * 2140), PH: Math.round(300 + rnd() * 2140), ov: Math.round(rnd() * 200), band: Math.round(60 + rnd() * 540),
        kind: rnd() < 0.5 ? 1 : 2, center: 1 + Math.floor(rnd() * 3), med: Math.round(150 + rnd() * 1050), web: [2, 3, 4, 5, 8][Math.floor(rnd() * 5)], fit: Math.round(rnd() * 20) / 10,
        fill: rnd() < 0.7 ? 1 : 0, fcell: Math.round(30 + rnd() * 120), cleats: rnd() < 0.8 ? 1 : 0, back: rnd() < 0.3 ? 1 : 0,
        sheetL: rnd() < 0.8 ? 2440 : Math.round(300 + rnd() * 2700), sheetW: rnd() < 0.8 ? 1220 : Math.round(300 + rnd() * 1700),
      }
      if (gen(p, {}, tpl).errors.length) { refused++; bad.push(...fixProblems(p, tpl)) }
    }
    expect(refused).toBeGreaterThan(90)
    expect(bad.slice(0, 10)).toEqual([])
  }, 60000)

  it('needs the room it says: the narrowest band holds a motif, and one step less does not', () => {
    for (const style of [1, 2]) for (const web of [2, 3, 5, 8]) for (const kind of [1, 2]) {
      const g0 = frameGeom(full({ web, kind, style })), WpMin = minPatternWidth(web, style)
      if (style === 1) { expect(rosetteDims(ROSE.R * WpMin, web)).toBeTruthy(); expect(rosetteDims(ROSE.R * (WpMin - 0.5), web)).toBeNull() }
      else { expect(starDims(STAR.R * WpMin, WpMin / 2, web)).toBeTruthy(); expect(starDims(STAR.R * (WpMin - 0.5), (WpMin - 0.5) / 2, web)).toBeNull() }
      const bandMin = Math.ceil((30 + web + (g0.field ? CLEAT_REACH + web : web) + WpMin) * 2 - 1e-6) / 2 // (a band this narrow has straps of web)
      expect(gen({ web, kind, style, band: bandMin }).errors.filter(x => /قليل|كبيرة على عرض/.test(x))).toEqual([])
      expect(gen({ web, kind, style, band: bandMin - 0.5 }).errors.length).toBeGreaterThan(0)
    }
    // and the lattice's smallest cell
    for (const style of [1, 2]) for (const web of [2, 3, 5]) {
      const fMin = Math.ceil(minCell(style, web) * 2 - 1e-6) / 2
      expect(gen({ style, web, fcell: fMin }).errors.filter(x => /خليّة/.test(x))).toEqual([])
      expect(gen({ style, web, fcell: fMin - 0.5 }).errors.filter(x => /خليّة/.test(x)).length).toBe(1)
    }
  }, 30000)

  it('cuts no sliver, even in the narrowest bands: the shapes shrink to 2 mm across and 4 mm², or are left out', () => {
    for (const style of [1, 2]) for (const web of [2, 3, 5, 8]) for (const kind of [1, 2]) for (const dW of [0, 3, 7.5, 15]) {
      const g0 = frameGeom(full({ web, kind, style })), band = Math.ceil((30 + web + g0.rail + minPatternWidth(web, style) + dW) * 2) / 2
      const p = { web, kind, style, band, PW: 900, PH: 700, med: 150, fill: 0 }
      const d = gen(p)
      if (d.errors.length) continue
      for (const pn of d.panels) for (const h of cutOf(pn).filter(l => signedArea(l) < 0)) {
        const sp = samplePoly(h, 4), b = boxOf(sp)
        expect(-signedArea(h), `${JSON.stringify(p)} area`).toBeGreaterThanOrEqual(3.5)
        expect(Math.min(b.maxX - b.minX, b.maxY - b.minY, widthOf(sp)), `${JSON.stringify(p)} width`).toBeGreaterThanOrEqual(1.9)
      }
    }
  }, 30000)

  it('tells the user how it goes together, for the mode and the design chosen', () => {
    for (const tpl of [T1, T2]) {
      const one = gen({}, {}, tpl).notes.join('\n'), g = frameGeom(full({}, tpl)), mw = tpl === T1 ? 'وردات' : 'نجوم'
      const motifs = [`${g.n1 - 1} ${mw}`, `${g.n2 - 1} ${mw}`, tpl === T1 ? 'المثمّن 450' : 'الدائرة قطرها 450']
      for (const s of ['قطعة واحدة 1400 × 1050', '1340 × 990', 'فتحة في القطعة', 'من الداخل إلى الخارج', 'مائلاً', 'على لوح الجبسن بورد', 'ادهنه', 'أكريليك أوبال', 'قماشاً أبيض', 'على 45°', 'منقوش', ...motifs]) expect(one, `${tpl.id} ${s}`).toContain(s)
      for (const w of ['تدعيم', 'شطف', 'الشطوف', 'مشطوفة', 'الشرائح الأربع']) expect(one, `${tpl.id} ${w}`).not.toContain(w)
      expect(one).not.toContain('محفور')
      expect(gen({ line: 1 }, {}, tpl).notes.join('\n')).toContain('محفور')
      expect(gen({ fill: 0 }, {}, tpl).notes.join('\n')).toContain('الوسط سادة')
      expect(gen({ center: 2 }, {}, tpl).notes.join('\n')).toMatch(/قطعة منفصلة تُلصق/)
      expect(gen(SECOND, {}, tpl).notes.join('\n')).toContain('1320 × 1020')
      const strips = gen({ kind: 2 }, {}, tpl).notes.join('\n')
      for (const s of ['1060 مم من الداخل', '710 مم من الداخل', 'من الداخل إلى الخارج', 'على لوح الجبسن بورد', 'أكريليك أوبال', 'ادهنه', 'شرائح التدعيم', 'ألصق الشطوف']) expect(strips, `${tpl.id} ${s}`).toContain(s)
      // the counts in the notes are the counts cut
      const d = gen({}, {}, tpl), n = Number(one.match(/عدد الفتحات: (\d+) فتحة في القطعة/)![1])
      expect(n).toBe(cutOf(get(d, 'board')).filter(l => signedArea(l) < 0).length)
    }
    expect(gen({ back: 1 }).panels.find(x => x.id === 'back')!.material).toBe('white')
    // a small medallion with thick webs leaves out its middle star (and the small stars round it): so do the words
    const small2 = gen({ web: 8, med: 150 }, {}, T2), small1 = gen({ web: 8, med: 150, fcell: 71 })
    expect([...small2.errors, ...small1.errors]).toEqual([])
    expect(small2.notes.join('\n')).toContain('12 بتلة تلتقي في وسطها')
    expect(small2.notes.join('\n')).not.toContain('نجمة من 12 رأساً')
    expect(small1.notes.join('\n')).toContain('16 بتلة طويلة تلتقي في وسطه')
    for (const w of ['نجمة من 16 رأساً', 'نجوم صغيرة']) expect(small1.notes.join('\n')).not.toContain(w)
  })

  it('makes the round medallion of a 12-point star, 12 kites, 12 cells and 24 arcs, every web at least web', () => {
    for (const med of [150, 220, 450, 800, 1200]) for (const web of [2, 3, 5, 8]) {
      const pcs = medallion2({ x: 0, y: 0 }, med, web), m = medDims2(med, web), lb = `med ${med} web ${web}`
      const count = (re: RegExp) => pcs.filter(pc => re.test(pc.key)).length
      if (med >= 220 || web <= 3) {
        expect(count(/^star$/), lb).toBe(1)
        expect(count(/^k\d+$/), lb).toBe(12)
        expect(count(/^c\d+$/), lb).toBe(12)
        expect(count(/^a\d+$/), lb).toBe(24)
      }
      const polys = pcs.map(pc => samplePoly({ closed: true, pts: pc.pts }, 2))
      for (const q of polys.flat()) expect(Math.hypot(q.x, q.y), lb).toBeLessThanOrEqual(m.A - m.sb + 1e-6)
      for (let i = 0; i < polys.length; i++) {
        const a = polys[i]
        expect(-signedArea(polyLoopCCW(a)) >= 4 && widthOf(a) >= 2, `${lb} ${pcs[i].key} size`).toBe(true)
        for (let j = i + 1; j < polys.length; j++) { const g = gapUnder(a, polys[j], web); expect(g, `${lb} ${pcs[i].key}–${pcs[j].key}`).toBeGreaterThanOrEqual(web - 0.01) }
      }
      // a mirror image about the axis through every kite
      for (const pc of pcs) expect(pcs.some(o => Math.hypot(o.c.x - pc.c.x, o.c.y + pc.c.y) < 1e-6), `${lb} ${pc.key} mirrored`).toBe(true)
    }
  }, 30000)

  it('patterns the whole field round the medallion (no plain area) in both designs and both modes, and leaves it plain with fill 0', () => {
    for (const tpl of [T1, T2]) for (const p of ([{}, SECOND, { center: 3 }, { center: 2 }, { kind: 2 }, { ...SECOND, kind: 2 }, { band: 380, med: 278 }, { band: 380, med: 260, kind: 2 }, { fcell: 110 }, { fcell: 50, web: 2 }] as Record<string, number>[])) {
      expect(gen(p, {}, tpl).errors, lab(p, tpl)).toEqual([])
      const fc = full(p, tpl).fcell, c = coverage(p, tpl)
      expect(c.lattice, lab(p, tpl)).toBeGreaterThan(20)
      expect(c.worst, `${lab(p, tpl)} plain at ${c.at.x.toFixed(0)},${c.at.y.toFixed(0)}`).toBeLessThanOrEqual(0.6 * fc)
    }
    for (const tpl of [T1, T2]) for (const p of [{ fill: 0 }, { fill: 0, kind: 2 }] as Record<string, number>[]) {
      const c = coverage(p, tpl)
      expect(c.lattice).toBe(0)
      expect(c.worst, lab(p, tpl)).toBeGreaterThan(2 * full(p, tpl).fcell)
    }
  }, 60000)

  // every parameter at its ends (both designs, on a smaller decor so the board's thousands of cut-outs stay quick to
  // check), at every thickness and kerf, and random settings: sound, with the frame's own rules kept, whenever no error
  // is reported. The thickness changes no shape here, so the shapes are checked once, at kerf 0.2 (the paths' offset).
  it('is sound across its parameters or refuses with an error', () => {
    const base = { PW: 900, PH: 650, med: 250 }, variants: [Tp, Record<string, number>][] = []
    for (const tpl of [T1, T2]) { variants.push([tpl, base]); for (const def of tpl.params) variants.push([tpl, { ...base, [def.key]: def.min }], [tpl, { ...base, [def.key]: def.max }]) }
    const nGrid = variants.length, rnd = seeded(2024)
    for (let i = 0; i < 40; i++) variants.push([CEILING_FRAMES[i % 2], {
      PW: Math.round(300 + rnd() * 1100), PH: Math.round(300 + rnd() * 900), ov: Math.round(rnd() * 120), band: Math.round(60 + rnd() * 300), kind: rnd() < 0.5 ? 1 : 2,
      center: 1 + Math.floor(rnd() * 3), med: Math.round(150 + rnd() * 500), web: [2, 2.5, 3, 4, 5, 8][Math.floor(rnd() * 6)], fit: Math.round(rnd() * 20) / 10,
      fill: rnd() < 0.7 ? 1 : 0, fcell: Math.round(40 + rnd() * 120), line: rnd() < 0.5 ? 1 : 0, cleats: rnd() < 0.8 ? 1 : 0, back: rnd() < 0.2 ? 1 : 0,
    }])
    let runs = 0, refused = 0
    const bad: string[] = []
    variants.forEach(([tpl, v], i) => {
      const q = full(v, tpl), web = q.web, lb = lab(v, tpl)
      for (const [t, kerf] of i < nGrid ? [[2, 0], [3, 0.2], [6, 0], [6, 0.2]] : [[[3, 4, 6][i % 3], 0.2]]) {
        const d = gen(v, { t, kerf }, tpl)
        runs++
        for (const pn of d.panels) for (const l of pn.loops) for (const p of l.pts) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bad.push(`${lb} t=${t}: non-finite`)
        if (d.errors.length) { refused++; continue }
        // no warning unless there is no hidden rim to glue the corner plates to, or the kerf is more than half the sheet
        bad.push(...d.warnings.filter(w => !(q.kind === 2 && q.ov + web - 1 < 6 && /قطع الزوايا/.test(w)) && !(kerf > t / 2)).map(w => `${lb} t=${t}: ${w}`))
        for (const pn of d.panels) if (pn.material !== 'white' && !(Math.max(pn.w, pn.h) <= q.sheetL + 1 && Math.min(pn.w, pn.h) <= q.sheetW + 1)) bad.push(`${lb}: ${pn.id} off the sheet`)
        if (kerf !== 0.2 || (i < nGrid && t !== 3)) continue
        // the kerf moves every path 0.1 mm away from the wood: the webs between the paths are 0.2 mm wider
        bad.push(...soundness(d, `${lb} t=${t}`, web + 0.2, web + 0.2, 8))
        bad.push(...(q.kind === 2 ? frameChecks(v, tpl) : boardChecks(v, tpl)).map(s => `${lb}: ${s}`))
      }
    })
    expect(bad.slice(0, 10)).toEqual([])
    expect(runs).toBeGreaterThan(300)
    expect(refused).toBeLessThan(0.6 * runs)
  }, 90000)
  // ---------------------------------------------------------------- the window's size and the middle strip
  // the customer's two frames: the window inside 1400 × 1050 and 1380 × 1080, a 380 mm band all visible, four mitred
  // strips and a middle strip across the window
  const WIN = { band: 380, ov: 0, kind: 2, center: 3, mid: 1, style: 1, sizeIs: 2, cleats: 0 }
  const DECORS = [{ PW: 1400, PH: 1050 }, { PW: 1380, PH: 1080 }]

  it('reads the sizes as the window inside the frame with sizeIs 2 (the outside 2·band more), the same frame as its outside size', () => {
    for (const tpl of [T1, T2]) for (const [p, out] of [[DECORS[0], [2160, 1810]], [DECORS[1], [2140, 1840]]] as const) {
      const g = frameGeom(full({ ...WIN, ...p, mid: 0 }, tpl))
      expect([g.PW, g.PH]).toEqual(out)
      const d = gen({ ...WIN, ...p, mid: 0 }, {}, tpl), o = gen({ ...WIN, mid: 0, sizeIs: 1, PW: out[0], PH: out[1] }, {}, tpl)
      expect(d.errors).toEqual([])
      expect(get(d, 'strip-long').w).toBeCloseTo(out[0], 6)
      expect(get(d, 'strip-short').w).toBeCloseTo(out[1], 6)
      for (const id of ['strip-long', 'strip-short']) expect(cutOf(get(d, id)).length).toBe(cutOf(get(o, id)).length)
      expect(d.notes.join(' ')).toContain(`الفتحة داخل الإطار ${p.PW} × ${p.PH} مم`)
    }
  })

  it("cuts the customer's two frames: two long strips, two short ones and the middle strip, no errors or warnings, sound, each on the sheet", () => {
    for (const tpl of [T1, T2]) for (const p of DECORS) for (const cleats of [0, 1]) {
      const q = { ...WIN, ...p, cleats }, d = gen(q, {}, tpl), g = frameGeom(full(q, tpl))
      expect(d.errors, lab(q, tpl)).toEqual([])
      expect(d.warnings, lab(q, tpl)).toEqual([])
      expect(d.panels.map(x => `${x.id}×${x.count}`)).toEqual(['strip-long×2', 'strip-short×2', 'strip-mid×1', ...(cleats ? ['corner×4', 'mid-plate×2'] : [])])
      for (const pn of d.panels) expect(Math.max(pn.w, pn.h) <= 2440 && Math.min(pn.w, pn.h) <= 1220, `${pn.id} ${pn.w} × ${pn.h}`).toBe(true)
      expect(soundness(d, lab(q, tpl), g.web + 0.01, g.web + 0.01, 3), lab(q, tpl)).toEqual([])
      // the straps grow with the 380 mm band: no 3 mm straps round 25 cm rosettes
      expect(g.sw).toBeGreaterThanOrEqual(7)
      if (cleats) expect(frameChecks(full(q, tpl), tpl), lab(q, tpl)).toEqual([])
    }
  })

  it('nests the frames on 1220 × 2440 sheets, nothing too big, every piece inside its sheet', () => {
    for (const p of DECORS) {
      const lay = generate(T1, { ...WIN, ...p }, { ...DEFAULT_SETTINGS, t: 3 }).layout as never as { placed: { panel: Pn; x: number; y: number; sheet: number }[]; sheets: { x: number; y: number; w: number; h: number }[]; tooBig: string[] }
      expect(lay.tooBig).toEqual([])
      expect(lay.sheets.length).toBeLessThanOrEqual(2)
      for (const sh of lay.sheets) expect([sh.w, sh.h]).toEqual([1220, 2440])
      expect(lay.placed.length).toBe(5)
      for (const pl of lay.placed) {
        const sh = lay.sheets[pl.sheet], b = boxOf(cutOf(pl.panel).flatMap(l => samplePoly(l, 4)).map(q => ({ x: q.x + pl.x, y: q.y + pl.y })))
        expect(b.minX >= sh.x - 1e-6 && b.maxX <= sh.x + sh.w + 1e-6 && b.minY >= sh.y - 1e-6 && b.maxY <= sh.y + sh.h + 1e-6, pl.panel.id).toBe(true)
      }
    }
  }, 30000)

  it('butt-joins the middle strip to the long strips, its pattern going on from theirs, symmetric, every joint through solid wood', () => {
    for (const tpl of [T1, T2]) for (const p of DECORS) {
      const q = full({ ...WIN, ...p }, tpl), g = frameGeom(q), d = gen(q, {}, tpl), m = get(d, 'strip-mid')
      // a rectangle as long as the window's short side, square ends on the long strips' inner edges, as wide as the band shows
      expect(m.w).toBeCloseTo(p.PH, 6)
      expect(m.h).toBeCloseTo(380, 6)
      const outer = cutOf(m).filter(l => signedArea(l) > 0)[0].pts
      expect(outer.length).toBe(4)
      expect(outer.every((v, i) => { const w = outer[(i + 1) % 4]; return Math.abs(v.x - w.x) < 1e-9 || Math.abs(v.y - w.y) < 1e-9 })).toBe(true)
      // the long strips step an even number of times, so a motif sits on the middle strip's axis
      expect(g.wide && g.n1 % 2 === 0).toBe(true)
      const top = framePieces(g).top, axis = top.filter(pc => Math.abs(pc.c.x - g.PW / 2) < 1e-6 && Math.abs(pc.c.y - g.vc) < 1e-6)
      expect(axis.length, 'a motif centred on the axis').toBeGreaterThan(0)
      // the middle strip's motifs: the column from that motif to the opposite long strip's, the short strips' steps
      const mp = midPieces(g), c0 = g.vc - g.b
      expect(g.nm).toBe(g.n2)
      expect(c0 + g.nm * g.qm).toBeCloseTo(g.Lm - c0, 6)
      for (let j = 1; j < g.nm; j++) expect(mp.some(pc => pc.key.startsWith(`m${j}`) && Math.abs(pc.c.x - (c0 + j * g.qm)) < 1e-6 && Math.abs(pc.c.y - g.midW / 2) < 1e-6), `motif ${j}`).toBe(true)
      // the same motif as the band's, the same size
      const sizeOf = (pcs: { key: string; poly: P[] }[], re: RegExp) => pcs.filter(pc => re.test(pc.key)).map(pc => { const b = boxOf(pc.poly); return Math.round(Math.max(b.maxX - b.minX, b.maxY - b.minY) * 100) / 100 }).sort((a, b) => b - a)[0]
      const motifRe = tpl === T1 ? /s$/ : /./
      if (tpl === T1) expect(sizeOf(mp, /^m1s$/)).toBeCloseTo(sizeOf(axis, motifRe), 6)
      // through solid wood: nothing within sw of the joints or the strip's sides, and the long strips' pattern stops sw short of their inner edge
      const pts = cutOf(m).filter(l => signedArea(l) < 0).flatMap(h => samplePoly(h, 1))
      expect(Math.min(...pts.map(v => Math.min(v.x, m.w - v.x, v.y, m.h - v.y)))).toBeGreaterThanOrEqual(g.sw - 1e-3)
      const lp = cutOf(get(d, 'strip-long')).filter(l => signedArea(l) < 0).flatMap(h => samplePoly(h, 1))
      expect(Math.max(...lp.map(v => v.y))).toBeLessThanOrEqual(g.b - g.sw + 1e-3)
      // mirror images about both of the middle strip's centre lines
      const cs = cutOf(m).filter(l => signedArea(l) < 0).map(h => cen(samplePoly(h, 1)))
      for (const [fx, fy] of [[true, false], [false, true]]) expect(cs.filter(c => !cs.some(o => Math.hypot((fx ? m.w - c.x : c.x) - o.x, (fy ? m.h - c.y : c.y) - o.y) < 0.2)).length, `mirror ${fx ? 'u' : 'v'}`).toBe(0)
    }
  })

  it('makes the middle strip part of the one board (kind 1), the lattice either side of it, wide or tall', () => {
    for (const p of [{ PW: 1400, PH: 1050 }, { PW: 1050, PH: 1400 }]) {
      const q = { ...p, mid: 1, center: 3 }, d = gen(q), g = frameGeom(full(q))
      expect(d.errors, lab(q)).toEqual([])
      expect(d.warnings, lab(q)).toEqual([])
      expect(g.wide ? g.n1 % 2 : g.n2 % 2).toBe(0)
      expect(midPieces(g).length).toBeGreaterThan(20)
      expect(cutOf(get(d, 'board')).length).toBe(1 + 2 * framePieces(g).top.length + 2 * framePieces(g).side.length + midPieces(g).length + decorLat(q))
      expect(soundness(d, lab(q), g.web + 0.01, g.web + 0.01, 3), lab(q)).toEqual([])
    }
  }, 30000)

  it('refuses a middle strip over the medallion, too wide or too narrow, and a window too big, each with a value that clears it', () => {
    const cases: [Record<string, number>, RegExp][] = [
      [{ mid: 1 }, /الشريحة الوسطى تمرّ في مكان/], [{ mid: 1, kind: 2 }, /الشريحة الوسطى تمرّ في مكان/],
      [{ mid: 1, center: 3, PW: 800, PH: 600, midW: 400 }, /عريضة على فتحة/], [{ mid: 1, center: 3, midW: 60 }, /ضيّقة على/],
      [{ sizeIs: 2, PW: 2000, PH: 1300 }, /قطعةً واحدة .* لا يتّسع في لوح/], [{ sizeIs: 2, kind: 2, PW: 2200, PH: 1000, band: 300, maxLen: 300 }, /أطول من «أطول شريحة»/],
    ]
    for (const tpl of [T1, T2]) for (const [p, re] of cases) {
      const d = gen(p, {}, tpl), e = d.errors.find(x => re.test(x))
      expect(e, `${lab(p, tpl)}: ${d.errors.join(' | ')}`).toBeTruthy()
      expect(fixesOf(e!).length, e).toBeGreaterThan(0)
      expect(fixProblems(p, tpl)).toEqual([])
    }
  }, 60000)

  it('cuts with straight lines only: no arc or circle in any loop of any ceiling design (rosettes, stars, both medallions)', () => {
    for (const tpl of CEILING_FRAMES) for (const p of ([{}, { kind: 2 }, { center: 2 }, { kind: 2, center: 2 }, { mid: 1, center: 3 }] as Record<string, number>[])) {
      if (tpl === T3 && Object.keys(p).length) continue
      const d = gen(p, {}, tpl)
      expect(d.errors, lab(p, tpl)).toEqual([])
      for (const pn of d.panels) for (const l of pn.loops) expect(l.pts.every(v => !v.b), `${lab(p, tpl)} ${pn.id}`).toBe(true)
      expect(toDXF(d.layout)).not.toMatch(/\n42\n|\nCIRCLE\n/)
    }
    for (const med of [150, 450, 1200]) expect(medallion2({ x: 0, y: 0 }, med, 3).every(pc => pc.pts.every(v => !v.b))).toBe(true)
  }, 60000)

  it('moves the middle strip off the middle (midAt): a motif on its axis on both long strips, whole steps from each corner to it, the steps near alike', () => {
    const cases: [Tp, Record<string, number>][] = [[T1, setFrameParams(T3.defaults)], [T2, setFrameParams(T3.defaults)], [T1, { PW: 2000, PH: 1200, mid: 1, midAt: 450, center: 3 }], [T2, { PW: 1100, PH: 2200, band: 200, mid: 1, midAt: 1100, center: 3, kind: 2 }]]
    for (const [tpl, p] of cases) {
      const q = full(p, tpl), g = frameGeom(q), d = gen(p, {}, tpl), lb = lab(p, tpl)
      expect(d.errors, lb).toEqual([])
      expect(d.warnings, lb).toEqual([])
      expect(g.offMid, lb).toBe(true)
      expect(g.axisU).toBeCloseTo(g.b + q.midAt + g.midW / 2, 9)
      const fs = framePieces(g), long = g.wide ? fs.top : fs.side, long2 = g.wide ? fs.bottom : fs.left, L = g.Llong
      // whole motifs at whole steps from each corner, one on the axis; the two steps within 5 % of each other
      const cs = long.filter(pc => /^r\d+s$/.test(pc.key)).map(pc => pc.c.x).sort((a, b) => a - b)
      expect(cs.some(x => Math.abs(x - g.axisU) < 1e-6), lb).toBe(true)
      for (const x of cs) {
        const k = x <= g.axisU + 1e-6 ? (x - g.vc) / g.pa : (L - g.vc - x) / g.pb
        expect(Math.abs(k - Math.round(k)), `${lb} motif at ${x}`).toBeLessThan(1e-6)
      }
      expect(Math.abs((g.axisU - g.vc) / g.pa - Math.round((g.axisU - g.vc) / g.pa))).toBeLessThan(1e-9)
      expect(Math.abs(g.pa / g.pb - 1), lb).toBeLessThan(0.05)
      // locally symmetric: the motif on the axis is whole and centred on it
      const onAxis = long.filter(pc => Math.abs(pc.c.x - g.axisU) < g.R + 1e-6 && /^r\d+/.test(pc.key))
      expect(onAxis.length, lb).toBeGreaterThan(8)
      for (const pc of onAxis) expect(onAxis.some(o => Math.hypot(o.c.x - (2 * g.axisU - pc.c.x), o.c.y - pc.c.y) < 1e-6), `${lb} ${pc.key}`).toBe(true)
      // the opposite long strip is its mirror image, so both axes are on the middle strip's axis in the frame
      for (const pc of long2) expect(long.some(o => o.key === pc.key && Math.hypot(o.c.x - (L - pc.c.x), o.c.y - pc.c.y) < 1e-6), `${lb} ${pc.key}`).toBe(true)
      const s1 = g.wide ? 0 : 1, s2 = s1 + 2, ax1 = toFrame(g, s1, { x: g.axisU, y: g.vc }), ax2 = toFrame(g, s2, { x: L - g.axisU, y: g.vc })
      const m0 = midToFrame(g, { x: 0, y: g.midW / 2 }), m1 = midToFrame(g, { x: g.Lm, y: g.midW / 2 })
      if (g.wide) { expect(ax1.x).toBeCloseTo(m0.x, 6); expect(ax2.x).toBeCloseTo(m1.x, 6) } else { expect(ax1.y).toBeCloseTo(m0.y, 6); expect(ax2.y).toBeCloseTo(m1.y, 6) }
      // the middle strip's motifs line up with the axis
      for (const pc of midPieces(g).filter(o => /^m\d+s$/.test(o.key))) expect(pc.c.y).toBeCloseTo(g.midW / 2, 6)
      expect(soundness(d, lb, 3, 3), lb).toEqual([])
    }
  }, 60000)

  it('cuts a strip longer than the sheet at waists into the fewest pieces, as alike as they go: square joints through solid wood, the pattern going on across them', () => {
    const cases: [Tp, Record<string, number>][] = [[T1, setFrameParams(T3.defaults)], [T2, setFrameParams(T3.defaults)], [T1, { kind: 2, maxLen: 800 }], [T2, { kind: 2, PW: 2400, PH: 1200, center: 3, sheetL: 1500 }], [T1, { ...setFrameParams(T3.defaults), cleats: 1 }]]
    for (const [tpl, p] of cases) {
      const q = full(p, tpl), g = frameGeom(q), d = gen(p, {}, tpl), lb = lab(p, tpl), lay = d.layout as { tooBig?: string[] }
      expect(d.errors, lb).toEqual([])
      expect(d.warnings, lb).toEqual([])
      const fs = framePieces(g), all = [fs.top, fs.side, fs.bottom, fs.left]
      let cut = 0
      for (const s of [0, 1, 2, 3]) {
        const { L, waists } = stripCuts(g, s), joints = splitPlan(L, waists, g.maxLen)!
        expect(joints, `${lb} strip ${s}`).toBeTruthy()
        if (L <= g.maxLen) { expect(joints).toEqual([]); continue }
        cut++
        const cuts = [0, ...joints, L], lens = cuts.slice(1).map((u, i) => u - cuts[i]), k = lens.length
        expect(Math.max(...lens), lb).toBeLessThanOrEqual(g.maxLen + 1e-9)
        // the fewest pieces, and among those the most alike (every choice of k − 1 waists tried)
        const t = L / k, worst = Math.max(...lens.map(x => Math.abs(x - t)))
        const tryAll = (from: number, left: number, last: number, w: number, tt: number): number => {
          if (left === 0) return L - last <= g.maxLen + 1e-9 ? Math.max(w, Math.abs(L - last - tt)) : Infinity
          let best = Infinity
          for (let i = from; i < waists.length; i++) { const len = waists[i] - last; if (len <= g.maxLen + 1e-9) best = Math.min(best, tryAll(i + 1, left - 1, waists[i], Math.max(w, Math.abs(len - tt)), tt)) }
          return best
        }
        expect(worst, lb).toBeLessThanOrEqual(tryAll(0, k - 1, 0, 0, t) + 1e-9)
        expect(tryAll(0, k - 2, 0, 0, L / (k - 1)), `${lb} fewer pieces`).toBe(Infinity)
        // each joint through solid wood across the whole band: no cut-out within sw of it
        const parts = cutAtJoints(all[s], joints, g.sw, g.b)
        for (const [i, pcs] of parts.entries()) for (const pc of pcs) for (const z of pc.poly) {
          expect(z.x, `${lb} strip ${s} piece ${i}`).toBeGreaterThanOrEqual(cuts[i] + (i ? g.sw : 0) - 1e-6)
          expect(z.x).toBeLessThanOrEqual(cuts[i + 1] - (i < k - 1 ? g.sw : 0) + 1e-6)
        }
        // the pattern goes on across it: what lies within a step of a joint is a mirror image about it
        const flat = parts.flat(), p0 = Math.min(g.p1, g.p2, g.pa, g.pb)
        let near = 0
        for (const u of joints) for (const pc of flat) if (Math.abs(pc.c.x - u) < p0 / 2 - g.R / 2) {
          near++
          expect(flat.some(o => Math.hypot(o.c.x - (2 * u - pc.c.x), o.c.y - pc.c.y) < 1e-3), `${lb} strip ${s} ${pc.key} at ${pc.c.x.toFixed(1)} mirrored about ${u}`).toBe(true)
        }
        expect(near, lb).toBeGreaterThan(2 * joints.length)
        // nothing clipped at a joint: every cut-out near it is a whole shape of the pattern (as many corners as the
        // full one), none with a straight edge along the bar, one moved off it clear of the bar by sw more, and the
        // joint a mirror image about it, shape for shape
        const bb = (pts: P[]) => [Math.min(...pts.map(z => z.x)), Math.max(...pts.map(z => z.x)), Math.min(...pts.map(z => z.y)), Math.max(...pts.map(z => z.y))]
        for (const u of joints) {
          const by = flat.filter(pc => { const [x0, x1] = bb(pc.poly); return x0 < u + p0 / 3 && x1 > u - p0 / 3 })
          expect(by.length, lb).toBeGreaterThan(4)
          for (const pc of by) {
            const at = `${lb} strip ${s} ${pc.key} by the joint at ${u}`, full0 = all[s].find(o => o.key === pc.key.replace(/\|$/, ''))
            expect(full0, at).toBeTruthy()
            expect(pc.poly.length, at).toBe(full0!.poly.length)
            pc.poly.forEach((a, i) => { const z = pc.poly[(i + 1) % pc.poly.length]; expect(Math.abs(a.x - z.x) < 1e-6 && Math.abs(a.x - u) < 2 * g.sw + 1e-6, `${at}: an edge along the bar`).toBe(false) })
            if (pc.key.endsWith('|')) expect(Math.min(...pc.poly.map(z => Math.abs(z.x - u))), at).toBeGreaterThanOrEqual(2 * g.sw - 1e-6)
            const [x0, x1, y0, y1] = bb(pc.poly)
            expect(by.some(o => { const [a0, a1, b0, b1] = bb(o.poly); return o.poly.length === pc.poly.length && Math.abs(a0 - (2 * u - x1)) < 1e-3 && Math.abs(a1 - (2 * u - x0)) < 1e-3 && Math.abs(b0 - y0) < 1e-3 && Math.abs(b1 - y1) < 1e-3 }), `${at}: its mirror image`).toBe(true)
          }
          // the rosettes' waist keeps its two 8-point stars, whole, each side of the joint
          if (g.style === 1) expect(by.filter(pc => pc.key.startsWith('st') && pc.poly.length === 16).length, lb).toBe(4)
        }
      }
      expect(cut, lb).toBeGreaterThan(0)
      // the pieces as cut: every one on the sheet, sound
      expect(offSheet(d.layout), lb).toEqual([])
      expect(lay.tooBig ?? [], lb).toEqual([])
      expect(soundness(d, lb, 3, 3), lb).toEqual([])
      if (q.cleats >= 0.5) expect(d.panels.some(x => x.id.startsWith('splice')), lb).toBe(true)
    }
  }, 60000)

  it("builds the customer's whole ceiling (ceilingset): four mitred strips, the middle strip and both squares, on 1220 × 2440 sheets, no errors or warnings", () => {
    expect(T3.id).toBe('ceilingset')
    for (const style of [1, 2]) {
      const d = gen({ style }, {}, T3), lb = `ceilingset style ${style}`, lay = d.layout as { sheets: unknown[]; tooBig?: string[] }
      expect(d.errors, lb).toEqual([])
      expect(d.warnings, lb).toEqual([])
      const g = frameGeom(setFrameParams({ ...T3.defaults, style }))
      expect([g.PW - 2 * g.b, g.PH - 2 * g.b, g.PW, g.PH, g.mAt, g.midW, g.Lm]).toEqual([1400, 2510, 2160, 3270, 1050, 380, 1400])
      const sz = (id: string) => [get(d, id).w, get(d, id).h].map(v => Math.round(v))
      expect(sz('strip-long')).toEqual([2160, 380])
      expect(get(d, 'strip-long').count).toBe(2)
      expect(sz('strip-mid')).toEqual([1400, 380])
      expect(sz('square-a')).toEqual([1400, 1050])
      expect(sz('square-b')).toEqual([1380, 1080])
      const long1 = d.panels.filter(x => x.id.startsWith('strip-short-1-')), long2 = d.panels.filter(x => x.id.startsWith('strip-short-2-'))
      expect([long1.length, long2.length]).toEqual([2, 2])
      expect(Math.round(long1.reduce((a, x) => a + x.w, 0))).toBe(3270)
      expect(long1.map(x => x.name)).toEqual(['شريحة طويلة 1-أ', 'شريحة طويلة 1-ب'])
      for (const x of d.panels) expect(Math.max(x.w, x.h), `${lb} ${x.id}`).toBeLessThanOrEqual(2440 - 2 * NEST_MARGIN)
      expect(offSheet(d.layout)).toEqual([])
      expect(lay.tooBig ?? []).toEqual([])
      expect(lay.sheets.length).toBeLessThanOrEqual(4)
      expect(soundness(d, lb, 3, 3), lb).toEqual([])
      // the notes say what was built: the long strips' two steps, their cut-outs as cut, where the middle strip is
      const words = d.notes.join(' '), longHoles = long1.reduce((a, x) => a + x.loops.filter(l => l.closed).length - 1, 0)
      expect(words, lb).toContain(`و${longHoles} في كلّ جانبية`)
      expect(words, lb).toContain(`بينها ${g.pa} مم بين الزاوية والشريحة الوسطى على جهة الفتحة 1050 مم، و${g.pb} مم على الجهة الأخرى`)
      expect([g.pa, g.pb], lb).toEqual([357.5, 365])
      expect(words, lb).not.toMatch(/بينها 361\.3/)
      const midNote = (get(d, 'strip-mid') as Pn & { note: string }).note
      expect(midNote, lb).toContain('على بعد 1050 مم من طرف الفتحة')
      expect(midNote, lb).not.toContain('في منتصفهما')
      // the frame and the middle strip alone
      const f = gen({ style, squares: 0 }, {}, T3)
      expect([...f.errors, ...f.warnings]).toEqual([])
      expect(f.panels.some(x => x.id.startsWith('square'))).toBe(false)
      expect((f.layout as { sheets: unknown[] }).sheets.length).toBeLessThanOrEqual(2)
    }
    expect(gen({ AH: 300, BH: 300, band: 150, AW: 1400, BW: 1400 }, {}, T3).errors.join(' ')).toMatch(/اجعل عرض المربعين 750 مم على الأكثر/)
  }, 120000)

})

/** A polygon as a hole-oriented loop (for its area's sign). */
/** The lattice's cut-outs on the board for these settings. */
function decorLat(p: Record<string, number>): number { return decorPieces(full(p)).lat.length }
function polyLoopCCW(pts: P[]): Loop { const l = { closed: true, pts }; return signedArea(l) > 0 ? { closed: true, pts: [...pts].reverse() } : l }

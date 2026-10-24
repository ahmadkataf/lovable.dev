import { describe, it, expect } from 'vitest'
import { CEILING_FRAMES, frameGeom, framePieces, cornerPlate, toFrame, CLEAT_REACH, minPatternWidth, rosetteDims, ROSE } from './ceilingframe'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, Loop } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, selfIntersects, segsCross } from './testutil'

const tpl = CEILING_FRAMES[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
type P = { x: number; y: number }
type Pn = { id: string; name: string; w: number; h: number; count: number; loops: Loop[]; material?: string }
type Dz = { panels: Pn[]; errors: string[]; warnings: string[]; notes: string[]; layout: never }
const gen = (p: Record<string, number>, s: Partial<typeof S0> = {}) => generate(tpl, p, { ...S0, ...s }) as never as Dz
const cutOf = (pn: Pn) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const get = (d: { panels: Pn[] }, id: string) => d.panels.find(x => x.id === id)!
const full = (p: Record<string, number>) => ({ ...tpl.defaults, ...p })
const SECOND = { PW: 1380, PH: 1080 }
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

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
    const lab = `${label} ${pn.id}`
    if (!(pn.w > 0)) bad.push(`${lab} width`)
    const outers = cutOf(pn).filter(l => signedArea(l) > 0)
    if (outers.length !== 1) { bad.push(`${lab} ${outers.length} outer loops`); continue }
    const outer = samplePoly(outers[0], 15)
    if (selfIntersects(outer)) bad.push(`${lab} self-intersects`)
    for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; if (Math.hypot(q.x - outer[i].x, q.y - outer[i].y) <= 1e-6) bad.push(`${lab} zero-length edge`) }
    const hs = cutOf(pn).filter(l => signedArea(l) < 0).map(h => { const p = samplePoly(h, step); return { p, b: boxOf(p), a: -signedArea(h) } })
    for (const h of hs) {
      if (selfIntersects(h.p)) bad.push(`${lab} hole self-intersects`)
      if (h.p.some(q => !pointIn(q, outer))) bad.push(`${lab} hole outside`)
      let de = Infinity
      for (const q of h.p) for (let i = 0; i < outer.length; i++) de = Math.min(de, ptSeg(q, outer[i], outer[(i + 1) % outer.length]))
      if (de < edge - 0.02) bad.push(`${lab} hole ${de.toFixed(2)} from the edge`)
      const across = Math.min(h.b.maxX - h.b.minX, h.b.maxY - h.b.minY, widthOf(h.p)) // a hull is never narrower than its shape
      if (h.a < 3 || across < 1.5) bad.push(`${lab} sliver hole (${h.a.toFixed(2)} mm², ${across.toFixed(2)} mm)`)
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
      if (g < gap - 0.02) bad.push(`${lab} holes ${g.toFixed(2)} apart`)
    }
    for (const l of pn.loops) for (const q of l.pts) if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) bad.push(`${lab} non-finite`)
  }
  const dxf = toDXF(d.layout)
  if (dxf.includes('NaN') || dxf.includes('undefined')) bad.push(`${label} dxf`)
  return bad
}

/** The strips' holes (as built, no kerf) in frame coordinates, side by side: 0 top, 1 right, 2 bottom, 3 left. */
function frameHoles(p: Record<string, number>) {
  const res = tpl.build(full(p), { t: 3, kerf: 0, finger: 0, inner: false }), g = frameGeom(full(p))
  const strips = [0, 1, 2, 3].map(s => res.panels.find(x => x.id === (s % 2 ? 'strip-short' : 'strip-long'))!.holes!.map(h => samplePoly({ ...h, pts: h.pts.map(q => ({ ...q, ...toFrame(g, s, q) })) }, 6)))
  const field = res.panels.find(x => x.id === 'field')?.holes?.map(h => samplePoly(h, 6).map(q => ({ x: q.x + g.b + g.fit, y: q.y + g.b + g.fit }))) ?? []
  return { res, g, strips, field }
}
const R4 = (x0: number, y0: number, x1: number, y1: number): P[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]

/**
 * What the frame must hold, on the pieces as built (no kerf): the rim on the gypsum and the strips' inner rails solid,
 * no cut-out within `web` of a mitre, the field sized to the frame's opening less the fit with its margins solid, no
 * corner plate or glue strip over a cut-out, and each corner a mirror image about its mitre (to within the difference
 * of the two strips' steps). The problems found, as text.
 */
function frameChecks(p: Record<string, number>): string[] {
  const bad: string[] = []
  const { res, g, strips, field } = frameHoles(p)
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
    const m = Math.min(...field.flat().map(q => Math.min(q.x - g.b - g.fit, g.PW - g.b - g.fit - q.x, q.y - g.b - g.fit, g.PH - g.b - g.fit - q.y)))
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
  const tol = 2 * Math.abs(g.p1 - g.p2) + 0.05, cen = (h: P[]) => h.reduce((a, q) => ({ x: a.x + q.x / h.length, y: a.y + q.y / h.length }), { x: 0, y: 0 })
  const T = strips[0].map(cen), Lf = strips[3].map(cen)
  for (const [A, B, k] of [[T, Lf, 'x'], [Lf, T, 'y']] as const) for (const c of A) if (c[k] < g.b + 10 && !B.some(o => Math.hypot(o.x - c.y, o.y - c.x) <= tol)) bad.push(`corner cut-out at ${c.x.toFixed(1)},${c.y.toFixed(1)} has no mirror image`)
  return bad
}

describe('ceiling decor', () => {
  it('builds the defaults and the second decor with no errors or warnings at t = 3, quickly', () => {
    for (const p of ([{}, SECOND] as Record<string, number>[])) {
      const d = gen(p, { t: 3 })
      expect(d.errors, JSON.stringify(p)).toEqual([])
      expect(d.warnings, JSON.stringify(p)).toEqual([])
    }
    gen({})
    const t0 = performance.now()
    gen({}, { kerf: 0.2 })
    expect(performance.now() - t0).toBeLessThan(300)
  })

  it('cuts the pieces the user needs, each on a 2440 × 1220 sheet', () => {
    for (const [p, W, H] of [[{}, 1400, 1050], [SECOND, 1380, 1080]] as const) {
      const d = gen(p), g = frameGeom(full(p))
      const ids = d.panels.map(x => `${x.id}×${x.count}`)
      expect(ids).toEqual(['strip-long×2', 'strip-short×2', 'field×1', 'corner×4', 'cleat-long×2', 'cleat-short×2'])
      expect(get(d, 'strip-long').w).toBeCloseTo(W, 6)
      expect(get(d, 'strip-short').w).toBeCloseTo(H, 6)
      expect(get(d, 'strip-long').h).toBeCloseTo(170, 6)
      expect(get(d, 'field').w).toBeCloseTo(W - 340 - 0.4, 6)
      expect(get(d, 'field').h).toBeCloseTo(H - 340 - 0.4, 6)
      for (const pn of d.panels) expect(Math.max(pn.w, pn.h) <= 2440 && Math.min(pn.w, pn.h) <= 1220, pn.id).toBe(true)
      // the strips are trapezoids with 45° ends: outside L, inside L − 2·band
      const o = cutOf(get(d, 'strip-long')).find(l => signedArea(l) > 0)!.pts
      const xs = o.map(q => `${Math.round(q.x)},${Math.round(q.y)}`).sort()
      expect(xs).toEqual(['0,0', `170,170`, `${W - 170},170`, `${W},0`].sort())
      // whole rosettes between the corners, the rings nearly touching as in the picture, both steps alike
      expect(g.n1 - 1).toBe(10)
      expect(g.n2 - 1).toBe(7)
      expect(Math.abs(g.p1 - g.p2) / g.p1).toBeLessThan(0.04)
      for (const pt of [g.p1, g.p2]) expect(2 * g.R / pt).toBeGreaterThan(0.8)
    }
  })

  it('fits both of the user\'s decors with 0, 30 or 60 mm on the gypsum and every centre: sheet, rim, mitres, glue pieces', () => {
    for (const size of [{}, SECOND]) for (const ov of [0, 30, 60]) for (const center of [1, 2, 3]) {
      const p = { ...size, ov, center }, d = gen(p, { kerf: 0.2 }), lab = JSON.stringify(p)
      expect(d.errors, lab).toEqual([])
      // with no rest on the gypsum there is no hidden rim for the corner plates: it says so (and how much rim they need)
      expect(d.warnings.filter(w => !(ov === 0 && /قطع الزوايا/.test(w))), lab).toEqual([])
      for (const pn of d.panels) expect(Math.max(pn.w, pn.h) <= 2440 && Math.min(pn.w, pn.h) <= 1220, `${lab} ${pn.id}`).toBe(true)
      expect(frameChecks(p), lab).toEqual([])
    }
  }, 20000)

  it('is sound at the defaults and for both decors, thin and thick, with and without kerf; webs never under web', () => {
    for (const p of ([{}, SECOND, { center: 2 }, { center: 3, cleats: 0 }, { back: 1 }] as Record<string, number>[])) for (const t of [3, 6]) for (const kerf of [0, 0.2]) {
      const d = gen(p, { t, kerf })
      expect(d.errors).toEqual([])
      // at kerf 0 every web is at least `web` (3 mm); with the kerf the holes' paths move 0.1 mm into them
      const w = kerf ? 3 + kerf : 3
      expect(soundness(d, `${JSON.stringify(p)} t=${t} kerf=${kerf}`, w, w), JSON.stringify(p)).toEqual([])
    }
  }, 30000)

  it('keeps every web at least web to the hundredth, also on short strips round the corner kites', () => {
    // short strips (one or two steps) put the far corner and the strip's middle next to the corner kites
    for (const p of [{}, SECOND, { web: 2, center: 3, ov: 0, PH: 391, band: 150, med: 150 }, { web: 5, center: 3, ov: 0, PH: 363, band: 150, med: 150 },
      { ov: 65, band: 131, center: 3, PW: 1054, PH: 1791 }, { web: 8, band: 260 }] as Record<string, number>[]) {
      const d = gen(p)
      expect(d.errors, JSON.stringify(p)).toEqual([])
      const web = full(p).web
      expect(soundness(d, JSON.stringify(p), web + 0.01, web + 0.01, 2), JSON.stringify(p)).toEqual([])
    }
  }, 20000)

  it('carries the same pattern on both halves of every strip, and the corner is a mirror image about the mitre', () => {
    for (const p of ([{}, SECOND, { band: 230, ov: 50 }, { PW: 900, PH: 640, band: 120, center: 3 }] as Record<string, number>[])) {
      const g = frameGeom(full(p)), { top, side } = framePieces(g)
      for (const [pcs, L] of [[top, g.PW], [side, g.PH]] as const) {
        // the mirror image of every shape in the strip's middle is a shape of the same kind
        const at = new Map<string, P[]>()
        for (const pc of pcs) { const k = pc.key; if (!at.has(k)) at.set(k, []); at.get(k)!.push(pc.c) }
        for (const pc of pcs) expect(at.get(pc.key)!.some(q => Math.hypot(q.x - (L - pc.c.x), q.y - pc.c.y) < 1e-6), `${pc.key} mirrored`).toBe(true)
        // whole rosettes, evenly spaced
        const dots = pcs.filter(pc => /^r\d+dot$/.test(pc.key)).map(pc => pc.c.x).sort((a, b) => a - b)
        expect(dots.length).toBe(Math.round((L - 2 * g.vc) / (L === g.PW ? g.p1 : g.p2)) - 1)
        for (let i = 1; i < dots.length; i++) expect(dots[i] - dots[i - 1]).toBeCloseTo(L === g.PW ? g.p1 : g.p2, 6)
      }
      // the top strip's first corner and the left strip's last corner (frame coordinates), reflected in y = x
      const lim = g.b + 5 + Math.max(g.p1, g.p2) / 2, T = top.map(pc => ({ ...pc, f: toFrame(g, 0, pc.c), poly: pc.poly.map(q => toFrame(g, 0, q)) }))
      const Lf = side.map(pc => ({ ...pc, f: toFrame(g, 3, pc.c), poly: pc.poly.map(q => toFrame(g, 3, q)) }))
      const tol = 2 * Math.abs(g.p1 - g.p2) + 1e-6 // shapes up to two steps from the corner move with the step
      for (const [A, B] of [[T.filter(pc => pc.f.x < lim), Lf], [Lf.filter(pc => pc.f.y < lim), T]]) for (const pc of A) {
        const m = B.find(o => o.key === pc.key && Math.hypot(o.f.x - pc.f.y, o.f.y - pc.f.x) <= tol)
        expect(m, `${JSON.stringify(p)} ${pc.key} at ${pc.f.x.toFixed(1)},${pc.f.y.toFixed(1)} has no mirror image`).toBeTruthy()
        // the corner rosette and its kites do not depend on the steps: exact mirror images
        if (/^(C|K)/.test(pc.key)) for (let i = 0; i < pc.poly.length; i++) {
          const q = pc.poly[i], r = m!.poly.reduce((best, o) => Math.min(best, Math.hypot(o.x - q.y, o.y - q.x)), Infinity)
          expect(r).toBeLessThan(1e-6)
        }
      }
      // the corner rosette sits on the mitre; neither of its halves has a petal or its dot across it
      const cr = top.filter(pc => pc.key.startsWith('C'))
      expect(cr.length).toBeGreaterThan(10)
      expect(cr.some(pc => pc.key === 'Cp2' || pc.key === 'Cp10')).toBe(false)
    }
  })

  it('assembles into the frame: the four strips tile it along the mitres, and all four corners are alike', () => {
    for (const p of ([{}, SECOND] as Record<string, number>[])) {
      const { res, g, strips } = frameHoles(p)
      // the outlines in frame coordinates: each mitre is shared by exactly the two strips meeting there
      const outline = (s: number) => res.panels.find(x => x.id === (s % 2 ? 'strip-short' : 'strip-long'))!.shape![0].pts.map(q => toFrame(g, s, q))
      const area = (pts: P[]) => Math.abs(pts.reduce((a, q, i) => a + q.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * q.y, 0)) / 2
      const total = [0, 1, 2, 3].reduce((a, s) => a + area(outline(s)), 0)
      expect(total).toBeCloseTo(g.PW * g.PH - (g.PW - 2 * g.b) * (g.PH - 2 * g.b), 6)
      const key = (q: P) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
        const shared = outline(a).map(key).filter(k => outline(b).map(key).includes(k))
        expect(shared.length, `strips ${a} and ${b}`).toBe(2) // the outer and the inner end of their mitre
      }
      // the bottom-right corner is the top-left one turned half round, the top-right its mirror image in x = PW/2
      const cen = (h: P[]) => h.reduce((s, q) => ({ x: s.x + q.x / h.length, y: s.y + q.y / h.length }), { x: 0, y: 0 })
      const all = strips.flat().map(cen), has = (q: P) => all.some(o => Math.hypot(o.x - q.x, o.y - q.y) < 1e-6)
      for (const c of all) if (c.x < g.b && c.y < g.b) {
        expect(has({ x: g.PW - c.x, y: g.PH - c.y }), 'bottom-right').toBe(true)
        expect(has({ x: g.PW - c.x, y: c.y }), 'top-right').toBe(true)
        expect(has({ x: c.x, y: g.PH - c.y }), 'bottom-left').toBe(true)
      }
    }
  })

  it('runs every mitre through solid wood: no hole within web of it, a solid bar of 2·web across the corner', () => {
    for (const p of ([{}, SECOND, { web: 5 }, { band: 120, ov: 10, center: 2 }] as Record<string, number>[])) {
      const g = frameGeom(full(p)), { top, side } = framePieces(g)
      for (const [pcs, L] of [[top, g.PW], [side, g.PH]] as const) for (const pc of pcs) {
        const dm = Math.min(...samplePoly({ closed: true, pts: pc.pts }, 3).map(q => Math.min(q.x - q.y, L - q.x - q.y) / Math.SQRT2))
        expect(dm, `${JSON.stringify(p)} ${pc.key}`).toBeGreaterThan(g.web - 1e-6)
        const ys = samplePoly({ closed: true, pts: pc.pts }, 3).map(q => q.y)
        expect(Math.min(...ys)).toBeGreaterThan(g.ov + g.web - 1e-6) // the rim on the gypsum stays solid
        expect(Math.max(...ys)).toBeLessThan(g.b - g.rail + 1e-6)
      }
    }
  })

  it('glues every plate and strip on solid wood: no cut-out under them', () => {
    for (const p of ([{}, SECOND, { ov: 60, band: 220 }, { center: 2 }, { web: 2 }] as Record<string, number>[])) {
      const g = frameGeom(full(p))
      expect(cornerPlate(g)).toBeTruthy()
      expect(frameChecks(p), JSON.stringify(p)).toEqual([])
      if (g.field) {
        const co = CLEAT_REACH, { b, fit, PW, PH } = g, d = gen(p)
        expect(get(d, 'cleat-long').w).toBeCloseTo(PW - 2 * b + 2 * co, 3)
        expect(get(d, 'cleat-short').w).toBeCloseTo(PH - 2 * b - 2 * fit - 2 * co - 2, 3)
        expect(get(d, 'cleat-long').h).toBeCloseTo(2 * co + fit, 3)
      }
    }
  })

  // the error's kind (so a fix is judged on that error only), and the fixes it offers: [the keys a value goes to, the value]
  const KINDS: [RegExp, string][] = [
    [/قليل: لا تتّسع وردة/, 'narrow'], [/كبيرة على عرض الإطار/, 'ov'], [/كبير على ديكور/, 'wide'], [/صغير على إطار فيه ركبة/, 'small'],
    [/أكبر من اللوح الأوسط/, 'medfield'], [/صغير على المثمّن|صغير على مثمّن/, 'fieldsmall'], [/أكبر من فتحة الإطار|فتحة الإطار صغيرة/, 'medopen'],
    [/أطول من لوح الخشب/, 'long'], [/أعرض من لوح الخشب/, 'sheetwide'], [/لا يتّسع في لوح/, 'fieldsheet'], [/لوح الأكريليك/, 'back'],
  ]
  const kindOf = (e: string) => KINDS.find(([re]) => re.test(e))?.[1] ?? 'other'
  function fixesOf(e: string): [string[], number][] {
    const out: [string[], number][] = [], kind = kindOf(e)
    for (const part of e.split(/: |، أو | أو /)) {
      const m = part.match(/([\d.]+) مم على (?:الأقل|الأكثر)/)
      if (m) {
        const keys = /العرض والطول الكلّيين/.test(part) ? ['PW', 'PH'] : /العرض الكلّي/.test(part) ? ['PW'] : /الطول الكلّي/.test(part) ? ['PH']
          : /الركبة/.test(part) ? ['ov'] : /عرض الإطار/.test(part) ? ['band'] : /اجعله/.test(part) ? [{ medfield: 'med', medopen: 'med' }[kind] ?? 'band'] : []
        if (keys.length) out.push([keys, Number(m[1])])
      }
      if (/ألغِه \(0\)/.test(part)) out.push([['back'], 0])
      if (/«إطار فقط»/.test(part)) out.push([['center'], 3])
      if (/«مثمّن منفصل»/.test(part)) out.push([['center'], 2])
    }
    return out
  }
  /** Every error names a value in range, and each value alone clears its error; the problems found. */
  function fixProblems(p: Record<string, number>): string[] {
    const bad: string[] = [], d = gen(p, { kerf: 0.2 })
    for (const e of d.errors) {
      const kind = kindOf(e), fixes = fixesOf(e)
      if (kind === 'other' || !fixes.length) { bad.push(`${JSON.stringify(p)}: no value in «${e}»`); continue }
      for (const [keys, v] of fixes) {
        for (const k of keys) { const def = tpl.params.find(x => x.key === k)!; if (v < def.min || v > def.max) bad.push(`${JSON.stringify(p)}: ${k} = ${v} out of range in «${e}»`) }
        const after = gen({ ...p, ...Object.fromEntries(keys.map(k => [k, v])) }, { kerf: 0.2 })
        if (after.errors.some(x => kindOf(x) === kind)) bad.push(`${JSON.stringify(p)} with ${keys.join('+')} = ${v}: «${after.errors.find(x => kindOf(x) === kind)}»`)
      }
    }
    return bad
  }

  it('says what to change and to what, and every value it suggests clears that error', () => {
    // [the parameters, a pattern naming the error, the keys its suggested values go to (in the order they appear)]
    const cases: [Record<string, number>, RegExp, string[]][] = [
      [{ band: 80 }, /عرض الإطار \(80 مم\) قليل/, ['band']],
      [{ ov: 120 }, /الركبة على الجبس \(120 مم\) كبيرة/, ['ov', 'band']],
      [{ ov: 200 }, /الركبة على الجبس \(200 مم\) كبيرة/, ['ov', 'band']],
      [{ ov: 60, band: 120, web: 5 }, /كبيرة على عرض الإطار|قليل: لا تتّسع/, ['ov', 'band']],
      [{ band: 560 }, /عرض الإطار \(560 مم\) كبير/, ['band']],
      [{ PW: 300, PH: 300 }, /كبير على ديكور 300 × 300/, ['band']],
      [{ med: 800 }, /المثمّن \(800 مم\) أكبر من اللوح الأوسط/, ['med', 'band']],
      [{ PW: 760, PH: 400, band: 120, ov: 5, med: 200 }, /صغير على المثمّن/, ['band']],
      [{ center: 2, med: 1000 }, /المثمّن \(1000 مم\) أكبر من فتحة الإطار/, ['med']],
      [{ sheetL: 1300 }, /أطول من لوح الخشب/, ['PW']],
      [{ sheetL: 1300, PW: 1000, PH: 1350 }, /أطول من لوح الخشب/, ['PH']],
      [{ sheetL: 900 }, /أطول من لوح الخشب/, ['PW+PH']],
      [{ sheetW: 150 }, /أعرض من لوح الخشب/, ['band']],
      [{ PW: 2440, PH: 1700 }, /لا يتّسع في لوح/, ['band']],
      [{ back: 1, PW: 2440, PH: 1300 }, /لوح الأكريليك/, ['back', 'PH']],
      // even the narrowest band is too much for the decor: less rest on the gypsum, or a bigger decor
      [{ PW: 302, PH: 344, ov: 161, band: 279, center: 3 }, /صغير على إطار فيه ركبة 161 مم/, ['ov', 'PW+PH']],
      [{ PW: 1664, PH: 539, ov: 182, band: 385, center: 3 }, /صغير على إطار فيه ركبة 182 مم/, ['ov', 'PH']],
    ]
    for (const [p, re, keys] of cases) {
      const d = gen(p), e = d.errors.find(x => re.test(x))
      expect(e, `${JSON.stringify(p)}: ${d.errors.join(' | ')}`).toBeTruthy()
      // the values it names («… مم على الأقل / الأكثر», «ألغِه (0)»), in order
      const vals = [...e!.matchAll(/([\d.]+) مم على (?:الأقل|الأكثر)|ألغِه \((0)\)/g)].map(m => Number(m[1] ?? m[2]))
      expect(vals.length, `${e}`).toBe(keys.length)
      keys.forEach((k, i) => {
        for (const kk of k.split('+')) { const def = tpl.params.find(x => x.key === kk)!; expect(vals[i] >= def.min && vals[i] <= def.max, `${kk} = ${vals[i]} in range`).toBe(true) }
        const after = gen({ ...p, ...Object.fromEntries(k.split('+').map(kk => [kk, vals[i]])) })
        expect(after.errors.some(x => re.test(x)), `${JSON.stringify(p)} with ${k} = ${vals[i]}: ${after.errors.join(' | ')}`).toBe(false)
      })
      expect(fixProblems(p)).toEqual([])
    }
  })

  it('gives every refusal a value that clears it, across random settings', () => {
    const rnd = seeded(99), bad: string[] = []
    let refused = 0
    for (let i = 0; i < 220; i++) {
      const p = {
        PW: Math.round(300 + rnd() * 2140), PH: Math.round(300 + rnd() * 2140), ov: Math.round(rnd() * 200), band: Math.round(60 + rnd() * 540),
        center: 1 + Math.floor(rnd() * 3), med: Math.round(150 + rnd() * 1050), web: [2, 3, 4, 5, 8][Math.floor(rnd() * 5)], fit: Math.round(rnd() * 20) / 10,
        cleats: rnd() < 0.8 ? 1 : 0, back: rnd() < 0.3 ? 1 : 0, sheetL: rnd() < 0.8 ? 2440 : Math.round(300 + rnd() * 2700), sheetW: rnd() < 0.8 ? 1220 : Math.round(300 + rnd() * 1700),
      }
      const probs = fixProblems(p)
      if (gen(p).errors.length) refused++
      bad.push(...probs)
    }
    expect(refused).toBeGreaterThan(100)
    expect(bad.slice(0, 10)).toEqual([])
  }, 30000)

  it('needs the room it says: the narrowest band holds a rosette, and one step less does not', () => {
    for (const web of [2, 3, 5, 8]) for (const center of [1, 3]) {
      const g0 = frameGeom(full({ web, center })), WpMin = minPatternWidth(web)
      expect(rosetteDims(ROSE.R * WpMin, web)).toBeTruthy()
      expect(rosetteDims(ROSE.R * (WpMin - 0.5), web)).toBeNull()
      const bandMin = Math.ceil((30 + web + g0.rail + WpMin) * 2 - 1e-6) / 2
      expect(gen({ web, center, band: bandMin }).errors.filter(x => /قليل|كبيرة على عرض/.test(x))).toEqual([])
      expect(gen({ web, center, band: bandMin - 0.5 }).errors.length).toBeGreaterThan(0)
    }
  })

  it('cuts no sliver, even in the narrowest bands: the shapes shrink to 2 mm across and 4 mm², or are left out', () => {
    for (const web of [2, 2.5, 3, 5, 8]) for (const center of [1, 3]) for (const dW of [0, 3, 7.5, 15, 30]) {
      const g0 = frameGeom(full({ web, center })), band = Math.ceil((30 + web + g0.rail + minPatternWidth(web) + dW) * 2) / 2
      const p = { web, center, band, PW: 900, PH: 700, med: 150 }
      const d = gen(p)
      if (d.errors.length) continue
      for (const pn of d.panels.filter(x => x.id.startsWith('strip'))) for (const h of cutOf(pn).filter(l => signedArea(l) < 0)) {
        const sp = samplePoly(h, 3), b = boxOf(sp)
        expect(-signedArea(h), `${JSON.stringify(p)} area`).toBeGreaterThanOrEqual(3.5)
        expect(Math.min(b.maxX - b.minX, b.maxY - b.minY, widthOf(sp)), `${JSON.stringify(p)} width`).toBeGreaterThanOrEqual(1.9)
      }
    }
  })

  it('tells the user how it goes together, with the sizes for both decors', () => {
    const notes = gen({}).notes.join('\n')
    for (const s of ['1340 × 990', '1400 × 1050', '1380 × 1080', '1060 مم من الداخل', '710 مم من الداخل', '10 وردات', '7 وردات', 'من الداخل إلى الخارج', 'على لوح الجبسن بورد', 'أكريليك أوبال', 'ادهنه']) expect(notes, s).toContain(s)
    expect(gen(SECOND).notes.join('\n')).toContain('1320 × 1020')
    expect(gen({ back: 1 }).panels.find(x => x.id === 'back')!.material).toBe('white')
  })

  // every parameter at its ends at two thicknesses, and 150 random settings at kerf 0.2 (a fixed seed): sound, with
  // the frame's own rules kept, whenever no error is reported
  it('is sound across its parameters or refuses with an error', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    const rnd = seeded(2024)
    for (let i = 0; i < 150; i++) variants.push({
      PW: Math.round(300 + rnd() * 2140), PH: Math.round(300 + rnd() * 1500), ov: Math.round(rnd() * 120), band: Math.round(60 + rnd() * 300),
      center: 1 + Math.floor(rnd() * 3), med: Math.round(150 + rnd() * 700), web: [2, 2.5, 3, 4, 5, 8][Math.floor(rnd() * 6)], fit: Math.round(rnd() * 20) / 10,
      cleats: rnd() < 0.8 ? 1 : 0, back: rnd() < 0.2 ? 1 : 0,
    })
    let runs = 0, refused = 0
    const bad: string[] = []
    variants.forEach((v, i) => {
      const t = i <= 2 * tpl.params.length ? [3, 6] : [[3, 4, 6][i % 3]]
      for (const th of t) {
        const d = gen(v, { t: th, kerf: 0.2 })
        runs++
        for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true)
        if (d.errors.length) { refused++; continue }
        const web = full(v).web, lab = `${JSON.stringify(v)} t=${th}`
        // the kerf moves every path 0.1 mm away from the wood: the webs between the paths are 0.2 mm wider
        bad.push(...soundness(d, lab, web + 0.2, web + 0.2), ...frameChecks(v).map(s => `${lab}: ${s}`))
        // no warning unless there is no hidden rim to glue the corner plates to
        bad.push(...d.warnings.filter(w => !(full(v).ov + web - 1 < 6 && /قطع الزوايا/.test(w))).map(w => `${lab}: ${w}`))
        for (const pn of d.panels) if (pn.material !== 'white' && !(Math.max(pn.w, pn.h) <= 2440 + 1 && Math.min(pn.w, pn.h) <= 1220 + 1)) bad.push(`${lab}: ${pn.id} off the sheet`)
      }
    })
    expect(bad.slice(0, 10)).toEqual([])
    expect(runs).toBeGreaterThan(150)
    expect(refused).toBeLessThan(0.75 * runs)
  }, 60000)
})

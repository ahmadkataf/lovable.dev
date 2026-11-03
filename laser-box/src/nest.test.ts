import { describe, it, expect } from 'vitest'
import { nest, checkSheet, rotatePanel, NestOpts, NestResult } from './nest'
import { buildPanel, Panel } from './joints'
import { Loop, Vtx, arcInfo, bbox, polyLoop, disc, circle, signedArea } from './geom'
import { segDist, pointIn, P } from './testutil'
import { TEMPLATES } from './templates'
import { generate, DEFAULT_SETTINGS } from './generate'
import { layout, nestLayout, sheetLayout, usedShare } from './layout'
import { toSVG, toDXF } from './export'
import { offSheet } from './testutil'

// ---------------------------------------------------------------- pieces

const poly = (id: string, pts: [number, number][], count = 1, extra: Partial<Parameters<typeof buildPanel>[0]> = {}): Panel =>
  buildPanel({ id, name: id, w: 0, h: 0, count, shape: [polyLoop(pts.map(([x, y]) => ({ x, y })), 'outer')], ...extra }, { t: 3, finger: 9 })
const rectP = (id: string, w: number, h: number, count = 1, material?: string) => poly(id, [[0, 0], [w, 0], [w, h], [0, h]], count, material ? { material } : {})
const discP = (id: string, r: number, count = 1, hole = 0) =>
  buildPanel({ id, name: id, w: 0, h: 0, count, shape: [disc(r, r, r)], holes: hole ? [circle(r, r, hole)] : [] }, { t: 3, finger: 9 })

const SHEET = { w: 1220, h: 2440 }
const opts = (o: Partial<NestOpts> = {}): NestOpts => ({ spacing: 3, margin: 5, sheet: () => SHEET, budgetMs: 250, ...o })

// ---------------------------------------------------------------- an independent check of a result

/** a loop as a polygon, arcs no further than 0.004 mm from their chords */
function sample(l: Loop): P[] {
  const out: P[] = [], n = l.pts.length
  for (let i = 0; i < n; i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n]
    out.push({ x: p.x, y: p.y })
    if (!p.b || (!l.closed && i === n - 1)) continue
    const a = arcInfo(p, q, p.b), step = 2 * Math.acos(Math.max(0, 1 - 0.004 / a.r)), m = Math.max(2, Math.ceil(a.theta / step))
    for (let k = 1; k < m; k++) { const ang = a.a0 + (a.ccw ? -1 : 1) * a.theta * k / m; out.push({ x: a.c.x + a.r * Math.cos(ang), y: a.c.y + a.r * Math.sin(ang) }) }
  }
  return out
}
const moved = (pts: P[], dx: number, dy: number) => pts.map(p => ({ x: p.x + dx, y: p.y + dy }))
const segsOf = (polys: P[][]) => polys.flatMap(pl => pl.map((a, i) => [a, pl[(i + 1) % pl.length]] as [P, P]))
function dist(A: [P, P][], B: [P, P][], win: number[]): number {
  const inWin = (s: [P, P]) => Math.max(s[0].x, s[1].x) >= win[0] && Math.min(s[0].x, s[1].x) <= win[2] && Math.max(s[0].y, s[1].y) >= win[1] && Math.min(s[0].y, s[1].y) <= win[3]
  const a = A.filter(inWin), b = B.filter(inWin)
  let best = Infinity
  for (const s of a) for (const t of b) best = Math.min(best, segDist(s[0], s[1], t[0], t[1]))
  return best
}

/**
 * Everything the nesting promises: every copy placed once; each piece only moved and turned (never mirrored);
 * inside its sheet and the margin; no two pieces closer than the spacing (less 0.05) on their true outlines; none
 * inside another's material.
 */
function validate(res: NestResult, panels: Panel[], o: NestOpts) {
  const byId = new Map(panels.map(p => [p.id, p]))
  for (const p of panels) {
    const mine = res.placed.filter(pl => pl.sourceId === p.id)
    if (res.tooBig.includes(p.id)) { expect(mine.length).toBe(p.count); continue }
    expect(mine.map(pl => pl.copy).sort((a, b) => a - b)).toEqual([...Array(p.count).keys()])
  }
  expect(res.placed.length).toBe(panels.reduce((a, p) => a + p.count, 0))
  res.sheets.forEach((sh, i) => expect(sh.index).toBe(i))
  for (const pl of res.placed) {
    const src = byId.get(pl.sourceId)!
    expect(pl.panel.material).toBe(src.material)
    expect(res.sheets[pl.sheet].material).toBe(src.material)
    // a rigid quarter turn of the source: every vertex at R(v) + t, bulges unchanged, areas keep their sign
    const k = pl.rot / 90, R = (x: number, y: number) => (k === 0 ? [x, y] : k === 1 ? [-y, x] : k === 2 ? [-x, -y] : [y, -x])
    expect(pl.panel.loops.length).toBe(src.loops.length)
    const [r0x, r0y] = R(src.loops[0].pts[0].x, src.loops[0].pts[0].y)
    const tx = pl.panel.loops[0].pts[0].x - r0x, ty = pl.panel.loops[0].pts[0].y - r0y
    src.loops.forEach((l, li) => {
      const m = pl.panel.loops[li]
      expect(m.closed).toBe(l.closed); expect(m.layer).toBe(l.layer); expect(m.pts.length).toBe(l.pts.length)
      l.pts.forEach((v: Vtx, vi) => {
        const [x, y] = R(v.x, v.y), w = m.pts[vi]
        expect(Math.abs(w.x - x - tx) + Math.abs(w.y - y - ty)).toBeLessThan(1e-6)
        expect(w.b ?? 0).toBe(v.b ?? 0)
      })
      if (l.closed) expect(Math.sign(signedArea(m))).toBe(Math.sign(signedArea(l)))
    })
    const ob = bbox(pl.panel.loops.filter(l => l.closed && l.layer !== 'engrave'))
    expect(Math.abs(ob.minX) + Math.abs(ob.minY)).toBeLessThan(1e-6)
    expect(pl.panel.w).toBeCloseTo(ob.maxX, 6); expect(pl.panel.h).toBeCloseTo(ob.maxY, 6)
  }
  const s = Math.max(o.spacing, 0.1)
  for (const sh of res.sheets) {
    const on = res.placed.filter(pl => pl.sheet === sh.index)
    const geo = on.map(pl => {
      const cut = pl.panel.loops.filter(l => l.layer !== 'engrave')
      const b = bbox(cut)
      const outer = cut.filter(l => l.closed && signedArea(l) > 0).map(l => moved(sample(l), pl.x, pl.y))
      const holes = cut.filter(l => l.closed && signedArea(l) < 0).map(l => moved(sample(l), pl.x, pl.y))
      return { box: [b.minX + pl.x, b.minY + pl.y, b.maxX + pl.x, b.maxY + pl.y], outer, holes, segs: segsOf([...outer, ...holes]) }
    })
    for (const g of geo) {
      expect(g.box[0]).toBeGreaterThanOrEqual(o.margin - 1e-6); expect(g.box[1]).toBeGreaterThanOrEqual(o.margin - 1e-6)
      expect(g.box[2]).toBeLessThanOrEqual(sh.w - o.margin + 1e-6); expect(g.box[3]).toBeLessThanOrEqual(sh.h - o.margin + 1e-6)
    }
    const used = on.reduce((a, pl) => [Math.max(a[0], pl.x + pl.panel.w), Math.max(a[1], pl.y + pl.panel.h)], [0, 0])
    expect(sh.used.w).toBeCloseTo(used[0], 6); expect(sh.used.h).toBeCloseTo(used[1], 6)
    const inMaterial = (p: P, g: typeof geo[number]) => g.outer.some(pl => pointIn(p, pl)) && !g.holes.some(pl => pointIn(p, pl))
    for (let i = 0; i < geo.length; i++) for (let j = i + 1; j < geo.length; j++) {
      const A = geo[i], B = geo[j]
      if (A.box[0] > B.box[2] + s || B.box[0] > A.box[2] + s || A.box[1] > B.box[3] + s || B.box[1] > A.box[3] + s) continue
      const win = [Math.max(A.box[0], B.box[0]) - s, Math.max(A.box[1], B.box[1]) - s, Math.min(A.box[2], B.box[2]) + s, Math.min(A.box[3], B.box[3]) + s]
      const d = dist(A.segs, B.segs, win)
      if (d < s - 0.05) throw new Error(`pieces ${on[i].sourceId}#${on[i].copy} and ${on[j].sourceId}#${on[j].copy} on sheet ${sh.index} are ${d.toFixed(3)} mm apart`)
      for (const pl of B.outer) expect(inMaterial(pl[0], A)).toBe(false)
      for (const pl of A.outer) expect(inMaterial(pl[0], B)).toBe(false)
    }
  }
}

const boxesOverlap = (a: NestResult['placed'][number], b: NestResult['placed'][number]) =>
  a.sheet === b.sheet && a.x < b.x + b.panel.w && b.x < a.x + a.panel.w && a.y < b.y + b.panel.h && b.y < a.y + a.panel.h
const overlappingPairs = (res: NestResult) => {
  let n = 0
  for (let i = 0; i < res.placed.length; i++) for (let j = i + 1; j < res.placed.length; j++) if (boxesOverlap(res.placed[i], res.placed[j])) n++
  return n
}
const lastUsed = (res: NestResult) => res.sheets[res.sheets.length - 1].used

/** a reproducible random number source */
function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/** star-like outlines, some edges bowed into arcs, some pieces with a round hole, a few with a guide line */
function randomPanels(seed: number, kinds: number, maxCount = 4, maxSize = 400): Panel[] {
  const rand = rng(seed), out: Panel[] = []
  for (let k = 0; k < kinds; k++) {
    const R = 15 + rand() * (maxSize / 2 - 15), n = 4 + Math.floor(rand() * 9)
    const pts: Vtx[] = []
    for (let i = 0; i < n; i++) {
      const ang = (i + 0.3 * rand()) / n * 2 * Math.PI, rr = R * (0.45 + 0.55 * rand())
      pts.push({ x: R + rr * Math.cos(ang), y: R + rr * Math.sin(ang) })
    }
    const outer = polyLoop(pts, 'outer')
    outer.pts.forEach(v => { if (rand() < 0.3) v.b = (rand() < 0.5 ? -1 : 1) * 0.12 })
    const hole = rand() < 0.3 ? [circle(R, R, 0.3 * R)] : []
    const engrave = rand() < 0.3 ? [{ closed: false, pts: [{ x: R - 0.2 * R, y: R }, { x: R + 0.2 * R, y: R }] }] : []
    out.push(buildPanel({ id: `p${k}`, name: `p${k}`, w: 0, h: 0, count: 1 + Math.floor(rand() * maxCount), shape: [outer], holes: hole, engrave }, { t: 3, finger: 9 }))
  }
  return out
}

describe('nest: sheets', () => {
  it('twelve 400 × 600 rectangles fill one 1220 × 2440 sheet', () => {
    const ps = [rectP('r', 400, 600, 12)], o = opts()
    const res = nest(ps, o)
    validate(res, ps, o)
    expect(res.sheets.length).toBe(1)
    expect(res.tooBig).toEqual([])
  })

  it('more than a sheet holds goes on several sheets, every one but the last full', () => {
    const ps = [rectP('r', 400, 600, 40)], o = opts()
    const res = nest(ps, o)
    validate(res, ps, o)
    expect(res.sheets.length).toBe(4) // 12 a sheet
    for (const sh of res.sheets.slice(0, 3)) expect(res.placed.filter(p => p.sheet === sh.index).length).toBe(12)
  })

  it('reports a piece too big for the sheet either way round and puts it alone on a sheet made big enough', () => {
    const ps = [rectP('huge', 1300, 2500), rectP('sq', 300, 300, 2)], o = opts()
    const res = nest(ps, o)
    expect(res.tooBig).toEqual(['huge'])
    const pl = res.placed.find(p => p.sourceId === 'huge')!
    const sh = res.sheets[pl.sheet]
    expect(res.placed.filter(p => p.sheet === pl.sheet).length).toBe(1)
    expect(sh.w).toBeGreaterThanOrEqual(1310); expect(sh.h).toBeGreaterThanOrEqual(2510)
    validate(res, ps, o)
  })

  it('cuts each material from its own sheets, of that material’s size', () => {
    const ps = [rectP('a', 200, 100, 3), rectP('m', 150, 150, 7, 'mirror'), rectP('b', 300, 80, 2), rectP('g', 100, 40, 4, 'gold')]
    const sizes: Record<string, { w: number; h: number }> = { main: SHEET, mirror: { w: 600, h: 400 }, gold: { w: 300, h: 300 } }
    const o = opts({ sheet: m => sizes[m ?? 'main'] })
    const res = nest(ps, o)
    validate(res, ps, o)
    expect(res.sheets.map(s => s.material)).toEqual([undefined, 'mirror', 'mirror', 'gold'])
    expect(res.sheets[1]).toMatchObject({ w: 600, h: 400 })
    expect(res.sheets[3]).toMatchObject({ w: 300, h: 300 })
  })

  it('works on a sheet lying wider than long, and with turning off', () => {
    const ps = [rectP('a', 500, 120, 5), poly('t', [[0, 0], [300, 0], [200, 90], [0, 90]], 4)]
    for (const o of [opts({ sheet: () => ({ w: 2440, h: 1220 }) }), opts({ rotate: false }), opts({ rotate: false, sheet: () => ({ w: 2440, h: 1220 }) })]) {
      const res = nest(ps, o)
      validate(res, ps, o)
      if (o.rotate === false) expect(res.placed.every(p => p.rot === 0)).toBe(true)
    }
  })

  it('keeps a piece exactly as wide as the sheet allows (raster rounding does not lose it)', () => {
    const ps = [rectP('wide', 1210, 100), rectP('sq', 100, 100, 3)], o = opts({ spacing: 3.3 })
    const res = nest(ps, o)
    validate(res, ps, o)
    expect(res.tooBig).toEqual([])
    expect(res.sheets.length).toBe(1)
  })

  it('empty input, zero counts', () => {
    expect(nest([], opts())).toEqual({ placed: [], sheets: [], tooBig: [] })
    const res = nest([rectP('a', 100, 100, 0), rectP('b', 50, 50, 1)], opts())
    expect(res.placed.map(p => p.sourceId)).toEqual(['b'])
  })
})

describe('nest: true shapes', () => {
  it('pairs mitred strips (trapezoids) head to tail', () => {
    // 640 long, 440 on the short side: two side by side by their boxes need 1283 mm, head to tail 1184
    const ps = [poly('strip', [[0, 0], [640, 0], [540, 100], [100, 100]], 12)], o = opts()
    const res = nest(ps, o)
    validate(res, ps, o)
    expect(overlappingPairs(res)).toBeGreaterThanOrEqual(5)
    expect(new Set(res.placed.map(p => p.rot % 180)).size + new Set(res.placed.map(p => p.rot)).size).toBeGreaterThan(2)
    // less than their boxes could ever take
    const u = lastUsed(res)
    expect((u.w - 5) * (u.h - 5)).toBeLessThan(12 * 643 * 103)
  })

  it('fits L shapes into each other', () => {
    const ps = [poly('L', [[0, 0], [300, 0], [300, 80], [80, 80], [80, 300], [0, 300]], 8)], o = opts()
    const res = nest(ps, o)
    validate(res, ps, o)
    expect(overlappingPairs(res)).toBeGreaterThanOrEqual(3)
    const u = lastUsed(res)
    expect((u.w - 5) * (u.h - 5)).toBeLessThan(8 * 303 * 303 * 0.8)
  })

  it('staggers rows of discs', () => {
    // 32 discs: rows of 11 and 10 in the valleys take three rows, a square grid of 11 a row three full rows and more area
    const ps = [discP('d', 50, 32)], o = opts()
    const res = nest(ps, o)
    validate(res, ps, o)
    // diagonal neighbours in the valleys of the row below: their boxes overlap, which a square grid never does
    expect(overlappingPairs(res)).toBeGreaterThanOrEqual(10)
    const u = lastUsed(res)
    expect((u.w - 5) * (u.h - 5)).toBeLessThan(0.97 * 1130 * 306)
  })

  it('puts a small piece into a large ring’s hole', () => {
    const ps = [discP('ring', 200, 1, 150), discP('disc', 100)], o = opts()
    const res = nest(ps, o)
    validate(res, ps, o)
    const ring = res.placed.find(p => p.sourceId === 'ring')!, d = res.placed.find(p => p.sourceId === 'disc')!
    const off = Math.hypot(d.x + 100 - (ring.x + 200), d.y + 100 - (ring.y + 200))
    expect(off).toBeLessThanOrEqual(150 - 100 - 3 + 0.05)
    expect(lastUsed(res).w).toBeLessThan(410)
  })

  it('puts small pieces into a frame’s window and into the bays of a U', () => {
    const frame = poly('frame', [[0, 0], [500, 0], [500, 400], [0, 400]], 1, { holes: [polyLoop([{ x: 60, y: 60 }, { x: 440, y: 60 }, { x: 440, y: 340 }, { x: 60, y: 340 }], 'hole')] })
    const U = poly('U', [[0, 0], [400, 0], [400, 300], [300, 300], [300, 80], [100, 80], [100, 300], [0, 300]], 1)
    const ps = [frame, U, rectP('small', 150, 100, 4)], o = opts()
    const res = nest(ps, o)
    validate(res, ps, o)
    const fr = res.placed.find(p => p.sourceId === 'frame')!, u = res.placed.find(p => p.sourceId === 'U')!
    const inside = (p: NestResult['placed'][number], q: NestResult['placed'][number]) => p.x >= q.x && p.y >= q.y && p.x + p.panel.w <= q.x + q.panel.w && p.y + p.panel.h <= q.y + q.panel.h
    const smalls = res.placed.filter(p => p.sourceId === 'small')
    expect(smalls.filter(p => inside(p, fr) || inside(p, u)).length).toBeGreaterThanOrEqual(3)
  })

  it('turns a strip longer than the sheet is wide along the sheet', () => {
    const ps = [rectP('long', 2000, 60, 3), rectP('sq', 300, 300, 4)], o = opts()
    const res = nest(ps, o)
    validate(res, ps, o)
    expect(res.tooBig).toEqual([])
    for (const p of res.placed.filter(p => p.sourceId === 'long')) expect(p.rot % 180).toBe(90)
    expect(res.sheets.length).toBe(1)
  })

  it('moves the guide lines (engraving) with their piece', () => {
    const ps = [poly('e', [[0, 0], [200, 0], [200, 50], [0, 50]], 3, { engrave: [{ closed: false, pts: [{ x: 10, y: 10 }, { x: 60, y: 10 }] }] }), rectP('tall', 80, 900, 2)]
    const o = opts()
    const res = nest(ps, o)
    validate(res, ps, o) // the guide line goes through the same quarter turn as the outline
    for (const p of res.placed.filter(p => p.sourceId === 'e')) {
      const l = p.panel.loops.find(l => l.layer === 'engrave')!, b = bbox(p.panel.loops.filter(l => l.layer !== 'engrave'))
      for (const v of l.pts) { expect(v.x).toBeGreaterThanOrEqual(b.minX); expect(v.x).toBeLessThanOrEqual(b.maxX); expect(v.y).toBeGreaterThanOrEqual(b.minY); expect(v.y).toBeLessThanOrEqual(b.maxY) }
    }
  })

  it('rotatePanel keeps arcs bowing the same way (a turn, not a mirror)', () => {
    const p = discP('d', 30, 1, 10)
    for (const k of [1, 2, 3]) {
      const q = rotatePanel(p, k)
      q.loops.forEach((l, i) => expect(signedArea(l)).toBeCloseTo(signedArea(p.loops[i]), 6))
      expect(q.w).toBeCloseTo(60, 6); expect(q.h).toBeCloseTo(60, 6)
    }
  })
})

describe('nest: search', () => {
  it('gives the same layout every time', () => {
    const ps = randomPanels(7, 6, 3), o = opts({ budgetMs: 4000 })
    const a = nest(ps, o), b = nest(ps, o)
    const key = (r: NestResult) => JSON.stringify(r.placed.map(p => [p.sourceId, p.copy, p.sheet, p.rot, +p.x.toFixed(6), +p.y.toFixed(6)]))
    expect(key(a)).toBe(key(b))
    validate(a, ps, o)
  })

  for (const [seed, spacing, margin] of [[1, 3, 5], [2, 2, 0], [3, 5, 10], [4, 0, 5], [5, 3, 5]] as const) {
    it(`random shapes (seed ${seed}, spacing ${spacing}, margin ${margin}): exact outlines never too close`, () => {
      const ps = randomPanels(seed, 14), o = opts({ spacing, margin })
      validate(nest(ps, o), ps, o)
    })
  }

  it('random small pieces with large holes: some go inside, all valid', () => {
    const ps = [...randomPanels(11, 6, 3, 120), discP('ring', 180, 2, 150), poly('frame', [[0, 0], [400, 0], [400, 300], [0, 300]], 1, { holes: [polyLoop([{ x: 40, y: 40 }, { x: 360, y: 40 }, { x: 360, y: 260 }, { x: 40, y: 260 }], 'hole')] })]
    const o = opts()
    const res = nest(ps, o)
    validate(res, ps, o)
  })

  it('keeps to its time budget, and with no time left still returns a valid (box-packed) layout', () => {
    const ps = randomPanels(21, 30, 5), o = opts({ budgetMs: 60 })
    const t0 = performance.now()
    const res = nest(ps, o)
    const dt = performance.now() - t0
    validate(res, ps, o)
    expect(dt).toBeLessThan(600)
    const quick = nest(ps, opts({ budgetMs: 1 }))
    validate(quick, ps, opts())
  })

  it('is never worse than the old shelf layout on the same width, and much better on a box set', () => {
    for (const id of ['lantern', 'teabox', 'jewelry', 'moneybox', 'coasterset']) {
      const d = generate(TEMPLATES.find(t => t.id === id)!, {}, { ...DEFAULT_SETTINGS })
      const o = opts({ margin: 0 })
      const res = nest(d.panels, o)
      validate(res, d.panels, o)
      const old = layout(d.panels, 3, 1220)
      const area = (pl: { x: number; y: number; panel: Panel }[]) => {
        const x0 = Math.min(...pl.map(p => p.x)), y0 = Math.min(...pl.map(p => p.y))
        return (Math.max(...pl.map(p => p.x + p.panel.w)) - x0) * (Math.max(...pl.map(p => p.y + p.panel.h)) - y0)
      }
      const mine = res.sheets.reduce((a, sh) => a + area(res.placed.filter(p => p.sheet === sh.index)), 0)
      expect(mine).toBeLessThanOrEqual(area(old.placed) * 1.0001)
      if (id === 'lantern' || id === 'teabox') expect(mine).toBeLessThan(area(old.placed) * 0.8)
    }
  })
})

describe('checkSheet', () => {
  const sq = rectP('sq', 100, 100)
  it('finds pieces too close, in another’s material, or over the margin', () => {
    expect(checkSheet([{ panel: sq, x: 10, y: 10 }, { panel: sq, x: 113, y: 10 }], 500, 500, 3, 5)).toEqual([])
    expect(checkSheet([{ panel: sq, x: 10, y: 10 }, { panel: sq, x: 112, y: 10 }], 500, 500, 3, 5)).toEqual([1])
    expect(checkSheet([{ panel: sq, x: 10, y: 10 }, { panel: sq, x: 50, y: 50 }], 500, 500, 3, 5)).toEqual([1])
    expect(checkSheet([{ panel: sq, x: 2, y: 10 }], 500, 500, 3, 5)).toEqual([0])
    expect(checkSheet([{ panel: sq, x: 10, y: 398 }], 500, 500, 3, 5)).toEqual([0])
  })
  it('allows a piece inside another’s hole with clearance, not without', () => {
    const ring = discP('ring', 100, 1, 80), small = rectP('s', 50, 50)
    expect(checkSheet([{ panel: ring, x: 10, y: 10 }, { panel: small, x: 85, y: 85 }], 500, 500, 3, 5)).toEqual([])
    // 158 × 20 centred in a 160 mm hole: its corners come within 0.4 mm of the hole's edge
    const big = rectP('b', 158, 20)
    expect(checkSheet([{ panel: ring, x: 10, y: 10 }, { panel: big, x: 31, y: 100 }], 500, 500, 3, 5)).toEqual([1])
    const fits = rectP('f', 150, 20) // 4.3 mm clear
    expect(checkSheet([{ panel: ring, x: 10, y: 10 }, { panel: fits, x: 35, y: 100 }], 500, 500, 3, 5)).toEqual([])
    // inside the material between hole and rim: no edge near it, still wrong
    const thick = discP('t', 150, 1, 20), tiny = rectP('tiny', 10, 10)
    expect(checkSheet([{ panel: thick, x: 10, y: 10 }, { panel: tiny, x: 30, y: 155 }], 500, 500, 3, 5)).toEqual([1])
  })
  it('measures arcs exactly: two discs 3 mm apart pass, 2.9 mm apart fail', () => {
    const d = discP('d', 40)
    expect(checkSheet([{ panel: d, x: 10, y: 10 }, { panel: d, x: 93, y: 10 }], 500, 500, 3, 5)).toEqual([])
    expect(checkSheet([{ panel: d, x: 10, y: 10 }, { panel: d, x: 92.9, y: 10 }], 500, 500, 3, 5)).toEqual([1])
    const c = 3 + 80, dd = c / Math.SQRT2
    expect(checkSheet([{ panel: d, x: 10, y: 10 }, { panel: d, x: 10 + dd, y: 10 + dd }], 500, 500, 3, 5)).toEqual([])
    const e = (2.9 + 80) / Math.SQRT2
    expect(checkSheet([{ panel: d, x: 10, y: 10 }, { panel: d, x: 10 + e, y: 10 + e }], 500, 500, 3, 5)).toEqual([1])
  })
})

describe('nestLayout', () => {
  it('draws the sheets side by side 100 mm apart from (0, 0), every piece on its sheet, and one sheet makes a file of its own', () => {
    const ps = [rectP('r', 400, 600, 14)]
    const lay = nestLayout(ps, opts())
    expect(lay.sheets!.map(s => [s.x, s.y, s.w, s.h])).toEqual([[0, 0, 1220, 2440], [1320, 0, 1220, 2440]])
    expect([lay.w, lay.h]).toEqual([2540, 2440])
    expect(offSheet(lay)).toEqual([])
    expect(lay.placed.filter(p => p.sheet === 1).every(p => p.x >= 1320 + 5 - 1e-6)).toBe(true)
    const one = sheetLayout(lay, 1)
    expect(one.placed.length).toBe(2)
    expect([one.w, one.h]).toEqual([1220, 2440])
    expect(Math.min(...one.placed.map(p => p.x))).toBeGreaterThanOrEqual(5 - 1e-6)
    expect(toSVG(one)).toContain('width="1220mm" height="2440mm"')
    expect(toDXF(lay)).not.toMatch(/NaN|undefined/)
    // twelve of the fourteen fill the first sheet nearly whole
    expect(usedShare(lay)).toBeGreaterThan(0.4)
  })
})

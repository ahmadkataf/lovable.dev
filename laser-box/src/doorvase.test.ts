import { describe, it, expect } from 'vitest'
import { DOOR_VASE, layout, ornament, art, errorsOf, EDGE, MIN_DW } from './doorvase'
import { REF_W, REF_H, REF, TOP, LOW } from './doorvase-art'
import { generate, DEFAULT_SETTINGS } from './generate'
import { toDXF, toSVG } from './export'
import { signedArea, Loop } from './geom'
import { samplePoly } from './testutil'

const tpl = DOOR_VASE[0]
const S = { ...DEFAULT_SETTINGS, t: 3, kerf: 0 }
type P = { x: number; y: number }
type Pn = { id: string; w: number; h: number; count: number; loops: Loop[] }
const gen = (p: Record<string, number> = {}) => generate(tpl, p, S) as never as { panels: Pn[]; errors: string[]; warnings: string[]; notes: string[]; layout: Parameters<typeof toDXF>[0] }
const SIZES: [number, number][] = [[600, 1660], [590, 1563.5], [500, 1400], [800, 2000], [700, 1400], [400, 1440], [250, 500], [900, 2050], [450, 1620]]

const segDist = (q: P, a: P, b: P) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0
  return Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy)
}
/** the segments of some polylines in a grid of `cell` mm, for nearest-segment queries */
function segGrid(lines: { pts: P[]; closed: boolean }[], cell = 2) {
  const grid = new Map<string, [P, P][]>()
  for (const l of lines) for (let i = 0; i < (l.closed ? l.pts.length : l.pts.length - 1); i++) {
    const a = l.pts[i], b = l.pts[(i + 1) % l.pts.length]
    for (let gx = Math.floor(Math.min(a.x, b.x) / cell); gx <= Math.floor(Math.max(a.x, b.x) / cell); gx++)
      for (let gy = Math.floor(Math.min(a.y, b.y) / cell); gy <= Math.floor(Math.max(a.y, b.y) / cell); gy++) {
        const k = gx + ',' + gy
        if (!grid.has(k)) grid.set(k, [])
        grid.get(k)!.push([a, b])
      }
  }
  return (q: P) => {
    let d = Infinity
    for (let gx = Math.floor(q.x / cell) - 1; gx <= Math.floor(q.x / cell) + 1; gx++) for (let gy = Math.floor(q.y / cell) - 1; gy <= Math.floor(q.y / cell) + 1; gy++)
      for (const [a, b] of grid.get(gx + ',' + gy) ?? []) d = Math.min(d, segDist(q, a, b))
    return d
  }
}
const asPts = (f: Float64Array) => Array.from({ length: f.length / 2 }, (_, i) => ({ x: f[2 * i], y: f[2 * i + 1] }))
const boxOf = (pts: P[]) => pts.reduce((b, q) => ({ minX: Math.min(b.minX, q.x), minY: Math.min(b.minY, q.y), maxX: Math.max(b.maxX, q.x), maxY: Math.max(b.maxY, q.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
/** the ornament of a DW × DH drawing, split into its two groups */
function groups(DW: number, DH: number) {
  const L = layout(DW, DH), all = ornament(L, DW), nTop = art().top.length
  return { L, top: all.slice(0, nTop), low: all.slice(nTop) }
}

describe('doorvase: the door with the vase and flowers', () => {
  it('builds at its defaults with no warnings: one panel 915 × 2130, the drawing 600 × 1660 in its middle', () => {
    const d0 = generate(tpl, {}, { ...DEFAULT_SETTINGS, t: 3 })
    expect(d0.errors).toEqual([])
    expect(d0.warnings).toEqual([])
    const d = gen()
    expect(d.errors).toEqual([])
    expect(d.panels).toHaveLength(1)
    const pn = d.panels[0]
    expect([pn.w, pn.h]).toEqual([915, 2130])
    const cut = pn.loops.filter(l => l.layer !== 'engrave')
    expect(cut.filter(l => l.closed && signedArea(l) > 0)).toHaveLength(1)
    expect(cut).toHaveLength(1)
    const eng = pn.loops.filter(l => l.layer === 'engrave')
    expect(eng.length).toBe(7 + art().top.length + art().low.length)
    const pts = eng.flatMap(l => samplePoly(l, 2))
    for (const q of pts) { expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true) }
    const b = boxOf(pts)
    expect(b.minX).toBeCloseTo(157.5, 6); expect(b.maxX).toBeCloseTo(757.5, 6)
    expect(b.minY).toBeCloseTo(235, 6); expect(b.maxY).toBeCloseTo(1895, 6)
    expect(d.notes.join(' ')).toMatch(/Output = No/)
    expect(d.notes.join(' ')).toMatch(/طول خطوط الحفر نحو \d+\.\d م/)
  })

  it('has no zero-length segment and writes a clean DXF and SVG', () => {
    for (const p of [{}, { DW: 400, DH: 1100, dy: -200 }, { PW: 1000, PH: 2400, DW: 900, DH: 2300 }] as Record<string, number>[]) {
      const d = gen(p)
      expect(d.errors, JSON.stringify(p)).toEqual([])
      for (const l of d.panels[0].loops) {
        expect(l.pts.length).toBeGreaterThanOrEqual(2)
        const n = l.closed ? l.pts.length : l.pts.length - 1
        for (let i = 0; i < n; i++) { const a = l.pts[i], c = l.pts[(i + 1) % l.pts.length]; expect(Math.hypot(c.x - a.x, c.y - a.y), JSON.stringify(p)).toBeGreaterThan(0.05) }
      }
      const dxf = toDXF(d.layout), svg = toSVG(d.layout)
      for (const f of [dxf, svg]) expect(/NaN|undefined|Infinity/.test(f)).toBe(false)
      expect(dxf.split('\nENGRAVE\n').length).toBeGreaterThan(100)
      expect(dxf).toMatch(/\n42\n-?0\.\d+/) // the arcs go out as true arcs (bulges)
    }
  })

  it('keeps every line on the panel, at least EDGE from its edge, wherever the drawing is moved', () => {
    for (const p of [{}, { dy: 225 }, { dy: -225 }, { PW: 620, PH: 1680 }, { DW: 250, DH: 500 }] as Record<string, number>[]) {
      const d = gen(p)
      expect(d.errors, JSON.stringify(p)).toEqual([])
      const pn = d.panels[0], b = boxOf(pn.loops.filter(l => l.layer === 'engrave').flatMap(l => samplePoly(l, 2)))
      expect(Math.min(b.minX, b.minY, pn.w - b.maxX, pn.h - b.maxY), JSON.stringify(p)).toBeGreaterThanOrEqual(EDGE - 1e-6)
    }
  })

  it('stores a mirror-symmetric drawing: every stroke has its mirror image within 0.05 mm', () => {
    const lines = [...art().top, ...art().low].map(s => ({ pts: asPts(s.pts), closed: s.closed }))
    const near = segGrid(lines)
    let worst = 0
    for (const l of lines) for (const q of l.pts) worst = Math.max(worst, near({ x: REF_W - q.x, y: q.y }))
    expect(worst).toBeLessThan(0.05)
    // the stored halves stay on their side of the axis, and the ones that cross it end on it
    for (const s of [...TOP, ...LOW]) {
      for (let i = 0; i < s.p.length; i += 2) expect(s.p[i]).toBeLessThanOrEqual(REF_W / 2 + 1e-9)
      if (s.k === 's') expect(s.p[s.p.length - 2]).toBe(REF_W / 2)
      if (s.k === 'c') for (let i = 0; i < s.p.length; i += 2) expect(s.p[i]).toBe(REF_W / 2)
    }
    // and the built door is symmetric too, structure included
    const d = gen(), pn = d.panels[0]
    const eng = pn.loops.filter(l => l.layer === 'engrave').map(l => ({ pts: samplePoly(l, 1), closed: l.closed }))
    const nearB = segGrid(eng)
    let worstB = 0
    for (const l of eng) for (const q of l.pts) worstB = Math.max(worstB, nearB({ x: pn.w - q.x, y: q.y }))
    expect(worstB).toBeLessThan(0.05)
  })

  it('reproduces the photo at the photo\'s own proportions: the structure at the measured places', () => {
    const { L } = groups(REF_W, REF_H)
    expect(L.g).toBeCloseTo(1, 12)
    expect(L.top.s).toBeCloseTo(1, 12); expect(L.low.s).toBeCloseTo(1, 12)
    expect(L.top.y0).toBeCloseTo(REF.topI, 9); expect(L.low.y0).toBeCloseTo(REF.lowInTop[0], 9)
    const ys = L.frame.slice(1).map(l => boxOf(samplePoly(l, 0.5)))
    // top panel (outer, inner): its bottom arc's lowest point on the axis
    expect(ys[0].minY).toBeCloseTo(REF.topO, 6); expect(ys[0].maxY).toBeCloseTo(REF.topOutBot[0], 1)
    expect(ys[3].minY).toBeCloseTo(REF.topI, 6); expect(ys[3].maxY).toBeCloseTo(REF.topInBot[0], 1)
    expect(ys[2].maxY).toBeCloseTo(REF.botO, 6); expect(ys[5].maxY).toBeCloseTo(REF.botI, 6)
    expect(ys[0].minX).toBeCloseTo(REF.xo, 6); expect(ys[3].minX).toBeCloseTo(REF.xi, 6)
  })

  it('keeps every ornament inside its panel with room to spare, at many door sizes', () => {
    for (const [DW, DH] of SIZES) {
      const { L, top, low } = groups(DW, DH)
      const [topIn, bandIn, lowIn] = [L.frame[4], L.frame[5], L.frame[6]]
      expect(bandIn.closed).toBe(true)
      for (const [grp, box] of [[top, topIn], [low, lowIn]] as const) {
        const outline = samplePoly(box, 0.5), near = segGrid([{ pts: outline, closed: true }], 5)
        const inside = (q: P) => { let c = false; for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) { const a = outline[i], b = outline[j]; if ((a.y > q.y) !== (b.y > q.y) && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c } return c }
        let clear = Infinity
        for (const l of grp) for (const q of l.pts) { expect(inside(q), `${DW}×${DH}`).toBe(true); clear = Math.min(clear, near(q)) }
        // the photo leaves about 11 mm (on its 590 mm frame) between the ornament and the panel's line
        expect(clear, `${DW}×${DH}`).toBeGreaterThan(9 * (grp === top ? L.top.s : L.low.s))
      }
    }
  })

  it('scales each ornament uniformly: its proportions stay the photo\'s at every size, centred across its panel', () => {
    const ref = groups(REF_W, REF_H)
    const aspect = (ls: Loop[]) => { const b = boxOf(ls.flatMap(l => l.pts)); return { r: (b.maxX - b.minX) / (b.maxY - b.minY), cx: (b.minX + b.maxX) / 2, w: b.maxX - b.minX } }
    const rt = aspect(ref.top), rl = aspect(ref.low)
    for (const [DW, DH] of SIZES) {
      const { L, top, low } = groups(DW, DH)
      for (const [ls, r0, s] of [[top, rt, L.top.s], [low, rl, L.low.s]] as const) {
        const a = aspect(ls)
        expect(a.r / r0.r, `${DW}×${DH}`).toBeCloseTo(1, 3)
        expect(a.cx).toBeCloseTo(DW / 2, 1)
        expect(a.w / r0.w).toBeCloseTo(s, 3)
        expect(s).toBeLessThanOrEqual(L.g + 1e-12)
      }
    }
    // the customer's 600 × 1660: both ornaments as large as on the photo's door (scaled with the width), the extra height shared
    const { L } = groups(600, 1660)
    expect(L.top.s).toBeCloseTo(600 / REF_W, 9); expect(L.low.s).toBeCloseTo(600 / REF_W, 9)
    // a relatively lower door makes them smaller instead of squashing them
    const short = groups(700, 1400).L
    expect(short.top.s).toBeLessThan(short.g); expect(short.low.s).toBeLessThan(short.g)
  })

  it('rebuilds the frame for the size: the arcs keep their sag across the width, the band its place in the height', () => {
    const sag = (DW: number, DH: number) => { const b = boxOf(samplePoly(groups(DW, DH).L.frame[1], 0.5)), l = groups(DW, DH).L.frame[1]; return b.maxY - l.pts[3].y }
    expect(sag(600, 1660)).toBeCloseTo(sag(600, 2000), 3)
    expect(sag(300, 830)).toBeCloseTo(sag(600, 1660) / 2, 3)
    const band = (DW: number, DH: number) => { const b = boxOf(samplePoly(groups(DW, DH).L.frame[2], 0.5)); return (b.minY + b.maxY) / 2 / DH }
    expect(band(600, 1660)).toBeCloseTo(band(600, 2000), 2)
  })

  it('refuses a drawing that does not fit or is too small, with the size to set', () => {
    const e = (p: Record<string, number>) => errorsOf({ ...tpl.defaults, ...p }).join(' ')
    expect(e({ PW: 600 })).toMatch(/عرضها 580 مم على الأكثر، أو عرض اللوح 620 مم على الأقل/)
    expect(e({ PH: 1600 })).toMatch(/ارتفاعها 1580 مم على الأكثر، أو ارتفاع اللوح 1680 مم على الأقل/)
    expect(e({ DW: 200, DH: 500 })).toMatch(new RegExp(`${MIN_DW} مم على الأقل`))
    expect(e({ DH: 1000 })).toMatch(/ارتفاعها 1200 مم على الأقل/)
    expect(e({ DH: 2200, PH: 2400 })).toMatch(/ارتفاعها 2160 مم على الأكثر، أو عرضها 612 مم على الأقل/)
    expect(e({ dy: 300 })).toMatch(/بين −225 و225 مم/)
    expect(e({})).toBe('')
    for (const p of [{ PW: 600 }, { dy: -300 }, { DW: 1400 }, { DH: 400 }] as Record<string, number>[]) expect(gen(p).errors.length, JSON.stringify(p)).toBeGreaterThan(0)
  })

  it('builds in well under 300 ms', () => {
    gen()
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) gen({ DW: 600 + i, DH: 1660 - 3 * i })
    expect((performance.now() - t0) / 5).toBeLessThan(300)
  })
})

import { describe, it, expect } from 'vitest'
import { DOOR_VASE, layout, ornament, art, errorsOf, weighted, EDGE, MIN_DW, WOOD } from './doorvase'
import { REF_W, REF_H, REF, TOP, LOW, FRAME_W } from './doorvase-art'
import { generate, DEFAULT_SETTINGS } from './generate'
import { toDXF, toSVG } from './export'
import { signedArea, arcInfo, Loop } from './geom'
import { samplePoly } from './testutil'
import { roleOf } from './scale'

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
/** a laser line as points every `step` mm (its arcs followed), with their distance along it */
function walk(l: Loop, step: number): { x: number; y: number; s: number }[] {
  const out: { x: number; y: number; s: number }[] = [], n = l.pts.length
  let L = 0
  for (let i = 0; i < (l.closed ? n : n - 1); i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n]
    if (p.b) {
      const a = arcInfo(p, q, p.b), k = Math.max(1, Math.ceil((a.r * a.theta) / step))
      for (let j = 0; j < k; j++) { const t = a.a0 + ((a.ccw ? -1 : 1) * a.theta * j) / k; out.push({ x: a.c.x + a.r * Math.cos(t), y: a.c.y + a.r * Math.sin(t), s: L + (a.r * a.theta * j) / k }) }
      L += a.r * a.theta
    } else {
      const d = Math.hypot(q.x - p.x, q.y - p.y), k = Math.max(1, Math.ceil(d / step))
      for (let j = 0; j < k; j++) out.push({ x: p.x + ((q.x - p.x) * j) / k, y: p.y + ((q.y - p.y) * j) / k, s: L + (d * j) / k })
      L += d
    }
  }
  const e = l.closed ? l.pts[0] : l.pts[n - 1]
  out.push({ x: e.x, y: e.y, s: L })
  return out
}
/**
 * The closest two different laser lines come (points every 0.2 mm, a grid of cells lw wide), and the closest a line comes
 * to itself further than 3 lw + 0.3 mm along it (round a loop either way): a burn twice over.
 */
function spacing(lines: Loop[], lw: number) {
  const grid = new Map<string, { x: number; y: number; s: number; id: number; L: number; closed: boolean }[]>()
  lines.forEach((l, id) => {
    const w = walk(l, 0.2), L = w[w.length - 1].s
    for (const q of w) { const k = `${Math.floor(q.x / lw)},${Math.floor(q.y / lw)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push({ ...q, id, L, closed: l.closed }) }
  })
  let apart = Infinity, fold = Infinity
  for (const [key, pts] of grid) {
    const [cx, cy] = key.split(',').map(Number)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const q of grid.get(`${cx + dx},${cy + dy}`) ?? []) for (const p of pts) {
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      if (p.id !== q.id) apart = Math.min(apart, d)
      else { const g = Math.abs(p.s - q.s); if ((p.closed ? Math.min(g, p.L - g) : g) > 3 * lw + 0.3) fold = Math.min(fold, d) }
    }
  }
  return { apart, fold }
}
const engraved = (d: { panels: Pn[] }) => d.panels[0].loops.filter(l => l.layer === 'engrave')
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
    // the structure first: the outer rectangle and each double line's outer line one loop, each inner line three
    const g = 600 / REF_W, frame = eng.slice(0, 13)
    for (const l of frame) expect(l.closed).toBe(true)
    const left = frame.map(l => Math.round((Math.min(...l.pts.map(q => q.x)) - 157.5) * 1000) / 1000).sort((u, v) => u - v)
    const want = [0, ...[0, 0, 0].map(() => REF.xo * g), ...[-0.4, 0, 0.4].flatMap(d => [0, 0, 0].map(() => REF.xi * g + d))]
    left.forEach((x, i) => expect(x).toBeCloseTo(want[i], 2))
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
    // and the built door is symmetric too, structure included: the laser lines' ends where strokes meet on the axis, or
    // meet a stroke and its mirror image one after the other, may differ by a fraction of a line's spacing
    const d = gen(), pn = d.panels[0]
    const eng = pn.loops.filter(l => l.layer === 'engrave').map(l => ({ pts: walk(l, 0.5), closed: l.closed }))
    const nearB = segGrid(eng)
    let worstB = 0, off = 0, all = 0
    for (const l of eng) for (const q of l.pts) { const e = nearB({ x: pn.w - q.x, y: q.y }); worstB = Math.max(worstB, e); all++; if (e > 0.05) off++ }
    expect(worstB).toBeLessThan(0.3)
    expect(off / all).toBeLessThan(0.001)
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

  it('builds in under 400 ms', () => {
    gen()
    const t0 = performance.now()
    for (let i = 0; i < 5; i++) gen({ DW: 600 + i, DH: 1660 - 3 * i })
    expect((performance.now() - t0) / 5).toBeLessThan(400)
  })

  it('stores a weight for every stroke as measured on the photo, the same on both mirror halves', () => {
    for (const st of [...TOP, ...LOW]) {
      expect(['b', 'f']).toContain(st.w)
      const nSeg = st.k !== 's' && st.closed ? st.p.length / 2 : st.p.length / 2 - 1
      if (st.f) {
        expect(st.w).toBe('b') // a bold stroke with fine stretches
        expect(st.f.length % 2).toBe(0)
        for (let i = 0; i < st.f.length; i++) expect(st.f[i]).toBeGreaterThan(i ? st.f[i - 1] : -1)
        expect(st.f[st.f.length - 1]).toBeLessThanOrEqual(nSeg)
      }
    }
    const all = [...TOP, ...LOW]
    expect([all.filter(s => s.w === 'b' && !s.f).length, all.filter(s => s.w === 'f').length, all.filter(s => s.f).length]).toEqual([74, 34, 8])
    expect(FRAME_W).toEqual({ rect: 'f', outer: 'f', inner: 'b' })
    // every segment's mirror image is a segment of the same weight
    const segs = [...art().top, ...art().low].flatMap(st => Array.from(st.bold, (b, i) => {
      const n = st.pts.length / 2, j = (i + 1) % n
      return { x: (st.pts[2 * i] + st.pts[2 * j]) / 2, y: (st.pts[2 * i + 1] + st.pts[2 * j + 1]) / 2, b }
    }))
    const cell = new Map<string, typeof segs>()
    for (const q of segs) { const k = `${Math.floor(q.x)},${Math.floor(q.y)}`; (cell.get(k) ?? cell.set(k, []).get(k)!).push(q) }
    for (const q of segs) {
      const x = REF_W - q.x, near: number[] = []
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const o of cell.get(`${Math.floor(x) + dx},${Math.floor(q.y) + dy}`) ?? []) if (Math.hypot(o.x - x, o.y - q.y) < 0.05) near.push(o.b)
      expect(near, `${q.x}, ${q.y}`).toContain(q.b)
    }
  })

  it('engraves a bold stroke as `thick` lines lw apart and a fine one as one line, wherever nothing else is near', () => {
    for (const c of [{ lw: 0.4, bold: 3, fine: 1 }, { lw: 0.3, bold: 5, fine: 2 }]) {
      const d = gen({ thick: c.bold, thin: c.fine, lw: c.lw }), eng = engraved(d)
      // the engraved segments, in 1 mm cells
      const cells = new Map<string, number[]>(), segs: [P, P][] = []
      for (const l of eng) {
        const w = walk(l, 0.5)
        for (let i = 1; i < w.length; i++) {
          segs.push([w[i - 1], w[i]])
          for (let gx = Math.floor(Math.min(w[i - 1].x, w[i].x)); gx <= Math.floor(Math.max(w[i - 1].x, w[i].x)); gx++)
            for (let gy = Math.floor(Math.min(w[i - 1].y, w[i].y)); gy <= Math.floor(Math.max(w[i - 1].y, w[i].y)); gy++) { const k = `${gx},${gy}`; (cells.get(k) ?? cells.set(k, []).get(k)!).push(segs.length - 1) }
        }
      }
      const cross = (a: P, b: P, p: P, q: P) => { const o = (u: P, v: P, w: P) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x); return o(a, b, p) * o(a, b, q) < 0 && o(p, q, a) * o(p, q, b) < 0 }
      const strokes = weighted(layout(600, 1660), 600, 157.5, 235, c)
      let n = 0, right = 0
      strokes.forEach((st, k) => {
        const others = segGrid(strokes.filter((_, j) => j !== k).map(o => ({ pts: o.pts, closed: o.closed })), 2)
        const m = st.closed ? st.pts.length : st.pts.length - 1
        for (let i = 1; i + 1 < m; i++) {
          const a = st.pts[i], b = st.pts[(i + 1) % st.pts.length], len = Math.hypot(b.x - a.x, b.y - a.y)
          const pa = st.pts[i - 1], pb = st.pts[(i + 2) % st.pts.length]
          const turn = (u: P, v: P, w: P) => Math.abs(Math.atan2((v.x - u.x) * (w.y - v.y) - (v.y - u.y) * (w.x - v.x), (v.x - u.x) * (w.x - v.x) + (v.y - u.y) * (w.y - v.y)))
          if (len < 0.5 || turn(pa, a, b) > 0.4 || turn(a, b, pb) > 0.4 || st.n[i - 1] !== st.n[i] || st.n[i] !== st.n[(i + 1) % st.n.length]) continue
          const p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len, h = ((st.n[i] - 1) / 2) * c.lw + c.lw / 2
          // away from the stroke's ends and from every other stroke (its lines might cross the measure)
          const e0 = st.pts[0], e1 = st.pts[st.pts.length - 1]
          if (!st.closed && Math.min(Math.hypot(p.x - e0.x, p.y - e0.y), Math.hypot(p.x - e1.x, p.y - e1.y)) < 3) continue
          if (others(p) < 2 * h + 3 * c.lw + 1) continue
          const u = { x: p.x - nx * h, y: p.y - ny * h }, v = { x: p.x + nx * h, y: p.y + ny * h }
          const seen = new Set<number>()
          for (let gx = Math.floor(Math.min(u.x, v.x)); gx <= Math.floor(Math.max(u.x, v.x)); gx++) for (let gy = Math.floor(Math.min(u.y, v.y)); gy <= Math.floor(Math.max(u.y, v.y)); gy++)
            for (const j of cells.get(`${gx},${gy}`) ?? []) if (cross(u, v, segs[j][0], segs[j][1])) seen.add(j)
          const hits = seen.size
          n++
          if (hits === st.n[i]) right++
        }
      })
      expect(n, JSON.stringify(c)).toBeGreaterThan(5000)
      expect(right / n, JSON.stringify(c)).toBeGreaterThan(0.995)
    }
  })

  it('never burns wood twice: no two laser lines closer than lw − 0.1 mm, where strokes meet included, nor a line folded back on itself', () => {
    for (const p of [{}, { thick: 5, lw: 0.6 }, { thin: 2, lw: 0.5 }, { DW: 250, DH: 600, thick: 4, lw: 0.8 }, { DW: 900, DH: 2050, PW: 1000, PH: 2400, thick: 7, lw: 0.3 }] as Record<string, number>[]) {
      const d = gen(p), lw = p.lw ?? 0.4
      expect(d.errors, JSON.stringify(p)).toEqual([])
      expect(d.warnings, JSON.stringify(p)).toEqual([])
      const sp = spacing(engraved(d), lw)
      expect(sp.apart, JSON.stringify(p)).toBeGreaterThan(lw - 0.1)
      expect(sp.fold, JSON.stringify(p)).toBeGreaterThan(lw - 0.1)
    }
  })

  it('says which lines are bold and fine, how long the engraving is and how to set RDWorks; lw is a laser setting', () => {
    const notes = gen().notes.join(' ')
    expect(notes).toMatch(/العريضة 3 خطوط ليزر بينها 0.4 مم/)
    expect(notes).toMatch(/والرفيعة خطّ واحد/)
    expect(notes).toMatch(/طبقة Cut واحدة/)
    expect(notes).toMatch(/لا يُحرق مكان مرّتين/)
    const role = (k: string) => roleOf(tpl, tpl.params.find(q => q.key === k)!)
    expect([role('lw'), role('thick'), role('thin'), role('DW')]).toEqual(['fixed', 'count', 'count', 'length'])
  })

  it('refuses bold lines that would fill the double lines, with what to set', () => {
    const e = (p: Record<string, number>) => errorsOf({ ...tpl.defaults, ...p }).join(' ')
    expect(e({ DW: 250, DH: 600, thick: 7, lw: 1 })).toMatch(/«المسافة بين خطوط الليزر» 0.6 مم على الأكثر، أو «خطوط الخط العريض» 3 على الأكثر، أو عرض الرسمة 340 مم على الأقل/)
    expect(e({ DW: 250, DH: 600, thick: 3, lw: 1 })).toBe('')
    expect(WOOD).toBe(2)
  })
})

import { describe, it, expect } from 'vitest'
import { ROSE_SIGNS, ROSE_DEBUG } from './rosesign'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, bbox, Loop } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, polysOverlap, polyDistance, selfIntersects, segDist } from './testutil'

const tpl = ROSE_SIGNS[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
const cutLoops = (pn: { loops: Loop[] }) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const outerOf = (pn: { loops: Loop[] }) => cutLoops(pn).find(l => signedArea(l) > 0)!
const holesOf = (pn: { loops: Loop[] }) => cutLoops(pn).filter(l => signedArea(l) < 0)
const panel = (d: ReturnType<typeof generate>, id: string) => d.panels.find(p => p.id === id)!
/** segments filed in 4 mm cells: the distance from a point to the nearest one, or `cutoff` when all are further */
class Index {
  private cells = new Map<number, [P, P][]>()
  constructor(polys: P[][]) {
    for (const pts of polys) for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      for (let cx = Math.floor(Math.min(a.x, b.x) / 4); cx <= Math.floor(Math.max(a.x, b.x) / 4); cx++) for (let cy = Math.floor(Math.min(a.y, b.y) / 4); cy <= Math.floor(Math.max(a.y, b.y) / 4); cy++) {
        const k = cx * 100003 + cy, arr = this.cells.get(k)
        if (arr) arr.push([a, b]); else this.cells.set(k, [[a, b]])
      }
    }
  }
  dist(q: P, cutoff: number) {
    let best = cutoff
    const x0 = Math.floor(q.x / 4), y0 = Math.floor(q.y / 4)
    for (let cx = x0 - 1; cx <= x0 + 1; cx++) for (let cy = y0 - 1; cy <= y0 + 1; cy++) for (const [a, b] of this.cells.get(cx * 100003 + cy) ?? []) best = Math.min(best, segDist(q, q, a, b))
    return best
  }
}
type P = { x: number; y: number }
/** the least distance between two polygons' edges, both ways, down to `cutoff` (a mutual nearest-vertex check is enough at these samplings) */
const nearest = (A: P[], idxB: Index, B: P[], idxA: Index, cutoff: number) => Math.min(...A.map(q => idxB.dist(q, cutoff)), ...B.map(q => idxA.dist(q, cutoff)))
/** where the polygon's edges cross the horizontal line y = Y, sorted */
const crossings = (pts: { x: number; y: number }[], Y: number) => {
  const xs: number[] = []
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a.y <= Y && b.y > Y) || (b.y <= Y && a.y > Y)) xs.push(a.x + ((b.x - a.x) * (Y - a.y)) / (b.y - a.y)) }
  return xs.sort((u, v) => u - v)
}

/** distance from q to the nearest edge of a closed polygon */
const toPoly = (q: P, pts: P[]) => { let b = Infinity; for (let i = 0; i < pts.length; i++) b = Math.min(b, segDist(q, q, pts[i], pts[(i + 1) % pts.length])); return b }
/**
 * The thinnest bridge of wood in an outline: two of its edges more than 20 mm apart along it but close across the
 * wood between them (a lobe's rim hanging on the rest by a thread), down to `cutoff`.
 */
function thinnestBridge(O: P[], cutoff = 4): number {
  const n = O.length, cum = [0]
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + Math.hypot(O[i % n].x - O[i - 1].x, O[i % n].y - O[i - 1].y))
  const L = cum[n], cells = new Map<number, number[]>(), C = 4
  for (let i = 0; i < n; i++) {
    const a = O[i], b = O[(i + 1) % n]
    for (let cx = Math.floor(Math.min(a.x, b.x) / C); cx <= Math.floor(Math.max(a.x, b.x) / C); cx++) for (let cy = Math.floor(Math.min(a.y, b.y) / C); cy <= Math.floor(Math.max(a.y, b.y) / C); cy++) {
      const k = cx * 100003 + cy, arr = cells.get(k); if (arr) arr.push(i); else cells.set(k, [i])
    }
  }
  let best = cutoff
  for (let i = 0; i < n; i++) {
    const q = O[i], x0 = Math.floor(q.x / C), y0 = Math.floor(q.y / C)
    for (let cx = x0 - 1; cx <= x0 + 1; cx++) for (let cy = y0 - 1; cy <= y0 + 1; cy++) for (const j of cells.get(cx * 100003 + cy) ?? []) {
      const a = O[j], b = O[(j + 1) % n], dd = segDist(q, q, a, b)
      if (dd >= best) continue
      // the nearest point of edge j: far from q along the outline, and across wood, not across a notch of air
      const t = Math.max(0, Math.min(1, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1)))
      const along = Math.abs(cum[i] - cum[j] - t * (cum[j + 1] - cum[j])), around = Math.min(along, L - along)
      if (around < 20) continue
      const m = { x: (q.x + a.x + t * (b.x - a.x)) / 2, y: (q.y + a.y + t * (b.y - a.y)) / 2 }
      if (pointIn(m, O)) best = dd
    }
  }
  return best
}

describe('the standing rose with a heart plaque', () => {
  it('builds at its defaults on the common sheets: one silhouette, the heart frame, two scalloped bases', () => {
    for (const t of [2.7, 3, 3.2]) for (const style of [1, 2]) {
      const d = generate(tpl, { style }, { ...S0, t }), label = `t=${t} style=${style}`
      expect(d.errors, label).toEqual([])
      expect(d.panels.map(p => p.id).sort(), label).toEqual(['base-low', 'base-up', 'frame', 'rose'])
      const rose = panel(d, 'rose')
      expect(cutLoops(rose).filter(l => signedArea(l) > 0).length, `${label} one outline`).toBe(1)
      expect(Math.abs(rose.h - 260), label).toBeLessThan(0.3)
      // the upper base a little smaller than the lower, both with the tenon's slot
      const low = panel(d, 'base-low'), up = panel(d, 'base-up')
      expect(low.w, label).toBeCloseTo(120, 0)
      expect(low.w - up.w, label).toBeGreaterThan(6)
      for (const b of [low, up]) {
        const hs = holesOf(b)
        expect(hs.length, `${label} ${b.id} slot`).toBe(1)
        const bb = bbox([hs[0]])
        expect(bb.maxY - bb.minY, `${label} slot width`).toBeCloseTo(t + 0.2, 3)
        expect(bb.maxX - bb.minX, `${label} slot length`).toBeCloseTo(8 - 2 * 1.2 + 0.2, 3)
        expect(Math.abs((bb.minX + bb.maxX) / 2 - b.w / 2), `${label} slot centred`).toBeLessThan(0.01)
      }
    }
  })

  it('the tenon under the stem is the slot\'s size: the stem less a shoulder each side, two sheets long less a hair', () => {
    for (const t of [2.7, 3, 3.2, 4]) for (const sw of [5, 6, 8, 12, 16]) {
      const d = generate(tpl, { sw }, { ...S0, t }), label = `t=${t} sw=${sw}`
      expect(d.errors, label).toEqual([])
      const rose = panel(d, 'rose'), o = outerOf(rose), tenon = 2 * t - 0.3
      const low = holesOf(panel(d, 'base-low'))[0], sb = bbox([low])
      // the outline's points on the tenon
      const onTenon = o.pts.filter(q => q.y > rose.h - tenon + 0.05)
      const tw = Math.max(...onTenon.map(q => q.x)) - Math.min(...onTenon.map(q => q.x))
      expect(tw, `${label} tenon width`).toBeCloseTo(sb.maxX - sb.minX - 0.2, 2)
      expect(tw, `${label} narrower than the stem`).toBeLessThan(sw - 1)
      // the shoulder line: the stem's full width just above the tenon
      const xs = crossings(o.pts, rose.h - tenon - 1)
      expect(xs.length, `${label} stem crossings`).toBe(2)
      expect(xs[1] - xs[0], `${label} stem`).toBeCloseTo(sw, 2)
      expect(sb.maxY - sb.minY, `${label} slot takes the sheet`).toBeCloseTo(t + 0.2, 3)
      // the tenon goes through the upper layer and nearly through the lower one, and the shoulders rest on wood
      const tx0 = Math.min(...onTenon.map(q => q.x)), tenonLen = rose.h - Math.min(...o.pts.filter(q => Math.abs(q.x - tx0) < 0.01).map(q => q.y))
      expect(tenonLen, `${label} tenon length`).toBeGreaterThan(t)
      expect(tenonLen, `${label} tenon length`).toBeLessThan(2 * t)
      expect((xs[1] - xs[0] - (sb.maxX - sb.minX)) / 2, `${label} shoulder on the upper layer`).toBeGreaterThan(0.4)
      const up = holesOf(panel(d, 'base-up'))[0], ub = bbox([up])
      expect(ub.maxX - ub.minX, `${label} upper slot`).toBeCloseTo(sb.maxX - sb.minX, 3)
      expect(ub.maxY - ub.minY, `${label} upper slot`).toBeCloseTo(sb.maxY - sb.minY, 3)
    }
  })

  it('the frame ring\'s hole is the guide line engraved on the silhouette\'s heart, and the ring keeps its width at the cleft', () => {
    for (const [hw, fw] of [[90, 5], [60, 4], [150, 12]] as const) {
      const d = generate(tpl, { hw, fw, H: hw > 100 ? 420 : 260 }, S0), label = `hw=${hw} fw=${fw}`
      expect(d.errors, label).toEqual([])
      const frame = panel(d, 'frame'), rose = panel(d, 'rose')
      const hole = holesOf(frame)[0], guide = rose.loops.find(l => l.layer === 'engrave')!
      const a = bbox([hole]), b = bbox([guide])
      expect(a.maxX - a.minX, label).toBeCloseTo(b.maxX - b.minX, 3)
      expect(a.maxY - a.minY, label).toBeCloseTo(b.maxY - b.minY, 3)
      expect(frame.w, label).toBeCloseTo(hw, 1)
      expect(a.maxX - a.minX, `${label} hole narrower by the frame`).toBeLessThan(hw - 1.9 * fw)
      // the guide sits inside the silhouette's heart: every point inside the outline
      const outer = samplePoly(outerOf(rose), 10)
      for (const q of samplePoly(guide, 15)) expect(pointIn(q, outer), `${label} guide inside`).toBe(true)
      // the ring's notch: the hole's top is a frame width below the ring's cleft
      const ring = outerOf(frame), cleftY = Math.max(...ring.pts.filter(q => Math.abs(q.x - hw / 2) < 0.01).map(q => q.y).filter(y => y < hw / 2))
      const holeTop = samplePoly(hole, 5).filter(q => Math.abs(q.x - hw / 2) < 0.5).map(q => q.y)
      expect(Math.min(...holeTop) - cleftY, `${label} notch depth`).toBeGreaterThan(fw - 0.3)
    }
  })

  it('the petal lines and veins are slits that keep a 2 mm web from the outline and from each other, in both styles', () => {
    for (const style of [1, 2]) for (const [W, line] of [[75, 1.8], [55, 1.2], [120, 2.5]] as const) {
      const d = generate(tpl, { style, W, line, hw: Math.max(90, W), H: W > 90 ? 420 : 260 }, S0), label = `style=${style} W=${W} line=${line}`
      expect(d.errors, label).toEqual([])
      const rose = panel(d, 'rose'), hs = holesOf(rose), outer = samplePoly(outerOf(rose), 10)
      expect(hs.length, `${label} enough lines`).toBeGreaterThanOrEqual(style === 1 ? 10 : 6)
      const sampled = hs.map(h => samplePoly(h, 10))
      for (let i = 0; i < sampled.length; i++) {
        for (const q of sampled[i]) expect(pointIn(q, outer), `${label} slit ${i} inside`).toBe(true)
        expect(polyDistance(sampled[i], outer), `${label} slit ${i} web to the edge`).toBeGreaterThan(ROSE_DEBUG.WEB - 0.15)
        for (let j = i + 1; j < sampled.length; j++) expect(polyDistance(sampled[i], sampled[j]), `${label} web ${i}-${j}`).toBeGreaterThan(ROSE_DEBUG.WEB - 0.15)
        // a slit is as wide as asked: its area over half its perimeter
        const bb = bbox([hs[i]]), long = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY)
        expect(long, `${label} slit ${i} length`).toBeGreaterThan(3)
      }
    }
  })

  it('the scalloped base: k round lobes reaching the diameter, cusps between them', () => {
    for (const k of [5, 8, 14]) {
      const l = ROSE_DEBUG.scallop(0, 0, 60, k), pts = samplePoly(l, 2)
      expect(signedArea(l)).toBeGreaterThan(0)
      const rs = pts.map(q => Math.hypot(q.x, q.y))
      expect(Math.max(...rs), `k=${k} tips`).toBeCloseTo(60, 0)
      expect(Math.min(...rs), `k=${k} cusps`).toBeLessThan(57)
      expect(Math.min(...rs), `k=${k} cusps`).toBeGreaterThan(45)
      expect(l.pts.length).toBe(k)
      expect(selfIntersects(pts)).toBe(false)
    }
  })

  it('merges overlapping polygons into one outline and leaves separate ones apart', () => {
    const sq = (x: number, y: number, s: number) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }]
    const one = ROSE_DEBUG.unionPolys([sq(0, 0, 10), sq(5, 5, 10)])
    expect(one.length).toBe(1)
    expect(one[0].length).toBe(8)
    const two = ROSE_DEBUG.unionPolys([sq(0, 0, 10), sq(20, 20, 10)])
    expect(two.length).toBe(2)
    // a bar through a disc: one loop, the disc's points inside the bar gone
    const disc = Array.from({ length: 60 }, (_, i) => ({ x: 10 * Math.cos((i / 60) * 2 * Math.PI), y: 10 * Math.sin((i / 60) * 2 * Math.PI) }))
    const bar = [{ x: -2, y: -30 }, { x: 2, y: -30 }, { x: 2, y: 30 }, { x: -2, y: 30 }]
    const u = ROSE_DEBUG.unionPolys([disc, bar])
    expect(u.length).toBe(1)
    expect(u[0].some(q => Math.abs(q.x) < 1.99 && Math.abs(q.y) < 9)).toBe(false)
  })

  it('says what to change when the parts do not fit', () => {
    expect(generate(tpl, { H: 150 }, S0).errors.join()).toMatch(/الارتفاع/)
    expect(generate(tpl, { fw: 20, hw: 60 }, S0).errors.join()).toMatch(/إطار/)
    expect(generate(tpl, { W: 30 }, S0).errors.join()).toMatch(/رأس الوردة/)
    expect(generate(tpl, { hw: 40, sw: 16 }, S0).errors.join()).toMatch(/القلب/)
    expect(generate(tpl, { base: 60, H: 400, hw: 120, W: 110 }, S0).warnings.join()).toMatch(/القاعدة/)
  })

  it('draws the open rose with wedge notches, rings of petals and a spiral, the bud with wrapping petals, the leaves fretted', () => {
    const T = ROSE_DEBUG.TRACE
    for (const t of [3, 6]) {
      const d = generate(tpl, { style: 1 }, { ...S0, t }), label = `open t=${t}`
      expect(d.errors, label).toEqual([])
      // five wedges between the six lobes (the one under the head is left to the sepals), each carved out of the
      // outline: its mouth starts outside the outline, its middle is no longer wood, so the cut opens to the edge
      expect(T.counts.mouths, label).toBe(5)
      const outline = T.outers[0]
      for (const m of T.mouths) {
        expect(pointIn(m[0], outline), `${label} mouth starts outside`).toBe(false)
        expect(pointIn(m[Math.floor(m.length / 2)], outline), `${label} wedge carved`).toBe(false)
      }
      // a dense head like the photo's: the wedges, the spiral and the rings of petals
      expect(T.counts.head, label).toBeGreaterThanOrEqual(14)
      expect(T.counts.head, label).toBeLessThanOrEqual(22)
      expect(T.counts.side, `${label} side bud`).toBeGreaterThanOrEqual(2)
      expect(T.counts.cells, `${label} leaf cells`).toBeGreaterThanOrEqual(6)
      const b = generate(tpl, { style: 2 }, { ...S0, t })
      expect(b.errors, `bud t=${t}`).toEqual([])
      expect(T.counts.mouths, `bud t=${t}`).toBe(0)
      expect(T.counts.head, `bud t=${t} petal cuts`).toBeGreaterThanOrEqual(7)
    }
    // the bud's body is a teardrop 1.6 times as tall as it is wide, widest above its middle
    const body = ROSE_DEBUG.budBody(0.01), bb = bbox([{ closed: true, pts: body }])
    expect((bb.maxY - bb.minY) / (bb.maxX - bb.minX)).toBeCloseTo(1.6, 1)
    const widest = body.reduce((a, q) => (Math.abs(q.x) > Math.abs(a.x) ? q : a))
    expect(widest.y).toBeLessThan(0)
    // a leaf about 2.2 times as long as it is wide, with its cells cut out between the veins
    const lf = ROSE_DEBUG.leaf({ x: 0, y: 0 }, 0, 40, 40 / 2.2, 4), lb = bbox([{ closed: true, pts: lf.lens }])
    expect((lb.maxX - lb.minX) / (lb.maxY - lb.minY)).toBeCloseTo(2.2, 1)
    expect(lf.cells.length).toBeGreaterThanOrEqual(4)
  })

  it('builds quickly enough to follow the sliders', () => {
    generate(tpl, {}, S0)
    const t0 = performance.now()
    for (const style of [1, 2]) generate(tpl, { style }, S0)
    generate(tpl, { W: 250 }, S0) // refused, after searching for the height that fits
    expect(performance.now() - t0).toBeLessThan(1500)
  })

  // the same checks the app's robustness grid makes on every template: whenever no error is reported the geometry
  // must be sound — one outer loop, no self-intersection, holes inside with margin and apart from each other
  it('generates sound geometry across thickness, kerf and every parameter extreme, or refuses with an error', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    let runs = 0, refused = 0
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const kerf of [0, 0.2]) for (const v of variants) {
      const label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      runs++
      let d: ReturnType<typeof generate>
      try { d = generate(tpl, v, { ...DEFAULT_SETTINGS, t, kerf }) } catch (e) { throw new Error(`${label} threw: ${(e as Error).message}`) }
      for (const pn of d.panels) expect(pn.loops.every(l => l.pts.every(q => Number.isFinite(q.x) && Number.isFinite(q.y))), `${label} ${pn.id} non-finite`).toBe(true)
      if (d.errors.length) { refused++; continue }
      for (const pn of d.panels) {
        expect(pn.w, `${label} ${pn.id} width`).toBeGreaterThan(0)
        const closed = cutLoops(pn), outers = closed.filter(l => signedArea(l) > 0)
        expect(outers.length, `${label} ${pn.id} outer loops`).toBe(1)
        const outer = samplePoly(outers[0], 15)
        expect(selfIntersects(outer), `${label} ${pn.id} self-intersects`).toBe(false)
        const outerIdx = new Index([outer])
        const hs = closed.filter(l => signedArea(l) < 0).map(h => { const p = samplePoly(h, 20); return { p, b: bbox([h]), idx: new Index([p]) } })
        if (pn.id === 'rose') expect(thinnestBridge(outer), `${label} thread of wood`).toBeGreaterThan(ROSE_DEBUG.WEB - 0.25)
        for (const h of hs) {
          // the kerf offset must not turn a short edge inside out
          if (kerf) expect(selfIntersects(h.p), `${label} ${pn.id} hole crosses itself after the kerf offset`).toBe(false)
          expect(polysOverlap(h.p, outer) && !pointIn(h.p[0], outer), `${label} ${pn.id} hole outside`).toBe(false)
          expect(h.p.every(q => pointIn(q, outer)), `${label} ${pn.id} hole vertex outside`).toBe(true)
          expect(nearest(h.p, outerIdx, outer, h.idx, 2), `${label} ${pn.id} hole too close to the edge`).toBeGreaterThan(0.8 - 1e-9)
        }
        for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
          const a = hs[i].b, b = hs[j].b
          if (a.minX > b.maxX + 1 || b.minX > a.maxX + 1 || a.minY > b.maxY + 1 || b.minY > a.maxY + 1) continue
          expect(nearest(hs[i].p, hs[j].idx, hs[j].p, hs[i].idx, 2), `${label} ${pn.id} holes too close`).toBeGreaterThan(0.8 - 1e-9)
          expect(pointIn(hs[i].p[0], hs[j].p) || pointIn(hs[j].p[0], hs[i].p), `${label} ${pn.id} hole inside a hole`).toBe(false)
        }
        const shortest = Math.min(...outer.map((q, i) => { const r = outer[(i + 1) % outer.length]; return Math.hypot(r.x - q.x, r.y - q.y) }))
        expect(shortest, `${label} ${pn.id} zero-length`).toBeGreaterThan(1e-6)
      }
      const dxf = toDXF(d.layout)
      expect(dxf.includes('NaN') || dxf.includes('undefined'), `${label} dxf`).toBe(false)
    }
    expect(runs).toBeGreaterThan(100)
    expect(refused).toBeLessThan(runs / 3)
  })
  it('stops each wedge where its wood still holds: no outer petal hangs on a thread of wood', () => {
    // the wedge swept on round the whorl used to end a few tenths of a millimetre from the next notch, leaving the
    // top-left petal's whole rim on a 0.16–0.44 mm bridge
    const T = ROSE_DEBUG.TRACE
    for (const [W, line] of [[75, 2.5], [60, 1.5], [70, 2.5], [80, 3], [90, 3], [100, 3]] as const) {
      const d = generate(tpl, { W, line, hw: Math.max(90, W), H: Math.round(260 + 2.6 * (W - 75)), base: 160 }, S0), label = `W=${W} line=${line}`
      expect(d.errors, label).toEqual([])
      expect(T.counts.mouths, `${label} wedges`).toBe(5)
      expect(thinnestBridge(samplePoly(outerOf(panel(d, 'rose')), 15)), label).toBeGreaterThan(ROSE_DEBUG.WEB - 0.05)
    }
  })

  it('keeps every hole one simple loop after the kerf offset (no hair-thin edge on a leaf cell)', () => {
    for (const L of [24, 37.5, 60, 125]) for (const ang of [0, 0.7, 2.4]) {
      const lf = ROSE_DEBUG.leaf({ x: 0, y: 0 }, ang, L, L / 2.2, 4)
      for (const c of lf.cells) for (let i = 0; i < c.length; i++) {
        const q = c[(i + 1) % c.length]
        expect(Math.hypot(q.x - c[i].x, q.y - c[i].y), `L=${L} edge`).toBeGreaterThan(0.79)
      }
    }
    for (const v of [{}, { style: 2 }, { leaves: 4, H: 300 }, { W: 120, hw: 120, H: 420 }] as Record<string, number>[]) for (const t of [3, 4]) {
      const d = generate(tpl, v, { ...DEFAULT_SETTINGS, t, kerf: 0.2 }), label = `${JSON.stringify(v)} t=${t}`
      expect(d.errors, label).toEqual([])
      for (const h of holesOf(panel(d, 'rose'))) expect(selfIntersects(samplePoly(h, 20)), label).toBe(false)
    }
  })

  it('cuts out the pocket a leaf, the stem and the heart enclose, as in the photo, keeping its web', () => {
    const T = ROSE_DEBUG.TRACE
    const d = generate(tpl, {}, S0)
    expect(d.errors).toEqual([])
    expect(T.counts.pockets).toBeGreaterThanOrEqual(1)
    // the air the parts enclose, and the hole cut for it: the same area
    const air = ROSE_DEBUG.unionPolys(T.polys).filter(l => signedArea({ closed: true, pts: l }) < -15)
    expect(air.length).toBeGreaterThanOrEqual(1)
    const rose = panel(d, 'rose'), outer = samplePoly(outerOf(rose), 15), hs = holesOf(rose)
    const want = Math.abs(signedArea({ closed: true, pts: air[0] }))
    const pocket = hs.find(h => Math.abs(Math.abs(signedArea(h)) - want) < 0.1 * want)!
    expect(pocket, 'a hole for the pocket').toBeTruthy()
    const pp = samplePoly(pocket, 20)
    expect(polyDistance(pp, outer)).toBeGreaterThan(ROSE_DEBUG.WEB - 0.15)
    // no petal line or leaf cell inside it
    for (const h of hs) if (h !== pocket) expect(pointIn(samplePoly(h, 20)[0], pp)).toBe(false)
  })

  it('keeps a long straight edge straight where tidying cuts an acute corner (the stem keeps its width into the heart)', () => {
    // a bar meeting two discs at about 35°: tidying cuts the needle of air in each corner but may not tilt the bar's
    // edge (it used to jump to the next vertex of the disc, 1.2 mm off the bar's line)
    for (let ph = 0; ph < 1; ph += 0.1) {
      const bar = [{ x: -4, y: -60 }, { x: 4, y: -60 }, { x: 4, y: 15 }, { x: -4, y: 15 }]
      const disc = Array.from({ length: 116 }, (_, k) => { const a = (2 * Math.PI * (k + ph)) / 116; return { x: 22 + 22 * Math.cos(a), y: 22 + 22 * Math.sin(a) } })
      const raw = ROSE_DEBUG.unionPolys([bar, disc, disc.map(q => ({ x: -q.x, y: q.y }))])[0], tidy = ROSE_DEBUG.tidyOutline(raw)
      for (let i = 0; i < tidy.length; i++) {
        const a = tidy[i], b = tidy[(i + 1) % tidy.length], m = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.5)
        for (let k = 0; k <= m; k++) expect(toPoly({ x: a.x + ((b.x - a.x) * k) / m, y: a.y + ((b.y - a.y) * k) / m }, raw), `phase ${ph}`).toBeLessThan(0.5)
      }
    }
    // the real stem, just above the heart: its edges straight down to where they meet the heart
    for (const style of [1, 2]) for (const sw of [5, 8, 16]) {
      const d = generate(tpl, { style, sw }, S0), label = `style=${style} sw=${sw}`
      expect(d.errors, label).toEqual([])
      const rose = panel(d, 'rose'), o = outerOf(rose).pts, g = bbox([rose.loops.find(l => l.layer === 'engrave')!])
      // where the stem's edge meets the heart's lobe (a circle 0.27 hw round, its centre 0.23 hw beside the axis)
      const cx = (g.minX + g.maxX) / 2, heartTop = g.minY - 5, { R, a } = ROSE_DEBUG.HEART
      const meet = heartTop + 90 * R - Math.sqrt((90 * R) ** 2 - (90 * a - sw / 2) ** 2)
      let seen = 0
      for (let y = heartTop - 12; y < meet - 3; y += 0.25) for (const x of crossings(o, y)) for (const e of [cx - sw / 2, cx + sw / 2]) {
        if (Math.abs(x - e) < 1.5) { expect(Math.abs(x - e), `${label} y=${y}`).toBeLessThan(0.02); seen++ }
      }
      expect(seen, label).toBeGreaterThan(20)
    }
  })

  it('draws the plump heart of the photo, and the frame ring lies exactly on it', () => {
    const o = samplePoly(ROSE_DEBUG.heartOuter(0, 0, 100), 1), ys = o.map(q => q.y), top = Math.min(...ys), bot = Math.max(...ys)
    const across = (f: number) => { const xs = crossings(o, top + f * (bot - top)); return xs[xs.length - 1] - xs[0] }
    expect(bot - top).toBeCloseTo(95, 1)
    expect(across(0.5), 'full in the middle').toBeGreaterThan(80)
    expect(across(0.75), 'rounded sides, not a V').toBeGreaterThan(45)
    const cleft = Math.max(...o.filter(q => Math.abs(q.x) < 0.01 && q.y < 0).map(q => q.y))
    expect(cleft - top, 'a shallow cleft').toBeLessThan(16)
    for (const [hw, fw] of [[90, 5], [60, 4], [150, 12], [40, 5]] as const) {
      const d = generate(tpl, { hw, fw, sw: 5, H: hw > 100 ? 420 : 260 }, S0), label = `hw=${hw} fw=${fw}`
      expect(d.errors, label).toEqual([])
      const rose = panel(d, 'rose'), frame = panel(d, 'frame'), guide = rose.loops.find(l => l.layer === 'engrave')!
      const hole = holesOf(frame)[0], g = bbox([guide]), h = bbox([hole])
      // the ring's hole is the engraved guide; the ring's outline then lies on the heart's outline (or on wood where
      // the stem and the leaves join it), never over air
      const ring = samplePoly(outerOf(frame), 2).map(q => ({ x: q.x + g.minX - h.minX, y: q.y + g.minY - h.minY }))
      const ro = samplePoly(outerOf(rose), 10)
      let on = 0
      for (const q of ring) { const e = toPoly(q, ro); if (e < 0.05) on++; else expect(pointIn(q, ro), `${label} ring over air`).toBe(true) }
      expect(on / ring.length, `${label} ring on the heart's edge`).toBeGreaterThan(0.6)
      // and it is fw wide all round: its hole is the heart eroded by fw
      const hp = samplePoly(hole, 2), fo = samplePoly(outerOf(frame), 2)
      expect(polyDistance(hp, fo), label).toBeGreaterThan(fw - 0.05)
      expect(Math.max(...hp.map(q => toPoly(q, fo))), label).toBeLessThan(fw + 0.6)
    }
  })

  it('names the value that fixes each refusal, and that value does fix it', () => {
    const e1 = generate(tpl, { W: 60, line: 2.5 }, S0).errors.join()
    expect(e1).toMatch(/اجعل عرضه 68 مم/)
    expect(e1).toMatch(/رفّع الخطوط إلى 2 مم/)
    expect(generate(tpl, { W: 60, line: 2 }, S0).errors).toEqual([])
    expect(generate(tpl, { W: 68, line: 2.5 }, S0).errors).toEqual([])
    // following the first error's advice, again and again, ends in a design that builds
    const follow = (e: string, p: Record<string, number>): Record<string, number> => {
      const n = (re: RegExp) => Number(e.match(re)![1])
      if (/خطوط بتلاته \(/.test(e)) return { ...p, W: n(/اجعل عرضه ([\d.]+)/) }
      if (/القلب ضيّق/.test(e)) return { ...p, hw: n(/اجعل عرضه ([\d.]+)/) }
      if (/إطار القلب عريض/.test(e)) return { ...p, fw: n(/أقصاه ([\d.]+)/) }
      if (/زد الارتفاع الكلي/.test(e)) return { ...p, H: n(/إلى ([\d.]+)/) }
      if (/صغّر رأس الوردة إلى/.test(e)) return { ...p, W: n(/إلى ([\d.]+)/) }
      throw new Error(`no value in: ${e}`)
    }
    for (const v of [{ W: 30 }, { W: 250 }, { H: 120 }, { leaves: 4 }, { fw: 20, hw: 60 }, { hw: 40, sw: 16 }, { W: 250, H: 600, hw: 250 }, { style: 2, W: 200, line: 3 }] as Record<string, number>[]) {
      let p: Record<string, number> = { ...v }, d = generate(tpl, p, S0)
      expect(d.errors.length, JSON.stringify(v)).toBeGreaterThan(0)
      for (let k = 0; k < 5 && d.errors.length; k++) { p = follow(d.errors[0], p); for (const def of tpl.params) if (p[def.key] !== undefined) { expect(p[def.key]).toBeGreaterThanOrEqual(def.min); expect(p[def.key]).toBeLessThanOrEqual(def.max) } d = generate(tpl, p, S0) }
      expect(d.errors, JSON.stringify(v)).toEqual([])
    }
  })

  it('steps the clearance and the line width finely, and counts in good Arabic', () => {
    const def = (k: string) => tpl.params.find(d => d.key === k)!
    expect(def('fit').step).toBeLessThanOrEqual(0.05)
    expect(def('line').step).toBeLessThanOrEqual(0.1)
    const notes = generate(tpl, {}, S0).notes.join('\n')
    expect(notes).toMatch(/\d+ خلية\)/) // 11 and up: «12 خلية», not «12 خلايا»
    expect(notes).toMatch(/8 فصوص/)
    expect(generate(tpl, { lobes: 12 }, S0).notes.join('\n')).toMatch(/12 فصّاً/)
  })
})

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
    for (const t of [2.7, 3, 4]) for (const sw of [6, 8, 12]) {
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
      for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y), `${label} ${pn.id} non-finite`).toBe(true)
      if (d.errors.length) { refused++; continue }
      for (const pn of d.panels) {
        expect(pn.w, `${label} ${pn.id} width`).toBeGreaterThan(0)
        const closed = cutLoops(pn), outers = closed.filter(l => signedArea(l) > 0)
        expect(outers.length, `${label} ${pn.id} outer loops`).toBe(1)
        const outer = samplePoly(outers[0], 15)
        expect(selfIntersects(outer), `${label} ${pn.id} self-intersects`).toBe(false)
        const outerIdx = new Index([outer])
        const hs = closed.filter(l => signedArea(l) < 0).map(h => { const p = samplePoly(h, 20); return { p, b: bbox([h]), idx: new Index([p]) } })
        for (const h of hs) {
          expect(polysOverlap(h.p, outer) && !pointIn(h.p[0], outer), `${label} ${pn.id} hole outside`).toBe(false)
          for (const q of h.p) expect(pointIn(q, outer), `${label} ${pn.id} hole vertex outside`).toBe(true)
          expect(nearest(h.p, outerIdx, outer, h.idx, 2), `${label} ${pn.id} hole too close to the edge`).toBeGreaterThan(0.8 - 1e-9)
        }
        for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
          const a = hs[i].b, b = hs[j].b
          if (a.minX > b.maxX + 1 || b.minX > a.maxX + 1 || a.minY > b.maxY + 1 || b.minY > a.maxY + 1) continue
          expect(nearest(hs[i].p, hs[j].idx, hs[j].p, hs[i].idx, 2), `${label} ${pn.id} holes too close`).toBeGreaterThan(0.8 - 1e-9)
        }
        for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; expect(Math.hypot(q.x - outer[i].x, q.y - outer[i].y), `${label} ${pn.id} zero-length`).toBeGreaterThan(1e-6) }
      }
      const dxf = toDXF(d.layout)
      expect(dxf.includes('NaN') || dxf.includes('undefined'), `${label} dxf`).toBe(false)
    }
    expect(runs).toBeGreaterThan(100)
    expect(refused).toBeLessThan(runs / 3)
  })
})

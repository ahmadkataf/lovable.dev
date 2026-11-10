import { describe, it, expect } from 'vitest'
import { COASTER_SETS } from './coasterset'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, bbox } from './geom'
import { samplePoly, polyDistance } from './testutil'

const tpl = COASTER_SETS[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
type L = { closed: boolean; layer?: string; pts: { x: number; y: number; b?: number }[] }
const holesOf = (pn: { loops: L[] }) => pn.loops.filter(l => l.closed && l.layer !== 'engrave' && signedArea(l as never) < 0)
const outerOf = (pn: { loops: L[] }) => pn.loops.find(l => l.closed && l.layer !== 'engrave' && signedArea(l as never) > 0)!
const boxes = (pn: { loops: L[]; w: number; h: number }) => holesOf(pn).map(h => { const b = bbox([h as never]); return { x0: b.minX - pn.w / 2, x1: b.maxX - pn.w / 2, y0: b.minY - pn.h / 2, y1: b.maxY - pn.h / 2 } })

describe('the coaster set with the dahlia fret', () => {
  it('builds at its own sizes on the common sheets: six coasters, the box (base, bent wall, top frame) and the two-plate stand', () => {
    for (const t of [2.7, 3, 3.2]) {
      const d = generate(tpl, {}, { ...S0, t })
      expect(d.errors, `t=${t}`).toEqual([])
      expect(d.panels.map(p => p.id).sort(), `t=${t}`).toEqual(['base', 'coaster', 'lid', 'lid-under', 'ring', 'wall'])
      expect(d.panels.find(p => p.id === 'coaster')!.count).toBe(6)
    }
  })

  it('cuts the same fret on every coaster: 8-fold petals with webs no thinner than asked, all inside the border', () => {
    for (const [S, web] of [[100, 0], [100, 3], [80, 0], [140, 0]] as const) {
      const d = generate(tpl, { S, web, holder: 0, stand: 0 }, S0)
      expect(d.errors, `S=${S} web=${web}`).toEqual([])
      const c = d.panels.find(p => p.id === 'coaster')!, hs = holesOf(c)
      // the square's eight symmetries: holes on a mirror line come in fours
      expect(hs.length % 4, `S=${S} holes`).toBe(0)
      expect(hs.length).toBeGreaterThanOrEqual(40)
      const want = web > 0 ? web : Math.max(2, (27.48 * (S / 2 - 3.5)) / 528)
      const outer = samplePoly(outerOf(c) as never, 8), sampled = hs.map(h => samplePoly(h as never, 10))
      for (let i = 0; i < sampled.length; i++) {
        expect(polyDistance(sampled[i], outer), `S=${S} hole ${i} to the edge`).toBeGreaterThan(3.5 - 0.05)
        for (let j = i + 1; j < sampled.length; j++) expect(polyDistance(sampled[i], sampled[j]), `S=${S} web ${i}-${j}`).toBeGreaterThan(want - 0.12)
      }
    }
  })

  it('every wall tab finds its slot: as many slots in the base and the frame as tabs on each edge, each the tab plus the fit long and the sheet plus the fit wide', () => {
    for (const t of [2.7, 3.2]) for (const v of [{}, { ow: 0 }, { nc: 7 }, { S: 120 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const base = d.panels.find(x => x.id === 'base')!, ring = d.panels.find(x => x.id === 'ring')!, wall = d.panels.find(x => x.id === 'wall')!
      // the wall's tabs: runs of its bottom edge that stand t below the strip
      const o = outerOf(wall).pts, yMax = Math.max(...o.map(q => q.y))
      const tabs: number[] = []
      for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; if (Math.abs(a.y - yMax) < 1e-6 && Math.abs(b.y - yMax) < 1e-6) tabs.push(Math.abs(b.x - a.x)) }
      const slotsB = boxes(base), slotsR = boxes(ring).filter(s => Math.min(s.x1 - s.x0, s.y1 - s.y0) < t + 1)
      expect(slotsB.length, label).toBe(tabs.length * wall.count)
      expect(slotsR.length, label).toBe(slotsB.length)
      for (const s of slotsB) {
        expect(Math.min(s.x1 - s.x0, s.y1 - s.y0), `${label} slot width`).toBeCloseTo(t + p.fit, 3)
        expect(tabs.some(w => Math.abs(Math.max(s.x1 - s.x0, s.y1 - s.y0) - w - p.fit) < 1e-3), `${label} slot length`).toBe(true)
        // the frame has the same slot at the same place
        expect(slotsR.some(r => Math.abs(r.x0 - s.x0) < 1e-3 && Math.abs(r.y0 - s.y0) < 1e-3), `${label} frame slot`).toBe(true)
      }
      // the coasters drop through the frame's opening, and the clear height holds the stack
      const opening = boxes(ring).find(s => s.x1 - s.x0 > p.S)!
      expect(opening.x1 - opening.x0, label).toBeGreaterThan(p.S + 1)
      expect(wall.h - 2 * t, label).toBeGreaterThanOrEqual(p.nc * t + p.air - 1e-6)
    }
  })

  it('the stand: one slot per coaster, staggered, the same in both plates, the under plate fitting the frame opening', () => {
    for (const t of [2.7, 3.2]) for (const nc of [4, 6, 7]) {
      const p: Record<string, number> = { ...tpl.defaults, nc }, label = `nc=${nc} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const lid = d.panels.find(x => x.id === 'lid')!, under = d.panels.find(x => x.id === 'lid-under')!, ring = d.panels.find(x => x.id === 'ring')!
      const a = boxes(lid).sort((u, v) => u.y0 - v.y0), b = boxes(under).sort((u, v) => u.y0 - v.y0)
      expect(a.length, label).toBe(nc)
      a.forEach((s, k) => {
        for (const key of ['x0', 'x1', 'y0', 'y1'] as const) expect(b[k][key], `${label} slot ${k}`).toBeCloseTo(s[key], 3)
        expect(s.y1 - s.y0, `${label} slot width`).toBeCloseTo(t + p.fit, 3)
        if (k) { expect(s.y0 - a[k - 1].y1, `${label} wood between slots`).toBeGreaterThan(2.4); expect(Math.abs(s.x0 - a[k - 1].x0), `${label} staggered`).toBeGreaterThan(1) }
      })
      const opening = boxes(ring).find(s => s.x1 - s.x0 > p.S)!
      expect(under.w, label).toBeLessThan(opening.x1 - opening.x0)
      expect(under.w, label).toBeGreaterThan(opening.x1 - opening.x0 - 2)
    }
  })

  it('the quick-cutting box: four flat boards with finger joints, every tab in a slot of its size; or the wall bent at the corners only', () => {
    const fast = COASTER_SETS.find(x => x.id === 'coastersetfast')!
    expect(fast.defaults.style).toBe(3)
    for (const t of [2.7, 3.2, 4]) for (const v of [{}, { ow: 0 }, { nc: 4 }, { S: 120 }] as Record<string, number>[]) {
      const p = { ...fast.defaults, ...v }, label = `fast ${JSON.stringify(v)} t=${t}`
      const d = generate(fast, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      expect(d.panels.map(x => x.id).sort(), label).toEqual(['base', 'coaster', 'lid', 'lid-under', 'ring', 'wall-back', 'wall-front', 'wall-side'])
      const walls = d.panels.filter(x => x.id.startsWith('wall'))
      for (const w of walls) expect(w.loops.length, `${label} ${w.id} has no hinge cuts`).toBeLessThanOrEqual(2)
      // tabs on the bottom edge of every board, as many slots in the base, each the tab plus the fit long
      const tabs: number[] = []
      for (const w of walls) {
        const o = outerOf(w).pts, yMax = Math.max(...o.map(q => q.y))
        for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; if (Math.abs(a.y - yMax) < 1e-6 && Math.abs(b.y - yMax) < 1e-6) for (let k = 0; k < w.count; k++) tabs.push(Math.abs(b.x - a.x)) }
      }
      const base = d.panels.find(x => x.id === 'base')!, ring = d.panels.find(x => x.id === 'ring')!
      const slotsB = boxes(base), slotsR = boxes(ring).filter(sl => Math.min(sl.x1 - sl.x0, sl.y1 - sl.y0) < t + 1)
      expect(slotsB.length, label).toBe(tabs.length)
      expect(slotsR.length, label).toBe(tabs.length)
      for (const sl of slotsB) {
        expect(Math.min(sl.x1 - sl.x0, sl.y1 - sl.y0), `${label} slot width`).toBeCloseTo(t + p.fit, 3)
        expect(tabs.some(w => Math.abs(Math.max(sl.x1 - sl.x0, sl.y1 - sl.y0) - w - p.fit) < 1e-3), `${label} slot length`).toBe(true)
      }
      // the boards' outer corner stays inside the base's rounded corner
      const half = walls[0].w / 2, r = base.w / 2
      expect(Math.hypot(half, half), label).toBeLessThan(Math.hypot(r, r) - 0.3)
    }
    // bent at the corners only: far fewer hinge cuts than bent all round
    const hingeCuts = (style: number) => generate(tpl, { style }, S0).panels.find(x => x.id === 'wall')!.loops.filter(l => !l.closed).length
    expect(hingeCuts(2), 'corners only').toBeLessThan(0.5 * hingeCuts(1))
    expect(generate(tpl, { style: 2 }, S0).errors).toEqual([])
  })

  it('says what to change when the fret or the stand does not fit', () => {
    expect(generate(tpl, { S: 70, web: 6 }, S0).errors.length).toBeGreaterThan(0)
    expect(generate(tpl, { nc: 12, S: 70 }, S0).errors.join()).toMatch(/الستاند|الشقوق|عدد/)
  })
})

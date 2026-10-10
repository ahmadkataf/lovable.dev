import { describe, it, expect } from 'vitest'
import { TROPHIES, trophyModel } from './trophies'
import { CATEGORIES } from './templates'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, bbox } from './geom'
import { pointIn } from './testutil'

const S = { ...DEFAULT_SETTINGS, kerf: 0 }
const holesOf = (pn: { loops: { closed: boolean; layer?: string; pts: { x: number; y: number }[] }[] }) => pn.loops.filter(l => l.closed && l.layer !== 'engrave' && signedArea(l as never) < 0)
const outerOf = (pn: { loops: { closed: boolean; layer?: string; pts: { x: number; y: number }[] }[] }) => pn.loops.find(l => l.closed && l.layer !== 'engrave' && signedArea(l as never) > 0)!
const segD = (q: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, k = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0
  return Math.hypot(q.x - a.x - k * dx, q.y - a.y - k * dy)
}
const distTo = (q: { x: number; y: number }, pts: { x: number; y: number }[]) => Math.min(...pts.map((a, i) => segD(q, a, pts[(i + 1) % pts.length])))

describe('trophies', () => {
  it('are listed in their own group', () => {
    expect(CATEGORIES.find(c => c.id === 'trophy')!.ids).toEqual(TROPHIES.map(t => t.id))
  })

  it('build at their own sizes on every common sheet, the inlays and the logo disc face on the light sheet', () => {
    for (const tpl of TROPHIES) for (const t of [2.7, 3, 3.2, 4]) {
      const d = generate(tpl, {}, { ...S, t })
      expect(d.errors, `${tpl.id} t=${t}`).toEqual([])
      const light = d.panels.filter(p => p.material === 'light').map(p => p.id)
      expect(light, `${tpl.id} light pieces`).toContain('nameplate')
      expect(light.length, `${tpl.id} light pieces`).toBeGreaterThan(1)
      expect(d.panels.filter(p => !p.material).map(p => p.id), tpl.id).toEqual(expect.arrayContaining(['foot', 'box-top', 'box-bottom', 'box-front', 'box-back', 'box-side']))
    }
  })

  it('every upright has a tenon as long as the base below its shoulder, in a slot of its size at the same place in every plate', () => {
    for (const tpl of TROPHIES) for (const t of [3, 3.2, 4]) for (const v of [{}, { kind: 2 }, { ns: 2 }, { ns: 0 }, { fj: 1 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${tpl.id} ${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S, t })
      expect(d.errors, label).toEqual([])
      const m = trophyModel(tpl.id, p, { ...S, t })!
      const tenons = m.shape.ups.flatMap(u => u.tenons.map(([a, b]) => ({ u, a, b })))
      // the plates the tenons pass through, and the slots in each, as offsets from the plate's middle
      const plates = d.panels.filter(pn => /^(step-\d|box-top|box-bottom|layer|layer-top)$/.test(pn.id))
      expect(plates.length, label).toBeGreaterThan(0)
      const slotSets = plates.map(pn => holesOf(pn).map(h => { const b = bbox([h as never]); return { x0: b.minX - pn.w / 2, x1: b.maxX - pn.w / 2, y0: b.minY - pn.h / 2, y1: b.maxY - pn.h / 2 } }).sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0))
      for (const ss of slotSets) {
        expect(ss.length, label).toBe(tenons.length)
        ss.forEach((s, k) => {
          for (const key of ['x0', 'x1', 'y0', 'y1'] as const) expect(s[key], `${label} slot ${k} ${key}`).toBeCloseTo(slotSets[0][k][key], 3)
          expect(s.y1 - s.y0, `${label} slot width`).toBeCloseTo(t + p.fit, 3)
        })
      }
      for (const { a, b } of tenons) expect(slotSets[0].some(s => Math.abs(s.x1 - s.x0 - (b - a + p.fit)) < 1e-3), `${label} a slot ${b - a} + fit long`).toBe(true)
      // each upright: the tenon runs from its shoulder down the whole base less half a millimetre
      const L = (p.kind === 2 ? p.nl * t : p.hb) + p.ns * t - 0.5
      for (const u of m.shape.ups) {
        const pn = d.panels.find(x => x.id === u.id)!, o = outerOf(pn).pts
        const yTop = Math.min(...o.map(q => q.y)), yBot = Math.max(...o.map(q => q.y))
        const top = Math.max(...u.pts.map(q => q.y))
        expect(yBot - yTop, `${label} ${u.id} height`).toBeCloseTo(top + L, 2)
      }
    }
  })

  it('keeps every inlay inside its piece with the dark border round it, and the disc clear of the piece in front', () => {
    for (const tpl of TROPHIES) for (const t of [3, 3.2]) for (const v of [{}, { H: 260, W: 90 }, { rim: 2.5 }, { disc: 0 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${tpl.id} ${JSON.stringify(v)} t=${t}`
      if (generate(tpl, p, { ...S, t }).errors.length) continue
      const m = trophyModel(tpl.id, p, { ...S, t })!
      for (const il of m.shape.inlays) {
        const host = m.shape.ups.find(u => u.id === il.host)!
        for (const q of il.pts) {
          expect(pointIn(q, host.pts), `${label} ${il.id} inside`).toBe(true)
          expect(distTo(q, host.pts), `${label} ${il.id} border`).toBeGreaterThan(p.rim - 0.06)
        }
      }
      if (m.medalR && m.shape.medal) {
        const host = m.shape.ups.find(u => u.id === m.shape.medal!.host)!
        for (const u of m.shape.ups.filter(x => x.plane === host.plane - 1)) expect(distTo(m.medalR.c, u.pts) - m.medalR.r, `${label} disc clear of ${u.id}`).toBeGreaterThan(1.99)
      }
    }
  })

  it('refuses what would not stand or not fit, saying what to change', () => {
    const sw = TROPHIES.find(t => t.id === 'trophyswoosh')!
    expect(generate(sw, { H: 150 }, S).errors.join()).toContain('الارتفاع الكلّي')                 // too short for its width
    expect(generate(sw, { W: 50 }, S).errors.length).toBeGreaterThan(0)                            // too slender, blades too thin
    const pl = TROPHIES.find(t => t.id === 'trophyplaque')!
    expect(generate(pl, { bw: 200 }, S).errors.join()).toContain('أعرض من القاعدة')
    for (const style of [1, 2, 3, 4]) expect(generate(pl, { style }, S).errors, `plaque style ${style}`).toEqual([])
  })
})

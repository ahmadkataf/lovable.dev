import { describe, it, expect } from 'vitest'
import { signedArea, bbox } from './geom'
import { TEMPLATES } from './templates'
import { generate, DEFAULT_SETTINGS } from './generate'
import { toDXF } from './export'
import { samplePoly, pointIn, polysOverlap, polyDistance, selfIntersects } from './testutil'

export function gridSuite(shard: number, shards: number) {
describe(`robustness grid ${shard + 1}/${shards}`, () => {
  // every template over thickness, kerf, finger, box size and its own parameter ranges; whenever no error is
  // reported the geometry must be sound: one outer loop per panel, no self-intersection, holes inside with margin
  it('generates sound geometry for every template across a parameter grid, or refuses with an error', () => {
    const boxes = [[60, 50, 30], [120, 80, 50], [300, 200, 120]]
    let runs = 0, refused = 0
    for (const tpl of TEMPLATES.filter((_, i) => i % shards === shard)) {
      const extras = tpl.params.filter(d => !['W', 'D', 'H', 'Dm'].includes(d.key))
      const variants: Record<string, number>[] = [{}]
      for (const def of extras) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
      // door engravings use none of thickness, fingers, box size or inner sizes: every extreme of their own settings, at both kerfs
      const engraving = tpl.id.startsWith('door') && tpl.id !== 'doorhanger'
      // the display stand has no fingers or inner sizes, and a back panel taller than any of the boxes
      const stand = tpl.id.startsWith('displaystand')
      // trophies stand on a base W × D and are H tall in all; the coaster set is sized by its coaster
      const trophy = tpl.id.startsWith('trophy'), coaster = tpl.id === 'coasterset', rose = tpl.id === 'rosesign', own = stand || trophy || coaster || rose
      for (const t of engraving ? [3] : [2, 2.7, 3, 4, 6]) for (const kerf of [0, 0.2]) for (const finger of engraving || own ? [0] : [0, 12]) for (const [W, D, H] of engraving ? boxes.slice(0, 1) : boxes) for (const inner of engraving || own ? [false] : [false, true]) for (const v of variants) {
        const params = tpl.params.some(d => d.key === 'Dm') ? { Dm: W, H, ...v } : tpl.id === 'frame' ? { pw: W, ph: D + H, ...v } : stand ? { W: 160 + W, H: 420 + 2 * H, ...v }
          : trophy ? { W: 50 + W / 2, D: 40 + D / 2, H: 60 + 1.3 * (50 + W / 2) + 2.2 * (50 + W / 2) * (H / 120), ...(tpl.id === 'trophyplaque' ? { bw: 45 + W / 2 } : {}), ...v }
          : coaster ? { S: 70 + W / 4, ...v } : rose ? { H: 180 + H, W: 40 + W / 6, hw: 50 + W / 5, ...v } : { W, D, H, ...v }
        runs++
        let d
        try { d = generate(tpl, params, { ...DEFAULT_SETTINGS, t, kerf, finger, inner }) } catch (e) { throw new Error(`${tpl.id} ${JSON.stringify(params)} t=${t} kerf=${kerf} threw: ${(e as Error).message}`) }
        for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y), `${tpl.id} ${pn.id} non-finite`).toBe(true)
        if (d.errors.length) { refused++; continue }
        const label = `${tpl.id} ${JSON.stringify(params)} t=${t} kerf=${kerf} finger=${finger} inner=${inner}`
        expect(d.layout.w, label).toBeLessThanOrEqual(Math.max(DEFAULT_SETTINGS.sheetW, Math.max(...d.panels.map(p => p.w))) + 1e-6)
        for (const pn of d.panels) {
          expect(pn.w, `${label} ${pn.id} width`).toBeGreaterThan(0)
          const closed = pn.loops.filter(l => l.closed && l.layer !== 'engrave')
          const outers = closed.filter(l => signedArea(l) > 0)
          expect(outers.length, `${label} ${pn.id} outer loops`).toBe(1)
          const outer = samplePoly(outers[0], 15)
          expect(selfIntersects(outer), `${label} ${pn.id} self-intersects`).toBe(false)
          for (const h of closed.filter(l => signedArea(l) < 0)) {
            const hp = samplePoly(h, 20)
            expect(polysOverlap(hp, outer) && !pointIn(hp[0], outer), `${label} ${pn.id} hole outside`).toBe(false)
            // every hole vertex inside the outline, and the outline not closer than 0.8 mm (slots that merge into joints become part of the outline, so they never appear here)
            for (const q of hp) expect(pointIn(q, outer), `${label} ${pn.id} hole vertex outside`).toBe(true)
            expect(polyDistance(hp, outer), `${label} ${pn.id} hole too close to the edge`).toBeGreaterThan(0.8 - 1e-9)
          }
          // holes keep at least 0.8 mm between each other (bounding boxes first, so lattices stay quick)
          const hs = closed.filter(l => signedArea(l) < 0).map(h => ({ p: samplePoly(h, 20), b: bbox([h]) }))
          for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
            const a = hs[i].b, b = hs[j].b
            if (a.minX > b.maxX + 1 || b.minX > a.maxX + 1 || a.minY > b.maxY + 1 || b.minY > a.maxY + 1) continue
            expect(polyDistance(hs[i].p, hs[j].p), `${label} ${pn.id} holes too close`).toBeGreaterThan(0.8 - 1e-9)
          }
          for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; expect(Math.hypot(q.x - outer[i].x, q.y - outer[i].y), `${label} ${pn.id} zero-length`).toBeGreaterThan(1e-6) }
        }
        const dxf = toDXF(d.layout)
        expect(dxf.includes('NaN') || dxf.includes('undefined'), `${label} dxf`).toBe(false)
      }
    }
    expect(runs).toBeGreaterThan(100)
    expect(refused).toBeLessThan(runs)
  })
})
}

import { describe, it, expect } from 'vitest'
import { CUBE_SETS, badgeLoop, cubeGeom } from './cubeset'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, bbox } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, polysOverlap, polyDistance, selfIntersects } from './testutil'

const tpl = CUBE_SETS[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
type L = { closed: boolean; layer?: string; pts: { x: number; y: number; b?: number }[] }
const cut = (pn: { loops: L[] }) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const holesOf = (pn: { loops: L[] }) => cut(pn).filter(l => signedArea(l as never) < 0)
const outerOf = (pn: { loops: L[] }) => cut(pn).find(l => signedArea(l as never) > 0)!
const box = (l: L) => { const b = bbox([l as never]); return { x0: b.minX, x1: b.maxX, y0: b.minY, y1: b.maxY, w: b.maxX - b.minX, h: b.maxY - b.minY } }
const by = (d: ReturnType<typeof generate>, id: string) => d.panels.find(p => p.id === id)!

describe('the acrylic cube set on a tray', () => {
  it('builds at its defaults on the common sheets: six cubes, lids with lip frames, six badges, the tray', () => {
    for (const t of [2.7, 3, 3.2, 4]) {
      const d = generate(tpl, {}, { ...S0, t })
      expect(d.errors, `t=${t}`).toEqual([])
      expect(d.panels.map(p => p.id).sort()).toEqual(['cube-back', 'cube-bottom', 'cube-front', 'cube-side', 'lid', 'lip-fb', 'lip-side', 'topper', 'tray-back', 'tray-bottom', 'tray-front', 'tray-side'])
      for (const id of ['cube-bottom', 'cube-front', 'cube-back']) { expect(by(d, id).count, id).toBe(6); expect(by(d, id).material, id).toBe('clear') }
      expect(by(d, 'cube-side').count).toBe(12)
      for (const id of ['lid', 'lip-fb', 'lip-side']) expect(by(d, id).material, id).toBe('white')
      expect(by(d, 'lid').count).toBe(6)
      expect(by(d, 'lip-fb').count).toBe(12)
      expect(by(d, 'topper').material).toBe('gold')
      expect(by(d, 'topper').count).toBe(6)
      for (const id of ['tray-bottom', 'tray-front', 'tray-back', 'tray-side']) expect(by(d, id).material, id).toBeUndefined()
      // the tray's inside holds the block of cubes with the play round it
      const base = by(d, 'tray-bottom')
      expect(base.w).toBeCloseTo(3 * 80 + 2 * 2 + 2 * 1 + 2 * t, 3)
      expect(base.h).toBeCloseTo(2 * 80 + 1 * 2 + 2 * 1 + 2 * t, 3)
      expect(by(d, 'tray-front').h).toBeCloseTo(25, 3)
      expect(d.notes.join(' ')).toMatch(/كلوروفورم|غراء أكريليك/)
    }
  })

  it('the lid: a plate the size of the cube, a lip frame that drops inside the walls with the clearance, the badge slot centred near the back', () => {
    for (const t of [2.7, 3.2, 4]) for (const v of [{}, { a: 60, gap: 1 }, { a: 120, tm: 2 }, { tw: 20 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const g = cubeGeom(p, t), lid = by(d, 'lid')
      expect(lid.w, label).toBeCloseTo(p.a, 3)
      expect(lid.h, label).toBeCloseTo(p.a, 3)
      expect(by(d, 'lip-fb').w, label).toBeCloseTo(p.a - 2 * t - 2 * p.gap, 3)
      expect(by(d, 'lip-side').w, label).toBeCloseTo(p.a - 2 * t - 2 * p.gap, 3)
      expect(by(d, 'lip-fb').h, label).toBeCloseTo(g.lipH, 3)
      expect(g.lipH, label).toBeGreaterThanOrEqual(3 * t)
      const slots = holesOf(lid)
      expect(slots.length, label).toBe(1)
      const s = box(slots[0])
      expect(s.h, `${label} slot width`).toBeCloseTo((p.tm > 0 ? p.tm : t) + p.fit, 3)
      expect(s.w, `${label} slot length`).toBeCloseTo(g.ft + p.fit, 3)
      expect((s.x0 + s.x1) / 2, `${label} centred`).toBeCloseTo(p.a / 2, 3)
      // behind the lip strip with 2 mm to spare, and in the back part of the plate
      expect(s.y0, `${label} clear of the lip`).toBeGreaterThanOrEqual(2 * t + p.gap + 2 - 1e-9)
      expect(s.y1, `${label} in the back half`).toBeLessThanOrEqual(p.a / 2 + 1e-9)
      // the badge's foot is the slot's size less the fit, and as tall as the plate plus a millimetre
      const top = by(d, 'topper'), o = outerOf(top).pts, yMax = Math.max(...o.map(q => q.y))
      const footPts = o.filter(q => Math.abs(q.y - yMax) < 1e-6)
      expect(footPts.length, label).toBe(2)
      expect(Math.abs(footPts[0].x - footPts[1].x), `${label} foot width`).toBeCloseTo(g.ft, 3)
      const body = o.filter(q => q.y < yMax - 1e-6)
      expect(yMax - Math.max(...body.map(q => q.y)), `${label} foot height`).toBeCloseTo(t + 1, 3)
      expect(top.w, `${label} badge width`).toBeCloseTo(p.tw, 2)
    }
  })

  it('every badge style is one clean outline: exactly as wide as asked, the body standing flat on its base line, the foot centred under it', () => {
    for (const style of [1, 2, 3]) for (const tw of [16, 34, 80]) for (const t of [2, 3.2, 6]) {
      const ft = Math.min(10, Math.max(4, 0.3 * tw)), fh = t + 1, label = `style=${style} tw=${tw} t=${t}`
      const b = badgeLoop(style, tw, ft, fh, Math.max(0.8, 0.04 * tw))
      expect(signedArea(b.loop), label).toBeGreaterThan(0)
      const poly = samplePoly(b.loop, 4)
      expect(selfIntersects(poly), `${label} self-intersects`).toBe(false)
      const bb = bbox([b.loop])
      expect(bb.maxX - bb.minX, `${label} width`).toBeCloseTo(tw, 2)
      expect(b.bodyH, label).toBeGreaterThan(0.5 * tw)
      expect(b.bodyH, label).toBeLessThan(1.1 * tw)
      // nothing of the body hangs below its base line (where it stands on the lid): only the foot is lower
      const base = bb.maxY - fh
      for (const q of poly) if (Math.abs(q.x - (bb.minX + bb.maxX) / 2) > ft / 2 + 1e-6) expect(q.y, `${label} body below the base`).toBeLessThanOrEqual(base + 1e-6)
      // the foot: two vertical edges ft apart, centred
      const foot = b.loop.pts.filter(q => Math.abs(q.y - bb.maxY) < 1e-6).map(q => q.x).sort((u, v) => u - v)
      expect(foot.length, label).toBe(2)
      expect(foot[1] - foot[0], label).toBeCloseTo(ft, 3)
      expect((foot[0] + foot[1]) / 2, `${label} foot centred`).toBeCloseTo((bb.minX + bb.maxX) / 2, 1)
      // no material tip sharper than a blunt horn: every vertex of the sampled outline keeps its neighbours apart
      for (let i = 0; i < poly.length; i++) { const q = poly[(i + 1) % poly.length]; expect(Math.hypot(q.x - poly[i].x, q.y - poly[i].y), `${label} zero-length`).toBeGreaterThan(1e-6) }
    }
    // the three styles differ
    const ws = [1, 2, 3].map(s => badgeLoop(s, 34, 10, 4.2, 1.36).bodyH)
    expect(new Set(ws.map(v => Math.round(v))).size).toBe(3)
  })

  it('dividers: strips on tabs through base slots of their size, one tab under every cell, half-lap crossings at the cube boundaries', () => {
    for (const t of [2.7, 3.2, 4]) for (const v of [{ div: 1, gapC: 6 }, { div: 1, gapC: 6, rows: 3, cols: 4 }, { div: 1, gapC: 8, rows: 1, cols: 3 }, { div: 1, gapC: 8, rows: 2, cols: 1, a: 60 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const g = cubeGeom(p, t), base = by(d, 'tray-bottom'), slots = holesOf(base).map(box)
      const long = d.panels.find(x => x.id === 'div-long'), wide = d.panels.find(x => x.id === 'div-wide')
      expect(!!long, label).toBe(g.cols > 1)
      expect(!!wide, label).toBe(g.rows > 1)
      if (long) expect(long.count, label).toBe(g.cols - 1)
      if (wide) expect(wide.count, label).toBe(g.rows - 1)
      expect(slots.length, label).toBe((g.cols - 1) * g.rows + (g.rows - 1) * g.cols)
      for (const s of slots) {
        expect(Math.min(s.w, s.h), `${label} slot width`).toBeCloseTo(t + p.fit, 3)
        expect(Math.max(s.w, s.h), `${label} slot length`).toBeCloseTo(g.tl + p.fit, 3)
        // well inside the base: past the fingers with 2 mm to spare
        expect(Math.min(s.x0, s.y0, base.w - s.x1, base.h - s.y1), `${label} slot margin`).toBeGreaterThan(t + 2)
      }
      // a slot sits on every boundary between cubes, under the middle of the cell
      const cx = (k: number) => t + p.play + k * (p.a + p.gapC) + p.a / 2, bx = (j: number) => t + p.play + (j + 1) * p.a + j * p.gapC + p.gapC / 2
      for (let j = 0; j < g.cols - 1; j++) for (let k = 0; k < g.rows; k++) expect(slots.some(s => Math.abs((s.x0 + s.x1) / 2 - bx(j)) < 1e-3 && Math.abs((s.y0 + s.y1) / 2 - cx(k)) < 1e-3), `${label} long slot ${j},${k}`).toBe(true)
      for (let i = 0; i < g.rows - 1; i++) for (let k = 0; k < g.cols; k++) expect(slots.some(s => Math.abs((s.y0 + s.y1) / 2 - bx(i)) < 1e-3 && Math.abs((s.x0 + s.x1) / 2 - cx(k)) < 1e-3), `${label} wide slot ${i},${k}`).toBe(true)
      // each strip: tabs t tall on its bottom edge, as many as the cells it crosses, each as long as the slot less the fit
      for (const [strip, cells] of [[long, g.rows], [wide, g.cols]] as const) {
        if (!strip) continue
        const o = outerOf(strip).pts, yMax = Math.max(...o.map(q => q.y))
        const tabs: number[] = []
        for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; if (Math.abs(a.y - yMax) < 1e-6 && Math.abs(b.y - yMax) < 1e-6) tabs.push(Math.abs(b.x - a.x)) }
        expect(tabs.length, `${label} ${strip.id} tabs`).toBe(cells)
        for (const w of tabs) expect(w, `${label} ${strip.id} tab length`).toBeCloseTo(g.tl, 3)
        expect(strip.h, `${label} ${strip.id} height`).toBeCloseTo(p.trayH - t + t, 3)
        // the strip fits between the walls with half a millimetre each end
        expect(strip.w, `${label} ${strip.id} length`).toBeCloseTo((strip.id === 'div-long' ? g.Di : g.Wi) - 1, 3)
      }
      // crossing slots: the long strips from the top, the wide ones from the bottom, each half the body deep and t + fit wide
      if (long && wide) {
        const o = outerOf(long).pts, yMin = Math.min(...o.map(q => q.y))
        const topNotches = o.filter((q, i) => Math.abs(q.y - yMin) > 1e-6 && Math.abs(o[(i + 1) % o.length].y - q.y) < 1e-6 && q.y < yMin + g.hd / 2 + 1e-6 && q.y > yMin + 1e-6)
        expect(topNotches.length, `${label} top notches`).toBe(g.rows - 1)
        expect(topNotches[0].y - yMin, `${label} notch depth`).toBeCloseTo(g.hd / 2, 3)
      }
      expect(d.notes.join(' '), label).toMatch(/الفواصل/)
    }
  })

  it('refuses with a clear Arabic instruction when the pieces cannot be cut or assembled', () => {
    const err = (v: Record<string, number>, t = 3.2) => generate(tpl, v, { ...S0, t }).errors.join(' | ')
    expect(err({ a: 40 }, 6)).toMatch(/شقّ اللافتة|ضلع/)
    expect(err({ a: 40, topper: 0 }, 6)).toBe('')
    expect(err({ h: 12 })).toMatch(/ارتفاع المكعّب/)
    expect(err({ lipH: 5 })).toMatch(/الشفة/)
    expect(err({ trayH: 10 }, 4)).toMatch(/الصينية/)
    expect(err({ div: 1 })).toMatch(/المسافة بين المكعّبات.*4\.5/)
    expect(err({ div: 1, gapC: 6 })).toBe('')
    expect(err({ div: 1, gapC: 6, trayH: 8 }, 2.7)).toMatch(/الصينية/)
    expect(err({ tm: 0.5 })).toMatch(/اللافتة/)
    // one cube and dividers on: nothing to divide, a warning only
    const d = generate(tpl, { div: 1, rows: 1, cols: 1 }, S0)
    expect(d.errors).toEqual([])
    expect(d.warnings.join()).toMatch(/فواصل/)
    expect(d.panels.some(p => p.id.startsWith('div'))).toBe(false)
  })

  it('a cube height of 0 means a true cube, a badge sheet of its own thickness sets the slot, n multiplies every count', () => {
    const d = generate(tpl, { h: 0, a: 70 }, S0)
    expect(by(d, 'cube-front').h).toBeCloseTo(70, 3)
    const d2 = generate(tpl, { h: 50, a: 70 }, S0)
    expect(by(d2, 'cube-front').h).toBeCloseTo(50, 3)
    expect(by(d2, 'cube-bottom').h).toBeCloseTo(70, 3)
    const d3 = generate(tpl, { tm: 2 }, S0)
    expect(box(holesOf(by(d3, 'lid'))[0]).h).toBeCloseTo(2.2, 3)
    expect(d3.notes.join(' ')).toMatch(/2 مم للافتات/)
    const d4 = generate(tpl, { n: 3, rows: 1, cols: 2 }, S0)
    expect(by(d4, 'cube-bottom').count).toBe(6)
    expect(by(d4, 'tray-bottom').count).toBe(3)
    expect(by(d4, 'tray-side').count).toBe(6)
    expect(by(d4, 'lip-side').count).toBe(12)
    const d5 = generate(tpl, { topper: 0 }, S0)
    expect(d5.panels.some(p => p.id === 'topper')).toBe(false)
    expect(holesOf(by(d5, 'lid')).length).toBe(0)
  })

  it('robustness grid: every thickness, kerf and parameter extreme either refuses with an error or cuts sound geometry', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    // the dividers only fit with a wider gap: their extremes once more with room for them
    variants.push({ div: 1, gapC: 8 }, { div: 1, gapC: 8, rows: 4, cols: 6 }, { div: 1, gapC: 15, a: 150 }, { style: 2, tw: 80 }, { style: 3, tw: 16 }, { style: 3, tw: 80, a: 150 })
    let runs = 0, refused = 0
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const kerf of [0, 0.2]) for (const v of variants) {
      runs++
      let d
      try { d = generate(tpl, v, { ...DEFAULT_SETTINGS, t, kerf }) } catch (e) { throw new Error(`${JSON.stringify(v)} t=${t} kerf=${kerf} threw: ${(e as Error).message}`) }
      for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y), `${pn.id} non-finite`).toBe(true)
      if (d.errors.length) { refused++; continue }
      const label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      for (const pn of d.panels) {
        expect(pn.w, `${label} ${pn.id} width`).toBeGreaterThan(0)
        const closed = cut(pn), outers = closed.filter(l => signedArea(l as never) > 0)
        expect(outers.length, `${label} ${pn.id} outer loops`).toBe(1)
        const outer = samplePoly(outers[0] as never, 15)
        expect(selfIntersects(outer), `${label} ${pn.id} self-intersects`).toBe(false)
        const hs = closed.filter(l => signedArea(l as never) < 0).map(h => ({ p: samplePoly(h as never, 20), b: bbox([h as never]) }))
        for (const h of hs) {
          expect(polysOverlap(h.p, outer) && !pointIn(h.p[0], outer), `${label} ${pn.id} hole outside`).toBe(false)
          for (const q of h.p) expect(pointIn(q, outer), `${label} ${pn.id} hole vertex outside`).toBe(true)
          expect(polyDistance(h.p, outer), `${label} ${pn.id} hole too close to the edge`).toBeGreaterThan(0.8 - 1e-9)
        }
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
    expect(runs).toBeGreaterThan(300)
    expect(refused).toBeLessThan(runs / 3)
  })
})

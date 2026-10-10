import { describe, it, expect } from 'vitest'
import { GIFT_BAGS, GIFTBAG_GEOM } from './giftbag'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, bbox } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, polysOverlap, polyDistance, selfIntersects } from './testutil'

const tpl = GIFT_BAGS[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
type L = { closed: boolean; layer?: string; pts: { x: number; y: number; b?: number }[] }
type Pn = { id: string; w: number; h: number; count: number; loops: L[] }
const holesOf = (pn: Pn) => pn.loops.filter(l => l.closed && l.layer !== 'engrave' && signedArea(l as never) < 0)
const outerOf = (pn: Pn) => pn.loops.find(l => l.closed && l.layer !== 'engrave' && signedArea(l as never) > 0)!
const handHole = (pn: Pn, p: Record<string, number>) => holesOf(pn).find(h => { const b = bbox([h as never]); return Math.abs(b.maxX - b.minX - p.hand) < 0.01 && b.maxY - b.minY < 31 })!
const get = (d: { panels: Pn[] }, id: string) => d.panels.find(x => x.id === id)!

/** the gridsuite's soundness checks on one design */
function expectSound(d: { panels: Pn[]; layout: { w: number } }, label: string) {
  for (const pn of d.panels) {
    expect(pn.w, `${label} ${pn.id} width`).toBeGreaterThan(0)
    const closed = pn.loops.filter(l => l.closed && l.layer !== 'engrave')
    const outers = closed.filter(l => signedArea(l as never) > 0)
    expect(outers.length, `${label} ${pn.id} outer loops`).toBe(1)
    const outer = samplePoly(outers[0] as never, 15)
    expect(selfIntersects(outer), `${label} ${pn.id} self-intersects`).toBe(false)
    const hs = closed.filter(l => signedArea(l as never) < 0).map(h => ({ p: samplePoly(h as never, 20), b: bbox([h as never]) }))
    for (const h of hs) {
      expect(polysOverlap(h.p, outer) && !pointIn(h.p[0], outer), `${label} ${pn.id} hole outside`).toBe(false)
      for (const q of h.p) expect(pointIn(q, outer), `${label} ${pn.id} hole vertex outside`).toBe(true)
      expect(polyDistance(h.p, outer), `${label} ${pn.id} hole too close to the edge`).toBeGreaterThan(0.8 - 1e-9)
      expect(selfIntersects(h.p), `${label} ${pn.id} hole self-intersects`).toBe(false)
    }
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i].b, b = hs[j].b
      if (a.minX > b.maxX + 1 || b.minX > a.maxX + 1 || a.minY > b.maxY + 1 || b.minY > a.maxY + 1) continue
      expect(polyDistance(hs[i].p, hs[j].p), `${label} ${pn.id} holes too close`).toBeGreaterThan(0.8 - 1e-9)
    }
    for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; expect(Math.hypot(q.x - outer[i].x, q.y - outer[i].y), `${label} ${pn.id} zero-length`).toBeGreaterThan(1e-6) }
    for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y), `${label} ${pn.id} non-finite`).toBe(true)
  }
}

describe('the handled gift box', () => {
  it('builds at its defaults on every common sheet: bottom, two sides, and the front and back rising through the hinge band into the handles', () => {
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const kerf of [0, 0.2]) {
      const d = generate(tpl, {}, { ...S0, t, kerf }), label = `t=${t} kerf=${kerf}`
      expect(d.errors, label).toEqual([])
      expect(d.panels.map(p => p.id).sort(), label).toEqual(['back', 'bottom', 'front', 'side'])
      expect(get(d, 'side').count, label).toBe(2)
      const p = tpl.defaults
      for (const id of ['front', 'back']) {
        const pn = get(d, id)
        expect(pn.h, `${label} ${id} height`).toBeCloseTo(p.hh + p.band + p.H + (kerf ? kerf : 0), 1)
        // the hinge: one open cut per row segment, all inside the band
        const open = pn.loops.filter(l => !l.closed && l.layer !== 'engrave')
        const rows = new Set(open.map(l => Math.round(l.pts[0].y * 100)))
        expect(rows.size, `${label} ${id} hinge rows`).toBe(Math.floor(p.band / p.pitch))
        for (const l of open) for (const q of l.pts) { expect(q.y, `${label} ${id} hinge row`).toBeGreaterThan(p.hh); expect(q.y, `${label} ${id} hinge row`).toBeLessThan(p.hh + p.band) }
      }
      expect(get(d, 'front').loops.filter(l => l.layer === 'engrave').length, label).toBeGreaterThan(10)
      expect(get(d, 'back').loops.filter(l => l.layer === 'engrave').length, label).toBe(0)
      expect(get(d, 'bottom').loops.length, label).toBe(1)
      expect(toDXF(d.layout).includes('NaN'), label).toBe(false)
    }
  })

  it('the handle: a hand hole of the length asked with 12 mm of wood above it and round its ends; finger joints only on the body below the band', () => {
    for (const t of [2.7, 3.2, 6]) for (const v of [{}, { W: 120 }, { hand: 110 }, { hh: 80, ph: 20 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      for (const id of ['front', 'back']) {
        const pn = get(d, id), hole = handHole(pn, p), outer = outerOf(pn)
        expect(hole, `${label} ${id} hand hole`).toBeTruthy()
        const b = bbox([hole as never])
        expect(b.minY, `${label} ${id} wood above the hole`).toBeGreaterThanOrEqual(GIFTBAG_GEOM.HAND_WEB - 1e-6)
        expect(polyDistance(samplePoly(hole as never, 5), samplePoly(outer as never, 5)), `${label} ${id} wood round the hole`).toBeGreaterThan(GIFTBAG_GEOM.HAND_WEB - 0.1)
        expect(Math.abs((b.minX + b.maxX) / 2 - p.W / 2), `${label} ${id} hole centred`).toBeLessThan(1e-6)
        // the outline: notches (x = t or W - t) only in the body, the handle's sides straight and its top corners round
        const notch = outer.pts.filter(q => Math.abs(q.x - t) < 1e-6 || Math.abs(q.x - p.W + t) < 1e-6)
        expect(notch.length, `${label} ${id} joint notches`).toBeGreaterThan(4)
        for (const q of notch) expect(q.y, `${label} ${id} notch in the body`).toBeGreaterThanOrEqual(p.hh + p.band - 1e-6)
        expect(outer.pts.some(q => q.b && q.y < 30), `${label} ${id} round top corners`).toBe(true)
      }
      // the sides: as tall as the body, jointed on three edges, flat on top
      const side = get(d, 'side')
      expect(side.h, label).toBeCloseTo(p.H, 6)
      expect(side.w, label).toBeCloseTo(p.D, 6)
      expect(outerOf(side).pts.filter(q => Math.abs(q.y) < 1e-6).length, `${label} flat top`).toBe(2)
    }
  })

  it('fretwork on every wall and handle with every pattern: holes inside the solid margins, webs never under 2 mm', () => {
    for (let pattern = 1; pattern <= 7; pattern++) for (const t of [3, 6]) {
      const p: Record<string, number> = { ...tpl.defaults, pattern }, label = `pattern=${pattern} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      for (const pn of d.panels.filter(x => x.id !== 'bottom')) {
        const hs = holesOf(pn).filter(h => h !== handHole(pn, p))
        expect(hs.length, `${label} ${pn.id} has fret`).toBeGreaterThanOrEqual(2)
        const outer = samplePoly(outerOf(pn) as never, 10), sampled = hs.map(h => ({ p: samplePoly(h as never, 10), b: bbox([h as never]) }))
        for (let i = 0; i < sampled.length; i++) {
          expect(selfIntersects(samplePoly(hs[i] as never, 3)), `${label} ${pn.id} hole ${i} self-intersects`).toBe(false)
          expect(polyDistance(sampled[i].p, outer), `${label} ${pn.id} hole ${i} margin`).toBeGreaterThan(t + 2 - 0.05)
          for (let j = i + 1; j < sampled.length; j++) {
            const a = sampled[i].b, b = sampled[j].b
            if (a.minX > b.maxX + 3 || b.minX > a.maxX + 3 || a.minY > b.maxY + 3 || b.minY > a.maxY + 3) continue
            expect(polyDistance(sampled[i].p, sampled[j].p), `${label} ${pn.id} web ${i}-${j}`).toBeGreaterThan(2 - 0.05)
          }
        }
        // nothing cut inside the hinge band, nothing in the wood round the hand hole
        if (pn.id !== 'side') for (const h of sampled) for (const q of h.p) {
          expect(q.y < p.hh - 3 || q.y > p.hh + p.band + 3, `${label} ${pn.id} hole in the band`).toBe(true)
        }
      }
    }
  })

  it('the plaque: a solid rounded rectangle with a double engraved outline and scallops, the fret clipped round it; the back carries the full fret', () => {
    for (const t of [2.7, 3.2]) for (const pattern of [1, 2, 3, 4, 5, 6, 7]) {
      const p: Record<string, number> = { ...tpl.defaults, pattern }, label = `pattern=${pattern} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const front = get(d, 'front'), back = get(d, 'back')
      const eng = front.loops.filter(l => l.layer === 'engrave')
      const outlines = eng.filter(l => l.closed), scallops = eng.filter(l => !l.closed)
      expect(outlines.length, label).toBe(2)
      expect(scallops.length, label).toBeGreaterThan(20)
      const ob = bbox([outlines[0] as never])
      expect(ob.maxX - ob.minX, label).toBeCloseTo(p.pw, 3)
      expect(ob.maxY - ob.minY, label).toBeCloseTo(p.ph, 3)
      expect((ob.minX + ob.maxX) / 2, `${label} centred`).toBeCloseTo(p.W / 2, 3)
      // every scallop hangs just outside the outer outline, and no cut comes nearer the outline than the scallops plus clear wood
      for (const s of scallops) for (const q of samplePoly({ ...s, closed: true } as never, 10)) {
        expect(q.x > ob.minX - GIFTBAG_GEOM.SCALLOP - 0.01 && q.x < ob.maxX + GIFTBAG_GEOM.SCALLOP + 0.01 && q.y > ob.minY - GIFTBAG_GEOM.SCALLOP - 0.01 && q.y < ob.maxY + GIFTBAG_GEOM.SCALLOP + 0.01, `${label} scallop near the frame`).toBe(true)
      }
      const zone = GIFTBAG_GEOM.roundedRectPoly(ob.minX - GIFTBAG_GEOM.SCALLOP - 2.5, ob.minY - GIFTBAG_GEOM.SCALLOP - 2.5, p.pw + 2 * (GIFTBAG_GEOM.SCALLOP + 2.5), p.ph + 2 * (GIFTBAG_GEOM.SCALLOP + 2.5), 14.5)
      const shrunk = GIFTBAG_GEOM.roundedRectPoly(ob.minX - GIFTBAG_GEOM.SCALLOP - 2.4, ob.minY - GIFTBAG_GEOM.SCALLOP - 2.4, p.pw + 2 * (GIFTBAG_GEOM.SCALLOP + 2.4), p.ph + 2 * (GIFTBAG_GEOM.SCALLOP + 2.4), 14.4)
      let clipped = 0
      for (const h of holesOf(front)) {
        const pts = samplePoly(h as never, 5)
        for (const q of pts) expect(pointIn(q, shrunk), `${label} cut inside the plaque zone`).toBe(false)
        if (pts.some(q => polyDistance([q, q], zone) < 0.05)) clipped++
      }
      // holes meeting the zone are clipped round it, or (small ones inside it) dropped
      expect(clipped > 2 || holesOf(front).length < holesOf(back).length, `${label} holes clipped round the plaque`).toBe(true)
      const area = (pn: Pn) => holesOf(pn).reduce((s, h) => s + Math.abs(signedArea(h as never)), 0)
      expect(area(front), `${label} the plaque takes fret away`).toBeLessThan(area(back) - 1000)
    }
    const off = generate(tpl, { plaque: 0 }, S0)
    expect(off.errors).toEqual([])
    expect(get(off, 'front').loops.filter(l => l.layer === 'engrave').length).toBe(0)
    expect(holesOf(get(off, 'front')).length).toBe(holesOf(get(off, 'back')).length)
  })

  it('the hinge: the lean each handle takes to meet the other is told, and bends on a gentle radius', () => {
    const d = generate(tpl, {}, S0)
    const m = d.notes.join(' ').match(/يميل نحو (\d+)°/)
    expect(m).toBeTruthy()
    const deg = Number(m![1])
    expect(deg).toBeGreaterThanOrEqual(15)
    expect(deg).toBeLessThanOrEqual(35)
    expect(d.warnings).toEqual([])
    // a deep box with a short handle: the handles cannot meet, which is said
    expect(generate(tpl, { D: 300, hh: 60, ph: 15 }, S0).warnings.join()).toMatch(/لا يلتقيان|يميل/)
  })

  it('says what to change: a hand hole too long, a plaque that does not fit, a pattern too big for the wall, a band too short for its rows', () => {
    const err = (v: Record<string, number>) => generate(tpl, v, S0).errors.join(' ')
    expect(err({ hand: 200 })).toMatch(/فتحة اليد/)
    expect(err({ hand: 135 })).toMatch(/فتحة اليد/)
    expect(err({ pw: 200 })).toMatch(/لوحة/)
    expect(err({ ph: 150 })).toMatch(/لوحة/)
    expect(err({ cell: 40, D: 50, H: 60, W: 110, hand: 60 })).toMatch(/الزخرفة/)
    expect(err({ band: 10, pitch: 6 })).toMatch(/شريط المفصل/)
    expect(err({ seg: 80, bridge: 10, W: 90, hand: 50 })).toMatch(/قصّة المفصل/)
    expect(err({ hh: 60 })).toMatch(/لوحة|المقبض/)
    // every error names a number to go to
    for (const v of [{ hand: 200 }, { pw: 200 }, { ph: 150 }, { cell: 40, D: 50, H: 60, W: 110, hand: 60 }, { band: 10, pitch: 6 }] as Record<string, number>[]) for (const e of generate(tpl, v, S0).errors) expect(e, JSON.stringify(v)).toMatch(/\d/)
  })

  it('the clipper: a slot through the plaque comes out as two pieces, a circle beside it is trimmed, one inside it is dropped', () => {
    const zone = GIFTBAG_GEOM.roundedRectPoly(40, 40, 60, 40, 8)
    const slot = [{ x: 60, y: 10 }, { x: 70, y: 10 }, { x: 70, y: 110 }, { x: 60, y: 110 }]
    const two = GIFTBAG_GEOM.subtractConvex(slot, zone)!
    expect(two.length).toBe(2)
    for (const pc of two) { expect(GIFTBAG_GEOM.areaOf(pc)).toBeGreaterThan(0); expect(selfIntersects(pc)).toBe(false); for (const q of pc) expect(pointIn(q, zone) && polyDistance([q, q], zone) > 0.01).toBe(false) }
    expect(two.reduce((s, pc) => s + GIFTBAG_GEOM.areaOf(pc), 0)).toBeCloseTo(10 * 100 - 10 * 40, 1)
    const circ = (cx: number, cy: number, r: number) => Array.from({ length: 72 }, (_, k) => ({ x: cx + r * Math.cos((k * Math.PI) / 36), y: cy + r * Math.sin((k * Math.PI) / 36) }))
    const trimmed = GIFTBAG_GEOM.subtractConvex(circ(40, 60, 10), zone)!
    expect(trimmed.length).toBe(1)
    expect(Math.abs(GIFTBAG_GEOM.areaOf(trimmed[0]))).toBeCloseTo((Math.PI * 100) / 2, 0)
    expect(GIFTBAG_GEOM.subtractConvex(circ(70, 60, 10), zone)).toEqual([])
    expect(GIFTBAG_GEOM.subtractConvex(circ(150, 150, 10), zone)!.length).toBe(1)
    // the plaque inside a huge hole cannot be kept (it would fall out): the hole goes
    expect(GIFTBAG_GEOM.subtractConvex(circ(70, 60, 100), zone)).toEqual([])
  })

  it('robustness grid: thickness × kerf × every parameter at its ends builds sound geometry or refuses with an error', () => {
    const extras = tpl.params.filter(d => !['W', 'D', 'H'].includes(d.key))
    const variants: Record<string, number>[] = [{}]
    for (const def of extras) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    let runs = 0, refused = 0
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const kerf of [0, 0.2]) for (const v of variants) {
      const label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      let d
      try { d = generate(tpl, v, { ...DEFAULT_SETTINGS, t, kerf }) } catch (e) { throw new Error(`${label} threw: ${(e as Error).message}`) }
      runs++
      if (d.errors.length) { refused++; continue }
      expectSound(d, label)
      expect(toDXF(d.layout).includes('NaN'), label).toBe(false)
    }
    expect(runs).toBeGreaterThanOrEqual(300)
    expect(refused).toBeLessThan(runs / 2)
  })

  it('robustness grid: the common suite\'s box sizes, fingers and inner mode', () => {
    const boxes = [[60, 50, 30], [120, 80, 50], [300, 200, 120]]
    let runs = 0, refused = 0
    for (const t of [2, 6]) for (const kerf of [0, 0.2]) for (const finger of [0, 12]) for (const [W, D, H] of boxes) for (const inner of [false, true]) {
      const label = `${W}x${D}x${H} t=${t} kerf=${kerf} finger=${finger} inner=${inner}`
      const d = generate(tpl, { W, D, H }, { ...DEFAULT_SETTINGS, t, kerf, finger, inner })
      runs++
      if (d.errors.length) { refused++; continue }
      expectSound(d, label)
    }
    expect(runs).toBe(48)
    expect(refused).toBeLessThan(runs)
  })
})

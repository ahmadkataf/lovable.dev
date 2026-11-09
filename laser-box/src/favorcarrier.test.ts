import { describe, it, expect } from 'vitest'
import { FAVOR_CARRIERS, carrierGeom, CARRIER } from './favorcarrier'
import { generate, DEFAULT_SETTINGS, Design } from './generate'
import { signedArea, bbox, Loop } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, polyDistance, selfIntersects, materialAt, offSheet } from './testutil'

const tpl = FAVOR_CARRIERS[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
const THICK = [2, 2.7, 3, 3.2, 4, 5, 6]
type Pn = Design['panels'][number]
type Iv = [number, number]
const isCut = (l: Loop) => l.closed && l.layer !== 'engrave'
const outerOf = (pn: Pn) => pn.loops.find(l => isCut(l) && signedArea(l) > 0)!
const holesOf = (pn: Pn) => pn.loops.filter(l => isCut(l) && signedArea(l) < 0)
const get = (d: Design, id: string) => d.panels.find(x => x.id === id)!
const build = (v: Record<string, number>, s: Partial<typeof DEFAULT_SETTINGS> = {}) => generate(tpl, v, { ...S0, ...s })
/** the material of an outline along the vertical line x = X, or along the horizontal line y = Y */
const col = (l: Loop, X: number) => materialAt(l, X)
const row = (l: Loop, Y: number) => materialAt({ ...l, pts: l.pts.map(q => ({ x: q.y, y: q.x, b: q.b ? -q.b : q.b })) }, Y)
/** the gaps between material intervals, inside the first and last */
const gapsOf = (iv: Iv[]): Iv[] => iv.slice(1).map((v, i) => [iv[i][1], v[0]])
const sorted = (iv: Iv[]) => [...iv].sort((a, b) => a[0] - b[0])
const expectIv = (got: Iv[], want: Iv[], label: string, eps = 2e-3) => {
  expect(got.length, `${label}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`).toBe(want.length)
  sorted(got).forEach((g, i) => { const w = sorted(want)[i]; expect(Math.abs(g[0] - w[0]) < eps && Math.abs(g[1] - w[1]) < eps, `${label} ${i}: ${JSON.stringify(g)} vs ${JSON.stringify(w)}`).toBe(true) })
}

/**
 * Everything wrong with a built design, as messages (empty when sound): one outer loop per piece that does not cross
 * itself, no zero-length edge, no non-finite number, every hole inside its piece at least `margin` (less the kerf)
 * from its outline and from every other hole; with `layout`, every piece on its sheet and a clean DXF (the nesting is
 * the slow part, so the sweep checks it at one thickness).
 */
function faults(d: Design, kerf: number, layout = true, margin = 3): string[] {
  const out: string[] = []
  const fail = (m: string) => { if (out.length < 8) out.push(m) }
  for (const pn of d.panels) {
    for (const l of pn.loops) for (let i = 0; i < l.pts.length; i++) {
      const a = l.pts[i], b = l.pts[(i + 1) % l.pts.length]
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || (a.b !== undefined && !Number.isFinite(a.b))) fail(`${pn.id} non-finite`)
      if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) fail(`${pn.id} zero-length edge`)
    }
    const outers = pn.loops.filter(l => isCut(l) && signedArea(l) > 0)
    if (outers.length !== 1) { fail(`${pn.id} has ${outers.length} outer loops`); continue }
    const outer = samplePoly(outers[0], 5)
    if (selfIntersects(outer)) fail(`${pn.id} outline crosses itself`)
    const hs = holesOf(pn).map(h => samplePoly(h, 5))
    for (const h of hs) {
      if (selfIntersects(h)) fail(`${pn.id} hole crosses itself`)
      if (!h.every(q => pointIn(q, outer))) fail(`${pn.id} hole outside`)
      const e = polyDistance(h, outer)
      if (e < margin - kerf - 1e-6) fail(`${pn.id} hole ${e.toFixed(2)} mm from the edge`)
    }
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
      const w = polyDistance(hs[i], hs[j])
      if (w < margin - kerf - 1e-6) fail(`${pn.id} holes ${w.toFixed(2)} mm apart`)
    }
    if (pn.loops.some(l => !isCut(l))) fail(`${pn.id} has open or engraved lines`)
  }
  if (layout) {
    const off = offSheet(d.layout)
    if (off.length) fail(`off the sheet: ${off.join(', ')}`)
    const dxf = toDXF(d.layout)
    if (dxf.includes('NaN') || dxf.includes('undefined')) fail('dxf')
  }
  return out
}

/** A side's drawing back in box coordinates: y the depth from the front, z up from the base's top. */
function sideFrame(pn: Pn, mirror: boolean, D: number, t: number) {
  const zOf = (Y: number) => pn.h - t - Y, Yof = (z: number) => pn.h - t - z
  // the right side is drawn with the front on the left: its front-bottom corner is the leftmost point at z = 0
  const X0 = Math.min(...outerOf(pn).pts.filter(q => Math.abs(zOf(q.y)) < 1e-6).map(q => q.x))
  const yOf = (X: number) => (mirror ? D - X : X - X0)
  return { zOf, Yof, yOf, Xof: (y: number) => (mirror ? D - y : y + X0) }
}

/** sizes worth checking every joint at: the delivered box, a small one, a tall steep one, a long shallow one */
const SIZES: Record<string, number>[] = [{}, { W: 160, D: 90, H: 85, Hf: 57.5, lip: 17.5 }, { W: 220, D: 120, H: 320, Hf: 110, lip: 30, hand: 90 }, { W: 600, D: 300, H: 140, Hf: 120, lip: 50, hand: 160, fit: 0.3 }, { fit: 0 }]

describe('the acrylic favours carrier with a sloping top', () => {
  it('builds at its defaults on every common sheet: base, two sides, back wall, lip, top and the plate under it, every piece sound', () => {
    for (const t of THICK) for (const kerf of [0, 0.2]) {
      const d = build({}, { t, kerf }), label = `t=${t} kerf=${kerf}`
      expect(d.errors, label).toEqual([])
      if (t >= 2.5) expect(d.warnings, label).toEqual([])
      else expect(d.warnings.join(' '), label).toMatch(/3 مم أو أسمك/)
      expect(d.panels.map(x => x.id), label).toEqual(['base', 'sideR', 'sideL', 'back', 'lip', 'top', 'plate'])
      expect(d.panels.every(x => x.count === 1 && !x.material), label).toBe(true)
      expect(d.pieceCount, label).toBe(7)
      expect(faults(d, kerf), label).toEqual([])
      expect(holesOf(get(d, 'base')).length, `${label} base slots`).toBe(9)
      for (const id of ['sideR', 'sideL']) expect(holesOf(get(d, id)).length, `${label} ${id} slots`).toBe(3)
      expect(holesOf(get(d, 'top')).length, `${label} hand slot`).toBe(1)
      expect(holesOf(get(d, 'plate')).length, `${label} plate's hand slot`).toBe(1)
      expect(holesOf(get(d, 'back')).length + holesOf(get(d, 'lip')).length, label).toBe(0)
    }
  })

  it('has the delivered box\'s sizes at its defaults: 32 × 18 cm, 16.5 high at the back and 10.5 at the front, a 7 cm opening over a 3.5 cm lip', () => {
    const t = 3, d = build({}, { t }), g = carrierGeom(tpl.defaults, t)
    // as favorbox.py reported them (box.json)
    expect(g.deg).toBeCloseTo(18.4, 1)
    expect(g.LS).toBeCloseTo(189.7, 1)
    expect(g.backH).toBe(162.23)
    expect([g.Lb, g.Db]).toEqual([330, 190])
    expect(g.open).toBe(70)
    const size = (id: string) => [get(d, id).w, get(d, id).h]
    expect(size('base')).toEqual([330, 190])
    expect(size('sideR')).toEqual([180, 168]) // H + the bottom tabs; the top tabs stay under the back corner
    expect(size('back')[0]).toBeCloseTo(320, 6)
    expect(size('back')[1]).toBeCloseTo(162.23 + 3, 6)
    expect(size('lip')).toEqual([320, 38])
    expect(size('top')[0]).toBe(320)
    expect(size('top')[1]).toBeCloseTo(189.737, 3)
    expect(size('plate')).toEqual([313.8, 70])
    // the joints of the delivered box: bottom tabs 30 wide, top tabs and wall end tabs 20, wall bottom tabs 40
    expect([g.twBase, g.twTop, g.twBack, g.twLip, g.twWall]).toEqual([30, 20, 20, 20, 40])
    // the base's corners rounded 4 mm, the top's and the plate's eased 1 mm
    const arcs = (id: string) => outerOf(get(d, id)).pts.filter(q => q.b).length
    expect(arcs('base')).toBe(4)
    expect(arcs('plate')).toBe(4)
    expect(arcs('top')).toBe(4 + 12) // and the mouths of the six slots at its ends
    expect(arcs('sideR') + arcs('back') + arcs('lip')).toBe(0)
    // the hand slot: 110 × 24, in the middle of the top and of the plate
    for (const id of ['top', 'plate']) {
      const pn = get(d, id), b = bbox(holesOf(pn))
      expect(b.maxX - b.minX, id).toBeCloseTo(110, 6)
      expect(b.maxY - b.minY, id).toBeCloseTo(24, 6)
      expect((b.minX + b.maxX) / 2, id).toBeCloseTo(pn.w / 2, 6)
      expect((b.minY + b.maxY) / 2, id).toBeCloseTo(pn.h / 2, 6)
    }
  })

  it('every size follows the parameters: the base 10 mm larger, the top as long as the slope, the walls between the sides', () => {
    for (const v of SIZES) for (const t of [2.7, 4, 6]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = build(v, { t }), g = carrierGeom(p, t)
      expect(d.errors, label).toEqual([])
      expect([get(d, 'base').w, get(d, 'base').h], label).toEqual([p.W + 10, p.D + 10])
      expect(get(d, 'top').w, label).toBeCloseTo(p.W, 6)
      expect(get(d, 'top').h, label).toBeCloseTo(Math.hypot(p.D, p.H - p.Hf), 3)
      for (const id of ['back', 'lip']) {
        const pn = get(d, id), o = outerOf(pn)
        expect(pn.w, `${label} ${id} with its end tabs`).toBeCloseTo(p.W, 6)
        expect(row(o, 0.5), `${label} ${id} between the sides`).toEqual([[t, round(p.W - t)]])
      }
      expect(get(d, 'lip').h, label).toBeCloseTo(p.lip + t, 6)
      expect(get(d, 'plate').w, label).toBeCloseTo(p.W - 2 * t - 0.2, 6)
      expect(get(d, 'plate').h, label).toBeCloseTo(Math.min(70, 2 * g.h2), 3)
      // the side: the trapezoid H at the back and Hf at the front, drawn as seen from outside
      const R = get(d, 'sideR'), f = sideFrame(R, false, p.D, t), o = outerOf(R)
      for (const [y, z] of [[p.D - 0.001, p.H], [0.001, p.Hf]]) {
        const iv = col(o, f.Xof(y))
        expect(iv.length, label).toBe(1)
        expect(f.zOf(iv[0][1]), `${label} bottom at y=${y}`).toBeCloseTo(0, 6)
        expect(f.zOf(iv[0][0]), `${label} height at y=${y}`).toBeCloseTo(z, 1)
      }
    }
  })

  it('every tab meets its slot: in the base, in the sides and at the ends of the top, the slot the tab plus the clearance', () => {
    for (const v of SIZES) for (const t of [2, 3, 4.5, 6]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = build(v, { t }), g = carrierGeom(p, t)
      expect(d.errors, label).toEqual([])
      const { W, D, Hf, fit } = p, M = CARRIER.inset, OV = CARRIER.overhang, h = fit / 2
      const base = get(d, 'base'), baseHoles = holesOf(base).map(l => bbox([l]))
      const slotsWhere = (pred: (b: ReturnType<typeof bbox>) => boolean) => baseHoles.filter(pred)
      // the sides' bottom tabs, in the base's slots under each side's thickness (the left side at x = 0)
      for (const [id, mirror, x0] of [['sideL', true, 0], ['sideR', false, W - t]] as const) {
        const pn = get(d, id), f = sideFrame(pn, mirror, D, t)
        const tabs = row(outerOf(pn), f.Yof(-t / 2)).map(([a, b]) => [f.yOf(a), f.yOf(b)].sort((u, w) => u - w) as Iv)
        expectIv(tabs, g.baseY.map(y => [y - g.twBase / 2, y + g.twBase / 2]), `${label} ${id} bottom tabs`)
        const slots = slotsWhere(b => Math.abs(b.minX - (OV + x0 - h)) < 1e-3)
        for (const b of slots) expect(b.maxX - b.minX, `${label} ${id} base slot width`).toBeCloseTo(t + fit, 3)
        expectIv(slots.map(b => [b.minY, b.maxY]), tabs.map(([a, b]) => [OV + a - h, OV + b + h]), `${label} ${id} base slots`)
      }
      // the back wall's and the lip's bottom tabs, in the base's slots under their thickness
      for (const [id, y0] of [['back', D - M - t], ['lip', M]] as const) {
        const pn = get(d, id), tabs = row(outerOf(pn), pn.h - t / 2)
        expect(tabs.length, `${label} ${id} bottom tabs`).toBe(id === 'back' ? 3 : 2)
        for (const [a, b] of tabs) expect(b - a, `${label} ${id} tab width`).toBeCloseTo(g.twWall, 2)
        const slots = slotsWhere(b => Math.abs(b.minY - (OV + y0 - h)) < 1e-3)
        for (const b of slots) expect(b.maxY - b.minY, `${label} ${id} base slot`).toBeCloseTo(t + fit, 3)
        expectIv(slots.map(b => [b.minX, b.maxX]), tabs.map(([a, b]) => [OV + a - h, OV + b + h]), `${label} ${id} base slots`)
      }
      expect(baseHoles.length, label).toBe(9)
      // the back wall's and the lip's end tabs, in the slots of both sides (z up from the base, y from the front)
      // (the columns at the ends carry only the end tabs: the bottom tabs start further in)
      for (const [id, n] of [['back', 2], ['lip', 1]] as const) {
        const wall = get(d, id), wo = outerOf(wall)
        expect(col(wo, t / 2).length, `${label} ${id} end tabs`).toBe(n)
        expect(col(wo, W - t / 2), `${label} ${id} end tabs at both ends`).toEqual(col(wo, t / 2))
      }
      for (const [id, mirror] of [['sideR', false], ['sideL', true]] as const) {
        const pn = get(d, id), f = sideFrame(pn, mirror, D, t)
        const slots = holesOf(pn).map(l => { const b = bbox([l]); const ys = [f.yOf(b.minX), f.yOf(b.maxX)].sort((u, w) => u - w); return { y: ys as Iv, z: [f.zOf(b.maxY), f.zOf(b.minY)] as Iv } })
        for (const [wid, y0] of [['back', D - M - t], ['lip', M]] as const) {
          const wall = get(d, wid), hw = wall.h - t
          const tabs = col(outerOf(wall), t / 2).map(([a, b]) => [hw - b, hw - a] as Iv).filter(([a]) => a > -1e-6)
          const mine = slots.filter(s => Math.abs(s.y[0] - (y0 - h)) < 1e-3)
          for (const s of mine) expect(s.y[1], `${label} ${id} ${wid} slot through the wall's thickness`).toBeCloseTo(y0 + t + h, 3)
          expectIv(mine.map(s => s.z), tabs.map(([a, b]) => [a - h, b + h]), `${label} ${id} slots for the ${wid}'s end tabs`)
        }
        expect(slots.length, label).toBe(3)
      }
      // the sides' top tabs: square to the slope, exactly t high (flush with the top's upper face), in the notches at the top's ends
      const { cs, sn } = g
      for (const [id, mirror] of [['sideR', false], ['sideL', true]] as const) {
        const pn = get(d, id), f = sideFrame(pn, mirror, D, t)
        const uv = outerOf(pn).pts.map(q => { const y = f.yOf(q.x), z = f.zOf(q.y); return { u: y * cs + (z - Hf) * sn, v: -y * sn + (z - Hf) * cs } })
        expect(Math.max(...uv.map(q => q.v)), `${label} ${id} tabs flush with the top`).toBeCloseTo(t, 2)
        const tops = uv.filter(q => Math.abs(q.v - t) < 1e-2).map(q => q.u).sort((a, b) => a - b)
        const tabs: Iv[] = []
        for (let i = 0; i + 1 < tops.length; i += 2) tabs.push([tops[i], tops[i + 1]])
        expectIv(tabs, g.topU.map(u => [u - g.twTop / 2, u + g.twTop / 2]), `${label} ${id} top tabs`)
        const top = outerOf(get(d, 'top')), X = Math.max(1.2, t - 0.3)
        for (const x of [X, W - X]) expectIv(gapsOf(col(top, x)), tabs.map(([a, b]) => [a - h, b + h]), `${label} notches at x=${round(x)}`)
        for (const u of g.topU) expect(row(top, u), `${label} notch depth`).toEqual([[round(t + h), round(W - t - h)]])
      }
    }
  })

  it('the two sides are mirror images of each other', () => {
    for (const v of SIZES) for (const t of [3, 6]) for (const kerf of [0, 0.2]) {
      const d = build(v, { t, kerf }), R = get(d, 'sideR'), L = get(d, 'sideL'), label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      expect(L.w, label).toBeCloseTo(R.w, 9)
      expect(L.h, label).toBeCloseTo(R.h, 9)
      const key = (l: Loop, mirror: boolean) => l.pts.map(q => `${round(mirror ? R.w - q.x : q.x)},${round(q.y)}`).sort().join(' ')
      const loops = (pn: Pn, mirror: boolean) => pn.loops.map(l => key(l, mirror)).sort()
      expect(loops(L, false), label).toEqual(loops(R, true))
      expect(loops(L, false), label).not.toEqual(loops(R, false))
    }
  })

  it('the back wall\'s top stays 0.1 mm under the sloping top, the plate under the top clears the back wall, the lip leaves the opening', () => {
    for (const v of SIZES) for (const t of THICK) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const res = tpl.build(p, { ...S0, t }), g = carrierGeom(p, t), d = build(v, { t })
      expect(res.errors, label).toEqual([])
      const M = CARRIER.inset, backH = get(d, 'back').h - t
      // the top's underside over the back wall's front face, where it is lowest over the wall
      const under = p.Hf + ((p.H - p.Hf) / p.D) * (p.D - M - t)
      expect(under - backH, `${label} gap over the back wall`).toBeGreaterThan(0.09)
      expect(under - backH, `${label} gap over the back wall`).toBeLessThan(0.11)
      // seen from the side (x forward, y up): the pieces never overlap, the plate keeps 1 mm off the back wall
      const sv = res.sideView!, piece = (id: string) => sv.pieces.find(q => q.id === id)!.pts
      const topUnder = (x: number) => p.Hf + ((p.H - p.Hf) / p.D) * (p.D - x) // the underside over x forward
      for (const q of piece('back')) expect(q.y, `${label} back wall under the top`).toBeLessThan(topUnder(q.x) - 0.09)
      for (const q of piece('plate')) expect(q.y, `${label} plate under the top`).toBeLessThan(topUnder(q.x) + 1e-3)
      expect(polyDistance(piece('plate'), piece('back')), `${label} plate clears the back wall`).toBeGreaterThan(1 - 1e-6)
      for (const q of piece('lip')) expect(q.y, label).toBeLessThan(topUnder(q.x) - CARRIER.openMin + 1e-6)
      // the top's front edge at Hf over the sides' front edge, its back edge at H over their back edge
      const top = piece('top')
      expect(top[0], label).toEqual({ x: p.D, y: p.Hf })
      expect(top[1].x, label).toBeCloseTo(0, 3)
      expect(top[1].y, label).toBeCloseTo(p.H, 3)
      expect(g.h2, label).toBeGreaterThanOrEqual(CARRIER.handW / 2 + 8)
    }
  })

  it('inner sizes: the length between the sides and the depth between the lip and the back wall', () => {
    const t = 3, d = build({ W: 300, D: 150 }, { t, inner: true })
    expect(d.errors).toEqual([])
    expect(get(d, 'base').w).toBe(300 + 2 * t + 10)
    expect(get(d, 'base').h).toBe(150 + 2 * (CARRIER.inset + t) + 10)
    expect(row(outerOf(get(d, 'back')), 0.5)).toEqual([[t, 300 + t]])
  })

  it('refuses what cannot be made: a top that does not slope down to the front, a small opening, a low lip, a shallow box, a long hand slot', () => {
    const errs = (v: Record<string, number>, t = 3) => build(v, { t }).errors.join(' | ')
    expect(errs({ H: 105 })).toMatch(/لا ينحدر/)
    expect(errs({ H: 90 })).toMatch(/لا ينحدر/)
    expect(errs({ lip: 66 })).toMatch(/الواجهة المفتوحة .* 39 مم/)
    expect(errs({ lip: 65 })).toBe('')
    expect(errs({ Hf: 74, lip: 35 })).toMatch(/الواجهة المفتوحة/)
    expect(errs({ lip: 13.5 })).toMatch(/الحافّة الأمامية .* واطئة/)
    expect(errs({ lip: 14 })).toBe('')
    expect(errs({ D: 64 })).toMatch(/العمق .* صغير.* 66 مم على الأقل/)
    expect(errs({ D: 66 })).toBe('')
    expect(errs({ D: 70, H: 90, Hf: 60, lip: 20 }, 6)).toMatch(/العمق .* صغير/)
    expect(errs({ D: 50, H: 110 })).toMatch(/قطعة التقوية/)
    expect(errs({ hand: 200, W: 225 })).toMatch(/فتحة الإيد .* أقصاها 199 مم/)
    expect(errs({ hand: 200, W: 226 })).toBe('')
    expect(errs({ W: 90, hand: 110 })).toMatch(/الطول .* لا يتّسع لفتحة الإيد .* 136 مم/)
    // a box refused for one reason still draws finite pieces
    for (const v of [{ H: 50 }, { lip: 10 }, { D: 80, H: 400, Hf: 30 }, { W: 120, D: 80, H: 50, Hf: 30, lip: 10, hand: 200 }] as Record<string, number>[]) {
      const d = build(v)
      expect(d.errors.length, JSON.stringify(v)).toBeGreaterThan(0)
      for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y), JSON.stringify(v)).toBe(true)
    }
  })

  it('across every thickness, kerf and the ends of every range: sound pieces with 3 mm round every slot, or an error', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    // and random boxes (seeded, the same every run)
    let s = 7
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    for (let i = 0; i < 40; i++) {
      const D = 80 + rnd() * 320, Hf = 50 + rnd() * 250
      variants.push({ W: Math.round(140 + rnd() * 600), D: Math.round(D), Hf: Math.round(Hf), H: Math.round(Hf + 5 + rnd() * 1.2 * D), lip: Math.round(14 + rnd() * (Hf - 54)), hand: Math.round(70 + rnd() * 80), fit: Math.round(rnd() * 10) / 20 })
    }
    let sound = 0, refused = 0
    for (const v of variants) for (const t of THICK) for (const kerf of [0, 0.2]) {
      const d = build(v, { t, kerf }), label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y), label).toBe(true)
      if (d.errors.length) { refused++; continue }
      sound++
      expect(faults(d, kerf, t === 3), label).toEqual([])
    }
    expect(sound).toBeGreaterThan(500)
    expect(refused).toBeGreaterThan(20)
  })

  it('the notes: the name in gold mirror added in RDWorks (no Arabic is cut by the app), the box glued with acrylic cement', () => {
    const d = build({})
    const all = d.notes.join(' ')
    expect(all).toMatch(/اسم المولود/)
    expect(all).toMatch(/مرآة ذهبي/)
    expect(all).toMatch(/RDWorks/)
    expect(all).toMatch(/لا يكتب العربية/)
    expect(all).toMatch(/غراء الأكريليك السائل/)
    expect(d.panels.some(pn => pn.loops.some(l => l.layer === 'engrave'))).toBe(false)
  })
})

function round(v: number) { return Math.round(v * 1000) / 1000 }

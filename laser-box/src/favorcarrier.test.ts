import { describe, it, expect } from 'vitest'
import { FAVOR_CARRIERS, carrierGeom, tentLean, CARRIER } from './favorcarrier'
import { generate, DEFAULT_SETTINGS, Design } from './generate'
import { signedArea, bbox, arcInfo, Loop } from './geom'
import { toDXF, toSVG } from './export'
import { samplePoly, pointIn, polyDistance, selfIntersects, materialAt, offSheet } from './testutil'

const tpl = FAVOR_CARRIERS[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
const THICK = [2, 2.7, 3, 3.2, 4, 5, 6]
type Pn = Design['panels'][number]
const isCut = (l: Loop) => l.closed && l.layer !== 'engrave'
const outerOf = (pn: Pn) => pn.loops.find(l => isCut(l) && signedArea(l) > 0)!
const holesOf = (pn: Pn) => pn.loops.filter(l => isCut(l) && signedArea(l) < 0)
const linesOf = (pn: Pn) => pn.loops.filter(l => l.layer === 'engrave')
const build = (v: Record<string, number>, s: Partial<typeof DEFAULT_SETTINGS> = {}) => generate(tpl, v, { ...S0, ...s })
/** the material of an outline along the vertical line x = X, or along the horizontal line y = Y (to 0.001 mm) */
const col = (l: Loop, X: number) => materialAt(l, X)
const row = (l: Loop, Y: number) => materialAt({ ...l, pts: l.pts.map(q => ({ x: q.y, y: q.x, b: q.b ? -q.b : q.b })) }, Y)
const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps
const D2R = Math.PI / 180

/**
 * The tent worked out here on its own, to check the design against: the lean by Newton's method (the walls' inside top
 * corners meet the middle less half the gap at the height H), and the neutral-axis method for a bend turning θ.
 */
function tent(p: Record<string, number>, t: number) {
  let b = 0.3
  for (let i = 0; i < 50; i++) b -= (p.H * Math.tan(b) + t * Math.cos(b) - (p.D - p.gap) / 2) / (p.H / Math.cos(b) ** 2 - t * Math.sin(b))
  const band = (th: number) => ({ BA: th * (p.ri + t / 2), SB: (p.ri + t) * Math.tan(th / 2) })
  const w = band(Math.PI / 2 + b), e = band(Math.PI / 2), S = p.H / Math.cos(b)
  return { b, BAw: w.BA, SBw: w.SB, BA: e.BA, SB: e.SB, S, sw: S - w.SB, he: p.He - e.SB, yIn: (z: number) => z * Math.tan(b) + t / Math.cos(b) }
}

/**
 * favortent.py at its own sizes (t = 3, ri = 2), as shapely gave them, in panel coordinates (x from the sheet's left,
 * y down from its top): the sheet, its area (the outline alone and less the two slots; shapely draws the arcs as
 * polygons, a little inside the true ones), the lean and the bends, the slots' centres and the four bend lines in the
 * order to bend them.
 */
const TENT = {
  flat: [380.99557461646503, 483.7699355058919], // it reported 381 × 483.8
  outerArea: 154679.53061630996,
  area: 150367.40479541424,
  lean: 0.4216199698653956, // 24.16°: the wall bend 114.16°, the inside angle 65.84°
  S: 175.35645913266055, BAw: 6.9734570383110235, SBw: 7.722474299503971,
  insideWidthAt50: 98.57243375035866,
  slots: [[190.49778730823252, 28.00000018098632], [190.49778730823252, 455.76993532491355]], // back, front
  lines: [
    [[32.497787308232525, 312.6492219726015], [348.49778730823255, 312.6492219726015]],
    [[32.497787308232525, 171.12071353329839], [348.49778730823255, 171.12071353329839]],
    [[42.74889373634146, 317.16249345344596], [42.74889373634146, 166.6074420524539]],
    [[338.2466808801236, 317.16249345344596], [338.2466808801236, 166.6074420524539]],
  ],
}

/**
 * Everything wrong with a built design, as messages (empty when sound): one piece whose outline does not cross itself,
 * no zero-length edge, no non-finite number, both slots inside the piece at least `margin` (less the kerf) from its
 * outline and from each other, the only other lines the four open bend lines on the engraving layer; with `layout`,
 * the piece on its sheet and a clean DXF (the nesting is the slow part, so the sweep checks it at one thickness).
 */
function faults(d: Design, kerf: number, layout = true, margin = 3): string[] {
  const out: string[] = []
  const fail = (m: string) => { if (out.length < 8) out.push(m) }
  for (const pn of d.panels) {
    for (const l of pn.loops) for (let i = 0; i < (l.closed ? l.pts.length : l.pts.length - 1); i++) {
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
    const other = pn.loops.filter(l => !isCut(l))
    if (other.length !== 4 || other.some(l => l.layer !== 'engrave' || l.closed || l.pts.length !== 2)) fail(`${pn.id} lines other than the four bend lines`)
  }
  if (layout) {
    const off = offSheet(d.layout)
    if (off.length) fail(`off the sheet: ${off.join(', ')}`)
    const dxf = toDXF(d.layout)
    if (dxf.includes('NaN') || dxf.includes('undefined')) fail('dxf')
  }
  return out
}

/**
 * sizes worth checking at: the delivered box, a small one, a big one with a big slot, a steep tall one, a low flat one
 * near the most lean, the tightest and the widest bend, the walls touching at the top
 */
const SIZES: Record<string, number>[] = [
  {}, { W: 150, D: 75, H: 80, He: 22.5, rc: 5 }, { W: 600, D: 300, H: 400, He: 100, hand: 160, handH: 35, handTop: 30, ri: 4, rc: 25 },
  { D: 70, H: 300 }, { H: 85, D: 160, He: 30 }, { ri: 0.5 }, { ri: 10, rc: 2 }, { gap: 0 },
]

describe('the acrylic favours box shaped like a tent, bent from one piece', () => {
  it('builds at its defaults on every common sheet: one piece, two hand slots and four bend lines, sound', () => {
    for (const t of THICK) for (const kerf of [0, 0.2]) {
      const d = build({}, { t, kerf }), label = `t=${t} kerf=${kerf}`
      expect(d.errors, label).toEqual([])
      if (t < 2.5) expect(d.warnings.join(' '), label).toMatch(/رقيق.*3 مم/)
      else if (t > 4) expect(d.warnings.join(' '), label).toMatch(/سميك.*الأنسب 3 مم/)
      else expect(d.warnings, label).toEqual([])
      expect(d.panels.map(x => x.id), label).toEqual(['box'])
      expect(d.panels[0].count, label).toBe(1)
      expect(d.panels[0].material, label).toBeUndefined()
      expect(d.pieceCount, label).toBe(1)
      expect(faults(d, kerf), label).toEqual([])
      expect(holesOf(d.panels[0]).length, label).toBe(2)
      expect(linesOf(d.panels[0]).length, label).toBe(4)
      // nothing slots together: no note about measuring the sheet for the joints
      expect(d.notes.join(' '), label).not.toMatch(/الشقوق والأصابع مقاسة/)
    }
  })

  it('is favortent.py\'s sheet at its sizes: 381 × 483.8 mm, the walls leaning 24.16° on 114.16° bends, the slots and the bend lines where it put them', () => {
    const d = build({}, { t: 3 }), pn = d.panels[0], o = outerOf(pn), g = carrierGeom(tpl.defaults, 3)
    expect(pn.w).toBeCloseTo(TENT.flat[0], 5)
    expect(pn.h).toBeCloseTo(TENT.flat[1], 5)
    expect([Math.round(pn.w * 10) / 10, Math.round(pn.h * 10) / 10]).toEqual([381, 483.8])
    expect([g.flatW, g.flatH]).toEqual([pn.w, pn.h])
    expect(g.lean).toBeCloseTo(TENT.lean, 12)
    expect([g.leanDeg, g.wallDeg, g.insideDeg].map(v => Math.round(v * 100) / 100)).toEqual([24.16, 114.16, 65.84])
    expect(g.S).toBeCloseTo(TENT.S, 9)
    expect(g.BAw).toBeCloseTo(TENT.BAw, 9)
    expect(g.SBw).toBeCloseTo(TENT.SBw, 9)
    expect(150 - 2 * g.yIn(50)).toBeCloseTo(TENT.insideWidthAt50, 9)
    // the same outline: shapely's polygonal arcs (16 to a quarter circle on the walls' corners) cut a little inside
    const outerA = signedArea(o), netA = outerA + holesOf(pn).reduce((s, h) => s + signedArea(h), 0)
    expect(outerA - TENT.outerArea).toBeGreaterThan(0)
    expect(outerA - TENT.outerArea).toBeLessThan(1.5)
    expect(Math.abs(netA - TENT.area)).toBeLessThan(1.5)
    // the slots 95 × 24 mm, the back one (top of the drawing) first
    const slots = holesOf(pn).map(h => bbox([h])).sort((a, b) => a.minY - b.minY)
    slots.forEach((b, i) => {
      expect(b.maxX - b.minX).toBeCloseTo(95, 9)
      expect(b.maxY - b.minY).toBeCloseTo(24, 9)
      expect(near((b.minX + b.maxX) / 2, TENT.slots[i][0]) && near((b.minY + b.maxY) / 2, TENT.slots[i][1]), JSON.stringify(b)).toBe(true)
    })
    // the bend lines 1 to 4, end to end as favortent.py drew them
    linesOf(pn).forEach((l, i) => l.pts.forEach((q, j) => expect(near(q.x, TENT.lines[i][j][0], 1e-5) && near(q.y, TENT.lines[i][j][1], 1e-5), `line ${i + 1}: ${JSON.stringify(q)}`).toBe(true)))
    // and they are labelled with their angles: the walls 114°, the lips 90°
    expect(pn.note).toMatch(/1 و2 للجدارين 114°، و3 و4 للجانبين 90°/)
  })

  it('the lean closes the walls on each other at the top: their inside top corners the gap apart, at the height H', () => {
    for (const v of SIZES) for (const t of [2, 3, 4.5, 6]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const b = tentLean(p.H, p.D, p.gap, t), T = tent(p, t)
      expect(b, label).toBeCloseTo(T.b, 10)
      expect(b * 180 / Math.PI, label).toBeLessThanOrEqual(CARRIER.leanMax)
      // folded up: the front wall's outside face rises from (y 0, z 0) leaning in by b, S long; its inside top corner
      const top = { y: T.S * Math.sin(b) + t * Math.cos(b), z: T.S * Math.cos(b) - t * Math.sin(b) }
      expect(T.S * Math.cos(b), `${label} the outside top corner at the height H`).toBeCloseTo(p.H, 9)
      expect(p.D - 2 * top.y, `${label} the gap between the inside top corners`).toBeCloseTo(p.gap, 9)
      // and the walls never cross lower down: the inside faces stay apart all the way up
      expect(p.D - 2 * T.yIn(top.z), label).toBeGreaterThan(p.gap - 1e-9)
      const g = carrierGeom(p, t)
      expect(g.wallDeg, label).toBeCloseTo(90 + b / D2R, 9)
      expect(g.insideDeg, label).toBeCloseTo(90 - b / D2R, 9)
    }
  })

  it('the flat sheet comes from the neutral-axis method: every leg beyond its band, the walls\' bands for 90° + lean, the lips\' for 90°', () => {
    for (const v of SIZES) for (const t of [2, 3, 4.5, 6]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = build(v, { t }), pn = d.panels[0], T = tent(p, t)
      expect(d.errors, label).toEqual([])
      expect(pn.w, label).toBeCloseTo(2 * T.he + 2 * T.BA + (p.W - 2 * T.SB), 6)
      expect(pn.h, label).toBeCloseTo(2 * T.sw + 2 * T.BAw + (p.D - 2 * T.SBw), 6)
      // across the middle: lip, band, base, band, lip in one strip; beside the slots, wall to wall in one strip
      const o = outerOf(pn)
      expect(row(o, pn.h / 2), `${label} across the middle`).toEqual([[0, round(pn.w)]])
      const beside = col(o, pn.w / 2 - p.hand / 2 - 2)
      expect(beside.length, label).toBe(1)
      expect(beside[0][0], label).toBeCloseTo(0, 2)
      expect(beside[0][1], label).toBeCloseTo(pn.h, 2)
    }
  })

  it('both hand slots the same, the same way down each wall and centred in the length: folded up they face each other and the hand goes through both', () => {
    for (const v of SIZES) for (const t of [2, 3, 4.5, 6]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const pn = build(v, { t }).panels[0], o = outerOf(pn), T = tent(p, t)
      const [back, front] = holesOf(pn).map(h => bbox([h])).sort((a, b) => a.minY - b.minY)
      // the walls run the full length: their left edge, below the rounded corners
      const fr = row(o, pn.h - p.rc - 1), br = row(o, p.rc + 1)
      expect(fr.length, label).toBe(1)
      expect(fr[0][1] - fr[0][0], `${label} the front's length`).toBeCloseTo(p.W, 2)
      expect(br, `${label} the back's length, in line with the front's`).toEqual(fr)
      const x0 = fr[0][0]
      expect(x0, label).toBeCloseTo(T.he + T.BA - T.SB, 2)
      for (const [name, s, fromTop] of [['front', front, pn.h - front.maxY], ['back', back, back.minY]] as const) {
        expect(s.maxX - s.minX, `${label} ${name}`).toBeCloseTo(p.hand, 9)
        expect(s.maxY - s.minY, `${label} ${name}`).toBeCloseTo(p.handH, 9)
        expect(s.minX - x0, `${label} ${name} slot from the wall's end`).toBeCloseTo((p.W - p.hand) / 2, 2)
        expect(fromTop, `${label} ${name} slot under the wall's top edge`).toBeCloseTo(p.handTop, 9)
      }
      // folded up: s along each wall from the base's outside edge, the front leaning in from y = 0, the back from y = D
      const sF = T.SBw + ((front.minY + front.maxY) / 2 - (pn.h - T.sw)), sB = T.SBw + (T.sw - (back.minY + back.maxY) / 2)
      expect(sF, label).toBeCloseTo(sB, 9)
      const F = { y: sF * Math.sin(T.b), z: sF * Math.cos(T.b) }, B = { y: p.D - sB * Math.sin(T.b), z: sB * Math.cos(T.b) }
      expect(F.z, `${label} both slots at the same height`).toBeCloseTo(B.z, 9)
      expect(F.y + B.y, `${label} facing each other across the middle`).toBeCloseTo(p.D, 9)
      expect(F.z, label).toBeCloseTo((p.H / Math.cos(T.b) - p.handTop - p.handH / 2) * Math.cos(T.b), 9)
      expect((front.minX + front.maxX) / 2, label).toBeCloseTo(pn.w / 2, 9)
      expect((back.minX + back.maxX) / 2, label).toBeCloseTo(pn.w / 2, 9)
    }
  })

  it('the low lips stand upright between the leaning walls\' inside faces, 0.2 mm clear of each all the way up', () => {
    for (const v of SIZES) for (const t of [2, 3, 4.5, 6]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const pn = build(v, { t }).panels[0], o = outerOf(pn), T = tent(p, t)
      const y0 = pn.h - T.sw - T.BAw // the sheet's y = 0 (the base's front band edge) on the panel, counted from the top
      // columns through the lips' flat part, clear of the rounded corners: X from the left lip's top edge, z up from the bottom
      const lo = p.rc / 2 + 0.6, hi = T.he - 1.8
      for (const X of hi > lo ? [lo, (lo + hi) / 2, hi] : [(lo + hi) / 2]) for (const [Xp, side] of [[X, 'left'], [pn.w - X, 'right']] as const) {
        const iv = col(o, Xp), z = T.SB + (T.he - X)
        expect(iv.length, `${label} ${side} X=${X}`).toBe(1)
        // folded up: y from the box's front edge (outside)
        const yA = y0 - iv[0][1] + T.SBw, yB = y0 - iv[0][0] + T.SBw
        expect(yA - T.yIn(z), `${label} ${side} lip clear of the front wall at z=${z}`).toBeCloseTo(CARRIER.clear, 2)
        expect(p.D - T.yIn(z) - yB, `${label} ${side} lip clear of the back wall at z=${z}`).toBeCloseTo(CARRIER.clear, 2)
      }
      // and stands He high outside: its flat part beyond the band is He − SB
      const lines = linesOf(pn)
      expect(lines[2].pts[0].x - T.BA / 2, `${label} the left lip's flat height`).toBeCloseTo(T.he, 6)
      expect(pn.w - lines[3].pts[0].x - T.BA / 2, `${label} the right lip's flat height`).toBeCloseTo(T.he, 6)
    }
  })

  it('the bend lines along the middle of each band, 1 front, 2 back, 3 left, 4 right, 8 mm past the sheet', () => {
    for (const v of SIZES) for (const t of [2, 3, 4.5, 6]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const pn = build(v, { t }).panels[0], o = outerOf(pn), T = tent(p, t)
      expect(linesOf(pn).every(m => !m.closed && m.layer === 'engrave'), label).toBe(true)
      const lines = linesOf(pn).map(l => l.pts), [l1, l2, l3, l4] = lines
      // lines 1 and 2 across the sheet, 3 and 4 down it
      expect(l1[0].y === l1[1].y && l2[0].y === l2[1].y && l3[0].x === l3[1].x && l4[0].x === l4[1].x, label).toBe(true)
      // 1 is the front wall's (below the base in the drawing), 2 the back's, 3 the left lip's, 4 the right lip's
      expect(l1[0].y, label).toBeCloseTo(pn.h - T.sw - T.BAw / 2, 6)
      expect(l2[0].y, label).toBeCloseTo(T.sw + T.BAw / 2, 6)
      expect(l3[0].x, label).toBeCloseTo(T.he + T.BA / 2, 6)
      expect(l4[0].x, label).toBeCloseTo(pn.w - T.he - T.BA / 2, 6)
      // the bands as the outline shows them: down line 3, the reliefs between the walls and the left band are as long
      // as the walls' band, and lines 1 and 2 cross them in the middle
      const down = col(o, l3[0].x)
      expect(down.length, label).toBe(3)
      const gapB = [down[0][1], down[1][0]], gapF = [down[1][1], down[2][0]]
      expect(gapB[1] - gapB[0], `${label} back band`).toBeCloseTo(T.BAw, 2)
      expect(gapF[1] - gapF[0], `${label} front band`).toBeCloseTo(T.BAw, 2)
      expect(l2[0].y, label).toBeCloseTo((gapB[0] + gapB[1]) / 2, 2)
      expect(l1[0].y, label).toBeCloseTo((gapF[0] + gapF[1]) / 2, 2)
      // along line 1, the front band between the corner reliefs: the base's flat part W − 2·SB, lines 3 and 4 BA/2 outside it
      const along = row(o, l1[0].y).find(([a, b]) => a < pn.w / 2 && b > pn.w / 2)!
      expect(along[1] - along[0], label).toBeCloseTo(p.W - 2 * T.SB, 2)
      expect(along[0] - l3[0].x, label).toBeCloseTo(T.BA / 2, 2)
      expect(l4[0].x - along[1], label).toBeCloseTo(T.BA / 2, 2)
      // 8 mm past the walls' ends, and past the ends of the lips' bands
      const fr = row(o, pn.h - p.rc - 1)[0]
      for (const l of [l1, l2]) {
        expect(l[0].x, label).toBeCloseTo(fr[0] - 8, 2)
        expect(l[1].x, label).toBeCloseTo(fr[1] + 8, 2)
      }
      for (const l of [l3, l4]) {
        expect(l[0].y, label).toBeCloseTo(gapF[0] + 8, 2)
        expect(l[1].y, label).toBeCloseTo(gapB[1] - 8, 2)
      }
      // every line inside the drawing's extent: the app refuses an engraving past a piece's outline
      for (const l of lines) for (const q of l) expect(q.x >= -1e-9 && q.x <= pn.w + 1e-9 && q.y >= -1e-9 && q.y <= pn.h + 1e-9, label).toBe(true)
    }
  })

  it('the corners: the walls\' top corners rounded rc, the lips\' rc/2, a relief where two bends meet, every other corner 1 mm', () => {
    for (const v of SIZES) for (const t of [2, 3, 6]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const pn = build(v, { t }).panels[0], o = outerOf(pn), T = tent(p, t), leanDeg = T.b / D2R
      const arcs = o.pts.map((q, i) => (q.b ? { r: arcInfo(q, o.pts[(i + 1) % o.pts.length], q.b).r, concave: q.b > 0, turn: (4 * Math.atan(Math.abs(q.b))) / D2R } : null)).filter((a): a is { r: number; concave: boolean; turn: number } => !!a)
      expect(arcs.length, label).toBe(28)
      // the lips narrow as they rise: their top corners turn 90° − lean, their feet 90° + lean; every other corner 90°
      const turns = (deg: number) => arcs.filter(a => Math.abs(a.turn - deg) < 1e-6)
      expect(turns(90 - leanDeg).map(a => round(a.r)), `${label} the lips' top corners`).toEqual(Array(4).fill(round(p.rc / 2)))
      expect(turns(90 + leanDeg).length, `${label} the lips' feet`).toBe(4)
      expect(turns(90).length, label).toBe(20)
      expect(turns(90).filter(a => Math.abs(a.r - p.rc) < 1e-6).length, `${label} the walls' top corners`).toBe(4)
      // the 1 mm corners; beside each lip's foot the edge (ri / cos lean − 0.2) is shared by two, both shrunk alike
      const edge = p.ri / Math.cos(T.b) - CARRIER.clear, share = Math.min(1, edge / (1 + Math.tan((90 + leanDeg) * D2R / 2)))
      const small = arcs.filter(a => !(Math.abs(a.turn - 90 + leanDeg) < 1e-6) && !(Math.abs(a.turn - 90) < 1e-6 && Math.abs(a.r - p.rc) < 1e-6))
      expect(small.length, label).toBe(20)
      expect(small.filter(a => Math.abs(a.r - 1) < 1e-6).length, label).toBe(share < 1 ? 12 : 20)
      if (share < 1) expect(small.filter(a => Math.abs(a.r - share) < 1e-6).length, label).toBe(8)
      expect(arcs.filter(a => a.concave).length, `${label} inside corners`).toBe(12)
      expect(arcs.filter(a => a.concave).every(a => a.r <= 1 + 1e-9), label).toBe(true)
      // where two bend lines cross there is no material: the corner relief
      const poly = samplePoly(o, 2), [l1, l2, l3, l4] = linesOf(pn).map(l => l.pts[0])
      for (const [a, b] of [[l1, l3], [l1, l4], [l2, l3], [l2, l4]]) expect(pointIn({ x: b.x, y: a.y }, poly), `${label} relief at ${b.x},${a.y}`).toBe(false)
    }
  })

  it('across every thickness, kerf and the ends of every range: one sound piece with 3 mm round its slots, or an error', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    // and random boxes (seeded, the same every run)
    let s = 11
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    const r2 = (v: number) => Math.round(v * 2) / 2
    for (let i = 0; i < 50; i++) {
      variants.push({ W: r2(100 + rnd() * 600), D: r2(25 + rnd() * 375), H: r2(50 + rnd() * 350), He: r2(15 + rnd() * 120), gap: r2(rnd() * 6), hand: r2(60 + rnd() * 140), handH: r2(15 + rnd() * 25), handTop: r2(8 + rnd() * 40), ri: r2(0.5 + rnd() * 8), rc: r2(2 + rnd() * 28) })
    }
    let sound = 0, refused = 0
    for (const v of variants) for (const t of THICK) for (const kerf of [0, 0.2]) {
      const d = build(v, { t, kerf }), label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) expect(Number.isFinite(q.x) && Number.isFinite(q.y), label).toBe(true)
      // the bend lines never run past the piece (the app would refuse the design for that)
      expect(d.errors.join(' '), label).not.toMatch(/النقش يخرج/)
      if (d.errors.length) { refused++; expect(d.panels, label).toEqual([]); continue }
      sound++
      expect(faults(d, kerf, t === 3), label).toEqual([])
    }
    expect(sound).toBeGreaterThan(500)
    expect(refused).toBeGreaterThan(300)
  })

  it('refuses what cannot be made: walls that cannot meet, lips taller than the space between the walls, a slot that does not fit, a box too small for its bends', () => {
    const errs = (v: Record<string, number>, t = 3) => build(v, { t }).errors.join(' | ')
    // the walls meet at the top leaning 45° at most: too low a box, or too deep a one
    expect(errs({ H: 72 })).toMatch(/الجداران لا يلتقيان من فوق إلا بميل 45.2°، أكثر من 45°.*ارفعها إلى 73 مم أو قلّل العمق إلى 149 مم/)
    expect(errs({ H: 73 })).toBe('')
    expect(errs({ D: 326 })).toMatch(/ارفعها إلى 161 مم أو قلّل العمق إلى 325 مم/)
    expect(errs({ D: 325 })).toBe('')
    // the lips no taller than the narrowing space between the walls leaves room for their corners
    expect(errs({ He: 146.5 })).toMatch(/الجانبان \(146.5 مم\) أعلى مما يتّسع بين الجدارين المائلين: أقصى ارتفاع لهما 146 مم/)
    expect(errs({ He: 146 })).toBe('')
    expect(errs({ He: 200 })).toMatch(/أعلى مما يتّسع/)
    // the slot keeps 10 mm off the lips' inner faces (13 mm from the outside at 3 mm) and 3 mm off the corners
    expect(errs({ W: 220, hand: 195 })).toMatch(/فتحة الإيد \(195 مم\) أطول .* أقصاها 194 مم/)
    expect(errs({ W: 220, hand: 194 })).toBe('')
    expect(errs({ W: 245, hand: 200, rc: 20 })).toMatch(/أقصاها 199 مم/)
    expect(errs({ W: 245, hand: 200, rc: 10 })).toBe('')
    expect(errs({ W: 80 })).toMatch(/الطول \(80 مم\) لا يتّسع لفتحة الإيد \(95 مم\): اجعله 121 مم/)
    expect(errs({ W: 121 })).toBe('')
    // and its lowest point 10 mm of straight wall above the wall's bend
    const p = { ...tpl.defaults, H: 75, handH: 40 }, T = tent(p, 3), most = Math.floor((T.sw - 40 - 10) * 2) / 2
    expect(errs({ H: 75, handH: 40, handTop: most })).toBe('')
    expect(errs({ H: 75, handH: 40, handTop: most + 0.5 })).toMatch(/فتحة الإيد قريبة من ثني الجدار: يبقى تحتها 9.\d مم/)
    // too small for the bends: the lips 10 mm above their band (and room for their corners), the base 20 mm each way
    expect(errs({ He: 14.5 })).toMatch(/واطئان على الثني: أقلّ ارتفاع لهما 15 مم/)
    expect(errs({ He: 15 })).toBe('')
    expect(errs({ He: 20.5, rc: 30 })).toMatch(/21 مم/)
    expect(errs({ He: 21, rc: 30 })).toBe('')
    expect(errs({ D: 30 })).toMatch(/العمق \(30 مم\) صغير: لا يبقى من القاعدة بين ثنيتي الجدارين إلا 19.3 مم/)
    expect(errs({ D: 31 })).toBe('')
    expect(errs({ W: 29, hand: 10 })).toMatch(/الطول \(29 مم\) صغير على الثنيتين: أقلّه 30 مم/)
    expect(errs({ gap: 0 })).toBe('')
    expect(errs({ gap: -1 })).toMatch(/أكبر من الصفر/)
    expect(errs({ hand: 0 })).toMatch(/أكبر من الصفر/)
    expect(errs({ ri: NaN })).toMatch(/أكبر من الصفر/)
    // a refused box draws nothing to cut
    for (const v of [{ He: 200 }, { W: 80 }, { H: 50 }, { D: 20 }] as Record<string, number>[]) expect(build(v).panels, JSON.stringify(v)).toEqual([])
  })

  it('inner sizes: the length and depth at the base and both heights with the sheet\'s thickness added', () => {
    const t = 3, a = build({ W: 300, D: 150, H: 160, He: 45 }, { t, inner: true }), b = build({ W: 306, D: 156, H: 163, He: 48 }, { t })
    expect(a.errors).toEqual([])
    expect(a.panels[0].w).toBeCloseTo(b.panels[0].w, 9)
    expect(a.panels[0].h).toBeCloseTo(b.panels[0].h, 9)
    expect(a.notes[0]).toMatch(/قاعدتها 306 × 156 مم .* على ارتفاع 163 مم .* واطئتان 48 مم/)
  })

  it('the notes: a tent from one piece, the hand through both slots, the favours from the low ends, the bends in order with their angles and gauges, a test strip, the glue, the name', () => {
    const d = build({}), all = d.notes.join(' ')
    expect(all).toMatch(/علبة على شكل خيمة .* من قطعة أكريليك شفّاف واحدة 3 مم تُثنى بالحرارة على أربعة خطوط/)
    expect(all).toMatch(/يميلان للداخل 24.2° ويلتقيان من فوق على ارتفاع 160 مم \(بينهما 1 مم\)/)
    expect(all).toMatch(/حافّتان واطئتان 45 مم مفتوحتان من فوق، ومنهما تُؤخذ التوزيعات/)
    expect(all).toMatch(/القطعة المفرودة 381 × 483.8 مم/)
    expect(all).toMatch(/فتحة الإيد نفسها 95 × 24 مم في منتصف الطول، على بُعد 16 مم من حافّته العليا، فتتقابل الفتحتان وتدخل اليد من الاثنتين معاً/)
    expect(all).toMatch(/الخطوط الزرقاء أماكن الثني: ضع القطعة والخطوط للأعلى والسخّان تحت الخطّ تماماً/)
    expect(all).toMatch(/1 الجدار الأمامي .*114°، فتبقى الزاوية من الداخل بين القاعدة والجدار 66°؛ 2 الخلفي مثله؛ 3 الجانب الأيسر 90°؛ 4 الجانب الأيمن 90°/)
    expect(all).toMatch(/يجب أن يلتقي الجداران من فوق/)
    // the gauge: a right triangle 50 × 50·tan 65.84° with the angle between the 50 mm leg and the hypotenuse
    expect(all).toMatch(/مقياس زاوية .*66° من الداخل للجدارين، و90° للجانبين.*مثلّث قائم ضلعاه 50 و111.5 مم/)
    expect(all).toMatch(/150–180 درجة: سخّن 30–60 ثانية لأكريليك 3 مم/)
    // the test strip: 60 mm legs beyond a 90° band, each leg measured outside comes out 60 + SB
    expect(all).toMatch(/ثنية الجدار تأخذ 7 مم من القطعة المفرودة وثنية الجانب 5.5 مم/)
    expect(all).toMatch(/مستطيلاً 40 × 125.5 مم بخطّ في منتصفه.*يطلع 65 مم/)
    expect(build({ ri: 3 }).notes.join(' ')).toMatch(/40 × 127.1 مم.*يطلع 66 مم/)
    expect(all).toMatch(/بخلوص 0.2 مم من كل جهة. الصقهما بالجدارين من الداخل بغراء الأكريليك السائل/)
    expect(all).toMatch(/يلتقي فيه الجداران من فوق بغراء جل \(gel\)، ثم غطّه بشريطة زينة/)
    expect(all).toMatch(/ورق الحماية.*بقصّ خفيف جداً.*Output = No/)
    expect(all).toMatch(/اسم المولود بالذهبي يُضاف في RDWorks، فالبرنامج لا يكتب العربية/)
    expect(all).toMatch(/الوجه الداخلي للأمامي .* فاعكسه بالمرآة/)
  })

  it('the bend lines go out on the engraving layer: blue in the SVG, ENGRAVE lines in the DXF', () => {
    const d = build({})
    const svg = toSVG(d.layout), dxf = toDXF(d.layout)
    expect((svg.match(/<g id="engrave"[^>]*>(.*?)<\/g>/s)?.[1].match(/<path/g) ?? []).length).toBe(4)
    expect(dxf.split('\n').filter((s, i, a) => s === 'LINE' && a[i + 2] === 'ENGRAVE').length).toBe(4)
  })
})

function round(v: number) { return Math.round(v * 1000) / 1000 }

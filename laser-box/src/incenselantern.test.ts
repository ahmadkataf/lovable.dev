import { describe, it, expect } from 'vitest'
import { INCENSE_LANTERNS, lanternGeom, LANTERN, sheets } from './incenselantern'
import { generate, DEFAULT_SETTINGS, Design } from './generate'
import { signedArea, bbox, arcInfo, Loop } from './geom'
import { CATEGORIES, NEW_IDS } from './templates'
import { roleOf } from './scale'
import { toDXF } from './export'
import { samplePoly, pointIn, polyDistance, selfIntersects, offSheet } from './testutil'

const tpl = INCENSE_LANTERNS[0]
const D0 = tpl.defaults
const S0 = { ...DEFAULT_SETTINGS, t: 2, kerf: 0 }
const THICK = [2, 2.7, 3, 3.2, 4, 5, 6]
type Pn = Design['panels'][number]
const isCut = (l: Loop) => l.closed && l.layer !== 'engrave'
const outerOf = (pn: Pn) => pn.loops.find(l => isCut(l) && signedArea(l) > 0)!
const holesOf = (pn: Pn) => pn.loops.filter(l => isCut(l) && signedArea(l) < 0)
const build = (v: Record<string, number>, s: Partial<typeof DEFAULT_SETTINGS> = {}) => generate(tpl, v, { ...S0, ...s })
const piece = (d: Design, id: string) => d.panels.find(x => x.id === id)!
const r2 = (v: number) => Math.round(v * 100) / 100
const arcs = (l: Loop) => l.pts.flatMap((p, i) => (p.b ? [{ p, ...arcInfo(p, l.pts[(i + 1) % l.pts.length], p.b) }] : []))
/** where the horizontal line y = Y crosses the outline's straight edges, left and right (away from the rounded corners) */
function across(l: Loop, Y: number): [number, number] {
  const xs: number[] = []
  l.pts.forEach((a, i) => { const b = l.pts[(i + 1) % l.pts.length]; if (!a.b && (a.y - Y) * (b.y - Y) < 0) xs.push(a.x + ((b.x - a.x) * (Y - a.y)) / (b.y - a.y)) })
  return [Math.min(...xs), Math.max(...xs)]
}

/**
 * The box worked out here on its own, to check the design against: the sides' lean, their length on the face, and
 * where the wide sides' inside faces lie at the height z (in from the base's edge): the outside face leans in z·tan(lean),
 * and a sheet t thick takes t / cos(lean) measured level.
 */
function box(p: Record<string, number>, t: number) {
  const lean = Math.atan2((p.W - p.top) / 2, p.H)
  return { lean, HS: p.H / Math.cos(lean), yIn: (z: number) => z * Math.tan(lean) + t / Math.cos(lean) }
}

/**
 * lantern.py's cut file (its kerf 0.1: outlines grow 0.05 mm, holes shrink 0.05 mm), as its SVG has the pieces: the width,
 * height and area of each outline and hole, the coordinates rounded to 0.001 mm. Its circles are 256-gons.
 */
const SVG: Record<string, { w: number; h: number; area: number; round?: boolean; hole?: { w: number; area: number; round: boolean } }> = {
  wide: { w: 149.868, h: 166.627, area: 21261.0897 },
  narrow: { w: 145.631, h: 166.627, area: 20555.0913 },
  base: { w: 150.1, h: 150.1, area: 22529.3862 },
  plate: { w: 145.118, h: 145.118, area: 21058.6088 },
  step1: { w: 117.1, h: 117.1, area: 13711.7864, hole: { w: 59.9, area: 2817.7159, round: true } },
  step2: { w: 107.1, h: 107.1, area: 11469.7862, hole: { w: 59.9, area: 2817.7147, round: true } },
  step3: { w: 97.1, h: 97.1, area: 9427.7862, hole: { w: 59.9, area: 2817.7148, round: true } },
  step4: { w: 87.1, h: 87.1, area: 7585.7862, hole: { w: 59.9, area: 2817.7147, round: true } },
  ring: { w: 100.663, h: 100.663, area: 10132.4158, hole: { w: 84.463, area: 7133.9984, round: false } },
  disc: { w: 59.7, h: 59.7, area: 2798.9482, round: true },
}
/** a 256-gon's area over its circle's */
const GON = Math.sin((2 * Math.PI) / 256) / ((2 * Math.PI) / 256)

/**
 * Everything wrong with a built design, as messages (empty when sound): one piece per panel whose outline does not cross
 * itself, no zero-length edge or non-finite number, every hole inside its piece at least `margin` (less the kerf) from
 * its outline, nothing engraved and no open cuts, every outside corner but the disc's rounded 0.8 mm (plus half the
 * kerf) and the ring's opening square; with `layout`, every piece on its sheet and a clean DXF.
 */
function faults(d: Design, kerf: number, layout = true, margin = LANTERN.ringMin): string[] {
  const out: string[] = []
  const fail = (m: string) => { if (out.length < 8) out.push(m) }
  for (const pn of d.panels) {
    for (const l of pn.loops) for (let i = 0; i < l.pts.length; i++) {
      const a = l.pts[i], b = l.pts[(i + 1) % l.pts.length]
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || (a.b !== undefined && !Number.isFinite(a.b))) fail(`${pn.id} non-finite`)
      if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) fail(`${pn.id} zero-length edge`)
    }
    if (pn.loops.some(l => !isCut(l))) fail(`${pn.id} has lines that are not cuts`)
    const outers = pn.loops.filter(l => isCut(l) && signedArea(l) > 0)
    if (outers.length !== 1) { fail(`${pn.id} has ${outers.length} outer loops`); continue }
    const outer = samplePoly(outers[0], 5)
    if (selfIntersects(outer)) fail(`${pn.id} outline crosses itself`)
    for (const h of holesOf(pn).map(l => samplePoly(l, 5))) {
      if (selfIntersects(h)) fail(`${pn.id} hole crosses itself`)
      if (!h.every(q => pointIn(q, outer))) fail(`${pn.id} hole outside`)
      const e = polyDistance(h, outer)
      if (e < margin - kerf - 1e-6) fail(`${pn.id} hole ${e.toFixed(2)} mm from the edge`)
    }
    const round = arcs(outers[0])
    if (pn.id === 'disc') { if (round.length !== 2 || round.some(a => Math.abs(a.p.b! + 1) > 1e-9)) fail('disc not a circle') }
    else {
      if (round.length !== 4 || round.some(a => Math.abs(a.r - LANTERN.ease - kerf / 2) > 1e-6 || a.p.b! > 0)) fail(`${pn.id} corners not eased ${LANTERN.ease} mm`)
      if (Math.abs(round.reduce((s, a) => s + a.theta, 0) - 2 * Math.PI) > 1e-9) fail(`${pn.id} corner arcs do not turn round the piece`)
    }
    if (pn.id === 'ring' && holesOf(pn).some(h => h.pts.length !== 4 || h.pts.some(q => q.b))) fail('ring opening not a sharp square')
  }
  if (layout) {
    const off = offSheet(d.layout)
    if (off.length) fail(`off the sheet: ${off.join(', ')}`)
    const dxf = toDXF(d.layout)
    if (dxf.includes('NaN') || dxf.includes('undefined')) fail('dxf')
  }
  return out
}

describe('the stepped pyramid incense box (incenselantern)', () => {
  it('is lantern.py\'s box at its defaults on 2 mm acrylic: its sizes, its pieces and its cut file', () => {
    const d = build({}), g = lanternGeom(D0, 2)
    expect(d.errors).toEqual([])
    expect(d.warnings).toEqual([])
    expect(d.panels.map(x => [x.id, x.count])).toEqual([['wide', 2], ['narrow', 2], ['base', 1], ['plate', 1], ['step1', 2], ['step2', 2], ['step3', 2], ['step4', 2], ['ring', 1], ['disc', 1]])
    expect(d.pieceCount).toBe(16)
    // lantern.json: lean 7.77°, slant 166.53, the panels, the base locator, the ring, the steps, the hole, the height
    expect(r2(g.leanDeg)).toBe(7.77)
    expect(r2(g.HS)).toBe(166.53)
    expect([g.wide.bot, g.wide.top, r2(g.wide.h)]).toEqual([150, 105, 166.53])
    expect([r2(g.narrow.bot), r2(g.narrow.top), r2(g.narrow.h)]).toEqual([145.76, 100.76, 166.53])
    expect(r2(g.plate)).toBe(145.02)
    expect([r2(g.ringOut), g.ringW]).toEqual([100.56, 8])
    expect(g.steps).toEqual([117, 107, 97, 87])
    expect([g.hole, g.per, g.disc]).toEqual([60, 2, 59.6])
    expect(Math.round(g.total * 10) / 10).toBe(183)
    // and exactly lantern.py's formulas: k = HS / H, y_in(z) = (d·z + t·HS) / H
    const HS = Math.hypot(165, 22.5), k = HS / 165, yIn = (z: number) => (22.5 * z + 2 * HS) / 165
    expect(g.narrow.bot).toBeCloseTo(150 - 4 * k - 0.2, 12)
    expect(g.narrow.top).toBeCloseTo(105 - 4 * k - 0.2, 12)
    expect(g.plate).toBeCloseTo(150 - 2 * yIn(2) - 0.4, 12)
    expect(g.ringOut).toBeCloseTo(150 - 2 * yIn(165) - 0.4, 12)
    // clear acrylic only, on the main sheet; nothing engraved; nothing slots together, so no note about measuring for joints
    expect(d.panels.every(x => x.material === undefined)).toBe(true)
    expect(d.panels.every(x => x.loops.every(isCut))).toBe(true)
    expect(d.notes.join(' ')).not.toMatch(/الشقوق والأصابع مقاسة/)
    // at lantern.py's kerf (0.1) every piece is the one in its cut file
    const k1 = build({}, { kerf: 0.1 })
    for (const [id, ref] of Object.entries(SVG)) {
      const pn = piece(k1, id), o = outerOf(pn), b = bbox([o])
      expect(b.maxX - b.minX, `${id} width`).toBeCloseTo(ref.w, 2)
      expect(Math.abs(b.maxX - b.minX - ref.w), `${id} width`).toBeLessThan(0.0025)
      expect(Math.abs(b.maxY - b.minY - ref.h), `${id} height`).toBeLessThan(0.0025)
      expect(Math.abs(signedArea(o) * (ref.round ? GON : 1) - ref.area), `${id} area`).toBeLessThan(0.35)
      const hs = holesOf(pn)
      expect(hs.length, `${id} holes`).toBe(ref.hole ? 1 : 0)
      if (ref.hole) {
        const hb = bbox(hs)
        expect(Math.abs(hb.maxX - hb.minX - ref.hole.w), `${id} hole width`).toBeLessThan(0.0025)
        expect(Math.abs(-signedArea(hs[0]) * (ref.hole.round ? GON : 1) - ref.hole.area), `${id} hole area`).toBeLessThan(0.05)
      }
    }
  })

  it('stands the narrow sides between the wide ones: their slanted edges on the wide sides\' inside faces, the clearance off them at the foot and at the top', () => {
    const cases: [Record<string, number>, number][] = [
      [{}, 2], [{}, 3], [{}, 6], [{ clr: 0 }, 2], [{ clr: 1 }, 2], [{ W: 300, top: 105, H: 120 }, 3], [{ W: 120, top: 100, H: 50 }, 2.7], [{ top: 150 }, 2], [{ W: 300, top: 100, H: 100 }, 2],
    ]
    for (const [p, t] of cases) {
      const label = `${JSON.stringify(p)} t=${t}`, q = { ...D0, ...p }
      const d = build(p, { t })
      expect(d.errors, label).toEqual([])
      const { lean, HS, yIn } = box(q, t)
      const wide = piece(d, 'wide'), narrow = piece(d, 'narrow')
      expect(wide.h, label).toBeCloseTo(HS, 9)
      expect(narrow.h, label).toBeCloseTo(HS, 9)
      // a side's edges at the height z: along its slanted edges (straight between the rounded corners) to the face
      // position z / cos(lean) up from its foot
      const edges = (pn: Pn) => {
        const o = outerOf(pn), y1 = 2, y2 = pn.h - 2, a = across(o, y1), b = across(o, y2)
        return (z: number) => { const f = (pn.h - z / Math.cos(lean) - y1) / (y2 - y1); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f] }
      }
      const we = edges(wide), ne = edges(narrow)
      for (const z of [0, q.H / 3, q.H]) {
        // the wide sides run out to the pyramid's corners
        const [wl, wr] = we(z)
        expect(wr - wl, `${label} wide at z=${z}`).toBeCloseTo(q.W - 2 * z * Math.tan(lean), 6)
        // the narrow sides stop the clearance short of the wide sides' inside faces, on each side
        const [nl, nr] = ne(z)
        expect((q.W - 2 * yIn(z) - (nr - nl)) / 2, `${label} clearance at z=${z}`).toBeCloseTo(q.clr, 6)
      }
      // both trapezoids are symmetric, the narrow sides 2 t / cos(lean) + 2 clearances narrower at the foot and the top
      const [wl0, wr0] = we(0), [nl0, nr0] = ne(0), [wlH, wrH] = we(q.H), [nlH, nrH] = ne(q.H)
      expect(wl0 + wr0, label).toBeCloseTo(bbox([outerOf(wide)]).maxX + bbox([outerOf(wide)]).minX, 6)
      expect(nl0 + nr0, label).toBeCloseTo(bbox([outerOf(narrow)]).maxX + bbox([outerOf(narrow)]).minX, 6)
      expect(wrH - wlH, label).toBeCloseTo(q.top, 6)
      expect(wr0 - wl0 - (nr0 - nl0), label).toBeCloseTo((2 * t) / Math.cos(lean) + 2 * q.clr, 6)
      expect(wrH - wlH - (nrH - nlH), label).toBeCloseTo((2 * t) / Math.cos(lean) + 2 * q.clr, 6)
    }
  })

  it('fits the locating plate inside the sides\' foot and the ring inside their top, the clearance off their inside faces', () => {
    const cases: [Record<string, number>, number][] = [
      [{}, 2], [{}, 3.2], [{}, 6], [{ loc: 0 }, 2], [{ loc: 1 }, 2], [{ W: 300, top: 105, H: 120 }, 3], [{ top: 150 }, 2], [{ W: 300, top: 100, H: 100 }, 2],
    ]
    for (const [p, t] of cases) {
      const label = `${JSON.stringify(p)} t=${t}`, q = { ...D0, ...p }
      const d = build(p, { t })
      expect(d.errors, label).toEqual([])
      const { yIn } = box(q, t)
      const plate = piece(d, 'plate'), ring = piece(d, 'ring')
      expect(plate.w, label).toBeCloseTo(plate.h, 9)
      expect(ring.w, label).toBeCloseTo(ring.h, 9)
      // the plate is t thick on the base: the sides' faces lean in, so it is tightest at its top face, freer at its foot
      expect((q.W - plate.w) / 2 - yIn(t), label).toBeCloseTo(q.loc, 9)
      expect((q.W - plate.w) / 2 - yIn(0), label).toBeGreaterThan(q.loc)
      // the ring hangs t deep under the bottom step, which rests on the sides' top: tightest at the top, freer below
      expect((q.W - ring.w) / 2 - yIn(q.H), label).toBeCloseTo(q.loc, 9)
      expect((q.W - ring.w) / 2 - yIn(q.H - t), label).toBeGreaterThan(q.loc)
      // and it lies inside the bottom step, its square opening 8 mm in and clear of the hole
      const o = bbox([outerOf(ring)]), hs = holesOf(ring), h = bbox(hs)
      expect(hs, label).toHaveLength(1)
      expect(h.minX - o.minX, label).toBeCloseTo(LANTERN.ring, 9)
      expect(o.maxY - h.maxY, label).toBeCloseTo(LANTERN.ring, 9)
      expect(h.maxX - h.minX, label).toBeGreaterThanOrEqual(q.hole + 2 * LANTERN.ringClear)
      expect(ring.w, label).toBeLessThan(piece(d, 'step1').w)
    }
    // a big hole narrows the ring, keeping 1 mm off the hole, down to 4 mm wide
    const ringW = (v: Record<string, number>) => { const r = piece(build(v), 'ring'), o = bbox([outerOf(r)]), h = bbox(holesOf(r)); return h.minX - o.minX }
    const g = lanternGeom(D0, 2)
    expect(ringW({ steps: 1, hole: 84 })).toBeCloseTo((g.ringOut - 84) / 2 - 1, 9)
    expect(ringW({ steps: 1, hole: 90 })).toBeCloseTo((g.ringOut - 90) / 2 - 1, 9)
    expect(ringW({ steps: 1, hole: 90 })).toBeGreaterThan(LANTERN.ringMin)
    expect(build({ steps: 1, hole: 91 }).errors.join(' ')).toMatch(/حلقة التثبيت لا تتّسع/)
  })

  it('stacks the steps big to small, each the sheets asked, a round hole through the middle of every sheet and a disc to line them up', () => {
    const cases: Record<string, number>[] = [{}, { steps: 1 }, { steps: 6, inset: 3, ov: 12 }, { per: 1 }, { per: 4 }, { steps: 5, hole: 40 }, { W: 300, top: 200, H: 250, hole: 120 }, { ov: 0, inset: 4 }]
    for (const p of cases) {
      const label = JSON.stringify(p), q = { ...D0, ...p }
      const d = build(p)
      expect(d.errors, label).toEqual([])
      const st = d.panels.filter(x => x.id.startsWith('step'))
      expect(st.map(x => x.id), label).toEqual(Array.from({ length: q.steps }, (_, i) => `step${i + 1}`))
      expect(d.pieceCount, label).toBe(8 + q.steps * q.per)
      st.forEach((pn, i) => {
        const s = q.top + 2 * q.ov - 2 * q.inset * i
        expect(pn.w, `${label} ${pn.id}`).toBeCloseTo(s, 9)
        expect(pn.h, `${label} ${pn.id}`).toBeCloseTo(s, 9)
        expect(pn.count, `${label} ${pn.id}`).toBe(q.per)
        // the hole: a circle the diameter asked, in the middle
        const hs = holesOf(pn)
        expect(hs, label).toHaveLength(1)
        const c = arcs(hs[0])
        expect(c.length, label).toBe(2)
        for (const a of c) { expect(a.r, label).toBeCloseTo(q.hole / 2, 9); expect(a.c.x, label).toBeCloseTo(s / 2, 9); expect(a.c.y, label).toBeCloseTo(s / 2, 9) }
        // 8 mm of acrylic round it at least (the top step), more on the bigger ones
        expect((s - q.hole) / 2, label).toBeGreaterThanOrEqual(LANTERN.web - 1e-9)
      })
      // the bottom step reaches ov past the sides' top, each step inset in from the one under it
      expect((st[0].w - q.top) / 2, label).toBeCloseTo(q.ov, 9)
      for (let i = 1; i < st.length; i++) expect((st[i - 1].w - st[i].w) / 2, label).toBeCloseTo(q.inset, 9)
      // the disc: the hole less 0.4 mm across
      const dc = piece(d, 'disc')
      expect(dc.w, label).toBeCloseTo(q.hole - LANTERN.discLess, 9)
      expect(arcs(outerOf(dc)).every(a => Math.abs(a.r - (q.hole - LANTERN.discLess) / 2) < 1e-9), label).toBe(true)
    }
  })

  it('cuts every piece sound at every common thickness and kerf, every outside corner rounded 0.8 mm', () => {
    const SIZES: Record<string, number>[] = [
      {}, { W: 120, top: 100, H: 50, hole: 40 }, { W: 600, top: 420, H: 600, steps: 8, inset: 10, hole: 150 }, { top: 150 }, { W: 300, top: 100, H: 100 },
      { steps: 1, hole: 86 }, { per: 4, ov: 30, inset: 20, steps: 2 }, { clr: 0, loc: 0 }, { clr: 1, loc: 1 }, { top: 50, H: 60, W: 80, hole: 20, steps: 1 },
    ]
    let sound = 0
    for (const p of SIZES) for (const t of THICK) for (const kerf of [0, 0.2]) {
      const label = `${JSON.stringify(p)} t=${t} kerf=${kerf}`
      const d = build(p, { t, kerf })
      if (t <= 3) expect(d.errors, label).toEqual([])
      if (d.errors.length) { expect(d.panels, label).toEqual([]); continue }
      sound++
      expect(faults(d, kerf, t === 3 || t === 6), label).toEqual([])
    }
    expect(sound).toBeGreaterThan(120)
  })

  it('refuses a top wider than the base, sides leaning past 45°, a top step too small for the hole and no room for the ring, saying what works', () => {
    const err = (p: Record<string, number>, t = 2) => build(p, { t }).errors.join(' | ')
    expect(err({ top: 160 })).toMatch(/عرض الجوانب من فوق \(160 مم\) أكبر من القاعدة \(150 مم\)/)
    expect(err({ top: 150 })).toBe('') // upright sides
    // the lean: 100 mm in over 90 mm is 48°; the message gives the least height, which builds
    const steep = err({ W: 300, top: 100, H: 90 })
    expect(steep).toMatch(/الجوانب تميل 48°، أكثر من 45°/)
    expect(Number(/ارفع الجوانب إلى (\d+) مم/.exec(steep)![1])).toBe(100)
    expect(err({ W: 300, top: 100, H: 100 })).toBe('')
    expect(err({ W: 300, top: 100, H: 99.5 })).toMatch(/أكثر من 45°/)
    // the top step keeps 8 mm round the hole: 87 mm holds a 71 mm hole, not a 72 mm one
    const big = err({ hole: 72 })
    expect(big).toMatch(/الدرجة العليا \(87 مم\) صغيرة على فتحة 72 مم/)
    expect(big).toMatch(/صغّر الفتحة إلى 71 مم/)
    expect(err({ hole: 71 })).toBe('')
    expect(err({ steps: 8 })).toMatch(/صغّر الفتحة إلى 31 مم/)
    expect(err({ steps: 8, hole: 31 })).toBe('')
    expect(err({ inset: 20 })).toMatch(/4 درجات بتدرّج 20 مم لا تتّسع/)
    // the ring: at least 4 mm between the sides' top and 1 mm off the hole
    const ring = err({ steps: 1, hole: 91 })
    expect(ring).toMatch(/حلقة التثبيت لا تتّسع بين راس الجوانب والفتحة: يبقى لها 3\.8 مم، ويلزم 4 مم/)
    expect(ring).toMatch(/صغّر الفتحة إلى 90 مم/)
    expect(err({ steps: 1, hole: 90 })).toBe('')
    expect(err({ top: 30, steps: 1, hole: 20 })).toMatch(/حلقة التثبيت لا تتّسع.*كبّر عرض الجوانب من فوق/)
    expect(err({ top: 30, steps: 1, hole: 20 })).not.toMatch(/صغّر الفتحة/)
    // nothing at zero, and a refused design has no pieces
    expect(err({ H: 0 })).toBe('كل القياسات يجب أن تكون أكبر من الصفر.')
    expect(err({ ov: -1 })).toBe('كل القياسات يجب أن تكون أكبر من الصفر.')
    expect(build({ top: 160 }).panels).toEqual([])
  })

  it('says what it is, which sides go between which, the locating plate and ring, the glue order, and to keep charcoal out', () => {
    const d = build({}), notes = d.notes.join('\n')
    expect(notes).toContain('أكريليك شفّاف 2 مم فقط، بلا كتابة ولا زخرفة')
    expect(notes).toContain('117، 107، 97، 87 مم')
    expect(notes).toContain('كل درجة طبقتان')
    expect(notes).toContain('الجانبان الضيّقان (الأيمن والأيسر) يدخلان بينهما: أضيق بـ 4.24 مم')
    expect(notes).toContain('صفيحة التثبيت (145 × 145 مم)')
    expect(notes).toContain('حلقة التثبيت (100.6 مم من الخارج، عرضها 8 مم)')
    // the glue order: the plate, the wide sides, the narrow ones, the steps with the disc, the ring; with acrylic cement
    const glue = d.notes.find(n => n.startsWith('التركيب'))!
    expect(glue).toContain('cement')
    const order = ['صفيحة التثبيت في وسط القاعدة', 'الجانبين العريضين', 'الضيّقين بينهما', 'الزوايا من الداخل', 'من الكبيرة إلى الصغيرة', 'القرص المساعد', 'أخرج القرص', 'حلقة التثبيت تحت الدرجة السفلى', 'ليُرفع'].map(s => glue.indexOf(s))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // the safety note
    const safety = d.notes.find(n => n.startsWith('تنبيه'))!
    expect(safety).toContain('80–100')
    expect(safety).toContain('لا تضع فحماً داخل البوكس')
    expect(safety).toContain('مبخرة كهربائية')
    expect(safety).toContain('أبعد الجزء الساخن منها عن الأكريليك')
    // about 2 mm: thinner than 1.5 or thicker than 3 is warned; at 2.5–3 a note says how thick the steps come out
    expect(build({}, { t: 1 }).warnings.join(' ')).toMatch(/رقيق.*2 مم/)
    for (const t of [2, 2.7, 3]) expect(build({}, { t }).warnings, `t=${t}`).toEqual([])
    for (const t of [3.2, 4, 6]) expect(build({}, { t }).warnings.join(' '), `t=${t}`).toMatch(/سميك.*2 مم/)
    expect(build({}, { t: 3 }).notes.join(' ')).toContain('على 3 مم تطلع 6 مم')
    expect(build({ per: 1 }, { t: 3 }).notes.join(' ')).not.toContain('طبقات كل درجة')
    expect(notes).not.toContain('طبقات كل درجة')
    expect([1, 2, 3, 4].map(sheets)).toEqual(['طبقة واحدة', 'طبقتان', '3 طبقات', '4 طبقات'])
  })

  it('is listed first among the incense burners and badged new; the hole is the burner\'s, the steps the customer\'s', () => {
    expect(CATEGORIES.find(c => c.id === 'mabakher')!.ids).toEqual(['incenselantern', 'mabkhara', 'mabkharatower', 'incense'])
    expect(NEW_IDS[0]).toBe('incenselantern')
    const role = (k: string) => roleOf(tpl, tpl.params.find(d => d.key === k)!)
    expect(['W', 'top', 'H', 'ov', 'inset'].map(role)).toEqual(['length', 'length', 'length', 'length', 'length'])
    expect(['hole', 'steps', 'per', 'clr', 'loc'].map(role)).toEqual(['object', 'choice', 'choice', 'fixed', 'fixed'])
  })
})

import { describe, it, expect } from 'vitest'
import { GIFT_BAGS, GIFTBAG_GEOM } from './giftbag'
import { generate, DEFAULT_SETTINGS, Design } from './generate'
import { signedArea, bbox, Loop } from './geom'
import { toDXF } from './export'
import { samplePoly, pointIn, polyDistance, selfIntersects, segsCross, segDist, materialAt } from './testutil'

const tpl = GIFT_BAGS[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
const THICK = [2, 2.7, 3, 3.2, 4, 6]
type P = { x: number; y: number }
type Pn = Design['panels'][number]
const isCut = (l: Loop) => l.closed && l.layer !== 'engrave'
const holesOf = (pn: Pn) => pn.loops.filter(l => isCut(l) && signedArea(l) < 0)
const outerOf = (pn: Pn) => pn.loops.find(l => isCut(l) && signedArea(l) > 0)!
const handHole = (pn: Pn, p: Record<string, number>) => holesOf(pn).find(h => { const b = bbox([h]); return Math.abs(b.maxX - b.minX - p.hand) < 0.01 && b.maxY - b.minY < 31 })!
const get = (d: { panels: Pn[] }, id: string) => d.panels.find(x => x.id === id)!
const build = (v: Record<string, number>, s: Partial<typeof DEFAULT_SETTINGS> = {}) => generate(tpl, v, { ...S0, ...s })

// ---------------------------------------------------------------- fast geometry (segment boxes first)
type BB = { minX: number; minY: number; maxX: number; maxY: number }
const boxOf = (p: P[]): BB => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const q of p) { if (q.x < a) a = q.x; if (q.y < b) b = q.y; if (q.x > c) c = q.x; if (q.y > d) d = q.y } return { minX: a, minY: b, maxX: c, maxY: d } }
const near = (a: BB, b: BB, m: number) => !(a.minX > b.maxX + m || b.minX > a.maxX + m || a.minY > b.maxY + m || b.minY > a.maxY + m)
/** the distance between two closed polygons when it is under lim (0 when they cross), else Infinity */
function distUnder(A: P[], B: P[], lim: number): number {
  const ba = boxOf(A), cand: number[] = []
  for (let j = 0; j < B.length; j++) { const c = B[j], d = B[(j + 1) % B.length]; if (Math.min(c.x, d.x) > ba.maxX + lim || Math.max(c.x, d.x) < ba.minX - lim || Math.min(c.y, d.y) > ba.maxY + lim || Math.max(c.y, d.y) < ba.minY - lim) continue; cand.push(j) }
  let best = Infinity
  for (let i = 0; i < A.length && cand.length; i++) {
    const a = A[i], b = A[(i + 1) % A.length]
    for (const j of cand) {
      const c = B[j], d = B[(j + 1) % B.length]
      if (Math.min(c.x, d.x) > Math.max(a.x, b.x) + lim || Math.max(c.x, d.x) < Math.min(a.x, b.x) - lim || Math.min(c.y, d.y) > Math.max(a.y, b.y) + lim || Math.max(c.y, d.y) < Math.min(a.y, b.y) - lim) continue
      best = Math.min(best, segsCross(a, b, c, d) ? 0 : segDist(a, b, c, d))
    }
  }
  return best < lim ? best : Infinity
}

/**
 * Everything wrong with a built design, as messages (empty when sound): one outer loop per panel, no crossing (also
 * after the kerf offset), no zero-length edge, every hole inside with a solid margin, webs of 2 mm (less the kerf)
 * between holes, no hole inside another, no non-finite number; the hinge cuts only in their band, away from every
 * hole and with straight edges beside them (no joint); the engraving inside and clear of every cut.
 */
function faults(d: Design, p: Record<string, number>, kerf: number): string[] {
  const out: string[] = []
  const fail = (m: string) => { if (out.length < 8) out.push(m) }
  for (const pl of d.layout.placed) if (!Number.isFinite(pl.x) || !Number.isFinite(pl.y)) fail('layout non-finite')
  for (const pn of d.panels) {
    for (const l of pn.loops) {
      const n = l.pts.length
      for (let i = 0; i < n; i++) {
        const a = l.pts[i], b = l.pts[(i + 1) % n]
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || (a.b !== undefined && !Number.isFinite(a.b))) fail(`${pn.id} non-finite`)
        if ((l.closed || i < n - 1) && Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) fail(`${pn.id} zero-length edge`)
      }
    }
    const outers = pn.loops.filter(l => isCut(l) && signedArea(l) > 0)
    if (outers.length !== 1) { fail(`${pn.id} has ${outers.length} outer loops`); continue }
    const outer = samplePoly(outers[0], 10)
    if (selfIntersects(outer)) fail(`${pn.id} outline crosses itself`)
    const hs = holesOf(pn).map(h => { const s = samplePoly(h, 12); return { p: s, b: boxOf(s) } })
    for (const h of hs) {
      if (selfIntersects(h.p)) fail(`${pn.id} hole at ${h.b.minX.toFixed(1)},${h.b.minY.toFixed(1)} crosses itself`)
      if (!pointIn(h.p[0], outer)) fail(`${pn.id} hole outside`)
      const e = distUnder(h.p, outer, 2)
      if (e < 2 - kerf / 2 - 0.05) fail(`${pn.id} hole ${e.toFixed(2)} mm from the edge at ${h.b.minX.toFixed(1)},${h.b.minY.toFixed(1)}`)
    }
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
      if (!near(hs[i].b, hs[j].b, 2)) continue
      const w = distUnder(hs[i].p, hs[j].p, 2)
      if (w < 2 - kerf - 0.05) fail(`${pn.id} web ${w.toFixed(2)} mm at ${hs[i].b.minX.toFixed(1)},${hs[i].b.minY.toFixed(1)}`)
      if (pointIn(hs[i].p[0], hs[j].p) || pointIn(hs[j].p[0], hs[i].p)) fail(`${pn.id} hole inside a hole`)
    }
    const open = pn.loops.filter(l => !l.closed && l.layer !== 'engrave')
    if (pn.id === 'front' || pn.id === 'back') {
      // the band, where the kerf offset moved it
      const y0 = p.hh + kerf / 2, y1 = p.hh + p.band + kerf / 2
      if (!open.length) fail(`${pn.id} has no hinge`)
      for (const o of open) for (const q of o.pts) if (q.y < y0 + 0.2 || q.y > y1 - 0.2 || q.x < -0.31 || q.x > pn.w + 0.31) fail(`${pn.id} hinge cut out of its band at ${q.x.toFixed(1)},${q.y.toFixed(1)}`)
      for (const h of hs) if (h.b.maxY > y0 - 1.5 && h.b.minY < y1 + 1.5) fail(`${pn.id} hole within 1.5 mm of the hinge band at ${h.b.minX.toFixed(1)},${h.b.minY.toFixed(1)}`)
      for (let i = 0; i < outer.length; i++) {
        const a = outer[i], b = outer[(i + 1) % outer.length]
        if (Math.max(a.y, b.y) > y0 - 1 && Math.min(a.y, b.y) < y1 + 1 && (Math.abs(a.x - b.x) > 1e-6 || (Math.abs(a.x) > 1e-6 && Math.abs(a.x - pn.w) > 1e-6))) fail(`${pn.id} outline not straight beside the hinge band at ${a.x.toFixed(1)},${a.y.toFixed(1)}`)
      }
    } else if (open.length) fail(`${pn.id} has open cuts`)
    for (const e of pn.loops.filter(l => l.layer === 'engrave')) {
      const ep = samplePoly({ ...e, closed: true }, 12), eb = boxOf(ep)
      if (!pointIn(ep[0], outer)) fail(`${pn.id} engraving outside`)
      for (const h of hs) if (near(eb, h.b, 1) && distUnder(ep, h.p, 1) < 1) fail(`${pn.id} engraving within 1 mm of a cut at ${h.b.minX.toFixed(1)},${h.b.minY.toFixed(1)}`)
    }
  }
  return out
}

/** the material of an outline along the line x = X (axis 'x') or y = X (axis 'y') */
const along = (l: Loop, X: number, axis: 'x' | 'y') => (axis === 'x' ? materialAt(l, X) : materialAt({ ...l, pts: l.pts.map(q => ({ x: q.y, y: q.x, b: q.b ? -q.b : q.b })) }, X))
const total = (iv: [number, number][]) => iv.reduce((s, [a, b]) => s + b - a, 0)
const overlap = (a: [number, number][], b: [number, number][]) => { let s = 0; for (const [u, v] of a) for (const [x, y] of b) s += Math.max(0, Math.min(v, y) - Math.max(u, x)); return s }

/** a seeded generator, so the random combinations are the same every run */
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

describe('the handled gift box', () => {
  it('builds at its defaults on every common sheet: bottom, two sides, and the front and back rising through the hinge band into the handles', () => {
    const p = tpl.defaults
    for (const t of THICK) for (const kerf of [0, 0.2]) {
      const d = build({}, { t, kerf }), label = `t=${t} kerf=${kerf}`
      expect(d.errors, label).toEqual([])
      expect(d.warnings, label).toEqual([])
      expect(d.panels.map(x => x.id).sort(), label).toEqual(['back', 'bottom', 'front', 'side'])
      expect(get(d, 'side').count, label).toBe(2)
      expect(faults(d, p, kerf), label).toEqual([])
      for (const id of ['front', 'back']) {
        const pn = get(d, id)
        expect(pn.h, `${label} ${id} height`).toBeCloseTo(p.hh + p.band + p.H + kerf, 6)
        // the hinge: every row of cuts inside the band, as many rows as fit at the pitch
        const rows = new Set(pn.loops.filter(l => !l.closed && l.layer !== 'engrave').map(l => Math.round(l.pts[0].y * 100)))
        expect(rows.size, `${label} ${id} hinge rows`).toBe(Math.floor(p.band / p.pitch))
      }
      expect(get(d, 'front').loops.filter(l => l.layer === 'engrave').length, label).toBeGreaterThan(10)
      expect(get(d, 'back').loops.filter(l => l.layer === 'engrave').length, label).toBe(0)
      expect(get(d, 'bottom').loops.length, label).toBe(1)
      expect(toDXF(d.layout).includes('NaN'), label).toBe(false)
    }
  })

  it('one build at the defaults takes well under 150 ms', () => {
    for (const kerf of [0, 0.2]) build({}, { kerf })
    const t0 = performance.now()
    for (let i = 0; i < 4; i++) build({}, { kerf: i % 2 ? 0.2 : 0, t: 3.2 })
    expect((performance.now() - t0) / 4).toBeLessThan(150)
  })

  it('the handle: a hand hole of the length asked with 12 mm of wood above it and round its ends; finger joints only on the body below the band', () => {
    for (const t of [2.7, 3.2, 6]) for (const v of [{}, { W: 120 }, { hand: 110 }, { hh: 80, ph: 20 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = build(p, { t })
      expect(d.errors, label).toEqual([])
      for (const id of ['front', 'back']) {
        const pn = get(d, id), hole = handHole(pn, p), outer = outerOf(pn)
        expect(hole, `${label} ${id} hand hole`).toBeTruthy()
        const b = bbox([hole])
        expect(b.minY, `${label} ${id} wood above the hole`).toBeGreaterThanOrEqual(GIFTBAG_GEOM.HAND_WEB - 1e-6)
        expect(polyDistance(samplePoly(hole, 5), samplePoly(outer, 5)), `${label} ${id} wood round the hole`).toBeGreaterThan(GIFTBAG_GEOM.HAND_WEB - 0.1)
        expect(Math.abs((b.minX + b.maxX) / 2 - p.W / 2), `${label} ${id} hole centred`).toBeLessThan(1e-6)
        // the outline: notches (x = t or W - t) only in the body, the handle's sides straight and its top corners round
        const notch = outer.pts.filter(q => Math.abs(q.x - t) < 1e-6 || Math.abs(q.x - p.W + t) < 1e-6)
        expect(notch.length, `${label} ${id} joint notches`).toBeGreaterThan(4)
        for (const q of notch) expect(q.y, `${label} ${id} notch in the body`).toBeGreaterThanOrEqual(p.hh + p.band - 1e-6)
        expect(outer.pts.some(q => q.b && q.y < 30), `${label} ${id} round top corners`).toBe(true)
      }
      const side = get(d, 'side')
      expect(side.h, label).toBeCloseTo(p.H, 6)
      expect(side.w, label).toBeCloseTo(p.D, 6)
    }
  })

  it('the sides have round top corners as in the photo; every joint meets its mate: opposite fingers over the same length, the rounded part left to the front and back', () => {
    for (const t of [2, 3.2, 6]) for (const [v, inner] of [[{}, false], [{ W: 90, D: 60, H: 60, hand: 50, pw: 40, ph: 30 }, false], [{ D: 250, H: 300, hh: 200 }, false], [{}, true]] as [Record<string, number>, boolean][]) {
      const label = `${JSON.stringify(v)} t=${t} inner=${inner}`
      const d = build(v, { t, inner })
      expect(d.errors, label).toEqual([])
      const front = get(d, 'front'), back = get(d, 'back'), side = get(d, 'side'), bottom = get(d, 'bottom')
      const H = side.h, from = front.h - H, sideOut = outerOf(side)
      // the side's top: two arcs, the top edge straight between them, and no material in the corner columns above the joints
      const arcs = sideOut.pts.filter(q => q.b && q.y < H / 2)
      expect(arcs.length, `${label} round corners`).toBe(2)
      const rq = Math.min(...along(sideOut, t / 2, 'x').map(([a]) => a))
      expect(rq, `${label} the corner column is the front's above the joint`).toBeGreaterThan(5)
      expect(along(sideOut, side.w / 2, 'x')[0][0], `${label} top straight in the middle`).toBeCloseTo(0, 6)
      for (const wall of [front, back]) for (const [fx, sx] of [[t / 2, t / 2], [wall.w - t / 2, side.w - t / 2]]) {
        // along the corner column: the wall's fingers and the side's fill it once over, from the side's top to the bottom panel
        const wa = along(outerOf(wall), fx, 'x').map(([a, b]) => [Math.max(a, from) - from, b - from] as [number, number]).filter(([a, b]) => b > a + 1e-9)
        const sa = along(sideOut, sx, 'x')
        expect(overlap(wa, sa), `${label} ${wall.id} collides with the side`).toBeLessThan(1e-6)
        expect(total(wa) + total(sa), `${label} ${wall.id}+side fill the corner`).toBeCloseTo(H - t, 3)
        // the wall's joint starts where the side's straight edge does
        expect(wa.length, `${label} ${wall.id} fingers`).toBeGreaterThan(2)
        expect(wa[0][1], `${label} ${wall.id} solid above the joint`).toBeGreaterThan(rq - 1e-6)
      }
      // the bottom: its fingers between the walls' and the sides' along each edge
      const fb = along(outerOf(front), front.h - t / 2, 'y'), bt = along(outerOf(bottom), t / 2, 'y')
      expect(overlap(fb, bt), label).toBeLessThan(1e-6)
      expect(total(fb) + total(bt), label).toBeCloseTo(front.w, 3)
      const sb = along(sideOut, side.h - t / 2, 'y'), bl = along(outerOf(bottom), t / 2, 'x')
      expect(overlap(sb, bl), label).toBeLessThan(1e-6)
      expect(total(sb) + total(bl), label).toBeCloseTo(side.w, 3)
      expect(bottom.w, label).toBeCloseTo(front.w, 6)
      expect(bottom.h, label).toBeCloseTo(side.w, 6)
      expect(d.notes.join(' '), label).toMatch(/مستديرا الزاويتين/)
    }
  })

  it('fretwork on every wall and handle with every pattern: holes inside the solid margins, webs never under 2 mm, the sides\' fret kept off their round corners', () => {
    for (let pattern = 1; pattern <= 7; pattern++) for (const t of [3, 6]) {
      const p: Record<string, number> = { ...tpl.defaults, pattern }, label = `pattern=${pattern} t=${t}`
      const d = build(p, { t })
      expect(d.errors, label).toEqual([])
      expect(faults(d, p, 0), label).toEqual([])
      for (const pn of d.panels.filter(x => x.id !== 'bottom')) {
        const outer = samplePoly(outerOf(pn), 2), hs = holesOf(pn).filter(h => h !== handHole(pn, p))
        expect(hs.length, `${label} ${pn.id} has fret`).toBeGreaterThanOrEqual(2)
        // the margin: t + 2 beyond the joints' notches, and from the side's round corners too
        for (const h of hs) expect(distUnder(samplePoly(h, 10), outer, t + 2), `${label} ${pn.id} margin`).toBeGreaterThan(t + 2 - 0.05)
      }
    }
  })
})

/** the values an error or warning tells to set, by the field they belong to */
const SUGGEST: [RegExp, string][] = [
  [/قصّر فتحة اليد إلى ([\d.]+)/, 'hand'], [/اجعل طولها ([\d.]+)/, 'hand'], [/وسّع الصندوق إلى ([\d.]+)/, 'W'],
  [/اجعل ارتفاعه ([\d.]+)/, 'hh'], [/شريط المفصل.*اجعله ([\d.]+)/, 'band'], [/قصّة المفصل.*اجعله ([\d.]+)/, 'seg'],
  [/اجعل عرضها ([\d.]+)/, 'pw'], [/اجعل ارتفاعها ([\d.]+)/, 'ph'], [/اجعل ارتفاع المقبض ([\d.]+)/, 'hh'],
  [/«حجم الزخرفة» إلى ([\d.]+)/, 'cell'], [/اجعل ارتفاع الجسم ([\d.]+)/, 'H'], [/اجعل العمق ([\d.]+)/, 'D'], [/اجعل العرض ([\d.]+)/, 'W'],
  [/زد ارتفاع المقبض إلى ([\d.]+)/, 'hh'], [/قلّل العمق إلى ([\d.]+)/, 'D'],
]
const suggestions = (e: string) => SUGGEST.flatMap(([re, k]) => { const m = e.match(re); return m ? [[k, Number(m[1])] as [string, number]] : [] })
const kindOf = (e: string) => e.replace(/[-\d.]+/g, '#').slice(0, 25)
/** every value an error suggests is inside its field's range, and setting it clears that error */
function checkAdvice(v: Record<string, number>, t: number): string[] {
  const bad: string[] = []
  for (const e of build(v, { t }).errors) {
    const sg = suggestions(e)
    if (!sg.length) bad.push(`no value to set: ${e}`)
    for (const [k, val] of sg) {
      const def = tpl.params.find(d => d.key === k)!
      if (val < def.min - 1e-9 || val > def.max + 1e-9) bad.push(`${JSON.stringify(v)} t=${t}: ${k}=${val} is outside ${def.min}–${def.max}: ${e}`)
      else if (build({ ...v, [k]: val }, { t }).errors.some(x => kindOf(x) === kindOf(e))) bad.push(`${JSON.stringify(v)} t=${t}: ${k}=${val} does not clear: ${e}`)
    }
  }
  return bad
}

describe('the handled gift box: plaque, hinge and advice', () => {
  it('the plaque: a solid rounded rectangle with a double engraved outline and scallops, the fret clipped round it and never through it; the back carries the full fret', () => {
    for (const [t, v] of [[2.7, {}], [3.2, {}], [6, {}], [4, {}], [3.2, { ph: 70 }], [3.2, { pw: 110, ph: 70, hh: 160 }], [6, { pw: 30, ph: 20 }]] as [number, Record<string, number>][]) for (const pattern of [1, 2, 3, 4, 5, 6, 7]) {
      const p: Record<string, number> = { ...tpl.defaults, ...v, pattern }, label = `${JSON.stringify(v)} pattern=${pattern} t=${t}`
      const d = build(p, { t })
      expect(d.errors, label).toEqual([])
      // no cut within 1 mm of the engraving (a fret hole across the frame cut the plaque's top away at t = 6)
      expect(faults(d, p, 0), label).toEqual([])
      const front = get(d, 'front'), back = get(d, 'back')
      const eng = front.loops.filter(l => l.layer === 'engrave')
      const outlines = eng.filter(l => l.closed), scallops = eng.filter(l => !l.closed)
      expect(outlines.length, label).toBe(2)
      expect(scallops.length, label).toBeGreaterThan(8)
      const ob = bbox([outlines[0]])
      expect(ob.maxX - ob.minX, label).toBeCloseTo(p.pw, 3)
      expect(ob.maxY - ob.minY, label).toBeCloseTo(p.ph, 3)
      expect((ob.minX + ob.maxX) / 2, `${label} centred`).toBeCloseTo(p.W / 2, 3)
      const m = GIFTBAG_GEOM.SCALLOP + 2.4, rr = Math.min(10, p.pw / 5, p.ph / 5)
      const shrunk = GIFTBAG_GEOM.roundedRectPoly(ob.minX - m, ob.minY - m, p.pw + 2 * m, p.ph + 2 * m, rr + m)
      for (const h of holesOf(front)) for (const q of samplePoly(h, 10)) expect(pointIn(q, shrunk), `${label} cut inside the plaque zone`).toBe(false)
      const area = (pn: Pn) => holesOf(pn).reduce((s, h) => s + Math.abs(signedArea(h)), 0)
      expect(area(front), `${label} the plaque takes fret away`).toBeLessThan(area(back) - 0.2 * p.pw * p.ph)
    }
    const off = build({ plaque: 0 })
    expect(off.errors).toEqual([])
    expect(get(off, 'front').loops.filter(l => l.layer === 'engrave').length).toBe(0)
    expect(holesOf(get(off, 'front')).length).toBe(holesOf(get(off, 'back')).length)
  })

  it('the hinge: through rows run out of both edges so the band bends evenly, and it bends each handle in until the two meet at the top on a gentle radius', () => {
    for (const [v, t] of [[{}, 3.2], [{ D: 60, hh: 200 }, 3], [{ D: 250, hh: 250, band: 60 }, 3.2], [{ band: 12, pitch: 1 }, 2], [{ D: 160 }, 6]] as [Record<string, number>, number][]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = build(p, { t })
      expect(d.errors, label).toEqual([])
      const cuts = get(d, 'front').loops.filter(l => !l.closed && l.layer !== 'engrave')
      expect(cuts.some(l => l.pts[0].x < 0) && cuts.some(l => l.pts[1].x > p.W), `${label} through rows`).toBe(true)
      const m = d.notes.join(' ').match(/حتى يلتقيا في القمّة \(كلّ منهما يميل نحو (\d+)°، على نصف قطر ([\d.]+) مم\)/)
      expect(m, label).toBeTruthy()
      const deg = Number(m![1]), R = Number(m![2]), reach = p.D / 2 - t
      // the band bent into an arc of θ and the handle straight above it: the inner faces meet at the top
      const lean = (a: number) => R * (1 - Math.cos(a)) + p.hh * Math.sin(a)
      expect(lean((deg - 0.5) * Math.PI / 180), label).toBeLessThan(reach + 0.2)
      expect(lean((deg + 0.5) * Math.PI / 180), label).toBeGreaterThan(reach - 0.2)
      expect(Math.abs(R * (deg * Math.PI / 180) - p.band), `${label} the arc is the band`).toBeLessThan(R * (0.5 * Math.PI / 180) + 0.1)
      expect(R - t / 2, `${label} gentle radius`).toBeGreaterThanOrEqual(3 * t)
      if (deg <= 40) expect(d.warnings.join(' '), label).not.toMatch(/يلتقيان|يميل/)
    }
  })

  it('handles that lean too far, or cannot meet, are warned of with sizes that fix it; the note does not claim they meet', () => {
    for (const [v, t] of [[{ D: 300, hh: 70, plaque: 0, cell: 10 }, 3.2], [{ D: 300, hh: 90, ph: 20 }, 3], [{ D: 200, hh: 120 }, 3], [{ D: 280, hh: 120, band: 10, pitch: 1 }, 2]] as [Record<string, number>, number][]) {
      const label = `${JSON.stringify(v)} t=${t}`, d = build(v, { t })
      expect(d.errors, label).toEqual([])
      const w = d.warnings.find(x => /يلتقيان|يميل/.test(x))
      expect(w, label).toBeTruthy()
      if (/لا يلتقيان/.test(w!)) expect(d.notes.join(' '), label).not.toMatch(/حتى يلتقيا/)
      const sg = suggestions(w!)
      expect(sg.length, `${label} ${w}`).toBeGreaterThan(0)
      for (const [k, val] of sg) {
        const def = tpl.params.find(x => x.key === k)!
        expect(val >= def.min && val <= def.max, `${label} ${k}=${val} in range`).toBe(true)
        const d2 = build({ ...v, [k]: val }, { t })
        expect(d2.warnings.join(' '), `${label} ${k}=${val}`).not.toMatch(/يلتقيان|يميل/)
        expect(Number(d2.notes.join(' ').match(/يميل نحو (\d+)°/)![1]), `${label} ${k}=${val}`).toBeLessThanOrEqual(36)
      }
    }
  })

  it('says what to change, to a value inside the field\'s range that clears the error: hand hole, plaque, pattern size, hinge', () => {
    const err = (v: Record<string, number>, t = 3) => build(v, { t }).errors.join(' ')
    expect(err({ hand: 200 })).toMatch(/فتحة اليد/)
    expect(err({ hand: 200 })).not.toMatch(/-\d/)
    expect(err({ hand: 135 })).toMatch(/فتحة اليد/)
    expect(err({ pw: 200 })).toMatch(/لوحة/)
    expect(err({ ph: 150 })).toMatch(/لوحة/)
    expect(err({ cell: 40, D: 50, H: 60, W: 110, hand: 60 })).toMatch(/الزخرفة/)
    expect(err({ band: 10, pitch: 6 })).toMatch(/شريط المفصل/)
    expect(err({ seg: 80, bridge: 10, W: 90, hand: 50 })).toMatch(/قصّة المفصل/)
    expect(err({ hh: 60 })).toMatch(/لوحة|المقبض/)
    const bad: string[] = []
    // the cases that suggested a pattern size under 8 mm or a plaque under 15 mm, a handle height that did not clear, and more
    const cases: [Record<string, number>, number][] = [[{ H: 40 }, 6], [{ H: 40 }, 3.2], [{ D: 40 }, 6], [{ hh: 60 }, 2], [{ hh: 60 }, 3.2], [{ hh: 60 }, 6], [{ W: 80 }, 3], [{ hand: 200 }, 3],
      [{ pw: 200 }, 6], [{ ph: 150 }, 2], [{ band: 10, pitch: 6 }, 3], [{ seg: 80, bridge: 10, W: 90, hand: 50 }, 3], [{ cell: 40, D: 50, H: 60, W: 110, hand: 60 }, 3], [{ W: 80, pw: 100 }, 4], [{ pattern: 6, cell: 40, H: 70 }, 3]]
    const rnd = rng(11)
    for (let i = 0; i < 120; i++) {
      const v: Record<string, number> = {}
      for (const d of [...tpl.params].sort(() => rnd() - 0.5).slice(0, 2 + Math.floor(rnd() * 3))) { const st = d.step ?? 1; v[d.key] = Math.round((d.min + Math.round(rnd() * Math.round((d.max - d.min) / st)) * st) * 1000) / 1000 }
      cases.push([v, THICK[Math.floor(rnd() * THICK.length)]])
    }
    let refused = 0
    for (const [v, t] of cases) { const b = checkAdvice(v, t); bad.push(...b); if (build(v, { t }).errors.length) refused++ }
    expect(bad.slice(0, 5)).toEqual([])
    expect(refused).toBeGreaterThan(30)
  })
})

describe('the handled gift box: clipping and robustness', () => {
  it('the clipper: a slot through the plaque comes out as two pieces, a circle beside it is trimmed, one inside it is dropped; kept inside a field, the same shapes give the other parts', () => {
    const G = GIFTBAG_GEOM, zone = G.roundedRectPoly(40, 40, 60, 40, 8)
    const slot = [{ x: 60, y: 10 }, { x: 70, y: 10 }, { x: 70, y: 110 }, { x: 60, y: 110 }]
    const circ = (cx: number, cy: number, r: number) => Array.from({ length: 72 }, (_, k) => ({ x: cx + r * Math.cos((k * Math.PI) / 36), y: cy + r * Math.sin((k * Math.PI) / 36) }))
    const two = G.subtractConvex(slot, zone)!
    expect(two.length).toBe(2)
    for (const pc of two) { expect(G.areaOf(pc)).toBeGreaterThan(0); expect(selfIntersects(pc)).toBe(false); for (const q of pc) expect(pointIn(q, zone) && polyDistance([q, q], zone) > 0.01).toBe(false) }
    expect(two.reduce((s, pc) => s + G.areaOf(pc), 0)).toBeCloseTo(10 * 100 - 10 * 40, 1)
    const trimmed = G.subtractConvex(circ(40, 60, 10), zone)!
    expect(trimmed.length).toBe(1)
    expect(Math.abs(G.areaOf(trimmed[0]))).toBeCloseTo((Math.PI * 100) / 2, 0)
    expect(G.subtractConvex(circ(70, 60, 10), zone)).toEqual([])
    expect(G.subtractConvex(circ(150, 150, 10), zone)!.length).toBe(1)
    // the plaque inside a huge hole cannot be kept (it would fall out): the hole goes
    expect(G.subtractConvex(circ(70, 60, 100), zone)).toEqual([])
    // keeping the inside: the complement of each case above
    expect(G.clipConvex(slot, zone, 'in')!.reduce((s, pc) => s + G.areaOf(pc), 0)).toBeCloseTo(10 * 40, 1)
    expect(Math.abs(G.areaOf(G.clipConvex(circ(40, 60, 10), zone, 'in')![0]))).toBeCloseTo((Math.PI * 100) / 2, 0)
    expect(G.clipConvex(circ(70, 60, 10), zone, 'in')!.length).toBe(1)
    expect(G.clipConvex(circ(150, 150, 10), zone, 'in')).toEqual([])
    expect(Math.abs(G.areaOf(G.clipConvex(circ(70, 60, 100), zone, 'in')![0]))).toBeCloseTo(Math.abs(G.areaOf(zone)), 6)
    // a C-shaped hole crossing the edge twice: two pieces inside, one outside, the areas adding up
    const C = [{ x: 30, y: 45 }, { x: 50, y: 45 }, { x: 50, y: 50 }, { x: 35, y: 50 }, { x: 35, y: 70 }, { x: 50, y: 70 }, { x: 50, y: 75 }, { x: 30, y: 75 }]
    const ins = G.clipConvex(C, zone, 'in')!, outs = G.clipConvex(C, zone, 'out')!
    expect([ins.length, outs.length]).toEqual([2, 1])
    expect(ins.concat(outs).reduce((s, pc) => s + Math.abs(G.areaOf(pc)), 0)).toBeCloseTo(Math.abs(G.areaOf(C)), 6)
  })

  it('robustness grid: every thickness × kerf × each parameter at its ends builds sound geometry (the kerf-offset outlines too) or refuses with an error', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    let runs = 0, refused = 0
    const bad: string[] = []
    for (const t of THICK) for (const kerf of [0, 0.2]) for (const v of variants) {
      const label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      let d: Design
      try { d = build(v, { t, kerf }) } catch (e) { throw new Error(`${label} threw: ${(e as Error).message}`) }
      runs++
      if (d.errors.length) { refused++; continue }
      for (const f of faults(d, { ...tpl.defaults, ...v }, kerf)) bad.push(`${label}: ${f}`)
    }
    expect(bad.slice(0, 6)).toEqual([])
    expect(runs).toBe(THICK.length * 2 * (1 + 2 * tpl.params.length))
    expect(refused).toBeLessThan(runs / 4)
  })

  it('robustness: random combinations of three or four parameters at once (fixed seed) build sound geometry or refuse', () => {
    const rnd = rng(20261010)
    let ok = 0
    const bad: string[] = []
    for (let i = 0; i < 90; i++) {
      const v: Record<string, number> = {}
      for (const d of [...tpl.params].sort(() => rnd() - 0.5).slice(0, 3 + Math.floor(rnd() * 2))) { const st = d.step ?? 1; v[d.key] = Math.round((d.min + Math.round(rnd() * Math.round((d.max - d.min) / st)) * st) * 1000) / 1000 }
      const t = THICK[Math.floor(rnd() * THICK.length)], kerf = rnd() < 0.5 ? 0 : 0.2, label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      const d = build(v, { t, kerf })
      if (d.errors.length) continue
      ok++
      for (const f of faults(d, { ...tpl.defaults, ...v }, kerf)) bad.push(`${label}: ${f}`)
      if (/NaN|undefined/.test(toDXF(d.layout))) bad.push(`${label}: DXF`)
    }
    expect(bad.slice(0, 6)).toEqual([])
    expect(ok).toBeGreaterThan(40)
  })

  it('robustness grid: the common suite\'s box sizes, fingers and inner mode', () => {
    const boxes = [[60, 50, 30], [120, 80, 50], [300, 200, 120]]
    let runs = 0, refused = 0
    const bad: string[] = []
    for (const t of [2, 6]) for (const kerf of [0, 0.2]) for (const finger of [0, 12]) for (const [W, D, H] of boxes) for (const inner of [false, true]) {
      const label = `${W}x${D}x${H} t=${t} kerf=${kerf} finger=${finger} inner=${inner}`
      const d = generate(tpl, { W, D, H }, { ...DEFAULT_SETTINGS, t, kerf, finger, inner })
      runs++
      if (d.errors.length) { refused++; continue }
      const add = inner ? tpl.innerAdd(t, {}) : { W: 0, D: 0, H: 0 }
      for (const f of faults(d, { ...tpl.defaults, W: W + add.W, D: D + add.D, H: H + add.H }, kerf)) bad.push(`${label}: ${f}`)
    }
    expect(bad.slice(0, 6)).toEqual([])
    expect(runs).toBe(48)
    expect(refused).toBeLessThan(runs)
  })
})

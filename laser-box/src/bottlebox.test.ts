import { describe, it, expect } from 'vitest'
import { BOTTLE_BOXES, bottleGeom, tabRuns, END_GAP } from './bottlebox'
import { generate, DEFAULT_SETTINGS, autoFinger } from './generate'
import { signedArea, bbox } from './geom'
import { toDXF } from './export'
import { repair, scaleDesign } from './scale'
import { samplePoly, pointIn, polysOverlap, polyDistance, selfIntersects } from './testutil'

const tpl = BOTTLE_BOXES[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
const THICK = [2, 2.7, 3, 3.2, 4, 6]
type P = { x: number; y: number }
type L = { closed: boolean; layer?: string; pts: { x: number; y: number; b?: number }[] }
type Pn = { id: string; name: string; w: number; h: number; count: number; loops: L[] }
type Dz = { panels: Pn[]; errors: string[]; warnings: string[]; notes: string[]; layout: never }
const cutOf = (pn: Pn) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const holesOf = (pn: Pn) => cutOf(pn).filter(l => signedArea(l as never) < 0)
const outerOf = (pn: Pn) => cutOf(pn).find(l => signedArea(l as never) > 0)!
const get = (d: { panels: Pn[] }, id: string) => d.panels.find(x => x.id === id)!
const gen = (p: Record<string, number>, s: Partial<typeof S0> = {}) => generate(tpl, p, { ...S0, ...s }) as never as Dz
/** the lid's default lip (10 mm) is lower than three sheets above 3.3 mm: there the automatic lip */
const base = (t: number): Record<string, number> => (3 * t > 10 ? { lipH: 0 } : {})

/** the gridsuite's soundness checks on the cut loops of one design; the problems found, as text */
function soundness(d: Dz, label: string): string[] {
  const bad: string[] = []
  for (const pn of d.panels) {
    const lab = `${label} ${pn.id}`
    if (!(pn.w > 0)) bad.push(`${lab} width`)
    const outers = cutOf(pn).filter(l => signedArea(l as never) > 0)
    if (outers.length !== 1) { bad.push(`${lab} ${outers.length} outer loops`); continue }
    const outer = samplePoly(outers[0] as never, 15)
    if (selfIntersects(outer)) bad.push(`${lab} self-intersects`)
    const hs = holesOf(pn).map(h => ({ p: samplePoly(h as never, 20), b: bbox([h as never]) }))
    for (const h of hs) {
      if (h.p.some(q => !pointIn(q, outer))) bad.push(`${lab} hole outside`)
      if (polyDistance(h.p, outer) <= 0.8 - 1e-9) bad.push(`${lab} hole too close to the edge`)
    }
    for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i].b, b = hs[j].b
      if (a.minX > b.maxX + 1 || b.minX > a.maxX + 1 || a.minY > b.maxY + 1 || b.minY > a.maxY + 1) continue
      if (polyDistance(hs[i].p, hs[j].p) <= 0.8 - 1e-9) bad.push(`${lab} holes too close`)
    }
    for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; if (Math.hypot(q.x - outer[i].x, q.y - outer[i].y) <= 1e-6) bad.push(`${lab} zero-length edge`) }
    for (const l of pn.loops) for (const q of l.pts) if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) bad.push(`${lab} non-finite`)
  }
  const dxf = toDXF(d.layout)
  if (dxf.includes('NaN') || dxf.includes('undefined')) bad.push(`${label} dxf`)
  return bad
}

const shrink = (pts: P[], by = 0.05) => {
  const cx = pts.reduce((s, q) => s + q.x, 0) / pts.length, cy = pts.reduce((s, q) => s + q.y, 0) / pts.length
  return pts.map(q => { const dx = q.x - cx, dy = q.y - cy, l = Math.hypot(dx, dy) || 1; return { x: q.x - (dx / l) * by, y: q.y - (dy / l) * by } })
}

/**
 * The assembly at kerf 0, checked from the pieces as cut and the side view: every side slot takes a plate's tab (same
 * line, the tab's length and the sheet plus the fit), with 2 mm of wood round it; the plates stay inside the box clear
 * of the walls, the bottom and the lid's lip; every hole row has its bottles standing on the support plate, square to
 * it, 3 mm clear of the walls and the lip and under the lid by `air`; 3 mm of wood between holes and round them.
 */
function assembly(p: Record<string, number>, t: number, label: string): string[] {
  const bad: string[] = []
  const P0 = { ...tpl.defaults, ...p }
  const d = gen(p, { t })
  if (d.errors.length) return [`${label} refused: ${d.errors[0]}`]
  const res = tpl.build(P0, { ...S0, t, finger: autoFinger(t, [P0.H]) })
  const g = bottleGeom(P0, t), sv = res.sideView!
  const { D, H, sa, ca } = g, fit = P0.fit
  // side view (x forward from the back face) to slope coordinates
  const toSQ = (q: P) => { const X = D - q.x, Y = q.y; return { s: X * ca + Y * sa, q: -X * sa + Y * ca } }
  const range = (pts: P[]) => { const v = pts.map(toSQ); return { s0: Math.min(...v.map(z => z.s)), s1: Math.max(...v.map(z => z.s)), q0: Math.min(...v.map(z => z.q)), q1: Math.max(...v.map(z => z.q)) } }
  const piece = (id: string) => sv.pieces.filter(pc => pc.id === id)
  const holesPl = piece('holes')[0], floorPl = piece('floor')[0], bottles = piece('bottle')
  const rh = range(holesPl.pts), rf = range(floorPl.pts)
  const close = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps
  if (!close(rh.q1 - rh.q0, t) || !close(rf.q1 - rf.q0, t)) bad.push(`${label} plate thickness`)
  if (!close(rh.q1 - rf.q1, P0.sink)) bad.push(`${label} sink`)
  // the plates' tabs and the side's slots
  const side = get(d, 'side'), Hp = side.h
  const plate = get(d, 'holes'), floor = get(d, 'floor')
  for (const pl of [plate, floor]) {
    if (!close(pl.h, rh.s1 - rh.s0, 0.02)) bad.push(`${label} ${pl.id} length ${pl.h} vs ${rh.s1 - rh.s0}`)
    if (!close(pl.w, g.Wi + 2 * t)) bad.push(`${label} ${pl.id} width`)
  }
  // the tab runs: where the plate's outline reaches x = 0
  const ys = [...new Set(outerOf(plate).pts.filter(v => Math.abs(v.x) < 1e-6).map(v => Math.round(v.y * 1000) / 1000))].sort((a, b) => a - b)
  const runs: [number, number][] = []
  for (let i = 0; i + 1 < ys.length; i += 2) runs.push([ys[i], ys[i + 1]])
  const fruns = [...new Set(outerOf(floor).pts.filter(v => Math.abs(v.x) < 1e-6).map(v => Math.round(v.y * 1000) / 1000))].sort((a, b) => a - b)
  if (JSON.stringify(fruns) !== JSON.stringify(ys)) bad.push(`${label} the plates' tabs differ`)
  if (runs.length < 1 || runs.length > 3) bad.push(`${label} ${runs.length} tabs`)
  // a plate turned round does not go in: its runs, mirrored, are not its runs
  const mirrored = runs.map(([a, b]) => [Math.round((plate.h - b) * 1000) / 1000, Math.round((plate.h - a) * 1000) / 1000]).reverse()
  if (JSON.stringify(mirrored) === JSON.stringify(runs)) bad.push(`${label} the tabs are symmetric`)
  const slots = holesOf(side).map(h => h.pts.map(v => ({ x: D - v.x, y: Hp - v.y })))
  if (slots.length !== 2 * runs.length) bad.push(`${label} ${slots.length} slots for ${runs.length} tabs`)
  for (const sl of slots) {
    const r = range(sl)
    const pl = close(r.q1, rh.q1 + fit / 2) ? rh : close(r.q1, rf.q1 + fit / 2) ? rf : null
    if (!pl) { bad.push(`${label} a slot on no plate`); continue }
    if (!close(r.q1 - r.q0, t + fit)) bad.push(`${label} slot width ${r.q1 - r.q0}`)
    if (!runs.some(([a, b]) => close(r.s0, pl.s0 + a - fit / 2) && close(r.s1, pl.s0 + b + fit / 2))) bad.push(`${label} a slot that no tab fills`)
  }
  // 2 mm of wood round every slot
  const so = samplePoly(outerOf(side) as never, 15), sh = holesOf(side).map(h => samplePoly(h as never))
  for (const h of sh) if (polyDistance(h, so) < 2 - 1e-6) bad.push(`${label} slot ${polyDistance(h, so).toFixed(2)} mm from the side's edge`)
  for (let i = 0; i < sh.length; i++) for (let j = i + 1; j < sh.length; j++) if (polyDistance(sh[i], sh[j]) < 2 - 1e-6) bad.push(`${label} slots ${polyDistance(sh[i], sh[j]).toFixed(2)} mm apart`)
  // pieces inside the side and clear of each other (bottles cross the hole plate through its holes)
  const outline = sv.outline
  const walls = sv.pieces.filter(pc => !['bottle', 'holes', 'floor'].includes(pc.id))
  for (const pc of [holesPl, floorPl]) {
    if (!shrink(pc.pts).every(q => pointIn(q, outline))) bad.push(`${label} ${pc.id} sticks out of the side`)
    for (const w of walls) if (polysOverlap(shrink(pc.pts), shrink(w.pts))) bad.push(`${label} ${pc.id} hits ${w.id}`)
    const X = pc.pts.map(q => D - q.x), Y = pc.pts.map(q => q.y)
    if (Math.min(...X) < t + END_GAP - 1e-3 || Math.max(...X) > D - t - END_GAP + 1e-3) bad.push(`${label} ${pc.id} ends too near the walls`)
    if (Math.min(...Y) < t + END_GAP - 1e-3) bad.push(`${label} ${pc.id} too near the bottom`)
    if (g.lid && Math.max(...Y) > H - g.lipH - 1 + 1e-3) bad.push(`${label} ${pc.id} under the lip`)
  }
  if (polysOverlap(shrink(holesPl.pts), shrink(floorPl.pts))) bad.push(`${label} the plates collide`)
  // the bottles
  const rowS = [...new Set(holesOf(plate).map(h => { const b = bbox([h as never]); return Math.round(((b.minY + b.maxY) / 2 + rh.s0) * 1000) / 1000 }))].sort((a, b) => a - b)
  if (rowS.length !== bottles.length) bad.push(`${label} ${rowS.length} hole rows, ${bottles.length} bottles drawn`)
  if (holesOf(plate).length !== g.num) bad.push(`${label} ${holesOf(plate).length} holes for ${g.num}`)
  for (const [k, b] of bottles.entries()) {
    const r = range(b.pts)
    if (!close(r.q0, rf.q1) || !close(r.q1 - r.q0, P0.bh) || !close(r.s1 - r.s0, P0.bd)) bad.push(`${label} bottle ${k} does not stand on the support plate`)
    if (rowS[k] !== undefined && !close((r.s0 + r.s1) / 2, rowS[k], 0.01)) bad.push(`${label} bottle ${k} is not in its hole row`)
    if (polysOverlap(shrink(b.pts), shrink(floorPl.pts))) bad.push(`${label} bottle ${k} sinks into the support plate`)
    for (const w of walls) {
      if (polysOverlap(shrink(b.pts), shrink(w.pts))) bad.push(`${label} bottle ${k} hits ${w.id}`)
      else if (['front', 'back', 'lip-front', 'lip-back'].includes(w.id) && polyDistance(b.pts, w.pts) < 3 - 1e-6) bad.push(`${label} bottle ${k} ${polyDistance(b.pts, w.pts).toFixed(2)} mm from ${w.id}`)
    }
    if (!shrink(b.pts).every(q => q.x > t && q.x < D - t)) bad.push(`${label} bottle ${k} leaves the box's plan`)
    if (g.lid && Math.max(...b.pts.map(q => q.y)) > H - P0.air + 1e-6) bad.push(`${label} bottle ${k} under the lid`)
  }
  // the bottles across the width clear the side lips by 3 mm: the outer holes keep that from the plate's edges
  const ph = holesOf(plate).map(h => bbox([h as never]))
  const edge = Math.min(...ph.map(b => b.minX - t), ...ph.map(b => g.Wi + t - b.maxX))
  if (edge < (g.lid ? t + P0.gap + 3 - P0.hc / 2 : 3) - 1e-6) bad.push(`${label} holes ${edge.toFixed(2)} mm from the plate's side edge`)
  // 3 mm of wood between holes, and between a hole and the plate's edge
  const hp = holesOf(plate).map(h => ({ p: samplePoly(h as never, 10), b: bbox([h as never]) })), po = samplePoly(outerOf(plate) as never)
  for (const h of hp) if (polyDistance(h.p, po) < 3 - 1e-3) bad.push(`${label} hole ${polyDistance(h.p, po).toFixed(2)} mm from the plate's edge`)
  for (let i = 0; i < hp.length; i++) for (let j = i + 1; j < hp.length; j++) {
    const a = hp[i].b, b = hp[j].b
    if (a.minX > b.maxX + 4 || b.minX > a.maxX + 4 || a.minY > b.maxY + 4 || b.minY > a.maxY + 4) continue
    if (polyDistance(hp[i].p, hp[j].p) < 3 - 1e-2) { bad.push(`${label} holes ${polyDistance(hp[i].p, hp[j].p).toFixed(2)} mm apart`); break }
  }
  return bad
}

describe('the leaning bottle box', () => {
  it('builds at its defaults on every common sheet: a lidded finger-jointed box, two plates, 40 holes, sound and assembled', () => {
    for (const t of THICK) for (const kerf of [0, 0.2]) {
      const label = `t=${t} kerf=${kerf}`
      const d = gen(base(t), { t, kerf })
      expect(d.errors, label).toEqual([])
      expect(d.warnings, label).toEqual([])
      expect(d.panels.map(p => p.id).sort(), label).toEqual(['back', 'bottom', 'floor', 'front', 'holes', 'lid', 'lip-fb', 'lip-side', 'side'])
      expect(get(d, 'side').count).toBe(2)
      expect(get(d, 'lip-fb').count).toBe(2)
      expect(soundness(d, label)).toEqual([])
      const holes = holesOf(get(d, 'holes'))
      expect(holes.length, label).toBe(40)
      for (const h of holes) { const b = bbox([h as never]); expect(b.maxX - b.minX, label).toBeCloseTo(15 + 1 - kerf, 2) }
      expect(holesOf(get(d, 'floor')).length).toBe(0)
      expect(holesOf(get(d, 'side')).length, label).toBeGreaterThanOrEqual(4)
      if (kerf === 0) expect(assembly(base(t), t, label)).toEqual([])
    }
    // the default sheet (3 mm, 0.15 kerf) has nothing to warn about
    const d = generate(tpl, {}, DEFAULT_SETTINGS)
    expect(d.errors).toEqual([])
    expect(d.warnings).toEqual([])
  })

  it('lays the 40 holes out closest to square: 6 rows of 7, the last row 5 centred, in a box about 168 × 149 × 109', () => {
    const g = bottleGeom(tpl.defaults, 3)
    expect(g.rows.map(r => r.xs.length)).toEqual([7, 7, 7, 7, 7, 5])
    const last = g.rows[5].xs, first = g.rows[0].xs
    expect((last[0] + last[4]) / 2).toBeCloseTo(g.Wi / 2, 3)
    expect((first[0] + first[6]) / 2).toBeCloseTo(g.Wi / 2, 3)
    expect(first[1] - first[0]).toBeCloseTo(15 + 1 + 5, 3)
    expect(g.rows[1].s - g.rows[0].s).toBeCloseTo(21, 3)
    expect(Math.abs(Math.log(g.Wi / g.Di))).toBeLessThan(0.15)
    expect([g.W, g.D, g.H]).toEqual([168, 149, 109])
    const d = gen({})
    expect(d.notes.join(' ')).toContain('6 صفوف × 7، الصفّ الأخير 5')
    expect(d.notes.join(' ')).toContain('40 ثقباً')
    expect(d.notes.join(' ')).toContain('ويظهر منها 28 مم')
    // the automatic choice is the squarest: no other number of rows gives a squarer plan without leaving a row mostly empty
    for (let r = 1; r <= 15; r++) {
      const q = bottleGeom({ ...tpl.defaults, rows: r }, 3)
      const lastRow = q.rows[q.rows.length - 1]
      if (lastRow.xs.length === lastRow.full) expect(Math.abs(Math.log(q.Wi / q.Di)), `rows ${r}`).toBeGreaterThan(Math.abs(Math.log(g.Wi / g.Di)) - 1e-9)
    }
  })

  it('holds exactly the number asked, in the rows asked, straight or staggered, every hole 3 mm clear of the next', () => {
    for (const num of [1, 2, 7, 12, 24, 40, 41, 77, 150]) for (const style of [1, 2]) for (const rows of [0, 1, 3, 5, 9, 15]) {
      const p = { num, style, rows }
      const g = bottleGeom({ ...tpl.defaults, ...p }, 3)
      const label = JSON.stringify(p)
      expect(g.rows.reduce((s, r) => s + r.xs.length, 0), label).toBe(num)
      // the rows asked for, all of them (fewer only when there are fewer bottles)
      if (rows > 0) expect(g.R, label).toBe(Math.min(rows, num))
      // short rows only at the back, all holding the same; each centred (straight rows exactly, staggered ones on their
      // lattice: a quarter of a pitch off when every other row is shifted, half a pitch when rows of c and c − 1 alternate)
      const firstShort = g.rows.findIndex(r => r.xs.length < r.full)
      if (firstShort >= 0) for (const r of g.rows.slice(firstShort)) expect(r.xs.length, label).toBe(g.rows[g.rows.length - 1].xs.length)
      for (const r of g.rows) {
        const mid = (r.xs[0] + r.xs[r.xs.length - 1]) / 2
        expect(Math.abs(mid - g.Wi / 2), `${label} row centre`).toBeLessThanOrEqual((g.kind === 'straight' ? 0 : g.kind === 'shift' ? g.pitch / 4 : g.pitch / 2) + 1e-3)
      }
      // centre to centre at least one pitch, between rows and along them
      const pts = g.rows.flatMap(r => r.xs.map(x => ({ x, s: r.s })))
      let min = Infinity
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) min = Math.min(min, Math.hypot(pts[i].x - pts[j].x, pts[i].s - pts[j].s))
      if (pts.length > 1) expect(min, label).toBeGreaterThan(g.pitch - 1e-6)
      if (num <= 77 && rows !== 15) expect(assembly(p, 3, label)).toEqual([])
    }
    // staggered rows pack the same 40 holes into less room than straight ones
    const st = bottleGeom({ ...tpl.defaults, style: 2 }, 3), sl = bottleGeom(tpl.defaults, 3)
    expect(st.Wi * st.Di).toBeLessThan(sl.Wi * sl.Di)
    expect(gen({ style: 2 }).notes.join(' ')).toContain('متداخلة')
  })

  it('leans the bottles toward the front, square to the plates, and sizes the box to them in every shape and at every angle', () => {
    for (const shape of [1, 2, 3]) for (const angle of [0, 10, 20, 30, 40]) for (const t of [3, 6]) {
      const p = { shape, angle, ...base(t) }
      expect(assembly(p, t, JSON.stringify(p) + ` t=${t}`)).toEqual([])
    }
    // with the lid the box is the lowest that clears the caps by `air`: half a millimetre less is refused
    const g = bottleGeom(tpl.defaults, 3)
    expect(g.H - g.Ytop).toBeGreaterThanOrEqual(5 - 1e-9)
    expect(g.H - g.Ytop).toBeLessThan(5.5 + 1e-9)
    expect(gen({ H: g.H - 0.5 }).errors.length).toBe(1)
    // a taller H keeps the plates where they are and raises the walls
    const tall = bottleGeom({ ...tpl.defaults, H: 200 }, 3)
    expect([tall.cS, tall.cH, tall.D]).toEqual([g.cS, g.cH, g.D])
    expect(gen({ H: 200 }).errors).toEqual([])
  })

  it('the open box has walls just tall enough for the plates, the stand sides that follow the slope', () => {
    const o = bottleGeom({ ...tpl.defaults, shape: 2 }, 3)
    expect(o.H - o.Yplate).toBeGreaterThanOrEqual(3 - 1e-9)
    expect(o.H - o.Yplate).toBeLessThan(3.5 + 1e-9)
    const d = gen({ shape: 2 })
    expect(d.panels.map(p => p.id).sort()).toEqual(['back', 'bottom', 'floor', 'front', 'holes', 'side'])
    const s = gen({ shape: 3 }), g = bottleGeom({ ...tpl.defaults, shape: 3 }, 3)
    expect(s.errors).toEqual([])
    expect(get(s, 'front').h).toBeCloseTo(g.Hf, 3)
    expect(get(s, 'back').h).toBeCloseTo(g.H, 3)
    expect(g.Hf).toBeLessThan(g.H - 50)
    // the side's top: a straight line from the front wall's top (at its inner face) to the back wall's top, at the plates' angle
    const side = get(s, 'side'), o2 = outerOf(side).pts
    const top = o2.filter(v => v.y < side.h - g.Hf + 1e-6 && v.x > 3 - 1e-6 && v.x < g.D - 3 + 1e-6)
    const a = top.find(v => Math.abs(v.x - 3) < 1e-6 && Math.abs(v.y - (side.h - g.Hf)) < 1e-3), b = top.find(v => Math.abs(v.x - (g.D - 3)) < 1e-6 && Math.abs(v.y) < 1e-6)
    expect(a, 'front corner').toBeDefined()
    expect(b, 'back corner').toBeDefined()
    expect(Math.atan2(a!.y - b!.y, b!.x - a!.x) * 180 / Math.PI).toBeCloseTo(20, 2)
    expect(s.notes.join(' ')).toContain('ستاند مائل')
  })
})

describe('the leaning bottle box: limits', () => {
  it('passes the robustness grid: thickness × kerf × defaults and every parameter at its min and max, or refuses with an error', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    let runs = 0, refused = 0
    const bad: string[] = []
    for (const t of THICK) for (const kerf of [0, 0.2]) for (const v of variants) {
      const p = { ...base(t), ...v }
      const label = `${JSON.stringify(p)} t=${t} kerf=${kerf}`
      const d = gen(p, { t, kerf })
      runs++
      for (const pn of d.panels) for (const l of pn.loops) for (const q of l.pts) if (!Number.isFinite(q.x) || !Number.isFinite(q.y)) bad.push(`${label} non-finite`)
      if (d.errors.length) { refused++; continue }
      bad.push(...soundness(d, label))
      if (kerf === 0 && (v.num === undefined || v.num < 100)) bad.push(...assembly(p, t, label))
      if (bad.length > 20) break
    }
    expect(bad).toEqual([])
    expect(runs).toBe(THICK.length * 2 * variants.length)
    expect(refused).toBeLessThan(runs / 4)
    // the finger setting of the grid suite (12 mm) builds too
    expect(soundness(generate(tpl, {}, { ...S0, finger: 12 }) as never as Dz, 'finger 12')).toEqual([])
  })

  it('refuses what cannot be built, and the value each error asks for builds', () => {
    const num = (e: string, re: RegExp) => Number(re.exec(e)![1])
    for (const t of THICK) {
      const s = { t }
      // the bottles sink too little for wood between the plates' slots
      const e1 = gen({ ...base(t), sink: 5 }, s).errors
      if (t + 0.15 + 2 > 5) {
        expect(e1.length, `t=${t}`).toBe(1)
        expect(e1[0]).toContain('عمق الغوص')
        const v = num(e1[0], /يلزم ([\d.]+) مم على الأقل/)
        expect(gen({ ...base(t), sink: v }, s).errors, `t=${t} sink=${v}`).toEqual([])
      } else expect(e1, `t=${t}`).toEqual([])
      // or so deep that nothing shows
      const e2 = gen({ ...base(t), sink: 58 }, s).errors
      expect(e2.length, `t=${t}`).toBe(1)
      const v2 = num(e2[0], /اجعله ([\d.]+) مم على الأكثر/)
      expect(v2).toBe(45) // a 50 mm bottle keeps 5 mm showing
      expect(gen({ ...base(t), sink: v2 }, s).errors, `t=${t}`).toEqual([])
      // a lip too low to finger-joint its corners
      const e3 = gen({ lipH: 2 * t }, s).errors
      expect(e3.some(e => e.includes('ارتفاع الشفة')), `t=${t}`).toBe(true)
      const v3 = num(e3.find(e => e.includes('ارتفاع الشفة'))!, /يلزم ([\d.]+) مم على الأقل/)
      expect(gen({ lipH: v3 }, s).errors, `t=${t} lipH=${v3}`).toEqual([])
      // a box too low for the bottles (the lid), for the plates (open), or for the stand's back
      for (const shape of [1, 2, 3]) {
        const e4 = gen({ ...base(t), shape, H: 40 }, s).errors
        expect(e4.length, `t=${t} shape=${shape}`).toBe(1)
        expect(e4[0]).toContain('الارتفاع')
        const v4 = num(e4[0], /يلزم ([\d.]+) مم على الأقل/)
        expect(gen({ ...base(t), shape, H: v4 }, s).errors, `t=${t} shape=${shape} H=${v4}`).toEqual([])
        expect(gen({ ...base(t), shape, H: v4 - 0.5 }, s).errors.length, `t=${t} shape=${shape} H=${v4 - 0.5}`).toBe(1)
      }
    }
    // the lid's lip taller than the box asked for is the same error: H
    const e5 = gen({ H: 109, lipH: 40 }).errors
    expect(e5.length).toBe(1)
    expect(gen({ H: num(e5[0], /يلزم ([\d.]+) مم على الأقل/), lipH: 40 }).errors).toEqual([])
    // and a shallow sink is only a warning
    const w = gen({ bh: 120, sink: 20 }).warnings
    expect(w.some(x => x.includes('تتأرجح'))).toBe(true)
    expect(gen({ bh: 120, sink: 40 }).warnings).toEqual([])
  })

  it('repairs the thicker sheets and scales up and down without touching the bottles, the count or the clearances', () => {
    for (const t of [4, 5, 6]) {
      const s = { ...DEFAULT_SETTINGS, t }
      // the lip is sized from the sheet by default, so the thick sheets build as they are
      expect(generate(tpl, {}, s).errors, `t=${t}`).toEqual([])
      // a 10 mm lip is too low for them, and repair raises only the lip
      const r = repair(tpl, s, { lipH: 10 }, { budgetMs: 8000 })
      expect(r.ok, `t=${t}: ${r.errors.join(' | ')}`).toBe(true)
      expect(r.changes.map(c => c.key), `t=${t}`).toEqual(['lipH'])
    }
    for (const f of [0.5, 0.7, 1.5]) {
      const r = scaleDesign(tpl, { ...DEFAULT_SETTINGS, t: 3.2 }, {}, f, false, 8000)
      expect(r.ok, `×${f}: ${r.errors.join(' | ')}`).toBe(true)
      for (const k of ['num', 'bd', 'bh', 'angle', 'shape', 'style', 'margin', 'hc', 'gap', 'air', 'fit']) expect(r.params[k], `×${f} ${k}`).toBe(tpl.defaults[k])
    }
  })

  it('fits the plates one way round: tabs nearer the front end, slots keeping their wood from the joints', () => {
    for (const [L, fit, a] of [[40, 0.15, 0], [153.7, 0.15, 20], [400, 0.6, 40]] as const) {
      const sa = Math.sin(a * Math.PI / 180), ca = Math.cos(a * Math.PI / 180)
      const mf = Math.max(3, fit / 2 + (2.2 - END_GAP + fit / 2 * sa) / ca), mb = mf + 3
      const runs = tabRuns(L, mf, mb)
      expect(runs.length).toBe(L - mf - mb >= 100 ? 3 : 2)
      expect(runs[0][0]).toBeCloseTo(mf, 3)
      expect(L - runs[runs.length - 1][1]).toBeCloseTo(mb, 3)
      for (const [u0, u1] of runs) expect(u1 - u0).toBeGreaterThan(5)
    }
  })
})

describe('the leaning bottle box: review', () => {
  /** a small seeded generator, so the random grid is the same on every run */
  const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
  const pick = (r: () => number, def: { min: number; max: number; step: number }) => {
    const k = Math.round((def.max - def.min) / def.step)
    return Math.round((def.min + Math.floor(r() * (k + 1)) * def.step) * 1000) / 1000
  }

  it('passes 200 random combinations of 3–4 parameters (any sheet, kerf 0 and 0.2): sound, assembled, or refused', () => {
    const r = rng(20261023)
    const keys = tpl.params.filter(d => d.key !== 'n')
    const bad: string[] = []
    let refused = 0
    for (let i = 0; i < 200; i++) {
      const t = THICK[Math.floor(r() * THICK.length)], m = 3 + Math.floor(r() * 2)
      const p: Record<string, number> = { ...base(t) }
      const chosen = new Set<string>()
      while (chosen.size < m) chosen.add(keys[Math.floor(r() * keys.length)].key)
      for (const k of chosen) p[k] = pick(r, tpl.params.find(d => d.key === k)! as never)
      if ((p.num ?? 40) > 90) p.num = 90 // the assembly check is quadratic in the holes
      const label = `${JSON.stringify(p)} t=${t}`
      const d2 = gen(p, { t, kerf: 0.2 })
      if (d2.errors.length) { refused++; continue }
      bad.push(...soundness(d2, `${label} kerf=0.2`))
      bad.push(...assembly(p, t, label))
      if (bad.length > 10) break
    }
    expect(bad).toEqual([])
    expect(refused).toBeLessThan(60)
  })
})

describe('the leaning bottle box: review, rows', () => {
  it('centres a short straight row exactly, even when it is one hole short (41 bottles: the last row of 6 in the middle)', () => {
    const g = bottleGeom({ ...tpl.defaults, num: 41 }, 3)
    expect(g.rows.map(r => r.xs.length)).toEqual([7, 7, 7, 7, 7, 6])
    const last = g.rows[5].xs
    expect((last[0] + last[5]) / 2).toBeCloseTo(g.Wi / 2, 6)
    // still a pitch clear of the row before, and the plate's border kept
    expect(last[0] - g.rows[4].xs[0]).toBeCloseTo(g.pitch / 2, 6)
    const d = gen({ num: 41 })
    expect(d.errors).toEqual([])
    expect(soundness(d, 'num 41')).toEqual([])
    expect(assembly({ num: 41 }, 3, 'num 41')).toEqual([])
    expect(d.notes.join(' ')).toContain('6 صفوف × 7، الصفّ الأخير 6')
  })

  it('gives every row asked for: 9 rows of 40 are 5, 5, 5, 5 then 4, 4, 4, 4, 4 (not 8 rows of 5), straight or staggered', () => {
    for (const style of [1, 2]) for (const [rows, want] of [[9, [5, 5, 5, 5, 4, 4, 4, 4, 4]], [15, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2]], [11, [4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3]]] as const) {
      const p = { rows, style }, label = JSON.stringify(p)
      const g = bottleGeom({ ...tpl.defaults, ...p }, 3)
      expect(g.R, label).toBe(rows)
      if (g.kind !== 'alt') expect(g.rows.map(r => r.xs.length), label).toEqual(want)
      for (const t of [3, 6]) {
        const d = gen({ ...base(t), ...p }, { t, kerf: 0.2 })
        expect(d.errors, label).toEqual([])
        expect(soundness(d, `${label} t=${t}`)).toEqual([])
        expect(assembly({ ...base(t), ...p }, t, `${label} t=${t}`)).toEqual([])
      }
    }
    expect(gen({ rows: 9 }).notes.join(' ')).toContain('9 صفوف × 5، وفي كلّ صفّ من آخر 5 صفوف 4')
    expect(gen({ rows: 15 }).notes.join(' ')).toContain('15 صفّاً × 3')
    // the default layout keeps its one short row (the user's example)
    expect(bottleGeom({ ...tpl.defaults, rows: 6 }, 3).rows.map(r => r.xs.length)).toEqual([7, 7, 7, 7, 7, 5])
  })

  it('words the counts right and builds in well under 100 ms', () => {
    expect(gen({ num: 1 }).notes.join(' ')).toContain('ثقب واحد قطره 16 مم')
    expect(gen({ num: 2 }).notes.join(' ')).toContain('ثقبان قطرهما 16 مم')
    expect(gen({ num: 2 }).notes.join(' ')).toContain('علبة غرشتين قطرهما 15 مم وطولهما 50 مم')
    expect(gen({ shape: 3 }).notes.join(' ')).toContain('لمن يقف أمامها')
    for (const p of [{}, { num: 150, bd: 8, style: 2 }, { num: 150, rows: 1 }] as Record<string, number>[]) {
      generate(tpl, p, DEFAULT_SETTINGS)
      const t0 = performance.now()
      for (let i = 0; i < 5; i++) generate(tpl, p, DEFAULT_SETTINGS)
      expect((performance.now() - t0) / 5, JSON.stringify(p)).toBeLessThan(100)
    }
  })
})

describe('the leaning bottle box: review, every shape', () => {
  it('every shape at 0°, 1°, 20°, 39° and 40°, straight and staggered, on every sheet with a 0.2 kerf: sound and assembled', () => {
    const bad: string[] = []
    for (const shape of [1, 2, 3]) for (const angle of [0, 1, 20, 39, 40]) for (const style of [1, 2]) for (const t of THICK) {
      const p = { ...base(t), shape, angle, style }
      const label = `${JSON.stringify(p)} t=${t}`
      const d = gen(p, { t, kerf: 0.2 })
      if (d.errors.length || d.warnings.length) { bad.push(`${label}: ${[...d.errors, ...d.warnings].join(' | ')}`); continue }
      bad.push(...soundness(d, `${label} kerf=0.2`), ...assembly(p, t, label))
    }
    expect(bad).toEqual([])
  })
})

describe('the display stand version (no lid)', () => {
  const stand = BOTTLE_BOXES.find(x => x.id === 'bottlestand')!
  const genS = (p: Record<string, number>, s: Partial<typeof S0> = {}) => generate(stand, p, { ...S0, ...s }) as never as Dz
  const asBox = (p: Record<string, number>) => ({ ...p, shape: Math.round(p.shape ?? 1) === 2 ? 2 : 3 })

  it('is the slanted stand by default, with no lid, on every sheet, without warnings', () => {
    expect(stand.params.map(d => d.key)).not.toContain('lipH')
    expect(stand.params.map(d => d.key)).not.toContain('gap')
    expect(stand.params.map(d => d.key)).not.toContain('air')
    expect(stand.params.find(d => d.key === 'shape')!.options).toEqual(['ستاند مائل', 'علبة مفتوحة'])
    for (const t of THICK) {
      const d = genS({}, { t })
      expect(d.errors, `t=${t}`).toEqual([])
      expect(d.warnings, `t=${t}`).toEqual([])
      expect(d.panels.map(p => p.id).sort(), `t=${t}`).toEqual(['back', 'bottom', 'floor', 'front', 'holes', 'side'])
      expect(holesOf(get(d, 'holes')).length, `t=${t}`).toBe(40)
      expect(get(d, 'front').h, `t=${t}`).toBeLessThan(get(d, 'back').h - 40)
      expect(d.notes.join(' ')).toContain('ستاند مائل')
      expect(d.notes.join(' ')).not.toContain('الغطاء')
    }
    // the same pieces as the lidded design asked for as a stand
    const box = gen({ shape: 3 }, { t: 3.2 }), s = genS({}, { t: 3.2 })
    expect(s.panels.map(p => [p.id, p.w, p.h])).toEqual(box.panels.map(p => [p.id, p.w, p.h]))
  })

  it('the second choice is the open box: straight walls just above the plates', () => {
    const d = genS({ shape: 2 }, { t: 3 })
    expect(d.errors).toEqual([])
    expect(get(d, 'front').h).toBeCloseTo(get(d, 'back').h, 6)
    expect(d.notes.join(' ')).toContain('علبة مفتوحة')
    expect(d.panels.map(p => [p.id, p.w, p.h])).toEqual(gen({ shape: 2 }, { t: 3 }).panels.map(p => [p.id, p.w, p.h]))
  })

  it('passes the robustness grid over its own settings, sound and assembled, or refuses with an error', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of stand.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    let runs = 0, refused = 0
    const bad: string[] = []
    for (const t of THICK) for (const kerf of [0, 0.2]) for (const v of variants) {
      const label = `stand ${JSON.stringify(v)} t=${t} kerf=${kerf}`
      const d = genS(v, { t, kerf })
      runs++
      if (d.errors.length) { refused++; continue }
      bad.push(...soundness(d, label))
      if (kerf === 0 && (v.num === undefined || v.num < 100)) bad.push(...assembly(asBox(v), t, label))
      if (bad.length > 20) break
    }
    expect(bad).toEqual([])
    expect(refused).toBeLessThan(runs / 4)
  })

  it('scales without touching the bottles, and a too-low height names the height that builds', () => {
    for (const f of [0.5, 0.7, 1.5]) {
      const r = scaleDesign(stand, { ...DEFAULT_SETTINGS, t: 3.2 }, {}, f, false, 8000)
      expect(r.ok, `×${f}: ${r.errors.join(' | ')}`).toBe(true)
      for (const k of ['num', 'bd', 'bh', 'sink', 'angle', 'shape', 'style', 'margin', 'hc', 'fit']) expect(r.params[k], `×${f} ${k}`).toBe(stand.defaults[k])
    }
    for (const shape of [1, 2]) {
      const e = genS({ shape, H: 30 }, { t: 3 }).errors
      expect(e.length, `shape ${shape}`).toBe(1)
      const v = Number(/يلزم ([\d.]+) مم على الأقل/.exec(e[0])![1])
      expect(genS({ shape, H: v }, { t: 3 }).errors, `shape ${shape} H=${v}`).toEqual([])
    }
  })
})

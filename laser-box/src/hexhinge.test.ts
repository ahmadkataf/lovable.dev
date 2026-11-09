import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { TEMPLATES } from './templates'
import { generate, DEFAULT_SETTINGS } from './generate'
import { signedArea, Vtx } from './geom'
import { HEX_HINGE } from './hexhinge'
import { samplePoly, pointIn, polysOverlap } from './testutil'

const tpl = TEMPLATES.find(x => x.id === 'hexringbox')!
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
type P = { x: number; y: number }
type Design = ReturnType<typeof generate>
type Pn = Design['panels'][number]
const cut = (pn: Pn) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const outerOf = (pn: Pn) => cut(pn).find(l => signedArea(l) > 0)!
const holesOf = (pn: Pn) => cut(pn).filter(l => signedArea(l) < 0)
const panel = (d: Design, id: string) => { const p = d.panels.find(q => q.id === id); if (!p) throw new Error(`no panel ${id}`); return p }
const swap = (ps: P[][]) => ps.map(pts => pts.map(q => ({ x: q.y, y: q.x })))

/** Material of closed polygons (even-odd) along the line x = X: intervals of y. */
function sectionAt(polys: P[][], X: number): [number, number][] {
  const ys: number[] = []
  for (const pts of polys) for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    if ((a.x <= X && b.x > X) || (b.x <= X && a.x > X)) ys.push(a.y + ((b.y - a.y) * (X - a.x)) / (b.x - a.x))
  }
  ys.sort((u, v) => u - v)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < ys.length; i += 2) if (ys[i + 1] - ys[i] > 1e-9) out.push([ys[i], ys[i + 1]])
  return out
}
const boxOf = (pts: P[]) => ({ x0: Math.min(...pts.map(q => q.x)), x1: Math.max(...pts.map(q => q.x)), y0: Math.min(...pts.map(q => q.y)), y1: Math.max(...pts.map(q => q.y)) })

/**
 * The hinged box put together from its cut pieces alone, in box coordinates (x across, y toward the front from the
 * hexagon's back flat, z up from the base's top): the base and the collar in plan, the lid resting on the collar, each
 * cheek standing in its slot on its tab, the support on its tab in its slot, the lid frame centred on the lid.
 */
function assemble(d: Design, p: Record<string, number>, t: number) {
  const AFb = p.S + 2 * p.ov, H = p.H
  const plan = (pn: Pn, dx: number, dy: number, step = 1) => cut(pn).map(l => samplePoly(l, step).map(q => ({ x: q.x - dx, y: q.y - dy })))
  const base = panel(d, 'base'), lid = panel(d, 'lid'), cheek = panel(d, 'cheek'), sup = panel(d, 'support'), frame = panel(d, 'lid-frame'), collar = panel(d, 'collar')
  // the base: its hexagon's front flat is its far edge; the slots behind the hexagon are the hinge's
  const bdy = base.h - AFb, bdx = base.w / 2
  const hinge = holesOf(base).map(l => boxOf(l.pts.map(q => ({ x: q.x - bdx, y: q.y - bdy })))).filter(b => b.y1 < 0)
  const rectOf = (b: ReturnType<typeof boxOf>) => ({ cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, w: b.x1 - b.x0, h: b.y1 - b.y0 })
  const cheekSlots = hinge.filter(b => b.x1 - b.x0 < b.y1 - b.y0).map(rectOf).sort((a, b) => a.cx - b.cx)
  const supSlots = hinge.filter(b => b.x1 - b.x0 > b.y1 - b.y0).map(rectOf)
  // the lid: in plan like the base; its pivot tabs are the corners furthest out behind the hexagon
  const ldy = lid.h - AFb, ldx = lid.w / 2
  const lidPts = outerOf(lid).pts.map(q => ({ x: q.x - ldx, y: q.y - ldy }))
  const behind = lidPts.filter(q => q.y < -1), tabX = Math.max(...behind.map(q => Math.abs(q.x)))
  const tabYs = behind.filter(q => Math.abs(Math.abs(q.x) - tabX) < 1e-6).map(q => q.y)
  const tab = { y0: Math.min(...tabYs), y1: Math.max(...tabYs), x1: tabX, strip: 0 }
  const zA = H + t + t / 2 // the lid's mid-plane as it rests on the collar
  const axis = { y: (tab.y0 + tab.y1) / 2, z: zA }
  const lidPlan = cut(lid).map(l => samplePoly(l, 1).map(q => ({ x: q.x - ldx, y: q.y - ldy })))
  tab.strip = Math.max(...sectionAt(swap(lidPlan), tab.y1 + 1).map(([a, b]) => Math.max(-a, b))) // the strip's half width, just in front of the tabs
  // a piece standing on a tab (its foot t above the tab's end, drawn with the top at y = 0): where the tab is
  const footTab = (pn: Pn) => { const v = outerOf(pn).pts, ys = v.map(q => q.y), yMax = Math.max(...ys), xs = v.filter(q => Math.abs(q.y - yMax) < 1e-6).map(q => q.x); return { x0: Math.min(...xs), x1: Math.max(...xs), depth: yMax - Math.max(...ys.filter(y => y < yMax - 1e-6)) } }
  // the cheek on its tab in the right-hand slot (seen from the side: its x is y, its y is down from the top)
  const ct = footTab(cheek), cs = cheekSlots[1], ctc = (ct.x0 + ct.x1) / 2
  const toCheek = (q: P) => ({ x: q.x - ctc + cs.cy, y: cheek.h - t - q.y })
  const ho = holesOf(cheek)
  const circ = ho[0].pts as Vtx[]
  const hole = { c: toCheek({ x: (circ[0].x + circ[1].x) / 2, y: (circ[0].y + circ[1].y) / 2 }), r: Math.hypot(circ[1].x - circ[0].x, circ[1].y - circ[0].y) / 2 }
  const cheekOuter = samplePoly(outerOf(cheek), 1).map(toCheek)
  // the support on its tab (seen from behind: its x is x, its y down from the top), its faces as its slot's middle ± t/2
  const st = footTab(sup), ss = supSlots[0], stc = (st.x0 + st.x1) / 2
  const supProf = [samplePoly(outerOf(sup), 1).map(q => ({ x: q.x - stc + ss.cx, y: sup.h - t - q.y }))]
  return {
    AFb, H, t, zA, axis, tab, hole, holeCount: ho.length, circlePts: circ.length,
    lidPlan, framePlan: plan(frame, frame.w / 2, -(AFb - frame.h) / 2), collarPlan: plan(collar, collar.w / 2, 0), basePlan: plan(base, bdx, bdy),
    cheekSlots, supSlots, cheekTab: ct, supTab: st, supHalf: sup.w / 2,
    cheek: { x0: cs.cx - t / 2, x1: cs.cx + t / 2, outer: cheekOuter, back: toCheek({ x: 0, y: 0 }).x, tabC: toCheek({ x: ctc, y: 0 }).x },
    support: { y0: ss.cy - t / 2, y1: ss.cy + t / 2, prof: supProf },
  }
}
type Asm = ReturnType<typeof assemble>

type Quad = P[]
interface Obst { part: string; box: { x0: number; x1: number; y0: number; y1: number }; rect?: boolean; poly?: P[]; hole?: { c: P; r: number } }
/** convex quad against an axis-aligned rectangle (separating axes), overlapping by more than eps */
function quadRect(q: Quad, b: Obst['box'], eps = 1e-6) {
  const axes: P[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: q[1].y - q[0].y, y: q[0].x - q[1].x }, { x: q[2].y - q[1].y, y: q[1].x - q[2].x }]
  const R = [{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }]
  for (const ax of axes) {
    const n = Math.hypot(ax.x, ax.y), pr = (v: P) => (v.x * ax.x + v.y * ax.y) / n
    const a = q.map(pr), c = R.map(pr)
    if (Math.min(Math.max(...a), Math.max(...c)) - Math.max(Math.min(...a), Math.min(...c)) <= eps) return false
  }
  return true
}

/**
 * The side-section simulation: the box sliced across x, each slice's lid plate and lid frame (thickness tf) as
 * rectangles in (y, z) turned together about the axis, angle by angle, against what stands in that slice: the cheek
 * (with its hole), the support, the collar the lid rests on, the base. The first angle at which anything overlaps, and
 * which parts.
 */
function firstContact(as: Asm, tf: number, upTo: number, step = 0.1) {
  const { axis, zA, t, H } = as
  const xMax = as.tab.x1 + 1, xs: number[] = []
  for (let x = 0; x <= xMax; x += 0.25) xs.push(x)
  // and on either side of every place a slice changes: the support's narrowing, its sides, the cheeks' faces, the strip's sides
  const supTop = Math.max(...as.support.prof[0].map(q => q.y))
  for (const v of [as.supHalf, as.cheek.x0, as.cheek.x1, as.tab.strip, ...sectionAt(swap(as.support.prof), supTop - 3).flat().map(Math.abs)]) xs.push(v - 0.01, v + 0.01)
  const slices = [...xs, ...xs.map(x => -x)].map(x => {
    const lidR = [
      ...sectionAt(as.lidPlan, x).map(([y0, y1]) => ({ part: 'plate', y0, y1, z0: zA - t / 2, z1: zA + t / 2 })),
      ...sectionAt(as.framePlan, x).map(([y0, y1]) => ({ part: 'frame', y0, y1, z0: zA + t / 2, z1: zA + t / 2 + tf })),
    ]
    const ob: Obst[] = []
    if (Math.abs(x) >= as.cheek.x0 - 1e-9 && Math.abs(x) <= as.cheek.x1 + 1e-9) ob.push({ part: 'cheek', box: boxOf(as.cheek.outer), poly: as.cheek.outer, hole: as.hole })
    for (const [z0, z1] of sectionAt(as.support.prof, x)) ob.push({ part: 'support', box: { x0: as.support.y0, x1: as.support.y1, y0: z0, y1: z1 }, rect: true })
    for (const [y0, y1] of sectionAt(as.collarPlan, x)) ob.push({ part: 'collar', box: { x0: y0, x1: y1, y0: H, y1: H + t - 0.02 }, rect: true })
    for (const [y0, y1] of sectionAt(as.basePlan, x)) ob.push({ part: 'base', box: { x0: y0, x1: y1, y0: -t, y1: 0 }, rect: true })
    return { x, lidR, ob }
  })
  for (let k = 1; k * step <= upTo + 1e-9; k++) {
    const a = (k * step * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a)
    const rot = (y: number, z: number) => ({ x: axis.y + (y - axis.y) * c - (z - axis.z) * s, y: axis.z + (y - axis.y) * s + (z - axis.z) * c })
    const pairs = new Set<string>()
    let where = 0
    for (const sl of slices) for (const r of sl.lidR) {
      const q = [rot(r.y0, r.z0), rot(r.y1, r.z0), rot(r.y1, r.z1), rot(r.y0, r.z1)], qb = boxOf(q)
      for (const o of sl.ob) {
        if (qb.x0 > o.box.x1 || qb.x1 < o.box.x0 || qb.y0 > o.box.y1 || qb.y1 < o.box.y0) continue
        const hit = o.rect ? quadRect(q, o.box) : polysOverlap(q, o.poly!) && !q.every(v => Math.hypot(v.x - o.hole!.c.x, v.y - o.hole!.c.y) < o.hole!.r - 1e-9)
        if (hit) { pairs.add(`${r.part}/${o.part}`); where = sl.x }
      }
    }
    if (pairs.size) return { deg: Math.round(k * step * 1000) / 1000, pairs: [...pairs].sort(), x: where }
  }
  return null
}

describe('hexagonal ring box: the lift-off lid (lid type 1) as release 3.0 cut it', () => {
  it('the same pieces and the same words, to the byte, whatever the new controls say', () => {
    const h = (v: unknown) => createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 12)
    // (hashed from release 3.0, commit 8b63fd4)
    const was: [Record<string, number>, Record<string, number>, string, string][] = [
      [{}, {}, 'd67c697ea580', '75f699f7d1b8'],
      [{}, { t: 2, kerf: 0 }, '151b04cb966d', 'a6ff96293112'],
      [{ S: 40, H: 25 }, { t: 4, kerf: 0.2 }, '2c91004336ad', '37970299063f'],
      [{ S: 160, H: 120, b: 15 }, { t: 6 }, 'aede6353fd09', 'cbb8acbe504e'],
      [{ ov: 10, tf: 4, lipL: 2, gap: 1 }, { t: 2.7 }, 'a2dc53effb23', 'c3ec69ece827'],
      [{ insert: 0, slitL: 30 }, { t: 3 }, '9db0cd38defe', '75f699f7d1b8'],
      [{ slitW: 4, fit: 0.5 }, { t: 3, kerf: 0.1 }, '6230c1c706e6', '75f699f7d1b8'],
    ]
    for (const [p, s, panels, words] of was) for (const extra of [{}, { lidType: 1 }, { lidType: 1, stop: 95 }, { lidType: 1, stop: 105 }] as Record<string, number>[]) {
      const d = generate(tpl, { ...p, ...extra }, { ...DEFAULT_SETTINGS, ...s })
      expect([h(d.panels.map(pn => [pn.id, pn.name, pn.w, pn.h, pn.count, pn.material, pn.loops])), h([d.errors, d.warnings, d.notes])], `${JSON.stringify({ ...p, ...extra })} ${JSON.stringify(s)}`).toEqual([panels, words])
    }
  })
})

describe('hexagonal ring box: the hinged lid (lid type 2)', () => {
  const P0: Record<string, number> = { ...tpl.defaults, lidType: 2 }
  const build = (p: Record<string, number>, t = 3) => { const pp = { ...P0, ...p }; const d = generate(tpl, pp, { ...S0, t }); return { d, pp } }

  it('swaps the lid and base for hinged ones, drops the lip, and adds two cheeks and a support', () => {
    const { d } = build({})
    expect(d.errors).toEqual([]); expect(d.warnings).toEqual([])
    const ids = d.panels.map(p => p.id)
    expect(ids).not.toContain('lip')
    for (const id of ['base', 'wall', 'collar', 'lid', 'cheek', 'support', 'frame', 'lid-frame', 'insert', 'spacer']) expect(ids).toContain(id)
    expect(panel(d, 'cheek').count).toBe(2); expect(panel(d, 'support').count).toBe(1)
    for (const id of ['base', 'lid', 'cheek', 'support']) expect(panel(d, id).material).toBeUndefined() // the clear sheet
    expect(panel(d, 'lid-frame').material).toBe('mirror')
    // the base's hexagon and its 12 wall slots stay; 3 slots more behind it
    expect(holesOf(panel(d, 'base')).length).toBe(12 + 3)
    // the pieces the reference checked (ringhinge.py, 3 mm, 100°): base 19.69 behind the hexagon, lid 9.5, hole Ø 6.23
    expect(panel(d, 'base').h - 68).toBeCloseTo(19.687, 2)
    expect(panel(d, 'lid').h - 68).toBeCloseTo(9.5, 3)
    const as = assemble(d, { ...P0 }, 3)
    expect(2 * as.hole.r).toBeCloseTo(Math.hypot(5, 3) + 0.4, 2)
    // the notes: the assembly order, the glue kept off the hinge, wax, the 2 mm mirror frame, measuring the sheet; no Arabic text drawn
    const words = d.notes.join(' ')
    for (const w of ['ترتيب تركيب المفصل', 'خدّي المفصل على لسانيه', 'والغطاء مغلق', 'أبعد الغراء عن لساني المفصل', 'بشمع', 'مرايا 2 مم بالضبط', 'قِس سماكة الأكريليك', '100°']) expect(words).toContain(w)
    expect(words).not.toContain('الشفة')
  })

  it('the pivot tab turns in its hole at every angle, and reaches through the cheek', () => {
    for (const t of [2, 3, 4]) for (const stop of [99, 100, 105]) {
      const { d, pp } = build({ stop }, t)
      expect(d.errors, `t=${t} ${stop}°`).toEqual([])
      const as = assemble(d, pp, t)
      expect(as.holeCount).toBe(1); expect(as.circlePts).toBe(2)
      // the cheek, standing on its tab in its slot, carries its hole on the lid's axis (the tabs' middle, at the lid's mid-plane)
      expect(Math.abs(as.hole.c.x - as.axis.y), `t=${t} ${stop}° hole y`).toBeLessThan(2e-3)
      expect(Math.abs(as.hole.c.y - as.axis.z), `t=${t} ${stop}° hole z`).toBeLessThan(2e-3)
      // the tab's section (tabW × t about the axis) inside the hole at every angle, with play
      const w = as.tab.y1 - as.tab.y0
      expect(w).toBeCloseTo(HEX_HINGE.tabW, 6)
      for (let a = 0; a <= stop + 15; a += 1) {
        const c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180)
        for (const [dy, dz] of [[-w / 2, -t / 2], [w / 2, -t / 2], [w / 2, t / 2], [-w / 2, t / 2]]) expect(Math.hypot(dy * c - dz * s, dy * s + dz * c)).toBeLessThan(as.hole.r - 0.15)
      }
      // the strip clears the cheek's inside face, and the tab's end stands out past the cheek's outside face
      expect(as.cheek.x0 - as.tab.strip).toBeCloseTo(HEX_HINGE.gap, 2)
      expect(as.tab.x1 - as.cheek.x1).toBeCloseTo(HEX_HINGE.out, 2)
      // acrylic all round the hole: at least `wood` to the cheek's outline
      const minEdge = Math.min(...as.cheek.outer.map(q => Math.hypot(q.x - as.hole.c.x, q.y - as.hole.c.y)))
      expect(minEdge - as.hole.r).toBeGreaterThan(HEX_HINGE.wood - 0.01)
    }
  })

  it('the base slots match the cheeks\' and the support\'s tabs; the support stands between the cheeks', () => {
    for (const t of [2, 3, 4]) for (const fit of [0, 0.1, 0.3]) {
      const { d, pp } = build({ fit }, t)
      expect(d.errors).toEqual([])
      const as = assemble(d, pp, t)
      expect(as.cheekSlots.length).toBe(2); expect(as.supSlots.length).toBe(1)
      const [L, R] = as.cheekSlots, S = as.supSlots[0]
      expect(L.cx).toBeCloseTo(-R.cx, 3); expect(L.cy).toBeCloseTo(R.cy, 3); expect(S.cx).toBeCloseTo(0, 3)
      // each slot is its tab plus the fit, and the tabs go through the base (t deep)
      expect(R.w).toBeCloseTo(t + fit, 3); expect(R.h).toBeCloseTo(as.cheekTab.x1 - as.cheekTab.x0 + fit, 3); expect(as.cheekTab.depth).toBeCloseTo(t, 3)
      expect(S.h).toBeCloseTo(t + fit, 3); expect(S.w).toBeCloseTo(as.supTab.x1 - as.supTab.x0 + fit, 3); expect(as.supTab.depth).toBeCloseTo(t, 3)
      // the support between the cheeks, 0.1 mm clear of each (for the glue), its back face no further back than the cheeks'
      expect(as.cheek.x0 - as.supHalf).toBeCloseTo(0.1, 3)
      expect(as.cheek.back).toBeLessThanOrEqual(as.support.y0 + 1e-3)
      // every slot inside the base's strip with acrylic round it
      const outer = as.basePlan.reduce((a, b) => (Math.abs(polyArea(b)) > Math.abs(polyArea(a)) ? b : a))
      for (const sl of [L, R, S]) for (const q of [{ x: sl.cx - sl.w / 2 - 1, y: sl.cy - sl.h / 2 - 1 }, { x: sl.cx + sl.w / 2 + 1, y: sl.cy + sl.h / 2 + 1 }]) expect(pointIn(q, outer)).toBe(true)
    }
  })

  it('a cheek fits its slot only the right way round: turned front to back on the tab, its tab misses the slot', () => {
    for (const t of [2, 3, 4]) for (const stop of [97, 100, 105]) {
      const { d, pp } = build({ stop, tf: 1.5 }, t)
      expect(d.errors, `t=${t} ${stop}°`).toEqual([])
      const as = assemble(d, pp, t), slot = as.cheekSlots[1]
      // the tab sits behind the hole; turned round about the hole (which stays on the pivot tab) it lands in front of it
      expect(as.cheek.tabC).toBeLessThan(as.hole.c.x)
      const turned = 2 * as.hole.c.x - as.cheek.tabC
      expect(Math.abs(turned - slot.cy), `t=${t} ${stop}°`).toBeGreaterThan(2)
    }
  })

  // what the lid meets as it opens, sliced across the box: first the plate on the support, at the stop, nothing before
  const simulate = (p: Record<string, number>, t: number, margin = 0) => {
    const { d, pp } = build(p, t)
    const as = assemble(d, pp, t)
    return { d, pp, hit: firstContact(as, pp.tf + margin, pp.stop + 1.5) }
  }
  const expectStop = (p: Record<string, number>, t: number, margin = 0) => {
    const { d, pp, hit } = simulate(p, t, margin)
    const label = `${JSON.stringify(p)} t=${t}${margin ? ` frame +${margin}` : ''}`
    expect(d.errors, label).toEqual([])
    expect(hit, label).not.toBeNull()
    expect(hit!.pairs, `${label} at ${hit!.deg}° x=${hit!.x}`).toEqual(['plate/support'])
    expect(Math.abs(hit!.deg - pp.stop), label).toBeLessThanOrEqual(0.5)
    return hit!
  }

  it('the reference box (62 mm, 3 mm, 100°): the plate meets the support at the stop, nothing touches before, even with the frame 0.4 mm thicker', () => {
    const hit = expectStop({}, 3)
    expect(Math.abs(hit.x)).toBeLessThanOrEqual(HEX_HINGE.upHalf + 1e-6) // on the support's narrow top
    expectStop({}, 3, HEX_HINGE.clear - 0.1)
  })

  it('so does every box the template does not refuse, across sheets, sizes, frames and stop angles', () => {
    const cases: [Record<string, number>, number][] = [
      [{}, 2], [{}, 2.7], [{}, 4], [{ stop: 105 }, 3], [{ stop: 99 }, 2.7], [{ stop: 105 }, 4], [{ S: 50, H: 25, insert: 0 }, 3], [{ S: 160, H: 120, b: 6 }, 3],
      [{ ov: 10, tf: 1, b: 8 }, 3], [{ S: 40, ov: 2 }, 2], [{ S: 45, b: 3, tf: 1 }, 2], [{ fit: 0.5, gap: 1, insert: 0 }, 3], [{ tf: 0.5, stop: 96 }, 3],
    ]
    for (const [p, t] of cases) expectStop(p, t)
    // and a spread of random ones: whenever no error is reported, the simulation agrees
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    let ok = 0, refused = 0
    for (let i = 0; i < 40; i++) {
      const p = { S: 40 + Math.round(rnd() * 120), H: 25 + Math.round(rnd() * 95), ov: 2 + Math.round(rnd() * 16) / 2, b: 2 + Math.round(rnd() * 16) / 2, tf: 0.5 + Math.round(rnd() * 5) / 2, stop: 95 + Math.round(rnd() * 10) }
      const t = [2, 2.7, 3, 3.2, 4, 4.4, 5][Math.floor(rnd() * 7)]
      const { d } = build(p, t)
      if (d.errors.length) { refused++; continue }
      expectStop(p, t); ok++
    }
    expect(ok).toBeGreaterThan(8); expect(refused).toBeGreaterThan(3)
  }, 120_000)

  it('refuses what cannot work, and its suggestions do', () => {
    // a sheet so thick that the cheek's half circle reaches the lid's corners
    expect(build({}, 6).d.errors.join(' ')).toMatch(/اللوح سميك على مفصل الغطاء: .* أقصى سماكة للغطاء المفصلي 4.4 مم/)
    expect(build({}, 4.4).d.errors).toEqual([])
    // at 95° the 2 mm frame's back band would meet the support before the plate: it names the least angle, which works
    const low = build({ stop: 95 }).d.errors.join(' ')
    expect(low).toMatch(/إطار الغطاء يلمس السندة قبل الغطاء/)
    const aMin = Number(low.match(/اجعل زاوية التوقّف ([\d.]+)° على الأقل/)![1])
    expect(aMin).toBeGreaterThan(95); expect(aMin).toBeLessThanOrEqual(100)
    expectStop({ stop: aMin }, 3)
    // and the simulation agrees there is a reason: at 95° the frame touches no later than the plate
    const { hit } = simulate({ stop: 95 }, 3)
    expect(hit!.pairs).toContain('frame/support')
    // a 3 mm frame at 100°: the stop depends on the 2 mm frame
    expect(build({ tf: 3 }).d.errors.join(' ')).toMatch(/إطار الغطاء يلمس السندة/)
    // a wide frame on a small box leaves no opening for the support
    expect(build({ S: 40, b: 15 }).d.errors.join(' ')).toMatch(/فتحة إطار الغطاء أضيق/)
  })
})

function polyArea(p: P[]) { let a = 0; for (let i = 0; i < p.length; i++) { const u = p[i], v = p[(i + 1) % p.length]; a += u.x * v.y - v.x * u.y } return a / 2 }

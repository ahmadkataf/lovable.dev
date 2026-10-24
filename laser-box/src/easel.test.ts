import { describe, it, expect } from 'vitest'
import { EASELS, easelGeom, easelStrips, stripLen } from './easel'
import { generate, DEFAULT_SETTINGS } from './generate'
import { toDXF } from './export'
import { signedArea, bbox, Loop } from './geom'
import { samplePoly, pointIn, polysOverlap, selfIntersects, P } from './testutil'

const tpl = EASELS[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
const C = (t: number) => ({ t, kerf: 0, finger: 3 * t, inner: false })
type Pn = { id: string; name: string; loops: Loop[]; w: number; h: number; count: number }
const closedOf = (pn: Pn) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const holesOf = (pn: Pn) => closedOf(pn).filter(l => signedArea(l) < 0)
const outerOf = (pn: Pn) => closedOf(pn).find(l => signedArea(l) > 0)!
const box = (l: Loop) => { const b = bbox([l]); return { x0: b.minX, x1: b.maxX, y0: b.minY, y1: b.maxY, w: b.maxX - b.minX, h: b.maxY - b.minY, cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2 } }
/** runs of the outline lying on the line x = X (vertical) or y = Y (horizontal) */
const runs = (pn: Pn, axis: 'x' | 'y', v: number) => { const o = outerOf(pn).pts, out: { a: number; b: number }[] = []; for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; if (Math.abs(p[axis] - v) < 1e-6 && Math.abs(q[axis] - v) < 1e-6 && !p.b) { const o2 = axis === 'x' ? 'y' : 'x'; out.push({ a: Math.min(p[o2], q[o2]), b: Math.max(p[o2], q[o2]) }) } } return out }

/** true when two polygons come closer than thr (vertex-to-segment both ways, with per-segment boxes) */
function closerThan(A: P[], B: P[], thr: number): boolean {
  const near = (V: P[], E: P[]) => {
    const n = E.length, bb = E.map((p, i) => { const q = E[(i + 1) % n]; return [Math.min(p.x, q.x) - thr, Math.max(p.x, q.x) + thr, Math.min(p.y, q.y) - thr, Math.max(p.y, q.y) + thr] })
    for (const v of V) for (let i = 0; i < n; i++) {
      const b = bb[i]
      if (v.x < b[0] || v.x > b[1] || v.y < b[2] || v.y > b[3]) continue
      const a = E[i], c = E[(i + 1) % n], dx = c.x - a.x, dy = c.y - a.y, l2 = dx * dx + dy * dy
      const k = l2 ? Math.max(0, Math.min(1, ((v.x - a.x) * dx + (v.y - a.y) * dy) / l2)) : 0
      if (Math.hypot(v.x - a.x - k * dx, v.y - a.y - k * dy) < thr) return true
    }
    return false
  }
  return near(A, B) || near(B, A)
}
/** one outer loop, nothing crossing itself, no zero-length edge, every hole inside by `margin` and `web` from the others */
function soundPanel(pn: Pn, label: string, margin = 0.8, web = 0.8) {
  const bad: string[] = []
  const closed = closedOf(pn), outers = closed.filter(l => signedArea(l) > 0)
  if (outers.length !== 1) bad.push(`${outers.length} outer loops`)
  const outer = samplePoly(outers[0] ?? closed[0], 10)
  if (selfIntersects(outer)) bad.push('outline self-intersects')
  for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; if (Math.hypot(q.x - outer[i].x, q.y - outer[i].y) <= 1e-6) bad.push('zero-length edge') }
  const hs = closed.filter(l => signedArea(l) < 0).map(h => ({ p: samplePoly(h, 10), b: bbox([h]) }))
  hs.forEach((h, i) => {
    if (polysOverlap(h.p, outer) && !pointIn(h.p[0], outer)) bad.push(`hole ${i} outside`)
    if (!h.p.every(q => pointIn(q, outer))) bad.push(`hole ${i} has a vertex outside`)
    if (closerThan(h.p, outer, margin - 1e-9)) bad.push(`hole ${i} too close to the edge`)
    if (selfIntersects(h.p)) bad.push(`hole ${i} self-intersects`)
  })
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
    const a = hs[i].b, b = hs[j].b
    if (a.minX > b.maxX + web || b.minX > a.maxX + web || a.minY > b.maxY + web || b.minY > a.maxY + web) continue
    if (closerThan(hs[i].p, hs[j].p, web - 1e-9)) bad.push(`holes ${i} and ${j} too close`)
  }
  expect(bad, `${label} ${pn.id}`).toEqual([])
}

describe('the tripod easel', () => {
  it('builds at its defaults: three laminated layers with staggered joints, crossbars, rear leg, hinge bracket, tray and clamp', () => {
    for (const t of [2.7, 3, 3.2]) {
      const d = generate(tpl, {}, { ...S0, t })
      expect(d.errors, `t=${t}`).toEqual([])
      const ids = d.panels.map(p => p.id)
      for (const id of ['barU', 'barL', 'rear', 'br-plate', 'br-cheek', 'tray-shelf', 'tray-lip', 'tray-end', 'tray-back', 'clamp-plate', 'clamp-lip']) expect(ids, `t=${t}`).toContain(id)
      for (const l of [1, 2, 3]) for (const s of ['a', 'b']) { expect(ids).toContain(`leg-${l}${s}`); expect(ids).toContain(`mast-${l}${s}`) }
      expect(d.panels.find(p => p.id === 'leg-2a')!.name).toBe('الرجل الأمامية — الطبقة 2، القطعة السفلية')
      expect(d.panels.find(p => p.id === 'barU')!.count).toBe(3)
      for (const p of d.panels) { soundPanel(p, `t=${t}`); expect(Math.max(p.w, p.h), `${p.id} fits the bed`).toBeLessThanOrEqual(tpl.defaults.maxL + 1e-6) }
      expect(d.notes.join(' ')).toMatch(/M8/)
      expect(d.notes.join(' ')).toMatch(/لوحة الترحيب/)
    }
    // n easels: every count multiplied
    const one = generate(tpl, {}, S0), two = generate(tpl, { n: 2 }, S0)
    for (const p of one.panels) expect(two.panels.find(q => q.id === p.id)!.count).toBe(2 * p.count)
  })

  it('bolt holes line up: legs, mast and crossbars cross at the same points; feet and tops are level; the rear leg stands flat', () => {
    for (const v of [{}, { spread: 800, top: 260 }, { L: 1800, hU: 1500, hL: 500, angle: 30 }, { w: 60, bolt: 10 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, g = easelGeom(p, C(3.2)), st = easelStrips(g)
      const { k, phi, w } = g
      // right leg: strip x = a + k, y = w/2 - b, mapped into the frame
      const leg = (x: number, y: number) => { const a = x - k, b = w / 2 - y; return { X: p.spread / 2 - a * Math.sin(phi) + b * Math.cos(phi), Y: a * Math.cos(phi) + b * Math.sin(phi) } }
      const legHoles = st.leg.holes.slice(0, 2).map(x => leg(x, w / 2))
      for (const [i, h] of [p.hL, p.hU].entries()) {
        expect(legHoles[i].Y, JSON.stringify(v)).toBeCloseTo(h, 6)
        expect(legHoles[i].X, JSON.stringify(v)).toBeCloseTo(g.xc(h), 6)
        const bar = h === p.hU ? st.barU : st.barL, Lc = h === p.hU ? g.LcU : g.LcL
        const xs = bar.holes.map(x => x - Lc / 2)
        expect(xs.some(x => Math.abs(x - legHoles[i].X) < 1e-6), 'crossbar hole at the right leg').toBe(true)
        expect(xs.some(x => Math.abs(x + legHoles[i].X) < 1e-6), 'crossbar hole at the left leg').toBe(true)
        expect(xs.some(x => Math.abs(x) < 1e-6), 'crossbar hole at the mast').toBe(true)
        expect(st.mast.holes.some(x => Math.abs(x - h) < 1e-6), 'mast hole').toBe(true)
        // the crossbar reaches past the legs' outer edges
        expect(Lc / 2, 'overhang').toBeGreaterThan(g.xc(h - w / 2) + w / 2 / Math.cos(phi))
      }
      // both ends of a leg are cut level: the foot on the floor, the top at Hf
      if (st.leg.A.kind !== 'line' || st.leg.B.kind !== 'line') throw new Error('leg ends')
      expect(leg(st.leg.A.x0, 0).Y).toBeCloseTo(0, 6); expect(leg(st.leg.A.x1, w).Y).toBeCloseTo(0, 6)
      expect(leg(st.leg.B.x0, 0).Y).toBeCloseTo(g.Hf, 6); expect(leg(st.leg.B.x1, w).Y).toBeCloseTo(g.Hf, 6)
      // the frame leans back beta and stands on the back edges of its square-cut feet (s = 0, z = Tl): nothing of it below
      // the floor; the rear leg from its hinge down at gamma from the vertical: both foot corners on the floor
      const lift = (s: number, z: number) => s * Math.cos(g.beta) - (z - g.Tl) * Math.sin(g.beta)
      expect(lift(0, g.Tl)).toBeCloseTo(0, 9); expect(lift(0, 0)).toBeGreaterThan(0)
      const hx = g.kr + g.R, Hz = lift(g.hinge, g.zh)
      const rearZ = (x: number, y: number) => Hz - (hx - x) * Math.cos(g.gamma) + (w / 2 - y) * Math.sin(g.gamma)
      if (st.rear.A.kind !== 'line') throw new Error('rear foot')
      expect(rearZ(st.rear.A.x0, 0)).toBeCloseTo(0, 6); expect(rearZ(st.rear.A.x1, w)).toBeCloseTo(0, 6)
      expect(st.rear.holes[0]).toBeCloseTo(hx, 6)
      expect(g.theta / Math.PI * 180).toBeCloseTo(p.angle, 6)
      expect(g.beta + g.gamma).toBeCloseTo(g.theta, 9)
      // the slots: bolt + 0.5 wide, at least 2w/5 of wood either side, clear of the crossbar bolts
      expect(g.sw).toBeCloseTo(p.bolt + 0.5, 9)
      expect((w - g.sw) / 2).toBeGreaterThanOrEqual(0.4 * w - 1e-9)
      for (const [a, b] of st.mast.slots) for (const h of [p.hL, p.hU]) expect(h < a - g.rs - g.hr - 2 || h > b + g.rs + g.hr + 2).toBe(true)
    }
  })

  it('laminates: every layer is the whole strip, joints at least 150 mm apart and off the holes; one layer gets splice plates', () => {
    for (const v of [{}, { layers: 2 }, { L: 2200, Lm: 2500, maxL: 1400 }, { maxL: 1100, layers: 2 }, { layers: 1 }, { layers: 1, maxL: 1000 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = JSON.stringify(v)
      const d = generate(tpl, p, { ...S0, t: 3.2 })
      expect(d.errors, label).toEqual([])
      const g = easelGeom(p, C(3.2)), st = easelStrips(g)
      for (const [id, s, cuts] of [['leg', st.leg, st.legCuts!], ['mast', st.mast, st.mastCuts!], ['rear', st.rear, st.rearCuts!]] as const) {
        const S = stripLen(s)
        if (S <= p.maxL) { expect(cuts, `${label} ${id}`).toEqual([]); continue }
        expect(cuts.length, `${label} ${id} one cut per layer`).toBe(p.layers)
        for (let i = 0; i < cuts.length; i++) for (let j = i + 1; j < cuts.length; j++) expect(Math.abs(cuts[i] - cuts[j]), `${label} ${id} stagger`).toBeGreaterThanOrEqual(150 - 1e-9)
        for (const [i, c] of cuts.entries()) {
          const a = d.panels.find(q => q.id === `${id}-${i + 1}a`)!, b = d.panels.find(q => q.id === `${id}-${i + 1}b`)!
          expect(a.w + b.w, `${label} ${id} layer ${i + 1} length`).toBeCloseTo(S, 3)
          expect(Math.max(a.w, b.w), `${label} ${id} fits`).toBeLessThanOrEqual(p.maxL + 1e-6)
          // the holes of the two pieces, back in strip coordinates, are all the strip's holes
          const cs = [...holesOf(a).map(h => box(h)).filter(h => Math.abs(h.w - h.h) < 1e-6).map(h => h.cx), ...holesOf(b).map(h => box(h)).filter(h => Math.abs(h.w - h.h) < 1e-6).map(h => h.cx + c)]
          expect(cs.sort((x, y) => x - y).map(x => Math.round(x * 100))).toEqual([...s.holes].sort((x, y) => x - y).map(x => Math.round(x * 100)))
          for (const h of s.holes) expect(Math.abs(h - c), `${label} ${id} cut clear of the holes`).toBeGreaterThan(g.hr + 2)
        }
        if (p.layers === 1) {
          const sp = d.panels.find(q => q.id === `${id}-splice`)!
          expect(sp.count, `${label} two plates per joint`).toBe(id === 'leg' ? 4 : 2)
          expect(holesOf(sp).length).toBe(2)
          expect(s.holes.filter(h => Math.abs(Math.abs(h - cuts[0]) - g.Ls / 4) < 1e-6).length, `${label} ${id} splice holes`).toBe(2)
          // the splice plates keep off the crossbars, and the tray and clamp slots stop short of them
          if (id === 'mast') for (const h of [p.hL, p.hU]) expect(Math.abs(h - cuts[0]), `${label} mast splice off the crossbar`).toBeGreaterThan(g.Ls / 2 + p.w / 2)
          if (id === 'mast') for (const [a0, b0] of s.slots) expect(b0 < cuts[0] - g.Ls / 2 || a0 > cuts[0] + g.Ls / 2, `${label} slot clear of the splice`).toBe(true)
        } else expect(d.panels.some(q => q.id === `${id}-splice`)).toBe(false)
      }
    }
  })

  it('tabs find their slots: the tray back in the shelf behind the horns, the hinge cheeks in their plate', () => {
    for (const t of [2.7, 3.2, 4, 6]) for (const v of [{}, { fit: 0.4, w: 60 }, { layers: 1 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const g = easelGeom(p, C(t)), P_ = (id: string) => d.panels.find(q => q.id === id)!
      const shelf = P_('tray-shelf'), back = P_('tray-back'), plate = P_('br-plate'), cheek = P_('br-cheek')
      // shelf: two slots t + fit wide, the tab + fit long, mirrored about the middle; the horns hug the mast with the fit
      const ss = holesOf(shelf).map(box)
      expect(ss.length, label).toBe(2)
      for (const s of ss) { expect(s.h, label).toBeCloseTo(t + p.fit, 6); expect(s.w, label).toBeCloseTo(g.tabB - g.tabA + p.fit, 6) }
      expect(ss[0].cx + ss[1].cx, label).toBeCloseTo(shelf.w, 6)
      const tabs = runs(back, 'y', 0)
      expect(tabs.length, label).toBe(2)
      for (const r of tabs) expect(r.b - r.a, label).toBeCloseTo(g.tabB - g.tabA, 6)
      expect(Math.abs((tabs[0].a + tabs[0].b) / 2 - back.w / 2), label).toBeCloseTo(Math.abs(ss[0].cx - shelf.w / 2), 6)
      const horns = runs(shelf, 'y', 0)
      expect(horns.length, `${label} two horns`).toBe(2)
      expect(horns[1].a - horns[0].b, `${label} the notch round the mast`).toBeCloseTo(p.w + 1, 6)
      expect(Math.min(...ss.map(s => s.y0)), `${label} wood behind the slots`).toBeGreaterThanOrEqual(2 - 1e-9)
      // bracket: four slots, two per cheek, as far apart as the rear leg's stack and a millimetre
      const ps = holesOf(plate).map(box).filter(b => Math.abs(b.w - b.h) > 1e-3)
      expect(ps.length, label).toBe(4)
      for (const s of ps) { expect(s.w, label).toBeCloseTo(t + p.fit, 6); expect(s.h, label).toBeCloseTo(g.chTab + p.fit, 6) }
      const xs = [...new Set(ps.map(s => Math.round(s.cx * 1000) / 1000))].sort((a, b) => a - b)
      expect(xs[1] - xs[0] - t, `${label} the rear leg fits between the cheeks`).toBeCloseTo(g.Tl + 1, 6)
      const ct = runs(cheek, 'x', 0)
      expect(ct.length, label).toBe(2)
      for (const r of ct) expect(r.b - r.a, label).toBeCloseTo(g.chTab, 6)
      const ys = [...new Set(ps.map(s => Math.round(s.cy * 1000) / 1000))].sort((a, b) => a - b)
      expect(ys.map(y => y - (p.w + 2)), label).toEqual(ct.map(r => (r.a + r.b) / 2).sort((a, b) => a - b).map(y => expect.closeTo(y, 6)))
      // the bolt holes of the plate sit on the crossbar's centre line, the side ones clear of the mast
      const bh = holesOf(plate).map(box).filter(b => Math.abs(b.w - b.h) < 1e-3)
      expect(bh.length).toBe(3)
      for (const b of bh) expect(b.cy).toBeCloseTo(p.w / 2, 6)
    }
  })

  it('refuses what cannot be cut or assembled, saying which value to set, and the value it names works', () => {
    const check = (v: Record<string, number>, re: RegExp, fix: (msg: string) => Record<string, number>) => {
      const d = generate(tpl, v, { ...S0, t: 3.2 })
      const e = d.errors.find(x => re.test(x))
      expect(e, `${JSON.stringify(v)}: ${d.errors.join(' | ')}`).toBeTruthy()
      expect(e!, 'Arabic with a number').toMatch(/[\u0600-\u06ff].*\d/)
      const d2 = generate(tpl, { ...v, ...fix(e!) }, { ...S0, t: 3.2 })
      expect(d2.errors.filter(x => re.test(x)), `${JSON.stringify(v)} fixed by ${JSON.stringify(fix(e!))}`).toEqual([])
    }
    const num = (msg: string, i = 0) => Number([...msg.matchAll(/(\d+(?:\.\d+)?) مم أو (?:أكثر|أقلّ)/g)][i][1])
    check({ w: 22 }, /مجرى الصاري/, m => ({ w: num(m) }))
    check({ w: 40 }, /مجرى الصاري/, m => ({ w: num(m) }))
    check({ w: 40 }, /مجرى الصاري/, m => ({ bolt: num(m, 1) }))
    check({ hU: 900, hL: 800 }, /بين العارضتين/, m => ({ hU: num(m) }))
    check({ hU: 900, hL: 800 }, /بين العارضتين/, m => ({ hL: num(m, 1) }))
    check({ hL: 30 }, /العارضة السفلية/, m => ({ hL: num(m) }))
    check({ hU: 1480 }, /رأسي الرجلين/, m => ({ hU: num(m) }))
    check({ hU: 1480 }, /رأسي الرجلين/, m => ({ L: num(m, 1) }))
    check({ Lt: 1200, maxL: 1000, layers: 2 }, /الرفّ .* أطول من سرير الليزر/, m => ({ Lt: num(m) }))
    check({ w: 100, Lt: 150 }, /الحضن حول الصاري/, m => ({ Lt: num(m) }))
    check({ Lm: 1400 }, /الصاري قصير/, m => ({ Lm: num(m) }))
    check({ top: 90 }, /قريبتان من الصاري/, m => ({ top: num(m) }))
    check({ spread: 1400 }, /منفرجتان/, m => ({ spread: num(m) }))
    check({ maxL: 640 }, /العارضة السفلية طولها/, m => ({ maxL: num(m) }))
    check({ maxL: 640 }, /العارضة السفلية طولها/, m => ({ spread: num(m, 1) }))
    check({ Lt: 1200, maxL: 1000, layers: 2 }, /الرفّ .* أطول من سرير الليزر/, m => ({ maxL: num(m, 1) }))
    check({ maxL: 700 }, /قسم الرجل الأمامية/, m => ({ maxL: num(m) }))
    const top = generate(tpl, { top: 700 }, { ...S0, t: 3.2 }).errors
    expect(top.join(' '), 'top wider than the feet').toMatch(/أصغر من «المسافة بين القدمين الأماميتين»/)
  })

  it('robustness grid: every thickness and kerf, every parameter at its ends: sound geometry or a clear error', () => {
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    let n = 0, refused = 0
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const kerf of [0, 0.2]) for (const v of variants) {
      const label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      let d
      try { d = generate(tpl, v, { ...DEFAULT_SETTINGS, t, kerf }) } catch (e) { throw new Error(`${label} threw: ${(e as Error).message}`) }
      n++
      expect(d.panels.every(pn => pn.loops.every(l => l.pts.every(q => Number.isFinite(q.x) && Number.isFinite(q.y)))), `${label} non-finite`).toBe(true)
      if (d.errors.length) { refused++; for (const e of d.errors) expect(e, label).toMatch(/[\u0600-\u06ff]/); continue }
      expect(d.layout.w, label).toBeLessThanOrEqual(Math.max(DEFAULT_SETTINGS.sheetW, Math.max(...d.panels.map(p => p.w))) + 1e-6)
      for (const pn of d.panels) { expect(pn.w, `${label} ${pn.id} width`).toBeGreaterThan(0); soundPanel(pn, label) }
      const dxf = toDXF(d.layout)
      expect(dxf.includes('NaN') || dxf.includes('undefined'), `${label} dxf`).toBe(false)
    }
    expect(n).toBeGreaterThan(300)
    expect(refused).toBeLessThan(n / 2)
  })

  it('one layer: no splice plate stands in the way of the tray or the clamp sliding in front of the frame', () => {
    for (const t of [3.2, 6]) for (const v of [{ layers: 1 }, { layers: 1, maxL: 1000 }, { layers: 1, L: 1800, hU: 1500 }, { layers: 1, Lt: 1100, maxL: 1100 }, { layers: 1, L: 2200, Lm: 2600, hU: 1900, maxL: 1400 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const g = easelGeom(p, C(t)), st = easelStrips(g), co = Math.cos(g.phi), si = Math.sin(g.phi)
      // the heights a plate covers: on a leg (square to the leg, across its width), on the mast
      const bands: { y0: number; y1: number; leg: boolean }[] = [
        ...st.legCuts!.map(c => ({ y0: (c - g.Ls / 2 - g.k) * co - (g.w / 2) * si, y1: (c + g.Ls / 2 - g.k) * co + (g.w / 2) * si, leg: true })),
        ...st.mastCuts!.map(c => ({ y0: c - g.Ls / 2, y1: c + g.Ls / 2, leg: false })),
      ]
      expect(bands.length, label).toBeGreaterThan(0)
      const inner = (y: number) => g.xc(y) - g.w / (2 * co) // a leg's inner edge
      for (const [a, b] of st.slots) {
        // in front of the frame, from its bolt: the tray from the apron's foot to the top of its lip and ends, the whole
        // shelf wide; the clamp's plate and lip
        const tray = a < g.brBottom, [lo, hi, X] = tray ? [-(g.Hb - g.yb), g.yb + t + p.lip, p.Lt / 2] : [-g.hbC, g.Hc - g.hbC, g.Wc / 2]
        // over the mast: the apron and the shelf (the lip stands at the front), or the clamp's plate; the wing nut behind
        const [mlo, mhi] = tray ? [Math.min(-(g.Hb - g.yb), -g.nut), Math.max(g.yb + t, g.nut)] : [Math.min(-g.hbC, -g.nut), Math.max(g.Hc - g.hbC, g.nut)]
        for (let i = 0; i <= 20; i++) {
          const bolt = a + ((b - a) * i) / 20, y0 = bolt + lo, y1 = bolt + hi
          for (const pl of bands) {
            if (!pl.leg) { expect(bolt + mhi <= pl.y0 || bolt + mlo >= pl.y1, `${label} ${tray ? 'tray' : 'clamp'} at ${bolt.toFixed(0)} over the mast's splice`).toBe(true); continue }
            if (y1 <= pl.y0 || y0 >= pl.y1) continue
            // overlapping heights: the thing must pass beside the leg's plate, never over it
            expect(inner(Math.min(y1, pl.y1)), `${label} ${tray ? 'tray' : 'clamp'} at ${bolt.toFixed(0)} over a leg's splice`).toBeGreaterThan(X)
          }
        }
      }
      // the notes give the tray's and the clamp's ranges, piece by piece when a plate splits a slot
      const trays = st.slots.filter(([a]) => a < g.brBottom)
      if (trays.length > 1) expect(d.notes.join(' '), label).toMatch(trays.length === 2 ? /في مقطعين/ : new RegExp(`في ${trays.length} مقاطع`))
    }
    // at the defaults the leg's joint goes below the lower crossbar, out of the tray's way, and the tray keeps its whole slot
    const g = easelGeom({ ...tpl.defaults, layers: 1 }, C(3.2)), st = easelStrips(g)
    expect(st.legCuts![0] + g.Ls / 2, 'leg joint below the lower crossbar').toBeLessThan(g.aOf(g.hL - g.w / 2))
    expect(st.slots.filter(([a]) => a < g.brBottom).length).toBe(1)
  })

  it('the tray: an apron as long as the shelf under its back edge, clear of the bolt heads over its whole travel', () => {
    for (const t of [2.7, 3.2, 6]) for (const v of [{}, { Lt: 150 }, { Lt: 1300, maxL: 1300, spread: 900 }, { hL: 100, hU: 600, L: 800, Lm: 1100, top: 260 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const g = easelGeom(p, C(t)), back = d.panels.find(q => q.id === 'tray-back')!, shelf = d.panels.find(q => q.id === 'tray-shelf')!
      expect(back.w, label).toBeCloseTo(p.Lt, 6)
      expect(outerOf(shelf) && box(outerOf(shelf)).w, label).toBeCloseTo(p.Lt, 6)
      // the apron's bottom at the lowest bolt clears the bolt heads at the lower crossbar; the lip's top at the highest, those at the upper
      expect(g.s0 + g.trayBody[0], label).toBeGreaterThanOrEqual(p.hL + g.head + 1 - 1e-9)
      expect(g.s1 + g.trayBody[1], label).toBeLessThanOrEqual(p.hU - g.head - 2 + 1e-9)
      // its wing nut behind the mast clears the crossbars and the bracket
      expect(g.s0 - g.nut, label).toBeGreaterThanOrEqual(p.hL + p.w / 2 - 1e-9)
      expect(g.s1 + g.nut, label).toBeLessThanOrEqual(g.brBottom + 1e-9)
      // the picture is at most the shelf's depth less the lip's thickness
      expect(d.notes.join(' '), label).toContain(`وسماكتها حتى ${Math.round((p.d - t) * 10) / 10} مم`)
    }
  })

  it('every error names its fields by their exact labels, with values inside their ranges that clear it', () => {
    let seed = 20261010
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
    const cases: Record<string, number>[] = [{ hU: 200 }, { hU: 230, hL: 400 }, { spread: 1150, maxL: 640 }, { L: 600, spread: 1400 }, { w: 20, bolt: 4 }, { top: 900 }, { spread: 250 }]
    for (const d of tpl.params) cases.push({ [d.key]: d.min }, { [d.key]: d.max })
    for (let i = 0; i < 120; i++) {
      const v: Record<string, number> = {}
      for (const d of [...tpl.params].sort(() => rnd() - 0.5).slice(0, 2 + Math.floor(rnd() * 3))) { const st = d.step ?? 1; v[d.key] = Math.round((d.min + rnd() * (d.max - d.min)) / st) * st }
      cases.push(v)
    }
    const labels = new Set(tpl.params.map(d => d.label))
    let tried = 0
    for (const v of cases) {
      const S = { ...S0, t: 3.2 }, d = generate(tpl, v, S)
      for (const e of d.errors) {
        const kind = e.slice(0, 14)
        // every «…» in an error is a field's label as the form shows it
        for (const m of e.matchAll(/«([^»]+)»/g)) expect(labels.has(m[1]), `${JSON.stringify(v)}: ${m[1]} :: ${e}`).toBe(true)
        // «label» N مم أو أكثر/أقلّ, or «عدد الطبقات» 2: inside the range, and setting it clears this error
        const sugg = [...e.matchAll(/«([^»]+)» (\d+(?:\.\d+)?)(?: مم أو (?:أكثر|أقلّ)| مم(?= مع)|(?=[،.](?!\d)))/g)]
        if (/الشقوق والأصابع/.test(e)) continue
        expect(sugg.length, `${JSON.stringify(v)} no value to set :: ${e}`).toBeGreaterThan(0)
        for (const m of sugg) {
          const def = tpl.params.find(q => q.label === m[1])!, val = Number(m[2])
          expect(val, `${JSON.stringify(v)} ${def.key} :: ${e}`).toBeGreaterThanOrEqual(def.min)
          expect(val, `${JSON.stringify(v)} ${def.key} :: ${e}`).toBeLessThanOrEqual(def.max)
          // a pair («طول الرجل الأمامية» X مع «ارتفاع العارضة العلوية» Y) is applied together
          const pair = e.slice(m.index! + m[0].length).startsWith(' مع') ? [...e.slice(m.index! + m[0].length).matchAll(/^ مع «([^»]+)» (\d+(?:\.\d+)?)/g)][0] : null
          const patch = { [def.key]: val, ...(pair ? { [tpl.params.find(q => q.label === pair[1])!.key]: Number(pair[2]) } : {}) }
          const d2 = generate(tpl, { ...v, ...patch }, S)
          tried++
          expect(d2.errors.filter(x => x.slice(0, 14) === kind), `${JSON.stringify(v)} + ${JSON.stringify(patch)} :: ${e}`).toEqual([])
        }
      }
    }
    expect(tried).toBeGreaterThan(100)
  })

  it('random combinations of three or four settings at once (fixed seed): sound geometry or a clear error', () => {
    let seed = 4242
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
    let built = 0
    for (let i = 0; i < 160; i++) {
      const v: Record<string, number> = {}
      for (const d of [...tpl.params].sort(() => rnd() - 0.5).slice(0, 3 + Math.floor(rnd() * 2))) { const st = d.step ?? 1; v[d.key] = Math.round((d.min + rnd() * (d.max - d.min)) / st) * st }
      const t = [2, 2.7, 3, 3.2, 4, 6][Math.floor(rnd() * 6)], kerf = rnd() < 0.5 ? 0 : 0.2, label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      const d = generate(tpl, v, { ...DEFAULT_SETTINGS, t, kerf })
      if (d.errors.length) continue
      built++
      for (const pn of d.panels) soundPanel(pn, label, 0.8, 2)
      expect(toDXF(d.layout).includes('NaN'), label).toBe(false)
    }
    expect(built).toBeGreaterThan(50)
  })
})

import { describe, it, expect } from 'vitest'
import { ARCH_BOXES, archGeom, seigaiha } from './archbox'
import { generate, DEFAULT_SETTINGS } from './generate'
import { toDXF } from './export'
import { signedArea, bbox, Loop } from './geom'
import { samplePoly, pointIn, polysOverlap, selfIntersects, P } from './testutil'

const tpl = ARCH_BOXES[0]
const S0 = { ...DEFAULT_SETTINGS, kerf: 0 }
type Pn = { id: string; loops: Loop[]; w: number; h: number; count: number; material?: string }
const closedOf = (pn: Pn) => pn.loops.filter(l => l.closed && l.layer !== 'engrave')
const holesOf = (pn: Pn) => closedOf(pn).filter(l => signedArea(l) < 0)
const outerOf = (pn: Pn) => closedOf(pn).find(l => signedArea(l) > 0)!
const box = (l: Loop) => { const b = bbox([l]); return { x0: b.minX, x1: b.maxX, y0: b.minY, y1: b.maxY, w: b.maxX - b.minX, h: b.maxY - b.minY } }
/** the slots of a plate: holes about as wide as the sheet (any angle) */
const slotsOf = (pn: Pn, t: number, fit: number, tabW: number) => holesOf(pn).filter(h => { const p = samplePoly(h, 10); let best = Infinity; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; const d = Math.hypot(q.x - p[i].x, q.y - p[i].y); if (d > 0.5) best = Math.min(best, d) } return Math.abs(best - (t + fit)) < 1e-3 && Math.abs(-signedArea(h) - (t + fit) * (tabW + fit)) < 0.05 })
/** runs of the outline lying on y = yEdge: the tabs of a strip */
const edgeRuns = (pn: Pn, yEdge: number) => { const o = outerOf(pn).pts, out: number[] = []; for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; if (Math.abs(a.y - yEdge) < 1e-6 && Math.abs(b.y - yEdge) < 1e-6) out.push(Math.abs(b.x - a.x)) } return out }

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
/** every hole inside the outline by `margin`, holes `web` apart, one outer loop, nothing crossing itself */
function soundPanel(pn: Pn, label: string, margin = 0.8, web = 0.8, step = 15) {
  const bad: string[] = []
  const closed = closedOf(pn), outers = closed.filter(l => signedArea(l) > 0)
  if (outers.length !== 1) bad.push(`${outers.length} outer loops`)
  const outer = samplePoly(outers[0] ?? closed[0], step)
  if (selfIntersects(outer)) bad.push('outline self-intersects')
  for (let i = 0; i < outer.length; i++) { const q = outer[(i + 1) % outer.length]; if (Math.hypot(q.x - outer[i].x, q.y - outer[i].y) <= 1e-6) bad.push('zero-length edge') }
  const hs = closed.filter(l => signedArea(l) < 0).map(h => ({ p: samplePoly(h, 20), b: bbox([h]) }))
  hs.forEach((h, i) => {
    if (polysOverlap(h.p, outer) && !pointIn(h.p[0], outer)) bad.push(`hole ${i} outside`)
    if (!h.p.every(q => pointIn(q, outer))) bad.push(`hole ${i} has a vertex outside`)
    if (closerThan(h.p, outer, margin - 1e-9)) bad.push(`hole ${i} too close to the edge`)
    if (selfIntersects(h.p)) bad.push(`hole ${i} self-intersects`)
  })
  hs.sort((u, v) => u.b.minX - v.b.minX)
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length && hs[j].b.minX <= hs[i].b.maxX + web; j++) {
    const a = hs[i].b, b = hs[j].b
    if (a.minY > b.maxY + web || b.minY > a.maxY + web) continue
    if (closerThan(hs[i].p, hs[j].p, web - 1e-9)) bad.push(`holes ${i} and ${j} too close`)
  }
  // hinge cuts never cross a hole
  const open = pn.loops.filter(l => !l.closed)
  if (open.length && hs.length) for (const o of open) for (const h of hs) if (polysOverlap([o.pts[0], o.pts[1], o.pts[0]], h.p)) bad.push('a hinge cut crosses a hole')
  expect(bad, `${label} ${pn.id}`).toEqual([])
}

describe('the arch box with the seigaiha window', () => {
  it('builds at its defaults on the common sheets: plates, bent wall, end wall, two-layer lid, fret, and the gold pieces on their own sheet', () => {
    for (const t of [2.7, 3, 3.2]) {
      const d = generate(tpl, {}, { ...S0, t })
      expect(d.errors, `t=${t}`).toEqual([])
      expect(d.panels.map(p => p.id).sort()).toEqual(['base', 'end', 'frame', 'fret', 'hex', 'lid', 'lid-under', 'plaque', 'ring', 'wall'])
      expect(d.panels.filter(p => p.material === 'gold').map(p => p.id).sort()).toEqual(['frame', 'hex', 'plaque'])
      for (const p of d.panels) soundPanel(p, `t=${t}`)
    }
  })

  it('every wall tab finds its slot: the same slots in the base and the ring, each the sheet plus the fit wide and the tab plus the fit long', () => {
    for (const t of [2.7, 3.2, 4]) for (const v of [{}, { tabs: 12, tabW: 14 }, { W: 160, Ls: 130, H: 45 }, { split: 1 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const base = d.panels.find(x => x.id === 'base')!, ring = d.panels.find(x => x.id === 'ring')!, end = d.panels.find(x => x.id === 'end')!
      const walls = d.panels.filter(x => x.id.startsWith('wall'))
      const tabs = [...walls.flatMap(w => edgeRuns(w, 0)), ...edgeRuns(end, 0)]
      const tabsBottom = [...walls.flatMap(w => edgeRuns(w, w.h)), ...edgeRuns(end, end.h)]
      expect(tabs.length, `${label} top = bottom tabs`).toBe(tabsBottom.length)
      expect(walls.flatMap(w => edgeRuns(w, 0)).length, `${label} strip tabs`).toBe(p.tabs)
      expect(edgeRuns(end, 0).length, `${label} end wall tabs`).toBeGreaterThanOrEqual(2)
      for (const w of tabs) expect(w, `${label} tab width`).toBeCloseTo(p.tabW, 3)
      const sb = slotsOf(base, t, p.fit, p.tabW), sr = slotsOf(ring, t, p.fit, p.tabW)
      expect(sb.length, `${label} base slots`).toBe(tabs.length)
      expect(sr.length, `${label} ring slots`).toBe(tabs.length)
      const key = (l: Loop) => { const b = box(l); return `${Math.round((b.x0 + b.x1) * 50)},${Math.round((b.y0 + b.y1) * 50)}` }
      expect(new Set(sb.map(key)), `${label} same slots`).toEqual(new Set(sr.map(key)))
      // the ring's opening and the base's outline are the same arch; the lower lid layer drops into the opening with the gap all round
      const opening = holesOf(ring).find(h => box(h).w > p.W / 2)!, under = d.panels.find(x => x.id === 'lid-under')!
      expect(box(opening).w - under.w, `${label} lid gap`).toBeCloseTo(2 * p.gap, 3)
      expect(box(opening).h - under.h, `${label} lid gap`).toBeCloseTo(2 * p.gap, 3)
      expect(base.w, label).toBeCloseTo(d.panels.find(x => x.id === 'lid')!.w, 3)
      // the end wall is as wide as the wall's outline, with female fingers; the strip's ends male
      expect(end.w, label).toBeCloseTo(p.W, 3)
      const g = archGeom(p, { ...S0, t, finger: 9 })
      expect(walls.reduce((s, w) => s + w.w, 0), `${label} strip length`).toBeCloseTo(g.L, 2)
      if (v.split) { expect(walls.map(w => w.id).sort()).toEqual(['wall-l', 'wall-r']); expect(walls[0].w).toBeCloseTo(walls[1].w, 3) }
    }
  })

  it('bends only round the arc: hinge columns over the semicircle and a little either side, the straight sides and the finger ends solid, through-columns between every two tabs', () => {
    for (const t of [3, 3.2]) for (const v of [{}, { tabs: 8 }, { split: 1 }, { pitch: 1.5, seg: 12 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const g = archGeom(p, { ...S0, t, finger: 9 })
      const walls = d.panels.filter(x => x.id.startsWith('wall'))
      let x0 = Infinity, x1 = -Infinity, cuts = 0
      const thru: number[] = []
      for (const [k, w] of walls.entries()) {
        const off = k * w.w, lo = new Set<number>(), hi = new Set<number>()
        for (const l of w.loops.filter(l => !l.closed)) {
          cuts++
          const x = Math.round((l.pts[0].x + off) * 1000) / 1000
          x0 = Math.min(x0, x); x1 = Math.max(x1, x)
          if (Math.min(l.pts[0].y, l.pts[1].y) < t) lo.add(x)
          if (Math.max(l.pts[0].y, l.pts[1].y) > g.H + t) hi.add(x)
        }
        for (const x of lo) if (hi.has(x)) thru.push(x)
      }
      expect(cuts, label).toBeGreaterThan(50)
      expect(x0, `${label} hinge starts near the arc`).toBeGreaterThanOrEqual(g.Ls - 4.01)
      expect(x1, `${label} hinge ends near the arc`).toBeLessThanOrEqual(g.Ls + g.arcLen + 4.01)
      // between neighbouring tabs on the arc at least two columns run out through both edges
      const xs = Array.from({ length: p.tabs }, (_, k) => (g.L * (k + 0.5)) / p.tabs).filter(x => x > g.Ls && x < g.Ls + g.arcLen)
      for (let i = 0; i + 1 < xs.length; i++) expect(thru.filter(x => x > xs[i] && x < xs[i + 1]).length, `${label} through columns between tabs ${i} and ${i + 1}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('cuts the seigaiha fret: fans of `rings` bands, webs never thinner than asked, mirror-symmetric, and inside the panel by the web', () => {
    for (const [v, t] of [[{}, 3.2], [{ fan: 20, rings: 3 }, 3], [{ fan: 40, rings: 6, web: 3 }, 3.2], [{ hexOn: 0, plaqueOn: 0, W: 180, Ls: 120 }, 2.7]] as [Record<string, number>, number][]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const fret = d.panels.find(x => x.id === 'fret')!, hs = holesOf(fret)
      expect(hs.length, label).toBeGreaterThan(60)
      soundPanel(fret, label, p.web - 0.1, p.web - 0.1, 2)
      // the pattern mirrors about the panel's axis
      const centres = hs.map(h => { const b = box(h); return { x: (b.x0 + b.x1) / 2 - fret.w / 2, y: (b.y0 + b.y1) / 2 } })
      const unmirrored = centres.filter(c => !centres.some(o => Math.abs(o.x + c.x) < 0.4 && Math.abs(o.y - c.y) < 0.4))
      expect(unmirrored, `${label} holes without a mirror`).toEqual([])
      // the innermost piece of a whole fan is a dome about R/rings - web/2 across
      const small = hs.map(h => box(h).w).filter(w => w < (2 * p.fan) / p.rings)
      expect(small.length, `${label} inner domes`).toBeGreaterThan(5)
    }
    // the bare fret for a given clip: every hole inside it
    const clip = { cx: 100, cy: 120, r: 80, yTop: 20 }
    const hs = seigaiha(clip, 25, 4, 2.2)
    expect(hs.length).toBeGreaterThan(80)
    for (const h of hs) for (const q of h.pts) expect(q.x >= clip.cx - clip.r - 1e-3 && q.x <= clip.cx + clip.r + 1e-3 && q.y >= clip.yTop - 1e-3 && (q.y <= clip.cy || Math.hypot(q.x - clip.cx, q.y - clip.cy) <= clip.r + 1e-3), `hole vertex ${q.x},${q.y} outside the clip`).toBe(true)
  })

  it('the lid: pockets and the window in the top layer, every gold piece and the fret panel a fit smaller than its pocket, the window frame a frame wide', () => {
    for (const t of [3, 3.2]) for (const v of [{}, { hexH: 0, frame: 6, fit: 0.3 }, { plaqueOn: 0 }, { hexOn: 0 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const lid = d.panels.find(x => x.id === 'lid')!, hs = holesOf(lid)
      expect(hs.length, label).toBe(1 + p.hexOn + p.plaqueOn)
      const win = box(hs[hs.length - 1])
      const frame = d.panels.find(x => x.id === 'frame')!, fret = d.panels.find(x => x.id === 'fret')!
      expect(frame.w, `${label} frame outer`).toBeCloseTo(win.w - p.fit, 3)
      expect(frame.h, `${label} frame outer`).toBeCloseTo(win.h - p.fit, 3)
      const inner = box(holesOf(frame)[0])
      expect(inner.w, `${label} frame inner`).toBeCloseTo(win.w - p.fit - 2 * p.frame, 3)
      expect(fret.w, `${label} fret in the frame`).toBeCloseTo(inner.w - p.fit, 3)
      expect(fret.h, `${label} fret in the frame`).toBeCloseTo(inner.h - p.fit, 3)
      if (p.hexOn) {
        const hex = d.panels.find(x => x.id === 'hex')!, pocket = box(hs[0])
        expect(pocket.w, label).toBeCloseTo(p.hex, 3)
        expect(pocket.h, label).toBeCloseTo(p.hexH || (2 * p.hex) / Math.sqrt(3), 3)
        expect(hex.w, `${label} hex plate`).toBeCloseTo(p.hex - p.fit, 2)
        expect(hex.w / hex.h, `${label} hex shape`).toBeCloseTo(pocket.w / pocket.h, 1)
      }
      if (p.plaqueOn) {
        const plq = d.panels.find(x => x.id === 'plaque')!, pocket = box(hs[p.hexOn])
        expect(pocket.w, label).toBeCloseTo(p.plaque, 3)
        expect(plq.w, `${label} plaque`).toBeCloseTo(p.plaque - p.fit, 3)
        expect(plq.h, `${label} plaque`).toBeCloseTo(p.plH - p.fit, 3)
      }
      // the window stays over the lower layer
      const under = d.panels.find(x => x.id === 'lid-under')!
      expect(win.w, `${label} window over the lower layer`).toBeLessThan(under.w)
      expect(win.x0 - (lid.w - under.w) / 2, label).toBeGreaterThan(0.9)
    }
  })

  it('refuses what cannot be cut or assembled, saying what to change', () => {
    expect(generate(tpl, { W: 80 }, S0).errors.join()).toMatch(/السداسي|لوحة النصّ/)
    expect(generate(tpl, { fan: 100, inset: 60 }, S0).errors.join()).toContain('المروحة')
    expect(generate(tpl, { fan: 12 }, S0).errors.join()).toContain('الأقواس')
    expect(generate(tpl, { seg: 80 }, S0).errors.join()).toContain('قصّة المفصل')
    expect(generate(tpl, { Ls: 20 }, S0).errors.join()).toContain('الطول المستقيم')
    expect(generate(tpl, { tabs: 40, tabW: 30 }, S0).errors.join()).toContain('اللسانات')
    expect(generate(tpl, { split: 1, tabs: 15 }, S0).errors.join()).toContain('زوجياً')
    expect(generate(tpl, { W: 80, Ls: 60, H: 40, hexOn: 0, plaqueOn: 0, fan: 16, rings: 4, web: 2.2, tabs: 8, tabW: 10 }, { ...S0, t: 3 }).errors.join()).toContain('القوس ضيّق')
    // and a small box that does fit
    const small = generate(tpl, { W: 120, Ls: 60, H: 40, hexOn: 0, plaqueOn: 0, fan: 16, rings: 4, web: 2.2, tabs: 8, tabW: 6, pitch: 1.5, seg: 12 }, { ...S0, t: 3 })
    expect(small.errors).toEqual([])
    for (const p of small.panels) soundPanel(p, 'small')
  })

  it('bent round the base: each strip tab, walked along the wall\'s mid-line drawn from the plate itself, lands on a slot of its size and direction in the base and the ring, and the strip is exactly as long as that path', () => {
    for (const t of [2.7, 3.2, 6]) for (const v of [{}, { split: 1 }, { tabs: 12, tabW: 14 }, { W: 160, Ls: 130, H: 45, tabs: 16 }, { W: 400, Ls: 300, tabs: 30, split: 1 }, { tabs: 4 }] as Record<string, number>[]) {
      const p = { ...tpl.defaults, ...v }, label = `${JSON.stringify(v)} t=${t}`
      const d = generate(tpl, p, { ...S0, t })
      expect(d.errors, label).toEqual([])
      const by = (id: string) => d.panels.find(x => x.id === id)!
      const base = by('base'), ring = by('ring'), end = by('end'), walls = d.panels.filter(x => x.id.startsWith('wall'))
      // the plate: an arch Wp wide whose semicircle is centred Wp/2 above its bottom; the wall sits rim in from its edge
      const Wp = base.w, rim = (Wp - p.W) / 2, Rp = Wp / 2, Lp = base.h - Rp, Rm = p.W / 2 - t / 2, Ls = Lp - rim, arc = Math.PI * Rm, L = 2 * Ls + arc
      const path = (s: number) => s <= Ls ? { x: rim + t / 2, y: rim + s, a: Math.PI / 2 }
        : s <= Ls + arc ? { x: Rp + Rm * Math.cos(Math.PI - (s - Ls) / Rm), y: Lp + Rm * Math.sin(Math.PI - (s - Ls) / Rm), a: Math.PI * 1.5 - (s - Ls) / Rm }
        : { x: rim + p.W - t / 2, y: rim + (L - s), a: Math.PI / 2 }
      expect(walls.reduce((s, w) => s + w.w, 0), `${label} strip = path`).toBeCloseTo(L, 2)
      // the strip's ends start at the end wall's outer face, where its fingers meet the end wall's (opposite genders, both H long)
      expect(path(0).y, label).toBeCloseTo(rim, 6)
      expect(end.w, label).toBeCloseTo(p.W, 3)
      const want: { x: number; y: number; a: number }[] = []
      let off = 0
      for (const w of walls) {
        const runs = (y: number) => { const o = outerOf(w).pts, r: number[] = []; for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; if (Math.abs(a.y - y) < 1e-6 && Math.abs(b.y - y) < 1e-6) r.push((a.x + b.x) / 2) } return r.sort((u, v) => u - v) }
        expect(runs(w.h), `${label} ${w.id} top and bottom tabs line up`).toEqual(runs(0).map(x => expect.closeTo(x, 6)))
        for (const x of runs(0)) want.push(path(off + x))
        off += w.w
      }
      const endRuns = edgeRuns(end, 0).length
      const eo = outerOf(end).pts
      for (let i = 0; i < eo.length; i++) { const a = eo[i], b = eo[(i + 1) % eo.length]; if (Math.abs(a.y) < 1e-6 && Math.abs(b.y) < 1e-6) want.push({ x: rim + (a.x + b.x) / 2, y: rim + t / 2, a: 0 }) }
      expect(want.length, label).toBe(p.tabs + endRuns)
      for (const pl of [base, ring]) {
        const slots = slotsOf(pl, t, p.fit, p.tabW).map(h => { const q = h.pts, c = { x: q.reduce((s, v) => s + v.x, 0) / 4, y: q.reduce((s, v) => s + v.y, 0) / 4 }; const e = [0, 1].map(i => ({ l: Math.hypot(q[i + 1].x - q[i].x, q[i + 1].y - q[i].y), a: Math.atan2(q[i + 1].y - q[i].y, q[i + 1].x - q[i].x) })); return { c, a: (e[0].l > e[1].l ? e[0] : e[1]).a } })
        expect(slots.length, `${label} ${pl.id} slots`).toBe(want.length)
        for (const q of want) {
          const s = slots.find(s => Math.hypot(s.c.x - q.x, s.c.y - q.y) < 0.01)
          expect(s, `${label} ${pl.id}: a slot under the tab at ${q.x.toFixed(2)},${q.y.toFixed(2)}`).toBeTruthy()
          expect(Math.abs(Math.sin(s!.a - q.a)), `${label} ${pl.id}: slot along the wall`).toBeLessThan(1e-3)
        }
      }
    }
  })

  it('a straight part too short for the window\'s frame and fret is refused (the fret outline used to cross itself), and the length it asks for builds', () => {
    // the window top sits 122 mm down on the defaults; the fret inside it starts frame + fit + web lower
    for (const [t, inner] of [[3.2, false], [3, true], [6, false]] as [number, boolean][]) for (const Ls of [110, 118, 121, 124, 127]) {
      const s = { ...S0, t, inner }, d = generate(tpl, { Ls }, s), label = `Ls=${Ls} t=${t} inner=${inner}`
      if (!d.errors.length) { for (const pn of d.panels) soundPanel(pn, label, 0.8, 0.8, 3); continue }
      const e = d.errors.find(e => e.includes('الطول المستقيم'))
      expect(e, label).toBeTruthy()
      const want = +e!.match(/«الطول المستقيم» ([\d.]+)/)![1]
      const ok = generate(tpl, { Ls: want }, s)
      expect(ok.errors, `${label} -> Ls ${want}`).toEqual([])
      for (const pn of ok.panels) soundPanel(pn, `${label} -> Ls ${want}`, 0.8, 0.8, 3)
    }
    // the exact case that used to come out crossed
    expect(generate(tpl, { Ls: 105 + 18 }, { ...S0, t: 3.2 }).errors.join()).toContain('الطول المستقيم')
  })

  it('every refusal names the value to set, and setting it clears that refusal', () => {
    const LABEL: [RegExp, string][] = [[/«عرض اللسان» ([\d.]+)/, 'tabW'], [/«طول قصّة المفصل» ([\d.]+)/, 'seg'], [/«المسافة بين الصفوف» ([\d.]+)/, 'pitch'], [/«الطول المستقيم» ([\d.]+)/, 'Ls'], [/«نصف قطر المروحة» ([\d.]+)/, 'fan'], [/«عدد الأقواس» ([\d.]+)/, 'rings'], [/«عرض السداسي» ([\d.]+)/, 'hex'], [/«طول لوحة النصّ» ([\d.]+)/, 'plaque'], [/«ارتفاع السداسي» ([\d.]+)/, 'hexH'], [/عدد اللسانات ([\d.]+)/, 'tabs'], [/عددها ([\d.]+)/, 'tabs']]
    const cases: Record<string, number>[] = [
      { tabs: 40 }, { Ls: 20, hexOn: 0, plaqueOn: 0 }, { split: 1, tabs: 15 }, { split: 1, tabs: 34, H: 162 }, { split: 1, tabs: 11, tabW: 28.5 }, { hexOn: 0, pitch: 6, split: 1 },
      { plaque: 30, plH: 40 }, { plaque: 40, plH: 80 }, { hexH: 0.5 }, { hexH: 9.5 }, { Ls: 110 }, { seg: 80 }, { W: 80 }, { fan: 100, inset: 60 }, { fan: 12 }, { tabW: 30 }, { tabs: 40, tabW: 30 }, { pitch: 6, W: 100 },
    ]
    for (const t of [2, 3.2, 6]) for (const v of cases) {
      const s = { ...S0, t }, d = generate(tpl, v, s)
      for (const e of d.errors) {
        const label = `${JSON.stringify(v)} t=${t}: ${e}`
        const m = LABEL.map(([re, key]) => { const x = e.match(re); return x ? { key, val: +x[1] } : null }).find(Boolean)
        expect(m, `${label} names no value`).toBeTruthy()
        const def = tpl.params.find(d => d.key === m!.key)!
        expect(m!.val, `${label} in range`).toBeGreaterThanOrEqual(def.min)
        expect(m!.val, `${label} in range`).toBeLessThanOrEqual(def.max)
        const again = generate(tpl, { ...v, [m!.key]: m!.val }, s).errors
        expect(again.filter(e2 => e2.slice(0, 25) === e.slice(0, 25)), `${label} -> ${m!.key} = ${m!.val}`).toEqual([])
      }
    }
    // the cases this test was written for are refused at all
    expect(generate(tpl, { plaque: 30, plH: 40 }, S0).errors.join()).toContain('لوحة النصّ أعلى من طولها')
    expect(generate(tpl, { hexH: 0.5 }, S0).errors.join()).toContain('ارتفاع السداسي')
    expect(generate(tpl, { hexH: 0 }, S0).errors).toEqual([])
    expect(generate(tpl, { split: 1, tabs: 15 }, S0).errors.join()).toMatch(/عدد اللسانات 14 أو 16/)
    expect(generate(tpl, { tabs: 40 }, { ...S0, t: 3.2 }).errors.join()).toMatch(/اجعل عدد اللسانات \d+ أو أقلّ/)
  })

  it('notes: the height adds up (base, inner height, ring, top layer of the lid), the walls are joined before they go on the base, and building is quick and repeatable', () => {
    for (const split of [0, 1]) {
      const t = 3.2, d = generate(tpl, { split }, { ...S0, t }), all = d.notes.join(' ')
      expect(all, `split=${split}`).toContain(`${Math.round((70 + 3 * t) * 10) / 10} مم: القاعدة ثم الارتفاع الداخلي 70 مم ثم الحلقة والطبقة العلوية للغطاء`)
      expect(all).toContain('اجمع الجدران أولاً بعيداً عن القاعدة')
      expect(all).toContain('أنزل الطوق على القاعدة')
    }
    // the fret is remembered between builds: a second build (another kerf) gives the very same, unmoved holes
    const a = generate(tpl, {}, { ...S0, t: 3 }), b = generate(tpl, {}, { ...S0, t: 3, kerf: 0.2 }), c = generate(tpl, {}, { ...S0, t: 3 })
    const fretOf = (d: typeof a) => d.panels.find(p => p.id === 'fret')!
    expect(JSON.stringify(fretOf(c).loops)).toBe(JSON.stringify(fretOf(a).loops))
    expect(fretOf(b).loops.length).toBe(fretOf(a).loops.length)
    // one build at the defaults, the pattern cut afresh, well under 150 ms
    const times: number[] = []
    for (const t of [2.9, 3.1, 3.3]) { const t0 = performance.now(); generate(tpl, {}, { ...DEFAULT_SETTINGS, t }); times.push(performance.now() - t0) }
    expect(times.sort((u, v) => u - v)[1]).toBeLessThan(150)
  })

  it('robustness grid: every thickness and kerf, every parameter at its ends (the box sizes too), and random combinations: sound geometry or a clear error', () => {
    // W and H are this template's own parameters: their ends belong in the grid (a 600 mm arch, a 25 mm wall)
    const variants: Record<string, number>[] = [{}]
    for (const def of tpl.params) variants.push({ [def.key]: def.min }, { [def.key]: def.max })
    // and three or four parameters at once, anywhere in their ranges (fixed seed), on a thin, a common and a thick sheet
    // with the kerf offset (where outlines fold over)
    let seed = 20261010
    const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647
    const combos: Record<string, number>[] = []
    for (let i = 0; i < 16; i++) {
      const v: Record<string, number> = {}
      for (let j = 3 + (i % 2); j > 0; j--) { const def = tpl.params[Math.floor(rnd() * tpl.params.length)], st = def.int ? 1 : def.step ?? 0.5; v[def.key] = Math.round((def.min + rnd() * (def.max - def.min)) / st) * st }
      combos.push(v)
    }
    const cases: [number, number, Record<string, number>][] = []
    for (const t of [2, 2.7, 3, 3.2, 4, 6]) for (const kerf of [0, 0.2]) for (const v of variants) cases.push([t, kerf, v])
    for (const t of [2, 3.2, 6]) for (const v of combos) cases.push([t, 0.2, v])
    let runs = 0, refused = 0
    for (const [t, kerf, v] of cases) {
      const label = `${JSON.stringify(v)} t=${t} kerf=${kerf}`
      let d
      try { d = generate(tpl, v, { ...DEFAULT_SETTINGS, t, kerf }) } catch (e) { throw new Error(`${label} threw: ${(e as Error).message}`) }
      runs++
      const finite = d.panels.every(pn => pn.loops.every(l => l.pts.every(q => Number.isFinite(q.x) && Number.isFinite(q.y))))
      expect(finite, `${label} non-finite coordinates`).toBe(true)
      if (d.errors.length) { refused++; for (const e of d.errors) expect(e, label).toMatch(/[؀-ۿ]/); continue }
      expect(d.layout.w, label).toBeLessThanOrEqual(Math.max(DEFAULT_SETTINGS.sheetW, Math.max(...d.panels.map(p => p.w))) + 1e-6)
      // outlines sampled every 3°: on a 300 mm arch a 15° chord falls 2.6 mm inside the true arc, past the fret's web
      for (const pn of d.panels) { expect(pn.w, `${label} ${pn.id} width`).toBeGreaterThan(0); soundPanel(pn, label, 0.8, 0.8, 3) }
      const dxf = toDXF(d.layout)
      expect(dxf.includes('NaN') || dxf.includes('undefined'), `${label} dxf`).toBe(false)
    }
    expect(runs).toBeGreaterThan(500)
    expect(refused).toBeLessThan(runs / 2)
  })
})

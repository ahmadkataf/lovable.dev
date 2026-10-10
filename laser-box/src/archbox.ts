// An arch-shaped (tombstone) lidded box with a seigaiha (Japanese wave) fret window, after the customer's reel: a base
// plate and a top rim ring of the same arch outline, a plywood strip bent round the arc with a living hinge whose tabs
// go through slots in both plates, a straight end wall at the flat end, and a two-layer lift-off lid: the top layer
// carries a hexagonal pocket for a gold logo plaque, a stadium pocket for a gold text plaque and a big arch window
// holding a fret panel of overlapping fans inside a gold acrylic frame; the lower layer drops into the rim ring.
//
// Plate coordinates: x to the right, y down the drawing; the flat end at the top, the semicircle at the bottom. Every
// arch here (the plates, the wall, the ring's opening, the window, the fret) is a rectangle over a semicircle about the
// same centre, so an inset arch is the same arch with a smaller radius and a lower top edge.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Vtx, Rect, rect, polyLoop, oriented, rotatedRectHole, stadium, hingeLines, round3 } from './geom'
import type { PanelSpec } from './joints'

type P2 = { x: number; y: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', ...(hint ? { hint } : {}) })
const intP = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 1, int: true, ...(hint ? { hint } : {}) })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()

// ------------------------------------------------------------------ polygon helpers (from trophies.ts)

function areaOf(pts: P2[]): number {
  let a = 0
  for (let i = 0, n = pts.length; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; a += p.x * q.y - q.x * p.y }
  return a / 2
}
const ccw = (pts: P2[]) => (areaOf(pts) < 0 ? [...pts].reverse() : pts)
function inPoly(q: P2, pts: P2[]): boolean {
  let c = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j]
    if ((a.y > q.y) !== (b.y > q.y) && q.x < a.x + ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y)) c = !c
  }
  return c
}
const bboxOf = (pts: P2[]) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const q of pts) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y }
  return { x0, x1, y0, y1 }
}
type BB = ReturnType<typeof bboxOf>
const bbOverlap = (a: BB, b: BB) => !(a.x0 > b.x1 || b.x0 > a.x1 || a.y0 > b.y1 || b.y0 > a.y1)

/** Where the edges of two closed polygons cross, with their positions along each. */
interface Hit { a: number; ta: number; b: number; tb: number; p: P2; id: number }
function crossings(A: P2[], B: P2[]): Hit[] | null {
  const out: Hit[] = [], na = A.length, nb = B.length
  // only edges inside the other polygon's box can cross anything
  const ab = bboxOf(A), bbb = bboxOf(B)
  const js: number[] = [], bb: number[][] = []
  for (let j = 0; j < nb; j++) {
    const p = B[j], q = B[(j + 1) % nb], e = [Math.min(p.x, q.x), Math.max(p.x, q.x), Math.min(p.y, q.y), Math.max(p.y, q.y)]
    bb.push(e)
    if (!(e[0] > ab.x1 || e[1] < ab.x0 || e[2] > ab.y1 || e[3] < ab.y0)) js.push(j)
  }
  for (let i = 0; i < na; i++) {
    const p = A[i], q = A[(i + 1) % na], x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y)
    if (x0 > bbb.x1 || x1 < bbb.x0 || y0 > bbb.y1 || y1 < bbb.y0) continue
    for (const j of js) {
      const b = bb[j]
      if (b[0] > x1 || b[1] < x0 || b[2] > y1 || b[3] < y0) continue
      const r = B[j], s = B[(j + 1) % nb], d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x)
      if (Math.abs(d) < 1e-12) continue
      const ta = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d, tb = ((r.x - p.x) * (q.y - p.y) - (r.y - p.y) * (q.x - p.x)) / d
      if (ta < -1e-9 || ta > 1 + 1e-9 || tb < -1e-9 || tb > 1 + 1e-9) continue
      // a crossing at a vertex is ambiguous: the caller moves one polygon a hair and asks again
      if (ta < 1e-7 || ta > 1 - 1e-7 || tb < 1e-7 || tb > 1 - 1e-7) return null
      out.push({ a: i, ta, b: j, tb, p: { x: p.x + ta * (q.x - p.x), y: p.y + ta * (q.y - p.y) }, id: out.length })
    }
  }
  return out
}
/** A polygon cut at the crossing points into chains, each from one crossing to the next. */
function chainsOf(L: P2[], hits: Hit[], own: 'a' | 'b') {
  const pos = (h: Hit) => (own === 'a' ? h.a + h.ta : h.b + h.tb), seg = (h: Hit) => (own === 'a' ? h.a : h.b)
  const s = [...hits].sort((u, v) => pos(u) - pos(v)), n = L.length
  return s.map((h0, k) => {
    const h1 = s[(k + 1) % s.length]
    let steps = (seg(h1) - seg(h0) + n) % n
    if (steps === 0 && pos(h1) <= pos(h0)) steps = n
    const pts = [h0.p]
    for (let m = 0; m < steps; m++) pts.push(L[(seg(h0) + 1 + m) % n])
    pts.push(h1.p)
    return { from: h0.id, to: h1.id, pts }
  })
}
const chainMid = (pts: P2[]) => { const k = Math.max(0, Math.floor((pts.length - 2) / 2)); return { x: (pts[k].x + pts[k + 1].x) / 2, y: (pts[k].y + pts[k + 1].y) / 2 } }
/** Union or difference (A − B) of two simple polygons; the result's outer loops run counter-clockwise (positive area). */
function boolOp(A0: P2[], B0: P2[], op: 'union' | 'diff'): P2[][] {
  const A = ccw(A0)
  let B = ccw(B0), hits = crossings(A, B)
  for (let k = 1; !hits && k < 6; k++) { const e = 1e-6 * k; B = B.map(q => ({ x: q.x + e, y: q.y + 0.7 * e })); hits = crossings(A, B) }
  if (!hits) return op === 'union' ? [A, B] : [A]
  if (!hits.length) {
    const bIn = inPoly(B[0], A), aIn = inPoly(A[0], B)
    if (op === 'union') return bIn ? [A] : aIn ? [B] : [A, B]
    return aIn ? [] : bIn ? [A, [...B].reverse()] : [A]
  }
  const ca = chainsOf(A, hits, 'a').filter(c => !inPoly(chainMid(c.pts), B))
  const cbAll = chainsOf(B, hits, 'b')
  const cb = op === 'union' ? cbAll.filter(c => !inPoly(chainMid(c.pts), A)) : cbAll.filter(c => inPoly(chainMid(c.pts), A)).map(c => ({ from: c.to, to: c.from, pts: [...c.pts].reverse() }))
  const all = [...ca, ...cb], byFrom = new Map<number, typeof all[number]>()
  for (const c of all) byFrom.set(c.from, c)
  const used = new Set<typeof all[number]>(), loops: P2[][] = []
  for (const c0 of all) {
    if (used.has(c0)) continue
    const loop: P2[] = []
    let c: typeof all[number] | undefined = c0
    for (let guard = 0; c && !used.has(c) && guard <= all.length; guard++) { used.add(c); loop.push(...c.pts.slice(0, -1)); c = byFrom.get(c.to) }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}
/** The closed polygon with every edge moved d to its left (inwards for a counter-clockwise polygon), corners mitred. */
function offsetPoly(pts: P2[], d: number): P2[] {
  const n = pts.length, nrm = (i: number) => { const a = pts[i], b = pts[(i + 1) % n], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l } }
  const ns = Array.from({ length: n }, (_, i) => nrm(i))
  return pts.map((p, i) => {
    const n0 = ns[(i - 1 + n) % n], n1 = ns[i], k = Math.max(0.02, 1 + n0.x * n1.x + n0.y * n1.y)
    return { x: p.x + ((n0.x + n1.x) / k) * d, y: p.y + ((n0.y + n1.y) / k) * d }
  })
}
/** Drop points closer than `min` to the one kept before them. */
function thin(pts: P2[], min = 0.05): P2[] {
  const out: P2[] = []
  for (const q of pts) if (!out.length || Math.hypot(q.x - out[out.length - 1].x, q.y - out[out.length - 1].y) > min) out.push(q)
  while (out.length > 3 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= min) out.pop()
  return out
}
/**
 * Cut every needle-sharp convex corner (narrower than 30°, where an arc meets the panel's edge at a grazing angle) back
 * to a flat about `minW` wide, so the kerf offset never folds it over. null when nothing but a needle is left.
 */
function bluntTips(pts: P2[], minW: number): P2[] | null {
  let p = pts
  for (let guard = 0; guard < 12; guard++) {
    const n = p.length
    if (n < 3) return null
    const sgn = Math.sign(areaOf(p)), cosLim = Math.cos(Math.PI / 6)
    let tip = -1
    for (let i = 0; i < n && tip < 0; i++) {
      const a = p[(i + n - 1) % n], v = p[i], c = p[(i + 1) % n]
      const u1 = { x: a.x - v.x, y: a.y - v.y }, u2 = { x: c.x - v.x, y: c.y - v.y }, l1 = Math.hypot(u1.x, u1.y), l2 = Math.hypot(u2.x, u2.y)
      if (!l1 || !l2) continue
      const turn = (v.x - a.x) * (c.y - v.y) - (v.y - a.y) * (c.x - v.x)
      if (turn * sgn <= 0) continue // a reflex corner is not a tip
      if ((u1.x * u2.x + u1.y * u2.y) / (l1 * l2) > cosLim) tip = i
    }
    if (tip < 0) return p
    // walk both ways from the tip, by arc length, until the two sides are minW apart
    const side = (dir: 1 | -1) => {
      const out: { pt: P2; s: number }[] = [{ pt: p[tip], s: 0 }]
      for (let k = 1; k < n; k++) { const q = p[(tip + dir * k + n * k) % n], last = out[out.length - 1]; out.push({ pt: q, s: last.s + Math.hypot(q.x - last.pt.x, q.y - last.pt.y) }) }
      return out
    }
    const F = side(1), B = side(-1)
    const at = (S: typeof F, s: number) => { let k = 1; while (k < S.length - 1 && S[k].s < s) k++; const a = S[k - 1], b = S[k], f = b.s > a.s ? Math.min(1, (s - a.s) / (b.s - a.s)) : 1; return { pt: { x: a.pt.x + f * (b.pt.x - a.pt.x), y: a.pt.y + f * (b.pt.y - a.pt.y) }, k } }
    const sMax = Math.min(F[F.length - 1].s, B[B.length - 1].s) / 2
    let s = 0.1, cut: { f: ReturnType<typeof at>; b: ReturnType<typeof at> } | null = null
    for (; s <= sMax; s += 0.1) { const f = at(F, s), b = at(B, s); if (Math.hypot(f.pt.x - b.pt.x, f.pt.y - b.pt.y) >= minW) { cut = { f, b }; break } }
    if (!cut) return null
    // keep the vertices beyond the cut on both sides: forward from index k_f, backward from k_b
    const kf = cut.f.k, kb = cut.b.k
    if (kf + kb >= n) return null
    const keep: P2[] = [cut.f.pt]
    for (let k = kf; k <= n - kb; k++) keep.push(p[(tip + k) % n])
    keep.push(cut.b.pt)
    p = thin(keep, 0.5) // the cut points may land a hair from a kept vertex
  }
  return p
}
const perimeterOf = (pts: P2[]) => pts.reduce((s, p, i) => s + Math.hypot(pts[(i + 1) % pts.length].x - p.x, pts[(i + 1) % pts.length].y - p.y), 0)

// ------------------------------------------------------------------ the arch

/** A rectangle over a semicircle: x in cx ± r, straight from yTop down to cy, the arc below cy. */
interface Arch { cx: number; cy: number; r: number; yTop: number }
const archInset = (a: Arch, d: number): Arch => ({ cx: a.cx, cy: a.cy, r: a.r - d, yTop: a.yTop + d })
/** The arch as a loop with a true semicircle (a bulge of −1 bows the arc downwards on the way back along the bottom). */
function archLoop(a: Arch, as: 'outer' | 'hole'): Loop {
  const pts: Vtx[] = [{ x: a.cx - a.r, y: a.yTop }, { x: a.cx + a.r, y: a.yTop }, { x: a.cx + a.r, y: a.cy, b: -1 }, { x: a.cx - a.r, y: a.cy }]
  return polyLoop(pts.map(v => ({ ...v, x: round3(v.x), y: round3(v.y) })), as)
}
const inArch = (q: P2, a: Arch) => q.x >= a.cx - a.r && q.x <= a.cx + a.r && q.y >= a.yTop && (q.y <= a.cy || Math.hypot(q.x - a.cx, q.y - a.cy) <= a.r)

// ------------------------------------------------------------------ the seigaiha fret
//
// Circles of radius R on a staggered grid (2R across, rows R/2 apart, every other row shifted by R). The two circles of
// the row below and the one two rows below cover the lower part of each circle, so what shows of it is a fan of
// concentric bands. Each band is an annulus between R·k/rings and R·(k+1)/rings narrowed by half a web on each side;
// the covering circles are grown by half a web, so every web between holes is exactly `web` wide. The fan's lower half
// is always covered, so a band is built as a C-shaped polygon over the upper half plus 10° each side.

const STEP = Math.PI / 30 // 6° per polygon edge
/** Points of an arc about c from angle a0 to a1 (screen angles: y down), the chord error pushed outwards when asked. */
function arcPts(c: P2, r: number, a0: number, a1: number, outside = false): P2[] {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / STEP)), rr = outside ? r / Math.cos(Math.abs(a1 - a0) / n / 2) : r
  return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return { x: c.x + rr * Math.cos(a), y: c.y + rr * Math.sin(a) } })
}
/** A polygon holding the whole disc (its edges tangent to the circle). */
const discAround = (c: P2, r: number): P2[] => arcPts(c, r, 0, 2 * Math.PI, true).slice(0, -1)

/** The fret's holes inside `clip` (the panel's outline already inset by the web), as hole loops. */
export function seigaiha(clip: Arch, R: number, rings: number, web: number): Loop[] {
  const out: Loop[] = []
  const rho = R + web / 2
  const x0 = clip.cx - clip.r, x1 = clip.cx + clip.r, yBot = clip.cy + clip.r, M = 2 * R + 20
  const clipBox: BB = { x0, x1, y0: clip.yTop, y1: yBot }
  // what lies outside the clip arch, as two simple polygons to subtract: a strip above the top edge and a U round the
  // sides and the arc (the U's arms reach up into the strip, so the two never share an edge)
  const PT: P2[] = [{ x: x0 - M, y: clip.yTop }, { x: x1 + M, y: clip.yTop }, { x: x1 + M, y: clip.yTop - M }, { x: x0 - M, y: clip.yTop - M }]
  const PU: P2[] = [{ x: x0 - M, y: clip.yTop - M / 2 }, { x: x0, y: clip.yTop - M / 2 }, { x: x0, y: clip.cy }, ...arcPts({ x: clip.cx, y: clip.cy }, clip.r, Math.PI, 0).slice(1, -1), { x: x1, y: clip.cy }, { x: x1, y: clip.yTop - M / 2 }, { x: x1 + M, y: clip.yTop - M / 2 }, { x: x1 + M, y: yBot + M }, { x: x0 - M, y: yBot + M }]
  const outside = [PT, PU].map(p => ({ p, bb: bboxOf(p) }))
  const nCols = Math.ceil((clip.r + R) / (2 * R)) + 1
  // circles left of the axis (and on it) are cut; their pieces are mirrored to the right, so the pattern is exactly symmetric
  const mirror = (p: P2[]): P2[] => p.map(q => ({ x: 2 * clip.cx - q.x, y: q.y })).reverse()
  for (let j = 0; ; j++) {
    const cy = clip.yTop - R / 2 + (j * R) / 2
    if (cy - R > yBot) break
    for (let i = -nCols; i <= 0; i++) {
      const cx = clip.cx + (i + (j % 2) / 2) * 2 * R, c = { x: cx, y: cy }
      if (cx > clip.cx + 1e-9 || cx + R < x0 || cy + 0.3 * R < clip.yTop) continue
      const onAxis = Math.abs(cx - clip.cx) < 1e-9
      const covers = [discAround({ x: cx - R, y: cy + R / 2 }, rho), discAround({ x: cx + R, y: cy + R / 2 }, rho), discAround({ x: cx, y: cy + R }, rho)]
      for (let k = 0; k < rings; k++) {
        const rIn = k ? (R * k) / rings + web / 2 : 0, rOut = (R * (k + 1)) / rings - web / 2
        if (rOut - rIn < 0.8) continue
        const band: P2[] = k === 0
          ? arcPts(c, rOut, 0, 2 * Math.PI).slice(0, -1)
          : [...arcPts(c, rOut, (17 * Math.PI) / 18, (37 * Math.PI) / 18), ...arcPts(c, rIn, (37 * Math.PI) / 18, (17 * Math.PI) / 18, true)]
        let pieces = [band]
        for (const d of covers) pieces = pieces.flatMap(p => boolOp(p, d, 'diff'))
        for (const o of outside) pieces = pieces.flatMap(p => (p.every(q => inArch(q, clip)) || !bbOverlap(bboxOf(p), o.bb) ? [p] : boolOp(p, o.p, 'diff')))
        for (const p0 of pieces) {
          // vertices closer than 0.6 mm are merged: an edge that short between two corners folds over under the kerf offset
          const p = bluntTips(thin(p0, 0.6), 1.2)
          if (!p || p.length < 3) continue
          const A = Math.abs(areaOf(p))
          // slivers: tiny, or thinner than 0.6 web (a long thin shape is about 2·area/perimeter wide)
          if (A < 10 || (2 * A) / perimeterOf(p) < 0.6 * web) continue
          if (!bbOverlap(bboxOf(p), clipBox)) continue
          out.push(polyLoop(p.map(q => ({ x: round3(q.x), y: round3(q.y) })), 'hole'))
          if (!onAxis) out.push(polyLoop(mirror(p).map(q => ({ x: round3(q.x), y: round3(q.y) })), 'hole'))
        }
      }
    }
  }
  return out
}

// ------------------------------------------------------------------ the box

const PARAMS: ParamDef[] = [
  mm('W', 'العرض', 80, 600, 'عرض الجدار من الخارج؛ الغطاء والقاعدة أعرض منه بحافّة صغيرة من كل جهة'),
  mm('Ls', 'الطول المستقيم', 20, 600, 'من الجدار الأمامي المستقيم إلى بداية القوس؛ الطول الكلّي = هذا + نصف العرض'),
  mm('H', 'الارتفاع الداخلي', 25, 400, 'بين القاعدة والغطاء؛ الارتفاع الكلّي يزيد ثلاث سماكات'),
  intP('hexOn', 'جيب الشعار السداسي', 0, 1, 'جيب في الغطاء تدخل فيه لوحة ذهبية سداسية للشعار'),
  mm('hex', 'عرض السداسي', 20, 250),
  mm('hexH', 'ارتفاع السداسي', 0, 250, '0 = سداسي منتظم؛ في الصورة أعرض من ارتفاعه (80 × 55)'),
  intP('plaqueOn', 'جيب لوحة النصّ', 0, 1, 'جيب مستطيل بطرفين مستديرين للوحة ذهبية يُحفر عليها النصّ'),
  mm('plaque', 'طول لوحة النصّ', 30, 400),
  mm('plH', 'ارتفاع لوحة النصّ', 10, 80),
  mm('inset', 'هامش النافذة', 8, 80, 'من حافّة الغطاء إلى النافذة من الجانبين والقوس'),
  mm('frame', 'عرض الإطار الذهبي', 2, 20, 'حلقة أكريليك ذهبي حول لوح النقشة داخل النافذة'),
  mm('fan', 'نصف قطر المروحة', 12, 100, 'نقشة الأمواج اليابانية: دوائر متداخلة يظهر من كلّ منها مروحة من الأقواس'),
  intP('rings', 'عدد الأقواس في المروحة', 3, 6),
  mm('web', 'الجسر بين الفتحات', 2, 5, 'لا يقلّ عن 2 مم في الخشب؛ 2.5–3 مم للأكريليك'),
  intP('tabs', 'عدد ألسنة الجدار', 4, 40, 'في كل حافّة من الشريط الملتفّ؛ الجدار الأمامي له ألسنته'),
  mm('tabW', 'عرض اللسان', 4, 30),
  mm('fit', 'خلوص الألسنة والقطع', 0, 1, 'يُضاف لعرض الشقوق، ويُنقص من اللوحات الذهبية ولوح النقشة لتدخل في جيوبها'),
  mm('gap', 'خلوص الغطاء', 0.2, 2, 'بين الطبقة السفلية للغطاء وفتحة الحلقة العلوية'),
  intP('split', 'الجدار قطعتان', 0, 1, 'يقسم الشريط الملتفّ نصفين يلتقيان في وسط القوس، لألواح وآلات أقصر'),
  mm('seg', 'طول قصّة المفصل', 5, 80),
  mm('bridge', 'الجسر بين القصّات', 1, 10),
  mm('pitch', 'المسافة بين الصفوف', 0.6, 6, 'القوس هنا واسع فتكفي 2–3 مم'),
  intP('n', 'العدد', 1, 20),
]
const DEFAULTS = { W: 240, Ls: 220, H: 70, hexOn: 1, hex: 80, hexH: 55, plaqueOn: 1, plaque: 130, plH: 22, inset: 14, frame: 4.5, fan: 28, rings: 4, web: 2.2, tabs: 20, tabW: 10, fit: 0.2, gap: 0.5, split: 0, seg: 18, bridge: 3, pitch: 2.5, n: 1 }

/** The sizes every part is drawn from, for tests and previews. */
export function archGeom(p: Record<string, number>, c: Common) {
  const t = c.t, { W, H, tabW, fit, gap, pitch } = p
  const Ls = p.Ls + (c.inner ? t : 0)
  const Rmid = W / 2 - t / 2, arcLen = Math.PI * Rmid, L = round3(2 * round3(Ls + arcLen / 2)) // an even thousandth: the halves are equal
  // the plates reach past the wall by a rim: never less than 4 mm, and 2 mm beyond the corners of the arc slots
  const excess = Math.hypot(Rmid + (t + fit) / 2, (tabW + fit) / 2) - (Rmid + t / 2)
  const rim = round3(Math.max(t + 1.5, 4, excess + fit / 2 + 2))
  const Wp = W + 2 * rim, Rp = Wp / 2, Lp = Ls + rim
  const plate: Arch = { cx: Rp, cy: Lp, r: Rp, yTop: 0 }
  const wall: Arch = archInset(plate, rim)
  const lip = Math.max(2, 0.75 * t)                       // wood left inside the ring's slots
  const ringIn = round3(t + fit / 2 + lip)                // the ring's opening, measured in from the wall's outer face
  const under = archInset(wall, ringIn + gap)             // the lid's lower layer, dropping into the ring
  const seam = Math.max(4, 2 * pitch)
  return { t, W, Ls, H, Rmid, arcLen, L, rim, Wp, Rp, Lp, plate, wall, ringIn, under, seam, n: Math.round(p.tabs) }
}

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = []
  const g = archGeom(p, c)
  const { t, W, Ls, H, Rmid, arcLen, L, rim, Wp, Rp, Lp, plate, wall, under, seam, n } = g
  const { tabW, fit, gap, seg, bridge, pitch, frame, web, rings } = p
  const R = p.fan, copies = Math.round(p.n), split = Math.round(p.split) === 1, hexOn = Math.round(p.hexOn) === 1, plaqueOn = Math.round(p.plaqueOn) === 1
  const hexH = p.hexH > 0 ? p.hexH : (2 * p.hex) / Math.sqrt(3)

  // ---------------------------------------------------------------- the wall and its tabs
  const xs = Array.from({ length: n }, (_, k) => round3((L * (k + 0.5)) / n))
  const sagitta = Rmid - Math.sqrt(Math.max(0, Rmid * Rmid - (tabW / 2) * (tabW / 2)))
  if (sagitta > fit + 0.3) errors.push(`اللسان عريض بالنسبة للقوس (ينحرف ${sagitta.toFixed(2)} مم عنه)؛ اجعل «عرض اللسان» ${Math.floor(2 * Math.sqrt(Math.max(0, Rmid * Rmid - (Rmid - fit - 0.3) ** 2)))} مم أو أقلّ.`)
  if (n * (tabW + 4) > L) errors.push(`اللسانات كثيرة أو عريضة بالنسبة لطول الجدار (${f1(L)} مم)؛ اجعل عددها ${Math.max(4, Math.floor(L / (tabW + 4)))} أو أقلّ.`)
  else if (xs[0] - tabW / 2 < t + 2) errors.push(`اللسان الأول يصل إلى تعشيق الزاوية؛ اجعل عدد اللسانات ${Math.max(4, Math.floor(L / (tabW + 2 * t + 4)))} أو أقلّ.`)
  if (split && n % 2 === 1) errors.push('مع تقسيم الجدار قطعتين اجعل عدد اللسانات زوجياً، وإلا وقع لسان على خطّ القسمة.')
  if (seg + 3 * bridge > H) errors.push(`طول قصّة المفصل أكبر من الارتفاع؛ اجعل «طول قصّة المفصل» ${f1(Math.floor((H - 3 * bridge) * 2) / 2)} مم أو أقلّ.`)
  if (pitch / Rmid > 0.09) errors.push(`القوس ضيّق لهذه المسافة بين صفوف المفصل؛ اجعل «المسافة بين الصفوف» ${f1(Math.floor(0.08 * Rmid * 10) / 10)} مم أو أقلّ، أو زد العرض.`)
  else if (pitch / Rmid > 0.035) warnings.push('صفوف المفصل متباعدة بالنسبة للقوس؛ قد ينكسر الخشب عند الانحناء. قرّبها إلى 1.5–2 مم.')
  if (pitch - c.kerf < 1) warnings.push('الصفوف متقاربة جداً: الشريحة بينها أرقّ من 1 مم وقد تحترق أو تنقطع.')
  // a long strip is normal for this box (the photo's is about 80 cm): a note, not a warning
  const longStrip = L > 600 && !split ? `الشريط الملتفّ طوله ${f1(L)} مم؛ إن لم يتّسع له لوحك أو سرير آلتك شغّل «الجدار قطعتان».` : ''
  // the end wall's own tabs: two or three, clear of the corner joints and of the side slots
  const span0 = t + 2 + fit + tabW / 2, span1 = W - span0
  const mWant = Math.max(2, Math.round((W - 2 * t) / 110))
  const m = Math.max(1, Math.min(mWant, Math.floor((span1 - span0) / (tabW + 4)) + 1))
  if (span1 - span0 < 0) errors.push(`العرض صغير للسان في الجدار الأمامي؛ اجعل «عرض اللسان» ${f1(Math.floor((W - 2 * t - 4 - 2 * fit) * 2) / 2)} مم أو أقلّ.`)
  const xe = Array.from({ length: m }, (_, j) => round3(span0 + ((span1 - span0) * (j + 1)) / (m + 1)))

  // a point of the wall's mid-line s along it (down the left side, round the arc, up the right side) and its tangent
  const Pc = { x: Rp, y: Lp }
  const at = (s: number) => {
    if (s <= Ls) return { x: rim + t / 2, y: rim + s, ang: Math.PI / 2 }
    if (s <= Ls + arcLen) { const phi = Math.PI - (s - Ls) / Rmid; return { x: Pc.x + Rmid * Math.cos(phi), y: Pc.y + Rmid * Math.sin(phi), ang: phi + Math.PI / 2 } }
    return { x: rim + W - t / 2, y: rim + (L - s), ang: Math.PI / 2 }
  }
  const slots: Loop[] = [
    ...xs.map(s => { const q = at(s); return rotatedRectHole(round3(q.x), round3(q.y), round3(tabW + fit), round3(t + fit), q.ang) }),
    ...xe.map(x => rotatedRectHole(round3(rim + x), round3(rim + t / 2), round3(tabW + fit), round3(t + fit), 0)),
  ]

  // the strip: H tall plus a t-deep tab strip on each edge, cut away between the tabs; hinge columns over the arc
  // and a little either side; the ends meet the end wall with finger joints (or a glued seam in the middle when split)
  const ext = Math.min(4, Math.max(0, Ls - t - 4))
  const hz0 = Ls - ext, hz1 = Ls + arcLen + ext
  const thruAll: number[] = []
  const piece = (id: string, name: string, a: number, b: number, note: string): PanelSpec => {
    // the piece's own coordinates start at round3(a), so its last cut ends exactly on its rounded width
    const A = round3(a), w = round3(round3(b) - A)
    const tabsIn = xs.filter(x => x > a && x < b).map(x => round3(x - A))
    const stripCuts = (y: number) => {
      const out: Rect[] = []
      let x = 0
      for (const xk of tabsIn) { out.push(rect(x, y, round3(xk - tabW / 2 - x), t)); x = round3(xk + tabW / 2) }
      out.push(rect(x, y, round3(w - x), t))
      return out.filter(r => r.w > 1e-6)
    }
    const z0 = round3(Math.max(hz0, a + (a > 0 ? seam : 0)) - A), z1 = round3(Math.min(hz1, b - (b < L ? seam : 0)) - A)
    const open = z1 - z0 > 2 * pitch
      ? hingeLines(z0, t, z1, H + t, seg, bridge, pitch, 'y', { through: true, keepEdge: r => tabsIn.some(xk => Math.abs(z0 + r - xk) < tabW / 2 + bridge) })
      : []
    const reaches = (edge: (l: Loop) => boolean) => new Set(open.filter(edge).map(l => round3(l.pts[0].x)))
    const lo = reaches(l => Math.min(l.pts[0].y, l.pts[1].y) < t), hi = reaches(l => Math.max(l.pts[0].y, l.pts[1].y) > H + t)
    for (const x of lo) if (hi.has(x)) thruAll.push(round3(x + A))
    return {
      id, name, w, h: round3(H + 2 * t), count: copies,
      left: a === 0 ? { type: 'male', from: t, len: H } : 'flat', right: b >= L ? { type: 'male', from: t, len: H } : 'flat',
      cuts: [...stripCuts(0), ...stripCuts(H + t)], open, note,
    }
  }
  const wallPanels: PanelSpec[] = split
    ? [piece('wall-l', 'الجدار الملتفّ — النصف الأيسر', 0, L / 2, 'يبدأ بتعشيق أصابع عند الجدار الأمامي وينتهي في وسط القوس'), piece('wall-r', 'الجدار الملتفّ — النصف الأيمن', L / 2, L, 'صورة مرآة للنصف الأيسر؛ الطرفان يلتقيان في وسط القوس ويُلصقان')]
    : [piece('wall', 'الجدار الملتفّ (مفصل مرن على القوس)', 0, L, 'مصمت على الجانبين المستقيمين، بقصّات مفصل مرن على القوس؛ طرفاه بتعشيق أصابع مع الجدار الأمامي')]
  // the edge band left between the hinge's through-columns must be cut often enough over the arc: a solid run there
  // is a flat facet, allowed under a tab (and across the glued seam) but nowhere else
  if (!errors.length) {
    const thru = [...new Set(thruAll)].sort((u, v) => u - v), a0 = Ls, a1 = Ls + arcLen
    const runs: number[] = []
    const cuts = [-Infinity, ...thru, Infinity]
    for (let i = 0; i + 1 < cuts.length; i++) runs.push(Math.max(0, Math.min(cuts[i + 1], a1) - Math.max(cuts[i], a0)))
    const longest = Math.max(...runs)
    const allowed = Math.max(tabW + 2 * bridge, split ? 2 * seam : 0) + 4 * pitch + 0.5
    if (longest > allowed + 1e-6) errors.push('اللسانات متقاربة فلا تبقى بينها قصّات مفصل نافذة كافية، فيبقى شريط مصمت على الحافّة يمنع الشريط من الالتفاف؛ قلّل عدد اللسانات أو عرضها أو الجسر.')
    else if (longest / Rmid > 0.5) errors.push(`القوس ضيّق: الجزء المصمت تحت كل لسان (${f1(longest)} مم) يبقى مستقيماً على قوس نصف قطره ${f1(Rmid)} مم؛ اجعل «عرض اللسان» ${f1(Math.max(4, Math.floor(0.45 * Rmid - 2 * bridge - 4 * pitch)))} مم أو أقلّ${0.45 * Rmid - 2 * bridge - 4 * pitch < 6 ? ' وقرّب صفوف المفصل إلى 1.5 مم والجسر إلى 2 مم' : ''}، أو زد العرض.`)
    else if (longest / Rmid > 0.3) warnings.push('القوس سيبدو مضلّعاً قليلاً تحت الألسنة؛ لتنعيمه قلّل عرض اللسان أو الجسر أو المسافة بين الصفوف.')
  }

  // ---------------------------------------------------------------- the lid: pockets and the window
  let inset = p.inset
  const insetMin = round3(rim + g.ringIn + gap + 1)
  if (inset < insetMin) { inset = insetMin; warnings.push(`هامش النافذة رُفع إلى ${f1(inset)} مم لتبقى النافذة فوق الطبقة السفلية للغطاء.`) }
  const gapV = Math.min(12, Math.max(6, 0.6 * inset))
  const hexW = p.hex, plL = p.plaque, plH = p.plH
  let y = inset
  const hexC = { x: Rp, y: y + hexH / 2 }
  if (hexOn) y += hexH + gapV
  const plC = { x: Rp, y: y + plH / 2 }
  if (plaqueOn) y += plH + gapV
  const window = archInset(plate, inset)
  window.yTop = round3(y)
  if (hexOn && hexW > Wp - 2 * inset) errors.push(`السداسي أعرض من الغطاء بين الهامشين؛ اجعل «عرض السداسي» ${f1(Math.floor((Wp - 2 * inset) * 2) / 2)} مم أو أقلّ.`)
  if (plaqueOn && plL > Wp - 2 * inset) errors.push(`لوحة النصّ أطول من الغطاء بين الهامشين؛ اجعل «طول لوحة النصّ» ${f1(Math.floor((Wp - 2 * inset) * 2) / 2)} مم أو أقلّ.`)
  if (plaqueOn && plH < 2 * fit + 4) errors.push('لوحة النصّ منخفضة جداً؛ اجعل ارتفاعها 6 مم أو أكثر.')
  const fretArch = archInset(window, frame + fit), clip = archInset(fretArch, web)
  if (window.yTop > window.cy) errors.push(`الطول المستقيم قصير للجيوب والنافذة؛ اجعل «الطول المستقيم» ${f1(Math.ceil((window.yTop - rim) * 2) / 2)} مم أو أكثر، أو ألغِ أحد الجيوب.`)
  else if (clip.r < R + 1 || clip.cy + clip.r - clip.yTop < R + 2) errors.push(`النافذة ضيّقة لمروحة واحدة؛ اجعل «نصف قطر المروحة» ${f1(Math.floor(Math.min(clip.r - 1, clip.cy + clip.r - clip.yTop - 2) * 2) / 2)} مم أو أقلّ، أو صغّر هامش النافذة.`)
  if (R / rings - web < 1.2) errors.push(`الفجوة بين أقواس المروحة أرفع من 1.2 مم؛ اجعل «عدد الأقواس» ${Math.max(3, Math.floor(R / (web + 1.2)))} أو أقلّ، أو «نصف قطر المروحة» ${f1(Math.ceil(rings * (web + 1.2) * 2) / 2)} مم أو أكثر.`)
  if (frame < 2) errors.push('الإطار الذهبي أرفع من 2 مم وسينكسر؛ اجعله 3 مم أو أكثر.')

  if (errors.length) return { panels: [], notes: [], warnings, errors, slotted: true }

  // ---------------------------------------------------------------- the pieces
  const hexPts = (w: number, h: number, cx: number, cy: number): P2[] => [{ x: cx, y: cy - h / 2 }, { x: cx + w / 2, y: cy - h / 4 }, { x: cx + w / 2, y: cy + h / 4 }, { x: cx, y: cy + h / 2 }, { x: cx - w / 2, y: cy + h / 4 }, { x: cx - w / 2, y: cy - h / 4 }]
  const r3 = (pts: P2[]) => pts.map(q => ({ x: round3(q.x), y: round3(q.y) }))
  const hexHole = polyLoop(r3(hexPts(hexW, hexH, hexC.x, hexC.y)), 'hole')
  const hexPlate = polyLoop(r3(offsetPoly(ccw(hexPts(hexW, hexH, hexW / 2 + 1, hexH / 2 + 1)), fit / 2)), 'outer')
  const stadiumHole = stadium(round3(plC.x), round3(plC.y), round3(plL), round3(plH))
  const stadiumPlate = oriented(stadium(round3(plL / 2 + 1), round3(plH / 2 + 1), round3(plL - fit), round3(plH - fit)), 'outer')
  const fret = seigaiha(clip, R, rings, web)
  const ph = round3(Lp + Rp)
  const panels: PanelSpec[] = [
    { id: 'base', name: 'القاعدة', w: Wp, h: ph, count: copies, shape: [archLoop(plate, 'outer')], holes: slots, note: 'لوح على شكل القوس بشقوق ألسنة الجدار قرب حافّته' },
    { id: 'ring', name: 'الحلقة العلوية', w: Wp, h: ph, count: copies, shape: [archLoop(plate, 'outer'), archLoop(archInset(wall, g.ringIn), 'hole')], holes: slots, note: 'حلقة بالشقوق نفسها تقوّي فم العلبة وتحتضن الطبقة السفلية للغطاء' },
    ...wallPanels,
    { id: 'end', name: 'الجدار الأمامي المستقيم', w: W, h: round3(H + 2 * t), count: copies, left: { type: 'female', from: t, len: H }, right: { type: 'female', from: t, len: H }, cuts: [...endCuts(0), ...endCuts(H + t)], note: 'يغلق الطرف المستقيم؛ تعشيق أصابع مع طرفي الشريط، وألسنته في شقوق القاعدة والحلقة' },
    { id: 'lid', name: 'الغطاء — الطبقة العلوية', w: Wp, h: ph, count: copies, shape: [archLoop(plate, 'outer')], holes: [...(hexOn ? [hexHole] : []), ...(plaqueOn ? [stadiumHole] : []), archLoop(window, 'hole')], note: 'فيه الجيوب والنافذة؛ يُلصق فوق الطبقة السفلية' },
    { id: 'lid-under', name: 'الغطاء — الطبقة السفلية', w: round3(2 * under.r), h: round3(under.cy + under.r - under.yTop), count: copies, shape: [archLoop(under, 'outer')], note: 'لوح مصمت يُلصق تحت الطبقة العلوية ويدخل في فتحة الحلقة فيثبت الغطاء' },
    { id: 'fret', name: 'لوح نقشة الأمواج', w: round3(2 * fretArch.r), h: round3(fretArch.cy + fretArch.r - fretArch.yTop), count: copies, shape: [archLoop(fretArch, 'outer')], holes: fret, note: 'يسقط في النافذة داخل الإطار الذهبي' },
    { id: 'frame', name: 'الإطار الذهبي', w: round3(2 * (window.r - fit / 2)), h: round3(window.cy + window.r - window.yTop - fit), count: copies, material: 'gold', shape: [archLoop(archInset(window, fit / 2), 'outer'), archLoop(archInset(window, frame + fit / 2), 'hole')], note: 'حلقة أكريليك ذهبي تملأ ما بين لوح النقشة وحافّة النافذة' },
    ...(hexOn ? [{ id: 'hex', name: 'لوحة الشعار السداسية', w: round3(hexW + 2), h: round3(hexH + 2), count: copies, material: 'gold', shape: [hexPlate], note: 'فارغة: احفر عليها شعارك قبل القصّ' } as PanelSpec] : []),
    ...(plaqueOn ? [{ id: 'plaque', name: 'لوحة النصّ', w: round3(plL + 2), h: round3(plH + 2), count: copies, material: 'gold', shape: [stadiumPlate], note: 'فارغة: احفر عليها نصّك قبل القصّ' } as PanelSpec] : []),
  ]
  function endCuts(y0: number): Rect[] {
    const out: Rect[] = []
    let x = 0
    for (const xk of xe) { out.push(rect(x, y0, round3(xk - tabW / 2 - x), t)); x = round3(xk + tabW / 2) }
    out.push(rect(x, y0, round3(W - x), t))
    return out.filter(r => r.w > 1e-6)
  }

  const notes = [
    `العلبة من الخارج ${f1(Wp)} × ${f1(ph)} مم (الجدار ${f1(W)} مم عرضاً و${f1(Ls)} مم مستقيماً ثم نصف دائرة)، وارتفاعها الكلّي ${f1(H + 3 * t)} مم: الارتفاع الداخلي ${f1(H)} مم وفوقه الحلقة وطبقتا الغطاء. القاعدة والحلقة والغطاء تبرز عن الجدار ${f1(rim)} مم من كل جهة.`,
    `الجدار الملتفّ شريط ${split ? `من نصفين كلّ منهما ${f1(L / 2)}` : f1(L)} × ${f1(H + 2 * t)} مم (منها ${f1(t)} مم ألسنة في كل حافّة)، فيه ${n} لساناً في كل حافّة، وقصّات المفصل المرن على القوس وحده (${f1(arcLen)} مم) والجانبان المستقيمان مصمتان. طرفاه يعشّقان بأصابع مع الجدار الأمامي المستقيم (${f1(W)} × ${f1(H + 2 * t)} مم) الذي له ${m === 1 ? 'لسان واحد' : m === 2 ? 'لسانان' : `${m} ألسنة`}.${split ? ' النصفان يلتقيان رأساً لرأس في وسط القوس ويُلصقان؛ لسان قريب على كل جانب من الوصلة يثبّتهما.' : ''}`,
    'التجميع: ضع القاعدة وأدخل ألسنة الجدار الأمامي في شقوقها، ثم عشّق طرف الشريط في أصابعه وأدخل ألسنته في شقوق الجانب، وابدأ ثني القوس لساناً بعد لسان حتى الجانب الثاني والطرف الآخر. ركّب الحلقة العلوية على الألسنة العلوية، ثم الصق الألسنة كلّها بغراء الخشب والأصابع في الزوايا.',
    `الغطاء طبقتان: الصق الطبقة السفلية (${f1(2 * under.r)} × ${f1(under.cy + under.r - under.yTop)} مم) تحت العلوية في وسطها تماماً (تبقى ${f1(rim + g.ringIn + gap)} مم من حافّة الغطاء من كل جهة)؛ تدخل في فتحة الحلقة بخلوص ${f1(gap)} مم فيستقرّ الغطاء ويرفع باليد.`,
    `النافذة: أنزل لوح النقشة ثم الإطار الذهبي حوله في جيب النافذة فوق الطبقة السفلية ولصقهما بنقاط لاصق قليلة؛ المروحة نصف قطرها ${f1(R)} مم بـ${rings} أقواس والجسور ${f1(web)} مم، وعدد الفتحات ${fret.length}.${hexOn || plaqueOn ? ` اللوحات الذهبية (أكريليك مرآة ذهبي 2–3 مم) فارغة لتحفر عليها شعارك ونصّك بالليزر قبل القصّ، وتدخل في جيوبها بخلوص ${f1(fit)} مم.` : ''}`,
    'الأدوات: غراء خشب للألسنة والأصابع، ولاصق أكريليك أو نقاط غراء شفّاف للقطع الذهبية. في الخشب الرقيق رطّب القوس قليلاً قبل الثني إن سمعت طقطقة.',
    ...(longStrip ? [longStrip] : []),
  ]
  return { panels, notes, warnings, errors, slotted: true }
}

export const ARCH_BOXES: Template[] = [
  {
    id: 'archbox',
    name: 'علبة قوس بنقشة الأمواج',
    desc: 'علبة على شكل قوس (مستطيل بطرف نصف دائري): جدار مرن يلتفّ حول القوس بألسنة في القاعدة والحلقة العلوية، وغطاء من طبقتين فيه نافذة بنقشة الأمواج اليابانية داخل إطار ذهبي، وجيبان للوحة الشعار السداسية ولوحة النصّ.',
    icon: `<path d="M14 6h36v30a18 18 0 0 1-36 0z"/><path d="M20 24a6 6 0 0 1 12 0M32 24a6 6 0 0 1 12 0M26 32a6 6 0 0 1 12 0M20 30a4 4 0 0 1 8 0M36 30a4 4 0 0 1 8 0" stroke-width="1.5"/><path d="M28 10l4-2 4 2v4l-4 2-4-2z" stroke-width="1.5"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: t => ({ W: 2 * t, D: 0, H: 0 }),
    build,
  },
]

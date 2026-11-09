// An engagement stand (ستاند خطوبة), ported from the one delivered to the customer (stand.py): a silver mirror base with
// slots; an arched back of vertical strips joined by a band at its foot, standing on two tabs; a white arched
// (tombstone) text panel standing right in front of it, its back face on the strips' front face, on two tabs of its own;
// two small triangular braces behind the strips; and, optionally, three layered hearts.
//
// Every size follows the base's width W as in stand.py (500 is the big stand, 400 the small one): the base is 0.64 W
// deep, the strip arch 0.68 W wide and 0.92 W tall, the panel 0.58 W wide and 0.76 W tall, the strips 4 % of W wide with
// 2.4 % gaps, the band at their foot 7 %. The strip arch stands 0.05 W from the base's left end and 0.08 W from its back
// edge; the panel ends 0.04 W from its right end. The strips' sharp tips (where a gap meets the arch's round top) and
// the band's two bottom corners are rounded 1.5 mm, the gaps' feet are half circles.
//
// The panel's tabs sit near a fifth and four fifths of its width, moved (in whole millimetres, the nearest way) until
// their slots keep 8 mm of base from the strip arch's slots, which lie right behind them. The braces stand on the strip
// centres nearest a quarter and three quarters of the arch, 30 × 80 mm at full size, their tabs into short slots behind
// the arch's.
//
// The hearts are the classic heart curve x = 16 sin³t, y = 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t, 0.124 W wide, its
// notch filled to a 3 mm round and its point rounded 2 mm: a silver heart, a white heart 3.5 mm inside it, and a fine
// silver line 2.5 mm wide 2.5 mm inside the white. Each layer is the silver heart's outline moved inward (an exact
// offset, worked out on the curve itself): the notch's round grows by the inset, the curve moves along its normal, and
// past 2 mm the point comes out sharp where the moved curve meets the heart's axis.
//
// The base is drawn as seen from above with the mirror face up: its back edge at the top, the panel on the right.
//
// Arabic text (the couple's names, the poem, the date) is not drawn: the app cannot shape Arabic letters. It is added
// in RDWorks or CorelDRAW.
import type { Template, ParamDef, BuildResult, Common } from './templates'
import { Vtx, Pt, polyLoop, rotatedRectHole, roundCorner, round3, bbox } from './geom'
import type { PanelSpec } from './joints'

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', hint })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
/** "n strips" with the Arabic number agreement: one, two, 3 to 10 plural, 11 and up singular (by the last two digits) */
export const stripCount = (n: number) => {
  const r = n % 100
  return n === 1 ? 'شريحة واحدة' : n === 2 ? 'شريحتان' : r >= 3 && r <= 10 ? `${n} شرائح` : `${n} شريحة`
}
const KQ = Math.tan(Math.PI / 8) // bulge of a quarter circle

/** the smallest base the design is drawn for: the hearts' fine line needs a heart 37 mm wide */
export const MIN_W = 300
/** the strips' tips and the band's corners are rounded this much (mm) */
const TIP_R = 1.5
/** base left between a panel tab's slot and the strip arch's slot beside it (mm) */
const SLOT_WEB = 8
/** the hearts' layers: the white heart and the fine line's two edges, inward from the silver heart's edge (mm) */
export const HEART_INSETS = { white: 3.5, lineOut: 6, lineIn: 8.5 }

// ------------------------------------------------------------------ the stand's numbers

export interface StandGeom {
  /** scale: W / 500 */
  s: number
  W: number; D: number
  /** the base's corner radius */
  rr: number
  /** the strip arch: width, height, the band at its foot */
  As: number; Hs: number; hb: number
  /** the text panel: width, height */
  At: number; Ht: number
  /** where they stand on the base (y from its back edge): the strip arch's left end and back face, the panel's */
  xs0: number; ys: number; xt0: number; yt: number
  /** tab width, tab depth (= the base's thickness), slot clearance, sheet thickness */
  tw: number; tb: number; fit: number; t: number
  /** strips: how many, their width, the gap between them, their centres (from the arch's left end) */
  n: number; ws: number; g: number; strips: number[]
  /** tab centres along the strip arch and along the panel (from their left ends) */
  stx: number[]; ttx: number[]
  /** the braces: on these strips (indices), foot length, height, tab width */
  braceAt: number[]; Ls: number; Hb: number; tbs: number
  /** the hearts' width */
  hw: number
}

/** the stand's sizes and places for the parameters, and what makes it impossible */
export function standGeom(p: Record<string, number>, t: number): { g: StandGeom; errors: string[] } {
  const errors: string[] = []
  const W = p.W, s = W / 500, fit = Math.max(0, p.fit)
  const D = 320 * s, As = 340 * s, Hs = 460 * s, hb = 35 * s, At = 290 * s, Ht = 380 * s
  const xs0 = 25 * s, ys = 40 * s, xt0 = W - 20 * s - At, yt = ys + t
  const tw = 40 * s, tb = p.tm > 0 ? p.tm : t
  if (W < MIN_W) errors.push(`عرض القاعدة ${f1(W)} مم صغير: أقلّ عرض ${MIN_W} مم (كلّ القياسات تتبعه، والمقاس الصغير 400).`)
  if (p.tm > 0 && p.tm < 1) errors.push(`سماكة القاعدة ${f1(p.tm)} مم لا تمسك الألسنة: اكتب سماكتها الحقيقية (أو 0 لتكون مثل سماكة اللوح).`)
  // strips: as many as fit at the width asked (they widen a little to fill the arch)
  const g = p.sg > 0 ? p.sg : 12 * s, swant = p.sw > 0 ? p.sw : 20 * s
  const n = Math.max(1, Math.floor((As + g) / (swant + g) + 1e-9))
  const ws = (As - (n - 1) * g) / n
  const strips = Array.from({ length: n }, (_, i) => i * (ws + g) + ws / 2)
  const wsMin = Math.max(6, t + 2)
  if (g < 3) errors.push(`الفراغ بين الشرائح ${f1(g)} مم ضيّق: 3 مم على الأقلّ.`)
  if (n < 3) errors.push(`الشرائح عريضة على قوس عرضه ${f1(As)} مم: لا تتّسع إلا ${stripCount(n)}؛ صغّر عرض الشريحة أو الفراغ بينها.`)
  else if (ws < wsMin) errors.push(`الشرائح عرضها ${f1(ws)} مم فقط: يلزم ${f1(wsMin)} مم على الأقلّ لتُلصق عليها الدعامة (سماكتها ${t} مم) ولا تنكسر؛ كبّر عرض الشريحة.`)
  const stx = [0.22 * As, 0.78 * As]
  // the panel's tabs: the nearest place to a fifth and four fifths of its width, either way in whole millimetres, where
  // the slot keeps SLOT_WEB of base from the strip arch's slots (right behind it) and the tab 8 mm from the panel's ends
  const need = tw + fit + SLOT_WEB
  const clear = (x: number) => stx.every(xa => Math.abs(xt0 + x - (xs0 + xa)) >= need - 1e-6) && x >= tw / 2 + 8 - 1e-9 && x <= At - tw / 2 - 8 + 1e-9
  const ttx: number[] = []
  for (const f of [0.2, 0.8]) {
    let found: number | null = null
    for (let k = 0; k <= Math.ceil(At) && found === null; k++) for (const sg of [1, -1]) if (found === null && clear(f * At + k * sg)) found = f * At + k * sg
    if (found !== null) ttx.push(found)
  }
  if (ttx.length < 2 || ttx[1] - ttx[0] < tw + fit + SLOT_WEB) errors.push(`لا مكان للسانَي لوح الكتابة يبعد شقّاهما ${SLOT_WEB} مم عن شقّي قوس الشرائح: كبّر عرض القاعدة.`)
  // the braces: under the strips nearest a quarter and three quarters of the arch
  const braceAt = [0.25, 0.75].map(q => strips.reduce((bi, c, i) => (Math.abs(c - q * As) < Math.abs(strips[bi] - q * As) ? i : bi), 0))
  const Ls = 30 * s, Hb = 80 * s, tbs = 0.45 * Ls
  const g0: StandGeom = { s, W, D, rr: 12 * s, As, Hs, hb, At, Ht, xs0, ys, xt0, yt, tw, tb, fit, t, n, ws, g, strips, stx, ttx, braceAt, Ls, Hb, tbs, hw: 62 * s }
  return { g: g0, errors }
}

// ------------------------------------------------------------------ outlines (screen coordinates, y down)

/** the bulge of the shorter arc about c from p to q */
function minorBulge(c: Pt, p: Pt, q: Pt): number {
  let d = Math.atan2(q.y - c.y, q.x - c.x) - Math.atan2(p.y - c.y, p.x - c.x)
  while (d > Math.PI) d -= 2 * Math.PI
  while (d <= -Math.PI) d += 2 * Math.PI
  return -Math.tan(d / 4) // increasing screen angle runs clockwise on screen: a negative bulge
}

const tidy = (pts: Vtx[]): Vtx[] => pts.map(v => ({ x: round3(v.x), y: round3(v.y), ...(v.b ? { b: v.b } : {}) }))

/** tabs `depth` deep under y = 0 at the given centres, from right to left (an outline running along its bottom westward) */
const tabsUnder = (xs: number[], w: number, depth: number): Vtx[] =>
  [...xs].sort((a, b) => b - a).flatMap(x => [{ x: x + w / 2, y: 0 }, { x: x + w / 2, y: depth }, { x: x - w / 2, y: depth }, { x: x - w / 2, y: 0 }])

/**
 * The strip arch standing on the base's top (y = 0, the arch above it): a tombstone As × Hs with gaps g wide from the
 * band's top (hb, a half circle at each gap's foot) up through its round top; every sharp tip and the band's two
 * bottom corners rounded TIP_R; the tabs under the band. Clockwise on screen from the bottom-left corner.
 */
export function stripArchOutline(g: StandGeom): Vtx[] {
  const { As, Hs, hb, n, ws, g: gap, stx, tw, tb } = g
  const R = As / 2, C = { x: R, y: -(Hs - R) }, rf = TIP_R
  // a fillet in the corner between the round top and a vertical side at x (side = −1: the strip lies left of x)
  const fillet = (x: number, side: -1 | 1) => {
    const fx = x + side * rf, fy = C.y - Math.sqrt((R - rf) ** 2 - (fx - C.x) ** 2), k = R / (R - rf)
    return { F: { x: fx, y: fy }, onArc: { x: C.x + (fx - C.x) * k, y: C.y + (fy - C.y) * k }, onSide: { x, y: fy } }
  }
  const pts: Vtx[] = [{ x: 0, y: -rf }]
  let cur: Pt = { x: 0, y: C.y }
  for (let j = 0; j < n - 1; j++) {
    const xl = j * (ws + gap) + ws, xr = xl + gap, yg = -(hb + gap / 2)
    const a = fillet(xl, -1), b = fillet(xr, 1)
    pts.push({ ...cur, b: minorBulge(C, cur, a.onArc) }, { ...a.onArc, b: minorBulge(a.F, a.onArc, a.onSide) }, { ...a.onSide })
    pts.push({ x: xl, y: yg, b: 1 }, { x: xr, y: yg }) // down the gap's left side, round its foot, up its right side
    pts.push({ ...b.onSide, b: minorBulge(b.F, b.onSide, b.onArc) })
    cur = b.onArc
  }
  pts.push({ ...cur, b: minorBulge(C, cur, { x: As, y: C.y }) }, { x: As, y: C.y }, { x: As, y: -rf, b: -KQ }, { x: As - rf, y: 0 })
  pts.push(...tabsUnder(stx, tw, tb), { x: rf, y: 0, b: -KQ })
  return tidy(pts)
}

/** The text panel: a tombstone At × Ht standing on y = 0, its tabs under it. */
export function panelOutline(g: StandGeom): Vtx[] {
  const { At, Ht, ttx, tw, tb } = g, yc = -(Ht - At / 2)
  return tidy([{ x: 0, y: 0 }, { x: 0, y: yc, b: -1 }, { x: At, y: yc }, { x: At, y: 0 }, ...tabsUnder(ttx, tw, tb)])
}

/** A brace: a right triangle, its upright leg (x = 0) glued to the strip arch's back, its foot on the base with a tab. */
export function braceOutline(g: StandGeom): Vtx[] {
  const { Ls, Hb, tbs, tb } = g
  return tidy([{ x: 0, y: -Hb }, { x: Ls, y: 0 }, ...tabsUnder([0.55 * Ls], tbs, tb), { x: 0, y: 0 }])
}

// ------------------------------------------------------------------ hearts

const HX = (t: number) => 16 * Math.sin(t) ** 3
const HY = (t: number) => 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
const HdX = (t: number) => 48 * Math.sin(t) ** 2 * Math.cos(t)
const HdY = (t: number) => -13 * Math.sin(t) + 10 * Math.sin(2 * t) + 6 * Math.sin(3 * t) + 4 * Math.sin(4 * t)
/** where the normal at the curve's point t meets the axis x = 0, and how far from the point that is (curve units) */
function axisHit(t: number) {
  const lam = HX(t) / HdY(t)
  return { y: HY(t) + lam * HdX(t), d: Math.abs(lam) * Math.hypot(HdX(t), HdY(t)) }
}
/** the t in [lo, hi] whose normal reaches the axis d away (that distance runs monotonically over the interval) */
function solveHit(d: number, lo: number, hi: number): number {
  const rising = axisHit(hi).d > axisHit(lo).d
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2
    if ((axisHit(m).d < d) === rising) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}

function simplifyDP(pts: Pt[], tol: number): Pt[] {
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const A = pts[a], B = pts[b], dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy
    let best = -1, bi = -1
    for (let i = a + 1; i < b; i++) {
      const q = pts[i], u = L2 ? Math.max(0, Math.min(1, ((q.x - A.x) * dx + (q.y - A.y) * dy) / L2)) : 0
      const dd = Math.hypot(q.x - A.x - u * dx, q.y - A.y - u * dy)
      if (dd > best) { best = dd; bi = i }
    }
    if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]) }
  }
  return pts.filter((_, i) => keep[i])
}

/**
 * The heart w wide (its notch filled to a 3 mm round, its point rounded 2 mm) with its edge moved `inset` mm inward:
 * a closed outline in screen coordinates (point down), on the axis x = 0, in the same place for every inset.
 * Valid while the curve's convex parts stay rounder than the inset (a heart 37 mm wide or more for 8.5 mm).
 */
export function heartOutline(w: number, inset: number): Vtx[] {
  const k = w / 32, rc = 3 / k, ro = 2 / k, du = inset / k
  const S = (x: number, y: number): Pt => ({ x: k * x, y: -k * y })
  // the notch: a 3 mm ball from outside, on the axis, comes to rest touching the curve at tn; the point: a 2 mm ball
  // from inside rests touching it at tt
  const tn = solveHit(rc, 1e-4, 0.8), yb = axisHit(tn).y
  const tt = solveHit(ro, 2.0, Math.PI - 1e-9), yt = axisHit(tt).y
  const sharp = du >= ro, tEnd = sharp ? solveHit(du, 2.0, Math.PI - 1e-9) : tt
  const off = (t: number): Pt => {
    const dx = HdX(t), dy = HdY(t), L = Math.hypot(dx, dy)
    return S(HX(t) + (du * dy) / L, HY(t) - (du * dx) / L) // the inward normal lies right of the way t runs
  }
  const M = 600, curve: Pt[] = []
  for (let i = 0; i <= M; i++) curve.push(off(tn + ((tEnd - tn) * i) / M))
  if (sharp) curve[M] = S(0, axisHit(tEnd).y) // on the axis (where the two sides meet in a point)
  const line = simplifyDP(curve, 0.01)
  // the right half, from the notch's lowest point on the axis to the point
  const p0 = S(0, yb - rc - du)
  const half: Vtx[] = [{ ...p0, b: minorBulge(S(0, yb), p0, line[0]) }, ...line.map(q => ({ ...q }))]
  if (!sharp) {
    const end = S(0, yt - ro + du), last = half[half.length - 1]
    last.b = minorBulge(S(0, yt), last, end)
    half.push({ ...end })
  }
  // the left half is its mirror image, run backwards (a mirrored arc run backwards keeps its bulge)
  const m = half.length - 1
  const pts: Vtx[] = half.map((v, i) => ({ x: v.x, y: v.y, ...(i < m && v.b ? { b: v.b } : {}) }))
  pts[m] = { ...pts[m], ...(half[m - 1].b ? { b: half[m - 1].b } : {}) }
  for (let i = m - 1; i >= 1; i--) pts.push({ x: -half[i].x, y: half[i].y, ...(half[i - 1].b ? { b: half[i - 1].b } : {}) })
  return tidy(pts)
}

// ------------------------------------------------------------------ the template

const PARAMS: ParamDef[] = [
  mm('W', 'عرض القاعدة', MIN_W, 800, 'الستاند الكبير 500 والصغير 400؛ كلّ القياسات تتبعه: القاعدة بعمق 0.64 من عرضها، قوس الشرائح 0.68 × 0.92، ولوح الكتابة 0.58 × 0.76'),
  mm('sw', 'عرض الشريحة', 0, 40, '0 = تلقائي: 4% من عرض القاعدة (20 مم على 500). تتّسع قليلاً لتملأ القوس'),
  mm('sg', 'الفراغ بين الشرائح', 0, 30, '0 = تلقائي: 2.4% من عرض القاعدة (12 مم على 500)'),
  { key: 'hearts', label: 'ثلاثة قلوب بثلاث طبقات', min: 0, max: 1, step: 1, int: true, hint: 'قلب فضّي، فوقه قلب أبيض، فوقه خطّ فضّي رفيع' },
  mm('tm', 'سماكة القاعدة', 0, 10, '0 = مثل سماكة اللوح. الألسنة بطولها فلا تبرز تحت القاعدة'),
  mm('fit', 'خلوص الشقوق', 0, 1, 'يُضاف لعرض الشقّ وطوله فوق السماكة واللسان'),
]
const DEFAULTS = { W: 500, sw: 0, sg: 0, hearts: 1, tm: 0, fit: 0.2 }

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = []
  const t = c.t
  const { g, errors } = standGeom(p, t)
  if (errors.length) return { panels: [], notes: [], warnings, errors, slotted: true }
  const { W, D, As, Hs, hb, At, Ht, xs0, ys, xt0, yt, tw, tb, fit, n, ws, strips, stx, ttx, braceAt, Ls, tbs, hw } = g
  const hearts = Math.round(p.hearts) > 0
  const shape = (pts: Vtx[], as: 'outer' | 'hole') => polyLoop(pts, as)
  const sized = (loops: ReturnType<typeof shape>[]) => { const b = bbox(loops); return { w: round3(b.maxX - b.minX), h: round3(b.maxY - b.minY) } }

  // the base, y from its back edge (as seen from above, mirror face up): a slot for every tab
  const slot = (cx: number, cy: number, w: number, h: number) => rotatedRectHole(round3(cx), round3(cy), round3(w), round3(h), 0)
  const slots = [
    ...stx.map(x => slot(xs0 + x, ys + t / 2, tw + fit, t + fit)),
    ...ttx.map(x => slot(xt0 + x, yt + t / 2, tw + fit, t + fit)),
    ...braceAt.map(i => slot(xs0 + strips[i], ys - 0.55 * Ls, t + fit, tbs + fit)),
  ]
  const rr = g.rr, Dr = round3(D), Wr = round3(W)
  const arch = shape(stripArchOutline(g), 'outer'), panel = shape(panelOutline(g), 'outer'), brace = shape(braceOutline(g), 'outer')
  const panels: PanelSpec[] = [
    {
      id: 'base', name: 'القاعدة (مرآة فضّية)', w: Wr, h: Dr, material: 'mirror', holes: slots,
      post: loops => { for (const [x, y] of [[0, 0], [Wr, 0], [Wr, Dr], [0, Dr]]) roundCorner(loops, x, y, rr) },
      note: 'مرسومة كما تُرى من فوق ووجه المرآة للأعلى: الحافّة الخلفية في الأعلى ولوح الكتابة على اليمين',
    },
    { id: 'arch', name: 'قوس الشرائح (مرآة فضّية)', ...sized([arch]), material: 'mirror', shape: [arch], note: `${stripCount(n)} يجمعها حزام في أسفلها، بلسانين في القاعدة` },
    { id: 'panel', name: 'لوح الكتابة (أبيض)', ...sized([panel]), material: 'white', shape: [panel], note: 'يقف أمام قوس الشرائح مباشرة ويُلصق ظهره على وجهه؛ الأسماء والشعر تُضاف في RDWorks' },
    { id: 'brace', name: 'دعامة خلفية (مرآة)', ...sized([brace]), count: 2, material: 'mirror', shape: [brace], note: 'حافّتها العمودية على ظهر شريحة من القوس، ولسانها في الشقّ الصغير خلفه' },
  ]
  if (hearts) {
    const h0 = shape(heartOutline(hw, 0), 'outer'), h1 = shape(heartOutline(hw, HEART_INSETS.white), 'outer')
    const lo = shape(heartOutline(hw, HEART_INSETS.lineOut), 'outer'), li = shape(heartOutline(hw, HEART_INSETS.lineIn), 'hole')
    panels.push(
      { id: 'heart', name: 'قلب فضّي', ...sized([h0]), count: 3, material: 'mirror', shape: [h0], note: 'الطبقة السفلى' },
      { id: 'heart-white', name: 'قلب أبيض', ...sized([h1]), count: 3, material: 'white', shape: [h1], note: `يُلصق في وسط القلب الفضّي فتبقى حوله حافّة فضّية ${HEART_INSETS.white} مم` },
      { id: 'heart-line', name: 'خطّ القلب الفضّي', ...sized([lo]), count: 3, material: 'mirror', shape: [lo], holes: [li], note: `يُلصق فوق القلب الأبيض على بعد ${HEART_INSETS.lineOut - HEART_INSETS.white} مم من حافّته` },
    )
  }
  const ordinal = (i: number) => ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'][i] ?? `رقم ${i + 1}`
  const notes = [
    `القاعدة ${f1(W)} × ${f1(D)} مم. قوس الشرائح ${f1(As)} × ${f1(Hs)} مم: ${stripCount(n)} عرض كلّ منها ${f1(ws)} مم بينها ${f1(g.g)} مم، يجمعها حزام بارتفاع ${f1(hb)} مم في أسفلها. لوح الكتابة ${f1(At)} × ${f1(Ht)} مم يقف أمامه مباشرة على اليمين${hearts ? `، والقلوب عرضها ${f1(hw)} مم` : ''}.`,
    'التركيب: أدخل لسانَي قوس الشرائح في الشقّين الخلفيين، ثم لسانَي لوح الكتابة في الشقّين أمامهما مباشرة فيستند ظهر اللوح على وجه القوس. الصق ظهر اللوح على القوس بلاصق UV أو جل شفّاف، لا بغراء الأكريليك السائل: يذيب طلاء المرآة ويترك أثراً.',
    `الدعامتان خلف القوس: حافّة كلّ منهما العمودية تُلصق على ظهر الشريحة ${ordinal(braceAt[0])} والشريحة ${ordinal(braceAt[1])} من اليسار (من الأمام)، ولسانها في الشقّ الصغير خلف شقّ القوس.`,
    ...(hearts ? [`القلوب: الصق القلب الأبيض في وسط القلب الفضّي فتبقى حوله حافّة فضّية ${HEART_INSETS.white} مم، ثم الخطّ الفضّي الرفيع (${HEART_INSETS.lineIn - HEART_INSETS.lineOut} مم) فوق الأبيض على بعد ${HEART_INSETS.lineOut - HEART_INSETS.white} مم من حافّته. توضع أمام لوح الكتابة، ويبقى أمام قوس الشرائح على اليسار مكان لعلبتي المحابس.`] : []),
    'الأسماء والشعر والتاريخ لا تُرسم هنا (البرنامج لا يشكّل الحروف العربية): اكتبها في RDWorks أو CorelDRAW على لوح الكتابة، حفراً على الأبيض أو حروفاً تُقصّ من أكريليك أسود وتُلصق عليه.',
    'القاعدة مرسومة كما تُرى من فوق ووجه المرآة للأعلى: حافّتها الخلفية في أعلى الرسم ولوح الكتابة على اليمين. اقصّها ووجه المرآة (بورق الحماية) للأعلى كما هي، وإلا انعكست مواضع الشقوق.',
    `قِس سماكة الألواح بالقدمة قبل القصّ: الشقوق على سماكة ${t} مم مع خلوص ${fit} مم (${f1(t + fit)} مم)، والألسنة بطول سماكة القاعدة (${tb} مم) فلا تبرز تحتها. لوح «3 مم» كثيراً ما يكون 3.2.`,
  ]
  return { panels, notes, warnings, errors, slotted: true }
}

export const ENGAGE_STANDS: Template[] = [
  {
    id: 'engagestand',
    name: 'ستاند خطوبة: قوس شرائح ولوح بقوس',
    desc: 'كما في الصورة: قاعدة مرآة فضّية بشقوق، خلفها قوس من شرائح عمودية يجمعها حزام في أسفلها، وأمامه مباشرة لوح كتابة أبيض بقوس، ودعامتان صغيرتان خلفه، وثلاثة قلوب بثلاث طبقات (فضّي، أبيض، وخطّ فضّي رفيع). الأسماء والشعر تُضاف في RDWorks.',
    icon: `<path d="M5 54h54v5H5z"/><path d="M9 54V27a16 16 0 0 1 32 0v27"/><path d="M15 54V20M21 54V14M27 54V12M33 54V14" stroke-width="1.5"/><path d="M27 54V37a12 12 0 0 1 24 0v17z"/><path d="M39 31h6M37 35h10" stroke-width="1.2"/><path d="M39 49l-3-3a2 2 0 0 1 3-2.5 2 2 0 0 1 3 2.5z" fill="currentColor" stroke="none"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build,
  },
]

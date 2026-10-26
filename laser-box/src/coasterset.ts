// A set of square coasters cut with a dahlia fret, the box they stack in and the lid that turns the box into a stand.
//
// The fret was measured off the customer's photo: the photo was rectified, the eight symmetric copies averaged, and
// every hole fitted as a circular lens (or a straight-sided wedge) clipped by the plain border. It keeps its proportions
// at every size: it scales with the inside of the border, and the web width is set by offsetting every hole, so the
// narrowest web is exactly the width asked for.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Vtx, Rect, rect, arcInfo, offsetLoop, oriented, signedArea, loopLength, roundCorner, roundedRectHole, rotatedRectHole, hingeLines, round3, bbox, simplify } from './geom'
import { PanelSpec } from './joints'

type Pt2 = { x: number; y: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', hint })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()

// ------------------------------------------------------------------ the dahlia fret
//
// In the photo's own units (y up, centre at the origin): the holes' edge along the border lies HI from the centre, the
// border is 40 wide, the coaster's outer corner radius about 165 and the border's inner corner 151. One eighth of the
// pattern is given (between the +x axis and the diagonal); the rest follows by the square's eight symmetries.
const D = {
  hi: 528,
  rcIn: 151,
  /** the narrowest web of the photo (between neighbouring petals of the first ring, at the hub) */
  web: 27.48,
  border: 40,
  rOut: 165,
  /** ring 1: eight petals, tips meeting round a small hub; straight flanks out to T, then an arc tangent there to the outer tip */
  r1: { ra: 35.9, al: 21.15, tT: 90.9, rb: 398 },
  /** ring 2: eight big petals between them (on the 22.5° rays), cut off by the border */
  r2: { a: [248.4, 101.6], b: [607.2, 250.6], s: 62.4 },
  /** ring 3: a pair of petals beyond each petal of ring 1; on the axes the border cuts them, on the diagonals they are whole */
  d: { a: [397.2, 62.5], b: [603.1, 45.3], s: 32.5 },
  e: { a: [328.0, 238.4], b: [442.4, 379.6], s: 31.4 },
  /** the corners: a wedge either side of the diagonal and one on it, closed by the border */
  f: { a: [460.3, 305.8], p1: [605.6, 302.9], p2: [558.8, 466.2] },
  g: { a: 427.4, q: [557.2, 484.6] },
}
/** the shape kinds: the first four are the flower itself, the corner wedges may drop out on a small coaster */
type Kind = 'r1' | 'r2' | 'd' | 'e' | 'f' | 'g'
const KIND_NAME: Record<Kind, string> = { r1: 'بتلات الحلقة الأولى', r2: 'البتلات الكبيرة', d: 'بتلات الحافّة', e: 'بتلات القُطر', f: 'مثلّثات الزوايا', g: 'مثلّثات الزوايا' }
/** narrowest hole worth cutting: about this wide across (twice the area over the perimeter, the inscribed width of a triangle) */
const MIN_HOLE = 1.2

/** Bulge of the arc from p to q whose middle point is m (b > 0 bows to the right of p → q on screen, as in geom.ts). */
function bulgeThrough(p: Pt2, q: Pt2, m: Pt2): number {
  const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy)
  const s = ((m.x - (p.x + q.x) / 2) * -dy + (m.y - (p.y + q.y) / 2) * dx) / L
  return (2 * s) / L
}

/** A lens hole: two arcs from tip a to tip b, each bowing out by s (screen coordinates). */
function lens(a: Pt2, b: Pt2, s: number): Loop {
  const bl = (2 * s) / Math.hypot(b.x - a.x, b.y - a.y)
  return oriented({ closed: true, pts: [{ x: a.x, y: a.y, b: bl }, { x: b.x, y: b.y, b: bl }] }, 'hole')
}

/** The base holes (one of each kind, the first-ring petal twice) in mm, screen coordinates about the coaster's centre. */
function baseHoles(k: number): { kind: Kind; loop: Loop; half: number }[] {
  const P = (x: number, y: number): Pt2 => ({ x: x * k, y: -y * k })
  const { ra, al, tT, rb } = D.r1
  // ring 1, along +x: straight flanks from the tip A to T, then the arc through the outer tip B that is tangent at T
  const u = { x: Math.cos((al * Math.PI) / 180), y: Math.sin((al * Math.PI) / 180) }
  const T = { x: ra + tT * u.x, y: tT * u.y }, n = { x: u.y, y: -u.x }
  const dT = { x: T.x - rb, y: T.y }, rho = -(dT.x * dT.x + dT.y * dT.y) / (2 * (n.x * dT.x + n.y * dT.y))
  const C = { x: T.x + n.x * rho, y: T.y + n.y * rho }
  const aT = Math.atan2(T.y - C.y, T.x - C.x), aB = Math.atan2(-C.y, rb - C.x), am = (aT + aB) / 2
  const M = { x: C.x + Math.abs(rho) * Math.cos(am), y: C.y + Math.abs(rho) * Math.sin(am) }
  const A = P(ra, 0), Ts = P(T.x, T.y), B = P(rb, 0), Ms = P(M.x, M.y), Tm = P(T.x, -T.y), Mm = P(M.x, -M.y)
  const r1 = oriented({ closed: true, pts: [{ ...A }, { ...Ts, b: bulgeThrough(Ts, B, Ms) }, { ...B, b: bulgeThrough(B, Tm, Mm) }, { ...Tm }] }, 'hole')
  const rot45 = (l: Loop): Loop => { const c = Math.SQRT1_2; return { ...l, pts: l.pts.map(v => ({ ...v, x: c * v.x - c * v.y, y: c * v.x + c * v.y })) } }
  const L = (o: { a: number[]; b: number[]; s: number }) => lens(P(o.a[0], o.a[1]), P(o.b[0], o.b[1]), o.s * k)
  const wedge = (pts: number[][]) => oriented({ closed: true, pts: pts.map(([x, y]) => P(x, y)) }, 'hole')
  return [
    { kind: 'r1', loop: r1, half: 52 * k },
    { kind: 'r1', loop: rot45(r1), half: 52 * k },
    { kind: 'r2', loop: L(D.r2), half: D.r2.s * k },
    { kind: 'd', loop: L(D.d), half: D.d.s * k },
    { kind: 'e', loop: L(D.e), half: D.e.s * k },
    { kind: 'f', loop: wedge([D.f.a, D.f.p1, D.f.p2]), half: 40 * k },
    { kind: 'g', loop: wedge([[D.g.a, D.g.a], D.g.q, [D.g.q[1], D.g.q[0]]]), half: 40 * k },
  ]
}

// ------------------------------------------------------------------ clipping a hole by the border's rounded square

/** Point and bulge helpers for one edge of a loop (a line, or an arc from geom's bulge). */
function edgeAt(p: Vtx, q: Vtx) {
  if (!p.b) return { at: (t: number): Pt2 => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }), sub: () => 0 }
  const a = arcInfo(p, q, p.b), sg = a.ccw ? -1 : 1
  return {
    at: (t: number): Pt2 => { const ang = a.a0 + sg * a.theta * t; return { x: a.c.x + a.r * Math.cos(ang), y: a.c.y + a.r * Math.sin(ang) } },
    sub: (t0: number, t1: number) => Math.sign(p.b!) * Math.tan((a.theta * (t1 - t0)) / 4),
  }
}

/** The square of half-size h with corners of radius rc, centred on the origin: inside test, perimeter, paths along it. */
function roundedSquare(h: number, rc: number) {
  rc = Math.max(0, Math.min(rc, h))
  const k = h - rc, E = 2 * k, A = (Math.PI / 2) * rc, per = 4 * (E + A)
  // pieces clockwise on screen, from the left end of the top edge
  const pieces: ({ kind: 'line'; p: Pt2; q: Pt2 } | { kind: 'arc'; c: Pt2; a0: number })[] = [
    { kind: 'line', p: { x: -k, y: -h }, q: { x: k, y: -h } }, { kind: 'arc', c: { x: k, y: -k }, a0: -Math.PI / 2 },
    { kind: 'line', p: { x: h, y: -k }, q: { x: h, y: k } }, { kind: 'arc', c: { x: k, y: k }, a0: 0 },
    { kind: 'line', p: { x: k, y: h }, q: { x: -k, y: h } }, { kind: 'arc', c: { x: -k, y: k }, a0: Math.PI / 2 },
    { kind: 'line', p: { x: -h, y: k }, q: { x: -h, y: -k } }, { kind: 'arc', c: { x: -k, y: -k }, a0: Math.PI },
  ]
  const len = (i: number) => (i % 2 === 0 ? E : A)
  const start = (i: number) => Math.floor(i / 2) * (E + A) + (i % 2 === 1 ? E : 0)
  const pointAt = (s: number): Pt2 => {
    s = ((s % per) + per) % per
    for (let i = 0; i < 8; i++) {
      const s0 = start(i), L = len(i)
      if (s <= s0 + L + 1e-12 || i === 7) {
        const pc = pieces[i], t = L > 0 ? (s - s0) / L : 0
        if (pc.kind === 'line') return { x: pc.p.x + (pc.q.x - pc.p.x) * t, y: pc.p.y + (pc.q.y - pc.p.y) * t }
        const ang = pc.a0 + (Math.PI / 2) * t
        return { x: pc.c.x + rc * Math.cos(ang), y: pc.c.y + rc * Math.sin(ang) }
      }
    }
    return { x: -k, y: -h }
  }
  /** the perimeter coordinate of a point on (or next to) the boundary */
  const sOf = (p: Pt2): number => {
    let best = Infinity, bs = 0
    for (let i = 0; i < 8; i++) {
      const pc = pieces[i], L = len(i)
      let t: number, d: number
      if (pc.kind === 'line') {
        const dx = pc.q.x - pc.p.x, dy = pc.q.y - pc.p.y, l2 = dx * dx + dy * dy
        t = l2 ? Math.max(0, Math.min(1, ((p.x - pc.p.x) * dx + (p.y - pc.p.y) * dy) / l2)) : 0
        d = Math.hypot(p.x - pc.p.x - t * dx, p.y - pc.p.y - t * dy)
      } else {
        let ang = Math.atan2(p.y - pc.c.y, p.x - pc.c.x) - pc.a0
        ang = ((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
        if (ang > Math.PI * 1.25) ang -= 2 * Math.PI
        t = Math.max(0, Math.min(1, ang / (Math.PI / 2)))
        const q = { x: pc.c.x + rc * Math.cos(pc.a0 + (Math.PI / 2) * t), y: pc.c.y + rc * Math.sin(pc.a0 + (Math.PI / 2) * t) }
        d = Math.hypot(p.x - q.x, p.y - q.y)
      }
      if (d < best) { best = d; bs = start(i) + t * L }
    }
    return bs
  }
  /** vertices (with bulges) of the boundary from s0 to s1, going clockwise (dir 1) or anticlockwise (-1) on screen; s1's point is left out */
  const path = (s0: number, s1: number, dir: 1 | -1): Vtx[] => {
    let span = dir > 0 ? s1 - s0 : s0 - s1
    span = ((span % per) + per) % per
    const marks: number[] = [s0]
    for (let i = 0; i < 8; i++) for (const b of [start(i), start(i) + per, start(i) - per]) {
      const off = dir > 0 ? b - s0 : s0 - b
      if (off > 1e-9 && off < span - 1e-9) marks.push(b)
    }
    marks.sort((a, b) => (dir > 0 ? a - b : b - a))
    marks.push(dir > 0 ? s0 + span : s0 - span)
    const out: Vtx[] = []
    for (let j = 0; j + 1 < marks.length; j++) {
      const a = marks[j], b = marks[j + 1], m = (a + b) / 2, mp = ((m % per) + per) % per
      let i = 0
      for (; i < 7; i++) if (mp < start(i) + len(i)) break
      const p = pointAt(a)
      if (i % 2 === 1 && rc > 1e-9) out.push({ x: p.x, y: p.y, b: -dir * Math.tan(Math.abs(b - a) / rc / 4) })
      else out.push({ x: p.x, y: p.y })
    }
    return out
  }
  const inside = (p: Pt2) => {
    const ax = Math.abs(p.x), ay = Math.abs(p.y)
    if (ax > h || ay > h) return false
    if (ax <= k || ay <= k) return true
    return Math.hypot(ax - k, ay - k) <= rc
  }
  return { inside, sOf, path, per }
}

/** The part of a hole inside the rounded square (half-size h, corner radius rc), or null when nothing is left. */
function clipHole(l: Loop, h: number, rc: number): Loop | null {
  const sq = roundedSquare(h, rc), n = l.pts.length
  // split every edge where it crosses the boundary
  type Piece = { a: Pt2; b: Pt2; bulge: number; inside: boolean }
  const pieces: Piece[] = []
  for (let i = 0; i < n; i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n], e = edgeAt(p, q)
    const N = p.b ? 64 : 24, ts = [0]
    for (let j = 0; j < N; j++) {
      const t0 = j / N, t1 = (j + 1) / N
      if (sq.inside(e.at(t0)) === sq.inside(e.at(t1))) continue
      let lo = t0, hi = t1
      const inLo = sq.inside(e.at(lo))
      for (let it = 0; it < 48; it++) { const m = (lo + hi) / 2; if (sq.inside(e.at(m)) === inLo) lo = m; else hi = m }
      ts.push((lo + hi) / 2)
    }
    ts.push(1)
    for (let j = 0; j + 1 < ts.length; j++) {
      const t0 = ts[j], t1 = ts[j + 1]
      if (t1 - t0 < 1e-9) continue
      pieces.push({ a: e.at(t0), b: e.at(t1), bulge: e.sub(t0, t1), inside: sq.inside(e.at((t0 + t1) / 2)) })
    }
  }
  if (pieces.every(pc => pc.inside)) return l
  if (!pieces.some(pc => pc.inside)) return null
  // start just after an outside run, then walk: inside pieces as they are, each outside run replaced by the boundary
  let s = pieces.findIndex((pc, i) => pc.inside && !pieces[(i - 1 + pieces.length) % pieces.length].inside)
  if (s < 0) s = 0
  const out: Vtx[] = []
  for (let c = 0; c < pieces.length; c++) {
    const pc = pieces[(s + c) % pieces.length]
    if (!pc.inside) continue
    out.push({ x: pc.a.x, y: pc.a.y, ...(pc.bulge ? { b: pc.bulge } : {}) })
    const nxt = pieces[(s + c + 1) % pieces.length]
    if (nxt.inside) continue
    // the next inside piece after this outside run
    let j = 1
    while (!pieces[(s + c + j) % pieces.length].inside) j++
    const back = pieces[(s + c + j) % pieces.length].a
    const s0 = sq.sOf(pc.b), s1 = sq.sOf(back)
    const fw = ((s1 - s0) % sq.per + sq.per) % sq.per
    out.push(...sq.path(s0, s1, fw <= sq.per / 2 ? 1 : -1))
  }
  const loop: Loop = { closed: true, pts: simplify(out) }
  if (loop.pts.length < 2 || Math.abs(signedArea(loop)) < 1e-6) return null
  return oriented(loop, 'hole')
}

// ------------------------------------------------------------------ the whole fret

/** the eight symmetries of the square; mirrors (det −1) turn the bulges round */
const D4: [(p: Pt2) => Pt2, number][] = [
  [p => ({ x: p.x, y: p.y }), 1], [p => ({ x: -p.x, y: p.y }), -1], [p => ({ x: p.x, y: -p.y }), -1], [p => ({ x: -p.x, y: -p.y }), 1],
  [p => ({ x: p.y, y: p.x }), -1], [p => ({ x: -p.y, y: p.x }), 1], [p => ({ x: p.y, y: -p.x }), 1], [p => ({ x: -p.y, y: -p.x }), -1],
]

/** A dense polygon of a loop, for distances. */
function sample(l: Loop, stepDeg = 3): Pt2[] {
  const out: Pt2[] = [], n = l.pts.length
  for (let i = 0; i < n; i++) {
    const p = l.pts[i], q = l.pts[(i + 1) % n]
    out.push({ x: p.x, y: p.y })
    if (p.b) {
      const e = edgeAt(p, q), m = Math.max(2, Math.ceil((4 * Math.atan(Math.abs(p.b)) * 180) / Math.PI / stepDeg))
      for (let j = 1; j < m; j++) out.push(e.at(j / m))
    }
  }
  return out
}
const segD = (p: Pt2, a: Pt2, b: Pt2) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
function polyGap(A: Pt2[], B: Pt2[]): number {
  let d = Infinity
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
    d = Math.min(d, segD(A[i], B[j], B[(j + 1) % B.length]), segD(B[j], A[i], A[(i + 1) % A.length]))
  }
  return d
}

interface Fret { holes: Loop[]; kinds: Kind[]; /** kinds whose holes came out too small to cut and were left out */ dropped: Kind[]; /** narrowest hole kept, mm across */ smallest: number; /** narrowest web between holes, mm */ web: number }

/** The fret for a border whose inside is hi from the centre (corner radius rcIn), holes moved in by delta. */
function fretAt(hi: number, rcIn: number, delta: number): Fret {
  const k = hi / D.hi, holes: Loop[] = [], kinds: Kind[] = [], dropped: Kind[] = [], seen = new Set<string>()
  let smallest = Infinity
  for (const b of baseHoles(k)) {
    if (b.half - delta < MIN_HOLE / 2) { dropped.push(b.kind); continue }
    const moved = Math.abs(delta) > 1e-9 ? offsetLoop(b.loop, delta) : b.loop
    if (signedArea(moved) >= 0) { dropped.push(b.kind); continue }
    const cl = clipHole(moved, hi, rcIn)
    const width = cl ? (4 * Math.abs(signedArea(cl))) / loopLength(cl) : 0
    if (!cl || width < MIN_HOLE) { dropped.push(b.kind); continue }
    smallest = Math.min(smallest, width)
    for (const [f, det] of D4) {
      const pts = cl.pts.map(v => ({ ...f(v), ...(v.b ? { b: v.b * det } : {}) }))
      const bb = bbox([{ closed: true, pts }]), key = `${Math.round((bb.minX + bb.maxX) * 50)},${Math.round((bb.minY + bb.maxY) * 50)}`
      if (seen.has(key)) continue
      seen.add(key)
      holes.push(oriented({ closed: true, pts }, 'hole'))
      kinds.push(b.kind)
    }
  }
  // the narrowest web, between holes whose boxes come within a few mm
  const polys = holes.map(h => ({ p: sample(h), b: bbox([h]) }))
  let web = Infinity
  for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) {
    const a = polys[i].b, c = polys[j].b, m = 6
    if (a.minX > c.maxX + m || c.minX > a.maxX + m || a.minY > c.maxY + m || c.minY > a.maxY + m) continue
    web = Math.min(web, polyGap(polys[i].p, polys[j].p))
  }
  return { holes, kinds, dropped: [...new Set(dropped)], smallest, web }
}

/** The fret with its narrowest web exactly `web` wide (the holes are moved in or out until it is). */
function fret(hi: number, rcIn: number, web: number): Fret & { delta: number } {
  let delta = (web - (D.web * hi) / D.hi) / 2
  let fr = fretAt(hi, rcIn, delta)
  for (let it = 0; it < 4 && Number.isFinite(fr.web) && fr.web < web - 0.01; it++) {
    delta += (web - fr.web) / 2 + 0.003
    fr = fretAt(hi, rcIn, delta)
  }
  return { ...fr, delta }
}

/** The coaster's own sizes: inside of the border, its corner radius, and the web (auto: the photo's proportion, never under 2 mm). */
function coasterGeom(S: number, R: number, border: number, web: number) {
  const hi = S / 2 - border
  const autoWeb = Math.max(2, (D.web * hi) / D.hi)
  return { hi, rcIn: Math.max(R - border, (D.rcIn / D.hi) * hi), web: web > 0 ? web : autoWeb, autoWeb }
}

// ------------------------------------------------------------------ the template

/** depth of the coaster's corner below the stand's top face, for a slot of length L (and back) */
function cornerWidth(depth: number, R: number) {
  const z0 = R * (1 - Math.SQRT1_2)
  return depth <= z0 ? 2 * Math.sqrt(Math.max(0, R * R - (R - depth) ** 2)) : Math.SQRT2 * R + 2 * (depth - z0)
}

const PARAMS: ParamDef[] = [
  mm('S', 'مقاس الكوستر', 70, 150, 'ضلع المربّع من الخارج'),
  mm('R', 'نصف قطر زاوية الكوستر', 3, 30),
  mm('border', 'عرض الإطار المصمت', 2, 10, 'حول النقشة؛ النقشة تكبر وتصغر لتملأ ما بداخله'),
  { ...mm('web', 'أرفع جسر في النقشة', 0, 6, '0 = تلقائي بنسبة الصورة (2.4 مم في كوستر 100 مم) ولا يقلّ عن 2 مم. الثقوب تكبر أو تصغر لتحقّقه'), step: 0.1 },
  { ...mm('tm', 'سماكة لوح الكوسترات', 0, 10, '0 = تُقصّ من اللوح نفسه. إن قصصتها من لوح آخر فأدخل سماكته المقيسة: شقوق الستاند وارتفاع العلبة عليها'), step: 0.1 },
  { key: 'nc', label: 'عدد الكوسترات', min: 2, max: 12, step: 1, int: true, hint: 'العلبة تتّسع لها فوق بعضها، والستاند فيه شقّ لكل واحد' },
  { key: 'holder', label: 'العلبة', min: 0, max: 1, step: 1, int: true, hint: '0 = الكوسترات وحدها' },
  { key: 'style', label: 'جدار العلبة', min: 1, max: 3, step: 1, int: true, options: ['مرن كلّه (كالصورة)', 'مرن عند الزوايا', 'ألواح مستقيمة'], hint: '1 = مرن على طوله كالصورة (أطول قصّاً)، 2 = مرن عند الزوايا فقط (الزوايا مستديرة، وقصّه نحو الثلث)، 3 = أربعة ألواح مستقيمة بتعشيق أصابع بلا مفصل (الأسرع، وزوايا العلبة قائمة)' },
  { key: 'stand', label: 'الغطاء / الستاند', min: 0, max: 1, step: 1, int: true, hint: 'غطاء بشقوق يقف فيها كل كوستر على زاويته فوق العلبة' },
  { ...mm('gap', 'خلوص الكوستر في فتحة العلبة', 0.5, 4), step: 0.1 },
  { ...mm('air', 'فراغ فوق الكوسترات', 0.5, 10, 'بين أعلى الكومة والغطاء'), step: 0.1 },
  mm('ow', 'عرض الفتحة الأمامية', 0, 80, 'فتحة في وسط الجدار الأمامي تُظهر الكومة ويُدفع منها الكوستر؛ 0 = بلا فتحة'),
  { ...mm('rim', 'بروز القاعدة والإطار', 2, 10, 'عن الجدار من الخارج'), step: 0.1 },
  mm('tab', 'عرض اللسان', 5, 20, 'ألسنة الجدار في القاعدة والإطار العلوي، اثنان في كل جانب'),
  { ...mm('fit', 'خلوص الشقوق', 0, 0.6, 'يُضاف لعرض كل شقّ وطوله'), step: 0.05 },
  mm('seg', 'طول قصّة المفصل', 3, 40), { ...mm('bridge', 'الجسر بين القصّات', 1, 5), step: 0.1 }, { ...mm('pitch', 'المسافة بين القصّات', 0.8, 4), step: 0.1 },
  { key: 'n', label: 'عدد الأطقم', min: 1, max: 10, step: 1, int: true },
]

const DEFAULTS = { S: 100, R: 14.5, border: 3.5, web: 0, tm: 0, nc: 6, holder: 1, style: 1, stand: 1, gap: 1, air: 1.5, ow: 36, rim: 3, tab: 10, fit: 0.2, seg: 8, bridge: 2, pitch: 1.5, n: 1 }

/** the narrowest a tab may be made on the short wall beside the opening */
const minTab = (t: number) => Math.max(5, 1.5 * t)

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = [], notes: string[] = []
  const t = c.t, { S, R, border, gap, air, rim, tab, fit, seg, bridge, pitch } = p
  const nc = Math.round(p.nc), n = Math.round(p.n), holder = Math.round(p.holder) > 0, stand = Math.round(p.stand) > 0
  const tc = p.tm > 0 ? p.tm : t, ow = Math.max(0, p.ow)

  // -------------------------------------------------------------- the coaster
  if (R > 0.3 * S) errors.push(`نصف قطر الزاوية كبير على كوستر ${S} مم: اجعله ${f1(Math.floor(0.3 * S * 2) / 2)} مم على الأكثر.`)
  if (p.web > 0 && p.web < 2) errors.push(`الجسور أرفع من 2 مم تنكسر أو تحترق: اجعل «أرفع جسر» 2 مم على الأقل، أو 0 ليُحسب تلقائياً.`)
  if (p.tm > 0 && p.tm < 2) errors.push(`لوح الكوسترات أرقّ من 2 مم لا يحمل النقشة: اجعل سماكته 2 مم على الأقل (أو 0 لتُقصّ من اللوح نفسه).`)
  const g = coasterGeom(S, R, border, p.web)
  const fr = fret(g.hi, g.rcIn, g.web)
  const major = fr.dropped.filter(kd => kd !== 'f' && kd !== 'g')
  const fits = (S2: number, w2: number, R2: number, b2: number) => {
    const g2 = coasterGeom(S2, R2, b2, w2), f2 = fret(g2.hi, g2.rcIn, g2.web)
    return f2.dropped.length === 0
  }
  if (fr.dropped.length) {
    // what would keep every hole: a bigger coaster, a narrower web, or a narrower border (each on its own)
    const hints: string[] = []
    let lo = S, hiS = 400
    if (fits(hiS, p.web, R, border)) {
      for (let i = 0; i < 14; i++) { const m = (lo + hiS) / 2; if (fits(m, p.web, R, border)) hiS = m; else lo = m }
      if (hiS <= 150) hints.push(`كبّر الكوستر إلى ${Math.ceil(hiS)} مم على الأقل`)
    }
    if (p.web > 0 && fits(S, 2, R, border)) {
      let a = 2, b = p.web
      for (let i = 0; i < 12; i++) { const m = (a + b) / 2; if (fits(S, m, R, border)) a = m; else b = m }
      hints.push(`اجعل «أرفع جسر» ${f1(Math.floor(a * 10) / 10)} مم على الأكثر`)
    }
    if (border > 2 && fits(S, p.web, R, 2)) {
      let a = 2, b = border
      for (let i = 0; i < 12; i++) { const m = (a + b) / 2; if (fits(S, p.web, R, m)) a = m; else b = m }
      hints.push(`اجعل الإطار ${f1(Math.floor(a * 10) / 10)} مم على الأكثر`)
    }
    if (R - border > (D.rcIn / D.hi) * g.hi && fits(S, p.web, Math.max(3, border), border)) {
      let a = 3, b = R
      for (let i = 0; i < 12; i++) { const m = (a + b) / 2; if (fits(S, p.web, m, border)) a = m; else b = m }
      hints.push(`اجعل نصف قطر الزاوية ${f1(Math.floor(a * 2) / 2)} مم على الأكثر`)
    }
    const how = hints.length ? hints.join('، أو ') : 'كبّر الكوستر أو صغّر الإطار والجسور'
    const what = [...new Set(fr.dropped.map(kd => KIND_NAME[kd]))].join(' و')
    if (major.length) errors.push(`النقشة لا تتّسع بهذه المقاسات: ${what} تصغر عن ${MIN_HOLE} مم ولا تُقصّ. ${how}.`)
    else warnings.push(`${what} أصغر من ${MIN_HOLE} مم فتُركت بلا قصّ، وزاوية الكوستر مصمتة. لتظهر كما في الصورة: ${how}.`)
  }
  if (Number.isFinite(fr.web) && fr.web < g.web - 0.05 && !errors.length) errors.push(`أرفع جسر في النقشة ${f1(fr.web)} مم فقط: كبّر الكوستر أو صغّر «أرفع جسر».`)
  if (g.web < 0.7 * tc) warnings.push(`الجسور (${f1(g.web)} مم) رفيعة على لوح ${tc} مم؛ الكوستر ينكسر بسهولة. اجعل «أرفع جسر» ${f1(Math.ceil(0.7 * tc * 10) / 10)} مم أو كبّر الكوستر.`)
  const cx = S / 2
  // an arc shorter than a millimetre (a sliver of the border's corner on a small hole) is cut straight: offset for the
  // kerf, so short an arc can turn inside out
  const coasterHoles = fr.holes.map(h => ({ ...h, pts: h.pts.map((v, i, a) => { const q = a[(i + 1) % a.length]; return { ...v, x: v.x + cx, y: v.y + cx, ...(v.b && Math.hypot(q.x - v.x, q.y - v.y) < 1 ? { b: 0 } : {}) } }) }))
  const roundAll = (w: number, h: number, r: number) => (loops: Loop[]) => { for (const [x, y] of [[0, 0], [w, 0], [w, h], [0, h]]) roundCorner(loops, x, y, r) }
  const panels: PanelSpec[] = [{
    id: 'coaster', name: p.tm > 0 && Math.abs(p.tm - t) > 1e-9 ? `كوستر بنقشة الزهرة (من لوح ${tc} مم)` : 'كوستر بنقشة الزهرة',
    w: S, h: S, count: nc * n, post: roundAll(S, S, R), holes: coasterHoles,
    note: `${fr.holes.length} ثقباً، إطار ${f1(border)} مم وأرفع جسر ${f1(g.web)} مم`,
  }]

  // -------------------------------------------------------------- the box: base, wall strip, top frame
  // inside the box the stack has `gap` round it at the frame's opening, and 2.5 mm more under the frame, so the frame
  // keeps 2.5 mm of wood between its tab slots and its opening
  const band = 2.5
  const Ci = S / 2 + gap + fit / 2 + band   // half the inside of the wall
  const Rc = R + (Ci - S / 2)               // its corner radius (round the coasters' corners)
  const Wm = Ci + t / 2, Rm = Rc + t / 2    // the wall's mid-surface
  const Po = round3(Ci + t + rim), Rp = round3(Rc + t + rim)
  const Fl = S - 2 * R                      // straight part of each side
  const Hc = round3(nc * tc + air)          // clear height inside
  const arc = (Math.PI / 2) * Rm
  const Ls = round3(4 * Fl + 4 * arc - ow)  // the wall strip, round the mid-surface less the opening
  const aF = (Fl - ow) / 2                  // the straight wall either side of the opening
  const tabF = round3(Math.min(tab, aF - 6)) // tabs there are narrowed to leave 3 mm each side
  // the wall: 1 bent all round (the photo), 2 bent at the corners only, 3 four flat boards with finger joints
  const wallKind = Math.min(3, Math.max(1, Math.round(p.style ?? 1))), flat = wallKind === 3
  const cornerOk = Fl >= 2 * tab + 12
  if (holder && flat) {
    // flat walls: square inside, the plates' corners only as round as still covers the square corner of the walls
    const leg = Ci - ow / 2
    if (ow > 0 && leg < minTab(t) + 6 + t) errors.push(`الفتحة الأمامية عريضة على الجدار الأمامي: اجعلها ${f1(Math.floor(2 * (Ci - minTab(t) - 6 - t)))} مم على الأكثر.`)
    if (Hc < 6) errors.push(`الجدران أقصر (${f1(Hc)} مم) من أن تتعشّق: زد «فراغ فوق الكوسترات» أو عدد الكوسترات.`)
    if (rim < 2 + fit / 2) errors.push(`البروز لا يترك خشباً كافياً خارج شقوق الألسنة: اجعله ${f1(2 + fit / 2)} مم على الأقل.`)
  }
  if (holder && !flat) {
    if (!cornerOk) errors.push(`الجانب المستقيم للعلبة (${f1(Fl)} مم) قصير على لسانين بعرض ${tab} مم: صغّر نصف قطر الزاوية إلى ${f1(Math.floor((S - 2 * tab - 12) / 2 * 2) / 2)} مم أو عرض اللسان إلى ${f1(Math.floor((Fl - 12) / 2))} مم.`)
    if (ow > 0 && tabF < minTab(t)) errors.push(`الفتحة الأمامية عريضة: لا يبقى بجانبها جدار يحمل لساناً. اجعلها ${f1(Math.floor(Fl - 2 * (minTab(t) + 6)))} مم على الأكثر.`)
    if (Rm < 2.5 * t) errors.push(`زوايا العلبة ضيّقة على انحناء المفصل (نصف قطر ${f1(Rm)} مم): اجعل نصف قطر زاوية الكوستر ${f1(Math.ceil((2.5 * t - (Rm - R)) * 2) / 2)} مم على الأقل.`)
    else if (Rm < 4 * t) warnings.push(`الجدار ينحني على نصف قطر ${f1(Rm)} مم فقط (أقلّ من 4 سماكات)؛ جرّب المفصل على قطعة صغيرة، أو كبّر نصف قطر الزاوية.`)
    if (Hc < 2 * bridge + 4) errors.push(`الجدار أقصر (${f1(Hc)} مم) من أن تُقصّ فيه قصّات المفصل: زد «فراغ فوق الكوسترات» إلى ${f1(Math.ceil((2 * bridge + 4 - nc * tc) * 10) / 10)} مم أو قلّل الجسر.`)
    if (rim < 2 + fit / 2) errors.push(`البروز لا يترك خشباً كافياً خارج شقوق الألسنة: اجعله ${f1(2 + fit / 2)} مم على الأقل.`)
    if (pitch - c.kerf < 1) warnings.push('قصّات المفصل متقاربة جداً: الشريحة بينها أرقّ من 1 مم وقد تحترق أو تنقطع.')
    if (bridge >= seg) warnings.push('الجسور أطول من قصّات المفصل؛ سيكون الجدار قاسياً عند الثني. قلّل الجسر أو أطل القصّة.')
  }
  // flat walls take the plates' corners in: round only as far as still covers the walls' square corner
  const Rq = flat ? round3(Math.min(Rp, 3 * rim)) : Rp
  // tab centres along the strip (from the opening's right edge round the right side, the back and the left side)
  const tabsU: { u: number; w: number }[] = []
  if (ow > 0) tabsU.push({ u: aF / 2, w: tabF })
  else tabsU.push({ u: Fl / 4 - 0, w: tab })
  const sideStart = (i: number) => aF + arc + i * (Fl + arc) // where side i (0 right, 1 back, 2 left) starts
  for (let i = 0; i < 3; i++) tabsU.push({ u: sideStart(i) + Fl / 4, w: tab }, { u: sideStart(i) + (3 * Fl) / 4, w: tab })
  tabsU.push({ u: Ls - tabsU[0].u, w: tabsU[0].w })
  if (ow === 0) { tabsU[0].u = aF - Fl / 4; tabsU[tabsU.length - 1].u = Ls - tabsU[0].u }
  // the same tabs as slots in the plates (plate coordinates, front at the bottom of the drawing)
  const slots = (o: number): Loop[] => {
    const sw = t + fit, out: Loop[] = []
    if (flat) {
      const fx = ow > 0 ? (Ci + ow / 2) / 2 : Ci / 2, fw = ow > 0 ? Math.min(tab, Ci - ow / 2 - 6 - t) : tab
      for (const sx of [-1, 1]) {
        out.push(rotatedRectHole(round3(o + sx * fx), round3(o + Wm), round3(fw + fit), round3(sw), 0))
        out.push(rotatedRectHole(round3(o + sx * Ci / 2), round3(o - Wm), round3(tab + fit), round3(sw), 0))
        for (const q of [-Ci / 2, Ci / 2]) out.push(rotatedRectHole(round3(o + sx * Wm), round3(o + q), round3(sw), round3(tab + fit), 0))
      }
      return out
    }
    const fx = ow > 0 ? (Fl / 2 + ow / 2) / 2 : Fl / 4
    for (const sx of [-1, 1]) {
      out.push(rotatedRectHole(round3(o + sx * fx), round3(o + Wm), round3(tabsU[0].w + fit), round3(sw), 0))
      for (const q of [-Fl / 4, Fl / 4]) out.push(rotatedRectHole(round3(o + sx * Wm), round3(o + q), round3(sw), round3(tab + fit), 0))
    }
    // the back wall's two, once
    for (const q of [-Fl / 4, Fl / 4]) out.push(rotatedRectHole(round3(o + q), round3(o - Wm), round3(tab + fit), round3(sw), 0))
    return out
  }
  if (holder && !errors.length && flat) {
    // four boards: back and front male at their ends, the sides female; tabs top and bottom into the base and the frame
    const Lw = round3(2 * (Ci + t)), H2 = round3(Hc + 2 * t), half = Lw / 2
    const rows = (tabs: { x: number; w: number }[]) => {
      const out: Rect[] = []
      for (const y of [0, Hc + t]) {
        let x = 0
        for (const tb of [...tabs].sort((a, b) => a.x - b.x)) { out.push(rect(x, y, tb.x - tb.w / 2 - x, t)); x = tb.x + tb.w / 2 }
        out.push(rect(x, y, Lw - x, t))
      }
      return out.filter(r => r.w > 1e-6)
    }
    const quarter = [{ x: half - Ci / 2, w: tab }, { x: half + Ci / 2, w: tab }]
    const fx = ow > 0 ? (Ci + ow / 2) / 2 : Ci / 2, fw = ow > 0 ? Math.min(tab, Ci - ow / 2 - 6 - t) : tab
    const frontTabs = [{ x: half - fx, w: fw }, { x: half + fx, w: fw }]
    const bTop = Math.max(6, 2 * t)
    const ends = (type: 'male' | 'female') => ({ left: { type, from: t, len: Hc }, right: { type, from: t, len: Hc } })
    panels.push(
      { id: 'base', name: 'العلبة — القاعدة', w: 2 * Po, h: 2 * Po, count: n, post: roundAll(2 * Po, 2 * Po, Rq), holes: slots(Po), note: 'شقوق ألسنة الجدران؛ الشقّان المتقاربان من جهة الفتحة الأمامية' },
      { id: 'wall-back', name: 'العلبة — الجدار الخلفي', w: Lw, h: H2, count: n, ...ends('male'), cuts: rows(quarter), note: 'أصابعه على طرفيه تدخل في الجانبين' },
      { id: 'wall-front', name: 'العلبة — الجدار الأمامي', w: Lw, h: H2, count: n, ...ends('male'), cuts: [...rows(frontTabs), ...(ow > 0 ? [rect(round3(half - ow / 2), round3(t + bTop), round3(ow), round3(Hc + t - bTop))] : [])], note: ow > 0 ? 'الفتحة من أسفله: تظهر منها الكومة ويُدفع منها الكوستر' : 'أصابعه على طرفيه تدخل في الجانبين' },
      { id: 'wall-side', name: 'العلبة — الجدار الجانبي', w: Lw, h: H2, count: 2 * n, ...ends('female'), cuts: rows(quarter), note: 'بين الأمامي والخلفي' },
      {
        id: 'ring', name: 'العلبة — الإطار العلوي', w: 2 * Po, h: 2 * Po, count: n, post: roundAll(2 * Po, 2 * Po, Rq),
        holes: [roundedRectHole(round3(Po - S / 2 - gap), round3(Po - S / 2 - gap), round3(S + 2 * gap), round3(S + 2 * gap), R + gap), ...slots(Po)],
        note: 'تسقط الكوسترات من فتحته',
      },
    )
    notes.push(`العلبة من الخارج ${f1(2 * Po)} × ${f1(2 * Po)} مم وارتفاعها ${f1(Hc + 2 * t)} مم؛ من الداخل ${f1(2 * Ci)} مم وارتفاع ${f1(Hc)} مم يتّسع لـ ${nc} كوسترات بسماكة ${tc} مم وفوقها ${f1(air)} مم.`)
    notes.push(`الجدار أربعة ألواح مستقيمة ${f1(Lw)} × ${f1(H2)} مم بتعشيق أصابع في الزوايا، بلا قصّات مفصل: قصّ العلبة أسرع بكثير من جدار الصورة المرن، وزواياها قائمة بين القاعدة والإطار المستديرين قليلاً.`)
  }
  if (holder && !errors.length && !flat) {
    const L2 = Ls > 380 ? round3(Ls / 2) : Ls, parts = Ls > 380 ? 2 : 1
    const H2 = round3(Hc + 2 * t)
    const myTabs = tabsU.filter(tb => tb.u < L2 + 1e-6)
    const stripCuts = (y: number) => {
      const out: Rect[] = []
      let x = 0
      for (const tb of myTabs) { out.push(rect(x, y, tb.u - tb.w / 2 - x, t)); x = tb.u + tb.w / 2 }
      out.push(rect(x, y, L2 - x, t))
      return out.filter(r => r.w > 1e-6)
    }
    const end = Math.max(4, 2 * pitch)
    const hinge = (x0: number, x1: number) => hingeLines(x0, t, x1, Hc + t, seg, bridge, pitch, 'y', { through: true, keepEdge: r => myTabs.some(tb => Math.abs(x0 + r - tb.u) < tb.w / 2 + bridge) })
    // kind 2: only where the wall bends round a corner (its arc and a little either side), straight runs left whole
    const bendZones = Array.from({ length: 4 }, (_, i) => [aF + i * (Fl + arc) - 2 * pitch, aF + i * (Fl + arc) + arc + 2 * pitch]).map(([a, b]) => [Math.max(end, a), Math.min(L2 - end, b)]).filter(([a, b]) => b - a > 2 * pitch)
    const open = wallKind === 2 ? bendZones.flatMap(([a, b]) => hinge(a, b)) : hinge(end, L2 - end)
    panels.push(
      { id: 'base', name: 'العلبة — القاعدة', w: 2 * Po, h: 2 * Po, count: n, post: roundAll(2 * Po, 2 * Po, Rq), holes: slots(Po), note: 'شقوق ألسنة الجدار؛ الفتحة الأمامية بين الشقّين القريبين من بعضهما' },
      {
        id: 'wall', name: parts > 1 ? 'العلبة — الجدار المرن (نصفان)' : 'العلبة — الجدار المرن', w: L2, h: H2, count: parts * n,
        cuts: [...stripCuts(0), ...stripCuts(Hc + t)], open,
        note: parts > 1 ? 'نصفان يلتقيان في منتصف الجدار الخلفي' : ow > 0 ? 'يلتفّ حول العلبة؛ طرفاه حدّا الفتحة الأمامية' : 'يلتفّ حول العلبة ويلتقي طرفاه في وسط الأمام',
      },
      {
        id: 'ring', name: 'العلبة — الإطار العلوي', w: 2 * Po, h: 2 * Po, count: n,
        cuts: ow > 0 ? [rect(round3(Po - ow / 2), round3(2 * Po - rim), round3(ow), round3(rim))] : [],
        post: roundAll(2 * Po, 2 * Po, Rp),
        holes: [roundedRectHole(round3(Po - S / 2 - gap), round3(Po - S / 2 - gap), round3(S + 2 * gap), round3(S + 2 * gap), R + gap), ...slots(Po)],
        note: 'تسقط الكوسترات من فتحته؛ التجويف فوق الفتحة الأمامية من الأمام',
      },
    )
    notes.push(`العلبة من الخارج ${f1(2 * Po)} × ${f1(2 * Po)} مم وارتفاعها ${f1(Hc + 2 * t)} مم؛ من الداخل ${f1(2 * Ci)} مم وارتفاع ${f1(Hc)} مم يتّسع لـ ${nc} كوسترات بسماكة ${tc} مم وفوقها ${f1(air)} مم.`)
    notes.push(`الجدار شريط واحد ${f1(Ls)} × ${f1(H2)} مم${parts > 1 ? ' (مقسوم نصفين لطوله)' : ''} ${wallKind === 2 ? 'بقصّات مفصل مرن عند الزوايا الأربع فقط (الأجزاء المستقيمة مصمتة): قصّه نحو ثلث جدار الصورة' : 'بقصّات مفصل مرن على طوله كما في الصورة'}، و${tabsU.length} ألسنة في كل حافّة.${ow > 0 ? ` يبدأ وينتهي عند الفتحة الأمامية (عرضها ${f1(ow)} مم) فلا يحتاج وصلة.` : ''}`)
  }

  // -------------------------------------------------------------- the lid that is also the stand
  if (stand) {
    const clr = Math.max(fit, 0.3)
    const U = S / 2 + gap - clr, Ur = Math.max(0, R + gap - clr)    // the plate under the lid, in the frame's opening
    const sw = round3(tc + fit)
    const zIn = 2 * t                                                 // the stand's two plates
    const want = 0.13 * S, dMax = zIn + Hc - 1.5, dMin = zIn + 1
    const depth = Math.min(want, dMax)
    if (dMax < dMin) errors.push(`العلبة قليلة الارتفاع: زاوية الكوستر الواقف تنزل تحت الغطاء ولا تجد مكاناً. زد «فراغ فوق الكوسترات» إلى ${f1(Math.ceil((dMin + 1.5 - zIn - nc * tc) * 10) / 10)} مم.`)
    const L = round3(cornerWidth(depth, R))
    const room = U - 3
    let pitchS = 0.15 * S, dx = 0.072 * S
    if (nc > 1) { pitchS = Math.min(pitchS, (2 * room - sw) / (nc - 1)); dx = Math.min(dx, (2 * room - L) / (nc - 1)) }
    if (pitchS - sw < 2.5) errors.push(`الستاند لا يتّسع لـ ${nc} شقوق بينها خشب كافٍ: قلّل عدد الكوسترات إلى ${Math.max(1, Math.floor((2 * room - sw) / (sw + 2.5)) + 1)} أو كبّر الكوستر.`)
    if (dx < 0) errors.push(`الشقّ (${f1(L)} مم) أطول من الستاند: صغّر نصف قطر الزاوية.`)
    const slotPos = Array.from({ length: nc }, (_, i) => ({ x: (i - (nc - 1) / 2) * dx, y: -(i - (nc - 1) / 2) * pitchS }))
    // every slot keeps 2.5 mm from the plate's rounded outline
    const sqU = roundedSquare(U - 2.5, Math.max(0, Ur - 2.5))
    if (!errors.length && slotPos.some(q => [[-1, -1], [1, -1], [1, 1], [-1, 1]].some(([a, b]) => !sqU.inside({ x: q.x + (a * L) / 2, y: q.y + (b * sw) / 2 }))))
      errors.push(`شقوق الستاند تقترب من زاوية اللوح: قلّل عدد الكوسترات إلى ${nc - 1} أو كبّر الكوستر.`)
    if (!errors.length) {
      const lidSlots = (o: number) => slotPos.map(q => rotatedRectHole(round3(o + q.x), round3(o + q.y), L, sw, 0))
      const Uw = round3(2 * U)
      panels.push(
        { id: 'lid', name: 'الغطاء / الستاند — اللوح العلوي', w: 2 * Po, h: 2 * Po, count: n, post: roundAll(2 * Po, 2 * Po, Rq), holes: lidSlots(Po), note: `${nc} شقوق بعرض ${sw} مم، كلّ شقّ مزاح عن الذي أمامه` },
        { id: 'lid-under', name: 'الغطاء / الستاند — اللوح السفلي', w: Uw, h: Uw, count: n, post: roundAll(Uw, Uw, Ur), holes: lidSlots(U), note: 'يُلصق تحت اللوح العلوي ويدخل في فتحة الإطار' },
      )
      notes.push(`الستاند: شقوق ${f1(L)} × ${sw} مم، بين كلّ شقّ والذي يليه ${f1(pitchS)} مم للخلف و${f1(dx)} مم للجانب. الكوستر يقف على زاويته فتنزل ${f1(depth)} مم تحت سطح الغطاء: تمرّ في اللوحين (${f1(zIn)} مم) وتتدلّى ${f1(depth - zIn)} مم داخل العلبة الفارغة (ارتفاعها ${f1(Hc)} مم) دون أن تلمس قاعها.`)
      if (!holder) warnings.push('الستاند يقف فوق العلبة: لوحه السفلي مقاسه على فتحة إطارها، وزوايا الكوسترات تتدلّى تحته داخلها. بلا علبة لن يستوي على الطاولة.')
    }
  }

  // -------------------------------------------------------------- notes
  notes.unshift(
    `${nc * n} كوستر ${S} × ${S} مم بزوايا نصف قطرها ${f1(R)} مم، بنقشة الزهرة كما في الصورة: ثماني بتلات تلتقي رؤوسها في الوسط، وبينها ثماني بتلات كبيرة، ثم زوج بتلات صغيرة أمام كل بتلة، ومثلّثات في الزوايا؛ إطار مصمت ${f1(border)} مم وأرفع جسر ${f1(g.web)} مم${p.web > 0 ? '' : ' (تلقائي بنسبة الصورة)'}.`,
  )
  if (holder && flat) notes.push(
    'تجميع العلبة: ركّب الجدران الأربعة بأصابعها (الأمامي والخلفي بين الجانبين، والفتحة إلى الأسفل)، ثم أدخل ألسنتها السفلية في شقوق القاعدة والعلوية في شقوق الإطار. نقطة غراء خشب في كل زاوية وكل لسان.',
  )
  else if (holder) notes.push(
    'تجميع العلبة: ابدأ بتليين الجدار: اثنه بيديك ببطء حول علبة أو زجاجة حتى يلين المفصل. ضع القاعدة والفتحة الأمامية أمامك، وأدخل ألسنة الحافّة السفلية للجدار في شقوقها بدءاً من أحد طرفي الفتحة ودُر به حول العلبة حتى الطرف الآخر، ثم ركّب الإطار العلوي فوق الألسنة العلوية وتجويفه فوق الفتحة. نقطة غراء خشب في كل لسان تكفي؛ أطراف الألسنة تظهر على الإطار كما في الصورة.',
  )
  if (stand) notes.push(
    'الغطاء: ألصق اللوح السفلي تحت العلوي متطابقَين في الشقوق (مرّر كوستراً في شقّين متباعدين حتى يجفّ الغراء). يوضع دائماً والشقوق للأعلى: لوحه السفلي يدخل في فتحة الإطار فيثبت مكانه.',
    'للعرض: أفرغ العلبة وضع الغطاء عليها، وأوقف كل كوستر على زاويته في شقّ (كالمعيّن)، فتصطفّ الكوسترات متدرّجة للخلف وللجانب كما في الصورة. للحفظ: كدّسها في العلبة من فتحة الإطار وأغلقها بالغطاء، وادفعها من الفتحة الأمامية لتأخذ واحداً.',
  )
  notes.push('اصبغ القطع قبل التجميع إن أردت لوناً داكناً كما في الصورة، ثم ادهن الكوسترات بورنيش أو زيت مقاوم للماء والحرارة.')
  if (p.tm > 0 && Math.abs(p.tm - t) > 1e-9) notes.push(`الكوسترات محسوبة على لوح ${tc} مم واللوح الأساسي ${t} مم: اقصّ قطع «كوستر» وحدها من لوحها (أطفئ الباقي في RDWorks)، وبقية القطع من اللوح الأساسي.`)
  return { panels, notes, warnings, errors, slotted: holder || stand }
}

export const COASTER_SETS: Template[] = [
  {
    id: 'coasterset',
    name: 'طقم كوسترات بنقشة الزهرة مع علبة وستاند',
    desc: 'كوسترات مربّعة مخرّمة بنقشة زهرة الداليا كما في الصورة تماماً، وعلبة بجدار مرن تُحفظ فيها فوق بعضها، وغطاء بشقوق متدرّجة يتحوّل إلى ستاند يقف فيه كل كوستر على زاويته.',
    icon: `<rect x="6" y="6" width="34" height="34" rx="6"/><path d="M23 23l-12-4 12 4-4-12 4 12 4-12-4 12 12-4-12 4 12 4-12-4 4 12-4-12-4 12 4-12-12 4z" stroke-width="1.5"/><path d="M30 46h28v12H30z"/><path d="M34 46l6-10M40 46l6-10M46 46l6-10" stroke-width="2"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build,
  },
]

COASTER_SETS.push({
  ...COASTER_SETS[0],
  id: 'coastersetfast',
  name: 'طقم كوسترات بنقشة الزهرة — علبة سريعة القصّ',
  desc: 'الطقم نفسه بالنقشة نفسها، وجدار العلبة يُقصّ في وقت أقصر بكثير: أربعة ألواح مستقيمة بتعشيق أصابع، أو جدار مرن عند الزوايا فقط (اختره من أزرار «جدار العلبة»).',
  icon: `<rect x="6" y="6" width="34" height="34" rx="6"/><path d="M23 23l-12-4 12 4-4-12 4 12 4-12-4 12 12-4-12 4 12 4-12-4 4 12-4-12-4 12 4-12-12 4z" stroke-width="1.5"/><path d="M30 44h28v14H30z"/><path d="M30 48h3v3h-3zM55 48h3v3h-3zM30 53h3v3h-3zM55 53h3v3h-3z" stroke-width="1.2"/>`,
  defaults: { ...DEFAULTS, style: 3 },
})

/** for tests and previews: the fret alone, and the numbers it was measured with */
export const DAHLIA = { D, fret, coasterGeom, clipHole, roundedSquare, cornerWidth }

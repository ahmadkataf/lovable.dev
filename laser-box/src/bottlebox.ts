// A box for small round bottles (perfume samples, essential oils) that stand leaning in a tilted plate.
//
// Inside a finger-jointed box (bottom, front, back, two sides) two parallel plates rise toward the back by `angle`.
// The upper one, the hole plate, holds every bottle in a round hole; the lower one, `sink` lower measured square to the
// plates, is the floor the bottles stand on. The bottles therefore stand square to the plates and lean toward the
// front by the same angle, their caps facing whoever opens the box, and the back rows stand higher than the front ones.
// Both plates span the inner width and hang on tabs through slots in the two sides (glued); their ends are cut square
// to the plate and stop half a millimetre short of the front and back walls. The tabs are not symmetric along the
// plate, so a plate goes in one way round only.
//
// Shapes: 1 a box with a lift-off lid (a plate with a lip frame glued under it, as the lipped box), 2 an open box,
// 3 a display stand whose sides follow the slope (low front wall, high back wall).
//
// Side view coordinates: X from the box's front face toward the back, Y up from the floor. A point is also (s, q):
// s along the plates (u = (cos a, sin a)), q square to them (n = (−sin a, cos a)); X = s·cos a − q·sin a,
// Y = s·sin a + q·cos a. Each plate's top face is a line q = c; both plates run over the same depth, so their
// lengths are the same and their ends are offset along s.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Rect, rect, circle, rotatedRectHole, engraveRect, simplify, round3 } from './geom'
import type { PanelSpec } from './joints'

type P2 = { x: number; y: number }

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', ...(hint ? { hint } : {}) })
const intP = (key: string, label: string, min: number, max: number, hint?: string, options?: string[]): ParamDef => ({ key, label, min, max, step: 1, int: true, ...(hint ? { hint } : {}), ...(options ? { options } : {}) })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
/** up to the field's half-millimetre step, with a hair of slack so 3 × 3.2 = 9.600000000000001 stays 9.6 */
const up5 = (v: number) => Math.ceil(v * 2 - 1e-6) / 2
const down5 = (v: number) => Math.floor(v * 2 + 1e-6) / 2
const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)))

/** How far each plate's end stops short of the front and back walls (mm). */
export const END_GAP = 0.5
/** Wood kept round every slot in the sides, to their joints and edges and to each other (mm, the rule is 2). */
const SLOT_WOOD = 2.2
/** Clearance between a bottle and a wall or the lid's lip frame (mm). */
const BOTTLE_CLEAR = 3

const PARAMS: ParamDef[] = [
  intP('num', 'عدد الغرشات', 1, 150, 'عدد الثقوب بالضبط'),
  mm('bd', 'قطر الغرشة', 8, 60, 'قِس أعرض مكان فيها (الغطاء أو البدن)'),
  mm('bh', 'طول الغرشة', 20, 200, 'من القاعدة إلى أعلى الغطاء'),
  mm('sink', 'عمق غوص الغرشة', 5, 100, 'من سطح اللوح المثقّب إلى لوح الارتكاز الذي تقف عليه؛ يظهر من الغرشة طولها ناقص هذا'),
  { key: 'angle', label: 'ميل الغرشات', min: 0, max: 40, step: 1, unit: '°', hint: 'اللوحان يرتفعان نحو الخلف والغرشات عمودية عليهما فتميل نحوك؛ 0 = واقفة' },
  intP('rows', 'عدد الصفوف', 0, 15, '0 = تلقائي: الترتيب الذي يجعل العلبة أقرب إلى المربّع. الصفوف الناقصة في الخلف وفي الوسط'),
  intP('style', 'ترتيب الثقوب', 1, 2, '1 = صفوف مستقيمة، 2 = صفوف متداخلة (كلّ صفّ مزاح نصف خطوة، أكثف)', ['صفوف مستقيمة', 'صفوف متداخلة']),
  mm('sp', 'الخشب بين الثقوب', 3, 30, 'بين حافّتي ثقبين متجاورين'),
  mm('margin', 'إطار الخشب حول الثقوب', 3, 40, 'بين الثقوب وحوافّ اللوح المثقّب'),
  { ...mm('hc', 'خلوص الثقب', 0.2, 3, 'قطر الثقب = قطر الغرشة + هذا (1 مم: تدخل بسهولة ولا تتأرجح)'), step: 0.1 },
  mm('H', 'ارتفاع العلبة', 0, 400, '0 = تلقائي: بالغطاء أخفض علبة تغطّي الغرشات، ومفتوحة جدران تحمل اللوحين فقط. من الخارج بلا الغطاء؛ للستاند ارتفاعه من الخلف'),
  intP('shape', 'الشكل', 1, 3, '1 = علبة بغطاء يُرفع، 2 = علبة مفتوحة، 3 = ستاند مائل: جانباه بميل الغرشات، واجهته واطئة وظهره عالٍ', ['علبة بغطاء', 'علبة مفتوحة', 'ستاند مائل']),
  mm('lipH', 'ارتفاع شفة الغطاء', 0, 40, '0 = تلقائي: ثلاث سماكات (8 مم على الأقل)'),
  { ...mm('gap', 'خلوص الغطاء', 0.2, 2, 'بين إطار الشفة والجدران من كل جهة'), step: 0.1 },
  mm('air', 'الفراغ فوق الغرشات', 0, 30, 'بين أعلى غرشة والغطاء'),
  { ...mm('fit', 'خلوص الشقوق', 0, 0.6, 'يُضاف لعرض شقوق الجانبين وطولها'), step: 0.05 },
  intP('n', 'عدد العلب', 1, 10),
]

const DEFAULTS = { num: 40, bd: 15, bh: 50, sink: 22, angle: 20, rows: 0, style: 1, sp: 5, margin: 10, hc: 1, H: 0, shape: 1, lipH: 0, gap: 0.5, air: 5, fit: 0.15, n: 1 }

/** The display version: no lid, so no lip, lid clearance or room over the bottles; a stand or an open box. */
const STAND_PARAMS: ParamDef[] = PARAMS.filter(d => !['lipH', 'gap', 'air'].includes(d.key)).map(d =>
  d.key === 'shape' ? intP('shape', 'الشكل', 1, 2, '1 = ستاند مائل: جانباه بميل الغرشات، واجهته واطئة وظهره عالٍ فتظهر كل الغرشات، 2 = علبة مفتوحة بجدران مستقيمة', ['ستاند مائل', 'علبة مفتوحة'])
    : d.key === 'H' ? mm('H', 'الارتفاع', 0, 400, '0 = تلقائي: أخفض ستاند (أو جدران) يحمل اللوحين. للستاند هذا ارتفاعه من الخلف، والواجهة أوطأ')
      : d)
const STAND_DEFAULTS = { num: 40, bd: 15, bh: 50, sink: 22, angle: 20, rows: 0, style: 1, sp: 5, margin: 10, hc: 1, H: 0, shape: 1, fit: 0.15, n: 1 }

/** One row of holes: its centre along the slope (s, on the plates' line coordinates), the holes across the width (from
 *  the plate's inner edge), and how many it holds when full. */
export interface Row { s: number; xs: number[]; full: number }

/**
 * How `num` holes fill `r` rows. 'straight': rows of c in line. 'alt': staggered rows of c and c − 1 in turn (the
 * short ones fall between the long ones, every row centred). 'shift': staggered rows of c, every other one shifted half
 * a pitch. Rows fill from the front; the last one may be short. Rows left empty are dropped — unless `exact` (the user
 * asked for r rows): then, when rows of c would leave some empty, the back rows hold c − 1 each so all r are used
 * (straight and 'shift' only; an 'alt' plan that cannot fill r rows is refused by the caller).
 */
type Kind = 'straight' | 'alt' | 'shift'
function fillRows(num: number, r: number, kind: Kind, exact = false): { cols: number; counts: number[]; full: number[] } {
  if (exact && kind !== 'alt' && Math.ceil(num / Math.ceil(num / r)) < Math.min(r, num)) {
    const c = Math.ceil(num / r), f = num - r * (c - 1)
    return { cols: c, counts: Array.from({ length: r }, (_, i) => (i < f ? c : c - 1)), full: Array.from({ length: r }, () => c) }
  }
  let cols: number
  if (kind === 'alt' && r > 1) {
    cols = 2
    while (Math.ceil(r / 2) * cols + Math.floor(r / 2) * (cols - 1) < num) cols++
  } else cols = Math.ceil(num / r)
  const counts: number[] = [], full: number[] = []
  let left = num
  for (let i = 0; i < r && left > 0; i++) {
    const m = kind === 'alt' && i % 2 === 1 ? cols - 1 : cols, k = Math.min(m, left)
    counts.push(k); full.push(m); left -= k
  }
  return { cols, counts, full }
}

/** Everything the pieces are sized on; shared by the build and the tests. */
export function bottleGeom(p: Record<string, number>, t: number) {
  const num = clampInt(p.num, 1, 1000), n = clampInt(p.n, 1, 100)
  const shape = clampInt(p.shape, 1, 3), style = clampInt(p.style, 1, 2), lid = shape === 1
  const deg = Math.min(45, Math.max(0, p.angle)), a = (deg * Math.PI) / 180, sa = Math.sin(a), ca = Math.cos(a)
  const { bd, bh, sink, margin, hc, fit, gap } = p
  const dh = round3(bd + hc), pitch = round3(dh + p.sp)
  const lipH = lid ? (p.lipH > 0 ? p.lipH : up5(Math.max(3 * t, 8))) : 0
  // the bottles keep 3 mm from the walls, and with the lid from the lip frame that hangs inside them
  const Xc = lid ? 2 * t + gap + BOTTLE_CLEAR : t + BOTTLE_CLEAR
  const mW = lid ? Math.max(margin, up5(t + gap + BOTTLE_CLEAR - hc / 2)) : margin
  // the tabs start mf from a plate's front end and stop mb from its back end, so each slot keeps its wood to the
  // front and back joints of the side; mb is longer so a plate turned round does not go in
  const mf = round3(Math.max(3, fit / 2 + (SLOT_WOOD - END_GAP + (fit / 2) * sa) / ca)), mb = round3(mf + 3)
  // the support plate's lowest corner, e above the bottom's inner face: its lowest slot keeps its wood to the bottom's joint
  const e = Math.max(END_GAP, SLOT_WOOD + (fit / 2) * ca - (mf - fit / 2) * sa)
  const cS = ca * (t + e + t * ca - ((t + END_GAP) * sa) / ca), cH = cS + sink
  const s0 = (c: number) => (t + END_GAP + c * sa) / ca
  // the first row: its hole keeps the margin from the plate's front end, and its bottles' tops (leaning forward) the
  // clearance from the front wall or lip
  const sFirst = Math.max(s0(cH) + margin + dh / 2, bd / 2 + (Xc + (cS + bh) * sa) / ca)

  const exact = p.rows >= 1
  const plan = (r0: number, kind: Kind) => {
    let r = r0, f = fillRows(num, r, kind, exact)
    for (let k = 0; k < 4 && f.counts.length < r; k++) { r = f.counts.length; f = fillRows(num, r, kind) }
    const R = f.counts.length, rs = kind === 'straight' ? pitch : (pitch * Math.sqrt(3)) / 2, sLast = sFirst + (R - 1) * rs
    const Dneed = Math.max(
      (sLast + dh / 2 + margin) * ca + t + END_GAP - (cH - t) * sa, // the hole plate's back margin
      (sLast + bd / 2 + 1) * ca + t + END_GAP - (cS - t) * sa,      // the last bottles stand wholly on the support plate
      (sLast + bd / 2) * ca - cS * sa + Xc,                         // and their feet clear the back wall
    )
    const shifted = kind === 'shift' && R > 1
    const W = up5((f.cols - (shifted ? 0.5 : 1)) * pitch + dh + 2 * mW + 2 * t), D = up5(Dneed)
    const last = R - 1
    // closest to square, and a short last row only when it is worth it
    // (the rows the user asked for, when this kind cannot give them all, never win)
    const score = exact && R < Math.min(r0, num) ? Infinity : Math.abs(Math.log((W - 2 * t) / (D - 2 * t))) + (0.3 * (f.full[last] - f.counts[last])) / f.full[last]
    return { ...f, kind: (R > 1 ? kind : 'straight') as Kind, R, rs, sLast, W, D, score }
  }
  const kinds: Kind[] = style === 2 ? ['alt', 'shift'] : ['straight']
  const tries = p.rows >= 1 ? [Math.min(15, Math.round(p.rows))] : Array.from({ length: Math.min(15, num) }, (_, i) => i + 1)
  let best: ReturnType<typeof plan> | undefined
  for (const r of tries) for (const kind of kinds) { const q = plan(r, kind); if (!best || q.score < best.score - 1e-9) best = q }
  const { W, D, R, rs, sLast, cols, counts, full, kind } = best!
  const Wi = round3(W - 2 * t), Di = round3(D - 2 * t)
  const rows: Row[] = counts.map((k, i) => {
    const m = full[i], dx = kind === 'shift' ? (i % 2 ? pitch / 4 : -pitch / 4) : 0
    // a short row: straight rows are a pitch apart, so it is centred exactly (half a pitch sideways is still clear of the
    // row before); staggered rows keep to their own lattice, on the side that puts the row nearer the middle
    const lo = Math.floor((m - k) / 2), hi = Math.ceil((m - k) / 2), off = (q: number) => Math.abs(((2 * q + k - m) / 2) * pitch + dx)
    const o = kind === 'straight' ? (m - k) / 2 : off(hi) < off(lo) - 1e-9 ? hi : lo
    return { s: sFirst + i * rs, full: m, xs: Array.from({ length: k }, (_, j) => round3(Wi / 2 + dx + (o + j - (m - 1) / 2) * pitch)) }
  })
  const s1 = (c: number) => (D - t - END_GAP + (c - t) * sa) / ca
  const L = round3((D - 2 * t - 2 * END_GAP - t * sa) / ca)
  const Yplate = s1(cH) * sa + cH * ca                       // the hole plate's highest corner (back end, top face)
  const Ytop = (sLast + bd / 2) * sa + (cS + bh) * ca         // the highest bottle cap
  // the lowest box: with the lid, over the caps by `air` and the lip clear of the hole plate; open, over the plate by
  // 3 mm; the stand's sides run parallel to the plates 3 mm over the hole plate, H measured at the back wall
  const qTop0 = cH + 3
  const Hmin = round3(shape === 1 ? Math.max(Ytop + p.air, Yplate + lipH + 1) : shape === 2 ? Yplate + 3 : (qTop0 + (D - t) * sa) / ca)
  const H = p.H > 0 ? p.H : up5(Hmin)
  const Hf = shape === 3 ? round3(H - (D - 2 * t) * (sa / ca)) : H
  return { num, n, shape, style, kind, lid, deg, a, sa, ca, dh, pitch, rs, lipH, Xc, mW, mf, mb, e, cS, cH, s0, s1, sFirst, sLast, R, cols, rows, W, D, Wi, Di, L, Yplate, Ytop, Hmin, H, Hf }
}

export type BottleGeom = ReturnType<typeof bottleGeom>

/** The tab runs [from, to] along a plate of length L, measured from its front end. */
export function tabRuns(L: number, mf: number, mb: number): [number, number][] {
  const room = L - mf - mb
  let k = room >= 100 ? 3 : 2, tl = room / (2 * k - 1)
  if (tl < 5) { k = 1; tl = room }
  if (tl < 3) return []
  return Array.from({ length: k }, (_, i) => [round3(mf + 2 * i * tl), round3(mf + (2 * i + 1) * tl)] as [number, number])
}

/** A point (s, q) of the slope in side-view coordinates. */
export const sq = (g: { sa: number; ca: number }, s: number, q: number): P2 => ({ x: s * g.ca - q * g.sa, y: s * g.sa + q * g.ca })

/** A rectangle of the slope, s0…s1 by q0…q1, in side-view coordinates. */
export const sqBox = (g: { sa: number; ca: number }, s0: number, s1: number, q0: number, q1: number): P2[] => [sq(g, s0, q0), sq(g, s1, q0), sq(g, s1, q1), sq(g, s0, q1)]

// ------------------------------------------------------------------ words

const countWord = (k: number, one: string, two: string, few: string, many: string) => (k === 1 ? one : k === 2 ? two : k <= 10 ? `${k} ${few}` : `${k} ${many}`)
const rowsWord = (k: number) => countWord(k, 'صفّ واحد', 'صفّان', 'صفوف', 'صفّاً')
const holesWord = (k: number) => countWord(k, 'ثقب واحد', 'ثقبان', 'ثقوب', 'ثقباً')
const bottlesWord = (k: number) => countWord(k, 'غرشة واحدة', 'غرشتين', 'غرشات', 'غرشة')
/** the pronoun after a count: «ثقب واحد قطرُه», «ثقبان قطرُهما», «40 ثقباً قطرُها» */
const its = (k: number, fem: boolean) => (k === 1 ? (fem ? 'ها' : 'ه') : k === 2 ? 'هما' : 'ها')

/** «6 صفوف × 7، الصفّ الأخير 5» */
export function layoutText(g: BottleGeom): string {
  const last = g.rows[g.rows.length - 1], nShort = g.rows.filter(r => r.xs.length < r.full).length
  if (g.R === 1) return `${rowsWord(1)} من ${holesWord(last.xs.length)}`
  // the short rows are the last ones (one, or several of c − 1 when the rows asked for need them)
  const tail = nShort === 1 ? `، الصفّ الأخير ${last.xs.length}` : nShort > 1 ? `، وفي كلّ صفّ من آخر ${nShort === 2 ? 'صفّين' : rowsWord(nShort)} ${last.xs.length}` : ''
  if (g.kind === 'alt') return `${rowsWord(g.R)} متداخلة، ${g.cols} و${g.cols - 1} بالتناوب${tail}`
  if (g.kind === 'shift') return `${rowsWord(g.R)} متداخلة × ${g.cols}، كلّ صفّ مزاح نصف خطوة عن الذي قبله${tail}`
  return `${rowsWord(g.R)} × ${g.cols}${tail}`
}

// ------------------------------------------------------------------ the build

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = [], notes: string[] = []
  const t = c.t, fit = p.fit, gap = p.gap
  const g = bottleGeom(p, t)
  const { n, shape, lid, lipH, W, D, Wi, L, H, Hf, cS, cH } = g
  const lt = (v: number, min: number) => v < min - 1e-9

  // -------------------------------------------------------------- checks
  if (c.kerf > t / 2) warnings.push('عرض الشق (kerf) كبير بشكل غير معتاد.')
  if (g.deg > 45) errors.push('الميل حادّ جداً على العلبة: اجعله 45° على الأكثر.')
  const sinkMin = up5(Math.max(5, t + fit + 2)), sinkMax = down5(p.bh - 5)
  if (lt(p.sink, sinkMin)) errors.push(`عمق الغوص (${f1(p.sink)} مم) قليل: يلزم ${f1(sinkMin)} مم على الأقل ليبقى بين شقوق اللوحين في الجانب خشب 2 مم.`)
  else if (p.sink > sinkMax + 1e-9) errors.push(`عمق الغوص (${f1(p.sink)} مم) أكبر من طول الغرشة ناقص 5 مم فلا يظهر منها شيء يُمسك: اجعله ${f1(sinkMax)} مم على الأكثر.`)
  if (lid && p.lipH > 0 && lt(p.lipH, 3 * t)) errors.push(`ارتفاع الشفة (${f1(p.lipH)} مم) صغير جداً: يلزم ${f1(up5(3 * t))} مم على الأقل لتعشيق زوايا الإطار (أو 0 ليُحسب تلقائياً).`)
  if (p.H > 0 && lt(p.H, g.Hmin)) {
    const why = shape === 1 ? 'ليبقى الغطاء فوق الغرشات وشفته فوق اللوح المثقّب' : shape === 2 ? 'لتحمل الجدران اللوحين المائلين' : 'ليرتفع الستاند من الخلف فوق اللوح المثقّب'
    errors.push(`الارتفاع (${f1(p.H)} مم) قليل: يلزم ${f1(up5(g.Hmin))} مم على الأقل ${why} (أو 0 ليُحسب تلقائياً).`)
  }
  const runs = tabRuns(L, g.mf, g.mb)
  if (!runs.length) errors.push('اللوحان قصيران على ألسنتهما: كبّر قطر الغرشة أو الإطار حول الثقوب.')
  if (Math.max(W, D) > 600) warnings.push(`القاعدة ${f1(W)} × ${f1(D)} مم قطعة واحدة: تأكّد أنّ لوحك وسرير آلتك يتّسعان لها، أو قلّل عدد الغرشات.`)
  if (!errors.length && p.sink < 0.2 * p.bh) warnings.push(`الغرشة تغوص ${f1(p.sink)} مم فقط من طولها ${f1(p.bh)} مم وقد تتأرجح؛ الأنسب نحو ثلثه (${f1(up5(p.bh / 3))} مم).`)

  // -------------------------------------------------------------- the sides: slots for both plates' tabs
  const Hp = H // the side's height (for the stand, at the back wall)
  const slots = (cTop: number): Loop[] => runs.map(([u0, u1]) => {
    const m = sq(g, g.s0(cTop) + (u0 + u1) / 2, cTop - t / 2)
    return rotatedRectHole(round3(m.x), round3(Hp - m.y), round3(u1 - u0 + fit), round3(t + fit), -g.a)
  })
  const sideHoles = [...slots(cH), ...slots(cS)]
  const yf = round3(H - Hf)
  const side: PanelSpec = shape === 3
    ? {
      id: 'side', name: 'الجانب', w: D, h: Hp, count: 2 * n, bottom: 'female', right: 'female', left: { type: 'female', from: yf, len: Hf },
      cuts: [rect(0, 0, t, yf)], holes: sideHoles,
      // the top runs parallel to the plates, from the front wall's top to the back wall's top (both inner faces)
      post: loops => {
        const o = loops[0], k = o.pts.findIndex(v => Math.abs(v.x - t) < 1e-6 && Math.abs(v.y) < 1e-6)
        if (k >= 0) { o.pts[k] = { x: t, y: yf }; o.pts = simplify(o.pts) }
      },
      note: 'اثنان متماثلان: اقلب أحدهما. الشقوق العليا للوح المثقّب والسفلى للوح الارتكاز',
    }
    : { id: 'side', name: 'الجانب', w: D, h: Hp, count: 2 * n, bottom: 'female', left: 'female', right: 'female', holes: sideHoles, note: 'اثنان متماثلان: اقلب أحدهما. الشقوق العليا للوح المثقّب والسفلى للوح الارتكاز' }

  // -------------------------------------------------------------- the two plates: tabs at both side edges
  const plateCuts = (): Rect[] => {
    const out: Rect[] = []
    for (const x of [0, round3(Wi + t)]) {
      let y0 = 0
      for (const [u0, u1] of runs) { out.push(rect(x, y0, t, round3(u0 - y0))); y0 = u1 }
      out.push(rect(x, y0, t, round3(L - y0)))
    }
    return out.filter(r => r.h > 1e-6)
  }
  const s0H = g.s0(cH), r = g.dh / 2
  const holes: Loop[] = []
  for (const row of g.rows) for (const x of row.xs) holes.push(circle(round3(t + x), round3(row.s - s0H), r))
  const panels: PanelSpec[] = [
    { id: 'bottom', name: 'القاعدة', w: W, h: D, top: 'male', right: 'male', bottom: 'male', left: 'male', count: n },
    { id: 'front', name: 'الواجهة الأمامية', w: W, h: Hf, bottom: 'female', left: 'male', right: 'male', count: n, ...(shape === 3 ? { note: 'واطئة: ظهر الستاند أعلى منها' } : {}) },
    { id: 'back', name: 'الواجهة الخلفية', w: W, h: H, bottom: 'female', left: 'male', right: 'male', count: n },
    side,
    { id: 'holes', name: 'اللوح المثقّب', w: round3(Wi + 2 * t), h: L, cuts: plateCuts(), holes, count: n, note: `${holesWord(g.num)} قطر${its(g.num, false)} ${f1(g.dh)} مم؛ الحافّة الأقرب إلى الألسنة إلى الأمام` },
    { id: 'floor', name: 'لوح الارتكاز', w: round3(Wi + 2 * t), h: L, cuts: plateCuts(), count: n, note: 'تقف عليه الغرشات؛ الحافّة الأقرب إلى الألسنة إلى الأمام' },
  ]
  const Wl = round3(W - 2 * t - 2 * gap), Dl = round3(D - 2 * t - 2 * gap)
  if (lid) panels.push(
    { id: 'lid', name: 'الغطاء — اللوح', w: W, h: D, count: n, engrave: [engraveRect(t + gap, t + gap, Wl, Dl)], note: 'الخط المحفور يحدّد موضع إطار الشفة على وجهه السفلي' },
    { id: 'lip-fb', name: 'الغطاء — شفة الأمام / الخلف', w: Wl, h: lipH, left: 'male', right: 'male', count: 2 * n },
    { id: 'lip-side', name: 'الغطاء — شفة الجانب', w: Dl, h: lipH, left: 'female', right: 'female', count: 2 * n },
  )

  // -------------------------------------------------------------- the side view (x forward from the back face, y up)
  const fwd = (ps: P2[]) => ps.map(q => ({ x: round3(D - q.x), y: round3(q.y) }))
  const box = (x0: number, y0: number, x1: number, y1: number): P2[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]
  const outline: P2[] = shape === 3 ? [{ x: 0, y: 0 }, { x: D, y: 0 }, { x: D, y: H }, { x: D - t, y: H }, { x: t, y: Hf }, { x: 0, y: Hf }] : box(0, 0, D, H)
  const pieces: { id: string; pts: P2[] }[] = [
    { id: 'bottom', pts: box(t, 0, D - t, t) },
    { id: 'front', pts: box(0, 0, t, Hf) },
    { id: 'back', pts: box(D - t, 0, D, H) },
    { id: 'holes', pts: sqBox(g, g.s0(cH), g.s1(cH), cH - t, cH) },
    { id: 'floor', pts: sqBox(g, g.s0(cS), g.s1(cS), cS - t, cS) },
    ...g.rows.map(row => ({ id: 'bottle', pts: sqBox(g, row.s - p.bd / 2, row.s + p.bd / 2, cS, cS + p.bh) })),
  ]
  if (lid) pieces.push(
    { id: 'lid', pts: box(0, H, D, H + t) },
    { id: 'lip-front', pts: box(t + gap, H - lipH, 2 * t + gap, H) },
    { id: 'lip-back', pts: box(D - 2 * t - gap, H - lipH, D - t - gap, H) },
  )

  // -------------------------------------------------------------- notes
  const shows = round3(p.bh - p.sink)
  notes.push(
    shape === 1 ? `علبة ${bottlesWord(g.num)} قطر${its(g.num, true)} ${f1(p.bd)} مم وطول${its(g.num, true)} ${f1(p.bh)} مم: من الخارج ${f1(W)} × ${f1(D)} مم، وارتفاعها ${f1(H)} مم بلا الغطاء و${f1(H + t)} مم معه.`
      : shape === 2 ? `علبة مفتوحة ${bottlesWord(g.num)} قطر${its(g.num, true)} ${f1(p.bd)} مم وطول${its(g.num, true)} ${f1(p.bh)} مم: من الخارج ${f1(W)} × ${f1(D)} × ${f1(H)} مم؛ الغرشات تبرز فوق الجدران.`
        : `ستاند مائل ${bottlesWord(g.num)} قطر${its(g.num, true)} ${f1(p.bd)} مم وطول${its(g.num, true)} ${f1(p.bh)} مم: ${f1(W)} × ${f1(D)} مم، ارتفاعه ${f1(H)} مم من الخلف و${f1(Hf)} مم من الأمام، وجانباه بميل اللوحين.`,
    `اللوح المثقّب: ${holesWord(g.num)} قطر${its(g.num, false)} ${f1(g.dh)} مم (قطر الغرشة + خلوص ${f1(p.hc)} مم)، ${layoutText(g)}، بين الثقب والثقب ${f1(p.sp)} مم خشب وحول${its(g.num, false)} إطار ${f1(p.margin)} مم على الأقل.`,
    g.deg > 0
      ? `الميل ${f1(g.deg)}°: اللوحان يرتفعان نحو الخلف والغرشات عمودية عليهما فتميل نحو الأمام وتظهر أغطيتها ${lid ? 'لمن يفتح العلبة' : 'لمن يقف أمامها'}، والصفوف الخلفية أعلى من الأمامية. تغوص كلّ غرشة ${f1(p.sink)} مم تحت سطح اللوح المثقّب وتقف على لوح الارتكاز، ويظهر منها ${f1(shows)} مم.`
      : `بلا ميل: اللوحان أفقيّان والغرشات واقفة. تغوص كلّ غرشة ${f1(p.sink)} مم تحت سطح اللوح المثقّب وتقف على لوح الارتكاز، ويظهر منها ${f1(shows)} مم.`,
    `اللوحان ${f1(Wi)} × ${f1(L)} مم (مع ألسنة ${t} مم من كل جانب)، بينهما ${f1(p.sink - t)} مم، وطرفاهما مقصوصان عمودياً عليهما ويقفان على نصف مم من الواجهتين. ألسنتهما ليست متناظرة فيدخل كلّ لوح باتجاه واحد فقط: الحافّة الأقرب إلى الألسنة إلى الأمام.`,
    `التجميع: ضع جانباً على الطاولة ووجهه الداخلي للأعلى، وأدخل فيه ألسنة اللوحين: المثقّب في الشقوق العليا ولوح الارتكاز في السفلى. أنزل الجانب الثاني (مقلوباً) فوق الألسنة، ثم ركّب القاعدة والواجهتين بالأصابع. غراء خشب في كل شقّ وعلى خطوط التعشيق، وتأكّد من تربيع العلبة قبل أن يجفّ.`,
  )
  if (lid) notes.push(`الغطاء: ألصق إطار الشفة (شريحتان ${f1(Wl)} × ${f1(lipH)} مم بأصابع ذكر وشريحتان ${f1(Dl)} × ${f1(lipH)} مم بأصابع أنثى، تتعشّق في الزوايا) تحت اللوح داخل الخط المحفور. ينزل الإطار داخل الجدران بخلوص ${f1(gap)} مم من كل جهة فلا ينزلق الغطاء، ويبقى بين أعلى غرشة والغطاء ${f1(H - g.Ytop)} مم.`)
  if (g.mW > p.margin + 1e-9) notes.push(`الإطار حول الثقوب على الجانبين ${f1(g.mW)} مم (لا ${f1(p.margin)}) لتبقى الغرشات بعيدة 3 مم عن شفة الغطاء.`)
  notes.push(`الخشب: بلاي أو MDF ${t} مم؛ في الأكريليك الصق بالغراء السائل. ${n > 1 ? `الملف يكفي ${n} علب.` : ''}`.trim())

  return { panels, notes, warnings, errors, slotted: true, sideView: { outline: fwd(outline), pieces: pieces.map(pc => ({ id: pc.id, pts: fwd(pc.pts) })) } }
}

export const BOTTLE_BOXES: Template[] = [
  {
    id: 'bottlebox',
    name: 'علبة غرشات مائلة',
    desc: 'علبة بتعشيق أصابع لغرشات (قوارير) دائرية صغيرة، عيّنات عطور أو زيوت عطرية: بداخلها لوح مثقّب مائل تدخل فيه الغرشات ولوح تحته تقف عليه، فتميل الغرشات معه وتظهر أغطيتها من الأمام. بعدد الغرشات تماماً، صفوف مستقيمة أو متداخلة، ومقاسها يُحسب ليقرب من المربّع؛ بغطاء بإطار شفة، أو مفتوحة، أو ستاند مائل.',
    icon: `<path d="M6 58h52V22H6z"/><path d="M4 16h56v6H4z"/><path d="M8 52l48-14" stroke-width="2.4"/><path d="M15 50l-4-14M25 47l-4-14M35 44l-4-14M45 41l-4-14" stroke-width="5" stroke-linecap="round"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build,
  },
  {
    id: 'bottlestand',
    name: 'ستاند غرشات للعرض (بلا غطاء)',
    desc: 'نسخة العرض المكشوفة من علبة الغرشات المائلة، بلا غطاء لتُعرض في المحل: ستاند جانباه بميل الغرشات وواجهته واطئة وظهره عالٍ فتظهر كل الغرشات (قوارير، عيّنات عطور أو زيوت)، أو علبة مفتوحة بجدران مستقيمة. لوح مثقّب مائل ولوح تحته تقف عليه الغرشات، بعدد الغرشات تماماً.',
    icon: `<path d="M6 58h52V18L58 18 6 44z"/><path d="M8 52l48-14" stroke-width="2.4"/><path d="M15 50l-4-14M25 47l-4-14M35 44l-4-14M45 41l-4-14" stroke-width="5" stroke-linecap="round"/>`,
    params: STAND_PARAMS,
    defaults: STAND_DEFAULTS,
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    // the lidded box's build, as a stand (shape 3) or an open box (shape 2), never with the lid
    build: (p, c) => build({ ...DEFAULTS, ...p, lipH: 0, gap: DEFAULTS.gap, air: DEFAULTS.air, shape: Math.round(p.shape) === 2 ? 2 : 3 }, c),
  },
]

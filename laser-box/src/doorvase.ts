// A classic door skin with a laser-engraved line drawing, traced from the customer's photo ('doorvase'): an outer
// rectangle; a tall top panel with a curved bottom holding a vase on a turned stem with a bouquet (two six-petal flowers
// and buds), long leaves curling down both sides, a heart-shaped loop between two lilies on scrolling stems, C-scrolls
// and acanthus at the foot and a drop leaf; a narrow curved band; a lower panel with an acanthus ornament. Every line
// is one laser pass (vector scoring) on the engraving layer; the door panel's outline is the red alignment frame.
//
// How the drawing was measured (the photo: 780 × 1040 px, the left door skin about 300 px wide):
// - the outer engraved rectangle's sides were located to sub-pixel accuracy (edge positions fitted along each side)
//   and the photo was warped onto a straight rectangle (a perspective transform plus a smooth correction for the
//   slightly bowed skin, which leaves the four sides straight to about 0.2 px);
// - its proportions: a pinhole camera with a gently bent panel, fitted to the four sides, gives height / width 2.64
//   whatever the focal length (the photo is taken almost square on); 2.65 was used. As a check, the margins between the
//   outer rectangle and the panels (54 units across, 58 down, on a frame 1000 wide) and the spacing of the double lines
//   (18 across, 17.7–19 down) come out nearly the same both ways, as such lines are drawn;
// - the drawing is mirror-symmetric: the rectified photo was averaged with its mirror image about the centre line
//   (found to 0.5 px), the lines extracted (background flattening, black-hat filter, hysteresis threshold, wood grain
//   streaks removed), skeletonised and turned into polylines, broken strokes merged, spurs dropped, the strokes snapped
//   to the centre of the photo's line and fitted with smoothing splines that keep the sharp tips; the left half was
//   traced and mirrored. Every stroke was then checked over the photo, zoomed region by region, and corrected by hand
//   where the photo shows more (junctions, slivers where two lines run into one tip, faint tails): on a 590 mm drawing
//   the traced lines lie on the middle of the photo's lines to 0.3 mm on average, 95% within 1 mm and all within
//   2.2 mm, where a line shows about 4 mm wide in the photo;
// - the structural lines were rebuilt as clean geometry fitted to the trace: straight lines, and circular arcs (the
//   top panel's bottom and the band's top concentric, the band's bottom and the lower panel's top concentric).
//
// At another size the structure is rebuilt for DW × DH: line spacings, margins and the arcs' radii scale with the width
// (so the arcs keep their sag), the band stays at the same fraction of the height, and the panels take up the rest.
// Each ornament is scaled uniformly (never stretched) to fit its panel as in the photo, centred across, and any height
// it does not need is shared equally above and below it.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Vtx, round3, loopLength } from './geom'
import { REF_W, REF_H, REF, TOP, LOW, Stroke } from './doorvase-art'

type P2 = { x: number; y: number }
type Arc = readonly [number, number]

const mm = (key: string, label: string, min: number, max: number, hint?: string): ParamDef => ({ key, label, min, max, step: 0.5, unit: 'مم', ...(hint ? { hint } : {}) })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()

/** the drawing keeps this much of the panel all round */
export const EDGE = 10
/** narrower than this the ornament's finest gaps (under a millimetre) would close up */
export const MIN_DW = 250
/** height / width of the drawing: the photo's is 2.65 */
export const ASPECT: readonly [number, number] = [2, 3.6]
/** the band's middle (between the top panel's bottom and the lower panel's top) as a fraction of the drawing's height */
const BAND_Y = (REF.topOutBot[0] + REF.lowOutTop[0]) / 2
const BAND = BAND_Y / REF_H

// ------------------------------------------------------------------ the ornaments, mirrored once

/** Each stroke of a group as a whole polyline in the reference frame: the left half and its mirror image. */
function expand(group: Stroke[]): { pts: Float64Array; closed: boolean }[] {
  const out: { pts: Float64Array; closed: boolean }[] = []
  const mir = (p: number[]) => { const q: number[] = []; for (let i = p.length - 2; i >= 0; i -= 2) q.push(REF_W - p[i], p[i + 1]); return q }
  for (const s of group) {
    if (s.k === 'c') { out.push({ pts: Float64Array.from(s.p), closed: false }); continue }
    if (s.k === 'p') { out.push({ pts: Float64Array.from(s.p), closed: !!s.closed }, { pts: Float64Array.from(mir(s.p)), closed: !!s.closed }); continue }
    // across the axis: the left half ends on the axis, the right half is its mirror (the shared axis point once);
    // a closed one starts on the axis too, and the loop closes there
    const m = mir(s.p).slice(2)
    out.push({ pts: Float64Array.from([...s.p, ...(s.closed ? m.slice(0, -2) : m)]), closed: !!s.closed })
  }
  return out
}
let ART: { top: ReturnType<typeof expand>; low: ReturnType<typeof expand> } | null = null
/** the ornaments in the reference frame (worked out once) */
export function art() {
  if (!ART) ART = { top: expand(TOP), low: expand(LOW) }
  return ART
}

// ------------------------------------------------------------------ the layout

/** Bulge of the arc from p to q through m (b > 0 bows to the right of p → q on screen, as in geom.ts). */
function bulgeThrough(p: P2, q: P2, m: P2): number {
  const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy)
  const s = ((m.x - (p.x + q.x) / 2) * -dy + (m.y - (p.y + q.y) / 2) * dx) / L
  return (2 * s) / L
}

export interface DoorLayout {
  /** mm per reference mm for the line work */
  g: number
  /** the structural lines (closed), the drawing's top-left corner at the origin */
  frame: Loop[]
  /** each ornament: its scale and where the reference frame's point (x, y) lands: (DW / 2 + (x − REF_W / 2)·s, y0 + (y − ref)·s) */
  top: { s: number; y0: number; ref: number }
  low: { s: number; y0: number; ref: number }
}

/** The structure of a DW × DH drawing and where its ornaments go (no checks: see errorsOf). */
export function layout(DW: number, DH: number): DoorLayout {
  const g = DW / REF_W, cx = DW / 2
  const Y = (yRef: number) => BAND * DH + (yRef - BAND_Y) * g
  const arc = (a: Arc) => ({ ya: Y(a[0]), R: a[1] * g })
  const yOn = (a: { ya: number; R: number }, x: number) => a.ya - a.R + Math.sqrt(Math.max(0, a.R * a.R - (x - cx) ** 2))
  const v = (x: number, y: number, b?: number): Vtx => (b ? { x: round3(x), y: round3(y), b } : { x: round3(x), y: round3(y) })
  /** an arc's vertex at x0 running to DW − x0 (or back), with its bulge */
  const along = (a: { ya: number; R: number }, x0: number, x1: number): Vtx => {
    const p = { x: x0, y: yOn(a, x0) }, q = { x: x1, y: yOn(a, x1) }
    return v(p.x, p.y, bulgeThrough(p, q, { x: cx, y: a.ya }))
  }
  const xs = [REF.xo * g, REF.xi * g]
  const topY = [REF.topO * g, REF.topI * g], botY = [DH - (REF_H - REF.botO) * g, DH - (REF_H - REF.botI) * g]
  const A = {
    topBot: [arc(REF.topOutBot), arc(REF.topInBot)], bandTop: [arc(REF.bandOutTop), arc(REF.bandInTop)],
    bandBot: [arc(REF.bandOutBot), arc(REF.bandInBot)], lowTop: [arc(REF.lowOutTop), arc(REF.lowInTop)],
  }
  const frame: Loop[] = [{ closed: true, layer: 'engrave', pts: [v(0, 0), v(DW, 0), v(DW, DH), v(0, DH)] }]
  for (const i of [0, 1]) {
    const x0 = xs[i], x1 = DW - xs[i]
    // the top panel: straight top and sides, its bottom an arc (right to left)
    frame.push({ closed: true, layer: 'engrave', pts: [v(x0, topY[i]), v(x1, topY[i]), along(A.topBot[i], x1, x0), v(x0, yOn(A.topBot[i], x0))] })
    // the band: an arc on top (left to right), the sides, an arc below (right to left)
    frame.push({ closed: true, layer: 'engrave', pts: [along(A.bandTop[i], x0, x1), v(x1, yOn(A.bandTop[i], x1)), along(A.bandBot[i], x1, x0), v(x0, yOn(A.bandBot[i], x0))] })
    // the lower panel: an arc on top (left to right), straight sides and bottom
    frame.push({ closed: true, layer: 'engrave', pts: [along(A.lowTop[i], x0, x1), v(x1, yOn(A.lowTop[i], x1)), v(x1, botY[i]), v(x0, botY[i])] })
  }
  // the ornaments: as large as in the photo (g) unless the panel is relatively lower; the spare height shared above and below
  const place = (refTop: number, refBot: number, newTop: number, newBot: number) => {
    const H0 = refBot - refTop, H1 = newBot - newTop, s = Math.min(g, H1 / H0)
    return { s, y0: newTop + (H1 - H0 * s) / 2, ref: refTop }
  }
  return {
    g, frame,
    top: place(REF.topI, REF.topInBot[0], topY[1], A.topBot[1].ya),
    low: place(REF.lowInTop[0], REF.botI, A.lowTop[1].ya, botY[1]),
  }
}

/** The ornament lines of a layout, the drawing's top-left corner at (ox, oy). */
export function ornament(L: DoorLayout, DW: number, ox = 0, oy = 0): Loop[] {
  const out: Loop[] = [], cx = DW / 2 + ox
  for (const [grp, at] of [[art().top, L.top], [art().low, L.low]] as const) {
    const y0 = at.y0 + oy - at.ref * at.s
    for (const st of grp) {
      const pts: Vtx[] = [], p = st.pts
      for (let i = 0; i < p.length; i += 2) pts.push({ x: round3(cx + (p[i] - REF_W / 2) * at.s), y: round3(y0 + p[i + 1] * at.s) })
      out.push({ closed: st.closed, layer: 'engrave', pts })
    }
  }
  return out
}

// ------------------------------------------------------------------ the template

export function errorsOf(p: Record<string, number>): string[] {
  const { PW, PH, DW, DH, dy } = p, errors: string[] = []
  if (DW < MIN_DW) errors.push(`الرسمة صغيرة على تفاصيلها الدقيقة: اجعل عرضها ${MIN_DW} مم على الأقل.`)
  const [a0, a1] = ASPECT
  if (DH < a0 * DW) errors.push(`الرسمة عريضة بالنسبة لارتفاعها فتضيق حشواتها: اجعل ارتفاعها ${Math.ceil(a0 * DW)} مم على الأقل${DH / a0 >= MIN_DW ? `، أو عرضها ${Math.floor(DH / a0)} مم على الأكثر` : ''}.`)
  if (DH > a1 * DW) errors.push(`الرسمة طويلة بالنسبة لعرضها: اجعل ارتفاعها ${Math.floor(a1 * DW)} مم على الأكثر، أو عرضها ${Math.ceil(DH / a1)} مم على الأقل.`)
  if (DW > PW - 2 * EDGE) errors.push(`الرسمة أعرض من لوح الباب: اجعل عرضها ${Math.floor(PW - 2 * EDGE)} مم على الأكثر، أو عرض اللوح ${Math.ceil(DW + 2 * EDGE)} مم على الأقل.`)
  if (DH > PH - 2 * EDGE) errors.push(`الرسمة أطول من لوح الباب: اجعل ارتفاعها ${Math.floor(PH - 2 * EDGE)} مم على الأكثر، أو ارتفاع اللوح ${Math.ceil(DH + 2 * EDGE)} مم على الأقل.`)
  else {
    const lim = (PH - DH) / 2 - EDGE
    if (Math.abs(dy) > lim + 1e-9) errors.push(`تحريك الرسمة ${dy < 0 ? '−' : ''}${f1(Math.abs(dy))} مم يُخرجها عن لوح الباب: اجعله بين −${Math.floor(lim)} و${Math.floor(lim)} مم.`)
  }
  return errors
}

function build(p: Record<string, number>, _c: Common): BuildResult {
  const warnings: string[] = []
  const errors = errorsOf(p)
  if (errors.length) return { panels: [], notes: [], warnings, errors }
  const { PW, PH, DW, DH, dy, lw } = p, n = Math.max(1, Math.round(p.n))
  const ox = (PW - DW) / 2, oy = (PH - DH) / 2 + dy
  const L = layout(DW, DH)
  const shift = (l: Loop): Loop => ({ ...l, pts: l.pts.map(q => ({ ...q, x: round3(q.x + ox), y: round3(q.y + oy) })) })
  const engrave = [...L.frame.map(shift), ...ornament(L, DW, ox, oy)]
  const len = engrave.reduce((s, l) => s + loopLength(l), 0)
  const pct = (s: number) => Math.round((s / L.g) * 100)
  const notes = [
    `الرسمة ${f1(DW)} × ${f1(DH)} مم في وسط لوح الباب ${f1(PW)} × ${f1(PH)} مم: ${f1(ox)} مم من كل جانب، ${f1(oy)} مم من فوق و${f1(PH - oy - DH)} مم من تحت.`,
    `الحفر كلّه على الطبقة الزرقاء، كل خطّ يُحرق مرّة واحدة (حفر خطّي / Scoring): في RDWorks اجعل الطبقة الزرقاء بوضع Cut بقدرة منخفضة وسرعة عالية، وجرّبها على قطعة من نفس الخشب. يخرج الخطّ بعرض رأس الليزر نحو ${f1(lw)} مم.`,
    'الإطار الأحمر حدود لوح الباب للمحاذاة فقط: اجعله Output = No، إلا إن أردت قصّ اللوح نفسه.',
    `طول خطوط الحفر نحو ${(len / 1000).toFixed(1)} م${n > 1 ? ` لكل باب (${n} أبواب)` : ''}.`,
    'لباب آخر: اكتب عرض لوح الباب وارتفاعه، وعرض الرسمة وارتفاعها؛ الإطارات والأقواس تُبنى من جديد بنسب الصورة، والزخارف تكبر وتصغر بنسبة واحدة دون مطّ وتتوسّط حشواتها. «تحريك الرسمة» يرفعها (بالسالب) أو ينزلها عن وسط اللوح.',
  ]
  if (pct(L.top.s) < 99 || pct(L.low.s) < 99) notes.push(`الحشوات أقصر نسبةً من الصورة، فصغرت الزخارف لتتّسع: العلوية ${pct(L.top.s)}% والسفلية ${pct(L.low.s)}% من مقاس الصورة على هذا العرض.`)
  return {
    panels: [{ id: 'door', name: 'لوح الباب', w: PW, h: PH, engrave, count: n, note: 'الرسمة على طبقة الحفر الزرقاء؛ الإطار الأحمر حدود اللوح' }],
    notes, warnings, errors: [],
  }
}

const PARAMS: ParamDef[] = [
  mm('PW', 'عرض لوح الباب', 300, 1500, 'قشرة الباب كاملة، والإطار الأحمر بحدودها'),
  mm('PH', 'ارتفاع لوح الباب', 600, 3000),
  mm('DW', 'عرض الرسمة', 200, 1400, 'عرض المستطيل الخارجي المحفور؛ 600 مم في رسمة الزبون'),
  mm('DH', 'ارتفاع الرسمة', 400, 2900, 'ارتفاع المستطيل الخارجي المحفور؛ 1660 مم في رسمة الزبون'),
  mm('dy', 'تحريك الرسمة', -1000, 1000, 'عن وسط اللوح: بالسالب للأعلى وبالموجب للأسفل'),
  { key: 'lw', label: 'عرض خطّ الليزر', min: 0.05, max: 1, step: 0.05, unit: 'مم', hint: 'للتذكير فقط: الرسمة خطوط مفردة، يحرق الليزر كلاًّ منها بعرض رأسه' },
  { key: 'n', label: 'عدد الأبواب', min: 1, max: 20, step: 1, int: true },
]

const DEFAULTS = { PW: 915, PH: 2130, DW: 600, DH: 1660, dy: 0, lw: 0.2, n: 1 }

const DESC = 'رسمة حفر ليزر لباب كلاسيك منقولة بدقّة عن صورة الزبون: حشوة علوية بقاعدة مقوّسة فيها مزهرية على ساق مخروطة تحمل باقة ورود (وردتان بستّ بتلات وبراعم) وأوراق طويلة تلتفّ على الجانبين، وفوقها حلقة كالقلب بين زنبقتين، وتحتها التفافات وأوراق أكانثس؛ ثم شريط مقوّس، وحشوة سفلية فيها زخرفة أوراق متناظرة. خطوط حفر رفيعة على الطبقة الزرقاء في وسط لوح الباب، والمقاس يتغيّر دون مطّ الزخارف.'

const ICON = `<rect x="16" y="4" width="32" height="56" rx="1"/><path d="M19 7h26v34q-13 4-26 0z" stroke-width="1.3"/><path d="M19 43.5q13 4 26 0v4q-13 3-26 0z" stroke-width="1.1"/><path d="M19 50q13 3 26 0v7H19z" stroke-width="1.2"/><path d="M29 22h6l-1.5 5h-3zM32 27v7M30 34h4" stroke-width="1"/><path d="M32 22c-3-3-6-2-7-5M32 22c3-3 6-2 7-5M32 21v-5M30 13c0-3 4-3 4 0l-2 3z" stroke-width="0.9"/><path d="M29 54c1-2 5-2 6 0M26 55c2-3 4-1 6-3 2 2 4 0 6 3" stroke-width="0.9"/>`

export const DOOR_VASE: Template[] = [
  { id: 'doorvase', name: 'باب كلاسيك: مزهرية وورود', desc: DESC, icon: ICON, params: PARAMS, defaults: DEFAULTS, innerAdd: () => ({ W: 0, D: 0, H: 0 }), build },
]

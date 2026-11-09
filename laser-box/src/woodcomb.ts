// A wooden comb for wedding favours (مشط خشب للتوزيعات), ported from the comb already delivered to the customer
// (comb.py): an arched back whose two top corners are rounded 5 mm, a wide guard tooth at each end, fine teeth on one
// half and coarser teeth on the other. The gaps of both kinds are scaled by one factor so the row fills the length
// exactly; every gap's root is a half circle and every tooth tip is rounded (comb.py opens the outline by 0.9 mm, which
// rounds each tip corner 0.9 mm and leaves the concave roots alone). One piece, cut by the dozen.
//
// Panel coordinates are millimetres, y down: the top of the arch at y = 0, the tooth tips at the bottom. The widths
// drawn are the widths as cut: the app's kerf compensation moves the cut lines half a kerf off the wood. The name is
// not drawn (no Arabic shaping here): it is engraved from RDWorks or CorelDRAW.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Vtx, polyLoop } from './geom'
import type { PanelSpec } from './joints'

const mm = (key: string, label: string, min: number, max: number, step = 0.5, hint?: string): ParamDef => ({ key, label, min, max, step, unit: 'مم', hint })
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const f2 = (v: number) => (Math.round(v * 100) / 100).toString()

/** thinnest tooth that survives combing, and narrowest gap the laser leaves open (both as cut) */
export const MIN_TOOTH = 1.6
export const MIN_GAP = 1.2
/** the back's top corners (comb.py: opened by 5 mm) and the tooth tips (opened by 0.9 mm) */
export const CORNER_R = 5
export const TIP_R = 0.9
/** the back must stay this tall at its lowest, or it snaps along the teeth's roots */
const MIN_BACK = 8
/** at least this many teeth of each kind, or it is not a comb */
const MIN_PER_HALF = 4

/** Python's round(): a half goes to the even neighbour (comb.py counts its teeth with it). */
export const pyRound = (v: number) => {
  const f = Math.floor(v), d = v - f
  return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1
}

export interface CombRowItem { kind: 't' | 'g'; x: number; w: number }
export interface CombRow {
  /** fine and coarse teeth between the guard teeth */
  nf: number
  nc: number
  /** the one factor every gap was scaled by so the row fits exactly */
  fill: number
  fineGap: number
  coarseGap: number
  /** the gap between the last fine tooth and the first coarse one: the mean of the two */
  midGap: number
  /** from the left guard tooth's inner side to the right one's, left to right */
  seq: CombRowItem[]
}

/**
 * The row between the guard teeth, as comb.py lays it out: a fine gap, then fine teeth each followed by a fine gap
 * (the last one replaced by the mean of a fine and a coarse gap), then coarse teeth each followed by a coarse gap.
 * Every gap is scaled by the same factor so the row ends exactly at the right guard tooth.
 */
export function combRow(L: number, guard: number, ft: number, fg: number, ct: number, cg: number): CombRow {
  const span = L - 2 * guard, half = span / 2
  const nf = Math.max(0, pyRound(half / (ft + fg))), nc = Math.max(0, pyRound(half / (ct + cg)))
  const fill = (span - nf * ft - nc * ct) / (fg * (nf + 0.5) + cg * (nc + 0.5))
  const kinds: ['t' | 'g', number][] = [['g', fg * fill]]
  for (let i = 0; i < nf; i++) kinds.push(['t', ft], ['g', fg * fill])
  kinds.pop()
  kinds.push(['g', ((fg + cg) / 2) * fill])
  for (let i = 0; i < nc; i++) kinds.push(['t', ct], ['g', cg * fill])
  const seq: CombRowItem[] = []
  let x = guard
  for (const [kind, w] of kinds) { seq.push({ kind, x, w }); x += w }
  return { nf, nc, fill, fineGap: fg * fill, coarseGap: cg * fill, midGap: ((fg + cg) / 2) * fill, seq }
}

export interface CombShape { pts: Vtx[]; row: CombRow; height: number; teeth: number; /** where the 5 mm corner arcs meet the arch, from each end */ cornerX: number }

/**
 * The comb's outline, clockwise on screen (solid on the right): along the arch, down the right end, along the teeth
 * from right to left (down every tooth to its rounded tip, up every gap to its half-circle root), up the left end.
 * The back's top follows comb.py's arch: he at the ends rising to hm in the middle along a half sine wave.
 */
export function combShape(p: Record<string, number>): CombShape {
  const { L, tl: TL, he, guard, ft, fg, ct, cg } = p
  const hm = Math.max(p.hm, he)
  const A = hm - he, H = TL + hm, yRoot = hm
  const row = combRow(L, guard, ft, fg, ct, cg)
  const top = (x: number) => A * (1 - Math.sin((Math.PI * x) / L)) // y of the arch, 0 at its middle
  const slope = (x: number) => A * (Math.PI / L) * Math.cos((Math.PI * x) / L) // its rise, y up
  // the 5 mm corner: a circle tangent to the end (x = 0, centre at x = r) and to the arch at xt, found by bisection
  const r = CORNER_R
  const g = (x: number) => { const k = slope(x); return x + (r * k) / Math.hypot(1, k) - r }
  let lo = 0, hi = L / 2
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (g(mid) < 0) lo = mid; else hi = mid }
  const xt = (lo + hi) / 2, kt = slope(xt), st = Math.hypot(1, kt)
  const yc = top(xt) + r / st // the corner arc's centre (r, yc) and where it meets the end (0, yc)
  const theta = Math.acos(Math.max(-1, Math.min(1, kt / st))) // how far the corner turns: 90° less the arch's slope
  const bc = -Math.tan(theta / 4) // convex: bows to the left of travel
  const pts: Vtx[] = [{ x: 0, y: yc, b: bc }]
  const nArch = Math.max(8, Math.ceil((L - 2 * xt) / 1.5))
  for (let i = 0; i <= nArch; i++) {
    const x = xt + ((L - 2 * xt) * i) / nArch
    pts.push(i === nArch ? { x: L - xt, y: top(L - xt), b: bc } : { x, y: top(x) })
  }
  pts.push({ x: L, y: yc })
  const q = Math.tan(Math.PI / 8)
  // a tooth from a to b, walked right to left: down its right side, round the tip, up its left side
  const tooth = (a: number, b: number) => {
    const w = b - a
    if (w - 2 * TIP_R < 1e-3) { pts.push({ x: b, y: H - w / 2, b: -1 }, { x: a, y: H - w / 2 }); return }
    pts.push({ x: b, y: H - TIP_R, b: -q }, { x: b - TIP_R, y: H }, { x: a + TIP_R, y: H, b: -q }, { x: a, y: H - TIP_R })
  }
  // a gap from a to b, walked right to left: up its right side, over the half-circle root, down its left side
  const gap = (a: number, b: number) => { const w = b - a; pts.push({ x: b, y: yRoot + w / 2, b: 1 }, { x: a, y: yRoot + w / 2 }) }
  tooth(L - guard, L)
  for (let i = row.seq.length - 1; i >= 0; i--) {
    const s = row.seq[i]
    if (s.kind === 't') tooth(s.x, s.x + s.w)
    else gap(s.x, s.x + s.w)
  }
  tooth(0, guard)
  return { pts, row, height: H, teeth: row.nf + row.nc + 2, cornerX: xt }
}

const PARAMS: ParamDef[] = [
  mm('L', 'طول المشط', 50, 300),
  mm('tl', 'طول الأسنان', 10, 60, 0.5, 'من رأس السنّ إلى أعلى جذر الفراغ'),
  mm('he', 'ارتفاع الظهر عند الطرفين', MIN_BACK, 60),
  mm('hm', 'ارتفاع الظهر في الوسط', MIN_BACK, 80, 0.5, 'أعلى من الطرفين فيتقوّس الظهر، أو مثلهما فيستقيم'),
  mm('ft', 'عرض السنّ الناعم', 1, 5, 0.1),
  mm('fg', 'الفراغ بين الأسنان الناعمة', 0.8, 5, 0.1),
  mm('ct', 'عرض السنّ العريض', 1, 6, 0.1),
  mm('cg', 'الفراغ بين الأسنان العريضة', 0.8, 6, 0.1),
  mm('guard', 'عرض سنّ الطرف', 1, 12, 0.5, 'السنّان العريضتان في طرفي المشط'),
  { key: 'n', label: 'عدد الأمشاط', min: 1, max: 200, step: 1, int: true },
]
const DEFAULTS = { L: 120, tl: 30, he: 14, hm: 24, ft: 2.2, fg: 1.6, ct: 2.8, cg: 2.2, guard: 4, n: 24 }

function build(p: Record<string, number>, c: Common): BuildResult {
  const warnings: string[] = [], errors: string[] = []
  const { L, he, hm, ft, fg, ct, cg, guard } = p, n = Math.max(1, Math.round(p.n))
  if (ft < MIN_TOOTH) errors.push(`السنّ الناعم ${f2(ft)} مم أرقّ من ${MIN_TOOTH} مم: ينكسر عند التمشيط.`)
  if (ct < MIN_TOOTH) errors.push(`السنّ العريض ${f2(ct)} مم أرقّ من ${MIN_TOOTH} مم: ينكسر عند التمشيط.`)
  if (guard < MIN_TOOTH) errors.push(`سنّ الطرف ${f2(guard)} مم أرقّ من ${MIN_TOOTH} مم: ينكسر.`)
  if (Math.min(he, hm) < MIN_BACK) errors.push(`ظهر المشط ${f1(Math.min(he, hm))} مم فقط: ينكسر عند جذور الأسنان؛ اجعله ${MIN_BACK} مم على الأقل.`)
  if (hm < he) errors.push(`ارتفاع الظهر في الوسط (${f1(hm)} مم) أقلّ من الطرفين (${f1(he)} مم): اجعله مثلهما على الأقل.`)
  const row = combRow(L, guard, ft, fg, ct, cg)
  const per = Math.max(ft + fg, ct + cg), minL = Math.ceil(2 * guard + 2 * (MIN_PER_HALF - 0.5) * per)
  if (row.nf < MIN_PER_HALF || row.nc < MIN_PER_HALF) errors.push(`المشط قصير: ${f1(L)} مم لا تتّسع لـ${MIN_PER_HALF} أسنان من كل نوع بين سنّي الطرفين؛ أقلّ طول ${minL} مم بهذه الأسنان.`)
  else {
    // the gap between the two kinds is their mean, so it is never the narrowest
    const gaps: [string, number][] = [['الناعمة', row.fineGap], ['العريضة', row.coarseGap]]
    const narrow = gaps.find(([, w]) => w < MIN_GAP - 1e-9)
    if (narrow) errors.push(`الفراغ بين الأسنان ${narrow[0]} يخرج ${f2(narrow[1])} مم بعد توزيع الصفّ على الطول، أضيق من ${MIN_GAP} مم: الليزر يحرقه والقطعة لا تسقط منه. وسّع الفراغ أو صغّر عرض السنّ أو غيّر الطول قليلاً.`)
    else if (Math.min(row.fineGap, row.coarseGap) - c.kerf < 0.3) errors.push(`عرض شقّ الليزر (${c.kerf} مم) قريب من عرض الفراغ بين الأسنان (${f2(Math.min(row.fineGap, row.coarseGap))} مم): خطّا القصّ في الفراغ يلتقيان. وسّع الفراغات.`)
  }
  if (errors.length) return { panels: [], notes: [], warnings, errors }
  if (c.t < 2.5) warnings.push(`أسنان بسماكة ${c.t} مم رقيقة تنكسر؛ الأنسب أبلكاش 3 مم.`)
  if (c.t > 4) warnings.push(`مشط بسماكة ${c.t} مم ثقيل، والفراغات الضيّقة في لوح سميك تحترق ولا تسقط قطعها؛ الأنسب أبلكاش 3 مم.`)
  const shape = combShape(p)
  const panels: PanelSpec[] = [{
    id: 'comb', name: 'المشط', w: L, h: shape.height, count: n, shape: [polyLoop(shape.pts, 'outer')],
    note: 'قطعة واحدة: الظهر المقوّس والأسنان؛ الاسم يُحفر على الظهر من RDWorks',
  }]
  const nameW = L / 3, nameH = 0.63 * (he + hm) / 2
  const notes = [
    `${n === 1 ? 'مشط واحد' : n === 2 ? 'مشطان' : `${n} ${n <= 10 ? 'أمشاط' : 'مشطاً'}`}، كلّ واحد ${f1(L)} × ${f1(shape.height)} مم وعدد أسنانه ${shape.teeth}: ${row.nf} ناعمة عرضها ${f2(ft)} مم بينها ${f2(row.fineGap)} مم على نصف، و${row.nc} أعرض عرضها ${f2(ct)} مم بينها ${f2(row.coarseGap)} مم على النصف الآخر، وسنّ عريضة ${f2(guard)} مم في كل طرف. فراغات النوعين مُدّت أو ضُيّقت بالنسبة نفسها حتى يملأ الصفّ الطول بالضبط؛ رأس كل سنّ مدوّر وجذر كل فراغ نصف دائرة، وزاويتا الظهر مدوّرتان ${CORNER_R} مم.`,
    'العروض والفراغات كما تخرج بعد القصّ: عرض شقّ الليزر (kerf) محسوب في الملف، فأدخل قيمته الصحيحة لآلتك.',
    'اقصّه من أبلكاش (بلايوود) 3 مم، لا من MDF: أسنان الـ MDF تنكسر. خلِّ الأسنان مع عروق الخشب: أوقف «السماح بتدوير القطع» فتبقى الأسنان على طول اللوح (عروق الأبلكاش عادةً على طوله).',
    'نعّم الأسنان بعد القصّ بورق زجاج ناعم، رؤوسها وجوانبها وما بينها، حتى لا تشدّ الشعر.',
    `الاسم لا يُرسم هنا: اكتبه في RDWorks أو CorelDRAW واحفره في وسط الظهر، بعرض ${f1(nameW)} مم وارتفاع ${f1(nameH)} مم على الأكثر، وفوق جذور الأسنان بـ 3 مم على الأقل.`,
    'شغّل نفخ الهواء، والأفضل مرّتا قصّ أسرع بدل مرّة بطيئة حتى لا تحترق رؤوس الأسنان.',
  ]
  return { panels, notes, warnings, errors }
}

export const WOOD_COMBS: Template[] = [
  {
    id: 'woodcomb',
    name: 'مشط خشب للتوزيعات',
    desc: 'مشط خشبي للتوزيعات كما في صورة الزبون: ظهر مقوّس بزاويتين مدوّرتين، وسنّ عريضة في كل طرف، وأسنان ناعمة على نصف وأعرض على النصف الآخر، رؤوس الأسنان وجذور الفراغات مدوّرة؛ يُقصّ بالعشرات من أبلكاش 3 مم والاسم يُحفر من RDWorks.',
    icon: `<path d="M8 36V25q0-3 3-3.6Q32 15 53 21.4q3 .6 3 3.6v11z"/><path d="M9.5 36v18M54.5 36v18" stroke-width="3"/><path d="M15 36v17M19 36v17M23 36v17M27 36v17M31 36v17M36 36v17M41 36v17M46 36v17M51 36v17" stroke-width="1.6"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build,
  },
]

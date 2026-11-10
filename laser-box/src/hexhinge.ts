// The hinged lid of the hexagonal ring box ('hexringbox', lid type 2): the lid opens upward on a pin-less hinge and
// rests leaning back at its stop angle on a support behind the box. A port of the reference delivered to the customer
// and checked on its own (ringhinge.py): the base gets a strip behind it with slots, the lid a strip behind its back
// edge with two pivot tabs, two cheeks carry the tabs in round holes, and a support plate between the cheeks stops the
// lid; the lid's lip is dropped.
//
// Box coordinates, mm: x across from the centre line, y from the hexagon's back flat (the edge on the hinge side)
// toward the front, z up from the base's top. The base and the lid are drawn in plan with the hexagon of the app's
// hexPanel (flats at y = 0 and y = AFb), so their strips lie at y < 0. The cheek is drawn as seen from the side (y to
// the right, z up) and the support as seen from behind (x to the right, z up).
//
// Strength: the open lid is held at its stop far from the axis (`reach`), so a push on the lid's top edge loads the two
// pivot tabs together about 1.5 times the push (a stop near the axis would multiply it); the tabs are 5 mm wide, short,
// and rounded where they leave the strip.
import { Loop, Pt, polyLoop, circle, rotatedRectHole, simplify, round3 } from './geom'
import type { PanelSpec } from './joints'

export const HEX_HINGE = {
  /** the axis behind the lid's back edge (at the lid's mid-plane) */
  e: 7,
  /** side clearance between the lid's strip and each cheek */
  gap: 0.6,
  /** the pivot tab's end beyond the cheek */
  out: 0.6,
  /** the pivot tab's width; it is as thick as the sheet */
  tabW: 5,
  /** acrylic round the hole in the cheek */
  wood: 4,
  /** the support touches the lid's plate (inside the lid frame's opening) this far from the axis */
  reach: 30,
  /** the cheek's tab into the base (off-centre toward the back, so a cheek turned round does not fit) and the support's */
  cheekTab: 8, supTab: 20,
  /** the support's half width above the cheeks, at most: the lid frame's bands pass beside it */
  upHalf: 16,
  /** the least clearance kept at the stop between the lid frame and the support, and round the hinge */
  clear: 0.5,
  /** the stop angle's range, degrees from closed */
  stopMin: 95, stopMax: 105,
}

const r3 = Math.sqrt(3)
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()

/** Every position of the hinge, in box coordinates, from the base's across-flats AFb, the walls' height, the sheet, the lid frame's width b and the stop angle. */
export function hexHingeGeom(AFb: number, H: number, t: number, b: number, stop: number) {
  const { e, gap, out, tabW, wood, reach, cheekTab, upHalf } = HEX_HINGE
  const A = (stop * Math.PI) / 180, cA = Math.cos(A), sA = Math.sin(A)
  const xs = AFb / (2 * r3) // the lid strip's half width: its sides line up with the hexagon's back corners
  const xci = xs + gap // the cheeks' inner faces
  const yA = -e, zA = H + t + t / 2 // the axis: closed, the lid rests on the collar (top at H + t)
  const holeR = (Math.hypot(tabW, t) + 0.4) / 2, Rc = holeR + wood // the hole takes the tab's diagonal; the cheek's top is a half circle Rc about the axis
  const tabL = gap + t + out
  // the support's front face and top: where the lid's top face is, `reach` from the axis, when the lid is at the stop
  const yF = yA + reach * cA - (t / 2) * sA, zc = zA + reach * sA + (t / 2) * cA, yB = yF - t
  const vTop = zA + Rc // the cheeks' top
  const supW2 = xci - 0.1 // half the support's width, between the cheeks
  // above the cheeks the support narrows so the lid frame's bands pass beside it: no wider than the frame opening's
  // back flat, and leaving its shoulder room for the two fillets (2 mm inside, 1 mm outside)
  const AFi = AFb - 2 - 2 * b
  const upW2 = Math.min(upHalf, AFi / (2 * r3), supW2 - 3)
  // the cheek: from the support's back face (or further back, so the hole keeps its acrylic all round) to the half circle's front
  const u0 = Math.min(yB, yA - Rc), u1 = yA + Rc
  const cu = u0 + 0.5 + cheekTab / 2
  return { A, cA, sA, xs, xci, yA, zA, holeR, Rc, tabL, yF, yB, zc, vTop, supW2, upW2, u0, u1, cu, ext: u0 - 3, xo: xci + t + 3, sBack: e + 1 + b, sFront: e + AFb - 1 - b }
}

/** Round the corner at the straight-edged vertex (x, y) of a closed loop with an arc of radius r tangent to both edges, at any angle (geom's roundCorner takes right angles only). */
function filletAt(l: Loop, x: number, y: number, r: number) {
  const n = l.pts.length, i = l.pts.findIndex(q => Math.abs(q.x - x) < 1e-6 && Math.abs(q.y - y) < 1e-6)
  if (i < 0) return
  const a = l.pts[(i + n - 1) % n], v = l.pts[i], c = l.pts[(i + 1) % n]
  const l1 = Math.hypot(v.x - a.x, v.y - a.y), l2 = Math.hypot(c.x - v.x, c.y - v.y)
  const u1 = { x: (v.x - a.x) / l1, y: (v.y - a.y) / l1 }, u2 = { x: (c.x - v.x) / l2, y: (c.y - v.y) / l2 }
  const cross = u1.x * u2.y - u1.y * u2.x, phi = Math.atan2(Math.abs(cross), u1.x * u2.x + u1.y * u2.y)
  // the tangent points r·tan(φ/2) from the corner (a tab's 0.5 mm step is used up exactly: the clamp takes rounding off)
  const d = Math.min(r * Math.tan(phi / 2), l1, l2)
  // a right turn (screen) is a convex corner: its arc bows to the left of travel, b < 0 (see geom.ts)
  l.pts.splice(i, 1, { x: v.x - u1.x * d, y: v.y - u1.y * d, b: (cross > 0 ? -1 : 1) * Math.tan(phi / 4) }, { x: v.x + u2.x * d, y: v.y + u2.y * d })
  l.pts = simplify(l.pts)
}

export interface HexHingeIn {
  /** the base's (and the lid's) across-flats and its six corners as the app's hexPanel draws them (hexPts order: right, front-right, front-left, left, back-left, back-right) */
  AFb: number; hex: Pt[]
  S: number; H: number; ov: number; b: number; tf: number; fit: number; stop: number; t: number
}

/** The hinge's pieces and messages: the base's and the lid's outlines (in the hexagon's plan coordinates), the base's new slots, the cheek and the support. */
export function hexHinge(p: HexHingeIn) {
  const { AFb, hex, S, H, ov, b, tf, fit, stop, t } = p
  const { e, gap, tabW, reach, cheekTab, supTab, clear: m, stopMin, stopMax } = HEX_HINGE
  const g = hexHingeGeom(AFb, H, t, b, stop)
  const { cA, sA, xci, yA, zA, holeR, Rc, tabL, yF, yB, zc, vTop, supW2, upW2, u0, u1, cu, ext, xo } = g
  const errors: string[] = []
  const cx = AFb / r3 // the hexagon's centre line in plan
  const [P0, P1, P2, P3, P4, P5] = hex

  // ---- what can stop it working
  if (stop < stopMin || stop > stopMax) errors.push(`زاوية توقّف الغطاء بين ${stopMin}° و${stopMax}°.`)
  // closed or turning, the lid's corners beside the strip pass in front of the cheek's half circle
  if (Rc + m > e + gap * r3) {
    const tMax = Math.sqrt((2 * (e + gap * r3 - m - HEX_HINGE.wood) - 0.4) ** 2 - tabW ** 2)
    errors.push(`اللوح سميك على مفصل الغطاء: ثقب اللسان ${(2 * holeR).toFixed(1)} مم وحوله 4 مم من الأكريليك، فيصل خدّ المفصل إلى زاوية الغطاء. أقصى سماكة للغطاء المفصلي ${f1(Math.floor(tMax * 10) / 10)} مم، أو اختر الغطاء الذي يُرفع.`)
  }
  // the strip's end and the tabs' roots turn within hypot(2.5, t/2) of the axis, in front of the support
  if (yA - yF < Math.hypot(tabW / 2, t / 2) + m) errors.push('السندة قريبة من المفصل عند هذه الزاوية والسماكة: زد زاوية التوقّف.')
  if (upW2 < 6) {
    // (the opening's back flat is at least 12 mm long when AFb - 2 - 2b >= 12√3; b on its 0.5 mm step)
    const bMax = Math.floor(AFb - 2 - 12 * r3) / 2
    errors.push(`فتحة إطار الغطاء أضيق من أن تمرّ فيها سندة الغطاء: ${bMax >= 2 ? `اجعل عرض الإطار ${bMax} مم على الأكثر، أو ` : ''}اجعل السداسي ${Math.ceil(2 + 2 * b + 12 * r3 - 2 * ov)} مم على الأقل.`)
  } else {
    // at the stop the lid frame's back band (on the lid's top face, which faces the support) must keep clear of the
    // support's face: the band's top face is tf proud of the plate and ends sBack from the axis, where the plate meets
    // the support at `reach`. (The frame is never low enough to meet the support's wide part between the cheeks: its
    // lowest point at the stop is above the cheeks' top whenever this holds.)
    const clearAt = (deg: number) => { const a = (deg * Math.PI) / 180; return (reach - g.sBack) * -Math.cos(a) - tf * Math.sin(a) }
    const c1 = clearAt(stop)
    if (c1 < m) {
      let aMin = 0
      // a whole degree, as the stop field steps
      for (let d = Math.ceil(stop); d <= stopMax + 1e-9; d++) if (clearAt(d) >= m) { aMin = d; break }
      const bMax = Math.floor((reach - (tf * sA + m) / -cA - e - 1) * 2) / 2, tfMax = Math.floor((((reach - g.sBack) * -cA - m) / sA) * 10) / 10
      const ways = [...(aMin ? [`اجعل زاوية التوقّف ${aMin}° على الأقل`] : []), ...(bMax >= 2 ? [`عرض الإطار ${bMax} مم على الأكثر`] : []), ...(tfMax >= 0.5 ? [`لوح إطار الغطاء ${f1(tfMax)} مم على الأكثر`] : [])]
      errors.push(`إطار الغطاء يلمس السندة قبل الغطاء: عند ${stop}° تبقى حافّة شريطه الخلفي على ${Math.max(0, c1).toFixed(2)} مم من السندة، والمطلوب ${m} مم على الأقل${ways.length ? `؛ ${ways.join('، أو ')}` : ''}.`)
    }
    // and beyond the contact the frame's front part stays above the support's top
    if ((g.sFront - reach) * sA - tf * -cA < m) errors.push('إطار الغطاء يلمس رأس السندة: كبّر السداسي أو صغّر عرض الإطار.')
  }
  // the frames on the two back walls reach back toward the cheeks: their outer back corner is tf out from the wall's corner
  const wallFrameCorner = { x: S / (2 * r3) + (tf * r3) / 2, y: ov - tf / 2 }
  if (wallFrameCorner.x > xci - 0.2 && wallFrameCorner.y < u1 + 0.2) errors.push(`إطارا الجدارين الخلفيين المائلين يصلان إلى خدّي المفصل: زد بروز القاعدة إلى ${Math.ceil(u1 + 0.2 + tf / 2)} مم أو اجعل لوح الإطار أرقّ.`)

  // ---- the base: the hexagon and a strip behind it (0.5 mm into the hexagon, as the reference), with the slots
  const yJ = 0.5, dJ = 0.5 / r3
  const base = polyLoop([P0, P1, P2, P3, { x: round3(P4.x - dJ), y: yJ }, { x: round3(cx - xo), y: yJ }, { x: round3(cx - xo), y: round3(ext) }, { x: round3(cx + xo), y: round3(ext) }, { x: round3(cx + xo), y: yJ }, { x: round3(P5.x + dJ), y: yJ }], 'outer')
  const baseSlots: Loop[] = [
    ...[-1, 1].map(sg => rotatedRectHole(round3(cx + sg * (xci + t / 2)), round3(cu), t + fit, cheekTab + fit, 0)),
    rotatedRectHole(round3(cx), round3((yB + yF) / 2), supTab + fit, t + fit, 0),
  ]

  // ---- the lid: the hexagon, a strip behind its back edge to 2 mm behind the axis, and a pivot tab each side (tabW
  // wide, through the gap, the cheek and `out` beyond); its inside corners rounded 0.5 mm (no crack starts at a tab's root)
  const xL = P4.x, xR = P5.x, yT0 = yA - tabW / 2, yT1 = yA + tabW / 2, yE = yA - 2
  const lid = polyLoop([P0, P1, P2, P3, P4, { x: xL, y: yT1 }, { x: round3(xL - tabL), y: yT1 }, { x: round3(xL - tabL), y: yT0 }, { x: xL, y: yT0 }, { x: xL, y: yE },
    { x: xR, y: yE }, { x: xR, y: yT0 }, { x: round3(xR + tabL), y: yT0 }, { x: round3(xR + tabL), y: yT1 }, { x: xR, y: yT1 }, P5], 'outer')
  for (const q of [P4, { x: xL, y: yT1 }, { x: xL, y: yE }, { x: xR, y: yE }, { x: xR, y: yT1 }, P5]) filletAt(lid, q.x, q.y, 0.5)

  // ---- the cheek, seen from the side (y to the right, z up; drawn with the top at 0): up to the axis, above it a half
  // circle about the axis (the lid's corners turn round it), the tab under it into the base, the hole for the pivot tab
  const cX = (u: number) => round3(u - u0), cY = (z: number) => round3(vTop - z), ct = cheekTab / 2
  const cheekLoop = polyLoop([
    { x: cX(u0), y: cY(0) }, { x: cX(cu - ct), y: cY(0) }, { x: cX(cu - ct), y: cY(-t) }, { x: cX(cu + ct), y: cY(-t) }, { x: cX(cu + ct), y: cY(0) },
    { x: cX(u1), y: cY(0) }, { x: cX(u1), y: cY(zA), b: 1 }, { x: cX(yA - Rc), y: cY(zA) }, { x: cX(u0), y: cY(zA) },
  ], 'outer')
  const cheek: PanelSpec = {
    id: 'cheek', name: 'خدّ المفصل', w: round3(u1 - u0), h: round3(vTop + t), count: 2, shape: [cheekLoop], holes: [circle(cX(yA), cY(zA), round3(holeR))],
    note: `يدور فيه لسان الغطاء؛ الطرف المدوّر إلى الأعلى والأمام، واللسان السفلي أقرب إلى الخلف فلا يدخل شقّه مقلوباً`,
  }

  // ---- the support, seen from behind (x to the right, z up; drawn with the top at 0): between the cheeks up to their
  // top, narrower above it up to the stop, a tab into the base; inside corners rounded 2 mm, outside ones 1 mm
  const sX = (x: number) => round3(x + supW2), sY = (z: number) => round3(zc - z), st = supTab / 2
  const supLoop = polyLoop([
    { x: sX(-supW2), y: sY(0) }, { x: sX(-st), y: sY(0) }, { x: sX(-st), y: sY(-t) }, { x: sX(st), y: sY(-t) }, { x: sX(st), y: sY(0) }, { x: sX(supW2), y: sY(0) },
    { x: sX(supW2), y: sY(vTop) }, { x: sX(upW2), y: sY(vTop) }, { x: sX(upW2), y: sY(zc) }, { x: sX(-upW2), y: sY(zc) }, { x: sX(-upW2), y: sY(vTop) }, { x: sX(-supW2), y: sY(vTop) },
  ], 'outer')
  for (const sg of [-1, 1]) {
    filletAt(supLoop, sX(sg * supW2), sY(0), 1); filletAt(supLoop, sX(sg * supW2), sY(vTop), 1)
    filletAt(supLoop, sX(sg * upW2), sY(vTop), 2); filletAt(supLoop, sX(sg * upW2), sY(zc), 1)
  }
  const support: PanelSpec = {
    id: 'support', name: 'سندة الغطاء', w: round3(2 * supW2), h: round3(zc + t), count: 1, shape: [supLoop],
    note: `تقف بلسانها خلف المحور بين الخدّين، ويستند الغطاء المفتوح إلى حافّتها العليا عند ${stop}°`,
  }

  const notes = [
    `الغطاء بمفصل بلا مسمار: لسانان ${tabW} × ${t} مم في طرفَي ذيل الغطاء يدوران في ثقبين قطرهما ${(2 * holeR).toFixed(2)} مم في خدّي المفصل، فيُفتح الغطاء إلى الأعلى ويقف مائلاً للخلف عند ${stop}° مستنداً إلى السندة خلف العلبة (تلمسه على بعد ${(reach - e).toFixed(0)} مم من حافّته الخلفية، داخل فتحة إطاره). القاعدة تمتدّ ${(-ext).toFixed(1)} مم خلف السداسي، وفي ذيلها شقّا الخدّين وشقّ السندة.`,
    `ترتيب تركيب المفصل: (1) ركّب العلبة وألصق الطوق كما سبق. (2) ضع الغطاء على الطوق وارفعه ${t} مم، وأدخل خدّي المفصل على لسانيه من الجانبين والطرف المدوّر إلى الأعلى والأمام؛ الخدّ لا يدخل شقّه إلا في اتجاهه الصحيح. (3) أنزل الغطاء والخدّين معاً فيدخل لسان كلّ خدّ في شقّه. (4) أدخل السندة من فوق بين الخدّين في شقّها. (5) ألصق الخدّين والسندة بالقاعدة وببعضها والغطاء مغلق. لا يُركَّب الغطاء بعد لصق الخدّين، فركّبه قبلهما.`,
    'أبعد الغراء عن لساني المفصل وثقبيهما: ضع الغراء السائل على الشقوق من تحت ومن الخلف فقط. إذا صرّ المفصل امسح اللسانين بشمع (لا زيت). نقطة لبّاد صغيرة على رأس السندة تحمي الغطاء من الخدش.',
    `إطار الغطاء من مرايا ${tf} مم بالضبط، لا أسمك: عند الفتح يقع بين الغطاء والسندة، فإطار أسمك يلمس السندة قبل الغطاء ويغيّر زاوية التوقّف. لذلك اقصّ الإطارات كلّها من لوح المرايا ${tf} مم نفسه.`,
    `قِس سماكة الأكريليك الشفّاف بالقدمة وأدخلها قبل القصّ: ثقب المفصل ولساناه وموضع السندة وارتفاعها محسوبة منها، ولوح أسمك مما أدخلت يضيّق دوران اللسان في ثقبه ويغيّر زاوية التوقّف.`,
    `امسك العلبة وأنت تفتحها ولا تشدّ الغطاء للخلف بالقوّة. إذا مالت العلبة للأمام أكثر من ${Math.round(stop - 90)}° انغلق الغطاء وحده.`,
  ]
  return { geom: g, base, baseSlots, lid, cheek, support, errors, notes }
}

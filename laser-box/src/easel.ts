// A tripod artist's easel (حامل لوحات ثلاثي القوائم، إيزل), cut entirely as flat strips and plates.
//
// Front view, the "frame plane": two splayed front legs and a central mast standing on the floor, with an upper and a
// lower crossbar bolted BEHIND them (legs and mast in one plane, crossbars behind). A rear leg hangs between two cheeks
// of a hinge bracket bolted behind the upper crossbar and swings back. A tray (shelf + front lip + end pieces + a back
// plate that hangs under the shelf) rides on the mast's lower slot on one bolt with a wing nut; two horns at the back of
// the shelf hug the mast's sides so it cannot turn. A small clamp (plate + lip) rides on the upper slot above the picture.
//
// Every long strip is laminated: cut `layers` times and glued face to face. A strip longer than the laser bed (maxL) is
// cut in two; with two or three layers each layer's joint sits somewhere else (≥ 150 mm apart) so the glued strip stays
// whole, and with one layer the joint gets two splice plates glued and bolted across it.
//
// Heights (hU, hL, the slots) are measured along the frame from the floor. Strip panels are drawn lying along x, y down.
import type { Template, ParamDef, Common, BuildResult } from './templates'
import { Loop, Vtx, circle, stadium, polyLoop, rect, roundCorner, roundedRectHole, round3 } from './geom'
import type { PanelSpec } from './joints'

const DEG = Math.PI / 180
const KQ = Math.tan(Math.PI / 8) // bulge of a quarter circle
const f0 = (v: number) => String(Math.round(v))
const f1 = (v: number) => (Math.round(v * 10) / 10).toString()
const up = (v: number, s = 5) => Math.ceil(v / s - 1e-9) * s
const dn = (v: number, s = 5) => Math.floor(v / s + 1e-9) * s
const mm = (key: string, label: string, min: number, max: number, hint?: string, step = 0.5): ParamDef => ({ key, label, min, max, step, unit: 'مم', hint })

// ------------------------------------------------------------------ strips

/** One end of a strip: a straight cut from (x0, 0) to (x1, w), a half-round centred at x = cx, or a square end at x with rounded corners. */
export type End = { kind: 'line'; x0: number; x1: number } | { kind: 'round'; cx: number } | { kind: 'rounded'; x: number; r: number }
/** A strip w wide lying along x: its two ends, bolt holes on its centre line, and slots (centre to centre) along it. */
export interface Strip { w: number; A: End; B: End; holes: number[]; slots: [number, number][] }

/** the strip's overall length along x */
export const stripLen = (s: Strip) => {
  const a = s.A.kind === 'line' ? Math.min(s.A.x0, s.A.x1) : s.A.kind === 'round' ? s.A.cx - s.w / 2 : s.A.x
  const b = s.B.kind === 'line' ? Math.max(s.B.x0, s.B.x1) : s.B.kind === 'round' ? s.B.cx + s.w / 2 : s.B.x
  return b - a
}

/**
 * The part of a strip between two square cuts (null = the strip's own end): outline clockwise on screen, holes, and the
 * slots wholly inside. A slot running through a cut opens into the piece's end as a U-notch with its round end inside.
 */
export function stripPiece(s: Strip, c0: number | null, c1: number | null, hr: number, sw: number): Loop[] {
  const w = s.w, rs = sw / 2, ym = w / 2
  const A: End = c0 === null ? s.A : { kind: 'line', x0: c0, x1: c0 }
  const B: End = c1 === null ? s.B : { kind: 'line', x0: c1, x1: c1 }
  const lo = c0 ?? -Infinity, hi = c1 ?? Infinity
  const pts: Vtx[] = []
  // top-left corner, then along the top edge
  if (A.kind === 'line') pts.push({ x: A.x0, y: 0 })
  else if (A.kind === 'rounded') pts.push({ x: A.x, y: A.r, b: -KQ }, { x: A.x + A.r, y: 0 })
  else pts.push({ x: A.cx, y: 0 })
  // the right end, downwards
  if (B.kind === 'line') {
    pts.push({ x: B.x0, y: 0 })
    const sl = c1 === null ? undefined : s.slots.find(([a, b]) => a < c1 && b > c1)
    if (sl && c1 !== null) pts.push({ x: c1, y: ym - rs }, { x: sl[0], y: ym - rs, b: 1 }, { x: sl[0], y: ym + rs }, { x: c1, y: ym + rs })
    pts.push({ x: B.x1, y: w })
  } else if (B.kind === 'rounded') pts.push({ x: B.x - B.r, y: 0, b: -KQ }, { x: B.x, y: B.r }, { x: B.x, y: w - B.r, b: -KQ }, { x: B.x - B.r, y: w })
  else pts.push({ x: B.cx, y: 0, b: -1 }, { x: B.cx, y: w })
  // along the bottom edge, then the left end upwards
  if (A.kind === 'line') {
    pts.push({ x: A.x1, y: w })
    const sl = c0 === null ? undefined : s.slots.find(([a, b]) => a < c0 && b > c0)
    if (sl && c0 !== null) pts.push({ x: c0, y: ym + rs }, { x: sl[1], y: ym + rs, b: 1 }, { x: sl[1], y: ym - rs }, { x: c0, y: ym - rs })
  } else if (A.kind === 'rounded') pts.push({ x: A.x + A.r, y: w, b: -KQ }, { x: A.x, y: w - A.r })
  else pts.push({ x: A.cx, y: w, b: -1 })
  const loops: Loop[] = [polyLoop(pts, 'outer')]
  for (const x of s.holes) if (x > lo && x < hi) loops.push(circle(x, ym, hr))
  for (const [a, b] of s.slots) if (a - rs > lo && b + rs < hi) loops.push(stadium((a + b) / 2, ym, b - a + sw, sw))
  return loops
}

/**
 * Where to cut each layer of a strip of length S that is longer than the bed: one cut per layer, both pieces at most
 * maxL long and at least minPiece, outside the `bad` stretches, and every two layers' cuts at least 150 mm apart.
 * [] when the strip fits the bed, null when no such cuts exist.
 */
export function pickSplits(S: number, maxL: number, layers: number, bad: [number, number][], prefer: number, minPiece: number): number[] | null {
  if (S <= maxL + 1e-9) return []
  const lo = Math.max(S - maxL, minPiece), hi = Math.min(maxL, S - minPiece)
  if (lo > hi) return null
  const got: number[] = []
  const ok = (c: number) => c >= lo - 1e-9 && c <= hi + 1e-9 && !bad.some(([a, b]) => c > a && c < b) && got.every(g => Math.abs(g - c) >= 150 - 1e-9)
  const spacing = layers > 1 ? Math.max(150, Math.min(250, (hi - lo) / (layers - 1))) : 0
  for (let i = 0; i < layers; i++) {
    const want = Math.min(hi, Math.max(lo, prefer + (i - (layers - 1) / 2) * spacing))
    let found: number | null = null
    for (let st = 0; st <= hi - lo + 2.5 && found === null; st += 2.5) for (const cnd of st ? [want + st, want - st] : [want]) if (found === null && ok(cnd)) found = round3(cnd)
    if (found === null) return null
    got.push(found)
  }
  return got
}

/** [a, b] with the stretch [lo, hi] taken out: what is left on either side, if at least minLen long */
function cutOut(iv: [number, number][], lo: number, hi: number, minLen: number): [number, number][] {
  const out: [number, number][] = []
  for (const [a, b] of iv) {
    if (hi <= a || lo >= b) { out.push([a, b]); continue }
    if (lo - a >= minLen) out.push([a, lo])
    if (b - hi >= minLen) out.push([hi, b])
  }
  return out
}

// ------------------------------------------------------------------ parameters

const PARAMS: ParamDef[] = [
  mm('L', 'طول الرجل الأمامية', 600, 2200, 'على محور الرجل من القدم إلى الرأس', 5),
  mm('Lm', 'طول الصاري (العمود الأوسط)', 700, 2600, 'يقف على الأرض بين الرجلين ويرتفع فوقهما ليحمل المشبك العلوي', 5),
  mm('w', 'عرض الشرائح', 20, 100, 'عرض الرجلين والصاري والعارضتين؛ لا يقلّ عن خمسة أضعاف عرض المجرى (42.5 مم لبرغي 8)'),
  mm('spread', 'المسافة بين القدمين الأماميتين', 250, 1400, 'بين محوري الرجلين على الأرض', 5),
  mm('top', 'المسافة بين الرجلين من الأعلى', 80, 900, 'بين محوري الرجلين عند رأسيهما', 5),
  mm('hU', 'ارتفاع العارضة العلوية', 200, 2000, 'من الأرض إلى محور العارضة، على طول الواجهة؛ خلفها مفصل الرجل الخلفية', 5),
  mm('hL', 'ارتفاع العارضة السفلية', 30, 1000, 'من الأرض إلى محور العارضة، على طول الواجهة', 5),
  { key: 'angle', label: 'زاوية فتح الرجل الخلفية', min: 10, max: 40, step: 1, unit: '°', hint: 'بين الرجل الخلفية والواجهة؛ تميل الواجهة للخلف نصف هذه الزاوية' },
  mm('Lt', 'طول الرفّ', 150, 1300, 'الرفّ الذي تقف عليه اللوحة، أمام الرجلين', 5),
  mm('d', 'عمق الرفّ', 25, 150, 'من الواجهة إلى وجه الحافّة الأمامية؛ يحمل الرفّ والمشبك لوحات سماكتها حتى العمق ناقص سماكة الخشب'),
  mm('lip', 'ارتفاع حافّة الرفّ', 10, 80, 'الحافّة الأمامية التي تمنع اللوحة من الانزلاق'),
  mm('bolt', 'قطر البرغي', 4, 12, 'براغي برأس مستدير وصواميل فراشة؛ الثقوب والمجرى بقطر البرغي + 0.5 مم', 1),
  mm('maxL', 'أطول قطعة يقصّها الليزر', 600, 3000, 'طول سرير الليزر؛ الشرائح الأطول تُقصّ قطعتين', 10),
  { key: 'layers', label: 'عدد الطبقات', min: 1, max: 3, step: 1, int: true, hint: 'كلّ شريحة طويلة تُقصّ بعدد الطبقات وتُلصق وجهاً لوجه: 3 لخشب 3 مم، 2 لخشب 4–6 مم' },
  mm('fit', 'خلوص الشقوق', 0, 0.6, 'يُضاف لعرض شقوق الألسنة', 0.05),
  { key: 'n', label: 'العدد', min: 1, max: 4, step: 1, int: true },
]
const DEFAULTS = { L: 1500, Lm: 1900, w: 45, spread: 650, top: 300, hU: 1300, hL: 360, angle: 22, Lt: 600, d: 60, lip: 25, bolt: 8, maxL: 1300, layers: 3, fit: 0.15, n: 1 }

// ------------------------------------------------------------------ geometry

/** Every size and position of the easel, for the build, the tests and the previews. */
export function easelGeom(p: Record<string, number>, c: Common) {
  const t = c.t, { L, Lm, w, spread, top, hU, hL, Lt, d, lip, bolt, maxL, fit } = p
  const layers = Math.max(1, Math.min(3, Math.round(p.layers)))
  const Tl = layers * t                                  // a glued strip's thickness
  const hole = bolt + 0.5, hr = hole / 2, sw = hole, rs = sw / 2
  const head = 1.25 * bolt                               // radius of a round bolt head
  const nut = 1.5 * bolt                                 // a wing nut and its washer, measured from the bolt
  // front legs: centre lines from (±spread/2, 0) to (±top/2, Hf), splayed phi from the frame's vertical
  const dx = (spread - top) / 2
  const phi = Math.asin(Math.min(0.95, Math.max(0, dx) / L))
  const Hf = L * Math.cos(phi)
  const k = (w / 2) * Math.tan(phi)                      // how far a horizontal cut runs along a leg across its width
  const xc = (y: number) => spread / 2 - (dx * y) / Hf   // the right leg's centre line at height y
  const aOf = (y: number) => y / Math.cos(phi)            // height → distance along the leg from the foot
  const ov = 0.5 * w                                     // crossbars reach this far past the legs
  const crossLen = (y: number) => round3(2 * (xc(y) + w / (2 * Math.cos(phi)) + ov))
  const LcU = crossLen(hU), LcL = crossLen(hL)
  // hinge bracket behind the upper crossbar: a plate with the crossbar's bolts at its top and two cheeks below
  const sx = w / 2 + head + 1.5                          // its two side bolts, clear of the mast
  const Wbp = round3(2 * (sx + 1.5 * bolt)), Hch = 2 * w, e = w / 2 + 3, Dc = round3(e + 1.5 * bolt)
  const Hbp = w + 2 + Hch + 3
  const brTop = hU + w / 2, brBottom = brTop - Hbp
  const hinge = brTop - (w + 2) - Hch / 2                // the hinge bolt's height
  const xs = Tl / 2 + 0.5 + t / 2                        // cheek centres either side of the rear leg
  const chTab = Hch / 4
  // tray: back plate under the shelf, its two tabs in slots behind which the shelf's horns hug the mast
  const nw = w + 1
  const tabA = nw / 2 + 2 + fit / 2, tabL = Math.max(8, 2 * t), tabB = tabA + tabL
  const Wb = Lt, Wp = 2 * (tabB + fit / 2 + 2.5)        // the back is an apron as long as the shelf, as in the photo
  const m = Math.max(Tl, 2.5 + fit / 2)                  // how far the horns reach behind the frame
  const yb = head + 1, Hb = round3(yb + Math.max(1.5 * bolt, hr + 4))
  // top clamp: plate in front of the mast, lip at its foot over the picture
  const Wc = round3(Math.max(2.5 * w, 4 * bolt + 20)), Hc = round3(Math.max(3 * bolt, 0.9 * w) + t), hbC = (Hc + t) / 2
  // the mast's slots: bolt centres from s0 to s1 (tray) and u0 to u1 (clamp)
  // (the tray's ends and lip stay below the bolt heads at the upper crossbar where they pass the legs)
  const s0 = hL + Math.max(w / 2 + nut, Hb - yb + head + 1), s1 = Math.min(brBottom - nut, hU - head - 2 - (yb + t + lip))
  const u0 = hU + Math.max(w / 2 + nut, hbC + head + 1), u1 = Lm - w / 2 - rs
  // what rides in front of the frame, relative to its bolt: [lowest, highest, half width]
  const trayBody: [number, number, number] = [-(Hb - yb), yb + t + lip, Lt / 2], clampBody: [number, number, number] = [-hbC, Hc - hbC, Wc / 2]
  // rear leg: the frame leans back beta, the rear leg leans gamma the other way; theta between them
  const theta = p.angle * DEG, beta = theta / 2, gamma = theta - beta
  const zh = Tl + Tl + t + e                             // the hinge behind the frame's front face
  // the feet are cut square to the frame's faces, so a frame leaning back stands on the BACK edges of its feet (z = Tl):
  // heights and distances are taken from that line
  const Hz = hinge * Math.cos(beta) - (zh - Tl) * Math.sin(beta)
  const R = Hz / Math.cos(gamma)                         // hinge to the middle of the rear foot
  const kr = (w / 2) * Math.tan(gamma)
  const rearX = hinge * Math.sin(beta) + (zh - Tl) * Math.cos(beta) + R * Math.sin(gamma) // rear foot behind the front feet
  const Ls = round3(Math.max(3 * w, 8 * bolt))           // splice plates (one layer only)
  return {
    t, L, Lm, w, spread, top, hU, hL, Lt, d, lip, bolt, maxL, fit, layers, Tl, hole, hr, sw, rs, head, nut,
    dx, phi, Hf, k, xc, aOf, ov, LcU, LcL, sx, Wbp, Hch, e, Dc, Hbp, brTop, brBottom, hinge, xs, chTab,
    nw, tabA, tabB, Wb, Wp, m, yb, Hb, Wc, Hc, hbC, s0, s1, u0, u1, trayBody, clampBody, theta, beta, gamma, zh, R, kr, rearX, Ls,
  }
}
export type EaselGeom = ReturnType<typeof easelGeom>

// ------------------------------------------------------------------ the strips and where they are cut

/** The long strips of the easel (strip coordinates, x along the strip), with each layer's cuts and the mast's slots. */
export function easelStrips(g: EaselGeom) {
  const { w, L, Lm, k, hL, hU, hr, rs, Ls, layers, maxL, kr, R, Hch, theta, brTop, brBottom } = g
  const one = layers === 1
  const grow = (iv: [number, number][], by: number) => iv.map(([a, b]) => [a - by, b + by] as [number, number])
  const around = (xs: number[], r: number) => xs.map(x => [x - r, x + r] as [number, number])
  // front legs: parallelograms, both ends cut level with the floor
  const legHoles = [g.aOf(hL) + k, g.aOf(hU) + k]
  const leg: Strip = { w, A: { kind: 'line', x0: 0, x1: 2 * k }, B: { kind: 'line', x0: L, x1: L + 2 * k }, holes: legHoles, slots: [] }
  // one layer: a leg's splice plates sit on both its faces, so they keep off the crossbars behind it and, where they
  // can, off the heights where the tray or the clamp passes in front of it (else those slots are shortened below)
  const co = Math.cos(g.phi), si = Math.sin(g.phi)
  const plateAt = (c: number): [number, number] => [(c - Ls / 2 - k) * co - (w / 2) * si, (c + Ls / 2 - k) * co + (w / 2) * si]
  const centresOver = (h0: number, h1: number): [number, number] => [(h0 - (w / 2) * si) / co + k - Ls / 2, (h1 + (w / 2) * si) / co + k + Ls / 2]
  /** the part of the heights [h0, h1] where something X either side of the middle, in front of the frame, passes over a leg */
  const reach = (h0: number, h1: number, X: number): [number, number] | null => {
    if (g.xc(h1) - w / (2 * co) >= X + 1) return null
    const yr = g.dx > 0 ? ((g.spread / 2 - w / (2 * co) - X - 1) * g.Hf) / g.dx : -Infinity
    return [Math.max(h0, yr), h1]
  }
  const frontBands = ([[g.s0, g.s1, g.trayBody], [g.u0, g.u1, g.clampBody]] as [number, number, [number, number, number]][])
    .map(([a, b, [lo, hi, X]]) => reach(a + lo - 2, b + hi + 2, X)).filter((r): r is [number, number] => !!r)
  const legBad = one
    ? grow([hL, hU].map(h => [g.aOf(h - w / 2) - 3, g.aOf(h + w / 2) + 2 * k + 3] as [number, number]), Ls / 2)
    : around(legHoles, hr + 4)
  const legMin = Math.max(150, 3 * w) + (one ? Ls / 2 + 2 * k : 2 * k)
  const legCuts = (one && pickSplits(L + 2 * k, maxL, layers, [...legBad, ...frontBands.map(([a, b]) => centresOver(a, b))], (L + 2 * k) / 2, legMin))
    || pickSplits(L + 2 * k, maxL, layers, legBad, (L + 2 * k) / 2, legMin)
  // mast: square foot on the floor, rounded top, bolt holes at both crossbars, the tray's and the clamp's slots
  let slots: [number, number][] = [[g.s0, g.s1], [g.u0, g.u1]].filter(([a, b]) => b - a >= 0) as [number, number][]
  const mastBad = one
    ? grow([...around([hL, hU], hr + 3), [hL - w / 2 - 3, hL + w / 2 + 3], [brBottom - 3, brTop + 3]], Ls / 2)
    : [...around([hL, hU], hr + 4), ...around(slots.flat(), rs + 3)]
  const mastCuts = pickSplits(Lm, maxL, layers, mastBad, one ? brTop + 4 + Ls / 2 : Lm / 2, Math.max(150, 3 * w) + (one ? Ls / 2 : 0))
  if (one && mastCuts?.length) {
    // the splice plates sit on both faces of the mast: the tray and the clamp stop short of them
    const c = mastCuts[0], lo = c - Ls / 2, hi = c + Ls / 2
    const tray = slots.filter(([a]) => a < brBottom), clamp = slots.filter(([a]) => a >= brBottom)
    slots = [
      ...cutOut(tray, lo - Math.max(g.yb + g.t, g.nut) - 2, hi + Math.max(g.Hb - g.yb, g.nut) + 2, g.bolt),
      ...cutOut(clamp, lo - Math.max(g.Hc - g.hbC, g.nut) - 2, hi + Math.max(g.hbC, g.nut) + 2, g.bolt),
    ]
  }
  // a leg's splice plate that the tray or the clamp would run into: their slots stop short of it
  if (one && legCuts?.length) for (const c of legCuts) {
    const [Y0, Y1] = plateAt(c)
    slots = slots.flatMap(sl => {
      const [lo, hi, X] = sl[0] < brBottom ? g.trayBody : g.clampBody
      return reach(Y0, Y1, X) ? cutOut([sl], Y0 - 2 - hi, Y1 + 2 - lo, g.bolt) : [sl]
    })
  }
  const mastHoles = [hL, hU, ...(one && mastCuts?.length ? [mastCuts[0] - Ls / 4, mastCuts[0] + Ls / 4] : [])]
  const mast: Strip = { w, A: { kind: 'line', x0: 0, x1: 0 }, B: { kind: 'rounded', x: Lm, r: w / 4 }, holes: mastHoles, slots }
  // rear leg: foot cut level with the floor, half-round head round the hinge bolt
  const hx = kr + R, rearS = hx + w / 2
  const rearBad: [number, number][] = grow([[hx - Hch / 2 / Math.cos(theta) - 8, rearS + 1]], one ? Ls / 2 : 0)
  const rearCuts = pickSplits(rearS, maxL, layers, rearBad, rearS / 2, Math.max(150, 3 * w) + (one ? Ls / 2 + 2 * kr : 2 * kr))
  const rear: Strip = { w, A: { kind: 'line', x0: 0, x1: 2 * kr }, B: { kind: 'round', cx: hx }, holes: [hx], slots: [] }
  if (one && legCuts?.length) leg.holes = [...legHoles, legCuts[0] - Ls / 4, legCuts[0] + Ls / 4]
  if (one && rearCuts?.length) rear.holes = [hx, rearCuts[0] - Ls / 4, rearCuts[0] + Ls / 4]
  // crossbars: square ends with small round corners
  const bar = (Lc: number, xs: number[]): Strip => ({ w, A: { kind: 'rounded', x: 0, r: Math.min(3, w / 8) }, B: { kind: 'rounded', x: Lc, r: Math.min(3, w / 8) }, holes: xs.map(x => Lc / 2 + x), slots: [] })
  const barU = bar(g.LcU, [-g.xc(hU), -g.sx, 0, g.sx, g.xc(hU)]), barL = bar(g.LcL, [-g.xc(hL), 0, g.xc(hL)])
  return { leg, legCuts, mast, mastCuts, rear, rearCuts, barU, barL, slots }
}

// ------------------------------------------------------------------ build

const NAME = { leg: 'الرجل الأمامية', mast: 'الصاري', rear: 'الرجل الخلفية', barU: 'العارضة العلوية', barL: 'العارضة السفلية' }

const lab = (key: string) => `«${PARAMS.find(q => q.key === key)!.label}»`
const make = (...alts: string[]) => { const a = alts.filter(Boolean); return a.length ? `اجعل ${a.join('، أو ')}.` : '' }

/** What stops the strips being cut on the bed as asked: a strip that cannot be split, or splice plates (one layer) that leave the tray or the clamp no slot. */
function bedProblem(g: EaselGeom, st: ReturnType<typeof easelStrips>): 'leg' | 'mast' | 'rear' | 'tray' | 'clamp' | null {
  if (!st.legCuts) return 'leg'
  if (!st.mastCuts) return 'mast'
  if (!st.rearCuts) return 'rear'
  return !st.slots.some(([a]) => a < g.brBottom) ? 'tray' : !st.slots.some(([a]) => a >= g.brBottom) ? 'clamp' : null
}
const bedOK = (p: Record<string, number>, c: Common) => { const g = easelGeom(p, c); return !sizeErrors(p, c, false).length && !bedProblem(g, easelStrips(g)) }
/** the least bed length (10 mm steps, from `from` up to the field's maximum) at which the whole easel can be cut; 0 if none */
function bedFix(p: Record<string, number>, c: Common, from: number) {
  for (let m = up(from, 10); m <= 3000; m += 10) if (bedOK({ ...p, maxL: m }, c)) return m
  return 0
}

/**
 * The sizes that cannot work, as [kind, message]. With `deep` each message names the values to set: inside their
 * fields' ranges and tried, so that each clears its problem without bringing in another (when some value does).
 */
function sizeErrors(p: Record<string, number>, c: Common, deep: boolean): [string, string][] {
  const g = easelGeom(p, c)
  const { t, w, bolt, spread, top, hU, hL, L, Lm, Lt, maxL, sw, phi, Hf } = g
  const out: [string, string][] = []
  const before = deep ? sizeErrors(p, c, false).map(e => e[0]) : []
  let kind = ''
  type S = { text: string; clean: boolean } | null
  /** a change to suggest: null when outside the field's range or when it does not clear the problem */
  const tryIt = (patch: Record<string, number>, text: string, bed = false): S => {
    for (const [k, v] of Object.entries(patch)) { const def = PARAMS.find(q => q.key === k)!; if (v < def.min - 1e-9 || v > def.max + 1e-9) return null }
    const after = sizeErrors({ ...p, ...patch }, c, false).map(e => e[0])
    if (after.includes(kind)) return null
    const clean = after.every(k => before.includes(k)) && (!bed || after.length > 0 || bedOK({ ...p, ...patch }, c))
    return { text, clean }
  }
  const sug = (key: string, v: number, more: boolean): S => tryIt({ [key]: v }, `${lab(key)} ${f1(v)} مم أو ${more ? 'أكثر' : 'أقلّ'}`)
  /** the least bed length from v (10 mm steps) that clears the problem and lets every strip be cut */
  const bedSug = (v: number): S => {
    let loose: S = null
    for (let m = up(v, 10); m <= 3000; m += 10) { const r = tryIt({ maxL: m }, `${lab('maxL')} ${m} مم أو أكثر`, true); if (r?.clean) return r; loose = loose ?? r }
    return loose
  }
  /** the clean suggestions if there are any, else the ones that at least clear this problem */
  const pick = (...ss: S[]) => { const ok = ss.filter((x): x is { text: string; clean: boolean } => !!x), cl = ok.filter(x => x.clean); return make(...(cl.length ? cl : ok).map(x => x.text)) }
  const add = (k: string, text: () => string) => { kind = k; out.push([k, deep ? text() : '']) }
  if ((w - sw) / 2 < 0.4 * w - 1e-9) add('web', () => `مجرى الصاري (${f1(sw)} مم لبرغي ${bolt} مم) يترك ${f1((w - sw) / 2)} مم فقط من كلّ جانب في ${lab('w')} ${f1(w)} مم، أقلّ من خُمسَي عرضها: ${pick(sug('w', up(5 * sw, 0.5), true), sug('bolt', Math.floor(w / 5 - 0.5), false))}`)
  const sinMax = Math.sin(20 * DEG)
  if (top >= spread - 1e-9) add('order', () => `${lab('top')} (${top} مم) يجب أن تكون أصغر من ${lab('spread')} (${spread} مم): ${pick(sug('top', dn(spread - 50), false), sug('spread', up(top + 300), true))}`)
  else if ((spread - top) / 2 > L * sinMax) add('splay', () => `الرجلان منفرجتان أكثر من 20°: ${pick(sug('spread', dn(top + 2 * L * sinMax), false), sug('top', up(spread - 2 * L * sinMax), true), sug('L', up((spread - top) / 2 / sinMax), true))}`)
  else if (top < topMinOf(g) - 1e-9) add('narrow', () => {
    // the narrowest stance (5 mm steps) at which the legs clear the mast and the bracket, without splaying past 20°
    let s2 = up(spread)
    while (s2 <= 1400 && !((s2 - top) / 2 <= L * sinMax && top >= topMinOf(easelGeom({ ...p, spread: s2 }, c)))) s2 += 5
    return `الرجلان قريبتان من الصاري ومن براغي المفصل في الأعلى: ${pick(sug('top', topMinOf(g), true), s2 <= 1400 ? sug('spread', s2, true) : null)}`
  })
  if (hL < w - 1e-9) add('low', () => `${lab('hL')} ${hL} مم قريب جداً من الأرض: ${pick(sug('hL', up(w), true))}`)
  // (with the legs out of shape their height means nothing: that error comes first)
  if (!out.some(e => e[0] === 'order' || e[0] === 'splay') && hU > Hf - w + 1e-9) add('high', () => `العارضة العلوية (${hU} مم) عند رأسي الرجلين أو فوقهما: ${pick(sug('hU', dn(Hf - w), false), sug('L', up((hU + w) / Math.cos(phi)), true))}`)
  const need = Math.max(100, g.s0 - hL + (hU - g.s1) + 50)
  if (hU - hL < need - 1e-9) add('gap', () => {
    const gap = hU > hL ? `بين العارضتين ${f0(hU - hL)} مم فقط` : `${lab('hL')} (${hL} مم) ليس أقلّ من ${lab('hU')} (${hU} مم)`
    const L2 = up((hL + need + w) / Math.cos(phi)), hU2 = up(hL + need)
    return `${gap}، ويلزم بينهما ${f0(need)} مم لمفصل الرجل الخلفية ومجرى الرفّ: ${pick(sug('hU', hU2, true), sug('hL', dn(hU - need), false), tryIt({ L: L2, hU: hU2 }, `${lab('L')} ${L2} مم مع ${lab('hU')} ${hU2} مم`))}`
  })
  const LmMin = up(g.u0 + 100 + w / 2 + g.rs)
  if (Lm < LmMin - 1e-9) add('mast', () => `الصاري قصير: لا يبقى فوق العارضة العلوية مجرى للمشبك العلوي. ${pick(sug('Lm', LmMin, true), sug('hU', dn(hU - (LmMin - Lm)), false))}`)
  if (Lt > maxL + 1e-9) add('trayBed', () => `الرفّ (${Lt} مم) أطول من سرير الليزر (${maxL} مم): ${pick(sug('Lt', dn(maxL), false), bedSug(Lt))}`)
  const LtMin = up(g.Wp + 4 * t + 30)
  if (Lt < LtMin - 1e-9) add('trayMin', () => `الرفّ (${Lt} مم) أقصر من الحضن حول الصاري وطرفيه: ${pick(sug('Lt', LtMin, true))}`)
  for (const [key, nm] of [['LcL', NAME.barL], ['LcU', NAME.barU]] as const) {
    const Lc = g[key]
    if (Lc > maxL + 1e-9) add(key, () => {
      // the widest stance (5 mm steps, legs still closer at the top than at the feet) whose crossbar fits the bed
      let s2 = dn(spread)
      while (s2 > top + 5 && easelGeom({ ...p, spread: s2 }, c)[key] > maxL + 1e-9) s2 -= 5
      return `${nm} طولها ${f0(Lc)} مم، أطول من سرير الليزر (${maxL} مم): ${pick(bedSug(Lc), s2 > top + 5 ? sug('spread', s2, false) : null)}`
    })
  }
  return out
}

/** the least distance between the legs at the top: clear of the mast, and at the upper crossbar of the bracket's bolts */
function topMinOf(g: EaselGeom) {
  const cp = Math.cos(g.phi), q = g.sx + g.head + 2 + g.w / (2 * cp)
  return up(Math.max(g.w / cp + g.w + 10, g.hU > 0 ? g.spread - (g.spread / 2 - q) * (2 * g.Hf) / g.hU : 0))
}

function build(p: Record<string, number>, c: Common): BuildResult {
  const g = easelGeom(p, c)
  const { t, w, bolt, spread, top, hU, hL, L, Lm, Lt, d, lip, maxL, fit, layers, Tl, hr, sw, phi } = g
  const errors: string[] = [], warnings: string[] = []
  const nn = Math.max(1, Math.round(p.n))
  // ---- sizes that cannot work, then strips that cannot be cut on the bed
  const size = sizeErrors(p, c, true)
  if (size.length) return { panels: [], notes: [], warnings, errors: size.map(e => e[1]), slotted: true }
  const st = easelStrips(g)
  const bad = bedProblem(g, st)
  if (bad) {
    const m2 = bedFix(p, c, maxL + 10), two = layers === 1 && bedOK({ ...p, layers: 2 }, c)
    const fix = make(m2 ? `${lab('maxL')} ${m2} مم أو أكثر` : '', two ? `${lab('layers')} 2` : '')
    if (bad === 'tray' || bad === 'clamp') errors.push(`ألواح الوصل على الفواصل (طبقة واحدة) لا تترك مجرى ${bad === 'clamp' ? 'للمشبك العلوي' : 'للرفّ'}: ${fix}`)
    else errors.push(`لا يمكن قسم ${NAME[bad]} (${f0(stripLen(st[bad]))} مم) إلى قطعتين على سرير ${maxL} مم${layers > 1 ? ' مع فواصل متباعدة 150 مم بين الطبقات' : ' مع لوحي الوصل'}: ${fix}`)
    return { panels: [], notes: [], warnings, errors, slotted: true }
  }
  const traySlots = st.slots.filter(([a]) => a < g.brBottom), clampSlots = st.slots.filter(([a]) => a >= g.brBottom)
  if (layers === 1 && t < 5) warnings.push(`شريحة من طبقة واحدة ${t} مم لينة جداً لحامل بهذا الطول وتلتوي تحت اللوحة: اجعل «عدد الطبقات» 2 أو 3.`)
  // ---- the pieces
  const panels: PanelSpec[] = []
  const stackNote = layers > 1 ? `؛ ${layers} طبقات تُلصق فوق بعض` : ''
  const addStrip = (id: string, name: string, s: Strip, cuts: number[], mult: number, note: string) => {
    const S = stripLen(s)
    if (!cuts.length) {
      const lp = stripPiece(s, null, null, hr, sw)
      panels.push({ id, name, w: S, h: w, shape: [lp[0]], holes: lp.slice(1), count: layers * mult * nn, note: note + (layers > 1 ? `؛ تُقصّ ${layers} مرّات وتُلصق فوق بعض` : '') })
      return
    }
    cuts.forEach((cx, i) => {
      const lyr = layers > 1 ? `الطبقة ${i + 1}، ` : ''
      const a = stripPiece(s, null, cx, hr, sw), b = stripPiece(s, cx, null, hr, sw)
      const where = layers > 1 ? `الفاصل على ${f0(cx)} مم من الطرف السفلي${stackNote}` : `الفاصل على ${f0(cx)} مم ويغطّيه لوحا وصل`
      panels.push({ id: `${id}-${i + 1}a`, name: `${name} — ${lyr}القطعة السفلية`, w: cx, h: w, shape: [a[0]], holes: a.slice(1), count: mult * nn, note: `${note}؛ ${where}` })
      panels.push({ id: `${id}-${i + 1}b`, name: `${name} — ${lyr}القطعة العلوية`, w: S - cx, h: w, shape: [b[0]], holes: b.slice(1), count: mult * nn, note: `${note}؛ ${where}` })
    })
    if (layers === 1) {
      const rr = Math.min(3, w / 8)
      panels.push({
        id: `${id}-splice`, name: `لوح وصل ${name}`, w: g.Ls, h: w, count: 2 * mult * nn,
        holes: [circle(g.Ls / 4, w / 2, hr), circle((3 * g.Ls) / 4, w / 2, hr)],
        post: loops => { for (const [x, y] of [[0, 0], [g.Ls, 0], [g.Ls, w], [0, w]]) roundCorner(loops, x, y, rr) },
        note: 'اثنان لكلّ فاصل: واحد من كلّ وجه، يُلصقان ويُشدّان ببرغيين',
      })
    }
  }
  addStrip('leg', NAME.leg, st.leg, st.legCuts!, 2, `اثنتان؛ القدم والرأس مقصوصان بزاوية ${f1(phi / DEG)}° ليستويا مع الأرض`)
  addStrip('mast', NAME.mast, st.mast, st.mastCuts!, 1, 'يقف على الأرض؛ فيه مجرى الرفّ ومجرى المشبك العلوي')
  addStrip('barU', NAME.barU, st.barU, [], 1, 'خلف الرجلين والصاري؛ ثقبان للرجلين وثلاثة للصاري ولوح المفصل')
  addStrip('barL', NAME.barL, st.barL, [], 1, 'خلف الرجلين والصاري')
  addStrip('rear', NAME.rear, st.rear, st.rearCuts!, 1, `رأسها مستدير حول ثقب المفصل، وقدمها مقصوصة بزاوية ${f1(g.gamma / DEG)}°`)
  // hinge bracket: a plate behind the upper crossbar and two cheeks tabbed into it
  const y0 = w + 2, tabYs = [y0 + g.Hch / 8, y0 + (5 * g.Hch) / 8], cxp = g.Wbp / 2
  panels.push({
    id: 'br-plate', name: 'لوح مفصل الرجل الخلفية', w: g.Wbp, h: g.Hbp, count: nn,
    holes: [
      ...[-g.sx, 0, g.sx].map(x => circle(cxp + x, w / 2, hr)),
      ...[-1, 1].flatMap(sg => tabYs.map(y => roundedRectHole(cxp + sg * g.xs - (t + fit) / 2, y - fit / 2, t + fit, g.chTab + fit, 0))),
    ],
    post: loops => { const r = Math.min(4, w / 8); for (const [x, y] of [[0, 0], [g.Wbp, 0], [g.Wbp, g.Hbp], [0, g.Hbp]]) roundCorner(loops, x, y, r) },
    note: 'يُربط خلف العارضة العلوية بثلاثة براغي؛ الخدّان في شقوقه السفلية',
  })
  const ch = g.Hch
  panels.push({
    id: 'br-cheek', name: 'خدّ المفصل', w: t + g.Dc, h: ch, count: 2 * nn,
    cuts: [rect(0, 0, t, ch / 8), rect(0, ch / 8 + g.chTab, t, ch / 2 - g.chTab), rect(0, (5 * ch) / 8 + g.chTab, t, ch - (5 * ch) / 8 - g.chTab)],
    holes: [circle(t + g.e, ch / 2, hr)],
    post: loops => { const r = 0.6 * (g.Dc - g.e); roundCorner(loops, t + g.Dc, 0, r); roundCorner(loops, t + g.Dc, ch, r) },
    note: 'اثنان؛ لسانان في شقوق لوح المفصل، وبينهما رأس الرجل الخلفية على برغي',
  })
  // tray: shelf with horns round the mast, front lip, two ends, back plate under the shelf on the slot's bolt
  const cx = Lt / 2
  panels.push({
    id: 'tray-shelf', name: 'رفّ الحامل', w: Lt, h: d, bottom: 'male', left: 'male', right: 'male', count: nn,
    adds: [rect(cx - g.Wp / 2, -g.m, g.Wp, g.m)], cuts: [rect(cx - g.nw / 2, -g.m, g.nw, g.m)],
    holes: [-1, 1].map(sg => roundedRectHole(sg < 0 ? cx - g.tabB - fit / 2 : cx + g.tabA - fit / 2, -fit / 2, g.tabB - g.tabA + fit, t + fit, 0)),
    note: 'القرنان في الخلف يحضنان جانبي الصاري؛ ألسنة الظهر في الشقّين أمامهما',
  })
  panels.push({ id: 'tray-lip', name: 'حافّة الرفّ', w: Lt, h: lip + t, bottom: 'female', left: 'male', right: 'male', count: nn, note: 'تقف على الحافّة الأمامية للرفّ' })
  panels.push({ id: 'tray-end', name: 'طرف الرفّ', w: d, h: lip + t, bottom: 'female', right: 'female', count: 2 * nn, note: 'اثنان، عند طرفي الرفّ' })
  panels.push({
    id: 'tray-back', name: 'ظهر الرفّ (مريلة)', w: g.Wb, h: t + g.Hb, count: nn,
    cuts: [rect(0, 0, g.Wb / 2 - g.tabB, t), rect(g.Wb / 2 - g.tabA, 0, 2 * g.tabA, t), rect(g.Wb / 2 + g.tabB, 0, g.Wb / 2 - g.tabB, t)],
    holes: [circle(g.Wb / 2, t + g.yb, hr)],
    post: loops => { const r = Math.min(6, g.Hb / 4); roundCorner(loops, 0, t + g.Hb, r); roundCorner(loops, g.Wb, t + g.Hb, r) },
    note: 'يتعلّق تحت الحافّة الخلفية للرفّ بطوله، أمام الرجلين والصاري؛ برغيه في الوسط يمرّ في مجرى الصاري',
  })
  // top clamp
  panels.push({
    id: 'clamp-plate', name: 'لوح المشبك العلوي', w: g.Wc, h: g.Hc, bottom: 'female', count: nn,
    holes: [circle(g.Wc / 2, (g.Hc - t) / 2, hr)],
    post: loops => { const r = g.Hc / 3; roundCorner(loops, 0, 0, r); roundCorner(loops, g.Wc, 0, r) },
    note: 'أمام الصاري فوق اللوحة؛ برغيه في المجرى العلوي',
  })
  panels.push({
    id: 'clamp-lip', name: 'شفة المشبك', w: g.Wc, h: d, top: 'male', count: nn,
    post: loops => { const r = Math.min(6, d / 4); roundCorner(loops, 0, d, r); roundCorner(loops, g.Wc, d, r) },
    note: 'تنزل على الحافّة العليا للوحة',
  })
  // ---- notes
  const Lb = (stack: number) => up(stack + 15, 5)
  const joints = (st.legCuts!.length ? 2 : 0) + (st.mastCuts!.length ? 1 : 0) + (st.rearCuts!.length ? 1 : 0)
  const bolts: [number, number, string][] = [
    [4, Lb(2 * Tl), 'الرجلان مع العارضتين'],
    [1, Lb(2 * Tl), 'الصاري مع العارضة السفلية'],
    [1, Lb(2 * Tl + t), 'الصاري مع العارضة العلوية ولوح المفصل'],
    [2, Lb(Tl + t), 'لوح المفصل مع العارضة العلوية'],
    [1, Lb(Tl + 2 * t + 1), 'المفصل: الخدّان ورأس الرجل الخلفية'],
    [1, Lb(Tl + t), 'الرفّ في مجرى الصاري'],
    [1, Lb(Tl + t), 'المشبك العلوي في مجرى الصاري'],
    ...(layers === 1 && joints ? [[2 * joints, Lb(3 * t), 'ألواح الوصل'] as [number, number, string]] : []),
  ]
  const total = bolts.reduce((s, b) => s + b[0], 0) * nn
  const byLen = new Map<number, number>()
  for (const [n, len] of bolts) byLen.set(len, (byLen.get(len) ?? 0) + n * nn)
  const shelfLo = Math.min(...traySlots.map(s => s[0])) + g.yb + t, shelfHi = Math.max(...traySlots.map(s => s[1])) + g.yb + t
  // with one layer a splice plate can split a slot in two: say where the tray (or the clamp) can go
  const ranges = (sl: [number, number][], off: number) => sl.length > 1 ? ` (${sl.length === 2 ? 'في مقطعين يفصلهما لوح وصل' : `في ${sl.length} مقاطع تفصلها ألواح وصل`}: ${sl.map(([a, b]) => `${f0(a + off)}–${f0(b + off)}`).join('، ')} مم؛ لنقله من مقطع إلى آخر أخرج البرغي وأدخله في المقطع الآخر)` : ''
  const lipLo = Math.min(...clampSlots.map(s => s[0])) - g.hbC, lipHi = Math.max(...clampSlots.map(s => s[1])) - g.hbC
  const cuts = (s: number[]) => s.map(f0).join(' و')
  const splitNote = layers > 1
    ? `الشرائح الأطول من ${maxL} مم مقسومة قطعتين، وفاصل كلّ طبقة في مكان مختلف (الرجل الأمامية عند ${cuts(st.legCuts!) || '—'} مم، الصاري عند ${cuts(st.mastCuts!) || '—'} مم${st.rearCuts!.length ? `، الرجل الخلفية عند ${cuts(st.rearCuts!)} مم` : ''} من الطرف السفلي)، بين كلّ فاصلين 150 مم على الأقلّ، فتغطّي كلّ طبقةٍ فاصلَ الأخرى وتبقى الشريحة الملصوقة قطعة واحدة. رتّب القطع حسب رقم الطبقة: الطبقة 1 بالأسفل، ثم الطبقة 2${layers > 2 ? '، ثم الطبقة 3' : ''} فوقها.`
    : `الشرائح الأطول من ${maxL} مم مقسومة قطعتين: ضع طرفيهما متلاصقين على سطح مستوٍ، والصق لوحي وصل (${f0(g.Ls)} × ${f0(w)} مم) على الوجهين فوق الفاصل، وشدّهما ببرغيين في الثقبين على جانبي الفاصل.`
  const notes = [
    `الحامل: رجلان أماميتان ${f0(L)} مم منفرجتان ${f1(phi / DEG)}° (${f0(spread)} مم بين القدمين و${f0(top)} مم في الأعلى)، وصارٍ ${f0(Lm)} مم يقف على الأرض بينهما، وعارضتان خلفهما على ارتفاع ${f0(hL)} و${f0(hU)} مم (${f0(g.LcL)} و${f0(g.LcU)} مم طولاً)، ورجل خلفية ${f0(stripLen(st.rear))} مم تتعلّق بمفصل خلف العارضة العلوية. الارتفاعات مقاسة على طول الواجهة من الأرض.`,
    layers > 1
      ? `الترقيق: كلّ شريحة طويلة (الرجلان والصاري والعارضتان والرجل الخلفية) تُقصّ ${layers} مرّات وتُلصق وجهاً لوجه فتصير سماكتها ${f1(Tl)} مم. ادهن وجهاً واحداً بطبقة رقيقة من غراء الخشب، أدخل براغي في الثقوب لتطابق الطبقات تماماً، ثم اشدد بملاقط كلّ 15 سم تقريباً أو ضع أثقالاً على سطح مستوٍ، وامسح الغراء من المجاري، واتركها 24 ساعة قبل التجميع.`
      : `طبقة واحدة: الشرائح بسماكة اللوح ${f1(t)} مم فقط؛ للخشب الرقيق الأفضل 2–3 طبقات تُلصق فوق بعض.`,
    ...(joints ? [splitNote] : []),
    `البراغي (${total} برغي M${bolt} برأس مستدير، مع وردة وصامولة فراشة لكلّ برغي): ${bolts.map(([n, len, wh]) => `${n * nn} × ${len} مم (${wh})`).join('، ')}. طول البرغي = سماكة ما يمرّ فيه + 15 مم؛ للشراء: ${[...byLen.entries()].sort((a, b) => a[0] - b[0]).map(([len, n]) => `${n} بطول ${len}`).join('، ')}.`,
    `التجميع: (1) ضع الرجلين والصاري على الأرض ووجهها الأمامي للأسفل، وأطرافها السفلية على خطّ واحد. (2) ضع العارضتين فوقها (أي خلفها) واربط كلّ تقاطع ببرغي، الرأس المستدير من الأمام والصامولة من الخلف، وقِس القطرين لتتأكّد أن الإطار مستقيم قبل الشدّ. (3) الصق خدّي المفصل في شقوق لوحه (الألسنة تملأ الشقوق حتى وجهه الآخر)، ثم اربط اللوح خلف العارضة العلوية بثلاثة براغي؛ الأوسط يمرّ في الصاري والعارضة واللوح. (4) أدخل رأس الرجل الخلفية المستدير بين الخدّين واربطه ببرغي المفصل دون شدّ زائد ليدور.`,
    `الرفّ: الصق الحافّة الأمامية والطرفين على الرفّ بتعشيق الأصابع، وأدخل لساني الظهر (المريلة) في الشقّين قرب حافّته الخلفية والصق حافّته العليا بباطن الرفّ على طوله. ضع الرفّ أمام الصاري: القرنان يحضنان جانبيه فلا يدور، وبرغيه يمرّ من الظهر في المجرى السفلي وصامولته الفراشة خلف الصاري. سطح الرفّ يتحرّك بين ${f0(shelfLo)} و${f0(shelfHi)} مم عن الأرض${ranges(traySlots, g.yb + t)}: أرخِ الصامولة، حرّك الرفّ، ثم اشددها.`,
    `المشبك العلوي: الصق الشفة في أسفل لوحه، واربطه في المجرى العلوي؛ ينزل على الحافّة العليا للوحة ويمسك لوحات ارتفاعها من ${f0(Math.max(0, lipLo - shelfHi))} إلى ${f0(lipHi - shelfLo)} مم وسماكتها حتى ${f1(d - t)} مم${ranges(clampSlots, -g.hbC)}.`,
    `الوقوف: افتح الرجل الخلفية حتى ${f0(p.angle)}° عن الواجهة، فتميل الواجهة للخلف ${f1(g.beta / DEG)}° وتقف القدم الخلفية على بعد ${f0(g.rearX)} مم خلف القدمين الأماميتين. أسفل الرجلين الأماميتين والصاري مقصوص عمودياً على الواجهة، فيرتكز على حافّته الخلفية وترتفع الأمامية ${f1(Tl * Math.sin(g.beta))} مم؛ لتستوي على الأرض تماماً اصقله بميل ${f1(g.beta / DEG)}°. اربط حبلاً أو سلسلة قصيرة بين الرجل الخلفية والعارضة السفلية حتى لا تنفرج أكثر، وعند النقل اطوِ الرجل الخلفية على الصاري.`,
    `لوحة الترحيب: تصميم «لوحة ترحيب بقدمين» في التطبيق يقف على هذا الرفّ بلا قدميه: ضع حافّته السفلية على الرفّ خلف الحافّة الأمامية واسنده إلى الصاري، ثم أنزل المشبك العلوي عليه واشدده. يتّسع الحامل للوحات حتى ${f0(lipHi - shelfLo)} مم ارتفاعاً، وعرض الرفّ ${f0(Lt)} مم (اللوحة الأعرض منه تبرز عن طرفيه بلا مشكلة).`,
  ]
  return { panels, notes, warnings, errors, slotted: true }
}

export const EASELS: Template[] = [
  {
    id: 'easel',
    name: 'حامل لوحات ثلاثي القوائم (إيزل)',
    desc: 'حامل لوحات خشبي كالذي في الصورة: رجلان أماميتان منفرجتان وصارٍ في الوسط فيه مجرى، عارضتان تُربطان بالبراغي، رجل خلفية على مفصل، ورفّ يتحرّك على الصاري بصامولة فراشة ومشبك علوي يمسك اللوحة. كلّه شرائح تُقصّ من اللوح وتُلصق طبقتين أو ثلاثاً، والشرائح الأطول من سرير الليزر تُقسم بفواصل متبادلة. يحمل «لوحة الترحيب» ولوحات الرسم.',
    icon: `<path d="M17 10h30v25H17z"/><path d="M27 6h10v4H27zM32 2v4" stroke-width="1.8"/><path d="M11 35h42v4H11z"/><path d="M24 39l-11 22M40 39l11 22M32 39v22" stroke-width="2.8"/><path d="M15 53h34"/><path d="M23 19h18M23 24h18M27 29h10" stroke-width="1.3"/>`,
    params: PARAMS,
    defaults: DEFAULTS,
    innerAdd: () => ({ W: 0, D: 0, H: 0 }),
    build,
  },
]

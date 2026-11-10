// Saved full-sheet layouts ("presets"): arrangements built by hand or by long lattice searches for the designs people
// cut most, each checked independently, that beat what the nesting finds in two seconds (81 ring boxes on a sheet
// where the nesting finds 71, 233 mirror frame sets where it finds 188). fillsheet.ts uses one when it fits the
// design and verifies it again first.
//
// A preset is matched by GEOMETRY, never by the template's name or numbers: it applies when the design's pieces of
// that material have, in generate() order, the same outer outlines (kerf included) and copies per set as the ones it
// was made for (a preset of one panel is a sheet of so many identical pieces: any copies per set divide it, see
// presetCounts). What lies inside an outline (a hole, engraved names) does not matter to the match; the exact check
// that follows (nest.ts checkSheet, on the design's real pieces) decides. Anything else (another size, another
// kerf, a thicker sheet's longer tabs) falls back to the nesting, and so does a preset whose data cannot be read.
//
// Every piece is stored as: which panel (its index among that material's panels, generate() order), a turn by any
// angle (degrees, clockwise on screen as rotatePanel's quarter turns: hearts turn in 45° steps) and a translation:
// the piece's points are R(deg)·p + (tx, ty), p in the panel's own coordinates. Placements are packed compactly
// (encodePieces): coordinates in µm, runs of evenly spaced pieces (a lattice row) as a start, a count and a step.
import { Panel } from './joints'
import { Loop, bbox, signedArea, loopLength, turnLoops } from './geom'
import { checkSheet, sampleLoop, CheckOpts } from './nest'
import { Layout, Placed } from './layout'
import { PRESETS } from './sheetpresets-data'

export interface SheetPreset {
  /** a stable name, e.g. 'hexringbox-mirror-233' */
  id: string
  /** the sheet it is made for, mm */
  sheet: [number, number]
  /** the margin and the spacing it keeps, mm: it is valid for these or smaller ones */
  margin: number
  spacing: number
  /**
   * a piece lying wholly inside another's hole may be this close to that piece (mm); everything else keeps the spacing.
   * Only used when the design's own pieces need it: holes wider than the preset was made with (the ring box's lid frames
   * at a narrower frame width b) keep the full spacing, and then the preset is a plain one (bestPreset)
   */
  holeGap?: number
  /** complete sets (of the copies per set in sig) */
  sets: number
  /** loose pieces beyond the sets, per panel index (the comb: 21 more combs beyond 16 sets of 24) */
  extra?: number[]
  /** what one loose piece is called, for the count shown («مشط») */
  unit?: string
  /** per panel (generate() order within the material): its outer outline's signature, see outlineSig */
  sig: number[][]
  /** the pieces, packed by encodePieces */
  pieces: string
  /** one line shown with the result */
  hint?: string
}

/** one piece of a preset: panel index, turn (degrees), translation (mm) */
export type PresetPiece = [number, number, number, number]

// ---------------------------------------------------------------- the outlines' signature

/** the closed cut loop with the largest area: the panel's outer outline */
function outerOf(p: Panel): Loop | undefined {
  let best: Loop | undefined, area = -1
  for (const l of p.loops) {
    if (!l.closed || l.layer === 'engrave' || l.pts.length < 2) continue
    const a = Math.abs(signedArea(l))
    if (a > area) { area = a; best = l }
  }
  return best
}

const r3 = (v: number) => Math.round(v * 1000) / 1000
/**
 * Per panel: [copies per set, the outline's vertices, its width, height, area, length, and its centroid from its box's
 * corner], mm, rounded to 0.001. The outer outline only: holes and engraving inside it are not part of the match.
 */
export function outlineSig(panels: Panel[]): number[][] {
  return panels.map(p => {
    const o = outerOf(p)
    if (!o) return [p.count, 0, r3(p.w), r3(p.h), 0, 0, 0, 0]
    const b = bbox([o]), poly = sampleLoop(o, 0.01)
    let a2 = 0, cx = 0, cy = 0
    for (let i = 0, n = poly.length / 2; i < n; i++) {
      const j = (i + 1) % n, x0 = poly[2 * i], y0 = poly[2 * i + 1], x1 = poly[2 * j], y1 = poly[2 * j + 1], c = x0 * y1 - x1 * y0
      a2 += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
    }
    const cxr = a2 ? cx / (3 * a2) - b.minX : 0, cyr = a2 ? cy / (3 * a2) - b.minY : 0
    return [p.count, o.pts.length, r3(b.maxX - b.minX), r3(b.maxY - b.minY), r3(signedArea(o)), r3(loopLength(o)), r3(cxr), r3(cyr)]
  })
}

/**
 * The same outlines, within what rounding and another device's arithmetic allow (0.003 mm; the area 0.05 mm²), and the
 * same copies per set unless anyCount
 */
export function sigMatches(a: number[][], b: number[][], anyCount = false): boolean {
  if (a.length !== b.length) return false
  const tol = [0, 0, 0.003, 0.003, 0.05, 0.005, 0.003, 0.003]
  return a.every((u, i) => u.length === b[i].length && u.every((v, k) => (anyCount && k === 0) || Math.abs(v - b[i][k]) <= tol[k]))
}

// ---------------------------------------------------------------- packing the placements

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
/** zigzag varint, 5 bits a character, the sixth bit says more follows */
function put(out: string[], v: number) {
  let u = v < 0 ? -2 * v - 1 : 2 * v
  while (u >= 32) { out.push(ABC[(u % 32) + 32]); u = Math.floor(u / 32) }
  out.push(ABC[u])
}
function reader(s: string) {
  let i = 0
  return {
    more: () => i < s.length,
    next(): number {
      let u = 0, mul = 1
      for (;;) {
        const c = i < s.length ? ABC.indexOf(s[i++]) : -1
        if (c < 0) throw new Error('preset: bad data')
        u += (c % 32) * mul
        if (c < 32) break
        mul *= 32
        // no number in a preset needs more than 45 bits
        if (mul > 2 ** 45) throw new Error('preset: bad data')
      }
      return u % 2 ? -(u + 1) / 2 : u / 2
    },
  }
}

/** position k of a run that starts at x0 (µm) and steps D nanometres a piece */
const at = (x0: number, D: number, k: number) => x0 + Math.round((k * D) / 1000)

/** the longest run from i on whose positions one step in nanometres reproduces exactly, and that step */
function runFrom(pts: [number, number][], i: number): { n: number; dx: number; dy: number } {
  const [x0, y0] = pts[i]
  let lo = [-Infinity, -Infinity], hi = [Infinity, Infinity], best = { n: 1, dx: 0, dy: 0 }
  for (let j = i + 1; j < pts.length; j++) {
    const k = j - i, e = [pts[j][0] - x0, pts[j][1] - y0]
    const nlo = [0, 1].map(c => Math.max(lo[c], ((e[c] - 0.5) * 1000) / k)), nhi = [0, 1].map(c => Math.min(hi[c], ((e[c] + 0.5) * 1000) / k))
    // an integer step well inside the window (away from its rounding edges)
    const D = [0, 1].map(c => Math.round((nlo[c] + nhi[c]) / 2))
    if (D.some((v, c) => !(v > nlo[c] && v < nhi[c]))) break
    let ok = true
    for (let m = 1; m <= k && ok; m++) ok = at(x0, D[0], m) === pts[i + m][0] && at(y0, D[1], m) === pts[i + m][1]
    if (!ok) break
    lo = nlo; hi = nhi; best = { n: k + 1, dx: D[0], dy: D[1] }
  }
  return best
}

/** Packs placements (panel, turn in degrees to 0.001, translation in mm to 0.001) into a short string. */
export function encodePieces(pieces: PresetPiece[]): string {
  const groups = new Map<string, [number, number][]>()
  for (const [p, deg, x, y] of pieces) {
    const key = `${p}:${Math.round((((deg % 360) + 360) % 360) * 1000)}`
    groups.set(key, [...(groups.get(key) ?? []), [Math.round(x * 1000), Math.round(y * 1000)]])
  }
  const out: string[] = []
  put(out, groups.size)
  for (const [key, list] of groups) {
    const [p, mdeg] = key.split(':').map(Number)
    // rows (by y, then x) or columns (by x, then y): whichever packs shorter
    const pack = (sorted: [number, number][]) => {
      const o: string[] = []
      const runs: { s: [number, number]; n: number; dx: number; dy: number }[] = []
      for (let i = 0; i < sorted.length;) { const r = runFrom(sorted, i); runs.push({ s: sorted[i], ...r }); i += r.n }
      put(o, runs.length)
      let px = 0, py = 0
      for (const r of runs) {
        put(o, r.n); put(o, r.s[0] - px); put(o, r.s[1] - py); px = r.s[0]; py = r.s[1]
        if (r.n > 1) { put(o, r.dx); put(o, r.dy) }
      }
      return o.join('')
    }
    const a = pack([...list].sort((u, v) => u[1] - v[1] || u[0] - v[0])), b = pack([...list].sort((u, v) => u[0] - v[0] || u[1] - v[1]))
    put(out, p); put(out, mdeg)
    out.push(a.length <= b.length ? a : b)
  }
  return out.join('')
}

/** the most pieces one preset may hold (a sheet of 1 mm² pieces would not reach it) */
const MAX_PIECES = 200000

/** The placements back from encodePieces' string. Throws on data it cannot read (callers use decoded, which does not). */
export function decodePieces(s: string): PresetPiece[] {
  const r = reader(s), out: PresetPiece[] = []
  for (let g = r.next(); g > 0; g--) {
    const p = r.next(), deg = r.next() / 1000
    if (p < 0) throw new Error('preset: bad data')
    let px = 0, py = 0
    for (let runs = r.next(); runs > 0; runs--) {
      const n = r.next(), x0 = px + r.next(), y0 = py + r.next()
      if (n < 1 || out.length + n > MAX_PIECES) throw new Error('preset: bad data')
      px = x0; py = y0
      const dx = n > 1 ? r.next() : 0, dy = n > 1 ? r.next() : 0
      for (let k = 0; k < n; k++) out.push([p, deg, at(x0, dx, k) / 1000, at(y0, dy, k) / 1000])
    }
  }
  if (r.more()) throw new Error('preset: data left over')
  return out
}

// ---------------------------------------------------------------- a preset on the design's own pieces

/** the panel turned by deg, its outline box moved to (0, 0); off: where that box's corner was before the move */
export function turnPanel(p: Panel, deg: number): { panel: Panel; off: { x: number; y: number } } {
  const loops = turnLoops(p.loops, deg)
  const closed = loops.filter(l => l.closed && l.layer !== 'engrave' && l.pts.length > 1)
  const b = bbox(closed.length ? closed : loops)
  if (b.minX === 0 && b.minY === 0 && loops === p.loops) return { panel: p, off: { x: 0, y: 0 } }
  return { panel: { ...p, loops: loops.map(l => ({ ...l, pts: l.pts.map(v => ({ ...v, x: v.x - b.minX, y: v.y - b.minY })) })), w: b.maxX - b.minX, h: b.maxY - b.minY }, off: { x: b.minX, y: b.minY } }
}

export interface PresetFit {
  preset: SheetPreset
  /** the one sheet: every piece on it, at (0, 0) */
  layout: Layout
  /** complete sets of these panels (presetCounts) */
  sets: number
  /** loose pieces beyond the sets (all panels) */
  extra: number
  /**
   * set only when the layout needs its preset's holeGap on these pieces (some piece in a hole is closer than the
   * spacing): the least distance measured there, mm (the ring box's frames at b = 5: 2.632)
   */
  holeGap?: number
}

/** the pieces a preset gives in all (sets × the set's pieces + the loose ones) */
const total = (pr: SheetPreset) => pr.sig.reduce((a, s) => a + s[0] * pr.sets, 0) + (pr.extra ?? []).reduce((a, b) => a + b, 0)

/**
 * The complete sets and the loose pieces (per panel) a preset gives these panels. A preset of one panel is a sheet of
 * so many identical pieces, whatever the copies per set: the comb's 405 are 405 single combs, 81 sets of 5, or 16 sets
 * of 24 and 21 loose ones. Any other preset gives its own sets and loose pieces (made for its copies per set).
 */
export function presetCounts(pr: SheetPreset, mine: Panel[]): { sets: number; extra: number[] } {
  if (pr.sig.length === 1 && mine.length === 1) {
    const all = total(pr), n = mine[0].count
    if (!Number.isInteger(all) || !Number.isInteger(n) || n < 1) return { sets: 0, extra: [0] }
    return { sets: Math.floor(all / n), extra: [all % n] }
  }
  return { sets: pr.sets, extra: mine.map((_, i) => pr.extra?.[i] ?? 0) }
}

/** all the pieces a preset places, of the design's own panels, or null when its counts do not fit the panels or its data cannot be read */
export function placePreset(pr: SheetPreset, mine: Panel[], list: PresetPiece[] | null = decoded(pr)): Layout | null {
  if (!list) return null
  const turned = new Map<string, ReturnType<typeof turnPanel>>()
  const copies = mine.map(() => 0)
  const placed: Placed[] = []
  for (const [i, deg, tx, ty] of list) {
    const src = mine[i]
    if (!src) return null
    const key = `${i}:${deg}`
    let t = turned.get(key)
    if (!t) { t = turnPanel(src, deg); turned.set(key, t) }
    placed.push({ panel: t.panel, x: tx + t.off.x, y: ty + t.off.y, copy: copies[i]++, sheet: 0, rot: deg })
  }
  const { sets, extra } = presetCounts(pr, mine)
  if (!(sets >= 1) || mine.some((p, i) => copies[i] !== p.count * sets + extra[i])) return null
  const [w, h] = pr.sheet, material = mine[0]?.material
  const used = { w: Math.max(0, ...placed.map(pl => pl.x + pl.panel.w)), h: Math.max(0, ...placed.map(pl => pl.y + pl.panel.h)) }
  return { placed, w, h, sheets: [{ x: 0, y: 0, w, h, ...(material ? { material } : {}), used }], tooBig: [], turned: placed.filter(pl => pl.rot).length }
}

const DECODED = new Map<string, PresetPiece[] | null>()
/** a preset's placements, or null when its data cannot be read (that preset is skipped: the nesting instead) */
function decoded(pr: SheetPreset): PresetPiece[] | null {
  const key = `${pr.id}\n${pr.pieces}`
  if (!DECODED.has(key)) {
    let d: PresetPiece[] | null = null
    try { d = decodePieces(pr.pieces) } catch { d = null }
    DECODED.set(key, d)
  }
  return DECODED.get(key) ?? null
}

/** What a fill may accept from a preset beyond the margin and spacing it is asked for. */
export interface PresetOpts {
  margin: number
  spacing: number
  /**
   * false (turning off): only presets that turn nothing, or half turn some pieces: a half turn keeps the wood's grain
   * on its axis, which is what turning off is for (the comb's teeth along the grain); the fill says so with the result
   */
  rotate?: boolean
  /** false: the spacing everywhere, also in the holes (no preset that needs its holeGap on these pieces) */
  holeGap?: boolean
}

/**
 * The presets made for these pieces (one material's panels, generate() order) on this sheet, most sets first: same
 * sheet, a margin and spacing no larger than the preset keeps, the same outer outlines, data that can be read, at
 * least one set; with turning off only half turns (PresetOpts.rotate). A preset with a holeGap stays a candidate with
 * PresetOpts.holeGap false too: its holes may keep the spacing on these pieces, which only the check can tell (bestPreset).
 */
export function presetsFor(mine: Panel[], sheet: { w: number; h: number }, o: PresetOpts, all: SheetPreset[] = PRESETS): SheetPreset[] {
  const sig = outlineSig(mine)
  return all
    .filter(pr => pr.sheet[0] === sheet.w && pr.sheet[1] === sheet.h && o.margin <= pr.margin + 1e-9 && o.spacing <= pr.spacing + 1e-9 && sigMatches(pr.sig, sig, pr.sig.length === 1))
    .filter(pr => { const list = decoded(pr); return !!list && (o.rotate !== false || list.every(pc => pc[1] === 0 || pc[1] === 180)) })
    .map(pr => ({ pr, n: presetCounts(pr, mine) }))
    .filter(({ n }) => n.sets >= 1)
    .sort((a, b) => b.n.sets - a.n.sets || total(b.pr) - total(a.pr))
    .map(({ pr }) => pr)
}

/**
 * The best preset for these pieces that passes the exact check (nest.ts checkSheet at the given margin and spacing,
 * on the design's real pieces, engraving and holes included), or null. A preset failing the check is dropped.
 *
 * The full spacing everywhere is checked first, holes too. Only when that fails may a preset with a holeGap below the
 * spacing (and PresetOpts.holeGap not false) pass with its pieces in holes that close, and no closer; the fit then
 * carries the gap measured on these pieces. The preset's own number is never taken on trust: the ring box's 233 is made
 * for 2.63 mm in the windows at the frame width b = 5, but its windows are wider at b = 4.5 (3.13 mm), which is the full
 * spacing everywhere: no exception, nothing to say, and the 233 in strict mode too.
 */
export function bestPreset(mine: Panel[], sheet: { w: number; h: number }, o: PresetOpts, all: SheetPreset[] = PRESETS): PresetFit | null {
  for (const pr of presetsFor(mine, sheet, o, all)) {
    const lay = placePreset(pr, mine)
    if (!lay) continue
    const clean = (opts: CheckOpts) => checkSheet(lay.placed, sheet.w, sheet.h, o.spacing, o.margin, undefined, opts).length === 0
    let holeGap: number | undefined
    if (!clean({})) {
      if (o.holeGap === false || pr.holeGap === undefined || !(pr.holeGap < o.spacing)) continue
      const measure = { holeGap: Infinity }
      if (!clean({ holeGap: pr.holeGap, measure }) || !(measure.holeGap < o.spacing)) continue
      holeGap = measure.holeGap
    }
    const { sets, extra } = presetCounts(pr, mine)
    return { preset: pr, layout: lay, sets, extra: extra.reduce((a, b) => a + b, 0), ...(holeGap !== undefined ? { holeGap } : {}) }
  }
  return null
}

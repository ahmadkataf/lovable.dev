// Panels: a rectangle whose edges carry finger joints, plus extra cut-outs and holes.
import { Loop, Rect, rect, unionRects, offsetLoop, bbox } from './geom'

export type EdgeType = 'male' | 'female' | 'flat'
/** A jointed edge; `from`/`len` restrict the finger pattern to part of the edge (measured along +x or +y). */
export interface EdgeSpec { type: EdgeType; from?: number; len?: number }
export type Edge = EdgeType | EdgeSpec

export interface PanelSpec {
  id: string
  name: string
  w: number
  h: number
  top?: Edge
  right?: Edge
  bottom?: Edge
  left?: Edge
  /** when set, these closed loops ARE the outline (a disc, a ring…) and the rectangle/edge machinery is skipped */
  shape?: Loop[]
  /** rectangles added to the panel before the cuts (ears, tabs) */
  adds?: Rect[]
  /** rectangles removed from the panel (slots, steps) */
  cuts?: Rect[]
  /** extra closed loops (holes), open cut paths (living hinges), and surface guide lines */
  holes?: Loop[]
  open?: Loop[]
  engrave?: Loop[]
  /** runs after the outline exists: fillets, edge notches… */
  post?: (loops: Loop[]) => void
  note?: string
  /** how many identical copies to cut */
  count?: number
}

export interface Panel {
  id: string
  name: string
  loops: Loop[]
  w: number
  h: number
  note?: string
  count: number
  /** narrowest finger actually cut on any jointed edge (Infinity when the panel has no joints) */
  minFinger: number
  /** at corners where two male edges meet: how far the wider of the two corner fingers reaches past the
   *  thickness. Below about a millimetre the corner finger hangs on a sliver and breaks off. */
  cornerNeck: number
}

export interface JointOpts { t: number; finger: number }

/** The odd number of fingers (at least 3) whose width comes closest to `target`. */
export function fingerCount(len: number, target: number): number {
  const r = len / Math.max(target, 0.1)
  let lo = Math.floor(r)
  if (lo % 2 === 0) lo -= 1
  lo = Math.max(3, lo)
  const hi = lo + 2
  return Math.abs(len / lo - target) <= Math.abs(len / hi - target) ? lo : hi
}

const norm = (e: Edge | undefined): EdgeSpec => (typeof e === 'string' ? { type: e } : e ?? { type: 'flat' })

/** Rectangles to remove along one edge to form its finger pattern. */
export function edgeCuts(side: 'top' | 'right' | 'bottom' | 'left', e: EdgeSpec, w: number, h: number, o: JointOpts): Rect[] {
  if (e.type === 'flat') return []
  const along = side === 'top' || side === 'bottom' ? w : h
  const from = e.from ?? 0, len = e.len ?? along - from
  if (len <= 0) return []
  const n = fingerCount(len, o.finger), f = len / n
  const cuts: Rect[] = []
  for (let i = 0; i < n; i++) {
    const remove = e.type === 'male' ? i % 2 === 1 : i % 2 === 0
    if (!remove) continue
    const u = from + i * f
    switch (side) {
      case 'top': cuts.push(rect(u, 0, f, o.t)); break
      case 'bottom': cuts.push(rect(u, h - o.t, f, o.t)); break
      case 'left': cuts.push(rect(0, u, o.t, f)); break
      case 'right': cuts.push(rect(w - o.t, u, o.t, f)); break
    }
  }
  return cuts
}

type Side = 'top' | 'right' | 'bottom' | 'left'

/** Width of the fingers actually cut on one edge, and whether the pattern reaches each end of the edge. */
function edgeFinger(side: Side, e: EdgeSpec, w: number, h: number, o: JointOpts) {
  if (e.type === 'flat') return null
  const along = side === 'top' || side === 'bottom' ? w : h
  const from = e.from ?? 0, len = e.len ?? along - from
  if (len <= 0) return null
  return { f: len / fingerCount(len, o.finger), male: e.type === 'male', atStart: from < 1e-6, atEnd: Math.abs(from + len - along) < 1e-6 }
}

function jointReport(s: PanelSpec, o: JointOpts) {
  if (s.shape) return { minFinger: Infinity, cornerNeck: Infinity }
  const E = {
    top: edgeFinger('top', norm(s.top), s.w, s.h, o), right: edgeFinger('right', norm(s.right), s.w, s.h, o),
    bottom: edgeFinger('bottom', norm(s.bottom), s.w, s.h, o), left: edgeFinger('left', norm(s.left), s.w, s.h, o),
  }
  let minFinger = Infinity, cornerNeck = Infinity
  for (const e of Object.values(E)) if (e) minFinger = Math.min(minFinger, e.f)
  // corners in clockwise order: each pairs the end of one edge with the start (or end) of the next
  const corners: [ReturnType<typeof edgeFinger>, boolean, ReturnType<typeof edgeFinger>, boolean][] = [
    [E.top, true, E.left, true], [E.top, false, E.right, true], [E.bottom, false, E.right, false], [E.bottom, true, E.left, false],
  ]
  for (const [a, aStart, b, bStart] of corners) {
    if (!a || !b || !a.male || !b.male) continue
    if (!(aStart ? a.atStart : a.atEnd) || !(bStart ? b.atStart : b.atEnd)) continue
    cornerNeck = Math.min(cornerNeck, Math.max(a.f, b.f) - o.t)
  }
  return { minFinger, cornerNeck }
}

export function buildPanel(s: PanelSpec, o: JointOpts): Panel {
  const cuts: Rect[] = [
    ...edgeCuts('top', norm(s.top), s.w, s.h, o),
    ...edgeCuts('right', norm(s.right), s.w, s.h, o),
    ...edgeCuts('bottom', norm(s.bottom), s.w, s.h, o),
    ...edgeCuts('left', norm(s.left), s.w, s.h, o),
    ...(s.cuts ?? []),
  ]
  const loops = s.shape ? s.shape.map(l => ({ ...l, pts: l.pts.map(v => ({ ...v })) })) : unionRects([rect(0, 0, s.w, s.h), ...(s.adds ?? [])], cuts)
  if (s.post) s.post(loops)
  for (const hl of s.holes ?? []) loops.push(hl)
  for (const op of s.open ?? []) loops.push(op)
  for (const en of s.engrave ?? []) loops.push({ ...en, layer: 'engrave' })
  const bb = bbox(loops)
  return { id: s.id, name: s.name, loops, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY, note: s.note, count: s.count ?? 1, ...jointReport(s, o) }
}

/** Kerf compensation: every closed loop moves half a kerf away from the material. */
export function applyKerf(p: Panel, kerf: number): Panel {
  if (!kerf) return p
  const loops = p.loops.map(l => (l.closed && l.layer !== 'engrave' ? offsetLoop(l, kerf / 2) : l))
  const bb = bbox(loops)
  // keep the panel origin at the original top-left so the layout stays stable
  const shifted = loops.map(l => ({ ...l, pts: l.pts.map(v => ({ ...v, x: v.x - bb.minX, y: v.y - bb.minY })) }))
  return { ...p, loops: shifted, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY }
}

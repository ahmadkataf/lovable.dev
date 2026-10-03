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
  /** rectangles removed from the panel (slots, steps) */
  cuts?: Rect[]
  /** extra closed loops (holes) and open paths (engrave/score lines) */
  holes?: Loop[]
  open?: Loop[]
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
}

export interface JointOpts { t: number; finger: number }

/** Odd number of fingers along an edge of length len, each about `target` wide. */
export function fingerCount(len: number, target: number): number {
  let n = Math.max(1, Math.round(len / Math.max(target, 0.1)))
  if (n % 2 === 0) n += 1
  return Math.max(3, n)
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

export function buildPanel(s: PanelSpec, o: JointOpts): Panel {
  const cuts: Rect[] = [
    ...edgeCuts('top', norm(s.top), s.w, s.h, o),
    ...edgeCuts('right', norm(s.right), s.w, s.h, o),
    ...edgeCuts('bottom', norm(s.bottom), s.w, s.h, o),
    ...edgeCuts('left', norm(s.left), s.w, s.h, o),
    ...(s.cuts ?? []),
  ]
  const loops = unionRects([rect(0, 0, s.w, s.h)], cuts)
  if (s.post) s.post(loops)
  for (const hl of s.holes ?? []) loops.push(hl)
  for (const op of s.open ?? []) loops.push(op)
  const bb = bbox(loops)
  return { id: s.id, name: s.name, loops, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY, note: s.note, count: s.count ?? 1 }
}

/** Kerf compensation: every closed loop moves half a kerf away from the material. */
export function applyKerf(p: Panel, kerf: number): Panel {
  if (!kerf) return p
  const loops = p.loops.map(l => (l.closed ? offsetLoop(l, kerf / 2) : l))
  const bb = bbox(loops)
  // keep the panel origin at the original top-left so the layout stays stable
  const shifted = loops.map(l => ({ closed: l.closed, pts: l.pts.map(v => ({ ...v, x: v.x - bb.minX, y: v.y - bb.minY })) }))
  return { ...p, loops: shifted, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY }
}

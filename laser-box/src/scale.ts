// Making a whole design bigger or smaller, and nudging a design that has errors back to one that can be cut.
// The cut file must never be scaled afterwards (in RDWorks or elsewhere): slots and fingers are sized on the sheet's
// thickness, so they would shrink with it. Here every length of the design is scaled instead, and the thickness,
// the clearances and the sizes of real objects (a bowl, a photo, a card) stay as they are.
import { Template, ParamDef } from './templates'
import { generate, Settings } from './generate'

/**
 * - length: a size of the design itself; scales with it, and repair may change it
 * - object: the size of a real thing measured by the user (a bowl, a photo, a candle); scales only when asked, never repaired
 * - fixed: thickness, clearance, finger or hand sizes, laser settings; never scaled, never repaired
 * - count: how many of something (steps, shelves, hooks); not scaled, repair may change it at a cost
 * - toggle: a part switched on or off; repair may switch it at a high cost
 * - choice: a design choice (shape, pattern, how many copies); never touched
 * - angle: not scaled, never repaired
 */
export type Role = 'length' | 'object' | 'fixed' | 'count' | 'toggle' | 'choice' | 'angle'

/** strength, clearance and material sizes that do not change with the size of the design */
const FIXED = new Set(['fit', 'gap', 'slide', 'hc', 'tm', 'tf', 'glass', 'web', 'tab', 'pull', 'seg', 'bridge', 'pitch', 'lw', 'gw', 'margin', 'rim', 'air'])
/** sizes of real things the design holds */
const OBJECT = new Set(['rd', 'bd', 'bh', 'cup', 'cd', 'ring', 'pen', 'penW', 'bag', 'pw', 'ph', 'Dd', 'devT', 'socket', 'entry', 'slitW', 'slitL', 'bowl'])
/** design choices among a few kinds, and the number of copies */
const CHOICE = new Set(['shape', 'style', 'pattern', 'motif', 'win', 'n', 'num', 'from', 'kind'])
const PER_TEMPLATE: Record<string, Record<string, Role>> = {
  sweetstand: { gap: 'object' }, // the height of the sweets on a tier, plus air
  tray: { hh: 'fixed', hl: 'fixed', hm: 'fixed' }, // the hand hole and the wood above it are sized for a hand
  fabricset: { band: 'object', sl: 'object', ringH: 'object' }, // the ring's band, its width and how far it stands up
  engagement: { Dd: 'length' }, // the mirror is a laser-cut part of the set, not a bought one
  mabkharatower: { dh: 'object', ov: 'fixed' }, // the dome follows the bowl and coals; the overhang covers the mirror's thickness
  hexringbox: { ov: 'fixed' },
  bedtray: { legH: 'object' }, // set by the person sitting in bed
  napkin: { sep: 'object' }, // the napkin stack
  flex: { R: 'fixed' }, // the tightest bend the living hinge takes
  displaystand: { N: 'choice' }, // the steps the customer ordered
  displaystandpro: { N: 'choice', lanes: 'choice' },
  invitebox: { cw: 'object', ch: 'object', depth: 'object' },
  moneybox: { slotL: 'object', slotW: 'object' },
  catbank: { slotL: 'object', slotW: 'object' },
  keychains: { hole: 'fixed' },
  ramadanornaments: { hole: 'fixed' },
  clock: { hole: 'object' },
  doorhanger: { hole: 'object', sw: 'object' },
  giftbag: { hand: 'fixed', pw: 'length', ph: 'length' }, // the hand hole is sized for a hand; the plaque is the design's own
  mihrabbox: { knob: 'object' }, // the bought knob's screw
}

export function roleOf(tpl: Template, def: ParamDef): Role {
  if (tpl.id === 'fittest') return 'fixed'
  const own = PER_TEMPLATE[tpl.id]?.[def.key]
  if (own) return own
  if (def.unit === '°') return 'angle'
  if (def.int) return CHOICE.has(def.key) || (def.key === 'deco' && def.max > 1) ? 'choice' : def.min === 0 && def.max === 1 ? 'toggle' : 'count'
  if (def.unit !== 'مم') return 'fixed'
  if (FIXED.has(def.key)) return 'fixed'
  if (OBJECT.has(def.key)) return 'object'
  return 'length'
}

const snap = (def: ParamDef, v: number) => {
  const st = def.int ? 1 : def.step ?? 1
  const r = Math.round(v / st) * st
  return Math.round(Math.min(def.max, Math.max(def.min, r)) * 1000) / 1000
}

export interface Change { key: string; label: string; from: number; to: number; /** the error this change cleared */ why?: string }

/** Every length (and, with `objects`, every measured object) times f, on the field's step and inside its range. */
export function scaleParams(tpl: Template, params: Record<string, number>, f: number, objects = false) {
  const out = { ...tpl.defaults, ...params }
  const clamped: Change[] = []
  for (const def of tpl.params) {
    const role = roleOf(tpl, def)
    if (role !== 'length' && !(objects && role === 'object')) continue
    const v = out[def.key]
    if (!Number.isFinite(v) || v === 0) continue
    const want = v * f, got = snap(def, want)
    if (Math.abs(got - want) > Math.max(def.step ?? 1, 0.05 * Math.abs(want))) clamped.push({ key: def.key, label: def.label, from: Math.round(want * 10) / 10, to: got })
    out[def.key] = got
  }
  return { params: out, clamped }
}

export interface RepairResult {
  params: Record<string, number>
  ok: boolean
  errors: string[]
  /** what repair changed, from the values it was given */
  changes: Change[]
  /** how much the design moved, in the same units the search weighs its changes in (0 = nothing changed) */
  cost: number
  evals: number
}

export interface RepairOptions {
  /** keys repair must leave alone (the field the user just set, the size a customer asked for) */
  locked?: Iterable<string>
  /** measured objects repair may change too (they were scaled, so they are a guess anyway) */
  objects?: boolean
  /** give up after this many milliseconds */
  budgetMs?: number
}

/** One way to change the design by an amount x (x0 leaves it as it is), tried at amounts closest to x0 first. */
interface Move { keys: string[]; x0: number; trials: number[]; step: number; apply: (x: number) => Record<string, number>; cost: (x: number) => number }

/**
 * The nearest design without errors. A greedy search: each round tries every possible change at small amounts first
 * (one setting up or down by 3 %, 7 %, 15 %… or every length together), keeps for each the smallest amount that leaves
 * fewer errors, walks it back to the least that still does, and takes the cheapest of them. Small details are cheaper
 * to change than the big dimensions; counts and switching parts off cost much more. Once nothing is wrong, every
 * changed length is walked back towards where it was as far as it stays right.
 * Measured objects, thicknesses, clearances, angles and design choices are never touched.
 */
export function repair(tpl: Template, settings: Settings, start: Record<string, number>, opts: RepairOptions = {}): RepairResult {
  const locked = new Set(opts.locked ?? [])
  const deadline = Date.now() + (opts.budgetMs ?? 2500)
  const cache = new Map<string, string[] | null>()
  let evals = 0, slowest = 0
  const errorsOf = (p: Record<string, number>): string[] | null => {
    const key = tpl.params.map(d => p[d.key]).join(',')
    if (cache.has(key)) return cache.get(key)!
    evals++
    const t0 = Date.now()
    let e: string[] | null
    try { e = generate(tpl, p, settings).errors } catch { e = null }
    slowest = Math.max(slowest, Date.now() - t0)
    cache.set(key, e)
    return e
  }
  const count = (p: Record<string, number>) => errorsOf(p)?.length ?? Infinity
  const first: Record<string, number> = { ...tpl.defaults, ...start }
  const cur: Record<string, number> = { ...first }
  let score = count(cur)
  const role = (d: ParamDef): Role => { const r = roleOf(tpl, d); return opts.objects && r === 'object' ? 'length' : r }
  // bigger dimensions cost more to move: the design should keep the size it was given
  const lengths = tpl.params.filter(d => role(d) === 'length')
  const biggest = Math.max(1, ...lengths.map(d => Math.abs(tpl.defaults[d.key] ?? 0)))
  const weight = (d: ParamDef) => 1 + 2 * Math.min(1, Math.abs(tpl.defaults[d.key] ?? 0) / biggest)
  const free = tpl.params.filter(d => !locked.has(d.key) && ['length', 'count', 'toggle'].includes(role(d)))
  const freeLengths = free.filter(d => role(d) === 'length')
  const rel = (d: ParamDef, from: number, to: number) => Math.abs(to - from) / Math.max(Math.abs(from), Math.abs(to), d.step ?? 1)
  // a part switched off or a step, shelf or candle less is a bigger change than any size
  const cost1 = (d: ParamDef, from: number, to: number) => {
    const r = role(d)
    if (from === to) return 0
    if (r === 'toggle') return 4
    if (r === 'count') return 2 * Math.abs(to - from)
    return weight(d) * rel(d, from, to)
  }
  const costOf = (p: Record<string, number>, base: Record<string, number>) => tpl.params.reduce((s2, d) => s2 + cost1(d, base[d.key], p[d.key]), 0)
  const moves = (): Move[] => {
    // a design that takes long to draw gets fewer, coarser trials
    const fine = slowest < 25
    const ups = fine ? [1.03, 1.07, 1.15, 1.3, 1.6, 2, 3] : [1.1, 1.3, 1.7, 2.5]
    const downs = fine ? [0.97, 0.93, 0.85, 0.7, 0.5] : [0.88, 0.65]
    const interleave = (c: number, d: ParamDef) => {
      const vs: number[] = [], seen = new Set<number>([c])
      const add = (v: number) => { const s2 = snap(d, v); if (Number.isFinite(s2) && !seen.has(s2)) { seen.add(s2); vs.push(s2) } }
      if (c !== 0) for (let i = 0; i < Math.max(ups.length, downs.length); i++) { if (i < ups.length) add(c * ups[i]); if (i < downs.length) add(c * downs[i]) }
      add(c + (d.step ?? 1)); add(c - (d.step ?? 1)); add(d.min); add(d.max); add(tpl.defaults[d.key])
      return vs.sort((u, v) => Math.abs(u - c) - Math.abs(v - c))
    }
    const out: Move[] = []
    for (const d of free) {
      const c = cur[d.key], r = role(d)
      const trials = r === 'toggle' ? [c ? 0 : 1] : r === 'count' ? [c - 1, c + 1, c - 2, c + 2].filter(v => v >= d.min && v <= d.max) : interleave(c, d)
      out.push({ keys: [d.key], x0: c, trials, step: r === 'length' ? d.step ?? 1 : 0, apply: x => ({ ...cur, [d.key]: snap(d, x) }), cost: x => cost1(d, c, snap(d, x)) })
    }
    // every length together, by a factor (a wall and the foot that keeps it standing grow as one)
    if (freeLengths.length > 1) {
      const all = (k: number) => { const p = { ...cur }; for (const d of freeLengths) if (p[d.key]) p[d.key] = snap(d, p[d.key] * k); return p }
      out.push({
        keys: freeLengths.map(d => d.key), x0: 1, trials: fine ? [1.03, 0.97, 1.07, 0.93, 1.15, 1.3, 1.6, 2] : [1.1, 1.3, 1.7, 2], step: 0.004, apply: all,
        cost: k => { const p = all(k); return freeLengths.reduce((s2, d) => s2 + cost1(d, cur[d.key], p[d.key]), 0) / Math.sqrt(freeLengths.length) },
      })
    }
    return out
  }
  const why: Record<string, string> = {}
  const head = (e: string) => e.slice(0, 18)
  for (let round = 0; round < 12 && score > 0 && Date.now() < deadline; round++) {
    let best: { m: Move; x: number; e: number; c: number } | null = null
    for (const m of moves()) {
      if (Date.now() > deadline) break
      // the smallest trial that leaves fewer errors, then the least amount between it and the trial before that does as well
      // the last trial that failed on each side of x0: the search walks back from x towards it
      const failed = { up: m.x0, down: m.x0 }
      for (const x of m.trials) {
        if (Date.now() > deadline) break
        const e = count(m.apply(x)), side = x > m.x0 ? 'up' : 'down'
        if (e < score) {
          let lo = failed[side], hi = x
          if (m.step > 0) for (let i = 0; i < 24 && Math.abs(hi - lo) > m.step + 1e-9 && Date.now() < deadline; i++) {
            const mid = (lo + hi) / 2
            if (count(m.apply(mid)) <= e) hi = mid
            else lo = mid
          }
          const c = m.cost(hi)
          if (!best || c < best.c - 1e-9 || (Math.abs(c - best.c) < 1e-9 && e < best.e)) best = { m, x: hi, e, c }
          break
        }
        failed[side] = x
      }
    }
    if (!best) break
    const before = errorsOf(cur) ?? [], next = best.m.apply(best.x), after = errorsOf(next) ?? []
    // an error is gone when nothing after the change starts the same way (the numbers in it change)
    const cleared = before.find(b2 => !after.some(a2 => head(a2) === head(b2)))
    for (const d of tpl.params) if (next[d.key] !== cur[d.key] && cleared && !why[d.key]) why[d.key] = cleared
    Object.assign(cur, next)
    score = count(cur)
  }
  // nothing wrong any more: walk every changed length back towards where it was, as far as it stays right
  if (score === 0) {
    const moved = lengths.filter(d => cur[d.key] !== first[d.key]).sort((u, v) => cost1(v, first[v.key], cur[v.key]) - cost1(u, first[u.key], cur[u.key]))
    for (const d of moved) {
      if (Date.now() > deadline) break
      const st = d.step ?? 1
      if (count({ ...cur, [d.key]: first[d.key] }) === 0) { cur[d.key] = first[d.key]; continue }
      let lo = first[d.key], hi = cur[d.key]
      for (let i = 0; i < 24 && Math.abs(hi - lo) > st + 1e-9 && Date.now() < deadline; i++) {
        const mid = snap(d, (lo + hi) / 2)
        if (mid === lo || mid === hi) break
        if (count({ ...cur, [d.key]: mid }) === 0) hi = mid
        else lo = mid
      }
      cur[d.key] = hi
    }
  }
  const changes: Change[] = []
  for (const d of tpl.params) if (cur[d.key] !== first[d.key]) changes.push({ key: d.key, label: d.label, from: first[d.key], to: cur[d.key], why: why[d.key] })
  return { params: cur, ok: score === 0, errors: errorsOf(cur) ?? ['تعذّر توليد الشكل بهذه القيم.'], changes, cost: costOf(cur, first), evals }
}

export interface ScaleResult extends RepairResult {
  /** the design times f, before repair */
  target: Record<string, number>
  /** lengths held at the edge of their range */
  clamped: Change[]
}

/** The design f times its size, then repaired: lengths that cannot follow (a wall too thin for its joint, a bowl that no longer fits) are moved as little as possible. */
export function scaleDesign(tpl: Template, settings: Settings, params: Record<string, number>, f: number, objects = false, budgetMs = 2500, locked: string[] = []): ScaleResult {
  const { params: target, clamped } = scaleParams(tpl, params, f, objects)
  const r = repair(tpl, settings, target, { budgetMs, objects, locked })
  return { ...r, target, clamped }
}

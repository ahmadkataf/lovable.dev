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
  sweetstand: { gap: 'length' },
  tray: { hh: 'fixed', hl: 'fixed' },
  fabricset: { band: 'object' },
  invitebox: { cw: 'object', ch: 'object', depth: 'object' },
  moneybox: { slotL: 'object', slotW: 'object' },
  catbank: { slotL: 'object', slotW: 'object' },
  keychains: { hole: 'fixed' },
  ramadanornaments: { hole: 'fixed' },
  clock: { hole: 'object' },
  doorhanger: { hole: 'object', sw: 'object' },
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
  evals: number
}

export interface RepairOptions {
  /** keys repair must leave alone (the field the user just set) */
  locked?: Iterable<string>
  /** measured objects repair may change too (they were scaled, so they are a guess anyway) */
  objects?: boolean
  /** give up after this many milliseconds */
  budgetMs?: number
}

/** One way to change the design, by an amount x: x0 leaves it as it is, x1 is the trial amount. */
interface Move { name: string; x0: number; x1: number; step: number; apply: (x: number) => Record<string, number>; cost: number }

/**
 * The nearest design without errors: a greedy search that makes one change at a time, each time taking the cheapest
 * change that leaves the fewest errors, then walking it back as close to where it was as it can. A change is one
 * setting, or every length of the design together (a wall and the foot that keeps it standing must grow as one).
 * Small details are cheaper to change than the big dimensions; counts and switching parts off cost more still.
 * Measured objects, thicknesses, clearances, angles and design choices are never touched.
 */
export function repair(tpl: Template, settings: Settings, start: Record<string, number>, opts: RepairOptions = {}): RepairResult {
  const locked = new Set(opts.locked ?? [])
  const deadline = Date.now() + (opts.budgetMs ?? 2500)
  const cache = new Map<string, string[] | null>()
  let evals = 0
  const errorsOf = (p: Record<string, number>): string[] | null => {
    const key = tpl.params.map(d => p[d.key]).join(',')
    if (cache.has(key)) return cache.get(key)!
    evals++
    let e: string[] | null
    try { e = generate(tpl, p, settings).errors } catch { e = null }
    cache.set(key, e)
    return e
  }
  const count = (p: Record<string, number>) => errorsOf(p)?.length ?? Infinity
  const cur: Record<string, number> = { ...tpl.defaults, ...start }
  let score = count(cur)
  const role = (d: ParamDef): Role => { const r = roleOf(tpl, d); return opts.objects && r === 'object' ? 'length' : r }
  // bigger dimensions cost more to move: the design should keep the size it was given
  const lengths = tpl.params.filter(d => role(d) === 'length')
  const biggest = Math.max(1, ...lengths.map(d => Math.abs(tpl.defaults[d.key] ?? 0)))
  const weight = (d: ParamDef) => 1 + 2 * Math.min(1, Math.abs(tpl.defaults[d.key] ?? 0) / biggest)
  const free = tpl.params.filter(d => !locked.has(d.key) && ['length', 'count', 'toggle'].includes(role(d)))
  const freeLengths = free.filter(d => role(d) === 'length')
  const rel = (d: ParamDef, from: number, to: number) => Math.abs(to - from) / Math.max(Math.abs(from), Math.abs(to), d.step ?? 1)
  const cost = (d: ParamDef, from: number, to: number) => {
    const r = role(d)
    if (r === 'toggle') return 2.5
    if (r === 'count') return 0.6 * Math.abs(to - from)
    return weight(d) * rel(d, from, to)
  }
  const moves = (): Move[] => {
    const out: Move[] = []
    for (const d of free) {
      const c = cur[d.key], r = role(d), vs = new Set<number>()
      const add = (v: number) => { if (Number.isFinite(v)) { const s = snap(d, v); if (s !== c) vs.add(s) } }
      if (r === 'toggle') add(c ? 0 : 1)
      else if (r === 'count') for (const k of [-2, -1, 1, 2]) add(c + k)
      else {
        for (const k of [0.5, 0.7, 0.85, 1.15, 1.4, 2, 3]) add(c * k)
        for (const k of [-5, -2, 2, 5]) add(c + k)
        add(d.min); add(d.max)
      }
      add(tpl.defaults[d.key])
      for (const v of vs) out.push({ name: d.key, x0: c, x1: v, step: r === 'length' ? d.step ?? 1 : 0, apply: x => ({ ...cur, [d.key]: snap(d, x) }), cost: cost(d, c, v) })
    }
    // every length together, by a factor
    if (freeLengths.length > 1) {
      const all = (k: number) => { const p = { ...cur }; for (const d of freeLengths) if (p[d.key]) p[d.key] = snap(d, p[d.key] * k); return p }
      for (const k of [1.05, 1.1, 1.2, 1.35, 1.5, 1.75, 2, 0.9, 0.8]) {
        const p = all(k)
        out.push({ name: '*', x0: 1, x1: k, step: 0.005, apply: all, cost: freeLengths.reduce((s, d) => s + cost(d, cur[d.key], p[d.key]), 0) / Math.sqrt(freeLengths.length) })
      }
    }
    return out.sort((a, b) => a.cost - b.cost)
  }
  const why: Record<string, string> = {}
  for (let round = 0; round < 10 && score > 0 && Date.now() < deadline; round++) {
    let best: { m: Move; e: number } | null = null
    for (const m of moves()) {
      if (Date.now() > deadline) break
      const e = count(m.apply(m.x1))
      if (e < (best?.e ?? score)) best = { m, e }
      if (e === 0) break // moves are cheapest first: nothing later can beat this one
    }
    if (!best) break
    // walk back towards no change while it stays as good
    const { m, e } = best
    let lo = m.x0, hi = m.x1
    if (m.step > 0) for (let i = 0; i < 24 && Math.abs(hi - lo) > m.step + 1e-9 && Date.now() < deadline; i++) {
      const mid = (lo + hi) / 2
      if (count(m.apply(mid)) <= e) hi = mid
      else lo = mid
    }
    const before = errorsOf(cur) ?? [], next = m.apply(hi), after = errorsOf(next) ?? []
    // an error is gone when nothing after the change starts the same way (the numbers in it change)
    const head = (e: string) => e.slice(0, 18)
    const cleared = before.find(b => !after.some(a => head(a) === head(b)))
    for (const d of tpl.params) if (next[d.key] !== cur[d.key] && cleared && !why[d.key]) why[d.key] = cleared
    Object.assign(cur, next)
    score = count(cur)
  }
  const changes: Change[] = []
  const first = { ...tpl.defaults, ...start }
  for (const d of tpl.params) if (cur[d.key] !== first[d.key]) changes.push({ key: d.key, label: d.label, from: first[d.key], to: cur[d.key], why: why[d.key] })
  return { params: cur, ok: score === 0, errors: errorsOf(cur) ?? ['تعذّر توليد الشكل بهذه القيم.'], changes, evals }
}

export interface ScaleResult extends RepairResult {
  /** the design times f, before repair */
  target: Record<string, number>
  /** lengths held at the edge of their range */
  clamped: Change[]
}

/** The design f times its size, then repaired: lengths that cannot follow (a wall too thin for its joint, a bowl that no longer fits) are moved as little as possible. */
export function scaleDesign(tpl: Template, settings: Settings, params: Record<string, number>, f: number, objects = false, budgetMs = 2500): ScaleResult {
  const { params: target, clamped } = scaleParams(tpl, params, f, objects)
  const r = repair(tpl, settings, target, { budgetMs, objects })
  return { ...r, target, clamped }
}

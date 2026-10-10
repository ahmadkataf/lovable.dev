// Pure logic of the dental chart: what a new finding replaces, what each tooth shows, summary counts.
// No database access here — the tab reads the rows, asks these functions for a plan, then writes it.
import type { ToothCondition, ToothRecord, ToothSurface } from '@/db/types'
import { CONDITION_META, LEGEND_ORDER, SURFACE_ORDER, isSurfaceCondition, isValidTooth, normalizeSurfaces, rowOf, toothInfo, type Dentition } from './teeth'

export interface RecordDraft { tooth: number; condition: ToothCondition; surfaces?: ToothSurface[]; note?: string; treatmentItemId?: string }
/**
 * A record to insert: the caller adds id and patientId, and recordedAt / recordedBy unless the plan carries them
 * (what is left of a finding after quick paint took some of its surfaces keeps the original date and author).
 */
export type NewRecord = Pick<ToothRecord, 'tooth' | 'surfaces' | 'condition' | 'active'> & { note?: string; treatmentItemId?: string; recordedAt?: string; recordedBy?: string }
export interface WritePlan { deactivate: string[]; activate: string[]; add: NewRecord[] }
const EMPTY_PLAN = (): WritePlan => ({ deactivate: [], activate: [], add: [] })

const CROWN_SURFACES: ToothSurface[] = ['M', 'D', 'O', 'I', 'B', 'L']
const overlaps = (a: readonly ToothSurface[], b: readonly ToothSurface[]) => a.some(s => b.includes(s))
const isSurfaceRecord = (r: Pick<ToothRecord, 'condition'>) => isSurfaceCondition(r.condition)

/** Newest first; ties broken by id (ids are time-prefixed). */
export function byNewest(a: Pick<ToothRecord, 'recordedAt' | 'id'>, b: Pick<ToothRecord, 'recordedAt' | 'id'>): number {
  return a.recordedAt < b.recordedAt ? 1 : a.recordedAt > b.recordedAt ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}
export function activeRecords(records: readonly ToothRecord[], tooth?: number): ToothRecord[] {
  return records.filter(r => r.active && r.condition !== 'healthy' && (tooth === undefined || r.tooth === tooth))
}

/** Cleans a draft: surface conditions keep only the tooth's own surfaces (O↔I mapped), whole-tooth ones get none. */
export function normalizeDraft(d: RecordDraft): RecordDraft & { surfaces: ToothSurface[] } {
  const meta = CONDITION_META[d.condition]
  const surfaces = meta.scope === 'tooth' ? [] : normalizeSurfaces(d.tooth, d.surfaces ?? [])
  const note = d.note?.trim() || undefined
  return { ...d, surfaces, note }
}

/**
 * Does a new finding make an existing active record of the same tooth obsolete?
 *
 * The base rule: a whole-tooth finding replaces the tooth's state, a surface finding replaces what was on those
 * surfaces, and "healthy" clears what it overlaps. It is refined so that states that really coexist in the mouth
 * survive each other instead of being wiped: a root canal stays under a crown or bridge, an implant keeps its crown,
 * remarks (to extract, mobile, abscess, attrition, other) stack with anything, and a crown hides the old fillings.
 */
export function supersedes(next: Pick<ToothRecord, 'condition' | 'surfaces'>, old: Pick<ToothRecord, 'condition' | 'surfaces'>): boolean {
  const n = CONDITION_META[next.condition], o = CONDITION_META[old.condition]
  if (old.condition === 'healthy') return false
  // healthy: the whole tooth, or only the surface findings it overlaps
  if (n.scope === 'clear') return next.surfaces.length === 0 ? true : o.scope === 'surface' && overlaps(next.surfaces, old.surfaces)
  // a surface finding: overlapping surface findings; proves the tooth is there (not missing / not an implant)
  if (n.scope === 'surface') {
    if (o.scope === 'surface') return overlaps(next.surfaces, old.surfaces)
    return old.condition === 'missing' || old.condition === 'implant'
  }
  // whole-tooth findings never duplicate themselves
  if (next.condition === old.condition) return true
  switch (n.layer) {
    case 'replace':
      // missing / implant: the natural tooth is gone, nothing of it remains. impacted: keeps surface findings and remarks.
      if (next.condition === 'impacted') return o.layer !== 'surface' && o.layer !== 'flag'
      return true
    case 'restoration': {
      if (o.layer === 'restoration' || old.condition === 'missing' || old.condition === 'impacted' || old.condition === 'to_extract') return true
      if (o.scope === 'surface') {
        const covered = next.condition === 'veneer' ? (['B'] as ToothSurface[]) : CROWN_SURFACES
        return overlaps(covered, old.surfaces)
      }
      return false                      // root canal, implant and remarks stay
    }
    case 'endo':
      return old.condition === 'missing' || old.condition === 'implant' || old.condition === 'impacted' || old.condition === 'to_extract'
    case 'flag':
      return old.condition === 'missing'
    default:
      return false
  }
}

/** What saving a finding does: which active records of that tooth it deactivates and what it inserts. */
export function planRecord(records: readonly ToothRecord[], draft: RecordDraft): WritePlan {
  const d = normalizeDraft(draft)
  const plan = EMPTY_PLAN()
  if (!isValidTooth(d.tooth)) return plan
  const next = { condition: d.condition, surfaces: d.surfaces }
  for (const r of activeRecords(records, d.tooth)) if (supersedes(next, r)) plan.deactivate.push(r.id)
  // healthy is kept only as a history row, so the timeline shows when the tooth was cleared
  plan.add.push({ tooth: d.tooth, surfaces: d.surfaces, condition: d.condition, active: d.condition !== 'healthy', note: d.note, treatmentItemId: d.treatmentItemId })
  return plan
}

/** Why a draft cannot be saved yet, or null. */
export function validateDraft(d: Partial<RecordDraft>): null | 'condition' | 'surfaces' | 'tooth' {
  if (!d.tooth || !isValidTooth(d.tooth)) return 'tooth'
  if (!d.condition) return 'condition'
  if (isSurfaceCondition(d.condition) && normalizeSurfaces(d.tooth, d.surfaces ?? []).length === 0) return 'surfaces'
  return null
}

/** What is left of a surface record once some of its surfaces are taken: the same finding on the other surfaces. */
function remainder(r: ToothRecord, taken: readonly ToothSurface[]): NewRecord | null {
  const rest = r.surfaces.filter(s => !taken.includes(s))
  if (!rest.length) return null
  const out: NewRecord = { tooth: r.tooth, surfaces: rest, condition: r.condition, active: true, recordedAt: r.recordedAt }
  if (r.note) out.note = r.note
  if (r.treatmentItemId) out.treatmentItemId = r.treatmentItemId
  if (r.recordedBy) out.recordedBy = r.recordedBy
  return out
}

/**
 * Quick-paint click: changes only what was clicked.
 *  - a surface that already shows this condition: the condition is removed from that surface;
 *  - a surface showing something else (or nothing): this condition replaces it there;
 *  - the eraser on a surface clears that surface; on the tooth it resets the whole tooth (a "healthy" history row);
 *  - a whole-tooth condition toggles on the tooth.
 * Unlike the panel form (which supersedes overlapping findings whole), a paint click never wipes the other surfaces of a
 * multi-surface finding: caries MOD with O painted as a filling leaves caries MD + filling O.
 */
export function planPaint(records: readonly ToothRecord[], tooth: number, surfaces: readonly ToothSurface[], condition: ToothCondition): WritePlan {
  const meta = CONDITION_META[condition]
  const target = meta.scope === 'tooth' ? [] : normalizeSurfaces(tooth, surfaces)
  if (meta.scope === 'surface' && target.length === 0) return EMPTY_PLAN()
  const active = activeRecords(records, tooth)
  if (meta.scope === 'tooth') {
    const same = active.filter(r => r.condition === condition)
    if (same.length) return { deactivate: same.map(r => r.id), activate: [], add: [] }
    return planRecord(records, { tooth, condition })
  }
  if (meta.scope === 'surface') {
    const shown = surfaceMap(active)
    if (target.every(s => shown[s]?.condition === condition)) {
      const plan = EMPTY_PLAN()
      for (const r of active.filter(r => r.condition === condition && overlaps(r.surfaces, target))) {
        plan.deactivate.push(r.id)
        const rest = remainder(r, target)
        if (rest) plan.add.push(rest)
      }
      return plan
    }
  }
  const plan = planRecord(records, { tooth, condition, surfaces: target })
  // the eraser on a clean tooth or surface changes nothing: do not fill the history with empty "healthy" rows
  if (meta.scope === 'clear' && plan.deactivate.length === 0) return EMPTY_PLAN()
  // keep the untouched surfaces of every surface finding this click took over
  if (target.length) {
    for (const id of plan.deactivate) {
      const r = active.find(x => x.id === id)
      const rest = r && isSurfaceRecord(r) && overlaps(r.surfaces, target) ? remainder(r, target) : null
      if (rest) plan.add.push(rest)
    }
  }
  return plan
}

/** True when a plan writes nothing. */
export function isEmptyPlan(p: WritePlan): boolean { return !p.deactivate.length && !p.activate.length && !p.add.length }

/** Re-activates an old record, deactivating whatever it conflicts with now. null when it cannot be restored. */
export function planRestore(records: readonly ToothRecord[], id: string): WritePlan | null {
  const rec = records.find(r => r.id === id)
  if (!rec || rec.active || rec.condition === 'healthy') return null
  const plan = EMPTY_PLAN()
  for (const r of activeRecords(records, rec.tooth)) if (r.id !== rec.id && supersedes(rec, r)) plan.deactivate.push(r.id)
  plan.activate.push(rec.id)
  return plan
}

/** Applies a plan to an in-memory list (tests and optimistic previews). */
export function applyPlan(records: readonly ToothRecord[], plan: WritePlan, make: (r: NewRecord, i: number) => ToothRecord): ToothRecord[] {
  const out = records.map(r => plan.deactivate.includes(r.id) ? { ...r, active: false } : plan.activate.includes(r.id) ? { ...r, active: true } : r)
  plan.add.forEach((r, i) => out.push(make(r, i)))
  return out
}

// ---- what the chart shows --------------------------------------------------------------------------
/** surface → the newest active surface record covering it. */
export function surfaceMap(active: readonly ToothRecord[]): Partial<Record<ToothSurface, ToothRecord>> {
  const out: Partial<Record<ToothSurface, ToothRecord>> = {}
  for (const r of [...active].filter(isSurfaceRecord).sort(byNewest)) for (const s of r.surfaces) if (!out[s]) out[s] = r
  return out
}

export interface ToothView {
  surfaces: Partial<Record<ToothSurface, ToothCondition>>
  whole: ToothCondition[]       // active whole-tooth conditions, in legend order
  records: ToothRecord[]        // the active records of the tooth, newest first
}
export const EMPTY_VIEW: ToothView = { surfaces: {}, whole: [], records: [] }

/** Every tooth that has an active finding → what to draw. */
export function chartView(records: readonly ToothRecord[]): Map<number, ToothView> {
  const byTooth = new Map<number, ToothRecord[]>()
  for (const r of activeRecords(records)) { const l = byTooth.get(r.tooth); if (l) l.push(r); else byTooth.set(r.tooth, [r]) }
  const out = new Map<number, ToothView>()
  for (const [n, list] of byTooth) {
    const sm = surfaceMap(list)
    const surfaces: ToothView['surfaces'] = {}
    for (const [s, r] of Object.entries(sm)) surfaces[s as ToothSurface] = r!.condition
    const whole = LEGEND_ORDER.filter(c => CONDITION_META[c].scope === 'tooth' && list.some(r => r.condition === c))
    out.set(n, { surfaces, whole, records: [...list].sort(byNewest) })
  }
  return out
}

/** Pairs of neighbouring teeth of one drawn row that both carry an active bridge: the chart joins them with a bar. */
export function bridgeLinks(row: readonly number[], bridged: ReadonlySet<number>): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < row.length - 1; i++) if (bridged.has(row[i]) && bridged.has(row[i + 1])) out.push([row[i], row[i + 1]])
  return out
}
/** Bridge spans (runs of ≥ 2 consecutive bridged teeth) across all rows. */
export function bridgeSpans(records: readonly ToothRecord[]): number[][] {
  const bridged = new Set(activeRecords(records).filter(r => r.condition === 'bridge').map(r => r.tooth))
  const seen = new Set<number>(), spans: number[][] = []
  for (const n of [...bridged].sort((a, b) => a - b)) {
    if (seen.has(n)) continue
    const row = rowOf(n)
    let k = row.indexOf(n)
    while (k > 0 && bridged.has(row[k - 1])) k--
    const span: number[] = []
    while (k < row.length && bridged.has(row[k])) { span.push(row[k]); seen.add(row[k]); k++ }
    if (span.length >= 2) spans.push(span)
  }
  return spans
}

// ---- summary ---------------------------------------------------------------------------------------
/** For each condition, how many distinct teeth carry it now. */
export function conditionCounts(records: readonly ToothRecord[]): Record<ToothCondition, number> {
  const sets = new Map<ToothCondition, Set<number>>()
  for (const r of activeRecords(records)) { const s = sets.get(r.condition) ?? new Set<number>(); s.add(r.tooth); sets.set(r.condition, s) }
  const out = {} as Record<ToothCondition, number>
  for (const c of [...LEGEND_ORDER, 'healthy' as ToothCondition]) out[c] = sets.get(c)?.size ?? 0
  return out
}

export interface ChartSummary {
  caries: number; filled: number; crown: number; missing: number; implant: number; root_canal: number
  /** DMFT-style index on the charted teeth: D decayed, M missing (incl. replaced by an implant), F filled or crowned without decay. */
  dmft: { d: number; m: number; f: number; total: number }
  charted: number               // teeth with at least one active finding
}
export function chartSummary(records: readonly ToothRecord[]): ChartSummary {
  const counts = conditionCounts(records)
  const byTooth = new Map<number, Set<ToothCondition>>()
  for (const r of activeRecords(records)) { const s = byTooth.get(r.tooth) ?? new Set<ToothCondition>(); s.add(r.condition); byTooth.set(r.tooth, s) }
  let d = 0, m = 0, f = 0
  for (const set of byTooth.values()) {
    if (set.has('missing') || set.has('implant')) m++
    else if (set.has('caries')) d++
    else if (set.has('filled') || set.has('crown')) f++
  }
  return {
    caries: counts.caries, filled: counts.filled, crown: counts.crown, missing: counts.missing, implant: counts.implant, root_canal: counts.root_canal,
    dmft: { d, m, f, total: d + m + f }, charted: byTooth.size,
  }
}

/** Default dentition by age: under 6 primary, 6–12 mixed, otherwise adult (also when the age is unknown). */
export function dentitionForAge(age: number | null | undefined): Dentition {
  if (age === null || age === undefined || !Number.isFinite(age)) return 'adult'
  if (age < 6) return 'primary'
  if (age <= 12) return 'mixed'
  return 'adult'
}

/** All records, newest first (active and superseded) — the history timeline. */
export function timeline(records: readonly ToothRecord[], tooth?: number): ToothRecord[] {
  return records.filter(r => tooth === undefined || r.tooth === tooth).sort(byNewest)
}

/** Rows for the printed summary: one line per active finding, by tooth number. */
export function findingsTable(records: readonly ToothRecord[]): ToothRecord[] {
  return activeRecords(records).sort((a, b) => a.tooth - b.tooth || LEGEND_ORDER.indexOf(a.condition) - LEGEND_ORDER.indexOf(b.condition))
}

/** Surfaces as written on a chart: "MOD", "B", "—" for the whole tooth. Root is kept separate: "MO + R". */
export function surfaceCode(surfaces: readonly ToothSurface[]): string {
  if (!surfaces.length) return ''
  const crown = SURFACE_ORDER.filter(s => s !== 'R' && surfaces.includes(s)).join('')
  return surfaces.includes('R') ? (crown ? `${crown} + R` : 'R') : crown
}

/** True when the tooth exists in this dentition (used to warn about findings on teeth not drawn). */
export function inDentition(n: number, dentition: Dentition): boolean {
  const i = toothInfo(n)
  if (!i) return false
  return dentition === 'mixed' || (dentition === 'primary') === i.primary
}

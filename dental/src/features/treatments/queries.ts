// Reads of the clinic-wide treatments register, through the indexes. A busy clinic has tens of thousands of items
// (nearly all of them completed and billed): the register never reads the whole table for a period view or for its
// key figures, and never loads every patient record to show names.
import { db } from '@/db'
import type { ISODate, TreatmentItem, TreatmentStatus } from '@/db/types'
import { addDays, combine } from '@/lib/dates'
import { inRange, itemDate, rangeFor, type Range } from './lib'
import { readAllChunked } from '@/features/patients/chunked'

const OPEN: TreatmentStatus[] = ['planned', 'in_progress', 'cancelled']

/** The ISO instants that bound the local calendar days [from, to] ('' / '\uffff' for an open end). */
export function instantBounds(r: Range): [string, string] {
  const lo = r.from <= '1900-01-01' ? '' : combine(r.from, '00:00')
  const hi = r.to >= '9000-01-01' ? '\uffff' : combine(addDays(r.to, 1), '00:00')
  return [lo, hi]
}

/** Completed items done within the range (completedAt index). */
async function completedIn(r: Range): Promise<TreatmentItem[]> {
  const [lo, hi] = instantBounds(r)
  const list = await db.treatments.where('completedAt').between(lo, hi, true, false).toArray()
  return list.filter(i => i.status === 'completed' && inRange(itemDate(i), r))
}

/** Items that are not completed (a small share of the table): one index read per status, never a cursor. */
async function openItems(): Promise<TreatmentItem[]> {
  return (await Promise.all(OPEN.map(s => db.treatments.where('status').equals(s).toArray()))).flat()
}

/**
 * The register rows of a period (null = all time). Completed work is read by its completion date; planned, started
 * and cancelled items (dated by their planned day or creation) come from the status index and are filtered here.
 */
export async function registerItems(range: Range | null): Promise<TreatmentItem[]> {
  if (!range) return readAllChunked(db.treatments, 2000)
  const [open, done] = await Promise.all([openItems(), completedIn(range)])
  return [...open.filter(i => inRange(itemDate(i), range)), ...done]
}

export interface RegisterStats { planned: TreatmentItem[]; inProgress: TreatmentItem[]; doneMonth: TreatmentItem[]; unbilled: TreatmentItem[] }
/**
 * What the key figures need: planned and started work (status index), this month's completions (completedAt index),
 * and completed work not invoiced yet: the keys of completed items minus the keys of billed ones (keys only, no
 * records), then only those few records.
 */
export async function registerStats(today: ISODate): Promise<RegisterStats> {
  const month = rangeFor('month', today)!
  const [planned, inProgress, doneMonth, completedKeys, billedKeys] = await Promise.all([
    db.treatments.where('status').equals('planned').toArray(),
    db.treatments.where('status').equals('in_progress').toArray(),
    completedIn(month),
    db.treatments.where('status').equals('completed').primaryKeys(),
    db.treatments.where('invoiceId').above('').primaryKeys(),
  ])
  const billed = new Set(billedKeys)
  const ids = completedKeys.filter(k => !billed.has(k))
  const unbilled = ids.length ? (await db.treatments.bulkGet(ids)).filter((i): i is TreatmentItem => !!i && i.status === 'completed' && !i.invoiceId) : []
  return { planned, inProgress, doneMonth, unbilled }
}

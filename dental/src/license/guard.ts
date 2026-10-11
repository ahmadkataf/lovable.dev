// Read-only mode below the UI. When the licence has ended, screens hide their add/edit/delete actions; these
// Dexie hooks also refuse any write to the clinical and financial tables, so a screen that forgets the check,
// or a write typed into the developer console, cannot change patient or money records either.
//
// Still allowed while read-only: the clinic record (preferences), settings (licence activation, trial clock,
// sign-in guard), users (PIN changes, admin PIN reset with a seller code), the activity feed, and any
// transaction over the whole database (a backup restore or "start over", which replace everything at once).
//
// The trial start can also never move later: that would give the trial back.
import Dexie from 'dexie'
import { db, TABLE_NAMES } from '@/db'

/** Tables whose content is the clinic's work: frozen while the app is read-only. */
export const GUARDED_TABLES = [
  'patients', 'appointments', 'procedures', 'teeth', 'plans', 'treatments', 'invoices', 'payments', 'drugs',
  'prescriptions', 'labOrders', 'inventory', 'stock', 'expenses', 'files', 'notes',
] as const

/** The error a refused write rejects with (name 'ReadOnlyError'). */
export class ReadOnlyError extends Error {
  constructor() { super('Dentora is read-only until it is activated'); this.name = 'ReadOnlyError' }
}
export const isReadOnlyError = (e: unknown) => !!e && typeof e === 'object' && (e as { name?: string }).name === 'ReadOnlyError'

type Trans = { storeNames?: string[] } | undefined
/** A restore or a reset: one transaction over every table. */
const wholeDatabase = (trans: Trans) => (trans?.storeNames?.length ?? 0) >= TABLE_NAMES.length

function refuse(trans: Trans): void {
  if (!wholeDatabase(trans)) throw new ReadOnlyError()
}
const creating = function (_key: unknown, _obj: unknown, trans: Trans) { refuse(trans) }
const updating = function (_mods: unknown, _key: unknown, _obj: unknown, trans: Trans) { refuse(trans) }
const deleting = function (_key: unknown, _obj: unknown, trans: Trans) { refuse(trans) }

let readOnly = false
/** Called by the licence provider whenever read-only mode starts or ends. Hooks are attached only while read-only. */
export function setReadOnlyGuard(on: boolean): void {
  if (on === readOnly) return
  readOnly = on
  for (const name of GUARDED_TABLES) {
    const table = db.table(name)
    if (on) {
      table.hook('creating', creating as any)
      table.hook('updating', updating as any)
      table.hook('deleting', deleting as any)
    } else {
      table.hook('creating').unsubscribe(creating as any)
      table.hook('updating').unsubscribe(updating as any)
      table.hook('deleting').unsubscribe(deleting as any)
    }
  }
}
export const isReadOnlyGuarded = () => readOnly

// ---- the trial start only moves earlier ------------------------------------------------------------------------
const DAY = 86_400_000
const time = (v: unknown) => (typeof v === 'string' && v ? new Date(v).getTime() : NaN)
/** May the stored trial start change from `before` to `after`? Only to an earlier, sane instant (or to fix a broken one). */
export function trialStartChangeAllowed(before: unknown, after: unknown, now = Date.now()): boolean {
  const a = time(after), b = time(before)
  if (!Number.isFinite(a)) return false
  if (!Number.isFinite(b) || b > now + DAY) return true      // nothing sane stored: any valid start may replace it
  return a <= b
}

let trialHooks = false
/** Attached once at start-up; cheap, since settings rarely change. */
export function installTrialStartGuard(): void {
  if (trialHooks) return
  trialHooks = true
  db.settings.hook('updating', function (mods, key, obj, trans) {
    if (key !== 'installedAt' || wholeDatabase(trans as Trans)) return
    if (!('value' in (mods as object))) return
    if (!trialStartChangeAllowed((obj as { value?: unknown }).value, (mods as { value?: unknown }).value)) throw new Dexie.ConstraintError('installedAt can only move earlier')
  })
  db.settings.hook('deleting', function (key, _obj, trans) {
    if (key === 'installedAt' && !wholeDatabase(trans as Trans)) throw new Dexie.ConstraintError('installedAt cannot be removed')
  })
}

// A small in-memory index of every patient (no photos, no medical text) shared by the billing pickers, the invoice
// and payment searches and the reports. It is read from the patients table once, then patched from Dexie's change
// events: a status click that updates one patient's last visit re-reads that one row, not all six thousand files.
import { useEffect, useSyncExternalStore } from 'react'
import Dexie, { type IntervalTree } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Patient } from '@/db/types'

export type SlimPatient = Pick<Patient, 'id' | 'name' | 'fileNo' | 'archived' | 'createdAt' | 'updatedAt' | 'gender'>
  & Partial<Pick<Patient, 'phone' | 'phone2' | 'doctorId' | 'lastVisit' | 'birthDate' | 'referredBy'>>
  & { hasPhoto: boolean }
export interface PatientIndex { list: SlimPatient[]; byId: Map<string, SlimPatient> }

export function slimPatient(p: Patient): SlimPatient {
  const s: SlimPatient = { id: p.id, name: p.name, fileNo: p.fileNo, archived: !!p.archived, createdAt: p.createdAt, updatedAt: p.updatedAt, gender: p.gender, hasPhoto: !!p.photo }
  if (p.phone) s.phone = p.phone
  if (p.phone2) s.phone2 = p.phone2
  if (p.doctorId) s.doctorId = p.doctorId
  if (p.lastVisit) s.lastVisit = p.lastVisit
  if (p.birthDate) s.birthDate = p.birthDate
  if (p.referredBy) s.referredBy = p.referredBy
  return s
}

let current: PatientIndex | undefined
let stale = true
/** ids changed since the last read; null = too many (or a range): read everything again */
let changed: Set<string> | null = new Set()
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const PART = `idb://${db.name}/patients/`

function publish(list: SlimPatient[]) {
  current = { list, byId: new Map(list.map(p => [p.id, p])) }
  listeners.forEach(l => l())
}

async function refresh(): Promise<void> {
  const ids = changed
  stale = false
  changed = new Set()
  if (!current || ids === null) {
    publish((await db.patients.toArray()).map(slimPatient))
  } else if (ids.size) {
    const keys = [...ids]
    const rows = await db.patients.bulkGet(keys)
    const map = new Map(current.byId)
    keys.forEach((id, i) => { const r = rows[i]; if (r) map.set(id, slimPatient(r)); else map.delete(id) })
    publish([...map.values()])
  }
  if (stale) await refresh()   // changed again while reading
}
/** Reads (or patches) the index when it is out of date. */
export function ensurePatientIndex(): Promise<void> {
  if (!stale && current) return Promise.resolve()
  if (!loading) loading = refresh().catch(err => { console.warn('patient index', err); stale = true }).finally(() => { loading = null })
  return loading
}

/** Collects the single keys of a change set; null when it holds a range (a bulk change) or too many keys. */
function keysOf(tree: IntervalTree | undefined, out: Set<string>): boolean {
  if (!tree || !('from' in tree)) return true
  if (tree.from !== tree.to || typeof tree.from !== 'string') return false
  out.add(tree.from)
  if (out.size > 200) return false
  return keysOf(tree.l ?? undefined, out) && keysOf(tree.r ?? undefined, out)
}
let timer: ReturnType<typeof setTimeout> | undefined
Dexie.on('storagemutated', parts => {
  const main = parts[PART], dels = parts[`${PART}:dels`]
  if (!main && !dels) return
  stale = true
  if (changed) {
    const keys = new Set(changed)
    changed = keysOf(main, keys) && keysOf(dels, keys) ? keys : null
  }
  if (listeners.size) { clearTimeout(timer); timer = setTimeout(() => { void ensurePatientIndex() }, 120) }
})

function subscribe(l: () => void) {
  listeners.add(l)
  if (stale || !current) void ensurePatientIndex()
  return () => { listeners.delete(l) }
}
const snapshot = () => current

/** The live patient index (undefined while it is first read). Pass false to skip it (nothing is read then). */
export function usePatientIndex(enabled = true): PatientIndex | undefined {
  const idx = useSyncExternalStore(enabled ? subscribe : noopSubscribe, enabled ? snapshot : noSnapshot)
  useEffect(() => { if (enabled) void ensurePatientIndex() }, [enabled])
  return idx
}
const noopSubscribe = () => () => {}
const noSnapshot = () => undefined

/** The full records of a few patients (the rows on screen), by id: names, numbers and photos without the whole table. */
export function usePagePatients(ids: string[]): Map<string, Patient> | undefined {
  const key = [...new Set(ids)].sort().join(',')
  const rows = useLiveQuery(async () => {
    const list = key ? key.split(',') : []
    const found = list.length ? await db.patients.bulkGet(list) : []
    return found.filter((p): p is Patient => !!p)
  }, [key])
  return rows ? new Map(rows.map(p => [p.id, p])) : undefined
}

/** Photos of a few patients (the rows on screen), by id. */
export function usePatientPhotos(ids: string[]): Map<string, string> {
  const key = [...new Set(ids)].sort().join(',')
  const rows = useLiveQuery(async () => {
    const list = key ? key.split(',') : []
    const found = list.length ? await db.patients.bulkGet(list) : []
    return found.filter((p): p is Patient => !!p && !!p.photo).map(p => [p.id, p.photo!] as [string, string])
  }, [key])
  return new Map(rows ?? [])
}

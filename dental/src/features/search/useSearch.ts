// Data for the command palette. Patients (without photos), upcoming appointments and a slim list of invoices
// load once per opening and are searched in memory on every keystroke (no database work while typing).
// The last load is kept in memory, so the next opening shows results at once while a fresh copy loads.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Appointment } from '@/db/types'
import { indexPatient, rankPatients, searchInvoices, tokens, type PatientIndex, type Ranked, type SearchInvoice, type SearchPatient } from './lib'
import { useToday } from './alerts'

export const LIMIT = { patients: 8, appointments: 5, invoices: 5 }

export interface SlimPatient extends SearchPatient { hasPhoto: boolean }
interface Base { index: PatientIndex<SlimPatient>[]; byId: Map<string, SlimPatient>; apts: Appointment[] }
export interface SearchPerms { patients: boolean; appointments: boolean; billing: boolean }

// last result of each query, per signed-in role and day (module memory only: never persisted)
const cache = new Map<string, unknown>()
/** The live value, or the last one seen while it loads; `fresh` is false until this opening's own read lands. */
function useCachedLiveQuery<T>(key: string, query: () => Promise<T>, deps: unknown[]): { value: T | undefined; fresh: boolean } {
  const live = useLiveQuery(query, deps)
  if (live !== undefined) cache.set(key, live)
  return { value: live ?? (cache.get(key) as T | undefined), fresh: live !== undefined }
}

function useBase(perms: SearchPerms): { value: Base | undefined; fresh: boolean } {
  const today = useToday()
  const needPatients = perms.patients || perms.appointments || perms.billing
  return useCachedLiveQuery(`base:${today}:${needPatients}:${perms.appointments}`, async () => {
    const [patients, apts] = await Promise.all([
      needPatients ? db.patients.toArray() : Promise.resolve([]),
      perms.appointments ? db.appointments.where('date').aboveOrEqual(today).toArray() : Promise.resolve([] as Appointment[]),
    ])
    // keep the light fields only: photos are fetched for the few rows on screen
    const slim: SlimPatient[] = patients.map(p => ({
      id: p.id, name: p.name, fileNo: p.fileNo, phone: p.phone, phone2: p.phone2, nationalId: p.nationalId,
      archived: p.archived, lastVisit: p.lastVisit, gender: p.gender, birthDate: p.birthDate, hasPhoto: !!p.photo,
    }))
    return {
      index: slim.map(indexPatient),
      byId: new Map(slim.map(p => [p.id, p])),
      apts: apts.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)),
    }
  }, [today, needPatients, perms.appointments])
}

/** Every invoice, light fields only (one getAll per opening: far cheaper than walking the number index per keystroke). */
function useInvoices(billing: boolean): { value: SearchInvoice[] | undefined; fresh: boolean } {
  return useCachedLiveQuery(`invoices:${billing}`, async () => {
    if (!billing) return [] as SearchInvoice[]
    const rows = await db.invoices.toArray()
    return rows.map(({ id, number, patientId, date, total, status }) => ({ id, number, patientId, date, total, status }))
  }, [billing])
}

export interface SearchResults {
  ready: boolean                                   // this opening's own data has loaded (results may show earlier, from the last opening)
  patients: Ranked<SlimPatient>[]
  appointments: Appointment[]
  invoices: { invoice: SearchInvoice; score: number }[]
  byId: Map<string, SlimPatient>
  photos: Map<string, string>
}

export function useSearch(q: string, perms: SearchPerms, doctorNames: Map<string, string>): SearchResults {
  const { value: base, fresh: baseFresh } = useBase(perms)
  const { value: invoiceList, fresh: invoicesFresh } = useInvoices(perms.billing)
  const has = tokens(q).length > 0
  // every matching patient (for appointments / invoices), then the top ones for the list
  const ranked = useMemo(() => (base && has ? rankPatients(base.index, q) : []), [base, q, has])
  const patients = useMemo(() => (perms.patients ? ranked.slice(0, LIMIT.patients) : []), [ranked, perms.patients])

  const appointments = useMemo(() => {
    if (!base || !has || !perms.appointments) return []
    const score = new Map(ranked.map(r => [r.item.id, r.score]))
    const docs = new Set<string>()
    for (const [id, name] of doctorNames) if (rankPatients([indexPatient({ id, name, fileNo: -1 })], q).length) docs.add(id)
    // the patient's own appointments first, then the doctor's (both by time)
    const own = base.apts.filter(a => score.has(a.patientId))
    const byDoctor = docs.size ? base.apts.filter(a => !score.has(a.patientId) && docs.has(a.doctorId)) : []
    return [...own, ...byDoctor].slice(0, LIMIT.appointments)
  }, [base, ranked, has, q, perms.appointments, doctorNames])

  const invoices = useMemo(() => {
    if (!invoiceList || !has || !perms.billing) return NO_INVOICES
    return searchInvoices(invoiceList, q, ranked.slice(0, 10).map(r => r.item.id), LIMIT.invoices)
  }, [invoiceList, has, perms.billing, q, ranked])

  const photoIds = useMemo(() => {
    const ids = new Set<string>()
    for (const r of patients) if (r.item.hasPhoto) ids.add(r.item.id)
    return Array.from(ids).sort().join(',')
  }, [patients])
  const photos = useLiveQuery(async () => {
    const m = new Map<string, string>()
    if (!photoIds) return m
    const rows = await db.patients.bulkGet(photoIds.split(','))
    for (const p of rows) if (p?.photo) m.set(p.id, p.photo)
    return m
  }, [photoIds])

  const ready = baseFresh && invoicesFresh
  return useMemo(() => ({
    ready, patients, appointments, invoices,
    byId: base?.byId ?? NO_PATIENTS,
    photos: photos ?? NO_PHOTOS,
  }), [ready, patients, appointments, invoices, base, photos])
}
const NO_INVOICES: { invoice: SearchInvoice; score: number }[] = []
const NO_PATIENTS = new Map<string, SlimPatient>()
const NO_PHOTOS = new Map<string, string>()

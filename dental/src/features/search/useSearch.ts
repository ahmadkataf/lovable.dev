// Data for the command palette, without reading whole tables on every opening:
// - patients come from the shared in-memory patient index (read once per session, then patched from Dexie's change
//   events; no photos, no medical text), turned into a search index that is kept as long as that list does not change;
// - invoices: only the invoice-number index keys are read on opening (strings, no records); typing then fetches the
//   few invoices whose number matches and those of the best-matching patients, by index;
// - upcoming appointments (from today on) are read once per opening;
// - national ID numbers are not kept in the shared index: a long number that matches no name, phone or file number
//   is looked up in the patients table itself (see useNationalIdHits), so that rare search never slows the others.
import { useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Appointment, Invoice } from '@/db/types'
import { slimPatient, usePatientIndex, type SlimPatient as SharedPatient } from '@/features/billing/patientIndex'
import { digitsOnly, indexPatient, invoiceMatcher, looksLikeNumber, rankPatients, scorePatient, searchInvoices, tokens, type PatientIndex, type Ranked, type SearchInvoice } from './lib'
import { useToday } from './alerts'

export const LIMIT = { patients: 8, appointments: 5, invoices: 5 }

/** A patient of the shared index (national id included once the index carries it). */
export type SlimPatient = SharedPatient & { nationalId?: string }
export interface SearchPerms { patients: boolean; appointments: boolean; billing: boolean }

// The search index of the last patient list seen (module memory only: never persisted). Rebuilt only when the shared
// list changes (a patient added or edited), not on every opening of the palette.
let prepared: { src: SharedPatient[]; index: PatientIndex<SlimPatient>[] } | null = null
function searchIndexOf(list: SharedPatient[]): PatientIndex<SlimPatient>[] {
  if (prepared?.src !== list) prepared = { src: list, index: list.map(p => indexPatient(p as SlimPatient)) }
  return prepared.index
}

// last result of each query, per signed-in role and day (module memory only)
const cache = new Map<string, unknown>()
/** The live value, or the last one seen while it loads; `fresh` is false until this opening's own read lands. */
function useCachedLiveQuery<T>(key: string, query: () => Promise<T>, deps: unknown[]): { value: T | undefined; fresh: boolean } {
  const live = useLiveQuery(query, deps)
  if (live !== undefined) cache.set(key, live)
  return { value: live ?? (cache.get(key) as T | undefined), fresh: live !== undefined }
}

/** The best `limit` invoice numbers for a query (exact serial first), from the number index keys. */
export function bestNumbers(numbers: string[], q: string, limit = 20): string[] {
  const text = q.trim()
  if (!text || !(looksLikeNumber(text) || text.length >= 3)) return []
  const match = invoiceMatcher(text)
  const hits: { n: string; s: number }[] = []
  for (const n of numbers) { const s = match(n); if (s) hits.push({ n, s }) }
  hits.sort((a, b) => b.s - a.s || (a.n < b.n ? 1 : -1))
  return [...new Set(hits.slice(0, limit).map(h => h.n))]
}
const slimInvoice = ({ id, number, patientId, date, total, status }: Invoice): SearchInvoice => ({ id, number, patientId, date, total, status })

/** The digits of a query that can only be a national ID (8+ digits, nothing else typed), else ''. */
export function nationalIdQuery(q: string): string {
  const t = q.trim()
  if (!/^[\d\s\-/]+$/.test(t)) return ''
  const d = digitsOnly(t)
  return d.length >= 8 ? d : ''
}
/**
 * Patients whose national ID contains `digits`, read from the patients table. Only runs when the shared index found
 * nobody (`enabled`): the index carries no national IDs, and reading the table is kept for this one rare search.
 */
function useNationalIdHits(digits: string, enabled: boolean): { hits: Ranked<SlimPatient>[]; loading: boolean } {
  const on = !!digits && enabled
  const hits = useLiveQuery(async () => {
    if (!on) return NO_RANKED
    const rows = await db.patients.filter(p => !!p.nationalId && digitsOnly(p.nationalId).includes(digits)).limit(LIMIT.patients).toArray()
    return rows
      .map(p => { const item: SlimPatient = { ...slimPatient(p), nationalId: p.nationalId }; return { item, score: scorePatient(indexPatient(item), digits) } })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [digits, on])
  // while the table is read the palette shows its skeleton, not "no results"
  return { hits: on ? hits ?? NO_RANKED : NO_RANKED, loading: on && hits === undefined }
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
  const today = useToday()
  const needPatients = perms.patients || perms.appointments || perms.billing
  const shared = usePatientIndex(needPatients)
  const index = useMemo(() => (shared ? searchIndexOf(shared.list) : undefined), [shared])
  const byId = (shared?.byId ?? NO_PATIENTS) as Map<string, SlimPatient>

  const { value: apts, fresh: aptsFresh } = useCachedLiveQuery(`apts:${today}:${perms.appointments}`, async () => {
    if (!perms.appointments) return [] as Appointment[]
    const list = await db.appointments.where('date').aboveOrEqual(today).toArray()
    return list.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
  }, [today, perms.appointments])
  // the invoice numbers only (index keys: no invoice is read until something matches)
  // (walking the number index is slow on a phone with tens of thousands of invoices, so the list of the last opening
  // is used at once while this opening's copy loads, and a query that cannot match a number never waits for it)
  const { value: numbers } = useCachedLiveQuery(`invnums:${perms.billing}`, async () => (
    perms.billing ? (await db.invoices.orderBy('number').keys()).map(String) : []
  ), [perms.billing])

  const has = tokens(q).length > 0
  // every matching patient (for appointments / invoices), then the top ones for the list
  const fromIndex = useMemo(() => (index && has ? rankPatients(index, q) : []), [index, q, has])
  const nid = useNationalIdHits(nationalIdQuery(q), !!index && fromIndex.length === 0)
  const ranked = fromIndex.length ? fromIndex : nid.hits
  const patients = useMemo(() => (perms.patients ? ranked.slice(0, LIMIT.patients) : []), [ranked, perms.patients])

  const appointments = useMemo(() => {
    if (!apts || !has || !perms.appointments) return []
    const score = new Map(ranked.map(r => [r.item.id, r.score]))
    const docs = new Set<string>()
    for (const [id, name] of doctorNames) if (rankPatients([indexPatient({ id, name, fileNo: -1 })], q).length) docs.add(id)
    // the patient's own appointments first, then the doctor's (both by time)
    const own = apts.filter(a => score.has(a.patientId))
    const byDoctor = docs.size ? apts.filter(a => !score.has(a.patientId) && docs.has(a.doctorId)) : []
    return [...own, ...byDoctor].slice(0, LIMIT.appointments)
  }, [apts, ranked, has, q, perms.appointments, doctorNames])

  // invoices: the numbers that match and the invoices of the best-matching patients, fetched by index
  const topIds = ranked.slice(0, 10).map(r => r.item.id).join(',')
  const wanted = useMemo(() => (perms.billing && has && numbers ? bestNumbers(numbers, q) : []), [perms.billing, has, numbers, q])
  const found = useLiveQuery(async () => {
    if (!perms.billing || !has) return NO_INVOICES
    const ids = topIds ? topIds.split(',') : []
    const [byNumber, byPatient] = await Promise.all([
      wanted.length ? db.invoices.where('number').anyOf(wanted).toArray() : Promise.resolve([] as Invoice[]),
      ids.length ? db.invoices.where('patientId').anyOf(ids).toArray() : Promise.resolve([] as Invoice[]),
    ])
    const rows = new Map<string, SearchInvoice>()
    for (const inv of [...byNumber, ...byPatient]) rows.set(inv.id, slimInvoice(inv))
    return searchInvoices([...rows.values()], q, ids, LIMIT.invoices)
  }, [perms.billing, has, q, topIds, wanted.join('|')])
  // keep the last list while the next keystroke's invoices load, so the group does not blink
  const lastInvoices = useRef(NO_INVOICES)
  if (found !== undefined) lastInvoices.current = found
  const invoices = !perms.billing || !has ? NO_INVOICES : found ?? lastInvoices.current

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

  // invoice numbers are Latin letters and digits: a name typed in Arabic does not wait for them
  const numbersMatter = perms.billing && has && /[\dA-Za-z٠-٩۰-۹]/.test(q)
  const ready = (!needPatients || !!index) && aptsFresh && (!numbersMatter || numbers !== undefined) && !nid.loading
  return useMemo(() => ({
    ready, patients, appointments, invoices, byId,
    photos: photos ?? NO_PHOTOS,
  }), [ready, patients, appointments, invoices, byId, photos])
}
const NO_INVOICES: { invoice: SearchInvoice; score: number }[] = []
const NO_RANKED: Ranked<SlimPatient>[] = []
const NO_PATIENTS = new Map<string, SlimPatient>()
const NO_PHOTOS = new Map<string, string>()

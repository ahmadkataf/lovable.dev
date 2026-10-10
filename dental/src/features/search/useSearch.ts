// Data for the command palette. Patients (without photos) and upcoming appointments load once per opening;
// invoices are searched per query through the number index (keys only) and the matched patients.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import type { Appointment, Invoice } from '@/db/types'
import { indexPatient, invoiceNumberMatch, looksLikeNumber, rankPatients, tokens, type PatientIndex, type Ranked, type SearchPatient } from './lib'
import { useToday } from './alerts'

export const LIMIT = { patients: 8, appointments: 5, invoices: 5 }

export interface SlimPatient extends SearchPatient { hasPhoto: boolean }
interface Base { index: PatientIndex<SlimPatient>[]; byId: Map<string, SlimPatient>; apts: Appointment[] }

export interface SearchPerms { patients: boolean; appointments: boolean; billing: boolean }

function useBase(perms: SearchPerms): Base | undefined {
  const today = useToday()
  return useLiveQuery(async () => {
    const needPatients = perms.patients || perms.appointments || perms.billing
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
      apts: apts.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').sort((a, b) => a.start.localeCompare(b.start)),
    }
  }, [today, perms.patients, perms.appointments, perms.billing])
}

/** Invoices whose number matches, then the invoices of the best-matching patients (newest first). */
export async function findInvoices(q: string, patientIds: string[], limit = LIMIT.invoices): Promise<{ invoice: Invoice; score: number }[]> {
  const found = new Map<string, { invoice: Invoice; score: number }>()
  const compact = q.trim()
  if (compact && (looksLikeNumber(compact) || compact.length >= 3)) {
    const hits: { id: string; m: number }[] = []
    await db.invoices.orderBy('number').eachKey((key, cursor) => {
      const m = invoiceNumberMatch(String(key), compact)
      if (m) hits.push({ id: String(cursor.primaryKey), m })
    })
    hits.sort((a, b) => b.m - a.m)
    const top = hits.slice(0, limit * 4)
    const rows = await db.invoices.bulkGet(top.map(h => h.id))
    rows.forEach((inv, i) => { if (inv) found.set(inv.id, { invoice: inv, score: 100 + top[i].m * 10 }) })
  }
  if (patientIds.length) {
    const rank = new Map(patientIds.map((id, i) => [id, i]))
    const rows = await db.invoices.where('patientId').anyOf(patientIds).toArray()
    for (const inv of rows) if (!found.has(inv.id)) found.set(inv.id, { invoice: inv, score: 60 - Math.min(40, rank.get(inv.patientId) ?? 40) })
  }
  return Array.from(found.values())
    .sort((a, b) => b.score - a.score || b.invoice.date.localeCompare(a.invoice.date) || b.invoice.number.localeCompare(a.invoice.number))
    .slice(0, limit)
}

export interface SearchResults {
  ready: boolean                                   // everything for this query has landed
  patients: Ranked<SlimPatient>[]
  appointments: Appointment[]
  invoices: { invoice: Invoice; score: number }[]
  byId: Map<string, SlimPatient>
  photos: Map<string, string>
}

export function useSearch(q: string, perms: SearchPerms, doctorNames: Map<string, string>): SearchResults {
  const base = useBase(perms)
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

  const invoiceIds = useMemo(() => ranked.slice(0, 10).map(r => r.item.id), [ranked])
  const invKey = invoiceIds.join(',')
  const inv = useLiveQuery(async () => ({
    q, ids: invKey,
    list: perms.billing && has ? await findInvoices(q, invKey ? invKey.split(',') : []) : [],
  }), [q, invKey, perms.billing, has])

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

  const fresh = !!inv && inv.q === q && inv.ids === invKey
  const ready = !!base && (!has || fresh)
  return useMemo(() => ({
    ready, patients, appointments,
    invoices: inv?.list ?? NO_INVOICES,
    byId: base?.byId ?? NO_PATIENTS,
    photos: photos ?? NO_PHOTOS,
  }), [ready, patients, appointments, inv, base, photos])
}
const NO_INVOICES: { invoice: Invoice; score: number }[] = []
const NO_PATIENTS = new Map<string, SlimPatient>()
const NO_PHOTOS = new Map<string, string>()

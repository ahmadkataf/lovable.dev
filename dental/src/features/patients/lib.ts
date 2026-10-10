// Pure patients logic: balances, visits, search, filters, sorting, validation, plurals and file helpers.
// No database or React here, so everything is covered by tests/patients.test.ts.
import type { Appointment, FileKind, Gender, ISODate, Invoice, Patient, PatientFile, Payment } from '@/db/types'
import { matches, normalizeText, round2 } from '@/lib/format'

// ---- money ---------------------------------------------------------------------------------------
/** Invoices that count toward what the patient owes: everything except drafts and cancelled ones. */
export const isBillable = (status: Invoice['status']) => status !== 'draft' && status !== 'cancelled'

/** Balance due = sum(total of billable invoices) − sum(payments). Positive = the patient owes the clinic, negative = credit. */
export function patientBalance(invoices: Pick<Invoice, 'total' | 'status'>[], payments: Pick<Payment, 'amount'>[]): number {
  let due = 0
  for (const i of invoices) if (isBillable(i.status)) due += i.total || 0
  for (const p of payments) due -= p.amount || 0
  return round2(due)
}

/** Every patient's balance in one pass (for lists). Patients with no invoices and no payments are absent (= 0). */
export function balancesByPatient(invoices: Pick<Invoice, 'patientId' | 'total' | 'status'>[], payments: Pick<Payment, 'patientId' | 'amount'>[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const i of invoices) if (isBillable(i.status)) m.set(i.patientId, (m.get(i.patientId) ?? 0) + (i.total || 0))
  for (const p of payments) m.set(p.patientId, (m.get(p.patientId) ?? 0) - (p.amount || 0))
  for (const [k, v] of m) m.set(k, round2(v))
  return m
}
/** True when the amount is a real debt (ignores floating dust). */
export const owes = (balance: number | undefined) => (balance ?? 0) > 0.004

// ---- visits & appointments -----------------------------------------------------------------------
const VISIT_STATUSES: Appointment['status'][] = ['completed', 'arrived', 'in_progress']
const NOT_UPCOMING: Appointment['status'][] = ['cancelled', 'no_show']

/** The latest attended visit (completed / arrived / in progress, not in the future) per patient, as an ISO instant. */
export function lastVisitsByPatient(appointments: Pick<Appointment, 'patientId' | 'start' | 'status'>[], now: string = new Date().toISOString()): Map<string, string> {
  const m = new Map<string, string>()
  for (const a of appointments) {
    if (!VISIT_STATUSES.includes(a.status) || a.start > now) continue
    const cur = m.get(a.patientId)
    if (!cur || a.start > cur) m.set(a.patientId, a.start)
  }
  return m
}
/** The most recent of the stored lastVisit and the one derived from appointments. */
export function latestOf(...isos: (string | undefined)[]): string | undefined {
  let best: string | undefined
  for (const s of isos) if (s && (!best || s > best)) best = s
  return best
}
/** The next appointment that is still expected: start ≥ now and not cancelled / no-show. */
export function nextAppointment<T extends Pick<Appointment, 'start' | 'status'>>(appointments: T[], now: string = new Date().toISOString()): T | undefined {
  return upcomingAppointments(appointments, now)[0]
}
export function upcomingAppointments<T extends Pick<Appointment, 'start' | 'status'>>(appointments: T[], now: string = new Date().toISOString()): T[] {
  return appointments.filter(a => a.start >= now && !NOT_UPCOMING.includes(a.status)).sort((a, b) => a.start.localeCompare(b.start))
}

// ---- search, filters, sorting --------------------------------------------------------------------
/** Digits only, Arabic-Indic digits converted (٠١٢ → 012). */
export function digitsOnly(s?: string): string {
  return (s || '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, '')
}

export type SearchablePatient = Pick<Patient, 'name' | 'fileNo'> & Partial<Pick<Patient, 'phone' | 'phone2' | 'nationalId' | 'email'>>
/**
 * Arabic-aware search over name, phone(s), file number, national id and email.
 * Every word of the query must match something: "أحمد 0944" finds Ahmad whose phone contains 0944.
 * A numeric word matches the file number (exactly or as a prefix) and, from 3 digits on, any phone / national id.
 */
export function fullSearch(p: SearchablePatient, q: string): boolean {
  const query = normalizeText(q)
  if (!query) return true
  const numbers = [p.phone, p.phone2, p.nationalId].map(digitsOnly).join(' ')
  const file = String(p.fileNo ?? '')
  return query.split(/\s+/).filter(Boolean).every(tok => {
    if (matches(p.name, tok)) return true
    const bare = tok.replace(/^[#+]/, '')
    const d = digitsOnly(bare)
    if (d && d.length === bare.length) {
      if (file === d || file.startsWith(d)) return true
      if (d.length >= 3 && numbers.includes(d)) return true
    }
    return matches(p.nationalId, tok) || matches(p.email, tok)
  })
}

export type GenderFilter = 'all' | Gender
export type QuickFilter = 'all' | 'new' | 'balance'
export interface PatientFilters {
  q: string
  gender: GenderFilter
  doctorId: string          // '' = any doctor
  tag: string               // '' = any tag
  archived: boolean         // true = show only archived files, false = only active ones
  quick: QuickFilter        // stat-card shortcuts: new this month / owing money
}
export const DEFAULT_FILTERS: PatientFilters = { q: '', gender: 'all', doctorId: '', tag: '', archived: false, quick: 'all' }
/** Whether anything narrows the list (beyond the archived switch, which is a view, not a filter). */
export const hasActiveFilters = (f: PatientFilters) => !!f.q.trim() || f.gender !== 'all' || !!f.doctorId || !!f.tag || f.quick !== 'all'

export interface ListContext { balances: Map<string, number>; lastVisits: Map<string, string>; monthStart: string }

/** Start of the current local month as an ISO instant (comparable with createdAt). */
export function monthStartISO(now: Date = new Date()): string { return new Date(now.getFullYear(), now.getMonth(), 1).toISOString() }

export function filterPatients<T extends Patient>(list: T[], f: PatientFilters, ctx: Pick<ListContext, 'balances' | 'monthStart'>): T[] {
  return list.filter(p =>
    !!p.archived === f.archived
    && (f.gender === 'all' || p.gender === f.gender)
    && (!f.doctorId || p.doctorId === f.doctorId)
    && (!f.tag || (p.tags ?? []).includes(f.tag))
    && (f.quick !== 'new' || p.createdAt >= ctx.monthStart)
    && (f.quick !== 'balance' || owes(ctx.balances.get(p.id)))
    && fullSearch(p, f.q))
}

export type PatientSort = 'recent' | 'name' | 'lastVisit' | 'balance'
export const SORTS: PatientSort[] = ['recent', 'name', 'lastVisit', 'balance']

export function sortPatients<T extends Patient>(list: T[], sort: PatientSort, ctx: Pick<ListContext, 'balances' | 'lastVisits'>, lang: 'ar' | 'en' = 'ar'): T[] {
  const out = [...list]
  const visit = (p: T) => latestOf(p.lastVisit, ctx.lastVisits.get(p.id)) ?? ''
  const bal = (p: T) => ctx.balances.get(p.id) ?? 0
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, lang)
  switch (sort) {
    case 'name': return out.sort(byName)
    case 'lastVisit': return out.sort((a, b) => visit(b).localeCompare(visit(a)) || byName(a, b))
    case 'balance': return out.sort((a, b) => bal(b) - bal(a) || byName(a, b))
    default: return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.fileNo - a.fileNo)
  }
}

export interface PatientStats { total: number; newThisMonth: number; withBalance: number }
/** Counts over active (not archived) files. */
export function patientStats(list: Pick<Patient, 'id' | 'archived' | 'createdAt'>[], balances: Map<string, number>, monthStart: string): PatientStats {
  let total = 0, newThisMonth = 0, withBalance = 0
  for (const p of list) {
    if (p.archived) continue
    total++
    if (p.createdAt >= monthStart) newThisMonth++
    if (owes(balances.get(p.id))) withBalance++
  }
  return { total, newThisMonth, withBalance }
}

/** Every tag in use, alphabetical. */
export function allTags(list: Pick<Patient, 'tags'>[], lang: 'ar' | 'en' = 'ar'): string[] {
  const s = new Set<string>()
  for (const p of list) for (const t of p.tags ?? []) if (t.trim()) s.add(t.trim())
  return [...s].sort((a, b) => a.localeCompare(b, lang))
}

export interface MedicalFlags { allergies: boolean; chronic: boolean; medications: boolean; any: boolean }
export function medicalFlags(p: Partial<Pick<Patient, 'allergies' | 'chronicDiseases' | 'medications'>>): MedicalFlags {
  const allergies = (p.allergies?.length ?? 0) > 0, chronic = (p.chronicDiseases?.length ?? 0) > 0, medications = (p.medications?.length ?? 0) > 0
  return { allergies, chronic, medications, any: allergies || chronic || medications }
}

// ---- validation ----------------------------------------------------------------------------------
/** What the user may type in a phone box: digits (Latin or Arabic-Indic, converted), +, spaces, dashes. */
export function sanitizePhoneInput(s: string): string {
  const latin = s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  return latin.replace(/[^\d+\s-]/g, '').replace(/(?!^)\+/g, '')
}
/** The stored form: digits with an optional leading +. */
export function cleanPhone(s?: string): string {
  const v = sanitizePhoneInput((s || '').trim())
  return (v.startsWith('+') ? '+' : '') + digitsOnly(v)
}
export function isValidPhone(s?: string): boolean {
  const v = (s || '').trim()
  if (!/^\+?[\d٠-٩۰-۹\s-]+$/.test(v)) return false
  const n = digitsOnly(v).length
  return n >= 6 && n <= 15
}
export function isValidEmail(s?: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || '').trim())
}
/** A real calendar date in 'YYYY-MM-DD' form. */
export function isRealDate(s?: string): boolean {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export interface PatientDraftCore { name: string; phone: string; phone2?: string; email?: string; birthDate?: string }
export type PatientField = 'name' | 'phone' | 'phone2' | 'email' | 'birthDate'
/** Field → i18n key of the message. Empty object = valid. */
export type PatientErrors = Partial<Record<PatientField, string>>
export function validatePatient(d: PatientDraftCore, todayDate: ISODate): PatientErrors {
  const e: PatientErrors = {}
  const name = d.name.trim()
  if (!name) e.name = 'v.required'
  else if (name.length < 2) e.name = 'patients.v.nameShort'
  if (!d.phone.trim()) e.phone = 'v.required'
  else if (!isValidPhone(d.phone)) e.phone = 'v.phone'
  if (d.phone2?.trim() && !isValidPhone(d.phone2)) e.phone2 = 'v.phone'
  if (d.email?.trim() && !isValidEmail(d.email)) e.email = 'v.email'
  if (d.birthDate) {
    if (!isRealDate(d.birthDate) || d.birthDate < '1900-01-01') e.birthDate = 'v.date'
    else if (d.birthDate > todayDate) e.birthDate = 'patients.v.futureDate'
  }
  return e
}

/** Another patient with the same phone number (compared on digits), if any. */
export function findDuplicatePhone<T extends Pick<Patient, 'id' | 'phone' | 'phone2'>>(list: T[], phone: string, excludeId?: string): T | undefined {
  const d = digitsOnly(phone)
  if (d.length < 6) return undefined
  return list.find(p => p.id !== excludeId && (digitsOnly(p.phone) === d || digitsOnly(p.phone2) === d))
}

// ---- chip lists (allergies, diseases, tags…) -----------------------------------------------------
/** Adds the comma-separated items of `raw` to `list`, trimmed, without duplicates (Arabic-aware comparison). */
export function addChips(list: string[], raw: string): string[] {
  const out = [...list]
  const seen = new Set(out.map(normalizeText))
  for (const part of raw.split(/[,،؛;\n]/)) {
    const v = part.trim().replace(/\s+/g, ' ')
    if (!v) continue
    const k = normalizeText(v)
    if (seen.has(k)) continue
    seen.add(k); out.push(v)
  }
  return out
}
export const hasChip = (list: string[], v: string) => list.some(x => normalizeText(x) === normalizeText(v))
export const removeChip = (list: string[], v: string) => list.filter(x => x !== v)

// ---- plurals (CLDR Arabic rules; English uses the same keys) --------------------------------------
export type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'
export function pluralForm(n: number): PluralForm {
  const i = Math.abs(Math.trunc(n)), m = i % 100
  if (i === 0) return 'zero'
  if (i === 1) return 'one'
  if (i === 2) return 'two'
  if (m >= 3 && m <= 10) return 'few'
  if (m >= 11 && m <= 99) return 'many'
  return 'other'
}

// ---- files ---------------------------------------------------------------------------------------
export const MAX_FILE_MB = 25
export type FileShape = 'image' | 'pdf' | 'other'
export function fileShape(mime?: string, name?: string): FileShape {
  const m = (mime || '').toLowerCase(), n = (name || '').toLowerCase()
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic)$/.test(n)) return 'image'
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'
  return 'other'
}
/** A sensible default kind for a new upload. */
export function guessKind(mime?: string, name?: string): FileKind {
  const n = (name || '').toLowerCase()
  if (/x-?ray|xray|opg|pano|cbct|bitewing|periapical|اشعه|أشعة|بانوراما/.test(n)) return 'xray'
  if (/consent|موافق|اقرار|إقرار/.test(n)) return 'consent'
  const s = fileShape(mime, name)
  return s === 'image' ? 'photo' : s === 'pdf' ? 'document' : 'other'
}
/** FDI tooth number: permanent 11–48, primary 51–85. */
export function isValidTooth(n: number | null | undefined): boolean {
  if (n === null || n === undefined || !Number.isInteger(n)) return false
  const q = Math.floor(n / 10), u = n % 10
  return (q >= 1 && q <= 4 && u >= 1 && u <= 8) || (q >= 5 && q <= 8 && u >= 1 && u <= 5)
}
export function countByKind(files: Pick<PatientFile, 'kind'>[]): Record<FileKind | 'all', number> {
  const c: Record<FileKind | 'all', number> = { all: files.length, xray: 0, photo: 0, document: 0, consent: 0, other: 0 }
  for (const f of files) c[f.kind in c ? f.kind : 'other']++
  return c
}
/** Newest first by date, then by creation instant. */
export function sortNotes<T extends { date: string; createdAt: string }>(notes: T[]): T[] {
  return [...notes].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

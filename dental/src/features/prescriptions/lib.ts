// Pure helpers of the prescriptions module: presets for the item fields, item builders, the list filters and the
// plain-text version of a prescription (WhatsApp). No React, no database: everything here is unit-tested.
import type { Drug, ISODate, Lang, Patient, Prescription, PrescriptionItem } from '@/db/types'
import { newId } from '@/db/ids'
import { addDays, startOfMonth } from '@/lib/dates'
import { matches } from '@/lib/format'

// ---- presets ------------------------------------------------------------------------------------

/** Common dosing patterns, offered in the frequency field (free text stays possible). */
export const FREQUENCY_PRESETS: Record<Lang, string[]> = {
  ar: ['مرة يومياً', 'مرتين يومياً', '3 مرات يومياً', 'كل 12 ساعة', 'كل 8 ساعات', 'كل 6 ساعات', 'صباحاً', 'قبل النوم', 'عند اللزوم'],
  en: ['Once daily', 'Twice daily', 'Three times daily', 'Every 12 hours', 'Every 8 hours', 'Every 6 hours', 'In the morning', 'At bedtime', 'As needed'],
}
/** Course lengths in days offered in the duration field. */
export const DURATION_DAYS = [3, 5, 7, 10, 14] as const
/** "5 أيام" / "5 days" — Arabic counts 3–10 take the plural, 11+ the singular accusative. */
export function durationLabel(days: number, lang: Lang): string {
  if (lang === 'en') return days === 1 ? '1 day' : `${days} days`
  if (days === 1) return 'يوم واحد'
  if (days === 2) return 'يومان'
  if (days <= 10) return `${days} أيام`
  return `${days} يوماً`
}
export function durationPresets(lang: Lang): string[] {
  return [...DURATION_DAYS.map(d => durationLabel(d, lang)), lang === 'ar' ? 'عند اللزوم' : 'As needed']
}
/** How to take it. */
export const INSTRUCTION_PRESETS: Record<Lang, string[]> = {
  ar: ['بعد الطعام', 'قبل الطعام', 'مع الطعام', 'على الريق', 'قبل النوم', 'مضمضة دون بلع', 'يُذاب في كأس ماء', 'يُكمل العلاج كاملاً'],
  en: ['After meals', 'Before meals', 'With food', 'On an empty stomach', 'At bedtime', 'Rinse, do not swallow', 'Dissolve in a glass of water', 'Complete the full course'],
}

// ---- items --------------------------------------------------------------------------------------

/** An editable row of the form (all strings, never undefined). */
export interface ItemDraft {
  key: string
  drugId?: string
  name: string
  strength: string
  dose: string
  frequency: string
  duration: string
  instructions: string
}
export function emptyItem(name = ''): ItemDraft {
  return { key: newId(), name, strength: '', dose: '', frequency: '', duration: '', instructions: '' }
}
/** A row filled from the catalogue defaults; the name follows the language the doctor works in. */
export function itemFromDrug(d: Drug, lang: Lang): ItemDraft {
  const name = lang === 'en' ? d.nameEn || d.name : d.name || d.nameEn || ''
  return {
    key: newId(), drugId: d.id, name, strength: d.strength ?? '', dose: d.defaultDose ?? '', frequency: d.defaultFrequency ?? '',
    duration: d.defaultDuration ?? '', instructions: d.defaultInstructions ?? '',
  }
}
export function itemToDraft(i: PrescriptionItem): ItemDraft {
  return {
    key: newId(), drugId: i.drugId, name: i.name ?? '', strength: i.strength ?? '', dose: i.dose ?? '', frequency: i.frequency ?? '',
    duration: i.duration ?? '', instructions: i.instructions ?? '',
  }
}
/** True when nothing was typed in the row (such rows are dropped on save, never reported as errors). */
export function isBlankItem(d: ItemDraft): boolean {
  return ![d.name, d.strength, d.dose, d.frequency, d.duration, d.instructions].some(v => v.trim())
}
/** The rows as stored: trimmed, blank rows dropped, empty optional fields removed. Keeps the row key as the item id. */
export function draftsToItems(list: ItemDraft[]): PrescriptionItem[] {
  return list.filter(d => !isBlankItem(d)).map(d => {
    const it: PrescriptionItem = { id: d.key, name: d.name.trim(), dose: d.dose.trim(), frequency: d.frequency.trim(), duration: d.duration.trim() }
    if (d.drugId) it.drugId = d.drugId
    if (d.strength.trim()) it.strength = d.strength.trim()
    if (d.instructions.trim()) it.instructions = d.instructions.trim()
    return it
  })
}
/** Copies of the items with fresh ids, for "duplicate as new". */
export function duplicateItems(items: PrescriptionItem[]): PrescriptionItem[] {
  return items.map(i => ({ ...i, id: newId() }))
}
/** What a new prescription copied from `rx` starts with (the date is left to the form: today). */
export function duplicateDefaults(rx: Prescription): { patientId: string; doctorId: string; diagnosis?: string; notes?: string; items: PrescriptionItem[] } {
  return { patientId: rx.patientId, doctorId: rx.doctorId, diagnosis: rx.diagnosis, notes: rx.notes, items: duplicateItems(rx.items) }
}

export interface RxErrors { patient?: boolean; doctor?: boolean; date?: boolean; items?: boolean; names: string[] }
/** Validates the form: patient, doctor, date, at least one row, and a name on every row that has any content. */
export function validatePrescription(f: { patientId?: string; doctorId?: string; date?: string; items: ItemDraft[] }): RxErrors {
  const rows = f.items.filter(d => !isBlankItem(d))
  const e: RxErrors = { names: rows.filter(d => !d.name.trim()).map(d => d.key) }
  if (!f.patientId) e.patient = true
  if (!f.doctorId) e.doctor = true
  if (!f.date || !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) e.date = true
  if (rows.length === 0) e.items = true
  return e
}
export function hasErrors(e: RxErrors): boolean {
  return !!(e.patient || e.doctor || e.date || e.items || e.names.length)
}

/** The first `max` drug names and how many more there are: "Amoxicillin، Ibuprofen +2". */
export function itemsSummary(items: PrescriptionItem[], max = 2): { names: string[]; more: number } {
  const names = items.map(i => i.name).filter(Boolean)
  return { names: names.slice(0, max), more: Math.max(0, names.length - max) }
}
/** "Amoxicillin 500 mg" — the strength is appended unless the name already contains it. */
export function itemTitle(i: Pick<PrescriptionItem, 'name' | 'strength'>): string {
  const s = (i.strength ?? '').trim()
  return s && !i.name.includes(s) ? `${i.name} ${s}` : i.name
}
/** Dose, frequency and duration joined for one line, skipping empty parts. */
export function regimenLine(i: Pick<PrescriptionItem, 'dose' | 'frequency' | 'duration'>, sep = ' — '): string {
  return [i.dose, i.frequency, i.duration].map(s => (s ?? '').trim()).filter(Boolean).join(sep)
}

// ---- catalogue search ----------------------------------------------------------------------------

/** Active drugs matching the query (name, English name, form or strength), best matches first. */
export function searchDrugs(drugs: Drug[], q: string, limit = 8): Drug[] {
  const active = drugs.filter(d => d.active)
  const query = q.trim()
  if (!query) return active.slice(0, limit)
  const scored: { d: Drug; s: number }[] = []
  for (const d of active) {
    const hay = [d.name, d.nameEn, d.form, d.strength]
    if (!query.split(/\s+/).every(w => hay.some(h => matches(h, w)))) continue
    const starts = [d.name, d.nameEn].some(h => matches((h ?? '').slice(0, query.length), query))
    scored.push({ d, s: starts ? 0 : 1 })
  }
  return scored.sort((a, b) => a.s - b.s).slice(0, limit).map(x => x.d)
}

// ---- list filters --------------------------------------------------------------------------------

export type DatePreset = 'all' | 'today' | 'last7' | 'last30' | 'thisMonth'
export const DATE_PRESETS: DatePreset[] = ['all', 'today', 'last7', 'last30', 'thisMonth']
/** The inclusive date range of a preset, or null for "all". */
export function presetRange(p: DatePreset, today: ISODate): { from: ISODate; to: ISODate } | null {
  switch (p) {
    case 'today': return { from: today, to: today }
    case 'last7': return { from: addDays(today, -6), to: today }
    case 'last30': return { from: addDays(today, -29), to: today }
    case 'thisMonth': return { from: startOfMonth(today), to: today }
    default: return null
  }
}
export function filterPrescriptions(list: Prescription[], f: { q: string; preset: DatePreset; today: ISODate; patients: Map<string, Patient> }): Prescription[] {
  const r = presetRange(f.preset, f.today)
  const q = f.q.trim()
  return list.filter(p => {
    if (r && (p.date < r.from || p.date > r.to)) return false
    if (!q) return true
    const pt = f.patients.get(p.patientId)
    return matches(pt?.name, q) || (pt ? String(pt.fileNo) === q.replace(/^#/, '') : false) || matches(p.diagnosis, q) || p.items.some(i => matches(i.name, q))
  })
}
/** Newest first: by date, then by creation time. */
export function sortPrescriptions(list: Prescription[]): Prescription[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''))
}

// ---- text version (WhatsApp) ---------------------------------------------------------------------

export interface RxTextLabels {
  title: string        // 'وصفة طبية'
  patient: string
  doctor: string
  diagnosis: string
  notes: string
}
export interface RxTextInput {
  clinicName?: string
  clinicPhone?: string
  doctorName?: string
  patientName?: string
  dateLabel: string    // already formatted for the language
  diagnosis?: string
  notes?: string
  footer?: string
  items: PrescriptionItem[]
  labels: RxTextLabels
}
/** A plain-text prescription for messaging apps: bold headings with *…*, numbered items, empty parts skipped. */
export function buildRxText(x: RxTextInput): string {
  const lines: string[] = []
  if (x.clinicName?.trim()) lines.push(`*${x.clinicName.trim()}*`)
  lines.push(`${x.labels.title} — ${x.dateLabel}`)
  if (x.patientName?.trim()) lines.push(`${x.labels.patient}: ${x.patientName.trim()}`)
  if (x.doctorName?.trim()) lines.push(`${x.labels.doctor}: ${x.doctorName.trim()}`)
  if (x.diagnosis?.trim()) lines.push(`${x.labels.diagnosis}: ${x.diagnosis.trim()}`)
  lines.push('')
  x.items.forEach((i, n) => {
    lines.push(`${n + 1}. *${itemTitle(i)}*`)
    const reg = regimenLine(i)
    if (reg) lines.push(`   ${reg}`)
    if (i.instructions?.trim()) lines.push(`   ${i.instructions.trim()}`)
  })
  if (x.notes?.trim()) { lines.push(''); lines.push(`${x.labels.notes}: ${x.notes.trim()}`) }
  if (x.footer?.trim()) { lines.push(''); lines.push(x.footer.trim()) }
  if (x.clinicPhone?.trim()) lines.push(x.clinicPhone.trim())
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

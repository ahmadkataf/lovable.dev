// Finding patients without reading the whole patients table (a clinic can hold thousands of files, photos included).
//
// - Index queries (indexSearch, phoneOwner) answer at once from the name / fileNo / phone / createdAt indexes.
// - The shared in-memory patient index (one copy for the whole app, read once in the background and then patched from
//   Dexie's change events) adds the Arabic-aware matches anywhere in a name and in second phones. It lives with the
//   billing pickers that introduced it and is re-exported here so the clinical screens use the very same copy.
import { db } from '@/db'
import type { Patient } from '@/db/types'
import { formatPhone } from '@/lib/format'
import { digitsOnly } from './lib'

export { ensurePatientIndex, usePagePatients, usePatientIndex, usePatientPhotos, type PatientIndex, type SlimPatient } from '@/features/billing/patientIndex'

// ---- index queries (instant, no full read) -------------------------------------------------------

const ALEFS = ['ا', 'أ', 'إ', 'آ']
/**
 * Name prefixes to look up in the `name` index for what was typed: the common spelling variants of an Arabic first
 * letter (ا أ إ آ) and of the last letter (ة/ه, ى/ي), so "احمد" also finds "أحمد".
 */
export function namePrefixVariants(q: string): string[] {
  const s = q.trim().replace(/\s+/g, ' ')
  if (!s) return []
  const firsts = ALEFS.includes(s[0]) ? ALEFS : [s[0]]
  const last = s.length > 1 ? s[s.length - 1] : ''
  const lasts = last === 'ة' || last === 'ه' ? ['ة', 'ه'] : last === 'ى' || last === 'ي' ? ['ى', 'ي'] : [last]
  const mid = s.length > 1 ? s.slice(1, -1) : ''
  const out = new Set<string>()
  for (const f of firsts) for (const l of lasts) out.add(s.length > 1 ? f + mid + l : f)
  return [...out]
}
/** The start of a number written in groups, as formatPhone() stores it: "0944 123 456", "+963 944 123 456". */
function grouped(raw: string): string {
  if (/^0\d*$/.test(raw) && raw.length <= 10) return [raw.slice(0, 4), raw.slice(4, 7), raw.slice(7)].filter(Boolean).join(' ')
  if (/^\+\d*$/.test(raw) && raw.length <= 14) return [raw.slice(0, 4), raw.slice(4, 7), raw.slice(7, 10), raw.slice(10)].filter(Boolean).join(' ')
  return raw
}
/** Phone prefixes as they may be stored: plain digits, or written in groups ("0944 123 456"). */
export function phonePrefixVariants(typed: string): string[] {
  const d = digitsOnly(typed)
  if (d.length < 3) return []
  const raw = (typed.trim().startsWith('+') ? '+' : '') + d
  return [...new Set([raw, grouped(raw)])]
}

/**
 * Up to `max` patients that match what was typed, straight from the indexes: a file number (exact, then the numbers
 * that start with it), the start of a phone number, or the start of the full name. Empty query: the newest files.
 * Archived files are left out unless `withArchived`.
 */
export async function indexSearch(query: string, max = 8, withArchived = false): Promise<Patient[]> {
  const q = query.trim()
  const keep = (list: (Patient | undefined)[]) => {
    const seen = new Set<string>(), out: Patient[] = []
    for (const p of list) if (p && !seen.has(p.id) && (withArchived || !p.archived)) { seen.add(p.id); out.push(p) }
    return out.slice(0, max)
  }
  if (!q) return keep(await db.patients.orderBy('createdAt').reverse().limit(max * 3).toArray())
  const bare = q.replace(/^[#+]/, '')
  const digits = digitsOnly(bare)
  if (digits && /^[\d٠-٩۰-۹\s#+()-]+$/.test(q)) {
    const n = Number(digits)
    const [exact, prefixed, byPhone] = await Promise.all([
      db.patients.where('fileNo').equals(n).toArray(),
      digits.length <= 5 ? db.patients.where('fileNo').between(n * 10, n * 10 + 10, true, false).limit(max).toArray() : Promise.resolve([]),
      digits.length >= 3 ? db.patients.where('phone').startsWithAnyOf(phonePrefixVariants(q)).limit(max * 2).toArray() : Promise.resolve([]),
    ])
    return keep([...exact, ...byPhone, ...prefixed])
  }
  return keep(await db.patients.where('name').startsWithAnyOf(namePrefixVariants(q)).limit(max * 3).toArray())
}

/** Another patient whose main phone is this number (index lookup on the stored forms). */
export async function phoneOwner(phone: string, excludeId?: string): Promise<Patient | undefined> {
  const d = digitsOnly(phone)
  if (d.length < 6) return undefined
  const plus = phone.trim().startsWith('+')
  const forms = [...new Set([(plus ? '+' : '') + d, formatPhone((plus ? '+' : '') + d)])]
  const list = await db.patients.where('phone').anyOf(forms).toArray()
  return list.find(p => p.id !== excludeId)
}

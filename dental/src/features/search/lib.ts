// Pure search logic for the command palette: Arabic-aware patient ranking, invoice-number matching,
// match highlighting, recent searches and plural phrases. No database or React here (tests/search.test.ts).
import type { Patient } from '@/db/types'
import { normalizeText } from '@/lib/format'

// ---- normalisation ---------------------------------------------------------------------------------
/** Digits only; Arabic-Indic (٠١٢) and Persian (۰۱۲) digits become Latin. */
export function digitsOnly(s?: string | number): string {
  return String(s ?? '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\D/g, '')
}
/** normalizeText + Persian digits/letters folded too (ک → ك, ی → ي) and runs of spaces collapsed. */
export function norm(s?: string): string {
  return normalizeText(s || '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/ک/g, 'ك').replace(/ی/g, 'ي')
    .replace(/\s+/g, ' ')
}
/** Query words, normalised; empty words dropped. */
export function tokens(q: string): string[] {
  return norm(q).split(' ').filter(Boolean)
}
const AL = 'ال'
/** A word without the Arabic definite article, so "خطيب" finds "الخطيب" as a word start. */
function bare(word: string): string {
  return word.startsWith(AL) && word.length > 3 ? word.slice(2) : word
}

// ---- patients ---------------------------------------------------------------------------------------
export type SearchPatient = Pick<Patient, 'id' | 'name' | 'fileNo'> & Partial<Pick<Patient, 'phone' | 'phone2' | 'nationalId' | 'archived' | 'lastVisit' | 'gender' | 'birthDate'>>

/** Pre-normalised fields of one patient (build once, score on every keystroke). */
export interface PatientIndex<P extends SearchPatient = SearchPatient> {
  p: P
  name: string          // normalised full name
  words: string[]       // normalised words, plus their article-less forms
  compact: string       // name without spaces ("عبد الله" ≈ "عبدالله")
  file: string
  phones: string[]      // digits
  nid: string           // digits (or the normalised text when it has letters)
}
export function indexPatient<P extends SearchPatient>(p: P): PatientIndex<P> {
  const name = norm(p.name)
  const raw = name.split(' ').filter(Boolean)
  const words = Array.from(new Set([...raw, ...raw.map(bare)]))
  const nidDigits = digitsOnly(p.nationalId)
  return {
    p, name, words, compact: name.replace(/ /g, ''),
    file: String(p.fileNo ?? ''),
    phones: [p.phone, p.phone2].map(x => digitsOnly(x)).filter(Boolean),
    nid: nidDigits || norm(p.nationalId),
  }
}

/** Score of one query word against one patient; 0 = no match. */
function scoreToken(ix: PatientIndex, tok: string): number {
  let best = 0
  const add = (s: number) => { if (s > best) best = s }
  const plain = tok.replace(/^[#+]/, '')
  const d = digitsOnly(plain)
  const numeric = d.length > 0 && d.length === plain.length
  if (numeric) {
    if (ix.file === d) add(100)
    else if (ix.file.startsWith(d)) add(70)
    if (d.length >= 3) {
      for (const ph of ix.phones) {
        // phones are typed with or without the leading zero / country code
        const local = ph.replace(/^(00|\+)?963/, '0')
        if (ph === d || local === d) add(95)
        else if (ph.startsWith(d) || local.startsWith(d)) add(80)
        else if (ph.endsWith(d)) add(75)
        else if (ph.includes(d)) add(55)
      }
      if (ix.nid) {
        if (ix.nid === d) add(90)
        else if (ix.nid.startsWith(d)) add(60)
        else if (ix.nid.includes(d)) add(45)
      }
    }
  }
  if (ix.name === tok) add(98)
  else if (ix.name.startsWith(tok)) add(88)
  if (ix.words.includes(tok)) add(82)
  else if (ix.words.some(w => w.startsWith(tok))) add(72)
  else if (ix.name.includes(tok)) add(50)
  else if (tok.length >= 3 && ix.compact.includes(tok)) add(40)
  if (!numeric && ix.nid && tok.length >= 3 && ix.nid.includes(tok)) add(40)
  return best
}

/**
 * Relevance of a patient for the query (0 = not a match). Every word must match something
 * (name word, file number, phone, national id); the whole query as a phrase scores higher.
 * Archived files rank below active ones but stay findable.
 */
export function scorePatient(ix: PatientIndex, q: string): number {
  const toks = tokens(q)
  if (!toks.length) return 0
  let total = 0
  for (const tok of toks) {
    const s = scoreToken(ix, tok)
    if (!s) return 0
    total += s
  }
  let score = total / toks.length
  if (toks.length > 1) {
    const phrase = toks.join(' ')
    if (ix.name.startsWith(phrase)) score += 12
    else if (ix.name.includes(phrase)) score += 6
  }
  if (ix.p.archived) score -= 30
  return Math.max(1, score)
}

export interface Ranked<T> { item: T; score: number }
/** Matches sorted by score, then most recent visit, then name. */
export function rankPatients<P extends SearchPatient>(index: PatientIndex<P>[], q: string, limit = Infinity): Ranked<P>[] {
  if (!tokens(q).length) return []
  const out: Ranked<P>[] = []
  for (const ix of index) {
    const score = scorePatient(ix, q)
    if (score > 0) out.push({ item: ix.p, score })
  }
  out.sort((a, b) => b.score - a.score
    || (b.item.lastVisit || '').localeCompare(a.item.lastVisit || '')
    || a.item.name.localeCompare(b.item.name, 'ar'))
  return out.slice(0, limit)
}

// ---- invoices ---------------------------------------------------------------------------------------
/**
 * How well an invoice number matches the query: 3 exact ("INV-000123" ← "123", "inv-000123", "000123"),
 * 2 prefix of the serial ("12" → 123), 1 contains, 0 no match.
 */
export function invoiceNumberMatch(number: string, q: string): 0 | 1 | 2 | 3 {
  const nq = norm(q).replace(/\s+/g, '')
  if (!nq || !number) return 0
  const nn = norm(number)
  if (nn === nq) return 3
  const serial = digitsOnly(number).replace(/^0+/, '') || '0'
  const plain = nq.replace(/^#/, '')
  const qd = digitsOnly(plain)
  if (qd && qd.length === plain.length) {
    const qs = qd.replace(/^0+/, '') || '0'
    if (serial === qs) return 3
    if (serial.startsWith(qs)) return 2
    if (digitsOnly(number).includes(qd)) return 1
    return 0
  }
  if (nn.startsWith(nq)) return nq.length >= 3 ? 2 : 0
  return nq.length >= 3 && nn.includes(nq) ? 1 : 0
}
/** True when the query looks like it is aimed at an invoice number (digits, '#12', 'INV-12'). */
export function looksLikeNumber(q: string): boolean {
  const t = norm(q).replace(/^#/, '')
  return !!t && /\d/.test(t) && !/\s/.test(t)
}

// ---- pages & actions --------------------------------------------------------------------------------
/** Matches a page/action against labels in both languages and extra keywords; 0 = no match. */
export function scoreLabel(labels: string[], q: string): number {
  const toks = tokens(q)
  if (!toks.length) return 0
  const fields = labels.map(norm).filter(Boolean)
  let total = 0
  for (const tok of toks) {
    let best = 0
    for (const f of fields) {
      const ws = f.split(' ').map(bare)
      if (f === tok) best = Math.max(best, 100)
      else if (f.startsWith(tok)) best = Math.max(best, 85)
      else if (ws.some(w => w.startsWith(tok)) || f.split(' ').some(w => w.startsWith(tok))) best = Math.max(best, 70)
      else if (tok.length >= 3 && f.includes(tok)) best = Math.max(best, 45)
    }
    if (!best) return 0
    total += best
  }
  return total / toks.length
}

// ---- highlighting -----------------------------------------------------------------------------------
/** Folds one character the way normalizeText does ('' = dropped, e.g. tashkeel). */
function foldChar(ch: string): string {
  return /\s/.test(ch) ? ' ' : norm(ch)
}
/**
 * Where the query words occur in the original text, Arabic-aware (hamza forms, ta marbuta, tashkeel, digits).
 * Returns merged [start, end) ranges in the ORIGINAL string, for <mark>.
 */
export function highlightRanges(text: string, q: string): [number, number][] {
  if (!text) return []
  const toks = tokens(q).map(t => t.replace(/^[#+]/, '')).filter(Boolean)
  if (!toks.length) return []
  // folded text with a map back to original indices
  let folded = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const f = foldChar(text[i])
    for (let k = 0; k < f.length; k++) { folded += f[k]; map.push(i) }
  }
  const ranges: [number, number][] = []
  for (const tok of toks) {
    let from = 0
    while (from <= folded.length - tok.length) {
      const at = folded.indexOf(tok, from)
      if (at < 0) break
      ranges.push([map[at], map[at + tok.length - 1] + 1])
      from = at + tok.length
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}
/** Splits text into plain / marked parts from highlightRanges. */
export function splitHighlight(text: string, q: string): { text: string; hit: boolean }[] {
  const ranges = highlightRanges(text, q)
  if (!ranges.length) return [{ text, hit: false }]
  const parts: { text: string; hit: boolean }[] = []
  let pos = 0
  for (const [s, e] of ranges) {
    if (s > pos) parts.push({ text: text.slice(pos, s), hit: false })
    parts.push({ text: text.slice(s, e), hit: true })
    pos = e
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), hit: false })
  return parts
}

// ---- recent searches --------------------------------------------------------------------------------
export const RECENT_MAX = 6
/** Adds a query to the front of the list (deduplicated Arabic-insensitively), keeping at most `max`. */
export function pushRecent(list: string[], q: string, max = RECENT_MAX): string[] {
  const clean = q.trim().replace(/\s+/g, ' ')
  if (!clean) return list.slice(0, max)
  const key = norm(clean)
  return [clean, ...list.filter(x => norm(x) !== key)].slice(0, max)
}
export function removeRecent(list: string[], q: string): string[] {
  const key = norm(q)
  return list.filter(x => norm(x) !== key)
}
const RECENT_KEY = 'dentora.search.recent'
export function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, RECENT_MAX) : []
  } catch { return [] }
}
export function saveRecent(list: string[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))) } catch { /* private mode */ }
}

// ---- plurals ----------------------------------------------------------------------------------------
type T = (k: string, p?: Record<string, string | number>) => string
/** Counted phrase with real plural forms: keys '<key>_<rule>' (Arabic has zero/one/two/few/many/other). */
export function plural(t: T, lang: 'ar' | 'en', key: string, n: number): string {
  const rule = new Intl.PluralRules(lang === 'ar' ? 'ar' : 'en').select(n)
  const k = `${key}_${rule}`
  const s = t(k, { n })
  return s === k.slice(k.indexOf('.') + 1) || s === k ? t(`${key}_other`, { n }) : s
}

// Pure search logic for the command palette: Arabic-aware patient ranking, invoice-number matching,
// match highlighting, recent searches and plural phrases. No database or React here (tests/search.test.ts).
import type { Invoice, Patient } from '@/db/types'
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
/** Digits with phone/number punctuation only ("0944-123-456", "(011) 22", "+963 944…"). */
const PHONEISH = /^[+#]?[\d\-().\/]+$/
/** True when the whole query is a number typed in groups ("0944 123 456", "+963 944 123 456"). */
export function looksLikeGroupedNumber(q: string): boolean {
  const t = norm(q)
  return /\s/.test(t) && t.split(' ').every(w => PHONEISH.test(w)) && digitsOnly(t).length >= 6
}

/** Direction of typed text from its first strong letter; digits and symbols alone read left to right. */
export function textDir(s: string): 'rtl' | 'ltr' {
  const m = s.match(/[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/)
  return m && /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(m[0]) ? 'rtl' : 'ltr'
}

// ---- phones -----------------------------------------------------------------------------------------
/** Country codes of the region, stripped so "+963 944…" finds "0944…" and the other way round. */
const COUNTRY_CODES = ['963', '966', '962', '964', '961', '965', '971', '974', '973', '968', '967', '970', '20', '212', '213', '216', '218', '249', '90']
/**
 * Comparable forms of a phone number: its digits, the national number with and without the leading 0
 * (when it was written with a country code), and the local number without its leading 0.
 */
export function phoneForms(raw?: string): string[] {
  const s = String(raw ?? '').trim()
  let d = digitsOnly(s)
  if (!d) return []
  const intl = /^(\+|00)/.test(s) || d.length >= 11
  if (d.startsWith('00')) d = d.slice(2)
  const out = new Set([d])
  if (intl) for (const c of COUNTRY_CODES) if (d.startsWith(c) && d.length - c.length >= 7) { const n = d.slice(c.length).replace(/^0/, ''); out.add('0' + n); out.add(n) }
  if (/^0[1-9]/.test(d)) out.add(d.slice(1))
  return [...out]
}
/** How well a typed number matches a stored phone: 95 same number, 80 starts with, 75 ends with, 55 contains, 0 none. */
export function phoneScore(stored: string[], typed: string[]): number {
  let best = 0
  for (const ph of stored) for (const q of typed) {
    if (q.length < 3) continue
    if (ph === q) return 95
    if (ph.startsWith(q)) best = Math.max(best, 80)
    else if (ph.endsWith(q)) best = Math.max(best, 75)
    else if (ph.includes(q)) best = Math.max(best, 55)
  }
  return best
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
  phones: string[]      // every comparable form of every phone (see phoneForms)
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
    phones: [...new Set([p.phone, p.phone2].flatMap(x => phoneForms(x)))],
    nid: nidDigits || norm(p.nationalId),
  }
}

/** One query word, analysed once per keystroke (not once per patient). */
interface QueryToken { tok: string; d: string; numeric: boolean; forms: string[] }
/** A query ready to score many patients: its words and, for a number typed in groups, the whole number. */
export interface PreparedQuery { toks: QueryToken[]; joined: QueryToken | null; phrase: string }
function analyse(tok: string): QueryToken {
  const d = digitsOnly(tok.replace(/^[#+]/, ''))
  // digits, optionally typed with separators ("0944-123-456")
  const numeric = d.length > 0 && PHONEISH.test(tok)
  return { tok, d, numeric, forms: numeric && d.length >= 3 ? phoneForms(tok) : [] }
}
export function prepareQuery(q: string): PreparedQuery {
  const words = tokens(q)
  // a number typed in groups ("0944 123 456", "+963 944 123 456") is also tried as one number
  const joined = words.length > 1 && looksLikeGroupedNumber(q) ? analyse((words[0].startsWith('+') ? '+' : '') + digitsOnly(q)) : null
  return { toks: words.map(analyse), joined, phrase: words.join(' ') }
}

/** Score of one query word against one patient; 0 = no match. */
function scoreToken(ix: PatientIndex, qt: QueryToken): number {
  let best = 0
  const add = (s: number) => { if (s > best) best = s }
  const { tok, d, numeric } = qt
  if (numeric) {
    if (ix.file === d) add(100)
    else if (ix.file.startsWith(d)) add(70)
    if (d.length >= 3) {
      // phones are typed with or without the leading zero / country code
      add(phoneScore(ix.phones, qt.forms))
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
export function scorePatient(ix: PatientIndex, query: string | PreparedQuery): number {
  const pq = typeof query === 'string' ? prepareQuery(query) : query
  const { toks } = pq
  if (!toks.length) return 0
  let total = 0
  for (const qt of toks) {
    const s = scoreToken(ix, qt)
    if (!s) { total = 0; break }
    total += s
  }
  let score = total / toks.length
  if (pq.joined) score = Math.max(score, scoreToken(ix, pq.joined))
  if (!score) return 0
  if (toks.length > 1) {
    if (ix.name.startsWith(pq.phrase)) score += 12
    else if (ix.name.includes(pq.phrase)) score += 6
  }
  if (ix.p.archived) score -= 30
  return Math.max(1, score)
}

/** Arabic-aware alphabetical order (one shared collator: localeCompare(…, 'ar') builds one per call). */
export const collator = new Intl.Collator('ar')

export interface Ranked<T> { item: T; score: number }
/** Matches sorted by score, then most recent visit, then name. */
export function rankPatients<P extends SearchPatient>(index: PatientIndex<P>[], q: string, limit = Infinity): Ranked<P>[] {
  const pq = prepareQuery(q)
  if (!pq.toks.length) return []
  const out: Ranked<P>[] = []
  for (const ix of index) {
    const score = scorePatient(ix, pq)
    if (score > 0) out.push({ item: ix.p, score })
  }
  out.sort((a, b) => b.score - a.score
    || (a.item.lastVisit === b.item.lastVisit ? 0 : (b.item.lastVisit || '') > (a.item.lastVisit || '') ? 1 : -1)
    || collator.compare(a.item.name, b.item.name))
  return out.slice(0, limit)
}

/** The phone to show for a patient row: the one the query matched, else the main one. */
export function matchedPhone(p: Pick<SearchPatient, 'phone' | 'phone2'>, q: string): string | undefined {
  const typed = looksLikeGroupedNumber(q) ? [(q.trim().startsWith('+') ? '+' : '') + digitsOnly(q)] : tokens(q).filter(t => PHONEISH.test(t))
  const forms = typed.flatMap(t => phoneForms(t))
  if (forms.length && p.phone2 && phoneScore(phoneForms(p.phone2), forms) > phoneScore(phoneForms(p.phone), forms)) return p.phone2
  return p.phone || p.phone2
}

// ---- invoices ---------------------------------------------------------------------------------------
/** Lower-case, spaces collapsed; plain ASCII (the usual "INV-000123") skips the Arabic folding. */
function normNumber(s: string): string {
  return /^[\x20-\x7e]*$/.test(s) ? s.toLowerCase().replace(/\s+/g, ' ').trim() : norm(s)
}
/**
 * A matcher for one query, to run over many invoice numbers: 3 exact ("INV-000123" ← "123", "inv-000123",
 * "INV-123", "000123"), 2 prefix of the serial ("12" → 123), 1 contains, 0 no match.
 */
export function invoiceMatcher(q: string): (number: string) => 0 | 1 | 2 | 3 {
  const nq = norm(q).replace(/\s+/g, '')
  if (!nq) return () => 0
  const plain = nq.replace(/^#/, '')
  const qd = digitsOnly(plain)
  const letters = (x: string) => x.replace(/[^\p{L}]/gu, '')
  const ql = letters(plain)
  const qs = qd.replace(/^0+/, '') || '0'
  return (number: string) => {
    if (!number) return 0
    const nn = normNumber(number)
    if (nn === nq) return 3
    if (qd) {
      // letters typed with the number must be the start of the number's letters ("inv-12", "INV12", "inv 12")
      if (ql && !letters(nn).startsWith(ql)) return 0
      const runs = nn.match(/\d+/g)
      const serial = (runs ? runs[runs.length - 1] : '').replace(/^0+/, '') || '0'   // the counter: last run of digits
      if (serial === qs) return 3
      if (serial.startsWith(qs)) return 2
      if (digitsOnly(nn).includes(qd)) return 1
      return 0
    }
    if (nn.startsWith(nq)) return nq.length >= 3 ? 2 : 0
    return nq.length >= 3 && nn.includes(nq) ? 1 : 0
  }
}
export function invoiceNumberMatch(number: string, q: string): 0 | 1 | 2 | 3 {
  return invoiceMatcher(q)(number)
}
export type SearchInvoice = Pick<Invoice, 'id' | 'number' | 'patientId' | 'date' | 'total' | 'status'>
/**
 * Invoices for the palette: those whose number matches (best match first), then the invoices of the
 * best-matching patients (`patientIds`, best first), newest first.
 */
export function searchInvoices<I extends SearchInvoice>(invoices: I[], q: string, patientIds: string[] = [], limit = 5): { invoice: I; score: number }[] {
  const text = q.trim()
  const match = text && (looksLikeNumber(text) || text.length >= 3) ? invoiceMatcher(text) : null
  const rank = new Map(patientIds.map((id, i) => [id, i]))
  const found: { invoice: I; score: number }[] = []
  for (const inv of invoices) {
    const m = match ? match(inv.number) : 0
    if (m) found.push({ invoice: inv, score: 100 + m * 10 })
    else { const r = rank.get(inv.patientId); if (r !== undefined) found.push({ invoice: inv, score: 60 - Math.min(40, r) }) }
  }
  return found
    .sort((a, b) => b.score - a.score || (a.invoice.date === b.invoice.date ? 0 : a.invoice.date < b.invoice.date ? 1 : -1) || (a.invoice.number < b.invoice.number ? 1 : -1))
    .slice(0, limit)
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
  const find = (hay: string, at2orig: number[], needle: string) => {
    let from = 0
    while (needle && from <= hay.length - needle.length) {
      const at = hay.indexOf(needle, from)
      if (at < 0) break
      ranges.push([at2orig[at], at2orig[at + needle.length - 1] + 1])
      from = at + needle.length
    }
  }
  // numbers are also looked up across the spaces / dashes of the text ("0944123456" in "0944 123 456")
  let digits = ''
  const dmap: number[] = []
  for (let i = 0; i < folded.length; i++) if (/\d/.test(folded[i])) { digits += folded[i]; dmap.push(map[i]) }
  const numbers = looksLikeGroupedNumber(q) ? [(q.trim().startsWith('+') ? '+' : '') + digitsOnly(q)] : []
  for (const tok of toks) {
    find(folded, map, tok)
    if (PHONEISH.test(tok) && digitsOnly(tok).length >= 3) numbers.push(tok)
  }
  for (const n of numbers) {
    const before = ranges.length
    for (const f of [digitsOnly(n), ...phoneForms(n)]) { if (f.length >= 3) find(digits, dmap, f); if (ranges.length > before) break }
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

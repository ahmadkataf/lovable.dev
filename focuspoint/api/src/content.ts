// Site content (docs/cms/DESIGN.md §2, §3, §6): the admin's saved sections live as one JSON row (site_content),
// and every read goes through mergeContent() over DEFAULT_CONTENT, so a missing, old or malformed stored value can
// never break the site — it falls back to today's text field by field.
// Undo: each save or reset first copies the section's previous value into site_content_history (last 20 per section);
// undo pops the newest one. Writes are single D1 batches (one transaction), and section values are written with
// json_set/json_remove so two admins saving different sections at once cannot overwrite each other.
import { DEFAULT_CONTENT, SECTION_IDS, mergeContent, validateSection, type SectionId, type SiteContent } from '../../shared/content'
import type { AdminContentResponse, ContentResponse, ContentSectionResponse } from '../../shared/types'
import { HttpError } from './http'

/** The isolate keeps the merged content this long (DESIGN: ≤ 30 s); a save in this isolate drops it at once. */
export const CONTENT_TTL_MS = 30_000
/** Undo depth per section. */
export const HISTORY_KEEP = 20

export interface ContentSnapshot extends ContentResponse {
  overridden: SectionId[]
  etag: string               // strong ETag of the public body {content, updated_at}
}

/** One entry of GET /v1/admin/content/:section/history: the value the section had before a save, newest first. */
export interface ContentHistoryEntry {
  id: number
  saved_at: string | null    // when it was replaced
  saved_by: number | null
  saved_by_name: string | null
  was_default: boolean       // true → before that save the section showed the default
  value: unknown             // the section as it looked then (merged, so always renderable)
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// ---------- reading ----------

interface Stored { data: Record<string, unknown>; updated_at: string | null }

async function readStored(db: D1Database): Promise<Stored> {
  const row = await db.prepare('SELECT data, updated_at FROM site_content WHERE id = 1').first<{ data: string | null; updated_at: string | null }>()
  let data: unknown = {}
  try { data = row?.data ? JSON.parse(row.data) : {} } catch { data = {} }
  return { data: isObj(data) ? data : {}, updated_at: row?.updated_at ?? null }
}

const overriddenOf = (data: Record<string, unknown>): SectionId[] => SECTION_IDS.filter((id) => isObj(data[id]))

async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function snapshotOf(st: Stored): Promise<ContentSnapshot> {
  const content = mergeContent(st.data)
  // The ETag covers the merged result, not just updated_at: a deploy that changes a default changes it too.
  const etag = `"c-${(await sha256Hex(JSON.stringify({ content, updated_at: st.updated_at }))).slice(0, 24)}"`
  return { content, updated_at: st.updated_at, overridden: overriddenOf(st.data), etag }
}

let cached: { at: number; snap: ContentSnapshot } | null = null
let generation = 0          // bumped by every drop, so a read that started before a save cannot re-cache the old value

export function dropContentCache(): void {
  cached = null
  generation++
}

/** The merged content (+ ETag), from the isolate cache when it is younger than CONTENT_TTL_MS. */
export async function loadContentSnapshot(db: D1Database, now = Date.now()): Promise<ContentSnapshot> {
  if (cached && now - cached.at < CONTENT_TTL_MS && now >= cached.at) return cached.snap
  const gen = generation
  const snap = await snapshotOf(await readStored(db))
  if (gen === generation) cached = { at: now, snap }
  return snap
}

export async function loadContent(db: D1Database): Promise<SiteContent> {
  return (await loadContentSnapshot(db)).content
}

/** Fresh from D1 (the editor must never see a stale cache): merged content + which sections the admin saved. */
export async function getOverridden(db: D1Database): Promise<AdminContentResponse> {
  const { content, overridden, updated_at } = await snapshotOf(await readStored(db))
  return { content, overridden, updated_at }
}

async function sectionResponse(db: D1Database, id: SectionId): Promise<ContentSectionResponse> {
  const { content, overridden, updated_at } = await snapshotOf(await readStored(db))
  return { section: id, value: content[id], overridden: overridden.includes(id), updated_at }
}

// ---------- writing ----------

export function requireSection(v: unknown): SectionId {
  if (typeof v !== 'string' || !(SECTION_IDS as readonly string[]).includes(v)) throw new HttpError(404, 'unknown_section')
  return v as SectionId
}

const jsonPath = (id: SectionId): string => `$.${id}`       // ids are fixed identifiers (SECTION_IDS), safe in a JSON path
// The stored root, or {} if it is somehow not a JSON object (json_set on anything else would silently do nothing).
const ROOT = `CASE WHEN json_valid(data) AND json_type(data) = 'object' THEN data ELSE '{}' END`

function ensureRow(db: D1Database): D1PreparedStatement {
  return db.prepare(`INSERT INTO site_content (id, data, updated_at, updated_by) VALUES (1, '{}', NULL, NULL) ON CONFLICT(id) DO NOTHING`)
}

/** Copies the section's current stored value (NULL = default) into the history, read inside the same transaction. */
function pushHistory(db: D1Database, id: SectionId, iso: string, userId: number | null): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO site_content_history (section, data, saved_at, saved_by)
     SELECT ?, CASE WHEN json_valid(data) AND json_type(data) = 'object' AND json_type(data, ?) = 'object' THEN json_extract(data, ?) END, ?, ?
     FROM site_content WHERE id = 1`)
    .bind(id, jsonPath(id), jsonPath(id), iso, userId)
}

function trimHistory(db: D1Database, id: SectionId): D1PreparedStatement {
  return db.prepare(
    `DELETE FROM site_content_history WHERE section = ? AND id NOT IN (
       SELECT id FROM site_content_history WHERE section = ? ORDER BY id DESC LIMIT ${HISTORY_KEEP})`)
    .bind(id, id)
}

function writeSection(db: D1Database, id: SectionId, value: unknown, iso: string, userId: number | null): D1PreparedStatement {
  return db.prepare(`UPDATE site_content SET data = json_set(${ROOT}, ?, json(?)), updated_at = ?, updated_by = ? WHERE id = 1`)
    .bind(jsonPath(id), JSON.stringify(value), iso, userId)
}

function removeSection(db: D1Database, id: SectionId, iso: string, userId: number | null): D1PreparedStatement {
  return db.prepare(`UPDATE site_content SET data = json_remove(${ROOT}, ?), updated_at = ?, updated_by = ? WHERE id = 1`)
    .bind(jsonPath(id), iso, userId)
}

/**
 * PUT /v1/admin/content/:section — the full section value, checked by the same validateSection as the editor.
 * Invalid → 400 {error: 'invalid_content', path, message, reason}. Returns the merged section as the site now shows it.
 */
export async function saveSection(db: D1Database, id: SectionId, value: unknown, userId: number | null, now: Date): Promise<ContentSectionResponse> {
  const r = validateSection(id, value)
  if (!r.ok) throw new HttpError(400, 'invalid_content', { path: r.path, message: r.message, reason: r.error })
  const iso = now.toISOString()
  const before = (await readStored(db)).data[id]
  const unchanged = isObj(before) && JSON.stringify(before) === JSON.stringify(r.value)
  // Saving the same value again adds no history entry, so «تراجع» always goes back to something different.
  await db.batch([
    ensureRow(db),
    ...(unchanged ? [] : [pushHistory(db, id, iso, userId)]),
    writeSection(db, id, r.value, iso, userId),
    trimHistory(db, id),
  ])
  dropContentCache()
  return sectionResponse(db, id)
}

/** DELETE /v1/admin/content/:section — back to the default. Kept in the history too, so a reset can be undone. */
export async function resetSection(db: D1Database, id: SectionId, userId: number | null, now: Date): Promise<ContentSectionResponse> {
  const stored = await readStored(db)
  if (Object.prototype.hasOwnProperty.call(stored.data, id)) {
    const iso = now.toISOString()
    await db.batch([pushHistory(db, id, iso, userId), removeSection(db, id, iso, userId), trimHistory(db, id)])
    dropContentCache()
  }
  return sectionResponse(db, id)
}

/** A stored history value as a section value that is safe to store again (the schema may have changed since). */
function restorable(id: SectionId, data: string | null): { value: unknown } | null {
  if (data === null) return null
  let parsed: unknown
  try { parsed = JSON.parse(data) } catch { return null }
  if (!isObj(parsed)) return null
  const r = validateSection(id, parsed)
  return { value: r.ok ? r.value : mergeContent({ [id]: parsed })[id] }
}

export async function listHistory(db: D1Database, id: SectionId): Promise<ContentHistoryEntry[]> {
  const rows = (await db.prepare(
    `SELECT h.id, h.data, h.saved_at, h.saved_by, u.name AS saved_by_name FROM site_content_history h
     LEFT JOIN users u ON u.id = h.saved_by WHERE h.section = ? ORDER BY h.id DESC LIMIT ${HISTORY_KEEP}`)
    .bind(id).all<{ id: number; data: string | null; saved_at: string | null; saved_by: number | null; saved_by_name: string | null }>()).results
  return rows.map((r) => {
    const back = restorable(id, r.data)
    return {
      id: r.id, saved_at: r.saved_at, saved_by: r.saved_by, saved_by_name: r.saved_by_name,
      was_default: back === null, value: back ? back.value : structuredClone(DEFAULT_CONTENT[id]),
    }
  })
}

/** POST /v1/admin/content/:section/undo — restores the newest history entry and removes it (409 nothing_to_undo). */
export async function undoSection(db: D1Database, id: SectionId, userId: number | null, now: Date): Promise<ContentSectionResponse> {
  const last = await db.prepare('SELECT id, data FROM site_content_history WHERE section = ? ORDER BY id DESC LIMIT 1')
    .bind(id).first<{ id: number; data: string | null }>()
  if (!last) throw new HttpError(409, 'nothing_to_undo')
  const back = restorable(id, last.data)
  const iso = now.toISOString()
  await db.batch([
    ensureRow(db),
    back ? writeSection(db, id, back.value, iso, userId) : removeSection(db, id, iso, userId),
    db.prepare('DELETE FROM site_content_history WHERE id = ?').bind(last.id),
  ])
  dropContentCache()
  return sectionResponse(db, id)
}

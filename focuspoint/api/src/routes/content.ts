// Site content and uploaded media (docs/cms/DESIGN.md §3, §6). The public read is GET /v1/content; everything that
// changes the site is admin only (route access 'admin' → 403 for staff, checked in index.ts before the handler runs).
import { getOverridden, listHistory, loadContentSnapshot, requireSection, resetSection, saveSection, undoSection } from '../content'
import { CORS_HEADERS, HttpError, json } from '../http'
import { MEDIA_MAX_BYTES, checkUpload, deleteMedia, listMedia, mediaIdOf, putMedia } from '../media'
import { requireUser, route, type Route } from '../router'

/** A section is a few KB of text (home is the largest, ~15 KB); anything near this is not an editor request. */
const MAX_SECTION_BYTES = 256 * 1024

/** If-None-Match holds this ETag (a list, weak form W/"…" or *). */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false
  return header.split(',').some((t) => { const v = t.trim(); return v === '*' || v.replace(/^W\//, '') === etag })
}

function tooBig(req: Request, max: number, code: string): void {
  const len = Number(req.headers.get('Content-Length') ?? '0')
  if (Number.isFinite(len) && len > max) throw new HttpError(413, code)
}

export const contentRoutes: Route[] = [
  // Public: the merged content. no-cache + ETag → the browser revalidates every time and gets a 304 while nothing changed.
  route('GET', '/v1/content', 'public', async (c) => {
    const snap = await loadContentSnapshot(c.env.DB)
    const headers = { 'Cache-Control': 'no-cache', ETag: snap.etag }
    if (etagMatches(c.req.headers.get('If-None-Match'), snap.etag)) return new Response(null, { status: 304, headers: { ...CORS_HEADERS, ...headers } })
    return json({ content: snap.content, updated_at: snap.updated_at }, 200, headers)
  }),

  route('GET', '/v1/admin/content', 'admin', async (c) => json(await getOverridden(c.env.DB))),

  route('PUT', '/v1/admin/content/:section', 'admin', async (c) => {
    const id = requireSection(c.params.section)
    tooBig(c.req, MAX_SECTION_BYTES, 'payload_too_large')
    let body: unknown
    try { body = await c.req.json() } catch { throw new HttpError(400, 'invalid_json') }
    return json(await saveSection(c.env.DB, id, body, requireUser(c).id, c.now))
  }),

  route('DELETE', '/v1/admin/content/:section', 'admin', async (c) =>
    json(await resetSection(c.env.DB, requireSection(c.params.section), requireUser(c).id, c.now))),

  route('GET', '/v1/admin/content/:section/history', 'admin', async (c) =>
    json(await listHistory(c.env.DB, requireSection(c.params.section)))),

  route('POST', '/v1/admin/content/:section/undo', 'admin', async (c) =>
    json(await undoSection(c.env.DB, requireSection(c.params.section), requireUser(c).id, c.now))),

  // Raw image body (Content-Type image/webp|jpeg|png), ?w=&h= as measured by the browser (the header's own size wins).
  route('POST', '/v1/admin/media', 'admin', async (c) => {
    tooBig(c.req, MEDIA_MAX_BYTES, 'media_too_large')
    const bytes = new Uint8Array(await c.req.arrayBuffer())
    const info = checkUpload(bytes, c.req.headers.get('Content-Type'), c.url.searchParams.get('w'), c.url.searchParams.get('h'))
    return json(await putMedia(c.env.DB, bytes, info, requireUser(c).id, c.now), 201)
  }),

  route('GET', '/v1/admin/media', 'admin', async (c) => json(await listMedia(c.env.DB))),

  route('DELETE', '/v1/admin/media/:id', 'admin', async (c) => {
    const raw = c.params.id ?? ''
    await deleteMedia(c.env.DB, mediaIdOf(raw) ?? raw)      // "<id>" or "<id>.webp"
    return json({ ok: true })
  }),
]

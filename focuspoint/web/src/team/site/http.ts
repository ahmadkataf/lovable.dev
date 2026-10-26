// The site editor's content API (admin): load, save (PUT), reset (DELETE), undo, history. Uses fetch with the same
// headers as ../../api, plus PUT and the `path` of an invalid_content error (see ./media).
import type { AdminContentResponse, SectionId, SiteContent } from '@shared/types'
import { mergeContent } from '@shared/content'
import { ApiError } from '../../api'
import { cachedGet } from '../../offline'
import { API_BASE, errorFrom, requestHeaders, SiteApiError } from './media'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, { method, headers: requestHeaders(body !== undefined), body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new SiteApiError('offline', 0, true)
  }
  const text = await res.text()
  if (!res.ok) throw errorFrom(res.status, text)
  try { return (text ? JSON.parse(text) : undefined) as T } catch { throw new SiteApiError('bad_response', res.status) }
}

/** What the editor keeps of a section after a save / undo / reset. */
export interface SectionResult { value: SiteContent[SectionId]; overridden: boolean | null; updated_at: string | null }

/** The API answers ContentSectionResponse ({section, value, overridden, updated_at}); a bare section value is accepted
 *  too. Either way the value goes through mergeContent, so a surprise from the server can never break the form. */
function toResult(id: SectionId, res: unknown): SectionResult {
  const o = res && typeof res === 'object' && !Array.isArray(res) ? (res as Record<string, unknown>) : null
  const wrapped = o !== null && 'value' in o && ('section' in o || 'overridden' in o)
  const raw = wrapped && o ? o.value : res
  return {
    value: mergeContent({ [id]: raw })[id],
    overridden: wrapped && o && typeof o.overridden === 'boolean' ? o.overridden : null,
    updated_at: wrapped && o && typeof o.updated_at === 'string' ? o.updated_at : null,
  }
}

export interface HistoryEntry { id: number; saved_at: string; saved_by: number | null }

export const siteApi = {
  /** Network first; offline → the copy cached on this device (fromCache), so the editor still opens. */
  async content(): Promise<{ data: AdminContentResponse; fromCache: boolean }> {
    let r: { data: AdminContentResponse; fromCache: boolean }
    try { r = await cachedGet<AdminContentResponse>('/v1/admin/content') } catch (err) {
      if (err instanceof ApiError && !(err instanceof SiteApiError)) throw new SiteApiError(err.message, err.status, err.offline)
      throw err
    }
    const d = r.data && typeof r.data === 'object' ? r.data : ({} as Partial<AdminContentResponse>)
    return {
      fromCache: r.fromCache,
      data: {
        content: mergeContent(d.content),
        overridden: Array.isArray(d.overridden) ? d.overridden : [],
        updated_at: typeof d.updated_at === 'string' ? d.updated_at : null,
      },
    }
  },
  async save(id: SectionId, value: unknown): Promise<SectionResult> {
    return toResult(id, await request<unknown>('PUT', `/v1/admin/content/${id}`, value))
  },
  async reset(id: SectionId): Promise<SectionResult> {
    return toResult(id, await request<unknown>('DELETE', `/v1/admin/content/${id}`))
  },
  async undo(id: SectionId): Promise<SectionResult> {
    return toResult(id, await request<unknown>('POST', `/v1/admin/content/${id}/undo`, {}))
  },
  async history(id: SectionId): Promise<HistoryEntry[]> {
    const r = await request<unknown>('GET', `/v1/admin/content/${id}/history`)
    const list: unknown[] = Array.isArray(r) ? r : r && typeof r === 'object' && Array.isArray((r as { history?: unknown }).history) ? (r as { history: unknown[] }).history : []
    return list
      .filter((h): h is HistoryEntry => !!h && typeof h === 'object' && typeof (h as HistoryEntry).saved_at === 'string')
      .sort((a, b) => (a.saved_at < b.saved_at ? 1 : a.saved_at > b.saved_at ? -1 : 0))   // newest first
  },
}

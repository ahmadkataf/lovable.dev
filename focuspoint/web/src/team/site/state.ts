// The site editor's shared state: the content as the server has it (GET /v1/admin/content, cached on the device for
// offline opening), which sections the admin overrode, the save history per section (for «آخر حفظ» and «تراجع»),
// and unsaved drafts kept in IndexedDB so typed text survives a reload, a lost connection or a back-swipe.
import { useSyncExternalStore } from 'react'
import { isSectionId, type SectionId, type SiteContent } from '@shared/content'
import { dropMemo } from '../../lib/data'
import { cache } from '../../offline'
import { siteApi, type HistoryEntry, type SectionResult } from './http'

export interface StoredDraft { value: unknown; settings?: Record<string, string>; at: string }
export interface SiteState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  content: SiteContent | null
  overridden: SectionId[]
  updated_at: string | null
  fromCache: boolean
  error: unknown
  history: Partial<Record<SectionId, HistoryEntry[]>>
  drafts: Partial<Record<SectionId, StoredDraft>>
}

const DRAFTS_KEY = 'site:drafts'
let state: SiteState = { status: 'idle', content: null, overridden: [], updated_at: null, fromCache: false, error: null, history: {}, drafts: {} }
const listeners = new Set<() => void>()
const set = (patch: Partial<SiteState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()) }
let loading: Promise<void> | null = null
let again = false
let gen = 0                       // bumped by every save / undo / reset
let draftsLoaded: Promise<void> | null = null

function loadDrafts(): Promise<void> {
  draftsLoaded ??= cache.get<Record<string, StoredDraft>>(DRAFTS_KEY).then((d) => {
    const drafts: Partial<Record<SectionId, StoredDraft>> = {}
    if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) if (isSectionId(k) && v && typeof v === 'object') drafts[k] = v
    set({ drafts: { ...drafts, ...state.drafts } })
  }).catch(() => { /* no IndexedDB: drafts live in memory only */ })
  return draftsLoaded
}

export const siteState = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
  get: () => state,

  /** Load (or reload) the content. Keeps the last good copy on screen when a reload fails. A reload that started
   *  before a save finished could carry the older value: it is dropped and the load runs again. */
  load(): Promise<void> {
    if (loading) { again = true; return loading }
    if (!state.content) set({ status: 'loading', error: null })
    loading = (async () => {
      await loadDrafts()
      const startGen = gen
      try {
        const r = await siteApi.content()
        if (startGen !== gen) { again = true; return }
        set({ status: 'ready', content: r.data.content, overridden: r.data.overridden, updated_at: r.data.updated_at, fromCache: r.fromCache, error: null })
        for (const id of r.data.overridden) if (!state.history[id]) void siteState.loadHistory(id)
      } catch (err) {
        set(state.content ? { error: err } : { status: 'error', error: err })
      } finally {
        loading = null
        if (again) { again = false; void siteState.load() }
      }
    })()
    return loading
  },

  async loadHistory(id: SectionId): Promise<void> {
    try { set({ history: { ...state.history, [id]: await siteApi.history(id) } }) } catch { /* optional: the editor works without it */ }
  },

  /** After a save / undo / reset: the server's merged section becomes the truth, the site's cached copy is dropped. */
  applyResult(id: SectionId, r: SectionResult, kind: 'save' | 'undo' | 'reset') {
    if (!state.content) return
    gen++
    const overridden = r.overridden ?? (kind === 'reset' ? false : kind === 'save' ? true : state.overridden.includes(id))
    set({
      content: { ...state.content, [id]: r.value } as SiteContent,
      overridden: overridden ? [...new Set([...state.overridden, id])] : state.overridden.filter((x) => x !== id),
      updated_at: r.updated_at ?? new Date().toISOString(),
      fromCache: false,
    })
    dropMemo('/v1/content')          // the public site reads it through useCached: no stale copy in this tab
    void siteState.loadHistory(id)
    void siteState.load()            // refreshes the offline copy (and the overridden list after an undo)
  },

  async saveDraft(id: SectionId, d: StoredDraft | null): Promise<void> {
    await loadDrafts()
    const drafts = { ...state.drafts }
    if (d) drafts[id] = d
    else delete drafts[id]
    set({ drafts })
    try { await cache.set(DRAFTS_KEY, drafts) } catch { /* memory only */ }
  },
  ensureDrafts: loadDrafts,
}

export function useSiteState(): SiteState {
  return useSyncExternalStore(siteState.subscribe, siteState.get, siteState.get)
}

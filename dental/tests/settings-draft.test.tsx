// A settings form saves on Enter. On a slow PC a second Enter can arrive after the first save finished but before
// React re-rendered the form from the database: that handler still sees the old `dirty` and would save (and log)
// the same values again. useDraft remembers what the save wrote until the form catches up (isSaved).
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useDraft } from '../src/features/settings/parts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Src = { tax: number; prefix: string }
type Draft = { tax: string; prefix: string }
const from = (s: Src): Draft => ({ tax: String(s.tax), prefix: s.prefix })

describe('useDraft: isSaved', () => {
  let api: ReturnType<typeof useDraft<Src, Draft>>
  function Probe({ source }: { source: Src }) { api = useDraft(source, from); return null }

  it('treats the values a save just wrote as saved until the source catches up', async () => {
    const el = document.createElement('div')
    const root = createRoot(el)
    const v1: Src = { tax: 0, prefix: 'INV-' }
    await act(async () => { root.render(<Probe source={v1} />) })
    expect(api.dirty).toBe(false)

    await act(async () => { api.patch({ tax: '15' }) })
    expect(api.dirty).toBe(true)
    const submitted = api.draft!
    expect(api.isSaved(submitted)).toBe(false)

    // the save wrote v2; the form shows it, but the source (the live query) has not re-rendered yet
    const v2: Src = { tax: 15, prefix: 'INV-' }
    await act(async () => { api.reset(v2, submitted) })
    expect(api.isSaved(submitted)).toBe(true)
    expect(api.isSaved(from(v2))).toBe(true)
    expect(api.isSaved({ tax: '16', prefix: 'INV-' })).toBe(false)

    // the source catches up: nothing is remembered any more, and `dirty` is accurate again
    await act(async () => { root.render(<Probe source={v2} />) })
    expect(api.dirty).toBe(false)
    expect(api.isSaved(submitted)).toBe(false)

    // a later edit back and forth is judged by `dirty` alone
    await act(async () => { api.patch({ tax: '20' }) })
    expect(api.dirty).toBe(true)
    expect(api.isSaved(api.draft)).toBe(false)
    await act(async () => { root.unmount() })
  })

  it('a plain reset (discard) remembers nothing', async () => {
    const el = document.createElement('div')
    const root = createRoot(el)
    await act(async () => { root.render(<Probe source={{ tax: 5, prefix: 'A-' }} />) })
    await act(async () => { api.patch({ tax: '7' }) })
    await act(async () => { api.reset() })
    expect(api.dirty).toBe(false)
    expect(api.isSaved(api.draft)).toBe(false)
    await act(async () => { root.unmount() })
  })
})

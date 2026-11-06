// A read that is not a live query: run once per key in a plain read transaction, and again shortly after one of its
// tables changes (Dexie's storagemutated, which also reports other windows). For big, read-mostly screens (reports, a
// long invoice list): a live query records every key it reads and clones every row, which on thousands of rows costs
// more than the read itself. Shared by billing and reports.
import { useEffect, useState } from 'react'
import Dexie, { type ObservabilitySet } from 'dexie'
import { db } from '@/db'

/**
 * Runs `load` once per `key`, again (after `delay` ms) whenever one of `tables` changes, and keeps showing the
 * previous answer while a refresh runs. Read-only: never write from `load`.
 */
export function useSnapshot<T>(key: string, tables: string[], load: () => Promise<T>, delay = 400): T | undefined {
  const [state, setState] = useState<{ key: string; value: T } | undefined>()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    load().then(value => { if (alive) setState({ key, value }) }, err => console.warn('snapshot', key, err))
    return () => { alive = false }
  }, [key, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const tableKey = tables.join(',')
  useEffect(() => {
    const prefixes = tables.map(t => `idb://${db.name}/${t}/`)
    let timer: ReturnType<typeof setTimeout> | undefined
    const onChange = (parts: ObservabilitySet) => {
      if (!Object.keys(parts).some(k => prefixes.some(p => k.startsWith(p)))) return
      clearTimeout(timer)
      timer = setTimeout(() => setTick(n => n + 1), delay)
    }
    Dexie.on.storagemutated.subscribe(onChange)
    return () => { Dexie.on.storagemutated.unsubscribe(onChange); clearTimeout(timer) }
  }, [tableKey, delay]) // eslint-disable-line react-hooks/exhaustive-deps
  return state && state.key === key ? state.value : undefined
}

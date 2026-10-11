// Every patient's balance for the patients list, kept for the session.
//
// Exact balances need every issued invoice and payment (tens of thousands of rows in a busy clinic). They are read
// outside any live query (Dexie neither caches nor tracks those rows for this screen), in pages (no long freeze on a
// phone), only after the list itself is on screen, and only again after invoices or payments changed: coming back
// to the list shows the last balances at once.
import { useEffect, useState } from 'react'
import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { balancesByPatient } from './lib'
import { readAllChunked } from './chunked'

/** Rows per page (a page decodes in well under 200 ms on a slow phone). */
const CHUNK = 5000

let cached: Map<string, number> | undefined
let dirty = true
let running: Promise<Map<string, number>> | null = null
let watching = false

function watch() {
  if (watching) return
  watching = true
  Dexie.on('storagemutated', parts => {
    const prefix = `idb://${db.name}/`
    if (Object.keys(parts).some(k => k.startsWith(`${prefix}invoices/`) || k.startsWith(`${prefix}payments/`))) dirty = true
  })
}

/** The balances, read again only when invoices or payments changed since the last read. */
export function loadBalances(): Promise<Map<string, number>> {
  watch()
  if (cached && !dirty) return Promise.resolve(cached)
  if (running) return running
  dirty = false
  running = Promise.all([readAllChunked(db.invoices, CHUNK), readAllChunked(db.payments, CHUNK * 2)])
    .then(([invoices, payments]) => { cached = balancesByPatient(invoices, payments); return cached })
    .catch(err => { dirty = true; throw err })
    .finally(() => { running = null })
  return running
}

/** Live balances for a screen: the last known ones at once, then current ones once `enabled` (the list is shown). */
export function useBalances(enabled: boolean): Map<string, number> | undefined {
  watch()
  const [map, setMap] = useState(cached)
  // a cheap watch on both tables (counts over the primary key re-run after any change)
  const tick = useLiveQuery(async () => { await Promise.all([db.invoices.count(), db.payments.count()]); return {} }, [])
  useEffect(() => {
    if (!enabled || !tick) return
    let alive = true
    void loadBalances().then(m => { if (alive) setMap(m) }).catch(() => undefined)
    return () => { alive = false }
  }, [enabled, tick])
  return map
}

/** For tests. */
export function resetBalances() { cached = undefined; dirty = true }

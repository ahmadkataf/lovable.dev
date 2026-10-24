// useLiveQuery (dexie-react-hooks) that cannot leave a screen waiting for good on a database that went away.
//
// Dexie's liveQuery drops a query that fails with DatabaseClosedError / AbortError without telling the component (the
// screen keeps its spinner), and a query that fails with another database error makes the hook throw (the app went
// blank). Here:
//   • every answer is tagged with the subscription that produced it, so an answer — even `undefined` — is never
//     confused with "not answered yet", and a value is never kept under another query's inputs;
//   • after every (re)open of the database each live query subscribes again (Dexie does not revive dropped ones);
//   • a query that hits a passing database error answers "not yet", keeps showing what this same query showed last,
//     and is retried with growing pauses; if the database itself has failed it is reopened (once, for everyone);
//   • a query that is merely slow is left alone to finish (never restarted);
//   • a database that failed mid-session is reopened on a timer too, not only when a live query notices: a failed
//     payment (a write) wakes no live query, and the sales screen would otherwise refuse every sale until the
//     cashier happened to open another screen.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery as useDexieLiveQuery } from 'dexie-react-hooks'
import { db, reopenDb } from '../db'
import { logError } from './recovery'

let generation = 0
let everReady = false
const listeners = new Set<() => void>()
// sticky: called on every open of the database, not only the first
db.on('ready', () => { generation++; failures = 0; everReady = true; listeners.forEach(f => f()) }, true)

/** Database errors that say "the database is not available right now", not "this query is wrong". */
const PASSING = new Set(['DatabaseClosedError', 'OpenFailedError', 'AbortError', 'UnknownError', 'TimeoutError', 'InvalidStateError', 'TransactionInactiveError', 'PrematureCommitError', 'QuotaExceededError'])
const FAILED = Symbol('live-query-failed')
interface Box<T> { k: object; v: T | typeof FAILED }

// ---------- getting a failed database back (shared by every live query) ----------
let failures = 0              // reopen attempts that failed in a row (reset by a successful open)
let recovering: Promise<void> | null = null
let lastRecover = 0
let onGiveUp: ((err: unknown) => void) | null = null
/** What to do when the database cannot be reopened (the store shows the start-up error card with a restart). */
export function onDatabaseLost(fn: (err: unknown) => void): void { onGiveUp = fn }
function recoverDb(): void {
  // only a database that has failed (not one still opening: a slow open or upgrade must never be cancelled)
  if (recovering || db.isOpen() || !db.hasFailed()) return
  if (Date.now() - lastRecover < 15000) return
  lastRecover = Date.now()
  recovering = reopenDb().catch(e => {
    logError('db-recover', e)
    // slow, not failed: the open goes on (and 'ready' re-subscribes everything when it finishes)
    if ((e as { name?: unknown } | null)?.name === 'DbOpenTimeout') return
    failures++
    if (failures >= 3 && onGiveUp) onGiveUp(e)
  }).finally(() => { recovering = null })
}
// after the first successful open (the start-up owns reopening before that); recoverDb does nothing unless the
// database has failed, and pauses 15 s between its own attempts
if (typeof window !== 'undefined') setInterval(() => { if (everReady) recoverDb() }, 5000)

const sameDeps = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((d, i) => Object.is(d, b[i]))

export function useLiveQuery<T>(querier: () => Promise<T> | T, deps?: unknown[]): T | undefined
export function useLiveQuery<T, TDefault>(querier: () => Promise<T> | T, deps: unknown[], defaultResult: TDefault): T | TDefault
export function useLiveQuery<T, TDefault>(querier: () => Promise<T> | T, deps: unknown[] = [], defaultResult?: TDefault): T | TDefault | undefined {
  const [gen, setGen] = useState(generation)
  const [retry, setRetry] = useState(0)
  const lastGood = useRef<{ v: T; deps: unknown[] } | null>(null)
  const failedRuns = useRef(0)
  useEffect(() => {
    const f = () => setGen(generation)
    listeners.add(f)
    f()
    return () => { listeners.delete(f) }
  }, [])
  // one token per subscription: what it answers carries it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const token = useMemo(() => ({}), [...deps, gen, retry])
  // no extra async layer before the querier runs: Dexie tracks what a live query reads through its own promises
  const raw = useDexieLiveQuery((): Box<T> | Promise<Box<T>> => {
    const k = token
    const onError = (e: unknown): Box<T> => {
      const name = (e as { name?: unknown } | null)?.name
      if (typeof name === 'string' && PASSING.has(name)) { logError('live-query', e); return { k, v: FAILED } }
      throw e
    }
    try {
      const r = querier()
      return r && typeof (r as PromiseLike<T>).then === 'function' ? (r as Promise<T>).then(v => ({ k, v }), onError) : { k, v: r as T }
    } catch (e) { return onError(e) }
  }, [token])
  const box = raw as Box<T> | undefined
  const mine = !!box && box.k === token
  const failed = mine && box!.v === FAILED
  if (mine && !failed) { lastGood.current = { v: box!.v as T, deps }; failedRuns.current = 0 }
  useEffect(() => {
    if (!failed) return
    recoverDb()
    const ms = Math.min(30000, 3000 * 2 ** Math.min(failedRuns.current, 4))
    failedRuns.current++
    const id = setTimeout(() => setRetry(r => r + 1), ms)
    return () => clearTimeout(id)
  }, [failed, token])
  // this subscription answered: that is the value, `undefined` included
  if (mine && !failed) return box!.v as T
  // not answered yet: what the previous subscription showed (as dexie-react-hooks itself does), unless that was a failure
  if (!mine && box && box.v !== FAILED) return box.v as T
  // a passing failure: what this same query showed last — never another record's data
  const lg = lastGood.current
  if (lg && sameDeps(lg.deps, deps)) return lg.v
  return defaultResult
}

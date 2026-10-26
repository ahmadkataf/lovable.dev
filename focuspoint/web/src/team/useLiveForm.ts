// Keeps an edit form in step with live data without ever wiping what the admin is typing. The sync loop hands out
// fresh objects every 30 s and after each booking push, so "the data changed" must mean "the VALUES changed": the form
// is re-filled only then, and only while it still shows the previous live values (no unsaved edits). A new `scope`
// (e.g. another room was opened) always re-fills.
import { useEffect, useRef } from 'react'

export function useLiveForm<T>(live: T, scope: unknown, getForm: () => T, setForm: (v: T) => void): void {
  const liveKey = JSON.stringify(live)
  const applied = useRef<{ scope: unknown; key: string } | null>(null)
  const latest = useRef({ getForm, setForm, live })
  latest.current = { getForm, setForm, live }
  useEffect(() => {
    const prev = applied.current
    applied.current = { scope, key: liveKey }
    const { getForm: get, setForm: put, live: value } = latest.current
    if (!prev || prev.scope !== scope) { put(value); return }      // first show, or another record
    if (prev.key === liveKey) return                                // same values in a new object: keep the form
    if (JSON.stringify(get()) === prev.key) put(value)              // no unsaved edits: show the new values
  }, [liveKey, scope])
}

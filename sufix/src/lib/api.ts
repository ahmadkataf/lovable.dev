// Picks the real API when it answers, otherwise the localStorage preview.
import type { Backend } from './backend'
import { remote } from './remote'
import { local } from './local'

let backend: Backend | null = null
export let offline = false

export async function getBackend(): Promise<Backend> {
  if (backend) return backend
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch('/api/health', { signal: ctrl.signal })
    clearTimeout(t)
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) { backend = remote; return backend }
  } catch { /* no api */ }
  offline = true
  backend = local
  return backend
}

/** Shorthand: await (await getBackend()).x — every call waits for the probe the first time. */
export const api = new Proxy({} as Backend, {
  get(_, key: keyof Backend) {
    if (key === 'admin') return new Proxy({} as Backend['admin'], { get: (_, k: keyof Backend['admin']) => async (...args: unknown[]) => ((await getBackend()).admin[k] as (...a: unknown[]) => unknown)(...args) })
    return async (...args: unknown[]) => ((await getBackend())[key] as (...a: unknown[]) => unknown)(...args)
  },
})

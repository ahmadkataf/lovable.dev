// /download/windows: the installer published in parts (scripts/build-public.mjs) is answered as one file, counted
// once; a missing part, or no installer at all, falls back to the settings' link or WhatsApp.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryD1 } from './d1'
import { ensureSchema } from '../src/db'
import type { Env } from '../src/types'

const PARTS = [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6, 7]), new Uint8Array([8])]
const SIZE = PARTS.reduce((n, p) => n + p.length, 0)
const partPath = (i: number) => `/files/windows/setup.00${i}`

/** A stand-in for the static files: the manifest, windows.json and the parts that `publish` lists. */
function assets(publish: number[] = [0, 1, 2], meta: object | null = null): Fetcher {
  const windows = meta ?? { version: '1.0.0', sizeBytes: SIZE, sha256: 'x', parts: PARTS.map((p, i) => ({ path: partPath(i), size: p.length })) }
  const files: Record<string, BodyInit> = { '/files/windows.json': JSON.stringify(windows) }
  for (const i of publish) files[partPath(i)] = PARTS[i]
  files['/files/manifest.json'] = JSON.stringify({ files: [...Object.keys(files), '/files/manifest.json'].sort() })
  return {
    fetch: async (input: RequestInfo | URL) => {
      const path = new URL(input instanceof Request ? input.url : String(input)).pathname
      return path in files ? new Response(files[path]) : new Response('not found', { status: 404 })
    },
  } as unknown as Fetcher
}

async function call(env: Env, init: RequestInit & { headers?: Record<string, string> } = {}) {
  vi.resetModules()   // index.ts reads the published files once per isolate
  const worker = (await import('../src/index')).default
  const waits: Promise<unknown>[] = []
  const ctx = { waitUntil: (p: Promise<unknown>) => { waits.push(p) }, passThroughOnException() {} } as unknown as ExecutionContext
  const res = await worker.fetch(new Request('https://dentora.raqeem.dev/download/windows', { headers: { 'Sec-Fetch-Mode': 'navigate', ...init.headers }, method: init.method }), env, ctx)
  const body = init.method === 'HEAD' ? null : new Uint8Array(await res.arrayBuffer())
  await Promise.all(waits)
  return { res, body }
}
const downloads = async (db: D1Database) => (await ensureSchema(db), await db.prepare("SELECT COALESCE(SUM(count), 0) AS n FROM downloads WHERE platform = 'windows'").first<{ n: number }>())?.n ?? 0

afterEach(() => { vi.resetModules() })

describe('/download/windows with the installer published', () => {
  it('answers the parts back to back as one installer, and counts the download', async () => {
    const env = { DB: memoryD1(), ASSETS: assets() } as Env
    const { res, body } = await call(env)
    expect(res.status).toBe(200)
    expect(Array.from(body!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(res.headers.get('Content-Type')).toBe('application/vnd.microsoft.portable-executable')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="Dentora-Setup-1.0.0.exe"')
    expect(res.headers.get('Accept-Ranges')).toBe('none')
    expect(res.headers.get('Cache-Control')).toMatch(/no-store/)
    expect(await downloads(env.DB)).toBe(1)
  })

  it('HEAD: the headers only, not counted', async () => {
    const env = { DB: memoryD1(), ASSETS: assets() } as Env
    const { res } = await call(env, { method: 'HEAD' })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Length')).toBe(String(SIZE))
    expect(await downloads(env.DB)).toBe(0)
  })

  it('a resumed download (Range) gets the whole file and is not counted again', async () => {
    const env = { DB: memoryD1(), ASSETS: assets() } as Env
    const { res, body } = await call(env, { headers: { Range: 'bytes=4-' } })
    expect(res.status).toBe(200)
    expect(body!.length).toBe(SIZE)
    expect(await downloads(env.DB)).toBe(0)
  })

  it('a download manager’s first request (Range from byte 0) gets the whole file and is counted, once', async () => {
    const env = { DB: memoryD1(), ASSETS: assets() } as Env
    const { res, body } = await call(env, { headers: { Range: 'bytes=0-' } })
    expect(res.status).toBe(200)
    expect(body!.length).toBe(SIZE)
    expect(await downloads(env.DB)).toBe(1)
    // its resume later the same day is the same visitor: still one
    await call(env, { headers: { Range: 'bytes=4-' } })
    await call(env, { headers: { Range: 'bytes=0-' } })
    expect(await downloads(env.DB)).toBe(1)
  })
})

describe('/download/windows without a whole installer', () => {
  it('a part missing from the published files: never a broken file, the WhatsApp request instead', async () => {
    const env = { DB: memoryD1(), ASSETS: assets([0, 2]) } as Env
    const { res } = await call(env)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toMatch(/^https:\/\/wa\.me\/963996489504\?text=/)
  })

  it('parts that do not add up to the installer size are not served', async () => {
    const env = { DB: memoryD1(), ASSETS: assets([0, 1, 2], { version: '1.0.0', sizeBytes: SIZE + 1, parts: PARTS.map((p, i) => ({ path: partPath(i), size: p.length })) }) } as Env
    const { res } = await call(env)
    expect(res.status).toBe(302)
  })
})

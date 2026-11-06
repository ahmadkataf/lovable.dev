// /videos/<lang>/<chapter>.mp4: published under /files/videos/ (scripts/build-public.mjs) and answered by the Worker
// with byte ranges from the edge cache, since the static file layer answers a Range request with the whole file.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryD1 } from './d1'
import type { Env } from '../src/types'

const MP4 = new Uint8Array(Array.from({ length: 100 }, (_, i) => i))
const SHA = 'a'.repeat(64)
const MANIFEST = { 'ar/patients': { durationSeconds: 187, sizeBytes: MP4.length, width: 1920, height: 1080, sha256: SHA, recordedAt: '2026-10-16', scenes: [] } }

/** The static files: the manifest of published paths, the course manifest and the patients video (when published). */
function assets(published = true): Fetcher & { calls: string[] } {
  const files: Record<string, BodyInit> = { '/videos/manifest.json': JSON.stringify(MANIFEST) }
  if (published) files['/files/videos/ar/patients.mp4'] = MP4
  files['/files/manifest.json'] = JSON.stringify({ files: [...Object.keys(files), '/files/manifest.json'].sort() })
  const calls: string[] = []
  return {
    calls,
    fetch: async (input: RequestInfo | URL) => {
      const path = new URL(input instanceof Request ? input.url : String(input)).pathname
      calls.push(path)
      return path in files ? new Response(files[path], { headers: { 'Content-Length': String(path.endsWith('.mp4') ? MP4.length : 0) } }) : new Response('not found', { status: 404 })
    },
  } as unknown as Fetcher & { calls: string[] }
}

/** A stand-in for caches.default that answers ranges like the edge cache does. */
function fakeCache() {
  const store = new Map<string, { body: Uint8Array; headers: Headers }>()
  return {
    store,
    async put(key: RequestInfo, res: Response) {
      store.set(typeof key === 'string' ? key : key.url, { body: new Uint8Array(await res.arrayBuffer()), headers: new Headers(res.headers) })
    },
    async match(req: Request) {
      const hit = store.get(req.url)
      if (!hit) return undefined
      if (req.headers.get('If-None-Match') === hit.headers.get('ETag')) return new Response(null, { status: 304, headers: hit.headers })
      const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.get('Range') || '')
      if (!m) return new Response(hit.body, { status: 200, headers: hit.headers })
      const a = Number(m[1]), b = m[2] ? Math.min(Number(m[2]), hit.body.length - 1) : hit.body.length - 1
      const headers = new Headers(hit.headers)
      headers.set('Content-Range', `bytes ${a}-${b}/${hit.body.length}`)
      headers.set('Content-Length', String(b - a + 1))
      return new Response(hit.body.slice(a, b + 1), { status: 206, headers })
    },
  }
}

async function call(env: Env, path: string, headers: Record<string, string> = {}, method = 'GET') {
  vi.resetModules()   // index.ts reads the published files once per isolate
  const worker = (await import('../src/index')).default
  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext
  const res = await worker.fetch(new Request(`https://dentora.raqeem.dev${path}`, { headers, method }), env, ctx)
  const body = method === 'HEAD' ? null : new Uint8Array(await res.arrayBuffer())
  return { res, body }
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe('/videos/<lang>/<chapter>.mp4 with the edge cache', () => {
  it('a range is answered with 206 and those bytes, and the file is put in the cache under its sha256', async () => {
    const cache = fakeCache()
    vi.stubGlobal('caches', { default: cache })
    const env = { DB: memoryD1(), ASSETS: assets() } as Env
    const { res, body } = await call(env, '/videos/ar/patients.mp4?v=74690bdec6b3', { Range: 'bytes=0-1' })
    expect(res.status).toBe(206)
    expect(Array.from(body!)).toEqual([0, 1])
    expect(res.headers.get('Content-Range')).toBe('bytes 0-1/100')
    expect(res.headers.get('Content-Type')).toBe('video/mp4')
    expect(res.headers.get('ETag')).toBe(`"${SHA}"`)
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect([...cache.store.keys()]).toEqual([`https://dentora.raqeem.dev/videos/ar/patients.mp4?sha256=${SHA}`])
  })

  it('a later range comes from the cache without reading the file again', async () => {
    const cache = fakeCache()
    vi.stubGlobal('caches', { default: cache })
    const a = assets()
    const env = { DB: memoryD1(), ASSETS: a } as Env
    await call(env, '/videos/ar/patients.mp4', { Range: 'bytes=0-1' })
    const reads = a.calls.filter(p => p.endsWith('.mp4')).length
    const { res, body } = await call(env, '/videos/ar/patients.mp4', { Range: 'bytes=90-' })
    expect(res.status).toBe(206)
    expect(Array.from(body!)).toEqual([90, 91, 92, 93, 94, 95, 96, 97, 98, 99])
    expect(a.calls.filter(p => p.endsWith('.mp4')).length).toBe(reads)
  })

  it('no range: the whole file; a revalidation with its ETag: 304', async () => {
    vi.stubGlobal('caches', { default: fakeCache() })
    const env = { DB: memoryD1(), ASSETS: assets() } as Env
    const { res, body } = await call(env, '/videos/ar/patients.mp4')
    expect(res.status).toBe(200)
    expect(body!.length).toBe(100)
    const again = await call(env, '/videos/ar/patients.mp4', { 'If-None-Match': `"${SHA}"` })
    expect(again.res.status).toBe(304)
  })

  it('HEAD: the headers of the range, no body', async () => {
    vi.stubGlobal('caches', { default: fakeCache() })
    const env = { DB: memoryD1(), ASSETS: assets() } as Env
    const { res } = await call(env, '/videos/ar/patients.mp4', { Range: 'bytes=0-9' }, 'HEAD')
    expect(res.status).toBe(206)
    expect(res.body).toBeNull()
    expect(res.headers.get('Content-Length')).toBe('10')
  })
})

describe('/videos/<lang>/<chapter>.mp4 without a cache, or not published', () => {
  it('no edge cache (workers.dev, tests): the whole file, without Accept-Ranges', async () => {
    const env = { DB: memoryD1(), ASSETS: assets() } as Env
    const { res, body } = await call(env, '/videos/ar/patients.mp4', { Range: 'bytes=0-1' })
    expect(res.status).toBe(200)
    expect(body!.length).toBe(100)
    expect(res.headers.get('Accept-Ranges')).toBe('none')
    expect(res.headers.get('Last-Modified')).toBe('Fri, 16 Oct 2026 00:00:00 GMT')
  })

  it('a chapter not in the manifest, a file not published, another language, a bad name: the 404 page', async () => {
    vi.stubGlobal('caches', { default: fakeCache() })
    for (const [path, published] of [['/videos/ar/chart.mp4', true], ['/videos/ar/patients.mp4', false], ['/videos/en/patients.mp4', true], ['/videos/ar/Patients.mp4', true], ['/videos/fr/patients.mp4', true]] as const) {
      const env = { DB: memoryD1(), ASSETS: assets(published) } as Env
      const { res } = await call(env, path)
      expect(res.status, path).toBe(404)
    }
  })
})

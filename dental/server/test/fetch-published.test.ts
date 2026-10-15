// scripts/fetch-published.mjs: before a deploy, the big published files this machine lacks (the Windows installer,
// the course videos) come down from the site, checked against what it advertises, into a tree whose files are never
// overwritten. A node:http server stands in for the site (the Worker's answers: /files/* is 404 by design, the
// installer streams through /download/windows, the videos are static files); a temp directory for the tree.
import { execFile } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ChecksumError, fetchInstaller, fetchPublished, fetchVideos, readWindowsMeta } from '../scripts/fetch-published.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(here, '..', 'scripts', 'fetch-published.mjs')
/** The CLI reads the app's version; the fake site publishes that one unless a test says otherwise. */
const VERSION: string = JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8')).version

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
const INSTALLER = randomBytes(3 * 65536 + 123)   // streamed in pieces, like the Worker's parts
const MP4 = randomBytes(70000)
const VTT = Buffer.from('WEBVTT\n\n00:00:03.000 --> 00:00:06.000\nنفتح قائمة المرضى.\n')
const JPG = randomBytes(900)
const record = (lang: string) => ({
  durationSeconds: 61.2, sizeBytes: MP4.length, width: 1920, height: 1080, sha256: sha(MP4),
  scenes: [{ id: 'open', start: 3, text: lang === 'ar' ? 'نفتح قائمة المرضى.' : 'Open Patients.' }], recordedAt: '2026-10-15T20:00:00Z',
})
const MANIFEST: Record<string, object> = { 'ar/patients': record('ar'), 'en/patients': record('en') }
const videoFiles = (keys: string[]) => Object.fromEntries(keys.flatMap(k => [[`/videos/${k}.mp4`, MP4], [`/videos/${k}.vtt`, VTT], [`/videos/${k}.jpg`, JPG]]))

interface Site {
  /** The Worker serves /files/windows.json (today it does not: /files/* is 404 by design). */
  windowsJson: boolean
  /** null = no installer published: /download/windows answers 302 to WhatsApp. */
  installer: Buffer | null
  version: string
  /** The advertised checksum (default: the real one). */
  sha256?: string
  /** /download/windows answers 500 (the site is broken mid-deploy). */
  brokenDownload?: boolean
  /** This many GETs of /download/windows are cut after the first piece (a connection dropped). */
  cutDownload?: number
  /** The published manifest; null = 404 (none yet). */
  videos: Record<string, object> | null
  files: Record<string, Buffer>
  /** "METHOD /path" of every request. */
  hits: string[]
}
const site = (over: Partial<Site> = {}): Site => ({ windowsJson: true, installer: INSTALLER, version: VERSION, videos: MANIFEST, files: videoFiles(Object.keys(MANIFEST)), hits: [], ...over })

/** The stand-in for the site: what the Worker and the static files answer. */
function handle(s: Site, req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url || '/', 'http://x').pathname
  s.hits.push(`${req.method} ${path}`)
  const json = (body: object) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
  const notFound = () => { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>not found</title>') }
  if (path === '/files/windows.json') {
    if (!s.windowsJson || !s.installer) return notFound()
    return json({ version: s.version, sizeBytes: s.installer.length, sha256: s.sha256 ?? sha(s.installer), parts: [{ path: '/files/windows/setup.000', size: s.installer.length }] })
  }
  if (path === '/download/windows') {
    if (!s.installer) { res.writeHead(302, { Location: 'https://wa.me/963996489504' }); return res.end() }
    if (s.brokenDownload) { res.writeHead(500, { 'Content-Type': 'text/plain' }); return res.end('broken') }
    res.writeHead(200, {
      'Content-Type': 'application/vnd.microsoft.portable-executable', 'Content-Length': s.installer.length,
      'Content-Disposition': `attachment; filename="Dentora-Setup-${s.version}.exe"`, 'Accept-Ranges': 'none',
    })
    if (req.method === 'HEAD') return res.end()
    const bytes = s.installer
    const cut = (s.cutDownload ?? 0) > 0
    if (cut) s.cutDownload!--
    let at = 0
    const next = () => {
      if (at >= bytes.length) return res.end()
      res.write(bytes.subarray(at, at += 65536))
      if (cut) return res.destroy()
      setImmediate(next)
    }
    return next()
  }
  if (path === '/videos/manifest.json') return s.videos ? json(s.videos) : notFound()
  if (path in s.files) { res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': s.files[path].length }); return res.end(s.files[path]) }
  notFound()
}

let server: Server | null = null
let origin = ''
let dir = ''
const serve = (s: Site) => new Promise<void>(resolve => {
  server = createServer((req, res) => handle(s, req, res)).listen(0, '127.0.0.1', () => {
    origin = `http://127.0.0.1:${(server!.address() as { port: number }).port}`
    resolve()
  })
})
/** The local tree: the installer in releases/, the videos in server/site/videos/ (the real layout). */
const tree = () => ({ setup: join(dir, 'releases', `Dentora-Setup-${VERSION}.exe`), videos: join(dir, 'server', 'site', 'videos') })
const put = (file: string, bytes: Buffer | string) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes) }
const putVideos = (videos: string, keys: string[], mp4 = MP4, manifest: Record<string, object> | null = MANIFEST) => {
  for (const k of keys) { put(join(videos, `${k}.mp4`), mp4); put(join(videos, `${k}.vtt`), VTT); put(join(videos, `${k}.jpg`), JPG) }
  if (manifest) put(join(videos, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
}
const logs = () => { const lines: string[] = []; const warnings: string[] = []; return { lines, warnings, log: (l: string) => { lines.push(l) }, warn: (l: string) => { warnings.push(l) } } }
const leftovers = (d: string): string[] => existsSync(d) ? readdirSync(d, { recursive: true }).map(String).filter(f => f.endsWith('.part')) : []

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fetch-published-')) })
afterEach(async () => {
  rmSync(dir, { recursive: true, force: true })
  await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve())
  server = null
})

describe('the published installer', () => {
  it('reads version, size and sha256 from /files/windows.json when the Worker serves it', async () => {
    await serve(site())
    expect(await readWindowsMeta(origin)).toEqual({ version: VERSION, sizeBytes: INSTALLER.length, sha256: sha(INSTALLER), source: '/files/windows.json' })
  })
  it('falls back to the headers of HEAD /download/windows (no checksum) when /files/* is 404, as the Worker answers', async () => {
    const s = site({ windowsJson: false })
    await serve(s)
    expect(await readWindowsMeta(origin)).toEqual({ version: VERSION, sizeBytes: INSTALLER.length, sha256: null, source: 'HEAD /download/windows' })
    expect(s.hits).toEqual(['GET /files/windows.json', 'HEAD /download/windows'])
  })
  it('is null when none is published (302 to WhatsApp)', async () => {
    await serve(site({ windowsJson: false, installer: null }))
    expect(await readWindowsMeta(origin)).toBeNull()
  })
})

describe('fetchPublished', () => {
  it('everything present: nothing is downloaded, nothing is overwritten', async () => {
    const s = site()
    await serve(s)
    const { setup, videos } = tree()
    put(setup, INSTALLER)
    putVideos(videos, Object.keys(MANIFEST))
    const l = logs()
    expect(await fetchPublished({ origin, version: VERSION, setup, videos, ...l })).toBe(true)
    expect(l.lines.filter(x => /^fetch-published: present /.test(x))).toHaveLength(1 + 2 * 3)
    expect(l.lines.filter(x => /fetched|written/.test(x))).toEqual([])
    expect(s.hits.filter(h => h.startsWith('GET /download') || /^GET \/videos\/(ar|en)\//.test(h))).toEqual([])
    expect(readFileSync(join(videos, 'manifest.json'), 'utf8')).toBe(JSON.stringify(MANIFEST, null, 2) + '\n')
    expect(l.warnings).toEqual([])
  })

  it('missing installer: downloaded through /download/windows and verified against windows.json', async () => {
    const s = site()
    await serve(s)
    const { setup, videos } = tree()
    putVideos(videos, Object.keys(MANIFEST))
    const l = logs()
    expect(await fetchPublished({ origin, version: VERSION, setup, videos, ...l })).toBe(true)
    expect(readFileSync(setup).equals(INSTALLER)).toBe(true)
    expect(l.lines[0]).toMatch(/^fetch-published: fetched .*Dentora-Setup-.*\.exe \(0\.2 MB, sha256 [0-9a-f]{12}… verified, [\d.]+ s\)$/)
    expect(s.hits).toContain('GET /download/windows')
    expect(leftovers(dir)).toEqual([])
  })

  it('missing installer with /files/windows.json 404: downloaded by the HEAD headers, checked by size only', async () => {
    await serve(site({ windowsJson: false }))
    const { setup } = tree()
    const l = logs()
    expect(await fetchInstaller({ origin, version: VERSION, setup, ...l })).toEqual({ status: 'fetched', reason: expect.stringMatching(/size verified only: HEAD \/download\/windows gives no sha256/) })
    expect(readFileSync(setup).equals(INSTALLER)).toBe(true)
  })

  it('checksum mismatch: nothing is left on disk, the run fails', async () => {
    await serve(site({ sha256: 'deadbeef'.repeat(8) }))
    const { setup, videos } = tree()
    const l = logs()
    expect(await fetchPublished({ origin, version: VERSION, setup, videos, ...l })).toBe(false)
    expect(existsSync(setup)).toBe(false)
    expect(leftovers(dir)).toEqual([])
    await expect(fetchInstaller({ origin, version: VERSION, setup, ...l })).rejects.toBeInstanceOf(ChecksumError)
  })

  it('a cut connection gets one more try, with a warning', async () => {
    await serve(site({ cutDownload: 1 }))
    const { setup } = tree()
    const l = logs()
    expect((await fetchInstaller({ origin, version: VERSION, setup, ...l })).status).toBe('fetched')
    expect(readFileSync(setup).equals(INSTALLER)).toBe(true)
    expect(l.warnings).toEqual([expect.stringMatching(/Dentora-Setup-.*\.exe: .*; trying once more$/)])
    expect(leftovers(dir)).toEqual([])
  })

  it('a connection cut twice fails the run', async () => {
    await serve(site({ cutDownload: 2 }))
    const { setup, videos } = tree()
    expect(await fetchPublished({ origin, version: VERSION, setup, videos, ...logs() })).toBe(false)
    expect(existsSync(setup)).toBe(false)
    expect(leftovers(dir)).toEqual([])
  })

  it('a network error on an advertised file fails the run', async () => {
    await serve(site({ brokenDownload: true }))
    const { setup, videos } = tree()
    expect(await fetchPublished({ origin, version: VERSION, setup, videos, ...logs() })).toBe(false)
    expect(existsSync(setup)).toBe(false)
  })

  it('version mismatch: skipped with a warning, nothing downloaded', async () => {
    const s = site({ version: '9.9.9' })
    await serve(s)
    const { setup } = tree()
    const l = logs()
    expect(await fetchInstaller({ origin, version: VERSION, setup, ...l })).toEqual({ status: 'skipped', reason: `the site has 9.9.9, not ${VERSION}` })
    expect(l.warnings).toEqual([expect.stringMatching(/the site has installer 9\.9\.9, this is .*: not fetched/)])
    expect(existsSync(setup)).toBe(false)
    expect(s.hits).not.toContain('GET /download/windows')
  })

  it('no installer published: skipped', async () => {
    await serve(site({ installer: null }))
    const { setup } = tree()
    const l = logs()
    expect(await fetchInstaller({ origin, version: VERSION, setup, ...l })).toEqual({ status: 'skipped', reason: 'the site has no installer' })
    expect(l.lines).toEqual([expect.stringMatching(/^skipped .*\(the site has no installer\)$/)])
  })

  it('an installer already on disk stays, with a note when it is not the one on the site', async () => {
    await serve(site())
    const { setup } = tree()
    put(setup, Buffer.from('a build of my own'))
    const l = logs()
    expect(await fetchInstaller({ origin, version: VERSION, setup, ...l })).toEqual({ status: 'present', reason: expect.stringMatching(/differs from the site's .*: the deploy replaces it/) })
    expect(readFileSync(setup, 'utf8')).toBe('a build of my own')
  })

  it('WINDOWS_SETUP=none: skipped without reading the site', async () => {
    const s = site()
    await serve(s)
    expect(await fetchInstaller({ origin, version: VERSION, setup: 'none', ...logs() })).toEqual({ status: 'skipped', reason: 'WINDOWS_SETUP=none: no installer is published' })
    expect(s.hits).toEqual([])
  })
})

describe('the published videos', () => {
  it('manifest 404: skipped, nothing written', async () => {
    await serve(site({ videos: null }))
    const { videos } = tree()
    const l = logs()
    expect(await fetchVideos({ origin, videos, ...l })).toEqual({ status: 'skipped', fetched: 0, present: 0, skipped: 0 })
    expect(l.lines).toEqual([expect.stringMatching(/^skipped .*\(no videos published yet\)$/)])
    expect(existsSync(videos)).toBe(false)
  })

  it('a page in the way of /videos/manifest.json (HTML 200) counts as not published', async () => {
    const s = site({ videos: null })
    await serve(s)
    server!.removeAllListeners('request')
    server!.on('request', (_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html>') })
    const l = logs()
    expect((await fetchVideos({ origin, videos: tree().videos, ...l })).status).toBe('skipped')
    expect(l.warnings).toEqual([expect.stringMatching(/not JSON on the site/)])
  })

  it('missing chapters are downloaded, the .mp4 verified, and the manifest written with the local entries winning', async () => {
    const s = site({ videos: { ...MANIFEST, '../../etc/evil': record('ar') } })
    await serve(s)
    const { videos } = tree()
    // ar/patients recorded here (another recording than the site's), en/patients missing, nothing else
    const mine = randomBytes(5000)
    const local = { 'ar/patients': { ...record('ar'), sizeBytes: mine.length, sha256: sha(mine), recordedAt: '2026-10-16T09:00:00Z' } }
    putVideos(videos, ['ar/patients'], mine, local)
    const l = logs()
    expect(await fetchVideos({ origin, videos, ...l })).toEqual({ status: 'fetched', fetched: 1, present: 1, skipped: 0 })
    expect(readFileSync(join(videos, 'ar', 'patients.mp4')).equals(mine)).toBe(true)
    expect(readFileSync(join(videos, 'en', 'patients.mp4')).equals(MP4)).toBe(true)
    expect(readFileSync(join(videos, 'en', 'patients.vtt')).equals(VTT)).toBe(true)
    expect(readFileSync(join(videos, 'en', 'patients.jpg')).equals(JPG)).toBe(true)
    expect(JSON.parse(readFileSync(join(videos, 'manifest.json'), 'utf8'))).toEqual({ 'ar/patients': local['ar/patients'], 'en/patients': MANIFEST['en/patients'] })
    expect(l.lines).toEqual([
      expect.stringMatching(/^present .*ar\/patients\.mp4 \(another recording than the site's: the deploy replaces it\)$/),
      expect.stringMatching(/^fetched .*en\/patients\.mp4 \(0\.1 MB, sha256 [0-9a-f]{12}… verified, [\d.]+ s\)$/),
      expect.stringMatching(/^fetched .*en\/patients\.vtt \(\d+ bytes\)$/),
      expect.stringMatching(/^fetched .*en\/patients\.jpg \(\d+ bytes\)$/),
      expect.stringMatching(/^written .*manifest\.json \(2 entries\)$/),
    ])
    expect(l.warnings).toEqual([expect.stringMatching(/ignoring manifest entry "\.\.\/\.\.\/etc\/evil"/)])
    expect(s.hits.filter(h => h.startsWith('GET /videos/ar/'))).toEqual([])
    expect(existsSync(join(dir, 'etc'))).toBe(false)
    expect(leftovers(dir)).toEqual([])
  })

  it('a checksum mismatch on an .mp4 fails before anything else of that chapter is written', async () => {
    await serve(site({ videos: { 'en/patients': { ...record('en'), sha256: 'deadbeef'.repeat(8) } } }))
    const { videos } = tree()
    await expect(fetchVideos({ origin, videos, ...logs() })).rejects.toBeInstanceOf(ChecksumError)
    expect(existsSync(join(videos, 'en')) ? readdirSync(join(videos, 'en')) : []).toEqual([])
    expect(existsSync(join(videos, 'manifest.json'))).toBe(false)
    expect(leftovers(dir)).toEqual([])
  })

  it('an .mp4 on disk that is neither in the local manifest nor the published recording is left alone and reported', async () => {
    await serve(site({ videos: { 'en/patients': record('en') } }))
    const { videos } = tree()
    putVideos(videos, ['en/patients'], randomBytes(100), null)
    const l = logs()
    expect(await fetchVideos({ origin, videos, ...l })).toEqual({ status: 'skipped', fetched: 0, present: 0, skipped: 1 })
    expect(l.warnings).toEqual([expect.stringMatching(/en\/patients\.mp4 is on disk but is not the published recording/)])
    expect(existsSync(join(videos, 'manifest.json'))).toBe(false)
  })

  it('a transcript published before its recording travels with the manifest, no file to fetch', async () => {
    const s = site({ videos: { 'ar/patients': { durationSeconds: 0, sizeBytes: 0, width: 0, height: 0, sha256: '', scenes: [{ id: 'open', start: 0, text: 'نفتح' }] } } })
    await serve(s)
    const { videos } = tree()
    expect(await fetchVideos({ origin, videos, ...logs() })).toEqual({ status: 'present', fetched: 0, present: 1, skipped: 0 })
    expect(Object.keys(JSON.parse(readFileSync(join(videos, 'manifest.json'), 'utf8')))).toEqual(['ar/patients'])
    expect(s.hits.filter(h => h.startsWith('GET /videos/ar/'))).toEqual([])
  })
})

describe('the command', () => {
  // asynchronous: the fake site lives in this process, a blocking spawn would never answer the child
  const run = (env: Record<string, string>) => new Promise<{ status: number; out: string; err: string }>(resolve => {
    const { setup, videos } = tree()
    const e = { ...process.env, PUBLISHED_ORIGIN: origin, FETCH_RELEASES_DIR: dirname(setup), FETCH_VIDEOS_DIR: videos, ...env }
    execFile(process.execPath, [SCRIPT], { env: e, encoding: 'utf8' }, (error, out, err) => {
      resolve({ status: error ? (error as { code?: number }).code ?? 1 : 0, out, err })
    })
  })

  it('exits 1 on a checksum mismatch, saying what to do', async () => {
    await serve(site({ sha256: 'deadbeef'.repeat(8) }))
    const r = await run({})
    expect(r.status).toBe(1)
    expect(r.err).toMatch(/Windows installer: .*sha256 [0-9a-f]{12}… is not the advertised deadbeefdead…/)
    expect(r.err).toMatch(/not deploying \(SKIP_FETCH=1/)
    expect(existsSync(tree().setup)).toBe(false)
  })

  it('exits 0 with everything fetched into the tree the environment names', async () => {
    await serve(site())
    const r = await run({})
    expect(r.status, r.err).toBe(0)
    expect(r.out).toMatch(/^fetch-published: reading http:\/\/127\.0\.0\.1:\d+ for version /)
    expect(readFileSync(tree().setup).equals(INSTALLER)).toBe(true)
    expect(existsSync(join(tree().videos, 'manifest.json'))).toBe(true)
  })

  it('SKIP_FETCH=1 reads nothing', async () => {
    const s = site()
    await serve(s)
    const r = await run({ SKIP_FETCH: '1' })
    expect(r.status).toBe(0)
    expect(r.out).toBe('fetch-published: SKIP_FETCH=1, nothing read from the site\n')
    expect(s.hits).toEqual([])
  })
})

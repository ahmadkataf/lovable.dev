// Before a deploy, downloads the big published files this machine does not have. The Windows installer
// (../releases/Dentora-Setup-<version>.exe) and the course videos (site/videos/) are git-ignored build outputs, and
// `wrangler deploy` publishes exactly what public/ holds: a deploy from a machine without them would silently take
// them off the site. `npm run deploy` runs this before the build; `npm run fetch-published` runs it alone.
//   the installer   The Worker answers /files/* with 404 on purpose (downloads are counted through /download/*),
//                   except /files/windows.json and /files/meta.json, served while the download they describe is.
//                   What is published is read from /files/windows.json (version, size, sha256), else (an older
//                   Worker, or no installer) from the headers of HEAD /download/windows (version and size, no
//                   checksum: the file is then checked by size only and the line says so), and the file itself
//                   comes through GET /download/windows, which streams the parts as one file. The version must be the one of
//                   ../package.json (the build publishes that one), else the installer is skipped with a warning.
//   the videos      /videos/manifest.json (404 = none published yet) names <lang>/<slug>.mp4, .vtt and .jpg; the
//                   .mp4 is checked against the manifest's sha256. The local manifest is written only once every file
//                   of an entry is on disk, and an entry already in it wins (the file on disk is what gets deployed).
// Never overwrites a file that exists; prints one line per file (fetched / present / skipped and why). Exit 1 when a
// downloaded file fails its check, when a file the site advertises cannot be downloaded (one more try after a cut
// connection), and when the site cannot be read at all (nobody knows then what a deploy would drop). The download requests are not counted as downloads by
// the Worker (Sec-Fetch-Mode other than navigate, src/index.ts count()).
//   PUBLISHED_ORIGIN=https://…       the site to read (default: ORIGIN of src/types.ts)
//   SKIP_FETCH=1                     read nothing: deploy what this machine has
//   WINDOWS_SETUP=<path> | none      where the installer is, as build-public.mjs reads it (none = publish none)
//   FETCH_RELEASES_DIR, FETCH_VIDEOS_DIR   where the files go (default ../releases and site/videos; the tests and a
//                                    dry run point them at a scratch directory)
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ORIGIN } from '../src/types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = join(root, '..')

/** The three files of a recorded chapter (docs/VIDEOS.md); the .mp4 is the one with a checksum. */
const VIDEO_EXTS = ['.mp4', '.vtt', '.jpg']
/** A manifest key names files on disk: only "<lang>/<slug>" of the chapter list, never a path. */
const VIDEO_KEY = /^(ar|en)\/[a-z0-9][a-z0-9-]*$/

/** A downloaded file that is not what the site advertised (the deploy must not publish it). */
export class ChecksumError extends Error {}

/** The Worker counts a navigation as a download; a fetch from a script (Sec-Fetch-Mode: cors) is not one. */
const HEADERS = { 'User-Agent': 'dentora-fetch-published', 'Sec-Fetch-Mode': 'cors' }
const get = (url, init = {}) => fetch(url, { redirect: 'manual', headers: HEADERS, ...init })
const mb = n => `${(n / 1048576).toFixed(1)} MB`
const short = sha => `${sha.slice(0, 12)}…`
/** A path as the lines show it: inside the app's tree relative to it, elsewhere as it is. */
const show = p => { const r = relative(app, p); return r && !r.startsWith('..') && !isAbsolute(r) ? r : p }

// ---- downloading -------------------------------------------------------------------------------------------------
/**
 * Streams `url` into `file` through `file.part`, hashing on the way; the file appears only once it is whole and
 * (when advertised) its size and sha256 match. On any failure nothing is left behind.
 */
export async function download(url, file, { sizeBytes = null, sha256 = null, label = file } = {}) {
  const res = await get(url)
  if (!res.ok || !res.body) throw new Error(`GET ${url.pathname}: ${res.status}`)
  mkdirSync(dirname(file), { recursive: true })
  const part = `${file}.part`
  const hash = createHash('sha256')
  let size = 0
  try {
    await pipeline(
      Readable.fromWeb(res.body),
      async function* (chunks) { for await (const chunk of chunks) { hash.update(chunk); size += chunk.length; yield chunk } },
      createWriteStream(part),
    )
    const digest = hash.digest('hex')
    if (sizeBytes != null && size !== sizeBytes) throw new ChecksumError(`${label}: ${size} bytes, the site advertises ${sizeBytes}`)
    if (sha256 && digest !== sha256) throw new ChecksumError(`${label}: sha256 ${short(digest)} is not the advertised ${short(sha256)}`)
    // appeared meanwhile (another fetch, the recorder): the file that exists stays
    if (existsSync(file)) { rmSync(part, { force: true }); return { size, sha256: digest, kept: true } }
    renameSync(part, file)
    return { size, sha256: digest, kept: false }
  } catch (e) {
    rmSync(part, { force: true })
    throw e
  }
}

/** One more try after a cut connection (never after a failed check): a deploy should not stop on a hiccup. */
async function downloadRetrying(url, file, opts, warn) {
  try {
    return await download(url, file, opts)
  } catch (e) {
    if (e instanceof ChecksumError) throw e
    warn(`fetch-published: ${opts.label}: ${e.message}${e.cause instanceof Error ? ` (${e.cause.message})` : ''}; trying once more`)
    return download(url, file, opts)
  }
}

export function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

// ---- the Windows installer ---------------------------------------------------------------------------------------
/**
 * The installer the site publishes: from /files/windows.json when the Worker serves it, else from the headers of
 * HEAD /download/windows (the file name carries the version; there is no checksum then). null = none published
 * (the button goes to the settings' link or WhatsApp: a 302).
 */
export async function readWindowsMeta(origin) {
  const json = await get(new URL('/files/windows.json', origin))
  if (json.ok && /json/.test(json.headers.get('Content-Type') || '')) {
    const w = await json.json()
    if (!(w.sizeBytes > 0) || typeof w.version !== 'string') throw new Error('/files/windows.json: no version or size')
    return { version: w.version, sizeBytes: Number(w.sizeBytes), sha256: typeof w.sha256 === 'string' ? w.sha256 : null, source: '/files/windows.json' }
  }
  if (!json.ok && json.status !== 404) throw new Error(`GET /files/windows.json: ${json.status}`)
  const head = await get(new URL('/download/windows', origin), { method: 'HEAD' })
  if (head.status === 302 || head.status === 404) return null
  if (!head.ok) throw new Error(`HEAD /download/windows: ${head.status}`)
  const name = /filename="Dentora-Setup-([^"]+)\.exe"/.exec(head.headers.get('Content-Disposition') || '')
  const sizeBytes = Number(head.headers.get('Content-Length'))
  if (!name || !(sizeBytes > 0)) throw new Error('HEAD /download/windows: the headers name no installer')
  return { version: name[1], sizeBytes, sha256: null, source: 'HEAD /download/windows' }
}

/**
 * Makes sure the installer the build would publish (`setup`, build-public.mjs's path) is on disk when the site has
 * it. Returns { status: 'fetched' | 'present' | 'skipped', reason }.
 */
export async function fetchInstaller({ origin, version, setup, log = console.log, warn = console.warn }) {
  const result = (status, reason = '') => { log(`${status} ${show(setup)}${reason ? ` (${reason})` : ''}`); return { status, reason } }
  if (setup === 'none') return result('skipped', 'WINDOWS_SETUP=none: no installer is published')
  if (existsSync(setup) && statSync(setup).size > 0) {
    // what the site has next to it, as a note only: the file on disk is what gets published
    let note = ''
    try {
      const meta = await readWindowsMeta(origin)
      if (meta && (meta.version !== version || meta.sizeBytes !== statSync(setup).size)) note = `differs from the site's ${meta.version}, ${mb(meta.sizeBytes)}: the deploy replaces it`
    } catch (e) { note = `the site could not be read: ${e.message}` }
    return result('present', note)
  }
  const meta = await readWindowsMeta(origin)
  if (!meta) return result('skipped', 'the site has no installer')
  if (meta.version !== version) {
    warn(`fetch-published: the site has installer ${meta.version}, this is ${version}: not fetched; the deploy publishes no installer unless ${show(setup)} exists`)
    return result('skipped', `the site has ${meta.version}, not ${version}`)
  }
  const t = Date.now()
  const { size, sha256, kept } = await downloadRetrying(new URL('/download/windows', origin), setup, { sizeBytes: meta.sizeBytes, sha256: meta.sha256, label: show(setup) }, warn)
  if (kept) return result('present', 'appeared while downloading')
  const check = meta.sha256 ? `sha256 ${short(sha256)} verified` : `size verified only: ${meta.source} gives no sha256`
  return result('fetched', `${mb(size)}, ${check}, ${((Date.now() - t) / 1000).toFixed(1)} s`)
}

// ---- the course videos -------------------------------------------------------------------------------------------
/** The published manifest, or null when none is published yet (404, or not JSON: the Worker is in the way). */
export async function readVideoManifest(origin, warn = console.warn) {
  const res = await get(new URL('/videos/manifest.json', origin))
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET /videos/manifest.json: ${res.status}`)
  if (!/json/.test(res.headers.get('Content-Type') || '')) {
    warn(`fetch-published: /videos/manifest.json is not JSON on the site (${res.headers.get('Content-Type') || 'no type'}): taken as not published`)
    return null
  }
  const m = await res.json()
  return m && typeof m === 'object' && !Array.isArray(m) ? m : null
}

const readLocalManifest = file => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return {} }
}
const allExist = paths => paths.every(p => existsSync(p))

/**
 * Makes sure every recorded chapter the site publishes is in `videos` (site/videos/), then writes the merged
 * manifest. Returns { status: 'fetched' | 'present' | 'skipped', fetched, present, skipped } (counts of entries).
 */
export async function fetchVideos({ origin, videos, log = console.log, warn = console.warn }) {
  const counts = { fetched: 0, present: 0, skipped: 0 }
  const remote = await readVideoManifest(origin, warn)
  if (!remote) { log(`skipped ${show(videos)} (no videos published yet)`); return { status: 'skipped', ...counts } }
  const manifestFile = join(videos, 'manifest.json')
  const local = readLocalManifest(manifestFile)
  const merged = { ...local }
  let changed = false
  for (const [key, entry] of Object.entries(remote)) {
    if (!VIDEO_KEY.test(key) || !entry || typeof entry !== 'object') {
      warn(`fetch-published: ignoring manifest entry "${key}": not a <lang>/<slug> key`)
      continue
    }
    const files = Object.fromEntries(VIDEO_EXTS.map(ext => [ext, join(videos, `${key}${ext}`)]))
    const label = `${show(videos)}/${key}`
    const hasFile = entry.sizeBytes > 0 && typeof entry.sha256 === 'string'
    if (!hasFile) {
      // a transcript published before its recording: nothing to download, the entry travels with the manifest
      if (!(key in local)) { merged[key] = entry; changed = true }
      log(`present ${label} (transcript only, no file published)`)
      counts.present++
      continue
    }
    if (key in local && local[key].sha256 !== entry.sha256 && allExist(Object.values(files))) {
      log(`present ${label}.mp4 (another recording than the site's: the deploy replaces it)`)
      counts.present++
      continue
    }
    if (key in local && local[key].sha256 !== entry.sha256) {
      warn(`fetch-published: ${label}: the local manifest names a recording that is not on disk and the site has another one; record it again (store/scripts/video/make.mjs) or delete its entry`)
      log(`skipped ${label} (local manifest entry without its files)`)
      counts.skipped++
      continue
    }
    // the .mp4 first: when it is already here it must be the published recording, else its captions and poster
    // would belong to another one
    const mp4 = files['.mp4']
    let fetchedHere = 0
    if (existsSync(mp4)) {
      if (!(key in local) && sha256File(mp4) !== entry.sha256) {
        warn(`fetch-published: ${label}.mp4 is on disk but is not the published recording and the local manifest does not know it; record it again or delete it`)
        log(`skipped ${label} (unknown recording on disk)`)
        counts.skipped++
        continue
      }
      log(`present ${label}.mp4`)
    } else {
      const t = Date.now()
      const { size, sha256, kept } = await downloadRetrying(new URL(`/videos/${key}.mp4`, origin), mp4, { sizeBytes: entry.sizeBytes, sha256: entry.sha256, label: `${label}.mp4` }, warn)
      if (kept) log(`present ${label}.mp4 (appeared while downloading)`)
      else { log(`fetched ${label}.mp4 (${mb(size)}, sha256 ${short(sha256)} verified, ${((Date.now() - t) / 1000).toFixed(1)} s)`); fetchedHere++ }
    }
    for (const ext of VIDEO_EXTS.slice(1)) {
      if (existsSync(files[ext])) { log(`present ${label}${ext}`); continue }
      const { size, kept } = await downloadRetrying(new URL(`/videos/${key}${ext}`, origin), files[ext], { label: `${label}${ext}` }, warn)
      if (kept) log(`present ${label}${ext} (appeared while downloading)`)
      else { log(`fetched ${label}${ext} (${size} bytes)`); fetchedHere++ }
    }
    if (!(key in local)) { merged[key] = entry; changed = true }
    counts[fetchedHere ? 'fetched' : 'present']++
  }
  for (const key of Object.keys(local)) {
    if (!(key in remote) && VIDEO_KEY.test(key) && local[key]?.sizeBytes > 0 && !allExist(VIDEO_EXTS.map(ext => join(videos, `${key}${ext}`)))) {
      warn(`fetch-published: ${show(videos)}/${key}: in the local manifest but its files are missing; the chapter page will say the video is coming`)
    }
  }
  if (changed) {
    mkdirSync(videos, { recursive: true })
    writeFileSync(manifestFile, JSON.stringify(Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n')
    log(`written ${show(manifestFile)} (${Object.keys(merged).length} entries)`)
  }
  return { status: counts.fetched ? 'fetched' : counts.present ? 'present' : 'skipped', ...counts }
}

// ---- all together ------------------------------------------------------------------------------------------------
/**
 * Fetches the installer and the videos, each reported even when the other fails. Returns true when the tree is
 * ready to deploy, false when a check or a download failed (the message is printed).
 */
export async function fetchPublished({ origin, version, setup, videos, log = console.log, warn = console.warn }) {
  const say = line => log(`fetch-published: ${line}`)
  let ok = true
  const fail = (what, e) => {
    ok = false
    // fetch's "fetch failed" carries the real reason (ECONNREFUSED, ENOTFOUND…) in its cause
    const why = e instanceof Error ? e.message + (e.cause instanceof Error ? ` (${e.cause.message})` : '') : String(e)
    console.error(`fetch-published: ${what}: ${why}${e instanceof ChecksumError ? ' (the site may be mid-deploy: try again in a minute)' : ''}`)
  }
  await fetchInstaller({ origin, version, setup, log: say, warn }).catch(e => fail('Windows installer', e))
  await fetchVideos({ origin, videos, log: say, warn }).catch(e => fail('videos', e))
  return ok
}

async function main() {
  if (process.env.SKIP_FETCH === '1') { console.log('fetch-published: SKIP_FETCH=1, nothing read from the site'); return }
  const origin = process.env.PUBLISHED_ORIGIN || ORIGIN
  const { version } = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
  const releases = resolve(process.env.FETCH_RELEASES_DIR || join(app, 'releases'))
  const setup = process.env.WINDOWS_SETUP === 'none' ? 'none' : resolve(process.env.WINDOWS_SETUP || join(releases, `Dentora-Setup-${version}.exe`))
  const videos = resolve(process.env.FETCH_VIDEOS_DIR || join(root, 'site', 'videos'))
  console.log(`fetch-published: reading ${origin} for version ${version}`)
  const ok = await fetchPublished({ origin, version, setup, videos })
  if (!ok) {
    console.error('fetch-published: the tree is not complete: not deploying (SKIP_FETCH=1 deploys what this machine has, and drops what it lacks from the site)')
    process.exitCode = 1
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(e => { console.error(`fetch-published: ${e instanceof Error ? e.message : String(e)}`); process.exitCode = 1 })
}

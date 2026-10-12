// Assembles public/ — the static files Cloudflare serves (wrangler.toml → [assets]) — from site/ (landing page
// assets and the control panel) plus the release APK of the app's current version. public/ is rebuilt from scratch
// every time and is git-ignored. Works with an incomplete site/ (or none): whatever is there is published.
//   files/dentora.apk      the APK (served only through /download/android, which counts it)
//   files/meta.json        { version, sizeBytes, sha256 } of that APK (the landing page shows version and size)
//   files/windows/setup.NNN  the Windows installer in parts of 20 MiB (one static file may not exceed 25 MiB);
//                          /download/windows streams them back to back as one file and counts the download
//   files/windows.json     { version, sizeBytes, sha256, parts: [{ path, size }] } of that installer
//   files/manifest.json    { files } every published path, so the Worker knows e.g. whether /css/site.css exists
//   _headers               security and cache headers of the static files (the Worker sets its own)
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SECURITY_HEADERS } from '../src/http.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = join(root, '..')
const site = join(root, 'site')
const out = join(root, 'public')
const MAX_ASSET = 25 * 1024 * 1024   // Workers static assets: 25 MiB per file

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// Dot files (.DS_Store, editor swap files) are never published.
if (existsSync(site)) cpSync(site, out, { recursive: true, filter: src => !basename(src).startsWith('.') })
else console.warn('build-public: site/ does not exist yet, publishing the APK only')

const { version } = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
const apk = join(app, 'releases', `Dentora-${version}.apk`)
mkdirSync(join(out, 'files'), { recursive: true })
if (existsSync(apk)) {
  const bytes = readFileSync(apk)
  if (bytes.length > MAX_ASSET) throw new Error(`${apk} is ${bytes.length} bytes, over the 25 MiB static file limit`)
  copyFileSync(apk, join(out, 'files', 'dentora.apk'))
  const meta = { version, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
  writeFileSync(join(out, 'files', 'meta.json'), JSON.stringify(meta, null, 2) + '\n')
  console.log(`build-public: APK ${version}, ${(bytes.length / 1048576).toFixed(1)} MB, sha256 ${meta.sha256.slice(0, 12)}…`)
} else {
  console.warn(`build-public: ${relative(root, apk)} not found; /download/android answers 404 until it exists`)
}

// The Windows installer is too large for git (and for one static file): it comes from WINDOWS_SETUP, or from
// ../releases/Dentora-Setup-<version>.exe, which is git-ignored. Built from the same package.json, so same version.
const PART = 20 * 1024 * 1024
const setup = process.env.WINDOWS_SETUP || join(app, 'releases', `Dentora-Setup-${version}.exe`)
if (existsSync(setup) && statSync(setup).size > 0) {
  const bytes = readFileSync(setup)
  mkdirSync(join(out, 'files', 'windows'), { recursive: true })
  const parts = []
  for (let i = 0, at = 0; at < bytes.length; i++, at += PART) {
    const path = `/files/windows/setup.${String(i).padStart(3, '0')}`
    const part = bytes.subarray(at, at + PART)
    writeFileSync(join(out, path), part)
    parts.push({ path, size: part.length })
  }
  const meta = { version, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), parts }
  writeFileSync(join(out, 'files', 'windows.json'), JSON.stringify(meta, null, 2) + '\n')
  console.log(`build-public: Windows installer ${version}, ${(bytes.length / 1048576).toFixed(1)} MB in ${parts.length} parts, sha256 ${meta.sha256.slice(0, 12)}…`)
} else {
  console.warn(`build-public: ${relative(root, setup)} not found; /download/windows goes to the settings' link or WhatsApp`)
}

const security = Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`).join('\n')
const rules = [
  `/*\n${security}`,
  // Fonts never change under the same name; images rarely; css/js are not fingerprinted, so keep them short.
  '/fonts/*\n  Cache-Control: public, max-age=31536000, immutable',
  '/img/*\n  Cache-Control: public, max-age=86400',
  '/css/*\n  Cache-Control: public, max-age=600',
  '/js/*\n  Cache-Control: public, max-age=600',
  '/admin/*\n  Cache-Control: no-cache, no-transform\n  X-Robots-Tag: noindex',
]
// A site/_headers of the landing page, if any, comes after (its rules add to these).
const own = join(site, '_headers')
writeFileSync(join(out, '_headers'), rules.join('\n\n') + '\n' + (existsSync(own) ? '\n' + readFileSync(own, 'utf8') : ''))

const files = []
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else {
      if (statSync(p).size > MAX_ASSET) throw new Error(`${relative(root, p)} is over the 25 MiB static file limit`)
      files.push('/' + relative(out, p).split(sep).join('/'))
    }
  }
}
walk(out)
const published = files.filter(f => f !== '/_headers').concat('/files/manifest.json').sort()
writeFileSync(join(out, 'files', 'manifest.json'), JSON.stringify({ files: published }) + '\n')
console.log(`build-public: ${published.length} files in public/`)

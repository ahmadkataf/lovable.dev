// Files that ship with the release builds and must stay in step with each other: the page's Content-Security-Policy
// (index.html, the Windows shell, the Android shell; its one address outside the app is the activation server), the
// installer's terms of use (build/license.txt from docs/TERMS.md), the Windows hardening switches, and the QA-only
// database handle that release builds never carry.
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { licenseFileBytes } from '../scripts/make-license-txt.mjs'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const directives = (csp: string) => csp.split(';').map(d => d.trim().replace(/\s+/g, ' ')).filter(Boolean).sort()

describe('Content-Security-Policy', () => {
  const html = read('index.html')
  const meta = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? ''
  const electron = createRequire(import.meta.url)(path.join(ROOT, 'electron/lib.cjs')).CSP as string
  const java = read('android/src/com/dentora/app/WebFiles.java')
  const android = (/static final String CSP = ([\s\S]*?);\n/.exec(java)?.[1] ?? '').split('+').map(s => s.trim().replace(/^"|"$/g, '')).join('')
  it('is the same in index.html, the Windows app and the Android app', () => {
    expect(meta).not.toBe('')
    expect(directives(meta)).toEqual(directives(electron))
    expect(directives(meta)).toEqual(directives(android))
  })
  it('allows scripts only from the app and nothing from the internet but the activation request', () => {
    const d = directives(meta)
    expect(d).toContain("script-src 'self'")
    expect(d).toContain("object-src 'none'")
    expect(d).toContain("form-action 'none'")
    expect(d).toContain("img-src 'self' data: blob:")
    expect(meta).not.toMatch(/unsafe-eval|\*/)
    expect(d.find(x => x.startsWith('script-src'))).not.toMatch(/unsafe-inline/)
    // licence keys (docs/LICENCE-KEYS.md): the one source outside the app is the activation server, and the page may
    // only send it a request (connect-src): no script, style, picture, font, frame or form from it or anywhere else
    const outside = d.flatMap(x => {
      const [name, ...sources] = x.split(' ')
      return sources.filter(s => !/^'[a-z-]+'$|^(data|blob):$/.test(s)).map(s => `${name} ${s}`)
    })
    expect(outside).toEqual(['connect-src https://dentora.raqeem.dev'])
  })
  it('names the same activation server as the app', () => {
    const online = read('src/license/online.ts')
    expect(online).toContain("ACTIVATION_ORIGIN = 'https://dentora.raqeem.dev'")
    expect(online).toContain('ACTIVATION_URL = `${ACTIVATION_ORIGIN}/api/activate`')
    expect(java).toMatch(/ACTIVATION_HOST = "dentora\.raqeem\.dev";/)
    expect(java).toMatch(/ACTIVATION_PATH = "\/api\/activate";/)
  })
  it('is left out only by the development server (React Fast Refresh needs inline scripts)', () => {
    expect(read('vite.config.ts')).toMatch(/apply: 'serve'[\s\S]*Content-Security-Policy/)
  })
})

describe('Windows installer', () => {
  const yml = read('electron-builder.yml')
  it('shows the current terms of use, Arabic first, as UTF-8 with a byte-order mark', () => {
    expect(yml).toMatch(/^\s+license: build\/license\.txt$/m)
    const file = fs.readFileSync(path.join(ROOT, 'build/license.txt'))
    // stale file: run `node scripts/make-license-txt.mjs` after changing docs/TERMS.md
    expect(file.equals(licenseFileBytes(read('docs/TERMS.md')))).toBe(true)
    expect([...file.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = file.toString('utf8')
    expect(text.indexOf('شروط الاستخدام')).toBeLessThan(text.indexOf('Terms of use\r\n'))
    expect(text).toContain('إخلاء المسؤولية الطبية')
    expect(text).toContain('Medical disclaimer')
    expect(text).not.toMatch(/<div|<!--|\]\(#/)
    expect(text.replace(/\r\n/g, '')).not.toContain('\n')     // Windows line ends only
  })
  it('flips the Electron fuses', () => {
    for (const fuse of ['runAsNode: false', 'enableNodeOptionsEnvironmentVariable: false', 'enableNodeCliInspectArguments: false', 'onlyLoadAppFromAsar: true', 'enableEmbeddedAsarIntegrityValidation: true']) {
      expect(yml).toContain(fuse)
    }
  })
})

describe('the QA database handle', () => {
  it('exists only in development and VITE_QA=1 builds', () => {
    expect(read('src/main.tsx')).toMatch(/if \(import\.meta\.env\.DEV \|\| import\.meta\.env\.VITE_QA === '1'\) \{\s*\n[^\n]*__dentora = /)
  })
  it('is never switched on by a release build', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    for (const [name, cmd] of Object.entries(pkg.scripts)) expect(cmd, name).not.toMatch(/VITE_QA/)
    expect(read('scripts/build-apk.sh')).not.toMatch(/VITE_QA/)
    expect(read('electron-builder.yml')).not.toMatch(/VITE_QA/)
    for (const wf of ['dentora-android.yml', 'dentora-windows.yml']) expect(read(`../.github/workflows/${wf}`)).not.toMatch(/VITE_QA/)
  })
})

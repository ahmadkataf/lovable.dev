// QA for the Windows app shell (Electron). Runs on Linux under a virtual display:
//   npm run build && xvfb-run -a node scripts/qa/electron.mjs
// Uses a throwaway data folder (DENTORA_USER_DATA), so it never touches a real clinic's data.
// Checks: window + title, the preload bridge (platform, deviceId, appVersion, saveFile, openFile, openExternal),
// isolation (no Node in the page, CSP, untrusted windows get no IPC), navigation guards, zoom keys,
// window-state.json, and that IndexedDB data, the device id and the window size survive a restart.
// Screenshots: qa-shots/electron/window.png (first run) and shell.png (signed in).
import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SHOTS = path.join(ROOT, process.env.QA_SHOTS || 'qa-shots/electron')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const electronPath = createRequire(import.meta.url)('electron')
// QA_APP=release/win-unpacked/resources/app.asar runs the packaged archive instead of the source folder
const APP_PATH = process.env.QA_APP ? path.resolve(ROOT, process.env.QA_APP) : '.'
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-electron-'))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-electron-files-'))
fs.mkdirSync(SHOTS, { recursive: true })

if (!fs.existsSync(path.join(ROOT, 'dist/index.html'))) { console.error('dist/index.html missing: run npm run build first'); process.exit(1) }

let failures = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}

async function launch() {
  const app = await electron.launch({
    executablePath: electronPath,
    args: [APP_PATH],
    cwd: ROOT,
    env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', DENTORA_USER_DATA: userData, DENTORA_DEV: '' },
    timeout: 60_000,
  })
  const page = await app.firstWindow()
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message))
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()) })
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => window.__dentora?.db, null, { timeout: 30_000 })
  // the window is shown on ready-to-show
  for (let i = 0; i < 50 && !(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())); i++) await page.waitForTimeout(100)
  return { app, page }
}

const winInfo = app => app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().startsWith('file:')) || BrowserWindow.getAllWindows()[0]
  const p = w.webContents.getLastWebPreferences() || {}
  return {
    title: w.getTitle(), visible: w.isVisible(), min: w.getMinimumSize(), bounds: w.getNormalBounds(), maximized: w.isMaximized(),
    bg: w.getBackgroundColor(), menuAutoHide: w.isMenuBarAutoHide(), zoom: w.webContents.getZoomFactor(), url: w.webContents.getURL(),
    prefs: { contextIsolation: p.contextIsolation, sandbox: p.sandbox, nodeIntegration: p.nodeIntegration },
    windows: BrowserWindow.getAllWindows().length,
  }
})

// ---------------------------------------------------------------------------------------------------------------
console.log(`electron ${pkg.devDependencies.electron} · app ${APP_PATH} · data ${userData}`)
let { app, page } = await launch()

// window
let info = await winInfo(app)
check('window is visible', info.visible)
check('document title mentions Dentora', /Dentora/.test(await page.title()), await page.title())
check('window title mentions Dentora', /Dentora/.test(info.title), info.title)
check('minimum size 1024×680', info.min[0] === 1024 && info.min[1] === 680, info.min.join('×'))
check('menu bar auto-hides', info.menuAutoHide)
check('background #F5F7FA', /^#?F5F7FA/i.test(info.bg.replace(/^#FF/i, '#')), info.bg)
check('loaded from dist/index.html (file://)', info.url.startsWith('file://') && info.url.includes('/dist/index.html') && (!process.env.QA_APP || info.url.includes('.asar/')), info.url)
const icon = await app.evaluate(({ app: a, nativeImage }) => {
  const dir = a.getAppPath()
  return { png: nativeImage.createFromPath(`${dir}/build/icon.png`).getSize(), ico: process.platform !== 'win32' ? 'decoded on Windows only' : nativeImage.createFromPath(`${dir}/build/icon.ico`).isEmpty() ? 'missing' : 'ok' }
}).catch(e => ({ error: e.message }))
check('app icon readable from the app folder/asar', icon?.png?.width === 512 && icon?.ico !== 'missing', JSON.stringify(icon))
check('webPreferences: contextIsolation + sandbox, no nodeIntegration', info.prefs.contextIsolation === true && info.prefs.sandbox === true && !info.prefs.nodeIntegration, JSON.stringify(info.prefs))
const menu = await app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items.map(i => ({ label: i.label, sub: i.submenu?.items.filter(s => s.type !== 'separator').map(s => s.label) })))
check('minimal menu (zoom ×3, full screen, reload; no devtools)', menu?.length === 1 && menu[0].sub.length === 5, JSON.stringify(menu))

// bridge
const bridge = await page.evaluate(async () => {
  const d = window.dentora
  if (!d) return null
  return {
    keys: Object.keys(d).sort(), platform: d.platform,
    id1: await d.deviceId(), id2: await d.deviceId(), version: await d.appVersion(),
    promises: ['deviceId', 'appVersion'].every(k => d[k]() instanceof Promise),
  }
})
check('window.dentora exists', !!bridge)
check('platform === "electron"', bridge?.platform === 'electron')
check('bridge has exactly the typed members', JSON.stringify(bridge?.keys) === JSON.stringify(['appVersion', 'deviceId', 'openExternal', 'openFile', 'platform', 'print', 'saveFile']), bridge?.keys.join(','))
check('methods return Promises', bridge?.promises)
check('deviceId is a non-empty string', typeof bridge?.id1 === 'string' && bridge.id1.length >= 16, bridge?.id1)
check('deviceId is stable across calls', bridge?.id1 === bridge?.id2)
check(`appVersion matches package.json (${pkg.version})`, bridge?.version === pkg.version, bridge?.version)

// isolation + CSP
const iso = await page.evaluate(async () => {
  // (eval cannot be tested from here: DevTools evaluation is exempt from CSP. An inline <script> is not.)
  const violations = []
  const onViolation = e => violations.push(e.violatedDirective)
  document.addEventListener('securitypolicyviolation', onViolation)
  const s = document.createElement('script'); s.textContent = 'window.__inlineRan = true'; document.head.appendChild(s); s.remove()
  const img = new Image(); img.src = 'https://example.com/pixel.png'
  await new Promise(r => setTimeout(r, 300))
  document.removeEventListener('securitypolicyviolation', onViolation)
  return { require: typeof window.require, process: typeof window.process, module: typeof window.module, inlineBlocked: !window.__inlineRan, violations }
})
check('no Node globals in the page', iso.require === 'undefined' && iso.process === 'undefined' && iso.module === 'undefined', JSON.stringify(iso))
console.log('      (the two CSP console errors above are this test\'s own probes)')
check('CSP is enforced (inline script and remote image blocked)', iso.inlineBlocked && iso.violations.some(v => v.startsWith('script-src')) && iso.violations.some(v => v.startsWith('img-src')), iso.violations.join(','))

// external links: record instead of launching a browser
await app.evaluate(({ shell }) => {
  globalThis.__opened = []
  try { shell.openExternal = async u => { globalThis.__opened.push(u) } } catch { globalThis.__opened = null }
})
const stubbed = await app.evaluate(() => Array.isArray(globalThis.__opened))
if (stubbed) {
  await page.evaluate(async () => {
    await window.dentora.openExternal('https://wa.me/963944123456')
    await window.dentora.openExternal('tel:+963944123456')
    await window.dentora.openExternal('file:///etc/passwd')
    await window.dentora.openExternal('javascript:alert(1)')
    window.__w = window.open('https://example.com/from-window-open', '_blank')
    const a = document.createElement('a'); a.href = 'https://example.com/from-link'; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove()
  })
  await page.waitForTimeout(500)
  const opened = await app.evaluate(() => globalThis.__opened)
  check('openExternal passes http(s)/tel', opened.includes('https://wa.me/963944123456') && opened.includes('tel:+963944123456'), opened.join(' | '))
  check('openExternal refuses file:/javascript:', !opened.some(u => u.startsWith('file:') || u.startsWith('javascript:')))
  check('target=_blank / window.open go to the system browser', opened.includes('https://example.com/from-window-open') && opened.includes('https://example.com/from-link'))
  check('window.open of a web URL creates no window', (await page.evaluate(() => window.__w)) === null && (await winInfo(app)).windows === 1)
  // in-page navigation to the web is blocked
  const before = page.url()
  await page.evaluate(() => { location.href = 'https://example.com/navigate-away' })
  await page.waitForTimeout(500)
  check('navigation away from the app is blocked', page.url().split('#')[0] === before.split('#')[0], page.url())
  check('…and opened externally instead', (await app.evaluate(() => globalThis.__opened)).includes('https://example.com/navigate-away'))
} else check('shell.openExternal can be stubbed for the test', false)

// save-file: stub the dialog, write a file, then cancel
const saveTarget = path.join(tmp, 'backup.json')
await app.evaluate(({ dialog }, target) => {
  globalThis.__saveOpts = null
  dialog.showSaveDialog = async (_w, opts) => { globalThis.__saveOpts = opts; return globalThis.__cancel ? { canceled: true } : { canceled: false, filePath: target } }
}, saveTarget)
const saved = await page.evaluate(async () => window.dentora.saveFile('نسخة احتياطية/dentora:backup.json', 'application/json', btoa(JSON.stringify({ app: 'dentora', ok: 1 }))))
const saveOpts = await app.evaluate(() => globalThis.__saveOpts)
check('saveFile resolves true and writes the bytes', saved === true && fs.existsSync(saveTarget) && JSON.parse(fs.readFileSync(saveTarget, 'utf8')).ok === 1)
check('save dialog: safe default name in Downloads/last folder, filter from extension', /dentora-backup\.json$/.test(saveOpts?.defaultPath || '') && saveOpts?.filters?.[0]?.extensions?.[0] === 'json', `${saveOpts?.defaultPath} ${JSON.stringify(saveOpts?.filters)}`)
check('save dialog speaks Arabic by default', saveOpts?.title === 'حفظ الملف', saveOpts?.title)
await app.evaluate(() => { globalThis.__cancel = true })
check('saveFile resolves false when cancelled', (await page.evaluate(() => window.dentora.saveFile('x.pdf', 'application/pdf', 'AA=='))) === false)

// open-file: stub the dialog, read a PNG back
const pickPath = path.join(tmp, 'xray.png')
fs.copyFileSync(path.join(ROOT, 'build/icon-64.png'), pickPath)
await app.evaluate(({ dialog }, target) => {
  globalThis.__openOpts = null
  dialog.showOpenDialog = async (_w, opts) => { globalThis.__openOpts = opts; return { canceled: false, filePaths: [target] } }
}, pickPath)
const picked = await page.evaluate(async () => { const r = await window.dentora.openFile('image/*,.pdf'); return r && { name: r.name, mime: r.mime, size: atob(r.base64).length } })
const openOpts = await app.evaluate(() => globalThis.__openOpts)
check('openFile returns name, mime and base64', picked?.name === 'xray.png' && picked?.mime === 'image/png' && picked?.size === fs.statSync(pickPath).size, JSON.stringify(picked))
const exts = openOpts?.filters?.[0]?.extensions || []
check('open dialog filters from accept (image/*,.pdf)', ['png', 'jpg', 'jpeg', 'pdf'].every(e => exts.includes(e)), exts.join(','))
await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }) })
check('openFile resolves null when cancelled', (await page.evaluate(() => window.dentora.openFile('*/*'))) === null)

// a blob: viewer window may open, but it gets no access to the bridge
const viewerResult = await (async () => {
  const [viewer] = await Promise.all([
    app.waitForEvent('window', { timeout: 10_000 }),
    page.evaluate(() => { window.__v = window.open(URL.createObjectURL(new Blob(['<p>viewer</p>'], { type: 'text/html' })), '_blank') }),
  ])
  await viewer.waitForLoadState('domcontentloaded')
  const r = await viewer.evaluate(async () => {
    if (!window.dentora) return 'no-bridge'
    try { await window.dentora.deviceId(); return 'answered' } catch { return 'rejected' }
  })
  await viewer.close()
  return r
})().catch(e => `error: ${e.message}`)
check('viewer windows get no IPC answers', viewerResult === 'no-bridge' || viewerResult === 'rejected', viewerResult)

// zoom keys (physical key codes, layout-independent). Sent as native input events: Playwright's CDP key events
// bypass before-input-event, real keyboards and sendInputEvent do not.
const key = (keyCode, modifiers = ['control']) => app.evaluate(({ BrowserWindow }, { keyCode, modifiers }) => {
  const wc = BrowserWindow.getAllWindows()[0].webContents
  wc.sendInputEvent({ type: 'keyDown', keyCode, modifiers }); wc.sendInputEvent({ type: 'keyUp', keyCode, modifiers })
}, { keyCode, modifiers })
await key('=')
await page.waitForTimeout(300)
const zIn = (await winInfo(app)).zoom
await key('0')
await page.waitForTimeout(300)
const zReset = (await winInfo(app)).zoom
check('Ctrl+= zooms in, Ctrl+0 resets', zIn > 1.01 && Math.abs(zReset - 1) < 0.01, `${zIn} → ${zReset}`)

// first-run screen
await page.evaluate(() => { location.hash = '#/setup' })
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(SHOTS, 'window.png') })
console.log('shot', path.relative(ROOT, path.join(SHOTS, 'window.png')))
const setupText = (await page.textContent('body')) || ''
check('first run shows the setup route, right-to-left', setupText.trim().length > 0 && page.url().endsWith('#/setup') && (await page.evaluate(() => document.documentElement.dir)) === 'rtl', page.url())

// seed a clinic + admin and sign in (same data as scripts/qa/lib.mjs seedAndLogin), plus one patient
await page.evaluate(async () => {
  const db = window.__dentora.db
  const now = new Date().toISOString()
  const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('')
  const salt = 'qa-salt'
  const existing = await db.clinic.get('clinic')
  await db.clinic.put({ ...(existing || {}), id: 'clinic', name: 'عيادة الابتسامة لطب الأسنان', nameEn: 'Smile Dental Clinic', phone: '0944 123 456', currency: 'USD', currencySymbol: '$', currencyDecimals: 0, lang: 'ar', theme: 'light',
    workingDays: [0, 1, 2, 3, 4, 6], workStart: '09:00', workEnd: '18:00', slotMinutes: 30, defaultAppointmentMinutes: 30, taxPercent: 0, invoicePrefix: 'INV-', nextInvoiceNumber: 1, nextFileNumber: 2, setupDone: true, createdAt: now, updatedAt: now })
  await db.users.put({ id: 'u-admin', name: 'د. أحمد الخطيب', role: 'admin', pinHash: await sha(`${salt}:1234`), pinSalt: salt, color: '#0E8F86', active: true, createdAt: now, updatedAt: now })
  await db.patients.put({ id: 'qa-electron-patient', fileNo: 1, name: 'مريض اختبار الحفظ', gender: 'male', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: now, updatedAt: now })
  localStorage.setItem('dentora.session', 'u-admin')
  localStorage.setItem('dentora.lang', 'ar')
})
await page.evaluate(() => { location.hash = '#/' })
await page.reload()
await page.waitForFunction(() => window.__dentora?.db)
await page.waitForTimeout(1500)
await page.screenshot({ path: path.join(SHOTS, 'shell.png') })
console.log('shot', path.relative(ROOT, path.join(SHOTS, 'shell.png')))
check('signed-in shell renders after reload', (await page.locator('.app-sidebar, .app').count()) > 0)

// resize, then quit: state must be written
// a size that fits the screen (CI runners can be 1024×768) but differs from the first-run default
const target = await app.evaluate(({ BrowserWindow, screen }) => {
  const w = BrowserWindow.getAllWindows()[0]; const wa = screen.getPrimaryDisplay().workArea; const [minW, minH] = w.getMinimumSize()
  const t = { x: wa.x + 20, y: wa.y + 10, width: Math.max(minW, Math.min(1200, wa.width - 40)), height: Math.max(minH, Math.min(720, wa.height - 20)) }
  w.unmaximize(); w.setBounds(t); return t
})
await page.waitForTimeout(800)
const id1 = bridge?.id1
await app.close()
const stateFile = path.join(userData, 'window-state.json')
const saved1 = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null
check('window-state.json written on quit', !!saved1 && saved1.width === target.width && saved1.height === target.height && saved1.maximized === false, JSON.stringify(saved1))

// restart: same data folder → same device id, same bounds, data still there
;({ app, page } = await launch())
info = await winInfo(app)
const after = await page.evaluate(async () => ({ id: await window.dentora.deviceId(), patient: await window.__dentora.db.patients.get('qa-electron-patient') }))
check('deviceId is stable across restarts', after.id === id1)
check('window bounds restored after restart', info.bounds.width === target.width && info.bounds.height === target.height && !info.maximized, `${JSON.stringify(info.bounds)} want ${target.width}×${target.height}`)
check('IndexedDB data survives a restart', after.patient?.name === 'مريض اختبار الحفظ')
await app.close()

// leave the throwaway folders behind only when something failed (for inspection)
if (!failures) { fs.rmSync(userData, { recursive: true, force: true }); fs.rmSync(tmp, { recursive: true, force: true }) }
console.log(failures ? `\n${failures} check(s) FAILED (data folder kept: ${userData})` : '\nall electron checks passed')
process.exit(failures ? 1 : 0)

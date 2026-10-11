// QA for the Windows app shell (Electron). Runs on Linux under a virtual display:
//   npm run build && xvfb-run -a node scripts/qa/electron.mjs
//   npx vite build --outDir /tmp/dist-x && QA_DIST=/tmp/dist-x QA_SHOTS=qa-shots/electron-x xvfb-run -a node scripts/qa/electron.mjs
//   QA_APP=release/win-unpacked/resources/app.asar xvfb-run -a node scripts/qa/electron.mjs      (the packaged archive)
// QA_DIST stages electron/, the icons, package.json and that build in a temporary app folder, so a parallel
// `npm run build` cannot swap dist/ under a running check. A throwaway data folder (DENTORA_USER_DATA) keeps real
// clinic data out of it.
// Checks: window + title, the preload bridge (platform, deviceId, appVersion, saveFile, openFile, openExternal, print),
// isolation (no Node in the page, CSP, untrusted windows get no IPC), navigation guards, zoom keys, Ctrl+P,
// PDFs in an iframe, the clipboard, English menu/dialogs, every route with no CSP violation or page error,
// the single-instance lock, window-state.json, and that IndexedDB data, the device id and the window size survive
// a restart. Screenshots (QA_SHOTS, default qa-shots/electron): window.png (first run), shell.png (signed in),
// shell-en.png (English), pdf.png (a PDF inside the app).
import { _electron as electron } from 'playwright'
import { execFileSync, spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SHOTS = path.join(ROOT, process.env.QA_SHOTS || 'qa-shots/electron')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const electronPath = createRequire(import.meta.url)('electron')
const DIST = process.env.QA_DIST ? path.resolve(ROOT, process.env.QA_DIST) : path.join(ROOT, 'dist')
if (!process.env.QA_APP && !fs.existsSync(path.join(DIST, 'index.html'))) { console.error(`${path.join(DIST, 'index.html')} missing: build first`); process.exit(1) }
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-electron-'))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-electron-files-'))
fs.mkdirSync(SHOTS, { recursive: true })

/** A private copy of the app folder around the QA_DIST build (the main process loads <app>/dist/index.html). */
function stageApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-electron-app-'))
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(dir, 'package.json'))
  fs.cpSync(path.join(ROOT, 'electron'), path.join(dir, 'electron'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'build'))
  for (const f of ['icon.png', 'icon.ico']) fs.copyFileSync(path.join(ROOT, 'build', f), path.join(dir, 'build', f))
  fs.cpSync(DIST, path.join(dir, 'dist'), { recursive: true })
  return dir
}
// QA_APP: the packaged archive · QA_DIST: a staged copy · default: the source folder (dist/ from npm run build)
const STAGED = !process.env.QA_APP && process.env.QA_DIST ? stageApp() : null
const APP_PATH = process.env.QA_APP ? path.resolve(ROOT, process.env.QA_APP) : STAGED || '.'
const ENV = { ...process.env, ELECTRON_DISABLE_SANDBOX: '1', DENTORA_USER_DATA: userData, DENTORA_DEV: '' }
const pageErrors = []

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
    env: ENV,
    timeout: 60_000,
  })
  const page = await app.firstWindow()
  page.on('pageerror', e => { pageErrors.push(e.message); console.error('PAGE ERROR:', e.message) })
  page.on('console', m => { if (m.type() === 'error') { console.error('CONSOLE:', m.text()); if (!/example\.com|inline script/i.test(m.text())) pageErrors.push(m.text()) } })
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
console.log(`electron ${pkg.devDependencies.electron} · app ${APP_PATH}${STAGED ? ` (staged from ${DIST})` : ''} · data ${userData}`)
let { app, page } = await launch()

// window
let info = await winInfo(app)
check('window is visible', info.visible)
check('document title mentions Dentora', /Dentora/.test(await page.title()), await page.title())
check('window title is "Dentora" (not the web <title>)', info.title === 'Dentora', info.title)
check('minimum size 1024×680', info.min[0] === 1024 && info.min[1] === 680, info.min.join('×'))
check('menu bar auto-hides', info.menuAutoHide)
check('background #F5F7FA', /^#?F5F7FA/i.test(info.bg.replace(/^#FF/i, '#')), info.bg)
check('loaded from dist/index.html (file://)', info.url.startsWith('file://') && info.url.includes('/dist/index.html') && (!process.env.QA_APP || info.url.includes('.asar/')) && (!STAGED || info.url.includes(path.basename(STAGED))), info.url)
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
if (process.platform === 'win32') {
  // the real Windows path: SHA-256 of the MachineGuid that reg.exe reports (not the stored random fallback)
  let guid = ''
  try { guid = /MachineGuid\s+REG_SZ\s+([0-9A-Fa-f-]{16,})/.exec(execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'], { encoding: 'utf8' }))?.[1]?.toLowerCase() || '' } catch { /* reported below */ }
  check('Windows: device id is derived from MachineGuid', !!guid && bridge?.id1 === crypto.createHash('sha256').update(`dentora|win:${guid}`).digest('hex'), guid ? 'guid read' : 'reg query failed')
} else {
  check('device id comes from this machine, not the random fallback', !fs.existsSync(path.join(userData, 'device-id')))
}

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

// print: the system dialog cannot be driven here, so webContents.print is replaced by a recorder. The page must get
// 'afterprint' even when printing fails before it starts (pages hide the app while a sheet prints).
await app.evaluate(({ BrowserWindow }) => {
  const wc = BrowserWindow.getAllWindows()[0].webContents
  globalThis.__prints = []
  wc.print = (opts, cb) => { globalThis.__prints.push(opts); setTimeout(() => cb(false, 'no printer'), 30) }
})
const printed = await page.evaluate(async () => {
  let after = 0; const on = () => { after++ }
  window.addEventListener('afterprint', on)
  const r = await window.dentora.print()
  await new Promise(res => setTimeout(res, 50))
  window.removeEventListener('afterprint', on)
  return { r: r === undefined ? 'undefined' : String(r), after }
})
const printOpts = await app.evaluate(() => globalThis.__prints)
check('print() asks for the system dialog with backgrounds', printOpts.length === 1 && printOpts[0].silent === false && printOpts[0].printBackground === true, JSON.stringify(printOpts))
check('print() resolves and the page always gets afterprint', printed.r === 'undefined' && printed.after === 1, JSON.stringify(printed))
await key('P')
await page.waitForTimeout(400)
check('Ctrl+P prints the current screen', (await app.evaluate(() => globalThis.__prints.length)) === 2)

// a PDF in an iframe (the patient files viewer) renders under the CSP: blob: frames, the built-in viewer
const pdfProbe = await page.evaluate(async () => {
  const v = []; const onV = e => v.push(`${e.violatedDirective} ${e.blockedURI}`)
  document.addEventListener('securitypolicyviolation', onV)
  const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'
  const f = document.createElement('iframe')
  f.src = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
  f.style.cssText = 'position:fixed;top:60px;left:60px;width:640px;height:420px;z-index:9999;border:0'
  document.body.appendChild(f)
  await new Promise(r => setTimeout(r, 2500))
  document.removeEventListener('securitypolicyviolation', onV)
  return { viewer: navigator.pdfViewerEnabled, v }
})
// the viewer's toolbar is dark grey; a blocked or missing viewer leaves the frame white/light grey
const pdfToolbar = await app.evaluate(async ({ BrowserWindow }) => {
  const img = await BrowserWindow.getAllWindows()[0].webContents.capturePage({ x: 80, y: 66, width: 400, height: 28 })
  const b = img.toBitmap(); let sum = 0
  for (let i = 0; i < b.length; i += 4) sum += (b[i] + b[i + 1] + b[i + 2]) / 3
  return Math.round(sum / Math.max(1, b.length / 4))
})
await page.screenshot({ path: path.join(SHOTS, 'pdf.png') })
await page.evaluate(() => document.querySelectorAll('iframe').forEach(f => f.remove()))
check('PDF in an iframe opens in the built-in viewer, no CSP violation', pdfProbe.viewer === true && pdfProbe.v.length === 0 && pdfToolbar < 110, JSON.stringify({ ...pdfProbe, toolbarBrightness: pdfToolbar }))

// clipboard (copy the device number / an activation code)
const clip = await page.evaluate(async () => { try { await navigator.clipboard.writeText('7KQ2-M9XD'); return 'ok' } catch (e) { return String(e) } })
check('navigator.clipboard.writeText works', clip === 'ok' && (await app.evaluate(({ clipboard }) => clipboard.readText())) === '7KQ2-M9XD', clip)

// first-run screen
await page.evaluate(() => { location.hash = '#/setup' })
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(SHOTS, 'window.png') })
console.log('shot', path.relative(ROOT, path.join(SHOTS, 'window.png')))
const setupText = (await page.textContent('body')) || ''
check('first run shows the setup route, right-to-left', setupText.trim().length > 0 && page.url().endsWith('#/setup') && (await page.evaluate(() => document.documentElement.dir)) === 'rtl', page.url())

// seed a clinic + admin and sign in (same data as scripts/qa/lib.mjs seedAndLogin), plus one patient.
// Wait for the app's own first-run clinic record first, or it can land after the seed and undo setupDone.
await page.waitForFunction(async () => !!(await window.__dentora.db.clinic.get('clinic')), null, { timeout: 15_000 })
await page.waitForTimeout(300)
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
check('signed-in shell renders after reload', (await page.locator('.app-sidebar').count()) > 0 && page.url().endsWith('#/'), page.url())

// English: the menu, the dialogs and the page follow the clinic's language
await page.evaluate(async () => { await window.__dentora.db.clinic.update('clinic', { lang: 'en' }); localStorage.setItem('dentora.lang', 'en') })
await page.reload()
await page.waitForFunction(() => window.__dentora?.db && document.documentElement.lang === 'en' && document.querySelector('.app-sidebar'))
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(SHOTS, 'shell-en.png') })
console.log('shot', path.relative(ROOT, path.join(SHOTS, 'shell-en.png')))
const menuEn = await app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items.map(i => i.label))
await app.evaluate(() => { globalThis.__cancel = true })
await page.evaluate(() => window.dentora.saveFile('report.csv', 'text/csv', 'AA=='))
const saveEn = await app.evaluate(() => globalThis.__saveOpts)
check('English: menu and save dialog in English, page left-to-right', menuEn?.[0] === 'View' && saveEn?.title === 'Save file' && saveEn?.filters?.[0]?.name === 'CSV file' && (await page.evaluate(() => document.documentElement.dir)) === 'ltr', `${menuEn} / ${saveEn?.title}`)
const enOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check('English shell: no horizontal overflow', enOverflow <= 0, String(enOverflow))

// every screen loads inside Electron with no CSP violation, page error or console error
const routes = ['/', '/appointments', '/patients', '/patients/qa-electron-patient', '/treatments', '/prescriptions', '/lab', '/invoices', '/payments', '/expenses', '/reports', '/inventory', '/procedures', '/staff', '/settings']
await page.evaluate(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`)) })
const errorsBefore = pageErrors.length
const notShell = []
for (const r of routes) {
  await page.evaluate(h => { location.hash = '#' + h }, r)
  await page.waitForTimeout(600)
  if (!(await page.evaluate(h => location.hash === '#' + h && !!document.querySelector('.app-sidebar'), r))) notShell.push(r)
}
const csp = await page.evaluate(() => window.__csp)
check(`all ${routes.length} routes render in the shell`, notShell.length === 0, notShell.join(' '))
check('no CSP violation on any route', csp.length === 0, csp.join(' | '))
check('no page or console errors on any route', pageErrors.length === errorsBefore, pageErrors.slice(errorsBefore).join(' | '))
check('window title stays "Dentora" while navigating', (await winInfo(app)).title === 'Dentora', (await winInfo(app)).title)

// single instance: a second launch exits, the running window stays (and is focused), its state file is untouched
const stateFileLive = path.join(userData, 'window-state.json')
const stateBefore = fs.existsSync(stateFileLive) ? fs.readFileSync(stateFileLive, 'utf8') : null
const second = spawn(electronPath, [APP_PATH], { cwd: ROOT, env: ENV, stdio: 'ignore' })
const secondExit = await new Promise(res => { const t = setTimeout(() => { second.kill(); res('still running after 20 s') }, 20_000); second.on('exit', c => { clearTimeout(t); res(c) }) })
await page.waitForTimeout(300)
const afterSecond = await winInfo(app)
check('a second launch exits and leaves one window', secondExit === 0 && afterSecond.windows === 1 && afterSecond.visible, `exit ${secondExit}, windows ${afterSecond.windows}`)
check('…without touching window-state.json', (fs.existsSync(stateFileLive) ? fs.readFileSync(stateFileLive, 'utf8') : null) === stateBefore)

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
if (!failures) for (const d of [userData, tmp, STAGED]) if (d) fs.rmSync(d, { recursive: true, force: true })
console.log(failures ? `\n${failures} check(s) FAILED (data folder kept: ${userData})` : '\nall electron checks passed')
process.exit(failures ? 1 : 0)

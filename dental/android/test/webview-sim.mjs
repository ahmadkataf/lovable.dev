// Runs the BUILT APK's web app the way the Android shell serves it, without a phone or an emulator:
//  - unpacks assets/ from android/build/Dentora.apk,
//  - answers every https://dentora.app/… request with the decisions of WebFiles.java (via ServeTable.java),
//  - installs a stand-in window.DentoraAndroid that records the bridge calls,
//  - and drives the app on a phone-sized Chromium: start, sign-in, IndexedDB persistence, fonts, hash routes,
//    the back key (BACK_JS), print (the window.print shim), saving a CSV through saveFile, WhatsApp links.
//   cd dental && node android/test/webview-sim.mjs            (APK=…, QA_SHOTS=qa-shots/android)
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const APK = path.resolve(ROOT, process.env.APK || 'android/build/Dentora.apk')
const SHOTS = path.resolve(ROOT, process.env.QA_SHOTS || 'qa-shots/android')
const ANDROID_ID = 'a1b2c3d4e5f60789'
const failures = []
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ' — ' + detail : ''}`); if (!ok) failures.push(what) }

// ---- the APK's files and the shell's serving rules -------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-apk-'))
execFileSync('unzip', ['-q', APK, 'assets/*', '-d', tmp])
const cls = path.join(tmp, 'classes')
execFileSync('javac', ['-nowarn', '-encoding', 'UTF-8', '-d', cls, 'android/src/com/dentora/app/WebFiles.java', 'android/test/ServeTable.java'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] })
const serveTable = (...paths) => JSON.parse(execFileSync('java', ['-cp', cls, 'com.dentora.app.ServeTable', path.join(tmp, 'assets'), ...paths], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
const table = serveTable()
const decide = p => table.routes[p] ?? (table.routes[p] = serveTable(p).routes[p])
const served = [], notFound = [], outside = [], consoleErrors = []

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar-SY',
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 Dentora/1.0.0',
})
await ctx.route('**/*', route => {
  const u = new URL(route.request().url())
  if (u.protocol === 'https:' && u.hostname === 'dentora.app') {
    const d = decide(u.pathname)
    if (d.status !== 200) { notFound.push(u.pathname); return route.fulfill({ status: 404, contentType: 'text/plain', body: '' }) }
    served.push(`${u.pathname} ${d.mime}`)
    return route.fulfill({
      status: 200, body: fs.readFileSync(path.join(tmp, 'assets', d.asset)),
      headers: { 'content-type': d.mime + (d.charset ? `; charset=${d.charset}` : ''), 'cache-control': d.cache, 'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff' },
    })
  }
  outside.push(u.href)
  return route.abort()
})
await ctx.addInitScript(id => {
  const calls = []
  window.__bridge = calls
  window.DentoraAndroid = {
    deviceId() { calls.push(['deviceId']); return id },
    saveFile(name, mime, b64) { calls.push(['saveFile', name, mime]); window.__lastSave = { name, mime, b64 }; return true },
    print() { calls.push(['print']) },
    appVersion() { calls.push(['appVersion']); return '1.0.0' },
    openExternal(url) { calls.push(['openExternal', url]) },
  }
}, ANDROID_ID)
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message))
const calls = () => page.evaluate(() => window.__bridge.slice())
const back = () => page.evaluate(js => eval(js), table.js.back)
const onPageFinished = () => page.evaluate(js => eval(js), table.js.printShim)   // what AppClient.onPageFinished runs
const shot = async name => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); console.log('     shot', path.relative(ROOT, path.join(SHOTS, `${name}.png`))) }
const settle = async () => { await page.waitForLoadState('networkidle'); await page.waitForTimeout(500) }

try {
  // ---- first start: the setup screen, from the asset server ----
  await page.goto(table.js.startUrl)
  await page.waitForFunction(() => window.__dentora?.db, null, { timeout: 20000 })
  await onPageFinished()
  await settle()
  check(page.url().endsWith('#/setup'), 'first start routes to #/setup', page.url())
  const env = await page.evaluate(() => ({ secure: window.isSecureContext, subtle: !!crypto.subtle, idb: !!window.indexedDB, origin: location.origin }))
  check(env.secure && env.subtle && env.idb && env.origin === 'https://dentora.app', 'secure origin with IndexedDB and crypto.subtle', JSON.stringify(env))
  await shot('01-setup')

  // ---- seed a clinic and sign in (as scripts/qa/lib.mjs seedAndLogin does) ----
  await page.evaluate(async () => {
    const db = window.__dentora.db
    const now = new Date().toISOString()
    const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('')
    await db.clinic.put({ id: 'clinic', name: 'عيادة الابتسامة لطب الأسنان', nameEn: 'Smile Dental Clinic', phone: '0944 123 456', currency: 'USD', currencySymbol: '$', currencyDecimals: 0, lang: 'ar', theme: 'light',
      workingDays: [0, 1, 2, 3, 4, 6], workStart: '09:00', workEnd: '18:00', slotMinutes: 30, defaultAppointmentMinutes: 30, taxPercent: 0, invoicePrefix: 'INV-', nextInvoiceNumber: 1, nextFileNumber: 2, setupDone: true, createdAt: now, updatedAt: now })
    await db.users.put({ id: 'u-admin', name: 'د. أحمد الخطيب', role: 'admin', pinHash: await sha('qa-salt:1234'), pinSalt: 'qa-salt', color: '#0E8F86', active: true, createdAt: now, updatedAt: now })
    await db.patients.put({ id: 'p-1', fileNo: 1, name: 'محمد العلي', gender: 'male', phone: '0944 555 111', allergies: ['البنسلين'], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: now, updatedAt: now })
    const today = now.slice(0, 10)
    await db.expenses.put({ id: 'e-1', category: 'rent', amount: 400, date: today, description: 'إيجار العيادة', method: 'cash', by: 'u-admin', createdAt: now })
    localStorage.setItem('dentora.session', 'u-admin')
  })
  await page.goto(table.js.startUrl + '#/')
  await page.reload()
  await onPageFinished()
  await settle()
  check(/#\/$/.test(page.url()) && await page.locator('.app').count() > 0, 'signed-in start opens the dashboard', page.url())
  await page.evaluate(() => document.fonts.ready)
  const fonts = await page.evaluate(() => ({
    loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '')),
    body: getComputedStyle(document.body).fontFamily,
    kufi: document.fonts.check('600 16px "Noto Kufi Arabic"', 'عيادة'),
  }))
  check(fonts.loaded.some(f => /Kufi/i.test(f)) && fonts.loaded.some(f => /Inter/i.test(f)), 'bundled fonts load from the APK (Inter + Noto Kufi Arabic)', [...new Set(fonts.loaded)].join(', '))
  await shot('02-dashboard')

  // ---- the device number comes from ANDROID_ID through the bridge ----
  const c1 = await calls()
  check(c1.some(c => c[0] === 'deviceId'), 'license asks DentoraAndroid.deviceId() (ANDROID_ID)')

  // ---- hash routes survive a reload; IndexedDB persists ----
  await page.goto(table.js.startUrl + '#/patients')
  await settle()
  await page.reload()
  await onPageFinished()
  await settle()
  check(page.url().endsWith('#/patients'), 'reload keeps the hash route', page.url())
  const persisted = await page.evaluate(async () => (await window.__dentora.db.patients.get('p-1'))?.name)
  check(persisted === 'محمد العلي', 'IndexedDB data persists across reloads')
  check(await page.getByText('محمد العلي').first().isVisible().catch(() => false), 'patients list shows the stored patient')
  await shot('03-patients')
  check(await back() === 'page', 'back on an inner page goes back a page (BACK_JS → page)')

  // ---- WhatsApp / phone links go to the system, the page stays ----
  await page.goto(table.js.startUrl + '#/patients/p-1')
  await settle()
  await shot('04-patient')
  const wa = page.locator('a.pt-icon-link.wa').first()
  if (await wa.count()) {
    const before = page.url()
    await wa.click()
    await page.waitForTimeout(300)
    const ext = (await calls()).filter(c => c[0] === 'openExternal').map(c => c[1])
    check(ext.some(u => u.startsWith('https://wa.me/963944555111')) && page.url() === before, 'WhatsApp link → DentoraAndroid.openExternal, page stays', ext.join(' '))
  } else check(false, 'patient page has a WhatsApp link')

  // ---- back key closes an open dialog first, and leaves the app from the start page ----
  await page.goto(table.js.startUrl + '#/')
  await settle()
  check(await back() === 'home', 'back on the dashboard leaves the app (BACK_JS → home)')
  await page.locator('.app-bottomnav button').last().click()            // "More": a Modal of the shell
  const opened = await page.waitForSelector('[aria-modal="true"]', { timeout: 8000 }).then(() => true, () => false)
  check(opened, 'the More sheet opens')
  await shot('05-more-open')
  check(await back() === 'handled', 'back with a dialog open is handled by the page')
  await page.waitForTimeout(300)
  check(await page.locator('[aria-modal="true"]').count() === 0, 'the dialog closed on back')

  // ---- print: window.print is routed to the bridge ----
  await page.evaluate(() => window.print())
  check((await calls()).some(c => c[0] === 'print'), 'window.print() → DentoraAndroid.print() (shim from onPageFinished)')

  // ---- saving a file: the expenses CSV goes through DentoraAndroid.saveFile ----
  await page.goto(table.js.startUrl + '#/expenses')
  await settle()
  await shot('06-expenses')
  const exportBtn = page.locator('button:has(svg.lucide-download)').first()
  if (await exportBtn.count()) {
    await exportBtn.click()
    await page.waitForFunction(() => window.__lastSave, null, { timeout: 5000 }).catch(() => {})
    const save = await page.evaluate(() => window.__lastSave && { name: window.__lastSave.name, mime: window.__lastSave.mime, text: new TextDecoder().decode(Uint8Array.from(atob(window.__lastSave.b64), c => c.charCodeAt(0))) })
    check(!!save && /^expenses-.*\.csv$/.test(save.name) && save.mime.startsWith('text/csv') && save.text.includes('إيجار العيادة'), 'CSV export → DentoraAndroid.saveFile(name, mime, base64)', save ? `${save.name} ${save.mime} ${save.text.length} chars` : 'no call')
  } else check(false, 'expenses page has an export button')

  // ---- nothing failed to load, nothing left the phone ----
  check(notFound.length === 0, 'no 404 from the asset server', notFound.join(' '))
  check(outside.length === 0, 'no request to any other host (works offline)', outside.join(' '))
  const mimes = [...new Set(served.map(s => s.split(' ')[1]))]
  check(mimes.includes('application/javascript') && mimes.includes('text/css') && mimes.includes('font/woff2'), 'served types', mimes.join(', '))
  check(consoleErrors.length === 0, 'no console errors', consoleErrors.slice(0, 5).join(' | '))
} catch (e) {
  check(false, 'run', e.stack || String(e))
} finally {
  await browser.close()
  fs.rmSync(tmp, { recursive: true, force: true })
}
console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed')
process.exit(failures.length ? 1 : 0)

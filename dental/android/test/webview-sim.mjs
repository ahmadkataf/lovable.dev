// Runs the BUILT APK's web app the way the Android shell serves it, without a phone or an emulator:
//  - unpacks assets/ from android/build/Dentora.apk,
//  - answers every https://dentora.app/… request with the decisions of WebFiles.java (via ServeTable.java),
//  - installs a stand-in window.DentoraAndroid that records the bridge calls, and runs the page scripts the shell
//    runs (print shim, the saveFile Promise wrapper, the afterprint hold),
//  - and drives the app on a phone-sized Chromium in Arabic and English: start, sign-in, IndexedDB persistence,
//    fonts, hash routes, no sideways scrolling, the back key (BACK_JS), print, CSV export and backup through
//    saveFile (cancelled vs saved), restore through the file chooser, the device number from ANDROID_ID, WhatsApp.
//   cd dental && node android/test/webview-sim.mjs            (APK=…, QA_SHOTS=qa-shots/android)
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const APK = path.resolve(ROOT, process.env.APK || 'android/build/Dentora.apk')
const SHOTS = path.resolve(ROOT, process.env.QA_SHOTS || 'qa-shots/android')
const ANDROID_ID = 'a1b2c3d4e5f60789'
const failures = []
const check = (ok, what, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ' — ' + detail : ''}`); if (!ok) failures.push(what) }
// every page a clinic uses, checked for sideways scrolling on a 390 px phone
const ROUTES = ['#/', '#/patients', '#/patients/p-1', '#/appointments', '#/treatments', '#/prescriptions', '#/lab', '#/invoices',
  '#/payments', '#/expenses', '#/reports', '#/inventory', '#/procedures', '#/staff', '#/settings', '#/settings/backup', '#/settings/license']

// the device number the license screen must show for this ANDROID_ID (same code as the app)
let expectedDevice = null
try { expectedDevice = await (await import(pathToFileURL(path.join(ROOT, 'src/license/core.ts')).href)).deviceNumber(ANDROID_ID) } catch { /* checked by format below */ }

// ---- the APK's files and the shell's serving rules -------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dentora-apk-'))
execFileSync('unzip', ['-q', APK, 'assets/*', '-d', tmp])
const cls = path.join(tmp, 'classes')
execFileSync('javac', ['-nowarn', '-encoding', 'UTF-8', '-d', cls, 'android/src/com/dentora/app/WebFiles.java', 'android/test/ServeTable.java'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] })
const serveTable = (...paths) => JSON.parse(execFileSync('java', ['-cp', cls, 'com.dentora.app.ServeTable', path.join(tmp, 'assets'), ...paths], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
const table = serveTable()
const js = table.js
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
// the Java bridge: the same five methods; saveFile returns true at once, as the shell does
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
const run = code => page.evaluate(c => (0, eval)(c), code)
const calls = () => page.evaluate(() => window.__bridge.slice())
const back = () => run(js.back)
const onPageFinished = async () => { await run(js.printShim); await run(js.bridge) }    // what AppClient runs on every page
const shot = async name => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); console.log('     shot', path.relative(ROOT, path.join(SHOTS, `${name}.png`))) }
const settle = async () => { await page.waitForLoadState('networkidle'); await page.waitForTimeout(500) }
const go = async hash => { await page.goto(js.startUrl + hash); await settle() }
const lastSave = () => page.evaluate(() => window.__lastSave && { name: window.__lastSave.name, mime: window.__lastSave.mime, text: new TextDecoder().decode(Uint8Array.from(atob(window.__lastSave.b64), c => c.charCodeAt(0))) })
const nativeSaved = (ok, name) => run((ok ? js.savedOk : js.savedCancelled).replace('__NAME__', name))
const lastBackupAt = () => page.evaluate(async () => (await window.__dentora.db.settings.get('lastBackupAt'))?.value ?? null)
// every page: no sideways scrolling on a 390 px phone, and the back key really goes back (nothing left matching
// BACK_JS's "open dialog" selectors, which would make the back key do nothing on that page)
const everyPage = async label => {
  const wide = [], stuck = []
  for (const r of ROUTES) {
    await go(r)
    const m = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, w: window.innerWidth }))
    if (m.doc > m.w || m.body > m.w) wide.push(`${r} ${Math.max(m.doc, m.body)}>${m.w}`)
    const b = await back()
    if (b !== (r === '#/' ? 'home' : 'page')) stuck.push(`${r} → ${b}`)
  }
  check(wide.length === 0, `${label}: no sideways scrolling at 390 px on ${ROUTES.length} pages`, wide.join(', '))
  check(stuck.length === 0, `${label}: the back key goes back on every page`, stuck.join(', '))
}

try {
  // ---- first start: the setup screen, from the asset server ----
  await page.goto(js.startUrl)
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
    localStorage.setItem('dentora.lang', 'ar')
  })
  await page.goto(js.startUrl + '#/')
  await page.reload()
  await onPageFinished()
  await settle()
  check(/#\/$/.test(page.url()) && await page.locator('.app').count() > 0, 'signed-in start opens the dashboard', page.url())
  check(await page.evaluate(() => window.DentoraAndroid.__dentora === true), 'the shell wraps window.DentoraAndroid on every page')
  await page.evaluate(() => document.fonts.ready)
  const fonts = await page.evaluate(() => ({
    loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, '')),
    body: getComputedStyle(document.body).fontFamily,
  }))
  check(fonts.loaded.some(f => /Kufi/i.test(f)) && fonts.loaded.some(f => /Inter/i.test(f)), 'bundled fonts load from the APK (Inter + Noto Kufi Arabic)', [...new Set(fonts.loaded)].join(', '))
  await shot('02-dashboard')

  // ---- the device number comes from ANDROID_ID through the bridge ----
  check((await calls()).some(c => c[0] === 'deviceId'), 'license asks DentoraAndroid.deviceId() (ANDROID_ID)')

  // ---- hash routes survive a reload; IndexedDB persists ----
  await go('#/patients')
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
  await go('#/patients/p-1')
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
  await go('#/')
  check(await back() === 'home', 'back on the dashboard leaves the app (BACK_JS → home)')
  await page.locator('.app-bottomnav button').last().click()            // "More": a Modal of the shell
  const opened = await page.waitForSelector('[aria-modal="true"]', { timeout: 8000 }).then(() => true, () => false)
  check(opened, 'the More sheet opens')
  await shot('05-more-open')
  check(await back() === 'handled', 'back with a dialog open is handled by the page')
  await page.waitForTimeout(300)
  check(await page.locator('[aria-modal="true"]').count() === 0, 'the dialog closed on back')

  // ---- print: window.print is routed to the bridge; afterprint waits for the end of the print job ----
  await page.evaluate(() => window.print())
  check((await calls()).some(c => c[0] === 'print'), 'window.print() → DentoraAndroid.print() (shim from onPageFinished)')
  const held = await page.evaluate(([hold, done]) => {
    let n = 0, removed = 0
    const h = () => { n++ }
    const r = { handleEvent() { removed++ } }
    window.addEventListener('afterprint', h)            // as the print helpers do, right before print()
    window.addEventListener('afterprint', r)
    window.removeEventListener('afterprint', r)
    ;(0, eval)(hold)                                    // MainActivity.printPage
    window.dispatchEvent(new Event('afterprint'))      // what the WebView may fire after its first render pass
    const during = n
    ;(0, eval)(done)                                    // PrintDocumentAdapter.onFinish
    const after = n
    ;(0, eval)(done)
    window.dispatchEvent(new Event('afterprint'))      // outside a print job afterprint works as usual
    window.removeEventListener('afterprint', h)
    return { during, after, again: n, removed }
  }, [js.printHold, js.printDone])
  check(held.during === 0 && held.after === 1 && held.again === 2 && held.removed === 0, "the page's afterprint waits for the end of the print job (once), removeEventListener still works", JSON.stringify(held))

  // the dental chart's print sheet stays in place until the print screen closes
  await go('#/patients/p-1?tab=chart')
  const chartPrint = page.locator('button:has(svg.lucide-printer)').first()
  if (await chartPrint.count()) {
    const printsBefore = (await calls()).filter(c => c[0] === 'print').length
    await chartPrint.click()
    await page.waitForFunction(n => window.__bridge.filter(c => c[0] === 'print').length > n, printsBefore, { timeout: 5000 }).catch(() => {})
    await run(js.printHold)
    const printing = await page.evaluate(() => document.body.classList.contains('ch-printing'))
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
    await page.waitForTimeout(200)
    const stillPrinting = await page.evaluate(() => document.body.classList.contains('ch-printing'))
    await run(js.printDone)
    await page.waitForTimeout(300)
    const cleared = await page.evaluate(() => !document.body.classList.contains('ch-printing'))
    check(printing && stillPrinting && cleared, 'chart print: the sheet stays through the print job and is removed when it ends', JSON.stringify({ printing, stillPrinting, cleared }))
  } else check(false, 'the dental chart has a print button')

  // ---- saving a file: the expenses CSV goes through DentoraAndroid.saveFile ----
  await go('#/expenses')
  await shot('06-expenses')
  const exportBtn = page.locator('button:has(svg.lucide-download)').first()
  if (await exportBtn.count()) {
    await page.evaluate(() => { window.__lastSave = null })
    await exportBtn.click()
    await page.waitForFunction(() => window.__lastSave, null, { timeout: 5000 }).catch(() => {})
    const save = await lastSave()
    check(!!save && /^expenses-.*\.csv$/.test(save.name) && save.mime.startsWith('text/csv') && save.text.includes('إيجار العيادة'), 'CSV export → DentoraAndroid.saveFile(name, mime, base64)', save ? `${save.name} ${save.mime} ${save.text.length} chars` : 'no call')
    if (save) await nativeSaved(true, save.name)
  } else check(false, 'expenses page has an export button')

  // ---- backup: saveFile answers only when the save screen closes; a cancelled save is not a backup ----
  await go('#/settings/backup')
  const before = await lastBackupAt()
  const exportBackup = page.locator('[data-qa=export-backup]')
  await page.evaluate(() => { window.__lastSave = null })
  await exportBackup.click()
  await page.waitForFunction(() => window.__lastSave, null, { timeout: 8000 }).catch(() => {})
  const bk = await lastSave()
  let backupData = null
  try { backupData = bk && JSON.parse(bk.text) } catch { /* reported below */ }
  check(!!bk && /\.json$/.test(bk.name) && bk.mime.startsWith('application/json') && backupData?.app === 'dentora' && backupData?.tables?.patients?.length === 1,
    'backup → DentoraAndroid.saveFile with the whole database as JSON', bk ? `${bk.name} ${bk.mime} ${bk.text.length} chars` : 'no call')
  check(await exportBackup.evaluate(b => b.disabled || b.classList.contains('btn-loading')), 'while the save screen is open the backup button waits')
  await shot('07-backup-saving')
  if (bk) await nativeSaved(false, bk.name)
  await page.waitForTimeout(500)
  check(await lastBackupAt() === before && await exportBackup.evaluate(b => !b.disabled), 'a cancelled save screen is not recorded as a backup', String(await lastBackupAt()))
  await page.evaluate(() => { window.__lastSave = null })
  await exportBackup.click()
  await page.waitForFunction(() => window.__lastSave, null, { timeout: 8000 }).catch(() => {})
  const bk2 = await lastSave()
  if (bk2) await nativeSaved(true, bk2.name)
  await page.waitForFunction(b => window.__dentora.db.settings.get('lastBackupAt').then(r => !!r && r.value !== b), before, { timeout: 5000 }).catch(() => {})
  check(await lastBackupAt() !== before, 'a written backup is recorded (last backup date)', String(await lastBackupAt()))
  await page.waitForTimeout(300)
  await shot('08-backup-saved')

  // ---- restore: <input type=file> through the file chooser (onShowFileChooser on the phone) ----
  if (backupData) {
    const chooser = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), page.locator('[data-qa=choose-backup]').click()]).then(r => r[0], () => null)
    check(!!chooser && !chooser.isMultiple(), 'choosing a backup opens the file chooser (one file)')
    if (chooser) {
      const accept = await chooser.element().getAttribute('accept')
      await chooser.setFiles({ name: bk.name, mimeType: 'application/json', buffer: Buffer.from(bk.text) })
      const shown = await page.waitForSelector('[data-qa=restore-summary]', { timeout: 8000 }).then(() => true, () => false)
      check(shown, 'the chosen backup is read and summarised before restoring', `accept="${accept}"`)
      await shot('09-restore')
      check(await back() === 'handled', 'back closes the restore dialog')
      await page.waitForTimeout(300)
    }
    // a cancelled picker: the shell tells the page through a focus event; nothing breaks
    const chooser2 = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), page.locator('[data-qa=choose-backup]').click()]).then(r => r[0], () => null)
    if (chooser2) { await run(js.pickCancelled); await page.waitForTimeout(900) }
    check(!!chooser2 && await page.locator('[data-qa=restore-summary]').count() === 0 && await page.locator('[data-qa=restore-error]').count() === 0, 'a cancelled file chooser leaves the page as it was')
  }

  // ---- license: the device number from ANDROID_ID ----
  await go('#/settings/license')
  const device = (await page.locator('[data-qa=device-number]').first().textContent().catch(() => '') || '').trim()
  check(expectedDevice ? device === expectedDevice : /^[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(device), 'the license screen shows the device number made from ANDROID_ID', `${device}${expectedDevice ? ' (expected ' + expectedDevice + ')' : ''}`)
  await shot('10-license')

  await everyPage('Arabic')

  // ---- English ----
  await page.evaluate(async () => {
    localStorage.setItem('dentora.lang', 'en')
    const db = window.__dentora.db
    await db.clinic.put({ ...(await db.clinic.get('clinic')), lang: 'en' })
  })
  await go('#/')
  await page.reload()
  await onPageFinished()
  await settle()
  const doc = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }))
  check(doc.lang === 'en' && doc.dir === 'ltr', 'English: the page is left to right (and the shell reads lang=en for its messages)', JSON.stringify(doc))
  check(await page.evaluate(() => window.DentoraAndroid.__dentora === true), 'English: the bridge wrapper is back after the reload')
  await shot('11-en-dashboard')
  await go('#/patients/p-1')
  await shot('12-en-patient')
  await go('#/settings/backup')
  await shot('13-en-backup')
  await go('#/settings/license')
  await shot('14-en-license')
  await go('#/')
  check(await back() === 'home', 'English: back on the dashboard leaves the app')
  await everyPage('English')

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

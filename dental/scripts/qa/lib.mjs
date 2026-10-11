// Shared helpers for QA scripts: start a static server on a QA build, open Chromium, seed a signed-in clinic.
// The scripts reach the database through window.__dentora.db, which only QA builds have (src/main.tsx):
//   VITE_QA=1 npx vite build --outDir /tmp/dist-<you>
//   QA_DIST=/tmp/dist-<you> QA_PORT=<your port> QA_SHOTS=qa-shots/<you> node scripts/qa/<script>.mjs
// A release build (npm run build, the Windows and Android packages) has no such handle; the helpers say so.
import { chromium } from 'playwright'
import { execFileSync, spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const PORT = Number(process.env.QA_PORT || 4173)
export const DIST = process.env.QA_DIST || 'dist'          // build with: VITE_QA=1 npx vite build --outDir <QA_DIST>
export const BASE = `http://127.0.0.1:${PORT}`

export async function startServer() {
  // a leftover server on this port would silently serve someone else's build
  try { await fetch(BASE + '/index.html'); throw new Error(`port ${PORT} is already in use: pick another QA_PORT`) } catch (e) { if (String(e.message).startsWith('port ')) throw e }
  const p = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' })
  process.on('exit', () => { try { p.kill() } catch { /* already gone */ } })
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/index.html'); if (r.ok) return p } catch { /* not yet */ }
    await new Promise(r => setTimeout(r, 300))
  }
  p.kill(); throw new Error('preview server did not start')
}

export async function openBrowser({ width = 1440, height = 900, mobile = false, lang = 'ar' } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  const ctx = await browser.newContext({ viewport: { width: mobile ? Math.min(width, 430) : width, height }, hasTouch: mobile, locale: lang === 'ar' ? 'ar-SY' : 'en-US' })
  await ctx.addInitScript(applyPendingSession)
  // a Content-Security-Policy violation is a failure in every script that counts console errors
  await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI || '(inline)'} in ${e.sourceFile || location.href}`)))
  const page = await ctx.newPage()
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message))
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE:', m.text()) })
  return { browser, ctx, page }
}

/** The message when the served build has no window.__dentora (a release build, or one made without VITE_QA=1). */
export const NO_QA_HANDLE = `${DIST} has no window.__dentora: it is a release build. QA scripts need a QA build:\n  VITE_QA=1 npx vite build --outDir ${DIST}`
/** Waits for the QA database handle on a loaded page; throws a clear error when the build has none. */
export async function requireQaHandle(page, timeout = 20000) {
  const ok = await page.waitForFunction(() => !!window.__dentora?.db, null, { timeout }).then(() => true, () => false)
  if (!ok) throw new Error(NO_QA_HANDLE)
}

/**
 * The signed-in user lives in sessionStorage 'dentora.session' = {id, at} for one run of the app (src/app/session.tsx),
 * and the app writes it back when the page is hidden or unloaded, so a test cannot just edit it before a reload.
 * setSession() leaves the wish in window.name (kept across loads of the same tab); this init script applies it at the
 * start of the next load, before the app reads it. `id` null signs out.
 */
function applyPendingSession() {
  const PREFIX = 'dentora-qa-session:'
  if (typeof window.name !== 'string' || !window.name.startsWith(PREFIX)) return
  const id = window.name.slice(PREFIX.length)
  window.name = ''
  if (id) sessionStorage.setItem('dentora.session', JSON.stringify({ id, at: Date.now() }))
  else sessionStorage.removeItem('dentora.session')
}
/** Signs `userId` in (null: signs out) from the next page load on: call page.reload() or page.goto() of the app after it. */
export async function setSession(page, userId) {
  await page.evaluate(id => { window.name = `dentora-qa-session:${id ?? ''}` }, userId)
}
/** The signed-in user of this run, or null. */
export async function sessionUser(page) {
  return page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('dentora.session') || 'null')?.id ?? null } catch { return null } })
}

/** Marks setup as done, creates an admin (PIN 1234) and a doctor, signs the admin in. Call on a loaded page. */
export async function seedAndLogin(page, { lang = 'ar', clinicName = 'عيادة الابتسامة لطب الأسنان' } = {}) {
  await page.goto(BASE + '/index.html#/setup')
  await requireQaHandle(page)
  const userId = await page.evaluate(async ({ lang, clinicName }) => {
    const db = window.__dentora.db
    const now = new Date().toISOString()
    const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('')
    const salt = 'qa-salt'
    const existing = await db.clinic.get('clinic')
    await db.clinic.put({ ...(existing || {}), id: 'clinic', name: clinicName, nameEn: 'Smile Dental Clinic', phone: '0944 123 456', address: 'دمشق — المزة، شارع الجلاء', currency: 'USD', currencySymbol: '$', currencyDecimals: 0, lang, theme: 'light',
      workingDays: [0, 1, 2, 3, 4, 6], workStart: '09:00', workEnd: '18:00', slotMinutes: 30, defaultAppointmentMinutes: 30, taxPercent: 0, invoicePrefix: 'INV-', nextInvoiceNumber: existing?.nextInvoiceNumber || 1, nextFileNumber: existing?.nextFileNumber || 1, setupDone: true, createdAt: existing?.createdAt || now, updatedAt: now })
    const users = await db.users.toArray()
    let admin = users.find(u => u.role === 'admin')
    if (!admin) {
      admin = { id: 'u-admin', name: 'د. أحمد الخطيب', role: 'admin', pinHash: await sha(`${salt}:1234`), pinSalt: salt, color: '#0E8F86', specialty: 'طب الأسنان العام', active: true, createdAt: now, updatedAt: now }
      await db.users.put(admin)
      await db.users.put({ id: 'u-doc2', name: 'د. ليلى حداد', role: 'doctor', pinHash: await sha(`${salt}:1234`), pinSalt: salt, color: '#7C3AED', specialty: 'تقويم الأسنان', active: true, createdAt: now, updatedAt: now })
      await db.users.put({ id: 'u-rec', name: 'سارة يوسف', role: 'receptionist', pinHash: await sha(`${salt}:1234`), pinSalt: salt, color: '#DB2777', active: true, createdAt: now, updatedAt: now })
    }
    // the session of this run (sessionStorage, as after a PIN); the PIN is asked again in a new window
    sessionStorage.setItem('dentora.session', JSON.stringify({ id: admin.id, at: Date.now() }))
    localStorage.setItem('dentora.lang', lang)
    return admin.id
  }, { lang, clinicName })
  await page.goto(BASE + '/index.html#/')
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  return userId
}

/**
 * Loads the demo clinic (60 patients, appointments, invoices…) the way a clinic does: Settings → Backup → "Load demo
 * data" and its confirmation. Call on a signed-in admin page of an empty clinic. Resolves when the data is there.
 */
export async function loadDemo(page, { timeout = 90000 } = {}) {
  await page.goto(`${BASE}/index.html#/settings/backup`)
  const button = page.locator('[data-qa="load-demo"]')
  await button.waitFor({ state: 'visible', timeout: 15000 })
  await button.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('button').last().click()
  await page.waitForFunction(async () => (await window.__dentora.db.patients.count()) >= 60 && (await window.__dentora.db.activity.count()) > 50, null, { timeout, polling: 100 })
  await page.waitForTimeout(700)
  return page.evaluate(async () => { const d = window.__dentora.db; return { patients: await d.patients.count(), appointments: await d.appointments.count(), invoices: await d.invoices.count(), files: await d.files.count() } })
}

export async function shot(page, name, { dir = process.env.QA_SHOTS || 'qa-shots', full = false } = {}) {
  // an absolute QA_SHOTS (/tmp/…) is used as it is; a relative one is inside dental/
  const folder = path.resolve(ROOT, dir)
  fs.mkdirSync(folder, { recursive: true })
  const file = path.join(folder, `${name}.png`)
  await page.screenshot({ path: file, fullPage: full })
  console.log('shot', path.relative(ROOT, file))
  return file
}

/**
 * Sets the trial start (an ISO instant) in one transaction over every table, as a restore does: outside such a
 * transaction the licence guard only lets it move earlier (src/license/guard.ts). Use it to put a test clinic back
 * on a fresh trial after checking the read-only mode.
 */
export async function setTrialStart(page, iso) {
  await page.evaluate(iso => { const d = window.__dentora.db; return d.transaction('rw', d.tables, () => d.settings.put({ key: 'installedAt', value: iso })) }, iso)
}

/** The backup file name the app gives: dentora-backup-YYYY-MM-DD-HHMM.dentora (local time). */
export const BACKUP_NAME = /^dentora-backup-\d{4}-\d{2}-\d{2}-\d{4}\.dentora$/
/**
 * A .dentora backup (a ZIP: manifest.json, tables/<table>-<n>.json, files/<id>/<name>) read back as the old one-JSON
 * shape { app, format, version, exportedAt, tables, files }, with the system's unzip. Not for password-protected ones.
 */
export function readArchive(file) {
  const entry = name => execFileSync('unzip', ['-p', file, name], { encoding: 'utf8', maxBuffer: 1 << 28 })
  const manifest = JSON.parse(entry('manifest.json'))
  const tables = {}
  for (const [name, t] of Object.entries(manifest.tables)) tables[name] = t.parts.flatMap(part => JSON.parse(entry(part)))
  return { app: manifest.app, format: manifest.format, version: manifest.version, exportedAt: manifest.exportedAt, tables, files: manifest.files }
}

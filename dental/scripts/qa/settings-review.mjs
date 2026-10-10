// Adversarial review of Settings: edge cases on top of scripts/qa/settings.mjs (long names, zero / negative numbers,
// double submits, Escape / Enter, unsaved changes, pasted codes with spaces, receptionist, phone, English, auto-lock).
//   npx vite build --outDir /tmp/dist-settings-r && npx vite build --config vite.tools.config.ts
//   QA_DIST=/tmp/dist-settings-r QA_PORT=4359 QA_SHOTS=qa-shots/settings-review node scripts/qa/settings-review.mjs
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'
import { makeCode as signCode, importSigningKey, parsePrivateKey } from '../../tools/generator-lib.ts'
import { checkCode } from '../../src/license/core.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// Codes are signed with the seller's private key (never in the repository): DENTORA_LICENSE_KEY or ../secrets-for-user.
const KEY_FILE = process.env.DENTORA_LICENSE_KEY || path.resolve(ROOT, '../secrets-for-user/dentora/license-private.jwk')
const signingKey = await (async () => {
  if (!fs.existsSync(KEY_FILE)) return null
  const p = parsePrivateKey(fs.readFileSync(KEY_FILE, 'utf8'))
  return p.ok ? importSigningKey(p.jwk) : null
})()
if (!signingKey) { console.error(`the licence private key is needed for these checks: ${KEY_FILE}`); process.exit(2) }
const makeCode = (device, plan, until) => signCode(device, plan, until, signingKey)
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'st-review-'))
const errors = []
let failures = 0
function ok(cond, msg) { if (!cond) { failures++; console.error('FAIL:', msg) } else console.log('ok  ', msg) }
async function open(opts = {}) {
  const b = await openBrowser(opts)
  b.page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  b.page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  return b
}
async function noOverflow(page, name) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(over <= 0, `${name}: no horizontal overflow (${over})`)
}
async function snap(page, name, { full = true } = {}) {
  await page.waitForTimeout(450)
  await noOverflow(page, name)
  await shot(page, name, { full })
}
const q = (page, fn, arg) => page.evaluate(fn, arg)
const tab = async (page, id) => {
  await page.evaluate(id => { location.hash = `#/settings/${id}` }, id)
  await page.waitForSelector(`[data-qa=tab-${id}]`)
  await page.waitForTimeout(450)
}
const clinicRow = page => q(page, () => window.__dentora.db.clinic.get('clinic'))
const activity = (page, message) => q(page, async m => (await window.__dentora.db.activity.toArray()).filter(a => !m || a.message === m).length, message)
const setting = (page, key) => q(page, async k => (await window.__dentora.db.settings.get(k))?.value ?? null, key)
const cli = (...args) => execFileSync('node', ['scripts/code-generator.mjs', ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const confirmDialog = page => page.locator('.modal[role=dialog]').last()

const LONG_AR = 'مركز الابتسامة الذهبية التخصصي المتكامل لطب وتجميل وزراعة الأسنان وتقويمها وعلاج اللثة للكبار والأطفال — فرع دمشق الرئيسي'
const LONG_EN = 'The Golden Smile Comprehensive Specialist Center for Cosmetic Dentistry, Implants, Orthodontics and Periodontics'

const server = await startServer()
try {
  // ====================================== desktop · Arabic · admin ======================================
  {
    const { browser, page } = await open()
    await seedAndLogin(page)

    // ---- deep link straight to a tab; unknown tabs fall back ----
    await page.goto(BASE + '/index.html#/settings/license')
    await page.waitForSelector('[data-qa=tab-license]')
    ok(await page.locator('.st-nav-item.active[data-tab=license]').count() === 1, 'deep link /settings/license opens the licence tab')
    await page.goto(BASE + '/index.html#/settings/nope')
    await page.waitForSelector('[data-qa=tab-clinic]')
    ok((await page.evaluate(() => location.hash)) === '#/settings/clinic', 'unknown tab → /settings/clinic')

    // ---- clinic: very long names, Enter submits, one save per double Enter ----
    const before = await clinicRow(page)
    await page.fill('[data-qa=clinic-name]', LONG_AR)
    await page.fill('input[placeholder="Smile Dental Clinic"]', LONG_EN)
    await page.fill('input[placeholder^="مثال: تجميل"]', 'تجميل وزراعة وتقويم الأسنان — د. أحمد الخطيب، د. ليلى حداد، د. سامر العلي، د. نور الهدى')
    await page.click('[data-qa=clinic-name]')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.st-savebar:not(.dirty)')
    await page.waitForTimeout(500)
    const c1 = await clinicRow(page)
    ok(c1.name === LONG_AR && c1.nameEn === LONG_EN, 'clinic: Enter saves the long names')
    ok(c1.updatedAt > before.updatedAt, 'clinic: updatedAt moves forward')
    ok(await activity(page, 'تحديث بيانات العيادة') === 1, `clinic: a double Enter saves once (${await activity(page, 'تحديث بيانات العيادة')} activity rows)`)
    const sheet = await q(page, () => { const s = document.querySelector('[data-qa=invoice-preview]'); return s.scrollWidth - s.clientWidth })
    ok(sheet <= 1, `clinic: the invoice-header preview fits a long name (${sheet})`)
    await snap(page, 'd-ar-1-clinic-long')

    // ---- clinic: leaving with unsaved changes asks first; Escape keeps you here ----
    await page.fill('[data-qa=clinic-phone]', '0933 555 777')
    await page.click('.st-nav-item[data-tab=billing]')
    await page.waitForSelector('.modal[role=dialog]')
    ok((await confirmDialog(page).textContent()).includes('المغادرة دون حفظ'), 'clinic: switching tab with unsaved edits asks first')
    await snap(page, 'd-ar-1b-leave-confirm', { full: false })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    ok((await page.evaluate(() => location.hash)) === '#/settings/clinic' && (await page.inputValue('[data-qa=clinic-phone]')) === '0933 555 777', 'clinic: Escape stays on the tab with the edit intact')
    await page.click('.app-sidebar a[href="#/patients"]', { timeout: 3000 }).catch(async () => page.evaluate(() => { location.hash = '#/patients' }))
    await page.waitForSelector('.modal[role=dialog]')
    ok(true, 'clinic: leaving Settings for another page also asks')
    await confirmDialog(page).locator('.btn-danger').click()
    await page.waitForFunction(() => location.hash.startsWith('#/patients'))
    ok((await clinicRow(page)).phone === '0944 123 456', 'clinic: "leave" discards the unsaved phone')
    await page.goto(BASE + '/index.html#/settings/clinic')
    await page.waitForSelector('[data-qa=tab-clinic]')
    await page.fill('[data-qa=clinic-name]', '   ')
    await page.click('[data-qa=save]')
    ok(await page.locator('.field-error').count() === 1 && (await clinicRow(page)).name === LONG_AR, 'clinic: a blank name is refused')
    await page.fill('[data-qa=clinic-name]', 'عيادة الابتسامة لطب الأسنان')
    await page.fill('input[placeholder="Smile Dental Clinic"]', 'Smile Dental Clinic')
    await page.click('[data-qa=save]')
    await page.waitForSelector('.st-savebar:not(.dirty)')

    // ---- preferences: hours with Enter, invalid hours, theme, font ----
    await tab(page, 'preferences')
    await page.fill('[data-qa=work-start]', '18:00')
    await page.fill('[data-qa=work-end]', '09:00')
    await page.click('[data-qa=save-hours]')
    ok(await page.locator('.field-error').count() >= 1 && (await clinicRow(page)).workStart === '09:00', 'hours: end before start is refused')
    await page.fill('[data-qa=work-start]', '08:30')
    await page.fill('[data-qa=work-end]', '16:00')
    await page.locator('[data-qa=work-end]').press('Enter')
    await page.waitForTimeout(600)
    const c2 = await clinicRow(page)
    ok(c2.workStart === '08:30' && c2.workEnd === '16:00', 'hours: Enter saves')
    await page.click('[data-theme-option=dark]')
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
    ok((await clinicRow(page)).theme === 'dark', 'theme: dark stored on the clinic')
    await snap(page, 'd-ar-2-dark', { full: false })
    await page.click('[data-theme-option=light]')
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
    await page.click('[data-font=tajawal]')
    ok(await q(page, () => document.documentElement.dataset.font === 'tajawal' && localStorage.getItem('dentora.font') === 'tajawal'), 'font: Tajawal applied and kept')
    await page.click('[data-font=kufi]')
    const fam = await q(page, () => [...document.querySelectorAll('.st-font-sample')].map(e => getComputedStyle(e).fontFamily))
    ok(new Set(fam).size === fam.length && fam.length === 7, `font: each card renders its own face (${[...new Set(fam)].join(' | ')})`)
    await page.selectOption('[data-qa=lock-select]', '30')
    ok(await q(page, () => localStorage.getItem('dentora.lockAfter')) === '1800000', 'auto-lock: 30 min stored as 1800000 ms')
    await page.selectOption('[data-qa=lock-select]', '15')

    // ---- billing: zero, negative, out-of-range, used numbers ----
    await q(page, async () => {
      const db = window.__dentora.db, now = new Date().toISOString()
      await db.patients.put({ id: 'p-120', fileNo: 120, name: 'مريض قديم', gender: 'male', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: now, updatedAt: now })
      await db.invoices.put({ id: 'inv-41', number: 'INV-000041', patientId: 'p-120', date: now.slice(0, 10), items: [], subtotal: 0, discount: 0, tax: 0, total: 0, paid: 0, status: 'paid', createdAt: now, updatedAt: now })
    })
    await tab(page, 'billing')
    const setNum = async (sel, v) => { await page.fill(sel, ''); if (v !== '') await page.locator(sel).pressSequentially(String(v)) }
    await setNum('[data-qa=tax]', '-5')
    await setNum('[data-qa=next-invoice]', '0')
    await setNum('[data-qa=next-file]', '-3')
    await page.click('[data-qa=save]')
    const errs = await page.locator('.field-error').allTextContents()
    ok(errs.length === 3, `billing: negative tax, zero invoice no. and negative file no. refused (${errs.length})`)
    await snap(page, 'd-ar-3-billing-errors')
    await setNum('[data-qa=tax]', '100.5')
    await setNum('[data-qa=next-invoice]', '41')
    await setNum('[data-qa=next-file]', '120')
    await page.click('[data-qa=save]')
    const errs2 = await page.locator('.field-error').allTextContents()
    ok(errs2.some(e => e.includes('41')) && errs2.some(e => e.includes('120')) && errs2.length === 3, `billing: tax > 100 and used numbers refused (${errs2.join(' / ')})`)
    await setNum('[data-qa=tax]', '15')
    await setNum('[data-qa=next-invoice]', '42')
    await setNum('[data-qa=next-file]', '121')
    ok((await page.textContent('[data-qa=preview-number]')).trim() === 'INV-000042', 'billing: preview shows INV-000042')
    ok((await page.textContent('[data-qa=billing-preview]')).includes('15%'), 'billing: preview shows the 15% tax line')
    await page.locator('[data-qa=next-file]').press('Enter')
    await page.locator('[data-qa=next-file]').press('Enter')
    await page.waitForSelector('.st-savebar:not(.dirty)')
    await page.waitForTimeout(400)
    const c3 = await clinicRow(page)
    ok(c3.taxPercent === 15 && c3.nextInvoiceNumber === 42 && c3.nextFileNumber === 121, 'billing: tax and counters saved')
    ok(await activity(page, 'تحديث إعدادات الفوترة') === 1, 'billing: double Enter logs one save')
    await page.selectOption('[data-qa=currency]', 'custom')
    await page.fill('[data-qa=currency-code]', '')
    await page.click('[data-qa=save]')
    ok(await page.locator('[data-qa=currency-code]').evaluate(e => e.closest('.field').querySelector('.field-error') !== null), 'billing: empty custom currency code refused')
    await page.selectOption('[data-qa=currency]', 'USD')
    await page.fill('[data-qa=prefix]', 'inv-')
    ok(await page.inputValue('[data-qa=prefix]') === 'INV-', 'billing: prefix upper-cased while typing')
    await page.fill('[data-qa=prefix]', 'NEW-')
    await setNum('[data-qa=next-invoice]', '1')
    ok(await page.locator('.alert').filter({ hasText: 'أنقصت' }).count() === 0, 'billing: a new prefix starting at 1 is not called a decrease')
    await page.click('button:has-text("تراجع")')
    await page.evaluate(() => window.__dentora.db.invoices.delete('inv-41'))

    // ---- licence: pasted code with spaces and lower case, Enter, deactivate with Escape ----
    await tab(page, 'license')
    const device = (await page.textContent('[data-qa=device-number]')).trim()
    const trialText = await page.textContent('[data-qa=trial-progress]')
    const expectEnd = await q(page, async () => {
      const at = (await window.__dentora.db.settings.get('installedAt')).value
      return new Intl.DateTimeFormat('ar-SY-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(new Date(at).getTime() + 7 * 86400000))
    })
    ok(trialText.includes(expectEnd), `licence: trial end date is the local day of install + 7 (${expectEnd})`)
    const yearly = cli(device, 'standard', '1y')
    await page.click('[data-qa=code-input]')
    await page.keyboard.insertText(`  ${yearly.toLowerCase().replace(/-/g, ' - ')}\n`)
    ok(await page.inputValue('[data-qa=code-input]') === yearly, `licence: a pasted code with spaces/dashes/case is cleaned (${await page.inputValue('[data-qa=code-input]')})`)
    await page.locator('[data-qa=code-input]').press('Enter')
    await page.locator('[data-qa=code-input]').press('Enter').catch(() => {})
    await page.waitForSelector('[data-qa=license-status][data-status=active]')
    await page.waitForTimeout(400)
    ok(await page.locator('[data-qa=trial-progress]').count() === 0, 'licence: trial bar gone once active')
    const lic = await setting(page, 'license')
    ok(lic?.plan === 'standard' && lic?.code === yearly && /^\d{4}-\d{2}-\d{2}T/.test(lic?.until || ''), 'licence: code, plan and end date stored')
    ok(await q(page, async () => (await window.__dentora.db.activity.toArray()).filter(a => a.message?.startsWith('تفعيل الترخيص')).length) === 1, 'licence: one activation logged')
    const untilShown = await page.textContent('[data-qa=license-until]')
    const untilDay = new Date(lic.until).toISOString().slice(0, 10)
    const expUntil = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${untilDay}T12:00:00`))
    ok(untilShown.includes(expUntil), `licence: valid-until shows the code's own day (${untilShown})`)
    ok((await page.locator('.st-nav-item[data-tab=license] .badge').count()) === 0, 'licence: the trial badge leaves the tab list')
    await snap(page, 'd-ar-5-license-active')
    await page.click('[data-qa=deactivate]')
    await page.waitForSelector('.modal[role=dialog]')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    ok((await setting(page, 'license'))?.plan === 'standard', 'licence: Escape cancels deactivation')

    // ---- expired → read-only everywhere it matters ----
    await page.click('[data-qa=deactivate]')
    await confirmDialog(page).locator('.btn-danger').click()
    await page.waitForSelector('[data-qa=license-status][data-status=trial]')
    await q(page, async () => { await window.__dentora.db.settings.put({ key: 'installedAt', value: new Date(Date.now() - 40 * 86400000).toISOString() }) })
    await page.waitForSelector('[data-qa=license-status][data-status=expired]')
    await snap(page, 'd-ar-5b-license-expired', { full: false })
    await tab(page, 'clinic')
    ok(await page.locator('[data-qa=clinic-name]').isDisabled(), 'expired: clinic fields read-only')
    await tab(page, 'billing')
    ok(await page.locator('.segmented.st-inert').count() === 1, 'expired: the decimals switch looks and acts disabled')
    await tab(page, 'preferences')
    ok(await page.locator('.st-days.st-inert').count() === 1, 'expired: working-day chips are inert')
    await tab(page, 'backup')
    ok(await page.locator('[data-qa=export-backup]').isEnabled() && await page.locator('[data-qa=choose-backup]').isDisabled() && await page.locator('[data-qa=reset-all]').isDisabled(), 'expired: export allowed, restore and reset blocked')
    await tab(page, 'license')
    const life = cli(device, 'pro', 'lifetime')
    await page.fill('[data-qa=code-input]', life)
    await page.click('[data-qa=activate]')
    await page.waitForSelector('[data-qa=license-status][data-status=active]')
    ok((await page.textContent('[data-qa=license-until]')).includes('لا ينتهي'), 'licence: lifetime activation from the expired state')
    await q(page, async () => { await window.__dentora.db.settings.put({ key: 'installedAt', value: new Date().toISOString() }) })

    // ---- backup: export, bad files, restore with Escape / wrong word / Enter ----
    await tab(page, 'backup')
    const dl = page.waitForEvent('download')
    await page.click('[data-qa=export-backup]')
    const download = await dl
    const file = path.join(TMP, download.suggestedFilename())
    await download.saveAs(file)
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    ok(data.app === 'dentora' && Array.isArray(data.tables.patients) && data.tables.patients.length === 1, 'backup: the export holds every table')
    await page.waitForTimeout(400)
    const lastAt = await setting(page, 'lastBackupAt')
    ok(lastAt && Date.now() - new Date(lastAt).getTime() < 60_000, 'backup: lastBackupAt set')
    ok(await q(page, async () => (await window.__dentora.db.activity.toArray()).some(a => a.type === 'system' && a.action === 'backup')), 'backup: activity logged')

    const pick = async (name, content) => {
      const p = path.join(TMP, name); fs.writeFileSync(p, content)
      const fc = page.waitForEvent('filechooser'); await page.click('[data-qa=choose-backup]'); await (await fc).setFiles(p)
      await page.waitForTimeout(500)
    }
    await pick('notes.json', 'hello')
    ok((await page.textContent('[data-qa=restore-error]'))?.includes('تالف'), 'restore: non-JSON refused')
    await pick('other.json', JSON.stringify({ app: 'other', tables: {} }))
    ok((await page.textContent('[data-qa=restore-error]'))?.includes('ليس نسخة'), 'restore: foreign JSON refused')
    await pick('newer.json', JSON.stringify({ ...data, version: 99 }))
    ok((await page.textContent('[data-qa=restore-error]'))?.includes('أحدث'), 'restore: newer version refused')
    const longBackup = { ...data, tables: { ...data.tables, clinic: [{ ...data.tables.clinic[0], name: LONG_AR }] } }
    await pick('dentora-backup-with-a-very-long-file-name-copied-from-the-usb-stick-2026-10-10.json', JSON.stringify(longBackup))
    await page.waitForSelector('[data-qa=restore-summary]')
    await snap(page, 'd-ar-4-restore-long', { full: false })
    const modalOver = await q(page, () => { const m = document.querySelector('.modal'); return m.scrollWidth - m.clientWidth })
    ok(modalOver <= 1, `restore: summary fits a long clinic/file name (${modalOver})`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    ok(await page.locator('[data-qa=restore-summary]').count() === 0, 'restore: Escape closes the confirmation')
    await q(page, async () => { const now = new Date().toISOString(); await window.__dentora.db.patients.put({ id: 'p-after', fileNo: 999, name: 'بعد التصدير', gender: 'female', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: now, updatedAt: now }) })
    const fc = page.waitForEvent('filechooser'); await page.click('[data-qa=choose-backup]'); await (await fc).setFiles(file)
    await page.waitForSelector('[data-qa=restore-summary]')
    await page.fill('[data-qa=confirm-word]', 'استبد')
    ok(await page.locator('[data-qa=confirm-danger]').isDisabled(), 'restore: a partial word keeps the button disabled')
    await page.locator('[data-qa=confirm-word]').press('Enter')
    await page.waitForTimeout(300)
    ok(await q(page, async () => !!(await window.__dentora.db.patients.get('p-after'))), 'restore: Enter with the wrong word does nothing')
    await page.fill('[data-qa=confirm-word]', 'إستبدال')
    const nav = page.waitForEvent('load')
    await page.locator('[data-qa=confirm-word]').press('Enter')
    await page.locator('[data-qa=confirm-danger]').click({ timeout: 500 }).catch(() => {})
    await nav
    await page.waitForFunction(() => window.__dentora?.db)
    await page.waitForTimeout(800)
    ok(await q(page, async () => !(await window.__dentora.db.patients.get('p-after'))), 'restore: Enter with the word restores (later patient gone)')
    ok((await setting(page, 'license'))?.plan === 'pro', 'restore: this device keeps its activation')
    ok((await setting(page, 'lastBackupAt')) === lastAt, 'restore: the last export date of this device is kept')

    // ---- reset: Escape, then confirm twice quickly ----
    await page.goto(BASE + '/index.html#/settings/backup')
    await page.waitForSelector('[data-qa=tab-backup]')
    await page.click('[data-qa=reset-all]')
    await page.waitForSelector('[data-qa=confirm-word]')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    ok(await page.locator('[data-qa=confirm-word]').count() === 0, 'reset: Escape closes the dialog')
    ok(await q(page, async () => (await window.__dentora.db.patients.count()) === 1), 'reset: nothing erased after Escape')
    await page.click('[data-qa=reset-all]')
    await page.fill('[data-qa=confirm-word]', 'حذف')
    const nav2 = page.waitForEvent('load')
    await page.click('[data-qa=confirm-danger]')
    await page.click('[data-qa=confirm-danger]', { timeout: 300 }).catch(() => {})
    await nav2
    await page.waitForFunction(() => location.hash.startsWith('#/setup'))
    await page.waitForTimeout(600)
    ok(await q(page, async () => (await window.__dentora.db.patients.count()) === 0 && (await window.__dentora.db.users.count()) === 0), 'reset: patients and users erased')
    ok((await setting(page, 'license'))?.plan === 'pro' && !(await q(page, () => localStorage.getItem('dentora.session'))), 'reset: activation kept, signed out')
    await browser.close()
  }

  // ====================================== receptionist ======================================
  {
    const { browser, page } = await open()
    await seedAndLogin(page)
    await q(page, () => localStorage.setItem('dentora.session', 'u-rec'))
    await page.goto(BASE + '/index.html#/settings/backup')
    await page.reload()
    await page.waitForSelector('[data-qa=tab-clinic]')
    ok((await page.evaluate(() => location.hash)) === '#/settings/clinic', 'receptionist: /settings/backup → clinic')
    ok(await page.locator('.st-nav-item[data-tab=backup]').count() === 0 && await page.locator('[data-qa=savebar]').count() === 0, 'receptionist: no backup tab, no save bar')
    await tab(page, 'preferences')
    ok(await page.locator('[data-qa=lock-select]').isDisabled() && await page.locator('[data-lang=en]').isDisabled(), 'receptionist: language and auto-lock are admin-only')
    await page.click('[data-font=cairo]')
    ok(await q(page, () => document.documentElement.dataset.font === 'cairo'), 'receptionist: can still pick a font for this device')
    await page.click('[data-font=kufi]')
    await tab(page, 'billing')
    await snap(page, 'd-ar-7-receptionist-billing', { full: false })
    await browser.close()
  }

  // ====================================== auto-lock applies now ======================================
  {
    const { browser, page } = await open()
    await page.clock.install({ time: new Date() })
    await seedAndLogin(page)
    await page.goto(BASE + '/index.html#/settings/preferences')
    await page.waitForSelector('[data-qa=lock-select]')
    await page.selectOption('[data-qa=lock-select]', '5')
    await page.waitForTimeout(300)
    await page.clock.fastForward('06:00')
    await page.waitForTimeout(300)
    ok((await page.evaluate(() => location.hash)).startsWith('#/login'), 'auto-lock: a 5-minute setting locks after 6 idle minutes without signing in again')
    await q(page, () => localStorage.removeItem('dentora.lockAfter'))
    await browser.close()
  }

  // ====================================== phone + English ======================================
  for (const lang of ['ar', 'en']) {
    const { browser, page } = await open({ width: 390, height: 844, mobile: true, lang })
    await seedAndLogin(page, { lang })
    for (const [i, id] of ['clinic', 'preferences', 'billing', 'backup', 'license', 'about'].entries()) {
      await page.goto(BASE + `/index.html#/settings/${id}`)
      await page.waitForSelector(`[data-qa=tab-${id}]`)
      await page.waitForTimeout(700)
      const pill = await q(page, () => {
        const row = document.querySelector('.st-mobile-tabs .tabs'), p = row?.querySelector('.tab.active')
        if (!row || !p) return false
        const r = row.getBoundingClientRect(), b = p.getBoundingClientRect()
        return b.left >= r.left - 1 && b.right <= r.right + 1
      })
      ok(pill, `m-${lang} ${id}: the active tab pill is in view`)
      if (id === 'clinic' || id === 'billing') {
        const bar = await q(page, () => {
          const s = document.querySelector('.st-savebar'), cards = [...document.querySelectorAll('.st-form > .card')]
          const last = cards[cards.length - 1]
          return s && last ? s.getBoundingClientRect().top - last.getBoundingClientRect().bottom : 99
        })
        ok(bar >= 0, `m-${lang} ${id}: the saved bar sits below the last card (${Math.round(bar)}px)`)
      }
      await snap(page, `m-${lang}-${i + 1}-${id}`)
    }
    // the dirty bar stays above the bottom navigation
    await page.goto(BASE + '/index.html#/settings/clinic')
    await page.waitForSelector('[data-qa=clinic-name]')
    await page.fill('[data-qa=clinic-name]', lang === 'ar' ? 'عيادة النور' : 'Noor Clinic')
    await page.waitForTimeout(400)
    const gap = await q(page, () => {
      const s = document.querySelector('.st-savebar.dirty').getBoundingClientRect(), n = document.querySelector('.app-bottomnav')?.getBoundingClientRect()
      return n ? n.top - s.bottom : innerHeight - s.bottom
    })
    ok(gap >= 0, `m-${lang}: the unsaved bar floats above the bottom navigation (${Math.round(gap)})`)
    await snap(page, `m-${lang}-7-dirty`, { full: false })
    await browser.close()
  }

  // desktop English, every tab
  {
    const { browser, page } = await open({ lang: 'en' })
    await seedAndLogin(page, { lang: 'en' })
    for (const [i, id] of ['clinic', 'preferences', 'billing', 'backup', 'license', 'about'].entries()) {
      await page.goto(BASE + `/index.html#/settings/${id}`)
      await page.waitForSelector(`[data-qa=tab-${id}]`)
      const arabic = await q(page, () => (document.querySelector('.st-content').innerText.match(/[؀-ۿ]+/g) || []).join(' '))
      // the Arabic font samples, the Arabic clinic name in the preview and the Arabic language card are expected
      if (!['preferences', 'clinic', 'license'].includes(id)) ok(!arabic, `en ${id}: no Arabic leaks (${arabic.slice(0, 60)})`)
      await snap(page, `d-en-${i + 1}-${id}`)
    }
    await browser.close()
  }

  // ====================================== offline generator page → the app ======================================
  {
    const toolFile = path.join(ROOT, 'dist-tools/code-generator.html')
    ok(fs.existsSync(toolFile), 'generator: dist-tools/code-generator.html built')
    const { browser, page: app } = await open()
    await seedAndLogin(app)
    await app.goto(BASE + '/index.html#/settings/license')
    const device = (await app.textContent('[data-qa=device-number]')).trim()
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    page.on('pageerror', e => errors.push(`generator pageerror: ${e.message}`))
    await page.goto(pathToFileURL(toolFile).href)
    await page.waitForFunction(() => window.__generatorReady)
    await page.click('#device')
    await page.keyboard.insertText(`  ${device.toLowerCase().replace('-', ' ')}  `)
    ok(await page.inputValue('#device') === device, `generator: a pasted device number with spaces is cleaned (${await page.inputValue('#device')})`)
    await page.selectOption('#plan', 'pro')
    await page.selectOption('#validity', '2y')
    await page.click('#make-btn')
    await page.waitForSelector('#result:not(.hidden)')
    const code = (await page.textContent('#code')).trim()
    await page.click('#v-code'); await page.fill('#v-code', '')
    await page.keyboard.insertText(` ${code.toLowerCase()} \n`)
    await page.click('#verify-btn')
    ok((await page.textContent('#verdict')).includes('رمز صالح'), 'generator: verify accepts a pasted code with spaces')
    await snap(page, 'g-1-made', { full: true })
    await app.fill('[data-qa=code-input]', code)
    await app.click('[data-qa=activate]')
    await app.waitForSelector('[data-qa=license-status][data-status=active]')
    ok((await setting(app, 'license'))?.plan === 'pro', 'generator → app: the page\'s code activates the app (pro, 2 years)')
    await browser.close()
  }

  // ====================================== CLI round trip ======================================
  {
    const d = '7KQ4-M2XD'
    const c = cli(d, 'standard', '2027-12-31')
    ok(/^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){27}$/.test(c), `cli: code format (112 characters)`)
    ok(cli('verify', d, c).startsWith('valid · plan standard · until 2027-12-31'), 'cli: verify valid')
    let failed = false
    try { cli('verify', '7KQ4-M2XE', c) } catch { failed = true }
    ok(failed, 'cli: verify on another device exits non-zero')
    ok((await checkCode(d, c)).ok === true, 'cli: the app verifier accepts the CLI code')
  }

  ok(errors.length === 0, `no console errors (${errors.length})`)
  for (const e of errors.slice(0, 10)) console.error('  ', e)
} finally {
  server.kill()
  fs.rmSync(TMP, { recursive: true, force: true })
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)

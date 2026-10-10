// QA for the settings module (clinic, preferences, billing, backup/restore, licence, about) and the seller's code
// generator (CLI + offline page): screenshots in desktop RTL / desktop EN / phone, real flows asserted on the database.
//   npx vite build --outDir /tmp/dist-settings && npx vite build --config vite.tools.config.ts
//   QA_DIST=/tmp/dist-settings QA_PORT=4309 QA_SHOTS=qa-shots/settings node scripts/qa/settings.mjs
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'
import { makeCode } from '../../src/license/core.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const errors = []
let failures = 0
function ok(cond, msg) { if (!cond) { failures++; console.error('FAIL:', msg) } else console.log('ok  ', msg) }
async function open(opts = {}) {
  const b = await openBrowser(opts)
  b.page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  b.page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  return b
}
async function snap(page, name, opts = { full: true }) {
  await page.waitForTimeout(450)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(over <= 0, `${name}: no horizontal overflow (${over})`)
  await shot(page, name, opts)
}
const q = (page, fn, arg) => page.evaluate(fn, arg)
const tab = async (page, id) => {
  await page.evaluate(id => { location.hash = `#/settings/${id}` }, id)
  await page.waitForSelector(`[data-qa=tab-${id}]`)
  await page.waitForTimeout(400)
}
const toastText = async page => (await page.locator('.toast').last().textContent({ timeout: 5000 }).catch(() => '')) || ''
const cli = (...args) => execFileSync('node', ['scripts/code-generator.mjs', ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/** A clinic logo made on the fly (a PNG of an SVG). */
async function makeLogo(browser) {
  const p = await browser.newPage({ viewport: { width: 200, height: 200 } })
  await p.setContent(`<body style="margin:0"><svg id="l" width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
    <rect width="160" height="160" rx="36" fill="#1D4ED8"/><circle cx="80" cy="70" r="34" fill="#fff"/><path d="M62 66c6 10 30 10 36 0" stroke="#1D4ED8" stroke-width="7" fill="none" stroke-linecap="round"/>
    <text x="80" y="136" font-size="22" font-family="sans-serif" font-weight="700" fill="#fff" text-anchor="middle">SMILE</text></svg></body>`)
  const buf = await p.locator('#l').screenshot({ omitBackground: true })
  await p.close()
  return buf
}

const server = await startServer()
try {
  // ======================= desktop · Arabic =======================
  {
    const { browser, page } = await open()
    await seedAndLogin(page)
    await page.goto(BASE + '/index.html#/settings')
    await page.waitForSelector('[data-qa=tab-clinic]')
    await page.waitForSelector('[data-qa=invoice-preview]')
    await snap(page, 'd-ar-1-clinic')

    // ---- clinic: validation, logo, save ----
    await page.fill('[data-qa=clinic-name]', '')
    await page.fill('[data-qa=clinic-email]', 'clinic@')
    await page.click('[data-qa=save]')
    ok(await page.locator('.field-error').count() === 2, 'clinic: name + email errors shown')
    ok(await q(page, async () => (await window.__dentora.db.clinic.get('clinic')).name) === 'عيادة الابتسامة لطب الأسنان', 'clinic: nothing saved while invalid')
    await snap(page, 'd-ar-1b-clinic-errors', { full: false })
    await page.fill('[data-qa=clinic-name]', 'عيادة الابتسامة لطب الأسنان')
    await page.fill('[data-qa=clinic-email]', 'info@smile-clinic.sy')
    await page.fill('input[placeholder="مثال: تجميل وزراعة الأسنان — د. أحمد الخطيب"]', 'تجميل وزراعة الأسنان — د. أحمد الخطيب')
    const fc = page.waitForEvent('filechooser')
    await page.click('[data-qa=pick-logo]')
    await (await fc).setFiles({ name: 'logo.png', mimeType: 'image/png', buffer: await makeLogo(browser) })
    await page.waitForSelector('[data-qa=logo-box] img')
    ok(await page.locator('.st-savebar.dirty').count() === 1, 'clinic: save bar shows unsaved changes')
    await snap(page, 'd-ar-1c-clinic-dirty')
    await page.click('[data-qa=save]')
    await page.waitForSelector('.st-savebar:not(.dirty)')
    const c1 = await q(page, async () => window.__dentora.db.clinic.get('clinic'))
    ok(c1.email === 'info@smile-clinic.sy' && c1.tagline?.startsWith('تجميل') && c1.logo?.startsWith('data:image/png'), 'clinic: email, tagline and logo saved')
    ok(await page.locator('.app-sidebar .brand-logo img').count() === 1, 'clinic: sidebar shows the new logo')
    ok(await q(page, async () => (await window.__dentora.db.activity.toArray()).some(a => a.type === 'system' && a.action === 'update')), 'clinic: activity logged')

    // ---- preferences ----
    await tab(page, 'preferences')
    await snap(page, 'd-ar-2-preferences')
    await page.click('[data-font=cairo]')
    ok(await q(page, () => document.documentElement.dataset.font === 'cairo' && localStorage.getItem('dentora.font') === 'cairo'), 'font: Cairo applied and stored')
    await snap(page, 'd-ar-2b-font-cairo', { full: false })
    await page.click('[data-font=kufi]')
    await page.click('[data-theme-option=dark]')
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
    ok((await q(page, async () => (await window.__dentora.db.clinic.get('clinic')).theme)) === 'dark', 'theme: dark saved on the clinic')
    await snap(page, 'd-ar-2c-dark')
    await page.click('[data-theme-option=light]')
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
    await page.click('[data-lang=en]')
    await page.waitForFunction(() => document.documentElement.dir === 'ltr')
    ok((await q(page, async () => (await window.__dentora.db.clinic.get('clinic')).lang)) === 'en', 'language: English saved on the clinic')
    await page.click('[data-lang=ar]')
    await page.waitForFunction(() => document.documentElement.dir === 'rtl')
    // hours
    while (await page.locator('.st-day.active').count()) await page.locator('.st-day.active').first().click()
    await page.fill('[data-qa=work-end]', '08:00')
    await page.click('[data-qa=save-hours]')
    ok(await page.locator('.st-form .field-error').count() === 2, 'hours: no-day and end-before-start errors')
    await snap(page, 'd-ar-2d-hours-errors', { full: false })
    await page.locator('.st-day').nth(0).click()
    await page.locator('.st-day').nth(1).click()
    await page.fill('[data-qa=work-end]', '16:30')
    await page.click('[data-qa=save-hours]')
    await page.waitForTimeout(400)
    const c2 = await q(page, async () => window.__dentora.db.clinic.get('clinic'))
    ok(JSON.stringify(c2.workingDays) === '[0,6]' && c2.workEnd === '16:30', `hours saved (${c2.workingDays} ${c2.workEnd})`)
    await page.selectOption('[data-qa=lock-select]', '5')
    ok(await q(page, () => localStorage.getItem('dentora.lockAfter')) === '300000', 'auto-lock: 5 minutes stored in ms')
    ok((await page.textContent('[data-qa=lock-current]')).includes('5'), 'auto-lock: current value shown')
    await page.selectOption('[data-qa=lock-select]', '15')

    // ---- billing ----
    await q(page, async () => {
      const db = window.__dentora.db; const now = new Date().toISOString()
      await db.invoices.put({ id: 'inv-q1', number: 'SM-000009', patientId: 'x', date: '2026-10-01', items: [], subtotal: 0, discount: 0, taxPercent: 0, tax: 0, total: 0, paid: 0, status: 'unpaid', createdAt: now, updatedAt: now })
    })
    await tab(page, 'billing')
    await snap(page, 'd-ar-3-billing')
    await page.fill('[data-qa=tax]', '15')
    await page.fill('[data-qa=prefix]', 'sm-')
    await page.fill('[data-qa=next-invoice]', '9')
    await page.click('[data-qa=save]')
    ok((await page.locator('.field-error').allTextContents()).some(s => s.includes('9')), 'billing: next invoice must pass the last issued (9)')
    await snap(page, 'd-ar-3b-billing-errors')
    await page.fill('[data-qa=next-invoice]', '10')
    ok((await page.textContent('[data-qa=preview-number]')) === 'SM-000010', 'billing: preview shows SM-000010')
    await page.selectOption('[data-qa=currency]', 'custom')
    await page.fill('[data-qa=currency-code]', 'yer')
    await page.fill('[data-qa=currency-symbol]', 'ر.ي')
    ok((await page.textContent('[data-qa=preview-money]')).includes('ر.ي'), 'billing: preview uses the new symbol')
    await page.click('[data-qa=save]')
    await page.waitForSelector('.st-savebar:not(.dirty)')
    const c3 = await q(page, async () => window.__dentora.db.clinic.get('clinic'))
    ok(c3.taxPercent === 15 && c3.invoicePrefix === 'SM-' && c3.nextInvoiceNumber === 10 && c3.currency === 'YER' && c3.currencySymbol === 'ر.ي', 'billing: tax, prefix, counter, custom currency saved')
    await page.selectOption('[data-qa=currency]', 'USD')
    await page.fill('[data-qa=tax]', '0')
    await page.click('[data-qa=save]')
    await page.waitForSelector('.st-savebar:not(.dirty)')

    // ---- licence: trial → wrong codes → activate with the CLI code ----
    await tab(page, 'license')
    ok(await page.locator('.trial-bar').count() === 1, 'licence: trial bar visible during the trial')
    await snap(page, 'd-ar-5-license-trial')
    const device = (await page.textContent('[data-qa=device-number]')).trim()
    ok(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(device), `licence: device number shown (${device})`)
    await page.fill('[data-qa=code-input]', 'abcd-ef')
    ok((await page.inputValue('[data-qa=code-input]')) === 'ABCD-EF', 'licence: code input upper-cases and groups')
    await page.click('[data-qa=activate]')
    ok((await page.locator('.field-error').textContent()).includes('غير مكتمل'), 'licence: incomplete code → format error')
    await page.fill('[data-qa=code-input]', cli('ZZZZ-ZZZZ', 'pro', 'lifetime').toLowerCase())
    await page.click('[data-qa=activate]')
    await page.waitForSelector('.field-error')
    ok((await page.locator('.field-error').textContent()).includes('جهاز آخر'), 'licence: code of another device → device error')
    const expired = await makeCode(device, 'standard', new Date(Date.UTC(2026, 0, 20)))
    await page.fill('[data-qa=code-input]', expired)
    await page.click('[data-qa=activate]')
    await page.waitForTimeout(300)
    ok((await page.locator('.field-error').textContent()).includes('صلاحية'), 'licence: expired code → expired error')
    await snap(page, 'd-ar-5b-license-error', { full: false })
    const code = cli(device, 'pro', '1y')
    await page.fill('[data-qa=code-input]', code)
    await page.click('[data-qa=activate]')
    await page.waitForSelector('[data-qa=license-status][data-status=active]')
    ok(await page.locator('.trial-bar').count() === 0, 'licence: trial bar gone once active')
    ok((await q(page, async () => (await window.__dentora.db.settings.get('license'))?.value?.plan)) === 'pro', 'licence: stored plan is pro')
    await snap(page, 'd-ar-5c-license-active')
    await page.click('[data-qa=deactivate]')
    await page.click('.modal .btn-danger')
    await page.waitForSelector('[data-qa=license-status][data-status=trial]')
    ok(await page.locator('.trial-bar').count() === 1, 'licence: deactivate returns to the trial')
    // expired trial → read-only
    await q(page, async () => { await window.__dentora.db.settings.put({ key: 'installedAt', value: new Date(Date.now() - 30 * 86400000).toISOString() }) })
    await page.waitForSelector('[data-qa=license-status][data-status=expired]')
    await snap(page, 'd-ar-5d-license-expired')
    await tab(page, 'clinic')
    ok(await page.locator('[data-qa=clinic-name]').isDisabled(), 'read-only: clinic fields disabled when expired')
    await tab(page, 'backup')
    ok(await page.locator('[data-qa=export-backup]').isEnabled(), 'read-only: export still allowed')
    ok(await page.locator('[data-qa=choose-backup]').isDisabled(), 'read-only: restore disabled')
    await tab(page, 'license')
    await page.fill('[data-qa=code-input]', cli(device, 'standard', 'lifetime'))
    await page.click('[data-qa=activate]')
    await page.waitForSelector('[data-qa=license-status][data-status=active]')
    ok((await page.textContent('[data-qa=license-until]')).length > 0, 'licence: lifetime activation works from the expired state')
    await q(page, async () => { await window.__dentora.db.settings.put({ key: 'installedAt', value: new Date().toISOString() }) })

    // ---- about ----
    await tab(page, 'about')
    await snap(page, 'd-ar-6-about')

    // ---- backup: export → restore → demo → reset ----
    await tab(page, 'backup')
    await snap(page, 'd-ar-4-backup')
    const dl = page.waitForEvent('download')
    await page.click('[data-qa=export-backup]')
    const download = await dl
    ok(/^dentora-backup-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), `backup: file name ${download.suggestedFilename()}`)
    const backupPath = await download.path()
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
    ok(backup.app === 'dentora' && Array.isArray(backup.tables.patients) && backup.tables.clinic[0].name === 'عيادة الابتسامة لطب الأسنان', 'backup: JSON holds every table')
    await page.waitForFunction(async () => !!(await window.__dentora.db.settings.get('lastBackupAt')))
    ok(await q(page, async () => (await window.__dentora.db.activity.toArray()).some(a => a.type === 'system' && a.action === 'backup')), 'backup: activity logged')
    await page.waitForTimeout(300)
    await snap(page, 'd-ar-4b-backup-done', { full: false })
    // a bad file
    let chooser = page.waitForEvent('filechooser')
    await page.click('[data-qa=choose-backup]')
    await (await chooser).setFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
    await page.waitForSelector('[data-qa=restore-error]')
    ok((await page.textContent('[data-qa=restore-error]')).includes('Dentora'), 'restore: a foreign JSON is refused')
    // the real file, after adding a patient that the restore must remove
    await q(page, async () => { const now = new Date().toISOString(); await window.__dentora.db.patients.put({ id: 'p-temp', fileNo: 99, name: 'مريض مؤقت', gender: 'male', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: now, updatedAt: now }) })
    chooser = page.waitForEvent('filechooser')
    await page.click('[data-qa=choose-backup]')
    await (await chooser).setFiles(backupPath)
    await page.waitForSelector('[data-qa=restore-summary]')
    ok(await page.locator('[data-qa=confirm-danger]').isDisabled(), 'restore: confirm disabled until the word is typed')
    await page.fill('[data-qa=confirm-word]', 'استبد')
    ok(await page.locator('[data-qa=confirm-danger]').isDisabled(), 'restore: a partial word does not enable it')
    await page.fill('[data-qa=confirm-word]', 'استبدال')
    await snap(page, 'd-ar-4c-restore-confirm', { full: false })
    await page.click('[data-qa=confirm-danger]')
    await page.waitForEvent('load')
    await page.waitForFunction(() => window.__dentora?.db)
    await page.waitForTimeout(800)
    ok((await q(page, async () => window.__dentora.db.patients.get('p-temp'))) === undefined, 'restore: data replaced by the backup')
    ok((await q(page, async () => (await window.__dentora.db.settings.get('license'))?.value?.plan)) === 'standard', 'restore: this device keeps its activation')
    // demo data
    await page.goto(BASE + '/index.html#/settings/backup')
    await page.waitForSelector('[data-qa=load-demo]')
    await page.click('[data-qa=load-demo]')
    await page.click('.modal .btn-primary')
    await page.waitForSelector('[data-qa=demo-progress]')
    await shot(page, 'd-ar-4d-demo-progress')
    await page.waitForSelector('[data-qa=demo-progress]', { state: 'detached', timeout: 60000 })
    const n = await q(page, async () => window.__dentora.db.patients.count())
    ok(n >= 3, `demo: ${n} patients loaded`)
    await page.waitForSelector('[data-qa=demo-blocked]')
    ok(await page.locator('[data-qa=load-demo]').isDisabled(), 'demo: blocked once the clinic has patients')
    await snap(page, 'd-ar-4e-backup-with-data')
    // reset everything
    await page.click('[data-qa=reset-all]')
    await page.fill('[data-qa=confirm-word]', 'حذف')
    await snap(page, 'd-ar-4f-reset-confirm', { full: false })
    await page.click('[data-qa=confirm-danger]')
    await page.waitForEvent('load')
    await page.waitForFunction(() => window.__dentora?.db)
    await page.waitForTimeout(1200)
    ok(page.url().includes('#/setup'), `reset: the setup wizard opens (${page.url()})`)
    ok((await q(page, async () => window.__dentora.db.patients.count())) === 0, 'reset: patients erased')
    ok((await q(page, async () => (await window.__dentora.db.settings.get('license'))?.value?.plan)) === 'standard', 'reset: activation kept')
    ok((await q(page, () => localStorage.getItem('dentora.session'))) === null, 'reset: signed out')
    await browser.close()
  }

  // ======================= receptionist =======================
  {
    const { browser, page } = await open()
    await seedAndLogin(page)
    await q(page, () => localStorage.setItem('dentora.session', 'u-rec'))
    await page.goto(BASE + '/index.html#/settings/backup')
    await page.reload()
    await page.waitForSelector('[data-qa=tab-clinic]')
    ok(await page.locator('.st-nav [data-tab=backup]').count() === 0, 'receptionist: backup tab hidden (and /settings/backup redirects)')
    ok(await page.locator('[data-qa=clinic-name]').isDisabled(), 'receptionist: clinic fields read-only')
    ok(await page.locator('[data-qa=savebar]').count() === 0, 'receptionist: no save bar')
    await snap(page, 'd-ar-7-receptionist', { full: false })
    await browser.close()
  }

  // ======================= desktop · English =======================
  {
    const { browser, page } = await open({ lang: 'en' })
    await seedAndLogin(page, { lang: 'en' })
    for (const [i, id] of ['clinic', 'preferences', 'billing', 'backup', 'license', 'about'].entries()) {
      await tab(page, id)
      await snap(page, `d-en-${i + 1}-${id}`)
    }
    await browser.close()
  }

  // ======================= phone =======================
  for (const lang of ['ar', 'en']) {
    const { browser, page } = await open({ mobile: true, width: 390, height: 844, lang })
    await seedAndLogin(page, { lang })
    for (const [i, id] of ['clinic', 'preferences', 'billing', 'backup', 'license', 'about'].entries()) {
      await tab(page, id)
      await snap(page, `m-${lang}-${i + 1}-${id}`)
    }
    if (lang === 'ar') {
      await tab(page, 'clinic')
      await page.fill('[data-qa=clinic-phone]', '0933 555 777')
      await snap(page, 'm-ar-1b-clinic-dirty', { full: false })
      await tab(page, 'backup')
      await page.click('[data-qa=reset-all]')
      await snap(page, 'm-ar-4b-reset-modal', { full: false })
    }
    await browser.close()
  }

  // ======================= the seller's offline page =======================
  {
    const file = path.join(ROOT, 'dist-tools/code-generator.html')
    ok(fs.existsSync(file), 'generator: dist-tools/code-generator.html exists (npx vite build --config vite.tools.config.ts)')
    const { browser, page } = await open()
    await page.goto(pathToFileURL(file).href)
    await page.waitForFunction(() => window.__generatorReady)
    await snap(page, 'g-1-empty')
    await page.click('#make-btn')
    ok((await page.textContent('#device-err')).length > 0, 'generator: device number required')
    // the app gives the device number; the page makes the code; the app accepts it
    const app = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    app.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
    await seedAndLogin(app)
    await app.goto(BASE + '/index.html#/settings/license')
    await app.waitForSelector('[data-qa=device-number]')
    const device = (await app.textContent('[data-qa=device-number]')).trim()
    await page.fill('#device', device.toLowerCase().replace('-', ''))
    ok((await page.inputValue('#device')) === device, 'generator: device input formats as XXXX-XXXX')
    await page.selectOption('#plan', 'pro')
    await page.selectOption('#validity', 'lifetime')
    await page.fill('#note', 'عيادة الابتسامة — دمشق')
    await page.click('#make-btn')
    await page.waitForSelector('#result:not(.hidden)')
    const code = (await page.textContent('#code')).trim()
    ok(/^([2-9A-Z]{4}-){3}[2-9A-Z]{4}$/.test(code), `generator: code made (${code})`)
    ok((await page.inputValue('#message')).includes(code), 'generator: clinic message carries the code')
    await page.fill('#phone', '0944 123 456')
    ok((await page.getAttribute('#wa', 'href')).startsWith('https://wa.me/963944123456?text='), 'generator: WhatsApp link to the clinic')
    await page.click('#verify-btn')
    ok((await page.textContent('#verdict')).includes('رمز صالح'), 'generator: verify says valid')
    ok((await page.locator('#rows tr').count()) === 1, 'generator: code logged')
    const csv = page.waitForEvent('download')
    await page.click('#csv')
    const csvText = fs.readFileSync(await (await csv).path(), 'utf8')
    ok(csvText.includes(code) && csvText.includes('lifetime'), 'generator: CSV export holds the code')
    await snap(page, 'g-2-made')
    await app.fill('[data-qa=code-input]', code)
    await app.click('[data-qa=activate]')
    await app.waitForSelector('[data-qa=license-status][data-status=active]')
    ok(await app.locator('.trial-bar').count() === 0, 'generator → app: activation accepted, trial bar gone')
    ok((await app.evaluate(async () => (await window.__dentora.db.settings.get('license'))?.value)).plan === 'pro', 'generator → app: pro lifetime stored')
    await browser.close()
    const m = await open({ mobile: true, width: 390, height: 844 })
    await m.page.goto(pathToFileURL(file).href)
    await m.page.waitForFunction(() => window.__generatorReady)
    await snap(m.page, 'g-3-phone')
    await m.browser.close()
  }
} finally {
  server.kill()
}
ok(errors.length === 0, `no console errors (${errors.length})`)
if (errors.length) console.error(errors.slice(0, 20).join('\n'))
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed')
process.exit(failures ? 1 : 0)

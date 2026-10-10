// QA for the auth module (setup wizard, sign-in screen) and staff management: screenshots in desktop RTL / desktop EN / phone,
// real flows asserted on the database. Usage:
//   npx vite build --outDir /tmp/dist-auth && QA_DIST=/tmp/dist-auth QA_PORT=4308 QA_SHOTS=qa-shots/auth node scripts/qa/auth.mjs
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'

const errors = []
let failures = 0
function ok(cond, msg) { if (!cond) { failures++; console.error('FAIL:', msg) } else console.log('ok  ', msg) }
async function open(opts = {}) {
  const b = await openBrowser(opts)
  b.page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  b.page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  return b
}
async function snap(page, name, opts) {
  await page.waitForTimeout(450)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(over <= 0, `${name}: no horizontal overflow (${over})`)
  await shot(page, name, opts)
}
const db = (page, fn, arg) => page.evaluate(fn, arg)
const next = page => page.click('[data-qa=next]')
const stepIs = async (page, key) => { await page.waitForSelector(`.au-step[data-step=${key}]`); await page.waitForTimeout(350) }
const toastText = async page => (await page.locator('.toast').last().textContent({ timeout: 4000 }).catch(() => '')) || ''

async function freshSetup(page) {
  await page.goto(BASE + '/index.html#/setup')
  await page.waitForFunction(() => window.__dentora?.db)
  await page.evaluate(async () => { const d = window.__dentora.db; await Promise.all(d.tables.map(t => t.clear())); localStorage.clear() })
  await page.reload()
  await page.waitForSelector('.au-setup')
}

const server = await startServer()
try {
  // ============ SETUP WIZARD — desktop Arabic, full flow ============
  {
    const { browser, page } = await open()
    await freshSetup(page)
    await stepIs(page, 'language')
    ok(await page.evaluate(() => document.documentElement.dir) === 'rtl', 'setup starts in RTL Arabic')
    await snap(page, 'setup-1-language-ar')
    const logo = await page.locator('.au-brand-mark').screenshot()

    await next(page); await stepIs(page, 'clinic')
    await next(page)
    ok(await page.locator('.field-error').count() === 1, 'clinic step: name required error')
    await page.fill('input[name=clinicPhone]', '12')
    await page.fill('input[name=clinicEmail]', 'clinic@')
    await next(page)
    ok(await page.locator('.field-error').count() === 3, 'clinic step: name + phone + email errors')
    await snap(page, 'setup-2-clinic-errors')
    await page.fill('input[name=clinicName]', 'عيادة النخبة لطب الأسنان')
    await page.fill('input[name=clinicPhone]', '011 234 5678')
    await page.fill('input[name=clinicEmail]', 'elite@clinic.sy')
    await page.fill('input[name=clinicAddress]', 'دمشق — أبو رمانة، شارع الجلاء')
    const fc = page.waitForEvent('filechooser')
    await page.click('.au-logo-actions button')
    await (await fc).setFiles({ name: 'logo.png', mimeType: 'image/png', buffer: logo })
    await page.waitForSelector('.au-logo-preview img')
    await snap(page, 'setup-2-clinic-filled')
    await page.press('input[name=clinicAddress]', 'Enter')          // Enter advances
    await stepIs(page, 'money')

    ok(await page.inputValue('select[name=currency]') === 'USD', 'money: USD by default')
    await page.selectOption('select[name=currency]', 'SYP')
    ok(await page.locator('.au-dec .segmented button.active').textContent().then(s => s.includes('1,250') && !s.includes('.00')), 'money: SYP switches decimals to none')
    await page.selectOption('select[name=currency]', 'custom')
    await next(page)
    ok(await page.locator('.field-error').count() === 2, 'money: custom currency needs code and symbol')
    await page.fill('input[name=customCode]', 'y')
    await next(page)
    ok((await page.locator('.field-error').first().textContent()).length > 3, 'money: short code rejected')
    await page.selectOption('select[name=currency]', 'SAR')
    await page.locator('.au-days .chip').nth(6).click()               // Friday on
    await page.fill('input[name=workStart]', '10:00')
    await page.fill('input[name=workEnd]', '09:00')
    await next(page)
    ok(await page.locator('.field-error').count() === 1, 'money: closing before opening rejected')
    await snap(page, 'setup-3-money-error')
    await page.fill('input[name=workEnd]', '20:00')
    await page.selectOption('select[name=slot]', '20')
    await page.fill('input[name=tax]', '5')
    await snap(page, 'setup-3-money-ar')
    await next(page); await stepIs(page, 'owner')

    await next(page)
    ok(await page.locator('.field-error').count() >= 2, 'owner: name and PIN required')
    await page.fill('input[name=ownerName]', 'سامر العلي')
    await page.fill('input[name=ownerSpecialty]', 'زراعة وتجميل الأسنان')
    await page.fill('input[name=ownerPhone]', '0933 555 777')
    await page.fill('#owner-pin', '12')
    await next(page)
    ok((await page.locator('.field-error').allTextContents()).some(s => s.includes('4')), 'owner: short PIN rejected')
    await page.fill('#owner-pin', '١٣٥٧')                              // Arabic-Indic digits are converted
    ok(await page.inputValue('#owner-pin') === '1357', 'owner: Arabic-Indic PIN digits converted')
    await page.fill('#owner-pin2', '1358')
    await next(page)
    ok((await page.locator('.field-error').allTextContents()).length === 1, 'owner: PIN mismatch error')
    await snap(page, 'setup-4-owner-error')
    await page.fill('#owner-pin2', '1357')
    await snap(page, 'setup-4-owner-ar')
    await next(page); await stepIs(page, 'review')
    await snap(page, 'setup-5-review-ar')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await snap(page, 'setup-5-review-ar-bottom')

    // stepper jumps back to a done step and forward again
    await page.locator('.au-steps li').nth(1).locator('button').click(); await stepIs(page, 'clinic')
    ok(await page.inputValue('input[name=clinicName]') === 'عيادة النخبة لطب الأسنان', 'stepper: values kept when going back')
    await page.locator('.au-steps li').nth(4).locator('button').click(); await stepIs(page, 'review')

    await next(page)
    await page.waitForSelector('.app-sidebar', { timeout: 15000 })
    await page.waitForTimeout(600)
    ok(await page.evaluate(() => location.hash) === '#/', 'setup: lands on the dashboard, signed in')
    const state = await db(page, async () => {
      const d = window.__dentora.db
      return { clinic: await d.clinic.get('clinic'), users: await d.users.toArray(), act: await d.activity.toArray(), session: localStorage.getItem('dentora.session') }
    })
    ok(state.clinic.setupDone === true && state.clinic.name === 'عيادة النخبة لطب الأسنان', 'db: clinic saved with setupDone')
    ok(state.clinic.currency === 'SAR' && state.clinic.currencySymbol === 'ر.س' && state.clinic.currencyDecimals === 2, 'db: currency SAR / ر.س / 2')
    ok(JSON.stringify(state.clinic.workingDays) === '[0,1,2,3,4,5,6]' && state.clinic.workStart === '10:00' && state.clinic.workEnd === '20:00' && state.clinic.slotMinutes === 20 && state.clinic.taxPercent === 5, 'db: hours, slot and tax')
    ok(state.clinic.lang === 'ar' && state.clinic.logo?.startsWith('data:image/'), 'db: language and logo')
    ok(state.users.length === 1 && state.users[0].role === 'admin' && state.users[0].name === 'سامر العلي' && state.users[0].title === 'د.' && state.users[0].active && state.users[0].color === '#0E8F86', 'db: owner admin created')
    ok(state.session === state.users[0].id, 'session: owner signed in')
    ok(state.act.some(a => a.type === 'system' && a.action === 'login' && a.by === state.users[0].id), 'db: login logged')
    await snap(page, 'setup-6-dashboard-after')
    await browser.close()
  }

  // ============ SETUP WIZARD — English ============
  {
    const { browser, page } = await open({ lang: 'en' })
    await freshSetup(page)
    await page.click('.au-lang-card[data-lang=en]')
    await page.waitForTimeout(300)
    ok(await page.evaluate(() => document.documentElement.dir) === 'ltr', 'setup: choosing English switches to LTR at once')
    await snap(page, 'setup-1-language-en')
    await next(page); await stepIs(page, 'clinic')
    await page.fill('input[name=clinicName]', 'Bright Smile Dental')
    await snap(page, 'setup-2-clinic-en')
    await next(page); await stepIs(page, 'money')
    await snap(page, 'setup-3-money-en')
    await next(page); await stepIs(page, 'owner')
    ok(await page.inputValue('select[name=ownerTitle]') === 'Dr.', 'owner: title follows the language (Dr.)')
    await page.fill('input[name=ownerName]', 'Omar Haddad')
    await page.fill('#owner-pin', '246810')
    await page.fill('#owner-pin2', '246810')
    await snap(page, 'setup-4-owner-en')
    await next(page); await stepIs(page, 'review')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await snap(page, 'setup-5-review-en')
    await next(page)
    await page.waitForSelector('.app-sidebar', { timeout: 15000 })
    const c = await db(page, () => window.__dentora.db.clinic.get('clinic'))
    ok(c.lang === 'en' && c.currency === 'USD' && c.currencyDecimals === 2, 'db: English clinic with USD')
    await browser.close()
  }

  // ============ SETUP WIZARD — phone ============
  {
    const { browser, page } = await open({ mobile: true, width: 390, height: 844 })
    await freshSetup(page)
    await stepIs(page, 'language')
    await snap(page, 'setup-1-language-phone')
    await next(page); await stepIs(page, 'clinic')
    await page.fill('input[name=clinicName]', 'عيادة الابتسامة')
    await snap(page, 'setup-2-clinic-phone')
    await next(page); await stepIs(page, 'money')
    await snap(page, 'setup-3-money-phone', { full: true })
    await next(page); await stepIs(page, 'owner')
    await next(page)
    await snap(page, 'setup-4-owner-phone-errors', { full: true })
    await page.fill('input[name=ownerName]', 'ريم الأحمد')
    await page.fill('#owner-pin', '1234'); await page.fill('#owner-pin2', '1234')
    await next(page); await stepIs(page, 'review')
    await snap(page, 'setup-5-review-phone', { full: true })
    const btn = await page.locator('[data-qa=next]').boundingBox()
    ok(btn && btn.height >= 40, 'phone: footer buttons are touch-sized')
    await browser.close()
  }

  // ============ RESTORE FROM BACKUP on a fresh install ============
  {
    const { browser, page } = await open()
    await freshSetup(page)
    const fc1 = page.waitForEvent('filechooser')
    await page.click('[data-qa=restore]')
    await (await fc1).setFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
    const bad = await toastText(page)
    ok(bad.includes('ليس نسخة احتياطية'), `restore: a non-backup file is refused (${bad})`)
    await snap(page, 'setup-restore-invalid')
    const now = new Date().toISOString()
    const backup = { app: 'dentora', version: 1, exportedAt: now, tables: {
      clinic: [{ id: 'clinic', name: 'عيادة مستعادة', currency: 'USD', currencySymbol: '$', currencyDecimals: 2, lang: 'ar', theme: 'light', workingDays: [0, 1, 2, 3, 4, 6], workStart: '09:00', workEnd: '17:00', slotMinutes: 30, defaultAppointmentMinutes: 30, taxPercent: 0, invoicePrefix: 'INV-', nextInvoiceNumber: 1, nextFileNumber: 1, setupDone: true, createdAt: now, updatedAt: now }],
      users: [{ id: 'r-admin', name: 'مدير مستعاد', role: 'admin', pinHash: 'x', pinSalt: 'y', color: '#2563EB', active: true, createdAt: now, updatedAt: now }],
    } }
    const fc2 = page.waitForEvent('filechooser')
    await page.click('[data-qa=restore]')
    await (await fc2).setFiles({ name: 'dentora-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
    await page.waitForTimeout(2500)
    await page.waitForSelector('.au-login-card', { timeout: 10000 })
    ok((await page.textContent('.au-clinic-name')) === 'عيادة مستعادة', 'restore: the restored clinic opens on its sign-in screen')
    ok(await db(page, () => window.__dentora.db.users.count()) === 1, 'restore: users replaced by the backup')
    await browser.close()
  }

  // ============ SIGN-IN SCREEN — desktop Arabic ============
  {
    const { browser, page } = await open()
    await seedAndLogin(page)
    await page.evaluate(() => { localStorage.removeItem('dentora.session'); localStorage.removeItem('dentora.lastUser'); localStorage.removeItem('dentora.loginGuard') })
    await page.reload(); await page.waitForSelector('.au-login-card')
    ok(await page.locator('.user-pick .au-tile').count() === 3, 'login: three user tiles')
    await snap(page, 'login-1-users-ar')
    await page.click('.au-tile[data-user=u-admin]')
    await page.waitForSelector('.pin-pad')
    const foot = await page.locator('.au-login-foot').boundingBox()
    ok(foot && foot.y + foot.height <= 900, `login: the whole sign-in screen fits a 1440×900 window (${foot && Math.round(foot.y + foot.height)})`)
    await snap(page, 'login-2-pin-ar')
    await page.keyboard.type('9999'); await page.keyboard.press('Enter')
    await page.waitForSelector('.au-err')
    ok(await page.locator('.pin-dots.au-shake').count() === 1, 'login: dots shake after a wrong PIN')
    await page.waitForTimeout(120)
    await shot(page, 'login-3-wrong-ar')
    for (let i = 0; i < 3; i++) { await page.keyboard.type('1111'); await page.keyboard.press('Enter'); await page.waitForTimeout(200) }
    ok((await page.textContent('.au-pin-msg')).includes('محاولة واحدة'), 'login: warns when one attempt is left')
    await page.keyboard.type('2222'); await page.keyboard.press('Enter')
    await page.waitForSelector('.au-lock')
    ok(await page.locator('.au-pad button:disabled').count() === 12, 'login: pad locked after 5 failures')
    const g = await page.evaluate(() => JSON.parse(localStorage.getItem('dentora.loginGuard')))
    ok(g.fails === 5 && g.until - Date.now() > 25000 && g.until - Date.now() <= 30000, 'login: 30 s lock stored')
    await page.keyboard.type('1234'); await page.keyboard.press('Enter'); await page.waitForTimeout(300)
    ok(await page.evaluate(() => !localStorage.getItem('dentora.session')), 'login: typing is ignored while locked')
    await snap(page, 'login-4-locked-ar')
    // the lock survives a reload, then expires
    await page.evaluate(() => localStorage.setItem('dentora.loginGuard', JSON.stringify({ fails: 5, until: Date.now() + 1500 })))
    await page.reload(); await page.waitForSelector('.au-tile')
    await page.click('.au-tile[data-user=u-admin]')
    ok(await page.locator('.au-lock').count() === 1, 'login: lock survives a reload')
    await page.waitForTimeout(2000)
    ok(await page.locator('.au-lock').count() === 0 && await page.locator('.au-pad button:disabled').count() === 0, 'login: pad unlocks when the time is up')
    // forgot PIN hint
    await page.click('.au-forgot')
    await snap(page, 'login-5-forgot-ar')
    // pad + submit button
    for (const d of ['1', '2', '3']) await page.click(`.au-pad button:text-is("${d}")`)
    ok(await page.locator('[data-qa=submit]').isDisabled(), 'login: submit disabled under 4 digits')
    await page.click('.au-pad .au-key-back'); await page.click('.au-pad button:text-is("3")'); await page.click('.au-pad button:text-is("4")')
    await page.click('[data-qa=submit]')
    await page.waitForSelector('.app-sidebar')
    ok(await page.evaluate(() => localStorage.getItem('dentora.session')) === 'u-admin', 'login: correct PIN signs in')
    ok(await page.evaluate(() => localStorage.getItem('dentora.lastUser')) === 'u-admin' && await page.evaluate(() => !localStorage.getItem('dentora.loginGuard')), 'login: remembers the user, clears the guard')
    const logins = await db(page, () => window.__dentora.db.activity.filter(a => a.action === 'login' && a.by === 'u-admin').count())
    ok(logins >= 1, 'db: sign-in logged')
    // lock screen: the remembered user goes straight to the PIN
    await page.goto(BASE + '/index.html#/patients')
    await page.evaluate(() => localStorage.removeItem('dentora.session')); await page.reload()
    await page.waitForSelector('.pin-pad')
    ok(await page.locator('.au-pin-name').textContent().then(s => s.includes('أحمد')), 'login: remembered user preselected')
    await snap(page, 'login-6-remembered-ar')
    await page.click('[data-qa=change-user]')
    ok(await page.locator('.au-tile.au-last').count() === 1, 'login: change user returns to the tiles, last user highlighted')
    await page.click('.au-tile[data-user=u-rec]')
    await page.keyboard.type('1234'); await page.keyboard.press('Enter')
    await page.waitForSelector('.app-sidebar')
    ok(await page.evaluate(() => location.hash) === '#/patients', 'login: returns to the page that was locked')
    await browser.close()
  }

  // ============ SIGN-IN — English + phone, 6-digit auto submit ============
  {
    const { browser, page } = await open({ lang: 'en' })
    await seedAndLogin(page, { lang: 'en' })
    await page.evaluate(() => { localStorage.removeItem('dentora.session'); localStorage.removeItem('dentora.lastUser') })
    await page.reload(); await page.waitForSelector('.au-tile')
    await snap(page, 'login-1-users-en')
    await page.click('.au-tile[data-user=u-doc2]')
    await snap(page, 'login-2-pin-en')
    await browser.close()
  }
  {
    const { browser, page } = await open({ mobile: true, width: 390, height: 844 })
    await seedAndLogin(page)
    // give the doctor a 6-digit PIN
    await page.evaluate(async () => {
      const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('')
      await window.__dentora.db.users.update('u-doc2', { pinSalt: 's6', pinHash: await sha('s6:135790') })
      localStorage.removeItem('dentora.session'); localStorage.removeItem('dentora.lastUser')
    })
    await page.reload(); await page.waitForSelector('.au-tile')
    await snap(page, 'login-1-users-phone')
    await page.click('.au-tile[data-user=u-doc2]')
    const pfoot = await page.locator('[data-qa=submit]').boundingBox()
    ok(pfoot && pfoot.y + pfoot.height <= 844, `phone: keypad and sign-in button visible without scrolling (${pfoot && Math.round(pfoot.y + pfoot.height)})`)
    await snap(page, 'login-2-pin-phone')
    const key = await page.locator('.au-pad button').first().boundingBox()
    ok(key.height >= 48 && key.width >= 60, 'phone: keypad keys are large touch targets')
    for (const d of '13579') await page.tap(`.au-pad button:text-is("${d}")`)
    await snap(page, 'login-3-typing-phone')
    await page.tap('.au-pad button:text-is("0")')                    // 6th digit submits by itself
    await page.waitForSelector('.app-bottomnav', { timeout: 5000 })
    ok(await page.evaluate(() => localStorage.getItem('dentora.session')) === 'u-doc2', 'phone: 6-digit PIN signs in automatically')
    await browser.close()
  }

  // ============ STAFF — desktop Arabic, full CRUD ============
  {
    const { browser, page } = await open()
    await seedAndLogin(page)
    await page.evaluate(async () => {
      const d = window.__dentora.db; const now = Date.now()
      const rows = [['u-admin', 5], ['u-doc2', 90], ['u-rec', 60 * 26], ['u-admin', 60 * 27], ['u-doc2', 60 * 50]]
      await d.activity.bulkAdd(rows.map(([by, min], i) => ({ id: 'qa-login-' + i, type: 'system', action: 'login', message: by, by, at: new Date(now - min * 60000).toISOString() })))
      await d.users.update('u-doc2', { phone: '0944 222 333', email: 'layla@clinic.sy' })
      await d.users.update('u-rec', { phone: '0955 111 000' })
    })
    await page.goto(BASE + '/index.html#/staff')
    await page.waitForSelector('[data-qa=staff-grid]')
    ok(await page.locator('.au-member').count() === 3, 'staff: three members listed')
    await snap(page, 'staff-1-list-ar')
    await snap(page, 'staff-1-list-ar-full', { full: true })

    // add with validation
    await page.click('[data-qa=add-member]')
    await page.waitForSelector('#au-staff-form')
    await snap(page, 'staff-2-add-empty')
    await page.click('[data-qa=save-member]')
    ok(await page.locator('#au-staff-form .field-error').count() >= 2, 'staff add: name and PIN required')
    await page.fill('#au-staff-form input[name=name]', 'سارة يوسف')
    await page.click('[data-qa=save-member]')
    ok((await page.locator('#au-staff-form .field-error').allTextContents()).some(s => s.includes('بهذا الاسم')), 'staff add: duplicate name rejected')
    await page.fill('#au-staff-form input[name=name]', 'نور الحسن')
    await page.selectOption('#au-staff-form select[name=role]', 'assistant')
    ok((await page.textContent('[data-qa=role-box]')).includes('المخزون'), 'staff add: role description follows the role')
    await page.fill('#au-staff-form input[name=specialty]', 'مساعدة طبيب أسنان')
    await page.fill('#au-staff-form input[name=phone]', '0988 777 666')
    await page.locator('.au-color').nth(3).click()
    await page.fill('#staff-pin', '4321'); await page.fill('#staff-pin2', '4320')
    await page.click('[data-qa=save-member]')
    ok(await page.locator('#au-staff-form .field-error').count() === 1, 'staff add: PIN mismatch')
    await snap(page, 'staff-3-add-filled-error')
    await page.fill('#staff-pin2', '4321')
    await page.press('#staff-pin2', 'Enter')
    await page.waitForSelector('#au-staff-form', { state: 'detached' })
    const added = await db(page, () => window.__dentora.db.users.filter(u => u.name === 'نور الحسن').first())
    ok(added && added.role === 'assistant' && added.color === '#DB2777' && added.active && added.phone === '0988 777 666', `db: member added with role, colour and phone ${JSON.stringify(added && { role: added.role, color: added.color, active: added.active, phone: added.phone })}`)
    const pinOk = await page.evaluate(async u => {
      const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('')
      return (await sha(`${u.pinSalt}:4321`)) === u.pinHash
    }, added)
    ok(pinOk, 'db: new member PIN hashed with its salt')
    ok(await page.locator('.au-member').count() === 4, 'staff: list shows the new member')

    // edit
    const card = page.locator(`.au-member[data-user="${added.id}"]`)
    await card.locator('[data-qa=member-menu]').click()
    await snap(page, 'staff-4-menu')
    await page.click('.menu .menu-item:has-text("تعديل")')
    await page.waitForSelector('#au-staff-form')
    await page.selectOption('#au-staff-form select[name=role]', 'receptionist')
    await page.fill('#au-staff-form input[name=specialty]', 'استقبال ومواعيد')
    await snap(page, 'staff-5-edit')
    await page.click('[data-qa=save-member]')
    await page.waitForSelector('#au-staff-form', { state: 'detached' })
    const edited = await db(page, id => window.__dentora.db.users.get(id), added.id)
    ok(edited.role === 'receptionist' && edited.specialty === 'استقبال ومواعيد' && edited.pinHash === added.pinHash, 'db: member edited, PIN untouched')

    // reset PIN
    await card.locator('[data-qa=member-menu]').click()
    await page.click('.menu .menu-item:has-text("رمز دخول جديد")')
    await page.waitForSelector('#au-reset-form')
    await page.click('[data-qa=save-pin]')
    ok(await page.locator('#au-reset-form .field-error').count() >= 1, 'reset PIN: required')
    await page.fill('#reset-pin', '8642'); await page.fill('#reset-pin2', '8642')
    await snap(page, 'staff-6-reset-pin')
    await page.click('[data-qa=save-pin]')
    await page.waitForSelector('#au-reset-form', { state: 'detached' })
    const reset = await db(page, id => window.__dentora.db.users.get(id), added.id)
    ok(reset.pinHash !== added.pinHash && reset.pinSalt !== added.pinSalt, 'db: PIN reset with a new salt')

    // deactivate / filters
    await card.locator('.au-member-foot .switch .track').click()
    await page.waitForTimeout(300)
    ok((await db(page, id => window.__dentora.db.users.get(id), added.id)).active === false, 'db: member deactivated from the card switch')
    await page.locator('.au-staff-toolbar .segmented button').nth(2).click()
    ok(await page.locator('.au-member').count() === 1, 'staff: inactive filter')
    await snap(page, 'staff-7-inactive-filter')
    await page.locator('.au-staff-toolbar .segmented button').nth(0).click()

    // guards
    const self = page.locator('.au-member[data-user="u-admin"]')
    ok(await self.locator('[data-qa=active-switch]').isDisabled(), 'guard: own switch disabled')
    await self.locator('[data-qa=member-menu]').click()
    ok(await page.locator('.menu .menu-item:has-text("حذف العضو")').isDisabled(), 'guard: cannot delete yourself')
    await page.click('.menu .menu-item:has-text("تعديل")')
    await page.selectOption('#au-staff-form select[name=role]', 'doctor')
    await page.click('[data-qa=save-member]')
    const guardMsg = await toastText(page)
    ok(guardMsg.includes('آخر مدير'), `guard: last admin cannot change role (${guardMsg})`)
    await snap(page, 'staff-8-last-admin-guard')
    ok((await db(page, () => window.__dentora.db.users.get('u-admin'))).role === 'admin', 'db: admin role unchanged')
    await page.keyboard.press('Escape')

    // delete (with linked history warning)
    await page.evaluate(async () => { const n = new Date().toISOString(); await window.__dentora.db.appointments.add({ id: 'qa-apt', patientId: 'p', doctorId: 'u-doc2', date: n.slice(0, 10), start: n, end: n, durationMin: 30, type: 'checkup', status: 'scheduled', createdAt: n, updatedAt: n }) })
    await page.locator('.au-member[data-user="u-doc2"] [data-qa=member-menu]').click()
    await page.click('.menu .menu-item:has-text("حذف العضو")')
    await page.waitForSelector('.modal:has-text("حذف")')
    ok((await page.textContent('.modal-body')).includes('1 من السجلات'), 'delete: warns about linked records')
    await snap(page, 'staff-9-delete-confirm')
    await page.click('.modal-footer .btn-danger')
    await page.waitForTimeout(400)
    ok(!(await db(page, () => window.__dentora.db.users.get('u-doc2'))), 'db: member deleted')
    const acts = await db(page, () => window.__dentora.db.activity.filter(a => a.type === 'system' && ['create', 'update', 'status', 'delete'].includes(a.action)).count())
    ok(acts >= 5, `db: staff changes logged (${acts})`)
    await snap(page, 'staff-10-after-delete', { full: true })
    await browser.close()
  }

  // ============ STAFF — English, phone, no permission, read-only ============
  {
    const { browser, page } = await open({ lang: 'en' })
    await seedAndLogin(page, { lang: 'en' })
    await page.goto(BASE + '/index.html#/staff'); await page.waitForSelector('[data-qa=staff-grid]')
    await snap(page, 'staff-1-list-en')
    await page.click('[data-qa=add-member]'); await page.waitForSelector('#au-staff-form')
    await snap(page, 'staff-2-add-en')
    await browser.close()
  }
  {
    const { browser, page } = await open({ mobile: true, width: 390, height: 844 })
    await seedAndLogin(page)
    await page.goto(BASE + '/index.html#/staff'); await page.waitForSelector('[data-qa=staff-grid]')
    await snap(page, 'staff-1-list-phone')
    await snap(page, 'staff-1-list-phone-full', { full: true })
    await page.click('[data-qa=add-member]'); await page.waitForSelector('#au-staff-form')
    await snap(page, 'staff-2-add-phone')
    await page.locator('.modal-body').evaluate(el => el.scrollTo(0, el.scrollHeight))
    await snap(page, 'staff-2-add-phone-bottom')
    await page.keyboard.press('Escape')
    // receptionist sees the no-permission state
    await page.evaluate(() => localStorage.setItem('dentora.session', 'u-rec')); await page.reload()
    await page.goto(BASE + '/index.html#/staff'); await page.waitForTimeout(600)
    ok(await page.locator('.empty-title').count() === 1 && await page.locator('[data-qa=staff-grid]').count() === 0, 'staff: receptionist gets the no-permission state')
    await snap(page, 'staff-11-no-permission-phone')
    await browser.close()
  }
  {
    const { browser, page } = await open()
    await seedAndLogin(page)
    await page.evaluate(async () => { await window.__dentora.db.settings.put({ key: 'installedAt', value: new Date(Date.now() - 40 * 86400000).toISOString() }); await window.__dentora.db.settings.delete('license') })
    await page.goto(BASE + '/index.html#/staff'); await page.waitForSelector('[data-qa=staff-grid]'); await page.waitForTimeout(800)
    ok(await page.locator('[data-qa=add-member]').isDisabled(), 'read-only: add disabled when the trial has ended')
    ok(await page.locator('[data-qa=active-switch]').first().isDisabled(), 'read-only: switches disabled')
    await snap(page, 'staff-12-readonly')
    await browser.close()
  }
} finally {
  server.kill()
}
console.log(`\n${failures} failed checks, ${errors.length} console/page errors`)
for (const e of errors) console.log('  ', e)
process.exit(failures || errors.length ? 1 : 0)

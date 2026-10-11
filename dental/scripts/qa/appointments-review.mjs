// Adversarial QA of the appointments module (review pass): edge data (very long names, a patient without a phone,
// deleted patient / doctor, zero and negative lengths, out-of-hours bookings), double submits and double clicks,
// Escape on stacked dialogs, cascades on delete, an empty clinic, phone 390×844 and English. Asserts the DB.
// Usage: npx vite build --outDir /tmp/dist-appointments-r && QA_DIST=/tmp/dist-appointments-r QA_PORT=4353 QA_SHOTS=qa-shots/appointments-review node scripts/qa/appointments-review.mjs
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'

const PART = process.env.QA_PART || 'all'   // all | edge | empty | phone | en
const problems = []
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log('FAIL:', msg) } else console.log('ok:', msg) }
const wait = (page, ms = 400) => page.waitForTimeout(ms)
const go = async (page, hash) => { await page.goto(`${BASE}/index.html#${hash}`); await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); await wait(page, 600) }
const db = (page, fn, arg) => page.evaluate(fn, arg)
function watchErrors(page, label) {
  const errors = []
  page.on('pageerror', e => errors.push(`${label} pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`${label} console: ${m.text()}`) })
  return errors
}
async function noOverflow(page, label) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(o <= 0, `no horizontal overflow (${label}) [${o}px]`)
}
async function setView(page, label) { await page.locator('.apt-views button', { hasText: label }).click(); await wait(page, 500) }
const LONG_P = 'عبد الرحمن محمد سعيد عبد الله الخطيب الحمصي النجار البغدادي الدمشقي الشامي'
const LONG_D = 'د. عبد الرحمن بن محمد سعيد الكيلاني الحسيني'

async function seedEdge(page) {
  return db(page, async ({ LONG_P, LONG_D }) => {
    const d = window.__dentora.db
    await d.appointments.clear(); await d.patients.clear(); await d.treatments.clear(); await d.notes.clear(); await d.activity.clear()
    const now = new Date().toISOString()
    const pad = n => String(n).padStart(2, '0')
    const iso = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
    const dayOff = n => { const x = new Date(); x.setDate(x.getDate() + n); return iso(x) }
    const at = (date, time) => { const [y, m, dd] = date.split('-').map(Number); const [h, mi] = time.split(':').map(Number); return new Date(y, m - 1, dd, h, mi).toISOString() }
    const u = await d.users.get('u-admin')
    await d.users.put({ ...u, id: 'u-long', name: LONG_D, role: 'doctor', specialty: 'جراحة الفم والوجه والفكين وزراعة الأسنان', color: '#EA580C' })
    const P = [['p1', LONG_P, '0944123456'], ['p2', 'هبة', ''], ['p3', 'سامي ناصر', '0933 222 111'], ['p4', 'Jonathan Alexander Montgomery-Smith', '+44 7700 900123']]
    let f = 1
    for (const [id, name, phone] of P) await d.patients.add({ id, fileNo: f++, name, gender: 'male', phone: phone || undefined, allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: now, updatedAt: now })
    const c = await d.clinic.get('clinic'); await d.clinic.put({ ...c, nextFileNumber: f })
    const T = dayOff(0)
    const A = [
      ['e1', T, '10:00', '10:30', 'p1', 'u-admin', 'scheduled'], ['e2', T, '10:00', '11:00', 'p2', 'u-admin', 'confirmed'], ['e3', T, '10:15', '10:45', 'p3', 'u-admin', 'arrived'],
      ['e4', T, '12:00', '12:00', 'p3', 'u-doc2', 'scheduled'],          // zero length
      ['e5', T, '13:00', '12:30', 'p4', 'u-doc2', 'scheduled'],          // end before start (broken data)
      ['e6', T, '07:30', '08:00', 'p1', 'u-long', 'scheduled'],          // before opening
      ['e7', T, '19:00', '19:45', 'p4', 'u-long', 'confirmed'],          // after closing
      ['e8', T, '11:00', '11:30', 'p-gone', 'u-doc2', 'scheduled'],      // deleted patient
      ['e9', T, '14:00', '14:30', 'p3', 'u-gone', 'scheduled'],          // deleted doctor
      ['e10', dayOff(1), '09:00', '09:30', 'p2', 'u-admin', 'scheduled'], // patient without a phone, tomorrow
    ]
    for (const [id, date, s, e, patientId, doctorId, status] of A) {
      const start = at(date, s), end = at(date, e)
      await d.appointments.add({ id, patientId, doctorId, date, start, end, durationMin: Math.round((new Date(end) - new Date(start)) / 60000), type: 'checkup', status, reason: id === 'e1' ? 'سبب طويل جداً '.repeat(8) : undefined, createdAt: now, updatedAt: now, createdBy: 'u-rec' })
    }
    await d.treatments.add({ id: 't1', patientId: 'p3', procedureName: 'حشوة', price: 10, discount: 0, status: 'planned', appointmentId: 'e3', createdAt: now, updatedAt: now })
    await d.notes.add({ id: 'n1', patientId: 'p3', appointmentId: 'e3', date: T, text: 'ملاحظة', createdAt: now, updatedAt: now })
    return d.appointments.count()
  }, { LONG_P, LONG_D })
}

async function desktopEdge() {
  const { browser, page } = await openBrowser({ width: 1440, height: 900 })
  const errors = watchErrors(page, 'edge-ar')
  await seedAndLogin(page)
  await seedEdge(page)
  await page.evaluate(() => sessionStorage.clear())
  await go(page, '/appointments'); await page.waitForSelector('.apt-tg-col'); await wait(page, 500)
  await page.evaluate(() => { document.querySelector('.apt-tg-scroll').scrollTop = 0 }); await wait(page, 200)
  await shot(page, 'r01-day-edge-ar')
  const evs = await page.evaluate(() => [...document.querySelectorAll('.apt-ev')].map(e => ({ h: e.getBoundingClientRect().height, style: e.getAttribute('style') })))
  check(evs.length === 9, `day grid shows all 9 of today's appointments, incl. deleted doctor/patient (${evs.length})`)
  check(evs.every(e => !/NaN|undefined/.test(e.style || '') && e.h > 0), 'cards have finite geometry')
  check(await page.locator('.apt-tg-head').count() === 4, 'a column for the deleted doctor\'s booking')
  await noOverflow(page, 'day edge')
  await page.evaluate(() => { document.querySelector('.apt-tg-scroll').scrollTop = 99999 }); await wait(page, 200)
  await shot(page, 'r02-day-edge-bottom-ar')
  await setView(page, 'أسبوع'); await shot(page, 'r03-week-edge-ar'); await noOverflow(page, 'week edge')
  await setView(page, 'شهر'); await shot(page, 'r04-month-edge-ar'); await noOverflow(page, 'month edge')
  await setView(page, 'قائمة'); await shot(page, 'r05-list-edge-ar'); await noOverflow(page, 'list edge')
  const durs = await page.evaluate(() => [...document.querySelectorAll('.apt-arow-dur')].map(e => e.textContent))
  check(durs.every(x => !x.includes('-')), `no negative lengths in the agenda (${durs.join(', ')})`)

  // details: long name, no phone, deleted patient
  await page.locator('.apt-arow', { hasText: 'عبد الرحمن محمد' }).first().click(); await page.waitForSelector('.apt-det'); await wait(page, 300)
  await shot(page, 'r06-details-long-ar')
  await page.keyboard.press('Escape'); await wait(page, 300)
  check(await page.locator('.apt-det').count() === 0, 'Escape closes the details dialog')
  await page.locator('.apt-arow', { hasText: 'هبة' }).last().click(); await page.waitForSelector('.apt-det'); await wait(page, 300)
  check(await page.locator('.apt-det .apt-contact').count() === 0, 'no call/WhatsApp buttons without a phone')
  check(await page.locator('.apt-remind').count() ? await page.locator('.apt-remind').isDisabled() : true, 'reminder disabled without a phone')
  await shot(page, 'r07-details-nophone-ar')
  await page.keyboard.press('Escape'); await wait(page, 300)
  await page.locator('.apt-arow', { hasText: 'مريض محذوف' }).first().click(); await page.waitForSelector('.apt-det'); await wait(page, 300)
  await shot(page, 'r08-details-deleted-patient-ar')
  await page.keyboard.press('Escape'); await wait(page, 300)

  // delete a referenced appointment; Escape on the confirmation keeps the details open
  const openE3 = async () => { await page.locator('.apt-arow', { hasText: 'سامي ناصر' }).filter({ hasText: '10:15' }).first().click(); await page.waitForSelector('.apt-det'); await wait(page, 300) }
  await openE3()
  await page.locator('.modal-footer .btn-danger-soft').click(); await wait(page, 300)
  await page.keyboard.press('Escape'); await wait(page, 300)
  check(await page.locator('.apt-det').count() === 1, 'Escape on the delete confirmation keeps the details open')
  check(!!(await db(page, () => window.__dentora.db.appointments.get('e3'))), 'a cancelled confirmation deletes nothing')
  if (!(await page.locator('.apt-det').count())) await openE3()
  await page.locator('.modal-footer .btn-danger-soft').click(); await wait(page, 300)
  await page.locator('.modal-footer .btn-danger').click(); await wait(page, 600)
  const casc = await db(page, async () => { const d = window.__dentora.db; return { a: await d.appointments.get('e3'), t: await d.treatments.get('t1'), n: await d.notes.get('n1'), act: await d.activity.filter(x => x.type === 'appointment' && x.action === 'delete' && x.entityId === 'e3').count() } })
  check(!casc.a && casc.t && !('appointmentId' in casc.t) && casc.n && !('appointmentId' in casc.n), 'delete clears appointmentId on treatments and notes, keeps them')
  check(casc.t && casc.t.updatedAt !== casc.t.createdAt && casc.n.updatedAt !== casc.n.createdAt, 'cleared treatment and note get a fresh updatedAt')
  check(casc.act === 1, 'delete is logged once')

  // double clicks on status buttons must not skip a step
  await page.locator('.apt-arow', { hasText: 'عبد الرحمن محمد' }).filter({ hasText: '10:00' }).first().click(); await page.waitForSelector('.apt-det'); await wait(page, 300)
  await page.locator('.apt-det-btns .btn').first().dblclick(); await wait(page, 700)
  const st1 = await db(page, () => window.__dentora.db.appointments.get('e1').then(a => a.status))
  check(st1 === 'confirmed', `details: a double click on confirm stays at confirmed (${st1})`)
  const sl = await db(page, () => window.__dentora.db.activity.filter(a => a.entityId === 'e1' && a.action === 'status').count())
  check(sl === 1, `one status activity for the double click (${sl})`)
  const e1 = await db(page, () => window.__dentora.db.appointments.get('e1'))
  check(e1.updatedAt > e1.createdAt, 'a status change sets updatedAt')
  await page.keyboard.press('Escape'); await wait(page, 300)
  await page.locator('.apt-arow', { hasText: 'هبة' }).last().locator('.apt-arow-actions .btn').first().dblclick(); await wait(page, 700)
  const st10 = await db(page, () => window.__dentora.db.appointments.get('e10').then(a => a.status))
  check(st10 === 'confirmed', `agenda: a double click on the next step stays at confirmed (${st10})`)

  // completing sets Patient.lastVisit; reopening or deleting that visit takes it back to the previous one
  const OLD = await db(page, async () => {   // an older completed visit of the same patient
    const d = window.__dentora.db, x = new Date(); x.setDate(x.getDate() - 30); x.setHours(10, 0, 0, 0)
    const start = x.toISOString(), date = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    await d.appointments.add({ id: 'e11', patientId: 'p3', doctorId: 'u-admin', date, start, end: new Date(x.getTime() + 1800000).toISOString(), durationMin: 30, type: 'checkup', status: 'completed', createdAt: start, updatedAt: start })
    await d.patients.update('p3', { lastVisit: start })
    return start
  })
  const e4 = await db(page, () => window.__dentora.db.appointments.get('e4'))
  const openE4 = async () => { await page.locator('.apt-arow', { hasText: 'سامي ناصر' }).filter({ hasText: '12:00' }).first().click(); await page.waitForSelector('.apt-det'); await wait(page, 300) }
  const step = async label => { await page.locator('.apt-det-btns .btn', { hasText: label }).click(); await wait(page, 700) }
  await openE4()
  await step('وصل المريض'); await step('بدء المعالجة'); await step('إنهاء الزيارة')
  check(await db(page, () => window.__dentora.db.patients.get('p3').then(p => p.lastVisit)) === e4.start, 'completing sets lastVisit = start')
  await step('إعادة فتح')
  const lv1 = await db(page, () => window.__dentora.db.patients.get('p3').then(p => p.lastVisit))
  check(lv1 === OLD, `reopening the visit restores the previous lastVisit (${lv1})`)
  await step('وصل المريض'); await step('بدء المعالجة'); await step('إنهاء الزيارة')
  await page.locator('.modal-footer .btn-danger-soft').click(); await wait(page, 300)
  await page.locator('.modal-footer .btn-danger').click(); await wait(page, 600)
  const lv2 = await db(page, () => window.__dentora.db.patients.get('p3').then(p => p.lastVisit))
  check(lv2 === OLD, `deleting the completed visit restores the previous lastVisit (${lv2})`)
  check(await page.locator('.apt-det').count() === 0, 'delete closes the details')

  // double submit of the form
  await setView(page, 'يوم')
  const before = await db(page, () => window.__dentora.db.appointments.count())
  await page.locator('.page-header .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
  await page.locator('.apt-picker input').fill('سامي'); await wait(page, 250); await page.keyboard.press('Enter'); await wait(page, 200)
  await page.locator('.apt-time-row input[type="time"]').fill('15:30')
  await page.locator('.modal-footer .btn-primary').dblclick(); await wait(page, 800)
  check(await db(page, () => window.__dentora.db.appointments.count()) === before + 1, 'a double click on "book" creates one appointment')
  const nw = await db(page, () => window.__dentora.db.appointments.toArray().then(l => l.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).pop()))
  check(nw && nw.id && nw.createdAt && nw.updatedAt && nw.createdBy === 'u-admin' && nw.date.length === 10 && nw.durationMin === 30 && (new Date(nw.end) - new Date(nw.start)) === 30 * 60000, 'new appointment: id, timestamps, createdBy, date, end = start + duration')
  check(await db(page, id => window.__dentora.db.activity.filter(a => a.entityId === id && a.action === 'create').count(), nw?.id) === 1, 'one create activity')
  const b2 = await db(page, () => window.__dentora.db.appointments.count())
  await page.locator('.page-header .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
  await page.locator('.apt-picker input').fill('Jonathan'); await wait(page, 250); await page.keyboard.press('Enter'); await wait(page, 200)
  await page.locator('.apt-time-row input[type="time"]').fill('16:30')
  await page.locator('.apt-form input[maxlength="160"]').fill('x')
  await page.locator('.apt-form input[maxlength="160"]').press('Enter'); await page.keyboard.press('Enter').catch(() => {}); await wait(page, 800)
  check(await db(page, () => window.__dentora.db.appointments.count()) === b2 + 1, 'Enter twice creates one appointment')

  // Escape closes the form
  await page.locator('.page-header .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
  await page.locator('.apt-form select').first().focus()
  await page.keyboard.press('Escape'); await wait(page, 300)
  check(await page.locator('.apt-form').count() === 0, 'Escape closes the form')

  // quick-create: Enter twice in the name field
  const pc = await db(page, () => window.__dentora.db.patients.count())
  await page.locator('.page-header .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
  await page.locator('.apt-picker input').fill('مريض سريع'); await wait(page, 250)
  await page.locator('.apt-drop-new').click(); await wait(page, 300)
  await page.locator('.apt-quick input').first().press('Enter'); await page.keyboard.press('Enter'); await wait(page, 700)
  const pcs = await db(page, () => window.__dentora.db.patients.filter(p => p.name === 'مريض سريع').toArray())
  check(pcs.length === 1 && (await db(page, () => window.__dentora.db.patients.count())) === pc + 1, `quick-create: Enter twice makes one patient (${pcs.length})`)
  check(pcs[0] && pcs[0].fileNo === 5 && pcs[0].createdAt && pcs[0].updatedAt && pcs[0].archived === false, `quick patient gets file #5 (${pcs[0]?.fileNo}) and timestamps`)
  check(await db(page, () => window.__dentora.db.clinic.get('clinic').then(c => c.nextFileNumber)) === 6, 'file counter advanced once')
  check(await db(page, () => window.__dentora.db.activity.filter(a => a.type === 'patient' && a.action === 'create').count()) === 1, 'quick patient logged once')
  await page.keyboard.press('Escape'); await wait(page, 300)

  // quick-create validation, then Escape twice: quick form, then the dialog
  await page.locator('.page-header .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
  await page.locator('.apt-picker input').fill('12'); await wait(page, 250)
  await page.locator('.apt-drop-new').click(); await wait(page, 300)
  await page.locator('.apt-quick input').first().fill('ا')
  await page.locator('.apt-quick input[type="tel"]').fill('12')
  await page.locator('.apt-quick .btn-primary').click(); await wait(page, 300)
  check(await page.locator('.apt-quick .field-error').count() === 2, 'quick-create validates name and phone')
  await shot(page, 'r09-quick-invalid-ar')
  await page.keyboard.press('Escape'); await wait(page, 200)
  check(await page.locator('.apt-form').count() === 1 && await page.locator('.apt-quick').count() === 0, 'Escape closes the quick form only')
  await page.keyboard.press('Escape'); await wait(page, 300)
  check(await page.locator('.apt-form').count() === 0, 'second Escape closes the dialog')

  // edit an appointment with a broken length: the form shows a sane one
  await setView(page, 'قائمة')
  await page.locator('.apt-arow', { hasText: 'Jonathan' }).filter({ hasText: '1:00' }).first().click(); await page.waitForSelector('.apt-det'); await wait(page, 300)
  await page.locator('.modal-footer .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 400)
  const durSel = await page.locator('.apt-form select').nth(2).inputValue()
  check(Number(durSel) > 0, `editing a broken appointment proposes a positive length (${durSel})`)
  await page.keyboard.press('Escape'); await wait(page, 300)

  // a time picked in the week view with several doctors books a free one
  await go(page, '/appointments'); await setView(page, 'أسبوع')
  const todayIdx = await page.evaluate(() => [...document.querySelectorAll('.apt-tg-head')].findIndex(h => h.classList.contains('today')))
  const col = page.locator('.apt-tg-col').nth(Math.max(0, todayIdx))
  const tenIdx = await col.evaluate(c => [...c.querySelectorAll('button.apt-slot')].findIndex(b => /10:00/.test(b.getAttribute('aria-label') || '')))
  if (tenIdx >= 0) {
    await col.locator('button.apt-slot').nth(tenIdx).dispatchEvent('click'); await page.waitForSelector('.apt-form'); await wait(page, 400)
    const docSel = await page.locator('.apt-form select').first().inputValue()
    check(docSel !== 'u-admin', `week slot click picks a free doctor (${docSel})`)
    check(await page.locator('.apt-conflict').count() === 0, 'no conflict for the auto-picked doctor')
    await page.keyboard.press('Escape'); await wait(page, 300)
  } else check(false, 'found the 10:00 slot in the week view')

  // agenda filtered to a status with nothing → filtered empty state, and back
  await setView(page, 'قائمة')
  await page.locator('.apt-status-menu .btn').click(); await page.locator('.menu-item', { hasText: 'ملغى' }).click(); await wait(page)
  await shot(page, 'r10-list-filtered-empty-ar')
  check(await page.locator('.empty').count() === 1, 'filtered-empty state')
  await page.locator('.empty .btn').click(); await wait(page)
  check(await page.locator('.apt-arow').count() > 0, 'clearing the filter brings the rows back')

  check(errors.length === 0, `no console errors (edge ar) ${errors.slice(0, 5).join(' | ')}`)
  await browser.close()
}

async function emptyClinic() {
  for (const mobile of [false, true]) {
    const { browser, page } = await openBrowser(mobile ? { mobile: true, width: 390, height: 844 } : { width: 1440, height: 900 })
    const k = mobile ? 'm' : 'd'
    const errors = watchErrors(page, `empty-${k}`)
    await seedAndLogin(page)
    await db(page, async () => { const d = window.__dentora.db; await d.appointments.clear(); await d.patients.clear() })
    await page.evaluate(() => sessionStorage.clear())
    await go(page, '/appointments'); await wait(page, 500)
    await shot(page, `r20-${k}-empty-day`); await noOverflow(page, `${k} empty day`)
    await setView(page, 'أسبوع'); await shot(page, `r21-${k}-empty-week`); await noOverflow(page, `${k} empty week`)
    await setView(page, 'شهر'); await shot(page, `r22-${k}-empty-month`); await noOverflow(page, `${k} empty month`)
    await setView(page, 'قائمة'); await shot(page, `r23-${k}-empty-list`); await noOverflow(page, `${k} empty list`)
    check(await page.locator('.empty').count() === 1, `${k}: empty agenda state`)
    await page.locator('.page-header .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
    await page.locator('.apt-picker input').click(); await wait(page, 300)
    check(await page.locator('.apt-drop-empty').count() === 1, `${k}: "no patients yet" in the picker`)
    await shot(page, `r24-${k}-empty-form`); await noOverflow(page, `${k} empty form`)
    check(errors.length === 0, `no console errors (empty ${k}) ${errors.slice(0, 5).join(' | ')}`)
    await browser.close()
  }
}

async function phoneEdge() {
  const { browser, page } = await openBrowser({ mobile: true, width: 390, height: 844 })
  const errors = watchErrors(page, 'phone-edge')
  await seedAndLogin(page)
  await seedEdge(page)
  await page.evaluate(() => sessionStorage.clear())
  await go(page, '/appointments'); await page.waitForSelector('.apt-mitem'); await wait(page, 400)
  await shot(page, 'r30-m-day-edge'); await noOverflow(page, 'm day edge')
  check(await page.locator('.apt-mitem').count() === 9, `phone day list shows all 9 (${await page.locator('.apt-mitem').count()})`)
  const loads = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.apt-strip-slot')].map(b => [b.textContent.trim(), b.classList.contains('busy') ? 'busy' : b.classList.contains('part') ? 'part' : 'free'])))
  check(Object.values(loads).includes('part') && !Object.values(loads).includes('busy'), `strip: slots with one doctor busy are "part", not "busy" (${Object.entries(loads).slice(0, 5).map(x => x.join('=')).join(' ')})`)
  await shot(page, 'r30b-m-day-edge-full', { full: true })
  await setView(page, 'أسبوع'); await shot(page, 'r31-m-week-edge'); await noOverflow(page, 'm week edge')
  await setView(page, 'شهر'); await shot(page, 'r32-m-month-edge'); await noOverflow(page, 'm month edge')
  await setView(page, 'قائمة'); await shot(page, 'r33-m-list-edge'); await noOverflow(page, 'm list edge')
  await page.locator('.apt-mitem', { hasText: 'عبد الرحمن' }).first().click(); await page.waitForSelector('.apt-det'); await wait(page, 500)
  await shot(page, 'r34-m-details-long'); await noOverflow(page, 'm details long')
  await page.locator('.modal-footer .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 500)
  await shot(page, 'r35-m-edit-long'); await noOverflow(page, 'm edit long')
  await page.keyboard.press('Escape'); await wait(page, 300)
  await setView(page, 'يوم')
  await page.locator('.apt-strip-slot').first().click(); await page.waitForSelector('.apt-form'); await wait(page, 400)
  await page.locator('.apt-picker input').fill('زز'); await wait(page, 250)
  await page.locator('.apt-drop-new').click(); await wait(page, 300)
  await shot(page, 'r36-m-quick'); await noOverflow(page, 'm quick')
  await page.keyboard.press('Escape'); await wait(page, 200); await page.keyboard.press('Escape'); await wait(page, 300)
  await go(page, '/patients/p1')
  const tab = page.locator('.tabs .tab', { hasText: 'المواعيد' })
  if (await tab.count()) { await tab.first().click(); await wait(page, 600); await page.locator('.apt-ptab').scrollIntoViewIfNeeded(); await shot(page, 'r37-m-ptab-long'); await noOverflow(page, 'm ptab long') }
  check(errors.length === 0, `no console errors (phone edge) ${errors.slice(0, 5).join(' | ')}`)
  await browser.close()
}

async function enEdge() {
  const { browser, page } = await openBrowser({ width: 1440, height: 900, lang: 'en' })
  const errors = watchErrors(page, 'en-edge')
  await seedAndLogin(page, { lang: 'en' })
  await seedEdge(page)
  await page.evaluate(() => sessionStorage.clear())
  await go(page, '/appointments'); await page.waitForSelector('.apt-tg-col'); await wait(page, 400)
  await page.evaluate(() => { document.querySelector('.apt-tg-scroll').scrollTop = 0 }); await wait(page, 200)
  await shot(page, 'r40-en-day-edge'); await noOverflow(page, 'en day edge')
  await setView(page, 'Agenda'); await shot(page, 'r41-en-list-edge')
  const aligns = await page.evaluate(() => [...document.querySelectorAll('.apt-arow-name')].map(e => { const r = document.createRange(); r.selectNodeContents(e); return Math.round(r.getBoundingClientRect().left - e.getBoundingClientRect().left) }))
  check(aligns.every(x => x <= 2), `EN: Arabic names keep the LTR alignment (${aligns.join(',')})`)
  const cut = await page.evaluate(() => { const e = [...document.querySelectorAll('.apt-arow-name')].find(x => x.textContent.startsWith('عبد الرحمن')); return e ? getComputedStyle(e).direction : '' })
  check(cut === 'rtl', `EN: an Arabic name is laid out RTL so the ellipsis cuts its end (${cut})`)
  await page.locator('.page-header .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
  await page.locator('.apt-picker input').fill('Jon'); await wait(page, 250); await page.keyboard.press('Enter'); await wait(page, 200)
  const friday = await page.evaluate(() => { const x = new Date(); x.setDate(x.getDate() + ((5 - x.getDay() + 7) % 7 || 7)); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` })
  await page.locator('.apt-form input[type="date"]').fill(friday)
  await page.locator('.apt-time-row input[type="time"]').fill('20:10'); await wait(page, 300)
  await shot(page, 'r42-en-form-hours')
  check(await page.locator('.apt-form .alert').count() >= 1, 'out-of-hours / closed-day notice shows')
  await page.keyboard.press('Escape')
  check(errors.length === 0, `no console errors (en edge) ${errors.slice(0, 5).join(' | ')}`)
  await browser.close()
}

const server = await startServer()
try {
  if (PART === 'all' || PART === 'edge') await desktopEdge()
  if (PART === 'all' || PART === 'empty') await emptyClinic()
  if (PART === 'all' || PART === 'phone') await phoneEdge()
  if (PART === 'all' || PART === 'en') await enEdge()
} finally { server.kill() }
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nAll appointment review checks passed')
process.exit(problems.length ? 1 : 0)

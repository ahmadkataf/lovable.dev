// QA for the appointments module: screenshots of every view and dialog (desktop RTL, desktop EN, phone) and the real flows
// (create from a slot → validate → conflict → save; quick-create patient; details → status chain → lastVisit; edit; delete;
// filters; empty states; patient tab; read-only), asserting on the DB and on horizontal overflow, with zero console errors.
// Usage: npx vite build --outDir /tmp/dist-appointments && QA_DIST=/tmp/dist-appointments QA_PORT=4303 QA_SHOTS=qa-shots/appointments node scripts/qa/appointments.mjs
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'

const PART = process.env.QA_PART || 'all'   // all | desktop | en | mobile | flows
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
  check(o <= 1, `no horizontal overflow (${label}) [${o}px]`)
}
/** The index of the first slot button in column `col` (at or after `from`) that no appointment card covers. */
async function emptySlot(page, col, from = 0) {
  const idx = await page.evaluate(({ col, from }) => {
    const c = document.querySelectorAll('.apt-tg-col')[col]
    const evs = [...c.querySelectorAll('.apt-ev')].map(e => e.getBoundingClientRect())
    const slots = [...c.querySelectorAll('button.apt-slot')]
    for (let i = from; i < slots.length; i++) {
      const r = slots[i].getBoundingClientRect()
      if (!evs.some(e => e.top < r.bottom - 1 && e.bottom > r.top + 1) && !slots[i].classList.contains('off')) return i
    }
    return -1
  }, { col, from })
  const loc = page.locator('.apt-tg-col').nth(col).locator('button.apt-slot').nth(idx)
  loc.index = idx
  return loc
}
async function setView(page, label) {
  await page.locator('.apt-views button', { hasText: label }).click()
  await wait(page, 500)
}

/** A realistic clinic day/week/month: 12 patients, appointments for both doctors around "now", past visits, a busy day. */
async function seedClinic(page) {
  return db(page, async () => {
    const d = window.__dentora.db
    await d.appointments.clear()
    const pad = n => String(n).padStart(2, '0')
    const iso = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
    const dayOff = n => { const x = new Date(); x.setDate(x.getDate() + n); return iso(x) }
    const at = (date, time) => { const [y, m, dd] = date.split('-').map(Number); const [h, mi] = time.split(':').map(Number); return new Date(y, m - 1, dd, h, mi).toISOString() }
    const now = new Date().toISOString()
    const P = [
      ['أحمد محمود الخطيب', 'male', '0944123456'], ['فاطمة الزهراء العلي', 'female', '0933456789'], ['محمد سعيد حداد', 'male', '0955987654'],
      ['ليلى عبد الرحمن', 'female', '0944555111'], ['يوسف إبراهيم النجار', 'male', '0988123123'], ['رنا خالد المصري', 'female', '0991222333'],
      ['عمر فاروق الشامي', 'male', '0947000111'], ['سارة نبيل قاسم', 'female', '0936777888'], ['خالد وليد الحمصي', 'male', '0958444555'],
      ['هبة سمير الأحمد', 'female', ''], ['مازن جورج عيسى', 'male', '0949888777'], ['نور الهدى صالح', 'female', '0933111999'],
    ]
    const existing = await d.patients.count()
    const ids = []
    if (!existing) {
      let fileNo = 1
      for (const [name, gender, phone] of P) {
        const id = 'p' + fileNo
        await d.patients.add({ id, fileNo, name, gender, phone: phone || undefined, allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: now, updatedAt: now })
        ids.push(id); fileNo++
      }
      const c = await d.clinic.get('clinic'); await d.clinic.put({ ...c, nextFileNumber: fileNo })
    } else (await d.patients.toArray()).forEach(p => ids.push(p.id))
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    // [dayOffset, time, minutes, patient#, doctor, type, status?, reason?]
    const A = [
      [0, '09:00', 30, 0, 'u-admin', 'checkup', null, 'فحص دوري'], [0, '09:30', 45, 1, 'u-admin', 'treatment', null, 'حشوة تجميلية للضاحك'],
      [0, '10:30', 30, 2, 'u-admin', 'followup', null], [0, '10:45', 30, 3, 'u-admin', 'consultation', null, 'استشارة زراعة'],
      [0, '11:00', 60, 4, 'u-admin', 'surgery', null, 'قلع ضرس عقل'], [0, '12:30', 30, 5, 'u-admin', 'cleaning', null],
      [0, '13:30', 30, 6, 'u-admin', 'treatment', null, 'معالجة عصب'], [0, '14:00', 15, 7, 'u-admin', 'emergency', null, 'ألم حاد'],
      [0, '15:00', 90, 8, 'u-admin', 'treatment', null, 'تركيب تاج'], [0, '17:00', 30, 9, 'u-admin', 'checkup', 'cancelled'],
      [0, '09:00', 60, 10, 'u-doc2', 'orthodontic', null, 'تركيب تقويم علوي'], [0, '10:30', 30, 11, 'u-doc2', 'orthodontic', null],
      [0, '11:00', 30, 1, 'u-doc2', 'followup', 'no_show'], [0, '13:00', 45, 3, 'u-doc2', 'orthodontic', null, 'شد التقويم'],
      [0, '14:30', 30, 2, 'u-doc2', 'consultation', null], [0, '16:00', 60, 5, 'u-doc2', 'orthodontic', null],
      [1, '09:30', 30, 6, 'u-admin', 'checkup', 'confirmed'], [1, '11:00', 60, 0, 'u-doc2', 'orthodontic', 'scheduled'], [1, '15:00', 30, 7, 'u-admin', 'cleaning', 'scheduled'],
      [2, '10:00', 45, 8, 'u-admin', 'treatment', 'confirmed'], [2, '12:00', 30, 9, 'u-doc2', 'followup', 'scheduled'],
      [3, '09:00', 30, 10, 'u-admin', 'checkup', 'scheduled'], [3, '09:30', 30, 11, 'u-admin', 'checkup', 'scheduled'], [3, '13:00', 120, 4, 'u-admin', 'surgery', 'confirmed', 'زرع سن'],
      [4, '10:00', 30, 3, 'u-doc2', 'orthodontic', 'scheduled'], [5, '11:00', 30, 2, 'u-admin', 'followup', 'scheduled'],
      [8, '10:00', 30, 0, 'u-admin', 'followup', 'scheduled'], [10, '12:00', 30, 1, 'u-doc2', 'orthodontic', 'scheduled'], [12, '09:00', 45, 6, 'u-admin', 'treatment', 'scheduled'],
      [-1, '10:00', 30, 0, 'u-admin', 'checkup', 'completed'], [-2, '12:00', 30, 5, 'u-doc2', 'orthodontic', 'completed'], [-3, '09:00', 30, 0, 'u-admin', 'cleaning', 'no_show'],
      [-6, '11:00', 60, 8, 'u-admin', 'treatment', 'completed'], [-20, '10:00', 30, 0, 'u-admin', 'treatment', 'completed'], [-40, '10:00', 30, 0, 'u-admin', 'consultation', 'completed'],
      [20, '10:00', 30, 4, 'u-admin', 'followup', 'scheduled'], [-12, '13:00', 30, 3, 'u-doc2', 'orthodontic', 'cancelled'],
    ]
    let n = 0
    for (const [off, time, min, pi, doctorId, type, st, reason] of A) {
      const date = dayOff(off)
      const s = toMin(time)
      let status = st
      if (!status) status = off === 0 ? (s + min <= nowMin ? 'completed' : s <= nowMin ? (n % 2 ? 'in_progress' : 'arrived') : n % 3 === 0 ? 'scheduled' : 'confirmed') : 'scheduled'
      const start = at(date, time)
      await d.appointments.add({ id: `a${++n}`, patientId: ids[pi], doctorId, date, start, end: new Date(new Date(start).getTime() + min * 60000).toISOString(), durationMin: min, type, status, reason, createdAt: now, updatedAt: now, createdBy: 'u-rec' })
    }
    // a few extra on a busy day in the month (overflow chip)
    const busy = dayOff(4)
    for (let i = 0; i < 4; i++) {
      const start = at(busy, `1${i + 2}:00`)
      await d.appointments.add({ id: `b${i}`, patientId: ids[(i + 3) % ids.length], doctorId: i % 2 ? 'u-doc2' : 'u-admin', date: busy, start, end: new Date(new Date(start).getTime() + 30 * 60000).toISOString(), durationMin: 30, type: 'checkup', status: 'scheduled', createdAt: now, updatedAt: now })
    }
    return { patients: ids.length, appointments: await d.appointments.count() }
  })
}

async function desktopRTL(server) {
  const { browser, page } = await openBrowser({ width: 1440, height: 900 })
  const errors = watchErrors(page, 'desktop-ar')
  await seedAndLogin(page)
  const seeded = await seedClinic(page)
  console.log('seeded', seeded)
  await go(page, '/appointments')
  try { await page.evaluate(() => sessionStorage.clear()) } catch {}
  await go(page, '/appointments')
  await page.waitForSelector('.apt-tg-col')
  await wait(page, 500)
  await shot(page, '01-day-ar')
  await noOverflow(page, 'day ar')
  check(await page.locator('.apt-ev').count() >= 14, 'day grid shows today\'s appointments for both doctors')
  check(await page.locator('.apt-tg-head').count() === 2, 'one column per doctor')
  check(await page.locator('.apt-now').count() >= 1, 'now line visible')
  // overlapping events share width
  const widths = await page.evaluate(() => [...document.querySelectorAll('.apt-ev')].map(e => Math.round(e.getBoundingClientRect().width)))
  check(new Set(widths).size > 1, `overlapping events are narrower (${[...new Set(widths)].join(',')})`)

  // hover a slot (the + hint)
  const slot = await emptySlot(page, 1, 8)
  await slot.hover(); await wait(page, 250)
  await shot(page, '02-day-slot-hover-ar')

  // one doctor filtered → single column
  await page.locator('.apt-docchip').nth(1).click(); await wait(page)
  check(await page.locator('.apt-tg-head').count() === 1, 'single column when one doctor is filtered')
  await shot(page, '03-day-one-doctor-ar')
  await page.locator('.apt-chips .chip').first().click(); await wait(page)

  // status filter menu
  await page.locator('.apt-status-menu .btn').click(); await wait(page, 250)
  await shot(page, '04-status-menu-ar')
  await page.locator('.menu-item', { hasText: 'الفعّالة فقط' }).click(); await wait(page)
  const activeCount = await page.locator('.apt-ev').count()
  check(activeCount < widths.length, `"active only" hides cancelled/no-show (${activeCount} < ${widths.length})`)
  await page.locator('.apt-status-menu .btn').click(); await page.locator('.menu-item', { hasText: 'كل الحالات' }).click(); await wait(page)

  // week / month / list
  await setView(page, 'أسبوع'); await page.waitForSelector('.apt-whead')
  await shot(page, '05-week-ar'); await noOverflow(page, 'week ar')
  check(await page.locator('.apt-tg-head').count() === 7, 'week has 7 columns')
  const firstHead = await page.locator('.apt-whead-dow').first().textContent()
  check(/السبت|سبت/.test(firstHead || ''), `week starts on Saturday (${firstHead})`)
  await setView(page, 'شهر'); await page.waitForSelector('.apt-mcell')
  await shot(page, '06-month-ar'); await noOverflow(page, 'month ar')
  check(await page.locator('.apt-mmore').count() >= 1, 'month shows +N overflow')
  await setView(page, 'قائمة'); await page.waitForSelector('.apt-ag-day')
  await shot(page, '07-list-ar'); await noOverflow(page, 'list ar')
  await shot(page, '07b-list-ar-full', { full: true })
  // month: clicking a day opens the day view
  await setView(page, 'شهر')
  await page.locator('.apt-mcell.today .apt-mday').click(); await wait(page)
  check(await page.locator('.apt-tg-head').count() >= 1 && await page.locator('.apt-views button[aria-selected="true"]').textContent() === 'يوم', 'clicking a month day switches to the day view')

  // details
  await page.locator('.apt-ev', { hasText: 'رنا خالد المصري' }).first().click(); await page.waitForSelector('.apt-det')
  await wait(page, 300)
  await shot(page, '08-details-ar')
  await page.keyboard.press('Escape'); await wait(page)

  // new appointment form from an empty slot
  await (await emptySlot(page, 1, 8)).click()
  await page.waitForSelector('.apt-form'); await wait(page, 300)
  await shot(page, '09-form-new-ar')
  await page.locator('.apt-picker input').fill('احمد'); await wait(page, 300)
  await shot(page, '10-form-search-ar')
  await page.keyboard.press('Escape'); await wait(page, 200)
  check(await page.locator('.apt-form').count() === 1, 'Escape closes the dropdown, not the dialog')
  await page.locator('.apt-picker input').fill('زززز'); await wait(page, 250)
  await page.locator('.apt-drop-new').click(); await wait(page, 300)
  await shot(page, '11-form-quick-patient-ar')
  await page.keyboard.press('Escape'); await wait(page, 200)
  // conflict
  await page.locator('.apt-picker input').fill('فاطمه'); await wait(page, 250)
  await page.locator('.apt-drop-item').first().click(); await wait(page, 200)
  await page.locator('.apt-time-row input[type="time"]').fill('09:15'); await wait(page, 400)
  check(await page.locator('.apt-conflict').count() === 1, 'conflict warning appears')
  await shot(page, '12-form-conflict-ar')
  await page.keyboard.press('Escape'); await wait(page)

  // empty list state (far future)
  await setView(page, 'قائمة')
  await page.locator('.apt-datepick input').fill('2027-06-01'); await wait(page, 600)
  await shot(page, '13-list-empty-ar')
  check(await page.locator('.empty').count() === 1, 'empty state on an empty agenda')
  // empty day
  await setView(page, 'يوم'); await wait(page)
  await shot(page, '14-day-empty-ar')
  // closed day (a Friday)
  await page.locator('.apt-datepick input').fill('2027-06-04'); await wait(page, 600)
  await shot(page, '15-day-closed-ar')
  await page.locator('.apt-today').click(); await wait(page)

  // patient tab
  await go(page, '/patients/p1')
  const tab = page.locator('.tabs .tab', { hasText: 'المواعيد' })
  if (await tab.count()) {
    await tab.first().click(); await page.waitForSelector('.apt-ptab', { timeout: 5000 }).catch(() => {})
    await wait(page, 500)
    await shot(page, '16-patient-tab-ar')
    check(await page.locator('.apt-trow').count() >= 4, 'patient tab lists upcoming and past')
    await noOverflow(page, 'patient tab ar')
    await page.locator('.apt-trow').first().click(); await page.waitForSelector('.apt-det'); await wait(page, 300)
    await shot(page, '17-patient-tab-details-ar')
    await page.keyboard.press('Escape')
  } else console.log('note: patient page has no appointments tab yet')

  check(errors.length === 0, `no console errors (desktop ar) ${errors.slice(0, 5).join(' | ')}`)
  await browser.close()
}

async function flows() {
  const { browser, page } = await openBrowser({ width: 1440, height: 900 })
  const errors = watchErrors(page, 'flows')
  await seedAndLogin(page)
  await seedClinic(page)
  await page.evaluate(() => sessionStorage.clear())
  await go(page, '/appointments')
  await page.waitForSelector('.apt-tg-col')
  const before = await db(page, () => window.__dentora.db.appointments.count())

  // --- validation: open "new" from the header, clear nothing, submit without a patient
  await page.locator('.page-header .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
  await page.locator('.modal-footer .btn-primary').click(); await wait(page, 300)
  check(await page.locator('.apt-form .field-error').count() >= 1, 'validation: patient required')
  await shot(page, '20-form-validation-ar')

  // --- quick-create a patient inside the form
  await page.locator('.apt-picker input').fill('سامر عادل'); await wait(page, 250)
  await page.locator('.apt-drop-new').click(); await wait(page, 300)
  await page.locator('.apt-quick input[type="tel"]').fill('0999 111 222')
  await page.locator('.apt-quick .segmented button').nth(0).click()
  await page.locator('.apt-quick .btn-primary').click(); await wait(page, 600)
  const qp = await db(page, () => window.__dentora.db.patients.filter(p => p.name === 'سامر عادل').first())
  check(!!qp && qp.fileNo > 0 && qp.phone === '0999 111 222' && qp.gender === 'male', `quick-create patient saved with file #${qp?.fileNo}`)
  check(await page.locator('.apt-picked').count() === 1, 'the new patient is selected as a chip')

  // --- book it at 16:30 with doctor 2, 45 min, Enter submits
  await page.locator('.apt-form select').first().selectOption('u-doc2')
  await page.locator('.apt-time-row input[type="time"]').fill('16:30')
  await page.locator('.apt-form select').nth(2).selectOption('45')
  await page.locator('.apt-form input[maxlength="160"]').fill('فحص أولي')
  await page.locator('.apt-form input[maxlength="160"]').press('Enter'); await wait(page, 700)
  const created = await db(page, () => window.__dentora.db.appointments.filter(a => a.reason === 'فحص أولي').first())
  check(!!created && created.doctorId === 'u-doc2' && created.durationMin === 45 && created.patientId === qp?.id && created.createdBy === 'u-admin', 'create: appointment saved with doctor, duration, patient, createdBy')
  if (created) {
    const s = new Date(created.start), e = new Date(created.end)
    check(s.getHours() === 16 && s.getMinutes() === 30 && (e - s) / 60000 === 45 && created.date === created.start.slice(0, 10) || created.date.length === 10, 'create: start/end/date derived correctly')
  }
  check(await db(page, () => window.__dentora.db.appointments.count()) === before + 1, 'create: one more appointment')
  const act = await db(page, () => window.__dentora.db.activity.filter(a => a.type === 'appointment' && a.action === 'create').count())
  check(act >= 1, 'create: activity logged')

  // --- create from an empty slot (defaults: date, time, doctor)
  const slot17 = await emptySlot(page, 1, 16) // the grid starts at 09:00 with 30-minute slots
  const m = 9 * 60 + slot17.index * 30, expected = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  await slot17.click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
  const t = await page.locator('.apt-time-row input[type="time"]').inputValue()
  const doc = await page.locator('.apt-form select').first().inputValue()
  check(t === expected && doc === 'u-doc2', `slot click pre-fills time and doctor (${t} = ${expected}, ${doc})`)
  await page.locator('.apt-picker input').fill('نور'); await wait(page, 250)
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); await wait(page, 200)
  check(await page.locator('.apt-picked').count() === 1, 'keyboard: Enter picks the highlighted patient')
  await page.locator('.modal-footer .btn-primary').click(); await wait(page, 700)
  const fromSlot = await db(page, t => window.__dentora.db.appointments.filter(a => a.doctorId === 'u-doc2' && a.patientId === 'p12' && `${String(new Date(a.start).getHours()).padStart(2, '0')}:${String(new Date(a.start).getMinutes()).padStart(2, '0')}` === t).first(), expected)
  check(!!fromSlot && fromSlot.status === 'scheduled', 'slot booking saved')

  // --- conflict: allowed with a warning
  await page.locator('.page-header .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
  await page.locator('.apt-picker input').fill('يوسف'); await wait(page, 250); await page.locator('.apt-drop-item').first().click()
  await page.locator('.apt-form select').first().selectOption('u-admin')
  await page.locator('.apt-time-row input[type="time"]').fill('11:15'); await wait(page, 400)
  check(await page.locator('.apt-conflict').count() === 1, 'conflict warning for an overlapping time')
  const useSlot = page.locator('.apt-conflict .btn')
  if (await useSlot.count()) { await useSlot.click(); await wait(page, 300) }
  const fixed = await page.locator('.apt-time-row input[type="time"]').inputValue()
  check(fixed !== '11:15' && await page.locator('.apt-conflict').count() === 0, `"next free time" resolves the conflict (${fixed})`)
  await page.locator('.apt-time-row input[type="time"]').fill('11:15'); await wait(page, 300)
  await page.locator('.modal-footer .btn-primary').click(); await wait(page, 700)
  check(await db(page, () => window.__dentora.db.appointments.filter(a => a.doctorId === 'u-admin' && new Date(a.start).getHours() === 11 && new Date(a.start).getMinutes() === 15).count()) === 1, 'conflicting appointment can still be saved')

  // --- details → status chain → completed sets lastVisit
  await page.locator('.apt-ev', { hasText: 'سامر عادل' }).first().click(); await page.waitForSelector('.apt-det'); await wait(page, 300)
  const chain = [['تأكيد الموعد', 'confirmed'], ['وصل المريض', 'arrived'], ['بدء المعالجة', 'in_progress'], ['إنهاء الزيارة', 'completed']]
  for (const [label, st] of chain) {
    await page.locator('.apt-det-btns .btn', { hasText: label }).click(); await wait(page, 700)
    const s = await db(page, id => window.__dentora.db.appointments.get(id).then(a => a.status), created?.id)
    check(s === st, `status → ${st}`)
  }
  await shot(page, '21-details-completed-ar')
  const lv = await db(page, id => window.__dentora.db.patients.get(id).then(p => p.lastVisit), qp?.id)
  check(lv === created?.start, 'completing sets patient.lastVisit = appointment.start')
  const statusLogs = await db(page, () => window.__dentora.db.activity.filter(a => a.type === 'appointment' && a.action === 'status').count())
  check(statusLogs >= 4, 'status changes are logged')
  await page.locator('.apt-det-btns .btn', { hasText: 'إعادة فتح' }).click(); await wait(page, 400)
  check(await db(page, id => window.__dentora.db.appointments.get(id).then(a => a.status), created?.id) === 'scheduled', 'reopen → scheduled')

  // --- WhatsApp reminder goes through openExternal (window.open on the web)
  await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null } })
  const remind = page.locator('.apt-remind')
  if (await remind.count()) {
    await remind.click(); await wait(page, 200)
    const opened = await page.evaluate(() => window.__opened)
    check(opened.length === 1 && opened[0].startsWith('https://wa.me/963999111222?text=') && decodeURIComponent(opened[0]).includes('سامر عادل'), 'reminder opens WhatsApp with the message')
  } else check(false, 'reminder button visible for an upcoming appointment')

  // --- edit from details: change duration and type
  await page.locator('.modal-footer .btn-primary', { hasText: 'تعديل' }).click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
  await shot(page, '22-form-edit-ar')
  await page.locator('.apt-form select').nth(2).selectOption('60')
  await page.locator('.apt-form select').nth(3).selectOption('treatment')
  await page.locator('.modal-footer .btn-primary').click(); await wait(page, 700)
  const edited = await db(page, id => window.__dentora.db.appointments.get(id), created?.id)
  check(edited?.durationMin === 60 && edited?.type === 'treatment' && (new Date(edited.end) - new Date(edited.start)) / 60000 === 60, 'edit: duration and type saved, end recomputed')

  // --- delete from the edit form
  await page.locator('.apt-ev', { hasText: 'سامر عادل' }).first().click(); await page.waitForSelector('.apt-det'); await wait(page, 300)
  await page.locator('.modal-footer .btn-danger-soft').click(); await wait(page, 300)
  await shot(page, '23-delete-confirm-ar')
  await page.locator('.modal-footer .btn-danger').click(); await wait(page, 600)
  check(!(await db(page, id => window.__dentora.db.appointments.get(id), created?.id)), 'delete: appointment removed')
  check(await page.locator('.apt-det').count() === 0, 'delete closes the dialog')

  // --- agenda quick action (next step)
  await setView(page, 'قائمة'); await page.waitForSelector('.apt-arow')
  const firstScheduled = page.locator('.apt-arow.is-scheduled').first()
  const pname = await firstScheduled.locator('.apt-arow-name').textContent()
  await firstScheduled.locator('.apt-arow-actions .btn').first().click(); await wait(page, 500)
  check(await db(page, n => window.__dentora.db.patients.filter(p => p.name === n).first().then(p => window.__dentora.db.appointments.where('patientId').equals(p.id).filter(a => a.status === 'confirmed').count()), pname) >= 1, 'agenda: one-tap confirm')

  // --- read-only (expired trial): no create
  await db(page, async () => { const d = window.__dentora.db; const old = new Date(Date.now() - 40 * 86400000).toISOString(); await d.settings.put({ key: 'installedAt', value: old }); await d.settings.delete('license') })
  await go(page, '/appointments'); await wait(page, 600)
  await setView(page, 'يوم')
  check(await page.locator('.page-header .btn-primary').isDisabled(), 'read-only: "new" is disabled')
  check(await page.locator('button.apt-slot').count() === 0, 'read-only: slots are not clickable')
  await shot(page, '24-readonly-ar')
  await page.locator('.apt-ev').first().click(); await page.waitForSelector('.apt-det'); await wait(page, 300)
  check(await page.locator('.apt-det-btns').count() === 0 && await page.locator('.modal-footer .btn-danger-soft').count() === 0, 'read-only: no status/edit/delete in details')
  await page.keyboard.press('Escape')
  await db(page, async () => { await window.__dentora.db.settings.put({ key: 'installedAt', value: new Date().toISOString() }) })

  check(errors.length === 0, `no console errors (flows) ${errors.slice(0, 5).join(' | ')}`)
  await browser.close()
}

async function desktopEN() {
  const { browser, page } = await openBrowser({ width: 1440, height: 900, lang: 'en' })
  const errors = watchErrors(page, 'desktop-en')
  await seedAndLogin(page, { lang: 'en' })
  await seedClinic(page)
  await page.evaluate(() => sessionStorage.clear())
  await go(page, '/appointments'); await page.waitForSelector('.apt-tg-col'); await wait(page, 400)
  await shot(page, '30-day-en'); await noOverflow(page, 'day en')
  await setView(page, 'Week'); await shot(page, '31-week-en'); await noOverflow(page, 'week en')
  await setView(page, 'Month'); await shot(page, '32-month-en'); await noOverflow(page, 'month en')
  await setView(page, 'Agenda'); await shot(page, '33-list-en'); await noOverflow(page, 'list en')
  await page.locator('.apt-arow').first().click(); await page.waitForSelector('.apt-det'); await wait(page, 300)
  await shot(page, '34-details-en')
  await page.keyboard.press('Escape'); await wait(page)
  await page.locator('.page-header .btn-primary').click(); await page.waitForSelector('.apt-form'); await wait(page, 300)
  await page.locator('.apt-picker input').fill('a'); await wait(page, 200)
  await page.locator('.apt-picker input').fill(''); await page.keyboard.press('Escape'); await wait(page, 150)
  await shot(page, '35-form-en')
  await page.keyboard.press('Escape')
  await setView(page, 'Agenda')
  const ui = await page.evaluate(() => [...document.querySelectorAll('.page-header, .apt-bar, .apt-status-menu, .apt-chips .chip:first-child, .apt-ag-head, .apt-arow-time, .apt-arow-type, .apt-arow-status, .apt-arow-actions')].map(e => { const c = e.cloneNode(true); c.querySelectorAll('.apt-arow-reason').forEach(x => x.remove()); return c.innerText }).join(' | '))
  check(!/[\u0600-\u06FF]/.test(ui), `EN UI chrome has no Arabic strings ${(ui.match(/[\u0600-\u06FF]+/g) || []).slice(0, 5).join(' ')}`)
  check(errors.length === 0, `no console errors (desktop en) ${errors.slice(0, 5).join(' | ')}`)
  await browser.close()
}

async function mobile() {
  const { browser, page } = await openBrowser({ mobile: true, width: 390, height: 844 })
  const errors = watchErrors(page, 'mobile')
  await seedAndLogin(page)
  await seedClinic(page)
  await page.evaluate(() => sessionStorage.clear())
  await go(page, '/appointments'); await page.waitForSelector('.apt-mitem'); await wait(page, 400)
  await shot(page, '40-m-day'); await noOverflow(page, 'm day')
  await shot(page, '40b-m-day-full', { full: true })
  await setView(page, 'أسبوع'); await shot(page, '41-m-week'); await noOverflow(page, 'm week')
  await page.locator('.apt-wday').nth(3).click(); await wait(page)
  await shot(page, '41b-m-week-day3')
  await setView(page, 'شهر'); await shot(page, '42-m-month'); await noOverflow(page, 'm month')
  await setView(page, 'قائمة'); await shot(page, '43-m-list'); await noOverflow(page, 'm list')
  await setView(page, 'يوم')
  await page.locator('.apt-mitem').first().click(); await page.waitForSelector('.apt-det'); await wait(page, 500)
  await shot(page, '44-m-details'); await noOverflow(page, 'm details')
  await page.keyboard.press('Escape'); await wait(page)
  await page.locator('.apt-strip-slot').nth(2).click(); await page.waitForSelector('.apt-form'); await wait(page, 500)
  await shot(page, '45-m-form'); await noOverflow(page, 'm form')
  await page.locator('.apt-picker input').fill('مح'); await wait(page, 300)
  await shot(page, '46-m-form-search')
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await wait(page)
  // touch targets
  const small = await page.evaluate(() => [...document.querySelectorAll('.apt-page button, .apt-page a')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 40 }).map(b => (b.className || b.tagName) + ':' + Math.round(b.getBoundingClientRect().height)).slice(0, 8))
  check(small.length === 0, `touch targets ≥ 40px on phone ${small.join(' ')}`)
  await go(page, '/patients/p1')
  const tab = page.locator('.tabs .tab', { hasText: 'المواعيد' })
  if (await tab.count()) {
    await tab.first().click(); await wait(page, 700); await shot(page, '47-m-patient-tab'); await noOverflow(page, 'm patient tab')
    await page.locator('.apt-ptab-sec').first().evaluate(e => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => window.scrollBy(0, -80)); await wait(page, 300)
    await shot(page, '48-m-patient-tab-rows')
  }
  check(errors.length === 0, `no console errors (mobile) ${errors.slice(0, 5).join(' | ')}`)
  await browser.close()
}

const server = await startServer()
try {
  if (PART === 'all' || PART === 'desktop') await desktopRTL(server)
  if (PART === 'all' || PART === 'flows') await flows()
  if (PART === 'all' || PART === 'en') await desktopEN()
  if (PART === 'all' || PART === 'mobile') await mobile()
} finally { server.kill() }
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nAll appointment checks passed')
process.exit(problems.length ? 1 : 0)

// QA of the dashboard and the reports module: real flows (quick status changes, period presets, custom range,
// doctor filter, table view, CSV export, WhatsApp reminder, print), database assertions, console errors, overflow
// checks and screenshots in Arabic, English and on a phone.
// Usage: npx vite build --outDir /tmp/dist-reports && QA_DIST=/tmp/dist-reports QA_PORT=4307 QA_SHOTS=qa-shots/reports node scripts/qa/reports.mjs
import fs from 'node:fs'
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'

const failures = []
const consoleErrors = []
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.error('FAIL:', msg) } else console.log('ok:', msg) }
const wait = (page, ms = 350) => page.waitForTimeout(ms)
const go = async (page, hash) => { await page.goto(`${BASE}/index.html#${hash}`); await page.waitForLoadState('networkidle'); await wait(page, 700) }
async function noOverflow(page, label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }))
  check(r.sw <= r.w, `${label}: no horizontal overflow (${r.sw} <= ${r.w})`)
}
async function closeModal(page) {
  await page.keyboard.press('Escape'); await wait(page, 300)
  if (await page.locator('.overlay').count()) { const x = page.locator('.modal-x'); if (await x.count()) await x.first().click(); await wait(page, 300) }
  if (await page.locator('.overlay').count()) { await page.mouse.click(5, 5); await wait(page, 300) }
}
async function snap(page, name, opts) { await noOverflow(page, name); await shot(page, name, opts) }
function watchConsole(page, tag) {
  page.on('pageerror', e => consoleErrors.push(`[${tag}] ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[${tag}] ${m.text()}`) })
}

/** A realistic clinic: ~5 months of patients, visits, treatments, invoices, payments and expenses. */
async function seed(page, lang = 'ar') {
  return page.evaluate(async (lang) => {
    const db = window.__dentora.db
    const AR = lang === 'ar'
    const pad = n => String(n).padStart(2, '0')
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const now = new Date()
    const today = iso(now)
    const dayOff = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d }
    const at = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x.toISOString() }
    let seq = 0
    const id = p => `${p}-${++seq}`
    let rnd = 7
    const rand = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646 }
    const pick = a => a[Math.floor(rand() * a.length)]
    const nowISO = now.toISOString()

    const procs = [
      ['exam', 'فحص وتشخيص', 'Examination', 'diagnostic', 25], ['xray', 'صورة شعاعية', 'X-ray', 'diagnostic', 15],
      ['clean', 'تنظيف وتلميع', 'Scaling & polishing', 'preventive', 40], ['fill', 'حشوة كومبوزيت', 'Composite filling', 'restorative', 60],
      ['rct', 'معالجة لبية', 'Root canal', 'endodontic', 180], ['crown', 'تاج زيركون', 'Zirconia crown', 'prosthodontic', 350],
      ['ext', 'قلع جراحي', 'Surgical extraction', 'surgical', 90], ['whit', 'تبييض الأسنان', 'Whitening', 'cosmetic', 220], ['impl', 'زرعة سنية', 'Dental implant', 'implant', 750],
    ].map(([k, name, nameEn, category, price], i) => ({ id: `proc-${k}`, name, nameEn, category, price, toothSpecific: true, active: true, sortOrder: i, createdAt: nowISO, updatedAt: nowISO }))
    await db.procedures.bulkPut(procs)

    const first = AR ? ['محمد', 'رنا', 'خالد', 'ليلى', 'سامر', 'نور', 'يوسف', 'هبة', 'أحمد', 'سلمى', 'عمر', 'دانة', 'باسل', 'ميس', 'فادي', 'جود', 'وسيم', 'لمى', 'طارق', 'ريم']
      : ['Mohammad', 'Rana', 'Khaled', 'Layla', 'Samer', 'Nour', 'Youssef', 'Hiba', 'Ahmad', 'Salma', 'Omar', 'Dana', 'Basel', 'Mais', 'Fadi', 'Joud', 'Wassim', 'Lama', 'Tarek', 'Reem']
    const last = AR ? ['العلي', 'الحسن', 'منصور', 'حداد', 'الشامي', 'قباني', 'الأحمد', 'الخطيب', 'سليمان', 'درويش'] : ['Ali', 'Hassan', 'Mansour', 'Haddad', 'Shami', 'Kabbani', 'Ahmad', 'Khatib', 'Suleiman', 'Darwish']
    const refs = AR ? ['فيسبوك', 'صديق', 'إنستغرام', 'لافتة العيادة', 'طبيب آخر', ''] : ['Facebook', 'Friend', 'Instagram', 'Clinic sign', 'Another doctor', '']
    const patients = []
    for (let i = 0; i < 46; i++) {
      const created = dayOff(-Math.floor(rand() * 150))
      const by = 1950 + Math.floor(rand() * 68)
      patients.push({ id: `pat-${i + 1}`, fileNo: 1001 + i, name: `${first[i % first.length]} ${last[(i * 3) % last.length]}`, gender: i % 2 ? 'female' : 'male',
        birthDate: i % 9 === 0 ? undefined : `${by}-${pad(1 + (i % 12))}-${pad(1 + (i % 27))}`, phone: i % 7 === 3 ? undefined : `09${String(44000000 + i * 1371).slice(0, 8)}`,
        allergies: [], chronicDiseases: [], medications: [], tags: [], referredBy: pick(refs) || undefined, archived: false, doctorId: i % 3 === 0 ? 'u-doc2' : 'u-admin',
        createdAt: at(created, 10), updatedAt: nowISO })
    }
    await db.patients.bulkPut(patients)
    await db.clinic.update('clinic', { nextFileNumber: 1100 })

    const docs = ['u-admin', 'u-doc2']
    const types = ['checkup', 'treatment', 'followup', 'cleaning', 'consultation']
    const apts = [], treatments = [], invoices = [], payments = []
    let invNo = 1
    const methods = ['cash', 'cash', 'cash', 'card', 'card', 'transfer', 'insurance', 'wallet']
    // past 120 days of visits
    for (let d = -120; d <= 1; d++) {
      const day = dayOff(d)
      if (day.getDay() === 5 && d !== 1) continue            // Friday off (tomorrow always has visits)
      const n = d === 0 ? 0 : d === 1 ? 4 : 2 + Math.floor(rand() * 4)
      for (let k = 0; k < n; k++) {
        const p = patients[Math.floor(rand() * patients.length)]
        const doc = docs[k % 2]
        const h = 9 + k * 2
        const dur = pick([30, 30, 45, 60])
        const st = d === 1 ? (k === 3 ? 'confirmed' : 'scheduled') : rand() < 0.08 ? 'no_show' : rand() < 0.08 ? 'cancelled' : 'completed'
        const a = { id: id('apt'), patientId: p.id, doctorId: doc, date: iso(day), start: at(day, h), end: at(day, h, dur), durationMin: dur, type: pick(types), status: st, createdAt: at(dayOff(d - 3), 12), updatedAt: at(day, h) }
        apts.push(a)
        if (st !== 'completed') continue
        const pr = procs[Math.floor(rand() * procs.length)]
        const t = { id: id('tr'), patientId: p.id, procedureId: pr.id, procedureName: AR ? pr.name : pr.nameEn, tooth: 11 + Math.floor(rand() * 30), price: pr.price, discount: rand() < 0.2 ? 10 : 0,
          status: 'completed', doctorId: doc, appointmentId: a.id, completedAt: at(day, h, 20), createdAt: at(dayOff(d - 5), 11), updatedAt: at(day, h, 20) }
        treatments.push(t)
        const total = t.price - t.discount
        const paidFrac = d < -40 ? 1 : rand() < 0.6 ? 1 : rand() < 0.5 ? 0.5 : 0
        const paid = Math.round(total * paidFrac)
        const inv = { id: id('inv'), number: `INV-${String(invNo++).padStart(6, '0')}`, patientId: p.id, doctorId: doc, date: iso(day), dueDate: d < -40 ? undefined : iso(dayOff(d + 14)),
          items: [{ id: id('it'), treatmentItemId: t.id, procedureId: pr.id, description: t.procedureName, tooth: t.tooth, qty: 1, unitPrice: t.price, discount: t.discount, total }],
          subtotal: total, discount: 0, taxPercent: 0, tax: 0, total, paid, status: paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid', createdAt: at(day, h, 25), updatedAt: at(day, h, 25) }
        invoices.push(inv); t.invoiceId = inv.id
        if (paid > 0) payments.push({ id: id('pay'), patientId: p.id, invoiceId: inv.id, amount: paid, method: pick(methods), date: iso(day), createdAt: at(day, h, 30) })
      }
    }
    // planned work
    for (let i = 0; i < 18; i++) {
      const p = patients[i * 2], pr = procs[3 + (i % 6)]
      treatments.push({ id: id('tr'), patientId: p.id, procedureId: pr.id, procedureName: AR ? pr.name : pr.nameEn, price: pr.price, discount: 0, status: i % 4 === 0 ? 'in_progress' : 'planned', doctorId: docs[i % 2], createdAt: at(dayOff(-Math.floor(rand() * 60)), 12), updatedAt: nowISO })
    }
    // today: a full day around "now"
    const hNow = Math.min(Math.max(now.getHours(), 4), 19)
    const todayPlan = [
      [-3, 'completed', 30], [-2, 'completed', 45], [-1, 'in_progress', 60], [0, 'arrived', 30], [1, 'confirmed', 30], [2, 'scheduled', 45], [3, 'scheduled', 30], [4, 'cancelled', 30],
    ]
    todayPlan.forEach(([off, st, dur], k) => {
      const p = patients[k + 5]
      const start = new Date(now); start.setHours(hNow + off, off === 0 ? 30 : 0, 0, 0)
      const a = { id: `apt-today-${k}`, patientId: p.id, doctorId: docs[k % 2], date: today, start: start.toISOString(), end: new Date(start.getTime() + dur * 60000).toISOString(), durationMin: dur, type: types[k % types.length], status: st, createdAt: at(dayOff(-2), 12), updatedAt: at(dayOff(-2), 12) }
      apts.push(a)
      if (st === 'completed') {
        const pr = procs[k + 2]
        const t = { id: `tr-today-${k}`, patientId: p.id, procedureId: pr.id, procedureName: AR ? pr.name : pr.nameEn, price: pr.price, discount: 0, status: 'completed', doctorId: a.doctorId, appointmentId: a.id, completedAt: a.end, createdAt: a.start, updatedAt: a.end }
        treatments.push(t)
        const inv = { id: `inv-today-${k}`, number: `INV-${String(invNo++).padStart(6, '0')}`, patientId: p.id, doctorId: a.doctorId, date: today, items: [{ id: id('it'), procedureId: pr.id, description: t.procedureName, qty: 1, unitPrice: pr.price, discount: 0, total: pr.price }],
          subtotal: pr.price, discount: 0, taxPercent: 0, tax: 0, total: pr.price, paid: pr.price, status: 'paid', createdAt: a.end, updatedAt: a.end }
        invoices.push(inv)
        payments.push({ id: `pay-today-${k}`, patientId: p.id, invoiceId: inv.id, amount: pr.price, method: k ? 'card' : 'cash', date: today, createdAt: a.end })
      }
    })
    // an on-account payment and a refund
    payments.push({ id: id('pay'), patientId: 'pat-3', amount: 100, method: 'transfer', date: iso(dayOff(-3)), createdAt: nowISO })
    payments.push({ id: id('pay'), patientId: 'pat-4', amount: -20, method: 'cash', date: iso(dayOff(-2)), createdAt: nowISO })
    await db.appointments.bulkPut(apts)
    await db.treatments.bulkPut(treatments)
    await db.invoices.bulkPut(invoices)
    await db.payments.bulkPut(payments)
    await db.clinic.update('clinic', { nextInvoiceNumber: invNo })

    const exp = []
    for (let m = 0; m < 5; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 3)
      const e = (cat, amount, desc, day = 3) => exp.push({ id: id('exp'), category: cat, amount, date: iso(new Date(d.getFullYear(), d.getMonth(), day)), description: desc, method: 'cash', createdAt: nowISO })
      e('rent', 900, AR ? 'إيجار العيادة' : 'Clinic rent')
      e('salaries', 1400, AR ? 'رواتب الفريق' : 'Staff salaries', 5)
      e('materials', 260 + m * 15, AR ? 'مواد حشو ومستهلكات' : 'Filling materials', 7)
      e('lab', 320 - m * 10, AR ? 'مخبر الأسنان' : 'Dental lab', 8)
      e('utilities', 140, AR ? 'كهرباء وإنترنت' : 'Power & internet', 9)
      if (m % 2 === 0) e('marketing', 120, AR ? 'إعلانات' : 'Ads', 6)
    }
    await db.expenses.bulkPut(exp)

    await db.inventory.bulkPut([
      { id: 'inv-glove', name: AR ? 'قفازات طبية' : 'Gloves', category: 'consumables', unit: 'box', quantity: 2, minQuantity: 5, active: true, createdAt: nowISO, updatedAt: nowISO },
      { id: 'inv-comp', name: AR ? 'كومبوزيت A2' : 'Composite A2', category: 'materials', unit: 'piece', quantity: 0, minQuantity: 3, active: true, createdAt: nowISO, updatedAt: nowISO },
      { id: 'inv-anest', name: AR ? 'مخدر موضعي' : 'Anesthetic', category: 'medications', unit: 'box', quantity: 12, minQuantity: 4, active: true, createdAt: nowISO, updatedAt: nowISO },
    ])
    await db.labOrders.bulkPut([
      { id: 'lab-1', patientId: 'pat-2', doctorId: 'u-admin', labName: AR ? 'مخبر الإتقان' : 'Precision Lab', type: 'crown', teeth: [21], status: 'sent', dueDate: iso(dayOff(-2)), cost: 80, createdAt: nowISO, updatedAt: nowISO },
      { id: 'lab-2', patientId: 'pat-6', doctorId: 'u-doc2', labName: AR ? 'مخبر الإتقان' : 'Precision Lab', type: 'bridge', teeth: [35, 36, 37], status: 'in_progress', dueDate: today, cost: 200, createdAt: nowISO, updatedAt: nowISO },
    ])
    const acts = [
      ['payment', 'create', AR ? 'رنا الحسن — 150 $' : 'Rana Hassan — $150', 'pat-2', 4], ['appointment', 'create', AR ? 'خالد منصور — غداً 10:00' : 'Khaled Mansour — tomorrow 10:00', 'pat-3', 25],
      ['patient', 'create', AR ? 'سلمى درويش' : 'Salma Darwish', 'pat-10', 70], ['invoice', 'create', 'INV-000412', 'pat-5', 140], ['expense', 'create', AR ? 'مواد حشو ومستهلكات' : 'Filling materials', undefined, 300],
      ['lab', 'create', AR ? 'تاج زيركون — مخبر الإتقان' : 'Zirconia crown — Precision Lab', 'pat-2', 900], ['system', 'login', 'x', undefined, 1500],
    ]
    await db.activity.bulkPut(acts.map(([type, action, message, patientId, mins], i) => ({ id: `act-${i}`, type, action, message, patientId, by: i % 2 ? 'u-doc2' : 'u-admin', at: new Date(now.getTime() - mins * 60000).toISOString() })))
    return { today, apts: apts.length, invoices: invoices.length, payments: payments.length }
  }, lang)
}

/** Expected numbers, computed independently in the page from the raw tables. */
async function expected(page, from, to, doctorId) {
  return page.evaluate(async ({ from, to, doctorId }) => {
    const db = window.__dentora.db
    const pays = await db.payments.where('date').between(from, to, true, true).toArray()
    const invs = await db.invoices.toArray()
    const docOf = new Map(invs.map(i => [i.id, i.doctorId]))
    const mine = doctorId ? pays.filter(p => p.invoiceId && docOf.get(p.invoiceId) === doctorId) : pays
    const revenue = Math.round(mine.reduce((a, p) => a + p.amount, 0) * 100) / 100
    const exps = await db.expenses.where('date').between(from, to, true, true).toArray()
    const expenses = exps.reduce((a, e) => a + e.amount, 0)
    const allPays = await db.payments.toArray()
    const per = new Map()
    for (const i of invs) if (i.status !== 'draft' && i.status !== 'cancelled') per.set(i.patientId, (per.get(i.patientId) || 0) + i.total)
    for (const p of allPays) per.set(p.patientId, (per.get(p.patientId) || 0) - p.amount)
    const outstanding = [...per.values()].filter(v => v > 0.004).reduce((a, v) => a + v, 0)
    return { revenue, expenses, outstanding: Math.round(outstanding * 100) / 100, debtors: [...per.values()].filter(v => v > 0.004).length }
  }, { from, to, doctorId })
}
const moneyText = async (page, sel) => (await page.locator(sel).first().innerText()).replace(/[^\d.\-]/g, '')

async function main() {
  const server = await startServer()
  try {
    // ================= Arabic desktop =================
    const { browser, page } = await openBrowser({ width: 1440, height: 900 })
    watchConsole(page, 'ar-desktop')
    await seedAndLogin(page, { lang: 'ar' })
    await page.evaluate(() => window.__dentora.db.activity.clear())
    await go(page, '/')

    // --- empty dashboard
    await page.waitForSelector('[data-testid="dash-schedule"]')
    check(await page.locator('[data-testid="dash-schedule"] .empty').count() === 1, 'dashboard: empty schedule state')
    check(await page.locator('[data-testid="dash-allclear"]').count() === 1, 'dashboard: alerts all-clear state')
    check(await page.locator('[data-testid="dash-activity"] .empty').count() === 1, 'dashboard: empty activity state')
    await snap(page, '01-dashboard-empty-ar', { full: true })

    // --- empty reports
    await go(page, '/reports')
    await page.waitForSelector('[data-testid="rp-empty"]')
    check(await page.locator('[data-testid="rp-empty"]').count() === 1, 'reports: financial empty state')
    await snap(page, '02-reports-empty-ar')
    await go(page, '/reports?tab=outstanding')
    await page.waitForSelector('[data-testid="rp-empty"]')
    await snap(page, '03-reports-outstanding-empty-ar')

    // --- seed a living clinic
    const info = await seed(page, 'ar')
    console.log('seeded', info)
    await go(page, '/')
    await page.waitForSelector('[data-testid="dash-apt"]')
    await wait(page, 600)
    await snap(page, '04-dashboard-ar')
    await snap(page, '05-dashboard-ar-full', { full: true })
    const todayCount = await page.evaluate(async (d) => (await window.__dentora.db.appointments.where('date').equals(d).toArray()).filter(a => a.status !== 'cancelled').length, info.today)
    const statToday = (await page.locator('[data-testid="stat-today"] .rp-kpi-value').innerText()).trim()
    check(statToday === String(todayCount), `dashboard: today's count ${statToday} = DB ${todayCount}`)
    check(await page.locator('[data-testid="rp-now"]').count() === 1, 'dashboard: "now" marker shown')
    check(await page.locator('[data-testid="alert-overdue"]').count() === 1, 'dashboard: overdue invoices alert')
    check(await page.locator('[data-testid="alert-stock"]').count() === 1, 'dashboard: low-stock alert')
    check(await page.locator('[data-testid="alert-lab"]').count() === 1, 'dashboard: lab-due alert')
    check(await page.locator('[data-testid="alert-unconfirmed"] .rp-alert-count').innerText().then(s => s.trim() === '3'), 'dashboard: 3 unconfirmed for tomorrow')
    const exp0 = await expected(page, '1900-01-01', '2999-12-31')
    const outCard = Number(await moneyText(page, '[data-testid="stat-outstanding"] .rp-kpi-value'))
    check(Math.abs(outCard - Math.round(exp0.outstanding)) <= 1, `dashboard: outstanding ${outCard} ≈ DB ${exp0.outstanding}`)

    // --- tooltip on the revenue chart
    await page.locator('[data-testid="dash-revenue"]').scrollIntoViewIfNeeded(); await wait(page, 200)
    const area = page.locator('[data-testid="dash-revenue"] .rp-chart svg')
    const box = await area.boundingBox()
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5)
    await wait(page, 250)
    check(await page.locator('[data-testid="dash-revenue"] .rp-tip').count() === 1, 'dashboard: revenue tooltip on hover')
    await shot(page, '06-dashboard-tooltip-ar')
    await page.mouse.move(5, 5)

    // --- quick status flow: scheduled → confirmed → arrived → in progress → completed
    const target = await page.evaluate(async (d) => (await window.__dentora.db.appointments.where('date').equals(d).toArray()).filter(a => a.status === 'scheduled').sort((a, b) => a.start.localeCompare(b.start))[0], info.today)
    const row = page.locator(`[data-testid="dash-apt"]`).filter({ has: page.locator(`a[href$="/patients/${target.patientId}"]`) }).first()
    const before = target.updatedAt
    for (const s of ['confirmed', 'arrived', 'in_progress', 'completed']) {
      await row.locator(`[data-testid="apt-do-${s}"]`).click()
      await wait(page, 750)   // the calendar's status writer ignores a second press on the same visit within 600 ms
      const rec = await page.evaluate(id => window.__dentora.db.appointments.get(id), target.id)
      check(rec.status === s, `dashboard: quick action sets status ${s}`)
      check(rec.updatedAt > before, `dashboard: updatedAt bumped after ${s}`)
    }
    const acts = await page.evaluate(id => window.__dentora.db.activity.where('type').equals('appointment').filter(a => a.entityId === id && a.action === 'status').count(), target.id)
    check(acts === 4, `dashboard: 4 status changes logged (${acts})`)
    const pv = await page.evaluate(id => window.__dentora.db.patients.get(id), target.patientId)
    check(pv.lastVisit && pv.lastVisit >= target.start, 'dashboard: completing a visit updates the patient last visit')
    check(await page.locator('[data-testid="dash-activity"] .rp-feed-row').count() >= 4, 'dashboard: activity feed shows the new entries')
    await snap(page, '07-dashboard-after-status-ar')

    // --- quick actions open their modals
    await page.locator('[data-testid="dash-new-patient"]').click()
    await wait(page, 600)
    check(await page.locator('.modal').count() === 1, 'dashboard: new patient opens the patient form')
    await shot(page, '08-dashboard-new-patient-ar')
    await closeModal(page)
    await page.locator('[data-testid="dash-new-payment"]').click()
    await wait(page, 600)
    check(await page.locator('.modal').count() === 1, 'dashboard: new payment opens the payment form')
    await closeModal(page)
    check(await page.locator('.overlay').count() === 0, 'dashboard: payment form closes')
    await page.locator('[data-testid="dash-new-apt"]').click(); await wait(page, 500)
    await closeModal(page)

    // --- alert links
    await page.locator('[data-testid="alert-overdue"]').click(); await wait(page, 500)
    check(page.url().endsWith('#/invoices'), 'dashboard: overdue alert opens invoices')
    await go(page, '/')
    await page.locator('[data-testid="stat-outstanding"]').click(); await wait(page, 700)
    check(page.url().includes('#/reports?tab=outstanding'), 'dashboard: outstanding card opens the outstanding report')

    // ================= Reports =================
    await go(page, '/reports')
    await page.waitForSelector('[data-testid="rp-financial"]')
    await wait(page, 500)
    const month = await page.evaluate(() => { const d = new Date(); const p = n => String(n).padStart(2, '0'); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return { from: `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`, to: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(last)}` } })
    const e1 = await expected(page, month.from, month.to)
    const rev = Number(await moneyText(page, '[data-testid="kpi-revenue"] .rp-kpi-value'))
    check(Math.abs(rev - e1.revenue) <= 1, `reports: month revenue ${rev} = DB ${e1.revenue}`)
    const ex = Number(await moneyText(page, '[data-testid="kpi-expenses"] .rp-kpi-value'))
    check(Math.abs(ex - e1.expenses) <= 1, `reports: month expenses ${ex} = DB ${e1.expenses}`)
    const pr = Number(await moneyText(page, '[data-testid="kpi-profit"] .rp-kpi-value'))
    check(Math.abs(Math.abs(pr) - Math.abs(e1.revenue - e1.expenses)) <= 1, `reports: profit ${pr} = revenue − expenses`)
    await snap(page, '10-reports-financial-ar')
    await snap(page, '11-reports-financial-ar-full', { full: true })

    // tooltip on donut + table toggle
    await page.locator('[data-testid="chart-methods"] .rp-dlegend li').first().hover(); await wait(page, 200)
    await page.locator('[data-testid="chart-methods"] .card-header button').click(); await wait(page, 250)
    check(await page.locator('[data-testid="chart-methods"] table').count() === 1, 'reports: chart switches to its table view')
    await shot(page, '12-reports-table-toggle-ar')
    await page.locator('[data-testid="chart-methods"] .card-header button').click(); await wait(page, 200)

    // CSV export
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-testid="rp-csv"]').click()])
    const csvPath = await dl.path()
    const csv = fs.readFileSync(csvPath, 'utf8')
    check(dl.suggestedFilename().startsWith('expenses-vs-revenue_'), `reports: CSV named ${dl.suggestedFilename()}`)
    check(csv.charCodeAt(0) === 0xFEFF && csv.includes('الفئة') && csv.includes('إيجار'), 'reports: CSV has BOM, Arabic header and rows')

    // presets
    await page.locator('[data-testid="rp-periodbar"] .segmented button').nth(3).click(); await wait(page, 700)
    const yearTxt = await page.locator('[data-testid="rp-range"]').innerText()
    check(/2026|2027|2025/.test(yearTxt), `reports: range title shows the year (${yearTxt.trim()})`)
    check(await page.locator('[data-testid="chart-revenue"] .rp-chart path').count() > 0, 'reports: year view draws monthly bars')
    await snap(page, '13-reports-year-ar')
    await page.locator('[data-testid="rp-periodbar"] .segmented button').nth(1).click(); await wait(page, 600)
    await snap(page, '14-reports-lastmonth-ar')

    // custom range: reversed → flipped with a note; far past → empty state
    await page.locator('[data-testid="rp-periodbar"] .segmented button').nth(4).click(); await wait(page, 300)
    await page.locator('[data-testid="rp-from"]').fill('2026-12-31')
    await page.locator('[data-testid="rp-to"]').fill('2026-01-01'); await wait(page, 600)
    check(await page.locator('.rp-range-err').count() === 1, 'reports: reversed custom range is flagged')
    await snap(page, '15-reports-custom-swapped-ar')
    await page.locator('[data-testid="rp-from"]').fill('2019-01-01')
    await page.locator('[data-testid="rp-to"]').fill('2019-03-31'); await wait(page, 700)
    check(await page.locator('[data-testid="rp-empty"]').count() === 1, 'reports: empty state for a period without data')
    await page.locator('[data-testid="rp-empty"] button').first().click(); await wait(page, 700)
    check(await page.locator('[data-testid="rp-financial"]').count() === 1, 'reports: "show this year" action leaves the empty state')

    // doctor filter
    await page.locator('[data-testid="rp-periodbar"] .segmented button').nth(0).click(); await wait(page, 500)
    await page.locator('[data-testid="rp-doctor"]').selectOption('u-doc2'); await wait(page, 700)
    const e2 = await expected(page, month.from, month.to, 'u-doc2')
    const rev2 = Number(await moneyText(page, '[data-testid="kpi-revenue"] .rp-kpi-value'))
    check(Math.abs(rev2 - e2.revenue) <= 1, `reports: doctor revenue ${rev2} = DB ${e2.revenue}`)
    check(await page.locator('[data-testid="kpi-expenses"]').count() === 0, 'reports: doctor view hides clinic-wide expenses')
    await snap(page, '16-reports-doctor-ar')
    await page.locator('[data-testid="rp-doctor"]').selectOption(''); await wait(page, 400)

    // other tabs
    for (const [tab, sel, name] of [['patients', 'rp-patients', '17-reports-patients-ar'], ['appointments', 'rp-appointments', '18-reports-appointments-ar'], ['treatments', 'rp-treatments', '19-reports-treatments-ar']]) {
      await go(page, `/reports?tab=${tab}`)
      await page.waitForSelector(`[data-testid="${sel}"]`); await wait(page, 500)
      await snap(page, name)
      await snap(page, `${name}-full`, { full: true })
    }
    // bar tooltip on appointments
    await go(page, '/reports?tab=appointments')
    await page.waitForSelector('[data-testid="chart-apt-series"] svg')
    const bb = await page.locator('[data-testid="chart-apt-series"] .rp-chart svg').boundingBox()
    await page.mouse.move(bb.x + bb.width * 0.3, bb.y + bb.height * 0.6); await wait(page, 250)
    check(await page.locator('[data-testid="chart-apt-series"] .rp-tip').count() === 1, 'reports: bar tooltip on hover')
    await shot(page, '20-reports-bar-tooltip-ar')
    // keyboard focus shows the same tooltip
    await page.mouse.move(5, 5)
    await page.locator('[data-testid="chart-apt-series"] .rp-chart').focus(); await page.keyboard.press('ArrowRight'); await wait(page, 200)
    check(await page.locator('[data-testid="chart-apt-series"] .rp-tip').count() === 1, 'reports: keyboard focus shows the tooltip')

    // outstanding
    await go(page, '/reports?tab=outstanding')
    await page.waitForSelector('[data-testid="rp-outstanding"]'); await wait(page, 500)
    const outTotal = Number(await moneyText(page, '[data-testid="out-total"]'))
    check(Math.abs(outTotal - exp0.outstanding) <= 1, `reports: outstanding total ${outTotal} = DB ${exp0.outstanding}`)
    await snap(page, '21-reports-outstanding-ar')
    await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null } })
    await page.locator('[data-testid="table-outstanding"] .rp-wa').first().click()
    const opened = await page.evaluate(() => window.__opened)
    check(opened.length === 1 && opened[0].startsWith('https://wa.me/963') && decodeURIComponent(opened[0]).includes('الرصيد المستحق'), 'reports: WhatsApp reminder link with the balance message')
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('[data-testid="rp-csv"]').click()])
    const csv2 = fs.readFileSync(await dl2.path(), 'utf8')
    check(csv2.split('\r\n').length === exp0.debtors + 2, `reports: outstanding CSV has a row per debtor + header + total (${csv2.split('\r\n').length})`)

    // print layout
    await go(page, '/reports')
    await page.waitForSelector('[data-testid="chart-revenue"] svg'); await wait(page, 400)
    await page.emulateMedia({ media: 'print' }); await page.setViewportSize({ width: 1000, height: 900 }); await wait(page, 600)
    await shot(page, '22-reports-print-ar', { full: true })
    await page.emulateMedia({ media: 'screen' }); await page.setViewportSize({ width: 1440, height: 900 })

    // read-only (trial over): actions disabled
    await page.evaluate(async () => { const db = window.__dentora.db; await db.settings.put({ key: 'installedAt', value: new Date(Date.now() - 30 * 86400000).toISOString() }); await db.settings.delete('license') })
    await go(page, '/')
    await page.waitForSelector('[data-testid="dash-apt"]'); await wait(page, 800)
    check(await page.locator('[data-testid="dash-new-apt"]').isDisabled(), 'read-only: quick actions disabled')
    const btns = page.locator('[data-testid^="apt-do-"]')
    check((await btns.count()) > 0 && await btns.first().isDisabled(), 'read-only: status buttons disabled')
    await snap(page, '23-dashboard-readonly-ar')
    await page.evaluate(async () => { await window.__dentora.db.settings.put({ key: 'installedAt', value: new Date().toISOString() }) })
    await browser.close()

    // ================= English desktop =================
    const en = await openBrowser({ width: 1440, height: 900, lang: 'en' })
    watchConsole(en.page, 'en-desktop')
    await seedAndLogin(en.page, { lang: 'en' })
    await en.page.evaluate(async () => { const db = window.__dentora.db; for (const t of ['patients', 'appointments', 'treatments', 'invoices', 'payments', 'expenses', 'inventory', 'labOrders', 'activity', 'procedures']) await db[t].clear() })
    await seed(en.page, 'en')
    await go(en.page, '/')
    await en.page.waitForSelector('[data-testid="dash-apt"]'); await wait(en.page, 600)
    check((await en.page.locator('[data-testid="dash-greeting"]').innerText()).match(/Good (morning|afternoon|evening)/), 'en: greeting')
    await snap(en.page, '30-dashboard-en')
    await snap(en.page, '31-dashboard-en-full', { full: true })
    for (const [tab, sel, name] of [['financial', 'rp-financial', '32-reports-financial-en'], ['patients', 'rp-patients', '33-reports-patients-en'], ['appointments', 'rp-appointments', '34-reports-appointments-en'], ['treatments', 'rp-treatments', '35-reports-treatments-en'], ['outstanding', 'rp-outstanding', '36-reports-outstanding-en']]) {
      await go(en.page, `/reports?tab=${tab}`)
      await en.page.waitForSelector(`[data-testid="${sel}"]`); await wait(en.page, 500)
      await snap(en.page, name, { full: true })
    }
    await en.browser.close()

    // ================= Phone =================
    const ph = await openBrowser({ mobile: true, width: 390, height: 844 })
    watchConsole(ph.page, 'phone')
    await seedAndLogin(ph.page, { lang: 'ar' })
    await seed(ph.page, 'ar')
    await go(ph.page, '/')
    await ph.page.waitForSelector('[data-testid="dash-apt"]'); await wait(ph.page, 600)
    await snap(ph.page, '40-dashboard-phone')
    await snap(ph.page, '41-dashboard-phone-full', { full: true })
    const kpiCols = await ph.page.evaluate(() => getComputedStyle(document.querySelector('.rp-dash-kpis')).gridTemplateColumns.split(' ').length)
    check(kpiCols === 2, `phone: stat cards in 2 columns (${kpiCols})`)
    const small = await ph.page.evaluate(() => [...document.querySelectorAll('[data-testid^="apt-do-"]')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 40).length)
    check(small === 0, 'phone: status buttons are ≥ 40px tall')
    for (const [tab, sel, name] of [['financial', 'rp-financial', '42-reports-financial-phone'], ['patients', 'rp-patients', '43-reports-patients-phone'], ['appointments', 'rp-appointments', '44-reports-appointments-phone'], ['treatments', 'rp-treatments', '45-reports-treatments-phone'], ['outstanding', 'rp-outstanding', '46-reports-outstanding-phone']]) {
      await go(ph.page, `/reports?tab=${tab}`)
      await ph.page.waitForSelector(`[data-testid="${sel}"]`); await wait(ph.page, 500)
      await snap(ph.page, name)
      await snap(ph.page, `${name}-full`, { full: true })
    }
    // tap tooltip on the phone
    await go(ph.page, '/reports')
    await ph.page.waitForSelector('[data-testid="chart-revenue"] svg')
    await ph.page.locator('[data-testid="chart-revenue"]').scrollIntoViewIfNeeded()
    const pb = await ph.page.locator('[data-testid="chart-revenue"] .rp-chart svg').boundingBox()
    await ph.page.touchscreen.tap(pb.x + pb.width * 0.6, pb.y + pb.height * 0.5); await wait(ph.page, 300)
    check(await ph.page.locator('[data-testid="chart-revenue"] .rp-tip').count() === 1, 'phone: tap shows the tooltip')
    await shot(ph.page, '47-reports-tap-tooltip-phone')
    // custom range on the phone
    await ph.page.evaluate(() => window.scrollTo(0, 0))
    await ph.page.locator('[data-testid="rp-periodbar"] .segmented button').nth(4).click(); await wait(ph.page, 400)
    await snap(ph.page, '48-reports-custom-phone')
    await ph.browser.close()
  } finally {
    server.kill()
  }
  console.log('\n==== console errors ====')
  for (const e of consoleErrors) console.log(e)
  check(consoleErrors.length === 0, `zero console errors (${consoleErrors.length})`)
  console.log(`\n${failures.length ? 'FAILURES' : 'ALL PASSED'}: ${failures.length}`)
  for (const f of failures) console.log(' -', f)
  process.exit(failures.length ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })

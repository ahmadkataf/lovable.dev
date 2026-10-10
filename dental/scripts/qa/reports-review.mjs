// Adversarial review QA for the dashboard + reports module: edge data (very long names, zero and negative amounts, a huge
// balance), double clicks, Escape / Enter in the quick-action forms, deleted doctors / procedures / patients, permissions,
// like-for-like deltas, phone tables. Usage: npx vite build --outDir /tmp/dist-reports-r && QA_DIST=/tmp/dist-reports-r QA_PORT=4357 QA_SHOTS=qa-shots/reports-review node scripts/qa/reports-review.mjs
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
async function sane(page, label) {
  const bad = await page.evaluate(() => {
    const txt = document.body.innerText
    const m = txt.match(/NaN|undefined|Infinity|\[object/)
    const svg = [...document.querySelectorAll('svg [d], svg [cx], svg [x], svg [y]')].some(e => ['d', 'cx', 'x', 'y', 'width', 'height'].some(a => /NaN|Infinity/.test(e.getAttribute(a) || '')))
    return (m ? m[0] : '') + (svg ? ' svg-NaN' : '')
  })
  check(!bad, `${label}: no NaN/undefined in text or svg (${bad})`)
}
async function tablesFit(page, label) {
  const bad = await page.evaluate(() => [...document.querySelectorAll('.table-wrap')].filter(w => w.offsetParent && w.scrollWidth > w.clientWidth + 1).map(w => `${w.scrollWidth}>${w.clientWidth}`))
  check(!bad.length, `${label}: every table fits its card, no figures scrolled out of view (${bad.join(' ')})`)
}
async function snap(page, name, opts) { await noOverflow(page, name); await sane(page, name); await tablesFit(page, name); await shot(page, name, opts) }
function watchConsole(page, tag) {
  page.on('pageerror', e => consoleErrors.push(`[${tag}] ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[${tag}] ${m.text()}`) })
}
const num = s => Number(String(s).replace(/[^\d.\-]/g, ''))
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


const LONG_PAT = 'عبد الرحمن بن محمد بن عبد الله بن عبد العزيز آل الشيخ القحطاني الدوسري المطيري العنزي الشمري الحربي'
const LONG_DOC = 'د. عبد الرحمن بن سليمان بن عبد العزيز الخطيب الحسيني الدمشقي'
const LONG_PROC = 'تركيب جسر خزفي معدني ثلاثي الوحدات مع معالجة لبية وإعادة بناء التاج بالكامل'
/** Edge data: a very long patient / doctor / procedure / referral, a huge balance, a zero payment and a big refund today. */
async function seedEdge(page) {
  return page.evaluate(async ({ LONG_PAT, LONG_DOC, LONG_PROC }) => {
    const db = window.__dentora.db
    const pad = n => String(n).padStart(2, '0')
    const now = new Date()
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const at = (h, m = 0) => { const x = new Date(now); x.setHours(h, m, 0, 0); return x.toISOString() }
    const nowISO = now.toISOString()
    await db.users.put({ id: 'u-long', name: LONG_DOC, role: 'doctor', pinHash: 'x', pinSalt: 'x', color: '#EA580C', specialty: 'x', active: true, createdAt: nowISO, updatedAt: nowISO })
    await db.patients.put({ id: 'pat-long', fileNo: 99999, name: LONG_PAT, gender: 'male', birthDate: '1980-02-02', phone: '0999123456', allergies: [], chronicDiseases: [], medications: [], tags: [],
      referredBy: 'إعلان طويل جداً على وسائل التواصل الاجتماعي من حملة الصيف الماضي للعيادة', archived: false, doctorId: 'u-long', createdAt: nowISO, updatedAt: nowISO })
    await db.procedures.put({ id: 'proc-long', name: LONG_PROC, nameEn: 'Very long three-unit porcelain-fused-to-metal bridge with root canal and full crown build-up', category: 'prosthodontic', price: 1234567.89, toothSpecific: true, active: true, sortOrder: 99, createdAt: nowISO, updatedAt: nowISO })
    await db.appointments.put({ id: 'apt-long', patientId: 'pat-long', doctorId: 'u-long', date: today, start: at(8, 15), end: at(8, 45), durationMin: 30, type: 'emergency', status: 'scheduled', createdAt: nowISO, updatedAt: nowISO })
    await db.treatments.put({ id: 'tr-long', patientId: 'pat-long', procedureId: 'proc-long', procedureName: LONG_PROC, price: 1234567.89, discount: 0, status: 'completed', doctorId: 'u-long', completedAt: at(8, 40), createdAt: at(8, 20), updatedAt: nowISO })
    await db.invoices.put({ id: 'inv-long', number: 'INV-LONG', patientId: 'pat-long', doctorId: 'u-long', date: today, items: [{ id: 'it-long', procedureId: 'proc-long', treatmentItemId: 'tr-long', description: LONG_PROC, qty: 1, unitPrice: 1234567.89, discount: 0, total: 1234567.89 }],
      subtotal: 1234567.89, discount: 0, taxPercent: 0, tax: 0, total: 1234567.89, paid: 0, status: 'unpaid', createdAt: nowISO, updatedAt: nowISO })
    await db.payments.bulkPut([
      { id: 'pay-zero', patientId: 'pat-long', invoiceId: 'inv-long', amount: 0, method: 'cash', date: today, createdAt: nowISO },
      { id: 'pay-refund', patientId: 'pat-1', amount: -500, method: 'cash', date: today, createdAt: nowISO },
    ])
    return today
  }, { LONG_PAT, LONG_DOC, LONG_PROC })
}

const statNum = async (page, id) => num(await page.locator(`[data-testid="${id}"] .rp-kpi-value`).innerText())
const actCount = (page, where) => page.evaluate(w => window.__dentora.db.activity.filter(a => Object.entries(w).every(([k, v]) => a[k] === v)).count(), where)
const TABS = ['financial', 'patients', 'appointments', 'treatments', 'outstanding']

async function main() {
  const server = await startServer()
  try {
    // ======================= Arabic desktop =======================
    const { browser, page } = await openBrowser({ width: 1440, height: 900 })
    watchConsole(page, 'ar')
    await seedAndLogin(page, { lang: 'ar' })
    await page.evaluate(() => window.__dentora.db.activity.clear())

    // ---- empty clinic: every tab has its empty state and nothing to export
    await go(page, '/')
    await page.waitForSelector('[data-testid="dash-schedule"]'); await wait(page, 500)
    await sane(page, 'empty dashboard')
    for (const id of ['stat-today', 'stat-rev-today', 'stat-rev-month', 'stat-outstanding']) check((await statNum(page, id)) === 0, `empty dashboard: ${id} is 0`)
    for (const tab of TABS) {
      await go(page, `/reports?tab=${tab}`)
      await page.waitForSelector('[data-testid="rp-empty"]', { timeout: 6000 }).catch(() => {})
      check(await page.locator('[data-testid="rp-empty"]').count() === 1, `empty: ${tab} shows its empty state`)
      check(await page.locator('[data-testid="rp-csv"]').isDisabled(), `empty: ${tab} has nothing to export`)
      await snap(page, `e-${tab}`)
    }

    // ---- a living clinic + edge records
    const info = await seed(page, 'ar')
    const today = await seedEdge(page)
    await go(page, '/')
    await page.waitForSelector('[data-testid="dash-apt"]'); await wait(page, 700)
    await snap(page, 'r01-dashboard-edge-ar', { full: true })
    const dbRevToday = await page.evaluate(async d => (await window.__dentora.db.payments.where('date').equals(d).toArray()).reduce((a, p) => a + p.amount, 0), today)
    check((await statNum(page, 'stat-rev-today')) === dbRevToday, `dashboard: negative revenue today shown as ${dbRevToday}`)
    const longName = await page.locator('[data-testid="dash-apt"] .rp-apt-name').first().evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth, w: e.getBoundingClientRect().width }))
    check(longName.w < 700, `dashboard: the long patient name is truncated inside its row (${Math.round(longName.w)}px)`)

    // ---- double click on a quick status button must not skip a step
    const target = await page.evaluate(async d => (await window.__dentora.db.appointments.where('date').equals(d).toArray()).filter(a => a.status === 'scheduled' && a.id !== 'apt-long').sort((a, b) => a.start.localeCompare(b.start))[0], today)
    const row = page.locator('[data-testid="dash-apt"]').filter({ has: page.locator(`a[href$="/patients/${target.patientId}"]`) }).first()
    await row.scrollIntoViewIfNeeded(); await wait(page, 200)
    const bb = await row.locator('[data-testid="apt-do-confirmed"]').boundingBox()
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2)
    await wait(page, 160)
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2)
    await wait(page, 900)
    const rec = await page.evaluate(id => window.__dentora.db.appointments.get(id), target.id)
    check(rec.status === 'confirmed', `dashboard: a double click on "confirm" only confirms (status ${rec.status})`)
    check(rec.updatedAt > target.updatedAt, 'dashboard: updatedAt bumped')
    check((await actCount(page, { type: 'appointment', action: 'status', entityId: target.id })) === 1, 'dashboard: exactly one status activity row')
    // complete the visit through the remaining steps and check the patient's last visit
    for (const s of ['arrived', 'in_progress', 'completed']) { await row.locator(`[data-testid="apt-do-${s}"]`).click(); await wait(page, 750) }
    const done = await page.evaluate(id => window.__dentora.db.appointments.get(id), target.id)
    const pv = await page.evaluate(id => window.__dentora.db.patients.get(id), target.patientId)
    check(done.status === 'completed' && pv.lastVisit && new Date(pv.lastVisit) >= new Date(target.start), 'dashboard: completing a visit sets status and the patient last visit')
    check((await actCount(page, { type: 'appointment', action: 'status', entityId: target.id })) === 4, 'dashboard: four status changes logged')

    // ---- quick actions: Escape closes, Enter submits
    const newBefore = await statNum(page, 'stat-new')
    await page.locator('[data-testid="dash-new-patient"]').click(); await wait(page, 800)
    check(await page.locator('.modal').count() === 1, 'dashboard: new patient opens the form')
    await page.keyboard.press('Escape'); await wait(page, 450)
    check(await page.locator('.modal').count() === 0, 'dashboard: Escape closes the patient form')
    await page.locator('[data-testid="dash-new-patient"]').click(); await wait(page, 800)
    await page.locator('#pt-patient-form input[maxlength="120"]').fill('مريض اختبار المراجعة')
    await page.locator('#pt-patient-form input[type="tel"]').first().fill('0933111222')
    await page.locator('#pt-patient-form input[type="tel"]').first().press('Enter')
    await page.locator('#pt-patient-form input[type="tel"]').first().press('Enter').catch(() => {})
    await wait(page, 1200)
    const created = await page.evaluate(() => window.__dentora.db.patients.filter(p => p.name === 'مريض اختبار المراجعة').toArray())
    check(created.length === 1 && !!created[0].id && !!created[0].createdAt && !!created[0].updatedAt && created[0].fileNo > 0, `Enter submits the patient form once (${created.length} record)`)
    check(page.url().includes(`/patients/${created[0]?.id}`), 'new patient: opens the patient file')
    check((await actCount(page, { type: 'patient', action: 'create', patientId: created[0]?.id })) === 1, 'new patient: one activity row')
    await go(page, '/')
    await page.waitForSelector('[data-testid="dash-apt"]'); await wait(page, 500)
    check((await statNum(page, 'stat-new')) === newBefore + 1, `dashboard: new patients this month ${newBefore} → ${newBefore + 1}`)

    const revBefore = await statNum(page, 'stat-rev-today')
    await page.locator('[data-testid="dash-new-payment"]').click(); await wait(page, 800)
    check(await page.locator('.modal').count() === 1, 'dashboard: new payment opens the form')
    await page.locator('.modal .bl-picker input').fill('مريض اختبار المراجعة'); await wait(page, 400)
    await page.locator('.modal .bl-picker input').press('Enter'); await wait(page, 500)
    await page.locator('.modal input[type="number"]').first().fill('50')
    await page.locator('.modal input[type="number"]').first().press('Enter')
    await page.locator('.modal input[type="number"]').first().press('Enter').catch(() => {})
    await wait(page, 1200)
    const pays = await page.evaluate(id => window.__dentora.db.payments.where('patientId').equals(id).toArray(), created[0]?.id)
    check(pays.length === 1 && pays[0].amount === 50 && pays[0].date === today && !!pays[0].createdAt, `payment: one record of 50 today (${pays.length})`)
    check((await actCount(page, { type: 'payment', action: 'create' })) >= 1, 'payment: activity row')
    check(await page.locator('.modal').count() === 0, 'payment: the form closes after saving')
    await wait(page, 400)
    check((await statNum(page, 'stat-rev-today')) === revBefore + 50, `dashboard: revenue today live ${revBefore} → ${revBefore + 50}`)
    check(await page.locator('[data-testid="dash-activity"] .rp-feed-row').first().innerText().then(s => s.includes('مريض اختبار المراجعة')), 'dashboard: the payment tops the activity feed')
    await page.locator('[data-testid="dash-new-apt"]').click(); await wait(page, 800)
    check(await page.locator('.modal').count() === 1, 'dashboard: new appointment opens the form')
    await page.keyboard.press('Escape'); await wait(page, 450)
    if (await page.locator('.modal').count()) { await page.keyboard.press('Escape'); await wait(page, 450) }
    check(await page.locator('.modal').count() === 0, 'dashboard: Escape closes the appointment form')
    for (const x of await page.locator('.toast-x').all()) await x.click().catch(() => {})
    await wait(page, 300)
    await snap(page, 'r02-dashboard-after-flows-ar')

    // ---- reports: deltas compare like with like (the elapsed part of the period)
    await go(page, '/reports')
    await page.waitForSelector('[data-testid="kpi-revenue"] .rp-kpi-value'); await wait(page, 500)
    const exp = await page.evaluate(async () => {
      const db = window.__dentora.db
      const pad = n => String(n).padStart(2, '0')
      const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const now = new Date()
      const from = iso(new Date(now.getFullYear(), now.getMonth(), 1)), to = iso(now)
      const pFrom = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      const pEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      const pTo = iso(new Date(Math.min(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).getTime(), pEnd.getTime())))
      const sum = async (a, b) => (await db.payments.where('date').between(a, b, true, true).toArray()).reduce((s, p) => s + p.amount, 0)
      const cur = await sum(from, to), prev = await sum(pFrom, pTo)
      return { cur, prev, d: Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10 }
    })
    const dTxt = await page.locator('[data-testid="kpi-revenue"] .rp-delta').innerText().catch(() => '')
    const shown = num(dTxt)
    const want = Math.abs(exp.d) >= 10 ? Math.round(exp.d) : exp.d
    check(Math.abs(shown - want) < 0.11, `reports: revenue delta compares the same days of last month (${dTxt.trim()} vs expected ${want}%)`)
    await snap(page, 'r03-financial-edge-ar', { full: true })

    // doctor filter: only that doctor's bars
    await page.locator('[data-testid="rp-doctor"]').selectOption('u-doc2'); await wait(page, 800)
    const docBars = await page.locator('[data-testid="chart-doctors"] .rp-hb').count()
    check(docBars === 1, `reports: doctor filter leaves one bar in "revenue by doctor" (${docBars})`)
    await snap(page, 'r04-financial-doctor-ar', { full: true })
    await page.locator('[data-testid="rp-doctor"]').selectOption(''); await wait(page, 500)

    // custom: one day, cleared field
    await page.locator('[data-testid="rp-periodbar"] .segmented button').nth(4).click(); await wait(page, 300)
    await page.locator('[data-testid="rp-from"]').fill(today)
    await page.locator('[data-testid="rp-to"]').fill(today); await wait(page, 700)
    await snap(page, 'r05-custom-one-day-ar', { full: true })
    check(await page.locator('[data-testid="chart-methods"] .rp-dl-val.neg').count() >= 1, 'reports: a method with more refunds than takings stays in the donut legend (negative value)')
    for (const tab of ['patients', 'appointments', 'treatments']) {
      await page.locator(`.rp-tabs .tab`).nth(TABS.indexOf(tab)).click(); await wait(page, 700)
      await sane(page, `one-day ${tab}`)
    }
    await page.locator('.rp-tabs .tab').nth(0).click(); await wait(page, 400)
    await page.locator('[data-testid="rp-from"]').fill(''); await wait(page, 500)
    check(await page.locator('[data-testid="rp-periodbar"] .field-error, [data-testid="rp-periodbar"] .error, [data-testid="rp-periodbar"] [role="alert"]').count() >= 1 || (await page.locator('[data-testid="rp-periodbar"]').innerText()).includes('تاريخ'), 'reports: a cleared date shows an inline error')
    await sane(page, 'cleared custom date')
    await snap(page, 'r06-custom-cleared-ar')
    await page.locator('[data-testid="rp-periodbar"] .segmented button').nth(3).click(); await wait(page, 700)
    for (const tab of TABS) {
      await go(page, `/reports?tab=${tab}`); await wait(page, 500)
      await snap(page, `r1-${tab}-year-ar`, { full: true })
    }

    await go(page, '/reports'); await page.locator('[data-testid="rp-periodbar"] .segmented button').nth(0).click(); await wait(page, 500)
    await go(page, '/reports?tab=appointments'); await wait(page, 500)
    check((await page.locator('[data-testid="table-doctors"] .card-header').innerText()).includes('حتى اليوم'), 'reports: utilisation of the running month is measured up to today')
        // ---- deleting referenced records keeps every screen working
    await page.evaluate(async () => {
      const db = window.__dentora.db
      await db.users.delete('u-long')                // a doctor with appointments, treatments and invoices
      await db.procedures.delete('proc-crown')       // a procedure referenced by treatments and invoice lines
    })
    for (const tab of TABS) {
      await go(page, `/reports?tab=${tab}`); await wait(page, 500)
      await sane(page, `after deletes: ${tab}`)
    }
    await go(page, '/reports?tab=appointments'); await wait(page, 500)
    check((await page.locator('[data-testid="table-doctors"]').innerText()).includes('غير محدد'), 'reports: appointments of a deleted doctor show as "unassigned"')
    const outBefore = await page.evaluate(() => 0)
    await go(page, '/reports?tab=outstanding'); await wait(page, 500)
    const totalBefore = num(await page.locator('[data-testid="out-total"]').innerText())
    const longDue = await page.evaluate(async () => { const inv = await window.__dentora.db.invoices.where('patientId').equals('pat-long').toArray(); const pay = await window.__dentora.db.payments.where('patientId').equals('pat-long').toArray(); return inv.reduce((a, i) => a + i.total, 0) - pay.reduce((a, p) => a + p.amount, 0) })
    await page.evaluate(async () => {
      const db = window.__dentora.db
      const tables = ['appointments', 'teeth', 'plans', 'treatments', 'invoices', 'payments', 'prescriptions', 'labOrders', 'files', 'notes', 'activity']
      await db.transaction('rw', [db.patients, ...tables.map(t => db[t])], async () => { for (const t of tables) await db[t].where('patientId').equals('pat-long').delete(); await db.patients.delete('pat-long') })
    })
    await wait(page, 800)
    const totalAfter = num(await page.locator('[data-testid="out-total"]').innerText())
    check(Math.abs(totalBefore - longDue - totalAfter) < 1, `reports: deleting a patient updates the outstanding total live (${totalBefore} → ${totalAfter})`)
    await go(page, '/'); await page.waitForSelector('[data-testid="dash-apt"]'); await wait(page, 500)
    await sane(page, 'dashboard after deletes')
    check(await page.locator('[data-testid="dash-apt"]').filter({ hasText: 'عبد الرحمن' }).count() === 0, 'dashboard: the deleted patient left today\'s schedule')
    const unHref = await page.locator('[data-testid="alert-unconfirmed"]').getAttribute('href')
    check(/view=day&date=\d{4}-\d{2}-\d{2}/.test(unHref || ''), `dashboard: the unconfirmed alert opens tomorrow in the calendar (${unHref})`)

    // ---- receptionist: dashboard works, finances stay out of reach
    await page.evaluate(() => localStorage.setItem('dentora.session', 'u-rec'))
    await go(page, '/'); await page.reload(); await page.waitForLoadState('networkidle'); await wait(page, 900)
    await page.waitForSelector('[data-testid="dash-schedule"]')
    await sane(page, 'receptionist dashboard')
    const revHref = await page.locator('[data-testid="stat-rev-month"]').getAttribute('href')
    check(!(revHref || '').includes('reports'), `receptionist: the revenue card does not lead to reports (${revHref})`)
    check(await page.locator('[data-testid="dash-revenue"] .card-header button').filter({ hasText: 'التقارير' }).count() === 0, 'receptionist: no "Reports" link on the revenue chart')
    check(await page.locator('[data-testid="apt-do-confirmed"], [data-testid="apt-do-arrived"]').count() > 0, 'receptionist: can still move the visits of the day along')
    await snap(page, 'r07-dashboard-receptionist-ar')
    await go(page, '/reports'); await wait(page, 600)
    check(await page.locator('[data-testid="reports-page"]').count() === 0 && await page.locator('.empty').count() >= 1, 'receptionist: /reports shows a no-permission state, no figures')
    await snap(page, 'r08-reports-denied-ar')
    await page.evaluate(() => localStorage.setItem('dentora.session', 'u-doc2'))
    await go(page, '/reports'); await page.reload(); await page.waitForLoadState('networkidle'); await wait(page, 900)
    check(await page.locator('[data-testid="rp-financial"]').count() === 1, 'doctor: can open the reports')
    await browser.close()

    // ======================= English =======================
    const en = await openBrowser({ width: 1440, height: 900, lang: 'en' })
    watchConsole(en.page, 'en')
    await seedAndLogin(en.page, { lang: 'en' })
    await en.page.evaluate(async () => { const db = window.__dentora.db; for (const t of ['patients', 'appointments', 'treatments', 'invoices', 'payments', 'expenses', 'inventory', 'labOrders', 'activity', 'procedures']) await db[t].clear() })
    await seed(en.page, 'en'); await seedEdge(en.page)
    await go(en.page, '/')
    await en.page.waitForSelector('[data-testid="dash-apt"]'); await wait(en.page, 600)
    await snap(en.page, 'r20-dashboard-en', { full: true })
    for (const tab of TABS) { await go(en.page, `/reports?tab=${tab}`); await wait(en.page, 500); await snap(en.page, `r2-${tab}-en`, { full: true }) }
    await en.browser.close()

    // ======================= Phone =======================
    const ph = await openBrowser({ mobile: true, width: 390, height: 844 })
    watchConsole(ph.page, 'phone')
    await seedAndLogin(ph.page, { lang: 'ar' })
    await seed(ph.page, 'ar'); await seedEdge(ph.page)
    await go(ph.page, '/')
    await ph.page.waitForSelector('[data-testid="dash-apt"]'); await wait(ph.page, 600)
    await snap(ph.page, 'r30-dashboard-phone', { full: true })
    const vis = await ph.page.evaluate(() => ['dash-new-apt', 'dash-new-patient', 'dash-new-payment'].map(id => { const r = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height >= 40 }))
    check(vis.every(Boolean), `phone: the three quick actions are fully visible and ≥ 40px (${vis})`)
    for (const tab of TABS) {
      await go(ph.page, `/reports?tab=${tab}`); await wait(ph.page, 600)
      const act = await ph.page.evaluate(() => { const r = document.querySelector('.rp-tabs .tab.active').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 })
      check(act, `phone: the active tab "${tab}" is in view`)
      await snap(ph.page, `r3-${tab}-phone`, { full: true })
    }
    await ph.page.locator('[data-testid="rp-periodbar"] .segmented button').nth(4).click().catch(() => {})
    await go(ph.page, '/reports'); await wait(ph.page, 400)
    await ph.page.locator('[data-testid="rp-periodbar"] .segmented button').nth(4).click(); await wait(ph.page, 400)
    await snap(ph.page, 'r31-custom-phone')
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

// QA of the treatments module: price list (create → edit → duplicate → deactivate → delete, bulk price, defaults),
// the patient plan board (plan → items on several teeth → approve → start → complete → chart update → quick treatment
// → print → bill → invoice), the ?tooth= deep link, and the clinic register (filters, grouping, CSV). Asserts on the
// database, watches the console, checks overflow, and takes screenshots in Arabic, English and on a phone.
// Usage: npx vite build --outDir /tmp/dist-treatments && QA_DIST=/tmp/dist-treatments QA_PORT=4304 QA_SHOTS=qa-shots/treatments node scripts/qa/treatments.mjs
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'

const failures = []
const consoleErrors = []
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.error('FAIL:', msg) } else console.log('ok:', msg) }
const wait = (page, ms = 350) => page.waitForTimeout(ms)
const go = async (page, hash) => { await page.goto(`${BASE}/index.html#${hash}`); await page.waitForLoadState('networkidle'); await wait(page, 600) }
const db = (page, fn, arg) => page.evaluate(fn, arg)
async function noOverflow(page, label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }))
  check(r.sw <= r.w, `${label}: no horizontal overflow (${r.sw} <= ${r.w})`)
}
async function snap(page, name, opts) { await noOverflow(page, name); await shot(page, name, opts) }
function watchConsole(page, tag) {
  page.on('pageerror', e => consoleErrors.push(`[${tag}] ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[${tag}] ${m.text()}`) })
}
const modal = page => page.locator('.modal').last()
/** The table row of an item on a given tooth. */
const rowTooth = (page, n) => page.locator('tbody tr').filter({ has: page.locator('.tr-tooth .num', { hasText: new RegExp(`^${n}$`) }) }).first()
const closeModal = async page => { await page.keyboard.press('Escape'); await wait(page, 250) }

/** Procedures, patients, a plan in progress, quick treatments and an old completed plan. */
async function seed(page, lang = 'ar') {
  return db(page, async (lang) => {
    const db = window.__dentora.db
    const now = new Date()
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d }
    const stamp = n => day(n).toISOString()
    const P = (id, code, name, nameEn, category, price, durationMin, toothSpecific, sortOrder, active = true) => ({ id, code, name, nameEn, category, price, durationMin, toothSpecific, active, sortOrder, createdAt: stamp(-60), updatedAt: stamp(-60) })
    const procs = [
      P('pr-exam', 'D0150', 'فحص شامل وخطة علاج', 'Comprehensive oral exam', 'diagnostic', 15, 30, false, 1),
      P('pr-pa', 'D0220', 'صورة شعاعية ذروية', 'Periapical X-ray', 'diagnostic', 5, 10, true, 2),
      P('pr-opg', 'D0330', 'صورة بانورامية (OPG)', 'Panoramic X-ray', 'diagnostic', 20, 15, false, 3),
      P('pr-scale', 'D1110', 'تقليح وتلميع', 'Scaling and polishing', 'preventive', 40, 45, false, 4),
      P('pr-seal', 'D1351', 'سادّ شقوق وميازيب', 'Fissure sealant', 'preventive', 15, 15, true, 5),
      P('pr-comp1', 'D2391', 'حشوة كومبوزيت — سطح واحد', 'Composite filling — 1 surface', 'restorative', 35, 30, true, 6),
      P('pr-comp2', 'D2392', 'حشوة كومبوزيت — سطحان', 'Composite filling — 2 surfaces', 'restorative', 50, 45, true, 7),
      P('pr-amal', 'D2140', 'حشوة أملغم — سطح واحد', 'Amalgam filling — 1 surface', 'restorative', 25, 30, true, 8, false),
      P('pr-rct', 'D3330', 'معالجة لبية — رحى', 'Root canal — molar', 'endodontic', 180, 90, true, 9),
      P('pr-crown', 'D2740', 'تاج زيركون', 'Zirconia crown', 'prosthodontic', 350, 60, true, 10),
      P('pr-ext', 'D7140', 'قلع بسيط', 'Simple extraction', 'surgical', 50, 30, true, 11),
      P('pr-impl', 'D6010', 'زرعة سنية (الجراحة)', 'Dental implant (surgical)', 'implant', 900, 90, true, 12),
      P('pr-white', 'D9972', 'تبييض الأسنان في العيادة', 'In-office whitening', 'cosmetic', 200, 60, false, 13),
    ]
    await db.procedures.bulkPut(procs)
    const ar = lang === 'ar'
    const names = ar ? ['سامر الحلبي', 'رنا الخطيب', 'محمد العلي', 'ليلى حداد'] : ['Samer Halabi', 'Rana Khatib', 'Mohammad Ali', 'Layla Haddad']
    await db.patients.bulkPut(names.map((name, i) => ({ id: `pat-${i + 1}`, fileNo: 101 + i, name, gender: i % 2 ? 'female' : 'male', phone: `09441234${50 + i}`, allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, doctorId: 'u-admin', createdAt: stamp(-90), updatedAt: stamp(-90) })))
    const nm = id => { const p = procs.find(x => x.id === id); return ar ? p.name : p.nameEn }
    const it = (id, pid, proc, o = {}) => ({ id, patientId: pid, procedureId: proc, procedureName: nm(proc), price: procs.find(x => x.id === proc).price, discount: 0, status: 'planned', doctorId: 'u-admin', createdAt: stamp(-10), updatedAt: stamp(-10), ...o })
    await db.plans.bulkPut([
      { id: 'plan-1', patientId: 'pat-2', doctorId: 'u-admin', title: ar ? 'خطة علاج شاملة — الفك العلوي' : 'Comprehensive plan — upper jaw', status: 'in_progress', notes: ar ? 'المريضة تفضّل المواعيد الصباحية. البدء بعلاج العصب ثم التاج.' : 'Prefers morning appointments. Root canal first, then the crown.', createdAt: stamp(-12), updatedAt: stamp(-2) },
      { id: 'plan-2', patientId: 'pat-2', doctorId: 'u-doc2', title: ar ? 'تبييض بعد انتهاء العلاج' : 'Whitening after treatment', status: 'draft', createdAt: stamp(-3), updatedAt: stamp(-3) },
      { id: 'plan-3', patientId: 'pat-2', doctorId: 'u-admin', title: ar ? 'خطة الوقاية 2025' : 'Prevention 2025', status: 'completed', createdAt: stamp(-200), updatedAt: stamp(-150) },
    ])
    await db.treatments.bulkPut([
      it('t-1', 'pat-2', 'pr-rct', { planId: 'plan-1', tooth: 16, status: 'completed', completedAt: stamp(-5), plannedDate: iso(day(-5)) }),
      it('t-2', 'pat-2', 'pr-crown', { planId: 'plan-1', tooth: 16, status: 'in_progress', discount: 50, plannedDate: iso(day(3)) }),
      it('t-3', 'pat-2', 'pr-comp2', { planId: 'plan-1', tooth: 24, surfaces: ['M', 'O'], plannedDate: iso(day(7)), notes: ar ? 'تسوس بين السنين' : 'Interproximal caries' }),
      it('t-4', 'pat-2', 'pr-comp1', { planId: 'plan-1', tooth: 25, surfaces: ['O'] }),
      it('t-5', 'pat-2', 'pr-ext', { planId: 'plan-1', tooth: 18, status: 'cancelled' }),
      it('t-6', 'pat-2', 'pr-white', { planId: 'plan-2', price: 200, discount: 20 }),
      it('t-7', 'pat-2', 'pr-scale', { planId: 'plan-3', status: 'completed', completedAt: stamp(-160), invoiceId: 'inv-old' }),
      it('t-8', 'pat-2', 'pr-exam', { status: 'completed', completedAt: stamp(-12) }),
      it('t-9', 'pat-1', 'pr-comp1', { tooth: 36, surfaces: ['O'], status: 'completed', completedAt: stamp(-1), doctorId: 'u-doc2' }),
      it('t-10', 'pat-3', 'pr-scale', { status: 'completed', completedAt: stamp(0) }),
      it('t-11', 'pat-3', 'pr-impl', { tooth: 46, plannedDate: iso(day(14)), doctorId: 'u-doc2' }),
      it('t-12', 'pat-4', 'pr-seal', { tooth: 36, status: 'planned', plannedDate: iso(day(1)) }),
    ])
    await db.invoices.put({ id: 'inv-old', number: 'INV-000001', patientId: 'pat-2', date: iso(day(-160)), items: [], subtotal: 40, discount: 0, taxPercent: 0, tax: 0, total: 40, paid: 40, status: 'paid', createdAt: stamp(-160), updatedAt: stamp(-160) })
    await db.clinic.update('clinic', { nextInvoiceNumber: 2, nextFileNumber: 105 })
    void now
  }, lang)
}

async function arabicDesktop() {
  const { browser, page } = await openBrowser()
  watchConsole(page, 'ar')
  await seedAndLogin(page)

  // ---------------- procedures: empty → defaults ----------------
  await go(page, '/procedures')
  check(await page.getByText('قائمة الأسعار فارغة').isVisible(), 'procedures: empty state shown')
  await snap(page, 'ar-proc-empty')
  await page.locator('.empty').getByRole('button', { name: 'تحميل القائمة الافتراضية' }).click()
  await page.waitForFunction(async () => (await window.__dentora.db.procedures.count()) > 10, null, { timeout: 8000 })
  await wait(page, 600)
  const procCount = await db(page, () => window.__dentora.db.procedures.count())
  check(procCount > 30, `procedures: default catalogue loaded (${procCount})`)
  await snap(page, 'ar-proc-list')
  await snap(page, 'ar-proc-list-full', { full: true })

  // validation
  await page.getByRole('button', { name: 'إجراء جديد' }).first().click()
  await wait(page)
  await modal(page).getByRole('button', { name: 'حفظ' }).click()
  await wait(page, 200)
  const errs = await modal(page).locator('.field-error').count()
  check(errs >= 3, `procedure form: inline validation errors (${errs})`)
  await snap(page, 'ar-proc-form-errors')
  // create
  await modal(page).getByLabel('اسم الإجراء').fill('تنظيف عميق بالليزر')
  await modal(page).getByLabel('الاسم بالإنجليزية').fill('Laser deep cleaning')
  await modal(page).getByLabel('الرمز').fill('L-100')
  await modal(page).locator('select').selectOption('periodontic')
  await modal(page).getByLabel('السعر').fill('120')
  await modal(page).locator('.tr-swatch').nth(3).click()
  await snap(page, 'ar-proc-form-filled')
  await modal(page).getByRole('button', { name: 'حفظ' }).click()
  await wait(page, 500)
  let laser = await db(page, () => window.__dentora.db.procedures.filter(p => p.code === 'L-100').first())
  check(laser && laser.name === 'تنظيف عميق بالليزر' && laser.price === 120 && laser.category === 'periodontic' && laser.active, 'procedure: created in DB')
  // duplicate code is rejected
  await page.getByRole('button', { name: 'إجراء جديد' }).first().click(); await wait(page)
  await modal(page).getByLabel('الرمز').fill('l-100')
  check(await modal(page).getByText('هذا الرمز مستخدم لإجراء آخر').isVisible(), 'procedure form: duplicate code flagged')
  await closeModal(page)
  // edit via row click
  await page.getByRole('row', { name: /تنظيف عميق بالليزر/ }).click(); await wait(page)
  await modal(page).getByLabel('السعر').fill('135')
  await modal(page).getByRole('button', { name: 'حفظ التغييرات' }).click(); await wait(page, 500)
  laser = await db(page, (id) => window.__dentora.db.procedures.get(id), laser.id)
  check(laser.price === 135, 'procedure: edited price saved')
  // active switch
  await page.getByRole('row', { name: /تنظيف عميق بالليزر/ }).locator('.switch').click(); await wait(page, 400)
  laser = await db(page, (id) => window.__dentora.db.procedures.get(id), laser.id)
  check(laser.active === false, 'procedure: deactivated with the switch')
  // duplicate → saved as a copy
  await page.getByRole('row', { name: /تنظيف عميق بالليزر/ }).getByRole('button', { name: 'المزيد' }).click()
  await page.getByRole('menuitem', { name: 'نسخ مكرر' }).click(); await wait(page)
  check((await modal(page).getByLabel('اسم الإجراء').inputValue()).includes('(نسخة)'), 'procedure: duplicate prefilled')
  await modal(page).getByRole('button', { name: 'حفظ' }).click(); await wait(page, 500)
  const copies = await db(page, () => window.__dentora.db.procedures.filter(p => p.name.includes('(نسخة)')).toArray())
  check(copies.length === 1 && copies[0].active, 'procedure: duplicate saved as new active procedure')
  // delete the copy
  await page.getByRole('row', { name: /\(نسخة\)/ }).getByRole('button', { name: 'المزيد' }).click()
  await page.getByRole('menuitem', { name: 'حذف' }).click(); await wait(page)
  await modal(page).getByRole('button', { name: 'حذف' }).click(); await wait(page, 500)
  check((await db(page, () => window.__dentora.db.procedures.filter(p => p.name.includes('(نسخة)')).count())) === 0, 'procedure: copy deleted')
  // bulk price on one category
  await page.locator('.tr-cat-chips .chip', { hasText: 'تشخيص' }).click(); await wait(page)
  await snap(page, 'ar-proc-category')
  const before = await db(page, () => window.__dentora.db.procedures.where('category').equals('diagnostic').toArray())
  const other = await db(page, () => window.__dentora.db.procedures.where('category').equals('restorative').first())
  await page.getByRole('button', { name: 'تعديل الأسعار' }).click(); await wait(page)
  await modal(page).getByLabel('القيمة').fill('20')
  await modal(page).locator('select').selectOption('5')
  await wait(page, 200)
  await snap(page, 'ar-proc-bulk')
  await modal(page).getByRole('button', { name: 'تطبيق التعديل' }).click(); await wait(page, 500)
  const after = await db(page, () => window.__dentora.db.procedures.where('category').equals('diagnostic').toArray())
  const raised = after.every(a => { const b = before.find(x => x.id === a.id); return a.price === Math.round(b.price * 1.2 / 5) * 5 })
  check(raised, 'bulk price: +20% rounded to 5 applied to the category')
  const otherAfter = await db(page, (id) => window.__dentora.db.procedures.get(id), other.id)
  check(otherAfter.price === other.price, 'bulk price: other categories untouched')
  await page.locator('.tr-cat-chips .chip').first().click(); await wait(page)
  // search → flat results with category column
  await page.getByPlaceholder('ابحث في القائمة بالاسم أو الرمز…').fill('كومبوزيت'); await wait(page, 500)
  await snap(page, 'ar-proc-search')
  await page.getByPlaceholder('ابحث في القائمة بالاسم أو الرمز…').fill('zzzz'); await wait(page, 500)
  check(await page.getByText('لا يوجد إجراء يطابق البحث أو التصفية الحالية.').isVisible(), 'procedures: no-match empty state')
  await page.getByRole('button', { name: 'مسح عوامل التصفية' }).click(); await wait(page, 300)

  // ---------------- patient tab: full flow ----------------
  await db(page, async () => {
    const now = new Date().toISOString()
    await window.__dentora.db.patients.put({ id: 'pat-1', fileNo: 101, name: 'سامر الحلبي', gender: 'male', phone: '0944123456', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, doctorId: 'u-admin', createdAt: now, updatedAt: now })
  })
  await go(page, '/patients/pat-1?tab=treatments')
  await page.getByText('لا توجد خطط علاج بعد').waitFor({ timeout: 5000 }).catch(() => {})
  check(await page.getByText('لا توجد خطط علاج بعد').isVisible(), 'tab: empty state shown')
  await snap(page, 'ar-tab-empty')
  await page.locator('.empty').getByRole('button', { name: 'خطة علاج جديدة' }).click(); await wait(page)
  await snap(page, 'ar-plan-form')
  await modal(page).getByRole('button', { name: 'إنشاء الخطة' }).click(); await wait(page, 700)
  const plan = await db(page, () => window.__dentora.db.plans.where('patientId').equals('pat-1').first())
  check(plan && plan.status === 'draft' && plan.title.startsWith('خطة علاج —') && plan.doctorId === 'u-admin', 'plan: created as draft with default title and doctor')
  // add item modal opened automatically for the new plan
  check(await modal(page).getByText('إضافة بند علاجي').isVisible(), 'plan: add-item modal opens after creating the plan')
  await snap(page, 'ar-item-picker')
  await modal(page).getByRole('button', { name: /^إضافة البند$/ }).click(); await wait(page, 200)
  check(await modal(page).getByText('اختر إجراءً من القائمة').isVisible(), 'item form: procedure required error')
  await modal(page).getByPlaceholder('ابحث بالاسم أو الرمز…').fill('كومبوزيت — سطحان'); await wait(page, 300)
  await modal(page).locator('.tr-pick').first().click(); await wait(page, 300)
  await modal(page).getByRole('button', { name: /^إضافة البند$/ }).click(); await wait(page, 200)
  check(await modal(page).getByText('هذا الإجراء يتطلب تحديد سن واحد على الأقل').isVisible(), 'item form: tooth required for a tooth-specific procedure')
  await modal(page).locator('[data-tooth="16"]').click()
  await modal(page).locator('[data-tooth="26"]').click()
  await modal(page).locator('.tr-surfaces .chip').filter({ hasText: '(M)' }).click()
  await modal(page).locator('.tr-surfaces .chip').filter({ hasText: '(O)' }).click()
  await modal(page).getByLabel('الخصم لكل سن').fill('5')
  await wait(page, 200)
  await snap(page, 'ar-item-filled')
  await modal(page).locator('.modal-body').evaluate(el => el.scrollTo(0, el.scrollHeight)); await wait(page, 200)
  await snap(page, 'ar-item-filled-bottom')
  await modal(page).getByRole('button', { name: 'إضافة بندين' }).click(); await wait(page, 600)
  let items = await db(page, (pid) => window.__dentora.db.treatments.where('planId').equals(pid).toArray(), plan.id)
  check(items.length === 2 && items.every(i => i.status === 'planned' && i.discount === 5 && i.surfaces.join('') === 'MO') && items.map(i => i.tooth).sort().join(',') === '16,26', 'items: one per tooth with surfaces and discount')
  // root canal on 36, scaling without tooth
  await page.getByRole('button', { name: 'إضافة بند' }).first().click(); await wait(page)
  await modal(page).getByPlaceholder('ابحث بالاسم أو الرمز…').fill('رحى'); await wait(page, 300)
  await modal(page).locator('.tr-pick').first().click(); await wait(page, 200)
  await modal(page).locator('[data-tooth="36"]').click()
  await modal(page).getByRole('button', { name: /^إضافة البند$/ }).click(); await wait(page, 600)
  await page.getByRole('button', { name: 'إضافة بند' }).first().click(); await wait(page)
  await modal(page).getByPlaceholder('ابحث بالاسم أو الرمز…').fill('تقليح وتلميع'); await wait(page, 300)
  await modal(page).locator('.tr-pick').first().click(); await wait(page, 200)
  await modal(page).getByRole('button', { name: /^إضافة البند$/ }).click(); await wait(page, 600)
  items = await db(page, (pid) => window.__dentora.db.treatments.where('planId').equals(pid).toArray(), plan.id)
  check(items.length === 4 && items.some(i => !i.tooth), 'items: root canal and a no-tooth scaling added')
  await snap(page, 'ar-tab-plan-draft')
  // approve
  await page.getByRole('button', { name: 'اعتماد الخطة' }).click(); await wait(page, 500)
  check((await db(page, (id) => window.__dentora.db.plans.get(id), plan.id)).status === 'approved', 'plan: approved')
  // start the root canal
  const rct = items.find(i => i.tooth === 36)
  await rowTooth(page, 36).getByRole('button', { name: 'بدء' }).click(); await wait(page, 500)
  check((await db(page, (id) => window.__dentora.db.treatments.get(id), rct.id)).status === 'in_progress', 'item: started')
  check((await db(page, (id) => window.__dentora.db.plans.get(id), plan.id)).status === 'in_progress', 'plan: in progress after a start')
  // complete the filling on 16 → chart prompt
  const fill16 = items.find(i => i.tooth === 16)
  await rowTooth(page, 16).getByRole('button', { name: 'إنجاز' }).click(); await wait(page, 600)
  check(await modal(page).getByText('تحديث مخطط الأسنان؟').isVisible(), 'complete: chart update suggested')
  await snap(page, 'ar-chart-prompt')
  await modal(page).getByRole('button', { name: 'تحديث المخطط' }).click(); await wait(page, 500)
  const rec = await db(page, (id) => window.__dentora.db.teeth.filter(r => r.treatmentItemId === id).first(), fill16.id)
  check(rec && rec.condition === 'filled' && rec.tooth === 16 && rec.active && rec.surfaces.join('') === 'MO' && rec.recordedBy === 'u-admin', 'chart: filling recorded on 16 (MO)')
  const done16 = await db(page, (id) => window.__dentora.db.treatments.get(id), fill16.id)
  check(done16.status === 'completed' && !!done16.completedAt, 'item: completed with completedAt')
  // complete the root canal → skip the chart
  await rowTooth(page, 36).getByRole('button', { name: 'إنجاز' }).click(); await wait(page, 600)
  await modal(page).getByRole('button', { name: 'ليس الآن' }).click(); await wait(page, 300)
  check((await db(page, (id) => window.__dentora.db.teeth.filter(r => r.treatmentItemId === id).count(), rct.id)) === 0, 'chart: skipped leaves the chart alone')
  // quick treatment: exam (no chart prompt)
  await page.getByRole('button', { name: 'علاج سريع' }).click(); await wait(page)
  await snap(page, 'ar-quick')
  await modal(page).getByPlaceholder('ابحث بالاسم أو الرمز…').fill('فحص شامل'); await wait(page, 300)
  await modal(page).locator('.tr-pick').first().click(); await wait(page, 200)
  await modal(page).getByRole('button', { name: 'حفظ كعلاج منجز' }).click(); await wait(page, 600)
  const quick = await db(page, () => window.__dentora.db.treatments.where('patientId').equals('pat-1').filter(i => !i.planId).toArray())
  check(quick.length === 1 && quick[0].status === 'completed' && !!quick[0].completedAt, 'quick treatment: completed item without plan')
  check(await page.locator('.modal').count() === 0, 'quick treatment: no chart prompt for a diagnostic procedure')
  // edit an item (notes + price)
  await rowTooth(page, 26).click(); await wait(page)
  await modal(page).getByLabel('ملاحظات').fill('يُفضّل التخدير الموضعي')
  await modal(page).getByRole('button', { name: 'حفظ التغييرات' }).click(); await wait(page, 500)
  const fill26 = items.find(i => i.tooth === 26)
  check((await db(page, (id) => window.__dentora.db.treatments.get(id), fill26.id)).notes === 'يُفضّل التخدير الموضعي', 'item: edited notes saved')
  await snap(page, 'ar-tab-plan')
  await snap(page, 'ar-tab-plan-full', { full: true })
  // print the estimate
  await page.getByRole('button', { name: 'طباعة التقدير' }).click(); await wait(page, 500)
  await snap(page, 'ar-print-modal')
  const vp = page.viewportSize()
  await page.evaluate(() => document.body.classList.add('tr-printing'))
  await page.setViewportSize({ width: 794, height: 1123 }); await page.emulateMedia({ media: 'print' }); await wait(page, 300)
  await shot(page, 'ar-print-sheet', { full: true })
  await page.emulateMedia({ media: 'screen' }); await page.setViewportSize(vp)
  await page.evaluate(() => document.body.classList.remove('tr-printing'))
  await closeModal(page)
  // bill completed work
  await page.getByRole('button', { name: /فوترة المنجز/ }).click(); await wait(page, 500)
  await snap(page, 'ar-bill')
  await modal(page).getByRole('button', { name: 'إصدار الفاتورة' }).click()
  await page.waitForURL(/#\/invoices\//, { timeout: 8000 })
  await wait(page, 800)
  const invId = page.url().split('/invoices/')[1]
  const inv = await db(page, (id) => window.__dentora.db.invoices.get(id), invId)
  check(inv && inv.number === 'INV-000001' && inv.items.length === 3 && inv.status === 'unpaid' && inv.patientId === 'pat-1', `bill: invoice ${inv?.number} created with ${inv?.items.length} lines`)
  const billedItems = await db(page, (id) => window.__dentora.db.treatments.where('invoiceId').equals(id).toArray(), invId)
  const expected = billedItems.reduce((a, i) => a + i.price - i.discount, 0)
  check(inv && inv.total === expected && inv.subtotal === expected && inv.items.every(l => billedItems.some(b => b.id === l.treatmentItemId)), `bill: totals match the completed items (${inv?.total} = ${expected})`)
  const linked = await db(page, (id) => window.__dentora.db.treatments.where('invoiceId').equals(id).count(), invId)
  check(linked === 3, 'bill: treatment items linked to the invoice')
  await snap(page, 'ar-invoice-page')
  await go(page, '/patients/pat-1?tab=treatments')
  check(await page.getByText('مفوتر').first().isVisible(), 'tab: billed badge shown')
  // cancel + restore + delete an item
  await page.getByRole('row', { name: /تقليح/ }).getByRole('button', { name: 'المزيد' }).click()
  await page.getByRole('menuitem', { name: 'إلغاء البند' }).click(); await wait(page, 400)
  const scale = items.find(i => !i.tooth)
  check((await db(page, (id) => window.__dentora.db.treatments.get(id), scale.id)).status === 'cancelled', 'item: cancelled')
  await page.getByRole('row', { name: /تقليح/ }).getByRole('button', { name: 'استعادة' }).click(); await wait(page, 400)
  check((await db(page, (id) => window.__dentora.db.treatments.get(id), scale.id)).status === 'planned', 'item: restored to planned')
  await page.getByRole('row', { name: /تقليح/ }).getByRole('button', { name: 'المزيد' }).click()
  await page.getByRole('menuitem', { name: 'حذف' }).click(); await wait(page)
  await modal(page).getByRole('button', { name: 'حذف' }).click(); await wait(page, 500)
  check(!(await db(page, (id) => window.__dentora.db.treatments.get(id), scale.id)), 'item: deleted')
  const planNow = await db(page, (id) => window.__dentora.db.plans.get(id), plan.id)
  check(planNow.status === 'in_progress', `plan: still in progress with one open item (${planNow.status})`)
  // complete the last open item → plan completed
  await rowTooth(page, 26).getByRole('button', { name: 'إنجاز' }).click(); await wait(page, 600)
  if (await page.locator('.modal').count()) await modal(page).getByRole('button', { name: 'ليس الآن' }).click()
  await wait(page, 300)
  check((await db(page, (id) => window.__dentora.db.plans.get(id), plan.id)).status === 'completed', 'plan: completed when every item is done')
  await snap(page, 'ar-tab-completed')

  // deep link from the dental chart
  await go(page, '/patients/pat-1?tab=treatments&tooth=46')
  check(await modal(page).getByText('إضافة بند علاجي').isVisible(), 'deep link: add-item modal opened')
  check(await modal(page).locator('[data-tooth="46"].on').count() === 1, 'deep link: tooth 46 preselected')
  check(!page.url().includes('tooth='), 'deep link: tooth param consumed')
  await snap(page, 'ar-deeplink')
  await closeModal(page)
  await page.reload(); await wait(page, 800)
  check(await page.locator('.modal').count() === 0, 'deep link: does not reopen on reload')

  // used procedure cannot be deleted
  await go(page, '/procedures')
  await page.getByPlaceholder('ابحث في القائمة بالاسم أو الرمز…').fill('فحص شامل'); await wait(page, 500)
  await page.getByRole('row', { name: /فحص شامل/ }).first().getByRole('button', { name: 'المزيد' }).click()
  await page.getByRole('menuitem', { name: 'حذف' }).click(); await wait(page)
  check(await modal(page).getByText('لا يمكن حذف هذا الإجراء').isVisible(), 'procedure: delete blocked when used')
  await snap(page, 'ar-proc-inuse')
  await modal(page).getByRole('button', { name: 'إيقاف الإجراء' }).click(); await wait(page, 400)
  const exam = await db(page, () => window.__dentora.db.procedures.filter(p => p.name.startsWith('فحص شامل')).first())
  check(exam.active === false, 'procedure: deactivated instead of deleted')

  // ---------------- register with richer data ----------------
  await seed(page, 'ar')
  await go(page, '/treatments')
  await snap(page, 'ar-register')
  await page.getByRole('tab', { name: /مكتمل/ }).click(); await wait(page, 300)
  const completedRows = await page.locator('tbody tr').count()
  check(completedRows > 0 && (await page.locator('tbody .badge', { hasText: 'مخطط' }).count()) === 0, 'register: status filter shows completed only')
  await page.getByRole('tab', { name: /^الكل/ }).first().click()
  await page.getByRole('tab', { name: 'كل الفترات' }).click(); await wait(page, 300)
  await page.locator('.tr-filters .switch').click(); await wait(page, 300)
  await snap(page, 'ar-register-grouped')
  await page.locator('.tr-filters .switch').click(); await wait(page, 300)
  await page.getByPlaceholder('ابحث باسم المريض أو الإجراء أو رقم السن…').fill('رنا'); await wait(page, 500)
  const rana = await page.locator('tbody tr').count()
  check(rana >= 5, `register: search by patient (${rana} rows)`)
  await page.getByPlaceholder('ابحث باسم المريض أو الإجراء أو رقم السن…').fill(''); await wait(page, 400)
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await page.getByRole('button', { name: 'تصدير CSV' }).click()
  const file = await dl
  check(!!file && file.suggestedFilename().endsWith('.csv'), 'register: CSV exported')
  await page.getByRole('row').nth(1).click(); await wait(page, 700)
  check(/#\/patients\/pat-\d\?tab=treatments/.test(page.url()), 'register: row opens the patient treatments tab')
  await snap(page, 'ar-tab-rich')
  await snap(page, 'ar-tab-rich-full', { full: true })

  // ---------------- read-only (expired trial) ----------------
  await db(page, () => window.__dentora.db.settings.put({ key: 'installedAt', value: new Date(Date.now() - 40 * 86400000).toISOString() }))
  await go(page, '/patients/pat-2?tab=treatments')
  await wait(page, 600)
  check(await page.getByRole('button', { name: 'خطة علاج جديدة' }).isDisabled(), 'read-only: new plan disabled')
  check(await page.getByRole('button', { name: 'إنجاز' }).first().isDisabled(), 'read-only: complete disabled')
  await snap(page, 'ar-readonly')
  await go(page, '/procedures')
  check(await page.getByRole('button', { name: 'إجراء جديد' }).isDisabled(), 'read-only: new procedure disabled')
  await db(page, () => window.__dentora.db.settings.put({ key: 'installedAt', value: new Date().toISOString() }))
  await browser.close()
}

async function englishDesktop() {
  const { browser, page } = await openBrowser({ lang: 'en' })
  watchConsole(page, 'en')
  await seedAndLogin(page, { lang: 'en' })
  await seed(page, 'en')
  await go(page, '/procedures')
  await snap(page, 'en-proc-list')
  await page.getByRole('button', { name: 'New procedure' }).click(); await wait(page)
  await snap(page, 'en-proc-form')
  await closeModal(page)
  await go(page, '/patients/pat-2?tab=treatments')
  await page.locator('.tr-plan').first().waitFor()
  await snap(page, 'en-tab')
  await snap(page, 'en-tab-full', { full: true })
  await page.getByRole('button', { name: 'Add item' }).first().click(); await wait(page)
  await modal(page).getByPlaceholder('Search by name or code…').fill('crown'); await wait(page, 300)
  await modal(page).locator('.tr-pick').first().click(); await wait(page, 200)
  await modal(page).locator('[data-tooth="11"]').click(); await modal(page).locator('[data-tooth="21"]').click()
  await snap(page, 'en-item')
  await closeModal(page)
  await page.getByRole('button', { name: /Bill completed/ }).click(); await wait(page, 400)
  await snap(page, 'en-bill')
  await closeModal(page)
  await page.getByRole('button', { name: 'Print estimate' }).first().click(); await wait(page, 400)
  await snap(page, 'en-print')
  await closeModal(page)
  await go(page, '/treatments')
  await page.getByRole('tab', { name: 'All time' }).click(); await wait(page, 300)
  await snap(page, 'en-register')
  await browser.close()
}

async function phone() {
  const { browser, page } = await openBrowser({ mobile: true, width: 390, height: 844 })
  watchConsole(page, 'phone')
  await seedAndLogin(page)
  await go(page, '/procedures')
  await snap(page, 'm-proc-empty')
  await seed(page, 'ar')
  await go(page, '/procedures')
  await snap(page, 'm-proc-list')
  await page.getByRole('button', { name: 'إجراء جديد' }).click(); await wait(page)
  await snap(page, 'm-proc-form')
  await closeModal(page)
  await go(page, '/patients/pat-2?tab=treatments')
  await page.locator('.tr-plan').first().waitFor()
  await snap(page, 'm-tab')
  await snap(page, 'm-tab-full', { full: true })
  await page.getByRole('button', { name: 'إضافة بند' }).first().click(); await wait(page)
  await snap(page, 'm-item-picker')
  await modal(page).locator('.tr-pick').nth(5).click(); await wait(page, 300)
  await modal(page).locator('[data-tooth="17"]').click(); await modal(page).locator('[data-tooth="47"]').click()
  await snap(page, 'm-item-teeth')
  await modal(page).locator('.modal-body').evaluate(el => el.scrollTo(0, el.scrollHeight)); await wait(page, 200)
  await snap(page, 'm-item-bottom')
  await modal(page).getByRole('button', { name: 'إضافة بندين' }).click(); await wait(page, 600)
  const added = await db(page, () => window.__dentora.db.treatments.filter(i => i.tooth === 17 || i.tooth === 47).count())
  check(added === 2, 'phone: two items added from the tooth grid')
  // complete from the phone list → chart prompt
  await page.locator('.tr-mitem', { hasText: '24' }).getByRole('button', { name: 'إنجاز' }).click(); await wait(page, 600)
  await snap(page, 'm-chart-prompt')
  await modal(page).getByRole('button', { name: 'تحديث المخطط' }).click(); await wait(page, 400)
  await page.getByRole('button', { name: /فوترة المنجز/ }).click(); await wait(page, 400)
  await snap(page, 'm-bill')
  await closeModal(page)
  await go(page, '/treatments')
  await snap(page, 'm-register')
  await snap(page, 'm-register-full', { full: true })
  await browser.close()
}

const server = await startServer()
try {
  await arabicDesktop()
  await englishDesktop()
  await phone()
} catch (e) {
  failures.push('script error: ' + (e?.stack || e))
  console.error(e)
} finally {
  server.kill()
}
const relevant = consoleErrors.filter(e => !/favicon/i.test(e))
check(relevant.length === 0, `console: no errors (${relevant.length})`)
if (relevant.length) console.error(relevant.join('\n'))
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : '\nALL CHECKS PASSED')
process.exit(failures.length ? 1 : 0)

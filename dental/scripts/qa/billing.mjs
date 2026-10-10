// QA of the billing module: flows (create → issue → pay → receipt → cancel / draft → delete, ledger, statement),
// database assertions, console errors, overflow checks, and screenshots in Arabic, English and on a phone.
// Usage: npx vite build --outDir /tmp/dist-billing && QA_DIST=/tmp/dist-billing QA_PORT=4305 QA_SHOTS=qa-shots/billing node scripts/qa/billing.mjs
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'

const failures = []
const consoleErrors = []
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.error('FAIL:', msg) } else console.log('ok:', msg) }
const wait = (page, ms = 350) => page.waitForTimeout(ms)
const go = async (page, hash) => { await page.goto(`${BASE}/index.html#${hash}`); await page.waitForLoadState('networkidle'); await wait(page, 500) }
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
async function printShot(page, name, modal = false) {
  const vp = page.viewportSize()
  if (modal) await page.evaluate(() => document.body.classList.add('bl-printing'))
  await page.setViewportSize({ width: 720, height: vp.height })   // ≈ A4 printable width at 96 dpi
  await page.emulateMedia({ media: 'print' })
  await wait(page, 300)
  await shot(page, name, { full: true })
  await page.emulateMedia({ media: 'screen' })
  await page.setViewportSize(vp)
  if (modal) await page.evaluate(() => document.body.classList.remove('bl-printing'))
  await wait(page, 150)
}

/** Patients, procedures, completed treatments; optionally a month of invoices and payments. */
async function seed(page, { lang = 'ar', history = false } = {}) {
  return db(page, async ({ lang, history }) => {
    const db = window.__dentora.db
    const now = new Date().toISOString()
    const pad = n => String(n).padStart(2, '0')
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }
    const clinic = await db.clinic.get('clinic')
    await db.clinic.put({ ...clinic, email: 'info@smile-dental.sy', tagline: lang === 'ar' ? 'رعاية متكاملة لابتسامتك' : 'Complete care for your smile', invoiceFooter: lang === 'ar' ? 'تُستحق الفواتير خلال 30 يوماً من تاريخ الإصدار. نقبل الدفع نقداً أو بالبطاقة أو بالتحويل.' : 'Invoices are due within 30 days of issue. We accept cash, card and bank transfer.' })
    const names = lang === 'ar'
      ? ['محمد العلي', 'رنا الحسن', 'خالد منصور', 'ليلى عبد الله', 'سامر حداد', 'نور الشامي', 'يوسف قباني', 'هبة الأحمد']
      : ['Mohammad Ali', 'Rana Hassan', 'Khaled Mansour', 'Layla Abdullah', 'Samer Haddad', 'Nour Shami', 'Youssef Kabbani', 'Hiba Ahmad']
    const patients = names.map((name, i) => ({ id: `pat-${i + 1}`, fileNo: 101 + i, name, gender: i % 2 ? 'female' : 'male', phone: `09${44 + i}${String(123456 + i * 1111).slice(0, 7)}`, allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, doctorId: i % 3 === 2 ? 'u-doc2' : 'u-admin', createdAt: now, updatedAt: now, lastVisit: new Date(Date.now() - i * 86400000).toISOString() }))
    await db.patients.bulkPut(patients)
    await db.clinic.update('clinic', { nextFileNumber: 110 })
    const procs = [
      ['exam', 'فحص وتشخيص', 'Examination & diagnosis', 'diagnostic', 25, 'D0150'], ['xray', 'صورة شعاعية ذروية', 'Periapical X-ray', 'diagnostic', 10, 'D0220'],
      ['clean', 'تنظيف وتلميع', 'Scaling & polishing', 'preventive', 40, 'D1110'], ['fill', 'حشوة كومبوزيت', 'Composite filling', 'restorative', 60, 'D2391'],
      ['rct', 'معالجة لبية (عصب)', 'Root canal treatment', 'endodontic', 180, 'D3330'], ['crown', 'تاج زيركون', 'Zirconia crown', 'prosthodontic', 350, 'D2740'],
      ['ext', 'قلع بسيط', 'Simple extraction', 'surgical', 50, 'D7140'], ['whit', 'تبييض الأسنان', 'Teeth whitening', 'cosmetic', 200, 'D9972'],
    ].map(([id, name, nameEn, category, price, code], i) => ({ id: `proc-${id}`, code, name, nameEn, category, price, toothSpecific: ['fill', 'rct', 'crown', 'ext'].includes(id), active: true, sortOrder: i, createdAt: now, updatedAt: now }))
    await db.procedures.bulkPut(procs)
    const tr = (id, pid, proc, tooth, price, discount = 0, daysAgo = 3) => ({ id, patientId: pid, procedureId: `proc-${proc}`, procedureName: procs.find(p => p.id === `proc-${proc}`)[lang === 'ar' ? 'name' : 'nameEn'], tooth, price, discount, status: 'completed', doctorId: 'u-admin', completedAt: new Date(Date.now() - daysAgo * 86400000).toISOString(), createdAt: now, updatedAt: now })
    await db.treatments.bulkPut([
      tr('tr-1', 'pat-1', 'fill', 36, 60, 0, 5), tr('tr-2', 'pat-1', 'rct', 46, 180, 20, 2), tr('tr-3', 'pat-1', 'clean', undefined, 40, 0, 1),
      tr('tr-4', 'pat-2', 'crown', 21, 350, 50, 4), tr('tr-5', 'pat-2', 'xray', 21, 10, 0, 4),
    ])
    if (!history) return
    // a month of history: issued invoices with matching payments
    const items = (...rows) => rows.map(([proc, tooth, qty = 1, discount = 0], i) => { const p = procs.find(x => x.id === `proc-${proc}`); return { id: `it-${Math.random().toString(36).slice(2, 9)}${i}`, procedureId: p.id, description: lang === 'ar' ? p.name : p.nameEn, tooth, qty, unitPrice: p.price, discount, total: qty * p.price - discount } })
    const plan = [
      // [patient, doctor, daysAgo, items, payments [[amount, method, daysAgo, by, ref]], status override]
      ['pat-3', 'u-admin', 0, items(['exam'], ['xray', 16]), [[35, 'cash', 0, 'u-rec']]],
      ['pat-4', 'u-doc2', 1, items(['crown', 11], ['crown', 21]), [[300, 'card', 1, 'u-rec', '4417']]],
      ['pat-5', 'u-admin', 2, items(['rct', 26], ['fill', 26]), []],
      ['pat-6', 'u-doc2', 3, items(['clean'], ['whit']), [[240, 'transfer', 3, 'u-admin', 'TRX-88213']]],
      ['pat-7', 'u-admin', 5, items(['ext', 38], ['xray', 38]), [[60, 'cash', 5, 'u-rec']]],
      ['pat-8', 'u-admin', 6, items(['fill', 14, 2, 10]), [[50, 'wallet', 6, 'u-rec']]],
      ['pat-3', 'u-doc2', 8, items(['crown', 36]), [[200, 'cash', 8, 'u-admin'], [-20, 'cash', 7, 'u-admin']]],
    ]
    let n = (await db.clinic.get('clinic')).nextInvoiceNumber || 1
    const invoices = [], payments = []
    for (const [pid, doc, ago, its, pays] of plan) {
      const id = `inv-h${n}`
      const subtotal = its.reduce((a, i) => a + i.total, 0)
      const paid = pays.reduce((a, p) => a + p[0], 0)
      const status = paid <= 0 ? 'unpaid' : paid >= subtotal ? 'paid' : 'partial'
      invoices.push({ id, number: `INV-${String(n).padStart(6, '0')}`, patientId: pid, doctorId: doc, date: day(-ago), dueDate: day(-ago + 30), items: its, subtotal, discount: 0, taxPercent: 0, tax: 0, total: subtotal, paid, status, createdAt: new Date(Date.now() - ago * 86400000).toISOString(), updatedAt: now, createdBy: 'u-admin' })
      pays.forEach(([amount, method, pago, by, ref], k) => payments.push({ id: `pay-h${n}-${k}x${Math.random().toString(36).slice(2, 8)}`, patientId: pid, invoiceId: id, amount, method, date: day(-pago), reference: ref, receivedBy: by, createdAt: new Date(Date.now() - pago * 86400000 + k * 1000).toISOString() }))
      n++
    }
    invoices.push({ id: 'inv-cancel', number: `INV-${String(n).padStart(6, '0')}`, patientId: 'pat-5', doctorId: 'u-admin', date: day(-4), items: items(['exam']), subtotal: 25, discount: 0, taxPercent: 0, tax: 0, total: 25, paid: 0, status: 'cancelled', createdAt: now, updatedAt: now })
    n++
    invoices.push({ id: 'inv-draft', number: 'DRAFT', patientId: 'pat-6', doctorId: 'u-doc2', date: day(0), items: items(['clean']), subtotal: 40, discount: 0, taxPercent: 0, tax: 0, total: 40, paid: 0, status: 'draft', createdAt: now, updatedAt: now })
    payments.push({ id: 'pay-onacc-1', patientId: 'pat-8', amount: 100, method: 'cash', date: day(0), receivedBy: 'u-rec', note: 'advance', createdAt: now })
    await db.invoices.bulkPut(invoices)
    await db.payments.bulkPut(payments)
    await db.clinic.update('clinic', { nextInvoiceNumber: n })
  }, { lang, history })
}

const server = await startServer()
try {
  // =============================== desktop, Arabic: full flows ===============================
  {
    const { browser, page } = await openBrowser({ lang: 'ar' })
    watchConsole(page, 'ar')
    await seedAndLogin(page, { lang: 'ar' })
    await go(page, '/invoices')
    await snap(page, 'ar-01-invoices-empty')
    await go(page, '/payments')
    await snap(page, 'ar-02-payments-empty')
    await seed(page, { lang: 'ar' })

    // --- new invoice: validation, patient picker, treatments, procedures, free line ---
    await go(page, '/invoices')
    await page.getByRole('button', { name: 'فاتورة جديدة' }).first().click()
    await wait(page, 500)
    await snap(page, 'ar-03-form-empty')
    await page.getByRole('button', { name: 'إصدار الفاتورة' }).click()
    await wait(page)
    await snap(page, 'ar-04-form-validation')
    check(await page.getByText('اختر المريض').count() > 0, 'form: patient required error shown')
    check(await page.getByText('أضف بنداً واحداً على الأقل').count() > 0, 'form: items required error shown')
    await page.getByPlaceholder('ابحث عن مريض بالاسم أو رقم الملف أو الهاتف…').fill('محمد')
    await wait(page)
    await snap(page, 'ar-05-form-patient-dropdown')
    await page.getByRole('option', { name: /محمد العلي/ }).click()
    await wait(page, 500)
    await snap(page, 'ar-06-form-treatments-panel')
    await page.getByRole('button', { name: /إضافة المحدد/ }).click()
    await wait(page)
    await page.getByRole('button', { name: 'من قائمة الإجراءات' }).click()
    await wait(page)
    await page.getByPlaceholder('ابحث عن إجراء…').fill('صورة')
    await wait(page)
    await snap(page, 'ar-07-form-procedures-panel')
    await page.locator('.bl-panel-item', { hasText: 'صورة شعاعية' }).click()
    await wait(page)
    await page.getByRole('button', { name: 'سطر حر' }).click()
    await wait(page)
    await page.getByRole('button', { name: 'إصدار الفاتورة' }).click()
    await wait(page)
    check(await page.getByText('أدخل وصف البند').count() > 0, 'form: free line needs a description')
    await snap(page, 'ar-08-form-line-errors')
    const free = page.locator('.bl-line').last()
    await free.locator('input').nth(0).fill('مستلزمات تعقيم')
    await free.locator('input').nth(3).fill('15')
    // a too-big line discount is caught
    await free.locator('input').nth(4).fill('50')
    await page.getByRole('button', { name: 'إصدار الفاتورة' }).click()
    await wait(page)
    check(await page.getByText('الخصم أكبر من قيمة البند').count() > 0, 'form: line discount larger than line is rejected')
    await free.locator('input').nth(4).fill('5')
    await page.getByLabel('خصم على الفاتورة').fill('15')
    await page.getByLabel('الضريبة %').fill('5')
    await wait(page)
    await snap(page, 'ar-09-form-filled')
    await page.locator('.bl-totals-panel').scrollIntoViewIfNeeded()
    await snap(page, 'ar-09b-form-filled-bottom')
    await page.getByRole('button', { name: 'إصدار الفاتورة' }).click()
    await page.waitForURL(/#\/invoices\/[^?]+$/, { timeout: 5000 }).catch(() => {})
    await wait(page, 700)
    const inv1 = await db(page, async () => (await window.__dentora.db.invoices.toArray())[0])
    check(inv1 && inv1.number === 'INV-000001' && inv1.status === 'unpaid', `issue: first invoice is INV-000001 unpaid (${inv1?.number} ${inv1?.status})`)
    check(inv1 && inv1.items.length === 5, `issue: 5 lines saved (${inv1?.items.length})`)
    // lines: 60 + (180-20) + 40 + 10 + (15-5) = 280; −15 = 265; tax 5% = 13.25 → 13 (the QA clinic uses 0 currency decimals) → 278
    check(inv1 && inv1.subtotal === 280 && inv1.discount === 15 && inv1.tax === 13 && inv1.total === 278, `issue: totals 280 / 15 / 13 / 278 (${inv1?.subtotal} ${inv1?.discount} ${inv1?.tax} ${inv1?.total})`)
    const linked = await db(page, async id => (await window.__dentora.db.treatments.where('invoiceId').equals(id).toArray()).map(t => t.id).sort(), inv1?.id)
    check(JSON.stringify(linked) === '["tr-1","tr-2","tr-3"]', `issue: treatments linked (${linked})`)
    const act = await db(page, async () => (await window.__dentora.db.activity.toArray()).filter(a => a.type === 'invoice').map(a => a.message))
    check(act.some(m => m.includes('INV-000001')), 'issue: activity logged')
    check(page.url().includes(`/invoices/${inv1?.id}`), 'issue: opens the invoice page')
    await snap(page, 'ar-10-invoice-unpaid')
    await snap(page, 'ar-10b-invoice-unpaid-full', { full: true })
    await printShot(page, 'ar-11-invoice-print')

    // --- record payment: overpay → split into invoice + on account ---
    await page.getByRole('button', { name: 'تسجيل دفعة' }).first().click()
    await wait(page, 600)
    await snap(page, 'ar-12-payment-modal')
    const prefilled = await page.locator('.bl-amount input').inputValue()
    check(prefilled === '278', `payment: amount pre-filled with the balance (${prefilled})`)
    await page.locator('.bl-amount input').fill('300')
    await page.getByLabel('المرجع / رقم الإيصال').fill('A-1001')
    await wait(page)
    check(await page.getByText('المبلغ أكبر من المتبقي على الفاتورة').count() > 0, 'payment: split hint shown when paying more than the balance')
    await snap(page, 'ar-13-payment-split-hint')
    await page.getByRole('button', { name: 'حفظ الدفعة' }).click()
    await wait(page, 700)
    await snap(page, 'ar-14-payment-toast')
    const pays1 = await db(page, async id => (await window.__dentora.db.payments.toArray()).map(p => ({ inv: p.invoiceId === id, amount: p.amount, by: p.receivedBy, ref: p.reference })), inv1?.id)
    check(pays1.length === 2 && pays1.some(p => p.inv && p.amount === 278) && pays1.some(p => !p.inv && p.amount === 22), `payment: split into 278 + 22 on account (${JSON.stringify(pays1)})`)
    check(pays1.every(p => p.by === 'u-admin' && p.ref === 'A-1001'), 'payment: received by the signed-in user, reference kept')
    const inv1b = await db(page, async id => window.__dentora.db.invoices.get(id), inv1?.id)
    check(inv1b.paid === 278 && inv1b.status === 'paid', `payment: invoice recomputed to paid (${inv1b.paid} ${inv1b.status})`)
    await page.getByRole('button', { name: 'طباعة الإيصال' }).click()
    await wait(page, 600)
    await snap(page, 'ar-15-receipt')
    await printShot(page, 'ar-16-receipt-print', true)
    await page.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).first().click()
    await wait(page)
    check(await page.locator('.bl-receipt').count() === 0, 'receipt: closes')
    await snap(page, 'ar-17-invoice-paid')
    await snap(page, 'ar-17b-invoice-paid-full', { full: true })

    // --- draft via ?patient=&new=1, then delete ---
    await go(page, '/invoices?patient=pat-2&new=1')
    await wait(page, 500)
    check(await page.getByText('رنا الحسن').count() > 0, 'draft: form pre-filled with the patient from the URL')
    await page.getByRole('button', { name: /إضافة المحدد/ }).click()
    await wait(page)
    await page.getByRole('button', { name: 'حفظ كمسودة' }).click()
    await wait(page, 700)
    const draft = await db(page, async () => (await window.__dentora.db.invoices.toArray()).find(i => i.status === 'draft'))
    check(draft && draft.number === 'DRAFT' && draft.total === 310, `draft: saved with DRAFT number (${draft?.number} ${draft?.total})`)
    const counter = await db(page, async () => (await window.__dentora.db.clinic.get('clinic')).nextInvoiceNumber)
    check(counter === 2, `draft: invoice counter untouched (${counter})`)
    await go(page, `/invoices/${draft.id}`)
    await snap(page, 'ar-18-invoice-draft')
    await page.getByRole('button', { name: 'المزيد' }).click()
    await page.getByRole('menuitem', { name: 'حذف المسودة' }).click()
    await wait(page)
    await page.getByRole('dialog').getByRole('button', { name: 'حذف' }).click()
    await wait(page, 600)
    check(!(await db(page, async id => window.__dentora.db.invoices.get(id), draft.id)), 'draft: deleted')
    check(!(await db(page, async () => (await window.__dentora.db.treatments.get('tr-4')).invoiceId)), 'draft: treatments freed after delete')

    // --- issue another invoice, edit it, then cancel it ---
    await go(page, '/invoices?patient=pat-2&new=1')
    await page.getByRole('button', { name: /إضافة المحدد/ }).click()
    await wait(page)
    await page.getByRole('button', { name: 'إصدار الفاتورة' }).click()
    await page.waitForURL(/#\/invoices\/[^?]+$/, { timeout: 5000 }).catch(() => {})
    await wait(page, 600)
    const inv2 = await db(page, async () => (await window.__dentora.db.invoices.toArray()).find(i => i.patientId === 'pat-2'))
    check(inv2?.number === 'INV-000002' && inv2.total === 310, `second invoice INV-000002 = 310 (${inv2?.number} ${inv2?.total})`)
    await page.getByRole('button', { name: 'المزيد' }).click()
    await page.getByRole('menuitem', { name: 'تعديل' }).click()
    await wait(page, 600)
    await page.locator('.bl-line').first().locator('input').nth(2).fill('2')
    await snap(page, 'ar-19-form-edit')
    await page.getByRole('button', { name: 'حفظ التغييرات' }).click()
    await wait(page, 700)
    const inv2b = await db(page, async id => window.__dentora.db.invoices.get(id), inv2.id)
    check(inv2b.total === 660 && inv2b.number === 'INV-000002', `edit: total updated, number kept (${inv2b.total} ${inv2b.number})`)
    await page.getByRole('button', { name: 'المزيد' }).click()
    await page.getByRole('menuitem', { name: 'إلغاء الفاتورة' }).click()
    await wait(page)
    await snap(page, 'ar-20-cancel-confirm')
    await page.getByRole('dialog').getByRole('button', { name: 'إلغاء الفاتورة' }).click()
    await wait(page, 600)
    const inv2c = await db(page, async id => window.__dentora.db.invoices.get(id), inv2.id)
    check(inv2c.status === 'cancelled' && inv2c.number === 'INV-000002', 'cancel: status cancelled, number kept')
    check(!(await db(page, async () => (await window.__dentora.db.treatments.get('tr-4')).invoiceId)), 'cancel: treatments freed')
    await snap(page, 'ar-21-invoice-cancelled')

    // --- history for the list screens ---
    await seed(page, { lang: 'ar', history: true })
    await go(page, '/invoices')
    await snap(page, 'ar-22-invoices')
    await page.getByRole('tab', { name: /غير مدفوعة/ }).click()
    await wait(page)
    const unpaidRows = await page.locator('.bl-table tbody tr').count()
    const unpaidDb = await db(page, async () => (await window.__dentora.db.invoices.toArray()).filter(i => i.status === 'unpaid').length)
    check(unpaidRows === unpaidDb, `list: unpaid filter shows ${unpaidDb} rows (${unpaidRows})`)
    await page.getByRole('tab', { name: /^الكل/ }).click()
    await page.getByPlaceholder('ابحث برقم الفاتورة أو اسم المريض…').fill('سامر')
    await wait(page, 500)
    await snap(page, 'ar-23-invoices-search')
    check(await page.locator('.bl-table tbody tr').count() === 2, 'list: search by patient name (2 invoices of Samer, one cancelled)')
    await page.getByPlaceholder('ابحث برقم الفاتورة أو اسم المريض…').fill('zzzz')
    await wait(page, 500)
    await snap(page, 'ar-24-invoices-nomatch')
    await page.getByRole('button', { name: 'مسح عوامل التصفية' }).click()
    await page.locator('.chip', { hasText: 'د. ليلى حداد' }).click()
    await wait(page)
    const docRows = await page.locator('.bl-table tbody tr').count()
    const docDb = await db(page, async () => (await window.__dentora.db.invoices.toArray()).filter(i => i.doctorId === 'u-doc2').length)
    check(docRows === docDb, `list: doctor chip filters (${docRows}/${docDb})`)
    await page.locator('.chip', { hasText: 'كل الأطباء' }).click()
    await page.locator('.bl-table tbody tr').first().locator('.bl-menu-btn').click()
    await wait(page, 250)
    await snap(page, 'ar-25-invoices-row-menu')
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'مخصص' }).click()
    await wait(page)
    await snap(page, 'ar-26-invoices-custom-period')
    await page.getByRole('tab', { name: 'هذا الشهر' }).click()

    // --- payments ledger ---
    await go(page, '/payments')
    await page.getByRole('tab', { name: 'هذا الشهر' }).click()
    await wait(page, 500)
    await snap(page, 'ar-27-payments')
    const ledger = await db(page, async () => { const d = new Date(); const pad = n => String(n).padStart(2, '0'); const from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; return (await window.__dentora.db.payments.where('date').aboveOrEqual(from).toArray()).length })
    check(await page.locator('.bl-table tbody tr').count() === Math.min(25, ledger), `ledger: shows this month's payments (${ledger})`)
    await page.locator('.chip', { hasText: 'بطاقة' }).click()
    await wait(page)
    check(await page.locator('.bl-table tbody tr').count() === 1, 'ledger: method chip filters')
    await page.locator('.chip', { hasText: 'كل الطرق' }).click()
    await page.getByRole('button', { name: 'تقرير الصندوق' }).click()
    await wait(page, 600)
    await snap(page, 'ar-28-cash-report')
    await printShot(page, 'ar-29-cash-report-print', true)
    await page.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).first().click()
    await wait(page)
    // delete the card payment → its invoice goes back to unpaid
    const cardPay = await db(page, async () => (await window.__dentora.db.payments.toArray()).find(p => p.method === 'card'))
    await page.locator('.bl-table tbody tr', { hasText: 'INV-' + cardPay.invoiceId.replace('inv-h', '').padStart(6, '0') }).locator('button[aria-label="حذف"]').click()
    await wait(page)
    await page.getByRole('dialog').getByRole('button', { name: 'حذف' }).click()
    await wait(page, 600)
    const afterDel = await db(page, async id => window.__dentora.db.invoices.get(id), cardPay.invoiceId)
    check(afterDel.paid === 0 && afterDel.status === 'unpaid', `ledger: deleting a payment recomputes its invoice (${afterDel.paid} ${afterDel.status})`)

    // --- payment from the top bar: no patient yet ---
    await page.locator('.app-topbar').getByRole('button', { name: /جديد/ }).click()
    await page.getByRole('menuitem', { name: 'دفعة جديدة' }).click()
    await wait(page, 700)
    await snap(page, 'ar-30-payment-pick-patient')
    await page.getByPlaceholder('ابحث عن مريض بالاسم أو رقم الملف أو الهاتف…').fill('108')
    await wait(page)
    await page.getByRole('dialog').getByRole('option').first().click()
    await wait(page, 500)
    await snap(page, 'ar-31-payment-account')
    await page.getByRole('radio', { name: /دفعة على الحساب/ }).click()
    await wait(page)
    await page.locator('.bl-amount input').fill('')
    await page.getByRole('button', { name: 'حفظ الدفعة' }).click()
    await wait(page)
    check(await page.getByText('يجب أن يكون أكبر من صفر').count() > 0, 'payment: amount must be > 0')
    await page.locator('.bl-amount input').fill('20')
    await page.locator('.bl-refund-row .track').click()
    await wait(page)
    await snap(page, 'ar-32-payment-refund')
    await page.getByRole('button', { name: 'حفظ الاسترداد' }).click()
    await wait(page, 600)
    const refund = await db(page, async () => (await window.__dentora.db.payments.toArray()).find(p => p.patientId === 'pat-8' && p.amount < 0))
    check(refund && refund.amount === -20 && !refund.invoiceId, `refund: saved as -20 on account (${refund?.amount})`)

    // --- patient tab + statement ---
    await go(page, '/patients/pat-3?tab=billing')
    await wait(page, 500)
    await snap(page, 'ar-33-patient-tab')
    await page.getByRole('button', { name: 'كشف حساب' }).click()
    await wait(page, 600)
    await snap(page, 'ar-34-statement')
    await printShot(page, 'ar-35-statement-print', true)
    await page.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).first().click()
    await go(page, '/patients/pat-1?tab=billing')
    await snap(page, 'ar-36-patient-tab-credit')

    // --- read-only (expired trial) disables writing ---
    await db(page, async () => { await window.__dentora.db.settings.put({ key: 'installedAt', value: new Date(Date.now() - 40 * 86400000).toISOString() }); await window.__dentora.db.settings.delete('license') })
    await go(page, '/invoices')
    await wait(page, 800)
    check(await page.getByRole('button', { name: 'فاتورة جديدة' }).first().isDisabled(), 'read-only: new invoice disabled')
    await snap(page, 'ar-37-readonly')
    await browser.close()
  }

  // =============================== desktop, English ===============================
  {
    const { browser, page } = await openBrowser({ lang: 'en' })
    watchConsole(page, 'en')
    await seedAndLogin(page, { lang: 'en' })
    await seed(page, { lang: 'en', history: true })
    await go(page, '/invoices')
    await snap(page, 'en-01-invoices')
    const partial = await db(page, async () => (await window.__dentora.db.invoices.toArray()).find(i => i.status === 'partial'))
    await go(page, `/invoices/${partial.id}`)
    await snap(page, 'en-02-invoice-partial')
    await snap(page, 'en-02b-invoice-partial-full', { full: true })
    await printShot(page, 'en-03-invoice-print')
    const paid = await db(page, async () => (await window.__dentora.db.invoices.toArray()).find(i => i.status === 'paid'))
    await go(page, `/invoices/${paid.id}`)
    await snap(page, 'en-04-invoice-paid', { full: true })
    await go(page, `/invoices/${partial.id}`)
    await page.getByRole('button', { name: 'Record payment' }).first().click()
    await wait(page, 600)
    await snap(page, 'en-05-payment-modal')
    await page.keyboard.press('Escape')
    await go(page, '/invoices')
    await page.getByRole('button', { name: 'New invoice' }).first().click()
    await page.getByPlaceholder('Search patients by name, file number or phone…').fill('Mohammad')
    await page.getByRole('dialog').getByRole('option').first().click()
    await wait(page, 400)
    await page.getByRole('button', { name: /Add selected/ }).click()
    await wait(page)
    await snap(page, 'en-06-form')
    await page.keyboard.press('Escape')
    await wait(page)
    check(await page.getByRole('dialog').filter({ hasText: 'Discard this invoice?' }).count() === 1, 'form: Escape with unsaved lines asks before discarding')
    await page.getByRole('dialog').getByRole('button', { name: 'Discard' }).click()
    await wait(page)
    check(await page.locator('.bl-form').count() === 0, 'form: Discard closes it')
    await go(page, '/payments')
    await page.getByRole('tab', { name: 'This month' }).click()
    await wait(page, 500)
    await snap(page, 'en-07-payments')
    await page.getByRole('button', { name: 'Daily cash report' }).click()
    await wait(page, 600)
    await snap(page, 'en-08-cash-report')
    await printShot(page, 'en-09-cash-report-print', true)
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click()
    await page.locator('.bl-table tbody tr').first().click()
    await wait(page, 600)
    await snap(page, 'en-10-receipt')
    await printShot(page, 'en-11-receipt-print', true)
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click()
    await go(page, '/patients/pat-3?tab=billing')
    await snap(page, 'en-12-patient-tab')
    await page.getByRole('button', { name: 'Account statement' }).click()
    await wait(page, 600)
    await snap(page, 'en-13-statement')
    await browser.close()
  }

  // =============================== phone, Arabic ===============================
  {
    const { browser, page } = await openBrowser({ mobile: true, width: 390, height: 844, lang: 'ar' })
    watchConsole(page, 'mobile')
    await seedAndLogin(page, { lang: 'ar' })
    await seed(page, { lang: 'ar', history: true })
    await go(page, '/invoices')
    await snap(page, 'm-01-invoices')
    await snap(page, 'm-01b-invoices-full', { full: true })
    const partial = await db(page, async () => (await window.__dentora.db.invoices.toArray()).find(i => i.status === 'partial'))
    await go(page, `/invoices/${partial.id}`)
    await snap(page, 'm-02-invoice')
    await snap(page, 'm-02b-invoice-full', { full: true })
    await page.getByRole('button', { name: 'تسجيل دفعة' }).first().click()
    await wait(page, 700)
    await snap(page, 'm-03-payment')
    await page.keyboard.press('Escape')
    await wait(page)
    await go(page, '/invoices?patient=pat-1&new=1')
    await page.getByRole('button', { name: /إضافة المحدد/ }).click()
    await wait(page)
    await snap(page, 'm-04-form')
    await page.locator('.modal-body').evaluate(el => el.scrollTo(0, 99999))
    await wait(page)
    await snap(page, 'm-05-form-bottom')
    await page.keyboard.press('Escape')
    await wait(page)
    await page.getByRole('dialog').getByRole('button', { name: 'تجاهل' }).click()
    await wait(page)
    await go(page, '/payments')
    await page.getByRole('tab', { name: 'هذا الشهر' }).click()
    await wait(page, 500)
    await snap(page, 'm-06-payments')
    await page.locator('.bl-mcard').first().click()
    await wait(page, 600)
    await snap(page, 'm-07-receipt')
    await page.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).first().click()
    await page.getByRole('button', { name: 'تقرير الصندوق' }).click()
    await wait(page, 600)
    await snap(page, 'm-08-cash-report')
    await page.getByRole('dialog').getByRole('button', { name: 'إغلاق' }).first().click()
    await go(page, '/patients/pat-3?tab=billing')
    await page.locator('.bl-tab').scrollIntoViewIfNeeded()
    await wait(page)
    await snap(page, 'm-09-patient-tab')
    await snap(page, 'm-09b-patient-tab-full', { full: true })
    await browser.close()
  }
} finally {
  server.kill()
}

if (consoleErrors.length) { console.error('\nCONSOLE ERRORS:'); for (const e of consoleErrors) console.error(' ', e) }
console.log(`\n${failures.length ? `${failures.length} FAILED` : 'ALL CHECKS PASSED'} · console errors: ${consoleErrors.length}`)
process.exit(failures.length || consoleErrors.length ? 1 : 0)

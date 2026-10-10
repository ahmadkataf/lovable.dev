// QA for the patients module: screenshots of every screen/state (desktop RTL, desktop EN, phone) and the real flows
// (create → validate → edit → archive → delete with cascade, files upload/preview/edit/delete, clinical notes), asserting on the DB.
// Usage: npx vite build --outDir /tmp/dist-patients && QA_DIST=/tmp/dist-patients QA_PORT=4301 QA_SHOTS=qa-shots/patients node scripts/qa/patients.mjs
import { startServer, openBrowser, seedAndLogin, shot, BASE } from './lib.mjs'

const problems = []
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log('FAIL:', msg) } else console.log('ok:', msg) }
const wait = (page, ms = 450) => page.waitForTimeout(ms)
const go = async (page, hash) => { await page.goto(`${BASE}/index.html#${hash}`); await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); await wait(page, 700) }
async function noOverflow(page, label) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(o <= 1, `no horizontal overflow (${label}) [${o}px]`)
}
function watchErrors(page) {
  const errors = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
  return errors
}
const db = (page, fn, arg) => page.evaluate(fn, arg)
/** The table must not scroll sideways inside its card at desktop widths. */
async function tableFits(page, label) {
  const m = await page.evaluate(() => {
    const w = document.querySelector('.table-wrap')
    return { scroll: w.scrollWidth, client: w.clientWidth, cols: [...w.querySelectorAll('thead th')].map(th => `${th.textContent || '·'}:${Math.round(th.getBoundingClientRect().width)}`).join(' ') }
  })
  check(m.scroll <= m.client + 1, `table fits its card (${label}) [${m.scroll}/${m.client}] ${m.cols}`)
}

/** Sample images and PDFs made by the browser itself (no binary fixtures in the repo). */
async function makeFixtures(ctx) {
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 640, height: 400 })
  await p.setContent(`<body style="margin:0;background:#05070a;display:flex;align-items:center;justify-content:center;height:100vh">
    <div style="width:600px;height:340px;border-radius:40px;background:radial-gradient(ellipse at 50% 60%,#4b5563 0%,#1f2937 45%,#05070a 75%);display:flex;gap:10px;align-items:center;justify-content:center">
    ${Array.from({ length: 12 }, (_, i) => `<div style="width:30px;height:${90 + (i % 4) * 14}px;border-radius:14px 14px 40px 40px;background:linear-gradient(#e5e7eb,#9ca3af);opacity:${0.65 + (i % 3) * 0.1}"></div>`).join('')}
    </div></body>`)
  const xray = await p.screenshot({ type: 'png' })
  await p.setContent(`<body style="margin:0;height:100vh;background:linear-gradient(135deg,#fde68a,#f9a8d4 50%,#93c5fd)"><div style="position:absolute;inset:120px 220px;border-radius:50%;background:#fff7ed;box-shadow:0 0 0 18px #fecaca"></div></body>`)
  const photo = await p.screenshot({ type: 'jpeg', quality: 80 })
  await p.setContent(`<html dir="rtl"><body style="font-family:sans-serif;padding:40px"><h1>إقرار وموافقة على العلاج</h1><p>أقر أنا الموقع أدناه بموافقتي على خطة العلاج المقترحة.</p></body></html>`)
  const pdf = await p.pdf({ format: 'A4' })
  await p.close()
  return { xray, photo, pdf }
}

/** A realistic clinic: 16 patients with money, visits, treatments and activity. Returns their ids by file number. */
async function seedClinic(page) {
  return db(page, async () => {
    const d = window.__dentora.db
    const now = new Date()
    const iso = (days, h = 10, m = 0) => { const x = new Date(now); x.setDate(x.getDate() + days); x.setHours(h, m, 0, 0); return x.toISOString() }
    const day = s => s.slice(0, 10)
    const P = [
      ['أحمد محمود الخطيب', 'male', '1988-03-12', '0944123456', ['بنسلين'], ['سكري'], [], ['VIP'], 'u-admin', -200],
      ['فاطمة الزهراء العلي', 'female', '1995-07-21', '0933456789', [], [], [], ['تقويم'], 'u-doc2', -150],
      ['محمد سعيد حداد', 'male', '1975-11-02', '0955987654', [], ['ضغط', 'قلب'], ['أسبرين'], [], 'u-admin', -120],
      ['ليلى عبد الرحمن', 'female', '2015-04-10', '0944555111', [], [], [], ['أطفال'], 'u-doc2', -100],
      ['يوسف إبراهيم النجار', 'male', '1990-01-30', '0988123123', ['لاتكس', 'يود'], [], [], [], 'u-admin', -90],
      ['رنا خالد المصري', 'female', '1983-09-14', '0991222333', [], [], [], ['زراعة', 'تأمين'], 'u-admin', -80],
      ['عمر فاروق الشامي', 'male', '2001-06-06', '0947000111', [], [], [], [], undefined, -70],
      ['سارة نبيل قاسم', 'female', '1999-12-25', '0936777888', [], ['ربو'], [], [], 'u-doc2', -60],
      ['خالد وليد الحمصي', 'male', '1968-02-17', '0958444555', [], ['سكري', 'ضغط'], ['ميتفورمين', 'إنسولين'], [], 'u-admin', -50],
      ['هبة سمير الأحمد', 'female', '1992-08-08', '0962111222', [], [], [], [], undefined, -40],
      ['مازن جورج عيسى', 'male', '1985-05-19', '0949888777', [], [], [], ['VIP'], 'u-admin', -30],
      ['نور الهدى صالح', 'female', '2008-10-01', '0933111999', [], [], [], ['تقويم', 'أطفال'], 'u-doc2', -20],
      ['باسل ماهر الدروبي', 'male', '1979-03-03', '0957333222', [], [], [], [], undefined, -15],
      ['ريم أنور السيد', 'female', '1997-04-27', '0934222111', ['أسبرين'], [], [], [], 'u-doc2', -3],
      ['طارق حسن الزعبي', 'male', undefined, '+963 944 765 432', [], [], [], [], undefined, -2],
      ['جود مروان الحلبي', 'female', '2019-09-09', '0945678901', [], [], [], ['أطفال'], 'u-doc2', -1],
    ]
    const clinic = await d.clinic.get('clinic')
    let fileNo = clinic.nextFileNumber || 1
    const ids = []
    for (const [name, gender, birthDate, phone, allergies, chronicDiseases, medications, tags, doctorId, created] of P) {
      const id = 'p' + fileNo
      ids.push(id)
      await d.patients.add({ id, fileNo, name, gender, birthDate, phone, allergies, chronicDiseases, medications, tags, doctorId, archived: name.startsWith('باسل'),
        email: fileNo % 3 === 0 ? `patient${fileNo}@mail.com` : undefined, address: fileNo % 2 ? 'دمشق — المزة، شارع الجلاء' : undefined,
        bloodType: ['O+', 'A+', 'B-', 'AB+'][fileNo % 4], occupation: fileNo % 2 ? 'مهندس' : 'معلمة', nationalId: fileNo % 4 === 1 ? '0102030405' + fileNo : undefined,
        insuranceCompany: tags.includes('تأمين') ? 'السورية للتأمين' : undefined, insuranceNumber: tags.includes('تأمين') ? 'INS-44821' : undefined,
        medicalNotes: chronicDiseases.includes('سكري') ? 'يُفضّل المواعيد الصباحية بعد الإفطار. مراقبة سكر الدم قبل الجراحة.' : undefined,
        notes: fileNo === 1 ? 'يفضّل التواصل عبر واتساب. يأتي مع ابنه أحياناً.' : undefined,
        createdAt: iso(created), updatedAt: iso(created) })
      fileNo++
    }
    await d.clinic.put({ ...clinic, nextFileNumber: fileNo })
    const inv = (n, patientId, total, status, daysAgo) => ({ id: 'inv' + n, number: 'INV-' + String(n).padStart(6, '0'), patientId, date: day(iso(-daysAgo)), items: [], subtotal: total, discount: 0, taxPercent: 0, tax: 0, total, paid: 0, status, createdAt: iso(-daysAgo), updatedAt: iso(-daysAgo) })
    await d.invoices.bulkAdd([inv(1, ids[0], 450, 'partial', 20), inv(2, ids[2], 1200, 'paid', 40), inv(3, ids[4], 300, 'unpaid', 10), inv(4, ids[5], 2000, 'partial', 30), inv(5, ids[8], 800, 'paid', 25), inv(6, ids[10], 500, 'draft', 5), inv(7, ids[1], 150, 'cancelled', 5)])
    const pay = (n, patientId, amount, daysAgo) => ({ id: 'pay' + n, patientId, amount, method: 'cash', date: day(iso(-daysAgo)), createdAt: iso(-daysAgo) })
    await d.payments.bulkAdd([pay(1, ids[0], 200, 20), pay(2, ids[2], 1200, 40), pay(3, ids[5], 1500, 30), pay(4, ids[8], 900, 25)])
    const apt = (n, patientId, dayOffset, h, status, type = 'treatment', doctorId = 'u-admin') => ({ id: 'apt' + n, patientId, doctorId, date: day(iso(dayOffset, h)), start: iso(dayOffset, h), end: iso(dayOffset, h, 30), durationMin: 30, type, status, createdAt: iso(-60), updatedAt: iso(-60) })
    await d.appointments.bulkAdd([
      apt(1, ids[0], -12, 10, 'completed', 'checkup'), apt(2, ids[0], -5, 11, 'completed'), apt(3, ids[0], 2, 10, 'confirmed'), apt(4, ids[0], 9, 12, 'scheduled', 'followup', 'u-doc2'), apt(5, ids[0], 1, 9, 'cancelled'),
      apt(6, ids[1], 1, 13, 'scheduled', 'orthodontic', 'u-doc2'), apt(7, ids[1], -30, 13, 'completed', 'orthodontic', 'u-doc2'),
      apt(8, ids[2], -1, 9, 'completed'), apt(9, ids[4], -45, 9, 'completed'), apt(10, ids[5], -8, 15, 'completed', 'surgery'), apt(11, ids[8], -2, 10, 'completed'), apt(12, ids[3], 0, 16, 'scheduled', 'checkup', 'u-doc2'),
    ])
    const tr = (n, patientId, name, tooth, status, price) => ({ id: 'tr' + n, patientId, procedureName: name, tooth, price, discount: 0, status, doctorId: 'u-admin', createdAt: iso(-20), updatedAt: iso(-5), completedAt: status === 'completed' ? iso(-5) : undefined })
    await d.treatments.bulkAdd([tr(1, ids[0], 'حشوة كمبوزيت', 36, 'completed', 60), tr(2, ids[0], 'تنظيف وتلميع', undefined, 'completed', 40), tr(3, ids[0], 'علاج عصب', 46, 'completed', 200), tr(4, ids[0], 'تاج زيركون', 46, 'planned', 250), tr(5, ids[0], 'قلع', 18, 'planned', 50)])
    const act = (n, patientId, type, action, message, minsAgo, by = 'u-admin') => ({ id: 'act' + n, patientId, type, action, message, at: new Date(now.getTime() - minsAgo * 60000).toISOString(), by })
    await d.activity.bulkAdd([
      act(1, ids[0], 'patient', 'create', 'أحمد محمود الخطيب', 200 * 1440), act(2, ids[0], 'appointment', 'create', 'فحص دوري', 13 * 1440, 'u-rec'), act(3, ids[0], 'treatment', 'status', 'علاج عصب — السن 46', 5 * 1440),
      act(4, ids[0], 'invoice', 'create', 'INV-000001 — 450', 4 * 1440), act(5, ids[0], 'payment', 'create', '200 $ نقداً', 3 * 1440, 'u-rec'), act(6, ids[0], 'appointment', 'status', 'تأكيد موعد المتابعة', 90),
    ])
    return ids
  })
}

const server = await startServer()
try {
  // ======================= desktop, Arabic (RTL) — the full flow =======================
  {
    const { browser, ctx, page } = await openBrowser({ width: 1440, height: 900 })
    const errors = watchErrors(page)
    const fx = await makeFixtures(ctx)
    await seedAndLogin(page)

    // empty state
    await go(page, '/patients')
    await shot(page, 'ar-01-list-empty')
    check(await page.locator('.empty-title', { hasText: 'لا يوجد مرضى بعد' }).isVisible(), 'empty state shows')
    await noOverflow(page, 'empty list')

    // create: validation first
    await page.locator('.page-header .btn-primary').click()
    await wait(page)
    await page.getByRole('button', { name: 'حفظ المريض' }).click()
    await wait(page, 300)
    check(await page.locator('.modal .field-error').count() === 2, 'two inline errors on an empty submit (name, phone)')
    await shot(page, 'ar-02-form-validation')
    await page.getByLabel(/^الاسم الكامل/).fill('سلمى عادل الحسيني')
    await page.getByLabel(/^الهاتف/).fill('٠٩٤٤ abc 987 654')       // Arabic digits and letters: letters dropped, digits converted
    check(await page.getByLabel(/^الهاتف/).inputValue() === '0944  987 654', 'phone box keeps digits only (Arabic digits converted)')
    await page.getByLabel(/^البريد/).fill('salma@')
    await page.getByLabel(/^البريد/).blur()
    await wait(page, 200)
    check(await page.locator('.field-error', { hasText: 'بريد إلكتروني غير صالح' }).isVisible(), 'invalid email message')
    await page.getByLabel(/^البريد/).fill('salma@mail.com')
    await page.locator('.modal').getByRole('tab', { name: 'أنثى' }).click()
    await page.getByLabel(/^تاريخ الميلاد/).fill('1994-05-17')
    await wait(page, 200)
    check(await page.locator('.pt-age').isVisible(), 'live age preview')
    const allergy = page.getByPlaceholder('أضف حساسية…')
    await allergy.fill('بنسلين')
    await allergy.press('Enter')
    await page.locator('.pt-suggest button', { hasText: 'لاتكس' }).first().click()
    await page.getByPlaceholder('أضف مرضاً مزمناً…').fill('ربو، حمل')   // a comma commits: two chips at once
    await page.getByPlaceholder('أضف وسماً…').fill('VIP')
    await page.getByPlaceholder('أضف وسماً…').press('Enter')
    // photo
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'اختيار صورة' }).click()
    await (await chooser).setFiles({ name: 'salma.jpg', mimeType: 'image/jpeg', buffer: fx.photo })
    await page.waitForSelector('.pt-photo-preview img')
    await wait(page)
    await shot(page, 'ar-03-form-filled')
    await page.locator('.modal-body').evaluate(el => el.scrollTo(0, 99999))
    await wait(page, 250)
    await shot(page, 'ar-03b-form-filled-bottom')
    // Enter in a single-line field submits
    await page.getByLabel(/^الاسم الكامل/).press('Enter')
    await page.waitForURL(/#\/patients\/[a-z0-9]+$/)
    await wait(page, 900)
    const created = await db(page, () => window.__dentora.db.patients.toArray())
    check(created.length === 1, 'one patient created')
    const sal = created[0]
    check(sal.fileNo === 1 && sal.phone === '0944987654' && sal.gender === 'female' && sal.birthDate === '1994-05-17', `stored fields (fileNo ${sal.fileNo}, phone ${sal.phone})`)
    check(JSON.stringify(sal.allergies) === JSON.stringify(['بنسلين', 'لاتكس']) && JSON.stringify(sal.chronicDiseases) === JSON.stringify(['ربو', 'حمل']) && sal.tags[0] === 'VIP', 'chip lists stored')
    check(typeof sal.photo === 'string' && sal.photo.startsWith('data:image/'), 'photo stored as data URL')
    check(sal.archived === false && sal.medications.length === 0 && !!sal.createdAt, 'defaults set')
    const acts = await db(page, id => window.__dentora.db.activity.where('patientId').equals(id).toArray(), sal.id)
    check(acts.some(a => a.action === 'create' && a.type === 'patient'), 'activity logged on create')
    await shot(page, 'ar-04-profile-new')
    check(await page.locator('.pt-alert').isVisible(), 'medical alert strip on profile')
    await noOverflow(page, 'new profile')

    // edit
    await page.getByRole('button', { name: 'تعديل', exact: true }).first().click()
    await wait(page)
    await shot(page, 'ar-05-form-edit')
    await page.getByLabel(/^الاسم الكامل/).fill('سلمى عادل الحسيني الحموي')
    await page.getByRole('button', { name: 'حفظ التغييرات' }).click()
    await wait(page, 700)
    check((await db(page, id => window.__dentora.db.patients.get(id), sal.id)).name === 'سلمى عادل الحسيني الحموي', 'edit saved')
    check(await page.locator('.pt-hero-name', { hasText: 'الحموي' }).isVisible(), 'profile reflects the edit live')

    // files tab: empty → upload image → upload pdf → preview → edit → delete
    await page.getByRole('tab', { name: /الملفات/ }).click()
    await wait(page, 700)
    check(page.url().includes('tab=files'), 'tab kept in the URL')
    await shot(page, 'ar-06-files-empty')
    let fc = page.waitForEvent('filechooser')
    await page.locator('.pt-files .empty .btn-primary').click()
    await (await fc).setFiles({ name: 'OPG-panorama.png', mimeType: 'image/png', buffer: fx.xray })
    await wait(page, 600)
    check(await page.locator('.pt-kind.active', { hasText: 'أشعة' }).isVisible(), 'kind guessed as x-ray from the name')
    await page.getByLabel(/^ملاحظة/).fill('أشعة بانوراما قبل العلاج')
    await page.getByLabel(/^السن/).fill('99')
    await wait(page, 150)
    check(await page.locator('.field-error', { hasText: 'FDI' }).isVisible(), 'invalid tooth number message')
    await shot(page, 'ar-07-upload-modal')
    await page.getByLabel(/^السن/).fill('36')
    await page.getByRole('button', { name: 'حفظ الملف' }).click()
    await wait(page, 900)
    fc = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'رفع ملف' }).first().click()
    await (await fc).setFiles({ name: 'consent-form.pdf', mimeType: 'application/pdf', buffer: fx.pdf })
    await wait(page, 500)
    check(await page.locator('.pt-kind.active', { hasText: 'موافقة' }).isVisible(), 'kind guessed as consent for consent-form.pdf')
    await page.getByRole('button', { name: 'حفظ الملف' }).click()
    await wait(page, 800)
    fc = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'رفع ملف' }).first().click()
    await (await fc).setFiles({ name: 'smile-front.jpg', mimeType: 'image/jpeg', buffer: fx.photo })
    await wait(page, 400)
    await page.getByRole('button', { name: 'حفظ الملف' }).click()
    await wait(page, 900)
    let files = await db(page, id => window.__dentora.db.files.where('patientId').equals(id).toArray(), sal.id)
    check(files.length === 3, '3 files stored')
    const x = files.find(f => f.name === 'OPG-panorama.png')
    check(x && x.kind === 'xray' && x.tooth === 36 && x.note === 'أشعة بانوراما قبل العلاج' && x.thumb?.startsWith('data:image') && x.size > 0 && x.mime === 'image/png', 'image file record (kind, tooth, note, thumb, size, mime)')
    const pdfRec = files.find(f => f.name === 'consent-form.pdf')
    check(pdfRec && !pdfRec.thumb && pdfRec.mime === 'application/pdf', 'pdf stored without thumbnail')
    await shot(page, 'ar-08-files-grid')
    await page.locator('.pt-kind-chips .chip', { hasText: 'أشعة' }).click()
    await wait(page, 300)
    check(await page.locator('.pt-file').count() === 1, 'kind filter chip narrows the grid')
    await page.locator('.pt-kind-chips .chip', { hasText: 'الكل' }).click()
    await wait(page, 300)
    await page.locator('.pt-file', { hasText: 'بانوراما' }).click()
    await wait(page, 700)
    await shot(page, 'ar-09-preview-image')
    await page.getByLabel(/^ملاحظة/).fill('أشعة بانوراما — قبل علاج العصب')
    await page.getByRole('button', { name: 'حفظ التغييرات' }).click()
    await wait(page, 500)
    check((await db(page, id => window.__dentora.db.files.get(id), x.id)).note === 'أشعة بانوراما — قبل علاج العصب', 'file note edited')
    await page.keyboard.press('ArrowLeft')  // RTL: left = next
    await wait(page, 600)
    await shot(page, 'ar-10-preview-next')
    await page.keyboard.press('Escape')
    await wait(page, 300)
    await page.locator('.pt-file', { hasText: 'consent-form' }).click()
    await wait(page, 1200)
    await shot(page, 'ar-11-preview-pdf')
    await page.getByRole('button', { name: 'حذف', exact: true }).click()
    await wait(page, 300)
    await shot(page, 'ar-12-confirm-delete-file')
    await page.locator('.modal-sm').getByRole('button', { name: 'حذف' }).click()
    await wait(page, 600)
    files = await db(page, id => window.__dentora.db.files.where('patientId').equals(id).toArray(), sal.id)
    check(files.length === 2 && !files.some(f => f.name === 'consent-form.pdf'), 'file deleted')

    // clinical notes
    await page.locator('.pt-notes .empty .btn').click()
    await wait(page)
    await page.getByRole('button', { name: 'حفظ', exact: true }).click()
    await wait(page, 200)
    check(await page.locator('.modal .field-error').isVisible(), 'empty note is rejected inline')
    await page.getByLabel(/^الملاحظة/).fill('تم إجراء تنظيف عميق وتلميع.\nيُنصح بمراجعة بعد ستة أشهر واستخدام خيط الأسنان يومياً.')
    await shot(page, 'ar-13-note-modal')
    await page.getByLabel(/^الملاحظة/).press('Control+Enter')
    await wait(page, 600)
    let notes = await db(page, id => window.__dentora.db.notes.where('patientId').equals(id).toArray(), sal.id)
    check(notes.length === 1 && notes[0].doctorId === 'u-admin' && notes[0].text.includes('تنظيف عميق'), 'note saved (Ctrl+Enter) with the signed-in doctor')
    await page.locator('.pt-notes').getByRole('button', { name: 'ملاحظة جديدة' }).click()
    await wait(page)
    await page.getByLabel(/^التاريخ/).fill('2026-09-28')
    await page.getByLabel(/^الطبيب/).selectOption('u-doc2')
    await page.getByLabel(/^الملاحظة/).fill('استشارة تقويم: ازدحام خفيف في الفك السفلي. اقتراح تقويم شفاف.')
    await page.getByRole('button', { name: 'حفظ', exact: true }).click()
    await wait(page, 600)
    check((await page.locator('.pt-note').first().textContent()).includes('تنظيف عميق'), 'notes newest first')
    await page.locator('.pt-note').nth(1).getByRole('button', { name: 'تعديل' }).click()
    await wait(page)
    await page.getByLabel(/^الملاحظة/).fill('استشارة تقويم: ازدحام خفيف في الفك السفلي. تم شرح خيارات التقويم الشفاف.')
    await page.getByRole('button', { name: 'حفظ', exact: true }).click()
    await wait(page, 600)
    notes = await db(page, id => window.__dentora.db.notes.where('patientId').equals(id).toArray(), sal.id)
    check(notes.length === 2 && notes.some(n => n.text.includes('تم شرح') && n.doctorId === 'u-doc2'), 'note edited')
    await page.mouse.wheel(0, 900)
    await wait(page, 300)
    await shot(page, 'ar-14-files-and-notes')

    // seed a real clinic and look at the list
    const ids = await seedClinic(page)
    await go(page, '/patients')
    await shot(page, 'ar-15-list')
    await noOverflow(page, 'list')
    await tableFits(page, 'list 1440')
    const statTexts = await page.locator('.pt-stats .stat-value').allTextContents()
    check(statTexts.join('|') === '16|4|3', `stats total/new/with-balance = 16|4|3 [${statTexts.join('|')}]`)
    check((await page.locator('.page-subtitle').textContent()).includes('16 مريضاً'), 'Arabic plural in the subtitle (16 مريضاً)')
    const firstBalance = await page.locator('tr', { hasText: 'أحمد محمود الخطيب' }).locator('td.num').textContent()
    check(firstBalance.includes('250'), `balance computed (450 − 200 = 250) [${firstBalance}]`)
    const creditCell = await page.locator('tr', { hasText: 'خالد وليد الحمصي' }).locator('td.num .money').getAttribute('class')
    check(creditCell.includes('pos'), 'credit shown in green')

    // search (Arabic-aware) and phone
    await page.getByPlaceholder(/ابحث بالاسم/).fill('احمد')
    await wait(page, 500)
    check(await page.locator('tbody tr').count() === 2, 'search "احمد" finds أحمد and الأحمد')
    await shot(page, 'ar-16-list-search')
    await page.getByPlaceholder(/ابحث بالاسم/).fill('0958 444')
    await wait(page, 500)
    check(await page.locator('tbody tr').count() === 1, 'search by phone with spaces')
    await page.getByPlaceholder(/ابحث بالاسم/).fill('زززز')
    await wait(page, 500)
    await shot(page, 'ar-17-list-no-results')
    check(await page.locator('.empty-title', { hasText: 'لا توجد نتائج مطابقة' }).isVisible(), 'search empty state')
    await page.getByRole('button', { name: 'مسح التصفية' }).first().click()
    await wait(page, 500)
    // filters
    await page.locator('.pt-filters .segmented button', { hasText: 'أنثى' }).click()
    await wait(page, 400)
    const femaleRows = await page.locator('tbody tr').count()
    check(femaleRows === 9, `gender filter (9 women incl. سلمى) [${femaleRows}]`)
    await page.locator('.pt-filters .segmented button', { hasText: 'الكل' }).click()
    await page.locator('.pt-stat').nth(2).click()
    await wait(page, 400)
    check(await page.locator('tbody tr').count() === 3, 'stat card "with balance" filters to 3')
    await shot(page, 'ar-18-list-balance-filter')
    await page.locator('.pt-stat').nth(2).click()
    await page.locator('.pt-filters select').nth(1).selectOption('VIP')
    await wait(page, 400)
    check(await page.locator('tbody tr').count() === 3, 'tag filter VIP (3)')
    await page.locator('.pt-filters select').nth(1).selectOption('')
    await page.locator('.pt-filters select').nth(0).selectOption('u-doc2')
    await wait(page, 400)
    check(await page.locator('tbody tr').count() === 6, 'doctor filter (6 with د. ليلى)')
    await page.locator('.pt-filters select').nth(0).selectOption('')
    // sort
    await page.locator('.pt-filters .menu-anchor .btn').click()
    await wait(page, 300)
    await shot(page, 'ar-19-sort-menu')
    await page.locator('.menu-item', { hasText: 'الأعلى مستحقات' }).click()
    await wait(page, 400)
    check((await page.locator('tbody tr').first().textContent()).includes('رنا خالد المصري'), 'sort by balance puts the largest debt first (500)')
    // row menu at the bottom of the table opens upward and is not clipped
    await page.locator('tbody tr').last().locator('.pt-rowmenu .btn').click()
    await wait(page, 300)
    const menuBox = await page.locator('.pt-popmenu').boundingBox()
    check(menuBox && menuBox.y + menuBox.height <= 900, 'row menu fully on screen')
    await shot(page, 'ar-20-row-menu')
    await page.keyboard.press('Escape')
    // archived view
    await page.getByRole('button', { name: /الأرشيف/ }).click()
    await wait(page, 400)
    check(await page.locator('tbody tr').count() === 1, 'archived view lists the archived file')
    await shot(page, 'ar-21-list-archived')
    await page.locator('tbody tr').first().locator('.pt-rowmenu .btn').click()
    await page.locator('.pt-popmenu .menu-item', { hasText: 'استعادة' }).click()
    await wait(page, 500)
    check((await db(page, id => window.__dentora.db.patients.get(id), ids[12])).archived === false, 'restore from the row menu')
    await page.getByRole('button', { name: /الأرشيف/ }).click()
    await wait(page, 300)
    // sort back to recent for later screenshots
    await page.locator('.pt-filters .menu-anchor .btn').click()
    await page.locator('.menu-item', { hasText: 'الأحدث إضافة' }).click()
    await wait(page, 300)

    // duplicate phone warning
    await page.locator('.page-header .btn-primary').click()
    await wait(page)
    await page.getByLabel(/^الاسم الكامل/).fill('سامي أحمد الخطيب')
    await page.getByLabel(/^الهاتف/).fill('0944 123 456')
    await wait(page, 300)
    check(await page.locator('.pt-dup').isVisible(), 'duplicate phone warning (non-blocking)')
    await shot(page, 'ar-22-form-duplicate')
    await page.keyboard.press('Escape')
    await wait(page, 300)
    // typed data: Escape asks before throwing it away
    check(await page.locator('.modal-title', { hasText: 'تجاهل التغييرات؟' }).isVisible(), 'Escape on a typed form asks before discarding')
    await page.getByRole('button', { name: 'إغلاق دون حفظ' }).click()
    await wait(page, 300)
    check(await page.locator('.modal').count() === 0, 'Escape closes the form (after confirming the discard)')

    // full profile
    await go(page, `/patients/${ids[0]}`)
    await shot(page, 'ar-23-profile')
    await shot(page, 'ar-23b-profile-full', { full: true })
    await page.locator('.pt-hero-main').screenshot({ path: 'qa-shots/patients/ar-23c-hero-closeup.png' })
    check(await page.locator('.pt-hero-meta .ltr').evaluate(el => getComputedStyle(el).direction) === 'ltr', 'blood type rendered LTR')
    await noOverflow(page, 'profile')
    check((await page.locator('.pt-kpi').nth(0).textContent()).includes('250'), 'profile balance 250')
    check((await page.locator('.pt-kpi').nth(3).textContent()).includes('3'), 'completed treatments 3')
    check(await page.locator('.pt-apt').count() === 2, 'two upcoming appointments (cancelled excluded)')
    check(await page.locator('.pt-tl-item').count() === 6, 'recent activity (6)')
    await page.getByRole('tab', { name: /مخطط الأسنان/ }).click()
    await wait(page, 900)
    await shot(page, 'ar-24-profile-chart-tab')
    // the appointment and payment buttons open the other modules' forms for this patient
    await page.locator('.pt-hero-actions .btn', { hasText: 'دفعة' }).click()
    await wait(page, 900)
    const payOpen = await page.locator('.modal').count()
    if (payOpen) { await shot(page, 'ar-24b-payment-from-profile'); await page.keyboard.press('Escape'); await wait(page, 300) }
    console.log('payment form opened from profile:', payOpen > 0)
    await page.locator('.pt-hero-actions .btn', { hasText: 'موعد' }).click()
    await wait(page, 900)
    const aptOpen = await page.locator('.modal').count()
    if (aptOpen) { await shot(page, 'ar-24c-appointment-from-profile'); await page.keyboard.press('Escape'); await wait(page, 300) }
    console.log('appointment form opened from profile:', aptOpen > 0)
    // archive and restore from the profile
    await page.locator('.pt-hero-actions .menu-anchor .btn').click()
    await page.locator('.menu-item', { hasText: 'أرشفة' }).click()
    await wait(page, 500)
    check((await db(page, id => window.__dentora.db.patients.get(id), ids[0])).archived === true, 'archive from profile')
    await shot(page, 'ar-25-profile-archived')
    await page.locator('.pt-hero-actions .menu-anchor .btn').click()
    await page.locator('.menu-item', { hasText: 'استعادة' }).click()
    await wait(page, 400)

    // delete with cascade (from the profile)
    await page.locator('.pt-hero-actions .menu-anchor .btn').click()
    await page.locator('.menu-item', { hasText: 'حذف المريض' }).click()
    await wait(page, 300)
    await shot(page, 'ar-26-confirm-delete-patient')
    await page.locator('.modal-sm').getByRole('button', { name: 'حذف' }).click()
    await page.waitForURL(/#\/patients$/)
    await wait(page, 600)
    const left = await db(page, async id => {
      const d = window.__dentora.db
      const counts = {}
      for (const n of ['appointments', 'treatments', 'invoices', 'payments', 'activity']) counts[n] = await d[n].where('patientId').equals(id).count()
      return { patient: await d.patients.get(id), counts }
    }, ids[0])
    check(!left.patient && Object.values(left.counts).every(c => c === 0), `cascade delete leaves nothing behind ${JSON.stringify(left.counts)}`)
    // delete from the list row menu
    const before = await db(page, () => window.__dentora.db.patients.count())
    await page.locator('tr', { hasText: 'رنا خالد المصري' }).locator('.pt-rowmenu .btn').click()
    await page.locator('.pt-popmenu .menu-item', { hasText: 'حذف' }).click()
    await page.locator('.modal-sm').getByRole('button', { name: 'حذف' }).click()
    await wait(page, 600)
    check(await db(page, () => window.__dentora.db.patients.count()) === before - 1, 'delete from the list')
    check(await db(page, id => window.__dentora.db.invoices.where('patientId').equals(id).count(), ids[5]) === 0, 'list delete cascades invoices')

    // not found
    await go(page, '/patients/does-not-exist')
    await shot(page, 'ar-27-not-found')
    check(await page.locator('.empty-title', { hasText: 'المريض غير موجود' }).isVisible(), 'not-found state')

    check(errors.length === 0, `no console errors on desktop AR ${errors.slice(0, 5).join(' | ')}`)
    await browser.close()
  }

  // ======================= desktop, English (LTR) =======================
  {
    const { browser, ctx, page } = await openBrowser({ width: 1440, height: 900, lang: 'en' })
    const errors = watchErrors(page)
    const fx = await makeFixtures(ctx)
    await seedAndLogin(page, { lang: 'en' })
    const ids = await seedClinic(page)
    await go(page, '/patients')
    await shot(page, 'en-01-list')
    await noOverflow(page, 'en list')
    check((await page.locator('.page-subtitle').textContent()).includes('15 patients'), 'English count (15 active)')
    await tableFits(page, 'en 1440')
    for (const [w, h] of [[1280, 800], [1100, 800], [1024, 768], [900, 1000]]) {
      await page.setViewportSize({ width: w, height: h }); await wait(page, 400)
      await tableFits(page, `en ${w}`); await noOverflow(page, `en list ${w}`)
      await shot(page, `en-01-list-${w}`)
    }
    await page.setViewportSize({ width: 1440, height: 900 }); await wait(page, 300)
    await go(page, `/patients/${ids[0]}`)
    await shot(page, 'en-02-profile')
    await noOverflow(page, 'en profile')
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click()
    await wait(page)
    await shot(page, 'en-03-form')
    await page.keyboard.press('Escape')
    await go(page, `/patients/${ids[0]}?tab=files`)
    let fc = page.waitForEvent('filechooser')
    await page.locator('.pt-files .empty .btn-primary').click()
    await (await fc).setFiles({ name: 'bitewing-left.png', mimeType: 'image/png', buffer: fx.xray })
    await wait(page, 500)
    await shot(page, 'en-04-upload')
    await page.getByRole('button', { name: 'Save file' }).click()
    await wait(page, 800)
    await shot(page, 'en-05-files')
    await page.locator('.pt-file').first().click()
    await wait(page, 600)
    await shot(page, 'en-06-preview')
    await page.keyboard.press('Escape')

    // a receptionist sees no clinical tabs and cannot delete
    await page.evaluate(() => localStorage.setItem('dentora.session', 'u-rec'))
    await go(page, `/patients/${ids[0]}`)
    await page.reload(); await wait(page, 1200)
    const tabNames = await page.locator('.pt-tabs .tab').allTextContents()
    check(!tabNames.some(x => /Dental chart|Treatments|Prescriptions|Lab/.test(x)) && tabNames.some(x => /Account/.test(x)), `receptionist tabs: ${tabNames.join(', ')}`)
    await page.locator('.pt-hero-actions .menu-anchor .btn').click()
    check(await page.locator('.menu-item', { hasText: 'Delete patient' }).count() === 0, 'receptionist cannot delete a patient')
    await page.keyboard.press('Escape')
    await shot(page, 'en-07-profile-receptionist')

    // expired trial: read-only, nothing can be created or changed
    await page.evaluate(async () => { await window.__dentora.db.settings.put({ key: 'installedAt', value: '2026-01-01T00:00:00.000Z' }); localStorage.setItem('dentora.session', 'u-admin') })
    await go(page, '/patients')
    await page.reload(); await wait(page, 1500)
    check(await page.locator('.page-header .btn-primary').isDisabled(), 'read-only: new patient disabled')
    await go(page, `/patients/${ids[0]}`)
    check(await page.locator('.pt-hero-actions .btn', { hasText: 'Edit' }).isDisabled(), 'read-only: edit disabled')
    await go(page, `/patients/${ids[0]}?tab=files`)
    check(await page.locator('.pt-files .card-header .btn-primary').isDisabled(), 'read-only: upload disabled')
    await shot(page, 'en-08-readonly-files')
    check(errors.length === 0, `no console errors on desktop EN ${errors.slice(0, 5).join(' | ')}`)
    await browser.close()
  }

  // ======================= phone, Arabic =======================
  {
    const { browser, ctx, page } = await openBrowser({ mobile: true, width: 390, height: 844 })
    const errors = watchErrors(page)
    const fx = await makeFixtures(ctx)
    await seedAndLogin(page)
    await go(page, '/patients')
    await shot(page, 'm-01-list-empty')
    await noOverflow(page, 'phone empty list')
    const ids = await seedClinic(page)
    await go(page, '/patients')
    await shot(page, 'm-02-list')
    await noOverflow(page, 'phone list')
    check(await page.locator('.pt-card').count() > 0 && await page.locator('table').count() === 0, 'phone shows cards instead of a table')
    const tap = await page.locator('.pt-card .pt-icon-link').first().boundingBox()
    check(tap && tap.width >= 40 && tap.height >= 40, `call button is a 40px touch target [${tap?.width}x${tap?.height}]`)
    await page.mouse.wheel(0, 1600)
    await wait(page, 300)
    await shot(page, 'm-03-list-scrolled')
    await go(page, '/patients')
    await page.locator('.page-header .btn-primary').click()
    await wait(page, 600)
    await shot(page, 'm-04-form')
    await page.getByRole('button', { name: 'حفظ المريض' }).click()
    await wait(page, 300)
    await shot(page, 'm-05-form-errors')
    await page.keyboard.press('Escape')
    await go(page, `/patients/${ids[0]}`)
    await shot(page, 'm-06-profile')
    await noOverflow(page, 'phone profile')
    await shot(page, 'm-06b-profile-full', { full: true })
    await go(page, `/patients/${ids[0]}?tab=files`)
    let fc = page.waitForEvent('filechooser')
    await page.locator('.pt-files .empty .btn-primary').click()
    await (await fc).setFiles({ name: 'xray-46.png', mimeType: 'image/png', buffer: fx.xray })
    await wait(page, 600)
    await shot(page, 'm-07-upload')
    await page.getByRole('button', { name: 'حفظ الملف' }).click()
    await wait(page, 800)
    fc = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'رفع ملف' }).first().click()
    await (await fc).setFiles({ name: 'smile.jpg', mimeType: 'image/jpeg', buffer: fx.photo })
    await wait(page, 400)
    await page.getByRole('button', { name: 'حفظ الملف' }).click()
    await wait(page, 800)
    await shot(page, 'm-08-files')
    await noOverflow(page, 'phone files')
    await page.locator('.pt-file').first().click()
    await wait(page, 700)
    await shot(page, 'm-09-preview')
    await page.keyboard.press('Escape')
    await wait(page, 300)
    await page.locator('.pt-notes .empty .btn').click()
    await wait(page, 500)
    await shot(page, 'm-10-note-modal')
    check(errors.length === 0, `no console errors on phone ${errors.slice(0, 5).join(' | ')}`)
    await browser.close()
  }
} finally { server.kill() }

console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\npatients QA clean')
process.exit(problems.length ? 1 : 0)

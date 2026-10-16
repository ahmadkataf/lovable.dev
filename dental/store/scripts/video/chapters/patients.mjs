// Chapter 4, "Patients: files and medical history" (server/videos/index.ts, guide topic server/guide/topics/patients.ts).
// Follows the guide's order: the list and its figure cards, adding a patient (name, gender, birth date, phone, the
// medical status section), the patient file (alert bar, figures, buttons, tabs, overview), files and clinical notes,
// search / filter / sort, and archiving instead of deleting (the delete-blocked dialog of a patient with invoices).
// The new patient is a female patient with an allergy and a chronic disease, so the red alert bar shows; the X-ray
// uploaded is drawn by the browser in before() (no binary fixture): a dark periapical-looking JPEG named after tooth 36.
// Demo file #57 (ميس عصام حمدان / Mais Issam Hamdan) has invoices and payments, so "Delete" shows the blocked dialog
// with its "Archive file" button; she is restored at the end so the demo stays complete.
const rx = (ar, en) => new RegExp(`^(${ar}|${en})$`)
const L = (lang, ar, en) => (lang === 'ar' ? ar : en)
const dialog = page => page.getByRole('dialog')

/** A periapical-looking radiograph (three posterior teeth over bone, grainy, vignetted), screenshotted as a JPEG. */
async function drawXray(page) {
  const p = await page.context().newPage()
  await p.setViewportSize({ width: 600, height: 800 })
  const tooth = (x, w, h, roots, len, tint) => `
    <div style="position:absolute;left:${x}px;top:220px;width:${w}px;height:${h}px;border-radius:26px 26px 30px 30px;background:linear-gradient(${tint},#9aa3ad)"></div>
    <div style="position:absolute;left:${x + w / 2 - w / 7}px;top:${220 + h / 3}px;width:${w * 2 / 7}px;height:${h * 0.42}px;border-radius:50%;background:#3c4248;filter:blur(3px)"></div>
    ${roots.map(off => `<div style="position:absolute;left:${x + w / 2 + off - 20}px;top:${220 + h - 14}px;width:40px;height:${len}px;clip-path:polygon(0 0,100% 0,62% 100%,38% 100%);background:linear-gradient(#b9c0c7,#6e767e)"></div>
    <div style="position:absolute;left:${x + w / 2 + off - 2}px;top:${220 + h - 8}px;width:4px;height:${len - 18}px;background:#2d3238"></div>`).join('')}`
  await p.setContent(`<body style="margin:0;width:600px;height:800px;overflow:hidden;position:relative;background:#0b0d10">
    <div style="position:absolute;left:-60px;right:-60px;top:340px;bottom:-60px;background:linear-gradient(#262a2f,#3b4147 45%,#1f2327);filter:blur(28px)"></div>
    <div style="position:absolute;inset:0;filter:blur(2.2px)">
      ${tooth(70, 130, 150, [-38, 38], 200, '#dfe3e7')}${tooth(240, 140, 158, [-42, 42], 210, '#e3e6ea')}${tooth(420, 100, 146, [0], 205, '#d8dce0')}
      <div style="position:absolute;left:80px;top:540px;width:60px;height:56px;border-radius:50%;background:#15181b;filter:blur(6px)"></div>
    </div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 48%,transparent 50%,rgba(0,0,0,.6) 100%)"></div>
    <div style="position:absolute;inset:0;opacity:.18;background-image:repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,#000 0 1px,transparent 1px 2px);mix-blend-mode:overlay"></div>
  </body>`)
  const buffer = await p.screenshot({ type: 'jpeg', quality: 86 })
  await p.close()
  return { name: 'periapical-36.jpg', mimeType: 'image/jpeg', buffer }
}

export const chapter = {
  slug: 'patients',
  before: async ctx => { ctx.xray = await drawXray(ctx.page) },
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل ستتعلم كيف تنشئ ملف المريض، وتسجّل تنبيهاته الطبية، وترفق صوره وملاحظاته، وتجده في ثوانٍ.',
        en: 'In this chapter you will learn to create a patient file, record medical alerts, attach images and notes, and find any file in seconds.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(page.locator('.app-sidebar').getByRole('link', { name: rx('المرضى', 'Patients') })); await ui.pause(600) },
    },
    {
      id: 'open',
      say: { ar: 'افتح «المرضى» من القائمة الجانبية. تجد هنا كل ملفات العيادة.', en: 'Open Patients from the sidebar. Every file of the clinic is here.' },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.app-sidebar').getByRole('link', { name: rx('المرضى', 'Patients') }))
        await page.locator('.pt-table tbody tr').first().waitFor()
      },
    },
    {
      id: 'row',
      say: {
        ar: 'لكل مريض سطر فيه رقم ملفه واسمه وطبيبه، وهاتفه مع زرّي الاتصال وواتساب، وتنبيهاته الطبية، والمستحق عليه.',
        en: 'Each patient has a row with the file number, name and doctor, the phone with call and WhatsApp buttons, medical alerts and balance.',
      },
      run: async ({ page, ui }) => { await ui.highlight(page.locator('.pt-table tbody tr').first(), 2600) },
    },
    {
      id: 'stats',
      say: {
        ar: 'انقر على بطاقة «عليهم مستحقات» في الأعلى لتعرض هؤلاء المرضى وحدهم، وعلى «إجمالي المرضى» لتعود إلى الكل.',
        en: 'Click the With a balance due card at the top to show only those patients, and Total patients to see everyone again.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.pt-stats .stat-label', { hasText: rx('عليهم مستحقات', 'With a balance due') }))
        await page.locator('.pt-resultbar').waitFor()
        await ui.highlight(page.locator('.pt-resultbar'), 1400)
        await ui.click(page.locator('.pt-stats .stat-label', { hasText: rx('إجمالي المرضى', 'Total patients') }))
        await page.locator('.pt-resultbar').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'new',
      say: {
        ar: 'لإضافة مريض انقر على «مريض جديد». وعلى الهاتف تجده زراً عائماً أسفل الشاشة.',
        en: 'To add a patient, click New patient. On a phone it is the floating button at the bottom of the screen.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.getByRole('button', { name: rx('مريض جديد', 'New patient') }).first())
        await dialog(page).waitFor()
      },
    },
    {
      id: 'name',
      say: { ar: 'اكتب «الاسم الكامل»، وهو الحقل الوحيد المطلوب.', en: 'Type the Full name, the only required field.' },
      run: async ({ page, ui, lang }) => { await ui.type(dialog(page).getByLabel(/^(الاسم الكامل|Full name)/), L(lang, 'ريما خالد الحلبي', 'Rima Khaled Halabi')) },
    },
    {
      id: 'gender-birth',
      say: {
        ar: '«ذكر» مختار مسبقاً، فانقر على «أنثى» للمريضات، ثم أدخل «تاريخ الميلاد» فيظهر العمر تحته.',
        en: 'Male is picked by default, so click Female for a female patient, then enter the Date of birth: the age appears under it.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).getByRole('tab', { name: rx('أنثى', 'Female') }))
        await ui.type(dialog(page).locator('input[type="date"]'), '04021988', { delay: 110 })   // 2 April 1988: Chromium's date input takes month, day, year
        await dialog(page).locator('.pt-age').waitFor()
        await ui.highlight(dialog(page).locator('.pt-age'), 1200)
      },
    },
    {
      id: 'phone',
      say: {
        ar: 'أدخل «الهاتف». هو اختياري، لكن بدونه لا تصل المريض تذكيرات واتساب.',
        en: 'Enter the Phone. It is optional, but without it the patient gets no WhatsApp reminders.',
      },
      run: async ({ page, ui }) => { await ui.type(dialog(page).getByLabel(rx('الهاتف', 'Phone')), '0944 318 652') },
    },
    {
      id: 'allergy',
      say: {
        ar: 'في قسم «الحالة الصحية» اكتب الحساسية واضغط Enter، أو انقر على اقتراح جاهز مثل «بنسلين».',
        en: 'Under Medical status, type an allergy and press Enter, or click a ready suggestion such as Penicillin.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(dialog(page).locator('.form-section').nth(1), { block: 'start' })
        await ui.click(dialog(page).locator('.pt-suggest button', { hasText: rx('بنسلين', 'Penicillin') }))
      },
    },
    {
      id: 'chronic',
      say: {
        ar: 'أضف بالطريقة نفسها «الأمراض المزمنة» و«الأدوية الحالية»، واختر «فصيلة الدم» إن عرفتها.',
        en: 'Add Chronic diseases and Current medications the same way, and choose the Blood type if you know it.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).locator('.pt-suggest button', { hasText: rx('ضغط', 'Hypertension') }))
        await ui.highlight(dialog(page).getByLabel(rx('فصيلة الدم', 'Blood type')), 1300)
      },
    },
    {
      id: 'save',
      say: {
        ar: 'انقر على «حفظ المريض». يعطي دنتورا المريض رقم الملف التالي ويفتح ملفه مباشرة.',
        en: 'Click Save patient. Dentora gives the patient the next file number and opens the new file.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).getByRole('button', { name: rx('حفظ المريض', 'Save patient') }))
        await page.locator('.pt-hero').waitFor()
        await ui.highlight(page.locator('.pt-hero-titlebar'), 1600)
      },
    },
    {
      id: 'alert',
      say: {
        ar: 'تظهر الحساسية والأمراض المزمنة في شريط «تنبيه طبي» أعلى الملف، أحمر حين تكون هناك حساسية.',
        en: 'Allergies and chronic diseases appear in a Medical alert bar at the top of the file, red when there is an allergy.',
      },
      run: async ({ page, ui }) => { await ui.highlight(page.locator('.pt-alert'), 2400) },
    },
    {
      id: 'figures',
      say: {
        ar: 'تحت بيانات المريض أربعة أرقام: الرصيد المستحق، والموعد القادم، وآخر زيارة، والعلاجات المنجزة.',
        en: 'Under the patient’s details sit four figures: Balance due, Next appointment, Last visit and Completed treatments.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(page.locator('.pt-kpis')); await ui.highlight(page.locator('.pt-kpis'), 2400) },
    },
    {
      id: 'actions',
      say: {
        ar: 'والأزرار: «تعديل» للبيانات، و«موعد» للحجز، و«دفعة» لتسجيل مبلغ، والنقاط الثلاث للأرشفة أو الحذف.',
        en: 'The buttons: Edit for the details, Appointment to book, Payment to record money received, and the three dots to archive or delete.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(page.locator('.pt-act-edit')); await ui.highlight(page.locator('.pt-hero-actions'), 2400) },
    },
    {
      id: 'tabs',
      say: {
        ar: 'والتبويبات تنقلك إلى مخطط الأسنان والعلاجات والمواعيد والحساب والوصفات والمخبر والملفات.',
        en: 'The tabs take you to the Dental chart, Treatments, Appointments, Account, Prescriptions, Lab and Files.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(page.locator('.pt-tabs')); await ui.highlight(page.locator('.pt-tabs'), 2200) },
    },
    {
      id: 'overview',
      say: {
        ar: 'يعرض تبويب «نظرة عامة» المعلومات الطبية والتواصل والمواعيد القادمة، و«آخر النشاطات» على الملف ومن قام بها.',
        en: 'Overview shows the medical information, contact details, upcoming appointments, and Recent activity on the file with who did it.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.pt-overview'), { block: 'start' })
        await ui.highlight(page.locator('.pt-overview'), 2400)
      },
    },
    {
      id: 'files-tab',
      say: { ar: 'افتح تبويب «الملفات والملاحظات» لتحفظ صور الأشعة والمستندات.', en: 'Open the Files & notes tab to keep X-rays and documents.' },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.pt-tabs').getByRole('tab', { name: /الملفات والملاحظات|Files & notes/ }))
        await page.locator('.pt-files').waitFor()
      },
    },
    {
      id: 'upload',
      say: {
        ar: 'انقر على «رفع ملف» واختر صورة أو ملف PDF، أو اسحب الملف وأفلته في المربع.',
        en: 'Click Upload file and choose an image or a PDF, or drag the file onto the box.',
      },
      run: async ctx => {
        const { page, ui } = ctx
        const chooser = page.waitForEvent('filechooser')
        await ui.click(page.getByRole('button', { name: rx('رفع ملف', 'Upload file') }).first())
        await (await chooser).setFiles(ctx.xray)
        await dialog(page).waitFor()
      },
    },
    {
      id: 'kind',
      say: {
        ar: 'اختر «نوع الملف»: أشعة أو صورة أو مستند أو موافقة. ويقترحه دنتورا من اسم الملف.',
        en: 'Choose the File type: X-ray, Photo, Document or Consent. Dentora suggests one from the file name.',
      },
      run: async ({ page, ui }) => { await ui.click(dialog(page).getByRole('radio', { name: rx('أشعة', 'X-ray') })) },
    },
    {
      id: 'file-save',
      say: {
        ar: 'أضف «ملاحظة» تصف الملف، ورقم السن بترقيم FDI مثل 36، ثم انقر على «حفظ الملف».',
        en: 'Add a Note describing the file and the tooth in FDI numbering, such as 36, then click Save file.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(dialog(page).getByLabel(rx('ملاحظة', 'Note')), L(lang, 'صورة ذروية قبل المعالجة', 'Periapical X-ray before treatment'), { delay: 50 })
        await ui.type(dialog(page).getByLabel(/السن \(اختياري\)|Tooth \(optional\)/), '36')
        await ui.click(dialog(page).getByRole('button', { name: rx('حفظ الملف', 'Save file') }))
        await page.locator('.pt-file').first().waitFor()
        await ui.highlight(page.locator('.pt-file').first(), 1600)
      },
    },
    {
      id: 'note',
      say: {
        ar: 'لكتابة ملاحظة سريرية انقر على «ملاحظة جديدة»، واختر التاريخ والطبيب، واكتب ما تم في الجلسة.',
        en: 'For a clinical note, click New note, pick the date and the doctor, and write what was done in the session.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.click(page.getByRole('button', { name: rx('ملاحظة جديدة', 'New note') }).first())
        await dialog(page).waitFor()
        await ui.type(dialog(page).getByLabel(/^(الملاحظة|Note)/), L(lang, 'فحص أولي، ألم عند المضغ على السن 36. الخطة: معالجة لبية.', 'First visit, pain on chewing on tooth 36. Plan: root canal treatment.'), { delay: 40 })
      },
    },
    {
      id: 'note-save',
      say: {
        ar: 'ثم انقر على «حفظ». تُرتّب الملاحظات من الأحدث إلى الأقدم مع اسم الطبيب.',
        en: 'Then click Save. Notes are listed newest first with the doctor’s name.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).getByRole('button', { name: rx('حفظ', 'Save') }))
        await page.locator('.pt-note').first().waitFor()
        await ui.highlight(page.locator('.pt-note').first(), 1800)
      },
    },
    {
      id: 'back',
      say: { ar: 'عد إلى القائمة. مهما كثرت الملفات تصل إلى المريض في ثوانٍ.', en: 'Back to the list. However many files you have, you reach a patient in seconds.' },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.pt-crumbs a'))
        await page.locator('.pt-table tbody tr').first().waitFor()
      },
    },
    {
      id: 'search',
      say: {
        ar: 'اكتب في خانة البحث جزءاً من الاسم أو الهاتف أو رقم الملف، فتتغير النتائج مع كل حرف.',
        en: 'Type part of a name, phone or file number in the search box; the list updates as you type.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(page.locator('.pt-search input'), L(lang, 'ميس', 'Mais'), { delay: 140 })
        await page.locator('.pt-resultbar').waitFor()
      },
    },
    {
      id: 'filter',
      say: { ar: 'ضيّق القائمة بالجنس، وبالطبيب المعالج، وبالوسم.', en: 'Narrow it by gender, by treating doctor and by tag.' },
      run: async ({ page, ui }) => { await ui.click(page.locator('.pt-filters').getByRole('tab', { name: rx('أنثى', 'Female') })) },
    },
    {
      id: 'sort',
      say: {
        ar: 'واختر الترتيب من الزر الأخير: الأحدث إضافة، أو الاسم أبجدياً، أو آخر زيارة، أو الأعلى مستحقات.',
        en: 'Pick the order from the last button: Recently added, Name, Last visit or Highest balance.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.getByRole('button', { name: rx('ترتيب', 'Sort') }))
        await ui.click(page.getByRole('menuitem', { name: /الاسم أبجدياً|Name \(A–Z\)/ }))
        await ui.highlight(page.locator('.pt-resultbar'), 1200)
      },
    },
    {
      id: 'delete-blocked',
      say: {
        ar: 'افتح قائمة الإجراءات في آخر سطر المريض. الحذف نهائي وللمدير وحده، ولا يُحذف ملف عليه فواتير أو دفعات.',
        en: 'Open the actions menu at the end of the patient’s row. Deleting is permanent and for admins only, and a file with invoices or payments is never deleted.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.pt-table tbody tr', { hasText: '#57' }).locator('.pt-rowmenu button'))
        await ui.click(page.getByRole('menuitem', { name: rx('حذف', 'Delete') }))
        await page.locator('[data-testid="pt-delete-blocked"]').waitFor()
        await ui.highlight(page.locator('[data-testid="pt-delete-blocked"]'), 2000)
      },
    },
    {
      id: 'archive',
      say: {
        ar: 'لذلك أرشِف الملف بدل حذفه: يختفي من القائمة، ويبقى حسابه في التقارير، وتستعيده في أي وقت.',
        en: 'So archive the file instead: it leaves the list, its account stays in the reports, and you can restore it at any time.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).getByRole('button', { name: rx('أرشفة الملف', 'Archive file') }))
        await dialog(page).waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'archive-view',
      say: { ar: 'لرؤية الملفات المؤرشفة انقر على «الأرشيف» فوق القائمة.', en: 'To see archived files, click Archive above the list.' },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.pt-filters').getByRole('button', { name: /^(الأرشيف|Archive)/ }))
        await page.locator('.pt-row-archived').first().waitFor()
        await ui.highlight(page.locator('.pt-row-archived').first(), 1600)
      },
    },
    {
      id: 'restore',
      say: { ar: 'ولإعادة الملف إلى القائمة اختر «استعادة» من قائمة الإجراءات نفسها.', en: 'To bring a file back, choose Restore from the same actions menu.' },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.pt-row-archived').first().locator('.pt-rowmenu button'))
        await ui.click(page.getByRole('menuitem', { name: rx('استعادة', 'Restore') }))
        await page.locator('.pt-row-archived').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'clear',
      say: { ar: 'أغلق الأرشيف، ثم انقر على «مسح التصفية» فوق الجدول لتعود إلى القائمة كاملة.', en: 'Close the archive, then click Clear filters above the table to see everyone again.' },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.pt-filters').getByRole('button', { name: /^(الأرشيف|Archive)/ }))
        await page.locator('.pt-resultbar').waitFor()
        await ui.click(page.getByRole('button', { name: rx('مسح التصفية', 'Clear filters') }))
        await page.locator('.pt-resultbar').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تنشئ الملف بالاسم وحده، وتسجّل التنبيهات الطبية، وترفق الصور والملاحظات. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you create a file with just a name, record medical alerts, and attach images and notes. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.page-header'), { block: 'start' })
        await ui.moveTo(page.locator('.pt-search input'))
        await ui.highlight(page.locator('.pt-stats'), 2400)
      },
    },
  ],
}

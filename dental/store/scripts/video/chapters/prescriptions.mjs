// Chapter 9, "Prescriptions" (server/videos/index.ts, guide topic server/guide/topics/prescriptions.ts).
// Follows the guide's order: the prescriptions page (tabs, search, periods, the row buttons), writing a prescription
// (patient, doctor, date, diagnosis, the drug search with "Most prescribed", the medicine lines), the allergy
// warnings (red bar, warning in the list, red line, the question on saving), the printed sheet (Print, WhatsApp,
// Edit, Duplicate), the Prescriptions tab of the patient file, and the drug list (add, edit, Active switch).
// Demo file #6 (لمى مازن الدبّاغ / Lama Mazen Dabbagh) is allergic to penicillin: amoxicillin is added, flagged,
// questioned on saving, then replaced with clindamycin and the prescription is saved for real on a fresh demo clinic.
const rx = (ar, en) => new RegExp(`^(${ar}|${en})$`)
const L = (lang, ar, en) => (lang === 'ar' ? ar : en)
const dialog = page => page.getByRole('dialog')
const sidebar = (page, ar, en) => page.locator('.app-sidebar').getByRole('link', { name: rx(ar, en) })
/** The drug / patient suggestion list of the form (a popover rendered into <body>). */
const popover = page => page.locator('.rx-pop')
const PATIENT = { ar: 'لمى مازن الدبّاغ', en: 'Lama Mazen Dabbagh' }
/** Scrolls so `locator` sits just under the sticky top bar (scrollIntoView alone slides it under the bar). */
async function toTop(page, ui, locator) {
  await ui.scrollTo(locator, { block: 'start' })
  await page.evaluate(() => window.scrollBy({ top: -((document.querySelector('.app-topbar')?.getBoundingClientRect().height ?? 64) + 12), behavior: 'smooth' }))
  await page.waitForTimeout(500)
}

export const chapter = {
  slug: 'prescriptions',
  // set-up, not shown: the Prescriptions page (period All, no search)
  before: async ({ page }) => {
    await page.evaluate(() => { location.hash = '#/prescriptions' })
    await page.locator('.rx-page tbody tr, .rx-page .rx-mcard').first().waitFor()
    await page.waitForTimeout(400)
  },
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل ستتعلم كيف تكتب الوصفة في ثوانٍ من قائمة أدويتك، وكيف يحذّرك دنتورا من حساسية المريض، ثم تطبعها بترويسة عيادتك أو ترسلها عبر واتساب.',
        en: 'In this chapter you will learn to write a prescription in seconds from your own drug list, how Dentora warns you about the patient’s allergies, and how to print it on your letterhead or send it by WhatsApp.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(sidebar(page, 'الوصفات', 'Prescriptions')); await ui.highlight(sidebar(page, 'الوصفات', 'Prescriptions'), 1600) },
    },
    {
      id: 'page',
      say: {
        ar: 'افتح «الوصفات» من القائمة الجانبية. في تبويب «الوصفات» كل وصفات العيادة، الأحدث أولاً: التاريخ والمريض والطبيب والأدوية والتشخيص.',
        en: 'Open Prescriptions in the sidebar. The Prescriptions tab lists every prescription of the clinic, newest first: date, patient, doctor, medicines and diagnosis.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(page.locator('.rx-tabs'), 1400)
        await ui.moveTo(page.locator('.rx-page tbody tr').first())
        await ui.highlight(page.locator('.rx-page tbody tr').first(), 2000)
      },
    },
    {
      id: 'search',
      say: {
        ar: 'ابحث باسم المريض أو رقم الملف أو الدواء أو التشخيص أو رقم الوصفة، واختر الفترة: «الكل» أو «اليوم» أو «آخر 7 أيام» أو «آخر 30 يوماً» أو «هذا الشهر».',
        en: 'Search by patient name, file number, drug, diagnosis or prescription number, and pick the period: All, Today, Last 7 days, Last 30 days or This month.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(page.locator('.rx-search input'), L(lang, 'حسام', 'Hussam'), { delay: 120 })
        await ui.click(page.locator('.rx-seg-scroll').getByRole('tab', { name: rx('آخر 30 يوماً', 'Last 30 days') }))
        await ui.highlight(page.locator('.rx-page tbody tr').first(), 1200)
        await ui.click(page.locator('.rx-search .icon-end'))
        await ui.click(page.locator('.rx-seg-scroll').getByRole('tab', { name: rx('الكل', 'All') }))
      },
    },
    {
      id: 'row-buttons',
      say: {
        ar: 'انقر على أي وصفة لتعرضها وتطبعها. وفي آخر كل سطر ثلاثة أزرار: الطابعة، والنسخ كوصفة جديدة، وسلة المهملات للحذف.',
        en: 'Click any prescription to view and print it. Each row ends with three buttons: the printer, copy as new, and the bin to delete.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(page.locator('.rx-page tbody tr').first().locator('.rx-actions'))
        await ui.highlight(page.locator('.rx-page tbody tr').first().locator('.rx-actions'), 2400)
      },
    },
    {
      id: 'new',
      say: {
        ar: 'لكتابة وصفة انقر على «وصفة جديدة»، هنا أو في تبويب «الوصفات» في ملف المريض.',
        en: 'To write a prescription, click New prescription, here or in the Prescriptions tab of the patient’s file.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.page-header').getByRole('button', { name: rx('وصفة جديدة', 'New prescription') }))
        await dialog(page).locator('.rx-form').waitFor()
      },
    },
    {
      id: 'patient',
      say: { ar: 'ابحث عن «المريض» بالاسم أو رقم الملف أو الهاتف واختره.', en: 'Search for the Patient by name, file number or phone and pick them.' },
      run: async ({ page, ui, lang }) => {
        await ui.type(dialog(page).locator('.rx-form-top input[role="combobox"]'), L(lang, 'لمى', 'Lama'), { delay: 120 })
        await ui.click(popover(page).getByRole('option', { name: new RegExp(PATIENT[lang]) }))
        await dialog(page).locator('.rx-picked').waitFor()
      },
    },
    {
      id: 'details',
      say: {
        ar: 'تحقق من «الطبيب» و«التاريخ»، واكتب «التشخيص» إن شئت، مثل «التهاب لب حاد في السن 36».',
        en: 'Check the Doctor and Date, and type a Diagnosis if you wish, such as “Acute pulpitis, tooth 36”.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.highlight(dialog(page).getByLabel(/^(الطبيب|Doctor)/), 1100)
        await ui.type(dialog(page).getByLabel(rx('التشخيص', 'Diagnosis')), L(lang, 'التهاب لب حاد في السن 36', 'Acute pulpitis, tooth 36'), { delay: 55 })
      },
    },
    {
      id: 'allergy-bar',
      say: {
        ar: 'إذا كان في ملف المريض حساسية يظهر فوق قائمة الأدوية شريط أحمر «تنبيه: المريض لديه تحسس من» وتحته ما سُجّل. اقرأه قبل اختيار الأدوية.',
        en: 'If the file records an allergy, a red “Warning: the patient is allergic to” bar sits above the medicines, with what was recorded. Read it before choosing the medicines.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(dialog(page).locator('.rx-allergy')); await ui.highlight(dialog(page).locator('.rx-allergy'), 2600) },
    },
    {
      id: 'drug-search',
      say: {
        ar: 'انقر في خانة البحث عن الدواء: تظهر أولاً الأدوية «الأكثر وصفاً» في عيادتك. اكتب جزءاً من الاسم بالعربية أو الأجنبية.',
        en: 'Click in the drug search box: your clinic’s Most prescribed drugs come first. Type part of the name in Arabic or English.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.click(dialog(page).locator('.rx-drug-search input'))
        await popover(page).waitFor()
        await ui.highlight(popover(page), 1800)
        await dialog(page).locator('.rx-drug-search input').pressSequentially(L(lang, 'أموكس', 'Amox'), { delay: 120 })
        await popover(page).locator('.rx-opt-warn').first().waitFor()
      },
    },
    {
      id: 'allergy-warn',
      say: {
        ar: 'تظهر علامة تحذير بجانب الدواء الذي يتعارض مع الحساسية. وإذا أضفته يتلوّن سطره بالأحمر ويظهر تحته سبب التعارض.',
        en: 'A warning sign shows next to any drug that clashes with the allergy. If you add it, its line turns red and the reason shows under it.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(popover(page).locator('.rx-opt-warn').first(), 1400)
        await ui.click(popover(page).locator('.rx-opt-warn').first())
        await dialog(page).locator('.rx-row-danger').waitFor()
        await ui.highlight(dialog(page).locator('.rx-row-warn'), 2000)
      },
    },
    {
      id: 'line',
      say: {
        ar: 'يُضاف كل دواء سطراً فيه «التركيز» و«الجرعة» و«التكرار» و«المدة» و«طريقة الاستعمال». عدّل أياً منها أو اختر من الاقتراحات، وكرر ذلك لكل دواء.',
        en: 'Each drug is added as a line with its Strength, Dose, Frequency, Duration and Instructions. Change any of them or pick from the suggestions, and repeat for each medicine.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(dialog(page).locator('.rx-drug-search input'), L(lang, 'إيبوبروفين', 'Ibuprofen'), { delay: 110 })
        await ui.click(popover(page).locator('.rx-opt-drug', { hasText: /إيبوبروفين|Ibuprofen/ }).first())
        await dialog(page).locator('.rx-row').nth(1).waitFor()
        await ui.highlight(dialog(page).locator('.rx-row').nth(1).locator('.rx-row-grid'), 2400)
      },
    },
    {
      id: 'save-confirm',
      say: {
        ar: 'عند الحفظ يسألك دنتورا مرة أخرى عن الدواء المتعارض. انقر على «مراجعة الأدوية» لتغييره، أو على «الحفظ رغم التحذير» إن كنت متأكداً من سلامته.',
        en: 'When you save, Dentora asks once more about the clashing drug. Click Review medicines to change it, or Save anyway if you are sure it is safe.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).first().locator('.modal-footer').getByRole('button', { name: rx('حفظ الوصفة', 'Save prescription') }))
        const confirm = page.getByRole('dialog').last()
        await confirm.getByRole('button', { name: rx('مراجعة الأدوية', 'Review medicines') }).waitFor()
        await ui.highlight(confirm, 2200)
        await ui.click(confirm.getByRole('button', { name: rx('مراجعة الأدوية', 'Review medicines') }))
        await page.waitForTimeout(300)
      },
    },
    {
      id: 'replace',
      say: {
        ar: 'احذف الدواء من سطره بزر سلة المهملات، واختر بديلاً آمناً من القائمة.',
        en: 'Take the drug off with the bin on its line, and pick a safe alternative from the list.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.click(dialog(page).locator('.rx-row-danger').getByRole('button', { name: rx('حذف الدواء', 'Remove medicine') }))
        await dialog(page).locator('.rx-row-danger').waitFor({ state: 'hidden' })
        await ui.type(dialog(page).locator('.rx-drug-search input'), L(lang, 'كليندا', 'Clinda'), { delay: 110 })
        await ui.click(popover(page).locator('.rx-opt-drug', { hasText: /كليندامايسين|Clindamycin/ }).first())
        await dialog(page).locator('.rx-row').nth(1).waitFor()
      },
    },
    {
      id: 'save',
      say: { ar: 'أضف «ملاحظات» للمريض إن شئت، ثم انقر على «حفظ الوصفة». تنفتح الوصفة جاهزة للطباعة.', en: 'Add Notes for the patient if you wish, then click Save prescription. The prescription opens, ready to print.' },
      run: async ({ page, ui }) => {
        await ui.moveTo(dialog(page).locator('.rx-notes-input'))
        await ui.click(dialog(page).locator('.modal-footer').getByRole('button', { name: rx('حفظ الوصفة', 'Save prescription') }))
        await page.locator('.rx-sheet').waitFor()
      },
    },
    {
      id: 'sheet',
      say: {
        ar: 'تُطبع الوصفة بترويسة العيادة، وفيها اسم الطبيب واختصاصه، وبيانات المريض، ثم التاريخ ورقم الوصفة والتشخيص والأدوية بجرعاتها، وفي أسفلها مكان لتوقيع الطبيب وختمه.',
        en: 'The prescription prints on the clinic letterhead with the doctor’s name and specialty, the patient’s details, then the date, prescription number, diagnosis and medicines with their doses, and room at the bottom for the doctor’s signature and stamp.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(page.locator('.rx-sheet-head'))
        await ui.highlight(page.locator('.rx-sheet-head'), 1500)
        await ui.highlight(page.locator('.rx-patient'), 1500)
        await ui.highlight(page.locator('.rx-items'), 1800)
        await ui.scrollTo(page.locator('.rx-sheet-foot'))
        await ui.highlight(page.locator('.rx-sign'), 1400)
      },
    },
    {
      id: 'sheet-actions',
      say: {
        ar: 'انقر على «طباعة» واختر الطابعة أو الحفظ PDF، أو على «واتساب» لإرسالها للمريض رسالةً نصية. ولتغييرها انقر على «تعديل»، ولوصفة مشابهة لاحقاً انقر على «نسخ مكرر».',
        en: 'Click Print and choose a printer or save as PDF, or WhatsApp to send it to the patient as a text message. To change it click Edit, and for a similar one at a new visit click Duplicate.',
      },
      run: async ({ page, ui }) => {
        const footer = page.locator('.rx-sheet-modal .modal-footer')
        await ui.moveTo(footer.getByRole('button', { name: rx('طباعة', 'Print') }))
        await ui.highlight(footer.getByRole('button', { name: rx('طباعة', 'Print') }), 1200)
        await ui.highlight(footer.getByRole('button', { name: rx('واتساب', 'WhatsApp') }), 1200)
        await ui.highlight(footer.getByRole('button', { name: rx('تعديل', 'Edit') }), 1000)
        await ui.highlight(footer.getByRole('button', { name: rx('نسخ مكرر', 'Duplicate') }), 1000)
        await ui.click(page.locator('.rx-sheet-modal .modal-x'))
        await page.locator('.rx-sheet').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'patient-tab',
      say: {
        ar: 'يجمع تبويب «الوصفات» في ملف المريض وصفاته، الأحدث أولاً. انقر على وصفة لعرضها، أو على زر الطابعة أو زر النسخ بجانبها. و«وصفة جديدة» هنا يكون المريض فيها محدداً سلفاً.',
        en: 'The Prescriptions tab of the patient file gathers their prescriptions, newest first. Click one to view it, or the printer or copy button next to it. New prescription here has the patient already set.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.rx-page tbody tr').first().locator('.rx-patient-link'))
        await page.locator('.rx-ptab .rx-pitem').first().waitFor()
        await toTop(page, ui, page.locator('.pt-tabs'))
        await ui.highlight(page.locator('.rx-ptab .rx-pitem').first(), 1800)
        await ui.highlight(page.locator('.rx-ptab .rx-pitem').first().locator('.rx-actions'), 1300)
        const add = page.locator('.rx-ptab').getByRole('button', { name: rx('وصفة جديدة', 'New prescription') })
        await ui.moveTo(add)
        await ui.highlight(add, 1300)
      },
    },
    {
      id: 'drugs',
      say: {
        ar: 'أما تبويب «قائمة الأدوية» فهو ما تقترحه خانة البحث في الوصفة: لكل دواء اسمه بالعربية والأجنبية وشكله الدوائي وتركيزه وجرعته الافتراضية. يأتي دنتورا بقائمة جاهزة من 37 دواءً.',
        en: 'The Drug list tab is what the prescription’s search box offers: each drug has its Arabic and English names, form, strength and default regimen. Dentora comes with a ready list of 37 drugs.',
      },
      run: async ({ page, ui }) => {
        await ui.click(sidebar(page, 'الوصفات', 'Prescriptions'))
        await page.locator('.rx-tabs').waitFor()
        await ui.click(page.locator('.rx-tabs').getByRole('tab', { name: /^(قائمة الأدوية|Drug list)/ }))
        await page.locator('.rx-page tbody tr').first().waitFor()
        await ui.moveTo(page.locator('.rx-page tbody tr').first())
        await ui.highlight(page.locator('.rx-page .table-wrap, .rx-page table').first(), 2600)
      },
    },
    {
      id: 'add-drug',
      say: {
        ar: 'لإضافة دواء انقر على «إضافة دواء»، واكتب «اسم الدواء» و«الاسم الأجنبي» و«الشكل الدوائي» و«التركيز»، وفي قسم «الجرعة الافتراضية» الجرعة والتكرار والمدة.',
        en: 'To add a drug click Add drug, and type the Drug name, English name, Form and Strength, then the Dose, Frequency and Duration under Default regimen.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.click(page.locator('.rx-toolbar').getByRole('button', { name: rx('إضافة دواء', 'Add drug') }))
        await dialog(page).waitFor()
        await ui.type(dialog(page).getByLabel(/اسم الدواء|Drug name/), L(lang, 'نيميسوليد', 'Nimesulide'), { delay: 70 })
        if (lang === 'ar') await ui.type(dialog(page).getByLabel(rx('الاسم الأجنبي', 'English name')), 'Nimesulide', { delay: 60 })
        await ui.type(dialog(page).getByLabel(rx('الشكل الدوائي', 'Form')), L(lang, 'أقراص', 'Tablets'), { delay: 70 })
        await ui.type(dialog(page).getByLabel(rx('التركيز', 'Strength')), '100 mg', { delay: 70 })
        await ui.type(dialog(page).getByLabel(rx('الجرعة', 'Dose')), L(lang, 'قرص واحد', '1 tablet'), { delay: 70 })
        await ui.type(dialog(page).getByLabel(rx('التكرار', 'Frequency')), L(lang, 'مرتين يومياً', 'Twice a day'), { delay: 70 })
        await ui.type(dialog(page).getByLabel(rx('المدة', 'Duration')), L(lang, '5 أيام', '5 days'), { delay: 70 })
      },
    },
    {
      id: 'save-drug',
      say: {
        ar: 'ثم انقر على «إضافة دواء». تُملأ هذه القيم في الوصفة تلقائياً، وتستطيع تعديلها لكل مريض.',
        en: 'Then click Add drug. These values fill in the prescription automatically, and you can change them for each patient.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).locator('.modal-footer').getByRole('button', { name: rx('إضافة دواء', 'Add drug') }))
        await dialog(page).waitFor({ state: 'hidden' })
        await ui.type(page.locator('.rx-search input'), 'Nimesulide', { delay: 90 })
        await page.locator('.rx-page tbody tr', { hasText: 'Nimesulide' }).first().waitFor()
        await ui.highlight(page.locator('.rx-page tbody tr').first(), 1600)
        await ui.click(page.locator('.rx-search .icon-end'))
      },
    },
    {
      id: 'edit-drug',
      say: {
        ar: 'لتعديل دواء انقر على سطره، ثم على «حفظ التغييرات». ولإخفاء دواء من الوصفات الجديدة أطفئ مفتاح «نشط» في سطره، ولحذفه نهائياً انقر على سلة المهملات.',
        en: 'To edit a drug click its row, then Save changes. To hide a drug from new prescriptions, turn off the Active switch on its row; to delete it for good, click the bin.',
      },
      run: async ({ page, ui }) => {
        const row = page.locator('.rx-page tbody tr', { hasText: /أموكسيسيلين|Amoxicillin/ }).first()
        await ui.click(row.locator('.cell-main'))
        await dialog(page).waitFor()
        await ui.highlight(dialog(page).locator('.form-section').nth(1), 1500)
        await ui.moveTo(dialog(page).locator('.modal-footer').getByRole('button', { name: rx('حفظ التغييرات', 'Save changes') }))
        await ui.click(dialog(page).locator('.modal-footer').getByRole('button', { name: rx('إلغاء', 'Cancel') }))
        await dialog(page).waitFor({ state: 'hidden' })
        await ui.moveTo(row.locator('label.switch'))
        await ui.highlight(row.locator('label.switch'), 1300)
        await ui.highlight(row.getByRole('button', { name: rx('حذف', 'Delete') }), 1100)
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'على الهاتف تجد «الوصفات» تحت «المزيد» في الشريط السفلي. هكذا تكتب الوصفة من قائمتك في ثوانٍ، ويحذّرك دنتورا من الحساسية، وتطبعها بترويسة عيادتك. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'On a phone, Prescriptions is under More in the bottom bar. That is how you write a prescription from your list in seconds, get warned about allergies, and print it on your letterhead. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.rx-tabs').getByRole('tab', { name: /^(الوصفات|Prescriptions)/ }))
        await page.locator('.rx-page tbody tr').first().waitFor()
        await ui.moveTo(page.locator('.rx-page tbody tr').first())
        await ui.highlight(page.locator('.rx-page tbody tr').first(), 2000)
      },
    },
  ],
}

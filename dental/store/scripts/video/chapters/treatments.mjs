// Chapter 7, "Treatments and treatment plans" (server/videos/index.ts, guide topic server/guide/topics/treatments.ts).
// Follows the guide's order: the Treatments tab of a patient file (the four cards, the plans), creating a plan and
// adding items (procedure, teeth, surfaces, price per tooth), approving it and printing the estimate, following the
// work (Start, Complete, the chart update question, the row menu), a quick treatment, billing the completed work
// (the invoice opens), then the clinic's treatments register and the procedures price list (edit, bulk price change).
// Demo file #35 (نبيل مجد خوري / Nabil Majd Khoury): two completed plans, no open plan and no visit today, so the new
// plan sits first and the quick treatment makes the "Treatments outside plans" card appear. Teeth 35 and 36 carry no
// work in the demo. The bulk price change is applied for real (+10 % on Restorative, rounded to 5): every chapter
// starts from a fresh demo clinic.
const rx = (ar, en) => new RegExp(`^(${ar}|${en})$`)
const L = (lang, ar, en) => (lang === 'ar' ? ar : en)
const dialog = page => page.getByRole('dialog')
// the patient tabs carry a count in their name ("العلاجات 5"), so their locators match the start only
const sidebar = (page, ar, en) => page.locator('.app-sidebar').getByRole('link', { name: rx(ar, en) })
const FILE_NO = 35
const PLAN = { ar: 'حشوات تجميلية للسنين 35 و36', en: 'Composite fillings, teeth 35 and 36' }
/** The section of the plan made in this chapter. */
const newPlan = (page, lang) => page.locator('section.tr-plan', { hasText: PLAN[lang] })
/** Scrolls so `locator` sits just under the sticky top bar (scrollIntoView alone slides it under the bar). */
async function toTop(page, ui, locator) {
  await ui.scrollTo(locator, { block: 'start' })
  await page.evaluate(() => window.scrollBy({ top: -((document.querySelector('.app-topbar')?.getBoundingClientRect().height ?? 64) + 12), behavior: 'smooth' }))
  await page.waitForTimeout(500)
}

export const chapter = {
  slug: 'treatments',
  // set-up, not shown: the patient file open on the Treatments tab, the tab bar at the top of the screen
  before: async ({ page, ui }) => {
    const id = await page.evaluate(async n => (await window.__dentora.db.patients.toArray()).find(p => p.fileNo === n)?.id, FILE_NO)
    if (!id) throw new Error(`demo patient #${FILE_NO} not found`)
    await page.evaluate(id => { location.hash = `#/patients/${id}?tab=treatments` }, id)
    await page.locator('.tr-tab .tr-stats').waitFor()
    await page.locator('section.tr-plan').first().waitFor()
    await page.waitForTimeout(400)
    await toTop(page, ui, page.locator('.pt-tabs'))
  },
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل ستتعلم كيف تضع للمريض خطة علاج بأسعارها، وتتابع تنفيذها، ثم تحوّل المنجز إلى فاتورة بنقرة واحدة.',
        en: 'In this chapter you will learn to build a priced treatment plan for a patient, follow the work, and turn the completed work into an invoice in one click.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(page.locator('.pt-tabs').getByRole('tab', { name: /^(العلاجات|Treatments)/ })); await ui.pause(700) },
    },
    {
      id: 'tab',
      say: {
        ar: 'تُدار علاجات كل مريض من تبويب «العلاجات» في ملفه. وفي أعلاه أربع بطاقات: «علاجات مخططة» و«قيد التنفيذ» و«علاجات منجزة» و«منجز غير مفوتر».',
        en: 'Each patient’s treatments are managed in the Treatments tab of their file. Four cards sit at the top: Planned, In progress, Completed, and Completed, not billed.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(page.locator('.pt-tabs').getByRole('tab', { name: /^(العلاجات|Treatments)/ }), 1400)
        await ui.moveTo(page.locator('.tr-stats'))
        await ui.highlight(page.locator('.tr-stats'), 2600)
      },
    },
    {
      id: 'plans',
      say: {
        ar: 'وتحتها خطط العلاج، المفتوحة منها أولاً. انقر على رأس الخطة لبسطها أو طيّها، ففيها شريط التقدّم وجدول البنود بأسنانها ومبالغها وحالاتها.',
        en: 'Below them come the treatment plans, open ones first. Click a plan’s header to unfold or fold it: inside are the progress bar and the table of items with their teeth, amounts and statuses.',
      },
      run: async ({ page, ui }) => {
        const plan = page.locator('section.tr-plan').first()
        await ui.click(plan.locator('.tr-plan-toggle'))
        await plan.locator('.tr-items').waitFor()
        await ui.highlight(plan.locator('.tr-plan-progress'), 1300)
        await ui.highlight(plan.locator('.tr-items'), 1800)
        await ui.click(plan.locator('.tr-plan-toggle'))
        await plan.locator('.tr-items').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'new-plan',
      say: { ar: 'لإنشاء خطة انقر على «خطة علاج جديدة».', en: 'To create a plan, click New treatment plan.' },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.tr-tab-actions').getByRole('button', { name: rx('خطة علاج جديدة', 'New treatment plan') }))
        await dialog(page).waitFor()
      },
    },
    {
      id: 'plan-title',
      say: {
        ar: 'اقبل «عنوان الخطة» المقترح أو اكتب عنواناً أوضح، واختر «الطبيب»، ثم انقر على «إنشاء الخطة».',
        en: 'Keep the suggested Plan title or type a clearer one, choose the Doctor, then click Create plan.',
      },
      run: async ({ page, ui, lang }) => {
        const title = dialog(page).getByLabel(/عنوان الخطة|Plan title/)
        await ui.click(title)
        await title.selectText()
        await page.keyboard.type(PLAN[lang], { delay: 55 })
        await ui.moveTo(dialog(page).getByLabel(rx('الطبيب', 'Doctor')))
        await ui.highlight(dialog(page).getByLabel(rx('الطبيب', 'Doctor')), 1000)
        await ui.click(dialog(page).getByRole('button', { name: rx('إنشاء الخطة', 'Create plan') }))
        await dialog(page).locator('.tr-picker').waitFor()
      },
    },
    {
      id: 'procedure',
      say: {
        ar: 'تنفتح نافذة «إضافة بند علاجي» مباشرة. ابحث عن الإجراء بالاسم أو الرمز، أو اختر فئته، ثم انقر عليه فيأتي سعره من قائمة الأسعار.',
        en: 'The Add treatment window opens straight away. Search for the procedure by name or code, or pick its category, then click it. Its price comes from your price list.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(dialog(page).locator('.tr-picker-head input'), L(lang, 'سطحان', '2 surfaces'), { delay: 90 })
        await ui.click(dialog(page).getByRole('option', { name: /حشوة كومبوزيت — سطحان|Composite filling — 2 surfaces/ }))
        await dialog(page).locator('.tr-chosen').waitFor()
      },
    },
    {
      id: 'teeth',
      say: {
        ar: 'انقر على الأسنان المعنية. تستطيع اختيار أكثر من سن، فيُنشأ لكل سن بند مستقل.',
        en: 'Click the teeth involved. You can pick several: each tooth gets an item of its own.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).locator('button[data-tooth="35"]'))
        await ui.click(dialog(page).locator('button[data-tooth="36"]'))
        await ui.highlight(dialog(page).locator('.tr-sel-count'), 1200)
      },
    },
    {
      id: 'surfaces',
      say: {
        ar: 'اختر «الأسطح» إن احتجت، وعدّل «السعر لكل سن» و«الخصم» و«التاريخ المخطط» إن لزم.',
        en: 'Pick Surfaces if needed, and adjust the Price per tooth, the Discount and the Planned date if you like.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).locator('.tr-surfaces button', { hasText: /\(M\)/ }))
        await ui.click(dialog(page).locator('.tr-surfaces button', { hasText: /\(O\)/ }))
        const price = dialog(page).getByLabel(/السعر لكل سن|Price per tooth/)
        await ui.scrollTo(price)
        await ui.highlight(price, 1500)
      },
    },
    {
      id: 'add-items',
      say: { ar: 'ثم انقر على «إضافة بندين». يتبع اسم الزر عدد الأسنان التي حددتها.', en: 'Then click Add 2 items. The button counts the teeth you picked.' },
      run: async ({ page, ui, lang }) => {
        await ui.click(dialog(page).getByRole('button', { name: rx('إضافة بندين', 'Add 2 items') }))
        await dialog(page).waitFor({ state: 'hidden' })
        await newPlan(page, lang).locator('.tr-items').waitFor()
        await toTop(page, ui, newPlan(page, lang))
        await ui.highlight(newPlan(page, lang), 2000)
      },
    },
    {
      id: 'approve',
      say: { ar: 'تبدأ الخطة مسودة. حين يوافق المريض انقر على «اعتماد الخطة».', en: 'A plan starts as a draft. When the patient agrees, click Approve plan.' },
      run: async ({ page, ui, lang }) => {
        const plan = newPlan(page, lang)
        await ui.click(plan.getByRole('button', { name: rx('اعتماد الخطة', 'Approve plan') }))
        await plan.locator('.tr-plan-title-row', { hasText: rx('.*معتمدة.*', '.*Approved.*') }).waitFor()
        await ui.highlight(plan.locator('.tr-plan-title-row'), 1500)
      },
    },
    {
      id: 'estimate',
      say: {
        ar: 'ولطباعة تقدير التكلفة للمريض انقر على «طباعة التقدير»، راجع الورقة، ثم انقر على «طباعة» واختر الطابعة أو الحفظ PDF.',
        en: 'To print a cost estimate for the patient, click Print estimate. Check the sheet, then click Print and choose a printer or save as PDF.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.click(newPlan(page, lang).getByRole('button', { name: rx('طباعة التقدير', 'Print estimate') }))
        await dialog(page).locator('.tr-sheet').waitFor()
        await ui.scrollTo(dialog(page).locator('.tr-sheet-totals'))
        await ui.highlight(dialog(page).locator('.tr-sheet-totals'), 1600)
        const print = dialog(page).locator('.modal-footer').getByRole('button', { name: rx('طباعة', 'Print') })
        await ui.moveTo(print)
        await ui.highlight(print, 1200)
        await ui.click(dialog(page).locator('.modal-footer').getByRole('button', { name: rx('إغلاق', 'Close') }))
        await dialog(page).waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'start',
      say: {
        ar: 'إذا كان العمل يمتد على أكثر من جلسة انقر على «بدء» في سطر البند، فتصبح الخطة «قيد التنفيذ».',
        en: 'When work takes more than one visit, click Start on the item’s row; the plan moves to In progress.',
      },
      run: async ({ page, ui, lang }) => {
        const row = newPlan(page, lang).locator('tbody tr').first()
        await ui.click(row.getByRole('button', { name: rx('بدء', 'Start') }))
        await row.locator('td').nth(4).getByText(rx('قيد التنفيذ', 'In progress')).waitFor()
        await ui.highlight(row.locator('td').nth(4), 1300)
      },
    },
    {
      id: 'complete',
      say: { ar: 'وعند الانتهاء انقر على «إنجاز». يُسجَّل تاريخ اليوم تاريخاً للتنفيذ.', en: 'When it is finished, click Complete. Today is recorded as the date done.' },
      run: async ({ page, ui, lang }) => {
        await ui.click(newPlan(page, lang).locator('tbody tr').first().getByRole('button', { name: rx('إنجاز', 'Complete') }))
        await dialog(page).waitFor()
      },
    },
    {
      id: 'chart-update',
      say: {
        ar: 'لأن الحشوة تترك أثراً في المخطط يسألك دنتورا «تحديث مخطط الأسنان؟» ويقترح الحالة المناسبة. راجعها والأسطح، ثم انقر على «تحديث المخطط».',
        en: 'Because a filling leaves a mark on the chart, Dentora asks Update the dental chart? and suggests the finding. Check it and the surfaces, then click Update chart.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(dialog(page).getByLabel(/الحالة المسجّلة|Condition to record/), 1500)
        await ui.highlight(dialog(page).locator('.tr-chart-list'), 1300)
        await ui.click(dialog(page).getByRole('button', { name: rx('تحديث المخطط', 'Update chart') }))
        await dialog(page).waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'row-menu',
      say: {
        ar: 'لبقية الأوامر افتح قائمة النقاط الثلاث في سطر البند: «تعديل» و«إلغاء البند» و«حذف».',
        en: 'For the other actions open the three-dot menu on the item’s row: Edit, Cancel item and Delete.',
      },
      run: async ({ page, ui, lang }) => {
        const row = newPlan(page, lang).locator('tbody tr').nth(1)
        await ui.click(row.locator('.tr-item-actions').getByRole('button', { name: rx('المزيد', 'More') }))
        await page.getByRole('menu').waitFor()
        await ui.highlight(page.getByRole('menu'), 2000)
        await page.keyboard.press('Escape')
        await page.getByRole('menu').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'quick',
      say: {
        ar: 'للأعمال البسيطة التي تُنجز في الجلسة نفسها، كالفحص أو التنظيف، انقر على «علاج سريع» بدل إنشاء خطة.',
        en: 'For simple work done in the same visit, such as a check-up or a cleaning, click Quick treatment instead of making a plan.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.tr-tab-head'))
        await ui.click(page.locator('.tr-tab-actions').getByRole('button', { name: rx('علاج سريع', 'Quick treatment') }))
        await dialog(page).locator('.tr-picker').waitFor()
      },
    },
    {
      id: 'quick-pick',
      say: {
        ar: 'اختر الإجراء، ثم السن إن لزم. تحقق من «السعر» و«الطبيب»، ويكون «تاريخ التنفيذ» اليوم.',
        en: 'Pick the procedure, then the tooth if needed. Check the Price and the Doctor; the Date done is today.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(dialog(page).locator('.tr-picker-head input'), L(lang, 'فلورايد', 'Fluoride'), { delay: 90 })
        await ui.click(dialog(page).getByRole('option', { name: /تطبيق فلورايد|Fluoride varnish/ }))
        await dialog(page).locator('.tr-chosen').waitFor()
        await ui.highlight(dialog(page).getByLabel(/^(السعر|Price)/), 1200)
        await ui.highlight(dialog(page).getByLabel(/تاريخ التنفيذ|Date done/), 1200)
      },
    },
    {
      id: 'quick-save',
      say: {
        ar: 'انقر على «حفظ كعلاج منجز»، فيظهر البند مكتملاً في بطاقة «علاجات خارج الخطط»، جاهزاً للفوترة.',
        en: 'Click Save as completed. The item is saved as completed and shows under Treatments outside plans, ready to bill.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).getByRole('button', { name: rx('حفظ كعلاج منجز', 'Save as completed') }))
        await dialog(page).waitFor({ state: 'hidden' })
        await page.locator('.tr-loose').waitFor()
        await ui.scrollTo(page.locator('.tr-loose'))
        await ui.highlight(page.locator('.tr-loose'), 2000)
      },
    },
    {
      id: 'bill',
      say: {
        ar: 'لا تحتاج إلى كتابة الفاتورة بيدك. انقر على «فوترة المنجز»، وعليه عدد العلاجات المكتملة غير المفوترة.',
        en: 'You do not need to type the invoice. Click Bill completed; it shows how many completed treatments are not billed yet.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.tr-tab-head'))
        await ui.click(page.locator('.tr-tab-actions').getByRole('button', { name: /فوترة المنجز|Bill completed/ }))
        await dialog(page).locator('.tr-bill-list').waitFor()
      },
    },
    {
      id: 'bill-confirm',
      say: {
        ar: 'تظهر البنود كلها محددة، فألغِ تحديد ما لا تريد فوترته الآن. راجع الإجمالي، ثم انقر على «إصدار الفاتورة».',
        en: 'All the items are ticked; untick any you do not want to bill now. Check the total, then click Create invoice.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(dialog(page).locator('.tr-bill-list'), 1800)
        await ui.highlight(dialog(page).locator('.tr-totals .grand'), 1200)
        await ui.click(dialog(page).getByRole('button', { name: rx('إصدار الفاتورة', 'Create invoice') }))
        await page.locator('.bl-invoice-page .bl-summary').waitFor()
      },
    },
    {
      id: 'invoice',
      say: {
        ar: 'تصدر الفاتورة برقمها التالي وتنفتح أمامك لتسجّل الدفعة أو تطبعها. وللفواتير فصل خاص.',
        en: 'The invoice is issued with the next number and opens, ready for a payment or printing. Invoices have a chapter of their own.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(page.locator('.bl-title-row'))
        await ui.highlight(page.locator('.bl-title-row'), 1600)
        await ui.highlight(page.locator('.bl-summary'), 1600)
      },
    },
    {
      id: 'register',
      say: {
        ar: 'تجمع صفحة «العلاجات» في القائمة الجانبية كل البنود المخططة والمنجزة لكل المرضى، وتفتح على «هذا الشهر».',
        en: 'The Treatments page in the sidebar lists every planned and completed item for all patients, and opens on This month.',
      },
      run: async ({ page, ui }) => {
        await ui.click(sidebar(page, 'العلاجات', 'Treatments'))
        await page.locator('.tr-page .tr-stats .stat-value').first().waitFor()
        await page.locator('.tr-page tbody tr').first().waitFor()
        await ui.moveTo(page.locator('.tr-page .tr-stats'))
        await ui.highlight(page.locator('.tr-page .tr-stats'), 2200)
      },
    },
    {
      id: 'register-filter',
      say: {
        ar: 'ضيّق القائمة بالبحث باسم المريض أو الإجراء أو رقم السن، أو بالفئة أو الحالة أو الفترة أو الطبيب.',
        en: 'Narrow the list by searching for a patient, a procedure or a tooth number, or by category, status, period or doctor.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(page.locator('input.tr-search'), L(lang, 'تاج', 'Crown'), { delay: 120 })
        await ui.click(page.locator('.tr-seg-scroll').first().getByRole('tab', { name: /^(مكتمل|Completed)/ }))
        await ui.highlight(page.locator('.tr-result-bar'), 1400)
      },
    },
    {
      id: 'group',
      say: {
        ar: 'فعّل «تجميع حسب المريض» لترى بنود كل مريض معاً مع مجموعها. و«تصدير CSV» يحفظ القائمة الظاهرة في ملف تفتحه في Excel.',
        en: 'Turn on Group by patient to see each patient’s items together with their total. Export CSV saves the list on screen as a file you can open in Excel.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('label.switch', { hasText: rx('تجميع حسب المريض', 'Group by patient') }))
        await page.locator('.tr-group-head').first().waitFor()
        await ui.highlight(page.locator('.tr-section').first(), 2200)
        const csv = page.getByRole('button', { name: rx('تصدير CSV', 'Export CSV') })
        await ui.moveTo(csv)
        await ui.highlight(csv, 1400)
      },
    },
    {
      id: 'procedures',
      say: {
        ar: 'أما أسماء الإجراءات وأسعارها فيحددها المدير في «قائمة الإجراءات». يأتي دنتورا بقائمة جاهزة من 79 إجراءً في 12 فئة، بأسعار تعدّلها كما تشاء.',
        en: 'The procedure names and prices are set by the admin under Procedures. Dentora comes with a ready list of 79 procedures in 12 categories, with prices you can change as you like.',
      },
      run: async ({ page, ui }) => {
        await ui.click(sidebar(page, 'قائمة الإجراءات', 'Procedures'))
        await page.locator('.tr-page .tr-section tbody tr').first().waitFor()
        await ui.moveTo(page.locator('.tr-cat-chips'))
        await ui.highlight(page.locator('.tr-cat-chips'), 1600)
        await ui.highlight(page.locator('.tr-section').first(), 1800)
      },
    },
    {
      id: 'edit-procedure',
      say: {
        ar: 'لإضافة إجراء انقر على «إجراء جديد» واكتب اسمه وفئته وسعره. ولتعديل إجراء انقر على سطره، ثم على «حفظ التغييرات».',
        en: 'To add a procedure click New procedure and type its name, category and price. To edit one, click its row, then Save changes.',
      },
      run: async ({ page, ui }) => {
        const add = page.getByRole('button', { name: rx('إجراء جديد', 'New procedure') })
        await ui.moveTo(add)
        await ui.highlight(add, 1200)
        await ui.click(page.locator('.tr-section tbody tr').first().locator('.cell-main'))
        await dialog(page).locator('.tr-proc-form').waitFor()
        await ui.highlight(dialog(page).getByLabel(/^(السعر|Price)/), 1300)
        await ui.moveTo(dialog(page).getByRole('button', { name: rx('حفظ التغييرات', 'Save changes') }))
        await ui.pause(500)
        await ui.click(dialog(page).locator('.modal-footer').getByRole('button', { name: rx('إلغاء', 'Cancel') }))
        await dialog(page).waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'bulk',
      say: {
        ar: 'ولرفع الأسعار أو خفضها دفعة واحدة اختر الفئة أولاً إن أردت، ثم انقر على «تعديل الأسعار».',
        en: 'To raise or lower prices in one go, pick a category first if you want, then click Adjust prices.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.tr-cat-chips button', { hasText: /ترميم وحشوات|Restorative/ }))
        await page.locator('.tr-section').first().waitFor()
        await ui.click(page.getByRole('button', { name: rx('تعديل الأسعار', 'Adjust prices') }))
        await dialog(page).locator('.tr-bulk-preview').waitFor()
      },
    },
    {
      id: 'bulk-apply',
      say: {
        ar: 'اختر «زيادة» أو «تخفيض»، ونسبة مئوية أو مبلغاً ثابتاً، واكتب القيمة واختر التقريب. راجع معاينة الأسعار الجديدة، ثم انقر على «تطبيق التعديل».',
        en: 'Choose Increase or Decrease, Percentage or Fixed amount, type the Value and choose the Rounding. Check the preview of the new prices, then click Apply change.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(dialog(page).locator('.form-grid'), 1600)
        const round = dialog(page).getByLabel(rx('التقريب', 'Rounding'))
        await ui.moveTo(round)
        await round.selectOption('5')
        await ui.highlight(round, 900)
        await ui.highlight(dialog(page).locator('.tr-bulk-preview'), 2000)
        await ui.click(dialog(page).getByRole('button', { name: rx('تطبيق التعديل', 'Apply change') }))
        await dialog(page).waitFor({ state: 'hidden' })
        await ui.highlight(page.locator('.tr-section').first(), 1600)
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تضع الخطة، وتتابع بنودها حتى الإنجاز، وتفوتر المنجز بنقرة واحدة. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you build a priced plan, follow its items to completion, and bill the completed work in one click. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.tr-cat-chips button').first())
        await toTop(page, ui, page.locator('.page-header'))
        await ui.moveTo(page.locator('input.tr-search'))
        await ui.pause(800)
      },
    },
  ],
}

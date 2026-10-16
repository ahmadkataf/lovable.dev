// Chapter 8, "Invoices and payments" (server/videos/index.ts, guide topic server/guide/topics/billing.ts).
// Follows the guide's order: the invoices list (period, the four cards, search and filters), issuing an invoice
// (patient, From treatments → Add selected, From procedures, the line fields, invoice discount, Issue / Save as
// draft), the invoice page (summary bar, sheet, buttons, ⋮ menu), recording a payment and printing its receipt from
// the "Payment recorded" message, a refund with a credit note, the Payments page (cards, filters, a row's receipt,
// the daily cash report), and the patient's Account tab with the statement.
// Demo file #31 (غادة خوري / Ghada Khoury): three completed, unbilled treatments and no open invoice, so the new
// invoice is her only open one; the payment (50 of 70) and the refund (15, the fluoride varnish, with a credit
// note) are recorded for real on a fresh demo clinic.
const rx = (ar, en) => new RegExp(`^(${ar}|${en})$`)
const L = (lang, ar, en) => (lang === 'ar' ? ar : en)
const dialog = page => page.getByRole('dialog')
const sidebar = (page, ar, en) => page.locator('.app-sidebar').getByRole('link', { name: rx(ar, en) })
const PATIENT = { ar: 'غادة خوري', en: 'Ghada Khoury' }
/** The receipt dialog (openReceipt mounts its own root, but the modal itself is portalled into <body> like the others). */
const receipt = page => page.getByRole('dialog').filter({ has: page.locator('.bl-receipt') })
/** Scrolls so `locator` sits just under the sticky top bar (scrollIntoView alone slides it under the bar). */
async function toTop(page, ui, locator) {
  await ui.scrollTo(locator, { block: 'start' })
  await page.evaluate(() => window.scrollBy({ top: -((document.querySelector('.app-topbar')?.getBoundingClientRect().height ?? 64) + 12), behavior: 'smooth' }))
  await page.waitForTimeout(500)
}

export const chapter = {
  slug: 'billing',
  // set-up, not shown: the Invoices page, on this month
  before: async ({ page }) => {
    await page.evaluate(() => { location.hash = '#/invoices' })
    await page.locator('.bl-table tbody tr').first().waitFor()
    await page.waitForTimeout(400)
  },
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل ستتعلم كيف تصدر الفاتورة من العلاجات المنجزة، وتسجّل الدفعات وتطبع الإيصالات، وتتابع حساب المريض وصندوق العيادة.',
        en: 'In this chapter you will learn to issue an invoice from completed treatments, record payments and print receipts, and follow the patient’s account and the clinic’s cash.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(sidebar(page, 'الفواتير', 'Invoices')); await ui.highlight(sidebar(page, 'الفواتير', 'Invoices'), 1600) },
    },
    {
      id: 'period',
      say: {
        ar: 'افتح «الفواتير» من القائمة الجانبية. تعرض الصفحة فواتير الفترة المختارة: «اليوم» أو «هذا الأسبوع» أو «هذا الشهر» أو «الشهر الماضي» أو «مخصص».',
        en: 'Open Invoices in the sidebar. The page lists the invoices of the chosen period: Today, This week, This month, Last month or a Custom range.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.bl-period').getByRole('tab', { name: rx('هذا الشهر', 'This month') }))
        await ui.highlight(page.locator('.bl-period'), 2200)
      },
    },
    {
      id: 'cards',
      say: {
        ar: 'تلخّص البطاقات الأربع فواتير الفترة: «إجمالي الفواتير» و«المدفوع منها» و«المستحق» عليها و«عدد الفواتير».',
        en: 'The four cards sum up that period: Invoiced, Collected, Outstanding and the number of Invoices.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(page.locator('.bl-stats')); await ui.highlight(page.locator('.bl-stats'), 2600) },
    },
    {
      id: 'filters',
      say: {
        ar: 'تحتها تبحث برقم الفاتورة أو اسم المريض أو رقم ملفه أو هاتفه، وتصفّي بالحالة وبالطبيب. وانقر على أي فاتورة لتفتحها.',
        en: 'Below them you can search by invoice number or by the patient’s name, file number or phone, and filter by status and by doctor. Click any invoice to open it.',
      },
      run: async ({ page, ui }) => {
        await ui.type(page.locator('.bl-search input'), '287', { delay: 140 })
        await page.locator('.bl-table tbody tr', { hasText: '000287' }).waitFor()
        await ui.highlight(page.locator('.bl-table tbody tr').first(), 1300)
        await ui.click(page.locator('.bl-search .icon-end'))
        await ui.click(page.locator('.bl-filters').getByRole('tab', { name: /مدفوعة جزئياً|Partially paid/ }))
        await ui.highlight(page.locator('.bl-table'), 1300)
        await ui.click(page.locator('.bl-filters').getByRole('tab', { name: /^(الكل|All)/ }))
      },
    },
    {
      id: 'new-invoice',
      say: {
        ar: 'لإصدار فاتورة انقر على «فاتورة جديدة»، هنا أو في تبويب «الحساب» في ملف المريض.',
        en: 'To issue an invoice, click New invoice, here or in the Account tab of the patient’s file.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.page-header').getByRole('button', { name: rx('فاتورة جديدة', 'New invoice') }))
        await dialog(page).locator('.bl-picker input').waitFor()
      },
    },
    {
      id: 'patient',
      say: {
        ar: 'ابحث عن «المريض» بالاسم أو رقم الملف أو الهاتف واختره. يُختار «الطبيب» تلقائياً، ويمكنك تغييره.',
        en: 'Search for the Patient by name, file number or phone and pick them. The Doctor is chosen for you; you can change it.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(dialog(page).locator('.bl-picker input'), L(lang, 'غادة', 'Ghada'), { delay: 110 })
        await ui.click(dialog(page).getByRole('option', { name: new RegExp(PATIENT[lang]) }))
        await dialog(page).locator('.bl-picked').waitFor()
        await ui.highlight(dialog(page).getByLabel(rx('الطبيب', 'Doctor')), 1300)
      },
    },
    {
      id: 'from-treatments',
      say: {
        ar: 'تنفتح لوحة «من العلاجات» وفيها علاجات المريض المنجزة غير المفوترة محددةً كلها. انقر على «إضافة المحدد».',
        en: 'The From treatments panel opens with the patient’s completed, unbilled treatments, all ticked. Click Add selected.',
      },
      run: async ({ page, ui }) => {
        await dialog(page).locator('.bl-panel-item').first().waitFor()
        await ui.highlight(dialog(page).locator('.bl-panel'), 2000)
        await ui.click(dialog(page).getByRole('button', { name: /إضافة المحدد|Add selected/ }))
        await dialog(page).locator('.bl-line').first().waitFor()
      },
    },
    {
      id: 'other-lines',
      say: {
        ar: 'أضف بنوداً أخرى إن شئت: «من قائمة الإجراءات» بنقرة على الإجراء، أو «سطر حر» تكتب وصفه وسعره بنفسك.',
        en: 'Add other lines if needed: From procedures with one click on a procedure, or a Free line where you type the description and price yourself.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.click(dialog(page).locator('.bl-add-btns').getByRole('button', { name: rx('من قائمة الإجراءات', 'From procedures') }))
        await ui.type(dialog(page).locator('.bl-panel-head input'), L(lang, 'فلورايد', 'Fluoride'), { delay: 90 })
        await ui.click(dialog(page).locator('.bl-panel-item', { hasText: /فلورايد|Fluoride/ }))
        await ui.click(dialog(page).locator('.bl-panel-head').getByRole('button', { name: rx('إغلاق', 'Close') }))
        await ui.moveTo(dialog(page).locator('.bl-add-btns').getByRole('button', { name: rx('سطر حر', 'Free line') }))
        await ui.pause(400)
      },
    },
    {
      id: 'line-fields',
      say: {
        ar: 'عدّل في كل سطر «السن» و«الكمية» و«سعر الوحدة» و«الخصم» إن لزم. وأضف «خصم على الفاتورة» و«ملاحظات» تُطبع عليها.',
        en: 'Adjust each line’s Tooth, Qty, Unit price and Discount if needed. Add an Invoice discount and Notes to print on it.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(dialog(page).locator('.bl-line').last())
        await ui.highlight(dialog(page).locator('.bl-line').last(), 1800)
        const discount = dialog(page).getByLabel(rx('خصم على الفاتورة', 'Invoice discount'))
        await ui.scrollTo(discount)
        await ui.type(discount, '5', { delay: 120 })
        await ui.highlight(dialog(page).locator('.bl-totals-panel'), 1400)
      },
    },
    {
      id: 'issue',
      say: {
        ar: 'انقر على «إصدار الفاتورة»، فتأخذ رقمها التالي وتنفتح أمامك. أو انقر على «حفظ كمسودة» لتكملها لاحقاً.',
        en: 'Click Issue invoice: it takes the next number and opens. Or click Save as draft to finish it later.',
      },
      run: async ({ page, ui }) => {
        const draft = dialog(page).getByRole('button', { name: rx('حفظ كمسودة', 'Save as draft') })
        await ui.moveTo(draft)
        await ui.highlight(draft, 900)
        await ui.click(dialog(page).getByRole('button', { name: rx('إصدار الفاتورة', 'Issue invoice') }))
        await page.locator('.bl-invoice-page .bl-summary').waitFor()
      },
    },
    {
      id: 'invoice-page',
      say: {
        ar: 'تعرض صفحة الفاتورة الورقة كما يستلمها المريض: الترويسة والبنود والإجماليات وختم حالة الدفع. وفوقها شريط يلخّص «الإجمالي» و«المدفوع» و«الرصيد المستحق».',
        en: 'The invoice page shows the sheet as the patient receives it: the letterhead, the lines, the totals and the payment-status stamp. Above it, a bar sums up the Total, Paid and Balance due.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(page.locator('.bl-sheet-head'))
        await ui.highlight(page.locator('.bl-sheet'), 2600)
        await toTop(page, ui, page.locator('.page-header'))
        await ui.highlight(page.locator('.bl-summary'), 2000)
      },
    },
    {
      id: 'actions',
      say: {
        ar: 'الأزرار: «تسجيل دفعة»، و«طباعة»، و«واتساب» لرسالة فيها رقم الفاتورة والمتبقي. وفي قائمة النقاط الثلاث: «تعديل» و«إرسال عبر واتساب» و«استرداد مبلغ» و«إلغاء الفاتورة».',
        en: 'The buttons: Record payment, Print, and WhatsApp for a message with the invoice number and balance due. The three-dot menu has Edit, Send via WhatsApp, Refund and Cancel invoice.',
      },
      run: async ({ page, ui }) => {
        const header = page.locator('.page-header')
        await ui.moveTo(header.getByRole('button', { name: rx('طباعة', 'Print') }))
        await ui.highlight(header.getByRole('button', { name: rx('طباعة', 'Print') }), 1000)
        await ui.highlight(header.getByRole('button', { name: rx('واتساب', 'WhatsApp') }), 1000)
        await ui.click(header.getByRole('button', { name: rx('المزيد', 'More') }))
        await page.getByRole('menu').waitFor()
        await ui.highlight(page.getByRole('menu'), 2200)
        await page.keyboard.press('Escape')
        await page.getByRole('menu').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'payment',
      say: {
        ar: 'انقر على «تسجيل دفعة». يظهر «حساب المريض»، وتحت «تُسجَّل على» تكون هذه الفاتورة مختارة، و«المبلغ» مملوءاً بالمتبقي عليها.',
        en: 'Click Record payment. The Patient account shows, and under Apply to this invoice is chosen, with the Amount filled with its balance.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.page-header').getByRole('button', { name: rx('تسجيل دفعة', 'Record payment') }))
        await dialog(page).locator('.bl-targets').waitFor()
        await ui.highlight(dialog(page).locator('.bl-acct'), 1500)
        await ui.highlight(dialog(page).locator('.bl-targets'), 1500)
        await ui.highlight(dialog(page).locator('.bl-amount'), 1200)
      },
    },
    {
      id: 'save-payment',
      say: {
        ar: 'عدّل «المبلغ» إن دفع المريض غيره، واختر «طريقة الدفع»، وأضف «المرجع» إن وُجد، ثم انقر على «حفظ الدفعة».',
        en: 'Change the Amount if the patient paid something else, choose the Payment method, add a Reference if there is one, then click Save payment.',
      },
      run: async ({ page, ui }) => {
        // the amount comes filled with the balance (70): select it first, or the digits are appended (ui.type's click lands after the focus select)
        const amount = dialog(page).locator('.bl-amount input')
        await ui.click(amount)
        await amount.selectText()
        await page.keyboard.type('50', { delay: 120 })
        await ui.highlight(dialog(page).getByLabel(rx('طريقة الدفع', 'Payment method')), 1100)
        await ui.moveTo(dialog(page).getByLabel(rx('المرجع', 'Reference')))
        await ui.click(dialog(page).getByRole('button', { name: rx('حفظ الدفعة', 'Save payment') }))
        await page.locator('.bl-toast-action').waitFor()
      },
    },
    {
      id: 'receipt',
      say: {
        ar: 'تظهر رسالة «تم تسجيل الدفعة» ومعها رقم الإيصال. انقر فيها على «طباعة الإيصال» لعرضه وطباعته.',
        en: 'A Payment recorded message shows the receipt number. Click Print receipt in it to see and print the receipt.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.bl-toast-action'))
        await receipt(page).locator('.bl-receipt').waitFor()
        await ui.highlight(receipt(page).locator('.bl-receipt'), 2400)
        await ui.click(receipt(page).locator('.modal-footer').getByRole('button', { name: rx('إغلاق', 'Close') }))
        await receipt(page).locator('.bl-receipt').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'refund',
      say: {
        ar: 'وحين تعيد مالاً للمريض افتح قائمة النقاط الثلاث واختر «استرداد مبلغ». تحت «يُعاد من» اختر الفاتورة، واكتب «المبلغ المُعاد».',
        en: 'When you give money back to a patient, open the three-dot menu and choose Refund. Under Refund from choose the invoice, and type the Amount refunded.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.page-header').getByRole('button', { name: rx('المزيد', 'More') }))
        await ui.click(page.getByRole('menuitem', { name: rx('استرداد مبلغ', 'Refund') }))
        await dialog(page).locator('.bl-targets').waitFor()
        await ui.highlight(dialog(page).locator('.bl-targets'), 1300)
        await ui.type(dialog(page).locator('.bl-amount input'), '15', { delay: 120 })
        await dialog(page).locator('.bl-credit-note').waitFor()
      },
    },
    {
      id: 'credit-note',
      say: {
        ar: 'إذا كان المال يُعاد لأن العمل لم يُنجز أو السعر خُفّض، فأبقِ خيار «خفض الفاتورة» محدداً فلا يبقى على المريض شيء، ثم انقر على «حفظ الاسترداد».',
        en: 'If the money goes back because the work was not done or the price was lowered, keep the Lower invoice option ticked, so the patient owes nothing. Then click Save refund.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(dialog(page).locator('.bl-credit-note'))
        await ui.highlight(dialog(page).locator('.bl-credit-note'), 2200)
        await ui.click(dialog(page).getByRole('button', { name: rx('حفظ الاسترداد', 'Save refund') }))
        await dialog(page).waitFor({ state: 'hidden' })
        await ui.highlight(page.locator('.bl-summary'), 1400)
      },
    },
    {
      id: 'payments',
      say: {
        ar: 'صفحة «المدفوعات» سجل الصندوق: كل دفعة في سطر مع رقم إيصالها والفاتورة وطريقة الدفع ومن استلمها. تفتح على دفعات «اليوم».',
        en: 'The Payments page is the cash ledger: one row per payment, with its receipt number, the invoice, the method and who received it. It opens on Today.',
      },
      run: async ({ page, ui }) => {
        await ui.click(sidebar(page, 'المدفوعات', 'Payments'))
        await page.locator('.bl-table tbody tr').first().waitFor()
        await ui.moveTo(page.locator('.bl-stats'))
        await ui.highlight(page.locator('.bl-stats'), 1800)
        await ui.highlight(page.locator('.bl-table tbody tr').first(), 1800)
      },
    },
    {
      id: 'payments-filter',
      say: {
        ar: 'اختر الفترة، ثم صفِّ بالموظف المستلم أو بطريقة الدفع، أو ابحث باسم المريض أو رقم الإيصال أو رقم الفاتورة.',
        en: 'Choose the period, then filter by the staff member who received the money or by payment method, or search by patient, receipt or invoice number.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(page.locator('.bl-period'), 1200)
        await ui.click(page.locator('.bl-chips button', { hasText: rx('نقداً', 'Cash') }))
        await ui.highlight(page.locator('.bl-by'), 1100)
        await ui.moveTo(page.locator('.bl-search input'))
        await ui.highlight(page.locator('.bl-search'), 1100)
      },
    },
    {
      id: 'row-receipt',
      say: {
        ar: 'انقر على أي سطر، أو على زر الطابعة في آخره، لتفتح إيصاله وتطبعه.',
        en: 'Click any row, or the printer button at its end, to open its receipt and print it.',
      },
      run: async ({ page, ui }) => {
        // the newest row is the refund of the scene before (a "Refund receipt"): the second row is the payment's receipt
        await ui.click(page.locator('.bl-table tbody tr').nth(1).getByRole('button', { name: rx('طباعة الإيصال', 'Print receipt') }))
        await receipt(page).locator('.bl-receipt').waitFor()
        await ui.highlight(receipt(page).locator('.bl-receipt'), 1800)
        await ui.click(receipt(page).locator('.modal-footer').getByRole('button', { name: rx('إغلاق', 'Close') }))
        await receipt(page).locator('.bl-receipt').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'cash-report',
      say: {
        ar: 'وفي نهاية اليوم انقر على «تقرير الصندوق»: يجمع الإيصالات حسب طريقة الدفع مع مجموع كل طريقة والإجمالي العام، ثم انقر على «طباعة».',
        en: 'At the end of the day click Daily cash report: it groups the receipts by payment method with a subtotal per method and a grand total. Then click Print.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.page-header').getByRole('button', { name: rx('تقرير الصندوق', 'Daily cash report') }))
        await dialog(page).locator('.bl-report').waitFor()
        await ui.highlight(dialog(page).locator('.bl-report-summary'), 1500)
        await ui.highlight(dialog(page).locator('.bl-cash'), 1800)
        const print = dialog(page).locator('.modal-footer').getByRole('button', { name: rx('طباعة', 'Print') })
        await ui.moveTo(print)
        await ui.highlight(print, 1000)
        await ui.click(dialog(page).locator('.modal-footer').getByRole('button', { name: rx('إغلاق', 'Close') }))
        await dialog(page).waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'account',
      say: {
        ar: 'في ملف كل مريض تبويب «الحساب» وفيه ثلاث بطاقات: «إجمالي الفواتير» و«المدفوع» و«المتبقي على المريض»، وتحتها قائمة فواتيره وقائمة دفعاته.',
        en: 'Every patient file has an Account tab with three cards: Invoiced, Paid and Balance due, and below them the patient’s invoices and payments.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.click(page.locator('.bl-table tbody tr', { hasText: PATIENT[lang] }).first().locator('.bl-link'))
        await page.locator('.pt-tabs').waitFor()
        await ui.click(page.locator('.pt-tabs').getByRole('tab', { name: /^(الحساب|Account)/ }))
        await page.locator('.bl-tab .bl-tab-actions').waitFor()
        await toTop(page, ui, page.locator('.pt-tabs'))
        await ui.highlight(page.locator('.bl-tab .bl-stats'), 2200)
      },
    },
    {
      id: 'statement',
      say: {
        ar: 'ومن هنا تبدأ «فاتورة جديدة» أو «دفعة جديدة». وانقر على «كشف حساب» لترى الفواتير والدفعات بترتيب التاريخ مع الرصيد بعد كل حركة، ثم على «طباعة».',
        en: 'From here you start a New invoice or a New payment. Click Account statement to see the invoices and payments in date order with the balance after each entry, then Print.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(page.locator('.bl-tab-actions'), 1500)
        await ui.click(page.locator('.bl-tab-actions').getByRole('button', { name: rx('كشف حساب', 'Account statement') }))
        await dialog(page).locator('.bl-statement').waitFor()
        await ui.highlight(dialog(page).locator('.bl-statement table'), 2400)
        const print = dialog(page).locator('.modal-footer').getByRole('button', { name: rx('طباعة', 'Print') })
        await ui.moveTo(print)
        await ui.highlight(print, 1000)
        await ui.click(dialog(page).locator('.modal-footer').getByRole('button', { name: rx('إغلاق', 'Close') }))
        await dialog(page).waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'على ويندوز تُفتح نافذة الطباعة، وعلى أندرويد شاشة الطباعة في النظام. وعلى الهاتف يكون زر «فاتورة جديدة» عائماً أسفل القائمة. هكذا تصدر الفاتورة وتسجّل الدفعة وتتابع الحساب. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'On Windows the print dialog opens; on Android the system print screen. On a phone, New invoice floats at the bottom of the list. That is how you issue an invoice, record a payment, and follow the account. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(page.locator('.bl-tab-actions').getByRole('button', { name: rx('فاتورة جديدة', 'New invoice') }))
        await ui.highlight(page.locator('.bl-tab .card').first(), 2200)
      },
    },
  ],
}

// Chapter 10, "Lab work" (server/videos/index.ts, guide topic server/guide/topics/lab.ts).
// Follows the guide's order: the lab board (the four cards, the status / doctor / lab filters, late orders first,
// the due-date colours), recording an order (patient, doctor, lab name, type of work, shade, material, teeth,
// dates and the quick day buttons, cost, the treatment link, notes), following an order with the next-step
// buttons (Send to lab, Start work, Receive, Mark fitted) and the ⋯ menu, printing the lab slip, and the Lab tab
// of the patient file.
// Demo (11 Oct 2026): #36 Dima Mardini has a draft (crown 46), #55 Anas Mazen Deeb a sent crown, #7 Issam Mardini
// aligners in progress due today, #20 Samer Maher Najjar a veneer remake (the ⋯ menu and the slip use Anas's crown,
// in progress by then, whose menu offers "Send back"); nothing is overdue, so the card scene uses
// "Due this week" (3). At 1280 px the board is in its compact layout: the step buttons are icon-only, named by title. The new order is e.max veneers on 11 and
// 21 for #11 Wassim Atassi, whose plan holds those two planned veneers; everything is saved for real on a fresh demo.
const rx = (ar, en) => new RegExp(`^(${ar}|${en})$`)
const L = (lang, ar, en) => (lang === 'ar' ? ar : en)
const dialog = page => page.getByRole('dialog')
const sidebar = (page, ar, en) => page.locator('.app-sidebar').getByRole('link', { name: rx(ar, en) })
/** The suggestion lists and row menus of this module (popovers rendered into <body>). */
const popover = page => page.locator('.rx-pop')
const N = {
  wassim: { ar: 'وسيم الأتاسي', en: 'Wassim Atassi' }, dima: { ar: 'ديما مارديني', en: 'Dima Mardini' }, anas: { ar: 'أنس مازن ديب', en: 'Anas Mazen Deeb' },
  issam: { ar: 'عصام مارديني', en: 'Issam Mardini' }, samer: { ar: 'سامر ماهر النجار', en: 'Samer Maher Najjar' },
}
/** The board row of a patient (names are unique among the demo's lab orders). */
const rowOf = (page, lang, who) => page.locator('.lab-table tbody tr', { hasText: N[who][lang] }).first()
/** Scrolls so `locator` sits just under the sticky top bar (scrollIntoView alone slides it under the bar). */
async function toTop(page, ui, locator) {
  await ui.scrollTo(locator, { block: 'start' })
  await page.evaluate(() => window.scrollBy({ top: -((document.querySelector('.app-topbar')?.getBoundingClientRect().height ?? 64) + 12), behavior: 'smooth' }))
  await page.waitForTimeout(500)
}

export const chapter = {
  slug: 'lab',
  // set-up, not shown: the lab board (status All, no filters)
  before: async ({ page }) => {
    await page.evaluate(() => { location.hash = '#/lab' })
    await page.locator('.lab-table tbody tr').first().waitFor()
    await page.waitForTimeout(400)
  },
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل ستتعلم كيف تسجّل كل عمل ترسله إلى المخبر، وتتابعه من الإرسال حتى التركيب، وتطبع أمر العمل، وتعرف المتأخر قبل موعد المريض.',
        en: 'In this chapter you will learn to record every case you send to the lab, follow it from sending to fitting, print the lab slip, and spot late work before the patient’s visit.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(sidebar(page, 'المخبر', 'Lab')); await ui.highlight(sidebar(page, 'المخبر', 'Lab'), 1600) },
    },
    {
      id: 'cards',
      say: {
        ar: 'افتح «المخبر» من القائمة الجانبية. في الأعلى أربع بطاقات: «طلبات مفتوحة»، و«مستحقة هذا الأسبوع»، و«متأخرة عن موعدها»، و«تكاليف المخبر هذا الشهر».',
        en: 'Open Lab in the sidebar. Four cards sit at the top: Open orders, Due this week, Overdue and Lab costs this month.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(page.locator('.lab-stats')); await ui.highlight(page.locator('.lab-stats'), 3000) },
    },
    {
      id: 'due-card',
      say: {
        ar: 'انقر على بطاقة «مستحقة هذا الأسبوع» أو «متأخرة عن موعدها» لعرض تلك الطلبات وحدها، وانقر عليها مرة أخرى لإلغاء التصفية.',
        en: 'Click the Due this week or the Overdue card to show only those orders, and click it again to clear the filter.',
      },
      run: async ({ page, ui }) => {
        const card = page.locator('.lab-stats .stat-label', { hasText: rx('مستحقة هذا الأسبوع', 'Due this week') })
        await ui.click(card)
        await page.locator('.lab-filtered').waitFor()
        await ui.highlight(page.locator('.lab-table'), 1600)
        await ui.click(card)
        await page.locator('.lab-filtered').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'filters',
      say: {
        ar: 'تحتها تصفّي الطلبات بالحالة أو الطبيب أو المخبر، أو تبحث باسم المريض أو المخبر أو رقم السن. تأتي الطلبات المتأخرة أولاً، ثم الأقرب موعداً.',
        en: 'Below them you filter the orders by status, doctor or lab, or search by patient, lab or tooth number. Late orders come first, then the soonest due.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.lab-seg-scroll').getByRole('tab', { name: /^(مرسل|Sent)/ }))
        await ui.highlight(page.locator('.lab-table'), 1200)
        await ui.click(page.locator('.lab-seg-scroll').getByRole('tab', { name: /^(الكل|All)/ }))
        await ui.moveTo(page.locator('.lab-labs .chips'))
        await ui.highlight(page.locator('.lab-labs'), 1400)
      },
    },
    {
      id: 'due-colours',
      say: {
        ar: 'يظهر موعد التسليم بالأحمر حين يتأخر الطلب، وبالبرتقالي حين يحلّ خلال يومين، مع كلمة «اليوم» أو «غداً».',
        en: 'A due date turns red when the order is late, and orange when it falls within two days, with “Today” or “Tomorrow”.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.moveTo(rowOf(page, lang, 'issam').locator('.lab-dates'))
        await ui.highlight(rowOf(page, lang, 'issam').locator('.lab-dates'), 1500)
        await ui.highlight(rowOf(page, lang, 'samer').locator('.lab-dates'), 1500)
      },
    },
    {
      id: 'new',
      say: {
        ar: 'سجّل الطلب يوم ترسل الطبعة إلى المخبر. انقر على «طلب مخبري جديد»، هنا أو في تبويب «المخبر» في ملف المريض.',
        en: 'Record the order on the day the impression goes to the lab. Click New lab order, here or in the Lab tab of the patient’s file.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.page-header').getByRole('button', { name: rx('طلب مخبري جديد', 'New lab order') }))
        await dialog(page).locator('.lab-form').waitFor()
      },
    },
    {
      id: 'patient-lab',
      say: {
        ar: 'اختر «المريض» و«الطبيب»، واكتب «اسم المخبر» أو اختره من المخابر التي تعاملت معها من قبل.',
        en: 'Choose the Patient and Doctor, and type the Lab name or pick one of the labs you used before.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(dialog(page).locator('.lab-form input[role="combobox"]').first(), L(lang, 'وسيم', 'Wassim'), { delay: 120 })
        await ui.click(popover(page).getByRole('option', { name: new RegExp(N.wassim[lang]) }))
        await dialog(page).locator('.rx-picked').waitFor()
        await ui.highlight(dialog(page).getByLabel(rx('الطبيب', 'Doctor')), 900)
        await ui.type(dialog(page).getByLabel(/اسم المخبر|Lab name/), L(lang, 'الشام', 'Al-Sham'), { delay: 110 })
        await ui.click(popover(page).getByRole('option', { name: /مخبر الشام|Al-Sham/ }))
      },
    },
    {
      id: 'work',
      say: {
        ar: 'في قسم «العمل المطلوب» اختر «نوع العمل»، ثم «اللون» من دليل ألوان VITA، و«المادة»، مثل الزيركون أو الإيماكس.',
        en: 'Under Work requested choose the Type of work, then the Shade from the VITA guide, and the Material, such as zirconia or e.max.',
      },
      run: async ({ page, ui, lang }) => {
        const type = dialog(page).getByLabel(rx('نوع العمل', 'Type of work'))
        await ui.moveTo(type)
        await type.selectOption('veneer')
        await ui.highlight(type, 900)
        const shade = dialog(page).getByLabel(/اللون|Shade/)
        await ui.click(shade.locator('xpath=..').locator('.icon-end'))
        await popover(page).waitFor()
        await ui.click(popover(page).getByRole('option', { name: /^A2$/ }))
        await ui.type(dialog(page).getByLabel(rx('المادة', 'Material')), L(lang, 'إيماكس', 'e.max'), { delay: 110 })
        // pick the typed material from its suggestions, so the list is closed before the teeth are clicked
        await ui.click(popover(page).getByRole('option').first())
        await popover(page).waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'teeth',
      say: {
        ar: 'انقر على الأسنان المشمولة بالعمل، أو على «الفك العلوي» أو «الفك السفلي» لتحديد الفك كله. واترك الأسنان دون تحديد للأطقم الكاملة والواقيات.',
        en: 'Click the teeth included in the work, or Upper arch or Lower arch to take the whole arch. Leave the teeth empty for full dentures and night guards.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).locator('button.lab-tooth', { hasText: /^11$/ }))
        await ui.click(dialog(page).locator('button.lab-tooth', { hasText: /^21$/ }))
        await ui.highlight(dialog(page).locator('.lab-teeth-tools'), 1600)
      },
    },
    {
      id: 'dates',
      say: {
        ar: 'في قسم «المواعيد والتكلفة» يكون «تاريخ الإرسال» اليوم و«موعد التسليم» بعد 7 أيام. غيّره، أو انقر على أحد أزرار الأيام، مثل «+10 أيام».',
        en: 'Under Dates & cost, Sent on is today and the Due date is 7 days later. Change it, or click one of the day buttons, such as +10 days.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(dialog(page).locator('.lab-quick-days'))
        await ui.highlight(dialog(page).getByLabel(rx('تاريخ الإرسال', 'Sent on')), 1200)
        await ui.click(dialog(page).locator('.lab-quick-days button', { hasText: '+10' }))
        await ui.highlight(dialog(page).locator('.lab-quick-days'), 1200)
      },
    },
    {
      id: 'cost-link',
      say: {
        ar: 'اكتب «تكلفة المخبر»، واربط الطلب إن شئت بعمل من خطة العلاج، وأضف «ملاحظات» للمخبر، ثم انقر على «حفظ الطلب». يحصل كل طلب على رقم مرجعي متسلسل.',
        en: 'Type the Lab cost, link the order to a planned treatment if you wish, add Notes for the lab, then click Save order. Each order gets a running reference number.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(dialog(page).getByLabel(rx('تكلفة المخبر', 'Lab cost')), '220', { delay: 120 })
        const link = dialog(page).getByLabel(/ربط بعمل من خطة العلاج|Link to a treatment plan item/)
        await ui.moveTo(link)
        const value = await link.evaluate(el => [...el.options].find(o => /فينير|Veneer/.test(o.text) && /11/.test(o.text))?.value ?? '')
        if (value) await link.selectOption(value)
        await ui.highlight(link, 900)
        await ui.type(dialog(page).getByLabel(rx('ملاحظات', 'Notes')), L(lang, 'الحواف تحت اللثة قليلاً، الصور مرفقة', 'Margins slightly subgingival, photos attached'), { delay: 45 })
        await ui.click(dialog(page).getByRole('button', { name: rx('حفظ الطلب', 'Save order') }))
        await dialog(page).waitFor({ state: 'hidden' })
        await rowOf(page, lang, 'wassim').waitFor()
        await ui.scrollTo(rowOf(page, lang, 'wassim'))
        await ui.highlight(rowOf(page, lang, 'wassim'), 1800)
      },
    },
    {
      id: 'stages',
      say: {
        ar: 'يمر الطلب بالمراحل: «مسودة» ثم «مرسل» ثم «قيد العمل» ثم «مستلم» ثم «مركّب»، وقد يصبح «إعادة عمل» أو «ملغى». وفي كل سطر زر يحمل اسم الخطوة التالية.',
        en: 'An order moves through Draft, Sent, In progress, Received and Fitted, and may become Remake or Cancelled. Each row has a button named after the next step.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.highlight(page.locator('.lab-seg-scroll'), 1800)
        await toTop(page, ui, page.locator('.lab-board'))
        await ui.moveTo(rowOf(page, lang, 'dima').locator('.lab-advance'))
        await ui.highlight(rowOf(page, lang, 'dima').locator('.lab-actions'), 1600)
      },
    },
    {
      id: 'send',
      say: {
        ar: 'حين ترسل المسودة انقر على «إرسال للمخبر»: إن كان تاريخ الإرسال فارغاً يُسجَّل اليوم، وإن كان موعد التسليم فارغاً يُحدَّد بعد 7 أيام.',
        en: 'When a draft goes out, click Send to lab: if its sent date is empty, today is recorded, and an empty due date is set 7 days later.',
      },
      run: async ({ page, ui, lang }) => {
        const row = rowOf(page, lang, 'dima')
        await ui.scrollTo(row)
        await ui.click(row.getByRole('button', { name: rx('إرسال للمخبر', 'Send to lab') }))
        await row.locator('.lab-status', { hasText: rx('مرسل', 'Sent') }).waitFor()
        await ui.highlight(row.locator('.lab-status'), 1400)
      },
    },
    {
      id: 'start-work',
      say: { ar: 'وحين يبدأ المخبر العمل انقر على «بدء العمل».', en: 'When the lab starts the work, click Start work.' },
      run: async ({ page, ui, lang }) => {
        const row = rowOf(page, lang, 'anas')
        await ui.scrollTo(row)
        await ui.click(row.getByRole('button', { name: rx('بدء العمل', 'Start work') }))
        await row.locator('.lab-status', { hasText: rx('قيد العمل', 'In progress') }).waitFor()
        await ui.highlight(row.locator('.lab-status'), 1200)
      },
    },
    {
      id: 'receive',
      say: {
        ar: 'عند وصول العمل إلى العيادة انقر على «استلام». يُسجَّل تاريخ الاستلام، وتدخل التكلفة في المصروفات تلقائياً من فئة «مخبر»، فلا تكتب فاتورة المخبر مرتين.',
        en: 'When the work arrives at the clinic, click Receive. The received date is recorded and the cost goes to your expenses automatically, under the Lab category, so you never type a lab bill twice.',
      },
      run: async ({ page, ui, lang }) => {
        const row = rowOf(page, lang, 'issam')
        await ui.scrollTo(row)
        await ui.click(row.getByRole('button', { name: rx('استلام', 'Receive') }))
        await row.locator('.lab-status', { hasText: rx('مستلم', 'Received') }).waitFor()
        await ui.highlight(row.locator('.lab-status'), 1300)
        await ui.highlight(page.locator('.lab-stats .stat-card').last(), 1600)
      },
    },
    {
      id: 'fitted',
      say: { ar: 'وبعد تركيبه للمريض انقر على «تم التركيب».', en: 'Once it is fitted for the patient, click Mark fitted.' },
      run: async ({ page, ui, lang }) => {
        const row = rowOf(page, lang, 'issam')
        await ui.scrollTo(row)
        await ui.click(row.getByRole('button', { name: rx('تم التركيب', 'Mark fitted') }))
        await row.locator('.lab-status', { hasText: rx('مركّب', 'Fitted') }).waitFor()
        await ui.highlight(row.locator('.lab-status'), 1300)
      },
    },
    {
      id: 'row-menu',
      say: {
        ar: 'إذا احتاج العمل إلى تعديل افتح قائمة النقاط الثلاث واختر «إعادة للمخبر (إعادة عمل)»: إن كان موعد التسليم قد حلّ يُحدَّد موعد جديد، ويعود زر «استلام» إلى السطر. وفي القائمة أيضاً «طباعة أمر العمل» و«تعديل» و«إلغاء الطلب» و«حذف».',
        en: 'If the work needs correcting, open the three-dot menu and choose Send back (remake): if the due date has come, a new one is set, and the Receive button comes back on the row. The menu also has Print lab slip, Edit, Cancel order and Delete.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.scrollTo(rowOf(page, lang, 'anas'))
        await ui.click(rowOf(page, lang, 'anas').getByRole('button', { name: rx('المزيد', 'More') }))
        await page.locator('.lab-menu [role="menu"]').waitFor()
        await ui.highlight(page.locator('.lab-menu'), 2400)
      },
    },
    {
      id: 'slip',
      say: {
        ar: 'أرسل مع الطبعة ورقة أمر عمل واضحة: اختر «طباعة أمر العمل». فيها المخبر وموعد التسليم المطلوب، ونوع العمل واللون والمادة، ورسم الأسنان المحددة، وملاحظاتك للمخبر.',
        en: 'Send a clear lab slip with the impression: choose Print lab slip. It shows the lab and the required date, the type of work, shade and material, a drawing of the chosen teeth, and your notes for the lab.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.lab-menu').getByRole('menuitem', { name: rx('طباعة أمر العمل', 'Print lab slip') }))
        await page.locator('.lab-slip').waitFor()
        await ui.highlight(page.locator('.lab-slip-to'), 1500)
        await ui.highlight(page.locator('.lab-slip-facts'), 1500)
        await ui.scrollTo(page.locator('.lab-slip-teeth'))
        await ui.highlight(page.locator('.lab-slip-teeth'), 1600)
      },
    },
    {
      id: 'slip-print',
      say: {
        ar: 'لا يُطبع من بيانات المريض إلا اسمه، ولا تُطبع التكلفة. انقر على «طباعة»، ثم وقّع الورقة في مكان توقيع الطبيب، وفي أسفلها سطر ليوقّع المخبر بالاستلام.',
        en: 'Of the patient’s details only the name is printed, and the cost is not printed. Click Print, then sign where the doctor’s signature goes; at the bottom is a line for the lab to sign on receipt.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.lab-slip-sign'))
        await ui.highlight(page.locator('.lab-slip-sign'), 1600)
        const print = page.locator('.lab-slip-modal .modal-footer').getByRole('button', { name: rx('طباعة', 'Print') })
        await ui.moveTo(print)
        await ui.highlight(print, 1200)
        await ui.click(page.locator('.lab-slip-modal .modal-footer').getByRole('button', { name: rx('إغلاق', 'Close') }))
        await page.locator('.lab-slip').waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'patient-tab',
      say: {
        ar: 'يعرض تبويب «المخبر» في ملف المريض طلباته وحده، بحالتها وموعد تسليمها. ومنه تنقر على «طلب مخبري جديد» والمريض محدد سلفاً، أو على زر الخطوة التالية.',
        en: 'The Lab tab of the patient’s file shows that patient’s orders only, with their status and due date. From it you click New lab order with the patient already set, or the next-step button.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.click(rowOf(page, lang, 'samer').locator('.lab-patient-link'))
        await page.locator('.lab-ptab .lab-pitem').first().waitFor()
        await toTop(page, ui, page.locator('.pt-tabs'))
        await ui.highlight(page.locator('.lab-ptab .lab-pitem').first(), 2000)
        const add = page.locator('.lab-ptab').getByRole('button', { name: rx('طلب مخبري جديد', 'New lab order') })
        await ui.moveTo(add)
        await ui.highlight(add, 1200)
        await ui.highlight(page.locator('.lab-ptab .lab-pitem').first().locator('.lab-advance'), 1200)
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'الطلبات المرسلة أو قيد العمل التي تأخرت أو تستحق اليوم تظهر أيضاً في التنبيهات وفي الشاشة الرئيسية. وعلى الهاتف تجد «المخبر» تحت «المزيد». هكذا تسجّل الطلب وتتابعه حتى التركيب. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'Sent or in-progress orders that are late or due today also show in Notifications and on the Dashboard. On a phone, Lab is under More. That is how you record an order and follow it to fitting. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(sidebar(page, 'المخبر', 'Lab'))
        await page.locator('.lab-table tbody tr').first().waitFor()
        await ui.moveTo(page.locator('.lab-stats'))
        await ui.highlight(page.locator('.lab-stats'), 2200)
      },
    },
  ],
}

// Chapter 12 "Expenses": the Expenses page, recording an expense, the period bar and comparison, the breakdown by
// category and the search, editing, automatic (lab) expenses and export, the phone. Written from
// server/guide/topics/expenses.ts, in its order. Runs on the demo clinic (October 2026, 10 expenses, 5 of them from
// lab orders), signed in as the admin, from the dashboard; the one record it saves is an electricity bill.

const nav = (page, to) => page.locator(`.app-sidebar .nav-item[href$="${to}"]`)
const home = page => page.locator('.app-sidebar .nav-item').first()
const pick = (lang, ar, en) => (lang === 'ar' ? ar : en)
const btn = (scope, ar, en) => scope.getByRole('button', { name: new RegExp(`^(${ar}|${en})$`) })
const modal = page => page.locator('.modal')
const period = page => page.locator('.inv-exp-period')

async function dashboardShown(page) {
  await page.locator('[data-testid="dashboard"]').waitFor({ timeout: 30000 })
  await page.locator('[data-testid="dash-schedule"] [data-testid="dash-apt"]').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(600)
}
async function expensesShown(page) {
  await page.locator('.inv-exp-stats .stat-card .stat-value').first().waitFor({ timeout: 15000 })
  await page.locator('table tbody tr').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
}
/** The native <select>: a click opens its list, ArrowDown moves down it, Enter picks (the list itself is not filmed). */
async function pickOption(page, ui, select, steps) {
  await ui.click(select)
  await ui.pause(350)
  for (let i = 0; i < steps; i++) { await page.keyboard.press('ArrowDown'); await ui.pause(140) }
  await page.keyboard.press('Enter')
  await ui.pause(500)
}

export const chapter = {
  slug: 'expenses',
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل تسجّل مصروفات عيادتك بتصنيفاتها في دنتورا، وتعرف أين يذهب المال شهراً بشهر. افتح «المصروفات» من القائمة الجانبية، في قسم «المالية».',
        en: 'In this chapter you record your clinic’s expenses by category in Dentora, and see where the money goes month by month. Open Expenses from the sidebar, in the Finance section.',
      },
      run: async ({ page, ui }) => {
        await dashboardShown(page)
        await ui.pause(2500)
        await ui.click(nav(page, '/expenses'))
        await expensesShown(page)
      },
    },
    {
      id: 'period-bar',
      say: {
        ar: 'تُفتح الصفحة على الشهر الحالي. في الأعلى شريط الفترة: اسم الشهر في وسطه، وعلى جانبيه سهما «الشهر السابق» و«الشهر التالي»، وفي طرفه عدد أيام الفترة.',
        en: 'The page opens on the current month. At the top is the period bar: the month’s name in the middle, the Previous month and Next month arrows on each side, and the number of days at the end.',
      },
      run: async ({ page, ui }) => {
        await ui.point(period(page), 1300)
        await ui.moveTo(period(page).getByRole('button', { name: /الشهر السابق|Previous month/ }))
        await ui.moveTo(period(page).locator('.inv-exp-month'))
        await ui.moveTo(period(page).getByRole('button', { name: /الشهر التالي|Next month/ }))
        await ui.moveTo(period(page).locator('.inv-exp-period-info'))
        await ui.pause(400)
      },
    },
    {
      id: 'cards',
      say: {
        ar: 'ثم أربع بطاقات: «إجمالي الفترة» ونسبة التغيّر «عن الفترة السابقة»، و«أعلى فئة» بمبلغها وحصتها، و«عدد المصروفات» مع «متوسط المصروف»، و«الفترة السابقة» بمبلغها.',
        en: 'Then four cards: Period total with its change vs previous period, Top category with its amount and share, Expenses with the Average expense, and the Previous period total.',
      },
      run: async ({ page, ui }) => {
        await ui.point(page.locator('.inv-exp-stats'), 1200)
        for (let i = 0; i < 4; i++) await ui.moveTo(page.locator('.inv-exp-stats .stat-card').nth(i), { ms: 380 })
        await ui.pause(400)
      },
    },
    {
      id: 'layout',
      say: {
        ar: 'تحتها «التوزيع حسب الفئة»، ثم «سجل المصروفات»: لكل مصروف تاريخه وفئته ووصفه والجهة والمبلغ ومن سجّله. والمصروفات لمدير العيادة وحده.',
        en: 'Below them is Breakdown by category, then the Expense log: each expense shows its date, category, description, vendor, amount and who recorded it. Expenses are for the clinic admin only.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.inv-exp-breakdown'))
        await ui.point(page.locator('.inv-exp-breakdown'), 1200)
        await ui.scrollTo(page.locator('.inv-exp-list-head'))
        await ui.point(page.locator('table thead'), 1300)
      },
    },
    {
      id: 'new-open',
      say: {
        ar: 'لتسجيل مصروف انقر على «مصروف جديد» أعلى الصفحة.',
        en: 'To record an expense, click New expense at the top of the page.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.page-header'))
        await ui.click(btn(page, 'مصروف جديد', 'New expense'))
        await modal(page).waitFor({ timeout: 10000 })
        await ui.pause(500)
      },
    },
    {
      id: 'new-category',
      say: {
        ar: 'اختر «الفئة»: إيجار، أو رواتب، أو مواد، أو مخبر، أو معدات، أو كهرباء وماء وإنترنت، أو غيرها.',
        en: 'Choose the Category: Rent, Salaries, Materials, Lab, Equipment, Utilities or another.',
      },
      run: async ({ page, ui }) => {
        // the categories in order: rent, salaries, materials, lab, equipment, utilities (the sixth)
        await pickOption(page, ui, modal(page).getByLabel(/^(الفئة|Category)/), 6)
      },
    },
    {
      id: 'new-amount',
      say: {
        ar: 'اكتب «المبلغ»، وتأكد من «التاريخ»: يضع البرنامج تاريخ اليوم تلقائياً. ثم اكتب «الوصف»، مثل: فاتورة كهرباء شهر تشرين الأول.',
        en: 'Type the Amount and check the Date: Dentora fills in today by default. Then write a Description, for example: October electricity bill.',
      },
      run: async ({ page, ui, lang }) => {
        const m = modal(page)
        await ui.type(m.getByLabel(/^(المبلغ|Amount)/), '48', { delay: 90 })
        await ui.point(m.getByLabel(/^(التاريخ|Date)/), 1000)
        await ui.type(m.getByLabel(/^(الوصف|Description)/), pick(lang, 'فاتورة كهرباء شهر تشرين الأول', 'October electricity bill'), { delay: 55 })
      },
    },
    {
      id: 'new-save',
      say: {
        ar: 'أضف «الجهة المستفيدة» إن شئت، واختر «طريقة الدفع»، وهي نقداً ما لم تغيّرها، ثم انقر على «تسجيل المصروف». ويقترح البرنامج الجهات التي كتبتها من قبل.',
        en: 'Add the Vendor if you like, choose the Payment method, Cash unless you change it, then click Save expense. Dentora suggests the vendors you typed before.',
      },
      run: async ({ page, ui, lang }) => {
        const m = modal(page)
        await ui.type(m.getByLabel(/الجهة المستفيدة|^Vendor/), pick(lang, 'مؤسسة الكهرباء', 'Electricity company'), { delay: 60 })
        await ui.point(m.getByLabel(/طريقة الدفع|Payment method/), 1000)
        await ui.click(btn(page.locator('.modal-footer'), 'تسجيل المصروف', 'Save expense'))
        await modal(page).waitFor({ state: 'hidden', timeout: 10000 })
        await ui.pause(900)
      },
    },
    {
      id: 'log-after',
      say: {
        ar: 'ظهر المصروف في أعلى السجل، ومعه اسم من سجّله في عمود «سجّله»، وتحدّث إجمالي الفترة والتوزيع.',
        en: 'The expense now tops the log, with the name of whoever recorded it in the Recorded by column, and the period total and breakdown have been updated.',
      },
      run: async ({ page, ui }) => {
        await expensesShown(page)
        await ui.scrollTo(page.locator('.inv-exp-list-head'))
        await ui.point(page.locator('table tbody tr').first(), 1600)
        await ui.point(page.locator('.inv-exp-count'), 900)
      },
    },
    {
      id: 'months',
      say: {
        ar: 'انقر على السهمين للتنقّل بين الأشهر، فتقارن البطاقات كل شهر بالشهر الذي قبله. وللعودة انقر على «هذا الشهر».',
        en: 'Click the arrows to move between months; the cards compare each month with the one before it. To come back, click This month.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.page-header'))
        await ui.click(period(page).getByRole('button', { name: /الشهر السابق|Previous month/ }))
        await ui.pause(1800)
        await ui.click(btn(period(page), 'هذا الشهر', 'This month'))
        await ui.pause(500)
      },
    },
    {
      id: 'custom',
      say: {
        ar: 'ولفترة أخرى انقر على «فترة مخصصة» واختر تاريخ البداية والنهاية؛ تُفتح أول مرة على آخر 30 يوماً. وللعودة إلى الأشهر انقر على «شهري».',
        en: 'For another stretch of time click Custom range and choose the start and end dates; it starts on the last 30 days. To go back to months, click Monthly.',
      },
      run: async ({ page, ui }) => {
        await ui.click(period(page).getByRole('tab', { name: /فترة مخصصة|Custom range/ }))
        await period(page).locator('.inv-exp-range').waitFor({ timeout: 10000 })
        await ui.point(period(page).locator('.inv-exp-range'), 1600)
        await ui.click(period(page).getByRole('tab', { name: /^(شهري|Monthly)$/ }))
        await ui.pause(400)
      },
    },
    {
      id: 'breakdown',
      say: {
        ar: 'بطاقة «التوزيع حسب الفئة» تبدأ بشريط ملوّن يقسم إجمالي الفترة بين الفئات، ثم سطر لكل فئة بعدد عملياتها ومبلغها وحصتها، من الأكبر إلى الأصغر.',
        en: 'Breakdown by category starts with a coloured strip that splits the period total between the categories, then one line per category with its entries, amount and share, largest first.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.inv-exp-breakdown'))
        await ui.point(page.locator('.inv-exp-stack'), 1200)
        await ui.point(page.locator('.inv-exp-bars'), 1500)
      },
    },
    {
      id: 'breakdown-filter',
      say: {
        ar: 'انقر على سطر فئة لتعرض مصروفاتها وحدها، فيصبح «الإجمالي» تحت السجل «إجمالي النتائج»: هكذا تعرف كم صرفت على المخبر هذا الشهر. انقر عليه ثانيةً لتعرض الكل.',
        en: 'Click a category line to show only its expenses, and the Total under the log becomes Total of results: that is how you know what went to the lab this month. Click it again to show everything.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.inv-exp-bar').first())
        await ui.pause(600)
        await ui.scrollTo(page.locator('.inv-exp-tfoot'))
        await ui.point(page.locator('.inv-exp-tfoot'), 1500)
        await ui.pause(1500)
        await ui.click(page.locator('.inv-exp-bar').first())
        await ui.pause(400)
      },
    },
    {
      id: 'search',
      say: {
        ar: 'اكتب في مربع البحث فوق السجل كلمة من الوصف أو من اسم الجهة، أو اختر فئة من قائمة «كل الفئات» بجانبه.',
        en: 'Type a word from the description or the vendor in the search box above the log, or choose a category from the All categories list next to it.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.scrollTo(page.locator('.inv-exp-list-head'))
        await ui.type(page.locator('.inv-exp-search input'), pick(lang, 'كهرباء', 'electric'), { delay: 90 })
        await ui.pause(1300)
        await ui.click(page.locator('.inv-exp-search .icon-end.clickable'))
        await ui.point(page.locator('.inv-exp-catsel'), 1100)
      },
    },
    {
      id: 'edit-open',
      say: {
        ar: 'انقر على سطر المصروف أو على زر القلم لتفتح «تعديل المصروف». هذا مصروف سجّله البرنامج وحده عند استلام طلب مخبر، وعليه علامة «من طلب مخبر».',
        en: 'Click an expense’s row or its pencil button to open Edit expense. This one was recorded by Dentora itself when a lab order was received, and is marked From a lab order.',
      },
      run: async ({ page, ui }) => {
        const labRow = page.locator('table tbody tr').filter({ has: page.locator('.inv-exp-lab') }).first()
        await ui.point(labRow.locator('.inv-exp-lab'), 1000)
        await ui.click(labRow.locator('.inv-exp-desc'))
        await modal(page).waitFor({ timeout: 10000 })
        await ui.pause(300)
        await ui.point(modal(page).locator('.alert'), 1500)
      },
    },
    {
      id: 'edit-close',
      say: {
        ar: 'تعدّل تكلفته من صفحة المخبر ليبقى الطلب ومصروفه متطابقين. ولأي مصروف آخر غيّر ما تريد ثم انقر على «حفظ التغييرات». أما الحذف بزر سلة المهملات فنهائي.',
        en: 'Change its cost on the Lab page, so the order and its expense stay the same. For any other expense, change what you need and click Save changes. Deleting with the bin button is permanent.',
      },
      run: async ({ page, ui }) => {
        await ui.point(btn(page.locator('.modal-footer'), 'حفظ التغييرات', 'Save changes'), 1100)
        await ui.click(btn(page.locator('.modal-footer'), 'إلغاء', 'Cancel'))
        await modal(page).waitFor({ state: 'hidden', timeout: 10000 })
        await ui.point(page.locator('table tbody tr').first().locator('.inv-exp-del'), 1200)
      },
    },
    {
      id: 'auto-export',
      say: {
        ar: 'وحين تسجّل شراءً للمخزون ومفتاح المصروفات مفعّل يُسجَّل إجمالي الشراء في فئة «مواد». و«تصدير CSV» يحفظ السجل كما تراه، بالفترة والبحث والفئة، في ملف يفتحه Excel.',
        en: 'When you record a stock purchase with the expense switch on, its total is recorded under Materials. Export CSV saves the log as you see it, with its period, search and category, as a file Excel opens.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.page-header'))
        await ui.point(btn(page, 'تصدير CSV', 'Export CSV'), 1700)
      },
    },
    {
      id: 'phone',
      say: {
        ar: 'على الهاتف يُجمع السجل حسب اليوم: «اليوم» و«أمس» ثم التواريخ، مع مجموع كل يوم، وزر التصدير أيقونة سهم التنزيل.',
        en: 'On a phone the log is grouped by day: Today and Yesterday, then dates, each with its total, and the export button is the download-arrow icon.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.moveTo(page.locator('.inv-exp-stats .stat-card').first())
        await ui.callout(pick(lang, 'على الهاتف: السجل مجموع حسب اليوم', 'On a phone: the log grouped by day'), { ms: 2200 })
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تسجّل المصروفات وتراجعها شهراً بشهر لتعرف أين تذهب الأموال. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you record expenses and review them month by month to know where the money goes. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(home(page))
        await dashboardShown(page)
      },
    },
  ],
}

// Chapter 13 "Reports": the Reports page and its five tabs, the period and the doctor, the Financial tab (cards,
// charts, table view, expenses vs revenue), Patients, Appointments (doctor performance), Treatments, Outstanding
// (balances and the WhatsApp reminder), print and export, the phone. Written from server/guide/topics/reports.ts, in
// its order. Runs on the demo clinic with the reports on Last month (September 2026, the recorder's init script), as
// the admin, from the dashboard. Nothing is saved; Print and Remind are shown, not clicked (they open the system's
// print dialog and WhatsApp).

const nav = (page, to) => page.locator(`.app-sidebar .nav-item[href$="${to}"]`)
const home = page => page.locator('.app-sidebar .nav-item').first()
const pick = (lang, ar, en) => (lang === 'ar' ? ar : en)
const btn = (scope, ar, en) => scope.getByRole('button', { name: new RegExp(`^(${ar}|${en})$`) })
const tab = (page, ar, en) => page.locator('.rp-tabs').getByRole('tab', { name: new RegExp(`^(${ar}|${en})$`) })
const preset = (page, ar, en) => page.locator('[data-testid="rp-periodbar"]').getByRole('tab', { name: new RegExp(`^(${ar}|${en})$`) })
const tid = (page, id) => page.locator(`[data-testid="${id}"]`)

async function dashboardShown(page) {
  await page.locator('[data-testid="dashboard"]').waitFor({ timeout: 30000 })
  await page.locator('[data-testid="dash-schedule"] [data-testid="dash-apt"]').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(600)
}
/** Waits for a tab's section and its first card value, then the 1.6 s the charts take to draw after the data. */
async function tabShown(page, section) {
  await tid(page, section).waitFor({ timeout: 20000 })
  await tid(page, section).locator('.rp-kpi-value').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(1600)
}
/** The native doctor <select>: a click opens its list, the arrow keys move in it, Enter picks (the list is not filmed). */
async function pickDoctor(page, ui, key, steps) {
  await ui.click(tid(page, 'rp-doctor'))
  await ui.pause(350)
  for (let i = 0; i < steps; i++) { await page.keyboard.press(key); await ui.pause(140) }
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1600)
}

export const chapter = {
  slug: 'reports',
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل تقرأ أرقام عيادتك في دنتورا: الإيرادات والمصروفات وصافي الربح، والمرضى والمواعيد والعلاجات، والذمم المستحقة. افتح «التقارير» من القائمة الجانبية، في قسم «المالية».',
        en: 'In this chapter you read your clinic in figures in Dentora: revenue, expenses and net profit, patients, appointments, treatments and outstanding balances. Open Reports from the sidebar, in the Finance section.',
      },
      run: async ({ page, ui }) => {
        await dashboardShown(page)
        await ui.pause(2500)
        await ui.click(nav(page, '/reports'))
        await tid(page, 'rp-periodbar').waitFor({ timeout: 20000 })
        await tabShown(page, 'rp-financial')
      },
    },
    {
      id: 'tabs',
      say: {
        ar: 'في الصفحة خمسة تبويبات: «المالية» و«المرضى» و«المواعيد» و«العلاجات» و«الذمم المستحقة». والتقارير للمدير والأطباء.',
        en: 'The page has five tabs: Financial, Patients, Appointments, Treatments and Outstanding. Reports are for the admin and the doctors.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(page.locator('.rp-tabs'), 1200)
        const tabs = page.locator('.rp-tabs .tab')
        for (let i = 0; i < 5; i++) await ui.moveTo(tabs.nth(i), { ms: 320 })
        await ui.pause(300)
      },
    },
    {
      id: 'period-bar',
      say: {
        ar: 'فوق التبويبات شريط الفترة وقائمة «جميع الأطباء»، وفي أعلى الصفحة زرّا «طباعة» و«تصدير CSV». وتحت العنوان تظهر الفترة المختارة دائماً.',
        en: 'Above the tabs are the period bar and the All doctors list, and at the top of the page the Print and Export CSV buttons. The chosen period always shows under the title.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(tid(page, 'rp-periodbar'), 1200)
        await ui.moveTo(tid(page, 'rp-doctor'))
        await ui.highlight(page.locator('.page-actions'), 1100)
        await ui.highlight(tid(page, 'rp-range'), 1100)
      },
    },
    {
      id: 'presets',
      say: {
        ar: 'اختر الفترة: «هذا الشهر» أو «الشهر الماضي» أو «آخر 3 أشهر» أو «هذه السنة»، أو «فترة مخصصة» بتاريخي بداية ونهاية. ويتذكر البرنامج آخر فترة اخترتها على هذا الجهاز.',
        en: 'Choose the period: This month, Last month, Last 3 months or This year, or Custom with a start and an end date. Dentora remembers the last period you chose on this device.',
      },
      run: async ({ page, ui }) => {
        await ui.click(preset(page, 'آخر 3 أشهر', 'Last 3 months'))
        await page.waitForTimeout(1600)
        await ui.click(preset(page, 'فترة مخصصة', 'Custom'))
        await page.locator('.rp-range').waitFor({ timeout: 10000 })
        await ui.highlight(page.locator('.rp-range'), 1300)
        await ui.click(preset(page, 'الشهر الماضي', 'Last month'))
        await page.waitForTimeout(1600)
      },
    },
    {
      id: 'doctor',
      say: {
        ar: 'لترى عمل طبيب واحد اختره من قائمة «جميع الأطباء». مع اختيار طبيب يخفي تبويب «المالية» المصروفات وصافي الربح، ويعرض «قيمة الفواتير الصادرة» و«عدد الفواتير».',
        en: 'To see one doctor’s work, pick the doctor from the All doctors list. With a doctor picked, the Financial tab hides expenses and net profit and shows Invoiced and Invoices issued instead.',
      },
      run: async ({ page, ui }) => {
        await pickDoctor(page, ui, 'ArrowDown', 1)
        await ui.highlight(tid(page, 'rp-range'), 1000)
        await ui.highlight(page.locator('.rp-kpis'), 1500)
      },
    },
    {
      id: 'kpis',
      say: {
        ar: 'مع «جميع الأطباء» تعرض «المالية» أربع بطاقات: «الإيرادات» و«المصروفات» و«صافي الربح» مع هامشه، و«متوسط الفاتورة». والإيرادات هي المال الذي قبضته العيادة فعلاً، لا قيمة الفواتير.',
        en: 'With All doctors, Financial shows four cards: Revenue, Expenses, Net profit with its margin, and Average invoice. Revenue is the money the clinic actually collected, not the value of the invoices.',
      },
      run: async ({ page, ui }) => {
        await pickDoctor(page, ui, 'ArrowUp', 1)
        await ui.highlight(page.locator('.rp-kpis'), 1100)
        const cards = page.locator('.rp-kpis .rp-kpi')
        for (let i = 0; i < 4; i++) await ui.moveTo(cards.nth(i), { ms: 360 })
        await ui.pause(300)
      },
    },
    {
      id: 'delta',
      say: {
        ar: 'تحت معظم الأرقام نسبة تغيّرها «عن الفترة السابقة». وإن كانت الفترة ما زالت جارية يقارن البرنامج الأيام التي مضت بالأيام نفسها من الفترة السابقة.',
        en: 'Under most figures is their change vs previous period. While the period is still running, Dentora compares the days gone so far with the same days of the period before.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(tid(page, 'kpi-revenue').locator('.rp-kpi-foot'))
        await ui.highlight(tid(page, 'kpi-revenue').locator('.rp-kpi-foot'), 1800)
      },
    },
    {
      id: 'charts',
      say: {
        ar: 'ثم الرسوم: «الإيرادات اليومية»، و«طرق الدفع» في دائرة تقسم المحصّل، و«الإيرادات حسب الطبيب»، و«الإيرادات حسب فئة العلاج». مرّر المؤشر فوق نقطة في الرسم لترى قيمتها.',
        en: 'Then the charts: Daily revenue, Payment methods as a ring splitting the money collected, Revenue by doctor and Revenue by treatment category. Hover over a point on a chart to see its value.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(tid(page, 'chart-revenue'), { block: 'start' })
        await ui.highlight(tid(page, 'chart-revenue'), 1000)
        await ui.moveTo(tid(page, 'chart-revenue').locator('svg').first())
        await ui.pause(900)
        await ui.highlight(tid(page, 'chart-methods'), 900)
        await ui.scrollTo(tid(page, 'chart-doctors'))
        await ui.highlight(tid(page, 'chart-doctors'), 800)
        await ui.highlight(tid(page, 'chart-categories'), 800)
      },
    },
    {
      id: 'table-toggle',
      say: {
        ar: 'في زاوية كل رسم زر «عرض كجدول» يعرض الأرقام الدقيقة خلف الرسم، وبنقرة ثانية تعود إلى الرسم.',
        en: 'Each chart has a Show as table button in its corner that shows the exact figures behind the chart; a second click brings the chart back.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(tid(page, 'chart-revenue'), { block: 'start' })
        const toggle = tid(page, 'chart-revenue').locator('.card-header button')
        await ui.click(toggle)
        await ui.pause(1800)
        await ui.click(toggle)
        await ui.pause(400)
      },
    },
    {
      id: 'expenses-table',
      say: {
        ar: 'وفي الأسفل جدول «المصروفات مقابل الإيرادات»: كل فئة بمبلغها وحصتها من المصروفات ومن الإيرادات، ثم «إجمالي المصروفات» و«الإيرادات» و«صافي الربح».',
        en: 'At the bottom, the Expenses vs revenue table lists every category with its amount and share of expenses and of revenue, then Total expenses, Revenue and Net profit.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(tid(page, 'table-expenses'), { block: 'start' })
        await ui.highlight(tid(page, 'table-expenses'), 1500)
        await ui.highlight(tid(page, 'table-expenses').locator('.rp-table-total').last(), 1100)
      },
    },
    {
      id: 'patients-tab',
      say: {
        ar: 'تبويب «المرضى»: «المرضى الجدد» و«مرضى راجعوا العيادة» و«إجمالي الملفات النشطة» و«متوسط العمر»، ثم «توزيع الجنس» و«الفئات العمرية» و«أبرز مصادر الإحالة» و«المرضى الأعلى إنفاقاً».',
        en: 'The Patients tab: New patients, Patients seen, Active patient files and Average age, then Gender, Age groups, Top referral sources and Highest-spending patients.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.rp-tabs'), { block: 'start' })
        await ui.click(tab(page, 'المرضى', 'Patients'))
        await tabShown(page, 'rp-patients')
        await ui.highlight(page.locator('.rp-kpis'), 1200)
        await ui.scrollTo(tid(page, 'table-spenders'), { block: 'start' })
        await ui.highlight(tid(page, 'table-spenders'), 1200)
      },
    },
    {
      id: 'appointments-tab',
      say: {
        ar: 'تبويب «المواعيد»: «إجمالي المواعيد» و«المواعيد المكتملة» و«المواعيد الملغاة» و«نسبة عدم الحضور»، ثم المواعيد يوماً بيوم، و«المواعيد حسب الحالة».',
        en: 'The Appointments tab: Appointments, Completed, Cancelled and the No-show rate, then the appointments day by day and Appointments by status.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.rp-tabs'), { block: 'start' })
        await ui.click(tab(page, 'المواعيد', 'Appointments'))
        await tabShown(page, 'rp-appointments')
        await ui.highlight(page.locator('.rp-kpis'), 1200)
        await ui.highlight(tid(page, 'chart-apt-status'), 1000)
      },
    },
    {
      id: 'doctor-performance',
      say: {
        ar: 'وجدول «أداء الأطباء»: المحجوزة والمكتملة ومن لم يحضروا والساعات المحجوزة و«نسبة الإشغال»، وهي الدقائق المحجوزة مقسومة على دقائق الدوام من الإعدادات.',
        en: 'And the Doctor performance table: booked, completed, no-shows, booked hours and Utilisation, which is booked minutes divided by the working minutes set in Settings.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(tid(page, 'table-doctors'), { block: 'start' })
        await ui.highlight(tid(page, 'table-doctors'), 1800)
      },
    },
    {
      id: 'treatments-tab',
      say: {
        ar: 'تبويب «العلاجات»: «إجراءات منجزة» و«قيمة العمل المنجز» و«أُضيف إلى الخطط» و«قيمة العمل المعلّق»، ثم «الإجراءات الأكثر تنفيذاً» و«الإجراءات الأعلى قيمة» و«المخطط مقابل المنجز».',
        en: 'The Treatments tab: Procedures completed, Value of completed work, Added to plans and Pending work value, then Most performed procedures, Top procedures by value and Planned vs completed.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.rp-tabs'), { block: 'start' })
        await ui.click(tab(page, 'العلاجات', 'Treatments'))
        await tabShown(page, 'rp-treatments')
        await ui.highlight(page.locator('.rp-kpis'), 1200)
        await ui.scrollTo(tid(page, 'chart-top-count'), { block: 'start' })
        await ui.highlight(tid(page, 'chart-top-count'), 1100)
      },
    },
    {
      id: 'outstanding-tab',
      say: {
        ar: 'تبويب «الذمم المستحقة» يعرض ما على المرضى اليوم من كل الفترات: «إجمالي المستحق» و«مرضى عليهم رصيد» و«متوسط الرصيد المستحق» و«أعلى رصيد». ولا يتأثر بالفترة ولا بالطبيب.',
        en: 'The Outstanding tab shows what patients owe today, across all periods: Total outstanding, Patients with a balance, Average balance and Largest balance. It ignores the period and the doctor.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.rp-tabs'), { block: 'start' })
        await ui.click(tab(page, 'الذمم المستحقة', 'Outstanding'))
        await tabShown(page, 'rp-outstanding')
        await ui.highlight(page.locator('.rp-kpis'), 1600)
      },
    },
    {
      id: 'balances',
      say: {
        ar: 'وتحتها جدول «الأرصدة المستحقة على المرضى» من الأعلى إلى الأدنى: «قيمة الفواتير المفتوحة» و«المدفوع منها» و«المستحق» و«آخر دفعة». انقر على اسم مريض لتفتح ملفه.',
        en: 'Under them the Patient balances table runs from the largest down: Open invoices, Paid, Due and Last payment. Click a patient’s name to open their file.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(tid(page, 'table-outstanding'), { block: 'start' })
        await ui.highlight(tid(page, 'table-outstanding').locator('thead'), 1300)
        const name = tid(page, 'table-outstanding').locator('tbody tr').first().locator('a.cell-main')
        await ui.moveTo(name)
        await ui.highlight(name, 1000)
      },
    },
    {
      id: 'remind',
      say: {
        ar: 'وانقر على «تذكير» في سطره لترسل له عبر واتساب رسالة جاهزة فيها اسم العيادة والمبلغ المستحق؛ تراجعها قبل الإرسال. والطباعة من هذا التبويب تطبع كل المرضى المدينين.',
        en: 'Click Remind on their row to send a ready WhatsApp message with the clinic’s name and the amount due; you see it before it is sent. Printing from this tab prints every patient who owes money.',
      },
      run: async ({ page, ui }) => {
        const wa = tid(page, 'table-outstanding').locator('tbody tr').first().locator('.rp-wa')
        await ui.moveTo(wa)
        await ui.highlight(wa, 1600)
      },
    },
    {
      id: 'print-export',
      say: {
        ar: 'انقر على «طباعة» لتطبع التبويب المفتوح، وفي رأسه اسم العيادة والفترة وتاريخ الطباعة: على ويندوز تُفتح نافذة الطباعة، وعلى أندرويد شاشة الطباعة في النظام. و«تصدير CSV» يحفظ الجدول الرئيسي للتبويب في ملف يفتحه Excel.',
        en: 'Click Print to print the open tab, headed with the clinic’s name, the period and the print date: on Windows the print dialog opens, on Android the system print screen. Export CSV saves the tab’s main table as a file Excel opens.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.page-header'), { block: 'start' })
        const print = btn(page.locator('.page-actions'), 'طباعة', 'Print')
        await ui.moveTo(print)
        await ui.highlight(print, 1300)
        await ui.moveTo(tid(page, 'rp-csv'))
        await ui.highlight(tid(page, 'rp-csv'), 1300)
      },
    },
    {
      id: 'phone',
      say: {
        ar: 'على الهاتف تصطف البطاقات اثنتين اثنتين والرسوم تحت بعضها، ويُسحب شريط التبويبات جانبياً لتصل إلى «الذمم المستحقة».',
        en: 'On a phone the cards sit two by two and the charts stack, and the tab strip slides sideways to reach Outstanding.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.moveTo(page.locator('.rp-tabs'))
        await ui.callout(pick(lang, 'على الهاتف: التبويبات تُسحب جانبياً', 'On a phone: the tabs slide sideways'), { ms: 2200 })
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تقرأ إيرادات عيادتك ومصروفاتها وأداءها لأي فترة ولكل طبيب. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you read your clinic’s revenue, expenses and performance for any period and any doctor. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(home(page))
        await dashboardShown(page)
      },
    },
  ],
}

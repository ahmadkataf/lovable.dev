// Chapter 3 "Dashboard: your day at a glance": the figure cards, today's schedule and its status buttons, the alerts,
// the charts and recent activity, written from server/guide/topics/dashboard.ts. Runs on the demo clinic at 11:40 on
// a Sunday (the recorder's fixed clock), signed in as the admin, from the dashboard.

const home = page => page.locator('.app-sidebar .nav-item').first()
const card = (page, id) => page.locator(`[data-testid="${id}"]`)

async function dashboardShown(page) {
  await page.locator('[data-testid="dashboard"]').waitFor({ timeout: 30000 })
  await page.locator('[data-testid="dash-schedule"] [data-testid="dash-apt"]').first().waitFor({ timeout: 15000 })
  await page.locator('[data-testid="dash-revenue"] svg').first().waitFor({ timeout: 15000 })
  await page.locator('[data-testid="dash-activity"] .rp-feed-row').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(900)
}
/** Back to the dashboard from another page. */
async function goHome(page, ui) {
  await ui.click(home(page))
  await dashboardShown(page)
}

/** The index (among today's rows) of the first visit after the Now line that can be checked in: the row the chapter follows. */
async function visitRow(page) {
  const sched = card(page, 'dash-schedule')
  const row = sched.locator('li.rp-now ~ li[data-testid="dash-apt"]').filter({ has: page.locator('[data-testid="apt-do-arrived"]') }).first()
  await row.waitFor({ timeout: 10000 })
  const idx = await row.evaluate(el => [...el.parentElement.querySelectorAll('[data-testid="dash-apt"]')].indexOf(el))
  return sched.locator('[data-testid="dash-apt"]').nth(idx)
}

export const chapter = {
  slug: 'dashboard',
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل تقرأ يومك كله من الشاشة الرئيسية في دنتورا: مواعيد اليوم وحالاتها، وأرقام الشهر، وما يحتاج إلى انتباهك.',
        en: 'In this chapter you read your whole day from the Dentora dashboard: today’s appointments and their status, the month’s figures and what needs your attention.',
      },
      run: async ({ page, ui }) => {
        await dashboardShown(page)
        await ui.highlight(page.locator('.page-header'), 1800)
      },
    },
    {
      id: 'overview',
      say: {
        ar: '«الرئيسية» أول ما تراه حين تفتح البرنامج، وتعود إليها في أي وقت من أعلى القائمة الجانبية. في أعلاها تحية باسمك وتاريخ اليوم، وثلاثة أزرار للإضافة السريعة: «موعد جديد» و«مريض جديد» و«دفعة جديدة». وتتحدث الشاشة وحدها مع كل تغيير يجري في العيادة.',
        en: 'The Dashboard is the first screen you see when you open Dentora, and you get back to it any time from the top of the sidebar. At the top sit a greeting with your name and today’s date, and three quick-add buttons: New appointment, New patient and New payment. The screen updates by itself whenever something changes in the clinic.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(home(page), 1400)
        await ui.highlight(page.locator('[data-testid="dash-greeting"]'), 1500)
        for (const id of ['dash-new-apt', 'dash-new-patient', 'dash-new-payment']) {
          await ui.moveTo(card(page, id))
          await ui.highlight(card(page, id), 900)
        }
      },
    },
    {
      id: 'stats-1',
      say: {
        ar: 'ثم بطاقات الأرقام. «مواعيد اليوم»: عدد مواعيد اليوم دون الملغاة، وكم اكتمل منها. «مرضى راجعوا هذا الشهر»: من حضروا هذا الشهر حتى اليوم. و«مرضى جدد هذا الشهر»: الملفات التي فُتحت منذ أول الشهر.',
        en: 'Then the figure cards. Today’s appointments: today’s appointments, not counting cancelled ones, and how many are completed. Patients seen this month: who came in this month so far. New patients this month: files opened since the first of the month.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(card(page, 'stat-today'), 2200)
        await ui.highlight(card(page, 'stat-seen'), 2000)
        await ui.highlight(card(page, 'stat-new'), 2000)
      },
    },
    {
      id: 'stats-2',
      say: {
        ar: '«إيرادات اليوم»: مجموع الدفعات المسجلة اليوم. «إيرادات الشهر» مع خط صغير يرسم آخر 30 يوماً. و«الرصيد المستحق»: ما بقي على المرضى في الفواتير غير المدفوعة والمدفوعة جزئياً. وتظهر بطاقات المال لمن يسمح له دوره بالفواتير فقط.',
        en: 'Today’s revenue: the total of payments recorded today. Revenue this month, with a small line of the last 30 days. And Outstanding balance: what patients still owe on unpaid and partially paid invoices. The money cards show only for roles allowed to handle invoices.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(card(page, 'stat-rev-today'), 2000)
        await ui.highlight(card(page, 'stat-rev-month'), 2000)
        await ui.highlight(card(page, 'stat-outstanding'), 2200)
      },
    },
    {
      id: 'stats-links',
      say: {
        ar: 'النسبة الخضراء أو الحمراء تحت الرقم تقارن الشهر حتى اليوم بالأيام نفسها من الشهر الماضي. وكل بطاقة رابط: انقر على «مواعيد اليوم» لتفتح تقويم اليوم، ثم نعود إلى «الرئيسية».',
        en: 'The green or red percentage under a figure compares this month so far with the same days of last month. Every card is a link: click Today’s appointments to open today’s calendar, then we go back to the Dashboard.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(card(page, 'stat-seen').locator('.rp-kpi-foot'), 1800)
        await ui.click(card(page, 'stat-today'))
        await page.locator('.apt-page').waitFor({ timeout: 15000 })
        await ui.pause(1600)
        await goHome(page, ui)
      },
    },
    {
      id: 'schedule',
      say: {
        ar: 'يعرض «جدول اليوم» مواعيد اليوم بالترتيب: الوقت، والمريض، ونوع الزيارة، والطبيب بلونه، والحالة. ويفصل خط أحمر عنوانه «الآن» ما مضى عمّا هو قادم.',
        en: 'Today’s schedule lists today’s appointments in order: time, patient, type of visit, the doctor with their colour, and the status. A red line labelled Now separates what is past from what is coming.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(card(page, 'dash-schedule'))
        await ui.highlight(card(page, 'dash-schedule').locator('[data-testid="dash-apt"]').first(), 2000)
        await ui.highlight(card(page, 'rp-now'), 1800)
      },
    },
    {
      id: 'schedule-rows',
      say: {
        ar: 'تظهر الزيارات المنتهية باهتة، والجلسة الجارية مظللة، وفي عنوان البطاقة عدد مواعيد اليوم وكم بقي منها.',
        en: 'Finished visits are dimmed, the visit in progress is highlighted, and the card’s heading shows how many appointments there are today and how many are still to come.',
      },
      run: async ({ page, ui }) => {
        const sched = card(page, 'dash-schedule')
        await ui.highlight(sched.locator('.rp-apt.past').first(), 1400)
        await ui.highlight(sched.locator('.rp-apt.live').first(), 1400)
        await ui.highlight(sched.locator('.card-header'), 1500)
      },
    },
    {
      id: 'check-in',
      say: {
        ar: 'حين يصل المريض انقر على «تسجيل الوصول» في سطره.',
        en: 'When the patient arrives, click Check in on their row.',
      },
      run: async ({ page, ui }) => {
        const row = await visitRow(page)
        await ui.click(row.locator('[data-testid="apt-do-arrived"]'))
        await row.locator('[data-testid="apt-do-in_progress"]').waitFor({ timeout: 8000 })
      },
    },
    {
      id: 'start-complete',
      say: {
        ar: 'حين يدخل إلى غرفة العلاج انقر على «بدء الجلسة»، وفي نهايتها على «إنهاء الموعد». يعرض كل سطر الزر المناسب لحالته فقط.',
        en: 'When they go into the treatment room click Start, and at the end Complete. Each row only shows the buttons that fit its status.',
      },
      run: async ({ page, ui }) => {
        const sched = card(page, 'dash-schedule')
        const row = sched.locator('[data-testid="dash-apt"]').filter({ has: page.locator('[data-testid="apt-do-in_progress"]') }).first()
        const idx = await row.evaluate(el => [...el.parentElement.querySelectorAll('[data-testid="dash-apt"]')].indexOf(el))
        const same = sched.locator('[data-testid="dash-apt"]').nth(idx)
        await ui.click(same.locator('[data-testid="apt-do-in_progress"]'))
        await same.locator('[data-testid="apt-do-completed"]').waitFor({ timeout: 8000 })
        await ui.pause(1500)
        await ui.click(same.locator('[data-testid="apt-do-completed"]'))
        await ui.pause(600)
      },
    },
    {
      id: 'confirm',
      say: {
        ar: 'ولتأكيد موعد لم يُؤكَّد بعد انقر على «تأكيد». يظهر كل تغيير في الحالة فوراً، ويُسجَّل في «آخر النشاطات».',
        en: 'To confirm an appointment that is not confirmed yet, click Confirm. Each status change shows at once and is logged in Recent activity.',
      },
      run: async ({ page, ui }) => {
        await ui.click(card(page, 'dash-schedule').locator('[data-testid="apt-do-confirmed"]').first())
        await ui.pause(800)
      },
    },
    {
      id: 'open-calendar',
      say: {
        ar: 'انقر على اسم المريض لفتح ملفه، أو على «فتح التقويم» لترى اليوم في صفحة المواعيد.',
        en: 'Click the patient’s name to open their file, or Open calendar to see the day on the Appointments page.',
      },
      run: async ({ page, ui }) => {
        const sched = card(page, 'dash-schedule')
        const name = sched.locator('li.rp-now ~ li .rp-apt-name').first()
        await ui.moveTo(name)
        await ui.highlight(name, 1300)
        await ui.click(sched.locator('.card-header a, .card-header button').filter({ hasText: /فتح التقويم|Open calendar/ }).first())
        await page.locator('.apt-page').waitFor({ timeout: 15000 })
        await ui.pause(1400)
        await goHome(page, ui)
      },
    },
    {
      id: 'alerts',
      say: {
        ar: 'تجمع بطاقة «تنبيهات تحتاج انتباهك» ما ينبغي أن تتابعه اليوم، مع عدد كل نوع: «فواتير متأخرة السداد»، و«مواد قاربت على النفاد»، و«أعمال مخبر مستحقة»، و«مواعيد الغد غير المؤكدة» لتتصل بالمرضى.',
        en: 'The Needs your attention card gathers what you should follow up today, with a count for each kind: Overdue invoices, Low-stock items, Lab work due, and Tomorrow’s unconfirmed visits, so you can call the patients.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(card(page, 'dash-alerts'))
        await ui.highlight(card(page, 'dash-alerts'), 1600)
        for (const id of ['alert-overdue', 'alert-stock', 'alert-lab', 'alert-unconfirmed']) {
          if (await card(page, id).count()) await ui.highlight(card(page, id), 1000)
        }
      },
    },
    {
      id: 'alerts-backup',
      say: {
        ar: 'وفي أعلاها تذكير بالنسخ الاحتياطي إن لم تُحفظ نسخة قط أو مضى على آخرها 7 أيام أو أكثر. انقر على أي سطر لتنتقل إلى صفحته، مثل الفواتير المتأخرة. وإن لم يكن هناك ما يستدعي الانتباه تظهر «كل شيء على ما يرام».',
        en: 'At the top, a backup reminder shows when no backup was ever saved or the last one is 7 or more days old. Click any row to go to its page, such as the overdue invoices. When nothing needs attention, the card says All clear.',
      },
      run: async ({ page, ui }) => {
        if (await card(page, 'alert-backup').count()) await ui.highlight(card(page, 'alert-backup'), 1600)
        await ui.click(card(page, 'alert-overdue'))
        await page.locator('.bl-table, .bl-mlist').first().waitFor({ timeout: 15000 })
        await ui.pause(1500)
        await goHome(page, ui)
      },
    },
    {
      id: 'revenue',
      say: {
        ar: '«الإيرادات — آخر 30 يوماً»: الدفعات يوماً بيوم، ومجموعها تحت العنوان. مرّر المؤشر على الرسم، أو المسه على الهاتف، لترى مبلغ أي يوم.',
        en: 'Revenue, last 30 days: payments day by day, with the total under the title. Hover over the chart, or touch it on a phone, to see any day’s amount.',
      },
      run: async ({ page, ui }) => {
        const rev = card(page, 'dash-revenue')
        await ui.scrollTo(rev)
        await ui.highlight(rev.locator('.card-header'), 1500)
        await ui.moveTo(rev.locator('.card-body svg').first())
        await ui.pause(1800)
      },
    },
    {
      id: 'revenue-table',
      say: {
        ar: 'لترى الإيرادات أرقاماً انقر على زر «عرض كجدول» في زاوية البطاقة، وانقر عليه ثانية للعودة إلى الرسم. وزر «التقارير» في البطاقة نفسها لتحليل أعمق.',
        en: 'To see revenue as figures, click the Show as table button in the corner of the card; click it again to go back to the chart. The Reports button on the same card gives a deeper look.',
      },
      run: async ({ page, ui }) => {
        const rev = card(page, 'dash-revenue')
        await ui.click(rev.getByRole('button', { name: /^(عرض كجدول|Show as table)$/ }))
        await ui.pause(1800)
        await ui.click(rev.getByRole('button', { name: /^(عرض كرسم بياني|Show as chart)$/ }))
        await ui.pause(400)
        const reports = rev.locator('.card-header button').filter({ hasText: /^(التقارير|Reports)$/ }).first()
        await ui.moveTo(reports)
        await ui.highlight(reports, 1300)
      },
    },
    {
      id: 'status',
      say: {
        ar: '«المواعيد حسب الحالة»: مواعيد الشهر الحالي موزعة على حالاتها، مع عدد كل حالة ونسبتها، ومجموعها في الوسط.',
        en: 'Appointments by status: this month’s appointments split by status, with each status’s count and share, and the total in the middle.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(card(page, 'dash-status'))
        await ui.highlight(card(page, 'dash-status'), 2400)
      },
    },
    {
      id: 'top',
      say: {
        ar: '«الإجراءات الأكثر تنفيذاً»: أكثر الإجراءات المنجزة هذا الشهر، مع عدد مرات تنفيذ كل منها. مرّر المؤشر على أي إجراء لترى نسبته من المجموع.',
        en: 'Top procedures: the procedures completed most often this month, with how many times each was done. Hover over a procedure to see its share of the total.',
      },
      run: async ({ page, ui }) => {
        const top = card(page, 'dash-top')
        await ui.scrollTo(top)
        await ui.highlight(top, 1800)
        await ui.moveTo(top.locator('.card-body').first())
        await ui.pause(1500)
      },
    },
    {
      id: 'activity',
      say: {
        ar: 'تعرض «آخر النشاطات» آخر 12 عملية في العيادة: موعد حُجز، أو حالة تغيّرت، أو دفعة استُلمت، ومع كل منها من قام بها ومتى. انقر على سطر يخص مريضاً لفتح ملفه.',
        en: 'Recent activity shows the last 12 actions in the clinic: an appointment booked, a status changed, a payment received, each with who did it and when. Click a row about a patient to open their file.',
      },
      run: async ({ page, ui }) => {
        const act = card(page, 'dash-activity')
        await ui.scrollTo(act)
        await ui.highlight(act, 2200)
        await ui.click(act.locator('a.rp-feed-row').first())
        await page.locator('.pt-hero').waitFor({ timeout: 15000 })
        await ui.pause(600)
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'على الهاتف تظهر بطاقات الأرقام في عمودين، ثم تتوالى البطاقات تحتها. هكذا تقرأ يومك في نظرة؛ والتفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'On a phone the figure cards sit in two columns, followed by the other cards. That is your day at a glance; every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => { await goHome(page, ui) },
    },
  ],
}

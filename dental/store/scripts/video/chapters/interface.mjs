// Chapter 2 "The interface and navigation": the parts of the screen, the sidebar and the account menu, quick search,
// the New button, notifications, appearance and the keyboard shortcuts, written from server/guide/topics/interface.ts.
// Runs on the demo clinic, signed in as the admin, from the dashboard.

const NEW_BUTTON = '.topbar-actions .btn-primary.hide-mobile'
const nav = (page, to) => page.locator(`.app-sidebar .nav-item[href$="${to}"]`)
const home = page => page.locator('.app-sidebar .nav-item').first()
const bell = page => page.getByRole('button', { name: /^(التنبيهات|Notifications)$/ })
const tab = (page, id) => page.locator(`.st-nav [data-tab="${id}"]`)
/** The settings card that holds `inner`. */
const cardWith = (page, inner) => page.locator('.st-form .card').filter({ has: page.locator(inner) }).first()
/** The notifications group titled with `re`. */
const group = (page, re) => page.locator('.ntf-group').filter({ has: page.locator('.ntf-head-title', { hasText: re }) }).first()
const pick = (lang, ar, en) => (lang === 'ar' ? ar : en)

async function dashboardShown(page) {
  await page.locator('[data-testid="dashboard"]').waitFor({ timeout: 30000 })
  await page.locator('[data-testid="dash-schedule"] [data-testid="dash-apt"]').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(700)
}
async function settingsTab(page, ui, id, ready) {
  await tab(page, id).waitFor({ timeout: 15000 })
  await ui.click(tab(page, id))
  await page.locator(ready).first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)
}

export const chapter = {
  slug: 'interface',
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل تتعرف على أجزاء الشاشة في دنتورا لتصل إلى أي شيء في ثوانٍ: القائمة الجانبية، والبحث السريع، وزر «جديد»، والتنبيهات.',
        en: 'In this chapter you get to know the parts of the Dentora screen, so you reach anything in seconds: the sidebar, quick search, the New button and notifications.',
      },
      run: async ({ page, ui }) => {
        await dashboardShown(page)
        // the page header, not .app-content: an element taller than the window would make the page scroll to its middle
        await ui.moveTo(page.locator('.page-header'))
        await ui.pause(600)
      },
    },
    {
      id: 'parts',
      say: {
        ar: 'تتكون كل الشاشات من الأجزاء نفسها: قائمة جانبية للتنقل، وشريط علوي فيه البحث والإضافة والتنبيهات، والصفحة نفسها في الوسط. في الواجهة العربية تكون القائمة على اليمين، وفي الإنجليزية على اليسار.',
        en: 'Every screen is built from the same parts: a sidebar to move around, a top bar with search, adding and notifications, and the page itself in the middle. In the Arabic interface the sidebar is on the right; in English it is on the left.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(page.locator('.app-sidebar'), 1700)
        await ui.highlight(page.locator('.app-topbar'), 1700)
        await ui.highlight(page.locator('.page-header'), 1000)
        await ui.highlight(page.locator('.rp-dash-kpis'), 1200)
      },
    },
    {
      id: 'sidebar',
      say: {
        ar: 'في أعلى القائمة اسم عيادتك ثم «الرئيسية»، وتحتها ثلاث مجموعات: «العيادة» و«المالية» و«الإدارة». وما تراه فيها يتبع دورك. انقر على «المرضى» مثلاً لتفتح صفحتها.',
        en: 'The top of the sidebar shows your clinic’s name, then Dashboard, and below it three groups: Clinical, Finance and Management. What you see there follows your role. Click Patients, for example, to open its page.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(page.locator('.app-sidebar .brand'), 1100)
        await ui.highlight(page.locator('.app-sidebar .nav'), 2200)
        await ui.click(nav(page, '/patients'))
        await page.locator('.pt-table tbody tr').first().waitFor({ timeout: 15000 })
        await page.waitForTimeout(400)
      },
    },
    {
      id: 'collapse',
      say: {
        ar: 'لتوسيع مساحة العمل انقر على زر «طيّ القائمة» أسفل القائمة، فتبقى الأيقونات وحدها. وانقر على السهم مرة أخرى لتوسيعها.',
        en: 'For more room, click the Collapse menu button at the bottom of the sidebar: only the icons stay. Click the arrow again to expand it.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.collapse-btn'))
        await page.locator('.app.collapsed').waitFor({ timeout: 5000 })
        await ui.moveTo(page.locator('.page-header'))
        await ui.pause(1600)
        await ui.click(page.locator('.collapse-btn'))
        await page.locator('.app:not(.collapsed)').waitFor({ timeout: 5000 })
        await ui.pause(400)
      },
    },
    {
      id: 'user-menu',
      say: {
        ar: 'انقر على اسمك أسفل القائمة لتفتح قائمة حسابك: فيها «الإعدادات»، و«قفل الشاشة» حين تبتعد عن الجهاز، و«تسجيل الخروج» حين تنهي عملك. لنفتح «الإعدادات» من هنا.',
        en: 'Click your name at the bottom of the sidebar to open your account menu: it has Settings, Lock screen for when you step away, and Sign out for when you finish. Let’s open Settings from here.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.sidebar-user'))
        const lock = page.getByRole('menuitem', { name: /^(قفل الشاشة|Lock screen)$/ })
        await lock.waitFor({ timeout: 5000 })
        await ui.moveTo(lock)
        await ui.highlight(lock, 1200)
        const logout = page.getByRole('menuitem', { name: /^(تسجيل الخروج|Sign out)$/ })
        await ui.moveTo(logout)
        await ui.highlight(logout, 1100)
        await ui.click(page.getByRole('menuitem', { name: /^(الإعدادات|Settings)$/ }))
        await page.locator('[data-qa="tab-clinic"] .card').first().waitFor({ timeout: 15000 })
        await page.waitForTimeout(400)
      },
    },
    {
      id: 'search-open',
      say: {
        ar: 'من خانة البحث تصل إلى أي مريض أو موعد أو فاتورة أو صفحة في ثوانٍ. انقر عليها في أعلى الشاشة، أو اضغط Ctrl+K من أي مكان.',
        en: 'The search box takes you to any patient, appointment, invoice or page in seconds. Click it at the top of the screen, or press Ctrl+K anywhere.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.topbar-search'))
        await page.locator('.srch-panel').waitFor({ timeout: 5000 })
        await page.waitForTimeout(300)
        await ui.highlight(page.locator('.srch-panel'), 1600)
      },
    },
    {
      id: 'search-start',
      say: {
        ar: 'قبل أن تكتب شيئاً تعرض النافذة «إجراءات سريعة»، و«الانتقال إلى» مع كل صفحات البرنامج.',
        en: 'Before you type, the window shows Quick actions, and Go to with every page of the app.',
      },
      run: async ({ page, ui }) => {
        // the group titles (a whole group can be taller than the panel, which would scroll the list away); the
        // "Go to" title is scrolled to the top of the list so its first pages stay in view
        const titles = page.locator('.srch-panel .srch-group-title')
        await ui.moveTo(titles.first())
        await ui.highlight(titles.first(), 1400)
        await ui.scrollTo(titles.last(), { block: 'start' })
        await ui.moveTo(titles.last())
        await ui.highlight(titles.last(), 1400)
      },
    },
    {
      id: 'search-type',
      say: {
        ar: 'اكتب جزءاً من الاسم أو الرقم، فتظهر النتائج مجمّعة تحت «المرضى» و«المواعيد القادمة» و«الفواتير».',
        en: 'Type part of a name or a number: the results come grouped under Patients, Upcoming appointments and Invoices.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(page.locator('.srch-input'), pick(lang, 'سامر', 'Samer'), { delay: 110 })
        await page.locator('.srch-panel .srch-item.active').waitFor({ timeout: 8000 })
        await page.waitForTimeout(500)
        const titles = page.locator('.srch-panel .srch-group-title')
        await ui.highlight(titles.first(), 1200)
        if (await titles.count() > 1) await ui.highlight(titles.nth(1), 1200)
      },
    },
    {
      id: 'search-pick',
      say: {
        ar: 'تنقّل بين النتائج بالسهمين واضغط Enter لفتح النتيجة المظللة، أو انقر عليها بالمؤشر. وEsc يغلق البحث.',
        en: 'Move through the results with the arrow keys and press Enter to open the highlighted one, or click it. Esc closes the search.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.srch-panel .srch-item').first())
        await page.locator('.pt-hero').waitFor({ timeout: 15000 })
        await page.waitForTimeout(500)
      },
    },
    {
      id: 'new-button',
      say: {
        ar: 'زر «جديد» في الشريط العلوي يضيف أكثر ما تحتاج إليه كل يوم، من أي صفحة كنت فيها: «مريض جديد» أو «موعد جديد» أو «دفعة جديدة».',
        en: 'The New button in the top bar adds what you need most every day, from whatever page you are on: New patient, New appointment or New payment.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator(NEW_BUTTON))
        const menu = page.locator('[role="menu"]').last()
        await menu.waitFor({ timeout: 5000 })
        await ui.highlight(menu, 1800)
      },
    },
    {
      id: 'new-patient',
      say: {
        ar: 'لنختر «مريض جديد»، ونكتب الاسم والهاتف، ثم ننقر على «حفظ المريض». بعد الحفظ يُفتح ملف المريض مباشرة.',
        en: 'Let’s choose New patient, type the name and phone, then click Save patient. After saving, the patient’s file opens straight away.',
      },
      run: async ({ page, ui, lang }) => {
        // the item's accessible name ends with its shortcut (Ctrl+Shift+N)
        await ui.click(page.getByRole('menuitem', { name: /^(مريض جديد|New patient)/ }))
        const dialog = page.getByRole('dialog')
        await dialog.waitFor({ timeout: 10000 })
        await page.waitForTimeout(300)
        await ui.type(dialog.getByLabel(/الاسم الكامل|Full name/), pick(lang, 'رامي الحموي', 'Rami Hamwi'))
        await ui.type(dialog.getByLabel(/^(الهاتف|Phone)\s*\*?$/), '0933 221 884', { delay: 60 })
        await ui.click(dialog.getByRole('button', { name: /^(حفظ المريض|Save patient)$/ }))
        await page.locator('.pt-hero').waitFor({ timeout: 15000 })
        await page.waitForTimeout(600)
      },
    },
    {
      id: 'bell',
      say: {
        ar: 'أيقونة الجرس تجمع ما يحتاج إلى انتباهك اليوم، وتظهر عليها نقطة حمراء حين يجدّ أمر مهم لم تره بعد. انقر على الجرس لتفتح لوحة «التنبيهات».',
        en: 'The bell gathers what needs your attention today, and a red dot appears on it when something important comes up that you have not seen yet. Click the bell to open the Notifications panel.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(bell(page))
        await ui.highlight(bell(page), 1300)
        await ui.click(bell(page))
        await page.locator('.ntf-group').first().waitFor({ timeout: 10000 })
        await page.waitForTimeout(600)
        await ui.highlight(page.locator('.drawer'), 1400)
      },
    },
    {
      id: 'notif-groups',
      say: {
        ar: 'في اللوحة، بحسب دورك: النسخ الاحتياطي، ومواعيد اليوم المتبقية، ومواعيد الغد غير المؤكدة، وأعمال المخبر، والفواتير المتأخرة، والمخزون، وأعياد الميلاد، والمرضى بحاجة لمراجعة دورية.',
        en: 'Depending on your role, the panel lists Backup, Remaining today, Unconfirmed for tomorrow, Lab work, Overdue invoices, Inventory, Birthdays today and Due for a recall.',
      },
      run: async ({ page, ui }) => {
        const groups = page.locator('.ntf-group')
        const n = await groups.count()
        for (let i = 0; i < Math.min(3, n); i++) {
          await ui.moveTo(groups.nth(i).locator('.ntf-head'))
          await ui.highlight(groups.nth(i).locator('.ntf-head'), 900)
        }
        if (n > 3) {
          await ui.scrollTo(groups.last())
          await ui.moveTo(groups.last().locator('.ntf-head'))
          await ui.highlight(groups.last().locator('.ntf-head'), 1100)
        }
      },
    },
    {
      id: 'notif-whatsapp',
      say: {
        ar: 'بجانب كل موعد للغد غير مؤكد أيقونة «تذكير عبر واتساب» تفتح رسالة جاهزة للمريض. وإن كانت المجموعة طويلة انقر على «عرض الكل».',
        en: 'Each unconfirmed appointment for tomorrow has a Remind on WhatsApp icon that opens a ready-made message to the patient. When a group is long, click View all.',
      },
      run: async ({ page, ui }) => {
        const unconfirmed = group(page, /مواعيد الغد غير المؤكدة|Unconfirmed for tomorrow/)
        await ui.scrollTo(unconfirmed)
        const action = unconfirmed.locator('.ntf-action button').first()
        await ui.moveTo(action)
        await ui.highlight(action, 1500)
        const more = page.locator('.ntf-more').first()
        if (await more.count()) { await ui.moveTo(more); await ui.highlight(more, 1200) }
      },
    },
    {
      id: 'notif-click',
      say: {
        ar: 'وانقر على أي تنبيه لتنتقل إلى صفحته: الموعد في التقويم، أو الفاتورة، أو ملف المريض.',
        en: 'Click any alert to go to its page: the appointment in the calendar, the invoice, or the patient’s file.',
      },
      run: async ({ page, ui }) => {
        const today = group(page, /مواعيد اليوم المتبقية|Remaining today/)
        await ui.scrollTo(today)
        await ui.click(today.locator('.ntf-main').first())
        await page.locator('.apt-page').waitFor({ timeout: 15000 })
        await page.waitForTimeout(600)
      },
    },
    {
      id: 'phone',
      say: {
        ar: 'على الهاتف تختفي القائمة الجانبية ويظهر شريط في أسفل الشاشة: «الرئيسية» و«المواعيد» و«المرضى» و«الفواتير»، وزر «المزيد» لبقية الصفحات، وزر + لموعد جديد.',
        en: 'On a phone the sidebar gives way to a bar at the bottom of the screen: Dashboard, Appointments, Patients and Invoices, a More button for the other pages, and a + button for a new appointment.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(page.locator('.app-topbar'))
        await ui.pause(800)
      },
    },
    {
      id: 'preferences',
      say: {
        ar: 'يعمل دنتورا بالعربية أو بالإنجليزية، بمظهر فاتح أو داكن. افتح «الإعدادات» ← «التفضيلات».',
        en: 'Dentora works in Arabic or in English, with a light or a dark appearance. Open Settings, then Preferences.',
      },
      run: async ({ page, ui }) => {
        await ui.click(nav(page, '/settings'))
        await settingsTab(page, ui, 'preferences', '[data-theme-option="dark"]')
      },
    },
    {
      id: 'theme',
      say: {
        ar: 'في «المظهر» اختر «فاتح» أو «داكن»: تتغير الواجهة كلها فوراً. الفاتح أوضح للعمل اليومي، والداكن مريح في الغرف الخافتة الإضاءة.',
        en: 'Under Appearance choose Light or Dark: the whole interface changes at once. Light is the clearest for daily work; dark is easier in dimly lit rooms.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(cardWith(page, '[data-theme-option="dark"]'))
        await ui.click(page.locator('[data-theme-option="dark"]'))
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 5000 })
        await ui.pause(2000)
        await ui.click(page.locator('[data-theme-option="light"]'))
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'light', null, { timeout: 5000 })
        await ui.pause(500)
      },
    },
    {
      id: 'language-font',
      say: {
        ar: 'وفي «لغة الواجهة» تختار «العربية» أو «English»، وفي «خط الواجهة» الخط الأريح لعينيك. اللغة والمظهر لكل المستخدمين ويغيّرهما المدير، أما الخط فيخص هذا الجهاز وحده.',
        en: 'Under Interface language you choose العربية or English, and under Interface font the font that is easiest on your eyes. Language and appearance apply to everyone and only the admin changes them; the font belongs to this device alone.',
      },
      run: async ({ page, ui }) => {
        const language = cardWith(page, '[data-lang]')
        await ui.scrollTo(language)
        await ui.highlight(language, 1800)
        const font = cardWith(page, '[data-font]')
        await ui.scrollTo(font)
        await ui.highlight(font, 1800)
      },
    },
    {
      id: 'shortcuts',
      say: {
        ar: 'على الحاسوب توفّر لوحة المفاتيح كثيراً من الوقت: Ctrl+K للبحث السريع، وCtrl+Shift+N لمريض جديد، وCtrl+Shift+A لموعد جديد، وEsc لإغلاق النافذة المفتوحة. تجد القائمة في «الإعدادات» ← «حول البرنامج». وفي نسخة ويندوز أيضاً Ctrl مع + و- للتكبير والتصغير، وF11 لملء الشاشة.',
        en: 'On a computer the keyboard saves a lot of time: Ctrl+K for quick search, Ctrl+Shift+N for a new patient, Ctrl+Shift+A for a new appointment, and Esc to close the open window. The list is in Settings, About. The Windows app also has Ctrl with + and - to zoom, and F11 for full screen.',
      },
      run: async ({ page, ui }) => {
        await settingsTab(page, ui, 'about', '.st-shortcuts')
        const card = cardWith(page, '.st-shortcuts')
        await ui.scrollTo(card)
        await ui.highlight(card, 2600)
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تتنقل في دنتورا: القائمة الجانبية، والبحث السريع، وزر «جديد»، والتنبيهات. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you find your way around Dentora: the sidebar, quick search, the New button and notifications. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(home(page))
        await dashboardShown(page)
      },
    },
  ],
}

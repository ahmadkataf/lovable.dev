// Chapter 14 "Settings": the Settings page and its sections, the clinic details, billing and currency, the
// preferences (language, month names, font, appearance, working hours, auto-lock) and About, written from
// server/guide/topics/settings.ts. Backup and licence have chapters of their own. Runs on the demo clinic, signed in
// as the admin, from the dashboard; the changes it saves are the kind a clinic makes (a tagline, a website, a footer,
// Friday as a working day, a longer auto-lock).

const home = page => page.locator('.app-sidebar .nav-item').first()
const nav = (page, to) => page.locator(`.app-sidebar .nav-item[href$="${to}"]`)
const tab = (page, id) => page.locator(`.st-nav [data-tab="${id}"]`)
/** The settings card that holds `inner`. */
const cardWith = (page, inner) => page.locator('.st-form .card').filter({ has: page.locator(inner) }).first()
/** The settings card whose section title matches `re`. */
const cardTitled = (page, re) => page.locator('.st-form .card').filter({ has: page.locator('.st-section-title', { hasText: re }) }).first()
const pick = (lang, ar, en) => (lang === 'ar' ? ar : en)

async function dashboardShown(page) {
  await page.locator('[data-testid="dashboard"]').waitFor({ timeout: 30000 })
  await page.locator('[data-testid="dash-schedule"] [data-testid="dash-apt"]').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(600)
}
/** Opens a settings section from the section list and waits for `ready` inside it. */
async function openTab(page, ui, id, ready) {
  await tab(page, id).waitFor({ timeout: 15000 })
  await ui.click(tab(page, id))
  await page.locator(`[data-qa="tab-${id}"] ${ready}`).first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
}

export const chapter = {
  slug: 'settings',
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل تجعل دنتورا على مقاس عيادتك: بياناتها وشعارها، والعملة والضريبة وترقيم الفواتير، واللغة والخط والمظهر، وأوقات الدوام والقفل التلقائي. افتح «الإعدادات» من القائمة الجانبية.',
        en: 'In this chapter you make Dentora fit your clinic: its details and logo, the currency, tax and invoice numbering, the language, font and appearance, the working hours and auto-lock. Open Settings from the sidebar.',
      },
      run: async ({ page, ui }) => {
        await dashboardShown(page)
        await ui.pause(2500)
        await ui.click(nav(page, '/settings'))
        await page.locator('[data-qa="tab-clinic"] .card').first().waitFor({ timeout: 15000 })
        await page.waitForTimeout(500)
      },
    },
    {
      id: 'sections',
      say: {
        ar: 'في جانب الصفحة قائمة أقسامها: «بيانات العيادة»، و«التفضيلات»، و«الفوترة والعملة»، و«النسخ الاحتياطي»، و«الترخيص»، و«حول البرنامج». ويغيّر مدير العيادة وحده هذه الإعدادات.',
        en: 'A list of its sections runs down the side of the page: Clinic, Preferences, Billing & currency, Backup & data, Licence and About. Only the clinic admin changes these settings.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(page.locator('.st-nav'), 1500)
        for (const id of ['clinic', 'preferences', 'billing', 'backup', 'license', 'about']) await ui.moveTo(tab(page, id), { ms: 420 })
        await ui.pause(400)
      },
    },
    {
      id: 'clinic-identity',
      say: {
        ar: 'في «بيانات العيادة» هوية عيادتك كما تظهر في رأس الفواتير والوصفات وأعلى القائمة الجانبية. انقر على «رفع شعار» لاختيار صورة الشعار، واكتب «اسم العيادة»، وإن أردت «الاسم بالإنجليزية» و«العبارة التعريفية».',
        en: 'Clinic holds your clinic’s identity as it appears at the top of invoices and prescriptions and at the top of the sidebar. Click Upload logo to choose your logo picture, type the Clinic name and, if you like, the Name in English and a Tagline.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.highlight(page.locator('[data-qa="logo-box"]'), 1200)
        await ui.moveTo(page.locator('[data-qa="pick-logo"]'))
        await ui.highlight(page.locator('[data-qa="pick-logo"]'), 1200)
        await ui.highlight(page.locator('[data-qa="clinic-name"]'), 1200)
        await ui.type(page.getByLabel(/العبارة التعريفية|Tagline/), pick(lang, 'تجميل وزراعة الأسنان', 'Cosmetic & implant dentistry'), { delay: 60 })
      },
    },
    {
      id: 'clinic-contact',
      say: {
        ar: 'في «التواصل والعنوان» أضف «الهاتف» و«البريد الإلكتروني» و«الموقع الإلكتروني» و«العنوان»، وتأكد من «الدولة»: يُضاف رمزها إلى الأرقام المحلية في رسائل واتساب.',
        en: 'Under Contact & address add the Phone, Email, Website and Address, and check the Country: its code is added to local numbers in WhatsApp messages.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(cardWith(page, '[data-qa="clinic-phone"]'))
        await ui.highlight(page.locator('[data-qa="clinic-phone"]'), 1100)
        await ui.type(page.getByLabel(/الموقع الإلكتروني|Website/), 'www.smile-clinic.com', { delay: 55 })
        await ui.highlight(page.locator('[data-qa="clinic-country"]'), 1500)
      },
    },
    {
      id: 'clinic-save',
      say: {
        ar: 'راقب «معاينة رأس الفاتورة» وهي تتحدث مع كل حرف تكتبه. وما إن تعدّل شيئاً يظهر أسفل الصفحة شريط «لديك تغييرات غير محفوظة»: انقر على «حفظ التغييرات»، أو على «تراجع» لإلغاء تعديلاتك.',
        en: 'Watch the Invoice header preview update as you type. As soon as you change something, a You have unsaved changes bar appears at the bottom: click Save changes, or Discard to throw your edits away.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('[data-qa="invoice-preview"]'))
        await ui.highlight(page.locator('[data-qa="invoice-preview"]'), 2200)
        await ui.highlight(page.locator('[data-qa="savebar"]'), 1500)
        await ui.click(page.locator('[data-qa="save"]'))
        await ui.pause(1500)
      },
    },
    {
      id: 'billing',
      say: {
        ar: 'في «الفوترة والعملة» تختار عملة العيادة وطريقة كتابة المبالغ. وفي أعلى الصفحة «معاينة مباشرة» تتحدث مع كل تعديل قبل الحفظ: شكل المبالغ، ورقم الفاتورة التالية، ورقم ملف المريض التالي، وفاتورة نموذجية.',
        en: 'In Billing & currency you choose the clinic’s currency and how amounts are written. A Live preview at the top updates with every change, before you save: how amounts look, the next invoice number, the next patient file number and a sample invoice.',
      },
      run: async ({ page, ui }) => {
        await openTab(page, ui, 'billing', '[data-qa="billing-preview"]')
        await ui.highlight(page.locator('[data-qa="billing-preview"]'), 2600)
      },
    },
    {
      id: 'currency',
      say: {
        ar: 'اختر «عملة العيادة»، وإن لم تجدها فاختر «عملة أخرى…» واكتب رمزها. غيّر «الرمز على الفاتورة» إن أردت، واختر «الكسور العشرية»: بدون كسور، أو منزلتان، أو ثلاث منازل. تغيير العملة لا يحوّل المبالغ المسجلة سابقاً، فاختر عملتك قبل أن تبدأ الفوترة.',
        en: 'Choose the Clinic currency; if yours is not listed, choose Another currency and type its code. Change the Symbol on invoices if you like, and choose the Decimals: none, two or three. Changing the currency does not convert amounts already recorded, so pick your currency before you start billing.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(cardWith(page, '[data-qa="currency"]'))
        await ui.highlight(page.locator('[data-qa="currency"]'), 1500)
        await ui.highlight(page.locator('[data-qa="currency-symbol"]'), 1200)
        await ui.click(page.getByRole('tab', { name: /^(منزلتان \(0\.00\)|Two \(0\.00\))$/ }))
        await ui.highlight(page.locator('[data-qa="preview-money"]'), 1400)
        await ui.click(page.getByRole('tab', { name: /^(بدون كسور|None)$/ }))
        await ui.pause(400)
      },
    },
    {
      id: 'numbering',
      say: {
        ar: 'في «الفواتير والترقيم» اكتب «نسبة الضريبة» أو اتركها 0، و«الرقم الضريبي للعيادة» إن كانت مسجلة في ضريبة القيمة المضافة. وغيّر «بادئة رقم الفاتورة» إن أردت: يتكون رقم الفاتورة من البادئة ثم ستة أرقام، مثل INV-000306.',
        en: 'Under Invoices & numbering type the Tax rate, or leave it at 0, and the Clinic tax number if the clinic is registered for VAT. Change the Invoice number prefix if you like: an invoice number is the prefix followed by six digits, such as INV-000306.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(cardWith(page, '[data-qa="tax"]'))
        await ui.highlight(page.locator('[data-qa="tax"]'), 1500)
        await ui.highlight(page.locator('[data-qa="tax-number"]'), 1500)
        await ui.highlight(page.locator('[data-qa="prefix"]'), 1800)
      },
    },
    {
      id: 'counters',
      say: {
        ar: 'عدّل «رقم الفاتورة التالية» و«رقم ملف المريض التالي» إن أردت أن يكمل الترقيم من دفاتر عيادتك السابقة. ولا يقبل البرنامج رقماً يساوي آخر فاتورة صادرة أو يقل عنه، حتى لا تتكرر الأرقام.',
        en: 'Adjust the Next invoice number and Next patient file number if you want numbering to carry on from your clinic’s old records. Dentora does not accept a number equal to or below the last invoice issued, so numbers never repeat.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(page.locator('[data-qa="next-invoice"]'), 1800)
        await ui.highlight(page.locator('[data-qa="next-file"]'), 1800)
      },
    },
    {
      id: 'printed-notes',
      say: {
        ar: 'في «نصوص الطباعة» اكتب «تذييل الفاتورة» و«تذييل الوصفة الطبية»، وهما نصان قصيران يظهران أسفل المطبوعات، ثم انقر على «حفظ التغييرات».',
        en: 'Under Printed notes write the Invoice footer and the Prescription footer, short texts printed at the bottom, then click Save changes.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.scrollTo(cardTitled(page, /نصوص الطباعة|Printed notes/))
        await ui.type(page.getByLabel(/تذييل الفاتورة|Invoice footer/), pick(lang, 'شكراً لثقتكم بنا.', 'Thank you for your trust.'), { delay: 60 })
        await ui.click(page.locator('[data-qa="save"]'))
        await ui.pause(1200)
      },
    },
    {
      id: 'language',
      say: {
        ar: 'في «التفضيلات» تحمل كل بطاقة شارة تقول على من تسري: «لكل المستخدمين» أو «هذا الجهاز»، وتُحفظ أغلب الإعدادات فور النقر. في «لغة الواجهة» اختر «العربية» أو «English»، فتتغير الشاشات والمطبوعات فوراً. نجرّب اللغة الأخرى، ثم نعود.',
        en: 'In Preferences each card carries a badge saying who it applies to: All users or This device, and most settings are saved the moment you click. Under Interface language choose العربية or English: screens and printouts switch at once. Let’s try the other language, then come back.',
      },
      run: async ({ page, ui, lang }) => {
        await openTab(page, ui, 'preferences', '[data-lang]')
        const other = lang === 'ar' ? 'en' : 'ar'
        await ui.highlight(cardWith(page, '[data-lang]').locator('.st-section-head'), 1800)
        await ui.click(page.locator(`[data-lang="${other}"]`))
        await page.waitForFunction(l => document.documentElement.lang === l, other, { timeout: 8000 })
        await ui.pause(2200)
        await ui.click(page.locator(`[data-lang="${lang}"]`))
        await page.waitForFunction(l => document.documentElement.lang === l, lang, { timeout: 8000 })
        await ui.pause(500)
      },
    },
    {
      id: 'months',
      say: {
        ar: 'في «أسماء الأشهر بالعربية» اختر «تلقائياً حسب الدولة»، أو «كانون الثاني، شباط…»، أو «يناير، فبراير…». ويظهر تحت كل خيار مثال بتاريخ اليوم.',
        en: 'Under Arabic month names choose Automatic, from the country, or كانون الثاني، شباط, or يناير، فبراير. Each choice shows today’s date as an example.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(cardWith(page, '[data-qa="month-style"]'))
        await ui.click(page.locator('[data-months="standard"]'))
        await ui.pause(1600)
        await ui.click(page.locator('[data-months="auto"]'))
        await ui.pause(400)
      },
    },
    {
      id: 'font',
      say: {
        ar: 'في «خط الواجهة» انقر على الخط الذي يريحك، فيتغير فوراً على هذا الجهاز. وأي مستخدم يستطيع تغييره.',
        en: 'Under Interface font click the font you find most comfortable; it changes at once on this device, and anyone can change it.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(cardWith(page, '[data-font]'))
        await ui.click(page.locator('[data-font="cairo"]'))
        await ui.pause(1800)
        await ui.click(page.locator('[data-font="kufi"]'))
        await ui.pause(400)
      },
    },
    {
      id: 'theme',
      say: {
        ar: 'وفي «المظهر» اختر «فاتح» أو «داكن». الفاتح هو الأوضح للعمل اليومي، والداكن مريح في الغرف الخافتة الإضاءة.',
        en: 'Under Appearance choose Light or Dark. Light is the clearest for daily clinic work; dark is easier in dimly lit rooms.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(cardWith(page, '[data-theme-option="dark"]'))
        await ui.click(page.locator('[data-theme-option="dark"]'))
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 5000 })
        await ui.pause(1800)
        await ui.click(page.locator('[data-theme-option="light"]'))
        await page.waitForFunction(() => document.documentElement.dataset.theme === 'light', null, { timeout: 5000 })
        await ui.pause(400)
      },
    },
    {
      id: 'hours',
      say: {
        ar: 'يُبنى تقويم المواعيد وأوقات الحجز المتاحة على «أيام وأوقات الدوام». انقر على الأيام لتحديدها أو إلغائها في «أيام العمل»، وحدد «بداية الدوام» و«نهاية الدوام».',
        en: 'The appointments calendar and its free slots are built on Working days & hours. Click days under Working days to select or clear them, and set Opens at and Closes at.',
      },
      run: async ({ page, ui }) => {
        const hours = cardWith(page, '[data-qa="save-hours"]')
        await ui.scrollTo(hours)
        await ui.click(hours.locator('.st-day').filter({ hasText: /الجمعة|Friday/ }))
        await ui.highlight(page.locator('[data-qa="work-start"]'), 1200)
        await ui.highlight(page.locator('[data-qa="work-end"]'), 1200)
      },
    },
    {
      id: 'hours-save',
      say: {
        ar: 'اختر «دقة شبكة التقويم»، و«مدة الموعد الافتراضية» التي تُقترح عند حجز موعد جديد، ثم انقر على «حفظ أوقات الدوام»: لهذا القسم زر حفظ خاص به.',
        en: 'Choose the Calendar grid step and the Default appointment length suggested when booking, then click Save working hours: this section has its own save button.',
      },
      run: async ({ page, ui }) => {
        const hours = cardWith(page, '[data-qa="save-hours"]')
        await ui.highlight(hours.locator('select').nth(0), 1300)
        await ui.highlight(hours.locator('select').nth(1), 1300)
        await ui.click(page.locator('[data-qa="save-hours"]'))
        await ui.pause(1200)
      },
    },
    {
      id: 'auto-lock',
      say: {
        ar: 'يقفل دنتورا نفسه بعد مدة من عدم الاستخدام ويطلب رمز الدخول، فتبقى ملفات المرضى محمية. في «القفل التلقائي» افتح قائمة «القفل بعد عدم النشاط» واختر 5 أو 15 أو 30 دقيقة، أو ساعة، أو «دون قفل تلقائي». يظهر اختيارك في «الإعداد الحالي»، والإعداد المبدئي 15 دقيقة.',
        en: 'Dentora locks itself after a period without use and asks for a PIN, so patient files stay safe. Under Auto-lock open Lock after inactivity and choose 5, 15 or 30 minutes, 1 hour, or Never lock automatically. Your choice shows under Current setting; it starts at 15 minutes.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(cardWith(page, '[data-qa="lock-select"]'))
        await ui.click(page.locator('[data-qa="lock-select"]'))
        await ui.pause(1200)
        await page.keyboard.press('ArrowDown')
        await ui.pause(900)
        await page.keyboard.press('Enter')
        await ui.pause(600)
        await ui.highlight(page.locator('[data-qa="lock-current"]'), 1600)
      },
    },
    {
      id: 'about',
      say: {
        ar: 'يعرض «حول البرنامج» رقم إصدار دنتورا، والمنصة، ومكان البيانات، و«رقم الجهاز». حين تراسل الدعم أرسل رقم الإصدار ورقم الجهاز من هذه الصفحة.',
        en: 'About shows your Dentora version, the platform, where the data is kept, and the Device number. When you contact support, include the version and the device number from this page.',
      },
      run: async ({ page, ui }) => {
        await openTab(page, ui, 'about', '[data-qa="app-version"]')
        await ui.highlight(page.locator('.st-about-hero'), 2600)
      },
    },
    {
      id: 'legal',
      say: {
        ar: 'وفي «الخصوصية والشروط» انقر على «سياسة الخصوصية» أو «شروط الاستخدام» أو «تراخيص المصادر المفتوحة» لقراءتها.',
        en: 'Under Privacy & terms click Privacy policy, Terms of use or Open-source licences to read them.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('[data-qa="about-legal"]'))
        await ui.click(page.locator('[data-qa="about-privacy"]'))
        const dialog = page.getByRole('dialog')
        await dialog.waitFor({ timeout: 8000 })
        await ui.pause(1800)
        await ui.click(dialog.getByRole('button', { name: /^(إغلاق|Close)$/ }).first())
        await dialog.waitFor({ state: 'hidden', timeout: 5000 })
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تضبط إعدادات عيادتك. النسخ الاحتياطي والترخيص لهما فصلان خاصان، والتفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you set up your clinic’s settings. Backup and the licence have chapters of their own, and every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(home(page))
        await dashboardShown(page)
      },
    },
  ],
}

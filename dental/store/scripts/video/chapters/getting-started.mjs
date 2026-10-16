// Chapter 1 "Getting started": the first-run setup wizard of a new installation, the daily sign-in and the first
// steps after setup, written from server/guide/topics/getting-started.ts. The recorder gives every chapter the demo
// clinic; this one needs a new installation, so `before` wipes the clinic (keeping this device's activation and
// trial start, as "Erase all data" does) and reloads on the setup wizard. The sign-in part runs on the clinic the
// wizard just made, with two team members added quietly so the "Who is starting now?" screen has a team to show.

const NEXT = '[data-qa="next"]'
const step = (page, name) => page.locator(`.au-step[data-step="${name}"]`)
const nav = (page, to) => page.locator(`.app-sidebar .nav-item[href$="${to}"]`)
const home = page => page.locator('.app-sidebar .nav-item').first()

/** A text per language. */
const pick = (lang, ar, en) => (lang === 'ar' ? ar : en)

/** The wizard's next step has faded in and its animations are over. */
async function stepShown(page, name) {
  await step(page, name).waitFor({ timeout: 10000 })
  await page.waitForFunction(s => {
    const el = document.querySelector(`.au-step[data-step="${s}"]`)
    return el && el.getAnimations({ subtree: true }).every(a => a.playState !== 'running')
  }, name, { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(250)
}

/** The dashboard with its cards drawn (an empty clinic has no appointments: the schedule shows its empty state). */
async function dashboardShown(page) {
  await page.locator('[data-testid="dashboard"]').waitFor({ timeout: 30000 })
  await page.locator('[data-testid="dash-schedule"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(900)
}

/** Two team members (a doctor and a receptionist, PIN 1234) so the sign-in screen shows a team, as in a working clinic. */
async function addTeam(page, lang) {
  await page.evaluate(async (lang) => {
    const db = window.__dentora.db
    const now = new Date().toISOString()
    const sha = async s => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('')
    const salt = 'qa-salt'
    const pinHash = await sha(`${salt}:1234`)
    const team = lang === 'ar'
      ? [{ id: 'u-doc2', name: 'د. ليلى حداد', role: 'doctor', specialty: 'تقويم الأسنان', color: '#7C3AED' }, { id: 'u-rec', name: 'سارة يوسف', role: 'receptionist', color: '#DB2777' }]
      : [{ id: 'u-doc2', name: 'Dr. Laila Haddad', role: 'doctor', specialty: 'Orthodontics', color: '#7C3AED' }, { id: 'u-rec', name: 'Sara Youssef', role: 'receptionist', color: '#DB2777' }]
    for (const u of team) await db.users.put({ ...u, pinHash, pinSalt: salt, active: true, createdAt: now, updatedAt: now })
  }, lang)
  await page.waitForTimeout(400)
}

export const chapter = {
  slug: 'getting-started',

  // a new installation: the clinic wiped (this device's licence, trial start and backup date kept, as "Erase all
  // data" keeps them), nobody signed in, the interface language of the recording, the page on the setup wizard
  before: async ({ page, lang }) => {
    await page.evaluate(async (lang) => {
      const db = window.__dentora.db
      const keep = ['license', 'installedAt', 'lastBackupAt', 'lastSeen']
      await db.transaction('rw', db.tables, async () => {
        for (const t of db.tables) {
          if (t.name === 'settings') {
            const keys = (await t.toCollection().primaryKeys()).filter(k => !keep.includes(String(k)))
            if (keys.length) await t.bulkDelete(keys)
          } else await t.clear()
        }
      })
      sessionStorage.removeItem('dentora.session')
      localStorage.removeItem('dentora.lastUser')
      localStorage.setItem('dentora.lang', lang)
      location.hash = '#/setup'
    }, lang)
    await page.reload()
    await page.locator('[data-lang="ar"]').waitFor({ timeout: 20000 })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(900)
  },

  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل تتعلم كيف تجهّز عيادتك في دنتورا من أول تشغيل، وكيف تدخل إليه كل يوم. بعد تنزيل دنتورا من الموقع أو من الرابط الذي يرسله لك البائع، وتثبيته على ويندوز أو أندرويد، يستقبلك معالج الإعداد الأول.',
        en: 'In this chapter you will learn how to set up your clinic in Dentora on the first run, and how to sign in every day. Once you have downloaded Dentora from the website or from the link the seller sends you, and installed it on Windows or Android, the first-run setup wizard welcomes you.',
      },
      run: async ({ page, ui }) => { await ui.highlight(page.locator('.au-setup'), 2200) },
    },
    {
      id: 'steps',
      say: {
        ar: 'يرشدك المعالج في 5 خطوات: «اللغة»، و«العيادة»، و«العملة والدوام»، و«حسابك»، و«المراجعة». وكل ما تختاره هنا تعدّله لاحقاً من الإعدادات.',
        en: 'The wizard guides you through 5 steps: Language, Clinic, Currency & hours, Your account and Review. Everything you choose here can be changed later in Settings.',
      },
      run: async ({ page, ui }) => { await ui.highlight(page.locator('.au-steps'), 2400) },
    },
    {
      id: 'restore',
      say: {
        ar: 'أعدت تثبيت البرنامج أو انتقلت إلى جهاز جديد؟ انقر على «استعد بياناتك من نسخة احتياطية» واختر ملف النسخة، فتعود العيادة كما كانت بمرضاها ومواعيدها وفواتيرها.',
        en: 'Reinstalled the app or moved to a new device? Click Restore your data from a backup and choose the backup file: the clinic comes back as it was, with its patients, appointments and invoices.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(page.locator('[data-qa="restore"]'))
        await ui.highlight(page.locator('.au-restore'), 2200)
      },
    },
    {
      id: 'language',
      say: {
        ar: 'في خطوة «اللغة» اختر «العربية» أو «English»، فتتغير لغة المعالج فوراً. ثم انقر على «التالي».',
        en: 'On the Language step choose العربية or English: the wizard switches language at once. Then click Next.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.click(page.locator(`[data-lang="${lang}"]`))
        await ui.pause(900)
        await ui.click(page.locator(NEXT))
        await stepShown(page, 'clinic')
      },
    },
    {
      id: 'clinic-name',
      say: {
        ar: 'في خطوة «العيادة» اكتب «اسم العيادة»، وهو الحقل الوحيد المطلوب.',
        en: 'On the Clinic step type the Clinic name, the only required field.',
      },
      run: async ({ page, ui, lang }) => { await ui.type(page.locator('input[name=clinicName]'), pick(lang, 'عيادة الابتسامة لطب الأسنان', 'Smile Dental Clinic')) },
    },
    {
      id: 'clinic-contact',
      say: {
        ar: 'وأضف إن شئت «الهاتف» و«البريد الإلكتروني» و«العنوان»، وارفع شعارك بزر «رفع الشعار». تظهر هذه البيانات في رأس الفواتير والوصفات المطبوعة.',
        en: 'Add the Phone, Email and Address if you like, and add your logo with Upload logo. These details appear at the top of printed invoices and prescriptions.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(page.locator('input[name=clinicPhone]'), '0944 123 456', { delay: 60 })
        await ui.type(page.locator('input[name=clinicAddress]'), pick(lang, 'دمشق — المزة، شارع الجلاء', 'Al-Jalaa St, Mezzeh, Damascus'), { delay: 55 })
        await ui.moveTo(page.locator('.au-logo-actions .btn').first())
        await ui.highlight(page.locator('.au-logo-actions .btn').first(), 1200)
      },
    },
    {
      id: 'money',
      say: {
        ar: 'انقر على «التالي». في خطوة «العملة والدوام» اختر «العملة» و«الكسور»، وتأكد من «بلد العيادة» و«أسماء الأشهر بالعربية».',
        en: 'Click Next. On the Currency & hours step choose the Currency and the Decimals, and check the Clinic country and the Arabic month names.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator(NEXT))
        await stepShown(page, 'money')
        await ui.moveTo(page.locator('select[name=currency]'))
        await ui.highlight(page.locator('select[name=currency]'), 1200)
        await ui.highlight(page.locator('.au-dec'), 1000)
        await ui.moveTo(page.locator('[data-qa="setup-country"]'))
        await ui.highlight(page.locator('[data-qa="setup-country"]'), 1200)
        await ui.highlight(page.locator('[data-qa="setup-months"]'), 1200)
      },
    },
    {
      id: 'hours',
      say: {
        ar: 'ثم حدّد «أيام الدوام» وساعاته، «من الساعة» و«إلى الساعة»، و«خانة المواعيد في التقويم». واكتب النسبة في «ضريبة على الفواتير» إن كانت عيادتك تفرض ضريبة، أو اتركها فارغة.',
        en: 'Then set your Working days and hours, Opens at and Closes at, and the Calendar time slot. Fill in Tax on invoices if your clinic charges tax, or leave it empty.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(page.locator('.au-days'))
        await ui.highlight(page.locator('.au-days'), 1400)
        await ui.highlight(page.locator('input[name=workStart]'), 900)
        await ui.highlight(page.locator('input[name=workEnd]'), 900)
        await ui.highlight(page.locator('select[name=slot]'), 1000)
        await ui.moveTo(page.locator('#setup-tax'))
        await ui.highlight(page.locator('#setup-tax'), 1200)
      },
    },
    {
      id: 'account',
      say: {
        ar: 'انقر على «التالي». في خطوة «حسابك» اختر «اللقب» واكتب «اسمك الكامل»، وأضف إن شئت «الاختصاص» و«الهاتف». هذا حساب مدير العيادة، وله كل الصلاحيات.',
        en: 'Click Next. On the Your account step choose your Title and type Your full name; add your Specialty and Phone if you like. This is the clinic admin’s account, with every permission.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.click(page.locator(NEXT))
        await stepShown(page, 'owner')
        await ui.highlight(page.locator('select[name=ownerTitle]'), 900)
        await ui.type(page.locator('input[name=ownerName]'), pick(lang, 'أحمد الخطيب', 'Ahmad Al-Khatib'))
        await ui.type(page.locator('input[name=ownerSpecialty]'), pick(lang, 'طب الأسنان العام', 'General dentistry'), { delay: 60 })
      },
    },
    {
      id: 'pin',
      say: {
        ar: 'اختر «رمز الدخول (PIN)» من 4 إلى 6 أرقام، واكتبه مرة ثانية في «أعد كتابة الرمز»، ثم انقر على «التالي».',
        en: 'Choose a Sign-in PIN of 4 to 6 digits, type it again in Repeat the PIN, then click Next.',
      },
      run: async ({ page, ui }) => {
        await ui.type(page.locator('#owner-pin'), '1234', { delay: 140 })
        await ui.type(page.locator('#owner-pin2'), '1234', { delay: 140 })
        await ui.click(page.locator(NEXT))
        await stepShown(page, 'review')
      },
    },
    {
      id: 'review',
      say: {
        ar: 'في خطوة «المراجعة» راجع ما أدخلته. لتصحيح شيء انقر على «تعديل» في البطاقة التي تخصه.',
        en: 'On the Review step check what you entered. To correct something, click Edit on its card.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(page.locator('.au-review'), 1600)
        const edit = page.locator('.au-review-card').first().locator('.au-review-head .au-link')
        await ui.moveTo(edit)
        await ui.highlight(edit, 1200)
      },
    },
    {
      id: 'terms',
      say: {
        ar: 'ضع علامة على «قرأت شروط الاستخدام وسياسة الخصوصية وأوافق عليهما»، فلا يتابع المعالج دونها. وتحت المربع روابط الشروط والخصوصية وتراخيص المصادر المفتوحة لقراءتها.',
        en: 'Tick I have read and accept the terms of use and the privacy policy: the wizard does not go on without it. The links under the box open the terms, the privacy policy and the open-source licences.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('[data-qa="setup-terms"] .lg-accept'))
        await ui.highlight(page.locator('[data-qa="setup-terms"]'), 1600)
      },
    },
    {
      id: 'start',
      say: {
        ar: 'انقر على «ابدأ العمل». يجهّز دنتورا عيادتك ويدخلك مباشرة إلى الشاشة الرئيسية، وتُضاف تلقائياً قائمة إجراءات بأسعار مقترحة وقائمة أدوية.',
        en: 'Click Start working. Dentora prepares your clinic and takes you straight to the dashboard, and a list of procedures with suggested prices and a list of drugs are added for you.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator(NEXT))
        await dashboardShown(page)
        await ui.highlight(page.locator('.rp-dash-kpis'), 1800)
      },
    },
    {
      id: 'sign-out',
      say: {
        ar: 'يطلب دنتورا رمز الدخول في كل مرة تفتحه فيها وبعد كل قفل. لنجرّب: انقر على اسمك أسفل القائمة، ثم على «تسجيل الخروج».',
        en: 'Dentora asks for a PIN every time it opens and after every lock. Let’s try it: click your name at the bottom of the sidebar, then Sign out.',
      },
      run: async ({ page, ui, lang }) => {
        await addTeam(page, lang)
        await ui.pause(1500)
        await ui.click(page.locator('.sidebar-user'))
        await ui.click(page.getByRole('menuitem', { name: /^(تسجيل الخروج|Sign out)$/ }))
        await page.locator('.au-tile').first().waitFor({ timeout: 15000 })
        await page.waitForTimeout(500)
      },
    },
    {
      id: 'who',
      say: {
        ar: 'في شاشة «من يبدأ العمل الآن؟» انقر على اسمك. ومع حساب واحد، أو إن كنت آخر من دخل من هذا الجهاز، تظهر لوحة الأرقام مباشرة.',
        en: 'On Who is starting now? click your name. With one account, or if you were the last to sign in on this device, the keypad shows straight away.',
      },
      run: async ({ page, ui }) => {
        await ui.highlight(page.locator('.user-pick'), 1800)
        await ui.click(page.locator('.au-tile', { hasText: /أحمد الخطيب|Ahmad Al-Khatib/ }))
        await page.locator('.pin-pad').waitFor({ timeout: 10000 })
      },
    },
    {
      id: 'switch-forgot',
      say: {
        ar: 'ليدخل شخص آخر انقر على «تبديل المستخدم». وإن نسيت رمزك انقر على «نسيت رمز الدخول؟» لترى ما تفعله.',
        en: 'For someone else to sign in, click Switch user. If you forgot your PIN, click Forgot your PIN? to see what to do.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(page.locator('[data-qa="change-user"]'))
        await ui.highlight(page.locator('[data-qa="change-user"]'), 1300)
        await ui.moveTo(page.locator('[data-qa="forgot"]'))
        await ui.highlight(page.locator('[data-qa="forgot"]'), 1300)
      },
    },
    {
      id: 'type-pin',
      say: {
        ar: 'اكتب رمزك على لوحة الأرقام أو من لوحة المفاتيح. يدخل البرنامج وحده حين يكتمل الرمز، أو انقر على «دخول».',
        en: 'Type your PIN on the keypad or the keyboard. Dentora signs you in as soon as the PIN is complete, or click Sign in.',
      },
      run: async ({ page, ui }) => {
        for (const k of ['1', '2', '3', '4']) await ui.click(page.locator('.pin-pad button.num', { hasText: new RegExp(`^${k}$`) }))
        await dashboardShown(page)
      },
    },
    {
      id: 'first-settings',
      say: {
        ar: 'عيادتك جاهزة للعمل، وهذه الخطوات تجعلها جاهزة تماماً. افتح «الإعدادات» وأكمل بيانات العيادة: الشعار، والاسم بالإنجليزية، ووسائل التواصل.',
        en: 'Your clinic is ready to work, and these steps make it fully ready. Open Settings and complete the clinic details: logo, English name and contacts.',
      },
      run: async ({ page, ui }) => {
        await ui.click(nav(page, '/settings'))
        await page.locator('[data-qa="tab-clinic"] .card').first().waitFor({ timeout: 15000 })
        await page.waitForTimeout(400)
        await ui.highlight(page.locator('[data-qa="tab-clinic"] .card').first(), 2000)
      },
    },
    {
      id: 'first-procedures',
      say: {
        ar: 'افتح «قائمة الإجراءات» وراجع الأسعار المقترحة، وعدّلها لتطابق أسعار عيادتك.',
        en: 'Open Procedures and review the suggested prices; change them to match your clinic.',
      },
      run: async ({ page, ui }) => {
        await ui.click(nav(page, '/procedures'))
        await page.locator('.tr-flat-table').first().waitFor({ timeout: 15000 })
        await page.waitForTimeout(400)
        await ui.highlight(page.locator('.tr-flat-table').first(), 1800)
      },
    },
    {
      id: 'first-staff',
      say: {
        ar: 'افتح «الفريق» وأضف الأطباء والمساعدين وموظفي الاستقبال، لكل منهم دوره ورمز دخوله.',
        en: 'Open Staff and add your doctors, assistants and receptionists, each with a role and a PIN.',
      },
      run: async ({ page, ui }) => {
        await ui.click(nav(page, '/staff'))
        await page.locator('.au-staff-grid').first().waitFor({ timeout: 15000 })
        await page.waitForTimeout(400)
        await ui.highlight(page.locator('.au-staff-grid').first(), 1800)
      },
    },
    {
      id: 'first-patient',
      say: {
        ar: 'ثم عُد إلى «الرئيسية»، وانقر على «مريض جديد» لفتح أول ملف، وعلى «موعد جديد» لحجز أول موعد.',
        en: 'Then go back to the Dashboard, click New patient to open your first patient file, and New appointment to book your first appointment.',
      },
      run: async ({ page, ui }) => {
        await ui.click(home(page))
        await dashboardShown(page)
        await ui.click(page.locator('[data-testid="dash-new-patient"]'))
        const dialog = page.getByRole('dialog')
        await dialog.waitFor({ timeout: 10000 })
        await ui.highlight(dialog, 1400)
        await ui.click(dialog.locator('.modal-x'))
        await dialog.waitFor({ state: 'hidden', timeout: 5000 })
        await ui.moveTo(page.locator('[data-testid="dash-new-apt"]'))
        await ui.highlight(page.locator('[data-testid="dash-new-apt"]'), 1200)
      },
    },
    {
      id: 'first-backup',
      say: {
        ar: 'وفي نهاية اليوم احفظ أول نسخة احتياطية من «الإعدادات» ثم «النسخ الاحتياطي». ولتتجوّل في البرنامج أولاً، حمّل عيادة تجريبية كاملة بزر «تحميل بيانات تجريبية»، لكن جرّبها قبل العمل الحقيقي.',
        en: 'At the end of the day save your first backup from Settings, then Backup & data. To look around first, load a complete demo clinic with Load demo data, but try it before real work.',
      },
      run: async ({ page, ui }) => {
        await ui.click(nav(page, '/settings'))
        await page.locator('.st-nav [data-tab="backup"]').waitFor({ timeout: 15000 })
        await ui.click(page.locator('.st-nav [data-tab="backup"]'))
        await page.locator('[data-qa="export-backup"]').waitFor({ timeout: 15000 })
        await page.waitForTimeout(400)
        await ui.moveTo(page.locator('[data-qa="export-backup"]'))
        await ui.highlight(page.locator('[data-qa="export-backup"]'), 1600)
        await ui.moveTo(page.locator('[data-qa="load-demo"]'))
        await ui.highlight(page.locator('[data-qa="load-demo"]'), 1600)
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا ثبّت دنتورا وجهّزت عيادتك ودخلت إليها. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you install Dentora, set up your clinic and sign in. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(home(page))
        await dashboardShown(page)
      },
    },
  ],
}

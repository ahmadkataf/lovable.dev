// Chapter 15 "Staff and permissions": the Staff page and its cards, the roles and the permissions matrix, adding a
// member, the member menu (delete dialog, deactivating, a new PIN), locking the screen, the sign-in screen with
// "Forgot your PIN?" and the reset code, signing in with the PIN pad, the sign-in log, the phone. Written from
// server/guide/topics/staff.ts, in its order. Runs on the demo clinic as the admin (PIN 1234, stored by seedAndLogin
// the old way, so the pad does not submit by itself: the Sign in button is clicked), from the dashboard; it adds an
// assistant (Rana Suleiman, PIN 2468) and sets her a new PIN, nothing else is changed.

const nav = (page, to) => page.locator(`.app-sidebar .nav-item[href$="${to}"]`)
const home = page => page.locator('.app-sidebar .nav-item').first()
const pick = (lang, ar, en) => (lang === 'ar' ? ar : en)
const btn = (scope, ar, en) => scope.getByRole('button', { name: new RegExp(`^(${ar}|${en})$`) })
const menuItem = (page, ar, en) => page.locator('.menu-portal').getByRole('menuitem', { name: new RegExp(`^(${ar}|${en})$`) })
const modal = page => page.locator('.modal')
const card = (page, id) => page.locator(`[data-qa="staff-grid"] [data-user="${id}"]`)
const newCard = page => page.locator('[data-qa="staff-grid"] .au-member').filter({ hasText: /رنا سليمان|Rana Suleiman/ }).first()
const matrix = page => page.locator('[data-qa="matrix"]')

async function dashboardShown(page) {
  await page.locator('[data-testid="dashboard"]').waitFor({ timeout: 30000 })
  await page.locator('[data-testid="dash-schedule"] [data-testid="dash-apt"]').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(600)
}
async function staffShown(page) {
  await page.locator('[data-qa="staff-grid"] .au-member').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
}
async function closeModal(page, ui) {
  if (await modal(page).count()) {
    await ui.click(btn(page.locator('.modal-footer'), 'إلغاء', 'Cancel'))
    await modal(page).waitFor({ state: 'hidden', timeout: 10000 })
  }
}

export const chapter = {
  slug: 'staff',
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل تضيف فريقك في دنتورا: لكل عضو رمز دخول ودور يحدد ما يراه. افتح «الفريق» من القائمة الجانبية، في قسم «الإدارة».',
        en: 'In this chapter you add your team in Dentora: each member gets a PIN and a role that decides what they see. Open Staff from the sidebar, in the Management section.',
      },
      run: async ({ page, ui }) => {
        await dashboardShown(page)
        await ui.pause(2500)
        await ui.click(nav(page, '/staff'))
        await staffShown(page)
      },
    },
    {
      id: 'cards',
      say: {
        ar: 'لكل عضو بطاقة فيها صورته بلونه، واسمه ودوره واختصاصه وهاتفه، ووقت «آخر دخول». وعلى بطاقتك أنت شارة «أنت».',
        en: 'Each member has a card with their avatar in their colour, their name, role, specialty and phone, and their Last sign-in. Your own card carries a You badge.',
      },
      run: async ({ page, ui }) => {
        await ui.point(page.locator('[data-qa="staff-grid"]'), 1200)
        await ui.point(card(page, 'u-doc2').locator('.au-member-top'), 1100)
        await ui.point(card(page, 'u-doc2').locator('.au-member-foot'), 900)
        await ui.point(card(page, 'u-admin').locator('.au-member-name'), 1100)
      },
    },
    {
      id: 'switch-filter',
      say: {
        ar: 'في أسفل كل بطاقة مفتاح يوقف الحساب أو يفعّله بنقرة، وفي أعلاها زر الخيارات. وفوق البطاقات تصفية: «الكل» و«المفعّلون» و«الموقوفون».',
        en: 'At the bottom of each card a switch deactivates or activates the account in one click, and the options button sits at the top. Above the cards a filter shows All, Active or Deactivated members.',
      },
      run: async ({ page, ui }) => {
        await ui.point(card(page, 'u-doc2').locator('[data-qa="active-switch"]'), 1100)
        await ui.point(card(page, 'u-doc2').locator('[data-qa="member-menu"]'), 900)
        await ui.click(page.locator('.au-staff-toolbar').getByRole('tab', { name: /المفعّلون|Active/ }))
        await ui.pause(900)
        await ui.click(page.locator('.au-staff-toolbar').getByRole('tab', { name: /^(الكل|All)/ }))
        await ui.pause(300)
      },
    },
    {
      id: 'matrix',
      say: {
        ar: 'تحت البطاقات لوحة «الصلاحيات حسب الدور»: لكل عضو دور واحد من أربعة يحدد الصفحات التي تظهر له. «مدير» له كل الصلاحيات، ومنها المصروفات والإعدادات والفريق.',
        en: 'Under the cards is the Permissions by role panel: every member has one of four roles, which decides which pages they see. Admin has every permission, including expenses, settings and the team.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(matrix(page))
        await ui.point(matrix(page).locator('.card-header'), 1100)
        await ui.point(matrix(page).locator('thead th').nth(1), 1500)
      },
    },
    {
      id: 'roles',
      say: {
        ar: '«طبيب» يعالج ويكتب الوصفات ويصدر الفواتير ويرى التقارير، دون الإعدادات. «مساعد»: المرضى والمواعيد والملف السريري والمخزون، دون الفواتير. «استقبال»: المرضى والمواعيد والفواتير والمخزون، دون الملف السريري.',
        en: 'Doctor treats, writes prescriptions, issues invoices and sees reports, with no settings. Assistant: patients, appointments, the clinical record and inventory, no billing. Receptionist: patients, appointments, invoices and inventory, no clinical record.',
      },
      run: async ({ page, ui }) => {
        await ui.point(matrix(page).locator('thead th').nth(2), 1400)
        await ui.point(matrix(page).locator('thead th').nth(3), 1400)
        await ui.point(matrix(page).locator('thead th').nth(4), 1400)
      },
    },
    {
      id: 'roles-fixed',
      say: {
        ar: 'الصفحة التي لا يملك الدور صلاحيتها تختفي من قائمته. والأدوار ثابتة كما في الجدول؛ لتوسيع صلاحيات أحد غيّر دوره.',
        en: 'A page the role has no permission for disappears from that member’s menu. The roles are fixed as in the table; to give someone more access, change their role.',
      },
      run: async ({ page, ui }) => {
        await ui.point(matrix(page).locator('tbody tr').nth(6), 1500)
        await ui.point(matrix(page).locator('tbody tr').nth(8), 1200)
      },
    },
    {
      id: 'add-open',
      say: {
        ar: 'لإضافة عضو جديد انقر على «إضافة عضو» أعلى الصفحة.',
        en: 'To add a team member, click Add member at the top of the page.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.page-header'))
        await ui.click(page.locator('[data-qa="add-member"]'))
        await modal(page).waitFor({ timeout: 10000 })
        await ui.pause(500)
      },
    },
    {
      id: 'add-name',
      say: {
        ar: 'اكتب «الاسم الكامل»، واختر «اللقب»: «د.» للطبيب و«بدون لقب» لبقية الأدوار. وأضف إن شئت «الاختصاص» و«الهاتف» و«البريد الإلكتروني».',
        en: 'Type the Full name and choose the Title: Dr. for a doctor, No title for the other roles. Add the Specialty, Phone and Email if you like.',
      },
      run: async ({ page, ui, lang }) => {
        const m = modal(page)
        await ui.type(m.locator('input[name="name"]'), pick(lang, 'رنا سليمان', 'Rana Suleiman'), { delay: 70 })
        await ui.point(m.locator('select[name="title"]'), 900)
        await ui.type(m.locator('input[name="specialty"]'), pick(lang, 'مساعدة طبيب أسنان', 'Dental assistant'), { delay: 55 })
        await ui.type(m.locator('input[name="phone"]'), '0933 456 789', { delay: 55 })
      },
    },
    {
      id: 'add-role',
      say: {
        ar: 'اختر «الدور». يظهر تحته وصف الدور، وبعد «يستطيع العمل على» الأقسام التي يفتحها.',
        en: 'Choose the Role. A box under it describes the role and lists, under Can work on, the areas it opens.',
      },
      run: async ({ page, ui }) => {
        // the native list: a click opens it, ArrowDown moves from Doctor to Assistant, Enter picks (the list is not filmed)
        await ui.click(modal(page).locator('select[name="role"]'))
        await ui.pause(350)
        await page.keyboard.press('ArrowDown')
        await ui.pause(200)
        await page.keyboard.press('Enter')
        await ui.pause(500)
        await ui.point(modal(page).locator('[data-qa="role-box"]'), 1600)
      },
    },
    {
      id: 'add-colour',
      say: {
        ar: 'اختر لوناً للعضو: يميّز مواعيده في التقويم وصورته في البرنامج، ويقترح دنتورا لوناً لا يستخدمه أي عضو مفعّل.',
        en: 'Pick a colour for the member: it marks their appointments in the calendar and their avatar in the app, and Dentora suggests one no active member uses yet.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(modal(page).locator('.au-colors'))
        await ui.point(modal(page).locator('.au-colors'), 1000)
        await ui.click(modal(page).locator('.au-colors button').nth(5))
        await ui.pause(500)
      },
    },
    {
      id: 'add-pin',
      say: {
        ar: 'اكتب «رمز الدخول» من 4 إلى 6 أرقام، ثم «أعد كتابة الرمز»، وانقر على «إضافة العضو». ثم أبلغ العضو برمزه.',
        en: 'Type a Sign-in PIN of 4 to 6 digits, then Repeat the PIN, and click Add member. Then tell the member their PIN.',
      },
      run: async ({ page, ui }) => {
        await ui.type(page.locator('#staff-pin'), '2468', { delay: 110 })
        await ui.type(page.locator('#staff-pin2'), '2468', { delay: 110 })
        await ui.click(page.locator('[data-qa="save-member"]'))
        await modal(page).waitFor({ state: 'hidden', timeout: 10000 })
        await ui.pause(900)
      },
    },
    {
      id: 'new-card',
      say: {
        ar: 'ظهر العضو الجديد بين البطاقات، ويظهر فوراً في شاشة الدخول. ولا يتكرر الاسم نفسه لعضوين.',
        en: 'The new member now has a card, and shows on the sign-in screen at once. Two members cannot have the same name.',
      },
      run: async ({ page, ui }) => {
        await staffShown(page)
        await ui.moveTo(newCard(page).locator('.au-member-name'))
        await ui.point(newCard(page), 1800)
      },
    },
    {
      id: 'menu',
      say: {
        ar: 'في قائمة الخيارات على بطاقة العضو: «تعديل» لتغيير بياناته أو دوره أو لونه، و«تعيين رمز دخول جديد»، و«إيقاف الحساب»، و«حذف العضو».',
        en: 'The options menu on a member’s card holds Edit to change their details, role or colour, Set a new PIN, Deactivate account and Delete member.',
      },
      run: async ({ page, ui }) => {
        await ui.click(card(page, 'u-doc2').locator('[data-qa="member-menu"]'))
        const menu = page.locator('.menu-portal')
        await menu.waitFor({ timeout: 10000 })
        await ui.pause(400)
        const items = menu.locator('.menu-item')
        const n = await items.count()
        for (let i = 0; i < n; i++) await ui.moveTo(items.nth(i), { ms: 340 })
        await ui.pause(600)
      },
    },
    {
      id: 'delete-dialog',
      say: {
        ar: 'الحذف نهائي. وإن كان للعضو سجلات تخبرك نافذة الحذف بعددها، لأنها ستبقى بلا اسمه، وتنصحك بالإيقاف بدلاً منه.',
        en: 'Deleting is permanent. If the member has records, the delete dialog tells you how many would lose their name, and recommends deactivating instead.',
      },
      run: async ({ page, ui }) => {
        await ui.click(menuItem(page, 'حذف العضو', 'Delete member'))
        await modal(page).waitFor({ timeout: 10000 })
        await ui.pause(500)
        await ui.point(modal(page).locator('.modal-body'), 1800)
      },
    },
    {
      id: 'deactivate',
      say: {
        ar: 'حين يترك أحدٌ العيادة أوقف حسابه بدل حذفه: لا يستطيع الدخول بعدها، ويبقى اسمه على مواعيده وفواتيره، وتعيده متى شئت. ولا تستطيع إيقاف حسابك أنت، ولا بد من بقاء مدير مفعّل.',
        en: 'When someone leaves the clinic, deactivate their account instead: they can no longer sign in, their name stays on their appointments and invoices, and you can bring them back at any time. You cannot deactivate your own account, and one active admin must remain.',
      },
      run: async ({ page, ui }) => {
        await closeModal(page, ui)
        await ui.point(card(page, 'u-doc2').locator('[data-qa="active-switch"]'), 1200)
        await ui.point(card(page, 'u-admin').locator('[data-qa="active-switch"]'), 1200)
      },
    },
    {
      id: 'reset-pin',
      say: {
        ar: 'إن نسي عضو رمزه فالحل عند المدير: من قائمة بطاقته اختر «تعيين رمز دخول جديد»، واكتب الرمز الجديد مرتين، وانقر على «حفظ الرمز الجديد». يدخل به من الدخول القادم.',
        en: 'If a member forgets their PIN, the admin fixes it: from the menu on their card choose Set a new PIN, type the new PIN twice and click Save new PIN. They use it from their next sign-in.',
      },
      run: async ({ page, ui }) => {
        await ui.click(newCard(page).locator('[data-qa="member-menu"]'))
        await page.locator('.menu-portal').waitFor({ timeout: 10000 })
        await ui.pause(300)
        await ui.click(menuItem(page, 'تعيين رمز دخول جديد', 'Set a new PIN'))
        await modal(page).waitFor({ timeout: 10000 })
        await ui.type(page.locator('#reset-pin'), '1357', { delay: 110 })
        await ui.type(page.locator('#reset-pin2'), '1357', { delay: 110 })
        await ui.click(page.locator('[data-qa="save-pin"]'))
        await modal(page).waitFor({ state: 'hidden', timeout: 10000 })
        await ui.pause(800)
      },
    },
    {
      id: 'lock',
      say: {
        ar: 'حين تبتعد عن الجهاز اقفل الشاشة: انقر على اسمك في أسفل القائمة الجانبية واختر «قفل الشاشة». ويقفل دنتورا نفسه بعد 15 دقيقة من عدم الاستخدام ما لم يغيّرها المدير.',
        en: 'When you step away from the device, lock the screen: click your name at the bottom of the sidebar and choose Lock screen. Dentora also locks itself after 15 minutes without use, unless the admin changes that.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.sidebar-user'))
        await page.locator('.menu-portal').waitFor({ timeout: 10000 })
        await ui.pause(700)
        await ui.click(menuItem(page, 'قفل الشاشة', 'Lock screen'))
        await page.locator('.au-login-card').waitFor({ timeout: 15000 })
        await ui.pause(500)
      },
    },
    {
      id: 'sign-in-screen',
      say: {
        ar: 'هذه شاشة الدخول: يختار كل عضو اسمه ويدخل برمزه، فيرى ما يسمح به دوره. وفي نهاية الدوام اختر «تسجيل الخروج» من القائمة نفسها. اختر اسمك.',
        en: 'This is the sign-in screen: each member picks their name and signs in with their PIN, and sees what their role allows. At the end of your shift choose Sign out from the same menu. Pick your name.',
      },
      run: async ({ page, ui }) => {
        // the screen remembers the last member who signed in here and opens on their keypad: back to the names first
        if (await page.locator('[data-qa="change-user"]').isVisible()) await ui.click(page.locator('[data-qa="change-user"]'))
        await ui.point(page.locator('.user-pick'), 1500)
        await ui.click(page.locator('.au-tile[data-user="u-admin"]'))
        await page.locator('.pin-pad').waitFor({ timeout: 10000 })
        await ui.pause(400)
      },
    },
    {
      id: 'forgot',
      say: {
        ar: 'وإن نسي المدير الوحيد رمزه: انقر على «نسيت رمز الدخول؟»، وانسخ «رقم الجهاز» بزر النسخ، وأرسله إلى الجهة التي اشتريت منها البرنامج.',
        en: 'If the clinic’s only admin forgot their PIN: click Forgot your PIN?, copy the Device number with the copy button, and send it to whoever supplied Dentora.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('[data-qa="forgot"]'))
        await page.locator('[data-qa="forgot-box"]').waitFor({ timeout: 10000 })
        await ui.pause(300)
        await ui.point(page.locator('[data-qa="login-device"]'), 1400)
        await ui.point(page.locator('.au-device-row button'), 900)
      },
    },
    {
      id: 'reset-code',
      say: {
        ar: 'حين يصلك رمز إعادة التعيين انقر على «لديّ رمز إعادة تعيين»، والصق الرسالة كما وصلتك، ثم «تحقق من الرمز»، واختر رمز دخول جديداً. يعمل الرمز على هذا الجهاز وحده ومرة واحدة.',
        en: 'When the reset code arrives, click I have a reset code, paste the message as you received it, then Check the code, and choose a new PIN. The code works on this device only and only once.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('[data-qa="have-reset-code"]'))
        await modal(page).waitFor({ timeout: 10000 })
        await ui.pause(400)
        await ui.point(page.locator('[data-qa="reset-code"]'), 1400)
        await ui.point(page.locator('[data-qa="reset-check"]'), 1000)
      },
    },
    {
      id: 'pin-entry',
      say: {
        ar: 'الآن أدخل رمزك على لوحة الأرقام، أو من لوحة المفاتيح، ثم انقر على «دخول». وبعد 5 محاولات خاطئة تتوقف لوحة الأرقام 30 ثانية، ثم مدداً أطول.',
        en: 'Now enter your PIN on the keypad, or on the keyboard, and click Sign in. After 5 wrong attempts the keypad pauses for 30 seconds, then for longer.',
      },
      run: async ({ page, ui }) => {
        await closeModal(page, ui)
        for (const d of ['1', '2', '3', '4']) await ui.click(page.locator('.pin-pad button.num', { hasText: d }))
        await ui.click(page.locator('[data-qa="submit"]'))
        await staffShown(page)
      },
    },
    {
      id: 'sign-in-log',
      say: {
        ar: 'عدت إلى الصفحة التي كنت فيها. وفي «سجل الدخول» أسفل صفحة الفريق آخر 30 عملية دخول، مجموعة حسب اليوم: ها هو دخولك الآن.',
        en: 'You are back on the page you were on. The Sign-in log at the bottom of the Staff page lists the last 30 sign-ins, grouped by day: there is yours, just now.',
      },
      run: async ({ page, ui }) => {
        const log = page.locator('[data-qa="signin-log"]')
        await ui.scrollTo(log)
        await log.locator('.list-item').first().waitFor({ timeout: 10000 })
        await ui.point(log.locator('.list-item').first(), 1800)
      },
    },
    {
      id: 'phone',
      say: {
        ar: 'على الهاتف المس الدائرة التي تحمل الحرفين الأولين من اسمك أعلى الشاشة، أو افتح «المزيد» حيث زرّا القفل والخروج بجانب اسمك.',
        en: 'On a phone, tap the circle with your initials at the top of the screen, or open More, where the lock and sign-out buttons sit next to your name.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.moveTo(page.locator('.sidebar-user'))
        await ui.callout(pick(lang, 'على الهاتف: الدائرة أعلى الشاشة أو «المزيد»', 'On a phone: the circle at the top, or More'), { ms: 2200 })
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تضيف فريقك وتضبط أدواره ورموز دخوله. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you add your team and set their roles and PINs. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(home(page))
        await dashboardShown(page)
      },
    },
  ],
}

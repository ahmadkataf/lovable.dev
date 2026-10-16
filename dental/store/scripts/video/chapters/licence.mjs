// Chapter 17 "Activating your licence": the trial and its bar, the Licence page (status, device number, the
// activation code or licence key field, the WhatsApp request and the three steps), the website's activation page,
// one device per key, a new device. Written from docs/LICENCE-KEYS.md, src/features/settings/LicenseTab.tsx and
// src/i18n/modules/license.ts (the guide's licence topic was still being written). Runs on the demo clinic, which is
// on its trial, as the admin, from the dashboard. For this chapter alone the trial bar the recorder hides is shown
// again (the chapter is about the trial), and the seller's price lines are hidden (the videos also play inside a
// copy installed from Google Play, which shows no price). Nothing is activated: a key is typed to show how the field
// recognises it and removed again; Activate is never pressed.

const home = page => page.locator('.app-sidebar .nav-item').first()
const pick = (lang, ar, en) => (lang === 'ar' ? ar : en)
const btn = (scope, ar, en) => scope.getByRole('button', { name: new RegExp(`^(${ar}|${en})$`) })
const status = page => page.locator('[data-qa="license-status"]')
/** The settings card that holds `inner`. */
const cardWith = (page, inner) => page.locator('.st-form .card').filter({ has: page.locator(inner) }).first()
/** An example key in the key alphabet (no 0, O, 1 or I): it only shows how the field recognises a key. */
const EXAMPLE_KEY = 'ABCD-EFGH-JKLM-NPQR'

async function dashboardShown(page) {
  await page.locator('[data-testid="dashboard"]').waitFor({ timeout: 30000 })
  await page.locator('[data-testid="dash-schedule"] [data-testid="dash-apt"]').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(600)
}

export const chapter = {
  slug: 'licence',
  before: async ({ page }) => {
    await page.addStyleTag({ content: '[data-qa="trial-bar"]{display:flex!important} [data-qa="price-top"],[data-qa="price"]{display:none!important}' })
  },
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل تنتقل من النسخة التجريبية إلى نسخة مفعّلة من دنتورا: تعرف ما تحتاجه من البائع، وأين تُدخله في البرنامج. في النسخة التجريبية يظهر شريط أعلى الشاشة بالأيام المتبقية، وزر «تفعيل الآن» يأخذك إلى صفحة الترخيص.',
        en: 'In this chapter you go from the trial to an activated copy of Dentora: what you need from the seller, and where to enter it in the app. During the trial a bar at the top of the screen shows the days left, and its Activate now button takes you to the Licence page.',
      },
      run: async ({ page, ui }) => {
        await dashboardShown(page)
        await ui.pause(2500)
        await ui.point(page.locator('[data-qa="trial-bar"]'), 1600)
        await ui.click(btn(page.locator('[data-qa="trial-bar"]'), 'تفعيل الآن', 'Activate now'))
        await status(page).waitFor({ timeout: 15000 })
        await page.locator('[data-qa="device-number"]').waitFor({ timeout: 15000 })
        await ui.pause(500)
      },
    },
    {
      id: 'where',
      say: {
        ar: 'تصل إلى الصفحة نفسها من «الإعدادات» ثم «الترخيص»، وعلى التبويب شارة «تجريبي» ما دامت النسخة غير مفعّلة.',
        en: 'You reach the same page from Settings, then Licence; the tab carries a Trial badge as long as the copy is not activated.',
      },
      run: async ({ page, ui }) => {
        await ui.point(page.locator('.st-nav [data-tab="license"]'), 1800)
      },
    },
    {
      id: 'status',
      say: {
        ar: 'في الأعلى حالة نسختك: «نسخة تجريبية»، مع الأيام المتبقية وتاريخ انتهاء الفترة. كل المزايا متاحة خلالها، ففعّل نسختك قبل انتهائها حتى لا يتوقف العمل.',
        en: 'At the top is your copy’s status: Trial version, with the days left and the date the trial ends. Every feature is available during the trial, so activate before it ends and your work is never interrupted.',
      },
      run: async ({ page, ui }) => {
        await ui.point(status(page).locator('.st-hero'), 1300)
        await ui.point(page.locator('[data-qa="trial-progress"]'), 1600)
      },
    },
    {
      id: 'after-trial',
      say: {
        ar: 'وإن انتهت الفترة دون تفعيل يصبح البرنامج في وضع القراءة فقط: تعرض كل البيانات وتطبعها وتصدّر نسخة احتياطية، لكن الإضافة والتعديل يتوقفان حتى التفعيل. وبياناتك محفوظة، لا يُحذف منها شيء.',
        en: 'If the trial ends without activation, the app becomes read-only: you can view and print everything and export a backup, but adding and editing are paused until activation. Your data is safe and nothing is deleted.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(status(page).locator('.st-hero-title'))
        await ui.point(status(page).locator('.st-hero-desc'), 1800)
      },
    },
    {
      id: 'device',
      say: {
        ar: 'في بطاقة «رقم الجهاز» رقم ثابت خاص بهذا الجهاز. انقر على «نسخ الرقم» لنسخه، وأرسله مع اسم العيادة إلى البائع ليُصدر لك رمز التفعيل. وتجد الرقم نفسه في «حول البرنامج».',
        en: 'The Device number card shows a fixed number for this device. Click Copy number to copy it, and send it with your clinic’s name to the seller, who issues your activation code. The same number is shown under About.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(cardWith(page, '[data-qa="device-number"]'))
        await ui.point(page.locator('[data-qa="device-number"]'), 1400)
        await ui.click(page.locator('[data-qa="copy-device"]'))
        await page.locator('.toast').first().waitFor({ timeout: 10000 })
        await ui.pause(1000)
      },
    },
    {
      id: 'whatsapp',
      say: {
        ar: 'أسرع طريقة: زر «اطلب كود التفعيل عبر واتساب» في أعلى الصفحة. تُكتب الرسالة برقم جهازك واسم العيادة، فقط أرسلها، ويصلك الكود على واتساب، عادةً خلال اليوم نفسه.',
        en: 'The quickest way is the Request your activation code on WhatsApp button at the top of the page. The message is written with your device number and clinic name: just send it, and the code comes back on WhatsApp, usually the same day.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(status(page))
        await ui.point(page.locator('[data-qa="ask-whatsapp"]'), 1800)
      },
    },
    {
      id: 'steps',
      say: {
        ar: 'وفي بطاقة «كيف أحصل على رمز التفعيل؟» الخطوات الثلاث: انسخ رقم الجهاز، وأرسله، ثم أدخل الرمز الذي يصلك هنا واضغط «تفعيل».',
        en: 'The How do I get an activation code? card lists the three steps: copy the device number, send it, then enter the code you receive here and press Activate.',
      },
      run: async ({ page, ui }) => {
        const steps = page.locator('.st-buy-steps li')
        await ui.scrollTo(page.locator('.st-buy-steps'))
        for (let i = 0; i < 3; i++) await ui.point(steps.nth(i), 900)
      },
    },
    {
      id: 'code-field',
      say: {
        ar: 'حين يصلك الرمز الصقه في بطاقة «إدخال رمز التفعيل أو مفتاح الترخيص»: الصق الرسالة كما وصلتك أو الرمز وحده، فيُستخرج تلقائياً، والمسافات والشرطات لا تهم. رمز التفعيل 112 خانة ويعمل دون إنترنت.',
        en: 'When the code arrives, paste it in the Enter an activation code or licence key card: the whole message as you received it, or just the code; it is picked out automatically, and spaces and dashes do not matter. An activation code has 112 characters and works offline.',
      },
      run: async ({ page, ui }) => {
        const card = cardWith(page, '[data-qa="code-input"]')
        await ui.scrollTo(card)
        await ui.point(page.locator('[data-qa="code-input"]'), 1400)
        await ui.point(card.locator('.field-hint'), 1300)
        await ui.point(page.locator('[data-qa="activate"]'), 900)
      },
    },
    {
      id: 'key',
      say: {
        ar: 'وقد يصلك مفتاح ترخيص من 16 خانة بدل الرمز. الصقه في الحقل نفسه، فيتعرّف عليه البرنامج. وعند الضغط على «تفعيل» يُرسَل المفتاح ورقم هذا الجهاز فقط لاستلام رمز التفعيل، ولا يُرسَل شيء من بيانات العيادة. يلزم الإنترنت هذه المرة فقط.',
        en: 'You may receive a 16-character licence key instead of a code. Paste it in the same field, and Dentora recognises it. When you press Activate, only the key and this device’s number are sent to receive the activation code; none of the clinic’s data is sent. The internet is needed this once only.',
      },
      run: async ({ page, ui }) => {
        const card = cardWith(page, '[data-qa="code-input"]')
        await ui.type(page.locator('[data-qa="code-input"]'), EXAMPLE_KEY, { delay: 45 })
        await page.locator('[data-qa="key-detected"]').waitFor({ timeout: 10000 })
        await ui.point(page.locator('[data-qa="key-detected"]'), 1300)
        await ui.point(card.locator('.field-hint'), 1800)
        await ui.moveTo(page.locator('[data-qa="activate"]'))
        await ui.pause(600)
      },
    },
    {
      id: 'website',
      say: {
        ar: 'وإن لم يكن هذا الجهاز متصلاً بالإنترنت، افتح صفحة التفعيل على موقع دنتورا من أي جهاز آخر، كالهاتف، واكتب فيها رقم جهازك والمفتاح، ثم الصق هنا رمز التفعيل الذي تعرضه.',
        en: 'If this device has no internet, open the activation page on Dentora’s website from any other device, such as a phone, enter your device number and the key there, then paste here the activation code it shows.',
      },
      run: async ({ page, ui, lang }) => {
        // the example key goes away again: the field is left as it was
        await ui.click(page.locator('[data-qa="code-input"]'))
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Backspace')
        await ui.pause(300)
        await ui.moveTo(page.locator('[data-qa="device-number"]'))
        await ui.callout(pick(lang, 'dentora.raqeem.dev/activate', 'dentora.raqeem.dev/en/activate'), { ms: 3000 })
      },
    },
    {
      id: 'one-device',
      say: {
        ar: 'المفتاح الواحد يعمل على جهاز واحد فقط، ورمز التفعيل خاص بهذا الجهاز. بعد التفعيل تظهر هنا «النظام مفعّل» مع الباقة ومدة الصلاحية، ويبقى التفعيل بعد استعادة نسخة احتياطية.',
        en: 'One key works on one device only, and an activation code belongs to this device. After activation this card says Activated, with the plan and validity, and the activation stays after a backup is restored.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(status(page))
        await ui.moveTo(status(page).locator('.st-hero-title'))
        await ui.point(status(page).locator('.st-hero'), 2000)
      },
    },
    {
      id: 'new-device',
      say: {
        ar: 'أما على جهاز جديد فرقم الجهاز يتغيّر، فتطلب تفعيلاً له. ولتجديد الترخيص لاحقاً تُدخل رمزاً جديداً في الصفحة نفسها.',
        en: 'On a new device the device number changes, so you ask for an activation for it. To renew the licence later, you enter a new code on this same page.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(page.locator('[data-qa="device-number"]'))
        await ui.point(cardWith(page, '[data-qa="device-number"]'), 1800)
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تفعّل دنتورا: رقم الجهاز، ورمز أو مفتاح من البائع، ثم «تفعيل». التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you activate Dentora: the device number, a code or key from the seller, then Activate. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(home(page))
        await dashboardShown(page)
      },
    },
  ],
}

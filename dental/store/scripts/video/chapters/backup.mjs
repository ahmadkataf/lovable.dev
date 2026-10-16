// Chapter 16 "Backup and restore": why backups matter, the backup page, saving a backup, protecting it with a
// password, where to keep it, restoring (the password prompt, the summary, the confirmation), moving to a new device,
// the demo data and the danger zone, Android. Written from server/guide/topics/backup.ts, in its order. Runs on the
// demo clinic as the admin, from the dashboard. Two backups are really exported (the browser downloads them: on
// Windows and Android the system's save screen opens instead, which the narration says); the restore and the erase
// are shown up to their confirmation and cancelled. The browser-only storage note of the backup page (never shown in
// the Windows and Android apps) is hidden, as the guide's screenshots hide it.
import fs from 'node:fs'
import path from 'node:path'

const nav = (page, to) => page.locator(`.app-sidebar .nav-item[href$="${to}"]`)
const home = page => page.locator('.app-sidebar .nav-item').first()
const pick = (lang, ar, en) => (lang === 'ar' ? ar : en)
const btn = (scope, ar, en) => scope.getByRole('button', { name: new RegExp(`^(${ar}|${en})$`) })
const modal = page => page.locator('.modal')
const hero = page => page.locator('.st-backup-hero')
/** The settings card that holds `inner`. */
const cardWith = (page, inner) => page.locator('.st-form .card').filter({ has: page.locator(inner) }).first()
const PASSWORD = 'Smile-2026'
/** Where the exported files go (the recorder's work folder), one per language. */
const files = { plain: '', protected: '' }
const DIR = path.join(process.env.VIDEO_WORK || '/tmp/dentora-video-work', 'backup-demo')

async function dashboardShown(page) {
  await page.locator('[data-testid="dashboard"]').waitFor({ timeout: 30000 })
  await page.locator('[data-testid="dash-schedule"] [data-testid="dash-apt"]').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(600)
}
/** Clicks Export backup, keeps the downloaded file at `name` and waits for the "Backup saved" toast. */
async function exportBackup(page, ui, name) {
  const download = page.waitForEvent('download', { timeout: 60000 })
  await ui.click(page.locator('[data-qa="export-backup"]'))
  const d = await download
  fs.mkdirSync(DIR, { recursive: true })
  const file = path.join(DIR, `${name}-${d.suggestedFilename()}`)
  await d.saveAs(file)
  await page.locator('.toast-success').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  return file
}
async function closeModal(page, ui) {
  if (await modal(page).count()) {
    await ui.click(btn(page.locator('.modal-footer'), 'إلغاء', 'Cancel'))
    await modal(page).waitFor({ state: 'hidden', timeout: 10000 })
  }
}

export const chapter = {
  slug: 'backup',
  before: async ({ page }) => {
    await page.addStyleTag({ content: '.st-backup-hero .alert-info{display:none!important}' })
  },
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل تحمي بيانات عيادتك: تحفظ نسخة احتياطية في دنتورا، وتحميها بكلمة مرور، وتستعيدها عند الحاجة، أو تنقل بها العيادة إلى جهاز جديد. افتح «الإعدادات» ثم «النسخ الاحتياطي».',
        en: 'In this chapter you protect your clinic’s data: save a backup in Dentora, protect it with a password, restore it when you need to, or move the clinic to a new device with it. Open Settings, then Backup & data.',
      },
      run: async ({ page, ui }) => {
        await dashboardShown(page)
        await ui.pause(2500)
        await ui.click(nav(page, '/settings'))
        await page.locator('.st-nav [data-tab="backup"]').waitFor({ timeout: 15000 })
        await ui.click(page.locator('.st-nav [data-tab="backup"]'))
        await page.locator('[data-qa="export-backup"]').waitFor({ timeout: 15000 })
        await page.locator('[data-qa="last-backup"]').waitFor({ timeout: 15000 })
        await ui.pause(500)
      },
    },
    {
      id: 'why',
      say: {
        ar: 'لا يرسل دنتورا أي بيانات إلى الإنترنت، وهذا يحمي خصوصية مرضاك. لكنه يعني أن كل شيء محفوظ على هذا الجهاز وحده: إن تعطّل أو ضاع ضاعت معه الملفات. النسخة الاحتياطية هي نسختك الثانية خارجه.',
        en: 'Dentora sends nothing to the internet, which keeps your patients’ data private. It also means everything lives on this one device: if it breaks or gets lost, the files go with it. A backup is your second copy, kept somewhere else.',
      },
      run: async ({ page, ui }) => {
        await ui.moveTo(hero(page).locator('.st-hero-title'))
        await ui.point(hero(page).locator('.st-hero'), 2200)
      },
    },
    {
      id: 'stats',
      say: {
        ar: 'في الأعلى عدد «المرضى» و«المواعيد» و«الفواتير»، وتاريخ «آخر نسخة احتياطية». وتحتها تنبيه بحال نسختك: أصفر إن لم تحفظ نسخة بعد أو مضى على آخرها أسبوع، وأخضر إن كانت حديثة.',
        en: 'At the top are the numbers of Patients, Appointments and Invoices, and the date of the Last backup. Under them a notice gives your backup’s state: yellow if you have never backed up or the last one is a week old, green when it is recent.',
      },
      run: async ({ page, ui }) => {
        await ui.point(hero(page).locator('.st-backup-stats'), 1300)
        await ui.point(hero(page).locator('[data-qa="last-backup"]'), 900)
        await ui.point(hero(page).locator('.alert-warning'), 1500)
      },
    },
    {
      id: 'export',
      say: {
        ar: 'انقر على «تصدير نسخة احتياطية». على ويندوز تُفتح نافذة حفظ لتختار المكان، مثل فلاشة USB، وعلى أندرويد شاشة الحفظ في النظام. انتظر رسالة «حُفظت النسخة الاحتياطية» مع اسم الملف وحجمه.',
        en: 'Click Export backup. On Windows a save window opens to choose the place, such as a USB stick; on Android, the system’s save screen. Wait for the Backup saved message with the file’s name and size.',
      },
      run: async ({ page, ui, lang }) => {
        files.plain = await exportBackup(page, ui, `${lang}-plain`)
        await ui.point(page.locator('.toast-success').first(), 1600)
      },
    },
    {
      id: 'saved',
      say: {
        ar: 'الملف واحد، اسمه dentora-backup مع التاريخ والساعة، وفيه كل شيء: المرضى والمواعيد والفواتير والملفات المرفقة وحسابات الفريق والإعدادات. وصار التنبيه أخضر: «نسختك الاحتياطية حديثة».',
        en: 'It is one file, named dentora-backup with the date and time, and it holds everything: patients, appointments, invoices, attached files, the team accounts and the settings. The notice is now green: Your backup is up to date.',
      },
      run: async ({ page, ui }) => {
        await ui.point(hero(page).locator('.alert-success'), 1600)
        await ui.point(hero(page).locator('[data-qa="last-backup"]'), 1100)
      },
    },
    {
      id: 'protect',
      say: {
        ar: 'ملف النسخة فيه بيانات طبية سرية. فعّل «احمِ النسخة بكلمة مرور»، واكتب «كلمة المرور» بثماني خانات على الأقل، ثم «أعد كتابة كلمة المرور».',
        en: 'A backup file holds confidential medical data. Turn on Protect the backup with a password, type the Password, at least 8 characters, then Repeat the password.',
      },
      run: async ({ page, ui }) => {
        await ui.click(hero(page).locator('.bk-protect-head .switch'))
        await page.locator('[data-qa="backup-password"]').waitFor({ timeout: 10000 })
        await ui.type(page.locator('[data-qa="backup-password"]'), PASSWORD, { delay: 80 })
        await ui.type(page.locator('[data-qa="backup-password2"]'), PASSWORD, { delay: 80 })
      },
    },
    {
      id: 'protect-export',
      say: {
        ar: 'دوّن كلمة المرور في مكان آمن: من دونها لا تُفتح هذه النسخة أبداً. يتذكر البرنامج أنك تحمي نسخك لكنه لا يحفظ كلمة المرور، وتُطلب عند الاستعادة. ثم انقر على «تصدير نسخة احتياطية» كالمعتاد.',
        en: 'Write the password down somewhere safe: without it this backup can never be opened. Dentora remembers that you protect your backups but never stores the password, and asks for it when you restore. Then click Export backup as usual.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.point(hero(page).locator('.bk-protect .alert-warning'), 1800)
        files.protected = await exportBackup(page, ui, `${lang}-protected`)
        await ui.point(page.locator('.toast-success').first(), 1200)
      },
    },
    {
      id: 'where',
      say: {
        ar: 'احفظ نسختك دائماً خارج الجهاز: على فلاشة أو قرص خارجي، أو في Google Drive، أو أرسلها لنفسك بالبريد أو واتساب، والأفضل أن تبقى نسخة خارج العيادة. ننصح بنسخة أسبوعية على الأقل، والأفضل في نهاية كل يوم عمل.',
        en: 'Always keep your backup off the device: on a USB stick or an external disk, in Google Drive, or sent to yourself by email or WhatsApp, ideally with one copy outside the clinic. Back up at least once a week, and ideally at the end of every working day.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.point(hero(page).locator('.st-hero-desc'), 1600)
        await ui.callout(pick(lang, 'نسخة أسبوعية على الأقل، خارج الجهاز', 'At least weekly, off this device'), { ms: 2400 })
      },
    },
    {
      id: 'restore-open',
      say: {
        ar: 'الاستعادة تُرجع العيادة كما كانت يوم حفظ النسخة. في «استعادة نسخة احتياطية» انقر على «اختيار ملف النسخة» واختر الملف، وامتداده dentora.',
        en: 'A restore brings the clinic back as it was on the day of the backup. Under Restore a backup click Choose backup file and choose the file; it ends in dentora.',
      },
      run: async ({ page, ui }) => {
        const restore = cardWith(page, '[data-qa="choose-backup"]')
        await ui.scrollTo(restore)
        await ui.point(restore, 1200)
        const chooser = page.waitForEvent('filechooser', { timeout: 15000 })
        await ui.click(page.locator('[data-qa="choose-backup"]'))
        await (await chooser).setFiles(files.protected)
        await page.locator('[data-qa="backup-unlock"]').waitFor({ timeout: 20000 })
        await ui.pause(500)
      },
    },
    {
      id: 'restore-password',
      say: {
        ar: 'إن كانت النسخة محمية فاكتب كلمة المرور وانقر على «فتح النسخة».',
        en: 'If the backup is password-protected, type the password and click Open backup.',
      },
      run: async ({ page, ui }) => {
        await ui.type(page.locator('[data-qa="backup-unlock"]'), PASSWORD, { delay: 80 })
        await ui.click(page.locator('[data-qa="backup-open"]'))
        await page.locator('[data-qa="restore-summary"]').waitFor({ timeout: 30000 })
        await ui.pause(500)
      },
    },
    {
      id: 'restore-summary',
      say: {
        ar: 'راجع ما في الملف: تاريخ النسخة واسم العيادة وعدد المرضى والمواعيد والفواتير. انتبه: بيانات الملف تحلّ محل كل البيانات الموجودة الآن على هذا الجهاز.',
        en: 'Check what the file holds: the backup date, the clinic’s name and the numbers of patients, appointments and invoices. Note: the file’s data replaces everything currently on this device.',
      },
      run: async ({ page, ui }) => {
        const m = modal(page)
        await ui.point(m.locator('.st-file-card'), 1100)
        await ui.point(m.locator('[data-qa="restore-summary"]'), 1600)
        await ui.point(m.locator('.alert-danger'), 1300)
      },
    },
    {
      id: 'restore-confirm',
      say: {
        ar: 'للمتابعة اكتب كلمة «استبدال» في خانة التأكيد وانقر على «استعادة واستبدال البيانات»، فيُعاد تشغيل البرنامج. والاستعادة كلها أو لا شيء: إن فشلت لأي سبب لا يتغيّر شيء من بياناتك. لن نستعيد الآن: «إلغاء».',
        en: 'To go on, type REPLACE in the confirmation box and click Restore and replace data; Dentora then restarts. A restore is all or nothing: if it fails for any reason, none of your data changes. We will not restore now: Cancel.',
      },
      run: async ({ page, ui }) => {
        await ui.point(page.locator('[data-qa="confirm-word"]'), 1300)
        await ui.point(page.locator('[data-qa="confirm-danger"]'), 1100)
        await ui.pause(1200)
        await closeModal(page, ui)
      },
    },
    {
      id: 'new-device',
      say: {
        ar: 'لنقل العيادة إلى جهاز جديد: احفظ نسخة حديثة على الجهاز القديم، وثبّت دنتورا على الجديد، وفي الشاشة الأولى من معالج الإعداد انقر على «استعد بياناتك من نسخة احتياطية». ثم ادخل باسمك ورمزك المعتادين، وفعّل الترخيص من جديد: للجهاز الجديد رقم جهاز جديد.',
        en: 'To move the clinic to a new device: save a fresh backup on the old device, install Dentora on the new one, and on the setup wizard’s first screen click Restore your data from a backup. Then sign in with your usual name and PIN, and activate the licence again: the new device has a new device number.',
      },
      run: async ({ page, ui }) => {
        const restore = cardWith(page, '[data-qa="choose-backup"]')
        await ui.scrollTo(restore)
        await ui.moveTo(page.locator('[data-qa="choose-backup"]'))
        await ui.point(restore, 1800)
      },
    },
    {
      id: 'one-file',
      say: {
        ar: 'ملف النسخة واحد على ويندوز وأندرويد، فتنقل به العيادة من الحاسوب إلى الهاتف أو العكس. ولا يزامن دنتورا جهازين: الاستعادة تستبدل البيانات ولا تدمجها، فاختر جهازاً رئيسياً واحداً للعمل اليومي.',
        en: 'The backup file is the same on Windows and Android, so it also moves the clinic from a computer to a phone or the other way round. Dentora does not sync two devices: a restore replaces data rather than merging it, so choose one main device for daily work.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.callout(pick(lang, 'ملف واحد: ويندوز وأندرويد', 'One file: Windows and Android'), { ms: 2400 })
      },
    },
    {
      id: 'demo',
      say: {
        ar: 'بطاقة «تجربة البرنامج ببيانات جاهزة»: زر «تحميل بيانات تجريبية» يضيف عيادة كاملة النشاط لتجرّب دنتورا، ويعمل ما دام في العيادة أقل من 3 مرضى، حتى لا تختلط البيانات التجريبية بالحقيقية.',
        en: 'The Try the app with ready-made data card: Load demo data adds a busy clinic so you can try Dentora, and works while the clinic has fewer than 3 patients, so demo data never mixes with real records.',
      },
      run: async ({ page, ui }) => {
        const demo = cardWith(page, '[data-qa="load-demo"]')
        await ui.scrollTo(demo)
        await ui.point(demo, 1300)
        await ui.point(page.locator('[data-qa="demo-blocked"]'), 1400)
      },
    },
    {
      id: 'danger',
      say: {
        ar: 'وحين تنتهي من التجربة، أو تريد البدء من الصفر، انقر على «حذف كل البيانات» في «منطقة الخطر» أسفل الصفحة.',
        en: 'When you have finished trying, or want to start from scratch, click Erase all data in the Danger zone at the bottom of the page.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(page.locator('.st-danger-zone'))
        await ui.point(page.locator('.st-danger-zone'), 1100)
        await ui.click(page.locator('[data-qa="reset-all"]'))
        await modal(page).waitFor({ timeout: 10000 })
        await ui.pause(500)
      },
    },
    {
      id: 'danger-dialog',
      say: {
        ar: 'إن لم تكن لديك نسخة حديثة فانقر أولاً على «تصدير نسخة أولاً». ثم اكتب كلمة «حذف» في خانة التأكيد وانقر على «حذف كل البيانات»، فيُفتح معالج الإعداد من جديد. لن نحذف شيئاً الآن: «إلغاء».',
        en: 'If you have no recent backup, first click Export a backup first. Then type ERASE in the confirmation box and click Erase all data; the setup wizard opens again. We will not erase anything now: Cancel.',
      },
      run: async ({ page, ui }) => {
        await ui.point(page.locator('.modal-footer .start button'), 1200)
        await ui.point(page.locator('[data-qa="confirm-word"]'), 1100)
        await ui.point(page.locator('[data-qa="confirm-danger"]'), 900)
        await ui.pause(1500)
        await closeModal(page, ui)
      },
    },
    {
      id: 'android',
      say: {
        ar: 'على أندرويد يمسح حذف التطبيق كل بيانات العيادة نهائياً، ولا تنقلها نسخة Google التلقائية: ملف النسخة من داخل دنتورا هو الطريقة الوحيدة.',
        en: 'On Android, uninstalling the app erases all clinic data for good, and Google’s automatic backup does not carry it: the backup file made inside Dentora is the only way.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.scrollTo(page.locator('.page-header'))
        await ui.moveTo(page.locator('[data-qa="export-backup"]'))
        await ui.callout(pick(lang, 'على أندرويد: ملف النسخة هو الطريقة الوحيدة', 'On Android: the backup file is the only way'), { ms: 2400 })
      },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تحفظ نسخة احتياطية وتحميها وتستعيدها، وتنقل عيادتك إلى جهاز جديد. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you save, protect and restore a backup, and move your clinic to a new device. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => {
        await ui.click(home(page))
        await dashboardShown(page)
      },
    },
  ],
}

import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in store/scripts/shoot.mjs.
// The shots run in a browser, where the Backup tab adds a blue note about the browser's storage that the Windows and
// Android apps never show: hide it with .st-backup-hero .alert-info{display:none}. In a browser an export downloads the
// file at once (accept downloads) instead of opening the Windows or Android save screen. Never confirm a restore or an
// erase in a shot: close those dialogs with Cancel.
const DESK = 'Desktop 1440×900, demo clinic as store/scripts/shoot.mjs makes it (seedAndLogin + Settings → Backup → Load demo data; English shots use its englishClinic() names), signed in as the admin (Dr. Ahmad Al-Khatib), clock fixed at Sunday 11 Oct 2026 11:40 Asia/Damascus, trial bar hidden ([data-qa="trial-bar"]{display:none}), the browser-only storage note hidden (.st-backup-hero .alert-info{display:none}), downloads accepted, page scrolled to the top and held there (page.goto() reads as Back to the app, which restores an old scroll position).'
const PHONE = 'Phone 390×844 (isMobile, hasTouch, deviceScaleFactor 8/3 as shoot.mjs), same demo clinic, clock, hidden trial bar and hidden storage note.'
const EXPORT = 'Route #/settings/backup, click **Export backup** ([data-qa="export-backup"]) and keep the downloaded file (named dentora-backup-2026-10-11-HHMM.dentora, with the time of the export).'

const topic: GuideTopic = {
  slug: 'backup',
  order: 16,
  icon: 'databaseBackup',
  title: { ar: 'النسخ الاحتياطي ونقل العيادة', en: 'Backup and moving your clinic' },
  summary: {
    ar: 'بيانات عيادتك على جهازك وحده. احفظ نسخة احتياطية بانتظام، واحمها بكلمة مرور، واستعدها عند الحاجة، أو انقل بها العيادة إلى جهاز جديد.',
    en: 'Your clinic’s data lives on your device alone. Save a backup regularly, protect it with a password, restore it when you need to, or use it to move the clinic to a new device.',
  },
  metaDescription: {
    ar: 'بيانات عيادتك على جهازك وحده. احفظ نسخة احتياطية بانتظام، واحمها بكلمة مرور، واستعدها عند الحاجة، أو انقل بها العيادة إلى جهاز جديد.',
    en: 'Your clinic’s data lives on your device alone: save backups regularly, protect them with a password, restore them, or move the clinic to a new device.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'لماذا النسخ الاحتياطي مهم؟', en: 'Why backups matter' },
      text: {
        ar: [
          'لا يرسل Dentora أي بيانات إلى الإنترنت، وهذا يحمي خصوصية مرضاك. لكنه يعني أن كل شيء محفوظ على هذا الجهاز وحده: إن تعطّل أو ضاع أو سُرق ضاعت معه ملفات المرضى ومواعيدهم وحساباتهم. النسخة الاحتياطية هي نسختك الثانية خارجه.',
          'افتح **الإعدادات** ثم **النسخ الاحتياطي**. في الأعلى عدد **المرضى** و**المواعيد** و**الفواتير**، وتاريخ **آخر نسخة احتياطية**. وتحتها تنبيه بحال نسختك: أصفر إن لم تحفظ نسخة بعد أو مضى على آخر نسخة أسبوع أو أكثر، وأخضر إن كانت حديثة.',
          'وفي الصفحة نفسها: حماية النسخة بكلمة مرور، وزر **تصدير نسخة احتياطية**، ثم **استعادة نسخة احتياطية**، و**تجربة البرنامج ببيانات جاهزة**، و**منطقة الخطر**.',
        ],
        en: [
          'Dentora sends nothing to the internet, which keeps your patients’ data private. It also means everything lives on this one device: if it breaks, gets lost or is stolen, the patient files, appointments and accounts go with it. A backup is your second copy, kept somewhere else.',
          'Open **Settings**, then **Backup & data**. At the top are the numbers of **Patients**, **Appointments** and **Invoices**, and the date of the **Last backup**. Under them a notice gives your backup’s state: yellow if you have never backed up or the last backup is a week old or more, green when it is recent.',
          'The same page holds password protection, the **Export backup** button, **Restore a backup**, **Try the app with ready-made data** and the **Danger zone**.',
        ],
      },
      tips: {
        ar: [
          'صفحة النسخ الاحتياطي للمدير وحده، ولا تظهر في إعدادات الأدوار الأخرى.',
          'لا تعتمد على ذاكرتك: إن لم تحفظ أي نسخة بعد، أو مضى على آخر نسخة سبعة أيام أو أكثر، يظهر تنبيه في [الشاشة الرئيسية](dashboard#alerts) وفي [التنبيهات](interface#notifications) (مع زر **نسخ الآن**)، ونقطة بجانب **النسخ الاحتياطي** في قائمة الإعدادات. وتعود النقطة الحمراء على الجرس كل أسبوع حتى تحفظ نسخة.',
          'ننصح بنسخة أسبوعية على الأقل، والأفضل نسخة في نهاية كل يوم عمل.',
        ],
        en: [
          'The backup page is for the admin only; it does not appear in the other roles’ settings.',
          'You need not rely on memory: if you have never backed up, or your last backup is seven days old or more, a notice appears on the [Dashboard](dashboard#alerts) and in the [Notifications](interface#notifications) (with a **Back up now** button), and a dot shows next to **Backup & data** in the settings menu. The red dot on the bell comes back every week until you save a backup.',
          'Back up at least once a week, and ideally at the end of every working day.',
        ],
      },
      shots: ['backup-overview'],
    },
    {
      id: 'export',
      title: { ar: 'حفظ نسخة احتياطية', en: 'Saving a backup' },
      steps: {
        ar: [
          'افتح **الإعدادات** ثم **النسخ الاحتياطي**.',
          'انقر على **تصدير نسخة احتياطية**.',
          'على ويندوز تُفتح نافذة حفظ: اختر المكان، مثل فلاشة USB، ثم انقر على حفظ. وعلى أندرويد تُفتح شاشة الحفظ في النظام: اختر مجلداً أو Google Drive، ثم احفظ.',
          'انتظر رسالة **حُفظت النسخة الاحتياطية** مع اسم الملف وحجمه، وأبقِ البرنامج مفتوحاً حتى تظهر.',
        ],
        en: [
          'Open **Settings**, then **Backup & data**.',
          'Click **Export backup**.',
          'On Windows a save window opens: choose where to keep the file, such as a USB stick, then click Save. On Android the system’s save screen opens: choose a folder or Google Drive, then save.',
          'Wait for the **Backup saved** message with the file’s name and size, and keep the app open until it shows.',
        ],
      },
      tips: {
        ar: [
          'النسخة ملف واحد اسمه مثل dentora-backup-2026-10-11-1140.dentora (التاريخ والساعة). فيه كل شيء: المرضى والمواعيد والعلاجات والفواتير والمخزون والمصروفات، وكل صورة وأشعة وملف مرفق، وحسابات الفريق، وإعدادات العيادة.',
          'بعد الحفظ يقرأ البرنامج الملف من مكانه ويتأكد أنه سليم قبل أن يقول «حُفظت». وإن امتلأ القرص أو تعذّرت الكتابة يقول لك ذلك صراحة، فاختر مكاناً آخر.',
          'تستطيع إيقاف الحفظ بزر **إيقاف** في نافذة التقدّم، ولا يُسجَّل حينها شيء.',
          'التصدير متاح دائماً، حتى في وضع القراءة فقط بعد انتهاء الفترة التجريبية. انظر [الترخيص](licence).',
        ],
        en: [
          'The backup is one file named like dentora-backup-2026-10-11-1140.dentora (date and time). It holds everything: patients, appointments, treatments, invoices, stock and expenses, every photo, x-ray and attached file, the team accounts and the clinic’s settings.',
          'After saving, Dentora reads the file back from where it went and checks it is whole before it says “saved”. If the disk is full or the file cannot be written, it tells you plainly, so you can choose another place.',
          'You can stop a backup with the **Stop** button in the progress window; nothing is recorded then.',
          'Exporting always works, even in read-only mode after the trial ends. See [Licence](licence).',
        ],
      },
      shots: ['backup-saved'],
    },
    {
      id: 'password',
      title: { ar: 'حماية النسخة بكلمة مرور', en: 'Protecting a backup with a password' },
      text: {
        ar: ['ملف النسخة فيه بيانات طبية سرية. احمه بكلمة مرور، فلا يستطيع أحد فتحه أو قراءة بيانات المرضى من دونها، حتى لو وقع في يد غيرك.'],
        en: ['A backup file holds confidential medical data. Protect it with a password, and nobody can open it or read patient data without that password, even if the file falls into the wrong hands.'],
      },
      steps: {
        ar: [
          'فعّل **احمِ النسخة بكلمة مرور** فوق زر التصدير.',
          'اكتب **كلمة المرور** (ثماني خانات على الأقل)، ثم **أعد كتابة كلمة المرور**.',
          'انقر على **تصدير نسخة احتياطية** واحفظ الملف كالمعتاد.',
        ],
        en: [
          'Turn on **Protect the backup with a password** above the export button.',
          'Type the **Password** (at least 8 characters), then **Repeat the password**.',
          'Click **Export backup** and save the file as usual.',
        ],
      },
      tips: {
        ar: [
          'دوّن كلمة المرور واحفظها في مكان آمن. من دونها لا يمكن فتح هذه النسخة أبداً، لا منك ولا من الجهة التي اشتريت منها البرنامج.',
          'يتذكر البرنامج على هذا الجهاز أنك تحمي نسخك، لكنه لا يحفظ كلمة المرور: تكتبها مع كل نسخة.',
          'التشفير قوي (AES-256)، ويُطلب منك كتابة كلمة المرور عند الاستعادة.',
        ],
        en: [
          'Write the password down and keep it somewhere safe. Without it this backup can never be opened, not by you and not by whoever supplied Dentora.',
          'Dentora remembers on this device that you protect your backups, but it never stores the password: you type it for each backup.',
          'The encryption is strong (AES-256), and you are asked for the password when you restore.',
        ],
      },
      shots: ['backup-protect'],
    },
    {
      id: 'where',
      title: { ar: 'أين تحفظ النسخة؟', en: 'Where to keep your backups' },
      text: {
        ar: [
          'احفظ نسختك دائماً خارج الجهاز الذي يعمل عليه البرنامج: على فلاشة USB أو قرص خارجي، أو في Google Drive أو OneDrive، أو أرسلها لنفسك بالبريد أو واتساب. والأفضل أن تكون نسخة منها خارج العيادة، في البيت مثلاً.',
          'وجرّب الاستعادة على جهاز آخر مرة كل بضعة أشهر، لتطمئن أن نسخك سليمة.',
        ],
        en: [
          'Always keep your backup off the device Dentora runs on: on a USB stick or an external disk, in Google Drive or OneDrive, or sent to yourself by email or WhatsApp. Ideally keep one copy outside the clinic, at home for example.',
          'Every few months, try a restore on another device to be sure your backups are sound.',
        ],
      },
      tips: {
        ar: [
          'على ويندوز تبقى البيانات في مجلد حساب ويندوز الحالي، فلا يمسحها إلغاء تثبيت النسخة المنزَّلة من الموقع أو إعادة تثبيتها. أما إن ثبّتّ Dentora من متجر Microsoft فإلغاء تثبيته يمسح بياناته، فخذ نسخة احتياطية قبله. وفي الحالتين يأخذ تعطّل القرص أو سرقة الحاسوب البيانات معه.',
          'على أندرويد يمسح حذف التطبيق، أو «مسح البيانات» من معلومات التطبيق، كل بيانات العيادة نهائياً. ولا تنقلها نسخة Google التلقائية ولا نقل البيانات بين الهواتف: ملف النسخة من داخل البرنامج هو الطريقة الوحيدة.',
          'إن أرسلت النسخة عبر الإنترنت فاحمها بكلمة مرور أولاً.',
        ],
        en: [
          'On Windows the data lives in the current Windows account’s folder, so uninstalling or reinstalling the version downloaded from the website does not erase it. If you installed Dentora from the Microsoft Store, uninstalling it erases its data, so save a backup first. Either way, a broken disk or a stolen PC takes it all.',
          'On Android, uninstalling the app, or “Clear storage” in the app’s info, erases all clinic data for good. Neither Google’s automatic backup nor a phone-to-phone transfer carries it: the backup file made inside Dentora is the only way.',
          'If you send a backup over the internet, protect it with a password first.',
        ],
      },
    },
    {
      id: 'restore',
      title: { ar: 'استعادة نسخة احتياطية', en: 'Restoring a backup' },
      text: {
        ar: ['الاستعادة تُرجع العيادة كما كانت يوم حفظ النسخة. انتبه: بيانات الملف تحلّ محل كل البيانات الموجودة الآن على هذا الجهاز.'],
        en: ['A restore brings the clinic back as it was on the day of the backup. Note: the file’s data replaces everything currently on this device.'],
      },
      steps: {
        ar: [
          'في **الإعدادات** ← **النسخ الاحتياطي** انقر على **اختيار ملف النسخة**.',
          'اختر ملف النسخة (امتداده ‎.dentora، أو ‎.json للنسخ القديمة).',
          'إن كانت النسخة محمية فاكتب كلمة المرور وانقر على **فتح النسخة**.',
          'راجع ما في الملف: تاريخ النسخة، واسم العيادة، وعدد المرضى والمواعيد والفواتير وملفات المرضى والسجلات.',
          'اكتب كلمة **استبدال** في خانة التأكيد، وانقر على **استعادة واستبدال البيانات**. يُعاد تشغيل البرنامج بعد لحظات.',
        ],
        en: [
          'In **Settings** → **Backup & data**, click **Choose backup file**.',
          'Choose the backup file (it ends in .dentora, or .json for older backups).',
          'If the backup is password-protected, type the password and click **Open backup**.',
          'Check what the file holds: the backup date, the clinic’s name, and the numbers of patients, appointments, invoices, patient files and records.',
          'Type **REPLACE** in the confirmation box and click **Restore and replace data**. Dentora restarts a moment later.',
        ],
      },
      tips: {
        ar: [
          'الاستعادة كلها أو لا شيء: إن فشلت لأي سبب (كلمة مرور خاطئة، ملف تالف، مساحة غير كافية) لا يتغيّر شيء من بياناتك، ويقول لك البرنامج السبب.',
          'يبقى تفعيل الترخيص على هذا الجهاز كما هو بعد الاستعادة.',
          'إن كانت بعض ملفات المرضى في النسخة تالفة يذكرها البرنامج بأسمائها قبل أن تؤكد، ويستعيد بقية البيانات من دونها.',
          'على أندرويد تظهر كل أنواع الملفات في شاشة الاختيار، لأن بعض أماكن التخزين لا تعرف ملفات ‎.dentora.',
          'النسخة من إصدار أحدث من البرنامج لا تُستعاد قبل تحديث Dentora. والاستعادة متوقفة في وضع القراءة فقط.',
        ],
        en: [
          'A restore is all or nothing: if it fails for any reason (wrong password, damaged file, not enough space), none of your data changes, and Dentora tells you why.',
          'This device’s licence activation stays as it is after a restore.',
          'If some patient files inside the backup are damaged, Dentora names them before you confirm, and restores everything else without them.',
          'On Android the file picker shows every type of file, because some storage places do not recognise .dentora files.',
          'A backup from a newer version of Dentora cannot be restored until you update the app. Restoring is paused in read-only mode.',
        ],
      },
      shots: ['backup-restore-confirm', 'backup-password-prompt'],
    },
    {
      id: 'new-device',
      title: { ar: 'نقل العيادة إلى جهاز جديد', en: 'Moving the clinic to a new device' },
      text: {
        ar: ['حين تشتري حاسوباً أو هاتفاً جديداً تنقل إليه العيادة كاملة بملف النسخة الاحتياطية، فلا تُدخل شيئاً من جديد.'],
        en: ['When you get a new computer or phone, you move the whole clinic to it with a backup file, without typing anything in again.'],
      },
      steps: {
        ar: [
          'على الجهاز القديم احفظ نسخة احتياطية حديثة (ويُفضّل أن تحميها بكلمة مرور)، وانقل الملف إلى الجهاز الجديد: بفلاشة، أو عبر Google Drive، أو أرسله لنفسك.',
          'ثبّت Dentora على الجهاز الجديد. انظر [التثبيت على ويندوز](getting-started#install-windows) و[التثبيت على أندرويد](getting-started#install-android).',
          'في الشاشة الأولى من معالج الإعداد انقر على **استعد بياناتك من نسخة احتياطية** واختر الملف. انظر [استعادة النسخة بدل الإعداد](getting-started#restore-backup). وإن كنت أعددت الجهاز الجديد من قبل فاستخدم **اختيار ملف النسخة** في صفحة النسخ الاحتياطي.',
          'ادخل باسمك ورمزك المعتادين: حسابات الفريق ورموزها في النسخة.',
          'فعّل الترخيص من جديد: الجهاز الجديد له رقم جهاز جديد، فاطلب رمز تفعيل له. انظر [الترخيص](licence).',
        ],
        en: [
          'On the old device, save a fresh backup (password-protected, ideally) and bring the file to the new device: on a USB stick, through Google Drive, or by sending it to yourself.',
          'Install Dentora on the new device. See [Installing on Windows](getting-started#install-windows) and [Installing on Android](getting-started#install-android).',
          'On the setup wizard’s first screen, tap **Restore your data from a backup** and choose the file. See [Restoring instead of setting up](getting-started#restore-backup). If the new device is already set up, use **Choose backup file** on the backup page instead.',
          'Sign in with your usual name and PIN: the team accounts and their PINs are in the backup.',
          'Activate the licence again: the new device has a new device number, so ask for an activation code for it. See [Licence](licence).',
        ],
      },
      tips: {
        ar: [
          'ملف النسخة واحد على ويندوز وأندرويد، فتنقل به العيادة من الحاسوب إلى الهاتف أو العكس.',
          'لا يزامن Dentora جهازين: كل جهاز يحمل بياناته، والاستعادة تستبدل البيانات ولا تدمجها. اختر جهازاً رئيسياً واحداً للعمل اليومي.',
        ],
        en: [
          'The backup file is the same on Windows and Android, so it also moves the clinic from a computer to a phone or the other way round.',
          'Dentora does not sync two devices: each device holds its own data, and a restore replaces data rather than merging it. Choose one main device for daily work.',
        ],
      },
      shots: ['backup-phone'],
    },
    {
      id: 'demo-erase',
      title: { ar: 'البيانات التجريبية وحذف كل البيانات', en: 'Demo data and erasing everything' },
      text: {
        ar: [
          'لتجرّب البرنامج قبل أن تبدأ، انقر على **تحميل بيانات تجريبية** في بطاقة **تجربة البرنامج ببيانات جاهزة**: يضيف عيادة تعمل بكامل نشاطها، فيها نحو 60 مريضاً و300 موعد مع الخطط العلاجية والفواتير والمدفوعات والمخبر والمخزون والمصروفات. يعمل الزر ما دام في العيادة أقل من ثلاثة مرضى، حتى لا تختلط البيانات التجريبية ببياناتك الحقيقية.',
          'وحين تنتهي من التجربة، أو تريد البدء من الصفر، استخدم **منطقة الخطر**:',
        ],
        en: [
          'To try Dentora before you start, click **Load demo data** in the **Try the app with ready-made data** card: it adds a busy clinic with about 60 patients and 300 appointments, with treatment plans, invoices, payments, lab work, stock and expenses. The button works while the clinic has fewer than three patients, so demo data never mixes with your real records.',
          'When you have finished trying, or want to start from scratch, use the **Danger zone**:',
        ],
      },
      steps: {
        ar: [
          'انقر على **حذف كل البيانات** في **منطقة الخطر** أسفل الصفحة.',
          'إن لم تكن لديك نسخة حديثة فانقر أولاً على **تصدير نسخة أولاً** في النافذة نفسها.',
          'اكتب كلمة **حذف** في خانة التأكيد، وانقر على **حذف كل البيانات**. يُفتح معالج الإعداد الأولي من جديد.',
        ],
        en: [
          'Click **Erase all data** in the **Danger zone** at the bottom of the page.',
          'If you have no recent backup, click **Export a backup first** in the same dialog.',
          'Type **ERASE** in the confirmation box and click **Erase all data**. The setup wizard opens again.',
        ],
      },
      tips: {
        ar: [
          'يحذف هذا المرضى والمواعيد والفواتير والمستخدمين وكل الإعدادات من هذا الجهاز، ولا يُسترجع شيء منها إلا من نسخة احتياطية.',
          'يبقى تفعيل الترخيص على الجهاز كما هو.',
          'في وضع القراءة فقط بعد انتهاء الفترة التجريبية يتوقف أيضاً **تحميل بيانات تجريبية** و**حذف كل البيانات**، ويبقى **تصدير نسخة احتياطية** متاحاً.',
          'إن كان في العيادة أقل من طبيبين تضيف البيانات التجريبية أطباء حتى يصبحوا اثنين: د. ليلى حداد ثم د. سامر عبود، ورمز الدخول لكل منهما 1234. فلا تُبقِ هذه الحسابات على جهاز فيه بيانات مرضى حقيقيين.',
        ],
        en: [
          'This deletes patients, appointments, invoices, users and every setting from this device, and nothing comes back except from a backup.',
          'The licence activation on the device is kept.',
          'In read-only mode, after the trial ends, **Load demo data** and **Erase all data** are paused too; **Export backup** keeps working.',
          'If the clinic has fewer than two doctors, the demo data adds doctors until it has two: Dr. Laila Haddad, then Dr. Samer Abboud, each with PIN 1234. Do not keep those accounts on a device that holds real patient data.',
        ],
      },
      shots: ['backup-erase'],
    },
  ],
  shots: [
    {
      id: 'backup-overview',
      device: 'desktop',
      alt: {
        ar: 'صفحة النسخ الاحتياطي: بياناتك محفوظة على هذا الجهاز فقط، وعدد المرضى والمواعيد والفواتير، وتنبيه أصفر بأنه لم تُحفظ نسخة بعد، وحماية بكلمة مرور، وزر تصدير نسخة احتياطية',
        en: 'The backup page: your data lives on this device only, the numbers of patients, appointments and invoices, a yellow notice that no backup has been saved yet, password protection and the Export backup button',
      },
      recipe: `${DESK} Route #/settings/backup, no backup taken yet in this clinic. Capture the whole window. No markers.`,
    },
    {
      id: 'backup-saved',
      device: 'desktop',
      alt: {
        ar: 'بعد حفظ النسخة: رسالة حُفظت النسخة الاحتياطية باسم الملف وحجمه، وتنبيه أخضر بأن نسختك الاحتياطية حديثة، وتاريخ آخر نسخة',
        en: 'After saving: the Backup saved message with the file’s name and size, a green notice that the backup is up to date, and the last backup date',
      },
      recipe: `${DESK} ${EXPORT} As soon as the toast "Backup saved" (حُفظت النسخة الاحتياطية) shows, capture the whole window. Markers: 2 on **Export backup**, 4 on the toast.`,
    },
    {
      id: 'backup-protect',
      device: 'desktop',
      alt: {
        ar: 'خيار احمِ النسخة بكلمة مرور مفعّلاً، مع خانتي كلمة المرور وتنبيه بأن النسخة لا تُفتح أبداً من دونها، وزر تصدير نسخة احتياطية',
        en: 'Protect the backup with a password turned on, with the two password boxes, a warning that the backup can never be opened without it, and the Export backup button',
      },
      recipe: `${DESK} Route #/settings/backup. Turn on the switch [data-qa="backup-protect-switch"] (click its label). Type "Smile-2026" in [data-qa="backup-password"] and in [data-qa="backup-password2"]. Crop to the first card (.st-backup-hero), 12 px margin. Markers: 1 on the switch, 2 on the two password boxes, 3 on **Export backup**. Do not export. Turn the switch off again afterwards (the app remembers it).`,
    },
    {
      id: 'backup-restore-confirm',
      device: 'desktop',
      alt: {
        ar: 'نافذة استعادة النسخة الاحتياطية: اسم الملف وتاريخه، واسم العيادة وعدد المرضى والمواعيد والفواتير والسجلات، وتحذير بأنها تحلّ محل كل البيانات، وخانة كتابة كلمة استبدال',
        en: 'The Restore backup dialog: the file’s name and date, the clinic’s name and the numbers of patients, appointments, invoices and records, a warning that it replaces all data, and the box to type REPLACE',
      },
      recipe: `${DESK} ${EXPORT} Then click **Choose backup file** ([data-qa="choose-backup"]) and give that file to the file chooser. Wait 2.5 s for the dialog. Crop to the dialog (.modal). Markers: 4 on the summary list ([data-qa="restore-summary"]), 5 on the confirmation box ([data-qa="confirm-word"]) and on **Restore and replace data** (two markers, both 5). Close with **Cancel** (do not restore).`,
    },
    {
      id: 'backup-password-prompt',
      device: 'desktop',
      alt: {
        ar: 'نافذة نسخة محمية بكلمة مرور تطلب كلمة المرور قبل فتح النسخة، مع رسالة كلمة المرور غير صحيحة',
        en: 'The Password-protected backup dialog asking for the password before opening the backup, with a “Wrong password” message',
      },
      recipe: `${DESK} Route #/settings/backup. Turn on [data-qa="backup-protect-switch"], type "Smile-2026" twice, click **Export backup** and keep the downloaded file; turn the switch off again. Click **Choose backup file** and give it that file. In the password dialog type "smile-2025" and click **Open backup** ([data-qa="backup-open"]); wait up to 6 s for "Wrong password" (كلمة المرور غير صحيحة). Crop to the dialog (.modal). Markers: 3 on the password box, and a second 3 on **Open backup**. Close with **Cancel**.`,
    },
    {
      id: 'backup-phone',
      device: 'phone',
      alt: {
        ar: 'صفحة النسخ الاحتياطي على الهاتف: بطاقة استعادة نسخة احتياطية وزر اختيار ملف النسخة',
        en: 'The backup page on a phone: the Restore a backup card and its Choose backup file button',
      },
      recipe: `${PHONE} Route #/settings/backup. Scroll so the restore card (the .card holding [data-qa="choose-backup"]) sits just under the top bar. Capture the screen. Marker: 3 on **Choose backup file**.`,
    },
    {
      id: 'backup-erase',
      device: 'desktop',
      alt: {
        ar: 'نافذة حذف كل البيانات نهائياً: تحذير، وتاريخ آخر نسخة احتياطية، وخانة كتابة كلمة حذف، وزر تصدير نسخة أولاً',
        en: 'The Erase all data for good dialog: a warning, the last backup date, the box to type ERASE, and the Export a backup first button',
      },
      recipe: `${DESK} ${EXPORT} Then click **Erase all data** ([data-qa="reset-all"]) in the Danger zone. Wait 600 ms. Crop to the dialog (.modal). Markers: 2 on **Export a backup first**, 3 on the confirmation box ([data-qa="confirm-word"]) and on **Erase all data** in the footer (two markers, both 3). Close with **Cancel** (do not erase).`,
    },
  ],
}
export default topic

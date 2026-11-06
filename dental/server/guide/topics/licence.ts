import type { GuideTopic } from '../types'

// Shots: the demo clinic with the clock and the trial bar as in store/scripts/shoot.mjs, on Settings → Licence
// (#/settings/license). The shots run in a browser, where the device number is a random one kept in localStorage
// (the runner keeps it the same for a whole lane) and the seller box shows (a copy not installed from Google Play).
// The activated and website pictures use real licence keys issued through the control panel API of a local copy of
// the Worker (server/, `wrangler dev --local`), with the app's call to https://dentora.raqeem.dev/api/activate handed
// to that local Worker (see store/scripts/guide-shots/licence.mjs and scripts/qa/licence-key-live.mjs). The keys in
// the pictures are test keys of that throwaway database; the error state is a real refusal (a key never issued).
const DESK = 'Desktop 1440×900, demo clinic as store/scripts/shoot.mjs makes it (seedAndLogin + Settings → Backup → Load demo data; English shots use its englishClinic() names), signed in as the admin (Dr. Ahmad Al-Khatib), clock fixed at Sunday 11 Oct 2026 11:40 Asia/Damascus, trial started at that same instant (7 days left), trial bar hidden ([data-qa="trial-bar"]{display:none}), page scrolled to the top.'
const PHONE = 'Phone 390×844 (isMobile, hasTouch, deviceScaleFactor 3), same demo clinic, clock and hidden trial bar.'
const LICENCE = 'Route #/settings/license and wait for the device number ([data-qa="device-number"]).'
const WORKER = 'A local Worker (cd server && npx wrangler dev --port 4882 --local, server/.dev.vars with ADMIN_PASSWORD and LICENSE_PRIVATE_JWK) answering as dentora.raqeem.dev: the browser context routes POST https://dentora.raqeem.dev/api/activate to http://localhost:4882/api/activate as it is. A key is issued first through the panel API (POST /api/login, then POST /api/keys with X-Dentora: 1).'

const topic: GuideTopic = {
  slug: 'licence',
  order: 17,
  icon: 'keyRound',
  title: { ar: 'الترخيص والتفعيل', en: 'Licence and activation' },
  summary: {
    ar: 'سبعة أيام تجريبية بكل الميزات، ثم تفعيل لجهاز واحد بمفتاح ترخيص عبر الإنترنت مرة واحدة، أو برمز مصنوع لرقم جهازك يعمل دون إنترنت. ما يُرسل وما لا يُرسل، وما يحدث إن انتهت التجربة أو الترخيص.',
    en: 'A 7-day trial with every feature, then activation for one device with a licence key (online, once) or a code made for your device number (no internet). What is sent and what is not, and what happens when the trial or the licence ends.',
  },
  metaDescription: {
    ar: 'تجربة 7 أيام بكل الميزات، ثم تفعيل لجهاز واحد بمفتاح ترخيص عبر الإنترنت مرة واحدة أو برمز لرقم جهازك دون إنترنت، وما يُرسَل وما يحدث عند انتهاء التجربة.',
    en: 'A 7-day trial with every feature, then activation for one device by licence key (online, once) or by a code for your device (offline), and what is sent.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'الفترة التجريبية وما بعدها', en: 'The trial and what comes after' },
      text: {
        ar: [
          'مع أول فتح لـ Dentora تبدأ فترة تجريبية مجانية مدتها 7 أيام بكل الميزات، دون تسجيل ولا حساب ولا إنترنت. يظهر أعلى الشاشة شريط أصفر بعدد الأيام المتبقية وزر **تفعيل الآن** الذي يفتح شاشة الترخيص.',
          'بعد اليوم السابع يصبح البرنامج في **وضع القراءة فقط**: تفتح كل الملفات والمواعيد والفواتير وتطبعها وتحفظ نسخة احتياطية، لكن الإضافة والتعديل والحذف تتوقف حتى تفعّل. يتحوّل الشريط إلى الأحمر بعبارة «انتهت الفترة التجريبية. فعّل النظام لمتابعة العمل.»',
          'لا يُحذف شيء مما أدخلته: ما إن تفعّل الترخيص حتى يعود كل شيء كما كان، على ويندوز وأندرويد. وتستطيع التفعيل في أي يوم، أثناء التجربة أو بعدها.',
        ],
        en: [
          'The first time Dentora opens, a free 7-day trial starts with every feature, with no sign-up, no account and no internet. A yellow bar at the top shows the days left and an **Activate now** button that opens the Licence screen.',
          'After the seventh day Dentora goes into **Read-only mode**: you still open every file, appointment and invoice, print them and save a backup, but adding, editing and deleting stop until you activate. The bar turns red: “The trial has ended. Activate to keep working.”',
          'Nothing you entered is deleted: the moment you activate, everything is back as it was, on Windows and on Android. You can activate on any day, during the trial or after it.',
        ],
      },
      tips: {
        ar: [
          'تُحسب الأيام السبعة من أول فتح للبرنامج، لا من إكمال الإعداد ولا من تسجيل أول مريض.',
          'في وضع القراءة فقط تستطيع أيضاً تغيير اللغة والخط والمظهر والقفل التلقائي، والدخول والخروج، وتفعيل الترخيص بالطبع. أما استعادة نسخة احتياطية وتحميل البيانات التجريبية وحذف كل البيانات وتغييرات الفريق وبيانات العيادة فتنتظر التفعيل. انظر [النسخ الاحتياطي](backup#demo-erase) و[الفريق](staff#forgot-pin).',
          'يعتمد البرنامج على ساعة الجهاز ويتذكر آخر تاريخ رآه: إرجاع تاريخ الجهاز إلى الوراء لا يعيد أيام التجربة ولا يحيي ترخيصاً انتهى. وإن كان تاريخ الجهاز أقدم من آخر تاريخ معروف يظهر في شاشة الترخيص تنبيه «تاريخ هذا الجهاز أقدم من آخر مرة استُخدم فيها البرنامج…» يطلب ضبط التاريخ والوقت. انظر [التاريخ خاطئ](faq#trouble).',
          'ترى حالة الترخيص في أي وقت من **الإعدادات** ← **الترخيص**.',
        ],
        en: [
          'The seven days count from the first time Dentora opens, not from finishing the setup or adding the first patient.',
          'In read-only mode you can still change the language, font, appearance and auto-lock, sign in and out, and of course activate. Restoring a backup, loading the demo data, erasing all data, team changes and the clinic’s details wait for activation. See [Backup](backup#demo-erase) and [Staff](staff#forgot-pin).',
          'Dentora follows the device’s clock and remembers the latest date it has seen: setting the device’s date back never gives trial days back or revives an ended licence. When the device’s date is earlier than the latest date known, the Licence screen shows “The date on this device is earlier than the last time Dentora was used…” and asks you to set the date and time. See [Wrong date](faq#trouble).',
          'You can see the licence state at any time in **Settings** → **Licence**.',
        ],
      },
      shots: ['licence-expired'],
    },
    {
      id: 'screen',
      title: { ar: 'شاشة الترخيص ورقم الجهاز', en: 'The Licence screen and your device number' },
      text: {
        ar: ['كل ما يخص الترخيص في شاشة واحدة: حالته، ورقم جهازك، وخانة التفعيل، وطريقة الشراء.'],
        en: ['Everything about the licence is on one screen: its state, your device number, the activation field and how to buy.'],
      },
      steps: {
        ar: [
          'افتح **الإعدادات** من القائمة الجانبية (على الهاتف: **المزيد** ← **الإعدادات**)، ثم اختر **الترخيص**. أو انقر على **تفعيل الآن** في الشريط الأصفر.',
          'في البطاقة الأولى حالة البرنامج: **نسخة تجريبية** مع **الأيام المتبقية** وتاريخ انتهاء التجربة، أو **النظام مفعّل** مع الباقة، أو **انتهت الفترة التجريبية** مع شارة **وضع القراءة فقط**.',
          'في بطاقة **رقم الجهاز** رقم ثابت من 8 خانات خاص بهذا الجهاز، مثل 7KQ4-M2XD. انقر على **نسخ الرقم** لنسخه، فتحتاج إليه حين تطلب رمزاً أو تفعّل من الموقع.',
          'في بطاقة **إدخال رمز التفعيل أو مفتاح الترخيص** خانة واحدة تقبل الاثنين، وزر **تفعيل**.',
          'وفي الأسفل بطاقة **كيف أحصل على رمز التفعيل؟** بالخطوات الثلاث، ورقم واتساب البائع والسعر، وزر **طلب عبر واتساب**.',
        ],
        en: [
          'Open **Settings** from the sidebar (on a phone: **More** → **Settings**), then choose **Licence**. Or click **Activate now** in the yellow bar.',
          'The first card shows the state: **Trial version** with the **Days left** and the trial’s end date, **Activated** with the plan, or **Trial ended** with a **Read-only mode** badge.',
          'The **Device number** card shows a fixed 8-character number of this device, such as 7KQ4-M2XD. Click **Copy number** to copy it: you need it when asking for a code or activating on the website.',
          'The **Enter an activation code or licence key** card has one field that takes either, and the **Activate** button.',
          'At the bottom, the **How do I get an activation code?** card lists the three steps, the seller’s WhatsApp number and the price, with a **Request on WhatsApp** button.',
        ],
      },
      tips: {
        ar: [
          'رقم الجهاز لا يكشف شيئاً عن بياناتك، ويبقى نفسه بعد إعادة التثبيت والاستعادة. وتجده أيضاً في **الإعدادات** ← **حول البرنامج** وفي شاشة **نسيت رمز الدخول؟**. انظر [حول البرنامج](settings#about).',
          'إن ظهرت رسالة «تعذّرت قراءة رقم هذا الجهاز» فانقر على **إعادة المحاولة**، وإن تكررت فأغلق البرنامج وافتحه من جديد. بياناتك محفوظة كما هي.',
          'يفتح كل أعضاء الفريق شاشة الترخيص ويستطيعون التفعيل، أما **إلغاء التفعيل على هذا الجهاز** فللمدير وحده.',
        ],
        en: [
          'The device number reveals nothing about your data, and stays the same after a reinstall or a restore. You also find it in **Settings** → **About** and on the **Forgot your PIN?** screen. See [About](settings#about).',
          'If “This device’s number could not be read” appears, click **Try again**; if it keeps happening, close Dentora and open it again. Your data is safe.',
          'Everyone on the team can open the Licence screen and activate; **Deactivate on this device** is for the admin only.',
        ],
      },
      shots: ['licence-trial'],
    },
    {
      id: 'key',
      title: { ar: 'التفعيل بمفتاح الترخيص من داخل البرنامج', en: 'Activating with a licence key inside Dentora' },
      text: {
        ar: ['مفتاح الترخيص 16 خانة من أحرف وأرقام تُكتب على شكل XXXX-XXXX-XXXX-XXXX، ويبيعه البائع دون أن يعرف رقم جهازك. يحوّله البرنامج إلى رمز تفعيل لجهازك عبر الإنترنت، مرة واحدة فقط، ثم يعمل بعدها دون إنترنت كالمعتاد. يحتاج ذلك إلى Dentora 1.1.0 أو أحدث؛ في الإصدار 1.0.0 استخدم [صفحة التفعيل في الموقع](licence#website).'],
        en: ['A licence key is 16 letters and digits written XXXX-XXXX-XXXX-XXXX, which the seller sells without knowing your device number. Dentora turns it into an activation code for your device over the internet, once only, and then works offline as usual. This needs Dentora 1.1.0 or later; with 1.0.0 use the [activation page on the website](licence#website).'],
      },
      steps: {
        ar: [
          'وصِل هذا الجهاز بالإنترنت لهذه المرة.',
          'افتح **الإعدادات** ← **الترخيص**، والصق في خانة **رمز التفعيل أو مفتاح الترخيص** رسالة البائع كما وصلتك، أو المفتاح وحده. يستخرج البرنامج المفتاح من الرسالة، وتظهر تحت الخانة شارة **مفتاح ترخيص** وعبارة تذكّرك بما سيُرسل.',
          'انقر على **تفعيل**. تظهر «جارٍ الاتصال بخادم التفعيل…» لثوانٍ، ثم رسالة **تم تفعيل النظام بنجاح** مع اسم الباقة، ويختفي الشريط الأصفر.',
        ],
        en: [
          'Connect this device to the internet, for this once.',
          'Open **Settings** → **Licence** and paste the seller’s message as it came, or just the key, into **Activation code or licence key**. Dentora picks the key out of the message, and a **Licence key** badge appears under the field with a note on what will be sent.',
          'Click **Activate**. “Contacting the activation server…” shows for a few seconds, then **Activated successfully** with the plan’s name, and the yellow bar disappears.',
        ],
      },
      tips: {
        ar: [
          'يُرسل في هذه الخطوة المفتاح ورقم الجهاز فقط إلى dentora.raqeem.dev، ولا شيء من بيانات العيادة. انظر [ما الذي يُرسل؟](licence#privacy).',
          'يرتبط المفتاح نهائياً بأول جهاز يُفعَّل عليه، فلا يعمل على جهاز ثانٍ. احتفظ برسالة البائع: إن أعدت تثبيت البرنامج على الجهاز نفسه يعطيك المفتاح نفسه الرمز نفسه مرة أخرى.',
          'إن لصقت نصاً فيه أكثر من مفتاح (قائمة موزّع مثلاً) يعرضها البرنامج مفتاحاً في كل سطر ويطلب إبقاء واحد: كل مفتاح يفعّل جهازاً واحداً.',
          'تعذّر الاتصال؟ تظهر عبارة «تعذّر الوصول إلى خادم التفعيل…» وزر **التفعيل من المتصفح** الذي يفتح صفحة الموقع ورقم جهازك مكتوب فيها. انظر [التفعيل من صفحة الموقع](licence#website).',
          'يُسجَّل التفعيل في **آخر النشاطات** في الشاشة الرئيسية باسم الباقة.',
        ],
        en: [
          'This step sends only the key and the device number to dentora.raqeem.dev, nothing from the clinic’s data. See [What is sent?](licence#privacy).',
          'The key is tied for good to the first device it is activated on, so it does not work on a second device. Keep the seller’s message: if you reinstall Dentora on the same device, the same key gives you the same code again.',
          'If you paste a text holding more than one key (a reseller’s list, say), Dentora shows them one per line and asks you to keep one: each key activates one device.',
          'No connection? “Could not reach the activation server…” appears with an **Activate in the browser** button, which opens the website page with your device number filled in. See [Activating on the website](licence#website).',
          'The activation is recorded under **Recent activity** on the dashboard, with the plan’s name.',
        ],
      },
      shots: ['licence-key-phone'],
    },
    {
      id: 'code',
      title: { ar: 'التفعيل برمز مصنوع لرقم جهازك', en: 'Activating with a code made for your device number' },
      text: {
        ar: ['الطريقة الثانية لا تحتاج إلى إنترنت على جهاز العيادة: ترسل رقم الجهاز إلى البائع، فيصدر لك رمز تفعيل من 112 خانة خاصاً بهذا الجهاز، تلصقه في الخانة نفسها.'],
        en: ['The second way needs no internet on the clinic’s device: you send the device number to the seller, who issues a 112-character activation code for that device, and you paste it into the same field.'],
      },
      steps: {
        ar: [
          'في شاشة الترخيص انقر على **اطلب كود التفعيل عبر واتساب** (الزر الأخضر في البطاقة الأولى) أو على **طلب عبر واتساب** في الأسفل: يُفتح واتساب على محادثة البائع والرسالة مكتوبة باسم عيادتك ورقم جهازك، فأرسلها. أو انسخ **رقم الجهاز** بزر **نسخ الرقم** وأرسله بالطريقة التي تناسبك.',
          'تصلك رسالة فيها رمز التفعيل. الصق الرسالة كلها، أو الرمز وحده، في خانة **رمز التفعيل أو مفتاح الترخيص**؛ يبيّن العدّاد تحت الخانة كم خانة وصلت من 112.',
          'انقر على **تفعيل**. يتحقق البرنامج من الرمز على الجهاز نفسه دون إنترنت، وتظهر **تم تفعيل النظام بنجاح**.',
        ],
        en: [
          'On the Licence screen click **Request your activation code on WhatsApp** (the green button in the first card) or **Request on WhatsApp** further down: WhatsApp opens on the seller’s chat with the message written, with your clinic’s name and device number; send it. Or copy the **Device number** with **Copy number** and send it any way you like.',
          'A message with your activation code comes back. Paste the whole message, or the code alone, into **Activation code or licence key**; the counter under the field shows how many of the 112 characters are in.',
          'Click **Activate**. Dentora checks the code on the device itself, with no internet, and shows **Activated successfully**.',
        ],
      },
      tips: {
        ar: [
          'الرمز مرتبط برقم جهازك: رمز جهاز آخر يُرفض بعبارة «هذا الرمز صادر لجهاز آخر…». احتفظ برسالة البائع لتلصقها من جديد إن احتجت.',
          'على ويندوز يُفتح رابط واتساب في المتصفح لتكمل في واتساب ويب أو تطبيق واتساب على الحاسوب، وعلى أندرويد يُفتح تطبيق واتساب. وإن كان للبائع بريد إلكتروني يظهر أيضاً زر **طلب عبر البريد**.',
          'رمز إعادة تعيين رمز الدخول، الذي يصلك إن نسي المدير رمزه، لا يُقبل هنا: يُدخل من شاشة الدخول. انظر [نسيت رمز الدخول؟](staff#forgot-pin).',
        ],
        en: [
          'The code belongs to your device number: a code for another device is refused with “This code was issued for another device…”. Keep the seller’s message so you can paste it again if you ever need to.',
          'On Windows the WhatsApp link opens in the browser, where you continue in WhatsApp Web or the WhatsApp desktop app; on Android the WhatsApp app opens. When the seller has an email address, a **Request by email** button shows too.',
          'A PIN reset code, the one you get when the admin forgets their PIN, is not accepted here: it goes in on the sign-in screen. See [Forgot your PIN?](staff#forgot-pin).',
        ],
      },
      shots: ['licence-buy'],
    },
    {
      id: 'website',
      title: { ar: 'التفعيل من صفحة الموقع', en: 'Activating on the website' },
      text: {
        ar: ['إن كان البرنامج على جهاز لا يصل إلى الإنترنت، أو كان إصداره 1.0.0 الذي لا يقبل المفتاح في الخانة، فحوّل المفتاح إلى رمز من صفحة التفعيل في موقع Dentora، على أي جهاز متصل بالإنترنت، كهاتفك.'],
        en: ['When Dentora is on a device with no internet, or it is version 1.0.0, which takes no key in the field, turn the key into a code on the activation page of the Dentora website, on any device that is online, such as your phone.'],
      },
      steps: {
        ar: [
          'انسخ **رقم الجهاز** من شاشة الترخيص.',
          'افتح dentora.raqeem.dev/activate في المتصفح (بالإنجليزية: dentora.raqeem.dev/en/activate). وإن فتحتها بزر **التفعيل من المتصفح** داخل البرنامج تجد رقم جهازك مكتوباً مسبقاً.',
          'اكتب **رقم الجهاز** و**مفتاح الترخيص** (أو الصق رسالة البائع كلها)، وتأكد من رقم الجهاز: يرتبط المفتاح به نهائياً.',
          'انقر على **احصل على رمز التفعيل**. يظهر الرمز كبيراً مع الباقة والصلاحية، فانقر على **نسخ الرمز**.',
          'عد إلى Dentora ← **الإعدادات** ← **الترخيص**، والصق الرمز في الخانة وانقر على **تفعيل**. لا يحتاج البرنامج إلى الإنترنت في هذه الخطوة، وإن كانت الصفحة على جهاز آخر فأرسل الرمز إلى نفسك عبر واتساب أو البريد.',
        ],
        en: [
          'Copy the **Device number** from the Licence screen.',
          'Open dentora.raqeem.dev/en/activate in a browser (Arabic: dentora.raqeem.dev/activate). If you open it with **Activate in the browser** inside Dentora, your device number is already filled in.',
          'Type the **Device number** and the **Licence key** (or paste the seller’s whole message), and check the device number: the key is tied to it for good.',
          'Click **Get activation code**. The code appears large, with the plan and validity; click **Copy code**.',
          'Back in Dentora → **Settings** → **Licence**, paste the code into the field and click **Activate**. Dentora needs no internet for this step; if the page is on another device, send the code to yourself by WhatsApp or email.',
        ],
      },
      tips: {
        ar: [
          'تعطي الصفحة الرمز نفسه مرة أخرى للجهاز نفسه ما دام الترخيص سارياً، فاحتفظ بالمفتاح لإعادة التثبيت.',
          'لكل رفض عبارته في الصفحة: مفتاح غير مكتمل، أو غير موجود، أو مفعّل على جهاز آخر، أو مُلغى، أو انقضت مهلته، أو محاولات كثيرة من الاتصال نفسه (انتظر الدقائق المذكورة). وفيها زر **راسلنا على واتساب** للمساعدة.',
          'لا تحتاج الصفحة إلى حساب، ولا تُرسل سوى المفتاح ورقم الجهاز.',
        ],
        en: [
          'The page gives the same device the same code again while the licence is valid, so keep the key for a reinstall.',
          'Every refusal has its own sentence on the page: an incomplete key, one that does not exist, one already activated on another device, a cancelled one, one past its deadline, or too many attempts from the same connection (wait the minutes it names). The page has a **Message us on WhatsApp** button for help.',
          'The page needs no account and sends nothing but the key and the device number.',
        ],
      },
      shots: ['licence-website', 'licence-website-done'],
    },
    {
      id: 'errors',
      title: { ar: 'حين لا يُقبل ما أدخلته', en: 'When what you entered is not accepted' },
      text: {
        ar: [
          'تظهر العبارة بالأحمر تحت الخانة، ولا يتغير شيء في البرنامج ولا في بياناتك. هذا معنى كل عبارة وما تفعله:',
          '**«ما أدخلته غير مكتمل أو فيه خطأ…» أو «المفتاح غير مكتمل أو فيه خطأ…»**: الصق الرسالة من جديد كما وصلتك. الرمز 112 خانة والمفتاح 16 خانة، وليس فيهما 0 ولا O ولا 1 ولا I.',
          '**«هذا الرمز صادر لجهاز آخر…»**: الرمز لا يطابق رقم هذا الجهاز. أرسل رقم هذا الجهاز إلى البائع.',
          '**«انتهت صلاحية هذا الرمز…»**: انقضى آخر يوم في الرمز، ويلزم رمز جديد.',
          '**«هذا رمز لإعادة تعيين رمز الدخول…»**: يُدخل من شاشة الدخول عبر **نسيت رمز الدخول؟**، لا هنا.',
          '**«تعذّر الوصول إلى خادم التفعيل…»**: لا إنترنت على الجهاز، أو اتصال بطيء جداً (ينتظر البرنامج 20 ثانية). تأكد من الاتصال وأعد المحاولة، أو انقر على **التفعيل من المتصفح**.',
          '**«تعذّر على خادم التفعيل إتمام الطلب الآن…»**: عطل مؤقت في الخادم. أعد المحاولة بعد قليل.',
          '**«لا يوجد مفتاح ترخيص مطابق لما أدخلته…»**: المفتاح غير معروف. قارنه خانةً خانة برسالة البائع.',
          '**«هذا المفتاح مفعّل على جهاز آخر…»**: استُخدم المفتاح على جهاز غير هذا. لنقل الترخيص إلى هذا الجهاز تواصل مع البائع.',
          '**«أُلغي هذا المفتاح…»**: ألغى البائع المفتاح أو استُردّ ثمنه.',
          '**«لم يعد يمكن استخدام هذا المفتاح…»**: انقضت مهلة تفعيله، أو انتهى الترخيص الذي أعطاه لهذا الجهاز. اطلب مفتاحاً جديداً.',
          '**«محاولات خاطئة كثيرة من هذا الاتصال…»**: انتظر الدقائق المذكورة ثم أعد المحاولة.',
          '**«لم يقبل خادم التفعيل رقم هذا الجهاز…» أو «لم يجتز رمز التفعيل الذي أرسله الخادم فحصَ البرنامج…»**: نادران. أغلق البرنامج وافتحه من جديد وأعد المحاولة، وإن تكرر الأمر فتواصل مع البائع.',
          '**«يحوي النص أكثر من مفتاح ترخيص…»**: أبقِ مفتاحاً واحداً في الخانة.',
        ],
        en: [
          'The sentence shows in red under the field, and nothing changes in Dentora or in your data. What each one means and what to do:',
          '**“What you entered is incomplete or has a typo…” or “That key is incomplete or has a typo…”**: paste the message again exactly as it came. A code has 112 characters and a key 16, and neither holds 0, O, 1 or I.',
          '**“This code was issued for another device…”**: the code does not match this device’s number. Send this device’s number to the seller.',
          '**“This code has expired…”**: the code’s last day has passed; a new code is needed.',
          '**“This is a PIN reset code…”**: it goes in on the sign-in screen under **Forgot your PIN?**, not here.',
          '**“Could not reach the activation server…”**: no internet on the device, or a very slow connection (Dentora waits 20 seconds). Check the connection and try again, or click **Activate in the browser**.',
          '**“The activation server could not complete the request right now…”**: a temporary fault on the server. Try again shortly.',
          '**“No licence key matches what you entered…”**: the key is unknown. Compare it character by character with the seller’s message.',
          '**“This key is already activated on another device…”**: the key was used on a device other than this one. To move the licence to this device, contact the seller.',
          '**“This key has been cancelled…”**: the seller cancelled or refunded the key.',
          '**“This key can no longer be used…”**: its activation deadline has passed, or the licence it gave this device has ended. Ask for a new key.',
          '**“Too many failed attempts from this connection…”**: wait the minutes it names, then try again.',
          '**“The activation server did not accept this device’s number…” or “The activation code sent by the server did not pass Dentora’s own check…”**: both rare. Close Dentora, open it again and try once more; if it happens again, contact the seller.',
          '**“The text holds more than one licence key…”**: keep one key in the field.',
        ],
      },
      tips: {
        ar: [
          'إن لم تحل العبارة المشكلة فراسل الجهة التي اشتريت منها، ومعك رقم جهازك ورقم الإصدار من **الإعدادات** ← **حول البرنامج**.',
          'الخانة تقبل الحروف الكبيرة والصغيرة، والأرقام العربية (٠–٩)، مع المسافات والشرطات أو بدونها: لا تعد كتابة الرمز يدوياً، بل الصقه.',
        ],
        en: [
          'If the sentence does not solve it, message whoever sold you Dentora, with your device number and the version from **Settings** → **About**.',
          'The field takes upper and lower case, Arabic-Indic digits (٠–٩), with or without spaces and dashes: never retype a code by hand, paste it.',
        ],
      },
      shots: ['licence-error'],
    },
    {
      id: 'after',
      title: { ar: 'بعد التفعيل: الباقة والصلاحية والتجديد', en: 'After activation: plan, validity and renewal' },
      text: {
        ar: [
          'بعد التفعيل تقول البطاقة الأولى **النظام مفعّل** مع شارة الباقة كما باعها لك البائع: **الباقة الأساسية** أو **الباقة الاحترافية**.',
          'وتحتها الصلاحية: **ترخيص دائم** و«لا ينتهي»، أو **صالح حتى** مع آخر يوم و**الأيام المتبقية**. ترخيص السنة أو السنتين المشترى بمفتاح يُحسب من يوم تفعيله، أما الرمز المصنوع لجهازك فآخر يومه ما اختاره البائع.',
        ],
        en: [
          'Once activated, the first card says **Activated** with the plan badge as the seller sold it: **Standard plan** or **Pro plan**.',
          'Under it comes the validity: **Lifetime licence** and “Never expires”, or **Valid until** with the last day and the **Days left**. A one- or two-year licence bought as a key counts from the day it was activated; a code made for your device ends on the day the seller chose.',
        ],
      },
      steps: {
        ar: [
          'قبل انتهاء الترخيص بثلاثين يوماً يظهر في البطاقة تنبيه «ينتهي الترخيص في … جدّده مبكراً حتى لا يتوقف العمل.» اطلب رمزاً أو مفتاحاً جديداً من البائع.',
          'للتجديد أو الترقية انقر على **إدخال رمز جديد**، فتظهر الخانة من جديد: الصق الرمز أو المفتاح الجديد وانقر على **تفعيل**، أو على **إلغاء** للتراجع.',
          'لتحرير هذا الجهاز انقر على **إلغاء التفعيل على هذا الجهاز** في أسفل الشاشة (للمدير وحده) وأكّد بـ **إلغاء التفعيل**: يُحذف الرمز من الجهاز ويعود البرنامج إلى الفترة التجريبية، أو إلى وضع القراءة فقط إن كانت قد انتهت. احتفظ بالرمز لتفعّل به لاحقاً.',
        ],
        en: [
          'Thirty days before the licence ends, the card warns “Your licence ends on … Renew early to avoid any interruption.” Ask the seller for a new code or key.',
          'To renew or upgrade, click **Enter a new code**: the field comes back. Paste the new code or key and click **Activate**, or **Cancel** to leave things as they are.',
          'To free this device, click **Deactivate on this device** at the bottom of the screen (admin only) and confirm with **Deactivate**: the code is removed from the device and Dentora goes back to the trial, or to read-only mode if the trial is over. Keep the code to activate again later.',
        ],
      },
      tips: {
        ar: [
          'آخر يوم في الترخيص يوم كامل: يبقى البرنامج مفعّلاً حتى نهايته.',
          'إن انقضى آخر يوم تصبح الحالة **انتهى الترخيص**، ويقول الشريط العلوي «انتهى ترخيص Dentora في …» مع زر **إدخال رمز جديد**، ويعمل البرنامج للقراءة فقط حتى تُدخل رمزاً جديداً. لا يُحذف شيء.',
          'الرمز الجديد يحل محل القديم على هذا الجهاز، فلا يجتمع ترخيصان.',
        ],
        en: [
          'The last day of the licence is a whole day: Dentora stays activated until it ends.',
          'Once that day has passed, the state becomes **Licence expired**, the top bar says “Your Dentora licence ended on …” with an **Enter a new code** button, and Dentora is read-only until you enter a new code. Nothing is deleted.',
          'A new code replaces the old one on this device; two licences never add up.',
        ],
      },
      shots: ['licence-active'],
    },
    {
      id: 'coverage',
      title: { ar: 'ماذا يغطي الترخيص؟ جهاز واحد', en: 'What the licence covers: one device' },
      text: {
        ar: [
          'الترخيص، رمزاً كان أو مفتاحاً، لجهاز واحد برقم جهاز واحد. ولا يزامن Dentora الأجهزة، فالعيادة التي تعمل على حاسوب وهاتف معاً تحتاج إلى ترخيص لكل منهما.',
          '**جهاز جديد**: للجهاز الجديد رقم جهاز جديد، فلا يعمل عليه رمزك القديم، ويرفض المفتاح المستخدم بعبارة «هذا المفتاح مفعّل على جهاز آخر». انقل بياناتك بالنسخة الاحتياطية، ثم تواصل مع البائع لنقل الترخيص. انظر [نقل العيادة إلى جهاز جديد](backup#new-device).',
          '**إعادة التثبيت على الجهاز نفسه**: على ويندوز تبقى البيانات والتفعيل كما هما بعد تحديث النسخة المنزَّلة من الموقع أو إعادة تثبيتها. أما على أندرويد، وفي نسخة متجر Microsoft، فيمسح حذف التطبيق كل شيء ومنه التفعيل: بعد التثبيت من جديد استعد نسختك الاحتياطية، ثم الصق رسالة البائع (الرمز) مرة أخرى، أو أدخل مفتاحك فيعطيك الرمز نفسه.',
          '**الاستعادة وحذف كل البيانات**: لا تحمل النسخة الاحتياطية التفعيل، ولا تمسحه الاستعادة ولا **حذف كل البيانات**: يبقى التفعيل على الجهاز.',
        ],
        en: [
          'A licence, code or key, is for one device with one device number. Dentora does not sync devices, so a clinic that works on a computer and a phone needs a licence for each.',
          '**A new device**: a new device has a new device number, so your old code does not work on it, and a used key is refused with “This key is already activated on another device”. Move your data with a backup, then contact the seller to move the licence. See [Moving the clinic to a new device](backup#new-device).',
          '**Reinstalling on the same device**: on Windows your data and the activation stay as they are through an update or a reinstall of the version from the website. On Android, and in the Microsoft Store version, uninstalling the app erases everything, the activation included: after installing again, restore your backup, then paste the seller’s message (the code) again, or enter your key, which gives the same code.',
          '**Restoring and erasing**: a backup does not carry the activation, and neither a restore nor **Erase all data** removes it: the activation stays on the device.',
        ],
      },
      tips: {
        ar: [
          'نسخة جهاز مفعّل لا تفعّل جهازاً آخر: الترخيص ليس في ملف النسخة.',
          'على ويندوز تُحفظ البيانات والتفعيل داخل حساب مستخدم ويندوز، أما رقم الجهاز فللحاسوب كله: إن فتح أحدٌ البرنامج بحساب ويندوز آخر فسيرى عيادة فارغة في الفترة التجريبية، والرمز نفسه يفعّلها.',
        ],
        en: [
          'A backup of an activated device does not activate another one: the licence is not in the backup file.',
          'On Windows the data and the activation live inside the Windows user account, while the device number belongs to the computer: someone who opens Dentora under another Windows account sees an empty clinic on trial, and the same code activates it.',
        ],
      },
    },
    {
      id: 'privacy',
      title: { ar: 'ما الذي يُرسل إلى الإنترنت، وما لا يُرسل', en: 'What is sent to the internet, and what is not' },
      text: {
        ar: [
          'لا يرسل Dentora بيانات العيادة أو المرضى إلى أي مكان، أبداً. المرة الوحيدة التي يتصل فيها بخادم هي تفعيل مفتاح ترخيص: يرسل حينها المفتاح ورقم الجهاز (رقم مشتق من الجهاز، لا من بياناتك) إلى dentora.raqeem.dev، مرة واحدة، ليستلم رمز التفعيل. وتستلم صفحة التفعيل في الموقع القيمتين نفسيهما.',
          'يحفظ الخادم مع سجل البيع رقم الجهاز الذي ارتبط بالمفتاح، والرمز الذي أصدره، ووقت التفعيل، ما دام سجل البيع محفوظاً: هو دليل استخدام المفتاح، وبه يُرفض على جهاز ثانٍ. ويسجّل عنوان الاتصال عند محاولة فاشلة، وحده، ليعدّ المحاولات 15 دقيقة ويمنع التخمين، ويُحذف ذلك السجل مع أول طلب تفعيل بعدها.',
          'رمز التفعيل المصنوع لرقم جهازك لا يحتاج إلى أي اتصال: يتحقق منه البرنامج على الجهاز نفسه.',
          '**النسخة المثبتة من Google Play**: لا تعرض سعراً ولا زر طلب عبر واتساب ولا زر **التفعيل من المتصفح** ولا روابط إلى الموقع (ومنها روابط هذا الدليل)، وتقول خطوات بطاقة الشراء فيها: أرسل رقم الجهاز مع اسم العيادة إلى الجهة التي اشتريت منها ترخيص Dentora. أما خانة الرمز والمفتاح وصفحة الموقع فتعمل فيها كما في غيرها.',
        ],
        en: [
          'Dentora never sends clinic or patient data anywhere. The only time it contacts a server is when you activate a licence key: it then sends the key and the device number (a number derived from the device, not from your data) to dentora.raqeem.dev, once, to receive the activation code. The activation page on the website receives the same two values.',
          'The server keeps, with the sale record, the device number the key was tied to, the code it issued and the activation time, for as long as that sale record is kept: it is the proof the key was used, and what refuses it on a second device. It records the address of a failed attempt, on its own, to count attempts for 15 minutes and stop guessing, and that entry is deleted with the next activation request after that.',
          'An activation code made for your device number needs no connection at all: Dentora checks it on the device itself.',
          '**A copy installed from Google Play** shows no price, no WhatsApp request button, no **Activate in the browser** button and no links to the website (this guide’s included), and its buying card says: send the device number with the clinic name to whoever sold you the Dentora licence. The code and key field and the website page work in it like anywhere else.',
        ],
      },
      tips: {
        ar: ['سياسة الخصوصية كاملة من **الإعدادات** ← **حول البرنامج** ← **سياسة الخصوصية**، أو في موقع Dentora. انظر [حول البرنامج](settings#about).'],
        en: ['The full privacy policy is under **Settings** → **About** → **Privacy policy**, or on the Dentora website. See [About](settings#about).'],
      },
    },
  ],
  shots: [
    {
      id: 'licence-expired',
      device: 'desktop',
      alt: {
        ar: 'بطاقة الحالة بعد انتهاء الفترة التجريبية: انتهت الفترة التجريبية، شارة وضع القراءة فقط، وشرح أن البيانات محفوظة ولن يُحذف منها شيء، وزر اطلب كود التفعيل عبر واتساب',
        en: 'The state card after the trial: Trial ended, a Read-only mode badge, the note that your data is safe and nothing will be deleted, and the Request your activation code on WhatsApp button',
      },
      caption: { ar: 'بعد اليوم السابع: قراءة فقط، ولا يُحذف شيء.', en: 'After the seventh day: read-only, and nothing is deleted.' },
      recipe: `${DESK} Move the trial start 8 days back (settings 'installedAt' = 3 Oct 2026, in one transaction over every table as a restore does) and reload: the app is read-only. ${LICENCE} Crop to the state card ([data-qa="license-status"]), no margin. No markers.`,
    },
    {
      id: 'licence-trial',
      device: 'desktop',
      alt: {
        ar: 'شاشة الترخيص أثناء الفترة التجريبية: الإعدادات مع قسم الترخيص محدداً، بطاقة نسخة تجريبية مع الأيام المتبقية، بطاقة رقم الجهاز مع زر نسخ الرقم، وخانة رمز التفعيل أو مفتاح الترخيص مع زر تفعيل',
        en: 'The Licence screen during the trial: Settings with the Licence section selected, the Trial version card with the days left, the Device number card with Copy number, and the Activation code or licence key field with the Activate button',
      },
      recipe: `${DESK} ${LICENCE} Capture the whole window. Markers: 1 on Licence in the settings section list (.st-nav-item[data-tab="license"]), 2 on the state card ([data-qa="license-status"]), 3 on the device number ([data-qa="device-number"]), 4 on the label of the code field ([data-qa="code-input"]).`,
    },
    {
      id: 'licence-key-phone',
      device: 'phone',
      alt: {
        ar: 'بطاقة التفعيل على الهاتف ومفتاح ترخيص ملصق في الخانة: شارة مفتاح ترخيص، وعبارة تبيّن أن المفتاح ورقم الجهاز فقط يُرسلان، وزر تفعيل',
        en: 'The activation card on a phone with a licence key pasted in the field: the Licence key badge, the note that only the key and the device number are sent, and the Activate button',
      },
      caption: { ar: 'الصق المفتاح أو رسالة البائع كلها: يعرف البرنامج أنه مفتاح.', en: 'Paste the key or the seller’s whole message: Dentora knows it is a key.' },
      recipe: `${PHONE} ${LICENCE} Paste the key QW2E-RT3Y-UP4A-SD5F (a well-formed key, never issued) in [data-qa="code-input"]; do not click Activate. Scroll the activation card (the .card holding [data-qa="code-input"]) just under the top bar and capture the screen. Markers: 2 on the field's label, 3 on Activate ([data-qa="activate"]).`,
    },
    {
      id: 'licence-buy',
      device: 'desktop',
      alt: {
        ar: 'بطاقة كيف أحصل على رمز التفعيل؟ بخطواتها الثلاث، واسم البائع ورقم واتساب والسعر، وزر طلب عبر واتساب',
        en: 'The How do I get an activation code? card with its three steps, the seller’s name, WhatsApp number and price, and the Request on WhatsApp button',
      },
      recipe: `${DESK} ${LICENCE} Crop to the card holding [data-qa="buy-whatsapp"] (the last .card of .st-form), no margin. Markers: 1 on Request on WhatsApp ([data-qa="buy-whatsapp"]).`,
    },
    {
      id: 'licence-website',
      device: 'desktop',
      alt: {
        ar: 'صفحة التفعيل في موقع Dentora: خانة رقم الجهاز مكتوبة مسبقاً، وخانة مفتاح الترخيص، وتنبيه بأن المفتاح يرتبط نهائياً برقم الجهاز، وزر احصل على رمز التفعيل',
        en: 'The activation page on the Dentora website: the Device number field already filled in, the Licence key field, the note that the key is tied for good to the device number, and the Get activation code button',
      },
      recipe: `${WORKER} In the same browser open http://localhost:4882/activate?device=<the app's device number> (English: /en/activate), wait for the fonts. Crop to the form card (#act-start), no margin. Markers: 3 on the Device number label (label[for="act-device"]) and on the Licence key label (label[for="act-key"]), 4 on Get activation code (.act-submit).`,
    },
    {
      id: 'licence-website-done',
      device: 'desktop',
      alt: {
        ar: 'صفحة الموقع بعد إصدار الرمز: رمز التفعيل جاهز، الباقة والصلاحية ورقم الجهاز، الرمز كبيراً، زر نسخ الرمز، والخطوة الأخيرة: الصقه في Dentora',
        en: 'The website page once the code is issued: Your activation code is ready, the plan, validity and device number, the code shown large, the Copy code button and the last step: paste it into Dentora',
      },
      recipe: `${WORKER} Issue a key (standard, 1 year). On the activation page with the app's device number filled in, paste the key in #act-key and click Get activation code; wait for #act-done. Crop to #act-done, no margin. Markers: 4 on Copy code (#act-copy).`,
    },
    {
      id: 'licence-error',
      device: 'desktop',
      alt: {
        ar: 'بطاقة التفعيل بعد رفض مفتاح: العبارة الحمراء تحت الخانة «لا يوجد مفتاح ترخيص مطابق لما أدخلته…»',
        en: 'The activation card after a key was refused: the red sentence under the field, “No licence key matches what you entered…”',
      },
      caption: { ar: 'مفتاح غير موجود: العبارة تقول ما حدث وما تفعله.', en: 'A key that does not exist: the sentence says what happened and what to do.' },
      recipe: `${WORKER} ${LICENCE} Paste QW2E-RT3Y-UP4A-SD5F (never issued) in [data-qa="code-input"], click Activate ([data-qa="activate"]) and wait for the red .field-error (the Worker's 404 unknown). Crop to the card holding [data-qa="code-input"], no margin. No markers.`,
    },
    {
      id: 'licence-active',
      device: 'desktop',
      alt: {
        ar: 'شاشة الترخيص بعد التفعيل: النظام مفعّل مع شارة الباقة، الصلاحية (ترخيص دائم أو صالح حتى مع الأيام المتبقية)، زر إدخال رمز جديد، ورابط إلغاء التفعيل على هذا الجهاز',
        en: 'The Licence screen once activated: Activated with the plan badge, the validity (lifetime, or Valid until with the days left), the Enter a new code button and the Deactivate on this device link',
      },
      recipe: `${WORKER} Issue a key (Arabic shot: pro, lifetime; English shot: standard, 1 year). ${LICENCE} Paste the key message in [data-qa="code-input"], click Activate and wait for [data-qa="license-status"][data-status="active"]; hide the toast. Capture the whole window (grown in height when the Deactivate link is below the fold). Markers: 1 on the state card ([data-qa="license-status"]), 2 on Enter a new code ([data-qa="renew"]), 3 on Deactivate on this device ([data-qa="deactivate"]).`,
    },
  ],
}
export default topic

import type { GuideTopic } from '../types'

// How the pictures are made (store/scripts/guide-shots.mjs). Every recipe starts from this state:
const DEMO = "Demo clinic as store/scripts/shoot.mjs makes it (seedAndLogin + Settings → Backup → Load demo data; English shots use its englishClinic() names), signed in as the admin (Dr. Ahmad Al-Khatib), clock fixed at Sunday 11 October 2026 11:40 Asia/Damascus, trial bar hidden ([data-qa=\"trial-bar\"]{display:none}), page scrolled to the top."

const topic: GuideTopic = {
  slug: 'interface',
  order: 2,
  icon: 'panelsTopLeft',
  title: { ar: 'الواجهة والتنقل', en: 'Finding your way around' },
  summary: {
    ar: 'تعرّف على أجزاء الشاشة لتصل إلى أي شيء بسرعة: القائمة الجانبية، والبحث السريع، وزر جديد، والتنبيهات، واللغة والمظهر، والاختصارات، وشكل البرنامج على الهاتف.',
    en: 'Get to know the screen and reach anything in seconds: the sidebar, quick search, the New button, notifications, language and appearance, shortcuts, and how Dentora looks on a phone.',
  },
  metaDescription: {
    ar: 'تعرّف على أجزاء الشاشة لتصل إلى أي شيء بسرعة: القائمة الجانبية، والبحث السريع، وزر جديد، والتنبيهات، واللغة والمظهر، والاختصارات، وشكل البرنامج على الهاتف.',
    en: 'The Dentora screen explained: the sidebar, quick search, the New button, notifications, language and appearance, shortcuts, and the phone layout.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'أجزاء الشاشة', en: 'The parts of the screen' },
      text: {
        ar: [
          "تتكون كل شاشات Dentora من الأجزاء نفسها، فتعتاد عليها بسرعة: قائمة جانبية للتنقل، وشريط علوي فيه البحث والإضافة والتنبيهات، والصفحة نفسها في الوسط.",
          "في الواجهة العربية تكون القائمة على اليمين، وفي الإنجليزية على اليسار.",
        ],
        en: [
          "Every Dentora screen is built from the same parts, so you get used to it quickly: a sidebar to move around, a top bar with search, adding and notifications, and the page itself in the middle.",
          "In the Arabic interface the sidebar is on the right; in English it is on the left.",
        ],
      },
      steps: {
        ar: [
          "انتقل بين الصفحات من القائمة الجانبية، مثل **المرضى** أو **المواعيد**.",
          "ابحث عن أي مريض أو موعد أو فاتورة من خانة البحث في الأعلى.",
          "أضف مريضاً أو موعداً أو دفعة من زر **جديد**.",
          "افتح **التنبيهات** من أيقونة الجرس.",
          "انقر على اسمك أسفل القائمة لتفتح قائمة حسابك.",
        ],
        en: [
          "Move between pages from the sidebar, for example **Patients** or **Appointments**.",
          "Find any patient, appointment or invoice from the search box at the top.",
          "Add a patient, an appointment or a payment from the **New** button.",
          "Open **Notifications** from the bell icon.",
          "Click your name at the bottom of the sidebar to open your account menu.",
        ],
      },
      tips: {
        ar: [
          "ما تراه في القائمة يتبع دورك في العيادة: الصفحات التي لا يسمح بها دورك لا تظهر أصلاً. انظر [الأدوار والصلاحيات](staff#roles).",
          "أثناء الفترة التجريبية يظهر أعلى الصفحة شريط بعدد الأيام المتبقية وزر **تفعيل الآن**. وإن انتهت التجربة يصبح البرنامج للقراءة فقط: ترى بياناتك كلها وتطبعها وتنسخها احتياطياً، لكن الإضافة والتعديل يتوقفان حتى التفعيل. انظر [الترخيص](licence).",
          "تُعرض الأرقام بالصيغة اللاتينية (0–9) في اللغتين.",
        ],
        en: [
          "What you see in the sidebar follows your role in the clinic: pages your role may not open are simply not there. See [Roles and permissions](staff#roles).",
          "During the trial a bar at the top shows the days left and an **Activate now** button. When the trial is over Dentora becomes read-only: you still see, print and back up all your data, but adding and editing stop until you activate. See [Licence](licence).",
          "Numbers use Western digits (0–9) in both languages.",
        ],
      },
      shots: ['interface-overview'],
    },
    {
      id: 'sidebar',
      title: { ar: 'القائمة الجانبية وقائمة حسابك', en: 'The sidebar and your account menu' },
      text: {
        ar: ["في أعلى القائمة اسم عيادتك وشعارها، ثم **الرئيسية**. وتحتها ثلاث مجموعات: **العيادة** (**المواعيد** و**المرضى** و**العلاجات** و**الوصفات** و**المخبر**)، و**المالية** (**الفواتير** و**المدفوعات** و**المصروفات** و**التقارير**)، و**الإدارة** (**المخزون** و**قائمة الإجراءات** و**الفريق** و**الإعدادات**)."],
        en: ["The top of the sidebar shows your clinic’s name and logo, then **Dashboard**. Below come three groups: **Clinical** (**Appointments**, **Patients**, **Treatments**, **Prescriptions**, **Lab**), **Finance** (**Invoices**, **Payments**, **Expenses**, **Reports**) and **Management** (**Inventory**, **Procedures**, **Staff**, **Settings**)."],
      },
      steps: {
        ar: [
          "لتوسيع مساحة العمل انقر على زر السهم أسفل القائمة (**طيّ القائمة**). تبقى الأيقونات وحدها، ويظهر اسم الصفحة حين تمرّر المؤشر فوق أيقونتها، وانقر على أي أيقونة لتفتح صفحتها. انقر على السهم مرة أخرى لتوسيع القائمة.",
          "انقر على اسمك أسفل القائمة لتفتح قائمة حسابك، وفيها **الإعدادات** و**مساعدة** (تفتح دليل الاستخدام هذا على موقع Dentora في المتصفح).",
          "اختر **قفل الشاشة** حين تبتعد عن الجهاز، أو **تسجيل الخروج** حين تنهي عملك. يعود البرنامج في الحالتين إلى شاشة الدخول، فيدخل كل شخص برمزه.",
        ],
        en: [
          "For more room, click the arrow button at the bottom of the sidebar (**Collapse menu**). Only the icons stay (hover one and its name appears); click an icon to open its page. Click the arrow again to expand the sidebar.",
          "Click your name at the bottom of the sidebar to open your account menu, which also has **Settings** and **Help** (it opens this guide on Dentora’s website in your browser).",
          "Choose **Lock screen** when you step away, or **Sign out** when you finish. Either way Dentora returns to the sign-in screen, and each person signs in with their own PIN.",
        ],
      },
      tips: {
        ar: [
          "يتذكر Dentora على هذا الجهاز إن كنت تركت القائمة مطوية أو موسّعة.",
          "يقفل البرنامج نفسه أيضاً بعد مدة من عدم الاستخدام: 15 دقيقة ما لم يغيّرها المدير. انظر [القفل التلقائي](settings#auto-lock).",
        ],
        en: [
          "Dentora remembers on this device whether you left the sidebar collapsed or expanded.",
          "Dentora also locks itself after a period without use: 15 minutes unless the admin changes it. See [Auto-lock](settings#auto-lock).",
        ],
      },
      shots: ['interface-user-menu', 'interface-collapsed'],
    },
    {
      id: 'search',
      title: { ar: 'البحث السريع', en: 'Quick search' },
      text: {
        ar: ["من خانة البحث تصل إلى أي شيء في ثوانٍ: مريض باسمه أو رقم هاتفه أو رقم ملفه أو رقمه الوطني، أو موعد قادم باسم المريض أو الطبيب، أو فاتورة برقمها أو باسم المريض، أو أي صفحة باسمها."],
        en: ["The search box takes you anywhere in seconds: a patient by name, phone number, file number or national ID, an upcoming appointment by patient or doctor, an invoice by its number or the patient’s name, or any page by its name."],
      },
      steps: {
        ar: [
          "انقر على خانة البحث في أعلى الشاشة، أو اضغط `Ctrl+K` من أي مكان.",
          "اكتب جزءاً من الاسم أو الرقم. تظهر النتائج مجمّعة تحت **المرضى** و**المواعيد القادمة** و**الفواتير** و**الانتقال إلى**.",
          "تنقّل بين النتائج بالسهمين `↑` و`↓` واضغط `Enter` لفتح النتيجة المظللة، أو انقر على أي نتيجة بالمؤشر.",
          "اضغط `Esc` لإغلاق البحث.",
        ],
        en: [
          "Click the search box at the top of the screen, or press `Ctrl+K` anywhere.",
          "Type part of a name or a number. Results are grouped under **Patients**, **Upcoming appointments**, **Invoices** and **Go to**.",
          "Move through the results with `↑` and `↓` and press `Enter` to open the highlighted one, or click any result.",
          "Press `Esc` to close the search.",
        ],
      },
      tips: {
        ar: [
          "قبل أن تكتب شيئاً تعرض النافذة **عمليات البحث الأخيرة** (تمسحها من **مسح السجل**)، و**إجراءات سريعة** (**مريض جديد** و**موعد جديد** و**فاتورة جديدة** و**قفل الشاشة**، بحسب دورك)، و**الانتقال إلى** مع كل صفحات البرنامج. وفي وضع القراءة فقط لا يبقى من الإجراءات إلا **قفل الشاشة**.",
          "يفهم البحث الأرقام العربية (٠–٩)، ويعمل `Ctrl+K` حتى إن كانت لوحة المفاتيح على العربية.",
          "تظهر المواعيد من اليوم فصاعداً فقط. للمواعيد السابقة افتح ملف المريض أو [المواعيد](appointments).",
          "تظهر الملفات المؤرشفة في النتائج مع شارة **مؤرشف**.",
          "يبحث كل شخص فيما يسمح به دوره فقط.",
        ],
        en: [
          "Before you type, the window shows your **Recent searches** (**Clear history** empties them), **Quick actions** (**New patient**, **New appointment**, **New invoice**, **Lock screen**, as your role allows) and **Go to** with every page. While Dentora is read-only, **Lock screen** is the only quick action left.",
          "Search understands Arabic-Indic digits (٠–٩), and `Ctrl+K` works even with an Arabic keyboard layout.",
          "Only appointments from today on are listed. For past visits, open the patient’s file or [Appointments](appointments).",
          "Archived files show in the results with an **Archived** badge.",
          "Everyone searches only what their role allows.",
        ],
      },
      shots: ['interface-search-start', 'interface-search-results'],
    },
    {
      id: 'new-button',
      title: { ar: 'زر جديد', en: 'The New button' },
      text: {
        ar: ["زر **جديد** في الشريط العلوي يضيف أكثر ما تحتاج إليه كل يوم، من أي صفحة كنت فيها ودون أن تغادرها."],
        en: ["The **New** button in the top bar adds what you need most every day, from whatever page you are on, without leaving it."],
      },
      steps: {
        ar: [
          "انقر على **جديد**.",
          "اختر **مريض جديد** أو **موعد جديد** أو **دفعة جديدة**.",
          "املأ النموذج واحفظه. بعد حفظ مريض جديد يُفتح ملفه مباشرة.",
        ],
        en: [
          "Click **New**.",
          "Choose **New patient**, **New appointment** or **New payment**.",
          "Fill in the form and save it. After you save a new patient, their file opens straight away.",
        ],
      },
      tips: {
        ar: [
          "اختصاران من لوحة المفاتيح: `Ctrl+Shift+N` لمريض جديد، و`Ctrl+Shift+A` لموعد جديد.",
          "يظهر خيار **دفعة جديدة** لمن يسمح له دوره بالفواتير فقط.",
          "على الهاتف يحل محله زر **+** صغير يفتح موعداً جديداً مباشرة.",
          "لا يظهر الزر حين يكون البرنامج للقراءة فقط.",
        ],
        en: [
          "Two keyboard shortcuts: `Ctrl+Shift+N` for a new patient and `Ctrl+Shift+A` for a new appointment.",
          "**New payment** is there only for roles allowed to handle invoices.",
          "On a phone a small **+** button takes its place and opens a new appointment directly.",
          "The button is hidden while Dentora is read-only.",
        ],
      },
      shots: ['interface-new-menu'],
    },
    {
      id: 'notifications',
      title: { ar: 'التنبيهات', en: 'Notifications' },
      text: {
        ar: [
          "أيقونة الجرس تجمع ما يحتاج إلى انتباهك اليوم. تظهر عليها نقطة حمراء حين يجدّ أمر مهم لم تره بعد: فاتورة متأخرة، أو مادة قاربت على النفاد، أو عمل مخبر متأخر، أو موعد للغد لم يُؤكَّد، أو نسخة احتياطية مستحقة.",
          "في اللوحة، بحسب ما يسمح به دورك: **النسخ الاحتياطي**، و**مواعيد اليوم المتبقية**، و**مواعيد الغد غير المؤكدة**، و**أعمال المخبر**، و**فواتير متأخرة السداد**، و**المخزون** (النواقص، والمواد المنتهية صلاحيتها أو التي تنتهي خلال 60 يوماً)، و**أعياد ميلاد اليوم**، و**مرضى بحاجة لمراجعة دورية** (آخر زيارة لهم قبل أكثر من 6 أشهر ولا موعد محجوزاً لهم).",
        ],
        en: [
          "The bell gathers what needs your attention today. A red dot appears on it when something important comes up that you have not seen yet: an overdue invoice, an item running low, late lab work, an unconfirmed appointment for tomorrow, or a backup that is due.",
          "Depending on your role, the panel lists **Backup**, **Remaining today**, **Unconfirmed for tomorrow**, **Lab work**, **Overdue invoices**, **Inventory** (shortages, and items already expired or expiring within 60 days), **Birthdays today** and **Due for a recall** (last visit over 6 months ago and nothing booked).",
        ],
      },
      steps: {
        ar: [
          "انقر على الجرس، فتنفتح لوحة **التنبيهات** في جانب الشاشة.",
          "انقر على أي تنبيه لتنتقل إلى صفحته: الموعد في التقويم، أو الفاتورة، أو المخزون، أو ملف المريض.",
          "بجانب كل موعد للغد غير مؤكد أيقونة فقاعة رسالة (**تذكير عبر واتساب**) تفتح رسالة جاهزة للمريض، إن كان رقم هاتفه مسجلاً. وبجانب أعياد الميلاد أيقونة مثلها (**إرسال تهنئة عبر واتساب**).",
          "إن كانت المجموعة طويلة انقر على **عرض الكل** لفتح صفحتها كاملة.",
        ],
        en: [
          "Click the bell: the **Notifications** panel opens at the side of the screen.",
          "Click any alert to go to its page: the appointment in the calendar, the invoice, the inventory or the patient’s file.",
          "Each unconfirmed appointment for tomorrow has a speech-bubble icon (**Remind on WhatsApp**) that opens a ready-made message to the patient, when their phone number is on file. Birthdays have the same icon (**Send greetings on WhatsApp**).",
          "When a group is long, click **View all** to open its full page.",
        ],
      },
      tips: {
        ar: [
          "تختفي النقطة الحمراء حين تفتح اللوحة، وتعود حين يظهر أمر مهم جديد.",
          "تُعدّ الفاتورة متأخرة إذا فات تاريخ استحقاقها، أو مضى على إصدارها أكثر من 30 يوماً إن لم يكن لها تاريخ استحقاق.",
          "يظهر تذكير النسخ الاحتياطي حين يكون في العيادة مريض واحد على الأقل، ولم تُحفظ نسخة قط أو مضى على آخر نسخة 7 أيام أو أكثر. يرى المدير وحده نقطته الحمراء، وتعود كل أسبوع حتى تُحفظ نسخة، والنقر على سطره الذي يحمل عبارة **نسخ الآن** ينقله إلى صفحة النسخ الاحتياطي. أما بقية الفريق فيطلب منهم التذكير إخبار المدير.",
          "تُفتح رسائل واتساب في تطبيق واتساب على أندرويد، وفي المتصفح على ويندوز لتكمل في واتساب ويب أو في تطبيق واتساب على الحاسوب. ويُضاف رمز بلد العيادة إلى الأرقام المحلية تلقائياً. انظر [بيانات العيادة](settings#clinic-details).",
        ],
        en: [
          "The red dot goes away once you open the panel, and comes back when something new and important appears.",
          "An invoice counts as overdue once its due date has passed or, without a due date, 30 days after it was issued.",
          "The backup reminder shows when the clinic has at least one patient and no backup was ever saved, or the last one is 7 or more days old. Only the admin gets its red dot, which comes back every week until a backup is saved; clicking its row, marked **Back up now**, takes the admin to the backup page. Everyone else is asked to tell the admin.",
          "WhatsApp messages open in the WhatsApp app on Android, and in the browser on Windows, where you continue in WhatsApp Web or the WhatsApp desktop app. Your clinic’s country code is added to local numbers for you. See [Clinic details](settings#clinic-details).",
        ],
      },
      shots: ['interface-notifications'],
    },
    {
      id: 'phone-layout',
      title: { ar: 'على الهاتف والجهاز اللوحي', en: 'On a phone or tablet' },
      text: {
        ar: ["على الهاتف، وعلى الجهاز اللوحي حين تمسكه عمودياً، تختفي القائمة الجانبية ويظهر شريط في أسفل الشاشة. تبقى الصفحات والميزات كلها كما هي."],
        en: ["On a phone, and on a tablet held upright, the sidebar gives way to a bar at the bottom of the screen. All pages and features stay the same."],
      },
      steps: {
        ar: [
          "انتقل من الشريط السفلي بين **الرئيسية** و**المواعيد** و**المرضى** و**الفواتير**.",
          "انقر على **المزيد** لتصل إلى بقية الصفحات. وفي أعلى النافذة اسمك مع زرّي قفل الشاشة وتسجيل الخروج.",
          "في الشريط العلوي: العدسة للبحث، وزر **+** لموعد جديد (وعلى الجهاز اللوحي يظهر بدلاً منه زر **جديد** بقائمته)، والجرس للتنبيهات، والدائرة التي تحمل الحرفين الأولين من اسمك لقائمة حسابك.",
        ],
        en: [
          "Use the bottom bar to move between **Dashboard**, **Appointments**, **Patients** and **Invoices**.",
          "Tap **More** to reach every other page. Its top row shows your name with buttons to lock the screen and sign out.",
          "In the top bar: the magnifier searches, **+** books a new appointment (on a tablet you get the full **New** button and its menu instead), the bell opens notifications, and the circle with your initials opens your account menu.",
        ],
      },
      tips: {
        ar: [
          "زر الرجوع في أندرويد يغلق النافذة أو القائمة المفتوحة أولاً، ثم يعود صفحة إلى الوراء. وفي الشاشة الرئيسية ينقل التطبيق إلى الخلفية ولا يغلقه.",
          "يختفي الشريط السفلي أثناء الكتابة ليترك مكاناً للوحة المفاتيح.",
          "الجهاز اللوحي في الوضع الأفقي قد يعرض شكل الحاسوب بقائمته الجانبية.",
          "وعلى ويندوز يظهر الشكل نفسه إن ضيّقت نافذة Dentora إلى أقل من نحو 1024 بكسل، مثلاً حين تضعها في نصف الشاشة. وسّع النافذة لتعود القائمة الجانبية.",
          "يعرض الشريط السفلي ونافذة **المزيد** الصفحات التي يسمح بها دورك فقط.",
        ],
        en: [
          "Android’s Back button first closes any open window or menu, then goes back a page. On the dashboard it sends the app to the background instead of closing it.",
          "The bottom bar hides while you type, to leave room for the keyboard.",
          "A tablet held sideways may show the computer layout, with the sidebar.",
          "On Windows the same layout appears when the Dentora window is narrower than about 1024 pixels, for example when it is snapped to half the screen. Widen the window to get the sidebar back.",
          "The bottom bar and the **More** window only show the pages your role allows.",
        ],
      },
      shots: ['interface-phone-home', 'interface-phone-more'],
    },
    {
      id: 'language-theme',
      title: { ar: 'اللغة والمظهر والخط', en: 'Language, appearance and font' },
      text: {
        ar: ["يعمل Dentora بالعربية من اليمين إلى اليسار، أو بالإنجليزية من اليسار إلى اليمين، بمظهر فاتح أو داكن. تتغير الواجهة كلها فوراً، ومعها الفواتير والوصفات المطبوعة."],
        en: ["Dentora works in Arabic, right to left, or in English, left to right, with a light or a dark appearance. The whole interface changes at once, printed invoices and prescriptions included."],
      },
      steps: {
        ar: [
          "افتح **الإعدادات** ← **التفضيلات**.",
          "في **لغة الواجهة** اختر **العربية** أو **English**.",
          "في **المظهر** اختر **فاتح** أو **داكن**.",
          "في **خط الواجهة** اختر الخط الأريح لعينيك.",
        ],
        en: [
          "Open **Settings** → **Preferences**.",
          "Under **Interface language** choose **العربية** or **English**.",
          "Under **Appearance** choose **Light** or **Dark**.",
          "Under **Interface font** pick the font that is easiest on your eyes.",
        ],
      },
      tips: {
        ar: [
          "اللغة والمظهر لكل مستخدمي العيادة، ويغيّرهما المدير. أما الخط فيخص هذا الجهاز وحده، ويغيّره أي مستخدم.",
          "المظهر الفاتح هو الأوضح للعمل اليومي، والداكن مريح في الغرف ذات الإضاءة الخافتة.",
          "التفاصيل في [اللغة والخط والمظهر](settings#language-appearance).",
        ],
        en: [
          "Language and appearance apply to everyone in the clinic and only the admin changes them. The font belongs to this device alone, and anyone can change it.",
          "Light is the clearest for daily clinic work; dark is easier in dimly lit rooms.",
          "More in [Language, month names, font and appearance](settings#language-appearance).",
        ],
      },
      shots: ['interface-dark'],
    },
    {
      id: 'shortcuts',
      title: { ar: 'اختصارات لوحة المفاتيح وميزات ويندوز', en: 'Keyboard shortcuts and Windows extras' },
      text: {
        ar: [
          "على الحاسوب توفّر لوحة المفاتيح كثيراً من الوقت: `Ctrl+K` للبحث السريع، و`Ctrl+Shift+N` لمريض جديد، و`Ctrl+Shift+A` لموعد جديد، و`Esc` لإغلاق النافذة المفتوحة.",
          "وفي نسخة ويندوز أيضاً: `Ctrl` مع `+` للتكبير، و`Ctrl` مع `-` للتصغير، و`Ctrl` مع `0` للحجم الطبيعي، أو `Ctrl` مع عجلة الفأرة. ويتذكر البرنامج مستوى التكبير. و`F11` لملء الشاشة، و`F5` لإعادة تحميل الصفحة، و`Alt` يُظهر شريط القوائم.",
          "والزر الأيمن للفأرة داخل أي حقل يُظهر قص ونسخ ولصق وتحديد الكل، وهو مفيد للصق رسالة تصلك على واتساب.",
        ],
        en: [
          "On a computer the keyboard saves a lot of time: `Ctrl+K` for quick search, `Ctrl+Shift+N` for a new patient, `Ctrl+Shift+A` for a new appointment, and `Esc` to close the open window.",
          "The Windows app adds: `Ctrl` with `+` to zoom in, `Ctrl` with `-` to zoom out and `Ctrl` with `0` for the normal size, or `Ctrl` with the mouse wheel; Dentora remembers the zoom. `F11` toggles full screen, `F5` reloads the page, and `Alt` shows the menu bar.",
          "Right-clicking inside any field offers cut, copy, paste and select all, handy for pasting a message you received on WhatsApp.",
        ],
      },
      tips: {
        ar: [
          "تعمل هذه الاختصارات حتى لو كانت لوحة المفاتيح على العربية.",
          "تجد قائمة الاختصارات أيضاً في **الإعدادات** ← **حول البرنامج**.",
          "في شاشة الدخول اكتب رمزك من لوحة المفاتيح مباشرة، واضغط `Enter` للدخول.",
        ],
        en: [
          "These shortcuts work even with an Arabic keyboard layout.",
          "The shortcut list is also in **Settings** → **About**.",
          "On the sign-in screen, type your PIN straight on the keyboard and press `Enter` to sign in.",
        ],
      },
      shots: ['interface-shortcuts'],
    },
  ],
  shots: [
    {
      id: 'interface-overview',
      device: 'desktop',
      alt: { ar: 'صفحة المرضى مع القائمة الجانبية والشريط العلوي', en: 'The Patients page with the sidebar and the top bar' },
      caption: { ar: 'كل الصفحات بالترتيب نفسه: القائمة الجانبية، والشريط العلوي، والصفحة.', en: 'Every page has the same layout: sidebar, top bar and page.' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/patients and wait for the list. Crop: the whole window. Markers: 1 on Patients in the sidebar, 2 on the search box (.topbar-search), 3 on the New button, 4 on the bell, 5 on the user card at the bottom of the sidebar (.sidebar-user).`,
    },
    {
      id: 'interface-user-menu',
      device: 'desktop',
      alt: { ar: 'قائمة الحساب مفتوحة أسفل القائمة الجانبية: الإعدادات ومساعدة وقفل الشاشة وتسجيل الخروج', en: 'The account menu open at the bottom of the sidebar: Settings, Help, Lock screen and Sign out' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/ and click the user card at the bottom of the sidebar (.sidebar-user): the menu opens above it. Crop: the sidebar (.app-sidebar) from the Management group down to its bottom edge. Markers: 1 on the collapse arrow (.collapse-btn), 2 on the user card, 3 on Lock screen in the menu.`,
    },
    {
      id: 'interface-collapsed',
      device: 'desktop',
      alt: { ar: 'القائمة الجانبية مطوية لا تظهر فيها إلا الأيقونات', en: 'The sidebar collapsed to icons only' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/ and click the collapse arrow (.collapse-btn). Crop: the whole window. No markers. Afterwards click the arrow again (the choice is remembered in localStorage 'dentora.sidebar').`,
    },
    {
      id: 'interface-search-start',
      device: 'desktop',
      alt: { ar: 'نافذة البحث السريع قبل الكتابة: إجراءات سريعة وروابط الصفحات', en: 'The quick search window before typing: quick actions and page links' },
      recipe: `${DEMO} Desktop window (1440×900). Remove localStorage 'dentora.search.recent' first so no recent searches show. Open #/ and press Control+K. Crop: the search panel (.srch-panel) with 16 px of the dimmed page around it. Markers: 1 on the search input.`,
    },
    {
      id: 'interface-search-results',
      device: 'desktop',
      alt: { ar: 'نتائج البحث مجمّعة: المرضى والمواعيد القادمة', en: 'Search results grouped into patients and upcoming appointments' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/, press Control+K and type سامر (Arabic shot) or Samer (English shot); wait 900 ms for the results. Crop: the search panel (.srch-panel). Markers: 2 on the Patients group title, 3 on the highlighted first result.`,
    },
    {
      id: 'interface-new-menu',
      device: 'desktop',
      alt: { ar: 'قائمة زر جديد: مريض جديد وموعد جديد ودفعة جديدة', en: 'The New button menu: New patient, New appointment and New payment' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/clinic and click the New button in the top bar (on the dashboard its own buttons show cut off around the menu). Crop: the top bar region around the button and its open menu (about 520×240 px, menu fully inside). Markers: 1 on the New button, 2 on the menu (next to New patient).`,
    },
    {
      id: 'interface-notifications',
      device: 'desktop',
      alt: { ar: 'لوحة التنبيهات مفتوحة: النسخ الاحتياطي ومواعيد اليوم ومواعيد الغد غير المؤكدة', en: 'The Notifications panel open: backup, today’s appointments and tomorrow’s unconfirmed ones' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/ and click the bell (the button labelled Notifications in .topbar-actions); wait 900 ms. Crop: the whole window (the panel covers one side). Markers: 1 on the panel title (the open panel covers the bell), 2 on the first row of Remaining today, 3 on the WhatsApp button of the Unconfirmed for tomorrow row, 4 on View all.`,
    },
    {
      id: 'interface-phone-home',
      device: 'phone',
      alt: { ar: 'Dentora على الهاتف: الشريط العلوي والشريط السفلي', en: 'Dentora on a phone: the top bar and the bottom bar' },
      recipe: `${DEMO} Phone viewport (about 400×860, touch). Open #/ and wait 1.5 s. Crop: the whole screen. Markers: 1 on the bottom bar (.app-bottomnav), 2 on More in the bottom bar, 3 on the + button in the top bar.`,
    },
    {
      id: 'interface-phone-more',
      device: 'phone',
      alt: { ar: 'نافذة المزيد على الهاتف مع كل الصفحات وزرّي القفل والخروج', en: 'The More window on a phone, with every page and the lock and sign-out buttons' },
      recipe: `${DEMO} Phone viewport (about 400×860, touch). Open #/ and tap More in the bottom bar. Crop: the whole screen. Markers: 2 on the row with your name and the lock and sign-out buttons.`,
    },
    {
      id: 'interface-dark',
      device: 'desktop',
      alt: { ar: 'الشاشة الرئيسية بالمظهر الداكن', en: 'The dashboard in the dark appearance' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/preferences, click the Dark card ([data-theme-option="dark"]), then open #/ and wait 1.5 s (let the toast disappear). Crop: the whole window. Markers: none. Afterwards set Light again.`,
    },
    {
      id: 'interface-shortcuts',
      device: 'desktop',
      alt: { ar: 'قائمة اختصارات لوحة المفاتيح في حول البرنامج', en: 'The keyboard shortcuts list in About' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/about. Crop: the Keyboard shortcuts card (the card whose title is Keyboard shortcuts / اختصارات لوحة المفاتيح). No markers.`,
    },
  ],
}

export default topic

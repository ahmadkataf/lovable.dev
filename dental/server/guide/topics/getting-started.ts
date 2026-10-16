import type { GuideTopic } from '../types'

// How the pictures are made (store/scripts/guide-shots.mjs). Every recipe names its starting state:
const EMPTY = "Empty database (a fresh browser profile, no clinic yet), clock fixed at Sunday 11 October 2026 11:40 Asia/Damascus, trial bar hidden ([data-qa=\"trial-bar\"]{display:none}). Open #/setup: the setup wizard."
const DEMO = "Demo clinic as store/scripts/shoot.mjs makes it (seedAndLogin + Settings → Backup → Load demo data; English shots use its englishClinic() names), clock fixed at Sunday 11 October 2026 11:40 Asia/Damascus, trial bar hidden."
const NEW_CLINIC = "A brand-new clinic: on an empty database complete the setup wizard in the shot's language (clinic name عيادة الابتسامة لطب الأسنان / Smile Dental Clinic, phone 0944 123 456, currency and hours left as they are, owner title د. / Dr., name أحمد الخطيب / Ahmad Al-Khatib, PIN 1234 twice, terms ticked, Start working). Clock fixed at Sunday 11 October 2026 11:40 Asia/Damascus, trial bar hidden."
const STEP1 = "On step 1 keep العربية for the Arabic shot, or click the English card ([data-lang=\"en\"]) for the English shot, then click Next ([data-qa=\"next\"])."
const FILL_CLINIC = "On the Clinic step type the clinic name عيادة الابتسامة لطب الأسنان (Arabic shot) / Smile Dental Clinic (English shot) in input[name=clinicName], the phone 0944 123 456 in input[name=clinicPhone] and the address دمشق — المزة، شارع الجلاء / Al-Jalaa St, Mezzeh, Damascus in input[name=clinicAddress]."
const FILL_OWNER = "On the Your account step keep the title (د. / Dr.), type the name أحمد الخطيب / Ahmad Al-Khatib in input[name=ownerName], the specialty طب الأسنان العام / General dentistry in input[name=ownerSpecialty], and the PIN 1234 in both #owner-pin and #owner-pin2."

const topic: GuideTopic = {
  slug: 'getting-started',
  order: 1,
  icon: 'rocket',
  title: { ar: 'البدء مع Dentora', en: 'Getting started' },
  summary: {
    ar: 'ثبّت Dentora على حاسوب ويندوز أو جهاز أندرويد، وجهّز عيادتك في خمس خطوات قصيرة، ثم ادخل برمزك وابدأ العمل.',
    en: 'Install Dentora on a Windows computer or an Android device, set up your clinic in five short steps, then sign in with your PIN and start working.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'قبل أن تبدأ', en: 'Before you start' },
      text: {
        ar: [
          "Dentora برنامج يدير عيادة الأسنان كلها: المرضى والمواعيد والعلاجات والفواتير والتقارير. يعمل على حاسوب ويندوز، أو على هاتف أو جهاز لوحي بنظام أندرويد، ولا يحتاج إلى الإنترنت في العمل اليومي.",
          "تُحفظ بيانات عيادتك على الجهاز نفسه فقط، ولا تُرسل إلى أي خادم. لذلك يعمل كل جهاز بقاعدة بيانات مستقلة، ولا تتزامن الأجهزة فيما بينها. اختر جهازاً رئيسياً واحداً للعيادة، واحفظ منه نسخة احتياطية بانتظام.",
          "مع أول تشغيل تبدأ فترة تجريبية مجانية مدتها 7 أيام بكل الميزات، دون تسجيل ولا حساب. بعدها تفعّل البرنامج بالترخيص، ويبقى كل ما أدخلته كما هو.",
        ],
        en: [
          "Dentora runs your whole dental clinic: patients, appointments, treatments, invoices and reports. It works on a Windows computer or on an Android phone or tablet, and needs no internet for daily work.",
          "Your clinic’s data is kept on the device itself and is never sent to a server. Each device therefore has its own separate database, and devices do not sync with each other. Choose one main device for the clinic and back it up regularly.",
          "The first launch starts a free 7-day trial with every feature, with no sign-up and no account. After that you activate Dentora with your licence, and everything you entered stays as it is.",
        ],
      },
      tips: {
        ar: [
          "تحتاج إلى ويندوز 10 أو 11 (64-بت)، أو أندرويد 7.0 أو أحدث.",
          "تحتاج إلى الإنترنت لتنزيل البرنامج، وقد تحتاج إليه مرة واحدة لتفعيل الترخيص. انظر [الترخيص والتفعيل](licence).",
          "بعد الإعداد تجد شرح الشاشات في [الواجهة والتنقل](interface) و[الشاشة الرئيسية](dashboard).",
        ],
        en: [
          "You need Windows 10 or 11 (64-bit), or Android 7.0 or later.",
          "You need the internet to download Dentora, and possibly once to activate your licence. See [Licence and activation](licence).",
          "Once you are set up, [Finding your way around](interface) and [The dashboard](dashboard) explain the screens.",
        ],
      },
      shots: ['getting-started-overview'],
    },
    {
      id: 'install-windows',
      title: { ar: 'التثبيت على ويندوز', en: 'Installing on Windows' },
      text: {
        ar: ["يصلك Dentora لويندوز في برنامج تثبيت واحد، اسمه يبدأ بـ Dentora-Setup وينتهي بـ ‎.exe."],
        en: ["Dentora for Windows comes as a single installer whose name starts with Dentora-Setup and ends with .exe."],
      },
      steps: {
        ar: [
          "نزّل برنامج التثبيت من قسم التحميل في موقع Dentora (زر «تحميل لويندوز»)، أو من الرابط الذي يرسله لك البائع على واتساب.",
          "افتح الملف الذي نزّلته. إن ظهرت شاشة «حماية Windows» فانقر على «مزيد من المعلومات» ثم «تشغيل على أي حال». تظهر هذه الشاشة لأن البرنامج جديد على ويندوز.",
          "اقرأ شروط الاستخدام في الصفحة الأولى ووافق عليها، واترك مجلد التثبيت كما هو، وتابع حتى ينتهي التثبيت. لا يحتاج ذلك إلى صلاحيات مدير ويندوز.",
          "في الصفحة الأخيرة اترك خيار تشغيل Dentora محدداً وأغلق برنامج التثبيت، فيفتح Dentora مباشرة. ويضع التثبيت اختصاراً على سطح المكتب وفي قائمة ابدأ. تابع إلى [الإعداد الأول](getting-started#setup-clinic).",
        ],
        en: [
          "Download the installer from the Download section of the Dentora website (the “Download for Windows” button), or from the link the seller sends you on WhatsApp.",
          "Open the file you downloaded. If a “Windows protected your PC” screen appears, click “More info”, then “Run anyway”. Windows shows it because the app is new to it.",
          "Read and accept the terms of use on the first page, keep the suggested folder, and continue until the installation finishes. No Windows administrator rights are needed.",
          "On the last page leave the option to run Dentora ticked and close the installer: Dentora opens straight away. Shortcuts are added on the desktop and in the Start menu. Continue with the [first-run setup](getting-started#setup-clinic).",
        ],
      },
      tips: {
        ar: [
          "للتحديث إلى إصدار أحدث: خذ نسخة احتياطية أولاً، ثم شغّل برنامج التثبيت الجديد فوق القديم. تبقى بياناتك كما هي.",
          "إلغاء التثبيت من إعدادات ويندوز يحذف البرنامج فقط، ولا يحذف بيانات العيادة.",
          "تُحفظ البيانات داخل حساب مستخدم ويندوز. إن فتح أحدٌ Dentora بحساب ويندوز آخر فسيرى عيادة فارغة، فاستخدموا حساب ويندوز واحداً على حاسوب العيادة.",
          "إن فتحت Dentora وهو مفتوح أصلاً، تظهر لك النافذة نفسها ولا تُفتح نسخة ثانية. ويتذكر البرنامج حجم النافذة ومكانها.",
          "إن منع ويندوز تشغيل الملف تماماً دون زر «تشغيل على أي حال»، فلا توقف حماية ويندوز، وراسل البائع على واتساب.",
        ],
        en: [
          "To update to a newer version: take a backup first, then run the new installer over the old one. Your data stays as it is.",
          "Uninstalling from Windows settings removes the program only, never the clinic’s data.",
          "The data lives inside your Windows user account. Someone who opens Dentora under another Windows account sees an empty clinic, so use one Windows account on the clinic computer.",
          "Opening Dentora while it is already open brings up the same window instead of a second copy. The window keeps its size and position between sessions.",
          "If Windows blocks the file completely, with no “Run anyway” button, do not turn Windows security off: message the seller on WhatsApp.",
        ],
      },
    },
    {
      id: 'install-android',
      title: { ar: 'التثبيت على أندرويد', en: 'Installing on Android' },
      text: {
        ar: ["تطبيق أندرويد ملف واحد امتداده ‎.apk، ويعمل على الهواتف والأجهزة اللوحية بنظام أندرويد 7.0 أو أحدث."],
        en: ["The Android app is a single .apk file. It runs on phones and tablets with Android 7.0 or later."],
      },
      steps: {
        ar: [
          "نزّل الملف من قسم التحميل في موقع Dentora (زر «تحميل ملف APK»)، أو اطلبه من البائع فيصلك على واتساب.",
          "افتح الملف من إشعار التنزيل، أو من مدير الملفات، أو من محادثة واتساب.",
          "إن طلب أندرويد السماح بـ«تثبيت التطبيقات غير المعروفة»، فاسمح بذلك للتطبيق الذي فتحت منه الملف، ثم ارجع والمس «تثبيت».",
          "إن ظهر تحذير Google Play Protect فالمس «مزيد من التفاصيل» ثم «التثبيت على أي حال».",
          "افتح Dentora من قائمة التطبيقات، فتظهر لك شاشة الترحيب. تابع إلى [الإعداد الأول](getting-started#setup-clinic).",
        ],
        en: [
          "Download the file from the Download section of the Dentora website (the “Download APK” button), or ask the seller to send it to you on WhatsApp.",
          "Open the file from the download notification, your file manager, or the WhatsApp chat.",
          "If Android asks you to allow “Install unknown apps”, allow it for the app you opened the file from, then go back and tap “Install”.",
          "If Google Play Protect shows a warning, tap “More details”, then “Install anyway”.",
          "Open Dentora from your apps: the welcome screen appears. Continue with the [first-run setup](getting-started#setup-clinic).",
        ],
      },
      tips: {
        ar: [
          "للتحديث ثبّت ملف الإصدار الأحدث فوق التطبيق الموجود مباشرة. لا تحذف التطبيق لتحديثه: حذف التطبيق، أو «مسح البيانات» من معلومات التطبيق، يمسح كل بيانات العيادة من الجهاز.",
          "بيانات Dentora لا تدخل في نسخ Google الاحتياطي التلقائي، ولا تنتقل وحدها إلى هاتف جديد. النسخة الاحتياطية من داخل البرنامج هي الطريقة الوحيدة لحفظها ونقلها. انظر [النسخ الاحتياطي](backup).",
          "إن ظهرت شاشة بيضاء عند الفتح، فحدّث «Android System WebView» وChrome من متجر Play.",
          "يتبع حجم الخط في Dentora إعداد حجم الخط في الهاتف، حتى 130%.",
        ],
        en: [
          "To update, install the newer file straight over the installed app. Never uninstall the app to update it: uninstalling it, or “Clear storage” in the app info, erases all clinic data from the device.",
          "Dentora’s data is not part of Google’s automatic backup and does not move to a new phone by itself. A backup made inside the app is the only way to keep it or move it. See [Backup](backup).",
          "If the app opens on a white screen, update “Android System WebView” and Chrome from the Play Store.",
          "Text size in Dentora follows your phone’s font size setting, up to 130%.",
        ],
      },
      shots: ['getting-started-android-welcome'],
    },
    {
      id: 'setup-clinic',
      title: { ar: 'الإعداد الأول: اللغة والعيادة والعملة', en: 'First-run setup: language, clinic and currency' },
      text: {
        ar: ["عند أول فتح يرشدك معالج من خمس خطوات: **اللغة**، ثم **العيادة**، ثم **العملة والدوام**، ثم **حسابك**، ثم **المراجعة**. كل ما تختاره هنا يمكن تعديله لاحقاً من [الإعدادات](settings)."],
        en: ["The first time Dentora opens, a five-step wizard guides you: **Language**, **Clinic**, **Currency & hours**, **Your account** and **Review**. Everything you choose here can be changed later in [Settings](settings)."],
      },
      steps: {
        ar: [
          "في خطوة **اللغة** اختر **العربية** أو **English**، ثم انقر على **التالي**. تتغير لغة المعالج فوراً.",
          "في خطوة **العيادة** اكتب **اسم العيادة**، وهو الحقل الوحيد المطلوب. وأضف إن شئت **الهاتف** و**البريد الإلكتروني** و**العنوان**، وارفع شعارك بزر **رفع الشعار**. تظهر هذه البيانات في رأس الفواتير والوصفات المطبوعة.",
          "في خطوة **العملة والدوام** اختر **العملة** و**الكسور** (بدون كسور، أو منزلتان، أو ثلاث منازل)، وتأكد من **بلد العيادة** و**أسماء الأشهر بالعربية**.",
          "حدّد **أيام الدوام** وساعاته (**من الساعة** و**إلى الساعة**) و**خانة المواعيد في التقويم**. واكتب النسبة في **ضريبة على الفواتير** إن كانت عيادتك تفرض ضريبة، أو اتركها فارغة، ثم انقر على **التالي**.",
        ],
        en: [
          "On the **Language** step choose **العربية** or **English**, then click **Next**. The wizard switches language at once.",
          "On the **Clinic** step type the **Clinic name**, the only required field. Add the **Phone**, **Email** and **Address** if you like, and add your logo with **Upload logo**. These details appear at the top of printed invoices and prescriptions.",
          "On the **Currency & hours** step choose the **Currency** and the **Decimals**, and check the **Clinic country** and the **Arabic month names**.",
          "Set your **Working days** and hours (**Opens at** and **Closes at**) and the **Calendar time slot**. Fill in **Tax on invoices** if your clinic charges tax, then click **Next**.",
        ],
      },
      tips: {
        ar: [
          "إن لم تجد عملتك في القائمة فاختر **عملة أخرى…**، واكتب **رمز العملة** اللاتيني (مثل YER) و**الرمز على الفاتورة**.",
          "يُضاف رمز البلد إلى أرقام الهواتف المحلية حين ترسل رسائل واتساب، فاختر بلد عيادتك بدقة.",
          "أيام الدوام المختارة مسبقاً من السبت إلى الخميس، من 9 صباحاً حتى 6 مساءً. انقر على أي يوم لتضيفه أو تزيله.",
          "إن نقص حقل مطلوب أو كان غير صحيح، يظهر الخطأ بالأحمر تحته ولا ينتقل المعالج إلى الخطوة التالية.",
          "تستطيع العودة إلى أي خطوة سابقة بزر **رجوع**، أو بالنقر على رقمها في الأعلى. وعلى أندرويد يعيدك زر الرجوع في الهاتف خطوة إلى الوراء.",
        ],
        en: [
          "If your currency is not in the list, choose **Another currency…** and type its Latin **Currency code** (such as YER) and the **Symbol on invoices**.",
          "The country’s calling code is added to local phone numbers when you send WhatsApp messages, so pick your clinic’s country carefully.",
          "Saturday to Thursday, 9 am to 6 pm, are selected to begin with. Click any day to add or remove it.",
          "When a required field is missing or wrong, the error shows in red under it and the wizard does not move on.",
          "You can go back to any earlier step with **Back**, or by clicking its number at the top. On Android, the phone’s Back button also goes back one step.",
        ],
      },
      shots: ['getting-started-setup-clinic', 'getting-started-setup-money'],
    },
    {
      id: 'setup-account',
      title: { ar: 'الإعداد الأول: حسابك والمراجعة', en: 'First-run setup: your account and review' },
      text: {
        ar: ["الحساب الذي تنشئه هنا هو حساب مدير العيادة، وله كل الصلاحيات. ومنه تضيف بقية الفريق لاحقاً."],
        en: ["The account you create here is the clinic admin’s account, with every permission. From it you add the rest of the team later."],
      },
      steps: {
        ar: [
          "في خطوة **حسابك** اختر **اللقب** واكتب **اسمك الكامل**، وأضف إن شئت **الاختصاص** و**الهاتف**.",
          "اختر **رمز الدخول (PIN)** من 4 إلى 6 أرقام، واكتبه مرة ثانية في **أعد كتابة الرمز**، ثم انقر على **التالي**.",
          "في خطوة **المراجعة** راجع ما أدخلته. لتصحيح شيء انقر على **تعديل** في البطاقة التي تخصه.",
          "ضع علامة على **قرأت شروط الاستخدام وسياسة الخصوصية وأوافق عليهما**، فلا يتابع المعالج دونها. وتحت المربع روابط **شروط الاستخدام** و**سياسة الخصوصية** و**تراخيص المصادر المفتوحة** لقراءتها.",
          "انقر على **ابدأ العمل**. يجهّز Dentora عيادتك ويدخلك مباشرة إلى [الشاشة الرئيسية](dashboard).",
        ],
        en: [
          "On the **Your account** step choose your **Title** and type **Your full name**. Add your **Specialty** and **Phone** if you like.",
          "Choose a **Sign-in PIN** of 4 to 6 digits, type it again in **Repeat the PIN**, then click **Next**.",
          "On the **Review** step check what you entered. To correct something, click **Edit** on its card.",
          "Tick **I have read and accept the terms of use and the privacy policy**: the wizard does not go on without it. The links under the box open the **Terms of use**, the **Privacy policy** and the **Open-source licences**.",
          "Click **Start working**. Dentora prepares your clinic and takes you straight to [the dashboard](dashboard).",
        ],
      },
      tips: {
        ar: [
          "احفظ رمزك جيداً، فستكتبه في كل مرة تفتح فيها البرنامج. وإن نسيه المدير الوحيد للعيادة فالحل في [نسيت رمز الدخول؟](staff#forgot-pin).",
          "تبدأ الفترة التجريبية (7 أيام) منذ أول فتح للبرنامج، لا من لحظة النقر على **ابدأ العمل**. بعد الإعداد يظهر أعلى الشاشة شريط بعدد الأيام المتبقية وزر **تفعيل الآن**. انظر [الترخيص](licence).",
          "تُضاف تلقائياً قائمة بالإجراءات الشائعة بأسعار مقترحة، وقائمة بالأدوية الأكثر وصفاً. ويبدأ المخزون فارغاً لتسجّل فيه موادك الفعلية.",
        ],
        en: [
          "Keep your PIN safe: you type it every time you open Dentora. If the clinic’s only admin forgets it, see [Forgot your PIN?](staff#forgot-pin).",
          "The 7-day trial starts the first time Dentora opens, not when you click **Start working**. After setup, a bar at the top shows the days left with an **Activate now** button. See [Licence](licence).",
          "A list of common procedures with suggested prices and a list of commonly prescribed drugs are added for you. Inventory starts empty, ready for your real stock.",
        ],
      },
      shots: ['getting-started-setup-account', 'getting-started-setup-review'],
    },
    {
      id: 'restore-backup',
      title: { ar: 'لديك نسخة احتياطية؟ استعدها بدل الإعداد', en: 'Have a backup? Restore it instead' },
      text: {
        ar: ["إن أعدت تثبيت البرنامج أو انتقلت إلى جهاز جديد، فلا تُدخل بياناتك من جديد. استعد آخر نسخة احتياطية من الشاشة الأولى للمعالج، فتعود العيادة كما كانت بمرضاها ومواعيدها وفواتيرها وحسابات فريقها."],
        en: ["If you reinstalled Dentora or moved to a new device, do not type everything in again. Restore your latest backup from the wizard’s first screen, and the clinic comes back as it was, with its patients, appointments, invoices and team accounts."],
      },
      steps: {
        ar: [
          "ضع ملف النسخة الاحتياطية (امتداده ‎.dentora) في متناول الجهاز: على فلاشة، أو في مجلد التنزيلات، أو في Google Drive.",
          "في الشاشة الأولى من المعالج، تحت **أعدت تثبيت البرنامج؟**، انقر على **استعد بياناتك من نسخة احتياطية**.",
          "اختر ملف النسخة. إن كانت محمية بكلمة مرور فاكتبها حين يطلبها البرنامج.",
          "انتظر حتى تكتمل الاستعادة، فيُعاد تشغيل البرنامج. ادخل بعدها باسمك ورمزك المعتادين.",
        ],
        en: [
          "Make the backup file (it ends in .dentora) reachable from the device: on a USB stick, in your Downloads folder, or in Google Drive.",
          "On the wizard’s first screen, under **Reinstalled the app?**, click **Restore your data from a backup**.",
          "Choose the backup file. If it is password-protected, type the password when asked.",
          "Wait for the restore to finish: Dentora restarts. Then sign in with your usual name and PIN.",
        ],
      },
      tips: {
        ar: [
          "تُستعاد أيضاً النسخ القديمة بصيغة ‎.json.",
          "على جهاز جديد يتغير رقم الجهاز، فتحتاج إلى تفعيل الترخيص من جديد. انظر [الترخيص](licence).",
          "طريقة حفظ النسخ وحمايتها بكلمة مرور في [النسخ الاحتياطي ونقل العيادة](backup#export).",
        ],
        en: [
          "Older backups in .json format restore too.",
          "A new device has a new device number, so you need to activate your licence again. See [Licence](licence).",
          "How to save backups and protect them with a password: [Backup and moving your clinic](backup#export).",
        ],
      },
      shots: ['getting-started-restore-link'],
    },
    {
      id: 'sign-in',
      title: { ar: 'تسجيل الدخول كل يوم', en: 'Signing in every day' },
      text: {
        ar: ["يطلب Dentora رمز الدخول في كل مرة تفتحه، وبعد كل قفل. هكذا لا يطّلع أحد على ملفات المرضى إن تُرك الجهاز مفتوحاً."],
        en: ["Dentora asks for a PIN every time it opens, and after every lock. That way nobody sees patient files on a device left unattended."],
      },
      steps: {
        ar: [
          "في شاشة **من يبدأ العمل الآن؟** انقر على اسمك. إن كان في العيادة حساب واحد، أو كنت آخر من دخل من هذا الجهاز، تظهر لوحة الأرقام مباشرة.",
          "اكتب رمزك على لوحة الأرقام أو من لوحة المفاتيح. يدخل البرنامج وحده حين يكتمل الرمز، أو انقر على **دخول**.",
          "ليدخل شخص آخر انقر على **تبديل المستخدم**.",
          "إن نسيت رمزك انقر على **نسيت رمز الدخول؟** لترى ما تفعله.",
        ],
        en: [
          "On **Who is starting now?** click your name. If the clinic has only one account, or you were the last to sign in on this device, the keypad shows straight away.",
          "Type your PIN on the keypad or the keyboard. Dentora signs you in as soon as the PIN is complete, or click **Sign in**.",
          "For someone else to sign in, click **Switch user**.",
          "If you forgot your PIN, click **Forgot your PIN?** to see what to do.",
        ],
      },
      tips: {
        ar: [
          "خمس محاولات خاطئة متتالية توقف لوحة الأرقام 30 ثانية، وتطول المدة إن تكررت الأخطاء.",
          "تُقبل الأرقام العربية (٠–٩) من لوحة المفاتيح كما تُقبل اللاتينية. و`Enter` للدخول، و`Esc` لمسح ما كتبت.",
          "يستطيع المدير تعيين رمز جديد لأي مستخدم، وضبط مدة القفل التلقائي. انظر [نسيت رمز الدخول؟](staff#forgot-pin) و[القفل التلقائي](settings#auto-lock).",
        ],
        en: [
          "Five wrong PINs in a row pause the keypad for 30 seconds, and longer if the mistakes go on.",
          "Arabic-Indic digits (٠–٩) typed on the keyboard work as well as Latin ones. `Enter` signs in and `Esc` clears what you typed.",
          "The admin can set a new PIN for anyone and choose the auto-lock delay. See [Forgot your PIN?](staff#forgot-pin) and [Auto-lock](settings#auto-lock).",
        ],
      },
      shots: ['getting-started-signin-users', 'getting-started-signin-pin'],
    },
    {
      id: 'first-steps',
      title: { ar: 'أولى خطواتك بعد الإعداد', en: 'Your first steps' },
      text: {
        ar: ["عيادتك جاهزة للعمل. هذه الخطوات تجعلها جاهزة تماماً، وتكفي مرة واحدة."],
        en: ["Your clinic is ready to work. These steps make it fully ready, and you only do them once."],
      },
      steps: {
        ar: [
          "افتح **الإعدادات** وأكمل بيانات العيادة: الشعار، والاسم بالإنجليزية، ووسائل التواصل. انظر [بيانات العيادة](settings#clinic-details).",
          "افتح **قائمة الإجراءات** وراجع الأسعار المقترحة، وعدّلها لتطابق أسعار عيادتك. انظر [قائمة الإجراءات والأسعار](treatments#price-list).",
          "افتح **الفريق** وأضف الأطباء والمساعدين وموظفي الاستقبال، لكل منهم دوره ورمز دخوله. انظر [إضافة عضو جديد](staff#add-member).",
          "انقر على **مريض جديد** وافتح أول ملف. انظر [إضافة مريض جديد](patients#add-patient).",
          "انقر على **موعد جديد** واحجز أول موعد. انظر [حجز موعد](appointments#book).",
          "في نهاية اليوم احفظ أول نسخة احتياطية من **الإعدادات** ← **النسخ الاحتياطي**. انظر [حفظ نسخة احتياطية](backup#export).",
        ],
        en: [
          "Open **Settings** and complete the clinic details: logo, English name and contacts. See [Clinic details](settings#clinic-details).",
          "Open **Procedures** and review the suggested prices; change them to match your clinic. See [Procedures and prices](treatments#price-list).",
          "Open **Staff** and add your doctors, assistants and receptionists, each with a role and a PIN. See [Adding a team member](staff#add-member).",
          "Click **New patient** to open your first patient file. See [Adding a new patient](patients#add-patient).",
          "Click **New appointment** to book your first appointment. See [Booking an appointment](appointments#book).",
          "At the end of the day save your first backup from **Settings** → **Backup & data**. See [Saving a backup](backup#export).",
        ],
      },
      tips: {
        ar: [
          "الأسعار المقترحة محسوبة بالدولار، وتُحوَّل تلقائياً إلى أغلب العملات (الريال والدرهم والدينار والجنيه واليورو وغيرها). أما مع الليرة السورية أو عملة كتبتها بنفسك فتبقى بأرقام الدولار، فعدّلها قبل أول فاتورة.",
          "تريد أن تتجوّل في البرنامج أولاً؟ يستطيع المدير تحميل عيادة تجريبية كاملة من **الإعدادات** ← **النسخ الاحتياطي** ← **تحميل بيانات تجريبية** ما دام في العيادة أقل من ثلاثة مرضى. لكن البيانات التجريبية لا تُزال وحدها، بل بحذف كل البيانات، فجرّبها قبل أن تبدأ العمل الحقيقي. وإن كان في العيادة أقل من طبيبين تضيف البيانات التجريبية طبيباً أو طبيبين تجريبيين رمز دخول كل منهما 1234، فلا تُبقِ هذه الحسابات على جهاز فيه بيانات مرضى حقيقيين. انظر [البيانات التجريبية وحذف كل البيانات](backup#demo-erase).",
        ],
        en: [
          "The suggested prices are set in US dollars and converted for most currencies (riyal, dirham, dinar, pound, euro and others). With the Syrian pound, or a currency you typed in yourself, they stay as dollar figures: adjust them before your first invoice.",
          "Want to look around first? The admin can load a complete demo clinic from **Settings** → **Backup & data** → **Load demo data** while the clinic has fewer than three patients. Demo data cannot be removed on its own, only by erasing all data, so try it before you start real work. If the clinic has fewer than two doctors, the demo also adds one or two demo doctors whose PIN is 1234: do not keep those accounts on a device that holds real patient data. See [Demo data and erasing everything](backup#demo-erase).",
        ],
      },
      shots: ['getting-started-first-steps'],
    },
  ],
  shots: [
    {
      id: 'getting-started-overview',
      device: 'desktop',
      alt: { ar: 'شاشة الترحيب في معالج الإعداد الأول مع اختيار اللغة', en: 'The welcome screen of the first-run setup wizard, with the language choice' },
      caption: { ar: 'أول ما تراه بعد تثبيت Dentora.', en: 'The first thing you see after installing Dentora.' },
      recipe: `${EMPTY} Desktop window (1440×900). Arabic shot: leave العربية selected; English shot: click the English card ([data-lang="en"]). Wait 600 ms (the wizard fades between states). Crop: the whole window. No markers.`,
    },
    {
      id: 'getting-started-android-welcome',
      device: 'phone',
      alt: { ar: 'شاشة الترحيب في Dentora على هاتف أندرويد', en: 'The Dentora welcome screen on an Android phone' },
      caption: { ar: 'شاشة الترحيب على الهاتف: الخطوة 1 من 5.', en: 'The welcome screen on a phone: step 1 of 5.' },
      recipe: `${EMPTY} Phone viewport (about 400×860, touch). English shot: tap the English card ([data-lang="en"]). Crop: the whole screen. No markers.`,
    },
    {
      id: 'getting-started-setup-clinic',
      device: 'desktop',
      alt: { ar: 'خطوة العيادة في معالج الإعداد: اسم العيادة والهاتف والعنوان والشعار', en: 'The Clinic step of the setup wizard: clinic name, phone, address and logo' },
      recipe: `${EMPTY} Desktop window (1440×900). ${STEP1} ${FILL_CLINIC} Click in an empty part of the card so no field shows the focus ring, wait 400 ms. Crop: the wizard card (.au-setup). Markers: 2 on the Clinic name field, and a second 2 on the Upload logo button.`,
    },
    {
      id: 'getting-started-setup-money',
      device: 'desktop',
      alt: { ar: 'خطوة العملة والدوام: العملة والكسور والبلد وأسماء الأشهر وأيام الدوام وساعاته', en: 'The Currency & hours step: currency, decimals, country, month names, working days and hours' },
      recipe: `${EMPTY} Desktop window (1440×900). ${STEP1} ${FILL_CLINIC} Click Next. Wait 600 ms for the fade to finish (a shot taken during it comes out pale). Crop: the wizard card (.au-setup), whole height (full-page capture: the card is taller than the window). Markers: 3 on the Currency select, 4 on the row of working-day chips.`,
    },
    {
      id: 'getting-started-setup-account',
      device: 'desktop',
      alt: { ar: 'خطوة حسابك: اللقب والاسم والاختصاص ورمز الدخول', en: 'The Your account step: title, name, specialty and sign-in PIN' },
      recipe: `${EMPTY} Desktop window (1440×900). ${STEP1} ${FILL_CLINIC} Click Next, leave the Currency & hours step as it is and click Next again. ${FILL_OWNER} Do not click Next. Wait 400 ms. Crop: the wizard card (.au-setup). Markers: 1 on the full-name field, 2 on the PIN field (#owner-pin).`,
    },
    {
      id: 'getting-started-setup-review',
      device: 'desktop',
      alt: { ar: 'خطوة المراجعة مع بطاقات العيادة والحساب والعملة ومربع الموافقة على الشروط', en: 'The Review step with the clinic, account and currency cards and the terms checkbox' },
      recipe: `${EMPTY} Desktop window (1440×900). Fill the wizard as in getting-started-setup-account, then click Next: the Review step. Tick the terms checkbox inside [data-qa="setup-terms"]. Wait 600 ms. Crop: the wizard card (.au-setup), whole height (full-page capture). Markers: 3 on the Edit link of the Clinic card, 4 on the terms checkbox, 5 on Start working ([data-qa="next"]).`,
    },
    {
      id: 'getting-started-restore-link',
      device: 'desktop',
      alt: { ar: 'رابط استعادة البيانات من نسخة احتياطية في الشاشة الأولى للمعالج', en: 'The link to restore data from a backup on the wizard’s first screen' },
      recipe: `${EMPTY} Desktop window (1440×900). Stay on step 1 (English shot: click [data-lang="en"]). Crop: from the top of the two language cards down to the bottom of the dashed restore box (.au-restore), with 24 px of margin. Markers: 2 on the link Restore your data from a backup ([data-qa="restore"]).`,
    },
    {
      id: 'getting-started-signin-users',
      device: 'desktop',
      alt: { ar: 'شاشة الدخول وعليها حسابات فريق العيادة', en: 'The sign-in screen showing the clinic team’s accounts' },
      recipe: `${DEMO} Desktop window (1440×900). Sign out (user menu at the bottom of the sidebar → Sign out), remove localStorage 'dentora.lastUser' so the list of users shows instead of the keypad, and reload #/login. Crop: the whole window. Markers: 1 on the admin's tile (the first .au-tile).`,
    },
    {
      id: 'getting-started-signin-pin',
      device: 'phone',
      alt: { ar: 'لوحة الأرقام لإدخال رمز الدخول على الهاتف', en: 'The PIN keypad on a phone' },
      recipe: `${DEMO} Phone viewport (about 400×860, touch). Sign out, open #/login and tap the admin's tile (the keypad shows directly if the admin was the last to sign in). Type nothing. Crop: the whole screen. Markers: 2 on the keypad (.pin-pad), 3 on Switch user ([data-qa="change-user"]), 4 on Forgot your PIN? ([data-qa="forgot"]).`,
    },
    {
      id: 'getting-started-first-steps',
      device: 'desktop',
      alt: { ar: 'الشاشة الرئيسية لعيادة جديدة فارغة بعد الإعداد', en: 'The dashboard of a brand-new, empty clinic right after setup' },
      caption: { ar: 'عيادة جديدة بعد الإعداد مباشرة: لا مواعيد ولا مرضى بعد.', en: 'A new clinic right after setup: no appointments or patients yet.' },
      recipe: `${NEW_CLINIC} Desktop window (1440×900). You land on #/ with every card at zero. Crop: the whole window. Markers: 1 on Settings in the sidebar, 2 on Procedures in the sidebar, 3 on Staff in the sidebar, 4 on the New patient button ([data-testid="dash-new-patient"]), 5 on the New appointment button ([data-testid="dash-new-apt"]). No marker for step 6.`,
    },
  ],
}

export default topic

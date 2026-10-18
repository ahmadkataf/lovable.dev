import type { GuideTopic } from '../types'

// How the pictures are made (store/scripts/guide-shots.mjs). Every recipe starts from this state:
const DEMO = "Demo clinic as store/scripts/shoot.mjs makes it (seedAndLogin + Settings → Backup → Load demo data; English shots use its englishClinic() names), signed in as the admin (Dr. Ahmad Al-Khatib), clock fixed at Sunday 11 October 2026 11:40 Asia/Damascus, trial bar hidden ([data-qa=\"trial-bar\"]{display:none}), page scrolled to the top. Settings cards are .card elements inside .st-form; find them by their title."

const topic: GuideTopic = {
  slug: 'settings',
  order: 14,
  icon: 'settings',
  title: { ar: 'الإعدادات', en: 'Settings' },
  summary: {
    ar: 'اجعل البرنامج على مقاس عيادتك: بياناتها وشعارها على كل ورقة مطبوعة، والعملة والضريبة وترقيم الفواتير، واللغة والخط والمظهر، وأوقات الدوام والقفل التلقائي.',
    en: 'Make Dentora fit your clinic: its details and logo on every printout, the currency, tax and invoice numbering, the language, font and appearance, the working hours and auto-lock.',
  },
  metaDescription: {
    ar: 'اجعل البرنامج على مقاس عيادتك: بياناتها وشعارها على كل ورقة مطبوعة، والعملة والضريبة وترقيم الفواتير، واللغة والخط والمظهر، وأوقات الدوام والقفل التلقائي.',
    en: 'Fit Dentora to your clinic: details and logo on printouts, currency, tax and invoice numbering, language, font and appearance, working hours and auto-lock.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'صفحة الإعدادات', en: 'The Settings page' },
      text: {
        ar: [
          "تفتح **الإعدادات** من القائمة الجانبية أو من قائمة حسابك. وفي جانب الصفحة قائمة أقسامها: **بيانات العيادة**، و**التفضيلات**، و**الفوترة والعملة**، و**النسخ الاحتياطي**، و**الترخيص**، و**حول البرنامج**.",
          "تشرح هذه الصفحة كل الأقسام عدا اثنين لكل منهما صفحته: [النسخ الاحتياطي](backup) و[الترخيص](licence). أما إضافة الفريق وصلاحياته ففي [الفريق والصلاحيات](staff).",
        ],
        en: [
          "Open **Settings** from the sidebar or from your account menu. A list of its sections runs down the side of the page: **Clinic**, **Preferences**, **Billing & currency**, **Backup & data**, **Licence** and **About**.",
          "This page covers every section except two that have pages of their own: [Backup](backup) and [Licence](licence). Adding your team and their permissions is in [Staff and permissions](staff).",
        ],
      },
      steps: {
        ar: [
          "افتح **الإعدادات** من القائمة الجانبية.",
          "اختر القسم من قائمة الأقسام.",
          "عدّل ما تريد. في **بيانات العيادة** و**الفوترة والعملة** يظهر أسفل الصفحة شريط **لديك تغييرات غير محفوظة**: انقر على **حفظ التغييرات**، أو **تراجع** لإلغاء تعديلاتك. أما **التفضيلات** فيُحفظ أغلبها فور النقر.",
        ],
        en: [
          "Open **Settings** from the sidebar.",
          "Pick a section from the list.",
          "Make your changes. In **Clinic** and **Billing & currency** a **You have unsaved changes** bar appears at the bottom: click **Save changes**, or **Discard** to throw your edits away. Most **Preferences** are saved the moment you click.",
        ],
      },
      tips: {
        ar: [
          "يغيّر مدير العيادة وحده هذه الإعدادات. يرى بقية الفريق الصفحة مع رسالة «يمكن لمدير النظام فقط تعديل هذه الإعدادات.»، ويستطيعون تغيير خط الواجهة على أجهزتهم فقط.",
          "قسم **النسخ الاحتياطي** يظهر للمدير وحده. وعلى الحاسوب تعني النقطة البرتقالية بجانبه في قائمة الأقسام أن نسخة احتياطية مستحقة.",
          "إن حاولت مغادرة الصفحة وفيها تعديلات لم تُحفظ يسألك البرنامج **المغادرة دون حفظ؟**، فاختر **البقاء والمتابعة** أو **المغادرة وتجاهل التعديلات**.",
          "على الهاتف تظهر الأقسام أزراراً في أعلى الصفحة، تمرّرها بإصبعك يميناً ويساراً.",
          "حين يكون البرنامج للقراءة فقط لا تُحفظ تعديلات **بيانات العيادة** و**الفوترة والعملة** و**أيام وأوقات الدوام** حتى التفعيل. أما اللغة وأسماء الأشهر والخط والمظهر والقفل التلقائي فتبقى قابلة للتغيير.",
        ],
        en: [
          "Only the clinic admin changes these settings. The rest of the team sees the page with the message “Only an administrator can change these settings.”, and can only change the interface font on their own device.",
          "The **Backup & data** section shows for the admin only. On a computer, an orange dot next to it in the section list means a backup is due.",
          "If you try to leave with unsaved changes, Dentora asks **Leave without saving?**: choose **Stay here** or **Leave and discard**.",
          "On a phone the sections become buttons across the top of the page; swipe them sideways.",
          "While Dentora is read-only, changes to **Clinic**, **Billing & currency** and **Working days & hours** cannot be saved until you activate. Language, month names, font, appearance and auto-lock can still be changed.",
        ],
      },
      shots: ['settings-overview', 'settings-phone'],
    },
    {
      id: 'clinic-details',
      title: { ar: 'بيانات العيادة', en: 'Clinic details' },
      text: {
        ar: ["هنا هوية عيادتك كما تظهر في رأس الفواتير والوصفات وخطط العلاج المطبوعة، وفي أعلى القائمة الجانبية، وفي شاشة الدخول."],
        en: ["This is your clinic’s identity as it appears at the top of printed invoices, prescriptions and treatment plans, at the top of the sidebar and on the sign-in screen."],
      },
      steps: {
        ar: [
          "افتح **الإعدادات** ← **بيانات العيادة**.",
          "انقر على **رفع شعار** واختر صورة الشعار. وتستطيع لاحقاً استبداله بزر **تغيير الشعار**، أو حذفه بزر **إزالة**.",
          "اكتب **اسم العيادة**، وإن أردت **الاسم بالإنجليزية** و**العبارة التعريفية**، مثل اختصاص العيادة أو اسم طبيبها.",
          "في **التواصل والعنوان** أضف **الهاتف** و**هاتف آخر** و**البريد الإلكتروني** و**الموقع الإلكتروني** و**العنوان**.",
          "تأكد من **الدولة**. يبقى الخيار التلقائي حسب العملة ما لم تختر غيره.",
          "راقب **معاينة رأس الفاتورة** وهي تتحدث مع كل حرف تكتبه، ثم انقر على **حفظ التغييرات**.",
        ],
        en: [
          "Open **Settings** → **Clinic**.",
          "Click **Upload logo** and choose your logo picture. Later you can **Change logo** or **Remove** it.",
          "Type the **Clinic name** and, if you like, the **Name in English** and a **Tagline**, such as the clinic’s specialty or its doctor’s name.",
          "Under **Contact & address** add the **Phone**, **Other phone**, **Email**, **Website** and **Address**.",
          "Check the **Country**. It stays on the automatic choice, from the currency, unless you pick another.",
          "Watch the **Invoice header preview** update as you type, then click **Save changes**.",
        ],
      },
      tips: {
        ar: [
          "الشعار صورة مربعة بصيغة PNG أو JPG، ويُصغَّر تلقائياً. وإن لم ترفع شعاراً تظهر أيقونة البرنامج مكانه.",
          "يظهر الاسم بالإنجليزية حين تُستخدم الواجهة بالإنجليزية، وتحت الاسم العربي في المطبوعات.",
          "تحدد **الدولة** رمز الاتصال الذي يُضاف إلى الأرقام المحلية (مثل 0944…) في رسائل واتساب، وتحدد أسماء الأشهر بالعربية حين تكون على الخيار التلقائي.",
          "**اسم العيادة** وحده مطلوب. ويتحقق البرنامج من صحة الهاتف والبريد والموقع قبل الحفظ، ويظلل الحقل الخاطئ بالأحمر.",
        ],
        en: [
          "The logo is a square PNG or JPG picture, resized for you. Without a logo, the app’s icon shows in its place.",
          "The English name is used when the interface is in English, and under the Arabic name on printouts.",
          "The **Country** sets the calling code added to local numbers (such as 0944…) in WhatsApp messages, and the Arabic month names when those are left on automatic.",
          "Only the **Clinic name** is required. Phone numbers, email and website are checked before saving, and a wrong field turns red.",
        ],
      },
      shots: ['settings-clinic-identity', 'settings-clinic-preview'],
    },
    {
      id: 'billing-currency',
      title: { ar: 'العملة وشكل المبالغ', en: 'Currency and how amounts look' },
      text: {
        ar: ["في **الفوترة والعملة** تختار عملة العيادة وطريقة كتابة المبالغ. وفي أعلى الصفحة **معاينة مباشرة** تتحدث مع كل تعديل قبل الحفظ: شكل المبالغ، ورقم الفاتورة التالية، ورقم ملف المريض التالي، وفاتورة نموذجية."],
        en: ["In **Billing & currency** you choose the clinic’s currency and how amounts are written. A **Live preview** at the top updates with every change, before you save: how amounts look, the next invoice number, the next patient file number and a sample invoice."],
      },
      steps: {
        ar: [
          "افتح **الإعدادات** ← **الفوترة والعملة**.",
          "اختر **عملة العيادة**. وإن لم تجد عملتك فاختر **عملة أخرى…** واكتب **رمز العملة** باللاتينية.",
          "غيّر **الرمز على الفاتورة** إن أردت شكلاً آخر للرمز الذي يظهر بجانب كل مبلغ.",
          "اختر **الكسور العشرية**: **بدون كسور** أو **منزلتان (0.00)** أو **ثلاث منازل (0.000)**.",
          "انقر على **حفظ التغييرات**.",
        ],
        en: [
          "Open **Settings** → **Billing & currency**.",
          "Choose the **Clinic currency**. If yours is not listed, choose **Another currency…** and type its Latin **Currency code**.",
          "Change the **Symbol on invoices** if you prefer another symbol next to every amount.",
          "Choose the **Decimals**: **None**, **Two (0.00)** or **Three (0.000)**.",
          "Click **Save changes**.",
        ],
      },
      tips: {
        ar: [
          "تغيير العملة لا يحوّل المبالغ المسجلة سابقاً، بل يغيّر الرمز المعروض فقط. لذلك اختر عملتك الصحيحة قبل أن تبدأ الفوترة.",
          "الدينار الكويتي والبحريني والأردني والريال العماني تُكتب عادة بثلاث منازل.",
        ],
        en: [
          "Changing the currency does not convert amounts already recorded; only the symbol shown changes. So pick the right currency before you start billing.",
          "The Kuwaiti, Bahraini and Jordanian dinars and the Omani rial are usually written with three decimals.",
        ],
      },
      shots: ['settings-billing-currency'],
    },
    {
      id: 'invoices-numbering',
      title: { ar: 'الضريبة وترقيم الفواتير ونصوص الطباعة', en: 'Tax, invoice numbering and printed notes' },
      steps: {
        ar: [
          "في **الفواتير والترقيم** اكتب **نسبة الضريبة**، أو اتركها 0 إن كانت عيادتك لا تفرض ضريبة.",
          "إن كانت العيادة مسجلة في ضريبة القيمة المضافة فاكتب **الرقم الضريبي للعيادة**، فيُطبع على الفواتير الضريبية.",
          "غيّر **بادئة رقم الفاتورة** إن أردت. يتكون رقم الفاتورة من البادئة ثم ستة أرقام، مثل INV-000306.",
          "عدّل **رقم الفاتورة التالية** و**رقم ملف المريض التالي** إن أردت أن يكمل الترقيم من دفاتر عيادتك السابقة.",
          "في **نصوص الطباعة** اكتب **تذييل الفاتورة** و**تذييل الوصفة الطبية**، وهما نصان قصيران يظهران أسفل المطبوعات.",
          "انقر على **حفظ التغييرات**.",
        ],
        en: [
          "Under **Invoices & numbering** type the **Tax rate**, or leave it at 0 if your clinic charges no tax.",
          "If the clinic is registered for VAT, type the **Clinic tax number**: it is printed on tax invoices.",
          "Change the **Invoice number prefix** if you like. An invoice number is the prefix followed by six digits, such as INV-000306.",
          "Adjust the **Next invoice number** and **Next patient file number** if you want numbering to carry on from your clinic’s old records.",
          "Under **Printed notes** write the **Invoice footer** and the **Prescription footer**: short texts printed at the bottom.",
          "Click **Save changes**.",
        ],
      },
      tips: {
        ar: [
          "تُقترح نسبة الضريبة تلقائياً على كل فاتورة جديدة، ويمكن تغييرها في الفاتورة نفسها. ولا تتغير الفواتير الصادرة سابقاً.",
          "لا يقبل البرنامج رقماً للفاتورة التالية يساوي آخر فاتورة صادرة بالبادئة نفسها أو يقل عنها، حتى لا تتكرر الأرقام (البادئة الجديدة تبدأ سلسلة جديدة). والأمر نفسه لرقم ملف المريض.",
          "البادئة أحرف لاتينية وأرقام والرموز - و/ و_ و. و# فقط، حتى 10 خانات.",
          "إن تركت تذييل الوصفة فارغاً يُطبع نص افتراضي يتمنى للمريض الشفاء ويذكّره بالالتزام بالجرعات.",
          "وإن تركت تذييل الفاتورة فارغاً يُطبع سطر شكر افتراضي: «شكراً لثقتكم بنا، نتمنى لكم دوام الصحة والابتسامة.» ويُطبع تذييل الفاتورة أيضاً أسفل كشف الحساب.",
          "تفاصيل الفواتير وطباعتها في [الفواتير والمدفوعات](billing).",
        ],
        en: [
          "The tax rate is filled in on every new invoice and can still be changed on the invoice itself. Invoices already issued do not change.",
          "Dentora does not accept a next invoice number equal to or below the last invoice issued with the same prefix, so numbers never repeat (a new prefix starts a new series). The same goes for the patient file number.",
          "The prefix takes Latin letters, digits and the signs - / _ . # only, up to 10 characters.",
          "If you leave the prescription footer empty, a default text is printed wishing the patient a speedy recovery and reminding them to follow the doses.",
          "If you leave the invoice footer empty, a default thank-you line is printed: “Thank you for trusting us. We wish you lasting health and a bright smile.” The invoice footer is also printed on account statements.",
          "Invoices and how to print them: [Invoices and payments](billing).",
        ],
      },
      shots: ['settings-billing-numbering'],
    },
    {
      id: 'language-appearance',
      title: { ar: 'اللغة وأسماء الأشهر والخط والمظهر', en: 'Language, month names, font and appearance' },
      text: {
        ar: ["في **التفضيلات** تحمل كل بطاقة إعداد شارة تقول على من تسري: **لكل المستخدمين** أو **هذا الجهاز**. اللغة وأسماء الأشهر والخط والمظهر والقفل التلقائي تُحفظ فور اختيارها دون زر حفظ؛ أما **أيام وأوقات الدوام** فلها زر حفظ خاص (انظر أدناه)."],
        en: ["In **Preferences** each settings card carries a badge saying who it applies to: **All users** or **This device**. Language, month names, font, appearance and auto-lock are saved the moment you choose them, with no save button; **Working days & hours** has its own save button (see below)."],
      },
      steps: {
        ar: [
          "افتح **الإعدادات** ← **التفضيلات**.",
          "في **لغة الواجهة** اختر **العربية** أو **English**. تتغير الشاشات والمطبوعات فوراً.",
          "في **أسماء الأشهر بالعربية** اختر **تلقائياً حسب الدولة**، أو **كانون الثاني، شباط…**، أو **يناير، فبراير…**. يظهر تحت كل خيار مثال بتاريخ اليوم.",
          "في **خط الواجهة** انقر على الخط الذي يريحك، فيتغير فوراً على هذا الجهاز.",
          "في **المظهر** اختر **فاتح** أو **داكن**.",
        ],
        en: [
          "Open **Settings** → **Preferences**.",
          "Under **Interface language** choose **العربية** or **English**. Screens and printouts switch at once.",
          "Under **Arabic month names** choose **Automatic, from the country**, **كانون الثاني، شباط…** or **يناير، فبراير…**. Each choice shows today’s date as an example.",
          "Under **Interface font** click the font you find most comfortable; it changes at once on this device.",
          "Under **Appearance** choose **Light** or **Dark**.",
        ],
      },
      tips: {
        ar: [
          "اللغة وأسماء الأشهر والمظهر لكل المستخدمين ويغيّرها المدير. أما الخط فيخص هذا الجهاز ويغيّره أي مستخدم.",
          "أسماء الأشهر تخص الواجهة العربية: كانون الثاني وشباط في سوريا ولبنان والأردن وفلسطين والعراق، ويناير وفبراير في الخليج ومصر والمغرب العربي.",
          "تُعرض الأرقام بالصيغة اللاتينية (0–9) في اللغتين، ويفهم البرنامج الأرقام العربية (٠–٩) إن كتبتها في البحث أو في رمز الدخول.",
        ],
        en: [
          "Language, month names and appearance apply to all users and only the admin changes them. The font belongs to this device and anyone can change it.",
          "Month names only matter in the Arabic interface: كانون الثاني, شباط… in Syria, Lebanon, Jordan, Palestine and Iraq; يناير, فبراير… in the Gulf, Egypt and the Maghreb.",
          "Numbers use Western digits (0–9) in both languages, and Arabic-Indic digits (٠–٩) typed into search or a PIN are understood.",
        ],
      },
      shots: ['settings-preferences-language', 'settings-preferences-font'],
    },
    {
      id: 'working-hours',
      title: { ar: 'أيام وأوقات الدوام', en: 'Working days and hours' },
      text: {
        ar: ["يُبنى تقويم [المواعيد](appointments) وأوقات الحجز المتاحة على أيام الدوام وساعاته. لهذا القسم زر حفظ خاص به."],
        en: ["The [appointments](appointments) calendar and its free slots are built on your working days and hours. This section has its own save button."],
      },
      steps: {
        ar: [
          "في **التفضيلات** ← **أيام وأوقات الدوام** انقر على الأيام لتحديدها أو إلغائها في **أيام العمل**.",
          "حدد **بداية الدوام** و**نهاية الدوام**.",
          "اختر **دقة شبكة التقويم**: المسافة الزمنية بين خطوط التقويم، 15 أو 20 أو 30 دقيقة أو ساعة.",
          "اختر **مدة الموعد الافتراضية** التي تُقترح عند حجز موعد جديد، من 15 دقيقة إلى ساعتين.",
          "انقر على **حفظ أوقات الدوام**.",
        ],
        en: [
          "In **Preferences** → **Working days & hours**, click days under **Working days** to select or clear them.",
          "Set **Opens at** and **Closes at**.",
          "Choose the **Calendar grid step**: the time between calendar lines, 15, 20 or 30 minutes or 1 hour.",
          "Choose the **Default appointment length** suggested when booking, from 15 minutes to 2 hours.",
          "Click **Save working hours**.",
        ],
      },
      tips: {
        ar: [
          "تحت الحقول ملخص بعدد أيام العمل وساعات الدوام اليومية.",
          "يجب أن تختار يوم عمل واحداً على الأقل، وأن تكون نهاية الدوام بعد بدايته.",
          "إن غادرت القسم قبل الحفظ يسألك البرنامج إن كنت تريد ترك التعديلات.",
        ],
        en: [
          "Under the fields, a summary shows the number of working days and hours a day.",
          "At least one working day is needed, and closing time must come after opening time.",
          "If you leave before saving, Dentora asks whether to drop your changes.",
        ],
      },
      shots: ['settings-preferences-hours'],
    },
    {
      id: 'auto-lock',
      title: { ar: 'القفل التلقائي', en: 'Auto-lock' },
      text: {
        ar: ["يقفل Dentora نفسه بعد مدة من عدم الاستخدام، فيعود إلى شاشة الدخول ويطلب رمز الدخول. هكذا تبقى ملفات المرضى محمية إن تُرك الجهاز مفتوحاً."],
        en: ["Dentora locks itself after a period without use: it goes back to the sign-in screen and asks for a PIN. That keeps patient files safe on a device left open."],
      },
      steps: {
        ar: [
          "في **التفضيلات** ← **القفل التلقائي** افتح قائمة **القفل بعد عدم النشاط**.",
          "اختر بعد 5 أو 15 أو 30 دقيقة، أو بعد ساعة، أو **دون قفل تلقائي**. يظهر اختيارك في **الإعداد الحالي**.",
        ],
        en: [
          "In **Preferences** → **Auto-lock**, open **Lock after inactivity**.",
          "Choose after 5, 15 or 30 minutes, after 1 hour, or **Never lock automatically**. Your choice shows under **Current setting**.",
        ],
      },
      tips: {
        ar: [
          "الإعداد يخص هذا الجهاز ويغيّره المدير. ويسري فوراً، فيُحسب وقت عدم النشاط من لحظة التغيير.",
          "الإعداد المبدئي 15 دقيقة.",
          "يُحسب أيضاً الوقت الذي يقضيه الجهاز نائماً: إن عدت إليه بعد المدة المحددة تجد البرنامج مقفلاً.",
          "دون قفل تلقائي قد يطّلع أي شخص على بيانات المرضى إن تُرك الجهاز مفتوحاً، فلا ننصح به.",
          "الدخول ونسيان الرمز في [تسجيل الدخول كل يوم](getting-started#sign-in) و[نسيت رمز الدخول؟](staff#forgot-pin).",
        ],
        en: [
          "The setting belongs to this device and the admin changes it. It applies at once, counting inactivity from the moment you change it.",
          "It starts at 15 minutes.",
          "Time the device spends asleep counts too: come back after the delay and Dentora is locked.",
          "Without auto-lock anyone could see patient data on a device left open, so we do not recommend it.",
          "Signing in and forgotten PINs: [Signing in every day](getting-started#sign-in) and [Forgot your PIN?](staff#forgot-pin).",
        ],
      },
      shots: ['settings-auto-lock'],
    },
    {
      id: 'about',
      title: { ar: 'حول البرنامج', en: 'About' },
      text: {
        ar: ["يعرض **حول البرنامج** رقم إصدار Dentora، والمنصة التي يعمل عليها (ويندوز أو أندرويد)، ومكان البيانات، و**رقم الجهاز**. وفيه بطاقة **مساعدة** تفتح **دليل الاستخدام** (هذا الدليل) و**الفيديوهات التعليمية** على موقع Dentora، وملخص ميزات البرنامج و**اختصارات لوحة المفاتيح**."],
        en: ["**About** shows your Dentora version, the platform it runs on (Windows or Android), where the data is kept, and the **Device number**. Its **Help** card opens the **User guide** (this guide) and the **Video tutorials** on Dentora’s website, and it also lists what Dentora does and the **Keyboard shortcuts**."],
      },
      steps: {
        ar: [
          "افتح **الإعدادات** ← **حول البرنامج**.",
          "في **مساعدة** انقر على **دليل الاستخدام** أو **الفيديوهات التعليمية**: تُفتح الصفحة في المتصفح، فيلزم اتصال بالإنترنت.",
          "في **الخصوصية والشروط** انقر على **سياسة الخصوصية** أو **شروط الاستخدام** أو **تراخيص المصادر المفتوحة** لقراءتها.",
        ],
        en: [
          "Open **Settings** → **About**.",
          "Under **Help** click **User guide** or **Video tutorials**: the page opens in your browser, so you need the internet.",
          "Under **Privacy & terms** click **Privacy policy**, **Terms of use** or **Open-source licences** to read them.",
        ],
      },
      tips: {
        ar: [
          "حين تراسل الدعم، أرسل معك رقم الإصدار ورقم الجهاز من هذه الصفحة.",
          "يُستخدم رقم الجهاز في تفعيل الترخيص، وفي إعادة تعيين رمز المدير إن نسيه. انظر [الترخيص](licence) و[نسيت رمز الدخول؟](staff#forgot-pin).",
          "يظهر تحت **شروط الاستخدام** تاريخ موافقة العيادة عليها.",
        ],
        en: [
          "When you contact support, include the version and the device number from this page.",
          "The device number is used when activating your licence and when resetting a forgotten admin PIN. See [Licence](licence) and [Forgot your PIN?](staff#forgot-pin).",
          "Under **Terms of use** you can see the date the clinic accepted them.",
        ],
      },
      shots: ['settings-about-help', 'settings-about'],
    },
  ],
  shots: [
    {
      id: 'settings-overview',
      device: 'desktop',
      alt: { ar: 'صفحة الإعدادات على بيانات العيادة، مع قائمة الأقسام وشريط الحفظ', en: 'The Settings page on Clinic, with the section list and the save bar' },
      caption: { ar: 'يظهر شريط الحفظ أسفل الصفحة بمجرد أن تعدّل شيئاً.', en: 'The save bar appears at the bottom as soon as you change something.' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/clinic and wait for the form. Type تجميل وزراعة الأسنان (Arabic shot) / Cosmetic & implant dentistry (English shot) in the Tagline field, then click an empty area so no field has focus: the save bar ([data-qa="savebar"]) sticks to the bottom of the window. Crop: the whole window. Markers: 1 on Settings in the sidebar, 2 on the section list (.st-nav), 3 on Save changes ([data-qa="save"]). Do not save: reload the page afterwards to drop the change.`,
    },
    {
      id: 'settings-phone',
      device: 'phone',
      alt: { ar: 'الإعدادات على الهاتف: الأقسام أزرار في أعلى الصفحة', en: 'Settings on a phone: the sections as buttons at the top' },
      recipe: `${DEMO} Phone viewport (about 400×860, touch). Open #/settings/clinic. Crop: the whole screen. No markers.`,
    },
    {
      id: 'settings-clinic-identity',
      device: 'desktop',
      alt: { ar: 'بطاقة هوية العيادة: الشعار واسم العيادة والاسم بالإنجليزية والعبارة التعريفية', en: 'The Clinic identity card: logo, clinic name, English name and tagline' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/clinic. Crop: the Clinic identity card (the first card, containing [data-qa="logo-box"]). Markers: 2 on Upload logo ([data-qa="pick-logo"]), 3 on the Clinic name field ([data-qa="clinic-name"]).`,
    },
    {
      id: 'settings-clinic-preview',
      device: 'desktop',
      alt: { ar: 'بطاقة التواصل والعنوان والدولة، ومعاينة رأس الفاتورة', en: 'The Contact & address card with the country, and the invoice header preview' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/clinic. Crop: from the top of the Contact & address card down to the bottom of the Invoice header preview card ([data-qa="invoice-preview"] is inside it); a full-page capture may be needed. Markers: 4 on the Phone field ([data-qa="clinic-phone"]), 5 on the Country select ([data-qa="clinic-country"]), 6 on the preview.`,
    },
    {
      id: 'settings-billing-currency',
      device: 'desktop',
      alt: { ar: 'المعاينة المباشرة وبطاقة العملة: عملة العيادة والرمز والكسور العشرية', en: 'The live preview and the Currency card: clinic currency, symbol and decimals' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/billing. Crop: the Live preview card ([data-qa="billing-preview"]) and the Currency card under it. Markers: 2 on the Clinic currency select ([data-qa="currency"]), 3 on Symbol on invoices ([data-qa="currency-symbol"]), 4 on the Decimals switch.`,
    },
    {
      id: 'settings-billing-numbering',
      device: 'desktop',
      alt: { ar: 'بطاقتا الفواتير والترقيم ونصوص الطباعة', en: 'The Invoices & numbering and Printed notes cards' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/billing and scroll down. Crop: the Invoices & numbering card and the Printed notes card under it (full-page capture if needed). Markers: 1 on Tax rate ([data-qa="tax"]), 2 on Clinic tax number ([data-qa="tax-number"]), 3 on Invoice number prefix ([data-qa="prefix"]), 4 on Next invoice number ([data-qa="next-invoice"]), 5 on Invoice footer.`,
    },
    {
      id: 'settings-preferences-language',
      device: 'desktop',
      alt: { ar: 'بطاقتا لغة الواجهة وأسماء الأشهر بالعربية', en: 'The Interface language and Arabic month names cards' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/preferences. Crop: the Interface language card and the Arabic month names card ([data-qa="month-style"] is inside it). Markers: 2 on the language cards ([data-lang]), 3 on the month-name choices.`,
    },
    {
      id: 'settings-preferences-font',
      device: 'desktop',
      alt: { ar: 'اختيار خط الواجهة والمظهر الفاتح أو الداكن', en: 'Choosing the interface font and the light or dark appearance' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/preferences and scroll to the Interface font card. Crop: the Interface font card and the Appearance card under it (full-page capture if needed). Markers: 4 on the Cairo font card ([data-font="cairo"]), 5 on the Dark card ([data-theme-option="dark"]).`,
    },
    {
      id: 'settings-preferences-hours',
      device: 'desktop',
      alt: { ar: 'بطاقة أيام وأوقات الدوام مع زر حفظ أوقات الدوام', en: 'The Working days & hours card with the Save working hours button' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/preferences, scroll to Working days & hours and click the Friday chip (الجمعة / Friday) so the card has an unsaved change and its save button is active. Crop: that card. Markers: 1 on the Friday chip, 2 on Opens at ([data-qa="work-start"]), 3 on Calendar grid step, 4 on Default appointment length, 5 on Save working hours ([data-qa="save-hours"]). Do not save: reload afterwards.`,
    },
    {
      id: 'settings-auto-lock',
      device: 'desktop',
      alt: { ar: 'بطاقة القفل التلقائي: القفل بعد عدم النشاط والإعداد الحالي', en: 'The Auto-lock card: lock after inactivity and the current setting' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/preferences and scroll to the Auto-lock card. Crop: that card. Markers: 1 on Lock after inactivity ([data-qa="lock-select"]), 2 on Current setting ([data-qa="lock-current"]).`,
    },
    {
      id: 'settings-about-help',
      device: 'desktop',
      alt: { ar: 'بطاقة المساعدة في حول البرنامج: دليل الاستخدام والفيديوهات التعليمية', en: 'The Help card in About: User guide and Video tutorials' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/about. Crop: the Help card ([data-qa="about-help"]). Do not include the top card: in a browser build its platform reads “Web browser”. Markers: 2 on User guide ([data-qa="about-guide"]).`,
    },
    {
      id: 'settings-about',
      device: 'desktop',
      alt: { ar: 'الخصوصية والشروط في حول البرنامج', en: 'Privacy & terms in About' },
      recipe: `${DEMO} Desktop window (1440×900). Open #/settings/about. Crop: the Privacy & terms card ([data-qa="about-legal"] is inside it). Markers: 3 on Privacy policy ([data-qa="about-privacy"]).`,
    },
  ],
}

export default topic

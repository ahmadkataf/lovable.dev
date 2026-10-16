import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in store/scripts/shoot.mjs.
// The team: Dr. Ahmad Al-Khatib (admin, u-admin), Dr. Laila Haddad (doctor, u-doc2), Sara Youssef (receptionist, u-rec),
// all with PIN 1234, plus the demo's Dr. Samer Abboud (doctor). Their PINs are stored the old way by seedAndLogin, so the
// sign-in screen does not submit by itself after 4 digits: type 1234 then press Enter. Never save anything in a shot.
const DESK = 'Desktop 1440×900, demo clinic as store/scripts/shoot.mjs makes it (seedAndLogin + Settings → Backup → Load demo data; English shots use its englishClinic() names), signed in as the admin (Dr. Ahmad Al-Khatib), clock fixed at Sunday 11 Oct 2026 11:40 Asia/Damascus, trial bar hidden ([data-qa="trial-bar"]{display:none}), page scrolled to the top and held there (page.goto() reads as Back to the app, which restores an old scroll position).'
const PHONE = 'Phone 390×844 (isMobile, hasTouch, deviceScaleFactor 8/3 as shoot.mjs), same demo clinic, clock and hidden trial bar.'
const LOCK = 'Lock the screen: click the user button at the bottom of the sidebar (.sidebar-user) and choose **Lock screen** (قفل الشاشة); the sign-in screen (#/login) opens.'
const SIGN_IN = (id: string) => `on the sign-in screen click **Switch user** ([data-qa="change-user"]) if it is shown, click the tile [data-user="${id}"], type 1234 on the keyboard and press Enter; wait for the dashboard.`

const topic: GuideTopic = {
  slug: 'staff',
  order: 15,
  icon: 'userCog',
  title: { ar: 'الفريق والصلاحيات', en: 'Staff and permissions' },
  summary: {
    ar: 'أضف أطباءك ومساعديك وموظفي الاستقبال، ولكلٍّ منهم رمز دخول ودور يحدد ما يراه. واعرف كيف يقفل البرنامج نفسه، وما الحل إن نسي أحدكم رمزه.',
    en: 'Add your doctors, assistants and receptionists, each with their own PIN and a role that decides what they see. See how the screen locks itself, and what to do when someone forgets their PIN.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'صفحة الفريق', en: 'The Staff page' },
      text: {
        ar: [
          'افتح **الفريق** من القائمة الجانبية، في قسم **الإدارة**. لكل عضو بطاقة فيها صورته الرمزية بلونه، واسمه ولقبه، ودوره، والاختصاص والهاتف والبريد، ووقت **آخر دخول** أو **لم يسجّل الدخول بعد**. وعلى بطاقتك أنت شارة **أنت**.',
          'في أسفل كل بطاقة مفتاح يوقف الحساب أو يفعّله بنقرة، وفي أعلاها زر ⋮ لبقية الخيارات. وفوق البطاقات تصفية: **الكل** و**المفعّلون** و**الموقوفون**.',
          'تحت البطاقات لوحتان: **الصلاحيات حسب الدور** تبيّن ما يستطيعه كل دور، و**سجل الدخول** يعرض آخر 30 عملية دخول إلى البرنامج، مجموعة حسب اليوم.',
        ],
        en: [
          'Open **Staff** from the sidebar, in the **Management** section. Each member has a card with their avatar in their colour, name and title, role, specialty, phone and email, and their **Last sign-in** or **Has not signed in yet**. Your own card carries a **You** badge.',
          'At the bottom of each card a switch deactivates or activates the account in one click, and the ⋮ button at the top holds the other options. Above the cards a filter shows **All**, **Active** or **Deactivated** members.',
          'Under the cards are two panels: **Permissions by role** shows what each role can do, and the **Sign-in log** lists the last 30 sign-ins to the app, grouped by day.',
        ],
      },
      tips: {
        ar: [
          'صفحة الفريق لمدير العيادة وحده. من يفتحها بدور آخر يرى «هذه الصفحة لمدير العيادة».',
          'على الهاتف رقم الهاتف في البطاقة رابط: المسه لتتصل بالعضو.',
        ],
        en: [
          'The Staff page is for the clinic admin only. Anyone else who opens it sees “This page is for the clinic admin”.',
          'On a phone the phone number on the card is a link: tap it to call the member.',
        ],
      },
      shots: ['staff-overview'],
    },
    {
      id: 'roles',
      title: { ar: 'الأدوار والصلاحيات', en: 'Roles and permissions' },
      text: {
        ar: [
          'لكل عضو دور واحد من أربعة، والدور يحدد الصفحات التي تظهر له:',
          '**مدير**: صاحب العيادة أو مديرها. له كل الصلاحيات، ومنها المصروفات وقائمة الإجراءات وأسعارها وحذف ملفات المرضى والإعدادات والنسخ الاحتياطي والفريق ورموز الدخول.',
          '**طبيب**: يعالج المرضى ويكتب الوصفات ويصدر الفواتير ويطّلع على التقارير، دون الإعدادات أو إدارة الفريق.',
          '**مساعد**: المرضى والمواعيد والملف السريري (مخطط الأسنان والعلاجات والوصفات والمخبر) والمخزون، دون الفواتير والأمور المالية.',
          '**استقبال**: تسجيل المرضى وحجز المواعيد وإصدار الفواتير وقبض الدفعات والمخزون، دون الملف السريري.',
        ],
        en: [
          'Every member has one of four roles, and the role decides which pages they see:',
          '**Admin**: the clinic owner or manager. Every permission, including expenses, the procedure list and its prices, deleting patient files, settings, backups, the team and sign-in PINs.',
          '**Doctor**: treats patients, writes prescriptions, issues invoices and sees reports; no settings or team management.',
          '**Assistant**: patients, appointments, the clinical record (dental chart, treatments, prescriptions and lab) and inventory; no billing or finances.',
          '**Receptionist**: registers patients, books appointments, issues invoices, takes payments and manages inventory; no clinical record.',
        ],
      },
      tips: {
        ar: [
          'الصفحة التي لا يملك الدور صلاحيتها تختفي من قائمته. ومن يفتح عنوانها يرى «هذه الصفحة غير متاحة لدورك».',
          'المخزون متاح للأدوار الأربعة، والتقارير للمدير والأطباء، و[المصروفات](expenses) للمدير وحده.',
          'يرى الجميع **الإعدادات**، لكن تعديل إعدادات العيادة وصفحة النسخ الاحتياطي للمدير. انظر [الإعدادات](settings).',
          'الأدوار ثابتة كما في الجدول، ولا تُخصَّص صلاحيات عضو بعينه. لتوسيع صلاحيات أحد غيّر دوره.',
        ],
        en: [
          'A page the role has no permission for disappears from that member’s menu. Anyone who opens its address sees “This page is not available for your role”.',
          'Inventory is open to all four roles, Reports to the admin and the doctors, and [Expenses](expenses) to the admin only.',
          'Everyone sees **Settings**, but changing the clinic’s settings and the backup page are for the admin. See [Settings](settings).',
          'The roles are fixed as in the table; permissions are not set member by member. To give someone more access, change their role.',
        ],
      },
      shots: ['staff-matrix'],
    },
    {
      id: 'add-member',
      title: { ar: 'إضافة عضو جديد', en: 'Adding a team member' },
      steps: {
        ar: [
          'انقر على **إضافة عضو** أعلى الصفحة.',
          'اكتب **الاسم الكامل**، واختر **اللقب**: يضع البرنامج **د.** للطبيب و**بدون لقب** لبقية الأدوار، وتستطيع تغييره.',
          'أضف إن شئت **الاختصاص** و**الهاتف** و**البريد الإلكتروني**.',
          'اختر **الدور**. يظهر تحته وصف الدور، وبعد **يستطيع العمل على** الأقسام التي يفتحها.',
          'اختر لوناً للعضو: يميّز مواعيده في التقويم وصورته في البرنامج.',
          'اكتب **رمز الدخول (PIN)** من 4 إلى 6 أرقام، ثم **أعد كتابة الرمز**، وانقر على **إضافة العضو**. ثم أبلغ العضو برمزه.',
        ],
        en: [
          'Click **Add member** at the top of the page.',
          'Type the **Full name** and choose the **Title**: Dentora sets **Dr.** for a doctor and **No title** for the other roles, and you can change it.',
          'Add the **Specialty**, **Phone** and **Email** if you like.',
          'Choose the **Role**. A box under it describes the role and lists, under **Can work on**, the areas it opens.',
          'Pick a colour for the member: it marks their appointments in the calendar and their avatar in the app.',
          'Type a **Sign-in PIN** of 4 to 6 digits, then **Repeat the PIN**, and click **Add member**. Then tell the member their PIN.',
        ],
      },
      tips: {
        ar: [
          'لا يتكرر الاسم نفسه لعضوين («يوجد عضو آخر بهذا الاسم»).',
          'يختار البرنامج للعضو الجديد لوناً لا يستخدمه أحد بعد.',
          'يظهر العضو الجديد فوراً في شاشة الدخول، ويظهر الطبيب في قوائم الأطباء في المواعيد والتقارير.',
        ],
        en: [
          'Two members cannot have the same name (“Another member already has this name”).',
          'Dentora gives a new member a colour nobody uses yet.',
          'The new member shows on the sign-in screen at once, and a doctor shows in the doctor lists of appointments and reports.',
        ],
      },
      shots: ['staff-add'],
    },
    {
      id: 'manage',
      title: { ar: 'التعديل والإيقاف والحذف', en: 'Editing, deactivating and deleting' },
      text: {
        ar: [
          'في قائمة ⋮ على بطاقة العضو: **تعديل** لتغيير بياناته أو دوره أو لونه، و**تعيين رمز دخول جديد**، و**إيقاف الحساب** (أو **تفعيل الحساب** لحساب موقوف)، و**حذف العضو**.',
          'حين يترك أحدٌ العيادة أوقف حسابه: لا يستطيع الدخول بعدها، ويبقى اسمه على مواعيده وعلاجاته وفواتيره. تجده تحت **الموقوفون**، وتعيده متى شئت.',
          'أما الحذف فنهائي. وإن كان للعضو سجلات (مواعيد أو علاجات أو وصفات أو فواتير أو دفعات) تخبرك نافذة الحذف بعددها، لأنها ستبقى بلا اسمه، وتنصحك بالإيقاف بدلاً منه.',
        ],
        en: [
          'The ⋮ menu on a member’s card holds **Edit** to change their details, role or colour, **Set a new PIN**, **Deactivate account** (or **Activate account** for a deactivated one) and **Delete member**.',
          'When someone leaves the clinic, deactivate their account: they can no longer sign in, and their name stays on their appointments, treatments and invoices. You find them under **Deactivated** and can bring them back at any time.',
          'Deleting is permanent. If the member has records (appointments, treatments, prescriptions, invoices or payments), the delete dialog tells you how many would lose their name and recommends deactivating instead.',
        ],
      },
      tips: {
        ar: [
          'لا تستطيع إيقاف حسابك ولا حذفه وأنت تستخدمه.',
          'لا بد من بقاء مدير مفعّل واحد على الأقل: لا يُغيَّر دور آخر مدير ولا يُوقف ولا يُحذف. أضف مديراً آخر أولاً.',
          'في نافذة **تعديل** مفتاح **تعيين رمز دخول جديد** (اتركه مغلقاً ليبقى الرمز كما هو)، ومفتاح **الحساب مفعّل**.',
        ],
        en: [
          'You cannot deactivate or delete the account you are using.',
          'At least one active admin must remain: the last admin cannot change role, be deactivated or be deleted. Add another admin first.',
          'The **Edit** window has a **Set a new PIN** switch (leave it off to keep the current PIN) and an **Account active** switch.',
        ],
      },
      shots: ['staff-menu', 'staff-delete'],
    },
    {
      id: 'sign-in-lock',
      title: { ar: 'الدخول والقفل والخروج', en: 'Signing in, locking and signing out' },
      text: {
        ar: [
          'يدخل كل عضو باسمه ورمزه، فيرى ما يسمح به دوره، ويُحفظ اسمه مع ما يسجّله، مثل الدفعات والمصروفات وحركات المخزون. وتجد طريقة الدخول خطوة بخطوة في [تسجيل الدخول كل يوم](getting-started#sign-in).',
          'حين تبتعد عن الجهاز اقفل الشاشة، حتى لا يطّلع أحد على ملفات المرضى.',
        ],
        en: [
          'Each member signs in with their own name and PIN, sees what their role allows, and their name is kept with what they record, such as payments, expenses and stock movements. Signing in step by step is in [Signing in every day](getting-started#sign-in).',
          'When you step away from the device, lock the screen so nobody can see patient files.',
        ],
      },
      steps: {
        ar: [
          'انقر على اسمك في أسفل القائمة الجانبية. على الهاتف المس صورتك أعلى الشاشة، أو افتح **المزيد** حيث زرّا القفل والخروج بجانب اسمك.',
          'اختر **قفل الشاشة** حين تبتعد قليلاً: تظهر شاشة الدخول، وتعود برمزك.',
          'اختر **تسجيل الخروج** في نهاية دوامك. يعود البرنامج إلى شاشة الدخول، ومن يأتي بعدك ينقر على **تبديل المستخدم** ويختار اسمه.',
        ],
        en: [
          'Click your name at the bottom of the sidebar. On a phone tap your picture at the top of the screen, or open **More**, where the lock and sign-out buttons sit next to your name.',
          'Choose **Lock screen** when you step away for a while: the sign-in screen appears, and you come back with your PIN.',
          'Choose **Sign out** at the end of your shift. Dentora goes back to the sign-in screen, and the next person clicks **Switch user** and picks their name.',
        ],
      },
      tips: {
        ar: [
          'يقفل البرنامج نفسه بعد مدة من عدم الاستخدام، 15 دقيقة مسبقاً، ويُحسب منها الوقت الذي ينام فيه الجهاز. يغيّر المدير المدة لهذا الجهاز من [القفل التلقائي](settings#auto-lock).',
          'يطلب البرنامج رمز الدخول في كل مرة تشغّله من جديد، على ويندوز وأندرويد. أما العودة إليه من تطبيق آخر فلا تطلب الرمز ما لم تنقضِ مدة القفل التلقائي.',
          'خمس محاولات خاطئة متتالية توقف لوحة الأرقام لذلك الحساب 30 ثانية، ثم دقيقة، ثم 5 دقائق، ثم 15، ثم 30، ثم ساعة، حتى يُكتب الرمز الصحيح. ويبقى الإيقاف حتى لو أُغلق البرنامج، ويُنسى العدّ بعد يوم بلا أخطاء.',
          'قبل الإيقاف يحذّرك البرنامج: «بقيت محاولتان قبل القفل المؤقت».',
        ],
        en: [
          'Dentora locks itself after a period without use, 15 minutes to start with, and time the device spends asleep counts. The admin changes the delay for this device in [Auto-lock](settings#auto-lock).',
          'Dentora asks for a PIN every time it is started, on Windows and on Android. Coming back to it from another app does not, unless the auto-lock delay has passed.',
          'Five wrong PINs in a row pause that account’s keypad for 30 seconds, then 1 minute, 5 minutes, 15, 30 and an hour, until the right PIN is typed. The pause holds even if the app is closed, and the count is forgotten after a day without mistakes.',
          'Before the pause Dentora warns you: “2 attempts left before a short lock”.',
        ],
      },
      shots: ['staff-locked', 'staff-phone-more'],
    },
    {
      id: 'forgot-pin',
      title: { ar: 'نسيت رمز الدخول؟', en: 'Forgot your PIN?' },
      text: {
        ar: [
          'إن نسي أحد أعضاء الفريق رمزه فالحل عند المدير: من قائمة ⋮ على بطاقته يختار **تعيين رمز دخول جديد**، ويكتب الرمز الجديد مرتين، وينقر على **حفظ الرمز الجديد**. يدخل العضو بالرمز الجديد من الدخول القادم، ويُرفع عنه أي إيقاف بسبب المحاولات الخاطئة.',
          'وإن نسي المدير رمزه وفي العيادة مدير آخر، فالمدير الآخر يعيّن له رمزاً جديداً بالطريقة نفسها. أما إن كان هو المدير الوحيد فاتبع الخطوات التالية:',
        ],
        en: [
          'If a team member forgets their PIN, the admin can fix it: from the ⋮ menu on their card choose **Set a new PIN**, type the new PIN twice and click **Save new PIN**. The member uses the new PIN from their next sign-in, and any pause from wrong attempts is lifted.',
          'If the admin forgets their PIN and the clinic has another admin, that admin sets a new one the same way. If they are the only admin, follow these steps:',
        ],
      },
      steps: {
        ar: [
          'في شاشة الدخول اختر اسمك، ثم انقر على **نسيت رمز الدخول؟**.',
          'انسخ **رقم الجهاز** بزر النسخ بجانبه، وأرسله إلى الجهة التي اشتريت منها البرنامج.',
          'حين يصلك رمز إعادة التعيين انقر على **لديّ رمز إعادة تعيين**، والصق الرسالة كما وصلتك أو الرمز وحده، ثم انقر على **تحقق من الرمز**.',
          'اكتب **رمز الدخول الجديد** و**أعد كتابة الرمز الجديد**، ثم انقر على **حفظ والدخول**.',
        ],
        en: [
          'On the sign-in screen choose your name, then click **Forgot your PIN?**.',
          'Copy the **Device number** with the copy button next to it, and send it to whoever supplied Dentora.',
          'When the reset code arrives, click **I have a reset code**, paste the whole message or just the code, then click **Check the code**.',
          'Type the **New PIN** and **Repeat the new PIN**, then click **Save and sign in**.',
        ],
      },
      tips: {
        ar: [
          'رمز إعادة التعيين يعمل على هذا الجهاز وحده، يوم إصداره واليوم التالي، ومرة واحدة فقط. وبياناتك تبقى كما هي.',
          'رمز تفعيل الترخيص لا يصلح هنا: يُدخل من [الترخيص](licence) بعد الدخول.',
          'إن أُوقفت كل الحسابات تقول شاشة الدخول «لا يوجد حساب مفعّل»، ويعيد رمز إعادة التعيين نفسه حساب المدير إلى العمل.',
        ],
        en: [
          'The reset code works on this device only, on the day it was issued and the next, and only once. Your data stays as it is.',
          'A licence activation code does not work here: it goes in [Licence](licence) after signing in.',
          'If every account has been deactivated, the sign-in screen says “No active account”, and the same reset code brings the admin account back.',
        ],
      },
      shots: ['staff-forgot', 'staff-reset-code'],
    },
  ],
  shots: [
    {
      id: 'staff-overview',
      device: 'desktop',
      alt: {
        ar: 'صفحة الفريق: بطاقة لكل عضو بدوره وآخر دخول ومفتاح التفعيل، ثم جدول الصلاحيات حسب الدور وسجل الدخول',
        en: 'The Staff page: a card per member with their role, last sign-in and active switch, then the permissions-by-role table and the sign-in log',
      },
      recipe: `${DESK} First fill the sign-in log: ${LOCK} Then ${SIGN_IN('u-rec')} ${LOCK} Then ${SIGN_IN('u-admin')} Route #/staff, filter **All**, in a 1440×1000 window so the sign-in log shows both of today's sign-ins. Capture the whole window. No markers.`,
    },
    {
      id: 'staff-matrix',
      device: 'desktop',
      alt: {
        ar: 'جدول الصلاحيات حسب الدور: تسعة أقسام في الصفوف، والأدوار الأربعة في الأعمدة، وعلامة صح لكل ما يسمح به الدور',
        en: 'The permissions-by-role table: nine areas in the rows, the four roles in the columns, and a tick for everything the role allows',
      },
      recipe: `${DESK} Route #/staff. Scroll the card [data-qa="matrix"] into view. Crop to that card, 12 px margin. No markers.`,
    },
    {
      id: 'staff-add',
      device: 'desktop',
      alt: {
        ar: 'نافذة عضو جديد في الفريق مملوءة لمساعدة: الاسم واللقب، والدور مع وصفه وما يستطيع العمل عليه، والألوان، ورمز الدخول مرتين',
        en: 'The New team member dialog filled in for an assistant: name and title, the role with its description and what it can work on, the colours, and the PIN twice',
      },
      recipe: `${DESK} Route #/staff. Click **Add member** ([data-qa="add-member"]). In the dialog type Full name "رنا سليمان" (EN: "Rana Suleiman"), choose Role **Assistant** (مساعد) in select[name=role] (the Title switches to No title by itself), type 2468 in #staff-pin and in #staff-pin2. Make the window tall enough for the whole dialog to show. Crop to the dialog (.modal). Markers: 2 on the Full name field, 3 on the Specialty field, 4 on the Role select, 5 on the colour swatches, 6 on **Add member** ([data-qa="save-member"]) in the footer. Close with **Cancel** (do not save).`,
    },
    {
      id: 'staff-menu',
      device: 'desktop',
      alt: {
        ar: 'قائمة خيارات عضو مفتوحة على بطاقته: تعديل، تعيين رمز دخول جديد، إيقاف الحساب، حذف العضو',
        en: 'A member’s options menu open on their card: Edit, Set a new PIN, Deactivate account, Delete member',
      },
      recipe: `${DESK} Route #/staff. On the card [data-user="u-doc2"] (Dr. Laila Haddad; on Sara Youssef's card, in the last row, the menu hangs over the panels below) click the ⋮ button ([data-qa="member-menu"]). Wait 400 ms. Crop to the staff grid ([data-qa="staff-grid"]) plus the open menu, 12 px margin. No markers. Close with Escape.`,
    },
    {
      id: 'staff-delete',
      device: 'desktop',
      alt: {
        ar: 'نافذة تأكيد حذف عضو تخبر بعدد السجلات المرتبطة به وتنصح بإيقاف الحساب بدلاً من حذفه',
        en: 'The delete confirmation for a member, giving the number of linked records and recommending deactivation instead',
      },
      recipe: `${DESK} Route #/staff. On the card [data-user="u-doc2"] (Dr. Laila Haddad) click ⋮ ([data-qa="member-menu"]) and choose **Delete member** (حذف العضو). Wait 800 ms for the dialog. Crop to the dialog (.modal). No markers. Close with **Cancel** (do not delete).`,
    },
    {
      id: 'staff-locked',
      device: 'desktop',
      alt: {
        ar: 'شاشة الدخول بعد خمس محاولات خاطئة: لوحة الأرقام متوقفة ورسالة محاولات خاطئة كثيرة مع العدّ التنازلي',
        en: 'The sign-in screen after five wrong PINs: the keypad paused with a “Too many wrong attempts” message and a countdown',
      },
      recipe: `${DESK} ${LOCK} Click **Switch user** ([data-qa="change-user"]) if it is shown, then the tile [data-user="u-doc2"] (Dr. Laila Haddad). Five times: type 9999, press Enter, wait 2.5 s. The message area (.au-pin-msg) shows the lock with "Try again in 0:2x". Crop at once to the clinic name and the sign-in card (in the whole window the countdown is too small to read). No markers.`,
    },
    {
      id: 'staff-phone-more',
      device: 'phone',
      alt: {
        ar: 'نافذة المزيد على الهاتف: اسم المستخدم ودوره، وبجانبه زرّا قفل الشاشة وتسجيل الخروج، ثم بقية صفحات البرنامج',
        en: 'The More sheet on a phone: the user’s name and role with the Lock screen and Sign out buttons next to it, then the app’s other pages',
      },
      recipe: `${PHONE} Route #/. Tap **More** (المزيد), the last item of the bottom bar (.app-bottomnav .bn-item:last-child). Wait 500 ms. Capture the screen. Markers: 2 on the lock button and 3 on the sign-out button in the user row (.more-user).`,
    },
    {
      id: 'staff-forgot',
      device: 'desktop',
      alt: {
        ar: 'شاشة الدخول وتحت لوحة الأرقام شرح نسيت رمز الدخول: رقم الجهاز مع زر النسخ، وزر لديّ رمز إعادة تعيين',
        en: 'The sign-in screen with the Forgot your PIN? help open under the keypad: the device number with its copy button, and the I have a reset code button',
      },
      recipe: `${DESK} ${LOCK} Click **Switch user** ([data-qa="change-user"]) if it is shown, then the tile [data-user="u-admin"]. Click **Forgot your PIN?** ([data-qa="forgot"]). Wait 500 ms. Crop to the sign-in card (.au-login-card), 16 px margin. Markers: 1 on **Forgot your PIN?**, 2 on the copy button next to the device number ([data-qa="login-device"]), 3 on **I have a reset code** ([data-qa="have-reset-code"]).`,
    },
    {
      id: 'staff-reset-code',
      device: 'desktop',
      alt: {
        ar: 'نافذة رمز دخول جديد للمدير: رقم الجهاز، وخانة لصق رمز إعادة التعيين، وزر تحقق من الرمز',
        en: 'The New admin PIN dialog: the device number, a box to paste the reset code, and the Check the code button',
      },
      recipe: `${DESK} As for staff-forgot, then click **I have a reset code** ([data-qa="have-reset-code"]). Wait 700 ms. Crop to the dialog (.modal). Marker: 3 on the reset code box and on **Check the code** (تحقق من الرمز) (two markers, both 3). Close with **Cancel**.`,
    },
  ],
}
export default topic

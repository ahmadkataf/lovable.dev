import type { GuideTopic } from '../types'

// How the pictures are made (store/scripts/guide-shots.mjs). Every recipe starts from this state; the fixed clock puts
// "now" in the middle of a working day, so today's schedule has finished, running and upcoming visits:
const DEMO = "Demo clinic as store/scripts/shoot.mjs makes it (seedAndLogin + Settings → Backup → Load demo data; English shots use its englishClinic() names), signed in as the admin (Dr. Ahmad Al-Khatib), clock fixed at Sunday 11 October 2026 11:40 Asia/Damascus, trial bar hidden ([data-qa=\"trial-bar\"]{display:none}). Open #/ and wait 1.6 s for every card to load; page scrolled to the top unless said otherwise."

const topic: GuideTopic = {
  slug: 'dashboard',
  order: 3,
  icon: 'layoutDashboard',
  title: { ar: 'الشاشة الرئيسية', en: 'The dashboard' },
  summary: {
    ar: 'يومك كله في شاشة واحدة: مواعيد اليوم وحالاتها، وأرقام الشهر، وما يحتاج إلى انتباهك، والإيرادات، وآخر ما جرى في العيادة.',
    en: 'Your whole day on one screen: today’s appointments and their status, this month’s figures, what needs your attention, revenue and the latest activity in the clinic.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'نظرة عامة', en: 'At a glance' },
      text: {
        ar: [
          "**الرئيسية** أول ما تراه حين تفتح البرنامج، وتعود إليها في أي وقت من أعلى القائمة الجانبية. في أعلاها تحية باسمك وتاريخ اليوم، ثم بطاقات الأرقام، ثم **جدول اليوم** والتنبيهات والرسوم البيانية و**آخر النشاطات**.",
          "تتحدث الشاشة وحدها مع كل تغيير يجري في العيادة، فلا حاجة إلى إعادة تحميلها. وفي أعلاها ثلاثة أزرار للإضافة السريعة.",
        ],
        en: [
          "The **Dashboard** is the first screen you see when you open Dentora, and you can get back to it any time from the top of the sidebar. At the top you find a greeting with your name and today’s date, then the figure cards, then **Today's schedule**, the alerts, the charts and **Recent activity**.",
          "The screen updates by itself whenever something changes in the clinic, so there is no need to reload it. Three quick-add buttons sit at the top.",
        ],
      },
      steps: {
        ar: [
          "انقر على **موعد جديد** لحجز موعد، وتاريخه اليوم ما لم تغيّره.",
          "انقر على **مريض جديد** لفتح ملف جديد، فيُفتح الملف بعد الحفظ.",
          "انقر على **دفعة جديدة** لتسجيل مبلغ استلمته من مريض.",
        ],
        en: [
          "Click **New appointment** to book an appointment, dated today unless you change it.",
          "Click **New patient** to open a new file; the file opens once you save it.",
          "Click **New payment** to record money received from a patient.",
        ],
      },
      tips: {
        ar: [
          "ما تراه يتبع دورك: من لا يسمح له دوره بالفواتير لا يرى بطاقات المال ولا رسم الإيرادات ولا زر **دفعة جديدة** ولا تنبيه **فواتير متأخرة السداد**، وموظف الاستقبال لا يرى تنبيه **أعمال مخبر مستحقة**. انظر [الأدوار والصلاحيات](staff#roles).",
          "حين يكون البرنامج للقراءة فقط تبقى الأرقام ظاهرة، وتتعطل أزرار الإضافة وأزرار الحالة. انظر [الترخيص](licence).",
          "إن تركت الشاشة مفتوحة طوال اليوم يبقى كل شيء صحيحاً: يتحرك خط **الآن** وتتحدث التحية والتاريخ كل دقيقة.",
        ],
        en: [
          "What you see follows your role: roles that may not handle invoices see no money cards, no revenue chart, no **New payment** button and no **Overdue invoices** alert, and receptionists do not get the **Lab work due** alert. See [Roles and permissions](staff#roles).",
          "While Dentora is read-only the figures stay visible, but the add buttons and the status buttons are disabled. See [Licence](licence).",
          "Left open all day, the screen stays right: the **Now** line moves and the greeting and date update every minute.",
        ],
      },
      shots: ['dashboard-overview'],
    },
    {
      id: 'stat-cards',
      title: { ar: 'بطاقات الأرقام', en: 'The figure cards' },
      text: {
        ar: [
          "**مواعيد اليوم**: عدد مواعيد اليوم دون الملغاة، وكم اكتمل منها.",
          "**مرضى راجعوا هذا الشهر**: عدد المرضى الذين حضروا هذا الشهر حتى اليوم، أي سُجّل وصولهم أو بدأت جلستهم أو اكتملت.",
          "**مرضى جدد هذا الشهر**: الملفات التي فُتحت منذ أول الشهر.",
          "**إيرادات اليوم**: مجموع الدفعات المسجلة اليوم، وعددها.",
          "**إيرادات الشهر**: مجموع دفعات الشهر الحالي، مع خط صغير يرسم إيرادات آخر 30 يوماً.",
          "**الرصيد المستحق**: ما بقي على المرضى في الفواتير غير المدفوعة والمدفوعة جزئياً، وعدد هؤلاء المرضى.",
        ],
        en: [
          "**Today's appointments**: today’s appointments, not counting cancelled ones, and how many are completed.",
          "**Patients seen this month**: how many patients came in this month so far, meaning they were checked in, started or completed.",
          "**New patients this month**: files opened since the first of the month.",
          "**Today's revenue**: the total of payments recorded today, and how many there were.",
          "**Revenue this month**: the total of this month’s payments, with a small line of the last 30 days.",
          "**Outstanding balance**: what patients still owe on unpaid and partially paid invoices, and how many patients that is.",
        ],
      },
      tips: {
        ar: [
          "النسبة الخضراء أو الحمراء تحت الرقم تقارن الشهر حتى اليوم بالأيام نفسها من الشهر الماضي، وبجانبها **عن الشهر الماضي**.",
          "كل بطاقة رابط: **مواعيد اليوم** تفتح تقويم اليوم، و**مرضى راجعوا هذا الشهر** و**مرضى جدد هذا الشهر** تفتحان قائمة المرضى، و**إيرادات اليوم** تفتح المدفوعات، و**إيرادات الشهر** و**الرصيد المستحق** تفتحان [التقارير](reports)، أو المدفوعات والفواتير لمن لا يرى التقارير.",
          "بطاقات المال الثلاث تظهر لمن يسمح له دوره بالفواتير فقط.",
        ],
        en: [
          "The green or red percentage under a figure compares this month so far with the same days of last month, next to **vs last month**.",
          "Every card is a link: **Today's appointments** opens today’s calendar, **Patients seen this month** and **New patients this month** open the patient list, **Today's revenue** opens Payments, and **Revenue this month** and **Outstanding balance** open [Reports](reports), or Payments and Invoices for those who cannot see reports.",
          "The three money cards show only for roles allowed to handle invoices.",
        ],
      },
      shots: ['dashboard-stats'],
    },
    {
      id: 'todays-schedule',
      title: { ar: 'جدول اليوم', en: "Today’s schedule" },
      text: {
        ar: [
          "يعرض **جدول اليوم** مواعيد اليوم بالترتيب: الوقت، والمريض، ونوع الزيارة، والطبيب بلونه، والحالة. يفصل خط أحمر عنوانه **الآن** ما مضى عمّا هو قادم.",
          "تظهر الزيارات المنتهية باهتة، والجلسة الجارية مظللة، وفي عنوان البطاقة عدد مواعيد اليوم وكم بقي منها.",
        ],
        en: [
          "**Today's schedule** lists today’s appointments in order: time, patient, type of visit, the doctor with their colour, and the status. A red line labelled **Now** separates what is past from what is coming.",
          "Finished visits are dimmed, the visit in progress is highlighted, and the card’s heading shows how many appointments there are today and how many are still to come.",
        ],
      },
      steps: {
        ar: [
          "حين يصل المريض انقر على **تسجيل الوصول** في سطره.",
          "حين يدخل إلى غرفة العلاج انقر على **بدء الجلسة**، وفي نهايتها **إنهاء الموعد**.",
          "لتأكيد موعد لم يُؤكَّد بعد انقر على **تأكيد**.",
          "انقر على اسم المريض لفتح ملفه، أو **فتح التقويم** لترى اليوم في صفحة المواعيد.",
        ],
        en: [
          "When the patient arrives, click **Check in** on their row.",
          "When they go into the treatment room click **Start**, and at the end **Complete**.",
          "To confirm an appointment that is not confirmed yet, click **Confirm**.",
          "Click the patient’s name to open their file, or **Open calendar** to see the day on the Appointments page.",
        ],
      },
      tips: {
        ar: [
          "يعرض كل سطر الزر المناسب لحالته فقط: **مجدول** ← **تأكيد** أو **تسجيل الوصول**، و**مؤكد** ← **تسجيل الوصول**، و**وصل** ← **بدء الجلسة**، و**قيد المعالجة** ← **إنهاء الموعد**. على الهاتف، وعلى الشاشات أو النوافذ التي لا يزيد عرضها على نحو 1280 بكسل، يظهر للموعد **المجدول** زر **تأكيد** وحده، ثم يظهر **تسجيل الوصول** بعد التأكيد.",
          "لإلغاء موعد أو تسجيل عدم حضور المريض افتحه من [المواعيد](appointments#visit-day).",
          "يظهر كل تغيير في الحالة فوراً، ويُسجَّل في **آخر النشاطات**.",
          "على الهاتف تنزل أزرار الحالة تحت كل سطر لتسهل لمسها.",
        ],
        en: [
          "Each row only shows the buttons that fit its status: **Scheduled** → **Confirm** or **Check in**, **Confirmed** → **Check in**, **Arrived** → **Start**, **In progress** → **Complete**. On a phone, and on screens or windows up to about 1280 pixels wide, a **Scheduled** row shows only **Confirm**; **Check in** appears once it is confirmed.",
          "To cancel an appointment or mark a no-show, open it from [Appointments](appointments#visit-day).",
          "Each status change shows at once and is logged in **Recent activity**.",
          "On a phone the status buttons sit under each row, easy to tap.",
        ],
      },
      shots: ['dashboard-schedule'],
    },
    {
      id: 'alerts',
      title: { ar: 'تنبيهات تحتاج انتباهك', en: 'Needs your attention' },
      text: {
        ar: [
          "تجمع بطاقة **تنبيهات تحتاج انتباهك** ما ينبغي أن تتابعه اليوم، مع عدد كل نوع. انقر على أي سطر لتنتقل إلى صفحته:",
          "**فواتير متأخرة السداد** مع مجموع المبالغ المستحقة، و**مواد قاربت على النفاد** (ما بلغ حد التنبيه أو نفد)، و**أعمال مخبر مستحقة** (المتأخرة والمستحقة اليوم)، و**مواعيد الغد غير المؤكدة** لتتصل بالمرضى.",
          "وما إن يُسجَّل أول مريض حتى يظهر في أعلاها تذكير بالنسخ الاحتياطي إن لم تُحفظ نسخة قط، أو مضى على آخر نسخة 7 أيام أو أكثر.",
        ],
        en: [
          "The **Needs your attention** card gathers what you should follow up today, with a count for each kind. Click any row to go to its page:",
          "**Overdue invoices** with the total due, **Low-stock items** (at or below their alert threshold, or out of stock), **Lab work due** (late or due today), and **Tomorrow's unconfirmed visits** so you can call the patients.",
          "Once the clinic has its first patient, a backup reminder shows at the top when no backup was ever saved or the last one is 7 or more days old.",
        ],
      },
      tips: {
        ar: [
          "إن لم يكن هناك ما يستدعي الانتباه تظهر رسالة **كل شيء على ما يرام**.",
          "تُعدّ الفاتورة متأخرة إذا فات تاريخ استحقاقها، أو مضى على إصدارها أكثر من 30 يوماً إن لم يكن لها تاريخ استحقاق.",
          "يأخذك تذكير النسخ الاحتياطي إلى صفحة النسخ إن كنت المدير. أما غير المدير فيطلب منه التذكير أن يخبر مدير العيادة. انظر [حفظ نسخة احتياطية](backup#export).",
          "تفاصيل كل تنبيه، وأزرار التذكير عبر واتساب، في لوحة [التنبيهات](interface#notifications).",
        ],
        en: [
          "When nothing needs attention, the card says **All clear**.",
          "An invoice counts as overdue once its due date has passed or, without a due date, 30 days after it was issued.",
          "The backup reminder takes the admin to the backup page. Everyone else is asked to tell the clinic admin. See [Saving a backup](backup#export).",
          "The details of each alert, and the WhatsApp reminder buttons, are in the [Notifications](interface#notifications) panel.",
        ],
      },
      shots: ['dashboard-alerts'],
    },
    {
      id: 'charts',
      title: { ar: 'الرسوم البيانية', en: 'The charts' },
      text: {
        ar: [
          "**الإيرادات — آخر 30 يوماً**: الدفعات يوماً بيوم، ومجموعها تحت العنوان. مرّر المؤشر على الرسم، أو المسه على الهاتف، لترى مبلغ أي يوم.",
          "**المواعيد حسب الحالة**: مواعيد الشهر الحالي موزعة على حالاتها، مع عدد كل حالة ونسبتها، ومجموعها في الوسط.",
          "**الإجراءات الأكثر تنفيذاً**: أكثر الإجراءات المنجزة هذا الشهر، مع عدد مرات تنفيذ كل منها.",
        ],
        en: [
          "**Revenue — last 30 days**: payments day by day, with the total under the title. Hover over the chart, or touch it on a phone, to see any day’s amount.",
          "**Appointments by status**: this month’s appointments split by status, with each status’s count and share, and the total in the middle.",
          "**Top procedures**: the procedures completed most often this month, with how many times each was done.",
        ],
      },
      steps: {
        ar: [
          "لترى الإيرادات أرقاماً انقر على زر **عرض كجدول** في زاوية بطاقة الإيرادات، وانقر عليه ثانية للعودة إلى الرسم.",
          "انقر على **التقارير** في البطاقة نفسها لتحليل أعمق.",
        ],
        en: [
          "To see revenue as figures, click the **Show as table** button in the corner of the revenue card; click it again to go back to the chart.",
          "Click **Reports** on the same card for a deeper look.",
        ],
      },
      tips: {
        ar: [
          "رسم الإيرادات لمن يسمح له دوره بالفواتير، وزر **التقارير** لمن يرى التقارير، ولا يظهر هذا الزر على الهاتف.",
          "مرّر المؤشر على أي إجراء، أو المسه على الهاتف، لترى نسبته من المجموع، ومعها قيمته المالية لمن يسمح له دوره بالفواتير.",
          "للأرقام المفصّلة على أي فترة انظر [التقارير](reports).",
        ],
        en: [
          "The revenue chart shows for roles allowed to handle invoices, and the **Reports** button for roles that can see reports; the button is hidden on phones.",
          "Hover over a procedure, or touch it on a phone, to see its share of the total and, for roles allowed to handle invoices, its value.",
          "For detailed figures over any period, see [Reports](reports).",
        ],
      },
      shots: ['dashboard-revenue', 'dashboard-status'],
    },
    {
      id: 'activity',
      title: { ar: 'آخر النشاطات', en: 'Recent activity' },
      text: {
        ar: ["تعرض **آخر النشاطات** آخر 12 عملية في العيادة: موعد حُجز، أو حالة تغيّرت، أو علاج أُنجز، أو دفعة استُلمت، أو فاتورة صدرت، أو دخول إلى البرنامج. ومع كل منها اسم من قام بها ومتى."],
        en: ["**Recent activity** shows the last 12 actions in the clinic: an appointment booked, a status changed, a treatment done, a payment received, an invoice issued, a sign-in. Each one shows who did it and when."],
      },
      steps: {
        ar: ["انقر على سطر يخص مريضاً لفتح ملفه."],
        en: ["Click a row about a patient to open their file."],
      },
      tips: {
        ar: ["طريقة سريعة لتعرف ما أنجزه الفريق اليوم دون أن تسأل."],
        en: ["A quick way to see what the team did today without asking."],
      },
      shots: ['dashboard-activity'],
    },
    {
      id: 'phone',
      title: { ar: 'الرئيسية على الهاتف', en: 'The dashboard on a phone' },
      text: {
        ar: ["على الهاتف تظهر بطاقات الأرقام في عمودين، ثم تتوالى البطاقات تحتها: **جدول اليوم** أولاً، ثم التنبيهات، ثم الإيرادات، ثم المواعيد حسب الحالة، ثم الإجراءات الأكثر تنفيذاً، وأخيراً آخر النشاطات. اسحب الشاشة إلى الأعلى لتراها كلها."],
        en: ["On a phone the figure cards sit in two columns, followed by the other cards: **Today's schedule** first, then the alerts, revenue, appointments by status, top procedures and finally recent activity. Scroll down to see them all."],
      },
      tips: {
        ar: ["أزرار الإضافة الثلاثة تبقى في أعلى الصفحة، وتمتد على عرض الشاشة. انظر أيضاً [على الهاتف والجهاز اللوحي](interface#phone-layout)."],
        en: ["The three add buttons stay at the top of the page, across the width of the screen. See also [On a phone or tablet](interface#phone-layout)."],
      },
      shots: ['dashboard-phone'],
    },
  ],
  shots: [
    {
      id: 'dashboard-overview',
      device: 'desktop',
      alt: { ar: 'الشاشة الرئيسية لعيادة تعمل: بطاقات الأرقام وجدول اليوم والتنبيهات', en: 'The dashboard of a working clinic: figure cards, today’s schedule and alerts' },
      caption: { ar: 'الرئيسية في منتصف يوم عمل.', en: 'The dashboard in the middle of a working day.' },
      recipe: `${DEMO} Desktop window (1440×900). Crop: the whole window. Markers: 1 on New appointment ([data-testid="dash-new-apt"]), 2 on New patient ([data-testid="dash-new-patient"]), 3 on New payment ([data-testid="dash-new-payment"]).`,
    },
    {
      id: 'dashboard-stats',
      device: 'desktop',
      alt: { ar: 'بطاقات الأرقام الست: مواعيد اليوم والمرضى والإيرادات والرصيد المستحق', en: 'The six figure cards: today’s appointments, patients, revenue and outstanding balance' },
      recipe: `${DEMO} Desktop window (1440×900). Crop: the grid of the six figure cards (.rp-dash-kpis) with 16 px of margin. No markers.`,
    },
    {
      id: 'dashboard-schedule',
      device: 'desktop',
      alt: { ar: 'جدول اليوم مع خط الآن وأزرار تسجيل الوصول وبدء الجلسة وإنهاء الموعد', en: 'Today’s schedule with the Now line and the Check in, Start and Complete buttons' },
      recipe: `${DEMO} Desktop window (1440×900). Scroll so the whole Today's schedule card ([data-testid="dash-schedule"]) is in view (or take an element screenshot of it). Crop: that card. With the fixed clock it shows 4 completed visits, 2 in progress, the Now line at 11:40, then upcoming confirmed and scheduled ones. Markers: 1 on Check in ([data-testid="apt-do-arrived"]) of the first row after the Now line, 2 on Complete ([data-testid="apt-do-completed"]) of the first in-progress row, 3 on Confirm ([data-testid="apt-do-confirmed"]) of the scheduled row, 4 on Open calendar in the card header.`,
    },
    {
      id: 'dashboard-alerts',
      device: 'desktop',
      alt: { ar: 'بطاقة تنبيهات تحتاج انتباهك: النسخ الاحتياطي والفواتير المتأخرة والمخزون والمخبر ومواعيد الغد', en: 'The Needs your attention card: backup, overdue invoices, stock, lab and tomorrow’s visits' },
      recipe: `${DEMO} Desktop window (1440×900). Crop: the Needs your attention card ([data-testid="dash-alerts"]) as an element screenshot. No markers.`,
    },
    {
      id: 'dashboard-revenue',
      device: 'desktop',
      alt: { ar: 'رسم الإيرادات لآخر 30 يوماً مع زرّي التقارير والعرض كجدول', en: 'The revenue chart for the last 30 days with the Reports and table buttons' },
      recipe: `${DEMO} Desktop window (1440×900). Move the mouse over the plot (the svg inside the card body) at about 85% of its width, on the tallest peak: the chart reads left to right in both languages, and a tooltip with that day's date and amount appears (.rp-tip). Crop: the revenue card ([data-testid="dash-revenue"]) as an element screenshot. Markers: 1 on the table/chart toggle (the icon button at the end of the card header), 2 on Reports.`,
    },
    {
      id: 'dashboard-status',
      device: 'desktop',
      alt: { ar: 'مواعيد الشهر حسب الحالة في رسم دائري', en: 'This month’s appointments by status in a donut chart' },
      recipe: `${DEMO} Desktop window (1440×900). Crop: the Appointments by status card ([data-testid="dash-status"]) as an element screenshot. No markers.`,
    },
    {
      id: 'dashboard-activity',
      device: 'desktop',
      alt: { ar: 'آخر النشاطات في العيادة مع من قام بها ومتى', en: 'Recent activity in the clinic, with who did what and when' },
      recipe: `${DEMO} Desktop window (1440×900). Crop: the Recent activity card ([data-testid="dash-activity"]) as an element screenshot. Markers: 1 on a row that names a patient (for example an Appointment booked row).`,
    },
    {
      id: 'dashboard-phone',
      device: 'phone',
      alt: { ar: 'الشاشة الرئيسية على الهاتف: أزرار الإضافة وبطاقات الأرقام في عمودين', en: 'The dashboard on a phone: add buttons and figure cards in two columns' },
      recipe: `${DEMO} Phone viewport (about 400×860, touch). Crop: the whole screen. No markers.`,
    },
  ],
}

export default topic

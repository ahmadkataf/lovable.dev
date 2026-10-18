import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in store/scripts/shoot.mjs.
// Like shoot.mjs, every shot opens the reports on LAST MONTH (September 2026, a whole month of data): before the first
// load set localStorage 'dentora.reports.preset' = 'lastMonth' (an init script), or click **Last month** once.
const DESK = 'Desktop 1440×900, demo clinic as store/scripts/shoot.mjs makes it (seedAndLogin + Settings → Backup → Load demo data; English shots use its englishClinic() names), signed in as the admin (Dr. Ahmad Al-Khatib), clock fixed at Sunday 11 Oct 2026 11:40 Asia/Damascus, trial bar hidden ([data-qa="trial-bar"]{display:none}), reports period Last month (localStorage dentora.reports.preset = lastMonth, as shoot.mjs), page scrolled to the top and held there (page.goto() reads as Back to the app, which restores an old scroll position). Wait 1.6 s after opening a tab: the charts draw after the data.'
const PHONE = 'Phone 390×844 (isMobile, hasTouch, deviceScaleFactor 8/3 as shoot.mjs), same demo clinic, clock, hidden trial bar and Last month period.'

const topic: GuideTopic = {
  slug: 'reports',
  order: 13,
  icon: 'barChart3',
  title: { ar: 'التقارير', en: 'Reports' },
  summary: {
    ar: 'أرقام عيادتك في مكان واحد: الإيرادات والمصروفات وصافي الربح، والمرضى والمواعيد والعلاجات، والذمم المستحقة، لأي فترة ولكل طبيب، مع الطباعة والتصدير إلى Excel.',
    en: 'Your clinic in figures: revenue, expenses and net profit, patients, appointments, treatments and outstanding balances, for any period and any doctor, ready to print or export to Excel.',
  },
  metaDescription: {
    ar: 'أرقام عيادتك في مكان واحد: الإيرادات والمصروفات وصافي الربح، والمرضى والمواعيد والعلاجات، والذمم المستحقة، لأي فترة، مع الطباعة والتصدير إلى Excel.',
    en: 'Your clinic in figures: revenue, expenses and net profit, patients, appointments, treatments and balances due for any period, ready to print or export.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'صفحة التقارير', en: 'The Reports page' },
      text: {
        ar: [
          'افتح **التقارير** من القائمة الجانبية، في قسم **المالية**. في الصفحة خمسة تبويبات: **المالية** و**المرضى** و**المواعيد** و**العلاجات** و**الذمم المستحقة**.',
          'فوق التبويبات شريط الفترة وقائمة **جميع الأطباء** (ويختفيان في **الذمم المستحقة**)، وفي أعلى الصفحة زرّا **طباعة** و**تصدير CSV**. وتحت العنوان تظهر الفترة المختارة دائماً، واسم الطبيب إن اخترت طبيباً؛ وفي **الذمم المستحقة** يظهر اليوم الذي تُحسب حتى نهايته الأرصدة.',
          'تحت معظم الأرقام في البطاقات نسبة تغيّرها **عن الفترة السابقة**. وإن كانت الفترة ما زالت جارية، مثل **هذا الشهر**، يقارن البرنامج الأيام التي مضت منها بالأيام نفسها من الفترة السابقة، ويكتب **عن المدة نفسها سابقاً**، فلا يبدو الشهر الجاري أضعف مما هو عليه.',
        ],
        en: [
          'Open **Reports** from the sidebar, in the **Finance** section. The page has five tabs: **Financial**, **Patients**, **Appointments**, **Treatments** and **Outstanding**.',
          'Above the tabs are the period bar and the **All doctors** list (hidden on **Outstanding**), and at the top of the page the **Print** and **Export CSV** buttons. The chosen period always shows under the title, with the doctor’s name when you pick one; on **Outstanding** it says which day the balances are for.',
          'Under most figures on the cards is their change **vs previous period**. While the period is still running, such as **This month**, Dentora compares the days gone so far with the same days of the period before and says **vs same days last period**, so the current month never looks weaker than it is.',
        ],
      },
      tips: {
        ar: [
          'التقارير للمدير والأطباء. لا يراها المساعد ولا موظف الاستقبال. انظر [الأدوار والصلاحيات](staff#roles).',
          'الإيرادات هي المال الذي قبضته العيادة فعلاً (الدفعات)، لا قيمة الفواتير الصادرة.',
          'إن لم يكن في التبويب شيء للفترة المختارة يقترح عليك زر **عرض هذه السنة**.',
        ],
        en: [
          'Reports are for the admin and the doctors. Assistants and receptionists do not see them. See [Roles and permissions](staff#roles).',
          'Revenue is the money the clinic actually collected (payments), not the value of the invoices issued.',
          'If a tab has nothing for the chosen period, a **Show this year** button offers a longer one.',
        ],
      },
      shots: ['reports-overview'],
    },
    {
      id: 'period',
      title: { ar: 'اختيار الفترة والطبيب', en: 'Choosing the period and the doctor' },
      steps: {
        ar: [
          'اختر الفترة: **هذا الشهر** أو **الشهر الماضي** أو **آخر 3 أشهر** أو **هذه السنة**. أو انقر على **فترة مخصصة** واختر تاريخ البداية وتاريخ النهاية.',
          'لترى عمل طبيب واحد اختره من قائمة **جميع الأطباء**.',
          'تنقّل بين التبويبات كما تشاء: تبقى الفترة والطبيب كما اخترتهما.',
        ],
        en: [
          'Choose the period: **This month**, **Last month**, **Last 3 months** or **This year**. Or click **Custom** and choose the start and end dates.',
          'To see one doctor’s work, pick the doctor from the **All doctors** list.',
          'Move between tabs as you like: the period and the doctor stay as you chose them.',
        ],
      },
      tips: {
        ar: [
          'يتذكر البرنامج على هذا الجهاز آخر فترة اخترتها (عدا الفترة المخصصة)، فتُفتح التقارير عليها في المرة القادمة.',
          'إن جعلت تاريخ البداية بعد تاريخ النهاية يعكس البرنامج الفترة ويخبرك بذلك.',
          'مع اختيار طبيب يُخفي تبويب المالية المصروفات وصافي الربح، لأنهما يخصّان العيادة كلها، ويعرض بدلهما **قيمة الفواتير الصادرة** و**عدد الفواتير**.',
          'لا تتأثر **الذمم المستحقة** بالفترة ولا بالطبيب: تعرض ما على المرضى اليوم.',
        ],
        en: [
          'Dentora remembers the last period you chose on this device (except a custom one) and opens the reports on it next time.',
          'If the start date is after the end date, Dentora flips the range and tells you so.',
          'With a doctor picked, the Financial tab hides expenses and net profit, which belong to the whole clinic, and shows **Invoiced** and **Invoices issued** instead.',
          '**Outstanding** ignores the period and the doctor: it shows what patients owe today.',
        ],
      },
      shots: ['reports-period'],
    },
    {
      id: 'financial',
      title: { ar: 'المالية: الإيرادات والمصروفات والربح', en: 'Financial: revenue, expenses and profit' },
      text: {
        ar: [
          'أربع بطاقات: **الإيرادات** و**المصروفات** و**صافي الربح** مع هامش الربح، و**متوسط الفاتورة** مع عدد الفواتير.',
          'ثم الرسوم: **الإيرادات اليومية** (أو **الإيرادات الشهرية** للفترات الأطول من شهرين)، و**طرق الدفع** في دائرة تقسم المحصّل بين النقد والبطاقة والتحويل وغيرها، و**الإيرادات حسب الطبيب** وفيها كل دفعة منسوبة إلى طبيب فاتورتها، و**الإيرادات حسب فئة العلاج** من قيمة الفواتير بعد الخصم.',
          'وفي الأسفل جدول **المصروفات مقابل الإيرادات**: كل فئة من فئات [المصروفات](expenses) بمبلغها وحصتها من المصروفات ومن الإيرادات، ثم **إجمالي المصروفات** و**الإيرادات** و**صافي الربح**.',
        ],
        en: [
          'Four cards: **Revenue**, **Expenses**, **Net profit** with its margin, and **Average invoice** with the number of invoices.',
          'Then the charts: **Daily revenue** (or **Monthly revenue** for periods longer than two months), **Payment methods** as a ring splitting the money collected between cash, card, transfer and the rest, **Revenue by doctor**, which credits each payment to its invoice’s doctor, and **Revenue by treatment category**, from invoice values after discounts.',
          'At the bottom, the **Expenses vs revenue** table lists every [expense](expenses) category with its amount and its share of expenses and of revenue, then **Total expenses**, **Revenue** and **Net profit**.',
        ],
      },
      tips: {
        ar: [
          'مرّر المؤشر فوق نقطة في الرسم، أو المسها على الهاتف، لترى قيمتها وتاريخها.',
          'على الهاتف تصطف البطاقات اثنتين اثنتين والرسوم تحت بعضها، وتنتقل أزرار الفترات إلى سطرين، ويُسحب شريط التبويبات جانبياً لتصل إلى **الذمم المستحقة**.',
        ],
        en: [
          'Hover over a point on a chart, or tap it on a phone, to see its value and date.',
          'On a phone the cards sit two by two and the charts stack one under another, the period buttons wrap onto two lines, and the tab strip slides sideways to reach **Outstanding**.',
        ],
      },
      shots: ['reports-expenses-table', 'reports-phone'],
    },
    {
      id: 'other-tabs',
      title: { ar: 'المرضى والمواعيد والعلاجات', en: 'Patients, appointments and treatments' },
      text: {
        ar: [
          '**المرضى**: **المرضى الجدد** و**مرضى راجعوا العيادة** و**إجمالي الملفات النشطة** و**متوسط العمر**، ثم رسم المرضى الجدد عبر الفترة، و**توزيع الجنس**، و**الفئات العمرية**، و**أبرز مصادر الإحالة** (كيف عرف المرضى الجدد بالعيادة، من حقل الإحالة في ملف المريض)، و**المرضى الأعلى إنفاقاً**.',
          '**المواعيد**: **إجمالي المواعيد** و**المواعيد المكتملة** مع نسبة الإنجاز و**المواعيد الملغاة** و**نسبة عدم الحضور**، ثم رسم المواعيد المحجوزة يوماً بيوم أو أسبوعاً بأسبوع أو شهراً بشهر بحسب طول الفترة، و**المواعيد حسب الحالة**، وجدول **أداء الأطباء**: المحجوزة والمكتملة ومن لم يحضروا والملغاة والساعات المحجوزة و**نسبة الإشغال**.',
          '**العلاجات**: **إجراءات منجزة** و**قيمة العمل المنجز** و**أُضيف إلى الخطط** و**قيمة العمل المعلّق** (المخطط وقيد التنفيذ)، ثم **الإجراءات الأكثر تنفيذاً** و**الإجراءات الأعلى قيمة** و**المخطط مقابل المنجز**.',
        ],
        en: [
          '**Patients**: **New patients**, **Patients seen**, **Active patient files** and **Average age**, then new patients over the period, **Gender**, **Age groups**, **Top referral sources** (how new patients heard of the clinic, from the referral field in their file) and **Highest-spending patients**.',
          '**Appointments**: **Appointments**, **Completed** with the completion rate, **Cancelled** and the **No-show rate**, then booked appointments day by day, week by week or month by month (depending on the length of the period), **Appointments by status** and the **Doctor performance** table: booked, completed, no-shows, cancelled, booked hours and **Utilisation**.',
          '**Treatments**: **Procedures completed**, **Value of completed work**, **Added to plans** and **Pending work value** (planned or in progress), then **Most performed procedures**, **Top procedures by value** and **Planned vs completed**.',
        ],
      },
      tips: {
        ar: [
          'نسبة الإشغال = الدقائق المحجوزة ÷ دقائق الدوام. تُحسب من أيام الدوام وساعاته في [الإعدادات](settings#working-hours)، فاضبطها لتكون النسبة صحيحة.',
          'الإحالة تُكتب في ملف المريض. انظر [إضافة مريض جديد](patients#add-patient).',
        ],
        en: [
          'Utilisation = booked minutes ÷ working minutes, taken from the working days and hours in [Settings](settings#working-hours); set them so the figure is right.',
          'The referral is typed in the patient’s file. See [Adding a new patient](patients#add-patient).',
        ],
      },
      shots: ['reports-appointments'],
    },
    {
      id: 'outstanding',
      title: { ar: 'الذمم المستحقة وتذكير المرضى', en: 'Outstanding balances and reminders' },
      text: {
        ar: [
          'تبويب **الذمم المستحقة** يعرض ما على المرضى اليوم، من كل الفترات: **إجمالي المستحق** و**مرضى عليهم رصيد** و**متوسط الرصيد المستحق** و**أعلى رصيد** مع اسم صاحبه.',
          'وتحتها جدول **الأرصدة المستحقة على المرضى** من الأعلى إلى الأدنى: **قيمة الفواتير المفتوحة** و**المدفوع منها** و**المستحق** و**آخر دفعة**.',
        ],
        en: [
          'The **Outstanding** tab shows what patients owe today, across all periods: **Total outstanding**, **Patients with a balance**, **Average balance** and **Largest balance** with the patient’s name.',
          'Under them the **Patient balances** table runs from the largest down: **Open invoices**, **Paid**, **Due** and **Last payment**.',
        ],
      },
      steps: {
        ar: [
          'افتح تبويب **الذمم المستحقة**.',
          'انقر على اسم مريض لتفتح ملفه، ومن بطاقة رصيده تنتقل إلى حسابه.',
          'انقر على **تذكير** في سطره لترسل له عبر واتساب رسالة جاهزة فيها اسم العيادة والمبلغ المستحق.',
        ],
        en: [
          'Open the **Outstanding** tab.',
          'Click a patient’s name to open their file; its balance card takes you to their account.',
          'Click **Remind** on their row to send them a ready WhatsApp message with the clinic’s name and the amount due.',
        ],
      },
      tips: {
        ar: [
          'الرقم نفسه الذي تراه في الشاشة الرئيسية وفي قائمة الفواتير. انظر [الفواتير والمدفوعات](billing).',
          'على أندرويد يفتح زر **تذكير** محادثة المريض في تطبيق واتساب. وعلى ويندوز يُفتح الرابط في المتصفح لتكمل في واتساب ويب أو تطبيق واتساب على الحاسوب. تراجع الرسالة قبل إرسالها.',
          'إن لم يكن للمريض رقم هاتف تجد مكان الزر «لا يوجد رقم هاتف». وعلى الهاتف يظهر الزر أيقونة واتساب فقط، ولا يظهر شيء في سطر بلا رقم.',
          'الطباعة من هذا التبويب تطبع كل المرضى المدينين في جدول واحد، لا الصفحة الظاهرة على الشاشة فقط.',
        ],
        en: [
          'It is the same figure as on the dashboard and in the invoices list. See [Billing](billing).',
          'On Android **Remind** opens the patient’s chat in WhatsApp. On Windows the link opens in the browser, where you carry on in WhatsApp Web or the WhatsApp desktop app. You see the message before it is sent.',
          'A patient with no phone number shows “No phone number” instead of the button. On a phone the button is a WhatsApp icon only, and a row without a number has none.',
          'Printing from this tab prints every patient who owes money in one table, not only the page on screen.',
        ],
      },
      shots: ['reports-outstanding'],
    },
    {
      id: 'print-export',
      title: { ar: 'الأرقام كجدول، والطباعة والتصدير', en: 'Figures as a table, printing and export' },
      text: {
        ar: ['في زاوية كل رسم زر صغير **عرض كجدول** يعرض الأرقام الدقيقة خلف الرسم. انقر عليه مرة ثانية (**عرض كرسم بياني**) لتعود إلى الرسم.'],
        en: ['Each chart has a small **Show as table** button in its corner that shows the exact figures behind the chart. Click it again (**Show as chart**) to go back to the chart.'],
      },
      steps: {
        ar: [
          'افتح التبويب الذي تريده واختر الفترة والطبيب.',
          'انقر على **طباعة** لتطبع التبويب المفتوح، وفي رأسه اسم العيادة والفترة والطبيب وتاريخ الطباعة.',
          'أو انقر على **تصدير CSV** لتحفظ الجدول الرئيسي للتبويب في ملف يفتحه Excel.',
        ],
        en: [
          'Open the tab you want and choose the period and doctor.',
          'Click **Print** to print the open tab, headed with the clinic’s name, the period, the doctor and the print date.',
          'Or click **Export CSV** to save the tab’s main table as a file Excel opens.',
        ],
      },
      tips: {
        ar: [
          'ما يحفظه **تصدير CSV** في كل تبويب: المالية جدول المصروفات مقابل الإيرادات (أو الإيرادات حسب الطبيب إن اخترت طبيباً)، والمرضى قائمة المرضى الأعلى إنفاقاً، والمواعيد أداء الأطباء، والعلاجات الإجراءات بعدد مرات تنفيذها وقيمتها، والذمم المستحقة كل الأرصدة مع الإجمالي.',
          'على ويندوز تُفتح نافذة الطباعة في النظام: اختر طابعتك، أو «Microsoft Print to PDF» لتحفظ التقرير ملف PDF. وعلى أندرويد تُفتح شاشة الطباعة في النظام، وفيها خيار الحفظ بصيغة PDF.',
          'يُعطَّل **تصدير CSV** حين لا يكون في التبويب جدول للفترة المختارة.',
        ],
        en: [
          'What **Export CSV** saves on each tab: Financial, the expenses vs revenue table (or revenue by doctor when a doctor is picked); Patients, the highest-spending patients; Appointments, doctor performance; Treatments, the procedures with how often they were done and their value; Outstanding, every balance with the total.',
          'On Windows the Windows print dialog opens: choose your printer, or “Microsoft Print to PDF” to keep the report as a PDF file. On Android the system print screen opens, with a save-as-PDF option.',
          '**Export CSV** is disabled when the tab has no table for the chosen period.',
        ],
      },
      shots: ['reports-table-toggle'],
    },
  ],
  shots: [
    {
      id: 'reports-overview',
      device: 'desktop',
      alt: {
        ar: 'تبويب المالية لشهر أيلول: شريط الفترات وقائمة الأطباء، وبطاقات الإيرادات والمصروفات وصافي الربح ومتوسط الفاتورة، ورسم الإيرادات اليومية ودائرة طرق الدفع',
        en: 'The Financial tab for September: the period bar and doctor list, the revenue, expenses, net profit and average invoice cards, the daily revenue chart and the payment methods ring',
      },
      recipe: `${DESK} Route #/reports (Financial tab, Last month = September 2026, All doctors). Capture the whole window. No markers.`,
    },
    {
      id: 'reports-period',
      device: 'desktop',
      alt: {
        ar: 'شريط الفترة على فترة مخصصة بتاريخين، وطبيب مختار من قائمة الأطباء، والفترة واسم الطبيب تحت عنوان الصفحة',
        en: 'The period bar on a custom range with two dates, a doctor picked from the doctor list, and the period and doctor’s name under the page title',
      },
      recipe: `${DESK} Route #/reports. In the period bar ([data-testid="rp-periodbar"]) click **Custom** (فترة مخصصة); it shows 1 Oct 2026 – 11 Oct 2026. In the doctor list ([data-testid="rp-doctor"] select) choose "د. ليلى حداد" (EN: "Dr. Laila Haddad"). Wait 1.6 s. Crop from the top of the page title to the bottom of the tab strip (.rp-tabs), full content width, 12 px margin. Markers: 1 on the period buttons, 2 on the doctor list, 3 on the tab strip.`,
    },
    {
      id: 'reports-expenses-table',
      device: 'desktop',
      alt: {
        ar: 'جدول المصروفات مقابل الإيرادات: كل فئة بمبلغها وحصتها من المصروفات ومن الإيرادات، ثم الإجماليات وصافي الربح',
        en: 'The Expenses vs revenue table: each category with its amount and share of expenses and of revenue, then the totals and net profit',
      },
      recipe: `${DESK} Route #/reports (Financial, Last month, All doctors). Scroll the card [data-testid="table-expenses"] into view. Crop to that card, 12 px margin. No markers.`,
    },
    {
      id: 'reports-phone',
      device: 'phone',
      alt: {
        ar: 'التقارير على الهاتف: أزرار الفترات في سطرين، وشريط التبويبات يُسحب جانبياً، والبطاقات اثنتين اثنتين',
        en: 'Reports on a phone: the period buttons on two lines, the tab strip sliding sideways, and the cards two by two',
      },
      recipe: `${PHONE} Route #/reports (Financial, Last month). Page at its top. Capture the screen. No markers.`,
    },
    {
      id: 'reports-appointments',
      device: 'desktop',
      alt: {
        ar: 'تبويب المواعيد: بطاقات إجمالي المواعيد والمكتملة والملغاة ونسبة عدم الحضور، ورسم المواعيد اليومية، ودائرة المواعيد حسب الحالة، وجدول أداء الأطباء',
        en: 'The Appointments tab: total, completed and cancelled appointments and the no-show rate, the daily chart, the status ring and the doctor performance table',
      },
      recipe: `${DESK} Route #/reports?tab=appointments (Last month, All doctors). Wait 1.6 s. Scroll so the tab strip (.rp-tabs) sits just under the top bar. Capture the whole window. No markers.`,
    },
    {
      id: 'reports-outstanding',
      device: 'desktop',
      alt: {
        ar: 'تبويب الذمم المستحقة: أربع بطاقات، وجدول الأرصدة المستحقة على المرضى مع زر تذكير عبر واتساب في كل سطر',
        en: 'The Outstanding tab: four cards and the patient balances table with a WhatsApp Remind button on every row',
      },
      recipe: `${DESK} Route #/reports?tab=outstanding. Wait 1.6 s. Capture the whole window. Markers: 1 on the **Outstanding** tab, 2 on the first patient's name in the table, 3 on that row's **Remind** button (تذكير).`,
    },
    {
      id: 'reports-table-toggle',
      device: 'desktop',
      alt: {
        ar: 'بطاقة الإيرادات اليومية معروضة كجدول بالتاريخ والمبلغ بدل الرسم',
        en: 'The daily revenue card shown as a table of dates and amounts instead of the chart',
      },
      recipe: `${DESK} Route #/reports (Financial, Last month). In the card [data-testid="chart-revenue"] click the table button in its header (the only button in .card-header, aria-label "Show as table" / "عرض كجدول"). Wait 600 ms. Crop to that card, 12 px margin. No markers.`,
    },
  ],
}
export default topic

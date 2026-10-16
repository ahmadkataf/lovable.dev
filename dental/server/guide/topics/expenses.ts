import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in store/scripts/shoot.mjs.
// With the clock on 11 Oct 2026 the page opens on October 2026: 10 expenses (5 of them from lab orders), September
// for comparison. Never save anything in a shot: close dialogs with Cancel / Escape.
const DESK = 'Desktop 1440×900, demo clinic as store/scripts/shoot.mjs makes it (seedAndLogin + Settings → Backup → Load demo data; English shots use its englishClinic() names), signed in as the admin (Dr. Ahmad Al-Khatib), clock fixed at Sunday 11 Oct 2026 11:40 Asia/Damascus, trial bar hidden ([data-qa="trial-bar"]{display:none}), page scrolled to the top and held there (page.goto() reads as Back to the app, which restores an old scroll position).'
const PHONE = 'Phone 390×844 (isMobile, hasTouch, deviceScaleFactor 8/3 as shoot.mjs), same demo clinic, clock and hidden trial bar.'

const topic: GuideTopic = {
  slug: 'expenses',
  order: 12,
  icon: 'wallet',
  title: { ar: 'المصروفات', en: 'Expenses' },
  summary: {
    ar: 'سجّل ما تصرفه العيادة من إيجار ورواتب ومواد وفواتير، واعرف أين يذهب المال شهراً بشهر، مقارنةً بالشهر السابق.',
    en: 'Record what the clinic spends, from rent and salaries to materials and bills, and see where the money goes month by month, compared with the month before.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'صفحة المصروفات', en: 'The Expenses page' },
      text: {
        ar: [
          'افتح **المصروفات** من القائمة الجانبية، في قسم **المالية**. تُفتح الصفحة على الشهر الحالي.',
          'في الأعلى شريط الفترة، ثم أربع بطاقات: **إجمالي الفترة** ومعه نسبة التغيّر **عن الفترة السابقة**، و**أعلى فئة** مع مبلغها وحصتها من الإجمالي، و**عدد المصروفات** مع **متوسط المصروف**، و**الفترة السابقة** بمبلغها.',
          'تحتها بطاقة **التوزيع حسب الفئة**، ثم **سجل المصروفات**: لكل مصروف تاريخه وفئته ووصفه والجهة المستفيدة وطريقة الدفع والمبلغ واسم من سجّله.',
        ],
        en: [
          'Open **Expenses** from the sidebar, in the **Finance** section. The page opens on the current month.',
          'At the top is the period bar, then four cards: **Period total** with its change **vs previous period**, **Top category** with its amount and share of the total, **Expenses** (how many) with the **Average expense**, and the **Previous period** total.',
          'Below them is **Breakdown by category**, then the **Expense log**: each expense shows its date, category, description, vendor, payment method, amount and who recorded it.',
        ],
      },
      tips: {
        ar: [
          'المصروفات لمدير العيادة وحده: لا تظهر في القائمة الجانبية لبقية الأدوار، ومن يفتح عنوانها بدور آخر يرى «هذه الصفحة غير متاحة لدورك». انظر [الأدوار والصلاحيات](staff#roles).',
          'من هذه المصروفات يحسب البرنامج المصروفات وصافي الربح في [التقارير المالية](reports#financial).',
          'في وضع القراءة فقط بعد انتهاء الفترة التجريبية تبقى المصروفات ظاهرة، ويتوقف التسجيل والتعديل. انظر [الترخيص](licence).',
        ],
        en: [
          'Expenses are for the clinic admin only: the page is left out of the other roles’ menu, and anyone else who opens its address sees “This page is not available for your role”. See [Roles and permissions](staff#roles).',
          'Dentora takes the expenses and net profit in the [Financial reports](reports#financial) from these records.',
          'In read-only mode, after the trial ends, expenses stay visible but recording and editing stop. See [Licence](licence).',
        ],
      },
      shots: ['expenses-overview'],
    },
    {
      id: 'add',
      title: { ar: 'تسجيل مصروف', en: 'Recording an expense' },
      steps: {
        ar: [
          'انقر على **مصروف جديد** أعلى الصفحة.',
          'اختر **الفئة**: إيجار، أو رواتب، أو مواد، أو مخبر، أو معدات، أو كهرباء وماء وإنترنت، أو تسويق، أو صيانة، أو ضرائب ورسوم، أو أخرى.',
          'اكتب **المبلغ**، وتأكد من **التاريخ** (يضع البرنامج تاريخ اليوم تلقائياً).',
          'اكتب **الوصف**، مثل: فاتورة كهرباء شهر أيلول.',
          'أضف إن شئت **الجهة المستفيدة**، واختر **طريقة الدفع** (وهي نقداً ما لم تغيّرها).',
          'انقر على **تسجيل المصروف**.',
        ],
        en: [
          'Click **New expense** at the top of the page.',
          'Choose the **Category**: Rent, Salaries, Materials, Lab, Equipment, Utilities, Marketing, Maintenance, Taxes & fees or Other.',
          'Type the **Amount** and check the **Date** (today by default).',
          'Write a **Description**, for example: September electricity bill.',
          'Add the **Vendor** if you like, and choose the **Payment method** (Cash by default).',
          'Click **Save expense**.',
        ],
      },
      tips: {
        ar: [
          'الفئة والمبلغ والتاريخ والوصف حقول مطلوبة، والمبلغ أكبر من صفر. ويُقرَّب إلى كسور عملة العيادة.',
          'يقترح عليك البرنامج الجهات التي كتبتها من قبل، فلا تعيد كتابة اسم المالك أو شركة الكهرباء كل شهر.',
          'تستطيع تسجيل مصروف بتاريخ قادم، مثل إيجار الشهر المقبل، ثم تصل إليه بأسهم الأشهر.',
          'يُحفظ اسم من سجّل المصروف، ويظهر في عمود **سجّله**.',
        ],
        en: [
          'Category, amount, date and description are required, and the amount must be above zero. It is rounded to the clinic currency’s decimals.',
          'Dentora suggests the vendors you typed before, so you do not retype the landlord or the power company every month.',
          'You can record an expense with a future date, such as next month’s rent, and reach it later with the month arrows.',
          'The name of whoever recorded the expense is kept and shows in the **Recorded by** column.',
        ],
      },
      shots: ['expenses-new'],
    },
    {
      id: 'period',
      title: { ar: 'اختيار الفترة والمقارنة', en: 'Choosing the period and comparing' },
      text: {
        ar: [
          'تعمل الصفحة شهراً بشهر: اسم الشهر في وسط الشريط، وعلى جانبيه سهما **الشهر السابق** و**الشهر التالي**. وفي طرف الشريط عدد أيام الفترة.',
          'تقارن البطاقات الشهر بالشهر الذي قبله. وفي الفترة المخصصة تقارنها بفترة بالطول نفسه تنتهي في اليوم السابق لبدايتها.',
        ],
        en: [
          'The page works month by month: the month’s name sits in the middle of the bar, with the **Previous month** and **Next month** arrows on each side. The number of days in the period shows at the end of the bar.',
          'The cards compare the month with the one before it. For a custom range they compare it with a range of the same length that ends the day before it starts.',
        ],
      },
      steps: {
        ar: [
          'انقر على السهمين لتنتقل بين الأشهر.',
          'لفترة أخرى انقر على **فترة مخصصة**، واختر تاريخ البداية وتاريخ النهاية. تُفتح أول مرة على آخر 30 يوماً.',
          'للعودة إلى الأشهر انقر على **شهري**، ثم على **هذا الشهر** إن كنت في شهر آخر.',
        ],
        en: [
          'Click the arrows to move between months.',
          'For another stretch of time click **Custom range** and choose the start and end dates. It starts on the last 30 days.',
          'To go back to months click **Monthly**, then **This month** if you are on another month.',
        ],
      },
      tips: {
        ar: [
          'إن جعلت البداية بعد النهاية يقول لك البرنامج «اختر فترة صحيحة (البداية قبل النهاية)»، ويبقى على آخر فترة صحيحة.',
          'سهم الشهر التالي يتوقف عند الشهر الحالي، إلا إن كان هناك مصروف بتاريخ لاحق.',
          'نسبة التغيّر خضراء حين ينخفض الإنفاق عن الفترة السابقة.',
        ],
        en: [
          'If the start is after the end, Dentora says “Pick a valid range (start before end)” and keeps the last valid range.',
          'The next-month arrow stops at the current month, unless an expense is dated later.',
          'The change figure is green when spending is lower than in the previous period.',
        ],
      },
      shots: ['expenses-period'],
    },
    {
      id: 'breakdown',
      title: { ar: 'أين يذهب المال؟ التوزيع والبحث', en: 'Where does the money go? Breakdown and search' },
      text: {
        ar: [
          'بطاقة **التوزيع حسب الفئة** تبدأ بشريط ملوّن يقسم إجمالي الفترة بين الفئات، ثم سطر لكل فئة فيه عدد عملياتها ومبلغها وحصتها من الإجمالي، من الأكبر إلى الأصغر.',
        ],
        en: [
          '**Breakdown by category** starts with a coloured strip that splits the period total between the categories, then one line per category with its number of entries, its amount and its share of the total, largest first.',
        ],
      },
      steps: {
        ar: [
          'انقر على سطر فئة في التوزيع لتعرض مصروفاتها وحدها في السجل. انقر عليه مرة ثانية لتعرض الكل. ويعمل النقر على بطاقة **أعلى فئة** بالطريقة نفسها.',
          'اكتب في مربع البحث فوق السجل كلمة من الوصف أو من اسم الجهة.',
          'أو اختر فئة من قائمة **كل الفئات** بجانب البحث.',
        ],
        en: [
          'Click a category line in the breakdown to show only its expenses in the log. Click it again to show everything. Clicking the **Top category** card works the same way.',
          'Type a word from the description or the vendor in the search box above the log.',
          'Or choose a category from the **All categories** list next to the search.',
        ],
      },
      tips: {
        ar: [
          'حين تبحث أو تصفّي يصبح سطر **الإجمالي** تحت السجل **إجمالي النتائج**، فتعرف مثلاً كم صرفت على المخبر هذا الشهر.',
          'يعرض السجل 20 مصروفاً في الصفحة (15 على الهاتف)، وأزرار الصفحات تحته.',
        ],
        en: [
          'When you search or filter, the **Total** line under the log becomes **Total of results**, so you know at once, say, how much went to the lab this month.',
          'The log shows 20 expenses a page (15 on a phone), with the page buttons underneath.',
        ],
      },
      shots: ['expenses-breakdown'],
    },
    {
      id: 'edit',
      title: { ar: 'التعديل والحذف والمصروفات التلقائية والتصدير', en: 'Editing, deleting, automatic expenses and export' },
      text: {
        ar: [
          'انقر على سطر المصروف أو على زر القلم لتفتح **تعديل المصروف**، غيّر ما تريد ثم انقر على **حفظ التغييرات**. ولحذفه انقر على زر سلة المهملات وأكّد بـ **حذف**.',
          'بعض المصروفات يسجّلها البرنامج وحده: حين يُستلم طلب مخبر له تكلفة (أو يُركَّب) يُسجَّل مصروف في فئة **مخبر** عليه علامة **من طلب مخبر**، ويتبع تكلفة الطلب، ويُحذف إن أُلغي الطلب أو حُذف. وحين تسجّل شراءً للمخزون ومفتاح المصروفات مفعّل يُسجَّل إجمالي الشراء في فئة **مواد**. انظر [المخبر](lab) و[تسجيل شراء](inventory#purchase).',
          'زر **تصدير CSV** يحفظ السجل كما تراه، بالفترة والبحث والفئة المختارة، في ملف جدول يفتحه Excel والعربية فيه سليمة.',
        ],
        en: [
          'Click an expense’s row or its pencil button to open **Edit expense**, change what you need, then click **Save changes**. To delete it, click its bin button and confirm with **Delete**.',
          'Some expenses are recorded by Dentora itself: when a lab order with a cost is received (or fitted), an expense is recorded under **Lab** and marked **From a lab order**; it follows the order’s cost, and is removed if the order is cancelled or deleted. When you record a stock purchase with the expense switch on, its total is recorded under **Materials**. See [Lab](lab) and [Recording a purchase](inventory#purchase).',
          'The **Export CSV** button saves the log as you see it, with its period, search and category, as a spreadsheet file that Excel opens with Arabic intact.',
        ],
      },
      tips: {
        ar: [
          'عدّل تكلفة مصروف المخبر من صفحة المخبر لا من هنا، حتى يبقى الطلب ومصروفه متطابقين. تذكّرك بذلك ملاحظة في أعلى نافذة التعديل.',
          'الحذف نهائي، فاكتفِ بالتعديل إن كان الخطأ في المبلغ أو التاريخ.',
          'على ويندوز تُفتح نافذة حفظ لتختار مكان ملف CSV، وعلى أندرويد تُفتح شاشة الحفظ في النظام.',
        ],
        en: [
          'Change a lab expense’s cost on the Lab page, not here, so the order and its expense stay the same. A note at the top of the edit window reminds you.',
          'Deleting is permanent, so just edit the expense if the mistake is in the amount or the date.',
          'On Windows a save window opens for you to choose where the CSV file goes; on Android the system’s save screen opens.',
        ],
      },
      shots: ['expenses-lab-edit'],
    },
    {
      id: 'phone',
      title: { ar: 'المصروفات على الهاتف', en: 'Expenses on the phone' },
      text: {
        ar: [
          'على الهاتف يُجمع السجل حسب اليوم: «اليوم» و«أمس» ثم التواريخ، ومع كل يوم مجموع ما صُرف فيه. المس أي مصروف لتعدّله، أو زر ⋮ بجانبه لتختار **تعديل** أو **حذف**. وفي آخر القائمة مجموع الفترة.',
          'زر التصدير في أعلى الصفحة أيقونة سهم التنزيل.',
        ],
        en: [
          'On a phone the log is grouped by day: “Today” and “Yesterday”, then dates, each with the day’s total. Tap an expense to edit it, or the ⋮ button next to it for **Edit** or **Delete**. The period total closes the list.',
          'The export button at the top of the page is the download-arrow icon.',
        ],
      },
      shots: ['expenses-phone'],
    },
  ],
  shots: [
    {
      id: 'expenses-overview',
      device: 'desktop',
      alt: {
        ar: 'صفحة المصروفات لشهر تشرين الأول: شريط الفترة، وأربع بطاقات، وبطاقة التوزيع حسب الفئة بأشرطتها الملونة',
        en: 'The Expenses page for October: the period bar, four cards and the breakdown by category with its coloured bars',
      },
      recipe: `${DESK} Route #/expenses (opens on October 2026, Monthly). Wait until the four stat cards show amounts. Capture the whole window. No markers.`,
    },
    {
      id: 'expenses-new',
      device: 'desktop',
      alt: {
        ar: 'نافذة مصروف جديد مملوءة: الفئة كهرباء وماء وإنترنت، والمبلغ، والتاريخ، والوصف، والجهة المستفيدة، وطريقة الدفع نقداً',
        en: 'The New expense dialog filled in: category Utilities, amount, date, description, vendor and payment method Cash',
      },
      recipe: `${DESK} Route #/expenses. Click **New expense** (مصروف جديد). In the dialog choose Category **Utilities** (كهرباء وماء وإنترنت), Amount 48, keep today's date, Description "فاتورة كهرباء شهر تشرين الأول" (EN: "October electricity bill"), Vendor "مؤسسة الكهرباء" (EN: "Electricity company"), leave Payment method on Cash. Crop to the dialog (.modal). Markers: 2 on the Category select, 3 on the Amount field, 4 on the Description field, 5 on the Vendor field, 6 on **Save expense** (تسجيل المصروف). Close with **Cancel** (do not save).`,
    },
    {
      id: 'expenses-period',
      device: 'desktop',
      alt: {
        ar: 'شريط الفترة على فترة مخصصة: تاريخا البداية والنهاية لآخر 30 يوماً، وعدد الأيام في طرف الشريط',
        en: 'The period bar on a custom range: start and end dates for the last 30 days, and the number of days at the end of the bar',
      },
      recipe: `${DESK} Route #/expenses. In the period bar (.inv-exp-period) click **Custom range** (فترة مخصصة); the range shows 12 Sep 2026 – 11 Oct 2026. Wait 600 ms. Crop from the top of the page title to the bottom of the four stat cards (.inv-exp-stats), full content width, 12 px margin. Markers: 2 on the two date fields, 3 on the **Monthly** (شهري) button.`,
    },
    {
      id: 'expenses-breakdown',
      device: 'desktop',
      alt: {
        ar: 'التوزيع حسب الفئة وفئة المخبر مختارة، والسجل تحته يعرض مصروفات المخبر وحدها مع إجمالي النتائج',
        en: 'The breakdown by category with Lab selected, and the log below showing only lab expenses with the total of results',
      },
      recipe: `${DESK} Route #/expenses (October 2026). Click the first category line of the breakdown (.inv-exp-bar:first-child, Lab / مخبر, the largest). Wait 600 ms. Crop from the breakdown card (.inv-exp-breakdown) down to the log's Total of results line. Markers: 1 on the selected Lab line, 2 on the log's search box, 3 on the category list next to it.`,
    },
    {
      id: 'expenses-lab-edit',
      device: 'desktop',
      alt: {
        ar: 'نافذة تعديل مصروف سُجّل من طلب مخبر، وفي أعلاها ملاحظة تطلب تعديل التكلفة من صفحة المخبر',
        en: 'The edit window of an expense recorded from a lab order, with a note at the top asking to change the cost on the Lab page',
      },
      recipe: `${DESK} Route #/expenses (October 2026). Click the description cell of the first log row that shows "From a lab order" (table tbody tr containing .inv-exp-lab). Crop to the dialog (.modal). No markers. Close with **Cancel**.`,
    },
    {
      id: 'expenses-phone',
      device: 'phone',
      alt: {
        ar: 'سجل المصروفات على الهاتف مجموعاً حسب اليوم، مع مجموع كل يوم وزر خيارات لكل مصروف',
        en: 'The expense log on a phone grouped by day, with each day’s total and an options button on every expense',
      },
      recipe: `${PHONE} Route #/expenses (October 2026). Scroll so the first day group (.inv-exp-groups .inv-exp-group:first-child) sits just under the top bar. Capture the screen. No markers.`,
    },
  ],
}
export default topic

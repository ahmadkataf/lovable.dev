import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in store/scripts/shoot.mjs.
// The demo stock is the same in every run: 28 active items, 7 of them at or below their alert level, 1 expiring within
// 60 days. Rows are sorted by urgency then by name, so "the first row" is an item marked Low in both languages (its name
// differs between the Arabic and the English clinic). Never save anything in a shot: close dialogs with Cancel / Escape.
const DESK = 'Desktop 1440×900, demo clinic as store/scripts/shoot.mjs makes it (seedAndLogin + Settings → Backup → Load demo data; English shots use its englishClinic() names), signed in as the admin (Dr. Ahmad Al-Khatib), clock fixed at Sunday 11 Oct 2026 11:40 Asia/Damascus, trial bar hidden ([data-qa="trial-bar"]{display:none}), page scrolled to the top and held there (page.goto() reads as Back to the app, which restores an old scroll position).'
const PHONE = 'Phone 390×844 (isMobile, hasTouch, deviceScaleFactor 8/3 as shoot.mjs), same demo clinic, clock and hidden trial bar.'

const topic: GuideTopic = {
  slug: 'inventory',
  order: 11,
  icon: 'boxes',
  title: { ar: 'المخزون', en: 'Inventory' },
  summary: {
    ar: 'تابع مواد العيادة وأدواتها: الكميات وحدود التنبيه وتواريخ الانتهاء. سجّل الشراء والاستهلاك بنقرة، ودع البرنامج ينبّهك قبل أن ينفد شيء.',
    en: 'Keep track of your clinic’s supplies and instruments: quantities, alert levels and expiry dates. Record purchases and use in a click, and let Dentora warn you before anything runs out.',
  },
  metaDescription: {
    ar: 'تابع مواد العيادة وأدواتها: الكميات وحدود التنبيه وتواريخ الانتهاء. سجّل الشراء والاستهلاك بنقرة، ودع البرنامج ينبّهك قبل أن ينفد شيء.',
    en: 'Track supplies and instruments: quantities, alert levels and expiry dates. Record purchases and use in a click, and get warned before anything runs out.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'صفحة المخزون', en: 'The Inventory page' },
      text: {
        ar: [
          'افتح **المخزون** من القائمة الجانبية، في قسم **الإدارة**. على الهاتف تجده تحت **المزيد** في الشريط السفلي.',
          'في الأعلى أربع بطاقات: **عدد الأصناف**، و**نقص في المخزون**، و**قاربت على الانتهاء**، و**قيمة المخزون** (الكمية × سعر التكلفة). وتحتها شريط أصفر يذكر الأصناف التي بلغت حد التنبيه، ومعه زر **تزويد المخزون**.',
          'ثم تبويبان: **الأصناف** و**الحركات**. في جدول الأصناف ترى لكل صنف رمزه وفئته، و**الكمية** بين زرّي − و+، ثم **حد التنبيه** و**سعر التكلفة** و**القيمة** و**المورد** و**الصلاحية**، وفي آخر السطر زر الخيارات ⋮.',
          'يرتّب البرنامج القائمة حسب الأولوية: ما نفد أولاً، ثم ما بلغ حد التنبيه، ثم ما انتهت صلاحيته أو قاربت، ثم بقية الأصناف حسب الاسم. هكذا تقرأ أعلى القائمة كأنها قائمة مهام.',
        ],
        en: [
          'Open **Inventory** from the sidebar, in the **Management** section. On a phone it is under **More** in the bottom bar.',
          'Four cards sit at the top: **Items**, **Low stock**, **Expiring soon** and **Stock value** (quantity × cost price). Under them a yellow bar names the items that have reached their alert level, with a **Restock** button.',
          'Then come two tabs, **Items** and **Movements**. In the items table each item shows its SKU and category, its **Quantity** between a − and a + button, then **Threshold**, **Cost price**, **Value**, **Supplier** and **Expiry**, with the ⋮ options button at the end of the row.',
          'The list is sorted by urgency: out of stock first, then items at their alert level, then expired or expiring ones, then everything else by name. The top of the list reads like a to-do list.',
        ],
      },
      tips: {
        ar: [
          'المخزون متاح لكل أدوار الفريق: المدير والطبيب والمساعد والاستقبال. انظر [الأدوار والصلاحيات](staff#roles).',
          'تعرض القائمة 25 صنفاً في الصفحة، وتحتها عدد الأصناف المعروضة وقيمتها.',
          'إذا انتهت الفترة التجريبية دون تفعيل تبقى القائمة والسجل للقراءة فقط، وتختفي أزرار − و+. انظر [الترخيص](licence).',
        ],
        en: [
          'Inventory is open to every role: admin, doctor, assistant and receptionist. See [Roles and permissions](staff#roles).',
          'The list shows 25 items a page, with the number of items shown and their value underneath.',
          'If the trial ends without activation, the list and history stay readable but read-only, and the − and + buttons disappear. See [Licence](licence).',
        ],
      },
      shots: ['inventory-overview'],
    },
    {
      id: 'add-item',
      title: { ar: 'إضافة صنف جديد', en: 'Adding a new item' },
      text: {
        ar: ['أضف كل مادة أو أداة تريد متابعتها مرة واحدة فقط، ثم تتغير كميتها مع كل شراء أو استهلاك.'],
        en: ['Add each supply or instrument you want to follow once; after that its quantity moves with every purchase and every use.'],
      },
      steps: {
        ar: [
          'انقر على **صنف جديد** أعلى الصفحة. وإن كان المخزون فارغاً تجد في وسطه زر **إضافة أول صنف**.',
          'اكتب **اسم الصنف**، مثل: قفازات لاتكس مقاس M.',
          'اختر **الفئة** بنقرة من الفئات الجاهزة (**مستهلكات**، **أدوات**، **مواد**، **أدوية**، **مكتبية**، **معدات**)، أو اكتب فئة جديدة. وأضف **الرمز (SKU)** إن كان للصنف رمز.',
          'اختر **الوحدة**: قطعة أو علبة أو عبوة أو مل أو غ. وإن لم تجد وحدتك فاختر **وحدة أخرى…** واكتبها، مثل: أنبوب.',
          'أدخل **الكمية الابتدائية** الموجودة الآن، و**حد التنبيه**، و**سعر التكلفة** للوحدة الواحدة، و**تاريخ الانتهاء** إن وُجد.',
          'أكمل إن شئت **المورد** و**مكان التخزين** و**ملاحظات**، ثم انقر على **إضافة الصنف**.',
        ],
        en: [
          'Click **New item** at the top of the page. If the inventory is still empty, there is also an **Add first item** button in the middle.',
          'Type the **Item name**, for example: Latex gloves, size M.',
          'Pick a **Category** with one click from the ready ones (**Consumables**, **Instruments**, **Materials**, **Medications**, **Office**, **Equipment**), or type a new one. Add the **SKU** if the item has a code.',
          'Choose the **Unit**: piece, box, pack, ml or g. If yours is not there, choose **Other unit…** and type it, for example: tube.',
          'Enter the **Opening quantity** you have now, the **Alert threshold**, the **Cost price** of one unit and the **Expiry date** if there is one.',
          'Fill in the **Supplier**, **Storage location** and **Notes** if useful, then click **Add item**.',
        ],
      },
      tips: {
        ar: [
          'الحقل المطلوب الوحيد هو اسم الصنف، والوحدة مختارة مسبقاً (**قطعة**).',
          'تُسجَّل الكمية الابتدائية في سجل الحركات باسم **رصيد افتتاحي**. بعد ذلك لا تُعدَّل الكمية من نموذج الصنف، بل بحركة مخزون، حتى يبقى السجل كاملاً.',
          'يُعدّ الصنف ناقصاً حين تصل كميته إلى حد التنبيه أو تنزل عنه. وإن تركت الحد صفراً فلا ينبّهك البرنامج إلا حين ينفد الصنف.',
          'إذا أدخلت تاريخ انتهاء ينبّهك البرنامج قبله بـ 60 يوماً.',
          'يقترح عليك البرنامج أسماء الموردين الذين كتبتهم من قبل، وتظهر الفئة الجديدة التي تكتبها بين أزرار التصفية.',
        ],
        en: [
          'The item name is the only required field, and the unit is preset (**piece**).',
          'The opening quantity is recorded in the history as **Opening stock**. After that the quantity is not edited in the item form but through stock movements, so the history stays complete.',
          'An item counts as low once its quantity reaches its alert threshold or goes below it. If you leave the threshold at zero, Dentora warns you only when the item runs out.',
          'With an expiry date, Dentora warns you 60 days before it.',
          'Dentora suggests the suppliers you typed before, and a new category you type shows up among the filter buttons.',
        ],
      },
      shots: ['inventory-new-item'],
    },
    {
      id: 'quick-move',
      title: { ar: 'إدخال كمية أو سحبها بسرعة', en: 'Quick stock in and out' },
      text: {
        ar: ['بجانب كمية كل صنف زرّان: − للسحب و+ للإضافة. استخدمهما حين تأخذ شيئاً من الخزانة أو تعيد إليها شيئاً، دون أن تفتح أي صفحة أخرى.'],
        en: ['Next to each item’s quantity there are two buttons: − to take stock and + to add stock. Use them when you take something from the cabinet or put something back, without opening another page.'],
      },
      steps: {
        ar: [
          'في سطر الصنف انقر على **+** لإضافة كمية، أو على **−** لسحب كمية.',
          'في نافذة **حركة مخزون** اكتب **الكمية**. ويمكنك التبديل بين **إدخال** و**إخراج** من أعلى النافذة.',
          'اختر **السبب**: مع الإدخال **شراء** أو **إرجاع** أو **تسوية**، ومع الإخراج **استهلاك** أو **إتلاف** أو **تسوية**.',
          'اكتب **ملاحظة** إن أردت، وانظر إلى **الرصيد بعد الحركة**، ثم انقر على **تسجيل الحركة**.',
        ],
        en: [
          'On the item’s row, click **+** to add stock or **−** to take stock.',
          'In the **Stock movement** box, type the **Quantity**. You can switch between **Stock in** and **Stock out** at the top of the box.',
          'Choose the **Reason**: **Purchase**, **Return** or **Adjustment** for stock in; **Used**, **Discarded** or **Adjustment** for stock out.',
          'Add a **Note** if you like, check the **Balance after**, then click **Record movement**.',
        ],
      },
      tips: {
        ar: [
          'لا تنزل الكمية تحت الصفر أبداً: إن كتبت أكثر من الموجود يقول لك البرنامج «المتاح … فقط». ويُعطَّل زر − حين تكون الكمية صفراً.',
          'استخدم **تسوية** بعد جرد الخزانة لتصحيح الرقم، و**إتلاف** لما انتهت صلاحيته أو تلف.',
          'تُحفظ مع كل حركة تاريخها ووقتها واسم من سجّلها.',
          'لتسجيل وصول طلبية فيها عدة أصناف استخدم [تسجيل شراء](inventory#purchase): أسرع، ويحدّث أسعار التكلفة أيضاً.',
          'على الهاتف تُفتح نافذة الحركة من أسفل الشاشة. انظر [المخزون على الهاتف](inventory#phone).',
        ],
        en: [
          'The quantity never goes below zero: if you type more than there is, Dentora tells you “Only … available”. The − button is disabled when the quantity is zero.',
          'Use **Adjustment** after counting the cabinet to correct the figure, and **Discarded** for anything expired or damaged.',
          'Every movement keeps its date, time and the name of whoever recorded it.',
          'To record a delivery with several items, use [Record purchase](inventory#purchase): it is quicker, and it updates the cost prices too.',
          'On a phone the movement box opens from the bottom of the screen. See [Inventory on the phone](inventory#phone).',
        ],
      },
      shots: ['inventory-quick-move'],
    },
    {
      id: 'purchase',
      title: { ar: 'تسجيل شراء وتزويد المخزون', en: 'Recording a purchase and restocking' },
      text: {
        ar: ['حين تصل طلبية سجّل أصنافها كلها مرة واحدة. ترتفع الكميات، ويصبح سعر الوحدة الجديد هو **سعر التكلفة** لكل صنف، ويُحفظ المورد على الأصناف.'],
        en: ['When a delivery arrives, record all its items in one go. The quantities go up, each item’s **Cost price** becomes the new unit price, and the supplier is saved on the items.'],
      },
      steps: {
        ar: [
          'انقر على **تسجيل شراء** أعلى الصفحة. أو انقر على **تزويد المخزون** في الشريط الأصفر لتُفتح النافذة وفيها كل الأصناف الناقصة بكميات مقترحة. أو اختر **تسجيل شراء لهذا الصنف** من قائمة ⋮ في سطر صنف واحد.',
          'تأكد من **تاريخ الشراء**، واكتب **المورد** و**رقم الفاتورة** إن كانا معك.',
          'في كل سطر اختر **الصنف** واكتب **الكمية** و**سعر الوحدة**. انقر على **إضافة صنف** لسطر جديد، أو على **إضافة الأصناف الناقصة** لتضيف كل ما بلغ حد التنبيه.',
          'اترك **تسجيل قيمة الشراء في المصروفات** مفعّلاً إن أردت أن يُسجَّل إجمالي الشراء مصروفاً في فئة **مواد**.',
          'راجع **إجمالي الشراء** أسفل النافذة، ثم انقر على **حفظ الشراء**.',
        ],
        en: [
          'Click **Record purchase** at the top of the page. Or click **Restock** in the yellow bar: the form opens with every low item and a suggested quantity. Or choose **Record a purchase** from the ⋮ menu of a single item.',
          'Check the **Purchase date**, and fill in the **Supplier** and **Invoice number** if you have them.',
          'On each line pick the **Item** and type the **Quantity** and **Unit price**. Click **Add item** for another line, or **Add low-stock items** to add everything at its alert level.',
          'Leave **Record the purchase total as an expense** on if you want the total recorded as an expense under **Materials**.',
          'Check the **Purchase total** at the bottom, then click **Save purchase**.',
        ],
      },
      tips: {
        ar: [
          'الكمية المقترحة للصنف الناقص تعيده إلى ضعف حد التنبيه، ويُملأ سعر الوحدة من سعر تكلفته الحالي. عدّل الرقمين كما في فاتورتك.',
          'لا يُقبل تاريخ شراء بعد اليوم، ولا يتكرر الصنف نفسه في سطرين («الصنف مكرر»). ولا تظهر في القائمة الأصناف الموقوفة.',
          'مفتاح **تسجيل قيمة الشراء في المصروفات** يظهر للمدير وحده، لأن [المصروفات](expenses) من صلاحياته. والشراء الذي يسجّله غيره يحدّث المخزون فقط.',
          'يُكتب المورد ورقم الفاتورة ملاحظةً على حركة كل صنف، فتجدهما لاحقاً في سجل الحركات.',
        ],
        en: [
          'The suggested quantity brings a low item back to twice its alert threshold, and the unit price is filled in from its current cost price. Change both to match your invoice.',
          'A purchase cannot be dated after today, and the same item cannot be on two lines (“Duplicate item”). Inactive items are not in the list.',
          'The expense switch is shown to the admin only, because [Expenses](expenses) are an admin task. A purchase recorded by anyone else updates the stock only.',
          'The supplier and invoice number are written as a note on each item’s movement, so you find them later in the history.',
        ],
      },
      shots: ['inventory-purchase'],
    },
    {
      id: 'history',
      title: { ar: 'سجل الحركات', en: 'Movement history' },
      text: {
        ar: [
          'انقر على سطر أي صنف (أو اختر **سجل الحركات** من قائمة ⋮) لتفتح لوحة **سجل الحركات** على جانب الشاشة. في أعلاها الكمية الحالية بخط كبير مع الحد، ثم **سعر التكلفة** و**القيمة** و**الصلاحية**، ومكان التخزين والمورد. ومنها تضيف أو تسحب بزرّي **إضافة كمية** و**سحب كمية**، وتعدّل الصنف بزر **تعديل الصنف** في أسفلها.',
          'تحت **آخر الحركات** تجد كل حركة بسببها وتاريخها ووقتها ومن سجّلها وملاحظتها، والكمية التي أضافتها أو سحبتها، و**الرصيد بعدها**.',
          'أما تبويب **الحركات** في أعلى الصفحة فيجمع حركات كل الأصناف، الأحدث أولاً. ابحث فيه باسم الصنف أو رمزه أو بالملاحظة، أو اختر سبباً واحداً (**شراء**، **استهلاك**، **تسوية**…) لتعرض حركاته وحدها. انقر على أي حركة لتفتح سجل صنفها.',
        ],
        en: [
          'Click any item’s row (or choose **Movement history** from its ⋮ menu) to open the **Movement history** panel at the side of the screen. At the top it shows the current quantity in large type with the threshold, then **Cost price**, **Value** and **Expiry**, the storage location and the supplier. From here you add or take stock with **Add stock** and **Take stock**, and change the item with **Edit item** at the bottom.',
          'Under **Recent movements** each movement shows its reason, date, time, who recorded it and its note, the quantity it added or took, and the **Balance after**.',
          'The **Movements** tab at the top of the page gathers the movements of every item, newest first. Search it by item name, SKU or note, or pick one reason (**Purchase**, **Used**, **Adjustment**…) to show only those. Click any movement to open its item’s history.',
        ],
      },
      shots: ['inventory-history', 'inventory-movements'],
    },
    {
      id: 'alerts-filters',
      title: { ar: 'التنبيهات والبحث والتصفية', en: 'Alerts, search and filters' },
      text: {
        ar: [
          'يحمل الصنف شارة **نقص** حين يبلغ حد التنبيه، وشارة **نفد** حين تصبح كميته صفراً. وفي عمود **الصلاحية** تظهر شارة مثل «ينتهي خلال 24 يوماً» أو **منتهي الصلاحية** لما قارب الانتهاء خلال 60 يوماً أو تجاوزه.',
          'لا تحتاج إلى فتح المخزون لتعرف ذلك: يظهر النقص والانتهاء أيضاً في [التنبيهات](interface#notifications) تحت زر الجرس، ويظهر النقص في تنبيهات [الشاشة الرئيسية](dashboard#alerts).',
        ],
        en: [
          'An item gets a **Low** badge when it reaches its alert threshold, and **Out of stock** when its quantity is zero. In the **Expiry** column a badge such as “Expires in 24 days” or **Expired** marks anything expiring within 60 days or already past it.',
          'You do not need to open Inventory to know: low and expiring stock also shows in the [Notifications](interface#notifications) under the bell, and low stock in the [Dashboard](dashboard#alerts) alerts.',
        ],
      },
      steps: {
        ar: [
          'اكتب في مربع البحث اسم الصنف أو رمزه أو مورده أو فئته أو مكان تخزينه.',
          'انقر على فئة من الأزرار تحت البحث لتعرض أصنافها وحدها، أو على **كل الفئات** لتعود.',
          'فعّل **النقص فقط**، أو انقر على بطاقة **نقص في المخزون**. ولعرض ما قارب الانتهاء انقر على بطاقة **قاربت على الانتهاء**، فيظهر زر **قريبة الانتهاء أو منتهية** ومعه × لإلغائه.',
          'انقر على **مسح التصفية** تحت الجدول لترى كل الأصناف من جديد.',
        ],
        en: [
          'Type an item’s name, SKU, supplier, category or storage location in the search box.',
          'Click a category button under the search to show only its items, or **All categories** to go back.',
          'Turn on **Low stock only**, or click the **Low stock** card. For expiring stock click the **Expiring soon** card: an **Expiring or expired** button appears, with an × to remove it.',
          'Click **Clear filters** under the table to see every item again.',
        ],
      },
      tips: {
        ar: [
          'الأصناف الموقوفة لا تنبّه أبداً، ولا تظهر إلا بعد تفعيل **إظهار الموقوفة**.',
          'البطاقتان تعملان كمفتاح: انقر على البطاقة نفسها مرة ثانية لإلغاء التصفية.',
        ],
        en: [
          'Inactive items never raise alerts, and show only with **Show inactive** turned on.',
          'The two cards work like a switch: click the same card again to remove the filter.',
        ],
      },
      shots: ['inventory-expiring'],
    },
    {
      id: 'edit-export',
      title: { ar: 'التعديل والإيقاف والحذف والتصدير', en: 'Editing, deactivating, deleting and exporting' },
      text: {
        ar: [
          'في قائمة ⋮ لكل صنف: **سجل الحركات** و**تعديل** و**تسجيل شراء لهذا الصنف** و**إيقاف الصنف** (أو **إعادة تفعيل** لصنف موقوف). ويظهر **حذف الصنف** فقط لصنف ليس في سجله إلا رصيده الافتتاحي.',
          'زر **تصدير CSV** أعلى الصفحة يحفظ جدول الأصناف كما تراه، أي مع البحث والتصفية، في ملف جدول يفتحه Excel والعربية فيه سليمة. وفي تبويب **الحركات** يحفظ الزر نفسه كل حركات المخزون.',
        ],
        en: [
          'Each item’s ⋮ menu holds **Movement history**, **Edit**, **Record a purchase** and **Deactivate item** (or **Reactivate** for an inactive one). **Delete item** appears only for an item whose history holds nothing but its opening stock.',
          'The **Export CSV** button at the top saves the items table as you see it, search and filters included, as a spreadsheet file that Excel opens with Arabic intact. On the **Movements** tab the same button saves every stock movement.',
        ],
      },
      tips: {
        ar: [
          'تعديل الصنف يغيّر اسمه وفئته ووحدته وسعره وصلاحيته وغيرها، ولا يغيّر كميته: تبقى خانة **الكمية الحالية** مقفلة، لأن الكمية تتغير بحركات المخزون فقط.',
          'أوقف الصنف الذي لم تعد تستخدمه بدل حذفه: يختفي من القوائم والشراء والتنبيهات، ويبقى سجله محفوظاً. لتعيده فعّل **إظهار الموقوفة** ثم اختر **إعادة تفعيل** من قائمته. ومفتاح **صنف نشط** في نافذة التعديل يفعل الشيء نفسه.',
          'الصنف الذي له حركات شراء أو استهلاك لا يُحذف، بل يُوقف، حتى لا يضيع سجله.',
          'على ويندوز تُفتح نافذة حفظ لتختار مكان الملف. وعلى أندرويد تُفتح شاشة الحفظ في النظام، فتختار مجلد التنزيلات أو Google Drive مثلاً. على الهاتف زر التصدير أيقونة سهم التنزيل.',
        ],
        en: [
          'Editing an item changes its name, category, unit, price, expiry and the rest, never its quantity: the **Current quantity** box stays locked, because the quantity moves only through stock movements.',
          'Deactivate an item you no longer use instead of deleting it: it leaves the lists, purchases and alerts, and its history is kept. To bring it back, turn on **Show inactive** and choose **Reactivate** from its menu. The **Active item** switch in the edit window does the same.',
          'An item with purchases or uses in its history cannot be deleted, only deactivated, so its history is never lost.',
          'On Windows a save window opens so you choose where the file goes. On Android the system’s save screen opens: choose Downloads or Google Drive, for example. On a phone the export button is the download-arrow icon.',
        ],
      },
      shots: ['inventory-row-menu'],
    },
    {
      id: 'phone',
      title: { ar: 'المخزون على الهاتف', en: 'Inventory on the phone' },
      text: {
        ar: [
          'على الهاتف يصبح كل صنف بطاقة: الاسم والرمز والفئة وشارة النقص، ثم الحد والقيمة، وشارة الصلاحية إن قارب الصنف على الانتهاء أو انتهى، وفي أسفلها الكمية بين زرّين كبيرين − و+ يسهل الضغط عليهما.',
          'المس البطاقة لتفتح سجل حركاتها، أو زر ⋮ لقائمة الخيارات. وتُفتح نافذة الحركة من أسفل الشاشة بالحقول نفسها.',
        ],
        en: [
          'On a phone each item becomes a card: name, SKU, category and the low badge, then the threshold and value (and an expiry badge when the item is expiring or expired), with the quantity at the bottom between two large − and + buttons that are easy to tap.',
          'Tap the card to open its movement history, or ⋮ for the options menu. The movement box opens from the bottom of the screen with the same fields.',
        ],
      },
      tips: {
        ar: ['زر الرجوع في أندرويد يغلق نافذة الحركة أو القائمة المفتوحة أولاً، ثم يعود إلى الصفحة السابقة.'],
        en: ['Android’s Back button first closes the open movement box or menu, then goes back a page.'],
      },
      shots: ['inventory-phone', 'inventory-phone-move'],
    },
  ],
  shots: [
    {
      id: 'inventory-overview',
      device: 'desktop',
      alt: {
        ar: 'صفحة المخزون: أربع بطاقات أرقام، وشريط أصفر بالأصناف الناقصة مع زر تزويد المخزون، ثم جدول الأصناف بكمياتها وأزرار الإضافة والسحب',
        en: 'The Inventory page: four figure cards, a yellow bar listing low items with a Restock button, then the items table with quantities and the add and take buttons',
      },
      recipe: `${DESK} Route #/inventory, Items tab, no search or filter. Wait until the four stat cards show numbers (.inv-stats). Capture the whole window. No markers.`,
    },
    {
      id: 'inventory-new-item',
      device: 'desktop',
      alt: {
        ar: 'نافذة صنف جديد: اسم الصنف والفئة بأزرارها الجاهزة والرمز، ثم الوحدة والكمية الابتدائية وحد التنبيه وسعر التكلفة وتاريخ الانتهاء والمورد',
        en: 'The New item dialog: item name, category with its ready buttons and SKU, then unit, opening quantity, alert threshold, cost price, expiry date and supplier',
      },
      recipe: `${DESK} Route #/inventory. Click the header button **New item** (صنف جديد). In the dialog type Item name "قفازات نتريل مقاس L" (EN: "Nitrile gloves, size L"), click the category chip **Consumables** (مستهلكات), leave Unit on piece, Opening quantity 10, Alert threshold 4, Cost price 6. Make the window tall enough for the whole dialog. Crop to the dialog (.modal). Markers: 2 on the Item name field, 3 on the category chips, 4 on the Unit select, 5 on the Opening quantity field, 6 on the **Add item** button in the footer. Close with **Cancel** (do not save).`,
    },
    {
      id: 'inventory-quick-move',
      device: 'desktop',
      alt: {
        ar: 'نافذة حركة مخزون صغيرة بجانب زر الإضافة: إدخال أو إخراج، والكمية، والسبب، والملاحظة، والرصيد الحالي والرصيد بعد الحركة',
        en: 'The small Stock movement box next to the add button: stock in or out, quantity, reason, note, current balance and balance after',
      },
      recipe: `${DESK} Route #/inventory, Items tab. On the first table row (table tbody tr:first-child) click the **+** button (.inv-step.add). In the box that opens (.inv-popover) type 5 in Quantity; leave the reason on **Purchase** (شراء). Wait 300 ms. Capture the whole window. Markers: 1 on the + button of that row, 2 on the Quantity field, 3 on the reason chips, 4 on **Record movement** (تسجيل الحركة). Close with Escape (do not record).`,
    },
    {
      id: 'inventory-purchase',
      device: 'desktop',
      alt: {
        ar: 'نافذة تسجيل شراء مملوءة بالأصناف الناقصة: تاريخ الشراء والمورد ورقم الفاتورة، ثم سطر لكل صنف بكميته وسعر وحدته وإجماليه، وإجمالي الشراء أسفل النافذة',
        en: 'The Record purchase dialog filled with the low items: purchase date, supplier and invoice number, then a line per item with quantity, unit price and total, and the purchase total at the bottom',
      },
      recipe: `${DESK} Route #/inventory, Items tab. Click **Restock** (تزويد المخزون) in the yellow bar (.inv-reorder button). The dialog opens with the 7 low items. Type Supplier "مستودع الشفاء للمواد السنية" (EN: "Al-Shifa Dental Supplies") and Invoice number "F-2291". Make the window tall enough for the whole dialog. Crop to the dialog (.modal). Markers: 2 on the Purchase date field, 3 on the first line's Quantity field, 4 on the Record the purchase total as an expense switch, 5 on **Save purchase** (حفظ الشراء). Close with **Cancel** (do not save).`,
    },
    {
      id: 'inventory-history',
      device: 'desktop',
      alt: {
        ar: 'لوحة سجل الحركات لصنف: الكمية الحالية والحد، وسعر التكلفة والقيمة والصلاحية، وزرّا إضافة كمية وسحب كمية، ثم آخر الحركات بالرصيد بعد كل حركة',
        en: 'An item’s Movement history panel: current quantity and threshold, cost price, value and expiry, the Add stock and Take stock buttons, then recent movements with the balance after each',
      },
      recipe: `${DESK} Route #/inventory, Items tab. Click the first cell (the item name) of the first table row. The side panel (.drawer) opens. Wait 700 ms. Capture the whole window. No markers.`,
    },
    {
      id: 'inventory-movements',
      device: 'desktop',
      alt: {
        ar: 'تبويب الحركات: بحث وأزرار الأسباب، ثم جدول بكل حركات المخزون بالتاريخ والصنف والسبب والتغيير والملاحظة ومن سجّلها',
        en: 'The Movements tab: search and reason buttons, then a table of every stock movement with date, item, reason, change, note and who recorded it',
      },
      recipe: `${DESK} Route #/inventory. Click the **Movements** tab (الحركات) in .inv-tabs. Wait 900 ms. Capture the whole window. No markers.`,
    },
    {
      id: 'inventory-expiring',
      device: 'desktop',
      alt: {
        ar: 'المخزون مصفّى على ما قارب الانتهاء: زر قريبة الانتهاء أو منتهية مفعّل، وصنف واحد في الجدول بشارة ينتهي خلال 24 يوماً',
        en: 'Inventory filtered to expiring stock: the Expiring or expired button is on, and one item in the table carries an “Expires in 24 days” badge',
      },
      recipe: `${DESK} Route #/inventory, Items tab. Click the third stat card, **Expiring soon** (.inv-stats .stat-card:nth-child(3), قاربت على الانتهاء). Wait 600 ms. Capture the whole window. Markers: 1 on the search box, 2 on the category chips, 3 on the **Expiring soon** card and on the **Expiring or expired** chip (two markers, both 3), 4 on **Clear filters** (مسح التصفية) under the table.`,
    },
    {
      id: 'inventory-row-menu',
      device: 'desktop',
      alt: {
        ar: 'قائمة خيارات صنف مفتوحة: سجل الحركات، تعديل، تسجيل شراء لهذا الصنف، إيقاف الصنف',
        en: 'An item’s options menu open: Movement history, Edit, Record a purchase, Deactivate item',
      },
      recipe: `${DESK} Route #/inventory, Items tab. Click the ⋮ button (.inv-rowmenu button) at the end of the first table row and wait 600 ms for the menu (.inv-portal-menu). Crop from the top of the table header (table thead) to 40 px below the bottom of the open menu, full table width, 12 px margin. No markers.`,
    },
    {
      id: 'inventory-phone',
      device: 'phone',
      alt: {
        ar: 'المخزون على الهاتف: كل صنف بطاقة بشارة النقص والحد والقيمة، والكمية بين زرّين كبيرين للسحب والإضافة',
        en: 'Inventory on a phone: each item is a card with its low badge, threshold and value, and the quantity between two large take and add buttons',
      },
      recipe: `${PHONE} Route #/inventory, Items tab. Scroll so the first item card (.inv-cards .inv-card:first-child) sits just under the top bar. Capture the screen. No markers.`,
    },
    {
      id: 'inventory-phone-move',
      device: 'phone',
      alt: {
        ar: 'نافذة حركة مخزون مفتوحة من أسفل شاشة الهاتف بالحقول نفسها',
        en: 'The Stock movement sheet open from the bottom of a phone screen, with the same fields',
      },
      recipe: `${PHONE} Route #/inventory, Items tab. Scroll so the first item card sits just under the top bar, then tap its **+** button (.inv-card .inv-step.add). Wait 800 ms for the sheet. Capture the screen. No markers. Close with the × (do not record).`,
    },
  ],
}
export default topic

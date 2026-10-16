import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in
// store/scripts/shoot.mjs; the English pictures use the English clinic of shoot.mjs (englishClinic). Demo patients
// are named by their file number, the same in every run and in both languages: look the id up with
// window.__dentora.db.patients (fileNo) and open #/patients/<id>?tab=treatments.
// Only treatments-chart-update changes the demo data (it completes one item): shoot it last, or on a fresh demo.
const DESK = 'Desktop 1440×900, demo clinic, clock fixed to Sunday 11 Oct 2026 11:40 (Asia/Damascus), trial bar hidden, signed in as the admin, as in store/scripts/shoot.mjs.'
const PHONE = 'Phone 390×844 (isMobile, hasTouch), demo clinic, same clock, trial bar hidden, signed in as the admin.'
const file = (n: number, ar: string, en: string) => `patient file #${n} (${ar} / ${en})`
const TAB = (n: number, ar: string, en: string) => `Open ${file(n, ar, en)} at #/patients/<id>?tab=treatments and reload; scroll so the tab bar (.pt-tabs) sits just under the top bar.`

const topic: GuideTopic = {
  slug: 'treatments',
  order: 7,
  icon: 'activity',
  title: { ar: 'العلاجات وخطط العلاج', en: 'Treatments and treatment plans' },
  summary: {
    ar: 'ضع للمريض خطة علاج بأسعارها واطبع له التقدير، وتابع التنفيذ بنداً بنداً، ثم حوّل العمل المنجز إلى فاتورة بنقرة واحدة.',
    en: 'Build a priced treatment plan and print the estimate, follow the work item by item, then turn the completed work into an invoice in one click.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'خطط العلاج في ملف المريض', en: 'Treatment plans in the patient file' },
      text: {
        ar: [
          'تُدار علاجات كل مريض من تبويب **العلاجات** في ملفه. هنا تضع الخطة المقترحة بأسعارها، وتتابع تنفيذها بنداً بنداً، ثم تحوّل العمل المنجز إلى فاتورة.',
          'في أعلى التبويب أربع بطاقات: **علاجات مخططة** و**قيد التنفيذ** و**علاجات منجزة** و**منجز غير مفوتر**. تعرض كل بطاقة قيمة البنود وعددها. وتحتها خطط العلاج، المفتوحة منها أولاً، ثم بطاقة **علاجات خارج الخطط** للعلاجات السريعة.',
          'لكل خطة شريط تقدّم يبيّن ما أُنجز منها، وجدول بنودها: السن والإجراء والطبيب والمبلغ والحالة وأزرار العمل.',
        ],
        en: [
          'Each patient’s treatments are managed in the **Treatments** tab of their file. Here you propose a priced plan, follow it item by item, and turn the completed work into an invoice.',
          'Four cards sit at the top: **Planned**, **In progress**, **Completed** and **Completed, not billed**, each with the value and number of items. Below them come the treatment plans, open ones first, then the **Treatments outside plans** card for quick treatments.',
          'Each plan has a progress bar showing how much is done, and a table of its items: tooth, procedure, doctor, amount, status and action buttons.',
        ],
      },
      tips: {
        ar: [
          'انقر على أي بند في الجدول لتعديله، وعلى رأس الخطة لطيّها أو فتحها. تبدأ الخطط الجارية مفتوحة، والمكتملة والملغاة مطوية، إلا إن كانت الخطة الوحيدة للمريض.',
          'شريط التقدم محسوب بقيمة البنود المنجزة من قيمة الخطة، لا بعددها.',
          'التبويب متاح للمدير والأطباء والمساعدين، ولا يراه موظف الاستقبال. أما زر **فوترة المنجز** فيظهر لمن يملك صلاحية الفواتير فقط. انظر [الأدوار والصلاحيات](staff#roles).',
          'على الهاتف تظهر البنود بطاقاتٍ تحت بعضها، ويكون زر **بدء** وأمر **طباعة التقدير** داخل قوائم ⋮.',
          'إذا انتهت الفترة التجريبية دون تفعيل تبقى الخطط ظاهرة وتستطيع طباعتها، لكن الإضافة والتعديل يتوقفان. انظر [الترخيص](licence).',
        ],
        en: [
          'Click any item in the table to edit it, and a plan’s header to fold or unfold it. Open plans start unfolded; completed and cancelled ones start folded, unless it is the patient’s only plan.',
          'The progress bar is measured by the value of the completed items against the plan value, not by their number.',
          'The tab is available to the admin, doctors and assistants; reception does not see it. The **Bill completed** button shows only for people allowed to use billing. See [Roles and permissions](staff#roles).',
          'On a phone the items are stacked as cards, and **Start** and **Print estimate** move into the ⋮ menus.',
          'If the trial ends without activation, plans stay visible and printable, but adding and editing stop. See [Licence](licence).',
        ],
      },
      shots: ['treatments-overview', 'treatments-phone'],
    },
    {
      id: 'new-plan',
      title: { ar: 'إنشاء خطة علاج وإضافة البنود', en: 'Creating a plan and adding items' },
      text: {
        ar: ['ابدأ بخطة علاج حين تقترح على المريض عدة إجراءات. تبدأ الخطة مسودةً، وتعتمدها بعد موافقة المريض.'],
        en: ['Start a treatment plan when you propose several procedures. A plan starts as a draft, and you approve it once the patient agrees.'],
      },
      steps: {
        ar: [
          'في تبويب **العلاجات** انقر على **خطة علاج جديدة**.',
          'اقبل **عنوان الخطة** المقترح أو اكتب عنواناً أوضح، مثل «معالجة لبية وتاج للسن 16». اختر **الطبيب** وأضف **ملاحظات** إن شئت، ثم انقر على **إنشاء الخطة**.',
          'تنفتح نافذة **إضافة بند علاجي** مباشرة. ابحث عن الإجراء بالاسم أو الرمز، أو اختر فئته، ثم انقر عليه. يأتي سعره من قائمة الأسعار.',
          'انقر على الأسنان المعنية. تستطيع اختيار أكثر من سن، فيُنشأ لكل سن بند مستقل.',
          'اختر **الأسطح** إن احتجت، وعدّل **السعر لكل سن** و**الخصم لكل سن** و**التاريخ المخطط** و**الطبيب** و**ملاحظات** البند.',
          'انقر على **إضافة البند**. يتبع اسم الزر عدد الأسنان، مثل **إضافة بندين**. ولإضافة بنود أخرى لاحقاً انقر على **إضافة بند** في شريط الخطة.',
        ],
        en: [
          'In the **Treatments** tab click **New treatment plan**.',
          'Keep the suggested **Plan title** or type a clearer one, such as “Root canal and crown, tooth 16”. Choose the **Doctor**, add **Notes** if you wish, then click **Create plan**.',
          'The **Add treatment** window opens straight away. Search for the procedure by name or code, or pick its category, then click it. Its price comes from your price list.',
          'Click the teeth involved. You can pick several: each tooth gets an item of its own.',
          'Pick **Surfaces** if needed, and adjust the **Price per tooth**, **Discount per tooth**, **Planned date**, **Doctor** and the item’s **Notes**.',
          'Click **Add item**. The button counts the teeth, such as **Add 2 items**. To add more later, click **Add item** in the plan’s bar.',
        ],
      },
      tips: {
        ar: [
          'في خانة البحث اضغط `Enter` لاختيار أول إجراء في النتائج.',
          'الإجراءات التي تحمل أيقونة السن في القائمة تتطلب تحديد سن، كالحشوات والتيجان والقلع. أما الفحص والتنظيف فتُضاف دون سن.',
          'النقطة الصغيرة على سنٍّ في الشبكة تعني أن له بنوداً علاجية سابقة. ولأسنان الأطفال فعّل **أسنان لبنية** فوق الشبكة.',
          'يُعرض السطح الطاحن (O) للأسنان الخلفية فقط، والسطح الحدّي (I) للأسنان الأمامية فقط.',
          'في خانة **ضمن الخطة** تستطيع وضع البند في خطة مفتوحة أخرى، أو اختيار **+ خطة علاج جديدة**، أو **بدون خطة**.',
          'السعر الذي تكتبه هنا يخص هذا المريض وحده، ولا يغيّر [قائمة الأسعار](treatments#price-list).',
          'من [مخطط الأسنان](chart#record) انقر على سن ثم على **علاج هذا السن**: ينتقل البرنامج إلى هذا التبويب ويفتح نافذة الإضافة والسن محدد، في أول خطة مفتوحة أو في خطة جديدة.',
        ],
        en: [
          'In the search box, press `Enter` to pick the first procedure in the results.',
          'Procedures with a tooth icon in the list need a tooth, such as fillings, crowns and extractions. Exams and cleanings are added without one.',
          'A small dot on a tooth in the grid means it already has treatment items. For a child’s teeth, turn on **Primary teeth** above the grid.',
          'Occlusal (O) is offered only for back teeth, and Incisal (I) only for front teeth.',
          'The **Plan** field lets you put the item in another open plan, choose **+ New treatment plan**, or **No plan**.',
          'The price you type here is for this patient only; it does not change the [price list](treatments#price-list).',
          'From the [dental chart](chart#record), click a tooth and then **Treat this tooth**: Dentora opens this tab with the add window ready for that tooth, in the first open plan or a new one.',
        ],
      },
      shots: ['treatments-new-plan', 'treatments-add-item'],
    },
    {
      id: 'progress',
      title: { ar: 'اعتماد الخطة ومتابعة التنفيذ', en: 'Approving the plan and following the work' },
      text: {
        ar: [
          'لكل بند أربع حالات: **مخطط** ثم **قيد التنفيذ** ثم **مكتمل**، أو **ملغى**.',
          'وحالة الخطة تتبع بنودها تلقائياً: **مسودة** ثم **معتمدة** بعد موافقة المريض، ثم **قيد التنفيذ** حين يبدأ العمل، ثم **مكتملة** حين تُنجز كل بنودها.',
        ],
        en: [
          'Each item has four statuses: **Planned**, then **In progress**, then **Completed**, or **Cancelled**.',
          'The plan’s status follows its items by itself: **Draft**, **Approved** once the patient agrees, **In progress** when work starts, and **Completed** when every item is done.',
        ],
      },
      steps: {
        ar: [
          'حين يوافق المريض انقر على **اعتماد الخطة**. يظهر الزر في المسودات، ويعمل حين يكون فيها بند واحد على الأقل.',
          'إذا كان العمل يمتد على أكثر من جلسة، كالمعالجة اللبية، انقر على **بدء** في سطره.',
          'عند الانتهاء انقر على **إنجاز**. يُسجَّل تاريخ اليوم تاريخاً للتنفيذ.',
          'إذا كان البند على سن يسألك البرنامج **تحديث مخطط الأسنان؟** ويقترح الحالة المناسبة، مثل **حشوة** بعد الحشوات و**تاج** بعد التيجان. راجع **الحالة المسجّلة** والأسطح ثم انقر على **تحديث المخطط**، أو على **ليس الآن**.',
          'لبقية الأوامر افتح قائمة ⋮ في سطر البند: **تعديل** و**إعادة إلى المخطط** و**إعادة فتح** و**إلغاء البند** و**حذف**. ويعيد زر **استعادة** البند الملغى إلى المخطط.',
        ],
        en: [
          'When the patient agrees, click **Approve plan**. The button is on drafts and works once they have at least one item.',
          'When work takes more than one visit, such as a root canal, click **Start** on its row.',
          'When it is finished, click **Complete**. Today is recorded as the date done.',
          'If the item is on a tooth, Dentora asks **Update the dental chart?** and suggests a finding, such as **Filling** after a filling or **Crown** after a crown. Check the **Condition to record** and the surfaces, then click **Update chart**, or **Not now**.',
          'For the other actions open the ⋮ menu on the item’s row: **Edit**, **Back to planned**, **Reopen**, **Cancel item** and **Delete**. **Restore** brings a cancelled item back to planned.',
        ],
      },
      tips: {
        ar: [
          'تستطيع النقر على **إنجاز** مباشرة دون **بدء**؛ فالبدء يفيد في الأعمال الطويلة فقط.',
          'إذا بدأ العمل في خطة لم تُعتمد بعد تنتقل إلى **قيد التنفيذ** تلقائياً، لأن البدء يعني أن المريض وافق. وحين يُنجز آخر بنودها تظهر رسالة «اكتملت خطة العلاج بالكامل».',
          'لا يظهر سؤال تحديث المخطط لكل الإجراءات، فلا يظهر مثلاً بعد الفحوص والصور الشعاعية والتقويم وعلاجات اللثة.',
          'البند المفوتر يحمل شارة **مفوتر** تفتح فاتورته. لا يمكن إلغاؤه أو إعادة فتحه أو حذفه، وفي تعديله يبقى الإجراء والسن والسعر مقفلة، وتستطيع تغيير الطبيب والتاريخ والملاحظات.',
          'كل تغيير على البنود يُسجَّل في سجل النشاطات مع اسم من قام به.',
        ],
        en: [
          'You can click **Complete** without **Start**; starting only helps with longer work.',
          'If work starts on a plan that is still a draft, the plan moves to **In progress** by itself: starting means the patient agreed. When its last item is done you see “Treatment plan completed”.',
          'The chart question does not come up for every procedure: not after exams, X-rays, orthodontics or gum treatment, for example.',
          'A billed item carries a **Billed** badge that opens its invoice. It cannot be cancelled, reopened or deleted, and when you edit it the procedure, tooth and price are locked; the doctor, date and notes can still change.',
          'Every change to an item is written to the activity log with the name of who made it.',
        ],
      },
      shots: ['treatments-plan-card', 'treatments-chart-update'],
    },
    {
      id: 'quick',
      title: { ar: 'علاج سريع دون خطة', en: 'A quick treatment without a plan' },
      text: {
        ar: ['للأعمال البسيطة التي تُنجز في الجلسة نفسها، كالفحص أو التنظيف أو القلع، سجّل علاجاً سريعاً بدل إنشاء خطة.'],
        en: ['For simple work done in the same visit, such as a check-up, a cleaning or an extraction, record a quick treatment instead of making a plan.'],
      },
      steps: {
        ar: [
          'في تبويب **العلاجات** انقر على **علاج سريع**.',
          'اختر الإجراء، ثم السن إن لزم.',
          'تحقق من **السعر** و**الطبيب**. يكون **تاريخ التنفيذ** اليوم، ويمكنك اختيار يوم سابق.',
          'انقر على **حفظ كعلاج منجز**. يُحفظ البند مكتملاً ويظهر في بطاقة **علاجات خارج الخطط**.',
        ],
        en: [
          'In the **Treatments** tab click **Quick treatment**.',
          'Pick the procedure, then the tooth if needed.',
          'Check the **Price** and **Doctor**. The **Date done** is today; you can pick an earlier day.',
          'Click **Save as completed**. The item is saved as completed and shows under **Treatments outside plans**.',
        ],
      },
      tips: {
        ar: [
          'لا يقبل **تاريخ التنفيذ** يوماً بعد اليوم.',
          'إذا كان العلاج على سن يُعرض عليك تحديث مخطط الأسنان مباشرة بعد الحفظ.',
          'تضم بطاقة **علاجات خارج الخطط** أيضاً البنود المنجزة من خطط حُذفت.',
          'العلاج السريع جاهز للفوترة فوراً. انظر [فوترة العمل المنجز](treatments#bill).',
        ],
        en: [
          'The **Date done** cannot be later than today.',
          'If the treatment is on a tooth, you are offered the dental chart update right after saving.',
          'The **Treatments outside plans** card also holds completed items from deleted plans.',
          'A quick treatment is ready to bill at once. See [Billing completed work](treatments#bill).',
        ],
      },
      shots: ['treatments-quick'],
    },
    {
      id: 'bill',
      title: { ar: 'فوترة العمل المنجز', en: 'Billing completed work' },
      text: {
        ar: ['لا تحتاج إلى كتابة الفاتورة بيدك. يجمع زر **فوترة المنجز** كل العلاجات المكتملة التي لم تُفوتر بعد، ويُظهر عددها عليه.'],
        en: ['You do not need to type the invoice. The **Bill completed** button gathers every completed treatment that is not billed yet, and shows how many there are.'],
      },
      steps: {
        ar: [
          'في تبويب **العلاجات** انقر على **فوترة المنجز**، أو على بطاقة **منجز غير مفوتر**.',
          'تظهر البنود كلها محددة. ألغِ تحديد ما لا تريد فوترته الآن.',
          'راجع الإجمالي، ثم انقر على **إصدار الفاتورة**.',
          'تصدر الفاتورة برقمها التالي وتنفتح أمامك، فتسجّل الدفعة أو تطبعها. انظر [صفحة الفاتورة](billing#invoice-page).',
        ],
        en: [
          'In the **Treatments** tab click **Bill completed**, or the **Completed, not billed** card.',
          'All the items are ticked. Untick any you do not want to bill now.',
          'Check the total, then click **Create invoice**.',
          'The invoice is issued with the next number and opens, ready for a payment or printing. See [The invoice page](billing#invoice-page).',
        ],
      },
      tips: {
        ar: [
          'تنتقل خصومات البنود إلى الفاتورة كما هي، وتُضاف نسبة الضريبة المحددة في [الإعدادات](settings#invoices-numbering) إن وُجدت.',
          'إذا كان للمريض رصيد دائن في حسابه يُسدَّد به جزء من الفاتورة الجديدة أو كلها تلقائياً.',
          'تستطيع أيضاً إضافة العلاجات المنجزة من نافذة الفاتورة نفسها عبر **من العلاجات**. انظر [إصدار فاتورة](billing#new-invoice).',
          'إذا أُلغيت فاتورة تعود علاجاتها متاحة للفوترة من جديد.',
        ],
        en: [
          'Item discounts carry over to the invoice as they are, and the tax rate set in [Settings](settings#invoices-numbering), if any, is added.',
          'If the patient has credit on account, it settles part or all of the new invoice automatically.',
          'You can also add completed treatments from the invoice window itself with **From treatments**. See [Issuing an invoice](billing#new-invoice).',
          'If an invoice is cancelled, its treatments can be billed again.',
        ],
      },
      shots: ['treatments-bill'],
    },
    {
      id: 'estimate',
      title: { ar: 'طباعة التقدير وإدارة الخطة', en: 'Printing the estimate and managing a plan' },
      text: {
        ar: ['اطبع للمريض تقديراً لتكلفة الخطة يأخذه معه ويوقّعه. ومن قائمة ⋮ في شريط الخطة تعدّلها أو تلغيها أو تحذفها.'],
        en: ['Print a cost estimate the patient can take home and sign. From the ⋮ menu in the plan’s bar you can edit, cancel or delete the plan.'],
      },
      steps: {
        ar: [
          'انقر على **طباعة التقدير** في شريط الخطة.',
          'راجع الورقة: ترويسة العيادة، وبيانات المريض والطبيب، والإجراءات بأسعارها وخصوماتها، ثم التكلفة التقديرية وسطرا توقيع المريض والطبيب.',
          'انقر على **طباعة**، ثم اختر الطابعة أو الحفظ بصيغة PDF.',
        ],
        en: [
          'Click **Print estimate** in the plan’s bar.',
          'Check the sheet: the clinic letterhead, the patient and doctor, the procedures with their prices and discounts, then the estimated total and signature lines for the patient and the doctor.',
          'Click **Print**, then choose a printer or save as PDF.',
        ],
      },
      tips: {
        ar: [
          'تُطبع على التقدير ملاحظات الخطة، وعبارة تفيد بأنه تقدير مبدئي صالح لمدة 30 يوماً. وإذا حددت نسبة ضريبة في الإعدادات تُضاف إلى التكلفة التقديرية.',
          'يحمل ملف PDF اسم الورقة والمريض والخطة، مثل «خطة علاج وتقدير تكلفة - أنس مازن ديب - معالجة لبية وتاج للسن 16».',
          'على ويندوز تُفتح نافذة الطباعة في ويندوز، ولحفظ ملف PDF اختر «Microsoft Print to PDF». وعلى أندرويد تُفتح شاشة الطباعة في النظام، وفيها خيار الحفظ بصيغة PDF. وعلى الهاتف تجد **طباعة التقدير** في قائمة ⋮ للخطة.',
          '**تعديل الخطة** يغيّر عنوانها وطبيبها وملاحظاتها.',
          '**إلغاء الخطة** يلغي البنود التي لم تُنجز ويُبقي المنجزة في سجل المريض. ويعيدها **إعادة تفعيل الخطة** متى شئت، ثم تستعيد البنود الملغاة واحداً واحداً.',
          '**حذف الخطة** يحذفها نهائياً مع بنودها غير المنجزة. أما البنود المنجزة أو المفوترة فتنتقل إلى **علاجات خارج الخطط**.',
        ],
        en: [
          'The plan notes are printed, with a line saying it is a preliminary estimate valid for 30 days. If a tax rate is set in Settings, it is added to the estimated total.',
          'The PDF is named after the sheet, the patient and the plan, such as “Treatment plan & estimate - Anas Mazen Deeb - Root canal and crown, tooth 16”.',
          'On Windows the Windows print dialog opens; to save a PDF choose “Microsoft Print to PDF”. On Android the system print screen opens, with a save-as-PDF option. On a phone, **Print estimate** is in the plan’s ⋮ menu.',
          '**Edit plan** changes its title, doctor and notes.',
          '**Cancel plan** cancels the unfinished items and keeps the completed ones on the patient’s record. **Reopen plan** brings it back whenever you need; then restore the cancelled items one by one.',
          '**Delete plan** removes it for good with its unfinished items. Completed or billed items move to **Treatments outside plans**.',
        ],
      },
      shots: ['treatments-estimate'],
    },
    {
      id: 'register',
      title: { ar: 'سجل العلاجات في العيادة', en: 'The clinic’s treatments register' },
      text: {
        ar: ['تجمع صفحة **العلاجات** في القائمة الجانبية كل البنود المخططة والمنجزة في العيادة، لكل المرضى. افتحها لتعرف ما أُنجز هذا الشهر، وما ينتظر التنفيذ، وما لم يُفوتر بعد.'],
        en: ['The **Treatments** page in the sidebar lists every planned and completed item in the clinic, for all patients. Open it to see what was done this month, what is waiting, and what is not billed yet.'],
      },
      steps: {
        ar: [
          'افتح **العلاجات** من القائمة الجانبية. تُعرض علاجات **هذا الشهر** أولاً.',
          'ضيّق القائمة بالبحث باسم المريض أو الإجراء أو رقم السن، أو بالفئة أو الحالة أو الفترة أو الطبيب.',
          'فعّل **تجميع حسب المريض** لترى بنود كل مريض معاً مع مجموعها.',
          'انقر على **تصدير CSV** لتحفظ القائمة الظاهرة في ملف تفتحه في Excel.',
          'انقر على أي سطر لتفتح تبويب **العلاجات** في ملف ذلك المريض.',
        ],
        en: [
          'Open **Treatments** in the sidebar. It opens on **This month**.',
          'Narrow the list by searching for a patient, procedure or tooth number, or by category, status, period or doctor.',
          'Turn on **Group by patient** to see each patient’s items together, with their total.',
          'Click **Export CSV** to save the list on screen as a file you can open in Excel.',
          'Click any row to open the **Treatments** tab of that patient.',
        ],
      },
      tips: {
        ar: [
          'انقر على بطاقة **قيمة العلاجات المخططة** أو **قيد التنفيذ** لعرض تلك البنود من كل الفترات، أو على **المنجز هذا الشهر** لعرض منجزات الشهر.',
          'بطاقات المخطط وقيد التنفيذ والمنجز غير المفوتر تحسب كل البنود أياً كان تاريخها، وكل البطاقات تتبع الطبيب المختار.',
          'الإجمالي فوق الجدول لا يحسب البنود الملغاة.',
          'يضم ملف CSV التاريخ ورقم الملف والمريض والسن والأسطح والإجراء والفئة والطبيب والحالة والسعر والخصم والإجمالي، وهل فُوتر البند.',
          'على ويندوز تختار مكان الملف في نافذة الحفظ، وعلى أندرويد في شاشة الحفظ في النظام.',
          'على الهاتف تصبح الحالة والفترة قائمتين منسدلتين، وتجد **العلاجات** تحت **المزيد** في الشريط السفلي.',
        ],
        en: [
          'Click the **Planned value** or **In progress** card to list those items from all time, or **Completed this month** for this month’s work.',
          'The planned, in-progress and not-billed cards count every item whatever its date, and all the cards follow the doctor chosen.',
          'The total above the table leaves out cancelled items.',
          'The CSV file holds the date, file number, patient, tooth, surfaces, procedure, category, doctor, status, price, discount, total, and whether the item is billed.',
          'On Windows you choose where to put the file in the Save window; on Android, in the system’s save screen.',
          'On a phone, status and period become two drop-down lists, and **Treatments** is under **More** in the bottom bar.',
        ],
      },
      shots: ['treatments-register'],
    },
    {
      id: 'price-list',
      title: { ar: 'قائمة الإجراءات والأسعار', en: 'Procedures and prices' },
      text: {
        ar: [
          'تحدد هذه القائمة اسم كل إجراء وسعره كما يظهران في الخطط والفواتير. يجدها المدير في **قائمة الإجراءات** ضمن قسم الإدارة في القائمة الجانبية.',
          'عند إعداد البرنامج تُحمَّل قائمة جاهزة من 79 إجراءً شائعاً في 12 فئة، بأسعار مقترحة تعدّلها كما تشاء.',
        ],
        en: [
          'This list sets each procedure’s name and price as they appear on plans and invoices. The admin finds it under **Procedures** in the Management part of the sidebar.',
          'When Dentora is set up, a ready list of 79 common procedures in 12 categories is loaded, with suggested prices you can change as you like.',
        ],
      },
      steps: {
        ar: [
          'لإضافة إجراء انقر على **إجراء جديد**، واكتب **اسم الإجراء** واختر **الفئة** واكتب **السعر**، ثم انقر على **حفظ**.',
          'أكمل إن شئت **الاسم بالإنجليزية** و**الرمز** و**المدة المعتادة** و**اللون**، وفعّل **يتطلب تحديد سن** للأعمال التي تُجرى على سن بعينه.',
          'لتعديل إجراء انقر على سطره. وفي قائمة ⋮ تجد **نسخ مكرر** و**إيقاف** و**حذف**.',
          'لرفع الأسعار أو خفضها دفعة واحدة اختر الفئة أولاً إن أردت، ثم انقر على **تعديل الأسعار**. اختر **زيادة** أو **تخفيض**، و**نسبة مئوية** أو **مبلغ ثابت**، واكتب **القيمة** واختر **التقريب**.',
          'راجع **معاينة الأسعار الجديدة**، ثم انقر على **تطبيق التعديل**.',
        ],
        en: [
          'To add a procedure click **New procedure**, type the **Name**, choose the **Category** and type the **Price**, then click **Save**.',
          'If you like, fill in the **English name**, **Code**, **Usual duration** and **Colour**, and turn on **Needs a tooth number** for work done on a specific tooth.',
          'To edit a procedure click its row. Its ⋮ menu has **Duplicate**, **Deactivate** and **Delete**.',
          'To raise or lower prices in one go, pick a category first if you want, then click **Adjust prices**. Choose **Increase** or **Decrease**, **Percentage** or **Fixed amount**, type the **Value** and choose the **Rounding**.',
          'Check the **Preview of the new prices**, then click **Apply change**.',
        ],
      },
      tips: {
        ar: [
          'الإجراء المستخدم في علاجات أو فواتير سابقة لا يُحذف. يقترح عليك البرنامج **إيقاف الإجراء** بدلاً من ذلك، فيختفي من القوائم وتبقى السجلات القديمة كما هي.',
          'الإجراءات الموقوفة لا تظهر عند إضافة علاج جديد. استعمل مفتاح **نشط** في السطر لإيقافها أو تفعيلها بسرعة.',
          'السعر الجديد يسري على البنود الجديدة فقط، وتبقى البنود المضافة والفواتير الصادرة بأسعارها.',
          'لا يقبل التخفيض بنسبة 100% أو أكثر، وينبهك البرنامج إن كان التعديل سيجعل بعض الأسعار صفراً. ولا يتكرر رمز واحد لإجراءين.',
          'إذا كانت عملة العيادة لا تُحوَّل إليها الأسعار المقترحة، كالليرة السورية، تبقى بأرقام الدولار وتظهر رسالة تذكّرك بتعديلها. بعد تعديلها انقر على **راجعت الأسعار** لإخفاء الرسالة.',
          'إذا أفرغت القائمة يظهر زر **تحميل القائمة الافتراضية** لإعادة القائمة الجاهزة.',
          'هذه الصفحة للمدير وحده؛ ويرى الأطباء والمساعدون الأسعار عند إضافة البنود.',
        ],
        en: [
          'A procedure used in past treatments or invoices cannot be deleted. Dentora offers **Deactivate instead**: it leaves the pickers and old records stay as they are.',
          'Inactive procedures do not show when adding treatments. Use the **Active** switch on the row to turn them off or on quickly.',
          'A new price applies to new items only; items already added and invoices already issued keep their prices.',
          'A percentage decrease must stay below 100%, and Dentora warns you if a change would bring prices down to zero. Two procedures cannot share a code.',
          'If the suggested prices cannot be converted to the clinic currency (the Syrian pound, for example), they stay in dollar figures and a notice reminds you to adjust them. Once done, click **Prices reviewed** to hide it.',
          'If you empty the list, a **Load default catalogue** button brings the ready list back.',
          'Only the admin can open this page; doctors and assistants see the prices when adding items.',
        ],
      },
      shots: ['treatments-procedures', 'treatments-bulk-price'],
    },
  ],
  shots: [
    {
      id: 'treatments-overview',
      device: 'desktop',
      alt: { ar: 'تبويب العلاجات في ملف مريض: البطاقات الأربع وخطة علاج قيد التنفيذ ببنودها وحالاتها', en: 'The Treatments tab of a patient file: the four cards and an in-progress plan with its items and statuses' },
      recipe: `${DESK} ${TAB(55, 'أنس مازن ديب', 'Anas Mazen Deeb')} The plan “معالجة لبية وتاج للسن 16 / Root canal and crown, tooth 16” (In progress, 4 of 5 done) is open. Capture the whole window. No markers.`,
    },
    {
      id: 'treatments-phone',
      device: 'phone',
      alt: { ar: 'خطة علاج على الهاتف: البنود بطاقات تحت بعضها مع حالاتها وزر الإنجاز، وإجماليات الخطة في الأسفل', en: 'A treatment plan on a phone: the items stacked as cards with their statuses and the Complete button, and the plan totals at the bottom' },
      recipe: `${PHONE} Open ${file(55, 'أنس مازن ديب', 'Anas Mazen Deeb')} at #/patients/<id>?tab=treatments and reload; scroll so the bottom of the first plan card (section.tr-plan) sits 16 px above the bottom bar (.app-bottomnav): the last items, the Complete button of the zirconia crown and the plan totals show. Capture the whole screen. No markers.`,
    },
    {
      id: 'treatments-new-plan',
      device: 'desktop',
      alt: { ar: 'نافذة خطة علاج جديدة: عنوان الخطة المقترح والطبيب والملاحظات', en: 'The New treatment plan window: the suggested plan title, the doctor and the notes' },
      recipe: `${DESK} ${TAB(23, 'كريم الدبّاغ', 'Karim Dabbagh')} Click **New treatment plan** (خطة علاج جديدة) in the bar above the plans. Leave the suggested title “خطة علاج — 11 تشرين الأول 2026 / Treatment plan — 11 Oct 2026”. Crop to the dialog ([role=dialog]). Markers: 2 on the Plan title field, 2 on **Create plan**. Close with Cancel (do not create the plan).`,
    },
    {
      id: 'treatments-add-item',
      device: 'desktop',
      alt: { ar: 'نافذة إضافة بند: حشوة كومبوزيت على السنين 36 و37 بسطحين، مع السعر لكل سن', en: 'The Add treatment window: a composite filling on teeth 36 and 37 with two surfaces, and the price per tooth' },
      caption: { ar: 'سنّان محددان يعنيان بندين مستقلين بالسعر نفسه.', en: 'Two teeth picked means two separate items at the same price.' },
      recipe: `${DESK} ${TAB(23, 'كريم الدبّاغ', 'Karim Dabbagh')} In the plan “قلع جراحي لضرس العقل 48 / Surgical removal of wisdom tooth 48” (Approved) click **Add item** (إضافة بند). In the dialog type “سطحان” (EN: “2 surfaces”) in the procedure search and click “حشوة كومبوزيت — سطحان / Composite filling — 2 surfaces”. Click teeth 36 and 37 in the grid (button[data-tooth="36"], [data-tooth="37"]), then the surface chips Mesial (M) and Occlusal (O). Leave the dialog body at its top. Crop to the dialog. Markers: 3 on the chosen procedure card (.tr-chosen), 4 on teeth 36–37, 5 on the surface chips and the price row, 6 on **Add 2 items** (إضافة بندين). Cancel afterwards (do not save).`,
    },
    {
      id: 'treatments-plan-card',
      device: 'desktop',
      alt: { ar: 'خطة علاج مسودة بثلاثة بنود مخططة، مع زر اعتماد الخطة وزرّي بدء وإنجاز في كل سطر', en: 'A draft plan with three planned items, with Approve plan and the Start and Complete buttons on each row' },
      recipe: `${DESK} ${TAB(19, 'مريم يوسف البيطار', 'Mariam Youssef Bitar')} The first plan card is “زراعة سن مكان السن 46 (اقتراح) / Implant replacing tooth 46 (proposal)” (Draft, 3 items). Crop to that card (the first section.tr-plan) with a 12 px margin. Markers: 1 on **Approve plan**, 2 on **Start** of the first row (CBCT), 3 on **Complete** of the same row, 5 on that row’s ⋮ button.`,
    },
    {
      id: 'treatments-chart-update',
      device: 'desktop',
      alt: { ar: 'نافذة تحديث مخطط الأسنان بعد إنجاز حشوة على السن 25: الحالة المقترحة حشوة على السطحين M وO', en: 'The chart update window after a filling on tooth 25: the suggested finding is a filling on surfaces M and O' },
      recipe: `${DESK} This completes one item of the demo: shoot it after the other pictures of this topic, or on a fresh demo. ${TAB(27, 'عبير المصري', 'Abeer Masri')} In the plan “خطة ترميمية — حشوات تجميلية / Restorative plan — composite fillings” (Approved) click **Complete** (إنجاز) on the row of tooth 25 (Composite filling — 2 surfaces, MO). The **Update the dental chart?** dialog opens with the condition Filling and the chips M and O on. Crop to the dialog. Markers: 4 on the Condition to record list, 4 on **Update chart**. Then click **Not now**.`,
    },
    {
      id: 'treatments-quick',
      device: 'desktop',
      alt: { ar: 'نافذة العلاج السريع: قلع بسيط على السن 47 بتاريخ اليوم', en: 'The Quick treatment window: a simple extraction on tooth 47, dated today' },
      recipe: `${DESK} ${TAB(23, 'كريم الدبّاغ', 'Karim Dabbagh')} Click **Quick treatment** (علاج سريع). Type “بسيط” (EN: “Simple”) in the procedure search and press Enter (picks “قلع بسيط / Simple extraction”), then click tooth 47. Leave the dialog body at its top. Crop to the dialog. Markers: 2 on the chosen procedure card and tooth 47, 3 on the Price field, 4 on **Save as completed**. Cancel afterwards (do not save).`,
    },
    {
      id: 'treatments-bill',
      device: 'desktop',
      alt: { ar: 'نافذة فوترة العلاجات المنجزة: ثلاثة بنود محددة والإجمالي', en: 'The Bill completed treatments window: three ticked items and the total' },
      recipe: `${DESK} ${TAB(31, 'غادة خوري', 'Ghada Khoury')} Click **Bill completed** (فوترة المنجز, with the count 3). Crop to the dialog. Markers: 2 on the Select all row, 3 on **Create invoice**. Cancel afterwards (do not create the invoice).`,
    },
    {
      id: 'treatments-estimate',
      device: 'desktop',
      alt: { ar: 'تقدير تكلفة خطة العلاج قبل الطباعة: الإجراءات والأسعار والخصم والتكلفة التقديرية وسطرا التوقيع', en: 'A plan’s cost estimate before printing: procedures, prices, discount, estimated total and signature lines' },
      recipe: `${DESK} ${TAB(55, 'أنس مازن ديب', 'Anas Mazen Deeb')} In the plan “معالجة لبية وتاج للسن 16 / Root canal and crown, tooth 16” click **Print estimate** (طباعة التقدير). Crop to the dialog. Markers: 2 on the estimated total, 3 on **Print**. Close the dialog afterwards (do not print).`,
    },
    {
      id: 'treatments-register',
      device: 'desktop',
      alt: { ar: 'صفحة سجل العلاجات: البطاقات والبحث والتصفية بالحالة والفترة والطبيب وجدول البنود', en: 'The Treatments register: cards, search, status, period and doctor filters, and the table of items' },
      recipe: `${DESK} Route #/treatments and reload (it opens on This month, all statuses, all doctors). Wait for the cards to show figures. Page at its top. Capture the whole window. Markers: 2 on the search box, 3 on the **Group by patient** switch, 4 on **Export CSV**.`,
    },
    {
      id: 'treatments-procedures',
      device: 'desktop',
      alt: { ar: 'قائمة الإجراءات والأسعار مقسمة حسب الفئات مع السعر والمدة ومفتاح التفعيل', en: 'The Procedures & prices list grouped by category, with price, duration and the Active switch' },
      recipe: `${DESK} Route #/procedures and reload; page at its top (no search, no category, All). Capture the whole window. Markers: 1 on **New procedure**, 3 on the ⋮ button of the first row (فحص شامل وخطة علاج / Comprehensive oral exam), 4 on **Adjust prices**.`,
    },
    {
      id: 'treatments-bulk-price',
      device: 'desktop',
      alt: { ar: 'نافذة التعديل الجماعي للأسعار: زيادة 10% مع التقريب لأقرب 5 ومعاينة الأسعار الجديدة', en: 'The Bulk price change window: a 10% increase rounded to the nearest 5, with a preview of the new prices' },
      recipe: `${DESK} Route #/procedures and reload. Click the category chip “ترميم وحشوات / Restorative”, then **Adjust prices** (تعديل الأسعار). Keep Increase, Percentage and the value 10; set Rounding to “لأقرب 5 / Nearest 5”. Crop to the dialog. Markers: 4 on the Change / Method / Value / Rounding fields, 5 on **Apply change**. Cancel afterwards (do not apply).`,
    },
  ],
}

export default topic

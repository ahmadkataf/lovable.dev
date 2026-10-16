import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in
// store/scripts/shoot.mjs; the English pictures use the English clinic of shoot.mjs (englishClinic). Demo patients
// are named by their file number and invoices by their number, the same in every run and in both languages. Invoice
// ids are not: open an invoice by searching its number on #/invoices and clicking its row.
// No picture here saves anything: every dialog is closed with Cancel / Close.
// The invoices and payments pages remember their period per device (localStorage dentora.billing.period.*): the
// recipes say which period to click.
const DESK = 'Desktop 1440×900, demo clinic, clock fixed to Sunday 11 Oct 2026 11:40 (Asia/Damascus), trial bar hidden, signed in as the admin, as in store/scripts/shoot.mjs.'
const PHONE = 'Phone 390×844 (isMobile, hasTouch), demo clinic, same clock, trial bar hidden, signed in as the admin.'
const file = (n: number, ar: string, en: string) => `patient file #${n} (${ar} / ${en})`
const INV287 = 'Route #/invoices and reload, click the period **This month** (هذا الشهر), type “000287” in the search box and click the invoice number INV-000287 in its row (مريم يوسف البيطار / Mariam Youssef Bitar, 4 Oct 2026, $1,280, Partially paid). The invoice page opens at its top.'

const topic: GuideTopic = {
  slug: 'billing',
  order: 8,
  icon: 'receipt',
  title: { ar: 'الفواتير والمدفوعات', en: 'Invoices and payments' },
  summary: {
    ar: 'أصدر الفاتورة من العلاجات المنجزة، وسجّل الدفعات والمستردات واطبع إيصالاتها، وتابع حساب كل مريض وصندوق العيادة اليومي.',
    en: 'Issue invoices from completed treatments, record payments and refunds with printed receipts, and follow each patient’s account and the clinic’s daily cash.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'قائمة الفواتير', en: 'The invoices list' },
      text: {
        ar: [
          'افتح **الفواتير** من القائمة الجانبية، أو من الشريط السفلي على الهاتف. تعرض الصفحة فواتير الفترة المختارة: **اليوم** أو **هذا الأسبوع** أو **هذا الشهر** أو **الشهر الماضي** أو فترة **مخصص**.',
          'تلخص البطاقات الأربع فواتير الفترة: **إجمالي الفواتير**، و**المدفوع منها**، و**المستحق** عليها، و**عدد الفواتير** ومعه عدد المسودات.',
          'تحتها تبحث برقم الفاتورة أو اسم المريض، وتصفّي بالحالة: **غير مدفوعة** و**مدفوعة جزئياً** و**مدفوعة** و**مسودة** و**ملغاة**، وبالطبيب. انقر على أي فاتورة لتفتحها.',
        ],
        en: [
          'Open **Invoices** in the sidebar, or in the bottom bar on a phone. The page lists the invoices of the chosen period: **Today**, **This week**, **This month**, **Last month** or a **Custom** range.',
          'The four cards sum up that period: **Invoiced**, **Collected**, **Outstanding** and the number of **Invoices**, with drafts counted apart.',
          'Below them you can search by invoice number or patient name, and filter by status (**Unpaid**, **Partially paid**, **Paid**, **Draft**, **Cancelled**) and by doctor. Click any invoice to open it.',
        ],
      },
      tips: {
        ar: [
          'يتذكر البرنامج الفترة التي اخترتها على هذا الجهاز.',
          'في قائمة ⋮ لكل فاتورة: **فتح الفاتورة** و**تسجيل دفعة** و**طباعة الفاتورة**، ثم **إلغاء الفاتورة** أو **حذف المسودة**.',
          'تظهر الفاتورة غير المسددة في [التنبيهات](interface#notifications) بعد تاريخ استحقاقها، أو بعد 30 يوماً من تاريخها إن لم يكن لها تاريخ استحقاق.',
          'الفواتير والمدفوعات متاحة للمدير والأطباء وموظفي الاستقبال، ولا يراها المساعد. انظر [الأدوار والصلاحيات](staff#roles).',
          'في وضع القراءة فقط تستطيع فتح الفواتير وطباعتها، لكن لا يمكنك إصدار فاتورة أو تسجيل دفعة. انظر [الترخيص](licence).',
        ],
        en: [
          'Dentora remembers the period you chose on this device.',
          'Each invoice’s ⋮ menu has **Open invoice**, **Record payment** and **Print invoice**, then **Cancel invoice** or **Delete draft**.',
          'An unpaid invoice shows in [Notifications](interface#notifications) once its due date has passed, or 30 days after its date when it has no due date.',
          'Invoices and payments are open to the admin, doctors and reception; assistants do not see them. See [Roles and permissions](staff#roles).',
          'In read-only mode you can still open and print invoices, but you cannot issue one or record a payment. See [Licence](licence).',
        ],
      },
      shots: ['billing-invoices'],
    },
    {
      id: 'new-invoice',
      title: { ar: 'إصدار فاتورة', en: 'Issuing an invoice' },
      text: {
        ar: ['أسرع طريقة لفوترة العلاج زر **فوترة المنجز** في تبويب العلاجات، انظر [فوترة العمل المنجز](treatments#bill). وحين تريد أن تختار بنود الفاتورة بنفسك استعمل نافذة الفاتورة الجديدة.'],
        en: ['The quickest way to bill treatment is the **Bill completed** button in the Treatments tab: see [Billing completed work](treatments#bill). When you want to choose the lines yourself, use the new invoice window.'],
      },
      steps: {
        ar: [
          'انقر على **فاتورة جديدة** في صفحة الفواتير، أو في تبويب **الحساب** في ملف المريض.',
          'ابحث عن **المريض** بالاسم أو رقم الملف أو الهاتف واختره. يُختار **الطبيب** تلقائياً، ويمكنك تغييره.',
          'تنفتح لوحة **من العلاجات** وفيها علاجات المريض المنجزة غير المفوترة، محددةً كلها. انقر على **إضافة المحدد**، وبجانبه عدد البنود المحددة.',
          'أضف بنوداً أخرى إن شئت: **من قائمة الإجراءات** بنقرة على الإجراء، أو **سطر حر** تكتب وصفه وسعره بنفسك.',
          'عدّل في كل سطر **السن** و**الكمية** و**سعر الوحدة** و**الخصم** إن لزم. وأضف **خصم على الفاتورة** و**ملاحظات** تُطبع عليها.',
          'انقر على **إصدار الفاتورة**، فتأخذ رقمها التالي وتنفتح أمامك. أو انقر على **حفظ كمسودة** لتكملها لاحقاً.',
        ],
        en: [
          'Click **New invoice** on the Invoices page, or in the **Account** tab of the patient’s file.',
          'Search for the **Patient** by name, file number or phone and pick them. The **Doctor** is chosen for you; you can change it.',
          'The **From treatments** panel opens with the patient’s completed, unbilled treatments, all ticked. Click **Add selected**, which shows how many are ticked.',
          'Add other lines if needed: **From procedures** with one click on a procedure, or a **Free line** where you type the description and price yourself.',
          'Adjust each line’s **Tooth**, **Qty**, **Unit price** and **Discount** if needed. Add an **Invoice discount** and **Notes** to print on it.',
          'Click **Issue invoice**: it takes the next number and opens. Or click **Save as draft** to finish it later.',
        ],
      },
      tips: {
        ar: [
          'تأخذ خانة **الضريبة %** نسبة العيادة من [الإعدادات](settings#invoices-numbering) تلقائياً، ويمكن تغييرها لهذه الفاتورة.',
          'المسودة لا تأخذ رقماً، وتظهر بكلمة «مسودة» حتى تُصدرها، ولا تدخل في حساب المريض. افتحها وانقر على **مراجعة وإصدار**.',
          'السطر المأخوذ من العلاجات يحمل إشارة «من خطة العلاج» ويرتبط بالعلاج، فلا يُفوتر مرتين.',
          '**تاريخ الاستحقاق** اختياري، ولا يسبق تاريخ الإصدار.',
          'إذا أغلقت النافذة وفيها بنود لم تُحفظ يسألك البرنامج **تجاهل هذه الفاتورة؟** فاختر **متابعة التعديل** للعودة إليها.',
          'إذا كان للمريض رصيد دائن يُسدَّد به جزء من الفاتورة أو كلها لحظة إصدارها.',
        ],
        en: [
          'The **Tax %** box takes the clinic’s rate from [Settings](settings#invoices-numbering) automatically; you can change it for this invoice.',
          'A draft takes no number and shows as “Draft” until you issue it, and it does not count in the patient’s account. Open it and click **Review & issue**.',
          'A line taken from treatments carries a “From the treatment plan” tag and is linked to that treatment, so it cannot be billed twice.',
          'The **Due date** is optional and cannot be before the issue date.',
          'If you close the window with unsaved lines, Dentora asks **Discard this invoice?**; choose **Keep editing** to go back to it.',
          'If the patient has credit on account, it settles part or all of the invoice as soon as it is issued.',
        ],
      },
      shots: ['billing-invoice-form', 'billing-invoice-lines'],
    },
    {
      id: 'invoice-page',
      title: { ar: 'صفحة الفاتورة', en: 'The invoice page' },
      text: {
        ar: ['تعرض صفحة الفاتورة الورقة كما يستلمها المريض: ترويسة العيادة، وبيانات المريض والطبيب، والبنود، والإجماليات، وختم حالة الدفع، وجدول الدفعات المستلمة. وفوقها شريط يلخص **الإجمالي** و**المدفوع** و**الرصيد المستحق**.'],
        en: ['The invoice page shows the sheet as the patient receives it: the clinic letterhead, the patient and doctor, the lines, the totals, a payment-status stamp and the payments received. Above it, a bar sums up the **Total**, **Paid** and **Balance due**.'],
      },
      steps: {
        ar: [
          'انقر على **تسجيل دفعة** لتسجيل ما دفعه المريض على هذه الفاتورة.',
          'انقر على **طباعة** لطباعة الفاتورة أو حفظها بصيغة PDF.',
          'انقر على **واتساب** لترسل للمريض رسالة فيها رقم الفاتورة وإجماليها والمبلغ المتبقي.',
          'في قائمة ⋮ تجد **تعديل** و**إرسال عبر واتساب** و**استرداد مبلغ** و**إلغاء الفاتورة**.',
        ],
        en: [
          'Click **Record payment** to record what the patient paid on this invoice.',
          'Click **Print** to print the invoice or save it as a PDF.',
          'Click **WhatsApp** to send the patient a message with the invoice number, the total and the balance due.',
          'The ⋮ menu has **Edit**, **Send via WhatsApp**, **Refund** and **Cancel invoice**.',
        ],
      },
      tips: {
        ar: [
          'لا تُعدَّل فاتورة عليها دفعات. وفي تعديل فاتورة صادرة يبقى المريض ثابتاً.',
          '**إلغاء الفاتورة** يُبقي رقمها في السجل، وتعود علاجاتها متاحة للفوترة. وإن كانت عليها دفعات تعود إلى حساب المريض، فتُسدَّد بها فواتيره المفتوحة الأخرى أولاً، والباقي رصيد دائن له. أما الحذف فللمسودات وحدها، عبر **حذف المسودة**.',
          'تُطبع الفاتورة بعنوان «فاتورة ضريبية» مع الرقم الضريبي للعيادة حين تكون عليها ضريبة والرقم الضريبي مسجلاً في [الإعدادات](settings#invoices-numbering). ويُطبع في أسفلها تذييل الفاتورة، أو عبارة شكر إن تركته فارغاً.',
          'رسالة واتساب نصية ولا تُرفق ملف الفاتورة. لإرسال الفاتورة نفسها احفظها PDF ثم شاركها من واتساب.',
          'يعمل زر واتساب حين يكون للمريض رقم هاتف، ولا يظهر للمسودات والفواتير الملغاة.',
        ],
        en: [
          'An invoice with payments cannot be edited. When you edit an issued invoice, the patient stays fixed.',
          '**Cancel invoice** keeps its number on record, and its treatments can be billed again. Payments on it go back to the patient’s account, where they settle the other open invoices first; the rest is credit. Only drafts can be deleted, with **Delete draft**.',
          'The sheet is titled “Tax invoice”, with the clinic’s tax number, when the invoice carries tax and the tax number is set in [Settings](settings#invoices-numbering). The invoice footer is printed at the bottom, or a thank-you line if you left it empty.',
          'The WhatsApp message is text only; it does not attach the invoice. To send the invoice itself, save it as a PDF and share that from WhatsApp.',
          'The WhatsApp button works when the patient has a phone number, and is not offered for drafts and cancelled invoices.',
        ],
      },
      shots: ['billing-invoice-page'],
    },
    {
      id: 'payment',
      title: { ar: 'تسجيل دفعة وطباعة الإيصال', en: 'Recording a payment and printing the receipt' },
      text: {
        ar: ['سجّل كل مبلغ تستلمه، ليبقى حساب المريض وصندوق العيادة صحيحين. لكل دفعة إيصال برقم متسلسل، مثل R-000379.'],
        en: ['Record every amount you receive, so the patient’s account and the clinic’s cash stay right. Each payment gets a receipt with a running number, such as R-000379.'],
      },
      steps: {
        ar: [
          'افتح نافذة **تسجيل دفعة** من صفحة الفاتورة، أو من زر **دفعة** في ملف المريض، أو من **دفعة جديدة** في زر **جديد** أعلى الشاشة أو في صفحة المدفوعات.',
          'اختر المريض إن لم يكن محدداً. يظهر **حساب المريض**: إجمالي فواتيره وما دفعه وما بقي عليه.',
          'تحت **تُسجَّل على** اختر الفاتورة المفتوحة، أو **دفعة على الحساب**. حين تختار فاتورة يُملأ **المبلغ** بالمتبقي عليها.',
          'عدّل **المبلغ** إن دفع المريض غيره، واختر **طريقة الدفع**: **نقداً** أو **بطاقة** أو **تحويل** أو **تأمين** أو **محفظة إلكترونية** أو **أخرى**.',
          'أضف **المرجع** إن وُجد، كرقم الحوالة أو آخر أرقام البطاقة، ثم انقر على **حفظ الدفعة**.',
          'تظهر رسالة **تم تسجيل الدفعة** ومعها رقم الإيصال. انقر فيها على **طباعة الإيصال** لعرضه وطباعته.',
        ],
        en: [
          'Open the **Record payment** window from the invoice page, from the **Payment** button in the patient’s file, or from **New payment** in the **New** button at the top or on the Payments page.',
          'Pick the patient if none is set. The **Patient account** shows what they were invoiced, what they paid and what they owe.',
          'Under **Apply to**, choose the open invoice, or **Payment on account**. When you choose an invoice, the **Amount** is filled with its balance.',
          'Change the **Amount** if the patient paid something else, and choose the **Payment method**: **Cash**, **Card**, **Transfer**, **Insurance**, **E-wallet** or **Other**.',
          'Add a **Reference** if there is one, such as a transfer number or the last card digits, then click **Save payment**.',
          'A **Payment recorded** message shows the receipt number. Click **Print receipt** in it to see and print the receipt.',
        ],
      },
      tips: {
        ar: [
          'إذا دفع المريض أكثر من المتبقي على الفاتورة يوضح لك مربع **هكذا يُوزَّع المبلغ** ما يذهب إليها، وما يسدد فواتيره المفتوحة الأخرى من الأقدم، وما يبقى رصيداً دائناً له.',
          'الرصيد الدائن يسدد تلقائياً ما يصدر للمريض من فواتير لاحقاً.',
          'لا يقبل تاريخ الدفعة يوماً بعد اليوم. سجّل الشيك المؤجل يوم صرفه.',
          'يذكر الإيصال المبلغ وطريقة الدفع والفاتورة التي سُدّدت والمتبقي عليها، واسم من استلم المبلغ، وفيه مكان للتوقيع. وتجد الإيصالات لاحقاً في صفحة **المدفوعات** وفي تبويب **الحساب** في ملف المريض.',
        ],
        en: [
          'If the patient pays more than the invoice balance, the **Where this payment goes** box shows what goes to it, what settles their other open invoices (oldest first), and what stays as credit.',
          'Credit settles the patient’s next invoices automatically.',
          'A payment cannot be dated after today. Record a post-dated cheque on the day it is cashed.',
          'The receipt shows the amount, the method, the invoice it paid and what is left on it, and who received the money, with room for a signature. You find receipts later on the **Payments** page and in the patient’s **Account** tab.',
        ],
      },
      shots: ['billing-payment', 'billing-receipt'],
    },
    {
      id: 'refund',
      title: { ar: 'إعادة مبلغ للمريض', en: 'Refunding a patient' },
      text: {
        ar: ['حين تعيد مالاً للمريض سجّله استرداداً، لتبقى الفاتورة والصندوق وحسابه متطابقة.'],
        en: ['When you give money back to a patient, record it as a refund, so the invoice, the cash and their account all agree.'],
      },
      steps: {
        ar: [
          'في صفحة الفاتورة افتح قائمة ⋮ واختر **استرداد مبلغ**، أو فعّل **استرداد (مبلغ مُعاد للمريض)** في نافذة تسجيل الدفعة.',
          'تحت **يُعاد من** اختر الفاتورة التي دُفع عليها المبلغ، أو **من رصيد المريض الدائن**.',
          'اكتب **المبلغ المُعاد**. يذكر البرنامج تحت الخانة أقصى ما يمكن إعادته.',
          'إذا كان المال يُعاد لأن العمل لم يُنجز أو لأن السعر خُفّض، فأبقِ خيار «خفض الفاتورة … (إشعار دائن)» محدداً، فلا يبقى على المريض شيء.',
          'اختر **طريقة الدفع** التي أعدت بها المال، ثم انقر على **حفظ الاسترداد**.',
        ],
        en: [
          'On the invoice page open the ⋮ menu and choose **Refund**, or turn on **Refund (money returned to the patient)** in the payment window.',
          'Under **Refund from**, choose the invoice the money was paid on, or **From the patient’s credit**.',
          'Type the **Amount refunded**. The most you can refund is shown under the box.',
          'If the money goes back because the work was not done or the price was lowered, keep the “Lower invoice … (credit note)” option ticked, so the patient owes nothing.',
          'Choose the **Payment method** you used to pay back, then click **Save refund**.',
        ],
      },
      tips: {
        ar: [
          'إذا ألغيت تحديد الإشعار الدائن ينبهك البرنامج بأن الفاتورة ستعود غير مسدَّدة بالمبلغ المُعاد، ويصبح على المريض دفعه.',
          'لا يمكن إعادة أكثر مما دُفع على الفاتورة مضافاً إليه رصيد المريض الدائن.',
          'يُطبع للاسترداد إيصال خاص بعنوان «إيصال استرداد».',
          'تظهر المستردات في صفحة **المدفوعات** بشارة **استرداد**، وتُطرح من صافي المقبوضات.',
        ],
        en: [
          'If you untick the credit note, Dentora warns that the invoice will show the refunded amount as due again, and the patient will owe it.',
          'You cannot refund more than was paid on the invoice plus the patient’s credit.',
          'A refund prints its own receipt, titled “Refund receipt”.',
          'Refunds show on the **Payments** page with a **Refund** badge and come off the net collected.',
        ],
      },
      shots: ['billing-refund'],
    },
    {
      id: 'payments',
      title: { ar: 'المدفوعات وتقرير الصندوق', en: 'Payments and the cash report' },
      text: {
        ar: ['صفحة **المدفوعات** سجل الصندوق: كل دفعة مستلمة في سطر، مع رقم إيصالها والفاتورة التي سددتها وطريقة الدفع ومن استلمها. تفتح أول مرة على دفعات **اليوم**، ثم تتذكر الفترة التي تختارها.'],
        en: ['The **Payments** page is the cash ledger: one row per payment received, with its receipt number, the invoice it paid, the method and who received it. It first opens on **Today**, then remembers the period you choose.'],
      },
      steps: {
        ar: [
          'افتح **المدفوعات** من القائمة الجانبية، أو من زر **المدفوعات** في صفحة الفواتير.',
          'اختر الفترة، ثم صفِّ بالموظف المستلم أو بطريقة الدفع، أو ابحث باسم المريض أو رقم الإيصال أو رقم الفاتورة.',
          'انقر على أي سطر، أو على زر الطابعة في آخره، لتفتح إيصاله وتطبعه. أما رقم الفاتورة واسم المريض في السطر فيفتحان الفاتورة وملف المريض.',
          'في نهاية اليوم انقر على **تقرير الصندوق**، ثم على **طباعة**.',
        ],
        en: [
          'Open **Payments** in the sidebar, or with the **Payments** button on the Invoices page.',
          'Choose the period, then filter by the staff member who received the money or by payment method, or search by patient, receipt or invoice number.',
          'Click any row, or the printer button at its end, to open its receipt and print it. The invoice number and the patient’s name in the row open the invoice and the patient file instead.',
          'At the end of the day click **Daily cash report**, then **Print**.',
        ],
      },
      tips: {
        ar: [
          'البطاقات: **صافي المقبوضات** بعد المستردات مع عدد الدفعات، و**نقداً**، و**بطاقة وتحويل**، و**المستردات**.',
          'يجمع تقرير الصندوق الإيصالات حسب طريقة الدفع، مع مجموع كل طريقة والإجمالي العام، ويتبع الفترة والتصفية الظاهرة. وفي أسفله اسم من أعدّه ووقت الطباعة وسطرا توقيع.',
          'حذف الدفعة لمدير العيادة وحده، بزر سلة المهملات في سطرها. يُعاد بعدها احتساب الفواتير التي سددتها، ويبقى الحذف مسجلاً في سجل النشاطات.',
          'الدفعة التي أُعيد جزء من رصيدها للمريض لا تُحذف قبل حذف إيصال الاسترداد.',
        ],
        en: [
          'The cards: **Net collected** after refunds with the number of payments, **Cash**, **Card & transfer** and **Refunds**.',
          'The cash report groups the receipts by payment method, with a subtotal per method and a grand total, and follows the period and filters on screen. At the bottom are who prepared it, when it was printed, and two signature lines.',
          'Only the clinic admin can delete a payment, with the bin button on its row. The invoices it paid are then recalculated, and the deletion stays in the activity log.',
          'A payment whose credit was partly refunded cannot be deleted before the refund receipt.',
        ],
      },
      shots: ['billing-payments', 'billing-cash-report'],
    },
    {
      id: 'account',
      title: { ar: 'حساب المريض وكشف الحساب', en: 'The patient’s account and statement' },
      text: {
        ar: ['في ملف كل مريض تبويب **الحساب**، وفيه ثلاث بطاقات: **إجمالي الفواتير** و**المدفوع** و**المتبقي على المريض**، أو **رصيد دائن للمريض** حين يكون له مال عند العيادة. وتحتها قائمة فواتيره وقائمة دفعاته.'],
        en: ['Every patient file has an **Account** tab with three cards: **Invoiced**, **Paid** and **Balance due**, or **Patient credit** when the clinic holds money for them. Below them are the patient’s invoices and payments.'],
      },
      steps: {
        ar: [
          'افتح ملف المريض، ثم تبويب **الحساب**.',
          'انقر على **فاتورة جديدة** أو **دفعة جديدة** لتبدأ من حسابه مباشرة.',
          'انقر على **كشف حساب** لترى فواتيره ودفعاته بترتيب التاريخ، مع الرصيد بعد كل حركة.',
          'انقر على **طباعة** لتسلّم الكشف للمريض أو تحفظه PDF.',
        ],
        en: [
          'Open the patient’s file, then the **Account** tab.',
          'Click **New invoice** or **New payment** to start right from their account.',
          'Click **Account statement** to see their invoices and payments in date order, with the balance after each entry.',
          'Click **Print** to hand the statement to the patient or save it as a PDF.',
        ],
      },
      tips: {
        ar: [
          'المسودات والفواتير الملغاة لا تدخل في الرصيد. وحين يُسدَّد الحساب كله تظهر عبارة «الحساب مسدَّد بالكامل».',
          'انقر على دفعة في القائمة لتفتح إيصالها.',
          'يظهر المبلغ المستحق أيضاً في رأس ملف المريض وفي قائمة المرضى. انظر [ملف المريض](patients#profile).',
          'على الهاتف يجمع الكشف المدين والدائن في عمود واحد.',
          'لترى كل المرضى الذين عليهم مبالغ معاً افتح تقرير [الذمم المستحقة](reports#outstanding).',
        ],
        en: [
          'Drafts and cancelled invoices do not count in the balance. When everything is paid, the tab says “Account fully settled”.',
          'Click a payment in the list to open its receipt.',
          'The balance also shows at the top of the patient’s file and in the patients list. See [The patient file](patients#profile).',
          'On a phone, the statement merges debit and credit into one column.',
          'To see every patient who owes money in one list, open the [Outstanding balances](reports#outstanding) report.',
        ],
      },
      shots: ['billing-account', 'billing-statement'],
    },
    {
      id: 'print-share',
      title: { ar: 'الطباعة وPDF وواتساب على ويندوز وأندرويد', en: 'Printing, PDF and WhatsApp on Windows and Android' },
      text: {
        ar: [
          'تُطبع الفواتير والإيصالات وكشوف الحساب وتقرير الصندوق بتصميم مرتب يحمل ترويسة العيادة وشعارها من [الإعدادات](settings#clinic-details)، بالعربية أو الإنجليزية حسب لغة البرنامج.',
          'وفي الهاتف تتغير بعض الأماكن: زر **فاتورة جديدة** عائم في أسفل قائمة الفواتير، وفي صفحة الفاتورة يصبح زر الطباعة أيقونة، وتجد **إرسال عبر واتساب** في قائمة ⋮.',
        ],
        en: [
          'Invoices, receipts, statements and the cash report print as tidy sheets with the clinic letterhead and logo from [Settings](settings#clinic-details), in Arabic or English as the app is set.',
          'On a phone a few things move: **New invoice** floats at the bottom of the invoices list, the print button on the invoice page is an icon, and **Send via WhatsApp** is in the ⋮ menu.',
        ],
      },
      tips: {
        ar: [
          'على ويندوز تُفتح نافذة الطباعة في ويندوز: اختر طابعتك، أو «Microsoft Print to PDF» لتحفظ ملف PDF.',
          'على أندرويد تُفتح شاشة الطباعة في النظام: اختر طابعة يصل إليها الهاتف، أو خيار الحفظ بصيغة PDF.',
          'يحمل ملف PDF اسماً واضحاً، مثل «فاتورة INV-000287 — مريم يوسف البيطار».',
          'على أندرويد يفتح زر واتساب محادثة المريض في تطبيق واتساب. وعلى ويندوز يُفتح الرابط في المتصفح لتكمل في واتساب ويب أو تطبيق واتساب على الحاسوب.',
          'تُرسل رسالة واتساب إلى رقم المريض، ويُضاف إلى الأرقام المحلية رمز **الدولة** المختارة في [بيانات العيادة](settings#clinic-details).',
        ],
        en: [
          'On Windows the Windows print dialog opens: choose your printer, or “Microsoft Print to PDF” to save a PDF file.',
          'On Android the system print screen opens: choose a printer the phone can reach, or the save-as-PDF option.',
          'The PDF gets a clear name, such as “Invoice INV-000287 — Mariam Youssef Bitar”.',
          'On Android the WhatsApp button opens the patient’s chat in the WhatsApp app. On Windows the link opens in the browser, where you continue in WhatsApp Web or the WhatsApp desktop app.',
          'The WhatsApp message goes to the patient’s number; local numbers get the code of the **Country** chosen in the [clinic details](settings#clinic-details).',
        ],
      },
      shots: ['billing-phone'],
    },
  ],
  shots: [
    {
      id: 'billing-invoices',
      device: 'desktop',
      alt: { ar: 'قائمة الفواتير: الفترة والبطاقات الأربع والبحث والتصفية بالحالة والطبيب وجدول الفواتير', en: 'The invoices list: the period, the four cards, search, status and doctor filters, and the table of invoices' },
      recipe: `${DESK} Route #/invoices and reload; click the period **This month** (هذا الشهر). No search, status All, all doctors. Wait for the cards to show figures. Page at its top. Capture the whole window. No markers.`,
    },
    {
      id: 'billing-invoice-form',
      device: 'desktop',
      alt: { ar: 'نافذة فاتورة جديدة: المريض والطبيب والتاريخ، ولوحة «من العلاجات» وفيها ثلاثة علاجات منجزة محددة', en: 'The New invoice window: patient, doctor and dates, and the From treatments panel with three completed treatments ticked' },
      recipe: `${DESK} Route #/invoices and reload. Click **New invoice** (فاتورة جديدة). In the patient search type “غادة خوري” (EN: “Ghada Khoury”) and press Enter to pick ${file(31, 'غادة خوري', 'Ghada Khoury')}. The From treatments panel opens with 3 items ticked (scaling, bitewing X-rays, periodic exam). Crop to the dialog. Markers: 2 on the chosen patient card, 3 on **Add selected (3)**, 4 on **From procedures** and **Free line**, 6 on **Issue invoice**. Keep the dialog open for billing-invoice-lines.`,
    },
    {
      id: 'billing-invoice-lines',
      device: 'desktop',
      alt: { ar: 'بنود الفاتورة: ثلاثة أسطر من العلاجات وسطر من قائمة الإجراءات، والإجماليات مع خصم على الفاتورة', en: 'Invoice lines: three from treatments and one from the procedure list, and the totals with an invoice discount' },
      recipe: `${DESK} Continue from billing-invoice-form: click **Add selected (3)**, then **From procedures** (من قائمة الإجراءات), type “فلورايد” (EN: “Fluoride”) and click “تطبيق فلورايد (ورنيش) / Fluoride varnish”; close the panel with its ×. Type 5 in **Invoice discount**. Scroll the dialog body so the lines table and the totals panel are in view. Crop to the dialog. Markers: 5 on the first line’s Tooth/Qty/Unit price/Discount boxes and on Invoice discount, 6 on **Issue invoice** and **Save as draft**. Close with Cancel → **Discard** (do not save).`,
    },
    {
      id: 'billing-invoice-page',
      device: 'desktop',
      alt: { ar: 'صفحة فاتورة مدفوعة جزئياً: شريط الإجمالي والمدفوع والمتبقي، وأزرار تسجيل دفعة وطباعة وواتساب، وورقة الفاتورة', en: 'A partly paid invoice: the total / paid / balance bar, the Record payment, Print and WhatsApp buttons, and the invoice sheet' },
      recipe: `${DESK} ${INV287} Capture the whole window. Markers: 1 on **Record payment**, 2 on **Print**, 3 on **WhatsApp**, 4 on the ⋮ button.`,
    },
    {
      id: 'billing-payment',
      device: 'desktop',
      alt: { ar: 'نافذة تسجيل دفعة: حساب المريض والفاتورة المختارة ومبلغ 700 يُوزَّع بين الفاتورة ورصيد دائن', en: 'The Record payment window: the patient account, the chosen invoice, and 700 split between the invoice and credit' },
      caption: { ar: 'دفع المريض أكثر من المتبقي، فبقي الفرق رصيداً دائناً له.', en: 'The patient paid more than the balance; the difference stays as credit.' },
      recipe: `${DESK} ${INV287} Click **Record payment** (تسجيل دفعة). INV-000287 is chosen and the Amount shows 640; replace it with 700. The **Where this payment goes** box shows 640 to INV-000287 and 60 as credit. Crop to the dialog. Markers: 3 on the INV-000287 choice, 4 on the Amount and Payment method fields, 5 on **Save payment**. Cancel afterwards (do not save).`,
    },
    {
      id: 'billing-receipt',
      device: 'desktop',
      alt: { ar: 'إيصال استلام: رقم الإيصال والمبلغ ومن استلمه وطريقة الدفع والفاتورة', en: 'A payment receipt: receipt number, amount, who paid, method and invoice' },
      recipe: `${DESK} Route #/payments and reload; click the period **Today** (اليوم). On the row of receipt R-000378 (سامر يوسف شهاب / Samer Youssef Shehab, INV-000305, cash) click the printer button at the end of the row (Print receipt; a click on the invoice number would open the invoice instead). Crop to the receipt dialog. Markers: 6 on **Print**. Close afterwards.`,
    },
    {
      id: 'billing-refund',
      device: 'desktop',
      alt: { ar: 'نافذة تسجيل استرداد: المبلغ المُعاد وأقصى ما يمكن إعادته وخيار الإشعار الدائن', en: 'The Record a refund window: the amount refunded, the most that can be refunded, and the credit note option' },
      recipe: `${DESK} ${INV287} Open the ⋮ menu and choose **Refund** (استرداد مبلغ). INV-000287 is chosen under Refund from. Type 100 in the amount; the credit note box “خفض الفاتورة INV-000287 بمقدار 100 $ (إشعار دائن) / Lower invoice INV-000287 by $100 (credit note)” appears, ticked. The dialog scrolls itself to the amount; keep it so. Crop to the dialog. Markers: 3 on the amount field and the “up to” hint, 4 on the credit note box, 5 on **Save refund**. Cancel afterwards (do not save).`,
    },
    {
      id: 'billing-payments',
      device: 'desktop',
      alt: { ar: 'صفحة المدفوعات لليوم: البطاقات وتصفية الموظف وطريقة الدفع وجدول الإيصالات', en: 'The Payments page for today: the cards, staff and method filters, and the table of receipts' },
      recipe: `${DESK} Route #/payments and reload; click the period **Today** (اليوم). No search, All staff, All methods. Page at its top. Capture the whole window. Markers: 2 on the search box, the All staff list and the method chips, 3 on the printer button of the first row, 4 on **Daily cash report** (تقرير الصندوق).`,
    },
    {
      id: 'billing-cash-report',
      device: 'desktop',
      alt: { ar: 'تقرير الصندوق لليوم: الإيصالات مجمعة حسب طريقة الدفع مع المجاميع والإجمالي العام', en: 'Today’s cash report: receipts grouped by payment method, with subtotals and the grand total' },
      recipe: `${DESK} Route #/payments and reload; click the period **Today**, then **Daily cash report** (تقرير الصندوق). Crop to the dialog. Markers: 4 on **Print**. Close afterwards.`,
    },
    {
      id: 'billing-account',
      device: 'desktop',
      alt: { ar: 'تبويب الحساب في ملف المريض: البطاقات الثلاث وأزرار فاتورة جديدة ودفعة جديدة وكشف حساب وقائمة الفواتير', en: 'The Account tab of a patient file: the three cards, the New invoice, New payment and Account statement buttons, and the invoices' },
      recipe: `${DESK} Open ${file(19, 'مريم يوسف البيطار', 'Mariam Youssef Bitar')} at #/patients/<id>?tab=billing and reload; scroll so the tab bar (.pt-tabs) sits just under the top bar. Capture the whole window. Markers: 1 on the **Account** tab, 2 on **New invoice** and **New payment**, 3 on **Account statement**.`,
    },
    {
      id: 'billing-statement',
      device: 'desktop',
      alt: { ar: 'كشف حساب المريض: الفواتير والدفعات بترتيب التاريخ مع المدين والدائن والرصيد بعد كل حركة', en: 'A patient’s account statement: invoices and payments in date order with debit, credit and the balance after each entry' },
      recipe: `${DESK} Same patient and tab as billing-account. Click **Account statement** (كشف حساب). Crop to the dialog. Markers: 4 on **Print**. Close afterwards.`,
    },
    {
      id: 'billing-phone',
      device: 'phone',
      alt: { ar: 'فاتورة على الهاتف: زر تسجيل دفعة وأيقونة الطباعة وقائمة ⋮ فوق الورقة', en: 'An invoice on a phone: Record payment, the print icon and the ⋮ menu above the sheet' },
      recipe: `${PHONE} Route #/invoices and reload, tap the period **This month**, type “000287” in the search box and tap the card INV-000287 (Mariam Youssef Bitar). Page at its top. Capture the whole screen. No markers.`,
    },
  ],
}

export default topic

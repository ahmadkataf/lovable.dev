import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in
// store/scripts/shoot.mjs; the English pictures use the English clinic of shoot.mjs (englishClinic). Demo patients
// are named by their file number, the same in every run and in both languages: look the id up with
// window.__dentora.db.patients (fileNo). The demo has 13 lab orders (LAB-000001…LAB-000013): on 11 Oct 2026 one is
// in progress (#7, due today), one is a remake (#20, due tomorrow), one is sent (#55), one is a draft (#36), the
// others fitted or cancelled. No picture here saves anything.
const DESK = 'Desktop 1440×900, demo clinic, clock fixed to Sunday 11 Oct 2026 11:40 (Asia/Damascus), trial bar hidden, signed in as the admin, as in store/scripts/shoot.mjs.'
const PHONE = 'Phone 390×844 (isMobile, hasTouch), demo clinic, same clock, trial bar hidden, signed in as the admin.'
const file = (n: number, ar: string, en: string) => `patient file #${n} (${ar} / ${en})`
const LAB = 'Route #/lab and reload (status All, all doctors, no due or lab filter, no search).'

const topic: GuideTopic = {
  slug: 'lab',
  order: 10,
  icon: 'flaskConical',
  title: { ar: 'المخبر', en: 'Dental lab' },
  summary: {
    ar: 'سجّل كل عمل ترسله إلى المخبر، وتابع حالته من الإرسال حتى التركيب، واعرف المتأخر قبل موعد المريض، ودع تكلفته تدخل المصروفات تلقائياً.',
    en: 'Record every case you send to the lab, follow it from sending to fitting, spot late work before the patient’s visit, and let its cost reach your expenses by itself.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'لوحة المخبر', en: 'The lab board' },
      text: {
        ar: [
          'افتح **المخبر** من القائمة الجانبية. هنا كل الأعمال التي ترسلها إلى المخابر، كالتيجان والجسور والقشور والأطقم، من الإرسال حتى التركيب.',
          'في الأعلى أربع بطاقات: **طلبات مفتوحة** مع عدد ما في المخبر وما ينتظر التركيب، و**مستحقة هذا الأسبوع**، و**متأخرة عن موعدها**، و**تكاليف المخبر هذا الشهر**.',
          'تحتها تصفّي الطلبات بالحالة أو الطبيب أو المخبر، أو تبحث باسم المريض أو المخبر أو رقم السن. تأتي الطلبات المتأخرة أولاً، ثم الأقرب موعداً.',
        ],
        en: [
          'Open **Lab** in the sidebar. Here is every case you send to dental labs, such as crowns, bridges, veneers and dentures, from sending to fitting.',
          'Four cards sit at the top: **Open orders**, with how many are at the lab and how many wait to be fitted, **Due this week**, **Overdue** and **Lab costs this month**.',
          'Below them you filter the orders by status, doctor or lab, or search by patient, lab or tooth number. Late orders come first, then the soonest due.',
        ],
      },
      tips: {
        ar: [
          'انقر على بطاقة **متأخرة عن موعدها** أو **مستحقة هذا الأسبوع** لعرض تلك الطلبات وحدها، وانقر عليها مرة أخرى لإلغاء التصفية.',
          'يظهر موعد التسليم بالأحمر حين يتأخر الطلب، وبالبرتقالي حين يحلّ خلال يومين، مع كلمة «اليوم» أو «غداً».',
          'الأعمال المتأخرة والمستحقة اليوم تظهر أيضاً في [التنبيهات](interface#notifications) وفي [الشاشة الرئيسية](dashboard#alerts).',
          'المخبر متاح للمدير والأطباء والمساعدين، ولا يراه موظف الاستقبال، انظر [الأدوار والصلاحيات](staff#roles). وعلى الهاتف تظهر الطلبات بطاقات، وتجد **المخبر** تحت **المزيد** في الشريط السفلي.',
          'في وضع القراءة فقط تستطيع عرض الطلبات وطباعة أوامر العمل، لكن لا يمكنك إضافة طلب أو تغيير حالته. انظر [الترخيص](licence).',
        ],
        en: [
          'Click the **Overdue** or **Due this week** card to show only those orders, and click it again to clear the filter.',
          'A due date turns red when the order is late, and orange when it falls within two days, with “Today” or “Tomorrow”.',
          'Late work and work due today also show in [Notifications](interface#notifications) and on the [Dashboard](dashboard#alerts).',
          'The lab is open to the admin, doctors and assistants; reception does not see it (see [Roles and permissions](staff#roles)). On a phone the orders show as cards, and **Lab** is under **More** in the bottom bar.',
          'In read-only mode you can still view the orders and print lab slips, but you cannot add an order or change its status. See [Licence](licence).',
        ],
      },
      shots: ['lab-board', 'lab-phone'],
    },
    {
      id: 'new-order',
      title: { ar: 'تسجيل طلب مخبري', en: 'Recording a lab order' },
      text: {
        ar: ['سجّل الطلب يوم ترسل الطبعة أو العمل إلى المخبر، لتتابع حالته وموعد تسليمه وتكلفته.'],
        en: ['Record the order on the day the impression or case goes to the lab, to follow its status, due date and cost.'],
      },
      steps: {
        ar: [
          'انقر على **طلب مخبري جديد** في صفحة المخبر، أو في تبويب **المخبر** في ملف المريض.',
          'اختر **المريض** و**الطبيب**، واكتب **اسم المخبر** أو اختره من المخابر التي تعاملت معها من قبل.',
          'في قسم **العمل المطلوب** اختر **نوع العمل**، ثم **اللون** من دليل ألوان VITA، و**المادة**، مثل الزيركون أو الإيماكس.',
          'انقر على الأسنان المشمولة بالعمل، أو على **الفك العلوي** أو **الفك السفلي** لتحديد الفك كله. واترك الأسنان دون تحديد للأطقم الكاملة والواقيات.',
          'في قسم **المواعيد والتكلفة** يكون **تاريخ الإرسال** اليوم و**موعد التسليم** بعد 7 أيام. غيّره، أو انقر على **+5 أيام** أو **+7 أيام** أو **+10 أيام** أو **+14 يوماً**.',
          'اكتب **تكلفة المخبر**، واربط الطلب إن شئت بعمل من خطة العلاج في خانة **ربط بعمل من خطة العلاج**، وأضف **ملاحظات** للمخبر، ثم انقر على **حفظ الطلب**.',
        ],
        en: [
          'Click **New lab order** on the Lab page, or in the **Lab** tab of the patient’s file.',
          'Choose the **Patient** and **Doctor**, and type the **Lab name** or pick one of the labs you used before.',
          'Under **Work requested** choose the **Type of work**, then the **Shade** from the VITA guide, and the **Material**, such as zirconia or e.max.',
          'Click the teeth included in the work, or **Upper arch** or **Lower arch** to take the whole arch. Leave the teeth empty for full dentures and night guards.',
          'Under **Dates & cost**, **Sent on** is today and the **Due date** is 7 days later. Change it, or click **+5 days**, **+7 days**, **+10 days** or **+14 days**.',
          'Type the **Lab cost**, link the order to a planned treatment in **Link to a treatment plan item** if you wish, add **Notes** for the lab, then click **Save order**.',
        ],
      },
      tips: {
        ar: [
          'تبدأ حالة الطلب الجديد **مرسل**. اختر **مسودة** في خانة **الحالة** إن لم ترسله بعد.',
          'إذا ربطت الطلب ببند على سن ولم تحدد أسناناً، يُحدَّد سن البند تلقائياً.',
          'لا يقبل البرنامج موعد تسليم قبل تاريخ الإرسال.',
          'يحصل كل طلب على رقم مرجعي متسلسل، مثل LAB-000014، يُطبع على أمر العمل.',
          'لا تدخل التكلفة في المصروفات حتى تستلم العمل. انظر [متابعة الطلب حتى التركيب](lab#status).',
        ],
        en: [
          'A new order starts as **Sent**. Choose **Draft** in the **Status** field if it has not gone yet.',
          'If you link the order to an item on a tooth and pick no teeth, the item’s tooth is selected for you.',
          'Dentora does not accept a due date before the sent date.',
          'Each order gets a running reference, such as LAB-000014, printed on the lab slip.',
          'The cost does not reach your expenses until you receive the work. See [Following an order to fitting](lab#status).',
        ],
      },
      shots: ['lab-form', 'lab-form-dates'],
    },
    {
      id: 'status',
      title: { ar: 'متابعة الطلب حتى التركيب', en: 'Following an order to fitting' },
      text: {
        ar: ['يمر الطلب بالمراحل: **مسودة** ثم **مرسل** ثم **قيد العمل** ثم **مستلم** ثم **مركّب**، وقد يصبح **إعادة عمل** أو **ملغى**. وفي كل سطر زر يحمل اسم الخطوة التالية.'],
        en: ['An order moves through **Draft**, **Sent**, **In progress**, **Received** and **Fitted**, and may become **Remake** or **Cancelled**. Each row has a button named after the next step.'],
      },
      steps: {
        ar: [
          'حين ترسل المسودة انقر على **إرسال للمخبر**. يُسجَّل تاريخ الإرسال اليوم إن لم يكن مسجلاً.',
          'حين يبدأ المخبر العمل انقر على **بدء العمل**.',
          'عند وصول العمل إلى العيادة انقر على **استلام**. يُسجَّل تاريخ الاستلام، وتدخل التكلفة في المصروفات.',
          'بعد تركيبه للمريض انقر على **تم التركيب**.',
          'إذا احتاج العمل إلى تعديل افتح قائمة ⋮ واختر **إعادة للمخبر (إعادة عمل)**. إن كان موعد التسليم قد حلّ يُحدَّد موعد جديد بعد 7 أيام، ويعود زر **استلام** إلى السطر.',
          'لإيقاف طلب اختر **إلغاء الطلب** من القائمة نفسها، فيبقى في السجل بحالة **ملغى**.',
        ],
        en: [
          'When a draft goes out, click **Send to lab**. Today is recorded as the sent date if there is none.',
          'When the lab starts the work, click **Start work**.',
          'When the work arrives at the clinic, click **Receive**. The received date is recorded and the cost goes to your expenses.',
          'Once it is fitted for the patient, click **Mark fitted**.',
          'If the work needs correcting, open the ⋮ menu and choose **Send back (remake)**. If the due date has come, a new one is set 7 days ahead, and the **Receive** button comes back on the row.',
          'To stop an order, choose **Cancel order** in the same menu. It stays in the history as **Cancelled**.',
        ],
      },
      tips: {
        ar: [
          'في قائمة ⋮ أيضاً **طباعة أمر العمل** و**تعديل** و**حذف**. وتستطيع تغيير الحالة مباشرة من خانة **الحالة** في نافذة التعديل.',
          'عند الاستلام تُسجَّل **تكلفة المخبر** مصروفاً من فئة «مخبر» بتاريخ الاستلام، باسم المخبر ووصف العمل ورقم الطلب، فلا تكتب فاتورة المخبر مرتين. انظر [المصروفات](expenses#edit).',
          'عدّل التكلفة أو اسم المخبر من الطلب نفسه لا من صفحة المصروفات، فيتعدل المصروف معه. وإعادة العمل لا تضيف مصروفاً جديداً، أما إلغاء الطلب أو حذفه فيحذف مصروفه.',
          'بطاقة **تكاليف المخبر هذا الشهر** تجمع مصروفات فئة المخبر في الشهر، ومنها ما تسجله بيدك. وينتقل المدير إلى صفحة المصروفات بالنقر عليها.',
        ],
        en: [
          'The same menu also has **Print lab slip**, **Edit** and **Delete**. You can also change the status directly in the **Status** field of the edit window.',
          'On receipt, the **Lab cost** is recorded as an expense in the “Lab” category, dated the day received, with the lab’s name, the work and the order reference, so you never type a lab bill twice. See [Expenses](expenses#edit).',
          'Change the cost or the lab name on the order, not on the Expenses page, and the expense follows. A remake adds no second expense; cancelling or deleting the order removes its expense.',
          'The **Lab costs this month** card adds up the month’s Lab expenses, including any you enter by hand. The admin can click it to open the Expenses page.',
        ],
      },
      shots: ['lab-status'],
    },
    {
      id: 'slip',
      title: { ar: 'طباعة أمر العمل', en: 'Printing the lab slip' },
      text: {
        ar: ['أرسل مع الطبعة ورقة أمر عمل واضحة: ما المطلوب، ولأي أسنان، وبأي لون، ومتى.'],
        en: ['Send a clear lab slip with the impression: what is needed, for which teeth, in which shade, and by when.'],
      },
      steps: {
        ar: [
          'في سطر الطلب افتح قائمة ⋮ واختر **طباعة أمر العمل**.',
          'راجع الورقة: المخبر وموعد التسليم المطلوب، والمريض والطبيب، ونوع العمل واللون والمادة وتاريخ الإرسال، ورسم الأسنان المحددة، وملاحظاتك للمخبر.',
          'انقر على **طباعة**، ثم وقّع الورقة في مكان توقيع الطبيب.',
        ],
        en: [
          'On the order’s row open the ⋮ menu and choose **Print lab slip**.',
          'Check the sheet: the lab and the required date, the patient and doctor, the type of work, shade, material and sent date, a drawing of the chosen teeth, and your notes for the lab.',
          'Click **Print**, then sign the sheet where the doctor’s signature goes.',
        ],
      },
      tips: {
        ar: [
          'لا يُطبع على أمر العمل من بيانات المريض إلا اسمه، دون هاتفه أو حالته الصحية. ولا تُطبع التكلفة.',
          'في أسفل الورقة سطر آخر ليوقّع المخبر بالاستلام.',
          'على ويندوز تُفتح نافذة الطباعة في ويندوز، ولحفظ PDF اختر «Microsoft Print to PDF». وعلى أندرويد تُفتح شاشة الطباعة في النظام، وفيها خيار الحفظ بصيغة PDF.',
          'في وضع القراءة فقط يفتح النقر على الطلب أمر العمل مباشرة.',
        ],
        en: [
          'Of the patient’s details, only the name is printed on the slip: no phone and no medical data. The cost is not printed either.',
          'At the bottom there is a second line for the lab to sign on receipt.',
          'On Windows the Windows print dialog opens; to save a PDF choose “Microsoft Print to PDF”. On Android the system print screen opens, with a save-as-PDF option.',
          'In read-only mode, clicking an order opens its lab slip directly.',
        ],
      },
      shots: ['lab-slip'],
    },
    {
      id: 'patient-tab',
      title: { ar: 'المخبر في ملف المريض', en: 'Lab orders in the patient file' },
      text: {
        ar: ['تبويب **المخبر** في ملف المريض يعرض طلبات هذا المريض وحده: نوع العمل والأسنان والحالة، والمخبر والمادة واللون وتاريخ الإرسال والتكلفة، وموعد التسليم أو تاريخ الاستلام.'],
        en: ['The **Lab** tab of the patient’s file shows that patient’s orders only: type of work, teeth and status, the lab, material, shade, sent date and cost, and the due or received date.'],
      },
      steps: {
        ar: [
          'افتح ملف المريض، ثم تبويب **المخبر**.',
          'انقر على **طلب مخبري جديد**؛ يكون المريض محدداً سلفاً.',
          'انقر على زر الخطوة التالية لتقدّم الطلب، أو على الطلب نفسه لتعديله.',
        ],
        en: [
          'Open the patient’s file, then the **Lab** tab.',
          'Click **New lab order**; the patient is already set.',
          'Click the next-step button to move the order on, or the order itself to edit it.',
        ],
      },
      tips: {
        ar: [
          'يبيّن رأس البطاقة عدد الطلبات وعدد المفتوح منها، ويظهر عدد الطلبات أيضاً على اسم التبويب.',
          'تأتي الطلبات المتأخرة أولاً.',
        ],
        en: [
          'The card’s header shows how many orders there are and how many are open; the count also shows on the tab’s name.',
          'Late orders come first.',
        ],
      },
      shots: ['lab-patient-tab'],
    },
  ],
  shots: [
    {
      id: 'lab-board',
      device: 'desktop',
      alt: { ar: 'لوحة المخبر: البطاقات الأربع، والتصفية بالحالة والطبيب والمخبر، وجدول الطلبات مع زر الخطوة التالية', en: 'The lab board: the four cards, the status, doctor and lab filters, and the orders with their next-step buttons' },
      recipe: `${DESK} ${LAB} Page at its top. Capture the whole window. No markers.`,
    },
    {
      id: 'lab-phone',
      device: 'phone',
      alt: { ar: 'طلبات المخبر على الهاتف بطاقات، لكل منها الحالة وموعد التسليم وزر الخطوة التالية', en: 'Lab orders on a phone as cards, each with its status, due date and next-step button' },
      recipe: `${PHONE} ${LAB} Scroll so the status segments (.lab-filters) sit just under the top bar, so the first order cards show. Capture the whole screen. No markers.`,
    },
    {
      id: 'lab-form',
      device: 'desktop',
      alt: { ar: 'نافذة طلب مخبري جديد: المريض والطبيب واسم المخبر، ونوع العمل واللون والمادة، والسن 26 محدداً', en: 'The New lab order window: patient, doctor and lab name, type of work, shade and material, and tooth 26 selected' },
      recipe: `${DESK} ${LAB} Click **New lab order** (طلب مخبري جديد). Type “أنس مازن” (EN: “Anas Mazen”) in the patient search and press Enter to pick ${file(55, 'أنس مازن ديب', 'Anas Mazen Deeb')}. Type the lab name “مخبر الشام الرقمي (CAD/CAM)” (EN: “Al-Sham Digital Lab (CAD/CAM)”). Keep Type of work = Crown; type the shade “A3” and the material “زيركون” (EN: “Zirconia”); click tooth 26 in the teeth grid. Click the section title “العمل المطلوب / Work requested” to close any open list. Leave the dialog body at its top. Crop to the dialog. Markers: 2 on the patient card and the Lab name field, 3 on Type of work, Shade and Material, 4 on tooth 26 and the **Upper arch** / **Lower arch** buttons. Keep the dialog open for lab-form-dates.`,
    },
    {
      id: 'lab-form-dates',
      device: 'desktop',
      alt: { ar: 'قسم المواعيد والتكلفة في الطلب المخبري: تاريخ الإرسال وموعد التسليم والأيام السريعة والحالة والتكلفة والربط بخطة العلاج', en: 'The Dates & cost part of a lab order: sent date, due date, quick day buttons, status, cost and the treatment link' },
      recipe: `${DESK} Continue from lab-form: type 80 in **Lab cost**, choose “تاج زيركون · 16 — قيد التنفيذ / Zirconia crown · 16 — In progress” in **Link to a treatment plan item**, and type the notes “حواف كتف، الصور مرفقة” (EN: “Shoulder margins, photos attached”). Scroll the dialog body to its bottom. Crop to the dialog. Markers: 5 on Sent on, Due date and the +5 / +7 / +10 / +14 buttons, 6 on Lab cost, the treatment link and **Save order**. Cancel afterwards (do not save).`,
    },
    {
      id: 'lab-status',
      device: 'desktop',
      alt: { ar: 'أسطر المخبر مع أزرار الخطوة التالية: استلام لعمل قيد العمل ولإعادة عمل، وبدء العمل لطلب مرسل، وإرسال للمخبر لمسودة', en: 'Lab rows with their next-step buttons: Receive for work in progress and for a remake, Start work for a sent order, Send to lab for a draft' },
      recipe: `${DESK} ${LAB} Crop the board table from its header row down to the bottom of the fourth row (#7 Issam Mardini “Receive”, #20 Samer Maher Najjar remake “Receive”, #55 Anas Mazen Deeb “Start work”, #36 Dima Mardini draft “Send to lab”), full table width. Markers: 1 on **Send to lab** (row 4), 2 on **Start work** (row 3), 3 on **Receive** (row 1), 5 on the ⋯ button of row 2.`,
    },
    {
      id: 'lab-slip',
      device: 'desktop',
      alt: { ar: 'أمر عمل مخبري: المخبر وموعد التسليم المطلوب، والمريض والطبيب ونوع العمل واللون والمادة، ورسم الأسنان وسطرا التوقيع', en: 'A lab slip: the lab and required date, patient, doctor, type of work, shade and material, the teeth drawing and the signature lines' },
      recipe: `${DESK} ${LAB} On the row of ${file(55, 'أنس مازن ديب', 'Anas Mazen Deeb')} (Crown, tooth 16, Sent) click the ⋯ button, then **Print lab slip** (طباعة أمر العمل). Crop to the dialog. Markers: 2 on the lab and required-date band, 3 on **Print**. Close afterwards.`,
    },
    {
      id: 'lab-patient-tab',
      device: 'desktop',
      alt: { ar: 'تبويب المخبر في ملف المريض: طلب قشور فينير بحالة إعادة عمل، مستحق غداً، مع زر الاستلام', en: 'The Lab tab of a patient file: a veneer order marked Remake, due tomorrow, with the Receive button' },
      recipe: `${DESK} Open ${file(20, 'سامر ماهر النجار', 'Samer Maher Najjar')} at #/patients/<id>?tab=lab and reload; scroll so the tab bar (.pt-tabs) sits just under the top bar (the page may be too short to scroll all the way; keep it as far as it goes). Capture the whole window. Markers: 1 on the **Lab** tab, 2 on **New lab order**, 3 on **Receive**.`,
    },
  ],
}

export default topic

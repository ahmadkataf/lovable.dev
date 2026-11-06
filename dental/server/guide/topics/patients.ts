import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in
// store/scripts/shoot.mjs. Demo patients are named by their file number, which is the same in every run and in both
// languages; look the id up with window.__dentora.db.patients (fileNo) and open #/patients/<id>.
const DESK = 'Desktop 1440×900, demo clinic, clock fixed to Sunday 11 Oct 2026 11:40 (Asia/Damascus), trial bar hidden, as in store/scripts/shoot.mjs.'
const PHONE = 'Phone 390×844 (isMobile, hasTouch), demo clinic, same clock, trial bar hidden.'
const file = (n: number, ar: string, en: string) => `patient file #${n} (${ar} / ${en})`

const topic: GuideTopic = {
  slug: 'patients',
  order: 4,
  icon: 'users',
  title: { ar: 'المرضى', en: 'Patients' },
  summary: {
    ar: 'أنشئ ملف المريض في ثوانٍ، وسجّل حالته الصحية وتنبيهاته الطبية، ثم تابع مواعيده وعلاجاته وحسابه وصوره من مكان واحد.',
    en: 'Create a patient file in seconds, record medical alerts, and follow the patient’s appointments, treatments, account and images in one place.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'قائمة المرضى', en: 'The patients list' },
      text: {
        ar: [
          'افتح **المرضى** من القائمة الجانبية، أو من الشريط السفلي على الهاتف. تجد هنا كل ملفات العيادة: لكل مريض سطر فيه رقم ملفه واسمه وجنسه وعمره وطبيبه المعالج، ثم هاتفه مع زرّي الاتصال وواتساب، والتنبيهات الطبية، وتاريخ آخر زيارة، والمبلغ المستحق عليه، ووسومه. وعلى الهاتف يظهر كل مريض بطاقةً فيها اسمه ورقم ملفه وجنسه وعمره ومستحقه وهاتفه وتنبيهاته الطبية.',
          'في أعلى القائمة ثلاث بطاقات: **إجمالي المرضى** و**مرضى جدد هذا الشهر** و**عليهم مستحقات**. انقر على **مرضى جدد هذا الشهر** أو **عليهم مستحقات** لتعرض هؤلاء المرضى وحدهم، ثم انقر على البطاقة نفسها مرة أخرى، أو على **إجمالي المرضى**، لتعود إلى القائمة كاملة.',
          'انقر على أي سطر لتفتح ملف المريض.',
        ],
        en: [
          'Open **Patients** from the sidebar, or from the bottom bar on a phone. Every file of the clinic is here: each patient has a row with the file number, name, gender, age and treating doctor, then the phone with call and WhatsApp buttons, medical alerts, last visit, balance and tags. On a phone each patient is a card with name, file number, gender, age, balance, phone and medical alerts.',
          'Three cards sit above the list: **Total patients**, **New this month** and **With a balance due**. Click **New this month** or **With a balance due** to show only those patients; click the same card again, or **Total patients**, to see everyone.',
          'Click any row to open the patient’s file.',
        ],
      },
      tips: {
        ar: [
          'يظهر المستحق بالأحمر حين يكون على المريض مبلغ للعيادة، وبالأخضر حين يكون له رصيد دائن.',
          'تعرض القائمة 25 مريضاً في كل صفحة، وأزرار الصفحات في أسفلها.',
          'على أندرويد يفتح زر الاتصال تطبيق الهاتف، ويفتح زر واتساب محادثة المريض في تطبيق واتساب. على ويندوز يُفتح رابط واتساب في المتصفح لتكمل في واتساب ويب أو في تطبيق واتساب على الحاسوب.',
          'لا تظهر الملفات المؤرشفة في القائمة ولا في أرقام البطاقات. تجدها تحت زر **الأرشيف**، انظر [الأرشفة والحذف](patients#archive).',
          'إذا انتهت الفترة التجريبية دون تفعيل يعمل البرنامج للقراءة فقط: تفتح الملفات وتقرؤها، لكن الإضافة والتعديل يتوقفان. انظر [الترخيص](licence).',
        ],
        en: [
          'The balance is red when the patient owes the clinic and green when the patient has credit.',
          'The list shows 25 patients a page, with the page buttons under it.',
          'On Android the call button opens the phone app and the WhatsApp button opens a chat in WhatsApp. On Windows the WhatsApp link opens in the browser, where you continue in WhatsApp Web or the WhatsApp desktop app.',
          'Archived files are left out of the list and of the card figures. They are under the **Archive** button; see [Archiving and deleting](patients#archive).',
          'If the trial ends without activation, the app becomes read-only: you can open and read every file, but adding and editing stop. See [Licence](licence).',
        ],
      },
      shots: ['patients-list'],
    },
    {
      id: 'add-patient',
      title: { ar: 'إضافة مريض جديد', en: 'Adding a new patient' },
      text: {
        ar: ['يكفي اسم المريض لإنشاء ملفه، وتستطيع إكمال بقية البيانات في أي وقت لاحقاً.'],
        en: ['A name is all a new file needs; you can fill in the rest at any time later.'],
      },
      steps: {
        ar: [
          'انقر على **مريض جديد** أعلى صفحة المرضى (على الهاتف: الزر العائم أسفل الشاشة)، أو اختره من زر **جديد** في الشريط العلوي على الحاسوب، أو اضغط `Ctrl+Shift+N` من أي شاشة.',
          'اكتب **الاسم الكامل**، وهو الحقل الوحيد المطلوب.',
          'اختر **الجنس** (يكون **ذكر** مختاراً مسبقاً، فغيّره للمريضات) وأدخل **تاريخ الميلاد**، فيظهر العمر تحته مباشرة.',
          'أدخل **الهاتف**. هو اختياري، لكن بدونه لا تستطيع تذكير المريض بمواعيده عبر واتساب. وإن كان له رقم ثانٍ فأضفه في **هاتف آخر**.',
          'أكمل ما تشاء من الحقول الأخرى: **صورة المريض** و**البريد الإلكتروني** و**الطبيب المعالج** و**العنوان** و**الرقم الوطني** و**المهنة**، ثم **الحالة الصحية** و**معلومات إضافية** في أسفل النموذج (الوسوم والتأمين وجهة الإحالة والملاحظات).',
          'انقر على **حفظ المريض**. يعطي البرنامج المريض رقم الملف التالي تلقائياً، ويفتح ملفه مباشرة.',
        ],
        en: [
          'Click **New patient** at the top of the Patients page (on a phone, the floating button at the bottom of the screen), pick it from the **New** button in the top bar on a computer, or press `Ctrl+Shift+N` on any screen.',
          'Type the **Full name**, the only required field.',
          'Choose the **Gender** (**Male** is picked by default, so change it for a female patient) and enter the **Date of birth**; the age appears right under it.',
          'Enter the **Phone**. It is optional, but without it the patient cannot get WhatsApp appointment reminders. A second number goes in **Other phone**.',
          'Fill in whatever else you have: **Patient photo**, **Email**, **Treating doctor**, **Address**, **National ID** and **Occupation**, then **Medical status** and **Additional information** further down (tags, insurance, referral and notes).',
          'Click **Save patient**. Dentora gives the patient the next file number and opens the new file.',
        ],
      },
      tips: {
        ar: [
          'إذا كان رقم الهاتف مسجلاً لمريض آخر يظهر تنبيه باسمه ورقم ملفه. تستطيع الحفظ رغم ذلك، كما في أفراد العائلة الواحدة الذين يشتركون في رقم واحد.',
          'إذا أغلقت النموذج قبل الحفظ يسألك البرنامج **تجاهل التغييرات؟** فلا تضيع بياناتك بنقرة خاطئة. اختر **متابعة التعديل** لتعود إليه.',
          'الضغط على `Enter` في خانة نصية من سطر واحد يحفظ النموذج، إلا في خانات الحساسية والأمراض والأدوية والوسوم، حيث يضيف ما كتبته إلى القائمة.',
          'على أندرويد يعرض زر **اختيار صورة** كاميرا الهاتف إلى جانب الملفات، فتستطيع تصوير المريض مباشرة.',
          'تستطيع أيضاً إضافة مريض بالاسم والهاتف فقط وأنت تحجز له موعداً. انظر [حجز موعد](appointments#book).',
        ],
        en: [
          'If the phone number already belongs to another patient, a notice shows that patient’s name and file number. You can still save, for example for family members who share a number.',
          'If you close the form before saving, Dentora asks **Discard changes?** so a stray click never loses your typing. Choose **Keep editing** to go back.',
          'Pressing `Enter` in a single-line text field saves the form, except in the allergy, disease, medication and tag boxes, where it adds what you typed to the list.',
          'On Android, **Choose photo** offers the phone’s camera next to your files, so you can photograph the patient right away.',
          'You can also add a patient with just a name and phone while booking an appointment. See [Booking an appointment](appointments#book).',
        ],
      },
      shots: ['patients-new-form'],
    },
    {
      id: 'medical',
      title: { ar: 'الحالة الصحية والتنبيه الطبي', en: 'Medical status and the medical alert' },
      text: {
        ar: ['سجّل حساسية المريض وأمراضه المزمنة وأدويته مرة واحدة، فيراها كل من يفتح ملفه قبل أي إجراء.'],
        en: ['Record the patient’s allergies, chronic diseases and medications once, and everyone who opens the file sees them before any procedure.'],
      },
      steps: {
        ar: [
          'افتح ملف المريض وانقر على **تعديل**، أو املأ هذا القسم وأنت تضيف المريض.',
          'في قسم **الحالة الصحية** اكتب الحساسية في خانة **الحساسية** ثم اضغط `Enter` أو فاصلة، أو انقر على اقتراح جاهز مثل **بنسلين** أو **لاتكس**.',
          'أضف بالطريقة نفسها **الأمراض المزمنة** و**الأدوية الحالية**، واختر **فصيلة الدم** إن كانت معروفة.',
          'اكتب في **ملاحظات طبية** أي معلومة أخرى يجب أن يعرفها الطبيب قبل العلاج.',
          'انقر على **حفظ التغييرات**.',
        ],
        en: [
          'Open the patient’s file and click **Edit**, or fill in this section while adding the patient.',
          'Under **Medical status**, type an allergy in **Allergies** and press `Enter` or a comma, or click a ready suggestion such as **Penicillin** or **Latex**.',
          'Add **Chronic diseases** and **Current medications** the same way, and choose the **Blood type** if you know it.',
          'Use **Medical notes** for anything else the dentist must know before treatment.',
          'Click **Save changes**.',
        ],
      },
      tips: {
        ar: [
          'تظهر الحساسية والأمراض المزمنة والأدوية في شريط **تنبيه طبي** أعلى ملف المريض: أحمر إن كانت عنده حساسية، وبرتقالي إن لم تكن. وفي قائمة المرضى تظهر شارة **حساسية** أو **مرض مزمن** في عمود **تنبيهات طبية**، وعلى الهاتف تحت اسمه بجانب رقم الهاتف.',
          'لحذف عنصر انقر على ✕ بجانبه، أو اضغط `Backspace` في الخانة الفارغة ليُحذف آخر عنصر.',
          'لا تظهر **ملاحظات طبية** في شريط التنبيه، بل في بطاقة **المعلومات الطبية** في تبويب **نظرة عامة** فقط. لذلك اكتب كل حساسية ومرض ودواء في خانته، لا في الملاحظات.',
          'تُستخدم الحساسية المسجّلة هنا أيضاً لتنبيهك حين تكتب وصفة فيها دواء قد يتعارض معها. انظر [تنبيهات الحساسية](prescriptions#allergy).',
        ],
        en: [
          'Allergies, chronic diseases and medications appear in a **Medical alert** bar at the top of the file: red when there is an allergy, orange otherwise. In the patients list an **Allergy** or **Chronic** badge shows in the **Medical alerts** column (on a phone, under the name next to the phone number).',
          'To remove an item click the ✕ next to it, or press `Backspace` in the empty box to remove the last one.',
          '**Medical notes** do not appear in the alert bar, only in the **Medical information** card of the **Overview** tab. Put every allergy, disease and medication in its own box, not in the notes.',
          'The allergies recorded here also warn you when a prescription contains a drug that may clash with them. See [Allergy warnings](prescriptions#allergy).',
        ],
      },
      shots: ['patients-medical-form', 'patients-medical-alert'],
    },
    {
      id: 'find',
      title: { ar: 'البحث والتصفية والترتيب', en: 'Search, filter and sort' },
      text: {
        ar: ['مهما كثرت الملفات تصل إلى المريض في ثوانٍ بالبحث أو بالتصفية.'],
        en: ['However many files the clinic has, search and filters bring you to the patient in seconds.'],
      },
      steps: {
        ar: [
          'اكتب في خانة البحث جزءاً من الاسم أو رقم الهاتف (الأول أو الآخر) أو رقم الملف أو الرقم الوطني أو البريد الإلكتروني. تتغير النتائج مع كل حرف تكتبه.',
          'ضيّق القائمة بالجنس (**الكل** أو **ذكر** أو **أنثى**)، وبالطبيب المعالج (**كل الأطباء**)، وبالوسم (**كل الوسوم**).',
          'اختر الترتيب من الزر الأخير: **الأحدث إضافة** أو **الاسم أبجدياً** أو **آخر زيارة** أو **الأعلى مستحقات**.',
          'يظهر فوق الجدول عدد النتائج، وانقر على **مسح التصفية** لتعود إلى القائمة كاملة.',
        ],
        en: [
          'Type part of a name, a phone number (first or other), a file number, a national ID or an email in the search box. The list updates as you type.',
          'Narrow it by gender (**All**, **Male** or **Female**), by treating doctor (**All doctors**) and by tag (**All tags**).',
          'Pick the order from the last button: **Recently added**, **Name (A–Z)**, **Last visit** or **Highest balance**.',
          'The number of results shows above the table; click **Clear filters** to see everyone again.',
        ],
      },
      tips: {
        ar: [
          'يتجاهل البحث الفروق الشائعة في الكتابة: «احمد» تجد «أحمد»، و«فاطمه» تجد «فاطمة»، ويقبل الأرقام بالشكلين ٠٩٤٤ و0944.',
          'تستطيع الجمع بين كلمتين: «أحمد 0944» تجد أحمد الذي في هاتفه 0944. يُبحث في الهاتف بثلاثة أرقام فأكثر، أما رقم الملف فيكفي أوله.',
          'تظهر قائمة الأطباء حين يكون في العيادة أكثر من طبيب، وقائمة الوسوم بعد أن تضيف وسوماً للمرضى.',
          'يحتفظ البرنامج بالبحث والتصفية والترتيب حين تنتقل إلى شاشة أخرى ثم تعود، حتى تغلق البرنامج.',
          'على الهاتف يجمع زر التصفية بجانب خانة البحث هذه الخيارات كلها في نافذة **التصفية والترتيب**، ويظهر عليه عدد الخيارات المفعّلة.',
          'للوصول إلى مريض من أي شاشة استخدم البحث في الشريط العلوي (`Ctrl+K`). انظر [البحث السريع](interface#search).',
        ],
        en: [
          'Search ignores the usual Arabic spelling variants (احمد finds أحمد, فاطمه finds فاطمة) and reads Arabic-Indic digits such as ٠٩٤٤ like 0944.',
          'Combine words: “Ahmad 0944” finds the Ahmad whose phone contains 0944. Phone numbers match from three digits on; for a file number the first digits are enough.',
          'The doctor list appears once the clinic has more than one doctor, and the tag list once patients have tags.',
          'Your search, filters and order stay as they are while you visit other screens, until you close the app.',
          'On a phone, the filter button next to the search box gathers all of this in a **Filter & sort** window and shows how many options are on.',
          'To reach a patient from any screen, use the search box in the top bar (`Ctrl+K`). See [Quick search](interface#search).',
        ],
      },
      shots: ['patients-filters', 'patients-filters-phone'],
    },
    {
      id: 'profile',
      title: { ar: 'ملف المريض', en: 'The patient file' },
      text: {
        ar: ['يجمع ملف المريض كل ما يخصه. في أعلاه صورته واسمه ورقم ملفه وعمره وتاريخ ميلاده وفصيلة دمه وطبيبه المعالج وهواتفه وبريده وعنوانه ووسومه.'],
        en: ['The patient file brings everything about the patient together. The top shows the photo, name, file number, age, date of birth, blood type, treating doctor, phones, email, address and tags.'],
      },
      steps: {
        ar: [
          'افتح الملف بالنقر على سطر المريض في القائمة، أو ابحث عنه من الشريط العلوي.',
          'تابع الأرقام الأربعة تحت الاسم: **الرصيد المستحق** و**الموعد القادم** و**آخر زيارة** و**علاجات منجزة** مع عدد العلاجات المتبقية. انقر على الرصيد أو الموعد أو العلاجات لتنتقل إلى تبويبها.',
          'استخدم الأزرار: **تعديل** لتغيير البيانات (على الهاتف يظهر زر **تعديل** أيقونة قلم فقط)، و**موعد** لحجز موعد للمريض، و**دفعة** لتسجيل مبلغ دفعه، وزر النقاط الثلاث (⋯) لـ**أرشفة** الملف أو **حذف المريض**.',
          'تنقّل بين التبويبات. يعرض تبويب **نظرة عامة** المعلومات الطبية، والتواصل والتأمين، والملاحظات، و**المواعيد القادمة** مع زر **حجز موعد**، و**آخر النشاطات** على الملف مع اسم من قام بكل منها ووقته.',
        ],
        en: [
          'Open the file by clicking the patient’s row in the list, or find the patient from the top bar.',
          'Read the four figures under the name: **Balance due**, **Next appointment**, **Last visit** and **Completed treatments** with the number still to do. Click the balance, the appointment or the treatments to jump to their tab.',
          'Use the buttons: **Edit** to change details (on a phone **Edit** is a pencil icon only), **Appointment** to book a visit, **Payment** to record money received, and the three dots (⋯) to **Archive** the file or **Delete patient**.',
          'Move between the tabs. **Overview** shows the medical information, contact and insurance, notes, **Upcoming appointments** with a **Book appointment** button, and **Recent activity** on the file with who did what and when.',
        ],
      },
      tips: {
        ar: [
          'التبويبات الأخرى مشروحة في صفحاتها: [مخطط الأسنان](chart)، [العلاجات](treatments)، [المواعيد](appointments#patient-tab)، [الحساب](billing#account)، [الوصفات](prescriptions#patient-tab)، [المخبر](lab#patient-tab). ويظهر بجانب كل تبويب منها، ما عدا **مخطط الأسنان**، عدد ما فيه حين لا يكون فارغاً، ويجمع عدد **الملفات والملاحظات** الملفات والملاحظات السريرية معاً.',
          'تختلف التبويبات والأزرار حسب دور المستخدم: موظف الاستقبال لا يرى **مخطط الأسنان** و**العلاجات** و**الوصفات** و**المخبر**، والمساعد لا يرى **الحساب** ولا زر **دفعة**، وحذف المريض للمدير وحده. انظر [الأدوار والصلاحيات](staff#roles).',
          'على الهاتف تتحرك التبويبات أفقياً: اسحبها جانباً لتصل إلى بقيتها.',
        ],
        en: [
          'The other tabs have their own pages: [Dental chart](chart), [Treatments](treatments), [Appointments](appointments#patient-tab), [Account](billing#account), [Prescriptions](prescriptions#patient-tab), [Lab](lab#patient-tab). Each of these tabs except **Dental chart** shows how many items it holds when it is not empty; the **Files & notes** count adds files and clinical notes together.',
          'Tabs and buttons depend on the user’s role: a receptionist does not see **Dental chart**, **Treatments**, **Prescriptions** or **Lab**; an assistant does not see **Account** or the **Payment** button; only an admin can delete a patient. See [Roles and permissions](staff#roles).',
          'On a phone the tab bar scrolls sideways: swipe it to reach the other tabs.',
        ],
      },
      shots: ['patients-profile', 'patients-profile-phone'],
    },
    {
      id: 'files',
      title: { ar: 'الملفات والصور والملاحظات السريرية', en: 'Files, images and clinical notes' },
      text: {
        ar: ['احفظ صور الأشعة والصور السريرية والمستندات والموافقات الموقّعة في ملف المريض، واكتب ملاحظاتك بعد كل جلسة ليجدها الطبيب في الزيارة القادمة.'],
        en: ['Keep X-rays, clinical photos, documents and signed consents in the patient’s file, and write notes after each session for the next visit.'],
      },
      steps: {
        ar: [
          'افتح تبويب **الملفات والملاحظات** في ملف المريض.',
          'انقر على **رفع ملف** واختر صورة أو ملف PDF. على الحاسوب تستطيع أيضاً سحب الملف وإفلاته في المربع تحت الملفات.',
          'اختر **نوع الملف**: **أشعة** أو **صورة** أو **مستند** أو **موافقة** أو **أخرى**. يقترح البرنامج النوع من اسم الملف.',
          'غيّر **اسم الملف** إن شئت، وأضف **ملاحظة** تصف الملف (تظهر تحت صورته بدلاً من اسمه)، ورقم السن في **السن (اختياري)** بترقيم FDI، مثل 36.',
          'انقر على **حفظ الملف**.',
          'لكتابة ملاحظة سريرية انقر على **ملاحظة جديدة**، واختر التاريخ والطبيب، واكتب ما تم في الجلسة، ثم انقر على **حفظ** أو اضغط `Ctrl+Enter`.',
        ],
        en: [
          'Open the **Files & notes** tab of the patient’s file.',
          'Click **Upload file** and choose an image or a PDF. On a computer you can also drag the file onto the box under the files.',
          'Choose the **File type**: **X-ray**, **Photo**, **Document**, **Consent** or **Other**. Dentora suggests one from the file name.',
          'Rename it in **File name** if you like, add a **Note** describing the file (it shows under the thumbnail instead of the name), and the tooth in **Tooth (optional)** in FDI numbering, such as 36.',
          'Click **Save file**.',
          'For a clinical note, click **New note**, pick the date and the doctor, write what was done, then click **Save** or press `Ctrl+Enter`.',
        ],
      },
      tips: {
        ar: [
          'انقر على أي ملف لتعرضه كبيراً. تنقّل بين الملفات بالسهمين أو بأسهم لوحة المفاتيح، وغيّر النوع أو السن أو الملاحظة ثم انقر على **حفظ التغييرات**، أو استخدم **تنزيل** و**حذف**. وتستطيع تصفية الملفات حسب نوعها بالأزرار فوقها.',
          'الحد الأقصى لحجم الملف 25 ميغابايت، ويُقبل من الملفات الصور وPDF فقط.',
          'على أندرويد يعرض زر **رفع ملف** كاميرا الهاتف إلى جانب الملفات، فتستطيع تصوير فيلم الأشعة أو فم المريض مباشرة.',
          'على ويندوز يُعرض ملف PDF داخل البرنامج. على أندرويد يظهر بدلاً منه زر **تنزيل** لتفتحه في تطبيق آخر.',
          'تُحفظ الملفات على هذا الجهاز وتدخل في النسخة الاحتياطية، وينبّهك البرنامج قبل الرفع إن لم تبقَ على الجهاز مساحة كافية. انظر [النسخ الاحتياطي](backup).',
          'تُرتّب الملاحظات السريرية من الأحدث إلى الأقدم مع اسم الطبيب. يكتبها ويعدّلها ويحذفها الأطباء والمساعدون والمدير، ويقرؤها موظف الاستقبال فقط. أما الصور والملفات فيرفعها ويحذفها كل أعضاء الفريق، بمن فيهم موظف الاستقبال.',
        ],
        en: [
          'Click a file to see it large. Move between files with the arrows on screen or on the keyboard, change the type, tooth or note and click **Save changes**, or use **Download** and **Delete**. The buttons above the files filter them by type.',
          'Files can be up to 25 MB, and only images and PDFs are accepted.',
          'On Android, **Upload file** offers the phone’s camera next to your files, so you can photograph an X-ray film or the patient’s mouth directly.',
          'On Windows a PDF opens inside the app. On Android a **Download** button appears instead, so you can open it in another app.',
          'Files are stored on this device and are part of the backup; Dentora warns you before an upload if the device is short of space. See [Backup](backup).',
          'Clinical notes are listed newest first with the doctor’s name. Doctors, assistants and admins write, edit and delete them; receptionists can only read them. Images and files can be uploaded and deleted by everyone on the team, receptionists included.',
        ],
      },
      shots: ['patients-files', 'patients-files-upload'],
    },
    {
      id: 'archive',
      title: { ar: 'الأرشفة والحذف', en: 'Archiving and deleting' },
      text: {
        ar: ['حين يتوقف مريض عن مراجعة العيادة أرشِف ملفه بدل حذفه: يختفي من القائمة ومن الأرقام، ويبقى حسابه ومدفوعاته في التقارير، وتستطيع استعادته في أي وقت.'],
        en: ['When a patient stops coming, archive the file rather than delete it: it leaves the list and the figures, its account and payments stay in the reports, and you can restore it at any time.'],
      },
      steps: {
        ar: [
          'افتح قائمة الإجراءات (⋮) في آخر سطر المريض، أو زر النقاط الثلاث (⋯) في ملفه.',
          'اختر **أرشفة**.',
          'لرؤية الملفات المؤرشفة انقر على **الأرشيف** فوق القائمة. على الهاتف فعّل **عرض الملفات المؤرشفة** في نافذة التصفية.',
          'لإعادة ملف إلى القائمة اختر **استعادة** من قائمة الإجراءات نفسها.',
        ],
        en: [
          'Open the actions menu (⋮) at the end of the patient’s row, or the three dots (⋯) in the patient’s file.',
          'Choose **Archive**.',
          'To see archived files, click **Archive** above the list. On a phone, turn on **Show archived files** in the filter window.',
          'To bring a file back, choose **Restore** from the same actions menu.',
        ],
      },
      tips: {
        ar: [
          'يحمل الملف المؤرشف شارة **ملف مؤرشف** بجانب الاسم، وتستطيع فتحه وقراءته كالمعتاد.',
          'لا يظهر الملف المؤرشف عند اختيار المريض في نموذج الموعد، فلا تُضِفه مريضاً جديداً حتى لا يتكرر ملفه: احجز له من زر **موعد** في ملفه، أو استعِد الملف أولاً. ويبقى ظاهراً في البحث السريع (`Ctrl+K`) بشارة **مؤرشف**.',
          'الحذف للمدير وحده. يحذف الملف نهائياً مع كل ما فيه: المواعيد وخطط العلاج والعلاجات ومخطط الأسنان والوصفات وطلبات المخبر والصور والملفات والملاحظات السريرية ومسودات الفواتير وسجل نشاطاته، ولا يمكن التراجع عنه.',
          'لا يُحذف ملف عليه فواتير أو دفعات، لأن حذفه يغيّر إيرادات أيام أُغلقت حساباتها. يظهر عندها **لا يمكن حذف ملف هذا المريض** مع زر **أرشفة الملف**.',
          'خذ نسخة احتياطية قبل أي حذف. انظر [حفظ نسخة احتياطية](backup#export).',
        ],
        en: [
          'An archived file carries an **Archived file** badge next to the name, and you can still open and read it.',
          'An archived file does not appear when you choose the patient in the appointment form, so do not add the patient again as new (that would make a second file): book from the **Appointment** button in the file, or restore it first. It still shows in quick search (`Ctrl+K`) with an **Archived** badge.',
          'Only an admin can delete. Deleting removes the file for good with everything in it: appointments, treatment plans and treatments, dental chart, prescriptions, lab orders, images and files, clinical notes, draft invoices and its activity log; it cannot be undone.',
          'A file with invoices or payments is never deleted, because that would change the revenue of days already closed. You see **This patient file can’t be deleted** with an **Archive file** button instead.',
          'Make a backup before deleting anything. See [Saving a backup](backup#export).',
        ],
      },
      shots: ['patients-archive', 'patients-delete-blocked'],
    },
  ],
  shots: [
    {
      id: 'patients-list',
      device: 'desktop',
      alt: { ar: 'قائمة المرضى: بطاقات الأرقام في الأعلى، ثم البحث والتصفية، ثم جدول المرضى', en: 'The patients list: figure cards at the top, then search and filters, then the table of patients' },
      recipe: `${DESK} Route #/patients with no search or filter on (sort "Recently added"). Wait for the balances to load (the "With a balance due" card shows a number). Capture the whole window. No markers.`,
    },
    {
      id: 'patients-new-form',
      device: 'desktop',
      alt: { ar: 'نموذج مريض جديد وفيه الاسم وتاريخ الميلاد والعمر وتنبيه بأن رقم الهاتف مسجّل لمريض آخر', en: 'The new patient form with a name, date of birth and age, and a notice that the phone number belongs to another patient' },
      caption: { ar: 'الاسم وحده يكفي للحفظ، وتنبيه الرقم المكرر لا يمنعك من المتابعة.', en: 'A name is enough to save, and the duplicate-number notice does not stop you.' },
      recipe: `${DESK} Route #/patients. Click the header button **New patient** (مريض جديد). In the dialog type Full name "سامي خالد الحلبي" (EN: "Sami Khaled Halabi"), Date of birth 1988-04-02, and as Phone the phone of ${file(60, 'محمد يوسف المصري', 'Mohammad Youssef Masri')} (0991978827 in the demo), then wait 1 s for the duplicate-phone warning (.pt-dup). Leave the dialog scrolled to its top. Crop to the dialog ([role=dialog]). Markers: 2 on the Full name field, 3 on the Date of birth field (with the age hint under it), 4 on the Phone field, 6 on the **Save patient** button in the footer. Close with Cancel → Close without saving afterwards (do not save).`,
    },
    {
      id: 'patients-medical-form',
      device: 'desktop',
      alt: { ar: 'قسم الحالة الصحية في نموذج المريض: فصيلة الدم والحساسية والأمراض المزمنة والأدوية مع الاقتراحات الجاهزة', en: 'The medical status section of the patient form: blood type, allergies, chronic diseases and medications with ready suggestions' },
      recipe: `${DESK} Open ${file(44, 'لمى ماهر السيد', 'Lama Maher Sayed')} (#/patients/<id>), click **Edit** in the header card. In the dialog scroll the body so the "Medical status" section title (second .form-section) is at the top of the dialog body. Crop to the dialog. Markers: 2 on the Allergies box (it already holds one allergy), 3 on the Chronic diseases box, 4 on the Medical notes box, 5 on **Save changes**. Close without saving.`,
    },
    {
      id: 'patients-medical-alert',
      device: 'desktop',
      alt: { ar: 'أعلى ملف المريض مع شريط التنبيه الطبي الأحمر: الحساسية والأمراض المزمنة والأدوية', en: 'The top of a patient file with the red medical alert bar: allergies, chronic diseases and medications' },
      recipe: `${DESK} Open ${file(44, 'لمى ماهر السيد', 'Lama Maher Sayed')} (#/patients/<id>), overview tab, page at its top. Crop from the top of the header card (.pt-hero) to the bottom of the medical alert bar (.pt-alert), full content width, 12 px margin. No markers.`,
    },
    {
      id: 'patients-filters',
      device: 'desktop',
      alt: { ar: 'البحث عن «ميس» مع تصفية الإناث، وعدد النتائج وزر مسح التصفية فوق الجدول', en: 'Searching for “Mais” with the female filter, and the result count with Clear filters above the table' },
      recipe: `${DESK} Route #/patients. Type "ميس" (EN: "Mais") in the list's search box, click **Female** (أنثى) in the gender switch, wait 500 ms. Crop from the top of the figure cards (.pt-stats) to the bottom of the table (3 rows), full content width. Markers: 1 on the search box, 2 on the gender switch and the doctor and tag lists, 3 on the sort button (**Recently added**), 4 on **Clear filters** in the result bar.`,
    },
    {
      id: 'patients-filters-phone',
      device: 'phone',
      alt: { ar: 'نافذة التصفية والترتيب على الهاتف: الجنس والطبيب والوسوم والترتيب وعرض الملفات المؤرشفة', en: 'The Filter & sort window on a phone: gender, doctor, tags, order and show archived files' },
      recipe: `${PHONE} Route #/patients. Tap the filter button next to the search box (.pt-filter-btn); wait for the bottom sheet. Capture the whole screen. No markers.`,
    },
    {
      id: 'patients-profile',
      device: 'desktop',
      alt: { ar: 'ملف المريض: البيانات والأرقام الأربعة والأزرار والتنبيه الطبي والتبويبات ونظرة عامة', en: 'A patient file: details, the four figures, the buttons, the medical alert, the tabs and the overview' },
      recipe: `${DESK} Open ${file(44, 'لمى ماهر السيد', 'Lama Maher Sayed')} (#/patients/<id>), overview tab, page at its top. Capture the whole window. Markers: 2 on the row of four figures (.pt-kpis), 3 on the buttons Edit / Appointment / Payment / ⋯ (.pt-hero-actions), 4 on the tab bar (.pt-tabs).`,
    },
    {
      id: 'patients-profile-phone',
      device: 'phone',
      alt: { ar: 'ملف المريض على الهاتف: الأزرار تحت الاسم والأرقام في شبكة', en: 'A patient file on a phone: the buttons under the name and the figures in a grid' },
      recipe: `${PHONE} Open ${file(42, 'روان نبيل الشامي', 'Rawan Nabil Shami')} (the "alertShort" patient of shoot.mjs), overview tab, page at its top. Capture the whole screen. No markers.`,
    },
    {
      id: 'patients-files',
      device: 'desktop',
      alt: { ar: 'تبويب الملفات والملاحظات: صورة أشعة مرفوعة على السن 36، ومنطقة السحب والإفلات، والملاحظات السريرية', en: 'The Files & notes tab: an X-ray uploaded for tooth 36, the drop zone, and the clinical notes' },
      recipe: `${DESK} Make patients-files-upload first and save that file. Then open ${file(19, 'مريم يوسف البيطار', 'Mariam Youssef Bitar')} at #/patients/<id>?tab=files, scroll so the tab bar (.pt-tabs) sits just under the top bar. Capture the whole window. Markers: 1 on the **Files & notes** tab, 2 on **Upload file**, 6 on **New note**.`,
    },
    {
      id: 'patients-files-upload',
      device: 'desktop',
      alt: { ar: 'نافذة إضافة ملف للمريض: نوع الملف واسمه والملاحظة ورقم السن', en: 'The add-a-file window: file type, name, note and tooth number' },
      recipe: `${DESK} Open ${file(19, 'مريم يوسف البيطار', 'Mariam Youssef Bitar')} at #/patients/<id>?tab=files. Click **Upload file** and answer the file chooser (page.waitForEvent('filechooser')) with a sample dental X-ray image named "periapical-36.jpg" (any JPG or PNG; store/icon-512.png will do as a stand-in). In the dialog click **X-ray** (أشعة), type the Note "صورة ذروية قبل المعالجة" (EN: "Periapical X-ray before treatment") and Tooth 36. Crop to the dialog. Markers: 3 on the file type buttons, 4 on the Note and Tooth fields, 5 on **Save file**. Then click Save file (patients-files needs it).`,
    },
    {
      id: 'patients-archive',
      device: 'desktop',
      alt: { ar: 'عرض الملفات المؤرشفة وقائمة الإجراءات مفتوحة على أمر الاستعادة', en: 'The archived files view with the actions menu open on Restore' },
      recipe: `${DESK} Route #/patients. Archive ${file(57, 'ميس عصام حمدان', 'Mais Issam Hamdan')}: open its row menu (⋮, .pt-rowmenu button) → **Archive**. Click the **Archive** toggle above the list (it shows a count of 1), then open the row menu of that patient again. Crop from the top of the toolbar (.pt-toolbar) to 40 px below the open menu, full content width. Markers: 3 on the **Archive** toggle, 4 on **Restore** in the menu. Afterwards choose Restore so the demo stays complete.`,
    },
    {
      id: 'patients-delete-blocked',
      device: 'desktop',
      alt: { ar: 'رسالة «لا يمكن حذف ملف هذا المريض» لأن عليه فواتير ودفعات، مع زر أرشفة الملف', en: 'The “This patient file can’t be deleted” message, because the patient has invoices and payments, with the Archive file button' },
      recipe: `${DESK} Route #/patients, signed in as the admin. Open the row menu (⋮) of ${file(57, 'ميس عصام حمدان', 'Mais Issam Hamdan')} and choose **Delete**. Crop to the dialog that opens ([data-testid=pt-delete-blocked] inside [role=dialog]). No markers. Close it with **Close**.`,
    },
  ],
}
export default topic

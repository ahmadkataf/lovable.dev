import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in
// store/scripts/shoot.mjs; the English pictures use the English clinic of shoot.mjs (englishClinic), whose ready-made
// drug list is the same list in English. Demo patients are named by their file number, the same in every run and in
// both languages: look the id up with window.__dentora.db.patients (fileNo). The demo has 55 prescriptions; the
// newest is RX-000055 (8 Oct 2026, file #57). No picture here saves anything.
const DESK = 'Desktop 1440×900, demo clinic, clock fixed to Sunday 11 Oct 2026 11:40 (Asia/Damascus), trial bar hidden, signed in as the admin, as in store/scripts/shoot.mjs.'
const PHONE = 'Phone 390×844 (isMobile, hasTouch), demo clinic, same clock, trial bar hidden, signed in as the admin.'
const file = (n: number, ar: string, en: string) => `patient file #${n} (${ar} / ${en})`
const NEW_RX = 'Route #/prescriptions and reload, then click **New prescription** (وصفة جديدة) in the page header.'

const topic: GuideTopic = {
  slug: 'prescriptions',
  order: 9,
  icon: 'pill',
  title: { ar: 'الوصفات الطبية', en: 'Prescriptions' },
  summary: {
    ar: 'اكتب الوصفة في ثوانٍ من قائمة أدويتك بجرعاتها المعتادة، مع تنبيه فوري عند تعارض الدواء مع حساسية المريض، ثم اطبعها بترويسة العيادة أو أرسلها عبر واتساب.',
    en: 'Write a prescription in seconds from your own drug list with its usual doses, get warned at once when a drug clashes with the patient’s allergies, then print it on your letterhead or send it by WhatsApp.',
  },
  metaDescription: {
    ar: 'اكتب الوصفة في ثوانٍ من قائمة أدويتك بجرعاتها المعتادة، مع تنبيه فوري عند تعارض الدواء مع حساسية المريض، ثم اطبعها بترويسة العيادة أو أرسلها عبر واتساب.',
    en: 'Write prescriptions from your own drug list with usual doses, get an instant allergy warning, then print on your letterhead or send by WhatsApp.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'صفحة الوصفات', en: 'The prescriptions page' },
      text: {
        ar: [
          'افتح **الوصفات** من القائمة الجانبية. في تبويب **الوصفات** كل وصفات العيادة، الأحدث أولاً: التاريخ والمريض والطبيب والأدوية والتشخيص.',
          'ابحث باسم المريض أو رقم الملف أو اسم الدواء أو التشخيص أو رقم الوصفة، واختر الفترة: **الكل** أو **اليوم** أو **آخر 7 أيام** أو **آخر 30 يوماً** أو **هذا الشهر**.',
          'انقر على أي وصفة لتعرضها وتطبعها. وفي آخر كل سطر ثلاثة أزرار: الطابعة (**عرض وطباعة**) والنسخ (**نسخ كوصفة جديدة**) وسلة المهملات (**حذف**).',
        ],
        en: [
          'Open **Prescriptions** in the sidebar. The **Prescriptions** tab lists every prescription of the clinic, newest first: date, patient, doctor, medicines and diagnosis.',
          'Search by patient name, file number, drug, diagnosis or prescription number, and pick the period: **All**, **Today**, **Last 7 days**, **Last 30 days** or **This month**.',
          'Click any prescription to view and print it. Each row ends with three icon buttons: the printer (**View & print**), copy (**Copy as new**) and the bin (**Delete**).',
        ],
      },
      tips: {
        ar: [
          'تبويب **قائمة الأدوية** يحفظ أدويتك المعتادة بجرعاتها. انظر [قائمة الأدوية](prescriptions#drugs).',
          'الوصفات متاحة للمدير والأطباء والمساعدين، ولا يراها موظف الاستقبال. انظر [الأدوار والصلاحيات](staff#roles).',
          'على الهاتف تظهر الوصفات بطاقات، وتجد **الوصفات** تحت **المزيد** في الشريط السفلي.',
          'في وضع القراءة فقط تستطيع عرض الوصفات وطباعتها، لكن لا يمكنك كتابة وصفة أو نسخها أو حذفها. انظر [الترخيص](licence).',
        ],
        en: [
          'The **Drug list** tab keeps your usual drugs with their doses. See [The drug list](prescriptions#drugs).',
          'Prescriptions are open to the admin, doctors and assistants; reception does not see them. See [Roles and permissions](staff#roles).',
          'On a phone the prescriptions show as cards, and **Prescriptions** is under **More** in the bottom bar.',
          'In read-only mode you can still view and print prescriptions, but you cannot write, copy or delete one. See [Licence](licence).',
        ],
      },
      shots: ['prescriptions-list'],
    },
    {
      id: 'write',
      title: { ar: 'كتابة وصفة', en: 'Writing a prescription' },
      text: {
        ar: ['اختر الدواء من قائمتك فتُملأ جرعته وتكراره ومدته وطريقة استعماله تلقائياً، ثم عدّل ما يلزم لهذا المريض.'],
        en: ['Pick a drug from your list and its dose, frequency, duration and instructions fill in by themselves; then adjust what this patient needs.'],
      },
      steps: {
        ar: [
          'انقر على **وصفة جديدة** في صفحة الوصفات، أو في تبويب **الوصفات** في ملف المريض.',
          'ابحث عن **المريض** بالاسم أو رقم الملف أو الهاتف واختره.',
          'تحقق من **الطبيب** و**التاريخ**، واكتب **التشخيص** إن شئت، مثل «التهاب لب حاد في السن 36».',
          'انقر في خانة البحث عن الدواء. تظهر أولاً الأدوية **الأكثر وصفاً** في عيادتك. اكتب جزءاً من الاسم بالعربية أو الأجنبية، ثم انقر على الدواء أو اضغط `Enter`.',
          'يُضاف الدواء سطراً فيه **التركيز** و**الجرعة** و**التكرار** و**المدة** و**طريقة الاستعمال**. عدّل أياً منها، أو اختر من الاقتراحات.',
          'كرر ذلك لكل دواء، وأضف **ملاحظات** للمريض إن شئت، ثم انقر على **حفظ الوصفة**. تنفتح الوصفة جاهزة للطباعة.',
        ],
        en: [
          'Click **New prescription** on the Prescriptions page, or in the **Prescriptions** tab of the patient’s file.',
          'Search for the **Patient** by name, file number or phone and pick them.',
          'Check the **Doctor** and **Date**, and type a **Diagnosis** if you wish, such as “Acute pulpitis, tooth 36”.',
          'Click in the drug search box. Your clinic’s **Most prescribed** drugs come first. Type part of the name in Arabic or English, then click the drug or press `Enter`.',
          'The drug is added as a line with its **Strength**, **Dose**, **Frequency**, **Duration** and **Instructions**. Change any of them, or pick from the suggestions.',
          'Repeat for each medicine, add **Notes** for the patient if you wish, then click **Save prescription**. The prescription opens, ready to print.',
        ],
      },
      tips: {
        ar: [
          'إذا لم يكن الدواء في قائمتك فاكتب اسمه ثم اختر «إضافة … كدواء غير مُدرج»، أو انقر على **إضافة سطر فارغ** واكتبه بنفسك.',
          'تقترح خانة **المدة** 3 و5 و7 و10 و14 يوماً و«عند اللزوم»، وتقترح خانة **التكرار** مثل «كل 8 ساعات» و«قبل النوم».',
          'لحذف دواء من الوصفة انقر على سلة المهملات في سطره.',
          'الطبيب مطلوب، والقائمة تضم الأطباء والمدير. ويُقترح الطبيب المسجّل دخوله، أو الطبيب المعالج للمريض.',
          'حين تفتح الوصفة الجديدة من ملف المريض يكون المريض محدداً سلفاً.',
        ],
        en: [
          'If the drug is not in your list, type its name and choose “Add … as an unlisted drug”, or click **Add an empty line** and type it yourself.',
          'The **Duration** box suggests 3, 5, 7, 10 and 14 days and “As needed”; **Frequency** suggests values such as “Every 8 hours” and “At bedtime”.',
          'To take a medicine off the prescription, click the bin on its line.',
          'The doctor is required; the list holds the doctors and the admin. The signed-in doctor, or else the patient’s treating doctor, is suggested.',
          'When you start a prescription from the patient’s file, the patient is already set.',
        ],
      },
      shots: ['prescriptions-form'],
    },
    {
      id: 'allergy',
      title: { ar: 'تنبيهات الحساسية', en: 'Allergy warnings' },
      text: {
        ar: [
          'يقارن البرنامج اسم كل دواء بالحساسية المسجلة في ملف المريض، وينبّهك حين يتعرف على تعارض.',
          'إذا كان في ملف المريض حساسية يظهر فوق قائمة الأدوية شريط أحمر «تنبيه: المريض لديه تحسس من» وتحته ما سُجّل.',
        ],
        en: [
          'Dentora compares each drug’s name with the allergies recorded in the patient’s file, and warns you when it recognises a clash.',
          'If the file records an allergy, a red “Warning: the patient is allergic to” bar sits above the medicines, with what was recorded.',
        ],
      },
      steps: {
        ar: [
          'راجع الشريط الأحمر فوق قائمة الأدوية قبل اختيارها.',
          'في قائمة البحث تظهر علامة تحذير بجانب الدواء الذي يتعارض مع الحساسية.',
          'إذا أضفته يتلوّن سطره بالأحمر ويظهر تحته سبب التعارض: الدواء نفسه، أو دواء من العائلة نفسها، أو تحسس متصالب محتمل.',
          'عند الحفظ يسألك البرنامج مرة أخرى. انقر على **مراجعة الأدوية** لتغيير الدواء، أو على **الحفظ رغم التحذير** إن كنت متأكداً من سلامته.',
        ],
        en: [
          'Read the red bar above the medicines before choosing them.',
          'In the search list, a warning sign shows next to any drug that clashes with the allergy.',
          'If you add it, its line turns red and the reason shows under it: the same drug, a drug of the same family, or a possible cross-reaction.',
          'When you save, Dentora asks once more. Click **Review medicines** to change the drug, or **Save anyway** if you are sure it is safe.',
        ],
      },
      tips: {
        ar: [
          'يعرف البرنامج عائلات الأدوية الشائعة في طب الأسنان، كالبنسلينات والسيفالوسبورينات والماكروليدات ومضادات الالتهاب غير الستيروئيدية والمخدرات الموضعية، ويتعرف على أسمائها العربية والأجنبية.',
          'المريض المتحسس من البنسلين يُنبَّه أيضاً عند وصف السيفالوسبورينات، لاحتمال التحسس المتصالب.',
          'سجّل الحساسية في ملف المريض أولاً ليعمل التنبيه. انظر [الحالة الصحية](patients#medical).',
          'يتعرف التنبيه على الأسماء العلمية والأسماء التجارية الشائعة فقط. فالدواء المكتوب باسم تجاري لا يعرفه البرنامج، والحساسية المكتوبة بعبارة عامة مثل «المضادات الحيوية»، لا يظهر لهما تنبيه على سطر الدواء. لذلك اقرأ الشريط الأحمر دائماً؛ فالتنبيه عون لك، ولا يغني عن خبرة الطبيب وسؤال المريض.',
        ],
        en: [
          'Dentora knows the drug families common in dentistry, such as penicillins, cephalosporins, macrolides, NSAIDs and local anaesthetics, by their Arabic and English names.',
          'A patient allergic to penicillin is also warned about cephalosporins, because of a possible cross-reaction.',
          'Record allergies in the patient’s file first for the warning to work. See [Medical status](patients#medical).',
          'The warning knows generic names and common brand names only. A drug typed under a brand it does not know, or an allergy written in general words such as “Antibiotics”, gets no warning on the medicine line. So always read the red bar: the warning is a help, and it does not replace the doctor’s judgement or asking the patient.',
        ],
      },
      shots: ['prescriptions-allergy', 'prescriptions-allergy-confirm'],
    },
    {
      id: 'sheet',
      title: { ar: 'طباعة الوصفة وإرسالها', en: 'Printing and sending a prescription' },
      text: {
        ar: ['تُطبع الوصفة بترويسة العيادة، وفيها اسم الطبيب واختصاصه، وبيانات المريض: الاسم والعمر والجنس ورقم الملف، ثم التاريخ ورقم الوصفة والتشخيص والأدوية بجرعاتها، وفي أسفلها مكان لتوقيع الطبيب وختمه.'],
        en: ['The prescription prints on the clinic letterhead with the doctor’s name and specialty, the patient’s name, age, gender and file number, then the date, prescription number, diagnosis and medicines with their doses, and room at the bottom for the doctor’s signature and stamp.'],
      },
      steps: {
        ar: [
          'افتح الوصفة بالنقر عليها في القائمة، أو تظهر لك مباشرة بعد الحفظ.',
          'انقر على **طباعة** واختر الطابعة أو الحفظ بصيغة PDF.',
          'أو انقر على **واتساب** لترسل الوصفة للمريض رسالةً نصية.',
          'لتغيير الوصفة انقر على **تعديل**. ولكتابة وصفة مشابهة في زيارة جديدة انقر على **نسخ مكرر**.',
        ],
        en: [
          'Open the prescription by clicking it in the list; it also opens right after you save.',
          'Click **Print** and choose a printer or save as PDF.',
          'Or click **WhatsApp** to send the prescription to the patient as a text message.',
          'To change it click **Edit**. To write a similar one at a new visit, click **Duplicate**.',
        ],
      },
      tips: {
        ar: [
          'لكل وصفة رقم متسلسل، مثل RX-000056، يُطبع عليها فيستطيع الصيدلي والعيادة الإشارة إليها.',
          'النص في أسفل الوصفة هو **تذييل الوصفة الطبية** من [الإعدادات](settings#invoices-numbering). إن تركته فارغاً يُطبع نص يتمنى للمريض الشفاء ويذكّره بالالتزام بالجرعات.',
          'النسخ يفتح وصفة جديدة بتاريخ اليوم، فيها المريض والتشخيص والأدوية والملاحظات نفسها، فتعدّل ما تشاء ثم تحفظ.',
          'رسالة واتساب تضم اسم العيادة ورقم الوصفة وتاريخها واسم المريض والطبيب والتشخيص والأدوية بجرعاتها وهاتف العيادة، ولا تُرفق ملفاً. ويعمل الزر حين يكون للمريض رقم هاتف.',
          'على أندرويد يفتح زر واتساب محادثة المريض في تطبيق واتساب. وعلى ويندوز يُفتح الرابط في المتصفح لتكمل في واتساب ويب أو تطبيق واتساب على الحاسوب.',
          'على ويندوز تُفتح نافذة الطباعة في ويندوز، ولحفظ PDF اختر «Microsoft Print to PDF». وعلى أندرويد تُفتح شاشة الطباعة في النظام، وفيها خيار الحفظ بصيغة PDF.',
          'على الهاتف تنفتح الوصفة من أسفل الشاشة، ولا يظهر فيها زر **نسخ مكرر**؛ استعمل زر **نسخ كوصفة جديدة** في القائمة.',
        ],
        en: [
          'Each prescription has a running number, such as RX-000056, printed on it so the pharmacist and the clinic can refer to it.',
          'The text at the bottom is the **Prescription footer** from [Settings](settings#invoices-numbering). If you leave it empty, a default text wishes the patient a speedy recovery and reminds them to follow the doses.',
          'Duplicating opens a new prescription dated today with the same patient, diagnosis, medicines and notes; change what you need, then save.',
          'The WhatsApp message holds the clinic name, prescription number and date, patient, doctor, diagnosis, the medicines with their doses and the clinic phone; it attaches no file. The button works when the patient has a phone number.',
          'On Android the WhatsApp button opens the patient’s chat in the WhatsApp app. On Windows the link opens in the browser, where you continue in WhatsApp Web or the WhatsApp desktop app.',
          'On Windows the Windows print dialog opens; to save a PDF choose “Microsoft Print to PDF”. On Android the system print screen opens, with a save-as-PDF option.',
          'On a phone the prescription slides up from the bottom of the screen without the **Duplicate** button; use **Copy as new** in the list instead.',
        ],
      },
      shots: ['prescriptions-sheet', 'prescriptions-phone'],
    },
    {
      id: 'patient-tab',
      title: { ar: 'الوصفات في ملف المريض', en: 'Prescriptions in the patient file' },
      text: {
        ar: ['تبويب **الوصفات** في ملف المريض يجمع وصفاته، الأحدث أولاً. يظهر لكل وصفة تاريخها وتشخيصها وأسماء أدويتها وطبيبها وعدد أدويتها.'],
        en: ['The **Prescriptions** tab of the patient’s file gathers their prescriptions, newest first. Each shows its date, diagnosis, medicine names, doctor and number of medicines.'],
      },
      steps: {
        ar: [
          'افتح ملف المريض، ثم تبويب **الوصفات**.',
          'انقر على وصفة لعرضها، أو على زر الطابعة بجانبها.',
          'انقر على زر النسخ لتكتب وصفة جديدة بالأدوية نفسها.',
          'انقر على **وصفة جديدة** لتكتب وصفة يكون المريض فيها محدداً سلفاً.',
        ],
        en: [
          'Open the patient’s file, then the **Prescriptions** tab.',
          'Click a prescription to view it, or the printer button next to it.',
          'Click the copy button to write a new prescription with the same medicines.',
          'Click **New prescription** to write one with the patient already set.',
        ],
      },
      tips: {
        ar: [
          'يعرض التبويب أول 10 وصفات، ثم زر **عرض المزيد** لما بعدها.',
          'بجانب الوصفات الحديثة يظهر «اليوم» أو «أمس» أو اسم اليوم خلال الأسبوع الأخير.',
          'عدد الوصفات يظهر على اسم التبويب.',
        ],
        en: [
          'The tab shows the first 10 prescriptions, then a **Show more** button for the rest.',
          'Recent ones are marked “Today”, “Yesterday” or the weekday during the last week.',
          'The number of prescriptions shows on the tab’s name.',
        ],
      },
      shots: ['prescriptions-patient-tab'],
    },
    {
      id: 'drugs',
      title: { ar: 'قائمة الأدوية', en: 'The drug list' },
      text: {
        ar: [
          'قائمة الأدوية هي ما تقترحه خانة البحث في الوصفة. لكل دواء اسمه بالعربية والأجنبية، وشكله الدوائي، وتركيزه، وجرعته الافتراضية.',
          'عند إعداد البرنامج تُحمَّل قائمة جاهزة من 37 دواءً من أكثر ما يُوصف في طب الأسنان، بجرعاتها المعتادة وبلغة العيادة.',
        ],
        en: [
          'The drug list is what the prescription’s search box offers. Each drug has its Arabic and English names, form, strength and default regimen.',
          'When Dentora is set up, a ready list of 37 drugs dentists prescribe most is loaded, with their usual doses, in the clinic’s language.',
        ],
      },
      steps: {
        ar: [
          'افتح **الوصفات** ثم تبويب **قائمة الأدوية**.',
          'لإضافة دواء انقر على **إضافة دواء**، واكتب **اسم الدواء** و**الاسم الأجنبي** و**الشكل الدوائي** و**التركيز**.',
          'في قسم **الجرعة الافتراضية** اكتب **الجرعة** واختر **التكرار** و**المدة** و**طريقة الاستعمال**، ثم انقر على **إضافة دواء**.',
          'لتعديل دواء انقر على سطره، ثم على **حفظ التغييرات**.',
          'لإخفاء دواء من الوصفات الجديدة أطفئ مفتاح **نشط** في سطره. ولحذفه نهائياً انقر على سلة المهملات؛ ولا تظهر السلة على الهاتف، فاحذف من الحاسوب.',
        ],
        en: [
          'Open **Prescriptions**, then the **Drug list** tab.',
          'To add a drug click **Add drug**, and type the **Drug name**, **English name**, **Form** and **Strength**.',
          'Under **Default regimen** type the **Dose** and choose the **Frequency**, **Duration** and **Instructions**, then click **Add drug**.',
          'To edit a drug click its row, then **Save changes**.',
          'To hide a drug from new prescriptions, turn off the **Active** switch on its row. To delete it for good, click the bin; there is no bin on a phone, so delete from a computer.',
        ],
      },
      tips: {
        ar: [
          'يكفي أن تكتب أحد الاسمين، العربي أو الأجنبي.',
          'القيم الافتراضية تُملأ في الوصفة تلقائياً، وتستطيع تعديلها لكل مريض.',
          'حذف الدواء أو إيقافه لا يغيّر الوصفات السابقة.',
          'إذا كانت القائمة فارغة يظهر زر **تحميل القائمة الجاهزة**.',
        ],
        en: [
          'One name is enough, Arabic or English.',
          'The defaults fill in the prescription automatically, and you can change them for each patient.',
          'Deleting or deactivating a drug does not change past prescriptions.',
          'If the list is empty, a **Load the ready-made list** button appears.',
        ],
      },
      shots: ['prescriptions-drugs', 'prescriptions-drug-form'],
    },
  ],
  shots: [
    {
      id: 'prescriptions-list',
      device: 'desktop',
      alt: { ar: 'صفحة الوصفات: تبويبا الوصفات وقائمة الأدوية، والبحث والفترات، وجدول الوصفات مع أزرار الطباعة والنسخ والحذف', en: 'The prescriptions page: the Prescriptions and Drug list tabs, search and periods, and the table with print, copy and delete buttons' },
      recipe: `${DESK} Route #/prescriptions and reload (tab Prescriptions, period All, no search). Page at its top. Capture the whole window. No markers.`,
    },
    {
      id: 'prescriptions-form',
      device: 'desktop',
      alt: { ar: 'نافذة وصفة جديدة: المريض والطبيب والتاريخ والتشخيص، وخانة البحث عن دواء، ودواءان مضافان بجرعاتهما', en: 'The New prescription window: patient, doctor, date and diagnosis, the drug search box, and two medicines added with their doses' },
      recipe: `${DESK} ${NEW_RX} In the patient search type “حسام مارديني” (EN: “Hussam Mardini”) and press Enter to pick ${file(18, 'حسام مارديني', 'Hussam Mardini')}. Type the diagnosis “خراج ذروي حاد — السن 37” (EN: “Acute apical abscess — tooth 37”). In the drug search type “أموكسيسيلين” (EN: “Amoxicillin”) and press Enter, then “إيبوبروفين” (EN: “Ibuprofen”) and press Enter; press Escape so the suggestion list is closed and both medicine lines show with their Strength, Dose, Frequency, Duration and Instructions. Crop to the dialog. Markers: 2 on the patient card, 3 on the Doctor, Date and Diagnosis fields, 4 on the drug search box, 5 on the first medicine line (away from the Medicines count badge), 6 on **Save prescription**. Cancel afterwards (do not save).`,
    },
    {
      id: 'prescriptions-allergy',
      device: 'desktop',
      alt: { ar: 'وصفة لمريضة متحسسة من البنسلين: الشريط الأحمر في الأعلى، وسطر الأموكسيسيلين بالأحمر مع سبب التعارض', en: 'A prescription for a patient allergic to penicillin: the red bar at the top, and the amoxicillin line in red with the reason' },
      recipe: `${DESK} ${NEW_RX} In the patient search type “لمى مازن” (EN: “Lama Mazen”) and press Enter to pick ${file(6, 'لمى مازن الدبّاغ', 'Lama Mazen Dabbagh')} (allergy: البنسلين / Penicillin). Type the diagnosis “التهاب لب حاد في السن 36” (EN: “Acute pulpitis, tooth 36”). In the drug search type “أموكس” (EN: “Amox”) and press Enter (adds Amoxicillin 500 mg), then “باراسيتامول” (EN: “Paracetamol”) and press Enter. Click the dialog title to close the list. Crop to the dialog. Markers: 1 on the red allergy bar, 3 on the warning under the amoxicillin line. Keep the dialog open for prescriptions-allergy-confirm.`,
    },
    {
      id: 'prescriptions-allergy-confirm',
      device: 'desktop',
      alt: { ar: 'سؤال التأكيد عند حفظ وصفة فيها دواء يتعارض مع حساسية المريض', en: 'The confirmation asked when saving a prescription with a drug that clashes with the patient’s allergy' },
      recipe: `${DESK} Continue from prescriptions-allergy: click **Save prescription** (حفظ الوصفة). The confirmation **Conflicts with a recorded allergy** opens over the form. Crop to the confirmation dialog (the last [role=dialog]). Markers: 4 on **Review medicines** and **Save anyway**. Click **Review medicines**, then Cancel the form (do not save).`,
    },
    {
      id: 'prescriptions-sheet',
      device: 'desktop',
      alt: { ar: 'الوصفة جاهزة للطباعة: ترويسة العيادة واسم الطبيب وبيانات المريض ورقم الوصفة والتشخيص والأدوية، مع أزرار واتساب ونسخ مكرر وتعديل وطباعة', en: 'A prescription ready to print: letterhead, doctor, patient details, prescription number, diagnosis and medicines, with the WhatsApp, Duplicate, Edit and Print buttons' },
      recipe: `${DESK} Route #/prescriptions and reload. Click the date cell of the first row (8 Oct 2026, ميس عصام حمدان / Mais Issam Hamdan #57, RX-000055, “خراج ذروي حاد — السن 14”); the patient’s name is a link to the patient file, so avoid it. Crop to the dialog. Markers: 2 on **Print**, 3 on **WhatsApp**, 4 on **Edit** and **Duplicate**. Close afterwards.`,
    },
    {
      id: 'prescriptions-phone',
      device: 'phone',
      alt: { ar: 'وصفة على الهاتف تنفتح من أسفل الشاشة مع أزرار واتساب وتعديل وطباعة', en: 'A prescription on a phone, opened from the bottom of the screen with the WhatsApp, Edit and Print buttons' },
      recipe: `${PHONE} Route #/prescriptions and reload; tap the first card (Mais Issam Hamdan, 8 Oct 2026). Wait for the sheet to slide up. Capture the whole screen. No markers.`,
    },
    {
      id: 'prescriptions-patient-tab',
      device: 'desktop',
      alt: { ar: 'تبويب الوصفات في ملف المريض: ست وصفات بتواريخها وتشخيصاتها وأدويتها وأزرار الطباعة والنسخ', en: 'The Prescriptions tab of a patient file: six prescriptions with dates, diagnoses, medicines and the print and copy buttons' },
      recipe: `${DESK} Open ${file(18, 'حسام مارديني', 'Hussam Mardini')} at #/patients/<id>?tab=prescriptions and reload; scroll so the tab bar (.pt-tabs) sits just under the top bar. Capture the whole window. Markers: 1 on the **Prescriptions** tab, 2 on the printer button of the first row, 3 on its copy button, 4 on **New prescription**.`,
    },
    {
      id: 'prescriptions-drugs',
      device: 'desktop',
      alt: { ar: 'قائمة الأدوية: الاسم بالعربية والأجنبية والشكل والتركيز والجرعة الافتراضية ومفتاح التفعيل', en: 'The drug list: Arabic and English names, form, strength, default regimen and the Active switch' },
      recipe: `${DESK} Route #/prescriptions?tab=drugs and reload (All, no search). Page at its top. Capture the whole window. Markers: 2 on **Add drug**, 4 on the first row, 5 on the Active switch and the bin of the first row.`,
    },
    {
      id: 'prescriptions-drug-form',
      device: 'desktop',
      alt: { ar: 'نافذة تعديل دواء: الاسمان والشكل الدوائي والتركيز والجرعة الافتراضية ومفتاح الظهور في الوصفات', en: 'The Edit drug window: both names, form, strength, the default regimen and the Shown in prescriptions switch' },
      recipe: `${DESK} Route #/prescriptions?tab=drugs and reload. Click the row “أموكسيسيلين / Amoxicillin” (500 mg, capsules). Crop to the dialog. Markers: 2 on the name, English name, form and strength fields, 3 on the Default regimen section, 4 on **Save changes**. Cancel afterwards.`,
    },
  ],
}

export default topic

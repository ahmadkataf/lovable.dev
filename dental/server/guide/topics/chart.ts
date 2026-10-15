import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in
// store/scripts/shoot.mjs. The chart patient is demo file #19 (the "chart" patient picked by shoot.mjs): look its id up
// by fileNo in window.__dentora.db.patients. Its fresh demo chart has teeth 45, 46 and 47 healthy; take
// chart-overview, chart-tooth-current and chart-history before the shots that write to the chart.
const DESK = 'Desktop 1600×900, demo clinic, clock fixed to Sunday 11 Oct 2026 11:40 (Asia/Damascus), trial bar hidden, as in store/scripts/shoot.mjs, signed in as the admin.'
const PHONE = 'Phone 405×720 (isMobile, hasTouch), demo clinic, same clock, trial bar hidden.'
const P19 = 'patient file #19 (مريم يوسف البيطار / Mariam Youssef Bitar)'
const CHART = `Open ${P19} at #/patients/<id>?tab=chart and reload, so no tooth panel is left open.`

const topic: GuideTopic = {
  slug: 'chart',
  order: 5,
  icon: 'tooth',
  title: { ar: 'مخطط الأسنان', en: 'Dental chart' },
  summary: {
    ar: 'سجّل التسوس والحشوات والتيجان وكل حالة على السن أو على أسطحه، بنقرة أو بالرسم السريع، واحتفظ بسجل كامل لكل تغيير، واطبع المخطط حين تحتاجه.',
    en: 'Record caries, fillings, crowns and every other finding on a tooth or its surfaces, with a click or with quick paint; keep a full history of every change, and print the chart when you need it.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'نظرة على المخطط', en: 'The chart at a glance' },
      text: {
        ar: [
          'افتح ملف المريض ثم تبويب **مخطط الأسنان**. تظهر الأسنان بترقيم FDI المعتاد: الفك العلوي في الأعلى والسفلي في الأسفل، وجهة المريض اليمنى على يسارك كما في المخططات الورقية، مع اسم كل ربع ورقمه.',
          'فوق المخطط أرقام سريعة: **تسوس** و**حشوات** و**تيجان** و**مفقودة** و**زرعات** و**معالجة لبية**، ثم **مؤشر DMFT** الذي يجمع الأسنان المسوّسة والمفقودة والمرمّمة.',
          'تحت المخطط **دليل الحالات** بألوانها، وبجانب كل حالة عدد الأسنان التي تحملها.',
        ],
        en: [
          'Open the patient’s file, then the **Dental chart** tab. The teeth are drawn in the usual FDI numbering: upper jaw on top, lower jaw below, and the patient’s right on your left as on a paper chart, with each quadrant named and numbered.',
          'Quick figures sit above the chart: **Caries**, **Fillings**, **Crowns**, **Missing**, **Implants** and **Root canal**, then the **DMFT index**, which adds up the decayed, missing and filled teeth.',
          'Under the chart, the **Legend** shows every condition’s colour and how many teeth carry it.',
        ],
      },
      tips: {
        ar: [
          'اختر نوع الإطباق بالأزرار **دائمة** و**مختلطة** و**لبنية**. يقترح البرنامج النوع المناسب لعمر المريض ويضع بجانبه نقطة: لبنية تحت 6 سنوات، ومختلطة من 6 إلى 12 سنة، ودائمة بعد ذلك.',
          'إذا كانت هناك حالات على أسنان لا يُظهرها الإطباق المختار ينبّهك البرنامج ويعرض زر **عرض الإطباق المختلط**.',
          'على الحاسوب، مرّر المؤشر فوق أي سن لترى اسمه الكامل وحالاته، مثل «الرحى الأولى السفلية اليسرى».',
          'المخطط الفارغ يعني أن الأسنان كلها سليمة، ويعرض زر **ابدأ الرسم السريع** لتعبئته بسرعة.',
          'يسجّل التشخيصات الأطباء والمساعدون والمدير. لا يظهر هذا التبويب لموظف الاستقبال. انظر [الفريق والصلاحيات](staff).',
        ],
        en: [
          'Choose the dentition with **Permanent**, **Mixed** and **Primary**. The app suggests the one that suits the patient’s age and marks it with a dot: primary under 6, mixed from 6 to 12, permanent after that.',
          'If findings are recorded on teeth the chosen dentition does not show, the app says so and offers **Show mixed dentition**.',
          'On a computer, hover over a tooth to see its full name and findings, such as “Lower left first molar”.',
          'An empty chart means every tooth is healthy; it offers **Start quick paint** to fill it in quickly.',
          'Doctors, assistants and admins record findings. Receptionists do not see this tab. See [Staff and permissions](staff).',
        ],
      },
      shots: ['chart-overview'],
    },
    {
      id: 'record',
      title: { ar: 'تسجيل تشخيص على سن', en: 'Recording a finding on a tooth' },
      text: {
        ar: ['في وضع **تحديد** يفتح النقر على أي سن لوحة خاصة به: رسم كبير للسن وأسطحه، وحالته الحالية، ونموذج لتسجيل تشخيص جديد.'],
        en: ['In **Select** mode, clicking a tooth opens its panel: a large drawing of the tooth and its surfaces, its current state, and a form to record a new finding.'],
      },
      steps: {
        ar: [
          'تأكد أن الوضع **تحديد**، ثم انقر على السن في المخطط.',
          'راجع **الحالة الحالية**: كل تشخيص قائم على السن مع أسطحه وتاريخه ومن سجّله.',
          'تحت **تسجيل تشخيص** اختر الحالة: من **على الأسطح** (**تسوس** و**حشوة** و**سادّ شقوق** و**كسر**)، أو من **على السن كاملاً** مثل **تاج** و**معالجة لبية** و**جسر** و**زرعة** و**مفقود** و**يحتاج إلى قلع**.',
          'لحالات الأسطح اختر سطحاً واحداً على الأقل: انقر عليه في رسم السن أعلى اللوحة، أو من أزرار **الأسطح**: **أنسي (M)** و**وحشي (D)** و**طاحن (O)** (أو **حدّي (I)** في الأسنان الأمامية) و**دهليزي (B)** و**لساني (L)** و**جذر (R)**.',
          'اكتب **ملاحظة** إن شئت، مثل «تسوس عميق قريب من اللب».',
          'انقر على **حفظ التشخيص**، أو اضغط `Ctrl+Enter` في خانة الملاحظة. يتلوّن السن في المخطط فوراً، وتبقى اللوحة مفتوحة لتسجيل تشخيص آخر.',
        ],
        en: [
          'Make sure the mode is **Select**, then click the tooth on the chart.',
          'Check the **Current state**: every finding on the tooth with its surfaces, date and who recorded it.',
          'Under **Record a finding**, choose the condition: **On surfaces** (**Caries**, **Filling**, **Sealant**, **Fracture**) or **Whole tooth**, such as **Crown**, **Root canal**, **Bridge**, **Implant**, **Missing** or **To extract**.',
          'For a surface condition pick at least one surface: click it on the drawing at the top of the panel, or use the **Surfaces** buttons: **Mesial (M)**, **Distal (D)**, **Occlusal (O)** (**Incisal (I)** on front teeth), **Buccal (B)**, **Lingual (L)** and **Root (R)**.',
          'Add a **Note** if you like, such as “deep caries close to the pulp”.',
          'Click **Save finding**, or press `Ctrl+Enter` in the note. The tooth changes colour on the chart at once, and the panel stays open for the next finding.',
        ],
      },
      tips: {
        ar: [
          'التشخيص الجديد يحلّ محل ما يغطيه فقط: حشوة على السطح O فوق تسوس على MOD تُبقي التسوس على M وD. والتاج يغطي الحشوات القديمة ويُبقي المعالجة اللبية، أما **يحتاج إلى قلع** و**متقلقل** و**خراج** و**سحل** و**أخرى** فتُضاف إلى ما على السن دون أن تمحوه.',
          'لمسح حالة بعد علاجها اختر **سليم** تحت **إعادة التعيين**: اختر الأسطح التي عولجت لتُمسح وحدها، أو لا تختر شيئاً ليعود السن كله سليماً.',
          'لحذف تشخيص سُجّل خطأً انقر على أيقونة سلة المهملات بجانبه في **الحالة الحالية**.',
          'زر **علاج هذا السن** ينقلك إلى تبويب العلاجات ويفتح بنداً علاجياً جديداً لهذا السن. وحين تُنهي هناك علاجاً على سن، كحشوة أو تاج أو معالجة لبية، يسألك البرنامج **تحديث مخطط الأسنان؟** ليبقى المخطط مطابقاً لما تم. انظر [العلاجات](treatments).',
          'أغلق اللوحة بزر ✕ أو بمفتاح `Esc`. على الهاتف تُفتح اللوحة من أسفل الشاشة.',
        ],
        en: [
          'A new finding replaces only what it covers: a filling on O over caries on MOD leaves the caries on M and D. A crown covers old fillings but keeps the root canal, while **To extract**, **Mobile**, **Abscess**, **Attrition** and **Other** are added on top of whatever the tooth already has.',
          'To clear a condition after treatment, choose **Healthy** under **Reset**: pick the treated surfaces to clear only those, or pick none to make the whole tooth healthy again.',
          'To remove a finding recorded by mistake, click the bin icon next to it under **Current state**.',
          '**Treat this tooth** takes you to the Treatments tab with a new treatment item for this tooth. When you mark treatment on a tooth done there, such as a filling, a crown or a root canal, the app asks **Update the dental chart?** so the chart matches what was done. See [Treatments](treatments).',
          'Close the panel with ✕ or `Esc`. On a phone the panel slides up from the bottom of the screen.',
        ],
      },
      shots: ['chart-tooth-current', 'chart-tooth-form'],
    },
    {
      id: 'quick-paint',
      title: { ar: 'الرسم السريع', en: 'Quick paint' },
      text: {
        ar: ['لتعبئة مخطط مريض جديد في دقائق: اختر الحالة مرة واحدة، ثم انقر على الأسنان أو الأسطح لتطبيقها مباشرة، دون أن تفتح لوحة لكل سن.'],
        en: ['To fill in a new patient’s chart in minutes, pick a condition once, then click teeth or surfaces to apply it straight away, without opening a panel for each tooth.'],
      },
      steps: {
        ar: [
          'انقر على **رسم سريع** أعلى المخطط، أو انقر مباشرة على حالة في **دليل الحالات**.',
          'اختر الحالة من **اختر حالة للرسم** تحت المخطط. يذكّرك شريط فوق المخطط بالحالة التي ترسم بها الآن.',
          'انقر على السطح المطلوب لحالات الأسطح، أو على أي مكان في السن للحالات الكاملة مثل **تاج** و**مفقود**. النقر مرة ثانية على المكان نفسه يزيل الحالة.',
          'لتصحيح خطأ اختر **ممحاة (سليم)**: انقر على سطح لتمسحه، أو على رقم السن ليعود سليماً بالكامل.',
          'انقر على **إنهاء الرسم** لتعود إلى وضع **تحديد**.',
        ],
        en: [
          'Click **Quick paint** above the chart, or click a condition in the **Legend** directly.',
          'Choose the condition under **Pick a condition to paint** below the chart. A bar above the chart reminds you what you are painting with.',
          'Click the surface for a surface condition, or anywhere on the tooth for a whole-tooth condition such as **Crown** or **Missing**. Clicking the same place again removes it.',
          'To fix a mistake choose **Eraser (healthy)**: click a surface to clear it, or the tooth number to make the whole tooth healthy.',
          'Click **Done painting** to go back to **Select** mode.',
        ],
      },
      tips: {
        ar: [
          'كل نقرة تُحفظ فوراً وتُسجَّل في سجل المخطط باسمك وتاريخها، فلا حاجة إلى زر حفظ.',
          'الرسم السريع لا يضيف ملاحظات. لإضافة ملاحظة إلى تشخيص استخدم لوحة السن في وضع **تحديد**.',
          'على الهاتف يُفتح المخطط مكبّراً ليسهل النقر على الأسطح؛ اسحبه جانباً لتصل إلى بقية الأسنان.',
        ],
        en: [
          'Every click is saved at once and logged in the chart history with your name and the date, so there is no Save button.',
          'Quick paint adds no notes. To add a note to a finding, use the tooth panel in **Select** mode.',
          'On a phone the chart opens zoomed in so surfaces are easy to tap; swipe it sideways to reach the other teeth.',
        ],
      },
      shots: ['chart-quick-paint'],
    },
    {
      id: 'history',
      title: { ar: 'سجل المخطط', en: 'Chart history' },
      text: {
        ar: ['لا يضيع أي تشخيص: حين يحلّ تشخيص محل آخر يبقى القديم في السجل، فتعرف متى تغيّرت حالة كل سن ومن سجّلها.'],
        en: ['No finding is ever lost: when a new one replaces an older one, the older one stays in the history, so you know when each tooth changed and who recorded it.'],
      },
      steps: {
        ar: [
          'انقر على **السجل** أعلى المخطط. تظهر التشخيصات كلها من الأحدث إلى الأقدم، مجمّعة حسب اليوم، مع الوقت واسم من سجّلها.',
          'اقرأ الشارات: **حالي** للتشخيص القائم، و**سابق** لما حلّ محله غيره، و**سُجّل سليماً** حين أُعيد السن سليماً.',
          'لترى سناً واحداً افتحه بالنقر عليه في المخطط، ثم اختر في أعلى السجل الزر الذي يحمل رقمه، مثل **السن 36 فقط**.',
          'لإرجاع تشخيص **سابق** انقر على أيقونة الاستعادة بجانبه، ولحذف سطر نهائياً انقر على سلة المهملات.',
        ],
        en: [
          'Click **History** above the chart. Every finding is listed newest first, grouped by day, with the time and who recorded it.',
          'Read the badges: **Current** for a finding in place, **Superseded** for one that a newer finding replaced, and **Marked healthy** when the tooth was reset to healthy.',
          'To see one tooth only, open it by clicking it on the chart, then choose the button with its number at the top of the history, such as **Tooth 36 only**.',
          'To bring back a **Superseded** finding click the restore icon next to it; to delete a line for good click the bin.',
        ],
      },
      tips: {
        ar: [
          'انقر على رقم السن في السجل لتفتح لوحته.',
          'لكل سن سجله أيضاً: افتح **سجل السن** في أسفل لوحة السن.',
          'الحذف من السجل نهائي، ويطلب البرنامج تأكيده قبل التنفيذ.',
          'تظهر تغييرات المخطط أيضاً في **آخر النشاطات** في تبويب **نظرة عامة** من ملف المريض.',
        ],
        en: [
          'Click a tooth number in the history to open that tooth’s panel.',
          'Each tooth has its own history too: open **Tooth history** at the bottom of the tooth panel.',
          'Deleting from the history is permanent, and the app asks you to confirm first.',
          'Chart changes also appear under **Recent activity** in the **Overview** tab of the patient’s file.',
        ],
      },
      shots: ['chart-history'],
    },
    {
      id: 'print',
      title: { ar: 'طباعة المخطط', en: 'Printing the chart' },
      text: {
        ar: [
          'اطبع المخطط لتسلّمه للمريض أو ترفقه بتحويل إلى طبيب آخر، أو احفظه ملف PDF.',
          'تحمل الورقة ترويسة العيادة (الشعار والاسم والعنوان والهاتف)، واسم المريض ورقم ملفه وعمره وتاريخ الطباعة، ثم المخطط بألوانه ودليله، ثم **ملخص الحالات**: جدول بكل تشخيص قائم مع السن والأسطح والملاحظة والتاريخ ومن سجّله.',
        ],
        en: [
          'Print the chart to hand to the patient or attach to a referral, or save it as a PDF.',
          'The page carries the clinic’s header (logo, name, address and phone), the patient’s name, file number and age, and the print date, then the chart with its colours and legend, then a **Findings summary**: a table of every current finding with tooth, surfaces, note, date and who recorded it.',
        ],
      },
      steps: {
        ar: [
          'اختر نوع الإطباق الذي تريد طباعته: **دائمة** أو **مختلطة** أو **لبنية**.',
          'انقر على **طباعة** أعلى المخطط.',
          'في نافذة الطباعة اختر الطابعة، أو اختر الحفظ بصيغة PDF.',
        ],
        en: [
          'Choose the dentition to print: **Permanent**, **Mixed** or **Primary**.',
          'Click **Print** above the chart.',
          'In the print window choose your printer, or choose to save as PDF.',
        ],
      },
      tips: {
        ar: [
          'على ويندوز تُفتح نافذة الطباعة في ويندوز: اختر طابعتك، أو «Microsoft Print to PDF» لتحفظ ملف PDF.',
          'على أندرويد تُفتح شاشة الطباعة في النظام: اختر طابعة متصلة بالهاتف، أو خيار الحفظ بصيغة PDF.',
          'يحمل أمر الطباعة اسم المخطط واسم المريض، مثل «مخطط الأسنان - مريم يوسف البيطار»، فتعرفه بسهولة عند الحفظ.',
        ],
        en: [
          'On Windows the Windows print dialog opens: choose your printer, or “Microsoft Print to PDF” to save a PDF file.',
          'On Android the system print screen opens: choose a printer the phone can reach, or the save-as-PDF option.',
          'The print job is named after the chart and the patient, such as “Dental chart - Mariam Youssef Bitar”, so it is easy to recognise when you save it.',
        ],
      },
      shots: ['chart-print'],
    },
    {
      id: 'phone',
      title: { ar: 'المخطط على الهاتف', en: 'The chart on a phone' },
      text: {
        ar: ['يعمل المخطط على الهاتف كما يعمل على الحاسوب، مع فروق صغيرة تجعل النقر بالإصبع أسهل.'],
        en: ['The chart works on a phone just as on a computer, with a few changes that make it easy to use with a finger.'],
      },
      tips: {
        ar: [
          'يُفتح المخطط مكبّراً لتكون الأسنان كبيرة بما يكفي للمس. اسحبه يميناً ويساراً، أو انقر على زر العدسة (**ملاءمة الشاشة**) لترى الفم كاملاً، ثم **تكبير المخطط** للعودة. يتذكر البرنامج اختيارك على هذا الجهاز.',
          'تُفتح لوحة السن من أسفل الشاشة، وزرّا **علاج هذا السن** و**حفظ التشخيص** في أسفلها دائماً.',
          'يظهر زرا **السجل** و**طباعة** أيقونتين فقط بجانب أزرار الإطباق.',
          'زر الرجوع في أندرويد يغلق لوحة السن أولاً قبل أن يغادر الشاشة.',
        ],
        en: [
          'The chart opens zoomed in so the teeth are big enough to tap. Swipe it left and right, or tap the magnifier (**Fit to screen**) to see the whole mouth, and **Zoom chart** to go back. The app remembers your choice on this device.',
          'The tooth panel slides up from the bottom, with **Treat this tooth** and **Save finding** always at its foot.',
          '**History** and **Print** appear as icons only, next to the dentition buttons.',
          'The Android Back button closes the tooth panel first, before leaving the screen.',
        ],
      },
      shots: ['chart-phone', 'chart-phone-tooth'],
    },
  ],
  shots: [
    {
      id: 'chart-overview',
      device: 'desktop',
      alt: { ar: 'تبويب مخطط الأسنان: الأرقام السريعة ومؤشر DMFT، ثم المخطط بالأرباع الأربعة، ثم دليل الحالات', en: 'The Dental chart tab: quick figures and the DMFT index, then the chart with its four quadrants, then the legend' },
      recipe: `${DESK} ${CHART} Scroll so the profile tab bar (.pt-tabs) sits 6 px under the top bar (as the desktop "chart" screen of shoot.mjs). Capture the whole window. No markers.`,
    },
    {
      id: 'chart-tooth-current',
      device: 'desktop',
      alt: { ar: 'لوحة السن 36 مفتوحة بجانب المخطط: رسم السن وحالته الحالية (تاج ومعالجة لبية)', en: 'The panel of tooth 36 open beside the chart: the tooth drawing and its current state (crown and root canal)' },
      recipe: `${DESK} ${CHART} Scroll as in chart-overview, then click tooth 36 ([data-tooth="36"]). Wait 600 ms for the side panel (.drawer), left at its top. Capture the whole window. Markers: 1 on tooth 36 in the chart (it is outlined as selected), 2 on the "Current state" section of the panel.`,
    },
    {
      id: 'chart-tooth-form',
      device: 'desktop',
      alt: { ar: 'تسجيل تسوس على السطحين O وD من السن 46 مع ملاحظة، قبل النقر على حفظ التشخيص', en: 'Recording caries on surfaces O and D of tooth 46 with a note, before clicking Save finding' },
      recipe: `${DESK} ${CHART} Click tooth 46 ([data-tooth="46"]). In the panel click **Caries** (.ch-cond[data-cond="caries"]), then the surface chips **Occlusal (O)** and **Distal (D)** (.ch-surf-chip), and type the note "تسوس عميق قريب من اللب" (EN: "Deep caries close to the pulp"). Clicking scrolls the panel down to the form; leave it so the conditions, surfaces, note and the footer buttons are in view. Crop to the panel (.drawer). Markers: 3 on the Caries button, 4 on the Surfaces chips, 5 on the note box, 6 on **Save finding**. Then click Save finding.`,
    },
    {
      id: 'chart-quick-paint',
      device: 'desktop',
      alt: { ar: 'الرسم السريع: حشوة على السن 47 وتاج على السن 45، وشريط «ترسم الآن: تاج» فوق المخطط', en: 'Quick paint: a filling on tooth 47 and a crown on tooth 45, with the “Painting Crown” bar above the chart' },
      recipe: `${DESK} ${CHART} Click **Quick paint** in the chart toolbar (.ch-toolbar). Click the palette chip **Filling** (.ch-chip[data-cond="filled"]), then the surfaces [data-tooth="47"] [data-s="O"] and [data-tooth="47"] [data-s="M"]; click the chip **Crown** (.ch-chip[data-cond="crown"]), then tooth [data-tooth="45"]. Scroll the chart card (.ch-card) to just under the top bar. Crop to the chart card. Markers: 1 on the **Quick paint** switch, 2 on the Crown chip in the palette, 3 on tooth 45, 5 on **Done painting** in the bar above the chart. Then click Done painting.`,
    },
    {
      id: 'chart-history',
      device: 'desktop',
      alt: { ar: 'سجل المخطط: التشخيصات مجمّعة حسب اليوم مع شارات حالي وسابق وأزرار الاستعادة والحذف', en: 'The chart history: findings grouped by day with Current and Superseded badges and the restore and delete buttons' },
      recipe: `${DESK} ${CHART} Take it on the fresh demo chart (before chart-tooth-form and chart-quick-paint). Click **History** in the chart toolbar; scroll the history card ([data-testid="ch-history"]) to just under the top bar. Crop to the history card, from its top to the end of the day group that holds the two superseded findings of tooth 36 (12 July 2026). Markers: 2 on the **Superseded** badge of the tooth 36 Abscess line, 4 on the restore icon of that line.`,
    },
    {
      id: 'chart-print',
      device: 'desktop',
      alt: { ar: 'ورقة مخطط الأسنان المطبوعة: ترويسة العيادة وبيانات المريض والمخطط وجدول ملخص الحالات', en: 'The printed dental chart: clinic header, patient details, the chart and the findings summary table' },
      recipe: `${DESK} ${CHART} Stub the print call first: page.evaluate(() => { window.print = () => {} }). Click the toolbar button **Print** (aria-label "Print chart" / "طباعة المخطط"); the print sheet (.ch-print-sheet) is added to the page. Set the viewport to 794×1123, page.emulateMedia({ media: 'print' }), wait 400 ms and take a full-page screenshot (the sheet alone is visible in print media), with 24 px white padding added around it. Then emulateMedia screen, dispatch an 'afterprint' event and restore the viewport. No markers.`,
    },
    {
      id: 'chart-phone',
      device: 'phone',
      alt: { ar: 'مخطط الأسنان على الهاتف مكبّراً، مع أزرار التحديد والرسم السريع والإطباق والسجل والطباعة والعدسة', en: 'The dental chart on a phone, zoomed in, with the select, quick paint, dentition, history, print and zoom buttons' },
      recipe: `${PHONE} Open ${P19} at #/patients/<id>?tab=chart (zoom left at its default, on). Scroll so the chart card (.ch-card) sits just under the top bar (as the phone "chart" screen of shoot.mjs). Capture the whole screen. No markers.`,
    },
    {
      id: 'chart-phone-tooth',
      device: 'phone',
      alt: { ar: 'لوحة السن 36 على الهاتف تُفتح من أسفل الشاشة', en: 'The panel of tooth 36 on a phone, opened from the bottom of the screen' },
      recipe: `${PHONE} As chart-phone, then tap tooth 36 ([data-tooth="36"]; scroll the chart sideways first if needed). Wait 600 ms for the sheet, left at its top. Capture the whole screen. No markers.`,
    },
  ],
}
export default topic

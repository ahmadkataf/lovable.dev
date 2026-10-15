import type { GuideTopic } from '../types'

// Shots: the demo clinic (Settings → Backup → Load demo data) with the clock and the trial bar as in
// store/scripts/shoot.mjs. On Sunday 11 Oct 2026 the demo has, among others: Reem Murad (#3) in progress with
// Dr. Ahmad Al-Khatib at 11:00, Laith Michel Homsi (#40) in progress with Dr. Samer Abboud at 11:30–12:30, George Issa
// (#17) confirmed at 2:00 pm, and Charbel Ghassan Taweel (#39) scheduled with Dr. Ahmad Al-Khatib at 3:30 pm;
// Dr. Laila Haddad has no appointment that day. Patients are named by file number (same in every run and language);
// look an id up by fileNo in window.__dentora.db.patients.
const DESK = 'Desktop 1600×900, demo clinic, clock fixed to Sunday 11 Oct 2026 11:40 (Asia/Damascus), trial bar hidden, as in store/scripts/shoot.mjs, signed in as the admin.'
const PHONE = 'Phone 405×720 (isMobile, hasTouch), demo clinic, same clock, trial bar hidden.'
const DAY = 'Route #/appointments?view=day (it opens on today, 11 Oct 2026, all doctors, all statuses) and reload so no dialog is left open.'
const DETAILS = 'Route #/appointments?view=list, reload, and click the row of Charbel Ghassan Taweel / شربل غسان الطويل (#39, 3:30 pm, Scheduled) to open the details dialog.'

const topic: GuideTopic = {
  slug: 'appointments',
  order: 6,
  icon: 'calendarCheck',
  title: { ar: 'المواعيد', en: 'Appointments' },
  summary: {
    ar: 'نظّم جدول العيادة لكل طبيب، واحجز المواعيد بنقرة، وتابع المريض من وصوله حتى نهاية زيارته، وذكّره بموعده عبر واتساب.',
    en: 'Run the clinic’s schedule for every doctor, book with a click, follow each patient from arrival to the end of the visit, and send WhatsApp reminders.',
  },
  blocks: [
    {
      id: 'overview',
      title: { ar: 'تقويم المواعيد', en: 'The appointments calendar' },
      text: {
        ar: [
          'افتح **المواعيد** من القائمة الجانبية. يفتح التقويم على اليوم الحالي في عرض **يوم**: عمود لكل طبيب، والمواعيد بطاقات بطول مدتها، وخط أحمر يدل على الوقت الآن.',
          'اختر العرض بالأزرار **يوم** و**أسبوع** و**شهر** و**قائمة**. يعرض الأسبوع سبعة أيام تبدأ بالسبت، ويعرض الشهر أول ثلاثة مواعيد في كل يوم، أما **قائمة** فتعرض مواعيد 14 يوماً تبدأ من التاريخ المختار، مع زر سريع بجانب كل موعد.',
        ],
        en: [
          'Open **Appointments** from the sidebar. The calendar opens on today in **Day** view: a column for each doctor, appointments as cards as long as they last, and a red line at the current time.',
          'Switch views with **Day**, **Week**, **Month** and **Agenda**. The week shows seven days starting on Saturday, the month shows the first three appointments of each day, and **Agenda** lists 14 days from the chosen date with a quick button next to each appointment.',
        ],
      },
      steps: {
        ar: [
          'تنقّل بالسهمين يوماً أو أسبوعاً أو شهراً، وعُد بزر **اليوم**، أو اختر أي تاريخ من خانة التاريخ.',
          'اعرض طبيباً أو أكثر بالنقر على أسمائهم، أو انقر على **كل الأطباء** لترى الجميع.',
          'صفِّ المواعيد حسب حالتها من زر **كل الحالات**: **الفعّالة فقط** تُخفي الملغاة ومن لم يحضر، أو اختر حالة واحدة.',
          'انقر على أي موعد لترى تفاصيله.',
        ],
        en: [
          'Move a day, week or month with the arrows, come back with **Today**, or pick any date in the date box.',
          'Show one doctor or more by clicking their names, or click **All doctors** to see everyone.',
          'Filter by status from the **All statuses** button: **Active only** hides cancelled appointments and no-shows, or pick a single status.',
          'Click any appointment to see its details.',
        ],
      },
      tips: {
        ar: [
          'لون الحافة الجانبية للبطاقة هو لون الطبيب، ولون البطاقة ورمزها الصغير يدلّان على حالة الموعد. والموعد الملغى يظهر مشطوباً.',
          'في عرض **أسبوع** انقر على اسم اليوم في أعلى العمود لتفتحه في عرض **يوم**. وفي عرض **شهر** انقر على أي يوم لتفتحه، وعبارة مثل **+3 أخرى** تعني مواعيد لم يتسع لها المربع.',
          'يظهر في التقويم كل مستخدم مفعّل دوره **طبيب** أو **مدير**. تضيف الأطباء وتختار لون كل منهم من صفحة **الفريق**. انظر [الفريق والصلاحيات](staff).',
          'تُبنى ساعات التقويم وأيام العطلة على **أيام وأوقات الدوام** في الإعدادات. اليوم المغلق يظهر مظللاً، وتستطيع الحجز فيه استثنائياً. انظر [الإعدادات](settings).',
          'يتذكر البرنامج العرض والتاريخ والتصفية حين تنتقل إلى شاشة أخرى، حتى تغلقه.',
        ],
        en: [
          'A card’s side stripe has the doctor’s colour; the card’s colour and small icon show the status. A cancelled appointment is struck through.',
          'In **Week** view, click a day’s heading to open it in **Day** view. In **Month** view, click any day to open it; a label such as **+3 more** means appointments that did not fit in the box.',
          'Every active user whose role is **Doctor** or **Admin** gets a place in the calendar. You add doctors and pick each one’s colour on the **Staff** page. See [Staff and permissions](staff).',
          'The calendar’s hours and closed days come from **Working days & hours** in Settings. A closed day is shaded, and you can still book an exception. See [Settings](settings).',
          'The app remembers the view, date and filters while you visit other screens, until you close it.',
        ],
      },
      shots: ['appointments-day'],
    },
    {
      id: 'book',
      title: { ar: 'حجز موعد', en: 'Booking an appointment' },
      text: {
        ar: ['أسرع طريقة للحجز أن تنقر على وقت فارغ في عمود الطبيب، فيُملأ الطبيب والتاريخ والوقت تلقائياً.'],
        en: ['The quickest way to book is to click a free time in the doctor’s column: the doctor, date and time are filled in for you.'],
      },
      steps: {
        ar: [
          'انقر على وقت فارغ في عرض **يوم** أو **أسبوع** (يظهر عليه + والوقت حين تمرّ فوقه)، أو انقر على **موعد جديد**، أو اضغط `Ctrl+Shift+A` من أي شاشة.',
          'في خانة **المريض** اكتب جزءاً من الاسم أو رقم الملف أو الهاتف، واختر المريض من القائمة. لمريض جديد اختر **إضافة مريض جديد** في آخر القائمة (أو **إضافة «الاسم» كمريض جديد** إن كتبت اسماً): الاسم والهاتف يكفيان الآن، ثم انقر على **إضافة واختيار**.',
          'تحقق من **الطبيب** و**التاريخ** و**وقت البدء**. تعرض قائمة الأوقات الأوقات المتاحة وتكتب **محجوز** بجانب المشغولة، وتستطيع كتابة أي وقت آخر في الخانة المجاورة.',
          'اختر **المدة** فيظهر تحتها وقت الانتهاء، ثم **النوع** (فحص، استشارة، علاج، متابعة، تنظيف، طارئ…)، واكتب **سبب الزيارة**، وأضف **ملاحظات** للطبيب أو للاستقبال إن شئت.',
          'انقر على **حجز الموعد**. يظهر الموعد في التقويم وفي ملف المريض.',
        ],
        en: [
          'Click a free time in **Day** or **Week** view (a + and the time appear as you hover), click **New appointment**, or press `Ctrl+Shift+A` on any screen.',
          'In **Patient**, type part of the name, file number or phone and pick the patient from the list. For someone new choose **Add a new patient** at the end of the list (or **Add “name” as a new patient** if you typed a name): a name and phone are enough for now; then click **Add and select**.',
          'Check the **Doctor**, **Date** and **Start time**. The time list shows the free slots and marks the taken ones **booked**; you can also type any other time in the box next to it.',
          'Choose the **Duration** (the end time shows under it), the **Type** (Check-up, Consultation, Treatment, Follow-up, Cleaning, Emergency…), write the **Reason for visit**, and add **Notes** for the doctor or the front desk if you like.',
          'Click **Book appointment**. It appears in the calendar and in the patient’s file.',
        ],
      },
      tips: {
        ar: [
          'إذا فتحت النموذج دون وقت اختار البرنامج أول وقت فارغ لذلك الطبيب. والمدة المقترحة هي **مدة الموعد الافتراضية** من الإعدادات، والمدد المتاحة من 15 دقيقة إلى ساعتين.',
          'زر **موعد** في ملف المريض يفتح النموذج نفسه والمريض محدد مسبقاً.',
          'تتنقل في قائمة المرضى بالأسهم وتختار بـ`Enter`. ولتغيير المريض بعد اختياره انقر على **تغيير**.',
          'إن أكّد المريض حضوره وأنت تحجز فاختر **مؤكد** في خانة **الحالة** مباشرة.',
          'إذا حجزت في يوم غير معروض ينتقل التقويم إلى يوم الموعد بعد الحفظ.',
        ],
        en: [
          'If you open the form without a time, the app picks the doctor’s first free slot. The suggested length is the **Default appointment length** from Settings; lengths go from 15 minutes to 2 hours.',
          'The **Appointment** button in a patient’s file opens the same form with the patient already chosen.',
          'Move through the patient list with the arrow keys and pick with `Enter`. To change the patient after choosing, click **Change**.',
          'If the patient confirms while you are booking, set **Status** to **Confirmed** straight away.',
          'If you book on a day that is not on screen, the calendar moves to that day after saving.',
        ],
      },
      shots: ['appointments-form'],
    },
    {
      id: 'warnings',
      title: { ar: 'التعارضات وأوقات الدوام', en: 'Conflicts and working hours' },
      text: {
        ar: [
          'يراقب النموذج الجدول وأنت تحجز، ويُنبّهك قبل الحفظ دون أن يمنعك منه:',
          '**تعارض في الجدول**: للطبيب موعد آخر في الوقت نفسه، ويذكر التنبيه المواعيد المتداخلة. **للمريض موعد آخر في هذا الوقت**: المريض نفسه محجوز مع طبيب آخر في الوقت ذاته. **خارج أوقات الدوام**: اليوم ليس من أيام العمل، أو الموعد يتجاوز ساعات الدوام.',
        ],
        en: [
          'The form watches the schedule as you book and warns you before saving, without stopping you:',
          '**Scheduling conflict**: the doctor already has an appointment at that time, and the warning lists the overlapping ones. **The patient has another appointment at this time**: the same patient is booked with another doctor at that time. **Outside working hours**: the day is not a working day, or the appointment runs past the working hours.',
        ],
      },
      steps: {
        ar: [
          'اقرأ التنبيه الأصفر الذي يظهر تحت حقول الوقت.',
          'انقر على **أقرب وقت متاح** ليضع البرنامج أول وقت فارغ لذلك الطبيب، أو اختر وقتاً آخر بنفسك.',
          'أو احفظ رغم التنبيه إن كان التداخل مقصوداً، كمراجعة قصيرة بين موعدين.',
        ],
        en: [
          'Read the yellow warning that appears under the time fields.',
          'Click **Next free** to move the appointment to the doctor’s first free slot, or choose another time yourself.',
          'Or save anyway if the overlap is intended, such as a short check between two appointments.',
        ],
      },
      tips: {
        ar: [
          'المواعيد الملغاة ومواعيد من لم يحضر لا تُحسب في التعارض، فوقتها متاح للحجز من جديد.',
          'غيّر أيام العمل وبداية الدوام ونهايته و**دقة شبكة التقويم** و**مدة الموعد الافتراضية** من **الإعدادات** ← **التفضيلات** ← **أيام وأوقات الدوام**. انظر [الإعدادات](settings).',
        ],
        en: [
          'Cancelled appointments and no-shows do not count as conflicts, so their time is free to book again.',
          'Change the working days, opening and closing times, the **Calendar grid step** and the **Default appointment length** in **Settings** → **Preferences** → **Working days & hours**. See [Settings](settings).',
        ],
      },
      shots: ['appointments-conflict'],
    },
    {
      id: 'visit-day',
      title: { ar: 'يوم الزيارة: حالة الموعد', en: 'On the day: appointment status' },
      text: {
        ar: ['تابع كل موعد من الحجز حتى نهاية الزيارة: **مجدول** ثم **مؤكد** ثم **وصل** ثم **قيد المعالجة** ثم **مكتمل**، أو **ملغى** و**لم يحضر** للمواعيد التي لم تتم.'],
        en: ['Follow every appointment from booking to the end of the visit: **Scheduled**, then **Confirmed**, **Arrived**, **In progress** and **Completed**, or **Cancelled** and **No-show** for those that did not happen.'],
      },
      steps: {
        ar: [
          'انقر على الموعد في التقويم لتفتح **تفاصيل الموعد**.',
          'تحت **تحديث الحالة** انقر على الخطوة التالية: **تأكيد الموعد** بعد التواصل مع المريض، و**وصل المريض** عند حضوره، و**بدء المعالجة** حين يدخل إلى الطبيب، و**إنهاء الزيارة** في آخرها.',
          'للمواعيد التي لم تتم اختر **إلغاء الموعد** أو **لم يحضر**، وإن غيّرت رأيك فاختر **إعادة فتح الموعد**.',
          'في عرض **قائمة** يظهر زر الخطوة التالية بجانب كل موعد، فتتابع يوم العمل كله من شاشة واحدة.',
        ],
        en: [
          'Click the appointment in the calendar to open **Appointment details**.',
          'Under **Update status**, click the next step: **Confirm** once you have spoken to the patient, **Mark arrived** when the patient comes in, **Start treatment** when the patient goes in to the doctor, and **Complete visit** at the end.',
          'For appointments that did not happen choose **Cancel appointment** or **No-show**; if you change your mind, choose **Reopen**.',
          'In **Agenda** view the next-step button sits next to every appointment, so you can run the whole working day from one screen.',
        ],
      },
      tips: {
        ar: [
          'إنهاء الزيارة يحدّث **آخر زيارة** في ملف المريض.',
          'في التفاصيل أيضاً مدة الموعد ونوعه وسببه وملاحظاته، ومن حجزه ومتى، وزرّا الاتصال وواتساب. انقر على اسم المريض لتفتح ملفه.',
          'تُظهر التنبيهات **مواعيد الغد غير المؤكدة** لتتصل بأصحابها، و**مرضى بحاجة لمراجعة دورية**: من مضى على آخر زيارة لهم أكثر من ستة أشهر وليس لهم موعد قادم. انظر [واجهة البرنامج](interface).',
        ],
        en: [
          'Completing a visit updates the **Last visit** in the patient’s file.',
          'The details also show the length, type, reason and notes, who booked it and when, and the call and WhatsApp buttons. Click the patient’s name to open the file.',
          'Notifications list **Unconfirmed for tomorrow**, so you can call those patients, and **Due for a recall**: patients whose last visit was over six months ago with nothing booked. See [The interface](interface).',
        ],
      },
      shots: ['appointments-details', 'appointments-agenda'],
    },
    {
      id: 'reminder',
      title: { ar: 'تذكير المريض عبر واتساب', en: 'WhatsApp reminders' },
      text: {
        ar: ['أرسل للمريض رسالة تذكير جاهزة فيها اسمه واسم العيادة ويوم الموعد وساعته، مع رجاء الحضور قبل الموعد بعشر دقائق.'],
        en: ['Send the patient a ready-made reminder with their name, the clinic’s name and the day and time of the appointment, asking them to arrive ten minutes early.'],
      },
      steps: {
        ar: [
          'افتح تفاصيل موعد قادم حالته **مجدول** أو **مؤكد**.',
          'انقر على **تذكير عبر واتساب**.',
          'يُفتح واتساب على محادثة المريض والرسالة مكتوبة. راجعها ثم اضغط إرسال.',
        ],
        en: [
          'Open the details of an upcoming appointment that is **Scheduled** or **Confirmed**.',
          'Click **WhatsApp reminder**.',
          'WhatsApp opens on the patient’s chat with the message written. Check it, then press send.',
        ],
      },
      tips: {
        ar: [
          'في عرض **قائمة** يؤدي زر واتساب الصغير بجانب كل موعد قادم العمل نفسه.',
          'يحتاج التذكير إلى رقم هاتف في ملف المريض وإلى اتصال بالإنترنت. على أندرويد يُفتح تطبيق واتساب، وعلى ويندوز يُفتح الرابط في المتصفح لتكمل في واتساب ويب أو في تطبيق واتساب على الحاسوب.',
          'الأرقام المحلية مثل 0944… تُكتب دون رمز الدولة، ويضيفه البرنامج من **الدولة** في **بيانات العيادة**. انظر [الإعدادات](settings).',
          'لا يرسل البرنامج أي رسالة وحده: أنت من يضغط إرسال في واتساب. ويُسجَّل التذكير في **آخر النشاطات** في ملف المريض.',
        ],
        en: [
          'In **Agenda** view, the small WhatsApp button next to each upcoming appointment does the same.',
          'A reminder needs a phone number in the patient’s file and an internet connection. On Android the WhatsApp app opens; on Windows the link opens in the browser, where you continue in WhatsApp Web or the WhatsApp desktop app.',
          'Local numbers such as 0944… are stored without the country code; the app adds it from **Country** in the **Clinic** settings. See [Settings](settings).',
          'The app never sends a message on its own: you press send in WhatsApp. The reminder is logged under **Recent activity** in the patient’s file.',
        ],
      },
      shots: ['appointments-reminder'],
    },
    {
      id: 'change',
      title: { ar: 'تعديل موعد أو نقله أو حذفه', en: 'Editing, moving or deleting an appointment' },
      steps: {
        ar: [
          'افتح تفاصيل الموعد وانقر على **تعديل**.',
          'غيّر التاريخ أو الوقت أو الطبيب أو أي خانة أخرى. تظهر التنبيهات نفسها إن وقع تعارض.',
          'انقر على **حفظ التغييرات**. وإن نقلت الموعد إلى يوم آخر ينتقل التقويم إليه.',
          'للحذف انقر على **حذف** في التفاصيل أو في نافذة التعديل، ثم أكّد.',
        ],
        en: [
          'Open the appointment’s details and click **Edit**.',
          'Change the date, time, doctor or any other field. The same warnings appear if there is a conflict.',
          'Click **Save changes**. If you moved it to another day, the calendar follows it.',
          'To delete, click **Delete** in the details or in the edit window, then confirm.',
        ],
      },
      tips: {
        ar: [
          'الحذف نهائي ولا يمكن التراجع عنه. إذا ألغى المريض موعده أو لم يحضر فالأفضل أن تغيّر الحالة إلى **ملغى** أو **لم يحضر**، ليبقى ذلك في سجله.',
          'لنقل موعد استخدم نافذة التعديل؛ البطاقات لا تُسحب داخل التقويم.',
        ],
        en: [
          'Deleting is permanent and cannot be undone. If the patient cancelled or did not come, set the status to **Cancelled** or **No-show** instead, so it stays in their record.',
          'To move an appointment, use the edit window; cards are not dragged around the calendar.',
        ],
      },
      shots: ['appointments-edit'],
    },
    {
      id: 'patient-tab',
      title: { ar: 'مواعيد المريض في ملفه', en: 'A patient’s appointments' },
      text: {
        ar: ['يعرض تبويب **المواعيد** في ملف المريض تاريخه مع العيادة: عدد **زيارات مكتملة** والمواعيد **قادمة** ومرات **غياب** والمواعيد **ملغاة**، ثم **المواعيد القادمة** وأقربها يحمل شارة **الموعد القادم**، ثم **السجل السابق**.'],
        en: ['The **Appointments** tab of a patient’s file shows their history with the clinic: the number of **completed visits**, **upcoming** appointments, **no-shows** and **cancelled** ones, then the **Upcoming** list with the nearest marked **Next**, then the **History**.'],
      },
      steps: {
        ar: [
          'افتح ملف المريض ثم تبويب **المواعيد**.',
          'انقر على **موعد جديد** لتحجز له موعداً مباشرة.',
          'انقر على أي موعد لتفتح تفاصيله، وعلى **عرض المزيد** لترى زيارات أقدم.',
        ],
        en: [
          'Open the patient’s file, then the **Appointments** tab.',
          'Click **New appointment** to book for this patient directly.',
          'Click any appointment to open its details, and **Show more** to see older visits.',
        ],
      },
      tips: {
        ar: [
          'يظهر عدد مرات الغياب بلون تحذيري متى كان أكثر من صفر، لتنتبه له عند الحجز التالي.',
          'يظهر الموعد القادم أيضاً في أعلى الملف، والنقر عليه يفتح هذا التبويب. انظر [ملف المريض](patients#profile).',
        ],
        en: [
          'The no-show count turns to a warning colour as soon as it is above zero, so you notice it at the next booking.',
          'The next appointment also shows at the top of the file; clicking it opens this tab. See [The patient file](patients#profile).',
        ],
      },
      shots: ['appointments-patient-tab'],
    },
    {
      id: 'phone',
      title: { ar: 'المواعيد على الهاتف', en: 'Appointments on a phone' },
      text: {
        ar: ['على الهاتف تُعرض المواعيد قائمةً من البطاقات بدل الأعمدة، لتعمل بيد واحدة.'],
        en: ['On a phone, appointments are shown as a list of cards instead of columns, so you can work with one hand.'],
      },
      tips: {
        ar: [
          'في عرض **يوم** يظهر شريط أوقات تحت عبارة **اضغط على وقت لحجز موعد**: الوقت الفارغ عليه +، والنقطة تعني أن بعض الأطباء أو جميعهم محجوزون فيه. وتحته مواعيد اليوم بطاقاتٍ تنقر عليها لتفتح تفاصيلها.',
          'زر **موعد جديد** العائم أسفل الشاشة يفتح نموذج الحجز، وكذلك زر + في الشريط العلوي.',
          'زر التقويم بجانب التاريخ ينقلك إلى أي يوم، ويظهر زر **اليوم** حين تبتعد عن اليوم الحالي.',
          'في عرض **أسبوع** تظهر أيام الأسبوع شريطاً مع عدد المواعيد تحت كل يوم، وفي عرض **شهر** نقاط ملوّنة بعدد المواعيد.',
          'زر الرجوع في أندرويد يغلق النافذة المفتوحة أولاً.',
        ],
        en: [
          'In **Day** view a strip of times sits under **Tap a time to book**: a free time shows a +, and a dot means some or all doctors are booked then. The day’s appointments follow as cards; tap one to open its details.',
          'The floating **New appointment** button at the bottom opens the booking form, and so does the + in the top bar.',
          'The calendar button next to the date jumps to any day, and a **Today** button appears once you move away from today.',
          'In **Week** view the days appear as a strip with the number of appointments under each; in **Month** view coloured dots stand for the appointments.',
          'The Android Back button closes the open window first.',
        ],
      },
      shots: ['appointments-phone'],
    },
  ],
  shots: [
    {
      id: 'appointments-day',
      device: 'desktop',
      alt: { ar: 'تقويم المواعيد في عرض يوم: عمود لكل طبيب، والمواعيد بطاقات ملونة، والخط الأحمر عند الوقت الحالي', en: 'The appointments calendar in Day view: a column per doctor, appointments as coloured cards, and the red line at the current time' },
      recipe: `${DESK} ${DAY} Wait 1.5 s (the grid scrolls itself to the current time). Capture the whole window. Markers: 1 on the arrows / **Today** / date box group, 2 on the doctor chips, 3 on **All statuses**, 4 on Reem Murad's card (11:00, In progress) in Dr. Ahmad Al-Khatib's column.`,
    },
    {
      id: 'appointments-form',
      device: 'desktop',
      alt: { ar: 'نموذج موعد جديد: المريض المختار والطبيب والتاريخ والوقت والمدة والنوع وسبب الزيارة', en: 'The new appointment form: the chosen patient, doctor, date, time, length, type and reason for visit' },
      recipe: `${DESK} ${DAY} In Dr. Laila Haddad's column (she has no appointments that day) click the 12:00 slot (button.apt-slot whose aria-label contains 12:00). In the dialog type "لمى" (EN: "Lama") in the patient search and pick Lama Mazen Dabbagh / لمى مازن الدبّاغ (#6) from the list; type the Reason for visit "ألم في الضرس" (EN: "Toothache"). Click the dialog title to close any open list. Crop to the dialog. Markers: 2 on the chosen patient card, 3 on the Doctor, Date and Start time fields, 4 on Duration and Type, 5 on **Book appointment**. Keep the dialog open for appointments-conflict.`,
    },
    {
      id: 'appointments-conflict',
      device: 'desktop',
      alt: { ar: 'تنبيه «تعارض في الجدول» في نموذج الموعد مع الموعد المتداخل وزر أقرب وقت متاح', en: 'The “Scheduling conflict” warning in the appointment form with the overlapping appointment and the Next free button' },
      recipe: `${DESK} Continue from appointments-form: change Doctor to Dr. Samer Abboud / د. سامر عبود (he sees Laith Michel Homsi 11:30–12:30), so the yellow **Scheduling conflict** box (.apt-conflict) appears with **Next free: 12:30 pm**. Scroll the dialog body so the patient card and the warning are both in view. Crop to the dialog. Markers: 1 on the warning box, 2 on the **Next free** button. Then cancel the dialog (Close without saving if asked).`,
    },
    {
      id: 'appointments-details',
      device: 'desktop',
      alt: { ar: 'نافذة تفاصيل الموعد: المريض والطبيب والوقت وأزرار تحديث الحالة وتذكير واتساب', en: 'The appointment details window: patient, doctor, time, the status buttons and the WhatsApp reminder' },
      recipe: `${DESK} ${DETAILS} Crop to the dialog. Markers: 2 on the **Update status** buttons (Confirm, Mark arrived, Cancel appointment, No-show), 3 on **No-show**.`,
    },
    {
      id: 'appointments-agenda',
      device: 'desktop',
      alt: { ar: 'عرض القائمة: مواعيد اليوم صفوفاً مع زر الخطوة التالية وزر واتساب بجانب كل موعد', en: 'Agenda view: today’s appointments as rows with the next-step button and the WhatsApp button next to each' },
      recipe: `${DESK} Route #/appointments?view=list and reload. Scroll so the row of Reem Murad (11:00, In progress) is just under the top bar. Crop to the agenda rows from that row down to Charbel Khaled Najjar (4:30 pm), full card width. Markers: 4 on the **Mark arrived** button of George Issa's row (2:00 pm, Confirmed).`,
    },
    {
      id: 'appointments-reminder',
      device: 'desktop',
      alt: { ar: 'زر تذكير عبر واتساب في تفاصيل موعد قادم', en: 'The WhatsApp reminder button in the details of an upcoming appointment' },
      recipe: `${DESK} ${DETAILS} Crop to the lower part of the dialog, from the "Update status" label to the bottom of the footer. Markers: 2 on the **WhatsApp reminder** card. Do not click it (it opens wa.me).`,
    },
    {
      id: 'appointments-edit',
      device: 'desktop',
      alt: { ar: 'نافذة تعديل الموعد مع أزرار حذف وحفظ التغييرات', en: 'The edit appointment window with the Delete and Save changes buttons' },
      recipe: `${DESK} ${DETAILS} Click **Edit** in the details footer; the "Edit appointment" dialog opens. Crop to the dialog. Markers: 2 on the Date and Start time fields, 3 on **Save changes**, 4 on **Delete**. Then click Cancel.`,
    },
    {
      id: 'appointments-patient-tab',
      device: 'desktop',
      alt: { ar: 'تبويب المواعيد في ملف المريض: الأرقام، والمواعيد القادمة، والسجل السابق', en: 'The Appointments tab of a patient file: the counts, upcoming appointments and history' },
      recipe: `${DESK} Open patient file #44 (لمى ماهر السيد / Lama Maher Sayed) at #/patients/<id>?tab=appointments. Scroll so the profile tab bar (.pt-tabs) sits just under the top bar. Capture the whole window. Markers: 1 on the **Appointments** tab, 2 on **New appointment** in the card header, 3 on the first upcoming row (marked **Next**).`,
    },
    {
      id: 'appointments-phone',
      device: 'phone',
      alt: { ar: 'المواعيد على الهاتف: أزرار العرض، والتاريخ، وشريط الأوقات للحجز، وبطاقات مواعيد اليوم، وزر موعد جديد', en: 'Appointments on a phone: view buttons, the date, the strip of times to book, the day’s appointment cards and the New appointment button' },
      recipe: `${PHONE} Route #/appointments?view=day and reload; page at its top (the time strip scrolls itself to the current time). Capture the whole screen. No markers.`,
    },
  ],
}
export default topic

// Chapter 6, "Appointments and the schedule" (server/videos/index.ts, guide topic server/guide/topics/appointments.ts).
// Follows the guide's order: the calendar (day view, cards, the views, moving between days, doctor and status
// filters), booking from a free slot (patient search and the new-patient option, doctor / date / time, duration and
// reason), the scheduling-conflict warning and "Next free", the details dialog on the day of the visit (status steps,
// the WhatsApp reminder, edit and delete), the agenda's next-step buttons, the patient's Appointments tab, and one
// sentence on the phone layout. The clock is Sunday 11 October 2026, 11:40: Dr. Laila Haddad has no appointment that
// day; Dr. Samer Abboud's 11:00 slot is free and Laith Michel Homsi follows at 11:30–12:30, so typing 11:30 in the
// custom time box shows the conflict with "Next free: 12:30"; Charbel Ghassan Taweel (15:30, scheduled) is confirmed in the details dialog and
// George Issa (14:00, confirmed) is marked arrived from the agenda.
const rx = (ar, en) => new RegExp(`^(${ar}|${en})$`)
const L = (lang, ar, en) => (lang === 'ar' ? ar : en)
const dialog = page => page.getByRole('dialog')
const details = page => page.locator('.apt-details')
const card = (page, re) => page.locator('.apt-ev', { hasText: re })

/** The day grid's column of the doctor whose name matches `re` (the heads and the columns share one order). */
async function doctorColumn(page, re) {
  const heads = page.locator('.apt-tg-head')
  const n = await heads.count()
  for (let i = 0; i < n; i++) if (re.test(await heads.nth(i).innerText())) return page.locator('.apt-tg-col').nth(i)
  throw new Error(`no day column for ${re}`)
}

export const chapter = {
  slug: 'appointments',
  scenes: [
    {
      id: 'intro',
      say: {
        ar: 'في هذا الفصل ستتعلم كيف تحجز المواعيد بنقرة، وتتابع كل زيارة خطوة بخطوة، وتذكّر المريض بموعده عبر واتساب.',
        en: 'In this chapter you will learn to book appointments with a click, follow each visit step by step, and send WhatsApp reminders.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(page.locator('.app-sidebar').getByRole('link', { name: rx('المواعيد', 'Appointments') })); await ui.pause(500) },
    },
    {
      id: 'open',
      say: {
        ar: 'افتح «المواعيد» من القائمة الجانبية. يفتح التقويم على اليوم في عرض «يوم»: عمود لكل طبيب، والمواعيد بطاقات، وخط أحمر عند الوقت الآن.',
        en: 'Open Appointments from the sidebar. The calendar opens on today in Day view: a column for each doctor, appointments as cards, and a red line at the current time.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.app-sidebar').getByRole('link', { name: rx('المواعيد', 'Appointments') }))
        await page.locator('.apt-tg').waitFor()
        await page.waitForTimeout(900)
        await ui.highlight(page.locator('.apt-tg-head').first(), 1400)
        await ui.highlight(page.locator('.apt-now').first(), 1400)
      },
    },
    {
      id: 'card',
      say: {
        ar: 'لون البطاقة هو لون الطبيب، وشريطها الجانبي ورمزها الصغير يدلّان على حالة الموعد.',
        en: 'A card is tinted in the doctor’s colour; its side stripe and small icon show the status of the appointment.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(card(page, /ريم مراد|Reem Murad/)); await ui.highlight(card(page, /ريم مراد|Reem Murad/), 2400) },
    },
    {
      id: 'views',
      say: {
        ar: 'اختر العرض بالأزرار «يوم» و«أسبوع» و«شهر» و«قائمة». يبدأ الأسبوع بالسبت، ويعرض الشهر أول ثلاثة مواعيد في كل يوم.',
        en: 'Switch views with Day, Week, Month and Agenda. The week starts on Saturday, and the month shows the first three appointments of each day.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.apt-views').getByRole('tab', { name: rx('أسبوع', 'Week') }))
        await page.locator('.apt-tg.compact').waitFor()
        await ui.pause(1200)
        await ui.click(page.locator('.apt-views').getByRole('tab', { name: rx('شهر', 'Month') }))
        await page.locator('.apt-month').waitFor()
      },
    },
    {
      id: 'navigate',
      say: {
        ar: 'تنقّل بالسهمين، وعُد بزر «اليوم»، أو اختر أي تاريخ من خانة التاريخ. ولنعد إلى عرض «يوم».',
        en: 'Move with the arrows, come back with Today, or pick any date in the date box. Let us go back to Day view.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.apt-nav').getByRole('button', { name: rx('التالي', 'Next') }))
        await ui.pause(500)
        await ui.click(page.locator('.apt-today'))
        await ui.click(page.locator('.apt-views').getByRole('tab', { name: rx('يوم', 'Day') }))
        await page.locator('.apt-tg').waitFor()
      },
    },
    {
      id: 'doctors',
      say: { ar: 'اعرض طبيباً أو أكثر بالنقر على أسمائهم، أو انقر على «كل الأطباء» لترى الجميع.', en: 'Show one doctor or more by clicking their names, or click All doctors to see everyone.' },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.apt-chips .apt-docchip', { hasText: /أحمد الخطيب|Ahmad Al-Khatib/ }))
        await ui.pause(900)
        await ui.click(page.locator('.apt-chips .chip', { hasText: rx('كل الأطباء', 'All doctors') }))
      },
    },
    {
      id: 'status-filter',
      say: {
        ar: 'واعرض المواعيد حسب حالتها من زر «كل الحالات»، فـ«الفعّالة فقط» تُخفي الملغاة ومواعيد من لم يحضر.',
        en: 'Filter by status from the All statuses button: Active only hides cancelled appointments and no-shows.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.apt-filters').getByRole('button', { name: /كل الحالات|All statuses/ }))
        await ui.click(page.getByRole('menuitem', { name: rx('الفعّالة فقط', 'Active only') }))
      },
    },
    {
      id: 'slot',
      say: {
        ar: 'أسرع طريقة للحجز أن تنقر على وقت فارغ في عمود الطبيب، فيُملأ الطبيب والتاريخ والوقت تلقائياً.',
        en: 'The quickest way to book is to click a free time in the doctor’s column: the doctor, date and time are filled in for you.',
      },
      run: async ({ page, ui }) => {
        const col = await doctorColumn(page, /سامر عبود|Samer Abboud/)
        await ui.click(col.locator('button.apt-slot[aria-label*="11:00"]'))
        await dialog(page).waitFor()
        await ui.highlight(dialog(page).locator('.form-grid').first(), 1400)
      },
    },
    {
      id: 'patient',
      say: {
        ar: 'في خانة «المريض» اكتب جزءاً من الاسم أو رقم الملف أو الهاتف. ولمريض جديد اختر إضافة الاسم كمريض جديد من آخر القائمة: الاسم والهاتف يكفيان الآن.',
        en: 'In Patient, type part of the name, file number or phone. For someone new, choose Add as a new patient at the end of the list: a name and phone are enough for now.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.type(dialog(page).locator('.apt-picker input'), L(lang, 'لمى', 'Lama'), { delay: 130 })
        await page.getByRole('option', { name: /لمى مازن|Lama Mazen/ }).waitFor()
        await ui.moveTo(page.locator('.apt-drop-new'))
        await ui.highlight(page.locator('.apt-drop-new'), 1500)
      },
    },
    {
      id: 'pick',
      say: {
        ar: 'اختر المريض من القائمة، ثم تحقق من «الطبيب» و«التاريخ» و«وقت البدء».',
        en: 'Pick the patient from the list, then check the Doctor, Date and Start time.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.getByRole('option', { name: /لمى مازن|Lama Mazen/ }))
        await dialog(page).locator('.apt-picked').waitFor()
        await ui.moveTo(dialog(page).getByLabel(/^(الطبيب|Doctor)/))
        await ui.highlight(dialog(page).locator('.form-grid').first(), 2200)
      },
    },
    {
      id: 'reason',
      say: {
        ar: 'اختر «المدة» فيظهر تحتها وقت الانتهاء، ثم «النوع»، واكتب «سبب الزيارة».',
        en: 'Choose the Duration, the end time shows under it, then the Type, and write the Reason for visit.',
      },
      run: async ({ page, ui, lang }) => {
        await ui.highlight(dialog(page).getByLabel(rx('المدة', 'Duration')), 1200)
        await ui.type(dialog(page).getByLabel(rx('سبب الزيارة', 'Reason for visit')), L(lang, 'ألم في الضرس', 'Toothache'))
      },
    },
    {
      id: 'conflict',
      say: {
        ar: 'تستطيع كتابة أي وقت في الخانة المجاورة لقائمة الأوقات. لو كتبت 11:30 وللطبيب موعد آخر حينها، ظهر تنبيه «تعارض في الجدول» مع المواعيد المتداخلة، دون أن يمنعك من الحفظ.',
        en: 'You can type any time in the box next to the time list. Type 11:30 while the doctor already has an appointment then, and a Scheduling conflict warning lists the overlapping ones, without stopping you.',
      },
      run: async ({ page, ui }) => {
        // the hours segment of the time box is at its start: a click there, then the digits (ui.type would click its
        // centre, which is the minutes or the am/pm segment, so it cannot be used for a time input)
        const time = dialog(page).locator('input[type="time"]')
        await ui.click(time, { position: { x: 12, y: 20 } })
        await time.pressSequentially('1130', { delay: 110 })
        await dialog(page).locator('.apt-conflict').waitFor()
        await ui.scrollTo(dialog(page).locator('.apt-conflict'))
        await ui.highlight(dialog(page).locator('.apt-conflict'), 2200)
      },
    },
    {
      id: 'next-free',
      say: {
        ar: 'انقر على «أقرب وقت متاح» لينقل دنتورا الموعد إلى أول وقت فارغ للطبيب في اليوم نفسه، أو احفظ رغم التنبيه إن كان التداخل مقصوداً.',
        en: 'Click Next free to move the appointment to the doctor’s first free time on the same day, or save anyway if the overlap is intended.',
      },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).locator('.apt-conflict').getByRole('button', { name: /أقرب وقت متاح|Next free/ }))
        await dialog(page).locator('.apt-conflict').waitFor({ state: 'hidden' })
        await ui.moveTo(dialog(page).getByLabel(rx('وقت البدء', 'Start time')))
        await ui.highlight(dialog(page).getByLabel(rx('وقت البدء', 'Start time')), 1600)
      },
    },
    {
      id: 'book',
      say: { ar: 'انقر على «حجز الموعد». يظهر الموعد في التقويم وفي ملف المريض.', en: 'Click Book appointment. It appears in the calendar and in the patient’s file.' },
      run: async ({ page, ui }) => {
        await ui.click(dialog(page).getByRole('button', { name: rx('حجز الموعد', 'Book appointment') }))
        await dialog(page).waitFor({ state: 'hidden' })
        await card(page, /لمى مازن|Lama Mazen/).waitFor()
        await ui.highlight(card(page, /لمى مازن|Lama Mazen/), 2000)
      },
    },
    {
      id: 'details',
      say: {
        ar: 'في يوم الزيارة انقر على الموعد لتفتح «تفاصيل الموعد»: المريض والطبيب والوقت والسبب، وزرّا الاتصال وواتساب.',
        en: 'On the day, click the appointment to open Appointment details: patient, doctor, time and reason, with the call and WhatsApp buttons.',
      },
      run: async ({ page, ui }) => {
        await ui.click(card(page, /شربل غسان|Charbel Ghassan/))
        await details(page).locator('.apt-det-grid').waitFor()
        await ui.highlight(details(page).locator('.apt-det-grid'), 2200)
      },
    },
    {
      id: 'status',
      say: {
        ar: 'تحت «تحديث الحالة» انقر على الخطوة التالية: «تأكيد الموعد» بعد التواصل مع المريض، ثم «وصل المريض»، و«بدء المعالجة»، و«إنهاء الزيارة».',
        en: 'Under Update status, click the next step: Confirm once you have spoken to the patient, then Mark arrived, Start treatment, and Complete visit.',
      },
      run: async ({ page, ui }) => {
        await ui.click(details(page).locator('.apt-act-confirmed'))
        await details(page).locator('.apt-act-confirmed').waitFor({ state: 'hidden' })
        await ui.highlight(details(page).locator('.apt-det-btns'), 2200)
      },
    },
    {
      id: 'no-show',
      say: {
        ar: 'وللمواعيد التي لم تتم اختر «إلغاء الموعد» أو «لم يحضر». وإنهاء الزيارة يحدّث «آخر زيارة» في ملف المريض.',
        en: 'For appointments that did not happen choose Cancel appointment or No-show. Completing a visit updates the Last visit in the patient’s file.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(details(page).locator('.apt-act-no_show')); await ui.highlight(details(page).locator('.apt-act-no_show'), 2000) },
    },
    {
      id: 'reminder',
      say: {
        ar: 'لموعد قادم انقر على «تذكير عبر واتساب»: يُفتح واتساب على محادثة المريض والرسالة مكتوبة فيها اسمه ويوم الموعد وساعته. راجعها ثم اضغط إرسال.',
        en: 'For an upcoming appointment, click WhatsApp reminder: WhatsApp opens on the patient’s chat with the message written, with their name and the day and time. Check it, then press send.',
      },
      run: async ({ page, ui }) => {
        await ui.scrollTo(details(page).locator('.apt-remind'))
        await ui.moveTo(details(page).locator('.apt-remind'))
        await ui.highlight(details(page).locator('.apt-remind'), 2600)
      },
    },
    {
      id: 'edit',
      say: {
        ar: 'لتعديل الموعد أو نقله انقر على «تعديل»، غيّر ما تشاء ثم «حفظ التغييرات». أما «حذف» فنهائي، فالأفضل تغيير الحالة إلى ملغى أو لم يحضر.',
        en: 'To edit or move an appointment click Edit, change what you need, then Save changes. Delete is permanent, so setting the status to Cancelled or No-show is usually better.',
      },
      run: async ({ page, ui }) => {
        await ui.click(details(page).locator('.modal-footer').getByRole('button', { name: rx('تعديل', 'Edit') }))
        const edit = dialog(page).filter({ hasText: /تعديل الموعد|Edit appointment/ })
        await edit.waitFor()
        await ui.highlight(edit.locator('.form-grid').first(), 1800)
        await ui.moveTo(edit.getByRole('button', { name: rx('حذف', 'Delete') }))
        await ui.highlight(edit.getByRole('button', { name: rx('حذف', 'Delete') }), 1200)
        await ui.click(edit.getByRole('button', { name: rx('إلغاء', 'Cancel') }))
        await edit.waitFor({ state: 'hidden' })
      },
    },
    {
      id: 'agenda',
      say: {
        ar: 'يعرض عرض «قائمة» مواعيد 14 يوماً، وعلى الحاسوب يظهر بجانب كل موعد لم ينتهِ زر خطوته التالية وزر واتساب.',
        en: 'Agenda view lists 14 days, and on a computer the next-step button and the WhatsApp button sit next to every unfinished appointment.',
      },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.apt-views').getByRole('tab', { name: rx('قائمة', 'Agenda') }))
        await page.locator('.apt-agenda').waitFor()
        const row = page.locator('.apt-arow', { hasText: /جورج عيسى|George Issa/ })
        await ui.scrollTo(row)
        await ui.highlight(row.locator('.apt-arow-actions'), 2000)
      },
    },
    {
      id: 'arrived',
      say: { ar: 'جورج عيسى موعده مؤكد: انقر على «وصل المريض» عند حضوره، فتصبح الخطوة التالية «بدء المعالجة».', en: 'George Issa is confirmed: click Mark arrived when he comes in, and the next step becomes Start treatment.' },
      run: async ({ page, ui }) => {
        const row = page.locator('.apt-arow', { hasText: /جورج عيسى|George Issa/ })
        await ui.click(row.getByRole('button', { name: rx('وصل المريض', 'Mark arrived') }))
        await row.getByRole('button', { name: rx('بدء المعالجة', 'Start treatment') }).waitFor()
        await ui.highlight(row.locator('.apt-arow-actions'), 1600)
      },
    },
    {
      id: 'open-file',
      say: { ar: 'وانقر على اسم المريض في التفاصيل لتفتح ملفه.', en: 'Click the patient’s name in the details to open the file.' },
      run: async ({ page, ui }) => {
        await ui.click(page.locator('.apt-arow', { hasText: /جورج عيسى|George Issa/ }).locator('.apt-arow-name'))
        await details(page).locator('.apt-det-name').waitFor()
        await ui.click(details(page).locator('.apt-det-name'))
        await page.locator('.pt-hero').waitFor()
      },
    },
    {
      id: 'patient-tab',
      say: {
        ar: 'يعرض تبويب «المواعيد» في ملف المريض زياراته المكتملة والقادمة ومرات غيابه، ثم «المواعيد القادمة» و«السجل السابق». ومن «موعد جديد» تحجز له مباشرة.',
        en: 'The Appointments tab of the file shows the completed visits, upcoming ones and no-shows, then the Upcoming list and the History. New appointment books for this patient directly.',
      },
      run: async ({ page, ui }) => {
        // the tab's name carries its count ("المواعيد 7"), so no end anchor
        await ui.click(page.locator('.pt-tabs').getByRole('tab', { name: /^(المواعيد|Appointments)/ }))
        await page.locator('.apt-ptab-stats').waitFor()
        await ui.scrollTo(page.locator('.apt-ptab'), { block: 'start' })
        await ui.highlight(page.locator('.apt-ptab-stats'), 1600)
        await ui.highlight(page.locator('.apt-trow').first(), 1600)
      },
    },
    {
      id: 'phone',
      say: {
        ar: 'على الهاتف تُعرض المواعيد بطاقاتٍ بدل الأعمدة، مع شريط أوقات للحجز وزر «موعد جديد» عائم أسفل الشاشة.',
        en: 'On a phone, appointments are shown as cards instead of columns, with a strip of times to book and a floating New appointment button at the bottom.',
      },
      run: async ({ page, ui }) => { await ui.moveTo(page.locator('.apt-ptab').getByRole('button', { name: rx('موعد جديد', 'New appointment') })); await ui.highlight(page.locator('.apt-ptab-list').first(), 2200) },
    },
    {
      id: 'recap',
      say: {
        ar: 'هكذا تحجز بنقرة على وقت فارغ، وينبّهك دنتورا إلى التعارض، وتتابع الزيارة خطوة بخطوة، وتذكّر المريض عبر واتساب. التفاصيل كلها في دليل الاستخدام على الموقع.',
        en: 'That is how you book with a click on a free time, let Dentora warn you about conflicts, follow the visit step by step, and remind the patient on WhatsApp. Every detail is in the user guide on the website.',
      },
      run: async ({ page, ui }) => { await ui.highlight(page.locator('.apt-ptab'), 2400) },
    },
  ],
}

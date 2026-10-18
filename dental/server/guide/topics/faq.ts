import type { GuideTopic } from '../types'

// Questions a clinic asks, grouped, each answered in a few sentences with links to the exact sections of the guide.
// Every answer is written from the topics it links to (and the app's own texts), so the FAQ never says more than the
// guide does. Shots: the demo clinic with the clock as in store/scripts/shoot.mjs; the trial bar, hidden in every
// other picture of the guide, is shown here on purpose (the questions are about it).
const DESK = 'Desktop 1440×900, demo clinic as store/scripts/shoot.mjs makes it (seedAndLogin + Settings → Backup → Load demo data; English shots use its englishClinic() names), signed in as the admin (Dr. Ahmad Al-Khatib), clock fixed at Sunday 11 Oct 2026 11:40 Asia/Damascus, trial started at that same instant (7 days left), page scrolled to the top.'

const topic: GuideTopic = {
  slug: 'faq',
  order: 18,
  icon: 'circleHelp',
  title: { ar: 'أسئلة وحلول', en: 'Questions and answers' },
  summary: {
    ar: 'الأسئلة التي تسألها العيادات أكثر من غيرها، عن البدء والبيانات والمال والطباعة والترخيص، وحلول المشكلات الشائعة، مع روابط إلى شرحها الكامل في الدليل.',
    en: 'The questions clinics ask most, about getting started, data, money, printing and the licence, and fixes for the usual problems, each with a link to its full explanation in the guide.',
  },
  metaDescription: {
    ar: 'الأسئلة التي تسألها العيادات أكثر من غيرها، عن البدء والبيانات والمال والطباعة والترخيص، وحلول المشكلات الشائعة، مع روابط إلى شرحها الكامل في الدليل.',
    en: 'The questions clinics ask most, on getting started, data, money, printing and the licence, and fixes for common problems, each linked to its full topic.',
  },
  blocks: [
    {
      id: 'start',
      title: { ar: 'البدء والتثبيت', en: 'Getting started' },
      text: {
        ar: [
          '**هل يحتاج Dentora إلى الإنترنت؟** لا في العمل اليومي: المرضى والمواعيد والفواتير والطباعة كلها على الجهاز. تحتاج إلى الإنترنت لتنزيل البرنامج، ومرة واحدة إن فعّلته بمفتاح ترخيص، وحين ترسل رسالة واتساب (يفتح البرنامج واتساب والرسالة مكتوبة). انظر [قبل أن تبدأ](getting-started#overview) و[التفعيل بمفتاح الترخيص](licence#key).',
          '**على أي أجهزة يعمل؟ وهل يعمل على ماك أو آيفون؟** يعمل على حاسوب بنظام ويندوز 10 أو 11 (64-بت)، وعلى هاتف أو جهاز لوحي بنظام أندرويد 7.0 أو أحدث. لا توجد نسخة لماك ولا لآيفون أو آيباد. انظر [التثبيت على ويندوز](getting-started#install-windows) و[التثبيت على أندرويد](getting-started#install-android).',
          '**هل أستطيع العمل على الحاسوب والهاتف معاً بالبيانات نفسها؟** لا يزامن Dentora الأجهزة: لكل جهاز قاعدة بيانات مستقلة، والنسخة الاحتياطية تنقل البيانات ولا تدمجها. اختر جهازاً رئيسياً واحداً للعمل اليومي، وانقل العيادة بملف النسخة حين تغيّر الجهاز. ويحتاج كل جهاز إلى ترخيصه. انظر [نقل العيادة إلى جهاز جديد](backup#new-device) و[جهاز واحد](licence#coverage).',
          '**أريد أن أجرّب البرنامج قبل إدخال بياناتي، كيف؟** يحمّل المدير عيادة تجريبية كاملة من **الإعدادات** ← **النسخ الاحتياطي** ← **تحميل بيانات تجريبية** ما دام في العيادة أقل من ثلاثة مرضى. لا تُزال البيانات التجريبية وحدها بل بحذف كل البيانات، فجرّب قبل أن تبدأ العمل الحقيقي. انظر [البيانات التجريبية وحذف كل البيانات](backup#demo-erase).',
          '**هل يعمل البرنامج بالإنجليزية؟** نعم. من **الإعدادات** ← **التفضيلات** ← **لغة الواجهة** اختر **English**، فتتغير الشاشات والمطبوعات فوراً لكل المستخدمين (يغيّرها المدير). انظر [اللغة وأسماء الأشهر والخط والمظهر](settings#language-appearance).',
        ],
        en: [
          '**Does Dentora need the internet?** Not for daily work: patients, appointments, invoices and printing all live on the device. You need the internet to download Dentora, once if you activate it with a licence key, and when you send a WhatsApp message (Dentora opens WhatsApp with the message written). See [Before you start](getting-started#overview) and [Activating with a licence key](licence#key).',
          '**Which devices does it run on? Does it work on a Mac or an iPhone?** It runs on a Windows 10 or 11 computer (64-bit) and on an Android 7.0 or later phone or tablet. There is no Mac, iPhone or iPad version. See [Installing on Windows](getting-started#install-windows) and [Installing on Android](getting-started#install-android).',
          '**Can I work on the computer and the phone with the same data?** Dentora does not sync devices: each device has its own database, and a backup moves data rather than merging it. Choose one main device for daily work, and move the clinic with a backup file when you change device. Each device also needs its own licence. See [Moving the clinic to a new device](backup#new-device) and [One device](licence#coverage).',
          '**I want to try the app before entering my data. How?** The admin can load a complete demo clinic from **Settings** → **Backup & data** → **Load demo data** while the clinic has fewer than three patients. Demo data cannot be removed on its own, only by erasing all data, so try it before real work starts. See [Demo data and erasing everything](backup#demo-erase).',
          '**Does it work in English?** Yes. In **Settings** → **Preferences** → **Interface language** choose **English**: screens and printouts switch at once for everyone (the admin changes it). See [Language, month names, font and appearance](settings#language-appearance).',
        ],
      },
    },
    {
      id: 'data',
      title: { ar: 'البيانات والنسخ الاحتياطي', en: 'Your data and backups' },
      text: {
        ar: [
          '**أين تُحفظ بياناتي؟ هل هي على الإنترنت؟** على جهازك وحده، ولا تُرسل إلى أي خادم. لذلك النسخة الاحتياطية هي نسختك الثانية الوحيدة: احفظها خارج الجهاز. انظر [لماذا النسخ الاحتياطي مهم؟](backup#overview) و[ما الذي يُرسل إلى الإنترنت؟](licence#privacy).',
          '**كم مرة أحفظ نسخة احتياطية، وأين أضعها؟** أسبوعياً على الأقل، والأفضل في نهاية كل يوم عمل، من **الإعدادات** ← **النسخ الاحتياطي** ← **تصدير نسخة احتياطية**. ضع الملف على فلاشة أو في Google Drive أو أرسله لنفسك، واحمه بكلمة مرور. يذكّرك البرنامج حين تمضي 7 أيام بلا نسخة، وتحمل النسخة كل شيء، بما فيه الصور والأشعة. انظر [حفظ نسخة احتياطية](backup#export) و[أين تحفظ النسخة؟](backup#where).',
          '**غيّرت هاتفي أو حذفت التطبيق فاختفت بياناتي، كيف أستعيدها؟** على أندرويد يمسح حذف التطبيق، أو «مسح البيانات» من معلومات التطبيق، كل بيانات العيادة، ولا تنقلها نسخة Google التلقائية. الطريق الوحيد ملف نسخة احتياطية حفظته من قبل: استعده من الشاشة الأولى لمعالج الإعداد. وللتحديث ثبّت الملف الجديد فوق التطبيق دون حذفه. انظر [استعادة النسخة بدل الإعداد](getting-started#restore-backup) و[التثبيت على أندرويد](getting-started#install-android).',
          '**كيف أنقل العيادة إلى حاسوب جديد؟** احفظ نسخة حديثة على الجهاز القديم، وثبّت Dentora على الجديد، واختر **استعد بياناتك من نسخة احتياطية** في الشاشة الأولى للمعالج، ثم ادخل باسمك ورمزك المعتادين. للجهاز الجديد رقم جهاز جديد، فتواصل مع البائع لنقل الترخيص. انظر [نقل العيادة إلى جهاز جديد](backup#new-device) و[جهاز واحد](licence#coverage).',
          '**حذفت مريضاً أو فاتورة بالخطأ، هل أستطيع التراجع؟** لا يوجد تراجع عن الحذف؛ ما يعود هو ما في آخر نسخة احتياطية، والاستعادة تستبدل كل البيانات بما في النسخة. لذلك أرشِف ملف المريض بدل حذفه؛ ولا يحذف البرنامج أصلاً ملفاً عليه فواتير أو دفعات، ومن الفواتير لا يحذف إلا المسودات. انظر [الأرشفة والحذف](patients#archive) و[استعادة نسخة احتياطية](backup#restore).',
        ],
        en: [
          '**Where is my data kept? Is it online?** On your device alone, and it is never sent to a server. That is why a backup is your only second copy: keep it off the device. See [Why backups matter](backup#overview) and [What is sent to the internet?](licence#privacy).',
          '**How often should I back up, and where do I keep the file?** At least weekly, ideally at the end of every working day, from **Settings** → **Backup & data** → **Export backup**. Put the file on a USB stick or in Google Drive, or send it to yourself, and protect it with a password. Dentora reminds you after 7 days without a backup, and the backup holds everything, photos and X-rays included. See [Saving a backup](backup#export) and [Where to keep your backups](backup#where).',
          '**I changed my phone or uninstalled the app and my data is gone. How do I get it back?** On Android, uninstalling the app, or “Clear storage” in the app’s info, erases all clinic data, and Google’s automatic backup does not carry it. The only way back is a backup file you saved earlier: restore it from the setup wizard’s first screen. To update, install the new file over the app without uninstalling it. See [Restoring instead of setting up](getting-started#restore-backup) and [Installing on Android](getting-started#install-android).',
          '**How do I move the clinic to a new computer?** Save a fresh backup on the old device, install Dentora on the new one, choose **Restore your data from a backup** on the wizard’s first screen, then sign in with your usual name and PIN. The new device has a new device number, so contact the seller to move the licence. See [Moving the clinic to a new device](backup#new-device) and [One device](licence#coverage).',
          '**I deleted a patient or an invoice by mistake. Can I undo it?** There is no undo for deleting; what comes back is what the last backup holds, and a restore replaces all data with the backup’s. So archive a patient file instead of deleting it; Dentora never deletes a file with invoices or payments anyway, and of invoices only drafts can be deleted. See [Archiving and deleting](patients#archive) and [Restoring a backup](backup#restore).',
        ],
      },
    },
    {
      id: 'money',
      title: { ar: 'المال والفواتير', en: 'Money and invoices' },
      text: {
        ar: [
          '**كيف أغيّر العملة؟ وهل تتغير المبالغ القديمة؟** من **الإعدادات** ← **الفوترة والعملة** اختر **عملة العيادة** والكسور العشرية. لا تُحوَّل المبالغ المسجلة، بل يتغير الرمز المعروض فقط، فاختر عملتك قبل أول فاتورة. انظر [العملة وشكل المبالغ](settings#billing-currency).',
          '**الأسعار المقترحة بالدولار، كيف أعدّلها دفعة واحدة؟** افتح **قائمة الإجراءات** وانقر على **تعديل الأسعار**: زيادة أو تخفيض بنسبة مئوية أو بمبلغ ثابت مع التقريب، لفئة واحدة أو للكل، ومعاينة قبل التطبيق. مع الليرة السورية أو عملة كتبتها بنفسك تبقى الأسعار بأرقام الدولار حتى تعدّلها. انظر [قائمة الإجراءات والأسعار](treatments#price-list).',
          '**كيف أعيد مبلغاً للمريض؟** من صفحة الفاتورة افتح قائمة ⋮ واختر **استرداد مبلغ**، أو فعّل الاسترداد في نافذة تسجيل الدفعة. يُطبع للاسترداد إيصاله الخاص، ويظهر في المدفوعات بشارة **استرداد** ويُطرح من صافي المقبوضات. انظر [إعادة مبلغ للمريض](billing#refund).',
          '**كيف أعرف من عليه مستحقات؟** في **التقارير** ← **الذمم المستحقة** قائمة كل المرضى المدينين من الأعلى إلى الأدنى، مع زر **تذكير** يرسل عبر واتساب رسالة جاهزة بالمبلغ. والرقم نفسه في الشاشة الرئيسية، وبطاقة **عليهم مستحقات** في قائمة المرضى تعرضهم وحدهم. انظر [الذمم المستحقة وتذكير المرضى](reports#outstanding) و[قائمة المرضى](patients#overview).',
          '**هل يدعم البرنامج ضريبة القيمة المضافة؟** نعم. اكتب **نسبة الضريبة** و**الرقم الضريبي للعيادة** في **الإعدادات** ← **الفوترة والعملة**، فتُقترح النسبة في كل فاتورة جديدة، وتُطبع الفاتورة بعنوان «فاتورة ضريبية» مع الرقم الضريبي. انظر [الضريبة وترقيم الفواتير ونصوص الطباعة](settings#invoices-numbering) و[صفحة الفاتورة](billing#invoice-page).',
          '**كيف أرى مقبوضات اليوم وصندوق العيادة؟** في **المدفوعات** كل دفعة مستلمة برقم إيصالها وطريقة الدفع ومن استلمها، وزر **تقرير الصندوق** يطبع ملخص اليوم حسب طريقة الدفع. أما الإيرادات والمصروفات والربح لأي فترة فمن **التقارير** ← **المالية**. انظر [المدفوعات وتقرير الصندوق](billing#payments) و[المالية](reports#financial).',
        ],
        en: [
          '**How do I change the currency? Do old amounts change?** In **Settings** → **Billing & currency** choose the **Clinic currency** and the decimals. Amounts already recorded are not converted; only the symbol shown changes, so pick your currency before the first invoice. See [Currency and how amounts look](settings#billing-currency).',
          '**The suggested prices are in dollars. How do I adjust them all at once?** Open **Procedures** and click **Adjust prices**: an increase or decrease, by percentage or fixed amount with rounding, for one category or all, with a preview before applying. With the Syrian pound or a currency you typed in yourself, prices stay as dollar figures until you adjust them. See [Procedures and prices](treatments#price-list).',
          '**How do I give money back to a patient?** On the invoice page open the ⋮ menu and choose **Refund**, or turn on the refund option in the payment window. A refund prints its own receipt, shows on the Payments page with a **Refund** badge and comes off the net collected. See [Refunding a patient](billing#refund).',
          '**How do I know who owes the clinic money?** In **Reports** → **Outstanding** every patient with a balance is listed from the largest down, with a **Remind** button that sends a ready WhatsApp message with the amount. The same figure is on the dashboard, and the **With a balance due** card on the Patients page shows those patients alone. See [Outstanding balances and reminders](reports#outstanding) and [The patients list](patients#overview).',
          '**Does it handle VAT?** Yes. Type the **Tax rate** and the **Clinic tax number** in **Settings** → **Billing & currency**: the rate is filled in on every new invoice, and the invoice prints as a “Tax invoice” with the tax number. See [Tax, invoice numbering and printed notes](settings#invoices-numbering) and [The invoice page](billing#invoice-page).',
          '**How do I see today’s takings and the clinic’s cash?** **Payments** lists every payment received with its receipt number, method and who took it, and **Daily cash report** prints the day’s summary by payment method. Revenue, expenses and profit for any period are in **Reports** → **Financial**. See [Payments and the cash report](billing#payments) and [Financial](reports#financial).',
        ],
      },
    },
    {
      id: 'print',
      title: { ar: 'الطباعة وواتساب', en: 'Printing and WhatsApp' },
      text: {
        ar: [
          '**كيف أحفظ الفاتورة ملف PDF أو أرسلها للمريض؟** انقر على **طباعة** في صفحة الفاتورة: على ويندوز اختر «Microsoft Print to PDF»، وعلى أندرويد خيار الحفظ بصيغة PDF في شاشة الطباعة. زر **واتساب** يرسل رسالة نصية برقم الفاتورة وإجماليها والمتبقي ولا يرفق ملفاً؛ لإرسال الفاتورة نفسها شارك ملف PDF من واتساب. انظر [الطباعة وPDF وواتساب](billing#print-share) و[صفحة الفاتورة](billing#invoice-page).',
          '**الطباعة تخرج فارغة أو ناقصة، ماذا أفعل؟** يطبع البرنامج الورقة التي تراها على الشاشة: افتح الفاتورة أو الإيصال أو الوصفة أو التقرير أولاً وانتظر حتى يكتمل، ثم انقر على **طباعة** من الصفحة نفسها واختر الطابعة في نافذة الطباعة. جرّب الحفظ PDF: إن كان الملف سليماً فالمشكلة في الطابعة أو تعريفها. وعلى أندرويد حدّث «Android System WebView» وChrome من متجر Play، وعلى ويندوز اضغط `F5` ثم اطبع من جديد. انظر [الطباعة وPDF وواتساب](billing#print-share) و[اختصارات لوحة المفاتيح وميزات ويندوز](interface#shortcuts).',
          '**كيف أذكّر مرضى الغد بمواعيدهم؟** افتح **التنبيهات** من الجرس: تحت **مواعيد الغد غير المؤكدة** بجانب كل موعد أيقونة **تذكير عبر واتساب** تفتح رسالة جاهزة باليوم والساعة. أو افتح تفاصيل الموعد وانقر على **تذكير عبر واتساب**. انظر [التنبيهات](interface#notifications) و[تذكير المريض عبر واتساب](appointments#reminder).',
          '**زر واتساب لا يفتح شيئاً، أو يفتح رقماً خاطئاً** يحتاج الزر إلى رقم هاتف في ملف المريض وإلى اتصال بالإنترنت. على أندرويد يُفتح تطبيق واتساب، فتأكد أنه مثبت؛ وعلى ويندوز يُفتح الرابط في المتصفح لتكمل في واتساب ويب أو تطبيق واتساب على الحاسوب. ويُضاف إلى الأرقام المحلية مثل 0944… رمز **الدولة** المختارة في **بيانات العيادة**، فتأكد من اختيار بلدك. انظر [بيانات العيادة](settings#clinic-details) و[تذكير المريض عبر واتساب](appointments#reminder).',
        ],
        en: [
          '**How do I save an invoice as a PDF, or send it to the patient?** Click **Print** on the invoice page: on Windows choose “Microsoft Print to PDF”, on Android the save-as-PDF option of the print screen. The **WhatsApp** button sends a text message with the invoice number, total and balance due and attaches no file; to send the invoice itself, share the PDF from WhatsApp. See [Printing, PDF and WhatsApp](billing#print-share) and [The invoice page](billing#invoice-page).',
          '**The printout comes out blank or incomplete. What do I do?** Dentora prints the sheet you see on screen: open the invoice, receipt, prescription or report first and wait for it to finish, then click **Print** on that same page and choose the printer in the print window. Try saving a PDF: if the file is right, the problem is the printer or its driver. On Android update “Android System WebView” and Chrome from the Play Store; on Windows press `F5`, then print again. See [Printing, PDF and WhatsApp](billing#print-share) and [Keyboard shortcuts and Windows extras](interface#shortcuts).',
          '**How do I remind tomorrow’s patients of their appointments?** Open **Notifications** from the bell: under **Unconfirmed for tomorrow**, each appointment has a **Remind on WhatsApp** icon that opens a ready message with the day and time. Or open the appointment’s details and click **WhatsApp reminder**. See [Notifications](interface#notifications) and [WhatsApp reminders](appointments#reminder).',
          '**The WhatsApp button opens nothing, or the wrong number** The button needs a phone number in the patient’s file and an internet connection. On Android the WhatsApp app opens, so make sure it is installed; on Windows the link opens in the browser, where you continue in WhatsApp Web or the WhatsApp desktop app. Local numbers such as 0944… get the code of the **Country** chosen in the **Clinic** settings, so check that your country is selected. See [Clinic details](settings#clinic-details) and [WhatsApp reminders](appointments#reminder).',
        ],
      },
    },
    {
      id: 'devices',
      title: { ar: 'الهاتف وويندوز', en: 'Phone and Windows' },
      text: {
        ar: [
          '**أين القائمة الجانبية على الهاتف؟** على الهاتف، وعلى الجهاز اللوحي عمودياً، يحل محلها شريط في أسفل الشاشة: **الرئيسية** و**المواعيد** و**المرضى** و**الفواتير**، وزر **المزيد** لبقية الصفحات. وعلى ويندوز يظهر الشكل نفسه إن ضيّقت النافذة، فوسّعها لتعود القائمة. انظر [على الهاتف والجهاز اللوحي](interface#phone-layout).',
          '**الخط صغير أو كبير جداً، كيف أغيّره؟** على الهاتف يتبع الخط إعداد حجم الخط في النظام حتى 130%. وعلى ويندوز اضغط `Ctrl` مع `+` للتكبير و`Ctrl` مع `-` للتصغير و`Ctrl` مع `0` للحجم الطبيعي، ويتذكر البرنامج التكبير. وتختار شكل الخط من **الإعدادات** ← **التفضيلات** ← **خط الواجهة**. انظر [اختصارات لوحة المفاتيح وميزات ويندوز](interface#shortcuts) و[اللغة وأسماء الأشهر والخط والمظهر](settings#language-appearance).',
          '**ما الذي يختلف على الهاتف؟** الصفحات والميزات كلها موجودة، وتتغير أماكن بعض الأزرار: زر **+** في الشريط العلوي لموعد جديد، وأزرار عائمة للمريض والفاتورة الجديدين، والتبويبات تُمرَّر جانبياً. وتُفتح كاميرا الهاتف من أزرار اختيار الصورة ورفع الملف، ويُفتح ملف PDF في تطبيق آخر، وحذف الدفعة من الحاسوب فقط. انظر [على الهاتف والجهاز اللوحي](interface#phone-layout) و[الملفات والصور والملاحظات السريرية](patients#files) و[المدفوعات وتقرير الصندوق](billing#payments).',
        ],
        en: [
          '**Where is the sidebar on a phone?** On a phone, and on a tablet held upright, a bar at the bottom of the screen takes its place: **Dashboard**, **Appointments**, **Patients** and **Invoices**, plus **More** for every other page. On Windows the same layout appears when the window is narrow; widen it to get the sidebar back. See [On a phone or tablet](interface#phone-layout).',
          '**The text is too small or too large. How do I change it?** On a phone the text follows the system’s font size setting, up to 130%. On Windows press `Ctrl` with `+` to zoom in, `Ctrl` with `-` to zoom out and `Ctrl` with `0` for the normal size; Dentora remembers the zoom. The typeface itself is chosen in **Settings** → **Preferences** → **Interface font**. See [Keyboard shortcuts and Windows extras](interface#shortcuts) and [Language, month names, font and appearance](settings#language-appearance).',
          '**What is different on a phone?** Every page and feature is there; a few buttons move: **+** in the top bar books an appointment, floating buttons add a patient or an invoice, and tab bars scroll sideways. The phone’s camera is offered by the photo and file upload buttons, a PDF opens in another app, and deleting a payment is done from a computer. See [On a phone or tablet](interface#phone-layout), [Files, images and clinical notes](patients#files) and [Payments and the cash report](billing#payments).',
        ],
      },
    },
    {
      id: 'licence',
      title: { ar: 'الترخيص', en: 'Licence' },
      text: {
        ar: [
          '**ماذا يحدث بعد الأيام السبعة؟** يعمل البرنامج للقراءة فقط: ترى كل شيء وتطبعه وتحفظ نسخة احتياطية، وتتوقف الإضافة والتعديل حتى تفعّل. لا يُحذف شيء، ويعود كل شيء بالتفعيل في أي يوم. انظر [الفترة التجريبية وما بعدها](licence#overview).',
          '**ما الفرق بين مفتاح الترخيص ورمز التفعيل؟** المفتاح 16 خانة يبيعه البائع دون رقم جهازك، ويُفعَّل عبر الإنترنت مرة واحدة من داخل البرنامج (الإصدار 1.1.0 فأحدث) أو من صفحة الموقع. والرمز 112 خانة يصنعه البائع لرقم جهازك ويعمل دون إنترنت. يُلصق الاثنان في الخانة نفسها في **الإعدادات** ← **الترخيص**. انظر [التفعيل بمفتاح الترخيص](licence#key) و[التفعيل برمز مصنوع لرقم جهازك](licence#code).',
          '**اشتريت حاسوباً جديداً، هل يعمل ترخيصي عليه؟** الترخيص لجهاز واحد، وللجهاز الجديد رقم جهاز جديد: انقل بياناتك بالنسخة الاحتياطية ثم تواصل مع البائع لنقل الترخيص. المفتاح المستخدم يُرفض على جهاز ثانٍ بعبارة «هذا المفتاح مفعّل على جهاز آخر». انظر [جهاز واحد](licence#coverage).',
          '**أعدت تثبيت البرنامج، هل أحتاج إلى ترخيص جديد؟** لا. على ويندوز يبقى التفعيل كما هو بعد تحديث النسخة المنزَّلة من الموقع أو إعادة تثبيتها. أما تطبيق أندرويد ونسخة متجر Microsoft فيمسح حذفهما البيانات والتفعيل: استعد نسختك ثم الصق رسالة البائع من جديد، أو أدخل مفتاحك فيعطيك الرمز نفسه، من البرنامج أو من صفحة الموقع. انظر [جهاز واحد](licence#coverage) و[التفعيل من صفحة الموقع](licence#website).',
          '**ما الذي يُرسل إلى الإنترنت عند التفعيل؟** المفتاح ورقم الجهاز فقط، مرة واحدة، إلى dentora.raqeem.dev. لا تُرسل بيانات العيادة أو المرضى أبداً، ورمز التفعيل المصنوع لجهازك لا يحتاج إلى أي اتصال. انظر [ما الذي يُرسل إلى الإنترنت؟](licence#privacy).',
        ],
        en: [
          '**What happens after the seven days?** Dentora becomes read-only: you see and print everything and save a backup, but adding and editing stop until you activate. Nothing is deleted, and everything comes back when you activate, on any day. See [The trial and what comes after](licence#overview).',
          '**What is the difference between a licence key and an activation code?** A key is 16 characters the seller sells without your device number; it is activated online, once, inside Dentora (version 1.1.0 and later) or on the website page. A code is 112 characters the seller makes for your device number, and works offline. Both go in the same field in **Settings** → **Licence**. See [Activating with a licence key](licence#key) and [Activating with a code made for your device number](licence#code).',
          '**I bought a new computer. Does my licence work on it?** A licence is for one device, and the new device has a new device number: move your data with a backup, then contact the seller to move the licence. A used key is refused on a second device with “This key is already activated on another device”. See [One device](licence#coverage).',
          '**I reinstalled Dentora. Do I need a new licence?** No. On Windows the activation stays as it is through an update or a reinstall of the version from the website. Uninstalling the Android app or the Microsoft Store version erases its data and the activation: restore your backup, then paste the seller’s message again, or enter your key, which gives the same code, in Dentora or on the website page. See [One device](licence#coverage) and [Activating on the website](licence#website).',
          '**What is sent to the internet when I activate?** Only the key and the device number, once, to dentora.raqeem.dev. Clinic and patient data are never sent, and an activation code made for your device needs no connection at all. See [What is sent to the internet?](licence#privacy).',
        ],
      },
      shots: ['faq-trial-bar', 'faq-readonly'],
    },
    {
      id: 'trouble',
      title: { ar: 'مشكلات وحلول', en: 'Troubleshooting' },
      text: {
        ar: [
          '**شاشة بيضاء عند الفتح** على أندرويد حدّث «Android System WebView» وChrome من متجر Play، ثم افتح التطبيق من جديد. وعلى ويندوز اضغط `F5`، أو أغلق البرنامج وافتحه؛ وإن استمرت فشغّل برنامج التثبيت فوق النسخة الموجودة: تبقى بياناتك كما هي. انظر [التثبيت على أندرويد](getting-started#install-android) و[التثبيت على ويندوز](getting-started#install-windows).',
          '**نسيت رمز الدخول** يعيّن المدير رمزاً جديداً لأي عضو من **الفريق** ← قائمة ⋮ ← **تعيين رمز دخول جديد**. وإن نسي المدير الوحيد رمزه فمن شاشة الدخول: **نسيت رمز الدخول؟** ← أرسل رقم الجهاز إلى البائع ← الصق رمز إعادة التعيين واختر رمزاً جديداً. وخمس محاولات خاطئة متتالية توقف لوحة الأرقام 30 ثانية، فانتظر ثم أعد المحاولة. انظر [نسيت رمز الدخول؟](staff#forgot-pin) و[الدخول والقفل والخروج](staff#sign-in-lock).',
          '**التاريخ خاطئ، أو رسالة «تاريخ هذا الجهاز أقدم من آخر مرة استُخدم فيها البرنامج»** يأخذ البرنامج اليوم والساعة من الجهاز: إن كان تاريخ الجهاز خاطئاً ظهرت مواعيد اليوم في غير يومها. اضبط التاريخ والوقت في إعدادات ويندوز أو أندرويد، ويُفضَّل الضبط التلقائي من الشبكة. ويتذكر البرنامج آخر تاريخ رآه، فإرجاع التاريخ لا يعيد أيام التجربة ولا يحيي ترخيصاً انتهى. انظر [الفترة التجريبية وما بعدها](licence#overview).',
          '**لا أستطيع تثبيت ملف APK على أندرويد** اسمح بـ«تثبيت التطبيقات غير المعروفة» للتطبيق الذي فتحت منه الملف، وفي تحذير Google Play Protect اختر «التثبيت على أي حال». يلزم أندرويد 7.0 أو أحدث ومساحة كافية، وإن توقف التنزيل قبل اكتماله فنزّل الملف من جديد. وللتحديث ثبّت الملف فوق التطبيق الموجود ولا تحذفه. انظر [التثبيت على أندرويد](getting-started#install-android).',
          '**ويندوز يمنع تشغيل برنامج التثبيت** في شاشة «حماية Windows» انقر على «مزيد من المعلومات» ثم «تشغيل على أي حال»؛ تظهر لأن البرنامج جديد على ويندوز. وإن لم يظهر الزر فلا توقف حماية ويندوز، بل راسل البائع. انظر [التثبيت على ويندوز](getting-started#install-windows).',
          '**البرنامج بطيء مع كثرة الصور والأشعة** تُحفظ الملفات بحجمها الأصلي على الجهاز، حتى 25 ميغابايت للملف، وتدخل في النسخة الاحتياطية، فتكبر النسخ وتطول الاستعادة. ارفع الصورة بحجم معقول (صورة من كاميرا الهاتف لا مسحاً ضوئياً عالي الدقة)، وأبقِ مساحة حرة على الجهاز؛ ينبّهك البرنامج قبل الرفع إن ضاقت المساحة. انظر [الملفات والصور والملاحظات السريرية](patients#files).',
          '**أحتاج إلى مساعدة، ما الذي أرسله؟** راسل الجهة التي اشتريت منها البرنامج على واتساب، ومعك رقم الإصدار ورقم الجهاز من **الإعدادات** ← **حول البرنامج**، ووصف ما حدث وصورة للشاشة. انظر [حول البرنامج](settings#about). ومن الصفحة نفسها، في بطاقة **مساعدة**، تفتح دليل الاستخدام هذا والفيديوهات التعليمية.',
        ],
        en: [
          '**A white screen when the app opens** On Android, update “Android System WebView” and Chrome from the Play Store, then open the app again. On Windows press `F5`, or close Dentora and open it again; if it goes on, run the installer over the installed copy: your data stays as it is. See [Installing on Android](getting-started#install-android) and [Installing on Windows](getting-started#install-windows).',
          '**I forgot my PIN** The admin sets a new PIN for anyone from **Staff** → the ⋮ menu → **Set a new PIN**. If the only admin forgot theirs, start on the sign-in screen: **Forgot your PIN?** → send the device number to the seller → paste the reset code and choose a new PIN. Five wrong PINs in a row pause the keypad for 30 seconds, so wait and try again. See [Forgot your PIN?](staff#forgot-pin) and [Signing in, locking and signing out](staff#sign-in-lock).',
          '**The date is wrong, or “The date on this device is earlier than the last time Dentora was used”** Dentora takes the day and time from the device: with a wrong device date, today’s appointments show on the wrong day. Set the date and time in the Windows or Android settings, ideally automatically from the network. Dentora remembers the latest date it has seen, so setting the date back never gives trial days back or revives an ended licence. See [The trial and what comes after](licence#overview).',
          '**I cannot install the APK on Android** Allow “Install unknown apps” for the app you opened the file from, and in the Google Play Protect warning choose “Install anyway”. Android 7.0 or later and enough free space are needed, and if the download stopped before it finished, download the file again. To update, install the file over the existing app; never uninstall it. See [Installing on Android](getting-started#install-android).',
          '**Windows blocks the installer** On the “Windows protected your PC” screen click “More info”, then “Run anyway”; it shows because the app is new to Windows. If there is no such button, do not turn Windows security off: message the seller. See [Installing on Windows](getting-started#install-windows).',
          '**The app is slow with many photos and X-rays** Files are kept at their original size on the device, up to 25 MB each, and go into the backup, so backups grow and restores take longer. Upload pictures at a sensible size (a phone camera photo rather than a high-resolution scan) and keep free space on the device; Dentora warns before an upload when space is short. See [Files, images and clinical notes](patients#files).',
          '**I need help. What should I send?** Message whoever sold you Dentora on WhatsApp, with the version and device number from **Settings** → **About**, what happened, and a picture of the screen. See [About](settings#about). The same page’s **Help** card opens this guide and the video tutorials.',
        ],
      },
      shots: ['faq-clock-behind'],
    },
  ],
  shots: [
    {
      id: 'faq-trial-bar',
      device: 'desktop',
      alt: {
        ar: 'أعلى الشاشة الرئيسية أثناء الفترة التجريبية: الشريط الأصفر «نسخة تجريبية — تبقّى 7 أيام» مع زر تفعيل الآن',
        en: 'The top of the dashboard during the trial: the yellow bar “Trial version — 7 days left” with the Activate now button',
      },
      caption: { ar: 'الشريط الأصفر يظهر في كل الشاشات حتى التفعيل.', en: 'The yellow bar shows on every screen until you activate.' },
      recipe: `${DESK} Show the trial bar ([data-qa="trial-bar"]{display:flex}) on the dashboard (#/). Crop to the top of the window: full width, from the top down to just under the dashboard's page title (about 230 px). Markers: 1 on Activate now (the button inside [data-qa="trial-bar"]).`,
    },
    {
      id: 'faq-readonly',
      device: 'desktop',
      alt: {
        ar: 'الشاشة الرئيسية بعد انتهاء الفترة التجريبية: الشريط الأحمر «انتهت الفترة التجريبية. فعّل النظام لمتابعة العمل.» مع زر تفعيل الآن، والأرقام والجدول ظاهرة، وزر جديد مختفٍ',
        en: 'The dashboard after the trial: the red bar “The trial has ended. Activate to keep working.” with the Activate now button, the figures and schedule still visible, and the New button gone',
      },
      caption: { ar: 'وضع القراءة فقط: كل شيء ظاهر، ولا شيء محذوف.', en: 'Read-only mode: everything is visible, nothing is deleted.' },
      recipe: `${DESK} Move the trial start 8 days back (settings 'installedAt' = 3 Oct 2026, in one transaction over every table as a restore does), show the trial bar ([data-qa="trial-bar"]{display:flex}) and reload the dashboard (#/). Capture the whole window. No markers.`,
    },
    {
      id: 'faq-clock-behind',
      device: 'desktop',
      alt: {
        ar: 'بطاقة حالة الترخيص مع تنبيه أصفر: تاريخ هذا الجهاز أقدم من آخر مرة استُخدم فيها البرنامج. اضبط التاريخ والوقت في إعدادات الجهاز',
        en: 'The licence state card with a yellow warning: the date on this device is earlier than the last time Dentora was used; set the date and time in the device settings',
      },
      recipe: `${DESK} Put the licence clock 3 days ahead of the device (localStorage 'dentora.lastSeen' = the clock + 3 days, in milliseconds) and reload. Route #/settings/license, wait for the device number. Crop to the state card ([data-qa="license-status"]), no margin. No markers.`,
    },
  ],
}
export default topic

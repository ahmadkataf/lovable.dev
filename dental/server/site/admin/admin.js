// Dentora's control panel (/admin): one page, no framework and no build step. The CSP allows scripts and styles from
// this origin only, so nothing here writes inline styles or HTML strings: every element is made with createElement
// and every value set as text, which also means nothing a customer typed can ever run as markup.
// The API it talks to: server/SPEC.md → Control panel API; the shapes: server/src/types.ts.

const LANG_KEY = 'dentora.admin.lang'
/** When the session cookie (HttpOnly, so unreadable here) runs out: a signed-out visit then opens on the sign-in
 * screen without first asking /api/me for a 401. 12 hours = the cookie's Max-Age (SPEC.md). */
const SESSION_KEY = 'dentora.admin.session'
const SESSION_MS = 43_200_000
const PAGE = 20
/** The device number's alphabet (base32 without 0/O and 1/I), as the app makes it. */
const DEVICE_RE = /^[2-9A-HJ-NP-Z]{8}$/
const SITE_PRICE_MAX = 100_000

// ---- words ---------------------------------------------------------------------------------------------------------
const T = {
  ar: {
    'app.title': 'لوحة تحكم Dentora', 'app.panel': 'لوحة التحكم', skip: 'تخطٍّ إلى المحتوى',
    'lang.other': 'English', 'lang.aria': 'Switch to English',
    cancel: 'إلغاء', close: 'إغلاق', save: 'حفظ', saving: 'جارٍ الحفظ…', retry: 'إعادة المحاولة', loading: 'جارٍ التحميل…',
    copy: 'نسخ', copied: 'تم النسخ', copyFailed: 'تعذّر النسخ. حدّدوا النص وانسخوه يدوياً.', justNow: 'الآن',

    'nav.menu': 'القائمة الرئيسية', 'nav.dashboard': 'الرئيسية', 'nav.new': 'ترخيص جديد', 'nav.newShort': 'جديد',
    'nav.licences': 'التراخيص', 'nav.reset': 'إعادة تعيين PIN', 'nav.resetShort': 'رمز PIN', 'nav.verify': 'التحقق من رمز',
    'nav.settings': 'الإعدادات', 'nav.activity': 'سجل النشاط', 'nav.more': 'المزيد', 'nav.site': 'عرض الموقع',
    'nav.logout': 'تسجيل الخروج', 'nav.moreTitle': 'المزيد من الصفحات',

    'login.lead': 'سجّلوا الدخول لإصدار التراخيص ومتابعة المبيعات.', 'login.password': 'كلمة المرور',
    'login.show': 'إظهار كلمة المرور', 'login.hide': 'إخفاء كلمة المرور', 'login.submit': 'دخول', 'login.checking': 'جارٍ التحقق…',
    'login.empty': 'أدخلوا كلمة المرور.', 'login.wrong': 'كلمة المرور غير صحيحة.',
    'login.locked': 'محاولات خاطئة كثيرة، فأُوقف الدخول مؤقتاً.', 'login.lockedWait': 'يمكنكم المحاولة مجدداً بعد:',
    'login.unlocked': 'يمكنكم المحاولة مجدداً الآن.', 'login.expired': 'انتهت الجلسة. سجّلوا الدخول مجدداً.',
    'login.loggedOut': 'تم تسجيل الخروج.', 'login.foot': 'للبائع فقط. كل محاولة دخول تُسجَّل.',
    'setup.title': 'كلمة مرور اللوحة غير مضبوطة',
    'setup.body': 'لن تفتح اللوحة قبل ضبط السر ADMIN_PASSWORD على الـ Worker بكلمة مرور من 12 حرفاً على الأقل. نفّذوا من مجلد المشروع:',
    'setup.after': 'أدخلوا كلمة المرور عند الطلب، ثم اضغطوا «إعادة المحاولة». للتجربة المحلية ضعوا السطر ADMIN_PASSWORD=… في الملف dental/server/.dev.vars بدلاً من ذلك.',
    'offline.title': 'تعذّر الاتصال بالخادم',

    'err.network': 'تعذّر الاتصال بالخادم. تحقّقوا من الإنترنت وحاولوا مجدداً.', 'err.server': 'حدث خطأ في الخادم. حاولوا مجدداً بعد قليل.',
    'err.origin': 'رُفض الطلب لأسباب أمنية. أعيدوا تحميل الصفحة.', 'err.notFound': 'لم يُعثر على هذا الترخيص.',
    'err.signing': 'توقيع الرموز غير مضبوط على الخادم، فلا يمكن إصدار رموز الآن.', 'err.generic': 'تعذّر إتمام العملية. حاولوا مجدداً.',
    'err.load': 'تعذّر تحميل هذه الصفحة',

    'sign.title': 'إصدار الرموز متوقف',
    'sign.missing': 'لا يوجد مفتاح خاص على الـ Worker. أضيفوا السر LICENSE_PRIVATE_JWK والصقوا عند الطلب سطر JSON الكامل من الملف license-private.jwk:',
    'sign.format': 'السر LICENSE_PRIVATE_JWK ليس مفتاحاً خاصاً صالحاً (JWK من نوع P-256). أعيدوا ضبطه بسطر JSON الكامل من الملف license-private.jwk:',
    'sign.mismatch': 'السر LICENSE_PRIVATE_JWK ليس المفتاح المدمج في التطبيق، أي أنه من ملف مفتاح خاطئ. اضبطوه من ملف license-private.jwk الصحيح:',
    'sign.after': 'ثم أعيدوا تحميل هذه الصفحة.', 'sign.blocked': 'الإصدار غير متاح حتى يُضبط المفتاح الخاص (انظروا التنبيه في الأعلى).',

    'dash.title': 'نظرة عامة', 'dash.lead': 'المبيعات والتنزيلات وآخر ما جرى في اللوحة.', 'dash.kpis': 'الأرقام الرئيسية',
    'dash.revenue': 'الإيرادات', 'dash.revenueNote': 'من التراخيص الفعّالة', 'dash.thisMonth': 'هذا الشهر',
    'dash.licences': 'التراخيص', 'dash.licencesNote': 'دون الملغاة', 'dash.resets': 'رموز PIN', 'dash.allTime': 'منذ البداية',
    'dash.downloads': 'التنزيلات', 'dash.android': 'أندرويد', 'dash.windows': 'ويندوز', 'dash.last30': 'آخر 30 يوماً',
    'dash.quick': 'إجراءات سريعة', 'dash.latest': 'أحدث التراخيص', 'dash.viewAll': 'عرض الكل',
    'dash.activity': 'آخر النشاطات', 'dash.fullLog': 'السجل الكامل', 'dash.noLicences': 'لم يُصدَر أي ترخيص بعد.',
    'dash.noActivity': 'لا نشاط بعد.',

    'new.title': 'ترخيص جديد', 'new.lead': 'أدخلوا رقم الجهاز الظاهر في التطبيق، ثم اختاروا الباقة والمدة.',
    'new.submit': 'إصدار الرمز', 'new.submitting': 'جارٍ الإصدار…', 'new.issued': 'تم إصدار الترخيص',
    'new.issuedToast': 'تم إصدار الترخيص للجهاز {device}', 'new.another': 'ترخيص آخر', 'new.openList': 'فتح في التراخيص',
    'new.existingTitle': 'لهذا الجهاز تراخيص فعّالة أخرى: {n}',
    'new.existingBody': 'إن كان هذا الرمز بديلاً عنها، غيّروا حالة القديم إلى «ملغى» أو «مسترد» لتبقى الأرقام دقيقة.',
    'tips.title': 'خطوات البيع', 'tips.1': 'رقم الجهاز', 'tips.1b': 'يجده الزبون في التطبيق: الإعدادات ← الترخيص.',
    'tips.2': 'إصدار الرمز', 'tips.2b': 'اختاروا الباقة والمدة، وسجّلوا المبلغ المدفوع.',
    'tips.3': 'الإرسال', 'tips.3b': 'أرسلوا الرسالة الجاهزة على واتساب؛ يلصقها الزبون كاملة في التطبيق ويضغط «تفعيل».',
    'tips.note': 'الرموز تعمل دون إنترنت ولا يمكن سحبها بعد إرسالها، فتأكدوا من رقم الجهاز.',

    'f.device': 'رقم الجهاز', 'f.deviceHint': '8 أحرف وأرقام، مثل 7KQ4-M2XD. لا يحتوي على 0 أو 1 أو O أو I.',
    'f.plan': 'الباقة', 'plan.pro': 'احترافية', 'plan.standard': 'أساسية', 'f.validity': 'المدة',
    'val.lifetime': 'مدى الحياة', 'val.1y': 'سنة', 'val.2y': 'سنتان', 'val.date': 'حتى تاريخ', 'f.until': 'آخر يوم صالح',
    'val.preview': 'صالح حتى {date}', 'val.previewLife': 'لا ينتهي أبداً',
    'f.customer': 'اسم الزبون', 'f.clinic': 'اسم العيادة', 'f.phone': 'واتساب الزبون',
    'f.phoneHint': 'مع رمز الدولة، أو رقم محلي يبدأ بـ 0 (يُضاف 963). يُستخدم لزر الإرسال على واتساب.',
    'f.price': 'المبلغ المدفوع ($)', 'f.priceHint': 'السعر الافتراضي من الإعدادات: {price}', 'f.note': 'ملاحظة',
    'f.noteHint': 'لكم فقط، لا يراها الزبون.', 'f.optional': 'اختياري',
    'e.device': 'أدخلوا رقم الجهاز كاملاً: 8 أحرف وأرقام كما يظهر في التطبيق.',
    'e.deviceChars': 'رقم الجهاز لا يحتوي على 0 أو 1 أو O أو I. تحقّقوا منه.', 'e.until': 'اختاروا تاريخاً من اليوم فصاعداً.',
    'e.price': 'أدخلوا مبلغاً من 0 إلى 100000.', 'e.text': 'النص طويل جداً (200 حرف كحد أقصى).',
    'e.note': 'الملاحظة طويلة جداً (1000 حرف كحد أقصى).', 'e.choice': 'اختاروا أحد الخيارات.', 'e.code': 'الصقوا الرمز أو الرسالة.',

    'code.label': 'رمز التفعيل', 'code.copy': 'نسخ الرمز', 'msg.label': 'رسالة الزبون', 'msg.copy': 'نسخ الرسالة',
    'msg.lang': 'لغة الرسالة', 'wa.send': 'إرسال على واتساب', 'wa.resend': 'إعادة الإرسال على واتساب',
    'wa.noPhone': 'لا يوجد رقم للزبون، فسيطلب واتساب اختيار المحادثة.',

    'lic.title': 'التراخيص', 'lic.lead': 'كل رمز تفعيل صدر من اللوحة، الأحدث أولاً.', 'lic.search': 'بحث في التراخيص',
    'lic.searchPh': 'رقم الجهاز، الاسم، العيادة أو الهاتف', 'lic.status': 'الحالة', 'lic.all': 'كل الحالات', 'lic.csv': 'تصدير CSV',
    'st.active': 'فعّال', 'st.refunded': 'مسترد', 'st.void': 'ملغى',
    'col.customer': 'الزبون', 'col.device': 'الجهاز', 'col.validity': 'الباقة والصلاحية', 'col.price': 'المبلغ',
    'col.status': 'الحالة', 'col.issued': 'تاريخ الإصدار', 'col.until': 'الصلاحية',
    'lic.noName': 'بلا اسم', 'lic.until': 'حتى {date}', 'lic.ended': 'انتهى في {date}', 'lic.range': '{from}–{to} من {total}',
    'lic.prev': 'السابق', 'lic.next': 'التالي', 'lic.empty': 'لا توجد تراخيص بعد',
    'lic.emptyBody': 'أصدروا أول ترخيص وسيظهر هنا مع بيانات الزبون.', 'lic.noMatch': 'لا نتائج مطابقة',
    'lic.noMatchBody': 'جرّبوا جزءاً من رقم الجهاز أو الهاتف، أو حالة أخرى.', 'lic.clear': 'مسح البحث',

    'det.title': 'تفاصيل الترخيص', 'det.issued': 'تاريخ الإصدار', 'det.edit': 'بيانات الزبون', 'det.save': 'حفظ التعديلات',
    'det.saved': 'تم حفظ التعديلات.', 'det.status': 'حالة الترخيص',
    'det.statusHint': 'الحالة لسجلاتكم وأرقامكم فقط: الرمز يعمل دون إنترنت، فلا يتوقف في التطبيق بتغييرها.',
    'det.statusSaved': 'تغيّرت الحالة إلى «{status}».',
    'conf.refunded.title': 'تحويل الترخيص إلى «مسترد»؟',
    'conf.refunded.body': 'يخرج مبلغه من الإيرادات ويبقى ضمن عدد التراخيص. الرمز نفسه يبقى صالحاً في التطبيق.',
    'conf.refunded.ok': 'نعم، مسترد',
    'conf.void.title': 'إلغاء هذا الترخيص؟',
    'conf.void.body': 'يخرج من عدد التراخيص ومن الإيرادات. الرمز نفسه يبقى صالحاً في التطبيق لأنه يعمل دون إنترنت.',
    'conf.void.ok': 'نعم، إلغاء', 'conf.active.title': 'إعادة الترخيص إلى «فعّال»؟',
    'conf.active.body': 'يُحتسب مجدداً في عدد التراخيص وفي الإيرادات.', 'conf.active.ok': 'نعم، فعّال',

    'reset.title': 'إعادة تعيين رمز الدخول',
    'reset.lead': 'عندما ينسى مدير العيادة رمز الدخول (PIN): يضغط «نسيت رمز الدخول؟» في شاشة الدخول ويرسل لكم رقم الجهاز. الرمز يعمل مرة واحدة على ذلك الجهاز، اليوم وغداً (بتوقيت UTC).',
    'reset.submit': 'إنشاء رمز إعادة التعيين', 'reset.submitting': 'جارٍ الإنشاء…', 'reset.made': 'رمز إعادة التعيين جاهز',
    'reset.code': 'رمز إعادة التعيين', 'reset.validity': 'صالح من {from} حتى {to}، لمرة واحدة', 'reset.recent': 'آخر الرموز',
    'reset.none': 'لم يُنشأ أي رمز بعد.', 'reset.valid': 'ساري', 'reset.expired': 'منتهٍ', 'reset.until': 'حتى {date}',
    'reset.another': 'رمز آخر', 'reset.toast': 'رمز إعادة التعيين جاهز للجهاز {device}', 'reset.copyCode': 'نسخ رمز {device}',

    'ver.title': 'التحقق من رمز',
    'ver.lead': 'الصقوا رمزاً أو رسالة كاملة لمعرفة نوعه وهل يعمل على جهاز معيّن، بالمدقق نفسه الذي يستخدمه التطبيق.',
    'ver.code': 'الرمز أو الرسالة', 'ver.codeHint': 'يُقرأ الرمز من داخل الرسالة تلقائياً.', 'ver.submit': 'تحقّق',
    'ver.checking': 'جارٍ التحقق…', 'ver.placeholder': 'ستظهر النتيجة هنا', 'ver.placeholderBody': 'أدخلوا رقم الجهاز والرمز ثم اضغطوا «تحقّق».',
    'ver.okAct': 'رمز تفعيل صالح', 'ver.okReset': 'رمز إعادة تعيين صالح', 'ver.bad': 'الرمز لا يعمل على هذا الجهاز',
    'ver.kind': 'النوع', 'ver.kindAct': 'تفعيل', 'ver.kindReset': 'إعادة تعيين رمز الدخول', 'ver.kindNone': 'غير معروف',
    'ver.lastDay': 'آخر يوم', 'ver.device': 'الجهاز',
    'ver.r.format': 'ليس رمز Dentora كاملاً: ينقصه حرف أو فيه خطأ في الكتابة.',
    'ver.r.device': 'الرمز صادر لجهاز آخر، أو أن رقم الجهاز مكتوب خطأ.', 'ver.r.kind': 'نوع الرمز لا يطابق.',
    'ver.r.expired': 'انتهت صلاحية الرمز في {date}.', 'ver.r.expiredReset': 'انتهت صلاحية رمز إعادة التعيين.',

    'set.title': 'الإعدادات', 'set.lead': 'ما يظهر على الموقع وفي أزرار الشراء. تصل التغييرات إلى الموقع خلال 30 ثانية.',
    'set.pricing': 'السعر', 'set.contact': 'التواصل', 'set.downloads': 'التنزيلات', 'set.announce': 'شريط الإعلان',
    's.priceUsd': 'السعر بالدولار', 's.priceUsdHint': 'المبلغ الافتراضي عند إصدار ترخيص، والسعر الذي تراه محركات البحث.',
    's.priceTextAr': 'سطر السعر (العربية)', 's.priceTextArHint': 'يظهر في بطاقة السعر بالصفحة العربية.',
    's.priceTextEn': 'سطر السعر (الإنجليزية)', 's.priceTextEnHint': 'يظهر في بطاقة السعر بالصفحة الإنجليزية.',
    's.whatsapp': 'رقم واتساب', 's.whatsappHint': 'بالصيغة الدولية، مثل ‎+963 996 489 504. كل أزرار واتساب في الموقع تستخدمه.',
    's.email': 'البريد الإلكتروني', 's.emailHint': 'اختياري: يظهر في التذييل وصفحتي الخصوصية والشروط. اتركوه فارغاً لإخفائه.',
    's.windowsUrl': 'رابط تنزيل ويندوز', 's.windowsUrlHint': 'رابط https لملف التثبيت. إن تُرك فارغاً، يطلب الزر نسخة ويندوز منكم على واتساب.',
    's.announcementAr': 'نص الإعلان (العربية)', 's.announcementArHint': 'سطر في أعلى الصفحة العربية. اتركوه فارغاً لإخفاء الشريط.',
    's.announcementEn': 'نص الإعلان (الإنجليزية)', 's.announcementEnHint': 'سطر في أعلى الصفحة الإنجليزية. اتركوه فارغاً لإخفاء الشريط.',
    'se.priceUsd': 'أدخلوا سعراً من 0 إلى 100000.', 'se.whatsapp': 'أدخلوا رقماً من 8 إلى 15 خانة، يمكن أن يبدأ بـ +.',
    'se.email': 'أدخلوا بريداً إلكترونياً صحيحاً، أو اتركوه فارغاً.', 'se.windowsUrl': 'أدخلوا رابطاً يبدأ بـ https://‎، أو اتركوه فارغاً.',
    'se.text': 'النص طويل جداً (300 حرف كحد أقصى).',
    'set.saved': 'تم حفظ الإعدادات. تظهر على الموقع خلال 30 ثانية.', 'set.unsaved': 'تعديلات غير محفوظة',
    'set.clean': 'كل التعديلات محفوظة', 'set.noChanges': 'لا تعديلات لحفظها.', 'set.fix': 'صحّحوا الحقل المحدد ثم احفظوا.',
    'set.system': 'النظام', 'set.signing': 'توقيع الرموز', 'set.signingOk': 'جاهز: المفتاح الخاص مضبوط ويطابق التطبيق.',
    'set.password': 'كلمة مرور اللوحة',
    'set.passwordBody': 'تُغيَّر بالأمر التالي، وتغييرها يُخرج كل الجلسات المفتوحة. تدوم الجلسة 12 ساعة.',
    'set.site': 'الموقع', 'set.siteBody': 'افتحوا الصفحتين بعد الحفظ لرؤية التغييرات.', 'set.siteAr': 'الصفحة العربية', 'set.siteEn': 'الصفحة الإنجليزية',

    'act.title': 'سجل النشاط', 'act.lead': 'كل دخول وإصدار وتعديل يُسجَّل هنا (آخر 200 حدث).', 'act.filter': 'عرض',
    'act.f.all': 'كل الأحداث', 'act.f.auth': 'الدخول والخروج', 'act.f.licence': 'التراخيص', 'act.f.reset': 'إعادة التعيين',
    'act.f.settings': 'الإعدادات', 'act.empty': 'لا أحداث هنا بعد.', 'act.today': 'اليوم', 'act.yesterday': 'أمس', 'act.count': 'الأحداث: {n}',
    'a.login.ok': 'تسجيل دخول', 'a.login.fail': 'محاولة دخول فاشلة', 'a.logout': 'تسجيل خروج', 'a.licence.create': 'إصدار ترخيص',
    'a.licence.update': 'تعديل ترخيص', 'a.licences.csv': 'تصدير التراخيص (CSV)', 'a.reset.create': 'رمز إعادة تعيين PIN',
    'a.settings.update': 'تعديل الإعدادات', 'a.rows': 'الصفوف: {n}', 'a.ip': 'IP {ip}',
  },
  en: {
    'app.title': 'Dentora control panel', 'app.panel': 'Control panel', skip: 'Skip to content',
    'lang.other': 'العربية', 'lang.aria': 'التبديل إلى العربية',
    cancel: 'Cancel', close: 'Close', save: 'Save', saving: 'Saving…', retry: 'Try again', loading: 'Loading…',
    copy: 'Copy', copied: 'Copied', copyFailed: 'Could not copy. Select the text and copy it by hand.', justNow: 'just now',

    'nav.menu': 'Main menu', 'nav.dashboard': 'Dashboard', 'nav.new': 'New licence', 'nav.newShort': 'New',
    'nav.licences': 'Licences', 'nav.reset': 'PIN reset', 'nav.resetShort': 'PIN reset', 'nav.verify': 'Verify a code',
    'nav.settings': 'Settings', 'nav.activity': 'Activity log', 'nav.more': 'More', 'nav.site': 'View website',
    'nav.logout': 'Log out', 'nav.moreTitle': 'More pages',

    'login.lead': 'Sign in to issue licences and follow your sales.', 'login.password': 'Password',
    'login.show': 'Show password', 'login.hide': 'Hide password', 'login.submit': 'Sign in', 'login.checking': 'Checking…',
    'login.empty': 'Enter the password.', 'login.wrong': 'Wrong password.',
    'login.locked': 'Too many wrong attempts, so signing in is paused.', 'login.lockedWait': 'You can try again in:',
    'login.unlocked': 'You can try again now.', 'login.expired': 'Your session ended. Please sign in again.',
    'login.loggedOut': 'Signed out.', 'login.foot': 'For the seller only. Every sign-in attempt is logged.',
    'setup.title': 'The panel password is not set',
    'setup.body': 'The panel stays closed until the Worker has an ADMIN_PASSWORD secret of at least 12 characters. From the project folder, run:',
    'setup.after': 'Type the password when asked, then press “Try again”. For local testing, put the line ADMIN_PASSWORD=… in dental/server/.dev.vars instead.',
    'offline.title': 'Could not reach the server',

    'err.network': 'Could not reach the server. Check the connection and try again.', 'err.server': 'The server ran into an error. Try again shortly.',
    'err.origin': 'The request was refused for security reasons. Reload the page.', 'err.notFound': 'This licence was not found.',
    'err.signing': 'Code signing is not set up on the server, so no codes can be made right now.', 'err.generic': 'That did not work. Please try again.',
    'err.load': 'This page could not be loaded',

    'sign.title': 'Code signing is off',
    'sign.missing': 'The Worker has no private key. Add the LICENSE_PRIVATE_JWK secret and, when asked, paste the whole one-line JSON of license-private.jwk:',
    'sign.format': 'The LICENSE_PRIVATE_JWK secret is not a valid private key (a P-256 JWK). Set it again with the whole one-line JSON of license-private.jwk:',
    'sign.mismatch': 'The LICENSE_PRIVATE_JWK secret is not the key built into the app: it comes from the wrong key file. Set it from the right license-private.jwk:',
    'sign.after': 'Then reload this page.', 'sign.blocked': 'Issuing is unavailable until the private key is set (see the notice above).',

    'dash.title': 'Overview', 'dash.lead': 'Sales, downloads and the latest activity in the panel.', 'dash.kpis': 'Key figures',
    'dash.revenue': 'Revenue', 'dash.revenueNote': 'From active licences', 'dash.thisMonth': 'This month',
    'dash.licences': 'Licences', 'dash.licencesNote': 'Excluding void', 'dash.resets': 'PIN resets', 'dash.allTime': 'All time',
    'dash.downloads': 'Downloads', 'dash.android': 'Android', 'dash.windows': 'Windows', 'dash.last30': 'Last 30 days',
    'dash.quick': 'Quick actions', 'dash.latest': 'Latest licences', 'dash.viewAll': 'View all',
    'dash.activity': 'Recent activity', 'dash.fullLog': 'Full log', 'dash.noLicences': 'No licences issued yet.',
    'dash.noActivity': 'No activity yet.',

    'new.title': 'New licence', 'new.lead': 'Enter the device number the app shows, then pick the plan and validity.',
    'new.submit': 'Issue code', 'new.submitting': 'Issuing…', 'new.issued': 'Licence issued',
    'new.issuedToast': 'Licence issued for device {device}', 'new.another': 'Issue another', 'new.openList': 'Open in Licences',
    'new.existingTitle': 'This device has other active licences: {n}',
    'new.existingBody': 'If this code replaces them, set the old one to Void or Refunded so your numbers stay right.',
    'tips.title': 'How a sale goes', 'tips.1': 'The device number', 'tips.1b': 'The customer finds it in the app under Settings → Licence.',
    'tips.2': 'Issue the code', 'tips.2b': 'Pick the plan and validity, and record the amount paid.',
    'tips.3': 'Send it', 'tips.3b': 'Send the ready message on WhatsApp; the customer pastes all of it into the app and presses Activate.',
    'tips.note': 'Codes work offline and cannot be taken back once sent, so double-check the device number.',

    'f.device': 'Device number', 'f.deviceHint': '8 letters and digits, like 7KQ4-M2XD. It never contains 0, 1, O or I.',
    'f.plan': 'Plan', 'plan.pro': 'Pro', 'plan.standard': 'Standard', 'f.validity': 'Validity',
    'val.lifetime': 'Lifetime', 'val.1y': '1 year', 'val.2y': '2 years', 'val.date': 'Until a date', 'f.until': 'Last valid day',
    'val.preview': 'Valid until {date}', 'val.previewLife': 'Never expires',
    'f.customer': 'Customer name', 'f.clinic': 'Clinic name', 'f.phone': 'Customer WhatsApp',
    'f.phoneHint': 'With the country code, or a local number starting with 0 (963 is added). Used for the WhatsApp button.',
    'f.price': 'Amount paid ($)', 'f.priceHint': 'Default from Settings: {price}', 'f.note': 'Note',
    'f.noteHint': 'Only for you; the customer never sees it.', 'f.optional': 'optional',
    'e.device': 'Enter the full device number: 8 letters and digits, as the app shows it.',
    'e.deviceChars': 'Device numbers never contain 0, 1, O or I. Check it again.', 'e.until': 'Pick a date from today on.',
    'e.price': 'Enter an amount from 0 to 100000.', 'e.text': 'Too long (200 characters at most).',
    'e.note': 'Too long (1000 characters at most).', 'e.choice': 'Pick one of the options.', 'e.code': 'Paste the code or the message.',

    'code.label': 'Activation code', 'code.copy': 'Copy code', 'msg.label': 'Message for the customer', 'msg.copy': 'Copy message',
    'msg.lang': 'Message language', 'wa.send': 'Send on WhatsApp', 'wa.resend': 'Resend on WhatsApp',
    'wa.noPhone': 'No customer number, so WhatsApp will ask which chat to use.',

    'lic.title': 'Licences', 'lic.lead': 'Every activation code issued from the panel, newest first.', 'lic.search': 'Search licences',
    'lic.searchPh': 'Device, name, clinic or phone', 'lic.status': 'Status', 'lic.all': 'All statuses', 'lic.csv': 'Export CSV',
    'st.active': 'Active', 'st.refunded': 'Refunded', 'st.void': 'Void',
    'col.customer': 'Customer', 'col.device': 'Device', 'col.validity': 'Plan & validity', 'col.price': 'Amount',
    'col.status': 'Status', 'col.issued': 'Issued', 'col.until': 'Validity',
    'lic.noName': 'No name', 'lic.until': 'Until {date}', 'lic.ended': 'Ended {date}', 'lic.range': '{from}–{to} of {total}',
    'lic.prev': 'Previous', 'lic.next': 'Next', 'lic.empty': 'No licences yet',
    'lic.emptyBody': 'Issue the first one and it will appear here with the customer’s details.', 'lic.noMatch': 'No matches',
    'lic.noMatchBody': 'Try part of the device number or phone, or another status.', 'lic.clear': 'Clear search',

    'det.title': 'Licence details', 'det.issued': 'Issued', 'det.edit': 'Customer details', 'det.save': 'Save changes',
    'det.saved': 'Changes saved.', 'det.status': 'Licence status',
    'det.statusHint': 'The status is for your records and numbers only: codes work offline, so changing it does not switch the code off in the app.',
    'det.statusSaved': 'Status changed to {status}.',
    'conf.refunded.title': 'Mark this licence as refunded?',
    'conf.refunded.body': 'Its amount leaves the revenue; it still counts as a licence. The code itself keeps working in the app.',
    'conf.refunded.ok': 'Mark refunded',
    'conf.void.title': 'Void this licence?',
    'conf.void.body': 'It leaves both the licence count and the revenue. The code itself keeps working in the app, since codes work offline.',
    'conf.void.ok': 'Void licence', 'conf.active.title': 'Make this licence active again?',
    'conf.active.body': 'It counts again in licences and in revenue.', 'conf.active.ok': 'Make active',

    'reset.title': 'PIN reset code',
    'reset.lead': 'When a clinic’s admin forgets the PIN, they press “Forgot your PIN?” on the sign-in screen and send you the device number. The code works once, on that device, today and tomorrow (UTC).',
    'reset.submit': 'Create reset code', 'reset.submitting': 'Creating…', 'reset.made': 'Reset code ready',
    'reset.code': 'Reset code', 'reset.validity': 'Valid {from} to {to}, once', 'reset.recent': 'Recent codes',
    'reset.none': 'No reset codes yet.', 'reset.valid': 'Valid', 'reset.expired': 'Expired', 'reset.until': 'until {date}',
    'reset.another': 'Another code', 'reset.toast': 'Reset code ready for device {device}', 'reset.copyCode': 'Copy the code for {device}',

    'ver.title': 'Verify a code',
    'ver.lead': 'Paste a code, or a whole message, to see what it is and whether it works on a device, with the same checker the app uses.',
    'ver.code': 'Code or message', 'ver.codeHint': 'The code is found inside a message automatically.', 'ver.submit': 'Verify',
    'ver.checking': 'Checking…', 'ver.placeholder': 'The result appears here', 'ver.placeholderBody': 'Enter the device number and the code, then press Verify.',
    'ver.okAct': 'Valid activation code', 'ver.okReset': 'Valid PIN reset code', 'ver.bad': 'This code does not work on this device',
    'ver.kind': 'Type', 'ver.kindAct': 'Activation', 'ver.kindReset': 'PIN reset', 'ver.kindNone': 'Unknown',
    'ver.lastDay': 'Last day', 'ver.device': 'Device',
    'ver.r.format': 'Not a complete Dentora code: a character is missing or mistyped.',
    'ver.r.device': 'The code was made for another device, or the device number is mistyped.', 'ver.r.kind': 'The type of code does not match.',
    'ver.r.expired': 'The code expired on {date}.', 'ver.r.expiredReset': 'This reset code has expired.',

    'set.title': 'Settings', 'set.lead': 'What the website and its buy buttons show. Changes reach the website within 30 seconds.',
    'set.pricing': 'Pricing', 'set.contact': 'Contact', 'set.downloads': 'Downloads', 'set.announce': 'Announcement bar',
    's.priceUsd': 'Price in US dollars', 's.priceUsdHint': 'The default amount when you issue a licence, and the price search engines see.',
    's.priceTextAr': 'Price line (Arabic)', 's.priceTextArHint': 'Shown on the pricing card of the Arabic page.',
    's.priceTextEn': 'Price line (English)', 's.priceTextEnHint': 'Shown on the pricing card of the English page.',
    's.whatsapp': 'WhatsApp number', 's.whatsappHint': 'International format, like +963 996 489 504. Every WhatsApp button on the site uses it.',
    's.email': 'Contact e-mail', 's.emailHint': 'Optional: shown in the footer and on the privacy and terms pages. Leave it empty to hide it.',
    's.windowsUrl': 'Windows download link', 's.windowsUrlHint': 'An https link to the installer. Left empty, the button asks you for the Windows version on WhatsApp.',
    's.announcementAr': 'Announcement (Arabic)', 's.announcementArHint': 'A line at the top of the Arabic page. Leave it empty for no bar.',
    's.announcementEn': 'Announcement (English)', 's.announcementEnHint': 'A line at the top of the English page. Leave it empty for no bar.',
    'se.priceUsd': 'Enter a price from 0 to 100000.', 'se.whatsapp': 'Enter 8 to 15 digits, optionally starting with +.',
    'se.email': 'Enter a valid e-mail address, or leave it empty.', 'se.windowsUrl': 'Enter a link starting with https://, or leave it empty.',
    'se.text': 'Too long (300 characters at most).',
    'set.saved': 'Settings saved. The website shows them within 30 seconds.', 'set.unsaved': 'Unsaved changes',
    'set.clean': 'All changes saved', 'set.noChanges': 'Nothing to save.', 'set.fix': 'Fix the highlighted field, then save.',
    'set.system': 'System', 'set.signing': 'Code signing', 'set.signingOk': 'Ready: the private key is set and matches the app.',
    'set.password': 'Panel password',
    'set.passwordBody': 'Change it with the command below; changing it signs every open session out. A session lasts 12 hours.',
    'set.site': 'Website', 'set.siteBody': 'Open both pages after saving to see your changes.', 'set.siteAr': 'Arabic page', 'set.siteEn': 'English page',

    'act.title': 'Activity log', 'act.lead': 'Every sign-in, code and change is logged here (latest 200 events).', 'act.filter': 'Show',
    'act.f.all': 'All events', 'act.f.auth': 'Sign-ins', 'act.f.licence': 'Licences', 'act.f.reset': 'PIN resets',
    'act.f.settings': 'Settings', 'act.empty': 'Nothing here yet.', 'act.today': 'Today', 'act.yesterday': 'Yesterday', 'act.count': 'Events: {n}',
    'a.login.ok': 'Signed in', 'a.login.fail': 'Failed sign-in', 'a.logout': 'Signed out', 'a.licence.create': 'Licence issued',
    'a.licence.update': 'Licence changed', 'a.licences.csv': 'Licences exported (CSV)', 'a.reset.create': 'PIN reset code made',
    'a.settings.update': 'Settings changed', 'a.rows': '{n} rows', 'a.ip': 'IP {ip}',
  },
}

// ---- state ---------------------------------------------------------------------------------------------------------
const state = {
  lang: 'ar',
  authed: false,
  /** GET /api/me: { signing, signingError } */
  me: null,
  /** GET /api/settings, for the default price of a new licence */
  settings: null,
  view: null,
  /** Render generation: a slow answer for a page already left is dropped. */
  seq: 0,
  booted: false,
  lockUntil: 0,
  msgLang: 'ar',
  /** Half-typed forms survive leaving the page and switching the language (until sign-out). */
  drafts: {},
  /** The last result of a form, shown again only when the language is switched. */
  results: {},
  lic: { q: '', status: '', offset: 0, items: [], total: 0 },
  actFilter: 'all',
  /** Whether the open licence panel added a history entry (closing it then goes back instead of replacing). */
  sheetPushed: false,
}

function t(key, vars) {
  let s = T[state.lang][key] ?? T.en[key] ?? key
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
  return s
}

// ---- formatting (Latin digits and the Gregorian calendar in both languages, as the app writes them) ---------------
const fmtCache = new Map()
function cached(key, make) {
  let f = fmtCache.get(key)
  if (!f) { f = make(); fmtCache.set(key, f) }
  return f
}
const numLocale = () => (state.lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-US')
const dateLocale = () => (state.lang === 'ar' ? 'ar-SY-u-ca-gregory-nu-latn' : 'en-GB')
const numFmt = d => cached(`n${state.lang}${d}`, () => new Intl.NumberFormat(numLocale(), { minimumFractionDigits: d, maximumFractionDigits: d }))
const dtf = opts => cached(`d${state.lang}${JSON.stringify(opts)}`, () => new Intl.DateTimeFormat(dateLocale(), opts))
const fmtNum = n => numFmt(0).format(Number(n) || 0)
/** "59 $" in Arabic, "$59" in English, as the app writes money. */
function fmtMoney(n) {
  const v = Number(n) || 0
  const body = numFmt(Number.isInteger(v) ? 0 : 2).format(v)
  return state.lang === 'ar' ? `${body} $` : `$${body}`
}
/** A code's calendar day "YYYY-MM-DD": a UTC day, as the codes store them, so it is formatted in UTC. */
function fmtDay(day) {
  const [y, m, d] = String(day).split('-').map(Number)
  return dtf({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}
const fmtDate = iso => dtf({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
const fmtTime = iso => dtf({ hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
const fmtDateTime = iso => `${fmtDate(iso)} · ${fmtTime(iso)}`
function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (s < 45) return t('justNow')
  const rtf = cached(`r${state.lang}`, () => new Intl.RelativeTimeFormat(numLocale(), { numeric: 'auto' }))
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), 'minute')
  if (s < 86_400) return rtf.format(-Math.round(s / 3600), 'hour')
  if (s < 7 * 86_400) return rtf.format(-Math.round(s / 86_400), 'day')
  return fmtDate(iso)
}
const todayUtc = () => new Date().toISOString().slice(0, 10)
/** Today plus whole years (UTC), the day the server gives a "1y"/"2y" code. */
function plusYears(n) {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10)
}
const localDay = iso => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// ---- input helpers -------------------------------------------------------------------------------------------------
/** Arabic-Indic and Persian digits as Latin: phones type either. */
const latinDigits = s => String(s || '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
const cleanDevice = s => latinDigits(s).toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8)
function formatDevice(s) {
  const c = cleanDevice(s)
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}
/** The message key of what is wrong with a device number, or null. */
function deviceProblem(v) {
  const c = cleanDevice(v)
  if (c.length < 8) return 'e.device'
  return DEVICE_RE.test(c) ? null : 'e.deviceChars'
}
/** "59", "59.5", "٥٩", "1,000" → a number; null when it is not an amount the API takes. */
function parseAmount(v) {
  const s = latinDigits(v).replace(/٫/g, '.').replace(/[,\s٬]/g, '').trim()
  if (!s || !/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return n >= 0 && n <= SITE_PRICE_MAX ? n : null
}
/** Keeps the device field as XXXX-XXXX while typing or pasting, with the caret where it belongs. */
function bindDevice(input) {
  input.addEventListener('input', () => {
    const raw = input.value
    const caret = input.selectionStart ?? raw.length
    const before = cleanDevice(raw.slice(0, caret)).length
    const next = formatDevice(raw)
    if (next === raw) return
    input.value = next
    let pos = 0
    for (let seen = 0; pos < next.length && seen < before; pos++) if (next[pos] !== '-') seen++
    try { input.setSelectionRange(pos, pos) } catch { /* not focused */ }
  })
}

// ---- DOM helpers ---------------------------------------------------------------------------------------------------
const app = document.getElementById('app')
const toastsEl = document.getElementById('toasts')
let uid = 0
const nextId = p => `${p}${++uid}`

/** h('button', { class, text, on: { click }, ...attributes }, ...children): children are nodes or plain text. */
function h(tag, props, ...kids) {
  const el = document.createElement(tag)
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue
      if (k === 'class') el.className = v
      else if (k === 'text') el.textContent = v
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn)
      else if (k === 'value') el.value = v
      else if (k === 'checked') el.checked = true
      else el.setAttribute(k, v === true ? '' : String(v))
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue
    el.append(kid instanceof Node ? kid : String(kid))
  }
  return el
}
const SVG_NS = 'http://www.w3.org/2000/svg'
function icon(name, cls) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', cls ? `ic ${cls}` : 'ic')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const use = document.createElementNS(SVG_NS, 'use')
  use.setAttribute('href', `#i-${name}`)
  svg.append(use)
  return svg
}
const rtl = () => state.lang === 'ar'
const spinner = () => h('span', { class: 'spinner', 'aria-hidden': 'true' })

function setBusy(btn, busy, text) {
  if (busy) {
    btn._kids = [...btn.childNodes]
    btn.replaceChildren(spinner(), h('span', { text }))
    btn.disabled = true
    btn.setAttribute('aria-busy', 'true')
  } else if (btn._kids) {
    btn.replaceChildren(...btn._kids)
    btn._kids = null
    btn.disabled = false
    btn.removeAttribute('aria-busy')
  }
}

// ---- API -----------------------------------------------------------------------------------------------------------
class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || 'http')
    this.status = status
    this.code = body?.error || (status >= 500 ? 'server' : 'http')
    this.field = body?.field
    this.retryAfter = Number(body?.retryAfter) || 0
    this.handled = false
  }
}
/** Every request: the session cookie (same origin), JSON, and X-Dentora: 1 on writes (the API's CSRF rule). */
async function api(method, path, body) {
  const headers = { Accept: 'application/json' }
  if (method !== 'GET') headers['X-Dentora'] = '1'
  const init = { method, headers, credentials: 'same-origin', cache: 'no-store' }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  let res
  try { res = await fetch(path, init) } catch { throw new ApiError(0, { error: 'network' }) }
  let data = null
  try { data = await res.json() } catch { /* an empty or non-JSON answer */ }
  if (res.ok) return data
  const err = new ApiError(res.status, data)
  // Signed out (expired, or the password changed): back to the sign-in screen, whatever was being done.
  if (res.status === 401 && path !== '/api/login') { err.handled = true; sessionLost() }
  throw err
}
function errorText(err) {
  switch (err?.code) {
    case 'network': return t('err.network')
    case 'server': return t('err.server')
    case 'origin': return t('err.origin')
    case 'signing': return t('err.signing')
    case 'not_found': return t('err.notFound')
  }
  return err?.status >= 500 ? t('err.server') : t('err.generic')
}
function fail(err) {
  if (!err?.handled) toast(errorText(err), 'error')
}
const ensureSettings = () => (state.settings ? Promise.resolve(state.settings) : api('GET', '/api/settings').then(s => (state.settings = s)))
function refreshMe() {
  return api('GET', '/api/me').then(me => { state.me = me; renderBanner() }, () => {})
}

// ---- toasts and dialogs ----------------------------------------------------------------------------------------------
/** A modal dialog makes the rest of the page inert and draws above it, so toasts move into the topmost open one. */
function toast(text, kind = 'ok') {
  const host = [...document.querySelectorAll('dialog[open]')].pop() || document.body
  if (toastsEl.parentNode !== host) host.append(toastsEl)
  const el = h('div', { class: `toast toast--${kind}`, role: kind === 'error' ? 'alert' : null },
    icon(kind === 'error' ? 'circle-x' : kind === 'info' ? 'info' : 'circle-check'),
    h('p', { text }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('close'), on: { click: () => el.remove() } }, icon('x')))
  toastsEl.append(el)
  while (toastsEl.children.length > 3) toastsEl.firstElementChild.remove()
  setTimeout(() => el.remove(), kind === 'error' ? 7000 : 3600)
}

function makeDialog(cls) {
  const dlg = h('dialog', { class: cls })
  dlg.addEventListener('close', () => {
    if (dlg.contains(toastsEl)) document.body.append(toastsEl)
    setTimeout(() => dlg.remove(), 0)
  })
  // A click on the backdrop (outside the box) closes it, like Escape.
  dlg.addEventListener('click', e => {
    if (e.target !== dlg) return
    const r = dlg.getBoundingClientRect()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close()
  })
  document.body.append(dlg)
  return dlg
}
function closeAllDialogs() {
  sheet = null
  for (const d of document.querySelectorAll('dialog[open]')) d.close()
}

/** Resolves true when confirmed; Escape, the backdrop and Cancel resolve false. Cancel has the focus. */
function confirmDialog({ title, body, confirm, tone = 'warn' }) {
  return new Promise(resolve => {
    const dlg = makeDialog('confirm')
    const titleId = nextId('cf'), bodyId = nextId('cf')
    dlg.setAttribute('aria-labelledby', titleId)
    dlg.setAttribute('aria-describedby', bodyId)
    const cancel = h('button', { type: 'button', class: 'btn btn-outline', on: { click: () => dlg.close('cancel') } }, t('cancel'))
    const ok = h('button', {
      type: 'button', class: `btn ${tone === 'bad' ? 'btn-danger' : tone === 'warn' ? 'btn-warn' : 'btn-primary'}`,
      on: { click: () => dlg.close('ok') },
    }, confirm)
    const ico = tone === 'bad' ? 'ban' : tone === 'warn' ? 'triangle-alert' : 'circle-check'
    dlg.append(
      h('h2', { id: titleId }, h('span', { class: `confirm-ico confirm-ico--${tone}` }, icon(ico)), h('span', { text: title })),
      h('p', { id: bodyId, text: body }),
      h('div', { class: 'form-actions' }, cancel, ok))
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'))
    dlg.showModal()
    cancel.focus()
  })
}

// ---- small building blocks -------------------------------------------------------------------------------------------
function pageHead(title, lead, actions) {
  return h('header', { class: 'page-head' },
    h('div', null, h('h1', { text: t(title) }), lead ? h('p', { class: 'lead', text: t(lead) }) : null),
    actions?.length ? h('div', { class: 'page-actions' }, actions) : null)
}
function card(titleKey, ico, link, ...body) {
  const id = nextId('ch')
  return h('section', { class: 'card', 'aria-labelledby': id },
    h('div', { class: 'card-head' }, h('h2', { id }, icon(ico), t(titleKey)), link),
    ...body)
}
function cardLink(href, key) {
  return h('a', { href }, t(key), icon('chevron-right', 'flip-rtl'))
}
function emptyState({ ico = 'inbox', title, body, action, tone, small }) {
  return h('div', { class: `empty${small ? ' empty--sm' : ''}` },
    h('span', { class: `empty-ico${tone === 'bad' ? ' empty-ico--bad' : ''}` }, icon(ico)),
    title ? h('h3', { text: title }) : null,
    body ? h('p', { text: body }) : null,
    action)
}
function errorState(err, retry) {
  return emptyState({
    ico: 'triangle-alert', tone: 'bad', title: t('err.load'), body: errorText(err),
    action: h('button', { type: 'button', class: 'btn btn-outline btn-sm', on: { click: retry } }, icon('refresh-cw'), t('retry')),
  })
}
function skeletonRows(n) {
  return Array.from({ length: n }, () => h('div', { class: 'skel-row', 'aria-hidden': 'true' },
    h('span', { class: 'skel skel--md' }), h('span', { class: 'skel skel--sm' })))
}
const planBadge = plan => h('span', { class: `badge badge--${plan === 'pro' ? 'pro' : 'standard'}`, text: t(`plan.${plan}`) })
const statusBadge = st => h('span', { class: `badge badge--dot badge--${st}`, text: t(`st.${st}`) })
function validityText(until) {
  if (!until) return t('val.lifetime')
  return until < todayUtc() ? t('lic.ended', { date: fmtDay(until) }) : t('lic.until', { date: fmtDay(until) })
}
const licName = l => l.clinic || l.customer
/** The phone as typed, kept left-to-right inside Arabic text (a leading + would otherwise jump to the end). */
const ltrText = (text, cls) => h('bdi', { dir: 'ltr', class: cls, text })

/** A labelled input with its hint and an error line that screen readers read with it. */
function field({ label, hint, input, control, optional }) {
  const id = input.id || (input.id = nextId('f'))
  const hintEl = hint ? h('p', { class: 'hint', id: `${id}-hint`, text: hint }) : null
  const err = h('p', { class: 'err', id: `${id}-err`, hidden: true })
  input.setAttribute('aria-describedby', [hintEl && hintEl.id, err.id].filter(Boolean).join(' '))
  const wrap = h('div', { class: 'field' },
    h('label', { for: id }, label, optional ? h('span', { class: 'opt', text: ` (${t('f.optional')})` }) : null),
    control || input, hintEl, err)
  const setError = msg => {
    err.hidden = !msg
    err.replaceChildren(...(msg ? [icon('circle-x'), h('span', { text: msg })] : []))
    if (msg) input.setAttribute('aria-invalid', 'true')
    else input.removeAttribute('aria-invalid')
  }
  input.addEventListener('input', () => setError(null))
  return { wrap, input, setError }
}
/** Radio buttons drawn as a segmented control (arrow keys move between them, as with any radio group). */
function segField({ legend, options, value, cls = '', onChange, hideLegend, disabled }) {
  const name = nextId('seg')
  const seg = h('div', { class: `seg ${cls}` })
  for (const [val, labelText] of options) {
    const id = nextId('o')
    seg.append(
      h('input', { type: 'radio', name, id, value: val, checked: val === value, disabled, on: { change: () => onChange?.(val) } }),
      h('label', { for: id, text: labelText }))
  }
  const err = h('p', { class: 'err', hidden: true })
  const wrap = h('fieldset', { class: 'field' }, h('legend', { class: hideLegend ? 'sr-only' : null, text: legend }), seg, err)
  return {
    wrap, seg,
    get value() { return seg.querySelector('input:checked')?.value },
    set value(v) { for (const r of seg.querySelectorAll('input')) r.checked = r.value === v },
    setError(msg) { err.hidden = !msg; err.replaceChildren(...(msg ? [icon('circle-x'), h('span', { text: msg })] : [])) },
  }
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older Android WebViews without the async clipboard: a selected textarea and execCommand.
    const ta = h('textarea', { class: 'sr-only', readonly: true, 'aria-hidden': 'true' })
    ta.value = text
    ;([...document.querySelectorAll('dialog[open]')].pop() || document.body).append(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { /* unsupported */ }
    ta.remove()
    return ok
  }
}
function copyButton(getText, labelText) {
  const label = h('span', { text: labelText })
  const ico = icon('copy')
  const btn = h('button', { type: 'button', class: 'chip-btn' }, ico, label)
  let timer = 0
  btn.addEventListener('click', async () => {
    if (!(await copyText(getText()))) { toast(t('copyFailed'), 'error'); return }
    toast(t('copied'))
    clearTimeout(timer)
    btn.classList.add('is-done')
    btn.replaceChildren(icon('check'), h('span', { text: t('copied') }))
    timer = setTimeout(() => { btn.classList.remove('is-done'); btn.replaceChildren(ico, label) }, 1800)
  })
  return btn
}
/** The 112-character code in its groups of four (a group never splits across lines); copies with its dashes. */
function codeBox(code, small) {
  const groups = String(code).split('-')
  return h('div', { class: `codebox${small ? ' codebox--sm' : ''}`, translate: 'no' },
    groups.map((g, i) => h('span', { text: i < groups.length - 1 ? `${g}-` : g })))
}
function codeBlock(code, labelKey) {
  return h('div', null,
    h('div', { class: 'block-label' }, h('span', { text: t(labelKey) }), copyButton(() => code, t('code.copy'))),
    codeBox(code))
}
/** wa.me with the message in the chosen language: to the customer's number, or (no number) letting WhatsApp ask for the chat. */
function waHref(message, lang) {
  const text = encodeURIComponent(message[lang])
  if (message.whatsappUrl) {
    try {
      // Only an https link becomes the button's address, whatever the API answered.
      const u = new URL(message.whatsappUrl)
      if (u.protocol === 'https:') return `${u.origin}${u.pathname}?text=${text}`
    } catch { /* malformed: fall back to letting WhatsApp ask for the chat */ }
  }
  return `https://wa.me/?text=${text}`
}
/** The ready-to-send message: language switch, preview bubble, copy, and the big WhatsApp button. */
function messageBlock(message, { resend } = {}) {
  let lang = state.msgLang
  const bubble = h('div', { class: 'bubble' })
  const wa = h('a', { class: 'btn btn-wa btn-lg btn-block', target: '_blank', rel: 'noopener noreferrer' },
    icon('message-circle'), t(resend ? 'wa.resend' : 'wa.send'))
  const update = () => {
    bubble.textContent = message[lang]
    bubble.dir = lang === 'ar' ? 'rtl' : 'ltr'
    bubble.lang = lang
    wa.href = waHref(message, lang)
  }
  const seg = segField({
    legend: t('msg.lang'), hideLegend: true, cls: 'seg--sm', value: lang,
    options: [['ar', 'العربية'], ['en', 'English']],
    onChange: v => { lang = v; state.msgLang = v; update() },
  })
  update()
  return h('div', { class: 'stack' },
    h('div', null,
      h('div', { class: 'block-label' }, h('span', { text: t('msg.label') }), seg.wrap),
      bubble,
      h('div', { class: 'msg-actions' }, copyButton(() => message[lang], t('msg.copy')))),
    wa,
    message.whatsappUrl ? null : h('p', { class: 'hint', text: t('wa.noPhone') }))
}

// ---- session hint ------------------------------------------------------------------------------------------------
/** 'yes' / 'no' from the stored expiry; 'unknown' when storage is blocked (then the server is asked). */
function sessionHint() {
  try {
    const until = Number(localStorage.getItem(SESSION_KEY))
    return until > Date.now() ? 'yes' : 'no'
  } catch { return 'unknown' }
}
function setSessionHint(on) {
  try {
    if (on) localStorage.setItem(SESSION_KEY, String(Date.now() + SESSION_MS))
    else localStorage.removeItem(SESSION_KEY)
  } catch { /* storage blocked */ }
}

// ---- language ------------------------------------------------------------------------------------------------------
function loadLang() {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'ar' || v === 'en') return v
  } catch { /* storage blocked */ }
  return 'ar'
}
function applyLang() {
  const root = document.documentElement
  root.lang = state.lang
  root.dir = rtl() ? 'rtl' : 'ltr'
  const skip = document.getElementById('skip')
  if (skip) skip.textContent = t('skip')
}
function langButton(extraCls = '') {
  const other = rtl() ? 'en' : 'ar'
  return h('button', { type: 'button', class: `lang-btn ${extraCls}`, 'aria-label': t('lang.aria'), on: { click: () => setLang(other) } },
    icon('languages'), h('span', { lang: other, text: t('lang.other') }))
}
function setLang(lang) {
  state.lang = lang
  try { localStorage.setItem(LANG_KEY, lang) } catch { /* storage blocked: this visit only */ }
  applyLang()
  if (!state.authed) { if (offlineErr) renderOffline(offlineErr); else renderLogin(); return }
  const openId = sheet?.id
  closeMenu()
  if (sheet) { const s = sheet; sheet = null; s.dlg.close() }
  renderShell()
  renderView({ keep: true })
  if (openId) openLicence(openId)
}

// ---- sign-in -------------------------------------------------------------------------------------------------------
let lockTimer = 0
/** The first load could not reach the server (the screen then offers a retry, in either language). */
let offlineErr = null
function renderLogin({ notice, noticeKind = 'info' } = {}) {
  clearInterval(lockTimer)
  offlineErr = null
  document.title = t('app.title')
  const pw = h('input', {
    class: 'input', id: 'login-pw', type: 'password', name: 'password', autocomplete: 'current-password',
    dir: 'ltr', required: true, spellcheck: 'false', autocapitalize: 'off',
  })
  const eye = h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('login.show'), 'aria-pressed': 'false' }, icon('eye'))
  eye.addEventListener('click', () => {
    const show = pw.type === 'password'
    pw.type = show ? 'text' : 'password'
    eye.setAttribute('aria-pressed', String(show))
    eye.setAttribute('aria-label', t(show ? 'login.hide' : 'login.show'))
    eye.replaceChildren(icon(show ? 'eye-off' : 'eye'))
    pw.focus()
  })
  const pwField = field({ label: t('login.password'), input: pw, control: h('div', { class: 'pw-wrap' }, pw, eye) })
  const msg = h('div', { class: 'login-msg', 'aria-live': 'assertive' })
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-lg btn-block' }, icon('log-in', 'flip-rtl'), t('login.submit'))
  const form = h('form', { class: 'login-form', novalidate: true },
    // For password managers: they file the password under a user name, and the panel has only one.
    h('input', { type: 'text', name: 'username', autocomplete: 'username', value: 'dentora-admin', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true', readonly: true }),
    pwField.wrap, msg, submit)
  const cardEl = h('div', { class: 'login-card' },
    h('img', { class: 'login-logo', src: '/admin/logo.svg', width: 60, height: 60, alt: '' }),
    h('h1', { text: t('app.title') }),
    h('p', { class: 'lead', text: t('login.lead') }),
    form,
    h('p', { class: 'login-foot' }, icon('lock'), t('login.foot')))
  const showError = text => msg.replaceChildren(h('p', { class: 'err' }, icon('circle-x'), h('span', { text })))
  if (notice) {
    msg.replaceChildren(h('div', { class: `callout callout--${noticeKind}` }, icon(noticeKind === 'ok' ? 'circle-check' : 'info'), h('p', { text: t(notice) })))
  }

  const startLock = () => {
    clearInterval(lockTimer)
    const time = h('span', { class: 'lock-time', 'aria-live': 'off' })
    msg.replaceChildren(h('div', { class: 'callout callout--warn' }, icon('clock-3'),
      h('div', null, h('strong', { text: t('login.locked') }), h('p', null, t('login.lockedWait')), time)))
    const tick = () => {
      const left = Math.ceil((state.lockUntil - Date.now()) / 1000)
      if (left > 0) { submit.disabled = true; time.textContent = mmss(left); return }
      clearInterval(lockTimer)
      state.lockUntil = 0
      submit.disabled = false
      msg.replaceChildren(h('div', { class: 'callout callout--ok' }, icon('circle-check'), h('p', { text: t('login.unlocked') })))
    }
    tick()
    lockTimer = setInterval(tick, 1000)
  }
  const showSetup = () => {
    const back = h('button', { type: 'button', class: 'btn btn-outline btn-block' }, icon('refresh-cw'), t('retry'))
    const box = h('div', { class: 'setup' },
      h('div', { class: 'callout callout--warn' }, icon('triangle-alert'), h('div', null,
        h('strong', { text: t('setup.title') }),
        h('p', { text: t('setup.body') }))),
      h('code', { class: 'cmd', text: 'cd dental/server\nnpx wrangler secret put ADMIN_PASSWORD' }),
      h('p', { class: 'hint', text: t('setup.after') }),
      back)
    back.addEventListener('click', () => { box.replaceWith(form); pw.focus() })
    form.replaceWith(box)
    back.focus()
  }

  form.addEventListener('submit', async e => {
    e.preventDefault()
    if (submit.disabled) return
    if (!pw.value) { showError(t('login.empty')); pw.setAttribute('aria-invalid', 'true'); pw.focus(); return }
    msg.replaceChildren()
    setBusy(submit, true, t('login.checking'))
    try {
      await api('POST', '/api/login', { password: pw.value })
      setSessionHint(true)
      pw.value = ''
      await startSession()
    } catch (err) {
      setBusy(submit, false)
      if (err.code === 'password') {
        showError(t('login.wrong'))
        pw.setAttribute('aria-invalid', 'true')
        pw.select()
        cardEl.classList.remove('shake')
        void cardEl.offsetWidth
        cardEl.classList.add('shake')
      } else if (err.code === 'locked') {
        state.lockUntil = Date.now() + Math.max(1, err.retryAfter) * 1000
        startLock()
      } else if (err.code === 'setup') showSetup()
      else showError(errorText(err))
    }
  })
  pw.addEventListener('input', () => { pw.removeAttribute('aria-invalid'); if (msg.querySelector('.err')) msg.replaceChildren() })

  app.replaceChildren(h('main', { class: 'login', id: 'main', tabindex: '-1' }, h('div', { class: 'login-lang' }, langButton()), cardEl))
  if (state.lockUntil > Date.now()) startLock()
  // On a phone the keyboard would cover the page before the seller has seen it; on a desktop, type at once.
  if (matchMedia('(pointer: fine)').matches) pw.focus()
}
/** The server cannot be reached on the first load: a retry, not a sign-in form that would fail too. */
function renderOffline(err) {
  offlineErr = err
  document.title = t('app.title')
  const retry = h('button', { type: 'button', class: 'btn btn-primary btn-block' }, icon('refresh-cw'), t('retry'))
  retry.addEventListener('click', () => { setBusy(retry, true, t('loading')); boot() })
  app.replaceChildren(h('main', { class: 'login', id: 'main' }, h('div', { class: 'login-lang' }, langButton()),
    h('div', { class: 'login-card' },
      h('img', { class: 'login-logo', src: '/admin/logo.svg', width: 60, height: 60, alt: '' }),
      h('h1', { text: t('offline.title') }),
      h('p', { class: 'lead', text: errorText(err) }),
      h('div', { class: 'login-form' }, retry))))
}

async function startSession() {
  const me = await api('GET', '/api/me')
  state.me = me
  state.authed = true
  state.view = null
  state.booted = false
  renderShell()
  route()
  ensureSettings().catch(() => {})
}
function sessionLost() {
  if (!state.authed) return
  forgetSession()
  renderLogin({ notice: 'login.expired' })
}
/** Sign-out clears everything typed about customers from memory. */
function forgetSession() {
  setSessionHint(false)
  state.authed = false
  state.me = null
  state.settings = null
  state.view = null
  state.drafts = {}
  state.results = {}
  state.lic = { q: '', status: '', offset: 0, items: [], total: 0 }
  closeAllDialogs()
}
async function logout() {
  closeMenu()
  try { await api('POST', '/api/logout') } catch { /* the cookie is cleared or will expire; sign out here anyway */ }
  forgetSession()
  history.replaceState(null, '', location.pathname)
  renderLogin({ notice: 'login.loggedOut', noticeKind: 'ok' })
}

// ---- shell -----------------------------------------------------------------------------------------------------------
const NAV = [
  { id: 'dashboard', hash: '#/', icon: 'layout-dashboard', label: 'nav.dashboard' },
  { id: 'new', hash: '#/new', icon: 'circle-plus', label: 'nav.new' },
  { id: 'licences', hash: '#/licences', icon: 'key-round', label: 'nav.licences' },
  { id: 'reset', hash: '#/reset', icon: 'rotate-ccw-key', label: 'nav.reset' },
  { id: 'verify', hash: '#/verify', icon: 'shield-check', label: 'nav.verify' },
  { id: 'settings', hash: '#/settings', icon: 'settings', label: 'nav.settings' },
  { id: 'activity', hash: '#/activity', icon: 'history', label: 'nav.activity' },
]
const MORE_VIEWS = ['verify', 'settings', 'activity']
const sitePath = () => (rtl() ? '/' : '/en')

function renderShell() {
  const side = h('aside', { class: 'sidebar' },
    h('a', { class: 'side-brand', href: '#/' },
      h('img', { src: '/admin/logo.svg', width: 40, height: 40, alt: '' }),
      h('span', null, h('strong', { text: 'Dentora' }), h('small', { text: t('app.panel') }))),
    h('nav', { 'aria-label': t('nav.menu') }, h('ul', { class: 'side-nav' },
      NAV.map(n => h('li', null, h('a', { class: 'side-link', href: n.hash, 'data-nav': n.id }, icon(n.icon), t(n.label)))))),
    h('div', { class: 'side-foot' },
      h('a', { class: 'side-link', href: sitePath(), target: '_blank', rel: 'noopener' }, icon('globe'), t('nav.site'), icon('external-link', 'ext')),
      h('button', { type: 'button', class: 'side-link', 'aria-label': t('lang.aria'), on: { click: () => setLang(rtl() ? 'en' : 'ar') } },
        icon('languages'), h('span', { lang: rtl() ? 'en' : 'ar', text: t('lang.other') })),
      h('button', { type: 'button', class: 'side-link', on: { click: logout } }, icon('log-out', 'flip-rtl'), t('nav.logout'))))

  const top = h('header', { class: 'topbar' },
    h('a', { class: 'brand-mini', href: '#/' },
      h('img', { src: '/admin/logo.svg', width: 32, height: 32, alt: '' }),
      h('strong', { text: 'Dentora' }), h('span', { text: t('app.panel') })),
    h('div', { class: 'topbar-actions' }, langButton()))

  const tab = (id, hash, ico, label, cls = '') =>
    h('a', { class: `tab ${cls}`, href: hash, 'data-nav': id }, h('span', { class: 'tab-ico' }, icon(ico)), h('span', { class: 'tab-label', text: t(label) }))
  const tabs = h('nav', { class: 'tabbar', 'aria-label': t('nav.menu') },
    tab('dashboard', '#/', 'layout-dashboard', 'nav.dashboard'),
    tab('licences', '#/licences', 'key-round', 'nav.licences'),
    tab('new', '#/new', 'plus', 'nav.newShort', 'tab--new'),
    tab('reset', '#/reset', 'rotate-ccw-key', 'nav.resetShort'),
    h('button', { type: 'button', class: 'tab', 'data-more': '', 'aria-haspopup': 'dialog', on: { click: openMenu } },
      h('span', { class: 'tab-ico' }, icon('ellipsis')), h('span', { class: 'tab-label', text: t('nav.more') })))

  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' }, h('div', { id: 'banner' }), h('div', { id: 'view' }))
  app.replaceChildren(h('div', { class: 'shell' }, side, top, main, tabs))
  renderBanner()
  markCurrent()
}
function markCurrent() {
  for (const a of document.querySelectorAll('[data-nav]')) {
    if (a.dataset.nav === state.view) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
  }
  const more = document.querySelector('[data-more]')
  if (more) more.toggleAttribute('data-current', MORE_VIEWS.includes(state.view))
}
function renderBanner() {
  const box = document.getElementById('banner')
  if (!box) return
  box.replaceChildren()
  const me = state.me
  if (!me || me.signing) return
  const reason = ['missing', 'format', 'mismatch'].includes(me.signingError) ? me.signingError : 'missing'
  box.append(h('section', { class: 'callout callout--warn banner', 'aria-label': t('sign.title') }, icon('triangle-alert'),
    h('div', null,
      h('strong', { text: t('sign.title') }),
      h('p', { text: t(`sign.${reason}`) }),
      h('code', { class: 'cmd', text: 'cd dental/server\nnpx wrangler secret put LICENSE_PRIVATE_JWK' }),
      h('p', { text: t('sign.after') }))))
}

let menu = null
function openMenu() {
  if (menu) return
  const dlg = makeDialog('menu-sheet')
  const titleId = nextId('m')
  dlg.setAttribute('aria-labelledby', titleId)
  const item = (href, ico, label, extra = {}) => h('li', null, h('a', { class: 'menu-item', href, ...extra, on: { click: () => dlg.close() } },
    h('span', { class: 'kpi-ico' }, icon(ico)), h('span', { text: label }), extra.target ? icon('external-link', 'ext') : null))
  const other = rtl() ? 'en' : 'ar'
  const list = h('ul', { class: 'menu-list' },
    NAV.filter(n => MORE_VIEWS.includes(n.id)).map(n => {
      const li = item(n.hash, n.icon, t(n.label))
      if (n.id === state.view) li.firstChild.setAttribute('aria-current', 'page')
      return li
    }),
    h('li', { class: 'menu-sep', role: 'separator' }),
    item(sitePath(), 'globe', t('nav.site'), { target: '_blank', rel: 'noopener' }),
    h('li', null, h('button', { type: 'button', class: 'menu-item', 'aria-label': t('lang.aria'), on: { click: () => { closeMenu(); setLang(other) } } },
      h('span', { class: 'kpi-ico' }, icon('languages')), h('span', { lang: other, text: t('lang.other') }))),
    h('li', { class: 'menu-sep', role: 'separator' }),
    h('li', null, h('button', { type: 'button', class: 'menu-item menu-item--bad', on: { click: logout } },
      h('span', { class: 'kpi-ico' }, icon('log-out', 'flip-rtl')), h('span', { text: t('nav.logout') }))))
  dlg.append(h('h2', { id: titleId, text: t('nav.moreTitle') }), list)
  dlg.addEventListener('close', () => { if (menu === dlg) menu = null })
  menu = dlg
  dlg.showModal()
  dlg.querySelector('.menu-item')?.focus()
}
function closeMenu() {
  if (menu) { const m = menu; menu = null; m.close() }
}

// ---- router ----------------------------------------------------------------------------------------------------------
const VIEWS = {
  dashboard: { title: 'dash.title', render: viewDashboard },
  new: { title: 'new.title', render: viewNew },
  licences: { title: 'lic.title', render: viewLicences },
  reset: { title: 'reset.title', render: viewReset },
  verify: { title: 'ver.title', render: viewVerify },
  settings: { title: 'set.title', render: viewSettings },
  activity: { title: 'act.title', render: viewActivity },
}
const ROUTES = { '': 'dashboard', new: 'new', licences: 'licences', reset: 'reset', verify: 'verify', settings: 'settings', activity: 'activity' }
function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('?')[0].split('/')
  const view = ROUTES[parts[0]] ?? 'dashboard'
  let id = null
  if (view === 'licences' && parts[1]) { try { id = decodeURIComponent(parts[1]) } catch { id = null } }
  return { view, id }
}
function route() {
  if (!state.authed) return
  const { view, id } = parseHash()
  closeMenu()
  if (view !== state.view) {
    state.view = view
    renderView({ focus: state.booted })
  }
  markCurrent()
  if (id) {
    // Arriving through a link inside the panel added a history entry; a link opened directly did not.
    if (!sheet) state.sheetPushed = state.booted
    openLicence(id)
  } else if (sheet) closeSheet()
  state.booted = true
}
function renderView({ keep = false, focus = false } = {}) {
  const root = document.getElementById('view')
  if (!root) return
  const seq = ++state.seq
  const ctx = { root, keep, alive: () => seq === state.seq && state.authed }
  root.replaceChildren()
  document.title = `${t(VIEWS[state.view].title)} · Dentora`
  Promise.resolve()
    .then(() => VIEWS[state.view].render(ctx))
    .catch(err => {
      if (!ctx.alive() || err?.handled) return
      console.warn('view failed:', err)
      const slot = root.querySelector('[data-slot]') || root
      slot.replaceChildren(h('div', { class: 'card' }, errorState(err, () => renderView())))
    })
  if (focus) {
    window.scrollTo(0, 0)
    // The new page's title, so a screen reader announces where the seller is (it is drawn synchronously below).
    queueMicrotask(() => {
      const h1 = root.querySelector('h1')
      if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }) }
    })
  }
}

// ---- dashboard -------------------------------------------------------------------------------------------------------
const ACTIONS = {
  'login.ok': { icon: 'log-in', tone: 'ok', group: 'auth' },
  'login.fail': { icon: 'shield-alert', tone: 'bad', group: 'auth' },
  logout: { icon: 'log-out', tone: '', group: 'auth' },
  'licence.create': { icon: 'key-round', tone: 'ok', group: 'licence' },
  'licence.update': { icon: 'pencil', tone: '', group: 'licence' },
  'licences.csv': { icon: 'file-spreadsheet', tone: '', group: 'licence' },
  'reset.create': { icon: 'rotate-ccw-key', tone: 'warn', group: 'reset' },
  'settings.update': { icon: 'sliders-horizontal', tone: '', group: 'settings' },
}
const FIELD_LABEL = { customer: 'f.customer', clinic: 'f.clinic', phone: 'f.phone', note: 'f.note', price: 'col.price', status: 'col.status' }
/** The audit line's detail, its known words translated (the log stores them in English). */
function auditTokens(e) {
  const d = String(e.detail || '')
  if (!d) return []
  const arrow = rtl() ? ' ← ' : ' → '
  const word = tok => {
    if (tok === 'pro' || tok === 'standard') return t(`plan.${tok}`)
    if (tok === 'lifetime') return t('val.lifetime')
    if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) return t('lic.until', { date: fmtDay(tok) })
    const money = /^\$(\d+(?:\.\d+)?)$/.exec(tok)
    if (money) return fmtMoney(Number(money[1]))
    const until = /^→ (\d{4}-\d{2}-\d{2})$/.exec(tok)
    if (until) return t('reset.until', { date: fmtDay(until[1]) })
    return tok
  }
  switch (e.action) {
    case 'licences.csv': return [t('a.rows', { n: fmtNum(Number(d) || 0) })]
    case 'settings.update': return d.split(', ').map(k => (T.en[`s.${k}`] ? t(`s.${k}`) : k))
    case 'licence.update': {
      const [device, rest = ''] = d.split(' · ')
      return [device, ...rest.split(', ').filter(Boolean).map(part => {
        const m = /^(status|price): (.+) → (.+)$/.exec(part)
        if (!m) return FIELD_LABEL[part] ? t(FIELD_LABEL[part]) : part
        const v = x => (m[1] === 'status' ? (T.en[`st.${x}`] ? t(`st.${x}`) : x) : fmtMoney(Number(x)))
        return `${t(FIELD_LABEL[m[1]])}: ${v(m[2])}${arrow}${v(m[3])}`
      })]
    }
    default: return d.split(' · ').map(word)
  }
}
function feedItem(e, { withIp, clock } = {}) {
  const meta = ACTIONS[e.action] || { icon: 'info', tone: '' }
  const tokens = auditTokens(e)
  if (withIp && e.ip) tokens.push(t('a.ip', { ip: e.ip }))
  return h('li', { class: 'feed-item' },
    h('span', { class: `feed-ico${meta.tone ? ` feed-ico--${meta.tone}` : ''}` }, icon(meta.icon)),
    h('span', { class: 'feed-title', text: T.en[`a.${e.action}`] ? t(`a.${e.action}`) : e.action }),
    h('time', { class: 'feed-time', datetime: e.at, title: fmtDateTime(e.at), text: clock ? fmtTime(e.at) : timeAgo(e.at) }),
    tokens.length ? h('span', { class: 'feed-detail' }, tokens.flatMap((x, i) => (i ? [' · ', tokenEl(x)] : [tokenEl(x)]))) : null)
}
/** One detail token, isolated so a device number or an amount keeps its order inside the other language. A token of
 * only digits and symbols ("59 $") takes the page's direction, as amounts do everywhere else. */
function tokenEl(text) {
  const strong = /[A-Za-z\u0600-\u06FF]/.test(text)
  return h('bdi', { dir: strong ? 'auto' : rtl() ? 'rtl' : 'ltr', text })
}
function miniLicenceRow(l) {
  const name = licName(l)
  return h('li', null, h('a', { class: 'mini-row', href: `#/licences/${encodeURIComponent(l.id)}` },
    h('span', { class: `mini-name${name ? '' : ' muted'}`, text: name || t('lic.noName') }),
    h('span', { class: 'mini-meta' }, ltrText(l.device, 'mono'), h('span', { text: validityText(l.until) }), h('span', { text: timeAgo(l.createdAt) })),
    h('span', { class: 'mini-side' }, h('span', { class: 'num', text: fmtMoney(l.price) }), statusBadge(l.status))))
}
function kpiTile({ ico, label, value, sub, hero, wide, mark }) {
  return h('article', { class: `card kpi${hero ? ' kpi--hero' : ''}${wide ? ' kpi--wide' : ''}` },
    mark ? icon(mark, 'kpi-mark') : null,
    h('span', { class: 'kpi-label' }, h('span', { class: 'kpi-ico' }, icon(ico)), h('span', { text: label })),
    h('span', { class: 'kpi-value', text: value }),
    sub ? h('span', { class: 'kpi-sub' }, sub) : null)
}
function dlColumn(ico, name, total, last30) {
  return h('div', { class: 'dl-col' },
    h('span', { class: 'dl-name' }, icon(ico), name),
    h('span', { class: 'kpi-value', text: fmtNum(total) }),
    h('span', { class: 'kpi-sub' }, h('span', { text: `${t('dash.last30')}:` }), h('span', { class: 'pill', text: fmtNum(last30) })))
}
async function downloadCsv(e) {
  e?.preventDefault()
  // A plain link would save the API's error as the file if the session has ended; check it first.
  try { await api('GET', '/api/me') } catch (err) { fail(err); return }
  const a = h('a', { href: '/api/licences.csv', download: '' })
  document.body.append(a)
  a.click()
  a.remove()
}
function csvLink(cls = 'btn btn-outline btn-sm') {
  return h('a', { class: cls, href: '/api/licences.csv', download: '', on: { click: downloadCsv } }, icon('download'), t('lic.csv'))
}

async function viewDashboard(ctx) {
  const { root } = ctx
  root.append(pageHead('dash.title', 'dash.lead'))
  const kpis = h('section', { class: 'kpis', 'aria-label': t('dash.kpis'), 'aria-busy': 'true' },
    Array.from({ length: 4 }, (_, i) => h('div', { class: `card kpi${i === 0 || i === 3 ? ' kpi--wide' : ''}`, 'aria-hidden': 'true' },
      h('span', { class: 'skel skel--sm' }), h('span', { class: 'skel skel--lg' }))))
  const quickItem = (href, ico, label, primary, on) => h('a', { class: `quick-item${primary ? ' quick-item--primary' : ''}`, href, on },
    h('span', { class: 'kpi-ico' }, icon(ico)), h('span', { text: label }))
  const quick = h('nav', { class: 'quick', 'aria-label': t('dash.quick') },
    quickItem('#/new', 'circle-plus', t('nav.new'), true),
    quickItem('#/reset', 'rotate-ccw-key', t('nav.reset')),
    quickItem('#/verify', 'shield-check', t('nav.verify')),
    quickItem('/api/licences.csv', 'file-spreadsheet', t('lic.csv'), false, { click: downloadCsv }))
  const latest = h('div', null, skeletonRows(3))
  const activity = h('div', null, skeletonRows(3))
  root.append(h('div', { class: 'stack', 'data-slot': '' }, kpis, quick, h('div', { class: 'dash-cols' },
    card('dash.latest', 'key-round', cardLink('#/licences', 'dash.viewAll'), latest),
    card('dash.activity', 'history', cardLink('#/activity', 'dash.fullLog'), activity))))

  const [stats, recent] = await Promise.all([api('GET', '/api/stats'), api('GET', '/api/licences?limit=5')])
  if (!ctx.alive()) return
  const L = stats.licences, D = stats.downloads
  const pill = (label, value) => [h('span', { text: `${label}:` }), h('span', { class: 'pill', text: value })]
  kpis.removeAttribute('aria-busy')
  kpis.replaceChildren(
    kpiTile({ hero: true, wide: true, ico: 'wallet', mark: 'tooth', label: t('dash.revenue'), value: fmtMoney(L.revenue),
      sub: [...pill(t('dash.thisMonth'), fmtMoney(L.revenueMonth)), h('span', { text: `· ${t('dash.revenueNote')}` })] }),
    kpiTile({ ico: 'key-round', label: t('dash.licences'), value: fmtNum(L.total), sub: pill(t('dash.thisMonth'), fmtNum(L.month)) }),
    kpiTile({ ico: 'rotate-ccw-key', label: t('dash.resets'), value: fmtNum(stats.resets.total), sub: h('span', { text: t('dash.allTime') }) }),
    h('article', { class: 'card kpi kpi--wide' },
      h('span', { class: 'kpi-label' }, h('span', { class: 'kpi-ico' }, icon('download')), h('span', { text: t('dash.downloads') })),
      h('div', { class: 'dl-cols' },
        dlColumn('smartphone', t('dash.android'), D.android, D.android30),
        dlColumn('monitor', t('dash.windows'), D.windows, D.windows30))))
  latest.replaceChildren(recent.items.length
    ? h('ul', { class: 'mini-list' }, recent.items.map(miniLicenceRow))
    : emptyState({ ico: 'key-round', small: true, body: t('dash.noLicences'),
      action: h('a', { class: 'btn btn-primary btn-sm', href: '#/new' }, icon('plus'), t('nav.new')) }))
  activity.replaceChildren(stats.recent.length
    ? h('ul', { class: 'feed' }, stats.recent.map(e => feedItem(e)))
    : emptyState({ ico: 'history', small: true, body: t('dash.noActivity') }))
}

// ---- new licence -----------------------------------------------------------------------------------------------------
function tipsCard() {
  return card('tips.title', 'info', null, h('div', { class: 'card-body stack' },
    h('ol', { class: 'steps' },
      ['1', '2', '3'].map(n => h('li', null, h('span', null, h('strong', { text: t(`tips.${n}`) }), t(`tips.${n}b`))))),
    h('div', { class: 'callout callout--info' }, icon('info'), h('p', { text: t('tips.note') }))))
}
const signingBlocked = () => state.me && !state.me.signing
function blockedNote() {
  return signingBlocked() ? h('p', { class: 'err' }, icon('triangle-alert'), h('span', { text: t('sign.blocked') })) : null
}

async function viewNew(ctx) {
  const { root } = ctx
  root.append(pageHead('new.title', 'new.lead'))
  const slot = h('div', { 'data-slot': '' })
  root.append(h('div', { class: 'two-col' }, slot, tipsCard()))
  if (ctx.keep && state.results.new) showLicenceResult(slot, state.results.new, false)
  else {
    state.results.new = null
    slot.append(licenceForm(slot))
  }
}

function licenceForm(slot) {
  const d = state.drafts.new ??= { device: '', plan: 'pro', validity: 'lifetime', until: '', customer: '', clinic: '', phone: '', price: '', note: '' }
  const dev = field({
    label: t('f.device'), hint: t('f.deviceHint'),
    input: h('input', {
      class: 'input input--device', name: 'device', value: d.device, dir: 'ltr', autocomplete: 'off', autocapitalize: 'characters',
      spellcheck: 'false', placeholder: 'XXXX-XXXX', enterkeyhint: 'next', required: true,
    }),
  })
  bindDevice(dev.input)
  const plan = segField({ legend: t('f.plan'), value: d.plan, options: [['pro', t('plan.pro')], ['standard', t('plan.standard')]] })
  const preview = h('p', { class: 'validity-note', 'aria-live': 'polite' })
  const until = field({ label: t('f.until'), input: h('input', { class: 'input', type: 'date', name: 'until', value: d.until, min: todayUtc(), dir: 'ltr' }) })
  const validity = segField({
    legend: t('f.validity'), value: d.validity, cls: 'seg--4',
    options: [['lifetime', t('val.lifetime')], ['1y', t('val.1y')], ['2y', t('val.2y')], ['date', t('val.date')]],
    onChange: () => updateValidity(),
  })
  const updateValidity = () => {
    const v = validity.value
    until.wrap.hidden = v !== 'date'
    const day = v === '1y' ? plusYears(1) : v === '2y' ? plusYears(2) : v === 'date' ? until.input.value : null
    preview.replaceChildren(icon(v === 'lifetime' ? 'badge-check' : 'calendar'),
      h('span', { text: v === 'lifetime' ? t('val.previewLife') : day ? t('val.preview', { date: fmtDay(day) }) : '' }))
    preview.hidden = v === 'date' && !day
  }
  until.input.addEventListener('change', updateValidity)
  validity.wrap.append(preview)
  updateValidity()

  const customer = field({ label: t('f.customer'), optional: true, input: h('input', { class: 'input', name: 'customer', value: d.customer, maxlength: 200, autocomplete: 'off' }) })
  const clinic = field({ label: t('f.clinic'), optional: true, input: h('input', { class: 'input', name: 'clinic', value: d.clinic, maxlength: 200, autocomplete: 'off' }) })
  const phone = field({
    label: t('f.phone'), optional: true, hint: t('f.phoneHint'),
    input: h('input', { class: 'input', type: 'tel', name: 'phone', value: d.phone, maxlength: 200, dir: 'ltr', autocomplete: 'off', inputmode: 'tel' }),
  })
  const priceHint = h('span')
  const price = field({
    label: t('f.price'), hint: ' ',
    input: h('input', { class: 'input tnum', name: 'price', value: d.price, inputmode: 'decimal', dir: 'ltr', autocomplete: 'off' }),
  })
  price.wrap.querySelector('.hint').replaceChildren(priceHint)
  const note = field({ label: t('f.note'), optional: true, hint: t('f.noteHint'), input: h('textarea', { class: 'input', name: 'note', maxlength: 1000, rows: 3 }) })
  note.input.value = d.note
  ensureSettings().then(s => {
    priceHint.textContent = t('f.priceHint', { price: fmtMoney(s.priceUsd) })
    if (!price.input.value) price.input.value = String(s.priceUsd)
  }, () => { price.wrap.querySelector('.hint').hidden = true })

  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-lg btn-block', disabled: signingBlocked() }, icon('key-round'), t('new.submit'))
  const form = h('form', { class: 'card card-body form', novalidate: true, 'aria-label': t('new.title') },
    h('div', { class: 'form-section' }, dev.wrap, h('div', { class: 'grid-2' }, plan.wrap), validity.wrap, until.wrap),
    h('div', { class: 'form-section' }, h('div', { class: 'grid-2' }, customer.wrap, clinic.wrap), h('div', { class: 'grid-2' }, phone.wrap, price.wrap), note.wrap),
    h('div', { class: 'form-section' }, blockedNote(), submit))

  const collect = () => ({
    device: dev.input.value, plan: plan.value, validity: validity.value, until: until.input.value, customer: customer.input.value,
    clinic: clinic.input.value, phone: phone.input.value, price: price.input.value, note: note.input.value,
  })
  form.addEventListener('input', () => { state.drafts.new = collect() })
  form.addEventListener('change', () => { state.drafts.new = collect() })

  const fields = { device: dev, until, price, customer, clinic, phone, note }
  form.addEventListener('submit', async e => {
    e.preventDefault()
    if (submit.disabled) return
    const v = collect()
    const errors = []
    const devErr = deviceProblem(v.device)
    if (devErr) errors.push(['device', t(devErr)])
    if (v.validity === 'date' && !(v.until && v.until >= todayUtc())) errors.push(['until', t('e.until')])
    const amount = v.price.trim() === '' ? undefined : parseAmount(v.price)
    if (amount === null) errors.push(['price', t('e.price')])
    for (const [k, msg] of errors) fields[k].setError(msg)
    if (errors.length) { fields[errors[0][0]].input.focus(); return }
    setBusy(submit, true, t('new.submitting'))
    try {
      const res = await api('POST', '/api/licences', {
        device: formatDevice(v.device), plan: v.plan, validity: v.validity, until: v.validity === 'date' ? v.until : undefined,
        customer: v.customer, clinic: v.clinic, phone: v.phone, price: amount, note: v.note,
      })
      state.drafts.new = null
      state.results.new = res
      toast(t('new.issuedToast', { device: res.licence.device }))
      showLicenceResult(slot, res, true)
    } catch (err) {
      setBusy(submit, false)
      const key = err.code === 'field' ? err.field : err.code
      const msgs = { device: 'e.device', until: 'e.until', price: 'e.price', customer: 'e.text', clinic: 'e.text', phone: 'e.text', note: 'e.note' }
      if (err.status === 400 && fields[key]) { fields[key].setError(t(msgs[key])); fields[key].input.focus() }
      else if (err.status === 400 && (key === 'plan' || key === 'validity')) (key === 'plan' ? plan : validity).setError(t('e.choice'))
      else {
        fail(err)
        if (err.code === 'signing') refreshMe().then(() => { submit.disabled = signingBlocked() })
      }
    }
  })
  return form
}

function existingNotice(existing) {
  if (!existing?.length) return null
  return h('div', { class: 'callout callout--warn' }, icon('triangle-alert'), h('div', null,
    h('strong', { text: t('new.existingTitle', { n: fmtNum(existing.length) }) }),
    h('p', { text: t('new.existingBody') }),
    h('ul', null, existing.map(l => h('li', null, h('a', { href: `#/licences/${encodeURIComponent(l.id)}` },
      [fmtDate(l.createdAt), t(`plan.${l.plan}`), validityText(l.until), licName(l)].filter(Boolean).join(' · ')))))))
}
function showLicenceResult(slot, res, focus) {
  const { licence: l, message, existing } = res
  const titleId = nextId('r')
  const another = h('button', { type: 'button', class: 'btn btn-outline' }, icon('plus'), t('new.another'))
  another.addEventListener('click', () => {
    state.results.new = null
    slot.replaceChildren(licenceForm(slot))
    slot.querySelector('input[name="device"]')?.focus()
  })
  const title = h('h2', { id: titleId, tabindex: '-1', text: t('new.issued') })
  slot.replaceChildren(h('section', { class: 'card card-body stack', 'aria-labelledby': titleId },
    h('div', { class: 'result-head' }, h('span', { class: 'result-ico' }, icon('circle-check')), h('div', null,
      title,
      h('p', null, ltrText(l.device, 'mono'), ` · ${t(`plan.${l.plan}`)} · ${validityText(l.until)}${licName(l) ? ` · ${licName(l)}` : ''}`))),
    existingNotice(existing),
    codeBlock(l.code, 'code.label'),
    messageBlock(message),
    h('div', { class: 'form-actions' }, another,
      h('a', { class: 'btn btn-ghost', href: `#/licences/${encodeURIComponent(l.id)}` }, t('new.openList'), icon('chevron-right', 'flip-rtl')))))
  if (focus) { title.focus({ preventScroll: true }); title.scrollIntoView({ block: 'start', behavior: 'smooth' }) }
}

// ---- licences --------------------------------------------------------------------------------------------------------
function licRow(l) {
  const name = licName(l)
  const sub = [l.clinic && l.customer ? l.customer : null, l.phone ? ltrText(l.phone) : null].filter(Boolean)
  return h('li', null, h('button', { type: 'button', class: `lic-row${l.status === 'void' ? ' is-void' : ''}`, 'data-id': l.id, on: { click: () => goLicence(l.id) } },
    // Three lines on a phone (who · what · when and how much); on a desktop the lines dissolve into table columns.
    h('span', { class: 'lic-line' },
      h('span', { class: 'c-name' },
        name ? h('strong', { text: name }) : h('strong', { class: 'noname', text: t('lic.noName') }),
        sub.length ? h('small', null, sub.flatMap((s, i) => (i ? [' · ', s] : [s]))) : null),
      h('span', { class: 'c-status' }, statusBadge(l.status))),
    h('span', { class: 'lic-line lic-line--meta' },
      h('span', { class: 'c-device', dir: 'ltr', text: l.device }),
      h('span', { class: 'c-valid' }, planBadge(l.plan), h('span', { text: validityText(l.until) }))),
    h('span', { class: 'lic-line' },
      h('span', { class: 'c-date' }, h('time', { datetime: l.createdAt, title: fmtDateTime(l.createdAt), text: fmtDate(l.createdAt) })),
      h('span', { class: 'c-price', text: fmtMoney(l.price) }))))
}
const goLicence = id => { location.hash = `#/licences/${encodeURIComponent(id)}` }

async function viewLicences(ctx) {
  const { root } = ctx
  const L = state.lic
  root.append(pageHead('lic.title', 'lic.lead', [csvLink(), h('a', { class: 'btn btn-primary btn-sm', href: '#/new' }, icon('plus'), t('nav.new'))]))
  const search = h('input', {
    class: 'input', type: 'search', id: 'lic-q', value: L.q, placeholder: t('lic.searchPh'), 'aria-label': t('lic.search'),
    autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search',
  })
  const status = h('select', { class: 'input', 'aria-label': t('lic.status') },
    h('option', { value: '', text: t('lic.all') }), ['active', 'refunded', 'void'].map(s => h('option', { value: s, text: t(`st.${s}`) })))
  status.value = L.status
  const list = h('ul', { class: 'lic-list', 'aria-label': t('lic.title') })
  const head = h('div', { class: 'lic-head', 'aria-hidden': 'true' },
    h('span', { text: t('col.customer') }), h('span', { text: t('col.device') }), h('span', { text: t('col.validity') }),
    h('span', { class: 'end', text: t('col.price') }), h('span', { class: 'end', text: t('col.status') }), h('span', { class: 'end', text: t('col.issued') }))
  const pager = h('div', { class: 'pager', hidden: true })
  const box = h('section', { class: 'card lic-card', 'aria-label': t('lic.title') }, head, list, pager)
  root.append(h('div', { class: 'toolbar', role: 'search' },
    h('div', { class: 'input-icon search' }, icon('search'), search),
    h('div', { class: 'select' }, status, icon('chevron-down'))), box)
  list.append(...skeletonRows(5).map(r => h('li', null, r)))

  let seq = 0
  const load = async () => {
    const mine = ++seq
    list.setAttribute('aria-busy', 'true')
    const qs = new URLSearchParams({ limit: String(PAGE), offset: String(L.offset) })
    if (L.q) qs.set('q', L.q)
    if (L.status) qs.set('status', L.status)
    try {
      const res = await api('GET', `/api/licences?${qs}`)
      if (!ctx.alive() || mine !== seq) return
      // A page past the end (licences changed meanwhile): show the last one instead.
      if (!res.items.length && res.total > 0 && L.offset > 0) { L.offset = Math.floor((res.total - 1) / PAGE) * PAGE; load(); return }
      L.items = res.items
      L.total = res.total
      draw()
    } catch (err) {
      if (!ctx.alive() || mine !== seq || err.handled) return
      head.hidden = true
      pager.hidden = true
      list.replaceChildren(h('li', null, errorState(err, load)))
    } finally {
      if (mine === seq) list.removeAttribute('aria-busy')
    }
  }
  const draw = () => {
    if (!L.items.length) {
      head.hidden = true
      pager.hidden = true
      const filtered = L.q || L.status
      list.replaceChildren(h('li', null, filtered
        ? emptyState({ ico: 'search', title: t('lic.noMatch'), body: t('lic.noMatchBody'),
          action: h('button', { type: 'button', class: 'btn btn-outline btn-sm', on: { click: () => { search.value = ''; status.value = ''; L.q = ''; L.status = ''; L.offset = 0; load() } } }, icon('x'), t('lic.clear')) })
        : emptyState({ ico: 'key-round', title: t('lic.empty'), body: t('lic.emptyBody'),
          action: h('a', { class: 'btn btn-primary btn-sm', href: '#/new' }, icon('plus'), t('nav.new')) })))
      return
    }
    head.hidden = false
    pager.hidden = false
    list.replaceChildren(...L.items.map(licRow))
    const prev = h('button', { type: 'button', class: 'btn btn-outline btn-sm', disabled: L.offset === 0 }, icon('chevron-left', 'flip-rtl'), t('lic.prev'))
    const next = h('button', { type: 'button', class: 'btn btn-outline btn-sm', disabled: L.offset + PAGE >= L.total }, t('lic.next'), icon('chevron-right', 'flip-rtl'))
    const turn = delta => {
      L.offset = Math.max(0, L.offset + delta)
      load().then(() => box.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
    }
    prev.addEventListener('click', () => turn(-PAGE))
    next.addEventListener('click', () => turn(PAGE))
    pager.replaceChildren(
      h('span', { class: 'pager-info', 'aria-live': 'polite', text: t('lic.range', { from: fmtNum(L.offset + 1), to: fmtNum(L.offset + L.items.length), total: fmtNum(L.total) }) }),
      h('span', { class: 'pager-btns' }, prev, next))
  }

  let timer = 0
  search.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(() => { L.q = search.value.trim(); L.offset = 0; load() }, 300)
  })
  search.addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(timer); L.q = search.value.trim(); L.offset = 0; load() } })
  status.addEventListener('change', () => { L.status = status.value; L.offset = 0; load() })
  await load()
}
/** After an edit in the licence panel: the list row (if the list is on screen) shows the new values. */
function updateListRow(licence) {
  const i = state.lic.items.findIndex(x => x.id === licence.id)
  if (i >= 0) state.lic.items[i] = licence
  const row = document.querySelector(`.lic-row[data-id="${CSS.escape(licence.id)}"]`)
  row?.closest('li')?.replaceWith(licRow(licence))
}

// ---- licence panel (a modal side sheet; full screen on phones) -------------------------------------------------------
let sheet = null
function openLicence(id) {
  if (sheet?.id === id) return
  if (sheet) { const s = sheet; sheet = null; s.dlg.close() }
  const dlg = makeDialog('sheet')
  const titleId = nextId('s')
  dlg.setAttribute('aria-labelledby', titleId)
  const title = h('h2', { id: titleId, text: t('det.title') })
  const sub = h('p')
  const badge = h('span')
  const closeBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('close'), on: { click: () => dlg.close() } }, icon('x'))
  const body = h('div', { class: 'sheet-body' }, h('div', { class: 'card' }, skeletonRows(4)))
  dlg.append(h('header', { class: 'sheet-head' }, h('div', null, title, sub), badge, closeBtn), body)
  const current = { dlg, id }
  sheet = current
  dlg.addEventListener('close', () => {
    if (sheet === current) { sheet = null; leaveSheetRoute() }
    // Back to the row that opened it, if it is still on screen.
    const row = document.querySelector(`.lic-row[data-id="${CSS.escape(id)}"]`)
    if (row && (document.activeElement === document.body || !document.activeElement)) row.focus({ preventScroll: true })
  })
  dlg.showModal()
  closeBtn.focus()
  fillSheet(current, { title, sub, badge, body })
}
function closeSheet() {
  if (!sheet) return
  const s = sheet
  sheet = null
  s.dlg.close()
}
function leaveSheetRoute() {
  if (!parseHash().id) return
  if (state.sheetPushed) { state.sheetPushed = false; history.back() } else { history.replaceState(null, '', '#/licences'); route() }
}

async function fillSheet(current, els) {
  let licence, message
  try {
    ({ licence, message } = await api('GET', `/api/licences/${encodeURIComponent(current.id)}`))
  } catch (err) {
    if (sheet !== current) return
    fail(err)
    current.dlg.close()
    return
  }
  if (sheet !== current) return
  const { title, sub, badge, body } = els
  const msgSlot = h('div')
  const facts = h('dl', { class: 'facts' })
  const drawHead = () => {
    title.textContent = licName(licence) || t('lic.noName')
    sub.replaceChildren(ltrText(licence.device, 'mono'), ` · ${fmtDate(licence.createdAt)}`)
    badge.replaceChildren(statusBadge(licence.status))
    const fact = (label, value, cls) => h('div', { class: cls }, h('dt', { text: label }), h('dd', null, value))
    facts.replaceChildren(
      fact(t('col.device'), ltrText(licence.device, 'mono')),
      fact(t('f.plan'), t(`plan.${licence.plan}`)),
      fact(t('col.until'), validityText(licence.until)),
      fact(t('col.price'), h('span', { class: 'tnum', text: fmtMoney(licence.price) })),
      fact(t('det.issued'), fmtDateTime(licence.createdAt), 'wide'))
  }
  const drawMessage = () => msgSlot.replaceChildren(messageBlock(message, { resend: true }))
  drawHead()
  drawMessage()

  // Status: every change is confirmed, since it moves the licence in or out of the numbers.
  const statusSeg = segField({
    legend: t('det.status'), value: licence.status, cls: 'seg--block seg--status',
    options: ['active', 'refunded', 'void'].map(s => [s, t(`st.${s}`)]),
    onChange: async next => {
      const ok = await confirmDialog({
        title: t(`conf.${next}.title`), body: t(`conf.${next}.body`), confirm: t(`conf.${next}.ok`),
        tone: next === 'void' ? 'bad' : next === 'refunded' ? 'warn' : 'ok',
      })
      if (!ok || sheet !== current) { statusSeg.value = licence.status; return }
      for (const r of statusSeg.seg.querySelectorAll('input')) r.disabled = true
      try {
        ({ licence } = await api('PATCH', `/api/licences/${encodeURIComponent(licence.id)}`, { status: next }))
        drawHead()
        updateListRow(licence)
        toast(t('det.statusSaved', { status: t(`st.${next}`) }))
      } catch (err) {
        statusSeg.value = licence.status
        fail(err)
      } finally {
        for (const r of statusSeg.seg.querySelectorAll('input')) r.disabled = false
        statusSeg.seg.querySelector('input:checked')?.focus()
      }
    },
  })

  // Customer details: only the changed fields are sent.
  const mk = (name, label, attrs = {}, optional = true) => field({ label: t(label), optional, input: h('input', { class: 'input', name, maxlength: 200, autocomplete: 'off', ...attrs }) })
  const f = {
    customer: mk('customer', 'f.customer'),
    clinic: mk('clinic', 'f.clinic'),
    phone: mk('phone', 'f.phone', { type: 'tel', dir: 'ltr', inputmode: 'tel' }),
    price: mk('price', 'f.price', { inputmode: 'decimal', dir: 'ltr', class: 'input tnum' }, false),
    note: field({ label: t('f.note'), optional: true, hint: t('f.noteHint'), input: h('textarea', { class: 'input', name: 'note', maxlength: 1000, rows: 3 }) }),
  }
  const fill = () => { for (const k of Object.keys(f)) f[k].input.value = k === 'price' ? String(licence.price) : licence[k] }
  fill()
  const save = h('button', { type: 'submit', class: 'btn btn-primary', disabled: true }, icon('check'), t('det.save'))
  const changes = () => {
    const out = {}
    for (const k of ['customer', 'clinic', 'phone', 'note']) if (f[k].input.value.trim() !== licence[k]) out[k] = f[k].input.value
    const p = f.price.input.value.trim()
    if (p !== String(licence.price)) out.price = p
    return out
  }
  const form = h('form', { class: 'form', novalidate: true },
    h('div', { class: 'grid-2' }, f.customer.wrap, f.clinic.wrap), h('div', { class: 'grid-2' }, f.phone.wrap, f.price.wrap), f.note.wrap,
    h('div', { class: 'form-actions' }, save))
  form.addEventListener('input', () => { save.disabled = !Object.keys(changes()).length })
  form.addEventListener('submit', async e => {
    e.preventDefault()
    const patch = changes()
    if (!Object.keys(patch).length) return
    if ('price' in patch) {
      const n = parseAmount(patch.price)
      if (n === null) { f.price.setError(t('e.price')); f.price.input.focus(); return }
      patch.price = n
    }
    setBusy(save, true, t('saving'))
    try {
      ({ licence } = await api('PATCH', `/api/licences/${encodeURIComponent(licence.id)}`, patch))
      setBusy(save, false)
      save.disabled = true
      fill()
      drawHead()
      updateListRow(licence)
      toast(t('det.saved'))
      // The message names the clinic and goes to the phone: fetch it again with the new values.
      api('GET', `/api/licences/${encodeURIComponent(licence.id)}`).then(r => {
        if (sheet !== current) return
        message = r.message
        drawMessage()
      }, () => {})
    } catch (err) {
      setBusy(save, false)
      const key = err.code === 'field' ? err.field : err.code
      if (err.status === 400 && f[key]) { f[key].setError(t(key === 'price' ? 'e.price' : key === 'note' ? 'e.note' : 'e.text')); f[key].input.focus() } else fail(err)
    }
  })

  body.replaceChildren(
    facts,
    h('section', { class: 'card card-body', 'aria-label': t('code.label') }, codeBlock(licence.code, 'code.label')),
    h('section', { class: 'card card-body', 'aria-label': t('msg.label') }, msgSlot),
    h('section', { class: 'card card-body stack' }, statusSeg.wrap, h('p', { class: 'hint', text: t('det.statusHint') })),
    h('section', { class: 'card card-body stack', 'aria-label': t('det.edit') }, h('h3', { class: 'block-label', text: t('det.edit') }), form))
}

// ---- PIN reset -------------------------------------------------------------------------------------------------------
async function viewReset(ctx) {
  const { root } = ctx
  root.append(pageHead('reset.title', 'reset.lead'))
  const slot = h('div', { 'data-slot': '' })
  const recent = h('div', null, skeletonRows(3))
  root.append(h('div', { class: 'two-col' }, slot, card('reset.recent', 'history', null, recent)))
  const loadRecent = async () => {
    try {
      const { items } = await api('GET', '/api/resets?limit=20')
      if (!ctx.alive()) return
      recent.replaceChildren(items.length ? h('ul', { class: 'mini-list' }, items.map(resetRow)) : emptyState({ ico: 'rotate-ccw-key', small: true, body: t('reset.none') }))
    } catch (err) {
      if (ctx.alive() && !err.handled) recent.replaceChildren(errorState(err, loadRecent))
    }
  }
  const showForm = () => slot.replaceChildren(resetForm(res => { showResetResult(res, true); loadRecent() }))
  const showResetResult = (res, focus) => {
    const { reset: r, message } = res
    const titleId = nextId('r')
    const title = h('h2', { id: titleId, tabindex: '-1', text: t('reset.made') })
    const again = h('button', { type: 'button', class: 'btn btn-outline' }, icon('plus'), t('reset.another'))
    again.addEventListener('click', () => { state.results.reset = null; showForm(); slot.querySelector('input')?.focus() })
    slot.replaceChildren(h('section', { class: 'card card-body stack', 'aria-labelledby': titleId },
      h('div', { class: 'result-head' }, h('span', { class: 'result-ico' }, icon('circle-check')), h('div', null, title,
        h('p', null, ltrText(r.device, 'mono'), ` · ${t('reset.validity', { from: fmtDay(r.day), to: fmtDay(r.lastDay) })}`))),
      codeBlock(r.code, 'reset.code'),
      messageBlock(message),
      h('div', { class: 'form-actions' }, again)))
    if (focus) { title.focus({ preventScroll: true }); title.scrollIntoView({ block: 'start', behavior: 'smooth' }) }
  }
  if (ctx.keep && state.results.reset) showResetResult(state.results.reset, false)
  else { state.results.reset = null; showForm() }
  await loadRecent()
}
function resetRow(r) {
  const valid = r.lastDay >= todayUtc()
  return h('li', null, h('div', { class: 'mini-row' },
    h('span', { class: 'mini-name' }, ltrText(r.device, 'mono'), r.customer ? ` · ${r.customer}` : ''),
    h('span', { class: 'mini-meta' },
      h('time', { datetime: r.createdAt, title: fmtDateTime(r.createdAt), text: timeAgo(r.createdAt) }),
      h('span', { text: t('reset.until', { date: fmtDay(r.lastDay) }) })),
    h('span', { class: 'mini-side' },
      h('span', { class: `badge badge--dot badge--${valid ? 'valid' : 'expired'}`, text: t(valid ? 'reset.valid' : 'reset.expired') }),
      (() => { const b = copyButton(() => r.code, t('copy')); b.setAttribute('aria-label', t('reset.copyCode', { device: r.device })); return b })())))
}
function resetForm(onDone) {
  const d = state.drafts.reset ??= { device: '', customer: '', phone: '', note: '' }
  const dev = field({
    label: t('f.device'), hint: t('f.deviceHint'),
    input: h('input', { class: 'input input--device', name: 'device', value: d.device, dir: 'ltr', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'XXXX-XXXX', required: true }),
  })
  bindDevice(dev.input)
  const customer = field({ label: t('f.customer'), optional: true, input: h('input', { class: 'input', name: 'customer', value: d.customer, maxlength: 200, autocomplete: 'off' }) })
  const phone = field({ label: t('f.phone'), optional: true, hint: t('f.phoneHint'), input: h('input', { class: 'input', type: 'tel', name: 'phone', value: d.phone, maxlength: 200, dir: 'ltr', inputmode: 'tel', autocomplete: 'off' }) })
  const note = field({ label: t('f.note'), optional: true, hint: t('f.noteHint'), input: h('textarea', { class: 'input', name: 'note', maxlength: 1000, rows: 2 }) })
  note.input.value = d.note
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-lg btn-block', disabled: signingBlocked() }, icon('rotate-ccw-key'), t('reset.submit'))
  const form = h('form', { class: 'card card-body form', novalidate: true, 'aria-label': t('reset.title') },
    dev.wrap, h('div', { class: 'grid-2' }, customer.wrap, phone.wrap), note.wrap, blockedNote(), submit)
  const collect = () => ({ device: dev.input.value, customer: customer.input.value, phone: phone.input.value, note: note.input.value })
  form.addEventListener('input', () => { state.drafts.reset = collect() })
  const fields = { device: dev, customer, phone, note }
  form.addEventListener('submit', async e => {
    e.preventDefault()
    if (submit.disabled) return
    const v = collect()
    const devErr = deviceProblem(v.device)
    if (devErr) { dev.setError(t(devErr)); dev.input.focus(); return }
    setBusy(submit, true, t('reset.submitting'))
    try {
      const res = await api('POST', '/api/resets', { ...v, device: formatDevice(v.device) })
      state.drafts.reset = null
      state.results.reset = res
      toast(t('reset.toast', { device: res.reset.device }))
      onDone(res)
    } catch (err) {
      setBusy(submit, false)
      const key = err.code === 'field' ? err.field : err.code
      if (err.status === 400 && fields[key]) { fields[key].setError(t(key === 'device' ? 'e.device' : key === 'note' ? 'e.note' : 'e.text')); fields[key].input.focus() } else {
        fail(err)
        if (err.code === 'signing') refreshMe().then(() => { submit.disabled = signingBlocked() })
      }
    }
  })
  return form
}

// ---- verify ----------------------------------------------------------------------------------------------------------
async function viewVerify(ctx) {
  const { root } = ctx
  root.append(pageHead('ver.title', 'ver.lead'))
  const d = state.drafts.verify ??= { device: '', code: '' }
  const dev = field({
    label: t('f.device'), hint: t('f.deviceHint'),
    input: h('input', { class: 'input input--device', name: 'device', value: d.device, dir: 'ltr', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'XXXX-XXXX' }),
  })
  bindDevice(dev.input)
  const code = field({ label: t('ver.code'), hint: t('ver.codeHint'), input: h('textarea', { class: 'input input--code', name: 'code', dir: 'ltr', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', rows: 5 }) })
  code.input.value = d.code
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-lg btn-block' }, icon('shield-check'), t('ver.submit'))
  const form = h('form', { class: 'card card-body form', novalidate: true, 'aria-label': t('ver.title') }, dev.wrap, code.wrap, submit)
  const result = h('div', { 'aria-live': 'polite' })
  root.append(h('div', { class: 'two-col' }, form, result))
  const placeholder = () => result.replaceChildren(h('div', { class: 'card' }, emptyState({ ico: 'shield-check', title: t('ver.placeholder'), body: t('ver.placeholderBody') })))
  if (ctx.keep && state.results.verify) showVerifyResult(result, state.results.verify, false)
  else { state.results.verify = null; placeholder() }
  form.addEventListener('input', () => { state.drafts.verify = { device: dev.input.value, code: code.input.value } })
  form.addEventListener('submit', async e => {
    e.preventDefault()
    const devErr = deviceProblem(dev.input.value)
    if (devErr) { dev.setError(t(devErr)); dev.input.focus(); return }
    if (!code.input.value.trim()) { code.setError(t('e.code')); code.input.focus(); return }
    setBusy(submit, true, t('ver.checking'))
    try {
      const r = await api('POST', '/api/verify', { device: formatDevice(dev.input.value), code: code.input.value })
      if (!ctx.alive()) return
      state.results.verify = { ...r, device: formatDevice(dev.input.value) }
      showVerifyResult(result, state.results.verify, true)
    } catch (err) {
      if (err.status === 400 && err.code === 'device') dev.setError(t('e.device'))
      else fail(err)
    } finally { setBusy(submit, false) }
  })
}
function showVerifyResult(slot, r, focus) {
  const titleId = nextId('v')
  const fact = (label, value) => h('div', null, h('dt', { text: label }), h('dd', null, value))
  const kind = r.kind === 'activation' ? t('ver.kindAct') : r.kind === 'reset' ? t('ver.kindReset') : t('ver.kindNone')
  const facts = [fact(t('ver.device'), ltrText(r.device, 'mono')), fact(t('ver.kind'), kind)]
  if (r.kind === 'activation' && r.plan) facts.push(fact(t('f.plan'), t(`plan.${r.plan}`)), fact(t('col.until'), r.until ? fmtDay(r.until) : t('val.lifetime')))
  if (r.kind === 'reset' && r.ok && r.until) facts.push(fact(t('ver.lastDay'), fmtDay(r.until)))
  let reason = null
  if (!r.ok) {
    if (r.reason === 'expired') reason = r.kind === 'activation' && r.until ? t('ver.r.expired', { date: fmtDay(r.until) }) : t('ver.r.expiredReset')
    else reason = t(`ver.r.${['format', 'device', 'kind'].includes(r.reason) ? r.reason : 'format'}`)
  }
  const title = h('h2', { id: titleId, tabindex: '-1', text: r.ok ? t(r.kind === 'reset' ? 'ver.okReset' : 'ver.okAct') : t('ver.bad') })
  slot.replaceChildren(h('section', { class: 'card card-body stack', 'aria-labelledby': titleId },
    h('div', { class: 'result-head' }, h('span', { class: `result-ico${r.ok ? '' : ' result-ico--bad'}` }, icon(r.ok ? 'circle-check' : 'circle-x')),
      h('div', null, title, reason ? h('p', { text: reason }) : null)),
    h('dl', { class: 'facts' }, facts)))
  if (focus) { title.focus({ preventScroll: true }); if (matchMedia('(max-width: 1099px)').matches) title.scrollIntoView({ block: 'start', behavior: 'smooth' }) }
}

// ---- settings --------------------------------------------------------------------------------------------------------
const SETTINGS_SECTIONS = [
  ['set.pricing', [['priceUsd', { inputmode: 'decimal', dir: 'ltr', class: 'input tnum' }], ['priceTextAr', { dir: 'rtl', lang: 'ar' }], ['priceTextEn', { dir: 'ltr', lang: 'en' }]]],
  ['set.contact', [['whatsapp', { type: 'tel', dir: 'ltr', inputmode: 'tel' }], ['email', { type: 'email', dir: 'ltr', autocomplete: 'email' }]]],
  ['set.downloads', [['windowsUrl', { type: 'url', dir: 'ltr', placeholder: 'https://', inputmode: 'url' }]]],
  ['set.announce', [['announcementAr', { dir: 'rtl', lang: 'ar', area: true }], ['announcementEn', { dir: 'ltr', lang: 'en', area: true }]]],
]
/** The API's own rules (SPEC.md → PUT /api/settings), checked here first so the seller sees them at once. */
function settingsProblem(key, raw) {
  const v = String(raw).replace(/[\r\n\t]+/g, ' ').trim()
  if (key === 'priceUsd') return parseAmount(v) === null ? 'se.priceUsd' : null
  if (key === 'whatsapp') {
    const digits = latinDigits(v).replace(/\D/g, '')
    return /^\+?[\d\s().-]+$/.test(latinDigits(v)) && digits.length >= 8 && digits.length <= 15 ? null : 'se.whatsapp'
  }
  if (key === 'email') return !v || (v.length <= 254 && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v)) ? null : 'se.email'
  if (key === 'windowsUrl') {
    if (!v) return null
    try { const u = new URL(v); return u.protocol === 'https:' && u.hostname ? null : 'se.windowsUrl' } catch { return 'se.windowsUrl' }
  }
  return v.length > 300 ? 'se.text' : null
}
async function viewSettings(ctx) {
  const { root } = ctx
  root.append(pageHead('set.title', 'set.lead'))
  const slot = h('div', { 'data-slot': '' }, h('div', { class: 'card' }, skeletonRows(4)))
  root.append(slot)
  const saved = await api('GET', '/api/settings')
  if (!ctx.alive()) return
  state.settings = saved
  let base = saved
  const draft = state.drafts.settings
  const fields = {}
  const sections = SETTINGS_SECTIONS.map(([title, keys]) => h('div', { class: 'form-section' },
    h('h2', { text: t(title) }),
    keys.map(([key, opts]) => {
      const { area, ...attrs } = opts
      const input = area
        ? h('textarea', { class: 'input', name: key, rows: 2, maxlength: 300, ...attrs })
        : h('input', { class: 'input', name: key, maxlength: key === 'windowsUrl' ? 2000 : 300, autocomplete: 'off', spellcheck: key.startsWith('announcement') || key.startsWith('priceText') ? null : 'false', ...attrs })
      input.value = String(draft?.[key] ?? saved[key] ?? '')
      fields[key] = field({ label: t(`s.${key}`), hint: t(`s.${key}Hint`), input })
      return fields[key].wrap
    })))
  const note = h('span', { class: 'dirty-note', 'aria-live': 'polite' })
  const save = h('button', { type: 'submit', class: 'btn btn-primary' }, icon('check'), t('save'))
  const values = () => Object.fromEntries(Object.keys(fields).map(k => [k, fields[k].input.value]))
  const changed = () => {
    const v = values()
    return Object.keys(fields).filter(k => (k === 'priceUsd' ? parseAmount(v[k]) !== base.priceUsd : v[k].trim() !== String(base[k])))
  }
  const refresh = () => {
    const dirty = changed().length > 0
    save.disabled = !dirty
    note.hidden = !dirty
    note.textContent = dirty ? t('set.unsaved') : ''
  }
  const form = h('form', { class: 'card card-body form', novalidate: true, 'aria-label': t('set.title') },
    sections, h('div', { class: 'save-bar' }, note, save))
  form.addEventListener('input', () => { state.drafts.settings = values(); refresh() })
  form.addEventListener('submit', async e => {
    e.preventDefault()
    const keys = changed()
    if (!keys.length) { toast(t('set.noChanges'), 'info'); return }
    const v = values()
    const bad = keys.map(k => [k, settingsProblem(k, v[k])]).filter(([, p]) => p)
    for (const [k, p] of bad) fields[k].setError(t(p))
    if (bad.length) { fields[bad[0][0]].input.focus(); return }
    const patch = Object.fromEntries(keys.map(k => [k, k === 'priceUsd' ? parseAmount(v[k]) : v[k]]))
    setBusy(save, true, t('saving'))
    try {
      base = await api('PUT', '/api/settings', patch)
      state.settings = base
      state.drafts.settings = null
      for (const k of Object.keys(fields)) fields[k].input.value = String(base[k])
      setBusy(save, false)
      refresh()
      toast(t('set.saved'))
    } catch (err) {
      setBusy(save, false)
      refresh()
      if (err.status === 400 && fields[err.field]) {
        const k = err.field
        fields[k].setError(t(['priceUsd', 'whatsapp', 'email', 'windowsUrl'].includes(k) ? `se.${k}` : 'se.text'))
        fields[k].input.focus()
        toast(t('set.fix'), 'error')
      } else fail(err)
    }
  })
  refresh()

  // System: what the panel needs from the Worker's secrets, and where the website is.
  const me = state.me || { signing: true }
  const sysRow = (ico, title, ...kids) => h('div', { class: 'sys-row' }, h('span', { class: 'kpi-ico' }, icon(ico)), h('div', { class: 'grow' }, h('h3', { text: title }), ...kids))
  const signReason = ['missing', 'format', 'mismatch'].includes(me.signingError) ? me.signingError : 'missing'
  const system = card('set.system', 'shield-check', null, h('div', { class: 'card-body' },
    sysRow(me.signing ? 'badge-check' : 'triangle-alert', t('set.signing'),
      me.signing ? h('p', { text: t('set.signingOk') }) : [h('p', { text: t(`sign.${signReason}`) }), h('code', { class: 'cmd', text: 'npx wrangler secret put LICENSE_PRIVATE_JWK' })]),
    sysRow('lock', t('set.password'), h('p', { text: t('set.passwordBody') }), h('code', { class: 'cmd', text: 'npx wrangler secret put ADMIN_PASSWORD' })),
    sysRow('globe', t('set.site'), h('p', { text: t('set.siteBody') }), h('div', { class: 'link-row' },
      h('a', { class: 'chip-btn', href: '/', target: '_blank', rel: 'noopener', hreflang: 'ar' }, icon('external-link'), t('set.siteAr')),
      h('a', { class: 'chip-btn', href: '/en', target: '_blank', rel: 'noopener', hreflang: 'en' }, icon('external-link'), t('set.siteEn'))))))
  slot.replaceChildren(h('div', { class: 'settings-grid' }, form, system))
}

// ---- activity log ----------------------------------------------------------------------------------------------------
async function viewActivity(ctx) {
  const { root } = ctx
  root.append(pageHead('act.title', 'act.lead'))
  const filter = h('select', { class: 'input', 'aria-label': t('act.filter') },
    ['all', 'auth', 'licence', 'reset', 'settings'].map(k => h('option', { value: k, text: t(`act.f.${k}`) })))
  filter.value = state.actFilter
  const count = h('span', { class: 'muted tnum', 'aria-live': 'polite' })
  const box = h('section', { class: 'card act-card', 'aria-label': t('act.title'), 'data-slot': '' }, skeletonRows(6))
  root.append(h('div', { class: 'act-tools' }, h('div', { class: 'select' }, filter, icon('chevron-down')), count), box)
  const { items } = await api('GET', '/api/audit?limit=200')
  if (!ctx.alive()) return
  const now = new Date()
  const today = localDay(now), yesterday = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const dayTitle = iso => {
    const d = localDay(iso)
    if (d === today) return t('act.today')
    if (d === yesterday) return t('act.yesterday')
    return dtf({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  }
  const draw = () => {
    const shown = items.filter(e => state.actFilter === 'all' || ACTIONS[e.action]?.group === state.actFilter)
    count.textContent = t('act.count', { n: fmtNum(shown.length) })
    if (!shown.length) { box.replaceChildren(emptyState({ ico: 'history', body: t('act.empty') })); return }
    const out = []
    let day = null, list = null
    for (const e of shown) {
      const d = localDay(e.at)
      if (d !== day) {
        day = d
        list = h('ul', { class: 'feed' })
        out.push(h('h2', { class: 'feed-day', text: dayTitle(e.at) }), list)
      }
      list.append(feedItem(e, { withIp: true, clock: true }))
    }
    box.replaceChildren(...out)
  }
  filter.addEventListener('change', () => { state.actFilter = filter.value; draw() })
  draw()
}

// ---- start -----------------------------------------------------------------------------------------------------------
async function boot() {
  try {
    if (sessionHint() === 'no') renderLogin()
    else await startSession()
  } catch (err) {
    if (err.status === 401) { setSessionHint(false); renderLogin() } else renderOffline(err)
  } finally {
    document.getElementById('boot')?.remove()
  }
}
window.addEventListener('hashchange', route)
// The skip link moves the focus only: as a plain #main link it would change the hash, which is the page's route.
document.getElementById('skip')?.addEventListener('click', e => {
  e.preventDefault()
  document.getElementById('main')?.focus()
})
state.lang = loadLang()
state.msgLang = 'ar'
applyLang()
boot()

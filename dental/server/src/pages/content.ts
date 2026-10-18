// The landing page's words, Arabic and English side by side (rendered by landing.ts).
// Every claim here must stay true of the app: the facts come from store/LISTING.md, README.md and docs/*.md.
// Plain text only: landing.ts escapes everything. {price}, {whatsapp}, {email}, {version} and {size} are filled
// from the seller's settings and the published APK at render time; {activate} is the activation page's address and
// {compare} a link to the comparison page.
// Activation and privacy follow docs/LICENCE-KEYS.md (licence keys, and what activation sends).
import type { SiteLang } from '../site-lang'

export type IconName =
  | 'wifiOff' | 'languages' | 'monitorSmartphone' | 'shieldCheck' | 'databaseBackup' | 'lockKeyhole' | 'heartPulse'
  | 'tooth' | 'calendarCheck' | 'clipboardList' | 'receipt' | 'pill' | 'package' | 'chartColumn' | 'userCog' | 'download'
  | 'messageCircle' | 'check' | 'chevronDown' | 'menu' | 'x' | 'smartphone' | 'monitor' | 'infinity' | 'badgeCheck'
  | 'keyRound' | 'mail' | 'eyeOff' | 'arrowLeft' | 'arrowRight' | 'lifeBuoy'
  | 'copy' | 'circleAlert' | 'loaderCircle' | 'info' | 'settings' | 'bookOpen' | 'playCircle'

/** The dental chart chips borrow the app's own condition colours (src/styles/tokens.css). */
export type ChipTone = 'caries' | 'filled' | 'crown' | 'rootCanal' | 'implant' | 'bridge'

export interface Feature { icon: IconName; title: string; text: string; chips?: { label: string; tone?: ChipTone }[] }
export interface Faq { q: string; a: string }

export interface Copy {
  meta: { title: string; description: string; ogTitle: string; ogLocale: string; ogAltLocale: string; ogImageAlt: string }
  skip: string
  /** `guide` and `videos` are pages of their own (/guide, /videos); the rest are sections of this page. */
  /** `compare` is the comparison page (/compare). */
  nav: { label: string; features: string; screenshots: string; pricing: string; download: string; faq: string; compare: string; guide: string; videos: string }
  menu: string
  /** The other language: its name (written in that language) and an accessible label. */
  other: { name: string; label: string }
  /** The language menu (every language of the site): its label. */
  langMenu: string
  /**
   * The short factual answer to "what is Dentora?" right under the hero: the paragraph search engines and AI
   * assistants quote. {price} is the price. `appLang` (pages in a language the app does not have) says which
   * languages the app's interface has.
   */
  summary: { title: string; text: string; appLang?: string }
  whatsapp: { short: string; header: string }
  announcement: string
  hero: {
    badge: string; titleA: string; titleB: string; lead: string
    android: string; androidRequest: string; apkMeta: string
    windows: string; windowsRequest: string
    whatsapp: string; points: string[]; imageAlt: string
  }
  trust: { label: string; items: [string, string, string, string, string] }
  features: { eyebrow: string; title: string; lead: string; items: Feature[] }
  privacy: { eyebrow: string; title: string; lead: string; points: { icon: IconName; title: string; text: string }[] }
  shots: {
    eyebrow: string; title: string; lead: string; desktopLabel: string; phoneLabel: string; windowTitle: string
    featured: { title: string; text: string; alt: string }
    phones: { key: 'dashboard' | 'patient' | 'treatments' | 'invoice' | 'reports'; title: string; text: string; alt: string }[]
  }
  /** A step's `link` is the label of a link under its text, to `linkTo` (a page of the site; the activation page when absent). */
  steps: { eyebrow: string; title: string; lead: string; items: { title: string; text: string; link?: string; linkTo?: '/activate' | '/guide' | '/videos' }[] }
  pricing: {
    eyebrow: string; title: string; lead: string; label: string; terms: string; includedTitle: string; included: string[]
    cta: string; trial: string
    points: { icon: IconName; title: string; text: string }[]
  }
  download: {
    eyebrow: string; title: string; lead: string; free: string
    android: { name: string; for: string; req: string; btn: string; meta: string; note: string; requestText: string; requestBtn: string }
    windows: { name: string; for: string; req: string; btn: string; meta: string; file: string; note: string; requestText: string; requestBtn: string }
    reqTitle: string; reqs: string[]
  }
  /**
   * `learn`: under the WhatsApp button, a line pointing to the user guide and the video course. `compareLink` is the
   * text of the link an answer's {compare} becomes (the comparison page).
   */
  faq: { eyebrow: string; title: string; more: string; moreLink: string; emailPart: string; compareLink: string; learn: { text: string; guide: string; videos: string }; items: Faq[] }
  cta: { title: string; lead: string; download: string; whatsapp: string }
  footer: { tagline: string; product: string; activate: string; legal: string; contact: string; privacy: string; terms: string; rights: string; email: string }
  /** Pre-filled WhatsApp messages (the seller reads them first). */
  wa: { general: string; buy: string; android: string }
  mb: string
}

const ar: Copy = {
  meta: {
    title: 'Dentora | برنامج إدارة عيادة الأسنان بدون إنترنت لويندوز وأندرويد',
    description: 'برنامج إدارة عيادة أسنان يعمل بدون إنترنت على ويندوز وأندرويد: المرضى ومخطط الأسنان والمواعيد والفواتير. عربي وإنجليزي، دفعة واحدة، وتجربة مجانية 7 أيام.',
    ogTitle: 'Dentora — عيادة الأسنان كلها في برنامج واحد',
    ogLocale: 'ar_AR',
    ogAltLocale: 'en_US',
    ogImageAlt: 'Dentora لإدارة عيادة الأسنان، يعمل بدون إنترنت',
  },
  skip: 'تخطَّ إلى المحتوى',
  nav: { label: 'التنقل الرئيسي', features: 'المزايا', screenshots: 'الشاشات', pricing: 'السعر', download: 'التحميل', faq: 'الأسئلة الشائعة', compare: 'المقارنة', guide: 'دليل الاستخدام', videos: 'الفيديوهات' },
  menu: 'القائمة',
  other: { name: 'English', label: 'English version' },
  langMenu: 'اللغة',
  summary: {
    title: 'ما هو Dentora؟',
    text: 'Dentora برنامج لإدارة عيادات الأسنان يعمل بدون إنترنت على ويندوز 10 و11 (64-بت) وعلى أندرويد 7 أو أحدث، بواجهة عربية وإنجليزية. يجمع ملفات المرضى ومخطط الأسنان بترقيم FDI والمواعيد مع تذكير واتساب وخطط العلاج والفواتير والتقارير. سعره {price} تُدفع مرة واحدة لترخيص مدى الحياة على جهاز واحد، مع تجربة مجانية 7 أيام بكل المزايا ودون تسجيل. يحتاج الإنترنت مرة واحدة فقط لتفعيل الترخيص، وتبقى بيانات العيادة والمرضى على الجهاز نفسه، مع نسخ احتياطي يمكن تشفيره بـ AES-256.',
  },
  whatsapp: { short: 'واتساب', header: 'تواصل عبر واتساب' },
  announcement: 'إعلان',
  hero: {
    badge: 'يعمل بدون إنترنت على ويندوز وأندرويد',
    titleA: 'عيادة الأسنان كلها',
    titleB: 'في برنامج واحد',
    lead: 'ملفات المرضى ومخطط الأسنان والمواعيد وخطط العلاج والفواتير والتقارير، بواجهة عربية حديثة، وبالإنجليزية أيضاً. يعمل بدون إنترنت، وتبقى بيانات عيادتك ومرضاها على جهازك.',
    android: 'حمّل لأندرويد',
    androidRequest: 'اطلب نسخة أندرويد',
    apkMeta: 'ملف APK · الإصدار {version} · {size}',
    windows: 'حمّل لويندوز',
    windowsRequest: 'اطلب نسخة ويندوز',
    whatsapp: 'اسألنا على واتساب',
    points: ['تجربة مجانية 7 أيام بكل المزايا', 'دون تسجيل أو حساب', 'دفعة واحدة مدى الحياة'],
    imageAlt: 'لوحة Dentora الرئيسية على حاسوب ويندوز، وشاشة المواعيد على هاتف أندرويد',
  },
  trust: {
    label: 'لماذا Dentora',
    items: ['يعمل بدون إنترنت', 'عربي وإنجليزي', 'ويندوز وأندرويد', 'بياناتك تبقى على جهازك', 'نسخ احتياطي مشفّر'],
  },
  features: {
    eyebrow: 'المزايا',
    title: 'كل ما تحتاجه عيادتك، في مكان واحد',
    lead: 'من أول زيارة حتى آخر إيصال، أدوات صُمّمت لطبيب الأسنان وفريق العيادة.',
    items: [
      {
        icon: 'heartPulse', title: 'المرضى والتنبيهات الطبية',
        text: 'ملف كامل لكل مريض بالبيانات ووسائل التواصل والتأمين، وتنبيه طبي واضح قبل أي إجراء. بحث عربي ذكي، وصور وأشعة ومستندات وملاحظات سريرية.',
        chips: [{ label: 'الحساسية' }, { label: 'الأمراض المزمنة' }, { label: 'الأدوية' }],
      },
      {
        icon: 'tooth', title: 'مخطط أسنان تفاعلي بترقيم FDI',
        text: 'أسنان دائمة ولبنية، وحالة لكل سطح، ووضع رسم سريع، وسجل تاريخي لكل سن، ومخطط جاهز للطباعة.',
        chips: [
          { label: 'تسوس', tone: 'caries' }, { label: 'حشوة', tone: 'filled' }, { label: 'تاج', tone: 'crown' },
          { label: 'علاج عصب', tone: 'rootCanal' }, { label: 'زرعة', tone: 'implant' }, { label: 'جسر', tone: 'bridge' },
        ],
      },
      { icon: 'calendarCheck', title: 'المواعيد وتذكير واتساب', text: 'عرض اليوم والأسبوع والشهر والقائمة لأكثر من طبيب، مع كشف التعارض، وتذكير برسالة واتساب جاهزة تراجعها قبل الإرسال.' },
      { icon: 'clipboardList', title: 'العلاجات وخطط العلاج', text: 'قائمة إجراءات وأسعار قابلة للتعديل، وخطة علاج لكل مريض بالأسنان والأسطح، وطباعة عرض سعر.' },
      { icon: 'receipt', title: 'الفواتير والدفعات والإيصالات', text: 'حوّل العمل المنجز إلى فاتورة بلمسة. دفعات جزئية ورصيد المريض وإيصالات مرقّمة وكشف حساب، بشعار عيادتك.' },
      { icon: 'pill', title: 'الوصفات والمخبر', text: 'وصفات من قاعدة أدوية جاهزة تطبعها أو ترسلها عبر واتساب، وطلبات مخبر مع متابعة الحالة ومواعيد التسليم.' },
      { icon: 'package', title: 'المخزون والمصروفات', text: 'كميات وحد أدنى مع تنبيهات النقص وانتهاء الصلاحية، ومصروفات حسب الفئة مقارنةً بالفترة السابقة.' },
      { icon: 'chartColumn', title: 'التقارير', text: 'الإيرادات والمصروفات والربح حسب الطبيب والإجراء وطريقة الدفع، ونسبة عدم الحضور والذمم المستحقة، مع تصدير CSV.' },
      {
        icon: 'userCog', title: 'الفريق والصلاحيات',
        text: 'لكل فرد في الفريق دوره وصلاحياته، ودخول برمز PIN عند كل تشغيل، وقفل تلقائي حين يُترك الجهاز دون استخدام.',
        chips: [{ label: 'مدير' }, { label: 'طبيب' }, { label: 'مساعد' }, { label: 'استقبال' }],
      },
      {
        icon: 'databaseBackup', title: 'نسخ احتياطي مشفّر',
        text: 'عيادتك كلها في ملف واحد تحفظه حيث تشاء، يُتحقق منه بعد الحفظ ويمكن حمايته بكلمة مرور، للاستعادة أو الانتقال إلى جهاز جديد.',
        chips: [{ label: 'ملف واحد' }, { label: 'AES-256' }, { label: 'استعادة كاملة' }],
      },
    ],
  },
  privacy: {
    eyebrow: 'الخصوصية أولاً',
    title: 'بيانات مرضاك تبقى عندك',
    lead: 'لا حساب ولا مزامنة سحابية. يحفظ Dentora كل شيء على جهاز العيادة نفسه، ولا يخرج منه شيء من بيانات العيادة أو المرضى إلا حين تختار أنت ذلك.',
    points: [
      { icon: 'wifiOff', title: 'يعمل دون إنترنت', text: 'استقبل المرضى واكتب الفواتير حتى لو انقطع الاتصال، فالبرنامج لا يحتاج الإنترنت ليعمل.' },
      { icon: 'eyeOff', title: 'لا نطّلع على بياناتك', text: 'لا نجمع بيانات عيادتك أو مرضاك ولا نستلمها، ولا إعلانات ولا تتبّع ولا إحصاءات استخدام. تفعيل المفتاح يرسل المفتاح ورقم الجهاز فقط، مرة واحدة.' },
      { icon: 'lockKeyhole', title: 'نسختك في يدك', text: 'نسخة احتياطية كاملة في ملف واحد، تحميها بكلمة مرور إن شئت، وتنقلها إلى جهاز جديد متى احتجت.' },
    ],
  },
  shots: {
    eyebrow: 'الشاشات',
    title: 'جولة في شاشات Dentora',
    lead: 'لقطات حقيقية من البرنامج ببيانات العيادة التجريبية المرفقة به، على الحاسوب والهاتف.',
    desktopLabel: 'على ويندوز',
    phoneLabel: 'على أندرويد',
    windowTitle: 'Dentora — مخطط الأسنان',
    featured: {
      title: 'مخطط أسنان تفاعلي',
      text: 'ترقيم FDI لكل سن وسطح، مع السجل الكامل',
      alt: 'مخطط الأسنان التفاعلي في Dentora على ويندوز: أسنان الفكين بترقيم FDI وحالة كل سطح ودليل الحالات',
    },
    phones: [
      { key: 'dashboard', title: 'عيادتك كلها في شاشة واحدة', text: 'مواعيد اليوم والإيرادات والتنبيهات', alt: 'الشاشة الرئيسية في Dentora على الهاتف: مواعيد اليوم والإيرادات' },
      { key: 'patient', title: 'ملف كامل وتنبيه طبي واضح', text: 'الحساسية والأمراض المزمنة أمامك قبل أي إجراء', alt: 'ملف مريض في Dentora على الهاتف مع تنبيه طبي بالحساسية' },
      { key: 'treatments', title: 'خطط علاج خطوة بخطوة', text: 'ومن العمل المنجز إلى الفاتورة بضغطة', alt: 'خطة علاج في Dentora على الهاتف مع حالة كل إجراء وسعره' },
      { key: 'invoice', title: 'فواتير أنيقة جاهزة للطباعة', text: 'دفعات جزئية ورصيد المريض وإيصالات مرقّمة', alt: 'فاتورة في Dentora على الهاتف مع المدفوع والرصيد المستحق' },
      { key: 'reports', title: 'تقارير تكشف لك أداء عيادتك', text: 'الإيرادات والمصروفات والربح بالطبيب والإجراء', alt: 'تقرير الإيرادات اليومية وطرق الدفع في Dentora على الهاتف' },
    ],
  },
  steps: {
    eyebrow: 'طريقة البدء',
    title: 'ابدأ خلال دقائق',
    lead: 'جرّب كل شيء أولاً، وادفع فقط حين تقتنع.',
    items: [
      {
        title: 'حمّل البرنامج وجرّبه 7 أيام مجاناً',
        text: 'ثبّت Dentora على حاسوب ويندوز أو جهاز أندرويد، وكل المزايا مفتوحة طوال التجربة دون تسجيل. ودليل الاستخدام يشرح لك كل شاشة بالصور خطوة بخطوة.',
        link: 'افتح دليل الاستخدام', linkTo: '/guide',
      },
      { title: 'اشترِ الترخيص واستلم مفتاحك', text: 'اطلب الترخيص عبر واتساب، وبعد الدفع يصلك مفتاح ترخيص من 16 خانة، دون أن ترسل رقم جهازك.' },
      {
        title: 'فعّل مرة واحدة، والترخيص لك مدى الحياة',
        text: 'الصق المفتاح في الإعدادات ← الترخيص والجهاز متصل بالإنترنت، أو فعّله من صفحة التفعيل على موقعنا. بعدها يعمل البرنامج دون إنترنت، وكل ما أدخلته خلال التجربة يبقى كما هو.',
        link: 'افتح صفحة التفعيل',
      },
    ],
  },
  pricing: {
    eyebrow: 'السعر',
    title: 'ادفع مرة واحدة، واستخدمه مدى الحياة',
    lead: 'لا اشتراك شهري ولا رسوم مخفية. ادفع مرة واحدة، ويبقى Dentora مفعّلاً على جهاز عيادتك مدى الحياة.',
    label: 'بلا اشتراك',
    terms: 'دفعة واحدة · جهاز واحد · كل المزايا',
    includedTitle: 'يشمل الترخيص',
    included: ['كل المزايا دون استثناء', 'عدد غير محدود من المرضى والمواعيد والفواتير', 'الواجهة العربية والإنجليزية', 'يعمل دون إنترنت وبياناتك على جهازك', 'مساعدة عبر واتساب'],
    cta: 'اطلب الترخيص عبر واتساب',
    trial: 'جرّبه مجاناً 7 أيام أولاً',
    points: [
      { icon: 'infinity', title: 'دفعة واحدة فقط', text: 'لا اشتراك ولا تجديد سنوي، والترخيص لك مدى الحياة.' },
      { icon: 'badgeCheck', title: 'جرّب قبل أن تدفع', text: 'سبعة أيام مجانية بكل المزايا، دون تسجيل أو حساب.' },
      { icon: 'shieldCheck', title: 'لا يُحذف شيء بعد التجربة', text: 'تبقى بياناتك متاحة للعرض والطباعة والنسخ الاحتياطي حتى التفعيل.' },
    ],
  },
  download: {
    eyebrow: 'التحميل',
    title: 'حمّل Dentora وابدأ التجربة',
    lead: 'سبعة أيام مجانية بكل المزايا. ثبّت البرنامج، وأدخل بيانات عيادتك، وجرّبه بنفسك.',
    free: 'تجربة مجانية',
    android: {
      name: 'أندرويد', for: 'للهواتف والأجهزة اللوحية', req: 'أندرويد 7 أو أحدث', btn: 'تحميل ملف APK',
      meta: 'الإصدار {version} · {size}',
      note: 'عند فتح الملف قد يطلب هاتفك السماح بتثبيت التطبيقات من هذا المصدر.',
      requestText: 'نرسل لك ملف التثبيت مباشرة عبر واتساب.', requestBtn: 'اطلب نسخة أندرويد',
    },
    windows: {
      name: 'ويندوز', for: 'للحواسيب المكتبية والمحمولة', req: 'ويندوز 10 أو 11 (64-بت)', btn: 'تحميل لويندوز',
      meta: 'برنامج تثبيت مع اختصار على سطح المكتب وقائمة ابدأ',
      file: 'برنامج التثبيت · الإصدار {version} · {size}',
      note: 'لأن البرنامج جديد، قد يعرض ويندوز عند التثبيت شاشة «حماية Windows»: اضغط «مزيد من المعلومات» ثم «تشغيل على أي حال».',
      requestText: 'نرسل لك رابط التثبيت عبر واتساب.', requestBtn: 'اطلب نسخة ويندوز',
    },
    reqTitle: 'المتطلبات',
    reqs: ['ويندوز 10 أو 11 (64-بت)', 'أندرويد 7 أو أحدث', 'الإنترنت مرة واحدة فقط لتفعيل المفتاح'],
  },
  faq: {
    eyebrow: 'الأسئلة الشائعة',
    title: 'أسئلة تهمّك',
    more: 'لم تجد جواب سؤالك؟',
    moreLink: 'راسلنا على واتساب',
    emailPart: '، أو على البريد {email}،',
    compareLink: 'مقارنة برامج إدارة عيادات الأسنان',
    learn: { text: 'وتعلّم البرنامج بنفسك، بالصور أو بالفيديو:', guide: 'دليل الاستخدام', videos: 'الفيديوهات التعليمية' },
    items: [
      { q: 'ما أفضل برنامج لإدارة عيادة الأسنان يعمل بدون إنترنت؟', a: 'يعتمد ذلك على عيادتك، لكن إن أردت العمل بدون إنترنت فاختر برنامجاً يحفظ البيانات على حاسوبك أو هاتفك نفسه ولا يحتاج إلى خادم. صُمّم Dentora لذلك: يعمل بالكامل بدون إنترنت على ويندوز 10 و11 وأندرويد 7 أو أحدث، ويحفظ ملفات المرضى كلها على الجهاز، ويشمل مخطط الأسنان والمواعيد وخطط العلاج والفواتير والتقارير. جرّب كل مزاياه مجاناً 7 أيام، أو اقرأ المقارنة بين البرامج التي تعمل بدون إنترنت والبرامج السحابية والبرامج المعتمدة على خادم: {compare}.' },
      { q: 'هل يحتاج Dentora إلى الإنترنت؟', a: 'لا. يعمل Dentora بالكامل دون إنترنت على الحاسوب والهاتف. تحتاج الإنترنت لتحميله، ومرة واحدة لتفعيل مفتاح الترخيص. وإن لم يكن جهاز العيادة متصلاً، ففعّل المفتاح من أي جهاز آخر على {activate}، ثم الصق رمز التفعيل الذي تحصل عليه في البرنامج دون اتصال.' },
      { q: 'كيف أفعّل Dentora بعد الشراء؟', a: 'بعد الدفع يصلك مفتاح ترخيص من 16 خانة. افتح Dentora ← الإعدادات ← الترخيص، والصق المفتاح واضغط «تفعيل» والجهاز متصل بالإنترنت. أو افتح {activate} من أي جهاز، وأدخل رقم جهازك (تجده في الشاشة نفسها) مع المفتاح، ثم الصق رمز التفعيل الذي يظهر لك في البرنامج. يكفي ذلك مرة واحدة.' },
      { q: 'هل يوجد برنامج عيادة أسنان بدفعة واحدة دون اشتراك؟', a: 'نعم. سعر Dentora {price} تُدفع مرة واحدة، لترخيص مدى الحياة على جهاز واحد بكل المزايا، دون اشتراك شهري أو سنوي. أما برامج عيادات الأسنان السحابية فتُباع عادةً باشتراك شهري. ويمكنك تجربة Dentora مجاناً 7 أيام قبل أن تدفع.' },
      { q: 'هل يوجد برنامج عيادة أسنان عربي لأندرويد وويندوز؟', a: 'نعم. في Dentora واجهة عربية كاملة من اليمين إلى اليسار مع بحث عربي ذكي، وواجهة إنجليزية تبدّل إليها متى شئت. ويعمل بدون إنترنت على حواسيب ويندوز 10 و11 (64-بت) وعلى هواتف وأجهزة أندرويد اللوحية بإصدار 7 أو أحدث.' },
      { q: 'هل بيانات المرضى خاصة؟ وأين تُحفظ؟', a: 'تُحفظ على جهازك فقط. لا يوجد حساب ولا مزامنة سحابية، فلا نستلم بيانات عيادتك أو مرضاك ولا نطّلع عليها، ولا يحتوي البرنامج على إعلانات أو تتبّع. يدخل كل فرد في الفريق برمز PIN خاص به، ويمكن حماية النسخ الاحتياطية بكلمة مرور (تشفير AES-256). والاتصال الوحيد بخادمنا هو تفعيل المفتاح مرة واحدة، ولا يُرسل فيه إلا المفتاح ورقم الجهاز.' },
      { q: 'ما الفرق بين Dentora وبرامج عيادات الأسنان السحابية؟', a: 'البرامج السحابية تعمل في متصفح الإنترنت وتحفظ بياناتك على خوادم الشركة، فتحتاج اتصالاً بالإنترنت لتعمل، وتُدفع عادةً كل شهر. أما Dentora فيُثبَّت على حاسوبك أو هاتفك، ويعمل بدون إنترنت، ويحفظ كل البيانات على الجهاز نفسه، ويُدفع مرة واحدة. وفي المقابل: لا مزامنة بين الأجهزة، ولكل جهاز ترخيصه، والنسخ الاحتياطي بيدك (وهو مدمج في البرنامج: ملف واحد بكلمة مرور اختيارية وتشفير AES-256). المقارنة الكاملة: {compare}.' },
      { q: 'هل يمكنني استخدام Dentora على عدة أجهزة؟', a: 'نعم، بترخيص لكل جهاز: كل ترخيص يفعّل حاسوباً أو هاتفاً واحداً، فيحتاج كل جهاز إضافي ترخيصاً خاصاً به. ولأن Dentora لا يزامن البيانات عبر الإنترنت، يحتفظ كل جهاز ببياناته ولا تتزامن الأجهزة فيما بينها.' },
      { q: 'كيف آخذ نسخة احتياطية؟', a: 'من الإعدادات ← النسخ الاحتياطي احفظ نسخة كاملة في ملف واحد حيث تشاء: ذاكرة USB أو Google Drive أو بريدك. يمكنك حمايتها بكلمة مرور (تشفير AES-256)، واستعادتها على الجهاز نفسه أو على جهاز جديد.' },
      { q: 'هل يمكنني نقل الترخيص إلى جهاز آخر؟', a: 'يعمل المفتاح على جهاز واحد، إذ يرتبط برقم الجهاز الذي فُعّل عليه أول مرة. تحديث البرنامج أو إعادة تثبيته على الجهاز نفسه يُبقي رقم الجهاز كما هو، فيبقى رمز التفعيل صالحاً، ويعطيك المفتاح الرمز نفسه إن احتجت إليه من جديد. أما الجهاز الجديد أو إعادة ضبط ويندوز أو الهاتف فتعطي رقم جهاز جديداً، فراسلنا على واتساب بشأن نقل الترخيص. خذ نسخة احتياطية دائماً قبل ذلك، فحذف التطبيق من أندرويد يحذف بياناته.' },
      { q: 'كم سعر Dentora؟', a: '{price} تُدفع مرة واحدة، لترخيص مدى الحياة على جهاز واحد بكل المزايا ودون اشتراك. جرّبه أولاً مجاناً 7 أيام؛ وإن انتهت التجربة قبل التفعيل فلا يُحذف شيء، وتتوقف الإضافة والتعديل فقط حتى تفعّل البرنامج.' },
      { q: 'كيف أحصل على المساعدة؟', a: 'راسلنا على واتساب على الرقم {whatsapp}{email} ونجيبك عن أسئلة التثبيت والتفعيل والنسخ الاحتياطي ونقل العيادة إلى جهاز جديد.' },
      { q: 'ما اللغات المتاحة؟', a: 'العربية والإنجليزية، وتبدّل بينهما في أي وقت من الإعدادات. الواجهة العربية كاملة من اليمين إلى اليسار مع بحث عربي ذكي، وتختار عملة عيادتك وطريقة كتابة أسماء الأشهر.' },
    ],
  },
  cta: {
    title: 'جاهز لتنظيم عيادتك؟',
    lead: 'حمّل Dentora اليوم وجرّب كل مزاياه مجاناً 7 أيام، دون تسجيل ودون إنترنت.',
    download: 'حمّل مجاناً',
    whatsapp: 'تحدّث معنا على واتساب',
  },
  footer: {
    tagline: 'برنامج متكامل لإدارة عيادة الأسنان، يعمل دون إنترنت على ويندوز وأندرويد.',
    product: 'البرنامج', activate: 'تفعيل الترخيص', legal: 'معلومات قانونية', contact: 'تواصل معنا',
    privacy: 'سياسة الخصوصية', terms: 'شروط الاستخدام', rights: 'جميع الحقوق محفوظة.', email: 'البريد الإلكتروني',
  },
  wa: {
    general: 'مرحباً، أودّ الاستفسار عن برنامج Dentora لإدارة عيادة الأسنان.',
    buy: 'مرحباً، أريد شراء ترخيص Dentora مدى الحياة.',
    android: 'مرحباً، أريد ملف تثبيت Dentora لأندرويد.',
  },
  mb: 'ميغابايت',
}

const en: Copy = {
  meta: {
    title: 'Dentora | Dental Clinic Software for Windows & Android, Works Offline',
    description: 'Dental clinic software that works offline on Windows & Android: patients, dental chart, appointments, invoices. Arabic & English. One payment, free trial.',
    ogTitle: 'Dentora — your whole dental clinic in one app',
    ogLocale: 'en_US',
    ogAltLocale: 'ar_AR',
    ogImageAlt: 'Dentora dental clinic management, works offline',
  },
  skip: 'Skip to content',
  nav: { label: 'Main navigation', features: 'Features', screenshots: 'Screenshots', pricing: 'Pricing', download: 'Download', faq: 'FAQ', compare: 'Compare', guide: 'User guide', videos: 'Videos' },
  menu: 'Menu',
  other: { name: 'العربية', label: 'النسخة العربية' },
  langMenu: 'Language',
  summary: {
    title: 'What is Dentora?',
    text: 'Dentora is dental clinic management software that works fully offline on Windows 10 and 11 (64-bit) and on Android 7.0 or later, with an Arabic and English interface. It brings together patient records, an FDI dental chart, appointments with WhatsApp reminders, treatment plans, invoices and reports. It costs {price}, paid once, for a lifetime licence on one device, with a free 7‑day trial of every feature and no sign-up. The internet is needed only once, to activate the licence, and all clinic and patient data stays on the device, with backups you can encrypt with AES-256.',
  },
  whatsapp: { short: 'WhatsApp', header: 'Chat on WhatsApp' },
  announcement: 'Announcement',
  hero: {
    badge: 'Works offline on Windows & Android',
    titleA: 'Your whole dental clinic,',
    titleB: 'in one app',
    lead: "Patient files, dental chart, appointments, treatment plans, invoices and reports, in a modern interface in Arabic and English. It works without internet, and your clinic's data stays on your device.",
    android: 'Download for Android',
    androidRequest: 'Request the Android app',
    apkMeta: 'APK · version {version} · {size}',
    windows: 'Download for Windows',
    windowsRequest: 'Request Windows version',
    whatsapp: 'Ask us on WhatsApp',
    points: ['7-day free trial, every feature', 'No sign-up', 'One payment, for life'],
    imageAlt: 'The Dentora dashboard on a Windows computer and the appointments screen on an Android phone',
  },
  trust: {
    label: 'Why Dentora',
    items: ['Works offline', 'Arabic & English', 'Windows & Android', 'Your data stays on your device', 'Encrypted backups'],
  },
  features: {
    eyebrow: 'Features',
    title: 'Everything your clinic needs, in one place',
    lead: 'From the first visit to the last receipt, tools built for dentists and their teams.',
    items: [
      {
        icon: 'heartPulse', title: 'Patients & medical alerts',
        text: 'A complete file for every patient with contacts and insurance, and a clear medical alert before any procedure. Arabic-aware search, photos, X-rays, documents and clinical notes.',
        chips: [{ label: 'Allergies' }, { label: 'Chronic conditions' }, { label: 'Medications' }],
      },
      {
        icon: 'tooth', title: 'Interactive dental chart (FDI)',
        text: 'Permanent and primary teeth, a condition for every surface, quick paint mode, a full history for every tooth and a printable chart.',
        chips: [
          { label: 'Caries', tone: 'caries' }, { label: 'Filling', tone: 'filled' }, { label: 'Crown', tone: 'crown' },
          { label: 'Root canal', tone: 'rootCanal' }, { label: 'Implant', tone: 'implant' }, { label: 'Bridge', tone: 'bridge' },
        ],
      },
      { icon: 'calendarCheck', title: 'Appointments & WhatsApp reminders', text: 'Day, week, month and agenda views for several doctors, with conflict detection and a ready WhatsApp reminder you review before sending.' },
      { icon: 'clipboardList', title: 'Treatments & plans', text: 'An editable procedure and price list, a treatment plan for every patient by tooth and surface, and printable estimates.' },
      { icon: 'receipt', title: 'Invoices, payments & receipts', text: "Turn finished work into an invoice in one tap. Part payments, patient balances, numbered receipts and statements, with your clinic's logo." },
      { icon: 'pill', title: 'Prescriptions & lab', text: 'Prescriptions from a ready drug list, printed or shared on WhatsApp, and lab orders with status and due-date tracking.' },
      { icon: 'package', title: 'Inventory & expenses', text: 'Stock levels with low-stock and expiry alerts, and expenses by category compared with the previous period.' },
      { icon: 'chartColumn', title: 'Reports', text: 'Revenue, expenses and profit by doctor, procedure and payment method, plus no-show rate and outstanding balances, with CSV export.' },
      {
        icon: 'userCog', title: 'Staff & permissions',
        text: 'Every team member gets a role and permissions, signs in with a PIN on every launch, and the app locks itself when left idle.',
        chips: [{ label: 'Admin' }, { label: 'Doctor' }, { label: 'Assistant' }, { label: 'Reception' }],
      },
      {
        icon: 'databaseBackup', title: 'Encrypted backup',
        text: 'Your whole clinic in one file you keep wherever you like, verified after saving and optionally password-protected, to restore or move to a new device.',
        chips: [{ label: 'One file' }, { label: 'AES-256' }, { label: 'Full restore' }],
      },
    ],
  },
  privacy: {
    eyebrow: 'Privacy first',
    title: "Your patients' data stays with you",
    lead: "No account, no cloud sync. Dentora keeps everything on the clinic's own device, and no clinic or patient data leaves it unless you choose to send it.",
    points: [
      { icon: 'wifiOff', title: 'Works without internet', text: 'See patients and write invoices even when the connection drops: Dentora never needs the internet to run.' },
      { icon: 'eyeOff', title: 'We never see your data', text: "We never collect or receive your clinic's or patients' data. No ads, no tracking, no usage statistics. Activating a key sends only the key and the device number, once." },
      { icon: 'lockKeyhole', title: 'Your backup, in your hands', text: 'A complete backup in one file, password-protected if you like, ready to move to a new device whenever you need.' },
    ],
  },
  shots: {
    eyebrow: 'Screenshots',
    title: 'See Dentora at work',
    lead: 'Real screens from the app, with the demo clinic it comes with, on a computer and a phone.',
    desktopLabel: 'On Windows',
    phoneLabel: 'On Android',
    windowTitle: 'Dentora — Dental chart',
    featured: {
      title: 'An interactive dental chart',
      text: 'FDI numbering, every surface, full history',
      alt: "Dentora's interactive dental chart on Windows: both jaws with FDI numbers, each surface's condition and the legend",
    },
    phones: [
      { key: 'dashboard', title: 'Your whole clinic on one screen', text: "Today's appointments, revenue and alerts", alt: "Dentora's dashboard on a phone: today's appointments and revenue" },
      { key: 'patient', title: 'Complete patient files, clear medical alerts', text: 'Allergies and conditions in view before any procedure', alt: 'A patient file in Dentora on a phone, with an allergy alert' },
      { key: 'treatments', title: 'Treatment plans, step by step', text: 'Turn finished work into an invoice in one tap', alt: "A treatment plan in Dentora on a phone, with each procedure's status and price" },
      { key: 'invoice', title: 'Polished invoices, ready to print', text: 'Part payments, balances and numbered receipts', alt: 'An invoice in Dentora on a phone, with the amount paid and the balance due' },
      { key: 'reports', title: 'Reports that explain your clinic', text: 'Revenue, expenses and profit by doctor and procedure', alt: 'The daily revenue and payment methods report in Dentora on a phone' },
    ],
  },
  steps: {
    eyebrow: 'How to start',
    title: 'Up and running in minutes',
    lead: "Try everything first, and pay only when you're convinced.",
    items: [
      {
        title: 'Download it and try it free for 7 days',
        text: 'Install Dentora on a Windows computer or an Android device. Every feature is open during the trial, with no sign-up, and the user guide walks you through every screen with pictures.',
        link: 'Open the user guide', linkTo: '/guide',
      },
      { title: 'Buy a licence and receive your key', text: 'Order on WhatsApp, and once you have paid you receive a 16‑character licence key. No need to send your device number.' },
      {
        title: 'Activate once, yours for life',
        text: 'Paste the key in Settings → Licence while the device is online, or activate it on our activation page. From then on Dentora works offline, and everything you entered during the trial stays.',
        link: 'Open the activation page',
      },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'One price. Yours for life.',
    lead: "No monthly subscription and no hidden fees. Pay once, and Dentora stays activated on your clinic's device for life.",
    label: 'No subscription',
    terms: 'One payment · one device · every feature',
    includedTitle: 'Included',
    included: ['Every feature, nothing held back', 'Unlimited patients, appointments and invoices', 'Arabic and English interface', 'Works offline, data on your device', 'Help on WhatsApp'],
    cta: 'Get a licence on WhatsApp',
    trial: 'Try it free for 7 days first',
    points: [
      { icon: 'infinity', title: "One payment, that's it", text: 'No subscription and no yearly renewal: the licence is yours for life.' },
      { icon: 'badgeCheck', title: 'Try before you pay', text: 'Seven days free with every feature, no sign-up.' },
      { icon: 'shieldCheck', title: 'Nothing is deleted after the trial', text: 'Your data stays available to view, print and back up until you activate.' },
    ],
  },
  download: {
    eyebrow: 'Download',
    title: 'Download Dentora and start your trial',
    lead: 'Seven days free with every feature. Install it, add your clinic, and see for yourself.',
    free: 'Free trial',
    android: {
      name: 'Android', for: 'For phones and tablets', req: 'Android 7.0 or later', btn: 'Download APK',
      meta: 'Version {version} · {size}',
      note: 'When you open the file, your phone may ask you to allow installing apps from this source.',
      requestText: "We'll send you the installer directly on WhatsApp.", requestBtn: 'Request the Android app',
    },
    windows: {
      name: 'Windows', for: 'For desktops and laptops', req: 'Windows 10 or 11 (64-bit)', btn: 'Download for Windows',
      meta: 'Installer with desktop and Start menu shortcuts',
      file: 'Installer · version {version} · {size}',
      note: 'Because the app is new, Windows may show a "Windows protected your PC" screen: click "More info", then "Run anyway".',
      requestText: "We'll send you the download link on WhatsApp.", requestBtn: 'Request Windows version',
    },
    reqTitle: 'Requirements',
    reqs: ['Windows 10 or 11, 64-bit', 'Android 7.0 or later', 'Internet only once, to activate your key'],
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions, answered',
    more: 'Still have a question?',
    moreLink: 'Message us on WhatsApp',
    emailPart: ', or e-mail {email},',
    compareLink: 'Dental clinic software comparison',
    learn: { text: 'Or learn the app at your own pace, in pictures or on video:', guide: 'User guide', videos: 'Video course' },
    items: [
      { q: 'What is the best dental clinic software that works offline?', a: 'It depends on your clinic, but to work without internet, choose software that keeps the data on your own computer or phone and needs no server. Dentora is built for that: it runs fully offline on Windows 10/11 and Android 7.0 or later, keeps every patient record on the device, and covers the dental chart, appointments, treatment plans, invoices and reports. Try every feature free for 7 days, or read our comparison of offline, cloud and server-based dental software: {compare}.' },
      { q: 'Does Dentora need the internet?', a: "No. Dentora works fully offline on your computer or phone. You need the internet to download it, and once to activate your licence key. If the clinic's device is not online, activate the key from any other device at {activate}, then paste the activation code you get into Dentora, offline." },
      { q: 'How do I activate Dentora after buying?', a: 'Once you have paid, you receive a 16‑character licence key. Open Dentora → Settings → Licence, paste the key and press “Activate” while the device is online. Or open {activate} on any device, enter your device number (shown on that same screen) and the key, then paste the activation code you get into Dentora. You only do this once.' },
      { q: 'Is there dental software with a one-time payment and no subscription?', a: 'Yes. Dentora costs {price}, paid once, for a lifetime licence on one device with every feature: no monthly or yearly subscription. Cloud dental software is usually sold as a monthly subscription. You can try Dentora free for 7 days before you pay.' },
      { q: 'Is there Arabic dental clinic software for Android and Windows?', a: 'Yes. Dentora has a complete Arabic interface, right-to-left with Arabic-aware search, and an English one you can switch to at any time. It runs without internet on Windows 10/11 (64-bit) computers and on Android 7.0 or later phones and tablets.' },
      { q: 'Is patient data private? Where is it stored?', a: "On your device only. There is no account and no cloud sync, so we never receive or see your clinic's or patients' data, and the app has no ads or tracking. Each team member signs in with their own PIN, and backups can be protected with a password (AES-256 encryption). The only contact with our server is activating your key, once, and it sends nothing but the key and the device number." },
      { q: 'How is Dentora different from cloud dental software?', a: "Cloud dental software runs in a web browser and keeps your data on the vendor's servers, so it needs an internet connection to work, and it is usually paid monthly. Dentora is installed on your own computer or phone, works without internet, keeps all data on that device, and is paid once. The trade-offs: there is no sync between devices, each device needs its own licence, and backups are in your hands (built in: one file, with an optional AES-256 password). Full comparison: {compare}." },
      { q: 'Can I use Dentora on several devices?', a: "Yes, with one licence per device: each licence activates one computer or phone, so every additional device needs its own licence. Because Dentora does not sync over the internet, each device keeps its own records and devices don't sync with each other." },
      { q: 'How do I back up my data?', a: 'In Settings → Backup & data, save a complete backup in one file wherever you like: a USB stick, Google Drive or your e-mail. You can protect it with a password (AES-256 encryption) and restore it on the same device or a new one.' },
      { q: 'Can I move my licence to another device?', a: 'A key works on one device: it is tied to the device number it was first activated on. Updating or reinstalling Dentora on the same device keeps the same device number, so your code keeps working, and your key gives you the same code again if you need it. A new device, or a reset Windows or phone, gets a new device number, so message us on WhatsApp about moving your licence. Always save a backup first: uninstalling the app on Android erases its data.' },
      { q: 'How much does Dentora cost?', a: '{price}, paid once, for a lifetime licence on one device with every feature and no subscription. Try it free for 7 days first; if the trial ends before you activate, nothing is deleted, and only adding and editing pause until you activate.' },
      { q: 'How do I get help?', a: "Message us on WhatsApp at {whatsapp}{email} and we'll answer your questions about installing, activating, backups and moving your clinic to a new device." },
      { q: 'Which languages does it support?', a: "Arabic and English, and you can switch at any time in Settings. The Arabic interface is fully right-to-left with Arabic-aware search, and you choose your clinic's currency and how Arabic month names are written." },
    ],
  },
  cta: {
    title: 'Ready to organise your clinic?',
    lead: 'Download Dentora today and try every feature free for 7 days. No sign-up, no internet required.',
    download: 'Download free',
    whatsapp: 'Chat on WhatsApp',
  },
  footer: {
    tagline: 'Complete dental clinic management that works offline on Windows and Android.',
    product: 'Product', activate: 'Activate a licence', legal: 'Legal', contact: 'Contact',
    privacy: 'Privacy policy', terms: 'Terms of use', rights: 'All rights reserved.', email: 'E-mail',
  },
  wa: {
    general: "Hello, I'd like to ask about Dentora, the dental clinic app.",
    buy: "Hello, I'd like to buy a lifetime Dentora licence.",
    android: "Hello, I'd like the Dentora installer for Android.",
  },
  mb: 'MB',
}

/** The words of every language with pages (site-lang.ts → SITE_LANGS); the languages without pages yet are absent. */
export const COPY: Partial<Record<SiteLang, Copy>> & Record<'ar' | 'en', Copy> = { ar, en }

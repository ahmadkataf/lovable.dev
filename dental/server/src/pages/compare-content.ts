// The comparison page's words (compare.ts renders them): three ways of running a dental clinic's software, compared
// on what a dentist asks first. Rules, as for the whole site: every statement about Dentora is true of the app
// (content.ts holds the same facts); about other software, the page says only what each vendor's own site says
// (the sources at the end, with the day they were read: COMPARE_DATE), never a competitor's price, and it compares
// approaches, not a ranking. Plain text only (compare.ts escapes everything); {price} is the seller's price.
import type { SiteLang } from '../site-lang'
import { TRANSLATIONS } from './i18n/index'
import { CURVE, DENTALLY, DENTRIX, EAGLESOFT, OPEN_DENTAL, SOURCES, type Example, type Source } from './compare-sources'

export type { Example, Source }

/** The day the vendors' pages were last read and this page last reviewed (shown on the page, and the sitemap's lastmod). */
export const COMPARE_DATE = '2026-10-18'

export interface CompareApproach {
  key: 'offline' | 'cloud' | 'server'
  /** The approach's name, the first cell of its row. */
  name: string
  /** Under the table: what the approach is, in two or three sentences. */
  summary: string
  /** One answer per column, in the order of `columns`. */
  cells: [string, string, string, string, string, string]
  /** Products of this kind, each linked to its vendor's site (the facts behind the row are in `sources`). */
  examples: Example[]
}

export interface CompareCopy {
  meta: { title: string; description: string; h1: string }
  /** What the page is about, for the Article's `about` (besides Dentora). */
  topic: string
  crumbs: { label: string; home: string; here: string }
  eyebrow: string
  /** The answer first: two or three sentences, then the details. */
  intro: string[]
  /** "Last reviewed: {date}". */
  reviewedLabel: string
  tableTitle: string
  tableLead: string
  approachCol: string
  columns: [string, string, string, string, string, string]
  approaches: CompareApproach[]
  examplesLabel: string
  /** Between example names: ", " or "، ". */
  listSep: string
  tableNote: string
  choose: { title: string; lead: string; items: string[] }
  fit: { title: string; forTitle: string; for: string[]; notTitle: string; not: string[] }
  faqTitle: string
  faq: { q: string; a: string }[]
  sources: { title: string; lead: string; items: Source[] }
}

const en: CompareCopy = {
  meta: {
    title: 'Best Offline Dental Clinic Software in 2026: Comparison | Dentora',
    description: 'Offline dental software vs cloud subscriptions vs server-based desktop systems: internet, where data lives, pricing model, platforms, Arabic and setup.',
    h1: 'Best Offline Dental Clinic Software in 2026: Comparison',
  },
  topic: 'Dental practice management software that works without internet',
  crumbs: { label: 'Breadcrumb', home: 'Dentora', here: 'Comparison' },
  eyebrow: 'Comparison',
  intro: [
    'If your clinic must keep working without internet, choose software that runs on your own device, not in the cloud. An offline app such as Dentora runs on a single Windows computer or Android device with no server, no account and no subscription. Cloud systems need a connection to work, and server-based desktop systems keep the database on a server in the clinic, though most of their vendors require or recommend the internet for updates and online services.',
    'Below, the three approaches side by side, with the vendors’ own pages as sources, a checklist for choosing, and an honest note on who Dentora is and is not for.',
  ],
  reviewedLabel: 'Last reviewed: {date}',
  tableTitle: 'Three ways to run dental clinic software',
  tableLead: 'What each approach means for working without internet, your data, the cost model, devices, the Arabic language and setup.',
  approachCol: 'Approach',
  columns: ['Works without internet', 'Where data is stored', 'Pricing model', 'Platforms', 'Arabic interface', 'Setup'],
  approaches: [
    {
      key: 'offline',
      name: 'Offline app on the device (Dentora)',
      summary: 'The whole program and its database live on one computer or phone. Nothing needs a server or an account, so the clinic keeps working when the connection drops, and the data never leaves the device unless you save a backup.',
      cells: [
        'Yes, fully. The internet is needed only once, to activate the licence.',
        'On the device itself (computer, phone or tablet).',
        '{price}, paid once, for a lifetime licence on one device. No subscription.',
        'Windows 10 and 11 (64-bit); Android 7.0 or later.',
        'Yes: a full right-to-left Arabic interface, and English.',
        'Install the app and start; no server, no account. A 7-day free trial with every feature.',
      ],
      examples: [{ name: 'Dentora', url: 'https://dentora.raqeem.dev/en' }],
    },
    {
      key: 'cloud',
      name: 'Cloud subscription (web-based)',
      summary: 'The software runs on the vendor’s servers and you use it in a web browser. The vendor hosts your data and runs the servers and updates, and staff can sign in from any computer, but the software needs an internet connection: Curve Dental lists it as a requirement, and Dentally suggests mobile data as a backup when the line drops.',
      cells: [
        'No: both need an internet connection to run the practice software.',
        'On the vendor’s servers (both name Amazon Web Services data centres).',
        'A monthly subscription (Curve Dental by quote; Dentally by plan and number of treatment rooms).',
        'A web browser on Windows or Mac; Curve Dental also lists Chromebooks, Dentally also iPads.',
        'Not mentioned on either vendor’s site, which serve English-speaking countries.',
        'Nothing to install for the main program; Curve Dental runs onboarding, data conversion and training.',
      ],
      examples: [CURVE, DENTALLY],
    },
    {
      key: 'server',
      name: 'Server-based desktop system',
      summary: 'A database server in the clinic, with the program installed on every workstation, so several computers share one patient list over the clinic’s network. The data stays in the practice, but someone has to install, maintain and back up the server, and the vendors differ on the internet: Open Dental calls a high-speed connection a requirement for service and updates, Dentrix recommends one for updates and services, and Patterson says Eaglesoft does not need it to function.',
      cells: [
        'Varies: Open Dental calls high-speed internet a requirement for service and updates, Dentrix recommends it for updates and services, Eaglesoft does not need it to run.',
        'On a server computer in the clinic, managed by the practice.',
        'Recurring: a monthly licence-and-support fee (Open Dental, free with limited support in developing countries), a licence with an annual support plan (Dentrix), a membership plan (Eaglesoft).',
        'Windows workstations and a Windows server (Open Dental’s server can also run Linux or macOS).',
        'Not offered: Open Dental provides Spanish and French translation files only; Dentrix and Eaglesoft mention English only.',
        'A server, a network and an installation on every workstation; the vendors recommend a networking or IT professional.',
      ],
      examples: [OPEN_DENTAL, DENTRIX, EAGLESOFT],
    },
  ],
  examplesLabel: 'Examples:',
  listSep: ', ',
  tableNote: 'This page compares approaches, not individual products. What it says about other software comes from each vendor’s own pages (listed under Sources) on the review date; vendors change their products, so check their sites before you decide.',
  choose: {
    title: 'How to choose',
    lead: 'Answer these before you compare features:',
    items: [
      'How reliable is the internet at your clinic? Cloud software needs it to work; an offline app does not; for a server-based system, ask the vendor what still needs it.',
      'How many computers need the same patient list at the same time? One device: an offline app is enough. Several workstations sharing records: you need a server-based or cloud system.',
      'Who looks after the data? On your device or server, you keep the backups (Dentora saves one file, optionally AES-256 encrypted). In the cloud, the vendor holds your data.',
      'Do you prefer one payment or a subscription? Compare the total over several years, not just the first month.',
      'Which language does your team work in? Check that the interface itself, not only the website, is in Arabic if you need it.',
      'Which devices do you have? Check the platforms: Windows only, a browser, or Android phones and tablets as well.',
      'Can you try it first? A free trial with real features shows more than any comparison page.',
    ],
  },
  fit: {
    title: 'Who Dentora is for, and who it is not for',
    forTitle: 'A good fit if you',
    for: [
      'run a solo practice or a small clinic that works on one main computer, tablet or phone',
      'have unreliable internet, or want the clinic to work with none at all',
      'want a full Arabic interface (right-to-left, with Arabic-aware search), or Arabic and English side by side',
      'prefer paying once ({price} per device) to a monthly subscription',
      'want patient records to stay on your own device, with no account and no cloud',
    ],
    notTitle: 'Not the right choice if you',
    not: [
      'need several computers to share one live patient list: each licence is for one device and devices do not sync',
      'need to open records from home or another branch over the internet: there is no cloud access',
      'need electronic insurance claims, online booking by patients, or direct connection to X-ray sensors: Dentora does not do these',
      'run a group of clinics that needs central reporting across branches',
    ],
  },
  faqTitle: 'Questions about offline dental software',
  faq: [
    {
      q: 'What is the best dental clinic software that works offline?',
      a: 'There is no single best for every clinic. For a clinic that works on one device, an offline app such as Dentora is the simplest: no server, no account, no subscription, data on the device, on Windows or Android. For several workstations sharing one patient list, a server-based desktop system keeps the database in the clinic; ask its vendor what still needs the internet. Cloud software is not the right choice if you need to work offline.',
    },
    {
      q: 'Does cloud dental software work without internet?',
      a: 'The cloud products listed here run in a web browser on the vendor’s servers and need an internet connection: Curve Dental lists it as a requirement, and Dentally suggests a mobile data connection as a backup when the line drops. If your connection is unreliable, choose software that runs on your own device.',
    },
    {
      q: 'Is offline dental software safe for patient data?',
      a: 'It keeps the data in your hands: nothing is sent to a vendor’s servers. Your part is to protect the device and keep backups. In Dentora each team member signs in with a PIN, the app locks itself when idle, and a backup is one file you can encrypt with AES-256 and keep on a USB stick or in your own cloud storage.',
    },
    {
      q: 'Is there dental software with no monthly subscription?',
      a: 'Yes. Dentora costs {price}, paid once, for a lifetime licence on one device, with every feature. The cloud and server-based examples on this page list recurring plans (subscriptions, support plans or memberships); Open Dental also lists a free tier with limited support for developing countries. Compare the total cost over several years.',
    },
    {
      q: 'Can several computers share Dentora’s data?',
      a: 'No. Each licence activates one device, and each device keeps its own records: there is no network database and no sync. A clinic that needs several workstations on one shared patient list should look at a server-based or cloud system.',
    },
    {
      q: 'Is there Arabic dental software that works offline?',
      a: 'Yes. Dentora has a complete right-to-left Arabic interface with Arabic-aware search, and an English one, and it works without internet on Windows 10/11 and Android 7.0 or later. You can try every feature free for 7 days, with no sign-up.',
    },
  ],
  sources: {
    title: 'Sources',
    lead: 'The statements about other software come from these pages on the vendors’ own sites, read on the review date above.',
    items: SOURCES,
  },
}

const ar: CompareCopy = {
  meta: {
    title: 'أفضل برامج إدارة عيادات الأسنان بدون إنترنت 2026: مقارنة | Dentora',
    description: 'مقارنة بين برنامج أسنان يعمل بدون إنترنت والاشتراكات السحابية والأنظمة المكتبية بخادم: الإنترنت، ومكان البيانات، والسعر، والأجهزة، والعربية، والتثبيت.',
    h1: 'أفضل برامج إدارة عيادات الأسنان بدون إنترنت 2026: مقارنة',
  },
  topic: 'برامج إدارة عيادات الأسنان التي تعمل بدون إنترنت',
  crumbs: { label: 'مسار الصفحة', home: 'Dentora', here: 'المقارنة' },
  eyebrow: 'مقارنة',
  intro: [
    'إذا كانت عيادتك تحتاج أن تعمل بدون إنترنت، فاختر برنامجاً يعمل على جهازك أنت، لا في السحابة. البرنامج الذي يعمل بدون إنترنت مثل Dentora يعمل على حاسوب ويندوز أو جهاز أندرويد واحد بلا خادم ولا حساب ولا اشتراك. أما البرامج السحابية فتحتاج اتصالاً لتعمل، والأنظمة المكتبية المعتمدة على خادم تحفظ قاعدة البيانات على خادم في العيادة، لكن معظم شركاتها تشترط الإنترنت أو توصي به للتحديثات والخدمات عبر الإنترنت.',
    'في الأسفل الطرق الثلاث جنباً إلى جنب، مع صفحات الشركات نفسها مصادرَ، وقائمة تساعدك على الاختيار، وكلمة صريحة عمّن يناسبه Dentora ومن لا يناسبه.',
  ],
  reviewedLabel: 'آخر مراجعة: {date}',
  tableTitle: 'ثلاث طرق لتشغيل برنامج عيادة الأسنان',
  tableLead: 'ماذا تعني كل طريقة للعمل بدون إنترنت، ولبياناتك، وطريقة الدفع، والأجهزة، واللغة العربية، والتثبيت.',
  approachCol: 'الطريقة',
  columns: ['يعمل بدون إنترنت', 'أين تُحفظ البيانات', 'طريقة الدفع', 'الأجهزة', 'واجهة عربية', 'التثبيت'],
  approaches: [
    {
      key: 'offline',
      name: 'برنامج يعمل على الجهاز بدون إنترنت (Dentora)',
      summary: 'البرنامج كله وقاعدة بياناته على حاسوب أو هاتف واحد. لا يحتاج خادماً ولا حساباً، فتبقى العيادة تعمل إذا انقطع الاتصال، ولا تغادر البيانات الجهاز إلا إذا حفظت نسخة احتياطية.',
      cells: [
        'نعم، بالكامل. يحتاج الإنترنت مرة واحدة فقط لتفعيل الترخيص.',
        'على الجهاز نفسه (حاسوب أو هاتف أو جهاز لوحي).',
        '{price} تُدفع مرة واحدة لترخيص مدى الحياة على جهاز واحد. بلا اشتراك.',
        'ويندوز 10 و11 (64-بت)، وأندرويد 7 أو أحدث.',
        'نعم: واجهة عربية كاملة من اليمين إلى اليسار، وإنجليزية.',
        'ثبّت البرنامج وابدأ، بلا خادم ولا حساب. تجربة مجانية 7 أيام بكل المزايا.',
      ],
      examples: [{ name: 'Dentora', url: 'https://dentora.raqeem.dev/' }],
    },
    {
      key: 'cloud',
      name: 'اشتراك سحابي (عبر المتصفح)',
      summary: 'يعمل البرنامج على خوادم الشركة وتستخدمه من متصفح الإنترنت. تستضيف الشركة بياناتك وتدير الخوادم والتحديثات، ويدخل الفريق من أي حاسوب، لكن البرنامج يحتاج اتصالاً بالإنترنت: Curve Dental تذكره شرطاً، وDentally تقترح بيانات الهاتف بديلاً إذا انقطع الخط.',
      cells: [
        'لا: كلاهما يحتاج اتصالاً بالإنترنت لتشغيل برنامج العيادة.',
        'على خوادم الشركة (كلتاهما تذكر مراكز بيانات Amazon Web Services).',
        'اشتراك شهري (Curve Dental بعرض سعر؛ Dentally حسب الباقة وعدد غرف العلاج).',
        'متصفح إنترنت على ويندوز أو ماك؛ وتذكر Curve Dental أجهزة Chromebook أيضاً، وDentally أجهزة iPad.',
        'لا يذكرها موقع أيٍّ من الشركتين، وكلتاهما تخدم دولاً ناطقة بالإنجليزية.',
        'لا شيء يُثبَّت للبرنامج الرئيسي؛ وتتولى Curve Dental الإعداد ونقل البيانات والتدريب.',
      ],
      examples: [CURVE, DENTALLY],
    },
    {
      key: 'server',
      name: 'نظام مكتبي يعتمد على خادم',
      summary: 'خادم قاعدة بيانات في العيادة، والبرنامج مثبّت على كل حاسوب، فتتشارك عدة حواسيب قائمة مرضى واحدة عبر شبكة العيادة. تبقى البيانات في العيادة، لكن أحداً ما يجب أن يثبّت الخادم ويصونه وينسخه احتياطياً، والشركات تختلف في الإنترنت: Open Dental تعدّ الاتصال السريع شرطاً للدعم والتحديثات، وDentrix توصي به للتحديثات والخدمات، وPatterson تقول إن Eaglesoft لا يحتاجه ليعمل.',
      cells: [
        'يختلف: Open Dental تعدّ الإنترنت السريع شرطاً للدعم والتحديثات، وDentrix توصي به للتحديثات والخدمات، وEaglesoft لا يحتاجه ليعمل.',
        'على حاسوب خادم في العيادة تديره العيادة.',
        'رسوم متكررة: رسم شهري للترخيص والدعم (Open Dental، ومجاني بدعم محدود في الدول النامية)، أو ترخيص مع خطة دعم سنوية (Dentrix)، أو باقة عضوية (Eaglesoft).',
        'حواسيب ويندوز وخادم ويندوز (ويمكن لخادم Open Dental أن يعمل أيضاً على لينكس أو macOS).',
        'غير متوفرة: Open Dental تقدّم ملفات ترجمة إسبانية وفرنسية فقط، وDentrix وEaglesoft لا تذكران إلا الإنجليزية.',
        'خادم وشبكة وتثبيت على كل حاسوب؛ والشركات توصي بفني شبكات أو مختص تقنية.',
      ],
      examples: [OPEN_DENTAL, DENTRIX, EAGLESOFT],
    },
  ],
  examplesLabel: 'أمثلة:',
  listSep: '، ',
  tableNote: 'تقارن هذه الصفحة بين طرق العمل، لا بين منتجات بعينها. وما تقوله عن البرامج الأخرى مأخوذ من صفحات كل شركة نفسها (في قسم المصادر) يوم المراجعة؛ والشركات تغيّر منتجاتها، فراجع مواقعها قبل أن تقرر.',
  choose: {
    title: 'كيف تختار',
    lead: 'أجب عن هذه الأسئلة قبل أن تقارن المزايا:',
    items: [
      'ما مدى ثبات الإنترنت في عيادتك؟ البرنامج السحابي يحتاجه ليعمل، والبرنامج الذي يعمل على الجهاز لا يحتاجه، أما النظام المعتمد على خادم فاسأل شركته عمّا يحتاج الإنترنت فيه.',
      'كم حاسوباً يحتاج قائمة المرضى نفسها في الوقت نفسه؟ جهاز واحد: يكفيك برنامج يعمل على الجهاز. عدة أجهزة تتشارك السجلات: تحتاج نظاماً بخادم أو نظاماً سحابياً.',
      'من يحفظ البيانات؟ على جهازك أو خادمك أنت من يحتفظ بالنسخ الاحتياطية (Dentora يحفظها في ملف واحد يمكن تشفيره بـ AES-256). وفي السحابة تحتفظ الشركة ببياناتك.',
      'هل تفضّل دفعة واحدة أم اشتراكاً؟ قارن التكلفة على عدة سنوات، لا الشهر الأول فقط.',
      'بأي لغة يعمل فريقك؟ تأكد أن واجهة البرنامج نفسها بالعربية إن احتجت ذلك، لا موقعه فقط.',
      'ما الأجهزة التي لديك؟ تحقق من الأنظمة: ويندوز فقط، أو متصفح، أو هواتف وأجهزة أندرويد اللوحية أيضاً.',
      'هل تستطيع التجربة أولاً؟ تجربة مجانية بمزايا حقيقية تُظهر أكثر من أي صفحة مقارنة.',
    ],
  },
  fit: {
    title: 'لمن يناسب Dentora، ولمن لا يناسب',
    forTitle: 'يناسبك إذا كنت',
    for: [
      'طبيباً في عيادة فردية أو عيادة صغيرة تعمل على حاسوب أو جهاز لوحي أو هاتف رئيسي واحد',
      'تعاني من إنترنت غير مستقر، أو تريد أن تعمل العيادة بلا إنترنت أصلاً',
      'تريد واجهة عربية كاملة (من اليمين إلى اليسار مع بحث يفهم العربية)، أو العربية والإنجليزية معاً',
      'تفضّل الدفع مرة واحدة ({price} لكل جهاز) على اشتراك شهري',
      'تريد أن تبقى سجلات المرضى على جهازك أنت، بلا حساب ولا سحابة',
    ],
    notTitle: 'ليس الخيار المناسب إذا كنت',
    not: [
      'تحتاج أن تتشارك عدة حواسيب قائمة مرضى واحدة مباشرة: كل ترخيص لجهاز واحد ولا تتزامن الأجهزة',
      'تحتاج فتح السجلات من البيت أو من فرع آخر عبر الإنترنت: لا يوجد وصول سحابي',
      'تحتاج مطالبات تأمين إلكترونية، أو حجزاً إلكترونياً يقوم به المرضى، أو ربطاً مباشراً بحسّاسات الأشعة: Dentora لا يقدّم ذلك',
      'تدير مجموعة عيادات تحتاج تقارير مركزية لكل الفروع',
    ],
  },
  faqTitle: 'أسئلة عن برامج الأسنان التي تعمل بدون إنترنت',
  faq: [
    {
      q: 'ما أفضل برنامج إدارة عيادة أسنان يعمل بدون إنترنت؟',
      a: 'لا يوجد برنامج واحد هو الأفضل لكل عيادة. للعيادة التي تعمل على جهاز واحد، البرنامج الذي يعمل على الجهاز مثل Dentora هو الأبسط: بلا خادم ولا حساب ولا اشتراك، والبيانات على الجهاز، على ويندوز أو أندرويد. ولعدة حواسيب تتشارك قائمة مرضى واحدة، يحفظ النظام المكتبي المعتمد على خادم قاعدة البيانات في العيادة، فاسأل شركته عمّا يحتاج الإنترنت فيه. أما البرنامج السحابي فليس الخيار المناسب إن كنت تحتاج العمل بدون إنترنت.',
    },
    {
      q: 'هل تعمل برامج الأسنان السحابية بدون إنترنت؟',
      a: 'المنتجات السحابية المذكورة هنا تعمل في متصفح الإنترنت على خوادم الشركة وتحتاج اتصالاً بالإنترنت: Curve Dental تذكره شرطاً، وDentally تقترح اتصال بيانات الهاتف بديلاً إذا انقطع الخط. إذا كان اتصالك غير مستقر فاختر برنامجاً يعمل على جهازك.',
    },
    {
      q: 'هل البرنامج الذي يعمل بدون إنترنت آمن لبيانات المرضى؟',
      a: 'يُبقي البيانات بين يديك: لا يُرسَل شيء إلى خوادم أي شركة. ودورك أن تحمي الجهاز وتحتفظ بنسخ احتياطية. في Dentora يدخل كل فرد من الفريق برمز PIN، ويُقفل البرنامج نفسه عند تركه، والنسخة الاحتياطية ملف واحد يمكنك تشفيره بـ AES-256 وحفظه على ذاكرة USB أو في مساحتك السحابية الخاصة.',
    },
    {
      q: 'هل يوجد برنامج أسنان بدون اشتراك شهري؟',
      a: 'نعم. سعر Dentora {price} تُدفع مرة واحدة لترخيص مدى الحياة على جهاز واحد بكل المزايا. أما الأمثلة السحابية والمعتمدة على خادم في هذه الصفحة فتذكر رسوماً متكررة (اشتراكات أو خطط دعم أو عضويات)، وتذكر Open Dental أيضاً فئة مجانية بدعم محدود للدول النامية. قارن التكلفة الكاملة على عدة سنوات.',
    },
    {
      q: 'هل تستطيع عدة حواسيب أن تتشارك بيانات Dentora؟',
      a: 'لا. كل ترخيص يفعّل جهازاً واحداً، وكل جهاز يحتفظ بسجلاته: لا توجد قاعدة بيانات على الشبكة ولا مزامنة. والعيادة التي تحتاج عدة أجهزة على قائمة مرضى مشتركة واحدة يناسبها نظام بخادم أو نظام سحابي.',
    },
    {
      q: 'هل يوجد برنامج أسنان عربي يعمل بدون إنترنت؟',
      a: 'نعم. Dentora له واجهة عربية كاملة من اليمين إلى اليسار مع بحث يفهم العربية، وواجهة إنجليزية، ويعمل بدون إنترنت على ويندوز 10 و11 وأندرويد 7 أو أحدث. جرّب كل المزايا مجاناً 7 أيام، دون تسجيل.',
    },
  ],
  sources: {
    title: 'المصادر',
    lead: 'ما تقوله الصفحة عن البرامج الأخرى مأخوذ من هذه الصفحات على مواقع الشركات نفسها، كما قُرئت في تاريخ المراجعة أعلاه.',
    items: SOURCES,
  },
}

export const COMPARE: Partial<Record<SiteLang, CompareCopy>> & Record<'ar' | 'en', CompareCopy> = {
  ar, en,
  ...Object.fromEntries(Object.entries(TRANSLATIONS).map(([l, t]) => [l, t.compare])),
}

// The chapters of the video course, in the order of the user guide (server/guide/topics, one chapter per topic).
// A chapter's slug is also its chapter script (store/scripts/video/chapters/<slug>.mjs) and its file names. Titles
// and summaries are written for dentists, assistants and receptionists, and only claim what the app does.
import type { VideoChapter } from './types'

export const CHAPTERS: readonly VideoChapter[] = [
  {
    slug: 'getting-started', order: 1, guide: 'getting-started',
    title: { ar: 'البداية: التثبيت والإعداد الأول', en: 'Getting started: install and first setup' },
    summary: {
      ar: 'تثبيت Dentora على ويندوز وأندرويد، وإعداد بيانات العيادة في أول تشغيل، وأولى خطواتك داخل البرنامج.',
      en: 'Install Dentora on Windows and Android, set up your clinic on the first run, and take your first steps in the app.',
    },
  },
  {
    slug: 'interface', order: 2, guide: 'interface',
    title: { ar: 'واجهة البرنامج والتنقّل', en: 'The interface and navigation' },
    summary: {
      ar: 'القائمة الجانبية، والبحث السريع، وزر الإضافة السريعة، والتنبيهات، وتبديل اللغة، وكيف تبدو الشاشات على الهاتف.',
      en: 'The side menu, quick search, the quick-add button, notifications, switching the language, and how the screens look on a phone.',
    },
  },
  {
    slug: 'dashboard', order: 3, guide: 'dashboard',
    title: { ar: 'الصفحة الرئيسية: يومك في نظرة', en: 'Dashboard: your day at a glance' },
    summary: {
      ar: 'مواعيد اليوم، والمرضى الجدد، والإيرادات، والتنبيهات التي تحتاج انتباهك، كلها في شاشة واحدة.',
      en: 'Today’s appointments, new patients, revenue and the alerts that need your attention, all on one screen.',
    },
  },
  {
    slug: 'patients', order: 4, guide: 'patients',
    title: { ar: 'المرضى: الملفات والسجل الطبي', en: 'Patients: files and medical history' },
    summary: {
      ar: 'إضافة مريض جديد، والبحث في الملفات، وتسجيل التاريخ الطبي والتحذيرات، وإرفاق الصور والملفات، ومراسلة المريض عبر واتساب.',
      en: 'Add a new patient, search the files, record medical history and alerts, attach images and documents, and message a patient on WhatsApp.',
    },
  },
  {
    slug: 'chart', order: 5, guide: 'chart',
    title: { ar: 'مخطط الأسنان', en: 'The dental chart' },
    summary: {
      ar: 'تسجيل حالة كل سنّ على المخطط التفاعلي، وتوثيق التشخيص، ومراجعة سجل المخطط من الأحدث إلى الأقدم.',
      en: 'Record the condition of each tooth on the interactive chart, document findings, and review the chart’s history from newest to oldest.',
    },
  },
  {
    slug: 'appointments', order: 6, guide: 'appointments',
    title: { ar: 'المواعيد والجدول', en: 'Appointments and the schedule' },
    summary: {
      ar: 'حجز المواعيد في عرض اليوم أو الأسبوع، ومتابعة حالة كل موعد، وإرسال تذكير للمريض عبر واتساب.',
      en: 'Book appointments in the day or week view, follow the status of each one, and send the patient a WhatsApp reminder.',
    },
  },
  {
    slug: 'treatments', order: 7, guide: 'treatments',
    title: { ar: 'العلاجات وخطط العلاج', en: 'Treatments and treatment plans' },
    summary: {
      ar: 'قائمة الإجراءات وأسعارها، وإعداد خطة علاج للمريض، وتسجيل ما أُنجز في كل جلسة.',
      en: 'The procedures list and prices, building a treatment plan for a patient, and recording the work done at each visit.',
    },
  },
  {
    slug: 'billing', order: 8, guide: 'billing',
    title: { ar: 'الفواتير والمدفوعات', en: 'Invoices and payments' },
    summary: {
      ar: 'إصدار الفاتورة، وتسجيل الدفعات، وطباعة الإيصال أو إرساله عبر واتساب، وكشف حساب المريض.',
      en: 'Issue an invoice, record payments, print a receipt or send it on WhatsApp, and the patient’s account statement.',
    },
  },
  {
    slug: 'prescriptions', order: 9, guide: 'prescriptions',
    title: { ar: 'الوصفات الطبية', en: 'Prescriptions' },
    summary: {
      ar: 'كتابة وصفة باختيار الأدوية من القائمة بنقرة واحدة، مع الجرعة والمدة، وطباعتها بترويسة العيادة.',
      en: 'Write a prescription by picking medicines from the list with one click, dosage and duration included, and print it with the clinic’s letterhead.',
    },
  },
  {
    slug: 'lab', order: 10, guide: 'lab',
    title: { ar: 'المخبر وطلبات التركيبات', en: 'Lab work' },
    summary: {
      ar: 'تسجيل طلب للمخبر، ومتابعة حالته من الإرسال حتى الاستلام، وربطه بالمريض وبالعلاج.',
      en: 'Record a lab order, follow it from sending until it comes back, and link it to the patient and the treatment.',
    },
  },
  {
    slug: 'inventory', order: 11, guide: 'inventory',
    title: { ar: 'المخزون والمستلزمات', en: 'Inventory and supplies' },
    summary: {
      ar: 'إضافة المواد، وتسجيل الكميات الداخلة والمستهلكة، وتنبيهات النقص واقتراب انتهاء الصلاحية.',
      en: 'Add materials, record what comes in and what is used, and get low-stock and expiry alerts.',
    },
  },
  {
    slug: 'expenses', order: 12, guide: 'expenses',
    title: { ar: 'المصروفات', en: 'Expenses' },
    summary: {
      ar: 'تسجيل مصروفات العيادة بتصنيفاتها، ومراجعتها شهراً بشهر لتعرف أين تذهب الأموال.',
      en: 'Record the clinic’s expenses by category and review them month by month, so you know where the money goes.',
    },
  },
  {
    slug: 'reports', order: 13, guide: 'reports',
    title: { ar: 'التقارير والإحصاءات', en: 'Reports and statistics' },
    summary: {
      ar: 'الإيرادات والمصروفات وصافي الربح، وأداء الأطباء، والإجراءات الأكثر تنفيذاً، والمرضى الأعلى إنفاقاً.',
      en: 'Revenue, expenses and net profit, doctor performance, the most performed procedures, and the patients who spend the most.',
    },
  },
  {
    slug: 'settings', order: 14, guide: 'settings',
    title: { ar: 'الإعدادات', en: 'Settings' },
    summary: {
      ar: 'بيانات العيادة وشعارها، والعملة والضريبة وترقيم الفواتير، واللغة والخط والمظهر.',
      en: 'Clinic details and logo, currency, tax and invoice numbering, language, font and appearance.',
    },
  },
  {
    slug: 'staff', order: 15, guide: 'staff',
    title: { ar: 'الفريق والصلاحيات', en: 'Staff and permissions' },
    summary: {
      ar: 'إضافة أعضاء الفريق وأدوارهم، وتسجيل الدخول برمز الدخول، والقفل التلقائي، وماذا تفعل عند نسيان الرمز.',
      en: 'Add team members and their roles, sign in with a PIN, auto-lock, and what to do when a PIN is forgotten.',
    },
  },
  {
    slug: 'backup', order: 16, guide: 'backup',
    title: { ar: 'النسخ الاحتياطي والاستعادة', en: 'Backup and restore' },
    summary: {
      ar: 'حفظ نسخة احتياطية من بيانات العيادة، محمية بكلمة مرور إن شئت، واستعادتها، ونقل البرنامج إلى جهاز جديد.',
      en: 'Save a backup of the clinic’s data, protected with a password if you wish, restore it, and move Dentora to a new device.',
    },
  },
  {
    slug: 'licence', order: 17, guide: 'licence',
    title: { ar: 'تفعيل الترخيص', en: 'Activating your licence' },
    summary: {
      ar: 'كيف تنتقل من النسخة التجريبية إلى نسخة مفعّلة، وما الذي تحتاجه من البائع، وأين تُدخل بيانات التفعيل في البرنامج.',
      en: 'How to go from the trial to an activated copy, what you need from the seller, and where to enter the activation details in the app.',
    },
  },
]

/** The chapter of a URL slug, or undefined. */
export const chapterBySlug = (slug: string): VideoChapter | undefined => CHAPTERS.find(c => c.slug === slug)

// Vocabulary for the demo clinic: Levantine names (first names by gender, family names), places, medical history,
// tags, insurers, referral sources. Arabic first; the Latin spelling is only used to build e-mail addresses.

/** [Arabic, Latin, group] — group: m = mostly Muslim families, c = mostly Christian families, n = either. */
export type NameEntry = readonly [ar: string, en: string, group: 'm' | 'c' | 'n']

export const MALE_NAMES: NameEntry[] = [
  ['محمد', 'mohammad', 'm'], ['أحمد', 'ahmad', 'm'], ['خالد', 'khaled', 'm'], ['سامر', 'samer', 'n'], ['رامي', 'rami', 'n'], ['فادي', 'fadi', 'n'],
  ['ماهر', 'maher', 'n'], ['باسل', 'basel', 'n'], ['وسيم', 'wassim', 'n'], ['طارق', 'tarek', 'm'], ['علاء', 'alaa', 'm'], ['نزار', 'nizar', 'n'],
  ['حسام', 'hussam', 'm'], ['عمر', 'omar', 'm'], ['يوسف', 'youssef', 'n'], ['إياد', 'iyad', 'n'], ['زياد', 'ziad', 'n'], ['مازن', 'mazen', 'n'],
  ['جورج', 'george', 'c'], ['إلياس', 'elias', 'c'], ['شادي', 'shadi', 'n'], ['غسان', 'ghassan', 'n'], ['عماد', 'imad', 'n'], ['هاني', 'hani', 'n'],
  ['كريم', 'karim', 'n'], ['مجد', 'majd', 'n'], ['نبيل', 'nabil', 'n'], ['سليم', 'salim', 'n'], ['أنس', 'anas', 'm'], ['حمزة', 'hamza', 'm'],
  ['ليث', 'laith', 'm'], ['ميشيل', 'michel', 'c'], ['عصام', 'issam', 'n'], ['منذر', 'munzer', 'm'], ['فراس', 'firas', 'n'], ['جهاد', 'jihad', 'm'],
]
export const FEMALE_NAMES: NameEntry[] = [
  ['لينا', 'lina', 'n'], ['رنا', 'rana', 'n'], ['ريم', 'reem', 'n'], ['هبة', 'hiba', 'm'], ['سلمى', 'salma', 'n'], ['نور', 'nour', 'n'],
  ['ديما', 'dima', 'n'], ['رشا', 'rasha', 'n'], ['لمى', 'lama', 'n'], ['سارة', 'sara', 'n'], ['مريم', 'mariam', 'n'], ['ياسمين', 'yasmine', 'n'],
  ['هالة', 'hala', 'n'], ['رولا', 'rola', 'n'], ['منى', 'mona', 'n'], ['سوزان', 'suzan', 'c'], ['غادة', 'ghada', 'n'], ['ميس', 'mais', 'n'],
  ['روان', 'rawan', 'n'], ['نسرين', 'nisreen', 'n'], ['فرح', 'farah', 'n'], ['سهى', 'suha', 'n'], ['عبير', 'abeer', 'n'], ['ريتا', 'rita', 'c'],
  ['كندة', 'kinda', 'n'], ['رهف', 'rahaf', 'n'], ['ميرنا', 'mirna', 'c'], ['آلاء', 'alaa', 'm'], ['بشرى', 'boushra', 'm'], ['دعاء', 'duaa', 'm'],
]
/** Children's names (the generation that is 4–12 now). */
export const BOY_NAMES: NameEntry[] = [
  ['تيم', 'taim', 'n'], ['آدم', 'adam', 'n'], ['جاد', 'jad', 'n'], ['يامن', 'yamen', 'm'], ['زين', 'zein', 'n'], ['كرم', 'karam', 'n'], ['عمر', 'omar', 'm'], ['شربل', 'charbel', 'c'],
]
export const GIRL_NAMES: NameEntry[] = [
  ['جنى', 'jana', 'n'], ['تالا', 'tala', 'n'], ['لين', 'leen', 'n'], ['ماسة', 'masa', 'n'], ['شام', 'sham', 'n'], ['ليا', 'lia', 'n'], ['جوري', 'jouri', 'n'], ['يارا', 'yara', 'n'],
]
export const FAMILY_NAMES: NameEntry[] = [
  ['الخطيب', 'khatib', 'm'], ['الحلبي', 'halabi', 'n'], ['الشامي', 'shami', 'n'], ['النجار', 'najjar', 'n'], ['العلي', 'ali', 'm'], ['الأحمد', 'ahmad', 'm'],
  ['قباني', 'kabbani', 'm'], ['العطار', 'attar', 'n'], ['السيد', 'sayed', 'm'], ['الحمصي', 'homsi', 'n'], ['الزعبي', 'zoubi', 'm'], ['المصري', 'masri', 'n'],
  ['حمدان', 'hamdan', 'm'], ['خوري', 'khoury', 'c'], ['صبّاغ', 'sabbagh', 'n'], ['الدبّاغ', 'dabbagh', 'm'], ['جبّور', 'jabbour', 'c'], ['عيسى', 'issa', 'c'],
  ['نصر', 'nasr', 'n'], ['الحسن', 'hassan', 'm'], ['شهاب', 'shehab', 'm'], ['درويش', 'darwish', 'n'], ['سلّوم', 'salloum', 'c'], ['يازجي', 'yazigi', 'c'],
  ['مراد', 'murad', 'n'], ['الطويل', 'taweel', 'n'], ['البيطار', 'bitar', 'n'], ['الساعاتي', 'saati', 'm'], ['كيالي', 'kayyali', 'm'], ['العظمة', 'azmeh', 'm'],
  ['مارديني', 'mardini', 'm'], ['الرفاعي', 'rifai', 'm'], ['حنّا', 'hanna', 'c'], ['معلولي', 'maalouli', 'c'], ['الأتاسي', 'atassi', 'm'], ['ديب', 'deeb', 'n'],
]

/** City → neighbourhoods; the clinic is in Damascus, so most patients are too. */
export const PLACES: { city: string; weight: number; areas: string[]; streets: string[] }[] = [
  { city: 'دمشق', weight: 70, areas: ['المزة', 'المالكي', 'أبو رمانة', 'كفرسوسة', 'الشعلان', 'باب توما', 'القصاع', 'ركن الدين', 'المهاجرين', 'الميدان', 'دمر', 'برزة', 'مشروع دمر', 'التجارة', 'الصالحية', 'المزة فيلات غربية'],
    streets: ['شارع الجلاء', 'أوتوستراد المزة', 'شارع بغداد', 'شارع الثورة', 'شارع العابد', 'شارع 29 أيار', 'شارع الحمراء', 'جادة الشيخ سعد'] },
  { city: 'ريف دمشق', weight: 10, areas: ['جرمانا', 'صحنايا', 'قدسيا', 'التل', 'الكسوة', 'ضاحية الأسد'], streets: ['الشارع العام', 'ساحة البلدية'] },
  { city: 'حلب', weight: 7, areas: ['الفرقان', 'الشهباء', 'السبيل', 'العزيزية', 'الجميلية', 'حلب الجديدة', 'الموكامبو'], streets: ['شارع النيل', 'شارع فيصل'] },
  { city: 'حمص', weight: 6, areas: ['الإنشاءات', 'الحمرا', 'الغوطة', 'الوعر', 'عكرمة', 'الزهراء'], streets: ['شارع الحضارة', 'شارع الدبلان'] },
  { city: 'اللاذقية', weight: 7, areas: ['الزراعة', 'الأمريكان', 'الشيخ ضاهر', 'مشروع الصليبة', 'الرمل الشمالي', 'الكورنيش الجنوبي'], streets: ['شارع بغداد', 'شارع 8 آذار'] },
]

export const OCCUPATIONS_MALE = ['مهندس مدني', 'مدرّس', 'محاسب', 'طالب جامعي', 'تاجر', 'موظف حكومي', 'محامٍ', 'صيدلاني', 'سائق', 'مبرمج', 'متقاعد', 'صاحب محل', 'مهندس برمجيات', 'طبيب بيطري', 'فني كهرباء']
export const OCCUPATIONS_FEMALE = ['مهندسة معمارية', 'مدرّسة', 'محاسبة', 'طالبة جامعية', 'موظفة', 'محامية', 'صيدلانية', 'ربة منزل', 'مصممة غرافيك', 'ممرضة', 'متقاعدة', 'موظفة بنك', 'مترجمة']

export const ALLERGIES = ['البنسلين', 'الأسبرين', 'اللاتكس', 'السلفوناميدات', 'الإيبوبروفين', 'الكودئين']

/** Chronic disease → what such patients usually take, and a note the dentist must see. */
export const CONDITIONS: { disease: string; meds: string[]; note?: string; minAge: number }[] = [
  { disease: 'السكري', meds: ['ميتفورمين 850 ملغ مرتين يومياً'], note: 'سكري من النمط الثاني مضبوط — يُفضّل المواعيد الصباحية بعد الفطور', minAge: 35 },
  { disease: 'ارتفاع ضغط الدم', meds: ['أملوديبين 5 ملغ يومياً'], note: 'يُقاس الضغط قبل الإجراءات الجراحية', minAge: 35 },
  { disease: 'أمراض القلب', meds: ['أسبرين 81 ملغ يومياً', 'بيسوبرولول 5 ملغ'], note: 'يتناول مميّع دم خفيف — يُنسّق مع طبيب القلب قبل القلع', minAge: 45 },
  { disease: 'رجفان أذيني', meds: ['وارفارين 5 ملغ'], note: 'يتناول الوارفارين — يُطلب تحليل INR قبل أي إجراء جراحي', minAge: 55 },
  { disease: 'الربو', meds: ['بخاخ سالبوتامول عند اللزوم'], note: 'يحضر بخاخه معه إلى المواعيد', minAge: 6 },
  { disease: 'قصور الغدة الدرقية', meds: ['ليفوثيروكسين 50 مكغ صباحاً'], minAge: 20 },
  { disease: 'هشاشة العظام', meds: ['أليندرونات 70 ملغ أسبوعياً'], note: 'يتناول البيسفوسفونات — حذر من القلع والزرع (خطر تنخر الفك)', minAge: 55 },
  { disease: 'فقر الدم', meds: ['حديد 100 ملغ يومياً'], minAge: 14 },
]

export const BLOOD_TYPES = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-'] as const

export const INSURERS = ['آروب سوريا للتأمين', 'المتحدة للتأمين', 'الثقة السورية للتأمين', 'العقيلة للتأمين التكافلي']

export const REFERRALS = ['صديق', 'أحد الأقارب', 'إنستغرام', 'فيسبوك', 'خرائط Google', 'لافتة العيادة', 'طبيب الأسرة', 'زميل في العمل']

export const ARABIC_MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول']

/** The two doctors created when the clinic has fewer than two. */
export const DEMO_DOCTORS = [
  { name: 'د. ليلى حداد', specialty: 'تقويم الأسنان', color: '#7C3AED', phone: '0933 214 587', email: 'laila.haddad@dentora.app', focus: 'ortho' as const },
  { name: 'د. سامر عبود', specialty: 'جراحة الفم والزرع', color: '#2563EB', phone: '0944 778 120', email: 'samer.abboud@dentora.app', focus: 'surgery' as const },
]

export const LABS = {
  prosth: 'مخبر الدقة للتعويضات السنية',
  digital: 'مخبر الشام الرقمي (CAD/CAM)',
  ortho: 'مخبر النخبة لأجهزة التقويم',
}

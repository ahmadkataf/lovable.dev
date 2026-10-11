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

/** English for the demo clinic of a clinic working in English (exact Arabic phrase → English). */
export const EN: Record<string, string> = {
  // occupations
  'مهندس مدني': 'Civil engineer', 'مدرّس': 'Teacher', 'محاسب': 'Accountant', 'طالب جامعي': 'University student', 'تاجر': 'Merchant', 'موظف حكومي': 'Civil servant',
  'محامٍ': 'Lawyer', 'صيدلاني': 'Pharmacist', 'سائق': 'Driver', 'مبرمج': 'Programmer', 'متقاعد': 'Retired', 'صاحب محل': 'Shop owner', 'مهندس برمجيات': 'Software engineer',
  'طبيب بيطري': 'Veterinarian', 'فني كهرباء': 'Electrician', 'مهندسة معمارية': 'Architect', 'مدرّسة': 'Teacher', 'محاسبة': 'Accountant', 'طالبة جامعية': 'University student',
  'موظفة': 'Office worker', 'محامية': 'Lawyer', 'صيدلانية': 'Pharmacist', 'ربة منزل': 'Homemaker', 'مصممة غرافيك': 'Graphic designer', 'ممرضة': 'Nurse', 'متقاعدة': 'Retired',
  'موظفة بنك': 'Bank employee', 'مترجمة': 'Translator', 'طالبة': 'Student', 'طالب': 'Student',
  // allergies, conditions, medicines, notes
  'البنسلين': 'Penicillin', 'الأسبرين': 'Aspirin', 'اللاتكس': 'Latex', 'السلفوناميدات': 'Sulfonamides', 'الإيبوبروفين': 'Ibuprofen', 'الكودئين': 'Codeine',
  'السكري': 'Diabetes', 'ارتفاع ضغط الدم': 'High blood pressure', 'أمراض القلب': 'Heart disease', 'رجفان أذيني': 'Atrial fibrillation', 'الربو': 'Asthma',
  'قصور الغدة الدرقية': 'Hypothyroidism', 'هشاشة العظام': 'Osteoporosis', 'فقر الدم': 'Anaemia',
  'ميتفورمين 850 ملغ مرتين يومياً': 'Metformin 850 mg twice daily', 'أملوديبين 5 ملغ يومياً': 'Amlodipine 5 mg daily', 'أسبرين 81 ملغ يومياً': 'Aspirin 81 mg daily',
  'بيسوبرولول 5 ملغ': 'Bisoprolol 5 mg', 'وارفارين 5 ملغ': 'Warfarin 5 mg', 'بخاخ سالبوتامول عند اللزوم': 'Salbutamol inhaler as needed',
  'ليفوثيروكسين 50 مكغ صباحاً': 'Levothyroxine 50 mcg in the morning', 'أليندرونات 70 ملغ أسبوعياً': 'Alendronate 70 mg weekly', 'حديد 100 ملغ يومياً': 'Iron 100 mg daily',
  'سكري من النمط الثاني مضبوط — يُفضّل المواعيد الصباحية بعد الفطور': 'Controlled type 2 diabetes — morning appointments after breakfast preferred',
  'يُقاس الضغط قبل الإجراءات الجراحية': 'Blood pressure checked before surgical procedures',
  'يتناول مميّع دم خفيف — يُنسّق مع طبيب القلب قبل القلع': 'On a mild blood thinner — coordinate with the cardiologist before extractions',
  'يتناول الوارفارين — يُطلب تحليل INR قبل أي إجراء جراحي': 'On warfarin — INR test required before any surgical procedure',
  'يحضر بخاخه معه إلى المواعيد': 'Brings the inhaler to appointments',
  'يتناول البيسفوسفونات — حذر من القلع والزرع (خطر تنخر الفك)': 'On bisphosphonates — caution with extractions and implants (risk of jaw osteonecrosis)',
  'حامل في الشهر الخامس — تُؤجَّل الصور الشعاعية والإجراءات غير الضرورية إلى ما بعد الولادة': 'Five months pregnant — X-rays and non-urgent work postponed until after the birth',
  // tags, patient notes
  'تأمين': 'Insurance', 'أطفال': 'Children', 'حساس للألم': 'Pain-sensitive', 'قلق من العلاج': 'Anxious patient', 'متابعة دورية': 'Regular recall', 'تقويم': 'Orthodontics',
  'يفضّل المواعيد المسائية': 'Prefers evening appointments', 'تفضّل المواعيد المسائية': 'Prefers evening appointments',
  'يفضّل التواصل عبر واتساب': 'Prefers WhatsApp', 'تفضّل التواصل عبر واتساب': 'Prefers WhatsApp',
  'يرجى الاتصال قبل الموعد بيوم': 'Please call one day before the appointment',
  'يأتي من خارج المدينة — تجميع الجلسات قدر الإمكان': 'Comes from out of town — group visits where possible',
  'تأتي من خارج المدينة — تجميع الجلسات قدر الإمكان': 'Comes from out of town — group visits where possible',
  // referrals, insurers
  'صديق': 'A friend', 'أحد الأقارب': 'A relative', 'إنستغرام': 'Instagram', 'فيسبوك': 'Facebook', 'خرائط Google': 'Google Maps', 'لافتة العيادة': 'The clinic sign',
  'طبيب الأسرة': 'Family doctor', 'زميل في العمل': 'A colleague',
  'آروب سوريا للتأمين': 'Arope Syria Insurance', 'المتحدة للتأمين': 'United Insurance', 'الثقة السورية للتأمين': 'Syrian Trust Insurance', 'العقيلة للتأمين التكافلي': 'Al-Aqeelah Takaful Insurance',
  // places
  'دمشق': 'Damascus', 'ريف دمشق': 'Rural Damascus', 'حلب': 'Aleppo', 'حمص': 'Homs', 'اللاذقية': 'Latakia',
  'المزة': 'Mezzeh', 'المالكي': 'Malki', 'أبو رمانة': 'Abu Rummaneh', 'كفرسوسة': 'Kafr Sousa', 'الشعلان': 'Shaalan', 'باب توما': 'Bab Touma', 'القصاع': 'Qassaa',
  'ركن الدين': 'Rukn al-Din', 'المهاجرين': 'Muhajirin', 'الميدان': 'Midan', 'دمر': 'Dummar', 'برزة': 'Barzeh', 'مشروع دمر': 'Mashrou Dummar', 'التجارة': 'Tijara',
  'الصالحية': 'Salihiyeh', 'المزة فيلات غربية': 'West Mezzeh Villas', 'شارع الجلاء': 'Al-Jalaa St', 'أوتوستراد المزة': 'Mezzeh Highway', 'شارع بغداد': 'Baghdad St',
  'شارع الثورة': 'Al-Thawra St', 'شارع العابد': 'Al-Abed St', 'شارع 29 أيار': '29 May St', 'شارع الحمراء': 'Al-Hamra St', 'جادة الشيخ سعد': 'Sheikh Saad Ave',
  'جرمانا': 'Jaramana', 'صحنايا': 'Sahnaya', 'قدسيا': 'Qudsaya', 'التل': 'Al-Tall', 'الكسوة': 'Al-Kiswah', 'ضاحية الأسد': 'Dahiyat al-Assad', 'الشارع العام': 'Main St',
  'ساحة البلدية': 'Municipality Sq', 'الفرقان': 'Furqan', 'الشهباء': 'Shahba', 'السبيل': 'Sabil', 'العزيزية': 'Aziziyeh', 'الجميلية': 'Jamiliyeh', 'حلب الجديدة': 'New Aleppo',
  'الموكامبو': 'Mocambo', 'شارع النيل': 'Al-Nil St', 'شارع فيصل': 'Faisal St', 'الإنشاءات': 'Inshaat', 'الحمرا': 'Hamra', 'الغوطة': 'Ghouta', 'الوعر': 'Waer', 'عكرمة': 'Akrama',
  'الزهراء': 'Zahraa', 'شارع الحضارة': 'Al-Hadara St', 'شارع الدبلان': 'Al-Dablan St', 'الزراعة': 'Ziraa', 'الأمريكان': 'Al-Amrikan', 'الشيخ ضاهر': 'Sheikh Daher',
  'مشروع الصليبة': 'Mashrou al-Sleibeh', 'الرمل الشمالي': 'North Raml', 'الكورنيش الجنوبي': 'South Corniche', 'شارع 8 آذار': '8 March St',
  // labs, suppliers, vendors
  'مخبر الدقة للتعويضات السنية': 'Al-Diqqa Dental Prosthetics Lab', 'مخبر الشام الرقمي (CAD/CAM)': 'Al-Sham Digital Lab (CAD/CAM)', 'مخبر النخبة لأجهزة التقويم': 'Al-Nukhba Orthodontic Lab',
  'مستودع الشفاء للمواد السنية': 'Al-Shifa Dental Supplies', 'شركة الرازي للتجهيزات الطبية': 'Al-Razi Medical Equipment', 'مكتبة النور': 'Al-Nour Stationery',
  'مالك العقار': 'The landlord', 'ورشة أبو خليل للتجهيزات': 'Abu Khalil Equipment Workshop', 'مطبعة الفجر': 'Al-Fajr Printing',
  // fixed texts of lab orders, payments, expenses, stock
  'بانتظار أخذ الطبعة': 'Awaiting the impression', 'جاهز للإرسال مع مندوب المخبر': 'Ready for the lab courier',
  'اللون غير مطابق — أُعيد إلى المخبر لتعديل اللون': 'Shade mismatch — returned to the lab for a shade correction', 'أُلغي الطلب قبل البدء بالعمل': 'Cancelled before work started',
  'أُلغيت لخطأ في البنود (صورة لم تُجرَ) وأُعيد إصدارها': 'Cancelled for a wrong line (an X-ray not taken) and reissued', 'دفعة مقدمة على حساب العلاج': 'Advance payment towards treatment',
  'تسديد المتبقي من الفاتورة': 'Settling the invoice balance', 'خصم VIP ‏10%': 'VIP discount 10%', 'قُلع سابقاً': 'Extracted earlier',
  'طلب تأجيل الموعد': 'Asked to postpone', 'طلبت تأجيل الموعد': 'Asked to postpone', 'ظرف طارئ': 'Emergency', 'اعتذر بسبب السفر': 'Travelling', 'اعتذرت بسبب السفر': 'Travelling',
  'فاتورة الكهرباء': 'Electricity bill', 'فاتورة المياه': 'Water bill', 'مواد حشو وبوندينغ': 'Filling and bonding materials', 'قفازات وكمامات ومستهلكات': 'Gloves, masks and consumables',
  'مواد طبع وأقماع علاج عصب': 'Impression materials and endo points', 'مخدر وإبر': 'Anaesthetic and needles', 'سنابل ومبارد': 'Burs and files',
  'ضيافة (قهوة وماء ومحارم)': 'Hospitality (coffee, water, tissues)', 'مواد تنظيف وتعقيم للعيادة': 'Cleaning and disinfection supplies', 'صيانة الكمبريسور': 'Compressor service',
  'صيانة جهاز التعقيم (الأوتوكلاف)': 'Autoclave service', 'إصلاح قبضة التوربين': 'Turbine handpiece repair', 'جهاز تصليب ضوئي LED': 'LED curing light',
  'قبضة توربين جديدة': 'New turbine handpiece', 'رسوم نقابة أطباء الأسنان السنوية': 'Annual dental association fee', 'رسوم ترخيص البلدية': 'Municipal licence fee',
  'طباعة بطاقات مواعيد وبروشورات': 'Appointment cards and brochures', 'قرطاسية': 'Stationery', 'صرف للعيادة': 'Used in the clinic',
  'عبوة مفتوحة انتهت صلاحيتها': 'Opened pack expired', 'تصحيح بعد الجرد': 'Correction after stock count', 'رصيد افتتاحي': 'Opening stock',
  'موظفة الاستقبال': 'the receptionist',
}
export const ENGLISH_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** The two demo doctors in a clinic working in English. */
export const DEMO_DOCTORS_EN = [
  { name: 'Dr. Laila Haddad', specialty: 'Orthodontics' },
  { name: 'Dr. Samer Abboud', specialty: 'Oral surgery & implants' },
]

import type { Category, LedgerEntry, Order, Product, RepairTicket, IllustrationKey, OrderStatus, TicketStatus } from './types'
import { DJI_BY_ID } from './dji'

// The demo copy of the store: realistic products, orders, repair tickets and ledger entries, all flagged demo:true so
// the "delete demo data" button in the admin panel removes them in one go.

export const DEMO_CATEGORIES: Category[] = [
  { id: 'drones', name: 'درونات DJI', description: 'جميع طرازات DJI الجديدة والمجدّدة', icon: 'drone', sort: 1, demo: true },
  { id: 'batteries', name: 'بطاريات وشواحن', description: 'بطاريات ذكية أصلية وشواحن وهَبّات', icon: 'battery', sort: 2, demo: true },
  { id: 'propellers', name: 'مراوح', description: 'مراوح أصلية وهادئة لجميع الطرازات', icon: 'propeller', sort: 3, demo: true },
  { id: 'motors-arms', name: 'موتورات وأذرع', description: 'موتورات، أذرع، وهياكل بديلة', icon: 'motor', sort: 4, demo: true },
  { id: 'gimbal-camera', name: 'جيمبال وكاميرا', description: 'وحدات الجيمبال، الكاميرا، والكابلات المرنة', icon: 'gimbal', sort: 5, demo: true },
  { id: 'controllers', name: 'ريموت كونترول', description: 'RC 2، RC-N2، نظارات Goggles، وملحقاتها', icon: 'controller', sort: 6, demo: true },
  { id: 'filters-accessories', name: 'فلاتر وإكسسوارات', description: 'فلاتر ND، حقائب، واقيات مراوح، وبطاقات ذاكرة', icon: 'filter', sort: 7, demo: true },
  { id: 'phones', name: 'هواتف ذكية', description: 'أحدث الهواتف بضمان وكيل', icon: 'phone', sort: 8, demo: true },
  { id: 'phone-parts', name: 'قطع هواتف', description: 'شاشات، بطاريات، ومنافذ شحن أصلية', icon: 'screen', sort: 9, demo: true },
  { id: 'tools', name: 'عدد وأدوات صيانة', description: 'أدوات فك وتركيب ومحطات لحام', icon: 'tool', sort: 10, demo: true },
]

type P = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'demo' | 'images' | 'tags' | 'active' | 'featured' | 'specs' | 'compatible'> &
  Partial<Pick<Product, 'tags' | 'featured' | 'specs' | 'compatible' | 'oldPrice' | 'sku'>>

const DRONES: P[] = [
  { name: 'DJI Mini 5 Pro Fly More Combo (RC 2)', brand: 'DJI', category: 'drones', price: 1299, oldPrice: 1399, stock: 3, short: 'حسّاس 1 إنش، 4K/120fps، تجنّب عوائق ليلي، وزن أقل من 250 غ', description: 'أحدث طرازات سلسلة Mini مع حسّاس بحجم 1 إنش وجيمبال يدور 225°، وزمن طيران حتى 36 دقيقة. يأتي الكومبو مع 3 بطاريات وهَبّ شحن وحقيبة وريموت RC 2 بشاشة.', illustration: 'drone', featured: true, specs: [{ label: 'الكاميرا', value: '1" CMOS, 50MP' }, { label: 'الفيديو', value: '4K/120fps HDR' }, { label: 'زمن الطيران', value: '36 دقيقة' }, { label: 'الوزن', value: '< 250 غ' }, { label: 'الإرسال', value: 'O4+, 20 كم' }], compatible: ['mini-5-pro'], tags: ['جديد', 'الأكثر طلباً'] },
  { name: 'DJI Mini 4 Pro (RC-N2)', brand: 'DJI', category: 'drones', price: 759, stock: 6, short: 'تجنّب عوائق في كل الاتجاهات، 4K/60fps HDR، تصوير عمودي', description: 'الدرون الأكثر مبيعاً تحت 250 غ. تجنّب عوائق في كل الاتجاهات، فيديو 4K/60fps HDR وتصوير عمودي حقيقي، مع نظام الإرسال O4 لمسافة 20 كم.', illustration: 'drone', featured: true, specs: [{ label: 'الكاميرا', value: '1/1.3" CMOS, 48MP' }, { label: 'الفيديو', value: '4K/60fps HDR, 4K/100fps' }, { label: 'زمن الطيران', value: '34 دقيقة' }, { label: 'الوزن', value: '< 249 غ' }], compatible: ['mini-4-pro'], tags: ['الأكثر مبيعاً'] },
  { name: 'DJI Mini 4 Pro Fly More Combo Plus (RC 2)', brand: 'DJI', category: 'drones', price: 1099, stock: 2, short: 'كومبو مع 3 بطاريات Plus لزمن طيران 45 دقيقة وريموت RC 2', description: 'الباقة الكاملة: ريموت RC 2 بشاشة مدمجة، 3 بطاريات Intelligent Flight Battery Plus، هَبّ شحن ثنائي الاتجاه، حقيبة كتف، وواقي مراوح.', illustration: 'drone', specs: [{ label: 'زمن الطيران', value: '45 دقيقة (بطارية Plus)' }, { label: 'الريموت', value: 'DJI RC 2' }], compatible: ['mini-4-pro'] },
  { name: 'DJI Mini 4K', brand: 'DJI', category: 'drones', price: 299, stock: 8, short: 'أفضل درون للمبتدئين: 4K، 31 دقيقة طيران، أقل من 249 غ', description: 'خيار ممتاز للبداية: كاميرا 4K على جيمبال 3 محاور، مقاومة رياح من المستوى 5، وإرسال O2 لمسافة 10 كم.', illustration: 'drone', featured: true, specs: [{ label: 'الفيديو', value: '4K/30fps' }, { label: 'زمن الطيران', value: '31 دقيقة' }, { label: 'الإرسال', value: 'OcuSync 2.0, 10 كم' }], compatible: ['mini-4k'], tags: ['للمبتدئين'] },
  { name: 'DJI Mini 3 (RC-N1)', brand: 'DJI', category: 'drones', price: 419, oldPrice: 469, stock: 4, short: '4K HDR، تصوير عمودي، 38 دقيقة طيران', description: 'طراز متوازن بسعر ممتاز مع كاميرا 4K HDR، تصوير عمودي حقيقي وزمن طيران 38 دقيقة.', illustration: 'drone', specs: [{ label: 'الفيديو', value: '4K/30fps HDR' }, { label: 'زمن الطيران', value: '38 دقيقة' }], compatible: ['mini-3'], tags: ['عرض'] },
  { name: 'DJI Air 3S Fly More Combo (RC 2)', brand: 'DJI', category: 'drones', price: 1599, stock: 2, short: 'كاميرا مزدوجة بحسّاس 1 إنش، ليدار أمامي، تجنّب عوائق ليلي', description: 'كاميرا واسعة بحسّاس 1 إنش وكاميرا تيليفوتو 70 مم متوسطة، حسّاس LiDAR أمامي لتجنّب العوائق ليلاً، وتخزين داخلي 42GB.', illustration: 'drone-pro', featured: true, specs: [{ label: 'الكاميرا', value: '1" CMOS 50MP + 70mm' }, { label: 'الفيديو', value: '4K/120fps, 10-bit D-Log M' }, { label: 'زمن الطيران', value: '45 دقيقة' }, { label: 'التخزين', value: '42GB داخلي' }], compatible: ['air-3s'], tags: ['احترافي'] },
  { name: 'DJI Air 3 (RC-N2)', brand: 'DJI', category: 'drones', price: 1049, stock: 3, short: 'كاميرا مزدوجة 48MP، 46 دقيقة طيران، O4', description: 'نظام كاميرا مزدوجة (واسع + تيليفوتو 3x) بدقة 48MP، تجنّب عوائق في كل الاتجاهات، وزمن طيران 46 دقيقة.', illustration: 'drone-pro', specs: [{ label: 'الكاميرا', value: '1/1.3" مزدوجة 48MP' }, { label: 'زمن الطيران', value: '46 دقيقة' }], compatible: ['air-3'] },
  { name: 'DJI Mavic 4 Pro Fly More Combo', brand: 'DJI', category: 'drones', price: 2899, stock: 1, short: 'Hasselblad 100MP، جيمبال Infinity دوّار 360°، 6K/60fps', description: 'قمة التصوير الجوي: كاميرا Hasselblad رئيسية 100MP بحسّاس 4/3 إنش، جيمبال Infinity يدور 360°، تصوير 6K/60fps HDR، وزمن طيران 51 دقيقة.', illustration: 'drone-pro', featured: true, specs: [{ label: 'الكاميرا', value: 'Hasselblad 4/3" 100MP' }, { label: 'الفيديو', value: '6K/60fps HDR' }, { label: 'زمن الطيران', value: '51 دقيقة' }, { label: 'الإرسال', value: 'O4+, 30 كم' }], compatible: ['mavic-4-pro'], tags: ['Flagship'] },
  { name: 'DJI Mavic 3 Pro (RC)', brand: 'DJI', category: 'drones', price: 2199, oldPrice: 2399, stock: 2, short: 'ثلاث كاميرات Hasselblad، 5.1K، 43 دقيقة', description: 'أول درون بثلاث كاميرات: Hasselblad 4/3 إنش، تيليفوتو 70 مم و 166 مم. تصوير 5.1K/50fps و Apple ProRes في نسخة Cine.', illustration: 'drone-pro', specs: [{ label: 'الكاميرات', value: '3 (24/70/166mm)' }, { label: 'الفيديو', value: '5.1K/50fps' }], compatible: ['mavic-3-pro'] },
  { name: 'DJI Flip (RC-N3)', brand: 'DJI', category: 'drones', price: 439, stock: 5, short: 'أذرع قابلة للطي بالكامل مع واقيات مدمجة، 4K/60، 31 دقيقة', description: 'تصميم فريد بأذرع تنطوي كالكتاب مع واقيات مراوح مدمجة، حسّاس 1/1.3 إنش، تتبّع ذكي وإقلاع من راحة اليد.', illustration: 'drone', specs: [{ label: 'الكاميرا', value: '1/1.3" 48MP' }, { label: 'الفيديو', value: '4K/60fps' }, { label: 'زمن الطيران', value: '31 دقيقة' }], compatible: ['flip'], tags: ['جديد'] },
  { name: 'DJI Neo Fly More Combo', brand: 'DJI', category: 'drones', price: 299, stock: 7, short: 'أخف درون DJI (135 غ)، يقلع من راحة اليد، تحكّم صوتي', description: 'درون سيلفي ذكي بوزن 135 غ فقط مع واقيات مراوح كاملة، تتبّع تلقائي، وتحكّم بالتطبيق أو الصوت أو الريموت.', illustration: 'drone', specs: [{ label: 'الوزن', value: '135 غ' }, { label: 'الفيديو', value: '4K/30fps' }, { label: 'زمن الطيران', value: '18 دقيقة' }], compatible: ['neo'], tags: ['Vlog'] },
  { name: 'DJI Avata 2 Fly More Combo (Goggles 3)', brand: 'DJI', category: 'drones', price: 999, stock: 2, short: 'FPV بتجربة غامرة، نظارات Goggles 3، RC Motion 3', description: 'تجربة طيران FPV غامرة وآمنة مع نظارات Goggles 3 بشاشات Micro-OLED، تحكّم بحركة اليد عبر RC Motion 3، وحسّاس 1/1.3 إنش.', illustration: 'drone-fpv', featured: true, specs: [{ label: 'الكاميرا', value: '1/1.3" 12MP' }, { label: 'الفيديو', value: '4K/60fps, 2.7K/120' }, { label: 'زمن الطيران', value: '23 دقيقة' }], compatible: ['avata-2'], tags: ['FPV'] },
  { name: 'DJI Inspire 3', brand: 'DJI', category: 'drones', price: 16499, stock: 1, short: 'كاميرا سينمائية 8K Full-frame، RTK، للإنتاج الاحترافي', description: 'منصة التصوير السينمائي الجوي: كاميرا Zenmuse X9-8K Air بحسّاس Full-frame، تحديد مواقع RTK سنتيمتري، ورؤية ليلية.', illustration: 'drone-pro', specs: [{ label: 'الكاميرا', value: 'X9-8K Air Full-frame' }, { label: 'الفيديو', value: '8K/75fps ProRes RAW' }], compatible: ['inspire-3'], tags: ['سينمائي'] },
  { name: 'DJI Matrice 4T', brand: 'DJI', category: 'drones', price: 7999, stock: 1, short: 'درون مؤسسات بكاميرا حرارية وليزر مسافات، للتفتيش والبحث', description: 'منصة مؤسسات مدمجة بكاميرا حرارية، كاميرا تيليفوتو 112 مم، ليزر قياس مسافات حتى 1800 م، وذكاء اصطناعي لاكتشاف الأهداف.', illustration: 'drone-pro', specs: [{ label: 'الكاميرات', value: 'واسعة + تيليفوتو + حرارية' }, { label: 'زمن الطيران', value: '49 دقيقة' }], compatible: ['matrice-4'], tags: ['Enterprise'] },
  { name: 'DJI Agras T50', brand: 'DJI', category: 'drones', price: 14999, stock: 1, short: 'درون زراعي بحمولة 40 كغ رش و 50 كغ نثر', description: 'للرش والنثر الزراعي: خزان 40 لتر، معدّل رش 16 لتر/دقيقة، رادارات طور متعدد ورؤية ثنائية لتجنّب العوائق.', illustration: 'drone-pro', specs: [{ label: 'الحمولة', value: '40 كغ رش / 50 كغ نثر' }, { label: 'عرض الرش', value: '11 م' }], compatible: ['agras-t50'], tags: ['زراعي'] },
  { name: 'DJI Mini 2 SE (مجدّد)', brand: 'DJI', category: 'drones', price: 219, oldPrice: 299, stock: 3, short: 'جهاز مجدّد بضمان 3 أشهر، 2.7K، 31 دقيقة', description: 'جهاز مجدّد في مركزنا، تم فحص الموتورات والبطارية وتبديل المراوح. حالة ممتازة مع ضمان 3 أشهر.', illustration: 'drone', specs: [{ label: 'الحالة', value: 'مجدّد — ممتاز' }, { label: 'الفيديو', value: '2.7K/30fps' }], compatible: ['mini-2-se'], tags: ['مجدّد'] },
]

type PartDef = { suffix: string; category: string; illustration: IllustrationKey; short: string; base: number; stock: number }
const PART_DEFS: PartDef[] = [
  { suffix: 'بطارية طيران ذكية أصلية', category: 'batteries', illustration: 'battery', short: 'بطارية أصلية مع مؤشر شحن وحماية ذكية', base: 1, stock: 12 },
  { suffix: 'هَبّ شحن ثنائي الاتجاه', category: 'batteries', illustration: 'charger', short: 'يشحن 3 بطاريات بالتتابع ويعمل كبنك طاقة', base: 0.55, stock: 6 },
  { suffix: 'طقم مراوح أصلي (زوجان)', category: 'propellers', illustration: 'propeller', short: 'مراوح هادئة منخفضة الضجيج مع براغي', base: 0.12, stock: 30 },
  { suffix: 'موتور بديل (أمامي/خلفي)', category: 'motors-arms', illustration: 'motor', short: 'موتور بدون فرش أصلي، يتطلب تركيب فني', base: 0.35, stock: 8 },
  { suffix: 'ذراع كامل مع موتور', category: 'motors-arms', illustration: 'arm', short: 'ذراع بديل مع الموتور والأسلاك، حدّد الجهة عند الطلب', base: 0.5, stock: 5 },
  { suffix: 'وحدة جيمبال وكاميرا', category: 'gimbal-camera', illustration: 'gimbal', short: 'وحدة الجيمبال والكاميرا كاملة، تركيب ومعايرة مجاناً', base: 2.2, stock: 2 },
  { suffix: 'كابل مرن للجيمبال (Flex Cable)', category: 'gimbal-camera', illustration: 'cable', short: 'الكابل المرن للإشارة بين الجيمبال واللوحة', base: 0.18, stock: 10 },
  { suffix: 'طقم فلاتر ND (ND8/16/32/64)', category: 'filters-accessories', illustration: 'filter', short: 'فلاتر زجاجية متعددة الطبقات للتصوير السينمائي', base: 0.35, stock: 9 },
  { suffix: 'واقي مراوح 360°', category: 'filters-accessories', illustration: 'case', short: 'حماية كاملة للطيران الداخلي وبالقرب من الناس', base: 0.14, stock: 11 },
]
const PART_MODELS: { id: string; refPrice: number }[] = [
  { id: 'mini-4-pro', refPrice: 95 }, { id: 'mini-3-pro', refPrice: 85 }, { id: 'mini-3', refPrice: 75 }, { id: 'mini-2', refPrice: 55 },
  { id: 'air-3', refPrice: 150 }, { id: 'air-2s', refPrice: 120 }, { id: 'mavic-3', refPrice: 210 }, { id: 'avata-2', refPrice: 130 }, { id: 'mini-5-pro', refPrice: 105 },
]

const OTHERS: P[] = [
  { name: 'DJI RC 2 ريموت بشاشة', brand: 'DJI', category: 'controllers', price: 369, stock: 4, short: 'شاشة FHD 5.5 إنش بسطوع 700 نت، O4', description: 'ريموت بشاشة مدمجة لطرازات Mini 4 Pro / Air 3 / Air 3S / Mini 5 Pro، مع هوائيات 2T4R ونظام O4.', illustration: 'controller', specs: [{ label: 'الشاشة', value: '5.5" FHD 700nit' }], compatible: ['mini-4-pro', 'air-3', 'air-3s', 'mini-5-pro'], featured: true },
  { name: 'DJI RC-N2 ريموت', brand: 'DJI', category: 'controllers', price: 179, stock: 6, short: 'ريموت قياسي يعمل مع الهاتف، O4', description: 'ريموت RC-N2 بتصميم خفيف يحمل الهاتف أعلى الريموت، متوافق مع Mini 4 Pro و Air 3.', illustration: 'controller', compatible: ['mini-4-pro', 'air-3', 'mini-5-pro'] },
  { name: 'DJI Goggles 3', brand: 'DJI', category: 'controllers', price: 499, stock: 2, short: 'نظارات FPV بشاشتي Micro-OLED ورؤية بالواقع المعزّز', description: 'نظارات Goggles 3 لـ Avata 2 مع شاشتين Micro-OLED 1080p وكاميرات أمامية للرؤية المحيطة.', illustration: 'controller', compatible: ['avata-2', 'neo'] },
  { name: 'DJI RC Motion 3', brand: 'DJI', category: 'controllers', price: 99, stock: 5, short: 'تحكّم بحركة اليد لـ Avata 2 و Neo', description: 'ريموت حركي بديهي: وجّه يدك ويطير الدرون معها، مع ميزة الكبح الفوري.', illustration: 'controller', compatible: ['avata-2', 'neo'] },
  { name: 'DJI 65W شاحن محمول', brand: 'DJI', category: 'batteries', price: 49, stock: 10, short: 'شاحن USB-C 65W لشحن الريموت والبطاريات', description: 'شاحن أصلي 65W بمنفذي USB-C و USB-A، يشحن الهَبّ والريموت والهاتف.', illustration: 'charger', compatible: [] },
  { name: 'حقيبة كتف DJI للدرونات الصغيرة', brand: 'DJI', category: 'filters-accessories', price: 39, stock: 8, short: 'تتسع للدرون والريموت و3 بطاريات', description: 'حقيبة كتف أصلية بقماش مقاوم للماء وتقسيمات داخلية.', illustration: 'case', compatible: [] },
  { name: 'بطاقة ذاكرة SanDisk Extreme 128GB V30', brand: 'SanDisk', category: 'filters-accessories', price: 24, stock: 25, short: 'سرعة كتابة 90MB/s مناسبة لتصوير 4K', description: 'بطاقة microSDXC UHS-I U3 V30 A2 مع محوّل SD، مثالية لتسجيل 4K/60.', illustration: 'box', compatible: [] },
  { name: 'iPhone 16 Pro 256GB', brand: 'Apple', category: 'phones', price: 1199, stock: 3, short: 'شريحة A18 Pro، كاميرا 48MP، شاشة 6.3 إنش 120Hz', description: 'جهاز جديد مغلّف بضمان الوكيل سنة. تيتانيوم، زر Camera Control، وبطارية تدوم طوال اليوم.', illustration: 'phone', specs: [{ label: 'الشاشة', value: '6.3" ProMotion' }, { label: 'التخزين', value: '256GB' }], compatible: [], featured: true },
  { name: 'Samsung Galaxy S25 Ultra 256GB', brand: 'Samsung', category: 'phones', price: 1149, stock: 2, short: 'Snapdragon 8 Elite، كاميرا 200MP، قلم S Pen', description: 'الرائد من سامسونج بكاميرا 200MP، إطار تيتانيوم، وذكاء Galaxy AI.', illustration: 'phone', specs: [{ label: 'الشاشة', value: '6.9" QHD+ 120Hz' }], compatible: [] },
  { name: 'Xiaomi 15 256GB', brand: 'Xiaomi', category: 'phones', price: 649, stock: 4, short: 'كاميرا Leica ثلاثية، Snapdragon 8 Elite', description: 'هاتف مدمج بحجم 6.36 إنش وكاميرات Leica Summilux، وشحن 90W.', illustration: 'phone', compatible: [] },
  { name: 'Samsung Galaxy A56 128GB', brand: 'Samsung', category: 'phones', price: 379, stock: 6, short: 'شاشة Super AMOLED 120Hz، 6 سنوات تحديثات', description: 'الفئة المتوسطة الأفضل مبيعاً، مقاومة للماء IP67 وشحن 45W.', illustration: 'phone', compatible: [] },
  { name: 'شاشة iPhone 13 أصلية (OLED)', brand: 'Apple', category: 'phone-parts', price: 89, stock: 7, short: 'شاشة OLED أصلية مع التركيب', description: 'شاشة أصلية مفكوكة من أجهزة جديدة، تركيب فوري في المركز خلال 30 دقيقة.', illustration: 'screen', compatible: [] },
  { name: 'بطارية iPhone 12 / 12 Pro', brand: 'Apple', category: 'phone-parts', price: 29, stock: 15, short: 'بطارية بسعة أصلية 2815mAh مع التركيب', description: 'بطارية بسعة أصلية مع ضمان 6 أشهر وتركيب مجاني.', illustration: 'battery', compatible: [] },
  { name: 'منفذ شحن Samsung S23 Ultra', brand: 'Samsung', category: 'phone-parts', price: 19, stock: 9, short: 'بورد شحن USB-C أصلي', description: 'لوحة الشحن السفلية الأصلية مع الميكروفون.', illustration: 'cable', compatible: [] },
  { name: 'محطة لحام هواء ساخن Quick 861DW', brand: 'Quick', category: 'tools', price: 149, stock: 2, short: 'محطة احترافية لصيانة اللوحات', description: 'محطة هواء ساخن 1000W بتحكّم رقمي دقيق، الخيار الأول لمراكز الصيانة.', illustration: 'tool', compatible: [] },
  { name: 'طقم مفكات دقيقة 115 قطعة', brand: 'iFixit', category: 'tools', price: 35, stock: 10, short: 'كل الرؤوس اللازمة للدرونات والهواتف', description: 'طقم مفكات دقيقة مغناطيسية مع أدوات فتح بلاستيكية وملقط.', illustration: 'tool', compatible: [] },
]

function id(prefix: string, i: number) {
  return `${prefix}_${i.toString(36).padStart(4, '0')}`
}

export function buildDemoProducts(now: number): Product[] {
  const list: Product[] = []
  let i = 1
  const push = (p: P, demoDays: number) => {
    const createdAt = now - demoDays * 86400000
    list.push({
      id: id('demo_p', i++), ...p, slug: undefined, compatible: p.compatible ?? [], specs: p.specs ?? [], images: [], tags: p.tags ?? [],
      featured: p.featured ?? false, active: true, demo: true, createdAt, updatedAt: createdAt,
    })
  }
  DRONES.forEach((p, k) => push(p, 60 - k))
  for (const m of PART_MODELS) {
    const model = DJI_BY_ID[m.id]
    for (const d of PART_DEFS) {
      push({
        name: `${model.name} — ${d.suffix}`, brand: 'DJI', category: d.category, price: Math.round(m.refPrice * d.base), stock: d.stock,
        short: d.short, description: `${d.short}. متوافق مع ${model.name}. قطعة أصلية مع ضمان 6 أشهر، ويمكن تركيبها في مركزنا مجاناً.`,
        illustration: d.illustration, compatible: [m.id], featured: d.suffix.startsWith('بطارية') && m.id === 'mini-4-pro',
        tags: ['قطعة أصلية'],
      }, 40)
    }
  }
  OTHERS.forEach((p, k) => push(p, 30 - (k % 10)))
  return list
}

const NAMES = ['أحمد العلي', 'سارة محمود', 'خالد الحسن', 'نور الدين', 'ريم عبد الله', 'يوسف قاسم', 'هبة الشامي', 'عبد الرحمن ناصر', 'مريم سليمان', 'طارق حمدان', 'رنا كيالي', 'محمود درويش']
const CITIES = ['دمشق', 'حلب', 'حمص', 'اللاذقية', 'حماة', 'طرطوس', 'السويداء', 'درعا']
const ORDER_STATUSES: OrderStatus[] = ['delivered', 'delivered', 'delivered', 'shipped', 'processing', 'confirmed', 'new', 'new', 'cancelled', 'delivered']

function rnd(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

export function buildDemoOrders(products: Product[], now: number): Order[] {
  const r = rnd(42)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const orders: Order[] = []
  for (let n = 0; n < 24; n++) {
    const daysAgo = Math.floor(r() * 45)
    const createdAt = now - daysAgo * 86400000 - Math.floor(r() * 36000000)
    const count = 1 + Math.floor(r() * 3)
    const items = Array.from({ length: count }, () => {
      const p = pick(products)
      return { productId: p.id, name: p.name, price: p.price, qty: 1 + Math.floor(r() * 2), illustration: p.illustration, image: p.images[0] }
    })
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
    const shipping = subtotal >= 300 ? 0 : 3
    const status = daysAgo < 2 ? (pick(['new', 'new', 'confirmed']) as OrderStatus) : pick(ORDER_STATUSES)
    const name = pick(NAMES)
    orders.push({
      id: id('demo_o', n + 1), number: 1001 + n,
      customer: { name, phone: `09${Math.floor(10000000 + r() * 89999999)}`, city: pick(CITIES), address: 'شارع رئيسي، بناء رقم ' + (1 + Math.floor(r() * 40)), notes: r() > 0.7 ? 'الرجاء الاتصال قبل التوصيل' : '' },
      items, subtotal, shipping, total: subtotal + shipping, currency: 'USD', status, whatsappSent: true,
      history: [{ status: 'new', at: createdAt }, ...(status !== 'new' ? [{ status, at: createdAt + 3600000 * (1 + Math.floor(r() * 48)) }] : [])],
      demo: true, createdAt, updatedAt: createdAt,
    })
  }
  return orders.sort((a, b) => a.createdAt - b.createdAt).map((o, k) => ({ ...o, number: 1001 + k }))
}

const ISSUES = [
  { deviceType: 'درون', brand: 'DJI', model: 'Mini 3 Pro', issue: 'سقط من ارتفاع 10 م، انكسر الذراع الأمامي الأيسر والجيمبال يهتز', est: 120 },
  { deviceType: 'درون', brand: 'DJI', model: 'Air 2S', issue: 'لا يقلع — خطأ ESC في التطبيق على الموتور رقم 3', est: 60 },
  { deviceType: 'درون', brand: 'DJI', model: 'Mavic 3', issue: 'انقطاع الإشارة بعد 500 م وصورة متقطعة', est: 90 },
  { deviceType: 'هاتف', brand: 'Apple', model: 'iPhone 13 Pro', issue: 'الشاشة مكسورة واللمس لا يعمل في الجزء السفلي', est: 110 },
  { deviceType: 'هاتف', brand: 'Samsung', model: 'Galaxy S22', issue: 'لا يشحن إلا بزاوية معيّنة', est: 20 },
  { deviceType: 'درون', brand: 'DJI', model: 'Avata 2', issue: 'الكاميرا سوداء بعد اصطدام، الجيمبال يعطي خطأ', est: 150 },
  { deviceType: 'لابتوب', brand: 'Lenovo', model: 'Legion 5', issue: 'حرارة عالية وينطفئ أثناء الألعاب', est: 25 },
  { deviceType: 'درون', brand: 'DJI', model: 'Mini 4 Pro', issue: 'بطارية لا تشحن ومؤشر LED يرمش', est: 45 },
  { deviceType: 'هاتف', brand: 'Xiaomi', model: 'Redmi Note 12', issue: 'البطارية منتفخة', est: 22 },
  { deviceType: 'درون', brand: 'DJI', model: 'Phantom 4 Pro', issue: 'انحراف البوصلة ولا يثبت في المكان', est: 50 },
]
const T_STATUSES: TicketStatus[] = ['delivered', 'delivered', 'ready', 'repairing', 'quoted', 'diagnosing', 'received', 'delivered', 'cancelled', 'repairing']

export function buildDemoTickets(now: number): RepairTicket[] {
  const r = rnd(7)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const tickets: RepairTicket[] = []
  for (let n = 0; n < 14; n++) {
    const daysAgo = Math.floor(r() * 40)
    const createdAt = now - daysAgo * 86400000 - Math.floor(r() * 36000000)
    const is = ISSUES[n % ISSUES.length]
    const status = daysAgo < 2 ? 'received' : T_STATUSES[n % T_STATUSES.length]
    const done = status === 'delivered'
    tickets.push({
      id: id('demo_t', n + 1), number: 501 + n,
      customer: { name: pick(NAMES), phone: `09${Math.floor(10000000 + r() * 89999999)}`, city: pick(CITIES), address: '' },
      deviceType: is.deviceType, brand: is.brand, model: is.model, issue: is.issue, accessories: n % 3 === 0 ? 'ريموت + بطاريتان + حقيبة' : '',
      photos: [], status, estimate: status === 'received' ? undefined : is.est, finalCost: done ? is.est : undefined, partsCost: done ? Math.round(is.est * 0.45) : undefined,
      technicianNotes: done ? 'تم تبديل القطعة ومعايرة الجهاز واختبار الطيران.' : status === 'diagnosing' ? 'قيد الفحص على الطاولة.' : '',
      whatsappSent: true,
      history: [{ status: 'received', at: createdAt }, ...(status !== 'received' ? [{ status, at: createdAt + 86400000 }] : [])],
      demo: true, createdAt, updatedAt: createdAt,
    })
  }
  return tickets.sort((a, b) => a.createdAt - b.createdAt).map((t, k) => ({ ...t, number: 501 + k }))
}

export function buildDemoLedger(orders: Order[], tickets: RepairTicket[], now: number): LedgerEntry[] {
  const entries: LedgerEntry[] = []
  const day = (t: number) => new Date(t).toISOString().slice(0, 10)
  let i = 1
  for (const o of orders) if (o.status === 'delivered') entries.push({ id: id('demo_l', i++), type: 'income', amount: o.total, currency: 'USD', category: 'مبيعات', note: `طلب #${o.number} — ${o.customer.name}`, date: day(o.updatedAt + 86400000), ref: { kind: 'order', id: o.id, number: o.number }, demo: true, createdAt: o.updatedAt })
  for (const t of tickets) if (t.status === 'delivered' && t.finalCost) {
    entries.push({ id: id('demo_l', i++), type: 'income', amount: t.finalCost, currency: 'USD', category: 'صيانة', note: `صيانة #${t.number} — ${t.model}`, date: day(t.updatedAt + 2 * 86400000), ref: { kind: 'ticket', id: t.id, number: t.number }, demo: true, createdAt: t.updatedAt })
    if (t.partsCost) entries.push({ id: id('demo_l', i++), type: 'expense', amount: t.partsCost, currency: 'USD', category: 'قطع غيار', note: `قطع لصيانة #${t.number}`, date: day(t.updatedAt + 86400000), ref: { kind: 'ticket', id: t.id, number: t.number }, demo: true, createdAt: t.updatedAt })
  }
  const fixed: [number, string, string][] = [[350, 'إيجار', 'إيجار المحل — الشهر الحالي'], [1200, 'شراء بضاعة', 'شحنة بطاريات ومراوح من دبي'], [180, 'رواتب', 'راتب فني مساعد'], [45, 'فواتير', 'كهرباء وإنترنت'], [60, 'تسويق', 'إعلانات فيسبوك وإنستغرام'], [30, 'شحن', 'رسوم شحن مجمّعة']]
  fixed.forEach(([amount, category, note], k) => entries.push({ id: id('demo_l', i++), type: 'expense', amount, currency: 'USD', category, note, date: day(now - (3 + k * 6) * 86400000), demo: true, createdAt: now - (3 + k * 6) * 86400000 }))
  return entries.sort((a, b) => a.date.localeCompare(b.date))
}

export function buildDemo(now = Date.now()) {
  const products = buildDemoProducts(now)
  const orders = buildDemoOrders(products, now)
  const tickets = buildDemoTickets(now)
  const ledger = buildDemoLedger(orders, tickets, now)
  return { categories: DEMO_CATEGORIES, products, orders, tickets, ledger }
}

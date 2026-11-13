/**
 * The one description of the store screenshots: what is captured from the game, how each upload
 * file is laid out, and the captions. Read by make-screenshots.cjs (which makes the files) and by
 * check-kit.cjs (which checks them), so the two can never disagree.
 *
 * Owner's rule (binding): a store screenshot is an unedited capture of the real, running game.
 * Around a capture only four things are allowed — scaling it, masking its corners round, a plain
 * frame / background, one short caption above it. Nothing here may add anything else.
 */

/** The three device classes Google Play has upload slots for. CSS viewport × scale = file size. */
const DEVICES = {
  phone: { id: 'phone', label: 'Phone', w: 360, h: 640, scale: 3, width: 1080, height: 1920, rawDir: ['raw'], finalDir: ['phone'] },
  tablet7: { id: 'tablet7', label: '7-inch tablet', w: 600, h: 960, scale: 2, width: 1200, height: 1920, rawDir: ['raw', 'tablet7'], finalDir: ['tablet7'] },
  tablet10: { id: 'tablet10', label: '10-inch tablet', w: 800, h: 1280, scale: 2, width: 1600, height: 2560, rawDir: ['raw', 'tablet10'], finalDir: ['tablet10'] },
};
const DEVICE_IDS = ['phone', 'tablet7', 'tablet10'];
const LANGS = ['en', 'ar'];
const ALL = DEVICE_IDS;
const PHONE = ['phone'];

/** The player the menu screens belong to: 81 levels cleared, standing at the gate of the fifth world. */
const JOURNEY = { reached: 81, coins: 3450 };

/**
 * What is captured. Every scene is a state a player reaches in the shipped game:
 *   kind 'title' | 'map' | 'intro' | 'daily' | 'shop'   menu screens of the JOURNEY player
 *   kind 'moment'   a level is started from its intro dialog and played; the capture is a frame of
 *                   the move found by the look-ahead (`plan`), taken while its effect runs
 *   kind 'praise'   the same, captured when the game's praise word is on screen after the move
 *   kind 'calm'     a level right after its start, nothing played
 *   kind 'hammer'   a level right after its start, the Hammer booster tapped (the game asks where to strike)
 *   kind 'win'      a level played to the end; the game's own result dialog
 *
 * `level` chooses the level from the shipped list at run time (the level set may still be tuned):
 *   chapters  1..6 = Oasis, Dunes, Bazaar, Palace, Caverns, Starlit Sky, tried in this order
 *   prefer    level numbers to take first, if they still fit
 *   plain     only levels without blockers (a board of gems)
 *   need      blocker kinds the level must have: 'stone' | 'chain' | 'vine' | 'lamp' | 'sand'
 *   rich      among the fitting levels, the one with the most kinds of blockers
 *   from      lowest level number
 * `caravan`   the player's win streak in the save (3 = the Caravan brings a beam, a nova, a prism)
 * `plan`      see planMoment() in game.cjs; `seeds` = how many level seeds are searched
 */
const SCENES = [
  { id: 'title', file: '01-title', kind: 'title', devices: ALL, what: 'Title screen' },
  { id: 'map', file: '02-map', kind: 'map', devices: ALL, what: 'World map, mid-journey' },
  { id: 'intro', file: '03-level-intro', kind: 'intro', devices: PHONE, caravan: 2, what: 'Level intro: goals, Caravan, start boosters' },
  {
    id: 'combo',
    file: '04-play-combo',
    kind: 'moment',
    devices: ALL,
    level: { chapters: [2], prefer: [28], plain: true },
    caravan: 3,
    plan: { wish: 'cross', depth: 2, min: 100, seeds: 80 },
    burst: { lead: 200, step: 45, until: 1500 },
    what: 'Gameplay: two special pieces swapped — a big combo',
  },
  {
    id: 'beam',
    file: '05-play-beam',
    kind: 'moment',
    devices: ALL,
    level: { chapters: [3], prefer: [51], plain: true },
    caravan: 3,
    plan: { wish: 'beam', depth: 2, min: 90, seeds: 80 },
    burst: { lead: 200, step: 45, until: 1500 },
    what: 'Gameplay: a beam fires along its line',
  },
  {
    id: 'blockers',
    file: '06-play-blockers',
    kind: 'calm',
    devices: ALL,
    level: { chapters: [4, 5, 6], prefer: [80], need: ['lamp'], rich: true },
    caravan: 0,
    what: 'Gameplay: lamps, stone, chains, vines and sand on one board',
  },
  {
    id: 'booster',
    file: '07-play-booster',
    kind: 'hammer',
    devices: ALL,
    level: { chapters: [1], prefer: [17, 19, 13], need: ['stone'], from: 12 },
    caravan: 0,
    what: 'Gameplay: the Hammer booster, choosing where to strike',
  },
  {
    id: 'praise',
    file: '08-play-praise',
    kind: 'praise',
    devices: ALL,
    level: { chapters: [6], prefer: [111, 104, 101], plain: true },
    caravan: 0,
    plan: { wish: 'cascade', depth: 2, min: 100, seeds: 60 },
    what: 'Gameplay: a long cascade and the praise word it earns',
  },
  {
    id: 'win',
    file: '09-win',
    kind: 'win',
    devices: ALL,
    level: { chapters: [5], prefer: [82, 83, 84, 85, 86], from: 82 },
    caravan: 0,
    plan: { seeds: 200 },
    what: 'Level complete: three stars, score and coins',
  },
  { id: 'daily', file: '10-daily-gift', kind: 'daily', devices: PHONE, what: 'Daily gift: seven-day cycle, day 4 ready' },
  { id: 'shop', file: '11-shop-boosters', kind: 'shop', devices: PHONE, what: 'Shop: boosters priced in coins' },
];

/**
 * The eight files to upload, in order. `scene` is the capture shown; `otherLang` shows the capture
 * taken in the other language (the proof for "English and Arabic"). `tint` is the soft glow behind
 * the caption — a colour of the world on show, over the game's indigo. Captions: two to five words,
 * no ranking, price or call-to-action wording, nothing about any other game; `alt` is the
 * screenshot's alt text for Play Console (at most 140 characters).
 */
const FINALS = [
  {
    n: 1,
    slug: 'match-gems',
    scene: 'combo',
    tint: '#ff8a3c',
    caption: { en: ['Match Gems,', 'Unleash the Light'], ar: ['طابق الجواهر', 'وأطلق وهجها'] },
    alt: {
      en: 'A board of gems in the Dunes world as two special pieces combine and beams of light sweep across rows and columns.',
      ar: 'لوح من الجواهر في عالم الكثبان لحظة دمج قطعتين خاصتين وأشعة الضوء تكتسح الصفوف والأعمدة.',
    },
  },
  {
    n: 2,
    slug: 'special-pieces',
    scene: 'beam',
    tint: '#d9479f',
    caption: { en: ['Fire Beams, Novas', 'and Prisms'], ar: ['أشعل الشعاع', 'والنوفا والمنشور'] },
    alt: {
      en: 'A beam fires down a column in the Bazaar world while a nova and a prism wait on the board.',
      ar: 'شعاع ينطلق على طول عمود في عالم السوق، وعلى اللوح نوفا ومنشور ينتظران دورهما.',
    },
  },
  {
    n: 3,
    slug: 'six-worlds',
    scene: 'map',
    tint: '#22c7b8',
    caption: { en: ['120 Levels', 'Across Six Worlds'], ar: ['120 مرحلة', 'في ستة عوالم'] },
    alt: {
      en: 'The level map at the entrance to the Caverns world, with stars earned on the levels already cleared.',
      ar: 'خريطة المراحل عند مدخل عالم الكهوف، وعليها النجوم المكتسبة في المراحل المنجزة.',
    },
  },
  {
    n: 4,
    slug: 'goals',
    scene: 'blockers',
    tint: '#5b7cff',
    caption: { en: ['Every Level,', 'a Fresh Puzzle'], ar: ['في كل مرحلة', 'تحدٍّ مختلف'] },
    alt: {
      en: 'A Palace level with lamps to bring down, chained gems, stone blocks, vines and sand, and its goals in the top bar.',
      ar: 'مرحلة في عالم القصر فيها مصابيح يجب إنزالها وجواهر مقيدة وحجارة ونباتات متسلقة ورمال، وأهدافها في الشريط العلوي.',
    },
  },
  {
    n: 5,
    slug: 'boosters',
    scene: 'booster',
    tint: '#2fd17c',
    caption: { en: ['Boosters for', 'Tricky Moments'], ar: ['معزّزات', 'تنقذ الموقف'] },
    alt: {
      en: 'The Hammer booster is selected in an Oasis level and the game asks which piece to smash.',
      ar: 'معزّز المطرقة محدد في مرحلة من عالم الواحة، واللعبة تسأل أي قطعة تُحطَّم.',
    },
  },
  {
    n: 6,
    slug: 'rewards',
    scene: 'win',
    tint: '#f5c95a',
    caption: { en: ['Win Stars', 'and Daily Gifts'], ar: ['اكسب النجوم', 'والهدايا اليومية'] },
    alt: {
      en: 'The level complete dialog with three stars, the score and the coins earned.',
      ar: 'نافذة إتمام المرحلة بثلاث نجوم مع النتيجة والعملات المكتسبة.',
    },
  },
  {
    n: 7,
    slug: 'offline',
    scene: 'praise',
    tint: '#8a6bff',
    caption: { en: ['Works Offline,', 'Anywhere'], ar: ['تعمل بلا إنترنت', 'أينما كنت'] },
    alt: {
      en: 'A Starlit Sky level just after a long cascade, with the praise word the game shows for it.',
      ar: 'مرحلة في عالم سماء النجوم بعد سلسلة تطابقات طويلة، مع كلمة الثناء التي تعرضها اللعبة.',
    },
  },
  {
    n: 8,
    slug: 'languages',
    scene: 'title',
    otherLang: true,
    tint: '#ff7fa8',
    caption: { en: ['In English', 'and Arabic'], ar: ['بالعربية', 'والإنجليزية'] },
    alt: {
      en: 'The title screen of the game in Arabic: the emblem, the Arabic wordmark and the Play button.',
      ar: 'شاشة البداية باللغة الإنجليزية: الشعار واسم اللعبة وزر اللعب.',
    },
  },
];

/**
 * Layout of an upload file, as fractions of its width W (so the three device sizes share one
 * design). The capture is scaled to `shot` × W wide (its own aspect ratio is kept), stands
 * `bottom` × W above the lower edge, centred, inside a gold line; everything above it is the
 * caption band.
 */
const LAYOUT = {
  /** width of the scaled capture / W, per device class */
  shot: { phone: 0.8222, tablet7: 0.79, tablet10: 0.79 },
  /** gap between the frame and the lower edge / W */
  bottom: 0.0296,
  /** corner radius of the capture / W */
  radius: 0.046,
  /** thickness of the gold line around it / W */
  line: 0.0052,
  /** caption: the largest font size / W, the widest a line may be / W, line height in em */
  font: { en: 0.0935, ar: 0.089 },
  maxLine: 0.9,
  lineHeight: { en: 1.04, ar: 1.3 },
  /** space kept free between the caption and the frame / W */
  gap: 0.02,
};

/** Wording a caption may never carry (Google Play metadata policy; docs/research/play-policy.md). */
const CAPTION_BANNED = {
  en: ['best', '#1', 'no. 1', 'number one', 'top', 'new', 'free', 'discount', 'sale', 'million', 'download', 'play now', 'install', 'popular', 'award', 'editor'],
  ar: ['الأفضل', 'أفضل', 'رقم 1', 'رقم واحد', '#1', 'مجان', 'جديد', 'خصم', 'تخفيض', 'عرض', 'حمّل', 'حمل الآن', 'العب الآن', 'نزّل', 'الأكثر', 'الأشهر', 'جائزة'],
};

/** Numbers the checker holds the files to. */
const LIMITS = {
  /** bytes per file (Google Play: 8 MB) */
  maxBytes: 8 * 1024 * 1024,
  /** caption ink (bounding box of the lettering) as a share of the image; Google asks for "not more than 20 %" */
  captionInkMax: 0.2,
  /** finals per device class and language */
  finals: { phone: 8, tablet7: 8, tablet10: 8 },
  /** Google Play: at least 2, at most 8 per device type; tablets: at least 4 when provided */
  minFinals: { phone: 2, tablet7: 4, tablet10: 4 },
  altMax: 140,
};

module.exports = { DEVICES, DEVICE_IDS, LANGS, JOURNEY, SCENES, FINALS, LAYOUT, CAPTION_BANNED, LIMITS };

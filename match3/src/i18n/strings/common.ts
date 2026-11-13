/**
 * Shared vocabulary: the words every screen needs, so they are written once and read the same
 * everywhere. Other namespaces (play, shop, settings, …) live in their own files next to this one.
 *
 * Message syntax ({name} placeholders, {n, plural, …} variants): see ../index.ts.
 *
 * Arabic style used here — keep it in every other file:
 *  - Modern Standard Arabic in a warm, direct tone; the player is addressed in the masculine
 *    singular imperative (العب، اجمع، بدّل), the usual neutral form in Arabic apps.
 *  - Buttons are verbal nouns (إلغاء، شراء، متابعة) except the main call to action (العب).
 *  - Labels and titles carry the article (الحركات، النقاط، الشعاع); names of things you own or
 *    receive do not (مطرقة، منشور، حركات إضافية), so they also read well after a number.
 *  - Only the shadda and tanwin that help reading are written (معزّز، مجانًا); the tanwin sits on
 *    the letter before the alif. Punctuation is Arabic (، ؛ ؟); digits are always Western (0-9).
 *  - Counted things use a plural block with the Arabic categories: one {حركة واحدة} two {حركتان}
 *    few {{n} حركات} many {{n} حركة} other {{n} حركة}. After a preposition or as an object the
 *    dual is حركتين.
 *  - A "+" or "-" written before a number or placeholder needs U+200E in front of it
 *    ("\u200E+{n}"), otherwise right-to-left text draws the sign after the number. Numbers passed
 *    as variables are handled by t() itself. Latin text inside an Arabic sentence (a price such as
 *    "US$0.99") belongs at the end of the sentence or on its own line.
 *
 * Vocabulary — ONE Arabic word per concept, in every file (tests/i18n/strings.test.ts rejects the
 * synonyms listed there):
 *   level مرحلة / مراحل      (not مستوى)          move حركة / حركات       (not نقلة، خطوة)
 *   life قلب / قلوب          (not روح / أرواح)     coin عملة / عملات
 *   star نجمة / نجوم                              booster معزّز / معزّزات  (with the shadda)
 *   board اللوحة · tile خانة · piece قطعة · gem جوهرة / جواهر · score / points نقطة / نقاط
 *   beam شعاع · nova نوفا (feminine) · prism منشور · sand الرمال · stone حجر / أحجار ·
 *   chain سلسلة / سلاسل · vine النبات المتسلّق · lamp فانوس / فوانيس · shop المتجر ·
 *   reward مكافأة · goal هدف / أهداف · chapter فصل / فصول
 */
import type { StringTable } from '../types.ts';

const table: StringTable = {
  en: {
    // ── buttons & answers ──
    'common.ok': 'OK',
    'common.cancel': 'Cancel',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.play': 'Play',
    'common.continue': 'Continue',
    'common.retry': 'Try again',
    'common.next': 'Next',
    'common.done': 'Done',
    'common.claim': 'Claim',
    'common.buy': 'Buy',
    'common.use': 'Use',
    'common.pause': 'Pause',
    'common.resume': 'Resume',
    'common.quit': 'Quit',

    // ── nouns & labels ──
    'common.level': 'Level {n}',
    'common.levels': 'Levels',
    'common.moves': 'Moves',
    'common.score': 'Score',
    'common.best': 'Best',
    'common.stars': 'Stars',
    'common.coins': 'Coins',
    'common.lives': 'Lives',
    'common.boosters': 'Boosters',
    'common.goals': 'Goals',
    'common.reward': 'Reward',
    'common.settings': 'Settings',
    'common.shop': 'Shop',

    // ── states ──
    'common.full': 'Full',
    'common.free': 'Free',
    'common.owned': 'Owned',
    'common.ownedCount': 'You have {n}',
    'common.notEnoughCoins': 'Not enough coins',
    'common.on': 'On',
    'common.off': 'Off',
    'common.new': 'New',
    'common.locked': 'Locked',
    'common.loading': 'Loading…',

    // ── the pieces ──
    'common.piece.gem': 'Gem',
    'common.piece.beam': 'Beam',
    'common.piece.nova': 'Nova',
    'common.piece.prism': 'Prism',

    // ── time ──
    'common.time.now': 'Now',
    'common.time.today': 'Today',
    'common.time.tomorrow': 'Tomorrow',
    'common.time.day': 'Day {n}',
    'common.time.in': 'in {time}',
    'common.time.days': '{n, plural, one {1 day} other {{n} days}}',
    'common.time.hours': '{n, plural, one {1 hour} other {{n} hours}}',
    'common.time.minutes': '{n, plural, one {1 minute} other {{n} minutes}}',
    'common.time.seconds': '{n, plural, one {1 second} other {{n} seconds}}',
    'common.time.h': '{n}h',
    'common.time.m': '{n}m',
    'common.time.s': '{n}s',

    // ── boosters ──
    'booster.hammer.name': 'Hammer',
    'booster.hammer.desc': "Strike any tile you choose. It doesn't cost a move.",
    'booster.freeSwap.name': 'Free Swap',
    'booster.freeSwap.desc': "Swap any two adjacent pieces, even if they don't match. It doesn't cost a move.",
    'booster.shuffle.name': 'Shuffle',
    'booster.shuffle.desc': "Mix up the gems on the board. It doesn't cost a move.",
    'booster.extraMoves.name': 'Extra Moves',
    'booster.extraMoves.desc': 'Start the level with 3 extra moves.',
    'booster.prism.name': 'Prism',
    'booster.prism.desc': 'Start with a prism on the board. Swap it with any gem to clear every gem of that kind.',
    'booster.beamNova.name': 'Beam & Nova',
    'booster.beamNova.desc': 'Start with a beam that clears a whole line and a nova that blasts everything around it.',

    // ── gems, by colour index (docs/DESIGN.md §3) ──
    'gem.0': 'Ruby',
    'gem.1': 'Amber',
    'gem.2': 'Emerald',
    'gem.3': 'Sapphire',
    'gem.4': 'Amethyst',
    'gem.5': 'Moonstone',

    // ── goals: goal.<kind> is the instruction, goal.name.<kind> the thing itself ──
    'goal.score': '{n, plural, one {Reach 1 point} other {Reach {n} points}}',
    'goal.color': 'Collect {n}',
    'goal.colorNamed': '{n, plural, one {Collect 1 {gem} gem} other {Collect {n} {gem} gems}}',
    'goal.sand': 'Clear all the sand',
    'goal.lamp': '{n, plural, one {Bring down the lamp} other {Bring down {n} lamps}}',
    'goal.stone': 'Break all the stones',
    'goal.vine': 'Cut all the vines',
    'goal.chain': 'Break all the chains',
    'goal.name.score': 'Points',
    'goal.name.color': 'Gems',
    'goal.name.sand': 'Sand',
    'goal.name.lamp': 'Lamps',
    'goal.name.stone': 'Stones',
    'goal.name.vine': 'Vines',
    'goal.name.chain': 'Chains',

    // ── chapters, by theme ──
    'chapter.oasis': 'Oasis',
    'chapter.dunes': 'Dunes',
    'chapter.bazaar': 'Bazaar',
    'chapter.palace': 'Palace',
    'chapter.caverns': 'Caverns',
    'chapter.stars': 'Starlit Sky',
  },

  ar: {
    // ── buttons & answers ──
    'common.ok': 'حسنًا',
    'common.cancel': 'إلغاء',
    'common.yes': 'نعم',
    'common.no': 'لا',
    'common.close': 'إغلاق',
    'common.back': 'رجوع',
    'common.play': 'العب',
    'common.continue': 'متابعة',
    'common.retry': 'إعادة المحاولة',
    'common.next': 'التالي',
    'common.done': 'تم',
    'common.claim': 'استلام',
    'common.buy': 'شراء',
    'common.use': 'استخدام',
    'common.pause': 'إيقاف مؤقت',
    'common.resume': 'متابعة اللعب',
    'common.quit': 'خروج',

    // ── nouns & labels ──
    'common.level': 'المرحلة {n}',
    'common.levels': 'المراحل',
    'common.moves': 'الحركات',
    'common.score': 'النقاط',
    'common.best': 'الأفضل',
    'common.stars': 'النجوم',
    'common.coins': 'العملات',
    'common.lives': 'القلوب',
    'common.boosters': 'المعزّزات',
    'common.goals': 'الأهداف',
    'common.reward': 'المكافأة',
    'common.settings': 'الإعدادات',
    'common.shop': 'المتجر',

    // ── states ──
    'common.full': 'مكتملة',
    'common.free': 'مجانًا',
    'common.owned': 'بحوزتك',
    'common.ownedCount': 'لديك {n}',
    'common.notEnoughCoins': 'عملاتك لا تكفي',
    'common.on': 'تشغيل',
    'common.off': 'إيقاف',
    'common.new': 'جديد',
    'common.locked': 'مقفل',
    'common.loading': 'جارٍ التحميل…',

    // ── the pieces ──
    'common.piece.gem': 'الجوهرة',
    'common.piece.beam': 'الشعاع',
    'common.piece.nova': 'النوفا',
    'common.piece.prism': 'المنشور',

    // ── time (the dual is written in its genitive form: these follow «بعد») ──
    'common.time.now': 'الآن',
    'common.time.today': 'اليوم',
    'common.time.tomorrow': 'غدًا',
    'common.time.day': 'اليوم {n}',
    'common.time.in': 'بعد {time}',
    'common.time.days': '{n, plural, one {يوم واحد} two {يومين} few {{n} أيام} many {{n} يومًا} other {{n} يوم}}',
    'common.time.hours': '{n, plural, one {ساعة واحدة} two {ساعتين} few {{n} ساعات} other {{n} ساعة}}',
    'common.time.minutes': '{n, plural, one {دقيقة واحدة} two {دقيقتين} few {{n} دقائق} other {{n} دقيقة}}',
    'common.time.seconds': '{n, plural, one {ثانية واحدة} two {ثانيتين} few {{n} ثوانٍ} other {{n} ثانية}}',
    'common.time.h': '{n} س',
    'common.time.m': '{n} د',
    'common.time.s': '{n} ث',

    // ── boosters ──
    // names without the article (see the style notes at the top): they follow numbers and "×"
    'booster.hammer.name': 'مطرقة',
    'booster.hammer.desc': 'اضرب أي خانة تختارها، ولن تخسر أي حركة.',
    'booster.freeSwap.name': 'تبديل حر',
    'booster.freeSwap.desc': 'بدّل أي قطعتين متجاورتين حتى لو لم تتطابقا، ولن تخسر أي حركة.',
    'booster.shuffle.name': 'خلط',
    'booster.shuffle.desc': 'اخلط الجواهر على اللوحة، ولن تخسر أي حركة.',
    'booster.extraMoves.name': 'حركات إضافية',
    'booster.extraMoves.desc': 'ابدأ المرحلة بـ 3 حركات إضافية.',
    'booster.prism.name': 'منشور',
    'booster.prism.desc': 'ابدأ بمنشور على اللوحة. بدّل مكانه مع أي جوهرة ليزيل كل الجواهر من نوعها.',
    'booster.beamNova.name': 'شعاع ونوفا',
    'booster.beamNova.desc': 'ابدأ بشعاع يمسح خطًّا كاملًا ونوفا تفجّر كل ما حولها.',

    // ── gems, by colour index ──
    'gem.0': 'الياقوت الأحمر',
    'gem.1': 'الكهرمان',
    'gem.2': 'الزمرد',
    'gem.3': 'الياقوت الأزرق',
    'gem.4': 'الجمشت',
    'gem.5': 'حجر القمر',

    // ── goals ──
    'goal.score': '{n, plural, one {اجمع نقطة واحدة} two {اجمع نقطتين} few {اجمع {n} نقاط} other {اجمع {n} نقطة}}',
    'goal.color': 'اجمع {n}',
    'goal.colorNamed': 'اجمع {n} من {gem}',
    'goal.sand': 'أزل كل الرمال',
    'goal.lamp': '{n, plural, one {أنزل الفانوس} two {أنزل الفانوسين} few {أنزل {n} فوانيس} many {أنزل {n} فانوسًا} other {أنزل {n} فانوس}}',
    'goal.stone': 'حطّم كل الأحجار',
    'goal.vine': 'اقطع كل النباتات المتسلّقة',
    'goal.chain': 'اكسر كل السلاسل',
    'goal.name.score': 'النقاط',
    'goal.name.color': 'الجواهر',
    'goal.name.sand': 'الرمال',
    'goal.name.lamp': 'الفوانيس',
    'goal.name.stone': 'الأحجار',
    'goal.name.vine': 'النباتات المتسلّقة',
    'goal.name.chain': 'السلاسل',

    // ── chapters, by theme ──
    'chapter.oasis': 'الواحة',
    'chapter.dunes': 'الكثبان',
    'chapter.bazaar': 'السوق',
    'chapter.palace': 'القصر',
    'chapter.caverns': 'الكهوف',
    'chapter.stars': 'سماء النجوم',
  },
};

export default table;

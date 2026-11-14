/**
 * Strings of the play screen (src/play): HUD, banners, praise words, booster targeting, the pause /
 * win / lose dialogs and the tutorial tips. Shared words (Level {n}, Moves, Score, goal texts,
 * booster names) come from ./common.ts. Arabic style and vocabulary: see the header of ./common.ts.
 *
 * The praise words are a CLOSED list of the game's own (docs/STRATEGY.md "feel-02"): adjectives of
 * light, nothing borrowed. Do not add or swap words without the originality check described there.
 */
import type { StringTable } from '../types.ts';

const table: StringTable = {
  en: {
    // ── HUD ──
    'play.aria.moves': '{n, plural, one {1 move left} other {{n} moves left}}',
    'play.aria.booster': '{name}: {n}',

    // ── praise (weakest → strongest) and the end-of-level phrase ──
    'play.praise.1': 'Sparkling!',
    'play.praise.2': 'Radiant!',
    'play.praise.3': 'Dazzling!',
    'play.praise.4': 'Splendour!',
    'play.praise.finale': 'Oasis Glow!',

    // ── banners ──
    'play.shuffle': 'No more moves — shuffling',
    'play.target.hammer': 'Tap a piece to smash',
    'play.target.freeSwap': 'Swap any two neighbours',
    'play.booster.noEffect': 'Nothing to hit there',
    'play.booster.noSwap': "Those two can't be swapped",
    'play.booster.noShuffle': 'Nothing to shuffle right now',

    // ── pause ──
    'play.pause.title': 'Paused',
    'play.pause.restart': 'Restart',
    'play.pause.quit': 'Quit to map',
    'play.pause.sound': 'Sound',
    'play.pause.music': 'Music',
    'play.pause.haptics': 'Vibration',
    'play.restart.title': 'Restart the level?',
    'play.restart.text': 'Your progress in this level will be lost.',
    'play.restart.yes': 'Restart',
    'play.quit.title': 'Leave the level?',
    'play.quit.text': 'Your progress in this level will be lost.',
    'play.quit.yes': 'Leave',
    'play.costLife': 'You will lose a life.',
    'play.caravanReset': '{n, plural, one {Your Caravan of 1 win will be reset.} other {Your Caravan of {n} wins will be reset.}}',
    'play.stay': 'Keep playing',

    // ── win ──
    'play.win.title': 'Level complete!',
    'play.win.newBest': 'New best!',
    'play.win.coins': '{n, plural, one {1 coin earned} other {{n} coins earned}}',
    'play.win.double': 'Double coins',
    'play.win.watch': 'Watch a video',
    'play.win.doubled': 'Coins doubled!',
    'play.win.map': 'Map',
    'play.noVideo': 'No video is available right now.',

    // ── lose ──
    'play.lose.title': 'Out of moves',
    'play.lose.missing': 'So close! You still need:',
    'play.lose.stuckTitle': 'No moves possible',
    'play.lose.stuck': 'There is no way to make another move on this board.',
    'play.lose.moves': '+{n} moves',
    'play.lose.poor': "You don't have enough coins.",
    'play.lose.shop': 'Open the shop',
    'play.lose.giveUp': 'Give up',
    'play.lose.lifeNote': 'Giving up or trying again costs a life.',
    'play.lose.caravan': '{n, plural, one {It also resets your Caravan of 1 win.} other {It also resets your Caravan of {n} wins.}}',

    // ── buying a booster in the level ──
    'play.buy.title': 'No {name} left',
    'play.buy.text': 'Buy one and use it right away?',
    'play.buy.poor': "You don't have enough coins for it.",
    'play.buy.shop': 'Shop',

    // ── tutorial tips ──
    'play.tut.ok': 'Got it',
    'play.tut.match.title': 'Match three',
    'play.tut.match.text': 'Slide a gem to a neighbouring tile to line up three of the same kind.',
    'play.tut.collect.title': 'Collect the gems',
    'play.tut.collect.text': 'The goal at the top shows which gems to collect. Clear them any way you like.',
    'play.tut.beam.title': 'The Beam',
    'play.tut.beam.text': 'Line up four gems to make a Beam. Match it and it clears a whole row or column.',
    'play.tut.nova.title': 'The Nova',
    'play.tut.nova.text': 'Match five gems in an L or T shape to make a Nova. It blasts everything around it.',
    'play.tut.prism.title': 'The Prism',
    'play.tut.prism.text': 'Line up five gems to make a Prism. Swap it with any gem to clear every gem of that kind.',
    'play.tut.combo.title': 'Combine them',
    'play.tut.combo.text': 'Swap two special pieces with each other for a much bigger blast.',
    'play.tut.sand.title': 'Sand',
    'play.tut.sand.text': 'Clear the gems resting on sand to sweep it away. Remove all the sand to win.',
    'play.tut.sand2.title': 'Deep sand',
    'play.tut.sand2.text': 'Deep sand takes two sweeps. Clear the gems on it twice.',
    'play.tut.stone.title': 'Stones',
    'play.tut.stone.text': 'Match right next to a stone to crack it. Hard stones need several cracks.',
    'play.tut.lamp.title': 'Lamps',
    'play.tut.lamp.text': 'Clear the gems under a lamp so it sinks to the bottom row and leaves the board.',
    'play.tut.chain.title': 'Chains',
    'play.tut.chain.text': 'A chained gem cannot move. Match it with gems of its kind to break the chain.',
    'play.tut.vine.title': 'Vines',
    'play.tut.vine.text': 'Match next to a vine to cut it. Cut at least one every move or it spreads.',
  },

  ar: {
    // ── HUD ──
    'play.aria.moves': '{n, plural, zero {لا حركات متبقية} one {حركة واحدة متبقية} two {حركتان متبقيتان} few {{n} حركات متبقية} other {{n} حركة متبقية}}',
    'play.aria.booster': '{name}: {n}',

    // ── praise (weakest → strongest) and the end-of-level phrase ──
    'play.praise.1': 'بريق!',
    'play.praise.2': 'تألُّق!',
    'play.praise.3': 'إبهار!',
    'play.praise.4': 'بهاء!',
    'play.praise.finale': 'وهج الواحة!',

    // ── banners ──
    'play.shuffle': 'لا حركات ممكنة — جارٍ الخلط',
    'play.target.hammer': 'اضغط على قطعة لتحطيمها',
    'play.target.freeSwap': 'بدّل أي قطعتين متجاورتين',
    'play.booster.noEffect': 'لا شيء يُضرب هنا',
    'play.booster.noSwap': 'لا يمكن تبديل هاتين القطعتين',
    'play.booster.noShuffle': 'لا شيء يُخلط الآن',

    // ── pause ──
    'play.pause.title': 'إيقاف مؤقت',
    'play.pause.restart': 'إعادة المرحلة',
    'play.pause.quit': 'العودة إلى الخريطة',
    'play.pause.sound': 'المؤثرات الصوتية',
    'play.pause.music': 'الموسيقى',
    'play.pause.haptics': 'الاهتزاز',
    'play.restart.title': 'إعادة المرحلة؟',
    'play.restart.text': 'سيضيع تقدّمك في هذه المرحلة.',
    'play.restart.yes': 'إعادة',
    'play.quit.title': 'مغادرة المرحلة؟',
    'play.quit.text': 'سيضيع تقدّمك في هذه المرحلة.',
    'play.quit.yes': 'مغادرة',
    'play.costLife': 'ستخسر قلبًا واحدًا.',
    'play.caravanReset': '{n, plural, one {ستعود قافلتك ذات الفوز الواحد إلى البداية.} two {ستعود قافلتك ذات الفوزين إلى البداية.} few {ستعود قافلتك ذات {n} انتصارات إلى البداية.} other {ستعود قافلتك ذات {n} انتصارًا إلى البداية.}}',
    'play.stay': 'متابعة اللعب',

    // ── win ──
    'play.win.title': 'اكتملت المرحلة!',
    'play.win.newBest': 'رقم قياسي جديد!',
    'play.win.coins': '{n, plural, zero {لم تكسب عملات} one {كسبت عملة واحدة} two {كسبت عملتين} few {كسبت {n} عملات} other {كسبت {n} عملة}}',
    'play.win.double': 'ضاعف العملات',
    'play.win.watch': 'شاهد مقطعًا',
    'play.win.doubled': 'تضاعفت العملات!',
    'play.win.map': 'الخريطة',
    'play.noVideo': 'لا يوجد مقطع متاح الآن.',

    // ── lose ──
    'play.lose.title': 'انتهت الحركات',
    'play.lose.missing': 'كدت تنجح! ما زال ينقصك:',
    'play.lose.stuckTitle': 'لا حركات ممكنة',
    'play.lose.stuck': 'لم تعد هناك أي حركة ممكنة على هذه اللوحة.',
    'play.lose.moves': '‎+{n} حركات',
    'play.lose.poor': 'عملاتك لا تكفي.',
    'play.lose.shop': 'افتح المتجر',
    'play.lose.giveUp': 'انسحاب',
    'play.lose.lifeNote': 'الانسحاب أو إعادة المحاولة يكلّفك قلبًا.',
    'play.lose.caravan': '{n, plural, one {وستعود قافلتك ذات الفوز الواحد إلى البداية.} two {وستعود قافلتك ذات الفوزين إلى البداية.} few {وستعود قافلتك ذات {n} انتصارات إلى البداية.} other {وستعود قافلتك ذات {n} انتصارًا إلى البداية.}}',

    // ── buying a booster in the level ──
    'play.buy.title': 'نفد معزّز «{name}»',
    'play.buy.text': 'هل تشتري واحدًا وتستخدمه فورًا؟',
    'play.buy.poor': 'عملاتك لا تكفي لشرائه.',
    'play.buy.shop': 'المتجر',

    // ── tutorial tips ──
    'play.tut.ok': 'فهمت',
    'play.tut.match.title': 'طابِق ثلاثًا',
    'play.tut.match.text': 'اسحب جوهرة إلى خانة مجاورة لتصطفّ ثلاث جواهر من النوع نفسه.',
    'play.tut.collect.title': 'اجمع الجواهر',
    'play.tut.collect.text': 'الهدف في الأعلى يبيّن الجواهر المطلوب جمعها. أزِلها بأي طريقة تشاء.',
    'play.tut.beam.title': 'الشعاع',
    'play.tut.beam.text': 'صُفّ أربع جواهر لتصنع شعاعًا. طابِقه فيزيل صفًّا أو عمودًا كاملًا.',
    'play.tut.nova.title': 'النوفا',
    'play.tut.nova.text': 'طابِق خمس جواهر على شكل L أو T لتصنع نوفا تفجّر كل ما حولها.',
    'play.tut.prism.title': 'المنشور',
    'play.tut.prism.text': 'صُفّ خمس جواهر لتصنع منشورًا. بدّله مع أي جوهرة ليزيل كل الجواهر من نوعها.',
    'play.tut.combo.title': 'ادمج القطع الخاصة',
    'play.tut.combo.text': 'بدّل قطعتين خاصتين إحداهما مع الأخرى لتحصل على انفجار أكبر بكثير.',
    'play.tut.sand.title': 'الرمال',
    'play.tut.sand.text': 'أزِل الجواهر التي فوق الرمال لتكنسها. أزِل الرمال كلها لتفوز.',
    'play.tut.sand2.title': 'الرمال العميقة',
    'play.tut.sand2.text': 'الرمال العميقة تحتاج إلى كنستين. أزِل الجواهر التي فوقها مرتين.',
    'play.tut.stone.title': 'الأحجار',
    'play.tut.stone.text': 'طابِق بجوار الحجر ليتشقّق. الأحجار الصلبة تحتاج إلى عدة ضربات.',
    'play.tut.lamp.title': 'الفوانيس',
    'play.tut.lamp.text': 'أزِل الجواهر التي تحت الفانوس لينزل إلى الصف الأخير ويغادر اللوحة.',
    'play.tut.chain.title': 'السلاسل',
    'play.tut.chain.text': 'الجوهرة المقيّدة لا تتحرك. طابِقها مع جواهر من نوعها لتنكسر السلسلة.',
    'play.tut.vine.title': 'النبات المتسلّق',
    'play.tut.vine.text': 'طابِق بجوار النبات المتسلّق لتقطعه. اقطع جزءًا منه في كل حركة وإلا انتشر.',
  },
};

export default table;

/**
 * Strings of the app shell and every screen outside the level itself: title, map, level intro,
 * lives, shop, settings, daily reward, privacy policy and credits. Every key starts with "meta.".
 * Shared words (Play, Shop, booster names, goal sentences, chapter names …) come from ./common.ts.
 * Arabic style and vocabulary: see the notes at the top of ./common.ts.
 */
import type { StringTable } from '../types.ts';

const table: StringTable = {
  en: {
    // ── map ──
    'meta.map.chapter': 'Chapter {n}',
    'meta.map.daily': 'Daily gift',
    'meta.map.home': 'Home',
    'meta.map.lockedToast': 'Win level {n} to open this one',
    'meta.map.comingSoon': 'More levels are on the way',
    'meta.map.finished.title': 'Journey complete!',
    'meta.map.finished.body': 'You have finished every level. New levels are on the way. Until then, go back and collect the stars you missed.',
    'meta.map.aria.done': 'Level {n}, {stars, plural, one {1 star} other {{stars} stars}}',
    'meta.map.aria.current': 'Level {n}, play',
    'meta.map.aria.locked': 'Level {n}, locked',
    'meta.map.aria.lives': 'Lives: {n}',
    'meta.map.aria.coins': 'Coins: {n}',
    'meta.map.aria.stars': 'Stars: {n}',

    // ── level intro ──
    'meta.intro.hard': 'Hard level',
    'meta.intro.moves': '{n, plural, one {1 move} other {{n} moves}}',
    'meta.intro.best': 'Best',
    'meta.intro.boosters': 'Start with a boost',
    'meta.intro.buyHint': 'You have none left. Buy one and start this level with it?',

    // ── Caravan (win streak) ──
    'meta.caravan.name': 'Caravan',
    'meta.caravan.brings': 'Free:',
    'meta.caravan.hint': 'Win in a row for free boosters.',
    'meta.caravan.wins': '{n, plural, one {1 win in a row} other {{n} wins in a row}}',

    // ── lives ──
    'meta.lives.outTitle': 'Out of lives',
    'meta.lives.full': 'Your lives are full',
    'meta.lives.next': 'Next life in',
    'meta.lives.refill': 'Refill all',
    'meta.lives.ad': '+1 life',
    'meta.lives.refilled': 'Lives refilled!',
    'meta.lives.gotOne': 'You got a life!',
    'meta.lives.regen': 'A life comes back every {n} minutes.',
    'meta.lives.need': 'You need a life to play this level.',

    // ── rewarded ads ──
    'meta.ad.watch': 'Watch an ad',
    'meta.ad.none': 'No ad is available right now. Please try again later.',
    'meta.ad.closed': 'The ad was closed early, so there is no reward this time.',
    'meta.ad.left': '{n, plural, =0 {No more today} one {1 left today} other {{n} left today}}',

    // ── shop ──
    'meta.shop.offers': 'Special offers',
    'meta.shop.coinPacks': 'Coin packs',
    'meta.shop.coins': '{n, plural, one {1 coin} other {{n} coins}}',
    'meta.shop.times': '{n} × {name}',
    'meta.shop.starter': 'Starter pack',
    'meta.shop.removeAds': 'Remove ads',
    'meta.shop.removeAdsSub': 'No ads between levels, even after a reinstall.',
    'meta.shop.noAdsIncluded': 'No ads',
    'meta.shop.payerNote': 'Any purchase turns off ads between levels on this device.',
    'meta.shop.badge.popular': 'Featured',
    'meta.shop.badge.best': 'Best value',
    'meta.shop.free': 'Free coins',
    'meta.shop.freeGot': 'You got {n} coins!',
    'meta.shop.purchased': 'Thank you! Your purchase is complete.',
    'meta.shop.pending': 'Your payment is pending. Your items will arrive as soon as it completes.',
    'meta.shop.alreadyOwned': 'You already own this.',
    'meta.shop.unavailable': 'The store is not available right now. Please try again later.',
    'meta.shop.error': 'The purchase could not be completed. Please try again.',
    'meta.shop.boosterBought': '{name} added to your boosters',
    'meta.shop.boostersLocked': 'Boosters appear here as you unlock them on your journey.',

    // ── settings ──
    'meta.settings.sfx': 'Sound effects',
    'meta.settings.music': 'Music',
    'meta.settings.haptics': 'Vibration',
    'meta.settings.language': 'Language',
    'meta.settings.privacyOptions': 'Privacy options',
    'meta.settings.restore': 'Restore purchases',
    'meta.settings.restored': '{n, plural, =0 {No purchases to restore} one {1 purchase restored} other {{n} purchases restored}}',
    'meta.settings.privacy': 'Privacy policy',
    'meta.settings.credits': 'Credits & licences',
    'meta.settings.rate': 'Rate the game',
    'meta.settings.reset': 'Reset progress',
    'meta.settings.reset1.title': 'Reset progress?',
    'meta.settings.reset1.body': 'This erases your levels, stars, coins and boosters on this device, including coins you bought.',
    'meta.settings.reset1.yes': 'Reset',
    'meta.settings.reset2.title': 'Are you sure?',
    'meta.settings.reset2.body': 'This cannot be undone.',
    'meta.settings.reset2.yes': 'Erase everything',
    'meta.settings.resetDone': 'Your progress has been reset',
    'meta.settings.version': 'Version {v}',

    // ── daily reward ──
    'meta.daily.title': 'Daily reward',
    'meta.daily.hint': 'Come back every day. Missing a day starts again from day 1.',
    'meta.daily.next': 'Next reward in',
    'meta.daily.received': 'You received',
    'meta.daily.claimed': 'Claimed',

    // ── a booster unlocks ──
    'meta.unlock.title': 'New booster!',
    'meta.unlock.gift': 'A gift, so you can try it out',
    'meta.unlock.ok': 'Got it',

    // ── errors ──
    'meta.error.generic': 'Something went wrong. If it keeps happening, please restart the game.',
    'meta.error.level': 'This level could not be opened.',

    // ── privacy policy ──
    'meta.privacy.intro': 'The short and plain version of how {game} treats your data.',
    'meta.privacy.none.title': 'No accounts, no personal data',
    'meta.privacy.none.body': '{game} has no accounts and never asks for your name, email or any other personal information. The game itself collects no personal data.',
    'meta.privacy.save.title': 'Your progress stays on your device',
    'meta.privacy.save.body': "Your levels, coins and settings are saved on this device. If the device's own Google backup is switched on, that save may be included in your backup.",
    'meta.privacy.pay.title': 'Purchases',
    'meta.privacy.pay.body': 'Purchases are processed by Google Play. The game never sees your payment details.',
    'meta.privacy.ads.title': 'Ads',
    'meta.privacy.ads.body': 'If the version you installed shows ads, they are served by Google AdMob, which may collect device identifiers and usage data to show and measure ads. Where the law requires it, you can review your consent choices under "Privacy options" in Settings.',
    'meta.privacy.kids.title': 'Children',
    'meta.privacy.kids.body': 'The game is not directed at children under 13.',
    'meta.privacy.contact.title': 'Contact',
    'meta.privacy.contact.body': "Questions? Write to the developer contact shown on the game's Google Play page.",

    // ── credits & licences ──
    'meta.credits.game': 'An original puzzle game. Thank you for playing!',
    'meta.credits.made': 'All artwork, sound effects and music are original and were created in code for this game.',
    'meta.credits.font.title': 'Font',
    'meta.credits.font.body': 'The game uses the typeface "Baloo Bhaijaan 2", licensed under the SIL Open Font License, Version 1.1.',
    'meta.credits.licenceNote': 'The licence text follows in its original English wording.',
  },

  ar: {
    // ── map ──
    'meta.map.chapter': 'الفصل {n}',
    'meta.map.daily': 'هدية اليوم',
    'meta.map.home': 'الرئيسية',
    'meta.map.lockedToast': 'فُز بالمرحلة {n} لتفتح هذه المرحلة',
    'meta.map.comingSoon': 'مراحل جديدة في الطريق',
    'meta.map.finished.title': 'اكتملت الرحلة!',
    'meta.map.finished.body': 'أنهيت كل المراحل. مراحل جديدة في الطريق، وحتى ذلك الحين عُد واجمع النجوم التي فاتتك.',
    'meta.map.aria.done': 'المرحلة {n}، {stars, plural, one {نجمة واحدة} two {نجمتان} few {{stars} نجوم} other {{stars} نجمة}}',
    'meta.map.aria.current': 'المرحلة {n}، العب',
    'meta.map.aria.locked': 'المرحلة {n}، مقفلة',
    'meta.map.aria.lives': 'القلوب: {n}',
    'meta.map.aria.coins': 'العملات: {n}',
    'meta.map.aria.stars': 'النجوم: {n}',

    // ── level intro ──
    'meta.intro.hard': 'مرحلة صعبة',
    'meta.intro.moves': '{n, plural, one {حركة واحدة} two {حركتان} few {{n} حركات} other {{n} حركة}}',
    'meta.intro.best': 'أفضل نتيجة',
    'meta.intro.boosters': 'ابدأ بمعزّز',
    'meta.intro.buyHint': 'لم يبقَ لديك منه شيء. هل تشتري واحدًا لتبدأ به هذه المرحلة؟',

    // ── Caravan (win streak) ──
    'meta.caravan.name': 'القافلة',
    'meta.caravan.brings': 'مجانًا:',
    'meta.caravan.hint': 'فُز تباعًا لتحصل على معزّزات مجانية.',
    'meta.caravan.wins': '{n, plural, one {فوز واحد متتالٍ} two {فوزان متتاليان} few {{n} انتصارات متتالية} other {{n} فوزًا متتاليًا}}',

    // ── lives ──
    'meta.lives.outTitle': 'نفدت القلوب',
    'meta.lives.full': 'قلوبك مكتملة',
    'meta.lives.next': 'القلب التالي بعد',
    'meta.lives.refill': 'تعبئة الكل',
    'meta.lives.ad': '‎+1 قلب',
    'meta.lives.refilled': 'تمت تعبئة القلوب!',
    'meta.lives.gotOne': 'حصلت على قلب!',
    'meta.lives.regen': 'يعود قلب واحد كل {n} دقيقة.',
    'meta.lives.need': 'تحتاج إلى قلب لتلعب هذه المرحلة.',

    // ── rewarded ads ──
    'meta.ad.watch': 'شاهد إعلانًا',
    'meta.ad.none': 'لا يوجد إعلان متاح الآن. حاول مرة أخرى لاحقًا.',
    'meta.ad.closed': 'أُغلق الإعلان قبل نهايته، فلا مكافأة هذه المرة.',
    'meta.ad.left': '{n, plural, =0 {انتهت إعلانات اليوم} one {بقي إعلان واحد اليوم} two {بقي إعلانان اليوم} few {بقي {n} إعلانات اليوم} other {بقي {n} إعلانًا اليوم}}',

    // ── shop ──
    'meta.shop.offers': 'عروض خاصة',
    'meta.shop.coinPacks': 'حزم العملات',
    'meta.shop.coins': '{n, plural, one {عملة واحدة} two {عملتان} few {{n} عملات} other {{n} عملة}}',
    'meta.shop.times': '{n} × {name}',
    'meta.shop.starter': 'حزمة البداية',
    'meta.shop.removeAds': 'إزالة الإعلانات',
    'meta.shop.removeAdsSub': 'بلا إعلانات بين المراحل، حتى بعد إعادة التثبيت.',
    'meta.shop.noAdsIncluded': 'بلا إعلانات',
    'meta.shop.payerNote': 'أي عملية شراء توقف الإعلانات بين المراحل على هذا الجهاز.',
    'meta.shop.badge.popular': 'مميّزة',
    'meta.shop.badge.best': 'أفضل قيمة',
    'meta.shop.free': 'عملات مجانية',
    'meta.shop.freeGot': 'حصلت على {n} عملة!',
    'meta.shop.purchased': 'شكرًا لك! اكتملت عملية الشراء.',
    'meta.shop.pending': 'عملية الدفع قيد الانتظار، وستصلك مشترياتك فور اكتمالها.',
    'meta.shop.alreadyOwned': 'أنت تملك هذا العرض بالفعل.',
    'meta.shop.unavailable': 'المتجر غير متاح الآن. حاول مرة أخرى لاحقًا.',
    'meta.shop.error': 'تعذّر إتمام عملية الشراء. حاول مرة أخرى.',
    'meta.shop.boosterBought': 'أُضيف «{name}» إلى معزّزاتك',
    'meta.shop.boostersLocked': 'ستظهر المعزّزات هنا كلما فتحتها خلال رحلتك.',

    // ── settings ──
    'meta.settings.sfx': 'المؤثرات الصوتية',
    'meta.settings.music': 'الموسيقى',
    'meta.settings.haptics': 'الاهتزاز',
    'meta.settings.language': 'اللغة',
    'meta.settings.privacyOptions': 'خيارات الخصوصية',
    'meta.settings.restore': 'استعادة المشتريات',
    'meta.settings.restored': '{n, plural, =0 {لا توجد مشتريات لاستعادتها} one {تمت استعادة عملية شراء واحدة} two {تمت استعادة عمليتَي شراء} few {تمت استعادة {n} مشتريات} other {تمت استعادة {n} عملية شراء}}',
    'meta.settings.privacy': 'سياسة الخصوصية',
    'meta.settings.credits': 'الشكر والتراخيص',
    'meta.settings.rate': 'قيّم اللعبة',
    'meta.settings.reset': 'إعادة ضبط التقدّم',
    'meta.settings.reset1.title': 'إعادة ضبط التقدّم؟',
    'meta.settings.reset1.body': 'سيُمحى تقدّمك في المراحل ونجومك وعملاتك ومعزّزاتك من هذا الجهاز، بما فيها العملات التي اشتريتها.',
    'meta.settings.reset1.yes': 'إعادة الضبط',
    'meta.settings.reset2.title': 'هل أنت متأكد؟',
    'meta.settings.reset2.body': 'لا يمكن التراجع عن هذه الخطوة.',
    'meta.settings.reset2.yes': 'امحُ كل شيء',
    'meta.settings.resetDone': 'أُعيد ضبط تقدّمك',
    'meta.settings.version': 'الإصدار {v}',

    // ── daily reward ──
    'meta.daily.title': 'المكافأة اليومية',
    'meta.daily.hint': 'عُد كل يوم، فتفويت يوم واحد يعيدك إلى اليوم الأول.',
    'meta.daily.next': 'المكافأة التالية بعد',
    'meta.daily.received': 'حصلت على',
    'meta.daily.claimed': 'تم الاستلام',

    // ── a booster unlocks ──
    'meta.unlock.title': 'معزّز جديد!',
    'meta.unlock.gift': 'هدية لتجرّبه بنفسك',
    'meta.unlock.ok': 'فهمت',

    // ── errors ──
    'meta.error.generic': 'حدث خطأ ما. إذا تكرّر ذلك، أعد تشغيل اللعبة.',
    'meta.error.level': 'تعذّر فتح هذه المرحلة.',

    // ── privacy policy ──
    'meta.privacy.intro': 'الخلاصة الواضحة لطريقة تعامل «{game}» مع بياناتك.',
    'meta.privacy.none.title': 'لا حسابات ولا بيانات شخصية',
    'meta.privacy.none.body': 'لا توجد حسابات في «{game}»، ولا تطلب اللعبة اسمك أو بريدك الإلكتروني أو أي معلومات شخصية أخرى. اللعبة نفسها لا تجمع أي بيانات شخصية.',
    'meta.privacy.save.title': 'تقدّمك يبقى على جهازك',
    'meta.privacy.save.body': 'تُحفظ مراحلك وعملاتك وإعداداتك على هذا الجهاز. وإذا كان النسخ الاحتياطي من Google مفعّلًا في جهازك، فقد يُضمَّن هذا الحفظ في نسختك الاحتياطية.',
    'meta.privacy.pay.title': 'المشتريات',
    'meta.privacy.pay.body': 'تُعالَج عمليات الشراء عبر Google Play، ولا تطّلع اللعبة على بيانات الدفع الخاصة بك.',
    'meta.privacy.ads.title': 'الإعلانات',
    'meta.privacy.ads.body': 'إذا كانت النسخة التي ثبّتَّها تعرض إعلانات، فمصدرها Google AdMob التي قد تجمع معرّفات الجهاز وبيانات الاستخدام لعرض الإعلانات وقياس أدائها. وحيثما يوجب القانون ذلك، يمكنك مراجعة خيارات موافقتك من «خيارات الخصوصية» في الإعدادات.',
    'meta.privacy.kids.title': 'الأطفال',
    'meta.privacy.kids.body': 'اللعبة غير موجّهة إلى الأطفال دون سن 13 عامًا.',
    'meta.privacy.contact.title': 'التواصل',
    'meta.privacy.contact.body': 'لديك سؤال؟ راسلنا عبر وسيلة التواصل مع المطوّر المذكورة في صفحة اللعبة على Google Play.',

    // ── credits & licences ──
    'meta.credits.game': 'لعبة ألغاز أصلية. شكرًا لأنك تلعب!',
    'meta.credits.made': 'كل الرسوم والمؤثرات الصوتية والموسيقى أصلية، ووُلِّدت برمجيًا لهذه اللعبة.',
    'meta.credits.font.title': 'الخط',
    'meta.credits.font.body': 'تستخدم اللعبة الخط «Baloo Bhaijaan 2» المرخَّص برخصة SIL للخطوط المفتوحة (SIL Open Font License)، الإصدار 1.1.',
    'meta.credits.licenceNote': 'يرد نص الترخيص أدناه بصيغته الإنجليزية الأصلية.',
  },
};

export default table;

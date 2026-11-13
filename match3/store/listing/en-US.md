<div dir="rtl">

# بطاقة المتجر — الإنجليزية (English – en-US) — النص النهائي

هذه نصوص صفحة «زمرد» على Google Play بالإنجليزية، وهي **اللغة الافتراضية** للبطاقة (<span dir="ltr">en-US</span>). النص مكتوب بالإملاء الأمريكي ويخدم كل المتاجر الإنجليزية.

- **النسخة المعتمدة الوحيدة** للنص الإنجليزي هي هذا الملف. النصوص نفسها حرفيًّا في <span dir="ltr">`store/listing/fields.json`</span> (تحت المفتاح <span dir="ltr">`"en-US"`</span>) ليلصقها المساعد الآلي دون إعادة كتابة؛ ذلك الملف **يُولَّد** من هذا الملف ولا يُعدَّل باليد.
- أعداد الأحرف تحت كل مربّع **محسوبة بالسكربت**. بعد أي تعديل شغّل من مجلد <span dir="ltr">`match3`</span>:
  <span dir="ltr">`node store/aso/check-listing.cjs --write`</span> ثم <span dir="ltr">`node store/aso/check-listing.cjs --cross-check`</span>.
- حدود Google Play: الاسم 30 حرفًا، الوصف القصير 80، الوصف الكامل 4000، ملاحظات الإصدار 500 لكل لغة.
- لماذا هذه الكلمات بالذات؟ الشرح والأرقام في <span dir="ltr">`store/aso/KEYWORDS.md`</span>.

---

## 1) اسم التطبيق — `App name`

<!-- field: title | limit: 30 -->
<div dir="ltr">

```text
Zumurud: Gem Match 3 Puzzle
```

</div>

**عدد الأحرف:** 27 / 30

**لماذا تغيّر عن الاسم السابق (<span dir="ltr">Zumurud: Gem Match Puzzle</span>)؟** أُضيف الرقم «3» فقط:

- <span dir="ltr">«match 3»</span> هو اسم النوع الذي يكتبه اللاعبون: <span dir="ltr">«match 3 games»</span> يقترحه المتجر الأمريكي بعد كتابة ثلاثة أحرف فقط (<span dir="ltr">«mat»</span>)، و26 من 50 لعبة متصدّرة في النوع تضعه في اسمها. والاسم هو أثقل خانة في البحث.
- العلامة «Zumurud» بقيت أول كلمة، فلا يتغيّر شيء في تميّز الاسم الذي أجازه بحث التسمية.
- فحصتُ الذيل <span dir="ltr">«Gem Match 3 Puzzle»</span> في 8 متاجر إنجليزية (478 عنوانًا في النتائج): لا لعبة تحمله ولا تحتويه. أما <span dir="ltr">«Jewel Match 3 Puzzle»</span> وأشباهه فعناوين قائمة لألعاب أخرى، ولذلك لم نستعملها.
- لا تختصر الاسم أبدًا إلى أول ثلاثة أحرف أو أربعة منه (تحذير بحث التسمية).

> **تنبيه:** الاسم يُكتب أيضًا عند إنشاء التطبيق (<span dir="ltr">`Create app`</span>) في دليل النشر؛ اكتب هناك الاسم نفسه الموجود في هذا المربّع.

## 2) الوصف القصير — `Short description`

<!-- field: short | limit: 80 -->
<div dir="ltr">

```text
Match 3 jewels across a desert oasis: 120 puzzle levels, playable offline
```

</div>

**عدد الأحرف:** 72 / 80

أهم سطر في الصفحة: يجمع الفكرة (<span dir="ltr">match 3 jewels</span>)، والمكان (<span dir="ltr">desert oasis</span>)، والحجم (<span dir="ltr">120 puzzle levels</span>)، وأقوى ميزة صادقة (<span dir="ltr">offline</span>). جملة واحدة، فلا نقطة في آخرها (قاعدة Google: النقطة فقط إذا كان الوصف أكثر من جملة).

## 3) الوصف الكامل — `Full description`

<!-- field: full | limit: 4000 -->
<div dir="ltr">

```text
Zumurud is an offline match 3 puzzle game set among the jewels of a moonlit desert oasis. Swap gems to match three or more, combine special pieces into board-clearing combos, and journey through 120 levels in six worlds, from the Oasis to the Starlit Sky. No Wi-Fi is needed to play, and there is no account to create.

How to play
• The classic match 3 rule: swap two adjacent gems to get three or more of the same kind in a row.
• Complete each level's goal before you run out of moves. Levels are limited by moves, not by a timer, so you can think at your own pace.
• Earn up to three stars on every level, and replay any level to improve your score.

Special pieces and combos
• Beam: match four gems in a line. It clears a whole row or column.
• Nova: match gems in an L or T shape. It bursts and clears everything around it.
• Prism: match five gems in a line. Swap it with any gem to clear every gem of that color.
• Swap two special pieces with each other for a bigger effect. There are six combos to discover.

Six worlds, 120 levels
Oasis, Dunes, Bazaar, Palace, Caverns and Starlit Sky: each world is a chapter of twenty levels with its own backdrop. Goals change as you go: reach a score, collect jewels of one color, clear the sand, break stones and chains, cut back vines before they spread, or bring brass lamps down to the bottom of the board.

Jewels you can tell apart at a glance
Ruby, amber, emerald, sapphire, amethyst and moonstone: each jewel has its own color and its own cut, so the board stays readable on a small screen and for players who find some colors hard to tell apart.

Boosters and rewards
• Six boosters, each introduced with a gift so you can learn it by using it: a hammer, a swap that needs no match, a shuffle, extra moves, and head starts with special pieces already on the board.
• The Caravan: win levels in a row and your next level starts with special pieces waiting on the board.
• A daily gift on a seven-day cycle.
• Five lives: failing a level costs one, one returns every 30 minutes, and winning never costs a life.

Play anywhere
• A match 3 game that works offline: the puzzle levels need no Wi-Fi and no mobile data, so you can play in airplane mode, on a flight or on your commute.
• Single player. Your progress is saved on your device.
• English and Arabic, with a full right-to-left layout in Arabic. Switch language at any time in Settings.
• Artwork and sound made for this game, with a calm, relaxing soundtrack led by an oud-like melody.
• Made for teens and adults aged 13 and over who enjoy jewel games and matching puzzles.

Purchases and ads, stated plainly
You can install Zumurud and finish all 120 levels without paying. The game contains optional in-app purchases, handled by Google Play: packs of coins, a one-time starter pack, and an option that removes the ads shown between levels. Coins are also earned by playing. The game contains ads: video ads that give a reward play only when you choose to watch one, and ads between levels are occasional, never interrupt a level, and stop for good after any purchase. Playing needs no connection; only purchases and ads do.

Zumurud is the Arabic word for emerald. The oasis is waiting: make your first match and see how far the caravan takes you.
```

</div>

**عدد الأحرف:** 0 / 4000

**كيف بُني:** أول ثلاثة أسطر تبيع اللعبة وفيها الكلمات الأساسية الأربع (<span dir="ltr">offline · match 3 · puzzle · jewels</span>) داخل أول 160 حرفًا، وهو ما يظهر قبل زر «المزيد». بعدها أقسام قصيرة بعناوين ونقاط: طريقة اللعب، القطع الخاصة والتركيبات، العوالم، الجواهر، المعزّزات والمكافآت، اللعب بلا اتصال واللغات، ثم المشتريات والإعلانات بوضوح، وسطر ختامي يدعو إلى اللعب بلا عبارات ممنوعة. لا قوائم كلمات، ولا ذكر لأي لعبة أخرى، وكل رقم فيه يطابق اللعبة (السكربت يقارنه بملفات اللعبة نفسها).

### إذا رفعتَ النسخة التي **بلا إعلانات** (`plain`)

الوصف أعلاه يقول إن اللعبة فيها إعلانات، وهذا صحيح لنسخة `ads` فقط. إذا كان ملف <span dir="ltr">`.aab`</span> المرفوع هو نسخة `plain` (وإجابتك في <span dir="ltr">`App content > Ads`</span> هي <span dir="ltr">`No`</span>) فاستبدل قسم <span dir="ltr">«Purchases and ads, stated plainly»</span> كله (العنوان وفقرته) بهذا المربّع. النص الكامل بعد الاستبدال جاهز في <span dir="ltr">`fields.json`</span> تحت <span dir="ltr">`ifTheBuildHasNoAds`</span>.

<!-- alt: full-without-ads | replaces-section: "Purchases and ads, stated plainly" | limit: 4000 -->
<div dir="ltr">

```text
Purchases, stated plainly
You can install Zumurud and finish all 120 levels without paying. The game contains optional in-app purchases, handled by Google Play: packs of coins and a one-time starter pack. Coins are also earned by playing. Playing needs no connection; only purchases do.
```

</div>

**عدد الأحرف:** 0 / 4000

## 4) ملاحظات الإصدار 1.0.0 — `Release notes` (ما الجديد)

تُكتب في صفحة الإصدار نفسها عند إنشائه، داخل الوسم <span dir="ltr">`<en-US>` … `</en-US>`</span>، لا في بطاقة المتجر.

<!-- field: whatsnew | limit: 500 -->
<div dir="ltr">

```text
Welcome to Zumurud, a match 3 puzzle game with jewels, set in a desert oasis.
• 120 levels in six worlds, from the Oasis to the Starlit Sky
• Three special pieces (Beam, Nova and Prism) and six combos
• Sand, stones, chains and vines to clear, and lamps to bring down
• Six boosters, the Caravan win streak and a daily gift
• Plays offline, in English and Arabic
```

</div>

**عدد الأحرف:** 0 / 500

---

## 5) الفئة والوسوم — `Store settings`

تُضبط مرة واحدة للتطبيق كله (لا لكل لغة) من <span dir="ltr">`Grow users > Store presence > Store settings`</span>.

| الخانة | ما تختاره |
|---|---|
| <span dir="ltr">`App or game`</span> | <span dir="ltr">`Game`</span> |
| <span dir="ltr">`Category`</span> | <span dir="ltr">`Puzzle`</span> |
| <span dir="ltr">`Tags`</span> (زر <span dir="ltr">`Manage tags`</span>) | خمسة على الأكثر. اختر **بالترتيب** أول خمسة تجدها في قائمة الاختيار من: <span dir="ltr">`Match 3`</span> ثم <span dir="ltr">`Puzzle`</span> ثم <span dir="ltr">`Gems & jewels`</span> ثم <span dir="ltr">`Casual`</span> ثم <span dir="ltr">`Offline`</span>، والاحتياطي <span dir="ltr">`Single player`</span>. |

- هذه الأسماء هي ما يعرضه Google Play نفسه على صفحات ألعاب هذا النوع (قُرئت من 44 صفحة). قائمة الاختيار داخل Play Console لا تُرى إلا من حسابك؛ إن لم تجد وسمًا منها فتجاوزه إلى الذي بعده، و**لا تختر وسمًا من خارج هذه القائمة** (مثل <span dir="ltr">`Match 3 adventure`</span>: اللعبة بلا قصة).
- إذا كانت واجهة Play Console عندك بالعربية فالأسماء المقابلة: «مطابقة 3»، «ألغاز»، «أحجار كريمة وجواهر»، «الألعاب البسيطة»، «بلا اتصال بالإنترنت»، «اللعب الفردي».
- اختر الفئة التي تنطبق فعلًا: معايير الجودة التقنية تُحتسب بحسب فئة المتجر، وتغيير الفئة للتحايل عليها مخالف لسياسة البيانات الوصفية.

## 6) بيانات التواصل

في قسم بيانات التواصل من صفحة <span dir="ltr">`Store settings`</span>. القيم المسجّلة في <span dir="ltr">`store/owner.json`</span>:

| الخانة | مطلوبة؟ | ماذا تكتب |
|---|---|---|
| <span dir="ltr">`Email address`</span> | **نعم** | بريد حساب Play Console نفسه (أنت من يدخله؛ ليس مكتوبًا في أي ملف هنا). تلتزم بالرد على استفسارات المشتريات خلال 3 أيام عمل. |
| <span dir="ltr">`Website`</span> | إلزامية مع الإعلانات | <span dir="ltr">`https://zumurud-privacy.almutafawiqin.workers.dev/`</span> |
| <span dir="ltr">`Phone number`</span> | اختيارية | راجع <span dir="ltr">`store/PUBLISHING-GUIDE.ar.md`</span> (صفة التاجر). |
| <span dir="ltr">`Privacy policy`</span> (في <span dir="ltr">`App content`</span>) | **نعم** | <span dir="ltr">`https://zumurud-privacy.almutafawiqin.workers.dev/`</span> |

## 7) الصور المرافقة لهذه اللغة

الأيقونة والصورة المميّزة ولقطات الشاشة الإنجليزية في <span dir="ltr">`store/graphics/`</span> و<span dir="ltr">`store/screenshots/`</span>؛ القائمة المحدّثة بأسمائها ومقاساتها في <span dir="ltr">`store/README.md`</span>.

</div>

<div dir="rtl">

# بطاقة المتجر — الإنجليزية (English – en-US)

هذه نصوص صفحة اللعبة على Google Play باللغة الإنجليزية، وهي **اللغة الافتراضية** للبطاقة (Google Play يجعل الإنجليزية الأمريكية en-US هي الافتراضية عند الرفع).
انسخ محتوى كل مربّع كما هو والصقه في الخانة المذكورة فوقه في صفحة بطاقة المتجر الرئيسية (`Main store listing`) في Play Console.

- أعداد الأحرف المكتوبة تحت كل مربّع **محسوبة آليًّا** بالأمر `node tools/store/check-kit.cjs` (لا تخمين). إذا عدّلت نصًّا فأعد تشغيل الأمر مع <span dir="ltr">`--write-counts`</span> ليحدّث الأرقام ويتأكد من الحدود.
- حدود Google Play: الاسم 30 حرفًا، الوصف القصير 80، الوصف الكامل 4000، ملاحظات الإصدار 500 لكل لغة.
- النصوص تلتزم بسياسة البيانات الوصفية: لا رموز تعبيرية، لا كلمات بأحرف كبيرة للتشديد، لا كلمات ترتيب أو سعر أو ترويج، لا ذكر لأي لعبة أخرى ولا مقارنة بها، ولا تكرار للوصف القصير داخل الوصف الكامل.

---

## 1) اسم التطبيق — `App name`

<!-- field: title | limit: 30 -->
<div dir="ltr">

```text
Zumurud: Gem Match Puzzle
```

</div>

**عدد الأحرف:** 25 / 30

> الاسم نفسه موصى به في بحث التسمية (`docs/research/naming-ip.md`): كلمة العلامة «Zumurud» مع ذيل وصفي بحت يتجنّب التشابه مع ألعاب أخرى. لا تختصر الاسم أبدًا إلى أول ثلاثة أحرف أو أربعة منه.

## 2) الوصف القصير — `Short description`

<!-- field: short | limit: 80 -->
<div dir="ltr">

```text
Swap gems, forge beams and novas, and cross 120 levels of a desert oasis.
```

</div>

**عدد الأحرف:** 73 / 80

## 3) الوصف الكامل — `Full description`

<!-- field: full | limit: 4000 -->
<div dir="ltr">

```text
Zumurud is a match-3 puzzle game set among the jewels of a desert oasis. Line up three or more gems of a kind by swapping two neighbours, and finish each level's goal before you run out of moves. Your journey starts beside the water at dawn and climbs, chapter by chapter, to a sky full of stars.

Gems you can tell apart at a glance
Six gems: ruby, amber, emerald, sapphire, amethyst and moonstone. Each one has its own colour and its own cut, so the board stays readable on a small screen and for players who find some colours hard to tell apart.

Three special pieces, six combinations
- Line up four gems to forge a Beam that clears a whole row or column.
- Match in an L or T shape to make a Nova that blasts everything around it.
- Line up five to create a Prism. Swap it with any gem to clear every gem of that kind.
- Swap two special pieces with each other for a bigger effect. There are six combinations to discover.

120 levels in six chapters
Oasis, Dunes, Bazaar, Palace, Caverns and Starlit Sky: twenty levels each, every chapter with its own backdrop. Levels ask for different things: reach a score, collect gems of one colour, clear the sand, break stones, break chains, cut back vines before they spread, or bring brass lamps down to the bottom of the board. Earn up to three stars on every level and replay any of them to improve your result.

Help when you want it
- Six boosters, introduced one at a time as you progress: a hammer, a swap that needs no match, a shuffle, extra moves, and head starts with special pieces already on the board.
- The Caravan: win levels in a row and the next one begins with special pieces waiting for you.
- A daily reward on a seven-day cycle.
- Finish with moves to spare and each of them turns into a Beam for a closing burst of points.

Clear rules
You have five lives. Losing a level costs one, one comes back every 30 minutes, and winning never costs a life.

Made to be comfortable
- English and Arabic, with a full right-to-left layout. Switch language at any time in Settings.
- The levels play offline. There is no account and no sign-up.
- Original artwork and sound effects, and a calm soundtrack with an oud-like melody.
- Separate switches for sound effects, music and vibration.

Purchases and ads, stated plainly
You can install Zumurud and complete every level without paying. The game offers optional in-app purchases that cost real money: packs of coins, a one-time starter pack, and an option that removes the ads shown between levels. Coins are also earned by playing. If the version you install shows ads, video ads that give a reward play only when you choose to watch one. Ads between levels are occasional, never interrupt a level, and stop for good after any purchase.

Zumurud is the Arabic word for emerald.
```

</div>

**عدد الأحرف:** 2787 / 4000

> إذا نشرت النسخة التي **لا تحتوي إعلانات** (`plain`) فقط، فاحذف الجملتين الأخيرتين من فقرة «Purchases and ads» (من `If the version you install shows ads` إلى آخر الفقرة) واحذف عبارة <span dir="ltr">`, and an option that removes the ads shown between levels`</span>، ثم أعد حساب الأحرف.

## 4) ملاحظات الإصدار 1.0.0 — `Release notes` (ما الجديد)

تُكتب في صفحة الإصدار نفسها (عند إنشاء الإصدار)، لا في بطاقة المتجر.

<!-- field: whatsnew | limit: 500 -->
<div dir="ltr">

```text
Welcome to the first release of Zumurud.
- 120 levels across six chapters, from the Oasis to the Starlit Sky
- Three special pieces (Beam, Nova and Prism) and six ways to combine them
- Six boosters, the Caravan win streak and a daily reward
- English and Arabic
```

</div>

**عدد الأحرف:** 262 / 500

---

## 5) التصنيف والوسوم — `Store settings`

تُضبط في صفحة إعدادات المتجر (`Store settings`) في Play Console.

| الخانة | ما تختاره |
|---|---|
| `App or game` | `Game` |
| `Category` | `Puzzle` |
| `Tags` | خمسة وسوم على الأكثر. اختر من القائمة التي تعرضها الصفحة ما يطابق هذه المعاني: ألغاز المطابقة (match 3)، ألغاز (puzzle)، لعبة خفيفة (casual)، لاعب واحد (single player)، تُلعب بلا اتصال (offline). الأسماء الدقيقة هي التي تظهر في القائمة؛ لا تختر وسمًا لا ينطبق على اللعبة. |

> اختر الفئة التي تنطبق فعلًا على اللعبة: معايير الجودة التقنية تُحتسب بحسب فئة المتجر، وتغيير الفئة للتحايل عليها مخالف لسياسة البيانات الوصفية.

## 6) بيانات التواصل — عليك أنت تعبئتها

تُكتب في قسم بيانات التواصل (contact details) من صفحة إعدادات المتجر (`Store settings`).

| الخانة | مطلوبة؟ | ماذا تكتب |
|---|---|---|
| `Email address` | **نعم، إلزامية** | بريد تتابعه فعلًا. تلتزم بالرد على استفسارات المشتريات خلال 3 أيام عمل. **⟦املأ: بريد التواصل⟧** |
| `Website` | اختيارية للنشر، **إلزامية إذا فعّلت الإعلانات** | عنوان موقع تتحكم فيه؛ AdMob يبحث عن ملف `app-ads.txt` في نطاق هذا العنوان. **⟦املأ: عنوان الموقع⟧** |
| `Phone number` | اختيارية هنا | إذا صرّحت بأنك «تاجر» (Trader) بحساب شخصي فسيُطلب منك رقم هاتف يُعرض للعموم — راجع `store/PUBLISHING-GUIDE.ar.md`. **⟦املأ إن أردت⟧** |
| `Privacy policy` | **نعم، إلزامية** | تُدخل في صفحة `App content` (خانة `Privacy policy`): رابط صفحة `store/privacy/index.html` بعد نشرها (راجع `store/privacy/HOSTING.md`). **⟦املأ: رابط سياسة الخصوصية⟧** |

## 7) الصور المرافقة لهذه اللغة

| الخانة في Play Console | الملف |
|---|---|
| `App icon` (512×512) | `store/graphics/icon-512.png` |
| `Feature graphic` (<span dir="ltr">1024×500</span>) | `store/graphics/feature-graphic.png` |
| `Phone screenshots` (<span dir="ltr">1080×1920</span>) | `store/screenshots/en/*.png` — تُلتقط لاحقًا بالأمر `node tools/store/make-screenshots.cjs` |

</div>

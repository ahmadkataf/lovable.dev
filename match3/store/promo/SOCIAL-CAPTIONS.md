<div dir="rtl">

# منشورات التواصل الاجتماعي — «زمرد»

ثلاثة منشورات جاهزة بالإنجليزية والعربية، لكل منها صيغتان: **طويلة** (Instagram و Facebook و TikTok و LinkedIn) و**قصيرة** لمنصة X (280 حرفًا بما فيها الرابط والوسوم). ومعها نص بديل `Alt text` لكل صورة.

- `<br>` داخل النص معناها **سطر جديد**: عند اللصق اضغط Enter مكانها.
- الأعداد محسوبة بالسكربت (<span dir="ltr">`node tools/store/make-promo.cjs --write-counts`</span>)، والسطر الجديد يُحسب حرفًا واحدًا. منصة X تحسب أي رابط 23 حرفًا، فالعدد المكتوب هنا أشدّ من عدّها.
- في Instagram الروابط داخل النص لا تُفتح: احذف سطر الرابط واكتب مكانه <span dir="ltr">`Link in bio.`</span> / «الرابط في الملف الشخصي.» وضع الرابط في صفحة الحساب.
- النصوص بلا رموز تعبيرية عمدًا؛ يمكنك إضافة رمز أو اثنين في **المنشورات** فقط (لا في نصوص الإعلانات المدفوعة). ولا تضف وسمًا يحمل اسم لعبة أو علامة أخرى.
- منشور الإطلاق يُنشر **يوم ظهور اللعبة فعلًا على Google Play** لا قبله.

| المنشور | الصورة المقترحة | متى |
|---|---|---|
| الإطلاق | <span dir="ltr">`A-hero-board`</span> (مربعة أو 4:5، والقصة <span dir="ltr">1080×1920</span>) | يوم النشر |
| منتصف الرحلة (المرحلة 60) | <span dir="ltr">`B-worlds`</span> | في أي وقت بعد النشر |
| اللعب بدون نت | <span dir="ltr">`C-specials`</span> أو <span dir="ltr">`A-hero-board`</span> | في أي وقت بعد النشر، ويناسب مواسم السفر |

---

## 1) يوم الإطلاق

<div dir="ltr">

| ID | Text | Count |
|---|---|---|
| `S-EN-LAUNCH-LONG` | Zumurud is on Google Play today.<br><br>A match 3 puzzle with jewels, set under a desert night sky: 120 levels in six worlds, from the Oasis to the Starlit Sky. Three special pieces, six combos, and levels that play offline. In English and Arabic.<br><br>https://play.google.com/store/apps/details?id=com.zumurud.game<br><br>#Zumurud #PuzzleGame #Match3 #GemPuzzle #AndroidGames | 0 / 2200 |
| `S-EN-LAUNCH-X` | Zumurud is on Google Play today: a match 3 puzzle with jewels, 120 levels in six worlds, playable offline, in English and Arabic.<br>https://play.google.com/store/apps/details?id=com.zumurud.game<br>#Zumurud #PuzzleGame #Match3 | 0 / 280 |

</div>

| ID | النص | العدد |
|---|---|---|
| `S-AR-LAUNCH-LONG` | زمرد صارت اليوم على Google Play.<br><br>لعبة ألغاز الجواهر تحت سماء ليل الصحراء: 120 مرحلة في ستة عوالم، من الواحة إلى سماء النجوم. ثلاث قطع خاصة وست تركيبات، ومراحل تُلعب بدون نت، بواجهة عربية كاملة.<br><br>https://play.google.com/store/apps/details?id=com.zumurud.game<br><br>#زمرد #لعبة_ألغاز #ألعاب_جواهر #ألعاب_أندرويد #بدون_نت | 0 / 2200 |
| `S-AR-LAUNCH-X` | زمرد صارت اليوم على Google Play: لعبة ألغاز الجواهر، 120 مرحلة في ستة عوالم، تُلعب بدون نت وبواجهة عربية كاملة.<br>https://play.google.com/store/apps/details?id=com.zumurud.game<br>#زمرد #لعبة_ألغاز #ألعاب_جواهر | 0 / 280 |

## 2) منتصف الرحلة — المرحلة 60

<div dir="ltr">

| ID | Text | Count |
|---|---|---|
| `S-EN-LEVEL60-LONG` | Level 60 is the halfway point of the journey. The Bazaar closes behind you, and the gates of the Palace open at level 61. Sixty more levels lead on through the Caverns to the Starlit Sky.<br><br>Which level are you on?<br><br>#Zumurud #PuzzleGame #Match3 #GemPuzzle | 0 / 2200 |
| `S-EN-LEVEL60-X` | Level 60 is the halfway point of Zumurud: the Bazaar closes behind you and the Palace opens at level 61. Which level are you on?<br>#Zumurud #PuzzleGame #Match3 | 0 / 280 |

</div>

| ID | النص | العدد |
|---|---|---|
| `S-AR-LEVEL60-LONG` | المرحلة 60 منتصف الرحلة. يُغلق السوق خلفك، وتُفتح أبواب القصر عند المرحلة 61. ستون مرحلة أخرى تمضي بك عبر الكهوف حتى سماء النجوم.<br><br>في أي مرحلة أنت الآن؟<br><br>#زمرد #لعبة_ألغاز #ألعاب_جواهر #ألعاب_الجوال | 0 / 2200 |
| `S-AR-LEVEL60-X` | المرحلة 60 منتصف رحلة زمرد: يُغلق السوق خلفك ويُفتح القصر عند المرحلة 61. في أي مرحلة أنت الآن؟<br>#زمرد #لعبة_ألغاز #ألعاب_جواهر | 0 / 280 |

## 3) اللعب بدون نت

<div dir="ltr">

| ID | Text | Count |
|---|---|---|
| `S-EN-OFFLINE-LONG` | No signal? The board is still there.<br><br>The puzzle levels of Zumurud need no Wi-Fi and no mobile data: play in airplane mode, on a flight or on your commute. There is no account to create, and your progress stays on your device.<br><br>https://play.google.com/store/apps/details?id=com.zumurud.game<br><br>#Zumurud #OfflineGames #PuzzleGame #Match3 | 0 / 2200 |
| `S-EN-OFFLINE-X` | No signal? The puzzle levels of Zumurud need no Wi-Fi and no mobile data: play in airplane mode, on a flight or on your commute.<br>https://play.google.com/store/apps/details?id=com.zumurud.game<br>#Zumurud #OfflineGames #Match3 | 0 / 280 |

</div>

| ID | النص | العدد |
|---|---|---|
| `S-AR-OFFLINE-LONG` | لا شبكة؟ اللوحة ما زالت بانتظارك.<br><br>مراحل زمرد تُلعب بدون نت ومن دون بيانات الجوال: في الطائرة، في الطريق، أو في دقائق الانتظار. بلا حساب ولا تسجيل، وتقدّمك محفوظ على جهازك.<br><br>https://play.google.com/store/apps/details?id=com.zumurud.game<br><br>#زمرد #ألعاب_بدون_نت #لعبة_ألغاز #ألعاب_جواهر | 0 / 2200 |
| `S-AR-OFFLINE-X` | لا شبكة؟ مراحل زمرد تُلعب بدون نت ومن دون بيانات الجوال: في الطائرة، في الطريق، أو في دقائق الانتظار.<br>https://play.google.com/store/apps/details?id=com.zumurud.game<br>#زمرد #ألعاب_بدون_نت #لعبة_ألغاز | 0 / 280 |

---

## 4) النص البديل للصور — `Alt text`

يُكتب في خانة النص البديل عند رفع الصورة (لقارئات الشاشة). كل نص في 100 حرف أو أقل ليصلح في Instagram أيضًا. النصوص نفسها موجودة لكل ملف في <span dir="ltr">`store/promo/manifest.json`</span>.

<div dir="ltr">

| ID | Text | Count |
|---|---|---|
| `ALT-EN-A` | A Zumurud board of gems crossed by beams of light. Text: Match gems. Light the night. | 0 / 100 |
| `ALT-EN-B` | Six scenes of the Zumurud level map, oasis to starlit sky. Text: Six worlds. 120 levels. | 0 / 100 |
| `ALT-EN-C` | Three close-ups of gems: a beam, a burst and a prism at work. Text: Beam. Nova. Prism. | 0 / 100 |

</div>

| ID | النص | العدد |
|---|---|---|
| `ALT-AR-A` | لوحة جواهر في لعبة زمرد تعبرها أشعة من الضوء. النص: طابِق الجواهر وأضِئ الليل. | 0 / 100 |
| `ALT-AR-B` | ستة مشاهد من خريطة مراحل زمرد، من الواحة إلى سماء النجوم. النص: ستة عوالم، 120 مرحلة. | 0 / 100 |
| `ALT-AR-C` | ثلاث لقطات مقرّبة للجواهر: شعاع وانفجار ومنشور. النص: شعاع، نوفا، منشور. | 0 / 100 |

</div>

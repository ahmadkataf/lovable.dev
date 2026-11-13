<div dir="rtl">

# نصوص إعلانات التثبيت — «زمرد»

نصوص جاهزة للنسخ واللصق في مديري الإعلانات: **Google Ads (App campaign)** و**Meta Ads (Facebook / Instagram)** و**TikTok Ads**، بالإنجليزية والعربية. لا يُلصق شيء من هذه الصفحة في Play Console (نصوص المتجر في <span dir="ltr">`store/listing/fields.json`</span>).

**كيف تُقرأ الجداول**

- كل صف نصٌّ واحد: المعرّف، ثم النص كما يُلصق، ثم **عدد أحرفه / الحد المسموح**.
- الأعداد **محسوبة بالسكربت** لا باليد (عدد رموز Unicode؛ الحركات العربية مثل الشدّة والكسرة تُحسب أحرفًا، وهذا العدّ الأشدّ). بعد أي تعديل شغّل من مجلد `match3`:
  <span dir="ltr">`node tools/store/make-promo.cjs --write-counts`</span> — يعيد كتابة الأعداد ويفحص الحدود والعبارات الممنوعة.
- القواعد التي التزمت بها كل النصوص، وعليك أن تلتزم بها إن عدّلت: لا ذكر لأي لعبة أو تطبيق أو علامة أخرى ولا مقارنة بها؛ لا كلمات تفضيل أو ترتيب أو سعر أو ترويج (مثل: الأفضل، رقم 1، جديد، مجانًا، خصم، حمّل الآن)؛ لا رموز تعبيرية ولا كلمات بأحرف كبيرة ولا علامات تعجب متكررة؛ وكل جملة صادقة عن اللعبة كما هي اليوم.
- زر الدعوة (`Install` / «تثبيت») تضيفه المنصة نفسها من قائمتها؛ لا يُكتب داخل النص.
- رابط الوجهة في كل الإعلانات (يعمل بعد نشر اللعبة): <span dir="ltr">`https://play.google.com/store/apps/details?id=com.zumurud.game`</span>

**أي صورة مع أي نص** (الصور في <span dir="ltr">`store/promo/png/`</span> و<span dir="ltr">`jpg/`</span>)

| الفكرة | الصورة | الزاوية | نصوص Meta المطابقة |
|---|---|---|---|
| A | <span dir="ltr">`A-hero-board`</span> | متعة المطابقة ولحظة الانفجار الضوئي | <span dir="ltr">`M-…-A-…`</span> |
| B | <span dir="ltr">`B-worlds`</span> | حجم المحتوى: ستة عوالم و120 مرحلة | <span dir="ltr">`M-…-B-…`</span> |
| C | <span dir="ltr">`C-specials`</span> | القطع الخاصة والتركيبات | <span dir="ltr">`M-…-C-…`</span> |
| A أو C | أيّهما | اللعب بدون نت | <span dir="ltr">`M-…-D-…`</span> |

في Google App campaign لا تُربط صورة بنص: ترفع كل العناوين والأوصاف والصور معًا والمنصة تركّب الإعلان.

---

## 1) Google Ads — App campaign

الحدود من صفحة Google الرسمية (قُرئت في 13 نوفمبر 2026): حتى **5 عناوين** كل منها **30 حرفًا** أو أقل، وحتى **5 أوصاف** كل منها **90 حرفًا** أو أقل. أنشئ مجموعة إعلانية للإنجليزية وأخرى للعربية، ولا تخلط اللغتين في مجموعة واحدة.

### الإنجليزية — `Headlines`

<div dir="ltr">

| ID | Text | Count |
|---|---|---|
| `G-EN-H1` | Match gems, light the night | 27 / 30 |
| `G-EN-H2` | 120 levels in six worlds | 24 / 30 |
| `G-EN-H3` | Beams, Novas and Prisms | 23 / 30 |
| `G-EN-H4` | Play offline, no sign-up | 24 / 30 |
| `G-EN-H5` | A match 3 puzzle with jewels | 28 / 30 |

</div>

### الإنجليزية — `Descriptions`

<div dir="ltr">

| ID | Text | Count |
|---|---|---|
| `G-EN-D1` | Swap gems, forge Beams and Novas, and cross 120 levels from the oasis to the stars. | 0 / 90 |
| `G-EN-D2` | Six jewels, each with its own color and cut, on a board that stays easy to read. | 0 / 90 |
| `G-EN-D3` | Clear sand, break stones and chains, and bring the brass lamps down the board. | 0 / 90 |
| `G-EN-D4` | Win levels in a row and the Caravan starts your next board with special pieces. | 0 / 90 |
| `G-EN-D5` | The levels need no Wi-Fi and no account. In English and Arabic, right to left. | 0 / 90 |

</div>

### العربية — `Headlines`

| ID | النص | العدد |
|---|---|---|
| `G-AR-H1` | طابِق الجواهر وأضِئ الليل | 0 / 30 |
| `G-AR-H2` | 120 مرحلة في ستة عوالم | 0 / 30 |
| `G-AR-H3` | شعاع ونوفا ومنشور | 0 / 30 |
| `G-AR-H4` | العب بدون نت وبلا تسجيل | 0 / 30 |
| `G-AR-H5` | لعبة مجوهرات بواجهة عربية | 0 / 30 |

### العربية — `Descriptions`

| ID | النص | العدد |
|---|---|---|
| `G-AR-D1` | بدّل الجواهر واصنع الشعاع والنوفا، واعبر 120 مرحلة من الواحة إلى سماء النجوم. | 0 / 90 |
| `G-AR-D2` | ستة أحجار كريمة لكل حجر لونه وشكله، ولوحة تبقى واضحة على الشاشة الصغيرة. | 0 / 90 |
| `G-AR-D3` | أزِل الرمال وحطّم الأحجار واكسر السلاسل، وأنزِل الفوانيس النحاسية إلى أسفل اللوحة. | 0 / 90 |
| `G-AR-D4` | فُز بالمراحل تباعًا، فتبدأ القافلة مرحلتك التالية بقطع خاصة جاهزة على اللوحة. | 0 / 90 |
| `G-AR-D5` | المراحل تُلعب بدون نت ومن دون حساب، بواجهة عربية كاملة من اليمين إلى اليسار. | 0 / 90 |

**صور Google App campaign:** ارفع المقاسات الثلاثة التي تقبلها المنصة: <span dir="ltr">1200×1200</span> (نسبة 1:1) و<span dir="ltr">1200×628</span> (نسبة 1.91:1) و<span dir="ltr">1080×1350</span> (نسبة 4:5)، للأفكار الثلاث — تسع صور لكل لغة، والحد 20 صورة. الصيغة <span dir="ltr">`.jpg`</span> أو <span dir="ltr">`.png`</span> وبحد أقصى 5 ميغابايت للصورة (كل ملفات هذه الحزمة أصغر من ذلك بكثير).

---

## 2) Meta Ads — Facebook و Instagram

أرقام Meta الموصى بها (قُرئت من دليل إعلانات Meta في 13 نوفمبر 2026): النص الأساسي `Primary text` بين 50 و150 حرفًا في الخلاصة و125 حرفًا في القصص، والعنوان `Headline` 27 حرفًا. لذلك كُتب كل نص أساسي هنا في **125 حرفًا أو أقل** ليصلح لكل المواضع، وكل عنوان في **27 أو أقل**. خانة `Description` اختيارية ولا تظهر في كل المواضع؛ كُتبت في 30 حرفًا أو أقل.

### الإنجليزية

<div dir="ltr">

| ID | Field | Text | Count |
|---|---|---|---|
| `M-EN-A-P` | Primary text | Swap two gems, line up three, and watch the board light up. 120 levels of jewels under a desert night sky. | 0 / 125 |
| `M-EN-A-H` | Headline | Match gems, light the night | 0 / 27 |
| `M-EN-A-D` | Description | A match 3 puzzle with jewels | 0 / 30 |
| `M-EN-B-P` | Primary text | Start at the oasis and climb through the Dunes, the Bazaar, the Palace and the Caverns to a sky full of stars. | 0 / 125 |
| `M-EN-B-H` | Headline | Six worlds. 120 levels. | 0 / 27 |
| `M-EN-B-D` | Description | From the oasis to the stars | 0 / 30 |
| `M-EN-C-P` | Primary text | Four in a line make a Beam, an L or a T makes a Nova, five in a line make a Prism. Then swap two of them. | 0 / 125 |
| `M-EN-C-H` | Headline | Beam. Nova. Prism. | 0 / 27 |
| `M-EN-C-D` | Description | Three specials, six combos | 0 / 30 |
| `M-EN-D-P` | Primary text | No Wi-Fi and no account: the levels of Zumurud play offline, at your own pace, on a flight or on your commute. | 0 / 125 |
| `M-EN-D-H` | Headline | Gem puzzles, played offline | 0 / 27 |
| `M-EN-D-D` | Description | No Wi-Fi needed to play | 0 / 30 |

</div>

### العربية

| ID | الخانة | النص | العدد |
|---|---|---|---|
| `M-AR-A-P` | Primary text | بدّل جوهرتين، طابق ثلاثًا، وشاهد اللوحة تضيء. 120 مرحلة من الجواهر تحت سماء ليل الصحراء. | 0 / 125 |
| `M-AR-A-H` | Headline | طابِق الجواهر وأضِئ الليل | 0 / 27 |
| `M-AR-A-D` | Description | لعبة ألغاز الجواهر | 0 / 30 |
| `M-AR-B-P` | Primary text | ابدأ من ماء الواحة واصعد عبر الكثبان والسوق والقصر والكهوف حتى سماء النجوم: 120 مرحلة في ستة عوالم. | 0 / 125 |
| `M-AR-B-H` | Headline | ستة عوالم و120 مرحلة | 0 / 27 |
| `M-AR-B-D` | Description | من الواحة إلى سماء النجوم | 0 / 30 |
| `M-AR-C-P` | Primary text | أربع جواهر في خط تصنع الشعاع، وشكل L أو T يصنع النوفا، وخمس في خط تصنع المنشور. ثم بدّل قطعتين خاصتين معًا. | 0 / 125 |
| `M-AR-C-H` | Headline | شعاع ونوفا ومنشور | 0 / 27 |
| `M-AR-C-D` | Description | ثلاث قطع خاصة وست تركيبات | 0 / 30 |
| `M-AR-D-P` | Primary text | بدون نت ومن دون حساب: مراحل زمرد تُلعب في الطائرة أو في الطريق، وعلى مهلك، فهي بعدد الحركات لا بالوقت. | 0 / 125 |
| `M-AR-D-H` | Headline | لعبة مجوهرات بدون نت | 0 / 27 |
| `M-AR-D-D` | Description | لا تحتاج إلى واي فاي | 0 / 30 |

**صور Meta:** الخلاصة `Feed`: <span dir="ltr">1080×1350</span> (4:5، وهو ما يوصي به دليل Meta) أو <span dir="ltr">1080×1080</span> (1:1). القصص و`Reels`: <span dir="ltr">1080×1920</span> (9:16). العمود الأيمن وإعلانات الرابط الأفقية: <span dir="ltr">1200×628</span>. استعمل صور <span dir="ltr">`ar/`</span> مع النصوص العربية وصور <span dir="ltr">`en/`</span> مع الإنجليزية.

---

## 3) TikTok Ads

حدود TikTok من صفحاته الرسمية (قُرئت في 13 نوفمبر 2026): وصف الإعلان `Ad description` من **1 إلى 100 حرف** لاتيني، ومن 1 إلى 50 حرفًا للغات الآسيوية؛ والرموز التعبيرية و«#» و«{ }» غير مسموحة فيه. لأن الصفحة لا تذكر العربية صراحة، كُتبت الأوصاف العربية في **50 حرفًا أو أقل** لتصلح على القراءتين. اسم التطبيق يُسحب آليًّا من Google Play في إعلانات الخلاصة.

<div dir="ltr">

| ID | Field | Text | Count |
|---|---|---|---|
| `TT-EN-1` | Ad description | Match gems and light up the board: 120 levels of jewels under a desert night sky. | 0 / 100 |
| `TT-EN-2` | Ad description | Six worlds, 120 levels, three special pieces and six combos. The levels play offline. | 0 / 100 |
| `TT-EN-3` | Ad description | Beam, Nova, Prism: line up gems, forge special pieces and clear the board. | 0 / 100 |
| `TT-EN-NAME` | App name (if asked) | Zumurud: Gem Match 3 Puzzle | 0 / 40 |

</div>

| ID | الخانة | النص | العدد |
|---|---|---|---|
| `TT-AR-1` | Ad description | طابِق الجواهر وأضِئ الليل: 120 مرحلة في ستة عوالم | 0 / 50 |
| `TT-AR-2` | Ad description | لعبة مجوهرات بدون نت: شعاع ونوفا ومنشور و120 مرحلة | 0 / 50 |
| `TT-AR-3` | Ad description | من الواحة إلى سماء النجوم: ستة عوالم و120 مرحلة | 0 / 50 |

**صور TikTok:** إعلانات الخلاصة داخل تطبيق TikTok نفسه **فيديو فقط** (صفحته الرسمية لا تذكر صورًا ثابتة). الصور الثابتة تُقبل في موضع <span dir="ltr">`Global App Bundle`</span>: عمودية 9:16 (<span dir="ltr">1080×1920</span>) ومربعة 1:1 (<span dir="ltr">1080×1080</span>)، بصيغة JPG أو PNG. المقاس <span dir="ltr">1200×628</span> ليس من نسب TikTok (الأفقي عنده 16:9) فلا ترفعه هناك. الصور نفسها تصلح أيضًا منشورًا عاديًّا غير مدفوع (`Photo Mode`) في حساب اللعبة.

---

## 4) ما الذي لا تغيّره

- **لا تضف** كلمات مثل: <span dir="ltr">best, #1, top, new, free, sale, download now</span> ولا مقابلاتها العربية، ولا اسم أي لعبة أخرى ولا وسمًا يحمل اسمها. منصات الإعلان ترفض التفضيل غير الموثّق، وسياسة Google Play تمنع المقارنة.
- **لا تعد** بشيء ليس في اللعبة اليوم. الأرقام المذكورة هنا مطابقة للعبة: 120 مرحلة، ستة عوالم، ثلاث قطع خاصة، ست تركيبات، ستة معزّزات، اللعب بدون إنترنت داخل المراحل، بلا حساب، بالعربية والإنجليزية.
- كلمة «عوالم / worlds» هي نفسها المستعملة في صفحة المتجر («ستة عوالم»، وكل عالم فصل من عشرين مرحلة).
- إذا غيّرت اسم اللعبة في المتجر فغيّر الصف <span dir="ltr">`TT-EN-NAME`</span> ليطابقه.

</div>

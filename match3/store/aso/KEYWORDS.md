<div dir="rtl">

# الكلمات المفتاحية لصفحة «زمرد» على Google Play — ما اخترناه ولماذا

هذه الوثيقة هي **خطة الكلمات** التي بُنيت عليها نصوص المتجر النهائية في <span dir="ltr">`store/listing/`</span>. فيها: ما يبحث عنه اللاعبون فعلًا (بالأرقام)، وأين وُضعت كل كلمة، وما استُبعد عمدًا ولماذا.

- **تاريخ القياس:** 13 نوفمبر 2026. الأرقام ترتيب ظهور في اقتراحات البحث ونتائجه، لا أحجام بحث (Google لا ينشر أحجامًا).
- **Google Play ليس فيه خانة كلمات مفتاحية مخفية.** البحث يقرأ النص الظاهر فقط: الاسم ثم الوصف القصير ثم الوصف الكامل (أوله أهم من آخره). لذلك «الخطة» هنا هي توزيع الكلمات على هذه الخانات الثلاث في جمل طبيعية، لا قائمة تُلصق في أي مكان.
- **تنبيه للمساعد الآلي:** لا تُدخل شيئًا من هذه الوثيقة في Play Console. ما يُلصق هناك موجود في <span dir="ltr">`store/listing/fields.json`</span> فقط. والكلمات في قسم «ممنوع الاستعمال» أدناه كُتبت لتبقى **خارج** الصفحة.
- ثلاثة مقاطع في هذه الوثيقة يقرؤها سكربت الفحص آليًّا (`keyword-plan` و`never-use` و`play-tags`)؛ إن عدّلتها فشغّل <span dir="ltr">`node store/aso/check-listing.cjs --write`</span>.

---

## 1) الخلاصة

| | الإنجليزية (<span dir="ltr">en-US</span>، اللغة الافتراضية) | العربية (<span dir="ltr">ar</span>) |
|---|---|---|
| الاسم | <span dir="ltr">`Zumurud: Gem Match 3 Puzzle`</span> — 27 / 30 | `زمرد: لعبة ألغاز الجواهر` — 24 / 30 |
| الوصف القصير | <span dir="ltr">`Match 3 jewels across a desert oasis: 120 puzzle levels, playable offline`</span> — 73 / 80 | `لعبة مجوهرات بدون نت: طابق جواهر الواحة واعبر 120 مرحلة حتى سماء النجوم` — 71 / 80 |
| كلمة النوع الأساسية | <span dir="ltr">match 3</span> ثم <span dir="ltr">puzzle</span> | **جواهر / مجوهرات** (لا «مطابقة 3» وحدها) |
| أقوى وصف إضافي صادق | <span dir="ltr">offline</span> | **بدون نت** |

ثلاثة قرارات تحكم كل شيء:

1. **العلامة أولًا ثم وصف النوع.** لا أحد يبحث عن «Zumurud» أو «لعبة زمرد» اليوم (صفر اقتراحات في المتجرين)، فالاسم وحده لا يجلب بحثًا؛ الذيل الوصفي هو ما يجعل اللعبة تظهر، والعلامة في أوله تضمن أن تتصدّر اللعبة نتائج اسمها حين يُعرف.
2. **العربية تُكتب كما يكتب اللاعب العربي، لا كما تُترجم الإنجليزية.** في العربية كلمة النوع هي «الجواهر/المجوهرات»، وأقوى إضافة هي «بدون نت». و«مطابقة 3» وحدها تجلب ألعاب مطابقة البلاط لا ألعاب الجواهر.
3. **لا حشو.** كل كلمة مفتاحية وردت داخل جملة تصف اللعبة فعلًا، وبعدد محدود (القسم 6)، لأن تكرار الكلمات مخالفة لسياسة البيانات الوصفية لا مجرد ضعف في الأسلوب.

---

## 2) من أين جاءت الأرقام

| المصدر | الإنجليزية | العربية |
|---|---|---|
| اقتراحات بحث Google Play (الإكمال التلقائي) | 1,106 استعلامًا، أمريكا وبريطانيا بالتفصيل مع عيّنات من كندا وأستراليا والهند | 903 استعلامات (745 أعادت اقتراحات، 1,547 اقتراحًا مختلفًا): السعودية 494، الكويت 109، مصر 99، الإمارات 36، العراق 36 |
| صفحات نتائج البحث | 41 صفحة | 72 صفحة |
| صفحات ألعاب متصدّرة في النوع (لعدّ المفردات فقط — لم يُنسخ منها نص) | 59 صفحة (50 للعناوين والأوصاف القصيرة، 46 للأوصاف الكاملة) | 42 صفحة عربية |

**ما أعدتُ قياسه بنفسي قبل اعتماد النصوص (13 نوفمبر 2026):**

- **27 استعلام إكمال** أُعيد تشغيلها في أمريكا وبريطانيا والسعودية والكويت: النتائج طابقت ما سجّله البحث (مثلًا: <span dir="ltr">«mat»</span> في أمريكا يقترح <span dir="ltr">«match 3 games»</span> في الموضع 4؛ «العاب» في السعودية والكويت يقترح «العاب بدون نت» في الموضع 2).
- **فحص تعارض الاسم:** 36 بحثًا في 13 متجرًا (16 بحثًا إنجليزيًّا في أمريكا وبريطانيا وكندا وأستراليا والهند والكويت والسعودية والإمارات، و20 بحثًا عربيًّا في السعودية والكويت ومصر والإمارات والعراق). من **1,051** عنوانًا ظهر في النتائج: **صفر** عنوان مطابق للذيل <span dir="ltr">«Gem Match 3 Puzzle»</span> أو يحتويه، و**صفر** عنوان مطابق لـ«لعبة ألغاز الجواهر» أو «لعبة جواهر وألغاز» أو «لعبة الجواهر» أو يحتويها.
- **قياسات الكتابة** (هل يوحّد بحث Play الصيغ المختلفة؟): 24 مقارنة بين نتائج صيغتين — نتائجها في القسم 5، وهي التي حدّدت قواعد كتابة النص العربي.

**حدود هذا كله:** الإكمال التلقائي يعطي ترتيبًا لا حجمًا. صفحة النتائج تعرض نحو 30 لعبة وتتغيّر بالبلد واليوم. أوزان الخانات (الاسم > الوصف القصير > الوصف الكامل) تقديرات شركات تحليل المتاجر لا تصريح من Google. وقياسات القسم 5 تُظهر كيف يعامل Play **عبارة البحث**؛ كيف يفهرس نص الصفحة نفسه لا يمكن رؤيته من الخارج، فاخترنا الكتابة الآمنة في الحالتين.

---

## 3) الإنجليزية — الكلمات المختارة

<div dir="ltr">

### Primary — in the title, the short description and the first 160 characters

| Keyword | Evidence | Where it is used |
|---|---|---|
| **match 3** | Genre head term. "match 3 games" appears after typing only "mat" in the US (position 4) and "matc" in the UK (position 3). 26 of 50 top-ranked genre titles, 30 of 50 short descriptions and 41 of 50 full descriptions use it. "match 3 puzzle" and "match-3 puzzle" return the same 30 of 30 results, so it is written without the hyphen. | Title · short description · full description 3× (first sentence, the rule, the offline line) · release notes |
| **puzzle** | Category head term: "puzzle games" appears after "pu". "match 3 puzzle games" is suggestion 1 after "match 3 p" in the US and the UK. | Title · short description · full description 3× |
| **jewel / jewels** | The stronger theme word: "jewel games" appears after "jew", "gem games" only after "gem g"; 24 of 50 top titles say jewel, 9 say gem. "jewel games" and "gem games" share only 3 of 30 results, so both words are needed. | Short description · full description 5× (both singular and plural: the two forms share 21 of 30 results) |
| **offline** | The strongest truthful modifier: "match 3 games offline" is suggestion 2 after "match 3 g"; "offline puzzle games" is suggestion 1 after "offline p"; 13 of 50 short descriptions say it. True for this game: every level plays without a connection. | Short description · full description 2× (first sentence) · release notes |

### Secondary — in the title or the body, once or a few times

| Keyword | Evidence | Where it is used |
|---|---|---|
| **gem / gems** | "gem match" is suggestion 4 after "gem m"; "gem games" is suggestion 2 after "gem g". It is also the game's own word for its pieces. | Title · full description (the pieces) |
| **levels** | "puzzle games for adults with levels" appears after only "puz"; "levels" is in 42 of 50 top descriptions. | Short description ("120 puzzle levels") · full description |
| **no Wi-Fi** | "no wifi games" is suggestion 2 after "no w" (US), 1 in the UK. | Full description 2× ("No Wi-Fi is needed to play") |
| **matching** | "matching games" is suggestion 5 after "matc" (US). | Full description 1× ("matching puzzles") |
| **single player** | "single player games offline"; Play's own chip on 41 of 44 top match-3 listings. | Full description 1× |
| **teens and adults** | "match 3 games for adults" is suggestion 4 after "match 3 games f". Written to agree with the 13+ audience declaration. | Full description 1× |
| **relaxing** | "relaxing puzzle games" is suggestion 1 after "relaxing p". Used only for the soundtrack; no health or stress claim. | Full description 1× |
| **combos, boosters** | Feature vocabulary of the genre; describes what the game really has. | Full description |

### Long-tail — one natural mention each

| Keyword | Evidence | Where it is used |
|---|---|---|
| **classic match 3** | "classic match 3 games" is suggestion 3 after "classic matc". | "The classic match 3 rule: …" |
| **in a row** | "3 in a row games" is suggestion 1 after "3 i". | "three or more of the same kind in a row" |
| **match three** | "match three games" is suggestion 2 after "match t"; it shares 25 of 30 results with "match 3". | "Swap gems to match three or more" |
| **airplane mode** | "airplane mode games" is suggestion 1 after "airplane m". | "you can play in airplane mode, on a flight or on your commute" |
| **Arabic** | "arabic games" is suggestion 1 after "arabic g" in the US and the UK; "arabic puzzle" is suggested in Kuwait and the UAE. | "English and Arabic, with a full right-to-left layout in Arabic" |
| **Zumurud** | Zero suggestions for the name, so no competing demand and no competing app. | First word of the title and of the description |

### Demand exists, deliberately left out of the English listing

"casual" and "adventure" are covered by tags, not by text (the game has a journey across six worlds but no story or characters, so "adventure" is not claimed). "stress relief" and "brain" wording implies a health benefit. "no timer" is used only in its truthful form ("limited by moves, not by a timer"), never as "no waiting": lives do refill over time.

</div>

---

## 4) العربية — الكلمات المختارة

### أساسية — في الاسم والوصف القصير وأول 160 حرفًا

| الكلمة | الدليل | أين استُعملت |
|---|---|---|
| **لعبة الجواهر / ألعاب جواهر** | عبارة النوع الأولى في العربية: نتائج «لعبة الجواهر» 30 من 30 ألعاب جواهر في السعودية والكويت و29 من 29 في مصر؛ تقترحها خانة البحث في المتاجر الخمسة. الصيغتان (بأل وبدونها) تشتركان في 25 من 30 نتيجة فقط، فكُتبتا كلتاهما. | الاسم («لعبة … الجواهر») · الوصف القصير («جواهر الواحة») · الوصف الكامل (أول جملة «لعبة جواهر») |
| **مجوهرات / المجوهرات** | كلمة النوع الثانية: «العاب مجوهرات» 29 من 30 ألعاب جواهر. الصيغتان تشتركان في 17 من 30 نتيجة فقط (3 من أول 10)، فوردت كلتاهما. | الوصف القصير («لعبة مجوهرات») · الوصف الكامل مرتين |
| **بدون نت** | أقوى إضافة في بحث الألعاب العربي: «العاب بدون نت» الاقتراح الثاني لكلمة «العاب» في السعودية والكويت والإمارات ومصر والعراق، و301 من 399 بذرة بحث (75.4%) أعادت اقتراحًا فيه «بدون نت» أو مرادفها. واللاعبون يكتبونها هكذا (375 اقتراحًا مختلفًا مقابل 36 لـ«انترنت»)، بينما 2 فقط من 42 صفحة متصدّرة تستعملها. | الوصف القصير · الوصف الكامل مرتين (أول جملة وعنوان قسم) · ملاحظات الإصدار |
| **ألغاز** | اسم الفئة في Play ورأس البحث «العاب الغاز». يكتبها اللاعبون بلا همزة، و Play يوحّد الهمزة (20 من 21 نتيجة مشتركة)، فكُتبت بالهمزة الصحيحة. | الاسم · الوصف الكامل (أول جملة) · ملاحظات الإصدار |
| **مرحلة / مراحل** | «العاب مراحل» تُقترح في المتاجر الخمسة، و4 فقط من 42 صفحة متصدّرة تقول «مراحل» (الباقي «مستويات» المترجَمة). وهي كلمة اللعبة نفسها. «مراحل» و«المراحل» تشتركان في 4 من 29 نتيجة فقط، فوردت الصيغتان. | الوصف القصير («120 مرحلة») · الوصف الكامل · ملاحظات الإصدار |

### ثانوية — في متن الوصف

| الكلمة | الدليل | أين استُعملت |
|---|---|---|
| **مطابقة 3** | هو اسم وسم النوع في Play بالعربية وتستعمله 27 من 42 صفحة متصدّرة، لكنه وحده يعيد 24 من 30 لعبة مطابقة بلاط. لذلك يرد **مقرونًا بالجواهر والألغاز** دائمًا. | الوصف الكامل مرة واحدة («من ألعاب ألغاز مطابقة 3») |
| **مطابقة / طابق** | مفردة الآلية؛ «مطابقة الجواهر» تعيد 30 من 30 ألعاب جواهر. تُستعمل فعلًا ومصدرًا لا عنوانًا. | الوصف القصير («طابق») · الوصف الكامل |
| **الأحجار الكريمة** | يطابق وسم Play «أحجار كريمة وجواهر»؛ «لعبة الاحجار الكريمة» الاقتراح الثاني لـ«لعبة الاحجار». واللعبة تسمّي أحجارها فعلًا (ياقوت، زمرد، كهرمان…). | الوصف الكامل |
| **ألعاب** | صيغة الجمع التي يبدأ بها أغلب البحث («العاب …»). | الوصف الكامل مرتين |
| **بدون إنترنت** | الصيغة الأطول؛ نتائجها تشترك مع «بدون نت» في 19 من 30 فقط، فذُكرت مرة إلى جانبها. | الوصف الكامل مرة واحدة |
| **معززات** | 24 من 42 صفحة متصدّرة تستعملها؛ وهي كلمة اللعبة. تُكتب بلا شدّة (القسم 5). | الوصف الكامل · ملاحظات الإصدار |
| **عربية / بالعربية** | «العاب عربية بدون نت» الاقتراح الثاني لـ«العاب عربية»، و**صفر** من 42 صفحة متصدّرة تذكر العربية. نقول ما هو مؤكد: واجهة عربية كاملة. | الوصف الكامل |
| **زمرد** | لا طلب عليها اليوم، فتُبنى بالتكرار المعتدل. | أول الاسم وأول الوصف وآخره |

### ذيل طويل — ذكر طبيعي واحد لكل منها

| الكلمة | الدليل | أين استُعملت |
|---|---|---|
| **مطابقة ثلاثة عناصر** | عبارة البحث التي يفتحها وسم «مطابقة 3» في Play. | «القاعدة بسيطة: مطابقة ثلاثة عناصر متماثلة أو أكثر» |
| **ألعاب المجوهرات والأحجار الكريمة** | عبارة البحث التي يفتحها وسم «أحجار كريمة وجواهر» (30 من 30 ألعاب جواهر). | «لمحبي ألعاب المجوهرات والأحجار الكريمة» |
| **مستويات** | 36 من 42 صفحة متصدّرة تقولها؛ «العاب مستويات» تُقترح في السعودية. | «تتدرج مستويات صعوبتها» |
| **بلا اتصال بالإنترنت** | نص وسم Play العربي للّعب بلا اتصال. | فقرة المشتريات |
| **واي فاي** | 12 من 42 صفحة متصدّرة تذكرها. | أول فقرة |
| **لاعب واحد / لعبة فردية** | وسم Play «اللعب الفردي»؛ صفر من 42 صفحة تقولها. | «لعبة فردية للاعب واحد» |
| **مسلية** | «العاب مسلية بدون نت» الاقتراح الثاني لـ«العاب مسلية». وصف لا تفضيل، ومرة واحدة. | «لعبة مسلية لدقائق الانتظار أو لجلسة طويلة» |
| **للشباب والكبار** | «العاب الغاز بدون نت للكبار» تُقترح في المتاجر الخمسة. كُتبت «للشباب والكبار من عمر 13 سنة» لتطابق إقرار الجمهور ولأن «للكبار» وحدها قد تُفهم محتوى للبالغين. | الوصف الكامل |
| **موسيقى هادئة مريحة** | تغطّي بحث «العاب استرخاء» و«العاب مريحة» دون وعد بشيء: اللعبة فيها حركات محدودة وقلوب. | الوصف الكامل |

### عليها طلب وتُركت عمدًا خارج النص العربي

«ألعاب ذكاء» (ملاءمتها للنوع ضعيفة: 3 ألعاب من النوع في 24 نتيجة)، «من غير نت» و«بلا نت» (لهجتان؛ النص بالفصحى مع «بدون نت» المشتركة بين كل البلدان)، «تحطيم الجواهر» (مفردة جيدة، لم تدعُ إليها جملة). أما «خفيفة» و«لعبة عربية» و«رمضان» فتحتاج تأكيدًا منك أو محتوى غير موجود اليوم — انظر القسم 7.

---

## 5) قياسات الكتابة: كيف يعامل بحث Play الصيغ المختلفة

قارنتُ نتائج صيغتين للعبارة نفسها (أول 30 نتيجة). كلما قلّ المشترك كان Play يعدّهما كلمتين مختلفتين.

| الصيغة الأولى | الصيغة الثانية | المتجر | المشترك | القاعدة التي خرجنا بها |
|---|---|---|---|---|
| <span dir="ltr">match 3 puzzle</span> | <span dir="ltr">match-3 puzzle</span> | أمريكا | 30 من 30 | الشرطة لا تغيّر شيئًا: نكتب <span dir="ltr">match 3</span> |
| <span dir="ltr">match 3 puzzle</span> | <span dir="ltr">match three puzzle</span> | أمريكا | 25 من 30 | نذكر <span dir="ltr">match three</span> مرة |
| <span dir="ltr">jewel games</span> | <span dir="ltr">gem games</span> | أمريكا | **3 من 30** | كلمتان مختلفتان تمامًا: كلتاهما في الصفحة |
| <span dir="ltr">jewel games</span> | <span dir="ltr">jewels games</span> | أمريكا | 21 من 30 | المفرد والجمع كلاهما |
| «ألغاز» | «وألغاز» (بواو العطف) | السعودية / الكويت / مصر | **14 / 6 / 12 من 30** | الواو الملتصقة تُضعف المطابقة: كل كلمة مفتاحية ترد مرة على الأقل **مجرّدة** من الواو والباء واللام |
| «طابق الجواهر» | «طابِق الجواهر» (بكسرة) | السعودية / الكويت / مصر | **11 / 14 / 12 من 30** | التشكيل يغيّر النتائج: **لا تشكيل إطلاقًا** في الاسم والوصف القصير، ولا على أي كلمة مفتاحية في الوصف الكامل |
| «معززات» | «معزّزات» (بشدّة) | السعودية | 15 من 30 | تُكتب بلا شدّة |
| «مراحل» | «المراحل» | السعودية | **4 من 29** | الصيغتان (بأل وبدونها) كلتاهما |
| «مجوهرات» | «المجوهرات» | السعودية / الكويت | 17 من 30 / 9 من 11 | الصيغتان كلتاهما |
| «لعبة جواهر» | «لعبة الجواهر» | السعودية | 25 من 30 | الصيغتان كلتاهما |
| «العاب الغاز» | «ألعاب ألغاز» | السعودية | 20 من 21 | الهمزة تُوحَّد: نكتب الإملاء الصحيح |
| «مطابقة 3» | «مطابقة ٣» | السعودية | 20 من 30 | الأرقام 0-9 دائمًا |
| «لعبة جواهر بدون نت» | «… بدون إنترنت» / «… بلا اتصال بالإنترنت» | السعودية | 19 / 18 من 30 | «بدون نت» هي الأساس، والصيغتان الأخريان مرة لكل منهما |

**ما يعنيه ذلك لمن يعدّل النص العربي:** لا تضف تشكيلًا إلى كلمة مفتاحية (جواهر، مجوهرات، ألغاز، مطابقة، طابق، مراحل، مرحلة، معززات، بدون نت…)، ولا تشكّل الاسم ولا الوصف القصير. التشكيل الباقي في الوصف الكامل (مثل «بدّل»، «تُلعب»، «شيئًا») على كلمات لا يبحث عنها أحد، وهو هناك ليُقرأ النص صحيحًا. السكربت يرفض مخالفة هذه القاعدة.

---

## 6) الخطة المقروءة آليًّا — كم مرة ترد كل كلمة

الأعمدة: اللغة | الكلمة | الدرجة | الحد الأدنى | الحد الأقصى (في الوصف الكامل) | شروط إضافية.
الشروط: <span dir="ltr">`title`</span> يجب أن ترد في الاسم · <span dir="ltr">`short`</span> في الوصف القصير · <span dir="ltr">`fold`</span> في أول 160 حرفًا من الوصف الكامل (ما يظهر قبل «المزيد»؛ 32 من 46 صفحة متصدّرة تضع اسم النوع هناك) · <span dir="ltr">`clean`</span> ترد مرة على الأقل مجرّدة من السوابق.
فوق ذلك: لا كلمة تتجاوز 3% من كلمات الوصف (توصية شركات التحليل: 2–3% على الأكثر).

<div dir="ltr">

```keyword-plan
# lang | term | tier | min | max | flags
en | match 3 | primary | 3 | 5 | title short fold
en | puzzle | primary | 3 | 5 | title short fold
en | jewel | primary | 3 | 6 | short fold
en | offline | primary | 2 | 4 | short fold
en | gem | secondary | 4 | 10 | title
en | levels | secondary | 4 | 10 | short
en | no wi-fi | secondary | 1 | 3 |
en | combo | secondary | 1 | 4 |
en | booster | secondary | 1 | 4 |
en | matching | secondary | 1 | 2 |
en | single player | secondary | 1 | 2 |
en | teens and adults | secondary | 1 | 1 |
en | relaxing | secondary | 1 | 1 |
en | classic match 3 | long-tail | 1 | 1 |
en | in a row | long-tail | 1 | 2 |
en | match three | long-tail | 1 | 2 |
en | airplane mode | long-tail | 1 | 1 |
en | arabic | long-tail | 2 | 4 |
en | zumurud | brand | 2 | 5 | title fold
ar | لعبة | primary | 3 | 9 | title short fold clean
ar | جواهر | primary | 5 | 12 | title short fold clean
ar | مجوهرات | primary | 2 | 4 | short clean
ar | بدون نت | primary | 2 | 3 | short fold clean
ar | ألغاز | primary | 2 | 4 | title fold clean
ar | مرحلة | primary | 5 | 12 | short
ar | مراحل | primary | 3 | 8 | clean
ar | مطابقة 3 | secondary | 1 | 2 | fold clean
ar | مطابقة | secondary | 2 | 6 |
ar | طابق | secondary | 1 | 4 | short
ar | الأحجار الكريمة | secondary | 1 | 3 | clean
ar | ألعاب | secondary | 2 | 4 | fold clean
ar | بدون إنترنت | secondary | 1 | 1 | clean
ar | معززات | secondary | 2 | 4 | clean
ar | عربية | secondary | 2 | 4 |
ar | الواحة | secondary | 2 | 5 | short
ar | مطابقة ثلاثة عناصر | long-tail | 1 | 1 |
ar | مستويات | long-tail | 1 | 1 | clean
ar | بلا اتصال بالإنترنت | long-tail | 1 | 1 |
ar | واي فاي | long-tail | 1 | 1 |
ar | لاعب واحد | long-tail | 1 | 1 |
ar | مسلية | long-tail | 1 | 1 |
ar | زمرد | brand | 3 | 6 | title fold
```

</div>

---

## 7) ممنوع الاستعمال — ما استُبعد عمدًا

ثلاثة أنواع، وكلها يرفضها السكربت إن ظهرت في أي نص:

1. **أسماء وعلامات ألعاب وتطبيقات أخرى** (<span dir="ltr">`brand`</span>). عليها طلب كبير في الإكمال التلقائي، لكن استعمالها مخالف لسياسات انتحال الهوية والملكية الفكرية والبيانات الوصفية («لا تُشِر إلى تطبيقات أخرى ولا تقارن بها») وقد يوقف التطبيق. القائمة الكبرى (العلامات المسجّلة ومفرداتها) مصدرها <span dir="ltr">`docs/research/naming-ip.md`</span> ويقرؤها السكربت من هناك مباشرة؛ ما في المقطع أدناه هو **ما أضافه بحث الكلمات** فقط: أسماء ظهرت في الاقتراحات، وعنوانان قائمان بحرفهما يجب ألا يصيرا ذيلًا لاسمنا ولا عبارة في نصّنا.
2. **كلمات ترتيب وسعر وترويج ودعوة إلى التنزيل** (<span dir="ltr">`policy`</span>): الأفضل، رقم 1، مجاني، جديد، خصم، «حمّل الآن»… (القائمة الكاملة داخل السكربت مع قائمة <span dir="ltr">`tools/store/check-kit.cjs`</span>). وكذلك أي رقم سنة، لأنه يجعل النص «حسّاسًا للوقت».
3. **كلمات تصف ما ليس في اللعبة اليوم** (<span dir="ltr">`truth`</span>) أو تحتاج **تأكيدك** (<span dir="ltr">`owner`</span>).

<div dir="ltr">

```never-use
# term | lang | type | why
# ── names found by the keyword research (the registered marks themselves are read from docs/research/naming-ip.md) ──
jewel quest | en | brand | name of another game series; autocomplete offers it after "jewel q"
jewel legend | en | brand | title of another game
jewel blast | en | brand | titles of several other games
gem blast | en | brand | titles of several other games
jewel crush | en | brand | titles of other games; second word is another publisher's mark
gem crush | en | brand | titles of other games; second word is another publisher's mark
jewel mania | en | brand | title of another game
jewel hunter | en | brand | title of another game
jewel nights | en | brand | part of another game's title
genies | en | brand | part of another game's title
match masters | en | brand | title of another game
match master | en | brand | title of another game
match factory | en | brand | title of another game
gem swap | en | brand | exact title of another product (the verb "swap gems" is fine)
jewel match 3 puzzle | en | brand | exact title of another product
match 3 jewel puzzle | en | brand | exact title of another product
match 3 gem puzzle | en | brand | contained in another product's title (found on 2026-11-13)
arabian nights | en | brand | near the name of another product, and the game tells no such story
حلوى | ar | brand | points at one well-known title; the game has no sweets
كاندي | ar | brand | another game's name in Arabic letters
كراش | ar | brand | another game's name in Arabic letters
رويال | ar | brand | another game's name in Arabic letters
ساغا | ar | brand | another publisher's mark in Arabic letters
فري فاير | ar | brand | another game; the intent is that game's currency
زوما | ar | brand | another publisher's mark in Arabic letters
ليالي جوهرة | ar | brand | another game's localised title
ألف ليلة | ar | brand | near the name of another product, and the game tells no such story
# ── things the game does not have today ──
diamond | en | truth | there is no diamond among the six gems
الماس | ar | truth | there is no diamond among the six gems; the word also pulls diamond-painting apps
story | en | truth | no story or characters
characters | en | truth | no story or characters
قصة | ar | truth | no story or characters
multiplayer | en | truth | single player only
online | en | truth | no online mode
leaderboard | en | truth | none
tournament | en | truth | none
أونلاين | ar | truth | no online mode
unlimited | en | truth | lives and moves are limited
no waiting | en | truth | lives refill over time
غير محدود | ar | truth | lives and moves are limited
بلا انتظار | ar | truth | lives refill over time
رمضان | ar | truth | nothing seasonal in the game today
# ── audience and health ──
kids | en | policy | the declared audience is 13 and over
children | en | policy | the declared audience is 13 and over
toddler | en | policy | the declared audience is 13 and over
أطفال | ar | policy | the declared audience is 13 and over
للبنات | ar | policy | audience wording the game does not target
brain | en | policy | implies a health or training benefit
stress | en | policy | implies a health benefit
anxiety | en | policy | implies a health benefit
therapy | en | policy | implies a health benefit
real money | en | policy | reads as a prize or gambling claim
cash | en | policy | reads as a prize or gambling claim
prizes | en | policy | reads as a prize or gambling claim
ربح | ar | policy | reads as a prize or gambling claim
جوائز | ar | policy | reads as a prize or gambling claim
# ── wording that implies being an existing, older game, or the wrong genre ──
القديمة | ar | policy | implies being an existing older game
الأصلية | ar | policy | implies being "the original" of an existing game
مطابقة ثلاثية | ar | policy | tile-matching intent (30 of 30 results are tile games)
المتشابهات | ar | policy | tile-matching intent
# ── true only if the owner confirms it ──
لعبة عربية | ar | owner | an origin claim: needs the owner's confirmation
خفيفة | ar | owner | a size claim: needs the final download size
lightweight | en | owner | a size claim: needs the final download size
small size | en | owner | a size claim: needs the final download size
```

</div>

**لماذا لا نستعمل أسماء الألعاب الأخرى ولو مرة؟** لأن نص Google صريح: «لا تُدرج إشارات مضلِّلة أو غير ذات صلة إلى تطبيقات أو منتجات أخرى، ولا تقارن تطبيقك أو لعبتك بتطبيقات أو ألعاب أخرى»، ويسري على كل ترجمات الصفحة. الربح المحتمل من كلمة كهذه لا يساوي خطر إيقاف التطبيق.

---

## 8) الفئة والوسوم

- **نوع التطبيق:** <span dir="ltr">`Game`</span> — **الفئة:** <span dir="ltr">`Puzzle`</span> (بالعربية في المتجر: «ألغاز»).
- **الوسوم:** خمسة على الأكثر، تُختار من <span dir="ltr">`Grow users > Store presence > Store settings > App category > Manage tags`</span> (المسار كما في صفحة مساعدة Google). Google يقول: اختر «الأكثر ارتباطًا بوضوح»، ولا تغيّرها إلا إذا تغيّر محتوى اللعبة تغيّرًا كبيرًا.

الأسماء أدناه **هي التي يعرضها Google Play نفسه** على صفحات الألعاب (قُرئت من 44 صفحة لعبة متصدّرة في النوع بالإنجليزية ومن الصفحات العربية). ما **لم نستطع** رؤيته هو قائمة الاختيار داخل Play Console: بعض ما يظهر على الصفحات يضيفه Google من عنده (الصفحة الواحدة تعرض حتى 9 شارات والمطوّر يختار 5 فقط). لذلك القاعدة: **اختر بالترتيب أول خمسة من هذه القائمة تجدها فعلًا في قائمة الاختيار، ولا تختر وسمًا من خارجها.**

<div dir="ltr">

```play-tags
# priority | label shown by Google Play (English) | label in Arabic | note
1 | Match 3 | مطابقة 3 | the genre; shown on 39 of 44 top match-3 listings
2 | Puzzle | ألغاز | shown on 43 of 44; also the category
3 | Gems & jewels | أحجار كريمة وجواهر | the theme; shown on 15 of 44, so it sets the game apart
4 | Casual | الألعاب البسيطة | shown on 39 of 44
5 | Offline | بلا اتصال بالإنترنت | shown on 40 of 44; the strongest modifier in both languages
6 | Single player | اللعب الفردي | shown on 41 of 44; take it only if one of the five above is not offered
```

</div>

**لا تختر:** <span dir="ltr">`Match 3 adventure`</span> (اللعبة رحلة عبر عوالم لكن بلا قصة ولا شخصيات)، ولا أي وسم لنوع قريب («بلاط»، «فرز»، «دمج»…) طمعًا في جمهوره: Google يعدّ ذلك وسمًا غير ذي صلة.

---

## 9) قواعد Google التي كُتبت النصوص عليها

| القاعدة | النص | المصدر |
|---|---|---|
| حدود الأحرف | الاسم 30، الوصف القصير 80، الوصف الكامل 4000؛ ملاحظات الإصدار 500 لكل لغة | <span dir="ltr">support.google.com/googleplay/android-developer/answer/9859152</span> و <span dir="ltr">answer/9859348</span> |
| الاسم | بلا رموز تعبيرية، بلا أحرف كبيرة للتشديد، بلا كلمات ترتيب أو سعر أو ترويج | <span dir="ltr">answer/9898842</span> |
| الوصف القصير | «لخّص الوظيفة الأساسية بلغة بسيطة»؛ النقطة في آخر الجملة **فقط إذا كان فيه أكثر من جملة**؛ بلا «Best / #1 / Top / New / Discount / Sale»، وبلا «download now / play now»؛ والكلمات المفتاحية غير الضرورية «لن تؤثر في الترتيب» | <span dir="ltr">answer/9866151</span> |
| الوصف الكامل | «اجعل الوصف موجزًا ومباشرًا؛ قد لا يقرأ المستخدم إلا الجمل الأولى»، «لا تكرّر وصفك القصير»، «تجنّب الطول الزائد وتكرار الكلمات»، «لا تملأ الوصف بقوائم كلمات»، لا شهادات مجهولة، لا مقارنة بتطبيقات أخرى | <span dir="ltr">answer/13393723</span> |
| الحشو مخالفة | تكرار الكلمات أو الكلمات غير ذات الصلة «قد يؤدي إلى تعليق التطبيق» | <span dir="ltr">answer/9859152</span> و <span dir="ltr">answer/9898842</span> |
| الوسوم | خمسة على الأكثر، الأكثر ارتباطًا بوضوح | <span dir="ltr">answer/9859673</span> |
| التجارب | تجربة محلية للّغة تختبر الأيقونة والصورة المميّزة واللقطات **والوصفين**؛ حتى نسختين بديلتين؛ أصل واحد في كل مرة. **الاسم لا يدخل في التجارب** | <span dir="ltr">answer/6227309</span> |
| بطاقات مخصّصة | حتى 50 بطاقة، ويمكن تخصيص **الاسم** والأيقونة والوصفين والصور فيها | <span dir="ltr">answer/9867158</span> |

الصفحات السبع <span dir="ltr">9859152 · 9898842 · 9866151 · 13393723 · 9859673 · 6227309 · 9867158</span> فتحتُها وقرأتُ نصوصها يوم 13 نوفمبر 2026، والاقتباسات أعلاه منها. حدّ ملاحظات الإصدار (<span dir="ltr">answer/9859348</span>) منقول من بحث المشروع <span dir="ltr">`docs/research/play-policy.md`</span>.

---

## 10) بعد النشر

1. **الأسابيع الأولى:** لا تجارب؛ الزيارات قليلة فلا تخرج التجربة بنتيجة. راقب في Play Console صفحة تحليل الاكتساب: عبارات البحث التي جلبت زيارات، ونسبة التحويل لكل لغة.
2. **حين تتوفر زيارات:** جرّب الوصف القصير العربي أولًا (البدائل في <span dir="ltr">`store/listing/ar-variants.md`</span>)، ثم الإنجليزي (<span dir="ltr">`en-US-variants.md`</span>). أصل واحد في كل تجربة.
3. **الاسم** لا يُختبر بالتجارب: إما تغييره ومقارنة أربعة أسابيع قبله بأربعة بعده، وإما بطاقة مخصّصة لبلد واحد تحمل الاسم البديل.
4. **المراجعات:** ردّ عليها بلغة كاتبها. نصوص المراجعات والتقييم والاحتفاظ باللاعبين وقلّة الأعطال عوامل ترتيب يذكرها Google («تقييمات ومراجعات وتنزيلات وعوامل أخرى»)، وهي خارج النص.
5. **لا تغيّر الوسوم ولا الاسم كل أسبوع.** كل تغيير يحتاج أسابيع ليظهر أثره.

---

## 11) ما يحتاج قرارك أنت

| # | القرار | الوضع الحالي في النصوص |
|---|---|---|
| 1 | **اسم اللعبة بالإنجليزية:** أُضيف الرقم 3 (<span dir="ltr">`Zumurud: Gem Match 3 Puzzle`</span>) إلى الاسم الذي أجازه بحث التسمية (<span dir="ltr">`Zumurud: Gem Match Puzzle`</span>). إن فضّلت الأول القديم فهو في ملف البدائل. | الاسم الجديد |
| 2 | **اسم اللعبة بالعربية:** «زمرد: لعبة ألغاز الجواهر» بدل «زمرد: جواهر الواحة». القديم في ملف البدائل. | الاسم الجديد |
| 3 | **بحث العلامات التجارية بالاسم** عن ZUMURUD / ZUMURRUD في سجلات USPTO و EUIPO/TMview و WIPO وسجلات الخليج — لم يُنجز بعد (مذكور في بحث التسمية)، ولا نستطيع إنجازه من هنا. | معلّق |
| 4 | **عبارة «لعبة عربية»** (ادّعاء منشأ): هل تريدها؟ إن نعم ففي ملف البدائل وصف قصير جاهز بها. | غير مستعملة |
| 5 | **كلمة «خفيفة»** (ادّعاء حجم): تحتاج الحجم النهائي للتنزيل كما يعرضه Play Console. | غير مستعملة |
| 6 | **أي نسخة ستُرفع؟** الوصف الكامل يقول إن اللعبة فيها إعلانات. إن رفعت النسخة التي بلا مكتبة إعلانات فاستعمل النص البديل الجاهز (<span dir="ltr">`ifTheBuildHasNoAds`</span> في <span dir="ltr">`fields.json`</span>). | نسخة الإعلانات |
| 7 | **أسماء الوسوم في قائمة Play Console** لا تُرى إلا من داخل حسابك (القسم 8). | قائمة بالأولوية |
| 8 | **بطاقة إنجليزية بريطانية (en-GB)** اختيارية: النص الحالي بإملاء أمريكي ويخدم كل المتاجر الإنجليزية (اقتراحات البحث فيها شبه متطابقة). | غير مضافة |

### الاسمان الجديدان: ما يجب أن يتبعهما خارج هذا المجلد

الاسمان تغيّرا في نصوص المتجر فقط. هذه المواضع ما زالت تحمل الاسمين السابقين وهي خارج مجلدَي <span dir="ltr">`store/listing`</span> و<span dir="ltr">`store/aso`</span>، فلم تُعدَّل هنا:

| الموضع | ما فيه | المطلوب |
|---|---|---|
| <span dir="ltr">`store/PUBLISHING-GUIDE.ar.md`</span> (السطر الأول من الدليل، وجدول <span dir="ltr">`Create app`</span>) | <span dir="ltr">`Zumurud: Gem Match Puzzle`</span> / «زمرد: جواهر الواحة» | كتابة الاسمين الجديدين — **الاسم الذي تكتبه عند إنشاء التطبيق يجب أن يكون نفسه في البطاقة** |
| <span dir="ltr">`store/privacy/index.html`</span> (والصفحة المنشورة على رابط سياسة الخصوصية) | الاسمان السابقان في العنوان والنص | تحديث الاسمين ثم إعادة نشر الصفحة. ليس شرط قبول (الصفحة تذكر اسم المطوّر ومعرّف الحزمة)، لكن تطابق الاسم بين الصفحة والبطاقة أسلم عند المراجعة |
| <span dir="ltr">`tools/store/check-kit.cjs`</span> (الاسم «المتوقَّع») | الاسمان السابقان | يطبع ملاحظة لا خطأ؛ تُحدَّث القيمتان ليختفي التنبيه |
| الصورة المميّزة وعبارة اللعبة داخلها | <span dir="ltr">«Gem Match Puzzle»</span> / «لعبة تطابق الجواهر» | هذه **عبارة** لا اسم المتجر، ولا يلزم أن تطابقه |

**إن فضّلتَ إبقاء الاسمين السابقين:** ضع الاسم السابق في مربّع الاسم في <span dir="ltr">`en-US.md`</span> أو <span dir="ltr">`ar.md`</span>، واحذف كلمة <span dir="ltr">`title`</span> من أسطر الخطة في القسم 6 (<span dir="ltr">`match 3`</span> للإنجليزية؛ «لعبة» و«ألغاز» للعربية)، وعدّل صف الاسم في جدول القسم 1، ثم شغّل <span dir="ltr">`node store/aso/check-listing.cjs --write`</span>. الوصفان لا يتغيّران.

</div>

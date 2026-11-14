<div dir="rtl">

# حزمة النشر والأرباح — «زمرد» على Google Play

كل ما تحتاجه لنشر اللعبة (`com.zumurud.game`) والربح منها، في مجلد واحد. الوثائق بالعربية، عدا دليل الرفع المكتوب بالإنجليزية للمساعد الآلي؛ وأسماء صفحات Play Console ومعرّفات المنتجات والأوامر بالإنجليزية كما تظهر على الشاشة.

## الوقائع الثابتة

| البند | القيمة |
|---|---|
| اسم المطوّر العلني | `Fekra Ads` |
| اسم اللعبة في المتجر | <span dir="ltr">`Zumurud: Gem Match 3 Puzzle`</span> · `زمرد: لعبة ألغاز الجواهر` (المرجع: <span dir="ltr">`store/listing/fields.json`</span>) |
| سياسة الخصوصية (منشورة وتعمل) | <span dir="ltr">`https://zumurud-privacy.almutafawiqin.workers.dev/`</span> |
| موقع المطوّر في البطاقة | الرابط نفسه، ويقدّم أيضًا <span dir="ltr">`/app-ads.txt`</span> لـ AdMob |
| بريد الدعم | بريد حساب Play Console نفسه — تُدخله أنت في Play Console |
| النسخة التي تُرفع | نسخة **`ads`** (إعلانات AdMob + مشتريات داخل التطبيق): <span dir="ltr">`release/Zumurud-1.0.0-ads.aab`</span> — رمز الإصدار 1، الإصدار 1.0.0 |
| معرّفات AdMob | موجودة في <span dir="ltr">`android/admob.properties`</span> و<span dir="ltr">`store/owner.json`</span> (تطبيق + وحدة مكافأة + وحدة بينية) |
| الاختبار المغلق (12 مختبِرًا / 14 يومًا) | **لا ينطبق** على حسابك؛ اختبار داخلي ثم الإنتاج |

## ابدأ من هنا — الترتيب

| # | افتح | لماذا |
|---|---|---|
| 1 | `store/UPLOAD-RUNBOOK.md` | **دليل الرفع للمساعد الآلي** (بالإنجليزية): خطوات Play Console مرقّمة بالترتيب، وكل قيمة وكل ملف مع رابط تنزيله، ومواضع «توقّف واسأل المالك». |
| 2 | `store/play-console.json` | القيم نفسها بصيغة آلية (النصوص، الصور بالترتيب، الإجابات، المنتجات). |
| 3 | `store/PUBLISHING-GUIDE.ar.md` | **دليل النشر** بالعربية: الأسباب وراء كل إجابة، وما تفعله أنت بنفسك. |
| 4 | `store/EARNINGS-GUIDE.ar.md` | **دليل الأرباح**: الرسوم، الضرائب، وصول المال إلى الكويت، خطوات AdMob بعد النشر. |

## كل ملف وما يفعله

| الملف | ما هو |
|---|---|
| `store/UPLOAD-RUNBOOK.md` | دليل الرفع للمساعد الآلي. الجداول المولَّدة فيه (الصور، أمان البيانات، المنتجات، النصوص الطويلة) يكتبها السكربت أدناه. |
| `store/play-console.json` | قيم Play Console بصيغة JSON؛ **يُولَّد ولا يُعدَّل باليد**. |
| `store/build-play-console.cjs` | يولّد الملفين السابقين من <span dir="ltr">`fields.json`</span> و<span dir="ltr">`owner.json`</span> وبيان اللقطات، ويتحقق من وجود كل ملف ومقاسه. <span dir="ltr">`--check`</span> للفحص فقط. |
| `store/make-package.sh` | يجمع ثلاثة ملفات مضغوطة في <span dir="ltr">`release/`</span>: <span dir="ltr">`Zumurud-store-kit.zip`</span> (ملف الرفع + الأدلة + النصوص + الصور + لقطات الهاتف)، <span dir="ltr">`Zumurud-store-kit-tablets.zip`</span> (لقطات الأجهزة اللوحية)، <span dir="ltr">`Zumurud-ads-creatives.zip`</span> (صور الإعلانات ونصوصها). |
| `store/owner.json` | اسم المطوّر والروابط ومعرّفات AdMob. |
| `store/app-ads.txt` | محتوى ملف <span dir="ltr">`app-ads.txt`</span> المنشور على موقع المطوّر. |
| `store/listing/` | نصوص البطاقة: <span dir="ltr">`fields.json`</span> (المرجع للّصق)، و<span dir="ltr">`en-US.md`</span> و<span dir="ltr">`ar.md`</span> (المصدر مع الشرح)، وبدائل للتجارب. |
| `store/aso/` | خطة الكلمات المفتاحية وفاحص النصوص (<span dir="ltr">`check-listing.cjs`</span>). |
| `store/privacy/index.html` | مصدر صفحة سياسة الخصوصية المنشورة (مطابق للمنشور حرفيًّا يوم 14 نوفمبر 2026). |
| `store/privacy/HOSTING.md` | أين تُستضاف الصفحة وكيف تُحدَّث. |
| `store/graphics/` | الأيقونة 512×512 والصورة المميّزة <span dir="ltr">1024×500</span> بالإنجليزية والعربية. |
| `store/screenshots/` | لقطات الشاشة: 8 للهاتف و8 للوحي 7 بوصات و8 للوحي 10 بوصات لكل لغة، مع <span dir="ltr">`MANIFEST.md`</span> الذي يثبت أنها لقطات حقيقية من اللعبة. |
| `store/promo/` | مواد إعلانية خارج المتجر: 3 تصاميم × 5 مقاسات × لغتان (PNG و JPEG ونسخة بلا سطر المتجر)، مع <span dir="ltr">`AD-COPY.md`</span> (نصوص إعلانات Google و Meta و TikTok) و<span dir="ltr">`SOCIAL-CAPTIONS.md`</span>. التفاصيل في <span dir="ltr">`store/promo/README.md`</span>. |

## الأدوات (تُشغَّل من مجلد `match3`)

| الأمر | ما يفعله |
|---|---|
| `node tools/store/check-kit.cjs` | الفحص الآلي للحزمة: حدود الأحرف، العبارات الممنوعة، مقاسات الصور، اللقطات مقارنةً بالالتقاط الخام، وصفحة الخصوصية. |
| `node store/aso/check-listing.cjs` | فحص نصوص البطاقة ومطابقة <span dir="ltr">`fields.json`</span> لمصادره. |
| `node store/build-play-console.cjs --check` | فحص دليل الرفع و<span dir="ltr">`play-console.json`</span> ووجود كل ملف. |
| `sh store/make-package.sh` | إنشاء الملفات المضغوطة الثلاثة في <span dir="ltr">`release/`</span>. |

## ما يلزم منك أنت (لا يستطيع أحد غيرك تقديمه)

- [ ] بريد حساب Play Console في خانة التواصل، وبريدك للمختبِرين ولاستبيان تصنيف المحتوى.
- [ ] كل موافقة قانونية أو إقرار سياسة في Play Console.
- [ ] **ملف المدفوعات (التاجر)** في الكويت إن لم يكن معدًّا، مع حساب بنكي في الكويت يستقبل حوالات بالدولار، والنموذج الضريبي W-8BEN.
- [ ] **قرار صفة التاجر** (والنشر في أوروبا/بريطانيا أو لا)، و**قرار اليابان**.
- [ ] الأسعار النهائية للمنتجات السبعة (المقترح في دليل الرفع، القسم 9).
- [ ] تجربة النسخة الداخلية على هاتفك، والضغطة الأخيرة للإرسال إلى المراجعة.
- [ ] بعد النشر: ربط التطبيق في AdMob بصفحته على المتجر.
- [ ] مفتاح الرفع (<span dir="ltr">`.jks`</span>) وكلمات سرّه محفوظة في مكانين آمنين.

## روابط التنزيل المباشرة

| الملف | الرابط |
|---|---|
| ملف الرفع إلى Google Play (`.aab`) | <https://github.com/ahmadkataf/lovable.dev/raw/ccr-bcb81736-74rbji/match3/release/Zumurud-1.0.0-ads.aab> |
| ملف التجربة على الهاتف (`.apk`) | <https://github.com/ahmadkataf/lovable.dev/raw/ccr-bcb81736-74rbji/match3/release/Zumurud-1.0.0-ads.apk> |
| الحزمة كاملة في ملف واحد (`.zip`) | <https://github.com/ahmadkataf/lovable.dev/raw/ccr-bcb81736-74rbji/match3/release/Zumurud-store-kit.zip> |
| دليل الرفع | <https://github.com/ahmadkataf/lovable.dev/blob/ccr-bcb81736-74rbji/match3/store/UPLOAD-RUNBOOK.md> |

رابط كل صورة على حدة مكتوب في دليل الرفع (القسم 4.7). بعد دمج الفرع في `main` استبدل اسم الفرع في الروابط بـ `main`.

## حالة الحزمة (14 نوفمبر 2026)

- لقطات الشاشة وصور الإعلانات أُعيد التقاطها من النسخة النهائية نفسها التي بُني منها ملف `.aab`، فكل ما يظهر فيها موجود في اللعبة المرفوعة.
- ملفات `release/` النهائية موقّعة بمفتاح الرفع ومرفوعة إلى الفرع، فروابط التنزيل أعلاه تعمل.

## تنبيهان

1. **لا ضمان للقبول من أول مرة**، ولا وعد بأي مبلغ.
2. المعلومات مأخوذة من مذكرات البحث في <span dir="ltr">`docs/research/`</span> بتاريخ 13 نوفمبر 2026. إذا خالفت صفحةٌ في Play Console ما في الأدلة فالمعتمَد ما تعرضه Google.

</div>

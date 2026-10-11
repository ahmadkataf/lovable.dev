# Dentora على أندرويد

تطبيق أندرويد هو **غلاف WebView** يعرض نسخة الويب نفسها من Dentora، مضمّنةً داخل ملف التطبيق (`assets/www`).
يُقدَّم التطبيق داخلياً من العنوان `https://dentora.app/` دون أي اتصال بالإنترنت، ولا يُرسل أي بيانات خارج الهاتف.
يُبنى بأدوات Android SDK مباشرة (بدون Gradle) بأمر واحد، ويخرج منه ملفان:

| الملف | الاستخدام |
|---|---|
| `android/build/Dentora.apk` | للتثبيت المباشر على الهاتف (واتساب، Google Drive، كابل USB) |
| `android/build/Dentora.aab` | حزمة App Bundle للرفع على **Google Play** |

الملفات المعنية:

```
android/AndroidManifest.xml                 تعريف التطبيق: com.dentora.app، الحد الأدنى Android 7.0 (SDK 24)، الهدف SDK 35، صلاحية الإنترنت فقط
android/src/com/dentora/app/MainActivity.java   الغلاف: WebView، الجسر DentoraAndroid، الحفظ، الطباعة، اختيار الملفات، الروابط، زر الرجوع
android/src/com/dentora/app/WebFiles.java       قرارات بلا Android (أنواع الملفات، المسارات، أسماء الحفظ…) مع اختبار JVM
android/test/                               WebFilesTest (يشغّله البناء)، webview-sim.mjs (يشغّل الـ APK المبني في Chromium)
scripts/build-apk.sh                        البناء والتوقيع (APK + AAB)
scripts/android-res.py                      اسم التطبيق والأيقونات (عادية + Adaptive) من public/icon.svg
.github/workflows/dentora-android.yml       (في جذر المستودع) البناء على GitHub Actions
```

---

## 1. البناء على جهازك

### المتطلبات
- **Node.js 22** و`npm`.
- **JDK 17** أو أحدث (`javac`، `keytool`، `jarsigner`).
- **Python 3** مع **Pillow**: `pip install pillow`.
- **Android SDK** (أدوات سطر الأوامر فقط، لا حاجة لـ Android Studio) وفيه `build-tools;35.0.0` و`platforms;android-35`:
  ```bash
  # بعد تنزيل "Command line tools only" من developer.android.com/studio وفكّها في $ANDROID_HOME/cmdline-tools/latest
  export ANDROID_HOME=$HOME/android-sdk
  yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses
  $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "build-tools;35.0.0" "platforms;android-35"
  ```
- **Chromium الخاص بـ Playwright** لرسم الأيقونة من `public/icon.svg`: `npx playwright install chromium`
  (إن لم يتوفر تُرسم الأيقونة بـ Pillow مع تحذير، والنتيجة شبه مطابقة).
- **bundletool** (اختياري، لملف AAB فقط): نزّل `bundletool-all-1.18.3.jar` من
  `https://github.com/google/bundletool/releases` وضع مساره في `BUNDLETOOL`، أو ضعه باسم `$ANDROID_HOME/bundletool.jar`.
- `zip` و`unzip`. على ويندوز استخدم **WSL** (السكربت مكتوب بـ bash).

### الأمر
```bash
cd dental
npm ci
npm run android:build          # = npm run build && ./scripts/build-apk.sh
```
السكربت يتحقق من الأدوات، ويشغّل اختبار `WebFilesTest`، وينسخ `dist/` إلى داخل التطبيق، ويولّد الأيقونات، ثم يترجم ويوقّع
ويتحقق من التوقيع. إن لم يوجد `dist/index.html` يتوقف برسالة واضحة: ابنِ تطبيق الويب أولاً.

### متغيرات اختيارية
| المتغير | الافتراضي | المعنى |
|---|---|---|
| `ANDROID_HOME` | `$ANDROID_SDK_ROOT` ثم `/opt/android-sdk` | مكان الـ SDK (تُستخدم أحدث build-tools وأحدث platform مثبّتة) |
| `ANDROID_KEYSTORE` | `android/release.keystore` | ملف مفتاح التوقيع. المسار الافتراضي يُنشأ تلقائياً إن لم يوجد؛ أما المسار الذي تحدده بنفسك فيجب أن يكون موجوداً وإلا يتوقف البناء (حتى لا يُوقَّع التطبيق بمفتاح جديد بسبب خطأ في المسار) |
| `ANDROID_KEYSTORE_PASSWORD` | `dentora-release` | كلمة سر المفتاح — **اختر كلمتك قبل أول بناء** |
| `ANDROID_KEY_ALIAS` | `dentora` | اسم المفتاح داخل الملف |
| `VERSION_NAME` | إصدار `package.json` | رقم الإصدار الظاهر للمستخدم، مثل `1.2.3` |
| `VERSION_CODE` | `major*10000 + minor*100 + patch` | رقم الإصدار الداخلي (`1.2.3` ← `10203`) |
| `TARGET_SDK` | `35` | مستوى الـ API المستهدف (يجب أن تكون المنصة نفسها مثبّتة) |
| `BUNDLETOOL` | `$ANDROID_HOME/bundletool.jar` إن وُجد | لبناء ملف AAB |
| `DIST` | `dist` | مجلد بناء الويب المراد تغليفه |

### التحقق من الناتج
```bash
B=$ANDROID_HOME/build-tools/35.0.0
$B/aapt2 dump badging android/build/Dentora.apk | head -4      # الحزمة، الإصدار، SDK، النشاط الرئيسي
$B/apksigner verify --verbose android/build/Dentora.apk        # التوقيع
unzip -l android/build/Dentora.apk | grep www/index.html       # تطبيق الويب داخل الملف
node android/test/webview-sim.mjs                              # تشغيل الـ APK المبني في Chromium كما يقدّمه الغلاف، بالعربية والإنجليزية على شاشة هاتف 390px (لقطات في qa-shots/android)
```

---

## 2. مفتاح التوقيع النهائي: أهم ملف لديك

لـ Dentora مفتاح توقيع نهائي واحد (`dentora-release.keystore`، الاسم المستعار `dentora`، RSA 4096، صالح حتى 2054)،
سُلِّم لصاحب المشروع مع ملف `KEY-INFO.txt` الذي يحوي كلمة السر. **كل** ملف APK يُشارَك و**كل** حزمة تُرفع إلى Google Play
تُوقَّع به، فتكون النسخة المشارَكة ونسخة المتجر تطبيقاً واحداً يُحدِّث بعضه بعضاً.

بصمة الشهادة (SHA-256) — معلومة عامة يمكن مقارنتها في أي وقت:
```
43:68:DD:14:78:37:A1:B2:5E:BD:8E:6E:FE:D1:CB:5A:37:8A:74:9A:A3:02:4C:F1:B6:43:51:6C:F4:B9:82:0B
```

- **كل تحديث** يجب أن يُوقَّع بالمفتاح نفسه. إن ضاع لن يقبل أي هاتف التحديث، وسيضطر العميل إلى حذف التطبيق،
  و**الحذف يمسح كل بيانات العيادة على ذلك الهاتف**.
- على Android 8 فأحدث يعتمد **رقم الجهاز** (المستخدم في التفعيل) على مفتاح التوقيع أيضاً، فتوحيد المفتاح يُبقي أكواد التفعيل صالحة بين القناتين.
- احفظ نسختين منه في مكانين آمنين **مع كلمة السر**. الملف مستثنى من git عمداً: لا ترفعه إلى المستودع أبداً.

البناء النهائي على جهازك:
```bash
npm run build
ANDROID_KEYSTORE=/path/to/dentora-release.keystore \
ANDROID_KEYSTORE_PASSWORD='<كلمة السر من KEY-INFO.txt>' ANDROID_KEY_ALIAS=dentora \
DENTORA_EXPECTED_CERT_SHA256=4368dd147837a1b25ebd8e6efed1cb5a378a749aa3024cf1b643516cf4b9820b \
./scripts/build-apk.sh
```
مع `DENTORA_EXPECTED_CERT_SHA256` يرفض السكربت أي ملف موقَّع بمفتاح آخر ويحذفه.
بدون `ANDROID_KEYSTORE` يُنشئ السكربت مفتاح تطوير مؤقتاً (`android/release.keystore`) صالحاً للتجربة فقط.

على GitHub Actions ضع المفتاح في أسرار المستودع (Settings ← Secrets and variables ← Actions):
`ANDROID_KEYSTORE_BASE64` (محتوى `dentora-release.keystore.base64.txt`)، و`ANDROID_KEYSTORE_PASSWORD`، و`ANDROID_KEY_ALIAS` = `dentora`.
بناء الوسوم (`dentora-v*`) والتشغيل اليدوي **يفشلان** إن غابت الأسرار أو كانت لمفتاح آخر؛ ولبناء تجريبي بمفتاح مؤقت
فعّل خيار `test_key` عند التشغيل اليدوي.

---

## 3. تثبيت ملف APK على الهاتف

1. انقل `Dentora.apk` إلى الهاتف (واتساب، Google Drive، بريد، أو كابل USB).
2. افتحه من مدير الملفات أو من التطبيق الذي استلمته به.
3. سيطلب Android السماح بـ **«تثبيت التطبيقات غير المعروفة»** لذلك التطبيق: الإعدادات ← التطبيقات ← وصول خاص ← تثبيت التطبيقات غير المعروفة.
4. قد يظهر تحذير **Google Play Protect** لأن التطبيق ليس من المتجر: «مزيد من التفاصيل» ← «التثبيت على أي حال».

من الكمبيوتر (مع تفعيل «تصحيح أخطاء USB» في خيارات المطوّر):
```bash
adb install -r android/build/Dentora.apk
```

**التحديث:** ثبّت الـ APK الأحدث فوق القديم مباشرة (المفتاح نفسه و`versionCode` أعلى)، فتبقى البيانات كما هي.
**لا تحذف التطبيق لتحديثه.** إن ظهرت رسالة «لم يتم تثبيت التطبيق» فغالباً لأن النسخة المثبّتة موقّعة بمفتاح آخر
أو لأن رقم الإصدار أقل: خذ نسخة احتياطية أولاً قبل أي حذف.

**المتطلبات على الهاتف:** Android 7.0 أو أحدث، مع تحديث **Android System WebView** (أو Chrome) من متجر Play؛
نسخة WebView قديمة جداً قد تُظهر شاشة بيضاء.

---

## 4. النشر على Google Play

1. أنشئ حساب مطوّر على Google Play Console (رسوم لمرة واحدة).
2. أنشئ تطبيقاً جديداً. اسم الحزمة **`com.dentora.app`** ثابت إلى الأبد بعد أول رفع.
3. **قبل أول رفع:** في خطوة **Play App Signing** اختر استخدام مفتاحك أنت بدل مفتاح تنشئه Google
   (Use a different app signing key ← Export and upload a key from Java keystore)، ثم نفّذ أداة PEPK التي تعطيك إياها الصفحة:
   ```bash
   java -jar pepk.jar --keystore=dentora-release.keystore --alias=dentora --output=dentora-signing-key.zip \
     --include-cert --rsa-aes-encryption --encryption-key-path=encryption_public_key.pem
   ```
   وارفع `dentora-signing-key.zip`. بعدها تأكّد في App integrity ← App signing أن بصمة SHA-256 تطابق البصمة في القسم 2.
   هكذا توقّع Google نسخ المتجر بمفتاحك نفسه، فيتطابق توقيعها مع ملف APK الذي تشاركه. يمكن استخدام المفتاح نفسه لرفع الحِزم؛
   تسجيل مفتاح رفع منفصل اختياري.
4. **`versionCode` يجب أن يزيد مع كل رفع.** ارفع إصدار `package.json` (مثلاً `1.0.0` ← `1.0.1` = `10001`)،
   أو مرّر `VERSION_CODE` يدوياً (من GitHub: حقل version_code عند تشغيل الـ workflow).
5. ابنِ بأحد الطريقتين:
   - محلياً: `npm run android:build` ثم ارفع `android/build/Dentora.aab`.
   - على GitHub: Actions ← **Dentora – Android** ← Run workflow، أو ادفع وسماً (tag) مثل `dentora-v1.0.1`؛
     الملفات تظهر في **Artifacts** باسم `Dentora-android`.
6. في Play Console املأ: نموذج **أمان البيانات** (التطبيق لا يجمع ولا يشارك أي بيانات؛ كل شيء على الجهاز)، و**رابط سياسة الخصوصية**
   (مطلوب لتطبيق يتعامل مع بيانات صحية)، وبيان تطبيقات الصحة إن طُلب، والصلاحيات: الإنترنت فقط.
7. **مستوى الـ API المستهدف:** ترفع Google الحد الأدنى كل سنة (عادة في آخر أغسطس). يبني السكربت افتراضياً على SDK 35؛
   إن طلبت Play Console مستوى أعلى:
   ```bash
   sdkmanager "platforms;android-36"
   TARGET_SDK=36 npm run android:build
   ```
   الغلاف جاهز لذلك (العرض من الحافة للحافة، وزر الرجوع مضبوط بـ `enableOnBackInvokedCallback=false`).

> **تنبيه مهم للبيع:** إذا تُركت Google تنشئ مفتاحها الخاص في الخطوة 3، فستكون نسخ المتجر موقّعة بمفتاح غير مفتاحك،
> فلا تُحدِّث النسخةُ المشارَكة نسخةَ المتجر ولا العكس، و**يختلف رقم الجهاز** بينهما على Android 8+. لذلك نفّذ الخطوة 3 كما هي.
>
> **سياسة الدفع في Google Play:** لأن الملف المشارَك ونسخة المتجر واحد، لا تعرض شاشة الترخيص سعراً ولا رابط شراء خارجياً
> (Play تمنع توجيه المستخدم إلى الدفع خارج المتجر). يرى العميل رقم جهازه ويُدخل كود التفعيل الذي اشتراه منك مباشرة،
> وتعرض أنت السعر وطرق الشراء خارج التطبيق (موقعك، صفحتك، واتساب).

---

## 5. أين تُحفظ البيانات؟ (اقرأ هذا قبل تسليم التطبيق للعميل)

- كل بيانات العيادة (المرضى، المواعيد، الفواتير، الصور…) تُحفظ في **تخزين WebView الخاص بالتطبيق** (IndexedDB للأصل
  `https://dentora.app`) داخل المجلد الخاص بالتطبيق على الهاتف. لا يراها مدير الملفات ولا أي تطبيق آخر.
- **حذف التطبيق يمسح كل البيانات نهائياً.** وكذلك زر **«مسح التخزين / مسح البيانات»** في معلومات التطبيق.
  أما «مسح ذاكرة التخزين المؤقت» (Cache) فآمن.
- **النسخ الاحتياطي هو الضمان الوحيد:** من الإعدادات ← النسخ الاحتياطي ← «حفظ نسخة» تظهر شاشة الحفظ من النظام، فاختر مكاناً
  خارج الهاتف إن أمكن (Google Drive، أو أرسل الملف لنفسك على واتساب/البريد). انصح العيادة بنسخة يومية أو أسبوعية على الأقل.
- **الانتقال إلى هاتف جديد:** خذ نسخة احتياطية ← ثبّت Dentora على الهاتف الجديد ← استعِد النسخة (تظهر كل أنواع الملفات في شاشة
  الاختيار لأن بعض التطبيقات تعرض ملف JSON كنص عادي) ← فعّل الترخيص بكود جديد (رقم الجهاز تغيّر).
- قد يحفظ Android نسخة تلقائية من بيانات التطبيق في حساب Google إن كان النسخ الاحتياطي للهاتف مفعّلاً (حتى 25 ميغابايت)،
  لكنها ليست مضمونة: **لا تعتمد عليها بدل النسخة الاحتياطية من داخل البرنامج**.
- لا تغيّر أبداً اسم الحزمة `com.dentora.app` أو العنوان `dentora.app` في الكود: البيانات مرتبطة بهما، وتغييرهما يجعلها تبدو مفقودة.

---

## 6. رقم الجهاز والتفعيل

- رقم الجهاز الظاهر في **الإعدادات ← الترخيص** (8 أحرف) يُشتق من **`ANDROID_ID`** (`Settings.Secure.ANDROID_ID`) الذي يرسله الغلاف
  عبر `DentoraAndroid.deviceId()`، ثم يُحوَّل بـ SHA-256 داخل البرنامج (`deviceNumber` في `src/license/core.ts`).
- **يبقى الرقم نفسه** عند تحديث التطبيق أو حذفه وإعادة تثبيته بالمفتاح نفسه، فيبقى كود التفعيل صالحاً
  (لكن البيانات تُستعاد فقط من نسخة احتياطية).
- **يتغيّر الرقم** بعد إعادة ضبط المصنع، أو على هاتف جديد، أو في ملف مستخدم آخر/ملف العمل، أو إذا تغيّر مفتاح التوقيع
  (Android 8+)، أو بين نسخة Google Play والنسخة المباشرة. عندها يحتاج العميل كوداً جديداً.
- على Android 7 يكون `ANDROID_ID` واحداً لكل التطبيقات على الجهاز ولا يتأثر بالمفتاح.

---

## 7. ما الذي يفعله الغلاف؟ (للمطوّر)

- **تقديم الملفات:** كل طلب إلى `https://dentora.app/…` يُجاب من `assets/www` (بالنوع الصحيح لـ html/js/css/json/svg/png/woff/woff2/webmanifest/ico)،
  ولا يخرج أي طلب إلى الشبكة. الأصل آمن (secure context) فتعمل IndexedDB و`crypto.subtle` والوحدات (ES modules) كما في المتصفح.
  الموجّه `HashRouter` والمسارات النسبية (`base: './'`) تجعل كل صفحة هي `index.html#/…`.
- **الجسر `window.DentoraAndroid`** (العقد في `src/platform/index.ts`):
  `deviceId()` · `saveFile(name, mime, base64)` · `print()` · `appVersion()` · `openExternal(url)`.
- **الحفظ:** `DentoraAndroid.saveFile` يفتح شاشة «حفظ باسم» من النظام (Storage Access Framework، بلا أي صلاحية تخزين) ويعيد `true` فوراً؛
  عند اختيار المكان تُكتب البايتات في الخلفية ويُطلق الحدث `window` ← `dentora:saved` بالتفاصيل `{ ok, cancelled, name }`.
  ويغلّف الغلاف `window.DentoraAndroid` في كل صفحة بحيث تعيد `saveFile` وعداً (Promise) لا يُحسم إلا عند انتهاء الحفظ فعلاً:
  `true` إذا كُتب الملف و`false` إذا أُلغي أو فشل. لذلك `await saveFile()` في `src/platform` يعني ما يقوله: النسخة الاحتياطية
  الملغاة لا تُسجَّل كنسخة مأخوذة، ورسالة النجاح تظهر بعد الحفظ لا قبله. رسالة النجاح من البرنامج نفسه؛ والغلاف يُظهر رسالة فقط عند الفشل
  أو عند الحفظ في «التنزيلات/Dentora» (هاتف بلا شاشة «حفظ باسم»). تُحفظ نسخة مؤقتة في مجلد cache حتى لا تضيع النسخة الاحتياطية
  إذا أغلق Android التطبيق خلف شاشة الحفظ.
- **الطباعة:** `print()` (وكذلك `window.print()`) تطبع الصفحة بأنماط الطباعة (`.print-area` فقط) على **A4** عبر خدمة الطباعة في الهاتف
  (طابعة، أو «حفظ كـ PDF»). على أندرويد تعود `print()` فوراً وتُرسم الصفحة لاحقاً، وتُعاد رسمها كلما غيّر المستخدم الورق أو الاتجاه؛
  لذلك يؤجّل الغلاف حدث `afterprint` الخاص بالصفحة حتى تُغلق شاشة الطباعة (`PrintDocumentAdapter.onFinish`) ثم يطلقه مرة واحدة،
  فتبقى الوصفة/الفاتورة/مخطط الأسنان في وضع الطباعة طوال المهمة.
- **اختيار الملفات:** `<input type=file>` و`pickFile()` تفتح منتقي الملفات من النظام؛ الصور وPDF تُرشَّح حسب `accept`، وباقي الأنواع
  (مثل ملف النسخة الاحتياطية) تُظهر كل الملفات.
- **الروابط:** صفحات التطبيق تبقى داخله؛ `tel:` يفتح الاتصال، `mailto:` البريد، `https://wa.me/…` واتساب، وأي موقع آخر المتصفح.
- **زر الرجوع:** يغلق أولاً أي نافذة أو قائمة مفتوحة في الصفحة (بإرسال Escape)، ثم يعود صفحة، وفي الصفحة الرئيسية ينقل التطبيق
  إلى الخلفية بدل إغلاقه. يمكن للصفحة التحكم به: `window.__dentoraBack = () => true` يعني «تعاملتُ معه».
- **الثبات:** حفظ آخر خطأ أغلق التطبيق وعرضه مرة واحدة مع زر نسخ للدعم الفني؛ إعادة فتح الصفحة تلقائياً إذا أوقف النظام عملية
  WebView لنقص الذاكرة؛ بقاء الصفحة (وأي نموذج نصف مكتمل) عند تدوير الشاشة أو ظهور لوحة المفاتيح أو تغيير الوضع الداكن أو لغة الهاتف
  أو حجم الخط؛ أشرطة نظام بيضاء بأيقونات داكنة وهوامش تلقائية للشريط العلوي والسفلي ولوحة المفاتيح (على Android 7 يبقى شريط التنقل
  أسود لأن النظام لا يرسم أزراراً داكنة).

---

## 8. حل المشكلات

| المشكلة | الحل |
|---|---|
| `dist/index.html is missing` | نفّذ `npm run build` أولاً (أو استخدم `npm run android:build`) |
| `no Android SDK at …` / `no build-tools` / `no platform` | اضبط `ANDROID_HOME` وثبّت `build-tools;35.0.0` و`platforms;android-35` |
| `TARGET_SDK=36 needs platforms;android-36` | ثبّت المنصة المطلوبة بـ `sdkmanager` |
| `ANDROID_KEYSTORE=… does not exist` | صحّح مسار ملف المفتاح (أو احذف المتغير لاستخدام `android/release.keystore`) |
| `minor and patch must be below 100` | استخدم أرقام إصدار أصغر من 100 أو مرّر `VERSION_CODE` |
| تحذير رسم الأيقونة بـ Pillow | `npx playwright install chromium` لرسمها من SVG مباشرة |
| شاشة بيضاء على الهاتف | حدّث **Android System WebView** وChrome من متجر Play |
| «لم يتم تثبيت التطبيق» عند التحديث | النسخة المثبّتة موقّعة بمفتاح آخر أو رقم إصدارها أعلى؛ خذ نسخة احتياطية قبل أي حذف |
| Play Console يرفض الملف لمستوى الـ API | ابنِ بـ `TARGET_SDK=36` (انظر القسم 4) |
| Play Console يرفض لأن `versionCode` مستخدم | ارفع الإصدار في `package.json` أو مرّر `VERSION_CODE` أكبر |

# خادم Dentora على Cloudflare (dentora-api)

Worker واحد يخدم كل ما هو على الإنترنت من Dentora:

| العنوان | ما هو |
|---|---|
| `/` و`/en` | صفحة الهبوط بالعربية والإنجليزية (السعر ورقم واتساب والإعلان من الإعدادات) |
| `/privacy`، `/terms` (و`/en/...`) | سياسة الخصوصية وشروط الاستخدام، نفس نصوص التطبيق |
| `/download/android` | ملف APK للإصدار الحالي (يُحتسب التحميل) |
| `/download/windows` | رابط مثبّت ويندوز من الإعدادات، أو طلبه عبر واتساب إن لم يُضبط |
| `/admin` | لوحة التحكم: إصدار أكواد التفعيل ورموز إعادة تعيين PIN، سجل التراخيص، التحقق من كود، الإعدادات، سجل النشاط |
| `/api/*` | واجهة لوحة التحكم (بكلمة مرور وجلسة) |

العقد الكامل (المسارات وأشكال الردود وقواعد الأمان) في `SPEC.md`، والأنواع المشتركة في `src/types.ts`.

## بيانات Cloudflare

| البند | القيمة |
|---|---|
| اسم الـ Worker | `dentora-api` |
| الدومين (Production) | https://dentora.raqeem.dev |
| رابط workers.dev | https://dentora-api.almutafawiqin.workers.dev |
| Account ID | `c79a8e91efac74d2e119e7e406c4db43` |
| Zone | `raqeem.dev` |
| Zone ID | `f6580fdc4936cc1d394eac2d06c4f4d1` |
| قاعدة البيانات | D1 باسم `dentora` (تُنشأ تلقائياً في أول نشر، والجداول ينشئها الـ Worker بنفسه) |

- **اسم الـ Worker** في `wrangler.toml` يجب أن يبقى `dentora-api` حتى يُنشر على الـ Worker نفسه لا على Worker جديد.
- **الدومين** مربوط كـ Custom Domain، فلا يحتاج الإعداد Zone ID؛ مذكور هنا للرجوع إليه فقط.
- Account ID وZone ID معرّفات وليست أسراراً، فلا بأس بوجودها في المستودع.

## الأسرار

ثلاثة، ولا يوضع أيّ منها في المستودع أبداً:

| السر | أين | ما هو |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | بيئة جهاز النشر | مفتاح النشر (قالب **Edit Cloudflare Workers**، الحساب حساب Dentora، وZone Resources تشمل `raqeem.dev`) |
| `ADMIN_PASSWORD` | سر في الـ Worker | كلمة مرور لوحة التحكم، 12 حرفاً على الأقل (وإلا تعرض اللوحة طريقة ضبطها ولا تفتح) |
| `LICENSE_PRIVATE_JWK` | سر في الـ Worker | سطر JSON الكامل من `secrets-for-user/dentora/license-private.jwk`. بدونه تفتح اللوحة لكن لا تصدر أكواداً |

```bash
cd dental/server
npx wrangler secret put ADMIN_PASSWORD          # يطلب القيمة ولا يعرضها
npx wrangler secret put LICENSE_PRIVATE_JWK     # الصق سطر JSON كاملاً
```

تغيير `ADMIN_PASSWORD` يُخرج كل الجلسات المفتوحة. المفتاح الخاص لا يغادر الـ Worker: لا يعيده أي رد ولا يُكتب في أي سجل.

## النشر

```bash
cd dental/server
npm install
npm run check                                        # فحص الأنواع + wrangler deploy --dry-run (بدون مفتاح)
CLOUDFLARE_API_TOKEN=<المفتاح> npm run deploy        # يبني public/ ثم ينشر على dentora-api
```

`npm run build` (ويستدعيه `deploy` و`check` و`dev`) يجمع `public/` من `site/` ومن ملف APK الإصدار الحالي في
`../releases/Dentora-<version>.apk`، فبعد إصدار APK جديد يكفي النشر من جديد. `public/` لا يُحفظ في المستودع.

بعد النشر: https://dentora.raqeem.dev/healthz يعيد `ok`، وتفتح لوحة التحكم على https://dentora.raqeem.dev/admin.

## التشغيل والاختبار محلياً

انسخ `.dev.vars.example` إلى `.dev.vars` (لا يُحفظ في المستودع) واملأ القيمتين، ثم:

```bash
npm run dev       # http://localhost:8787 ، قاعدة D1 محلية
npm test          # اختبارات الوحدات (vitest)
npm run e2e       # اختبار شامل: يشغّل wrangler dev على قاعدة فارغة ويفحص الصفحات والتحميلات وكل مسارات API ولوحة التحكم في Chromium
```

`npm run e2e` يستعمل Playwright من `node_modules` التطبيق (`dental/`)، ويحتاج المنافذ 8831 إلى 8833 (يغيّرها
`E2E_PORT`). الصور واللقطات وسجلات الـ Worker تُكتب في `.wrangler/e2e/` (يغيّرها `E2E_OUT`)، ويطبع سطراً لكل فحص
وينتهي برمز خطأ إن فشل أي فحص.

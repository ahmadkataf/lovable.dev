# فوكس بوينت — دليل التسليم والتشغيل

نظام واحد: Worker على Cloudflare يخدم الـ API (`/v1/*`) وتطبيق الويب المبنيّ (`web/dist`)، وقاعدة D1 (SQLite)، وإشعارات Web Push،
ومهمة مجدولة كل 5 دقائق. التطبيق الأندرويد (`android/`) هو Trusted Web Activity يفتح نفس الرابط.

- الحساب الحالي: `c79a8e91efac74d2e119e7e406c4db43` — النطاق: `https://focuspoint.raqeem.dev` (وَرابط `*.workers.dev` للمعاينة).
- كل الإعدادات غير السرّية في `api/wrangler.toml` (`account_id`، `routes`، `[vars] PUBLIC_URL` و`ASSETLINKS_FINGERPRINTS`).
- الأسرار لا تُكتب في أي ملف؛ تُضبط بـ `wrangler secret put`.

## 0. أسرع طريقة: أمر واحد

على أي حاسوب (ماك أو ويندوز أو لينكس) فيه Node.js 18 أو أحدث (من nodejs.org، النسخة LTS):

```bash
cd focuspoint
node deploy.mjs
```

يفتح المتصفح مرة واحدة لتسجيل الدخول إلى Cloudflare، ثم ينشئ قاعدة البيانات ويطبّق المخطط ويدخل القاعات،
يبني التطبيق وينشره على الدومين المكتوب في `api/wrangler.toml`، يولّد الأسرار ويحفظها في Cloudflare وفي
`~/.focuspoint/secrets.json` (احتفظ بنسخة منه)، ثم يسأل عن هاتف المدير واسمه وكلمة مروره، ويعرض إنشاء حساب
مراجع Google Play وتفعيل الدفع عند الوصول. تشغيله مرة ثانية آمن: لا يمسّ البيانات ولا الأسرار الموجودة.
حساب Cloudflare آخر: `export CLOUDFLARE_ACCOUNT_ID=<id>` قبل الأمر (أو عدّل account_id في wrangler.toml).

الأقسام التالية تشرح الخطوات نفسها يدوياً.

## 1. النشر الأول على هذا الحساب

المتطلبات: Node 20+، وتوكن Cloudflare API بصلاحيات *Workers Scripts: Edit*, *D1: Edit*, *Workers Routes: Edit*, *Account Settings: Read*.

```bash
export CLOUDFLARE_API_TOKEN=...           # بدلاً من wrangler login على الخوادم
export CLOUDFLARE_ACCOUNT_ID=c79a8e91efac74d2e119e7e406c4db43

cd web && npm install && cd ../api && npm install

# 1) قاعدة البيانات
npx wrangler d1 create focuspoint         # انسخ database_id إلى api/wrangler.toml مكان REPLACE_ME
npm run d1:schema                         # schema.sql (آمن للتكرار)
npm run d1:seed                           # 6 غرف مبدئية — مرة واحدة فقط

# 2) الأسرار (واحداً واحداً؛ يطلب القيمة)
npm run vapid                             # يطبع زوج مفاتيح VAPID جديد
npx wrangler secret put TOKEN_SECRET      # نص عشوائي طويل (≥ 32 حرفاً) — يوقّع جلسات الفريق
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT     # mailto:owner@example.com
npx wrangler secret put WEBHOOK_SECRET    # لـ POST /v1/payments/shamcash/webhook
npx wrangler secret put ADMIN_SETUP_KEY   # يُستعمل مرة واحدة لإنشاء أول مدير

# 3) البناء والنشر
npm run deploy:all                        # يبني web/ ثم wrangler deploy
```

ثم أنشئ أول مدير (يُرفض بـ 409 بعد وجود مدير):

```bash
curl -X POST https://focuspoint.raqeem.dev/v1/admin/bootstrap -H 'Content-Type: application/json' \
  -d '{"setup_key":"<ADMIN_SETUP_KEY>","phone":"09XXXXXXXX","name":"المدير","password":"********"}'
```

يدخل المدير إلى `/team`، يرفع رمز QR لشام كاش، يضيف حسابات الموظفين، ويفعّل «الدفع عند الوصول» من الإعدادات إن أراد.

**النطاق المخصّص:** يجب أن يكون `raqeem.dev` نطاقاً (zone) في نفس الحساب. السطر
`routes = [{ pattern = "focuspoint.raqeem.dev", custom_domain = true }]` في `wrangler.toml` يُنشئ سجل DNS والشهادة تلقائياً عند
`wrangler deploy`. يبقى `workers_dev = true` فيعمل رابط المعاينة أيضاً.

تحقق: `curl https://focuspoint.raqeem.dev/v1/health` → `{"ok":true}`،
و`curl https://focuspoint.raqeem.dev/.well-known/assetlinks.json` يعرض بصمة التطبيق.

## 2. الانتقال إلى حساب أو نطاق آخر

1. **تصدير البيانات** من الحساب القديم: `npx wrangler d1 export focuspoint --remote --output=focuspoint.sql`.
2. في الحساب الجديد: `wrangler d1 create focuspoint`، ضع `database_id` الجديد في `wrangler.toml`، ثم
   `npx wrangler d1 execute focuspoint --remote --file=focuspoint.sql` (لا تشغّل `d1:seed` بعده).
3. **الأسرار:** أعد ضبط الأسرار الستة. **مهم:** استعمل **نفس مفاتيح VAPID** القديمة، وإلا تضيع اشتراكات الإشعارات كلها
   ويضطر الزبائن والفريق لإعادة تفعيلها.
4. **النطاق:** غيّر `PUBLIC_URL` و`routes` في `wrangler.toml` (و`account_id`)، ثم `npm run deploy:all`.
   كل الروابط في الإشعارات تُبنى من `PUBLIC_URL`؛ لا يوجد نطاق مكتوب في الكود.
5. **تطبيق أندرويد:** الرابط مدمج في التطبيق، فأعد البناء بالرابط الجديد وبـ `versionCode` أكبر بواحد:
   `cd android && ./build.sh https://<النطاق الجديد> <versionCode+1> <versionName>`، ثم ارفع الـ AAB إلى Google Play.
   التوقيع بنفس ملف `android/keystore/focuspoint-release.jks` (كلمة السر في `keystore/README-PRIVATE.txt`؛ ليسا في git).
   **سلّم ملف keystore ونسخه الاحتياطية للمالك الجديد** — بدونه لا يمكن تحديث التطبيق على المتجر أبداً.
6. أبقِ الحساب القديم يعمل يوماً أو يومين ثم احذف الـ Worker والقاعدة منه.

## 3. ملاحظات Google Play

- **App Links:** الـ Worker يخدم `/.well-known/assetlinks.json` من `ASSETLINKS_FINGERPRINTS` (بصمات SHA-256 مفصولة بفواصل،
  الحزمة `com.focuspoint.app`). البصمة الحالية لمفتاح الإصدار:
  `25:82:9F:6A:05:E3:39:97:36:30:8B:F5:44:53:C9:42:B7:9B:DB:E4:31:FD:8F:90:C7:D5:10:B4:66:24:78:65`.
  إذا فعّلت *Play App Signing* فأضف بصمة مفتاح Google (من Play Console → App integrity) إلى القيمة نفسها بفاصلة، وإلا يفتح
  التطبيق بشريط عنوان المتصفح.
- **سياسة الخصوصية:** الرابط `https://focuspoint.raqeem.dev/privacy` (صفحة في تطبيق الويب) — يُطلب في Play Console.
- **حساب المراجع:** أنشئ حساباً بدور `staff` (من `/team/settings` → الفريق) وضع رقمه وكلمة سره في حقل *App access* في
  Play Console؛ لا تعطِ المراجع حساب مدير. جانب الزبون لا يحتاج تسجيل دخول.
- بعد كل نشر للمتجر: `versionCode` يزيد دائماً؛ تغيير النطاق يستلزم إصداراً جديداً.

## 4. التكلفة (الخطة المجانية)

- **Workers:** 100 ألف طلب/يوم، 10 ms CPU للطلب — كافية لمركز واحد بفارق كبير (التطبيق يخزّن محلياً ويستعمل `/v1/team/ping` الخفيف للتحديث كل 5 ثوانٍ: نحو 17 ألف طلب يومياً لكل جهاز فريق مفتوح باستمرار؛ راقب العدد إن زاد عدد أجهزة الفريق عن 4).
- **D1:** 5 ملايين قراءة و100 ألف كتابة يومياً، 5 GB — الاستهلاك الفعلي أقل بكثير.
- **Cron:** مجاني ضمن حدود Workers. **Web Push:** مجاني (خدمات المتصفحات). **النطاق:** تجديد `raqeem.dev` فقط.
- إن تجاوزت الحدود يوماً فخطة Workers Paid (5 $ شهرياً) تكفي بلا تغيير في الكود.

## 5. التشغيل اليومي

- `npx wrangler tail` لمتابعة السجلات حياً؛ المهمة المجدولة تطبع `cron {...}` كل 5 دقائق.
- نسخة احتياطية: `npx wrangler d1 export focuspoint --remote --output=backup-$(date +%F).sql` (أسبوعياً).
- تغيير قاعدة البيانات مستقبلاً: ملفات `api/migrations/000N_*.sql` ثم `npm run d1:migrate`.
- الفحص قبل أي نشر: `cd api && npm run check` و`cd web && npm run check`.

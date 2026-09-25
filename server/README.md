# خادم Emar — التفعيل وتوزيع المحتوى

الخادم يحفظ أكواد التفعيل ويرسل محتوى البكالوريا المدفوع فقط للأجهزة المفعّلة.
التطبيق نفسه لا يحتوي إلا الوحدة الأولى والنموذج الأول، فتفكيك التطبيق لا يعطي أحداً الدروس المدفوعة.

## التشغيل لأول مرة (مرة واحدة فقط)

1. **حساب Cloudflare (مجاني):** سجّل في https://dash.cloudflare.com/sign-up
2. **رقم الحساب:** من لوحة Cloudflare افتح Workers & Pages، وانسخ **Account ID** من يمين الصفحة.
3. **مفتاح API:** من صورتك في الأعلى ← My Profile ← API Tokens ← Create Token ←
   اختر قالب **Edit Cloudflare Workers**، ثم أضف صلاحية **Account → D1 → Edit** ← Continue ← Create Token، وانسخ المفتاح.
4. **الأسرار في GitHub:** في المستودع ← Settings ← Secrets and variables ← Actions ← New repository secret، وأضف أربعة:
   | الاسم | القيمة |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | المفتاح من الخطوة 3 |
   | `CLOUDFLARE_ACCOUNT_ID` | الرقم من الخطوة 2 |
   | `EMAR_ADMIN_KEY` | كلمة سر لوحة التحكم: طويلة وسرية (مثلاً 24 حرفاً ورقماً) |
   | `EMAR_TOKEN_SECRET` | نص عشوائي طويل (40 حرفاً على الأقل). **لا تغيّره أبداً بعد ذلك** |
5. **التشغيل:** في المستودع ← Actions ← Deploy server ← Run workflow.
   عند انتهائه يظهر في سجل خطوة Deploy عنوان مثل `https://emar-api.<اسمك>.workers.dev` — أرسله لي لأبني التطبيق عليه.

بعدها يتحدّث الخادم تلقائياً كلما تغيّر الكتاب أو الخادم في المستودع.

## لوحة التحكم

افتح `https://emar-api.<اسمك>.workers.dev/admin` وأدخل `EMAR_ADMIN_KEY`:
- **إنشاء أكواد:** اختر التطبيق والعدد والمدة والبائع، ثم انسخها أو اطبعها بطاقات للمكتبات والأساتذة.
- **البحث والإدارة:** ابحث باسم الطالب أو الكود، **ألغِ** كوداً (يتوقف فوراً)، أو **انقله لجهاز جديد** إذا غيّر الطالب موبايله.
- **الإحصاءات:** كم كوداً بيع وفُعّل، ومن استخدم التطبيق هذا الأسبوع.

## للمطوّر

```
node scripts/split-online.mjs g12        # يقسم الكتاب: generated/g12 للتطبيق، server/content/g12 للخادم
cd server && npm install
printf "TOKEN_SECRET=dev\nADMIN_KEY=dev\n" > .dev.vars
npx wrangler d1 execute emar --local --file=schema.sql
npx wrangler dev --local                  # http://localhost:8787
EMAR_API=http://localhost:8787 BOOK=g12 npx vite build
```

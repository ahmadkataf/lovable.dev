# خادم Dentora على Cloudflare (dentora-api)

الـ Worker مُنشأ ومختبر على حساب Cloudflare، ويعيد حالياً «Hello World» مؤقتاً. هذا المجلد هو مصدره في المستودع:
`wrangler.toml` مضبوط على الـ Worker نفسه، و`src/index.ts` يعيد الرد الحالي نفسه، فالنشر منه لا يغيّر شيئاً حتى نضيف عملاً حقيقياً.

## بيانات Cloudflare

| البند | القيمة |
|---|---|
| اسم الـ Worker | `dentora-api` |
| الدومين (Production) | https://dentora.raqeem.dev |
| رابط workers.dev | https://dentora-api.almutafawiqin.workers.dev |
| Account ID | `c79a8e91efac74d2e119e7e406c4db43` |
| Zone | `raqeem.dev` |
| Zone ID | `f6580fdc4936cc1d394eac2d06c4f4d1` |

- **اسم الـ Worker** في `wrangler.toml` يجب أن يبقى `dentora-api` حتى يُنشر على الـ Worker نفسه لا على Worker جديد.
- **الدومين** مربوط كـ Custom Domain:
  `routes = [{ pattern = "dentora.raqeem.dev", custom_domain = true }]`
  لذلك لا يحتاج الإعداد Zone ID؛ مذكور هنا للرجوع إليه فقط.
- Account ID وZone ID معرّفات وليست أسراراً، فلا بأس بوجودها في المستودع.
- **السرّ الوحيد هو مفتاح API** (`CLOUDFLARE_API_TOKEN`)، ولا يوضع أبداً في المستودع ولا في أي ملف هنا. يضيفه أحمد بنفسه.

## النشر

يحتاج `CLOUDFLARE_API_TOKEN` في البيئة. أنشئه من Cloudflare:
صورتك في الأعلى ← My Profile ← API Tokens ← Create Token ← قالب **Edit Cloudflare Workers**.
اجعل الحساب هو حساب Dentora، واجعل Zone Resources تشمل `raqeem.dev`.

```bash
cd dental/server
npm install
CLOUDFLARE_API_TOKEN=<المفتاح> npm run deploy      # ينشر على dentora-api ويُبقي dentora.raqeem.dev مربوطاً
```

قبل النشر يمكن التأكد من الإعداد دون مفتاح ودون رفع شيء:

```bash
npm run check          # فحص الأنواع + wrangler deploy --dry-run
npm run dev            # تشغيل محلي على http://localhost:8787
```

بعد النشر يجب أن يعيد الرابطان الرد نفسه:
- https://dentora.raqeem.dev
- https://dentora-api.almutafawiqin.workers.dev

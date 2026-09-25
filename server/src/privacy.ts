// The privacy policy Google Play asks for, served at /privacy. CONTACT (in wrangler.toml [vars]) is shown if set.
export const privacyPage = (contact: string) => `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>سياسة الخصوصية — Emar</title>
<style>body{margin:0;background:#f7f7f7;color:#222;font:16px/1.8 system-ui,sans-serif}main{max-width:760px;margin:0 auto;padding:20px}
section{background:#fff;border:1px solid #e3e3e3;border-radius:14px;padding:16px 18px;margin-bottom:14px}h1{font-size:22px}h2{font-size:17px;margin:0 0 6px}
[dir=ltr]{text-align:left}@media (prefers-color-scheme:dark){body{background:#131f24;color:#eee}section{background:#1a2a31;border-color:#37464f}}</style></head>
<body><main>
<h1>سياسة الخصوصية لتطبيقات Emar التعليمية</h1>
<section><h2>ما الذي نجمعه</h2>
<ul>
<li><b>معرّف مشفّر للجهاز:</b> يُحسب داخل التطبيق من معرّف أندرويد ثم يُشفَّر (hash)، ولا يصلنا المعرّف الأصلي. نستخدمه فقط لربط كود التفعيل بجهاز واحد.</li>
<li><b>كود التفعيل</b> الذي يُدخله المستخدم.</li>
<li><b>عنوان IP ووقت الطلب</b> عند التفعيل وعند فتح التطبيق، لمنع التلاعب وتخمين الأكواد.</li>
</ul>
<p>لا نجمع الاسم أو رقم الهاتف أو البريد أو الموقع أو جهات الاتصال. الاسم الذي قد يكتبه الطالب في التطبيق، وتقدّمه في الدروس، ونتائج الامتحانات، تبقى على جهازه فقط ولا تُرسل إلينا.</p></section>
<section><h2>لماذا نستخدمها</h2><p>للتحقق من الاشتراك، وإرسال محتوى الكتاب للأجهزة المفعّلة فقط، ومنع استعمال الكود على أكثر من جهاز، والدعم الفني عند نقل الاشتراك إلى جهاز جديد.</p></section>
<section><h2>المشاركة والإعلانات</h2><p>لا نبيع البيانات ولا نشاركها مع أي جهة، ولا توجد إعلانات ولا أدوات تتبّع أو تحليلات داخل التطبيق. الخادم مستضاف لدى Cloudflare.</p></section>
<section><h2>مدة الحفظ والحذف</h2><p>نحتفظ بسجل التفعيل ما دام الاشتراك قائماً، وسجلات الأمان لمدة أقصاها سنة. يمكنك طلب حذف بياناتك أو فكّ ارتباط الجهاز بالتواصل معنا${contact ? `: <b dir="ltr">${contact}</b>` : '.'}</p></section>
<section dir="ltr"><h2>Privacy policy (English)</h2>
<p>Emar apps collect only: a hashed device identifier (computed on the device from the Android ID; the raw ID never leaves the phone), the activation code the user enters, and the IP address and time of activation and launch requests. They are used solely to verify the subscription, deliver the book to activated devices, prevent a code from being used on more than one device, and provide support. Names, progress and exam results stay on the device. No data is sold or shared, and the apps contain no ads, analytics or trackers. The server is hosted on Cloudflare. Activation records are kept while the subscription lasts and security logs for at most one year. To request deletion or unlinking of a device${contact ? `, contact <b>${contact}</b>` : ', contact us'}.</p></section>
</main></body></html>`

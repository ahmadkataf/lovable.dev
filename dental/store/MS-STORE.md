# Dentora — Microsoft Store listing | بطاقة متجر Microsoft

Everything to submit Dentora for Windows to the Microsoft Store from Partner Center: the package, the listing in English
(default) and Arabic, and the answers to each page. Store rules checked on 18 October 2026 (Microsoft Store Policies 7.20).

كل ما يلزم لنشر Dentora لويندوز في متجر Microsoft من Partner Center: الحزمة، والبطاقة بالإنجليزية (الافتراضية) والعربية،
وإجابات كل صفحة.

---

## 1. Account and package — الحساب والحزمة

| Item | Value | ملاحظات |
|---|---|---|
| Developer account | **Company** account (free), name **Raqeem**, at `storedeveloper.microsoft.com` | Microsoft points businesses and independent developers who sell their apps to a Company account. It is free, needs the company's details (the same D-U-N-S number as Google Play works) and cannot be made from an Individual account later. / حساب **شركة** مجاني باسم Raqeem، ولا يمكن تحويل الحساب الفردي إليه لاحقاً |
| Package type | **MSIX** (`release/Dentora-<version>-x64.msix`, `scripts/build-msix.mjs`) | The Store signs MSIX packages itself after certification: **no code-signing certificate to buy**. (An EXE/MSI submission would need a paid Authenticode certificate.) / المتجر يوقّع حزمة MSIX بنفسه، فلا حاجة لشراء شهادة توقيع |
| Package identity | Copy from Partner Center → Dentora → Product management → **Product identity**: `Package/Identity/Name`, `Package/Identity/Publisher` (the whole `CN=…`), `Package/Properties/PublisherDisplayName` | They must match exactly (case and spaces). Then build: `MSIX_IDENTITY_NAME='…' MSIX_PUBLISHER='CN=…' MSIX_PUBLISHER_DISPLAY_NAME='…' node scripts/build-msix.mjs` |
| Version | `1.1.0.0` (the fourth number is the Store's and stays 0) | |
| Architecture | x64 | |
| Minimum Windows | Windows 10 version 2004 (build 19041) and Windows 11 | |
| Payments | **Free** app; the licence is sold outside the Store | Policy 10.8.1: only games and Xbox products must use Microsoft's in-app purchase; a non-game app may sell through its own channel (WhatsApp, the website) and show that in the app. / التطبيقات غير الألعاب يُسمح لها بالبيع خارج المتجر |

**Data on uninstall / البيانات عند الإزالة:** a Store (MSIX) app keeps its AppData in its own package folder, and Windows
deletes that folder when the app is uninstalled. The listing says so; clinics must save a backup (Settings → Backup &
data) before uninstalling, exactly as on Android. A clinic moving from the website installer to the Store version moves
its data with a backup file. / تطبيق المتجر يحفظ بياناته في مجلد الحزمة ويحذفه ويندوز عند الإزالة: احفظ نسخة احتياطية أولاً.

---

## 2. Store listing — English (en-US, default)

**Product name**

```
Dentora
```

**Short description**

```
Dental clinic management that works offline on Windows: patient files, an FDI dental chart, appointments with WhatsApp reminders, treatment plans, invoices and reports, in Arabic and English. Your clinic's data stays on your computer.
```

**Description**

```
Dentora is complete dental clinic management with a modern interface in Arabic and English. It runs on your Windows computer with no internet connection, and all of your clinic's and patients' data stays on your computer.

A clear dashboard
• Today's appointments with one-click status changes, today's and this month's revenue, and outstanding balances.
• Alerts for what needs attention: overdue balances, low stock, lab work due.

Patients
• A complete file for every patient: details, contacts, insurance and tags.
• A clear medical alert for allergies, chronic conditions and medications before any procedure.
• Smart search (Arabic-aware), photos, X-rays and documents, and clinical notes.

Dental chart
• Permanent and primary teeth with FDI numbering, and a condition for every surface: caries, filling, crown, root canal, implant, bridge, extraction and more.
• Quick paint mode, a history for every tooth, and a printable chart.

Appointments
• Day, week, month and agenda views for several doctors, with conflict detection.
• WhatsApp reminders with a ready message you review before sending.

Treatment plans and billing
• An editable procedure and price list, and a treatment plan for every patient with teeth and surfaces.
• Turn finished work into an invoice in one click; part payments, patient balances, numbered receipts and statements.
• Polished invoices and prescriptions with your clinic's logo, ready to print or save as PDF.

And more
• Prescriptions with a ready drug list.
• Lab orders with status and due-date tracking.
• Stock with low-stock and expiry alerts, and expenses by category.
• Reports on revenue, expenses and profit by doctor, procedure and payment method, with CSV export.
• Team roles and permissions (admin, doctor, assistant, reception), PIN sign-in and automatic lock.

Privacy first
• Works offline with no account, and Dentora never sends your clinic's or patients' data anywhere, so we never see it.
• No ads, no tracking, no usage statistics.
• It goes online only to activate with a licence key, once, sending just the key and the device number.
• A complete backup in one file you keep wherever you like, with optional password protection (AES-256 encryption), to move your clinic to a new computer or restore it.

Trial and licence
• Dentora runs with every feature for a 7-day trial, with no sign-up.
• After the trial, a licence is required to keep adding and editing records: one payment for a lifetime licence on one device, from the developer (Settings → Licence shows how to get it).
• Without a licence, all data stays available to view, print and back up; nothing is deleted.
• Uninstalling the app removes its data from this computer: save a backup first (Settings → Backup & data).

Dentora is also available for Android phones and tablets.

Please note: Dentora is practice-management software for dental clinics. It is not a medical device and does not diagnose, treat, cure, or prevent any medical condition.
```

**What's new in this version**

```
First release of Dentora on the Microsoft Store: patients, dental chart, appointments, treatment plans, invoices and reports, all offline, in Arabic and English.
```

**Product features** (one per line in Partner Center)

```
Works fully offline: your clinic's data stays on your computer
Arabic and English interface, right-to-left Arabic with Arabic-aware search
Patient files with clear medical alerts before any procedure
Interactive dental chart with FDI numbering, every surface and full history
Appointments for several doctors, with WhatsApp reminders
Treatment plans and printable estimates
Invoices, part payments, numbered receipts and statements
Prescriptions, lab orders, inventory and expenses
Reports on revenue, expenses and profit, with CSV export
Staff roles, PIN sign-in and automatic lock
Backups in one file, with optional AES-256 encryption
7-day free trial with every feature, no sign-up
```

**Search terms** (up to 7)

```
dental clinic software
dental practice management
dentist software
dental chart
offline dental software
dental appointments
clinic billing
```

**Other fields**

| Field | Value |
|---|---|
| Screenshots (desktop) | `store/screenshots/desktop/en/01-dashboard.png` … `07-reports.png` (3200×1800), in that order |
| Copyright and trademark info | © 2026 Raqeem |
| Privacy policy URL | `https://dentora.raqeem.dev/en/privacy` |
| Website | `https://dentora.raqeem.dev/en` |
| Support contact info | the support e-mail or `https://dentora.raqeem.dev/en` (its WhatsApp button) |
| Additional license terms | `https://dentora.raqeem.dev/en/terms` |

---

## 3. Store listing — العربية (ar)

**اسم المنتج**

```
Dentora
```

**الوصف المختصر**

```
برنامج إدارة عيادة أسنان يعمل بدون إنترنت على ويندوز: ملفات المرضى، ومخطط أسنان بترقيم FDI، ومواعيد مع تذكير واتساب، وخطط علاج، وفواتير وتقارير، بالعربية والإنجليزية. بيانات عيادتك تبقى على حاسوبك.
```

**الوصف**

```
Dentora نظام متكامل لإدارة عيادة الأسنان، بواجهة عربية حديثة (ومعها الإنجليزية)، يعمل على حاسوب ويندوز بدون إنترنت. كل بيانات العيادة ومرضاها تبقى على حاسوبك.

لوحة رئيسية واضحة
• مواعيد اليوم مع تغيير حالتها بنقرة، وإيرادات اليوم والشهر، والرصيد المستحق.
• تنبيهات بما يحتاج انتباهك: ديون متأخرة، مخزون منخفض، أعمال مخبر مستحقة.

المرضى
• ملف كامل لكل مريض: البيانات ووسائل التواصل والتأمين والوسوم.
• تنبيه طبي واضح بالحساسية والأمراض المزمنة والأدوية قبل أي إجراء.
• بحث عربي ذكي، وصور وأشعة ومستندات، وملاحظات سريرية.

مخطط الأسنان
• أسنان دائمة ولبنية بترقيم FDI، وحالة لكل سطح: تسوس، حشوة، تاج، علاج عصب، زرعة، جسر، قلع وغيرها.
• وضع رسم سريع، وسجل تاريخي لكل سن، وطباعة المخطط.

المواعيد
• عرض اليوم والأسبوع والشهر والقائمة، لأكثر من طبيب، مع كشف التعارض.
• تذكير المريض عبر واتساب برسالة جاهزة تراجعها قبل الإرسال.

خطط العلاج والفواتير
• قائمة إجراءات وأسعار قابلة للتعديل، وخطة علاج لكل مريض بالأسنان والأسطح.
• تحويل العمل المنجز إلى فاتورة بنقرة، ودفعات جزئية، ورصيد المريض، وإيصالات مرقّمة، وكشف حساب.
• فواتير ووصفات أنيقة بشعار العيادة، جاهزة للطباعة أو الحفظ بصيغة PDF.

والمزيد
• الوصفات الطبية مع قاعدة أدوية جاهزة.
• طلبات المخبر ومتابعة حالتها ومواعيد التسليم.
• المخزون مع تنبيهات النقص وانتهاء الصلاحية، والمصروفات حسب الفئة.
• تقارير الإيرادات والمصروفات والربح حسب الطبيب والإجراء وطريقة الدفع، مع تصدير CSV.
• فريق بأدوار وصلاحيات: مدير، طبيب، مساعد، استقبال، ودخول برمز PIN وقفل تلقائي.

خصوصيتك أولاً
• يعمل بدون إنترنت ودون حساب، ولا يرسل Dentora شيئاً من بيانات العيادة أو المرضى إلى أي مكان، فلا نطّلع عليها.
• لا إعلانات ولا تتبّع ولا إحصاءات استخدام.
• لا يتصل بالإنترنت إلا مرة واحدة عند التفعيل بمفتاح ترخيص، ولا يرسل حينها إلا المفتاح ورقم الجهاز.
• نسخة احتياطية كاملة في ملف واحد تحفظه حيث تشاء، مع حماية اختيارية بكلمة مرور (تشفير AES-256)، لنقل العيادة إلى حاسوب جديد أو استعادتها.

التجربة والترخيص
• يعمل Dentora بكل مزاياه 7 أيام للتجربة، دون تسجيل.
• بعد التجربة يلزم ترخيص لمتابعة إضافة السجلات وتعديلها: دفعة واحدة لترخيص مدى الحياة على جهاز واحد، من المطوّر (تشرح الإعدادات ← الترخيص طريقة الحصول عليه).
• من دون ترخيص تبقى كل البيانات متاحة للعرض والطباعة والنسخ الاحتياطي، ولا يُحذف شيء.
• إزالة البرنامج تحذف بياناته من هذا الحاسوب: احفظ نسخة احتياطية أولاً (الإعدادات ← النسخ الاحتياطي والبيانات).

Dentora متوفر أيضاً لهواتف أندرويد وأجهزته اللوحية.

تنبيه: Dentora برنامج لإدارة عيادات الأسنان، وليس جهازاً طبياً، ولا يشخّص أي حالة طبية ولا يعالجها ولا يشفيها ولا يقي منها.
```

**ما الجديد في هذا الإصدار**

```
الإصدار الأول من Dentora على متجر Microsoft: المرضى ومخطط الأسنان والمواعيد وخطط العلاج والفواتير والتقارير، بدون إنترنت، بالعربية والإنجليزية.
```

**مزايا المنتج**

```
يعمل بدون إنترنت بالكامل: بيانات عيادتك تبقى على حاسوبك
واجهة عربية وإنجليزية، والعربية من اليمين إلى اليسار مع بحث يفهم العربية
ملفات المرضى مع تنبيه طبي واضح قبل أي إجراء
مخطط أسنان تفاعلي بترقيم FDI لكل سن وسطح مع السجل الكامل
مواعيد لأكثر من طبيب مع تذكير عبر واتساب
خطط علاج وعروض أسعار قابلة للطباعة
فواتير ودفعات جزئية وإيصالات مرقّمة وكشوف حساب
وصفات وطلبات مخبر ومخزون ومصروفات
تقارير الإيرادات والمصروفات والربح مع تصدير CSV
أدوار للفريق ودخول برمز PIN وقفل تلقائي
نسخ احتياطي في ملف واحد مع تشفير اختياري AES-256
تجربة مجانية 7 أيام بكل المزايا دون تسجيل
```

**كلمات البحث**

```
برنامج عيادة أسنان
إدارة عيادة الأسنان
برنامج طبيب أسنان
مخطط الأسنان
برنامج أسنان بدون إنترنت
مواعيد عيادة الأسنان
dental clinic software
```

| الحقل | القيمة |
|---|---|
| لقطات الشاشة | `store/screenshots/desktop/ar/01-dashboard.png` … `07-reports.png` بالترتيب |
| سياسة الخصوصية | `https://dentora.raqeem.dev/privacy` |
| الموقع | `https://dentora.raqeem.dev/` |
| شروط الترخيص الإضافية | `https://dentora.raqeem.dev/terms` |

---

## 4. The other Partner Center pages — بقية صفحات Partner Center

| Page | Answer |
|---|---|
| Pricing and availability | **Free**; all markets (or the ones you sell to); no Store trial (the app has its own 7-day trial) |
| Properties → Category | **Medical** (or Business, as on Google Play) |
| Properties → "This product accesses, collects, or transmits personal information" | **Yes**: activating with a licence key sends the key and the device number to `dentora.raqeem.dev` once. The privacy policy URL is then required (policy 10.5.1) |
| Properties → product declarations | Leave the defaults; it does not depend on a Microsoft account; no in-app purchases through the Store |
| Age ratings (IARC questionnaire) | Category "Productivity/utility"; no violence, sexual content, gambling, user-to-user communication or location sharing; no purchases through the Store → expected 3+ / Everyone |
| Packages | Upload `Dentora-1.1.0-x64.msix` (the one built with your identity values), device family **Desktop** |
| Submission options → restricted capability **runFullTrust** | `Dentora is an Electron desktop application packaged as MSIX. It needs runFullTrust to run as a normal Windows desktop program: its own window, printing invoices and prescriptions, and saving or opening backup files where the user chooses.` |
| Notes for certification | `No sign-in is needed. On first launch the setup wizard creates the clinic and an administrator PIN of your choice. Settings → Backup & data → Load demo data fills a sample clinic. Every installation has a 7-day trial with every feature, so nothing is locked during certification. The app works offline; it contacts https://dentora.raqeem.dev only when a licence key is activated (Settings → Licence).` |

---

## 5. Steps for Ahmad — الخطوات

1. Open `https://storedeveloper.microsoft.com` and create a **Company** developer account named **Raqeem** (free).
2. In Partner Center → Apps and games → **New product** → MSIX or PWA app → reserve the name **Dentora**.
3. Open Dentora → Product management → **Product identity**, and send the three values (Package/Identity/Name,
   Package/Identity/Publisher, Package/Properties/PublisherDisplayName). The package is then rebuilt with them
   (`scripts/build-msix.mjs`); the one in `release/` named `…-TEST.msix` has placeholder values and cannot be uploaded.
4. Fill the pages with sections 2–4 of this file, upload the package, and submit. Certification usually takes up to
   three business days.
5. When the Store page is live, send its address: the website then shows the Microsoft Store badge and lists it in
   the structured data (`sameAs`).

١. أنشئ حساب مطوّر من نوع **شركة** باسم Raqeem على `storedeveloper.microsoft.com` (مجاناً).
٢. في Partner Center: منتج جديد ← تطبيق MSIX ← احجز الاسم **Dentora**.
٣. من إدارة المنتج ← هوية المنتج انسخ القيم الثلاث وأرسلها، فتُبنى الحزمة بها.
٤. املأ الصفحات من الأقسام 2–4 وارفع الحزمة وأرسلها للمراجعة.
٥. عند نشر صفحة المتجر أرسل رابطها لإضافة شارة المتجر إلى الموقع.

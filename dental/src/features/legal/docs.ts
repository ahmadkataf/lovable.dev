import type { ModuleDict } from '@/i18n/types'

// The privacy policy and the terms of use, read as t('legal.privacy.body') / t('legal.terms.body') once this file is
// loaded (features/legal/lib.ts loadLegalDocs() registers it into the "legal" strings). It is loaded only when a
// document is opened, so these pages never weigh on the start of the app. The markup: '## ' a heading, '- ' a
// bullet, an empty line between paragraphs. Placeholders: {seller} and {contact} (the seller's name and the contacts that are set in features/settings/seller.ts).
// The same text is published as docs/PRIVACY.md and docs/TERMS.md for the store listing: change both together.
const docs: ModuleDict = {
  ar: {
    'privacy.body': `يشرح هذا المستند كيف يتعامل برنامج Dentora لإدارة عيادات الأسنان مع البيانات. باختصار: كل بيانات العيادة ومرضاها تبقى على الجهاز الذي يعمل عليه البرنامج، ولا نتلقى منها شيئاً.

## من نحن
Dentora برنامج تبيعه {seller} ("نحن"). العيادة التي تستخدم البرنامج ("العيادة") هي المسؤولة عن بيانات مرضاها وصاحبة القرار فيها، ونحن لا نطّلع على هذه البيانات ولا نستلمها.

## ما البيانات التي يحفظها البرنامج
- بيانات المرضى: الاسم ورقم الملف والجنس وتاريخ الميلاد ووسائل التواصل والعنوان، ورقم الهوية وبيانات التأمين إن أُدخلت.
- البيانات الصحية: التحسس والأمراض المزمنة والأدوية والملاحظات الطبية، والمخطط السني وخطط العلاج والملاحظات السريرية والوصفات وطلبات المخبر، والصور الشعاعية والصور والمستندات التي تضيفها العيادة.
- المواعيد والفواتير والدفعات والمصروفات والمخزون.
- حسابات فريق العيادة: الاسم والدور ورمز الدخول (PIN)، ويُحفظ الرمز مشفّراً بدالة تجزئة مع ملح عشوائي ولا يُحفظ الرمز نفسه أبداً.
- إعدادات العيادة وبيانات الترخيص (رقم الجهاز ورمز التفعيل) وسجل النشاط داخل البرنامج.

## أين تُحفظ
تُحفظ البيانات على الجهاز نفسه فقط، في مساحة التخزين الخاصة بالبرنامج. لا تُرسَل إلى أي خادم، ولا يوجد حساب سحابي، ولا يحتاج البرنامج إلى الإنترنت ليعمل، إلا مرة واحدة عند تفعيله بمفتاح ترخيص. تطبيق أندرويد مستثنى من النسخ الاحتياطي لنظام أندرويد (في حساب Google) ومن نقل البيانات إلى هاتف جديد، لذلك فملف النسخة الاحتياطية الذي تصدّره العيادة من داخل البرنامج هو النسخة الوحيدة من البيانات خارج البرنامج. وعلى ويندوز تبقى البيانات في مجلد البرنامج داخل حساب المستخدم، ولا تدخل في أي نسخة احتياطية إلا إذا نسخت العيادة ذلك المجلد بنفسها.

## ما الذي يخرج من الجهاز
لا يرسل البرنامج أي بيانات تلقائياً: لا إحصاءات استخدام ولا إعلانات ولا تقارير أعطال ولا تتبّع. لا يخرج شيء إلا بفعل يقوم به مستخدم في العيادة:
- رسائل واتساب (تذكير بموعد، وصفة، فاتورة): يفتح البرنامج واتساب والنص ظاهر قبل الإرسال، والإرسال قرار المستخدم.
- الطباعة وحفظ ملفات PDF.
- تصدير نسخة احتياطية أو ملفات CSV ومشاركة الملفات.
- التفعيل بمفتاح ترخيص: يُرسَل المفتاح ورقم الجهاز فقط إلى خادم التفعيل (انظر «التفعيل بمفتاح ترخيص» أدناه).
بعد أن يغادر الملف أو الرسالة البرنامج تصبح العيادة مسؤولة عنه.

## رقم الجهاز
يحسب البرنامج رقماً قصيراً للجهاز من بصمة مشفّرة لمعرّف الجهاز (معرّف أندرويد أو MachineGuid في ويندوز)، ولا يُستخدم إلا لربط رمز التفعيل بهذا الجهاز. تراه العيادة في الإعدادات وترسله إلى البائع للحصول على رمز التفعيل، أو يرسله البرنامج مع مفتاح الترخيص عند التفعيل به، ولا يكشف شيئاً عن العيادة أو مرضاها.

## التفعيل بمفتاح ترخيص
لا يرسل Dentora شيئاً من بيانات العيادة أو المرضى إلينا ولا إلى أي خادم. المرة الوحيدة التي يتصل فيها بخادم هي حين تفعّله العيادة بمفتاح ترخيص: يرسل حينها المفتاح ورقم الجهاز (رقم مشتق من الجهاز، وليس من بيانات العيادة) إلى dentora.raqeem.dev، مرة واحدة، لاستلام رمز التفعيل. وتتلقى صفحة التفعيل على ذلك الموقع القيمتين نفسيهما إن استخدمتها العيادة بدلاً من البرنامج. يحتفظ الخادم برقم الجهاز الذي فُعّل عليه المفتاح وبوقت التفعيل مع سجل البيع، ليرفض المفتاح على جهاز ثانٍ، ويَعُدّ المحاولات الفاشلة من كل عنوان إنترنت مدة 15 دقيقة لمنع تخمين المفاتيح. أما التفعيل برمز يرسله البائع فلا يحتاج إلى أي اتصال.

## النسخ الاحتياطية
ملف النسخة الاحتياطية يحوي كل بيانات العيادة، بما فيها البيانات الصحية للمرضى. يمكن حمايته بكلمة مرور عند التصدير، ويجب حفظه في مكان آمن خارج الجهاز. العيادة وحدها تتحكم في هذه الملفات وفي مكان حفظها ومن يطّلع عليها.

## حماية البيانات
- الدخول برمز PIN لكل مستخدم، وقفل تلقائي بعد فترة من عدم الاستخدام.
- أدوار وصلاحيات تحدد ما يراه كل فرد من الفريق.
- ننصح العيادة بقفل الجهاز بكلمة مرور وتشفير قرصه، وتحديث نظامه، وحماية النسخ الاحتياطية بكلمة مرور.

## مدة الحفظ والحذف
تبقى البيانات حتى تحذفها العيادة. يمكن حذف أي سجل أو أرشفته، ويحذف الأمر «حذف كل البيانات» في الإعدادات ← النسخ الاحتياطي كل البيانات من الجهاز. إزالة التطبيق على أندرويد تحذف بياناته، وعلى ويندوز يُنصح باستخدام «حذف كل البيانات» قبل إزالة البرنامج. على العيادة الالتزام بالمدد التي يفرضها القانون في بلدها لحفظ السجلات الطبية.

## حقوق المرضى
تتولى العيادة طلبات المرضى للاطلاع على بياناتهم أو تصحيحها أو الحصول على نسخة منها أو حذفها، ويتيح البرنامج عرض أي سجل وتعديله وطباعته وحذفه. لا نستطيع نحن تنفيذ هذه الطلبات لأننا لا نملك أي نسخة من البيانات، فيُرجى أن يتوجه المريض إلى عيادته.

## الأطفال
البرنامج مخصص لفريق العيادة وليس للأطفال، وقد يحوي سجلات مرضى أطفال تُدخلها العيادة وتتحمل مسؤوليتها.

## التعديلات
قد نحدّث هذه السياسة مع إصدارات البرنامج، ويبيّن التاريخ في أعلاها آخر تحديث.

## التواصل
{contact}`,

    'terms.body': `هذه شروط استخدام برنامج Dentora (اتفاقية ترخيص المستخدم النهائي). باستخدام البرنامج أو تثبيته توافق عليها نيابةً عن العيادة.

## الترخيص
- نمنح العيادة ترخيصاً غير حصري وغير قابل للتحويل لاستخدام البرنامج على جهاز واحد لكل رمز تفعيل، للمدة والباقة المحددتين في الرمز.
- يعمل البرنامج 7 أيام تجريبية بكل المزايا، ثم ينتقل إلى وضع القراءة فقط حتى التفعيل. تبقى البيانات متاحة للاطلاع والتصدير.
- رمز التفعيل مرتبط بالجهاز. لنقل الترخيص إلى جهاز جديد تواصل مع البائع للحصول على رمز جديد.
- يعمل مفتاح الترخيص على أول جهاز يُفعَّل عليه، ولا يعمل على غيره. يحتاج تفعيله إلى اتصال بالإنترنت مرة واحدة، ثم يرتبط رمز التفعيل الناتج عنه بذلك الجهاز كأي رمز آخر. والمفتاح المبيع لسنة أو سنتين تُحسب مدته من يوم تفعيله.
- لا يجوز بيع البرنامج أو تأجيره أو إعادة توزيعه أو منح ترخيص فرعي به، ولا تعديله أو تفكيكه أو تجاوز آلية التفعيل، إلا في الحدود التي يسمح بها القانون صراحة.

## الملكية
البرنامج مرخّص للاستخدام وليس مبيعاً، وتبقى حقوقه لنا ولمرخّصينا. أما بيانات العيادة ومرضاها فهي ملك العيادة.

## مسؤوليات العيادة
- صحة البيانات التي تُدخلها، واستخدام البرنامج وفق القوانين المطبقة على السجلات الطبية والخصوصية والفوترة والضرائب في بلدها.
- النسخ الاحتياطي: البيانات محفوظة على هذا الجهاز وحده، وضياع الجهاز أو تعطله دون نسخة احتياطية يعني ضياع البيانات. على العيادة تصدير نسخة احتياطية بانتظام (أسبوعياً على الأقل) وحفظها خارج الجهاز.
- حماية الجهاز وحسابات الفريق ورموز الدخول، ومنح الصلاحيات المناسبة لكل مستخدم.

## إخلاء المسؤولية الطبية
Dentora أداة إدارية لحفظ السجلات، ولا يقدّم استشارة طبية ولا تشخيصاً ولا علاجاً. قوائم الأدوية والجرعات والمدد وقوائم الإجراءات والأسعار الجاهزة أمثلة قابلة للتعديل وليست توصيات. الطبيب المعالج وحده مسؤول عن كل قرار سريري وكل وصفة، بما في ذلك التحقق من التحسس والتداخلات الدوائية وموانع الاستعمال والحمل وجرعات الأطفال. تنبيهات التحسس في البرنامج وسيلة مساعدة وقد لا تكشف كل تعارض.

## الفواتير والضرائب
تصدر الفواتير والتقارير وفق الإعدادات التي تختارها العيادة، والعيادة مسؤولة عن التزامها بمتطلبات الضرائب والفوترة في بلدها.

## إخلاء الضمان
يُقدَّم البرنامج «كما هو» و«حسب توفره»، دون أي ضمان صريح أو ضمني، بما في ذلك ضمانات الملاءمة لغرض معين أو خلوّه من الأخطاء، وذلك إلى أقصى حد يسمح به القانون.

## حدود المسؤولية
إلى أقصى حد يسمح به القانون، لا نتحمل المسؤولية عن أي أضرار غير مباشرة أو تبعية، ولا عن فقدان البيانات أو الأرباح أو انقطاع العمل، ولا عن نتائج أي قرار علاجي. ولا تتجاوز مسؤوليتنا الإجمالية في كل الأحوال المبلغ الذي دفعته العيادة مقابل الترخيص خلال الاثني عشر شهراً السابقة للمطالبة. لا يحدّ هذا البند من أي مسؤولية لا يجوز تحديدها قانوناً.

## التحديثات والدعم
قد نصدر تحديثات للبرنامج، ونقدم الدعم عبر وسائل التواصل أدناه.

## انتهاء الترخيص
ينتهي الترخيص عند انتهاء مدة الرمز أو عند مخالفة هذه الشروط. يمكن للعيادة التوقف عن الاستخدام في أي وقت، وتبقى بياناتها على جهازها ويمكنها تصديرها.

## القانون المطبق
تخضع هذه الشروط لقوانين البلد الذي يمارس فيه البائع نشاطه، ما لم تفرض القوانين الآمرة في بلد العيادة غير ذلك.

## التواصل
{contact}`,
  },
  en: {
    'privacy.body': `This document explains how Dentora, dental clinic management software, handles data. In short: all the data of the clinic and its patients stays on the device the app runs on, and we receive none of it.

## Who we are
Dentora is sold by {seller} ("we"). The clinic that uses the app ("the clinic") is responsible for its patients’ data and decides how it is used. We do not see or receive this data.

## What the app stores
- Patient details: name, file number, gender, date of birth, contact details and address, and an ID number and insurance details when entered.
- Health data: allergies, chronic conditions, medications and medical notes; the dental chart, treatment plans, clinical notes, prescriptions and lab orders; X-rays, photos and documents the clinic adds.
- Appointments, invoices, payments, expenses and stock.
- Staff accounts: name, role and PIN. The PIN is stored as a salted hash, never the PIN itself.
- Clinic settings, licence details (device number and activation code) and the in-app activity log.

## Where it is stored
Data is stored only on the device itself, in the app’s private storage. It is never sent to a server, there is no cloud account, and the app needs no internet connection to work, except once when it is activated with a licence key. The Android app is excluded from Android’s system backup (to a Google account) and from device-to-device transfer, so the backup file the clinic exports from inside the app is the only copy of the data outside the app. On Windows the data stays in the app’s folder in the user’s profile and goes into a backup only if the clinic itself backs up that folder.

## What leaves the device
The app sends no data on its own: no usage statistics, no advertising, no crash reports, no tracking. Nothing leaves the device except through an action taken by someone at the clinic:
- WhatsApp messages (an appointment reminder, a prescription, an invoice): the app opens WhatsApp with the text visible before it is sent, and sending is the user’s choice.
- Printing and saving PDF files.
- Exporting a backup or CSV files, and sharing files.
- Activating with a licence key: only the key and the device number go to the activation server (see “Activation with a licence key” below).
Once a file or message has left the app, the clinic is responsible for it.

## Device number
The app derives a short device number from a hash of the device identifier (the Android ID, or the Windows MachineGuid). It is used only to match an activation code to this device. The clinic sees it in Settings and sends it to the seller to obtain an activation code, or the app sends it with a licence key when the clinic activates with one; it reveals nothing about the clinic or its patients.

## Activation with a licence key
Dentora never sends clinic or patient data to us or to any server. The only time it contacts a server is when the clinic activates it with a licence key: it then sends the key and the device number (a number derived from the device, not the clinic’s data) to dentora.raqeem.dev, once, to receive the activation code. The activation page on that website receives the same two values when the clinic uses it instead. The server keeps the key’s device number and activation time with the record of the sale, so that the key is refused on a second device, and counts failed attempts from each internet address for 15 minutes to stop anyone guessing keys. Activating with a code sent by the seller needs no connection at all.

## Backups
A backup file contains all of the clinic’s data, including patients’ health data. It can be protected with a password when exported, and it should be kept somewhere safe away from the device. The clinic alone controls these files, where they are kept and who can see them.

## Security
- A PIN for every user, and automatic locking after a period of inactivity.
- Roles and permissions that decide what each team member can see.
- We recommend that the clinic locks the device with a password, encrypts its disk, keeps its system updated and protects backups with a password.

## Retention and deletion
Data stays until the clinic deletes it. Any record can be deleted or archived, and “Delete all data” in Settings → Backup erases everything on the device. Uninstalling the app on Android deletes its data; on Windows, use “Delete all data” before uninstalling. The clinic must keep medical records for as long as the law of its country requires.

## Patients’ rights
Patients’ requests to see, correct, receive a copy of or delete their information are handled by the clinic, and the app lets it view, edit, print and delete any record. We cannot act on such requests because we hold no copy of the data, so patients should contact their clinic.

## Children
The app is meant for clinic staff, not for children. It may hold records of child patients entered by the clinic, which is responsible for them.

## Changes
We may update this policy with new versions of the app; the date at the top shows the latest version.

## Contact
{contact}`,

    'terms.body': `These are the terms of use of Dentora (the end-user licence agreement). By installing or using the app you accept them on behalf of the clinic.

## Licence
- We grant the clinic a non-exclusive, non-transferable licence to use the app on one device per activation code, for the period and plan stated in the code.
- The app runs as a 7-day trial with every feature, then becomes read-only until it is activated. The data stays available to view and export.
- An activation code is tied to its device. To move the licence to a new device, contact the seller for a new code.
- A licence key works on the first device that activates it, and on no other. Activating it needs an internet connection once; the activation code it gives is then tied to that device like any other code. A key sold for one or two years counts that period from the day it is activated.
- The app may not be sold, rented, redistributed or sublicensed, nor modified, reverse-engineered or used with its activation bypassed, except where the law expressly allows it.

## Ownership
The software is licensed, not sold, and its rights remain with us and our licensors. The data of the clinic and its patients belongs to the clinic.

## The clinic’s responsibilities
- The accuracy of the data it enters, and using the app in line with the laws on medical records, privacy, invoicing and tax that apply in its country.
- Backups: the data is kept on this device only, and losing the device or a failure without a backup means losing the data. The clinic must export a backup regularly (at least weekly) and keep it away from the device.
- Protecting the device, staff accounts and PINs, and giving each user suitable permissions.

## Medical disclaimer
Dentora is an administrative record-keeping tool. It does not give medical advice, a diagnosis or treatment. The ready-made drug lists, doses, durations, procedure lists and prices are editable examples, not recommendations. The treating dentist alone is responsible for every clinical decision and every prescription, including checking allergies, drug interactions, contraindications, pregnancy and children’s doses. The app’s allergy warnings are an aid and may not catch every conflict.

## Invoices and tax
Invoices and reports follow the settings the clinic chooses, and the clinic is responsible for meeting the tax and invoicing requirements of its country.

## No warranty
The app is provided “as is” and “as available”, without any express or implied warranty, including fitness for a particular purpose or freedom from errors, to the fullest extent the law allows.

## Limitation of liability
To the fullest extent the law allows, we are not liable for any indirect or consequential damage, for loss of data, profit or business, or for the outcome of any treatment decision. In any case our total liability is limited to the amount the clinic paid for the licence in the twelve months before the claim. Nothing in this section limits any liability that cannot be limited by law.

## Updates and support
We may release updates to the app, and we provide support through the contact details below.

## End of the licence
The licence ends when the code’s period ends or if these terms are breached. The clinic may stop using the app at any time; its data stays on its device and can be exported.

## Governing law
These terms are governed by the laws of the country where the seller is established, unless the mandatory laws of the clinic’s country provide otherwise.

## Contact
{contact}`,
  },
}
export default docs

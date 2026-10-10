import type { ModuleDict } from '../types'

// Strings of the "treatments" module. Keys are used as t('treatments.<key>'). Keep ar and en in step.
// Counted strings use '<key>_<plural rule>' (Arabic: zero one two few many other; English: one other) through tn().
const treatments: ModuleDict = {
  ar: {
    // shared bits
    quick: 'علاج سريع', noDoctor: 'بدون طبيب محدد', noPlan: 'خارج الخطة', openPatient: 'فتح ملف المريض', clearFilters: 'مسح عوامل التصفية', exportCsv: 'تصدير CSV',
    keep: 'إبقاء الخطة', toothN: 'السن {n}', teethList: 'الأسنان: {list}',
    'col.procedure': 'الإجراء', 'col.surfaces': 'السطوح', 'col.billed': 'مفوتر',

    // item workflow
    'act.start': 'بدء', 'act.complete': 'إنجاز', 'act.backToPlanned': 'إعادة إلى المخطط', 'act.reopen': 'إعادة فتح', 'act.cancel': 'إلغاء البند', 'act.restore': 'استعادة',

    // statistics
    'stat.planned': 'علاجات مخططة', 'stat.plannedValue': 'قيمة العلاجات المخططة', 'stat.inProgress': 'قيد التنفيذ', 'stat.completed': 'علاجات منجزة',
    'stat.doneMonth': 'المنجز هذا الشهر', 'stat.unbilled': 'منجز غير مفوتر', 'stat.allBilled': 'كل المنجز مفوتر',

    // patient tab
    'tab.plans': 'خطط العلاج', 'tab.noOpenPlans': 'لا توجد خطة مفتوحة حالياً',
    'tab.emptyTitle': 'لا توجد خطط علاج بعد', 'tab.emptyDesc': 'أنشئ خطة علاج تضم الإجراءات المقترحة وأسعارها، أو سجّل علاجاً منجزاً مباشرة.',
    'tab.noPlansTitle': 'لا توجد خطط علاج', 'tab.noPlansDesc': 'نظّم العلاجات القادمة في خطة يطّلع عليها المريض ويوافق عليها.',
    'tab.loose': 'علاجات خارج الخطط', 'tab.looseSub': 'علاجات سريعة وبنود من خطط محذوفة',

    // plans
    'plan.new': 'خطة علاج جديدة', 'plan.newTitle': 'خطة علاج جديدة', 'plan.newSub': 'تبدأ الخطة كمسودة، وتُعتمد بعد موافقة المريض.', 'plan.editTitle': 'تعديل الخطة',
    'plan.titleLabel': 'عنوان الخطة', 'plan.defaultTitle': 'خطة علاج — {date}', 'plan.notesPh': 'ما يحتاج الفريق أو المريض إلى معرفته…', 'plan.create': 'إنشاء الخطة',
    'plan.addItem': 'إضافة بند', 'plan.approve': 'اعتماد الخطة', 'plan.print': 'طباعة التقدير', 'plan.edit': 'تعديل الخطة', 'plan.cancel': 'إلغاء الخطة',
    'plan.reopen': 'إعادة تفعيل الخطة', 'plan.delete': 'حذف الخطة',
    'plan.cancelTitle': 'إلغاء خطة العلاج؟', 'plan.cancelDesc': 'ستُلغى البنود التي لم تُنجز بعد، وتبقى البنود المنجزة في سجل المريض.',
    'plan.deleteDesc': 'ستُحذف الخطة وجميع بنودها نهائياً.',
    'plan.deleteKeep': 'ستُحذف الخطة وبنودها غير المنجزة. أما البنود المنجزة ({n}) فتبقى في سجل المريض ضمن «علاجات خارج الخطط».',
    'plan.emptyTitle': 'لا توجد بنود في هذه الخطة', 'plan.emptyDesc': 'أضف الإجراءات المقترحة للمريض مع الأسنان والأسعار.', 'plan.noItems': 'لا توجد بنود',
    'plan.progress': 'أُنجز {done} من {count}', 'plan.value': 'قيمة الخطة', 'plan.afterDiscount': 'بعد خصم', 'plan.doneValue': 'قيمة المنجز',

    // add / edit item
    'item.addTitle': 'إضافة بند علاجي', 'item.addSub': 'اختر الإجراء ثم الأسنان؛ يُنشأ بند مستقل لكل سن.', 'item.editTitle': 'تعديل البند', 'item.forTeeth': 'للسن {list} — اختر الإجراء المطلوب.',
    'item.quickTitle': 'علاج سريع', 'item.quickSub': 'سجّل علاجاً منجزاً مباشرة دون خطة، كالفحص أو التنظيف.',
    'item.procedure': 'الإجراء', 'item.change': 'تغيير', 'item.teeth': 'الأسنان', 'item.pickTeeth': 'تحديد أسنان',
    'item.teethHint': 'اضغط على سن أو أكثر؛ يمكن إضافة الإجراء نفسه لعدة أسنان دفعة واحدة.',
    'item.surfaces': 'السطوح', 'item.surfacesHint': 'اختياري، ويُطبَّق على كل الأسنان المحددة.',
    'item.details': 'السعر والتفاصيل', 'item.pricePerTooth': 'السعر لكل سن', 'item.discountPerTooth': 'الخصم لكل سن',
    'item.plannedDate': 'التاريخ المخطط', 'item.doneDate': 'تاريخ التنفيذ', 'item.plan': 'ضمن الخطة',
    'item.newPlanOption': '+ خطة علاج جديدة', 'item.noPlanOption': 'بدون خطة', 'item.newPlanHint': 'ستُنشأ خطة جديدة بتاريخ اليوم.', 'item.noPlanHint': 'يظهر البند ضمن «علاجات خارج الخطط».',
    'item.notesPh': 'ملاحظة للطبيب أو للمريض', 'item.add': 'إضافة البند', 'item.saveQuick': 'حفظ كعلاج منجز',
    'item.addN_two': 'إضافة بندين', 'item.addN_few': 'إضافة {n} بنود', 'item.addN_many': 'إضافة {n} بنداً', 'item.addN_other': 'إضافة {n} بند',
    'item.billed': 'مفوتر', 'item.openInvoice': 'فتح الفاتورة',
    'item.billedLock': 'هذا البند مُدرج في فاتورة، لذا لا يمكن تغيير الإجراء أو السن أو السعر. يمكنك تعديل الطبيب والتاريخ والملاحظات.',
    'item.deleteDesc': 'سيُحذف البند «{name}» نهائياً.',

    // procedure picker & teeth
    'picker.search': 'ابحث بالاسم أو الرمز…', 'picker.noMatch': 'جرّب كلمة أخرى أو فئة مختلفة.', 'picker.noProcedures': 'أضف إجراءات إلى قائمة الأسعار أولاً.',
    'teeth.upper': 'الفك العلوي', 'teeth.lower': 'الفك السفلي', 'teeth.primary': 'أسنان لبنية', 'teeth.clear': 'إلغاء التحديد', 'teeth.right': 'يمين', 'teeth.left': 'يسار',

    // chart update
    'chart.title': 'تحديث مخطط الأسنان؟', 'chart.sub': 'أُنجز «{name}». سجّل ما تركه العلاج على السن ليبقى المخطط محدّثاً.', 'chart.condition': 'الحالة المسجّلة',
    'chart.apply': 'تحديث المخطط', 'chart.skip': 'ليس الآن', 'chart.needSurface': 'اختر سطحاً واحداً على الأقل',

    // billing
    'bill.button': 'فوترة المنجز', 'bill.title': 'فوترة العلاجات المنجزة', 'bill.sub': 'اختر البنود التي ستتضمنها الفاتورة.', 'bill.create': 'إصدار الفاتورة',
    'bill.discounts': 'الخصومات', 'bill.gross': 'قيمة العلاجات', 'bill.nothing': 'لا توجد علاجات منجزة بانتظار الفوترة',

    // printed estimate
    'print.title': 'طباعة خطة العلاج', 'print.docTitle': 'خطة علاج وتقدير تكلفة', 'print.estimate': 'التكلفة التقديرية',
    'print.disclaimer': 'هذا تقدير مبدئي للتكلفة صالح لمدة 30 يوماً، وقد يتغيّر إذا تغيّرت خطة العلاج بعد الفحص أو أثناء المعالجة.',
    'print.patientSign': 'توقيع المريض', 'print.doctorSign': 'توقيع الطبيب',

    // procedures (price list)
    'proc.title': 'قائمة الإجراءات والأسعار', 'proc.subtitle': '{n} في {cats} — المفعّل منها {active}', 'proc.subtitleEmpty': 'سعر العيادة لكل إجراء علاجي',
    'proc.new': 'إجراء جديد', 'proc.newTitle': 'إجراء جديد', 'proc.editTitle': 'تعديل الإجراء', 'proc.copyTitle': 'نسخ الإجراء', 'proc.copySuffix': '(نسخة)',
    'proc.formSub': 'يظهر بهذا الاسم والسعر في خطط العلاج والفواتير.', 'proc.name': 'اسم الإجراء', 'proc.namePh': 'مثال: حشوة كومبوزيت — سطح واحد',
    'proc.nameEn': 'الاسم بالإنجليزية', 'proc.nameEnHint': 'يظهر عند استخدام الواجهة الإنجليزية', 'proc.duration': 'المدة المعتادة',
    'proc.color': 'اللون', 'proc.colorAuto': 'لون الفئة', 'proc.toothSpecific': 'يتطلب تحديد سن', 'proc.toothSpecificHint': 'كالحشوات والتيجان وعلاج العصب والقلع',
    'proc.activeLabel': 'مفعّل', 'proc.activeHint': 'الإجراءات الموقوفة لا تظهر عند إضافة علاج جديد', 'proc.perTooth': 'لكل سن',
    'proc.search': 'ابحث في القائمة بالاسم أو الرمز…', 'proc.showActive': 'المفعّلة', 'proc.showInactive': 'الموقوفة', 'proc.allCategories': 'كل الفئات', 'proc.results': 'نتائج البحث',
    'proc.noMatch': 'لا يوجد إجراء يطابق البحث أو التصفية الحالية.',
    'proc.emptyTitle': 'قائمة الأسعار فارغة', 'proc.emptyDesc': 'حمّل القائمة الافتراضية للإجراءات الشائعة بأسعار يمكنك تعديلها، أو أضف إجراءات عيادتك بنفسك.',
    'proc.loadDefaults': 'تحميل القائمة الافتراضية', 'proc.addOwn': 'إضافة إجراء', 'proc.activate': 'تفعيل', 'proc.deactivate': 'إيقاف', 'proc.deactivateInstead': 'إيقاف الإجراء',
    'proc.inUseTitle': 'لا يمكن حذف هذا الإجراء',
    'proc.inUseDesc': '«{name}» مستخدم {uses} في علاجات أو فواتير سابقة. يمكنك إيقافه ليختفي من القوائم مع بقاء السجلات السابقة كما هي.',
    'proc.deleteDesc': 'سيُحذف «{name}» من قائمة الأسعار نهائياً.',

    // bulk price change
    'bulk.button': 'تعديل الأسعار', 'bulk.title': 'تعديل جماعي للأسعار', 'bulk.sub': 'يُطبَّق على: {scope}', 'bulk.allCategories': 'جميع الفئات',
    'bulk.direction': 'نوع التعديل', 'bulk.increase': 'زيادة', 'bulk.decrease': 'تخفيض', 'bulk.mode': 'طريقة الحساب', 'bulk.percent': 'نسبة مئوية', 'bulk.fixed': 'مبلغ ثابت',
    'bulk.value': 'القيمة', 'bulk.round': 'التقريب', 'bulk.roundNone': 'بدون تقريب', 'bulk.roundTo': 'لأقرب {n}',
    'bulk.preview': 'معاينة الأسعار الجديدة', 'bulk.andMore': 'وإجراءات أخرى ({n})', 'bulk.apply': 'تطبيق التعديل', 'bulk.affects': 'يشمل التعديل {prices}', 'bulk.changedN': 'عدد الأسعار المعدّلة: {n}',
    'bulk.empty': 'لا توجد إجراءات في هذه الفئة.', 'bulk.tooMuch': 'يجب أن يكون التخفيض أقل من 100%',

    // clinic register
    'reg.title': 'سجل العلاجات', 'reg.subtitle': 'كل العلاجات المخططة والمنجزة في العيادة', 'reg.search': 'ابحث باسم المريض أو الإجراء أو رقم السن…',
    'reg.group': 'تجميع حسب المريض', 'reg.allDoctors': 'كل الأطباء', 'reg.noMatch': 'لا توجد علاجات تطابق عوامل التصفية الحالية.',
    'reg.emptyTitle': 'لا توجد علاجات بعد', 'reg.emptyDesc': 'تُضاف العلاجات من ملف المريض: افتح ملف مريض وأنشئ له خطة علاج أو سجّل علاجاً سريعاً.', 'reg.goPatients': 'الذهاب إلى المرضى',
    'range.all': 'كل الفترات', 'range.today': 'اليوم', 'range.week': 'هذا الأسبوع', 'range.month': 'هذا الشهر', 'range.custom': 'فترة مخصصة',

    // validation
    'v.procedure': 'اختر إجراءً من القائمة', 'v.teeth': 'هذا الإجراء يتطلب تحديد سن واحد على الأقل', 'v.price': 'أدخل السعر', 'v.priceNegative': 'لا يمكن أن يكون السعر سالباً',
    'v.discountNegative': 'لا يمكن أن يكون الخصم سالباً', 'v.discountTooBig': 'الخصم أكبر من السعر', 'v.codeTaken': 'هذا الرمز مستخدم لإجراء آخر', 'v.duration': 'أدخل مدة بين 0 و600 دقيقة',

    // toasts
    'toast.planCreated': 'تم إنشاء الخطة', 'toast.planUpdated': 'تم حفظ الخطة', 'toast.planApproved': 'تم اعتماد الخطة', 'toast.planCancelled': 'تم إلغاء الخطة',
    'toast.planReopened': 'أُعيد تفعيل الخطة', 'toast.planDeleted': 'تم حذف الخطة', 'toast.planDone': 'اكتملت خطة العلاج بالكامل',
    'toast.itemsAdded_one': 'تمت إضافة البند', 'toast.itemsAdded_two': 'تمت إضافة بندين', 'toast.itemsAdded_few': 'تمت إضافة {n} بنود', 'toast.itemsAdded_many': 'تمت إضافة {n} بنداً', 'toast.itemsAdded_other': 'تمت إضافة {n} بند',
    'toast.itemUpdated': 'تم حفظ التعديلات', 'toast.itemDeleted': 'تم حذف البند', 'toast.quickDone': 'تم تسجيل العلاج المنجز', 'toast.completed': 'تم إنجاز العلاج',
    'toast.status.planned': 'أُعيد البند إلى المخطط', 'toast.status.in_progress': 'بدأ العلاج', 'toast.status.cancelled': 'أُلغي البند',
    'toast.chartUpdated': 'تم تحديث مخطط الأسنان', 'toast.invoiced': 'صدرت الفاتورة {number}',
    'toast.procCreated': 'تمت إضافة الإجراء', 'toast.procUpdated': 'تم حفظ الإجراء', 'toast.procDeleted': 'تم حذف الإجراء', 'toast.procActivated': 'تم تفعيل الإجراء', 'toast.procDeactivated': 'تم إيقاف الإجراء',
    'toast.defaultsLoaded': 'تم تحميل القائمة الافتراضية', 'toast.defaultsNone': 'القائمة الافتراضية محمّلة مسبقاً', 'toast.bulkDone': 'تم تحديث الأسعار', 'toast.exported': 'تم تصدير الملف',

    // activity feed
    'log.planCreated': 'خطة علاج جديدة: {title}', 'log.planUpdated': 'تعديل خطة العلاج: {title}', 'log.planApproved': 'اعتماد خطة العلاج: {title}',
    'log.planCancelled': 'إلغاء خطة العلاج: {title}', 'log.planDeleted': 'حذف خطة العلاج: {title}',
    'log.itemsAdded': 'إضافة إلى خطة العلاج: {name}', 'log.quickDone': 'علاج منجز: {name}', 'log.itemUpdated': 'تعديل بند علاجي: {name}', 'log.itemDeleted': 'حذف بند علاجي: {name}',
    'log.status.planned': 'إعادة إلى المخطط: {name}', 'log.status.in_progress': 'بدء العلاج: {name}', 'log.status.completed': 'إنجاز العلاج: {name}', 'log.status.cancelled': 'إلغاء العلاج: {name}',
    'log.chart': 'تحديث مخطط الأسنان: {teeth} ← {cond}', 'log.invoice': 'فاتورة {number} للعلاجات المنجزة — {name}',
    'log.procCreated': 'إجراء جديد في قائمة الأسعار: {name}', 'log.procUpdated': 'تعديل إجراء في قائمة الأسعار: {name}', 'log.procDeleted': 'حذف إجراء من قائمة الأسعار: {name}',
    'log.defaults': 'تحميل قائمة الإجراءات الافتراضية', 'log.bulk': 'تعديل جماعي للأسعار — {scope} ({change})',

    // counted words
    'n.items_zero': 'لا بنود', 'n.items_one': 'بند واحد', 'n.items_two': 'بندان', 'n.items_few': '{n} بنود', 'n.items_many': '{n} بنداً', 'n.items_other': '{n} بند',
    'n.procedures_zero': 'لا إجراءات', 'n.procedures_one': 'إجراء واحد', 'n.procedures_two': 'إجراءان', 'n.procedures_few': '{n} إجراءات', 'n.procedures_many': '{n} إجراءً', 'n.procedures_other': '{n} إجراء',
    'n.categories_zero': 'لا فئات', 'n.categories_one': 'فئة واحدة', 'n.categories_two': 'فئتين', 'n.categories_few': '{n} فئات', 'n.categories_many': '{n} فئة', 'n.categories_other': '{n} فئة',
    'n.prices_zero': 'لا أسعار', 'n.prices_one': 'سعراً واحداً', 'n.prices_two': 'سعرين', 'n.prices_few': '{n} أسعار', 'n.prices_many': '{n} سعراً', 'n.prices_other': '{n} سعر',
    'n.openPlans_one': 'خطة مفتوحة واحدة', 'n.openPlans_two': 'خطتان مفتوحتان', 'n.openPlans_few': '{n} خطط مفتوحة', 'n.openPlans_many': '{n} خطة مفتوحة', 'n.openPlans_other': '{n} خطة مفتوحة',
    'n.teethSelected_one': 'سن واحد', 'n.teethSelected_two': 'سنّان', 'n.teethSelected_few': '{n} أسنان', 'n.teethSelected_many': '{n} سناً', 'n.teethSelected_other': '{n} سن',
    'n.uses_one': 'مرة واحدة', 'n.uses_two': 'مرتين', 'n.uses_few': '{n} مرات', 'n.uses_many': '{n} مرة', 'n.uses_other': '{n} مرة',
  },
  en: {
    quick: 'Quick treatment', noDoctor: 'No doctor', noPlan: 'No plan', openPatient: 'Open patient file', clearFilters: 'Clear filters', exportCsv: 'Export CSV',
    keep: 'Keep plan', toothN: 'tooth {n}', teethList: 'teeth: {list}',
    'col.procedure': 'Procedure', 'col.surfaces': 'Surfaces', 'col.billed': 'Billed',

    'act.start': 'Start', 'act.complete': 'Complete', 'act.backToPlanned': 'Back to planned', 'act.reopen': 'Reopen', 'act.cancel': 'Cancel item', 'act.restore': 'Restore',

    'stat.planned': 'Planned', 'stat.plannedValue': 'Planned value', 'stat.inProgress': 'In progress', 'stat.completed': 'Completed',
    'stat.doneMonth': 'Completed this month', 'stat.unbilled': 'Completed, not billed', 'stat.allBilled': 'Everything is billed',

    'tab.plans': 'Treatment plans', 'tab.noOpenPlans': 'No open plan at the moment',
    'tab.emptyTitle': 'No treatment plans yet', 'tab.emptyDesc': 'Create a plan with the proposed procedures and their prices, or record completed work directly.',
    'tab.noPlansTitle': 'No treatment plans', 'tab.noPlansDesc': 'Organise upcoming work in a plan the patient can review and approve.',
    'tab.loose': 'Treatments outside plans', 'tab.looseSub': 'Quick treatments and items from deleted plans',

    'plan.new': 'New treatment plan', 'plan.newTitle': 'New treatment plan', 'plan.newSub': 'A plan starts as a draft and is approved once the patient agrees.', 'plan.editTitle': 'Edit plan',
    'plan.titleLabel': 'Plan title', 'plan.defaultTitle': 'Treatment plan — {date}', 'plan.notesPh': 'Anything the team or the patient should know…', 'plan.create': 'Create plan',
    'plan.addItem': 'Add item', 'plan.approve': 'Approve plan', 'plan.print': 'Print estimate', 'plan.edit': 'Edit plan', 'plan.cancel': 'Cancel plan',
    'plan.reopen': 'Reopen plan', 'plan.delete': 'Delete plan',
    'plan.cancelTitle': 'Cancel this treatment plan?', 'plan.cancelDesc': 'Items that are not done yet will be cancelled; completed work stays on the patient’s record.',
    'plan.deleteDesc': 'The plan and all its items will be permanently deleted.',
    'plan.deleteKeep': 'The plan and its unfinished items will be deleted. Completed items ({n}) stay on the patient’s record under “Treatments outside plans”.',
    'plan.emptyTitle': 'This plan has no items yet', 'plan.emptyDesc': 'Add the proposed procedures with their teeth and prices.', 'plan.noItems': 'No items',
    'plan.progress': '{done} of {count} done', 'plan.value': 'Plan value', 'plan.afterDiscount': 'after a discount of', 'plan.doneValue': 'Completed',

    'item.addTitle': 'Add treatment', 'item.addSub': 'Pick the procedure, then the teeth — one item is created per tooth.', 'item.editTitle': 'Edit treatment', 'item.forTeeth': 'For tooth {list} — choose the procedure.',
    'item.quickTitle': 'Quick treatment', 'item.quickSub': 'Record completed work without a plan, such as a check-up or a cleaning.',
    'item.procedure': 'Procedure', 'item.change': 'Change', 'item.teeth': 'Teeth', 'item.pickTeeth': 'Choose teeth',
    'item.teethHint': 'Tap one or more teeth — the same procedure can be added to several teeth at once.',
    'item.surfaces': 'Surfaces', 'item.surfacesHint': 'Optional; applied to every selected tooth.',
    'item.details': 'Price and details', 'item.pricePerTooth': 'Price per tooth', 'item.discountPerTooth': 'Discount per tooth',
    'item.plannedDate': 'Planned date', 'item.doneDate': 'Date done', 'item.plan': 'Plan',
    'item.newPlanOption': '+ New treatment plan', 'item.noPlanOption': 'No plan', 'item.newPlanHint': 'A new plan dated today will be created.', 'item.noPlanHint': 'The item appears under “Treatments outside plans”.',
    'item.notesPh': 'A note for the doctor or the patient', 'item.add': 'Add item', 'item.saveQuick': 'Save as completed',
    'item.addN_one': 'Add 1 item', 'item.addN_other': 'Add {n} items',
    'item.billed': 'Billed', 'item.openInvoice': 'Open invoice',
    'item.billedLock': 'This item is on an invoice, so its procedure, tooth and price are locked. You can still change the doctor, date and notes.',
    'item.deleteDesc': 'The item “{name}” will be permanently deleted.',

    'picker.search': 'Search by name or code…', 'picker.noMatch': 'Try another word or category.', 'picker.noProcedures': 'Add procedures to the price list first.',
    'teeth.upper': 'Upper jaw', 'teeth.lower': 'Lower jaw', 'teeth.primary': 'Primary teeth', 'teeth.clear': 'Clear', 'teeth.right': 'Right', 'teeth.left': 'Left',

    'chart.title': 'Update the dental chart?', 'chart.sub': '“{name}” is done. Record what it left on the tooth so the chart stays current.', 'chart.condition': 'Condition to record',
    'chart.apply': 'Update chart', 'chart.skip': 'Not now', 'chart.needSurface': 'Pick at least one surface',

    'bill.button': 'Bill completed', 'bill.title': 'Bill completed treatments', 'bill.sub': 'Choose the items to include in the invoice.', 'bill.create': 'Create invoice',
    'bill.discounts': 'Discounts', 'bill.gross': 'Treatments value', 'bill.nothing': 'No completed treatments are waiting to be billed',

    'print.title': 'Print treatment plan', 'print.docTitle': 'Treatment plan & estimate', 'print.estimate': 'Estimated total',
    'print.disclaimer': 'This is a preliminary estimate, valid for 30 days. It may change if the treatment plan changes after examination or during treatment.',
    'print.patientSign': 'Patient signature', 'print.doctorSign': 'Doctor signature',

    'proc.title': 'Procedures & prices', 'proc.subtitle': '{n} in {cats} — {active} active', 'proc.subtitleEmpty': 'Your clinic’s price for every procedure',
    'proc.new': 'New procedure', 'proc.newTitle': 'New procedure', 'proc.editTitle': 'Edit procedure', 'proc.copyTitle': 'Duplicate procedure', 'proc.copySuffix': '(copy)',
    'proc.formSub': 'Shown with this name and price on treatment plans and invoices.', 'proc.name': 'Name', 'proc.namePh': 'e.g. Composite filling — 1 surface',
    'proc.nameEn': 'English name', 'proc.nameEnHint': 'Shown when the app is in English', 'proc.duration': 'Usual duration',
    'proc.color': 'Colour', 'proc.colorAuto': 'Category colour', 'proc.toothSpecific': 'Needs a tooth number', 'proc.toothSpecificHint': 'Such as fillings, crowns, root canals and extractions',
    'proc.activeLabel': 'Active', 'proc.activeHint': 'Inactive procedures are hidden when adding treatments', 'proc.perTooth': 'Per tooth',
    'proc.search': 'Search by name or code…', 'proc.showActive': 'Active', 'proc.showInactive': 'Inactive', 'proc.allCategories': 'All categories', 'proc.results': 'Search results',
    'proc.noMatch': 'No procedure matches the current search or filters.',
    'proc.emptyTitle': 'Your price list is empty', 'proc.emptyDesc': 'Load the default catalogue of common procedures with prices you can edit, or add your clinic’s own procedures.',
    'proc.loadDefaults': 'Load default catalogue', 'proc.addOwn': 'Add a procedure', 'proc.activate': 'Activate', 'proc.deactivate': 'Deactivate', 'proc.deactivateInstead': 'Deactivate instead',
    'proc.inUseTitle': 'This procedure can’t be deleted',
    'proc.inUseDesc': '“{name}” is used {uses} in treatments or invoices. Deactivate it instead: it disappears from the pickers and past records stay as they are.',
    'proc.deleteDesc': '“{name}” will be permanently removed from the price list.',

    'bulk.button': 'Adjust prices', 'bulk.title': 'Bulk price change', 'bulk.sub': 'Applies to: {scope}', 'bulk.allCategories': 'all categories',
    'bulk.direction': 'Change', 'bulk.increase': 'Increase', 'bulk.decrease': 'Decrease', 'bulk.mode': 'Method', 'bulk.percent': 'Percentage', 'bulk.fixed': 'Fixed amount',
    'bulk.value': 'Value', 'bulk.round': 'Rounding', 'bulk.roundNone': 'No rounding', 'bulk.roundTo': 'Nearest {n}',
    'bulk.preview': 'Preview of the new prices', 'bulk.andMore': 'and {n} more', 'bulk.apply': 'Apply change', 'bulk.affects': '{prices} will change', 'bulk.changedN': 'Prices changed: {n}',
    'bulk.empty': 'There are no procedures in this category.', 'bulk.tooMuch': 'A decrease must be less than 100%',

    'reg.title': 'Treatments register', 'reg.subtitle': 'Every planned and completed treatment in the clinic', 'reg.search': 'Search by patient, procedure or tooth…',
    'reg.group': 'Group by patient', 'reg.allDoctors': 'All doctors', 'reg.noMatch': 'No treatments match the current filters.',
    'reg.emptyTitle': 'No treatments yet', 'reg.emptyDesc': 'Treatments are added from the patient file: open a patient and create a treatment plan or record a quick treatment.', 'reg.goPatients': 'Go to patients',
    'range.all': 'All time', 'range.today': 'Today', 'range.week': 'This week', 'range.month': 'This month', 'range.custom': 'Custom',

    'v.procedure': 'Choose a procedure from the list', 'v.teeth': 'This procedure needs at least one tooth', 'v.price': 'Enter the price', 'v.priceNegative': 'The price can’t be negative',
    'v.discountNegative': 'The discount can’t be negative', 'v.discountTooBig': 'The discount is larger than the price', 'v.codeTaken': 'This code is used by another procedure', 'v.duration': 'Enter 0 to 600 minutes',

    'toast.planCreated': 'Plan created', 'toast.planUpdated': 'Plan saved', 'toast.planApproved': 'Plan approved', 'toast.planCancelled': 'Plan cancelled',
    'toast.planReopened': 'Plan reopened', 'toast.planDeleted': 'Plan deleted', 'toast.planDone': 'Treatment plan completed',
    'toast.itemsAdded_one': 'Item added', 'toast.itemsAdded_other': '{n} items added',
    'toast.itemUpdated': 'Changes saved', 'toast.itemDeleted': 'Item deleted', 'toast.quickDone': 'Completed treatment recorded', 'toast.completed': 'Treatment completed',
    'toast.status.planned': 'Back to planned', 'toast.status.in_progress': 'Treatment started', 'toast.status.cancelled': 'Item cancelled',
    'toast.chartUpdated': 'Dental chart updated', 'toast.invoiced': 'Invoice {number} created',
    'toast.procCreated': 'Procedure added', 'toast.procUpdated': 'Procedure saved', 'toast.procDeleted': 'Procedure deleted', 'toast.procActivated': 'Procedure activated', 'toast.procDeactivated': 'Procedure deactivated',
    'toast.defaultsLoaded': 'Default catalogue loaded', 'toast.defaultsNone': 'The default catalogue is already loaded', 'toast.bulkDone': 'Prices updated', 'toast.exported': 'File exported',

    'log.planCreated': 'New treatment plan: {title}', 'log.planUpdated': 'Treatment plan edited: {title}', 'log.planApproved': 'Treatment plan approved: {title}',
    'log.planCancelled': 'Treatment plan cancelled: {title}', 'log.planDeleted': 'Treatment plan deleted: {title}',
    'log.itemsAdded': 'Added to treatment plan: {name}', 'log.quickDone': 'Treatment done: {name}', 'log.itemUpdated': 'Treatment edited: {name}', 'log.itemDeleted': 'Treatment deleted: {name}',
    'log.status.planned': 'Back to planned: {name}', 'log.status.in_progress': 'Treatment started: {name}', 'log.status.completed': 'Treatment completed: {name}', 'log.status.cancelled': 'Treatment cancelled: {name}',
    'log.chart': 'Dental chart updated: {teeth} → {cond}', 'log.invoice': 'Invoice {number} for completed treatments — {name}',
    'log.procCreated': 'New procedure in the price list: {name}', 'log.procUpdated': 'Procedure edited in the price list: {name}', 'log.procDeleted': 'Procedure removed from the price list: {name}',
    'log.defaults': 'Default procedure catalogue loaded', 'log.bulk': 'Bulk price change — {scope} ({change})',

    'n.items_one': '1 item', 'n.items_other': '{n} items',
    'n.procedures_one': '1 procedure', 'n.procedures_other': '{n} procedures',
    'n.categories_one': '1 category', 'n.categories_other': '{n} categories',
    'n.prices_one': '1 price', 'n.prices_other': '{n} prices',
    'n.openPlans_one': '1 open plan', 'n.openPlans_other': '{n} open plans',
    'n.teethSelected_one': '1 tooth', 'n.teethSelected_other': '{n} teeth',
    'n.uses_one': 'once', 'n.uses_other': '{n} times',
  },
}
export default treatments

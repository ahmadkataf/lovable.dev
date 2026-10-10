import type { ModuleDict } from '../types'

// Strings of the "appointments" module. Keys are used as t('appointments.<key>'). Keep ar and en in step.
// Shared words (statuses apt.*, types aptType.*, save, cancel, today…) come from common.ts.
const appointments: ModuleDict = {
  ar: {
    title: 'المواعيد',
    'sub.day': '{count} في هذا اليوم', 'sub.week': '{count} في هذا الأسبوع', 'sub.month': '{count} في هذا الشهر', 'sub.list': '{count} خلال 14 يوماً',
    'count.zero': 'لا مواعيد', 'count.one': 'موعد واحد', 'count.two': 'موعدان', 'count.few': '{n} مواعيد', 'count.many': '{n} موعداً',
    'dur.15': '15 دقيقة', 'dur.20': '20 دقيقة', 'dur.30': '30 دقيقة', 'dur.45': '45 دقيقة', 'dur.60': 'ساعة', 'dur.90': 'ساعة ونصف', 'dur.120': 'ساعتان', 'dur.n': '{n} دقيقة',

    // calendar
    'view.day': 'يوم', 'view.week': 'أسبوع', 'view.month': 'شهر', 'view.list': 'قائمة',
    goToDate: 'انتقل إلى تاريخ', allDoctors: 'كل الأطباء',
    'statusFilter.title': 'عرض حسب الحالة', 'statusFilter.all': 'كل الحالات', 'statusFilter.active': 'الفعّالة فقط',
    clearFilters: 'مسح التصفية',
    closed: 'مغلق', closedDay: 'العيادة مغلقة في هذا اليوم حسب أيام الدوام، ويمكنك الحجز فيه استثنائياً.',
    addAt: 'إضافة موعد: {time}', moreN: '+{n} أخرى', tapToBook: 'اضغط على وقت لحجز موعد', busy: 'محجوز',
    'empty.day.title': 'لا مواعيد في هذا اليوم',
    'empty.day.desc': 'اليوم متاح بالكامل — اضغط على أي وقت في الجدول لحجز موعد.',
    'empty.day.descMobile': 'اختر وقتاً من الشريط أعلاه أو أضف موعداً جديداً.',
    'empty.list.title': 'لا مواعيد قادمة',
    'empty.list.desc': 'لا توجد مواعيد محجوزة خلال الأيام الأربعة عشر القادمة.',
    'empty.filtered.title': 'لا مواعيد تطابق التصفية',
    'empty.filtered.desc': 'جرّب اختيار طبيب آخر أو حالة أخرى، أو امسح التصفية.',
    'noDoctors.title': 'لا يوجد أطباء بعد', 'noDoctors.desc': 'أضف طبيباً من صفحة الفريق ليظهر في جدول المواعيد.', 'noDoctors.action': 'إدارة الفريق',
    deletedPatient: 'مريض محذوف', formerDoctor: 'طبيب سابق',

    // details
    'details.title': 'تفاصيل الموعد', 'details.missing': 'لم يعد هذا الموعد موجوداً.',
    'details.bookedBy': 'حجزه {name} · {ago}', 'details.updated': 'آخر تحديث {ago}', 'details.updateStatus': 'تحديث الحالة',
    reason: 'سبب الزيارة', noPhone: 'لا يوجد رقم هاتف للمريض',
    'action.scheduled': 'إعادة فتح الموعد', 'action.confirmed': 'تأكيد الموعد', 'action.arrived': 'وصل المريض', 'action.in_progress': 'بدء المعالجة',
    'action.completed': 'إنهاء الزيارة', 'action.cancelled': 'إلغاء الموعد', 'action.no_show': 'لم يحضر',
    statusToast: 'أصبحت حالة الموعد: {status}',
    deleteConfirm: 'سيُحذف هذا الموعد نهائياً من الجدول، ولا يمكن التراجع عن ذلك.', deletedToast: 'تم حذف الموعد',
    reminder: 'تذكير عبر واتساب', reminderHint: 'أرسل للمريض رسالة تذكير جاهزة بموعد الساعة {time}',
    reminderMsg: 'مرحباً {name}،\nنذكّركم بموعدكم في {clinic} يوم {date} الساعة {time}.\nنرجو الحضور قبل الموعد بعشر دقائق، وإن رغبتم في تعديل الموعد أو إلغائه يُرجى التواصل معنا.\nمع تمنياتنا لكم بدوام الصحة.',

    // form
    'form.newTitle': 'موعد جديد', 'form.editTitle': 'تعديل الموعد', 'form.subtitle': 'اختر المريض والطبيب والوقت المناسب',
    'form.searchPatient': 'ابحث بالاسم أو رقم الملف أو الهاتف…', 'form.results': 'نتائج البحث', 'form.recent': 'آخر المرضى',
    'form.noPatientsYet': 'لم يُسجَّل أي مريض بعد', 'form.noPatientFound': 'لا يوجد مريض مطابق',
    'form.addAsNew': 'إضافة «{q}» كمريض جديد', 'form.newPatient': 'إضافة مريض جديد', 'form.change': 'تغيير',
    'form.quickTitle': 'مريض جديد', 'form.quickHint': 'الاسم والهاتف يكفيان الآن، وتُستكمل بقية البيانات لاحقاً من ملف المريض.',
    'form.createPatient': 'إضافة واختيار', 'form.patientCreated': 'تمت إضافة المريض',
    'form.time': 'وقت البدء', 'form.timeHint': 'اختر من الأوقات المتاحة أو اكتب وقتاً مخصصاً', 'form.customTime': 'وقت مخصص', 'form.badTime': 'أدخل وقتاً صالحاً',
    'form.endsAt': 'ينتهي الساعة {time}',
    'form.conflictTitle': 'تعارض في الجدول', 'form.conflictDesc': 'لدى {doctor} موعد آخر في هذا الوقت. يمكنك الحفظ رغم ذلك أو اختيار وقت آخر:',
    'form.useSlot': 'أقرب وقت متاح: {time}',
    'form.hoursTitle': 'خارج أوقات الدوام', 'form.closedDay': 'العيادة لا تعمل عادةً يوم {day}.', 'form.outsideHours': 'الوقت خارج ساعات الدوام ({from} – {to}).',
    'form.reasonPh': 'مثال: ألم في الضرس، تنظيف دوري…', 'form.notesPh': 'ملاحظات للطبيب أو لموظف الاستقبال',
    'form.noDoctors': 'لا يوجد أطباء', 'form.book': 'حجز الموعد', 'form.createdToast': 'تم حجز الموعد', 'form.savedToast': 'تم حفظ التعديلات',

    // patient tab
    'tab.upcoming': 'المواعيد القادمة', 'tab.past': 'السجل السابق', 'tab.next': 'الموعد القادم',
    'tab.visits': 'زيارات مكتملة', 'tab.upcomingCount': 'قادمة', 'tab.noShows': 'غياب', 'tab.cancelled': 'ملغاة',
    'tab.noUpcoming': 'لا مواعيد قادمة لهذا المريض.', 'tab.noPast': 'لا زيارات سابقة.', 'tab.showMore': 'عرض المزيد ({n})',
    'tab.empty.title': 'لا مواعيد لهذا المريض بعد', 'tab.empty.desc': 'احجز أول موعد للمريض، وستظهر هنا مواعيده القادمة وزياراته السابقة.',

    // activity feed
    'act.created': 'حجز موعد للمريض {name} — {when}', 'act.updated': 'تعديل موعد {name} — {when}', 'act.deleted': 'حذف موعد {name} — {when}',
    'act.status': 'موعد {name} ({when}): {status}', 'act.reminded': 'إرسال تذكير بالموعد إلى {name} — {when}',
  },
  en: {
    title: 'Appointments',
    'sub.day': '{count} on this day', 'sub.week': '{count} this week', 'sub.month': '{count} this month', 'sub.list': '{count} over 14 days',
    'count.zero': 'No appointments', 'count.one': '1 appointment', 'count.two': '2 appointments', 'count.few': '{n} appointments', 'count.many': '{n} appointments',
    'dur.15': '15 min', 'dur.20': '20 min', 'dur.30': '30 min', 'dur.45': '45 min', 'dur.60': '1 hour', 'dur.90': '1 h 30 min', 'dur.120': '2 hours', 'dur.n': '{n} min',

    'view.day': 'Day', 'view.week': 'Week', 'view.month': 'Month', 'view.list': 'Agenda',
    goToDate: 'Go to date', allDoctors: 'All doctors',
    'statusFilter.title': 'Show by status', 'statusFilter.all': 'All statuses', 'statusFilter.active': 'Active only',
    clearFilters: 'Clear filters',
    closed: 'Closed', closedDay: 'The clinic is normally closed on this day; you can still book an exception.',
    addAt: 'Add an appointment: {time}', moreN: '+{n} more', tapToBook: 'Tap a time to book', busy: 'booked',
    'empty.day.title': 'No appointments on this day',
    'empty.day.desc': 'The day is wide open — click any time on the grid to book.',
    'empty.day.descMobile': 'Pick a time above or add a new appointment.',
    'empty.list.title': 'No upcoming appointments',
    'empty.list.desc': 'Nothing is booked for the next 14 days.',
    'empty.filtered.title': 'No appointments match the filters',
    'empty.filtered.desc': 'Try another doctor or status, or clear the filters.',
    'noDoctors.title': 'No doctors yet', 'noDoctors.desc': 'Add a doctor in Staff to start booking appointments.', 'noDoctors.action': 'Manage staff',
    deletedPatient: 'Deleted patient', formerDoctor: 'Former doctor',

    'details.title': 'Appointment details', 'details.missing': 'This appointment no longer exists.',
    'details.bookedBy': 'Booked by {name} · {ago}', 'details.updated': 'Last updated {ago}', 'details.updateStatus': 'Update status',
    reason: 'Reason for visit', noPhone: 'No phone number on file',
    'action.scheduled': 'Reopen', 'action.confirmed': 'Confirm', 'action.arrived': 'Mark arrived', 'action.in_progress': 'Start treatment',
    'action.completed': 'Complete visit', 'action.cancelled': 'Cancel appointment', 'action.no_show': 'No-show',
    statusToast: 'Status changed to {status}',
    deleteConfirm: 'This appointment will be permanently removed from the schedule. This cannot be undone.', deletedToast: 'Appointment deleted',
    reminder: 'WhatsApp reminder', reminderHint: 'Send the patient a ready-made reminder for {time}',
    reminderMsg: 'Hello {name},\nThis is a reminder of your appointment at {clinic} on {date} at {time}.\nPlease arrive 10 minutes early. If you need to reschedule or cancel, just let us know.\nWishing you good health.',

    'form.newTitle': 'New appointment', 'form.editTitle': 'Edit appointment', 'form.subtitle': 'Choose the patient, the doctor and a time',
    'form.searchPatient': 'Search by name, file # or phone…', 'form.results': 'Matching patients', 'form.recent': 'Recent patients',
    'form.noPatientsYet': 'No patients yet', 'form.noPatientFound': 'No matching patient',
    'form.addAsNew': 'Add “{q}” as a new patient', 'form.newPatient': 'Add a new patient', 'form.change': 'Change',
    'form.quickTitle': 'New patient', 'form.quickHint': 'Name and phone are enough for now; complete the file later.',
    'form.createPatient': 'Add and select', 'form.patientCreated': 'Patient added',
    'form.time': 'Start time', 'form.timeHint': 'Pick a free slot or type any time', 'form.customTime': 'Custom time', 'form.badTime': 'Enter a valid time',
    'form.endsAt': 'Ends at {time}',
    'form.conflictTitle': 'Scheduling conflict', 'form.conflictDesc': '{doctor} already has an appointment at this time. You can still save, or pick another time:',
    'form.useSlot': 'Next free: {time}',
    'form.hoursTitle': 'Outside working hours', 'form.closedDay': 'The clinic is usually closed on {day}.', 'form.outsideHours': 'This time is outside working hours ({from} – {to}).',
    'form.reasonPh': 'e.g. toothache, routine cleaning…', 'form.notesPh': 'Notes for the doctor or the front desk',
    'form.noDoctors': 'No doctors', 'form.book': 'Book appointment', 'form.createdToast': 'Appointment booked', 'form.savedToast': 'Changes saved',

    'tab.upcoming': 'Upcoming', 'tab.past': 'History', 'tab.next': 'Next',
    'tab.visits': 'completed visits', 'tab.upcomingCount': 'upcoming', 'tab.noShows': 'no-shows', 'tab.cancelled': 'cancelled',
    'tab.noUpcoming': 'No upcoming appointments.', 'tab.noPast': 'No past visits.', 'tab.showMore': 'Show more ({n})',
    'tab.empty.title': 'No appointments yet', 'tab.empty.desc': 'Book the first appointment; upcoming and past visits will show here.',

    'act.created': 'Booked {name} — {when}', 'act.updated': 'Updated the appointment of {name} — {when}', 'act.deleted': 'Deleted the appointment of {name} — {when}',
    'act.status': '{name} ({when}): {status}', 'act.reminded': 'Sent an appointment reminder to {name} — {when}',
  },
}
export default appointments

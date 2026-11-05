/* Arabic formatting helpers: Arabic-Indic digits, Levantine month names,
   number agreement («٣ طلاب» / «١٢ طالباً»), period ordinals. */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Convert every Western digit in a string to Arabic-Indic (keeps everything else). */
export function arDigits(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}

/** Format a number with Arabic-Indic digits, Arabic decimal separator «٫» and thousands «٬». */
export function ar(n: number | null | undefined, decimals?: number): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const fixed = decimals === undefined ? String(n) : n.toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const sign = int.startsWith('-') ? '−' : '';
  const digits = int.replace('-', '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return sign + arDigits(grouped) + (frac !== undefined ? '٫' + arDigits(frac) : '');
}

/** «٩٤٪» (rounded unless decimals given). */
export function pct(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return ar(Number(n.toFixed(decimals)), decimals > 0 && !Number.isInteger(n) ? decimals : 0) + '٪';
}

export const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const MONTHS = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
];
const ORDINAL_F = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة'];
const GRADES = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'];

export const TZ = 'Asia/Damascus';

/** Today's date (YYYY-MM-DD) in Damascus local time. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Current hour (0–23) in Damascus. */
export function damascusHour(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now);
  return Number(h) % 24;
}

/** School weekday index of a YYYY-MM-DD date: 0 = الأحد … 4 = الخميس, 5/6 = weekend. */
export function dayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Parse a server timestamp: SQLite «YYYY-MM-DD HH:MM:SS» (UTC), ISO, or a bare date. */
export function parseServerTime(s: string | null | undefined): Date | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00Z');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) return new Date(s.replace(' ', 'T') + 'Z');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «الخميس ٥ تشرين الثاني» (weekday optional). */
export function fmtDate(iso: string | null | undefined, opts: { weekday?: boolean; year?: boolean } = { weekday: true }): string {
  if (!iso) return '';
  const date = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return iso;
  const [y, m, d] = date.split('-').map(Number);
  const parts: string[] = [];
  if (opts.weekday !== false) parts.push(DAYS[dayIndex(date)]);
  parts.push(`${ar(d)} ${MONTHS[m - 1]}`);
  if (opts.year) parts.push(ar(y));
  return parts.join(' ');
}

/** «٧:٣٥ صباحاً» in Damascus time. */
export function fmtTime(d: Date | string | null | undefined): string {
  const date = typeof d === 'string' ? parseServerTime(d) : d;
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const min = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ar(h12)}:${arDigits(min)} ${h < 12 ? 'صباحاً' : 'مساءً'}`;
}

/** Time of day from «HH:MM» or a timestamp. */
export function fmtClock(s: string | null | undefined): string {
  if (!s) return '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) {
    const h = Number(m[1]);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${ar(h12)}:${arDigits(m[2])} ${h < 12 ? 'صباحاً' : 'مساءً'}`;
  }
  return fmtTime(s);
}

/** «اليوم ٨:٠٥ صباحاً» / «أمس …» / «الخميس ٥ تشرين الثاني». */
export function fmtWhen(s: string | null | undefined): string {
  const d = parseServerTime(s);
  if (!d) return '';
  const day = todayISO(d);
  const today = todayISO();
  if (day === today) return `اليوم ${fmtTime(d)}`;
  if (day === addDays(today, -1)) return `أمس ${fmtTime(d)}`;
  return fmtDate(day);
}

/** Days until a YYYY-MM-DD date, relative to today in Damascus. */
export function daysUntil(iso: string): number {
  const today = todayISO();
  const [y1, m1, d1] = today.split('-').map(Number);
  const [y2, m2, d2] = iso.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** «اليوم» / «غداً» / «بعد ٣ أيام» / «متأخّر يومين». */
export function dueLabel(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return 'اليوم';
  if (n === 1) return 'غداً';
  if (n === 2) return 'بعد يومين';
  if (n > 2 && n <= 10) return `بعد ${ar(n)} أيام`;
  if (n > 10) return `بعد ${ar(n)} يوماً`;
  if (n === -1) return 'فات الموعد أمس';
  return 'فات الموعد';
}

export interface NounForms { one: string; two: string; few: string; many: string; f?: boolean }
export const NOUNS = {
  student: { one: 'طالب', two: 'طالبان', few: 'طلاب', many: 'طالباً' },
  teacher: { one: 'معلّم', two: 'معلّمان', few: 'معلّمين', many: 'معلّماً' },
  guardian: { one: 'وليّ أمر', two: 'وليّا أمر', few: 'أولياء أمور', many: 'وليّ أمر' },
  period: { one: 'حصّة', two: 'حصّتان', few: 'حصص', many: 'حصّة', f: true },
  homework: { one: 'واجب', two: 'واجبان', few: 'واجبات', many: 'واجباً' },
  school: { one: 'مدرسة', two: 'مدرستان', few: 'مدارس', many: 'مدرسة', f: true },
  operation: { one: 'عملية', two: 'عمليتان', few: 'عمليات', many: 'عملية', f: true },
  day: { one: 'يوم', two: 'يومان', few: 'أيام', many: 'يوماً' },
  point: { one: 'نقطة', two: 'نقطتان', few: 'نقاط', many: 'نقطة', f: true },
  notification: { one: 'إشعار', two: 'إشعاران', few: 'إشعارات', many: 'إشعاراً' },
  message: { one: 'رسالة', two: 'رسالتان', few: 'رسائل', many: 'رسالة', f: true },
  alert: { one: 'تنبيه', two: 'تنبيهان', few: 'تنبيهات', many: 'تنبيهاً' },
} satisfies Record<string, NounForms>;

/** Count with Arabic agreement: «لا طلاب» / «طالب واحد» / «طالبان» / «٣ طلاب» / «١٢ طالباً» / «١٠٠ طالب».
    Feminine nouns (`f: true`) take «واحدة»: «حصّة واحدة»، «مدرسة واحدة»، «عملية واحدة»، «رسالة واحدة». */
export function count(n: number, forms: NounForms, zero?: string): string {
  if (n === 0) return zero ?? `لا ${forms.few}`;
  if (n === 1) return `${forms.one} ${forms.f ? 'واحدة' : 'واحد'}`;
  if (n === 2) return forms.two;
  const m = n % 100;
  if (m >= 3 && m <= 10) return `${ar(n)} ${forms.few}`;
  if (m >= 11) return `${ar(n)} ${forms.many}`;
  return `${ar(n)} ${forms.one}`;
}

/** «إشعار واحد غير مقروء» / «إشعاران غير مقروءان» / «٣ إشعارات غير مقروءة» / «١٢ إشعاراً غير مقروء». */
export function unreadLabel(n: number): string {
  if (n === 0) return 'لا إشعارات جديدة';
  if (n === 1) return 'إشعار واحد غير مقروء';
  if (n === 2) return 'إشعاران غير مقروءان';
  const m = n % 100;
  if (m >= 3 && m <= 10) return `${ar(n)} إشعارات غير مقروءة`;
  return `${ar(n)} إشعاراً غير مقروء`;
}

/** Attach the preposition «ل» to a word: «لمحمد»، «للحسن». */
export function li(word: string): string {
  const w = (word ?? '').trim();
  if (!w) return '';
  return w.startsWith('ال') ? `لل${w.slice(2)}` : `ل${w}`;
}

const NUMBER_WORDS = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستّة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
/** Consecutive days: «يوم واحد» / «يومان متتاليان» / «ثلاثة أيام متتالية» (spelled out up to ten) / «١٢ يوماً متتالياً». */
export function consecutiveDays(n: number): string {
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومان متتاليان';
  if (n >= 3 && n <= 10) return `${NUMBER_WORDS[n]} أيام متتالية`;
  return `${ar(n)} يوماً متتالياً`;
}

/** «مجمّع إزرع» — the seed sometimes already carries the word «مجمّع». */
export function complexLabel(complex: string | null | undefined): string {
  const c = (complex ?? '').trim();
  if (!c) return '';
  return c.startsWith('مجمّع') || c.startsWith('مجمع') ? c : `مجمّع ${c}`;
}

/** Homework title with its book page unless the title already names it. */
export function withPage(title: string, page: string | null | undefined): string {
  if (!page) return title;
  const p = arDigits(page);
  if (title.includes(`ص ${p}`) || title.includes(`ص ${page}`) || title.includes(`صفحة ${p}`)) return title;
  return `${title} (ص ${p})`;
}

/** «الحصّة الثالثة». */
export function periodName(p: number): string {
  return `الحصّة ${ORDINAL_F[p - 1] ?? ar(p)}`;
}
export function periodOrdinal(p: number): string {
  return ORDINAL_F[p - 1] ?? ar(p);
}
/** «الصف الخامس». */
export function gradeName(g: number): string {
  return `الصف ${GRADES[g] ?? ar(g)}`;
}
export function gradeShort(g: number): string {
  return GRADES[g] ?? ar(g);
}

const SHORT_SUBJECT: Record<string, string> = {
  'اللغة العربية': 'عربي',
  'الرياضيات': 'رياضيات',
  'العلوم': 'علوم',
  'اللغة الإنكليزية': 'إنكليزي',
  'الدراسات الاجتماعية': 'دراسات',
  'التربية الرياضية': 'رياضة',
  'التربية الدينية': 'ديانة',
  'التربية الفنية': 'فنّية',
  'التربية الموسيقية': 'موسيقا',
};
/** Short subject name for compact timetable cells. */
export function shortSubject(name: string | null | undefined): string {
  if (!name) return '';
  return SHORT_SUBJECT[name] ?? name.replace(/^اللغة /, '').replace(/^التربية /, '');
}

/** Compound first names («عبد الرحمن», «عبد الله», «أبو بكر», «أم كلثوم») are kept whole; a leading «أ.» is dropped. */
const COMPOUND_FIRST = new Set(['عبد', 'أبو', 'ابو', 'أم', 'ام']);
export function firstName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().replace(/^أ\.\s*/, '').split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return COMPOUND_FIRST.has(parts[0]) && parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0];
}

/** «أ. سامر حسن» */
export function teacherTitle(name: string | null | undefined): string {
  if (!name) return '';
  return name.startsWith('أ. ') ? name : `أ. ${name}`;
}

export const ATTENDANCE_LABEL: Record<string, string> = {
  present: 'حاضر', absent: 'غائب', late: 'متأخّر', none: 'لم يُسجَّل بعد',
};
export const SUBSTITUTION_LABEL: Record<string, string> = {
  suggested: 'بانتظار الاعتماد', approved: 'مغطّاة', self_study: 'تعلّم ذاتي', uncovered: 'غير مغطّاة',
};
export const NOTIFICATION_KIND_LABEL: Record<string, string> = {
  homework: 'واجب', absence: 'غياب', absence_teacher: 'غياب معلّم', substitution: 'حصّة بديلة', change: 'تغيير',
  announcement: 'إعلان', circular: 'تعميم', message: 'رسالة', attendance: 'حضور', alert: 'تنبيه', system: 'النظام',
  no_attendance: 'حضور غير مسجّل', three_days: 'غياب متتالٍ', uncovered: 'حصّة من دون تغطية',
};

/** Greeting by Damascus time. */
export function greeting(): string {
  const h = damascusHour();
  return h < 12 ? 'صباح الخير' : 'مساء الخير';
}

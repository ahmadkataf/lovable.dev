/* Shared bits of the directorate screens (round 2): the phone action, the upload badge, the period-status
   labels, the «narrow screen» hook and the route helpers. */

import { useSyncExternalStore, type MouseEvent } from 'react';
import { Tag } from '../components/Ui';
import { dayIndex, fmtHM, fmtPhone, telHref } from '../format';
import type { DirectoratePeriod, DirectoratePeriodStatus, DirectorateSchool } from '../types';
import './directorate.css';

/** Phone handset, in the stroke style of components/Icon.tsx (which has no phone glyph). */
export function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

/** «اتصال بالمدير» as a `tel:` link: a round icon button, or a labelled button with the number. The click never
    reaches the row or card that holds it. */
export function TelButton({ phone, school, label }: { phone: string | null | undefined; school?: string; label?: boolean }) {
  if (!phone) return null;
  const title = 'اتصال بالمدير';
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <a className={`dir-tel ${label ? 'lbl' : ''}`} href={telHref(phone)} onClick={stop} title={school ? `${title} · ${school}` : title} aria-label={`${title}${school ? ` · ${school}` : ''} · ${fmtPhone(phone)}`}>
      <PhoneIcon />
      {label && <span>{title}</span>}
      {label && <bdi className="num" dir="ltr">{fmtPhone(phone)}</bdi>}
    </a>
  );
}

/** Friday and Saturday: no school, so «لم يُرفع الحضور» would be misleading. */
export function isHoliday(date: string): boolean {
  return dayIndex(date) >= 5;
}

/** «رُفع ٧:٣٥» / «لم يُرفع الحضور» / «يوم عطلة». */
export function UploadBadge({ uploaded, at, holiday }: { uploaded: boolean; at?: string | null; holiday?: boolean }) {
  if (holiday && !uploaded) return <Tag tone="gray">يوم عطلة</Tag>;
  if (!uploaded) return <Tag tone="red">لم يُرفع الحضور</Tag>;
  return <Tag tone="mint">{at ? `رُفع ${fmtHM(at)}` : 'رُفع الحضور'}</Tag>;
}

export const PERIOD_STATUS: Record<DirectoratePeriodStatus, { label: string; tone: 'mint' | 'violet' | 'sun' | 'red'; row: string }> = {
  approved: { label: 'مغطّاة', tone: 'mint', row: 'ok' },
  self_study: { label: 'تعلّم ذاتي', tone: 'violet', row: 'ok' },
  pending: { label: 'بانتظار الاعتماد', tone: 'sun', row: 'hl' },
  uncovered: { label: 'غير مغطّاة', tone: 'red', row: 'bad' },
};

/** The sentence under a period: who covers it, or why nobody does yet. */
export function periodStatusText(p: DirectoratePeriod): string {
  const sub = p.substitute ? (p.substitute.startsWith('أ. ') ? p.substitute : `أ. ${p.substitute}`) : '';
  switch (p.status) {
    case 'approved': return sub ? `يغطّيها ${sub}${p.lesson_note ? ` · خطّة الدرس: ${p.lesson_note}` : ''}` : 'مغطّاة';
    case 'self_study': return `تعلّم ذاتي موجَّه${p.lesson_note ? `: ${p.lesson_note}` : ''}`;
    case 'pending': return `بانتظار اعتماد الإدارة${sub ? ` · المقترح: ${sub}` : ''}`;
    default: return 'من دون تغطية — لا بديل متاح بعد';
  }
}

export function schoolPath(id: number | string, date: string): string {
  return `/directorate/school/${id}?date=${date}`;
}
export function dashboardPath(date: string, today: string): string {
  return date === today ? '/directorate' : `/directorate?date=${date}`;
}

/** How urgently a school needs the directorate's attention today (worst first when sorting). */
export function severity(s: DirectorateSchool, holiday: boolean): number {
  let v = 0;
  if (!holiday && !s.attendance_uploaded) v += 1000;
  v += (s.uncovered_periods ?? 0) * 60 + (s.three_days ?? 0) * 40;
  if (s.attendance_uploaded && s.present_pct !== null && s.present_pct !== undefined) v += Math.max(0, 100 - s.present_pct) * 2;
  return v;
}
export function severityClass(s: DirectorateSchool, holiday: boolean): string {
  if (!holiday && !s.attendance_uploaded) return 'sev-high';
  if ((s.three_days ?? 0) > 0 || (s.uncovered_periods ?? 0) > 0) return 'sev-mid';
  return '';
}

/* ── narrow screens (≤ 720px): cards instead of the table ── */
const NARROW = '(max-width: 720px)';
const mq = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(NARROW) : null;
function subscribe(fn: () => void) {
  if (!mq) return () => {};
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
}
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => !!mq && mq.matches, () => false);
}

/* Small UI primitives shared by every screen. */

import { useEffect, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './Icon';
import { addDays, arDigits, fmtDate, isWeekend, pct, todayISO } from '../format';
import { Link } from '../router';
import type { AppConfig } from '../config';

export function Tile({ title, icon, children, color, className, right, style }: {
  title?: ReactNode; icon?: string; children?: ReactNode; color?: string; className?: string; right?: ReactNode; style?: CSSProperties;
}) {
  const st = { ...(color ? ({ '--c': color } as CSSProperties) : {}), ...style };
  return (
    <section className={`tile ${className ?? ''}`} style={st}>
      {title && (
        <h3>
          {icon && <Icon name={icon} />}
          <span className="grow">{title}</span>
          {right}
        </h3>
      )}
      {children}
    </section>
  );
}

export function Kpi({ value, label, tone }: { value: ReactNode; label: ReactNode; tone?: 'warn' | 'good' | 'bad' | 'muted' }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <b className="num">{value}</b>
      <span>{label}</span>
    </div>
  );
}

export function Tag({ children, tone, className }: { children: ReactNode; tone?: 'sun' | 'mint' | 'rose' | 'violet' | 'gray' | 'red' | 'teal'; className?: string }) {
  return <span className={`tag ${tone ?? ''} ${className ?? ''}`}>{children}</span>;
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'light' | 'ghost' | 'danger';
  size?: 'sm';
  icon?: string;
  loading?: boolean;
  block?: boolean;
  color?: string;
}
export function Btn({ variant = 'primary', size, icon, loading, block, color, children, className, disabled, style, ...rest }: BtnProps) {
  const st = { ...(color ? ({ '--c': color } as CSSProperties) : {}), ...style };
  return (
    <button
      className={`abtn ${variant === 'primary' ? '' : variant} ${size ?? ''} ${block ? 'block' : ''} ${className ?? ''}`}
      disabled={disabled || loading}
      style={st}
      {...rest}
    >
      {loading ? <span className="spin" aria-hidden="true" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function Field({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={`field ${className ?? ''}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="sw" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function Empty({ icon = 'inbox', title, text }: { icon?: string; title: ReactNode; text?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <b>{title}</b>
      {text && <p>{text}</p>}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skel" aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: lines }, (_, i) => <i key={i} />)}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="error" role="alert">
      {error}
      {retry && (
        <>
          {' '}
          <button type="button" onClick={retry} style={{ textDecoration: 'underline', fontWeight: 800 }}>إعادة المحاولة</button>
        </>
      )}
    </div>
  );
}

export function Progress({ value, max = 100 }: { value: number; max?: number }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <i style={{ width: `${w}%` }} />
    </div>
  );
}

/** Horizontal bar chart row («الخامس ▬▬▬ ٩٤٪»); the percentage uses the same form as the Kpi tiles (`pct`, `.num`). */
export function ChartRow({ label, value, low }: { label: ReactNode; value: number; low?: boolean }) {
  return (
    <div className={`crow ${low ?? value < 90 ? 'low' : ''}`}>
      <span>{label}</span>
      <div className="track"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
      <b className="num">{pct(value)}</b>
    </div>
  );
}

export interface QuickDate { label: string; iso: string }

/** A date picker that reads in Arabic: the Levantine date is the prominent part, the native input (Western digits on
    most phones) is secondary, and quick chips («اليوم» / «غداً», or «أمس» when the future is out of range) sit next
    to it. `compact` is the header variant used next to dashboard titles. */
export function DateField({ value, onChange, min, max, label = 'التاريخ', quick, required, compact }: {
  value: string; onChange: (iso: string) => void; min?: string; max?: string; label?: string; quick?: QuickDate[] | false; required?: boolean; compact?: boolean;
}) {
  const today = todayISO();
  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max);
  let chips: QuickDate[];
  if (quick === false) chips = [];
  else if (quick) chips = quick.filter((q) => inRange(q.iso));
  else {
    const tomorrow = { label: 'غداً', iso: addDays(today, 1) };
    const yesterday = { label: 'أمس', iso: addDays(today, -1) };
    chips = [{ label: 'اليوم', iso: today }, inRange(tomorrow.iso) ? tomorrow : yesterday].filter((q) => inRange(q.iso));
  }
  return (
    <div className={`datefield ${compact ? 'compact' : ''}`}>
      {!compact && <span className="lbl">{label}</span>}
      <div className="dateval"><Icon name="cal" /><b>{fmtDate(value) || '—'}</b></div>
      <div className="datectl">
        {chips.map((q) => (
          <button type="button" key={q.iso} className="chip" aria-pressed={value === q.iso} onClick={() => onChange(q.iso)}>{q.label}</button>
        ))}
        <input className="input date" type="date" value={value} min={min} max={max} required={required} aria-label={label}
          onChange={(e) => { if (e.target.value) onChange(e.target.value); }} />
      </div>
    </div>
  );
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <h2>
          <span>{title}</span>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="إغلاق"><Icon name="x" /></button>
        </h2>
        {children}
      </div>
    </div>
  );
}

export function Avatar({ name, color, small }: { name: string; color?: string; small?: boolean }) {
  const letter = (name ?? '').replace(/^أ\.\s*/, '').trim().charAt(0) || '؟';
  return (
    <div className={`avatar ${small ? 'sm' : ''}`} style={color ? ({ '--c': color } as CSSProperties) : undefined} aria-hidden="true">
      {letter}
    </div>
  );
}

export function PageHead({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <div className="head">
      <div className="txt">
        {back && (
          <Link to={back} className="backlink"><Icon name="back" /> رجوع</Link>
        )}
        <h1>{title}</h1>
        {sub && <span className="sub">{sub}</span>}
      </div>
      {actions && <div className="acts">{actions}</div>}
    </div>
  );
}

/** Row-shaped link/button. */
export function RowLink({ to, onClick, children, className }: { to?: string; onClick?: () => void; children: ReactNode; className?: string }) {
  if (to) return <Link to={to} className={`row ${className ?? ''}`}>{children}</Link>;
  return <button type="button" className={`row ${className ?? ''}`} onClick={onClick}>{children}</button>;
}

/** The support line shown on the login screen and at the foot of every screen:
    «مساعدة: ٠٩٣٣ ١٢٣ ٤٥٦ (٨–١٥)» with a tel: link, or the generic line when no phone is configured. */
export function SupportLine({ cfg, className }: { cfg: AppConfig; className?: string }) {
  const phone = cfg.support_phone.trim();
  if (!phone) return <span className={`support ${className ?? ''}`}>للمساعدة: إدارة المدرسة أو فريق مَدار</span>;
  const tel = phone.replace(/[^\d+]/g, '');
  return (
    <span className={`support ${className ?? ''}`}>
      مساعدة: <a href={`tel:${tel}`} className="num" dir="ltr">{arDigits(phone)}</a>
      {cfg.support_hours.trim() && <> ({arDigits(cfg.support_hours.trim())})</>}
    </span>
  );
}

/** Shown on Friday/Saturday when a screen displays the last school day instead of an empty weekend. */
export function LastSchoolDayNote({ day }: { day: string }) {
  if (!isWeekend(todayISO())) return null;
  return (
    <div className="notice full" role="status">
      <Icon name="cal" className="inline-ic" /> اليوم عطلة أسبوعية — تُعرض بيانات آخر يوم دراسي: {fmtDate(day)}. يعود الدوام يوم الأحد.
    </div>
  );
}

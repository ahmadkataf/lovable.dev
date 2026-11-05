/* App shell: top bar (identity, demo pill, bell), offline/outbox banners,
   bottom tab bar on phones, side rail from 900px, toast host. */

import type { CSSProperties, ReactNode } from 'react';
import { Icon, Logo } from './Icon';
import { Avatar } from './Ui';
import { ar, complexLabel, count, NOUNS, unreadLabel } from '../format';
import { Link, useRoute } from '../router';
import { discardOutboxItem, replayOutbox, retryOutboxItem } from '../api';
import { roleHome, signOut, useStore } from '../store';
import { navigate } from '../router';
import type { Role, SectionRef, StudentContext, TeacherContext } from '../types';

export const ROLE_COLOR: Record<Role, string> = {
  directorate: '#2a5bea', school: '#0c7886', teacher: '#6e52f5', student: '#a35f00', parent: '#c9386d',
};
export const ROLE_LABEL: Record<Role, string> = {
  directorate: 'مديرية التربية', school: 'إدارة المدرسة', teacher: 'معلّم/ة', student: 'طالب/ة', parent: 'وليّ الأمر',
};

interface Tab { to: string; label: string; icon: string }
const TABS: Record<Role, Tab[]> = {
  teacher: [
    { to: '/teacher', label: 'الرئيسية', icon: 'home' },
    { to: '/teacher/homework', label: 'الواجبات', icon: 'book' },
    { to: '/messages', label: 'الرسائل', icon: 'msg' },
    { to: '/notifications', label: 'الإشعارات', icon: 'bell' },
  ],
  student: [
    { to: '/student', label: 'الرئيسية', icon: 'home' },
    { to: '/student/timetable', label: 'الجدول', icon: 'cal' },
    { to: '/notifications', label: 'الإشعارات', icon: 'bell' },
  ],
  parent: [
    { to: '/parent', label: 'الأبناء', icon: 'parent' },
    { to: '/messages', label: 'الرسائل', icon: 'msg' },
    { to: '/notifications', label: 'الإشعارات', icon: 'bell' },
  ],
  school: [
    { to: '/school', label: 'الرئيسية', icon: 'chart' },
    { to: '/school/absences', label: 'الغياب', icon: 'alert' },
    { to: '/school/attendance', label: 'الحضور', icon: 'users' },
    { to: '/school/announcements', label: 'الإعلانات', icon: 'megaphone' },
    { to: '/notifications', label: 'الإشعارات', icon: 'bell' },
  ],
  directorate: [
    { to: '/directorate', label: 'الرئيسية', icon: 'chart' },
    { to: '/directorate/circulars', label: 'التعاميم', icon: 'megaphone' },
    { to: '/notifications', label: 'الإشعارات', icon: 'bell' },
  ],
};

function activeTab(tabs: Tab[], path: string): Tab | undefined {
  let best: Tab | undefined;
  for (const t of tabs) {
    if (path === t.to || path.startsWith(t.to + '/')) {
      if (!best || t.to.length > best.to.length) best = t;
    }
  }
  return best;
}

/** The subtitle under the name: `main` always shows, `extra` is dropped on the narrowest phones (≤ 400px). */
function subtitle(role: Role, ctx: unknown, schoolName: string | null | undefined, subject: string | null | undefined): { main: string; extra: string | null } {
  switch (role) {
    case 'teacher': {
      const c = ctx as TeacherContext | null;
      return { main: subject || c?.subject || ROLE_LABEL.teacher, extra: schoolName || null };
    }
    case 'student': {
      const c = ctx as StudentContext | null;
      const sec: SectionRef | undefined = c?.section;
      return { main: sec?.label ? `شعبة ${sec.label}` : ROLE_LABEL.student, extra: schoolName || c?.school_name || null };
    }
    case 'parent': return { main: ROLE_LABEL.parent, extra: schoolName || null };
    case 'school': {
      const complex = (ctx as { school?: { complex?: string } } | null)?.school?.complex;
      return { main: ROLE_LABEL.school, extra: complex ? complexLabel(complex) : null };
    }
    default: return { main: 'لوحة المديرية', extra: null };
  }
}

export function Shell({ children }: { children: ReactNode }) {
  const s = useStore();
  const route = useRoute();
  const role = s.user?.role ?? 'directorate';
  const color = ROLE_COLOR[role];
  const tabs = TABS[role];
  const active = activeTab(tabs, route.path);
  const name = s.user?.name ?? '';
  const displayName = role === 'teacher' && name && !name.startsWith('أ.') ? `أ. ${name}` : name;
  const sub = subtitle(role, s.context, s.user?.school_name, s.user?.subject);
  const subText = [sub.main, sub.extra].filter(Boolean).join(' · ');
  const offline = !s.online || s.fromCache;

  const logout = () => {
    signOut();
    navigate('/', { replace: true });
  };

  const NavItems = () => (
    <>
      {tabs.map((t) => (
        <Link key={t.to} to={t.to} className="tab" aria-current={active?.to === t.to ? 'page' : undefined}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
          {t.to === '/notifications' && s.unread > 0 && <i className="badge num">{ar(s.unread)}</i>}
        </Link>
      ))}
    </>
  );

  return (
    <div className="shell" data-role={role} style={{ '--c': color } as CSSProperties}>
      <aside className="rail glass" aria-label="التنقّل">
        <Link to={roleHome(role)} className="logo"><Logo /> مَدار</Link>
        <NavItems />
        <span className="spacer" />
        <div className="usercard">
          <Avatar name={displayName} color={color} small />
          <div className="txt"><b>{displayName}</b><small>{subText}</small></div>
          <button type="button" className="iconbtn" onClick={logout} aria-label="تسجيل الخروج" title="تسجيل الخروج"><Icon name="logout" /></button>
        </div>
      </aside>

      <header className="topbar glass">
        <div className="topbar-in">
          <Link to={roleHome(role)} className="who" aria-label="الرئيسية">
            <Avatar name={displayName} color={color} />
            <div className="txt">
              <b>{displayName}</b>
              <div className="meta">
                {s.demo && <span className="pill demo">بيانات تجريبية</span>}
                <small title={subText}>{sub.main}{sub.extra && <span className="sub-extra"> · {sub.extra}</span>}</small>
              </div>
            </div>
          </Link>
          <Link to="/notifications" className="iconbtn" aria-label={s.unread ? `الإشعارات، ${unreadLabel(s.unread)}` : 'الإشعارات'}>
            <Icon name="bell" />
            {s.unread > 0 && <span className="badge num" aria-hidden="true">{ar(s.unread)}</span>}
          </Link>
          <button type="button" className="iconbtn phone-only" onClick={logout} aria-label="تسجيل الخروج" title="تسجيل الخروج"><Icon name="logout" /></button>
        </div>
      </header>

      {offline && (
        <div className="banner offline" role="status">
          <div className="banner-in"><Icon name="wifioff" /><span className="grow">لا اتصال — تُعرض النسخة المحفوظة</span></div>
        </div>
      )}
      {s.outbox > 0 && (
        <div className="banner outbox" role="status">
          <div className="banner-in">
            <Icon name="inbox" />
            <span className="grow">{count(s.outbox, NOUNS.operation)} بانتظار الإرسال</span>
            {s.online && <button type="button" className="linkbtn" onClick={() => { void replayOutbox(); }}>إرسال الآن</button>}
          </div>
        </div>
      )}
      {s.rejected.length > 0 && (
        <div className="banner rejected" role="alert">
          <div className="banner-in rejected-in">
            <div className="rejected-head"><Icon name="alert" /><span className="grow">{count(s.rejected.length, NOUNS.operation)} لم تُقبل من الخادم</span></div>
            {s.rejected.map((it) => (
              <div className="rejected-row" key={it.id}>
                <span className="grow wrap-text">{it.label}{it.error ? ` — ${it.error}` : ''}</span>
                <button type="button" className="linkbtn" onClick={() => { void retryOutboxItem(it.id); }}>إعادة المحاولة</button>
                <button type="button" className="linkbtn" onClick={() => discardOutboxItem(it.id)}>تجاهل</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="page" key={route.path}>{children}</main>

      <nav className="tabbar glass" aria-label="التنقّل">
        <NavItems />
      </nav>

      <ToastHost />
    </div>
  );
}

export function ToastHost() {
  const { toast } = useStore();
  return (
    <div className={`toast ${toast ? 'show' : ''} ${toast?.kind ?? ''}`} role="status" aria-live="polite">
      <Icon name={toast?.kind === 'error' ? 'alert' : toast?.kind === 'info' ? 'info' : 'check'} />
      <span>{toast?.text}</span>
    </div>
  );
}

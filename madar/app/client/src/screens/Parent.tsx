/* Parent: a card per child (today's status, homework due, last notifications)
   and the entry point to message the teacher. */

import { Icon } from '../components/Icon';
import { Avatar, Btn, Empty, ErrorBox, Kpi, PageHead, Skeleton, Tag, Tile } from '../components/Ui';
import { ar, ATTENDANCE_LABEL, count, dueLabel, firstName, fmtClock, fmtDate, fmtWhen, NOTIFICATION_KIND_LABEL, NOUNS, todayISO, withPage } from '../format';
import { useApi } from '../hooks';
import { Link, navigate } from '../router';
import { useStore } from '../store';
import type { ParentHome as ParentHomeData } from '../types';

export function ParentHome() {
  const s = useStore();
  const { data, error, loading, reload } = useApi<ParentHomeData>('/api/parent/home');
  return (
    <>
      <PageHead title={`أهلاً، ${s.user?.name ?? ''}`} sub={`يوم أبنائك في شاشة واحدة · ${fmtDate(todayISO())}`} />
      {loading && !data && <Tile className="full"><Skeleton lines={4} /></Tile>}
      {error && !data && <Tile className="full"><ErrorBox error={error} retry={reload} /></Tile>}
      {data && data.children.length === 0 && <Tile className="full"><Empty icon="parent" title="لا أبناء مرتبطين بهذا الحساب" text="راجع إدارة المدرسة لربط الحساب بسجلّ الطالب." /></Tile>}
      {data?.children.map((c) => {
        const status = c.today.status;
        const tone = status === 'present' ? 'good' : status === 'absent' ? 'bad' : status === 'late' ? 'warn' : 'muted';
        const unread = c.notifications.filter((n) => !n.read_at).length;
        const due = c.homework.filter((h) => !h.done).length;
        return (
          <Tile key={c.student_id} className="full">
            <div className="head" style={{ marginBottom: 12 }}>
              <div className="inline">
                <Avatar name={c.name} />
                <div className="txt">
                  <h2>{c.name}</h2>
                  <span className="sub">الشعبة {c.section_label} · {c.school_name}</span>
                </div>
              </div>
              <div className="acts">
                <Btn size="sm" icon="msg" onClick={() => navigate(`/messages/new?child=${c.student_id}`)}>مراسلة المعلّم</Btn>
              </div>
            </div>
            <div className="kpis" style={{ marginBottom: 12 }}>
              <Kpi value={ATTENDANCE_LABEL[status]} label={status === 'none' ? 'حضور اليوم' : c.today.first_period_time ? `سُجّل ${fmtClock(c.today.first_period_time)}` : 'حضور اليوم'} tone={tone} />
              <Kpi value={ar(due)} label="واجبات هذا الأسبوع" tone={due ? undefined : 'good'} />
              <Kpi value={ar(unread)} label="إشعارات جديدة" tone={unread ? 'warn' : 'muted'} />
              <Kpi value={ar(c.homework.filter((h) => h.done).length)} label="واجبات مُسلَّمة" tone="good" />
            </div>
            <div className="grid2">
              <div>
                <div className="tile-h"><Icon name="book" /> الواجبات القادمة</div>
                {c.homework.length === 0 && <p className="small muted">لا واجبات خلال الأسبوع.</p>}
                <div className="list">
                  {c.homework.map((h) => (
                    <div className={`row ${h.done ? 'ok' : ''}`} key={h.id}>
                      <span className="grow">
                        <b>{h.subject}</b> · {withPage(h.title, h.book_page)}
                        <small>التسليم {fmtDate(h.due_date)} · {dueLabel(h.due_date)}</small>
                      </span>
                      <Tag tone={h.done ? 'mint' : 'sun'}>{h.done ? 'سُلّم' : 'بانتظار'}</Tag>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="tile-h"><Icon name="bell" /> آخر الإشعارات <Link to="/notifications" className="tag" style={{ marginInlineStart: 'auto' }}>الكلّ</Link></div>
                {c.notifications.length === 0 && <p className="small muted">لا إشعارات بعد.</p>}
                <div className="list">
                  {c.notifications.slice(0, 4).map((n) => (
                    <div className={`row ${n.read_at ? '' : 'unread'}`} key={n.id} style={{ alignItems: 'flex-start' }}>
                      <span className="grow"><span className="wrap-text">{n.body}</span><small>{fmtWhen(n.created_at)}</small></span>
                      <Tag tone={n.kind === 'absence' ? 'red' : n.kind === 'change' ? 'sun' : n.kind === 'announcement' ? 'teal' : undefined}>{NOTIFICATION_KIND_LABEL[n.kind] ?? n.kind}</Tag>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              إشعار الغياب يصل في اليوم نفسه بعد تثبيت الإدارة، وبرسالة SMS لمن لا يملك التطبيق. {unread ? `لدى ${firstName(c.name)} ${count(unread, NOUNS.notification)} جديدة.` : ''}
            </p>
          </Tile>
        );
      })}
    </>
  );
}

import { Icon } from '../components/Icon';
import { Btn, Empty, ErrorBox, PageHead, Progress, Skeleton, Tag, Tile } from '../components/Ui';
import { ar, count, dayIndex, dueLabel, fmtDate, greeting, NOUNS, periodName, teacherTitle, todayISO } from '../format';
import { useApi } from '../hooks';
import { Link, navigate } from '../router';
import { useStore } from '../store';
import type { TeacherContext, TeacherHome as TeacherHomeData } from '../types';

export function TeacherHome() {
  const s = useStore();
  const ctx = s.context as TeacherContext | null;
  const { data, error, loading, reload } = useApi<TeacherHomeData>('/api/teacher/home');
  const today = todayISO();
  const weekend = dayIndex(today) > 4;
  const periods = data?.today.periods ?? [];
  const sectionsLabel = ctx?.sections.map((x) => x.label).join('، ');

  return (
    <>
      <PageHead
        title={`${greeting()}، ${teacherTitle(s.user?.name)}`}
        sub={[s.user?.subject || ctx?.subject, sectionsLabel, data ? `${count(periods.length, NOUNS.period, 'لا حصص')} اليوم` : null].filter(Boolean).join(' · ')}
      />

      {data?.absence_today && (
        <div className="notice full">
          <Icon name="info" className="inline-ic" /> سُجّل غيابك اليوم{data.absence_today.reason ? ` (${data.absence_today.reason})` : ''} — تتولّى الإدارة ترتيب التغطية وإبلاغ الطلاب.
        </div>
      )}

      <Tile title={`حصصك اليوم · ${fmtDate(today)}`} icon="cal" className="full">
        {loading && !data && <Skeleton lines={4} />}
        {error && !data && <ErrorBox error={error} retry={reload} />}
        {data && periods.length === 0 && (
          <Empty icon="cal" title={weekend ? 'لا دوام اليوم' : 'لا حصص لك اليوم'} text={weekend ? 'يعود الدوام يوم الأحد.' : undefined} />
        )}
        <div className="list">
          {periods.map((p) => (
            <div className={`row ${p.substitute ? 'hl' : p.attendance_taken ? 'ok' : ''}`} key={p.id}>
              <span className="pnum num" aria-hidden="true">{ar(p.period)}</span>
              <span className="grow">
                <b>{p.section_label}</b> · {p.subject}
                <small>
                  {periodName(p.period)}
                  {p.substitute && (p.substitute.status === 'self_study' ? ' · تعلّم ذاتي موجَّه' : p.substitute.teacher ? ` · البديل: ${teacherTitle(p.substitute.teacher)}` : '')}
                </small>
              </span>
              {p.attendance_taken ? (
                <Link to={`/teacher/attendance?section=${p.section_id}&period=${p.period}`} className="tag mint">سُجّل الحضور ✓</Link>
              ) : (
                <Btn size="sm" icon="users" onClick={() => navigate(`/teacher/attendance?section=${p.section_id}&period=${p.period}`)}>تسجيل الحضور</Btn>
              )}
            </div>
          ))}
        </div>
      </Tile>

      {data && data.substitutions_for_me.length > 0 && (
        <Tile title="حصص بديلة مكلَّف بها اليوم" icon="swap" color="var(--sun)" className="full">
          <div className="list">
            {data.substitutions_for_me.map((x) => (
              <div className="row hl" key={x.id}>
                <span className="pnum num" aria-hidden="true">{ar(x.period)}</span>
                <span className="grow">
                  <b>{periodName(x.period)} · {x.section_label} · {x.subject}</b>
                  <small>{x.lesson_note ? `خطّة الدرس: ${x.lesson_note}` : 'لا خطّة درس مرفقة'}</small>
                </span>
              </div>
            ))}
          </div>
        </Tile>
      )}

      <Tile title="إجراءات سريعة" icon="edit">
        <div className="btnrow top">
          <Btn icon="plus" onClick={() => navigate('/teacher/homework/new')}>واجب جديد</Btn>
          <Btn variant="light" icon="alert" onClick={() => navigate('/teacher/absence')}>الإبلاغ عن غياب</Btn>
        </div>
      </Tile>

      <Tile title="آخر الواجبات" icon="book" right={<Link to="/teacher/homework" className="tag">الكلّ</Link>}>
        {loading && !data && <Skeleton />}
        {data && data.homework.length === 0 && <Empty icon="book" title="لا واجبات بعد" text="انشر أوّل واجب من زرّ «واجب جديد»." />}
        <div className="list">
          {data?.homework.slice(0, 5).map((h) => {
            const n = h.submitted_count ?? 0;
            const m = h.student_count ?? 0;
            return (
              <Link to={`/teacher/homework/${h.id}`} className="row" key={h.id}>
                <span className="grow">
                  <b>{h.title}</b>
                  <small>{h.section_label ?? ''} · التسليم {fmtDate(h.due_date)}</small>
                  <span style={{ display: 'block', marginTop: 6 }}><Progress value={n} max={m || 1} /></span>
                </span>
                <Tag tone={n === m && m > 0 ? 'mint' : undefined}>{ar(n)} / {ar(m)}</Tag>
                <Tag tone="gray">{dueLabel(h.due_date)}</Tag>
              </Link>
            );
          })}
        </div>
      </Tile>
    </>
  );
}

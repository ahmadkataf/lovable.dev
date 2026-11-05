/* Student: home (today's timetable with substitute badges, homework with
   «تمّ», notifications, points) and the weekly timetable. */

import { useMemo, useState } from 'react';
import * as api from '../api';
import { Icon } from '../components/Icon';
import { Empty, ErrorBox, PageHead, Skeleton, Tag, Tile } from '../components/Ui';
import { ar, count, DAYS, dayIndex, dueLabel, firstName, fmtDate, NOUNS, periodName, shortSubject, teacherTitle, todayISO, unreadLabel, withPage } from '../format';
import { useApi } from '../hooks';
import { Link } from '../router';
import { refreshUnread, toast, useStore } from '../store';
import type { StudentContext, StudentHome as StudentHomeData, TimetableRow } from '../types';

function PeriodsGrid({ rows, max = 6 }: { rows: TimetableRow[]; max?: number }) {
  const top = Math.max(max, ...rows.map((r) => r.period));
  const cells = Array.from({ length: top }, (_, i) => rows.find((r) => r.period === i + 1) ?? null);
  return (
    <div className="periods">
      {cells.map((r, i) => {
        const sub = r?.substitute;
        const cls = sub ? (sub.status === 'self_study' ? 'self' : 'sub') : r ? '' : 'free';
        return (
          <div className={`per ${cls}`} key={i} title={r ? `${periodName(i + 1)} · ${r.subject} · ${teacherTitle(r.teacher)}` : periodName(i + 1)}>
            <small>{ar(i + 1)}</small>
            <span className="nm">{r ? shortSubject(r.subject) : 'فراغ'}</span>
            {sub && <small>{sub.status === 'self_study' ? 'تعلّم ذاتي' : sub.teacher ? `بديل: ${teacherTitle(firstName(sub.teacher))}` : 'بديل'}</small>}
          </div>
        );
      })}
    </div>
  );
}

export function StudentHome() {
  const s = useStore();
  const ctx = s.context as StudentContext | null;
  const { data, error, loading, reload } = useApi<StudentHomeData>('/api/student/home');
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [localDone, setLocalDone] = useState<Set<number>>(new Set());
  const today = todayISO();
  const weekend = dayIndex(today) > 4;
  const homework = useMemo(() => (data?.homework ?? []).map((h) => ({ ...h, done: h.done || localDone.has(h.id) })), [data, localDone]);
  const points = homework.filter((h) => h.done).length * 10;
  const changes = (data?.today ?? []).filter((r) => r.substitute);

  const submit = async (id: number) => {
    if (pending.has(id)) return;
    setPending((p) => new Set(p).add(id));
    try {
      const res = await api.post<{ done: boolean; points?: number }>(`/api/homework/${id}/submit`, {});
      setLocalDone((d) => new Set(d).add(id));
      if ('queued' in res && res.queued) toast('لا اتصال — سُجّل الإنجاز وسيُرسل عند عودة الاتصال', 'info', 5000);
      else toast(`أحسنت يا ${firstName(s.user?.name)}! +١٠ نقاط`);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'تعذّر التسليم', 'error');
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  };

  return (
    <>
      <PageHead
        title={`أهلاً ${firstName(s.user?.name)}!`}
        sub={[ctx?.section?.label ? `الشعبة ${ctx.section.label}` : null, ctx?.school_name ?? s.user?.school_name].filter(Boolean).join(' · ')}
        actions={<span className="points num" title="١٠ نقاط لكلّ واجب مُسلَّم"><Icon name="star" /> {count(points, NOUNS.point, '٠ نقطة')}</span>}
      />

      <Tile title="واجباتي · اضغط عند الإنجاز" icon="book" className="full">
        {loading && !data && <Skeleton lines={3} />}
        {error && !data && <ErrorBox error={error} retry={reload} />}
        {data && homework.length === 0 && <Empty icon="book" title="لا واجبات حالياً" text="عندما ينشر المعلّم واجباً جديداً يظهر هنا ويصلك إشعار." />}
        <div className="list">
          {homework.map((h) => {
            const urgent = dueLabel(h.due_date) === 'اليوم' || dueLabel(h.due_date) === 'غداً';
            return (
              <button
                type="button"
                key={h.id}
                className={`row ${h.done ? 'done' : urgent ? 'hl' : ''}`}
                onClick={() => { if (!h.done) void submit(h.id); }}
                aria-pressed={h.done}
                disabled={pending.has(h.id)}
              >
                <span className="chk" aria-hidden="true"><Icon name="check" /></span>
                <span className="grow">
                  <span>{h.subject} · {withPage(h.title, h.book_page)}</span>
                  <small>{h.done ? 'تمّ التسليم' : `موعد التسليم: ${fmtDate(h.due_date)}`}</small>
                </span>
                <Tag tone={h.done ? 'mint' : urgent ? 'sun' : undefined}>{h.done ? 'تمّ' : dueLabel(h.due_date)}</Tag>
              </button>
            );
          })}
        </div>
      </Tile>

      <Tile title="جدول اليوم" icon="cal" right={<span className="inline"><Tag tone="gray">{fmtDate(today)}</Tag><Link to="/student/timetable" className="tag">الأسبوع</Link></span>}>
        {loading && !data && <Skeleton lines={2} />}
        {data && data.today.length === 0 && <Empty icon="cal" title={weekend ? 'لا دوام اليوم' : 'لا حصص اليوم'} text={weekend ? 'يعود الدوام يوم الأحد.' : undefined} />}
        {data && data.today.length > 0 && <PeriodsGrid rows={data.today} />}
        {changes.length > 0 && (
          <div className="list" style={{ marginTop: 10 }}>
            {changes.map((r) => (
              <div className="row hl" key={r.id}>
                <span className="pnum num" aria-hidden="true">{ar(r.period)}</span>
                <span className="grow">
                  <b>{periodName(r.period)} ({r.subject})</b>
                  <small>{r.substitute?.status === 'self_study' ? 'تعلّم ذاتي موجَّه — اتّبع النشاط المطلوب' : `مع معلّم بديل: ${teacherTitle(r.substitute?.teacher)}`}</small>
                </span>
                <Tag tone="sun">تغيير</Tag>
              </div>
            ))}
          </div>
        )}
      </Tile>

      <Tile title="الإشعارات" icon="bell" right={<Link to="/notifications" className="tag">عرض الكلّ</Link>}>
        <p className="small muted">
          {data ? unreadLabel(data.notifications_unread) : '…'}
        </p>
        <Link to="/notifications" className="abtn light sm" style={{ marginTop: 8 }} onClick={() => { void refreshUnread(); }}>فتح الإشعارات</Link>
      </Tile>
    </>
  );
}

export function StudentTimetable() {
  const s = useStore();
  const ctx = s.context as StudentContext | null;
  const sectionId = ctx?.section?.id ?? null;
  const { data, error, loading, reload } = useApi<TimetableRow[]>(sectionId ? `/api/timetable?section_id=${sectionId}` : '/api/timetable');
  const todayIdx = dayIndex(todayISO());
  return (
    <>
      <PageHead title="جدول الأسبوع" sub={ctx?.section?.label ? `الشعبة ${ctx.section.label}` : undefined} />
      {loading && !data && <Tile className="full"><Skeleton lines={4} /></Tile>}
      {error && !data && <Tile className="full"><ErrorBox error={error} retry={reload} /></Tile>}
      {data && [0, 1, 2, 3, 4].map((d) => {
        const rows = data.filter((r) => r.day === d);
        return (
          <Tile key={d} title={DAYS[d]} icon="cal" right={d === todayIdx ? <Tag tone="mint">اليوم</Tag> : undefined} className={d === todayIdx ? 'full' : ''}>
            {rows.length ? <PeriodsGrid rows={rows} /> : <p className="small muted">لا حصص</p>}
            <div className="list" style={{ marginTop: 10 }}>
              {rows.map((r) => (
                <div className="row" key={r.id} style={{ padding: '6px 10px' }}>
                  <span className="pnum num" aria-hidden="true">{ar(r.period)}</span>
                  <span className="grow small">{r.subject}<small>{teacherTitle(r.teacher)}</small></span>
                </div>
              ))}
            </div>
          </Tile>
        );
      })}
    </>
  );
}

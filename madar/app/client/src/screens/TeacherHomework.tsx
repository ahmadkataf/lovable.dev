/* Teacher homework: list, new-homework form, detail with submissions. */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import * as api from '../api';
import { Btn, Empty, ErrorBox, Field, PageHead, Progress, Skeleton, Tag, Tile } from '../components/Ui';
import { addDays, ar, arDigits, count, dueLabel, fmtDate, fmtWhen, NOUNS, todayISO } from '../format';
import { useApi } from '../hooks';
import { Link, navigate, useRoute } from '../router';
import { toast, useStore } from '../store';
import type { Homework, HomeworkCreateResponse, HomeworkDetail, TeacherContext, TimetableRow } from '../types';

export function TeacherHomework() {
  const s = useStore();
  const ctx = s.context as TeacherContext | null;
  const route = useRoute();
  const sectionId = Number(route.query.get('section') ?? 0) || null;
  const { data, error, loading, reload } = useApi<Homework[]>(sectionId ? `/api/homework?section_id=${sectionId}` : '/api/homework');
  return (
    <>
      <PageHead title="الواجبات" sub="واجباتك مع نسبة التسليم" actions={<Btn icon="plus" size="sm" onClick={() => navigate('/teacher/homework/new')}>واجب جديد</Btn>} />
      {ctx && ctx.sections.length > 1 && (
        <div className="chips full">
          <button type="button" className="chip" aria-pressed={!sectionId} onClick={() => navigate('/teacher/homework', { replace: true })}>الكلّ</button>
          {ctx.sections.map((x) => (
            <button type="button" key={x.id} className="chip" aria-pressed={sectionId === x.id} onClick={() => navigate(`/teacher/homework?section=${x.id}`, { replace: true })}>{x.label}</button>
          ))}
        </div>
      )}
      <Tile className="full">
        {loading && !data && <Skeleton lines={4} />}
        {error && !data && <ErrorBox error={error} retry={reload} />}
        {data && data.length === 0 && <Empty icon="book" title="لا واجبات" text="انشر واجباً جديداً ليصل إلى طلاب الشعبة وأولياء أمورهم." />}
        <div className="list">
          {data?.map((h) => {
            const n = h.submitted_count ?? 0;
            const m = h.student_count ?? 0;
            return (
              <Link to={`/teacher/homework/${h.id}`} className="row" key={h.id}>
                <span className="grow">
                  <b>{h.title}</b>
                  <small>{[h.subject, h.section_label, `التسليم ${fmtDate(h.due_date)}`].filter(Boolean).join(' · ')}</small>
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

export function TeacherHomeworkNew() {
  const s = useStore();
  const ctx = s.context as TeacherContext | null;
  const route = useRoute();
  const sections = ctx?.sections ?? [];
  const [sectionId, setSectionId] = useState<number>(Number(route.query.get('section') ?? 0) || sections[0]?.id || 0);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [bookPage, setBookPage] = useState('');
  const [due, setDue] = useState(addDays(todayISO(), 3));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // subject_id is not in the teacher context: read it from the teacher's own timetable rows
  const tt = useApi<TimetableRow[]>(s.user ? `/api/timetable?teacher_id=${s.user.id}` : null);
  const subjectId = useMemo(() => {
    const rows = tt.data ?? [];
    const row = rows.find((r) => r.section_id === sectionId) ?? rows[0];
    return row?.subject_id ?? null;
  }, [tt.data, sectionId]);
  const subjectName = useMemo(() => {
    const rows = tt.data ?? [];
    return (rows.find((r) => r.section_id === sectionId) ?? rows[0])?.subject ?? s.user?.subject ?? ctx?.subject ?? '';
  }, [tt.data, sectionId, s.user?.subject, ctx?.subject]);

  useEffect(() => { if (!sectionId && sections[0]) setSectionId(sections[0].id); }, [sections, sectionId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sectionId) { setError('اختر الشعبة'); return; }
    if (!title.trim()) { setError('اكتب عنوان الواجب'); return; }
    if (!subjectId) { setError('تعذّر تحديد المادة — تحقّق من الاتصال ثم أعد المحاولة'); return; }
    setBusy(true);
    try {
      const body = { section_id: sectionId, subject_id: subjectId, title: title.trim(), details: details.trim() || undefined, book_page: bookPage.trim() || undefined, due_date: due, client_id: api.clientId() };
      const res = await api.post<HomeworkCreateResponse>('/api/homework', body);
      if ('queued' in res) {
        toast('لا اتصال — حُفظ الواجب وسيُنشر تلقائياً عند عودة الاتصال', 'info', 5000);
        navigate('/teacher/homework', { replace: true });
      } else {
        toast(`وصل الواجب إلى ${count(res.notified_students, NOUNS.student)} و${count(res.notified_guardians, NOUNS.guardian)}`, 'ok', 5000);
        navigate(`/teacher/homework/${res.id}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر نشر الواجب');
    } finally {
      setBusy(false);
    }
  };

  const sec = sections.find((x) => x.id === sectionId);
  return (
    <>
      <PageHead title="واجب جديد" back="/teacher" sub={sec ? `${subjectName} · الشعبة ${sec.label}` : subjectName} />
      <Tile className="full" title="بيانات الواجب" icon="book">
        <form onSubmit={submit} className="stack">
          <div className="fields">
            <Field label="الشعبة">
              <select className="input" value={sectionId} onChange={(e) => setSectionId(Number(e.target.value))}>
                {sections.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </Field>
            <Field label="المادة">
              <input className="input" value={subjectName} readOnly />
            </Field>
            <Field label="العنوان" className="full">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تمارين الكسور العشرية" required maxLength={120} />
            </Field>
            <Field label="التفاصيل (اختياري)" className="full">
              <textarea className="input" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="ما المطلوب من الطالب؟" rows={3} />
            </Field>
            <Field label="صفحة الكتاب" hint="رقم الصفحة في الكتاب المدرسي">
              <input className="input" value={bookPage} onChange={(e) => setBookPage(e.target.value)} placeholder="مثال: ٤٢" inputMode="numeric" />
            </Field>
            <Field label="موعد التسليم" hint={due ? `${fmtDate(due)} · ${dueLabel(due)}` : undefined}>
              <input className="input" type="date" value={due} min={todayISO()} onChange={(e) => setDue(e.target.value)} required />
            </Field>
          </div>
          <p className="small muted">يصل الواجب إلى كلّ طلاب الشعبة وأولياء أمورهم فور النشر، مع تذكير قبل الموعد.</p>
          {error && <div className="error" role="alert">{error}</div>}
          <div className="btnrow top">
            <Btn type="submit" icon="send" loading={busy}>نشر الواجب للشعبة</Btn>
            <Btn type="button" variant="light" onClick={() => navigate('/teacher')}>إلغاء</Btn>
          </div>
        </form>
      </Tile>
    </>
  );
}

export function TeacherHomeworkDetail({ id }: { id: number }) {
  const { data, error, loading, reload } = useApi<HomeworkDetail>(`/api/homework/${id}`);
  const submitted = data?.submissions ?? [];
  const submittedIds = new Set(submitted.map((x) => x.student_id));
  const pending = (data?.students ?? []).filter((st) => !submittedIds.has(st.id) && !st.done);
  const total = data?.student_count ?? data?.students?.length ?? 0;
  return (
    <>
      <PageHead title={data?.title ?? 'الواجب'} back="/teacher/homework" sub={data ? [data.subject, data.section_label, `التسليم ${fmtDate(data.due_date)} (${dueLabel(data.due_date)})`].filter(Boolean).join(' · ') : undefined} />
      {loading && !data && <Tile className="full"><Skeleton lines={4} /></Tile>}
      {error && !data && <Tile className="full"><ErrorBox error={error} retry={reload} /></Tile>}
      {data && (
        <>
          <Tile title="التفاصيل" icon="book">
            <div className="stack">
              {data.details && <p className="small">{data.details}</p>}
              <div className="inline">
                {data.book_page && <Tag>كتاب {data.subject}، ص {arDigits(data.book_page)}</Tag>}
                <Tag tone="gray">نُشر {fmtWhen(data.created_at)}</Tag>
              </div>
              <div>
                <div className="inline small" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>نسبة التسليم</span>
                  <b className="num">{ar(submitted.length)} / {ar(total)}</b>
                </div>
                <Progress value={submitted.length} max={total || 1} />
              </div>
            </div>
          </Tile>
          <Tile title={`سُلّم (${ar(submitted.length)})`} icon="check" color="var(--mint)">
            {submitted.length === 0 && <p className="small muted">لم يسلّم أحد بعد.</p>}
            <div className="list">
              {submitted.map((x) => (
                <div className="row ok" key={x.student_id}>
                  <span className="grow"><b>{x.student_name ?? x.name}</b><small>سُلّم {fmtWhen(x.submitted_at)}</small></span>
                  <Tag tone="mint">تمّ</Tag>
                </div>
              ))}
            </div>
          </Tile>
          {data.students && (
            <Tile title={`لم يُسلَّم بعد (${ar(pending.length)})`} icon="clock" color="var(--sun)">
              {pending.length === 0 && <p className="small muted">سلّم الجميع — أحسنتم!</p>}
              <div className="list">
                {pending.map((st) => (
                  <div className="row" key={st.id}>
                    <span className="grow"><b>{st.name}</b><small>تذكير يُرسل لوليّ الأمر قبل الموعد</small></span>
                    <Tag tone="sun">بانتظار</Tag>
                  </div>
                ))}
              </div>
            </Tile>
          )}
        </>
      )}
    </>
  );
}

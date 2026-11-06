/* Messages: thread list, a thread, and (for parents) the «رسالة إلى المعلّم»
   flow: choose the child → teacher of the section → text. */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import * as api from '../api';
import { Icon } from '../components/Icon';
import { ROLE_LABEL } from '../components/Shell';
import { Avatar, Btn, Empty, ErrorBox, Field, PageHead, Skeleton, Tile } from '../components/Ui';
import { firstName, fmtWhen, teacherTitle } from '../format';
import { useApi } from '../hooks';
import { Link, navigate, useRoute } from '../router';
import { toast, useStore } from '../store';
import type { Message, ParentChildRef, ParentContext, Role, ServerThread, Thread, TimetableRow } from '../types';

/** Accept the server's threads (`{with:{id,name,role}, unread, messages}`), the mock's (`{user_id,name,role,messages}`)
    or a flat message list from GET /api/messages. */
export function normalise(data: unknown, myId: number): Thread[] {
  if (!Array.isArray(data)) return [];
  const threads: Thread[] = [];
  const flat: Message[] = [];
  for (const row of data as unknown[]) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<ServerThread> & Partial<Thread> & Partial<Message>;
    if (Array.isArray(r.messages)) {
      const id = Number(r.with?.id ?? r.user_id);
      if (!Number.isInteger(id) || id <= 0) continue;
      threads.push({ user_id: id, name: r.with?.name ?? r.name ?? `مستخدم ${id}`, role: r.with?.role ?? r.role, unread: r.unread, messages: r.messages });
    } else if (typeof r.from_user === 'number' && typeof r.to_user === 'number') {
      flat.push(r as Message);
    }
  }
  const map = new Map<number, Thread>();
  for (const m of flat) {
    const other = m.from_user === myId ? m.to_user : m.from_user;
    if (!map.has(other)) map.set(other, { user_id: other, name: (m as Message & { name?: string }).name ?? `مستخدم ${other}`, messages: [] });
    map.get(other)!.messages.push(m);
  }
  return [...threads, ...map.values()];
}

const displayName = (t: Thread | undefined): string => (t ? (t.role === 'teacher' ? teacherTitle(t.name) : t.name) : '');
const roleLabel = (role: string | undefined): string | undefined => (role && role in ROLE_LABEL ? ROLE_LABEL[role as Role] : undefined);

export function MessagesList() {
  const s = useStore();
  const { data, error, loading, reload } = useApi<unknown>('/api/messages');
  const threads = useMemo(() => normalise(data, s.user?.id ?? 0), [data, s.user?.id]);
  const loaded = data !== null && data !== undefined;
  const isParent = s.user?.role === 'parent';
  return (
    <>
      <PageHead
        title="الرسائل"
        sub={isParent ? 'مراسلة رسمية مع معلّمي أبنائك' : 'رسائل أولياء الأمور'}
        actions={isParent ? <Btn icon="plus" size="sm" onClick={() => navigate('/messages/new')}>رسالة إلى المعلّم</Btn> : undefined}
      />
      <Tile className="full">
        {loading && !loaded && <Skeleton />}
        {error && !loaded && <ErrorBox error={error} retry={reload} />}
        {loaded && threads.length === 0 && (
          <Empty icon="msg" title="لا رسائل بعد" text={isParent ? 'تبدأ المراسلة من زرّ «رسالة إلى المعلّم».' : 'تظهر هنا رسائل أولياء الأمور.'} />
        )}
        <div className="list">
          {threads.map((t) => {
            const last = t.messages[t.messages.length - 1];
            const unread = t.unread ?? t.messages.filter((m) => m.to_user === s.user?.id && !m.read_at).length;
            const name = displayName(t);
            return (
              <Link key={t.user_id} to={`/messages/${t.user_id}`} className={`row ${unread ? 'unread' : ''}`}>
                <Avatar name={name} small />
                <span className="grow">
                  <b>{name}</b>
                  <small className="wrap-text">{last?.body}</small>
                </span>
                <small className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtWhen(last?.created_at)}</small>
              </Link>
            );
          })}
        </div>
      </Tile>
    </>
  );
}

export function MessageThread({ userId }: { userId: number }) {
  const s = useStore();
  const { data, error, loading, reload } = useApi<unknown>('/api/messages');
  const threads = useMemo(() => normalise(data, s.user?.id ?? 0), [data, s.user?.id]);
  const thread = threads.find((t) => t.user_id === userId);
  const loaded = data !== null && data !== undefined;
  const route = useRoute();
  const nameFromQuery = route.query.get('name');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const name = thread ? displayName(thread) : nameFromQuery ?? '';

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.post('/api/messages', { to_user: userId, body: text.trim() }, { queueable: false });
      setText('');
      toast(`أُرسلت رسالتك إلى ${name}`);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الإرسال', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title={name || 'محادثة'} back="/messages" sub={roleLabel(thread?.role)} />
      <Tile className="full">
        {loading && !loaded && <Skeleton />}
        {error && !loaded && <ErrorBox error={error} retry={reload} />}
        {loaded && !thread && <p className="small muted" style={{ marginBottom: 10 }}>لا رسائل سابقة — هذه الرسالة الأولى.</p>}
        <div className="msgs">
          {thread?.messages.map((m) => (
            <div key={m.id} className={`msg ${m.from_user === s.user?.id ? 'me' : ''}`}>
              {m.body}
              <small>{fmtWhen(m.created_at)}</small>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="stack" style={{ marginTop: 12 }}>
          <Field label="نصّ الرسالة">
            <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="نصّ الرسالة بأسلوب رسمي…" rows={3} required />
          </Field>
          <div className="btnrow top">
            <Btn type="submit" icon="send" loading={busy} disabled={!text.trim()}>إرسال</Btn>
          </div>
        </form>
      </Tile>
    </>
  );
}

interface TeacherOpt { teacher_id: number; teacher: string; subject: string }

export function MessageNew() {
  const s = useStore();
  const route = useRoute();
  const ctx = s.context as ParentContext | null;
  const children: ParentChildRef[] = ctx?.children ?? [];
  const [childId, setChildId] = useState<number | null>(() => {
    const q = route.query.get('child');
    return q ? Number(q) : children.length === 1 ? children[0].student_id : null;
  });
  const child = children.find((c) => c.student_id === childId);
  // Each child's section comes with /api/me, so the teacher list is the selected child's, not the first child's.
  const sectionId = child?.section_id ?? null;
  const [teachers, setTeachers] = useState<TeacherOpt[] | null>(null);
  const [tErr, setTErr] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!child) return;
    let alive = true;
    setTeachers(null);
    setTErr(null);
    const url = sectionId ? `/api/timetable?section_id=${sectionId}` : '/api/timetable';
    api.get<TimetableRow[]>(url)
      .then((rows) => {
        if (!alive) return;
        const map = new Map<number, TeacherOpt>();
        for (const r of rows) if (!map.has(r.teacher_id)) map.set(r.teacher_id, { teacher_id: r.teacher_id, teacher: r.teacher, subject: r.subject });
        setTeachers([...map.values()]);
      })
      .catch((e: unknown) => { if (alive) setTErr(e instanceof Error ? e.message : 'تعذّر تحميل قائمة المعلّمين'); });
    return () => { alive = false; };
  }, [child, sectionId]);

  const teacher = teachers?.find((t) => t.teacher_id === teacherId);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!teacher || !text.trim()) return;
    setBusy(true);
    try {
      await api.post('/api/messages', { to_user: teacher.teacher_id, body: text.trim() }, { queueable: false });
      toast(`أُرسلت رسالتك إلى ${teacherTitle(teacher.teacher)}، ويصل الردّ في التطبيق`);
      navigate(`/messages/${teacher.teacher_id}`, { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الإرسال', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="رسالة إلى المعلّم" back="/messages" sub="اختر الطالب ثمّ المعلّم ثمّ اكتب رسالتك" />
      <Tile className="full" title="١ · الطالب" icon="parent">
        <div className="chips">
          {children.map((c) => (
            <button type="button" key={c.student_id} className="chip" aria-pressed={childId === c.student_id} onClick={() => { setChildId(c.student_id); setTeacherId(null); }}>
              <span className="dot" aria-hidden="true" />{c.name}<small>{c.section_label}</small>
            </button>
          ))}
        </div>
        {!children.length && <p className="small muted">لا أبناء مرتبطين بهذا الحساب.</p>}
      </Tile>
      {child && (
        <Tile className="full" title={`٢ · معلّمو شعبة ${child.section_label}`} icon="teacher">
          {!teachers && !tErr && <Skeleton lines={2} />}
          {tErr && <ErrorBox error={tErr} />}
          {teachers && (
            <div className="chips">
              {teachers.map((t) => (
                <button type="button" key={t.teacher_id} className="chip" aria-pressed={teacherId === t.teacher_id} onClick={() => setTeacherId(t.teacher_id)}>
                  {teacherTitle(t.teacher)}<small>{t.subject}</small>
                </button>
              ))}
            </div>
          )}
        </Tile>
      )}
      {teacher && (
        <Tile className="full" title="٣ · الرسالة" icon="msg">
          <form onSubmit={send} className="stack">
            <p className="small muted">إلى {teacherTitle(teacher.teacher)} ({teacher.subject}) بخصوص {firstName(child?.name)}. لا يُشارك رقم هاتف المعلّم.</p>
            <Field label="نصّ الرسالة">
              <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="مثال: أستاذ، هل يمكن تأجيل تسليم الواجب يوماً واحداً لظرف عائلي؟" rows={4} required />
            </Field>
            <div className="btnrow top">
              <Btn type="submit" icon="send" loading={busy} disabled={!text.trim()}>إرسال</Btn>
            </div>
          </form>
        </Tile>
      )}
      <p className="small muted full"><Icon name="info" className="inline-ic" /> الرسائل رسمية وتُحفظ في النظام، وترى الإدارة سجلّها عند الحاجة.</p>
    </>
  );
}

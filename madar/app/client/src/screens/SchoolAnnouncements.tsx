/* School announcements: composer (urgent toggle) + list. The contract has no
   GET /api/announcements, so the list is read from it when the server offers
   it and otherwise from the announcements sent from this device. */

import { useEffect, useState, type FormEvent } from 'react';
import * as api from '../api';
import { Btn, Empty, Field, PageHead, Tag, Tile, Toggle } from '../components/Ui';
import { count, fmtWhen, NOUNS } from '../format';
import { toast, useStore } from '../store';
import type { Announcement } from '../types';

const LOCAL_KEY = 'sent-announcements';

export function readLocal(scope: string): Announcement[] {
  try { const raw = localStorage.getItem(`${LOCAL_KEY}:${scope}`); return raw ? (JSON.parse(raw) as Announcement[]) : []; } catch { return []; }
}
export function writeLocal(scope: string, list: Announcement[]) {
  try { localStorage.setItem(`${LOCAL_KEY}:${scope}`, JSON.stringify(list.slice(0, 50))); } catch { /* ignore */ }
}

export function useAnnouncements(scope: string) {
  const [list, setList] = useState<Announcement[]>(() => readLocal(scope));
  const [source, setSource] = useState<'server' | 'local'>('local');
  const reload = () => {
    api.get<Announcement[]>('/api/announcements')
      .then((rows) => { if (Array.isArray(rows)) { setList(rows); setSource('server'); } })
      .catch(() => { setList(readLocal(scope)); setSource('local'); });
  };
  useEffect(reload, [scope]);
  const addLocal = (a: Announcement) => {
    const next = [a, ...readLocal(scope)];
    writeLocal(scope, next);
    if (source === 'local') setList(next);
    else reload();
  };
  return { list, source, reload, addLocal };
}

export function SchoolAnnouncements() {
  const s = useStore();
  const scope = `school:${s.user?.id ?? 0}`;
  const { list, source, addLocal } = useAnnouncements(scope);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { setError('اكتب العنوان والنصّ'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ id?: number; notified_parents?: number; notified?: number; sms?: number }>('/api/announcements', { title: title.trim(), body: body.trim(), urgent: urgent ? 1 : 0 }, { queueable: false });
      const n = 'queued' in res ? 0 : res.notified_parents ?? res.notified ?? 0;
      toast(`أُرسل الإعلان${urgent ? ' العاجل' : ''} إلى ${n ? count(n, NOUNS.guardian) : 'أولياء الأمور'} عبر التطبيق${urgent ? ' وبرسالة SMS' : ''}`, 'ok', 5000);
      addLocal({ id: 'queued' in res ? Date.now() : res.id ?? Date.now(), school_id: s.user?.school_id ?? null, title: title.trim(), body: body.trim(), urgent: urgent ? 1 : 0, created_at: new Date().toISOString(), notified: n });
      setTitle('');
      setBody('');
      setUrgent(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الإرسال');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="الإعلانات" sub="إعلان واحد يصل إلى كلّ الأهالي بالتطبيق، وبرسالة SMS إن كان عاجلاً" />
      <Tile className="full" title="إعلان جديد لكلّ الأهالي" icon="megaphone">
        <form onSubmit={submit} className="stack">
          <Field label="العنوان">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تعليق الدوام يوم الأحد" maxLength={100} required />
          </Field>
          <Field label="النصّ">
            <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="مثال: يُعلَّق الدوام يوم الأحد ٨ تشرين الثاني بسبب الأحوال الجوية، ويُستأنف الاثنين." rows={4} required />
          </Field>
          <Toggle label="عاجل — يُرسل أيضاً برسالة SMS لمن لا يملك التطبيق" checked={urgent} onChange={setUrgent} />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="btnrow top">
            <Btn type="submit" icon="send" loading={busy}>إرسال للجميع</Btn>
          </div>
        </form>
      </Tile>
      <Tile className="full" title="الإعلانات السابقة" icon="list" right={source === 'local' ? <Tag tone="gray">المرسلة من هذا الجهاز</Tag> : undefined}>
        {list.length === 0 && <Empty icon="megaphone" title="لا إعلانات بعد" />}
        <div className="list">
          {list.map((a) => (
            <div className="row" key={a.id} style={{ alignItems: 'flex-start' }}>
              <span className="grow">
                <b>{a.title}</b>
                <span className="small wrap-text" style={{ display: 'block' }}>{a.body}</span>
                <small>{fmtWhen(a.created_at)}{a.notified ? ` · ${count(a.notified, a.school_id === null ? NOUNS.school : NOUNS.guardian)}` : ''}</small>
              </span>
              {a.school_id === null ? <Tag tone="teal">تعميم المديرية</Tag> : a.urgent ? <Tag tone="red">عاجل</Tag> : <Tag tone="gray">إعلان</Tag>}
            </div>
          ))}
        </div>
      </Tile>
    </>
  );
}

/* School: absences board (approve a substitute or mark self-study) and the
   «تسجيل غياب معلّم» form. */

import { useState, type FormEvent } from 'react';
import * as api from '../api';
import { EngineResult } from '../components/EngineResult';
import { Btn, DateField, Empty, ErrorBox, Field, PageHead, Skeleton, Tag, Tile } from '../components/Ui';
import { addDays, ar, count, fmtDate, lastSchoolDay, NOUNS, periodName, SUBSTITUTION_LABEL, teacherTitle, todayISO } from '../format';
import { useApi } from '../hooks';
import { navigate, useRoute } from '../router';
import { refreshUnread, toast } from '../store';
import { useSchoolTeachers } from '../teachers';
import type { AbsenceResult, SchoolAbsence, SchoolDashboard, SchoolSubstitution } from '../types';

function SubstitutionCard({ absence, sub, onDone }: { absence: SchoolAbsence; sub: SchoolSubstitution; onDone: () => void }) {
  const { teachers } = useSchoolTeachers();
  const [teacherId, setTeacherId] = useState<number | null>(sub.candidates[0]?.teacher_id ?? null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'self' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const chosen = sub.candidates.find((c) => c.teacher_id === teacherId) ?? teachers?.find((t) => t.id === teacherId);
  const chosenName = chosen ? ('name' in chosen ? chosen.name : '') : '';
  const settled = sub.status === 'approved' || sub.status === 'self_study';

  const approve = async () => {
    if (!teacherId) { setError('يلزم اختيار المعلّم البديل'); return; }
    setBusy('approve');
    setError(null);
    try {
      const res = await api.post<{ notified?: number }>(`/api/substitutions/${sub.id}/approve`, { teacher_id: teacherId, lesson_note: note.trim() || undefined }, { queueable: false });
      const n = 'queued' in res ? 0 : res.notified ?? 0;
      toast(`اعتُمد ${teacherTitle(chosenName)} بديلاً في ${periodName(sub.period)} مع ${sub.section_label}، وأُبلغ الطلاب وأولياء الأمور${n ? ` (${ar(n)})` : ''}`, 'ok', 5000);
      onDone();
      void refreshUnread();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر الاعتماد');
    } finally {
      setBusy(null);
    }
  };
  const selfStudy = async () => {
    if (!note.trim()) { setError('تلزم ملاحظة النشاط الذاتي الموجَّه (ما الذي يعمل عليه الطلاب؟)'); return; }
    setBusy('self');
    setError(null);
    try {
      await api.post(`/api/substitutions/${sub.id}/self-study`, { lesson_note: note.trim() }, { queueable: false });
      toast(`سُجّلت ${periodName(sub.period)} مع ${sub.section_label} تعلّماً ذاتياً موجَّهاً، وأُبلغ الطلاب وأولياء الأمور`, 'ok', 5000);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر التسجيل');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`row ${settled ? 'ok' : 'hl'}`} style={{ alignItems: 'flex-start', flexWrap: 'wrap' }} data-sub={sub.id}>
      <span className="pnum num" aria-hidden="true">{ar(sub.period)}</span>
      <span className="grow" style={{ minWidth: 200 }}>
        <b>{periodName(sub.period)} · {sub.section_label}{sub.subject ? ` · ${sub.subject}` : ''}</b>
        {sub.status === 'approved' && <small>البديل: {teacherTitle(sub.substitute)}{sub.lesson_note ? ` · خطّة الدرس: ${sub.lesson_note}` : ''}</small>}
        {sub.status === 'self_study' && <small>تعلّم ذاتي موجَّه{sub.lesson_note ? `: ${sub.lesson_note}` : ''}</small>}
        {!settled && (
          <span className="stack" style={{ marginTop: 8 }}>
            {sub.candidates.length ? (
              <span className="chips">
                {sub.candidates.map((c, i) => (
                  <button type="button" key={c.teacher_id} className={`chip cand ${i === 0 ? 'tier1' : ''}`} aria-pressed={teacherId === c.teacher_id && !manual} onClick={() => { setTeacherId(c.teacher_id); setManual(false); }}>
                    <span className="cand-h"><span className="dot" aria-hidden="true" />{teacherTitle(c.name)}</span>
                    <small>{c.subject} · {c.reason}</small>
                  </button>
                ))}
                <button type="button" className="chip" aria-pressed={manual} onClick={() => { setManual(true); setTeacherId(null); }}>معلّم آخر…</button>
              </span>
            ) : (
              <span><Tag tone="sun">لا بديل متاح — تعلّم ذاتي موجَّه</Tag> <button type="button" className="chip" aria-pressed={manual} onClick={() => setManual(!manual)} style={{ marginInlineStart: 6 }}>تكليف معلّم يدوياً…</button></span>
            )}
            {sub.note && <small className="muted wrap-text" data-note style={{ display: 'block', lineHeight: 1.5 }}>{sub.note}</small>}
            {manual && (
              <select className="input" value={teacherId ?? ''} onChange={(e) => setTeacherId(Number(e.target.value) || null)} aria-label="اختيار معلّم">
                <option value="">— اختر المعلّم —</option>
                {(teachers ?? []).filter((t) => t.name !== absence.teacher).map((t) => <option key={t.id} value={t.id}>{teacherTitle(t.name)} · {t.subject}</option>)}
              </select>
            )}
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="خطّة الدرس أو النشاط المطلوب (مثال: دورة الماء في الطبيعة، ص ٢٧)" maxLength={160} aria-label="ملاحظة الدرس" />
            {error && <span className="error" role="alert">{error}</span>}
            <span className="btnrow top">
              <Btn size="sm" icon="check" loading={busy === 'approve'} disabled={!teacherId || busy === 'self'} onClick={() => { void approve(); }}>اعتماد{chosenName ? ` ${teacherTitle(chosenName)}` : ''}</Btn>
              <Btn size="sm" variant="light" icon="book" loading={busy === 'self'} disabled={busy === 'approve'} onClick={() => { void selfStudy(); }}>تسجيل تعلّم ذاتي</Btn>
            </span>
          </span>
        )}
      </span>
      <Tag tone={sub.status === 'approved' ? 'mint' : sub.status === 'self_study' ? 'violet' : 'sun'}>{SUBSTITUTION_LABEL[sub.status]}</Tag>
    </div>
  );
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function SchoolAbsences() {
  const today = todayISO();
  const route = useRoute();
  // A notification about an absence or a changed period links here with ?date=.
  const [date, setDate] = useState(() => { const q = route.query.get('date'); return q && ISO.test(q) ? q : lastSchoolDay(today); });
  const { data, error, loading, reload } = useApi<SchoolDashboard>(`/api/school/dashboard?date=${date}`);
  const absences = data?.absences ?? [];
  const uncovered = absences.flatMap((a) => a.substitutions).filter((x) => x.status === 'suggested' || x.status === 'uncovered').length;
  return (
    <>
      <PageHead
        title="لوحة الغياب والتغطية"
        sub={data ? (absences.length ? `غياب ${count(absences.length, NOUNS.teacher)} · ${uncovered ? `${count(uncovered, NOUNS.period)} بانتظار الاعتماد` : 'كلّ الحصص مغطّاة'}` : 'لا غياب بين المعلّمين') : undefined}
        actions={
          <>
            <DateField compact value={date} onChange={setDate} min={addDays(today, -30)} max={addDays(today, 14)} />
            <Btn size="sm" icon="plus" onClick={() => navigate('/school/absences/new')}>تسجيل غياب معلّم</Btn>
          </>
        }
      />
      {loading && !data && <Tile className="full"><Skeleton lines={4} /></Tile>}
      {error && !data && <Tile className="full"><ErrorBox error={error} retry={reload} /></Tile>}
      {data && absences.length === 0 && <Tile className="full"><Empty icon="check" title={`لا غياب ${date === today ? 'اليوم' : fmtDate(date)}`} text="عند تسجيل غياب معلّم يقترح النظام البديل هنا." /></Tile>}
      {absences.map((a) => (
        <Tile key={a.absence_id} className="full" title={`${teacherTitle(a.teacher)} · ${a.subject}`} icon="alert" color="var(--sun)" right={a.reason ? <Tag tone="gray">{a.reason}</Tag> : undefined}>
          {a.substitutions.length === 0 && <p className="small muted">لا حصص لهذا المعلّم في هذا اليوم.</p>}
          <div className="list">
            {a.substitutions.map((x) => <SubstitutionCard key={x.id} absence={a} sub={x} onDone={reload} />)}
          </div>
        </Tile>
      ))}
    </>
  );
}

export function SchoolAbsenceNew() {
  const today = todayISO();
  const { teachers, error: tErr } = useSchoolTeachers();
  const [teacherId, setTeacherId] = useState<number>(0);
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AbsenceResult | null>(null);
  const teacher = teachers?.find((t) => t.id === teacherId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!teacherId) { setError('يلزم اختيار المعلّم'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<AbsenceResult & { existing?: boolean }>('/api/absences', { teacher_id: teacherId, date, reason: reason.trim() || undefined }, { queueable: false });
      if ('queued' in res) return;
      setResult(res);
      toast(res.existing ? 'الغياب مسجّل مسبقاً — هذه نتيجة الترتيب' : 'سُجّل الغياب واقتُرح البديل', res.existing ? 'info' : 'ok');
      void refreshUnread();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تسجيل الغياب');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="تسجيل غياب معلّم" back="/school/absences" sub="يرتّب النظام البديل ويعرضه في لوحة الغياب" />
      {!result && (
        <Tile className="full" title="بيانات الغياب" icon="alert" color="var(--sun)">
          {tErr && <ErrorBox error={tErr} />}
          <form onSubmit={submit} className="stack">
            <div className="fields">
              <Field label="المعلّم" className="full">
                <select className="input" value={teacherId} onChange={(e) => setTeacherId(Number(e.target.value))} required>
                  <option value={0}>{teachers ? '— اختر المعلّم —' : 'جارٍ التحميل…'}</option>
                  {(teachers ?? []).map((t) => <option key={t.id} value={t.id}>{teacherTitle(t.name)} · {t.subject}</option>)}
                </select>
              </Field>
              <div className="field full">
                <DateField label="التاريخ" value={date} onChange={setDate} min={addDays(today, -7)} max={addDays(today, 14)} required />
              </div>
              <Field label="السبب (اختياري)" className="full">
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: مرض" maxLength={80} />
              </Field>
            </div>
            {error && <div className="error" role="alert">{error}</div>}
            <div className="btnrow top">
              <Btn type="submit" icon="send" loading={busy} color="var(--sun)">تسجيل الغياب واقتراح البديل</Btn>
              <Btn type="button" variant="light" onClick={() => navigate('/school/absences')}>إلغاء</Btn>
            </div>
          </form>
        </Tile>
      )}
      {result && (
        <Tile className="full" title="نتيجة الترتيب" icon="check" color="var(--mint)">
          <EngineResult result={result} who={teacherTitle(teacher?.name)} dateLabel={date === today ? 'اليوم' : `يوم ${fmtDate(date)}`} />
          <div className="btnrow">
            <Btn icon="alert" onClick={() => navigate('/school/absences')}>فتح لوحة الغياب للاعتماد</Btn>
          </div>
        </Tile>
      )}
    </>
  );
}

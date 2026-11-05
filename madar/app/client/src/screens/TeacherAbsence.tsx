import { useState, type FormEvent } from 'react';
import * as api from '../api';
import { EngineResult } from '../components/EngineResult';
import { Btn, Field, PageHead, Tile } from '../components/Ui';
import { addDays, fmtDate, todayISO } from '../format';
import { navigate } from '../router';
import { toast, useStore } from '../store';
import type { AbsenceResult } from '../types';

const REASONS = ['مرض', 'ظرف عائلي', 'مهمّة رسمية', 'إجازة'];

export function TeacherAbsence() {
  const s = useStore();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AbsenceResult | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<AbsenceResult & { existing?: boolean }>('/api/absences', { date, reason: reason.trim() || undefined }, { queueable: false });
      if ('queued' in res) return;
      setResult(res);
      toast(res.existing ? 'سُجّل غيابك لهذا اليوم مسبقاً — هذه نتيجة الترتيب' : 'سُجّل غيابك وأُبلغت الإدارة', res.existing ? 'info' : 'ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تسجيل الغياب');
    } finally {
      setBusy(false);
    }
  };

  const dateLabel = date === today ? 'اليوم' : date === addDays(today, 1) ? 'غداً' : `يوم ${fmtDate(date)}`;

  return (
    <>
      <PageHead title="الإبلاغ عن غياب" back="/teacher" sub="سجّل غيابك ودع النظام يرتّب البديل ويبلّغ الإدارة" />
      {!result && (
        <Tile className="full" title="بيانات الغياب" icon="alert" color="var(--sun)">
          <form onSubmit={submit} className="stack">
            <div className="fields">
              <Field label="التاريخ" hint={fmtDate(date)}>
                <input className="input" type="date" value={date} min={addDays(today, -1)} max={addDays(today, 14)} onChange={(e) => setDate(e.target.value)} required />
              </Field>
              <Field label="السبب (اختياري)">
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: مرض" maxLength={80} />
              </Field>
            </div>
            <div className="chips">
              {REASONS.map((r) => (
                <button type="button" key={r} className="chip" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>
              ))}
            </div>
            {error && <div className="error" role="alert">{error}</div>}
            <div className="btnrow top">
              <Btn type="submit" icon="send" loading={busy} color="var(--sun)">إبلاغ الإدارة</Btn>
              <Btn type="button" variant="light" onClick={() => navigate('/teacher')}>إلغاء</Btn>
            </div>
          </form>
        </Tile>
      )}
      {result && (
        <Tile className="full" title="نتيجة الترتيب" icon="check" color="var(--mint)">
          <EngineResult result={result} who={s.user?.name ? `أ. ${s.user.name}` : 'المعلّم'} dateLabel={dateLabel} />
          <div className="btnrow">
            <Btn icon="home" onClick={() => navigate('/teacher')}>العودة إلى الرئيسية</Btn>
          </div>
        </Tile>
      )}
    </>
  );
}

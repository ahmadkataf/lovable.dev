/* Attendance roster: present / absent / late per student, then save
   (queued in the outbox when offline). Shared by the teacher and the school.
   Statuses start from what the server already holds for that period, then from
   this browser's last save of it, and only then from «everyone present». */

import { useMemo, useState } from 'react';
import * as api from '../api';
import { ar, fmtDate, periodName } from '../format';
import { toast } from '../store';
import type { AttendanceRecord, AttendanceResponse } from '../types';
import { Btn, Tag } from './Ui';

type Status = AttendanceRecord['status'];
const OPTIONS: { v: Status; label: string }[] = [
  { v: 'present', label: 'حاضر' },
  { v: 'absent', label: 'غائب' },
  { v: 'late', label: 'متأخّر' },
];
const isStatus = (v: unknown): v is Status => v === 'present' || v === 'absent' || v === 'late';

function localKey(sectionId: number, date: string, period: number) {
  return `att:${sectionId}:${date}:${period}`;
}

export function Roster({ sectionId, sectionLabel, period, date, students, saved, alreadyTaken, onSaved }: {
  sectionId: number;
  sectionLabel: string;
  period: number;
  date: string;
  students: { id: number; name: string }[];
  /** Statuses the server already holds for this date/period (from GET /api/sections/:id/roster). */
  saved?: Record<number, Status | null | undefined>;
  alreadyTaken?: boolean;
  onSaved?: (counts: AttendanceResponse | api.Queued) => void;
}) {
  const initial = useMemo(() => {
    const map: Record<number, Status> = {};
    let local: Record<string, unknown> | null = null;
    try { const raw = localStorage.getItem(localKey(sectionId, date, period)); local = raw ? (JSON.parse(raw) as Record<string, unknown>) : null; } catch { local = null; }
    for (const s of students) {
      const fromServer = saved?.[s.id];
      const fromLocal = local?.[String(s.id)];
      map[s.id] = isStatus(fromServer) ? fromServer : isStatus(fromLocal) ? fromLocal : 'present';
    }
    return map;
  }, [sectionId, date, period, students, saved]);
  const [statuses, setStatuses] = useState<Record<number, Status>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const t = { present: 0, absent: 0, late: 0 };
    for (const s of students) t[statuses[s.id] ?? 'present']++;
    return t;
  }, [students, statuses]);

  const setAll = (v: Status) => {
    const next: Record<number, Status> = {};
    for (const s of students) next[s.id] = v;
    setStatuses(next);
  };

  const save = async () => {
    setError(null);
    // Never send a record without a student id: the server would refuse the whole roster («طالب خارج الشعبة»).
    if (!students.length || students.some((s) => !Number.isInteger(s.id) || s.id <= 0)) {
      setError('تعذّر تحديد طلاب الشعبة — يلزم إعادة تحميل الشاشة ثم المحاولة مجدّداً');
      return;
    }
    setBusy(true);
    try {
      const records: AttendanceRecord[] = students.map((s) => ({ student_id: s.id, status: statuses[s.id] ?? 'present' }));
      const res = await api.post<AttendanceResponse>('/api/attendance', { section_id: sectionId, date, period, records });
      try { localStorage.setItem(localKey(sectionId, date, period), JSON.stringify(Object.fromEntries(records.map((r) => [r.student_id, r.status])))); } catch { /* ignore */ }
      if ('queued' in res && res.queued) toast('لا اتصال — حُفظ الحضور وسيُرسل تلقائياً عند عودة الاتصال', 'info', 5000);
      else toast(`حُفظ حضور ${periodName(period)}: الحاضرون ${ar(totals.present)} · الغائبون ${ar(totals.absent)} · المتأخّرون ${ar(totals.late)}`);
      onSaved?.(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="inline" style={{ justifyContent: 'space-between' }}>
        <div className="small muted">
          شعبة {sectionLabel} · {periodName(period)} · {fmtDate(date)}
        </div>
        <div className="inline">
          <Tag tone="mint">حاضر {ar(totals.present)}</Tag>
          <Tag tone="red">غائب {ar(totals.absent)}</Tag>
          <Tag tone="sun">متأخّر {ar(totals.late)}</Tag>
        </div>
      </div>
      {alreadyTaken && <div className="notice">سُجّل حضور هذه الحصّة مسبقاً — الحالات المعروضة هي المحفوظة، والحفظ يستبدلها.</div>}
      <div className="btnrow top">
        <Btn variant="light" size="sm" onClick={() => setAll('present')}>الكلّ حاضر</Btn>
      </div>
      <div className="list" role="list">
        {students.map((s, i) => (
          <div className={`row ${statuses[s.id] === 'absent' ? 'bad' : statuses[s.id] === 'late' ? 'hl' : ''}`} key={s.id} role="listitem">
            <span className="pnum num" aria-hidden="true">{ar(i + 1)}</span>
            <span className="grow"><b>{s.name}</b></span>
            <div className="seg" role="group" aria-label={`حالة ${s.name}`}>
              {OPTIONS.map((o) => (
                <button
                  type="button"
                  key={o.v}
                  className={o.v}
                  aria-pressed={statuses[s.id] === o.v}
                  onClick={() => setStatuses((st) => ({ ...st, [s.id]: o.v }))}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="btnrow">
        <Btn icon="check" loading={busy} onClick={() => { void save(); }}>حفظ الحضور</Btn>
      </div>
    </div>
  );
}

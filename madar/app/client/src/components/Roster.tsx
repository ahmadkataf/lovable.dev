/* Attendance roster: present / absent / late per student, then save
   (queued in the outbox when offline). Shared by the teacher and the school. */

import { useMemo, useState } from 'react';
import * as api from '../api';
import { ar, count, fmtDate, NOUNS, periodName } from '../format';
import { toast } from '../store';
import type { AttendanceRecord, AttendanceResponse } from '../types';
import { Btn, Tag } from './Ui';

type Status = AttendanceRecord['status'];
const OPTIONS: { v: Status; label: string }[] = [
  { v: 'present', label: 'حاضر' },
  { v: 'absent', label: 'غائب' },
  { v: 'late', label: 'متأخّر' },
];

function localKey(sectionId: number, date: string, period: number) {
  return `att:${sectionId}:${date}:${period}`;
}

export function Roster({ sectionId, sectionLabel, period, date, students, alreadyTaken, onSaved }: {
  sectionId: number;
  sectionLabel: string;
  period: number;
  date: string;
  students: { id: number; name: string }[];
  alreadyTaken?: boolean;
  onSaved?: (counts: AttendanceResponse | api.Queued) => void;
}) {
  const initial = useMemo(() => {
    const map: Record<number, Status> = {};
    let saved: Record<string, Status> | null = null;
    try { const raw = localStorage.getItem(localKey(sectionId, date, period)); saved = raw ? (JSON.parse(raw) as Record<string, Status>) : null; } catch { saved = null; }
    for (const s of students) map[s.id] = saved?.[String(s.id)] ?? 'present';
    return map;
  }, [sectionId, date, period, students]);
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
    setBusy(true);
    setError(null);
    try {
      const records: AttendanceRecord[] = students.map((s) => ({ student_id: s.id, status: statuses[s.id] ?? 'present' }));
      const res = await api.post<AttendanceResponse>('/api/attendance', { section_id: sectionId, date, period, records });
      try { localStorage.setItem(localKey(sectionId, date, period), JSON.stringify(Object.fromEntries(records.map((r) => [r.student_id, r.status])))); } catch { /* ignore */ }
      if ('queued' in res && res.queued) toast('لا اتصال — حُفظ الحضور وسيُرسل تلقائياً عند عودة الاتصال', 'info', 5000);
      else toast(`حُفظ حضور ${periodName(period)}: ${count(totals.present, NOUNS.student)} حاضرون، ${ar(totals.absent)} غائب، ${ar(totals.late)} متأخّر`);
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
          الشعبة {sectionLabel} · {periodName(period)} · {fmtDate(date)}
        </div>
        <div className="inline">
          <Tag tone="mint">حاضر {ar(totals.present)}</Tag>
          <Tag tone="red">غائب {ar(totals.absent)}</Tag>
          <Tag tone="sun">متأخّر {ar(totals.late)}</Tag>
        </div>
      </div>
      {alreadyTaken && <div className="notice">سُجّل حضور هذه الحصّة مسبقاً — الحفظ يستبدل السجلّ السابق.</div>}
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

/* School: attendance entry (section → period → roster) and «تثبيت حضور اليوم». */

import { useMemo, useState } from 'react';
import * as api from '../api';
import { Roster } from '../components/Roster';
import { Btn, ErrorBox, PageHead, Skeleton, Tile } from '../components/Ui';
import { ar, count, fmtDate, NOUNS, periodName, showDay } from '../format';
import { useApi } from '../hooks';
import { toast } from '../store';
import { rosterStudents, type RosterResponse, type SchoolDashboard, type SectionWithStudents } from '../types';

/** «رسالة نصّية واحدة» / «رسالتان نصّيتان» / «٣ رسائل نصّية» / «١٢ رسالة نصّية». */
function smsCount(n: number): string {
  if (n === 1) return 'رسالة نصّية واحدة';
  if (n === 2) return 'رسالتان نصّيتان';
  return `${count(n, NOUNS.message)} نصّية`;
}

export function SchoolAttendance() {
  const today = showDay();   // weekend → the last school day
  const sections = useApi<SectionWithStudents[]>('/api/school/sections');
  const dash = useApi<SchoolDashboard>(`/api/school/dashboard?date=${today}`);
  const [sectionId, setSectionId] = useState<number>(0);
  const [period, setPeriod] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const section = sections.data?.find((x) => x.id === sectionId) ?? null;
  // Statuses already saved for this period seed the roster (T3), so a second save never flips an absence back.
  const roster = useApi<RosterResponse>(section && period > 0 ? `/api/sections/${section.id}/roster?date=${today}&period=${period}` : null);
  const students = useMemo(() => rosterStudents(roster.data?.students ?? section?.students), [roster.data, section]);
  const saved = useMemo(() => {
    const m: Record<number, RosterResponse['students'][number]['status']> = {};
    for (const st of roster.data?.students ?? []) { const id = Number(st.id ?? st.student_id); if (id) m[id] = st.status; }
    return m;
  }, [roster.data]);
  const rosterReady = roster.data !== null || !!roster.error;

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ confirmed?: number; sms?: number }>('/api/attendance/confirm', { date: today }, { queueable: false });
      const n = 'queued' in res ? 0 : res.sms ?? 0;
      // The server's own sentence is the honest one (in-app notices + simulated text messages in the demo version).
      const msg = 'queued' in res ? undefined : (res as { message?: string }).message;
      toast(msg ?? `ثُبّت حضور اليوم${n ? ` — ${smsCount(n)} (محاكاة في نسخة العرض)` : ''}`, 'ok', 6000);
      dash.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'تعذّر التثبيت', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="إدخال الحضور" sub={`${fmtDate(today)} · يُدخله أمين السرّ أو المعاون عن المعلّم`} />
      <Tile className="full" title="الشعبة والحصّة" icon="users">
        {sections.loading && !sections.data && <Skeleton lines={2} />}
        {sections.error && !sections.data && <ErrorBox error={sections.error} retry={sections.reload} />}
        {sections.data && (
          <div className="stack">
            <div className="chips">
              {sections.data.map((x) => (
                <button type="button" key={x.id} className="chip" aria-pressed={sectionId === x.id} onClick={() => { setSectionId(x.id); setPeriod(0); }}>
                  {x.label}<small>{count(x.students.length, NOUNS.student)}</small>
                </button>
              ))}
            </div>
            {section && (
              <div className="chips">
                {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                  <button type="button" key={p} className="chip" aria-pressed={period === p} onClick={() => setPeriod(p)}>{periodName(p)}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </Tile>
      {section && period > 0 && (
        <Tile className="full" title={`سجلّ ${section.label}`} icon="list">
          {!rosterReady && <Skeleton lines={5} />}
          {rosterReady && (
            <Roster key={`${section.id}-${period}-${roster.data ? 'server' : 'local'}`} sectionId={section.id} sectionLabel={section.label} period={period} date={today}
              students={students} saved={saved} alreadyTaken={Object.values(saved).some(Boolean)} onSaved={() => { dash.reload(); roster.reload(); }} />
          )}
        </Tile>
      )}
      <Tile className="full" title="تثبيت حضور اليوم" icon="shield" color="var(--teal)">
        <p className="small muted" style={{ marginBottom: 10 }}>
          بعد التثبيت تُرسل إشعارات الغياب إلى أولياء الأمور برسالة نصّية لمن لا يملك التطبيق؛ قبل التثبيت تبقى في التطبيق فقط.
          {dash.data ? ` حضور اليوم: ${ar(dash.data.present)} من ${ar(dash.data.students)}.` : ''}
        </p>
        <div className="btnrow top">
          <Btn icon="check" loading={busy} onClick={() => { void confirm(); }} color="var(--teal)" disabled={dash.data?.attendance_confirmed}>
            {dash.data?.attendance_confirmed ? 'ثُبّت حضور اليوم ✓' : 'تثبيت حضور اليوم'}
          </Btn>
        </div>
      </Tile>
    </>
  );
}

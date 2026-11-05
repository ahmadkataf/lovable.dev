/* School: attendance entry (section → period → roster) and «تثبيت حضور اليوم». */

import { useState } from 'react';
import * as api from '../api';
import { Roster } from '../components/Roster';
import { Btn, ErrorBox, PageHead, Skeleton, Tile } from '../components/Ui';
import { ar, fmtDate, periodName, todayISO } from '../format';
import { useApi } from '../hooks';
import { toast } from '../store';
import type { SchoolDashboard, SectionWithStudents } from '../types';

export function SchoolAttendance() {
  const today = todayISO();
  const sections = useApi<SectionWithStudents[]>('/api/school/sections');
  const dash = useApi<SchoolDashboard>(`/api/school/dashboard?date=${today}`);
  const [sectionId, setSectionId] = useState<number>(0);
  const [period, setPeriod] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const section = sections.data?.find((x) => x.id === sectionId) ?? null;

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ confirmed?: number; sms?: number }>('/api/attendance/confirm', { date: today }, { queueable: false });
      const n = 'queued' in res ? 0 : res.sms ?? 0;
      toast(`ثُبّت حضور اليوم${n ? ` — أُرسلت رسائل SMS عن الغياب إلى أولياء الأمور (${ar(n)})` : ''}`, 'ok', 5000);
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
                <button type="button" key={x.id} className="chip" aria-pressed={sectionId === x.id} onClick={() => setSectionId(x.id)}>
                  {x.label}<small>{ar(x.students.length)} طالباً</small>
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
          <Roster key={`${section.id}-${period}`} sectionId={section.id} sectionLabel={section.label} period={period} date={today} students={section.students} onSaved={() => dash.reload()} />
        </Tile>
      )}
      <Tile className="full" title="تثبيت حضور اليوم" icon="shield" color="var(--teal)">
        <p className="small muted" style={{ marginBottom: 10 }}>
          بعد التثبيت تُرسل إشعارات الغياب إلى أولياء الأمور برسالة SMS لمن لا يملك التطبيق؛ قبل التثبيت تبقى في التطبيق فقط.
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

import { useState } from 'react';
import { Roster } from '../components/Roster';
import { Btn, ErrorBox, PageHead, Skeleton, Tile } from '../components/Ui';
import { ar, fmtDate, todayISO } from '../format';
import { useApi } from '../hooks';
import { navigate, useRoute } from '../router';
import type { SectionWithStudents, TeacherHome } from '../types';

export function TeacherAttendance() {
  const route = useRoute();
  const sectionId = Number(route.query.get('section') ?? 0);
  const periodParam = Number(route.query.get('period') ?? 0);
  const [period, setPeriod] = useState<number>(periodParam || 0);
  const today = todayISO();
  const sections = useApi<SectionWithStudents[]>('/api/school/sections');
  const home = useApi<TeacherHome>('/api/teacher/home');
  const section = sections.data?.find((x) => x.id === sectionId) ?? null;
  const todayRows = (home.data?.today.periods ?? []).filter((p) => p.section_id === sectionId);
  const alreadyTaken = todayRows.find((p) => p.period === period)?.attendance_taken ?? false;

  return (
    <>
      <PageHead title="تسجيل الحضور" back="/teacher" sub={section ? `الشعبة ${section.label} · ${fmtDate(today)}` : fmtDate(today)} />
      <Tile className="full">
        {sections.loading && !sections.data && <Skeleton lines={5} />}
        {sections.error && !sections.data && <ErrorBox error={sections.error} retry={sections.reload} />}
        {sections.data && !section && (
          <div className="stack">
            <p className="small muted">اختر الشعبة:</p>
            <div className="chips">
              {sections.data.map((x) => (
                <button type="button" key={x.id} className="chip" onClick={() => navigate(`/teacher/attendance?section=${x.id}${period ? `&period=${period}` : ''}`, { replace: true })}>
                  {x.label}<small>{ar(x.students.length)} طالباً</small>
                </button>
              ))}
            </div>
          </div>
        )}
        {section && !period && (
          <div className="stack">
            <p className="small muted">اختر الحصّة:</p>
            <div className="chips">
              {(todayRows.length ? todayRows.map((p) => p.period) : [1, 2, 3, 4, 5, 6]).map((p) => (
                <button type="button" key={p} className="chip" onClick={() => { setPeriod(p); navigate(`/teacher/attendance?section=${sectionId}&period=${p}`, { replace: true }); }}>
                  الحصّة {ar(p)}
                </button>
              ))}
            </div>
          </div>
        )}
        {section && period > 0 && (
          <Roster
            sectionId={section.id}
            sectionLabel={section.label}
            period={period}
            date={today}
            students={section.students}
            alreadyTaken={alreadyTaken}
            onSaved={() => { home.reload(); navigate('/teacher'); }}
          />
        )}
      </Tile>
      {section && period > 0 && (
        <div className="full">
          <Btn variant="ghost" size="sm" onClick={() => { setPeriod(0); navigate(`/teacher/attendance?section=${sectionId}`, { replace: true }); }}>تغيير الحصّة</Btn>
        </div>
      )}
    </>
  );
}

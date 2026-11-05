import { useMemo, useState } from 'react';
import { Roster } from '../components/Roster';
import { Btn, ErrorBox, PageHead, Skeleton, Tile } from '../components/Ui';
import { count, fmtDate, NOUNS, periodName, showDay } from '../format';
import { useApi } from '../hooks';
import { navigate, useRoute } from '../router';
import { rosterStudents, type RosterResponse, type SectionWithStudents, type TeacherHome } from '../types';

export function TeacherAttendance() {
  const route = useRoute();
  const sectionId = Number(route.query.get('section') ?? 0);
  const periodParam = Number(route.query.get('period') ?? 0);
  const [period, setPeriod] = useState<number>(periodParam || 0);
  const today = showDay();   // on the weekend: the last school day, like the home screen
  const sections = useApi<SectionWithStudents[]>('/api/school/sections');
  const home = useApi<TeacherHome>(`/api/teacher/home?date=${today}`);
  const section = sections.data?.find((x) => x.id === sectionId) ?? null;
  const todayRows = (home.data?.today.periods ?? []).filter((p) => p.section_id === sectionId);
  // The statuses already saved for this period (if any) seed the roster, so re-saving never overwrites an absence.
  const roster = useApi<RosterResponse>(section && period > 0 ? `/api/sections/${section.id}/roster?date=${today}&period=${period}` : null);
  const students = useMemo(() => rosterStudents(roster.data?.students ?? section?.students), [roster.data, section]);
  const saved = useMemo(() => {
    const m: Record<number, RosterResponse['students'][number]['status']> = {};
    for (const st of roster.data?.students ?? []) { const id = Number(st.id ?? st.student_id); if (id) m[id] = st.status; }
    return m;
  }, [roster.data]);
  const rosterReady = roster.data !== null || !!roster.error;
  const alreadyTaken = (todayRows.find((p) => p.period === period)?.attendance_taken ?? false) || Object.values(saved).some(Boolean);

  return (
    <>
      <PageHead title="تسجيل الحضور" back="/teacher" sub={section ? `شعبة ${section.label} · ${fmtDate(today)}` : fmtDate(today)} />
      <Tile className="full">
        {sections.loading && !sections.data && <Skeleton lines={5} />}
        {sections.error && !sections.data && <ErrorBox error={sections.error} retry={sections.reload} />}
        {sections.data && !section && (
          <div className="stack">
            <p className="small muted">الشعبة:</p>
            <div className="chips">
              {sections.data.map((x) => (
                <button type="button" key={x.id} className="chip" onClick={() => navigate(`/teacher/attendance?section=${x.id}${period ? `&period=${period}` : ''}`, { replace: true })}>
                  {x.label}<small>{count(x.students.length, NOUNS.student)}</small>
                </button>
              ))}
            </div>
          </div>
        )}
        {section && !period && (
          <div className="stack">
            <p className="small muted">الحصّة:</p>
            <div className="chips">
              {(todayRows.length ? todayRows.map((p) => p.period) : [1, 2, 3, 4, 5, 6]).map((p) => (
                <button type="button" key={p} className="chip" onClick={() => { setPeriod(p); navigate(`/teacher/attendance?section=${sectionId}&period=${p}`, { replace: true }); }}>
                  {periodName(p)}
                </button>
              ))}
            </div>
          </div>
        )}
        {section && period > 0 && !rosterReady && <Skeleton lines={5} />}
        {section && period > 0 && rosterReady && (
          <Roster
            key={`${section.id}-${period}-${roster.data ? 'server' : 'local'}`}
            sectionId={section.id}
            sectionLabel={section.label}
            period={period}
            date={today}
            students={students}
            saved={saved}
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

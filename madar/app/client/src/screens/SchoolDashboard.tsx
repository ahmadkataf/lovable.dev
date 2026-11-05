import { useState } from 'react';
import { Btn, ChartRow, Empty, ErrorBox, Kpi, PageHead, Skeleton, Tag, Tile } from '../components/Ui';
import { ar, count, fmtDate, gradeShort, NOUNS, pct, periodOrdinal, SUBSTITUTION_LABEL, teacherTitle, todayISO } from '../format';
import { useApi } from '../hooks';
import { Link, navigate } from '../router';
import { useStore } from '../store';
import type { SchoolContext, SchoolDashboard as SchoolDashboardData } from '../types';

export function SchoolDashboard() {
  const s = useStore();
  const ctx = s.context as SchoolContext | null;
  const today = todayISO();
  const [date, setDate] = useState(today);
  const { data, error, loading, reload } = useApi<SchoolDashboardData>(`/api/school/dashboard?date=${date}`);
  const uncovered = data?.uncovered_periods ?? 0;
  return (
    <>
      <PageHead
        title={ctx?.school.name ?? s.user?.school_name ?? 'لوحة المدرسة'}
        sub={data ? `${count(data.students, NOUNS.student)} · ${count(data.teachers, NOUNS.teacher)} · ${fmtDate(date)}` : fmtDate(date)}
        actions={<input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} aria-label="التاريخ" style={{ width: 'auto', minHeight: 40 }} />}
      />
      {error && !data && <Tile className="full"><ErrorBox error={error} retry={reload} /></Tile>}
      {loading && !data && <Tile className="full"><Skeleton lines={3} /></Tile>}
      {data && (
        <>
          <div className="kpis full">
            <Kpi value={pct(data.present_pct)} label={`حضور الطلاب (${ar(data.present)} / ${ar(data.students)})`} tone={data.present_pct >= 90 ? 'good' : 'warn'} />
            <Kpi value={`${ar(data.teachers_present)} / ${ar(data.teachers)}`} label="المعلّمون الحاضرون" />
            <Kpi value={ar(uncovered)} label={uncovered === 1 ? 'حصّة بلا تغطية' : 'حصص بلا تغطية'} tone={uncovered ? 'warn' : 'good'} />
            <Kpi value={ar(data.homework_today)} label="واجبات نُشرت اليوم" tone="good" />
          </div>

          <Tile title="الغياب والتغطية" icon="alert" color="var(--sun)" right={<Link to="/school/absences" className="tag">لوحة الغياب</Link>} className="full">
            {data.absences.length === 0 && <Empty icon="check" title="لا غياب بين المعلّمين" text="كلّ الحصص مغطّاة بالمعلّمين الأصليين." />}
            <div className="list">
              {data.absences.flatMap((a) =>
                a.substitutions.map((x) => (
                  <Link to="/school/absences" className={`row ${x.status === 'suggested' || x.status === 'uncovered' ? 'hl' : 'ok'}`} key={x.id}>
                    <span className="pnum num" aria-hidden="true">{ar(x.period)}</span>
                    <span className="grow">
                      <b>الحصّة {periodOrdinal(x.period)} · {x.section_label} · {teacherTitle(a.teacher)} ({a.subject})</b>
                      <small>
                        {x.status === 'approved' && x.substitute ? `البديل: ${teacherTitle(x.substitute)}` : x.status === 'self_study' ? `تعلّم ذاتي موجَّه${x.lesson_note ? `: ${x.lesson_note}` : ''}` : x.candidates.length ? `مقترح: ${teacherTitle(x.candidates[0].name)} (${x.candidates[0].reason})` : 'لا بديل متاح — تعلّم ذاتي موجَّه'}
                      </small>
                    </span>
                    <Tag tone={x.status === 'approved' ? 'mint' : x.status === 'self_study' ? 'violet' : 'sun'}>{SUBSTITUTION_LABEL[x.status]}</Tag>
                  </Link>
                )),
              )}
            </div>
          </Tile>

          <Tile title="الحضور حسب الصف" icon="users">
            {data.attendance_by_grade.length === 0 && <p className="small muted">لم يُسجَّل حضور بعد.</p>}
            <div className="chart">
              {data.attendance_by_grade.map((g) => <ChartRow key={g.grade} label={gradeShort(g.grade)} value={g.pct} />)}
            </div>
            {date === today && (
              <div className={`row ${data.attendance_confirmed ? 'ok' : 'hl'}`} style={{ marginTop: 10 }}>
                <span className="grow small">{data.attendance_confirmed ? 'ثُبّت حضور اليوم — أُرسلت رسائل الغياب إلى أولياء الأمور.' : 'لم يُثبَّت حضور اليوم بعد — تُرسل رسائل الغياب بعد التثبيت.'}</span>
                {!data.attendance_confirmed && <Btn size="sm" variant="light" onClick={() => navigate('/school/attendance')}>تثبيت</Btn>}
              </div>
            )}
          </Tile>

          <Tile title="إجراءات سريعة" icon="edit">
            <div className="btnrow top">
              <Btn icon="alert" onClick={() => navigate('/school/absences/new')}>تسجيل غياب معلّم</Btn>
              <Btn variant="light" icon="users" onClick={() => navigate('/school/attendance')}>إدخال الحضور</Btn>
              <Btn variant="light" icon="megaphone" onClick={() => navigate('/school/announcements')}>إعلان للأهالي</Btn>
            </div>
          </Tile>
        </>
      )}
    </>
  );
}

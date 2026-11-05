/* Directorate: one school's page («/directorate/school/:id?date=»): principal and phone, the day's attendance,
   every absent teacher's periods with their cover status, the uncovered list, the three-day pupils and a
   seven-day trend. Reached from the dashboard's alerts, cards and rows, and from the directorate's notifications. */

import { Avatar, ChartRow, Empty, ErrorBox, Kpi, PageHead, Skeleton, Tag, Tile } from '../components/Ui';
import * as api from '../api';
import { ar, complexLabel, consecutiveDays, count, fmtDate, fmtHM, fmtPhone, NOUNS, pct, periodName, shortDate, teacherTitle, todayISO } from '../format';
import { useApi } from '../hooks';
import { Link, useRoute } from '../router';
import type { DirectorateSchoolDay } from '../types';
import { dashboardPath, isHoliday, PERIOD_STATUS, periodStatusText, TelButton } from './DirectorateCommon';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function DirectorateSchool({ id }: { id: number }) {
  const today = todayISO();
  const route = useRoute();
  const q = route.query.get('date');
  const date = q && ISO.test(q) ? q : today;
  const back = dashboardPath(date, today);
  const holiday = isHoliday(date);
  const { data, error, reload } = useApi<DirectorateSchoolDay>(Number.isInteger(id) && id > 0 ? api.directorateUrls.school(id, date) : null);
  const dayWord = date === today ? 'اليوم' : fmtDate(date);

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <>
        <PageHead title="صفحة المدرسة" back={back} />
        <Tile className="full"><Empty icon="info" title="المدرسة غير موجودة" text={<Link to={back} className="tag">العودة إلى لوحة المديرية</Link>} /></Tile>
      </>
    );
  }

  if (error && !data) {
    return (
      <>
        <PageHead title="صفحة المدرسة" back={back} sub={fmtDate(date)} />
        <Tile className="full">
          <ErrorBox error={error} retry={reload} />
          <p className="small muted" style={{ marginTop: 10 }}><Link to={back} className="tag">العودة إلى لوحة المديرية</Link></p>
        </Tile>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHead title="صفحة المدرسة" back={back} sub={fmtDate(date)} />
        <Tile className="full"><Skeleton lines={4} /></Tile>
      </>
    );
  }

  const { school, day, absences, uncovered, three_days: three, trend } = data;
  const present = day.present + day.late;
  const uploaded = !!day.uploaded_at || day.attendance_pct !== null;
  const attendanceTone = day.attendance_pct === null ? 'muted' : day.attendance_pct >= 90 ? 'good' : 'warn';

  return (
    <>
      <PageHead
        title={school.name}
        back={back}
        sub={`${complexLabel(school.complex)} · ${count(school.students, NOUNS.student)} · ${count(school.teachers, NOUNS.teacher)} · ${fmtDate(date)}`}
      />

      <Tile className="full dir-principal">
        <div className="dir-princ">
          <Avatar name={school.principal ?? 'م'} color="var(--brand)" />
          <div className="txt">
            <b>{school.principal ? teacherTitle(school.principal) : 'مدير المدرسة'}</b>
            <small>مدير المدرسة{school.phone ? <> · <bdi className="num" dir="ltr">{fmtPhone(school.phone)}</bdi></> : ' · لا رقم هاتف مسجّل'}</small>
          </div>
          <TelButton phone={school.phone} school={school.name} label />
        </div>
      </Tile>

      <div className="kpis dir-kpis full" aria-label={`أرقام ${dayWord}`}>
        <Kpi value={pct(day.attendance_pct)} label={uploaded ? `حضور الطلاب (${ar(present)} من ${ar(school.students)})` : 'حضور الطلاب'} tone={attendanceTone} />
        <Kpi value={uploaded ? ar(day.absent) : '—'} label="غائبون" tone={uploaded ? (day.absent ? 'bad' : 'good') : 'muted'} />
        <Kpi value={uploaded ? ar(day.late) : '—'} label="متأخّرون" tone={uploaded ? undefined : 'muted'} />
        <Kpi
          value={day.uploaded_at ? fmtHM(day.uploaded_at) : uploaded ? '✓' : '—'}
          label={uploaded ? (day.confirmed ? 'رُفع الحضور ومُثبَّت' : 'رُفع الحضور ولم يُثبَّت بعد') : holiday ? 'يوم عطلة' : 'لم يُرفع الحضور'}
          tone={uploaded ? (day.confirmed ? 'good' : 'warn') : holiday ? 'muted' : 'bad'}
        />
      </div>

      <Tile className="full" title={`غياب المعلّمين والتغطية ${dayWord}`} icon="alert" color="var(--sun)" right={absences.length ? <Tag tone="gray">{count(absences.length, NOUNS.teacher)}</Tag> : undefined}>
        <div id="absences" />
        {absences.length === 0 && <Empty icon="check" title="لا غياب بين المعلّمين" text="كلّ الحصص مع معلّميها الأصليين." />}
        {absences.map((a, i) => (
          <div className="dir-abs" key={`${a.teacher}-${i}`}>
            <div className="dir-abs-h">
              <b>{teacherTitle(a.teacher)}</b>
              <small>{a.subject}{a.reason ? ` · ${a.reason}` : ''}{a.periods.length ? ` · ${count(a.periods.length, NOUNS.period)}` : ''}</small>
            </div>
            {a.periods.length === 0 && <p className="small muted">لا حصص لهذا المعلّم في هذا اليوم.</p>}
            <div className="list">
              {a.periods.map((p) => {
                const st = PERIOD_STATUS[p.status] ?? PERIOD_STATUS.pending;
                return (
                  <div className={`row ${st.row}`} key={`${p.period}-${p.section}`}>
                    <span className="pnum num" aria-hidden="true">{ar(p.period)}</span>
                    <span className="grow">
                      <b>{periodName(p.period)} · {p.section}{p.subject && p.subject !== a.subject ? ` · ${p.subject}` : ''}</b>
                      <small>{periodStatusText(p)}</small>
                    </span>
                    <Tag tone={st.tone}>{st.label}</Tag>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Tile>

      <Tile title="حصص من دون تغطية" icon="swap" color={uncovered.length ? 'var(--red)' : 'var(--mint)'} right={uncovered.length ? <Tag tone="red">{count(uncovered.length, NOUNS.period)}</Tag> : undefined}>
        {uncovered.length === 0 && <p className="small muted">{absences.length ? 'كلّ حصص الغياب مغطّاة أو مسجّلة تعلّماً ذاتياً.' : `لا حصص تحتاج تغطية ${dayWord}.`}</p>}
        <div className="list">
          {uncovered.map((u, i) => (
            <div className="row bad" key={i}>
              <span className="pnum num" aria-hidden="true">{ar(u.period)}</span>
              <span className="grow"><b>{periodName(u.period)} · {u.section}</b><small>{u.subject}</small></span>
            </div>
          ))}
        </div>
        {uncovered.length > 0 && <p className="small muted" style={{ marginTop: 8 }}>تعتمد إدارة المدرسة البديل من لوحة الغياب؛ يمكن الاتصال بالمدير من الأعلى.</p>}
      </Tile>

      <Tile title="إنذار مبكر · غياب ثلاثة أيام متتالية" icon="users" color="var(--red)">
        {three.length === 0 && <p className="small muted">لا حالات {dayWord === 'اليوم' ? 'حالياً' : dayWord}.</p>}
        <div className="list">
          {three.map((t, i) => (
            <div className="row bad" key={i}>
              <span className="grow"><b>{t.student}</b><small>{t.section}</small></span>
              <Tag tone="red">{consecutiveDays(t.days)}</Tag>
            </div>
          ))}
        </div>
        {three.length > 0 && <p className="small muted" style={{ marginTop: 8 }}>يُحال الطالب إلى المرشد النفسي في المدرسة للمتابعة مع وليّ الأمر.</p>}
      </Tile>

      <Tile className="full" title="الحضور في آخر سبعة أيام دراسية" icon="chart">
        {trend.length === 0 && <p className="small muted">لا بيانات بعد.</p>}
        <div className="chart">
          {trend.map((t) => (
            t.attendance_pct === null
              ? (
                <div className="crow none" key={t.date}>
                  <span>{shortDate(t.date)}</span>
                  <div className="track"><i style={{ width: '0%' }} /></div>
                  <b>لم يُرفع</b>
                </div>
              )
              : <ChartRow key={t.date} label={shortDate(t.date)} value={t.attendance_pct} />
          ))}
        </div>
      </Tile>
    </>
  );
}

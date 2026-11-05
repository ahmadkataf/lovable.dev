/* Directorate: the weekly report («/directorate/report?week=»), laid out to print on A4 portrait: the directorate's
   name, the week, one row per school with totals, and a footer. «طباعة / حفظ PDF» calls window.print(); the body
   carries the «print-report» class while the page is mounted so the print stylesheet can hide the app chrome. */

import { useEffect, useState } from 'react';
import * as api from '../api';
import { Btn, ErrorBox, PageHead, Skeleton, Tile } from '../components/Ui';
import { addDays, ar, complexLabel, count, fmtDate, fmtDateRange, NOUNS, pct, todayISO, weekStart } from '../format';
import { useApi } from '../hooks';
import { navigate, useRoute } from '../router';
import type { DirectorateWeeklyNumbers, DirectorateWeeklyReport } from '../types';
import './directorate.css';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIRECTORATE = 'مديرية التربية في درعا';

function num(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : ar(n);
}
function Cells({ r, days, schools }: { r: DirectorateWeeklyNumbers; days: number; schools?: number }) {
  const uploadedOf = schools ? days * schools : days;
  return (
    <>
      <td className={`num ${r.attendance_avg_pct !== null && r.attendance_avg_pct < 90 ? 'warn' : ''}`}>{pct(r.attendance_avg_pct)}</td>
      <td className={`num ${uploadedOf && r.days_uploaded < uploadedOf ? 'warn' : ''}`}>{uploadedOf ? `${ar(r.days_uploaded)} / ${ar(uploadedOf)}` : num(r.days_uploaded)}</td>
      <td className="num">{num(r.absences)}</td>
      <td className="num">{num(r.substitutions_approved)}</td>
      <td className="num">{num(r.self_study)}</td>
      <td className={`num ${r.uncovered ? 'bad' : ''}`}>{num(r.uncovered)}</td>
      <td className={`num ${r.three_days ? 'bad' : ''}`}>{num(r.three_days)}</td>
    </>
  );
}

export function DirectorateReport() {
  const today = todayISO();
  const route = useRoute();
  const [week, setWeek] = useState(() => { const q = route.query.get('week'); return weekStart(q && ISO.test(q) && q <= today ? q : today); });
  const { data, error, loading, reload } = useApi<DirectorateWeeklyReport>(api.directorateUrls.report(week));

  useEffect(() => {
    document.body.classList.add('print-report');
    return () => document.body.classList.remove('print-report');
  }, []);

  const go = (w: string) => { setWeek(w); navigate(`/directorate/report?week=${w}`, { replace: true }); };
  const thisWeek = weekStart(today);
  const canNext = addDays(week, 7) <= thisWeek;
  const from = data?.from ?? week;
  const to = data?.to ?? addDays(week, 4);
  const days = data?.school_days ?? 5;
  const label = week === thisWeek ? 'هذا الأسبوع' : week === addDays(thisWeek, -7) ? 'الأسبوع الماضي' : 'أسبوع';

  return (
    <>
      <PageHead
        title="تقرير الأسبوع"
        back="/directorate"
        sub={`${fmtDateRange(from, to)} · ${label}`}
        actions={
          <div className="report-actions report-nav">
            <Btn size="sm" variant="light" icon="back" onClick={() => go(addDays(week, -7))}>الأسبوع السابق</Btn>
            <Btn size="sm" variant="light" icon="forward" disabled={!canNext} onClick={() => go(addDays(week, 7))}>الأسبوع التالي</Btn>
            <Btn size="sm" icon="file" onClick={() => window.print()} disabled={!data}>طباعة / حفظ PDF</Btn>
          </div>
        }
      />
      {loading && !data && <Tile className="full"><Skeleton lines={5} /></Tile>}
      {error && !data && <Tile className="full"><ErrorBox error={error} retry={reload} /></Tile>}
      {data && (
        <Tile className="full report">
          <header className="report-head">
            <div>
              <span className="org">{DIRECTORATE}</span>
              <span className="ttl">تقرير الأسبوع · الحضور والتغطية في {count(data.schools.length, NOUNS.school)}</span>
            </div>
            <div className="range">
              {fmtDateRange(data.from, data.to)}
              <small>{days === 5 ? 'خمسة أيام دراسية' : days === 0 ? 'لم يبدأ الأسبوع بعد' : `${count(days, NOUNS.day)} حتى ${fmtDate(today)}`}</small>
            </div>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">المدرسة</th>
                  <th scope="col">متوسّط الحضور</th>
                  <th scope="col">أيام رُفع فيها الحضور</th>
                  <th scope="col">غياب المعلّمين</th>
                  <th scope="col">تغطية معتمدة</th>
                  <th scope="col">تعلّم ذاتي</th>
                  <th scope="col">من دون تغطية</th>
                  <th scope="col">غياب ٣ أيام</th>
                </tr>
              </thead>
              <tbody>
                {data.schools.map((s) => (
                  <tr key={s.id ?? s.name}>
                    <td><b>{s.name}</b><span className="sub" style={{ display: 'block', color: 'var(--ink-3)', fontSize: '.76rem', fontWeight: 500 }}>{complexLabel(s.complex)}{s.students ? ` · ${count(s.students, NOUNS.student)}` : ''}</span></td>
                    <Cells r={s} days={days} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>المجموع · {count(data.schools.length, NOUNS.school)}</td>
                  <Cells r={data.totals} days={days} schools={data.schools.length} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="table-hint">يُسحب الجدول يساراً لعرض بقية الأعمدة؛ عند الطباعة يظهر كاملاً.</p>
          <footer className="report-foot">
            <span>أُعدّ في مَدار · نسخة تجريبية</span>
            <span>تاريخ الإعداد: {fmtDate(today, { weekday: true, year: true })}</span>
          </footer>
        </Tile>
      )}
    </>
  );
}

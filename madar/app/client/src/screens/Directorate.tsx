/* Directorate: dashboard (totals, sortable schools table, alerts), circulars
   composer, CSV report download. */

import { useMemo, useState, type FormEvent } from 'react';
import * as api from '../api';
import { Btn, Empty, ErrorBox, Field, Kpi, PageHead, Skeleton, Tag, Tile } from '../components/Ui';
import { ar, count, fmtDate, fmtWhen, NOUNS, pct, todayISO } from '../format';
import { useApi } from '../hooks';
import { navigate } from '../router';
import { toast, useStore } from '../store';
import type { DirectorateDashboard as DirectorateDashboardData, DirectorateSchool } from '../types';
import { useAnnouncements } from './SchoolAnnouncements';

type SortKey = keyof Pick<DirectorateSchool, 'name' | 'complex' | 'students' | 'present_pct' | 'attendance_uploaded' | 'uncovered_periods' | 'coverage_pct' | 'homework_today'>;
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'المدرسة' },
  { key: 'complex', label: 'المجمّع' },
  { key: 'students', label: 'الطلاب' },
  { key: 'present_pct', label: 'الحضور' },
  { key: 'attendance_uploaded', label: 'رُفع الحضور' },
  { key: 'uncovered_periods', label: 'بلا تغطية' },
  { key: 'coverage_pct', label: 'التغطية' },
  { key: 'homework_today', label: 'واجبات اليوم' },
];
const ALERT_TAG: Record<string, { label: string; tone: 'sun' | 'red' | 'violet' }> = {
  no_attendance: { label: 'متابعة', tone: 'sun' },
  uncovered: { label: 'قرار', tone: 'violet' },
  three_days: { label: 'إنذار مبكر', tone: 'red' },
};

export function DirectorateDashboard() {
  const today = todayISO();
  const [date, setDate] = useState(today);
  const { data, error, loading, reload } = useApi<DirectorateDashboardData>(`/api/directorate/dashboard?date=${date}`);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'present_pct', dir: -1 });
  const [downloading, setDownloading] = useState(false);
  const schools = useMemo(() => {
    const list = [...(data?.schools ?? [])];
    list.sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y, 'ar') * sort.dir;
      return (Number(x) - Number(y)) * sort.dir;
    });
    return list;
  }, [data, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' || key === 'complex' ? 1 : -1 }));

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      await api.download(`/api/directorate/report.csv?date=${date}`, `madar-report-${date}.csv`);
      toast('بدأ تنزيل تقرير CSV (يفتح في Excel)');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'تعذّر التنزيل', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHead
        title="مديرية التربية · درعا"
        sub={`نظرة اليوم · ${fmtDate(date)}`}
        actions={
          <>
            <input className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} aria-label="التاريخ" style={{ width: 'auto', minHeight: 40 }} />
            <Btn size="sm" variant="light" icon="download" loading={downloading} onClick={() => { void downloadCsv(); }}>تنزيل تقرير CSV</Btn>
            <Btn size="sm" icon="megaphone" onClick={() => navigate('/directorate/circulars')}>تعميم جديد</Btn>
          </>
        }
      />
      {loading && !data && <Tile className="full"><Skeleton lines={3} /></Tile>}
      {error && !data && <Tile className="full"><ErrorBox error={error} retry={reload} /></Tile>}
      {data && (
        <>
          <div className="kpis full">
            <Kpi value={ar(data.totals.schools_connected)} label="مدارس متّصلة" />
            <Kpi value={pct(data.totals.present_pct)} label="حضور الطلاب اليوم" tone={data.totals.present_pct >= 90 ? 'good' : 'warn'} />
            <Kpi value={pct(data.totals.coverage_pct)} label="تغطية حصص الغياب" tone={data.totals.coverage_pct >= 90 ? 'good' : 'warn'} />
            <Kpi value={ar(data.totals.alerts_count)} label="تنبيهات تحتاج تدخّلاً" tone={data.totals.alerts_count ? 'warn' : 'good'} />
          </div>

          <Tile className="full" title="المدارس" icon="school" right={<span className="small muted">اضغط عنوان العمود للترتيب</span>}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {COLUMNS.map((c) => (
                      <th key={c.key} onClick={() => toggleSort(c.key)} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined} scope="col">
                        {c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schools.map((sc) => (
                    <tr key={sc.id}>
                      <td>{sc.name}</td>
                      <td>{sc.complex}</td>
                      <td className="num">{ar(sc.students)}</td>
                      <td className="num">{sc.attendance_uploaded ? pct(sc.present_pct) : '—'}</td>
                      <td>{sc.attendance_uploaded ? <span className="y">✓</span> : <span className="n">✕</span>}</td>
                      <td className="num">{ar(sc.uncovered_periods)}</td>
                      <td className="num">{pct(sc.coverage_pct)}</td>
                      <td className="num">{ar(sc.homework_today)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-hint">اسحب الجدول يساراً لعرض بقية الأعمدة.</p>
          </Tile>

          <Tile title="يحتاج تدخّلاً اليوم" icon="alert" color="var(--sun)">
            {data.alerts.length === 0 && <Empty icon="check" title="لا تنبيهات اليوم" />}
            <div className="list">
              {data.alerts.map((a, i) => (
                <div className={`row ${a.kind === 'three_days' ? 'bad' : 'hl'}`} key={i} style={{ alignItems: 'flex-start' }}>
                  <span className="grow"><b>{a.text}</b><small>{a.school}</small></span>
                  <Tag tone={ALERT_TAG[a.kind]?.tone ?? 'sun'}>{ALERT_TAG[a.kind]?.label ?? a.kind}</Tag>
                </div>
              ))}
            </div>
          </Tile>

          <Tile title="غياب ثلاثة أيام متتالية" icon="users" color="var(--red)">
            {data.three_day_absences.length === 0 && <p className="small muted">لا حالات حالياً.</p>}
            <div className="list">
              {data.three_day_absences.map((t, i) => (
                <div className="row bad" key={i}>
                  <span className="grow"><b>{t.student_name}</b><small>{t.school}</small></span>
                  <Tag tone="red">{count(t.days, NOUNS.day)} متتالية</Tag>
                </div>
              ))}
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>يُحال الطالب إلى المرشد النفسي في المدرسة للمتابعة مع وليّ الأمر.</p>
          </Tile>
        </>
      )}
    </>
  );
}

export function DirectorateCirculars() {
  const s = useStore();
  const scope = `dir:${s.user?.id ?? 0}`;
  const { list, source, addLocal } = useAnnouncements(scope);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) { setError('اكتب العنوان والنصّ'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ id?: number; notified_schools?: number; notified?: number }>('/api/announcements', { title: title.trim(), body: body.trim() }, { queueable: false });
      const n = 'queued' in res ? 0 : res.notified_schools ?? res.notified ?? 0;
      toast(`أُرسل التعميم إلى ${n ? count(n, NOUNS.school) : 'كلّ المدارس المتّصلة'} وظهر في لوحة كلّ مدير`, 'ok', 5000);
      addLocal({ id: 'queued' in res ? Date.now() : res.id ?? Date.now(), school_id: null, title: title.trim(), body: body.trim(), urgent: 0, created_at: new Date().toISOString(), notified: n });
      setTitle('');
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الإرسال');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="التعاميم" sub="تعميم واحد يصل إلى كلّ المدارس المتّصلة" />
      <Tile className="full" title="تعميم جديد" icon="megaphone">
        <form onSubmit={submit} className="stack">
          <Field label="العنوان">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: مواعيد امتحانات الفصل الأول" maxLength={100} required />
          </Field>
          <Field label="النصّ">
            <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="نصّ التعميم…" rows={4} required />
          </Field>
          {error && <div className="error" role="alert">{error}</div>}
          <div className="btnrow top">
            <Btn type="submit" icon="send" loading={busy}>إرسال إلى كلّ المدارس</Btn>
          </div>
        </form>
      </Tile>
      <Tile className="full" title="التعاميم السابقة" icon="list" right={source === 'local' ? <Tag tone="gray">المرسلة من هذا الجهاز</Tag> : undefined}>
        {list.length === 0 && <Empty icon="megaphone" title="لا تعاميم بعد" />}
        <div className="list">
          {list.map((a) => (
            <div className="row" key={a.id} style={{ alignItems: 'flex-start' }}>
              <span className="grow">
                <b>{a.title}</b>
                <span className="small wrap-text" style={{ display: 'block' }}>{a.body}</span>
                <small>{fmtWhen(a.created_at)}{a.notified ? ` · ${count(a.notified, NOUNS.school)}` : ''}</small>
              </span>
              <Tag tone="teal">تعميم</Tag>
            </div>
          ))}
        </div>
      </Tile>
    </>
  );
}

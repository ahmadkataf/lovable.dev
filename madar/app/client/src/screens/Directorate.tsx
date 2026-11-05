/* Directorate: the dashboard (alerts first, compact KPIs, school cards on phones / sortable table on desktop),
   the circulars composer, the CSV download and the way to the printable weekly report. */

import { useMemo, useRef, useState, type FormEvent } from 'react';
import * as api from '../api';
import { Icon } from '../components/Icon';
import { Btn, DateField, Empty, ErrorBox, Field, Kpi, PageHead, Skeleton, Tag, Tile } from '../components/Ui';
import { ar, complexLabel, consecutiveDays, count, fmtDate, fmtHM, fmtPhone, fmtWhen, NOUNS, pct, todayISO } from '../format';
import { useApi } from '../hooks';
import { Link, navigate, useRoute } from '../router';
import { toast, useStore } from '../store';
import type { DirectorateAlert, DirectorateDashboard as DirectorateDashboardData, DirectorateSchool } from '../types';
import { dashboardPath, isHoliday, schoolPath, severity, severityClass, TelButton, UploadBadge, useNarrow } from './DirectorateCommon';
import { useAnnouncements } from './SchoolAnnouncements';

type SortKey = 'severity' | 'name' | 'present_pct' | 'uploaded_at' | 'uncovered_periods' | 'three_days' | 'coverage_pct';
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'المدرسة' },
  { key: 'present_pct', label: 'الحضور' },
  { key: 'uploaded_at', label: 'رُفع الحضور' },
  { key: 'uncovered_periods', label: 'بلا تغطية' },
  { key: 'three_days', label: 'غياب ٣ أيام' },
  { key: 'coverage_pct', label: 'التغطية' },
];
const ALERT_TAG: Record<string, { label: string; tone: 'sun' | 'red' | 'violet' }> = {
  no_attendance: { label: 'متابعة', tone: 'sun' },
  uncovered: { label: 'قرار', tone: 'violet' },
  three_days: { label: 'إنذار مبكر', tone: 'red' },
};
const PHONE_SORT: { key: SortKey; label: string }[] = [
  { key: 'severity', label: 'الأكثر حاجة للتدخّل' },
  { key: 'present_pct', label: 'الحضور الأدنى' },
  { key: 'uploaded_at', label: 'لم يُرفع الحضور' },
  { key: 'name', label: 'اسم المدرسة' },
];
const ALERTS_SHOWN = 3;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function sortValue(s: DirectorateSchool, key: SortKey, holiday: boolean): number | string {
  switch (key) {
    case 'name': return s.name;
    case 'severity': return severity(s, holiday);
    case 'present_pct': return s.attendance_uploaded && s.present_pct !== null && s.present_pct !== undefined ? s.present_pct : -1;
    case 'uploaded_at': return s.attendance_uploaded ? (s.uploaded_at ? Date.parse(s.uploaded_at) : 1) : Number.MAX_SAFE_INTEGER;
    case 'uncovered_periods': return s.uncovered_periods;
    case 'three_days': return s.three_days ?? 0;
    default: return s.coverage_pct;
  }
}
/** The direction a column starts with when first clicked: names ascend, everything else shows the worst first. */
function firstDir(key: SortKey): 1 | -1 {
  return key === 'name' || key === 'present_pct' || key === 'coverage_pct' ? 1 : -1;
}

function AlertRow({ alert, school, date, onEarlyWarning }: { alert: DirectorateAlert; school: DirectorateSchool | undefined; date: string; onEarlyWarning: () => void }) {
  const tag = ALERT_TAG[alert.kind] ?? { label: alert.kind, tone: 'sun' as const };
  const to = school ? schoolPath(school.id, date) : undefined;
  const body = (
    <>
      <b>{alert.text}</b>
      <small>{alert.school}{school?.principal ? ` · ${school.principal}` : ''}</small>
    </>
  );
  return (
    <div className={`row dir-alert ${alert.kind === 'three_days' ? 'bad' : 'hl'}`} data-kind={alert.kind}>
      {to ? <Link to={to} className="dir-alert-main">{body}</Link> : <span className="dir-alert-main">{body}</span>}
      {alert.kind === 'three_days'
        ? <button type="button" className="tag red dir-early" onClick={onEarlyWarning} title="الانتقال إلى قائمة الغياب المتتالي">{tag.label}</button>
        : <Tag tone={tag.tone}>{tag.label}</Tag>}
      <TelButton phone={school?.phone} school={alert.school} />
    </div>
  );
}

function SchoolCard({ s, date, holiday }: { s: DirectorateSchool; date: string; holiday: boolean }) {
  const p = s.attendance_uploaded && s.present_pct !== null && s.present_pct !== undefined ? s.present_pct : null;
  const unc = s.uncovered_periods ?? 0;
  const three = s.three_days ?? 0;
  return (
    <article className={`scard ${severityClass(s, holiday)}`} data-school={s.id}>
      <Link to={schoolPath(s.id, date)} className="scard-main" aria-label={`${s.name} — فتح صفحة المدرسة`}>
        <div className="scard-h">
          <b>{s.name}</b>
          <small>{complexLabel(s.complex)} · {count(s.students, NOUNS.student)}{s.principal ? ` · ${s.principal}` : ''}</small>
        </div>
        <div className={`scard-att ${p === null ? 'none' : p < 90 ? 'low' : ''}`}>
          <div className="bar" role="progressbar" aria-valuenow={p ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="نسبة الحضور"><i style={{ width: `${p ?? 0}%` }} /></div>
          <b className="num">{p === null ? '—' : pct(p)}</b>
        </div>
        <div className="scard-badges">
          <UploadBadge uploaded={s.attendance_uploaded} at={s.uploaded_at} holiday={holiday} />
          <Tag tone={unc ? 'sun' : 'gray'}>{unc ? `${count(unc, NOUNS.period)} بلا تغطية` : 'كلّ الحصص مغطّاة'}</Tag>
          {three > 0 && <Tag tone="red">{three === 1 ? 'حالة غياب ٣ أيام' : `${count(three, NOUNS.case)} غياب ٣ أيام`}</Tag>}
        </div>
      </Link>
      <div className="scard-side"><TelButton phone={s.phone} school={s.name} /></div>
    </article>
  );
}

export function DirectorateDashboard() {
  const today = todayISO();
  const route = useRoute();
  const [date, setDateState] = useState(() => { const q = route.query.get('date'); return q && ISO.test(q) && q <= today ? q : today; });
  const { data, error, loading, reload } = useApi<DirectorateDashboardData>(api.directorateUrls.dashboard(date));
  const narrow = useNarrow();
  const holiday = isHoliday(date);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'severity', dir: -1 });
  const [showAll, setShowAll] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const threeDaysRef = useRef<HTMLElement | null>(null);

  // The date lives in the URL too, so a reload or the back button keeps it (the notification links carry ?date=).
  const setDate = (iso: string) => { setDateState(iso); navigate(dashboardPath(iso, today), { replace: true }); };

  const schools = useMemo(() => {
    const list = [...(data?.schools ?? [])];
    list.sort((a, b) => {
      const x = sortValue(a, sort.key, holiday), y = sortValue(b, sort.key, holiday);
      const c = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'ar') : Number(x) - Number(y);
      return c * sort.dir || severity(b, holiday) - severity(a, holiday) || a.name.localeCompare(b.name, 'ar');
    });
    return list;
  }, [data, sort, holiday]);
  const byId = useMemo(() => new Map((data?.schools ?? []).map((s) => [s.id, s])), [data]);
  const byName = useMemo(() => new Map((data?.schools ?? []).map((s) => [s.name, s])), [data]);
  const schoolOf = (a: { school_id?: number; school: string }) => (a.school_id !== undefined ? byId.get(a.school_id) : undefined) ?? byName.get(a.school);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: firstDir(key) }));
  const pickSort = (key: SortKey) => setSort({ key, dir: key === 'name' || key === 'present_pct' ? 1 : -1 });

  const scrollToThreeDays = () => {
    const el = threeDaysRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  };

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      await api.download(api.directorateUrls.csv(date), `madar-report-${date}.csv`);
      toast('بدأ تنزيل التقرير، ويُفتح في إكسل');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'تعذّر التنزيل', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const alerts = data?.alerts ?? [];
  const shownAlerts = showAll || alerts.length <= ALERTS_SHOWN + 1 ? alerts : alerts.slice(0, ALERTS_SHOWN);
  const uploaded = (data?.schools ?? []).filter((s) => s.attendance_uploaded).length;
  const total = data?.schools.length ?? 0;
  const dayWord = date === today ? 'اليوم' : fmtDate(date);

  return (
    <>
      <header className="dir-head full">
        <h1>لوحة المديرية</h1>
        <DateField compact value={date} onChange={setDate} max={today} />
      </header>
      {loading && !data && <Tile className="full"><Skeleton lines={3} /></Tile>}
      {error && !data && <Tile className="full"><ErrorBox error={error} retry={reload} /></Tile>}
      {data && (
        <>
          <Tile
            className="full dir-alerts"
            title={alerts.length && !narrow ? `يحتاج تدخّلاً ${dayWord} · ${count(alerts.length, NOUNS.alert)}` : `يحتاج تدخّلاً ${dayWord}`}
            icon="alert"
            color="var(--sun)"
            right={alerts.length > ALERTS_SHOWN + 1 ? (
              <button type="button" className="dir-more-link" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                {showAll ? 'عرض أقلّ' : `عرض الكلّ (${ar(alerts.length)})`}
              </button>
            ) : undefined}
          >
            {alerts.length === 0 && <Empty icon="check" title={holiday ? 'يوم عطلة — لا تنبيهات' : `لا تنبيهات ${dayWord}`} text={holiday ? undefined : 'رفعت كلّ المدارس حضورها، وكلّ حصص الغياب مغطّاة.'} />}
            <div className="list">
              {shownAlerts.map((a, i) => <AlertRow key={`${a.kind}-${a.school}-${i}`} alert={a} school={schoolOf(a)} date={date} onEarlyWarning={scrollToThreeDays} />)}
            </div>
            {showAll && alerts.length > ALERTS_SHOWN + 1 && (
              <button type="button" className="dir-more" onClick={() => setShowAll(false)}>عرض أقلّ</button>
            )}
          </Tile>

          <div className="kpis dir-kpis full" aria-label="أرقام اليوم">
            <Kpi value={pct(data.totals.present_pct)} label={narrow ? 'الحضور' : 'حضور الطلاب'} tone={data.totals.present_pct === null ? 'muted' : data.totals.present_pct >= 90 ? 'good' : 'warn'} />
            <Kpi value={pct(data.totals.coverage_pct)} label={narrow ? 'التغطية' : 'تغطية حصص الغياب'} tone={data.totals.coverage_pct >= 90 ? 'good' : 'warn'} />
            <Kpi value={`${ar(uploaded)} / ${ar(total)}`} label={narrow ? 'رفع الحضور' : 'مدارس رفعت الحضور'} tone={holiday ? 'muted' : uploaded === total ? 'good' : 'warn'} />
            <Kpi value={ar(alerts.length)} label={alerts.length === 1 ? 'تنبيه واحد' : 'تنبيهات'} tone={alerts.length ? 'warn' : 'good'} />
          </div>

          {narrow ? (
            <section className="full dir-schools-sec" aria-label="المدارس">
              <div className="dir-schools-h">
                <h3><Icon name="school" /> المدارس ({ar(total)})</h3>
                <select className="input dir-sort-select" value={sort.key} onChange={(e) => pickSort(e.target.value as SortKey)} aria-label="ترتيب المدارس">
                  {PHONE_SORT.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <div className="scards">
                {schools.map((s) => <SchoolCard key={s.id} s={s} date={date} holiday={holiday} />)}
              </div>
            </section>
          ) : (
            <Tile className="full dir-schools" title={`المدارس (${ar(total)})`} icon="school" right={<span className="small muted">الترتيب بالضغط على عنوان العمود · الصفّ يفتح صفحة المدرسة</span>}>
              <div className="table-wrap dir-table">
                <table>
                  <thead>
                    <tr>
                      {COLUMNS.map((c) => (
                        <th key={c.key} onClick={() => toggleSort(c.key)} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined} scope="col">
                          {c.label}{sort.key === c.key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
                        </th>
                      ))}
                      <th scope="col" onClick={() => toggleSort('severity')} aria-sort={sort.key === 'severity' ? 'descending' : undefined}>المدير</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schools.map((s) => {
                      const p = s.attendance_uploaded && s.present_pct !== null && s.present_pct !== undefined ? s.present_pct : null;
                      const to = schoolPath(s.id, date);
                      return (
                        <tr key={s.id} tabIndex={0} onClick={() => navigate(to)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(to); }} data-school={s.id}>
                          <td className="name">
                            <Link to={to} onClick={(e) => e.stopPropagation()} className="nm">
                              <span>{s.name}</span>
                              <span className="sub">{complexLabel(s.complex)} · {count(s.students, NOUNS.student)}</span>
                            </Link>
                          </td>
                          <td className="num">{p === null ? '—' : <>{pct(p)}<span className={`mini ${p < 90 ? 'low' : ''}`} aria-hidden="true"><i style={{ width: `${p}%` }} /></span></>}</td>
                          <td className={s.attendance_uploaded ? 'num' : holiday ? 'muted' : 'bad'}>{s.attendance_uploaded ? (s.uploaded_at ? fmtHM(s.uploaded_at) : <span className="y">✓</span>) : holiday ? 'عطلة' : 'لم يُرفع'}</td>
                          <td className={`num ${s.uncovered_periods ? 'warn' : ''}`}>{ar(s.uncovered_periods)}</td>
                          <td className={`num ${s.three_days ? 'bad' : ''}`}>{ar(s.three_days ?? 0)}</td>
                          <td className="num">{pct(s.coverage_pct)}</td>
                          <td className="princ">
                            <span className="in">
                              <span><b>{s.principal ?? '—'}</b>{s.phone && <bdi className="sub num" dir="ltr">{fmtPhone(s.phone)}</bdi>}</span>
                              <TelButton phone={s.phone} school={s.name} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Tile>
          )}

          <Tile title="إنذار مبكر · غياب ثلاثة أيام متتالية" icon="users" color="var(--red)" className="dir-three" style={{ scrollMarginTop: 80 }}>
            <section ref={threeDaysRef} id="three-days" tabIndex={-1} aria-label="قائمة الغياب المتتالي" style={{ outline: 'none' }}>
              {data.three_day_absences.length === 0 && <p className="small muted">لا حالات {dayWord === 'اليوم' ? 'حالياً' : dayWord}.</p>}
              <div className="list">
                {data.three_day_absences.map((t, i) => {
                  const sc = schoolOf({ school_id: t.school_id, school: t.school });
                  const body = (
                    <>
                      <span className="grow"><b>{t.student_name}</b><small>{t.section_label ? `${t.section_label} · ` : ''}{t.school}</small></span>
                      <Tag tone="red">{consecutiveDays(t.days)}</Tag>
                    </>
                  );
                  return sc
                    ? <Link to={schoolPath(sc.id, date)} className="row bad" key={i}>{body}</Link>
                    : <div className="row bad" key={i}>{body}</div>;
                })}
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>يُحال الطالب إلى المرشد النفسي في المدرسة للمتابعة مع وليّ الأمر.</p>
            </section>
          </Tile>

          <Tile title="التقارير والتعاميم" icon="file">
            <div className="btnrow top">
              <Btn variant="light" icon="download" loading={downloading} onClick={() => { void downloadCsv(); }}>تنزيل تقرير اليوم</Btn>
              <Btn variant="light" icon="file" onClick={() => navigate(`/directorate/report?week=${date}`)}>تقرير الأسبوع (للطباعة)</Btn>
              <Btn icon="megaphone" onClick={() => navigate('/directorate/circulars')}>تعميم جديد</Btn>
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>تقرير اليوم ملفّ جداول يُفتح في إكسل؛ تقرير الأسبوع صفحة تُطبع أو تُحفظ بصيغة PDF.</p>
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
    if (!title.trim() || !body.trim()) { setError('يلزم العنوان والنصّ'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ id?: number; notified_schools?: number; notified?: number }>('/api/announcements', { title: title.trim(), body: body.trim() }, { queueable: false });
      const n = 'queued' in res ? 0 : res.notified_schools ?? res.notified ?? 0;
      toast(`أُرسل التعميم إلى ${n ? count(n, NOUNS.school) : 'كلّ المدارس المتّصلة'} وظهر في لوحة كلّ مدرسة`, 'ok', 5000);
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

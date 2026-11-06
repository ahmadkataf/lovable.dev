/* Login: the first screen addresses whoever holds an access code — title, today's date, where codes come from,
   the collapsed demo accounts, the demo notice and the support line. At the very bottom a discreet presenter
   link opens the reset of the shared demo data (POST /api/admin/reseed with the presenter's key, never stored). */

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Icon, Logo } from '../components/Icon';
import { ROLE_COLOR, ROLE_LABEL, ToastHost } from '../components/Shell';
import { Btn, SupportLine } from '../components/Ui';
import { ApiError, DEVICE_DEMO, setDeviceDemo } from '../api';
import { reseedDemo, ReseedError, reseedHourLabel, reseedToast, useConfig } from '../config';
import { DEMO_ACCOUNTS } from '../demo';
import { arDigits, fmtDate, todayISO } from '../format';
import { navigate } from '../router';
import { roleHome, signIn, toast, useStore } from '../store';

const WRONG_CODE = 'رمز الدخول غير صحيح';

/** The message for a failed sign-in: a refused code reads the same whatever the server said. */
function loginError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 400 || e.status === 401 || e.status === 403 || e.status === 404) return WRONG_CODE;
    return e.message;
  }
  return 'تعذّر تسجيل الدخول';
}

export function Login() {
  const s = useStore();
  const cfg = useConfig();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presenter, setPresenter] = useState(false);
  const [key, setKey] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (s.token && s.user) navigate(roleHome(s.user.role), { replace: true });
  }, [s.token, s.user]);

  useEffect(() => {
    if (presenter) keyRef.current?.focus();
  }, [presenter]);

  const go = async (c: string) => {
    if (busy) return;
    if (!c.trim()) { setError('يلزم إدخال رمز الدخول'); return; }
    setBusy(c);
    setError(null);
    try {
      const user = await signIn(c);
      navigate(roleHome(user.role), { replace: true });
    } catch (e) {
      setError(loginError(e));
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void go(code);
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    if (resetBusy) return;
    if (!s.mock && !key.trim()) { setResetError('يلزم إدخال مفتاح المقدّم'); return; }
    setResetBusy(true);
    setResetError(null);
    try {
      const counts = await reseedDemo(key.trim());
      setKey('');
      setPresenter(false);
      toast(reseedToast(counts), 'ok', 6000);
    } catch (err) {
      setResetError(err instanceof ReseedError ? err.message : 'تعذّر إعادة ضبط بيانات العرض');
    } finally {
      setResetBusy(false);
    }
  };

  const reseedAt = reseedHourLabel(cfg.reseed_hour);
  const today = todayISO();
  // The year is appended by hand: fmtDate's `year` option groups its digits («٢٬٠٢٦»).
  const dateLine = `${fmtDate(today)} ${arDigits(today.slice(0, 4))}`;

  return (
    <div className="login">
      <main className="login-card glass">
        <div className="logo">
          <Logo />
          <h1>مَدار <span className="org">مديرية التربية في درعا</span></h1>
          <p className="date">{dateLine}</p>
        </div>
        <form onSubmit={submit} noValidate>
          <label className="field">
            <span>رمز الدخول</span>
            <input
              className="input ltr"
              value={code}
              onChange={(e) => { setCode(e.target.value); if (error) setError(null); }}
              placeholder="T-SAMER"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              aria-invalid={error ? true : undefined}
              aria-describedby="code-hint"
            />
            <span className="hint" id="code-hint">رمز الدخول: المدير والمدارس من المديرية، والمعلّمون والطلاب وأولياء الأمور من إدارة المدرسة.</span>
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          {error && !DEVICE_DEMO && /الخادم|اتصال/.test(error) && (
            <div className="notice" role="status">
              يمكن متابعة العرض الآن ببيانات تجريبية تعمل داخل هذا المتصفّح من دون خادم.{' '}
              <Btn type="button" variant="ghost" size="sm" onClick={() => setDeviceDemo(true)}>تشغيل العرض على هذا الجهاز</Btn>
            </div>
          )}
          {DEVICE_DEMO && (
            <div className="notice" role="status">
              وضع العرض على هذا الجهاز: البيانات تجريبية ولا تُرسل إلى الخادم.{' '}
              <Btn type="button" variant="ghost" size="sm" onClick={() => setDeviceDemo(false)}>العودة إلى الخادم</Btn>
            </div>
          )}
          <Btn type="submit" block loading={busy === code && !!busy} icon="forward">دخول</Btn>
        </form>
        <details>
          <summary><Icon name="chevron" /> حسابات العرض</summary>
          <div className="demo-list">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                type="button"
                key={a.code}
                className="demo-acc"
                style={{ '--c': ROLE_COLOR[a.role] } as CSSProperties}
                onClick={() => { setCode(a.code); void go(a.code); }}
                disabled={!!busy}
                data-code={a.code}
              >
                <span className="dot" aria-hidden="true" />
                <span className="txt">
                  {a.name}
                  <small>{ROLE_LABEL[a.role]} · {a.hint}</small>
                </span>
                <code>{a.code}</code>
              </button>
            ))}
          </div>
        </details>
        <div className="foot">
          <span>نسخة تجريبية · الأسماء والبيانات افتراضية{reseedAt && <> · تُعاد بيانات العرض كلّ صباح {reseedAt}</>}</span>
          <SupportLine cfg={cfg} />
        </div>
        <div className="presenter">
          {!presenter && (
            <button type="button" className="presenter-link" onClick={() => setPresenter(true)}>للمقدّم</button>
          )}
          {presenter && (
            <form className="presenter-form" onSubmit={reset}>
              {!s.mock && (
                <label className="field">
                  <span>مفتاح المقدّم</span>
                  <input
                    ref={keyRef}
                    className="input ltr"
                    type="password"
                    value={key}
                    onChange={(e) => { setKey(e.target.value); if (resetError) setResetError(null); }}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={resetError ? true : undefined}
                  />
                  <span className="hint">تُعاد كلّ بيانات العرض المشتركة إلى حالتها الأولى، ولا يُحفظ المفتاح على الجهاز.</span>
                </label>
              )}
              {s.mock && <span className="hint">تُعاد بيانات العرض المحلية في هذا المتصفّح إلى حالتها الأولى.</span>}
              {resetError && <div className="error" role="alert">{resetError}</div>}
              <div className="btnrow top">
                <Btn type="submit" variant="light" size="sm" icon="refresh" loading={resetBusy}>إعادة ضبط بيانات العرض</Btn>
                <Btn type="button" variant="ghost" size="sm" onClick={() => { setPresenter(false); setKey(''); setResetError(null); }}>إلغاء</Btn>
              </div>
            </form>
          )}
        </div>
      </main>
      <ToastHost />
    </div>
  );
}

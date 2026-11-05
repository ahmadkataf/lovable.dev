import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Icon, Logo } from '../components/Icon';
import { ROLE_COLOR, ROLE_LABEL, ToastHost } from '../components/Shell';
import { Btn } from '../components/Ui';
import { DEMO_ACCOUNTS, resetMock } from '../mock';
import { navigate } from '../router';
import { roleHome, signIn, toast, useStore } from '../store';

export function Login() {
  const s = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (s.token && s.user) navigate(roleHome(s.user.role), { replace: true });
  }, [s.token, s.user]);

  const go = async (c: string) => {
    if (busy) return;
    setBusy(c);
    setError(null);
    try {
      const user = await signIn(c);
      navigate(roleHome(user.role), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تسجيل الدخول');
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void go(code);
  };

  return (
    <div className="login">
      <main className="login-card glass">
        <div className="logo">
          <Logo />
          <h1>مَدار</h1>
          <p>كلُّ المدرسةِ في مدارٍ واحد — مديرية التربية في درعا</p>
        </div>
        <form onSubmit={submit} noValidate>
          <label className="field">
            <span>رمز الدخول</span>
            <input
              className="input ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="T-SAMER"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              aria-describedby="code-hint"
            />
            <span className="hint" id="code-hint">الرمز مطبوع على البطاقة التي سلّمتها المدرسة.</span>
          </label>
          {error && <div className="error" role="alert">{error}</div>}
          <Btn type="submit" block loading={busy === code && !!busy} icon="forward">دخول</Btn>
        </form>
        <details open={s.mock}>
          <summary><Icon name="chevron" /> حسابات تجريبية</summary>
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
        <p className="foot">
          نسخة تجريبية (MVP) · البيانات أسماء افتراضية
          {s.mock && (
            <>
              {' · '}
              <button type="button" onClick={() => { resetMock(); toast('أُعيد ضبط البيانات التجريبية', 'info'); }}>إعادة ضبط البيانات التجريبية</button>
            </>
          )}
        </p>
      </main>
      <ToastHost />
    </div>
  );
}

import { useState } from 'react'
import { ArrowLeft, Check, Copy, KeyRound } from 'lucide-react'
import { put, saveSettings, setCurrentUser } from '../db/store'
import { Field } from '../ui/components'
import { hashPin } from '../lib/crypto'
import { hashRecovery, newRecoveryCode } from '../lib/recovery'
import { loadDemoData } from '../db/demo'
import { CURRENCY_DECIMALS, CURRENCY_SYMBOL } from '../lib/format'
import type { CurrencyCode } from '../db/types'
import { NumberInput } from '../ui/components'

// First run: the shop's name and currency, the owner's PIN (required), the recovery code that opens the app if
// the PIN is ever forgotten, and optionally some sample data to try.
export function Setup() {
  const [step, setStep] = useState(0)
  const [shopName, setShopName] = useState('كراج الرضوان')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [base, setBase] = useState<CurrencyCode>('SYP')
  const [rate, setRate] = useState(0)
  const [ownerName, setOwnerName] = useState('المدير')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [demo, setDemo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [recovery] = useState(newRecoveryCode)
  const [kept, setKept] = useState(false)
  const [copied, setCopied] = useState(false)
  const pinError = () => !ownerName.trim() ? 'اكتب اسم صاحب المحل' : pin.length < 4 ? 'الرقم السري إلزامي: 4 أرقام على الأقل' : pin !== pin2 ? 'الرقمان غير متطابقين: أعد كتابة التأكيد' : ''

  const finish = async () => {
    setErr('')
    const e = pinError(); if (e) { setErr(e); setStep(1); return }
    setBusy(true)
    try {
      const h = await hashPin(pin)
      const u = await put('users', { name: ownerName.trim() || 'المدير', pinHash: h.hash, pinSalt: h.salt, pinIterations: h.iterations, role: 'admin', createdAt: Date.now() })
      setCurrentUser(u.id)
      if (demo) await loadDemoData()
      await saveSettings({ shopName: shopName.trim() || 'كراج الرضوان', phone, address, baseCurrency: base, currency: CURRENCY_SYMBOL[base], decimals: CURRENCY_DECIMALS[base], rate, display: 'base', setupDone: true, recovery: await hashRecovery(recovery) })
    } finally { setBusy(false) }
  }

  return (
    <div className="login">
      <div className="card pad setup" style={{ maxWidth: 520 }}>
        <img className="logo" src="./icon.svg" alt="" />
        <h1 style={{ textAlign: 'center' }}>أهلاً بك في كراج الرضوان</h1>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 20 }}>نظام إدارة محل قطع الغيار — {step === 0 ? 'لنبدأ ببيانات المحل' : step === 1 ? 'حماية البرنامج برقم سري' : step === 2 ? 'رمز الاسترجاع' : 'الخطوة الأخيرة'}</p>
        <div className="progress mb"><i style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
        {step === 0 && (
          <div className="stack">
            <Field label="اسم المحل" required><input className="input lg" value={shopName} onChange={e => setShopName(e.target.value)} autoFocus /></Field>
            <Field label="رقم الهاتف" help="يظهر على الفواتير"><input className="input" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" dir="ltr" style={{ textAlign: 'right' }} /></Field>
            <Field label="العنوان"><input className="input" value={address} onChange={e => setAddress(e.target.value)} /></Field>
            <Field label="بأي عملة تكتب أسعارك؟" help="يمكنك عرض الأسعار بالعملة الأخرى في أي وقت حسب سعر الدولار">
              <div className="tabs"><button className={base === 'SYP' ? 'active' : ''} onClick={() => setBase('SYP')}>الليرة السورية (ل.س)</button><button className={base === 'USD' ? 'active' : ''} onClick={() => setBase('USD')}>الدولار ($)</button></div>
            </Field>
            <Field label="سعر الدولار اليوم بالليرة (اختياري)"><NumberInput value={rate} onChange={setRate} suffix="ل.س لكل 1 $" /></Field>
            <button className="btn primary lg block" onClick={() => setStep(1)}>التالي <ArrowLeft /></button>
          </div>
        )}
        {step === 1 && (
          <div className="stack">
            <p>ضع رقماً سرياً لصاحب المحل (مدير البرنامج) حتى لا يفتحه غيرك ولا يرى أحد الأرباح والحسابات. تضيف الموظفين لاحقاً من الإعدادات، ولكل منهم رقمه وصلاحياته.</p>
            <Field label="اسم صاحب المحل" required><input className="input" value={ownerName} onChange={e => setOwnerName(e.target.value)} /></Field>
            <div className="form-grid">
              <Field label="الرقم السري" required><input className="input" type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="4 أرقام أو أكثر" dir="ltr" /></Field>
              <Field label="تأكيد الرقم السري" required><input className="input" type="password" inputMode="numeric" value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} dir="ltr" /></Field>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="btn-row">
              <button className="btn primary lg" style={{ flex: 1 }} onClick={() => { const e = pinError(); setErr(e); if (!e) setStep(2) }}>التالي <ArrowLeft /></button>
              <button className="btn lg" onClick={() => setStep(0)}>رجوع</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <p>هذا <b>رمز الاسترجاع</b>: يفتح البرنامج ويضع رقماً سرياً جديداً إن نسيت رقمك. اكتبه على ورقة أو صوّره، واحفظه بعيداً عن الجهاز. لن يظهر مرة أخرى.</p>
            <div className="card pad" style={{ textAlign: 'center', borderStyle: 'dashed' }}>
              <KeyRound size={22} style={{ color: 'var(--accent)' }} />
              <div className="mono" dir="ltr" style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, margin: '6px 0' }}>{recovery}</div>
              <button className="btn sm" onClick={() => { try { navigator.clipboard?.writeText(recovery); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ } }}><Copy /> {copied ? 'نُسخ ✓' : 'نسخ الرمز'}</button>
            </div>
            <label className="checkbox"><input type="checkbox" checked={kept} onChange={e => setKept(e.target.checked)} /> كتبتُ الرمز وحفظته في مكان آمن</label>
            <div className="btn-row">
              <button className="btn primary lg" style={{ flex: 1 }} disabled={!kept} onClick={() => setStep(3)}>التالي <ArrowLeft /></button>
              <button className="btn lg" onClick={() => setStep(1)}>رجوع</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="stack">
            <label className="checkbox card pad" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={demo} onChange={e => setDemo(e.target.checked)} style={{ marginTop: 3 }} />
              <div><div>أضف بيانات تجريبية للتعرّف على البرنامج</div><div className="help">منتجات وعملاء وفواتير للتجربة. يمكنك حذفها كلها من الإعدادات عند البدء بالعمل الفعلي.</div></div>
            </label>
            {err && <div className="error">{err}</div>}
            <div className="btn-row">
              <button className="btn primary lg" style={{ flex: 1 }} onClick={finish} disabled={busy}><Check /> ابدأ العمل</button>
              <button className="btn lg" onClick={() => setStep(2)} disabled={busy}>رجوع</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

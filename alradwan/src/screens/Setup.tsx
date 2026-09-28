import { useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { put, saveSettings, setCurrentUser } from '../db/store'
import { Field } from '../ui/components'
import { sha256 } from '../lib/id'
import { loadDemoData } from '../db/demo'
import { CURRENCY_DECIMALS, CURRENCY_SYMBOL } from '../lib/format'
import type { CurrencyCode } from '../db/types'
import { NumberInput } from '../ui/components'

// First run: the shop's name and currency, an optional owner PIN, and optionally some sample data to try.
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

  const finish = async () => {
    setErr('')
    if (pin && (pin.length < 4 || pin !== pin2)) { setErr('الرقم السري يجب أن يكون 4 أرقام على الأقل ومطابقاً في الحقلين'); return }
    setBusy(true)
    try {
      if (pin) { const u = await put('users', { name: ownerName || 'المدير', pinHash: await sha256(pin), role: 'admin', createdAt: Date.now() }); setCurrentUser(u.id) }
      if (demo) await loadDemoData()
      await saveSettings({ shopName: shopName.trim() || 'كراج الرضوان', phone, address, baseCurrency: base, currency: CURRENCY_SYMBOL[base], decimals: CURRENCY_DECIMALS[base], rate, display: 'base', setupDone: true })
    } finally { setBusy(false) }
  }

  return (
    <div className="login">
      <div className="card pad setup" style={{ maxWidth: 520 }}>
        <img className="logo" src="./icon.svg" alt="" />
        <h1 style={{ textAlign: 'center' }}>أهلاً بك في كراج الرضوان</h1>
        <p className="muted" style={{ textAlign: 'center', marginBottom: 20 }}>نظام إدارة محل قطع الغيار — {step === 0 ? 'لنبدأ ببيانات المحل' : step === 1 ? 'حماية البرنامج برقم سري' : 'الخطوة الأخيرة'}</p>
        <div className="progress mb"><i style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
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
            <p>يمكنك وضع رقم سري لصاحب المحل حتى لا يفتح البرنامج غيرك. يمكن إضافة موظفين لاحقاً من الإعدادات. اتركه فارغاً إن لم ترغب بذلك الآن.</p>
            <Field label="اسم صاحب المحل"><input className="input" value={ownerName} onChange={e => setOwnerName(e.target.value)} /></Field>
            <div className="form-grid">
              <Field label="الرقم السري"><input className="input" type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="4 أرقام أو أكثر" dir="ltr" /></Field>
              <Field label="تأكيد الرقم السري"><input className="input" type="password" inputMode="numeric" value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ''))} dir="ltr" /></Field>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="btn-row">
              <button className="btn primary lg" style={{ flex: 1 }} onClick={() => { if (pin && (pin.length < 4 || pin !== pin2)) { setErr('الرقم السري يجب أن يكون 4 أرقام على الأقل ومطابقاً في الحقلين'); return } setErr(''); setStep(2) }}>التالي <ArrowLeft /></button>
              <button className="btn lg" onClick={() => setStep(0)}>رجوع</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="stack">
            <label className="checkbox card pad" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={demo} onChange={e => setDemo(e.target.checked)} style={{ marginTop: 3 }} />
              <div><div>أضف بيانات تجريبية للتعرّف على البرنامج</div><div className="help">منتجات وعملاء وفواتير للتجربة. يمكنك حذفها كلها من الإعدادات عند البدء بالعمل الفعلي.</div></div>
            </label>
            {err && <div className="error">{err}</div>}
            <div className="btn-row">
              <button className="btn primary lg" style={{ flex: 1 }} onClick={finish} disabled={busy}><Check /> ابدأ العمل</button>
              <button className="btn lg" onClick={() => setStep(1)} disabled={busy}>رجوع</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

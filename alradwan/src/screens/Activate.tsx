import { useState } from 'react'
import { KeyRound, MessageCircle, Copy, Check, Download, LogIn, ShieldCheck, Smartphone, Monitor, Globe, WifiOff, RefreshCw } from 'lucide-react'
import { activate, checkLicense, lastCode, shortDevice, useLicense } from '../lib/license'
import { useIsAdmin } from '../db/store'
import { platformName } from '../lib/platform'
import { SALES } from '../sales'
import { downloadBackup } from '../lib/backup'
import { fmtDate } from '../lib/format'

const ERR: Record<string, string> = {
  format: 'الكود 12 حرفاً ورقماً، مثل 7KQ2-M9XD-4FTR. انسخه كما وصلك.',
  invalid: 'هذا الكود غير موجود. تأكّد من كتابته كما وصلك.',
  used: 'هذا الكود مستخدم على العدد الأقصى من الأجهزة. اطلب من البائع فك جهاز قديم.',
  revoked: 'هذا الكود ملغى. تواصل مع البائع.',
  expired: 'انتهت مدة هذا الكود. تواصل مع البائع لتجديد الاشتراك.',
  network: 'لا يوجد اتصال بالإنترنت. التفعيل يحتاج إنترنت مرة واحدة: اتصل ثم اضغط «تفعيل» مرة أخرى.',
  wait: 'محاولات كثيرة خاطئة. انتظر ربع ساعة ثم حاول مرة أخرى.',
  'not-configured': 'خادم التفعيل غير جاهز بعد. تواصل مع البائع.',
  server: 'حدث خطأ في الخادم. حاول بعد قليل.',
}

/** Where the shop enters the code it bought; also the wall the app shows when there is no valid subscription. */
export function Activate({ shopName, onClose }: { shopName: string; onClose?: () => void }) {
  const lic = useLicense()
  const [code, setCode] = useState(() => lastCode())
  const [checking, setChecking] = useState(false)
  const isAdmin = useIsAdmin()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<'dev' | 'pay' | null>(null)
  const dev = shortDevice(lic.device)
  const wa = SALES.whatsapp ? `https://wa.me/${SALES.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`مرحباً، أريد كود تفعيل لبرنامج كراج الرضوان.\nاسم المحل: ${shopName}\nرقم الجهاز: ${dev}`)}` : ''
  const submit = async () => {
    setBusy(true)
    const r = await activate(code, `${platformName() === 'android' ? 'هاتف' : platformName() === 'windows' ? 'حاسوب' : 'متصفح'} · ${shopName}`)
    setBusy(false)
    setMsg(r === 'ok' ? { ok: true, text: 'تم التفعيل. البرنامج جاهز للعمل.' } : { ok: false, text: ERR[r] || ERR.server })
    if (r === 'ok') setTimeout(() => onClose?.(), 900)
  }
  const copy = (what: 'dev' | 'pay', text: string) => { try { navigator.clipboard?.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1500) } catch { /* ignore */ } }
  const wall = !onClose
  const recheck = async () => { setChecking(true); try { await checkLicense(true) } finally { setChecking(false) } }
  const active = lic.state === 'active'
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  return (
    <div className="activate">
      <div className="activate-box">
        <div className="activate-hero">
          <img src="./icon.svg" alt="" />
          <div>
            <h1>كراج الرضوان</h1>
            <p>نظام إدارة محل قطع غيار السيارات — بيع، مخزون، عملاء، محاسبة كاملة، سيارات وصيانة، على ويندوز وأندرويد والويب</p>
          </div>
          <div className="activate-platforms"><span><Monitor size={14} /> ويندوز</span><span><Smartphone size={14} /> أندرويد</span><span><Globe size={14} /> الويب</span></div>
        </div>

        {active ? (
          <div className="activate-body">
            <div className="activate-ok"><ShieldCheck size={40} /><div><b>البرنامج مفعّل</b><div className="muted small">{lic.until ? `الاشتراك صالح حتى ${fmtDate(lic.until)}` : 'اشتراك دائم'} · الكود <span className="mono">{lic.code}</span></div></div></div>
            {onClose && <button className="btn primary block mt" onClick={onClose}>متابعة العمل</button>}
          </div>
        ) : (
          <div className="activate-body activate-cols">
            <section className="activate-pay">
              {lic.notice ? <div className="badge tone-warning activate-notice">{lic.notice}</div> : wall && <div className="activate-notice muted">{lic.state === 'none' ? 'هذه النسخة تحتاج كود تفعيل. بياناتك محفوظة على الجهاز ولا تضيع.' : ''}</div>}
              <div className="activate-step"><span className="activate-num">١</span><div><b>ادفع قيمة الاشتراك</b>{SALES.price && <div className="activate-price">{SALES.price}</div>}</div></div>
              {SALES.shamCash && (
                <div className="activate-qr">
                  <img src="./shamcash-qr.png" alt="رمز شام كاش" />
                  <div>
                    <div className="small"><b>شام كاش</b> — امسح الرمز من التطبيق، أو انسخ العنوان:</div>
                    <div className="activate-addr"><span className="mono">{SALES.shamCash}</span><button className="btn sm ghost icon" onClick={() => copy('pay', SALES.shamCash)} aria-label="نسخ العنوان">{copied === 'pay' ? <Check /> : <Copy />}</button></div>
                    {SALES.syriatelCash && <div className="small mt">سيريتل كاش: <span className="mono">{SALES.syriatelCash}</span></div>}
                  </div>
                </div>
              )}
              <div className="activate-step"><span className="activate-num">٢</span><div><b>أرسل إيصال الدفع ورقم جهازك على واتساب</b><div className="small muted">يصلك كود التفعيل برسالة خلال دقائق</div></div></div>
              <div className="activate-device"><span className="small muted">رقم جهازك</span><b className="mono">{dev || '…'}</b><button className="btn sm ghost" onClick={() => copy('dev', dev)}>{copied === 'dev' ? <Check /> : <Copy />} {copied === 'dev' ? 'نُسخ' : 'نسخ'}</button></div>
              {wa && <a className="btn success block" href={wa} target="_blank" rel="noreferrer"><MessageCircle /> اطلب الكود على واتساب {SALES.whatsapp}</a>}
            </section>
            <section className="activate-enter">
              <div className="activate-step"><span className="activate-num">٣</span><div><b>أدخل كود التفعيل</b><div className="small muted">يعمل الكود على جهازين (حاسوب وهاتف) حتى نهاية الاشتراك</div></div></div>
              <input className="input lg mono activate-input" dir="ltr" value={code} onChange={e => { setCode(e.target.value); setMsg(null) }} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoFocus onKeyDown={e => { if (e.key === 'Enter') submit() }} />
              <button className="btn primary block lg" disabled={busy || code.replace(/[^0-9a-z]/gi, '').length < 12} onClick={submit}><LogIn /> {busy ? 'جارٍ التحقق…' : 'تفعيل'}</button>
              {msg && <div className={`badge ${msg.ok ? 'tone-success' : 'tone-danger'} activate-notice`}>{msg.text}</div>}
              {offline && !msg && <div className="badge tone-warning activate-notice"><WifiOff size={14} /> لا يوجد اتصال بالإنترنت الآن. التفعيل يحتاج اتصالاً مرة واحدة فقط.</div>}
              <p className="help">بعد التفعيل يعمل البرنامج بلا إنترنت، ويتحقق من الاشتراك عندما يتوفر الاتصال. كل بياناتك تبقى على جهازك.</p>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                {(lic.state === 'expired' || lic.state === 'blocked' || lic.state === 'grace') && <button className="btn" disabled={checking} onClick={recheck}><RefreshCw /> {checking ? 'جارٍ التحقق…' : 'جدّدتُ الاشتراك — تحقق الآن'}</button>}
                {wall && isAdmin && <button className="btn" onClick={() => downloadBackup().catch(() => {})}><Download /> حفظ نسخة احتياطية من بياناتي</button>}
                {onClose && <button className="btn" onClick={onClose}>لاحقاً</button>}
              </div>
            </section>
          </div>
        )}
        <div className="activate-foot"><KeyRound size={13} /> الأكواد تُباع من المطوّر حصراً · الدعم الفني على واتساب</div>
      </div>
    </div>
  )
}

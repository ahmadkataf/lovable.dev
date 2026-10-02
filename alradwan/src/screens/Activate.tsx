import { useState } from 'react'
import { KeyRound, MessageCircle, Copy, Check, Download, LogIn } from 'lucide-react'
import { activate, shortDevice, useLicense } from '../lib/license'
import { SALES } from '../sales'
import { downloadBackup } from '../lib/backup'
import { fmtDate } from '../lib/format'

const ERR: Record<string, string> = {
  format: 'الكود 12 حرفاً ورقماً، مثل 7KQ2-M9XD-4FTR. انسخه كما وصلك.',
  invalid: 'هذا الكود غير موجود. تأكّد من كتابته كما وصلك.',
  used: 'هذا الكود مستخدم على العدد الأقصى من الأجهزة. اطلب من البائع فك جهاز قديم.',
  revoked: 'هذا الكود ملغى. تواصل مع البائع.',
  expired: 'انتهت مدة هذا الكود. تواصل مع البائع لتجديد الاشتراك.',
  network: 'لا يوجد اتصال بالإنترنت. التفعيل يحتاج إنترنت، اتصل ثم أعد المحاولة.',
  wait: 'محاولات كثيرة خاطئة. انتظر ربع ساعة ثم حاول مرة أخرى.',
  'not-configured': 'خادم التفعيل غير جاهز بعد. تواصل مع البائع.',
  server: 'حدث خطأ في الخادم. حاول بعد قليل.',
}

/** Where the shop enters the code it bought; also the wall the app shows when the trial or the subscription is over. */
export function Activate({ shopName, onClose }: { shopName: string; onClose?: () => void }) {
  const lic = useLicense()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const dev = shortDevice(lic.device)
  const wa = SALES.whatsapp ? `https://wa.me/${SALES.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`مرحباً، أريد كود تفعيل لبرنامج كراج الرضوان.\nاسم المحل: ${shopName}\nرقم الجهاز: ${dev}`)}` : ''
  const submit = async () => {
    setBusy(true)
    const r = await activate(code, shopName)
    setBusy(false)
    setMsg(r === 'ok' ? { ok: true, text: 'تم التفعيل. البرنامج جاهز للعمل.' } : { ok: false, text: ERR[r] || ERR.server })
    if (r === 'ok') setTimeout(() => onClose?.(), 800)
  }
  const copy = () => { try { navigator.clipboard?.writeText(dev); setCopied(true) } catch { /* ignore */ } }
  const wall = !onClose
  return (
    <div className="login">
      <div className="card pad" style={{ maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <img src="./icon.svg" alt="" style={{ width: 64, height: 64, borderRadius: 16 }} />
          <h1 style={{ marginTop: 8 }}><KeyRound size={20} style={{ verticalAlign: -3 }} /> تفعيل البرنامج</h1>
          {lic.state === 'active' && <p className="muted">البرنامج مفعّل{lic.until ? ` حتى ${fmtDate(lic.until)}` : ' — اشتراك دائم'} · الكود <span className="mono">{lic.code}</span></p>}
          {lic.state === 'trial' && <p className="muted">النسخة التجريبية تنتهي في {fmtDate(lic.trialEnds)}. أدخل الكود لمتابعة العمل بلا انقطاع.</p>}
          {lic.state === 'none' && !lic.notice && <p className="muted">انتهت الفترة التجريبية. بياناتك محفوظة؛ أدخل كود التفعيل لمتابعة العمل.</p>}
          {lic.notice && <div className="badge tone-warning" style={{ whiteSpace: 'normal', textAlign: 'right' }}>{lic.notice}</div>}
        </div>
        {lic.state !== 'active' && (
          <div className="stack">
            {(SALES.price || SALES.whatsapp || SALES.shamCash || SALES.syriatelCash) && (
              <div className="card pad" style={{ background: 'var(--surface-2)' }}>
                <b>١. اشترِ الكود</b>
                {SALES.price && <div className="mt">السعر: <b>{SALES.price}</b></div>}
                {SALES.shamCash && <div className="mt" style={{ textAlign: 'center' }}><div className="small">ادفع عبر <b>شام كاش</b>: امسح الرمز أو انسخ العنوان</div><img src="./shamcash-qr.png" alt="رمز شام كاش" style={{ width: 180, height: 180, borderRadius: 12, margin: '6px auto', display: 'block', background: '#fff' }} /><div className="row" style={{ justifyContent: 'center' }}><span className="mono small" style={{ wordBreak: 'break-all' }}>{SALES.shamCash}</span><button className="btn sm ghost" onClick={() => { try { navigator.clipboard?.writeText(SALES.shamCash) } catch { /* ignore */ } }} title="نسخ العنوان"><Copy /></button></div></div>}
                {SALES.syriatelCash && <div className="small">سيريتل كاش: <span className="mono">{SALES.syriatelCash}</span></div>}
                <div className="row mt" style={{ flexWrap: 'wrap' }}>
                  <span className="small muted">رقم جهازك: <b className="mono">{dev || '…'}</b></span>
                  <button className="btn sm ghost" onClick={copy}>{copied ? <Check /> : <Copy />} {copied ? 'نُسخ' : 'نسخ'}</button>
                  {wa && <a className="btn sm success" href={wa} target="_blank" rel="noreferrer"><MessageCircle /> اطلب الكود واتساب</a>}
                </div>
              </div>
            )}
            <div>
              <b>{SALES.whatsapp ? '٢. ' : ''}أدخل كود التفعيل</b>
              <input className="input lg mt mono" dir="ltr" value={code} onChange={e => { setCode(e.target.value); setMsg(null) }} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoFocus onKeyDown={e => { if (e.key === 'Enter') submit() }} />
              <button className="btn primary block lg mt" disabled={busy || code.replace(/[^0-9a-z]/gi, '').length < 12} onClick={submit}><LogIn /> {busy ? 'جارٍ التحقق…' : 'تفعيل'}</button>
              {msg && <div className={`badge ${msg.ok ? 'tone-success' : 'tone-danger'} mt`} style={{ whiteSpace: 'normal', textAlign: 'right' }}>{msg.text}</div>}
              <p className="help mt">يحتاج التفعيل اتصالاً بالإنترنت مرة واحدة، ثم يعمل البرنامج بلا إنترنت ويتحقق من الاشتراك عندما يتوفر الاتصال.</p>
            </div>
          </div>
        )}
        <div className="btn-row mt" style={{ justifyContent: 'center' }}>
          {wall && <button className="btn" onClick={() => downloadBackup().catch(() => {})}><Download /> حفظ نسخة احتياطية من بياناتي</button>}
          {onClose && <button className="btn" onClick={onClose}>{lic.state === 'active' ? 'إغلاق' : 'لاحقاً'}</button>}
        </div>
      </div>
    </div>
  )
}

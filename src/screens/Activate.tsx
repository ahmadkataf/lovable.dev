import { useEffect, useState } from 'react'
import meta from '@book-meta'
import sales from '../sales.json'
import shamCashQr from '../assets/shamcash-qr.svg'
import type { Access } from '../engine/access'
import { discounted, onlineBook, playStore, savedInvite, type OnlineAccess } from '../engine/online'

const ERR: Record<string, string> = {
  format: onlineBook ? 'الكود 12 حرفاً ورقماً، مثل 7KQ2-M9XD-4FTR. انسخه كما وصلك.' : 'الكود غير مكتمل أو فيه حرف خاطئ. انسخه كما وصلك (16 حرفاً ورقماً).',
  device: 'هذا الكود ليس لهذا الجهاز أو ليس لهذا التطبيق. تأكّد أنك أرسلت رقم الجهاز الظاهر هنا.',
  expired: 'انتهت مدة هذا الكود. تواصل معنا لتجديد الاشتراك.',
  invalid: 'هذا الكود غير موجود. تأكّد من كتابته كما وصلك.',
  book: 'هذا الكود لتطبيق آخر (صف آخر)، وليس لهذا التطبيق.',
  used: 'هذا الكود مفعّل على جهاز آخر. كل كود يعمل على جهاز واحد فقط.',
  revoked: 'هذا الكود ملغى. تواصل معنا.',
  network: 'لا يوجد اتصال بالإنترنت. التفعيل يحتاج إنترنت، اتصل ثم أعد المحاولة.',
  wait: 'محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.',
  server: 'حدث خطأ في الخادم. حاول بعد قليل.',
  name: 'اكتب اسمك (حرفين على الأقل).',
  phone: 'اكتب رقم واتساب صحيحاً، مثل 0944123456.',
  invite: 'كود الدعوة غير صحيح. امسحه أو اكتبه كما وصلك.',
  'self-invite': 'لا يمكنك استخدام كود الدعوة الخاص بك 😉',
}

function copy(text: string) {
  try { navigator.clipboard?.writeText(text) } catch { /* ignore */ }
}

export default function Activate({ access, onClose }: { access: Access; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [paid, setPaid] = useState(false)
  const price = (sales.price as Record<string, string>)[meta.id]
  const request = onlineBook
    ? `مرحباً، دفعت اشتراك تطبيق ${meta.appName} (${meta.titleAr}) عبر شام كاش، وهذه صورة الإيصال. أرجو إرسال كود التفعيل.`
    : `مرحباً، أريد تفعيل تطبيق ${meta.appName} (${meta.titleAr}).\nرقم الجهاز: ${access.device}`
  const waLink = (text: string) => sales.whatsapp ? `https://wa.me/${sales.whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}` : ''
  const wa = waLink(request)

  const submit = async () => {
    setBusy(true)
    const r = await access.activate(code)
    setBusy(false)
    setMsg(r === 'ok' ? { ok: true, text: '🎉 تم التفعيل! كل الدروس والامتحانات مفتوحة الآن.' } : { ok: false, text: ERR[r] || ERR.server })
  }

  return (
    <div className="page activate fade">
      <div className="row spread">
        <div className="h1">🔑 تفعيل التطبيق</div>
        <button onClick={onClose} aria-label="إغلاق" style={{ fontSize: 22, color: 'var(--gray-4)' }}>✕</button>
      </div>

      {access.pro ? (
        <div className="card center">
          <div style={{ fontSize: 44 }}>✅</div>
          <div className="h2">التطبيق مفعّل</div>
          <p className="muted">{access.until ? `الاشتراك صالح حتى ${access.until.toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' })}` : 'اشتراك دائم'}</p>
          <button className="btn btn-primary btn-block" onClick={onClose}>متابعة التعلّم</button>
        </div>
      ) : onlineBook ? (
        <>
          <p className="muted">الوحدة الأولى والنموذج الأول من الامتحانات مجانية. {playStore ? 'إذا كان لديك كود تفعيل فأدخله هنا لتفتح' : 'فعّل التطبيق لتفتح'} كل الوحدات، وكتاب الأنشطة، والإنشاء والترجمة، وكل نماذج الامتحانات.</p>
          {(access as OnlineAccess).notice && <div className="hint mb bad-hint">{(access as OnlineAccess).notice}</div>}
          {!playStore && <PayAndRequest access={access as OnlineAccess} price={price} paid={paid} setPaid={setPaid} copied={copied} setCopied={setCopied} waLink={waLink} />}
          <div className="card">
            <div className="h2">{playStore ? 'لديك كود تفعيل؟' : 'عندك كود من مكتبة أو أستاذ؟'}</div>
            <p className="muted" style={{ fontSize: 13 }}>يحتاج التفعيل اتصالاً بالإنترنت، والكود يعمل على هذا الجهاز فقط.</p>
            <input className="type-input en code-input" dir="ltr" value={code} onChange={e => { setCode(e.target.value); setMsg(null) }} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
            <button className="btn btn-blue btn-block mt" disabled={busy || code.replace(/[^0-9a-z]/gi, '').length < 12} onClick={submit}>{busy ? '⏳ جارٍ التحقق…' : 'تفعيل'}</button>
            {msg && <div className={`hint mt ${msg.ok ? 'ok-hint' : 'bad-hint'}`}>{msg.text}</div>}
          </div>
          <p className="muted center mt" style={{ fontSize: 12 }}>رقم الجهاز (للدعم الفني): <span className="en">{access.device}</span></p>
        </>
      ) : (
        <>
          <p className="muted">الوحدة الأولى والنموذج الأول من الامتحانات مجانية. فعّل التطبيق لتفتح كل الوحدات، وكتاب الأنشطة، والإنشاء والترجمة، وكل نماذج الامتحانات.</p>

          <div className="card mb">
            <div className="h2">١. رقم جهازك</div>
            <div className="device-no en">{access.device || '…'}</div>
            <button className="btn btn-outline btn-block btn-sm" onClick={() => { copy(access.device); setCopied(true) }}>{copied ? '✓ نُسخ' : 'انسخ رقم الجهاز'}</button>
          </div>

          <div className="card mb">
            <div className="h2">٢. ادفع وأرسل رقم الجهاز</div>
            {price && <p><b>السعر:</b> {price}{sales.validity ? ` · ${sales.validity}` : ''}</p>}
            <div className="pay-list">
              {sales.shamCash && <div className="pay-row"><b>شام كاش</b><span className="en" dir="ltr">{sales.shamCash}</span></div>}
              {sales.syriatelCash && <div className="pay-row"><b>سيريتل كاش</b><span className="en" dir="ltr">{sales.syriatelCash}</span></div>}
              <div className="pay-row"><b>نقداً</b><span>عن طريق أستاذك أو المكتبة المعتمدة</span></div>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>بعد الدفع أرسل صورة الإيصال مع رقم جهازك، فيصلك كود التفعيل.</p>
            {wa
              ? <a className="btn btn-primary btn-block" href={wa} target="_blank" rel="noreferrer">💬 أرسل رقم الجهاز على واتساب</a>
              : <p className="muted" style={{ fontSize: 13 }}>أرسل رقم الجهاز إلى الأستاذ أو الجهة التي اشتريت منها.</p>}
          </div>

          <div className="card">
            <div className="h2">٣. أدخل كود التفعيل</div>
            <input className="type-input en code-input" dir="ltr" value={code} onChange={e => { setCode(e.target.value); setMsg(null) }} placeholder="XXXX-XXXX-XXXX-XXXX" autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
            <button className="btn btn-blue btn-block mt" disabled={busy || code.replace(/[^0-9a-z]/gi, '').length < 16} onClick={submit}>تفعيل</button>
            {msg && <div className={`hint mt ${msg.ok ? 'ok-hint' : 'bad-hint'}`}>{msg.text}</div>}
          </div>
        </>
      )}
    </div>
  )
}

/** Pay with Sham Cash, then send a request: the seller approves it and the app activates by itself. */
function PayAndRequest({ access, price, paid, setPaid, copied, setCopied, waLink }: {
  access: OnlineAccess; price: string; paid: boolean; setPaid: (v: boolean) => void; copied: boolean; setCopied: (v: boolean) => void; waLink: (t: string) => string
}) {
  const [invite, setInvite] = useState(savedInvite())
  const [disc, setDisc] = useState<number | null>(null)
  const [invMsg, setInvMsg] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [payRef, setPayRef] = useState('')
  const [err, setErr] = useState('')
  const [sending, setSending] = useState(false)
  const clean = invite.toUpperCase().replace(/[^0-9A-Z]/g, '')
  const toPay = disc ? discounted(price || '', disc) : price
  const req = access.request

  useEffect(() => {
    setDisc(null); setInvMsg('')
    if (clean.length !== 6) { if (clean.length > 6) setInvMsg(ERR.invite); return }
    let live = true
    const t = setTimeout(async () => {
      const d = await access.checkInvite(clean)
      if (!live) return
      if (d === null) setInvMsg(ERR.invite); else { setDisc(d); setInvMsg('') }
    }, 400)
    return () => { live = false; clearTimeout(t) }
  }, [clean]) // eslint-disable-line

  const send = async () => {
    setErr(''); setSending(true)
    const r = await access.sendRequest({ name, phone, payRef, invite: clean.length === 6 && disc !== null ? clean : '', price: toPay || '' })
    setSending(false)
    if (!r.ok) setErr(ERR[r.error] || ERR.server)
  }

  if (req?.status === 'pending') {
    const text = `مرحباً، أرسلت طلب اشتراك رقم #${req.id} في تطبيق ${meta.appName}، وهذه صورة إيصال شام كاش.`
    return (
      <div className="card mb fade">
        <div className="h2">⏳ طلبك رقم #{req.id} وصلنا</div>
        <p className="muted" style={{ fontSize: 14 }}>منتأكد من الدفع ومنوافق بأسرع وقت. أول ما نوافق، التطبيق بيتفعّل لحاله وانت فاتحه (خلّي الإنترنت شغّال).</p>
        {waLink(text) && <a className="btn btn-primary btn-block" href={waLink(text)} target="_blank" rel="noreferrer">💬 أرسل صورة الإيصال على واتساب (أسرع)</a>}
        <button className="btn btn-outline btn-block btn-sm mt" onClick={() => access.checkRequest()}>↻ تحقّق من حالة الطلب</button>
      </div>
    )
  }

  return (
    <>
      <div className="card mb">
        <div className="h2">١. ادفع الاشتراك عبر شام كاش</div>
        <label className="muted" style={{ fontSize: 13, display: 'block' }}>عندك كود دعوة من صاحبك؟ (اختياري)</label>
        <input className="type-input en code-input" dir="ltr" value={invite} onChange={e => setInvite(e.target.value)} placeholder="ABC123" maxLength={8} autoCapitalize="characters" autoCorrect="off" spellCheck={false} style={{ fontSize: 18 }} />
        {disc !== null && <div className="hint ok-hint" style={{ marginTop: 6 }}>{disc ? `🎁 كود الدعوة صحيح: خصم ${disc}%` : '✓ كود الدعوة صحيح'}</div>}
        {invMsg && <div className="hint bad-hint" style={{ marginTop: 6 }}>{invMsg}</div>}
        {price && <p><b>السعر:</b> {disc ? <><s className="muted">{price}</s> <b style={{ color: 'var(--green)' }}>{toPay}</b></> : price}{sales.validity ? ` · ${sales.validity}` : ''}</p>}
        {sales.shamCash && <>
          <p className="muted" style={{ fontSize: 13 }}>افتح تطبيق شام كاش، ثم امسح هذا الرمز أو انسخ العنوان تحته، وادفع قيمة الاشتراك.</p>
          <img className="pay-qr" src={shamCashQr} alt="رمز شام كاش" />
          <div className="pay-address en" dir="ltr">{sales.shamCash}</div>
          <button className="btn btn-outline btn-block btn-sm" onClick={() => { copy(sales.shamCash); setCopied(true) }}>{copied ? '✓ نُسخ العنوان' : 'انسخ عنوان شام كاش'}</button>
        </>}
        {sales.syriatelCash && <div className="pay-row mt"><b>سيريتل كاش</b><span className="en" dir="ltr">{sales.syriatelCash}</span></div>}
        {!paid && <button className="btn btn-primary btn-block mt" onClick={() => setPaid(true)}>✅ دفعت، أرسل طلب التفعيل</button>}
      </div>
      {paid && <div className="card mb fade">
        <div className="h2">٢. أرسل طلب التفعيل</div>
        <p className="muted" style={{ fontSize: 13 }}>بعد ما نتأكد من الدفع منوافق على طلبك، والتطبيق بيتفعّل لحاله بدون ما تكتب أي كود.</p>
        <input className="type-input" value={name} onChange={e => setName(e.target.value)} placeholder="اسمك" style={{ marginBottom: 8 }} />
        <input className="type-input en" dir="ltr" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="رقم واتساب: 09xx xxx xxx" style={{ marginBottom: 8 }} />
        <input className="type-input en" dir="ltr" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="رقم العملية من إيصال شام كاش (اختياري)" />
        <button className="btn btn-primary btn-block mt" disabled={sending} onClick={send}>{sending ? '⏳ جارٍ الإرسال…' : '📨 أرسل الطلب'}</button>
        {err && <div className="hint mt bad-hint">{err}</div>}
      </div>}
    </>
  )
}

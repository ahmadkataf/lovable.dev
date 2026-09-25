import { useState } from 'react'
import meta from '@book-meta'
import sales from '../sales.json'
import type { Access } from '../engine/access'
import { onlineBook, playStore, type OnlineAccess } from '../engine/online'

const ERR: Record<string, string> = {
  format: onlineBook ? 'الكود 12 حرفاً ورقماً، مثل 7KQ2-M9XD-4FTR. انسخه كما وصلك.' : 'الكود غير مكتمل أو فيه حرف خاطئ. انسخه كما وصلك (16 حرفاً ورقماً).',
  device: 'هذا الكود ليس لهذا الجهاز أو ليس لهذا التطبيق. تأكّد أنك أرسلت رقم الجهاز الظاهر هنا.',
  expired: 'انتهت مدة هذا الكود. تواصل معنا لتجديد الاشتراك.',
  invalid: 'هذا الكود غير موجود. تأكّد من كتابته كما وصلك.',
  book: 'هذا الكود لتطبيق آخر (صف آخر)، وليس لهذا التطبيق.',
  used: 'هذا الكود مفعّل على جهاز آخر. كل كود يعمل على جهاز واحد فقط.',
  revoked: 'هذا الكود ملغى. تواصل معنا.',
  network: 'لا يوجد اتصال بالإنترنت. التفعيل يحتاج إنترنت، اتصل ثم أعد المحاولة.',
  wait: 'محاولات كثيرة خاطئة. انتظر ربع ساعة ثم حاول مرة أخرى.',
  server: 'حدث خطأ في الخادم. حاول بعد قليل.',
}

function copy(text: string) {
  try { navigator.clipboard?.writeText(text) } catch { /* ignore */ }
}

export default function Activate({ access, onClose }: { access: Access; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const price = (sales.price as Record<string, string>)[meta.id]
  const request = onlineBook
    ? `مرحباً، أريد شراء كود تفعيل لتطبيق ${meta.appName} (${meta.titleAr}).`
    : `مرحباً، أريد تفعيل تطبيق ${meta.appName} (${meta.titleAr}).\nرقم الجهاز: ${access.device}`
  const wa = sales.whatsapp ? `https://wa.me/${sales.whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(request)}` : ''

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
          {!playStore && <div className="card mb">
            <div className="h2">١. اشترِ كود التفعيل</div>
            {price && <p><b>السعر:</b> {price}{sales.validity ? ` · ${sales.validity}` : ''}</p>}
            <div className="pay-list">
              {sales.shamCash && <div className="pay-row"><b>شام كاش</b><span className="en" dir="ltr">{sales.shamCash}</span></div>}
              {sales.syriatelCash && <div className="pay-row"><b>سيريتل كاش</b><span className="en" dir="ltr">{sales.syriatelCash}</span></div>}
              <div className="pay-row"><b>نقداً</b><span>من أستاذك أو المكتبة المعتمدة (بطاقة فيها الكود)</span></div>
            </div>
            <p className="muted" style={{ fontSize: 13 }}>إذا دفعت بشام كاش أو سيريتل كاش أرسل صورة الإيصال، فيصلك الكود برسالة.</p>
            {wa && <a className="btn btn-primary btn-block" href={wa} target="_blank" rel="noreferrer">💬 اطلب الكود على واتساب</a>}
          </div>}
          <div className="card">
            <div className="h2">{playStore ? 'لديك كود تفعيل؟' : '٢. أدخل الكود'}</div>
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

// /team/settings — الإعدادات (admin): centre info + hours (offline-capable, via the store), Sham Cash payment panel
// with a live preview, team accounts, announcements and reports (these three need the network).
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useLiveForm } from './useLiveForm'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Booking, Role, Settings as SettingsT, User } from '@shared/types'
import { api, ApiError } from '../api'
import { fmtClock, fmtDate, fmtSYP, fmtTime, normalisePhone, statusLabel, todayLocal, toLocalParts } from '../format'
import { cachedGet } from '../offline'
import { useTeam } from '../team'
import { Badge, Button, Card, Empty, Field, Icon, Input, Segmented, Select, Sheet, Spinner, Tabs, Textarea, Toggle, useToast } from '../ui'
import { Confirm, PageHead } from './common'
import { store, useStore } from './store'
import { describeError, downloadText, METHOD, parseInt10, toCSV, toMin } from './util'
import { playChime, setSoundMuted, soundMuted } from './sound'

type TabId = 'centre' | 'payment' | 'team' | 'announce' | 'reports'
const TABS: { id: TabId; label: string }[] = [
  { id: 'centre', label: 'المركز' }, { id: 'payment', label: 'الدفع' }, { id: 'team', label: 'الفريق' }, { id: 'announce', label: 'إعلان' }, { id: 'reports', label: 'التقارير' },
]

export function Settings() {
  const { ready, view } = useStore()
  const params = useParams()
  const navigate = useNavigate()
  const tab = (TABS.some((t) => t.id === params['*']) ? params['*'] : 'centre') as TabId
  if (!ready) return <div className="center center-pad"><Spinner /></div>
  if (!view.settings) return <Empty title="الإعدادات غير متاحة بعد" hint="يحتاج أول اتصال بالإنترنت لتحميلها." />
  return (
    <>
      <PageHead title="الإعدادات" />
      <div className="quick-links">
        <Link to="/team/site" className="card quick-link is-wide"><Icon name="globe" size={20} /> الموقع: النصوص والصور</Link>
        <Link to="/team/plan" className="card quick-link"><Icon name="grid" size={20} /> مخطط المركز</Link>
        <Link to="/team/customers" className="card quick-link"><Icon name="people" size={20} /> الزبائن</Link>
      </div>
      <div className="mb"><Tabs tabs={TABS} value={tab} onChange={(id) => navigate(`/team/settings/${id === 'centre' ? '' : id}`)} /></div>
      {tab === 'centre' && <CentreTab settings={view.settings} />}
      {tab === 'payment' && <PaymentTab settings={view.settings} />}
      {tab === 'team' && <TeamTab />}
      {tab === 'announce' && <AnnounceTab />}
      {tab === 'reports' && <ReportsTab />}
    </>
  )
}

// ---------- المركز ----------
function CentreTab({ settings }: { settings: SettingsT }) {
  const toast = useToast()
  const { sync } = useStore()
  const [d, setD] = useState(() => pick(settings))
  const [errors, setErrors] = useState<Record<string, string>>({})
  useLiveForm(pick(settings), 'centre', () => d, setD)   // never wipes unsaved edits on a background sync
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }))

  async function save() {
    const e: Record<string, string> = {}
    if (d.centre_name.trim().length < 2) e.centre_name = 'اكتب اسم المركز'
    if (d.phone.trim().length < 6) e.phone = 'رقم الهاتف غير صحيح'
    if (!/^\d{2}:\d{2}$/.test(d.open) || !/^\d{2}:\d{2}$/.test(d.close) || toMin(d.open) >= toMin(d.close)) e.hours = 'الافتتاح يجب أن يكون قبل الإغلاق'
    const min = parseInt10(d.min_minutes), max = parseInt10(d.max_minutes), hold = parseInt10(d.hold_minutes)
    if (min === null || min < 30 || min % d.slot_minutes !== 0) e.min_minutes = `مضاعف لـ${d.slot_minutes} دقيقة`
    if (max === null || max > 1440 || max % d.slot_minutes !== 0 || (min !== null && max < min)) e.max_minutes = `مضاعف لـ${d.slot_minutes} ولا يقل عن الأدنى`
    if (hold === null || hold < 5 || hold > 180) e.hold_minutes = 'بين 5 و180 دقيقة'
    const horizon = parseInt10(d.booking_horizon_days)
    if (horizon === null || horizon < 1 || horizon > 365) e.booking_horizon_days = 'بين 1 و365 يوماً'
    if (d.booking_closed_message.trim().length > 500) e.booking_closed_message = 'حتى 500 حرف'
    setErrors(e)
    if (Object.keys(e).length) return
    const patch: Partial<SettingsT> = {}
    const next = {
      ...d, centre_name: d.centre_name.trim(), phone: d.phone.trim(), address: d.address.trim(), instagram: d.instagram.trim().replace(/^@/, ''), min_minutes: min!, max_minutes: max!, hold_minutes: hold!,
      booking_closed_message: d.booking_closed_message.trim(), booking_horizon_days: horizon!,
    }
    const current = { ...settings, ...capabilityDefaults(settings) }
    for (const k of ['centre_name', 'phone', 'address', 'instagram', 'open', 'close', 'slot_minutes', 'min_minutes', 'max_minutes', 'hold_minutes',
      'booking_enabled', 'booking_closed_message', 'booking_horizon_days', 'reminder_minutes', 'customer_can_cancel'] as const) {
      if (next[k] !== current[k]) (patch as Record<string, unknown>)[k] = next[k]
    }
    if (Object.keys(patch).length === 0) { toast.show('لا تغييرات', 'info'); return }
    try {
      await store.patchSettings(patch, 'تعديل بيانات المركز')
      toast.show(sync.online ? 'تم الحفظ' : 'حُفظ على الجهاز — سيُرسَل عند الاتصال', 'ok')
    } catch (err) { toast.show(describeError(err), 'error') }
  }

  return (
    <div className="settings-grid">
      <Card>
        <div className="card-title">بيانات المركز</div>
        <Field label="اسم المركز" error={errors.centre_name}><Input value={d.centre_name} onChange={(e) => set('centre_name', e.target.value)} /></Field>
        <Field label="رقم الهاتف" error={errors.phone}><Input dir="ltr" inputMode="tel" value={d.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="العنوان"><Input value={d.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="إنستغرام" hint="اسم الحساب بدون @"><Input dir="ltr" value={d.instagram} onChange={(e) => set('instagram', e.target.value)} /></Field>
      </Card>
      <Card>
        <div className="card-title">ساعات العمل والحجز</div>
        <div className="two">
          <Field label="الافتتاح" error={errors.hours}><Input type="time" dir="ltr" step={1800} value={d.open} onChange={(e) => set('open', e.target.value)} /></Field>
          <Field label="الإغلاق"><Input type="time" dir="ltr" step={1800} value={d.close} onChange={(e) => set('close', e.target.value)} /></Field>
        </div>
        <Field label="طول الخانة">
          <Segmented<'30' | '60'> options={[{ value: '30', label: 'نص ساعة' }, { value: '60', label: 'ساعة' }]} value={String(d.slot_minutes) as '30' | '60'} onChange={(v) => set('slot_minutes', Number(v) as 30 | 60)} />
        </Field>
        <div className="two">
          <Field label="أقل مدة (دقيقة)" error={errors.min_minutes}><Input dir="ltr" inputMode="numeric" value={d.min_minutes} onChange={(e) => set('min_minutes', e.target.value)} /></Field>
          <Field label="أطول مدة (دقيقة)" error={errors.max_minutes}><Input dir="ltr" inputMode="numeric" value={d.max_minutes} onChange={(e) => set('max_minutes', e.target.value)} /></Field>
        </div>
        <Field label="مهلة الدفع (دقيقة)" hint="يبقى المكان محجوزاً للزبون هذه المدة حتى يُدخل رقم عملية شام كاش" error={errors.hold_minutes}>
          <Input dir="ltr" inputMode="numeric" value={d.hold_minutes} onChange={(e) => set('hold_minutes', e.target.value)} />
        </Field>
        <p className="muted small mt">يفتح المركز {fmtClock(d.open)} ويغلق {fmtClock(d.close)} يومياً.</p>
        <Button block className="mt" onClick={save}>حفظ</Button>
      </Card>
      <Card>
        <div className="card-title">الحجز أونلاين</div>
        <div className="opt-row">
          <div>
            <Toggle label="استقبال الحجوزات من الموقع والتطبيق" checked={d.booking_enabled} onChange={(v) => set('booking_enabled', v)} />
            <p className="opt-help">عند الإيقاف تعرض صفحات الحجز رسالة بدل النموذج، وتبقى أزرار «احجز» توصل إليها. الحجوزات اليدوية من اللوحة تبقى متاحة.</p>
          </div>
        </div>
        {!d.booking_enabled && <div className="alert alert-error" style={{ marginBottom: 12 }}>الحجز أونلاين متوقف بعد الحفظ — لن يستطيع الزبائن الحجز حتى تعيد تشغيله.</div>}
        <Field label="رسالة إيقاف الحجز (اختياري)" hint="تظهر للزبائن أثناء الإيقاف. فارغة = النص من «الموقع › الحجز والدفع»." error={errors.booking_closed_message}>
          <Textarea rows={2} maxLength={500} value={d.booking_closed_message} onChange={(e) => set('booking_closed_message', e.target.value)} placeholder="مثال: الحجز متوقف خلال العيد، نرجع يوم الأحد" />
        </Field>
        <Field label="أيام الحجز المتاحة للأمام" hint="كم يوماً قادماً يظهر للزبون في صفحة الحجز، واليوم منها. بين 1 و365." error={errors.booking_horizon_days}>
          <Input dir="ltr" inputMode="numeric" value={d.booking_horizon_days} onChange={(e) => set('booking_horizon_days', e.target.value)} style={{ maxWidth: 160 }} />
        </Field>
        <Field label="تذكير الزبون قبل موعده" hint="إشعار على جهاز الزبون قبل بداية حجزه المؤكد. إذا غيّرت المدة، عدّل جملة «نذكّرك قبله بساعة» ونص التذكير من «الموقع»." >
          <Select value={String(d.reminder_minutes)} onChange={(e) => set('reminder_minutes', Number(e.target.value))}>
            {reminderOptions(d.reminder_minutes).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <div className="opt-row mt">
          <div>
            <Toggle label="الزبون يستطيع إلغاء حجزه قبل التأكيد" checked={d.customer_can_cancel} onChange={(v) => set('customer_can_cancel', v)} />
            <p className="opt-help">عند الإيقاف يختفي زر «إلغاء الحجز» من صفحة الزبون، ويلغي الفريق عند الطلب.</p>
          </div>
        </div>
        <Button block className="mt" onClick={save}>حفظ</Button>
      </Card>
      <DeviceCard />
    </div>
  )
}

/** Per-device preferences (not synced): the new-booking chime, plus the privacy policy link. */
function DeviceCard() {
  const [muted, setMuted] = useState(() => soundMuted())
  return (
    <Card>
      <div className="card-title">هذا الجهاز</div>
      <div className="row between gap">
        <Toggle label="صوت تنبيه عند حجز أو دفعة جديدة" checked={!muted} onChange={(on) => { setSoundMuted(!on); setMuted(!on); if (on) void playChime() }} />
      </div>
      <p className="muted tiny mt-sm">يُسمع التنبيه عندما تكون اللوحة مفتوحة؛ الإشعارات على الهاتف لها صوتها الخاص.</p>
      {/* Static page served by the Worker — a plain link so the SPA router does not catch it. */}
      <p className="mt small"><a href="/privacy">سياسة الخصوصية</a> <span className="muted">· تُعرض للزبائن أيضاً في أسفل التطبيق</span></p>
    </Card>
  )
}
/** The booking & payment capability settings with today's behaviour when the server has not sent them yet. */
function capabilityDefaults(s: SettingsT) {
  return {
    booking_enabled: s.booking_enabled ?? true,
    booking_closed_message: s.booking_closed_message ?? '',
    shamcash_enabled: s.shamcash_enabled ?? true,
    booking_horizon_days: s.booking_horizon_days ?? 14,
    reminder_minutes: s.reminder_minutes ?? 60,
    max_open_holds_per_phone: s.max_open_holds_per_phone ?? 3,
    customer_can_cancel: s.customer_can_cancel ?? true,
  }
}
const REMINDERS: { value: number; label: string }[] = [
  { value: 0, label: 'بدون تذكير' }, { value: 15, label: 'قبل ربع ساعة' }, { value: 30, label: 'قبل نصف ساعة' }, { value: 60, label: 'قبل ساعة' },
  { value: 120, label: 'قبل ساعتين' }, { value: 180, label: 'قبل 3 ساعات' }, { value: 360, label: 'قبل 6 ساعات' }, { value: 1440, label: 'قبل يوم' },
]
/** The fixed choices, plus the stored value when it was set to something else (e.g. 45) so it is never lost. */
const reminderOptions = (current: number) =>
  REMINDERS.some((r) => r.value === current) ? REMINDERS : [...REMINDERS, { value: current, label: `قبل ${current} دقيقة` }].sort((a, b) => a.value - b.value)

const pick = (s: SettingsT) => {
  const c = capabilityDefaults(s)
  return {
    centre_name: s.centre_name, phone: s.phone, address: s.address, instagram: s.instagram, open: s.open, close: s.close,
    slot_minutes: s.slot_minutes, min_minutes: String(s.min_minutes), max_minutes: String(s.max_minutes), hold_minutes: String(s.hold_minutes),
    booking_enabled: c.booking_enabled, booking_closed_message: c.booking_closed_message, booking_horizon_days: String(c.booking_horizon_days),
    reminder_minutes: c.reminder_minutes, customer_can_cancel: c.customer_can_cancel,
  }
}

// ---------- الدفع ----------
const MAX_QR_CHARS = 300 * 1024

/** Resize an uploaded image to ≤512px on a canvas and return a PNG (or JPEG when PNG is too big) data URL. */
async function toQrDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = url })
    const scale = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    let out = canvas.toDataURL('image/png')
    if (out.length > MAX_QR_CHARS) out = canvas.toDataURL('image/jpeg', 0.85)
    if (out.length > MAX_QR_CHARS) throw new Error('الصورة كبيرة جداً حتى بعد التصغير')
    return out
  } finally { URL.revokeObjectURL(url) }
}

function PaymentTab({ settings }: { settings: SettingsT }) {
  const toast = useToast()
  const { sync, view } = useStore()
  const [number, setNumber] = useState(settings.shamcash_number)
  const [name, setName] = useState(settings.shamcash_name)
  const [qr, setQr] = useState<string | null>(settings.shamcash_qr)
  const [instructions, setInstructions] = useState(settings.payment_instructions)
  const [cash, setCash] = useState(!!settings.allow_pay_on_arrival)
  const [sham, setSham] = useState(capabilityDefaults(settings).shamcash_enabled)
  const [holds, setHolds] = useState(String(capabilityDefaults(settings).max_open_holds_per_phone))
  const [holdsError, setHoldsError] = useState<string | undefined>()
  // never wipes unsaved edits on a background sync (see useLiveForm)
  useLiveForm(
    { number: settings.shamcash_number, name: settings.shamcash_name, qr: settings.shamcash_qr, instructions: settings.payment_instructions,
      cash: !!settings.allow_pay_on_arrival, sham: capabilityDefaults(settings).shamcash_enabled, holds: String(capabilityDefaults(settings).max_open_holds_per_phone) },
    'payment',
    () => ({ number, name, qr, instructions, cash, sham, holds }),
    (v) => { setNumber(v.number); setName(v.name); setQr(v.qr); setInstructions(v.instructions); setCash(v.cash); setSham(v.sham); setHolds(v.holds) },
  )
  // At least one payment method stays on (the server refuses a settings patch that turns both off).
  const ONE_METHOD = 'لازم تبقى طريقة دفع واحدة على الأقل مفعّلة'
  const toggleSham = (v: boolean) => { if (!v && !cash) { toast.show(ONE_METHOD, 'error'); return } setSham(v) }
  const toggleCash = (v: boolean) => { if (!v && !sham) { toast.show(ONE_METHOD, 'error'); return } setCash(v) }
  const sample = view.rooms.find((r) => r.active) ?? null
  const amount = sample ? sample.price_hour * 2 : 100000

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { setQr(await toQrDataUrl(f)) } catch (err) { toast.show(err instanceof Error && /[؀-ۿ]/.test(err.message) ? err.message : 'تعذّر قراءة الصورة', 'error') }
  }
  async function save() {
    if (!sham && !cash) { toast.show(ONE_METHOD, 'error'); return }
    const maxHolds = parseInt10(holds)
    if (maxHolds === null || maxHolds < 1 || maxHolds > 20) { setHoldsError('بين 1 و20'); return }
    setHoldsError(undefined)
    const caps = capabilityDefaults(settings)
    const patch: Partial<SettingsT> = {}
    if (sham !== caps.shamcash_enabled) patch.shamcash_enabled = sham
    if (maxHolds !== caps.max_open_holds_per_phone) patch.max_open_holds_per_phone = maxHolds
    if (number.trim() !== settings.shamcash_number) patch.shamcash_number = number.trim()
    if (name.trim() !== settings.shamcash_name) patch.shamcash_name = name.trim()
    if (qr !== settings.shamcash_qr) patch.shamcash_qr = qr
    if (instructions.trim() !== settings.payment_instructions) patch.payment_instructions = instructions.trim()
    if (cash !== !!settings.allow_pay_on_arrival) patch.allow_pay_on_arrival = cash
    if (Object.keys(patch).length === 0) { toast.show('لا تغييرات', 'info'); return }
    try {
      await store.patchSettings(patch, 'تعديل بيانات الدفع')
      toast.show(sync.online ? 'تم الحفظ' : 'حُفظ على الجهاز — سيُرسَل عند الاتصال', 'ok')
    } catch (err) { toast.show(describeError(err), 'error') }
  }

  return (
    <div className="settings-grid">
      <Card>
        <div className="card-title">طرق الدفع</div>
        <div className="opt-row">
          <div>
            <Toggle label="تحويل شام كاش" checked={sham} onChange={toggleSham} />
            <p className="opt-help">يحوّل الزبون المبلغ ويُدخل رقم العملية، ويبقى المكان محجوزاً له خلال مهلة الدفع.</p>
          </div>
        </div>
        <div className="opt-row">
          <div>
            <Toggle label="الدفع عند الوصول" checked={cash} onChange={toggleCash} />
            <p className="opt-help">حجز «عند الوصول» لا يحجز المكان بمهلة، بل ينتظر تأكيد الفريق مباشرة، ويدفع الزبون في المركز.</p>
          </div>
        </div>
        <p className="muted tiny">طريقة واحدة على الأقل تبقى مفعّلة.{sham && cash ? ' الزبون يختار بينهما.' : sham ? ' الزبائن يدفعون بشام كاش فقط.' : ' الزبائن يدفعون عند الوصول فقط.'}</p>
        <Button block className="mt" onClick={save}>حفظ</Button>
      </Card>
      <Card>
        <div className="card-title">شام كاش</div>
        {!sham && <div className="alert alert-info" style={{ marginBottom: 12 }}>شام كاش متوقف: هذه البيانات محفوظة ولا تظهر للزبائن حتى تعيد تفعيله.</div>}
        <Field label="رقم محفظة شام كاش" hint="يظهر للزبون مع زر نسخ"><Input dir="ltr" inputMode="tel" value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
        <Field label="اسم صاحب المحفظة"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="صورة QR (اختياري)" hint="تُصغَّر تلقائياً إلى 512 بكسل">
          <div className="qr-drop">
            {qr ? <img src={qr} alt="QR" /> : <div className="ph"><Icon name="qr" size={28} /></div>}
            <div className="col gap-sm">
              <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
                {qr ? 'تغيير الصورة' : 'رفع صورة'}
                <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
              </label>
              {qr && <Button size="sm" variant="ghost" onClick={() => setQr(null)}>إزالة</Button>}
            </div>
          </div>
        </Field>
        <Field label="تعليمات إضافية للزبون (اختياري)" hint="حتى 500 حرف"><Textarea rows={3} maxLength={500} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></Field>
        <Field label="حجوزات غير مدفوعة لنفس الرقم" hint="كم حجز شام كاش بانتظار الدفع يمكن أن يكون لرقم هاتف واحد في الوقت نفسه (1–20). يمنع حجز أماكن كثيرة دون دفع." error={holdsError}>
          <Input dir="ltr" inputMode="numeric" value={holds} onChange={(e) => setHolds(e.target.value)} style={{ maxWidth: 160 }} />
        </Field>
        <Button block className="mt" onClick={save}>حفظ</Button>
      </Card>
      <div className="preview">
        <div className="preview-title">هكذا يرى الزبون شاشة الدفع (مثال: {sample ? `${sample.name}، ساعتان` : 'ساعتان'})</div>
        <Card className="card-accent">
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2 className="h2">ادفع عبر شام كاش</h2>
            <span className="countdown num"><Icon name="clock" size={16} />{String(settings.hold_minutes).padStart(2, '0')}:00</span>
          </div>
          <p className="muted small" style={{ marginBottom: 12 }}>المكان محفوظ لك حتى {fmtTime(new Date(Date.now() + settings.hold_minutes * 60000).toISOString())}.</p>
          <div className="stack-sm">
            <div className="copy-box"><div className="grow"><div className="tiny muted">رقم شام كاش {name ? `— ${name}` : ''}</div><div className="copy-value">{number || '09XXXXXXXX'}</div></div><span className="icon-btn"><Icon name="copy" /></span></div>
            <div className="copy-box"><div className="grow"><div className="tiny muted">المبلغ</div><div className="copy-value rtl">{fmtSYP(amount)}</div></div><span className="icon-btn"><Icon name="copy" /></span></div>
            <div className="copy-box"><div className="grow"><div className="tiny muted">اكتب هذا الرمز في ملاحظة التحويل</div><div className="copy-value code">A1B2C3</div></div><span className="icon-btn"><Icon name="copy" /></span></div>
          </div>
          {qr && <img src={qr} alt="" className="qr mt" />}
          {instructions.trim() && <p className="muted small mt">{instructions}</p>}
        </Card>
      </div>
    </div>
  )
}

// ---------- الفريق ----------
function TeamTab() {
  const toast = useToast()
  const { user: me } = useTeam()
  const [users, setUsers] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<User | 'new' | null>(null)

  async function load() {
    try { const r = await cachedGet<User[]>('/v1/admin/team'); setUsers(r.data); setError(null) } catch (err) { setError(describeError(err)) }
  }
  useEffect(() => { void load() }, [])

  return (
    <>
      <Card>
        <div className="row between mb">
          <div className="card-title" style={{ margin: 0 }}>حسابات الفريق</div>
          <Button size="sm" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> حساب</Button>
        </div>
        {!users && !error && <div className="center" style={{ padding: 24 }}><Spinner /></div>}
        {error && !users && <div className="alert alert-error">{error}</div>}
        {users?.map((u) => (
          <div key={u.id} className={`urow${u.disabled ? ' is-disabled' : ''}`}>
            <div>
              <div className="row gap-sm wrap"><span className="n">{u.name}</span><Badge tone={u.role === 'admin' ? 'wine' : 'grey'}>{u.role === 'admin' ? 'مدير' : 'موظف'}</Badge>{u.disabled ? <Badge tone="red">معطّل</Badge> : null}{u.id === me?.id && <span className="muted tiny">(أنت)</span>}</div>
              <div className="m num">{u.phone}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(u)}><Icon name="edit" size={16} /> تعديل</Button>
          </div>
        ))}
        <p className="muted tiny mt">الموظف يدير الحجوزات والدفعات؛ المدير يضيف القاعات والمخطط والإعدادات والحسابات.</p>
      </Card>
      <UserSheet user={editing} onClose={() => setEditing(null)} onSaved={(u) => { setUsers((l) => (l ? (l.some((x) => x.id === u.id) ? l.map((x) => (x.id === u.id ? u : x)) : [...l, u]) : [u])); toast.show('تم الحفظ', 'ok') }} />
    </>
  )
}

function UserSheet({ user, onClose, onSaved }: { user: User | 'new' | null; onClose: () => void; onSaved: (u: User) => void }) {
  const toast = useToast()
  const { user: me } = useTeam()
  const existing = user && user !== 'new' ? user : null
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [disabled, setDisabled] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setName(existing?.name ?? ''); setPhone(existing?.phone ?? ''); setPassword(''); setRole(existing?.role ?? 'staff'); setDisabled(existing?.disabled === 1); setErrors({})
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps
  const isMe = existing?.id === me?.id

  async function save() {
    const e: Record<string, string> = {}
    const p = normalisePhone(phone)
    if (name.trim().length < 2) e.name = 'اكتب الاسم'
    if (!existing && !p) e.phone = 'رقم الهاتف غير صحيح (09XXXXXXXX)'
    if ((!existing || password) && password.length < 6) e.password = 'كلمة المرور 6 أحرف على الأقل'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    try {
      let saved: User
      if (existing) {
        const patch: Record<string, unknown> = {}
        if (name.trim() !== existing.name) patch.name = name.trim()
        if (password) patch.password = password
        if (!isMe) { if (role !== existing.role) patch.role = role; if ((disabled ? 1 : 0) !== existing.disabled) patch.disabled = disabled ? 1 : 0 }
        saved = Object.keys(patch).length ? await api.patch<User>(`/v1/admin/team/${existing.id}`, patch) : existing
      } else {
        saved = await api.post<User>('/v1/admin/team', { phone: p, name: name.trim(), password, role })
      }
      onSaved(saved)
      onClose()
    } catch (err) {
      toast.show(err instanceof ApiError && err.offline ? 'إدارة الحسابات تحتاج اتصالاً بالإنترنت' : describeError(err), 'error')
    } finally { setBusy(false) }
  }

  return (
    <Sheet open={user !== null} onClose={onClose} title={existing ? `تعديل ${existing.name}` : 'حساب جديد'}>
      <Field label="الاسم" error={errors.name}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="رقم الهاتف (لتسجيل الدخول)" error={errors.phone}><Input dir="ltr" inputMode="tel" value={phone} disabled={!!existing} onChange={(e) => setPhone(e.target.value)} placeholder="09XXXXXXXX" /></Field>
      <Field label={existing ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور'} error={errors.password}><Input type="password" dir="ltr" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Field label="الصلاحية">
        <Segmented<Role> options={[{ value: 'staff', label: 'موظف' }, { value: 'admin', label: 'مدير' }]} value={role} onChange={(v) => !isMe && setRole(v)} />
      </Field>
      {existing && !isMe && <div className="mt"><Toggle label="الحساب معطّل (لا يستطيع الدخول)" checked={disabled} onChange={setDisabled} /></div>}
      {isMe && <p className="muted tiny mt">لا يمكنك تغيير صلاحيات حسابك أو تعطيله.</p>}
      <div className="sheet-foot">
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button loading={busy} onClick={save}>{existing ? 'حفظ' : 'إضافة'}</Button>
      </div>
    </Sheet>
  )
}

// ---------- إعلان ----------
function AnnounceTab() {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [to, setTo] = useState<'customers' | 'team'>('customers')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function ask() {
    const e: Record<string, string> = {}
    if (title.trim().length < 2) e.title = 'اكتب عنواناً'
    if (body.trim().length < 2) e.body = 'اكتب نص الإعلان'
    setErrors(e)
    if (!Object.keys(e).length) setConfirm(true)
  }
  async function send() {
    setBusy(true)
    try {
      const r = await api.post<{ sent: number }>('/v1/admin/announce', { title: title.trim(), body: body.trim(), to })
      toast.show(`أُرسل الإعلان إلى ${r.sent} ${r.sent === 1 ? 'جهاز' : 'جهازاً'}`, 'ok')
      setTitle(''); setBody(''); setConfirm(false)
    } catch (err) {
      toast.show(err instanceof ApiError && err.offline ? 'إرسال الإعلان يحتاج اتصالاً بالإنترنت' : describeError(err), 'error')
    } finally { setBusy(false) }
  }
  return (
    <Card>
      <div className="card-title">إعلان للجميع</div>
      <p className="muted small mb">يصل كإشعار فوري وفي صندوق الإشعارات داخل التطبيق.</p>
      <Field label="إلى">
        <Segmented<'customers' | 'team'> options={[{ value: 'customers', label: 'الزبائن' }, { value: 'team', label: 'الفريق' }]} value={to} onChange={setTo} />
      </Field>
      <Field label="العنوان" error={errors.title}><Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: عرض نهاية الأسبوع" /></Field>
      <Field label="النص" error={errors.body}><Textarea rows={4} value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} /></Field>
      <Button block className="mt" onClick={ask}><Icon name="send" size={18} /> إرسال</Button>
      <Confirm open={confirm} title="إرسال الإعلان؟" confirmLabel="إرسال" loading={busy}
        body={<>سيصل «<b>{title}</b>» إلى كل {to === 'customers' ? 'الزبائن' : 'أعضاء الفريق'} الذين فعّلوا الإشعارات.</>}
        onClose={() => setConfirm(false)} onConfirm={send} />
    </Card>
  )
}

// ---------- التقارير ----------
interface Report { bookings: Booking[]; revenue: number; hours_by_room: Record<string, number> }

function ReportsTab() {
  const today = todayLocal()
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!from || !to || from > to) return
    let alive = true
    setLoading(true)
    cachedGet<Report>(`/v1/admin/report?from=${from}&to=${to}`)
      .then((r) => { if (alive) { setReport(r.data); setError(null) } })
      .catch((err) => { if (alive) setError(describeError(err)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [from, to])

  const bars = useMemo(() => {
    if (!report) return []
    return Object.entries(report.hours_by_room).map(([name, hours]) => ({ name, hours })).sort((a, b) => b.hours - a.hours).slice(0, 12)
  }, [report])
  const totalHours = bars.reduce((s, b) => s + b.hours, 0)
  const paid = report?.bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed').length ?? 0

  function csv() {
    if (!report) return
    const rows: (string | number | null)[][] = [['الرمز', 'التاريخ', 'من', 'إلى', 'القاعة', 'الزبون', 'الهاتف', 'الحالة', 'الدفع', 'المبلغ', 'رقم العملية']]
    for (const b of report.bookings) {
      const p = toLocalParts(b.start)
      rows.push([b.code, p.date, p.time, toLocalParts(b.end).time, b.room_name ?? b.room_id, b.customer_name, b.customer_phone, statusLabel(b.status).text, METHOD[b.method], b.price, b.payment_ref])
    }
    downloadText(`focuspoint-${from}-${to}.csv`, toCSV(rows), 'text/csv;charset=utf-8')
  }

  return (
    <Card>
      <div className="row between gap wrap mb">
        <div className="card-title" style={{ margin: 0 }}>التقارير</div>
        <div className="row gap-sm wrap">
          <Input type="date" dir="ltr" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="من" style={{ height: 40, width: 150 }} />
          <span className="muted">—</span>
          <Input type="date" dir="ltr" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="إلى" style={{ height: 40, width: 150 }} />
        </div>
      </div>
      {loading && !report && <div className="center" style={{ padding: 24 }}><Spinner /></div>}
      {error && !report && <div className="alert alert-error">{error}</div>}
      {report && (
        <>
          <div className="report-kpis">
            <div className="stat"><b className="money" style={{ fontSize: '1.1rem' }}>{fmtSYP(report.revenue)}</b><span>الإيراد (المؤكد والمنتهي)</span></div>
            <div className="stat"><b>{paid}</b><span>حجوزات مدفوعة من {report.bookings.length}</span></div>
          </div>
          <div className="row between mb-sm"><span className="strong">الساعات حسب القاعة</span><span className="muted small">{Math.round(totalHours)} ساعة</span></div>
          {bars.length === 0 ? <p className="muted small">لا حجوزات في هذه الفترة.</p> : <HoursBars bars={bars} />}
          <div className="row between mt wrap gap">
            <span className="muted tiny">{fmtDate(`${from}T12:00:00Z`)} → {fmtDate(`${to}T12:00:00Z`)}</span>
            <Button variant="soft" size="sm" onClick={csv} disabled={report.bookings.length === 0}><Icon name="download" size={16} /> تنزيل CSV</Button>
          </div>
        </>
      )}
    </Card>
  )
}

/** Horizontal bars (SVG), one per room; the longest bar fills the width. */
function HoursBars({ bars }: { bars: { name: string; hours: number }[] }) {
  const W = 600, rowH = 30, labelW = 170, pad = 8
  const max = Math.max(1, ...bars.map((b) => b.hours))
  const H = bars.length * rowH + pad
  return (
    // The page is RTL and SVG text inherits `direction`, so "start" anchors put a text's right edge at x.
    <svg className="bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="الساعات حسب القاعة" style={{ direction: 'rtl' }}>
      {bars.map((b, i) => {
        const y = i * rowH + pad / 2
        const w = Math.max(2, ((W - labelW - 70) * b.hours) / max)
        const x = W - labelW - w
        return (
          <g key={b.name}>
            <text x={W - 4} y={y + rowH / 2} fontSize={13} textAnchor="start" dominantBaseline="central" fill="#0f172a" fontWeight={600}>{b.name}</text>
            <rect x={x} y={y + 5} width={w} height={rowH - 10} rx={6} fill="#7b1e2e" />
            <text x={x - 6} y={y + rowH / 2} fontSize={12} textAnchor="start" dominantBaseline="central" fill="#64748b">{Math.round(b.hours * 10) / 10}</text>
          </g>
        )
      })}
    </svg>
  )
}

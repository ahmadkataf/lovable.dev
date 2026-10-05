import { useEffect, useState } from 'react'
import { Usb, Cable, Keyboard, Camera, Smartphone, RefreshCw, Power, PowerOff, PlusCircle, ScanLine } from 'lucide-react'
import { useCollection, usePerm } from '../db/store'
import { DEFAULT_SCANNER, SCAN_PRIORITY, useScan, useScanStatus, writeScannerConfig, type ScanSource, type ScannerConfig } from '../lib/scan'
import { canUseHid, canUseSerial, desktopInventory, linkHidScanner, linkSerialScanner, turnDeviceOff, turnDeviceOn, useDevices, type ScannerDevice } from '../lib/devices'
import { codeFacts, parseGs1 } from '../lib/gs1'
import { findProductByScan, prefillFromScan } from '../lib/productMatch'
import { fmtTime } from '../lib/format'
import { isAndroid, isDesktop, type DesktopDevice } from '../lib/platform'
import { Modal } from './modal'
import { ProductForm } from './forms'
import { ScanButton } from './scanFlow'
import { useToast } from './toast'

const SOURCE: Record<ScanSource, string> = { keyboard: 'قارئ USB/بلوتوث (كلوحة مفاتيح)', camera: 'الكاميرا', serial: 'قارئ على منفذ COM/بلوتوث', hid: 'قارئ USB (HID POS)', android: 'قارئ الجهاز المدمج', manual: 'إدخال يدوي' }

/** Speeds a keyboard-type scanner types at: a person never types this fast. */
const SPEEDS: { id: string; label: string; cfg: Pick<ScannerConfig, 'maxAvgMs' | 'maxGapMs'> }[] = [
  { id: 'normal', label: 'عادي (أغلب القارئات)', cfg: { maxAvgMs: DEFAULT_SCANNER.maxAvgMs, maxGapMs: DEFAULT_SCANNER.maxGapMs } },
  { id: 'slow', label: 'قارئ بطيء أو بلوتوث', cfg: { maxAvgMs: 80, maxGapMs: 180 } },
  { id: 'fast', label: 'سريع فقط (إن ظهر كلامك المكتوب كمسح)', cfg: { maxAvgMs: 25, maxGapMs: 60 } },
]

/** Settings → barcode reader: what is connected, a test box, and how keyboard-type scanners are told apart. */
export function ScannerTab() {
  const status = useScanStatus()
  const devices = useDevices(s => s.list)
  const products = useCollection('products')
  const canAdd = usePerm('products')
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [create, setCreate] = useState<string | null>(null)
  const cfg = status.config
  const set = (c: Partial<ScannerConfig>) => writeScannerConfig(c)
  const speed = SPEEDS.find(s => s.cfg.maxAvgMs === cfg.maxAvgMs && s.cfg.maxGapMs === cfg.maxGapMs)?.id ?? 'custom'
  // on this page every reading goes to the test box (nothing opens)
  useScan(() => true, { priority: SCAN_PRIORITY.screen })
  useEffect(() => { if (isDesktop()) void desktopInventory().catch(() => {}) }, [])

  const last = status.last
  const facts = last ? codeFacts(last.text) : null
  const gs1 = last ? parseGs1(last.text) : null
  const hit = last ? findProductByScan(products.values(), last.text) : null

  const link = async (kind: 'hid' | 'serial') => {
    setBusy(true)
    try { const ok = kind === 'hid' ? await linkHidScanner() : await linkSerialScanner(); if (ok) toast.success('تم ربط القارئ — امسح باركوداً لتجربته') }
    catch (e) { const m = (e as Error).message || ''; if (!/No port selected|No device selected|cancel/i.test(m) && (e as Error).name !== 'NotFoundError') toast.error('تعذّر الربط: ' + m) }
    finally { setBusy(false) }
  }
  const refresh = async () => { setBusy(true); try { await desktopInventory() } finally { setBusy(false) } }

  return (
    <div className="stack">
      <div className="card pad">
        <div className="card-title"><h2><ScanLine size={18} style={{ verticalAlign: -3 }} /> تجربة القارئ</h2><ScanButton className="btn sm" label="الكاميرا" /></div>
        <p className="help">امسح أي باركود الآن بالقارئ الموصول أو بالكاميرا: يظهر هنا ما قُرئ ونوعه ومن أي جهاز.</p>
        {!last ? <div className="scan-test empty">بانتظار أول مسح…</div> : (
          <div className="scan-test">
            <b className="mono" dir="ltr">{last.text.replace(/\x1d/g, '⟨GS⟩')}</b>
            <div className="small muted">{[last.symbology, SOURCE[last.source], last.device, fmtTime(last.at)].filter(Boolean).join(' · ')}</div>
            {facts?.gtin && <div className="small">رقم منتج دولي صحيح{facts.country ? ` · بلد تسجيل الباركود: ${facts.country}` : ''}</div>}
            {gs1 && <div className="small">{gs1.map(x => `${x.label}: ${x.value}`).join(' · ')}</div>}
            <div className="mt">{hit ? <span className="badge tone-success">القطعة: {hit.product.name}</span>
              : <span className="row" style={{ gap: 8 }}><span className="badge tone-warning">غير مسجّل لأي قطعة</span>{canAdd && <button className="btn sm" onClick={() => setCreate(last.text)}><PlusCircle /> أضف قطعة بهذا الباركود</button>}</span>}</div>
          </div>
        )}
      </div>

      <div className="card pad">
        <div className="card-title"><h2>الأجهزة</h2>{isDesktop() && <button className="btn sm ghost" onClick={refresh} disabled={busy}><RefreshCw /> بحث عن الأجهزة</button>}</div>
        <div className="list">
          <DeviceRow icon={<Keyboard />} name="قارئ يعمل كلوحة مفاتيح (USB أو بلوتوث أو لاسلكي)" state={status.keyboardSeen ? 'connected' : 'idle'}
            detail={status.keyboardSeen ? `يعمل — آخر مسح ${fmtTime(status.keyboardSeen)}` : 'يُعرف تلقائياً من أول مسح، في أي شاشة ودون الحاجة لوضع المؤشر في خانة. أغلب القارئات تعمل بهذا الوضع.'} />
          {devices.map(d => <DeviceRow key={d.id} icon={d.kind === 'serial' ? <Cable /> : <Usb />} name={d.name} state={d.state} detail={[d.detail, d.reads ? `${d.reads} قراءة` : ''].filter(Boolean).join(' · ')}
            action={d.kind !== 'usb' && (d.state === 'off'
              ? <button className="btn sm ghost" onClick={() => turnDeviceOn(d.id)}><Power /> تشغيل</button>
              : <button className="btn sm ghost" onClick={() => turnDeviceOff(d.id)}><PowerOff /> إيقاف</button>)} />)}
          {isAndroid() && <DeviceRow icon={<Smartphone />} name="قارئ الجهاز المدمج (أجهزة نقاط البيع والهواتف الصناعية)" state={status.counts.android ? 'connected' : 'idle'}
            detail={status.counts.android ? `يعمل — ${status.counts.android} قراءة` : 'يُستقبل تلقائياً من قارئات Zebra وHoneywell وSunmi وUrovo وNewland وiData وغيرها. إن لم يصل المسح فاختر في إعدادات القارئ «إرسال كلوحة مفاتيح» أو «Broadcast».'} />}
          <DeviceRow icon={<Camera />} name="كاميرا الجهاز" state={typeof navigator !== 'undefined' && navigator.mediaDevices ? 'idle' : 'off'} detail="زر الكاميرا في أعلى الشاشة وفي شاشات البيع والمشتريات والمنتجات" />
        </div>
        {(canUseHid() || canUseSerial()) && <div className="row mt" style={{ flexWrap: 'wrap' }}>
          {canUseHid() && <button className="btn" onClick={() => link('hid')} disabled={busy}><Usb /> ربط قارئ USB بوضع HID POS</button>}
          {canUseSerial() && <button className="btn" onClick={() => link('serial')} disabled={busy}><Cable /> ربط قارئ على منفذ COM أو بلوتوث</button>}
        </div>}
        <p className="help mt">
          {isAndroid() ? 'على الهاتف: استخدم الكاميرا، أو قارئاً بلوتوث يعمل كلوحة مفاتيح، أو القارئ المدمج في أجهزة نقاط البيع.'
            : 'قارئات الكمبيوتر تعمل بثلاث طرق، وكلها مدعومة: كلوحة مفاتيح (الأشيع، يعمل فوراً)، أو HID POS، أو منفذ COM (سلكي أو بلوتوث). قارئات الشركات المعروفة بوضع HID POS أو COM تتصل وحدها؛ والقارئ على منفذ COM عام أو بلوتوث يُربط مرة واحدة بالزر أعلاه ثم يتصل تلقائياً كل مرة.'}
        </p>
      </div>

      <div className="card pad">
        <div className="card-title"><h2>إعدادات القارئ</h2></div>
        <div className="stack" style={{ gap: 10 }}>
          <label className="checkbox"><input type="checkbox" checked={cfg.keyboard} onChange={e => set({ keyboard: e.target.checked })} /> التعرّف على القارئ الذي يعمل كلوحة مفاتيح في كل الشاشات</label>
          {cfg.keyboard && <>
            <div className="field"><label>سرعة القارئ</label>
              <select className="select" style={{ maxWidth: 360 }} value={speed} onChange={e => { const s = SPEEDS.find(x => x.id === e.target.value); if (s) set(s.cfg) }}>
                {SPEEDS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                {speed === 'custom' && <option value="custom">مخصّص</option>}
              </select>
              <div className="help">إن لم يُعرف المسح فاختر «قارئ بطيء». وإن صار ما تكتبه بيدك يُعامل كمسح فاختر «سريع فقط».</div>
            </div>
            <label className="checkbox"><input type="checkbox" checked={cfg.noSuffix} onChange={e => set({ noSuffix: e.target.checked })} /> قبول المسح الذي لا ينتهي بـ Enter (بعض القارئات لا ترسله)</label>
          </>}
          <label className="checkbox"><input type="checkbox" checked={cfg.beep} onChange={e => set({ beep: e.target.checked })} /> صوت عند كل مسح</label>
          {isAndroid() && <label className="checkbox"><input type="checkbox" checked={cfg.vibrate} onChange={e => set({ vibrate: e.target.checked })} /> اهتزاز عند كل مسح</label>}
        </div>
      </div>
      {create && <ProductForm initial={prefillFromScan(create)} scanned={create} onClose={() => setCreate(null)} />}
    </div>
  )
}

function DeviceRow({ icon, name, state, detail, action }: { icon: React.ReactNode; name: string; state: ScannerDevice['state'] | 'idle'; detail?: string; action?: React.ReactNode }) {
  const badge = state === 'connected' ? ['tone-success', 'متصل'] : state === 'keyboard' ? ['tone-success', 'كلوحة مفاتيح'] : state === 'connecting' ? ['tone-info', 'جارٍ الاتصال'] : state === 'error' ? ['tone-danger', 'مشكلة'] : state === 'off' ? ['', 'موقوف'] : ['', 'جاهز']
  return (
    <div className="list-item">
      <span style={{ color: 'var(--muted)' }}>{icon}</span>
      <div className="grow"><div className="title">{name}</div>{detail && <div className="sub">{detail}</div>}</div>
      <span className={`badge ${badge[0]}`}>{badge[1]}</span>
      {action}
    </div>
  )
}

/** Windows app: the device list for «ربط قارئ», in Arabic, instead of the browser's chooser. */
export function DeviceChooserHost() {
  const [req, setReq] = useState<{ kind: 'hid' | 'serial'; list: DesktopDevice[] } | null>(null)
  useEffect(() => window.garageDesktop?.scanners?.onChoose(setReq), [])
  if (!req) return null
  const answer = (id: string | null) => { window.garageDesktop?.scanners?.choose(req.kind, id); setReq(null) }
  const list = [...req.list].sort((a, b) => Number(!!b.scanner) - Number(!!a.scanner))
  return (
    <Modal title={req.kind === 'hid' ? 'اختر قارئ الباركود (USB)' : 'اختر منفذ القارئ (COM / بلوتوث)'} onClose={() => answer(null)} size="narrow" footer={<button className="btn" onClick={() => answer(null)}>إلغاء</button>}>
      {list.length === 0 ? <p className="muted">{req.kind === 'hid' ? 'لا يوجد قارئ بوضع HID POS موصول. القارئ الذي يعمل كلوحة مفاتيح لا يحتاج ربطاً: امسح به مباشرة.' : 'لا توجد منافذ COM. صِل القارئ (أو اقرنه بالبلوتوث من إعدادات ويندوز) ثم أعد المحاولة.'}</p>
        : <div className="list">{list.map(d => (
          <button key={d.id} className="list-item" style={{ width: '100%', textAlign: 'start', cursor: 'pointer', background: 'none', border: 0 }} onClick={() => answer(d.id)}>
            {req.kind === 'hid' ? <Usb /> : <Cable />}
            <div className="grow"><div className="title">{d.name || 'جهاز'}</div><div className="sub mono" dir="ltr" style={{ textAlign: 'right' }}>{d.vendorId !== undefined ? `VID ${d.vendorId.toString(16).padStart(4, '0').toUpperCase()} · PID ${(d.productId ?? 0).toString(16).padStart(4, '0').toUpperCase()}` : ''}</div></div>
            {d.scanner && <span className="badge tone-success">قارئ باركود</span>}
          </button>
        ))}</div>}
    </Modal>
  )
}

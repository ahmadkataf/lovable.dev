import { useEffect, useState } from 'react'
import { Store, Printer, Users, Database, Cloud, Palette, Info, Plus, Trash2, Download, Upload, RefreshCw, Check, ShieldAlert, Copy, Eye, EyeOff } from 'lucide-react'
import { clearAll, put, remove, saveSettings, useCollection, useIsAdmin, useSettings, useStore, setCurrentUser } from '../db/store'
import type { Role, Settings, User } from '../db/types'
import { Field, Tabs, NumberInput } from '../ui/components'
import { Modal, useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { countBackup, downloadBackup, mergeBackup, parseBackup, restoreBackup } from '../lib/backup'
import { pickFile, platformName } from '../lib/platform'
import { onSyncStatus, resetSyncCursor, schedule, syncNow, testConnection, type SyncStatus } from '../lib/sync'
import { randomKey, sha256 } from '../lib/id'
import { fmtDateTime } from '../lib/format'
import { loadDemoData } from '../db/demo'
import { previewDocument } from '../print/PrintHost'
import { db } from '../db/db'

type Tab = 'shop' | 'print' | 'users' | 'backup' | 'sync' | 'look' | 'about'

export function SettingsScreen() {
  const isAdmin = useIsAdmin()
  const [tab, setTab] = useState<Tab>('shop')
  const items: { id: Tab; label: string }[] = isAdmin
    ? [{ id: 'shop', label: 'المحل' }, { id: 'print', label: 'الفواتير والطباعة' }, { id: 'users', label: 'المستخدمون' }, { id: 'backup', label: 'النسخ الاحتياطي' }, { id: 'sync', label: 'المزامنة بين الأجهزة' }, { id: 'look', label: 'المظهر' }, { id: 'about', label: 'حول' }]
    : [{ id: 'look', label: 'المظهر' }, { id: 'about', label: 'حول' }]
  useEffect(() => { if (!items.some(i => i.id === tab)) setTab(items[0].id) }, [isAdmin])
  return (
    <div className="stack">
      <Tabs value={tab} onChange={setTab} items={items} />
      {tab === 'shop' && <ShopTab />}
      {tab === 'print' && <PrintTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'backup' && <BackupTab />}
      {tab === 'sync' && <SyncTab />}
      {tab === 'look' && <LookTab />}
      {tab === 'about' && <AboutTab />}
    </div>
  )
}

function useDraft<K extends keyof Settings>(keys: K[]) {
  const s = useSettings()
  const [d, setD] = useState<Pick<Settings, K>>(() => Object.fromEntries(keys.map(k => [k, s[k]])) as Pick<Settings, K>)
  const toast = useToast()
  const save = async () => { await saveSettings(d); toast.success('تم الحفظ') }
  return { d, set: <T extends K>(k: T, v: Settings[T]) => setD(x => ({ ...x, [k]: v })), save }
}

function ShopTab() {
  const { d, set, save } = useDraft(['shopName', 'phone', 'address', 'currency', 'decimals', 'lowStockDefault', 'expenseCategories', 'units', 'staffSeesCost'])
  const [cat, setCat] = useState(''); const [unit, setUnit] = useState('')
  return (
    <div className="card pad">
      <div className="card-title"><h2><Store size={18} style={{ verticalAlign: -3 }} /> بيانات المحل</h2></div>
      <div className="form-grid">
        <Field label="اسم المحل" required><input className="input" value={d.shopName} onChange={e => set('shopName', e.target.value)} /></Field>
        <Field label="الهاتف"><input className="input" value={d.phone ?? ''} onChange={e => set('phone', e.target.value)} dir="ltr" style={{ textAlign: 'right' }} /></Field>
        <Field label="العنوان" className="full"><input className="input" value={d.address ?? ''} onChange={e => set('address', e.target.value)} /></Field>
        <Field label="العملة" help="تظهر بجانب كل الأسعار"><input className="input" value={d.currency} onChange={e => set('currency', e.target.value)} /></Field>
        <Field label="الخانات العشرية" help="0 لليرة السورية، 2 للدولار"><select className="select" value={d.decimals} onChange={e => set('decimals', Number(e.target.value))}><option value={0}>0</option><option value={1}>1</option><option value={2}>2</option></select></Field>
        <Field label="حد التنبيه الافتراضي للقطع الجديدة"><NumberInput value={d.lowStockDefault} onChange={v => set('lowStockDefault', v)} /></Field>
        <Field label="صلاحيات الموظفين"><label className="checkbox"><input type="checkbox" checked={d.staffSeesCost} onChange={e => set('staffSeesCost', e.target.checked)} /> الموظف يرى سعر الشراء والأرباح</label></Field>
        <Field label="أنواع المصاريف" className="full">
          <div className="chips">{d.expenseCategories.map(c => <span key={c} className="chip">{c} <button className="btn ghost sm icon" style={{ minHeight: 0, width: 20, height: 20, padding: 0 }} onClick={() => set('expenseCategories', d.expenseCategories.filter(x => x !== c))}>×</button></span>)}</div>
          <div className="row mt"><input className="input" placeholder="نوع جديد" value={cat} onChange={e => setCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && cat.trim()) { set('expenseCategories', [...d.expenseCategories, cat.trim()]); setCat('') } }} /><button className="btn" onClick={() => { if (cat.trim()) { set('expenseCategories', [...d.expenseCategories, cat.trim()]); setCat('') } }}><Plus /></button></div>
        </Field>
        <Field label="وحدات القياس" className="full">
          <div className="chips">{d.units.map(c => <span key={c} className="chip">{c} <button className="btn ghost sm icon" style={{ minHeight: 0, width: 20, height: 20, padding: 0 }} onClick={() => set('units', d.units.filter(x => x !== c))}>×</button></span>)}</div>
          <div className="row mt"><input className="input" placeholder="وحدة جديدة" value={unit} onChange={e => setUnit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && unit.trim()) { set('units', [...d.units, unit.trim()]); setUnit('') } }} /><button className="btn" onClick={() => { if (unit.trim()) { set('units', [...d.units, unit.trim()]); setUnit('') } }}><Plus /></button></div>
        </Field>
      </div>
      <div className="btn-row mt"><button className="btn primary" onClick={save}><Check /> حفظ</button></div>
    </div>
  )
}

function PrintTab() {
  const { d, set, save } = useDraft(['printSize', 'invoiceFooter', 'logo'])
  const sales = useCollection('sales')
  const last = Array.from(sales.values()).sort((a, b) => b.date - a.date)[0]
  const toast = useToast()
  return (
    <div className="card pad">
      <div className="card-title"><h2><Printer size={18} style={{ verticalAlign: -3 }} /> الفواتير والطباعة</h2></div>
      <div className="form-grid">
        <Field label="حجم الورق" className="full">
          <div className="tabs small"><button className={d.printSize === 'a4' ? 'active' : ''} onClick={() => set('printSize', 'a4')}>A4 (طابعة عادية)</button><button className={d.printSize === '80mm' ? 'active' : ''} onClick={() => set('printSize', '80mm')}>إيصال 80mm (طابعة حرارية)</button></div>
        </Field>
        <Field label="عبارة أسفل الفاتورة" className="full"><input className="input" value={d.invoiceFooter ?? ''} onChange={e => set('invoiceFooter', e.target.value)} /></Field>
        <Field label="شعار المحل (يظهر أعلى الفاتورة)" className="full">
          <div className="row">
            {d.logo && <img src={d.logo} alt="" style={{ height: 56, borderRadius: 8, background: '#fff', padding: 4, border: '1px solid var(--border)' }} />}
            <label className="btn"><Upload /> {d.logo ? 'تغيير' : 'رفع شعار'}<input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 400000) { toast.error('اختر صورة أصغر من 400 كيلوبايت'); return } const r = new FileReader(); r.onload = () => set('logo', String(r.result)); r.readAsDataURL(f) }} /></label>
            {d.logo && <button className="btn ghost" onClick={() => set('logo', undefined)}>إزالة</button>}
          </div>
        </Field>
      </div>
      <div className="btn-row mt">
        <button className="btn primary" onClick={save}><Check /> حفظ</button>
        {last && <button className="btn" onClick={async () => { await save(); previewDocument({ type: 'invoice', sale: last }); setTimeout(() => document.getElementById('print-area')?.scrollIntoView({ behavior: 'smooth' }), 100) }}><Eye /> معاينة آخر فاتورة</button>}
        <button className="btn ghost" onClick={() => previewDocument(null)}><EyeOff /> إخفاء المعاينة</button>
      </div>
      <p className="help mt">على ويندوز تُطبع الفاتورة من نافذة الطباعة العادية (اختر الطابعة الحرارية أو العادية). على أندرويد تُفتح شاشة الطباعة الخاصة بالهاتف، ويمكن حفظها PDF وإرسالها واتساب.</p>
    </div>
  )
}

function UsersTab() {
  const users = useCollection('users')
  const currentId = useStore(s => s.currentUserId)
  const [form, setForm] = useState<Partial<User> & { pin?: string } | null>(null)
  const toast = useToast(); const confirm = useConfirm()
  const list = Array.from(users.values()).sort((a, b) => a.createdAt - b.createdAt)
  const save = async () => {
    if (!form?.name?.trim()) { toast.error('اكتب الاسم'); return }
    if (!form.id && (!form.pin || form.pin.length < 4)) { toast.error('الرقم السري 4 أرقام على الأقل'); return }
    if (form.pin && form.pin.length < 4) { toast.error('الرقم السري 4 أرقام على الأقل'); return }
    const pinHash = form.pin ? await sha256(form.pin) : form.pinHash!
    await put('users', { id: form.id, name: form.name.trim(), role: form.role ?? 'staff', pinHash, createdAt: form.createdAt ?? Date.now() })
    toast.success('تم الحفظ'); setForm(null)
  }
  const del = async (u: User) => {
    const admins = list.filter(x => x.role === 'admin')
    if (u.role === 'admin' && admins.length === 1) { toast.error('لا يمكن حذف المدير الوحيد'); return }
    if (await confirm({ title: `حذف ${u.name}؟`, danger: true, okText: 'حذف' })) { await remove('users', u.id); if (u.id === currentId) setCurrentUser(null) }
  }
  return (
    <div className="card pad">
      <div className="card-title"><h2><Users size={18} style={{ verticalAlign: -3 }} /> المستخدمون والأرقام السرية</h2><button className="btn primary sm" onClick={() => setForm({ role: 'staff' })}><Plus /> مستخدم</button></div>
      {list.length === 0 && <p className="muted mb">لا يوجد مستخدمون: البرنامج يفتح مباشرة بلا رقم سري. أضف مديراً لحماية البرنامج، وموظفين بصلاحيات محدودة (لا يرون الأرباح ولا التقارير ولا يحذفون الفواتير).</p>}
      <div className="list">
        {list.map(u => (
          <div key={u.id} className="list-item">
            <span className={`avatar ${u.role === 'admin' ? 'tone-accent' : 'tone-info'}`}>{u.name.slice(0, 1)}</span>
            <div className="grow"><div className="title">{u.name} {u.id === currentId && <span className="badge tone-success">أنت</span>}</div><div className="sub">{u.role === 'admin' ? 'مدير — كل الصلاحيات' : 'موظف — بيع ومخزون وعملاء'}</div></div>
            <button className="btn sm" onClick={() => setForm({ ...u, pin: '' })}>تعديل</button>
            <button className="btn sm ghost icon" onClick={() => del(u)}><Trash2 /></button>
          </div>
        ))}
      </div>
      {form && (
        <Modal title={form.id ? 'تعديل مستخدم' : 'مستخدم جديد'} onClose={() => setForm(null)} size="narrow" footer={<><button className="btn primary" onClick={save}>حفظ</button><button className="btn" onClick={() => setForm(null)}>إلغاء</button></>}>
          <div className="stack">
            <Field label="الاسم"><input className="input" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
            <Field label="الصلاحية"><select className="select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}><option value="admin">مدير</option><option value="staff">موظف</option></select></Field>
            <Field label={form.id ? 'رقم سري جديد (اتركه فارغاً للإبقاء على القديم)' : 'الرقم السري'}><input className="input" type="password" inputMode="numeric" dir="ltr" value={form.pin ?? ''} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  )
}

function BackupTab() {
  const toast = useToast(); const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [lastBackup, setLastBackup] = useState<number | null>(() => Number(localStorage.getItem('alradwan.lastBackup')) || null)
  const counts = useStore(s => ({ products: s.products.size, sales: s.sales.size, customers: s.customers.size }))
  const doBackup = async () => { setBusy(true); try { await downloadBackup(); localStorage.setItem('alradwan.lastBackup', String(Date.now())); setLastBackup(Date.now()); toast.success('تم إنشاء النسخة الاحتياطية') } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) } }
  const doRestore = async (mode: 'replace' | 'merge') => {
    const f = await pickFile('.json,application/json'); if (!f) return
    try {
      const b = parseBackup(await f.text()); const n = countBackup(b)
      if (mode === 'replace') {
        if (!(await confirm({ title: 'استبدال كل البيانات؟', text: `النسخة من تاريخ ${fmtDateTime(b.exportedAt)} وفيها ${n} سجل. ستُحذف بيانات هذا الجهاز الحالية وتحل محلها بيانات النسخة.`, danger: true, okText: 'استبدال' }))) return
        setBusy(true); await restoreBackup(b); toast.success('تمت الاستعادة')
      } else {
        setBusy(true); const k = await mergeBackup(b); toast.success(`تم الدمج: ${k} سجل أُضيف أو حُدِّث`)
      }
      schedule(500)
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const wipe = async () => {
    if (!(await confirm({ title: 'حذف كل البيانات من هذا الجهاز؟', text: 'المنتجات والفواتير والعملاء وكل شيء. خذ نسخة احتياطية أولاً. إن كانت المزامنة مفعّلة فستعود البيانات من الخادم عند المزامنة التالية.', danger: true, okText: 'حذف كل شيء' }))) return
    await clearAll(); await db.meta.clear(); localStorage.removeItem('alradwan.user'); location.reload()
  }
  return (
    <div className="stack">
      <div className="card pad">
        <div className="card-title"><h2><Database size={18} style={{ verticalAlign: -3 }} /> النسخ الاحتياطي</h2></div>
        <p className="mb">النسخة الاحتياطية ملف واحد فيه كل بيانات المحل ({counts.products} قطعة، {counts.sales} فاتورة، {counts.customers} عميل). احفظه في مكان آمن (Google Drive، واتساب لنفسك، فلاشة) بشكل دوري.</p>
        {lastBackup && <p className="help mb">آخر نسخة أُخذت من هذا الجهاز: {fmtDateTime(lastBackup)}</p>}
        <div className="btn-row">
          <button className="btn primary" onClick={doBackup} disabled={busy}><Download /> إنشاء نسخة احتياطية</button>
          <button className="btn" onClick={() => doRestore('merge')} disabled={busy}><Upload /> دمج نسخة مع البيانات الحالية</button>
          <button className="btn" onClick={() => doRestore('replace')} disabled={busy}><RefreshCw /> استعادة نسخة (استبدال)</button>
        </div>
      </div>
      <div className="card pad danger-zone">
        <div className="card-title"><h2><ShieldAlert size={18} style={{ verticalAlign: -3, color: 'var(--danger)' }} /> منطقة الخطر</h2></div>
        <div className="btn-row">
          <button className="btn" onClick={async () => { if (await confirm({ title: 'إضافة بيانات تجريبية؟', text: 'تُضاف قطع وعملاء وفواتير للتجربة إلى بياناتك الحالية.', okText: 'إضافة' })) { await loadDemoData(); toast.success('تمت الإضافة') } }}>إضافة بيانات تجريبية</button>
          <button className="btn danger" onClick={wipe}><Trash2 /> حذف كل البيانات من هذا الجهاز</button>
        </div>
      </div>
    </div>
  )
}

function SyncTab() {
  const s = useSettings()
  const [url, setUrl] = useState(s.sync.url)
  const [key, setKey] = useState(s.sync.key)
  const [enabled, setEnabled] = useState(s.sync.enabled)
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<SyncStatus>({ state: 'off', lastSync: null, pending: 0 })
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  useEffect(() => onSyncStatus(setStatus), [])
  const save = async () => {
    const u = url.trim().replace(/\/$/, ''), k = key.trim()
    if (enabled && (!u || !k)) { toast.error('أدخل عنوان الخادم ومفتاح المحل'); return }
    const changed = u !== s.sync.url || k !== s.sync.key
    await saveSettings({ sync: { url: u, key: k, enabled } })
    if (changed) await resetSyncCursor()
    if (enabled) { schedule(300); toast.success('تم الحفظ — تبدأ المزامنة الآن') } else toast.success('تم الحفظ')
  }
  const test = async () => { setBusy(true); try { toast.success(await testConnection(url.trim(), key.trim())) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) } }
  return (
    <div className="stack">
      <div className="card pad">
        <div className="card-title"><h2><Cloud size={18} style={{ verticalAlign: -3 }} /> المزامنة بين الأجهزة</h2></div>
        <p className="mb">لتعمل على الحاسوب والهاتف والموقع بنفس البيانات، يتصل كل جهاز بخادم المحل. ضع نفس العنوان ونفس مفتاح المحل على كل الأجهزة. بدون مزامنة، يعمل البرنامج على كل جهاز وحده بلا إنترنت.</p>
        <div className="form-grid">
          <Field label="تفعيل المزامنة" className="full"><label className="checkbox"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> مزامنة تلقائية مع الخادم</label></Field>
          <Field label="عنوان الخادم" className="full" help="مثال: https://alradwan.<الاسم>.workers.dev"><input className="input" dir="ltr" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></Field>
          <Field label="مفتاح المحل" className="full" help="كلمة سر طويلة تخص محلك؛ كل من يعرفها يصل إلى بياناتك. انسخها إلى بقية الأجهزة.">
            <div className="row">
              <div className="input-wrap" style={{ flex: 1 }}><input className="input" dir="ltr" type={showKey ? 'text' : 'password'} value={key} onChange={e => setKey(e.target.value)} /></div>
              <button className="btn icon" onClick={() => setShowKey(v => !v)} title={showKey ? 'إخفاء' : 'إظهار'}>{showKey ? <EyeOff /> : <Eye />}</button>
              <button className="btn icon" onClick={() => { navigator.clipboard?.writeText(key); toast.success('نُسخ المفتاح') }} title="نسخ"><Copy /></button>
              {!key && <button className="btn" onClick={() => { setKey(randomKey()); setShowKey(true) }}>توليد مفتاح</button>}
            </div>
          </Field>
        </div>
        <div className="btn-row mt">
          <button className="btn primary" onClick={save}><Check /> حفظ</button>
          <button className="btn" onClick={test} disabled={busy || !url || !key}>اختبار الاتصال</button>
          {s.sync.enabled && <button className="btn" onClick={() => syncNow().then(r => toast.success(`تمت المزامنة: أُرسل ${r.sent}، وصل ${r.received}`)).catch(e => toast.error((e as Error).message))}><RefreshCw /> مزامنة الآن</button>}
        </div>
        {s.sync.enabled && <p className="help mt">الحالة: {status.state === 'syncing' ? 'جارٍ المزامنة…' : status.state === 'error' ? `خطأ: ${status.error}` : status.state === 'offline' ? 'بلا إنترنت — ستتم المزامنة عند عودة الاتصال' : 'جاهز'} · بانتظار الإرسال: {status.pending} · آخر مزامنة: {status.lastSync ? fmtDateTime(status.lastSync) : 'لم تتم بعد'}</p>}
      </div>
    </div>
  )
}

function LookTab() {
  const s = useSettings()
  const toast = useToast()
  return (
    <div className="card pad">
      <div className="card-title"><h2><Palette size={18} style={{ verticalAlign: -3 }} /> المظهر</h2></div>
      <Field label="السمة"><div className="tabs small" style={{ maxWidth: 420 }}>{(['light', 'dark', 'auto'] as const).map(t => <button key={t} className={s.theme === t ? 'active' : ''} onClick={async () => { await saveSettings({ theme: t }); toast.success('تم') }}>{t === 'light' ? 'فاتح' : t === 'dark' ? 'داكن' : 'حسب الجهاز'}</button>)}</div></Field>
    </div>
  )
}

function AboutTab() {
  const p = platformName()
  return (
    <div className="card pad" style={{ textAlign: 'center' }}>
      <img className="about-logo" src="./icon.svg" alt="" />
      <h2 style={{ marginTop: 8 }}>كراج الرضوان</h2>
      <p className="muted">نظام إدارة محل قطع غيار السيارات — الإصدار 1.0</p>
      <p className="muted small mt">المبيعات · المخزون · المشتريات · العملاء والموردون · الصندوق والمصاريف · التقارير · الطباعة · المزامنة بين الأجهزة</p>
      <p className="help mt"><Info size={14} style={{ verticalAlign: -2 }} /> تعمل الآن على: {p === 'android' ? 'تطبيق أندرويد' : p === 'windows' ? 'تطبيق ويندوز' : 'المتصفح'} · البيانات محفوظة على هذا الجهاز</p>
    </div>
  )
}

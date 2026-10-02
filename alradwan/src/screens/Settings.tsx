import { useEffect, useState } from 'react'
import { Store, Printer, Users, Database, Cloud, Palette, Info, Plus, Trash2, Download, Upload, RefreshCw, Check, ShieldAlert, Copy, Eye, EyeOff, Lock, FolderOpen, MonitorDown, KeyRound } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { audit, clearAll, put, remove, saveSettings, useCollection, useIsAdmin, useSettings, useStore, setCurrentUser } from '../db/store'
import type { Role, Settings, User } from '../db/types'
import { Field, Tabs, NumberInput } from '../ui/components'
import { Modal, useConfirm } from '../ui/modal'
import { useToast } from '../ui/toast'
import { backupIsEncrypted, countBackup, downloadBackup, mergeBackup, parseBackup, restoreBackup } from '../lib/backup'
import { isDesktop, pickFile, platformName, APP_VERSION, API_URL } from '../lib/platform'
import { onSyncStatus, resetSyncCursor, schedule, syncNow, testConnection, type SyncStatus } from '../lib/sync'
import { randomKey } from '../lib/id'
import { hashPin } from '../lib/crypto'
import { DEFAULT_STAFF_PERMISSIONS, PERMISSIONS, type Permission } from '../db/types'
import { shortDevice, useLicense } from '../lib/license'
import { Activate } from './Activate'
import { validateSyncUrl } from '../lib/sync'
import { CURRENCY_DECIMALS, CURRENCY_NAME, CURRENCY_SYMBOL, fmtDate, fmtDateTime, otherCurrency } from '../lib/format'
import type { CurrencyCode, CurrencyDisplay } from '../db/types'
import { loadDemoData } from '../db/demo'
import { previewDocument } from '../print/PrintHost'
import { db } from '../db/db'

type Tab = 'shop' | 'print' | 'users' | 'backup' | 'sync' | 'look' | 'about'

export function SettingsScreen() {
  const isAdmin = useIsAdmin()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'shop')
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
  const { d, set, save } = useDraft(['shopName', 'phone', 'address', 'currency', 'decimals', 'lowStockDefault', 'expenseCategories', 'units', 'staffSeesCost', 'staffEditsPrices', 'autoLockMinutes', 'baseCurrency', 'rate', 'display'])
  const setBase = (c: CurrencyCode) => { set('baseCurrency', c); set('currency', CURRENCY_SYMBOL[c]); set('decimals', CURRENCY_DECIMALS[c]) }
  const [cat, setCat] = useState(''); const [unit, setUnit] = useState('')
  return (
    <div className="card pad">
      <div className="card-title"><h2><Store size={18} style={{ verticalAlign: -3 }} /> بيانات المحل</h2></div>
      <div className="form-grid">
        <Field label="اسم المحل" required><input className="input" value={d.shopName} onChange={e => set('shopName', e.target.value)} /></Field>
        <Field label="الهاتف"><input className="input" value={d.phone ?? ''} onChange={e => set('phone', e.target.value)} dir="ltr" style={{ textAlign: 'right' }} /></Field>
        <Field label="العنوان" className="full"><input className="input" value={d.address ?? ''} onChange={e => set('address', e.target.value)} /></Field>
        <Field label="العملة الأساسية (التي تُكتب بها الأسعار)" className="full" help="تغييرها لا يحوّل الأرقام المحفوظة؛ اخترها مرة واحدة في البداية.">
          <div className="tabs" style={{ maxWidth: 480 }}>{(['SYP', 'USD'] as CurrencyCode[]).map(c => <button key={c} className={d.baseCurrency === c ? 'active' : ''} onClick={() => setBase(c)}>{CURRENCY_NAME[c]} ({CURRENCY_SYMBOL[c]})</button>)}</div>
        </Field>
        <Field label="سعر الدولار بالليرة السورية" help="يمكن تغييره في أي وقت من الشريط العلوي"><NumberInput value={d.rate} onChange={v => set('rate', v)} suffix="ل.س لكل 1 $" /></Field>
        <Field label="عرض الأسعار">
          <select className="select" value={d.display} onChange={e => set('display', e.target.value as CurrencyDisplay)}>
            <option value="base">{CURRENCY_SYMBOL[d.baseCurrency]} فقط</option>
            <option value="other">{CURRENCY_SYMBOL[otherCurrency(d.baseCurrency)]} فقط (محوّلة بسعر اليوم)</option>
            <option value="both">كلاهما</option>
          </select>
        </Field>
        <Field label="رمز العملة الأساسية" help="ما يظهر بجانب الأرقام"><input className="input" value={d.currency} onChange={e => set('currency', e.target.value)} /></Field>
        <Field label="الخانات العشرية"><select className="select" value={d.decimals} onChange={e => set('decimals', Number(e.target.value))}><option value={0}>0</option><option value={1}>1</option><option value={2}>2</option></select></Field>
        <Field label="حد التنبيه الافتراضي للقطع الجديدة"><NumberInput value={d.lowStockDefault} onChange={v => set('lowStockDefault', v)} /></Field>
        <Field label="الافتراضي للموظفين الجدد" className="full" help="صلاحيات كل موظف على حدة تُضبط من تبويب «المستخدمون» ← تعديل"><div className="stack" style={{ gap: 6 }}><label className="checkbox"><input type="checkbox" checked={d.staffSeesCost} onChange={e => set('staffSeesCost', e.target.checked)} /> الموظف يرى سعر الشراء والأرباح</label><label className="checkbox"><input type="checkbox" checked={d.staffEditsPrices} onChange={e => set('staffEditsPrices', e.target.checked)} /> الموظف يعدّل الأسعار</label></div></Field>
        <Field label="قفل البرنامج تلقائياً" help="عند ترك الجهاز بلا استخدام يعود إلى شاشة الرقم السري (يعمل عندما يوجد مستخدمون)"><select className="select" value={d.autoLockMinutes} onChange={e => set('autoLockMinutes', Number(e.target.value))}><option value={0}>لا يقفل</option><option value={2}>بعد دقيقتين</option><option value={5}>بعد 5 دقائق</option><option value={15}>بعد 15 دقيقة</option><option value={30}>بعد 30 دقيقة</option><option value={60}>بعد ساعة</option></select></Field>
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
  const { d, set, save } = useDraft(['printSize', 'printMode', 'invoiceFooter', 'logo'])
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
        {isDesktop() && <Field label="طريقة الطباعة على ويندوز" className="full" help="المعاينة تفتح الفاتورة في نافذة PDF فيها زر طباعة وحفظ؛ المباشرة تفتح نافذة الطابعة فوراً (قد تظهر خلف البرنامج على بعض الأجهزة)">
          <div className="tabs small"><button className={d.printMode !== 'direct' ? 'active' : ''} onClick={() => set('printMode', 'preview')}>معاينة ثم طباعة (موصى به)</button><button className={d.printMode === 'direct' ? 'active' : ''} onClick={() => set('printMode', 'direct')}>مباشرة إلى الطابعة</button></div>
        </Field>}
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
  const settings = useSettings()
  const currentId = useStore(s => s.currentUserId)
  const [form, setForm] = useState<Partial<User> & { pin?: string } | null>(null)
  const toast = useToast(); const confirm = useConfirm()
  const list = Array.from(users.values()).sort((a, b) => a.createdAt - b.createdAt)
  const save = async () => {
    if (!form?.name?.trim()) { toast.error('اكتب الاسم'); return }
    if (!form.id && (!form.pin || form.pin.length < 4)) { toast.error('الرقم السري 4 أرقام على الأقل'); return }
    if (form.pin && form.pin.length < 4) { toast.error('الرقم السري 4 أرقام على الأقل'); return }
    const h = form.pin ? await hashPin(form.pin) : null
    const saved = await put('users', { id: form.id, name: form.name.trim(), role: form.role ?? 'staff', permissions: form.role === 'admin' ? undefined : form.permissions, pinHash: h ? h.hash : form.pinHash!, pinSalt: h ? h.salt : form.pinSalt, pinIterations: h ? h.iterations : form.pinIterations, createdAt: form.createdAt ?? Date.now() })
    // the first user is the admin who is sitting here: keep them signed in instead of locking the screen
    if (!currentId && list.length === 0) setCurrentUser(saved.id)
    await audit(form.id ? 'update' : 'create', `${form.id ? 'تعديل' : 'إضافة'} مستخدم ${form.name.trim()} (${form.role === 'admin' ? 'مدير' : 'موظف'})${form.pin ? ' مع رقم سري جديد' : ''}`, 'users', form.id)
    toast.success('تم الحفظ'); setForm(null)
  }
  const del = async (u: User) => {
    const admins = list.filter(x => x.role === 'admin')
    if (u.role === 'admin' && admins.length === 1) { toast.error('لا يمكن حذف المدير الوحيد'); return }
    if (await confirm({ title: `حذف ${u.name}؟`, danger: true, okText: 'حذف' })) { await remove('users', u.id); await audit('delete', `حذف مستخدم ${u.name}`, 'users', u.id); if (u.id === currentId) setCurrentUser(null) }
  }
  return (
    <div className="card pad">
      <div className="card-title"><h2><Users size={18} style={{ verticalAlign: -3 }} /> المستخدمون والأرقام السرية</h2><button className="btn primary sm" onClick={() => setForm({ role: 'staff' })}><Plus /> مستخدم</button></div>
      {list.length === 0 && <p className="muted mb">لا يوجد مستخدمون: البرنامج يفتح مباشرة بلا رقم سري. أضف مديراً لحماية البرنامج، وموظفين بصلاحيات محدودة (لا يرون الأرباح ولا التقارير ولا يحذفون الفواتير).</p>}
      <div className="list">
        {list.map(u => (
          <div key={u.id} className="list-item">
            <span className={`avatar ${u.role === 'admin' ? 'tone-accent' : 'tone-info'}`}>{u.name.slice(0, 1)}</span>
            <div className="grow"><div className="title">{u.name} {u.id === currentId && <span className="badge tone-success">أنت</span>}</div><div className="sub">{u.role === 'admin' ? 'مدير — كل الصلاحيات' : `موظف — ${PERMISSIONS.filter(p => (u.permissions?.[p.id] ?? (p.id === 'seeCost' ? settings.staffSeesCost : p.id === 'editPrices' ? settings.staffEditsPrices : DEFAULT_STAFF_PERMISSIONS[p.id]))).length} من ${PERMISSIONS.length} صلاحية`}</div></div>
            <button className="btn sm" onClick={() => setForm({ ...u, pin: '' })}>تعديل</button>
            <button className="btn sm ghost icon" onClick={() => del(u)}><Trash2 /></button>
          </div>
        ))}
      </div>
      {form && (
        <Modal title={form.id ? 'تعديل مستخدم' : 'مستخدم جديد'} onClose={() => setForm(null)} size={form.role === 'admin' ? 'narrow' : undefined} footer={<><button className="btn primary" onClick={save}>حفظ</button><button className="btn" onClick={() => setForm(null)}>إلغاء</button></>}>
          <div className="stack">
            <Field label="الاسم"><input className="input" value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
            <Field label="الصلاحية"><select className="select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}><option value="admin">مدير</option><option value="staff">موظف</option></select></Field>
            <Field label={form.id ? 'رقم سري جديد (اتركه فارغاً للإبقاء على القديم)' : 'الرقم السري'} help="4 أرقام على الأقل، ويُفضَّل 6"><input className="input" type="password" inputMode="numeric" dir="ltr" value={form.pin ?? ''} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} /></Field>
            {form.role !== 'admin' && <PermissionsEditor value={form.permissions ?? {}} onChange={permissions => setForm({ ...form, permissions })} />}
          </div>
        </Modal>
      )}
    </div>
  )
}

/** The admin ticks what this employee may do; the defaults suit a cashier. Deleting is never granted. */
function PermissionsEditor({ value, onChange }: { value: Partial<Record<Permission, boolean>>; onChange: (v: Partial<Record<Permission, boolean>>) => void }) {
  const settings = useSettings()
  const effective = (id: Permission) => value[id] ?? (id === 'seeCost' ? settings.staffSeesCost : id === 'editPrices' ? settings.staffEditsPrices : DEFAULT_STAFF_PERMISSIONS[id])
  const groups = Array.from(new Set(PERMISSIONS.map(p => p.group)))
  const setAll = (v: boolean) => onChange(Object.fromEntries(PERMISSIONS.map(p => [p.id, v])) as Record<Permission, boolean>)
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="between"><b>صلاحيات هذا الموظف</b><div className="row"><button type="button" className="btn sm ghost" onClick={() => setAll(true)}>الكل</button><button type="button" className="btn sm ghost" onClick={() => setAll(false)}>لا شيء</button><button type="button" className="btn sm ghost" onClick={() => onChange({})}>الافتراضي</button></div></div>
      {groups.map(g => (
        <div key={g}>
          <div className="small muted" style={{ marginBottom: 4 }}>{g}</div>
          <div className="stack" style={{ gap: 4 }}>
            {PERMISSIONS.filter(p => p.group === g).map(p => (
              <label key={p.id} className="checkbox" title={p.help}><input type="checkbox" checked={effective(p.id)} onChange={e => onChange({ ...value, [p.id]: e.target.checked })} /> {p.label}{p.help && <span className="muted small"> — {p.help}</span>}</label>
            ))}
          </div>
        </div>
      ))}
      <div className="small muted">الحذف (فواتير، قطع، عملاء، دفعات) والإعدادات والنسخ الاحتياطي والمستخدمون للمدير فقط دائماً.</div>
    </div>
  )
}

function BackupTab() {
  const toast = useToast(); const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [lastBackup, setLastBackup] = useState<number | null>(() => Number(localStorage.getItem('alradwan.lastBackup')) || null)
  // three plain numbers, not one fresh object: a selector that returns a new object every time re-renders forever
  const nProducts = useStore(s => s.products.size), nSales = useStore(s => s.sales.size), nCustomers = useStore(s => s.customers.size)
  const counts = { products: nProducts, sales: nSales, customers: nCustomers }
  const [askPassword, setAskPassword] = useState<{ title: string; text?: string; resolve: (p: string | null) => void } | null>(null)
  const askPw = (title: string, text?: string) => new Promise<string | null>(resolve => setAskPassword({ title, text, resolve }))
  const [autoList, setAutoList] = useState<{ name: string; size: number; mtime: number }[] | null>(null)
  const [folder, setFolder] = useState('')
  useEffect(() => { if (isDesktop()) { window.garageDesktop!.listBackups().then(setAutoList); window.garageDesktop!.backupsFolder().then(setFolder) } }, [busy])
  const doBackup = async (encrypted: boolean) => {
    let pw: string | undefined
    if (encrypted) { const p = await askPw('كلمة سر النسخة', 'ستُحتاج لاستعادة النسخة. لا يمكن استرجاعها إن نُسيت.'); if (!p) return; if (p.length < 6) { toast.error('كلمة السر 6 أحرف على الأقل'); return } pw = p }
    setBusy(true)
    try { await downloadBackup(pw); setLastBackup(Date.now()); await audit('backup', encrypted ? 'نسخة احتياطية مشفّرة' : 'نسخة احتياطية'); toast.success('تم إنشاء النسخة الاحتياطية') } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const restoreText = async (text: string, mode: 'replace' | 'merge') => {
    let pw: string | undefined
    if (backupIsEncrypted(text)) { const p = await askPw('النسخة مشفّرة', 'أدخل كلمة السر التي وُضعت عند إنشائها'); if (!p) return; pw = p }
    try {
      const b = await parseBackup(text, pw); const n = countBackup(b)
      if (mode === 'replace') {
        if (!(await confirm({ title: 'استبدال كل البيانات؟', text: `النسخة من تاريخ ${fmtDateTime(b.exportedAt)} وفيها ${n} سجل. ستُحذف بيانات هذا الجهاز الحالية وتحل محلها بيانات النسخة.`, danger: true, okText: 'استبدال' }))) return
        setBusy(true); await restoreBackup(b); toast.success('تمت الاستعادة')
      } else {
        setBusy(true); const k = await mergeBackup(b); toast.success(`تم الدمج: ${k} سجل أُضيف أو حُدِّث`)
      }
      await audit('backup', mode === 'replace' ? `استعادة نسخة احتياطية (${n} سجل)` : `دمج نسخة احتياطية (${n} سجل)`)
      schedule(500)
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const doRestore = async (mode: 'replace' | 'merge') => {
    const f = await pickFile('.json,application/json'); if (!f) return
    await restoreText(await f.text(), mode)
  }
  const restoreAuto = async (name: string) => {
    const text = await window.garageDesktop!.readBackup(name)
    if (!text) { toast.error('تعذّرت قراءة الملف'); return }
    await restoreText(text, 'replace')
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
          <button className="btn primary" onClick={() => doBackup(false)} disabled={busy}><Download /> إنشاء نسخة احتياطية</button>
          <button className="btn" onClick={() => doBackup(true)} disabled={busy} title="نسخة لا تُفتح إلا بكلمة سر: مناسبة للإرسال عبر واتساب أو حفظها عند غيرك"><Lock /> نسخة مشفّرة بكلمة سر</button>
          <button className="btn" onClick={() => doRestore('merge')} disabled={busy}><Upload /> دمج نسخة مع البيانات الحالية</button>
          <button className="btn" onClick={() => doRestore('replace')} disabled={busy}><RefreshCw /> استعادة نسخة (استبدال)</button>
        </div>
      </div>
      {isDesktop() && (
        <div className="card pad">
          <div className="card-title"><h2><FolderOpen size={18} style={{ verticalAlign: -3 }} /> النسخ التلقائية اليومية</h2></div>
          <p className="help mb">على ويندوز يحفظ البرنامج نسخة كاملة كل يوم تلقائياً (آخر 14 يوماً) في: <span dir="ltr" className="mono">{folder}</span></p>
          {!autoList?.length ? <p className="muted">لا نسخ تلقائية بعد؛ تُنشأ أول نسخة عند فتح البرنامج.</p> : (
            <div className="list">{autoList.map(b => <div key={b.name} className="list-item"><div className="grow"><div className="title" dir="ltr" style={{ textAlign: 'right' }}>{b.name}</div><div className="sub">{fmtDateTime(b.mtime)} · {Math.round(b.size / 1024)} كيلوبايت</div></div><button className="btn sm" onClick={() => restoreAuto(b.name)} disabled={busy}><RefreshCw /> استعادة</button></div>)}</div>
          )}
        </div>
      )}
      {askPassword && (
        <Modal title={askPassword.title} onClose={() => { askPassword.resolve(null); setAskPassword(null) }} size="narrow" icon={<Lock />} footer={<><button className="btn primary" onClick={() => { const v = (document.getElementById('backup-pw') as HTMLInputElement).value; askPassword.resolve(v); setAskPassword(null) }}>متابعة</button><button className="btn" onClick={() => { askPassword.resolve(null); setAskPassword(null) }}>إلغاء</button></>}>
          {askPassword.text && <p className="mb">{askPassword.text}</p>}
          <input id="backup-pw" type="password" className="input lg" dir="ltr" autoFocus onKeyDown={e => { if (e.key === 'Enter') { askPassword.resolve((e.target as HTMLInputElement).value); setAskPassword(null) } }} />
        </Modal>
      )}
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
  const [url, setUrl] = useState(s.sync.url || API_URL)
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
    if (enabled) { const bad = validateSyncUrl(u); if (bad) { toast.error(bad); return } if (k.length < 12) { toast.error('مفتاح المحل قصير: 12 حرفاً على الأقل'); return } }
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

/** The subscription, as the shop sees it: state, expiry, device id, and the button to enter or change a code. */
function LicenseCard() {
  const lic = useLicense()
  const shopName = useSettings().shopName
  const [open, setOpen] = useState(false)
  if (lic.state === 'off') return <div className="help mt">نسخة بلا تفعيل (بُنيت بدون خادم ترخيص)</div>
  const label = lic.state === 'active' ? `مفعّل${lic.until ? ` حتى ${fmtDate(lic.until)}` : ' — اشتراك دائم'}` : lic.state === 'trial' ? `نسخة تجريبية حتى ${fmtDate(lic.trialEnds)}` : lic.state === 'loading' ? 'جارٍ التحقق…' : lic.notice || 'غير مفعّل'
  return (
    <div className="card pad mt" style={{ textAlign: 'right' }}>
      <div className="between"><b><KeyRound size={16} style={{ verticalAlign: -3 }} /> التفعيل</b><span className={`badge ${lic.state === 'active' ? 'tone-success' : lic.state === 'trial' ? 'tone-info' : 'tone-warning'}`}>{label}</span></div>
      {lic.code && <div className="small muted mt">الكود <span className="mono">{lic.code}</span>{lic.maxDevices ? ` · الأجهزة ${lic.devices} من ${lic.maxDevices}` : ''}{lic.lastCheck ? ` · آخر تحقق ${fmtDateTime(lic.lastCheck)}` : ''}</div>}
      <div className="small muted">رقم هذا الجهاز: <span className="mono">{shortDevice(lic.device)}</span> · الخادم: <span className="mono">{API_URL.replace(/^https?:\/\//, '')}</span></div>
      <button className="btn mt" onClick={() => setOpen(true)}>{lic.state === 'active' ? 'تغيير الكود' : 'إدخال كود التفعيل'}</button>
      {open && <div className="modal-backdrop" style={{ padding: 0 }}><Activate shopName={shopName} onClose={() => setOpen(false)} /></div>}
    </div>
  )
}

function AboutTab() {
  const p = platformName()
  const [installable, setInstallable] = useState(() => !!(window as any).alradwanInstall)
  const [update, setUpdate] = useState(false)
  useEffect(() => {
    const a = () => setInstallable(true), b = () => setUpdate(true)
    window.addEventListener('alradwan:installable', a); window.addEventListener('alradwan:update', b)
    return () => { window.removeEventListener('alradwan:installable', a); window.removeEventListener('alradwan:update', b) }
  }, [])
  const install = async () => { const e = (window as any).alradwanInstall; if (!e) return; e.prompt(); const r = await e.userChoice; if (r?.outcome === 'accepted') setInstallable(false) }
  return (
    <div className="card pad" style={{ textAlign: 'center' }}>
      <img className="about-logo" src="./icon.svg" alt="" />
      <h2 style={{ marginTop: 8 }}>كراج الرضوان</h2>
      <p className="muted">نظام إدارة محل قطع غيار السيارات — الإصدار {APP_VERSION}</p>
      <p className="muted small mt">المبيعات · المخزون · المشتريات · العملاء والموردون · الصندوق والمصاريف · التقارير · الطباعة · المزامنة بين الأجهزة</p>
      <p className="help mt"><Info size={14} style={{ verticalAlign: -2 }} /> تعمل الآن على: {p === 'android' ? 'تطبيق أندرويد' : p === 'windows' ? 'تطبيق ويندوز' : 'المتصفح'} · البيانات محفوظة على هذا الجهاز</p>
      {installable && <button className="btn primary mt" onClick={install}><MonitorDown /> تثبيت البرنامج على هذا الجهاز</button>}
      {update && <button className="btn mt" onClick={() => location.reload()}><RefreshCw /> نسخة جديدة جاهزة — أعد التشغيل</button>}
      <p className="help mt">اختصارات لوحة المفاتيح في شاشة البيع: F2 بحث · F8 حفظ · F9 حفظ وطباعة</p>
      <LicenseCard />
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import type { IllustrationKey, SiteSettings } from '@shared/types'
import { navigate, useRoute } from '../lib/router'
import { applyTheme, useStore } from '../lib/store'
import { api } from '../lib/api'
import type { Backup } from '../lib/backend'
import { compressImage } from '../lib/format'
import { Icon } from '../components/Icons'
import { ILLUSTRATION_KEYS, ILLUSTRATION_LABEL } from '../components/Illustrations'
import { Confirm, Field } from '../components/ui'

type Tab = 'general' | 'look' | 'home' | 'content' | 'shipping' | 'repair' | 'security' | 'data'
const TABS: [Tab, string][] = [['general', 'بيانات المتجر'], ['look', 'المظهر والألوان'], ['home', 'الصفحة الرئيسية'], ['content', 'الخدمات والمحتوى'], ['shipping', 'الشحن والعملة'], ['repair', 'نموذج الصيانة'], ['security', 'كلمة المرور'], ['data', 'النسخ الاحتياطي والبيانات']]

function ListEditor<T extends Record<string, unknown>>({ items, onChange, fields, blank, title }: { items: T[]; onChange: (i: T[]) => void; fields: { key: keyof T & string; label: string; kind?: 'text' | 'textarea' | 'icon' | 'number' }[]; blank: T; title: string }) {
  const u = (i: number, k: string, v: unknown) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)))
  const move = (i: number, d: number) => { const n = [...items]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n) }
  return (
    <div className="list-editor">
      {items.map((it, i) => (
        <div key={i} className="item">
          <div className="row-between"><b className="small">{title} {i + 1}</b><div className="row"><button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(i, -1)}>↑</button><button className="btn btn-ghost btn-sm btn-icon" onClick={() => move(i, 1)}>↓</button><button className="btn btn-ghost btn-sm btn-icon" onClick={() => onChange(items.filter((_, j) => j !== i))}><Icon.Trash /></button></div></div>
          <div className="form-grid">
            {fields.map(f => (
              <Field key={f.key} label={f.label} span2={f.kind === 'textarea'}>
                {f.kind === 'textarea' ? <textarea className="textarea" style={{ minHeight: 70 }} value={String(it[f.key] ?? '')} onChange={e => u(i, f.key, e.target.value)} />
                  : f.kind === 'icon' ? <select className="select input-sm" value={String(it[f.key] ?? 'box')} onChange={e => u(i, f.key, e.target.value)}>{ILLUSTRATION_KEYS.map(k => <option key={k} value={k}>{ILLUSTRATION_LABEL[k]}</option>)}</select>
                  : f.kind === 'number' ? <input className="input input-sm num" type="number" value={Number(it[f.key] ?? 0)} onChange={e => u(i, f.key, Number(e.target.value))} />
                  : <input className="input input-sm" value={String(it[f.key] ?? '')} onChange={e => u(i, f.key, e.target.value)} />}
              </Field>
            ))}
          </div>
        </div>
      ))}
      <button className="btn btn-outline btn-sm" onClick={() => onChange([...items, blank])}><Icon.Plus />إضافة</button>
    </div>
  )
}

function SingleImage({ value, onChange, hint }: { value?: string; onChange: (v?: string) => void; hint?: string }) {
  const { toast } = useStore()
  const [busy, setBusy] = useState(false)
  return (
    <div className="row wrap">
      {value && <div className="th" style={{ width: 84, height: 84, borderRadius: 10, overflow: 'hidden', background: 'var(--bg-3)', border: '1px solid var(--border)' }}><img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>}
      <label className="btn btn-ghost btn-sm"><input type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); try { onChange(await api.uploadImage(await compressImage(f, 800, .9))) } catch (er) { toast((er as Error).message, 'err') } finally { setBusy(false) } }} /><Icon.Upload />{busy ? '…' : value ? 'تغيير' : 'رفع صورة'}</label>
      {value && <button className="btn btn-ghost btn-sm" onClick={() => onChange(undefined)}><Icon.X />إزالة</button>}
      {hint && <span className="hint" style={{ width: '100%' }}>{hint}</span>}
    </div>
  )
}

export function SettingsPage() {
  const { search } = useRoute()
  const { settings: live, reload, toast } = useStore()
  const [s, setS] = useState<SiteSettings>(live)
  const [tab, setTab] = useState<Tab>((search.get('tab') as Tab) || 'general')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [restore, setRestore] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { api.admin.settings().then(setS).catch(() => {}) }, [])
  useEffect(() => { if (dirty) applyTheme(s) }, [s.primaryColor, s.accentColor, s.theme])
  const u = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => { setS(x => ({ ...x, [k]: v })); setDirty(true) }
  const un = <K extends keyof SiteSettings>(k: K, patch: Partial<SiteSettings[K]>) => u(k, { ...(s[k] as object), ...patch } as SiteSettings[K])

  const save = async () => {
    setBusy(true)
    try { const saved = await api.admin.saveSettings(s); setS(saved); setDirty(false); await reload(); toast('تم حفظ الإعدادات — الموقع محدَّث') } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  const changePw = async () => {
    if (pw.next.length < 6) return toast('كلمة المرور 6 أحرف على الأقل', 'err')
    if (pw.next !== pw.confirm) return toast('كلمتا المرور غير متطابقتين', 'err')
    try { await api.admin.changePassword(pw.current, pw.next); setPw({ current: '', next: '', confirm: '' }); toast('تم تغيير كلمة المرور') } catch (e) { toast((e as Error).message, 'err') }
  }
  const exportAll = async () => {
    try { const b = await api.admin.exportAll(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' })); a.download = `sufix-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click() } catch (e) { toast((e as Error).message, 'err') }
  }
  const importAll = async (f: File | undefined) => {
    if (!f) return
    try { const b = JSON.parse(await f.text()) as Backup; if (b.version !== 1) throw new Error('ملف غير صالح'); await api.admin.importAll(b); await reload(); toast('تمت الاستعادة') } catch (e) { toast((e as Error).message, 'err') }
  }

  return (
    <>
      <div className="admin-top"><div><h1>تخصيص الموقع</h1><p>كل ما يظهر للزوار يُعدَّل من هنا: الاسم، الألوان، النصوص، الأقسام، الشحن، والتواصل.</p></div><div className="row"><button className="btn btn-ghost btn-sm" onClick={() => window.open('/', '_blank')}><Icon.Eye />معاينة</button><button className="btn btn-primary" disabled={busy || !dirty} onClick={save}><Icon.Check />{busy ? '…' : dirty ? 'حفظ التغييرات' : 'محفوظ'}</button></div></div>
      <div className="settings-nav pill-tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); navigate(`/admin/settings?tab=${k}`, { replace: true, scroll: false }) }}>{l}</button>)}</div>

      {tab === 'general' && (
        <div className="panel">
          <div className="form-grid">
            <Field label="اسم المتجر"><input className="input" value={s.siteName} onChange={e => u('siteName', e.target.value)} /></Field>
            <Field label="الشعار النصي / الوصف القصير"><input className="input" value={s.tagline} onChange={e => u('tagline', e.target.value)} /></Field>
            <Field label="رقم واتساب (بالصيغة الدولية بدون +)" hint="مثال: 963912345678 — كل الطلبات تصل إلى هذا الرقم"><input className="input num" dir="ltr" value={s.whatsapp} onChange={e => u('whatsapp', e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="رقم الهاتف المعروض"><input className="input num" dir="ltr" value={s.phone} onChange={e => u('phone', e.target.value)} /></Field>
            <Field label="البريد الإلكتروني"><input className="input" dir="ltr" value={s.email} onChange={e => u('email', e.target.value)} /></Field>
            <Field label="المدينة"><input className="input" value={s.city} onChange={e => u('city', e.target.value)} /></Field>
            <Field label="العنوان"><input className="input" value={s.address} onChange={e => u('address', e.target.value)} /></Field>
            <Field label="ساعات العمل"><input className="input" value={s.workingHours} onChange={e => u('workingHours', e.target.value)} /></Field>
            <Field label="رابط الخريطة (اختياري)"><input className="input" dir="ltr" value={s.mapUrl || ''} onChange={e => u('mapUrl', e.target.value)} /></Field>
            <Field label="نص أسفل الموقع"><input className="input" value={s.footerText} onChange={e => u('footerText', e.target.value)} /></Field>
            {(['facebook', 'instagram', 'telegram', 'tiktok', 'youtube'] as const).map(k => <Field key={k} label={`رابط ${k}`}><input className="input" dir="ltr" placeholder="https://" value={s.social[k] || ''} onChange={e => un('social', { [k]: e.target.value })} /></Field>)}
            <Field label="عنوان الصفحة (SEO)"><input className="input" value={s.seo.title} onChange={e => un('seo', { title: e.target.value })} /></Field>
            <Field label="وصف الموقع (SEO)"><input className="input" value={s.seo.description} onChange={e => un('seo', { description: e.target.value })} /></Field>
          </div>
        </div>
      )}

      {tab === 'look' && (
        <div className="panel">
          <div className="form-grid">
            <Field label="الشعار (صورة)" span2><SingleImage value={s.logoImage} onChange={v => u('logoImage', v)} hint="إن لم ترفع شعاراً يُعرض اسم المتجر بحرفه الأول." /></Field>
            <Field label="اللون الأساسي" hint="الأزرار والروابط والعناوين المميزة"><div className="color-field"><input type="color" value={s.primaryColor} onChange={e => u('primaryColor', e.target.value)} /><input className="input input-sm num" dir="ltr" value={s.primaryColor} onChange={e => u('primaryColor', e.target.value)} /></div></Field>
            <Field label="اللون الثانوي" hint="الشارات والتمييز"><div className="color-field"><input type="color" value={s.accentColor} onChange={e => u('accentColor', e.target.value)} /><input className="input input-sm num" dir="ltr" value={s.accentColor} onChange={e => u('accentColor', e.target.value)} /></div></Field>
            <div className="field"><label>السمة</label><div className="pill-tabs"><button className={s.theme === 'dark' ? 'on' : ''} onClick={() => u('theme', 'dark')}><Icon.Moon style={{ width: 14, height: 14, verticalAlign: -2 }} /> داكنة</button><button className={s.theme === 'light' ? 'on' : ''} onClick={() => u('theme', 'light')}><Icon.Sun style={{ width: 14, height: 14, verticalAlign: -2 }} /> فاتحة</button></div></div>
            <div className="field"><label>ألوان جاهزة</label><div className="chip-list">{[['#22d3ee', '#a3e635'], ['#3b82f6', '#f59e0b'], ['#8b5cf6', '#ec4899'], ['#10b981', '#f97316'], ['#ef4444', '#fbbf24'], ['#f97316', '#06b6d4']].map(([p, a]) => <button key={p} className="chip" style={{ display: 'inline-flex', gap: 4 }} onClick={() => { u('primaryColor', p); u('accentColor', a) }}><i style={{ width: 14, height: 14, borderRadius: 4, background: p }} /><i style={{ width: 14, height: 14, borderRadius: 4, background: a }} /></button>)}</div></div>
            <div className="field span-2"><label className="check"><input type="checkbox" checked={s.announcement.enabled} onChange={e => un('announcement', { enabled: e.target.checked })} />شريط إعلان أعلى الموقع</label><input className="input" value={s.announcement.text} onChange={e => un('announcement', { text: e.target.value })} /></div>
          </div>
        </div>
      )}

      {tab === 'home' && (
        <div className="stack">
          <div className="panel">
            <h3>القسم الرئيسي (Hero)</h3>
            <div className="form-grid">
              <Field label="السطر العلوي"><input className="input" value={s.hero.eyebrow} onChange={e => un('hero', { eyebrow: e.target.value })} /></Field>
              <Field label="العنوان"><input className="input" value={s.hero.title} onChange={e => un('hero', { title: e.target.value })} /></Field>
              <Field label="الكلمة الملوّنة من العنوان"><input className="input" value={s.hero.highlight} onChange={e => un('hero', { highlight: e.target.value })} /></Field>
              <Field label="نص الزر الأول"><input className="input" value={s.hero.cta1} onChange={e => un('hero', { cta1: e.target.value })} /></Field>
              <Field label="نص الزر الثاني"><input className="input" value={s.hero.cta2} onChange={e => un('hero', { cta2: e.target.value })} /></Field>
              <Field label="الوصف" span2><textarea className="textarea" style={{ minHeight: 70 }} value={s.hero.subtitle} onChange={e => un('hero', { subtitle: e.target.value })} /></Field>
              <Field label="صورة القسم الرئيسي (اختياري)" span2><SingleImage value={s.hero.image} onChange={v => un('hero', { image: v })} hint="صورة بخلفية شفافة PNG تبدو أفضل. بدونها يُعرض رسم الدرون." /></Field>
            </div>
            <div className="field" style={{ marginTop: 14 }}><label>الأرقام</label><ListEditor title="رقم" items={s.hero.stats} onChange={v => un('hero', { stats: v })} blank={{ value: '', label: '' }} fields={[{ key: 'value', label: 'القيمة' }, { key: 'label', label: 'الوصف' }]} /></div>
          </div>
          <div className="panel">
            <h3>الأقسام الظاهرة في الرئيسية</h3>
            <div className="chip-list">{([['categories', 'الأقسام'], ['featured', 'المنتجات المميزة'], ['services', 'الخدمات'], ['brands', 'سلاسل DJI'], ['why', 'لماذا نحن'], ['testimonials', 'آراء العملاء'], ['faq', 'الأسئلة الشائعة'], ['cta', 'دعوة للصيانة']] as const).map(([k, l]) => <button key={k} className={`chip ${s.sections[k] ? 'on' : ''}`} onClick={() => un('sections', { [k]: !s.sections[k] })}>{s.sections[k] ? '✓ ' : ''}{l}</button>)}</div>
          </div>
        </div>
      )}

      {tab === 'content' && (
        <div className="stack">
          <div className="panel"><h3>الخدمات</h3><ListEditor title="خدمة" items={s.services} onChange={v => u('services', v)} blank={{ title: '', description: '', icon: 'tool' as IllustrationKey, price: '' }} fields={[{ key: 'title', label: 'العنوان' }, { key: 'icon', label: 'الأيقونة', kind: 'icon' }, { key: 'price', label: 'السعر (نص)' }, { key: 'description', label: 'الوصف', kind: 'textarea' }]} /></div>
          <div className="panel"><h3>لماذا نحن</h3><ListEditor title="ميزة" items={s.why} onChange={v => u('why', v)} blank={{ title: '', description: '' }} fields={[{ key: 'title', label: 'العنوان' }, { key: 'description', label: 'الوصف', kind: 'textarea' }]} /></div>
          <div className="panel"><h3>آراء العملاء</h3><ListEditor title="رأي" items={s.testimonials} onChange={v => u('testimonials', v)} blank={{ name: '', text: '', city: '', rating: 5 }} fields={[{ key: 'name', label: 'الاسم' }, { key: 'city', label: 'المدينة' }, { key: 'rating', label: 'التقييم (1-5)', kind: 'number' }, { key: 'text', label: 'النص', kind: 'textarea' }]} /></div>
          <div className="panel"><h3>الأسئلة الشائعة</h3><ListEditor title="سؤال" items={s.faq} onChange={v => u('faq', v)} blank={{ q: '', a: '' }} fields={[{ key: 'q', label: 'السؤال' }, { key: 'a', label: 'الجواب', kind: 'textarea' }]} /></div>
          <div className="panel"><h3>من نحن</h3><div className="form-grid"><Field label="العنوان"><input className="input" value={s.about.title} onChange={e => un('about', { title: e.target.value })} /></Field><Field label="النص" span2><textarea className="textarea" style={{ minHeight: 140 }} value={s.about.body} onChange={e => un('about', { body: e.target.value })} /></Field></div></div>
        </div>
      )}

      {tab === 'shipping' && (
        <div className="stack">
          <div className="panel">
            <h3>العملة</h3>
            <div className="form-grid">
              <Field label="رمز العملة" hint="مثال USD أو SYP"><input className="input num" dir="ltr" value={s.currency.code} onChange={e => un('currency', { code: e.target.value })} /></Field>
              <Field label="الرمز المعروض" hint="مثال $ أو ل.س"><input className="input" value={s.currency.symbol} onChange={e => un('currency', { symbol: e.target.value })} /></Field>
              <div className="field span-2"><label className="check"><input type="checkbox" checked={s.secondaryCurrency.enabled} onChange={e => un('secondaryCurrency', { enabled: e.target.checked })} />عرض السعر بعملة ثانية تقريبية بجانب السعر</label></div>
              {s.secondaryCurrency.enabled && <>
                <Field label="رمز العملة الثانية"><input className="input" value={s.secondaryCurrency.symbol} onChange={e => un('secondaryCurrency', { symbol: e.target.value })} /></Field>
                <Field label="سعر الصرف (1 عملة أساسية =)"><input className="input num" type="number" min={0} value={s.secondaryCurrency.rate} onChange={e => un('secondaryCurrency', { rate: Number(e.target.value) })} /></Field>
              </>}
            </div>
          </div>
          <div className="panel">
            <h3>الشحن</h3>
            <div className="form-grid">
              <Field label="ملاحظة الشحن (تظهر في السلة)" span2><input className="input" value={s.shipping.note} onChange={e => un('shipping', { note: e.target.value })} /></Field>
              <Field label="شحن مجاني للطلبات فوق" hint="اتركه فارغاً لتعطيل الشحن المجاني"><input className="input num" type="number" min={0} value={s.shipping.freeAbove ?? ''} onChange={e => un('shipping', { freeAbove: e.target.value ? Number(e.target.value) : undefined })} /></Field>
            </div>
            <div className="field" style={{ marginTop: 14 }}><label>المحافظات ورسوم الشحن</label><ListEditor title="منطقة" items={s.shipping.zones} onChange={v => un('shipping', { zones: v })} blank={{ name: '', fee: 0 }} fields={[{ key: 'name', label: 'المحافظة' }, { key: 'fee', label: 'رسوم الشحن', kind: 'number' }]} /></div>
          </div>
        </div>
      )}

      {tab === 'repair' && (
        <div className="panel">
          <div className="form-grid">
            <Field label="النص التعريفي في صفحة طلب الصيانة" span2><textarea className="textarea" style={{ minHeight: 70 }} value={s.repair.intro} onChange={e => un('repair', { intro: e.target.value })} /></Field>
            <Field label="أنواع الأجهزة (سطر لكل نوع)"><textarea className="textarea" value={s.repair.deviceTypes.join('\n')} onChange={e => un('repair', { deviceTypes: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })} /></Field>
            <Field label="الماركات (سطر لكل ماركة)"><textarea className="textarea" value={s.repair.brands.join('\n')} onChange={e => un('repair', { brands: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })} /></Field>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="panel" style={{ maxWidth: 480 }}>
          <h3>تغيير كلمة مرور الإدارة</h3>
          <div className="stack">
            <Field label="كلمة المرور الحالية"><input className="input" type="password" value={pw.current} onChange={e => setPw(x => ({ ...x, current: e.target.value }))} /></Field>
            <Field label="كلمة المرور الجديدة"><input className="input" type="password" value={pw.next} onChange={e => setPw(x => ({ ...x, next: e.target.value }))} /></Field>
            <Field label="تأكيد كلمة المرور الجديدة"><input className="input" type="password" value={pw.confirm} onChange={e => setPw(x => ({ ...x, confirm: e.target.value }))} /></Field>
            <button className="btn btn-primary" onClick={changePw}><Icon.Lock />تغيير</button>
          </div>
        </div>
      )}

      {tab === 'data' && (
        <div className="stack">
          <div className="panel">
            <h3>نسخة احتياطية</h3>
            <p className="muted small" style={{ marginBottom: 12 }}>صدّر كل البيانات (المنتجات، الطلبات، الصيانة، الدفتر، الإعدادات) إلى ملف JSON، واستعدها على نفس الموقع أو موقع آخر.</p>
            <div className="row wrap"><button className="btn btn-primary btn-sm" onClick={exportAll}><Icon.Download />تصدير نسخة احتياطية</button><button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><Icon.Upload />استعادة من ملف</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={e => importAll(e.target.files?.[0])} /></div>
          </div>
          <div className="danger-zone">
            <h3 style={{ marginBottom: 6 }}>النسخة الافتراضية</h3>
            <p className="muted small" style={{ marginBottom: 12 }}>{s.demoCleared ? 'تم حذف النسخة الافتراضية. يمكنك إعادتها للتجربة؛ لن تمسّ بياناتك الحقيقية.' : 'لحذف كل البيانات التجريبية استخدم الزر في لوحة التحكم الرئيسية.'}</p>
            <div className="row wrap">
              {s.demoCleared ? <button className="btn btn-ghost btn-sm" onClick={() => setRestore(true)}><Icon.Refresh />استعادة النسخة الافتراضية</button> : <button className="btn btn-danger btn-sm" onClick={() => navigate('/admin')}><Icon.Trash />الانتقال لحذف النسخة الافتراضية</button>}
            </div>
          </div>
          {restore && <Confirm title="استعادة النسخة الافتراضية" confirmLabel="استعادة" text="سيُعاد إضافة المنتجات والطلبات التجريبية. يمكنك حذفها مجدداً في أي وقت." onClose={() => setRestore(false)} onConfirm={async () => { await api.admin.restoreDemo(); const ns = await api.admin.settings(); setS(ns); await reload(); toast('تمت الاستعادة') }} />}
        </div>
      )}
    </>
  )
}

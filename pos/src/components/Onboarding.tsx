// First run: a short wizard that names the store, picks the currency and adds a first product. Shown until settings.onboarded.
import { useState } from 'react'
import { forbiddenProduct } from '../lib/policy'
import { ArrowLeft, ArrowRight, BarChart3, Check, Package, ShieldCheck, Zap } from 'lucide-react'
import '../screens/settings/i18n'
import '../screens/settings/settings.css'
import { useStore, toast } from '../state/store'
import { useT, useLang } from '../i18n'
import { Button, Field, Input, Modal, NumberInput, Seg, Textarea, useIsMobile } from './ui'
import { db } from '../db'
import type { CurrencySettings, Settings } from '../db/types'
import { uid } from '../lib/ids'
import { round } from '../lib/money'
import { cleanBarcode } from '../lib/barcode'
import { CurrencyPicker } from '../screens/settings/CurrencyPicker'
import { insertSampleProducts } from '../screens/settings/sampleData'
import icon from '/icon.svg'

const STEPS = 4

export default function Onboarding() {
  const ready = useStore(s => s.ready)
  const settings = useStore(s => s.settings)
  if (!ready || !settings || settings.onboarded) return null
  return <Wizard settings={settings} />
}

function Wizard({ settings }: { settings: Settings }) {
  const t = useT()
  const lang = useLang()
  const mobile = useIsMobile()
  const user = useStore(s => s.user)
  const updateSettings = useStore(s => s.updateSettings)
  const [step, setStep] = useState(0)
  const [store, setStore] = useState({ name: settings.store.name, phone: settings.store.phone, address: settings.store.address })
  const [currency, setCurrency] = useState<CurrencySettings>(settings.currency)
  const [product, setProduct] = useState<{ name: string; price: number | ''; barcode: string }>({ name: '', price: '', barcode: '' })
  const [err, setErr] = useState<string | null>(null)
  const [sampleAdded, setSampleAdded] = useState(0)
  const [busy, setBusy] = useState<'sample' | 'finish' | null>(null)

  const validate = (): string | null => {
    if (step === 1 && !store.name.trim()) return t('settings.store.nameRequired')
    if (step === 2 && !currency.symbol.trim()) return t('settings.currency.symbolRequired')
    if (step === 3 && product.name.trim() && !(Number(product.price) > 0)) return t('settings.onb.product.priceRequired')
    return null
  }
  const next = () => {
    const e = validate()
    if (e) { setErr(e); return }
    setErr(null)
    if (step < STEPS - 1) setStep(step + 1); else void finish()
  }
  const back = () => { setErr(null); setStep(Math.max(0, step - 1)) }

  const addSample = async () => {
    setBusy('sample')
    try {
      const n = await insertSampleProducts(lang, currency.decimals, user?.id)
      setSampleAdded(n)
      toast(t('settings.onb.sampleDone', { n }), 'success')
    } catch { toast(t('settings.onb.sampleFailed'), 'error') }
    finally { setBusy(null) }
  }

  const finish = async () => {
    setBusy('finish')
    try {
      const cur = { ...currency, symbol: currency.symbol.trim() }
      if (product.name.trim() && forbiddenProduct({ name: product.name })) { toast(t('policy.tobaccoTitle'), 'error'); setBusy(null); return }
      if (product.name.trim()) {
        const now = Date.now()
        const code = cleanBarcode(product.barcode)
        await db.products.add({
          id: uid(), name: product.name.trim(), barcodes: code ? [code] : [], price: round(Number(product.price), cur.decimals), cost: 0,
          trackStock: false, stock: 0, lowStock: 0, unit: 'piece', allowFraction: false, favorite: true, active: true, createdAt: now, updatedAt: now,
        })
      }
      await updateSettings({ onboarded: true, store: { name: store.name.trim(), phone: store.phone.trim(), address: store.address.trim() }, currency: cur })
      toast(t('settings.onb.done'), 'success')
    } catch { toast(t('settings.onb.failed'), 'error'); setBusy(null) }
  }

  const benefits = [
    { icon: <Zap size={20} />, title: t('settings.onb.b1.title'), text: t('settings.onb.b1.text') },
    { icon: <ShieldCheck size={20} />, title: t('settings.onb.b2.title'), text: t('settings.onb.b2.text') },
    { icon: <BarChart3 size={20} />, title: t('settings.onb.b3.title'), text: t('settings.onb.b3.text') },
  ]
  const Back = lang === 'ar' ? ArrowRight : ArrowLeft
  const Next = lang === 'ar' ? ArrowLeft : ArrowRight

  return (
    <Modal open noClose onClose={() => {}} full={mobile} className="onboarding" footer={
      <>
        {step > 0 && <Button icon={<Back size={16} />} onClick={back} disabled={!!busy}>{t('common.back')}</Button>}
        <Button variant="primary" size="lg" icon={step === STEPS - 1 ? <Check size={18} /> : <Next size={18} />} onClick={next} loading={busy === 'finish'} disabled={busy === 'sample'}>
          {step === 0 ? t('settings.onb.start') : step === STEPS - 1 ? t('settings.onb.finish') : t('settings.onb.next')}
        </Button>
      </>
    }>
      <form className="onb" onSubmit={e => { e.preventDefault(); next() }}>
        <div className="onb-top">
          <div className="onb-dots" aria-label={t('settings.onb.step', { n: step + 1, total: STEPS })}>
            {Array.from({ length: STEPS }, (_, i) => <i key={i} className={i === step ? 'on' : i < step ? 'done' : ''} />)}
          </div>
          <span className="xs faint step-txt">{t('settings.onb.step', { n: step + 1, total: STEPS })}</span>
          <Seg<Settings['lang']> value={lang} onChange={v => void updateSettings({ lang: v })} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
        </div>

        {step === 0 && (
          <div className="onb-step">
            <div className="onb-hero">
              <img src={icon} alt="" />
              <h2>{t('settings.onb.welcome.title')}</h2>
              <p className="muted">{t('settings.onb.welcome.text')}</p>
            </div>
            <div className="onb-benefits" style={{ marginTop: 16 }}>
              {benefits.map(b => <div key={b.title} className="onb-benefit"><span className="ico">{b.icon}</span><div><div className="bt">{b.title}</div><div className="bx">{b.text}</div></div></div>)}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onb-step">
            <h3>{t('settings.onb.store.title')}</h3>
            <p className="lead">{t('settings.onb.store.text')}</p>
            <div className="col" style={{ gap: 12 }}>
              <Field label={t('settings.store.name')} error={err ?? undefined}>
                <Input value={store.name} onChange={e => { setStore({ ...store, name: e.target.value }); setErr(null) }} placeholder={t('settings.store.namePh')} maxLength={60} autoFocus invalid={!!err} />
              </Field>
              <Field label={`${t('settings.store.phone')} (${t('common.optional')})`}>
                <Input ltr inputMode="tel" value={store.phone} onChange={e => setStore({ ...store, phone: e.target.value })} maxLength={30} />
              </Field>
              <Field label={`${t('settings.store.address')} (${t('common.optional')})`}>
                <Textarea value={store.address} onChange={e => setStore({ ...store, address: e.target.value })} rows={2} maxLength={160} style={{ minHeight: 56 }} />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onb-step">
            <h3>{t('settings.onb.currency.title')}</h3>
            <p className="lead">{t('settings.onb.currency.text')}</p>
            <CurrencyPicker value={currency} onChange={c => { setCurrency(c); setErr(null) }} error={err ?? undefined} />
          </div>
        )}

        {step === 3 && (
          <div className="onb-step">
            <h3>{t('settings.onb.product.title')}</h3>
            <p className="lead">{t('settings.onb.product.text')}</p>
            <div className="col" style={{ gap: 12 }}>
              <Field label={`${t('settings.onb.product.name')} (${t('common.optional')})`}>
                <Input value={product.name} onChange={e => { setProduct({ ...product, name: e.target.value }); setErr(null) }} placeholder={t('settings.onb.product.namePh')} maxLength={80} autoFocus />
              </Field>
              <div className="form-grid">
                <Field label={t('settings.onb.product.price')} error={err ?? undefined}>
                  <NumberInput value={product.price} onChange={n => { setProduct({ ...product, price: n }); setErr(null) }} decimals={currency.decimals} invalid={!!err} placeholder="0" />
                </Field>
                <Field label={`${t('settings.onb.product.barcode')} (${t('common.optional')})`}>
                  <Input ltr inputMode="numeric" value={product.barcode} onChange={e => setProduct({ ...product, barcode: e.target.value })} maxLength={32} />
                </Field>
              </div>
              <div className="onb-or">{t('settings.onb.or')}</div>
              <div className={`onb-sample ${sampleAdded ? 'done' : ''}`}>
                <span className="emojis">🥤🧀🥫🧴</span>
                <div className="grow">
                  <div className="bold small">{sampleAdded ? t('settings.onb.sampleDone', { n: sampleAdded }) : t('settings.onb.sample')}</div>
                  <div className="xs faint">{t('settings.onb.sampleHint')}</div>
                </div>
                {sampleAdded ? <Check size={20} style={{ color: 'var(--primary)' }} /> : (
                  <Button variant="soft" icon={<Package size={16} />} loading={busy === 'sample'} onClick={() => void addSample()}>{t('common.add')}</Button>
                )}
              </div>
            </div>
          </div>
        )}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden />
      </form>
    </Modal>
  )
}

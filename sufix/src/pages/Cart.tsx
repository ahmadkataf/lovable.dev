import React, { useEffect, useState } from 'react'
import type { Order } from '@shared/types'
import { Link, navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { api } from '../lib/api'
import { fmtMoney, waLink } from '../lib/format'
import { ProductImage } from '../components/Illustrations'
import { Icon } from '../components/Icons'
import { Empty, Field, Price } from '../components/ui'

function Steps({ n }: { n: 1 | 2 | 3 }) {
  const items = ['السلة', 'بياناتك', 'التأكيد عبر واتساب']
  return <div className="steps">{items.map((l, i) => <React.Fragment key={l}><span className={`s ${i + 1 <= n ? 'on' : ''}`}><b>{i + 1}</b>{l}</span>{i < 2 && <span className="sep" />}</React.Fragment>)}</div>
}

export function CartPage() {
  const { cart, setQty, removeFromCart, cartTotal, settings, products } = useStore()
  if (!cart.length) return <div className="page container"><Steps n={1} /><Empty icon={<Icon.Cart />} title="سلتك فارغة" text="أضف منتجات من المتجر ثم عد لإتمام الطلب." action={<Link to="/shop" className="btn btn-primary">تصفّح المتجر</Link>} /></div>
  const free = settings.shipping.freeAbove && cartTotal >= settings.shipping.freeAbove
  return (
    <div className="page container">
      <Steps n={1} />
      <div className="page-head"><h1>سلة التسوّق</h1></div>
      <div className="cart-layout">
        <div className="stack">
          {cart.map(it => {
            const p = products.find(x => x.id === it.productId)
            return (
              <div key={it.productId} className="cart-item">
                <Link to={`/product/${it.productId}`} className="thumb"><ProductImage image={it.image} illustration={it.illustration} /></Link>
                <div>
                  <Link to={`/product/${it.productId}`}><h4>{it.name}</h4></Link>
                  <div className="muted small">{fmtMoney(it.price, settings)} × {it.qty}</div>
                  {p && p.stock < it.qty && <div className="error-text small">المتوفر {p.stock} فقط</div>}
                  <div className="row" style={{ marginTop: 8 }}>
                    <div className="qty">
                      <button onClick={() => setQty(it.productId, it.qty - 1)}><Icon.Minus width={14} height={14} /></button>
                      <span>{it.qty}</span>
                      <button onClick={() => setQty(it.productId, Math.min(p?.stock || 99, it.qty + 1))}><Icon.Plus width={14} height={14} /></button>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeFromCart(it.productId)}><Icon.Trash />حذف</button>
                  </div>
                </div>
                <div className="price">{fmtMoney(it.price * it.qty, settings)}</div>
              </div>
            )
          })}
        </div>
        <div>
          <div className="card card-pad summary">
            <h3 style={{ marginBottom: 10 }}>ملخص الطلب</h3>
            <div className="line"><span>المجموع</span><span className="num">{fmtMoney(cartTotal, settings)}</span></div>
            <div className="line"><span>الشحن</span><span>{free ? 'مجاني' : 'يُحدَّد حسب المحافظة'}</span></div>
            {!free && settings.shipping.freeAbove ? <div className="hint">شحن مجاني للطلبات فوق {fmtMoney(settings.shipping.freeAbove, settings)}</div> : null}
            <div className="line total"><span>الإجمالي</span><Price value={cartTotal} /></div>
            <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }} onClick={() => navigate('/checkout')}>متابعة الطلب</button>
            <Link to="/shop" className="btn btn-ghost btn-block" style={{ marginTop: 8 }}>إضافة منتجات أخرى</Link>
            <p className="hint" style={{ marginTop: 12 }}>{settings.shipping.note}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const DRAFT_KEY = 'sufix_customer'

export function CheckoutPage() {
  const { cart, cartTotal, settings, clearCart, toast } = useStore()
  const [c, setC] = useState(() => { try { return { name: '', phone: '', city: settings.shipping.zones[0]?.name || '', address: '', notes: '', ...JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') } } catch { return { name: '', phone: '', city: '', address: '', notes: '' } } })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (!c.city && settings.shipping.zones[0]) setC((x: typeof c) => ({ ...x, city: settings.shipping.zones[0].name })) }, [settings])
  useEffect(() => { if (!cart.length) navigate('/cart', { replace: true }) }, [cart.length])
  const zone = settings.shipping.zones.find(z => z.name === c.city)
  const free = settings.shipping.freeAbove && cartTotal >= settings.shipping.freeAbove
  const shipping = free ? 0 : zone?.fee ?? 0
  const upd = (k: string, v: string) => setC((x: typeof c) => ({ ...x, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (c.name.trim().length < 2) return setErr('أدخل اسمك الكامل')
    if (c.phone.replace(/\D/g, '').length < 9) return setErr('أدخل رقم هاتف صحيح (مثال 0912345678)')
    if (c.address.trim().length < 3) return setErr('أدخل العنوان بالتفصيل')
    setBusy(true)
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: c.name, phone: c.phone, city: c.city, address: c.address }))
      const order = await api.createOrder({ customer: { name: c.name, phone: c.phone, city: c.city, address: c.address, notes: c.notes }, items: cart.map(it => ({ productId: it.productId, qty: it.qty })), zone: c.city })
      sessionStorage.setItem(`sufix_order_${order.id}`, JSON.stringify(order))
      clearCart()
      navigate(`/order/${order.id}`)
    } catch (e) {
      setErr((e as Error).message || 'تعذّر إرسال الطلب')
      toast('تعذّر إرسال الطلب', 'err')
    } finally { setBusy(false) }
  }

  return (
    <div className="page container">
      <Steps n={2} />
      <div className="page-head"><h1>بيانات التوصيل</h1><p>لا يوجد دفع إلكتروني: نسجّل طلبك برقم تتبّع ثم تتفق مع البائع على التسليم والدفع عبر واتساب.</p></div>
      <form className="cart-layout" onSubmit={submit}>
        <div className="card card-pad">
          <div className="form-grid">
            <Field label="الاسم الكامل *"><input className="input" value={c.name} onChange={e => upd('name', e.target.value)} autoComplete="name" /></Field>
            <Field label="رقم الهاتف (واتساب) *"><input className="input num" dir="ltr" placeholder="09xxxxxxxx" value={c.phone} onChange={e => upd('phone', e.target.value)} autoComplete="tel" inputMode="tel" /></Field>
            <Field label="المحافظة *">
              <select className="select" value={c.city} onChange={e => upd('city', e.target.value)}>
                {settings.shipping.zones.map(z => <option key={z.name} value={z.name}>{z.name}{z.fee ? ` — شحن ${fmtMoney(z.fee, settings)}` : ''}</option>)}
                {!settings.shipping.zones.length && <option value="">—</option>}
              </select>
            </Field>
            <Field label="العنوان بالتفصيل *"><input className="input" placeholder="المدينة، الحي، الشارع، أقرب معلم" value={c.address} onChange={e => upd('address', e.target.value)} /></Field>
            <Field label="ملاحظات (اختياري)" span2><textarea className="textarea" style={{ minHeight: 80 }} value={c.notes} onChange={e => upd('notes', e.target.value)} placeholder="وقت التوصيل المفضل، لون، أي تفاصيل أخرى" /></Field>
          </div>
          {err && <p className="error-text" style={{ marginTop: 12 }}>{err}</p>}
        </div>
        <div>
          <div className="card card-pad summary">
            <h3 style={{ marginBottom: 10 }}>طلبك</h3>
            {cart.map(it => <div key={it.productId} className="line"><span>{it.name} × {it.qty}</span><span className="num">{fmtMoney(it.price * it.qty, settings)}</span></div>)}
            <div className="line"><span>الشحن ({c.city || '—'})</span><span className="num">{shipping ? fmtMoney(shipping, settings) : 'مجاني'}</span></div>
            <div className="line total"><span>الإجمالي</span><Price value={cartTotal + shipping} /></div>
            <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 14 }} disabled={busy}>{busy ? 'جارٍ التسجيل…' : 'تسجيل الطلب والمتابعة'}</button>
            <p className="hint" style={{ marginTop: 10 }}>الخطوة التالية: زر «إتمام الطلب عبر واتساب» يرسل تفاصيل طلبك للبائع.</p>
          </div>
        </div>
      </form>
    </div>
  )
}

export function buildOrderMessage(o: Order, siteName: string, symbol: string) {
  const lines = [
    `طلب جديد من موقع ${siteName}`,
    `رقم الطلب: #${o.number}`,
    '',
    ...o.items.map(it => `• ${it.name} × ${it.qty} = ${it.price * it.qty} ${symbol}`),
    '',
    `المجموع: ${o.subtotal} ${symbol}`,
    `الشحن: ${o.shipping ? `${o.shipping} ${symbol}` : 'مجاني'}`,
    `الإجمالي: ${o.total} ${symbol}`,
    '',
    `الاسم: ${o.customer.name}`,
    `الهاتف: ${o.customer.phone}`,
    `المحافظة: ${o.customer.city}`,
    `العنوان: ${o.customer.address}`,
    o.customer.notes ? `ملاحظات: ${o.customer.notes}` : '',
    '',
    `تتبّع الطلب: ${window.location.origin}/track?number=${o.number}`,
  ]
  return lines.filter(l => l !== undefined).join('\n')
}

export function OrderDonePage({ id }: { id: string }) {
  const { settings } = useStore()
  const [order] = useState<Order | null>(() => { try { return JSON.parse(sessionStorage.getItem(`sufix_order_${id}`) || 'null') } catch { return null } })
  const [sent, setSent] = useState(false)
  if (!order) return <div className="page container"><Empty icon={<Icon.Package />} title="لم نجد هذا الطلب" text="يمكنك تتبّع طلبك برقم الطلب ورقم هاتفك." action={<Link to="/track" className="btn btn-primary">تتبّع الطلب</Link>} /></div>
  const link = waLink(settings.whatsapp, buildOrderMessage(order, settings.siteName, settings.currency.symbol))
  return (
    <div className="page container">
      <Steps n={3} />
      <div className="success-box card">
        <div className="ok-ico"><Icon.Check /></div>
        <h1 style={{ fontSize: 26 }}>تم تسجيل طلبك</h1>
        <p className="muted" style={{ marginTop: 6 }}>رقم طلبك</p>
        <div className="order-no">#{order.number}</div>
        <p className="muted small">احتفظ بالرقم لتتبّع الطلب. أرسلنا تفاصيله لهاتفك {order.customer.phone}.</p>
        <div className="wa-callout">
          <h3 style={{ marginBottom: 8 }}>الخطوة الأخيرة</h3>
          <p className="muted small" style={{ marginBottom: 16 }}>اضغط الزر لإرسال تفاصيل طلبك للبائع عبر واتساب والاتفاق على التسليم والدفع.</p>
          <a className="btn btn-wa btn-lg btn-block" href={link} target="_blank" rel="noreferrer" onClick={() => { setSent(true); api.orderWhatsapp(order.id).catch(() => {}) }}><Icon.WhatsApp />إتمام الطلب عبر واتساب</a>
          {sent && <p className="small" style={{ marginTop: 10, color: 'var(--ok)' }}>✓ إذا لم يُفتح واتساب تلقائياً، راسلنا على {settings.phone} مع رقم الطلب.</p>}
        </div>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <Link to={`/track?number=${order.number}&phone=${encodeURIComponent(order.customer.phone)}`} className="btn btn-ghost">تتبّع الطلب</Link>
          <Link to="/shop" className="btn btn-outline">متابعة التسوّق</Link>
        </div>
      </div>
    </div>
  )
}

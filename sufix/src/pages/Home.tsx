import React from 'react'
import { Link } from '../lib/router'
import { useStore } from '../lib/store'
import { waLink } from '../lib/format'
import { Icon } from '../components/Icons'
import { Illustration } from '../components/Illustrations'
import { ProductCard } from '../components/ProductCard'
import { Stars } from '../components/ui'
import { DJI_SERIES } from '@shared/dji'

export function HomePage() {
  const { settings: s, categories, products, ready } = useStore()
  const featured = products.filter(p => p.featured && p.stock > 0).slice(0, 8)
  const latest = products.filter(p => !featured.includes(p)).slice(0, 8)
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow fade-up">{s.hero.eyebrow}</span>
            <h1 className="fade-up d1">{s.hero.title} <span className="hl">{s.hero.highlight}</span></h1>
            <p className="lead fade-up d2">{s.hero.subtitle}</p>
            <div className="hero-cta fade-up d3">
              <Link to="/shop" className="btn btn-primary btn-lg"><Icon.Cart />{s.hero.cta1}</Link>
              <Link to="/repair" className="btn btn-ghost btn-lg"><Icon.Wrench />{s.hero.cta2}</Link>
            </div>
            {s.hero.stats.length > 0 && (
              <div className="hero-stats fade-up d4">
                {s.hero.stats.map((st, i) => <div key={i}><div className="v">{st.value}</div><div className="l">{st.label}</div></div>)}
              </div>
            )}
          </div>
          <div className="hero-visual fade-up d2">
            <div className="orb" /><div className="ring" /><div className="ring r2" />
            {s.hero.image ? <img className="drone" src={s.hero.image} alt="" /> : <Illustration name="drone-pro" className="drone" />}
            <div className="hero-chip glass c1"><Icon.Shield />ضمان على كل صيانة</div>
            <div className="hero-chip glass c2"><Icon.Truck />شحن لكل المحافظات</div>
            <div className="hero-chip glass c3"><Icon.WhatsApp style={{ color: 'var(--wa)' }} />طلب عبر واتساب</div>
          </div>
        </div>
      </section>

      {s.sections.categories && categories.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head"><div><span className="kicker">الأقسام</span><h2>تسوّق حسب القسم</h2></div><Link to="/shop" className="btn btn-outline btn-sm">كل المنتجات</Link></div>
            <div className="cat-grid">
              {categories.map(c => (
                <Link key={c.id} to={`/shop?category=${c.id}`} className="cat-card">
                  <span className="ico"><Illustration name={c.icon} /></span>
                  <b>{c.name}</b>
                  <span className="num">{products.filter(p => p.category === c.id).length} منتج</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {s.sections.featured && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head"><div><span className="kicker">مختارات</span><h2>الأكثر طلباً</h2><p>درونات وقطع أصلية مختارة بعناية، جاهزة للشحن اليوم.</p></div><Link to="/shop?sort=popular" className="btn btn-outline btn-sm">عرض الكل</Link></div>
            {!ready ? <div className="product-grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '.75' }} />)}</div>
              : <div className="product-grid">{(featured.length ? featured : latest).map(p => <ProductCard key={p.id} p={p} />)}</div>}
          </div>
        </section>
      )}

      {s.sections.services && s.services.length > 0 && (
        <section className="section" style={{ background: 'var(--bg-2)', borderBlock: '1px solid var(--border)' }}>
          <div className="container">
            <div className="section-head"><div><span className="kicker">خدمات الصيانة</span><h2>نصلح ما يعجز عنه الآخرون</h2><p>فحص مجاني، تقرير واضح قبل البدء، وقطع أصلية مع ضمان.</p></div><Link to="/repair" className="btn btn-primary btn-sm"><Icon.Wrench />اطلب صيانة الآن</Link></div>
            <div className="grid grid-3">
              {s.services.map((sv, i) => (
                <div key={i} className="svc-card">
                  <span className="ico"><Illustration name={sv.icon} /></span>
                  <h3>{sv.title}</h3>
                  <p>{sv.description}</p>
                  {sv.price && <span className="price-tag">{sv.price}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {s.sections.brands && (
        <section className="section">
          <div className="container">
            <div className="section-head"><div><span className="kicker">DJI</span><h2>كل سلاسل DJI، وكل قطعها</h2><p>اختر الطراز لتجد البطاريات والمراوح والجيمبال والأذرع المتوافقة معه.</p></div><Link to="/dji" className="btn btn-outline btn-sm">استعرض الطرازات</Link></div>
            <div className="brand-strip">{DJI_SERIES.map(se => <Link key={se} to={`/dji?series=${encodeURIComponent(se)}`}>DJI {se}</Link>)}</div>
          </div>
        </section>
      )}

      {s.sections.why && s.why.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head"><div><span className="kicker">لماذا {s.siteName}</span><h2>ثقة آلاف العملاء</h2></div></div>
            <div className="grid grid-2" style={{ gap: 28 }}>
              {s.why.map((w, i) => <div key={i} className="why-item"><span className="n">{i + 1}</span><div><h3>{w.title}</h3><p>{w.description}</p></div></div>)}
            </div>
          </div>
        </section>
      )}

      {s.sections.testimonials && s.testimonials.length > 0 && (
        <section className="section" style={{ background: 'var(--bg-2)', borderBlock: '1px solid var(--border)' }}>
          <div className="container">
            <div className="section-head"><div><span className="kicker">آراء العملاء</span><h2>ماذا يقولون عنا</h2></div></div>
            <div className="grid grid-3">
              {s.testimonials.map((t, i) => (
                <div key={i} className="testi">
                  <Stars n={t.rating} />
                  <p>“{t.text}”</p>
                  <div className="who"><span className="avatar">{t.name.slice(0, 1)}</span><div><b style={{ fontSize: 14 }}>{t.name}</b>{t.city && <div className="small muted">{t.city}</div>}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {s.sections.faq && s.faq.length > 0 && (
        <section className="section">
          <div className="container" style={{ maxWidth: 820 }}>
            <div className="section-head"><div><span className="kicker">الأسئلة الشائعة</span><h2>كل ما تريد معرفته</h2></div></div>
            <div className="stack">{s.faq.map((f, i) => <details key={i} className="faq-item"><summary>{f.q}</summary><div className="a">{f.a}</div></details>)}</div>
          </div>
        </section>
      )}

      {s.sections.cta && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="cta-band">
              <div><h2>جهازك معطّل؟ أرسل لنا صورة الآن</h2><p>نردّ خلال ساعات العمل بتقدير مبدئي للتكلفة والمدة.</p></div>
              <div className="row wrap">
                <Link to="/repair" className="btn btn-primary btn-lg"><Icon.Wrench />طلب صيانة</Link>
                <a className="btn btn-wa btn-lg" href={waLink(s.whatsapp, `مرحباً ${s.siteName}، جهازي يحتاج صيانة`)} target="_blank" rel="noreferrer"><Icon.WhatsApp />واتساب</a>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  )
}

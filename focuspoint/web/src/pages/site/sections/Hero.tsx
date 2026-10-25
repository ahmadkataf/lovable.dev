// Landing hero: eyebrow, headline, lead, two actions, trust chips, and the real meeting-room photo on a flat brand block.
import { Link } from 'react-router-dom'
import { CENTRE, IMG, hoursLabel, type SiteData } from '../site'
import { SiteIcon } from '../SiteIcon'

export function Hero({ data }: { data: SiteData }) {
  const photo = IMG.meeting
  return (
    <section className="fp-hero" aria-labelledby="fp-hero-title">
      <div className="fp-container fp-hero-grid">
        <div className="fp-hero-copy">
          <span className="fp-eyebrow"><span className="fp-dot" aria-hidden="true" />{CENTRE.firstOfItsKind}</span>
          <h1 id="fp-hero-title" className="fp-display">
            مساحتك الهادئة <span className="fp-brand-text">للشغل والدراسة</span> والإبداع
          </h1>
          <p className="fp-lead fp-lead-lg">
            غرف خاصة، قاعة اجتماعات، ومساحة مفتوحة بدرعا، على شارع المجمع الحكومي. احجز مكانك من موبايلك بخطوات بسيطة، وتعال اشتغل على رواق.
          </p>
          <div className="fp-actions">
            <Link to="/book" className="btn btn-primary btn-lg fp-btn">احجز الآن <SiteIcon name="arrow" size={20} /></Link>
            <Link to="/spaces" className="btn btn-outline btn-lg fp-btn">شوف المساحات</Link>
          </div>
          <ul className="fp-chips" aria-label="معلومات سريعة">
            <li><SiteIcon name="clock" size={16} /> يومياً {hoursLabel(data)}</li>
            <li><SiteIcon name="wifi" size={16} /> إنترنت سريع</li>
            <li><SiteIcon name="wallet" size={16} /> {data.payOnArrival ? 'الدفع بشام كاش أو عند الوصول' : 'الدفع بشام كاش'}</li>
          </ul>
        </div>
        <div className="fp-hero-media">
          <span className="fp-hero-block" aria-hidden="true" />
          <figure className="fp-hero-frame">
            <img src={photo.src} width={photo.w} height={photo.h} alt={photo.alt} decoding="async" {...({ fetchpriority: "high" } as Record<string, string>)} />
          </figure>
          <div className="fp-hero-badge" aria-hidden="true">
            <span className="fp-ticon is-violet"><SiteIcon name="present" size={20} /></span>
            <span>
              <b>قاعة اجتماعات لعشرة أشخاص</b>
              <small>شاشة + سبورة</small>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

// Landing hero: eyebrow, headline, lead, two actions, quick-info chips, and the photo on a flat brand block
// (content.home.hero + brand.eyebrow).
import { Link } from 'react-router-dom'
import { DEFAULT_CONTENT, pickVariant } from '@shared/content'
import { ContentText, hasText, usePhotoChain, useSite } from '../../../components/site/siteContent'
import { SiteIcon } from '../SiteIcon'

export function Hero() {
  const { c, vars, flags } = useSite()
  const h = c.home.hero
  const { photo, src, onError } = usePhotoChain([h.photo, DEFAULT_CONTENT.home.hero.photo])
  const chips = h.chips.map((ch) => ({ icon: ch.icon, text: pickVariant(ch, 'text', flags) })).filter((ch) => hasText(ch.text))
  return (
    <section className="fp-hero" aria-labelledby="fp-hero-title">
      <div className="fp-container fp-hero-grid">
        <div className="fp-hero-copy">
          {hasText(c.brand.eyebrow) && <span className="fp-eyebrow"><span className="fp-dot" aria-hidden="true" /><ContentText text={c.brand.eyebrow} vars={vars} /></span>}
          <h1 id="fp-hero-title" className="fp-display">
            <ContentText text={h.title} vars={vars} rich em="brand" />
          </h1>
          {hasText(h.lead) && (
            <p className="fp-lead fp-lead-lg">
              <ContentText text={h.lead} vars={vars} />
            </p>
          )}
          <div className="fp-actions">
            <Link to="/book" className="btn btn-primary btn-lg fp-btn">احجز الآن <SiteIcon name="arrow" size={20} /></Link>
            <Link to="/spaces" className="btn btn-outline btn-lg fp-btn">شوف المساحات</Link>
          </div>
          {chips.length > 0 && (
            <ul className="fp-chips" aria-label="معلومات سريعة">
              {chips.map((ch, i) => <li key={i}><SiteIcon name={ch.icon} size={16} /> <ContentText text={ch.text} vars={vars} /></li>)}
            </ul>
          )}
        </div>
        <div className="fp-hero-media">
          <span className="fp-hero-block" aria-hidden="true" />
          <figure className="fp-hero-frame">
            {photo && <img src={src} width={photo.w} height={photo.h} alt={photo.alt} decoding="async" onError={onError} {...({ fetchpriority: "high" } as Record<string, string>)} />}
          </figure>
          {hasText(h.badge_title) && (
            <div className="fp-hero-badge" aria-hidden="true">
              <span className="fp-ticon is-violet"><SiteIcon name={h.badge_icon} size={20} /></span>
              <span>
                <b><ContentText text={h.badge_title} vars={vars} /></b>
                {hasText(h.badge_text) && <small><ContentText text={h.badge_text} vars={vars} /></small>}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

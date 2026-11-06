// Landing hero: eyebrow, headline, lead, two actions, quick-info chips, and the photo on a flat brand block
// (content.home.hero + brand.eyebrow).
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_CONTENT, heroSrcSet, HERO_SIZES, pickVariant, type Photo, type SiteIconName } from '@shared/content'
import { ContentText, hasText, usePhotoChain, useSite } from '../../../components/site/siteContent'
import { SiteIcon } from '../SiteIcon'

interface Slide { photo: Photo; icon: SiteIconName; title: string; text: string; pos?: string }
const SLIDE_MS = 4500

/**
 * The hero photos turn by themselves: first the hero photo with its badge (content.home.hero — the meeting room by
 * default), then the open space, the training hall and the drinks corner (the photos of the spaces section and the
 * gallery), each with its own badge. Pauses while hovered or touched, and stays still with «reduce motion».
 */
function useSlides(): Slide[] {
  const { c } = useSite()
  const h = c.home.hero
  return useMemo(() => {
    const g = c.spaces.groups
    const coffee = c.home.gallery.photos.find((p) => p.src.includes('coffee'))
    const list: (Slide | null)[] = [
      { photo: h.photo, icon: h.badge_icon, title: h.badge_title, text: h.badge_text },
      g.open.photo ? { photo: g.open.photo, icon: 'grid', title: g.open.title, text: 'كرسي إلك بين ناس عم تشتغل' } : null,
      g.meeting.photo ? { photo: g.meeting.photo, icon: 'present', title: g.meeting.title, text: 'للدورات وورش العمل' } : null,
      coffee ? { photo: coffee, icon: 'coffee', title: 'ركن المشروبات', text: 'قهوة ومشروبات باردة', pos: '50% 22%' } : null,   // tall photo: keep the machine in frame
    ]
    const seen = new Set<string>()
    return list.filter((x): x is Slide => !!x && !seen.has(x.photo.src) && !!seen.add(x.photo.src))
  }, [c, h])
}

export function Hero() {
  const { c, vars, flags } = useSite()
  const h = c.home.hero
  const { photo, src, onError } = usePhotoChain([h.photo, DEFAULT_CONTENT.home.hero.photo])
  const slides = useSlides()
  const [at, setAt] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (slides.length < 2 || paused) return
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') setAt((i) => (i + 1) % slides.length) }, SLIDE_MS)
    return () => window.clearInterval(t)
  }, [slides.length, paused])
  const cur = slides[at] ?? slides[0]
  // phones take the 720px file (slow 3G): the same srcset/sizes the Worker preloads for / (api/src/site.ts)
  const srcSet = photo && src === photo.src ? heroSrcSet(photo) : undefined
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
          <figure className="fp-hero-frame" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
            onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)} aria-roledescription="carousel" aria-label="صور من المركز">
            {/* the first slide is the preloaded hero photo (srcset as the Worker preloads it); the others load after it */}
            {photo && <img className={`fp-hero-slide${at === 0 ? ' is-on' : ''}`} src={src} srcSet={srcSet} sizes={srcSet ? HERO_SIZES : undefined} width={photo.w} height={photo.h} alt={photo.alt} decoding="async" onError={onError} {...({ fetchpriority: "high" } as Record<string, string>)} />}
            {slides.slice(1).map((sl, i) => (
              <img key={sl.photo.src} className={`fp-hero-slide${at === i + 1 ? ' is-on' : ''}`} src={sl.photo.small || sl.photo.src}
                srcSet={sl.photo.small ? `${sl.photo.small} 720w, ${sl.photo.src} ${sl.photo.w}w` : undefined} sizes={sl.photo.small ? HERO_SIZES : undefined}
                width={sl.photo.w} height={sl.photo.h} alt={sl.photo.alt} style={sl.pos ? { objectPosition: sl.pos } : undefined} loading="lazy" decoding="async" aria-hidden={at !== i + 1} />
            ))}
          </figure>
          {cur && hasText(cur.title) && (
            <div className="fp-hero-badge" aria-hidden="true" key={at}>
              <span className="fp-ticon is-violet"><SiteIcon name={cur.icon} size={20} /></span>
              <span>
                <b><ContentText text={cur.title} vars={vars} /></b>
                {hasText(cur.text) && <small><ContentText text={cur.text} vars={vars} /></small>}
              </span>
            </div>
          )}
          {slides.length > 1 && (
            <div className="fp-hero-dots" role="tablist" aria-label="اختر صورة">
              {slides.map((sl, i) => (
                <button key={sl.photo.src} type="button" role="tab" aria-selected={at === i} aria-label={sl.title || `صورة ${i + 1}`}
                  className={at === i ? 'is-on' : ''} onClick={() => { setAt(i); setPaused(true) }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// "/about" — من نحن: the story, who it is for, values, gallery, CTA (content.about; the gallery photos and the CTA band
// are the landing page's).
import { DEFAULT_CONTENT, pickVariant } from '@shared/content'
import { ContentText, hasText, usePhotoChain, useSite } from '../../components/site/siteContent'
import { CtaBand, PageHeader, Section, SectionHead, TileIcon, usePageTitle } from './site'
import { Gallery } from './sections/Gallery'

function StoryPhoto() {
  const { c } = useSite()
  const { photo, src, onError } = usePhotoChain([c.about.story.photo, DEFAULT_CONTENT.about.story.photo], true)
  return (
    <figure className="fp-story-media">
      <span className="fp-story-block" aria-hidden="true" />
      {photo && <img src={src} width={photo.w} height={photo.h} alt={photo.alt} loading="lazy" decoding="async" onError={onError} />}
    </figure>
  )
}

export function About() {
  usePageTitle('about')
  const { c, vars, flags } = useSite()
  const a = c.about
  const paragraphs = a.story.paragraphs.filter((p) => hasText(p.text))
  // Neutral icon tiles: the accent colours are reserved for coding space types.
  const audience = a.audience.items.filter((it) => hasText(it.title))
  const values = a.values.items.filter((it) => hasText(it.title))
  return (
    <div className="site">
      <PageHeader kicker={a.kicker} title={a.title} lead={a.lead} titleRich />

      <Section labelledBy="fp-story-title">
        <div className="fp-story">
          <div className="fp-story-text">
            <SectionHead id="fp-story-title" kicker={a.story.kicker} title={a.story.title} />
            {paragraphs.map((p, i) => <p key={i}><ContentText text={p.text} vars={vars} /></p>)}
          </div>
          <StoryPhoto />
        </div>
      </Section>

      {audience.length > 0 && (
        <Section tint labelledBy="fp-who-title">
          <SectionHead id="fp-who-title" kicker={a.audience.kicker} title={a.audience.title} />
          <ul className="fp-grid fp-grid-4 fp-tiles">
            {audience.map((it, i) => (
              <li key={i} className="fp-tile">
                <TileIcon name={it.icon} tone="neutral" />
                <h3 className="fp-h3"><ContentText text={it.title} vars={vars} /></h3>
                {hasText(it.text) && <p><ContentText text={it.text} vars={vars} /></p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {values.length > 0 && (
        <Section labelledBy="fp-values-title">
          <SectionHead id="fp-values-title" kicker={a.values.kicker} title={a.values.title} center />
          <ul className="fp-grid fp-grid-3 fp-values fp-tiles">
            {values.map((it, i) => (
              <li key={i} className="fp-value">
                <TileIcon name={it.icon} tone="neutral" />
                <h3 className="fp-h3"><ContentText text={it.title} vars={vars} /></h3>
                {hasText(it.text) && <p><ContentText text={it.text} vars={vars} /></p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Gallery tint head={a.gallery} />
      <CtaBand title={c.home.cta.title} text={pickVariant(c.home.cta, 'text', flags)} />
    </div>
  )
}

export default About

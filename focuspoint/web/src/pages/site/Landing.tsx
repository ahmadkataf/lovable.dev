// "/" — the landing page. Its sections (hero, facts, why us, spaces, how it works, gallery, visit, FAQ, final CTA) come
// in the order the admin set in content.home.sections; hidden ones are skipped, `tint` puts the grey band behind one.
import { pickVariant } from '@shared/content'
import { useSite } from '../../components/site/siteContent'
import { CtaBand, useHashScroll, usePageTitle, useSiteData } from './site'
import { Hero } from './sections/Hero'
import { Facts } from './sections/Facts'
import { Features } from './sections/Features'
import { SpacesPreview } from './sections/SpacesPreview'
import { HowItWorks } from './sections/HowItWorks'
import { Gallery } from './sections/Gallery'
import { Visit } from './sections/Visit'
import { Faq } from './sections/Faq'

export function Landing() {
  usePageTitle('home')
  const data = useSiteData()
  const { c, flags } = useSite()
  useHashScroll(true)
  return (
    <div className="site">
      {c.home.sections.filter((s) => s.visible).map((s) => {
        switch (s.id) {
          case 'hero': return <Hero key={s.id} />
          case 'facts': return <Facts key={s.id} />
          case 'features': return <Features key={s.id} tint={s.tint} />
          case 'spaces': return <SpacesPreview key={s.id} data={data} tint={s.tint} />
          case 'how': return <HowItWorks key={s.id} tint={s.tint} />
          case 'gallery': return <Gallery key={s.id} head={c.home.gallery} tint={s.tint} />
          case 'visit': return <Visit key={s.id} data={data} tint={s.tint} />
          case 'faq': return <Faq key={s.id} tint={s.tint} />
          case 'cta': return <CtaBand key={s.id} title={c.home.cta.title} text={pickVariant(c.home.cta, 'text', flags)} />
          default: return null
        }
      })}
    </div>
  )
}

export default Landing

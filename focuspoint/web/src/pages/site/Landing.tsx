// "/" — the professional landing page: hero, facts, why us, spaces, how it works, gallery, visit, FAQ, final CTA.
import { CtaBand, useSiteData, useTitle } from './site'
import { Hero } from './sections/Hero'
import { Facts } from './sections/Facts'
import { Features } from './sections/Features'
import { SpacesPreview } from './sections/SpacesPreview'
import { HowItWorks } from './sections/HowItWorks'
import { Gallery } from './sections/Gallery'
import { Visit } from './sections/Visit'
import { Faq } from './sections/Faq'

export function Landing() {
  useTitle('فوكس بوينت | مساحة عمل هادئة بدرعا — احجز غرفتك')
  const data = useSiteData()
  return (
    <div className="site">
      <Hero data={data} />
      <Facts data={data} />
      <Features />
      <SpacesPreview data={data} />
      <HowItWorks data={data} />
      <Gallery tint />
      <Visit data={data} tint={false} />
      <Faq data={data} tint />
      <CtaBand />
    </div>
  )
}

export default Landing

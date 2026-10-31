// "/contact" — call, WhatsApp, Instagram, address + map (+ email / Facebook / TikTok / Google Play when the admin set
// them), hours, and a short "how to find us". Texts from content.contact; links from the brand content and settings.
import { Link } from 'react-router-dom'
import { brandWhatsapp, ContentText, emailLink, hasText, optionalLink, prettyUrl, useSite } from '../../components/site/siteContent'
import { instagramUrl, mapsUrl, OpenStatus, PageHeader, Section, SectionHead, telHref, TileIcon, usePageTitle, useSiteData } from './site'
import { SiteIcon, type SiteIconName } from './SiteIcon'

type Tone = 'blue' | 'green' | 'violet' | 'sky' | 'teal' | 'rose'

function ContactCard({ icon, tone, title, value, href, action, external = false, ltr = false }: { icon: SiteIconName; tone: Tone; title: string; value: string; href: string; action: string; external?: boolean; ltr?: boolean }) {
  const { vars } = useSite()
  return (
    <a className="fp-contact" href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      <TileIcon name={icon} tone={tone} />
      <span className="fp-contact-text">
        {hasText(title) && <span className="fp-contact-title"><ContentText text={title} vars={vars} /></span>}
        <b dir={ltr ? 'ltr' : undefined}>{value}</b>
      </span>
      <span className="fp-contact-go">{action} <SiteIcon name="arrow" size={16} /></span>
    </a>
  )
}

export function Contact() {
  usePageTitle('contact')
  const data = useSiteData()
  const { c, vars } = useSite()
  const p = c.contact
  const wa = brandWhatsapp(c, vars)
  const maps = optionalLink(c.brand.maps_url) || mapsUrl(data.address)
  const email = emailLink(c.brand.email)
  const facebook = optionalLink(c.brand.facebook_url)
  const tiktok = optionalLink(c.brand.tiktok_url)
  const play = optionalLink(c.brand.play_url)
  const steps = p.find.steps.filter((s) => hasText(s.text))
  return (
    <div className="site">
      <PageHeader kicker={p.kicker} title={p.title} lead={p.lead} />

      <Section>
        <div className="fp-contact-grid">
          <ContactCard icon="phone" tone="blue" title={p.cards.phone_title} value={data.phone} href={telHref(data.phone)} action="اتصال" ltr />
          <ContactCard icon="whatsapp" tone="green" title={p.cards.whatsapp_title} value={wa.display} href={wa.href} action="افتح المحادثة" external ltr />
          <ContactCard icon="instagram" tone="rose" title={p.cards.instagram_title} value={`@${data.instagram}`} href={instagramUrl(data.instagram)} action="تابعنا" external ltr />
          <ContactCard icon="pin" tone="rose" title={p.cards.address_title} value={data.address} href={maps} action="افتح على الخريطة" external />
          {email && <ContactCard icon="mail" tone="sky" title="الإيميل" value={c.brand.email} href={email} action="راسلنا" ltr />}
          {facebook && <ContactCard icon="facebook" tone="blue" title="فيسبوك" value={prettyUrl(facebook)} href={facebook} action="تابعنا" external ltr />}
          {tiktok && <ContactCard icon="tiktok" tone="violet" title="تيك توك" value={prettyUrl(tiktok)} href={tiktok} action="تابعنا" external ltr />}
          {play && <ContactCard icon="play" tone="teal" title="تطبيق Android" value="Google Play" href={play} action="نزّل التطبيق" external ltr />}
        </div>
      </Section>

      <Section tint labelledBy="fp-find-title">
        <div className="fp-grid fp-grid-2">
          <article className="fp-card">
            <div className="fp-card-top">
              <TileIcon name="clock" tone="sky" />
              <OpenStatus data={data} />
            </div>
            <h2 className="fp-h3"><ContentText text={p.hours.title} vars={vars} /></h2>
            {hasText(p.hours.line) && <p className="fp-big"><ContentText text={p.hours.line} vars={vars} /></p>}
            {hasText(p.hours.sub) && <p className="fp-muted"><ContentText text={p.hours.sub} vars={vars} /></p>}
            <div className="fp-actions fp-actions-sm">
              <Link to="/book" className="btn btn-outline fp-btn">احجز الآن <SiteIcon name="arrow" size={18} /></Link>
              <a href={telHref(data.phone)} className="btn btn-outline fp-btn"><SiteIcon name="phone" size={18} /> <span dir="ltr">{data.phone}</span></a>
            </div>
          </article>
          <article className="fp-card">
            <SectionHead id="fp-find-title" kicker={p.find.kicker} title={p.find.title} />
            {steps.length > 0 && (
              <ol className="fp-route">
                {steps.map((s, i) => (
                  <li key={i}><span className="fp-route-dot num">{i + 1}</span><span><ContentText text={s.text} vars={vars} rich /></span></li>
                ))}
              </ol>
            )}
            <div className="fp-actions fp-actions-sm">
              <a href={maps} target="_blank" rel="noreferrer" className="btn btn-primary fp-btn"><SiteIcon name="map" size={18} /> افتح على الخريطة</a>
              <a href={wa.href} target="_blank" rel="noreferrer" className="btn btn-outline fp-btn fp-wa"><SiteIcon name="whatsapp" size={18} /> واتساب</a>
            </div>
          </article>
        </div>
      </Section>
    </div>
  )
}

export default Contact

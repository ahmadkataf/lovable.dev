// Hours & location (content.home.visit): hours card (with a live open/closed hint), address card with a map link,
// call + WhatsApp.
import { brandWhatsapp, ContentText, hasText, optionalLink, useSite } from '../../../components/site/siteContent'
import { mapsUrl, OpenStatus, Section, SectionHead, telHref, TileIcon, type SiteData } from '../site'
import { SiteIcon } from '../SiteIcon'

export function Visit({ data, tint = false }: { data: SiteData; tint?: boolean }) {
  const { c, vars } = useSite()
  const v = c.home.visit
  return (
    <Section id="visit" tint={tint} labelledBy="fp-visit-title">
      <SectionHead id="fp-visit-title" kicker={v.kicker} title={v.title} lead={v.lead} />
      <div className="fp-grid fp-grid-2">
        <article className="fp-card">
          <div className="fp-card-top">
            <TileIcon name="clock" tone="sky" />
            <OpenStatus data={data} />
          </div>
          <h3 className="fp-h3"><ContentText text={v.hours_title} vars={vars} /></h3>
          <p className="fp-big num-ar">{vars.hours}</p>
          {hasText(v.hours_line) && <p className="fp-muted"><ContentText text={v.hours_line} vars={vars} /></p>}
          <div className="fp-actions fp-actions-sm">
            <a href={telHref(data.phone)} className="btn btn-outline fp-btn"><SiteIcon name="phone" size={18} /> <span dir="ltr">{data.phone}</span></a>
          </div>
        </article>
        <article className="fp-card">
          <div className="fp-card-top"><TileIcon name="pin" tone="rose" /></div>
          <h3 className="fp-h3"><ContentText text={v.address_title} vars={vars} /></h3>
          <p className="fp-big">{data.address}</p>
          <div className="fp-actions fp-actions-sm">
            <a href={optionalLink(c.brand.maps_url) || mapsUrl(data.address)} target="_blank" rel="noreferrer" className="btn btn-primary fp-btn"><SiteIcon name="map" size={18} /> افتح على الخريطة</a>
            <a href={brandWhatsapp(c, vars).href} target="_blank" rel="noreferrer" className="btn btn-outline fp-btn fp-wa"><SiteIcon name="whatsapp" size={18} /> واتساب</a>
          </div>
        </article>
      </div>
    </Section>
  )
}

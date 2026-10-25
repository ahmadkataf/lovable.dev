// "/contact" — call, WhatsApp, Instagram, address + map, hours, and a short "how to find us".
import { Link } from 'react-router-dom'
import { CENTRE, hoursLabel, instagramUrl, mapsUrl, openNow, PageHeader, Section, SectionHead, shortClock, telHref, TileIcon, useSiteData, useTitle } from './site'
import { SiteIcon, type SiteIconName } from './SiteIcon'

type Tone = 'blue' | 'green' | 'violet' | 'sky' | 'teal' | 'rose'

function ContactCard({ icon, tone, title, value, href, action, external = false, ltr = false }: { icon: SiteIconName; tone: Tone; title: string; value: string; href: string; action: string; external?: boolean; ltr?: boolean }) {
  return (
    <a className="fp-contact" href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      <TileIcon name={icon} tone={tone} />
      <span className="fp-contact-text">
        <span className="fp-contact-title">{title}</span>
        <b dir={ltr ? 'ltr' : undefined}>{value}</b>
      </span>
      <span className="fp-contact-go">{action} <SiteIcon name="arrow" size={16} /></span>
    </a>
  )
}

export function Contact() {
  useTitle('تواصل معنا | فوكس بوينت درعا')
  const data = useSiteData()
  const isOpen = openNow(data)
  return (
    <div className="site">
      <PageHeader kicker="تواصل معنا" title="منحب نسمع منك" lead="سؤال عن الحجز، الأسعار، أو بدك تحجز لفريق؟ اتصل أو ابعتلنا عالواتساب، أو مرّ علينا." />

      <Section>
        <div className="fp-contact-grid">
          <ContactCard icon="phone" tone="blue" title="اتصل فينا" value={data.phone} href={telHref(data.phone)} action="اتصال" ltr />
          <ContactCard icon="whatsapp" tone="green" title="واتساب" value={CENTRE.phoneIntl} href={CENTRE.whatsapp} action="افتح المحادثة" external ltr />
          <ContactCard icon="instagram" tone="rose" title="إنستغرام" value={`@${data.instagram}`} href={instagramUrl(data.instagram)} action="تابعنا" external ltr />
          <ContactCard icon="pin" tone="rose" title="العنوان" value={data.address} href={mapsUrl(data.address)} action="افتح على الخريطة" external />
        </div>
      </Section>

      <Section tint labelledBy="fp-find-title">
        <div className="fp-grid fp-grid-2">
          <article className="fp-card">
            <div className="fp-card-top">
              <TileIcon name="clock" tone="sky" />
              {isOpen != null && (
                <span className={`fp-status ${isOpen ? 'is-open' : 'is-closed'}`}>
                  <span className="fp-dot" aria-hidden="true" />{isOpen ? 'مفتوح هلأ' : `مسكّر هلأ، منفتح الساعة ${shortClock(data.open)}`}
                </span>
              )}
            </div>
            <h2 className="fp-h3">أوقات الدوام</h2>
            <p className="fp-big">كل يوم: {hoursLabel(data)}</p>
            <p className="fp-muted">{data.hoursPerDay} ساعة يومياً، كل أيام الأسبوع.</p>
            <div className="fp-actions fp-actions-sm">
              <Link to="/book" className="btn btn-outline fp-btn">احجز الآن <SiteIcon name="arrow" size={18} /></Link>
              <a href={telHref(data.phone)} className="btn btn-outline fp-btn"><SiteIcon name="phone" size={18} /> <span dir="ltr">{data.phone}</span></a>
            </div>
          </article>
          <article className="fp-card">
            <SectionHead id="fp-find-title" kicker="كيف توصلنا" title="سهل توصلنا" />
            <ol className="fp-route">
              <li><span className="fp-route-dot num">1</span><span>توجّه على <b>شارع المجمع الحكومي</b> بدرعا.</span></li>
              <li><span className="fp-route-dot num">2</span><span>اسأل عن <b>بناء العايش</b>، فوكس بوينت فيه.</span></li>
              <li><span className="fp-route-dot num">3</span><span>ضعت؟ اتصل أو ابعتلنا واتساب ومنوصفلك الطريق.</span></li>
            </ol>
            <div className="fp-actions fp-actions-sm">
              <a href={mapsUrl(data.address)} target="_blank" rel="noreferrer" className="btn btn-primary fp-btn"><SiteIcon name="map" size={18} /> افتح على الخريطة</a>
              <a href={CENTRE.whatsapp} target="_blank" rel="noreferrer" className="btn btn-outline fp-btn fp-wa"><SiteIcon name="whatsapp" size={18} /> واتساب</a>
            </div>
          </article>
        </div>
      </Section>
    </div>
  )
}

export default Contact

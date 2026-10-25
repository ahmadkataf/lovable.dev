// Hours & location: hours card (with a live open/closed hint), address card with a map link, call + WhatsApp.
import { CENTRE, hoursLabel, mapsUrl, openNow, Section, SectionHead, shortClock, telHref, TileIcon, type SiteData } from '../site'
import { SiteIcon } from '../SiteIcon'

export function Visit({ data, headless = false, tint = true }: { data: SiteData; headless?: boolean; tint?: boolean }) {
  const isOpen = openNow(data)
  return (
    <Section id="visit" tint={tint && !headless} labelledBy={headless ? undefined : 'fp-visit-title'}>
      {!headless && <SectionHead id="fp-visit-title" kicker="زورنا" title="الدوام والعنوان" lead="منستناك كل يوم. إذا عندك سؤال قبل ما تجي، احكينا." />}
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
          <h3 className="fp-h3">أوقات الدوام</h3>
          <p className="fp-big num-ar">{hoursLabel(data)}</p>
          <p className="fp-muted">كل يوم بالأسبوع، {data.hoursPerDay} ساعة باليوم.</p>
          <div className="fp-actions fp-actions-sm">
            <a href={telHref(data.phone)} className="btn btn-outline fp-btn"><SiteIcon name="phone" size={18} /> <span dir="ltr">{data.phone}</span></a>
          </div>
        </article>
        <article className="fp-card">
          <div className="fp-card-top"><TileIcon name="pin" tone="rose" /></div>
          <h3 className="fp-h3">العنوان</h3>
          <p className="fp-big">{data.address}</p>
          <div className="fp-actions fp-actions-sm">
            <a href={mapsUrl(data.address)} target="_blank" rel="noreferrer" className="btn btn-primary fp-btn"><SiteIcon name="map" size={18} /> افتح على الخريطة</a>
            <a href={CENTRE.whatsapp} target="_blank" rel="noreferrer" className="btn btn-outline fp-btn fp-wa"><SiteIcon name="whatsapp" size={18} /> واتساب</a>
          </div>
        </article>
      </div>
    </Section>
  )
}

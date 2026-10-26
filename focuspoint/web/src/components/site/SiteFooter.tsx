// Site footer: brand line, links, contact (+ the optional email / Facebook / TikTok / Google Play links when the admin
// set them), Instagram, privacy, «فريق العمل», ©. Texts from the site content (footer, brand).
import { Link } from 'react-router-dom'
import { Icon } from '../../ui'
import { SiteIcon } from '../../pages/site/SiteIcon'
import { useSiteContact } from './centre'
import { BrandMark } from './SiteHeader'
import { ContentText, hasText, useSite } from './siteContent'

export function SiteFooter() {
  const { c, vars } = useSite()
  const k = useSiteContact()
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <BrandMark />
            {hasText(c.footer.tagline) && <p><ContentText text={c.footer.tagline} vars={vars} /></p>}
          </div>
          <div>
            <div className="footer-title">الموقع</div>
            <nav className="footer-links" aria-label="روابط الموقع">
              <Link to="/spaces">المساحات والأسعار</Link>
              <Link to="/book">احجز الآن</Link>
              <Link to="/about">من نحن</Link>
              <Link to="/contact">تواصل معنا</Link>
              <Link to="/mine">حجوزاتي</Link>
            </nav>
          </div>
          <div>
            <div className="footer-title">تواصل</div>
            <div className="footer-contact">
              <a href={k.tel}><Icon name="phone" size={18} /><span className="num">{k.phone}</span></a>
              <a href={k.whatsapp} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={18} />واتساب</a>
              <a href={k.insta} target="_blank" rel="noreferrer"><Icon name="instagram" size={18} /><span dir="ltr">@{k.instagram}</span></a>
              {k.facebook && <a href={k.facebook} target="_blank" rel="noreferrer"><SiteIcon name="facebook" size={18} />فيسبوك</a>}
              {k.tiktok && <a href={k.tiktok} target="_blank" rel="noreferrer"><SiteIcon name="tiktok" size={18} />تيك توك</a>}
              {k.email && <a href={k.email}><SiteIcon name="mail" size={18} /><span dir="ltr">{c.brand.email}</span></a>}
              <a href={k.maps} target="_blank" rel="noreferrer"><Icon name="pin" size={18} />{k.address}</a>
              {hasText(c.footer.hours_line) && <div><Icon name="clock" size={18} /><ContentText text={c.footer.hours_line} vars={vars} /></div>}
              {k.play && <a href={k.play} target="_blank" rel="noreferrer"><SiteIcon name="play" size={18} /><span>التطبيق على <bdi dir="ltr">Google Play</bdi></span></a>}
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          {hasText(c.footer.copyright) && <span><ContentText text={c.footer.copyright} vars={vars} /></span>}
          <nav aria-label="روابط إضافية">
            {/* A static file served by the Worker — a plain anchor, so the SPA router never swallows it. */}
            <a href="/privacy">سياسة الخصوصية</a>
            <Link to="/team"><Icon name="user" size={14} /> فريق العمل</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

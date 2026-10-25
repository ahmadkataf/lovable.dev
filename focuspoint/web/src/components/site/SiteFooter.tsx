// Site footer: brand line, links, contact, Instagram, privacy, «فريق العمل», ©.
import { Link } from 'react-router-dom'
import logoUrl from '@shared/logo.svg'
import { Icon } from '../../ui'
import { shortClock } from '../../format'
import { CENTRE, useCentre } from './centre'

export function SiteFooter() {
  const c = useCentre()
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="site-brand">
              <img src={logoUrl} alt="" width={38} height={38} />
              <span><span className="wordmark">Focus Point</span><small>فوكس بوينت · درعا</small></span>
            </Link>
            <p>{CENTRE.slogan}. {CENTRE.firstOfItsKind} — غرف خاصة، قاعة اجتماعات ومساحة مفتوحة، بتحجزها من موبايلك بخطوات بسيطة.</p>
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
              <a href={c.tel}><Icon name="phone" size={18} /><span className="num">{c.phone}</span></a>
              <a href={c.whatsapp} target="_blank" rel="noreferrer"><Icon name="whatsapp" size={18} />واتساب</a>
              <a href={c.insta} target="_blank" rel="noreferrer"><Icon name="instagram" size={18} /><span dir="ltr">@{c.instagram}</span></a>
              <a href={c.maps} target="_blank" rel="noreferrer"><Icon name="pin" size={18} />{c.address}</a>
              <div><Icon name="clock" size={18} />يومياً {shortClock(c.open)} – {shortClock(c.close)}</div>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 فوكس بوينت — Focus Point</span>
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

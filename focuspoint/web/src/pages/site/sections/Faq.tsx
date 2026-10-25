// FAQ accordion (<details>), answers only from the centre's facts.
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { CENTRE, Section, SectionHead, shortClock, type SiteData } from '../site'
import { SiteIcon } from '../SiteIcon'

export function Faq({ data, tint = false }: { data: SiteData; tint?: boolean }) {
  const items: { q: string; a: ReactNode }[] = [
    { q: 'هل لازم أعمل حساب لأحجز؟', a: 'لا. بتختار المساحة والوقت، وبتكتب اسمك ورقم موبايلك، وبس. التطبيق بيتذكّر حجوزاتك على جهازك، وفيك تلاقي أي حجز برمزه ورقمك من صفحة «حجوزاتي».' },
    {
      q: 'كيف بدفع؟',
      a: data.payOnArrival
        ? 'بتحويل شام كاش: بتمسح الرمز أو بتحوّل عالرقم، وبتكتب رقم العملية بالتطبيق، والفريق بيأكّد حجزك. أو بتختار «الدفع عند الوصول» وبتدفع بالمركز لما توصل.'
        : 'بتحويل شام كاش: بتمسح الرمز أو بتحوّل عالرقم، وبتكتب رقم العملية بالتطبيق، والفريق بيأكّد حجزك ويوصلك إشعار.',
    },
    { q: 'فيني ألغي الحجز؟', a: <>قبل ما يتأكد الحجز، فيك تلغيه بنفسك من التطبيق (صفحة <Link to="/mine">حجوزاتي</Link>). بعد التأكيد، تواصل معنا على <span dir="ltr" className="num">{data.phone}</span> أو عالواتساب ومنساعدك.</> },
    { q: 'شو الدوام؟', a: `مفتوحين كل يوم، من ${shortClock(data.open)} لـ${shortClock(data.close)}.` },
    { q: 'فيني أحجز لفريق كامل؟', a: <>أكيد. قاعة الاجتماعات بتساع لـ10 أشخاص وفيها شاشة وسبورة، وفي كمان غرف خاصة من 2 لـ4 أشخاص. <Link to="/spaces">شوف المساحات</Link>.</> },
    { q: 'وين المكان؟', a: `${data.address || CENTRE.address}. إذا ضعت، اتصل فينا أو ابعتلنا عالواتساب ومنوصفلك الطريق.` },
  ]
  return (
    <Section id="faq" tint={tint} labelledBy="fp-faq-title">
      <div className="fp-faq-grid">
        <SectionHead id="fp-faq-title" kicker="أسئلة متكررة" title="عندك سؤال؟" lead={<>إذا ما لقيت جوابك هون، <Link to="/contact">تواصل معنا</Link>.</>} />
        <div className="fp-faq">
          {items.map((it) => (
            <details key={it.q}>
              <summary>
                <span>{it.q}</span>
                <SiteIcon name="chevron" size={20} className="fp-faq-chev" />
              </summary>
              <div className="fp-faq-a">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </Section>
  )
}

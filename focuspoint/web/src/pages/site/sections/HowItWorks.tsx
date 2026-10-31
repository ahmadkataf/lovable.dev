// How booking works: numbered flat steps (content.home.how; the wording follows the payment options).
import { Link } from 'react-router-dom'
import { pickVariant } from '@shared/content'
import { ContentText, hasText, useSite } from '../../../components/site/siteContent'
import { Section, SectionHead } from '../site'
import { SiteIcon } from '../SiteIcon'

export function HowItWorks({ tint = false }: { tint?: boolean }) {
  const { c, vars, flags } = useSite()
  const h = c.home.how
  const steps = h.steps
    .map((s) => ({ icon: s.icon, title: pickVariant(s, 'title', flags), text: pickVariant(s, 'text', flags) }))
    .filter((s) => hasText(s.title))
  if (!steps.length) return null
  return (
    <Section id="how" tint={tint} labelledBy="fp-how-title">
      <SectionHead id="fp-how-title" kicker={h.kicker} title={h.title} center />
      <ol className="fp-steps">
        {steps.map((s, i) => (
          <li key={i} className="fp-step">
            <span className="fp-step-num num" aria-hidden="true">{i + 1}</span>
            <span className="fp-step-ico"><SiteIcon name={s.icon} size={22} /></span>
            <h3 className="fp-h3"><ContentText text={s.title} vars={vars} /></h3>
            {hasText(s.text) && <p><ContentText text={s.text} vars={vars} /></p>}
          </li>
        ))}
      </ol>
      <div className="fp-center-row">
        <Link to="/book" className="btn btn-primary btn-lg fp-btn">ابدأ الحجز <SiteIcon name="arrow" size={20} /></Link>
      </div>
    </Section>
  )
}

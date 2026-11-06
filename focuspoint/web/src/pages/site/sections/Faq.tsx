// FAQ accordion (<details>), content.home.faq: answers may carry **bold** and [links](/spaces); the wording follows
// the booking options (pay on arrival, Sham Cash, customer cancel).
import { pickVariant } from '@shared/content'
import { ContentText, hasText, useSite } from '../../../components/site/siteContent'
import { Section, SectionHead } from '../site'
import { SiteIcon } from '../SiteIcon'

export function Faq({ tint = false }: { tint?: boolean }) {
  const { c, vars, flags } = useSite()
  const f = c.home.faq
  const items = f.items.map((it) => ({ q: it.q, a: pickVariant(it, 'a', flags) })).filter((it) => hasText(it.q) && hasText(it.a))
  if (!items.length) return null
  return (
    <Section id="faq" tint={tint} labelledBy="fp-faq-title">
      <div className="fp-faq-grid">
        <SectionHead id="fp-faq-title" kicker={f.kicker} title={f.title} lead={f.lead} leadRich />
        <div className="fp-faq">
          {items.map((it, i) => (
            <details key={i}>
              <summary>
                <span><ContentText text={it.q} vars={vars} /></span>
                <SiteIcon name="chevron" size={20} className="fp-faq-chev" />
              </summary>
              <div className="fp-faq-a"><ContentText text={it.a} vars={vars} rich /></div>
            </details>
          ))}
        </div>
      </div>
    </Section>
  )
}

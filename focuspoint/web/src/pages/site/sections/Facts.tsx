// Flat facts strip (content.home.facts): counts and hours come from the live API through the placeholders.
import { ContentText, hasText, plainText, useSite } from '../../../components/site/siteContent'
import { SiteIcon } from '../SiteIcon'

export function Facts() {
  const { c, vars } = useSite()
  const f = c.home.facts
  const items = f.items.filter((it) => hasText(it.value))
  if (!items.length) return null
  return (
    <section className="fp-facts-wrap" aria-label={plainText(f.label, vars)}>
      <div className="fp-container">
        <ul className="fp-facts">
          {items.map((it, i) => (
            <li key={i}>
              <SiteIcon name={it.icon} size={22} className="fp-facts-ico" />
              <b><ContentText text={it.value} vars={vars} /></b>
              {hasText(it.label) && <span><ContentText text={it.label} vars={vars} /></span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

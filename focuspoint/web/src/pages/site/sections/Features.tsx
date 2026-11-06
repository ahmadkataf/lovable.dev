// "ليش فوكس بوينت؟" — flat tiles with neutral icon squares (content.home.features).
import { ContentText, hasText, useSite } from '../../../components/site/siteContent'
import { Section, SectionHead, TileIcon } from '../site'

// Accent colours are reserved for coding space types; the feature tiles stay neutral.
export function Features({ tint = false }: { tint?: boolean }) {
  const { c, vars } = useSite()
  const f = c.home.features
  const items = f.items.filter((it) => hasText(it.title))
  if (!items.length) return null
  return (
    <Section id="why" tint={tint} labelledBy="fp-why-title">
      <SectionHead id="fp-why-title" kicker={f.kicker} title={f.title} lead={f.lead} />
      <ul className="fp-grid fp-grid-3 fp-tiles">
        {items.map((it, i) => (
          <li key={i} className="fp-tile">
            <TileIcon name={it.icon} tone="neutral" />
            <h3 className="fp-h3"><ContentText text={it.title} vars={vars} /></h3>
            {hasText(it.text) && <p><ContentText text={it.text} vars={vars} /></p>}
          </li>
        ))}
      </ul>
    </Section>
  )
}

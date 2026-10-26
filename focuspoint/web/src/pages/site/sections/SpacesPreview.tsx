// Spaces preview on the landing page: one card per space type with live capacity and "from" price. Head texts from
// content.home.spaces; each card's name, text, badge, icon and photo from content.spaces.groups (a room's own photo wins).
import { Link } from 'react-router-dom'
import { ContentText, hasText, plainText, usePhotoChain, useSite } from '../../../components/site/siteContent'
import {
  AMENITY_LABEL, capacityLabel, FromPrice, groupAmenities, groupRoomPhoto, groupRooms, Section, SectionHead, TileIcon,
  type SiteData, type SpaceGroup,
} from '../site'
import { SiteIcon } from '../SiteIcon'

function SpaceCard({ g, loading }: { g: SpaceGroup; loading: boolean }) {
  const { vars } = useSite()
  const { photo, src, onError } = usePhotoChain([groupRoomPhoto(g.rooms), g.photo, g.defaultPhoto], true)
  const title = plainText(g.title, vars)
  const amen = groupAmenities(g)
  return (
    <article className="fp-space">
      <div className="fp-space-media">
        {photo
          ? <img src={src} width={photo.w} height={photo.h} alt={photo.alt || title} loading="lazy" decoding="async" onError={onError} />
          : (
            <div className={`fp-space-art is-${g.tone}`} aria-hidden="true">
              <span className="fp-art-doors"><i /><i /><i /><i /></span>
            </div>
          )}
        {hasText(g.badge) && <span className="fp-space-count"><ContentText text={g.badge} vars={vars} /></span>}
      </div>
      <div className="fp-space-body">
        <div className="fp-space-title">
          <TileIcon name={g.icon} tone={g.tone} />
          <div>
            <h3 className="fp-h3"><ContentText text={g.title} vars={vars} /></h3>
            <span className="fp-meta"><SiteIcon name="people" size={16} /> {capacityLabel(g.rooms, plainText(g.fallbackCap, vars))}</span>
          </div>
        </div>
        {hasText(g.blurb) && <p className="fp-space-blurb"><ContentText text={g.blurb} vars={vars} /></p>}
        {amen.length > 0 && (
          <ul className="fp-amen" aria-label="التجهيزات">
            {amen.map((k) => <li key={k}><SiteIcon name={k} size={16} />{AMENITY_LABEL[k]}</li>)}
          </ul>
        )}
        <div className="fp-space-foot">
          <FromPrice rooms={g.rooms} loading={loading} />
          <span className="fp-space-links">
            <Link to={`/spaces#sp-${g.id}`} className="fp-link" aria-label={`تفاصيل ${title}`}>التفاصيل</Link>
            <Link to="/book" className="btn btn-primary btn-sm fp-btn" aria-label={`احجز ${title}`}>احجز <SiteIcon name="arrow" size={16} /></Link>
          </span>
        </div>
      </div>
    </article>
  )
}

export function SpacesPreview({ data, tint = true }: { data: SiteData; tint?: boolean }) {
  const { c } = useSite()
  const h = c.home.spaces
  const groups = groupRooms(data.rooms, c)
  return (
    <Section id="spaces" tint={tint} labelledBy="fp-spaces-title">
      <div className="fp-head-row">
        <SectionHead id="fp-spaces-title" kicker={h.kicker} title={h.title} lead={h.lead} />
        <Link to="/spaces" className="btn btn-outline fp-btn fp-hide-sm">كل المساحات <SiteIcon name="arrow" size={18} /></Link>
      </div>
      <div className="fp-grid fp-grid-3">
        {groups.map((g) => <SpaceCard key={g.id} g={g} loading={data.roomsLoading} />)}
      </div>
      <div className="fp-show-sm fp-center-row">
        <Link to="/spaces" className="btn btn-outline btn-lg fp-btn">شوف كل المساحات <SiteIcon name="arrow" size={18} /></Link>
      </div>
    </Section>
  )
}

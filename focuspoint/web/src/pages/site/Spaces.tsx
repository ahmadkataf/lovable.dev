// "/spaces" — every active room from the API as a rich card, grouped by type, each with "احجز هالمساحة" → /book?room=<id>.
// Page texts and the group names/blurbs/photos from content.spaces; a room's own photos win over its group photo.
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Room } from '@shared/types'
import { contentsList, ROOM_TYPE } from '../../lib/booking'
import { fmtSYP } from '../../format'
import { ContentText, hasText, usePhotoChain, useSite } from '../../components/site/siteContent'
import { capacityLabel, CtaBand, groupRooms, PageHeader, roomPhotos, Section, TileIcon, usePageTitle, useSiteData, type SpaceGroup } from './site'
import { SiteIcon } from './SiteIcon'

function RoomCard({ room, group }: { room: Room; group: SpaceGroup }) {
  const items = contentsList(room.contents)
  const { photo, src, onError } = usePhotoChain([roomPhotos(room)[0], group.photo, group.defaultPhoto], true)
  return (
    <article className={`fp-room${photo ? ' has-photo' : ''}`}>
      {photo ? (
        <div className="fp-room-media">
          <img src={src} width={photo.w} height={photo.h} alt={photo.alt || room.name} loading="lazy" decoding="async" onError={onError} />
        </div>
      ) : null}
      <div className="fp-room-body">
        <div className="fp-room-head">
          {!photo && <TileIcon name={group.icon} tone={group.tone} />}
          <div className="fp-room-title">
            <span className="fp-room-type">{ROOM_TYPE[room.type]}</span>
            <h3 className="fp-h3 fp-room-name">{room.name}</h3>
          </div>
          <span className="fp-cap"><SiteIcon name="people" size={16} /> {capacityLabel([room], '')}</span>
        </div>
        {room.description && <p className="fp-room-desc">{room.description}</p>}
        {items.length > 0 && (
          <ul className="fp-amen" aria-label="محتويات الغرفة">
            {items.map((it) => <li key={it.label}><SiteIcon name={it.icon} size={16} />{it.label}</li>)}
          </ul>
        )}
        {room.contents.notes && <p className="fp-muted fp-small">{room.contents.notes}</p>}
        <div className="fp-room-foot">
          <dl className="fp-prices">
            <div><dt>بالساعة</dt><dd className="money">{fmtSYP(room.price_hour)}</dd></div>
            {room.price_day != null && room.price_day > 0 && <div><dt>باليوم</dt><dd className="money">{fmtSYP(room.price_day)}</dd></div>}
          </dl>
          <Link to={`/book?room=${room.id}`} className="btn btn-primary fp-btn">احجز هالمساحة <SiteIcon name="arrow" size={18} /></Link>
        </div>
      </div>
    </article>
  )
}

/** Columns that leave no orphan card: 1 → full width, 2/4 → two columns, otherwise three. */
function gridFor(n: number): string {
  if (n === 1) return 'fp-grid-1'
  if (n === 2 || n === 4) return 'fp-grid-2'
  return 'fp-grid-3'
}

function Skeleton() {
  return (
    <div className="fp-grid fp-grid-3" aria-hidden="true">
      {[0, 1, 2].map((i) => <div key={i} className="fp-room fp-room-skel"><div className="fp-room-media fp-shimmer" /><div className="fp-room-body"><span className="fp-shimmer fp-skel-line" /><span className="fp-shimmer fp-skel-line is-short" /></div></div>)}
    </div>
  )
}

export function Spaces() {
  usePageTitle('spaces')
  const data = useSiteData()
  const { c, vars } = useSite()
  const p = c.spaces
  const groups = groupRooms(data.rooms, c).filter((g) => g.rooms.length > 0)
  // Deep links from the landing cards (/spaces#sp-private): scroll once the groups have rendered.
  useEffect(() => {
    const h = window.location.hash
    if (!h || !groups.length) return
    try { document.querySelector(h)?.scrollIntoView() } catch { /* not a valid selector */ }
  }, [groups.length])
  return (
    <div className="site">
      <PageHeader kicker={p.kicker} title={p.title} lead={p.lead}>
        {groups.length > 1 && (
          <nav className="fp-jump" aria-label="أنواع المساحات">
            {groups.map((g) => <a key={g.id} href={`#sp-${g.id}`} className="fp-jump-link"><SiteIcon name={g.icon} size={16} /> <ContentText text={g.title} vars={vars} /></a>)}
          </nav>
        )}
      </PageHeader>

      {data.roomsLoading && <Section><Skeleton /></Section>}

      {!data.roomsLoading && groups.length === 0 && (
        <Section>
          <div className="fp-card fp-empty">
            <TileIcon name="cloudOff" tone="sky" />
            <h2 className="fp-h3">{data.roomsFailed ? 'ما قدرنا نجيب المساحات هلأ' : <ContentText text={p.empty_title} vars={vars} />}</h2>
            {data.roomsFailed
              ? <p className="fp-muted">تأكد من الإنترنت وجرّب كمان مرة، أو احكينا عالواتساب.</p>
              : hasText(p.empty_text) && <p className="fp-muted"><ContentText text={p.empty_text} vars={vars} /></p>}
            <div className="fp-actions fp-actions-center">
              <Link to="/contact" className="btn btn-outline fp-btn">تواصل معنا</Link>
            </div>
          </div>
        </Section>
      )}

      {groups.map((g, gi) => (
        <Section key={g.id} id={`sp-${g.id}`} tint={gi % 2 === 1} labelledBy={`sp-${g.id}-t`}>
          <header className="fp-group-head">
            <TileIcon name={g.icon} tone={g.tone} size="lg" />
            <div>
              <h2 id={`sp-${g.id}-t`} className="fp-h2"><ContentText text={g.title} vars={vars} /> <span className="fp-count num">{g.rooms.length}</span></h2>
              {hasText(g.blurb) && <p className="fp-muted"><ContentText text={g.blurb} vars={vars} /></p>}
            </div>
          </header>
          <div className={`fp-grid ${gridFor(g.rooms.length)}`}>
            {g.rooms.map((r) => <RoomCard key={r.id} room={r} group={g} />)}
          </div>
        </Section>
      ))}

      <CtaBand title={p.cta_title} text={p.cta_text} />
    </div>
  )
}

export default Spaces

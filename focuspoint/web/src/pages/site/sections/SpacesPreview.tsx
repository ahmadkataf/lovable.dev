// Spaces preview on the landing page: one card per space type with live capacity and "from" price.
import { Link } from 'react-router-dom'
import type { RoomContents } from '@shared/types'
import { capacityLabel, FromPrice, groupRooms, Section, SectionHead, TileIcon, type SiteData } from '../site'
import { SiteIcon, type SiteIconName } from '../SiteIcon'

/** The amenities every room in the group has (falls back to the facts when the API has nothing yet). */
function sharedAmenities(contents: RoomContents[], fallback: SiteIconName[]): { icon: SiteIconName; label: string }[] {
  const all: { key: keyof RoomContents; icon: SiteIconName; label: string }[] = [
    { key: 'wifi', icon: 'wifi', label: 'إنترنت' },
    { key: 'ac', icon: 'ac', label: 'تكييف' },
    { key: 'screen', icon: 'screen', label: 'شاشة' },
    { key: 'whiteboard', icon: 'whiteboard', label: 'سبورة' },
    { key: 'projector', icon: 'projector', label: 'بروجكتر' },
    { key: 'coffee', icon: 'coffee', label: 'قهوة' },
  ]
  if (!contents.length) return all.filter((a) => fallback.includes(a.icon))
  return all.filter((a) => contents.every((c) => !!c[a.key]))
}

const FALLBACK: Record<string, SiteIconName[]> = {
  private: ['wifi', 'ac'],
  meeting: ['wifi', 'ac', 'screen', 'whiteboard'],
  open: ['wifi', 'ac', 'coffee'],
}

export function SpacesPreview({ data }: { data: SiteData }) {
  const groups = groupRooms(data.rooms)
  return (
    <Section id="spaces" tint labelledBy="fp-spaces-title">
      <div className="fp-head-row">
        <SectionHead id="fp-spaces-title" kicker="المساحات" title="اختار المكان اللي بيناسبك" lead="لحالك، مع شريكك، أو مع فريق كامل. كل المساحات بتنحجز بالساعة." />
        <Link to="/spaces" className="btn btn-outline fp-btn fp-hide-sm">كل المساحات <SiteIcon name="arrow" size={18} /></Link>
      </div>
      <div className="fp-grid fp-grid-3">
        {groups.map((g) => {
          const amen = sharedAmenities(g.rooms.map((r) => r.contents), FALLBACK[g.id])
          return (
            <article key={g.id} className="fp-space">
              <div className="fp-space-media">
                {g.photo
                  ? <img src={g.photo.small} width={g.photo.w} height={g.photo.h} alt={g.photo.alt} loading="lazy" decoding="async" />
                  : (
                    <div className={`fp-space-art is-${g.tone}`} aria-hidden="true">
                      <span className="fp-art-doors"><i /><i /><i /><i /></span>
                    </div>
                  )}
                <span className="fp-space-count">{g.id === 'private' ? `${g.rooms.length || 4} غرف` : g.id === 'meeting' ? 'قاعة' : 'مشتركة'}</span>
              </div>
              <div className="fp-space-body">
                <div className="fp-space-title">
                  <TileIcon name={g.icon} tone={g.tone} />
                  <div>
                    <h3 className="fp-h3">{g.title}</h3>
                    <span className="fp-meta"><SiteIcon name="people" size={16} /> {capacityLabel(g.rooms, g.fallbackCap)}</span>
                  </div>
                </div>
                <p className="fp-space-blurb">{g.blurb}</p>
                <ul className="fp-amen" aria-label="التجهيزات">
                  {amen.map((a) => <li key={a.label}><SiteIcon name={a.icon} size={16} />{a.label}</li>)}
                </ul>
                <div className="fp-space-foot">
                  <FromPrice rooms={g.rooms} loading={data.roomsLoading} />
                  <span className="fp-space-links">
                    <Link to={`/spaces#sp-${g.id}`} className="fp-link" aria-label={`تفاصيل ${g.title}`}>التفاصيل</Link>
                    <Link to="/book" className="btn btn-primary btn-sm fp-btn" aria-label={`احجز ${g.title}`}>احجز <SiteIcon name="arrow" size={16} /></Link>
                  </span>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      <div className="fp-show-sm fp-center-row">
        <Link to="/spaces" className="btn btn-outline btn-lg fp-btn">شوف كل المساحات <SiteIcon name="arrow" size={18} /></Link>
      </div>
    </Section>
  )
}

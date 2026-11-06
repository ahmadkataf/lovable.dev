// A room's own photos (Room.photos) in the booking flow: a cover that swipes (scroll-snap) when there are more, and a
// small thumbnail in place of the icon swatch. A photo that fails to load hides itself; with none left (or none at all)
// the screens show today's visuals (no cover, the icon swatch).
import { useCallback, useRef, useState } from 'react'
import { photoSmall } from '@shared/content'
import type { Photo, Room } from '@shared/types'
import { Icon, roomTone } from '../ui'
import { ROOM_ICON, roomPhotos } from '../lib/booking'
import './RoomPhotos.css'

function useFailed(): [(src: string) => boolean, (src: string) => void] {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const isFailed = useCallback((src: string) => failed.has(src), [failed])
  const fail = useCallback((src: string) => setFailed((prev) => (prev.has(src) ? prev : new Set(prev).add(src))), [])
  return [isFailed, fail]
}

/** The cover of a room (first photo), swipeable when it has more; renders nothing without a photo. Give it key={room.id}. */
export function RoomPhotos({ photos }: { photos: Photo[] }) {
  const [isFailed, fail] = useFailed()
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const shown = photos.filter((p) => !isFailed(p.src))
  if (shown.length === 0) return null

  const onScroll = () => {
    const el = track.current
    if (!el || !el.clientWidth) return
    // RTL tracks scroll to negative scrollLeft in current browsers (positive in some older ones): use the distance
    setIndex(Math.min(shown.length - 1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth)))
  }
  const go = (i: number) => {
    const img = track.current?.children[i] as HTMLElement | undefined
    img?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  return (
    <div className="room-photos">
      <div className="room-photos-track" ref={track} onScroll={shown.length > 1 ? onScroll : undefined}>
        {shown.map((p, i) => (
          <img
            key={`${p.src}#${i}`} className="room-photos-img" src={photoSmall(p)} alt={p.alt} width={p.w} height={p.h}
            loading={i === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false} onError={() => fail(p.src)}
          />
        ))}
      </div>
      {shown.length > 1 && (
        <div className="room-photos-dots">
          {shown.map((p, i) => (
            <button
              key={`${p.src}#${i}`} type="button" className={`room-photos-dot${i === Math.min(index, shown.length - 1) ? ' is-active' : ''}`}
              aria-label={`الصورة ${i + 1} من ${shown.length}`} aria-current={i === index || undefined} onClick={() => go(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** The room's icon swatch, or its first photo in the same square when it has one (falls back to the icon on error). */
export function RoomSwatch({ room, photo = true }: { room: Pick<Room, 'type' | 'photos'> | null | undefined; photo?: boolean }) {
  const [isFailed, fail] = useFailed()
  const p = photo ? roomPhotos(room).find((x) => !isFailed(x.src)) : undefined
  const tone = room ? roomTone(room.type) : ''
  if (!p) return <span className={`room-swatch ${tone}`}><Icon name={room ? ROOM_ICON[room.type] : 'door'} size={22} /></span>
  return (
    <span className={`room-swatch ${tone} is-photo`}>
      <img src={photoSmall(p)} alt="" width={p.w} height={p.h} loading="lazy" decoding="async" onError={() => fail(p.src)} />
    </span>
  )
}

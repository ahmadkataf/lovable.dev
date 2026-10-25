// Photo gallery of the real space, with a light, dependency-free lightbox.
import { useCallback, useEffect, useRef, useState } from 'react'
import { IMG, Section, SectionHead, type Photo } from '../site'
import { SiteIcon } from '../SiteIcon'

const PHOTOS: Photo[] = [IMG.bigWide, IMG.meeting, IMG.meetingTable, IMG.big]
/** Grid slot for each photo; slot 3 is the flat «THINK OUTSIDE THE BOX» brand tile (not part of the lightbox). */
const SLOTS = [1, 2, 4, 5]

export function Gallery({ kicker = 'من جوّا', title = 'شوف المكان بعينك', lead = 'صور حقيقية من فوكس بوينت.', tint = false }: { kicker?: string; title?: string; lead?: string; tint?: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)

  const show = (i: number) => { lastFocus.current = document.activeElement as HTMLElement; setOpen(i) }
  const close = useCallback(() => { setOpen(null); lastFocus.current?.focus() }, [])
  const step = useCallback((d: number) => setOpen((i) => (i == null ? i : (i + d + PHOTOS.length) % PHOTOS.length)), [])

  useEffect(() => {
    if (open == null) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      // RTL: the left arrow moves forward
      if (e.key === 'ArrowLeft') step(1)
      if (e.key === 'ArrowRight') step(-1)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, close, step])

  const cur = open == null ? null : PHOTOS[open]
  return (
    <Section id="gallery" tint={tint} labelledBy="fp-gallery-title">
      <SectionHead id="fp-gallery-title" kicker={kicker} title={title} lead={lead} />
      <ul className="fp-gallery">
        {PHOTOS.map((p, i) => [
          i === 2 && (
            <li key="quote" className="fp-g-3">
              <div className="fp-g-quote" dir="ltr" aria-label="THINK OUTSIDE THE BOX">THINK<br />OUTSIDE<br />THE BOX</div>
            </li>
          ),
          <li key={p.src} className={`fp-g-${SLOTS[i]}`}>
            <button type="button" className="fp-g-btn" onClick={() => show(i)} aria-label={`تكبير الصورة: ${p.alt}`}>
              <img src={p.small} width={p.w} height={p.h} alt={p.alt} loading="lazy" decoding="async" />
              <span className="fp-g-zoom" aria-hidden="true"><SiteIcon name="zoom" size={18} /></span>
            </button>
          </li>,
        ])}
      </ul>
      {cur && (
        <div className="fp-lightbox" role="dialog" aria-modal="true" aria-label="معرض الصور" onClick={close}>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={cur.src} width={cur.w} height={cur.h} alt={cur.alt} />
            <figcaption>{cur.alt}</figcaption>
          </figure>
          <button ref={closeRef} type="button" className="fp-lb-btn fp-lb-close" onClick={close} aria-label="إغلاق"><SiteIcon name="x" size={22} /></button>
          <button type="button" className="fp-lb-btn fp-lb-prev" onClick={(e) => { e.stopPropagation(); step(-1) }} aria-label="الصورة السابقة"><SiteIcon name="back" size={22} /></button>
          <button type="button" className="fp-lb-btn fp-lb-next" onClick={(e) => { e.stopPropagation(); step(1) }} aria-label="الصورة التالية"><SiteIcon name="arrow" size={22} /></button>
          <span className="fp-lb-count num">{(open ?? 0) + 1} / {PHOTOS.length}</span>
        </div>
      )}
    </Section>
  )
}

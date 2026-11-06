// Photo gallery of the real space (content.home.gallery.photos — also on /about), with a light, dependency-free
// lightbox. Four photo slots plus the flat brand-colour quote tile in the third place.
import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_CONTENT, type Photo } from '@shared/content'
import { usePhotoChain, useSite } from '../../../components/site/siteContent'
import { Section, SectionHead } from '../site'
import { SiteIcon } from '../SiteIcon'

/** Grid slot for each photo; slot 3 is the flat quote tile (not part of the lightbox). */
const SLOTS = [1, 2, 4, 5]
const DEFAULT_PHOTOS = DEFAULT_CONTENT.home.gallery.photos

function Thumb({ photo: p, index, onOpen }: { photo: Photo; index: number; onOpen: (i: number) => void }) {
  const { photo, src, onError } = usePhotoChain([p, DEFAULT_PHOTOS[index]], true)
  if (!photo) return null
  return (
    <button type="button" className="fp-g-btn" onClick={() => onOpen(index)} aria-label={`تكبير الصورة: ${photo.alt}`}>
      <img src={src} width={photo.w} height={photo.h} alt={photo.alt} loading="lazy" decoding="async" onError={onError} />
      <span className="fp-g-zoom" aria-hidden="true"><SiteIcon name="zoom" size={18} /></span>
    </button>
  )
}

function Big({ photo: p, index }: { photo: Photo; index: number }) {
  const { photo, src, onError } = usePhotoChain([p, DEFAULT_PHOTOS[index]])
  if (!photo) return null
  return (
    <figure onClick={(e) => e.stopPropagation()}>
      <img src={src} width={photo.w} height={photo.h} alt={photo.alt} onError={onError} />
      <figcaption>{photo.alt}</figcaption>
    </figure>
  )
}

export function Gallery({ head, tint = false }: { head: { kicker: string; title: string; lead: string }; tint?: boolean }) {
  const { c } = useSite()
  const photos = c.home.gallery.photos.slice(0, SLOTS.length)
  const lines = c.home.gallery.quote.split('\n').map((l) => l.trim()).filter(Boolean)
  const [open, setOpen] = useState<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)
  const count = photos.length

  const show = (i: number) => { lastFocus.current = document.activeElement as HTMLElement; setOpen(i) }
  const close = useCallback(() => { setOpen(null); lastFocus.current?.focus() }, [])
  const step = useCallback((d: number) => setOpen((i) => (i == null || !count ? i : (i + d + count) % count)), [count])

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

  if (!count) return null
  const cur = open == null ? null : photos[open] ?? null
  return (
    <Section id="gallery" tint={tint} labelledBy="fp-gallery-title">
      <SectionHead id="fp-gallery-title" kicker={head.kicker} title={head.title} lead={head.lead} />
      <ul className="fp-gallery">
        {photos.map((p, i) => [
          i === 2 && (
            <li key="quote" className="fp-g-3">
              {lines.length > 0
                ? (
                  <div className="fp-g-quote" dir="auto" aria-label={lines.join(' ')}>
                    {lines.map((l, j) => (j ? [<br key={`b${j}`} />, l] : l))}
                  </div>
                )
                : <div className="fp-g-quote" aria-hidden="true" />}
            </li>
          ),
          <li key={i} className={`fp-g-${SLOTS[i]}`}>
            <Thumb photo={p} index={i} onOpen={show} />
          </li>,
        ])}
      </ul>
      {cur && open != null && (
        <div className="fp-lightbox" role="dialog" aria-modal="true" aria-label="معرض الصور" onClick={close}>
          <Big key={open} photo={cur} index={open} />
          <button ref={closeRef} type="button" className="fp-lb-btn fp-lb-close" onClick={close} aria-label="إغلاق"><SiteIcon name="x" size={22} /></button>
          <button type="button" className="fp-lb-btn fp-lb-prev" onClick={(e) => { e.stopPropagation(); step(-1) }} aria-label="الصورة السابقة"><SiteIcon name="back" size={22} /></button>
          <button type="button" className="fp-lb-btn fp-lb-next" onClick={(e) => { e.stopPropagation(); step(1) }} aria-label="الصورة التالية"><SiteIcon name="arrow" size={22} /></button>
          <span className="fp-lb-count num">{open + 1} / {count}</span>
        </div>
      )}
    </Section>
  )
}

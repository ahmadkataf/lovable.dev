import { useEffect, useMemo, useRef, useState } from 'react'
import { readAloud, stopReading, type ReadHandle } from '../engine/audio'
import { splitSentences } from '../engine/text'

interface Props {
  paragraphs: string[]
  paragraphsAr?: string[]
  title?: string
  showAr?: boolean
  maxHeight?: string
}

/** The reading text with a highlight that follows the voice, so a learner who
 *  looks away can always see which word is being read. */
export default function ReadingText({ paragraphs, paragraphsAr, title, showAr, maxHeight }: Props) {
  // flat list of sentences + where each one sits, so playback and layout agree
  const { flat, perParagraph } = useMemo(() => {
    const flat: string[] = []
    // each sentence keeps its own words and its index in the playback order
    const perParagraph = paragraphs.map(p => splitSentences(p).map(sentence => {
      const id = flat.length
      flat.push(sentence)
      return { id, words: sentence.split(/\s+/).filter(Boolean) }
    }))
    return { flat, perParagraph }
  }, [paragraphs])

  const [playing, setPlaying] = useState(false)
  const [slow, setSlow] = useState(false)
  const [at, setAt] = useState<{ s: number; w: number } | null>(null)
  const handle = useRef<ReadHandle | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => () => { handle.current?.stop(); stopReading() }, [])

  const stop = () => { handle.current?.stop(); handle.current = null; setPlaying(false); setAt(null) }

  const start = (from = 0, rate = slow ? 0.75 : 1) => {
    handle.current?.stop()
    setPlaying(true)
    setAt({ s: from, w: 0 })
    handle.current = readAloud(flat.slice(from), {
      rate,
      onWord: (s, w) => setAt({ s: s + from, w }),
      onEnd: () => { setPlaying(false); setAt(null); handle.current = null },
    })
  }

  // keep the spoken word on screen
  useEffect(() => {
    if (!at || !box.current) return
    const el = box.current.querySelector('[data-active="1"]') as HTMLElement | null
    if (!el) return
    const b = box.current.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.top < b.top + 24 || r.bottom > b.bottom - 24) {
      box.current.scrollTop += r.top - b.top - b.height / 2 + r.height / 2
    }
  }, [at])

  return (
    <div>
      <div className="row mb" style={{ gap: 8 }}>
        <button className={`btn btn-sm ${playing ? 'btn-red' : 'btn-blue'}`} onClick={() => (playing ? stop() : start(0))}>
          {playing ? '⏹ إيقاف' : '▶️ استمع للنص'}
        </button>
        <button className={`pill ${slow ? 'active' : ''}`} onClick={() => { const v = !slow; setSlow(v); if (playing) start(at?.s ?? 0, v ? 0.75 : 1) }}>🐢 بطيء</button>
        <span className="muted" style={{ fontSize: 12 }}>اضغط أي جملة لتسمعها من عندها</span>
      </div>
      <div className="reading-box" ref={box} style={maxHeight ? { maxHeight } : undefined}>
        {title && <h3>{title}</h3>}
        {perParagraph.map((sentences, pi) => (
          <div key={pi}>
            <p>
              {sentences.map(({ id, words }) => {
                const active = at?.s === id
                return (
                  <span
                    key={id}
                    className={`sen ${active ? 'sen-active' : ''}`}
                    onClick={() => start(id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') start(id) }}
                  >
                    {words.map((word, wi) => {
                      const spoken = active && at?.w === wi
                      return (
                        <span key={wi} data-active={spoken ? '1' : undefined} className={spoken ? 'word-active' : undefined}>
                          {word}{wi < words.length - 1 ? ' ' : ''}
                        </span>
                      )
                    })}{' '}
                  </span>
                )
              })}
            </p>
            {showAr && paragraphsAr?.[pi] && <p className="p-ar">{paragraphsAr[pi]}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

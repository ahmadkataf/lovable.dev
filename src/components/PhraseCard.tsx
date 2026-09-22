import { useEffect, useRef, useState } from 'react'
import type { Everyday } from '../engine/types'
import { readAloud, stopReading, type ReadHandle } from '../engine/audio'
import { Speaker } from './common'

/** Everyday English: when to use the expressions, the expressions themselves, and the
 *  book's dialogue read aloud line by line with the current line highlighted. */
export default function PhraseCard({ everyday: e }: { everyday: Everyday }) {
  const [line, setLine] = useState<number | null>(null)
  const handle = useRef<ReadHandle | null>(null)
  useEffect(() => () => { handle.current?.stop(); stopReading() }, [])

  const play = (from = 0) => {
    if (!e.dialogue) return
    handle.current?.stop()
    setLine(from)
    handle.current = readAloud(e.dialogue.slice(from).map(d => d.en), {
      onSentence: i => setLine(i + from),
      onEnd: () => { setLine(null); handle.current = null },
    })
  }
  const stop = () => { handle.current?.stop(); handle.current = null; setLine(null) }

  return (
    <div className="fade grammar-card">
      <div className="prompt"><span className="en">{e.title}</span></div>
      <div className="muted">{e.titleAr}</div>
      <div className="ar-rule">{e.explainAr}</div>
      <div className="h2">العبارات</div>
      {e.expressions.map((x, i) => (
        <div key={i} className="ex" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="row spread"><span>{x.en}</span><Speaker text={x.en} size="sm" /></div>
          <div className="sentence-ar" style={{ margin: 0 }}>{x.ar}{x.note ? ` — ${x.note}` : ''}</div>
        </div>
      ))}
      {e.dialogue && e.dialogue.length > 0 && (
        <>
          <div className="row spread">
            <div className="h2" style={{ margin: 0 }}>الحوار</div>
            <button className={`btn btn-sm ${line !== null ? 'btn-red' : 'btn-blue'}`} onClick={() => (line !== null ? stop() : play(0))}>
              {line !== null ? '⏹ إيقاف' : '▶️ استمع للحوار'}
            </button>
          </div>
          <div className="dialogue">
            {e.dialogue.map((d, i) => (
              <div key={i} className={`dl ${line === i ? 'dl-active' : ''}`} onClick={() => play(i)} role="button" tabIndex={0}>
                <div className="dl-en"><b>{d.speaker}:</b> {d.en}</div>
                <div className="dl-ar">{d.ar}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Renders a legal document written in the small markup of i18n/modules/legal.ts: '## ' a heading, '- ' a bullet,
// an empty line between paragraphs. Plain text only (no HTML is ever interpreted).
import { Fragment, type ReactNode } from 'react'

type Block = { kind: 'h' | 'p'; text: string } | { kind: 'ul'; items: string[] }
export function parseLegal(src: string): Block[] {
  const out: Block[] = []
  for (const chunk of src.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean)
    let para: string[] = []
    const flush = () => { if (para.length) { out.push({ kind: 'p', text: para.join(' ') }); para = [] } }
    for (const line of lines) {
      if (line.startsWith('## ')) { flush(); out.push({ kind: 'h', text: line.slice(3).trim() }) }
      else if (line.startsWith('- ')) {
        flush()
        const last = out[out.length - 1]
        if (last && last.kind === 'ul') last.items.push(line.slice(2).trim())
        else out.push({ kind: 'ul', items: [line.slice(2).trim()] })
      } else para.push(line)
    }
    flush()
  }
  return out
}

export function LegalText({ text, lang }: { text: string; lang: 'ar' | 'en' }) {
  const blocks = parseLegal(text)
  return (
    <div className="lg-doc" lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {blocks.map((b, i): ReactNode => (
        <Fragment key={i}>
          {b.kind === 'ul' ? <ul className="lg-ul">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
            : b.kind === 'h' ? <h3 className="lg-h">{b.text}</h3>
            : <p className="lg-p">{b.text}</p>}
        </Fragment>
      ))}
    </div>
  )
}

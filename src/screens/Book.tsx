import type { Module } from '../engine/types'
import { Speaker } from '../components/common'
import { speak } from '../engine/audio'

export default function Book({ modules }: { modules: Module[] }) {
  return (
    <div className="page">
      <div className="h1">📖 الكتاب</div>
      <p className="muted mb">النصوص والقواعد الكاملة من الكتاب مع الصوت، للمراجعة في أي وقت.</p>
      {modules.map(m => (
        <div key={m.number}>
          <div className="module-head" style={{ background: m.color, margin: '12px 0' }}>
            <div className="sub">الوحدة {m.number} · {m.titleAr}</div>
            <div className="title">Module {m.number}: {m.title}</div>
          </div>
          {m.units.map(u => (
            <details key={u.id} className="unit-ref">
              <summary>{u.emoji} Unit {u.number}: {u.title} <span className="muted">· {u.titleAr} · ص {u.pages}</span></summary>
              <p className="muted">{u.planAr}</p>
              {u.quotes?.map((q, i) => <div key={i} className="quote">"{q.text}" — {q.by}</div>)}
              <div className="h2 mt">📰 القراءة: <span className="en">{u.reading.title}</span> <Speaker text={u.reading.paragraphs.join(' ')} size="sm" /></div>
              <div className="reading-box" style={{ maxHeight: 'none' }}>
                {u.reading.paragraphs.map((p, i) => <div key={i}><p>{p}</p>{u.reading.paragraphsAr?.[i] && <p className="p-ar">{u.reading.paragraphsAr[i]}</p>}</div>)}
              </div>
              <div className="h2 mt">🧩 القواعد: {u.grammar.nameAr} <span className="en muted" style={{ fontSize: 13 }}>{u.grammar.name}</span></div>
              <div className="grammar-card">
                <div className="ar-rule"><ul>{u.grammar.ruleAr.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
                <div className="en-rule"><ul>{u.grammar.ruleEn.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
                {u.grammar.examples.map((e, i) => <div key={i} className="ex"><span>{e}</span><Speaker text={e} size="sm" /></div>)}
              </div>
              {u.pronunciation && (
                <div className="mt">
                  <div className="h2">🔤 النطق: <span className="en">{u.pronunciation.title}</span></div>
                  <p className="muted">{u.pronunciation.ruleAr}</p>
                  {u.pronunciation.groups.map((g, i) => (
                    <div key={i} className="row" style={{ flexWrap: 'wrap', marginBottom: 6 }}>
                      <span className="pill active en">{g.label}</span>
                      {g.words.map(w => <button key={w} className="pill en" onClick={() => speak(w)}>🔊 {w}</button>)}
                    </div>
                  ))}
                </div>
              )}
              {u.listening && <div className="mt"><div className="h2">🎧 الاستماع</div><p className="muted">{u.listening.taskAr}</p>{u.listening.items && <ul className="en" style={{ paddingInlineStart: 20 }}>{u.listening.items.map((it, i) => <li key={i}>{it}</li>)}</ul>}</div>}
              {u.writing && <div className="mt"><div className="h2">✍️ الكتابة</div><p className="muted">{u.writing.taskAr}</p>{u.writing.linkers && <div className="pills">{u.writing.linkers.map(l => <span key={l} className="pill en">{l}</span>)}</div>}{u.writing.model && <div className="reading-box mt" style={{ maxHeight: 'none' }}>{u.writing.model.map((p, i) => <p key={i}>{p}</p>)}</div>}</div>}
              <div className="h2 mt">📚 الكلمات ({u.vocab.length})</div>
              {u.vocab.map(w => (
                <div key={w.en} className="word-row">
                  <Speaker text={w.en} size="sm" />
                  <div className="grow"><div className="w">{w.en}</div><div className="a">{w.ar}{w.defAr ? ` — ${w.defAr}` : ''}</div>{w.def && <div className="muted en" style={{ fontSize: 12 }}>{w.def}</div>}</div>
                </div>
              ))}
            </details>
          ))}
          {m.focus && (
            <details className="unit-ref">
              <summary>🔬 {m.focus.title}</summary>
              <div className="reading-box mt" style={{ maxHeight: 'none' }}>{m.focus.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
              {m.focus.glossary?.map(w => <div key={w.en} className="word-row"><Speaker text={w.en} size="sm" /><div className="grow"><div className="w">{w.en}</div><div className="a">{w.ar}</div></div></div>)}
            </details>
          )}
          {m.project && (
            <details className="unit-ref">
              <summary>🛠️ {m.project.title}</summary>
              <ol className="en" style={{ paddingInlineStart: 20, direction: 'ltr', textAlign: 'left' }}>{m.project.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </details>
          )}
        </div>
      ))}
    </div>
  )
}

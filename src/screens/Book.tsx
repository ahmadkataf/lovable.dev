import type { Module } from '../engine/types'
import { Speaker } from '../components/common'
import { speak } from '../engine/audio'
import ReadingText from '../components/ReadingText'
import { freeUnit } from '../engine/access'
import PhraseCard from '../components/PhraseCard'

export default function Book({ modules, onGrammarPractice, pro = true, onLocked }: { modules: Module[]; onGrammarPractice: (unitId: string, which?: 'grammar' | 'vocabFocus' | 'everyday') => void; pro?: boolean; onLocked?: () => void }) {
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
          {m.units.map(u => !pro && !freeUnit(u.id, modules) ? (
            <button key={u.id} className="unit-ref locked-ref" onClick={onLocked}>
              <span>{u.emoji} Unit {u.number}: {u.title} <span className="muted">· {u.titleAr}</span></span>
              <span className="pill">🔑 بعد التفعيل</span>
            </button>
          ) : (
            <details key={u.id} className="unit-ref">
              <summary>{u.emoji} Unit {u.number}: {u.title} <span className="muted">· {u.titleAr} · ص {u.pages}</span></summary>
              <p className="muted">{u.planAr}</p>
              {u.quotes?.map((q, i) => <div key={i} className="quote">"{q.text}" — {q.by}</div>)}
              <div className="h2 mt">📰 القراءة: <span className="en">{u.reading.title}</span></div>
              <ReadingText paragraphs={u.reading.paragraphs} paragraphsAr={u.reading.paragraphsAr} showAr maxHeight="none" />
              {u.extraReadings?.map((r, i) => (
                <div key={i} className="mt">
                  <div className="h2">📄 <span className="en">{r.title}</span></div>
                  <ReadingText paragraphs={r.paragraphs} paragraphsAr={r.paragraphsAr} showAr maxHeight="none" />
                </div>
              ))}
              {u.vocabFocus && (
                <>
                  <div className="row spread mt">
                    <div className="h2" style={{ margin: 0 }}>🔤 المفردات: {u.vocabFocus.nameAr} <span className="en muted" style={{ fontSize: 13 }}>{u.vocabFocus.name}</span></div>
                    <button className="btn btn-blue btn-sm" onClick={() => onGrammarPractice(u.id, 'vocabFocus')}>✏️ تدرّب ({u.vocabFocus.exercises.length})</button>
                  </div>
                  <div className="grammar-card">
                    <div className="ar-rule"><ul>{u.vocabFocus.ruleAr.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
                    <div className="en-rule"><ul>{u.vocabFocus.ruleEn.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
                    {u.vocabFocus.examples.map((e, i) => <div key={i} className="ex"><span>{e}</span><Speaker text={e} size="sm" /></div>)}
                  </div>
                </>
              )}
              <div className="row spread mt">
                <div className="h2" style={{ margin: 0 }}>🧩 القواعد: {u.grammar.nameAr} <span className="en muted" style={{ fontSize: 13 }}>{u.grammar.name}</span></div>
                <button className="btn btn-blue btn-sm" onClick={() => onGrammarPractice(u.id)}>✏️ تدرّب ({u.grammar.exercises.length})</button>
              </div>
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
              {u.everyday && (
                <div className="mt">
                  <div className="row spread">
                    <div className="h2" style={{ margin: 0 }}>💬 Everyday English</div>
                    <button className="btn btn-blue btn-sm" onClick={() => onGrammarPractice(u.id, 'everyday')}>✏️ تدرّب ({u.everyday.exercises.length})</button>
                  </div>
                  <PhraseCard everyday={u.everyday} />
                </div>
              )}
              {u.listening && <div className="mt"><div className="h2">🎧 الاستماع</div><p className="muted">{u.listening.taskAr}</p>{u.listening.items && <ul className="en" style={{ paddingInlineStart: 20 }}>{u.listening.items.map((it, i) => <li key={i}>{it}</li>)}</ul>}</div>}
              {u.writing && <div className="mt"><div className="h2">✍️ الكتابة</div><p className="muted">{u.writing.taskAr}</p>{u.writing.linkers && <div className="pills">{u.writing.linkers.map(l => <span key={l} className="pill en">{l}</span>)}</div>}{u.writing.model && <div className="reading-box mt" style={{ maxHeight: 'none' }}>{u.writing.model.map((p, i) => <p key={i}>{p}</p>)}</div>}</div>}
              {u.workbook && (
                <div className="mt">
                  <div className="h2">📒 كتاب الأنشطة <span className="muted" style={{ fontSize: 13 }}>· ص {u.workbook.pages}</span></div>
                  {u.workbook.readings.map((r, i) => (
                    <div key={i} className="mt">
                      <div className="en" style={{ fontWeight: 800 }}>{r.title}</div>
                      <ReadingText paragraphs={r.paragraphs} paragraphsAr={r.paragraphsAr} showAr maxHeight="none" />
                    </div>
                  ))}
                  <p className="muted mt">تمارين كتاب الأنشطة: {u.workbook.exercises.length} تمريناً محلولاً — تظهر في درس «كتاب الأنشطة» على المسار.</p>
                </div>
              )}
              {u.compositions?.map((c, i) => (
                <details key={i} className="mt">
                  <summary>📝 موضوع إنشائي {c.source === 'workbook' ? '(كتاب الأنشطة)' : '(كتاب الطالب)'}: <span className="en">{c.topic}</span></summary>
                  <div className="muted">{c.topicAr}</div>
                  <ol style={{ paddingInlineStart: 20 }}>{c.plan.map((p, j) => <li key={j}>{p.ar}</li>)}</ol>
                  <div className="reading-box mt en" dir="ltr" style={{ maxHeight: 'none' }}><p>{c.model}</p></div>
                  <div className="sentence-ar">{c.modelAr}</div>
                </details>
              ))}
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
          {m.review && (
            <details className="unit-ref">
              <summary>📋 {m.review.title} <span className="muted">· {m.review.titleAr} · ص {m.review.pages}</span></summary>
              {m.review.reading && (
                <>
                  <div className="h2 mt">📰 <span className="en">{m.review.reading.title}</span></div>
                  <ReadingText paragraphs={m.review.reading.paragraphs} paragraphsAr={m.review.reading.paragraphsAr} showAr maxHeight="none" />
                </>
              )}
              <p className="muted mt">تمارين المراجعة: {m.review.exercises.length} — تظهر في درس «{m.review.titleAr}» على المسار.</p>
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

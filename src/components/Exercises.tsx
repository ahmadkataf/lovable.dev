import { useEffect, useRef, useState } from 'react'
import type { Exercise, Word } from '../engine/types'
import { Speaker } from './common'
import { checkBuild, checkTyped, shuffle } from '../engine/generator'
import { listenOnce, recognitionSupported, sfx, speak } from '../engine/audio'

export type Result = null | 'correct' | 'wrong'

export interface ExProps {
  ex: Exercise
  value: unknown
  onChange: (value: unknown, ready: boolean) => void
  result: Result
  autoSpeak: boolean
}

export function judge(ex: Exercise, value: unknown): boolean {
  switch (ex.kind) {
    case 'intro': case 'grammar_card': case 'speak': return true
    case 'choose_ar': case 'choose_en': case 'listen': case 'listen_sentence': case 'mcq': case 'fill': return value === ex.answer
    case 'read': return value === ex.question.answer
    case 'truefalse': return (value === 0 || value === true) === ex.answer
    case 'type_en': return checkTyped(ex.word, String(value ?? ''))
    case 'build': return checkBuild(ex.target, ((value as number[]) || []).map(i => ex.tiles[i]))
    case 'match': return value === true
  }
}

export function correctAnswerText(ex: Exercise): string {
  switch (ex.kind) {
    case 'choose_ar': case 'choose_en': case 'listen': case 'listen_sentence': case 'mcq': case 'fill': return ex.options[ex.answer]
    case 'read': return ex.question.options[ex.question.answer]
    case 'truefalse': return ex.answer ? 'True ✔' : 'False ✘'
    case 'type_en': return ex.word.en
    case 'build': return ex.target
    default: return ''
  }
}

export function needsHearts(ex: Exercise): boolean {
  return !['intro', 'grammar_card', 'speak', 'match'].includes(ex.kind)
}

export function wordOf(ex: Exercise): Word | null {
  return 'word' in ex ? ex.word : null
}

export function ExerciseView(props: ExProps) {
  const { ex } = props
  switch (ex.kind) {
    case 'intro': return <Intro ex={ex} autoSpeak={props.autoSpeak} />
    case 'choose_ar': return <Options {...props} title="ما معنى هذه الكلمة؟" head={<div className="row"><Speaker text={ex.word.en} autoplay={props.autoSpeak} /><div className="prompt en">{ex.word.en}</div></div>} options={ex.options} answer={ex.answer} ar />
    case 'choose_en': return <Options {...props} title="أي كلمة تعني:" head={<div className="prompt">{ex.word.ar}</div>} options={ex.options} answer={ex.answer} speakOptions />
    case 'listen': return <Options {...props} title="استمع واختر ما سمعته" head={<div className="row" style={{ justifyContent: 'center', gap: 16 }}><Speaker text={ex.word.en} size="big" autoplay /><Speaker text={ex.word.en} slow /></div>} options={ex.options} answer={ex.answer} />
    case 'listen_sentence': return <Options {...props} title="استمع واختر الجملة التي سمعتها" head={<div className="row" style={{ justifyContent: 'center', gap: 16 }}><Speaker text={ex.text} size="big" autoplay /><Speaker text={ex.text} slow /></div>} options={ex.options} answer={ex.answer} />
    case 'mcq': return <Options {...props} title="اختر الإجابة الصحيحة" head={<div className="row">{ex.audio && <Speaker text={ex.audio} autoplay />}<div className="prompt en" style={{ fontSize: 19 }}>{ex.prompt}</div></div>} options={ex.options} answer={ex.answer} />
    case 'fill': return <Options {...props} title="أكمل الفراغ" head={<div className="row"><Speaker text={ex.prompt.replace('___', ex.options[ex.answer])} size="sm" /><div className="prompt en" style={{ fontSize: 19 }}>{ex.prompt.split('___').map((p, i, a) => <span key={i}>{p}{i < a.length - 1 && <span style={{ borderBottom: '3px solid var(--blue)', minWidth: 60, display: 'inline-block' }}>&nbsp;{props.value !== undefined && props.value !== null ? ex.options[props.value as number] : ''}&nbsp;</span>}</span>)}</div></div>} options={ex.options} answer={ex.answer} grid />
    case 'truefalse': return <Options {...props} title="صحيح أم خطأ؟" head={<div className="row"><Speaker text={ex.statement} size="sm" /><div className="prompt en" style={{ fontSize: 19 }}>{ex.statement}</div></div>} options={['True ✔', 'False ✘']} answer={ex.answer ? 0 : 1} boolMode />
    case 'read': return <ReadView {...props} />
    case 'type_en': return <TypeView {...props} />
    case 'match': return <MatchView {...props} />
    case 'build': return <BuildView {...props} />
    case 'grammar_card': return <GrammarCard ex={ex} />
    case 'speak': return <SpeakView {...props} />
  }
}

// ---------------- flashcard ----------------
function Intro({ ex, autoSpeak }: { ex: Extract<Exercise, { kind: 'intro' }>; autoSpeak: boolean }) {
  const w = ex.word
  return (
    <div className="fade">
      <div className="prompt">كلمة جديدة ✨</div>
      <div className="flash">
        <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
          <Speaker text={w.en} autoplay={autoSpeak} />
          <div className="word en">{w.en}</div>
        </div>
        {w.pos && <div className="pos en">{w.pos}</div>}
        <div className="ar">{w.ar}</div>
        {w.def && <div className="def en">{w.def}</div>}
        {w.defAr && <div className="def-ar">{w.defAr}</div>}
        {w.example && <div className="ex"><div className="row" style={{ justifyContent: 'center' }}><Speaker text={w.example} size="sm" /><span className="en">{w.example}</span></div>{w.exampleAr && <div className="ex-ar">{w.exampleAr}</div>}</div>}
      </div>
      <p className="muted center mt">اضغط على 🔊 لسماع النطق، ثم تابع.</p>
    </div>
  )
}

// ---------------- generic options ----------------
function Options({ value, onChange, result, title, head, options, answer, ar, speakOptions, grid, boolMode }: ExProps & { title: string; head: React.ReactNode; options: string[]; answer: number; ar?: boolean; speakOptions?: boolean; grid?: boolean; boolMode?: boolean }) {
  const sel = value as number | undefined
  return (
    <div className="fade">
      <div className="prompt-sub">{title}</div>
      {head}
      <div className={grid || boolMode ? 'grid2' : 'opt-list'} style={{ marginTop: 12 }}>
        {options.map((o, i) => {
          let cls = 'opt'
          if (result) { if (i === answer) cls += ' correct'; else if (i === sel) cls += ' wrong' }
          else if (i === sel) cls += ' selected'
          return (
            <button key={i} className={cls} disabled={!!result} onClick={() => { sfx.tap(); if (speakOptions) speak(o); onChange(i, true) }} style={{ justifyContent: grid || boolMode ? 'center' : undefined }}>
              {!grid && !boolMode && <span className="num">{i + 1}</span>}
              <span className={ar ? '' : 'en'} style={{ flex: 1, textAlign: ar ? 'right' : 'left' }}>{o}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- reading ----------------
function ReadView({ ex, value, onChange, result }: ExProps) {
  if (ex.kind !== 'read') return null
  const q = ex.question
  const sel = value as number | undefined
  const [showAr, setShowAr] = useState(false)
  return (
    <div className="fade">
      <div className="row spread">
        <div className="prompt-sub">اقرأ النص ثم أجب</div>
        <div className="row">
          {ex.paragraphsAr && <button className={`pill ${showAr ? 'active' : ''}`} onClick={() => setShowAr(v => !v)}>{showAr ? 'إخفاء الترجمة' : '🇸🇾 الترجمة'}</button>}
          <Speaker text={ex.paragraphs.join(' ')} size="sm" />
        </div>
      </div>
      <div className="reading-box">
        <h3>{ex.title}</h3>
        {ex.paragraphs.map((p, i) => <div key={i}><p>{p}</p>{showAr && ex.paragraphsAr?.[i] && <p className="p-ar">{ex.paragraphsAr[i]}</p>}</div>)}
      </div>
      <div className="prompt en" style={{ fontSize: 18 }}>{q.q}</div>
      <div className="opt-list">
        {q.options.map((o, i) => {
          let cls = 'opt'
          if (result) { if (i === q.answer) cls += ' correct'; else if (i === sel) cls += ' wrong' }
          else if (i === sel) cls += ' selected'
          return <button key={i} className={cls} disabled={!!result} onClick={() => { sfx.tap(); onChange(i, true) }}><span className="num">{i + 1}</span><span className="en" style={{ flex: 1, textAlign: 'left', fontSize: 16 }}>{o}</span></button>
        })}
      </div>
    </div>
  )
}

// ---------------- type the word ----------------
function TypeView({ ex, value, onChange, result }: ExProps) {
  if (ex.kind !== 'type_en') return null
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className="fade">
      <div className="prompt-sub">اكتب الكلمة بالإنجليزية</div>
      <div className="prompt">{ex.word.ar}</div>
      {ex.word.def && <div className="muted en mb">{ex.word.def}</div>}
      <input ref={ref} className="type-input" value={(value as string) || ''} disabled={!!result} placeholder="Type in English..." autoCapitalize="off" autoCorrect="off" spellCheck={false}
        onChange={e => onChange(e.target.value, e.target.value.trim().length > 0)} />
      <div className="row mt"><Speaker text={ex.word.en} size="sm" /><span className="muted">تلميح: اسمع الكلمة</span></div>
    </div>
  )
}

// ---------------- match pairs ----------------
function MatchView({ ex, onChange, autoSpeak }: ExProps) {
  if (ex.kind !== 'match') return null
  const [left] = useState(() => shuffle(ex.pairs.map(p => p.en)))
  const [right] = useState(() => shuffle(ex.pairs.map(p => p.ar)))
  const [selL, setSelL] = useState<string | null>(null)
  const [selR, setSelR] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [shake, setShake] = useState<string | null>(null)

  useEffect(() => {
    if (selL && selR) {
      const pair = ex.pairs.find(p => p.en === selL)
      if (pair && pair.ar === selR) {
        sfx.correct()
        const d = new Set(done); d.add(selL); d.add(selR); setDone(d)
        if (d.size === ex.pairs.length * 2) onChange(true, true)
      } else { sfx.wrong(); setShake(selR); setTimeout(() => setShake(null), 400) }
      setSelL(null); setSelR(null)
    }
  }, [selL, selR]) // eslint-disable-line

  const btn = (t: string, side: 'l' | 'r') => {
    const isSel = side === 'l' ? selL === t : selR === t
    const cls = `opt ${done.has(t) ? 'matched' : ''} ${isSel ? 'selected' : ''} ${shake === t ? 'wrong' : ''}`
    return <button key={t} className={cls} style={{ justifyContent: 'center' }} onClick={() => { sfx.tap(); if (side === 'l') { setSelL(t); if (autoSpeak) speak(t) } else setSelR(t) }}><span className={side === 'l' ? 'en' : ''}>{t}</span></button>
  }
  return (
    <div className="fade">
      <div className="prompt">صِل كل كلمة بمعناها</div>
      <div className="match-grid">
        <div className="match-col">{left.map(t => btn(t, 'l'))}</div>
        <div className="match-col">{right.map(t => btn(t, 'r'))}</div>
      </div>
    </div>
  )
}

// ---------------- build sentence ----------------
function BuildView({ ex, value, onChange, result }: ExProps) {
  if (ex.kind !== 'build') return null
  const chosen = (value as number[] | undefined) || []   // indexes into ex.tiles
  const set = (idx: number[]) => onChange(idx, idx.length > 0)
  return (
    <div className="fade">
      <div className="prompt-sub">{ex.promptAr || 'رتّب الكلمات لتكوين الجملة الصحيحة'}</div>
      <div className="row mb"><Speaker text={ex.target} size="sm" /><span className="muted">استمع للجملة ثم رتّبها</span></div>
      <div className="answer-zone">
        {chosen.map((ti, i) => <button key={i} className="tile" disabled={!!result} onClick={() => { sfx.tap(); set(chosen.filter((_, j) => j !== i)) }}>{ex.tiles[ti]}</button>)}
      </div>
      <div className="tiles mt">
        {ex.tiles.map((t, i) => <button key={i} className={`tile ${chosen.includes(i) ? 'ghost' : ''}`} disabled={!!result || chosen.includes(i)} onClick={() => { sfx.tap(); speak(t); set([...chosen, i]) }}>{t}</button>)}
      </div>
    </div>
  )
}

// ---------------- grammar explanation ----------------
function GrammarCard({ ex }: { ex: Extract<Exercise, { kind: 'grammar_card' }> }) {
  const g = ex.grammar
  return (
    <div className="fade grammar-card">
      <div className="prompt">{g.nameAr} <span className="en muted" style={{ fontSize: 14 }}>({g.name})</span></div>
      <div className="ar-rule"><ul>{g.ruleAr.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
      <div className="en-rule"><ul>{g.ruleEn.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
      <div className="h2">أمثلة</div>
      {g.examples.map((e, i) => <div key={i} className="ex"><span>{e}</span><Speaker text={e} size="sm" /></div>)}
    </div>
  )
}

// ---------------- listen & repeat ----------------
function SpeakView({ ex, onChange }: ExProps) {
  if (ex.kind !== 'speak') return null
  const [heard, setHeard] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState<boolean | null>(null)
  const supported = recognitionSupported()
  useEffect(() => { onChange(true, true) }, []) // eslint-disable-line
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter(Boolean)
  const rec = async () => {
    setBusy(true); setHeard(null); setOk(null)
    try {
      const t = await listenOnce()
      setHeard(t)
      const a = norm(ex.text), b = new Set(norm(t))
      const hit = a.filter(w => b.has(w)).length / Math.max(1, a.length)
      const good = hit >= 0.6
      setOk(good); good ? sfx.correct() : sfx.wrong()
    } catch { setHeard('لم أسمع شيئاً، حاول مجدداً') } finally { setBusy(false) }
  }
  return (
    <div className="fade center">
      <div className="prompt-sub">استمع وكرّر الجملة</div>
      <div className="row mb" style={{ justifyContent: 'center' }}><Speaker text={ex.text} autoplay /><div className="prompt en" style={{ fontSize: 20 }}>{ex.text}</div></div>
      {ex.ar && <div className="muted mb">{ex.ar}</div>}
      {supported ? (
        <>
          <button className={`mic ${busy ? 'on' : ''}`} onClick={rec} disabled={busy}>🎤</button>
          <p className="muted">اضغط على الميكروفون وانطق الجملة</p>
          {heard && <div className={`hint ${ok ? '' : ''}`} style={{ background: ok === null ? 'var(--yellow)' : ok ? 'var(--green-light)' : 'var(--red-light)' }}>{ok === true ? '👏 ممتاز! ' : ok === false ? '🔁 حاول مرة أخرى: ' : ''}<span className="en">{heard}</span></div>}
        </>
      ) : (
        <p className="muted">متصفحك لا يدعم التعرّف على الصوت. استمع وكرّر بصوت عالٍ ثم تابع.</p>
      )}
    </div>
  )
}

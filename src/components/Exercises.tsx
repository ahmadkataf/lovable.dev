import { useEffect, useRef, useState } from 'react'
import type { Composition, Exercise, Word } from '../engine/types'
import { Speaker } from './common'
import ReadingText from './ReadingText'
import PhraseCard from './PhraseCard'
import { checkBuild, checkDictation, checkTyped, shuffle } from '../engine/generator'
import { splitSentences } from '../engine/text'
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
    case 'intro': case 'grammar_card': case 'speak': case 'phrase_card': case 'translate': case 'compose': return true
    case 'dictation': return checkDictation(ex.text, String(value ?? ''))
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
    case 'dictation': return ex.text
    default: return ''
  }
}

export function needsHearts(ex: Exercise): boolean {
  return !['intro', 'grammar_card', 'speak', 'match', 'phrase_card', 'translate', 'compose'].includes(ex.kind)
}

export function wordOf(ex: Exercise): Word | null {
  return 'word' in ex ? ex.word ?? null : null
}

export function ExerciseView(props: ExProps) {
  const { ex } = props
  switch (ex.kind) {
    case 'intro': return <Intro ex={ex} autoSpeak={props.autoSpeak} />
    case 'choose_ar': return <Options {...props} title="ما معنى هذه الكلمة؟" head={<div className="row"><Speaker text={ex.word.en} autoplay={props.autoSpeak} /><div className="prompt en">{ex.word.en}</div></div>} options={ex.options} answer={ex.answer} ar />
    case 'choose_en': return <Options {...props} title="أي كلمة تعني:" head={<div className="prompt">{ex.word.ar}</div>} options={ex.options} answer={ex.answer} speakOptions />
    case 'listen': return <Options {...props} title="استمع واختر ما سمعته" head={<div className="row" style={{ justifyContent: 'center', gap: 16 }}><Speaker text={ex.word.en} size="big" autoplay /><Speaker text={ex.word.en} slow /></div>} options={ex.options} answer={ex.answer} />
    case 'listen_sentence': return <Options {...props} title="استمع واختر الجملة التي سمعتها" head={<div className="row" style={{ justifyContent: 'center', gap: 16 }}><Speaker text={ex.text} size="big" autoplay /><Speaker text={ex.text} slow /></div>} options={ex.options} answer={ex.answer} />
    case 'mcq': return <Options {...props} ar={ex.options.every(o => /[\u0600-\u06ff]/.test(o))} title="اختر الإجابة الصحيحة" translation={ex.promptAr} head={<div className="row">{ex.audio && <Speaker text={ex.audio} autoplay />}<div className="prompt en" style={{ fontSize: 19 }}>{ex.prompt}</div></div>} options={ex.options} answer={ex.answer} />
    case 'fill': return <Options {...props} title="أكمل الفراغ" ar={false} translation={ex.promptAr} translationDone={ex.promptArFull} head={<div className="row">
      {/* the sentence is only read aloud once the answer is in, so the voice cannot give it away */}
      {props.result ? <Speaker text={ex.prompt.replace('___', ex.options[ex.answer])} size="sm" /> : <span className="speaker sm muted-speaker" title="يظهر الصوت بعد الإجابة">🔇</span>}
      <div className="prompt en" style={{ fontSize: 19 }}>{ex.prompt.split('___').map((p, i, a) => <span key={i}>{p}{i < a.length - 1 && <span style={{ borderBottom: '3px solid var(--blue)', minWidth: 60, display: 'inline-block' }}>&nbsp;{props.value !== undefined && props.value !== null ? ex.options[props.value as number] : ''}&nbsp;</span>}</span>)}</div></div>} options={ex.options} answer={ex.answer} grid />
    case 'truefalse': return <Options {...props} title="صحيح أم خطأ؟" translation={ex.statementAr} head={<div className="row"><Speaker text={ex.statement} size="sm" /><div className="prompt en" style={{ fontSize: 19 }}>{ex.statement}</div></div>} options={['True ✔', 'False ✘']} answer={ex.answer ? 0 : 1} boolMode />
    case 'read': return <ReadView {...props} />
    case 'type_en': return <TypeView {...props} />
    case 'match': return <MatchView {...props} />
    case 'build': return <BuildView {...props} />
    case 'grammar_card': return <GrammarCard ex={ex} />
    case 'speak': return <SpeakView {...props} />
    case 'phrase_card': return <PhraseCard everyday={ex.everyday} />
    case 'dictation': return <DictationView {...props} />
    case 'translate': return <TranslateView {...props} />
    case 'compose': return <ComposeView {...props} />
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
function Options({ value, onChange, result, title, head, options, answer, ar, speakOptions, grid, boolMode, translation, translationDone }: ExProps & { title: string; head: React.ReactNode; options: string[]; answer: number; ar?: boolean; speakOptions?: boolean; grid?: boolean; boolMode?: boolean; translation?: string; translationDone?: string }) {
  const sel = value as number | undefined
  const shown = result && translationDone ? translationDone : translation
  return (
    <div className="fade">
      <div className="prompt-sub">{title}</div>
      {head}
      {shown && <div className="sentence-ar">{shown}</div>}
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
        {ex.paragraphsAr && <button className={`pill ${showAr ? 'active' : ''}`} onClick={() => setShowAr(v => !v)}>{showAr ? 'إخفاء الترجمة' : 'الترجمة بالعربية'}</button>}
      </div>
      <ReadingText title={ex.title} paragraphs={ex.paragraphs} paragraphsAr={ex.paragraphsAr} showAr={showAr} maxHeight="42vh" />
      <div className="prompt en" style={{ fontSize: 18 }}>{q.q}</div>
      {q.qAr && <div className="sentence-ar">{q.qAr}</div>}
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

// ---------------- dictation: hear it, spell it ----------------
function DictationView({ ex, value, onChange, result }: ExProps) {
  if (ex.kind !== 'dictation') return null
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const sentence = ex.text.includes(' ')
  return (
    <div className="fade">
      <div className="prompt-sub">إملاء: استمع واكتب {sentence ? 'الجملة' : 'الكلمة'} كما تسمعها</div>
      <div className="row" style={{ justifyContent: 'center', gap: 16, margin: '12px 0' }}><Speaker text={ex.text} size="big" autoplay /><Speaker text={ex.text} slow /></div>
      {ex.word && <div className="center muted mb">{ex.word.ar}</div>}
      <input ref={ref} className="type-input en" dir="ltr" value={(value as string) || ''} disabled={!!result} placeholder={sentence ? 'Write the sentence...' : 'Write the word...'} autoCapitalize="off" autoCorrect="off" spellCheck={false}
        onChange={e => onChange(e.target.value, e.target.value.trim().length > 0)} />
      <div className="muted mt" style={{ fontSize: 13 }}>انتبه للتهجئة: الحروف الكبيرة والنقاط لا تُحسب.</div>
    </div>
  )
}

// ---------------- written translation, compared with the model ----------------
function TranslateView({ ex, value, onChange }: ExProps) {
  if (ex.kind !== 'translate') return null
  const [shown, setShown] = useState(false)
  useEffect(() => { onChange(value, false) }, []) // eslint-disable-line
  const toEn = ex.dir === 'ar2en'
  return (
    <div className="fade">
      <div className="prompt-sub">{toEn ? 'ترجم إلى الإنجليزية' : 'ترجم إلى العربية'} — اكتب ترجمتك ثم قارنها بالنموذج</div>
      <div className={`prompt ${toEn ? '' : 'en'}`} style={{ fontSize: 19 }}>{!toEn && <Speaker text={ex.source} size="sm" />} {ex.source}</div>
      <textarea className={`type-input ${toEn ? 'en' : ''}`} dir={toEn ? 'ltr' : 'rtl'} rows={3} value={(value as string) || ''} disabled={shown}
        placeholder={toEn ? 'Write your translation...' : 'اكتب ترجمتك...'} onChange={e => onChange(e.target.value, false)} style={{ fontSize: 16 }} />
      {!shown
        ? <button className="btn btn-blue btn-block mt" disabled={!String(value || '').trim()} onClick={() => { setShown(true); onChange(value, true) }}>قارن بالترجمة النموذجية</button>
        : (
          <div className="hint mt fade">
            <div className="muted" style={{ fontSize: 13 }}>الترجمة النموذجية:</div>
            <div className={toEn ? 'en' : ''} dir={toEn ? 'ltr' : 'rtl'} style={{ fontWeight: 700, fontSize: 17 }}>{toEn && <Speaker text={ex.model} size="sm" />} {ex.model}</div>
            <div className="muted mt" style={{ fontSize: 13 }}>ترجمتك صحيحة إذا أعطت المعنى نفسه بقواعد سليمة، حتى لو اختلفت الكلمات.</div>
          </div>
        )}
    </div>
  )
}

// ---------------- composition: plan, useful language, write, compare, self-assess ----------------
function words(s: string) { return s.trim() ? s.trim().split(/\s+/).length : 0 }
function ComposeView({ ex, value, onChange }: ExProps) {
  if (ex.kind !== 'compose') return null
  const c: Composition = ex.composition
  const [text, setText] = useState(typeof value === 'string' ? value : '')
  const [done, setDone] = useState(false)
  const [checks, setChecks] = useState<boolean[]>(() => c.checklistAr.map(() => false))
  const [step, setStep] = useState(0)
  useEffect(() => { onChange(text, false) }, []) // eslint-disable-line
  const n = words(text)
  return (
    <div className="fade compose">
      <div className="prompt-sub">موضوع إنشائي {c.source === 'workbook' ? '(من كتاب الأنشطة)' : '(من كتاب الطالب)'}</div>
      <div className="card" style={{ padding: 12 }}>
        <div className="en" style={{ fontWeight: 800 }}>{c.topic}</div>
        <div className="muted">{c.topicAr}</div>
        {c.points && <ul className="en" dir="ltr" style={{ textAlign: 'left', margin: '6px 0', paddingInlineStart: 20 }}>{c.points.map((p, i) => <li key={i}>{p}{c.pointsAr?.[i] && <div className="muted" dir="rtl" style={{ textAlign: 'right' }}>{c.pointsAr[i]}</div>}</li>)}</ul>}
        <div className="muted" style={{ fontSize: 13 }}>الطول المطلوب: {c.words} كلمة تقريباً</div>
      </div>
      <div className="row mt" style={{ gap: 6, flexWrap: 'wrap' }}>
        {['١ الخطة', '٢ عبارات مفيدة', '٣ اكتب'].map((t, i) => <button key={i} className={`pill ${step === i ? 'active' : ''}`} onClick={() => setStep(i)}>{t}</button>)}
      </div>
      {step === 0 && (
        <div className="mt">
          <div className="muted mb" style={{ fontSize: 13 }}>رتّب أفكارك هكذا، فقرة بعد فقرة:</div>
          <ol style={{ paddingInlineStart: 20 }}>{c.plan.map((p, i) => <li key={i} className="mb"><div>{p.ar}</div><div className="en muted" dir="ltr" style={{ textAlign: 'left' }}>{p.en}</div></li>)}</ol>
          <button className="btn btn-outline btn-block" onClick={() => setStep(1)}>التالي: عبارات مفيدة</button>
        </div>
      )}
      {step === 1 && (
        <div className="mt">
          <div className="muted mb" style={{ fontSize: 13 }}>كلمات وجمل من الدرس تستعملها في موضوعك:</div>
          {c.phrases.map((p, i) => <div key={i} className="row mb" style={{ alignItems: 'flex-start' }}><Speaker text={p.en} size="sm" /><div className="grow"><div className="en" dir="ltr" style={{ textAlign: 'left' }}>{p.en}</div><div className="muted">{p.ar}</div></div></div>)}
          <button className="btn btn-outline btn-block" onClick={() => setStep(2)}>التالي: اكتب موضوعك</button>
        </div>
      )}
      {step === 2 && (
        <div className="mt">
          <textarea className="type-input en" dir="ltr" rows={9} value={text} disabled={done} placeholder="Write your composition here..." onChange={e => { setText(e.target.value); onChange(e.target.value, false) }} style={{ fontSize: 16 }} />
          <div className={`muted ${n >= c.words ? 'ok-text' : ''}`} style={{ fontSize: 13 }}>{n} / {c.words} كلمة</div>
          {!done && <button className="btn btn-blue btn-block mt" disabled={n < 20} onClick={() => { setDone(true); onChange(text, true) }}>انتهيت: أرني الموضوع النموذجي</button>}
          {done && (
            <div className="fade mt">
              <div className="h2">الموضوع النموذجي</div>
              <div className="ppassage en" dir="ltr">{splitSentences(c.model).map((x, i) => <span key={i}>{x} </span>)}</div>
              <div className="sentence-ar">{c.modelAr}</div>
              <div className="h2 mt">قيّم موضوعك</div>
              {c.checklistAr.map((t, i) => (
                <label key={i} className="row check-row"><input type="checkbox" checked={checks[i]} onChange={e => setChecks(v => v.map((x, j) => (j === i ? e.target.checked : x)))} /><span>{t}</span></label>
              ))}
              <div className="muted" style={{ fontSize: 13 }}>حققتَ {checks.filter(Boolean).length} من {checks.length}. {n < c.words ? `أضف ${c.words - n} كلمة على الأقل لتصل إلى الطول المطلوب.` : 'الطول مناسب.'}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Exam, ExamQuestion, ExamSection } from '../engine/types'
import { sfx } from '../engine/audio'

type Answer = number | boolean
interface Props {
  exam: Exam
  onClose: () => void
  onScore: (score: number, firstSubmit: boolean) => void
}

const LETTERS = ['a', 'b', 'c', 'd']
const WRITING_LENGTH_MARKS = 8

/** Text with {underlined} parts, as the paper prints them. */
function Marked({ text, onPart, part, state }: { text: string; onPart?: (i: number) => void; part?: number; state?: (i: number) => '' | 'ok' | 'bad' }) {
  const out: React.ReactNode[] = []
  let i = 0, last = 0, k = 0
  const re = /\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<span key={k++}>{text.slice(last, m.index)}</span>)
    const idx = i++
    if (onPart) {
      const st = state?.(idx) || ''
      out.push(
        <button key={k++} className={`wp ${part === idx ? 'wp-sel' : ''} ${st}`} onClick={() => onPart(idx)}>
          <u>{m[1]}</u> <b>({LETTERS[idx]})</b>
        </button>,
      )
    } else out.push(<u key={k++}>{m[1]}</u>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(<span key={k++}>{text.slice(last)}</span>)
  return <>{out}</>
}

function words(s: string) { return s.trim() ? s.trim().split(/\s+/).length : 0 }

function isRight(q: ExamQuestion, a: Answer | undefined) { return a !== undefined && a === q.answer }

export default function ExamPaper({ exam, onClose, onScore }: Props) {
  const questions = useMemo(() => exam.sections.flatMap(s => s.questions || []), [exam])
  const writing = exam.sections.find(s => s.writing)
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [checks, setChecks] = useState<boolean[]>(() => (writing?.writing?.checklistAr || []).map(() => false))
  const [left, setLeft] = useState(exam.minutes * 60)
  const [confirm, setConfirm] = useState<'submit' | 'exit' | null>(null)
  const [timeUp, setTimeUp] = useState(false)
  const [showAr, setShowAr] = useState(false)
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (submitted) return
    const t = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [submitted])
  useEffect(() => { if (left === 0 && !submitted) { setTimeUp(true); submit() } }, [left]) // eslint-disable-line

  const perQuestion = (s: ExamSection) => s.marks / Math.max(1, s.questions?.length || 1)
  const sectionScore = (s: ExamSection) => {
    if (s.writing) {
      const w = s.writing
      const len = Math.round(Math.min(1, words(text) / w.words) * WRITING_LENGTH_MARKS)
      const perCheck = (s.marks - WRITING_LENGTH_MARKS) / Math.max(1, w.checklistAr.length)
      return len + Math.round(checks.filter(Boolean).length * perCheck)
    }
    return (s.questions || []).reduce((a, q) => a + (isRight(q, answers[q.n]) ? perQuestion(s) : 0), 0)
  }
  const total = Math.round(exam.sections.reduce((a, s) => a + sectionScore(s), 0))
  const answered = questions.filter(q => answers[q.n] !== undefined).length

  // the score counts the self-assessed paragraph too, so it is saved again when the checklist changes
  useEffect(() => { if (submitted) onScore(total, false) }, [checks]) // eslint-disable-line

  function submit() {
    setConfirm(null)
    setSubmitted(true)
    sfx.complete()
    onScore(total, true)
    setTimeout(() => top.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const set = (n: number, a: Answer) => { if (!submitted) { sfx.tap(); setAnswers(x => ({ ...x, [n]: a })) } }
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0')
  const pct = Math.round((total / exam.totalMarks) * 100)

  return (
    <div className="exam">
      <div className="exam-bar">
        <button onClick={() => (submitted ? onClose() : setConfirm('exit'))} aria-label="خروج" style={{ fontSize: 22, color: 'var(--gray-4)' }}>✕</button>
        <div className="grow" style={{ fontWeight: 800, fontSize: 14 }}>{exam.titleAr}</div>
        {!submitted && <div className={`timer ${left < 300 ? 'low' : ''}`}>⏱ {mm}:{ss}</div>}
        {!submitted && <div className="muted" style={{ fontSize: 13 }}>{answered}/{questions.length}</div>}
      </div>

      <div className="exam-body" ref={top}>
        {submitted && (
          <div className="card result fade">
            {timeUp && <div className="hint mb">⏰ انتهى الوقت، وسُلّمت الورقة تلقائياً.</div>}
            <div className="row spread">
              <div>
                <div className="muted">علامتك</div>
                <div className="score"><b>{total}</b> / {exam.totalMarks}</div>
              </div>
              <div className="goal-ring" style={{ background: `conic-gradient(${pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)'} ${pct * 3.6}deg, var(--gray-2) 0)` }}><span>{pct}%</span></div>
            </div>
            <table className="marks">
              <tbody>
                {exam.sections.map(s => (
                  <tr key={s.letter}><td>{s.letter}</td><td>{s.titleAr.replace(/:$/, '')}</td><td className="en">{Math.round(sectionScore(s))} / {s.marks}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 13 }}>راجع الأسئلة في الأسفل: الإجابة الصحيحة وسببها بالعربية تحت كل سؤال. علامة الفقرة (F) تقييم ذاتي: قارن فقرتك بالنموذج وضع إشارة على ما حققته.</p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-blue btn-sm" onClick={() => setShowAr(v => !v)}>{showAr ? 'إخفاء ترجمة النصوص' : 'ترجمة النصوص بالعربية'}</button>
            </div>
          </div>
        )}

        <div className="paper">
          <div className="paper-head en">
            <div><b>Time:</b> {exam.minutes} minutes<br /><b>Marks:</b> {exam.totalMarks}<br /><b>English</b></div>
            <div className="center"><b>TEST</b><br /><b>TERM {exam.term}</b><br /><b>({exam.id.split('-')[1]?.toUpperCase()})</b></div>
            <div style={{ textAlign: 'right' }}><b>Grade: 8</b></div>
          </div>
          {exam.real && <div className="real-badge">📄 نموذج امتحان حقيقي سابق</div>}

          {exam.sections.map(s => (
            <section key={s.letter} className="psec">
              <div className="psec-title en">
                <span><b>{s.letter}- </b><u><b>{s.title}</b></u></span>
                <span className="psec-marks">({s.marks} marks)</span>
              </div>
              <div className="psec-ar">{s.titleAr}</div>

              {s.passage && (
                <div className="ppassage en">
                  {s.passage.paragraphs.map((p, i) => (
                    <div key={i}>
                      <p><Marked text={p} /></p>
                      {submitted && showAr && <p className="p-ar">{s.passage!.paragraphsAr[i]}</p>}
                    </div>
                  ))}
                </div>
              )}

              {(s.questions || []).map(q => (
                <Question key={q.n} q={q} a={answers[q.n]} submitted={submitted} onAnswer={a => set(q.n, a)} />
              ))}

              {s.writing && (
                <div className="pq">
                  <div className="center en" style={{ fontWeight: 800, fontSize: 18, margin: '6px 0' }}>“{s.writing.topic}”</div>
                  <div className="center muted">{s.writing.topicAr}</div>
                  <textarea className="type-input en" dir="ltr" rows={7} value={text} disabled={submitted} placeholder="Write your paragraph here..." onChange={e => setText(e.target.value)} style={{ fontSize: 16, marginTop: 8 }} />
                  <div className={`muted ${words(text) >= s.writing.words ? 'ok-text' : ''}`} style={{ fontSize: 13 }}>{words(text)} / {s.writing.words} كلمة</div>
                  {submitted && (
                    <div className="fade">
                      <div className="h2 mt">فقرة نموذجية</div>
                      <div className="ppassage en"><p>{s.writing.model}</p><p className="p-ar">{s.writing.modelAr}</p></div>
                      <div className="h2 mt">قيّم فقرتك (تقييم ذاتي)</div>
                      <div className="muted" style={{ fontSize: 13 }}>الطول: {Math.round(Math.min(1, words(text) / s.writing.words) * WRITING_LENGTH_MARKS)} / {WRITING_LENGTH_MARKS}</div>
                      {s.writing.checklistAr.map((c, i) => (
                        <label key={i} className="row check-row">
                          <input type="checkbox" checked={checks[i]} onChange={e => setChecks(v => v.map((x, j) => (j === i ? e.target.checked : x)))} />
                          <span>{c}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

      {!submitted && (
        <div className="lesson-foot">
          <button className="btn btn-primary btn-block" onClick={() => (answered < questions.length ? setConfirm('submit') : submit())}>تسليم الورقة</button>
        </div>
      )}

      {confirm && (
        <div className="hearts-modal" onClick={() => setConfirm(null)}>
          <div className="card" onClick={e => e.stopPropagation()}>
            {confirm === 'submit' ? (
              <>
                <div style={{ fontSize: 44 }}>📝</div>
                <div className="h2">هل تريد تسليم الورقة؟</div>
                <p className="muted">أجبت عن {answered} من {questions.length} سؤالاً. الأسئلة المتروكة تُحسب خاطئة.</p>
                <button className="btn btn-primary btn-block mb" onClick={() => setConfirm(null)}>أكمل الإجابة</button>
                <button className="btn btn-outline btn-block" onClick={submit}>سلّم الآن</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 44 }}>🚪</div>
                <div className="h2">الخروج من الامتحان؟</div>
                <p className="muted">لن تُحفظ إجاباتك.</p>
                <button className="btn btn-primary btn-block mb" onClick={() => setConfirm(null)}>أكمل الامتحان</button>
                <button className="btn btn-red btn-block" onClick={onClose}>خروج</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Question({ q, a, submitted, onAnswer }: { q: ExamQuestion; a: Answer | undefined; submitted: boolean; onAnswer: (a: Answer) => void }) {
  const right = isRight(q, a)
  const optClass = (i: number | boolean) => {
    if (!submitted) return a === i ? 'popt sel' : 'popt'
    if (i === q.answer) return 'popt ok'
    if (a === i) return 'popt bad'
    return 'popt'
  }
  return (
    <div className={`pq ${submitted ? (right ? 'pq-ok' : 'pq-bad') : ''}`}>
      <div className="pq-prompt en">
        <b>{q.n}. </b>
        {q.kind === 'wrongpart'
          ? <Marked text={q.prompt} onPart={i => onAnswer(i)} part={typeof a === 'number' ? a : undefined} state={i => (!submitted ? '' : i === q.answer ? 'ok' : a === i ? 'bad' : '')} />
          : <Marked text={q.prompt} />}
      </div>
      {q.kind === 'truefalse' && (
        <div className="grid2">
          <button className={optClass(true)} onClick={() => onAnswer(true)}>True</button>
          <button className={optClass(false)} onClick={() => onAnswer(false)}>False</button>
        </div>
      )}
      {(q.kind === 'mcq' || q.kind === 'ask') && (
        <div className="popts">
          {q.options!.map((o, i) => (
            <button key={i} className={optClass(i)} onClick={() => onAnswer(i)}><b>{LETTERS[i]})</b> {o}</button>
          ))}
        </div>
      )}
      {q.kind === 'ask' && !submitted && <div className="muted" style={{ fontSize: 12 }}>اختر السؤال الصحيح عن الجزء المسطَّر.</div>}
      {submitted && (
        <div className="pq-fb fade">
          <div><b>{right ? '✅ صحيح' : a === undefined ? '⚪ لم تُجب' : '❌ خطأ'}</b>{!right && <> — الإجابة الصحيحة: <b className="en">{answerText(q)}</b></>}</div>
          {q.promptAr && <div className="sentence-ar" style={{ margin: '6px 0' }}>{q.promptAr}</div>}
          <div>💡 {q.explainAr}</div>
        </div>
      )}
    </div>
  )
}

function answerText(q: ExamQuestion): string {
  if (q.kind === 'truefalse') return q.answer ? 'True' : 'False'
  if (q.kind === 'wrongpart') {
    const parts = [...q.prompt.matchAll(/\{([^}]+)\}/g)].map(m => m[1])
    return `(${LETTERS[q.answer as number]}) ${parts[q.answer as number] || ''}`
  }
  return `${LETTERS[q.answer as number]}) ${q.options?.[q.answer as number] || ''}`
}

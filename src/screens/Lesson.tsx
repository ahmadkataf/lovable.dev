import { useEffect, useMemo, useState } from 'react'
import type { Exercise, Lesson } from '../engine/types'
import { ExerciseView, correctAnswerText, judge, needsHearts, wordOf, type Result } from '../components/Exercises'
import { Confetti, Hearts, ProgressBar, Speaker, SpeedButton } from '../components/common'
import { sfx, stopSpeaking } from '../engine/audio'

export interface LessonOutcome { correct: number; wrong: number; xp: number; wordResults: { en: string; correct: boolean }[] }

interface Props {
  lesson: Lesson | null           // null => practice session
  source?: string                 // which book and pages the lesson comes from
  exercises: Exercise[]
  hearts: number
  autoSpeak: boolean
  speechRate: number
  onSpeechRate: (rate: number) => void
  onLoseHeart: () => void
  onFinish: (o: LessonOutcome) => void
  onQuit: () => void
  onRefill: () => void
}

export default function LessonScreen({ lesson, source, exercises, hearts, autoSpeak, speechRate, onSpeechRate, onLoseHeart, onFinish, onQuit, onRefill }: Props) {
  const [queue, setQueue] = useState<Exercise[]>(exercises)
  const [pos, setPos] = useState(0)
  const [value, setValue] = useState<unknown>(undefined)
  const [ready, setReady] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const [stats, setStats] = useState({ correct: 0, wrong: 0 })
  const [wordResults, setWordResults] = useState<{ en: string; correct: boolean }[]>([])
  const [finished, setFinished] = useState(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [key, setKey] = useState(0)
  const ex = queue[pos]
  const progress = useMemo(() => Math.min(1, pos / Math.max(1, queue.length)), [pos, queue.length])

  useEffect(() => () => stopSpeaking(), [])
  // optional debug hook for automated UI tests (enabled only when localStorage has emar8.debug)
  useEffect(() => {
    try {
      if (ex && localStorage.getItem('emar8.debug')) {
        const w: any = window
        w.__emarEx = { kind: ex.kind, answer: 'answer' in ex ? ex.answer : ex.kind === 'read' ? ex.question.answer : undefined, text: correctAnswerText(ex), tiles: ex.kind === 'build' ? ex.tiles : undefined, target: ex.kind === 'build' ? ex.target : undefined }
      }
    } catch { /* ignore */ }
  }, [ex])

  if (!ex && !finished) { setFinished(true) }

  const outOfHearts = hearts <= 0 && lesson !== null

  const check = () => {
    if (result) return
    const ok = judge(ex, value)
    setResult(ok ? 'correct' : 'wrong')
    if (ok) sfx.correct(); else sfx.wrong()
    if (needsHearts(ex)) {
      setStats(s => ({ correct: s.correct + (ok ? 1 : 0), wrong: s.wrong + (ok ? 0 : 1) }))
      const w = wordOf(ex)
      if (w) setWordResults(r => [...r, { en: w.en, correct: ok }])
      if (!ok) {
        onLoseHeart()
        // re-queue the missed exercise near the end
        setQueue(q => [...q, ex])
      }
    }
  }

  const next = () => {
    stopSpeaking()
    setResult(null); setValue(undefined); setReady(false); setKey(k => k + 1)
    if (pos + 1 >= queue.length) { setFinished(true); sfx.complete() } else setPos(pos + 1)
  }

  if (finished) {
    const answered = stats.correct + stats.wrong
    const acc = answered ? stats.correct / answered : 1
    const baseXp = lesson?.xp ?? 10
    const bonus = acc >= 0.95 ? 5 : 0
    const xp = baseXp + bonus
    return (
      <div className="lesson complete">
        <Confetti />
        <div className="big">{acc >= 0.9 ? '🏆' : acc >= 0.7 ? '🎉' : '💪'}</div>
        <div className="title">{acc >= 0.9 ? 'ممتاز! درس مكتمل' : acc >= 0.7 ? 'أحسنت! درس مكتمل' : 'أكملت الدرس، واصل التدريب'}</div>
        <div className="badges">
          <div className="badge"><div className="bh">XP المكتسب</div><div className="bv">+{xp}</div></div>
          <div className="badge g"><div className="bh">الدقة</div><div className="bv">{Math.round(acc * 100)}%</div></div>
          <div className="badge b"><div className="bh">إجابات</div><div className="bv">{stats.correct}/{answered}</div></div>
        </div>
        {bonus > 0 && <div className="hint">🎯 مكافأة الدقة +{bonus} XP</div>}
        <button className="btn btn-primary btn-block btn-lg mt" onClick={() => onFinish({ correct: stats.correct, wrong: stats.wrong, xp, wordResults })}>متابعة</button>
      </div>
    )
  }

  return (
    <div className="lesson">
      <div className="lesson-top">
        <button onClick={() => setConfirmQuit(true)} style={{ fontSize: 22, color: 'var(--gray-4)' }} aria-label="خروج">✕</button>
        <ProgressBar value={progress} />
        <SpeedButton rate={speechRate} onChange={onSpeechRate} />
        {lesson && <Hearts n={hearts} />}
      </div>
      {source && <div className="lesson-source">{source} · {lesson?.title}</div>}
      <div className="lesson-body" key={key}>
        <ExerciseView ex={ex} value={value} onChange={(v, r) => { setValue(v); setReady(r) }} result={result} autoSpeak={autoSpeak} />
      </div>
      <div className={`lesson-foot ${result === 'correct' ? 'ok' : result === 'wrong' ? 'bad' : ''}`}>
        {result === null ? (
          needsHearts(ex) || ex.kind === 'match'
            ? <div className="row"><button className="btn btn-outline" onClick={() => { if (needsHearts(ex)) { setValue(-1); setResult('wrong'); sfx.wrong(); onLoseHeart(); setQueue(q => [...q, ex]); setStats(s => ({ ...s, wrong: s.wrong + 1 })) } }} style={{ visibility: ex.kind === 'match' ? 'hidden' : 'visible' }}>تخطّي</button><button className="btn btn-primary grow" disabled={!ready} onClick={check}>تحقّق</button></div>
            : <button className="btn btn-primary btn-block" disabled={ex.kind === 'translate' && !ready} onClick={next}>{ex.kind === 'compose' && !ready ? 'تخطّي الكتابة الآن' : 'متابعة'}</button>
        ) : (
          <div>
            <div className="fb-title">{result === 'correct' ? '✅ صحيح! أحسنت' : '❌ إجابة خاطئة'}</div>
            {result === 'wrong' && <div className="fb-body">الإجابة الصحيحة: <b className="en" style={{ fontSize: 17 }}>{correctAnswerText(ex)}</b> {correctAnswerText(ex) && <Speaker text={correctAnswerText(ex).replace(/[✔✘]/g, '')} size="sm" />}</div>}
            {'explainAr' in ex && ex.explainAr && <div className="fb-body">💡 {ex.explainAr}</div>}
            {ex.kind === 'read' && ex.question.explainAr && <div className="fb-body">💡 {ex.question.explainAr}</div>}
            {result === 'correct' && wordOf(ex) && <div className="fb-body"><span className="en"><b>{wordOf(ex)!.en}</b></span> = {wordOf(ex)!.ar}</div>}
            <button className="btn btn-primary btn-block" onClick={next}>متابعة</button>
          </div>
        )}
      </div>

      {confirmQuit && (
        <div className="hearts-modal" onClick={() => setConfirmQuit(false)}>
          <div className="card" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 48 }}>😢</div>
            <div className="h2">هل تريد الخروج؟</div>
            <p className="muted">ستفقد تقدّمك في هذا الدرس.</p>
            <button className="btn btn-primary btn-block mb" onClick={() => setConfirmQuit(false)}>أكمل التعلّم</button>
            <button className="btn btn-red btn-block" onClick={onQuit}>خروج</button>
          </div>
        </div>
      )}

      {outOfHearts && result !== 'wrong' && (
        <div className="hearts-modal">
          <div className="card">
            <div style={{ fontSize: 48 }}>💔</div>
            <div className="h2">نفدت القلوب!</div>
            <p className="muted">تتجدد القلوب مع الوقت (قلب كل 10 دقائق)، أو تدرّب على الكلمات لاستعادتها.</p>
            <button className="btn btn-blue btn-block mb" onClick={onRefill}>🔄 استعادة القلوب بالتدريب</button>
            <button className="btn btn-outline btn-block" onClick={onQuit}>خروج</button>
          </div>
        </div>
      )}
    </div>
  )
}


import { useEffect, useMemo, useState } from 'react'
import { book, exams, modules } from './data'
import type { Exam, Exercise, Lesson } from './engine/types'
import { addXp, completeLesson, recordExam, load, loseHeart, nextHeartIn, recordWord, refillHearts, regenHearts, save, touchStreak, type Progress } from './engine/progress'
import { buildGrammarPractice, buildLesson, buildMockExam, buildPractice, lessonsForUnit, progressTestLesson, reviewLesson, sourceLabel } from './engine/generator'
import Home, { unlockedState } from './screens/Home'
import Words from './screens/Words'
import Book from './screens/Book'
import Profile from './screens/Profile'
import LessonScreen, { type LessonOutcome } from './screens/Lesson'
import Exams from './screens/Exams'
import ExamPaper from './screens/ExamPaper'
import { preload, preloadIndex, setMuted } from './engine/audio'
import { freeExam, freeLesson, keepLicense, useAccess } from './engine/access'
import Activate from './screens/Activate'

type Tab = 'home' | 'words' | 'exams' | 'book' | 'profile'

export default function App() {
  const [progress, setProgress] = useState<Progress>(() => touchStreak(load()))
  const [tab, setTab] = useState<Tab>('home')
  const [active, setActive] = useState<{ lesson: Lesson | null; exercises: Exercise[]; source?: string } | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [, tick] = useState(0)
  const access = useAccess()
  const [paywall, setPaywall] = useState(false)
  const openPaywall = () => { window.scrollTo(0, 0); setPaywall(true) }

  useEffect(() => save(progress), [progress])
  useEffect(() => { const t = setInterval(() => { setProgress(p => regenHearts(p)); tick(x => x + 1) }, 30000); return () => clearInterval(t) }, [])
  useEffect(() => { setMuted(!progress.sound) }, [progress.sound])
  useEffect(() => { preloadIndex() }, [])

  const { unlockedUnits } = useMemo(() => unlockedState(modules, progress), [progress])
  const totalLessons = modules.reduce((a, m) => a + m.units.reduce((n, u) => n + lessonsForUnit(u).length, 0) + 1 + (reviewLesson(m) ? 1 : 0) + (progressTestLesson(m) ? 1 : 0), 0)

  const startLesson = (lesson: Lesson) => {
    if (!access.pro && !freeLesson(lesson, modules)) { openPaywall(); return }
    if (progress.hearts <= 0) { alert(`لا توجد قلوب! القلب التالي بعد ${Math.ceil(nextHeartIn(progress) / 60000)} دقيقة. تدرّب على الكلمات لاستعادة القلوب.`); setTab('words'); return }
    const unit = modules.flatMap(m => m.units).find(u => u.id === lesson.unitId)!
    const mod = modules.find(m => m.units.includes(unit))!
    preload(unit.id)
    setActive({ lesson, exercises: buildLesson(lesson, unit, mod, progress), source: sourceLabel(lesson, unit, mod) })
  }
  const startGrammar = (unitId: string, which: 'grammar' | 'vocabFocus' | 'everyday' = 'grammar') => {
    const unit = modules.flatMap(m => m.units).find(u => u.id === unitId)
    if (!unit) return
    preload(unit.id)
    setActive({ lesson: null, exercises: buildGrammarPractice(unit, which) })
  }
  const startMockExam = () => {
    const ex = buildMockExam(modules, unlockedUnits)
    if (ex.length === 0) return
    unlockedUnits.forEach(id => preload(id))
    setActive({ lesson: null, exercises: ex })
  }
  const startPractice = () => {
    const ex = buildPractice(modules, progress, unlockedUnits)
    if (ex.length === 0) return
    unlockedUnits.forEach(id => preload(id))
    setActive({ lesson: null, exercises: ex })
  }

  const finish = (o: LessonOutcome) => {
    setProgress(p => {
      let n = addXp(p, o.xp)
      for (const r of o.wordResults) n = recordWord(n, r.en, r.correct)
      if (active?.lesson) {
        const answered = o.correct + o.wrong
        const acc = answered ? o.correct / answered : 1
        const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1
        n = completeLesson(n, active.lesson.id, stars, Math.round(acc * 100))
      } else {
        n = refillHearts(n) // practice restores hearts
      }
      return n
    })
    setActive(null)
    setTab(active?.lesson ? 'home' : 'words')
  }

  if (exam) {
    return (
      <div className="app" style={{ paddingBottom: 0 }}>
        <ExamPaper
          key={exam.id}
          exam={exam}
          onClose={() => setExam(null)}
          onScore={(score, first) => setProgress(p => {
            let n = recordExam(p, exam.id, score, first)
            // a finished paper counts as a day of study, once
            if (first) n = addXp(n, Math.round(score / 20))
            return n
          })}
        />
      </div>
    )
  }

  if (paywall) return <div className="app" style={{ paddingBottom: 0 }}><Activate access={access} onClose={() => setPaywall(false)} /></div>

  if (active) {
    return (
      <div className="app" style={{ paddingBottom: 0 }}>
        <LessonScreen
          key={active.lesson?.id || 'practice'}
          lesson={active.lesson}
          source={active.source}
          exercises={active.exercises}
          hearts={progress.hearts}
          autoSpeak={progress.autoSpeak}
          onLoseHeart={() => { if (active.lesson) setProgress(p => loseHeart(p)) }}
          onFinish={finish}
          onQuit={() => setActive(null)}
          onRefill={() => { setActive(null); startPractice() }}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="stat fire">🔥 {progress.streak}</div>
        <div className="stat gem">💎 {progress.xp}</div>
        <div className="stat heart">❤️ {progress.hearts}</div>
        {access.pro
          ? <div className="muted" style={{ fontWeight: 800 }}>{progress.name ? `مرحباً ${progress.name}` : book.title}</div>
          : <button className="unlock-btn" onClick={openPaywall}>🔑 فعّل</button>}
      </div>
      {tab === 'home' && <Home modules={modules} progress={progress} onStart={startLesson} hasExams={exams.length > 0} pro={access.pro} />}
      {tab === 'words' && <Words modules={modules} progress={progress} unlocked={unlockedUnits} onPractice={startPractice} onMockExam={exams.length ? undefined : startMockExam} />}
      {tab === 'exams' && <Exams exams={exams} progress={progress} onStart={e => { if (!access.pro && !freeExam(e, exams)) { openPaywall(); return } window.scrollTo(0, 0); setExam(e) }} onMockExam={startMockExam} canMock={unlockedUnits.size > 0} locked={e => !access.pro && !freeExam(e, exams)} />}
      {tab === 'book' && <Book modules={modules} onGrammarPractice={startGrammar} pro={access.pro} onLocked={openPaywall} />}
      {tab === 'profile' && <Profile progress={progress} totalLessons={totalLessons} subtitle={book.subtitle} onChange={setProgress} onReset={() => { keepLicense(() => localStorage.clear()); location.reload() }} access={access} onActivate={openPaywall} />}
      <nav className="tabbar">
        {([['home', '🏠', 'تعلّم'], ['words', '📚', 'الكلمات'], ...(exams.length ? [['exams', '📝', 'امتحانات']] : []), ['book', '📖', 'الكتاب'], ['profile', '👤', 'ملفّي']] as [Tab, string, string][]).map(([t, ic, l]) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}><span className="ic">{ic}</span>{l}</button>
        ))}
      </nav>
    </div>
  )
}

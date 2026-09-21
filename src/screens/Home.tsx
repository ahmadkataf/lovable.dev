import { useMemo } from 'react'
import type { Lesson, Module } from '../engine/types'
import type { Progress } from '../engine/progress'
import { bossLesson, lessonsForUnit, reviewLesson } from '../engine/generator'

interface Props { modules: Module[]; progress: Progress; onStart: (lesson: Lesson) => void }

export function unlockedState(modules: Module[], progress: Progress) {
  // sequential unlock: a lesson is open if the previous lesson (in global order) is completed
  const order: Lesson[] = []
  for (const m of modules) {
    for (const u of m.units) order.push(...lessonsForUnit(u))
    order.push(bossLesson(m))
    const r = reviewLesson(m)
    if (r) order.push(r)
  }
  const status = new Map<string, 'done' | 'open' | 'locked'>()
  let openGiven = false
  for (const l of order) {
    const done = !!progress.lessons[l.id]
    if (done) status.set(l.id, 'done')
    else if (!openGiven) { status.set(l.id, 'open'); openGiven = true }
    else status.set(l.id, 'locked')
  }
  const unlockedUnits = new Set<string>()
  for (const l of order) if (status.get(l.id) !== 'locked') unlockedUnits.add(l.unitId)
  return { order, status, unlockedUnits }
}

export default function Home({ modules, progress, onStart }: Props) {
  const { status } = useMemo(() => unlockedState(modules, progress), [modules, progress])
  const offsets = [0, 40, 70, 40, 0, -40, -70, -40]
  return (
    <div className="page">
      {modules.map(m => (
        <div key={m.number}>
          <div className="module-head" style={{ background: m.color }}>
            <div className="sub">الوحدة {m.number} · {m.titleAr}</div>
            <div className="title">Module {m.number}: {m.title}</div>
          </div>
          {m.units.map(u => {
            const lessons = lessonsForUnit(u)
            const doneCount = lessons.filter(l => status.get(l.id) === 'done').length
            return (
              <div className="unit-block" key={u.id}>
                <div className="unit-title">
                  <span className="em">{u.emoji}</span>
                  <div>
                    <div className="t">Unit {u.number}: {u.title} <span className="muted">· {u.titleAr}</span></div>
                    <div className="s">صفحات {u.pages} · {doneCount}/{lessons.length} دروس · {u.vocab.length} كلمة</div>
                  </div>
                </div>
                <div className="path">
                  {lessons.map((l, i) => <Node key={l.id} lesson={l} st={status.get(l.id)!} stars={progress.lessons[l.id]?.stars} onStart={onStart} offset={offsets[i % offsets.length]} />)}
                </div>
              </div>
            )
          })}
          <div className="path" style={{ marginBottom: 24 }}>
            <Node lesson={bossLesson(m)} st={status.get(bossLesson(m).id)!} stars={progress.lessons[bossLesson(m).id]?.stars} onStart={onStart} offset={0} boss />
            {(() => { const r = reviewLesson(m); return r ? <Node lesson={r} st={status.get(r.id)!} stars={progress.lessons[r.id]?.stars} onStart={onStart} offset={0} boss /> : null })()}
          </div>
        </div>
      ))}
      <div className="card center mt">
        <div style={{ fontSize: 40 }}>🎓</div>
        <div className="h2">أنهيت الكتاب كاملاً؟</div>
        <p className="muted">تابع التدريب اليومي من تبويب «الكلمات» لتثبيت ما حفظته.</p>
      </div>
    </div>
  )
}

function Node({ lesson, st, stars, onStart, offset, boss }: { lesson: Lesson; st: 'done' | 'open' | 'locked'; stars?: number; onStart: (l: Lesson) => void; offset: number; boss?: boolean }) {
  return (
    <div className="node-wrap" style={{ transform: `translateX(${offset}px)` }}>
      {st === 'open' && <div className="start-bubble">ابدأ</div>}
      <button className={`node ${st} ${boss ? 'boss' : ''}`} disabled={st === 'locked'} onClick={() => onStart(lesson)} aria-label={lesson.title}>
        {st === 'locked' ? '🔒' : st === 'done' ? (boss ? '👑' : '⭐') : lesson.icon}
      </button>
      <div className="node-label">{lesson.title}</div>
      {st === 'done' && <div className="stars">{'★'.repeat(stars || 1)}{'☆'.repeat(3 - (stars || 1))}</div>}
    </div>
  )
}

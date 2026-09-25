import { useMemo, useState } from 'react'
import type { Lesson, Module, Unit } from '../engine/types'
import type { Progress } from '../engine/progress'
import { SOURCE_NAME, bossLesson, lessonSource, lessonsForUnit, progressTestLesson, reviewLesson, type LessonSource } from '../engine/generator'
import meta from '@book-meta'

interface Props { modules: Module[]; progress: Progress; onStart: (lesson: Lesson) => void; hasExams?: boolean }

export function unlockedState(modules: Module[], progress: Progress) {
  // sequential unlock: a lesson is open if the previous lesson (in global order) is completed
  const order: Lesson[] = []
  for (const m of modules) {
    for (const u of m.units) order.push(...lessonsForUnit(u))
    order.push(bossLesson(m))
    const r = reviewLesson(m)
    if (r) order.push(r)
    const t = progressTestLesson(m)
    if (t) order.push(t)
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

const GUIDE_KEY = `${meta.storageKey}.guideSeen`
function guideSeen(): boolean { try { return !!localStorage.getItem(GUIDE_KEY) } catch { return true } }

/** A unit that has Activity Book or exam-skill lessons shows its lessons grouped by where they come from. */
function hasSources(u: Unit): boolean { return !!(u.workbook || u.compositions?.length || u.translations?.length) }

const GROUP_NOTE: Record<LessonSource, (u: Unit) => string> = {
  book: u => `دروس كتاب الطالب${u.pages ? ` · صفحات ${u.pages}` : ''}`,
  workbook: u => `تمارين كتاب الأنشطة محلولة${u.workbook?.pages ? ` · صفحات ${u.workbook.pages}` : ''}`,
  skills: () => 'الترجمة والإنشاء وتركيب الجمل ومراجعة الوحدة',
  test: () => '',
}

export default function Home({ modules, progress, onStart, hasExams }: Props) {
  const { status } = useMemo(() => unlockedState(modules, progress), [modules, progress])
  const offsets = [0, 40, 70, 40, 0, -40, -70, -40]
  const withWorkbook = modules.some(m => m.units.some(u => u.workbook))
  const [guide, setGuide] = useState(() => withWorkbook && !guideSeen())
  const closeGuide = () => { setGuide(false); try { localStorage.setItem(GUIDE_KEY, '1') } catch { /* ignore */ } }
  return (
    <div className="page">
      {withWorkbook && !guide && <button className="guide-link" onClick={() => setGuide(true)}>❓ كيف أستخدم التطبيق؟</button>}
      {guide && (
        <div className="card guide fade">
          <div className="h2">👋 أهلاً! هكذا يعمل التطبيق</div>
          <p className="muted">كل وحدة في المسار مقسومة إلى ثلاثة أقسام بألوان مختلفة، ادرسها بالترتيب:</p>
          <div className="guide-row src-book"><b>{SOURCE_NAME.book}</b><span>الكتاب المدرسي نفسه: الكلمات، نص القراءة، القواعد، المفردات، اللفظ والحوار. رقم الصفحة مكتوب فوق كل قسم.</span></div>
          <div className="guide-row src-workbook"><b>{SOURCE_NAME.workbook}</b><span>كتاب التمارين (Activity Book): نصوصه وكل تمارينه محلولة مع الشرح، واختبارات التقدّم.</span></div>
          <div className="guide-row src-skills"><b>{SOURCE_NAME.skills}</b><span>الترجمة، والإنشاء خطوة بخطوة، وتركيب الجمل، ومراجعة الوحدة.</span></div>
          {hasExams && <div className="guide-row"><b>📝 امتحانات</b><span>من الشريط في الأسفل: نماذج بشكل الامتحان النهائي تماماً، مع التصحيح.</span></div>}
          <div className="guide-row"><b>📖 الكتاب</b><span>من الشريط في الأسفل: نصوص الكتابين كاملة مع الصوت والترجمة، للمراجعة في أي وقت.</span></div>
          <p className="muted" style={{ fontSize: 13 }}>في أعلى كل درس ستجد سطراً يقول من أي كتاب هو ومن أي صفحات.</p>
          <button className="btn btn-primary btn-block" onClick={closeGuide}>فهمت، لنبدأ</button>
        </div>
      )}
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
                {!hasSources(u) ? (
                  <div className="path">
                    {lessons.map((l, i) => <Node key={l.id} lesson={l} st={status.get(l.id)!} stars={progress.lessons[l.id]?.stars} onStart={onStart} offset={offsets[i % offsets.length]} />)}
                  </div>
                ) : (
                  (['book', 'workbook', 'skills'] as LessonSource[]).map(src => {
                    const group = lessons.filter(l => lessonSource(l) === src)
                    if (!group.length) return null
                    return (
                      <div key={src} className={`src-group src-${src}`}>
                        <div className="src-head"><b>{SOURCE_NAME[src]}</b><span>{GROUP_NOTE[src](u)}</span></div>
                        <div className="path">
                          {group.map(l => <Node key={l.id} lesson={l} st={status.get(l.id)!} stars={progress.lessons[l.id]?.stars} onStart={onStart} offset={offsets[l.index % offsets.length]} src={src} />)}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
          <div className="path" style={{ marginBottom: 24 }}>
            <Node lesson={bossLesson(m)} st={status.get(bossLesson(m).id)!} stars={progress.lessons[bossLesson(m).id]?.stars} onStart={onStart} offset={0} boss />
            {(() => { const r = reviewLesson(m); return r ? <Node lesson={r} st={status.get(r.id)!} stars={progress.lessons[r.id]?.stars} onStart={onStart} offset={0} boss /> : null })()}
            {(() => { const t = progressTestLesson(m); return t ? <div className="src-group src-workbook" style={{ width: '100%' }}><div className="src-head"><b>{SOURCE_NAME.workbook}</b><span>{m.progressTest!.title} · صفحات {m.progressTest!.pages}</span></div><div className="path"><Node lesson={t} st={status.get(t.id)!} stars={progress.lessons[t.id]?.stars} onStart={onStart} offset={0} boss src="workbook" /></div></div> : null })()}
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

function Node({ lesson, st, stars, onStart, offset, boss, src }: { lesson: Lesson; st: 'done' | 'open' | 'locked'; stars?: number; onStart: (l: Lesson) => void; offset: number; boss?: boolean; src?: LessonSource }) {
  return (
    <div className="node-wrap" style={{ transform: `translateX(${offset}px)` }}>
      {st === 'open' && <div className="start-bubble">ابدأ</div>}
      <button className={`node ${st} ${boss ? 'boss' : ''} ${src ? `node-${src}` : ''}`} disabled={st === 'locked'} onClick={() => onStart(lesson)} aria-label={lesson.title}>
        {st === 'locked' ? '🔒' : st === 'done' ? (boss ? '👑' : '⭐') : lesson.icon}
      </button>
      <div className="node-label">{lesson.title}</div>
      {st === 'done' && <div className="stars">{'★'.repeat(stars || 1)}{'☆'.repeat(3 - (stars || 1))}</div>}
    </div>
  )
}

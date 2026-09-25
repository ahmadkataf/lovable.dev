import { useMemo, useState } from 'react'
import type { Lesson, Module, Unit } from '../engine/types'
import type { Progress } from '../engine/progress'
import { SOURCE_NAME, bossLesson, lessonSource, lessonsForUnit, progressTestLesson, reviewLesson } from '../engine/generator'
import meta from '@book-meta'
import { freeLesson } from '../engine/access'

interface Props { modules: Module[]; progress: Progress; onStart: (lesson: Lesson) => void; hasExams?: boolean; pro?: boolean }

/** A book with an Activity Book is studied as separate tracks, each with its own path. */
type Track = 'book' | 'workbook' | 'skills'
const TRACKS: Track[] = ['book', 'workbook', 'skills']
function trackOf(l: Lesson): Track {
  const s = lessonSource(l)
  return s === 'workbook' ? 'workbook' : s === 'skills' ? 'skills' : 'book'
}
function hasTracks(modules: Module[]): boolean {
  return modules.some(m => m.units.some(u => u.workbook || u.compositions?.length || u.translations?.length))
}
/** The module-level lessons that close a module: the unit test and the book's Review, or the Activity Book's Progress Test. */
function moduleLessons(m: Module, track: Track | null): Lesson[] {
  const out: Lesson[] = []
  if (track === null || track === 'book') {
    out.push(bossLesson(m))
    const r = reviewLesson(m)
    if (r) out.push(r)
  }
  if (track === null || track === 'workbook') {
    const t = progressTestLesson(m)
    if (t) out.push(t)
  }
  return out
}

export function unlockedState(modules: Module[], progress: Progress) {
  // sequential unlock inside each path: a lesson is open when the one before it is completed
  const split = hasTracks(modules)
  const chains: Lesson[][] = (split ? TRACKS : [null]).map(track => {
    const chain: Lesson[] = []
    for (const m of modules) {
      for (const u of m.units) chain.push(...lessonsForUnit(u).filter(l => track === null || trackOf(l) === track))
      chain.push(...moduleLessons(m, track))
    }
    return chain
  })
  const status = new Map<string, 'done' | 'open' | 'locked'>()
  for (const chain of chains) {
    let openGiven = false
    for (const l of chain) {
      if (progress.lessons[l.id]) status.set(l.id, 'done')
      else if (!openGiven) { status.set(l.id, 'open'); openGiven = true }
      else status.set(l.id, 'locked')
    }
  }
  const order = chains.flat()
  const unlockedUnits = new Set<string>()
  for (const l of order) if (status.get(l.id) !== 'locked') unlockedUnits.add(l.unitId)
  return { order, status, unlockedUnits }
}

const GUIDE_KEY = `${meta.storageKey}.guideSeen`
const TRACK_KEY = `${meta.storageKey}.track`
function load(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
function save(key: string, v: string) { try { localStorage.setItem(key, v) } catch { /* ignore */ } }

const TRACK_INFO: Record<Track, { title: string; en: string; note: string }> = {
  book: { title: SOURCE_NAME.book, en: "Student's Book", note: 'الكلمات، القراءة، القواعد، المفردات، اللفظ والحوار' },
  workbook: { title: SOURCE_NAME.workbook, en: 'Activity Book', note: 'نصوص كتاب الأنشطة وكل تمارينه محلولة، واختبارات التقدّم' },
  skills: { title: SOURCE_NAME.skills, en: 'Exam skills', note: 'الترجمة، الإنشاء خطوة بخطوة، تركيب الجمل ومراجعة كل وحدة' },
}

function unitPages(u: Unit, track: Track | null): string {
  if (track === 'workbook') return u.workbook?.pages ? `كتاب الأنشطة صفحات ${u.workbook.pages}` : ''
  if (track === 'skills') return ''
  return `صفحات ${u.pages}`
}

export default function Home({ modules, progress, onStart, hasExams, pro = true }: Props) {
  const { status } = useMemo(() => unlockedState(modules, progress), [modules, progress])
  const offsets = [0, 40, 70, 40, 0, -40, -70, -40]
  const split = hasTracks(modules)
  const [guide, setGuide] = useState(() => split && !load(GUIDE_KEY))
  const [track, setTrackState] = useState<Track>(() => (TRACKS as string[]).includes(load(TRACK_KEY) || '') ? load(TRACK_KEY) as Track : 'book')
  const setTrack = (t: Track) => { setTrackState(t); save(TRACK_KEY, t); window.scrollTo(0, 0) }
  const closeGuide = () => { setGuide(false); save(GUIDE_KEY, '1') }
  const shown: Track | null = split ? track : null
  const inTrack = (l: Lesson) => shown === null || trackOf(l) === shown
  const paid = (l: Lesson) => !pro && !freeLesson(l, modules)

  const trackCount = (t: Track) => {
    const all = modules.flatMap(m => [...m.units.flatMap(u => lessonsForUnit(u)), ...moduleLessons(m, t)]).filter(l => trackOf(l) === t)
    return { done: all.filter(l => status.get(l.id) === 'done').length, total: all.length }
  }

  return (
    <div className="page">
      {split && (
        <>
          <div className="track-cards">
            {TRACKS.map(t => {
              const c = trackCount(t)
              return (
                <button key={t} className={`track-card track-${t} ${track === t ? 'active' : ''}`} onClick={() => setTrack(t)}>
                  <b>{TRACK_INFO[t].title}</b>
                  <span className="en">{TRACK_INFO[t].en}</span>
                  <span className="track-note">{TRACK_INFO[t].note}</span>
                  <div className="track-bar"><div style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} /></div>
                  <span className="track-count">{c.done} / {c.total} درساً</span>
                </button>
              )
            })}
          </div>
          {!guide && <button className="guide-link" onClick={() => setGuide(true)}>❓ كيف أستخدم التطبيق؟</button>}
        </>
      )}
      {guide && (
        <div className="card guide fade">
          <div className="h2">👋 أهلاً! هكذا يعمل التطبيق</div>
          <p className="muted">في أعلى الصفحة ثلاث بطاقات. اضغط على بطاقة لترى دروسها وحدها، ولكلٍّ منها مسار وتقدّم مستقل:</p>
          <div className="guide-row src-book"><b>{SOURCE_NAME.book}</b><span>الكتاب المدرسي نفسه، وحدة وحدة: الكلمات، نص القراءة، القواعد، المفردات، اللفظ والحوار، مع أرقام الصفحات.</span></div>
          <div className="guide-row src-workbook"><b>{SOURCE_NAME.workbook}</b><span>كتاب التمارين (Activity Book): نصوصه وكل تمارينه محلولة مع الشرح، واختبارات التقدّم.</span></div>
          <div className="guide-row src-skills"><b>{SOURCE_NAME.skills}</b><span>الترجمة، والإنشاء خطوة بخطوة، وتركيب الجمل، ومراجعة الوحدة.</span></div>
          <p className="muted" style={{ fontSize: 13 }}>الأفضل: ادرس الوحدة في كتاب الطالب أولاً، ثم حلّ تمارينها في كتاب الأنشطة، ثم تدرّب على مهاراتها.</p>
          {hasExams && <div className="guide-row"><b>📝 امتحانات</b><span>من الشريط في الأسفل: نماذج بشكل الامتحان النهائي تماماً، مع التصحيح.</span></div>}
          <div className="guide-row"><b>📖 الكتاب</b><span>من الشريط في الأسفل: نصوص الكتابين كاملة مع الصوت والترجمة، للمراجعة في أي وقت.</span></div>
          <button className="btn btn-primary btn-block" onClick={closeGuide}>فهمت، لنبدأ</button>
        </div>
      )}
      {split && <div className={`track-title track-${track}`}>{TRACK_INFO[track].title} — <span className="en">{TRACK_INFO[track].en}</span></div>}
      {modules.map(m => {
        const closing = moduleLessons(m, shown)
        return (
          <div key={m.number}>
            <div className="module-head" style={{ background: m.color }}>
              <div className="sub">الوحدة {m.number} · {m.titleAr}</div>
              <div className="title">Module {m.number}: {m.title}</div>
            </div>
            {m.units.map(u => {
              const lessons = lessonsForUnit(u).filter(inTrack)
              if (!lessons.length) return null
              const doneCount = lessons.filter(l => status.get(l.id) === 'done').length
              const pages = unitPages(u, shown)
              return (
                <div className="unit-block" key={u.id}>
                  <div className="unit-title">
                    <span className="em">{u.emoji}</span>
                    <div>
                      <div className="t">Unit {u.number}: {u.title} <span className="muted">· {u.titleAr}</span></div>
                      <div className="s">{pages ? `${pages} · ` : ''}{doneCount}/{lessons.length} دروس{shown !== 'workbook' && shown !== 'skills' ? ` · ${u.vocab.length} كلمة` : ''}</div>
                    </div>
                  </div>
                  <div className="path">
                    {lessons.map((l, i) => <Node key={l.id} lesson={l} st={status.get(l.id)!} stars={progress.lessons[l.id]?.stars} onStart={onStart} offset={offsets[i % offsets.length]} track={shown} paid={paid(l)} />)}
                  </div>
                </div>
              )
            })}
            {closing.length > 0 && (
              <div className="path" style={{ marginBottom: 24 }}>
                {closing.map(l => (
                  <div key={l.id} className="node-block">
                    {l.kind === 'progressTest' && m.progressTest && <div className="muted center" style={{ fontSize: 12 }}>{m.progressTest.title} · صفحات {m.progressTest.pages}</div>}
                    <Node lesson={l} st={status.get(l.id)!} stars={progress.lessons[l.id]?.stars} onStart={onStart} offset={0} boss track={shown} paid={paid(l)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <div className="card center mt">
        <div style={{ fontSize: 40 }}>🎓</div>
        <div className="h2">{split ? `أنهيت ${TRACK_INFO[track].title.replace(/^\S+\s/, '')}؟` : 'أنهيت الكتاب كاملاً؟'}</div>
        <p className="muted">{split ? 'انتقل إلى البطاقة التالية في أعلى الصفحة، وتابع التدريب اليومي من تبويب «الكلمات».' : 'تابع التدريب اليومي من تبويب «الكلمات» لتثبيت ما حفظته.'}</p>
      </div>
    </div>
  )
}

function Node({ lesson, st, stars, onStart, offset, boss, track, paid }: { lesson: Lesson; st: 'done' | 'open' | 'locked'; stars?: number; onStart: (l: Lesson) => void; offset: number; boss?: boolean; track?: Track | null; paid?: boolean }) {
  // a lesson behind the paywall opens the activation screen instead of the lesson
  const key = paid && st !== 'done'
  return (
    <div className="node-wrap" style={{ transform: `translateX(${offset}px)` }}>
      {st === 'open' && !key && <div className="start-bubble">ابدأ</div>}
      {st === 'open' && key && <div className="start-bubble paid-bubble">فعّل للمتابعة</div>}
      <button className={`node ${key ? 'paid' : st} ${boss ? 'boss' : ''} ${track && !key ? `node-${track}` : ''}`} disabled={st === 'locked' && !key} onClick={() => onStart(lesson)} aria-label={lesson.title}>
        {key ? '🔑' : st === 'locked' ? '🔒' : st === 'done' ? (boss ? '👑' : '⭐') : lesson.icon}
      </button>
      <div className="node-label">{lesson.title}</div>
      {st === 'done' && <div className="stars">{'★'.repeat(stars || 1)}{'☆'.repeat(3 - (stars || 1))}</div>}
    </div>
  )
}

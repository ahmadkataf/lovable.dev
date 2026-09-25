import type { Exam } from '../engine/types'
import type { Progress } from '../engine/progress'

interface Props { exams: Exam[]; progress: Progress; onStart: (exam: Exam) => void; onMockExam: () => void; canMock: boolean }

export default function Exams({ exams, progress, onStart, onMockExam, canMock }: Props) {
  const terms = [1, 2] as const
  return (
    <div className="page">
      <div className="h1">📝 الامتحانات</div>
      <p className="muted mb">أوراق بنفس شكل الامتحان النهائي تماماً: الأقسام {exams[0]?.sections.map(s => s.letter).join('، ')}، {exams[0]?.minutes} دقيقة، العلامة من {exams[0]?.totalMarks}. أجب عن الورقة كلها ثم سلّمها لترى علامتك والتصحيح مع شرح كل سؤال.</p>
      {terms.map(t => {
        const list = exams.filter(e => e.term === t)
        if (!list.length) return null
        return (
          <div key={t} className="mb">
            <div className="h2">{list[0].termAr ?? (t === 1 ? 'الفصل الأول' : 'الفصل الثاني')} <span className="muted" style={{ fontSize: 13 }}>· {list[0].scopeAr ?? (t === 1 ? 'الوحدات 1–3' : 'الوحدات 4–6')}</span></div>
            {list.map(e => {
              const r = progress.exams?.[e.id]
              return (
                <div key={e.id} className="card exam-card">
                  <div className="grow">
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <b>{e.titleAr}</b>
                      {e.real && <span className="pill active">نموذج حقيقي</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>{e.sourceAr}</div>
                    {r && <div style={{ fontSize: 13, marginTop: 4 }}>أفضل علامة: <b>{r.best}</b> / {e.totalMarks} · آخر محاولة: {r.last}</div>}
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => onStart(e)}>{r ? 'أعد' : 'ابدأ'}</button>
                </div>
              )
            })}
          </div>
        )
      })}
      <div className="card">
        <div className="row spread">
          <div>
            <div className="h2">🎯 تدريب سريع</div>
            <div className="muted" style={{ fontSize: 13 }}>30 سؤالاً متنوعاً من الدروس التي فتحتها، سؤالاً سؤالاً مع التصحيح الفوري.</div>
          </div>
          <button className="btn btn-purple btn-sm" onClick={onMockExam} disabled={!canMock}>ابدأ</button>
        </div>
      </div>
    </div>
  )
}

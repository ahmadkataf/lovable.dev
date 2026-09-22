import { useMemo, useState } from 'react'
import type { Module } from '../engine/types'
import type { Progress } from '../engine/progress'
import { wordStrength } from '../engine/progress'
import { Speaker } from '../components/common'

interface Props { modules: Module[]; progress: Progress; unlocked: Set<string>; onPractice: () => void; onMockExam: () => void }

export default function Words({ modules, progress, unlocked, onPractice, onMockExam }: Props) {
  const [q, setQ] = useState('')
  const [unit, setUnit] = useState<string>('all')
  const [weakOnly, setWeakOnly] = useState(false)
  const units = modules.flatMap(m => m.units)
  const rows = useMemo(() => {
    const list = units.filter(u => unit === 'all' || u.id === unit).flatMap(u => u.vocab.map(w => ({ w, u })))
    const s = q.trim().toLowerCase()
    return list.filter(({ w }) => (!s || w.en.toLowerCase().includes(s) || w.ar.includes(s)))
      .map(r => ({ ...r, str: wordStrength(progress.words[r.w.en.toLowerCase()]) }))
      .filter(r => !weakOnly || (r.str < 0.5 && unlocked.has(r.u.id)))
  }, [units, unit, q, weakOnly, progress, unlocked])
  const learned = Object.values(progress.words).filter(s => s.seen > 0).length
  const total = units.reduce((a, u) => a + u.vocab.length, 0)
  const due = units.filter(u => unlocked.has(u.id)).flatMap(u => u.vocab).filter(w => { const s = progress.words[w.en.toLowerCase()]; return s && s.due <= Date.now() && wordStrength(s) < 0.9 }).length
  return (
    <div className="page">
      <div className="h1">📚 الكلمات</div>
      <div className="card mb">
        <div className="row spread">
          <div><div className="h2">{learned} / {total} كلمة</div><div className="muted">تعلّمتها حتى الآن · {due} كلمة تحتاج مراجعة</div></div>
          <button className="btn btn-blue" onClick={onPractice} disabled={unlocked.size === 0}>💪 تدريب</button>
        </div>
      </div>
      <div className="card mb">
        <div className="row spread">
          <div>
            <div className="h2">📝 اختبار تجريبي</div>
            <div className="muted">30 سؤالاً من كل الدروس التي فتحتها: قراءة، مفردات، قواعد{modules.some(m => m.units.some(u => u.everyday)) ? '، Everyday English' : ''}. بلا خسارة قلوب.</div>
          </div>
          <button className="btn btn-purple" onClick={onMockExam} disabled={unlocked.size === 0}>ابدأ</button>
        </div>
      </div>
      <input className="search mb" placeholder="ابحث عن كلمة بالإنجليزية أو العربية..." value={q} onChange={e => setQ(e.target.value)} />
      <div className="pills mb">
        <button className={`pill ${unit === 'all' ? 'active' : ''}`} onClick={() => setUnit('all')}>الكل</button>
        {units.map(u => <button key={u.id} className={`pill ${unit === u.id ? 'active' : ''}`} onClick={() => setUnit(u.id)}>{u.emoji} {u.number}</button>)}
        <button className={`pill ${weakOnly ? 'active' : ''}`} onClick={() => setWeakOnly(v => !v)}>⚠️ الضعيفة</button>
      </div>
      <div className="card">
        {rows.length === 0 && <p className="muted center">لا توجد كلمات مطابقة.</p>}
        {rows.map(({ w, u, str }) => (
          <details key={u.id + w.en} className="word-row" style={{ display: 'block' }}>
            <summary className="row" style={{ listStyle: 'none', cursor: 'pointer' }}>
              <Speaker text={w.en} size="sm" />
              <div className="grow">
                <div className="w">{w.en} <span className="muted en" style={{ fontWeight: 400, fontSize: 12 }}>{w.pos}</span></div>
                <div className="a">{w.ar}</div>
              </div>
              <div className="bar" title="قوة الحفظ"><div style={{ width: `${Math.round(str * 100)}%`, background: str < 0.4 ? 'var(--red)' : str < 0.7 ? 'var(--yellow)' : 'var(--green)' }} /></div>
            </summary>
            <div style={{ padding: '6px 50px 4px 0' }}>
              {w.def && <div className="muted en">{w.def}</div>}
              {w.defAr && <div className="muted">{w.defAr}</div>}
              {w.example && <div className="row mt" style={{ gap: 6 }}><Speaker text={w.example} size="sm" /><span className="en" style={{ fontSize: 14 }}>{w.example}</span></div>}
              {w.exampleAr && <div className="muted" style={{ fontSize: 13 }}>{w.exampleAr}</div>}
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Unit {u.number} · {u.title}</div>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

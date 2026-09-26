import { useState } from 'react'
import type { Grammar as Rule, Module, Unit } from '../engine/types'
import type { Progress } from '../engine/progress'
import { Speaker } from '../components/common'
import { freeUnit } from '../engine/access'

type Which = 'grammar' | 'vocabFocus'
interface Props {
  modules: Module[]
  progress: Progress
  pro: boolean
  onPractice: (unitId: string, which: Which) => void
  onLocked: () => void
}

/** Every rule the book teaches in one place: read it, then drill it, with the best score so far. */
export default function Grammar({ modules, progress, pro, onPractice, onLocked }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const items = modules.flatMap(m => m.units.flatMap(u => [
    { m, u, which: 'grammar' as Which, rule: u.grammar },
    ...(u.vocabFocus ? [{ m, u, which: 'vocabFocus' as Which, rule: u.vocabFocus }] : []),
  ]))
  const practiced = items.filter(i => progress.practice?.[`${i.u.id}:${i.which}`]).length

  return (
    <div className="page">
      <div className="h1">🧩 القواعد</div>
      <p className="muted mb">كل قواعد الكتاب في مكان واحد. اقرأ القاعدة بالعربي، ثم اضغط «تدرّب» لتحلّ تمارينها مع شرح كل إجابة.</p>
      <div className="card mb row spread">
        <div><b>تدرّبت على {practiced} من {items.length} قاعدة</b><div className="muted" style={{ fontSize: 13 }}>كرّر التدريب حتى تصل إلى 90% في كل قاعدة.</div></div>
        <div className="goal-ring" style={{ background: `conic-gradient(var(--green) ${(practiced / Math.max(1, items.length)) * 360}deg, var(--gray-2) 0)` }}><span>{Math.round((practiced / Math.max(1, items.length)) * 100)}%</span></div>
      </div>
      {modules.map(m => (
        <div key={m.number}>
          <div className="module-head" style={{ background: m.color, margin: '14px 0 8px' }}>
            <div className="sub">الوحدة {m.number} · {m.titleAr}</div>
            <div className="title">Module {m.number}: {m.title}</div>
          </div>
          {items.filter(i => i.m === m).map(({ u, which, rule }) => {
            const key = `${u.id}:${which}`
            const locked = !pro && !freeUnit(u.id, modules)
            return <RuleCard key={key} u={u} which={which} rule={rule} locked={locked} best={progress.practice?.[key]?.best}
              open={open === key} onToggle={() => setOpen(open === key ? null : key)}
              onPractice={() => (locked ? onLocked() : onPractice(u.id, which))} />
          })}
        </div>
      ))}
    </div>
  )
}

function RuleCard({ u, which, rule, locked, best, open, onToggle, onPractice }: { u: Unit; which: Which; rule: Rule; locked: boolean; best?: number; open: boolean; onToggle: () => void; onPractice: () => void }) {
  const count = rule.exercises.length
  return (
    <div className={`card rule-card ${which === 'vocabFocus' ? 'rule-vocab' : ''}`}>
      <div className="row spread" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="muted" style={{ fontSize: 12 }}>{u.emoji} Unit {u.number}: {u.title} · {which === 'grammar' ? 'قواعد' : 'مفردات'}</div>
          <div className="h2" style={{ margin: '2px 0' }}>{rule.nameAr}</div>
          <div className="en muted" style={{ fontSize: 13 }}>{rule.name}</div>
        </div>
        {best !== undefined && <span className={`pill ${best >= 90 ? 'active' : ''}`}>أفضل نتيجة {best}%</span>}
      </div>
      <button className={`btn btn-block mt ${locked ? 'btn-outline' : 'btn-primary'}`} onClick={onPractice}>
        {locked ? '🔑 فعّل التطبيق لتتدرّب' : `✏️ تدرّب${count ? ` · ${count} تمريناً` : ''}`}
      </button>
      {!locked && rule.ruleAr.length > 0 && (
        <button className="rule-toggle" onClick={onToggle}>{open ? '▲ إخفاء القاعدة' : '📖 اقرأ القاعدة'}</button>
      )}
      {open && !locked && (
        <div className="grammar-card fade">
          <div className="ar-rule"><ul>{rule.ruleAr.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
          {rule.ruleEn.length > 0 && <div className="en-rule"><ul>{rule.ruleEn.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
          {rule.examples.map((e, i) => <div key={i} className="ex"><span>{e}</span><Speaker text={e} size="sm" /></div>)}
          <button className="btn btn-primary btn-block" onClick={onPractice}>✏️ فهمت القاعدة، أريد أن أتدرّب</button>
        </div>
      )}
    </div>
  )
}

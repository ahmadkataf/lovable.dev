/* Result of POST /api/absences: the affected periods and the ranked
   substitute candidates the engine suggested. */

import { Tag } from './Ui';
import { ar, periodName, teacherTitle } from '../format';
import type { AbsenceResult } from '../types';

export function EngineResult({ result, who, dateLabel }: { result: AbsenceResult; who: string; dateLabel: string }) {
  const n = result.affected.length;
  return (
    <div className="stack">
      <div className="steps">
        <div className="step"><span className="n">١</span><span>سُجّل غياب {who} {dateLabel}.</span></div>
        <div className="step">
          <span className="n">٢</span>
          <span>
            {n === 0 ? 'لا حصص في هذا اليوم، فلا حاجة إلى تغطية.' : n === 1 ? 'حصّة واحدة تحتاج تغطية:' : n === 2 ? 'حصّتان تحتاجان تغطية:' : `${ar(n)} حصص تحتاج تغطية:`}
          </span>
        </div>
      </div>
      {result.affected.map((a) => (
        <div className="row" key={a.substitution_id} style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <span className="pnum num" aria-hidden="true">{ar(a.period)}</span>
          <span className="grow">
            <b>{periodName(a.period)} · {a.section_label} · {a.subject}</b>
            {a.candidates.length ? (
              <span className="chips" style={{ marginTop: 8 }}>
                {a.candidates.map((c, i) => (
                  <span key={c.teacher_id} className={`chip ${i === 0 ? 'tier1' : ''}`}>
                    {i === 0 && <span className="dot" aria-hidden="true" />}
                    {teacherTitle(c.name)}
                    <small>{c.subject} · {c.reason}</small>
                  </span>
                ))}
              </span>
            ) : (
              <small style={{ marginTop: 6 }}><Tag tone="sun">لا بديل متاح — تعلّم ذاتي موجَّه</Tag></small>
            )}
          </span>
        </div>
      ))}
      {n > 0 && (
        <div className="steps">
          <div className="step"><span className="n">٣</span><span>أُبلغت الإدارة، وتعتمد البديل أو التعلّم الذاتي من لوحة الغياب، ثم يُبلَّغ الطلاب وأولياء الأمور بالتغيير.</span></div>
        </div>
      )}
    </div>
  );
}

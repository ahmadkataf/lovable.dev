import type { Progress } from '../engine/progress'
import { levelFromXp, today } from '../engine/progress'
import { audioStatus, speak } from '../engine/audio'
import { useState } from 'react'
import type { Access } from '../engine/access'
import { privacyUrl } from '../engine/online'

interface Props { progress: Progress; totalLessons: number; subtitle: string; onChange: (p: Progress) => void; onReset: () => void; access?: Access; onActivate?: () => void }

export default function Profile({ progress, totalLessons, subtitle, onChange, onReset, access, onActivate }: Props) {
  const lv = levelFromXp(progress.xp)
  const [audioMsg, setAudioMsg] = useState('')
  const done = Object.keys(progress.lessons).length
  const todayXp = progress.dailyXp[today()] || 0
  const goalPct = Math.min(1, todayXp / progress.dailyGoal)
  const days = Object.keys(progress.dailyXp).sort().slice(-7)
  const learned = Object.values(progress.words).filter(w => w.seen > 0).length
  const mastered = Object.values(progress.words).filter(w => w.correct - w.wrong >= 4).length
  return (
    <div className="page">
      <div className="h1">👤 ملفّي</div>
      {access && (
        <div className="card mb row spread">
          <div>
            <div className="h2">{access.pro ? '✅ التطبيق مفعّل' : '🔑 النسخة المجانية'}</div>
            <div className="muted" style={{ fontSize: 13 }}>{access.pro ? (access.until ? `حتى ${access.until.toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' })}` : 'اشتراك دائم') : 'الوحدة الأولى والنموذج الأول مجاناً'}</div>
            <div className="muted en" style={{ fontSize: 12 }}>رقم الجهاز: {access.device}</div>
          </div>
          <button className="btn btn-sm btn-blue" onClick={onActivate}>{access.pro ? 'التفاصيل' : 'فعّل'}</button>
        </div>
      )}
      {privacyUrl && <p className="center"><a className="muted" href={privacyUrl} target="_blank" rel="noreferrer">سياسة الخصوصية</a></p>}
      <div className="card mb">
        <div className="row">
          <div style={{ fontSize: 48 }}>🦉</div>
          <div className="grow">
            <input className="search" placeholder="اكتب اسمك" value={progress.name} onChange={e => onChange({ ...progress, name: e.target.value })} />
          </div>
        </div>
        <div className="row mt" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
          <div><div className="h2">🔥 {progress.streak}</div><div className="muted">أيام متتالية</div></div>
          <div><div className="h2">💎 {progress.xp}</div><div className="muted">نقاط XP</div></div>
          <div><div className="h2">🏅 {lv.level}</div><div className="muted">المستوى</div></div>
        </div>
        <div className="progress mt"><div style={{ width: `${(lv.into / lv.need) * 100}%`, background: 'var(--blue)' }} /></div>
        <div className="muted center" style={{ fontSize: 12 }}>{lv.into}/{lv.need} XP للمستوى التالي</div>
      </div>

      <div className="card mb">
        <div className="row">
          <div className="goal-ring" style={{ background: `conic-gradient(var(--green) ${goalPct * 360}deg, var(--gray-2) 0)` }}><span>{Math.round(goalPct * 100)}%</span></div>
          <div className="grow">
            <div className="h2">الهدف اليومي</div>
            <div className="muted">{todayXp} / {progress.dailyGoal} XP اليوم</div>
            <div className="pills mt">
              {[10, 20, 30, 50].map(g => <button key={g} className={`pill ${progress.dailyGoal === g ? 'active' : ''}`} onClick={() => onChange({ ...progress, dailyGoal: g })}>{g} XP</button>)}
            </div>
          </div>
        </div>
        <div className="row mt" style={{ gap: 6, justifyContent: 'space-between' }}>
          {Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const v = progress.dailyXp[k] || 0; return (
            <div key={k} className="center" style={{ flex: 1 }}>
              <div style={{ height: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><div style={{ width: 14, height: `${Math.max(4, Math.min(40, v / progress.dailyGoal * 40))}px`, background: v >= progress.dailyGoal ? 'var(--green)' : 'var(--gray-3)', borderRadius: 4 }} /></div>
              <div className="muted" style={{ fontSize: 10 }}>{['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][d.getDay()]}</div>
            </div>) })}
          {days.length === 0 && null}
        </div>
      </div>

      <div className="card mb">
        <div className="h2">الإنجازات</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <Ach ok={done >= 1} icon="🌱" t="أول درس" />
          <Ach ok={done >= 7} icon="📗" t="وحدة كاملة" />
          <Ach ok={progress.streak >= 3} icon="🔥" t="3 أيام متتالية" />
          <Ach ok={progress.streak >= 7} icon="🌋" t="أسبوع كامل" />
          <Ach ok={learned >= 50} icon="📚" t="50 كلمة" />
          <Ach ok={mastered >= 100} icon="🧠" t="أتقنت 100 كلمة" />
          <Ach ok={progress.xp >= 500} icon="💎" t="500 XP" />
          <Ach ok={done >= totalLessons} icon="🎓" t="أنهيت الكتاب" />
        </div>
        <div className="muted mt">الدروس المكتملة: {done} / {totalLessons} · الكلمات المتعلَّمة: {learned} · المتقنة: {mastered}</div>
      </div>

      <div className="card mb">
        <div className="h2">الإعدادات</div>
        <label className="row spread" style={{ padding: '8px 0' }}><span>🔔 المؤثرات الصوتية</span><input type="checkbox" checked={progress.sound} onChange={e => onChange({ ...progress, sound: e.target.checked })} /></label>
        <label className="row spread" style={{ padding: '8px 0' }}><span>🔊 نطق الكلمة تلقائياً</span><input type="checkbox" checked={progress.autoSpeak} onChange={e => onChange({ ...progress, autoSpeak: e.target.checked })} /></label>
        <div className="row mt" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-blue btn-sm" onClick={() => {
            setAudioMsg('جارٍ التشغيل...')
            speak('Education is the most powerful weapon you can use to change the world.', { onEnd: () => { const s = audioStatus(); setAudioMsg(`انتهى التشغيل ✅ · ملفات الصوت: ${s.sprites === 'ready' ? 'جاهزة' : s.sprites === 'failed' ? 'غير متاحة' : s.sprites} · نطق المتصفح: ${s.tts ? `متاح (${s.voices} صوت)` : 'غير متاح'}`) } })
            setTimeout(() => { const s = audioStatus(); setAudioMsg(m => m === 'جارٍ التشغيل...' ? `ملفات الصوت: ${s.sprites} · نطق المتصفح: ${s.tts ? `متاح (${s.voices} صوت)` : 'غير متاح'} · حالة الصوت: ${s.ctx}` : m) }, 6000)
          }}>🔊 اختبار الصوت</button>
          <button className="btn btn-red btn-sm" onClick={() => { if (confirm('هل تريد حذف كل التقدّم؟')) onReset() }}>إعادة ضبط التقدّم</button>
        </div>
        {audioMsg && <p className="muted" style={{ fontSize: 13 }}>{audioMsg}</p>}
        <p className="muted" style={{ fontSize: 12 }}>إن لم تسمع شيئاً: ارفع صوت الوسائط، وأغلق الوضع الصامت على iPhone.</p>
      </div>
      <p className="muted center">{subtitle} · تطبيق تعليمي تفاعلي</p>
    </div>
  )
}

function Ach({ ok, icon, t }: { ok: boolean; icon: string; t: string }) {
  return <div className="center" style={{ width: 84, opacity: ok ? 1 : .35, filter: ok ? 'none' : 'grayscale(1)' }}><div style={{ fontSize: 32 }}>{icon}</div><div style={{ fontSize: 11, fontWeight: 700 }}>{t}</div></div>
}

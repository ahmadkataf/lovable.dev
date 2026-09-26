import { useEffect, useState } from 'react'
import { speak, stopSpeaking } from '../engine/audio'

export function Speaker({ text, lang = 'en', size = '', slow = false, autoplay = false }: { text: string; lang?: 'en' | 'ar'; size?: '' | 'big' | 'sm'; slow?: boolean; autoplay?: boolean }) {
  const [on, setOn] = useState(false)
  const play = () => { setOn(true); speak(text, { lang, rate: slow ? 0.6 : undefined, onEnd: () => setOn(false) }) }
  useEffect(() => { if (autoplay) { const t = setTimeout(play, 250); return () => { clearTimeout(t); stopSpeaking() } } /* eslint-disable-next-line */ }, [text])
  return (
    <button className={`speaker ${size} ${slow ? 'slow' : ''}`} onClick={play} aria-label="استمع" style={on ? { filter: 'brightness(1.15)' } : undefined}>
      {slow ? '🐢' : '🔊'}
    </button>
  )
}

export function Confetti() {
  const colors = ['#58cc02', '#1cb0f6', '#ff4b4b', '#ffc800', '#ce82ff', '#ff9600']
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, color: colors[i % colors.length], rot: Math.random() * 360,
  }))
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)`, borderRadius: i % 3 === 0 ? '50%' : 2 }} />
      ))}
    </div>
  )
}

export function ProgressBar({ value }: { value: number }) {
  return <div className="progress"><div style={{ width: `${Math.round(value * 100)}%` }} /></div>
}

export function Hearts({ n }: { n: number }) {
  return <div className="stat heart" aria-label={`${n} قلوب`}>❤️ <span>{n}</span></div>
}

/** Normal, slow, very slow: the speed of every recording in the app, one tap away during a lesson. */
export const SPEEDS = [{ rate: 1, label: 'عادي' }, { rate: 0.8, label: 'بطيء' }, { rate: 0.65, label: 'بطيء جداً' }]
export function SpeedButton({ rate, onChange }: { rate: number; onChange: (rate: number) => void }) {
  const i = Math.max(0, SPEEDS.findIndex(s => s.rate === rate))
  const nextSpeed = SPEEDS[(i + 1) % SPEEDS.length]
  return (
    <button className={`speed-btn ${i ? 'on' : ''}`} onClick={() => onChange(nextSpeed.rate)}
      aria-label={`سرعة النطق: ${SPEEDS[i].label}`} title="سرعة النطق">
      {i === 0 ? '🐇' : '🐢'}<span>{SPEEDS[i].label}</span>
    </button>
  )
}

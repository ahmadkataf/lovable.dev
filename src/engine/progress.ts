// Persistent learner state (localStorage)

export interface WordStat { seen: number; correct: number; wrong: number; last: number; due: number }

export interface Progress {
  xp: number
  hearts: number
  heartsAt: number            // timestamp of last heart regen tick
  streak: number
  lastActive: string          // YYYY-MM-DD
  dailyXp: Record<string, number>
  dailyGoal: number
  lessons: Record<string, { stars: number; best: number; times: number }>
  words: Record<string, WordStat>
  name: string
  sound: boolean
  autoSpeak: boolean
  exams?: Record<string, ExamResult>
  practice?: Record<string, { best: number; last: number; times: number }>   // practice of one rule, by 'u3:grammar'
}

export interface ExamResult { best: number; last: number; times: number; date: string }

import meta from '@book-meta'

// each book keeps its own progress
const KEY = meta.storageKey
export const MAX_HEARTS = 5
export const HEART_REGEN_MS = 10 * 60 * 1000 // one heart every 10 minutes

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaults(): Progress {
  return {
    xp: 0, hearts: MAX_HEARTS, heartsAt: Date.now(), streak: 0, lastActive: '', dailyXp: {}, dailyGoal: 30,
    lessons: {}, words: {}, name: '', sound: true, autoSpeak: true,
  }
}

export function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults()
    const p = { ...defaults(), ...JSON.parse(raw) } as Progress
    return regenHearts(p)
  } catch { return defaults() }
}

export function save(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

export function regenHearts(p: Progress): Progress {
  if (p.hearts >= MAX_HEARTS) return { ...p, heartsAt: Date.now() }
  const elapsed = Date.now() - p.heartsAt
  const gained = Math.floor(elapsed / HEART_REGEN_MS)
  if (gained <= 0) return p
  return { ...p, hearts: Math.min(MAX_HEARTS, p.hearts + gained), heartsAt: p.heartsAt + gained * HEART_REGEN_MS }
}

export function nextHeartIn(p: Progress): number {
  if (p.hearts >= MAX_HEARTS) return 0
  return Math.max(0, HEART_REGEN_MS - (Date.now() - p.heartsAt))
}

export function touchStreak(p: Progress): Progress {
  const t = today()
  if (p.lastActive === t) return p
  const y = new Date(); y.setDate(y.getDate() - 1)
  const yest = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
  const streak = p.lastActive === yest ? p.streak + 1 : 1
  return { ...p, streak, lastActive: t }
}

export function addXp(p: Progress, amount: number): Progress {
  const t = today()
  const dailyXp = { ...p.dailyXp, [t]: (p.dailyXp[t] || 0) + amount }
  return touchStreak({ ...p, xp: p.xp + amount, dailyXp })
}

export function loseHeart(p: Progress): Progress {
  const wasFull = p.hearts >= MAX_HEARTS
  return { ...p, hearts: Math.max(0, p.hearts - 1), heartsAt: wasFull ? Date.now() : p.heartsAt }
}

export function refillHearts(p: Progress): Progress {
  return { ...p, hearts: MAX_HEARTS, heartsAt: Date.now() }
}

// ---- Spaced repetition (simple Leitner-ish) ----
const INTERVALS = [0, 1, 3, 7, 14, 30].map(d => d * 24 * 3600 * 1000)

export function recordWord(p: Progress, en: string, correct: boolean): Progress {
  const key = en.toLowerCase()
  const s = p.words[key] || { seen: 0, correct: 0, wrong: 0, last: 0, due: 0 }
  const now = Date.now()
  const level = Math.max(0, Math.min(INTERVALS.length - 1, correct ? wordLevel(s) + 1 : 0))
  const stat: WordStat = {
    seen: s.seen + 1, correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1),
    last: now, due: now + INTERVALS[level],
  }
  return { ...p, words: { ...p.words, [key]: stat } }
}

export function wordLevel(s: WordStat | undefined): number {
  if (!s) return 0
  return Math.max(0, Math.min(5, s.correct - s.wrong))
}

export function wordStrength(s: WordStat | undefined): number {
  // 0..1
  if (!s || s.seen === 0) return 0
  const lvl = wordLevel(s) / 5
  const decay = Math.min(1, (Date.now() - s.last) / (14 * 24 * 3600 * 1000))
  return Math.max(0, Math.min(1, lvl * (1 - decay * 0.6)))
}

export function completeLesson(p: Progress, lessonId: string, stars: number, score: number): Progress {
  const prev = p.lessons[lessonId] || { stars: 0, best: 0, times: 0 }
  return {
    ...p,
    lessons: { ...p.lessons, [lessonId]: { stars: Math.max(prev.stars, stars), best: Math.max(prev.best, score), times: prev.times + 1 } },
  }
}

export function recordExam(p: Progress, examId: string, score: number, firstSubmit: boolean): Progress {
  const prev = p.exams?.[examId] || { best: 0, last: 0, times: 0, date: '' }
  const r: ExamResult = { best: Math.max(prev.best, score), last: score, times: prev.times + (firstSubmit ? 1 : 0), date: today() }
  return { ...p, exams: { ...(p.exams || {}), [examId]: r } }
}

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1, need = 100, xpLeft = xp
  while (xpLeft >= need) { xpLeft -= need; level++; need = Math.round(need * 1.25) }
  return { level, into: xpLeft, need }
}

/** Keep the best and the last score of a practice session on one rule. */
export function recordPractice(p: Progress, key: string, pct: number): Progress {
  const prev = p.practice?.[key]
  return { ...p, practice: { ...p.practice, [key]: { best: Math.max(prev?.best ?? 0, pct), last: pct, times: (prev?.times ?? 0) + 1 } } }
}

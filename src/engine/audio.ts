// Text-to-speech + sound effects (no network, no keys)

let voices: SpeechSynthesisVoice[] = []
let voicesLoaded = false

function loadVoices() {
  if (typeof speechSynthesis === 'undefined') return
  voices = speechSynthesis.getVoices()
  voicesLoaded = voices.length > 0
}
if (typeof speechSynthesis !== 'undefined') {
  loadVoices()
  speechSynthesis.onvoiceschanged = loadVoices
}

function pickVoice(lang: 'en' | 'ar'): SpeechSynthesisVoice | undefined {
  if (!voicesLoaded) loadVoices()
  const pref = lang === 'en'
    ? [/en[-_]US/i, /en[-_]GB/i, /^en/i]
    : [/ar[-_]SA/i, /ar[-_]EG/i, /^ar/i]
  const good = /google|natural|premium|enhanced|samantha|daniel|karen|moira|zira|david|hazel/i
  for (const re of pref) {
    const list = voices.filter(v => re.test(v.lang))
    const best = list.find(v => good.test(v.name)) || list[0]
    if (best) return best
  }
  return undefined
}

export function ttsSupported() {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function speak(text: string, opts: { lang?: 'en' | 'ar'; rate?: number; onEnd?: () => void } = {}) {
  if (!ttsSupported()) { opts.onEnd?.(); return }
  const lang = opts.lang ?? 'en'
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const v = pickVoice(lang)
    if (v) u.voice = v
    u.lang = lang === 'en' ? 'en-US' : 'ar-SA'
    u.rate = opts.rate ?? (lang === 'en' ? 0.9 : 1)
    u.pitch = 1
    if (opts.onEnd) u.onend = opts.onEnd
    speechSynthesis.speak(u)
  } catch { opts.onEnd?.() }
}

export function stopSpeaking() {
  if (ttsSupported()) speechSynthesis.cancel()
}

// ---- Sound effects via WebAudio ----
let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch { return null }
}

let muted = false
export function setMuted(m: boolean) { muted = m }

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.15) {
  if (muted) return
  const c = ac(); if (!c) return
  const o = c.createOscillator(); const g = c.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0, c.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur)
  o.connect(g); g.connect(c.destination)
  o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05)
}

export const sfx = {
  correct() { tone(660, 0, 0.12); tone(880, 0.1, 0.18) },
  wrong() { tone(220, 0, 0.18, 'square', 0.08); tone(180, 0.15, 0.25, 'square', 0.08) },
  tap() { tone(520, 0, 0.05, 'triangle', 0.06) },
  complete() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3)) },
  levelUp() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, 'triangle')) },
}

// ---- Speech recognition (optional, for "listen & repeat") ----
export function recognitionSupported() {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export function listenOnce(lang = 'en-US'): Promise<string> {
  return new Promise((resolve, reject) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return reject(new Error('unsupported'))
    const r = new SR()
    r.lang = lang; r.interimResults = false; r.maxAlternatives = 3
    r.onresult = (e: any) => resolve(e.results[0][0].transcript as string)
    r.onerror = (e: any) => reject(e)
    r.onend = () => reject(new Error('ended'))
    r.start()
  })
}

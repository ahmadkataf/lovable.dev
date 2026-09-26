// Audio: pre-recorded sprites (public/audio/*.mp3 + index.json) with Web Speech fallback,
// plus WebAudio sound effects. No network services, no keys.

// ---------------- WebAudio context + unlock ----------------
let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  } catch { return null }
}

let unlocked = false
function unlock() {
  if (unlocked) return
  unlocked = true
  const c = ac()
  if (c) {
    try { const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0) } catch { /* ignore */ }
  }
  if (ttsSupported()) {
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u) } catch { /* ignore */ }
  }
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, unlock, { capture: true, passive: true })
}

// ---------------- pre-recorded sprites ----------------
type Clip = { group: string; start: number; dur: number }
type Index = { sr: number; groups: Record<string, Record<string, [number, number]>> }
const BASE = ((import.meta as any).env?.BASE_URL || './') as string
const audioUrl = (f: string) => `${BASE.replace(/\/?$/, '/')}audio/${f}`

// A book sold online keeps the paid audio on the server: once the app is activated, index.json and the
// sprites come from there instead of from the app's own files.
export type AudioSource = (file: string) => Promise<Response>
let remote: AudioSource | null = null
export function setAudioSource(src: AudioSource | null) { remote = src; indexPromise = null; indexStatus = 'idle'; buffers.clear(); seconds.clear(); clips.clear() }
const getAudio = (file: string) => (remote ? remote(file) : fetch(audioUrl(file)))

let indexPromise: Promise<Map<string, Clip> | null> | null = null
let indexStatus: 'idle' | 'loading' | 'ready' | 'failed' = 'idle'
/** The files of each unit or module: one (u1) or, cut into short pieces, several (u1c0, u1c1, …). */
let files = new Map<string, string[]>()

export function norm(s: string): string { return s.replace(/\s+/g, ' ').trim().toLowerCase() }

function loadIndex(): Promise<Map<string, Clip> | null> {
  if (!indexPromise) {
    indexStatus = 'loading'
    indexPromise = getAudio('index.json').then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Index> })
      .then(idx => {
        const map = new Map<string, Clip>()
        files = new Map()
        for (const [group, entries] of Object.entries(idx.groups)) {
          for (const [k, [start, dur]] of Object.entries(entries)) if (!map.has(k)) map.set(k, { group, start, dur })
          const unit = group.replace(/c\d+$/, '')
          files.set(unit, [...(files.get(unit) || []), group])
        }
        indexStatus = 'ready'
        return map
      })
      .catch(() => { indexStatus = 'failed'; return null })
  }
  return indexPromise
}

// A file is decoded whole before it plays, and decoded audio is large (a minute is about 5 MB), so only
// the files played last are kept, and they are decoded at a speech sample rate rather than the phone's.
const KEEP_SECONDS = 360
const DECODE_RATE = 24000
const buffers = new Map<string, Promise<AudioBuffer | null>>()
const seconds = new Map<string, number>()

function decode(data: ArrayBuffer): Promise<AudioBuffer | null> {
  return new Promise(resolve => {
    const viaPlayer = () => {
      const c = ac(); if (!c) return resolve(null)
      try { c.decodeAudioData(data, b => resolve(b), () => resolve(null)) } catch { resolve(null) }
    }
    try {
      const Offline = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
      const oc: OfflineAudioContext = new Offline(1, 1, DECODE_RATE)
      // the copy keeps the data for the fallback: a failed decode may have detached the original
      const copy = data.slice(0)
      oc.decodeAudioData(data, b => resolve(b), () => { data = copy; viaPlayer() })
    } catch { viaPlayer() }
  })
}

function keepRecent(except: string) {
  let total = 0
  for (const v of seconds.values()) total += v
  for (const g of [...buffers.keys()]) {
    if (total <= KEEP_SECONDS) break
    if (g === except) continue
    total -= seconds.get(g) || 0
    buffers.delete(g); seconds.delete(g)
  }
}

function loadBuffer(group: string): Promise<AudioBuffer | null> {
  let p = buffers.get(group)
  if (p) { buffers.delete(group); buffers.set(group, p); return p }
  p = getAudio(`${group}.mp3`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer() })
    .then(decode)
    .then(b => { if (b) { seconds.set(group, b.duration); keepRecent(group) } else buffers.delete(group); return b })
    .catch(() => { buffers.delete(group); return null })
  buffers.set(group, p)
  return p
}

/** Gets a unit's or module's recordings ready without decoding them: bought audio is downloaded and
 *  kept on the phone, so the first sentence plays without waiting for the network. */
export function preload(group: string) {
  loadIndex().then(async m => {
    if (!m || !remote) return
    for (const f of files.get(group) || []) { try { await remote(`${f}.mp3`) } catch { return } }
  })
}
export function preloadIndex() { loadIndex() }

// ---------------- speed ----------------
// Slower speech keeps the voice's pitch: the clip is stretched in time (WSOLA), rather than played slower,
// which would make it sound low and drawn out.
let speechRate = 1
/** The speed chosen in the settings: 1 normal, less than 1 slower. */
export function setSpeechRate(r: number) { speechRate = r }
export function getSpeechRate() { return speechRate }

function stretch(x: Float32Array, sr: number, rate: number): Float32Array {
  const win = Math.round(sr * 0.03), hop = win >> 1, tol = Math.round(sr * 0.008)
  const inHop = hop * rate
  const outLen = Math.round(x.length / rate)
  const y = new Float32Array(outLen + win), wsum = new Float32Array(outLen + win)
  const w = new Float32Array(win)
  for (let i = 0; i < win; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1))
  let prev = -1
  for (let k = 0, out = 0; out < outLen; k++, out += hop) {
    const nominal = Math.round(k * inHop)
    if (nominal + win >= x.length) break
    let best = nominal
    if (prev >= 0 && prev + hop + win < x.length) {
      // the window that best continues where the previous one would have gone on
      const target = prev + hop
      let bestScore = -Infinity
      for (let d = -tol; d <= tol; d++) {
        const q = nominal + d
        if (q < 0 || q + win >= x.length) continue
        let sc = 0
        for (let i = 0; i < hop; i += 2) sc += x[q + i] * x[target + i]
        if (sc > bestScore) { bestScore = sc; best = q }
      }
    }
    for (let i = 0; i < win; i++) { y[out + i] += x[best + i] * w[i]; wsum[out + i] += w[i] }
    prev = best
  }
  for (let i = 0; i < outLen; i++) if (wsum[i] > 1e-3) y[i] /= wsum[i]
  return y.subarray(0, outLen)
}

const clips = new Map<string, AudioBuffer>()
/** One clip in a buffer of its own, at the given speed. */
async function clipBuffer(clip: Clip, rate: number): Promise<AudioBuffer | null> {
  const r = rate >= 0.97 ? 1 : Math.max(0.5, rate)
  const key = `${clip.group}|${clip.start}|${r}`
  const hit = clips.get(key)
  if (hit) return hit
  const buf = await loadBuffer(clip.group)
  const c = ac()
  if (!buf || !c) return null
  const sr = buf.sampleRate
  const from = Math.floor(clip.start * sr), to = Math.min(buf.length, Math.ceil((clip.start + clip.dur) * sr))
  const part = buf.getChannelData(0).slice(from, to)
  const data = r === 1 ? part : stretch(part, sr, r)
  const out = c.createBuffer(1, Math.max(1, data.length), sr)
  out.getChannelData(0).set(data)
  clips.set(key, out)
  if (clips.size > 24) clips.delete(clips.keys().next().value as string)
  return out
}

let current: AudioBufferSourceNode | null = null
let playToken = 0
function stopClip() { if (current) { try { current.onended = null; current.stop() } catch { /* ignore */ } current = null } }

async function playClip(clip: Clip, rate: number, onEnd?: () => void): Promise<boolean> {
  const token = ++playToken
  const buf = await clipBuffer(clip, rate)
  const c = ac()
  if (!buf || !c || token !== playToken) return !!buf && token !== playToken
  stopClip()
  const src = c.createBufferSource()
  src.buffer = buf
  src.connect(c.destination)
  src.onended = () => { if (current === src) current = null; onEnd?.() }
  try { src.start(0) } catch { onEnd?.(); return false }
  current = src
  return true
}

// ---------------- Web Speech fallback ----------------
let voices: SpeechSynthesisVoice[] = []
function loadVoices() { if (typeof speechSynthesis === 'undefined') return; voices = speechSynthesis.getVoices() }
if (typeof speechSynthesis !== 'undefined') { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices }

function pickVoice(lang: 'en' | 'ar'): SpeechSynthesisVoice | undefined {
  if (!voices.length) loadVoices()
  const pref = lang === 'en' ? [/en[-_]US/i, /en[-_]GB/i, /^en/i] : [/ar[-_]SA/i, /ar[-_]EG/i, /^ar/i]
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

function ttsSpeak(text: string, lang: 'en' | 'ar', rate: number, onEnd?: () => void) {
  if (!ttsSupported()) { onEnd?.(); return }
  const go = () => {
    try {
      const u = new SpeechSynthesisUtterance(text)
      const v = pickVoice(lang)
      if (v) u.voice = v
      u.lang = lang === 'en' ? 'en-US' : 'ar-SA'
      u.rate = rate
      u.pitch = 1
      let ended = false
      const done = () => { if (!ended) { ended = true; onEnd?.() } }
      u.onend = done; u.onerror = done
      speechSynthesis.speak(u)
      // Chrome sometimes never fires onend; make sure the UI is released
      setTimeout(done, 1500 + text.length * 90)
    } catch { onEnd?.() }
  }
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); setTimeout(go, 80) } else go()
  } catch { go() }
}

// ---------------- public API ----------------
export function speak(text: string, opts: { lang?: 'en' | 'ar'; rate?: number; onEnd?: () => void } = {}) {
  stopReading()
  const lang = opts.lang ?? 'en'
  const rate = opts.rate ?? speechRate
  stopSpeaking()
  if (lang === 'en') {
    loadIndex().then(async map => {
      const clip = map?.get(norm(text))
      if (clip) {
        const ok = await playClip(clip, rate, opts.onEnd)
        if (ok) return
      }
      ttsSpeak(text, lang, rate * 0.9, opts.onEnd)
    })
  } else ttsSpeak(text, lang, rate, opts.onEnd)
}

// ---------------- read aloud with a moving highlight ----------------
export interface ReadHandle { stop(): void }

let reader: ReadHandle | null = null
export function stopReading() { reader?.stop(); reader = null }

/** Plays the sentences in order and reports which word is being said. */
export function readAloud(sentences: string[], opts: {
  rate?: number
  onSentence?: (index: number) => void
  onWord?: (sentence: number, word: number) => void
  onEnd?: () => void
} = {}): ReadHandle {
  stopReading()
  stopSpeaking()
  const rate = opts.rate ?? speechRate
  let cancelled = false
  let raf = 0
  let node: AudioBufferSourceNode | null = null

  // Words are weighted by their length so the highlight tracks the voice closely
  // inside a sentence; sentence boundaries themselves come from the recording.
  const wordBounds = (text: string) => {
    const words = text.split(/\s+/).filter(Boolean)
    const weights = words.map(w => w.length + 1)
    const total = weights.reduce((a, b) => a + b, 0) || 1
    const bounds: number[] = []
    let acc = 0
    for (const w of weights) { bounds.push(acc / total); acc += w }
    return { words, bounds }
  }

  const play = async (i: number) => {
    if (cancelled) return
    if (i >= sentences.length) { opts.onEnd?.(); return }
    const text = sentences[i]
    opts.onSentence?.(i)
    const map = await loadIndex()
    const clip = map?.get(norm(text))
    if (clip) {
      const buf = await clipBuffer(clip, rate)
      const c = ac()
      if (buf && c && !cancelled) {
        const { words, bounds } = wordBounds(text)
        const src = c.createBufferSource()
        src.buffer = buf
        src.connect(c.destination)
        const startAt = c.currentTime + 0.02
        const span = buf.duration
        src.onended = () => { if (!cancelled && node === src) play(i + 1) }
        try { src.start(startAt) } catch { play(i + 1); return }
        node = src
        // the next sentence may be in another file: have it ready when this one ends
        const next = i + 1 < sentences.length ? map?.get(norm(sentences[i + 1])) : undefined
        if (next && next.group !== clip.group) loadBuffer(next.group)
        let last = -1
        const tick = () => {
          if (cancelled) return
          const p = (c.currentTime - startAt) / span
          if (p >= 0) {
            let idx = 0
            while (idx + 1 < bounds.length && bounds[idx + 1] <= p) idx++
            idx = Math.min(idx, words.length - 1)
            if (idx !== last) { last = idx; opts.onWord?.(i, idx) }
          }
          if (p < 1.05) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return
      }
    }
    // no recording for this sentence: speak it and follow the browser's word boundaries
    if (!ttsSupported()) { play(i + 1); return }
    try {
      const u = new SpeechSynthesisUtterance(text)
      const v = pickVoice('en')
      if (v) u.voice = v
      u.lang = 'en-US'
      u.rate = rate * 0.9
      const { words } = wordBounds(text)
      const starts: number[] = []
      let pos = 0
      for (const w of words) { const at = text.indexOf(w, pos); starts.push(at); pos = at + w.length }
      u.onboundary = (e: SpeechSynthesisEvent) => {
        if (cancelled || e.name === 'sentence') return
        let idx = 0
        while (idx + 1 < starts.length && starts[idx + 1] <= e.charIndex) idx++
        opts.onWord?.(i, idx)
      }
      let advanced = false
      const nextOne = () => { if (!advanced && !cancelled) { advanced = true; play(i + 1) } }
      u.onend = nextOne
      u.onerror = nextOne
      speechSynthesis.speak(u)
    } catch { play(i + 1) }
  }

  play(0)
  const handle: ReadHandle = {
    stop() {
      cancelled = true
      cancelAnimationFrame(raf)
      if (node) { try { node.onended = null; node.stop() } catch { /* ignore */ } node = null }
      if (ttsSupported()) { try { speechSynthesis.cancel() } catch { /* ignore */ } }
    },
  }
  reader = handle
  return handle
}

export function stopSpeaking() {
  playToken++
  stopClip()
  if (ttsSupported()) { try { speechSynthesis.cancel() } catch { /* ignore */ } }
}

export function audioStatus() {
  return { sprites: indexStatus, tts: ttsSupported(), voices: voices.length, unlocked, ctx: ctx?.state ?? 'none' }
}

// ---------------- sound effects ----------------
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

// ---------------- speech recognition (optional) ----------------
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

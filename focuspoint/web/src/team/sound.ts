// A short, soft two-note chime for new team events (WebAudio, no asset). Silent when the browser blocks audio
// before a user gesture or when the user turned the sound off in the panel.
const MUTE_KEY = 'fp_team_mute'
let ctx: AudioContext | null = null

export function soundMuted(): boolean { try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false } }
export function setSoundMuted(v: boolean) { try { v ? localStorage.setItem(MUTE_KEY, '1') : localStorage.removeItem(MUTE_KEY) } catch { /* ignore */ } }

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try { ctx = new Ctor() } catch { return null }
  return ctx
}

/** Warm the audio context on the first gesture so later chimes are allowed to play. */
export function primeSound() {
  const c = context()
  if (c && c.state === 'suspended') c.resume().catch(() => { /* ignore */ })
}

/** Play the chime (G5 → C6, ~0.5 s). Resolves to false when audio is unavailable. */
export async function playChime(): Promise<boolean> {
  if (soundMuted()) return false
  const c = context()
  if (!c) return false
  try {
    if (c.state === 'suspended') await c.resume()
    if (c.state !== 'running') return false
    const t0 = c.currentTime
    const master = c.createGain()
    master.gain.value = 0.18
    master.connect(c.destination)
    const note = (freq: number, at: number, dur: number) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(1, at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
      o.connect(g).connect(master)
      o.start(at)
      o.stop(at + dur + 0.02)
    }
    note(784, t0, 0.22)
    note(1047, t0 + 0.16, 0.34)
    return true
  } catch { return false }
}

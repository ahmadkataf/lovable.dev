// Short sounds and vibration for scans and payments; nothing to download.
import { platform } from './platform'

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}
function tone(freq: number, ms: number, at = 0, type: OscillatorType = 'sine', gain = 0.25): void {
  const a = audio(); if (!a) return
  const o = a.createOscillator(), g = a.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, a.currentTime + at)
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + ms / 1000)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + at); o.stop(a.currentTime + at + ms / 1000 + 0.02)
}
let enabled = { sound: true, vibrate: true }
export function configureFeedback(s: { sound: boolean; vibrate: boolean }): void { enabled = s }

export function beep(kind: 'scan' | 'ok' | 'error' | 'tap' = 'scan'): void {
  if (enabled.sound) {
    if (kind === 'scan') tone(1760, 70, 0, 'square', 0.12)
    else if (kind === 'ok') { tone(880, 90); tone(1320, 140, 0.09) }
    else if (kind === 'error') { tone(220, 160, 0, 'sawtooth', 0.2); tone(180, 220, 0.15, 'sawtooth', 0.2) }
    else tone(1200, 30, 0, 'sine', 0.06)
  }
  if (enabled.vibrate) haptic(kind === 'error' ? 200 : kind === 'ok' ? 60 : 30)
}
export function haptic(ms: number): void {
  try {
    if (platform.kind === 'android' && window.PosAndroid?.vibrate) window.PosAndroid.vibrate(ms)
    else if (navigator.vibrate) navigator.vibrate(ms)
  } catch { /* no vibration on this device */ }
}

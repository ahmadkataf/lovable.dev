// Stop-motion engine for a time-driven page: window.render(t) poses every piece for time t (seconds).
// The look comes from three things real stop-motion has: poses change only 12 times a second (each held for two
// 24-fps frames), every piece sits a little differently in each pose (hand placement), and the light breathes a tiny
// bit between poses. Everything is deterministic (seeded), so a frame always renders the same.
'use strict'

const POSES = 12                                   // poses per second ("on twos" at 24 fps)
const poseOf = (t) => Math.floor(t * POSES + 1e-6)
const poseTime = (t) => poseOf(t) / POSES          // time snapped to the pose grid

// ---------- seeded randomness ----------
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const rand = (key, n) => mulberry(hashStr(key) ^ Math.imul(n + 1, 2654435761))
/** Hand-placement wobble for piece `id` in pose `p`: a few px and a fraction of a degree, steady when `still`. */
function wobble(id, p, amp = 1) {
  const r = rand(id, p)
  return { x: (r() - 0.5) * 2.4 * amp, y: (r() - 0.5) * 2.4 * amp, r: (r() - 0.5) * 0.8 * amp, s: 1 + (r() - 0.5) * 0.006 * amp }
}

// ---------- easing (evaluated on the pose grid, so motion moves in visible steps) ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const lerp = (a, b, k) => a + (b - a) * k
const ease = { out: (k) => 1 - Math.pow(1 - k, 3), in: (k) => k * k * k, inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  back: (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2) } }
/** 0→1 progress of [t0, t0+dur] at time t (already snapped by the caller). */
const prog = (t, t0, dur, e = ease.out) => e(clamp((t - t0) / dur))

// ---------- pieces ----------
const STAGE = () => document.getElementById('stage')
const pieces = []
/**
 * A piece of paper on the desk. state(tq, local) returns {x, y, r, s, o, z} for the snapped time; the engine adds the
 * hand wobble (unless the piece is moving fast — a moving hand does not wobble in place) and the shadow.
 */
function piece(id, html, cls, state, opts = {}) {
  const el = document.createElement('div')
  el.className = 'pc ' + (cls || '')
  el.innerHTML = html
  el.dataset.id = id
  STAGE().appendChild(el)
  const p = { id, el, state, amp: opts.amp ?? 1, w: opts.w, h: opts.h }
  if (opts.w) el.style.width = opts.w + 'px'
  if (opts.h) el.style.height = opts.h + 'px'
  pieces.push(p)
  return p
}

function placePieces(tq, p) {
  for (const pc of pieces) {
    const st = pc.state(tq)
    if (!st || st.o === 0) { pc.el.style.display = 'none'; continue }
    pc.el.style.display = ''
    const w = st.still ? { x: 0, y: 0, r: 0, s: 1 } : wobble(pc.id, p, pc.amp * (st.amp ?? 1))
    const x = st.x + w.x, y = st.y + w.y, r = (st.r || 0) + w.r, s = (st.s ?? 1) * w.s
    pc.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${r}deg) scale(${s})`
    pc.el.style.opacity = st.o ?? 1
    pc.el.style.zIndex = st.z ?? 10
    if (st.extra) st.extra(pc.el)
  }
}

// ---------- light ----------
function breathe(p, tq) {
  const r = rand('light', p)
  const scene = window.sceneLight ? window.sceneLight(tq) : 1   // e.g. the desk lamp "switching on"
  const b = scene * (1 + (r() - 0.5) * 0.025)                    // ±1.25 % brightness between poses
  document.getElementById('light').style.opacity = String(clamp((b - 0.985) * 6, 0, 0.25))
  STAGE().style.filter = `brightness(${b.toFixed(4)})`
}

// ---------- the main render ----------
window.render = function (t) {
  const p = poseOf(t), tq = poseTime(t)
  breathe(p, tq)
  placePieces(tq, p)
  if (window.afterRender) window.afterRender(tq, p)
}

Object.assign(window, { POSES, poseOf, poseTime, rand, wobble, clamp, lerp, ease, prog, piece, pieces })

// Montage timeline, timed to the voice (voice/timings.js). window.render(t) draws the frame at t seconds.
// Real photos fill the frame and drift sideways (no zoom). A wine panel wipes across between lines; cuts inside a
// line are short cross-fades on the voice's pauses. One caption at a time.
'use strict'
const T = window.TIMINGS
const L = Object.fromEntries(T.lines.map((l) => [l.id, l]))
const pauseEnd = (id, i, fb) => L[id].pauses?.[i]?.[1] ?? fb
window.DURATION = Math.ceil(T.last_voice + 3)

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const lerp = (a, b, k) => a + (b - a) * k
const ease = { out: (k) => 1 - Math.pow(1 - k, 3), inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) }
const prog = (t, t0, d, e = ease.out) => e(clamp((t - t0) / d))
const P = (n) => `../stopmotion/photos/p${n}.jpg`
const $ = (s) => document.querySelector(s)
const stage = $('#stage')

// ---------- shots ----------
// from/to: image left offset in px (photo is 1440 px wide at 1920 high, so the range is 0 … -360)
const S = (src, start, end, from, to, fade = 0) => ({ src, start, end, from, to, fade })
const shots = [
  S(P(7), 0, L.L2.start, -60, -300),
  S(P(2), L.L2.start, L.L3.start, -330, -120),
  S(P(1), L.L3.start, L.L4.start, -40, -260),
  S(P(6), L.L4.start, pauseEnd('L4', 0, 16.5), -300, -160),
  S(P(12), pauseEnd('L4', 0, 16.5), L.L5.start, -120, -230, 0.3),
  S(P(10), L.L5.start, 20.85, -60, -200),
  S(P(4), 20.85, L.L6.start, -260, -140, 0.3),
  S(P(9), L.L6.start, L.L7.start, -40, -300),
  S(P(3), L.L7.start, L.L8.start, -280, -80),
  S(P(8), L.L8.start, L.L9.start, -120, -260),
  S(P(5), L.L9.start, L.L10.start, -300, -60),
]
for (const s of shots) {
  s.el = document.createElement('div'); s.el.className = 'shot'
  s.el.innerHTML = `<img src="${s.src}">`
  stage.insertBefore(s.el, $('.shade'))
}
// wipes on every line change (the last one reveals the end card)
const WIPE = 0.62
const wipes = T.lines.slice(1).map((l) => l.start - 0.08)

// ---------- captions ----------
const caps = []
function cap(text, at, until, o = {}) {
  const el = document.createElement('div')
  el.className = 'cap' + (o.wine ? ' wine' : '')
  el.innerHTML = `<div class="card">${text}</div>` + (o.sub ? `<span class="sub">${o.sub}</span>` : '')
  el.style.bottom = (o.bottom ?? 300) + 'px'
  stage.appendChild(el)
  // keep every caption on one line: shrink long ones (fonts are loaded before the first render)
  el._fit = () => { const c = el.querySelector('.card'); let f = 74; c.style.whiteSpace = 'nowrap'
    while (c.offsetWidth > 940 && f > 50) { f -= 2; c.style.fontSize = f + 'px' } }
  caps.push({ el, at, until })
}
const after = (id) => L[id].start + 0.42           // a caption lands once the wipe has passed
const before = (id) => L[id].start - 0.32          // …and leaves before the next wipe
cap('مكان يعيد إليك تركيزك', 0.55, before('L2'))
cap('المشروع الأول من نوعه في درعا', after('L2'), before('L3'), { wine: true })
cap('مساحة عمل ودراسة', after('L3'), before('L4'))
cap('غرف خاصة هادئة', after('L4'), before('L5'), { sub: 'لك وحدك أو لفريقك' })
cap('قاعة للاجتماعات والدورات', after('L5'), before('L6'), { wine: true })
cap('إطلالة وضوء طبيعي', after('L6'), before('L7'))
cap('قهوتك تصل إلى طاولتك', after('L7'), before('L8'), { wine: true, sub: 'إنترنت سريع · تكييف' })
cap('احجز من التطبيق أو الموقع', after('L8'), pauseEnd('L8', 0, 36.3) - 0.2, { bottom: 220 })
cap('شام كاش أو الدفع عند الوصول', pauseEnd('L8', 0, 36.3) + 0.05, before('L9'), { wine: true, bottom: 220 })
cap('يوميا من 9 صباحا حتى 11 ليلا', after('L9'), before('L10'), { sub: 'شارع المجمع الحكومي · درعا' })

// ---------- render ----------
window.render = function (t) {
  if (!window._fitted) { caps.forEach((c) => c.el._fit()); window._fitted = true }
  // shots: the one under the wipe swaps at the wipe's middle; inner cuts cross-fade
  for (const s of shots) {
    const visible = t >= s.start - (s.fade || 0) && t < s.end + 0.0001
    if (!visible) { s.el.style.opacity = '0'; continue }
    // drift runs a little past both ends so the motion never stops during a wipe
    const k = clamp((t - s.start + 0.4) / (s.end - s.start + 0.8))
    s.el.querySelector('img').style.transform = `translateX(${lerp(s.from, s.to, ease.inOut(k)).toFixed(2)}px)`
    s.el.style.opacity = s.fade ? String(clamp((t - (s.start - s.fade)) / s.fade)) : '1'
    s.el.style.zIndex = s.fade ? 2 : 1
  }
  // the wine wipe: right → left, covering the frame at its middle
  const w = $('#wipe')
  const active = wipes.find((c) => t >= c - WIPE / 2 && t < c + WIPE / 2)
  if (active === undefined) w.style.display = 'none'
  else {
    w.style.display = ''
    const k = ease.inOut((t - (active - WIPE / 2)) / WIPE)
    w.style.left = lerp(1140, -1420, k).toFixed(1) + 'px'
  }
  // captions: wipe in from the right (Arabic reading start), rise 30 px; fade and drop on the way out
  for (const c of caps) {
    if (t < c.at || t > c.until + 0.3) { c.el.style.opacity = '0'; continue }
    const kin = prog(t, c.at, 0.5), kout = prog(t, c.until, 0.3, (x) => x * x)
    c.el.style.opacity = String(Math.min(clamp(kin * 3), 1 - kout))
    c.el.style.clipPath = `inset(-60px 0 -60px ${((1 - kin) * 100).toFixed(1)}%)`
    c.el.style.transform = `translateY(${((1 - kin) * 30 + kout * 24).toFixed(1)}px)`
  }
  // the phone with the booking screen rises during L8
  const ph = $('#phone')
  const pin = prog(t, L.L8.start + 0.35, 0.7), pout = prog(t, L.L9.start - 0.4, 0.35, (x) => x * x)
  ph.style.opacity = t < L.L8.start + 0.35 || pout >= 1 ? '0' : '1'
  ph.style.transform = `translateY(${((1 - pin) * 1500 + pout * 1500).toFixed(1)}px) rotate(${((1 - pin) * 6).toFixed(2)}deg)`
  // end card under the last wipe, then its parts one after another
  const endAt = wipes[wipes.length - 1]
  $('#end').style.opacity = t >= endAt ? '1' : '0'
  $('#bug').style.opacity = t >= endAt ? '0' : '1'
  $('.shade').style.opacity = t >= endAt ? '0' : '1'
  const tag = pauseEnd('L10', 0, endAt + 1.4)               // the tagline lands with «حيث يبدأ التركيز»
  ;[['#e1', endAt + 0.3], ['#e2', tag], ['#e3', tag + 0.2], ['#e4', tag + 0.45]].forEach(([sel, t0]) => {
    const k = prog(t, t0, 0.55), el = $(sel)
    el.style.opacity = String(k)
    el.style.transform = `translateY(${((1 - k) * 40).toFixed(1)}px)`
  })
}

// The promo ad's frames, drawn in the browser: window.frame(t) lays out the whole picture at second t (every frame is a
// pure function of t, so the render is exact and repeatable) and resolves when its images are decoded. The data, D, is
// put in the page by store/scripts/ad-promo.mjs: the layout of the format, the scenes with every time already resolved
// (the narration's words), the footage frames and the icons.
/* global D */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const prog = (t, a, d) => clamp((t - a) / d, 0, 1)
const ease = {
  out: p => 1 - Math.pow(1 - p, 3),
  inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  back: p => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) },
}
const f3 = x => (Math.round(x * 1000) / 1000).toString()
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/(\d+(?:[.,]\d+)?\s?\$)/g, '⁦$1⁩')   // a price reads "59$" inside Arabic text
const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${D.icons[name] || ''}</svg>`
const L = D.L

/** Appearing at a: fade and rise with a little overshoot. */
function pop(t, a, d = 0.34, dist = 28) {
  const p = prog(t, a, d), e = ease.back(p)
  return `opacity:${f3(Math.min(1, p * 2.4))};transform:translateY(${f3((1 - e) * dist)}px) scale(${f3(0.88 + 0.12 * e)})`
}
/** Slammed in at a: from big to its size. */
function slam(t, a, d = 0.32, from = 2.1) {
  const p = prog(t, a, d), e = ease.back(p)
  return `opacity:${f3(Math.min(1, p * 3))};transform:scale(${f3(from + (1 - from) * e)})`
}
const gone = (t, a, d = 0.22) => 1 - prog(t, a, d)

// ---- shared layers -------------------------------------------------------------------------------------------------
function background(t) {
  const k = Math.sin(t * 0.6) * 0.5 + 0.5
  return `<div class="bg"><div class="glow" style="width:${L.W * 0.9}px;height:${L.H * 0.42}px;left:${L.W * (0.02 + 0.06 * k)}px;top:${L.H * (0.34 + 0.04 * k)}px;background:rgba(20,184,166,.30)"></div>
  <div class="glow" style="width:${L.W * 0.6}px;height:${L.W * 0.6}px;left:${L.W * (0.5 - 0.05 * k)}px;top:${-L.W * 0.18}px;background:rgba(94,234,212,.16)"></div>
  <div class="glow" style="width:${L.W * 0.5}px;height:${L.W * 0.4}px;left:${-L.W * 0.18}px;top:${L.H * 0.74}px;background:rgba(30,190,93,.12)"></div><div class="dots"></div></div>`
}

/** The wall of the app's screens, tilted, drifting; brighter and faster after the drop. */
function wall(t, { shade = 0.8, speed = 1, tilt = 1 } = {}) {
  const tiles = D.wall
  let cells = ''
  for (let i = 0; i < L.wall.cols * L.wall.rows; i++) cells += `<img src="${tiles[(i * 5 + Math.floor(i / L.wall.cols)) % tiles.length]}">`
  const dx = -120 + t * 26 * speed, dy = -60 + t * 12 * speed
  return `<div class="wall"><div class="plane" style="grid-template-columns:repeat(${L.wall.cols},640px);transform:translate(-50%,-50%) rotateX(${f3(26 * tilt)}deg) rotateZ(${f3(-16 * tilt)}deg) translate3d(${f3(dx)}px,${f3(dy)}px,0) scale(${L.wall.scale})">${cells}</div>
    <div class="shade" style="opacity:${f3(shade)}"></div></div>`
}

const strip = () => (L.strip ? '<div class="strip"><span>جرّبه ببلاش <b>7</b> أيام<em></em><b>59$</b> مرّة وحدة<em></em><b>dentora.raqeem.dev</b></span></div>' : '')
const brand = (t, a = -1) => `<header class="brand" style="${a >= 0 ? pop(t, a) : ''}">${D.appIcon}<b>Dentora</b></header>`

/** A headline, word by word; the words after `split` in the brand gradient. */
function words(t, a, text, split = 99, stagger = 0.07) {
  return text.split(/\s+/).map((w, i) => `<span class="w${i >= split ? ' g' : ''}" style="${pop(t, a + i * stagger, 0.3, 22)}">${esc(w)}</span>`).join(' ')
}

/** The caption: the words of the sentence, lit as they are spoken. */
function caption(t, cap) {
  if (!cap) return ''
  const html = cap.map((w, i) => {
    const state = t >= w.a ? (t < w.b + 0.04 ? 'cur' : 'done') : 'next'
    return `<span class="${state}">${esc(w.text)}</span>${i < cap.length - 1 ? (w.nb ? '&nbsp;' : ' ') : ''}`
  }).join('')
  return `<section class="cap" style="${pop(t, cap[0].a - 0.25, 0.25, 12)}"><p>${html}</p></section>`
}

function chips(t, list) {
  if (!list || !list.length) return ''
  const shown = list.filter(c => t >= c.at)
  if (!shown.length) return ''
  return `<div class="chips">${shown.map(c => `<span class="chip ${c.tone || ''}" style="${pop(t, c.at, 0.32, 20)}">${c.dot ? `<i class="dot" style="background:${c.dot}"></i>` : ''}${c.icon ? icon(c.icon) : ''}${esc(c.text)}</span>`).join('')}</div>`
}

// ---- the footage: a clip of the course framed by a camera ------------------------------------------------------------
function region(cam, t, from, cw, ch) {
  let r = cam[0].r.slice()
  for (let i = 1; i < cam.length; i++) {
    const p = ease.inOut(prog(t, cam[i].at, cam[i].dur || 0.55))
    if (p <= 0) break
    r = r.map((v, k) => v + (cam[i].r[k] - v) * p)
  }
  let [cx, cy, w] = r
  w = Math.min(w, 1920, 1080 * cw / ch)
  // a slow push in (the picture never stands still), anchored at the right edge: Arabic lines start there
  const right = cx + w / 2
  w /= 1 + 0.018 * Math.max(0, t - from)
  const h = w * ch / cw
  const x = clamp(right - w, 0, 1920 - w), y = clamp(cy - h / 2, 0, 1080 - h)
  return { x, y, w, h, s: cw / w }
}

function footage(t, clip, cw, ch) {
  const c = region(clip.cam, t, clip.from, cw, ch)
  const fr = D.frames[clip.key]
  const k = clamp(Math.floor((t - clip.from) * D.fps + 1e-6), 0, fr.n - 1)
  const src = `${fr.dir}/${String(k + 1).padStart(5, '0')}.jpg`
  const rings = (clip.rings || []).filter(g => t >= g.at && (!g.until || t < g.until + 0.25)).map(g => {
    const [rx, ry, rw, rh] = g.r, pad = 8
    const p = prog(t, g.at, 0.3), e = ease.back(p), out = g.until ? gone(t, g.until, 0.25) : 1
    const pulse = 0.5 + 0.5 * Math.sin((t - g.at) * 7)
    return `<div class="ring ${g.tone || ''}" style="left:${f3((rx - c.x) * c.s - pad)}px;top:${f3((ry - c.y) * c.s - pad)}px;width:${f3(rw * c.s + 2 * pad)}px;height:${f3(rh * c.s + 2 * pad)}px;opacity:${f3(Math.min(1, p * 2) * out)};transform:scale(${f3(1.18 - 0.18 * e)});--p:${f3(pulse)}"></div>`
  }).join('')
  return `<img class="foot" src="${src}" style="transform:translate(${f3(-c.x * c.s)}px,${f3(-c.y * c.s)}px) scale(${f3(c.s)})">${rings}`
}

function windowFrame(t, inner, enter, { left, top, width, height } = L.win) {
  const p = ease.out(prog(t, enter, 0.32))
  return `<div class="win" style="left:${left}px;top:${top}px;width:${width}px;height:${height + L.win.bar}px;opacity:${f3(Math.min(1, p * 1.6))};transform:translateX(${f3((1 - p) * -90)}px) scale(${f3(0.94 + 0.06 * p)})">
    <div class="bar"><span class="ctl"><i></i><i class="max"></i><i class="x">${icon('x')}</i></span></div><div class="screen" style="height:${height}px">${inner}</div></div>`
}

const activeClip = (clips, t) => { let c = clips[0]; for (const k of clips) if (t >= k.from) c = k; return c }

// ---- the scenes ------------------------------------------------------------------------------------------------------
/** Shown dim from the first frame (so the question is there before the scroll), lit as each word is spoken. */
function lit(t, a) {
  if (t < a) return 'opacity:.3'
  const p = prog(t, a, 0.3)
  return `opacity:${f3(0.3 + 0.7 * Math.min(1, p * 2.4))};transform:scale(${f3(1 + 0.14 * (1 - ease.out(p)))})`
}

function hook(t, s) {
  const w = s.words, ask = s.ask
  const p3 = prog(t, w[4].a, 0.32)
  const l3 = t < w[4].a ? 'opacity:.25' : `opacity:${f3(0.25 + 0.75 * Math.min(1, p3 * 3))};transform:scale(${f3(1.7 - 0.7 * ease.back(p3))})`
  return `${wall(t, { shade: 0.74, speed: 1.4 })}
  <section class="hook">
    <p class="l1"><span style="${lit(t, w[0].a)}">${esc(w[0].text)}</span></p>
    <p class="l2">${[1, 2, 3].map(i => `<span style="${lit(t, w[i].a)}">${esc(w[i].text)}</span>`).join(' ')}</p>
    <p class="l3" style="${l3}"><em>${esc(w[4].text)}</em></p>
    <p class="l4">${ask.map(x => `<span style="${lit(t, x.a)}">${esc(x.text)}</span>`).join(' ')}</p>
  </section>`
}

function reveal(t, s) {
  const w = s.words, drop = s.drop
  const before = false   // the scene starts at the drop: the question was asked over the hook
  const q = 1
  const burst = prog(t, drop, 0.7)
  return `${wall(t, { shade: before ? 0.84 : 0.84 - 0.18 * q, speed: before ? 1 : 2.4, tilt: 1 - 0.25 * q })}
  <section class="ask" style="top:${L.reveal.askUp}px;font-size:${f3(L.reveal.askSize * 0.55)}px;opacity:.55">${esc(w[0].text)} ${esc(w[1].text)}</section>
  ${before ? '' : `<div class="burst" style="top:${L.reveal.iconTop + L.reveal.icon / 2}px;width:${f3(L.reveal.icon * (1 + 2.6 * ease.out(burst)))}px;height:${f3(L.reveal.icon * (1 + 2.6 * ease.out(burst)))}px;opacity:${f3(0.9 * (1 - burst))}"></div>
  <div class="logo-big" style="top:${L.reveal.iconTop}px;${slam(t, drop, 0.36, 2.6)}">${D.appIconBig}</div>
  <div class="mark" style="top:${L.reveal.markTop}px;${pop(t, drop + 0.12, 0.34)}"><b>Dentora</b><small>لإدارة عيادات الأسنان</small></div>
  <section class="tag" style="top:${L.reveal.tagTop}px">
    <p class="t1">${[4, 5].map(i => `<span style="${pop(t, w[i].a, 0.3)}">${esc(w[i].text)}</span>`).join(' ')}</p>
    <p class="t2">${[6, 7].map((i, j) => `<span style="${pop(t, w[6].a + j * 0.1, 0.3)}">${esc(w[i].text)}</span>`).join(' ')}</p>
  </section>`}
  <div class="flash" style="opacity:${f3(before ? 0 : 0.75 * (1 - prog(t, drop, 0.28)))}"></div>`
}

function head(t, s, kicker, title, split, a = s.start) {
  return `<div class="kicker" style="${pop(t, a + 0.02, 0.3, 16)}"><span>${icon(s.icon)}${esc(kicker)}</span></div>
  <section class="title"><h1>${words(t, a + 0.06, title, split)}</h1></section>`
}

function feature(t, s) {
  const clip = activeClip(s.clips, t)
  const cut = clip.from > s.start + 0.01 ? clip.from : -1
  const flash = Math.max(1 - prog(t, s.start, 0.22), cut > 0 ? 1 - prog(t, cut, 0.18) : 0)
  return `${background(t)}${brand(t)}${head(t, s, s.kicker, s.title, s.split)}
  ${windowFrame(t, footage(t, clip, L.win.width, L.win.height), s.start)}
  ${chips(t, s.chips)}${caption(t, s.cap)}${strip()}
  <div class="flash" style="opacity:${f3(0.32 * flash)}"></div>`
}

function montage(t, s) {
  const items = s.items
  let it = null
  for (const x of items) if (t >= x.at) it = x
  if (!it) {   // "and on top of that…": the dashboard behind the line
    return `${background(t)}${brand(t)}${head(t, s, s.kicker, s.intro, 99)}
    ${windowFrame(t, footage(t, s.introClip, L.win.width, L.win.height), s.start)}${caption(t, s.cap)}${strip()}`
  }
  const idx = items.indexOf(it)
  const punch = 1 - ease.out(prog(t, it.at, 0.24))
  const dots = items.map((x, i) => `<i class="${i === idx ? 'on' : i < idx ? 'done' : ''}"></i>`).join('')
  return `${background(t)}${brand(t)}
  <div class="kicker" style="opacity:1"><span>${icon(it.icon)}${esc(it.sub)}</span></div>
  <section class="title"><h1 style="${slam(t, it.at, 0.26, 1.35)}"><span class="g">${esc(it.label)}</span></h1></section>
  <div class="win" style="left:${L.win.left}px;top:${L.win.top}px;width:${L.win.width}px;height:${L.win.height + L.win.bar}px;transform:scale(${f3(1 + 0.05 * punch)})">
    <div class="bar"><span class="ctl"><i></i><i class="max"></i><i class="x">${icon('x')}</i></span></div><div class="screen" style="height:${L.win.height}px">${footage(t, it.clip, L.win.width, L.win.height)}</div></div>
  <div class="steps">${dots}</div>${caption(t, s.cap)}${strip()}
  <div class="flash" style="opacity:${f3(0.45 * punch)}"></div>`
}

function offline(t, s) {
  const O = L.offline, w = s.at
  const phoneIn = ease.out(prog(t, s.start + 0.15, 0.4))
  const badge = t >= w.net ? `<div class="netoff" style="left:${O.badge.left}px;top:${O.badge.top}px;${slam(t, w.net, 0.3, 1.8)}">${icon('wifiOff')}</div>` : ''
  const tag = (at, x, y, ic, text) => (t >= at ? `<span class="tag2" style="left:${x}px;top:${y}px;${pop(t, at, 0.3)}">${icon(ic)}${esc(text)}</span>` : '')
  return `${background(t)}${brand(t)}${head(t, s, s.kicker, s.title, s.split)}
  ${windowFrame(t, footage(t, s.clip, O.win.width, O.win.height), s.start, O.win)}
  <div class="phone" style="left:${O.phone.left}px;top:${O.phone.top}px;width:${O.phone.width}px;height:${O.phone.height}px;opacity:${f3(phoneIn)};transform:translateY(${f3((1 - phoneIn) * 80)}px) rotate(${f3(3 * (1 - phoneIn) + 2)}deg)">
    <div class="screen"><img src="${D.phone}"><div class="pstatus"><span>9:41</span><span class="icons">${icon('plane')}${icon('wifiOff')}</span></div></div></div>
  ${badge}
  ${tag(w.win, O.winTag.left, O.winTag.top, 'monitor', 'ويندوز')}
  ${tag(w.android, O.phoneTag.left, O.phoneTag.top, 'smartphone', 'أندرويد')}
  ${tag(w.data, O.dataTag.left, O.dataTag.top, 'lock', 'بياناتك على جهازك')}
  ${caption(t, s.cap)}${strip()}
  <div class="flash" style="opacity:${f3(0.32 * (1 - prog(t, s.start, 0.22)))}"></div>`
}

function offer(t, s) {
  const O = L.offer, a = s.at
  const glow = prog(t, a.price, 0.9)
  // until the price lands the free trial is the headline, in the middle; then it flies up into its pill
  const hero = 1 - ease.inOut(prog(t, a.price - 0.3, 0.3))
  const pin = prog(t, a.trial, 0.34)
  const thero = hero > 0 ? `<div class="thero" style="top:${O.trialHero}px;opacity:${f3(hero * Math.min(1, pin * 2.4))};transform:translateY(${f3(-(1 - hero) * 180)}px) scale(${f3(0.88 + 0.12 * ease.back(pin))})">
    <i class="gift">${icon('gift')}</i><b>جرّب <em>7</em> أيام ببلاش</b><small>بكل المزايا</small></div>` : ''
  return `${background(t)}${brand(t)}${thero}
  <div class="trial" style="top:${O.trial}px;opacity:${f3(1 - hero)}"><span>${icon('gift')}جرّب <b>7</b> أيام ببلاش<small>بكل المزايا</small></span></div>
  ${t >= a.price ? `<div class="pring" style="top:${O.price + O.priceSize * 0.5}px;width:${f3(O.priceSize * (1.2 + 2.2 * ease.out(glow)))}px;height:${f3(O.priceSize * (1.2 + 2.2 * ease.out(glow)))}px;opacity:${f3(0.7 * (1 - glow))}"></div>` : ''}
  <div class="price" style="top:${O.price}px;font-size:${O.priceSize}px;${t >= a.price ? slam(t, a.price, 0.34, 2.4) : 'opacity:0'}"><b>59<sup>$</sup></b></div>
  <div class="once" style="top:${O.once}px;${pop(t, a.device, 0.32)}"><span>للجهاز</span><em></em><span>مرّة وحدة</span></div>
  <div class="life" style="top:${O.life}px;${slam(t, a.life, 0.32, 1.6)}">${icon('infinity')}<span>مدى الحياة</span></div>
  <div class="flash" style="opacity:${f3(Math.max(0.3 * (1 - prog(t, s.start, 0.22)), t >= a.price ? 0.55 * (1 - prog(t, a.price, 0.25)) : 0))}"></div>`
}

function cta(t, s) {
  const C = L.cta, a = s.at
  const strike = ease.inOut(prog(t, a.strike, 0.32))
  const beat = t >= a.go + 0.5 ? 0.5 + 0.5 * Math.sin((t - a.go) * 5.2) : 0
  const ripple = t >= a.go ? ((t - a.go) % 1.2) / 1.2 : 0
  const hero = 1 - ease.inOut(prog(t, a.go - 0.3, 0.3))
  return `${background(t)}${brand(t)}
  <div class="nosub" style="top:${f3(C.nosub + (C.nosubHero - C.nosub) * hero)}px;scale:${f3(1 + 0.2 * hero)};${pop(t, a.no, 0.3)}"><span class="x">${icon('x')}</span><span class="txt">اشتراك شهري<i style="transform:scaleX(${f3(strike)})"></i></span></div>
  <div class="nohead" style="top:${f3(C.nohead + (C.noheadHero - C.nohead) * hero)}px;scale:${f3(1 + 0.2 * hero)};${pop(t, a.head, 0.3)}">ولا وجعة راس</div>
  ${t >= a.go ? `<div class="ripple" style="top:${C.go}px;height:${C.goH}px;opacity:${f3(0.5 * (1 - ripple))};transform:scale(${f3(1 + 0.12 * ripple)},${f3(1 + 0.5 * ripple)})"></div>` : ''}
  <div class="go" style="top:${C.go}px;height:${C.goH}px;${t >= a.go ? `${slam(t, a.go, 0.34, 1.5)};` : 'opacity:0;'}${beat ? `transform:scale(${f3(1 + 0.025 * beat)})` : ''}">${icon('whatsapp')}<span>اطلبه هلّق عالواتساب</span></div>
  <div class="num" style="top:${C.num}px;${pop(t, a.go + 0.22, 0.32)}"><span>+963 996 489 504</span></div>
  <div class="site" style="top:${C.site}px;${pop(t, a.go + 0.4, 0.32)}"><span>${icon('globe')}جرّبه ببلاش: <b>dentora.raqeem.dev</b></span></div>
  <div class="recap" style="top:${C.recap}px;${pop(t, a.go + 0.58, 0.32)}"><span>${icon('check')}<b>7</b> أيام ببلاش</span><em></em><span>${icon('check')}${esc('59$')} مرّة وحدة</span><em></em><span>${icon('check')}بلا إنترنت</span></div>
  <div class="flash" style="opacity:${f3(Math.max(0.3 * (1 - prog(t, s.start, 0.22)), t >= a.go ? 0.4 * (1 - prog(t, a.go, 0.22)) : 0))}"></div>`
}

const KINDS = { hook, reveal, feature, montage, offline, offer, cta }

window.frame = async t => {
  let s = D.scenes[0]
  for (const x of D.scenes) if (t >= x.start) s = x
  const stage = document.getElementById('stage')
  stage.innerHTML = KINDS[s.kind](t, s)
  // a line that would not fit its width (or a caption its height) gets a smaller font, the same on every frame
  for (const el of stage.querySelectorAll('.title h1, .hook .l2, .hook .l4, .tag p, .ask, .nosub, .trial span, .once, .life')) {
    // these shrink-wrap their content (offsetWidth ignores the animation's transform); the bound is their box
    const max = (el.parentElement === stage ? L.W : el.parentElement.clientWidth) - 48
    let size = parseFloat(getComputedStyle(el).fontSize)
    while (el.offsetWidth > max && size > 12) { size *= 0.96; el.style.fontSize = size + 'px' }
  }
  for (const p of stage.querySelectorAll('.cap p')) {
    let size = parseFloat(getComputedStyle(p).fontSize)
    while (p.scrollHeight > p.parentElement.clientHeight && size > 12) { size *= 0.96; p.style.fontSize = size + 'px' }
  }
  const imgs = [...document.images]
  await Promise.all(imgs.map(i => (i.complete && i.naturalWidth ? i.decode().catch(() => {}) : new Promise(r => { i.onload = i.onerror = () => r() }).then(() => i.decode().catch(() => {})))))
  return imgs.filter(i => !i.naturalWidth).map(i => i.getAttribute('src'))
}

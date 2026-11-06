// Shared helpers for the lesson scenes. Everything is a pure function of time:
// render(t) must set every animated style from t alone (frames are rendered out of order, in parallel).
const W = 1920, H = 1080

// ---------- easing / timing ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, p) => a + (b - a) * p
const E = {
  lin: p => p,
  io: p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  out: p => 1 - Math.pow(1 - p, 3),
  in: p => p * p * p,
  expo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  back: p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) },
  sine: p => -(Math.cos(Math.PI * p) - 1) / 2,
}
// progress of an animation that starts at t0 and lasts d
const prog = (t, t0, d = .6, ease = E.io) => ease(clamp((t - t0) / d))
// envelope: 0 before a, rises over fi, stays 1, falls over fo before b
const env = (t, a, b = Infinity, fi = .45, fo = .35) => Math.min(prog(t, a, fi, E.out), 1 - prog(t, b - fo, fo, E.io))

// ---------- DOM ----------
function el(tag, cls, html, parent) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  if (parent) parent.appendChild(e)
  return e
}
// absolute placement in stage pixels. anchor: 'tl' (default) | 'tc' | 'tr' | 'c' | 'cl' | 'cr' | 'bc'
function place(e, x, y, o = {}) {
  e.style.position = 'absolute'
  e.style.left = x + 'px'; e.style.top = y + 'px'
  if (o.w != null) e.style.width = o.w + 'px'
  if (o.h != null) e.style.height = o.h + 'px'
  const a = o.anchor || 'tl'
  const tx = { tl: 0, cl: 0, bl: 0, tc: -50, c: -50, bc: -50, tr: -100, cr: -100, br: -100 }[a]
  const ty = { tl: 0, tc: 0, tr: 0, cl: -50, c: -50, cr: -50, bl: -100, bc: -100, br: -100 }[a]
  e.style.translate = `${tx}% ${ty}%`
  return e
}
const KOPT = { throwOnError: false, trust: true, strict: false, output: 'html' }
// KaTeX formula element. Use \htmlId{name}{...} / \htmlClass{name}{...} to animate parts, \textcolor{#hex}{...} to color.
function tex(src, cls = 'mx', display = false) {
  const e = document.createElement('bdi')
  e.className = 'm ' + cls
  e.innerHTML = katex.renderToString(src, { ...KOPT, displayMode: display })
  return e
}
// Arabic text with inline $math$ segments
function rich(str, cls = 'p') {
  const e = document.createElement('div')
  e.className = 'ar ' + cls
  e.innerHTML = str.split(/(\$[^$]+\$)/g).map(s => s.startsWith('$') && s.endsWith('$') && s.length > 2
    ? `<bdi class="m">${katex.renderToString(s.slice(1, -1), KOPT)}</bdi>` : s).join('')
  return e
}
// split an element's top-level text into word spans (keeps inline math as one "word")
function splitWords(e) {
  const out = []
  const walk = node => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) {
        const parts = ch.textContent.split(/(\s+)/)
        const frag = document.createDocumentFragment()
        for (const p of parts) {
          if (!p) continue
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); continue }
          const s = el('span', 'w', null); s.textContent = p; frag.appendChild(s); out.push(s)
        }
        node.replaceChild(frag, ch)
      } else if (ch.nodeType === 1) {
        if (ch.classList.contains('m') || ch.classList.contains('katex')) out.push(ch)
        else walk(ch)
      }
    }
  }
  walk(e)
  e._words = out
  return out
}
// reveal words in reading order: p in [0,1]
function typeWords(e, p) {
  const ws = e._words || splitWords(e)
  const n = ws.length
  ws.forEach((w, i) => {
    const q = clamp(p * (n + 2) - i, 0, 1)
    w.style.opacity = q
    w.style.filter = q < 1 ? `blur(${(1 - q) * 6}px)` : ''
  })
}

// ---------- animated style setters ----------
function op(e, v) { e.style.opacity = v; e.style.visibility = v <= 0.001 ? 'hidden' : 'visible' }
function rise(e, p, dy = 36) { op(e, p); e.style.transform = `translateY(${(1 - p) * dy}px)` }
function drop(e, p, dy = -36) { op(e, p); e.style.transform = `translateY(${(1 - p) * dy}px)` }
function slide(e, p, dx = 60) { op(e, p); e.style.transform = `translateX(${(1 - p) * dx}px)` }
function pop(e, p, from = .6) {
  op(e, clamp(p * 2.5))
  const s = p <= 0 ? from : lerp(from, 1, E.back(clamp(p)))
  e.style.transform = `scale(${s})`
}
function zoom(e, s) { e.style.transform = `scale(${s})` }
// clip reveal. 'ltr' for math (left → right), 'rtl' for Arabic (right → left), 'ttb', 'btt'
function wipe(e, p, dir = 'ltr') {
  const q = (1 - clamp(p)) * 100
  const m = { ltr: `inset(-20% ${q}% -20% -5%)`, rtl: `inset(-20% -5% -20% ${q}%)`, ttb: `inset(-5% -5% ${q}% -5%)`, btt: `inset(${q}% -5% -5% -5%)` }
  e.style.clipPath = p >= 1 ? '' : m[dir]
  e.style.visibility = p <= 0 ? 'hidden' : 'visible'
}
// cross-fade between two elements occupying the same place
function swap(a, b, p) { op(a, 1 - p); op(b, p); a.style.transform = `translateY(${-p * 24}px)`; b.style.transform = `translateY(${(1 - p) * 24}px)` }
function color(e, c) { e.style.color = c }
function mixColor(c1, c2, p) {
  const h = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
  const a = h(c1), b = h(c2)
  return 'rgb(' + a.map((v, i) => Math.round(lerp(v, b[i], p))).join(',') + ')'
}
const C = { yel: '#ffd23f', pur: '#a78bfa', pur2: '#7c3aed', grn: '#6ee05a', red: '#ff5c8a', blu: '#38bdf8', org: '#ff9f43', ink: '#eef2ff', mut: '#9aa8c9', dim: '#5d6a8f', line: '#25305a', bg: '#0b1020' }

// ---------- measuring (call inside build(): the scene root is laid out, untransformed) ----------
function rectIn(target, root) {
  const r = target.getBoundingClientRect(), o = root.getBoundingClientRect()
  return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, cx: r.left - o.left + r.width / 2, cy: r.top - o.top + r.height / 2 }
}
// highlight frame around a target; returns setter(p)
function hlBox(target, root, o = {}) {
  const pad = o.pad ?? 12, r = rectIn(target, root)
  const b = el('div', 'hlbox', null, root)
  place(b, r.x - pad, r.y - pad, { w: r.w + 2 * pad, h: r.h + 2 * pad })
  if (o.color) { b.style.borderColor = o.color; b.style.boxShadow = `0 0 30px ${o.color}55` }
  if (o.radius != null) b.style.borderRadius = o.radius + 'px'
  op(b, 0)
  return p => { op(b, clamp(p * 1.5)); b.style.transform = `scale(${lerp(1.15, 1, E.out(clamp(p)))})` }
}
// soft marker behind a target
function hlBg(target, root, o = {}) {
  const pad = o.pad ?? 8, r = rectIn(target, root)
  const b = el('div', 'hlbg', null, root)
  place(b, r.x - pad, r.y - pad, { w: r.w + 2 * pad, h: r.h + 2 * pad })
  if (o.color) b.style.background = o.color
  b.style.zIndex = -1
  root.style.isolation = 'isolate'
  b.style.transformOrigin = o.origin || '100% 50%'
  op(b, 0)
  return p => { op(b, p > 0 ? 1 : 0); b.style.transform = `scaleX(${E.out(clamp(p))})` }
}
// underline under a target, drawn right → left (or 'ltr')
function underline(target, root, o = {}) {
  const r = rectIn(target, root)
  const u = el('div', 'uline', null, root)
  place(u, r.x - 4, r.y + r.h + (o.gap ?? 4), { w: r.w + 8 })
  if (o.color) u.style.background = o.color
  u.style.transformOrigin = o.dir === 'ltr' ? '0 50%' : '100% 50%'
  op(u, 0)
  return p => { op(u, p > 0 ? 1 : 0); u.style.transform = `scaleX(${E.out(clamp(p))})` }
}

// ---------- components ----------
const CARD_TAG = { def: 'تعريف', tip: '💡 فكرة مفيدة', think: '🤔 فكّر', ex: 'مثال', warn: '⚠️ انتبه', exam: '🎯 في الامتحان' }
function card(root, type, x, y, w, o = {}) {
  const c = el('div', 'card ' + type, null, root)
  place(c, x, y, { w, h: o.h, anchor: o.anchor })
  if (o.tag !== false) el('div', 'tag', o.tag || CARD_TAG[type], c)
  const body = el('div', 'body', null, c)
  return { el: c, body }
}
function chip(root, html, x, y, o = {}) {
  const c = el('div', 'chip ' + (o.cls || ''), html, root)
  place(c, x, y, { anchor: o.anchor })
  if (o.color) { c.style.borderColor = o.color + '88'; c.style.background = o.color + '1f'; c.style.color = o.color }
  return c
}
// count from a to b (integers) as p goes 0→1
function counter(e, a, b, p, fmt = v => String(v)) { e.textContent = fmt(Math.round(lerp(a, b, clamp(p)))) }
// pause-and-think ring: returns setter(p, secondsLeft)
function countdown(root, x, y, r = 70, label = 'فكّر قبل أن نكمل') {
  const box = el('div', '', null, root)
  place(box, x, y, { anchor: 'c', w: r * 2 + 40, h: r * 2 + 90 })
  const ns = 'http://www.w3.org/2000/svg'
  const s = document.createElementNS(ns, 'svg')
  s.setAttribute('width', r * 2 + 20); s.setAttribute('height', r * 2 + 20)
  s.style.display = 'block'; s.style.margin = '0 auto'
  const mk = (stroke, w) => { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', r + 10); c.setAttribute('cy', r + 10); c.setAttribute('r', r); c.setAttribute('fill', 'none'); c.setAttribute('stroke', stroke); c.setAttribute('stroke-width', w); s.appendChild(c); return c }
  mk('rgba(255,255,255,.1)', 10)
  const arc = mk(C.yel, 10)
  arc.setAttribute('stroke-linecap', 'round')
  arc.setAttribute('transform', `rotate(-90 ${r + 10} ${r + 10})`)
  const L = 2 * Math.PI * r
  arc.setAttribute('stroke-dasharray', L)
  box.appendChild(s)
  const num = el('div', '', '', box)
  place(num, r + 20, r + 10, { anchor: 'c' })
  num.style.cssText += `font-size:${r * .8}px;font-weight:900;color:${C.yel}`
  const lab = el('div', 's ctr', label, box)
  lab.style.marginTop = '10px'
  op(box, 0)
  return (p, secs) => {
    op(box, p > 0 && p < 1.2 ? 1 : 0)
    arc.setAttribute('stroke-dashoffset', L * clamp(p))
    num.textContent = Math.max(0, Math.ceil(secs))
  }
}
// thumbnail of a book page with a highlighted region (fractions of the page)
function bookThumb(root, page, x, y, w, hl) {
  const box = el('div', '', null, root)
  place(box, x, y, { w })
  box.style.cssText += 'border-radius:14px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5);background:#fff'
  const img = el('img', '', null, box)
  img.src = `assets/book/p${String(page).padStart(3, '0')}.jpg`
  img.style.cssText = 'display:block;width:100%'
  let mark = null
  if (hl) {
    mark = el('div', '', null, box)
    mark.style.cssText = `position:absolute;left:${hl.x * 100}%;top:${hl.y * 100}%;width:${hl.w * 100}%;height:${hl.h * 100}%;border:4px solid ${C.yel};border-radius:10px;background:rgba(255,210,63,.18)`
  }
  box.style.position = 'absolute'
  return { el: box, mark }
}
// simple table; rows = [[cell html, ...], ...]; first row = header. returns {el, cells[r][c]}
function table(root, rows, x, y, o = {}) {
  const t = el('table', 'tb', null, root)
  place(t, x, y, { anchor: o.anchor })
  const cells = rows.map((r, i) => {
    const tr = el('tr', '', null, t)
    return r.map((c, j) => {
      const td = el('td', (o.headCol && j === 0) || (o.headRow && i === 0) ? 'hd' : '', null, tr)
      if (c instanceof Node) td.appendChild(c); else td.innerHTML = c
      return td
    })
  })
  return { el: t, cells }
}

// scene heading: same place and style in every scene (top-right, under the chrome). returns {el, set(p)}
function heading(root, html, o = {}) {
  const box = el('div', 'abs ar', null, root)
  place(box, 1800, o.y ?? 150, { anchor: 'tr', w: o.w ?? 1500 })
  const t = rich(html, o.cls || 'h2'); box.appendChild(t)
  const bar = el('div', '', null, box)
  bar.style.cssText = `height:6px;width:120px;border-radius:3px;margin:14px 0 0 auto;background:${o.color || C.pur};transform-origin:100% 50%`
  return { el: box, set: p => { rise(t, p, 24); op(bar, p > 0 ? 1 : 0); bar.style.transform = `scaleX(${E.out(clamp(p * 1.4 - .2))})` } }
}
// the framed "key formula" box used for every result worth remembering. returns {el, set(p)}
function keyBox(root, latex, x, y, o = {}) {
  const b = el('div', '', null, root)
  place(b, x, y, { anchor: o.anchor || 'c' })
  b.style.cssText += `padding:26px 46px;border-radius:24px;border:3px solid ${o.color || C.yel};background:rgba(255,210,63,.07);box-shadow:0 0 50px ${(o.color || C.yel)}33`
  const f = tex(latex, o.cls || 'ml'); b.appendChild(f)
  if (o.label) { const l = el('div', 'tag', o.label, b); l.style.cssText = `position:absolute;top:-22px;right:30px;padding:6px 18px;border-radius:999px;font-size:24px;font-weight:800;color:#0b1020;background:${o.color || C.yel}` }
  return { el: b, f, set: p => pop(b, p, .85) }
}

// ---------- SVG ----------
const NS = 'http://www.w3.org/2000/svg'
function svg(root, x, y, w, h) {
  const s = document.createElementNS(NS, 'svg')
  s.setAttribute('width', w); s.setAttribute('height', h); s.setAttribute('viewBox', `0 0 ${w} ${h}`)
  s.style.position = 'absolute'; s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.overflow = 'visible'
  root.appendChild(s)
  return s
}
function sv(parent, tag, attrs = {}) {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, attrs[k])
  parent.appendChild(e)
  return e
}
// path that can be drawn on with draw(path, p)
function draw(path, p) {
  if (!path._len) { path._len = path.getTotalLength() || 1; path.style.strokeDasharray = path._len }
  path.style.strokeDashoffset = path._len * (1 - clamp(p))
  path.style.visibility = p <= 0 ? 'hidden' : 'visible'
}
let _arrowId = 0
function arrow(s, x1, y1, x2, y2, o = {}) {
  const c = o.color || C.mut, w = o.width || 4
  const id = 'ah' + (++_arrowId)
  const defs = sv(s, 'defs')
  const m = sv(defs, 'marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' })
  sv(m, 'path', { d: 'M0,0 L10,5 L0,10 z', fill: c })
  const bend = o.bend || 0
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend
  const p = sv(s, 'path', { d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', 'marker-end': `url(#${id})` })
  const head = m
  return { path: p, set: q => { draw(p, q); p.setAttribute('marker-end', q >= .98 ? `url(#${id})` : 'none') } }
}
// 2D plot with axes. returns {X, Y, s (svg), layer (html overlay), dot(), label()}
function plot(root, x, y, w, h, o) {
  const { xmin, xmax, ymin, ymax } = o
  const pad = o.pad ?? 0
  const X = v => pad + (v - xmin) / (xmax - xmin) * (w - 2 * pad)
  const Y = v => h - pad - (v - ymin) / (ymax - ymin) * (h - 2 * pad)
  const box = el('div', '', null, root)
  place(box, x, y, { w, h })
  box.style.direction = 'ltr'
  const s = svg(box, 0, 0, w, h)
  const ax = sv(s, 'g')
  const xAxis = sv(ax, 'path', { d: `M${X(xmin)},${Y(Math.max(ymin, 0))} L${X(xmax) + 20},${Y(Math.max(ymin, 0))}`, stroke: C.mut, 'stroke-width': 3, fill: 'none' })
  const yAxis = sv(ax, 'path', { d: `M${X(Math.max(xmin, 0))},${Y(ymin)} L${X(Math.max(xmin, 0))},${Y(ymax) - 20}`, stroke: C.mut, 'stroke-width': 3, fill: 'none' })
  const layer = el('div', '', null, box)
  layer.style.cssText = 'position:absolute;inset:0'
  const dot = (vx, vy, r = 12, c = C.yel) => sv(s, 'circle', { cx: X(vx), cy: Y(vy), r, fill: c })
  const label = (html, vx, vy, anchor = 'c', cls = 's') => { const e = el('div', cls, html, layer); place(e, X(vx), Y(vy), { anchor }); e.style.whiteSpace = 'nowrap'; return e }
  return { X, Y, s, layer, box, ax, xAxis, yAxis, dot, label }
}

// ---------- scene registry ----------
const SCENES = {}
function scene(id, def) { SCENES[id] = def }

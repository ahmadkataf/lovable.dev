// One layout for every exercise of the solutions video, filled from data (see scenes/*.js):
//   statement card on top · «🎯 على ورقة الامتحان» card on the right, written row by row as it is spoken ·
//   left column: pause-and-think ring + hint, a small diagram (index line / plot / formula), ⚠️ «انتبه» card.
// solution(id, {tag, head, q, progress, beats: {lineIndex: beat}})
// beat = {rows: [row…], box: {t, c}, warn: [row…], hint: 'rich', side: [item…], clear: true}
// row  = 'rich text with $math$' | {t, cls, tex: true}      (cls: mute blu grn yel red)
// side item = {type: 'tex'|'rich'|'chip'|'line'|'plot', …}  (see sideItem below)
function solution(id, D) {
  const X0 = 120, X1 = 1800, LW = 580, GAP = 50
  scene(id, {
    build(root, S) {
      this.D = D
      // ---- statement card (exercises) or plain heading (explanations)
      let top
      if (D.q) {
        const c = card(root, 'def', X0, 150, X1 - X0, { tag: D.tag || 'السؤال' })
        this.qc = c.el
        if (D.head) { const h = rich(D.head, 's'); h.style.marginBottom = '8px'; c.body.appendChild(h) }
        const q = rich(D.q, 'p'); q.style.fontWeight = 600; c.body.appendChild(q)
        this.q = q; splitWords(q)
        top = rectIn(c.el, root).y + rectIn(c.el, root).h + GAP
      } else {
        this.hd = heading(root, D.title || '')
        top = 290
      }
      this.top = top
      if (D.skip) {
        // for students who already know this skill: where the lesson continues
        const sc = TL.scenes.find(x => x.id === id)
        const t = Math.ceil(sc ? sc.end : 0), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0')
        this.skip = chip(root, `⏭️ تعرف هذه المهارة؟ انتقل إلى <b dir="ltr">${mm}:${ss}</b>`, X0, 150, { color: C.blu })
        this.skip.style.fontSize = '26px'
      }
      const sideY = top + (Object.values(D.beats || {}).some(b => b.hint) ? 360 : 30)
      // ---- exam card (right)
      const ex = card(root, D.paperType || 'exam', X0 + LW + 60, top, X1 - X0 - LW - 60, { tag: D.paper || '🎯 على ورقة الامتحان', h: 990 - top })
      ex.el.style.overflow = 'visible'
      this.ex = ex.el
      const vp = el('div', '', null, ex.body)
      vp.style.cssText = `position:relative;overflow:hidden;height:${990 - top - 70}px`
      vp.style.maskImage = vp.style.webkitMaskImage = 'linear-gradient(to bottom, transparent 0, #000 34px)'
      const stack = el('div', '', null, vp); stack.style.cssText = 'position:absolute;left:0;right:0;top:0'
      this.vpH = 990 - top - 70; this.stack = stack
      const innerW = X1 - X0 - LW - 60 - 88
      this.rows = []; this.warns = []; this.sides = []; this.hints = []; this.rings = []
      let y = 0, page = 0
      const mkRow = (r, parent, width) => {
        const o = typeof r === 'string' ? { t: r } : r
        const e = o.tex ? tex(o.t, o.cls2 || 'mm') : rich(o.t, 'p')
        if (o.cls) e.classList.add(o.cls)
        e.style.fontSize = o.tex ? '' : '36px'
        const w = el('div', '', null, parent); w.appendChild(e)
        w.style.cssText = `position:absolute;right:0;${o.tex ? 'left:0;text-align:center;direction:ltr' : 'left:0'}`
        return { w, e, o }
      }
      const beats = D.beats || {}
      for (const k of Object.keys(beats).map(Number).sort((a, b) => a - b)) {
        const b = beats[k]
        if (b.page) { y = 0; page++ }
        const list = (b.rows || []).map(r => ({ r, kind: 'row' }))
        if (b.box) list.push({ r: b.box, kind: 'box' })
        list.forEach((it, j) => {
          let R
          if (it.kind === 'box') {
            const w = el('div', '', null, stack)
            const col = C[it.r.c || 'grn']
            w.style.cssText = `position:absolute;right:0;left:0;padding:18px 26px;border-radius:20px;border:3px solid ${col};background:${col}14;box-shadow:0 0 18px ${col}22`
            const e = rich(it.r.t, 'p'); e.style.fontWeight = 700; e.style.fontSize = '36px'; w.appendChild(e)
            R = { w, e, o: it.r, box: true }
          } else R = mkRow(it.r, stack)
          // fit width
          R.w.style.top = y + 'px'
          const sw = R.e.scrollWidth, avail = innerW - (R.box ? 56 : 0)
          let sc = 1
          if (sw > avail) {
            sc = avail * .97 / sw; R.e.style.transform = `scale(${sc})`
            if (R.o.tex) { R.w.style.textAlign = 'left'; R.e.style.transformOrigin = '0 0' } else R.e.style.transformOrigin = '100% 0'
          }
          const h = R.w.offsetHeight * (R.box ? 1 : sc) + (R.box ? 0 : 0)
          if (sc < 1 && !R.box) R.w.style.height = (R.e.offsetHeight * sc) + 'px'
          R.y = y; R.h = (sc < 1 && !R.box) ? R.e.offsetHeight * sc : R.w.offsetHeight
          y += R.h + (R.box ? 26 : 18)
          R.line = k; R.j = j; R.n = list.length; R.page = page
          if (!R.o.tex) splitWords(R.e)
          this.rows.push(R)
        })
        // ---- warn card (left column, bottom)
        if (b.warn) {
          const wc = card(root, 'warn', X0, 990, LW, { anchor: 'bl' })
          b.warn.forEach(r => { const o = typeof r === 'string' ? { t: r } : r; const e = rich(o.t, 's'); e.style.color = C.ink; e.style.fontSize = '30px'; if (o.cls) e.classList.add(o.cls); wc.body.appendChild(e) })
          const sw = wc.body.scrollWidth, avail = LW - 88
          if (sw > avail) { wc.body.style.transform = `scale(${avail / sw})`; wc.body.style.transformOrigin = '100% 0' }
          this.warns.push({ el: wc.el, line: k })
        }
        // ---- hint chip + countdown
        if (b.hint) {
          const h = el('div', 'chip', null, root)
          place(h, X0 + LW / 2, top + 232, { anchor: 'tc' })
          h.style.cssText += `max-width:${LW}px;border-color:${C.pur}88;background:${C.pur}1f;font-size:30px;flex-wrap:wrap;justify-content:center;text-align:center`
          h.appendChild(rich(b.hint, 's')).style.color = C.ink
          this.hints.push({ el: h, line: k })
        }
        const hold = +(S.lines[k] && S.lines[k].end != null ? (this._hold(S, k)) : 0)
        if (hold > .5) this.rings.push({ set: countdown(root, X0 + LW / 2, top + 110, 64, '⏸ أوقف وحاول'), line: k, hold })
        // ---- side items
        if (b.side) b.side.forEach((it, j) => this.sides.push({ ...sideItem(root, it, X0, sideY, LW), line: k, j, clear: b.clear }))
      }
      this.total = y
    },
    _hold(S, k) {
      // the silence after line k inside this scene = next line start − this line end − normal gap (0.5 s)
      const next = S.at(k + 1)
      return Number.isFinite(next) ? Math.max(0, next - S.end(k) - .5) : 0
    },
    render(lt, S) {
      const D = this.D
      if (this.qc) { rise(this.qc, S.p(lt, 0, 0, .6)); typeWords(this.q, clamp((lt - .2) / Math.max(1.5, (S.end(0) - S.at(0)) * .7))) }
      if (this.hd) this.hd.set(S.p(lt, 0, 0, .7))
      if (this.skip) op(this.skip, S.p(lt, 0, .8, .6) * (1 - S.p(lt, S.lines.length - 1, 0, .4) * .4))
      const exOn = this.rows.length ? Math.min(S.at(this.rows[0].line), S.at(1)) : Infinity
      rise(this.ex, prog(lt, exOn - .3, .6, E.out))
      // rows
      let bottom = 0
      // current page = last page whose first row's line has started
      let curPage = 0
      for (const R of this.rows) if (lt >= S.at(R.line) && R.page > curPage) curPage = R.page
      for (const R of this.rows) {
        if (R.page < curPage) {
          const pStart = S.at(this.rows.find(o => o.page === R.page + 1).line)
          op(R.w, Math.max(0, .72 * (1 - prog(lt, pStart, .4)))); continue
        }
        const a = S.at(R.line), d = Math.max(1, S.end(R.line) - a)
        const t0 = R.box ? a + Math.min(d * .82, .3 + d * (R.n - 1) / R.n + .4) : a + .25 + d * .78 * R.j / Math.max(1, R.n)
        const p = prog(lt, t0, .55, E.out)
        rise(R.w, p, 24)
        if (!R.o.tex && !R.box) typeWords(R.e, clamp((lt - t0) / Math.max(.6, d * .5 / Math.max(1, R.n))))
        if (R.box) R.w.style.transform = `scale(${lerp(.92, 1, E.back(clamp(p)))})`
        if (p > 0 && R.page === curPage) bottom = Math.max(bottom, R.y + R.h * Math.min(1, p * 1.5))
        // newest rows bright, older rows a little dimmer
        const later = this.rows.some(o => o.line > R.line && o.page === R.page && lt >= S.at(o.line))
        if (p >= 1) R.w.style.opacity = later && !R.box ? .72 : 1
      }
      const scroll = Math.max(0, bottom - this.vpH)
      this.stack.style.transform = `translateY(${-scroll}px)`
      // warn cards: slide in from the left on their line, previous one leaves
      this.warns.forEach((w, i) => {
        const nxt = this.warns[i + 1]
        const p = Math.min(prog(lt, S.at(w.line) + .3, .6, E.out), nxt ? 1 - prog(lt, S.at(nxt.line), .4) : 1)
        op(w.el, p); w.el.style.transform = `translateX(${(1 - p) * -40}px)`
      })
      // hint chips: on their line, dim after
      this.hints.forEach(h => {
        const p = prog(lt, S.at(h.line) + .1, .5, E.out)
        const warn = this.warns.find(w => w.line >= h.line && lt >= S.at(w.line))
        const nxt = this.hints.find(o => o.line > h.line)  // a newer hint replaces this one
        op(h.el, p * (lt > S.end(h.line) + 6 ? .55 : 1) * (warn ? 1 - prog(lt, S.at(warn.line), .4) : 1) * (nxt ? 1 - prog(lt, S.at(nxt.line), .3) : 1))
      })
      this.rings.forEach(r => { const t0 = S.end(r.line); r.set(lt < t0 ? 0 : (lt - t0) / r.hold, r.hold - (lt - t0)) })
      // side items
      this.sides.forEach(s => {
        const p = prog(lt, S.at(s.line) + .3 + s.j * .5, .6, E.out)
        const killer = this.sides.find(o => o.clear && o.line > s.line && lt >= S.at(o.line))
        const warn = this.warns.find(w => w.line >= s.line && lt >= S.at(w.line))
        const out = Math.max(killer ? prog(lt, S.at(killer.line), .4) : 0, warn ? prog(lt, S.at(warn.line), .4) : 0)
        s.set(Math.min(p, 1 - out), lt, S, S.f(lt, s.line, s.fa ?? 0, s.fb ?? 1))
      })
    },
  })
}

// small diagrams for the left column. returns {el, set(p, lt, S)}
function sideItem(root, it, x, y, w) {
  const box = el('div', '', null, root)
  place(box, x, y + (it.dy || 0), { w })
  let anim = () => {}
  if (it.type === 'tex') {
    const f = tex(it.t, it.cls || 'mm'); box.appendChild(f); box.style.textAlign = 'center'; box.style.direction = 'ltr'
    if (f.scrollWidth > w) { f.style.transform = `scale(${w / f.scrollWidth})`; f.style.transformOrigin = '50% 0' }
  } else if (it.type === 'rich' || it.type === 'chip') {
    const e = rich(it.t, it.cls || 's'); box.appendChild(e); e.style.textAlign = 'center'
    if (it.type === 'chip') { e.style.cssText += `display:inline-block;padding:10px 22px;border-radius:16px;border:2px solid ${C[it.c || 'blu']}88;background:${C[it.c || 'blu']}1a;color:${C.ink}`; box.style.textAlign = 'center' }
  } else if (it.type === 'line') {
    // index number line: from..to, dots, arcs [a,b,label], brace [a,b,label], bad [[i,label]], bracket [n0,label]
    const H = 260, s = svg(box, 0, 0, w, H), pad = 30
    box.style.height = H + 'px'; box.style.direction = 'ltr'
    const X = v => pad + (v - it.from) / (it.to - it.from) * (w - 2 * pad), Y = 120
    sv(s, 'line', { x1: pad - 10, y1: Y, x2: w - pad + 16, y2: Y, stroke: C.mut, 'stroke-width': 3 })
    const ticks = it.ticks || Array.from({ length: it.to - it.from + 1 }, (_, i) => it.from + i)
    ticks.forEach(v => {
      sv(s, 'line', { x1: X(v), y1: Y - 8, x2: X(v), y2: Y + 8, stroke: C.mut, 'stroke-width': 2 })
      const t = sv(s, 'text', { x: X(v), y: Y + 40, fill: C.mut, 'font-size': 24, 'text-anchor': 'middle', 'font-family': 'A' }); t.textContent = v
    })
    const parts = []
    ;(it.dots || []).forEach(v => parts.push({ el: sv(s, 'circle', { cx: X(v), cy: Y, r: 11, fill: C.yel }), kind: 'pop' }))
    ;(it.arcs || []).forEach(([a, b, lab]) => {
      const mx = (X(a) + X(b)) / 2, hgt = Math.min(70, 18 + (X(b) - X(a)) * .35)
      const p = sv(s, 'path', { d: `M${X(a)},${Y - 14} Q${mx},${Y - 14 - hgt * 2} ${X(b)},${Y - 14}`, fill: 'none', stroke: C.grn, 'stroke-width': 3 })
      const t = sv(s, 'text', { x: mx, y: Y - 22 - hgt, fill: C.grn, 'font-size': 26, 'text-anchor': 'middle', 'font-family': 'A', 'font-weight': 700 }); t.textContent = lab || ''
      parts.push({ el: p, kind: 'draw' }, { el: t, kind: 'fade' })
    })
    if (it.brace) {
      const [a, b, lab] = it.brace
      const p = sv(s, 'path', { d: `M${X(a)},${Y + 60} q0,14 14,14 L${(X(a) + X(b)) / 2 - 14},${Y + 74} q14,0 14,14 q0,-14 14,-14 L${X(b) - 14},${Y + 74} q14,0 14,-14`, fill: 'none', stroke: C.yel, 'stroke-width': 3 })
      const t = sv(s, 'text', { x: (X(a) + X(b)) / 2, y: Y + 70, fill: C.yel, 'font-size': 26, 'text-anchor': 'middle', 'font-family': 'A', 'font-weight': 700 }); t.textContent = lab
      t.setAttribute('y', Y + 118)
      parts.push({ el: p, kind: 'draw' }, { el: t, kind: 'fade' })
    }
    ;(it.bad || []).forEach(([v, lab]) => {
      parts.push({ el: sv(s, 'circle', { cx: X(v), cy: Y, r: 14, fill: 'none', stroke: C.red, 'stroke-width': 4 }), kind: 'pop' })
      const t = sv(s, 'text', { x: X(v), y: Y - 30, fill: C.red, 'font-size': 26, 'text-anchor': 'middle', 'font-family': 'A', 'font-weight': 700 }); t.textContent = lab
      parts.push({ el: t, kind: 'fade' })
    })
    if (it.bracket) {
      const [a, lab] = it.bracket
      const p = sv(s, 'path', { d: `M${X(a)},${Y - 30} L${X(a) - 8},${Y - 30} L${X(a) - 8},${Y + 22} M${X(a) - 8},${Y - 30} L${w - pad + 10},${Y - 30}`, fill: 'none', stroke: C.grn, 'stroke-width': 4 })
      const t = sv(s, 'text', { x: X(a) + 6, y: Y - 44, fill: C.grn, 'font-size': 26, 'font-family': 'A', 'font-weight': 700 }); t.textContent = lab
      parts.push({ el: p, kind: 'draw' }, { el: t, kind: 'fade' })
    }
    anim = p => parts.forEach((q, i) => {
      const r = clamp(p * (parts.length + 1) - i * .8)
      if (q.kind === 'draw') draw(q.el, r)
      else if (q.kind === 'pop') { q.el.style.opacity = clamp(r * 3); q.el.style.transformOrigin = 'center'; q.el.style.transformBox = 'fill-box'; q.el.style.transform = `scale(${E.back(r)})` }
      else q.el.style.opacity = r
    })
  } else if (it.type === 'card') {
    const c = card(box, it.kind || 'tip', 0, 30, w, { tag: it.tag })
    const lines = Array.isArray(it.t) ? it.t : [it.t]
    lines.forEach(t => { const e = rich(t, 's'); e.style.color = C.ink; e.style.fontSize = (it.size || 30) + 'px'; e.style.margin = '4px 0'; c.body.appendChild(e) })
    const sw = c.body.scrollWidth, avail = w - 88
    if (sw > avail) { c.body.style.transform = `scale(${avail / sw})`; c.body.style.transformOrigin = '100% 0' }
  } else if (it.type === 'dominoes') {
    // a row of dominoes that fall right → left, one after another, as p goes 0 → 1
    const n = it.n || 9, H = 260, s = svg(box, 0, 0, w, H); box.style.height = H + 'px'
    const gap = (w - 60) / n, dw = 22, dh = 120, base = 200
    const ds = []
    for (let i = 0; i < n; i++) {
      const x = w - 40 - i * gap
      const g = sv(s, 'g'); const r = sv(g, 'rect', { x: x - dw, y: base - dh, width: dw, height: dh, rx: 4, fill: i === 0 ? C.yel : C.pur })
      sv(g, 'circle', { cx: x - dw / 2, cy: base - dh * .7, r: 4, fill: '#0b1020' }); sv(g, 'circle', { cx: x - dw / 2, cy: base - dh * .3, r: 4, fill: '#0b1020' })
      g.style.transformOrigin = `${x - dw}px ${base}px`; g.style.transformBox = 'view-box'
      ds.push(g)
    }
    sv(s, 'line', { x1: 10, y1: base + 2, x2: w - 10, y2: base + 2, stroke: C.mut, 'stroke-width': 3 })
    if (it.label) { const t = sv(s, 'text', { x: w / 2, y: base + 44, fill: C.mut, 'font-size': 26, 'text-anchor': 'middle', 'font-family': 'A' }); t.textContent = it.label }
    const fall = it.fall ?? 1
    anim = p => ds.forEach((g, i) => {
      const q = fall ? clamp((p * 1.4 - .25) * (n + 1) * .55 - i * .55) : 0
      g.style.transform = `rotate(${-68 * E.in(q)}deg)`
    })
  } else if (it.type === 'ladder') {
    // a ladder with labelled rungs; a climber goes from rung `from` to rung `to` as p goes 0 → 1
    const H = it.h || 520, s = svg(box, 0, 0, w, H); box.style.height = H + 'px'
    const n = it.rungs || 7, x1 = w / 2 - 90, x2 = w / 2 + 90, top = 30, bot = H - 30, step = (bot - top) / (n - 1)
    sv(s, 'line', { x1, y1: top - 20, x2: x1, y2: bot + 10, stroke: C.mut, 'stroke-width': 8, 'stroke-linecap': 'round' })
    sv(s, 'line', { x1: x2, y1: top - 20, x2: x2, y2: bot + 10, stroke: C.mut, 'stroke-width': 8, 'stroke-linecap': 'round' })
    const Y = r => bot - r * step
    for (let r = 0; r < n; r++) sv(s, 'line', { x1, y1: Y(r), x2, y2: Y(r), stroke: C.ink, 'stroke-width': 6, 'stroke-linecap': 'round' })
    ;(it.labels || []).forEach(([r, txt, c]) => { const t = sv(s, 'text', { x: x2 + 22, y: Y(r) + 9, fill: C[c || 'yel'], 'font-size': 28, 'font-family': 'A', 'font-weight': 700 }); t.textContent = txt })
    const me = sv(s, 'circle', { cx: w / 2, cy: Y(it.from || 0) - 26, r: 22, fill: C.yel })
    anim = p => { const r = lerp(it.from || 0, it.to ?? n - 1, E.io(clamp(p))); me.setAttribute('cy', Y(r) - 26) }
  } else if (it.type === 'plot') {
    // points [[n,u]…] with optional dashed asymptote y = it.asym
    const H = it.h || 300
    box.style.height = H + 'px'
    const xs = it.pts.map(p => p[0]), ys = it.pts.map(p => p[1]).concat(it.asym != null ? [it.asym] : [])
    const P = plot(box, 0, 0, w, H, { xmin: it.xmin ?? Math.min(0, ...xs), xmax: it.xmax ?? Math.max(...xs) + 1, ymin: it.ymin ?? Math.min(0, ...ys), ymax: it.ymax ?? Math.max(...ys) * 1.15, pad: 34 })
    const parts = []
    if (it.asym != null) parts.push({ el: sv(P.s, 'line', { x1: P.X(P.X ? (it.xmin ?? 0) : 0), y1: P.Y(it.asym), x2: w - 20, y2: P.Y(it.asym), stroke: C.blu, 'stroke-width': 3, 'stroke-dasharray': '10 8' }), kind: 'fade' })
    it.pts.forEach(([a, b]) => parts.push({ el: P.dot(a, b, 10, C[it.c || 'yel']), kind: 'pop' }))
    ;(it.labels || []).forEach(([html, a, b, anc]) => { const l = P.label(html, a, b, anc || 'bc', 's'); l.style.color = C.ink; l.style.fontSize = '24px'; parts.push({ el: l, kind: 'fade' }) })
    anim = p => parts.forEach((q, i) => {
      const r = clamp(p * (parts.length + 1) - i * .7)
      if (q.kind === 'pop') { q.el.style.opacity = clamp(r * 3); q.el.style.transformOrigin = 'center'; q.el.style.transformBox = 'fill-box'; q.el.style.transform = `scale(${E.back(r)})` }
      else q.el.style.opacity = r
    })
  }
  // a tall statement card pushes the left column down: shrink the item so it stays inside the frame
  const bh = box.offsetHeight, room = 1000 - (y + (it.dy || 0))
  if (bh > room && room > 60) { box.style.transformOrigin = '50% 0'; box.style.scale = String(Math.max(.55, room / bh)) }
  op(box, 0)
  return { el: box, fa: it.fa, fb: it.fb, set: (p, lt, S, f) => { op(box, clamp(p * 2)); box.style.transform = `translateY(${(1 - E.out(clamp(p))) * 20}px)`; anim(it.follow ? clamp(f ?? p) : clamp(p)) } }
}

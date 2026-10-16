// s16 · مطابقة مفيدة — from x²−a² and x³−a³ to the book's identity for any n.
// Under the bracket, every term is decoded as x^α a^β and gets a little seesaw: α (green) on the left end,
// β (blue) on the right end, pivot fixed at the same height → the sum α+β never changes (= n−1).
// Then the book's example x⁵−a⁵ (the seesaws settle on (4,0)…(0,4)) and a numeric check giving 31.
scene('s16', {
  build(root, S) {
    const G = C.grn, B = C.blu
    const g = s => `\\textcolor{${G}}{${s}}`, b = s => `\\textcolor{${B}}{${s}}`
    const id = (k, s) => `\\htmlId{s16-${k}}{${s}}`
    const $ = k => document.getElementById('s16-' + k)
    this.head = heading(root, 'تحليلُ الفرق $x^n - a^n$')

    // ---------- the tip card with the general identity (final place: top) ----------
    const c = card(root, 'tip', 960, 292, 1680, { anchor: 'tc', tag: '💡 مطابقة مفيدة' })
    this.card = c.el
    c.body.style.cssText += 'position:relative;direction:ltr;height:100px'
    this.gen = tex(`x^n - a^n ${id('eq', '=')} ${id('xag', '(x-a)')}\\left(${id('g0', `x^{${id('a0', 'n-1')}}`)} + ${id('g1', `x^{${id('a1', 'n-2')}}a`)} + ${id('g2', `x^{${id('a2', 'n-3')}}a^{${id('b2', '2')}}`)} + ${id('g3', '\\cdots')} + ${id('g4', `a^{${id('b4', 'n-1')}}`)}\\right)`, 'mx')
    this.five = tex(`x^5 - a^5 = (x-a)\\left(${id('f0', `x^{${g(4)}}`)} + ${id('f1', `x^{${g(3)}}a`)} + ${id('f2', `x^{${g(2)}}a^{${b(2)}}`)} + ${id('f3', `xa^{${b(3)}}`)} + ${id('f4', `a^{${b(4)}}`)}\\right)`, 'mx')
    this.wrap = el('div', '', null, c.body); place(this.wrap, 796, 50, { anchor: 'c' })
    this.gen.style.fontSize = '60px'; this.wrap.appendChild(this.gen)
    this.five.style.fontSize = '60px'; c.body.appendChild(this.five); place(this.five, 796, 50, { anchor: 'c' })
    op(this.five, 0)
    this.gT = [0, 1, 2, 3, 4].map(k => $('g' + k))
    this.fT = [0, 1, 2, 3, 4].map(k => $('f' + k))
    this.gA = [$('a0'), $('a1'), $('a2')]
    this.gB = [$('b2'), $('b4')]
    this.eq = $('eq')
    for (const e of [...this.gT, ...this.fT]) e.style.display = 'inline-block'
    // "x^n − a^n = ؟" comes first (the right side is written later)
    this.q = el('div', 'h2 yel', '؟', this.wrap); this.q.style.fontWeight = 900
    // the bracket (for "في القوس الثاني"), inside the card so it travels with it
    this.brk = el('div', 'hlbox', null, this.wrap); op(this.brk, 0)

    // ---------- the familiar identities, '=' aligned with the general one ----------
    this.CARD_DY = 312                                   // the card sits lower during line 0
    this.fam = [
      `x^2 - a^2 \\htmlId{s16-e2}{=} ${id('xa2', '(x-a)')}(x+a)`,
      `x^3 - a^3 \\htmlId{s16-e3}{=} ${id('xa3', '(x-a)')}(x^2 + xa + a^2)`,
    ].map((src, i) => {
      const f = tex(src, 'mx'); root.appendChild(f); place(f, 0, 404 + i * 116, { anchor: 'cl' })
      f.style.fontSize = '60px'; f.style.color = C.mut
      return f
    })
    this.famEq = [$('e2'), $('e3')]
    this.xa = [$('xa2'), $('xa3'), $('xag')]
    // brace + label «تعرفهما من قبل» on the right of the two familiar rows
    this.brace = sv(svg(root, 0, 0, W, H), 'path', { fill: 'none', stroke: C.dim, 'stroke-width': 3, 'stroke-linecap': 'round' })
    this.famTag = rich('تعرفهما من قبل', 's'); root.appendChild(this.famTag); this.famTag.style.whiteSpace = 'nowrap'
    this.body = c.body

    // ---------- decoded terms + seesaws ----------
    const xs = [380, 670, 960, 1250, 1540]
    // soft column frames that light up in turn for the x^5 example (under everything else)
    this.cols = xs.map(x => {
      const b = el('div', '', null, root); place(b, x, 498, { anchor: 'tc', w: 262, h: 296 })
      b.style.cssText += `border-radius:24px;border:2.5px solid ${C.yel}88;background:rgba(255,210,63,.07);box-shadow:0 0 30px rgba(255,210,63,.18)`
      op(b, 0); return b
    })
    const decG = [[`n-1`, `0`], [`n-2`, `1`], [`n-3`, `2`], null, [`0`, `n-1`]]
    const dec5 = [[4, 0], [3, 1], [2, 2], [1, 3], [0, 4]]
    const term = p => `x^{${g(p[0])}}a^{${b(p[1])}}`
    const mk = (src, x, y, fs) => { const f = tex(src, 'mx'); root.appendChild(f); place(f, x, y, { anchor: 'c' }); f.style.fontSize = fs + 'px'; return f }
    this.decG = decG.map((p, k) => mk(p ? term(p) : '\\cdots', xs[k], 556, 60))
    this.dec5 = dec5.map((p, k) => mk(term(p), xs[k], 556, 60))
    this.sumG = decG.map((p, k) => {
      if (!p) return null
      const f = mk(`${g('\\alpha')} + ${b('\\beta')} = n-1`, xs[k], 752, 32); f.style.color = C.mut; return f
    })
    this.sum5 = dec5.map((p, k) => mk(`${g(p[0])} + ${b(p[1])} = 4`, xs[k], 752, 34))
    const sg = svg(root, 0, 0, W, H)
    const PY = 662, L = 172
    this.PY = PY
    this.saws = xs.map((x, k) => {
      const grp = sv(sg, 'g')
      sv(grp, 'path', { d: `M${x},${PY + 4} L${x - 21},${PY + 40} L${x + 21},${PY + 40} Z`, fill: '#33406b', stroke: '#5d6a8f', 'stroke-width': 2, 'stroke-linejoin': 'round' })
      sv(grp, 'line', { x1: x - 36, y1: PY + 41, x2: x + 36, y2: PY + 41, stroke: '#5d6a8f', 'stroke-width': 3, 'stroke-linecap': 'round' })
      const beam = sv(grp, 'g')
      sv(beam, 'line', { x1: x - L / 2, y1: PY, x2: x + L / 2, y2: PY, stroke: C.ink, 'stroke-width': 6, 'stroke-linecap': 'round', opacity: .85 })
      const gl = sv(beam, 'circle', { cx: x - L / 2 + 8, cy: PY - 16, r: 13, fill: G })
      const bl = sv(beam, 'circle', { cx: x + L / 2 - 8, cy: PY - 16, r: 13, fill: B })
      sv(beam, 'circle', { cx: x, cy: PY, r: 5, fill: C.bg, stroke: C.ink, 'stroke-width': 2 })
      return { grp, beam, x, gl, bl }
    })
    // tilt (+1 = the α end fully up): general n (drawn like n = 9), then n = 5
    this.tG = [1, .75, .5, 0, -1]
    this.t5 = [1, .5, 0, -.5, -1]

    // ---------- the book sentence (line 1) ----------
    this.sent = rich(`أي إنّ $x^n - a^n$ هو جداء ضرب $(x-a)$ بمجموع جميع الأعداد $x^{${g('\\alpha')}} a^{${b('\\beta')}}$ حيث $${g('\\alpha')}$ و $${b('\\beta')}$ عددان طبيعيّان مجموعهما يساوي $n-1$`, 'p')
    root.appendChild(this.sent); place(this.sent, 1770, 822, { anchor: 'tr', w: 1620 })
    this.sent.style.lineHeight = 1.55
    splitWords(this.sent)
    this.sentBar = el('div', '', null, root)
    this.sentBar.style.cssText += `border-radius:3px;background:${C.yel}88;transform-origin:50% 0`
    this._layout()

    // ---------- numeric check (line 2): a row laid out right → left ----------
    const box = el('div', '', null, root)
    place(box, 960, 810, { anchor: 'tc' })
    box.style.cssText += `display:flex;flex-direction:row;align-items:center;gap:34px;direction:rtl;padding:12px 40px;height:172px;border-radius:26px;border:2.5px solid ${G}88;background:rgba(110,224,90,.07);box-shadow:0 0 40px rgba(110,224,90,.12)`
    this.ck = box
    const lab = rich(`تحقّق: $x = 2,\\ a = 1$`, 'p grn b'); box.appendChild(lab); lab.style.whiteSpace = 'nowrap'
    this.tick = el('div', 'h2 grn', '✓', box); this.tick.style.fontWeight = 900
    this.ckF = tex(`2^5 - 1^5 = (2-1)(${id('n0', '16')} + ${id('n1', '8')} + ${id('n2', '4')} + ${id('n3', '2')} + ${id('n4', '1')}) = ${id('r', `\\textcolor{${G}}{\\mathbf{31}}`)}`, 'mm')
    box.appendChild(this.ckF)
    this.ckN = [0, 1, 2, 3, 4].map(k => $('n' + k))
    this.ckR = $('r'); this.ckR.style.display = 'inline-block'
    // the tower of bars 16 + 8 + 4 + 2 + 1 = 31
    const tw = el('div', '', null, box)
    tw.style.cssText = 'position:relative;width:150px;height:140px;direction:ltr;flex:none'
    const ts = svg(tw, 0, 0, 150, 140)
    const U = 4.1, TX = 112, TB = 138
    this.bars = []
    let acc = 0
    ;[16, 8, 4, 2, 1].forEach((v, k) => {
      const h = v * U
      const r = sv(ts, 'rect', { x: TX - 28, y: TB - acc - h + 1.5, width: 56, height: Math.max(2.5, h - 3), rx: 4, fill: ['#6ee05a', '#8be26f', '#5bc94a', '#a3ec8c', '#4bb83c'][k] })
      this.bars.push(r)
      acc += h
    })
    this.tower31 = el('div', 'h3 grn', '31', tw); place(this.tower31, 66, TB - acc / 2, { anchor: 'cr' })
    this.tower31.style.fontWeight = 900
  },

  // Everything that depends on measured text sizes. KaTeX fonts are still loading while build() runs,
  // so this runs again from render() as soon as the measured sizes change.
  _layout() {
    const R = e => e.getBoundingClientRect()
    const gr = R(this.gen), er = R(this.eq), gw = this.gen.offsetWidth
    this._sig = gw + '|' + this.sent.offsetHeight
    if (!gw) return
    const k = gw / gr.width                                // undo any scale (layout px per screen px)
    const eqR = (er.right - gr.left) * k
    this.fEq = eqR / gw
    this.shift0 = (gw - eqR - 90) / 2
    place(this.q, eqR + 44, this.gen.offsetHeight / 2, { anchor: 'c' })
    const r0 = R(this.gT[0]), r4 = R(this.gT[4])
    place(this.brk, (r0.left - gr.left) * k - 40, this.gen.offsetHeight / 2, { anchor: 'cl', w: (r4.right - r0.left) * k + 84, h: 112 })
    // familiar rows: their '=' under the general '=' (x only; nothing here is scaled horizontally)
    const eqX = R(this.body).left + 796 - gw / 2 + (er.left + er.width / 2 - gr.left) * k
    const rows = this.fam.map((f, i) => {
      const fr = R(f), e = R(this.famEq[i])
      const left = eqX - (e.left + e.width / 2 - fr.left)
      f.style.left = left + 'px'
      return { right: left + f.offsetWidth, h: f.offsetHeight, y: 404 + i * 116 }
    })
    const bx = Math.max(rows[0].right, rows[1].right) + 40, y1 = rows[0].y - rows[0].h / 2 + 6, y2 = rows[1].y + rows[1].h / 2 - 6, ym = (y1 + y2) / 2
    this.brace.setAttribute('d', `M${bx},${y1} Q${bx + 16},${y1} ${bx + 16},${y1 + 18} L${bx + 16},${ym - 16} Q${bx + 16},${ym} ${bx + 32},${ym} Q${bx + 16},${ym} ${bx + 16},${ym + 16} L${bx + 16},${y2 - 18} Q${bx + 16},${y2} ${bx},${y2}`)
    this.brace._len = 0
    place(this.famTag, bx + 50, ym, { anchor: 'cl' })
    place(this.sentBar, 1794, 828, { w: 6, h: this.sent.offsetHeight - 12 })
  },

  render(lt, S) {
    if (this._sig !== this.gen.offsetWidth + '|' + this.sent.offsetHeight) this._layout()
    const G = C.grn, B = C.blu
    const d0 = S.end(0) - S.at(0), d1 = S.end(1) - S.at(1), d2 = S.end(2) - S.at(2)
    this.head.set(S.p(lt, 0, 0, .8))

    // ---- line 0: "x^n − a^n = ؟", the familiar identities, then the book's general one
    const pc = S.p(lt, 0, .5, .7)
    const up = S.p(lt, 1, .1, .9)
    op(this.card, pc)
    this.card.style.transform = `translateY(${(1 - up) * this.CARD_DY + (1 - pc) * 30}px)`
    const tGen = S.at(0) + .84 * d0
    const wA = prog(lt, S.at(0) + .7, .8), wB = prog(lt, tGen, 1.4)
    wipe(this.gen, wA * this.fEq + wB * (1 - this.fEq), 'ltr')
    this.wrap.style.translate = `calc(-50% + ${(1 - wB) * this.shift0}px) -50%`
    const qv = Math.min(prog(lt, S.at(0) + 1.2, .5), 1 - prog(lt, tGen - .1, .3))
    pop(this.q, qv); if (qv >= 1) this.q.style.transform = `scale(${1 + .06 * Math.sin((lt - S.at(0)) * 3)})`
    const famIn = [S.p(lt, 0, .2 * d0, 1), S.p(lt, 0, .56 * d0, 1)]
    const famOut = S.p(lt, 1, 0, .5)
    this.fam.forEach((f, i) => { wipe(f, famIn[i], 'ltr'); op(f, 1 - famOut); f.style.transform = `translateY(${-famOut * 30}px)` })
    const tagIn = S.p(lt, 0, .56 * d0 + .6, .6)
    draw(this.brace, tagIn); this.brace.style.opacity = 1 - famOut
    op(this.famTag, Math.min(tagIn, 1 - famOut))
    // the common factor (x − a) lights up in all three when the general identity is written
    const xa = env(lt, tGen + .9, S.at(1) + .3, .4, .5)
    this.xa.forEach(e => (e.style.color = mixColor(e === this.xa[2] ? C.ink : C.mut, C.yel, xa)))

    // ---- line 1: bracket, decoded terms, seesaws, sums, book sentence
    const brk = Math.min(S.p(lt, 1, .9, .5), 1 - S.p(lt, 1, .9 + Math.max(2, .3 * d1), .6))
    op(this.brk, brk); this.brk.style.transform = `scale(${lerp(1.06, 1, E.out(clamp(brk)))})`
    const decIn = k => S.p(lt, 1, .16 * d1 + k * .22, .55)
    const tipAt = k => S.at(1) + .42 * d1 + Math.min(k, 3) * .45
    const sumIn = k => S.p(lt, 1, .72 * d1 + Math.min(k, 3) * .15, .5)
    const cp = S.p(lt, 1, .16 * d1, .8)
    this.gA.forEach(e => (e.style.color = mixColor(C.ink, G, cp)))
    this.gB.forEach(e => (e.style.color = mixColor(C.ink, B, cp)))
    // ---- line 2 transitions
    const sw = S.p(lt, 2, 0, .4), swIn = S.p(lt, 2, .3, .55)    // card: general → x^5 (out, then in)
    const sw2 = S.p(lt, 2, .4, .4), sw2In = S.p(lt, 2, .75, .55) // decoded terms / sums → n = 5
    op(this.gen, Math.min(wA > 0 ? 1 : 0, 1 - sw)); op(this.five, swIn > 0 ? 1 : 0)
    wipe(this.five, E.sine(S.f(lt, 2, .03, .42)), 'ltr')     // written on as the narrator reads it
    this.gen.style.transform = `translateY(${-sw * 16}px)`
    const tCheck = S.end(2) - clamp(.3 * d2, 2.4, 4)
    const flashT0 = S.at(2) + .42 * d2, flashStep = Math.max(.35, (tCheck - .1 - flashT0) / 5)
    const flash = k => env(lt, flashT0 + k * flashStep, flashT0 + (k + 1) * flashStep + .15, .2, .3)

    this.saws.forEach((s, k) => {
      let a, appear
      if (k === 3) { appear = prog(lt, S.at(2) + .75, .5); a = this.t5[3] * prog(lt, S.at(2) + 1, .9, E.back) }
      else {
        appear = prog(lt, tipAt(k) - .45, .45)
        a = lerp(this.tG[k] * prog(lt, tipAt(k), .9, E.back), this.t5[k], E.back(clamp((lt - S.at(2) - .8) / .9)))
      }
      op(s.grp, appear)
      const breath = 1 + .06 * Math.sin(lt * 2.2 + k)
      s.gl.setAttribute('r', 13 * breath); s.bl.setAttribute('r', 13 * breath)
      s.beam.setAttribute('transform', `rotate(${(a * 17).toFixed(3)} ${s.x} ${this.PY})`)
      const fl = flash(k)
      s.grp.style.filter = fl > 0.01 ? `drop-shadow(0 0 ${fl * 14}px ${C.yel})` : ''
      const cb = this.cols[k]; op(cb, fl); cb.style.transform = `scale(${lerp(1.06, 1, E.out(fl))})`
    })
    this.decG.forEach((f, k) => {
      const p = decIn(k)
      op(f, Math.min(p, 1 - sw2)); f.style.transform = `translateY(${(1 - p) * 26 - sw2 * 18}px)`
    })
    this.dec5.forEach((f, k) => {
      const fl = flash(k)
      op(f, sw2In); f.style.transform = `translateY(${(1 - sw2In) * 18}px) scale(${1 + .12 * fl})`
      f.style.textShadow = fl > 0.01 ? `0 0 ${18 * fl}px ${C.yel}` : ''
    })
    this.sumG.forEach((f, k) => { if (f) { const p = sumIn(k); op(f, Math.min(p, 1 - sw2)); f.style.transform = `translateY(${(1 - p) * 14}px)` } })
    this.sum5.forEach((f, k) => {
      const fl = flash(k)
      op(f, sw2In); f.style.transform = `translateY(${(1 - sw2In) * 14}px)`
      f.style.color = mixColor(C.mut, C.ink, Math.max(fl, prog(lt, flashT0 + (k + .5) * flashStep, .4)))
    })
    // cursor in the card: term k turns yellow while its seesaw tips (line 1) / flashes (line 2)
    this.gT.forEach((e, k) => {
      const q = k === 3 ? 0 : env(lt, tipAt(k) - .1, tipAt(k) + .75, .2, .3) * (1 - sw)
      e.style.color = mixColor(C.ink, C.yel, q)
    })
    this.fT.forEach((e, k) => {
      const q = flash(k)
      e.style.color = mixColor(C.ink, C.yel, q)
      e.style.textShadow = q > .01 ? `0 0 ${16 * q}px ${C.yel}88` : ''
    })
    // book sentence
    const sOut = S.p(lt, 2, 0, .5)
    const sIn = S.p(lt, 1, 0, .5)
    op(this.sent, Math.min(sIn, 1 - sOut))
    typeWords(this.sent, S.f(lt, 1, .02, .85))
    op(this.sentBar, Math.min(sIn, 1 - sOut)); this.sentBar.style.transform = `scaleY(${E.out(sIn)})`

    // ---- the numeric check
    const ck = prog(lt, tCheck, .6)
    rise(this.ck, ck, 24)
    const T = tCheck + .35
    wipe(this.ckF, prog(lt, T, 1.1), 'ltr')
    this.bars.forEach((r, k) => {
      const p = prog(lt, T + .3 + k * .22, .55, E.out)
      r.style.opacity = clamp(p * 3)
      r.style.transform = `translate(${(1 - p) * -140}px, ${(1 - p) * -170}px)`
      const lit = Math.max(env(lt, T + .5 + k * .22, T + 1.2 + k * .22, .1, .3), .0)
      this.ckN[k].style.color = mixColor(C.ink, G, lit)
    })
    op(this.tower31, prog(lt, T + 1.6, .5))
    pop(this.tick, prog(lt, T + 1.9, .5))
    this.ckR.style.transform = `scale(${1 + .15 * env(lt, T + 1.5, T + 2.4, .2, .4)})`
  },
})

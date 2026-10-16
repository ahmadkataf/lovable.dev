// s16 · مطابقة مفيدة — from x²−a² and x³−a³ to the book's identity for any n.
// Under the bracket, every term is decoded as x^α a^β and gets a little seesaw: α (green) on the left end,
// β (blue) on the right end, pivot fixed at the same height → the sum α+β never changes (= n−1).
// Then the book's example x⁵−a⁵: the seesaws settle on (4,0)…(0,4) and the five exponent pairs flash in turn.
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
    this.gen = tex(`${id('lhs', 'x^n - a^n')} ${id('eq', '=')} ${id('xag', '(x-a)')}${id('brkm', `\\left(${id('g0', `x^{${id('a0', 'n-1')}}`)} + ${id('g1', `x^{${id('a1', 'n-2')}}a`)} + ${id('g2', `x^{${id('a2', 'n-3')}}a^{${id('b2', '2')}}`)} + ${id('g3', '\\cdots')} + ${id('g4', `a^{${id('b4', 'n-1')}}`)}\\right)`)}`, 'mx')
    this.five = tex(`x^5 - a^5 = (x-a)\\left(${id('f0', `x^{${g(4)}}`)} + ${id('f1', `x^{${g(3)}}a`)} + ${id('f2', `x^{${g(2)}}a^{${b(2)}}`)} + ${id('f3', `xa^{${b(3)}}`)} + ${id('f4', `a^{${b(4)}}`)}\\right)`, 'mx')
    this.wrap = el('div', '', null, c.body); place(this.wrap, 796, 50, { anchor: 'c' })
    this.gen.style.fontSize = '60px'; this.wrap.appendChild(this.gen)
    this.five.style.fontSize = '60px'; c.body.appendChild(this.five); place(this.five, 796, 50, { anchor: 'c' })
    op(this.five, 0)
    this.gT = [0, 1, 2, 3, 4].map(k => $('g' + k))
    this.fT = [0, 1, 2, 3, 4].map(k => $('f' + k))
    this.gA = [$('a0'), $('a1'), $('a2')]
    this.gB = [$('b2'), $('b4')]
    this.eq = $('eq'); this.lhs = $('lhs')
    for (const e of [...this.gT, ...this.fT]) e.style.display = 'inline-block'
    // "x^n − a^n = ؟" comes first (the right side is written later)
    this.q = el('div', 'h2 yel', '؟', this.wrap); this.q.style.fontWeight = 900
    // the second bracket is underlined yellow on «قوسٍ ثانٍ» (inside the card, so it travels with it)
    this.brkM = $('brkm')
    this.brk = el('div', '', null, this.wrap)
    this.brk.style.cssText = `position:absolute;height:7px;border-radius:4px;background:${C.yel};box-shadow:0 0 16px ${C.yel}99;transform-origin:0 50%`
    op(this.brk, 0)

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
    const bm = R(this.brkM)
    place(this.brk, (bm.left - gr.left) * k - 4, (bm.bottom - gr.top) * k + 10, { w: bm.width * k + 8 })
    // familiar rows: their '=' under the general '=' (x only; nothing here is scaled horizontally)
    const eqX = R(this.body).left + 796 - gw / 2 + (er.left + er.width / 2 - gr.left) * k
    const rows = this.fam.map((f, i) => {
      f.style.transform = ''                                 // measure untransformed (render() sets it again)
      const fr = R(f), e = R(this.famEq[i])
      const eqOff = e.left + e.width / 2 - fr.left, left = eqX - eqOff
      f.style.left = left + 'px'
      f.style.transformOrigin = `${eqOff}px 50%`                  // "shrink and dim further" keeps the '=' in place
      return { right: left + f.offsetWidth, h: f.offsetHeight, y: 404 + i * 116 }
    })
    const bx = Math.max(rows[0].right, rows[1].right) + 40, y1 = rows[0].y - rows[0].h / 2 + 6, y2 = rows[1].y + rows[1].h / 2 - 6, ym = (y1 + y2) / 2
    this.brace.setAttribute('d', `M${bx},${y1} Q${bx + 16},${y1} ${bx + 16},${y1 + 18} L${bx + 16},${ym - 16} Q${bx + 16},${ym} ${bx + 32},${ym} Q${bx + 16},${ym} ${bx + 16},${ym + 16} L${bx + 16},${y2 - 18} Q${bx + 16},${y2} ${bx},${y2}`)
    this.brace._len = 0
    place(this.famTag, bx + 50, ym, { anchor: 'cl' })
    place(this.sentBar, 1794, 828, { w: 6, h: this.sent.offsetHeight - 12 })
  },

  // The script has four lines: ① familiar identities ② the general identity ③ x^α a^β and the seesaws ④ the x⁵ example.
  // Beat b is line b.
  _beats(S) { if (!this._B) this._B = [0, 1, 2, 3].map(i => [S.at(i), S.end(i)]); return this._B },

  render(lt, S) {
    if (this._sig !== this.gen.offsetWidth + '|' + this.sent.offsetHeight) this._layout()
    const G = C.grn, B = C.blu
    const BT = this._beats(S)
    const at = b => BT[b][0], end = b => BT[b][1], dur = b => Math.max(.01, BT[b][1] - BT[b][0])
    const P = (b, delay = 0, d = .6, ease = E.io) => prog(lt, at(b) + delay, d, ease)
    const F = (b, a = 0, c = 1) => clamp(((lt - at(b)) / dur(b) - a) / (c - a))
    const atf = (b, f) => at(b) + f * dur(b)
    this.head.set(P(0, 0, .8))

    // ---- beat 0 «ومن هذا المجموع مطابقةٌ مفيدة. تعرف أنّ x²−a² = (x−a)(x+a)»: the card asks "xⁿ − aⁿ = ؟",
    //      the familiar identities are written (dim) under the narration
    const pc = P(0, .5, .7)
    const up = P(2, .1, .9)                                        // beat 2: the card moves up to make room
    op(this.card, pc)
    this.card.style.transform = `translateY(${(1 - up) * this.CARD_DY + (1 - pc) * 30}px)`
    // beat 1 «والكتاب يعمّمها لكلّ n: xⁿ−aⁿ = (x−a) × مجموعٍ في قوسٍ ثانٍ»: the right side is written as it is read
    const wA = prog(lt, at(0) + .7, .8), wB = F(1, .56, .9)
    wipe(this.gen, wA * this.fEq + wB * (1 - this.fEq), 'ltr')
    this.wrap.style.translate = `calc(-50% + ${(1 - wB) * this.shift0}px) -50%`
    const qv = Math.min(prog(lt, at(0) + 1.2, .5), 1 - prog(lt, atf(1, .55) - .1, .3))
    pop(this.q, qv); if (qv >= 1) this.q.style.transform = `scale(${1 + .06 * Math.sin((lt - at(0)) * 3)})`
    const famIn = [F(0, .4, .62), prog(lt, Math.max(atf(0, .62), at(0) + 2), 1)]   // «تعرف فرق مربّعين، وفرق مكعّبين»
    const famDim = P(1, 0, .7)                                     // beat 1: they shrink and dim further
    const famOut = P(2, 0, .5)
    this.fam.forEach((f, i) => {
      wipe(f, famIn[i], 'ltr')
      op(f, lerp(1, .5, famDim) * (1 - famOut) * clamp(famIn[i] * 14))   // no sliver of the first glyph
      f.style.transform = `translateY(${-famOut * 30}px) scale(${lerp(1, .9, famDim)})`
    })
    const tagIn = prog(lt, Math.max(atf(0, .86), at(0) + 2.4), .6)
    draw(this.brace, tagIn); this.brace.style.opacity = lerp(1, .5, famDim) * (1 - famOut)
    op(this.famTag, Math.min(tagIn, 1 - famOut) * lerp(1, .6, famDim))
    // «يعمّمها»: the common factor (x − a) lights up in the known rows, then in the general one as it is read
    const xaF = env(lt, atf(1, .05), at(2) + .3, .5, .5), xaG = env(lt, atf(1, .62), at(2) + .3, .4, .5)
    this.xa.forEach((e, i) => (e.style.color = mixColor(i === 2 ? C.ink : C.mut, C.yel, i === 2 ? xaG : xaF)))
    this.lhs.style.color = mixColor(C.ink, C.yel, env(lt, atf(1, .33), atf(1, .55) + .3, .3, .4))
    // «في قوسٍ ثانٍ»: the second bracket is underlined (it stays while beat 2 starts «في القوس الثاني …»)
    const ul = Math.min(prog(lt, atf(1, .9), .6, E.out), 1 - prog(lt, Math.max(atf(2, .2), at(2) + 1.4), .5))
    op(this.brk, ul > 0 ? Math.min(1, ul * 3) : 0); this.brk.style.transform = `scaleX(${ul})`

    // ---- beat 2 «في القوس الثاني نجمع كلّ الحدود من الشكل x^α a^β، حيث α وβ … مجموعهما n−1»
    const d2 = dur(2)
    const decIn = k => P(2, .14 * d2 + k * .22, .55)
    const tipAt = k => atf(2, .42) + Math.min(k, 3) * .45
    const sumIn = k => P(2, .8 * d2 + Math.min(k, 3) * .15, .5)
    const cp = P(2, .16 * d2, .8)
    this.gA.forEach(e => (e.style.color = mixColor(C.ink, G, cp)))
    this.gB.forEach(e => (e.style.color = mixColor(C.ink, B, cp)))
    // ---- beat 3 transitions «مثلاً، x⁵−a⁵ = (x−a) × مجموعِ خمسة حدود، من x⁴ إلى a⁴»
    const sw = P(3, 0, .4), swIn = P(3, .3, .55)                  // card: general → x^5 (out, then in)
    const sw2 = P(3, .4, .4), sw2In = P(3, .75, .55)              // decoded terms / sums → n = 5
    const w5 = F(3, .03, .6)                              // written on as the narrator reads it (x⁵ − a⁵ = (x − a) × …)
    op(this.gen, Math.min(clamp(wA * 14), 1 - sw)); op(this.five, swIn > 0 ? clamp(w5 * 14) : 0)
    wipe(this.five, w5, 'ltr')
    this.gen.style.transform = `translateY(${-sw * 16}px)`
    // «… مجموعِ خمسة حدود، من x⁴ إلى a⁴»: the five exponent pairs flash in turn, the last one on «a⁴»
    const flashT0 = atf(3, .62), flashStep = Math.max(.35, (atf(3, .98) - flashT0) / 5)
    const flash = k => env(lt, flashT0 + k * flashStep, flashT0 + (k + 1) * flashStep + .15, .2, .3)

    this.saws.forEach((s, k) => {
      let a, appear
      if (k === 3) { appear = P(3, .75, .5); a = this.t5[3] * P(3, 1, .9, E.back) }
      else {
        appear = prog(lt, tipAt(k) - .45, .45)
        a = lerp(this.tG[k] * prog(lt, tipAt(k), .9, E.back), this.t5[k], E.back(clamp((lt - at(3) - .8) / .9)))
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
    // cursor in the card: term k turns yellow while its seesaw tips (beat 2) / flashes (beat 3)
    this.gT.forEach((e, k) => {
      const q = k === 3 ? 0 : env(lt, tipAt(k) - .1, tipAt(k) + .75, .2, .3) * (1 - sw)
      e.style.color = mixColor(C.ink, C.yel, q)
    })
    this.fT.forEach((e, k) => {
      const q = flash(k)
      e.style.color = mixColor(C.ink, C.yel, q)
      e.style.textShadow = q > .01 ? `0 0 ${16 * q}px ${C.yel}88` : ''
    })
    // book sentence (beat 2), typed along the narration
    const sOut = P(3, 0, .5)
    const sIn = P(2, 0, .5)
    op(this.sent, Math.min(sIn, 1 - sOut))
    typeWords(this.sent, F(2, .02, .85))
    op(this.sentBar, Math.min(sIn, 1 - sOut)); this.sentBar.style.transform = `scaleY(${E.out(sIn)})`
  },
})

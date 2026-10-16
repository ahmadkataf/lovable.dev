// s15 · مجموع حدود هندسيّة — shift-and-subtract, the division by 1-q, the q = 1 case, "n counts the terms", and a 31-tower check.
(() => {
  const ID = 's15'
  const G = C.grn, B = C.blu, Y = C.yel, R = C.red, PU = C.pur
  const tc = (c, s) => `\\textcolor{${c}}{${s}}`
  const T = (S, i, f) => S.at(i) + f * (S.end(i) - S.at(i))
  const P = (lt, S, i, f, d = .6, e = E.io) => prog(lt, T(S, i, f), d, e)
  const show = (e, pin, pout = 1, dy = 30) => { rise(e, pin, dy); op(e, pin * pout) }
  const mtex = (src, px) => { const t = tex(src, 'mm'); t.style.fontSize = px + 'px'; return t }
  const id = s => `${ID}-${s}`
  const GB = { x: 960, y: 560 }            // natural centre of the general key box (line 0)

  scene(ID, {
    build(root, S) {
      this.root = root
      this.head = heading(root, 'مجموع حدودٍ من متتالية هندسيّة')

      // ---------------- line 0: the book's statement ----------------
      this.book = rich(`وإذا كان $${tc(Y, 'S')}$ مجموعَ $n$ حداً متتالياً أوّلها $a$ من حدود متتالية هندسيّة أساسها $\\htmlId{${id('qn1')}}{${tc(R, 'q \\ne 1')}}$، كان`, 'p')
      this.book.querySelectorAll('bdi.m').forEach(m => { m.style.fontSize = '1.1em' })
      root.appendChild(this.book); place(this.book, 1800, 290, { anchor: 'tr', w: 1680 }); splitWords(this.book)
      this.qHl = el('div', 'hlbox', null, root); this.qHl.style.borderColor = R; this.qHl.style.boxShadow = `0 0 26px ${R}55`; op(this.qHl, 0)
      this.kb = keyBox(root, `S = a\\,\\dfrac{1-q^{\\htmlId{${id('kn')}}{n}}}{1-q}`, GB.x, GB.y, { cls: 'ml' })
      this.kb.el.style.transformOrigin = '50% 50%'
      this.kb.el.style.zIndex = 3
      this.ask = chip(root, 'فمن أين يأتي هذا القانون؟', 960, 820, { anchor: 'c', color: Y })
      this.ask.style.cssText += ';font-size:34px;white-space:nowrap'

      // ---------------- line 1: shift and subtract ----------------
      const lab = 200, Tw = 170, Pw = 60
      const colX = k => 960 - (lab + 6 * Tw + 5 * Pw) / 2 + lab + Math.floor(k / 2) * (Tw + Pw) + (k % 2 ? Tw : 0)   // k: 0 term,1 plus,2 term…
      this.colX = colX; this.Tw = Tw; this.Pw = Pw
      const cell = (src, x, y, w, px = 54) => { const t = mtex(src, px); root.appendChild(t); place(t, x + w / 2, y, { anchor: 'c' }); return t }
      const y1 = 470, y2 = 595
      this.y1 = y1; this.y2 = y2
      const top = ['a', '+', 'aq', '+', 'aq^2', '+', '\\cdots', '+', 'aq^{n-1}']
      const bot = ['aq', '+', 'aq^2', '+', '\\cdots', '+', 'aq^{n-1}', '+', 'aq^n']
      this.l1 = mtex(`${tc(Y, 'S')} =`, 54); root.appendChild(this.l1); place(this.l1, colX(0) - 22, y1, { anchor: 'cr' })
      this.r1 = top.map((s, k) => cell(s, colX(k), y1, k % 2 ? Pw : Tw))
      this.l2 = mtex(`${tc(G, 'q')}${tc(Y, 'S')} =`, 54); root.appendChild(this.l2); place(this.l2, colX(0) - 22, y2, { anchor: 'cr' })
      this.r2 = bot.map((s, k) => cell(s, colX(k), y2, k % 2 ? Pw : Tw))   // drawn unshifted; slides one slot (Tw+Pw) to the right
      this.minus = mtex('-', 54); root.appendChild(this.minus); place(this.minus, colX(0) - lab - 10, y2, { anchor: 'c' })
      this.rule = el('div', '', null, root)
      this.rule.style.cssText += `height:3px;border-radius:2px;background:${C.mut};transform-origin:0 50%`
      place(this.rule, colX(0) - lab, y2 + 52, { w: 6 * Tw + 5 * Pw + lab + 10 })
      const cs = svg(root, 0, 0, W, H)
      this.conn = [2, 4, 6, 8].map(k => sv(cs, 'path', { d: `M${colX(k) + Tw / 2},${y1 + 34} L${colX(k) + Tw / 2},${y2 - 34}`, stroke: Y, 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' }))
      this.connSvg = cs
      this.res1 = mtex(`${tc(Y, 'S')} - q${tc(Y, 'S')} = a - aq^n`, 60); root.appendChild(this.res1); place(this.res1, 960, 730, { anchor: 'c' })
      // S(1-q) = a(1-q^n): natural place = its line-2 spot (left column); during line 1 it sits under the subtraction
      this.res2 = mtex(`${tc(Y, 'S')}\\htmlId{${id('omq')}}{(1-q)} = a(1-q^n)`, 60); root.appendChild(this.res2); place(this.res2, 540, 350, { anchor: 'c' })
      this.res2b = rich('أي', 's'); root.appendChild(this.res2b); place(this.res2b, 0, 0, { anchor: 'cr' })

      // ---------------- line 2: divide by 1-q; the q = 1 case ----------------
      const es = svg(root, 0, 0, W, H)
      this.ring = sv(es, 'ellipse', { cx: 0, cy: 0, rx: 10, ry: 10, stroke: R, 'stroke-width': 4, fill: 'none' })
      this.down = el('div', '', null, root)
      this.down.style.cssText += 'display:flex;align-items:center;gap:22px;direction:ltr'
      this.down.appendChild(mtex('\\Big\\Downarrow', 52))
      this.down.appendChild(mtex(`\\div\\,${tc(R, '(1-q)')}`, 44))
      place(this.down, 520, 468, { anchor: 'cl' })
      this.down.style.marginLeft = '-26px'
      this.note = rich(`مسموح لأنّ: $${tc(R, 'q \\ne 1 \\Rightarrow 1-q \\ne 0')}$`, 'p'); root.appendChild(this.note)
      this.note.style.whiteSpace = 'nowrap'; place(this.note, 540, 872, { anchor: 'c' })
      const wc = card(root, 'warn', 1800, 360, 690, { tag: '⚠️ انتبه' })
      this.wcard = wc.el
      wc.el.style.translate = '-100% 0'
      wc.body.style.cssText += 'display:flex;flex-direction:column;align-items:center;gap:26px'
      this.w1 = rich(`إذا كان $${tc(R, 'q = 1')}$ :`, 'h3'); wc.body.appendChild(this.w1)
      this.w2 = mtex('', 52); wc.body.appendChild(this.w2)
      this.w2.innerHTML = katex.renderToString(`S = \\underbrace{a + a + \\cdots + a}_{${tc(B, 'n')}}`, KOPT)
      this.w3 = mtex(`S = ${tc(G, 'n\\,a')}`, 62); wc.body.appendChild(this.w3)

      // ---------------- line 3: n counts the terms ----------------
      const ac = card(root, 'warn', 960, 268, 1620, { anchor: 'tc', h: 384, tag: '⚠️ انتبه' })
      this.acard = ac.el; ac.el.style.transformOrigin = '50% 0'
      this.terms = mtex(`\\htmlId{${id('t0')}}{a} + \\htmlId{${id('t1')}}{aq} + \\htmlId{${id('t2')}}{aq^2} + \\htmlId{${id('td')}}{\\cdots} + \\htmlId{${id('t3')}}{aq^{\\htmlId{${id('t3e')}}{n-1}}}`, 60)
      root.appendChild(this.terms); place(this.terms, 640, 462, { anchor: 'c' })
      this.cnt = ['1', '2', '3', '⋯', 'n'].map((v, k) => {
        const d = el('div', '', v === 'n' ? katex.renderToString('n', KOPT) : v, root)
        const dots = v === '⋯'
        d.style.cssText += dots ? `color:${B};font-size:34px;font-weight:900` : `width:50px;height:50px;border-radius:50%;background:${B};color:#0b1020;font-weight:900;font-size:30px;display:flex;align-items:center;justify-content:center`
        place(d, 0, 0, { anchor: 'c' })
        return d
      })
      this.t3Hl = el('div', 'hlbox', null, root); this.t3Hl.style.borderColor = R; this.t3Hl.style.boxShadow = `0 0 20px ${R}55`; this.t3Hl.style.borderRadius = '10px'; op(this.t3Hl, 0)
      this.knHl = el('div', 'hlbox', null, root); this.knHl.style.borderRadius = '10px'; this.knHl.style.zIndex = 4; op(this.knHl, 0)
      const ns = svg(root, 0, 0, W, H); ns.style.zIndex = 4
      this.nArrow = sv(ns, 'path', { d: 'M0,0', stroke: Y, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' })
      this.nHead = sv(ns, 'path', { d: 'M0,0', fill: Y })
      this.note3 = rich(`$${tc(Y, 'n')}$ = عدد الحدود &nbsp;(آخر أُسّ هو $${tc(R, 'n-1')}$)`, 'h3'); root.appendChild(this.note3)
      this.note3.style.whiteSpace = 'nowrap'; place(this.note3, 1720, 596, { anchor: 'cr' })
      this.kSp = keyBox(root, '1 + q + q^2 + \\cdots + q^{n-1} = \\dfrac{1-q^n}{1-q}', 900, 790, { cls: 'mx', label: 'وبوجه خاصّ' })
      this.kSp.el.style.transformOrigin = '50% 50%'
      this.a1 = chip(root, rich(`مع $a = 1$`, 's').innerHTML, 1480, 790, { anchor: 'cl', color: PU })
      this.a1.style.cssText += ';font-size:32px;white-space:nowrap'

      // ---------------- line 4: check with q = 2, n = 5 ----------------
      const s4 = svg(root, 0, 0, W, H)
      this.towerSvg = s4
      const vals = [1, 2, 4, 8, 16], unit = 17, base = 900, bw = 62, pitch = 84, bx0 = 170, tx = 680, tw = 100
      Object.assign(this, { vals, unit, base, bw, pitch, bx0, tx, tw })
      const defs = sv(s4, 'defs'), gr = sv(defs, 'linearGradient', { id: id('gg'), x1: 0, y1: 0, x2: 1, y2: 0 })
      sv(gr, 'stop', { offset: 0, 'stop-color': G, 'stop-opacity': .95 }); sv(gr, 'stop', { offset: 1, 'stop-color': G, 'stop-opacity': .55 })
      this.axis4 = sv(s4, 'path', { d: `M${bx0 - 30},${base} L${tx + tw + 150},${base}`, stroke: C.mut, 'stroke-width': 3, fill: 'none' })
      this.bars = vals.map(() => sv(s4, 'rect', { x: 0, y: 0, width: bw, height: 0, rx: 6, fill: `url(#${id('gg')})`, stroke: G, 'stroke-width': 3 }))
      this.bl = vals.map((v, k) => { const t = mtex(String(v), 36); root.appendChild(t); place(t, bx0 + k * pitch + bw / 2, base - v * unit - 28, { anchor: 'c' }); return t })
      let acc = 0
      let yPrev = base - 2
      this.segL = vals.map(v => {
        const t = mtex(tc(C.mut, String(v)), 28); root.appendChild(t)
        const y = Math.min(base - (acc + v / 2) * unit, yPrev - 28); yPrev = y
        place(t, tx + tw + 18, y, { anchor: 'cl' }); acc += v; return t
      })
      this.total = el('div', '', '0', root)
      this.total.style.cssText += `font-family:KaTeX_Main;font-weight:700;font-size:60px;color:${Y}`
      place(this.total, tx + tw / 2, 0, { anchor: 'bc' })
      this.qn = chip(root, rich('$q = 2,\\ \\ n = 5$', 's').innerHTML, 1290, 470, { anchor: 'c', color: B })
      this.qn.style.cssText += ';font-size:34px;white-space:nowrap'
      this.sum4 = mtex(`1 + 2 + 4 + 8 + 16 = ${tc(G, '31')}`, 56); root.appendChild(this.sum4); place(this.sum4, 1290, 600, { anchor: 'c' })
      this.chk = el('div', '', null, root)
      this.chk.style.cssText += 'display:flex;align-items:center;gap:22px;direction:ltr'
      this.chkF = mtex(`\\dfrac{1-2^5}{1-2} = \\dfrac{-31}{-1} = ${tc(G, '\\mathbf{31}')}`, 60); this.chk.appendChild(this.chkF)
      this.tick = el('div', '', '✓', this.chk); this.tick.style.cssText = `font-size:76px;font-weight:900;color:${G};text-shadow:0 0 24px ${G}88`
      place(this.chk, 1290, 790, { anchor: 'c' })
    },

    // glyph-dependent geometry, measured once the KaTeX fonts are in (with transforms neutralised)
    measure() {
      if (this._m || document.fonts.status !== 'loaded') return
      this._m = true
      const root = this.root, R_ = e => rectIn(typeof e === 'string' ? document.getElementById(id(e)) : e, root)
      const resets = [this.kb.el, this.res2, this.terms, this.book]
      const keep = resets.map(e => e.style.transform)
      resets.forEach(e => { e.style.transform = 'none' })
      const q = R_('qn1'); place(this.qHl, q.x - 6, q.y - 4, { w: q.w + 12, h: q.h + 8 })
      const o = R_('omq')
      this.ring.setAttribute('cx', o.cx); this.ring.setAttribute('cy', o.cy); this.ring.setAttribute('rx', o.w / 2 + 6); this.ring.setAttribute('ry', o.h / 2 + 12)
      const r2 = R_(this.res2)
      place(this.res2b, r2.x - 24, r2.y + r2.h / 2, { anchor: 'cr' })
      this.res2Home = { x: r2.cx, y: r2.cy }
      // counters above the terms
      const ts = ['t0', 't1', 't2', 'td', 't3'].map(R_)
      ts.forEach((r, k) => place(this.cnt[k], r.cx, Math.min(...ts.map(t => t.y)) - 40, { anchor: 'c' }))
      const e3 = R_('t3e'); place(this.t3Hl, e3.x - 5, e3.y - 2, { w: e3.w + 10, h: e3.h + 4 })
      // exponent n of the key box when the box sits at (1390, 470) scaled .74
      const kn = R_('kn'), kc = R_(this.kb.el)
      this.knOff = { x: kn.cx - kc.cx, y: kn.cy - kc.cy, w: kn.w, h: kn.h }
      const K3 = { x: 1400, y: 452, s: .74 }
      this.K3 = K3
      const nx = K3.x + this.knOff.x * K3.s, ny = K3.y + this.knOff.y * K3.s
      place(this.knHl, nx - this.knOff.w * K3.s / 2 - 7, ny - this.knOff.h * K3.s / 2 - 5, { w: this.knOff.w * K3.s + 14, h: this.knOff.h * K3.s + 10 })
      const cn = R_(this.cnt[4])
      const ax = nx - 4, ay = ny - this.knOff.h * K3.s / 2 - 10, bxp = cn.cx + 30, byp = cn.cy - 8
      this.nArrow.setAttribute('d', `M${ax},${ay} C${ax - 40},${ay - 70} ${bxp + 140},${byp - 70} ${bxp + 4},${byp - 2}`)
      // arrow head pointing left into the counter
      this.nHead.setAttribute('d', `M${bxp - 6},${byp} L${bxp + 14},${byp - 12} L${bxp + 12},${byp + 10} Z`)
      resets.forEach((e, k) => { e.style.transform = keep[k] })
    },

    render(lt, S) {
      this.measure()
      this.head.set(S.p(lt, 0, 0, .7))
      const L = i => S.end(i) - S.at(i)

      // ======== line 0 ========
      const out1 = 1 - S.p(lt, 1, 0, .5)
      op(this.book, S.p(lt, 0, .3, .3) * out1)
      typeWords(this.book, clamp((lt - S.at(0) - .3) / Math.max(1.5, .42 * L(0))))
      const pq = P(lt, S, 0, .6, .5)
      op(this.qHl, clamp(pq * 1.5) * out1); this.qHl.style.transform = `scale(${lerp(1.15, 1, E.out(pq))})`
      show(this.ask, P(lt, S, 0, .84, .6), out1, 20)

      // the general key box travels through the whole scene
      const pk = P(lt, S, 0, .38, .7)
      const park = S.p(lt, 1, 0, .9)                 // line 1: parked top-left as the goal
      // line 2: the parked goal fades out, then the box re-appears where the derivation lands
      const parkOut = S.p(lt, 2, 0, .4), tLand = Math.max(T(S, 2, .24), S.at(2) + 1.6), landIn = prog(lt, tLand, .7)
      const land = lt >= tLand ? 1 : 0
      const to3 = S.p(lt, 3, .1, .9)                 // line 3: moves into the warning card
      const outK = 1 - S.p(lt, 4, 0, .5)
      let kx = GB.x, ky = GB.y, ks = 1
      const lerpP = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), s: lerp(a.s, b.s, p) })
      let k = { x: GB.x, y: GB.y, s: 1 }
      k = lerpP(k, { x: 300, y: 262, s: .5 }, park)
      k = lerpP(k, { x: 540, y: 662, s: 1 }, land)
      k = lerpP(k, this.K3 ? { x: this.K3.x, y: this.K3.y, s: this.K3.s } : k, to3)
      const kpop = (pk <= 0 ? .85 : lerp(.85, 1, E.back(clamp(pk)))) * (land ? lerp(.85, 1, E.back(landIn)) : 1)
      this.kb.el.style.transform = `translate(${k.x - GB.x}px,${k.y - GB.y}px) scale(${kpop * k.s})`
      op(this.kb.el, clamp(pk * 2.5) * outK * (land ? clamp(landIn * 2.5) : 1 - parkOut))
      this.kb.el.style.boxShadow = `0 0 ${42 + 16 * Math.sin(lt * 1.6)}px ${Y}3a`

      // ======== line 1: shift and subtract ========
      const out2 = 1 - S.p(lt, 2, 0, .5)
      const g1 = clamp((L(1) - 1) / 8, .5, 1)          // compresses the minimum gaps when the voice is fast
      const t1 = Math.max(T(S, 1, .04), S.at(1) + .6 * g1)
      const pr1 = prog(lt, t1, .9)
      op(this.l1, pr1 * out2)
      this.r1.forEach((e, j) => { const p = prog(lt, t1 + j * .06, .45); op(e, p); e.style.transform = `translateY(${(1 - p) * 18}px)` })
      const t2 = Math.max(T(S, 1, .2), t1 + 1.0 * g1)
      const p2 = prog(lt, t2, .5)
      const tS = Math.max(T(S, 1, .33), t2 + .7 * g1)
      const shift = prog(lt, tS, .8) * (this.Tw + this.Pw)
      op(this.l2, p2 * out2)
      const tC = Math.max(T(S, 1, .48), tS + .9 * g1)
      const tV = Math.max(T(S, 1, .58), tC + .9 * g1)
      const vanish = j => prog(lt, tV + j * .22 * g1, .55)     // pair j = 0..3  (aq, aq^2, ⋯, aq^{n-1})
      // row-2 cells: index k → pair index (k even: k/2 for k<=6), plus signs between
      this.r2.forEach((e, k) => {
        let v = 0, dy = 0
        if (k % 2 === 0 && k <= 6) { v = vanish(k / 2); dy = -v * 55 }
        else if (k % 2 === 1) v = vanish(Math.min(3, (k - 1) / 2))
        e.style.transform = `translate(${shift}px,${(1 - p2) * 22 + dy}px) scale(${1 - .25 * v})`
        op(e, p2 * (k <= 7 ? 1 - v : 1) * out2 * (shift > 0 || k % 2 === 0 ? 1 : 1))
      })
      this.r1.forEach((e, k) => {
        let v = 0, dy = 0
        if (k % 2 === 0 && k >= 2) { v = vanish(k / 2 - 1); dy = v * 55 }
        else if (k % 2 === 1) v = vanish(Math.max(0, (k - 3) / 2))
        const p = prog(lt, t1 + k * .06, .45)
        e.style.transform = `translateY(${(1 - p) * 18 + dy}px) scale(${1 - .25 * v})`
        op(e, p * (k === 0 ? 1 : 1 - v) * out2)
      })
      this.conn.forEach((c, j) => { draw(c, prog(lt, tC + j * .18, .35)); c.style.opacity = (1 - vanish(j)) * out2 })
      const pm = prog(lt, Math.max(T(S, 1, .54), tC + .5 * g1), .5)
      op(this.minus, pm * out2)
      this.rule.style.transform = `scaleX(${pm})`; op(this.rule, (pm > 0 ? .85 : 0) * out2)
      const tR = Math.min(Math.max(T(S, 1, .76), tV + 1.1 * g1), S.end(1) - .9)
      show(this.res1, prog(lt, tR, .6), out2, 20)
      // S(1-q) = a(1-q^n): appears under the subtraction, then (line 2) rises to the left column
      const pR2 = prog(lt, Math.min(Math.max(T(S, 1, .86), tR + .5), S.end(1) - .3), .6)
      const up = S.p(lt, 2, .1, .9)
      const out3 = 1 - S.p(lt, 3, 0, .5)
      const h = this.res2Home || { x: 540, y: 350 }
      this.res2.style.transform = `translate(${lerp(960 - h.x, 0, up)}px,${lerp(845 - h.y, 0, up) + (1 - pR2) * 20}px)`
      op(this.res2, pR2 * out3)
      op(this.res2b, Math.min(pR2, 1 - up) * out2)
      this.res2b.style.transform = `translate(${960 - h.x}px,${845 - h.y}px)`

      // ======== line 2: divide by 1-q, q = 1 ========
      const pRing = P(lt, S, 2, .12, .6)
      draw(this.ring, pRing); this.ring.style.opacity = out3
      show(this.down, P(lt, S, 2, .18, .5), out3, -16)
      show(this.note, P(lt, S, 2, .36, .6), out3, 16)
      const pw = P(lt, S, 2, .6, .7)
      show(this.wcard, pw, out3, 40)
      show(this.w1, P(lt, S, 2, .64, .5), 1, 12)
      show(this.w2, P(lt, S, 2, .7, .5), 1, 12)
      show(this.w3, P(lt, S, 2, .8, .5), 1, 12)

      // ======== line 3: n = number of terms ========
      const out4 = 1 - S.p(lt, 4, 0, .5)
      const pc = S.p(lt, 3, .35, .6)
      op(this.acard, pc * out4); this.acard.style.transform = `scale(${lerp(.97, 1, pc)})`
      show(this.terms, S.p(lt, 3, .6, .6), out4, 20)
      this.cnt.forEach((c, j) => { const p = prog(lt, Math.max(T(S, 3, .12), S.at(3) + 1.1) + j * .35, .45); pop(c, p); op(c, clamp(p * 2.5) * out4) })
      const tA = Math.max(T(S, 3, .3), S.at(3) + 3)
      const pa = prog(lt, tA, .8)
      draw(this.nArrow, pa); this.nArrow.style.opacity = out4
      op(this.nHead, pa >= .98 ? out4 : 0)
      const pkn = prog(lt, tA - .3, .5)
      op(this.knHl, clamp(pkn * 1.5) * out4)
      const p3h = prog(lt, tA + .6, .5)
      op(this.t3Hl, clamp(p3h * 1.5) * out4)
      show(this.note3, prog(lt, tA + .5, .6), out4, 16)
      const pSp = P(lt, S, 3, .62, .7)
      const kSpMove = S.p(lt, 4, 0, .9)
      this.kSp.set(pSp)
      const kspPop = pSp <= 0 ? .85 : lerp(.85, 1, E.back(clamp(pSp)))
      this.kSp.el.style.transform = `translate(${lerp(0, 1290 - 900, kSpMove)}px,${lerp(0, 330 - 790, kSpMove)}px) scale(${kspPop * lerp(1, .64, kSpMove)})`
      op(this.kSp.el, clamp(pSp * 2.5))
      this.kSp.el.style.boxShadow = `0 0 ${42 + 16 * Math.sin(lt * 1.6 + 1)}px ${Y}3a`
      show(this.a1, P(lt, S, 3, .58, .6), out4, 16)

      // ======== line 4: 1+2+4+8+16 = 31 ========
      const L4 = L(4)
      const g4 = clamp((L(4) - 1) / 6.4, .5, 1)
      const t4 = S.at(4) + .5
      const axL = lerp(this.bx0 - 30, this.tx - 70, prog(lt, Math.max(T(S, 4, .22), t4 + 1.6 * g4) + 4 * Math.min(.55, .07 * L4 + .1) + .5, .8))
      this.axis4.setAttribute('d', `M${axL},${this.base} L${this.tx + this.tw + 150},${this.base}`); this.axis4._len = 0
      draw(this.axis4, prog(lt, t4 - .1, .5))
      const tStack = Math.max(T(S, 4, .22), t4 + 1.6 * g4)
      const dStack = Math.min(.55, .07 * L4 + .1)
      let acc = 0, shown = 0
      this.bars.forEach((r, j) => {
        const v = this.vals[j]
        const pin = prog(lt, t4 + j * .18, .45, E.out)
        const pm2 = prog(lt, tStack + j * dStack, dStack * 1.1)
        const x = lerp(this.bx0 + j * this.pitch, this.tx, pm2), w = lerp(this.bw, this.tw, pm2)
        const hgt = v * this.unit * pin
        const yBottom = lerp(this.base, this.base - acc * this.unit, pm2) - Math.sin(Math.PI * pm2) * 40
        r.setAttribute('x', x); r.setAttribute('width', w); r.setAttribute('height', Math.max(0, hgt)); r.setAttribute('y', yBottom - hgt)
        r.style.opacity = pin > 0 ? 1 : 0
        op(this.bl[j], Math.min(prog(lt, t4 + j * .18 + .25, .4), 1 - prog(lt, tStack + j * dStack, .3)))
        show(this.segL[j], prog(lt, tStack + j * dStack + dStack * .9, .4), 1, 0)
        if (pm2 >= 1) shown = acc + v
        acc += v
      })
      op(this.towerSvg, 1)
      const nIn = this.bars.reduce((n, _, j) => n + (prog(lt, tStack + j * dStack, dStack * 1.1) >= 1 ? 1 : 0), 0)
      this.total.textContent = shown
      this.total.style.top = (this.base - shown * this.unit - 14) + 'px'
      op(this.total, nIn > 0 ? 1 : 0)
      const done = prog(lt, tStack + 4 * dStack + dStack * 1.1, .5)
      this.total.style.color = mixColor(Y, G, done)
      this.total.style.textShadow = done > 0 ? `0 0 ${26 * done}px ${G}88` : ''
      show(this.qn, prog(lt, t4 + .2, .5), 1, 16)
      show(this.sum4, prog(lt, Math.min(Math.max(T(S, 4, .5), tStack + 4 * dStack + .4 * g4), S.end(4) - 1.6), .6), 1, 16)
      const tChk = Math.min(Math.max(T(S, 4, .66), tStack + 4 * dStack + 1.1 * g4), S.end(4) - 1.0)
      wipe(this.chkF, prog(lt, tChk, .9), 'ltr')
      pop(this.tick, prog(lt, tChk + 1.0, .5))
    },
  })
})()

// s15 · مجموع حدود هندسيّة — the book's formula, shift-and-subtract, the division by 1-q (allowed: q ≠ 1),
// "n counts the terms" and the book's special case (a = 1).
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
      this.book.querySelector('#' + id('qn1')).closest('bdi.m').style.margin = '0 4px 0 16px'
      root.appendChild(this.book); place(this.book, 1800, 290, { anchor: 'tr', w: 1680 }); splitWords(this.book)
      this.qHl = el('div', 'hlbox', null, root); this.qHl.style.borderColor = R; this.qHl.style.boxShadow = `0 0 26px ${R}55`; op(this.qHl, 0)
      this.kb = keyBox(root, `\\htmlId{${id('kS')}}{S} = \\htmlId{${id('ka')}}{a}\\,\\dfrac{\\htmlId{${id('knum')}}{1-q^{\\htmlId{${id('kn')}}{n}}}}{\\htmlId{${id('kden')}}{1-q}}`, GB.x, GB.y, { cls: 'ml' })
      this.kb.el.style.transformOrigin = '50% 50%'
      this.kb.el.style.zIndex = 3
      this.kRead = ['kS', 'ka', 'knum', 'kden'].map(k => this.kb.el.querySelector('#' + id(k)))
      this.ask = chip(root, 'فمن أين يأتي هذا القانون؟', 960, 820, { anchor: 'c', color: Y })
      this.ask.style.cssText += ';font-size:34px;white-space:nowrap'

      // ---------------- line 1: shift and subtract ----------------
      const lab = 200, Tw = 170, Pw = 60
      const colX = k => 960 - (lab + 6 * Tw + 5 * Pw) / 2 + lab + Math.floor(k / 2) * (Tw + Pw) + (k % 2 ? Tw : 0)   // k: 0 term,1 plus,2 term…
      this.colX = colX; this.Tw = Tw; this.Pw = Pw
      const cell = (src, x, y, w, px = 54) => { const t = mtex(src, px); root.appendChild(t); place(t, x + w / 2, y, { anchor: 'c' }); return t }
      const y1 = 450, y2 = 580
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
      place(this.rule, colX(0) - lab, y2 + 100, { w: 6 * Tw + 5 * Pw + lab + 10 })
      const cs = svg(root, 0, 0, W, H)
      this.conn = [2, 4, 6, 8].map(k => sv(cs, 'path', { d: `M${colX(k) + Tw / 2},${y1 + 34} L${colX(k) + Tw / 2},${y2 - 34}`, stroke: Y, 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' }))
      this.connSvg = cs
      this.res1 = mtex(`${tc(Y, 'S')} - q${tc(Y, 'S')} = a - aq^n`, 60); root.appendChild(this.res1); place(this.res1, 960, 755, { anchor: 'c' })
      // the two survivors: tags under a (first of row 1) and under aq^n (last of row 2, after the shift)
      const tagStyle = e => { e.style.cssText += `font-size:28px;font-weight:800;color:${Y};white-space:nowrap;padding:2px 16px;border-radius:999px;background:rgba(255,210,63,.12);border:1.5px solid rgba(255,210,63,.45)` }
      this.tagA = rich('أوّل السطر الأوّل', 's'); tagStyle(this.tagA); root.appendChild(this.tagA); place(this.tagA, colX(0) + Tw / 2, y1 + 66, { anchor: 'c' })
      this.tagN = rich('آخر السطر الثاني', 's'); tagStyle(this.tagN); root.appendChild(this.tagN); place(this.tagN, colX(8) + Tw + Pw + Tw / 2, y2 + 62, { anchor: 'c' })
      // S(1-q) = a(1-q^n): natural place = its line-2 spot (top of the centred column); during line 1 it sits under the subtraction
      this.res2 = mtex(`${tc(Y, 'S')}\\,\\htmlId{${id('omq')}}{(1-q)}\\,= a(1-q^n)`, 60); root.appendChild(this.res2); place(this.res2, 960, 350, { anchor: 'c' })
      this.res2b = rich('أي', 's'); root.appendChild(this.res2b); place(this.res2b, 0, 0, { anchor: 'cr' })

      // ---------------- line 2: divide by 1-q (allowed because q ≠ 1) — centred column ----------------
      const es = svg(root, 0, 0, W, H)
      this.ring = sv(es, 'rect', { x: 0, y: 0, width: 10, height: 10, rx: 14, stroke: R, 'stroke-width': 4, fill: 'none' })
      this.down = el('div', '', null, root)
      this.down.style.cssText += 'display:flex;align-items:center;gap:22px;direction:ltr'
      this.down.appendChild(mtex('\\Big\\Downarrow', 52))
      this.down.appendChild(mtex(`\\div\\,${tc(R, '(1-q)')}`, 44))
      place(this.down, 940, 468, { anchor: 'cl' })
      this.down.style.marginLeft = '-26px'
      this.note = rich(`مسموح لأنّ: $${tc(R, 'q \\ne 1 \\Rightarrow 1-q \\ne 0')}$`, 'p'); root.appendChild(this.note)
      this.note.style.whiteSpace = 'nowrap'; place(this.note, 960, 872, { anchor: 'c' })
      // ---------------- line 3: n counts the terms ----------------
      const ac = card(root, 'warn', 960, 302, 1620, { anchor: 'tc', h: 372, tag: '⚠️ انتبه' })
      this.acard = ac.el; ac.el.style.transformOrigin = '50% 0'
      this.terms = mtex(`\\htmlId{${id('t0')}}{a} + \\htmlId{${id('t1')}}{aq} + \\htmlId{${id('t2')}}{aq^2} + \\htmlId{${id('td')}}{\\cdots} + \\htmlId{${id('t3')}}{aq^{\\htmlId{${id('t3e')}}{n-1}}}`, 60)
      root.appendChild(this.terms); place(this.terms, 640, 492, { anchor: 'c' })
      this.t3eEl = this.terms.querySelector('#' + id('t3e'))
      this.cnt = ['1', '2', '3', '⋯', 'n'].map((v, k) => {
        const d = el('div', '', v === 'n' ? katex.renderToString('n', KOPT) : v, root)
        const dots = v === '⋯'
        d.style.cssText += dots ? `color:${B};font-size:34px;font-weight:900` : `width:50px;height:50px;border-radius:50%;background:${B};color:#0b1020;font-weight:900;font-size:30px;display:flex;align-items:center;justify-content:center`
        place(d, 0, 0, { anchor: 'c' })
        return d
      })
      this.knEl = this.kb.el.querySelector('#' + id('kn'))
      const ns = svg(root, 0, 0, W, H); ns.style.zIndex = 4
      this.nArrow = sv(ns, 'path', { d: 'M0,0', stroke: Y, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' })
      this.nHead = sv(ns, 'path', { d: 'M0,0', fill: Y })
      this.note3 = rich(`$${tc(Y, 'n')}$ = عدد الحدود &nbsp;(آخر أُسّ هو $${tc(R, 'n-1')}$)`, 'h3'); root.appendChild(this.note3)
      this.note3.style.whiteSpace = 'nowrap'; place(this.note3, 1720, 626, { anchor: 'cr' })
      this.kSp = keyBox(root, '1 + q + q^2 + \\cdots + q^{n-1} = \\dfrac{1-q^n}{1-q}', 900, 818, { cls: 'mx', label: 'وبوجه خاصّ' })
      this.kSp.el.style.transformOrigin = '50% 50%'
      this.a1 = chip(root, rich(`مع $a = 1$`, 's').innerHTML, 1480, 818, { anchor: 'cl', color: PU })
      this.a1.style.cssText += ';font-size:32px;white-space:nowrap'

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
      this.ring.setAttribute('x', o.x - 7); this.ring.setAttribute('y', o.y - 6); this.ring.setAttribute('width', o.w + 14); this.ring.setAttribute('height', o.h + 12)
      const r2 = R_(this.res2)
      place(this.res2b, r2.x - 24, r2.y + r2.h / 2, { anchor: 'cr' })
      this.res2Home = { x: r2.cx, y: r2.cy }
      // counters above the terms
      const ts = ['t0', 't1', 't2', 'td', 't3'].map(R_)
      ts.forEach((r, k) => place(this.cnt[k], r.cx, Math.min(...ts.map(t => t.y)) - 40, { anchor: 'c' }))
      // exponent n of the key box when the box sits at (1390, 470) scaled .74
      const kn = R_('kn'), kc = R_(this.kb.el)
      this.knOff = { x: kn.cx - kc.cx, y: kn.cy - kc.cy, w: kn.w, h: kn.h }
      const K3 = { x: 1400, y: 482, s: .74 }
      this.K3 = K3
      const nx = K3.x + this.knOff.x * K3.s, ny = K3.y + this.knOff.y * K3.s
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
      typeWords(this.book, clamp((lt - S.at(0) - .3) / Math.max(1.5, .3 * L(0))))
      const pq = prog(lt, Math.max(T(S, 0, .34), S.at(0) + .3 + Math.max(1.5, .3 * L(0)) * .95), .5)
      op(this.qHl, clamp(pq * 1.5) * out1); this.qHl.style.transform = `scale(${lerp(1.15, 1, E.out(pq))})`
      show(this.ask, P(lt, S, 0, .86, .6), out1, 20)

      // the general key box travels through the whole scene
      const pk = P(lt, S, 0, .42, .7)
      const park = S.p(lt, 1, 0, .9)                 // line 1: parked top-left as the goal
      // line 2: the parked goal fades out, then the box re-appears where the derivation lands
      const parkOut = S.p(lt, 2, 0, .4), tLand = Math.max(T(S, 2, .24), S.at(2) + 1.6), landIn = prog(lt, tLand, .7)
      const land = lt >= tLand ? 1 : 0
      const to3 = S.p(lt, 3, .1, .9)                 // line 3: moves into the warning card
      const lerpP = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), s: lerp(a.s, b.s, p) })
      let k = { x: GB.x, y: GB.y, s: 1 }
      k = lerpP(k, { x: 300, y: 262, s: .5 }, park)
      k = lerpP(k, { x: 960, y: 662, s: 1 }, land)
      k = lerpP(k, this.K3 ? { x: this.K3.x, y: this.K3.y, s: this.K3.s } : k, to3)
      const kpop = (pk <= 0 ? .85 : lerp(.85, 1, E.back(clamp(pk)))) * (land ? lerp(.85, 1, E.back(landIn)) : 1)
      this.kb.el.style.transform = `translate(${k.x - GB.x}px,${k.y - GB.y}px) scale(${kpop * k.s})`
      op(this.kb.el, clamp(pk * 2.5) * (land ? clamp(landIn * 2.5) : 1 - parkOut))
      this.kb.el.style.boxShadow = `0 0 ${42 + 16 * Math.sin(lt * 1.6)}px ${Y}3a`
      // line 0: the formula is lit part by part as it is read («إس يساوي إيه ضرب، واحد ناقص كيو أُس إنْ، على، واحد ناقص كيو»)
      ;[[.44, .5], [.5, .57], [.57, .73], [.76, .9]].forEach(([a, b], j) => {
        const q = env(lt, T(S, 0, a), T(S, 0, b) + .25, .25, .35)
        this.kRead[j].style.color = q > 0 ? mixColor(C.ink, Y, q) : ''
      })

      // ======== line 1: shift and subtract ========
      const out2 = 1 - S.p(lt, 2, 0, .5)
      const g1 = clamp((L(1) - 1) / 8, .5, 1)          // compresses the minimum gaps when the voice is fast
      const t1 = T(S, 1, .02)
      const t2 = Math.max(T(S, 1, .12), t1 + .9 * g1)      // «واضربه بالأساس كيو»: the qS row
      const tS = Math.max(T(S, 1, .31), t2 + .6 * g1)      // «فيزحف كلّ حدٍّ خطوة»
      const tM = Math.max(T(S, 1, .49), tS + 1.0 * g1)     // «اطرح السطرين»: minus sign + rule
      const tC = tM + .35 * g1                             // matching terms connect…
      const tV = Math.max(T(S, 1, .55), tC + .8 * g1)      // …and vanish in pairs
      const tA = Math.max(T(S, 1, .68), tV + 1.3 * g1)     // «فلا يبقى إلّا إيه»: survivor a
      const tN = Math.max(T(S, 1, .8), tA + 1.0 * g1)      // «ناقص إيه ضرب كيو أُس إنْ»: survivor aq^n
      const tR = Math.min(Math.max(T(S, 1, .88), tN + .9 * g1), S.end(1) - 1.0)
      const tR2 = Math.min(Math.max(T(S, 1, .94), tR + .6), S.end(1) - .4)
      op(this.l1, prog(lt, t1, .6) * out2)
      const p2 = prog(lt, t2, .5)
      const shift = prog(lt, tS, .8) * (this.Tw + this.Pw)
      op(this.l2, p2 * out2)
      const vanish = j => prog(lt, tV + j * .22 * g1, .55)     // pair j = 0..3  (aq, aq^2, ⋯, aq^{n-1})
      this.r2.forEach((e, k) => {
        let v = 0, dy = 0
        if (k % 2 === 0 && k <= 6) { v = vanish(k / 2); dy = -v * 55 }
        else if (k % 2 === 1) v = vanish(Math.min(3, (k - 1) / 2))
        e.style.transform = `translate(${shift}px,${(1 - p2) * 22 + dy}px) scale(${1 - .25 * v})`
        op(e, p2 * (k <= 7 ? 1 - v : 1) * out2)
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
      const pm = prog(lt, tM, .5)
      op(this.minus, pm * out2)
      this.rule.style.transform = `scaleX(${pm})`; op(this.rule, (pm > 0 ? .85 : 0) * out2)
      // the two survivors glow yellow and get their tags
      const sa = prog(lt, tA, .5), sn = prog(lt, tN, .5)
      const glow = (e, p) => { e.style.color = p > 0 ? mixColor(C.ink, Y, p) : ''; e.style.textShadow = p > 0 ? `0 0 ${22 * p}px ${Y}88` : '' }
      glow(this.r1[0], sa); glow(this.r2[8], sn)
      show(this.tagA, sa, out2, 12); show(this.tagN, sn, out2, 12)
      show(this.res1, prog(lt, tR, .6), out2, 20)
      // S(1-q) = a(1-q^n): appears under the subtraction, then (line 2) rises to the top of the centred column
      const pR2 = prog(lt, tR2, .6)
      const up = S.p(lt, 2, .1, .9)
      const out3 = 1 - S.p(lt, 3, 0, .5)
      const h = this.res2Home || { x: 960, y: 350 }
      this.res2.style.transform = `translate(${lerp(960 - h.x, 0, up)}px,${lerp(860 - h.y, 0, up) + (1 - pR2) * 20}px)`
      op(this.res2, pR2 * out3)
      op(this.res2b, Math.min(pR2, 1 - up) * out2)
      this.res2b.style.transform = `translate(${960 - h.x}px,${860 - h.y}px)`

      // ======== line 2 «ثمّ نقسم على 1−q، وهذا مسموح لأنّ q لا يساوي واحداً» ========
      const pRing = P(lt, S, 2, .14, .6)
      draw(this.ring, pRing); this.ring.style.opacity = out3
      show(this.down, P(lt, S, 2, .18, .5), out3, -16)
      show(this.note, P(lt, S, 2, .46, .6), out3, 16)                 // «وهذا مسموح لأنّ …»
      // ======== line 3 (last line): n = number of terms, then the special case a = 1 ========
      const pc = S.p(lt, 3, .35, .6)
      op(this.acard, pc); this.acard.style.transform = `scale(${lerp(.97, 1, pc)})`
      show(this.terms, S.p(lt, 3, .6, .6), 1, 20)
      const tCn = Math.max(T(S, 3, .2), S.at(3) + 1.4)
      this.cnt.forEach((c, j) => { const p = prog(lt, tCn + j * .3, .45); pop(c, p); op(c, clamp(p * 2.5)) })
      const tAr = Math.max(T(S, 3, .3), tCn + 1.3)
      const pa = prog(lt, tAr, .8)
      draw(this.nArrow, pa)
      op(this.nHead, pa >= .98 ? 1 : 0)
      const pkn = prog(lt, Math.max(T(S, 3, .1), S.at(3) + .9), .5)
      this.knEl.style.color = pkn > 0 ? mixColor(C.ink, Y, pkn) : ''
      this.knEl.style.textShadow = pkn > 0 ? `0 0 ${18 * pkn}px ${Y}` : ''
      const tNote = Math.max(T(S, 3, .4), tAr + .6)
      const p3h = prog(lt, tNote, .5)
      this.t3eEl.style.color = p3h > 0 ? mixColor(C.ink, R, p3h) : ''
      this.t3eEl.style.textShadow = p3h > 0 ? `0 0 ${16 * p3h}px ${R}` : ''
      show(this.note3, prog(lt, tNote, .6), 1, 16)
      const pSp = P(lt, S, 3, .72, .7)
      this.kSp.set(pSp)
      const kspPop = pSp <= 0 ? .85 : lerp(.85, 1, E.back(clamp(pSp)))
      this.kSp.el.style.transform = `scale(${kspPop})`
      op(this.kSp.el, clamp(pSp * 2.5))
      this.kSp.el.style.boxShadow = `0 0 ${42 + 16 * Math.sin(lt * 1.6 + 1)}px ${Y}3a`
      show(this.a1, P(lt, S, 3, .6, .6), 1, 16)
    },
  })
})()

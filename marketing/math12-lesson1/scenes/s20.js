// s20 · ③ مقارنة النسبة — ratio = scaling factor. Card ③ grows out of the tracker while a live demo shows
// u_{n+1} as u_n scaled by the ratio (green above 1, pink below). Then the book's example w_n = (2/3)^n:
// five bars, each born at the height of the previous one (dashed ghost) and shrinking to two thirds of it;
// the ratio computed, compared with 1, the conclusion (3 lines of the final script.json); circle ③ of the tracker
// then turns green like ① and ②.
;(() => {
  const Y = C.yel, G = C.grn, R = C.red, B = C.blu, P = C.pur
  const INK = '#eef2ff'
  const tc = (c, s) => `\\textcolor{${c}}{${s}}`
  const K = s => `<bdi class="m">${katex.renderToString(s, KOPT)}</bdi>`

  // ---- the ① ② ③ tracker (same look in s18, s19, s20). circle k centre: (354 - 76(k-1), 220)
  const TRK = k => ({ x: 354 - (k - 1) * 76, y: 220 })
  function tracker(root, active) {
    const box = el('div', '', null, root)
    place(box, 380, 144, { anchor: 'tr', w: 260, h: 110 })
    const lab = el('div', 'ar', 'تكريساً للفهم', box)
    lab.style.cssText += `;position:absolute;right:0;top:0;font-size:24px;font-weight:700;color:${C.mut};white-space:nowrap`
    const rail = el('div', '', null, box)
    rail.style.cssText = `position:absolute;right:26px;top:74px;width:152px;height:4px;border-radius:2px;background:${C.line};transform-origin:100% 50%`
    const circ = [1, 2, 3].map(k => {
      const c = el('div', '', String(k), box)
      const st = k < active ? `border:3px solid ${G};color:${G};background:#14241f`
        : k === active ? `background:${Y};color:#0b1020;box-shadow:0 0 26px ${Y}88`
          : `border:2.5px solid ${C.dim};color:${C.mut};background:${C.bg}`
      c.style.cssText = `position:absolute;right:${(k - 1) * 76}px;top:50px;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;${st}`
      return c
    })
    return {
      el: box, circ,
      set(p, lt, stagger = 0) {
        op(lab, clamp(p * 1.5)); op(rail, p > 0 ? 1 : 0); rail.style.transform = `scaleX(${E.out(clamp(p))})`
        circ.forEach((c, i) => {
          const q = clamp(p * 1.6 - i * stagger)
          pop(c, q)
          if (i + 1 === active && q >= 1) c.style.boxShadow = `0 0 ${20 + 10 * Math.sin(lt * 2.4)}px ${Y}99`
        })
      },
    }
  }
  const badge = (n, bg = Y) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:1.05em;height:1.05em;border-radius:50%;background:${bg};color:#0b1020;font-size:.78em;font-weight:900;vertical-align:.08em;margin-left:.28em">${n}</span>`

  // bars of w_n = (2/3)^n
  const BX = k => 232 + k * 148, BW = 92, BASE = 806, H0 = 380
  const hk = k => H0 * Math.pow(2 / 3, k)
  // demo bars (line 0)
  const DA = 330, DB = 640, DH = 250, DBASE = 806

  scene('s20', {
    build(root, S) {
      this.root = root
      this.head = heading(root, `${badge(3)}مقارنة النسبة $\\frac{u_{n+1}}{u_n}$ والعدد $1$`)
      this.trk = tracker(root, 3)

      // ---------------- line 0: card ③ + the scaling-factor demo
      const c = card(root, 'def', 1800, 300, 820, { anchor: 'tr', tag: 'الطريقة 3' })
      this.card = c.el; this.card.style.transformOrigin = '50% 50%'
      const ct = rich(`عندما تكون المتتالية $(u_n)_{n\\ge0}$ ذات حدود <b>موجبة تماماً</b>، يمكن أن نقارن بين $${tc(Y, '\\dfrac{u_{n+1}}{u_n}')}$ والعدد $${tc(Y, '1')}$`, 'h3')
      ct.style.fontSize = '44px'; ct.style.lineHeight = 1.75
      c.body.appendChild(ct); splitWords(ct); this.ct = ct

      const ds = svg(root, 0, 0, W, H)
      this.dSvg = ds
      const defs = sv(ds, 'defs')
      const grad = (idn, c1, c2) => { const g = sv(defs, 'linearGradient', { id: idn, x1: 0, y1: 0, x2: 0, y2: 1 }); sv(g, 'stop', { offset: '0%', 'stop-color': c1 }); sv(g, 'stop', { offset: '100%', 'stop-color': c2 }) }
      grad('s20gb', '#6d8dff', '#3a4f9c'); grad('s20gr', '#ff7ea3', '#8f2f55')
      this.dBase = sv(ds, 'line', { x1: 200, y1: DBASE, x2: 780, y2: DBASE, stroke: C.mut, 'stroke-width': 3 })
      this.dA = sv(ds, 'rect', { x: DA - 60, y: DBASE - DH, width: 120, height: DH, rx: 10, fill: 'url(#s20gb)' })
      this.dB = sv(ds, 'rect', { x: DB - 60, y: DBASE - DH, width: 120, height: DH, rx: 10, fill: G })
      this.dLine = sv(ds, 'line', { x1: DA - 70, y1: DBASE - DH, x2: DB + 90, y2: DBASE - DH, stroke: INK, 'stroke-width': 2.5, 'stroke-dasharray': '10 9', opacity: .6 })
      this.dArr = arrow(ds, DA + 40, DBASE - DH - 40, DB - 40, DBASE - DH - 40, { color: Y, width: 4, bend: -.22 })
      const lab = (html, x, y, a = 'c', cls = 'mm') => { const e = el('div', cls, html, root); place(e, x, y, { anchor: a }); e.style.whiteSpace = 'nowrap'; return e }
      this.dLa = lab(K('u_n'), DA, DBASE + 34, 'c')
      this.dLb = lab(K('u_{n+1}'), DB, DBASE + 34, 'c')
      this.dX = lab(K(tc(Y, '\\times\\dfrac{u_{n+1}}{u_n}')), (DA + DB) / 2, DBASE - DH - 140, 'c')
      this.dX.style.fontSize = '40px'
      this.d1 = lab(K('\\times 1'), DB + 100, DBASE - DH, 'cl', 's')
      this.dG = lab(K(tc(G, '\\dfrac{u_{n+1}}{u_n} > 1 \\;\\Rightarrow\\; u_{n+1} > u_n')), 490, 930, 'c')
      this.dR = lab(K(tc(R, '\\dfrac{u_{n+1}}{u_n} < 1 \\;\\Rightarrow\\; u_{n+1} < u_n')), 490, 930, 'c')
      this.dG.style.fontSize = this.dR.style.fontSize = '40px'

      // ---------------- line 1: example + bars
      const ex = card(root, 'ex', 1800, 300, 820, { anchor: 'tr', tag: 'مثال' })
      this.ex = ex.el
      this.e1 = rich(`$(w_n)_{n\\ge0}$ المعرّفة على $\\mathbb{N}$ وفق $w_n = \\left(\\dfrac23\\right)^n$`, 'p')
      ex.body.appendChild(this.e1)
      this.e2 = rich(`جميع حدودها $w_n$ <span class="grn b">موجبة تماماً</span>`, 'p')
      this.e2.style.marginTop = '8px'
      ex.body.appendChild(this.e2)
      this.ratio = tex(`\\dfrac{w_{n+1}}{w_n} = \\dfrac{\\left(\\frac23\\right)^{n+1}}{\\left(\\frac23\\right)^n} = ${tc(Y, '\\dfrac23')}`, 'mx')
      this.ratio.style.fontSize = '58px'
      root.appendChild(this.ratio); place(this.ratio, 1390, 730, { anchor: 'c' })

      const bs = svg(root, 0, 0, W, H)
      this.bBase = sv(bs, 'line', { x1: 160, y1: BASE, x2: 910, y2: BASE, stroke: C.mut, 'stroke-width': 3 })
      this.ghost = [], this.bars = [], this.vals = [], this.idx = [], this.arrs = [], this.xl = []
      const vtex = ['1', '\\dfrac23', '\\dfrac49', '\\dfrac{8}{27}', '\\dfrac{16}{81}']
      for (let k = 0; k < 5; k++) {
        this.ghost.push(k ? sv(bs, 'rect', { x: BX(k) - BW / 2, y: BASE - hk(k - 1), width: BW, height: hk(k - 1), rx: 10, fill: 'none', stroke: '#ff9fbb', 'stroke-width': 2.5, 'stroke-dasharray': '8 7', opacity: .55 }) : null)
        this.bars.push(sv(bs, 'rect', { x: BX(k) - BW / 2, y: BASE - hk(k), width: BW, height: hk(k), rx: 10, fill: 'url(#s20gr)' }))
        const v = lab(K(vtex[k]), BX(k), BASE - hk(k) - 12, 'bc'); v.style.fontSize = k ? '30px' : '40px'; v.style.lineHeight = 1; this.vals.push(v)
        const ix = lab(K(`w_${k}`), BX(k), BASE + 30, 'c'); ix.style.fontSize = '32px'; ix.style.color = C.mut; this.idx.push(ix)
        if (k < 4) {
          this.arrs.push(arrow(bs, BX(k) + 16, BASE + 60, BX(k + 1) - 16, BASE + 60, { color: R, width: 3.5, bend: .26 }))
          const xl = lab(K(tc(R, '\\times\\dfrac23')), (BX(k) + BX(k + 1)) / 2, BASE + 124, 'c'); xl.style.fontSize = '27px'; xl.style.lineHeight = 1; this.xl.push(xl)
        }
      }

      // ---------------- line 2: compare with 1, conclusion, geometric chip
      this.imp = tex(`\\dfrac{w_{n+1}}{w_n} = \\dfrac23 ${tc(R, '< 1')} \\;\\Longrightarrow\\; ${tc(R, 'w_{n+1} < w_n')}`, 'mx')
      this.imp.style.fontSize = '56px'
      root.appendChild(this.imp); place(this.imp, 1390, 548, { anchor: 'c' })
      this.note = rich('نضرب بـ $w_n > 0$ فلا تنقلب المتراجحة', 's')
      root.appendChild(this.note); place(this.note, 1390, 654, { anchor: 'c' }); this.note.style.whiteSpace = 'nowrap'
      this.concl = keyBox(root, 'x', 1390, 795, { color: R })
      this.concl.el.removeChild(this.concl.f)
      this.concl.el.style.background = 'rgba(255,92,138,.08)'
      const cc = rich(`فالمتتالية $(w_n)_{n\\ge0}$ <b>متناقصة تماماً</b>`, 'h3'); cc.style.color = R; cc.style.whiteSpace = 'nowrap'
      this.concl.el.appendChild(cc)
      this.geo = chip(root, `هندسيّة أساسها <span style="font-size:28px">${K('q = \\dfrac23')}</span>`, 532, 322, { anchor: 'c', color: Y })
      this.geo.style.fontSize = '30px'; this.geo.style.direction = 'rtl'; this.geo.style.whiteSpace = 'nowrap'
    },

    render(lt, S) {
      const d = i => S.end(i) - S.at(i)
      const T = (i, f) => S.at(i) + f * d(i)
      const pr = (t0, dur = .6, e = E.io) => prog(lt, t0, dur, e)

      this.head.set(S.p(lt, 0, 0, .8))
      this.trk.circ[2].style.boxShadow = `0 0 26px ${Y}88`          // (reset: frames render out of order)
      this.trk.set(S.p(lt, 0, .1, .7), lt, .2)

      // ================= line 0: card ③ and the demo
      const out1 = S.p(lt, 1, 0, .55)
      const cg = S.p(lt, 0, .5, .9)
      const tk = TRK(3), cx = 1800 - 410, cy = 300 + this.card.offsetHeight / 2
      this.card.style.transform = `translate(${(tk.x - cx) * (1 - cg)}px, ${(tk.y - cy) * (1 - cg) - out1 * 30}px) scale(${lerp(.08, 1, cg)})`
      op(this.card, Math.min(clamp(cg * 2), 1 - out1))
      typeWords(this.ct, pr(S.at(0) + 1.2, Math.max(1.5, .55 * d(0)), E.lin))
      // demo: u_{n+1} = r · u_n with r breathing around 1
      const dIn = pr(Math.max(T(0, .3), S.at(0) + 2), .7)
      const dOut = out1
      const dv = Math.min(dIn, 1 - dOut)
      const tr = Math.max(0, lt - (Math.max(T(0, .3), S.at(0) + 2) + .8))
      const r = 1 + .36 * Math.sin(tr * 2 * Math.PI / 5.2 + Math.PI / 2) * clamp(tr / .8)
      const hB = DH * r * E.out(dIn)
      const g = clamp((r - 1) / .03 * .5 + .5)
      this.dB.setAttribute('y', DBASE - hB); this.dB.setAttribute('height', Math.max(0, hB))
      this.dB.setAttribute('fill', mixColor(R, G, g))
      this.dA.setAttribute('y', DBASE - DH * E.out(dIn)); this.dA.setAttribute('height', DH * E.out(dIn))
      ;[this.dA, this.dB, this.dBase].forEach(e => (e.style.opacity = dv))
      this.dLine.style.opacity = .6 * dv
      this.dArr.set(pr(Math.max(T(0, .3), S.at(0) + 2) + .5, .6)); this.dArr.path.style.opacity = dv
      ;[this.dLa, this.dLb, this.dX, this.d1].forEach(e => op(e, dv))
      op(this.dG, dv * g); op(this.dR, dv * (1 - g))

      // ================= line 1: the example and the bars
      const out2 = S.p(lt, 2, 0, .4)
      const ei = S.p(lt, 1, .4, .7)
      op(this.ex, Math.min(ei, 1 - out2)); this.ex.style.transform = `translateY(${(1 - ei) * 30 - out2 * 40}px)`
      rise(this.e2, pr(Math.max(T(1, .45), S.at(1) + 1.6), .6), 16)
      const tRa = Math.max(T(1, .66), S.at(1) + 2.6)
      const ra = pr(tRa, 1.1)
      wipe(this.ratio, ra)
      const up2 = S.p(lt, 2, .3, .8)                         // moves up once the example card has gone
      this.ratio.style.transform = `translateY(${-372 * up2}px) scale(${lerp(1, .86, up2)})`
      // bars: each is born at the previous height (ghost) and shrinks to two thirds of it
      const tB0 = Math.max(T(1, .22), S.at(1) + 1.2)
      const step = clamp((tRa + .6 - tB0) / 4.6, .45, 1.2)
      this.bBase.style.opacity = pr(tB0 - .3, .5)
      for (let k = 0; k < 5; k++) {
        const t0 = tB0 + k * step
        const born = pr(t0, .35, E.out), shrink = k ? pr(t0 + .35, .55, E.io) : 1
        const h = k ? lerp(hk(k - 1), hk(k), shrink) : hk(0) * E.out(pr(t0, .6))
        const bar = this.bars[k]
        bar.setAttribute('y', BASE - h); bar.setAttribute('height', Math.max(0, h))
        bar.style.opacity = born
        // the ghost (previous height) shows the "two thirds of the previous one", then clears for the value label
        if (k) this.ghost[k].style.opacity = .55 * born * (1 - pr(t0 + .85, .45))
        const vI = pr(t0 + (k ? 1.05 : .45), .4)
        op(this.vals[k], vI); this.vals[k].style.transform = `translateY(${(1 - vI) * 10}px)`
        op(this.idx[k], born)
        if (k) {
          this.arrs[k - 1].set(pr(t0 + .15, .5))
          op(this.xl[k - 1], pr(t0 + .45, .4))
        }
      }
      // gentle life while the bars hold: a soft glow runs along them, step after step
      const runT = lt - (tB0 + 5 * step + .6)
      this.bars.forEach((bar, k) => {
        const ph = runT > 0 ? Math.max(0, Math.sin((runT * 1.3 - k * .55))) : 0
        const q = Math.pow(ph, 6)
        bar.style.filter = q > .01 ? `brightness(${1 + .22 * q}) drop-shadow(0 0 ${10 * q}px ${R})` : ''
      })
      // ================= line 2: compare with 1, conclusion
      const tI = S.at(2) + .7
      wipe(this.imp, pr(tI, 1.1))
      const nI = pr(Math.max(T(2, .45), tI + 1.4), .6)
      op(this.note, nI); this.note.style.transform = `translateY(${(1 - nI) * 14}px)`
      // keep the box inside the safe area (measured live: the bold Arabic font may load after build)
      const cw = this.concl.el.offsetWidth
      if (cw !== this._cw) { this._cw = cw; place(this.concl.el, Math.min(1390, 1796 - cw / 2), 795, { anchor: 'c' }) }
      const tK = Math.max(T(2, .74), tI + 2.4)
      const kI = pr(tK, .7)
      this.concl.set(kI)
      if (kI >= 1) this.concl.el.style.boxShadow = `0 0 ${40 + 14 * Math.sin(lt * 1.8)}px ${R}40`
      const gI = pr(Math.max(T(2, .86), tI + 3), .6)
      pop(this.geo, gI)

      // all three methods covered: circle ③ of the tracker turns green like ① and ②, once the conclusion is in
      const dn = pr(tK + .9, .6), c3 = this.trk.circ[2]
      c3.style.background = mixColor(Y, '#14241f', dn); c3.style.color = mixColor('#0b1020', G, dn)
      if (dn > 0) c3.style.boxShadow = `0 0 0 3px ${G}${Math.round(dn * 255).toString(16).padStart(2, '0')}`
    },
  })
})()

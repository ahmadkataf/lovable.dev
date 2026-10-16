// s10 · مطّردة أم لا؟ — the word «مطّردة», the (-1)^n counter-example, the 💡 tip (difference / ratio),
// and why the ratio test needs strictly positive terms (-1, -2, -4, -8 has ratio 2 yet goes down).
;(() => {
  const ID = 's10'
  // progress of an animation that starts at fraction `fr` of line i (follows the speech, any line length)
  const pf = (S, lt, i, fr, d = .6, ease = E.io) => prog(lt, S.at(i) + fr * (S.end(i) - S.at(i)), d, ease)
  // entry (pin) and exit (pout) in one setter: fade + small vertical motion
  const vis = (e, pin, pout = 0, dy = 30, extra = '') => {
    op(e, clamp(pin) * (1 - clamp(pout)))
    e.style.transform = `translateY(${(1 - pin) * dy - pout * 24}px)${extra}`
  }
  const svgOp = (e, v) => { e.style.opacity = v; e.style.visibility = v <= .001 ? 'hidden' : 'visible' }
  // marker / underline drawn as the span's own background (no measuring → robust to late font loading)
  const bgMark = (span, color, line = 0) => {
    span.style.cssText += `background-image:linear-gradient(${color},${color});background-repeat:no-repeat;background-position:100% ${line ? '100%' : '50%'};background-size:0% ${line ? line + 'px' : '100%'};border-radius:10px;` + (line ? '' : 'padding:0 10px;margin:0 -4px')
    return p => { span.style.backgroundSize = `${E.out(clamp(p)) * 100}% ${line ? line + 'px' : '100%'}` }
  }
  // tiny staircase icon (vals in 1..5)
  const stairIcon = (vals, col, lw = 4.5, dr = 4.5) => {
    const s = document.createElementNS(NS, 'svg'), w = 104, h = 66, sw = w / vals.length, u = 12
    s.setAttribute('width', w); s.setAttribute('height', h); s.style.display = 'block'; s.style.overflow = 'visible'
    let d = ''
    vals.forEach((v, k) => { const y = h - v * u; d += (k ? ` L${k * sw},${y}` : `M0,${y}`) + ` L${(k + 1) * sw},${y}` })
    sv(s, 'path', { d: d + ` L${w},${h} L0,${h} Z`, fill: col + '26', stroke: 'none' })
    sv(s, 'path', { d, fill: 'none', stroke: col, 'stroke-width': lw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })
    vals.forEach((v, k) => sv(s, 'circle', { cx: (k + .5) * sw, cy: h - v * u, r: dr, fill: col }))
    return s
  }

  scene(ID, {
    build(root, S) {
      this.head = heading(root, 'مطّردة أم لا؟')

      // ---------- line 0: the word «مطّردة» ----------
      const c0 = card(root, 'def', 1800, 300, 1680, { anchor: 'tr', tag: 'مصطلح' })
      this.c0 = c0.el
      c0.body.style.cssText += 'display:flex;align-items:center;gap:56px;direction:rtl'
      this.c0t = rich('نطلق على المتتاليات التي تحقّق أحد الشروط السابقة اسم متتاليات <span class="pur b" id="s10-mtr">مطّردة</span>', 'h3')
      this.c0t.style.flex = '1'
      c0.body.appendChild(this.c0t)
      splitWords(this.c0t)
      const icons = el('div', '', null, c0.body)
      icons.style.cssText = 'display:flex;gap:20px;direction:rtl;flex:none'
      const defs = [
        [[1, 2, 3, 4, 5], C.grn, '<'], [[5, 4, 3, 2, 1], C.red, '>'], [[1, 2, 2, 4, 4], C.grn, '\\le'],
        [[5, 4, 4, 2, 2], C.red, '\\ge'], [[3, 3, 3, 3, 3], C.blu, '='],
      ]
      this.icons = defs.map(([v, col, rel]) => {
        const b = el('div', '', null, icons)
        b.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px'
        b.appendChild(stairIcon(v, col))
        const m = tex(`u_n \\textcolor{${col}}{${rel}} u_{n+1}`, 'ms'); m.style.fontSize = '26px'; b.appendChild(m)
        return b
      })
      this.mark0 = bgMark(c0.body.querySelector('#s10-mtr'), 'rgba(167,139,250,.28)')

      // ---------- line 0: zig-zag of (-1)^n ----------
      const X = n => 290 + n * 108, YP = 625, YM = 855, Y0 = 740
      this.zz = svg(root, 0, 0, W, H)
      const g = this.zz
      this.zAxis = sv(g, 'path', { d: `M250,${Y0} L1330,${Y0}`, stroke: C.mut, 'stroke-width': 3, fill: 'none', opacity: .7 })
      this.zGuide = [YP, YM].map(y => sv(g, 'path', { d: `M250,${y} L1330,${y}`, stroke: C.dim, 'stroke-width': 2, 'stroke-dasharray': '8 10', fill: 'none' }))
      const N = 10
      this.zSeg = []
      for (let n = 0; n < N - 1; n++) {
        const up = n % 2 === 1
        this.zSeg.push(sv(g, 'path', { d: `M${X(n)},${n % 2 ? YM : YP} L${X(n + 1)},${n % 2 ? YP : YM}`, stroke: up ? C.grn : C.red, 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' }))
      }
      this.zTail = tex('\\cdots', 'mm'); this.zTail.style.color = C.mut; root.appendChild(this.zTail); place(this.zTail, X(N - 1) + 62, Y0, { anchor: 'c' })
      this.zDot = []
      for (let n = 0; n < N; n++) {
        const c = sv(g, 'circle', { cx: X(n), cy: n % 2 ? YM : YP, r: 13, fill: C.yel })
        c.style.transformOrigin = `${X(n)}px ${n % 2 ? YM : YP}px`; c.style.transformBox = 'view-box'
        this.zDot.push(c)
      }
      this.zRun = sv(g, 'circle', { cx: 0, cy: 0, r: 9, fill: '#fff' })
      this.zRun.style.filter = 'drop-shadow(0 0 10px #fff)'
      this.zIdx = []
      for (let n = 0; n < N; n++) {
        const t = el('div', 's blu', String(n), root); t.style.fontWeight = 700
        place(t, X(n), 925, { anchor: 'c' }); this.zIdx.push(t)
      }
      this.zLab = [['+1', YP], ['-1', YM]].map(([s, y]) => { const t = tex(s, 'ms'); t.style.color = C.mut; root.appendChild(t); place(t, 238, y, { anchor: 'cr' }); return t })
      this.zLab0 = tex('0', 'ms'); this.zLab0.style.color = C.dim; root.appendChild(this.zLab0); place(this.zLab0, 238, Y0, { anchor: 'cr' })
      this.X = X; this.YP = YP; this.YM = YM

      this.zF = tex('u_n = (-1)^n', 'mx'); root.appendChild(this.zF); place(this.zF, 1790, 625, { anchor: 'cr' })
      const legend = (up, word) => {
        const b = el('div', '', null, root), col = up ? C.grn : C.red
        b.style.cssText = `display:flex;align-items:center;gap:14px;direction:rtl;white-space:nowrap;color:${col}`
        const s = document.createElementNS(NS, 'svg'); s.setAttribute('width', 46); s.setAttribute('height', 40); s.style.overflow = 'visible'
        sv(s, 'path', { d: up ? 'M4,36 L42,4' : 'M4,4 L42,36', stroke: col, 'stroke-width': 6, 'stroke-linecap': 'round' })
        sv(s, 'circle', { cx: 4, cy: up ? 36 : 4, r: 6, fill: C.yel }); sv(s, 'circle', { cx: 42, cy: up ? 4 : 36, r: 6, fill: C.yel })
        b.appendChild(s); el('div', 'h3 b', word, b)
        return b
      }
      this.zUp = legend(1, 'تصعد'); place(this.zUp, 1790, 735, { anchor: 'cr' })
      this.zDn = legend(0, 'تنزل'); place(this.zDn, 1580, 735, { anchor: 'cr' })
      this.stamp = el('div', 'ar b', 'غير مطّردة', root)
      this.stamp.style.cssText += `font-size:56px;font-weight:900;color:${C.red};border:6px solid ${C.red};border-radius:20px;padding:6px 30px 14px;background:rgba(255,92,138,.10);box-shadow:0 0 40px rgba(255,92,138,.35), inset 0 0 20px rgba(255,92,138,.18);white-space:nowrap`
      place(this.stamp, 1595, 862, { anchor: 'c' })

      // ---------- line 1: the 💡 tip ----------
      const c1 = card(root, 'tip', 1800, 296, 1680, { anchor: 'tr' })
      this.c1 = c1.el
      this.c1t = rich(
        '<span class="k0">لدراسة اطّراد متتالية $(u_n)_{n\\ge0}$، نقارن، أيّاً كان العدد الطبيعي $n$، العددين $u_n$ و $u_{n+1}$</span> ' +
        '<span class="k1">وذلك بدراسة <span class="yel b">إشارة الفرق</span> $u_{n+1}-u_n$،</span> ' +
        '<span class="k2">أو بمقارنة <span class="yel b">النسبة</span> $\\dfrac{u_{n+1}}{u_n}$ والعدد $1$</span> ' +
        '<span class="k3">في حال كون حدود المتتالية <span id="s10-pos" class="b">موجبة تماماً</span>.</span>', 'p')
      this.c1t.style.lineHeight = '1.6'
      c1.body.appendChild(this.c1t)
      this.k = [0, 1, 2, 3].map(i => { const e = this.c1t.querySelector('.k' + i); splitWords(e); return e })
      this.posU = bgMark(this.c1t.querySelector('#s10-pos'), C.yel, 6)
      const py = 640
      // two mini panels: difference (right) and ratio (left)
      const panel = (x, title) => {
        const p = el('div', '', null, root)
        place(p, x, py, { w: 810, h: 990 - 20 - py, anchor: 'tr' })
        p.style.cssText += 'border-radius:26px;border:2px solid rgba(255,255,255,.12);background:rgba(20,29,56,.75);box-shadow:0 24px 60px rgba(0,0,0,.3);padding:20px 40px;display:flex;flex-direction:column;justify-content:center;gap:4px'
        const t = rich(title, 'h3'); t.style.fontSize = '38px'; t.style.color = C.yel; p.appendChild(t)
        return p
      }
      const row = (p, latex, up, fs) => {
        const r = el('div', '', null, p)
        r.style.cssText = 'display:flex;align-items:center;justify-content:space-between;direction:rtl;height:112px'
        const f = tex(latex, 'mm'); if (fs) f.style.fontSize = fs + 'px'; r.appendChild(f)
        const ch = el('div', 'chip', null, r)
        ch.style.cssText += `font-size:34px;gap:14px;padding:8px 26px;color:${up ? C.grn : C.red};border-color:${(up ? C.grn : C.red)}88;background:${(up ? C.grn : C.red)}1f`
        ch.appendChild(stairIcon(up ? [1.2, 2.4, 3.6, 4.8] : [4.8, 3.6, 2.4, 1.2], up ? C.grn : C.red, 8, 0)).setAttribute('style', 'display:block;width:58px;height:37px;overflow:visible')
        ch.lastChild.setAttribute('viewBox', '0 0 104 66')
        el('span', '', up ? 'صعود' : 'نزول', ch)
        return r
      }
      this.pD = panel(1800, 'إشارة الفرق')
      this.pDr = [row(this.pD, 'u_{n+1}-u_n > 0', 1), row(this.pD, 'u_{n+1}-u_n < 0', 0)]
      this.pR = panel(930, 'النسبة والعدد 1')
      this.pRr = [row(this.pR, '\\dfrac{u_{n+1}}{u_n} > 1', 1, 42), row(this.pR, '\\dfrac{u_{n+1}}{u_n} < 1', 0, 42)]
      this.pRn = rich('شرط: حدود <span class="yel b">موجبة تماماً</span>', 's')
      this.pRn.style.cssText += `position:absolute;left:36px;top:26px;font-size:27px;color:${C.ink};padding:4px 18px 6px;border-radius:999px;border:2px solid ${C.yel}99;background:rgba(255,210,63,.10);white-space:nowrap`
      this.pR.appendChild(this.pRn)

      // ---------- line 2: ⚠️ illustrative example u_n = -2^n ----------
      const c2 = card(root, 'warn', 960, 300, 1560, { anchor: 'tc', tag: '⚠️ مثال توضيحي <span style="font-weight:600;opacity:.72">(من خارج الكتاب)</span>', h: 672 })
      this.c2 = c2.el
      // staircase plot (left half of the card)
      const bx = n => 300 + n * 125, BW = 125, A0 = 380, U = 46
      this.st = svg(root, 0, 0, W, H)
      this.stAxis = sv(this.st, 'path', { d: `M262,${A0} L860,${A0}`, stroke: C.mut, 'stroke-width': 3, fill: 'none' })
      this.stBar = [1, 2, 4, 8].map((v, n) => {
        const r = sv(this.st, 'rect', { x: bx(n), y: A0, width: BW, height: v * U, fill: 'rgba(255,92,138,.16)', stroke: 'none' })
        const e = sv(this.st, 'path', { d: `M${bx(n)},${A0 + v * U} L${bx(n) + BW},${A0 + v * U}`, stroke: C.red, 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' })
        return { r, e, v }
      })
      this.stRiser = [1, 2, 4].map((v, n) => sv(this.st, 'path', { d: `M${bx(n + 1)},${A0 + v * U} L${bx(n + 1)},${A0 + [2, 4, 8][n] * U}`, stroke: C.red, 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' }))
      this.stVal = [1, 2, 4, 8].map((v, n) => { const t = tex(`-${v}`, 'mm'); t.style.color = C.red; root.appendChild(t); place(t, bx(n) + BW / 2, A0 + v * U + 12, { anchor: 'tc' }); return t })
      this.stIdx = [0, 1, 2, 3].map(n => { const t = el('div', 's blu', String(n), root); t.style.fontWeight = 700; place(t, bx(n) + BW / 2, A0 - 12, { anchor: 'bc' }); return t })
      this.stArrow = arrow(this.st, 322, 545, 636, 800, { color: C.red, width: 7, bend: .08 })
      this.stDown = rich('<span class="red b">تنزل!</span>', 'h3'); root.appendChild(this.stDown); place(this.stDown, 420, 752, { anchor: 'c' }); this.stDown.style.whiteSpace = 'nowrap'
      // right column: formula, terms with ×2 hops, ratio, verdict
      this.wF = tex('u_n = -2^{n}', 'mx'); root.appendChild(this.wF); place(this.wF, 1640, 380, { anchor: 'cr' })
      this.wT = []
      const vals = ['-1', '-2', '-4', '-8']
      const row2 = el('div', '', null, root)
      row2.style.cssText = 'display:flex;align-items:baseline;gap:6px;direction:ltr;white-space:nowrap'
      this.wCom = []
      vals.forEach((v, k) => {
        const t = tex(v, 'mx'); t.style.color = C.red; row2.appendChild(t); this.wT.push(t)
        const cm = tex(',', 'mx'); cm.style.color = C.mut; cm.style.marginRight = '30px'; row2.appendChild(cm); this.wCom.push(cm)
      })
      this.wDots = tex('\\dots', 'mx'); this.wDots.style.color = C.mut; row2.appendChild(this.wDots)
      place(row2, 1650, 548, { anchor: 'cr' })
      this.row2 = row2
      // ×2 hops above the terms (arcs are drawn in layout(), once fonts are loaded)
      this.hopS = svg(root, 0, 0, W, H)
      this.hops = [0, 1, 2].map(() => { const lab = tex('\\times 2', 'ms'); lab.style.color = C.yel; root.appendChild(lab); op(lab, 0); return { lab } })
      this.root = root
      this.wR = tex('\\dfrac{u_{n+1}}{u_n} = \\textcolor{#ffd23f}{2 > 1}', 'mx'); root.appendChild(this.wR); place(this.wR, 1650, 698, { anchor: 'cr' })
      this.wX = rich('<span class="red b">✗ لا نستنتج التزايد</span>', 'h3'); this.wX.style.whiteSpace = 'nowrap'; root.appendChild(this.wX); place(this.wX, 1650, 828, { anchor: 'cr' })
      this.wSep = el('div', '', null, root); place(this.wSep, 960, 893, { anchor: 'c', w: 1420, h: 2 }); this.wSep.style.background = 'rgba(255,159,67,.35)'
      this.wC = rich('مقارنة النسبة بـ $1$ تشترط حدوداً <span class="yel b">موجبة تماماً</span>', 'h3'); this.wC.style.fontSize = '42px'
      root.appendChild(this.wC); place(this.wC, 960, 930, { anchor: 'c' }); this.wC.style.whiteSpace = 'nowrap'
      this.wCk = this.wC.querySelector('.yel')
      this.wQ = rich('لماذا <span class="yel b">موجبة تماماً</span>؟', 'h3'); this.wQ.style.fontSize = '42px'; this.wQ.style.whiteSpace = 'nowrap'
      root.appendChild(this.wQ); place(this.wQ, 960, 930, { anchor: 'c' })
      this.bx = bx; this.A0 = A0; this.U = U; this.BW = BW
    },

    // measured placement: run on the first rendered frame (KaTeX fonts are loaded by then)
    layout() {
      const root = this.root
      const cr = rectIn(this.c1, root), py = cr.y + cr.h + 44
      place(this.pD, 1800, py, { w: 810, h: 970 - py, anchor: 'tr' })
      place(this.pR, 930, py, { w: 810, h: 970 - py, anchor: 'tr' })
      this.hopS.innerHTML = ''
      this.hops.forEach((h, k) => {
        const a = rectIn(this.wT[k], root), b = rectIn(this.wT[k + 1], root)
        const x1 = a.cx + 6, x2 = b.cx - 6, y = a.y - 6
        h.ar = arrow(this.hopS, x1, y, x2, y, { color: C.yel, width: 4, bend: -.32 })
        place(h.lab, (x1 + x2) / 2, y - (x2 - x1) * .32 / 2 - 8, { anchor: 'bc' })
      })
    },

    render(lt, S) {
      if (!this._laid) { this.layout(); this._laid = document.fonts.check('20px KaTeX_Main') }
      const out0 = S.p(lt, 1, 0, .45), out1 = S.p(lt, 2, 0, .45)
      this.head.set(S.p(lt, 0, 0, .7))

      // ===== line 0 =====
      vis(this.c0, S.p(lt, 0, .25, .6), out0)
      typeWords(this.c0t, clamp((lt - S.at(0) - .4) / Math.max(1.2, .36 * (S.end(0) - S.at(0)))))
      this.icons.forEach((b, k) => { const p = pf(S, lt, 0, .1 + k * .05, .5, E.out); op(b, p); b.style.transform = `translateY(${(1 - p) * 16}px) scale(${lerp(.7, 1, E.back(p))})` })
      this.mark0(pf(S, lt, 0, .38, .6))
      // zig-zag
      const z = pf(S, lt, 0, .47, .6), zo = 1 - out0
      svgOp(this.zAxis, .7 * z * zo); this.zGuide.forEach(g => svgOp(g, z * zo))
      this.zLab.forEach(e => op(e, z * zo)); op(this.zLab0, z * zo)
      vis(this.zF, pf(S, lt, 0, .47, .6), out0)
      const zf = clamp((lt - (S.at(0) + .5 * (S.end(0) - S.at(0)))) / Math.max(1.2, .28 * (S.end(0) - S.at(0))))
      const NN = this.zDot.length
      this.zDot.forEach((c, n) => {
        const p = E.back(clamp(zf * NN * 1.05 - n)) // pop when the path reaches it
        const q = clamp(zf * NN * 1.05 - n)
        const breathe = lt > S.at(0) + 2 ? 1 + .08 * Math.sin(lt * 2.4 - n * .7) : 1
        c.style.opacity = clamp(q * 3) * zo; c.style.visibility = q * zo > 0 ? 'visible' : 'hidden'
        c.style.transform = `scale(${(q > 0 ? lerp(.3, 1, p) : 0) * breathe})`
        op(this.zIdx[n], clamp(q * 2) * zo)
      })
      this.zSeg.forEach((s, n) => { draw(s, clamp(zf * NN * 1.05 - n - .5)); s.style.opacity = zo })
      op(this.zTail, clamp(zf * NN * 1.05 - NN + .3) * zo)
      // a bright runner bouncing along the finished zig-zag (continuous life)
      const runOn = zf >= 1 ? clamp((lt - (S.at(0) + .5 * (S.end(0) - S.at(0)) + Math.max(1.2, .28 * (S.end(0) - S.at(0))))) / .4) : 0
      const u = ((lt * .9) % (NN - 1))
      const n0 = Math.floor(u), fr = u - n0
      this.zRun.setAttribute('cx', lerp(this.X(n0), this.X(n0 + 1), fr))
      this.zRun.setAttribute('cy', lerp(n0 % 2 ? this.YM : this.YP, n0 % 2 ? this.YP : this.YM, E.sine(fr)))
      svgOp(this.zRun, .9 * runOn * zo)
      vis(this.zUp, pf(S, lt, 0, .7, .5), out0, 0, ` translateX(${(1 - pf(S, lt, 0, .7, .5)) * 20}px)`)   // «فتصعد»
      vis(this.zDn, pf(S, lt, 0, .75, .5), out0, 0, ` translateX(${(1 - pf(S, lt, 0, .75, .5)) * 20}px)`)   // «وتنزل»
      const st = pf(S, lt, 0, .86, .45, E.out)   // «غير مطّردة»
      op(this.stamp, clamp(st * 3) * zo)
      this.stamp.style.transform = `rotate(-8deg) scale(${lerp(1.9, 1, st) * (1 + .015 * Math.sin(lt * 2))})`

      // ===== line 1 =====
      vis(this.c1, S.p(lt, 1, .3, .6), out1)
      const ks = [[.0, .36], [.36, .5], [.5, .74], [.74, .9]]
      this.k.forEach((e, i) => typeWords(e, clamp((S.f(lt, 1) - ks[i][0]) / (ks[i][1] - ks[i][0])) * (lt > S.at(1) + .45 ? 1 : 0)))
      vis(this.pD, pf(S, lt, 1, .4, .6), out1)
      this.pDr.forEach((r, i) => vis(r, pf(S, lt, 1, .44 + i * .05, .5), 0, 18))
      vis(this.pR, pf(S, lt, 1, .56, .6), out1)
      this.pRr.forEach((r, i) => vis(r, pf(S, lt, 1, .6 + i * .05, .5), 0, 18))
      this.posU(pf(S, lt, 1, .84, .6))
      const pn = pf(S, lt, 1, .88, .5)
      op(this.pRn, pn); this.pRn.style.transform = `translateY(${(1 - pn) * 12}px)`
      // gentle life in the hold: the condition chip breathes
      const gl = pn * (.5 + .5 * Math.sin((lt - S.at(1)) * 2.4))
      this.pRn.style.boxShadow = `0 0 ${8 + 16 * gl}px rgba(255,210,63,${.12 + .22 * gl})`

      // ===== line 2 =====
      const c2 = S.p(lt, 2, .3, .6)
      vis(this.c2, c2, 0)
      svgOp(this.stAxis, Math.min(c2, pf(S, lt, 2, .05, .5)))
      vis(this.wF, pf(S, lt, 2, .06, .5), 0, 20)
      const vT = [.16, .26, .36, .46]
      this.stBar.forEach((b, n) => {
        const p = pf(S, lt, 2, vT[n], .55, E.out)
        b.r.setAttribute('height', b.v * this.U * p); svgOp(b.r, p > 0 ? 1 : 0)
        b.e.setAttribute('d', `M${this.bx(n)},${this.A0 + b.v * this.U * p} L${this.bx(n) + this.BW},${this.A0 + b.v * this.U * p}`); svgOp(b.e, p > 0 ? 1 : 0)
        op(this.stVal[n], clamp(p * 2 - 1)); op(this.stIdx[n], clamp(p * 2))
        vis(this.wT[n], pf(S, lt, 2, vT[n], .45), 0, 16)
      })
      this.stRiser.forEach((r, n) => { svgOp(r, pf(S, lt, 2, vT[n + 1] + .02, .3) > 0 ? 1 : 0); draw(r, pf(S, lt, 2, vT[n + 1] + .02, .4)) })
      op(this.wDots, pf(S, lt, 2, .5, .4)); this.wCom.forEach((c, n) => op(c, n < 3 ? pf(S, lt, 2, vT[n + 1], .4) : pf(S, lt, 2, .5, .4)))
      this.hops.forEach((h, k) => { const p = pf(S, lt, 2, .54 + k * .04, .45); h.ar.set(p); op(h.lab, clamp(p * 2 - .6)) })
      const r = pf(S, lt, 2, .62, .55)
      vis(this.wR, r, 0, 20)
      this.stArrow.set(pf(S, lt, 2, .76, .7))
      const dn = pf(S, lt, 2, .8, .5)
      op(this.stDown, dn); this.stDown.style.transform = `scale(${lerp(.6, 1, E.back(dn))})`
      const x = pf(S, lt, 2, .8, .5)
      op(this.wX, x); this.wX.style.transform = `translateX(${(1 - x) * -30}px)`
      const cc = pf(S, lt, 2, .86, .6)
      const sp = pf(S, lt, 2, .02, .7); op(this.wSep, sp * c2); this.wSep.style.transform = `scaleX(${sp})`
      vis(this.wQ, pf(S, lt, 2, 0, .5) * c2, 0, 16)
      vis(this.wC, cc, 0, 16)
      if (cc > 0) swap(this.wQ, this.wC, cc)
      // gentle life in the hold: the key condition glows softly
      const g2 = cc * (.5 + .5 * Math.sin((lt - S.at(2)) * 2.4))
      this.wCk.style.textShadow = `0 0 ${6 + 14 * g2}px rgba(255,210,63,${.2 + .4 * g2})`
    },
  })
})()

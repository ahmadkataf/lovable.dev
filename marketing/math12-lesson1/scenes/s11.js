// s11 · المتتالية الحسابيّة — definition 2, equal hops on a number line mirrored by a staircase
// (r = 3 up, r = −3 down, r = 0 still), then the exam reflex: show u_{n+1} − u_n is a constant.
;(() => {
  const ID = 's11'
  const pf = (S, lt, i, fr, d = .6, ease = E.io) => prog(lt, S.at(i) + fr * (S.end(i) - S.at(i)), d, ease)
  const vis = (e, pin, pout = 0, dy = 30, extra = '') => {
    op(e, clamp(pin) * (1 - clamp(pout)))
    e.style.transform = `translateY(${(1 - pin) * dy - pout * 24}px)${extra}`
  }
  const svgOp = (e, v) => { e.style.opacity = v; e.style.visibility = v <= .001 ? 'hidden' : 'visible' }
  // highlight drawn as the span's own background (no measuring → robust to late font loading)
  const bgMark = (span, color) => {
    span.style.cssText += `background-image:linear-gradient(${color},${color});background-repeat:no-repeat;background-position:100% 50%;background-size:0% 100%;border-radius:10px;padding:0 10px;margin:0 -4px`
    return p => { span.style.backgroundSize = `${E.out(clamp(p)) * 100}% 100%` }
  }

  // number line 0..14 + staircase + right-hand labels, all inside one full-stage layer
  const NX = v => 190 + v * 58          // number line x
  const SW = 64                         // staircase step width
  const SX = k => 1090 + k * SW         // staircase step k left edge
  const KU = 13                         // staircase px per unit
  function makeRow(root, o) {
    const g = el('div', '', null, root)
    g.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px'
    const s = svg(g, 0, 0, W, H)
    const y = o.y
    const line = sv(s, 'path', { d: `M${NX(-.4)},${y} L${NX(14.6)},${y}`, stroke: C.mut, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' })
    const head = sv(s, 'path', { d: `M${NX(14.6) - 2},${y - 9} L${NX(14.6) + 14},${y} L${NX(14.6) - 2},${y + 9} Z`, fill: C.mut })
    const ticks = [], tl = []
    for (let v = 0; v <= 14; v++) {
      const hot = o.vals.includes(v)
      ticks.push(sv(s, 'path', { d: `M${NX(v)},${y - 8} L${NX(v)},${y + 8}`, stroke: hot ? C.ink : C.dim, 'stroke-width': hot ? 3 : 2 }))
      const t = el('div', '', String(v), g)
      t.style.cssText += `font-size:${hot ? 27 : 22}px;font-weight:${hot ? 800 : 600};color:${hot ? C.ink : C.dim};font-family:A`
      place(t, NX(v), y + 30, { anchor: 'c' }); tl.push(t)
    }
    // hops
    const hops = []
    for (let k = 0; k < o.vals.length - 1; k++) {
      const a = o.vals[k], b = o.vals[k + 1], xa = NX(a), xb = NX(b), h = 46
      if (a === b) continue
      const ar = arrow(s, xa, y - 12, xb, y - 12, { color: o.col, width: 5, bend: -2 * h / (xb - xa) })
      const lab = tex(o.hopLab, 'ms'); lab.style.color = o.col; lab.style.fontWeight = 700; g.appendChild(lab)
      place(lab, (xa + xb) / 2, y - 12 - h - 8, { anchor: 'bc' })
      hops.push({ ar, lab, xa, xb })
    }
    // staircase
    const steps = o.vals.map((v, k) => {
      const top = y - v * KU
      const r = sv(s, 'rect', { x: SX(k), y: top, width: SW, height: v * KU, fill: o.col + '22' })
      const t = sv(s, 'path', { d: `M${SX(k) + 2},${top} L${SX(k + 1) - 2},${top}`, stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round' })
      const d = sv(s, 'circle', { cx: SX(k) + SW / 2, cy: top, r: 6.5, fill: C.yel })
      const n = el('div', 's blu', String(k), g); n.style.fontSize = '24px'; n.style.fontWeight = 800
      place(n, SX(k) + SW / 2, y + 30, { anchor: 'c' })
      return { r, t, d, n }
    })
    const base = sv(s, 'path', { d: `M${SX(0) - 8},${y} L${SX(o.vals.length) + 8},${y}`, stroke: C.dim, 'stroke-width': 2.5 })
    const risers = []
    for (let k = 0; k < o.vals.length - 1; k++) {
      if (o.vals[k] === o.vals[k + 1]) continue
      const a = y - o.vals[k] * KU, b = y - o.vals[k + 1] * KU, upw = b < a
      // every riser carries the same label (+3 / −3): in the empty corner beside it, never over a step
      const lab = tex(o.hopLab, 'ms'); lab.style.color = o.col; lab.style.fontSize = '22px'; lab.style.fontWeight = 700; g.appendChild(lab)
      place(lab, SX(k + 1) + (upw ? -7 : 7), (a + b) / 2 - 4, { anchor: upw ? 'cr' : 'cl' })
      risers.push({ k, lab, p: sv(s, 'path', { d: `M${SX(k + 1)},${a} L${SX(k + 1)},${b}`, stroke: o.col, 'stroke-width': 6, 'stroke-linecap': 'round' }) })
    }
    // moving point
    const pt = sv(s, 'circle', { cx: NX(o.vals[0]), cy: y, r: 13, fill: C.yel })
    pt.style.filter = 'drop-shadow(0 0 12px rgba(255,210,63,.8))'
    // right column: parameters + tag
    const par = tex(o.par, 'mm'); g.appendChild(par); place(par, 1800, y - 52, { anchor: 'cr' })
    const tag = el('div', 'chip', null, g)
    tag.style.cssText += `font-size:28px;padding:6px 22px 8px;color:${o.col};border-color:${o.col}99;background:${o.col}1f;white-space:nowrap;direction:rtl`
    tag.appendChild(tex(o.tagM, 'ms')).style.fontSize = '30px'
    el('span', '', o.tagT, tag)
    place(tag, 1800, y + 18, { anchor: 'cr' })
    return { g, s, y, line, head, ticks, tl, hops, steps, base, risers, pt, par, tag, vals: o.vals }
  }
  // draw a row: pL = number line, hopT(k) = progress of hop k (0..1), pStep(k)
  function setRow(R, pL, hopP, out = 0) {
    const a = 1 - out
    op(R.g, a > 0 ? 1 : 0); R.g.style.opacity = a
    draw(R.line, pL); svgOp(R.head, pL >= .98 ? 1 : 0)
    R.ticks.forEach((t, v) => svgOp(t, clamp(pL * 16 - v)))
    R.tl.forEach((t, v) => op(t, clamp(pL * 16 - v)))
    svgOp(R.base, clamp(hopP[0] * 2))
    const n = R.vals.length
    // landing on step k happens when hop k-1 finishes; step 0 appears with the point
    let x = NX(R.vals[0]), yy = R.y, landed = hopP[0] // hopP[0] = appearance of the point at u0
    svgOp(R.pt, clamp(hopP[0] * 2))
    R.pt.setAttribute('r', 13 * lerp(.3, 1, E.back(clamp(hopP[0]))))
    R.hops.forEach((h, k) => {
      const q = hopP[k + 1]
      h.ar.set(q); op(h.lab, clamp(q * 2 - .8))
      if (q > 0) { const e = E.io(q); x = lerp(h.xa, h.xb, e); yy = R.y - 4 * 58 * e * (1 - e) }
    })
    R.pt.setAttribute('cx', x); R.pt.setAttribute('cy', Math.min(R.y, yy))
    R.steps.forEach((s, k) => {
      const p = k === 0 ? hopP[0] : clamp(hopP[k] * 1.6 - .6)
      svgOp(s.r, p); svgOp(s.t, p); svgOp(s.d, p); op(s.n, p)
      s.d.setAttribute('r', 6.5 * lerp(.2, 1, E.back(clamp(p))))
    })
    R.risers.forEach(r => { const p = clamp(hopP[r.k + 1] * 1.6 - .6); svgOp(r.p, p > 0 ? 1 : 0); draw(r.p, p); op(r.lab, clamp(p * 2 - 1)) })
  }

  scene(ID, {
    build(root, S) {
      this.head = heading(root, '<span class="pur">3.1</span> المتتالية الحسابيّة')

      // ---------- line 0: definition 2 ----------
      const c = card(root, 'def', 1800, 300, 1680, { anchor: 'tr', tag: 'تعريف 2' })
      this.card = c.el
      this.def = rich('نقول إنّ المتتالية $(u_n)_{n\\ge0}$ <span class="pur b">متتالية حسابيّة</span> إذا وُجِدَ عدد حقيقي $r$ وتحقّقت العلاقة التدريجيّة ' +
        `$u_{n+1} = u_n \\textcolor{${C.grn}}{+\\,r}$ أيّاً كان العدد الطبيعي $n$. نسمّي العدد $r$ <span class="pur b" id="s11-asas">أساس</span> المتتالية الحسابيّة.`, 'h3')
      this.def.style.fontSize = '44px'; this.def.style.lineHeight = '1.62'
      c.body.appendChild(this.def)
      splitWords(this.def)
      this.asas = bgMark(this.def.querySelector('#s11-asas'), 'rgba(167,139,250,.30)')
      this.kb = keyBox(root, `u_{n+1} = u_n \\textcolor{${C.grn}}{+\\,\\htmlId{s11-r}{r}}`, 960, 760, { label: 'علاقة تدريجيّة', cls: 'mxl' })
      this.kbR = this.kb.el.querySelector('#s11-r')
      this.kbNote = rich('$r$ : <span class="pur b">الأساس</span>', 'h3')
      this.kbNote.style.whiteSpace = 'nowrap'
      root.appendChild(this.kbNote)
      this.root = root

      // ---------- lines 1–2: three rows ----------
      this.R1 = makeRow(root, { y: 420, vals: [2, 5, 8, 11], col: C.grn, hopLab: '+3', par: '\\htmlId{s11-p1a}{u_0 = 2}\\htmlId{s11-p1b}{,\\ r = 3}', tagM: 'r = 3 > 0', tagT: 'متزايدة تماماً' })
      this.R2 = makeRow(root, { y: 632, vals: [11, 8, 5, 2], col: C.red, hopLab: '-3', par: 'u_0 = 11,\\ r = -3', tagM: 'r = -3 < 0', tagT: 'متناقصة تماماً' })
      this.R3 = makeRow(root, { y: 835, vals: [5, 5, 5, 5], col: C.blu, hopLab: '+0', par: 'u_0 = 5,\\ r = 0', tagM: 'r = 0', tagT: 'ثابتة' })
      this.R3.hops.forEach(h => { op(h.lab, 0); h.ar.set(0) })
      // r = 0: a loop over the point instead of hops
      {
        const s = this.R3.s, x = NX(5), y = this.R3.y - 14
        this.loop = sv(s, 'path', { d: `M${x - 12},${y} C${x - 70},${y - 92} ${x + 70},${y - 92} ${x + 12},${y}`, fill: 'none', stroke: C.blu, 'stroke-width': 5, 'stroke-linecap': 'round' })
        this.loopLab = tex('+0', 'ms'); this.loopLab.style.color = C.blu; this.loopLab.style.fontWeight = 700
        this.R3.g.appendChild(this.loopLab); place(this.loopLab, x, y - 78, { anchor: 'bc' })
        this.still = rich('<span class="blu b">لا تتحرّك</span>', 's'); this.still.style.whiteSpace = 'nowrap'
        this.R3.g.appendChild(this.still); place(this.still, NX(8.6), y - 30, { anchor: 'c' })
      }
      this.p1a = this.R1.par.querySelector('#s11-p1a'); this.p1b = this.R1.par.querySelector('#s11-p1b')
      // the book sentence (line 1)
      this.sent = el('div', '', null, root)
      place(this.sent, 960, 690, { anchor: 'tc' })
      this.sent.style.cssText += 'padding:24px 56px 28px;border-radius:22px;border-right:6px solid ' + C.pur + ';background:rgba(167,139,250,.08);white-space:nowrap'
      const st = rich('إذن في متتالية حسابيّة ننتقل من حدٍّ إلى الحدّ الذي يليه<br><span class="grn b">بإضافة العدد الحقيقي نفسه</span>.', 'h3')
      st.style.fontSize = '44px'; st.style.textAlign = 'center'; this.sent.appendChild(st)
      // mini reminder of the recurrence (top-left) during lines 1–2
      this.mini = tex(`u_{n+1} = u_n \\textcolor{${C.grn}}{+\\,r}`, 'mm')
      root.appendChild(this.mini); place(this.mini, 140, 190, { anchor: 'cl' })
      this.mini.style.cssText += `padding:10px 26px;border-radius:16px;border:2px solid ${C.yel}88;background:rgba(255,210,63,.06)`


      // ---------- line 3: exam card ----------
      const ec = card(root, 'exam', 960, 318, 1320, { anchor: 'tc', h: 620 })
      this.ec = ec.el
      this.eT = rich('كيف تُثبت أنّها <span class="pur b">حسابيّة</span>؟', 'h2'); this.eT.style.fontSize = '54px'; this.eT.style.whiteSpace = 'nowrap'
      root.appendChild(this.eT); place(this.eT, 1560, 410, { anchor: 'cr' })
      this.eF = keyBox(root, `u_{n+1} - u_n = \\htmlId{s11-er}{r}`, 960, 560, { color: C.grn })
      this.eF.el.style.background = 'rgba(110,224,90,.07)'
      this.eEx = rich('مثلاً: $5-2 = 8-5 = 11-8 = \\textcolor{#6ee05a}{3}$', 's'); this.eEx.style.whiteSpace = 'nowrap'
      root.appendChild(this.eEx); place(this.eEx, 960, 690, { anchor: 'c' })
      this.eTx = rich('عددٌ <span id="s11-thb" class="yel b" style="display:inline-block;margin:0 18px">ثابت</span> لا يتعلّق بـ <span id="s11-n">$n$</span>', 'h2'); this.eTx.style.fontSize = '58px'; this.eTx.style.whiteSpace = 'nowrap'
      root.appendChild(this.eTx); place(this.eTx, 960, 820, { anchor: 'c' })
      this.eBoxEl = el('div', 'hlbox', null, root); op(this.eBoxEl, 0)
      this.eN = this.eTx.querySelector('#s11-n')
      this.eS = svg(root, 0, 0, W, H)
    },

    // everything that depends on measured sizes: run on the first rendered frame (KaTeX fonts are loaded by then)
    layout() {
      const root = this.root
      const cr = rectIn(this.card, root)
      place(this.kb.el, 960, cr.y + cr.h + 175, { anchor: 'c' })
      const kr = rectIn(this.kb.el, root)
      place(this.kbNote, kr.x - 50, kr.cy, { anchor: 'cr' })
      this.kbC = { x: kr.cx, y: kr.cy }
      this.miniC = rectIn(this.mini, root)
      const b = rectIn(this.eTx.querySelector('#s11-thb'), root)
      place(this.eBoxEl, b.x - 12, b.y - 6, { w: b.w + 24, h: b.h + 12 })
      const fr = rectIn(this.eF.el, root), tr = rectIn(this.eTx, root)
      this.eS.innerHTML = ''
      this.eArr = arrow(this.eS, fr.x + fr.w + 14, fr.cy + 20, tr.x + tr.w + 26, tr.cy - 10, { color: C.grn, width: 4, bend: -.28 })
    },

    render(lt, S) {
      if (!this._laid) { this.layout(); this._laid = document.fonts.check('20px KaTeX_Main') }
      this.head.set(S.p(lt, 0, 0, .7))
      const out0 = S.p(lt, 1, 0, .5), out2 = S.p(lt, 3, 0, .5)

      // ===== line 0 =====
      vis(this.card, S.p(lt, 0, .25, .6), out0)
      typeWords(this.def, clamp((lt - S.at(0) - .45) / Math.max(1.5, .72 * (S.end(0) - S.at(0)))))
      this.asas(pf(S, lt, 0, .84, .6))
      const kb = pf(S, lt, 0, .5, .7)
      // the key box shrinks into the top-left reminder when line 1 starts
      if (lt < S.at(1)) {
        this.kb.set(kb); op(this.kbNote, pf(S, lt, 0, .86, .5))
        const g = lt > S.at(0) + 3 ? .5 + .5 * Math.sin(lt * 2.2) : 0
        this.kbR.style.textShadow = `0 0 ${12 + 14 * g}px rgba(110,224,90,${.5 * pf(S, lt, 0, .84, .6)})`
        op(this.mini, 0)
      } else {
        const m = S.p(lt, 1, 0, .8)
        op(this.kb.el, 1 - m); this.kb.el.style.transform = `translate(${(this.miniC.cx - this.kbC.x) * m}px, ${(this.miniC.cy - this.kbC.y) * m}px) scale(${lerp(1, .45, m)})`
        op(this.kbNote, 1 - S.p(lt, 1, 0, .3))
        op(this.mini, clamp(m * 2 - 1) * (1 - out2))
      }

      // ===== line 1: row 1 hops (moves up when line 2 starts) =====
      const up = S.p(lt, 2, 0, .8)
      this.R1.g.style.translate = `0 ${lerp(100, 0, up)}px`
      const L1 = pf(S, lt, 1, .02, .9)
      const h0 = pf(S, lt, 1, .3, .5, E.out), hk = [.38, .47, .56].map(f => pf(S, lt, 1, f, Math.min(.7, .09 * (S.end(1) - S.at(1))), E.lin))  // hops never overlap, whatever the line length
      setRow(this.R1, L1, [h0, ...hk], out2)
      const pulse = lt > S.at(1) + .7 * (S.end(1) - S.at(1)) && lt < S.at(3) ? .5 + .5 * Math.sin((lt - S.at(1)) * 5) : 0
      this.R1.hops.forEach(h => { h.lab.style.textShadow = `0 0 ${18 * pulse}px rgba(110,224,90,.9)`; h.lab.style.transform = `scale(${1 + .12 * pulse * pf(S, lt, 1, .7, .4)})` })
      this.R1.risers.forEach(r => { r.lab.style.textShadow = `0 0 ${14 * pulse}px rgba(110,224,90,.9)` })
      op(this.R1.par, L1 > 0 ? 1 : 0)
      op(this.p1a, pf(S, lt, 1, .3, .5)); op(this.p1b, pf(S, lt, 1, .7, .5))
      vis(this.sent, pf(S, lt, 1, .74, .6), up, 24)
      vis(this.R1.tag, pf(S, lt, 2, .04, .6), 0, 0, ` translateX(${(1 - pf(S, lt, 2, .04, .6)) * 30}px)`)

      // ===== line 2: r = −3 and r = 0 =====
      const len2 = S.end(2) - S.at(2)
      const L2 = pf(S, lt, 2, .04, Math.min(.9, .1 * len2))   // the line is drawn before the point lands on it
      const g0 = pf(S, lt, 2, .14, .5, E.out), gk = [.2, .29, .38].map(f => pf(S, lt, 2, f, Math.min(.65, .09 * (S.end(2) - S.at(2))), E.lin))
      setRow(this.R2, L2, [g0, ...gk], out2)
      op(this.R2.par, pf(S, lt, 2, .14, .5))
      vis(this.R2.tag, pf(S, lt, 2, .46, .6), 0, 0, ` translateX(${(1 - pf(S, lt, 2, .46, .6)) * 30}px)`)
      const L3 = pf(S, lt, 2, .58, Math.min(.9, .08 * len2))
      const z0 = pf(S, lt, 2, .66, .5, E.out)
      setRow(this.R3, L3, [z0, z0, z0, z0], out2)
      this.R3.hops.forEach(h => { h.ar.set(0); op(h.lab, 0) })
      this.R3.pt.setAttribute('cx', NX(5)); this.R3.pt.setAttribute('cy', this.R3.y)
      const lp = pf(S, lt, 2, .72, .7)
      draw(this.loop, lp)
      op(this.loopLab, clamp(lp * 2 - 1))
      op(this.still, pf(S, lt, 2, .76, .5))
      const br = lt > S.at(2) + .7 * (S.end(2) - S.at(2)) ? 1 + .12 * Math.sin(lt * 4) : 1
      this.R3.pt.setAttribute('r', 13 * lerp(.3, 1, E.back(clamp(z0))) * br)
      op(this.R3.par, pf(S, lt, 2, .66, .5))
      vis(this.R3.tag, pf(S, lt, 2, .84, .6), 0, 0, ` translateX(${(1 - pf(S, lt, 2, .84, .6)) * 30}px)`)

      // ===== line 3: exam card =====
      vis(this.ec, S.p(lt, 3, .3, .6), 0)
      vis(this.eT, pf(S, lt, 3, .03, .6), 0, 20)
      this.eF.set(pf(S, lt, 3, .22, .7))
      vis(this.eEx, pf(S, lt, 3, .4, .6), 0, 14)
      this.eArr.set(pf(S, lt, 3, .52, .6))
      vis(this.eTx, pf(S, lt, 3, .56, .6), 0, 20)
      const eb = pf(S, lt, 3, .66, .6); op(this.eBoxEl, clamp(eb * 1.5)); this.eBoxEl.style.transform = `scale(${lerp(1.15, 1, E.out(eb))})`
      const life = .5 + .5 * Math.sin((lt - S.at(3)) * 2.6)
      this.eBoxEl.style.boxShadow = `0 0 ${18 + 26 * life * eb}px rgba(255,210,63,${.25 + .3 * life * eb})`
      this.eF.el.style.boxShadow = `0 0 ${36 + 34 * life * eb}px rgba(110,224,90,${.18 + .14 * life * eb})`
      const nn = pf(S, lt, 3, .84, .5)
      this.eN.style.color = mixColor(C.ink, C.blu, nn)
      this.eN.style.textShadow = `0 0 ${16 * nn}px rgba(56,189,248,.8)`
    },
  })
})()

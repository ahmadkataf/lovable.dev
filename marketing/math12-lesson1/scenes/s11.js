// s11 · المتتالية الحسابيّة — line 0: definition 2 (u_{n+1} = u_n + r, r = the common difference);
// line 1: the book sentence, then equal hops 2 → 5 → 8 → 11 on a number line mirrored by a staircase.
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

  // number line 0..14 (left) + staircase (right), one full-stage layer
  const VALS = [2, 5, 8, 11]
  const Y = 730                          // baseline of both
  const NX = v => 175 + v * 62           // number line x
  const AH = 62                          // hop arc height
  const SW = 104                         // staircase step width
  const SX = k => 1250 + k * SW          // staircase step k left edge
  const KU = 25                          // staircase px per unit

  scene(ID, {
    build(root, S) {
      this.root = root
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
      // mini reminder of the recurrence (top-left) during line 1
      this.mini = tex(`u_{n+1} = u_n \\textcolor{${C.grn}}{+\\,r}`, 'mm')
      root.appendChild(this.mini); place(this.mini, 140, 190, { anchor: 'cl' })
      this.mini.style.cssText += `padding:10px 26px;border-radius:16px;border:2px solid ${C.yel}88;background:rgba(255,210,63,.06)`

      // ---------- line 1 (first): the book sentence, under the definition card ----------
      this.sent = el('div', '', null, root)
      place(this.sent, 960, 700, { anchor: 'tc' })
      this.sent.style.cssText += 'padding:24px 56px 28px;border-radius:22px;border-right:6px solid ' + C.pur + ';background:rgba(167,139,250,.08);white-space:nowrap'
      const st = rich('إذن في متتالية حسابيّة ننتقل من حدٍّ إلى الحدّ الذي يليه<br><span class="grn b" id="s11-same">بإضافة العدد الحقيقي نفسه</span>.', 'h3')
      st.style.fontSize = '44px'; st.style.textAlign = 'center'; this.sent.appendChild(st)
      this.same = bgMark(st.querySelector('#s11-same'), 'rgba(110,224,90,.18)')

      // ---------- line 1 (then): number line + staircase ----------
      const g = el('div', '', null, root)
      g.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px'
      this.g = g
      const s = svg(g, 0, 0, W, H)
      this.line = sv(s, 'path', { d: `M${NX(-.4)},${Y} L${NX(14.6)},${Y}`, stroke: C.mut, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' })
      this.lhead = sv(s, 'path', { d: `M${NX(14.6) - 2},${Y - 10} L${NX(14.6) + 16},${Y} L${NX(14.6) - 2},${Y + 10} Z`, fill: C.mut })
      this.ticks = []; this.tl = []
      for (let v = 0; v <= 14; v++) {
        const hot = VALS.includes(v)
        this.ticks.push(sv(s, 'path', { d: `M${NX(v)},${Y - 9} L${NX(v)},${Y + 9}`, stroke: hot ? C.ink : C.dim, 'stroke-width': hot ? 3.5 : 2 }))
        const t = el('div', '', String(v), g)
        t.style.cssText += `font-size:${hot ? 32 : 24}px;font-weight:${hot ? 800 : 600};color:${hot ? C.ink : C.dim};font-family:A`
        place(t, NX(v), Y + 36, { anchor: 'c' }); this.tl.push(t)
      }
      // hops (+3 arcs)
      this.hops = []
      for (let k = 0; k < VALS.length - 1; k++) {
        const xa = NX(VALS[k]), xb = NX(VALS[k + 1])
        // faint dashed preview of the hop («قفزاتٍ متساويةً»), drawn over by the real arrow later
        const ghost = sv(s, 'path', { d: `M${xa},${Y - 12} Q${(xa + xb) / 2},${Y - 12 - 2 * AH} ${xb},${Y - 12}`, stroke: C.grn, 'stroke-width': 4, 'stroke-dasharray': '4 12', 'stroke-linecap': 'round', fill: 'none' })
        const ar = arrow(s, xa, Y - 12, xb, Y - 12, { color: C.grn, width: 5.5, bend: -2 * AH / (xb - xa) })
        const lab = tex('+3', 'mm'); lab.style.color = C.grn; lab.style.fontWeight = 700; g.appendChild(lab)
        place(lab, (xa + xb) / 2, Y - 12 - AH - 10, { anchor: 'bc' })
        this.hops.push({ ar, lab, xa, xb, ghost })
      }
      // staircase: steps at heights 2, 5, 8, 11; identical risers (+3)
      this.base = sv(s, 'path', { d: `M${SX(0) - 10},${Y} L${SX(VALS.length) + 10},${Y}`, stroke: C.mut, 'stroke-width': 3, 'stroke-linecap': 'round' })
      this.steps = VALS.map((v, k) => {
        const top = Y - v * KU
        const r = sv(s, 'rect', { x: SX(k), y: top, width: SW, height: v * KU, fill: C.grn + '24' })
        const t = sv(s, 'path', { d: `M${SX(k) + 2},${top} L${SX(k + 1) - 2},${top}`, stroke: C.ink, 'stroke-width': 5, 'stroke-linecap': 'round' })
        const d = sv(s, 'circle', { cx: SX(k) + SW / 2, cy: top, r: 7, fill: C.yel })
        const val = el('div', '', String(v), g)
        val.style.cssText += `font-size:28px;font-weight:800;color:${C.ink};font-family:A;opacity:.9`
        place(val, SX(k) + SW / 2, top + 28, { anchor: 'c' })
        const n = el('div', 's blu', null, g); n.appendChild(tex(`u_${k}`, 'ms')).style.fontSize = '30px'
        place(n, SX(k) + SW / 2, Y + 38, { anchor: 'c' })
        return { r, t, d, val, n }
      })
      this.risers = []
      for (let k = 0; k < VALS.length - 1; k++) {
        const a = Y - VALS[k] * KU, b = Y - VALS[k + 1] * KU
        const p = sv(s, 'path', { d: `M${SX(k + 1)},${a} L${SX(k + 1)},${b}`, stroke: C.grn, 'stroke-width': 6, 'stroke-linecap': 'round' })
        // label in the empty corner on the right of the riser, above the next step's top line
        const lab = tex('+3', 'ms'); lab.style.color = C.grn; lab.style.fontSize = '30px'; lab.style.fontWeight = 700; g.appendChild(lab)
        place(lab, SX(k + 1) - 10, (a + b) / 2, { anchor: 'cr' })
        this.risers.push({ p, lab })
      }
      // the moving point
      this.pt = sv(s, 'circle', { cx: NX(VALS[0]), cy: Y, r: 15, fill: C.yel })
      this.pt.style.filter = 'drop-shadow(0 0 12px rgba(255,210,63,.8))'
      // parameters: u_0 = 2, r = 3
      this.par = tex(`\\htmlId{s11-pa}{u_0 = \\textcolor{${C.yel}}{2}}\\htmlId{s11-pb}{,\\ \\ r = \\textcolor{${C.grn}}{3}}`, 'mx')
      g.appendChild(this.par); place(this.par, NX(6.5), 455, { anchor: 'c' })
      this.par.style.cssText += `padding:12px 40px 16px;border-radius:22px;border:2px solid rgba(255,255,255,.14);background:rgba(20,29,56,.7)`
      this.pa = this.par.querySelector('#s11-pa'); this.pb = this.par.querySelector('#s11-pb')
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
      place(this.sent, 960, cr.y + cr.h + 70, { anchor: 'tc' })
    },

    render(lt, S) {
      if (!this._laid) { this.layout(); this._laid = document.fonts.check('20px KaTeX_Main') }
      this.head.set(S.p(lt, 0, 0, .7))
      const L1 = S.end(1) - S.at(1)

      // ===== line 0: «… يو إنْ زائد واحد يساوي يو إنْ، زائد آر … نسمّيه أساسَ المتتالية» =====
      const outCard = pf(S, lt, 1, .37, .5)          // card + sentence leave at «تخيّلها قفزاتٍ…»
      vis(this.card, S.p(lt, 0, .25, .6), outCard)
      typeWords(this.def, clamp((lt - S.at(0) - .45) / Math.max(1.5, .72 * (S.end(0) - S.at(0)))))
      this.asas(pf(S, lt, 0, .87, .6))
      const kb = pf(S, lt, 0, .26, .7)
      // the key box shrinks into the top-left reminder when line 1 starts
      if (lt < S.at(1)) {
        this.kb.set(kb); op(this.kbNote, pf(S, lt, 0, .88, .5))
        const gl = lt > S.at(0) + 3 ? .5 + .5 * Math.sin(lt * 2.2) : 0
        this.kbR.style.textShadow = `0 0 ${12 + 14 * gl}px rgba(110,224,90,${.5 * pf(S, lt, 0, .87, .6)})`
        op(this.mini, 0)
      } else {
        const m = S.p(lt, 1, 0, .8)
        op(this.kb.el, 1 - m); this.kb.el.style.transform = `translate(${(this.miniC.cx - this.kbC.x) * m}px, ${(this.miniC.cy - this.kbC.y) * m}px) scale(${lerp(1, .45, m)})`
        op(this.kbNote, 1 - S.p(lt, 1, 0, .3))
        op(this.mini, clamp(m * 2 - 1))
      }

      // ===== line 1a: «أي ننتقل من حدٍّ إلى الذي يليه بإضافة العدد الحقيقيّ نفسه» =====
      vis(this.sent, S.p(lt, 1, .55, .6), outCard, 24)
      this.same(pf(S, lt, 1, .2, .7))

      // ===== line 1b: «تخيّلها قفزاتٍ متساويةً على مستقيم الأعداد: اثنان، خمسة، ثمانية، أحد عشر. كلّ قفزةٍ طولها ثلاثة» =====
      const pL = pf(S, lt, 1, .4, Math.min(1.4, .1 * L1))
      draw(this.line, pL); svgOp(this.lhead, pL >= .98 ? 1 : 0)
      this.ticks.forEach((t, v) => svgOp(t, clamp(pL * 16 - v)))
      this.tl.forEach((t, v) => op(t, clamp(pL * 16 - v)))
      const p0 = pf(S, lt, 1, .655, .5, E.out)                                    // «اثنان»
      svgOp(this.base, p0)
      const hopD = Math.min(.6, .036 * L1)
      const hk = [.675, .715, .76].map(f => pf(S, lt, 1, f, hopD, E.lin))          // land on «خمسة»، «ثمانية»، «أحد عشر»
      // moving point
      let x = NX(VALS[0]), yy = Y
      svgOp(this.pt, clamp(p0 * 2))
      this.hops.forEach((h, k) => {
        const q = hk[k]
        h.ar.set(q); op(h.lab, clamp(q * 2 - .8))
        svgOp(h.ghost, .55 * pf(S, lt, 1, .46 + k * .04, .5) * (1 - clamp(q * 2 - 1)))
        if (q > 0) { const e = E.io(q); x = lerp(h.xa, h.xb, e); yy = Y - 4 * (AH + 12) * e * (1 - e) }
      })
      this.pt.setAttribute('cx', x); this.pt.setAttribute('cy', yy)
      const br = lt > S.at(1) + .86 * L1 ? 1 + .1 * Math.sin(lt * 4) : 1
      this.pt.setAttribute('r', 15 * lerp(.3, 1, E.back(clamp(p0))) * br)
      // staircase: step k appears when the point lands on its value
      this.steps.forEach((s, k) => {
        const p = k === 0 ? p0 : clamp(hk[k - 1] * 1.6 - .6)
        svgOp(s.r, p); svgOp(s.t, p); svgOp(s.d, p); op(s.val, p); op(s.n, p)
        s.d.setAttribute('r', 7 * lerp(.2, 1, E.back(clamp(p))))
      })
      this.risers.forEach((r, k) => { const p = clamp(hk[k] * 1.6 - .6); svgOp(r.p, p > 0 ? 1 : 0); draw(r.p, p); op(r.lab, clamp(p * 2 - 1)) })
      // parameters
      const pa = pf(S, lt, 1, .655, .5), pb = pf(S, lt, 1, .9, .5)               // u_0 = 2 … r = 3 («طولها ثلاثة»)
      vis(this.par, pa, 0, 20); op(this.pb, pb)
      // «كلّ قفزةٍ طولها ثلاثة»: every +3 (arcs and risers) pulses together
      const on = pf(S, lt, 1, .86, .4)
      const pulse = on * (.5 + .5 * Math.sin((lt - S.at(1)) * 5))
      this.hops.forEach(h => { h.lab.style.textShadow = `0 0 ${18 * pulse}px rgba(110,224,90,.9)`; h.lab.style.transform = `scale(${1 + .12 * pulse})`; h.ar.path.setAttribute('stroke-width', 5.5 + 2 * pulse) })
      this.risers.forEach(r => { r.lab.style.textShadow = `0 0 ${14 * pulse}px rgba(110,224,90,.9)`; r.p.setAttribute('stroke-width', 6 + 3 * pulse) })
      this.pb.style.textShadow = `0 0 ${16 * pulse}px rgba(110,224,90,.8)`
    },
  })
})()

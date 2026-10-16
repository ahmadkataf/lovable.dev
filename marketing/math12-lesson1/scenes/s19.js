// s19 · ② اطّراد التابع — dots sitting on a curve inherit its direction. Card ② (grown out of the tracker),
// a generic rising curve whose integer points are the terms u_n = f(n); then the book's example
// v_n = (n−1)², f'(x) = 2(x−1) with its sign table, the parabola with the dots n = 0..4, a 3-second
// pause-and-think, and the answer: the first step goes down (pink), every later step goes up (green) → n₀ = 1.
// Written for the 6 lines of script.json; if the timeline still has the older 5-line version (example and
// derivative in one line), the cues are mapped onto it.
;(() => {
  const Y = C.yel, G = C.grn, R = C.red, B = C.blu, P = C.pur
  const INK = '#eef2ff'
  const id = (k, s) => `\\htmlId{s19-${k}}{${s}}`
  const tc = (c, s) => `\\textcolor{${c}}{${s}}`
  const $ = k => document.getElementById('s19-' + k)
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
      el: box,
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

  // logical lines (script.json has 6). Old 5-line timeline: line 2 = example + derivative.
  function cues(S) {
    if (S.lines.length >= 6) return { at: S.at, end: S.end }
    const a2 = S.at(2), e2 = S.end(2), m = a2 + .42 * (e2 - a2)
    return {
      at: i => (i < 3 ? S.at(i) : i === 3 ? m : S.at(i - 1)),
      end: i => (i < 2 ? S.end(i) : i === 2 ? m - .1 : i === 3 ? e2 : S.end(i - 1)),
    }
  }

  scene('s19', {
    build(root, S) {
      this.root = root
      this.head = heading(root, `${badge(2)}دراسة اطّراد التابع $f$`)
      this.trk = tracker(root, 2)

      // ---------------- lines 0–1: card ② + a generic rising curve
      const c = card(root, 'def', 1800, 300, 820, { anchor: 'tr', tag: 'الطريقة 2' })
      this.card = c.el; this.card.style.transformOrigin = '50% 50%'
      this.c1 = rich('كتابة $u_n = f(n)$، إن أمكن، ثم دراسة اطّراد التابع $f$', 'h3')
      this.c1.style.fontSize = '44px'; this.c1.style.lineHeight = 1.5
      c.body.appendChild(this.c1)
      this.c2 = rich(`فإذا كان التابع $f$ مطّرداً على المجال $${tc(B, '[n_0,+\\infty[')}$ كانت جهة اطّراد $(u_n)_{n\\ge n_0}$ هي نفسها جهة اطّراد $f$`, 'p')
      this.c2.style.marginTop = '22px'; this.c2.style.paddingTop = '20px'; this.c2.style.borderTop = `2px solid ${C.line}`
      this.c2w = el('div', '', null, c.body); this.c2w.style.overflow = 'hidden'
      this.c2w.appendChild(this.c2)
      splitWords(this.c2)

      const gp = plot(root, 150, 330, 740, 560, { xmin: -.45, xmax: 6.1, ymin: -.35, ymax: 3.3 })
      this.gp = gp
      const gf = x => .6 + .55 * x - .03 * x * x
      let d = ''
      for (let i = 0; i <= 80; i++) { const x = -.25 + i * (5.95 / 80); d += (i ? 'L' : 'M') + gp.X(x).toFixed(1) + ',' + gp.Y(gf(x)).toFixed(1) }
      this.gAx = [gp.xAxis, gp.yAxis]
      this.gCurve = sv(gp.s, 'path', { d, fill: 'none', stroke: P, 'stroke-width': 6, 'stroke-linecap': 'round' })
      this.gLab = gp.label(K(tc(P, 'y = f(x)')), 5.55, gf(5.55) + .42, 'c', 'mm')
      this.gBand = sv(gp.s, 'rect', { x: gp.X(1), y: gp.Y(0) - 7, width: gp.X(6.1) - gp.X(1) + 10, height: 14, rx: 7, fill: B, opacity: .35 })
      this.gBandL = gp.label(K(tc(B, '[n_0,+\\infty[')), 4.9, -.02, 'tc', 'mm'); this.gBandL.style.marginTop = '14px'
      this.gN0 = gp.label(K('n_0'), 1, -.02, 'tc', 'mm'); this.gN0.style.marginTop = '14px'
      this.gV = []; this.gD = []; this.gA = []; this.gT = []
      for (let n = 1; n <= 5; n++) {
        this.gV.push(sv(gp.s, 'line', { x1: gp.X(n), y1: gp.Y(0), x2: gp.X(n), y2: gp.Y(gf(n)), stroke: Y, 'stroke-width': 3, 'stroke-dasharray': '7 8', opacity: .55 }))
        this.gT.push(sv(gp.s, 'line', { x1: gp.X(n), y1: gp.Y(0) - 9, x2: gp.X(n), y2: gp.Y(0) + 9, stroke: C.mut, 'stroke-width': 3 }))
        const dot = sv(gp.s, 'circle', { cx: gp.X(n), cy: gp.Y(gf(n)), r: 13, fill: Y })
        dot.style.transformOrigin = `${gp.X(n)}px ${gp.Y(gf(n))}px`
        this.gD.push(dot)
        if (n < 5) {
          const x1 = gp.X(n) + 16, y1 = gp.Y(gf(n)) - 4, x2 = gp.X(n + 1) - 18, y2 = gp.Y(gf(n + 1)) + 2
          this.gA.push(arrow(gp.s, x1, y1 - 16, x2, y2 - 16, { color: G, width: 4, bend: -.18 }))
        }
      }
      this.gTag = gp.label(K(`u_n = f(n)`), 2.15, gf(3) + .78, 'c', 'mm')
      this.gTag.style.cssText += `;padding:6px 18px;border-radius:14px;background:rgba(255,210,63,.12);border:2px solid ${Y}88;color:${Y}`
      // line 1, second half: two consecutive integers n < n+1 inside [n0,+∞[ → f(n) < f(n+1)
      this.gNn = ['n', 'n+1'].map((s, i) => {
        const e = gp.label(K(tc(B, s)), 2 + i, -.02, 'tc', 'mm'); e.style.marginTop = '14px'; return e
      })
      this.gHalo = [1, 2].map(k => {
        const h = sv(gp.s, 'circle', { cx: gp.X(k + 1), cy: gp.Y(gf(k + 1)), r: 28, fill: Y, opacity: 0 })
        gp.s.insertBefore(h, this.gD[0])
        return h
      })
      this.cardH = this.card.offsetHeight                       // full height (line 1 text included)
      this.imp = el('div', '', null, root)
      this.imp.style.cssText += `display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 38px 12px;border-radius:22px;border:2.5px solid ${Y}99;background:rgba(255,210,63,.07)`
      const impF = tex(`${tc(B, 'n')} < ${tc(B, 'n+1')} \\;\\Longrightarrow\\; f(${tc(B, 'n')}) < f(${tc(B, 'n+1')})`, 'mm')
      impF.style.fontSize = '52px'; this.imp.appendChild(impF)
      const impT = rich(`أي $u_n < u_{n+1}$ <span class="mute">(إذا كان $f$ متزايداً تماماً)</span>`, 'p')
      impT.style.whiteSpace = 'nowrap'; impT.style.fontSize = '36px'; this.imp.appendChild(impT)
      place(this.imp, 1390, 300 + this.cardH + 38, { anchor: 'tc' })

      // ---------------- line 2: the example
      const ex = card(root, 'ex', 1800, 300, 820, { anchor: 'tr', tag: 'مثال' })
      this.ex = ex.el
      this.e1 = rich(`$(v_n)_{n\\ge0}$ المعرّفة بالصيغة $v_n = (n-1)^2$ في حالة $n\\ge0$`, 'p')
      ex.body.appendChild(this.e1)
      this.e2 = rich(`نرمز بالرمز $${tc(P, 'f')}$ إلى التابع المعرّف على $\\mathbb{R}$ وفق $${tc(P, 'x\\mapsto (x-1)^2')}$`, 'p')
      this.e2.style.marginTop = '14px'
      ex.body.appendChild(this.e2)
      splitWords(this.e2)

      // parabola plot (left)
      const pp = plot(root, 150, 312, 740, 560, { xmin: -1.15, xmax: 4.62, ymin: -.95, ymax: 10.3 })
      this.pp = pp
      const pf = x => (x - 1) * (x - 1)
      const path = (a, b) => { let s = ''; for (let i = 0; i <= 50; i++) { const x = a + i * (b - a) / 50; s += (i ? 'L' : 'M') + pp.X(x).toFixed(1) + ',' + pp.Y(pf(x)).toFixed(1) } return s }
      this.pAx = [pp.xAxis, pp.yAxis]
      this.pTicks = [0, 1, 2, 3, 4].map(n => {
        const t = sv(pp.s, 'line', { x1: pp.X(n), y1: pp.Y(0) - 8, x2: pp.X(n), y2: pp.Y(0) + 8, stroke: C.mut, 'stroke-width': 3 })
        const l = n ? pp.label(K(String(n)), n, 0, 'tc', 'mm') : pp.label(K('0'), 0, 0, 'tr', 'mm')
        l.style.marginTop = '16px'; if (!n) l.style.marginLeft = '-12px'
        l.style.color = C.mut; l.style.fontSize = '32px'
        return { t, l }
      })
      this.pyl = [4, 9].map(v => {
        const t = sv(pp.s, 'line', { x1: pp.X(0) - 8, y1: pp.Y(v), x2: pp.X(0) + 8, y2: pp.Y(v), stroke: C.mut, 'stroke-width': 3 })
        const l = pp.label(K(String(v)), 0, v, 'cr', 'mm'); l.style.marginLeft = '-16px'; l.style.color = C.mut; l.style.fontSize = '30px'
        return { t, l }
      })
      this.pL = sv(pp.s, 'path', { d: path(-.86, 1), fill: 'none', stroke: P, 'stroke-width': 6, 'stroke-linecap': 'round' })
      this.pR = sv(pp.s, 'path', { d: path(1, 4.17), fill: 'none', stroke: P, 'stroke-width': 6, 'stroke-linecap': 'round' })
      this.pLab = pp.label(K(tc(P, 'y = (x-1)^2')), 1.6, 8.5, 'c', 'mm')
      this.pArr = [['\\searrow', R, .35, 2.6], ['\\nearrow', G, 2.0, 4.4]].map(([s, col, x, y]) => {
        const e = pp.label(K(tc(col, s)), x, y, 'c', 'mx'); e.style.fontSize = '58px'; return e
      })
      // the terms v_0..v_4
      const vs = [1, 0, 1, 4, 9]
      this.vs = vs
      this.chords = vs.slice(0, 4).map((v, n) => {
        const a = { x: pp.X(n), y: pp.Y(v) }, b = { x: pp.X(n + 1), y: pp.Y(vs[n + 1]) }
        const L = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L
        return arrow(pp.s, a.x + ux * 17, a.y + uy * 17, b.x - ux * 19, b.y - uy * 19, { color: n === 0 ? R : G, width: 5 })
      })
      this.pDots = vs.map((v, n) => {
        const g = sv(pp.s, 'g')
        const halo = sv(g, 'circle', { cx: pp.X(n), cy: pp.Y(v), r: 24, fill: Y, opacity: 0 })
        const c = sv(g, 'circle', { cx: pp.X(n), cy: pp.Y(v), r: 13, fill: Y, stroke: C.bg, 'stroke-width': 3 })
        g.style.transformOrigin = `${pp.X(n)}px ${pp.Y(v)}px`
        return { g, c, halo }
      })
      const lp = [[-.16, .5, 'cr'], [1, .88, 'c'], [2.14, .45, 'cl'], [3.14, 3.6, 'cl'], [3.8, 9.05, 'cr']]
      this.pLabs = vs.map((v, n) => {
        const e = pp.label(K(`(${n},${v})`), lp[n][0], lp[n][1], lp[n][2], 'mm'); e.style.fontSize = '32px'; e.style.color = INK
        return e
      })
      this.vNote = pp.label(K(tc(R, 'v_0 = 1 > v_1 = 0')), 2.0, 6.3, 'c', 'mm')
      this.vNote.style.cssText += `;padding:6px 18px;border-radius:14px;background:rgba(255,92,138,.12);border:2px solid ${R}88;font-size:36px`
      this.vLead = sv(pp.s, 'path', { d: `M${pp.X(1.3)},${pp.Y(5.72)} Q${pp.X(.5)},${pp.Y(3.4)} ${pp.X(.4)},${pp.Y(.9)}`, fill: 'none', stroke: R, 'stroke-width': 2.5, 'stroke-dasharray': '6 7', opacity: .8 })
      // blue brace under the axis from n₀ = 1 onwards
      const by = pp.Y(0) + 74, bx1 = pp.X(1), bx2 = pp.X(4.5)       // clear of the tick labels 1..4
      this.brace = sv(pp.s, 'path', { d: `M${bx1},${by - 12} Q${bx1},${by} ${bx1 + 14},${by} L${bx2 - 14},${by}`, fill: 'none', stroke: B, 'stroke-width': 4, 'stroke-linecap': 'round' })
      this.braceHead = sv(pp.s, 'path', { d: `M${bx2 - 16},${by - 9} L${bx2},${by} L${bx2 - 16},${by + 9} Z`, fill: B })
      this.braceL = pp.label(K(tc(B, 'n_0 = 1')), 1.0, 0, 'tl', 'mm'); this.braceL.style.marginTop = '88px'; this.braceL.style.marginLeft = '-6px'; this.braceL.style.fontSize = '36px'

      // ---------------- line 3: derivative + sign table (right column)
      this.rc = el('div', '', null, root); this.rc.style.cssText += 'position:absolute;left:0;top:0;width:1920px;height:1080px'
      this.fd = tex(`f'(x) = 2(x-1)`, 'mx'); this.rc.appendChild(this.fd); place(this.fd, 1390, 708, { anchor: 'c' })
      this.tb = this._table(this.rc, 1040, 772)
      // ---------------- line 4: conclusion, question, countdown
      this.concl = rich(`$f$ متزايد تماماً على $[1,+\\infty[$`, 'h3'); this.concl.style.color = G; this.concl.style.whiteSpace = 'nowrap'
      root.appendChild(this.concl); place(this.concl, 1390, 632, { anchor: 'tc' })
      this.q = el('div', '', null, root)
      this.q.style.cssText += `display:flex;align-items:center;gap:18px;direction:rtl;padding:14px 30px;border-radius:22px;border:2.5px solid ${Y}99;background:rgba(255,210,63,.08)`
      this.qT = rich(`هل $(v_n)_{n\\ge0}$ متزايدة؟`, 'h3'); this.qT.style.color = Y; this.qT.style.whiteSpace = 'nowrap'; this.q.appendChild(this.qT)
      this.qX = el('div', 'h3', 'لا ✗', this.q); this.qX.style.cssText += `;color:${R};font-weight:900;white-space:nowrap`
      place(this.q, 1800, 800, { anchor: 'cr' })
      this.cdw = el('div', '', null, root)
      this.cdw.style.cssText += 'position:absolute;left:0;top:0;width:1920px;height:1080px'
      this.cd = countdown(this.cdw, 1090, 812, 54)
      const cdl = this.cdw.querySelector('.s'); if (cdl) { cdl.style.whiteSpace = 'nowrap'; cdl.style.fontSize = '28px' }
      // ---------------- line 5: the result
      this.kb = keyBox(root, 'x', 1390, 830, { color: G })
      this.kb.el.removeChild(this.kb.f)
      this.kb.el.style.background = 'rgba(110,224,90,.08)'
      const kt = rich(`فالمتتالية $(v_n)_{n\\ge1}$ <b>متزايدة تماماً</b> بدءاً من الحدّ ذي الدليل $${tc(B, 'n_0 = 1')}$`, 'p')
      kt.style.color = G; kt.style.width = '680px'; kt.style.textAlign = 'center'; kt.style.lineHeight = 1.55
      this.kb.el.appendChild(kt)
    },

    // the sign / variation table (LTR, like the book): rows x, f'(x), f(x)
    _table(parent, x, y) {
      const w = 700, h = 62, c0 = 150, mid = x + c0 + (w - c0) / 2
      const box = el('div', '', null, parent)
      box.style.cssText += `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${3 * h}px;border:2px solid ${C.line};border-radius:16px;background:rgba(20,29,56,.6);direction:ltr`
      const s = svg(box, 0, 0, w, 3 * h)
      sv(s, 'line', { x1: c0, y1: 0, x2: c0, y2: 3 * h, stroke: C.line, 'stroke-width': 2 })
      ;[1, 2].forEach(k => sv(s, 'line', { x1: 0, y1: k * h, x2: w, y2: k * h, stroke: C.line, 'stroke-width': 2 }))
      const dash = sv(s, 'g')
      const cell = (src, cx, cy, size = 40, col) => { const e = tex(src, 'mm'); e.style.fontSize = size + 'px'; if (col) e.style.color = col; box.appendChild(e); place(e, cx, cy, { anchor: 'c' }); return e }
      const L = c0 + 50, Rr = w - 50, M = mid - x, Lm = (c0 + M) / 2 + 10, Rm = (M + w) / 2
      const rows = [
        [cell('x', c0 / 2, h / 2), cell('-\\infty', L, h / 2), cell(tc(Y, '1'), M, h / 2), cell('+\\infty', Rr, h / 2)],
        [cell("f'(x)", c0 / 2, 1.5 * h), cell(tc(R, '-'), Lm, 1.5 * h, 46), cell(tc(Y, '0'), M, 1.5 * h), cell(tc(G, '+'), Rm, 1.5 * h, 46)],
        [cell('f(x)', c0 / 2, 2.5 * h), cell(tc(R, '\\searrow'), Lm, 2.5 * h - 3, 44), cell('0', M, 2.5 * h + 12, 34), cell(tc(G, '\\nearrow'), Rm, 2.5 * h - 3, 44)],
      ]
      return { box, rows, dash }
    },

    render(lt, S) {
      const Lc = cues(S)
      const at = Lc.at, end = Lc.end
      const dd = i => end(i) - at(i)
      const T = (i, f) => at(i) + f * dd(i)
      const pr = (t0, dur = .6, e = E.io) => prog(lt, t0, dur, e)
      const Fr = (i, a, b) => clamp(((lt - at(i)) / Math.max(.01, dd(i)) - a) / (b - a))

      this.head.set(pr(at(0), .8))
      this.trk.set(pr(at(0) + .1, .7), lt, .2)

      // ================= lines 0–1: card ② and the generic curve
      const out2 = pr(at(2), .55)
      const gOut = pr(Math.max(T(2, .33), at(2) + 1.2), .6)          // the generic picture stays until the parabola comes
      const cg = pr(at(0) + .5, .9, E.io)                   // the card grows out of tracker circle 2
      const tk = TRK(2), cx = 1800 - 410, cy = 300 + this.card.offsetHeight / 2
      this.card.style.transform = `translate(${(tk.x - cx) * (1 - cg)}px, ${(tk.y - cy) * (1 - cg) - out2 * 30}px) scale(${lerp(.08, 1, cg)})`
      op(this.card, Math.min(clamp(cg * 2), 1 - out2))
      typeWords(this.c2, Fr(1, .02, .8))
      op(this.c2, lt >= at(1) ? 1 : 0)
      const grow = pr(at(1) - .1, .7)
      this.c2w.style.height = (this.c2.offsetHeight + 22) * grow + 'px'
      // generic plot
      const ax = pr(at(0) + 1.2, .7)
      this.gAx.forEach(a => { draw(a, ax); a.style.opacity = 1 - gOut })
      this.gT.forEach(t => (t.style.opacity = ax * (1 - gOut)))
      draw(this.gCurve, pr(Math.max(T(0, .25), at(0) + 1.6), 1.4)); this.gCurve.style.opacity = 1 - gOut
      op(this.gLab, Math.min(pr(Math.max(T(0, .25), at(0) + 1.6) + 1.1, .5), 1 - gOut))
      const tD = Math.max(T(0, .45), at(0) + 3)
      // second half of line 1 ("لأنّ العددين n و n+1 يقعان في المجال"): two consecutive terms take the stage
      const tNn = Math.max(T(1, .52), at(1) + 3.6)
      const nn = pr(tNn, .6)
      this.gD.forEach((dot, k) => {
        const p = pr(tD + k * .22, .5, E.back)
        const pulse = env(lt, at(1) + .9 + k * .45, at(1) + 1.6 + k * .45, .2, .4)
        const pair = k === 1 || k === 2
        dot.style.opacity = clamp(p * 3) * (1 - gOut) * (pair ? 1 : 1 - .55 * nn)
        dot.style.transform = `scale(${Math.max(0, p) * (1 + .35 * pulse + (pair ? .25 * nn : 0))})`
        dot.style.filter = pulse > .01 ? `drop-shadow(0 0 ${12 * pulse}px ${Y})` : ''
        this.gV[k].style.opacity = (pair ? lerp(.55, 1, nn) : .55 * (1 - .5 * nn)) * clamp(pr(tD + k * .22 - .2, .4)) * (1 - gOut)
      })
      const glow = nn * (.75 + .25 * Math.sin(lt * 3))
      this.gHalo.forEach(h => h.setAttribute('opacity', (.3 * glow * (1 - gOut)).toFixed(3)))
      this.gNn.forEach((e, i) => rise(e, Math.min(pr(tNn + i * .25, .5), 1 - gOut), 12))
      // the panel sits under card ② (card height measured live: KaTeX fonts may load after build)
      const fullH = this.card.offsetHeight - this.c2w.offsetHeight + this.c2.offsetHeight + 22
      if (fullH !== this._fullH) { this._fullH = fullH; place(this.imp, 1390, 300 + fullH + 38, { anchor: 'tc' }) }
      const ip = pr(Math.max(T(1, .7), tNn + 1), .6)
      op(this.imp, Math.min(ip, 1 - out2)); this.imp.style.transform = `translateY(${(1 - ip) * 24 - out2 * 30}px)`
      const tg = pr(tD + 1.4, .6)
      op(this.gTag, Math.min(tg, 1 - pr(at(1), .4), 1 - gOut)); this.gTag.style.transform = `translateY(${(1 - tg) * 14}px)`
      // line 1: the interval [n0, +∞[ and the dots climbing with the curve
      const band = pr(at(1) + .2, .8)
      this.gBand.setAttribute('width', Math.max(0, (this.gp.X(6.1) - this.gp.X(1) + 10) * E.out(band)))
      this.gBand.style.opacity = band > 0 ? .35 * (1 - gOut) : 0
      op(this.gBandL, Math.min(pr(at(1) + .6, .5), 1 - gOut)); op(this.gN0, Math.min(Math.max(pr(tD, .5), 0), 1 - gOut))
      this.gA.forEach((a, k) => { a.set(pr(at(1) + 1.1 + k * .45, .5)); a.path.style.opacity = (1 - gOut) * (k === 1 ? 1 : 1 - .6 * nn) })

      // ================= line 2: the example and the parabola
      const out4 = pr(at(4), .4)                         // the example card leaves to make room
      const ei = pr(at(2) + .35, .7)
      op(this.ex, Math.min(ei, 1 - out4)); this.ex.style.transform = `translateY(${(1 - ei) * 36 - out4 * 40}px)`
      typeWords(this.e2, Fr(2, .4, .92))
      const pa = pr(Math.max(T(2, .33), at(2) + 1.2) + .35, .8)
      this.pAx.forEach(a => draw(a, pa))
      this.pTicks.forEach(({ t, l }) => { t.style.opacity = pa; op(l, pa) })
      this.pyl.forEach(({ t, l }) => { t.style.opacity = pa; op(l, pa) })
      const tPar = Math.max(T(2, .5), at(2) + 2.2)
      const pd = pr(tPar, 1.6, E.io)
      draw(this.pL, clamp(pd * 1.9)); draw(this.pR, clamp(pd * 1.9 - .9))
      op(this.pLab, pr(tPar + 1.2, .6))

      // ================= line 3: derivative, sign table, arrows on the graph
      const fdI = pr(at(3) + .3, .8)
      const up = pr(at(4) + .15, .8)                      // derivative + table move up in line 4
      wipe(this.fd, fdI)
      this.rc.style.transform = `translateY(${-382 * up}px)`
      const tb = this.tb
      const r0 = pr(Math.max(T(3, .25), at(3) + 1.2), .5), r1 = pr(Math.max(T(3, .5), at(3) + 1.9), .5), r2 = pr(Math.max(T(3, .75), at(3) + 2.6), .5)
      op(tb.box, r0); tb.box.style.transform = `translateY(${(1 - r0) * 20}px)`
      tb.rows[0].forEach(e => op(e, r0))
      tb.rows[1].forEach((e, i) => op(e, i === 0 ? r0 : i === 2 ? r1 : r1))
      tb.dash.style.opacity = r1
      tb.rows[2].forEach((e, i) => op(e, i === 0 ? r0 : r2))
      const aOut = pr(at(5), .5)
      this.pArr.forEach(e => { pop(e, r2); if (r2 >= 1) op(e, 1 - aOut) })

      // ================= line 4: conclusion, the dots, the question
      const coI = pr(at(4) + .5, .6)
      rise(this.concl, coI, 24)
      // the terms v_0..v_4 sit on the parabola
      const tDots = Math.max(T(4, .45), at(4) + 1.6)
      const hold0 = end(4), hold1 = at(5)
      this.pDots.forEach((d, n) => {
        const p = pr(tDots + n * .2, .5, E.back)
        d.g.style.opacity = clamp(p * 3); d.g.style.transform = `scale(${Math.max(0, p)})`
        // n = 0 and n = 1 blink during the question and the pause
        const bl = n < 2 ? env(lt, Math.max(T(4, .7), tDots + 1), hold1 + .2, .3, .4) * (.5 + .5 * Math.sin((lt - hold0) * 7)) : 0
        d.halo.setAttribute('opacity', (.45 * bl).toFixed(3))
        d.c.setAttribute('r', 13 + 4 * bl)
      })
      const qI = pr(Math.max(T(4, .68), tDots + .8), .6)
      const qOut = pr(Math.max(T(5, .45), at(5) + 3.2), .5)
      op(this.q, Math.min(qI, 1 - qOut)); this.q.style.transform = `translateY(${(1 - qI) * 20 - qOut * 20}px)`
      // "لا ✗" when the answer starts
      const no = pr(at(5), .45)
      op(this.qX, no); this.qX.style.transform = `scale(${lerp(1.6, 1, E.out(no))})`
      this.qT.style.color = mixColor(Y, '#ff9fbb', no)
      this.q.style.borderColor = mixColor(Y, R, no)
      // countdown during the pause (shows 3 while the question is asked)
      const cdIn = Math.min(qI, 1 - pr(hold1 - .1, .4))
      op(this.cdw, cdIn)
      this.cd(clamp((lt - hold0) / Math.max(.5, hold1 - hold0)) || 0.0001, Math.min(3, Math.max(0, hold1 - lt)))

      // ================= line 5: labels, coloured steps, n₀ = 1
      const l0 = pr(at(5) + .5, .5), l1 = pr(Math.max(T(5, .14), at(5) + 1.1), .5)
      ;[l0, l1].forEach((p, n) => rise(this.pLabs[n], p, 12))
      this.chords[0].set(pr(Math.max(T(5, .26), at(5) + 1.6), .6))
      const vn = pr(Math.max(T(5, .3), at(5) + 2), .6)
      op(this.vNote, vn); this.vNote.style.transform = `scale(${lerp(.85, 1, E.out(vn))})`
      draw(this.vLead, vn)
      const tG = Math.max(T(5, .42), at(5) + 2.8)
      ;[1, 2, 3].forEach(k => {
        const p = pr(tG + (k - 1) * .45, .5)
        this.chords[k].set(p)
        rise(this.pLabs[k + 1], pr(tG + (k - 1) * .45 + .25, .45), 12)
      })
      const tBr = Math.max(T(5, .62), tG + 1.6)
      const br = pr(tBr, .8)
      draw(this.brace, br); op(this.braceHead, br >= .95 ? 1 : 0); rise(this.braceL, pr(tBr + .3, .5), 12)
      const kbI = pr(Math.max(T(5, .5), at(5) + 3.6), .7)
      this.kb.set(kbI)
      if (kbI >= 1) this.kb.el.style.boxShadow = `0 0 ${40 + 14 * Math.sin(lt * 1.8)}px ${G}38`
    },
  })
})()

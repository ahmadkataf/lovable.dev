// s03 — what is a sequence: the function machine, the index set {n0, n0+1, …}, the notation (u_n), index vs term
scene('s03', (() => {
  const strip = s => s.replace(/[ً-ْٰـ]/g, '')
  function cue(S, i, needle, def = 0, lead = .15) {
    const L = S.lines[i]
    if (!L) return Infinity
    const txt = strip(L.text || ''), k = needle ? txt.indexOf(strip(needle)) : -1
    const f = k >= 0 ? k / Math.max(1, txt.length) : def
    return Math.max(S.at(i), S.at(i) + f * (S.end(i) - S.at(i)) - lead)
  }
  const fontsOK = () => document.fonts.check('48px KaTeX_Main') && document.fonts.check('italic 48px KaTeX_Math') && document.fonts.check('48px KaTeX_AMS')
  // machine geometry (final position, left half)
  const MX = 480, QY = 384, OY = 808, BOX = { x: 330, y: 472, w: 300, h: 196 }
  const col = k => MX + (k - 1.5) * 112
  const QX = s => MX + 150 + s * 100           // input queue slots (right of the funnel, flowing right → left)
  // number line geometry
  const NX0 = 250, NDX = 146, NY = 890
  const nx = v => NX0 + v * NDX
  // index/term boxes
  const BX = i => 150 + i * 150, BW = 136

  return {
    build(root, S) {
      this.root = root
      const T = this.T = {}
      T.mIn = S.at(0) + .05
      T.ball = []
      const b0 = Math.max(S.at(0) + .6, cue(S, 0, 'تدخل', .1))
      for (let k = 0; k < 4; k++) T.ball[k] = b0 + k * .8
      T.def = Math.max(T.ball[3] + 1.2, cue(S, 0, 'هذه هي', .45))
      T.func = Math.max(T.def + .5, cue(S, 0, 'تابع', .62))
      T.n0 = Math.max(S.at(1) + 1.6, cue(S, 1, 'تبدأ من', .27))
      T.inf = Math.max(T.n0 + 1.2, cue(S, 1, 'وتستمر', .55))
      T.chg = Math.max(T.inf + 1.2, cue(S, 1, 'وقد يتغير', .7))
      T.to1 = T.chg + .2
      T.to5 = T.to1 + Math.max(1.4, (S.end(1) - T.to1) * .45)
      T.cond = Math.max(S.at(2) + 1.3, cue(S, 2, 'حيث', .25))
      T.or = Math.max(T.cond + 1.5, cue(S, 2, 'أو إن صفر', .45))
      T.name = Math.max(T.or + 1.2, cue(S, 2, 'ونسمي', .58))
      T.term = Math.max(T.name + .6, cue(S, 2, 'حد المتتالية', .7))
      T.idx = Math.max(T.term + .7, cue(S, 2, 'ذا الدليل', .86))
      T.pos = Math.max(S.at(3) + 1.2, cue(S, 3, 'الدليل موقع', .07))
      T.val = Math.max(T.pos + .9, cue(S, 3, 'والحد قيمته', .2))
      T.u7 = Math.max(T.val + 1, cue(S, 3, 'فالحد يو سبعة', .3))
      T.ord = Math.max(T.u7 + 1.2, cue(S, 3, 'وهو الثامن', .55))
      T.q = Math.max(T.ord + 1.6, cue(S, 3, 'وقيمته', .78))

      this.h = heading(root, 'ما المتتالية؟')
      // the two open questions stay pinned in the corner (compact form)
      this.pins = ['🤔 سؤال مفتوح ①', '🔒 سؤال مفتوح ②'].map((t, i) => {
        const c = chip(root, t, 120, 158 + i * 54, { color: C.pur })
        c.style.cssText += 'font-size:22px;padding:6px 18px;white-space:nowrap'
        return c
      })

      // ================= line 0: the function machine =================
      this.mach = el('div', '', null, root)
      place(this.mach, 0, 0, { w: W, h: H })
      const ms = svg(this.mach, 0, 0, W, H)
      const defs = sv(ms, 'defs')
      const lg = sv(defs, 'linearGradient', { id: 's03-box', x1: 0, y1: 0, x2: 0, y2: 1 })
      sv(lg, 'stop', { offset: 0, 'stop-color': '#3b2a7a' })
      sv(lg, 'stop', { offset: 1, 'stop-color': '#21184d' })
      this.funnel = sv(ms, 'path', { d: `M${MX - 86},${BOX.y - 50} L${MX + 86},${BOX.y - 50} L${MX + 34},${BOX.y} L${MX - 34},${BOX.y} Z`, fill: '#2b2160', stroke: C.pur, 'stroke-width': 4, 'stroke-linejoin': 'round' })
      this.boxR = sv(ms, 'rect', { x: BOX.x, y: BOX.y, width: BOX.w, height: BOX.h, rx: 30, fill: 'url(#s03-box)', stroke: C.pur, 'stroke-width': 4 })
      sv(ms, 'rect', { x: MX - 30, y: BOX.y + BOX.h, width: 60, height: 22, rx: 4, fill: '#2b2160', stroke: C.pur, 'stroke-width': 4 })
      // gear (gentle life while it works)
      this.gear = sv(ms, 'g', {})
      {
        let d = ''
        const R1 = 22, R2 = 30, n = 9
        for (let i = 0; i < n * 2; i++) {
          const a0 = (i / (n * 2)) * Math.PI * 2, a1 = ((i + 1) / (n * 2)) * Math.PI * 2, r = i % 2 ? R1 : R2
          d += `${i ? 'L' : 'M'}${(Math.cos(a0) * r).toFixed(1)},${(Math.sin(a0) * r).toFixed(1)} L${(Math.cos(a1) * r).toFixed(1)},${(Math.sin(a1) * r).toFixed(1)} `
        }
        sv(this.gear, 'path', { d: d + 'Z', fill: 'none', stroke: 'rgba(167,139,250,.55)', 'stroke-width': 3, 'stroke-linejoin': 'round' })
        sv(this.gear, 'circle', { r: 8, fill: 'none', stroke: 'rgba(167,139,250,.55)', 'stroke-width': 3 })
      }
      this.mLab = el('div', 'h3 b', 'تابع', this.mach)
      this.mLab.style.cssText += 'white-space:nowrap'
      place(this.mLab, MX + 18, BOX.y + BOX.h / 2, { anchor: 'c' })
      this.balls = []; this.cards = []
      for (let k = 0; k < 4; k++) {
        const b = el('div', '', String(k), this.mach)
        b.style.cssText += `width:76px;height:76px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:900;color:#fff;background:radial-gradient(circle at 34% 30%,#8fdcff,${C.blu} 55%,#0d7fb8);box-shadow:0 8px 24px rgba(56,189,248,.35)`
        place(b, 0, 0); this.balls.push(b)
        const c = el('div', '', null, this.mach)
        c.style.cssText += `width:100px;height:84px;border-radius:16px;display:flex;align-items:center;justify-content:center;border:3px solid ${C.yel};background:rgba(255,210,63,.12);box-shadow:0 0 24px rgba(255,210,63,.25)`
        const f = tex(`u_{${k}}`, 'mm'); f.style.color = C.yel; c.appendChild(f)
        place(c, 0, 0); this.cards.push(c)
      }
      this.qDots = tex('\\cdots', 'mx'); this.qDots.style.color = C.blu; this.mach.appendChild(this.qDots); place(this.qDots, 0, 0)
      this.oDots = tex('\\cdots', 'mx'); this.oDots.style.color = C.yel; this.mach.appendChild(this.oDots); place(this.oDots, col(4) - 10, OY, { anchor: 'c' })

      // ================= def card (lines 0–1) =================
      const dc = card(root, 'def', 1800, 300, 900, { anchor: 'tr' })
      this.defCard = dc.el
      this.p1 = rich('المتتاليةُ هي <span class="yel b">تابعٌ</span> مجموعة تعريفه هي مجموعة الأعداد الطبيعيّة $\\mathbb{N}$', 'h3')
      dc.body.appendChild(this.p1); splitWords(this.p1)
      this.p2 = rich('أو أيّة مجموعة جزئيّة غير منتهية منها من النمط $\\{n_0,\\ n_0+1,\\ n_0+2,\\ \\dots\\}$ حيث $n_0$ عددٌ طبيعيٌّ معطى <span class="s03-chg">(يمكن أن يتغير من متتالية إلى أخرى)</span>', 'p')
      this.p2.style.cssText += 'padding-top:14px;font-size:38px;line-height:1.55'
      this.p2w = el('div', '', null, dc.body); this.p2w.style.overflow = 'hidden'
      this.p2w.appendChild(this.p2); splitWords(this.p2)
      this.chg = this.p2.querySelector('.s03-chg')
      this.chg.style.borderRadius = '10px'; this.chg.style.padding = '0 4px'; this.chg.style.whiteSpace = 'nowrap'

      // ================= line 1: number line of N, n0 marker, readout =================
      this.nl = el('div', '', null, root)
      place(this.nl, 0, 0, { w: W, h: H })
      const ns = svg(this.nl, 0, 0, W, H)
      this.axis = sv(ns, 'path', { d: `M${nx(0) - 50},${NY} L1712,${NY}`, stroke: C.mut, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' })
      this.ticks = []; this.tnum = []
      for (let v = 0; v <= 8; v++) {
        this.ticks.push(sv(ns, 'path', { d: `M${nx(v)},${NY - 12} L${nx(v)},${NY + 12}`, stroke: C.mut, 'stroke-width': 3 }))
        const t = tex(String(v), 'mm'); this.nl.appendChild(t); place(t, nx(v), NY + 46, { anchor: 'c' }); this.tnum.push(t)
      }
      this.ndots = tex('\\cdots', 'mm'); this.ndots.style.color = C.mut; this.nl.appendChild(this.ndots); place(this.ndots, nx(8) + 130, NY + 40, { anchor: 'c' })
      this.nlab = tex('\\mathbb{N}', 'mm'); this.nlab.style.color = C.mut; this.nl.appendChild(this.nlab); place(this.nlab, nx(0) - 86, NY, { anchor: 'c' })
      // bracket (blue) from n0 to +∞
      this.brk = sv(ns, 'path', { fill: 'none', stroke: C.blu, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      this.brkTail = sv(ns, 'path', { fill: 'none', stroke: C.blu, 'stroke-width': 7, 'stroke-linecap': 'round' })
      this.brkHead = sv(ns, 'path', { d: 'M0,-14 L22,0 L0,14 Z', fill: C.blu })
      this.inf = tex('+\\infty', 'mm'); this.inf.style.color = C.blu; this.nl.appendChild(this.inf)
      place(this.inf, 1755, NY - 52, { anchor: 'c' })
      // marker
      this.mk = el('div', '', null, this.nl)
      this.mk.style.cssText += 'position:absolute;width:0;height:0'
      const mkTri = el('div', '', null, this.mk)
      mkTri.style.cssText = `position:absolute;left:-14px;top:-26px;width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-top:20px solid ${C.blu}`
      const mkLab = tex('n_0', 'mm'); mkLab.style.cssText += `position:absolute;left:0;top:-58px;translate:-50% -50%;color:${C.blu};font-size:52px`
      this.mk.appendChild(mkLab)
      // readout (left)
      this.ro = el('div', '', null, root)
      place(this.ro, 0, 0, { w: W, h: H })
      this.roLab = rich('مجموعة التعريف', 's'); this.roLab.style.whiteSpace = 'nowrap'
      this.ro.appendChild(this.roLab); place(this.roLab, 480, 400, { anchor: 'c' })
      this.roV = [0, 3, 1, 5].map((v, i) => {
        const a = tex(i ? `n_0 = \\textcolor{${C.blu}}{${v}}` : '\\mathbb{N}', 'ml'); this.ro.appendChild(a); place(a, 480, 500, { anchor: 'c' })
        const b = tex(`\\{${v},\\ ${v + 1},\\ ${v + 2},\\ ${v + 3},\\ \\dots\\}`, 'mx'); b.style.color = C.ink; this.ro.appendChild(b); place(b, 480, 630, { anchor: 'c' })
        return { a, b, v }
      })

      // ================= line 2: notation =================
      this.nt = el('div', '', null, root)
      place(this.nt, W / 2, 430, { anchor: 'c' })
      this.nt.style.cssText += 'display:flex;direction:rtl;align-items:baseline;gap:56px;white-space:nowrap'
      this.ntA = tex('(\\htmlClass{s03-u}{u_{\\htmlClass{s03-sub}{n}}})_{\\htmlClass{s03-c}{n\\ge 0}}', 'mxl'); this.nt.appendChild(this.ntA)
      this.ntOr = rich('أو', 'h2'); this.ntOr.style.color = C.mut; this.nt.appendChild(this.ntOr)
      this.ntB = tex('(\\htmlClass{s03-u}{u_n})_{\\htmlClass{s03-c}{n\\ge n_0}}', 'mxl'); this.nt.appendChild(this.ntB)
      this.us = [...this.nt.querySelectorAll('.s03-u')]
      this.sub = this.ntA.querySelector('.s03-sub')
      this.conds = [this.ntA.querySelector('.s03-c'), this.ntB.querySelector('.s03-c')]
      this.condLab = ['يبدأ الدليل من $0$', 'يبدأ الدليل من $n_0$'].map(t => {
        const e = rich(t, 's'); e.style.cssText += `color:${C.blu};white-space:nowrap;font-weight:700`
        e.querySelectorAll('bdi').forEach(b => { b.style.fontSize = '1.1em' })
        root.appendChild(e); return e
      })
      this.ns2 = svg(root, 0, 0, W, H)
      this.subRing = sv(this.ns2, 'ellipse', { fill: 'none', stroke: C.blu, 'stroke-width': 5 })
      this.subLine = sv(this.ns2, 'path', { fill: 'none', stroke: C.blu, 'stroke-width': 3, 'stroke-dasharray': '6 6' })
      this.subLab = el('div', 'h3 b', 'الدليل', root); this.subLab.style.cssText += `color:${C.blu};white-space:nowrap`
      this.term = rich('$u_n$ :&nbsp; <span class="pur b">حدّ المتتالية ذو الدليل $n$</span>', 'h2')
      this.term.style.cssText += 'white-space:nowrap;font-size:56px'
      this.term.querySelector('bdi').style.color = C.yel
      this.term.querySelectorAll('bdi').forEach(b => { b.style.fontSize = '1.15em' })
      root.appendChild(this.term); place(this.term, W / 2, 760, { anchor: 'c' })

      // ================= line 3: index vs term =================
      this.row = el('div', '', null, root)
      place(this.row, 0, 0, { w: W, h: H })
      this.ords = ['الأوّل', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'].map((t, i) => {
        const e = el('div', 's', t, this.row); e.style.cssText += 'white-space:nowrap;font-size:28px'
        place(e, BX(i) + BW / 2, 396, { anchor: 'c' }); return e
      })
      this.boxes = []; this.vals = []; this.idxs = []
      for (let i = 0; i < 8; i++) {
        const b = el('div', '', null, this.row)
        b.style.cssText += `border-radius:18px;border:3px solid rgba(255,210,63,.55);background:rgba(255,210,63,.07)`
        place(b, BX(i), 440, { w: BW, h: 130 })
        const v = tex(`u_{${i}}`, 'mx'); v.style.color = C.yel; this.row.appendChild(v); place(v, BX(i) + BW / 2, 505, { anchor: 'c' })
        const ix = tex(String(i), 'mx'); ix.style.color = C.blu; this.row.appendChild(ix); place(ix, BX(i) + BW / 2, 622, { anchor: 'c' })
        this.boxes.push(b); this.vals.push(v); this.idxs.push(ix)
      }
      this.rDots = tex('\\cdots', 'mx'); this.rDots.style.color = C.mut; this.row.appendChild(this.rDots); place(this.rDots, BX(8) + 40, 505, { anchor: 'c' })
      this.iDots = tex('\\cdots', 'mx'); this.iDots.style.color = C.mut; this.row.appendChild(this.iDots); place(this.iDots, BX(8) + 40, 622, { anchor: 'c' })
      this.labV = rich('الحدّ = القيمة', 'h3'); this.labV.style.cssText += `color:${C.yel};font-weight:800;white-space:nowrap;font-size:40px`
      this.row.appendChild(this.labV); place(this.labV, 1800, 505, { anchor: 'cr' })
      this.labI = rich('الدليل = الموقع', 'h3'); this.labI.style.cssText += `color:${C.blu};font-weight:800;white-space:nowrap;font-size:40px`
      this.row.appendChild(this.labI); place(this.labI, 1800, 622, { anchor: 'cr' })
      // highlight of box 7
      this.hl7 = el('div', 'hlbox', null, this.row)
      place(this.hl7, BX(7) - 14, 426, { w: BW + 28, h: 236 })
      this.q7 = el('div', '', '؟', this.row)
      this.q7.style.cssText += `font-size:64px;font-weight:900;color:${C.yel};text-shadow:0 0 24px rgba(255,210,63,.6)`
      place(this.q7, BX(7) + BW / 2, 524, { anchor: 'c' })
      this.cap7 = rich('$u_7$ : الحدّ ذو الدليل <span class="blu b">7</span>', 'h3')
      this.cap7.style.cssText += 'white-space:nowrap'
      this.cap7.querySelector('bdi').style.color = C.yel
      this.row.appendChild(this.cap7); place(this.cap7, BX(7) + BW / 2, 742, { anchor: 'c' })
      const rs = svg(this.row, 0, 0, W, H)
      this.capArrow = arrow(rs, BX(7) + BW / 2, 702, BX(7) + BW / 2, 668, { color: C.blu, width: 4 })
      this.warn = chip(this.row, '⚠️ الدليل $n$ ليس قيمة الحدّ $u_n$', W / 2, 880, { anchor: 'c', color: C.red })
      this.warn.innerHTML = rich('⚠️ الدليل $n$ ليس قيمة الحدّ $u_n$', 's').innerHTML
      this.warn.style.cssText += 'font-size:36px;padding:14px 36px;white-space:nowrap;direction:rtl'
    },

    measure() {
      const root = this.root
      this.nt.style.transform = 'none'; this.nt.style.opacity = 1
      const r = rectIn(this.sub, root)
      this.subR = r
      this.subRing.setAttribute('cx', r.cx); this.subRing.setAttribute('cy', r.cy)
      const rx = r.w / 2 + 12, ry = r.w / 2 + 20
      const rn = rectIn(this.nt, root), ra = rectIn(this.ntA, root)
      this.ntShift = (rn.w - ra.w) / 2
      this.conds.forEach((c, i) => { const rc = rectIn(c, root); place(this.condLab[i], rc.cx, rc.y + rc.h + 46, { anchor: 'c' }) })
      this.subRing.setAttribute('rx', rx); this.subRing.setAttribute('ry', ry)
      const y1 = r.cy + ry, y2 = r.cy + ry + 56
      this.subLine.setAttribute('d', `M${r.cx},${y1} L${r.cx},${y2}`)
      place(this.subLab, r.cx, y2 + 30, { anchor: 'c' })
      this.p2w.style.maxHeight = 'none'
      this.p2H = this.p2w.scrollHeight + 4
      // the term caption sits below the label
      place(this.term, W / 2, Math.max(760, y2 + 150), { anchor: 'c' })
      this._ok = fontsOK()
    },

    render(lt, S) {
      if (!this._ok) this.measure()
      const T = this.T
      this.h.set(prog(lt, .2, .7))
      this.pins.forEach((c, i) => {
        const a = prog(lt, .15 + i * .12, .5)
        op(c, a * (.85 + .15 * Math.sin(lt * 1.4 + i)))
        c.style.transform = `translateY(${(1 - a) * -10}px)`
      })
      const out1 = S.p(lt, 1, 0, .6)        // machine leaves
      const out2 = S.p(lt, 2, 0, .55)       // card / number line leave
      const out3 = S.p(lt, 3, 0, .55)       // notation leaves

      // ---------------- machine ----------------
      {
        const a = prog(lt, T.mIn, .6, E.out)
        const shift = prog(lt, T.def - .2, .9, E.io)
        op(this.mach, a * (1 - out1))
        this.mach.style.transform = `translateX(${(1 - shift) * 480 - out1 * 80}px) scale(${lerp(.92, 1, a)})`
        this.mach.style.transformOrigin = `${MX}px 600px`
        // machine working pulse
        let work = 0
        for (let k = 0; k < 4; k++) work = Math.max(work, env(lt, T.ball[k] + .55, T.ball[k] + 1.15, .15, .3))
        this.boxR.setAttribute('stroke', mixColor(C.pur, C.yel, work * .7))
        this.boxR.style.filter = `drop-shadow(0 0 ${10 + 26 * work}px rgba(167,139,250,${(.25 + .35 * work).toFixed(2)}))`
        let spin = 0
        for (let k = 0; k < 4; k++) spin += clamp((lt - T.ball[k] - .5) / .7) * 120
        this.gear.setAttribute('transform', `translate(${BOX.x + 44} ${BOX.y + 40}) rotate(${spin + lt * 8})`)
        const fl = env(lt, T.func, T.func + 1.6, .25, .5)
        this.mLab.style.color = mixColor('#eef2ff', C.yel, fl)
        this.mLab.style.textShadow = fl > 0 ? `0 0 ${26 * fl}px rgba(255,210,63,.6)` : 'none'
        this.mLab.style.transform = `scale(${1 + .12 * fl})`
        for (let k = 0; k < 4; k++) {
          const t = T.ball[k], b = this.balls[k], c = this.cards[k]
          const appear = prog(lt, T.mIn + .15 + k * .08, .4, E.out)
          let slot = k
          for (let j = 0; j < k; j++) slot -= prog(lt, T.ball[j] + .1, .5, E.io)
          const pA = prog(lt, t, .45, E.io)                    // hop into the funnel mouth
          const pB = prog(lt, t + .45, .32, E.in)               // drop into the machine
          let x = lerp(QX(slot), MX, pA), y = lerp(QY, BOX.y - 70, pA) - Math.sin(pA * Math.PI) * 60
          y = lerp(y, BOX.y - 10, pB)
          place(b, x, y, { anchor: 'c' })
          op(b, appear * (1 - clamp((pB - .6) / .4)))
          b.style.transform = `scale(${lerp(1, .55, pB) * lerp(.6, 1, appear)})`
          const pC = prog(lt, t + .95, .35, E.out)              // card pops out of the chute
          const pD = prog(lt, t + 1.25, .7, E.lin)              // slides to its slot
          const yOut = BOX.y + BOX.h + 50
          const px = E.io(clamp(pD / .75)), py = E.io(clamp((pD - .55) / .45))
          place(c, lerp(MX, col(k), px), lerp(lerp(BOX.y + BOX.h, yOut, pC), OY, py), { anchor: 'c' })
          op(c, clamp(pC * 2))
          c.style.transform = `scale(${lerp(.4, 1, pC)})`
        }
        let dslot = 4
        for (let j = 0; j < 4; j++) dslot -= prog(lt, T.ball[j] + .1, .5, E.io)
        place(this.qDots, QX(dslot), QY, { anchor: 'c' })
        op(this.qDots, prog(lt, T.mIn + .5, .5) * (1 - prog(lt, T.def - .5, .4)))
        op(this.oDots, prog(lt, T.ball[3] + 1.6, .5))
      }

      // ---------------- definition card ----------------
      {
        const a = prog(lt, T.def, .6, E.out) * (1 - out2)
        op(this.defCard, a)
        this.defCard.style.transform = `translateY(${(1 - prog(lt, T.def, .6, E.out)) * 30 - out2 * 24}px)`
        typeWords(this.p1, prog(lt, T.def + .25, Math.max(1.6, S.end(0) - T.def - 1), E.lin))
        typeWords(this.p2, S.f(lt, 1, .02, .8))
        this.p2w.style.maxHeight = (this.p2H * S.p(lt, 1, 0, .7)) + 'px'
        const g = prog(lt, T.chg, .5) * (1 - out2)
        this.chg.style.color = mixColor('#eef2ff', C.yel, g)
        this.chg.style.background = `rgba(255,210,63,${(.14 * g * (.75 + .25 * Math.sin(lt * 3))).toFixed(3)})`
      }

      // ---------------- number line, n0 marker, readout ----------------
      {
        const a = S.p(lt, 1, .5, .7) * (1 - out2)
        op(this.nl, a)
        this.nl.style.transform = `translateY(${(1 - S.p(lt, 1, .5, .7)) * 24}px)`
        draw(this.axis, S.p(lt, 1, .5, .9))
        // n0(t): 3 → 1 → 5
        const m1 = prog(lt, T.to1, .8, E.io), m2 = prog(lt, T.to5, .9, E.io)
        const n0 = lerp(lerp(3, 1, m1), 5, m2)
        const mk = prog(lt, T.n0, .5, E.back)
        this.mk.style.left = nx(n0) + 'px'; this.mk.style.top = (NY - 30) + 'px'
        op(this.mk, clamp(mk * 2))
        this.mk.style.transform = `scale(${lerp(.5, 1, mk)})`
        for (let v = 0; v <= 8; v++) {
          const dim = mk > 0 ? clamp(n0 - v + .5) * clamp(mk * 2) : 0
          const inSet = mk > 0 ? clamp(v - n0 + .5) * clamp(mk * 2) : 0
          this.tnum[v].style.color = mixColor(mixColor('#eef2ff', '#5d6a8f', dim), C.blu, inSet * .85)
          op(this.tnum[v], prog(lt, S.at(1) + .7 + v * .06, .4) * (1 - .55 * dim))
          this.ticks[v].setAttribute('stroke', dim > .5 ? C.dim : C.mut)
          this.ticks[v].style.opacity = prog(lt, S.at(1) + .7 + v * .06, .4)
        }
        op(this.ndots, prog(lt, S.at(1) + 1.3, .4)); op(this.nlab, prog(lt, S.at(1) + .6, .4))
        // bracket from n0 to 8, then the tail to +∞
        const bp = prog(lt, T.n0 + .2, .8, E.io), tp = prog(lt, T.inf, .9, E.io)
        const by = NY - 22, xs = nx(n0), xe = lerp(xs, nx(8), bp)
        this.brk.setAttribute('d', `M${xs},${by + 14} L${xs},${by} L${xe},${by}`)
        this.brk.style.opacity = bp > 0 ? 1 : 0
        const xt = lerp(nx(8), 1700, tp)
        this.brkTail.setAttribute('d', `M${nx(8)},${by} L${xt},${by}`)
        this.brkTail.style.opacity = tp > 0 ? 1 : 0
        this.brkHead.setAttribute('transform', `translate(${Math.max(xe, xt) + 4} ${by})`)
        this.brkHead.style.opacity = bp > .05 ? 1 : 0
        op(this.inf, tp)
        // readout
        const ra = S.p(lt, 1, .9, .6) * (1 - out2)
        op(this.ro, ra)
        this.ro.style.transform = `translateY(${(1 - S.p(lt, 1, .9, .6)) * 20}px)`
        const w0 = prog(lt, T.n0 + .15, .45), w1 = prog(lt, T.to1 + .3, .4), w2 = prog(lt, T.to5 + .35, .4)
        const ws = [1 - w0, w0 * (1 - w1), w1 * (1 - w2), w2]
        this.roV.forEach((r, i) => {
          op(r.a, ws[i]); op(r.b, ws[i])
          const dy = (1 - ws[i]) * 16
          r.a.style.transform = `translateY(${dy}px)`; r.b.style.transform = `translateY(${dy}px)`
        })
      }

      // ---------------- line 2: notation ----------------
      {
        const a = S.p(lt, 2, .35, .6) * (1 - out3)
        op(this.nt, a)
        const sh = prog(lt, T.or, .8, E.io)
        this.nt.style.transform = `translate(${-this.ntShift * (1 - sh)}px, ${(1 - S.p(lt, 2, .35, .6)) * 24 - out3 * 30}px)`
        ;[T.cond, T.or + .6].forEach((t, i) => {
          const c = prog(lt, t, .5), fl = env(lt, t, t + 1.6, .3, .6)
          const la = prog(lt, t + .2, .5) * (1 - prog(lt, T.name, .5)) * (1 - out3)
          op(this.condLab[i], la)
          this.condLab[i].style.transform = `translate(${i ? 0 : -this.ntShift * (1 - sh)}px, ${(1 - prog(lt, t + .2, .5)) * 10}px)`
          this.conds[i].style.color = mixColor('#eef2ff', C.blu, c)
          this.conds[i].style.textShadow = fl > 0 ? `0 0 ${24 * fl}px rgba(56,189,248,.9)` : 'none'
        })
        wipe(this.ntA, S.p(lt, 2, .35, 1.1), 'ltr')
        const pb = prog(lt, T.or, .9)
        op(this.ntOr, clamp(pb * 2)); wipe(this.ntB, prog(lt, T.or + .3, 1), 'ltr')
        const g = prog(lt, T.name, .6)
        const pulse = .5 + .5 * Math.sin(lt * 2.4)
        this.us.forEach(u => {
          u.style.color = mixColor('#eef2ff', C.yel, g)
          u.style.textShadow = g > 0 ? `0 0 ${(20 + 16 * pulse) * g}px rgba(255,210,63,.55)` : 'none'
        })
        const ip = prog(lt, T.idx, .7)
        this.sub.style.color = ip > 0 ? mixColor(C.yel, C.blu, ip) : ''
        this.sub.style.textShadow = 'none'
        this.subRing.style.opacity = (1 - out3)
        this.subRing.style.strokeDasharray = 600; this.subRing.style.strokeDashoffset = 600 * (1 - ip)
        this.subRing.style.visibility = ip > 0 ? 'visible' : 'hidden'
        draw(this.subLine, prog(lt, T.idx + .35, .4)); this.subLine.style.opacity = 1 - out3
        const lp = prog(lt, T.idx + .55, .5)
        op(this.subLab, lp * (1 - out3)); this.subLab.style.transform = `translateY(${(1 - lp) * 12}px)`
        const tp = prog(lt, T.term, .7, E.out) * (1 - out3)
        op(this.term, tp); this.term.style.transform = `translateY(${(1 - prog(lt, T.term, .7, E.out)) * 26 - out3 * 20}px)`
      }

      // ---------------- line 3: index vs term ----------------
      {
        op(this.row, S.p(lt, 3, .3, .4))
        for (let i = 0; i < 8; i++) {
          const p = S.p(lt, 3, .35 + i * .07, .45, E.out)
          op(this.boxes[i], p); this.boxes[i].style.transform = `translateY(${(1 - p) * 26}px)`
          op(this.vals[i], p); this.vals[i].style.transform = `translateY(${(1 - p) * 26}px)`
          const pi = S.p(lt, 3, .6 + i * .07, .45, E.out)
          op(this.idxs[i], pi); this.idxs[i].style.transform = `translateY(${(1 - pi) * -14}px)`
        }
        op(this.rDots, S.p(lt, 3, .95, .4)); op(this.iDots, S.p(lt, 3, 1.2, .4))
        // "index = position"
        const ip = prog(lt, T.pos, .5)
        op(this.labI, ip); this.labI.style.transform = `translateX(${(1 - ip) * 30}px)`
        const iw = env(lt, T.pos, T.pos + 1.5, .3, .5)
        this.idxs.forEach((e, i) => { e.style.textShadow = iw > 0 ? `0 0 ${22 * iw}px rgba(56,189,248,.9)` : 'none' })
        // "term = value"
        const vp = prog(lt, T.val, .5)
        op(this.labV, vp); this.labV.style.transform = `translateX(${(1 - vp) * 30}px)`
        const vw = env(lt, T.val, T.val + 1.5, .3, .5)
        this.boxes.forEach(b => { b.style.boxShadow = vw > 0 ? `0 0 ${30 * vw}px rgba(255,210,63,.45)` : 'none' })
        // u_7 highlight
        const hp = prog(lt, T.u7, .5)
        op(this.hl7, clamp(hp * 1.5)); this.hl7.style.transform = `scale(${lerp(1.12, 1, E.out(hp)) * (1 + .015 * Math.sin(lt * 3) * hp)})`
        this.idxs[7].style.transform = `scale(${1 + .25 * hp})`
        this.capArrow.set(prog(lt, T.u7 + .35, .4))
        const cp = prog(lt, T.u7 + .3, .5)
        op(this.cap7, cp); this.cap7.style.transform = `translateY(${(1 - cp) * 14}px)`
        // ordinals count, "the eighth" lights up
        this.ords.forEach((e, i) => {
          const p = prog(lt, T.ord + i * .16, .3)
          op(e, p)
          const on = i === 7 ? prog(lt, T.ord + 7 * .16 + .2, .4) : 0
          e.style.color = mixColor('#9aa8c9', C.yel, on)
          e.style.fontWeight = i === 7 && on > .5 ? 800 : 500
          e.style.transform = `scale(${1 + .3 * on})`
        })
        // its value: ?
        const qp = prog(lt, T.q, .5, E.back)
        this.vals[7].style.transform = `translateY(${-36 * clamp(qp)}px) scale(${lerp(1, .68, clamp(qp))})`
        op(this.q7, clamp(qp * 2)); this.q7.style.transform = `translateY(8px) scale(${lerp(.4, 1, qp)})`
        const wp = prog(lt, T.q + .4, .5)
        op(this.warn, wp); this.warn.style.transform = `translateY(${(1 - wp) * 20}px)`
      }
    },
  }
})())

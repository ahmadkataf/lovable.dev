// s02 — bridge (induction, page 6) → lesson title → roadmap → open question ② (the number 7)
scene('s02', (() => {
  const strip = s => s.replace(/[ً-ْٰـ]/g, '')
  function cue(S, i, needle, def = 0, lead = .15) {
    const L = S.lines[i]
    if (!L) return Infinity
    const txt = strip(L.text || ''), k = needle ? txt.indexOf(strip(needle)) : -1
    const f = k >= 0 ? k / Math.max(1, txt.length) : def
    return Math.max(S.at(i), S.at(i) + f * (S.end(i) - S.at(i)) - lead)
  }
  const fontsOK = () => document.fonts.check('48px KaTeX_Main') && document.fonts.check('italic 48px KaTeX_Math')
  const SP = 100, R = 34
  const PS = .56, PIN = { x: 120, y: 174 }          // pinned open-question cards (same as the end of s01)

  // tiny line icons for the roadmap (60×60)
  const ICONS = [
    // machine
    g => { sv(g, 'rect', { x: 10, y: 20, width: 40, height: 26, rx: 6 }); sv(g, 'path', { d: 'M18,6 L42,6 L34,18 L26,18 Z' }); sv(g, 'path', { d: 'M30,46 L30,57 M25,52 L30,57 L35,52' }) },
    // staircase
    g => { sv(g, 'path', { d: 'M5,54 L17,54 L17,42 L29,42 L29,30 L41,30 L41,18 L55,18' }) },
    // equal hops
    g => { sv(g, 'path', { d: 'M4,48 L56,48' }); sv(g, 'path', { d: 'M8,46 Q15,24 22,46 M22,46 Q29,24 36,46 M36,46 Q43,24 50,46' }) },
    // growing bars
    g => { [[8, 7], [20, 13], [32, 24], [44, 42]].forEach(([x, h]) => sv(g, 'rect', { x, y: 52 - h, width: 9, height: h, rx: 2 })) },
    // bracket
    g => { sv(g, 'path', { d: 'M21,8 Q8,30 21,52 M39,8 Q52,30 39,52' }); [24, 30, 36].forEach(x => sv(g, 'circle', { cx: x, cy: 30, r: 1.6 })) },
    // three mini cards
    g => { [[4, 30], [22, 22], [40, 14]].forEach(([x, y]) => sv(g, 'rect', { x, y, width: 15, height: 22, rx: 3 })) },
    // pencil
    g => { sv(g, 'path', { d: 'M16,44 L40,20 L47,27 L23,51 Z M16,44 L11,56 L23,51 M35,25 L42,32' }) },
  ]

  return {
    build(root, S) {
      this.root = root
      const T = this.T = {}
      // line 0
      T.def = Math.max(S.at(0) + .8, cue(S, 0, 'استخلاص', .16))
      T.defEnd = Math.max(T.def + 1.5, cue(S, 0, 'فالرياضيات', .52))
      T.c1 = Math.max(T.defEnd + .2, cue(S, 0, 'ملاحظة', .62))
      T.c2 = Math.max(T.c1 + .45, cue(S, 0, 'وتجربة', .66))
      T.c3 = T.c2 + .6
      T.pen = Math.max(T.c3 + .3, cue(S, 0, 'يكفيها', .7))
      T.tag = Math.max(T.pen + 1.2, cue(S, 0, 'أما الإثبات', .82))
      // line 2 roadmap stops
      const needles = ['ما المتتالية', 'وجهة', 'والحسابية', 'والهندسية', 'ومطابقة', 'وثلاث طرائق', 'وثلاثة تمارين']
      T.stop = []
      needles.forEach((n, i) => { T.stop[i] = Math.max(i ? T.stop[i - 1] + .4 : S.at(2) + .7, cue(S, 2, n, .1 + i * .12)) })
      // line 3
      T.seven = Math.max(S.at(3) + .25, cue(S, 3, 'لغز', .27))
      T.chip = Math.max(T.seven + .7, cue(S, 3, 'بطله', .5))
      T.fly = Math.min(Math.max(T.chip + .9, S.at(3) + 2.1), S.end(3) - .2)
      T.shrink = T.fly + .25

      // ---------- pinned card ① (identical to s01's end state) ----------
      {
        const c = card(root, 'def', 410, 196, 1100, { tag: '🤔 سؤال مفتوح ①' })
        this.card1 = c.el
        c.el.style.padding = '42px 50px 32px'
        c.el.style.transformOrigin = '0 0'
        c.el.style.transform = `translate(${PIN.x - 410}px, ${PIN.y - 196}px) scale(${PS})`
        const q = rich('كيف تُثبت صحّة استقرائك إثباتاً رياضياً؟', 'h3'); c.body.appendChild(q)
        const fr = el('div', '', null, c.body)
        fr.style.cssText = 'direction:rtl;display:flex;align-items:baseline;gap:28px;margin-top:14px;white-space:nowrap'
        const ff = tex('1+3+5+\\cdots+(2n-1) = \\textcolor{#ffd23f}{n^2}', 'mx'); ff.style.fontSize = '58px'; fr.appendChild(ff)
        const fq = rich('مهما يكن $n$', 'p'); fq.style.whiteSpace = 'nowrap'; fr.appendChild(fq)
        const nt = rich('العدد الفردي ذو الترتيب $n$ هو $2n-1$', 's'); c.body.appendChild(nt)
        nt.style.color = C.blu; nt.style.fontSize = '38px'; nt.style.marginTop = '10px'
        this.pin1 = el('div', '', '📌', root)
        this.pin1.style.cssText += 'font-size:40px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))'
        place(this.pin1, PIN.x + 12, PIN.y + 2, { anchor: 'c' })
      }

      // ---------- line 0: the 7×7 square (left), the book page 6, the induction definition ----------
      const s = svg(root, 0, 0, W, H)
      this.sq = sv(s, 'g')
      this.dots = []
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) this.dots.push({ c: sv(this.sq, 'circle', { cx: i * SP, cy: -j * SP, r: R, fill: C.pur }), i, j })
      this.sqGlow = sv(this.sq, 'rect', { x: -R - 22, y: -6 * SP - R - 22, width: 6 * SP + 2 * R + 44, height: 6 * SP + 2 * R + 44, rx: 40, fill: 'none', stroke: C.yel, 'stroke-width': 3, 'vector-effect': 'non-scaling-stroke' })

      const th6 = bookThumb(root, 6, 0, 0, 220, { x: .11, y: .37, w: .8, h: .115 })
      this.th6 = th6.el; this.th6.style.transformOrigin = '0 0'
      this.th6cap = chip(root, '📖 الكتاب ص 6 — انطلاقة نشطة', 0, 0, { anchor: 'br' })
      this.th6cap.style.cssText += 'font-size:24px;white-space:nowrap'
      this.th6cap2 = chip(root, '📖 الكتاب ص 6', 560, 812, { anchor: 'tc' })
      this.th6cap2.style.cssText += 'font-size:24px;white-space:nowrap'

      this.h0 = heading(root, 'التجربة والملاحظة والاستقراء')

      const dc = card(root, 'def', 1800, 330, 1000, { anchor: 'tr' })
      this.defCard = dc.el
      this.defTxt = rich('<span class="pur b">الاستقراء:</span> استخلاص نتائج عامة من النظر في حالات خاصة', 'h3')
      dc.body.appendChild(this.defTxt); splitWords(this.defTxt)

      this.chips = el('div', '', null, root)
      place(this.chips, 1800, 584, { anchor: 'tr' })
      this.chips.style.cssText += 'display:flex;direction:rtl;align-items:center;gap:22px;white-space:nowrap;width:max-content'
      this.chipEls = ['ملاحظة', 'تجربة', 'استقراء'].map((t, i) => {
        if (i) { const d = el('div', '', '·', this.chips); d.style.cssText = `font-size:44px;font-weight:900;color:${C.dim}`; this.chips['dot' + i] = d }
        const c = el('div', 'chip', t, this.chips)
        c.style.cssText += 'font-size:36px;padding:12px 34px'
        return c
      })

      this.penRow = el('div', '', null, root)
      place(this.penRow, 1800, 700, { anchor: 'tr' })
      this.penRow.style.cssText += 'display:flex;direction:rtl;align-items:center;gap:30px;width:max-content'
      const ps = document.createElementNS(NS, 'svg')
      ps.setAttribute('width', 128); ps.setAttribute('height', 128); ps.setAttribute('viewBox', '0 0 128 128'); ps.style.flex = 'none'
      this.penRow.appendChild(ps)
      this.paper = sv(ps, 'path', { d: 'M22,14 L84,14 L104,34 L104,114 L22,114 Z M84,14 L84,34 L104,34', fill: 'rgba(238,242,255,.06)', stroke: C.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' })
      this.plines = [44, 60, 76, 92].map((y, i) => sv(ps, 'path', { d: `M36,${y} L${i === 3 ? 66 : 90},${y}`, stroke: C.mut, 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' }))
      this.pencil = sv(ps, 'g', {})
      sv(this.pencil, 'path', { d: 'M70,98 L112,56 L122,66 L80,108 Z', fill: C.yel, stroke: '#0b1020', 'stroke-width': 2.5, 'stroke-linejoin': 'round' })
      sv(this.pencil, 'path', { d: 'M112,56 L117,51 Q120,48 124,52 L127,55 Q130,59 127,62 L122,66 Z', fill: C.red, stroke: '#0b1020', 'stroke-width': 2.5, 'stroke-linejoin': 'round' })
      sv(this.pencil, 'path', { d: 'M70,98 L64,114 L80,108 Z', fill: '#f5d7a1', stroke: '#0b1020', 'stroke-width': 2.5, 'stroke-linejoin': 'round' })
      sv(this.pencil, 'path', { d: 'M64,114 L66.5,107.5 L70.5,111.5 Z', fill: '#0b1020' })
      this.penCap = rich('لا تتطلّب تجهيزات مكلفة… بل مجرّد <span class="yel b">قلم وورقة</span>', 'p')
      this.penCap.style.whiteSpace = 'nowrap'
      this.penRow.appendChild(this.penCap)

      this.proof = chip(root, 'الإثبات؟ ← <span style="color:#0b1020">هذه الوحدة</span>', 1800, 876, { anchor: 'tr', color: C.yel })
      this.proof.style.cssText += `font-size:36px;padding:12px 32px;white-space:nowrap;background:rgba(255,210,63,.16)`
      this.proof.querySelector('span').style.cssText = `color:#0b1020;background:${C.yel};padding:2px 16px;border-radius:999px`

      // ---------- line 1: title ----------
      this.over = rich('الوحدة الأولى: تذكرة بالمتتاليات، والإثبات بالتدريج', 's')
      this.over.style.cssText += `color:${C.pur};font-weight:800;white-space:nowrap;letter-spacing:.3px`
      root.appendChild(this.over)
      this.ttl = el('div', 'abs ar', null, root)
      place(this.ttl, 1800, 150, { anchor: 'tr' })
      this.ttl.style.width = 'max-content'
      this.ttl.style.transformOrigin = '100% 0'
      const tr = el('div', '', null, this.ttl)
      tr.style.cssText = 'display:flex;direction:rtl;align-items:center;gap:24px'
      this.badge = el('div', '', '1', tr)
      this.badge.style.cssText = `width:78px;height:78px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:50px;font-weight:900;color:#0b1020;background:radial-gradient(circle at 34% 30%,#fff6c4 0%,${C.yel} 42%,#d99a00 100%);box-shadow:0 0 30px rgba(255,210,63,.45)`
      this.ttlTxt = rich('عموميّات عن المتتاليات', 'h2'); tr.appendChild(this.ttlTxt)
      this.ttlBar = el('div', '', null, this.ttl)
      this.ttlBar.style.cssText = `height:6px;width:120px;border-radius:3px;margin:14px 0 0 auto;background:${C.pur};transform-origin:100% 50%`
      const th7 = bookThumb(root, 7, 1580, 664, 220, { x: .47, y: .09, w: .4, h: .065 })
      this.th7 = th7.el
      this.th7cap = chip(root, '📖 الكتاب ص 7', 1800, 646, { anchor: 'br' })
      this.th7cap.style.cssText += 'font-size:24px;white-space:nowrap'

      // ---------- line 2: roadmap ----------
      const labels = [
        '<span class="blu">1.1</span> ما المتتالية؟ وكيف نعرّفها',
        '<span class="blu">2.1</span> جهة الاطّراد',
        '<span class="blu">3.1</span> المتتالية الحسابيّة',
        '<span class="blu">4.1</span> المتتالية الهندسيّة',
        '💡 مطابقة مفيدة',
        'تكريساً للفهم: ثلاث طرائق',
        'تدرَّبْ: ثلاثة تمارين محلولة',
      ]
      this.rm = el('div', '', null, root)
      place(this.rm, 0, 0, { w: W, h: H })
      this.rm.style.transformOrigin = '1380px 66px'
      const RX = 1310, Y0 = 420, DY = 84
      this.RX = RX; this.Y0 = Y0
      const rs = svg(this.rm, 0, 0, W, H)
      this.rail = sv(rs, 'path', { d: `M${RX},${Y0} L${RX},${Y0 + 6 * DY}`, stroke: C.line, 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' })
      this.stops = labels.map((h, i) => {
        const y = Y0 + i * DY
        const lab = rich(h, 'h3'); lab.style.whiteSpace = 'nowrap'; lab.style.fontSize = '42px'
        this.rm.appendChild(lab); place(lab, RX - 110, y, { anchor: 'cr' })
        const ig = sv(rs, 'g', { transform: `translate(${RX - 82} ${y - 30})`, fill: 'none', stroke: C.ink, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
        ICONS[i](ig)
        if (i === 5) [[11.5, 45], [29.5, 37], [47.5, 29]].forEach(([x, y2], k) => { const t = sv(ig, 'text', { x, y: y2, 'font-size': 12, 'font-weight': 800, 'text-anchor': 'middle', fill: C.ink, stroke: 'none' }); t.textContent = k + 1 })
        const dot = sv(rs, 'circle', { cx: RX, cy: y, r: 10, fill: C.bg, stroke: C.dim, 'stroke-width': 4 })
        return { lab, ig, dot, y }
      })

      // ---------- line 3: the number 7 ----------
      this.seven = tex('7', 'mxl')
      this.seven.style.cssText += `font-size:210px;color:${C.yel}`
      root.appendChild(this.seven); place(this.seven, 1500, 430, { anchor: 'c' })
      this.lock = chip(root, '🔒 سؤال مفتوح ②', 1500, 566, { anchor: 'tc', color: C.pur })
      this.lock.style.cssText += 'font-size:30px;white-space:nowrap;padding:10px 26px'
      // card ② (pinned next to card ①), built large and scaled like card ①
      {
        const c = card(root, 'def', 0, 0, 420, { tag: '🔒 سؤال مفتوح ②' })
        this.card2 = c.el
        c.el.style.padding = '42px 30px 26px'
        c.el.style.transformOrigin = '0 0'
        const f = tex('7', 'mxl'); f.style.cssText += `font-size:170px;color:${C.yel};text-shadow:0 0 30px rgba(255,210,63,.45);display:block;text-align:center;line-height:1.05`
        c.body.appendChild(f)
        c.body.style.textAlign = 'center'
        this.card2body = c.body
      }
      this.pin2 = el('div', '', '📌', root)
      this.pin2.style.cssText += 'font-size:40px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))'
    },

    measure() {
      const root = this.root
      // card ① height → card ② gets the same height so both pinned cards line up
      this.card1.style.transform = 'none'
      const r1 = rectIn(this.card1, root)
      this.card1.style.transform = `translate(${PIN.x - 410}px, ${PIN.y - 196}px) scale(${PS})`
      this.card2.style.height = r1.h + 'px'
      this.card2.style.display = 'flex'; this.card2.style.alignItems = 'center'; this.card2.style.justifyContent = 'center'
      this.c2 = { w: 420, h: r1.h, x: PIN.x + (r1.w + 40) * PS, y: PIN.y }
      place(this.card2, this.c2.x, this.c2.y)
      place(this.pin2, this.c2.x + 12, this.c2.y + 2, { anchor: 'c' })
      // title box
      this.ttl.style.transform = 'none'
      const rt = rectIn(this.ttl, root)
      this.tt = { w: rt.w, h: rt.h }
      place(this.over, W / 2, 530 - .75 * rt.h - 38, { anchor: 'bc' })
      this._ok = fontsOK()
    },

    render(lt, S) {
      if (!this._ok) this.measure()
      const T = this.T
      const clr1 = S.p(lt, 1, 0, .6)                 // line 1: board clears

      // ----- pinned cards (always) -----
      this.card1.style.boxShadow = `0 30px 80px rgba(0,0,0,.35), 0 0 ${30 + 14 * Math.sin(lt * 1.3)}px rgba(167,139,250,.2)`

      // ----- square: from s01's end (centre, small) to the left column -----
      {
        const m = prog(lt, .15, 1.3, E.io)
        const cx = lerp(960, 265, m), cy = lerp(718, 602, m), sc = lerp(.30, .37, m)
        const out = clr1
        this.sq.setAttribute('transform', `translate(${cx} ${cy}) scale(${sc * lerp(1, .9, out)}) translate(-300 300)`)
        this.sq.style.opacity = 1 - out
        const pulse = env(lt, S.at(0) + .1, S.at(0) + 2.2, .4, .8)
        this.sqGlow.style.opacity = pulse * (.6 + .4 * Math.sin(lt * 6))
        this.dots.forEach(d => {
          const wv = .5 + .5 * Math.sin(lt * 1.7 - (d.i + d.j) * .55)
          d.c.setAttribute('fill', mixColor(C.pur, '#c9bcff', .3 * wv + .5 * pulse))
        })
      }
      // ----- page 6 thumbnail: from bottom-right (s01's end) to beside the square -----
      {
        const m = prog(lt, .25, 1.3, E.io)
        const x = lerp(1580, 430, m), y = lerp(664, 430, m), sc = lerp(1, 260 / 220, m)
        this.th6.style.transform = `translate(${x}px, ${y}px) scale(${sc}) translateY(${-clr1 * 20}px)`
        op(this.th6, 1 - clr1)
        op(this.th6cap, 1 - prog(lt, .1, .4)); place(this.th6cap, 1800, 646, { anchor: 'br' })
        const c2 = prog(lt, 1.2, .5) * (1 - clr1)
        op(this.th6cap2, c2); this.th6cap2.style.transform = `translateY(${(1 - c2) * 12}px)`
      }
      // ----- heading, definition, chips, pencil, proof tag -----
      this.h0.set(prog(lt, .3, .7) * (1 - clr1))
      {
        const a = prog(lt, T.def, .6) * (1 - clr1)
        rise(this.defCard, a, 30)
        typeWords(this.defTxt, prog(lt, T.def + .2, Math.max(1.2, T.defEnd - T.def - .4), E.lin))
      }
      ;[T.c1, T.c2, T.c3].forEach((t, i) => {
        const c = this.chipEls[i]
        const a = prog(lt, t, .5, E.out) * (1 - clr1)
        op(c, a); c.style.transform = `scale(${lerp(.7, 1, E.back(clamp(prog(lt, t, .5))))})`
        const nowY = env(lt, t, (i < 2 ? [T.c2, T.c3][i] : T.pen) + .1, .2, .4)
        const base = i === 2 ? C.pur : C.ink
        const col = mixColor(base === C.pur ? C.pur : '#eef2ff', C.yel, nowY)
        c.style.color = col
        c.style.borderColor = i === 2 ? `rgba(167,139,250,${.5 + .5 * nowY})` : `rgba(255,210,63,${(.15 + .7 * nowY).toFixed(2)})`
        c.style.background = i === 2 ? 'rgba(167,139,250,.14)' : `rgba(255,210,63,${(.05 + .1 * nowY).toFixed(3)})`
        if (i) op(this.chips['dot' + i], a)
      })
      {
        const a = prog(lt, T.pen, .5) * (1 - clr1)
        op(this.penRow, a)
        this.penRow.style.transform = `translateY(${(1 - a) * 20}px)`
        draw(this.paper, prog(lt, T.pen, .8))
        this.paper.style.fillOpacity = prog(lt, T.pen + .5, .4)
        this.plines.forEach((l, i) => draw(l, prog(lt, T.pen + .5 + i * .18, .35)))
        const pp = prog(lt, T.pen + .3, .7, E.out)
        const wig = Math.sin(lt * 7) * 2 * clamp(prog(lt, T.pen + .5, .2)) * (1 - prog(lt, T.pen + 1.3, .3))
        this.pencil.setAttribute('transform', `translate(${(1 - pp) * 40 + wig} ${(1 - pp) * -40})`)
        this.pencil.style.opacity = pp
      }
      {
        const a = prog(lt, T.tag, .6) * (1 - clr1)
        op(this.proof, a)
        const gl = .5 + .5 * Math.sin(lt * 2.6)
        this.proof.style.transform = `translateX(${(1 - E.out(clamp(prog(lt, T.tag, .6)))) * 40}px)`
        this.proof.style.boxShadow = `0 0 ${18 + 16 * gl * a}px rgba(255,210,63,${(.25 * a).toFixed(2)})`
      }

      // ----- line 1: title card -----
      {
        const a = S.p(lt, 1, .25, .8, E.out)
        const up = S.p(lt, 2, 0, .9, E.io)              // line 2: title moves up into the heading slot
        const { w, h } = this.tt
        const big = 1.5
        const dx = 960 + big * w / 2 - 1800, dy = 530 - big * h / 2 - 150
        const s2 = lerp(big, 1, up)
        this.ttl.style.transform = `translate(${dx * (1 - up)}px, ${dy * (1 - up) + (1 - a) * 30}px) scale(${s2})`
        op(this.ttl, a)
        const bp = S.p(lt, 1, .1, .7)
        this.badge.style.transform = `scale(${lerp(.3, 1, E.back(bp))}) rotate(${(1 - bp) * -90}deg)`
        op(this.ttlBar, up > .95 ? 1 : 0)
        this.ttlBar.style.transform = `scaleX(${E.out(clamp(S.p(lt, 2, .7, .6)))})`
        const o = S.p(lt, 1, 0, .6) * (1 - S.p(lt, 2, 0, .4))
        op(this.over, o); this.over.style.transform = `translateY(${(1 - o) * 14}px)`
        const t7 = S.p(lt, 1, .6, .7, E.out) * (1 - S.p(lt, 2, 0, .5))
        op(this.th7, t7); this.th7.style.transform = `translateX(${(1 - t7) * 60}px)`
        op(this.th7cap, t7); this.th7cap.style.transform = `translateX(${(1 - t7) * 60}px)`
      }

      // ----- line 2: roadmap -----
      {
        const railP = S.p(lt, 2, .4, 1.2)
        draw(this.rail, railP)
        const flash = env(lt, T.fly - .45, T.fly + .1, .15, .3)
        const sh = prog(lt, T.shrink, .8, E.in)
        this.rm.style.transform = `scale(${lerp(1, .04, sh)})`
        this.rm.style.opacity = 1 - prog(lt, T.shrink + .3, .5)
        this.stops.forEach((st, i) => {
          const a = prog(lt, T.stop[i], .5, E.out)
          op(st.lab, a); st.lab.style.transform = `translateX(${(1 - a) * -30}px)`
          st.ig.style.opacity = a
          const now = i < 6 ? env(lt, T.stop[i], T.stop[i + 1], .15, .3) : env(lt, T.stop[i], T.stop[i] + 1.6, .15, .5)
          const hi = Math.max(now, flash)
          st.lab.style.color = mixColor('#eef2ff', C.yel, hi)
          st.ig.setAttribute('stroke', mixColor('#eef2ff', C.yel, hi))
          st.dot.setAttribute('fill', a > .5 ? mixColor('#25305a', C.yel, Math.max(hi, .0)) : C.bg)
          st.dot.setAttribute('stroke', a > 0 ? mixColor('#9aa8c9', C.yel, hi) : C.dim)
          st.dot.setAttribute('r', 10 + 4 * hi)
          st.dot.style.opacity = Math.max(railP > (i / 6) ? 1 : 0, a)
          st.lab.style.textShadow = hi > .05 ? `0 0 ${24 * hi}px rgba(255,210,63,.5)` : 'none'
        })
      }

      // ----- line 3: the 7 drops, gets a lock, a copy is pinned next to card ① -----
      {
        const d = prog(lt, T.seven, .75, E.out)
        const bounce = d < 1 ? (1 - E.back(d)) : 0
        const sh = prog(lt, T.shrink, .8, E.in)
        op(this.seven, Math.min(clamp(d * 3), 1 - prog(lt, T.shrink + .2, .5)))
        const gl = .5 + .5 * Math.sin(lt * 3.2)
        this.seven.style.textShadow = `0 0 ${40 + 30 * gl}px rgba(255,210,63,.6)`
        const sx = lerp(0, 1380 - 1500, sh), sy = lerp(0, 66 - 430, sh)
        this.seven.style.transform = `translate(${sx}px, ${(d >= 1 ? 0 : -420 * (1 - E.out(d))) + sy}px) scale(${lerp(1, .1, sh) * (1 + .03 * gl * clamp(d))}) translateY(${bounce * -20}px)`
        const c = prog(lt, T.chip, .5, E.back)
        const pulse = 1 + .05 * Math.sin((lt - T.chip) * 6) * clamp(prog(lt, T.chip + .4, .3))
        op(this.lock, Math.min(clamp(c * 2), 1 - prog(lt, T.shrink + .2, .5)))
        this.lock.style.transform = `translate(${lerp(0, 1380 - 1500, sh)}px, ${lerp(0, 66 - 566, sh)}px) scale(${lerp(.6, 1, c) * pulse * lerp(1, .1, sh)})`
        this.lock.style.boxShadow = `0 0 ${20 * (pulse - .95) * 10}px rgba(167,139,250,.5)`
        // the copy flies to the corner
        const f = prog(lt, T.fly, .9, E.io)
        const { w, h, x, y } = this.c2
        const x0 = 1500 - w / 2, y0 = 470 - h / 2
        const s = lerp(1, PS, f)
        this.card2.style.transform = `translate(${lerp(x0 - x, 0, f)}px, ${lerp(y0 - y, 0, f)}px) scale(${s})`
        op(this.card2, f > 0 ? Math.min(1, f * 3) : 0)
        this.card2body.style.opacity = 1
        this.card2.style.boxShadow = `0 30px 80px rgba(0,0,0,.35), 0 0 ${30 + 14 * Math.sin(lt * 1.3)}px rgba(167,139,250,.2)`
        const pi = prog(lt, T.fly + .8, .45)
        op(this.pin2, pi)
        this.pin2.style.transform = `translateY(${(1 - E.back(pi)) * -30}px) rotate(${(1 - pi) * -30}deg)`
      }
    },
  }
})())

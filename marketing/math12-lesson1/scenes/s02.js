// s02 — lesson title → roadmap → open question ② (the number 7).
// Older timelines still carry the bridge (induction, page 6) as this scene's line 0; it is then played here first,
// with the shared builders from s01 (SCENES.s01.LIB). With the current script the bridge ends s01.
scene('s02', (() => {
  const SP = 100, R = 34

  // tiny line icons for the roadmap (60×60)
  const ICONS = [
    // machine
    g => { sv(g, 'rect', { x: 10, y: 20, width: 40, height: 26, rx: 6 }); sv(g, 'path', { d: 'M18,6 L42,6 L34,18 L26,18 Z' }); sv(g, 'path', { d: 'M30,46 L30,57 M25,52 L30,57 L35,52' }) },
    // loop pipe (a term fed back in)
    g => { sv(g, 'path', { d: 'M4,46 L40,46 Q54,46 54,32 Q54,14 38,14 L20,14' }); sv(g, 'path', { d: 'M27,7 L20,14 L27,21' }); sv(g, 'circle', { cx: 12, cy: 46, r: 3.5, fill: 'currentColor' }) },
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
  const LABELS = [
    'ما المتتالية؟',
    '<span class="blu">1.1</span> تعريف متتالية',
    '<span class="blu">2.1</span> جهة اطّراد متتالية',
    '<span class="blu">3.1</span> المتتالية الحسابيّة',
    '<span class="blu">4.1</span> المتتالية الهندسيّة',
    '💡 مطابقة مفيدة',
    'تكريساً للفهم: ثلاث طرائق',
    'تدرَّبْ: ثلاثة تمارين محلولة',
  ]
  const NEEDLES = [['ما المتتالية'], null, ['وجهة', 'جهة'], ['والحسابية'], ['والهندسية'], ['ومطابقة'], ['وثلاث طرائق'], ['وثلاثة تمارين']]
  const RX = 1400, Y0 = 336, DY = 80           // roadmap rail (labels to its left: RTL list)

  return {
    build(root, S) {
      const LIB = SCENES.s01.LIB
      const { cue, PS, PIN } = LIB
      this.LIB = LIB
      this.root = root
      // line indices: older timelines put the bridge first
      const o = this.o = S.lines.length >= 4 || LIB.bridgeLine(S) === 0 ? 1 : 0
      const LT = this.LT = o, LR = this.LR = o + 1, L7 = this.L7 = o + 2
      const T = this.T = {}
      // roadmap stops («ما المتتالية؟» and «1.1» light together)
      T.stop = []
      for (let i = 0; i < 8; i++) {
        if (i === 1) { T.stop[1] = T.stop[0] + .15; continue }
        const prev = i ? T.stop[i - 1] + .4 : S.at(LR) + .7
        T.stop[i] = Math.max(prev, cue(S, LR, NEEDLES[i], .1 + Math.max(0, i - 1) * .12))
      }
      // the number 7
      T.seven = Math.max(S.at(L7) + .25, cue(S, L7, ['لغز'], .27))
      T.chip = Math.min(Math.max(T.seven + .6, cue(S, L7, ['بطله'], .5) - .1), T.seven + 1)
      T.fly = Math.min(T.chip + .9, S.dur - 2.3)
      T.glow = T.fly + .45
      T.shrink = T.glow + .4

      // ---------- pinned card ① (identical to s01's end state) ----------
      const c1 = LIB.card1(root)
      this.card1 = c1.el
      this.card1.style.transform = c1.pinned

      // ---------- (older timelines) line 0: the bridge, from s01's end state ----------
      if (o) {
        const s = svg(root, 0, 0, W, H)
        this.sq = sv(s, 'g')
        this.dots = []
        for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) this.dots.push({ c: sv(this.sq, 'circle', { cx: i * SP, cy: -j * SP, r: R, fill: C.pur }), i, j })
        this.sqGlow = sv(this.sq, 'rect', { x: -R - 22, y: -6 * SP - R - 22, width: 6 * SP + 2 * R + 44, height: 6 * SP + 2 * R + 44, rx: 40, fill: 'none', stroke: C.yel, 'stroke-width': 3, 'vector-effect': 'non-scaling-stroke' })
        const th6 = bookThumb(root, 6, 0, 0, 220, { x: .11, y: .37, w: .8, h: .115 })
        this.th6 = th6.el; this.th6.style.transformOrigin = '0 0'
        this.th6cap = chip(root, '📖 الكتاب ص 6 — انطلاقة نشطة', 1800, 646, { anchor: 'br' })
        this.th6cap.style.cssText += 'font-size:24px;white-space:nowrap'
        this.th6cap2 = chip(root, '📖 الكتاب ص 6', 560, 812, { anchor: 'tc' })
        this.th6cap2.style.cssText += 'font-size:24px;white-space:nowrap'
        this.br = LIB.bridgeUI(root, S, 0, { h0: .3, defMin: .8 })
      }

      // ---------- title ----------
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

      // ---------- roadmap ----------
      this.rm = el('div', '', null, root)
      place(this.rm, 0, 0, { w: W, h: H })
      this.rm.style.transformOrigin = '1380px 66px'          // the section name in the breadcrumb
      const rs = svg(this.rm, 0, 0, W, H)
      this.railGlow = sv(rs, 'circle', { cx: RX, cy: Y0, r: 14, fill: C.yel, opacity: 0 }); this.railGlow.style.filter = 'blur(5px)'
      this.rail = sv(rs, 'path', { d: `M${RX},${Y0} L${RX},${Y0 + 7 * DY}`, stroke: C.line, 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' })
      this.stops = LABELS.map((h, i) => {
        const y = Y0 + i * DY
        const lab = rich(h, 'h3'); lab.style.whiteSpace = 'nowrap'; lab.style.fontSize = '42px'
        this.rm.appendChild(lab); place(lab, RX - 110, y, { anchor: 'cr' })
        const ig = sv(rs, 'g', { transform: `translate(${RX - 82} ${y - 30})`, fill: 'none', stroke: C.ink, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
        ICONS[i](ig)
        if (i === 6) [[11.5, 45], [29.5, 37], [47.5, 29]].forEach(([x, y2], k) => { const t = sv(ig, 'text', { x, y: y2, 'font-size': 12, 'font-weight': 800, 'text-anchor': 'middle', fill: C.ink, stroke: 'none' }); t.textContent = k + 1 })
        const dot = sv(rs, 'circle', { cx: RX, cy: y, r: 10, fill: C.bg, stroke: C.dim, 'stroke-width': 4 })
        return { lab, ig, dot, y }
      })

      // ---------- the number 7 (beside stop 1.1; it belongs to the roadmap and leaves with it) ----------
      this.seven = tex('7', 'mxl')
      this.seven.style.cssText += `font-size:210px;color:${C.yel}`
      this.rm.appendChild(this.seven)
      this.lock = chip(this.rm, '🔒 سؤال مفتوح ②', 0, 0, { anchor: 'cr', color: C.pur })
      this.lock.style.cssText += 'font-size:30px;white-space:nowrap;padding:10px 26px'
      // card ② (a copy of the 7 that flies to the corner and is pinned under card ①), built large like card ①
      {
        const c = card(root, 'def', 0, 0, 420, { tag: '🔒 سؤال مفتوح ②' })
        this.card2 = c.el
        c.el.style.padding = '42px 30px 26px'
        c.el.style.transformOrigin = '0 0'
        const f = tex('7', 'mxl'); f.style.cssText += `font-size:170px;color:${C.yel};text-shadow:0 0 30px rgba(255,210,63,.45);display:block;text-align:center;line-height:1.05`
        c.body.appendChild(f)
        this.card2seven = f
        this.card2tag = c.el.querySelector('.tag')
        c.body.style.textAlign = 'center'
      }
      this.pin2 = el('div', '', '📌', root)
      this.pin2.style.cssText += 'font-size:40px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))'
    },

    measure() {
      const root = this.root, { PS, PIN } = this.LIB
      // card ① height → card ② goes right under it (same as s26)
      const t1 = this.card1.style.transform
      this.card1.style.transform = 'none'
      const r1 = rectIn(this.card1, root)
      this.card1.style.transform = t1
      this.card2.style.transform = 'none'
      const r2 = rectIn(this.card2, root)
      const r7 = rectIn(this.card2seven, root)
      this.c2 = { w: r2.w, h: r2.h, x: PIN.x, y: PIN.y + r1.h * PS + 30, ox: r7.cx - r2.x, oy: r7.cy - r2.y }
      place(this.card2, this.c2.x, this.c2.y)
      place(this.pin2, this.c2.x + 12, this.c2.y + 2, { anchor: 'c' })
      // the 7 lands left of stops 0–2 (beside «1.1»), its lock chip to its left
      this.rm.style.transform = 'none'
      this.stops.forEach(s => { s.lab.style.transform = 'none' })
      const left = Math.min(...[0, 1, 2].map(i => rectIn(this.stops[i].lab, root).x))
      this.sevenAt = { x: left - 90, y: this.stops[1].y + 6 }
      place(this.seven, this.sevenAt.x, this.sevenAt.y, { anchor: 'c' })
      place(this.lock, this.sevenAt.x - 74, this.stops[1].y, { anchor: 'cr' })
      // title box
      this.ttl.style.transform = 'none'
      const rt = rectIn(this.ttl, root)
      this.tt = { w: rt.w, h: rt.h }
      place(this.over, W / 2, 530 - .75 * rt.h - 38, { anchor: 'bc' })
      this._ok = this.LIB.fontsOK()
    },

    render(lt, S) {
      if (!this._ok) this.measure()
      const T = this.T, { LT, LR, L7 } = this
      const clr = this.o ? S.p(lt, LT, 0, .45) : 0     // older timelines: the bridge clears for the title

      // ----- pinned card ① (always) -----
      this.card1.style.boxShadow = `0 30px 80px rgba(0,0,0,.35), 0 0 ${30 + 14 * Math.sin(lt * 1.3)}px rgba(167,139,250,.2)`

      // ----- (older timelines) the bridge -----
      if (this.o) {
        {
          const m = prog(lt, .15, 1.3, E.io)
          const cx = lerp(960, 265, m), cy = lerp(718, 602, m), sc = lerp(.30, .37, m)
          this.sq.setAttribute('transform', `translate(${cx} ${cy}) scale(${sc * lerp(1, .9, clr)}) translate(-300 300)`)
          this.sq.style.opacity = 1 - clr
          const pulse = env(lt, S.at(0) + .1, S.at(0) + 2.2, .4, .8)
          this.sqGlow.style.opacity = pulse * (.6 + .4 * Math.sin(lt * 6))
          this.dots.forEach(d => {
            const wv = .5 + .5 * Math.sin(lt * 1.7 - (d.i + d.j) * .55)
            d.c.setAttribute('fill', mixColor(C.pur, '#c9bcff', .3 * wv + .5 * pulse))
          })
        }
        {
          const m = prog(lt, .25, 1.3, E.io)
          const x = lerp(1580, 430, m), y = lerp(664, 430, m), sc = lerp(1, 260 / 220, m)
          this.th6.style.transform = `translate(${x}px, ${y}px) scale(${sc}) translateY(${-clr * 20}px)`
          op(this.th6, 1 - clr)
          op(this.th6cap, 1 - prog(lt, .1, .4))
          const c2 = prog(lt, 1.2, .5) * (1 - clr)
          op(this.th6cap2, c2); this.th6cap2.style.transform = `translateY(${(1 - c2) * 12}px)`
        }
        this.br.render(lt, clr)
      }

      // ----- title -----
      {
        const a = S.p(lt, LT, .4, .8, E.out)
        const up = S.p(lt, LR, 0, .9, E.io)              // the title moves up into the heading slot
        const { w, h } = this.tt
        const big = 1.5
        const dx = 960 + big * w / 2 - 1800, dy = 530 - big * h / 2 - 150
        const s2 = lerp(big, 1, up)
        const breathe = 1 + .008 * Math.sin(lt * 1.6) * (1 - up)
        this.ttl.style.transform = `translate(${dx * (1 - up)}px, ${dy * (1 - up) + (1 - a) * 30}px) scale(${s2 * breathe})`
        op(this.ttl, a)
        const bp = S.p(lt, LT, .1, .7)
        this.badge.style.transform = `scale(${lerp(.3, 1, E.back(bp))}) rotate(${(1 - bp) * -90}deg)`
        this.badge.style.boxShadow = `0 0 ${30 + 14 * Math.sin(lt * 2.2)}px rgba(255,210,63,.45)`
        op(this.ttlBar, up > .95 ? 1 : 0)
        this.ttlBar.style.transform = `scaleX(${E.out(clamp(S.p(lt, LR, .7, .6)))})`
        const ov = S.p(lt, LT, .3, .6) * (1 - S.p(lt, LR, 0, .4))
        op(this.over, ov); this.over.style.transform = `translateY(${(1 - ov) * 14}px)`
        const t7 = S.p(lt, LT, .6, .7, E.out) * (1 - S.p(lt, LR, 0, .5))
        op(this.th7, t7); this.th7.style.transform = `translateX(${(1 - t7) * 60}px)`
        op(this.th7cap, t7); this.th7cap.style.transform = `translateX(${(1 - t7) * 60}px)`
      }

      // ----- roadmap -----
      {
        const railP = S.p(lt, LR, .4, 1.2)
        draw(this.rail, railP)
        // gentle life once every stop is on the map: a soft light travels down the rail
        {
          const t0 = T.stop[7] + 1.4, per = 2.8
          const ph = lt > t0 ? ((lt - t0) % per) / per : 0
          this.railGlow.setAttribute('cy', Y0 + 7 * DY * E.sine(ph))
          this.railGlow.setAttribute('opacity', lt > t0 ? (.55 * Math.sin(Math.PI * ph)) * (1 - prog(lt, T.seven - .3, .3)) : 0)
        }
        const flash = env(lt, T.glow, T.glow + .5, .15, .3)
        const sh = prog(lt, T.shrink, .75, E.in)
        this.rm.style.transform = `scale(${lerp(1, .04, sh)})`
        this.rm.style.opacity = 1 - prog(lt, T.shrink + .1, .5)
        this.stops.forEach((st, i) => {
          const a = prog(lt, T.stop[i], .5, E.out)
          op(st.lab, a); st.lab.style.transform = `translateX(${(1 - a) * -30}px)`
          st.ig.style.opacity = a
          const until = i === 7 ? T.stop[7] + 1.6 : T.stop[i < 2 ? 2 : i + 1]
          const now = env(lt, T.stop[i < 2 ? 0 : i], until, .15, .3)
          const hi = Math.max(now, flash)
          st.lab.style.color = mixColor('#eef2ff', C.yel, hi)
          st.ig.setAttribute('stroke', mixColor('#eef2ff', C.yel, hi))
          st.ig.style.color = mixColor('#eef2ff', C.yel, hi)
          st.dot.setAttribute('fill', a > .5 ? mixColor('#25305a', C.yel, hi) : C.bg)
          st.dot.setAttribute('stroke', a > 0 ? mixColor('#9aa8c9', C.yel, hi) : C.dim)
          st.dot.setAttribute('r', 10 + 4 * hi)
          st.dot.style.opacity = Math.max(railP > (i / 7) ? 1 : 0, a)
          st.lab.style.textShadow = hi > .05 ? `0 0 ${24 * hi}px rgba(255,210,63,.5)` : 'none'
        })
      }

      // ----- the 7 drops beside stop 1.1, gets a lock; a copy flies to the corner as card ② -----
      {
        const d = prog(lt, T.seven, .7, E.out)
        const bounce = Math.sin(clamp(prog(lt, T.seven + .45, .45)) * Math.PI) * 10
        const gone = prog(lt, T.fly, .2)               // the 7 and its lock leave as card ② takes off from the same spot
        op(this.seven, clamp(d * 2.5) * (1 - gone))
        const gl = .5 + .5 * Math.sin(lt * 3.2)
        this.seven.style.textShadow = `0 0 ${40 + 30 * gl}px rgba(255,210,63,.6)`
        this.seven.style.transform = `translateY(${-110 * (1 - d) + bounce}px) scale(${1 + .03 * gl * d})`
        const c = prog(lt, T.chip, .5, E.back)
        const pulse = 1 + .05 * Math.sin((lt - T.chip) * 6) * clamp(prog(lt, T.chip + .4, .3))
        op(this.lock, clamp(c * 2) * (1 - gone))
        this.lock.style.transform = `translateX(${(1 - clamp(c)) * 24}px) scale(${lerp(.6, 1, c) * pulse})`
        this.lock.style.boxShadow = `0 0 ${Math.max(0, 20 * (pulse - .95) * 10)}px rgba(167,139,250,.5)`
        // card ②: starts exactly over the 7 (just the glyph), drops then glides left under card ①; its frame and
        // lock tag materialise on the way
        const fr = clamp((lt - T.fly) / .9), fx = E.io(fr), fy = E.out(fr)
        const { x, y, ox, oy } = this.c2
        const s0 = 210 / 170, s = lerp(s0, this.LIB.PS, fx)
        const tx = lerp(this.sevenAt.x - s0 * ox - x, 0, fx), ty = lerp(this.sevenAt.y - s0 * oy - y, 0, fy)
        this.card2.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`
        op(this.card2, fr > 0 ? 1 : 0)
        const k = E.io(clamp((fr - .3) / .55))
        this.card2.style.background = `linear-gradient(180deg,rgba(28,38,74,${(.92 * k).toFixed(3)}),rgba(20,29,56,${(.92 * k).toFixed(3)}))`
        this.card2.style.borderColor = `rgba(167,139,250,${(.65 * k).toFixed(3)})`
        op(this.card2tag, k)
        this.card2.style.boxShadow = `0 30px 80px rgba(0,0,0,${(.35 * k).toFixed(3)}), 0 0 ${30 + 14 * Math.sin(lt * 1.3)}px rgba(167,139,250,${(.2 * k).toFixed(3)})`
        const pi = prog(lt, T.fly + .8, .45)
        op(this.pin2, pi)
        this.pin2.style.transform = `translateY(${(1 - E.back(pi)) * -30}px) rotate(${(1 - pi) * -30}deg)`
      }
    },
  }
})())

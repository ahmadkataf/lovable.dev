// s05 · تعريف صريح — u_n given by a formula in n: (-1)^n/(n+1), u_n = f(n) with f(x)=√(x²+x+1), direct jump to u_100
(() => {
  const ID = 's05'
  let uid = 0

  // ---------- local kit: the «function machine» (with glass window), index balls, output cards ----------
  function machine(root, cx, cy, o = {}) {
    const w = o.w ?? 460, h = o.h ?? 260
    const g = el('div', '', null, root)
    g.style.cssText += `position:absolute;left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;z-index:5`
    const hs = svg(g, w / 2 - 100, -60, 200, 64)
    const gid = `${ID}-mg${++uid}`
    const lg = sv(sv(hs, 'defs'), 'linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 })
    sv(lg, 'stop', { offset: 0, 'stop-color': '#3d2d86' }); sv(lg, 'stop', { offset: 1, 'stop-color': '#2a1f63' })
    const hop = sv(hs, 'path', { d: 'M6,3 L194,3 L148,64 L52,64 Z', fill: `url(#${gid})`, stroke: C.pur, 'stroke-width': 3, 'stroke-linejoin': 'round' })
    sv(hs, 'ellipse', { cx: 100, cy: 8, rx: 84, ry: 5, fill: '#060a17', opacity: .9 })
    const chute = el('div', '', null, g)
    chute.style.cssText = `position:absolute;left:${w / 2 - 64}px;top:${h - 8}px;width:128px;height:36px;border-radius:0 0 16px 16px;background:linear-gradient(180deg,#2a1f63,#1d1648);border:3px solid ${C.pur};border-top:none`
    const mouth = el('div', '', null, chute)
    mouth.style.cssText = 'position:absolute;left:16px;right:16px;bottom:7px;height:7px;border-radius:4px;background:#060a17'
    const body = el('div', '', null, g)
    body.style.cssText = `position:absolute;inset:0;border-radius:34px;border:3px solid ${C.pur};background:linear-gradient(180deg,#31246f 0%,#1c1648 100%)`
    const win = el('div', '', null, body)
    win.style.cssText = `position:absolute;left:28px;right:28px;top:26px;bottom:52px;border-radius:18px;background:linear-gradient(180deg,rgba(6,10,26,.94),rgba(14,20,44,.94));border:2px solid rgba(167,139,250,.55);box-shadow:inset 0 0 26px rgba(56,189,248,.12);overflow:hidden`
    const sheen = el('div', '', null, win)
    sheen.style.cssText = 'position:absolute;top:-30%;bottom:-30%;width:46%;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.04) 30%,rgba(255,255,255,.085) 50%,rgba(255,255,255,.04) 70%,rgba(255,255,255,0) 100%);transform:skewX(-18deg);pointer-events:none;z-index:2'
    const tag = el('div', '', o.tag ?? 'تابع', g)
    tag.style.cssText = `position:absolute;top:-20px;right:26px;padding:4px 18px;border-radius:999px;font-size:24px;font-weight:800;color:#0b1020;background:${C.pur};z-index:3;white-space:nowrap`
    const lights = [0, 1, 2].map(i => {
      const d = el('div', '', null, body)
      d.style.cssText = `position:absolute;left:${30 + i * 24}px;bottom:18px;width:12px;height:12px;border-radius:50%;background:#43397a`
      return d
    })
    const views = []
    return {
      g, body, win,
      // a formula shown in the window; returns the element (toggle with view())
      addView(latex, cls = 'mm') {
        const v = tex(latex, cls)
        win.appendChild(v)
        v.style.cssText += 'position:absolute;left:50%;top:50%;translate:-50% -50%'
        op(v, 0); views.push(v)
        return v
      },
      set(lt, st = {}) {
        const jam = clamp(st.jam || 0), work = clamp(st.work || 0)
        const bc = jam > 0 ? mixColor(C.pur, C.red, jam) : C.pur
        body.style.borderColor = bc; chute.style.borderColor = bc; hop.setAttribute('stroke', bc)
        const glowA = .28 + .25 * work + .45 * jam
        const gc = jam > 0 ? `rgba(255,92,138,${glowA})` : `rgba(167,139,250,${glowA})`
        body.style.boxShadow = `0 0 ${46 + 40 * Math.max(work, jam)}px ${gc},inset 0 2px 0 rgba(255,255,255,.14),inset 0 -14px 30px rgba(0,0,0,.35)`
        win.style.borderColor = st.winGlow ? mixColor('#7e6cc0', C.yel, st.winGlow) : 'rgba(167,139,250,.55)'
        win.style.boxShadow = `inset 0 0 26px rgba(56,189,248,.12)` + (st.winGlow ? `,0 0 ${30 * st.winGlow}px rgba(255,210,63,${.45 * st.winGlow})` : '')
        lights.forEach((d, i) => {
          let c = '#43397a'
          if (jam > .05) c = C.red
          else if (work > .05 && Math.floor(lt * 9 + i * 1.3) % 3 === 0) c = C.grn
          d.style.background = c
          d.style.boxShadow = c === '#43397a' ? 'none' : `0 0 12px ${c}`
        })
        sheen.style.left = (((lt * .16) % 2.2) - .7) * 100 + '%'
        const shake = (st.shake || 0) * Math.sin(lt * 70) * 9
        const fl = Math.sin(lt * 1.3) * 3
        op(g, st.a ?? 1)
        g.style.transform = `translate(${shake}px,${fl}px) scale(${st.s ?? 1})`
      },
    }
  }
  function ball(root, txt, d = 76) {
    const b = el('div', '', null, root)
    b.style.cssText = `position:absolute;left:0;top:0;width:${d}px;height:${d}px;margin:${-d / 2}px 0 0 ${-d / 2}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${d * (txt.length > 2 ? .34 : .46)}px;color:#fff;direction:ltr;background:radial-gradient(circle at 34% 30%,#b9ecff 0%,#38bdf8 40%,#0369a1 100%);box-shadow:0 0 22px rgba(56,189,248,.55),inset 0 -6px 12px rgba(0,0,0,.25);z-index:4`
    b.textContent = txt
    return b
  }
  const putBall = (b, x, y, a = 1, s = 1) => { op(b, a); b.style.transform = `translate(${x}px,${y}px) scale(${s})` }
  function outCard(root, latex, cls = 'mm', col = C.yel) {
    const c = el('div', '', null, root)
    c.style.cssText = `position:absolute;left:0;top:0;translate:-50% -50%;padding:8px 22px;border-radius:16px;border:2.5px solid ${col};background:#1d1a14;box-shadow:0 0 24px ${col}55;z-index:4;color:${col};white-space:nowrap`
    c.appendChild(tex(latex, cls))
    return c
  }
  const putCard = (c, x, y, a = 1, s = 1) => { op(c, a); c.style.transform = `translate(${x}px,${y}px) scale(${s})` }
  const T = (S, i, f) => S.at(i) + f * (S.end(i) - S.at(i))
  const pp = (lt, t0, d = .6, e = E.io) => prog(lt, t0, d, e)
  const bez = (p0, p1, p2, t) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2

  const MX = 470, MY = 615, HOPY = MY - 130 - 62, CHY = MY + 130 + 26

  scene(ID, {
    build(root, S) {
      this.h = heading(root, '1.1 تعريف متتالية')

      // ---------- L0: card ① ----------
      const cd = card(root, 'def', 1800, 340, 1010, { anchor: 'tr', tag: 'الطريقة الأولى' })
      this.card = cd.el
      this.c1 = rich('① بتعريف صريح للحدّ ذي الدليل $n$', 'h3')
      this.c1.style.color = C.pur; this.c1.style.fontWeight = 800
      cd.body.appendChild(this.c1)
      this.c2 = rich('أي يُعرّف الحدُّ ذو الدليل $n$ بصيغة تتبع العدد $n$ تفيد في حسابه', 'p')
      this.c2.style.marginTop = '14px'
      cd.body.appendChild(this.c2)
      splitWords(this.c1); splitWords(this.c2)
      // highlight «بصيغة تتبع العدد n»
      const ws = this.c2._words
      const i0 = ws.findIndex(w => w.textContent === 'بصيغة')
      this.hlSpan = []
      if (i0 >= 0) for (let k = i0; k < i0 + 4 && k < ws.length; k++) this.hlSpan.push(ws[k])
      this.chip = chip(root, '① تعريف صريح', 1800, 272, { anchor: 'tr', color: C.pur })
      this.chip.style.whiteSpace = 'nowrap'

      // ---------- machine ----------
      this.balls1 = [0, 1, 2, 3].map(k => ball(root, String(k)))
      this.cards1 = ['1', '-\\tfrac{1}{2}', '\\tfrac{1}{3}', '-\\tfrac{1}{4}'].map(s => outCard(root, s, 'mm'))
      this.balls2 = [0, 1, 2].map(k => ball(root, String(k)))
      this.cards2 = ['1', '\\sqrt{3}', '\\sqrt{7}'].map(s => outCard(root, s, 'mm'))
      this.b100 = ball(root, '100', 98)
      this.c100 = outCard(root, 'u_{100}', 'mm')
      this.trail = (() => { const s = svg(root, 0, 0, W, H); s.style.zIndex = 3; return sv(s, 'path', { d: '', fill: 'none', stroke: C.blu, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: .55 }) })()
      this.M = machine(root, MX, MY, { w: 460, h: 260 })
      this.v0 = this.M.addView(`\\textcolor{${C.blu}}{n} \\;\\longmapsto\\; \\textcolor{${C.yel}}{u_n}`, 'mx')
      this.v1 = this.M.addView(`u_n = \\dfrac{(-1)^{n}}{n+1}`, 'mm')
      this.v2 = this.M.addView(`u_n = f(n)`, 'mx')
      this.v3 = this.M.addView(`u_{100} = f(100)`, 'mm')

      // ---------- L1: table + mini plot ----------
      const hdr = (l, c) => { const e = tex(l, 'mm'); e.style.color = c; return e }
      const rows = [[hdr('n', C.blu)], [hdr('u_n', C.yel)]]
      this.tn = []; this.tu = []
      const vals = ['1', '-\\dfrac{1}{2}', '\\dfrac{1}{3}', '-\\dfrac{1}{4}']
      for (let k = 0; k < 4; k++) {
        const a = tex(String(k), 'mm'); a.style.color = C.blu; rows[0].push(a); this.tn.push(a)
        const b = tex(vals[k], 'mm'); b.style.color = C.yel; rows[1].push(b); this.tu.push(b)
      }
      const tb = table(root, rows, 1800, 340, { headCol: true, anchor: 'tr' })
      this.tb = tb.el
      tb.cells.flat().forEach(td => { td.style.padding = '12px 26px'; td.style.minWidth = '150px'; td.style.height = '104px' })
      tb.cells[0].forEach(td => { td.style.height = '80px' })
      this.tdN = tb.cells[0].slice(1); this.tdU = tb.cells[1].slice(1)
      this.tdTargets = this.tdU.map(td => rectIn(td, root))
      this.colHL = this.tdN.map(td => hlBg(td, root, { color: 'rgba(56,189,248,.22)', pad: 0 }))

      const P = this.P = plot(root, 1010, 630, 780, 330, { xmin: -.7, xmax: 9.9, ymin: -.7, ymax: 1.18 })
      const { X, Y } = P
      this.pts = []
      for (let n = 0; n <= 9; n++) this.pts.push([X(n), Y((n % 2 ? -1 : 1) / (n + 1))])
      // envelope ±1/(n+1)
      let e1 = '', e2 = ''
      for (let k = 0; k <= 90; k++) { const x = k / 10; e1 += (k ? ' L' : 'M') + X(x) + ',' + Y(1 / (x + 1)) }
      for (let k = 5; k <= 90; k++) { const x = k / 10; e2 += (k > 5 ? ' L' : 'M') + X(x) + ',' + Y(-1 / (x + 1)) }
      this.env = [e1, e2].map(d => sv(P.s, 'path', { d, fill: 'none', stroke: C.pur, 'stroke-width': 2, 'stroke-dasharray': '7 9', opacity: 0 }))
      let zz = ''
      this.pts.forEach(([x, y], i) => { zz += (i ? ' L' : 'M') + x + ',' + y })
      this.zz = sv(P.s, 'path', { d: zz, fill: 'none', stroke: C.yel, 'stroke-width': 3, opacity: .7, 'stroke-linejoin': 'round' })
      this.zzLen = null
      this.dots = this.pts.map(([x, y]) => {
        const c = sv(P.s, 'circle', { cx: x, cy: y, r: 9, fill: C.yel })
        c.style.transformOrigin = `${x}px ${y}px`; c.style.filter = 'drop-shadow(0 0 6px rgba(255,210,63,.7))'
        return c
      })
      for (let n = 0; n <= 9; n += 1) {
        sv(P.s, 'line', { x1: X(n), y1: Y(0) - 6, x2: X(n), y2: Y(0) + 6, stroke: C.mut, 'stroke-width': 2 })
      }
      this.pl = []
      ;[0, 2, 4, 6, 8].forEach(n => { const l = P.label('', n, -.08, 'tc'); const t = tex(String(n), 'ms'); t.style.fontSize = '30px'; l.appendChild(t); l.style.color = C.blu; this.pl.push(l) })
      { const l = P.label('', 9.9, .02, 'bl'); l.appendChild(tex('n', 'ms')); l.style.color = C.blu; this.pl.push(l) }
      { const l = P.label('', .12, 1.2, 'bl'); l.appendChild(tex('u_n', 'ms')); l.style.color = C.yel; this.pl.push(l) }
      { sv(P.s, 'line', { x1: X(0) - 6, y1: Y(1), x2: X(0) + 6, y2: Y(1), stroke: C.mut, 'stroke-width': 2 }); const l = P.label('', -.3, 1, 'cr'); const t = tex('1', 'ms'); t.style.fontSize = '30px'; l.appendChild(t); this.pl.push(l) }
      this.to0 = rich('تقترب من $0$', 's'); P.layer.appendChild(this.to0); place(this.to0, X(9.6), Y(-.45), { anchor: 'cr' }); this.to0.style.whiteSpace = 'nowrap'; this.to0.style.color = C.pur; this.to0.style.fontSize = '28px'

      // ---------- L2: u_n = f(n), f on [0,+inf[ ----------
      this.lab2 = rich('حيث $f$ تابع معرّف على $[0,+\\infty[$', 'h3')
      root.appendChild(this.lab2); place(this.lab2, 1800, 352, { anchor: 'tr' }); this.lab2.style.whiteSpace = 'nowrap'
      this.lab2.querySelectorAll('bdi')[0].style.color = C.pur
      // domain [0,+inf[ as a purple ray; the indices n = 0, 1, 2, ... all live on it
      {
        const s = svg(root, 0, 0, W, H), y = 446, x0 = 1110, x1 = 1690
        this.rayBase = sv(s, 'line', { x1: x0 - 40, y1: y, x2: x1 + 20, y2: y, stroke: 'rgba(154,168,201,.35)', 'stroke-width': 2, opacity: 0 })
        this.ray = sv(s, 'path', { d: `M${x0},${y} L${x1},${y}`, fill: 'none', stroke: C.pur, 'stroke-width': 7, 'stroke-linecap': 'round' })
        this.ray0 = el('div', '', null, root); place(this.ray0, x0, y, { anchor: 'c', w: 18, h: 18 })
        this.ray0.style.cssText += `border-radius:50%;background:${C.pur};box-shadow:0 0 14px ${C.pur}`
        this.rayLbl0 = tex('0', 'ms'); root.appendChild(this.rayLbl0); place(this.rayLbl0, x0, y + 34, { anchor: 'c' }); this.rayLbl0.style.color = C.pur
        this.rayInf = tex('+\\infty', 'ms'); root.appendChild(this.rayInf); place(this.rayInf, x1 + 34, y, { anchor: 'cl' }); this.rayInf.style.color = C.pur
        this.rayTicks = [1, 2, 3, 4, 5].map(k => sv(s, 'circle', { cx: x0 + k * 100, cy: y, r: 6, fill: C.blu, opacity: 0 }))
        this.rayN = rich('$n = 0, 1, 2, \\dots$', 's'); root.appendChild(this.rayN); place(this.rayN, x0 + 300, y + 34, { anchor: 'c' }); this.rayN.style.whiteSpace = 'nowrap'; this.rayN.style.color = C.blu
      }
      this.fx = tex(`\\textcolor{${C.pur}}{f}(x) = \\sqrt{x^2+x+1}`, 'mx')
      root.appendChild(this.fx); place(this.fx, 1430, 566, { anchor: 'c' })
      this.ex2 = rich('مثلاً', 's'); root.appendChild(this.ex2); place(this.ex2, 1800, 566, { anchor: 'cr' }); this.ex2.style.whiteSpace = 'nowrap'
      this.rows2 = [
        'u_0 = f(0) = \\sqrt{0^2+0+1} = 1',
        'u_1 = f(1) = \\sqrt{1^2+1+1} = \\sqrt{3}',
        'u_2 = f(2) = \\sqrt{2^2+2+1} = \\sqrt{7}',
      ].map((l, k) => { const e = tex(l, 'mm'); root.appendChild(e); place(e, 1040, 692 + k * 94, { anchor: 'cl' }); return e })
      this.rowTargets = this.rows2.map(e => { const r = rectIn(e, root); return { x: r.x + r.w - 40, y: r.cy } })

      // ---------- L3: u_100 ----------
      this.kb = keyBox(root, 'u_{100} = \\sqrt{100^2+100+1} = \\sqrt{10101}', 1290, 708, { cls: 'mx' })
      this.kb.f.style.fontSize = '56px'
      this.jump = chip(root, '⚡ قفزة مباشرة', 1290, 862, { anchor: 'c', color: C.grn })
      this.jump.style.whiteSpace = 'nowrap'; this.jump.style.fontSize = '32px'
      this.skip = rich('دون حساب $u_3,\\ u_4,\\ \\dots,\\ u_{99}$', 's ctr'); root.appendChild(this.skip); place(this.skip, 1290, 940, { anchor: 'c' }); this.skip.style.whiteSpace = 'nowrap'
      this.B0 = [905, 895]; this.B1 = [700, 70]; this.B2 = [MX, HOPY - 40]
      let d = ''
      for (let k = 0; k <= 40; k++) { const t = k / 40; d += (k ? ' L' : 'M') + bez(this.B0[0], this.B1[0], this.B2[0], t) + ',' + bez(this.B0[1], this.B1[1], this.B2[1], t) }
      this.trail.setAttribute('d', d)
    },

    render(lt, S) {
      const a1 = S.at(1), a2 = S.at(2), a3 = S.at(3)
      const d1 = S.end(1) - a1, d2 = S.end(2) - a2
      this.h.set(S.p(lt, 0, 0, .7))

      // ---------- L0 ----------
      const out0 = S.p(lt, 1, 0, .55)
      const cIn = S.p(lt, 0, .3, .7, E.out)
      rise(this.card, cIn * (1 - out0))
      this.card.style.transform += ` scale(${lerp(1, .94, out0)})`
      typeWords(this.c1, S.f(lt, 0, .02, .3))
      typeWords(this.c2, S.f(lt, 0, .3, .85))
      const hl = pp(lt, T(S, 0, .72), .5)
      this.hlSpan.forEach(w => { w.style.color = mixColor(C.ink, C.yel, hl); w.style.fontWeight = hl > .5 ? 700 : 500 })
      const chipIn = S.p(lt, 1, .3, .6, E.out)
      slide(this.chip, chipIn, -30)

      // ---------- machine state ----------
      const mIn = pp(lt, Math.max(S.at(0) + 1.2, T(S, 0, .3)), .7, E.out)
      let work = 0, winGlow = 0
      // window views
      const sT = [null, a1 + .1, a2 + .1, T(S, 3, .1) + 1.5, Infinity]
      ;[this.v0, this.v1, this.v2, this.v3].forEach((v, i) => {
        const pin = i === 0 ? mIn : pp(lt, sT[i] + .22, .4, E.out), out = pp(lt, sT[i + 1], .28, E.in)
        op(v, pin * (1 - out))
        v.style.transform = `translateY(${(1 - pin) * 22 - out * 22}px)`
      })
      winGlow = Math.max(winGlow, pp(lt, a1 + .4, .4) * (1 - pp(lt, T(S, 1, .32), .6)) * .8)
      winGlow = Math.max(winGlow, pp(lt, a2 + .4, .4) * (1 - pp(lt, a2 + 1.8, .6)))

      // ---------- L1: four balls → table cells + plot ----------
      const lab2T = Math.max(a2 + 1.5, T(S, 2, .24))
      const out1 = pp(lt, lab2T - .7, .6)
      const tIn = S.p(lt, 1, .4, .6, E.out)
      rise(this.tb, tIn * (1 - out1))
      const t0 = T(S, 1, .36), step = Math.max(.55, .12 * d1), cy = clamp(step / 1.25, .45, 1)
      const QY = HOPY - 52
      this.balls1.forEach((b, k) => {
        const tk = t0 + k * step
        const ap = pp(lt, tk - .5 * cy, .4 * cy, E.out)
        const dp = pp(lt, tk, .4 * cy, E.in)
        putBall(b, MX, QY + 150 * dp, ap * (dp < 1 ? 1 : 0), lerp(.5, 1, ap))
        work = Math.max(work, pp(lt, tk + .3 * cy, .12) * (1 - pp(lt, tk + .75 * cy, .15)))
        this.colHL[k](pp(lt, tk - .4 * cy, .35) * (1 - pp(lt, tk + .9 * step, .4)) * (1 - out1))
        // card: emerge, fly to its cell
        const ce = tk + .55 * cy
        const em = pp(lt, ce, .3 * cy, E.out), fl = pp(lt, ce + .3 * cy, .6 * cy, E.io)
        const tg = this.tdTargets[k]
        const x = lerp(MX, tg.cx, fl), y = lerp(CHY - 40 + 70 * em, tg.cy, fl) - Math.sin(Math.PI * fl) * 120
        putCard(this.cards1[k], x, y, em > 0 && fl < 1 ? 1 : 0, lerp(1, .9, fl))
        const land = pp(lt, ce + .85 * cy, .3)
        pop(this.tu[k], land); op(this.tu[k], clamp(land * 3) * 1)
        // plot dot
        const dq = pp(lt, ce + .85 * cy, .4, E.back)
        this.dots[k].style.opacity = clamp(dq * 3); this.dots[k].style.transform = `scale(${Math.max(0, dq)})`
      })
      const lastLand = t0 + 3 * step + 1.4 * cy
      for (let n = 4; n <= 9; n++) {
        const dq = pp(lt, lastLand + (n - 4) * .14, .35, E.back)
        this.dots[n].style.opacity = clamp(dq * 3); this.dots[n].style.transform = `scale(${Math.max(0, dq)})`
      }
      // zig-zag follows the dots
      {
        let shownTo = 0
        for (let n = 1; n <= 9; n++) {
          const tl = n <= 3 ? t0 + n * step + .55 * cy + .85 * cy : lastLand + (n - 4) * .14
          shownTo += pp(lt, tl - .25, .3, E.lin)
        }
        draw(this.zz, shownTo / 9)
      }
      this.env.forEach(e => { e.style.opacity = .7 * pp(lt, lastLand + .6, .6) })
      op(this.to0, pp(lt, lastLand + .9, .5))
      const pIn = S.p(lt, 1, .7, .6)
      op(this.P.box, pIn * (1 - out1))
      draw(this.P.xAxis, pIn); draw(this.P.yAxis, pIn)

      // ---------- L2: u_n = f(n) ----------
      const out2 = pp(lt, T(S, 3, .1) + .5, .5)
      rise(this.lab2, pp(lt, lab2T, .6))
      { const rp = pp(lt, lab2T + .4, .9); draw(this.ray, rp); this.rayBase.style.opacity = clamp(rp * 3); op(this.ray0, clamp(rp * 4)); op(this.rayInf, pp(lt, lab2T + 1.1, .4)); op(this.rayLbl0, clamp(rp * 4))
        this.rayTicks.forEach((c, k) => { c.style.opacity = pp(lt, lab2T + .9 + k * .12, .3) }); op(this.rayN, pp(lt, lab2T + 1.6, .5)) }
      const fxIn = pp(lt, Math.max(a2 + 3, T(S, 2, .56)), .7)
      rise(this.fx, fxIn); rise(this.ex2, fxIn)
      if (fxIn > 0) this.fx.style.textShadow = lt > a3 + .3 ? `0 0 ${12 + 8 * Math.sin(lt * 3)}px rgba(167,139,250,.5)` : ''
      const t2 = Math.max(a2 + 4.2, T(S, 2, .66)), st2 = clamp(.085 * d2, .6, 1.4), cy2 = clamp(st2 / 1.25, .45, 1)
      this.balls2.forEach((b, k) => {
        const tk = t2 + k * st2
        const ap = pp(lt, tk - .5 * cy2, .4 * cy2, E.out)
        const dp = pp(lt, tk, .4 * cy2, E.in)
        putBall(b, MX, QY + 150 * dp, ap * (dp < 1 ? 1 : 0), lerp(.5, 1, ap))
        work = Math.max(work, pp(lt, tk + .3 * cy2, .12) * (1 - pp(lt, tk + .75 * cy2, .15)))
        const ce = tk + .55 * cy2
        const em = pp(lt, ce, .3 * cy2, E.out), fl = pp(lt, ce + .3 * cy2, .6 * cy2, E.io)
        const tg = this.rowTargets[k]
        const x = lerp(MX, tg.x, fl), y = lerp(CHY - 40 + 70 * em, tg.y, fl) - Math.sin(Math.PI * fl) * 90
        putCard(this.cards2[k], x, y, em > 0 && fl < 1 ? 1 : 0, 1)
        const land = pp(lt, ce + .8 * cy2, .5)
        op(this.rows2[k], (land > 0 ? 1 : 0) * (1 - out2)); wipe(this.rows2[k], land, 'ltr')
      })

      // ---------- L3: the direct jump to u_100 ----------
      const j0 = T(S, 3, .1)
      const bIn = pp(lt, j0 - .3, .45, E.back)
      const fly = pp(lt, j0 + .35, 1.1, E.io)
      const drop = pp(lt, j0 + 1.45, .35, E.in)
      {
        let x = bez(this.B0[0], this.B1[0], this.B2[0], fly), y = bez(this.B0[1], this.B1[1], this.B2[1], fly) + drop * 150
        putBall(this.b100, x, y, clamp(bIn * 2) * (drop < 1 ? 1 : 0), Math.max(.2, bIn) * lerp(1, .8, fly))
        this.b100.style.zIndex = drop > 0 ? 4 : 6
      }
      draw(this.trail, fly); this.trail.style.opacity = .5 * (1 - pp(lt, j0 + 2.6, .8))
      work = Math.max(work, pp(lt, j0 + 1.7, .12) * (1 - pp(lt, j0 + 2.4, .2)))
      winGlow = Math.max(winGlow, pp(lt, j0 + 1.6, .3) * (1 - pp(lt, j0 + 2.8, .6)))
      const ce = j0 + 2.25
      const em = pp(lt, ce, .35, E.out), fl = pp(lt, ce + .35, .6, E.io)
      putCard(this.c100, lerp(MX, 1290, fl), lerp(CHY - 40 + 70 * em, 708, fl), em > 0 && fl < 1 ? 1 : 0, lerp(1, 1.3, fl))
      this.kb.set(pp(lt, ce + .75, .7, E.out))
      if (lt > ce + 1.5) this.kb.el.style.boxShadow = `0 0 ${44 + 16 * Math.sin(lt * 2.4)}px rgba(255,210,63,.28)`
      const jIn = pp(lt, ce + 1.1, .6, E.out)
      pop(this.jump, jIn)
      rise(this.skip, pp(lt, Math.max(ce + 1.6, T(S, 3, .72)), .6), 14)
      this.M.set(lt, { work, winGlow, a: mIn, s: lerp(.85, 1, mIn) })
    },
  })
})()

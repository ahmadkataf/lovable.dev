// s04 · حدود لا نهائيّة — (-1)^n has infinitely many terms but 2 values; why n0 = 1 for 1/n and n0 = 2 for 1/(n²-1)
(() => {
  const ID = 's04'
  let uid = 0

  // ---------- local kit: the «function machine», index balls, output cards ----------
  function machine(root, cx, cy, o = {}) {
    const w = o.w ?? 400, h = o.h ?? 230
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
    body.style.cssText = `position:absolute;inset:0;border-radius:34px;border:3px solid ${C.pur};background:linear-gradient(180deg,#31246f 0%,#1c1648 100%);overflow:hidden`
    const sheen = el('div', '', null, body)
    sheen.style.cssText = 'position:absolute;top:-30%;bottom:-30%;width:46%;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.035) 30%,rgba(255,255,255,.075) 50%,rgba(255,255,255,.035) 70%,rgba(255,255,255,0) 100%);transform:skewX(-18deg);pointer-events:none'
    let label = null
    if (o.label) {
      label = rich(o.label, 'h3 ctr')
      body.appendChild(label)
      label.style.cssText += 'position:absolute;left:0;right:0;top:50%;translate:0 -58%;color:#e6defc;font-weight:800;font-size:56px'
    }
    const lights = [0, 1, 2].map(i => {
      const d = el('div', '', null, body)
      d.style.cssText = `position:absolute;left:${28 + i * 24}px;bottom:18px;width:12px;height:12px;border-radius:50%;background:#43397a`
      return d
    })
    return {
      g, body, label,
      // st: {work, jam, shake, a (opacity), s (scale)}
      set(lt, st = {}) {
        const jam = clamp(st.jam || 0), work = clamp(st.work || 0)
        const bc = jam > 0 ? mixColor(C.pur, C.red, jam) : C.pur
        body.style.borderColor = bc; chute.style.borderColor = bc; hop.setAttribute('stroke', bc)
        const glowA = .28 + .25 * work + .45 * jam
        const gc = jam > 0 ? `rgba(255,92,138,${glowA})` : `rgba(167,139,250,${glowA})`
        body.style.boxShadow = `0 0 ${46 + 40 * Math.max(work, jam)}px ${gc},inset 0 2px 0 rgba(255,255,255,.14),inset 0 -14px 30px rgba(0,0,0,.35)` + (jam > 0 ? `,inset 0 0 60px rgba(255,92,138,${.5 * jam})` : '')
        if (label) label.style.color = jam > 0 ? mixColor('#e6defc', C.red, jam) : '#e6defc'
        lights.forEach((d, i) => {
          let c = '#43397a'
          if (jam > .05) c = C.red
          else if (work > .05 && Math.floor(lt * 9 + i * 1.3) % 3 === 0) c = C.grn
          d.style.background = c
          d.style.boxShadow = c === '#43397a' ? 'none' : `0 0 12px ${c}`
        })
        const sx = ((lt * .16) % 2.2) - .7
        sheen.style.left = (sx * 100) + '%'
        const shake = (st.shake || 0) * Math.sin(lt * 70) * 9
        const fl = Math.sin(lt * 1.3) * 3
        const a = st.a ?? 1, s = st.s ?? 1
        op(g, a)
        g.style.transform = `translate(${shake}px,${fl}px) scale(${s})`
      },
    }
  }
  function ball(root, txt, d = 76) {
    const b = el('div', '', null, root)
    b.style.cssText = `position:absolute;left:0;top:0;width:${d}px;height:${d}px;margin:${-d / 2}px 0 0 ${-d / 2}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${d * .46}px;color:#fff;direction:ltr;background:radial-gradient(circle at 34% 30%,#b9ecff 0%,#38bdf8 40%,#0369a1 100%);box-shadow:0 0 22px rgba(56,189,248,.55),inset 0 -6px 12px rgba(0,0,0,.25);z-index:4`
    b.textContent = txt
    return b
  }
  const putBall = (b, x, y, a = 1, s = 1) => { op(b, a); b.style.transform = `translate(${x}px,${y}px) scale(${s})` }
  function outCard(root, latex, cls = 'mm', col = C.yel) {
    const c = el('div', '', null, root)
    c.style.cssText = `position:absolute;left:0;top:0;translate:-50% -50%;padding:8px 22px;border-radius:16px;border:2.5px solid ${col};background:#1d1a14;box-shadow:0 0 24px ${col}55;z-index:4;color:${col}`
    c.appendChild(tex(latex, cls))
    return c
  }
  const putCard = (c, x, y, a = 1, s = 1) => { op(c, a); c.style.transform = `translate(${x}px,${y}px) scale(${s})` }
  // when line i is fraction f through
  const T = (S, i, f) => S.at(i) + f * (S.end(i) - S.at(i))
  const pp = (lt, t0, d = .6, e = E.io) => prog(lt, t0, d, e)

  scene(ID, {
    build(root, S) {
      // ---- headings ----
      this.hA = heading(root, 'حدودٌ لا نهائيّة')
      this.hB = heading(root, 'من أين يبدأ الدليل؟')

      // ================= L0: the quick question =================
      this.f0 = tex(`\\textcolor{${C.yel}}{u_n} = (-1)^{\\textcolor{${C.blu}}{n}}`, 'mxl')
      root.appendChild(this.f0); place(this.f0, 960, 400, { anchor: 'c' })
      this.f0.style.transformOrigin = '50% 50%'
      this.not0 = tex(`(u_n)_{n\\ge 0}`, 'mx')
      root.appendChild(this.not0); place(this.not0, 960, 528, { anchor: 'c' }); this.not0.style.color = C.mut
      this.q = rich('كم حدّاً لها؟', 'h2 yel ctr')
      root.appendChild(this.q); place(this.q, 960, 652, { anchor: 'c' }); this.q.style.whiteSpace = 'nowrap'
      this.ring = countdown(root, 960, 838, 54)
      this.ringEl = root.lastElementChild
      { const lb = this.ringEl.lastElementChild; lb.style.cssText += 'position:absolute;left:50%;top:138px;translate:-50% 0;white-space:nowrap;margin:0' }

      // ================= L1: zig-zag plot + counters =================
      const P = this.P = plot(root, 196, 318, 960, 440, { xmin: -.7, xmax: 10.9, ymin: -1.5, ymax: 1.5 })
      const { X, Y } = P
      this.ticks = []
      for (let n = 0; n <= 9; n++) {
        const t = sv(P.s, 'line', { x1: X(n), y1: Y(0) - 8, x2: X(n), y2: Y(0) + 8, stroke: C.mut, 'stroke-width': 3 })
        const l = P.label('', n, -.14, 'tc', 'mm'); l.appendChild(tex(String(n), 'ms')); l.style.color = C.blu
        this.ticks.push([t, l])
      }
      this.dotsLbl = P.label('', 10.15, -.14, 'tc'); this.dotsLbl.appendChild(tex('\\cdots', 'ms')); this.dotsLbl.style.color = C.blu
      this.nLbl = P.label('', 10.9, .05, 'bl'); this.nLbl.appendChild(tex('n', 'mm')); this.nLbl.style.color = C.blu
      this.unLbl = P.label('', -.45, 1.55, 'cr'); this.unLbl.appendChild(tex('u_n', 'mm')); this.unLbl.style.color = C.yel
      this.guides = [1, -1].map(v => {
        const g = sv(P.s, 'line', { x1: X(-.35), y1: Y(v), x2: X(10.7), y2: Y(v), stroke: C.org, 'stroke-width': 2.5, 'stroke-dasharray': '10 10', opacity: .8 })
        const l = P.label('', -.42, v, 'cr'); l.appendChild(tex(v > 0 ? '+1' : '-1', 'ms')); l.style.color = C.org
        return { g, l }
      })
      // zig-zag path that keeps going past the last dot and fades out
      const gzid = `${ID}-zz`
      const gz = sv(sv(P.s, 'defs'), 'linearGradient', { id: gzid, gradientUnits: 'userSpaceOnUse', x1: X(8.6), y1: 0, x2: X(10.7), y2: 0 })
      sv(gz, 'stop', { offset: 0, 'stop-color': C.yel, 'stop-opacity': .75 }); sv(gz, 'stop', { offset: 1, 'stop-color': C.yel, 'stop-opacity': 0 })
      let d = ''
      for (let n = 0; n <= 10; n++) d += (n ? ' L' : 'M') + X(n) + ',' + Y(n % 2 ? -1 : 1)
      d += ` L${X(10.7)},${Y(1 - 2 * .7 * -1 * -1)}`
      this.zz = sv(P.s, 'path', { d, fill: 'none', stroke: `url(#${gzid})`, 'stroke-width': 3.5, 'stroke-linejoin': 'round' })
      this.dots = []
      for (let n = 0; n <= 9; n++) {
        const c = sv(P.s, 'circle', { cx: X(n), cy: Y(n % 2 ? -1 : 1), r: 12, fill: C.yel })
        c.style.transformOrigin = `${X(n)}px ${Y(n % 2 ? -1 : 1)}px`
        c.style.filter = 'drop-shadow(0 0 8px rgba(255,210,63,.7))'
        this.dots.push(c)
      }
      // counter tiles (right column)
      const tile = (y, label, numCol) => {
        const t = el('div', 'ar', null, root)
        place(t, 1800, y, { anchor: 'tr', w: 560, h: 200 })
        t.style.cssText += 'border-radius:26px;border:2px solid var(--line);background:linear-gradient(180deg,rgba(28,38,74,.85),rgba(20,29,56,.85));box-shadow:0 20px 60px rgba(0,0,0,.3)'
        const lab = el('div', 's b', label, t); place(lab, 520, 26, { anchor: 'tr' }); lab.style.color = C.ink; lab.style.whiteSpace = 'nowrap'
        const num = el('div', '', '', t); place(num, 50, 100, { anchor: 'cl' })
        num.style.cssText += `font-size:104px;font-weight:900;color:${numCol};direction:ltr;line-height:1`
        return { t, lab, num }
      }
      this.tV = tile(318, 'عدد القيم', C.org)
      this.tV.num.textContent = '2'
      this.tV.cap = rich('تأخذ فقط القيمتين $+1$ و $-1$', 's'); this.tV.t.appendChild(this.tV.cap); place(this.tV.cap, 520, 128, { anchor: 'tr' }); this.tV.cap.style.whiteSpace = 'nowrap'
      this.tV.cap.style.color = C.mut; this.tV.cap.style.fontSize = '29px'
      this.tN = tile(558, 'عدد الحدود', C.yel)
      this.tN.cap = tex('u_0,\\ u_1,\\ u_2,\\ \\dots', 'ms'); this.tN.t.appendChild(this.tN.cap); place(this.tN.cap, 520, 136, { anchor: 'tr' }); this.tN.cap.style.color = C.yel
      this.inf = tex('\\infty', 'mxl'); this.tN.t.appendChild(this.inf); place(this.inf, 52, 100, { anchor: 'cl' }); this.inf.style.color = C.yel
      this.inf.style.fontSize = '120px'
      // book sentence + warning chip
      this.book = el('div', '', null, root)
      place(this.book, 960, 842, { anchor: 'c' })
      this.book.style.cssText += `white-space:nowrap;padding:18px 36px;border-radius:24px;border:3px solid ${C.yel};background:rgba(255,210,63,.07);box-shadow:0 0 50px rgba(255,210,63,.18)`
      this.book.appendChild(rich('للمتتالية عددٌ <span class="yel b">لا نهائيٌّ</span> من الحدود بقطع النظر عن قيم هذه الحدود', 'p'))
      this.warn = chip(root, '⚠️ لا تخلط بين الحدود والقيم', 960, 944, { anchor: 'c', color: C.red })

      // ================= L2: 1/n and the jammed machine =================
      this.f2 = tex(`\\left(\\dfrac{1}{n}\\right)_{\\htmlId{${ID}-sub1}{n\\ge 1}}`, 'ml')
      root.appendChild(this.f2); place(this.f2, 470, 470, { anchor: 'c' })
      this.f2sub = this.f2.querySelector(`#${ID}-sub1`)
      this.chip1 = el('div', '', null, root)
      this.chip1.appendChild(tex('n_0 = 1', 'mm'))
      place(this.chip1, 470, 660, { anchor: 'c' })
      this.chip1.style.cssText += `padding:10px 30px;border-radius:999px;border:2.5px solid ${C.yel};background:rgba(255,210,63,.12);color:${C.yel};box-shadow:0 0 30px rgba(255,210,63,.25)`
      this.MX = 1150; this.MY = 545
      this.balls2 = [0, 1, 2, 3].map(k => ball(root, String(k)))
      this.outs2 = ['u_1 = 1', 'u_2 = \\tfrac{1}{2}', 'u_3 = \\tfrac{1}{3}'].map(s => outCard(root, s, 'mm'))
      this.m2 = machine(root, this.MX, this.MY, { w: 400, h: 230, label: 'تابع' })
      this.err = el('div', 'ar', null, root)
      place(this.err, 1430, this.MY, { anchor: 'cl' })
      this.err.style.cssText += `white-space:nowrap;padding:14px 26px;border-radius:20px;border:2.5px solid ${C.red};background:rgba(255,92,138,.12);color:${C.red};display:flex;align-items:center;gap:14px;box-shadow:0 0 30px rgba(255,92,138,.25)`
      this.err.appendChild(tex('\\dfrac{1}{0}', 'mm'))
      this.err.appendChild(rich('غير معرّف', 'h3 red'))
      this.cross0 = el('div', '', null, root)
      this.cross0.style.cssText = 'position:absolute;left:0;top:0;width:76px;height:76px;margin:-38px 0 0 -38px;z-index:6'
      { const s = svg(this.cross0, 0, 0, 76, 76); sv(s, 'path', { d: 'M20,20 L56,56 M56,20 L20,56', stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round' }) }

      // ================= L3–L4: index number line for 1/(n^2-1) =================
      this.f3 = tex(`\\left(\\dfrac{1}{n^2-1}\\right)_{\\htmlId{${ID}-sub2}{n\\ge 2}}`, 'mx')
      root.appendChild(this.f3); place(this.f3, 150, 168, { anchor: 'tl' })
      this.f3sub = this.f3.querySelector(`#${ID}-sub2`)
      const NX = this.NX = n => 320 + 220 * n, NY = this.NY = 650
      const s = this.ns = svg(root, 0, 0, W, H)
      this.axis = arrow(s, 240, NY, 1748, NY, { color: C.mut, width: 4 })
      this.nTicks = []
      for (let n = 0; n <= 6; n++) {
        const t = sv(s, 'line', { x1: NX(n), y1: NY - 12, x2: NX(n), y2: NY + 12, stroke: C.mut, 'stroke-width': 3.5 })
        const l = tex(String(n), 'mm'); root.appendChild(l); place(l, NX(n), NY + 44, { anchor: 'c' }); l.style.color = C.blu
        this.nTicks.push({ t, l })
      }
      this.dot0 = sv(s, 'circle', { cx: NX(0), cy: NY, r: 11, fill: C.mut })
      this.hole = sv(s, 'circle', { cx: NX(1), cy: NY, r: 13, fill: C.bg, stroke: C.red, 'stroke-width': 4 })
      this.gDots = [2, 3, 4, 5, 6].map(n => sv(s, 'circle', { cx: NX(n), cy: NY, r: 10, fill: C.grn }))
      // bubbles (callouts)
      const bubble = (x, y, col, lat, lab) => {
        const b = el('div', 'ctr', null, root)
        place(b, x, y, { anchor: 'bc' })
        b.style.cssText += `padding:14px 26px 10px;border-radius:22px;border:2.5px solid ${col};background:rgba(16,23,46,.96);box-shadow:0 14px 40px rgba(0,0,0,.35),0 0 30px ${col}33`
        b.style.transformOrigin = '50% 100%'
        const f = tex(lat, 'mm'); b.appendChild(f); f.style.display = 'block'
        const r = rich(lab, 's ctr'); b.appendChild(r); r.style.color = col; r.style.marginTop = '4px'
        return b
      }
      this.bub0 = bubble(NX(0) - 10, 578, C.mut, `\\dfrac{1}{0^2-1} = -1`, 'معرّف')
      this.tail0 = sv(s, 'line', { x1: NX(0), y1: 582, x2: NX(0), y2: NY - 18, stroke: C.mut, 'stroke-width': 2.5, 'stroke-dasharray': '6 7' })
      this.bub1 = bubble(NX(1) + 110, 578, C.red, `\\dfrac{1}{1^2-1} = \\dfrac{1}{0}`, 'المقام $=0$')
      this.tail1 = sv(s, 'line', { x1: NX(1) + 110, y1: 582, x2: NX(1), y2: NY - 18, stroke: C.red, 'stroke-width': 2.5, 'stroke-dasharray': '6 7' })
      this.x1 = el('div', '', null, root)
      place(this.x1, 0, 0)
      this.x1.style.cssText += `width:46px;height:46px;border-radius:50%;background:${C.red};box-shadow:0 0 20px rgba(255,92,138,.6)`
      { const r1 = rectIn(this.bub1, root); place(this.x1, r1.x + 4, r1.y + 4, { anchor: 'c' }) }
      { const s2 = svg(this.x1, 0, 0, 46, 46); sv(s2, 'path', { d: 'M15,15 L31,31 M31,15 L15,31', stroke: '#fff', 'stroke-width': 5, 'stroke-linecap': 'round' }) }
      // L4: reminder of the index pattern
      this.rem = rich('النمط $\\{n_0,\\ n_0+1,\\ n_0+2,\\ \\dots\\}$', 'h3')
      root.appendChild(this.rem); place(this.rem, 1800, 268, { anchor: 'tr' })
      this.rem.style.cssText += `white-space:nowrap;color:${C.pur};padding:6px 26px;border-radius:18px;background:rgba(167,139,250,.10);border:2px solid rgba(167,139,250,.45)`
      // failed bracket from 0 that breaks at the hole
      const BY = 762
      this.brA = sv(s, 'path', { d: `M${NX(0)},${BY - 26} L${NX(0)},${BY} L${NX(1) - 30},${BY}`, fill: 'none', stroke: C.blu, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      this.brk = sv(s, 'path', { d: `M${NX(1) - 30},${BY} l10,-16 l10,30 l10,-28 l10,22`, fill: 'none', stroke: C.red, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      this.gap = rich('ثغرة!', 'h3 red ctr'); root.appendChild(this.gap); place(this.gap, NX(1) + 4, 820, { anchor: 'c' })
      // green bracket from 2 to +inf
      this.brB0 = sv(s, 'path', { d: `M${NX(2)},${BY - 26} L${NX(2)},${BY}`, fill: 'none', stroke: C.grn, 'stroke-width': 6, 'stroke-linecap': 'round' })
      this.brB = arrow(s, NX(2), BY, 1690, BY, { color: C.grn, width: 6 })
      this.infB = tex('+\\infty', 'mm'); root.appendChild(this.infB); place(this.infB, 1708, BY, { anchor: 'cl' }); this.infB.style.color = C.grn
      this.chip2 = el('div', '', null, root)
      this.chip2.appendChild(tex('n_0 = 2', 'mm'))
      place(this.chip2, NX(2) + 30, 826, { anchor: 'cl' })
      this.chip2.style.cssText += `padding:8px 28px;border-radius:999px;border:2.5px solid ${C.yel};background:rgba(255,210,63,.12);color:${C.yel};box-shadow:0 0 30px rgba(255,210,63,.25)`
      this.vals = [['u_2 = \\dfrac{1}{3}', 2], ['u_3 = \\dfrac{1}{8}', 3], ['u_4 = \\dfrac{1}{15}', 4]].map(([l, n]) => {
        const e = tex(l, 'ms'); root.appendChild(e); place(e, NX(n), 560, { anchor: 'c' }); e.style.color = C.grn
        return e
      })
      this.fin = rich('$\\left(\\dfrac{1}{n}\\right)_{n\\ge1}$ و $\\left(\\dfrac{1}{n^2-1}\\right)_{n\\ge2}$ متتاليتان فيهما $n_0 = 1$ و $n_0 = 2$ بالترتيب', 'p ctr')
      root.appendChild(this.fin); place(this.fin, 960, 932, { anchor: 'c' }); this.fin.style.fontSize = '36px'; this.fin.style.whiteSpace = 'nowrap'
    },

    render(lt, S) {
      const a1 = S.at(1), a2 = S.at(2), a3 = S.at(3), a4 = S.at(4)
      // ---- headings ----
      const hx = S.p(lt, 2, 0, .6)
      this.hA.set(Math.min(S.p(lt, 0, 0, .7), 1 - hx))
      this.hB.set(S.p(lt, 2, .35, .7))

      // ================= L0 =================
      const out1 = S.p(lt, 2, 0, .5)          // L1 content leaves when L2 starts
      const mv = S.p(lt, 1, 0, .9)
      const fIn = S.p(lt, 0, .1, .8, E.out)
      {
        const s = lerp(.82, 1, fIn) * lerp(1, .48, mv)
        const glow = lt < a1 ? 10 + 8 * Math.sin(lt * 2.2) : 0
        op(this.f0, fIn * (1 - out1))
        this.f0.style.transform = `translate(${-668 * mv}px,${-196 * mv}px) scale(${s})`
        this.f0.style.textShadow = glow ? `0 0 ${glow}px rgba(255,210,63,.35)` : ''
      }
      rise(this.not0, S.p(lt, 0, .7, .6) * (1 - S.p(lt, 1, 0, .4)))
      const qIn = pp(lt, T(S, 0, .62), .6)
      rise(this.q, qIn * (1 - S.p(lt, 1, 0, .4)))
      {
        const e0 = S.end(0), hold = Math.max(.5, a1 - e0)
        const pr = clamp((lt - e0) / hold)
        this.ring(Math.max(pr, 1e-4), Math.min(2, Math.max(0, a1 - lt)))
        const ap = pp(lt, e0 - .5, .5, E.out), dis = S.p(lt, 1, 0, .4)
        op(this.ringEl, ap * (1 - dis))
        this.ringEl.style.transform = `scale(${lerp(.7, 1, ap) * lerp(1, .8, dis)})`
      }

      // ================= L1 =================
      const d1 = S.end(1) - a1
      const P = this.P
      const ax = S.p(lt, 1, .3, .8)
      op(P.box, (ax > 0 ? 1 : 0) * (1 - out1))
      draw(P.xAxis, ax); draw(P.yAxis, ax)
      this.ticks.forEach(([t, l], n) => { const q = S.p(lt, 1, .5 + n * .05, .4); t.style.opacity = q; op(l, q) })
      op(this.dotsLbl, S.p(lt, 1, 1, .4)); op(this.nLbl, ax); op(this.unLbl, ax)
      const gIn = S.p(lt, 1, .55, .6)
      const gGlow = pp(lt, a1 + .6, .5) * (1 - pp(lt, T(S, 1, .35), .6))
      this.guides.forEach(({ g, l }) => {
        g.style.opacity = gIn * (.75 + .25 * gGlow); op(l, gIn)
        g.setAttribute('stroke-width', 2.5 + 2 * gGlow)
        g.style.filter = gGlow > 0 ? `drop-shadow(0 0 ${8 * gGlow}px ${C.org})` : ''
      })
      const t0 = a1 + .9, step = clamp((d1 * .5 - .9) / 10, .12, .45)
      let shown = 0
      this.dots.forEach((c, n) => {
        const q = pp(lt, t0 + n * step, .45, E.back)
        if (lt >= t0 + n * step) shown = n + 1
        c.style.opacity = clamp(q * 3)
        const pulse = 1 + .06 * Math.sin(lt * 2.4 + n * .7) * pp(lt, t0 + 10 * step, .5)
        c.style.transform = `scale(${Math.max(0, q) * pulse})`
      })
      draw(this.zz, clamp((lt - t0) / (step * 10.7)))
      // tiles
      const tvIn = S.p(lt, 1, .7, .6, E.out)
      slide(this.tV.t, tvIn * (1 - out1), -40)
      const tvGlow = pp(lt, a1 + 1, .4) * (1 - pp(lt, T(S, 1, .35), .6))
      this.tV.t.style.borderColor = mixColor('#25305a', C.org, tvGlow)
      this.tV.num.style.transform = `scale(${1 + .12 * tvGlow})`
      const tnIn = S.p(lt, 1, .9, .6, E.out)
      slide(this.tN.t, tnIn * (1 - out1), -40)
      const infT = t0 + 10 * step + .25, infP = pp(lt, infT, .55, E.back)
      this.tN.num.textContent = String(Math.max(1, shown))
      op(this.tN.num, 1 - clamp(infP * 3))
      op(this.inf, clamp(infP * 2)); this.inf.style.transform = `scale(${lerp(.4, 1, infP)})`
      const tnGlow = pp(lt, infT, .4) * (1 - pp(lt, T(S, 1, .8), .6))
      this.tN.t.style.borderColor = mixColor('#25305a', C.yel, tnGlow)
      // book sentence + chip
      const bIn = pp(lt, Math.max(infT + .3, T(S, 1, .55)), .7)
      rise(this.book, bIn * (1 - out1))
      if (bIn > 0) this.book.style.boxShadow = `0 0 ${40 + 14 * Math.sin(lt * 2)}px rgba(255,210,63,.18)`
      const wIn = pp(lt, Math.max(infT + .9, T(S, 1, .78)), .6, E.out)
      pop(this.warn, wIn); op(this.warn, clamp(wIn * 2.5) * (1 - out1))

      // ================= L2 =================
      const d2 = S.end(2) - a2
      const out2 = S.p(lt, 3, 0, .5)
      rise(this.f2, S.p(lt, 2, .4, .7) * (1 - out2))
      const mIn = S.p(lt, 2, .5, .7, E.out)
      // queue + timing of each ball
      const T0 = a2 + 1.5
      const st2 = clamp((d2 - 1.5 - 1.6 - 1.4) / 3, .55, 1.25)
      const Tk = k => (k === 0 ? T0 : T0 + 1.7 + (k - 1) * st2)
      const QY = 318, HX = this.MX, DY = 190
      let A = 0
      for (let j = 1; j < 4; j++) A += pp(lt, Tk(j) - .6, .45)
      let jam = 0, work = 0, shake = 0
      this.balls2.forEach((b, k) => {
        const appear = S.p(lt, 2, .8 + k * .12, .45, E.out)
        let x = HX + 104 * Math.max(0, k - A), y = QY, a = appear, s = lerp(.5, 1, appear)
        const dp = pp(lt, Tk(k), .45, E.in)
        y = QY + DY * dp
        b.style.zIndex = 4
        if (k === 0) {
          // rejected: spat back out, turns red, crossed, rolls away
          const rj = pp(lt, Tk(0) + .75, .5, E.out)
          const gone = pp(lt, Tk(0) + 1.45, .6, E.in)
          if (rj > 0) { y = lerp(QY + DY, QY - 40, rj) + gone * 200; x = HX - 170 * rj - 90 * gone }
          const red = clamp(rj * 2)
          b.style.background = red > 0 ? `radial-gradient(circle at 34% 30%,#ffd0dc 0%,${C.red} 40%,#9d1745 100%)` : ''
          b.style.boxShadow = red > 0 ? '0 0 26px rgba(255,92,138,.7)' : ''
          if (rj > 0) b.style.zIndex = 7
          a = appear * (1 - gone)
          putBall(this.cross0, x, y, red * (1 - gone) * (1 - out2), 1)
          this.cross0.style.zIndex = 8
          jam = Math.max(jam, pp(lt, Tk(0) + .4, .2) * (1 - pp(lt, Tk(0) + 1.6, .6)))
          shake = Math.max(shake, pp(lt, Tk(0) + .4, .1) * (1 - pp(lt, Tk(0) + .95, .3)))
        } else {
          work = Math.max(work, pp(lt, Tk(k) + .35, .15) * (1 - pp(lt, Tk(k) + .95, .2)))
        }
        putBall(b, x, y, a * (1 - out2), s)
      })
      // jam re-pulse when the narrator says «لأنّ الصفر يعدم المقام»
      const rp = pp(lt, T(S, 2, .74), .25) * (1 - pp(lt, T(S, 2, .74) + .7, .4))
      jam = Math.max(jam, rp * .8)
      this.m2.set(lt, { jam, work, shake, a: mIn * (1 - out2), s: lerp(.85, 1, mIn) })
      // error label
      const eIn = pp(lt, Tk(0) + .6, .5, E.out)
      slide(this.err, eIn * (1 - out2), -40)
      this.err.style.transform += ` scale(${1 + .08 * rp})`
      // outputs 1/1, 1/2, 1/3
      this.outs2.forEach((c, i) => {
        const k = i + 1, t = Tk(k) + .55
        const em = pp(lt, t, .4, E.out), mvp = pp(lt, t + .45, .5)
        const sx = this.MX - 215 + i * 215, sy = 852
        const x = lerp(this.MX, sx, mvp), y = lerp(this.MY + 60, this.MY + 196, em) + (sy - this.MY - 196) * mvp
        putCard(c, x, y, (em > 0 ? 1 : 0) * (1 - out2), 1)
      })
      const c1 = pp(lt, Math.min(Tk(1) + 1.2, T(S, 2, .7)), .6, E.out)
      pop(this.chip1, c1); op(this.chip1, clamp(c1 * 2.5) * (1 - out2))
      if (this.f2sub) this.f2sub.style.color = c1 > 0 ? mixColor(C.ink, C.yel, c1) : ''

      // ================= L3 =================
      const d3 = S.end(3) - a3
      rise(this.f3, S.p(lt, 3, .4, .7))
      if (this.f3sub) this.f3sub.style.color = mixColor(C.mut, C.yel, pp(lt, T(S, 4, .5), .5))
      const nl = S.p(lt, 3, .5, 1)
      this.axis.set(nl)
      this.nTicks.forEach(({ t, l }, n) => {
        const q = S.p(lt, 3, .6 + n * .1, .4)
        const fade0 = n === 0 ? pp(lt, T(S, 4, .32), .6) : 0
        t.style.opacity = q * (1 - .8 * fade0); op(l, q * (1 - .75 * fade0))
      })
      const b0t = Math.max(a3 + 1.6, T(S, 3, .3))
      const b0 = pp(lt, b0t, .55, E.out)
      const fade0 = pp(lt, T(S, 4, .32), .6)
      pop(this.bub0, b0); op(this.bub0, clamp(b0 * 2.5) * (1 - fade0))
      this.tail0.style.opacity = pp(lt, b0t + .2, .4) * (1 - fade0)
      this.dot0.style.opacity = pp(lt, b0t + .3, .3) * (1 - fade0)
      const b1t = Math.max(b0t + 1.2, T(S, 3, .64))
      const b1 = pp(lt, b1t, .55, E.out)
      const shrink = pp(lt, T(S, 4, .34), .7)
      const shift = -150 * shrink
      pop(this.bub1, b1)
      this.bub1.style.transform = `translateX(${shift}px) scale(${b1 <= 0 ? .6 : lerp(.6, 1, E.back(clamp(b1)))})`
      this.tail1.setAttribute('x1', this.NX(1) + 110 + shift)
      this.tail1.style.opacity = pp(lt, b1t + .2, .4)
      const xp = pp(lt, b1t + .35, .5)
      op(this.x1, clamp(xp * 2.5))
      this.x1.style.transform = `translateX(${shift}px) scale(${lerp(.4, 1, E.back(xp))})`
      { const hp = pp(lt, b1t, .4); this.hole.style.opacity = hp; this.hole.setAttribute('r', 13 + 3 * Math.sin(lt * 3) * hp)
        if (b1 > 0) this.bub1.style.boxShadow = `0 14px 40px rgba(0,0,0,.35),0 0 ${28 + 16 * Math.sin(lt * 2.6)}px rgba(255,92,138,${.22 + .12 * Math.sin(lt * 2.6)})` }

      // ================= L4 =================
      rise(this.rem, S.p(lt, 4, .15, .6))
      const ba = pp(lt, T(S, 4, .06), Math.max(.6, .16 * (S.end(4) - a4)), E.io)
      draw(this.brA, ba); this.brA.style.opacity = 1 - fade0
      const brk = pp(lt, T(S, 4, .06) + Math.max(.6, .16 * (S.end(4) - a4)), .35, E.out)
      draw(this.brk, brk); this.brk.style.opacity = 1 - fade0
      pop(this.gap, brk); op(this.gap, clamp(brk * 2.5) * (1 - pp(lt, T(S, 4, .55), .5) * .0))
      const gb = pp(lt, T(S, 4, .42), .9)
      draw(this.brB0, clamp(gb * 4)); this.brB.set(gb)
      op(this.infB, pp(lt, T(S, 4, .42) + .8, .4))
      this.gDots.forEach((c, i) => { c.style.opacity = pp(lt, T(S, 4, .42) + i * .12, .3) })
      const c2 = pp(lt, T(S, 4, .5), .6, E.out)
      pop(this.chip2, c2)
      this.vals.forEach((e, i) => rise(e, pp(lt, T(S, 4, .58) + i * .25, .5)))
      rise(this.fin, pp(lt, T(S, 4, .7), .7))
    },
  })
})()

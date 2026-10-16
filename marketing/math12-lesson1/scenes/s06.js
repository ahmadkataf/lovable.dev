// s06 · تعريف بالتدريج — u0 given + recurrence; the machine eats its own output: 3 → 7 → 47 → 2207; u_{n+1} = f(u_n), f : x ↦ x² − 2
(() => {
  const ID = 's06'
  let uid = 0

  // ---------- local kit: the «function machine» (with glass window) and value cards ----------
  function machine(root, cx, cy, o = {}) {
    const w = o.w ?? 460, h = o.h ?? 250
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
    win.style.cssText = `position:absolute;left:28px;right:28px;top:26px;bottom:52px;border-radius:18px;background:linear-gradient(180deg,rgba(6,10,26,.94),rgba(14,20,44,.94));border:2px solid rgba(167,139,250,.55);overflow:hidden`
    const sheen = el('div', '', null, win)
    sheen.style.cssText = 'position:absolute;top:-30%;bottom:-30%;width:46%;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.04) 30%,rgba(255,255,255,.085) 50%,rgba(255,255,255,.04) 70%,rgba(255,255,255,0) 100%);transform:skewX(-18deg);pointer-events:none;z-index:2'
    const tag = el('div', '', o.tag ?? 'تابع', g)
    tag.style.cssText = `position:absolute;top:-20px;right:26px;padding:4px 18px;border-radius:999px;font-size:24px;font-weight:800;color:#0b1020;background:${C.pur};z-index:3;white-space:nowrap`
    const lights = [0, 1, 2].map(i => {
      const d = el('div', '', null, body)
      d.style.cssText = `position:absolute;left:${30 + i * 24}px;bottom:18px;width:12px;height:12px;border-radius:50%;background:#43397a`
      return d
    })
    return {
      g, body, win,
      addView(latex, cls = 'mm') {
        const v = tex(latex, cls)
        win.appendChild(v)
        v.style.cssText += 'position:absolute;left:50%;top:50%;translate:-50% -50%'
        op(v, 0)
        return v
      },
      set(lt, st = {}) {
        const work = clamp(st.work || 0)
        const glowA = .28 + .25 * work
        body.style.boxShadow = `0 0 ${46 + 40 * work}px rgba(167,139,250,${glowA}),inset 0 2px 0 rgba(255,255,255,.14),inset 0 -14px 30px rgba(0,0,0,.35)`
        const wg = st.winGlow || 0
        win.style.borderColor = wg ? mixColor('#7e6cc0', C.yel, wg) : 'rgba(167,139,250,.55)'
        win.style.boxShadow = 'inset 0 0 26px rgba(56,189,248,.12)' + (wg ? `,0 0 ${30 * wg}px rgba(255,210,63,${.45 * wg})` : '')
        lights.forEach((d, i) => {
          const on = work > .05 && Math.floor(lt * 9 + i * 1.3) % 3 === 0
          d.style.background = on ? C.grn : '#43397a'
          d.style.boxShadow = on ? `0 0 12px ${C.grn}` : 'none'
        })
        sheen.style.left = (((lt * .16) % 2.2) - .7) * 100 + '%'
        op(g, st.a ?? 1)
        g.style.transform = `translateY(${Math.sin(lt * 1.3) * 3}px) scale(${st.s ?? 1})`
      },
    }
  }
  function valCard(root, latex, cls = 'mm', col = C.yel) {
    const c = el('div', '', null, root)
    c.style.cssText = `position:absolute;left:0;top:0;translate:-50% -50%;padding:6px 20px;border-radius:16px;border:2.5px solid ${col};background:#1d1a14;box-shadow:0 0 24px ${col}55;z-index:4;color:${col};white-space:nowrap`
    c.appendChild(tex(latex, cls))
    return c
  }
  const putCard = (c, x, y, a = 1, s = 1) => { op(c, a); c.style.transform = `translate(${x}px,${y}px) scale(${s})` }
  const T = (S, i, f) => S.at(i) + f * (S.end(i) - S.at(i))
  const pp = (lt, t0, d = .6, e = E.io) => prog(lt, t0, d, e)
  const nw = e => { e.style.whiteSpace = 'nowrap'; return e }

  const MX = 520, MY = 560, HOPY = MY - 125 - 60, CHY = MY + 125 + 28

  scene(ID, {
    build(root, S) {
      this.h = heading(root, '1.1 تعريف متتالية')

      // ---------- L0: card ② ----------
      const cd = card(root, 'def', 1800, 316, 1480, { anchor: 'tr', tag: 'الطريقة الثانية' })
      this.card = cd.el
      this.c1 = rich('② بالتدريج: أي أن يُحسب الحدُّ ذو الدليل $n$ بدلالة الحدود التي سبقته', 'h3')
      this.c1.style.color = C.pur; this.c1.style.fontWeight = 800
      cd.body.appendChild(this.c1)
      this.c2 = rich('نُعطى الحدّ $u_0$ ثُمّ نعطى علاقة، تسمّى <span class="pur b">علاقة تدريجيّة</span>، تفيد في حساب كلّ حدٍّ من حدود المتتالية بدلالة الحدّ أو الحدود التي سبقته', 'p')
      this.c2.style.marginTop = '18px'
      cd.body.appendChild(this.c2)
      splitWords(this.c1); splitWords(this.c2)
      this.u0w = this.c2.querySelector('bdi')
      this.relWords = [...this.c2.querySelectorAll('.pur .w')]
      this.relHL = hlBg(this.c2.querySelector('.pur'), root, { color: 'rgba(167,139,250,.22)' })
      // preview: each term from the one before
      this.pv = []
      const pvX = [600, 840, 1080, 1320]
      ;['u_0', 'u_1', 'u_2', 'u_3'].forEach((l, k) => {
        const e = tex(l, 'mx'); root.appendChild(e); place(e, pvX[k], 846, { anchor: 'c' }); e.style.color = k ? C.ink : C.yel
        this.pv.push(e)
      })
      this.pvDots = tex('\\cdots', 'mx'); root.appendChild(this.pvDots); place(this.pvDots, 1540, 846, { anchor: 'c' })
      this.pvGiven = rich('مُعطى', 's'); root.appendChild(this.pvGiven); place(this.pvGiven, 600, 920, { anchor: 'c' }); nw(this.pvGiven); this.pvGiven.style.color = C.yel
      { const s = svg(root, 0, 0, W, H); this.pvHops = [0, 1, 2, 3].map(k => arrow(s, pvX[k] + 46, 812, (pvX[k + 1] || 1540) - 46, 812, { color: C.pur, width: 4, bend: -.35 })) }

      // ---------- pipe (behind everything) ----------
      const ps = svg(root, 0, 0, W, H); ps.style.zIndex = 3
      const pd = `M${MX},${CHY - 4} L${MX},${CHY + 30} Q${MX},${CHY + 74} ${MX + 44},${CHY + 74} L${MX + 336},${CHY + 74} Q${MX + 380},${CHY + 74} ${MX + 380},${CHY + 30} L${MX + 380},${HOPY - 22} Q${MX + 380},${HOPY - 66} ${MX + 336},${HOPY - 66} L${MX + 44},${HOPY - 66} Q${MX},${HOPY - 66} ${MX},${HOPY - 22} L${MX},${HOPY + 6}`
      this.pipes = [
        sv(ps, 'path', { d: pd, fill: 'none', stroke: 'rgba(167,139,250,.55)', 'stroke-width': 30, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        sv(ps, 'path', { d: pd, fill: 'none', stroke: '#131a3a', 'stroke-width': 23, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      ]
      this.pipeIn = sv(ps, 'path', { d: pd, fill: 'none', stroke: 'rgba(167,139,250,.25)', 'stroke-width': 6, 'stroke-linecap': 'round' })
      this.pipes.push(this.pipeIn)
      this.flow = sv(ps, 'path', { d: pd, fill: 'none', stroke: C.yel, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-dasharray': '30 120', opacity: 0 })
      this.pipeLen = this.pipeIn.getTotalLength()
      this.eat = nw(rich('الآلة تأكل مخرجها', 's')); root.appendChild(this.eat); place(this.eat, MX + 190, HOPY - 112, { anchor: 'c' }); this.eat.style.color = C.pur
      this.inL = tex('u_n', 'mm'); root.appendChild(this.inL); place(this.inL, MX - 118, HOPY + 8, { anchor: 'cr' }); this.inL.style.color = C.blu
      this.outL = tex('u_{n+1}', 'mm'); root.appendChild(this.outL); place(this.outL, MX - 84, CHY + 4, { anchor: 'cr' }); this.outL.style.color = C.yel

      // value cards riding the pipe
      this.tok = ['3', '7', '47', '2207'].map(v => valCard(root, v, 'mm'))
      this.M = machine(root, MX, MY)
      this.vRel = this.M.addView('u_{n+1} = u_n^2 - 2', 'mm')
      this.vF = this.M.addView(`\\textcolor{${C.pur}}{f} : x \\longmapsto x^2 - 2`, 'mm')

      // ---------- L1: example card ----------
      const ex = card(root, 'ex', 1800, 360, 760, { anchor: 'tr', tag: 'مثال' })
      this.ex = ex.el
      const row = (latex, lab, col) => {
        const r = el('div', '', null, ex.body)
        r.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:30px;direction:rtl;padding:8px 0'
        const l = nw(rich(lab, 's b')); l.style.color = col; r.appendChild(l)
        const f = tex(latex, 'mx'); r.appendChild(f)
        return { r, l, f }
      }
      this.r1 = row(`u_0 = 3`, 'حدّ البدء', C.yel)
      this.r2 = row(`u_{n+1} = u_n^2 - 2`, 'العلاقة التدريجيّة', C.pur)
      this.r1.f.style.color = C.yel
      this.ex3 = rectIn(this.r1.f, root)

      // ---------- L2: the chain + contrast strip ----------
      const chainY = 912
      const items = ['u_0 = 3', 'u_1 = u_0^2 - 2 = 7', 'u_2 = u_1^2 - 2 = 47', 'u_3 = u_2^2 - 2 = 2207']
      this.chain = []
      let x = 150
      const cw = []
      items.forEach((l, k) => {
        const e = tex(l, 'mm'); root.appendChild(e); place(e, x, chainY, { anchor: 'cl' })
        const r = rectIn(e, root); cw.push(r)
        this.chain.push(e)
        x += r.w + 22
        if (k < 3) { const a = tex('\\to', 'mm'); root.appendChild(a); place(a, x, chainY, { anchor: 'cl' }); a.style.color = C.mut; this.chain.push(a); x += rectIn(a, root).w + 22 }
      })
      this.chainEnd = tex(',\\ \\dots', 'mm'); root.appendChild(this.chainEnd); place(this.chainEnd, x - 16, chainY, { anchor: 'cl' })
      this.chainW = x + 40 - 150
      // keep the chain centred
      const shift = (W - this.chainW) / 2 - 150
      this.chain.concat([this.chainEnd]).forEach(e => { e.style.left = (parseFloat(e.style.left) + shift) + 'px' })
      this.chain.forEach((e, i) => { if (i % 2 === 0) e.querySelectorAll('.mord').forEach(() => {}) })
      // contrast strip
      this.sA = nw(rich('صريح', 'h3')); root.appendChild(this.sA); place(this.sA, 1800, 440, { anchor: 'cr' }); this.sA.style.color = C.blu
      this.sB = nw(rich('تدريجي', 'h3')); root.appendChild(this.sB); place(this.sB, 1800, 660, { anchor: 'cr' }); this.sB.style.color = C.pur
      this.sAn = tex('n', 'mx'); root.appendChild(this.sAn); place(this.sAn, 260, 440, { anchor: 'c' }); this.sAn.style.color = C.blu
      this.sAu = tex('u_n', 'mx'); root.appendChild(this.sAu); place(this.sAu, 1460, 440, { anchor: 'c' }); this.sAu.style.color = C.yel
      const ss = svg(root, 0, 0, W, H)
      this.sArrow = arrow(ss, 310, 430, 1400, 430, { color: C.blu, width: 5, bend: -.12 })
      this.sAcap = nw(rich('قفزة واحدة', 's')); root.appendChild(this.sAcap); place(this.sAcap, 855, 330, { anchor: 'c' }); this.sAcap.style.color = C.blu
      const bx = [260, 500, 740, 980, 1220]
      this.sBt = ['u_0', 'u_1', 'u_2', 'u_3'].map((l, k) => { const e = tex(l, 'mx'); root.appendChild(e); place(e, bx[k], 660, { anchor: 'c' }); return e })
      this.sBdots = tex('\\cdots', 'mx'); root.appendChild(this.sBdots); place(this.sBdots, 1460, 660, { anchor: 'c' })
      this.sBhops = [0, 1, 2, 3].map(k => arrow(ss, bx[k] + 46, 626, (k < 3 ? bx[k + 1] : 1460) - 46, 626, { color: C.pur, width: 4, bend: -.4 }))
      this.sBcap = nw(rich('خطوة بعد خطوة', 's')); root.appendChild(this.sBcap); place(this.sBcap, 855, 742, { anchor: 'c' }); this.sBcap.style.color = C.pur
      this.sep = el('div', '', null, root); place(this.sep, 960, 550, { anchor: 'c', w: 1500, h: 2 }); this.sep.style.background = 'rgba(154,168,201,.18)'

      // ---------- L3: u_{n+1} = f(u_n) ----------
      this.kb = keyBox(root, 'u_{n+1} = f(u_n)', 1350, 420, { cls: 'ml' })
      this.book = rich('والتابع $f$ هو التابع $x \\mapsto x^2 - 2$', 'h3')
      root.appendChild(this.book); place(this.book, 1350, 610, { anchor: 'c' }); nw(this.book)
      this.book.querySelectorAll('bdi')[0].style.color = C.pur
      this.fchain = tex(`3 \\xrightarrow{\\;\\textcolor{${C.pur}}{f}\\;} 7 \\xrightarrow{\\;\\textcolor{${C.pur}}{f}\\;} 47 \\xrightarrow{\\;\\textcolor{${C.pur}}{f}\\;} 2207 \\xrightarrow{\\;\\textcolor{${C.pur}}{f}\\;} \\cdots`, 'mx')
      root.appendChild(this.fchain); place(this.fchain, 1350, 800, { anchor: 'c' }); this.fchain.style.color = C.yel
      this.fcap = nw(rich('كلّ حدّ = $f$ (الحدّ الذي سبقه)', 's')); root.appendChild(this.fcap); place(this.fcap, 1350, 900, { anchor: 'c' })
    },

    render(lt, S) {
      const a1 = S.at(1), a2 = S.at(2), a3 = S.at(3)
      const d2 = S.end(2) - a2
      this.h.set(S.p(lt, 0, 0, .7))

      // ---------- L0 ----------
      const out0 = S.p(lt, 1, 0, .55)
      rise(this.card, S.p(lt, 0, .3, .7, E.out) * (1 - out0))
      this.card.style.transform += ` scale(${lerp(1, .95, out0)})`
      typeWords(this.c1, S.f(lt, 0, .02, .28))
      typeWords(this.c2, S.f(lt, 0, .3, .9))
      const u0g = pp(lt, T(S, 0, .34), .5) * (1 - pp(lt, T(S, 0, .62), .6))
      if (this.u0w) { this.u0w.style.color = mixColor(C.ink, C.yel, Math.max(u0g, .0)); this.u0w.style.textShadow = u0g > 0 ? `0 0 ${14 * u0g}px rgba(255,210,63,.7)` : '' }
      const rh = pp(lt, T(S, 0, .86), .6)
      this.relHL(rh * (1 - out0))
      // preview row
      const pvOut = S.p(lt, 1, 0, .5)
      const pv0 = pp(lt, T(S, 0, .4), .5, E.out)
      this.pv.forEach((e, k) => rise(e, (k === 0 ? pv0 : pp(lt, T(S, 0, .52 + k * .1), .5, E.out)) * (1 - pvOut), 20))
      rise(this.pvGiven, pv0 * (1 - pvOut), 12)
      rise(this.pvDots, pp(lt, T(S, 0, .86), .5) * (1 - pvOut), 20)
      this.pvHops.forEach((h, k) => { h.set(pp(lt, T(S, 0, .47 + k * .1), .45)); h.path.style.opacity = 1 - pvOut })

      // ---------- L1: example + machine + pipe ----------
      const outEx = pp(lt, T(S, 2, .6), .5)
      const chipIn = S.p(lt, 1, .3, .6, E.out)
      rise(this.ex, S.p(lt, 1, .5, .7, E.out) * (1 - outEx))
      const r1 = pp(lt, T(S, 1, .22), .5), r2 = pp(lt, T(S, 1, .36), .5)
      rise(this.r1.r, r1, 16); rise(this.r2.r, r2, 16)
      // machine: in during L1, out for the contrast strip, back in L3
      const mIn = S.p(lt, 1, .4, .7, E.out) * (1 - outEx) + pp(lt, a3 + .4, .7, E.out)
      const pipeP = pp(lt, T(S, 1, .6), 1.1, E.io)
      this.pipes.forEach(p => { draw(p, pipeP); p.style.opacity = clamp(mIn) })
      rise(this.eat, pp(lt, T(S, 1, .6) + .8, .5) * clamp(mIn), 12)
      op(this.inL, pp(lt, T(S, 1, .6) + 1, .4) * clamp(mIn)); op(this.outL, pp(lt, T(S, 1, .6) + .6, .4) * clamp(mIn))
      const flowOn = pp(lt, T(S, 1, .6) + 1.1, .5) * clamp(mIn)
      this.flow.style.opacity = .55 * flowOn
      this.flow.style.strokeDashoffset = -lt * 120
      this.flow.style.filter = flowOn > 0 ? 'drop-shadow(0 0 6px rgba(255,210,63,.8))' : ''
      // window views
      const vIn = S.p(lt, 1, .7, .5, E.out), sw = pp(lt, T(S, 3, .5), .3, E.in), swIn = pp(lt, T(S, 3, .5) + .25, .45, E.out)
      op(this.vRel, vIn * (1 - sw)); this.vRel.style.transform = `translateY(${(1 - vIn) * 20 - sw * 22}px)`
      op(this.vF, swIn); this.vF.style.transform = `translateY(${(1 - swIn) * 22}px)`
      let work = 0, winGlow = pp(lt, T(S, 3, .5) + .3, .4) * (1 - pp(lt, T(S, 3, .5) + 1.6, .6))

      // ---------- L2: 3 → 7 → 47 → 2207 ----------
      const L = this.pipeLen, pipe = this.pipeIn
      const cyc = clamp(d2 * .2, .9, 1.85), ride = .55 * cyc, dropD = .16 * cyc, workD = .16 * cyc, emD = .16 * cyc
      const s0 = a2 + .25
      // token 0 ("3") flies from the example card into the hopper
      const tIn0 = s0 + .55 * cyc
      {
        const f = pp(lt, s0, .55 * cyc, E.io), dp = pp(lt, tIn0, dropD, E.in)
        const x = lerp(this.ex3.cx, MX, f), y = lerp(this.ex3.cy, HOPY - 40, f) - Math.sin(Math.PI * f) * 160 + dp * 110
        putCard(this.tok[0], x, y, f > 0 && dp < 1 ? 1 : 0, 1)
        this.tok[0].style.zIndex = dp > 0 ? 4 : 6
      }
      // processing k → output k+1 emerges, rides the pipe (except the last)
      const emT = [], inT = [tIn0]
      for (let k = 1; k <= 3; k++) {
        const tw = inT[k - 1] + dropD
        work = Math.max(work, pp(lt, tw, .1) * (1 - pp(lt, tw + workD, .12)))
        emT[k] = tw + workD
        inT[k] = emT[k] + emD + ride
      }
      for (let k = 1; k <= 3; k++) {
        const c = this.tok[k]
        const em = pp(lt, emT[k], emD, E.out)
        let x = MX, y = CHY - 50 + em * 52, a = em > 0 ? 1 : 0
        if (k < 3) {
          const rp = pp(lt, emT[k] + emD, ride, E.io), dp = pp(lt, inT[k], dropD, E.in)
          if (rp > 0) { const P = pipe.getPointAtLength(lerp(30, L - 8, rp)); x = P.x; y = P.y + dp * 110 }
          if (dp >= 1) a = 0
          c.style.zIndex = rp > .97 ? 4 : (em < 1 ? 4 : 6)
        } else {
          c.style.zIndex = em < 1 ? 4 : 6
        }
        putCard(c, x, y, a * (1 - pp(lt, T(S, 2, .6), .4)), 1)
      }
      // chain items appear as each output emerges
      const outChain = pp(lt, T(S, 3, .62), .5)
      const chainT = [s0, emT[1] + emD, emT[2] + emD, emT[3] + emD]
      this.chain.forEach((e, i) => {
        const k = Math.floor(i / 2), isArrow = i % 2 === 1
        const t = isArrow ? chainT[k + 1] - .15 : chainT[k]
        const q = pp(lt, t, .45)
        op(e, (q > 0 ? 1 : 0) * (1 - outChain)); wipe(e, q, 'ltr')
      })
      op(this.chainEnd, pp(lt, chainT[3] + .5, .4) * (1 - outChain))
      // contrast strip
      const stIn = pp(lt, T(S, 2, .64), .6), stOut = S.p(lt, 3, 0, .5)
      const A = pp(lt, T(S, 2, .64), .5, E.out), Bq = pp(lt, T(S, 2, .74), .5, E.out)
      ;[this.sA, this.sAn].forEach(e => rise(e, A * (1 - stOut), 16))
      this.sArrow.set(pp(lt, T(S, 2, .64) + .3, .7)); this.sArrow.path.style.opacity = 1 - stOut
      rise(this.sAu, pp(lt, T(S, 2, .64) + .8, .4, E.out) * (1 - stOut), 16)
      rise(this.sAcap, pp(lt, T(S, 2, .64) + .7, .4) * (1 - stOut), 10)
      ;[this.sB].forEach(e => rise(e, Bq * (1 - stOut), 16))
      const hopStep = clamp((S.end(2) - T(S, 2, .76)) / 5.2, .22, .5)
      this.sBt.forEach((e, k) => rise(e, pp(lt, T(S, 2, .76) + k * hopStep, .35, E.out) * (1 - stOut), 14))
      this.sBhops.forEach((h, k) => { h.set(pp(lt, T(S, 2, .76) + (k + .45) * hopStep, .35)); h.path.style.opacity = 1 - stOut })
      rise(this.sBdots, pp(lt, T(S, 2, .76) + 4 * hopStep, .35) * (1 - stOut), 14)
      rise(this.sBcap, pp(lt, T(S, 2, .76) + 4.4 * hopStep, .4) * (1 - stOut), 10)
      op(this.sep, stIn * (1 - stOut) * .9)

      // ---------- L3 ----------
      this.kb.set(pp(lt, Math.max(a3 + .5, T(S, 3, .06)), .7, E.out))
      if (lt > a3 + 1.4) this.kb.el.style.boxShadow = `0 0 ${44 + 16 * Math.sin(lt * 2.2)}px rgba(255,210,63,.28)`
      rise(this.book, pp(lt, T(S, 3, .52), .6))
      const fc = pp(lt, T(S, 3, .66), .9)
      op(this.fchain, fc > 0 ? 1 : 0); wipe(this.fchain, fc, 'ltr')
      rise(this.fcap, pp(lt, T(S, 3, .66) + .9, .5), 12)
      // a value keeps cycling through the loop in L3 (life): reuse the "47" card look on a ghost token
      const loop = lt > a3 + 1.2 ? ((lt - a3 - 1.2) % 2.6) / 2.6 : -1
      if (loop >= 0) work = Math.max(work, loop > .82 ? 1 : 0)
      this.M.set(lt, { work, winGlow, a: clamp(mIn), s: lerp(.88, 1, clamp(mIn)) })
      // glow on the window when the narrator names f
    },
  })
})()

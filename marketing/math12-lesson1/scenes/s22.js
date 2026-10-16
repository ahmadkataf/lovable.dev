// s22 · تدرّب: التمرين ② ❶ — arithmetic: u_2 = 41, u_5 = -13 → r = -18 → u_20 = -283.
// L0: the exercise card, the yellow question «أيّ قانون يربط حدّين معلومين؟», a faded hint chip, 5 s pause ring.
// L1: the hint completes (u_m = u_p + (m-p) r); number line: u_2 = 41 (right), u_5 = -13 (left), three pink hops;
//     u_5 = u_2 + (5-2) r ⇒ -13 = 41 + 3r.
// L2: 3r = -54 ⇒ r = -18 (boxed); every hop labelled -18; sanity chip «41 → -13 نزول ⇒ r < 0 ✓».
// L3: the line zooms out; fifteen small hops run left from u_5 to u_20; u_20 = u_5 + (20-5) r = -13 + 15 × (-18).
// L4: = -13 - 270 = -283; yellow key box u_20 = -283; the point u_20 lights up.
// L5: green check: eighteen hops from u_2 give the same value.
;(() => {
  const ID = 's22'
  const Y = C.yel, G = C.grn, R = C.red, B = C.blu, P = C.pur
  const id = (k, s) => `\\htmlId{${ID}-${k}}{${s}}`
  const tc = (c, s) => `\\textcolor{${c}}{${s}}`
  const $ = k => document.getElementById(`${ID}-${k}`)
  const badge = (n, c = R) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:1.22em;height:1.22em;border-radius:50%;background:${c};color:#0b1020;font-weight:900;font-size:.78em;line-height:1;vertical-align:.1em;margin-inline-end:.3em">${n}</span>`
  const wipeF = (e, v) => { v = clamp(v); e.style.clipPath = v >= 1 ? '' : `inset(-40% ${(1 - v) * 100}% -40% -5%)`; e.style.visibility = v <= 0 ? 'hidden' : 'visible' }
  const nowrap = e => { e.style.whiteSpace = 'nowrap'; return e }
  const pill = (root, html, c, cls = 's') => {
    const d = el('div', '', null, root)
    d.style.cssText += `display:inline-flex;align-items:center;gap:12px;direction:rtl;padding:8px 24px;border-radius:999px;border:2px solid ${c}88;background:${c}1c;white-space:nowrap`
    const t = rich(html, cls); t.style.whiteSpace = 'nowrap'; d.appendChild(t)
    return d
  }

  // the number line: u_k = 77 - 18k ; zoom A (L1–L2): 41 → 1450, -13 → 700 ; zoom B (L3–L5): 41 → 1700, -283 → 260
  const AX = 560
  const U = k => 77 - 18 * k
  const XA = v => 1450 + (v - 41) * (750 / 54)
  const XB = v => 1700 + (v - 41) * (1440 / 324)

  scene('s22', {
    build(root, S) {
      this.root = root
      this.head = heading(root, 'التمرين ②')

      // ================= L0
      const c0 = card(root, 'ex', 960, 318, 1500, { anchor: 'tc', tag: '✏️ تدرَّبْ · التمرين ② · ص 11' })
      this.card0 = c0.el
      this.cardT = rich(`<span style="color:${R};font-weight:900">②</span> ${badge(1)} $(u_n)_{n\\ge0}$ متتالية حسابيّة فيها $${id('c2', 'u_2 = 41')}$ و $${id('c5', 'u_5 = -13')}$. احسب $${id('c20', 'u_{20}')}$.`, 'h3')
      this.cardT.style.textAlign = 'center'
      c0.body.appendChild(this.cardT); splitWords(this.cardT)
      this.ask = nowrap(rich('أيّ قانون يربط حدّين معلومين؟', 'h3 yel'))
      root.appendChild(this.ask); place(this.ask, 960, 590, { anchor: 'c' })
      this.cdw = el('div', '', null, root); place(this.cdw, 0, 0, { w: W, h: H })
      this.cd = countdown(this.cdw, 960, 800, 62, 'أوقف وفكّر')
      { const lb = this.cdw.lastElementChild.lastElementChild; lb.style.cssText += ';position:absolute;left:50%;top:146px;translate:-50% 0;white-space:nowrap;margin:0' }
      // hint chip (faded, top-left corner) → completes at L1
      this.hint0 = pill(root, '$u_m = u_p + \\dots$ ؟', P, 'p'); place(this.hint0, 120, 150)
      this.hint0.style.borderStyle = 'dashed'
      this.hint1 = pill(root, `$u_m = u_p + ${tc(P, '(m-p)\\,r')}$`, P, 'p'); place(this.hint1, 120, 150)
      this.hint1.style.boxShadow = `0 0 30px ${P}33`
      // given strip (next to the law chip)
      this.given = el('div', '', null, root)
      this.given.style.cssText += `display:flex;align-items:center;gap:18px;direction:rtl;padding:8px 26px;border-radius:18px;border:2px solid ${R}66;background:rgba(255,92,138,.07);white-space:nowrap`
      const gl = el('div', '', 'المعطى', this.given); gl.style.cssText = `font-size:26px;font-weight:800;color:${R}`
      const gt = rich('حسابيّة، $u_2 = 41$ ، $u_5 = -13$ · احسب $u_{20}$', 's'); gt.style.color = C.ink; gt.style.whiteSpace = 'nowrap'; this.given.appendChild(gt)

      // ================= number line (SVG + HTML labels, recomputed every frame)
      const s = svg(root, 0, 0, W, H)
      this.axis = sv(s, 'path', { d: `M140,${AX} L1776,${AX}`, stroke: C.mut, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' })
      this.axHead = sv(s, 'path', { d: `M1796,${AX} L1776,${AX - 9} L1776,${AX + 9} Z`, fill: C.mut })
      this.zTick = sv(s, 'path', { d: '', stroke: C.mut, 'stroke-width': 3 })
      this.zLab = tex('0', 'ms'); root.appendChild(this.zLab); this.zLab.style.color = C.mut
      this.brace = [0, 1].map(i => sv(s, 'path', { d: '', fill: 'none', stroke: i ? G : R, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
      this.braceL = [nowrap(rich(`$15$ قفزة، كلّ منها $${tc(R, '-18')}$`, 's')), nowrap(rich(`$18$ قفزة من $u_2$`, 's'))]
      this.braceL.forEach((e, i) => { root.appendChild(e); e.style.color = i ? G : R; e.style.fontWeight = 700 })
      this.hops = []
      for (let k = 2; k < 20; k++) {
        const path = sv(s, 'path', { d: '', fill: 'none', stroke: R, 'stroke-width': k < 5 ? 5 : 3.5, 'stroke-linecap': 'round' })
        const head = sv(s, 'path', { d: 'M0,0 L-14,-8 L-14,8 Z', fill: R })
        this.hops.push({ k, path, head })
      }
      this.hopL = [2, 3, 4].map(k => {
        const a = tex(tc(R, 'r'), 'mm'), b = tex(tc(R, '-18'), 'mm')
        ;[a, b].forEach(e => { root.appendChild(e); e.style.fontSize = '40px' })
        return { a, b }
      })
      this.dots = []
      for (let k = 2; k <= 20; k++) {
        const big = k === 2 || k === 5 || k === 20
        const c = sv(s, 'circle', { cx: 0, cy: AX, r: big ? 13 : 7, fill: big ? Y : R })
        this.dots.push({ k, c, big })
      }
      this.ring20 = sv(s, 'circle', { cx: 0, cy: AX, r: 16, fill: 'none', stroke: Y, 'stroke-width': 3, 'stroke-dasharray': '6 6' })
      const lab = (src, cls = 'mm') => { const e = tex(src, cls); root.appendChild(e); return e }
      const bi = k => `u_{${tc(B, k)}}`
      this.L2 = lab(`${bi(2)} = 41`); this.L5 = lab(`${bi(5)} = -13`)
      this.L3 = lab(bi(3), 'ms'); this.L4 = lab(bi(4), 'ms')
      this.L20q = lab(`${bi(20)} = \\,?`); this.L20 = lab(`${bi(20)} = ${tc(Y, '-283')}`)
      ;[this.L3, this.L4].forEach(e => (e.style.opacity = .8))

      // ================= L1–L2 formulas
      this.F1 = tex(`${bi(5)} = ${bi(2)} + (${tc(B, '5')}-${tc(B, '2')})\\,r \\;\\Rightarrow\\; ${id('f1b', `-13 = 41 + ${tc(R, '3')}r`)}`, 'mx')
      root.appendChild(this.F1)
      this.F2 = tex(`3r = -13 - 41 = -54 \\;\\Rightarrow\\; ${id('rb', 'r = -18')}`, 'mx')
      root.appendChild(this.F2)
      this.rBox = el('div', 'hlbox', null, root)
      this.sane = pill(root, `🎯 $41 \\to -13$: نزول، إذن $r < 0$ <span class="grn">✓</span>`, G, 'p')
      this.sane.style.fontSize = ''
      this.rChip = pill(root, `$r = ${tc(R, '-18')}$`, R, 'p')

      // ================= L3–L5 formulas
      this.F3 = tex(`${bi(20)} ${id('e3', '=')} ${bi(5)} + (${tc(B, '20')}-${tc(B, '5')})\\,r = -13 + ${tc(R, '15')}\\times(${tc(R, '-18')})`, 'mx')
      root.appendChild(this.F3)
      this.F4 = tex(`${id('e4', '=')} -13 - 270 = ${id('res', tc(Y, '-283'))}`, 'mx')
      root.appendChild(this.F4)
      this.kb = keyBox(root, `u_{20} = -283`, 1640, 818, { cls: 'mx', label: 'النتيجة' })
      this.kb.f.style.fontSize = '56px'; this.kb.el.style.padding = '20px 40px'
      this.chk = el('div', '', null, root)
      this.chk.style.cssText += `display:flex;align-items:center;gap:22px;direction:rtl;padding:10px 30px;border-radius:22px;border:2px solid ${G}88;background:rgba(110,224,90,.08)`
      const ckl = nowrap(rich('<b>تحقّق</b>', 'p')); ckl.style.color = G; this.chk.appendChild(ckl)
      this.chkF = tex(`u_{20} = u_2 + (20-2)\\,r = 41 + 18\\times(-18) = 41 - 324 = -283 \\;\\checkmark`, 'mm')
      this.chkF.style.color = G; this.chk.appendChild(this.chkF)
      place(this.chk, 960, 942, { anchor: 'c' })

      this._layout()
    },

    _sigNow() { return [this.F1, this.F2, this.F3, this.F4, this.hint1, this.given, this.chk].map(e => e.offsetWidth + 'x' + e.offsetHeight).join('|') },
    _layout() {
      const root = this.root
      this._sig = this._sigNow()
      if (!this.F1.offsetWidth) return
      const moved = [this.F1, this.F2, this.F3, this.F4, this.hint1, this.given, this.kb.el]
      const saved = moved.map(e => [e.style.transform, e.style.clipPath])
      moved.forEach(e => { e.style.transform = 'none'; e.style.clipPath = '' })
      const R_ = e => rectIn(e, root)
      const h1 = R_(this.hint1)
      place(this.given, h1.x + h1.w + 24, h1.y + h1.h / 2, { anchor: 'cl' })
      place(this.F1, 960, 742, { anchor: 'c' })
      place(this.F2, 960, 872, { anchor: 'c' })
      const rb = R_($('rb'))
      place(this.rBox, rb.x - 14, rb.y - 10, { w: rb.w + 28, h: rb.h + 20 })
      place(this.sane, 1800, 300, { anchor: 'tr' })
      place(this.rChip, 1800, 300, { anchor: 'tr' })
      // F3 centred a bit left (room for the key box on the right of F4); F4 aligned on F3's second '='
      place(this.F3, 780, 708, { anchor: 'c' })
      const e3 = R_($('e3')), e4 = R_($('e4')), f4 = R_(this.F4)
      place(this.F4, e3.x - (e4.x - f4.x), 818, { anchor: 'cl' })
      place(this.kb.el, 1790, 818, { anchor: 'cr' })
      moved.forEach((e, i) => { e.style.transform = saved[i][0]; e.style.clipPath = saved[i][1] })
    },

    render(lt, S) {
      if (this._sig !== this._sigNow()) this._layout()
      const d = i => S.end(i) - S.at(i)
      const T = (i, f) => S.at(i) + f * d(i)
      const pr = (t0, dur = .6, e = E.io) => prog(lt, t0, dur, e)

      this.head.set(S.p(lt, 0, 0, .8))

      // ================= L0: card, question, hint, ring
      const out0 = S.p(lt, 1, 0, .5)
      const ci = S.p(lt, 0, .3, .7)
      // the card sits mid-screen while it is read, then rises to make room for the question + ring
      const cm = pr(Math.max(T(0, .78), S.at(0) + 2.5) - .55, .8)
      op(this.card0, Math.min(ci, 1 - out0)); this.card0.style.transform = `translateY(${(1 - ci) * 36 + (1 - cm) * 110 - out0 * 30}px)`
      typeWords(this.cardT, S.f(lt, 0, .05, .62))
      $('c2').style.color = mixColor('#eef2ff', Y, pr(T(0, .3), .5))
      $('c5').style.color = mixColor('#eef2ff', Y, pr(T(0, .45), .5))
      $('c20').style.color = mixColor('#eef2ff', Y, pr(T(0, .62), .5))
      const qa = pr(Math.max(T(0, .78), S.at(0) + 2.5), .6)
      rise(this.ask, Math.min(qa, 1 - out0), 24)
      const hint0 = pr(Math.max(T(0, .9), S.at(0) + 3), .6)
      const hs = S.end(0), he = Math.max(hs + .5, S.at(1) - .3)
      op(this.cdw, prog(lt, Math.max(T(0, .92), S.at(0) + 3), .5) * (1 - out0))
      this.cd(Math.max(.001, clamp((lt - hs) / (he - hs))), 5 * (1 - clamp((lt - hs) / (he - hs))))
      // hint: faded, then completes at L1
      const hc = S.p(lt, 1, .2, .6)
      op(this.hint0, hint0 * .5 * (1 - hc))
      const h1 = Math.min(hc, 1)
      op(this.hint1, h1); this.hint1.style.transform = `scale(${lerp(.92, 1, E.out(h1))})`; this.hint1.style.transformOrigin = '0 50%'
      this.hint1.style.boxShadow = `0 0 ${24 + 12 * Math.sin(lt * 2)}px ${P}${h1 >= 1 ? '44' : '22'}`
      const gv = S.p(lt, 1, .5, .6)
      op(this.given, gv); this.given.style.transform = `translateX(${(1 - gv) * -30}px)`

      // ================= number line state
      const zoom = S.p(lt, 3, .25, 1.3)
      const X = v => lerp(XA(v), XB(v), zoom)
      const axP = S.p(lt, 1, .4, .8)
      draw(this.axis, axP); op(this.axHead, axP >= .98 ? 1 : 0)
      // 0 tick (orientation, only in the zoomed-in view)
      const zx = X(0), za = Math.min(pr(S.at(1) + 1.1, .5), 1 - zoom)
      this.zTick.setAttribute('d', `M${zx},${AX - 10} L${zx},${AX + 10}`); op(this.zTick, za)
      place(this.zLab, zx, AX + 22, { anchor: 'tc' }); op(this.zLab, za)
      // hops: 3 big ones in L1, 15 small ones in L3
      const tH = Math.max(T(1, .1), S.at(1) + 1.4)
      const hopDur = .55, hopGap = Math.max(.45, Math.min(.8, (T(1, .42) - tH) / 3))
      const tH3 = Math.max(T(3, .16), S.at(3) + 1.6)
      const gap3 = Math.max(.14, Math.min(.3, (T(3, .48) - tH3) / 15))
      const hopP = k => k < 5 ? pr(tH + (k - 2) * hopGap, hopDur, E.io) : pr(tH3 + (k - 5) * gap3, .32, E.io)
      // L3/L4 formula cues (each waits for the previous one, whatever the line lengths)
      const tBr = tH3 + 14 * gap3 + .4
      const tF3 = Math.max(T(3, .45), tBr + .4), dF3 = clamp(T(3, .95) - tF3, 1.1, 2.6)
      const tF4 = Math.max(S.at(4) + .3, tF3 + dF3 + .1)
      this.hops.forEach(h => {
        const x1 = X(U(h.k)), x2 = X(U(h.k + 1)), len = x1 - x2
        const hh = clamp(len * .42, 16, 120)
        const y = AX - 9, cx = (x1 + x2) / 2, cy = y - 2 * hh
        h.path.setAttribute('d', `M${x1 - 5},${y} Q${cx},${cy} ${x2 + 5},${y}`)
        const L = h.path.getTotalLength()
        const p = hopP(h.k)
        h.path.style.strokeDasharray = L; h.path.style.strokeDashoffset = L * (1 - p)
        op(h.path, p > 0 ? 1 : 0)
        const ang = Math.atan2(y - cy, (x2 + 5) - cx) * 180 / Math.PI
        const sc = h.k < 5 ? lerp(1, .7, zoom) : .75
        h.head.setAttribute('transform', `translate(${x2 + 5},${y}) rotate(${ang}) scale(${sc})`)
        op(h.head, p >= .97 ? 1 : 0)
        h.apex = { x: cx, y: y - hh }
      })
      // hop labels r → -18 (only in the zoomed-in view)
      const tM = Math.max(T(2, .5), S.at(2) + 2.4)
      const morph = pr(tM, .6)
      this.hopL.forEach((l, i) => {
        const a = this.hops[i].apex
        const show = pr(tH + i * hopGap + .35, .4) * (1 - zoom)
        place(l.a, a.x, a.y - 8, { anchor: 'bc' }); place(l.b, a.x, a.y - 8, { anchor: 'bc' })
        op(l.a, show * (1 - morph)); op(l.b, show * morph)
        l.a.style.transform = `translateY(${-morph * 14}px)`; l.b.style.transform = `translateY(${(1 - morph) * 14}px)`
      })
      // dots
      const gq = pr(Math.max(T(3, .1), S.at(3) + 1.3), .5)
      const lit20 = pr(Math.max(T(4, .62), tF4 + 1.1), .5, E.out)
      this.dots.forEach(dd => {
        const x = X(U(dd.k))
        dd.c.setAttribute('cx', x)
        let p
        if (dd.k === 2) p = S.p(lt, 1, .9, .5, E.back)
        else if (dd.k === 5) p = Math.max(S.p(lt, 1, 1.15, .5, E.back), hopP(4) >= 1 ? 1 : 0)
        else if (dd.k === 20) p = lit20
        else p = clamp((hopP(dd.k - 1) - .85) / .15)
        dd.c.style.opacity = clamp(p * 3)
        const base = dd.big ? 13 : 7
        dd.c.setAttribute('r', Math.max(0, base * (p <= 0 ? 0 : lerp(.4, 1, Math.min(1, p))) + (dd.big && p >= 1 ? 1.2 * Math.sin(lt * 2.6 + dd.k) : 0)))
        if (dd.big) dd.c.style.filter = p >= 1 ? `drop-shadow(0 0 ${8 + 4 * Math.sin(lt * 2 + dd.k)}px ${Y})` : ''
      })
      // the ghost target u_20 (from L3)
      this.ring20.setAttribute('cx', X(-283))
      op(this.ring20, gq * (1 - lit20))
      this.ring20.style.transformOrigin = `${X(-283)}px ${AX}px`
      this.ring20.style.transform = `rotate(${lt * 30}deg)`
      // labels under the axis
      const putL = (e, v, a, dy = 26) => { place(e, X(v), AX + dy, { anchor: 'tc' }); op(e, a) }
      putL(this.L2, 41, S.p(lt, 1, 1.0, .5))
      putL(this.L5, -13, S.p(lt, 1, 1.25, .5))
      putL(this.L3, 23, Math.min(pr(tH + hopDur + .1, .4), 1 - zoom) * .85, 24)
      putL(this.L4, 5, Math.min(pr(tH + hopGap + hopDur + .1, .4), 1 - zoom) * .85, 24)
      putL(this.L20q, -283, gq * (1 - lit20))
      putL(this.L20, -283, lit20)
      // braces above the hops: 15 (L3, pink) and 18 (L5, green)
      const brace = (path, lab, xa, xb, yb, dd, p) => {
        const x1 = Math.min(xa, xb), x2 = Math.max(xa, xb), xm = (x1 + x2) / 2, h = dd / 2
        // drawn right → left, the way the hops run
        path.setAttribute('d', `M${x2},${yb} Q${x2},${yb - h} ${x2 - 12},${yb - h} L${xm + 12},${yb - h} Q${xm},${yb - h} ${xm},${yb - dd} Q${xm},${yb - h} ${xm - 12},${yb - h} L${x1 + 12},${yb - h} Q${x1},${yb - h} ${x1},${yb}`)
        path._len = 0; draw(path, p)
        place(lab, xm, yb - dd - 8, { anchor: 'bc' })
      }
      const b15 = pr(tBr, .6)
      brace(this.brace[0], this.braceL[0], X(-13) - 4, X(-283) + 4, AX - 62, 22, b15)
      rise(this.braceL[0], pr(tBr + .3, .5), 12)
      const tC = S.at(5) + .3
      const b18 = pr(tC, .8)
      brace(this.brace[1], this.braceL[1], X(41), X(-283), AX - 150, 24, b18)
      rise(this.braceL[1], pr(tC + .4, .5), 12)

      // ================= L1: F1
      const out3 = S.p(lt, 3, 0, .5)
      const tF1 = Math.max(T(1, .45), tH + 2 * hopGap + hopDur + .3)
      wipeF(this.F1, pr(tF1, 1.6))
      op(this.F1, 1 - out3); this.F1.style.transform = `translateY(${-out3 * 24}px)`
      $('f1b').style.color = mixColor('#eef2ff', Y, env(lt, tF1 + 1.3, S.at(2) + .9, .4, .5))

      // ================= L2: F2, box, sanity chip
      const tF2 = Math.max(S.at(2) + .3, tF1 + 1.5)
      wipeF(this.F2, pr(tF2, 1.4))
      op(this.F2, 1 - out3); this.F2.style.transform = `translateY(${-out3 * 24}px)`
      const bx = pr(Math.max(T(2, .38), tF2 + 1.3), .5)
      op(this.rBox, Math.min(clamp(bx * 1.5), 1 - out3)); this.rBox.style.transform = `scale(${lerp(1.15, 1, E.out(bx))})`
      if (bx > 0) this.rBox.style.boxShadow = `0 0 ${24 + 10 * Math.sin(lt * 2.4)}px rgba(255,210,63,.4)`
      const sn = pr(Math.max(T(2, .7), tM + .8), .6)
      op(this.sane, Math.min(sn, 1 - out3)); this.sane.style.transform = `translateY(${(1 - sn) * 16}px)`
      const rc = pr(S.at(3) + .5, .6)
      op(this.rChip, rc); this.rChip.style.transform = `translateY(${(1 - rc) * 16}px)`

      // ================= L3: F3
      const out5 = S.p(lt, 5, 0, .5)
      wipeF(this.F3, pr(tF3, dF3))

      // ================= L4: F4 + key box
      wipeF(this.F4, pr(tF4, 1.3))
      const tKB = Math.max(T(4, .5), tF4 + 1.4)
      const kbP = pr(tKB, .7)
      this.kb.set(kbP)
      if (kbP > 0) this.kb.el.style.boxShadow = `0 0 ${46 + 16 * Math.sin(lt * 1.8)}px ${Y}${kbP >= 1 ? '44' : '22'}`
      // L5: check line
      const tCk = Math.max(T(5, .2), tC + .9, tKB + .6)
      const ck = pr(tCk, .6)
      op(this.chk, ck); this.chk.style.transform = `translateY(${(1 - ck) * 20}px)`
      wipeF(this.chkF, pr(tCk + .2, clamp(T(5, .92) - tCk, 1.2, 2.4)))
    },
  })
})()

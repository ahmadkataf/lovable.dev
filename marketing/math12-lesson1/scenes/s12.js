// s12 · من حدٍّ إلى حدّ — counting hops: from u_p to u_m there are m−p hops of length r,
// so u_m = u_p + (m−p) r; the same picture with p=2, m=7 (5 hops), then p=0: u_n = u_0 + n r.
;(() => {
  const ID = 's12'
  const pf = (S, lt, i, fr, d = .6, ease = E.io) => prog(lt, S.at(i) + fr * (S.end(i) - S.at(i)), d, ease)
  const vis = (e, pin, pout = 0, dy = 30, extra = '') => {
    op(e, clamp(pin) * (1 - clamp(pout)))
    e.style.transform = `translateY(${(1 - pin) * dy - pout * 24}px)${extra}`
  }
  const svgOp = (e, v) => { e.style.opacity = v; e.style.visibility = v <= .001 ? 'hidden' : 'visible' }

  const XS = [380, 600, 820, 1040, 1320, 1540]   // the six points (gap between 3 and 4 = "…")
  const Y = 520, AH = 58                          // baseline, arc height
  const VAR = {                                   // label variants: generic / example p=2,m=7 / p=0,m=n
    idx: [['p', 'p+1', 'p+2', 'p+3', 'm-1', 'm'], ['2', '3', '4', '5', '6', '7'], ['0', '1', '2', '3', 'n-1', 'n']],
    cnt: [['1', '2', '3', '\\cdots', 'm-p'], ['1', '2', '3', '4', '5'], ['1', '2', '3', '\\cdots', 'n']],
    u0: ['u_p', 'u_2', 'u_0'], u5: ['u_m', 'u_7', 'u_n'],
  }

  scene(ID, {
    build(root, S) {
      this.root = root
      this.head = heading(root, 'من حدٍّ إلى حدّ')

      // ---------- the number-line group (moves up in line 1) ----------
      const g = el('div', '', null, root)
      g.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:960px 520px'
      this.g = g
      const s = svg(g, 0, 0, W, H)
      this.line = sv(s, 'path', { d: `M250,${Y} L1680,${Y}`, stroke: C.mut, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' })
      this.lhead = sv(s, 'path', { d: `M1678,${Y - 9} L1696,${Y} L1678,${Y + 9} Z`, fill: C.mut })
      this.ticks = XS.map(x => sv(s, 'path', { d: `M${x},${Y - 9} L${x},${Y + 9}`, stroke: C.ink, 'stroke-width': 3 }))
      // arcs (k = 3 is the "…" gap: dashed in the general case, solid in the example)
      this.arcs = []
      for (let k = 0; k < 5; k++) {
        const xa = XS[k], xb = XS[k + 1]
        const a = arrow(s, xa, Y - 12, xb, Y - 12, { color: C.grn, width: 5, bend: -2 * AH / (xb - xa) })
        let dash = null
        if (k === 3) {
          dash = sv(s, 'path', { d: `M${xa},${Y - 12} Q${(xa + xb) / 2},${Y - 12 - 2 * AH} ${xb},${Y - 12}`, stroke: C.grn, 'stroke-width': 5, 'stroke-dasharray': '3 14', 'stroke-linecap': 'round', fill: 'none', opacity: .8 })
        }
        // counters: one per variant
        const cn = VAR.cnt.map(v => {
          const c = el('div', '', null, g)
          c.style.cssText = `display:flex;align-items:center;justify-content:center;min-width:52px;height:52px;padding:0 10px;border-radius:26px;border:2.5px solid ${C.grn}aa;background:rgba(110,224,90,.12);color:${C.ink};font-family:A;font-weight:800;font-size:28px;direction:ltr`
          c.appendChild(tex(v[k], 'ms')).style.fontSize = '28px'
          place(c, (xa + xb) / 2, Y - 12 - AH - 12, { anchor: 'bc' })
          return c
        })
        this.arcs.push({ a, dash, cn, xa, xb })
      }
      // points
      this.pts = XS.map((x, k) => {
        const big = k === 0 || k === 5
        const c = sv(s, 'circle', { cx: x, cy: Y, r: big ? 14 : 8, fill: big ? C.yel : C.ink })
        return c
      })
      this.run = sv(s, 'circle', { cx: XS[0], cy: Y, r: 11, fill: '#fff' })
      this.run.style.filter = 'drop-shadow(0 0 10px rgba(255,255,255,.9))'
      // index labels (blue) per variant
      this.idx = XS.map((x, k) => VAR.idx.map(v => {
        const t = tex(v[k], k === 0 || k === 5 ? 'mm' : 'ms'); t.style.color = C.blu
        if (!(k === 0 || k === 5)) t.style.opacity = .85
        g.appendChild(t); place(t, x, Y + 40, { anchor: 'c' }); return t
      }))
      // u labels (yellow) above the two end points
      this.uL = [0, 5].map(k => (k ? VAR.u5 : VAR.u0).map(v => {
        const t = tex(v, 'mx'); t.style.color = C.yel; g.appendChild(t)
        place(t, XS[k] + (k ? 8 : -8), Y - 34, { anchor: 'bc' }); return t
      }))
      // brace + label
      const bx0 = XS[0], bx1 = XS[5], by = Y + 78, bh = 34, mid = (bx0 + bx1) / 2
      this.brace = sv(s, 'path', { d: `M${bx0},${by} Q${bx0},${by + bh / 2} ${bx0 + 24},${by + bh / 2} L${mid - 24},${by + bh / 2} Q${mid},${by + bh / 2} ${mid},${by + bh} Q${mid},${by + bh / 2} ${mid + 24},${by + bh / 2} L${bx1 - 24},${by + bh / 2} Q${bx1},${by + bh / 2} ${bx1},${by}`, stroke: C.ink, 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round' })
      this.bL = [
        '<span class="blu">$m-p$</span> قفزة، كلّ منها $r$',
        '<span class="blu">$7-2=5$</span> قفزات، كلّ منها $r$',
        '<span class="blu">$n$</span> قفزة، كلّ منها $r$',
      ].map(h => { const t = rich(h, 'h3'); t.style.whiteSpace = 'nowrap'; g.appendChild(t); place(t, mid, by + bh + 46, { anchor: 'c' }); return t })

      // ---------- line 1: formula, book sentence, example, thumbnail ----------
      this.sent = rich('أيّاً كان العددان الطبيعيان $m$ و $p$', 'h3'); this.sent.style.whiteSpace = 'nowrap'
      root.appendChild(this.sent); place(this.sent, 960, 548, { anchor: 'c' })
      this.box = keyBox(root, `u_m = u_{\\htmlId{s12-p1}{p}} + \\textcolor{${C.blu}}{(m-\\htmlId{s12-p2}{p})}\\,r`, 960, 668, { color: C.pur })
      this.box.el.style.background = 'rgba(167,139,250,.10)'
      this.pp = ['#s12-p1', '#s12-p2'].map(q => this.box.el.querySelector(q))
      this.ex = el('div', '', null, root)
      this.ex.style.cssText = 'display:flex;align-items:center;gap:26px;direction:rtl;white-space:nowrap'
      const chipEx = el('div', 'chip', 'مثلاً', this.ex); chipEx.style.cssText += `color:${C.red};border-color:${C.red}88;background:${C.red}1f`
      this.ex.appendChild(tex(`u_7 = u_2 + \\textcolor{${C.blu}}{5}\\,r`, 'mx'))
      place(this.ex, 960, 866, { anchor: 'c' })
      this.thumb = bookThumb(root, 9, 1590, 610, 200, { x: .35, y: .082, w: .48, h: .064 })
      this.thumbL = el('div', 's', '📖 الكتاب ص 9', root); this.thumbL.style.whiteSpace = 'nowrap'; this.thumbL.style.fontSize = '26px'
      place(this.thumbL, 1690, 590, { anchor: 'bc' })

      // ---------- line 2: p = 0 ----------
      this.p0 = chip(root, '$p = 0$', 0, 0, {})
      this.p0.innerHTML = ''; this.p0.appendChild(tex('p = 0', 'mm'))
      this.p0.style.cssText += `color:${C.yel};border-color:${C.yel}aa;background:rgba(255,210,63,.12);padding:8px 26px`
      this.sp = keyBox(root, 'u_n = u_0 + n\\,r', 960, 872, { color: C.yel, label: '🎯 سنحتاجها' })
      this.sp.el.style.zIndex = 2
    },

    layout() {
      const b = rectIn(this.box.el, this.root)
      place(this.p0, b.x - 36, b.cy, { anchor: 'cr' })
      this.boxY = b.cy
    },

    render(lt, S) {
      if (!this._laid) { this.layout(); this._laid = document.fonts.check('20px KaTeX_Main') }
      this.head.set(S.p(lt, 0, 0, .7))

      // ---------- group motion (line 1: up and smaller) ----------
      const up = S.p(lt, 1, 0, .9)
      // up, smaller, and nudged left so its right end clears the heading (the book thumbnail balances the right side)
      this.g.style.transform = `translate(${-50 * up}px, ${-165 * up}px) scale(${lerp(1, .73, up)})`

      // ---------- line 0: build the picture ----------
      const L = pf(S, lt, 0, .02, .9)
      draw(this.line, L); svgOp(this.lhead, L >= .98 ? 1 : 0)
      const pA = pf(S, lt, 0, .18, .5, E.out), pB = pf(S, lt, 0, .36, .5, E.out)   // «من يو بي» … «إلى يو إم»
      // hop windows for line 0
      const hw = [.46, .53, .6, .67, .74].map(f => [f, Math.min(.5, .07 * (S.end(0) - S.at(0)))])  // hops never overlap
      const hp = hw.map(([f, d]) => pf(S, lt, 0, f, d, E.lin))
      // variant weights
      const a = pf(S, lt, 1, .58, .6), bb = pf(S, lt, 2, .05, .6)
      const wv = [clamp(1 - 2 * a), clamp(2 * a - 1) * clamp(1 - 2 * bb), clamp(2 * bb - 1)]
      // ticks & points
      this.ticks.forEach((t, k) => {
        const p = k === 0 ? pA : k === 5 ? pB : clamp(hp[k - 1] * 1.4 - .4)
        svgOp(t, p)
      })
      this.pts.forEach((c, k) => {
        const p = k === 0 ? pA : k === 5 ? pB : clamp(hp[k - 1] * 1.4 - .4)
        svgOp(c, clamp(p * 2)); c.setAttribute('r', (k === 0 || k === 5 ? 14 : 8) * lerp(.3, 1, E.back(clamp(p))))
      })
      // index & u labels
      this.idx.forEach((vs, k) => {
        const p = k === 0 ? pA : k === 5 ? pB : clamp(hp[k - 1] * 1.4 - .4)
        vs.forEach((t, v) => { op(t, p * wv[v]); t.style.transform = `translateY(${(1 - wv[v]) * 10}px)` })
      })
      this.uL.forEach((vs, j) => {
        const p = j === 0 ? pA : pB
        vs.forEach((t, v) => { op(t, p * wv[v]); t.style.transform = `translateY(${(1 - p) * 16 + (1 - wv[v]) * 10}px)` })
      })
      // arcs + counters; in line 1 the five arcs light up one by one (u_2 → u_7)
      const hl = [0, 1, 2, 3, 4].map(k => pf(S, lt, 1, .66 + k * .05, Math.min(.45, .05 * (S.end(1) - S.at(1)))))
      const hlOff = 1 - pf(S, lt, 2, 0, .6)
      this.arcs.forEach((r, k) => {
        const q = hp[k]
        if (r.dash) {
          r.a.set(a > 0 && bb < 1 ? 1 : 0); r.a.path.style.opacity = a * (1 - bb)
          svgOp(r.dash, .85 * clamp(q * 1.6) * (1 - a * (1 - bb)))
        } else r.a.set(q)
        const glow = hl[k] * hlOff
        r.a.path.style.filter = glow > 0 ? `drop-shadow(0 0 ${10 * glow}px rgba(255,210,63,.95))` : ''
        r.a.path.setAttribute('stroke-width', 5 + 3 * glow)
        r.cn.forEach((c, v) => {
          const cp = clamp(q * 2 - 1)
          op(c, cp * wv[v])
          const pulse = v === 1 ? 1 + .25 * Math.sin(Math.PI * clamp((lt - (S.at(1) + (.66 + k * .05) * (S.end(1) - S.at(1)))) / .45)) : 1
          c.style.transform = `scale(${lerp(.5, 1, E.back(cp)) * pulse})`
          c.style.borderColor = v === 1 ? mixColor('#6ee05a', '#ffd23f', glow) : C.grn + 'aa'
        })
      })
      // traveller: line 0 hops p → m; line 1 hops again 2 → 7
      let rx = XS[0], ry = Y, ro = pA
      const hopPos = (ps) => {
        let x = XS[0], y = Y
        ps.forEach((q, k) => { if (q > 0) { const e = E.io(q); x = lerp(XS[k], XS[k + 1], e); y = Y - 12 - 4 * AH * e * (1 - e) } })
        return [x, Math.min(Y, y + (y < Y ? 0 : 0))]
      }
      const h2 = [.3, .37, .44, .51, .58].map(f => pf(S, lt, 2, f, Math.min(.5, .07 * (S.end(2) - S.at(2)))))
      if (lt < S.at(1) + .56 * (S.end(1) - S.at(1))) { [rx, ry] = hopPos(hp); ro = pA * (1 - pf(S, lt, 1, .5, .4)) }
      else if (lt < S.at(2) + .2 * (S.end(2) - S.at(2))) { [rx, ry] = hopPos(hl.map(h => clamp(h))); ro = pf(S, lt, 1, .62, .3) * (1 - pf(S, lt, 2, .02, .4)) }
      else { [rx, ry] = hopPos(h2); ro = pf(S, lt, 2, .24, .35) }
      if (ry !== Y && ry > Y - 12) ry = Y
      this.run.setAttribute('cx', rx); this.run.setAttribute('cy', ry)
      svgOp(this.run, ro * .95)
      // brace + label
      const br = pf(S, lt, 0, .8, .6)
      draw(this.brace, br)
      this.bL.forEach((t, v) => { const p = v === 0 ? pf(S, lt, 0, .84, .6) : 1; op(t, p * wv[v]); t.style.transform = `translateY(${(1 - p) * 16 + (1 - wv[v]) * 10}px)` })

      // ---------- line 1: formula etc. ----------
      vis(this.sent, pf(S, lt, 1, .06, .6), 0, 20)
      const bp = pf(S, lt, 1, .14, .7)
      this.box.set(bp)
      const breathe = lt > S.at(1) + 2 ? .5 + .5 * Math.sin(lt * 2.2) : 0
      this.box.el.style.boxShadow = `0 0 ${40 + 30 * breathe}px rgba(167,139,250,${.22 + .18 * breathe})`
      const exP = pf(S, lt, 1, .62, .6)
      vis(this.ex, exP, pf(S, lt, 2, 0, .45), 24)
      const th = pf(S, lt, 1, .3, .7)
      vis(this.thumb.el, th, 0, 30, ` rotate(${lerp(4, 0, th)}deg)`)
      vis(this.thumbL, th, 0, 20)
      this.thumb.mark.style.opacity = .6 + .4 * (lt > S.at(1) + 3 ? .5 + .5 * Math.sin(lt * 3) : 1)

      // ---------- line 2: p = 0 ----------
      const pc = pf(S, lt, 2, .04, .5)
      op(this.p0, pc); this.p0.style.transform = `scale(${lerp(.6, 1, E.back(pc))})`
      const pg = pf(S, lt, 2, .08, .5)
      this.pp.forEach(e => { e.style.color = mixColor(C.ink, C.yel, pg); e.style.textShadow = `0 0 ${16 * pg}px rgba(255,210,63,.9)` })
      const sp = pf(S, lt, 2, .22, .9, E.out)
      op(this.sp.el, clamp(sp * 2.5))
      const dy = lerp((this.boxY || 668) - 872, 0, sp)
      const tag = pf(S, lt, 2, .82, .5)
      this.sp.el.style.transform = `translateY(${dy}px) scale(${lerp(.85, 1, sp) * (1 + .03 * Math.sin(Math.PI * tag))})`
      const life = lt > S.at(2) + .5 * (S.end(2) - S.at(2)) ? .5 + .5 * Math.sin(lt * 2.6) : 0
      this.sp.el.style.boxShadow = `0 0 ${50 + 30 * life * sp}px rgba(255,210,63,${.2 + .2 * life * sp})`
    },
  })
})()

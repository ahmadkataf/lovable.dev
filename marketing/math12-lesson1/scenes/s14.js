// s14 · المتتالية الهندسيّة — definition, growing/shrinking bars, u_m = u_p q^(m-p) as the multiplicative twin of the arithmetic law.
(() => {
  const ID = 's14'
  const G = C.grn, B = C.blu, Y = C.yel, R = C.red, PU = C.pur
  const tc = (c, s) => `\\textcolor{${c}}{${s}}`
  const T = (S, i, f) => S.at(i) + f * (S.end(i) - S.at(i))
  const P = (lt, S, i, f, d = .6, e = E.io) => prog(lt, T(S, i, f), d, e)
  const show = (e, pin, pout = 1, dy = 30) => { rise(e, pin, dy); op(e, pin * pout) }
  const mtex = (src, px) => { const t = tex(src, 'mm'); t.style.fontSize = px + 'px'; return t }
  const bracePath = (x1, x2, y, h) => {
    const m = (x1 + x2) / 2, q = Math.min(h, (x2 - x1) / 4)
    return `M${x1},${y} Q${x1},${y + h / 2} ${x1 + q},${y + h / 2} L${m - q},${y + h / 2} Q${m},${y + h / 2} ${m},${y + h} Q${m},${y + h / 2} ${m + q},${y + h / 2} L${x2 - q},${y + h / 2} Q${x2},${y + h / 2} ${x2},${y}`
  }
  const id = s => `${ID}-${s}`

  scene(ID, {
    build(root, S) {
      this.root = root
      this.head = heading(root, '4.1 المتتالية الهندسيّة')

      // ---------------- line 0: definition ----------------
      const cd = card(root, 'def', 960, 300, 1620, { anchor: 'tc', tag: 'تعريف 3' })
      this.card = cd.el
      this.def = rich(`نقول إنّ المتتاليةَ $(u_n)_{n\\ge0}$ <span class="yel b">متتاليةٌ هندسيّةٌ</span> إذا وُجِدَ عدد حقيقي $q$ وتحقّقت العلاقة التدريجيّة $u_{n+1} = \\htmlId{${id('xq')}}{${tc(G, 'q\\times')}}\\, u_n$ أيّاً كان العدد الطبيعي $n$. نسمّي العدد $q$ <span class="pur b" id="${id('base')}">أساس</span> المتتالية الهندسيّة.`, 'p')
      this.def.style.lineHeight = '1.75'
      cd.body.appendChild(this.def); splitWords(this.def)
      this.baseHl = el('div', 'hlbg', null, root); this.baseHl.style.background = 'rgba(167,139,250,.22)'; op(this.baseHl, 0)
      this.xqHl = el('div', 'hlbox', null, root); this.xqHl.style.borderColor = G; this.xqHl.style.boxShadow = `0 0 26px ${G}55`; op(this.xqHl, 0)
      this.book = rich(`إذن في متتالية هندسيّة ننتقل من حدٍّ إلى الحدّ الذي يليه <span class="grn b">بالضرب</span> بالعدد الحقيقي ذاته.`, 'p')
      this.book.style.cssText += `border-right:6px solid ${PU};padding-right:26px;color:${C.ink}`
      root.appendChild(this.book); place(this.book, 1800, 668, { anchor: 'tr', w: 1620 })
      // little chain u0 → u1 → u2 → u3 → …
      this.ch0 = el('div', '', null, root)
      this.ch0.style.cssText += 'display:flex;align-items:center;gap:10px;direction:ltr'
      const ch0 = ['u_0', `\\xrightarrow{${tc(G, '\\times q')}}`, 'u_1', `\\xrightarrow{${tc(G, '\\times q')}}`, 'u_2', `\\xrightarrow{${tc(G, '\\times q')}}`, 'u_3', `\\xrightarrow{${tc(G, '\\times q')}}`, '\\cdots']
      this.ch0p = ch0.map(s => { const t = mtex(s, 54); this.ch0.appendChild(t); return t })
      place(this.ch0, 960, 860, { anchor: 'c' })

      // ---------------- line 1: bars ----------------
      const bw = 84, gap = 56, unit = 24, base = 790
      Object.assign(this, { bw, gap, unit, base })
      const s = svg(root, 0, 0, W, H)
      this.barSvg = s
      const defs = sv(s, 'defs')
      const grad = (gid, c) => { const g = sv(defs, 'linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }); sv(g, 'stop', { offset: 0, 'stop-color': c, 'stop-opacity': .95 }); sv(g, 'stop', { offset: 1, 'stop-color': c, 'stop-opacity': .45 }) }
      grad(id('gG'), G); grad(id('gR'), R)
      const mkPanel = (x0, vals, color, gid, lab, chipHtml) => {
        const xs = vals.map((_, k) => x0 + k * (bw + gap))
        const axis = sv(s, 'path', { d: `M${x0 - 24},${base} L${xs[4] + bw + 24},${base}`, stroke: C.mut, 'stroke-width': 3, fill: 'none' })
        const bars = vals.map(() => sv(s, 'rect', { x: 0, y: base, width: bw, height: 0, rx: 8, fill: `url(#${gid})`, stroke: color, 'stroke-width': 3 }))
        const vl = vals.map((v, k) => { const t = mtex(String(v), 38); root.appendChild(t); place(t, xs[k] + bw / 2, base - v * unit - 30, { anchor: 'c' }); return t })
        const arcs = [], arcL = []
        for (let k = 1; k < 5; k++) {
          const a = xs[k - 1] + bw / 2, b = xs[k] + bw / 2
          arcs.push(arrow(s, a + 6, base + 16, b - 6, base + 16, { color, width: 3.5, bend: .32 }))
          const t = mtex(tc(color, lab), 34); root.appendChild(t); place(t, (a + b) / 2, base + 74, { anchor: 'c' }); arcL.push(t)
        }
        const c = chip(root, chipHtml, xs[2] + bw / 2, 300, { anchor: 'c', color }); c.style.whiteSpace = 'nowrap'
        return { xs, vals, axis, bars, vl, arcs, arcL, chip: c }
      }
      this.pG = mkPanel(200, [1, 2, 4, 8, 16], G, id('gG'), '\\times 2', `${rich('$q = 2$', 's').innerHTML} : تتضاعف`)
      this.pR = mkPanel(1080, [16, 8, 4, 2, 1], R, id('gR'), '\\times \\tfrac12', `${rich('$q = \\tfrac12$', 's').innerHTML} : تنكمش`)
      this.vs = chip(root, rich(`حسابيّة: $+\\,r$ &nbsp;—&nbsp; هندسيّة: $\\times\\,q$`, 's').innerHTML, 960, 940, { anchor: 'c', color: Y })
      this.vs.style.cssText += ';font-size:34px;white-space:nowrap'

      // ---------------- line 2: from u_p to u_m ----------------
      this.chain = el('div', '', null, root)
      this.chain.style.cssText += 'display:flex;align-items:center;gap:12px;direction:ltr'
      const arr = `\\xrightarrow{${tc(G, '\\times q')}}`
      const cp = [`\\htmlId{${id('cu0')}}{u_p}`, arr, 'u_{p+1}', arr, 'u_{p+2}', arr, '\\cdots', arr, `\\htmlId{${id('cu1')}}{u_m}`]
      this.chp = cp.map(s => { const t = mtex(s, 60); this.chain.appendChild(t); return t })
      place(this.chain, 960, 320, { anchor: 'c' })
      const bs = svg(root, 0, 0, W, H)
      this.brace = sv(bs, 'path', { d: 'M0,0', stroke: B, 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round' })
      this.braceLab = rich(`$${tc(B, 'm-p')}$ <span class="blu b">مرّة</span>`, 'p'); root.appendChild(this.braceLab)
      this.braceLab.style.whiteSpace = 'nowrap'; place(this.braceLab, 960, 455, { anchor: 'c' })
      // arithmetic law (right), in a quiet frame
      this.ar = el('div', '', null, root)
      this.ar.style.cssText += `padding:26px 46px;border-radius:24px;border:2.5px solid ${C.mut}88;background:rgba(154,168,201,.06)`
      this.arF = tex(`\\htmlId{${id('ab')}}{u_m = u_p} \\htmlId{${id('ap')}}{${tc(Y, '+')}} \\htmlId{${id('am')}}{${tc(B, '(m-p)')}}\\,\\htmlId{${id('ar')}}{r}`, 'mx')
      this.ar.appendChild(this.arF)
      const at = el('div', '', 'حسابيّة', this.ar); at.style.cssText = `position:absolute;top:-22px;right:30px;padding:6px 18px;border-radius:999px;font-size:24px;font-weight:800;color:#0b1020;background:${C.mut}`
      place(this.ar, 1370, 650, { anchor: 'c' })
      // geometric law (left), the key box
      this.kb = keyBox(root, `\\htmlId{${id('gb')}}{u_m = u_p}\\,\\htmlId{${id('gq')}}{q}^{\\htmlId{${id('ge')}}{${tc(B, 'm-p')}}}`, 560, 650, { cls: 'mx', label: 'هندسيّة' })
      this.kb.el.style.transformOrigin = '50% 50%'
      // invisible intermediate layout u_m = u_p × q^{m-p}, aligned on the key box, only for measuring
      this.mid = tex(`\\htmlId{${id('mb')}}{u_m = u_p} \\htmlId{${id('mx')}}{\\times} \\htmlId{${id('mq')}}{q}^{\\htmlId{${id('me')}}{m-p}}`, 'mx')
      root.appendChild(this.mid); place(this.mid, 0, 0); this.mid.style.visibility = 'hidden'
      // flying copy
      this.fB = mtex('u_m = u_p', 64); this.fP = mtex(tc(Y, '+'), 64)
      this.fM = mtex(`\\htmlId{${id('fl')}}{${tc(B, '(')}}\\htmlId{${id('fi')}}{${tc(B, 'm-p')}}\\htmlId{${id('fr')}}{${tc(B, ')')}}`, 64)
      this.fR = mtex('r', 64); this.fQ = mtex('q', 64)
      ;[this.fB, this.fP, this.fM, this.fR, this.fQ].forEach(e => { root.appendChild(e); place(e, 0, 0); e.style.transformOrigin = '0 0'; op(e, 0) })
      this.fP.style.transformOrigin = '50% 50%'
      this.phrase = rich('أيّاً كان العددان الطبيعيان $m$ و $p$', 'p'); root.appendChild(this.phrase)
      this.phrase.style.whiteSpace = 'nowrap'; place(this.phrase, 560, 805, { anchor: 'c' })
      this.leg1 = chip(root, rich(`الجمع $${tc(Y, '+')}$ ← الضرب $${tc(Y, '\\times')}$`, 's').innerHTML, 1370, 800, { anchor: 'c' })
      this.leg2 = chip(root, rich(`الجداء $${tc(B, '(m-p)')}\\,r$ ← القوّة $q^{${tc(B, 'm-p')}}$`, 's').innerHTML, 1370, 885, { anchor: 'c' })
      ;[this.leg1, this.leg2].forEach(c => { c.style.whiteSpace = 'nowrap'; c.style.fontSize = '30px'; c.style.color = C.ink })
    },

    // glyph-dependent geometry, measured once the KaTeX fonts are loaded (transforms neutralised first)
    measure() {
      if (this._m || document.fonts.status !== 'loaded') return
      this._m = true
      const root = this.root, R_ = e => rectIn(typeof e === 'string' ? document.getElementById(id(e)) : e, root)
      const resets = [this.card, this.ar, this.kb.el, this.chain, ...this.chp]
      const keep = resets.map(e => e.style.transform)
      resets.forEach(e => { e.style.transform = 'none' })
      // definition highlights
      const b = R_(document.getElementById(id('base')))
      place(this.baseHl, b.x - 8, b.y + 4, { w: b.w + 16, h: b.h - 8 })
      const xq = R_('xq'); place(this.xqHl, xq.x - 8, xq.y - 6, { w: xq.w + 16, h: xq.h + 12 })
      // chain brace (blue) under u_p … u_m
      const c0 = R_('cu0'), c1 = R_('cu1'), cr = R_(this.chain)
      this.brace.setAttribute('d', bracePath(c0.x + 4, c1.x + c1.w - 4, cr.y + cr.h + 8, 30))
      place(this.braceLab, (c0.x + c1.x + c1.w) / 2, cr.y + cr.h + 78, { anchor: 'c' })
      // morph geometry: source (arithmetic), middle (u_m = u_p × q^{m-p}) aligned on the key box base, final (key box)
      const gb = R_('gb'), mb0 = R_('mb')
      place(this.mid, gb.x - mb0.x, gb.y - mb0.y)
      const src = { b: R_('ab'), p: R_('ap'), m: R_('am'), r: R_('ar') }
      const mid = { b: R_('mb'), x: R_('mx'), q: R_('mq'), e: R_('me') }
      const fin = { b: R_('gb'), q: R_('gq'), e: R_('ge') }
      place(this.fB, src.b.x, src.b.y); place(this.fP, src.p.x, src.p.y); place(this.fM, src.m.x, src.m.y)
      place(this.fR, src.r.x, src.r.y); place(this.fQ, src.r.x, src.r.y)
      const fi = R_('fi'), fm = R_(this.fM)
      this.geo = { src, mid, fin, fiOff: { x: fi.x - fm.x, y: fi.y - fm.y, w: fi.w, h: fi.h }, qOff: R_(this.fQ) }
      resets.forEach((e, k) => { e.style.transform = keep[k] })
    },

    render(lt, S) {
      this.measure()
      this.head.set(S.p(lt, 0, 0, .7))

      // ======== line 0: definition card ========
      const out1 = 1 - S.p(lt, 1, 0, .5)
      show(this.card, S.p(lt, 0, .15, .7), out1, 40)
      typeWords(this.def, clamp((lt - S.at(0) - .4) / Math.max(1.5, .4 * (S.end(0) - S.at(0)))))
      const pxq = P(lt, S, 0, .5, .5)
      op(this.xqHl, clamp(pxq * 1.5) * out1 * (1 - .4 * P(lt, S, 0, .8, .6)))
      this.xqHl.style.transform = `scale(${lerp(1.15, 1, E.out(pxq))})`
      const pb = P(lt, S, 0, .84, .6)
      op(this.baseHl, (pb > 0 ? 1 : 0) * out1); this.baseHl.style.transform = `scaleX(${E.out(pb)})`
      show(this.book, P(lt, S, 0, .4, .7), out1, 24)
      const t0 = T(S, 0, .52)
      this.ch0p.forEach((e, k) => { const p = prog(lt, t0 + k * .22, .45); op(e, p * out1); e.style.transform = `translateX(${(1 - p) * -20}px)` })

      // ======== line 1: bars ========
      const out2 = 1 - S.p(lt, 2, 0, .5)
      op(this.barSvg, out2)
      const L1 = S.end(1) - S.at(1)
      const step = Math.min(.9, .085 * L1)
      const runPanel = (pn, f0, f1) => {
        const tStart = T(S, 1, f0), dt = (T(S, 1, f1) - tStart) / 4
        const { xs, vals, bars, vl, arcs, arcL, axis, chip: ch } = pn
        const pAx = prog(lt, tStart - .3, .5)
        draw(axis, pAx)
        show(ch, prog(lt, tStart - .3, .5), out2, 16)
        bars.forEach((r, k) => {
          const tk = tStart + k * dt
          let x, h, o
          if (k === 0) { const p = prog(lt, tk, step, E.out); x = xs[0]; h = vals[0] * this.unit * p; o = p > 0 ? 1 : 0 }
          else {
            const ps = prog(lt, tk, step * .45), pg = prog(lt, tk + step * .45, step * .55, E.out)
            x = lerp(xs[k - 1], xs[k], ps); h = lerp(vals[k - 1], vals[k], pg) * this.unit
            o = ps > 0 ? 1 : 0
            r.style.fillOpacity = lerp(.35, 1, pg)
          }
          r.setAttribute('x', x); r.setAttribute('y', this.base - h); r.setAttribute('height', Math.max(0, h))
          r.style.opacity = o
          const pv = prog(lt, tk + step * .8, .35)
          pop(vl[k], pv); op(vl[k], clamp(pv * 2.5) * out2)
          if (k > 0) { arcs[k - 1].set(prog(lt, tk + step * .3, .5)); arcs[k - 1].path.style.opacity = 1; show(arcL[k - 1], prog(lt, tk + step * .4, .4), out2, 10) }
        })
      }
      runPanel(this.pG, .05, .38)
      runPanel(this.pR, .5, .82)
      show(this.vs, P(lt, S, 1, .86, .6), out2, 20)

      // ======== line 2: u_m = u_p q^(m-p) ========
      this.chp.forEach((e, k) => {
        const p = P(lt, S, 2, .03 + k * .032, .5)
        op(e, p * lerp(1, .55, P(lt, S, 2, .5, .8))); e.style.transform = `translateX(${(1 - p) * -24}px)`
      })
      draw(this.brace, P(lt, S, 2, .32, .7))
      show(this.braceLab, P(lt, S, 2, .35, .6), 1, 14)
      show(this.ar, P(lt, S, 2, .42, .7), 1, 30)
      const pk = P(lt, S, 2, .5, .6)
      this.kb.set(pk)
      this.kb.el.style.boxShadow = `0 0 ${42 + 16 * Math.sin(lt * 1.6)}px ${Y}3a`
      // flying copy: arithmetic → u_m = u_p × q^{m-p} → u_m = u_p q^{m-p}
      const g = this.geo
      const tF = Math.max(T(S, 2, .54), T(S, 2, .5) + .5)
      const f1 = prog(lt, tF, 1.0), f2 = prog(lt, tF + 1.35, .6), sw = prog(lt, tF + 1.9, .35)
      const vis = (lt >= tF ? 1 : 0) * (1 - sw)
      op(this.kb.f, sw)
      if (g) {
        const mv = (e, from, to1, to2, s1 = 1, s2 = s1) => {
          const x = lerp(lerp(from.x, to1.x, f1), to2.x, f2) - from.x
          const y = lerp(lerp(from.y, to1.y, f1), to2.y, f2) - from.y
          const sc = lerp(lerp(1, s1, f1), s2, f2)
          e.style.transform = `translate(${x}px,${y}px) scale(${sc})`
        }
        const arc = Math.sin(Math.PI * f1) * -60
        // base
        mv(this.fB, g.src.b, g.mid.b, g.fin.b); this.fB.style.translate = `0 ${arc}px`; op(this.fB, vis)
        // + turns into × and fades as the factors close up
        const px = g.src.p.x + g.src.p.w / 2, py = g.src.p.y + g.src.p.h / 2
        const qx = g.mid.x.x + g.mid.x.w / 2, qy = g.mid.x.y + g.mid.x.h / 2
        this.fP.style.transform = `translate(${lerp(0, qx - px, f1)}px,${lerp(0, qy - py, f1) + arc * 1.3}px) rotate(${45 * prog(lt, tF + .2, .7)}deg)`
        op(this.fP, vis * (1 - f2))
        // (m-p) → exponent m-p
        const s1 = g.mid.e.h / g.fiOff.h, s2 = g.fin.e.h / g.fiOff.h
        const fromM = { x: g.src.m.x, y: g.src.m.y }
        const toMid = { x: g.mid.e.x - g.fiOff.x * s1, y: g.mid.e.y - g.fiOff.y * s1 }
        const toFin = { x: g.fin.e.x - g.fiOff.x * s2, y: g.fin.e.y - g.fiOff.y * s2 }
        mv(this.fM, fromM, toMid, toFin, s1, s2); this.fM.style.translate = `0 ${arc * .7}px`; op(this.fM, vis)
        ;[id('fl'), id('fr')].forEach(k => { document.getElementById(k).style.opacity = 1 - prog(lt, tF + .1, .5) })
        // r → q
        const qOff = { x: g.src.r.x, y: g.src.r.y }
        const toQm = { x: g.mid.q.x, y: g.mid.q.y }, toQf = { x: g.fin.q.x, y: g.fin.q.y }
        mv(this.fR, qOff, toQm, toQf); mv(this.fQ, qOff, toQm, toQf)
        this.fR.style.translate = `0 ${arc * 1.15}px`; this.fQ.style.translate = `0 ${arc * 1.15}px`
        const rq = prog(lt, tF + .3, .5)
        op(this.fR, vis * (1 - rq)); op(this.fQ, vis * rq)
      }
      show(this.phrase, P(lt, S, 2, .74, .6), 1, 16)
      show(this.leg1, P(lt, S, 2, .8, .5), 1, 16)
      show(this.leg2, P(lt, S, 2, .86, .5), 1, 16)
    },
  })
})()

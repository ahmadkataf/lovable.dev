// s18 · تكريساً للفهم — the three ways to study the direction of a sequence, then method ① (sign of the
// difference) on the book's example u_n = (n²+1)/(2n), with every step the book skips: common denominator,
// the two expansions (green / pink), the subtraction that covers the whole second bracket, the n³ cancellation,
// the sign argument with braces, and finally a model answer + a small green staircase of the real values.
// Cued to the 7 lines of the final script.json (0 methods · 1 example · 2 common denominator · 3 expansions ·
// 4 subtraction/result · 5 sign argument · 6 model answer).
// The derivation "scrolls": each new row arrives in the lower slot while the previous one moves up.
;(() => {
  const Y = C.yel, G = C.grn, R = C.red, B = C.blu
  const INK = '#eef2ff'
  const id = (k, s) => `\\htmlId{s18-${k}}{${s}}`
  const tc = (c, s) => `\\textcolor{${c}}{${s}}`
  const $ = k => document.getElementById('s18-' + k)

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

  // slots of the derivation (row centres)
  const S1 = 455, S2 = 628, S3 = 790

  scene('s18', {
    build(root, S) {
      this.root = root
      // ---------------- line 0: headings, subtitle, three method cards, book page
      this.h0 = heading(root, 'تكريساً للفهم')
      this.h1 = heading(root, `${badge(1)}دراسة إشارة الفرق $u_{n+1}-u_n$`)
      this.sub = rich(`كيف ندرس جهة اطّراد متتالية $(u_n)_{n\\ge0}$؟ <span class="mute">ثمّة ثلاث طرائق:</span>`, 'h3')
      root.appendChild(this.sub); place(this.sub, 1800, 292, { anchor: 'tr' }); this.sub.style.whiteSpace = 'nowrap'
      this.thumb = bookThumb(root, 10, 126, 150, 168, { x: .06, y: .205, w: .9, h: .13 }).el

      const mtxt = [
        null,
        'كتابة $u_n = f(n)$، إن أمكن، ثم دراسة اطّراد التابع $f$',
        'عندما تكون الحدود موجبة تماماً: مقارنة $\\dfrac{u_{n+1}}{u_n}$ والعدد $1$',
      ]
      this.mc = [0, 1, 2].map(k => {
        const c = card(root, 'def', 1800 - k * 580, 440, 520, { anchor: 'tr', tag: `الطريقة ${k + 1}`, h: 330 })
        c.body.style.cssText += ';height:100%;display:flex;flex-direction:column;justify-content:center;gap:18px'
        if (k === 0) {
          c.body.appendChild(rich('دراسة إشارة الفرق', 'h3'))
          const f = tex('u_{n+1}-u_n', 'mx'); const w = el('div', 'ctr', null, c.body); w.appendChild(f); f.style.color = Y
        } else { const t = rich(mtxt[k], 'p'); t.style.lineHeight = k === 2 ? 1.95 : 1.6; c.body.appendChild(t) }
        c.el.style.transformOrigin = '50% 50%'
        return { el: c.el, cx: 1800 - k * 580 - 260, cy: 440 + 165 }
      })
      this.trk = tracker(root, 1)

      // ---------------- line 1: the book's example
      const ex = card(root, 'ex', 960, 404, 1400, { anchor: 'tc', tag: 'مثال' })
      this.ex = ex.el
      ex.body.style.cssText += ';display:flex;flex-direction:column;align-items:center;gap:8px'
      this.exT = rich(`لنتأمّل المتتالية $(u_n)_{n\\ge1}$ المعرّفة وفق الصيغة`, 'h3')
      ex.body.appendChild(this.exT)
      const l2 = el('div', '', null, ex.body); l2.style.cssText = 'display:flex;align-items:center;gap:34px;direction:rtl'
      const ef = tex(id('def', `u_n = \\dfrac{n^2+1}{${id('den', '2n')}}`), 'mx'); l2.appendChild(ef)
      const ec = rich(`في حالة $${id('cond', 'n\\ge1')}$`, 'h3'); l2.appendChild(ec); ec.style.whiteSpace = 'nowrap'
      this.exU = el('div', 'uline', null, root); this.exU.style.background = B
      this.note = el('div', '', null, root)
      this.note.style.cssText += `padding:12px 34px;border-radius:20px;border:2px solid ${B}77;background:rgba(56,189,248,.09)`
      const nt = rich(`$n_0 = 1$ لأنّ المقام $2n$ ينعدم عند $n = 0$`, 'p'); nt.style.color = B; nt.style.whiteSpace = 'nowrap'
      this.note.appendChild(nt)
      place(this.note, 960, 760, { anchor: 'tc' })

      // ---------------- line 2: common denominator · line 3: the two expansions
      this.given = el('div', '', null, root)
      this.given.style.cssText += `display:flex;align-items:center;gap:22px;direction:rtl;padding:10px 26px;border-radius:18px;border:2px solid ${R}66;background:rgba(255,92,138,.07)`
      const gl = el('div', '', 'مثال', this.given); gl.style.cssText = `font-size:26px;font-weight:800;color:${R}`
      const gf = tex('u_n = \\dfrac{n^2+1}{2n}\\,,\\quad n\\ge 1', 'ms'); this.given.appendChild(gf)
      place(this.given, 120, 292)
      this.skip = chip(root, '✍️ خطوات لم يكتبها الكتاب', 1800, 300, { anchor: 'tr', color: Y })
      this.skip.style.whiteSpace = 'nowrap'

      const nb = tc(B, 'n+1')
      const lhs = 'u_{n+1}-u_n'
      const mk = src => { const f = tex(src, 'mm'); f.style.fontSize = '56px'; root.appendChild(f); return f }
      this.rA = mk(`${lhs} ${id('ea', '=')} \\dfrac{(${nb})^2+1}{2(${nb})} - \\dfrac{n^2+1}{2n}`)
      this.rB = mk(`${id('lb', lhs)} ${id('eb', '=')} \\dfrac{${id('bg', 'n\\left[(n+1)^2+1\\right]')} - ${id('bp', '(n+1)(n^2+1)')}}{${id('bd', '2n(n+1)')}}`)
      this.labB = rich('توحيد المقامين', 's'); root.appendChild(this.labB); this.labB.style.whiteSpace = 'nowrap'
      this.labC = rich('نشر البسط', 's'); root.appendChild(this.labC); this.labC.style.whiteSpace = 'nowrap'
      const panel = (src, c) => {
        const d = el('div', '', null, root)
        d.style.cssText += `padding:10px 30px;border-radius:18px;border:2px solid ${c}88;background:${c}14;box-shadow:0 0 30px ${c}18`
        const f = tex(src, 'mm'); f.style.fontSize = '42px'; f.style.color = c; d.appendChild(f)
        return d
      }
      this.pG = panel(`n\\left[(n+1)^2+1\\right] = n(n^2+2n+2) = \\boldsymbol{n^3+2n^2+2n}`, G)
      this.pR = panel(`(n+1)(n^2+1) = \\boldsymbol{n^3+n^2+n+1}`, R)

      // ---------------- line 4: the subtraction, the cancellation, the result
      this.rD = mk(`${id('ld', lhs)} ${id('ed', '=')} \\dfrac{${tc(G, `(${id('c1', 'n^3')}+2n^2+2n)`)} \\; ${id('mn', '-')} ${id('pk', tc(R, `(${id('c2', 'n^3')}+n^2+n+1)`))}}{2n(n+1)}`)
      this.rE = mk(`${id('ee', '=')} \\dfrac{n^2+n-1}{2n(n+1)}`)
      this.pkBox = el('div', 'hlbox', null, root); this.pkBox.style.borderColor = R; this.pkBox.style.boxShadow = `0 0 30px ${R}55`
      this.warn = el('div', '', null, root)
      this.warn.style.cssText += `padding:10px 30px;border-radius:999px;border:2px solid ${C.org}aa;background:#2a2230`
      const wt = rich(`⚠️ الطرح يشمل الكلّ: $${tc(R, '-n^3-n^2-n-1')}$`, 'p'); wt.style.whiteSpace = 'nowrap'; wt.style.fontSize = '36px'; this.warn.appendChild(wt)
      const ws = svg(root, 0, 0, W, H); this.wArrow = sv(ws, 'path', { fill: 'none', stroke: C.org, 'stroke-width': 4, 'stroke-linecap': 'round' })
      this.wHead = sv(ws, 'path', { fill: C.org })
      this.wSvg = ws
      this.strikes = [0, 1].map(() => { const s = el('div', '', null, root); s.style.cssText += `height:6px;border-radius:3px;background:${Y};box-shadow:0 0 12px ${Y}aa;transform-origin:0 50%`; return s })

      // the boxed result
      this.kb = keyBox(root, `u_{n+1}-u_n = \\dfrac{${id('kn', 'n^2+n-1')}}{${id('kd', '2n(n+1)')}}`, 960, 520, { cls: 'mx', label: 'نتيجة الكتاب' })
      this.kdU = el('div', 'uline', null, root); this.kdU.style.background = G; this.kdU.style.transformOrigin = '0 50%'
      this.kdL = tex(`${tc(G, '2n(n+1) > 0')}`, 'mm'); root.appendChild(this.kdL)
      this.kdT = rich('المقام موجب تماماً', 's'); this.kdT.style.color = G; root.appendChild(this.kdT); this.kdT.style.whiteSpace = 'nowrap'
      this.bookLine = rich(`إشارة $u_{n+1}-u_n$ تماثل إشارة $${tc(Y, 'n^2+n-1')}$`, 'h3')
      root.appendChild(this.bookLine); place(this.bookLine, 960, 800, { anchor: 'tc' }); this.bookLine.style.whiteSpace = 'nowrap'

      // ---------------- line 5: sign argument (its own layer, so row + braces + labels move together)
      this.g4 = el('div', '', null, root); this.g4.style.cssText += 'position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:960px 640px'
      this.sRow = el('div', '', null, this.g4)
      this.sRow.style.cssText += 'display:flex;align-items:center;gap:40px;direction:rtl'
      this.sF = tex(`n^2+n-1 = ${id('s1', 'n^2')} + ${id('s2', '(n-1)')} ${id('gt', tc(G, '> 0'))}`, 'mx')
      this.sRow.appendChild(this.sF)
      this.sCond = el('div', '', null, this.sRow)
      this.sCond.style.cssText += `padding:8px 26px;border-radius:999px;border:2px solid ${B}88;background:rgba(56,189,248,.1)`
      const sc = rich('في حالة $n \\ge 1$', 'p'); sc.style.color = B; sc.style.whiteSpace = 'nowrap'; this.sCond.appendChild(sc)
      place(this.sRow, 960, 640, { anchor: 'c' })
      const bs = svg(this.g4, 0, 0, W, H)
      this.br = [0, 1].map(() => sv(bs, 'path', { fill: 'none', stroke: G, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))
      this.brL = [tc(G, '> 0'), tc(G, '\\ge 0')].map(s => { const f = tex(s, 'mm'); this.g4.appendChild(f); return f })
      // the conclusion under the sign argument (leaves when the model answer takes over)
      this.co = el('div', '', null, root)
      this.co.style.cssText += `padding:10px 38px;border-radius:999px;border:2px solid ${G}88;background:rgba(110,224,90,.08)`
      const cot = rich(`إذن $(u_n)_{n\\ge1}$ متتالية <b>متزايدة تماماً</b>`, 'h3'); cot.style.color = G; cot.style.whiteSpace = 'nowrap'
      this.co.appendChild(cot)
      place(this.co, 960, 800, { anchor: 'tc' })

      // ---------------- line 6: model answer card + staircase (right column)
      const mc = card(root, 'exam', 1800, 292, 790, { anchor: 'tr', tag: '✍️ نموذج الكتابة', h: 690 })
      this.mcEl = mc.el
      this.m1 = rich('أيّاً كان $n \\ge 1$:', 'p'); mc.body.appendChild(this.m1)
      const mfw = el('div', 'ctr', null, mc.body); mfw.style.margin = '6px 0 4px'
      this.mF = tex(`u_{n+1}-u_n = \\dfrac{n^2+n-1}{2n(n+1)} ${tc(G, '> 0')}`, 'mm'); mfw.appendChild(this.mF)
      this.m3 = rich(`إذن $(u_n)_{n\\ge1}$ متتالية <b>متزايدة تماماً</b>`, 'p'); mc.body.appendChild(this.m3)
      this.m3.style.color = G
      splitWords(this.m1); splitWords(this.m3)
      // mini plot of u_1..u_4 (inside the card, card-local coordinates)
      const vals = [1, 5 / 4, 5 / 3, 17 / 8], labs = ['u_1 = 1', 'u_2 = \\dfrac54', 'u_3 = \\dfrac53', 'u_4 = \\dfrac{17}{8}']
      const pl = plot(this.mcEl, 70, 372, 640, 270, { xmin: .45, xmax: 4.55, ymin: .55, ymax: 2.35 })
      pl.xAxis.setAttribute('stroke', C.dim); pl.yAxis.setAttribute('stroke', C.dim)
      this.plAx = [pl.xAxis, pl.yAxis]
      const st = sv(pl.s, 'g')
      this.steps = vals.slice(0, 3).map((v, k) => {
        const x0 = pl.X(k + 1), x1 = pl.X(k + 2), y0 = pl.Y(v), y1 = pl.Y(vals[k + 1])
        return sv(st, 'path', { d: `M${x0},${y0} L${x1},${y0} L${x1},${y1}`, fill: 'none', stroke: G, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .9 })
      })
      this.dots = vals.map((v, k) => {
        const c = sv(pl.s, 'circle', { cx: pl.X(k + 1), cy: pl.Y(v), r: 11, fill: G })
        c.style.transformOrigin = `${pl.X(k + 1)}px ${pl.Y(v)}px`
        return c
      })
      this.vl = vals.map((v, k) => { const e = pl.label(`<bdi class="m">${katex.renderToString(labs[k], KOPT)}</bdi>`, k + 1, v, 'bc', 's'); e.style.marginTop = '-16px'; e.style.color = INK; e.style.fontSize = '25px'; e.style.lineHeight = 1; return e })
      this.nl = vals.map((v, k) => { const e = pl.label(`${k + 1}`, k + 1, .55, 'tc', 's'); e.style.marginTop = '8px'; e.style.fontSize = '24px'; return e })
      this.ok = chip(this.mcEl, '✓ الحدود تصعد فعلاً', 104, 382, { color: G })
      this.ok.style.fontSize = '26px'; this.ok.style.whiteSpace = 'nowrap'

      this._layout()
    },

    _sigNow() { return [this.rA, this.rB, this.rD, this.rE, this.sF, this.kb.f, this.pG, this.warn].map(e => e.offsetWidth).join('|') },

    // Positions that depend on measured KaTeX boxes. KaTeX fonts may still be loading during build(),
    // so render() calls this again whenever the measured widths change.
    _layout() {
      const root = this.root
      this._sig = this._sigNow()
      if (!this.rA.offsetWidth) return
      const moved = [this.rA, this.rB, this.rD, this.rE, this.kb.el, this.g4, this.sRow, this.ex]
      const saved = moved.map(e => e.style.transform)
      moved.forEach(e => (e.style.transform = 'none'))
      const R_ = e => rectIn(e, root)
      // all derivation rows share one vertical through their '='
      const rows = [this.rA, this.rB, this.rD, this.rE], eqs = [$('ea'), $('eb'), $('ed'), $('ee')]
      let L = 0, Rr = 0
      const off = rows.map((r, i) => { const rr = R_(r), q = R_(eqs[i]); const o = q.cx - rr.x; L = Math.max(L, o); Rr = Math.max(Rr, rr.w - o); return o })
      const X = 960 + (L - Rr) / 2
      const ys = [S1, S2, S2, S2]
      rows.forEach((r, i) => place(r, X - off[i], ys[i], { anchor: 'cl' }))
      const rb = R_(this.rB)
      place(this.labB, 1800, S2, { anchor: 'cr' })
      if (rb.x + rb.w > 1800 - this.labB.offsetWidth - 30) place(this.labB, rb.x + rb.w + 26, S2 + 70, { anchor: 'cl' })
      // the two expansions, stacked, centred
      place(this.pG, 960, S3 - 8, { anchor: 'tc' }); place(this.pR, 960, S3 + 84, { anchor: 'tc' })
      const gw = this.pG.offsetWidth
      place(this.labC, 960 + gw / 2 + 40, S3 + 76, { anchor: 'cl' })
      // pink outline around "− ( … )" and the warning under it
      const pk = R_($('pk')), mn = R_($('mn'))
      // keep the outline clear of the green ")" on the left and of the fraction bar below
      const fl = this.rD.querySelector('.frac-line'), flY = fl ? R_(fl).y : pk.y + pk.h + 14
      const ox = mn.x - 12, oy = Math.min(pk.y, mn.y) - 8, ow = pk.x + pk.w - ox + 12
      const oh = Math.min(pk.y + pk.h + 6, flY - 5) - oy
      place(this.pkBox, ox, oy, { w: ow, h: oh })
      const pcx = ox + ow / 2
      const wr = this.warn.offsetWidth
      const wx = Math.min(1800 - wr / 2, Math.max(120 + wr / 2, pcx))
      const wy = S3 - 46                                         // just under the denominator of the row
      place(this.warn, wx, wy, { anchor: 'tc' })
      this.wArrow.setAttribute('d', `M${pcx},${wy - 4} L${pcx},${oy + oh + 16}`)
      this.wHead.setAttribute('d', `M${pcx - 10},${oy + oh + 20} L${pcx + 10},${oy + oh + 20} L${pcx},${oy + oh + 6} Z`)
      this.wArrow._len = 0
      // strikes: a clean diagonal through each n³ (bottom-left → top-right)
      ;[$('c1'), $('c2')].forEach((c, i) => {
        const r = R_(c), x1 = r.x - 4, y1 = r.y + r.h * .8, x2 = r.x + r.w + 4, y2 = r.y + r.h * .2
        place(this.strikes[i], x1, y1 - 3, { w: Math.hypot(x2 - x1, y2 - y1) })
        this.strikes[i]._ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
      })
      // example card underline under 2n
      const dn = R_($('den'))
      place(this.exU, dn.x - 4, dn.y + dn.h + 2, { w: dn.w + 8 })
      // result box: green underline + label under the denominator
      const kd = R_($('kd'))
      place(this.kdU, kd.x - 6, kd.y + kd.h + 4, { w: kd.w + 12 })
      const kbr = R_(this.kb.el)
      place(this.kdL, kd.cx, kbr.y + kbr.h + 22, { anchor: 'tc' })
      place(this.kdT, kd.cx + this.kdL.offsetWidth / 2 + 24, kbr.y + kbr.h + 22 + this.kdL.offsetHeight / 2, { anchor: 'cl' })
      // sign argument braces (g4 is untransformed here, so its coordinates are stage coordinates)
      ;['s1', 's2'].forEach((k, i) => {
        const r = R_($(k)), y = r.y + r.h + 8, x1 = r.x + 2, x2 = r.x + r.w - 2, xm = (x1 + x2) / 2, d = 18
        this.br[i].setAttribute('d', `M${x1},${y} Q${x1},${y + d / 2} ${x1 + 10},${y + d / 2} L${xm - 10},${y + d / 2} Q${xm},${y + d / 2} ${xm},${y + d} Q${xm},${y + d / 2} ${xm + 10},${y + d / 2} L${x2 - 10},${y + d / 2} Q${x2},${y + d / 2} ${x2},${y}`)
        this.br[i]._len = 0
        place(this.brL[i], xm, y + d + 8, { anchor: 'tc' })
      })
      this.kbC = { x: kbr.cx, y: kbr.cy }
      moved.forEach((e, i) => (e.style.transform = saved[i]))
    },

    render(lt, S) {
      if (this._sig !== this._sigNow()) this._layout()
      const d = i => S.end(i) - S.at(i)
      const T = (i, f) => S.at(i) + f * d(i)
      const pr = (t0, dur = .6, e = E.io) => prog(lt, t0, dur, e)

      // ================= line 0: the three methods
      const out1 = S.p(lt, 1, 0, .45)
      this.h0.set(S.p(lt, 0, 0, .8)); op(this.h0.el, 1 - out1)
      this.h1.set(S.p(lt, 1, .35, .8))
      const sb = S.p(lt, 0, .5, .7)
      rise(this.sub, sb, 24); op(this.sub, Math.min(sb, 1 - out1))
      const th = S.p(lt, 0, .9, .7)
      op(this.thumb, Math.min(th, 1 - out1)); this.thumb.style.transform = `translateY(${(1 - th) * 20}px) rotate(-2deg)`
      const emph = pr(T(0, .44), .7)
      this.mc.forEach((m, k) => {
        const inP = pr(Math.max(S.at(0) + .9, T(0, .1)) + k * .32, .7, E.out)
        const col = S.p(lt, 1, .05 + k * .08, .75, E.io)
        const tgt = TRK(k + 1)
        const sc = (k === 0 ? 1 + .05 * emph : 1 - .04 * emph) * lerp(1, .09, col)
        const dx = k === 0 ? -14 * emph * (1 - col) : 0
        // gentle life while the three cards hold: a slow, out-of-phase float
        const fl = Math.sin(lt * 1.1 + k * 1.9) * 5 * inP * (1 - col)
        m.el.style.transform = `translate(${(tgt.x - m.cx) * col + dx}px, ${(tgt.y - m.cy) * col + (1 - inP) * -40 + fl}px) scale(${sc})`
        const dim = k === 0 ? 1 : 1 - .62 * emph
        op(m.el, Math.min(inP, dim, 1 - clamp((col - .25) / .45)))
        if (k === 0) {
          const gl = emph * (1 + .3 * Math.sin(lt * 2.2))
          m.el.style.borderColor = mixColor('#a78bfa', Y, emph)
          m.el.style.boxShadow = `0 30px 80px rgba(0,0,0,.35), 0 0 ${50 * gl}px rgba(255,210,63,${.35 * gl})`
        }
      })
      this.trk.set(S.p(lt, 1, .45, .7), lt, .25)

      // ================= line 1: the example
      const out2 = S.p(lt, 2, 0, .5)
      const ei = S.p(lt, 1, .7, .7)
      op(this.ex, Math.min(ei, 1 - out2))
      const exF = Math.sin(lt * 1.2) * 4 * ei                    // slow float while the example holds
      this.ex.style.transform = `translateY(${(1 - ei) * 36 - out2 * 30 + exF}px)`
      const rd = env(lt, T(1, .1), T(1, .62), .4, .5)
      $('def').style.color = mixColor(INK, Y, rd)
      const cd = env(lt, T(1, .66), S.at(2), .4, .4)
      $('cond').style.color = mixColor(INK, B, Math.max(cd, pr(T(1, .7), .5)))
      const nI = pr(Math.max(T(1, .72), S.at(1) + 1.6), .6)
      op(this.exU, Math.min(nI > 0 ? 1 : 0, 1 - out2)); this.exU.style.transform = `translateY(${exF - out2 * 30}px) scaleX(${E.out(nI)})`
      $('den').style.color = mixColor(INK, B, nI)
      const nP = pr(Math.max(T(1, .72), S.at(1) + 1.6) + .3, .6)
      rise(this.note, nP, 24); op(this.note, Math.min(nP, 1 - out2))

      // ================= line 2: common denominator (Step 1)
      const gi = S.p(lt, 2, .3, .6)
      slide(this.given, gi, -40)
      const tA = S.at(2) + .35, tB = Math.max(T(2, .3), tA + 1.2)
      const sk = pr(Math.max(T(2, .62), tB + 1.1), .6)
      const skOut = S.p(lt, 5, 0, .5)
      op(this.skip, Math.min(sk, 1 - skOut)); this.skip.style.transform = `translateY(${(1 - sk) * -16}px)`
      const up3 = S.p(lt, 4, 0, .7)                                 // line 4: A leaves, B → slot 1
      wipe(this.rA, pr(tA, 1.1)); op(this.rA, 1 - up3); this.rA.style.transform = `translateY(${-up3 * 50}px)`
      const lb = pr(tB + .6, .6), lbOut = S.p(lt, 4, 0, .4)
      op(this.labB, Math.min(lb, 1 - lbOut)); this.labB.style.transform = `translateX(${(1 - lb) * 20}px)`
      $('bd').style.color = mixColor(INK, Y, env(lt, tB + .7, S.at(3) + .4, .4, .5))

      // ================= line 3: the two expansions — each product takes its colour, then green, then pink
      const cG = S.p(lt, 3, .15, .5), cR = S.p(lt, 3, .5, .5)
      $('bg').style.color = mixColor(INK, G, cG * (1 - up3)); $('bp').style.color = mixColor(INK, R, cR * (1 - up3))
      const tG = Math.max(T(3, .55), S.at(3) + 1.2), tR = Math.max(T(3, .78), tG + 1)
      const gP = pr(tG, .6), rP = pr(tR, .6)
      const pOut = S.p(lt, 4, 0, .45)
      const gG = env(lt, tG + .45, tR + .2, .3, .5), gR = env(lt, tR + .45, S.at(4) - .2, .3, .6)   // glow as each is named
      ;[[this.pG, gP, gG, G], [this.pR, rP, gR, R]].forEach(([e, p, g, c]) => {
        op(e, Math.min(p, 1 - pOut)); e.style.transform = `translateY(${(1 - p) * 30 + pOut * 20}px) scale(${1 + .025 * g})`
        e.style.boxShadow = `0 0 ${30 + 26 * g}px ${c}${Math.round(24 + 80 * g).toString(16).padStart(2, '0')}`
      })
      op(this.labC, Math.min(gP, 1 - pOut))

      // ================= line 4: subtraction, cancellation, result
      // Minimum gaps shrink when the spoken line is short, so every beat (book line included) lands inside line 4.
      const k4 = clamp(d(4) / 12, .55, 1)
      const tD = S.at(4) + .45
      const tO = Math.max(T(4, .07), tD + 1.1 * k4), tW = tO + .35
      const tS = Math.max(T(4, .33), tW + .8 * k4)
      const tUp = Math.max(T(4, .45), tS + 1 * k4)                  // scroll: D → slot 1, E written in slot 2
      const tK = Math.max(T(4, .62), tUp + 1.5 * k4)                // clear → boxed result
      const outK = pr(tK, .45)
      wipe(this.rB, pr(tB, 1.1))
      const bOut = pr(tUp - .1, .35)                                // B clears slot 1 before D moves in
      op(this.rB, 1 - bOut); this.rB.style.transform = `translateY(${(S1 - S2) * up3 - bOut * 60}px)`
      op($('lb'), up3)
      const dUp = pr(tUp + .15, .7)
      wipe(this.rD, pr(tD, 1.1)); op(this.rD, 1 - outK); this.rD.style.transform = `translateY(${(S1 - S2) * dUp - outK * 30}px)`
      op($('ld'), dUp)
      wipe(this.rE, pr(tUp + .6, .9)); op(this.rE, 1 - outK); this.rE.style.transform = `translateY(${-outK * 30}px)`
      // the pink outline + warning leave before the row scrolls up (no empty frame left behind)
      const ob = pr(tO, .5), oOut = Math.max(pr(tUp - .45, .4), outK)
      op(this.pkBox, Math.min(clamp(ob * 1.5), 1 - oOut)); this.pkBox.style.transform = `scale(${lerp(1.12, 1, E.out(ob))})`
      const wv = pr(tW, .6)
      rise(this.warn, wv, 20); op(this.warn, Math.min(wv, 1 - oOut))
      draw(this.wArrow, wv); this.wArrow.style.opacity = 1 - oOut; op(this.wHead, Math.min(wv >= .95 ? 1 : 0, 1 - oOut))
      this.strikes.forEach((s, i) => {
        const p = pr(tS + i * .3, .45, E.out)
        op(s, Math.min(p > .02 ? 1 : 0, 1 - outK)); s.style.transform = `translateY(${(S1 - S2) * dUp}px) rotate(${s._ang || -24}deg) scaleX(${p})`
      })
      ;['c1', 'c2'].forEach((k, i) => (op($(k), 1 - .6 * pr(tS + i * .3 + .3, .5))))
      // the result in its box, then the denominator and the book line
      const kbIn = pr(tK + .35, .7)                                 // after the derivation rows have cleared
      const up5 = S.p(lt, 5, 0, .9)
      const coOut = S.p(lt, 6, 0, .35)                              // line 6: the conclusion clears first,
      const tSl = S.at(6) + .2                                      // then the algebra slides left + model answer
      const sl = pr(tSl, .9)
      // keyBox: centre (960,520) → (960,392)·0.82 → (545,548)·0.66
      const kx = lerp(0, -402, sl), ky = lerp(0, -128, up5) + lerp(0, 156, sl)
      const ks = lerp(1, .82, up5) * lerp(1, .8, sl)
      op(this.kb.el, clamp(kbIn * 2.5))
      this.kb.el.style.transform = `translate(${kx}px, ${ky}px) scale(${lerp(.85, 1, E.back(kbIn)) * ks})`
      if (kbIn > 0) this.kb.el.style.boxShadow = `0 0 ${46 + 14 * Math.sin(lt * 1.8)}px ${Y}${kbIn >= 1 ? '3a' : '22'}`
      const out5 = S.p(lt, 5, 0, .45)
      const tU = Math.max(T(4, .72), tK + 1.2 * k4)
      const uP = pr(tU, .6)
      op(this.kdU, Math.min(uP > 0 ? 1 : 0, 1 - out5)); this.kdU.style.transform = `scaleX(${E.out(uP)})`
      $('kd').style.color = mixColor(INK, G, Math.min(uP, 1 - out5))
      rise(this.kdL, Math.min(pr(tU + .3, .5), 1 - out5), 16); op(this.kdT, Math.min(pr(tU + .5, .5), 1 - out5))
      const tL = Math.max(T(4, .86), tU + 1 * k4)
      rise(this.bookLine, pr(tL, .6), 24); op(this.bookLine, Math.min(pr(tL, .6), 1 - out5))

      // ================= line 5: sign argument, conclusion
      $('kn').style.color = mixColor(INK, Y, Math.max(pr(tL + .2, .6) * (1 - out5), up5))
      const tF = S.at(5) + .45
      const tC = Math.max(T(5, .08), tF + .7), tB2 = Math.max(T(5, .3), tC + .6), tB1 = Math.max(T(5, .5), tB2 + .9)
      const tGt = Math.max(T(5, .66), tB1 + .9)
      const tCo5 = Math.max(T(5, .8), tGt + .8)
      const fI = pr(tF, .9)
      wipe(this.sF, fI)
      op(this.sRow, fI > 0 ? 1 : 0)
      const cI = pr(tC, .5); op(this.sCond, cI); this.sCond.style.transform = `translateX(${(1 - cI) * -24}px)`
      ;[tB1, tB2].forEach((t, i) => {
        const p = pr(t, .7)
        draw(this.br[i], p); rise(this.brL[i], pr(t + .35, .5), 14)
        $(i ? 's2' : 's1').style.color = mixColor(INK, G, p)
      })
      const gtP = pr(tGt, .5); op($('gt'), gtP); $('gt').style.display = 'inline-block'; $('gt').style.transform = `scale(${lerp(1.5, 1, E.out(gtP))})`
      const coP = pr(tCo5, .6)
      rise(this.co, Math.min(coP, 1 - coOut), 20)
      if (coP >= 1 && coOut <= 0) this.co.style.boxShadow = `0 0 ${26 + 10 * Math.sin(lt * 2)}px ${G}33`

      // ================= line 6: the algebra slides left, model answer + staircase
      // sign layer: centre (960,640) → (545,770)·0.72
      this.g4.style.transform = `translate(${-402 * sl}px, ${124 * sl}px) scale(${lerp(1, .72, sl)})`
      const mI = pr(tSl + .5, .7)                                   // the card comes in once the left column has made room
      op(this.mcEl, mI); this.mcEl.style.transform = `translateX(${(1 - mI) * 70}px)`
      typeWords(this.m1, pr(tSl + .75, .5, E.lin))
      wipe(this.mF, pr(tSl + 1, 1))
      const tCo = Math.max(T(6, .3), tSl + 1.75)
      typeWords(this.m3, pr(tCo, .8, E.lin))
      const tP = Math.max(T(6, .42), tSl + 1.6)                     // «والحدود تصعد فعلاً»
      const ax = pr(tP, .5)
      this.plAx.forEach(a => draw(a, ax))
      this.nl.forEach(e => op(e, ax))
      const stepT = Math.max(.32, Math.min(.55, (S.dur - .8 - tP) / 5))
      this.dots.forEach((c, k) => {
        const p = pr(tP + .3 + k * stepT, .45, E.back)
        c.style.opacity = clamp(p * 3); c.style.transform = `scale(${Math.max(0, p)})`
        c.setAttribute('r', p >= 1 ? 11 + .9 * Math.sin(lt * 2.5 + k) : 11)
        rise(this.vl[k], pr(tP + .45 + k * stepT, .4), 12)
      })
      this.steps.forEach((s, k) => draw(s, pr(tP + .45 + k * stepT, stepT + .1, E.lin)))
      pop(this.ok, pr(tP + .45 + 3 * stepT + .25, .5))
    },
  })
})()

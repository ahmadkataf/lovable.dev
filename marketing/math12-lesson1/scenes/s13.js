// s13 · مجموع حدود حسابيّة — Gauss pairing as a picture, then the book's formulas and a counting warning.
(() => {
  const ID = 's13'
  const G = C.grn, B = C.blu, Y = C.yel, R = C.red
  const tc = (c, s) => `\\textcolor{${c}}{${s}}`
  // time at fraction f of line i, and eased progress of a beat starting there
  const T = (S, i, f) => S.at(i) + f * (S.end(i) - S.at(i))
  const P = (lt, S, i, f, d = .6, e = E.io) => prog(lt, T(S, i, f), d, e)
  const show = (e, pin, pout = 1, dy = 30) => { rise(e, pin, dy); op(e, pin * pout) }
  const mtex = (src, px) => { const t = tex(src, 'mm'); t.style.fontSize = px + 'px'; return t }
  const bracePath = (x1, x2, y, h) => {
    const m = (x1 + x2) / 2, q = Math.min(h, (x2 - x1) / 4)
    return `M${x1},${y} Q${x1},${y + h / 2} ${x1 + q},${y + h / 2} L${m - q},${y + h / 2} Q${m},${y + h / 2} ${m},${y + h} Q${m},${y + h / 2} ${m + q},${y + h / 2} L${x2 - q},${y + h / 2} Q${x2},${y + h / 2} ${x2},${y}`
  }

  scene(ID, {
    build(root, S) {
      this.head = heading(root, 'مجموع حدودٍ من متتالية حسابيّة')

      // ---------------- line 0–1: the staircase ----------------
      const u = 100, sq = 84, x0 = 220, yb = 830
      Object.assign(this, { u, x0, yb })
      const s = svg(root, 0, 0, W, H)
      this.stairSvg = s
      // dimension marks (line 1)
      this.dimV = sv(s, 'path', { d: `M${x0 - 34},${yb - 6 * u + 4} L${x0 - 34},${yb - 4} M${x0 - 46},${yb - 6 * u + 4} L${x0 - 22},${yb - 6 * u + 4} M${x0 - 46},${yb - 4} L${x0 - 22},${yb - 4}`, stroke: C.mut, 'stroke-width': 3, fill: 'none' })
      this.dimH = sv(s, 'path', { d: `M${x0 + 4},${yb - 6 * u - 30} L${x0 + 5 * u - 4},${yb - 6 * u - 30} M${x0 + 4},${yb - 6 * u - 42} L${x0 + 4},${yb - 6 * u - 18} M${x0 + 5 * u - 4},${yb - 6 * u - 42} L${x0 + 5 * u - 4},${yb - 6 * u - 18}`, stroke: C.mut, 'stroke-width': 3, fill: 'none' })
      // column highlight frames (behind the squares)
      this.colHl = [0, 1, 2, 3, 4].map(i => sv(s, 'rect', { x: x0 + i * u + 3, y: yb - 6 * u - 4, width: u - 6, height: 6 * u + 8, rx: 16, fill: 'rgba(255,210,63,.10)', stroke: Y, 'stroke-width': 3 }))
      const mk = (g, i, j, fill, stroke) => {
        const r = sv(g, 'rect', { x: x0 + i * u + (u - sq) / 2, y: yb - (j + 1) * u + (u - sq) / 2, width: sq, height: sq, rx: 14, fill, stroke, 'stroke-width': 3 })
        r.style.transformBox = 'fill-box'; r.style.transformOrigin = '50% 50%'
        return r
      }
      this.gG = sv(s, 'g'); this.green = []
      for (let i = 0; i < 5; i++) { const col = []; for (let j = 0; j <= i; j++) col.push(mk(this.gG, i, j, 'rgba(110,224,90,.30)', G)); this.green.push(col) }
      this.gB = sv(s, 'g'); this.blue = []
      for (let i = 0; i < 5; i++) for (let j = 0; j <= i; j++) this.blue.push(mk(this.gB, i, j, 'rgba(56,189,248,.28)', B))
      this.cx = x0 + 2.5 * u; this.cy = yb - 2.5 * u
      this.rectOut = sv(s, 'rect', { x: x0 - 4, y: yb - 6 * u - 4, width: 5 * u + 8, height: 6 * u + 8, rx: 18, fill: 'none', stroke: Y, 'stroke-width': 4 })
      this.d5 = el('div', 'h3 b', '5', root); place(this.d5, x0 + 2.5 * u, yb - 6 * u - 62, { anchor: 'c' })
      this.d6 = el('div', 'h3 b', '6', root); place(this.d6, x0 - 76, yb - 3 * u, { anchor: 'c' })
      // "15" tag on the green half
      this.t15 = el('div', '', '15', root)
      this.t15.style.cssText += `font-size:42px;font-weight:900;color:${G};background:rgba(11,16,32,.86);border:2px solid ${G};border-radius:14px;padding:0 12px;line-height:58px;box-shadow:0 0 24px ${G}55`
      place(this.t15, x0 + 3 * u, yb - 2 * u, { anchor: 'c' })   // where four squares of the green half meet
      // labels under the columns: 1..5, then pairs 1+5 … and =6
      this.num = []; this.pair = []; this.eq6 = []
      for (let i = 0; i < 5; i++) {
        const xc = x0 + (i + .5) * u
        const n = mtex(tc(G, i + 1), 40); root.appendChild(n); place(n, xc, yb + 42, { anchor: 'c' }); this.num.push(n)
        const pr = mtex(`${tc(G, i + 1)}+${tc(B, 5 - i)}`, 36); root.appendChild(pr); place(pr, xc, yb + 42, { anchor: 'c' }); this.pair.push(pr)
        const e6 = mtex(tc(Y, '=6'), 36); root.appendChild(e6); place(e6, xc, yb + 98, { anchor: 'c' }); this.eq6.push(e6)
      }
      // right panel (right-aligned, RTL)
      this.rowA = el('div', '', null, root)
      this.rowA.style.cssText += 'display:flex;align-items:center;gap:6px;direction:ltr'
      this.rowA.appendChild(mtex('1+2+3+4+5=', 52))
      const slot = el('div', '', null, this.rowA); slot.style.cssText = 'position:relative;width:74px;height:70px'
      this.qm = mtex(tc(Y, '?'), 52); slot.appendChild(this.qm); place(this.qm, 39, 35, { anchor: 'c' })
      this.q15 = mtex(tc(G, '\\mathbf{15}'), 52); slot.appendChild(this.q15); place(this.q15, 39, 35, { anchor: 'c' })
      place(this.rowA, 1800, 345, { anchor: 'cr' })
      this.rowB = rich('المستطيل: $5\\times 6 = 30$', 'h3'); root.appendChild(this.rowB); place(this.rowB, 1800, 490, { anchor: 'cr', w: 960 })
      this.rowC = rich(`الدرج نصفه: $\\dfrac{30}{2} = ${tc(G, '15')}$`, 'h3'); root.appendChild(this.rowC); place(this.rowC, 1800, 640, { anchor: 'cr', w: 960 })
      this.rowD = rich(`كلّ عمودٍ = <span class="grn b">حدٌّ من البداية</span> + <span class="blu b">حدٌّ من النهاية</span>`, 'p'); root.appendChild(this.rowD); place(this.rowD, 1800, 800, { anchor: 'cr', w: 960 })

      // ---------------- line 2: S and its reverse (the same trick, with symbols) ----------------
      const R1 = 460, R2 = 560, R3 = 770
      Object.assign(this, { R1, R2, R3 })
      const colW = [200, 244, 60, 244, 60, 244, 60, 110, 60, 244]   // label, t, +, t, +, t, +, ⋯, +, t
      const rowL = 960 - colW.reduce((a, b) => a + b, 0) / 2
      const cx = k => rowL + colW.slice(0, k).reduce((a, b) => a + b, 0)
      const cc = k => cx(k) + colW[k] / 2
      const mkRow = (cells, y) => {
        const r = el('div', '', null, root)
        r.style.cssText += 'display:flex;align-items:center;direction:ltr'
        const out = cells.map((c, k) => {
          const d = el('div', '', null, r)
          d.style.cssText = `width:${colW[k]}px;display:flex;justify-content:${k === 0 ? 'flex-end' : 'center'};padding-right:${k === 0 ? 18 : 0}px`
          if (c) d.appendChild(mtex(c, 56))
          return d
        })
        place(r, rowL, y, { anchor: 'cl' })
        return { el: r, cells: out }
      }
      const g = x => tc(G, x), b = x => tc(B, x), al = tc(Y, '(a+\\ell)')
      this.r1 = mkRow([`${tc(Y, 'S')} =`, g('a'), '+', g('(a+r)'), '+', g('(a+2r)'), '+', '\\cdots', '+', g('\\ell')], R1)
      this.r2 = mkRow([`${tc(Y, 'S')} =`, b('\\ell'), '+', b('(\\ell-r)'), '+', b('(\\ell-2r)'), '+', '\\cdots', '+', b('a')], R2)
      this.r3 = mkRow([`${tc(Y, '2S')} =`, al, '+', al, '+', al, '+', '\\cdots', '+', al], R3)
      const x1 = cx(1), x9 = cx(9) + colW[9]
      this.rule = el('div', '', null, root)
      this.rule.style.cssText += `height:3px;border-radius:2px;background:${C.mut};transform-origin:0 50%`
      place(this.rule, x1 - 10, 712, { w: x9 - x1 + 20 })
      this.plusL = mtex('+', 56); root.appendChild(this.plusL); place(this.plusL, rowL + 34, R2, { anchor: 'c' })
      // +r arrows over the first row, −r arrows under the reversed row
      const TC = [1, 3, 5, 7, 9]
      const as2 = svg(root, 0, 0, W, H)
      this.arcSvg = as2
      this.arcP = []; this.arcM = []; this.labP = []; this.labM = []
      for (let j = 0; j < 4; j++) {
        const xa = cc(TC[j]) + 16, xb = cc(TC[j + 1]) - 16, xm = (xa + xb) / 2
        this.arcP.push(arrow(as2, xa, R1 - 40, xb, R1 - 40, { color: G, width: 3.5, bend: -.26 }))
        this.arcM.push(arrow(as2, xa, R2 + 40, xb, R2 + 40, { color: R, width: 3.5, bend: .26 }))
        const lp = mtex(tc(G, '+r'), 38); root.appendChild(lp); place(lp, xm, R1 - 104, { anchor: 'c' }); this.labP.push(lp)
        const lm = mtex(tc(R, '-r'), 38); root.appendChild(lm); place(lm, xm, R2 + 104, { anchor: 'c' }); this.labM.push(lm)
      }
      // vertical pairs (yellow, line 2) and the whole counted columns (blue, line 3)
      this.pairBox = TC.map(k => {
        const bx = el('div', 'hlbox', null, root)
        place(bx, cx(k) + 8, R1 - 50, { w: colW[k] - 16, h: R2 - R1 + 100 })
        if (k === 7) bx.style.borderStyle = 'dashed'
        op(bx, 0)
        return bx
      })
      this.colBox = TC.map(k => {
        const bx = el('div', 'hlbox', null, root)
        place(bx, cx(k) + 8, R1 - 50, { w: colW[k] - 16, h: R3 - R1 + 96 })
        bx.style.borderColor = B; bx.style.boxShadow = `0 0 26px ${B}44`; bx.style.borderWidth = '3px'
        if (k === 7) bx.style.borderStyle = 'dashed'
        op(bx, 0)
        return bx
      })
      this.cnt = ['1', '2', '3', '⋯', 'n'].map((v, j) => {
        const d = el('div', '', v === 'n' ? katex.renderToString('n', KOPT) : v, root)
        d.style.cssText += v === '⋯' ? `color:${B};font-size:34px;font-weight:900` : `width:50px;height:50px;border-radius:50%;background:${B};color:#0b1020;font-weight:900;font-size:30px;display:flex;align-items:center;justify-content:center`
        place(d, cc(TC[j]), R3 + 80, { anchor: 'c' })
        return d
      })

      // ---------------- line 3: the book's statement and the boxed formula ----------------
      this.book2 = rich(`وإذا كان $${tc(Y, 'S')}$ مجموعَ $${tc(B, 'n')}$ حداً متتالياً أوّلها $${tc(G, 'a')}$ وآخرها $${tc(B, '\\ell')}$ من حدود متتالية حسابيّة، كان`, 'p')
      root.appendChild(this.book2); place(this.book2, 1800, 285, { anchor: 'tr', w: 1680 }); splitWords(this.book2)
      this.twoS = mtex(`${tc(Y, '2S')} = ${tc(B, 'n')}\\,${al}`, 64); root.appendChild(this.twoS); place(this.twoS, 0, 0, { anchor: 'c' })
      this.impl = mtex('\\Longrightarrow', 64); root.appendChild(this.impl); place(this.impl, 905, 610, { anchor: 'c' })
      this.kGen = keyBox(root, 'S = \\dfrac{n(a+\\ell)}{2}', 1290, 610, { cls: 'ml' })
      this.kGen.el.style.transformOrigin = '50% 50%'
      this.mnem = chip(root, 'عدد الحدود × (الأوّل + الأخير) ÷ 2', 1290, 830, { anchor: 'c', color: Y })
      this.mnem.style.fontSize = '32px'; this.mnem.style.whiteSpace = 'nowrap'

      // ---------------- line 4: 1+2+…+n ----------------
      this.kSp = keyBox(root, '1+2+3+\\cdots+n = \\dfrac{n(n+1)}{2}', 1260, 545, { cls: 'mx', label: 'وبوجه خاصّ' })
      this.spNote = mtex(`${tc(G, 'a')} = 1,\\quad ${tc(B, '\\ell')} = n`, 40); root.appendChild(this.spNote); place(this.spNote, 470, 470, { anchor: 'c' })
      const as = svg(root, 0, 0, W, H)
      this.spArrow = arrow(as, 470, 510, 700, 560, { color: C.mut, width: 4, bend: -.25 })
      this.ex = el('div', '', null, root)
      this.ex.style.cssText += 'display:flex;align-items:center;gap:16px;direction:ltr'
      this.ex.appendChild(mtex('1+2+\\cdots+100 = \\dfrac{100\\times 101}{2} =', 58))
      this.cnt5050 = el('div', '', '0', this.ex)
      this.cnt5050.style.cssText = `font-family:KaTeX_Main;font-size:66px;font-weight:700;color:${Y};min-width:170px;text-align:left`
      place(this.ex, 860, 815, { anchor: 'c' })
      this.gauss = chip(root, 'حيلة غاوس', 1800, 815, { anchor: 'cr', color: C.pur }); this.gauss.style.whiteSpace = 'nowrap'

      // ---------------- line 5: counting terms ----------------
      const cd = card(root, 'warn', 960, 335, 1300, { anchor: 'tc', tag: '⚠️ عدد الحدود' })
      this.card = cd.el
      cd.body.style.cssText += 'display:flex;flex-direction:column;align-items:center;gap:34px;padding-top:58px'
      this.terms = tex(`\\htmlId{${ID}-t0}{u_{30}} \\;+\\; \\htmlId{${ID}-t1}{u_{31}} \\;+\\; \\htmlId{${ID}-t2}{u_{32}}`, 'ml')
      cd.body.appendChild(this.terms)
      this.rule4 = rich('عدد الحدود = <span class="blu">الدليل الأخير</span> − <span class="blu">الدليل الأوّل</span> + 1', 'h3')
      cd.body.appendChild(this.rule4)
      const row = el('div', '', null, cd.body)
      row.style.cssText = 'display:flex;align-items:center;gap:64px;direction:ltr'
      this.res4 = tex(`${tc(B, '32')} - ${tc(B, '30')} + 1 = ${tc(G, '\\mathbf{3}')}`, 'mx'); row.appendChild(this.res4)
      const wrong = el('div', '', null, row)
      wrong.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px'
      const w2box = el('div', '', null, wrong); w2box.style.cssText = 'position:relative;display:inline-block'
      this.w2 = tex(tc(R, '2'), 'mx'); w2box.appendChild(this.w2)
      const ws = document.createElementNS(NS, 'svg'); w2box.appendChild(ws)
      ws.setAttribute('viewBox', '0 0 60 70'); ws.style.cssText = 'position:absolute;left:50%;top:50%;width:60px;height:70px;translate:-50% -50%;overflow:visible'
      this.strike = sv(ws, 'path', { d: 'M6,64 L54,6', stroke: R, 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' })
      this.w2cap = el('div', 's', 'خطأ شائع', wrong); this.w2cap.style.cssText += `color:${R};font-size:24px;font-weight:700;white-space:nowrap`
      this.wrong = wrong
      // boxes + counters over u30, u31, u32: positioned in measure() once KaTeX fonts are in
      this.tBox = [0, 1, 2].map(() => { const b = el('div', 'hlbox', null, root); op(b, 0); return b })
      this.tNum = [0, 1, 2].map(k => {
        const d = el('div', '', String(k + 1), root)
        d.style.cssText += `width:50px;height:50px;border-radius:50%;background:${B};color:#0b1020;font-weight:900;font-size:30px;display:flex;align-items:center;justify-content:center`
        place(d, 0, 0, { anchor: 'c' })
        return d
      })
      this.root = root
    },

    // geometry that depends on KaTeX glyph metrics: measured once, after the KaTeX fonts have loaded
    measure() {
      if (this._m || document.fonts.status !== 'loaded') return
      this._m = true
      const keep = this.card.style.transform
      this.card.style.transform = 'none'
      ;[0, 1, 2].forEach(k => {
        const r = rectIn(document.getElementById(`${ID}-t${k}`), this.root)
        place(this.tBox[k], r.x - 14, r.y - 8, { w: r.w + 28, h: r.h + 16 })
        place(this.tNum[k], r.cx, r.y - 44, { anchor: 'c' })
      })
      this.card.style.transform = keep
    },

    render(lt, S) {
      this.measure()
      const { u, x0, yb } = this
      this.head.set(S.p(lt, 0, 0, .7))

      // ======== lines 0–1: staircase ========
      const out2 = 1 - S.p(lt, 2, 0, .5)
      op(this.stairSvg, out2)
      // green columns, square by square, bottom-up
      const tG = T(S, 0, .28)
      this.green.forEach((col, i) => col.forEach((r, j) => {
        const p = prog(lt, tG + i * .32 + j * .07, .42, E.back)
        r.style.opacity = clamp(p * 3); r.style.transform = `scale(${Math.max(0, p)})`
      }))
      // column numbers 1..5 (become pairs during line 1)
      const tPair = i => T(S, 1, .56) + i * Math.min(.55, .07 * (S.end(1) - S.at(1)))
      this.num.forEach((n, i) => {
        const pin = prog(lt, tG + i * .32 + .1, .45)
        const sw = prog(lt, tPair(i), .5)
        show(n, pin, (1 - sw) * out2, 16)
      })
      this.pair.forEach((e, i) => { const sw = prog(lt, tPair(i), .5); show(e, sw, out2, -16) })
      this.eq6.forEach((e, i) => { const p = prog(lt, tPair(i) + .25, .45, E.back); pop(e, p); op(e, clamp(p * 2.5) * out2) })
      this.colHl.forEach((r, i) => { r.style.opacity = env(lt, tPair(i), tPair(i) + 1.1, .25, .45) * .9 })
      // blue copy: appears on the right, turns 180°, docks on top
      const tB = Math.max(T(S, 0, .6), tG + 1.9)
      const a = prog(lt, tB, .45, E.out), rot = prog(lt, tB + .45, .9), dk = prog(lt, tB + 1.45, .95)
      const D = 530
      const lift = E.io(clamp(dk / .5)), slideL = E.io(clamp((dk - .25) / .75))
      const tx = D * (1 - slideL), ty = -u * lift
      // small while it turns (so it never sweeps over the green stair or the sum), full size when docked
      const sc = lerp(lerp(.6, .75, a), 1, E.io(dk)) + .04 * Math.sin(Math.PI * dk)
      this.gB.setAttribute('transform', `translate(${tx},${ty}) rotate(${180 * rot},${this.cx},${this.cy}) translate(${this.cx},${this.cy}) scale(${sc}) translate(${-this.cx},${-this.cy})`)
      this.gB.style.opacity = a
      this.gB.style.filter = dk > 0 && dk < 1 ? `drop-shadow(0 ${14 * Math.sin(Math.PI * dk)}px 18px rgba(0,0,0,.55))` : ''
      // gentle life in the squares once the rectangle is complete
      const life = prog(lt, tB + 2.4, 1)
      this.blue.forEach((r, k) => { r.style.opacity = 1 - .12 * life * (.5 + .5 * Math.sin(lt * 1.4 + k * .7)) })
      // rectangle frame and dimensions (line 1)
      const p1 = S.p(lt, 1, 0, .9)
      draw(this.rectOut, p1); this.rectOut.style.opacity = .85
      draw(this.dimV, S.p(lt, 1, .2, .6)); draw(this.dimH, S.p(lt, 1, .2, .6))
      show(this.d5, S.p(lt, 1, .5, .5), out2, 12); show(this.d6, S.p(lt, 1, .5, .5), out2, 12)
      const pHalf = P(lt, S, 1, .3, .6)
      pop(this.t15, pHalf); op(this.t15, clamp(pHalf * 2.5) * out2)
      const gGlow = env(lt, T(S, 1, .3), T(S, 1, .3) + 1.6, .35, .6)
      this.green.flat().forEach(r => r.setAttribute('fill', `rgba(110,224,90,${(.30 + .32 * gGlow).toFixed(3)})`))
      // right panel
      show(this.rowA, S.p(lt, 0, .5, .7), out2)
      const qsw = P(lt, S, 1, .32, .5)
      op(this.qm, 1 - qsw); pop(this.q15, qsw)
      show(this.rowB, P(lt, S, 1, .06, .6), out2)
      show(this.rowC, P(lt, S, 1, .3, .6), out2)
      show(this.rowD, P(lt, S, 1, .55, .6), out2)

      // ======== line 2: S + reversed S, column by column ========
      const L = i => S.end(i) - S.at(i)
      const outRows = 1 - P(lt, S, 3, .58, .55)            // rows leave during line 3, once the counting is done
      const pr1 = P(lt, S, 2, .05, 1.3)
      wipe(this.r1.el, pr1, 'ltr'); op(this.r1.el, (pr1 > 0 ? 1 : 0) * outRows)
      const pr2 = P(lt, S, 2, .3, .8)
      op(this.r2.el, pr2 * outRows); this.r2.el.style.transform = `translateX(${(1 - pr2) * 60}px)`
      op(this.plusL, P(lt, S, 2, .38, .5) * outRows)
      const pRule = P(lt, S, 2, .38, .6)
      this.rule.style.transform = `scaleX(${pRule})`; op(this.rule, (pRule > 0 ? .8 : 0) * outRows)
      // each vertical pair glows in turn; its sum (a+ℓ) drops into the 2S row
      const step = Math.min(.7, .045 * L(2))
      const tPairK = j => T(S, 2, .46) + [0, 1, 2, 2.6, 3.2][j] * step
      this.pairBox.forEach((bx, j) => {
        const t0 = tPairK(j), e = env(lt, t0, t0 + 1.25, .3, .5)
        op(bx, e * outRows * (j === 3 ? .7 : 1)); bx.style.transform = `scale(${lerp(1.08, 1, E.out(prog(lt, t0, .4)))})`
      })
      op(this.r3.cells[0], prog(lt, tPairK(0), .5) * outRows)
      const cellJ = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4, 9: 4 }
      for (let k = 1; k <= 9; k++) {
        const p = prog(lt, tPairK(cellJ[k]) + (k % 2 ? .22 : .05), .5), c = this.r3.cells[k]
        c.style.opacity = p * outRows; c.style.transform = `translateY(${(1 - p) * -34}px)`
      }
      // "because we add r in one row and subtract it in the other"
      const outArc = 1 - S.p(lt, 3, 0, .5)
      this.arcP.forEach((a, j) => { a.set(prog(lt, T(S, 2, .7) + j * .16, .45)); a.path.style.opacity = outArc })
      this.labP.forEach((e, j) => show(e, prog(lt, T(S, 2, .7) + j * .16 + .2, .4), outArc, 10))
      this.arcM.forEach((a, j) => { a.set(prog(lt, T(S, 2, .84) + j * .16, .45)); a.path.style.opacity = outArc })
      this.labM.forEach((e, j) => show(e, prog(lt, T(S, 2, .84) + j * .16 + .2, .4), outArc, -10))

      // ======== line 3: count the n columns → 2S = n(a+ℓ) → S = n(a+ℓ)/2 ========
      op(this.book2, S.p(lt, 3, .1, .3) * (1 - S.p(lt, 4, 0, .5)))
      typeWords(this.book2, clamp((lt - S.at(3) - .1) / Math.max(1.5, .4 * L(3))))
      const tCnt = j => T(S, 3, .16) + j * Math.min(.38, .04 * L(3))
      this.colBox.forEach((bx, j) => { const p = prog(lt, tCnt(j), .4); op(bx, clamp(p * 1.5) * outRows * (j === 3 ? .7 : 1)); bx.style.transform = `scale(${lerp(1.06, 1, E.out(p))})` })
      this.cnt.forEach((d, j) => { const p = prog(lt, tCnt(j) + .1, .45); pop(d, p); op(d, clamp(p * 2.5) * outRows) })
      // 2S = n(a+ℓ): appears under the counted columns, then moves up beside the boxed formula
      const p2s = P(lt, S, 3, .44, .6), mv = P(lt, S, 3, .6, .9)
      const out2s = 1 - S.p(lt, 4, 0, .45)
      this.twoS.style.left = lerp(960, 520, mv) + 'px'; this.twoS.style.top = lerp(930, 610, mv) + 'px'
      op(this.twoS, p2s * out2s); this.twoS.style.transform = `scale(${lerp(.92, 1, p2s)})`
      op(this.impl, P(lt, S, 3, .68, .5) * out2s)
      // the boxed formula (stays, moves to the corner in line 4)
      const pk = P(lt, S, 3, .7, .7)
      const park = S.p(lt, 4, 0, .9)
      const outK = 1 - S.p(lt, 5, 0, .5)
      this.kGen.set(pk)
      const kx = lerp(0, 470 - 1290, park), ky = lerp(0, 330 - 610, park), ks = lerp(1, .6, park)
      const kpop = pk <= 0 ? .85 : lerp(.85, 1, E.back(clamp(pk)))
      this.kGen.el.style.transform = `translate(${kx}px,${ky}px) scale(${kpop * ks})`
      op(this.kGen.el, clamp(pk * 2.5) * outK)
      this.kGen.el.style.boxShadow = `0 0 ${42 + 16 * Math.sin(lt * 1.6)}px ${Y}3a`
      show(this.mnem, P(lt, S, 3, .86, .6), out2s, 20)

      // ======== line 4: 1+2+…+n ========
      const tSp = Math.max(T(S, 4, .14), S.at(4) + 1)
      const pn = prog(lt, tSp - .4, .6)
      show(this.spNote, pn, outK, 12)
      this.spArrow.set(prog(lt, tSp - .2, .6)); this.spArrow.path.style.opacity = outK
      const psp = prog(lt, tSp, .7)
      this.kSp.set(psp); op(this.kSp.el, clamp(psp * 2.5) * outK)
      this.kSp.el.style.boxShadow = `0 0 ${42 + 16 * Math.sin(lt * 1.6 + 1)}px ${Y}3a`
      const tEx = Math.max(T(S, 4, .6), tSp + 1.2)
      show(this.ex, prog(lt, tEx, .6), outK)
      counter(this.cnt5050, 0, 5050, prog(lt, tEx + .5, 1.8, E.out))
      const done = prog(lt, tEx + 2.3, .5)
      this.cnt5050.style.color = mixColor(Y, G, done)
      this.cnt5050.style.textShadow = done > 0 ? `0 0 ${24 * done}px ${G}88` : ''
      show(this.gauss, prog(lt, tEx + .2, .6), outK, 16)

      // ======== line 5: counting terms ========
      const pc = S.p(lt, 5, .35, .7)
      rise(this.card, pc, 40)
      const kk = k => Math.max(T(S, 5, .2 + k * .1), S.at(5) + 1.1 + k * .5)
      this.tBox.forEach((b, k) => { const p = prog(lt, kk(k), .45); op(b, clamp(p * 1.5)); b.style.transform = `scale(${lerp(1.15, 1, E.out(p))})` })
      this.tNum.forEach((d, k) => pop(d, prog(lt, kk(k) + .1, .45)))
      rise(this.rule4, prog(lt, Math.max(T(S, 5, .6), kk(2) + .8), .6), 20)
      const tRes = Math.max(T(S, 5, .74), kk(2) + 1.6)
      wipe(this.res4, prog(lt, tRes, .7), 'ltr')
      const tW = tRes + .9
      op(this.wrong, prog(lt, tW, .35))
      draw(this.strike, prog(lt, tW + .1, .35))
      op(this.w2cap, prog(lt, tW + .35, .4))
    },
  })
})()

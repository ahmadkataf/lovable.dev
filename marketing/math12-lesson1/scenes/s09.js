// s09 · جهة الاطّراد — تعريف 1: the five monotonic behaviours as staircases
(() => {
  // a staircase: one column per term, height ∝ u_n, bright tread on top, risers between treads
  function stairs(s, x, y, w, h, vals, col, o = {}) {
    const n = vals.length, cw = w / n, base = y + h, tw = o.tread || 5
    const H = v => v / 5 * h
    const g = sv(s, 'g')
    const items = vals.map((v, i) => {
      const cx = x + i * cw
      const r = sv(g, 'rect', { x: cx + 3, y: base - H(v), width: cw - 6, height: H(v), rx: 4, fill: col, opacity: .16 })
      r.style.transformBox = 'fill-box'; r.style.transformOrigin = '50% 100%'
      const t = sv(g, 'path', { d: `M${cx + 3},${base - H(v)} L${cx + cw - 3},${base - H(v)}`, stroke: col, 'stroke-width': tw, 'stroke-linecap': 'round' })
      return { r, t, h: H(v), cx: cx + cw / 2, top: base - H(v) }
    })
    const risers = vals.slice(1).map((v, i) => {
      const xx = x + (i + 1) * cw, a = base - H(vals[i]), b = base - H(v)
      return Math.abs(a - b) < .5 ? null : sv(g, 'path', { d: `M${xx},${a} L${xx},${b}`, stroke: col, 'stroke-width': tw * .6, opacity: .55, 'stroke-linecap': 'round' })
    })
    const axis = sv(g, 'path', { d: `M${x - 10},${base} L${x + w + 10},${base}`, stroke: C.mut, 'stroke-width': 2.5, opacity: .7 })
    // eq steps: flat junctions get a small yellow mark
    const flats = vals.slice(1).map((v, i) => Math.abs(v - vals[i]) < .01 && o.flatMark ? sv(g, 'circle', { cx: x + (i + 1) * cw, cy: base - H(v), r: tw * .9, fill: C.yel }) : null)
    return {
      g, items, cw, base,
      set(p, k0 = 0) {   // p: build progress 0..1 (columns grow one after another)
        items.forEach((it, i) => {
          const q = E.out(clamp(p * (n + 1.5) - i))
          it.r.style.transform = `scaleY(${q})`; it.r.style.opacity = q > 0 ? .16 : 0
          it.t.style.transform = `translateY(${(1 - q) * it.h}px)`; it.t.style.opacity = clamp(q * 3)
        })
        risers.forEach((r, i) => { if (r) r.style.opacity = .55 * clamp(p * (n + 1.5) - i - 1.6) })
        flats.forEach((f, i) => { if (f) f.style.opacity = clamp(p * (n + 1.5) - i - 1.8) })
        axis.style.opacity = .7 * clamp(p * 4)
      },
    }
  }
  const relOf = { sinc: '<', sdec: '>', inc: '\\le', dec: '\\ge', cst: '=' }

  scene('s09', {
    build(root, S) {
      this.F = (i, fr) => S.at(i) + fr * (S.end(i) - S.at(i))
      this.head = heading(root, '2.1 جهة اطراد متتالية')
      // the definition card: tall in phase A (two big panels), shorter in phase B (five-panel strip)
      const dc = card(root, 'def', 1800, 300, 1680, { anchor: 'tr', tag: 'تعريف 1' })
      this.dcard = dc.el
      this.dcard.style.padding = '0'

      const s = svg(root, 0, 0, W, H); s.style.direction = 'ltr'
      this.s = s
      const VAL = {
        sinc: [1, 1.7, 2.5, 3.2, 4.1, 4.9], sdec: [4.9, 4.1, 3.4, 2.5, 1.8, 1],
        inc: [1, 2.1, 2.1, 3.3, 3.3, 4.7], dec: [4.7, 3.5, 3.5, 2.3, 2.3, 1], cst: [2.8, 2.8, 2.8, 2.8, 2.8, 2.8],
      }
      const COL = { sinc: C.grn, sdec: C.red, inc: C.grn, dec: C.red, cst: C.blu }
      const NAME = { sinc: 'متزايدة تماماً', sdec: 'متناقصة تماماً', inc: 'متزايدة', dec: 'متناقصة', cst: 'ثابتة' }
      this.KEYS = ['sinc', 'sdec', 'inc', 'dec', 'cst']

      // ---------- phase A: two big panels (right: strictly increasing, left: strictly decreasing) ----------
      this.big = ['sinc', 'sdec'].map((k, j) => {
        const cx = j === 0 ? 1370 : 550, x0 = cx - 280
        const g = sv(s, 'g')
        const st = stairs(g, x0, 400, 560, 170, VAL[k], COL[k], { tread: 6 })
        const idx = st.items.map((it, i) => { const e = tex(i ? `n_0{+}${i}` : 'n_0', 'ms'); e.style.fontSize = '28px'; e.style.color = C.blu; root.appendChild(e); place(e, it.cx, st.base + 26, { anchor: 'c' }); return e })
        // riding pair highlight
        const band = sv(g, 'rect', { x: 0, y: 380, width: st.cw * 2 - 4, height: 100, rx: 12, fill: 'rgba(255,210,63,.10)', stroke: C.yel, 'stroke-width': 3 })
        const pl = tex(`u_n ${k === 'sinc' ? '<' : '>'} u_{n+1}`, 'mm'); pl.style.color = C.yel; root.appendChild(pl); place(pl, 0, 0, { anchor: 'bc' })
        const box = el('div', '', null, root)
        place(box, cx, 625, { anchor: 'tc', w: 780 })
        const t1 = rich(`${k === 'sdec' ? 'ونقول' : 'نقول'} إنّ المتتالية $(u_n)_{n\\ge n_0}$ <b style="color:${COL[k]};white-space:nowrap">${NAME[k]}</b> <span class="iff">إذا وفقط إذا</span> تحقّق الشرط:`, 'p')
        t1.style.textAlign = 'center'
        box.appendChild(t1)
        const iff = t1.querySelector('.iff'); iff.style.cssText = 'position:relative;display:inline-block'
        const ul = el('div', '', null, iff); ul.style.cssText = `position:absolute;left:0;right:0;bottom:2px;height:5px;border-radius:3px;background:${C.yel};transform-origin:100% 50%`
        splitWords(t1)
        const t2 = rich(`مهما تكن $n_0 \\le n$ يكن $u_n ${relOf[k]} u_{n+1}$`, 'h3')
        t2.style.cssText += 'text-align:center;margin-top:10px'
        box.appendChild(t2)
        const rel = t2.querySelectorAll('bdi')[1]; rel.style.color = COL[k]
        splitWords(t2)
        return { k, g, st, idx, band, pl, box, t1, t2, ul, cx }
      })

      // ---------- phase B: five compact panels ----------
      this.slotX = [1608, 1284, 960, 636, 312]
      this.small = this.KEYS.map((k, j) => {
        const cx = this.slotX[j]
        const p = el('div', '', null, root)
        place(p, cx, 335, { anchor: 'tc', w: 300, h: 425 })
        p.style.cssText += `border-radius:20px;border:2px solid ${COL[k]}55;background:linear-gradient(180deg,${COL[k]}14,rgba(20,29,56,.4))`
        const g = sv(s, 'g')
        const st = stairs(g, cx - 120, 360, 240, 130, VAL[k], COL[k], { tread: 4.5, flatMark: k === 'inc' || k === 'dec' })
        const dots = st.items.map(it => sv(g, 'circle', { cx: it.cx, cy: st.base + 12, r: 3.5, fill: C.blu }))
        const tx = el('div', 'ar', null, p)
        tx.style.cssText = 'position:absolute;left:0;right:0;top:182px;text-align:center'
        const nm = el('div', 'b', NAME[k], tx); nm.style.cssText = `font-size:36px;line-height:1.3;color:${COL[k]};font-weight:800`
        const iff = el('div', '', 'إذا وفقط إذا:', tx); iff.style.cssText = 'font-size:30px;line-height:1.45;font-weight:600;margin-top:6px;display:inline-block;padding:0 10px;border-radius:10px'
        const mh = el('div', '', null, tx); mh.style.cssText = 'position:relative;display:inline-block;margin-top:2px;padding:0 10px;isolation:isolate'
        mh.appendChild(rich('مهما تكن $n_0 \\le n$', ''))
        mh.firstChild.style.cssText = 'font-size:30px;line-height:1.45;font-weight:600'
        const mk = el('div', '', null, mh); mk.style.cssText = `position:absolute;inset:-2px 0;border-radius:10px;background:rgba(255,210,63,.24);box-shadow:0 0 0 2px ${C.yel}88;z-index:-1;transform-origin:100% 50%`
        const cond = rich(`يكن $u_n ${relOf[k]} u_{n+1}$`, '')
        cond.style.cssText = 'font-size:32px;line-height:1.5;font-weight:600;margin-top:6px;white-space:nowrap;text-align:center'
        tx.appendChild(cond)
        const relEl = cond.querySelector('bdi')
        const relNode = [...relEl.querySelectorAll('.mrel')][0]
        if (relNode) relNode.style.color = (k === 'inc' || k === 'dec') ? C.yel : COL[k]
        if ((k === 'inc' || k === 'dec') && relNode) relNode.style.textShadow = `0 0 14px ${C.yel}`
        return { k, p, g, st, dots, nm, iff, mh, mk, cond, cx }
      })

      // ---------- line 3: exam card ----------
      const ex = card(root, 'exam', 960, 858, 1420, { anchor: 'tc' })
      this.exam = ex.el
      ex.body.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:40px;direction:rtl'
      this.bad = rich('حساب $u_0,\\ u_1,\\ u_2$ <b>✗</b> لا يكفي لإثبات الاطّراد', 'p red b')
      this.good = rich('إثبات لكلّ $n \\ge n_0$ <b>✓</b>', 'p grn b')
      this.bad.style.whiteSpace = this.good.style.whiteSpace = 'nowrap'
      this.bad.style.fontSize = this.good.style.fontSize = '36px'
      ex.body.appendChild(this.bad)
      this.vs = el('div', '', null, ex.body); this.vs.style.cssText = 'width:3px;height:54px;border-radius:2px;background:rgba(255,255,255,.18)'
      ex.body.appendChild(this.good)
      this.exam.style.padding = '26px 44px 22px'
    },

    render(lt, S) {
      const F = this.F
      this.head.set(S.p(lt, 0, 0, .7))
      const toB = S.p(lt, 2, 0, .9)                     // phase A → phase B
      rise(this.dcard, S.p(lt, 0, .15, .6), 30)
      this.dcard.style.height = lerp(590, 495, toB) + 'px'

      // ---------- phase A ----------
      const bigT = [  // [build start, sentence start/end, condition start/end, sweep start/end] per panel
        { line: 0, st: [.02, .2], s1: [.2, .48], s2: [.5, .74], sw: [.76, .98], ul: .38 },
        { line: 1, st: [.0, .25], s1: [.02, .42], s2: [.45, .76], sw: [.76, .98], ul: .22 },
      ]
      this.big.forEach((b, j) => {
        const T = bigT[j], i = T.line
        const a = j === 0 ? 1 : S.p(lt, 1, 0, .5)
        // phase A leaves quickly at line 2 (no text over the incoming strip); it still drifts toward its slot
        const fade = (1 - S.p(lt, 2, 0, .45)) * (j === 0 ? lerp(1, .55, S.p(lt, 1, 0, .6)) : 1)
        // line 0: the first panel is centred on the card; it moves aside when the second one arrives
        const c0 = j === 0 ? (960 - b.cx) * (1 - S.p(lt, 1, 0, .9)) : 0
        const sl = this.slotX[j] - b.cx, sc = lerp(1, .45, E.io(toB))
        const tf = `translate(${sl * E.io(toB) + c0}px, ${-40 * E.io(toB)}px) scale(${sc})`
        b.g.style.transformOrigin = `${b.cx}px 450px`; b.g.style.transform = tf; b.g.style.opacity = fade * a
        b.box.style.transformOrigin = '50% 0'; b.box.style.opacity = fade * a
        b.box.style.transform = `translate(${sl * E.io(toB) + c0}px, ${-120 * E.io(toB)}px) scale(${sc})`
        // the second panel waits until the first has slid out of its way
        const G = fr => Math.max(F(i, fr), j === 1 ? S.at(1) + .75 : -1e9)
        b.st.set(clamp((lt - G(T.st[0])) / Math.max(.8, G(T.st[1]) - G(T.st[0]))))
        b.idx.forEach((e, k) => { op(e, fade * a * clamp((lt - G(T.st[0])) / Math.max(.8, G(T.st[1]) - G(T.st[0])) * 7.5 - k)); e.style.transform = `translateX(${c0}px)` })
        typeWords(b.t1, clamp((lt - G(T.s1[0])) / Math.max(.6, G(T.s1[1]) - G(T.s1[0]))))
        const up = prog(lt, G(T.ul), .6)
        op(b.ul, up > 0 ? 1 : 0); b.ul.style.transform = `scaleX(${up})`
        typeWords(b.t2, clamp((lt - G(T.s2[0])) / Math.max(.6, G(T.s2[1]) - G(T.s2[0]))))
        // the comparison rides across every pair n, n+1 (n from n0 on)
        const bandIn = prog(lt, G(T.s2[0]) + .3, .5)
        const pos = 4 * E.io(clamp((lt - G(T.sw[0])) / Math.max(.8, G(T.sw[1]) - G(T.sw[0]))))
        const k0 = Math.min(3, Math.floor(pos)), fr = pos - k0
        const it0 = b.st.items
        const topY = Math.min(lerp(it0[k0].top, it0[k0 + 1].top, fr), lerp(it0[k0 + 1].top, it0[Math.min(5, k0 + 2)].top, fr))
        b.band.setAttribute('x', lerp(it0[k0].cx, it0[k0 + 1].cx, fr) - b.st.cw / 2 + 2)
        b.band.setAttribute('y', topY - 12); b.band.setAttribute('height', b.st.base - topY + 16)
        b.band.style.opacity = bandIn
        const cxp = lerp(it0[k0].cx, it0[k0 + 1].cx, fr) + b.st.cw / 2
        b.pl.style.left = (cxp + c0) + 'px'; b.pl.style.top = (topY - 18) + 'px'
        op(b.pl, bandIn * fade * a)
      })

      // ---------- phase B ----------
      const smallIn = [S.at(2) + .42, S.at(2) + .56, Math.max(F(2, .24), S.at(2) + .9), Math.max(F(2, .38), S.at(2) + 1.4), Math.max(F(2, .6), S.at(2) + 2)]
      const iffLit = this.KEYS.map((_, j) => prog(lt, F(2, .8) + j * .12, .4) * (1 - prog(lt, S.at(3) + .2, .6)))
      this.small.forEach((m, j) => {
        const p = prog(lt, smallIn[j], .6)
        m.p.style.opacity = p
        m.p.style.transform = `translateY(${(1 - E.out(p)) * 30}px) scale(${lerp(.92, 1, E.out(p))})`
        m.g.style.opacity = p
        m.st.set(prog(lt, smallIn[j] + .1, 1.0, E.lin))
        m.dots.forEach(d => (d.style.opacity = p))
        // «إذا وفقط إذا» lights up in all five
        const L = iffLit[j]
        m.iff.style.color = L > 0 ? mixColor(C.ink, C.yel, L) : ''
        m.iff.style.background = `rgba(255,210,63,${.16 * L})`
        m.iff.style.textShadow = L > 0 ? `0 0 ${16 * L}px rgba(255,210,63,.7)` : ''
        // line 3: the sweep across «مهما تكن n0 ≤ n»
        const sw = prog(lt, F(3, .04) + j * .16, .55)
        const breathe = prog(lt, F(3, .04) + j * .16 + .6, 1) * (.5 + .5 * Math.sin(lt * 2.2 - j * .7))
        m.mk.style.opacity = sw > 0 ? 1 - .22 * breathe : 0
        m.mk.style.transform = `scaleX(${sw})`
      })

      // ---------- line 3: exam card ----------
      // «حساب ثلاثة حدود قد ينفي الاطّراد» → the pink side; «لكنّه لا يثبته» → the green side
      rise(this.exam, prog(lt, F(3, .46), .6), 24)
      slide(this.bad, prog(lt, F(3, .48), .6), -30)
      op(this.vs, prog(lt, F(3, .7), .4))
      slide(this.good, prog(lt, F(3, .78), .6), -30)
    },
  })
})()

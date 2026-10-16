// s21 · تدرّب: التمرين ① — u_n = 2^n / 3^(n+1) is geometric.
// Lines (script.json, 6 lines):
// L0: book page 11 (exercise ① highlighted) → the exercise card, the goal chip, a 5 s pause ring.
// L1 (sub): u_{n+1} = 2^{n+1}/3^{(n+1)+1} = 2^{n+1}/3^{n+2}, the substituted n+1 in blue.
// L2 (num): the hunt for u_n starts (pieces of the given glow): 2^{n+1} = 2 × 2^n (2^n yellow).
// L3 (den): 3^{n+2} = 3 × 3^{n+1} (3^{n+1} yellow); the line now reads u_{n+1} = (2·2^n)/(3·3^{n+1}).
// L4 (res): the yellow pieces are pulled out → 2/3 × 2^n/3^{n+1} = 2/3 u_n; green result box q = 2/3; u_0 = 1/3.
// L5 (exam, short line + 2 s hold): model answer card + exam footnote (u_n ≠ 0 before using the ratio).
;(() => {
  const ID = 's21'
  const Y = C.yel, G = C.grn, R = C.red, B = C.blu, P = C.pur
  const id = (k, s) => `\\htmlId{${ID}-${k}}{${s}}`
  const tc = (c, s) => `\\textcolor{${c}}{${s}}`
  const $ = k => document.getElementById(`${ID}-${k}`)
  const kt = s => `<bdi class="m">${katex.renderToString(s, KOPT)}</bdi>`
  const badge = (n, c = Y) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:1.22em;height:1.22em;border-radius:50%;background:${c};color:#0b1020;font-weight:900;font-size:.78em;line-height:1;vertical-align:.1em;margin-inline-end:.3em">${n}</span>`
  // reveal the left fraction v of an element (math is written left → right)
  const wipeF = (e, v) => { v = clamp(v); e.style.clipPath = v >= 1 ? '' : `inset(-40% ${(1 - v) * 100}% -40% -5%)`; e.style.visibility = v <= 0 ? 'hidden' : 'visible' }
  const glow = (e, p, c = Y) => { e.style.color = p > 0 ? mixColor(C.ink, c, clamp(p)) : ''; e.style.textShadow = p > .01 ? `0 0 ${22 * clamp(p)}px ${c}aa` : '' }
  const nowrap = e => { e.style.whiteSpace = 'nowrap'; return e }

  scene('s21', {
    build(root, S) {
      this.root = root
      this.head = heading(root, 'التمرين ①')

      // ================= L0: book page, exercise card, goal chip, pause ring
      this.thumb = bookThumb(root, 11, 150, 300, 330, { x: .135, y: .138, w: .735, h: .052 })
      this.thumbLab = nowrap(chip(root, '📖 الكتاب ص 11 — تدرَّبْ', 315, 790, { anchor: 'tc' }))
      this.thumbLab.style.fontSize = '26px'
      const c0 = card(root, 'ex', 1800, 330, 1180, { anchor: 'tr', tag: '✏️ تدرَّبْ · التمرين ① · ص 11' })
      this.card0 = c0.el
      this.cardT = rich(`<span style="color:${R};font-weight:900">①</span> ليكن $${id('cu', 'u_n = \\dfrac{2^n}{3^{n+1}}')}$ في حالة $n\\in\\mathbb{N}$. أثبت أنّ المتتالية $(u_n)_{n\\ge0}$ متتالية هندسية <span class="yel b">وجِدْ أساسها</span>.`, 'h3')
      this.cardT.style.lineHeight = '1.75'
      c0.body.appendChild(this.cardT); splitWords(this.cardT)
      // goal chip (moves to the top-left corner at L1)
      this.goal = nowrap(chip(root, rich('المطلوب: $u_{n+1} = q\\,u_n$ ؟', 's').innerHTML, 120, 158, { color: Y }))
      this.goal.style.fontSize = '30px'
      // pause ring
      this.cdw = el('div', '', null, root); place(this.cdw, 0, 0, { w: W, h: H })
      this.cd = countdown(this.cdw, 1210, 820, 64, 'حاول أوّلاً')
      { const lb = this.cdw.lastElementChild.lastElementChild; lb.style.cssText += ';position:absolute;left:50%;top:150px;translate:-50% 0;white-space:nowrap;margin:0;color:' + C.mut }

      // ================= L1–L3: the given strip (top-left)
      this.given = el('div', '', null, root)
      this.given.style.cssText += `display:flex;align-items:center;gap:20px;direction:rtl;padding:8px 26px;border-radius:18px;border:2px solid ${R}66;background:rgba(255,92,138,.07)`
      const gl = el('div', '', 'المعطى', this.given); gl.style.cssText = `font-size:26px;font-weight:800;color:${R};white-space:nowrap`
      this.gF = tex(`u_n = \\dfrac{${id('g2n', '2^n')}}{${id('g3n', '3^{n+1}')}}`, 'ms'); this.given.appendChild(this.gF)
      place(this.given, 120, 150)

      // L1: substitution row
      const nb = `\\htmlClass{${ID}-nb}{${tc(B, 'n+1')}}`
      this.rA = tex(`u_{${nb}} = \\dfrac{2^{${nb}}}{3^{(${nb})+1}} ${id('a2', `= \\dfrac{${id('nA', '2^{n+1}')}}{${id('dA', '3^{n+2}')}}`)}`, 'mx')
      root.appendChild(this.rA)
      this.nbs = [...this.rA.querySelectorAll(`.${ID}-nb`)]   // the substituted n+1 (blue): they pulse while the line is spoken
      this.subL = nowrap(rich(`نضع $${tc(B, 'n+1')}$ مكان $${tc(B, 'n')}$`, 's')); root.appendChild(this.subL)
      this.subL.style.color = B
      // hunt label
      this.hunt = nowrap(chip(root, rich('🔍 نبحث فيه عن قطع $u_n$', 's').innerHTML, 0, 0, { color: Y }))
      this.hunt.style.fontSize = '28px'
      // the two lenses: numerator (right, read first) and denominator (left)
      const lens = (lab, src, c) => {
        const d = el('div', '', null, root)
        d.style.cssText += `display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 34px 20px;border-radius:22px;border:2px solid ${c}66;background:rgba(20,29,56,.85);box-shadow:0 20px 50px rgba(0,0,0,.3)`
        const l = el('div', '', lab, d); l.style.cssText = `font-size:28px;font-weight:800;color:${C.mut};white-space:nowrap`
        const f = tex(src, 'mx'); d.appendChild(f)
        return d
      }
      this.lN = lens('البسط', `2^{n+1} = 2\\times ${id('ln', tc(Y, '2^n'))}`, Y)
      this.lD = lens('المقام', `3^{n+2} = 3\\times ${id('ld', tc(Y, '3^{n+1}'))}`, Y)
      const as = svg(root, 0, 0, W, H)
      this.arN = arrow(as, 0, 0, 1, 1, { color: Y, width: 4 })
      this.arD = arrow(as, 0, 0, 1, 1, { color: Y, width: 4 })

      // L2/L3: the main row (first part = "the line now reads", the rest is filled in at L3)
      const y2 = tc(Y, '2^n'), y3 = tc(Y, '3^{n+1}')
      this.rC = tex(`u_{n+1} = \\dfrac{${id('s2', '2')}\\times ${id('s2n', y2)}}{${id('s3', '3')}\\times ${id('s3n', y3)}} ` +
        `${id('c1', `= \\dfrac{${id('c2', '2')}}{${id('c3', '3')}} \\times\\, ${id('cb', `\\dfrac{${id('c2n', y2)}}{${id('c3n', y3)}}`)}\\,\\,`)} ` +
        `${id('c4', `= ${tc(G, '\\dfrac23')}\\,${tc(Y, 'u_n')}`)}`, 'mx')
      root.appendChild(this.rC)
      // flying copies of the pieces (pulled out of the numerator / denominator)
      this.fly = ['2n', '3n', '2', '3'].map(k => {
        const src = { '2n': y2, '3n': y3, 2: '2', 3: '3' }[k]
        const e = tex(id('f' + k, src), 'mx'); root.appendChild(e)
        return { k, e }
      })
      this.cbBox = el('div', 'hlbox', null, root)
      this.cbLab = el('div', '', null, root)
      this.cbLab.style.cssText += `padding:4px 18px;border-radius:999px;background:${Y};color:#0b1020;font-weight:800`
      this.cbLab.appendChild(tex('= u_n', 'ms'))
      this.cbStem = el('div', '', null, root); this.cbStem.style.cssText += `width:3px;background:${Y}`
      // L3: green result + first term
      this.kq = keyBox(root, 'q', 960, 716, { color: G, label: '✓ النتيجة' })
      const kt0 = nowrap(rich('$(u_n)_{n\\ge0}$ متتالية هندسيّة أساسها $q = \\dfrac23$', 'h3'))
      this.kq.f.replaceWith(kt0)
      this.kq.el.style.background = 'rgba(110,224,90,.08)'; this.kq.el.style.whiteSpace = 'nowrap'
      this.u0 = el('div', '', null, root)
      this.u0.style.cssText += 'display:flex;align-items:center;gap:26px;direction:rtl'
      const u0l = nowrap(rich('وحدّها الأوّل:', 'p')); u0l.style.color = C.mut; this.u0.appendChild(u0l)
      this.u0F = tex(`u_0 = \\dfrac{2^0}{3^1} = \\dfrac13`, 'mm'); this.u0.appendChild(this.u0F)
      place(this.u0, 960, 906, { anchor: 'c' })

      // ================= L4: model answer + exam footnote
      const mc = card(root, 'exam', 1800, 300, 1560, { anchor: 'tr', tag: '✍️ نموذج الكتابة' })
      this.mc = mc.el
      this.m1 = rich('أيّاً كان $n \\in \\mathbb{N}$:', 'p'); mc.body.appendChild(this.m1); splitWords(this.m1)
      const mw = el('div', 'ctr', null, mc.body); mw.style.margin = '4px 0 40px'
      this.mF = tex('u_{n+1} = \\dfrac{2^{n+1}}{3^{n+2}} = \\dfrac23\\cdot\\dfrac{2^n}{3^{n+1}} = \\dfrac23\\,u_n', 'mm'); mw.appendChild(this.mF)
      this.mF.style.fontSize = '54px'
      this.m3 = rich('إذن $(u_n)_{n\\ge0}$ هندسيّة أساسها $\\dfrac23$ وحدّها الأول $u_0 = \\dfrac13$', 'p'); mc.body.appendChild(this.m3); splitWords(this.m3)
      const fc = card(root, 'tip', 1800, 742, 1560, { anchor: 'tr', tag: '🎯 في الامتحان' })
      this.fc = fc.el
      fc.el.style.padding = '30px 44px 24px'
      this.f1 = nowrap(rich('لإثبات أنّها هندسيّة: أظهر $u_{n+1} = q\\,u_n$ حيث $q$ ثابت لا يتعلّق بـ $n$', 'p')); fc.body.appendChild(this.f1)
      this.f2 = nowrap(rich(`وإن استعملت النسبة $\\dfrac{u_{n+1}}{u_n}$ فاذكر أوّلاً أنّ $${id('ne0', 'u_n \\ne 0')}$`, 'p')); fc.body.appendChild(this.f2)
      this.f2.querySelectorAll('bdi.m')[1].style.marginRight = '14px'   // air between «أنّ» and the framed u_n ≠ 0
      ;[this.f1, this.f2].forEach(e => { e.style.fontSize = '36px'; e.style.lineHeight = '1.7' })
      this.f2.style.display = 'inline-block'
      this.f2m = el('div', 'hlbg', null, this.f2); this.f2m.style.cssText += ';position:absolute;inset:-2px -14px;z-index:-1;transform-origin:100% 50%'
      this.f2.style.position = 'relative'; this.f2.style.isolation = 'isolate'
      const fw = el('div', 'ar', null, fc.body); fw.appendChild(this.f2)
      // frame around «u_n ≠ 0» (placed in _layout, inside the footnote card so it moves with it)
      this.neBox = el('div', 'hlbox', null, fc.el); this.neBox.style.borderRadius = '12px'; this.neBox.style.borderWidth = '3px'

      this._layout()
    },

    // positions that depend on measured KaTeX boxes (re-run from render() if fonts changed widths)
    _sigNow() { return [this.rA, this.rC, this.lN, this.lD, this.given, this.goal, this.card0].map(e => e.offsetWidth + 'x' + e.offsetHeight).join('|') },
    _layout() {
      const root = this.root
      this._sig = this._sigNow()
      if (!this.rC.offsetWidth) return
      const moved = [this.rA, this.rC, this.lN, this.lD, this.goal, this.given, this.card0, this.fc, this.subL, ...this.fly.map(f => f.e)]
      const saved = moved.map(e => [e.style.transform, e.style.clipPath])
      moved.forEach(e => { e.style.transform = 'none'; e.style.clipPath = '' })
      const R_ = e => rectIn(e, root)
      // goal chip: L0 position under the card (right-aligned), L1+ position top-left next to the given strip
      const g = R_(this.given)
      place(this.goal, g.x + g.w + 24, g.y + g.h / 2, { anchor: 'cl' })
      const gr = R_(this.goal), cr = R_(this.card0)
      this.goalD = { x: 1800 - gr.w - gr.x, y: cr.y + cr.h + 34 - gr.y }
      // row A centred, label under its substitution part
      place(this.rA, 960, 420, { anchor: 'c' })
      const ra = R_(this.rA), a2 = R_($('a2'))
      this.rAcut = (a2.x - ra.x) / ra.w
      place(this.subL, (ra.x + a2.x) / 2, ra.y + ra.h + 6, { anchor: 'tc' })
      // hunt chip above the right end of row A
      place(this.hunt, ra.x + ra.w, ra.y - 18, { anchor: 'br' })
      // lenses: numerator right, denominator left
      place(this.lN, 1440, 600, { anchor: 'tc' }); place(this.lD, 520, 600, { anchor: 'tc' })
      const nA = R_($('nA')), dA = R_($('dA')), lN = R_(this.lN), lD = R_(this.lD)
      const setA = (a, d) => { a.path.setAttribute('d', d); a.path._len = 0 }
      setA(this.arN, `M${nA.x + nA.w + 14},${nA.cy} Q${lN.cx + 10},${nA.cy} ${lN.cx},${lN.y - 12}`)
      setA(this.arD, `M${dA.cx - 30},${dA.y + dA.h + 10} C${dA.cx - 60},${dA.y + dA.h + 90} ${lD.cx + 40},${lD.y - 110} ${lD.cx},${lD.y - 14}`)
      // main row C: final place (L3) centred at y 420; at L2 only its first part shows, centred at y 850
      place(this.rC, 960, 430, { anchor: 'c' })
      const rc = R_(this.rC), c1 = R_($('c1')), c4 = R_($('c4'))
      this.rCcut1 = (c1.x - rc.x) / rc.w
      this.rCcut2 = (c4.x - rc.x) / rc.w
      this.rCdx = (rc.w - (c1.x - rc.x)) / 2
      this.rCdy = 872 - 430
      // flying pieces: source in the first part, target in the second fraction
      const pairs = { '2n': ['s2n', 'c2n'], '3n': ['s3n', 'c3n'], 2: ['s2', 'c2'], 3: ['s3', 'c3'] }
      this.fly.forEach(f => {
        place(f.e, 0, 0)
        const inner = R_($('f' + f.k)), s = R_($(pairs[f.k][0])), t = R_($(pairs[f.k][1]))
        place(f.e, s.x - inner.x, s.y - inner.y)
        f.dx = t.x - s.x; f.dy = t.y - s.y
      })
      // box + label around the u_n block
      const cbx = R_($('cb')), cn = R_($('c2n')), cd = R_($('c3n'))
      const cb = { x: cbx.x, w: cbx.w, cx: cbx.cx, y: cn.y, h: cd.y + cd.h - cn.y }
      place(this.cbBox, cb.x - 9, cb.y - 8, { w: cb.w + 18, h: cb.h + 16 })
      place(this.cbStem, cb.cx - 1.5, cb.y + cb.h + 8, { h: 22 })
      place(this.cbLab, cb.cx, cb.y + cb.h + 30, { anchor: 'tc' })
      // frame around «u_n ≠ 0» in the footnote (coordinates inside the card, minus its 2px border)
      const ne = rectIn($('ne0'), this.fc)
      place(this.neBox, ne.x - 2 - 10, ne.y - 2 - 6, { w: ne.w + 20, h: ne.h + 12 })
      moved.forEach((e, i) => { e.style.transform = saved[i][0]; e.style.clipPath = saved[i][1] })
    },

    render(lt, S) {
      if (this._sig !== this._sigNow()) this._layout()
      const d = i => S.end(i) - S.at(i)
      const T = (i, f) => S.at(i) + f * d(i)
      const pr = (t0, dur = .6, e = E.io) => prog(lt, t0, dur, e)
      const L = { sub: 1, num: 2, den: 3, res: 4, exam: 5 }

      this.head.set(S.p(lt, 0, 0, .8))

      // ================= L0
      const out0 = S.p(lt, L.sub, 0, .5)
      const th = S.p(lt, 0, .3, .7)
      op(this.thumb.el, Math.min(th, 1 - out0))
      this.thumb.el.style.transform = `translateY(${(1 - th) * 30 - out0 * 20}px) rotate(-2deg)`
      if (this.thumb.mark) this.thumb.mark.style.opacity = prog(lt, S.at(0) + 1, .5) * (.75 + .25 * Math.sin(lt * 3))
      rise(this.thumbLab, Math.min(S.p(lt, 0, .7, .6), 1 - out0), 12)
      const ci = pr(Math.max(S.at(0) + 1.1, T(0, .06)), .7)
      op(this.card0, Math.min(ci, 1 - out0))
      this.card0.style.transform = `translateX(${(1 - ci) * 60}px) translateY(${-out0 * 24}px)`
      typeWords(this.cardT, clamp((lt - Math.max(S.at(0) + 1.3, T(0, .08))) / Math.max(1.5, T(0, .72) - Math.max(S.at(0) + 1.3, T(0, .08)))))
      $('cu').style.color = mixColor('#eef2ff', Y, env(lt, T(0, .14), T(0, .5), .4, .5))
      // goal chip: appears under the card, then glides to the corner
      const gI = pr(Math.max(T(0, .76), S.at(0) + 2.4), .6)
      const gM = S.p(lt, L.sub, .2, .9)
      const gx = this.goalD.x * (1 - gM), gy = this.goalD.y * (1 - gM)
      op(this.goal, gI * (1 - S.p(lt, L.exam, 0, .45)))
      this.goal.style.transform = `translate(${gx}px, ${gy + (1 - gI) * 16}px)`
      // pause ring in the hold
      const hs = S.end(0), he = Math.max(hs + .5, S.at(L.sub) - .3)
      op(this.cdw, prog(lt, Math.max(T(0, .9), S.at(0) + 3), .5) * (1 - out0))
      this.cd(Math.max(.001, clamp((lt - hs) / (he - hs))), 5 * (1 - clamp((lt - hs) / (he - hs))))

      // ================= sub: u_{n+1} = 2^{n+1}/3^{(n+1)+1} = 2^{n+1}/3^{n+2}
      const out3 = S.p(lt, L.res, 0, .5)
      const outG = S.p(lt, L.exam, 0, .45)
      const gi = S.p(lt, L.sub, .3, .6)
      op(this.given, Math.min(gi, 1 - outG)); this.given.style.transform = `translateX(${(1 - gi) * -40}px)`
      const tA1 = S.at(L.sub) + .55, tA2 = Math.max(T(L.sub, .6), tA1 + 1.5)
      const a1 = pr(tA1, 1.2), a2 = pr(tA2, 1)
      wipeF(this.rA, lerp(0, this.rAcut, a1) + (1 - this.rAcut) * a2)
      const nbP = env(lt, tA1 + 1.2, tA2 + 1.2, .5, .6) * (1 - out3)
      this.nbs.forEach((e, i) => { e.style.textShadow = nbP > .01 ? `0 0 ${(12 + 8 * Math.sin(lt * 3 + i)) * nbP}px ${B}` : '' })
      // num: the hunt begins — row A glides up (it sat centred while alone) to make room for the lenses
      const tH = Math.max(S.at(L.num) + .2, tA2 + 1.1)
      const dyA = 80 * (1 - pr(tH - .1, .8))
      op(this.rA, 1 - out3); this.rA.style.transform = `translateY(${dyA - out3 * 30}px)`
      op(this.subL, Math.min(pr(S.at(L.sub) + .3, .5), 1 - pr(tH - .1, .4)))
      this.subL.style.transform = `translateY(${dyA}px)`
      pop(this.hunt, Math.min(pr(tH + .55, .5), 1 - out3))
      const gl = pr(tH + .8, .5) * (1 - out3)
      glow($('g2n'), gl * (.8 + .2 * Math.sin(lt * 3))); glow($('g3n'), gl * (.8 + .2 * Math.sin(lt * 3 + 1)))
      const tN = Math.max(T(L.num, .3), tH + 1.5)
      const nP = pr(tN, .7)
      this.arN.set(Math.min(pr(tN - .1, .6), 1 - out3 > .5 ? 1 : 0)); this.arN.path.style.opacity = 1 - out3
      $('nA').style.color = mixColor('#eef2ff', Y, env(lt, tN - .2, S.at(L.den), .4, .5))
      rise(this.lN, Math.min(nP, 1 - out3), 26)
      glow($('ln'), pr(tN + .5, .5) * (.75 + .25 * Math.sin(lt * 3.2)) * (1 - out3))

      // ================= den: denominator lens, the line now reads …
      const tD = Math.max(S.at(L.den) + .25, tN + .9)
      const dP = pr(tD + .1, .7)
      this.arD.set(Math.min(pr(tD, .6), 1 - out3 > .5 ? 1 : 0)); this.arD.path.style.opacity = 1 - out3
      $('dA').style.color = mixColor('#eef2ff', Y, env(lt, tD - .1, S.at(L.res), .4, .5))
      rise(this.lD, Math.min(dP, 1 - out3), 26)
      glow($('ld'), pr(tD + .6, .5) * (.75 + .25 * Math.sin(lt * 3.2 + 1)) * (1 - out3))
      const tR = Math.max(T(L.den, .55), tD + 1.6)
      const rP = pr(tR, 1)
      // row C: first part at y 872 (centred) → moves up to its final place at the result line
      const up = S.p(lt, L.res, .35, .9)
      this.rC.style.transform = `translate(${this.rCdx * (1 - up)}px, ${this.rCdy * (1 - up)}px)`
      // res: reveal of the rest
      const tS = Math.max(T(L.res, .07), S.at(L.res) + 1.35)  // slots (=, bars, ×)
      const tF = tS + .45                                      // yellow pieces fly
      const tK = tF + .75                                      // constants fly
      const tBx = Math.max(T(L.res, .3), tK + 1)               // box + u_n label
      const tC4 = tBx + .7
      const slot = pr(tS, .45)
      wipeF(this.rC, lt < tS ? this.rCcut1 * rP : lerp(this.rCcut1, this.rCcut2, slot) + (1 - this.rCcut2) * pr(tC4, .8))
      const out4 = S.p(lt, L.exam, 0, .5)
      op(this.rC, rP > 0 ? 1 - out4 : 0)
      this.rC.style.transform += ` translateY(${-out4 * 30}px)`
      // pieces: hidden in the target until their copy lands
      const fP = { '2n': pr(tF, .8), '3n': pr(tF + .12, .8), 2: pr(tK, .7), 3: pr(tK + .1, .7) }
      this.fly.forEach(f => {
        const p = fP[f.k]
        const flying = p > 0 && p < 1
        op(f.e, flying ? 1 : 0)
        const lift = Math.sin(Math.PI * p) * (f.k.length > 1 ? 70 : 50) * (f.k[0] === '2' ? -1 : 1)
        f.e.style.transform = `translate(${f.dx * p}px, ${f.dy * p + lift}px) scale(${1 + .12 * Math.sin(Math.PI * p)})`
        const tgt = { '2n': 'c2n', '3n': 'c3n', 2: 'c2', 3: 'c3' }[f.k]
        op($(tgt), p >= 1 ? 1 : 0)
      })
      // the source pieces dim once pulled out (they are copied, not removed: the equality still holds)
      ;['s2n', 's3n'].forEach((k, i) => glow($(k), (1 - .55 * pr(tF + i * .12, .6)) * (.85 + .15 * Math.sin(lt * 3 + i))))
      // box around the u_n block + label
      const bx = pr(tBx, .5)
      op(this.cbBox, Math.min(clamp(bx * 1.5), 1 - out4)); this.cbBox.style.transform = `scale(${lerp(1.15, 1, E.out(bx))})`
      if (bx > 0) this.cbBox.style.boxShadow = `0 0 ${24 + 10 * Math.sin(lt * 2.4)}px rgba(255,210,63,.4)`
      const lb = pr(tBx + .3, .5)
      op(this.cbStem, Math.min(lb, 1 - out4)); this.cbStem.style.transform = `scaleY(${lb})`; this.cbStem.style.transformOrigin = '50% 0'
      rise(this.cbLab, Math.min(lb, 1 - out4), -12)
      // green result + u_0
      const tQ = Math.max(T(L.res, .5), tC4 + 1.1)
      const kq = pr(tQ, .7)
      this.kq.set(Math.min(kq, 1))
      op(this.kq.el, Math.min(clamp(kq * 2.5), 1 - out4))
      if (kq > 0) this.kq.el.style.boxShadow = `0 0 ${46 + 16 * Math.sin(lt * 1.8)}px ${G}${kq >= 1 ? '44' : '22'}`
      const tU = Math.max(T(L.res, .8), tQ + 1.2)
      const u0 = pr(tU, .6)
      rise(this.u0, Math.min(u0, 1 - out4), 24)
      wipeF(this.u0F, pr(tU + .1, .9))

      // ================= exam: model answer + footnote (short line + hold: everything lands within ~3.5 s)
      const t5 = S.at(L.exam), w5 = Math.max(3, S.dur - .4 - t5)   // time left before the scene fades out
      const mI = pr(t5 + .3, .55)
      op(this.mc, mI); this.mc.style.transform = `translateY(${(1 - mI) * 40}px)`
      const tM = t5 + .45, mDur = clamp(w5 * .38, 1.5, 3)
      typeWords(this.m1, pr(tM, mDur * .2, E.lin))
      wipeF(this.mF, pr(tM + mDur * .2, mDur * .45, E.io))
      typeWords(this.m3, pr(tM + mDur * .62, mDur * .38, E.lin))
      const tFn = tM + mDur * .75
      const fI = pr(tFn, .6)
      op(this.fc, fI); this.fc.style.transform = `translateY(${(1 - fI) * 30}px)`
      const hlF = pr(tFn + .7, .6)
      op(this.f2m, hlF > 0 ? 1 : 0); this.f2m.style.transform = `scaleX(${E.out(hlF)})`
      this.f2.style.color = mixColor('#eef2ff', Y, hlF)
      // «u_n ≠ 0» framed last
      const nb = pr(tFn + 1.25, .5)
      op(this.neBox, clamp(nb * 1.5)); this.neBox.style.transform = `scale(${lerp(1.18, 1, E.out(nb))})`
      if (nb > 0) this.neBox.style.boxShadow = `0 0 ${22 + 10 * Math.sin(lt * 2.6)}px rgba(255,210,63,.45)`
    },
  })
})()

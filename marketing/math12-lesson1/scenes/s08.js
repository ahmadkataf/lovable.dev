// s08 · فكّر — the units digit of u_n is always 7 (from u_1 on): evidence, the reason, dominoes
(() => {
  const q = (e, c) => [...e.querySelectorAll('.' + c)]
  const setAll = (els, f) => els.forEach(f)
  // KaTeX number whose last digit is wrapped in a class (units digit)
  const numTex = (n, cls) => { const s = String(n); return tex(`\\htmlClass{s08-pre}{${s.slice(0, -1) || '\\,'}}\\htmlClass{s08-u}{${s.slice(-1)}}`, cls) }
  const glow = (e, p, c = C.yel) => { e.style.color = p > 0 ? mixColor(C.ink, c, clamp(p)) : ''; e.style.textShadow = p > 0 ? `0 0 ${24 * p}px ${c}aa` : '' }

  scene('s08', {
    build(root, S) {
      this.F = (i, fr) => S.at(i) + fr * (S.end(i) - S.at(i))
      this.head = heading(root, 'فكّر: رقم آحاد الحدود')

      // ---------- corner: open question ② + reminder of the example ----------
      this.chip = chip(root, '🔒 سؤال مفتوح ②', 120, 150, { color: C.pur })
      this.chip.style.transformOrigin = '0 50%'
      this.rem = rich('$u_0 = 3$ ، $u_{n+1} = u_n^2 - 2$', 's')
      root.appendChild(this.rem); place(this.rem, 124, 222)
      this.rem.style.whiteSpace = 'nowrap'
      // the updated corner card (line 4)
      this.qc = el('div', '', null, root)
      place(this.qc, 120, 150)
      this.qc.style.cssText += `padding:16px 30px;border-radius:20px;border:2.5px solid ${C.pur};background:rgba(124,58,237,.16);box-shadow:0 0 40px rgba(124,58,237,.35);transform-origin:0 0`
      // two deliberate lines (no automatic wrap in the middle of the statement)
      const qt = rich('<b class="pur">🔒 سؤال مفتوح ②:</b> آحاد $u_n$ تساوي <b class="yel">7</b> مهما يكن $n \\ge 1$<br><span class="mute">— برهانه في الدرس 2</span>', 'p')
      qt.style.fontSize = '32px'; qt.style.lineHeight = '1.55'; qt.style.whiteSpace = 'nowrap'
      this.qc.appendChild(qt)

      // ---------- line 0: 7 · 47 · 2207, units digits light up ----------
      this.row = el('div', '', null, root)
      place(this.row, 960, 540, { anchor: 'c' })
      this.row.style.cssText += 'direction:ltr;display:flex;align-items:flex-start;gap:0'
      this.nums = [7, 47, 2207].map((n, k) => {
        let sep = null
        if (k) { sep = el('div', 'mute', '·', this.row); sep.style.cssText += 'font-size:110px;line-height:1;margin:22px 60px 0;font-weight:900' }
        const b = el('div', '', null, this.row); b.style.cssText = 'display:flex;flex-direction:column;align-items:center'
        const t = numTex(n, 'mxl'); t.style.fontSize = '150px'; b.appendChild(t)
        const l = tex(`u_${k + 1}`, 'mm mute'); l.style.marginTop = '6px'; b.appendChild(l)
        return { b, t, l, sep, pre: q(t, 's08-pre'), u: q(t, 's08-u')[0] }
      })
      this.nums[0].pre.forEach(e => (e.style.opacity = 0))

      // ---------- line 1: think card, book thumbnail, countdown ----------
      const tc = card(root, 'think', 1800, 450, 1220, { anchor: 'tr' })
      this.think = tc.el
      this.thinkT = rich('أَصحيحٌ أنّ آحاد جميع حدود المتتالية التي دليلها أكبر من <b class="blu">1</b> تساوي <b class="yel">7</b> في المثال السابق؟', 'h3')
      tc.body.appendChild(this.thinkT); splitWords(this.thinkT)
      this.thumb = bookThumb(root, 8, 140, 420, 330, { x: .1, y: .075, w: .82, h: .095 })
      this.thumbLab = chip(root, '📖 الكتاب ص 8', 305, 900, { anchor: 'c' })
      this.cdw = el('div', '', null, root); place(this.cdw, 0, 0, { w: W, h: H })
      this.cd = countdown(this.cdw, 1190, 800, 70, 'أوقف وفكّر')

      // ---------- line 2: u4, odometer ----------
      this.comp = tex('u_4 = u_3^2 - 2 = 2207^2 - 2 = 4870849 - 2', 'mx')
      root.appendChild(this.comp); place(this.comp, 960, 450, { anchor: 'c' })
      this.res = el('div', '', null, root)
      place(this.res, 960, 615, { anchor: 'c' })
      this.res.style.cssText += 'direction:ltr;display:flex;align-items:center;gap:28px'
      const u4 = tex('u_4 =', 'mxl'); this.res.appendChild(u4)
      this.odo = el('div', '', null, this.res)
      this.odo.style.cssText = 'display:flex;font-family:KaTeX_Main;font-size:130px;line-height:1.2em;height:1.2em;overflow:hidden'
      this.cols = '4870847'.split('').map((d, i) => {
        const c = el('div', '', null, this.odo); c.style.cssText = 'height:1.2em;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 22%,#000 78%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0%,#000 22%,#000 78%,transparent 100%)'
        const strip = el('div', '', null, c)
        const spins = 2, tgt = +d, n = spins * 10 + tgt
        strip.innerHTML = Array.from({ length: n + 1 }, (_, j) => `<div style="height:1.2em;text-align:center">${j % 10}</div>`).join('')
        return { c, strip, n }
      })
      this.lastCol = this.cols[6].c
      this.notProof = chip(root, '⚠️ التجارب ليست برهاناً', 960, 795, { anchor: 'c', color: C.red })
      this.notProof.style.fontSize = '34px'

      // ---------- line 3: squares, units column, the 7 → 9 → 7 cycle ----------
      const rowsTex = [
        `\\phantom{220}\\htmlClass{s08-u7}{7}^{\\htmlClass{s08-nu}{2}} \\htmlClass{s08-nu}{=} \\phantom{48708}\\htmlClass{s08-nu}{4}\\htmlClass{s08-u9}{9}`,
        `\\phantom{22}\\htmlClass{s08-nu}{4}\\htmlClass{s08-u7}{7}^{\\htmlClass{s08-nu}{2}} \\htmlClass{s08-nu}{=} \\phantom{487}\\htmlClass{s08-nu}{220}\\htmlClass{s08-u9}{9}`,
        `\\htmlClass{s08-nu}{220}\\htmlClass{s08-u7}{7}^{\\htmlClass{s08-nu}{2}} \\htmlClass{s08-nu}{=} \\htmlClass{s08-nu}{487084}\\htmlClass{s08-u9}{9}`,
      ]
      this.sq = el('div', '', null, root)
      place(this.sq, 1420, 330, { anchor: 'tc' })
      this.sq.style.cssText += 'direction:ltr;display:flex;flex-direction:column;align-items:flex-start;gap:18px'
      this.sqRows = rowsTex.map(t => { const e = tex(t, 'mx'); this.sq.appendChild(e); return { e, nu: q(e, 's08-nu'), u7: q(e, 's08-u7')[0], u9: q(e, 's08-u9')[0] } })
      this.sqCap = rich('آحاد المربّع تتعلّق بآحاد العدد <span class="yel b">فقط</span>', 'h3')
      root.appendChild(this.sqCap); place(this.sqCap, 1420, 690, { anchor: 'tc' }); this.sqCap.style.whiteSpace = 'nowrap'
      this.sqCap.style.fontSize = '42px'

      // cycle diagram (left half)
      const cy = svg(root, 0, 0, W, H); cy.style.direction = 'ltr'
      this.cy = cy
      this.A = [250, 590]; this.B = [640, 590]; this.Cn = [960, 590]
      const R = 78
      this.R = R
      const node = (p, col) => {
        const g = sv(cy, 'g')
        sv(g, 'circle', { cx: p[0], cy: p[1], r: R + 10, fill: col, opacity: .12 })
        sv(g, 'circle', { cx: p[0], cy: p[1], r: R, fill: '#121a3a', stroke: col, 'stroke-width': 4 })
        g.style.transformOrigin = `${p[0]}px ${p[1]}px`
        return g
      }
      // arrow A → B (squaring), upper arc
      const arcAB = `M${this.A[0] + 66},${this.A[1] - 46} Q${(this.A[0] + this.B[0]) / 2},${this.A[1] - 220} ${this.B[0] - 70},${this.B[1] - 44}`
      this.aAB = sv(cy, 'path', { d: arcAB, fill: 'none', stroke: C.yel, 'stroke-width': 5, 'stroke-linecap': 'round' })
      this.hAB = sv(cy, 'path', { d: 'M8,0 L-13,-10 L-13,10 Z', fill: C.yel })
      // arrow B → C (−2), later bent back to A
      this.aBC = sv(cy, 'path', { d: '', fill: 'none', stroke: C.blu, 'stroke-width': 5, 'stroke-linecap': 'round' })
      this.hBC = sv(cy, 'path', { d: 'M8,0 L-13,-10 L-13,10 Z', fill: C.blu })
      this.nA = node(this.A, C.yel); this.nB = node(this.B, C.blu); this.nC = node(this.Cn, C.yel)
      this.runner = sv(cy, 'circle', { cx: 0, cy: 0, r: 9, fill: C.yel })
      this.runner.style.filter = `drop-shadow(0 0 10px ${C.yel})`
      const nl = (latex, p, col) => { const e = tex(latex, 'mm'); e.style.fontSize = '54px'; root.appendChild(e); place(e, p[0], p[1], { anchor: 'c' }); e.style.color = col; return e }
      this.lA = nl('\\ldots 7', this.A, C.yel); this.lB = nl('\\ldots 9', this.B, C.blu); this.lC = nl('\\ldots 7', this.Cn, C.yel)
      this.labSq = rich('تربيع', 'h3 yel'); root.appendChild(this.labSq); place(this.labSq, (this.A[0] + this.B[0]) / 2, 398, { anchor: 'c' }); this.labSq.style.fontSize = '40px'
      this.note = tex('7 \\times 7 = 4\\textcolor{' + C.yel + '}{9}', 'mm mute'); root.appendChild(this.note); place(this.note, (this.A[0] + this.B[0]) / 2, 334, { anchor: 'c' })
      this.lab2 = tex('-2', 'mx'); root.appendChild(this.lab2); this.lab2.style.color = C.blu
      place(this.lab2, 0, 0, { anchor: 'c' })

      // ---------- line 4: yes, from u1 on; dominoes ----------
      this.yes = rich('<span class="grn b">✓ نعم:</span> آحاد جميع الحدود بدءاً من $u_1$ تساوي <span class="yel b">7</span>', 'h3')
      root.appendChild(this.yes); place(this.yes, 960, 395, { anchor: 'c' }); this.yes.style.whiteSpace = 'nowrap'
      const ds = svg(root, 0, 0, W, H); ds.style.direction = 'ltr'
      this.GY = 790; this.DW = 76; this.DH = 220; this.X0 = 430; this.SP = 180
      sv(ds, 'path', { d: `M150,${this.GY + 2} L1700,${this.GY + 2}`, stroke: 'rgba(154,168,201,.35)', 'stroke-width': 3 })
      this.ground = ds.lastChild
      const tile = (x, txt, col, fill) => {
        const g = sv(ds, 'g')
        sv(g, 'rect', { x, y: this.GY - this.DH, width: this.DW, height: this.DH, rx: 12, fill, stroke: col, 'stroke-width': 3 })
        sv(g, 'path', { d: `M${x + 12},${this.GY - this.DH / 2} L${x + this.DW - 12},${this.GY - this.DH / 2}`, stroke: col, 'stroke-width': 2, opacity: .5 })
        const t = sv(g, 'text', { x: x + this.DW / 2, y: this.GY - this.DH * .75 + 20, 'text-anchor': 'middle', 'font-family': 'KaTeX_Main', 'font-size': 56, 'font-weight': 700, fill: col })
        t.textContent = txt
        return { g, t, cx: x + this.DW / 2, cy: this.GY - this.DH * .75 }
      }
      this.u0t = tile(200, '3', C.dim, 'rgba(93,106,143,.15)')
      this.ghost = tile(this.X0 + 6 * this.SP, '7', 'rgba(255,210,63,.35)', 'rgba(26,35,80,.35)')
      this.ghost.g.querySelector('rect').setAttribute('stroke-dasharray', '10 8')
      this.doms = [1, 2, 3, 4, 5, 6].map(k => tile(this.X0 + (k - 1) * this.SP, '7', C.yel, '#1a2350'))
      this.u0l = tex('u_0 = 3', 'ms'); root.appendChild(this.u0l); place(this.u0l, 238, this.GY + 40, { anchor: 'c' }); this.u0l.style.color = C.dim
      this.u0n = rich('حدّ البدء لا ينتهي بـ 7', 's'); root.appendChild(this.u0n); place(this.u0n, 250, this.GY + 92, { anchor: 'c' })
      this.u0n.style.cssText += 'white-space:nowrap;font-size:28px'
      this.dl = [1, 2, 3, 4, 5, 6].map(k => { const e = tex(`u_${k}`, 'ms'); root.appendChild(e); place(e, this.X0 + (k - 1) * this.SP + this.DW / 2, this.GY + 40, { anchor: 'c' }); return e })
      this.dmore = tex('\\cdots', 'mx mute'); root.appendChild(this.dmore); place(this.dmore, 1720, this.GY - 40, { anchor: 'c' })
      this.dcap = rich('الخاصّة تنتقل من كلّ حدٍّ إلى الذي يليه', 's'); root.appendChild(this.dcap)
      place(this.dcap, 980, this.GY + 100, { anchor: 'c' }); this.dcap.style.whiteSpace = 'nowrap'
    },

    // angle (deg) at which domino k, pivoting on its bottom-right corner, rests on domino k+1 tilted by phi (deg)
    contact(phi) {
      const { DW, DH, SP } = this, r = Math.PI / 180
      // domino k+1: pivot at (SP+DW, 0) relative to k's bottom-left; its left face rotated by phi
      const px = SP + DW, c = Math.cos(phi * r), s = Math.sin(phi * r)
      const P = [px - DW * c, DW * s]                  // bottom-left corner after rotation (y up)
      const d = [s, c]                                   // direction up the left face (rotated)
      // top-right corner of domino k: pivot (DW, 0) + (DH sinθ, DH cosθ); find θ where it crosses the face line
      const side = th => { const x = DW + DH * Math.sin(th * r) - P[0], y = DH * Math.cos(th * r) - P[1]; return x * d[1] - y * d[0] }
      let lo = 0, hi = 89
      if (side(hi) < 0) return 89
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (side(m) < 0) lo = m; else hi = m }
      return lo
    },

    render(lt, S) {
      const F = this.F
      this.head.set(S.p(lt, 0, 0, .7))

      // ---------- corner ----------
      const cornerIn = S.p(lt, 0, .1, .6)
      const toCard = prog(lt, F(4, .7), .7)
      const pulse = Math.max(0, Math.sin(clamp((lt - F(0, .86)) / 1.4) * Math.PI * 2)) * (lt > F(0, .86) && lt < F(0, .86) + 1.4 ? 1 : 0)
      op(this.chip, cornerIn * (1 - toCard))
      this.chip.style.transform = `scale(${1 + .12 * pulse})`
      this.chip.style.boxShadow = pulse > 0 ? `0 0 ${36 * pulse}px rgba(167,139,250,.8)` : ''
      rise(this.rem, cornerIn * (1 - S.p(lt, 4, 0, .5)), 10)
      op(this.qc, toCard)
      this.qc.style.transform = `scale(${lerp(.6, 1, E.out(toCard))})`
      this.qc.style.boxShadow = `0 0 ${40 + 30 * Math.sin(lt * 2) * toCard}px rgba(124,58,237,${.35 * toCard})`

      // ---------- line 0 / the row of terms ----------
      const ap = [F(0, .14), F(0, .26), F(0, .44)]
      const rowUp = S.p(lt, 1, 0, .8)
      const rowOut = S.p(lt, 3, 0, .5)
      this.row.style.transform = `translateY(${-215 * rowUp}px) scale(${1 - .5 * rowUp})`
      op(this.row, 1 - rowOut)
      this.nums.forEach((n, k) => {
        pop(n.b, prog(lt, ap[k], .5))
        if (n.sep) op(n.sep, prog(lt, ap[k] - .15, .4))
        const lit = prog(lt, F(0, .68) + k * .4, .45)
        glow(n.u, lit)
        n.u.style.display = 'inline-block'
        n.u.style.transform = `scale(${1 + .18 * Math.sin(clamp(lit) * Math.PI)})`
        n.pre.forEach(e => (e.style.color = mixColor(C.ink, C.dim, lit)))
      })

      // ---------- line 1: the question ----------
      const out1 = 1 - S.p(lt, 2, 0, .5)
      rise(this.think, S.p(lt, 1, .3, .6) * out1)
      typeWords(this.thinkT, S.f(lt, 1, .05, .7))
      rise(this.thumb.el, S.p(lt, 1, .6, .7) * out1, 30)
      if (this.thumb.mark) this.thumb.mark.style.opacity = prog(lt, F(1, .2), .5) * (.75 + .25 * Math.sin(lt * 3))
      rise(this.thumbLab, S.p(lt, 1, .9, .6) * out1, 12)
      const hs = S.end(1), he = Math.max(hs + .5, S.at(2) - .3)
      op(this.cdw, prog(lt, F(1, .78), .5) * out1)
      this.cd(Math.max(.001, clamp((lt - hs) / (he - hs))), 5 * (1 - clamp((lt - hs) / (he - hs))))

      // ---------- line 2: u4 ----------
      const out2 = 1 - S.p(lt, 3, 0, .5)
      wipe(this.comp, S.p(lt, 2, .1, 1.1), 'ltr')
      op(this.comp, out2)
      rise(this.res, prog(lt, F(2, .1), .5) * out2, 20)
      const r0 = F(2, .12), rd = Math.max(1.2, F(2, .52) - r0)
      this.cols.forEach((c, i) => {
        const p = E.out(clamp((lt - r0 - i * rd * .09) / (rd * .46)))
        const pos = p * c.n
        c.strip.style.transform = `translateY(${-pos * 1.2}em)`
        c.strip.style.filter = p > 0 && p < 1 ? `blur(${Math.min(4, (1 - p) * 6)}px)` : ''
      })
      const u4p = prog(lt, F(2, .6), .5)
      glow(this.lastCol, u4p)
      this.lastCol.style.transform = `scale(${1 + .22 * Math.sin(clamp(u4p) * Math.PI)})`
      pop(this.notProof, prog(lt, F(2, .8), .6) * out2)

      // ---------- line 3: squares & cycle ----------
      const out3 = 1 - S.p(lt, 4, 0, .5)
      const nuFade = prog(lt, F(3, .4), .7)
      this.sqRows.forEach((r, k) => {
        rise(r.e, prog(lt, S.at(3) + .1 + k * .35, .5) * out3, 20)
        const lit = prog(lt, F(3, .14) + k * .25, .4)
        glow(r.u7, lit); glow(r.u9, lit)
        r.nu.forEach(e => (e.style.opacity = lerp(1, .14, nuFade)))
      })
      rise(this.sqCap, prog(lt, F(3, .24), .6) * out3, 14)
      // cycle
      const pA = prog(lt, F(3, .42), .5), pAB = prog(lt, F(3, .48), .7), pB = prog(lt, F(3, .6), .5)
      const pBC = prog(lt, F(3, .78), .6), pC = prog(lt, F(3, .86), .4), close = prog(lt, F(3, .9), .9)
      const nodeSet = (g, lb, p) => { g.style.opacity = clamp(p * 2) * out3; g.style.transform = `scale(${p <= 0 ? .3 : lerp(.3, 1, E.back(p))})`; op(lb, clamp(p * 2) * out3) }
      nodeSet(this.nA, this.lA, pA); nodeSet(this.nB, this.lB, pB)
      nodeSet(this.nC, this.lC, pC * (1 - clamp((E.io(close) - .55) / .35)))
      draw(this.aAB, pAB); this.aAB.style.opacity = out3
      const LAB = this.aAB.getTotalLength(), tAB = this.aAB.getPointAtLength(LAB * pAB), tAB0 = this.aAB.getPointAtLength(Math.max(0, LAB * pAB - 3))
      this.hAB.setAttribute('transform', `translate(${tAB.x},${tAB.y}) rotate(${Math.atan2(tAB.y - tAB0.y, tAB.x - tAB0.x) * 180 / Math.PI})`)
      this.hAB.style.opacity = (pAB > .05 ? 1 : 0) * out3
      rise(this.labSq, prog(lt, F(3, .5), .5) * out3, 10)
      rise(this.note, prog(lt, F(3, .52), .5) * out3, 10)
      // B → C (straight) bending into B → A (lower arc) as C slides home onto A
      const ce = E.io(close)
      const Cx = lerp(this.Cn[0], this.A[0], ce), Cy = this.Cn[1] + Math.sin(ce * Math.PI) * 230
      this.nC.style.translate = `${Cx - this.Cn[0]}px ${Cy - this.Cn[1]}px`
      this.lC.style.translate = `calc(-50% + ${Cx - this.Cn[0]}px) calc(-50% + ${Cy - this.Cn[1]}px)`
      const sx = lerp(this.B[0] + this.R + 2, this.B[0] - 20, ce), sy = lerp(this.B[1], this.B[1] + this.R - 4, ce)
      const dx = Cx - sx, dy = Cy - sy, dl = Math.hypot(dx, dy) || 1
      const ex = Cx - dx / dl * (this.R + 14) * (1 - ce) + ce * (44), ey = Cy - dy / dl * (this.R + 14) * (1 - ce) + ce * (this.R + 2)
      const qx = lerp((sx + ex) / 2, (this.A[0] + this.B[0]) / 2, ce), qy = lerp((sy + ey) / 2, this.B[1] + 250, ce)
      this.aBC.setAttribute('d', `M${sx},${sy} Q${qx},${qy} ${ex},${ey}`)
      this.aBC.style.visibility = pBC <= 0 ? 'hidden' : 'visible'
      const LBC = this.aBC.getTotalLength()
      this.aBC.style.strokeDasharray = LBC; this.aBC.style.strokeDashoffset = LBC * (1 - pBC)
      this.aBC.style.opacity = out3
      const tB = this.aBC.getPointAtLength(LBC * pBC), tB0 = this.aBC.getPointAtLength(Math.max(0, LBC * pBC - 3))
      this.hBC.setAttribute('transform', `translate(${tB.x},${tB.y}) rotate(${Math.atan2(tB.y - tB0.y, tB.x - tB0.x) * 180 / Math.PI})`)
      this.hBC.style.opacity = (pBC > .05 ? 1 : 0) * out3
      const lp = this.aBC.getPointAtLength(LBC / 2)
      const lx = lp.x, ly = lp.y + lerp(-46, 50, ce)
      this.lab2.style.left = lx + 'px'; this.lab2.style.top = ly + 'px'
      op(this.lab2, prog(lt, F(3, .8), .5) * out3 * (1 - Math.sin(ce * Math.PI)))
      // A pulses when the loop closes; then a light runs around the loop
      const hit = prog(lt, F(3, .9) + .8, .5)
      this.nA.style.filter = hit > 0 && hit < 1 ? `drop-shadow(0 0 ${30 * Math.sin(hit * Math.PI)}px ${C.yel})` : ''
      const run = lt - (F(3, .9) + 1.1)
      if (run > 0 && out3 > 0) {
        const ph = (run * .45) % 1, onAB = ph < .5
        const path = onAB ? this.aAB : this.aBC, Lp = onAB ? LAB : LBC
        const pt = path.getPointAtLength(Lp * ((ph % .5) * 2))
        this.runner.setAttribute('cx', pt.x); this.runner.setAttribute('cy', pt.y)
        this.runner.style.opacity = prog(run, 0, .4) * out3
      } else this.runner.style.opacity = 0

      // ---------- line 4: yes + dominoes ----------
      rise(this.yes, S.p(lt, 4, .2, .6), 18)
      const u0p = prog(lt, F(4, .16), .6)
      this.u0t.g.style.opacity = u0p
      op(this.u0l, u0p); rise(this.u0n, prog(lt, F(4, .2), .6), 10)
      this.ground.style.opacity = S.p(lt, 4, .3, .6)
      // dominoes stand up, then topple left → right
      const T0 = F(4, .38), dt = .5, D = .72
      const free = this.doms.map((d, k) => 90 * E.in(clamp((lt - T0 - k * dt) / D)))
      const ang = new Array(6)
      for (let k = 5; k >= 0; k--) ang[k] = Math.min(free[k], this.contact(k === 5 ? 0 : ang[k + 1]))
      this.doms.forEach((d, k) => {
        const x = this.X0 + k * this.SP
        const st = prog(lt, S.at(4) + .5 + k * .1, .45)
        d.g.style.opacity = st
        d.g.setAttribute('transform', `translate(0 ${(1 - E.out(st)) * 30}) rotate(${ang[k]} ${x + this.DW} ${this.GY})`)
        const lit = clamp(ang[k] / 25)
        d.t.setAttribute('fill', mixColor(C.dim, C.yel, lit))
        d.t.style.filter = lit > .5 ? `drop-shadow(0 0 8px ${C.yel})` : ''
        d.t.setAttribute('transform', `rotate(${-ang[k]} ${d.cx} ${d.cy})`)
        rise(this.dl[k], st, 10)
      })
      const gp = prog(lt, S.at(4) + 1.1, .5)
      this.ghost.g.style.opacity = gp
      op(this.dmore, gp)
      rise(this.dcap, prog(lt, T0 + .4, .6), 10)
    },
  })
})()

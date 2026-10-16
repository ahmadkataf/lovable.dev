// s24 · تدرّب: تتمّة ③ — item 3: v_n in terms of n, via u_n = u0 + n r, then a check table.
// L0: item 3 card, faded 🎯 hint chip in the corner, pause ring (4 s) in the hold.
// L1: the hint flies in and flashes: u_n = u0 + n r = 1 + n; then v_n = 1/u_n = 1/(n+1) boxed purple.
// L2: the box moves left; a two-row check table (recursion vs closed formula), column ticks, an example (v2), 💡 chip.
(() => {
  const ID = 's24'
  const Y = C.yel, P = C.pur, G = C.grn, B = C.blu, R = C.red
  const col = (c, s) => `\\textcolor{${c}}{${s}}`
  const kt = s => `<bdi class="m">${katex.renderToString(s, KOPT)}</bdi>`
  const badge = (n, c = R) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:1.22em;height:1.22em;border-radius:50%;background:${c};color:#0b1020;font-weight:900;font-size:.78em;line-height:1;vertical-align:.1em;margin-inline-end:.3em">${n}</span>`
  function inkBox(e, ref) {
    const o = ref.getBoundingClientRect()
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9
    for (const n of [e, ...e.querySelectorAll('*')]) {
      if (n.children.length && !n.classList.contains('frac-line')) continue
      if (!n.classList.contains('frac-line') && !n.textContent.trim()) continue
      const r = n.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) continue
      x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top); x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom)
    }
    return { x: x1 - o.left, y: y1 - o.top, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2 - o.left, cy: (y1 + y2) / 2 - o.top }
  }

  scene(ID, {
    build(root, S) {
      this.root = root
      const $ = k => document.getElementById(`${ID}-${k}`)
      this.head = heading(root, 'التمرين ③')

      // ================= rail (as at the end of s23) =================
      this.rail = el('div', '', null, root); place(this.rail, 1420, 194, { anchor: 'cr' })
      this.rail.style.cssText += 'display:flex;gap:16px;direction:rtl;align-items:center'
      const rchip = (html, c, ink) => { const e = el('div', 'chip', html, this.rail); e.style.cssText += `border-color:${c}88;background:${c}1c;color:${ink || c};font-size:28px;padding:6px 22px;white-space:nowrap`; return e }
      this.rGiven = rchip(`${kt('v_0 = 1')} &nbsp;،&nbsp; ${kt('v_{n+1} = \\dfrac{v_n}{1+v_n}')}`, P, C.ink)
      this.rTwo = rchip(`${badge(2, B)}${kt('u_n = \\dfrac{1}{v_n}')}&nbsp; ، &nbsp;${kt('u_0 = 1')} ، ${kt('r = 1')}`, B)
      this.rThree = rchip(`${badge(3, Y)}${kt('v_n = \\dfrac{1}{n+1}')}`, Y)

      // ================= L0: item 3 =================
      const c0 = card(root, 'ex', 960, 330, 1240, { anchor: 'tc', tag: '✏️ التمرين ③ · السؤال الثالث' })
      this.card0 = c0.el
      c0.el.style.padding = '48px 56px 40px'
      this.it3 = rich(`${badge(3)}استنتج عبارة $\\htmlId{${ID}-vn}{v_n}$ بدلالة $n$`, 'h2')
      this.it3.style.cssText += 'text-align:center;font-size:60px'
      c0.body.appendChild(this.it3); splitWords(this.it3)
      this.cdw = el('div', '', null, root); place(this.cdw, 0, 0, { w: W, h: H })
      this.cd = countdown(this.cdw, 960, 700, 70, 'أوقف وفكّر')
      // the hint (bottom-left corner, faded)
      this.hint = el('div', '', null, root)
      place(this.hint, 120, 960, { anchor: 'bl' })
      this.hint.style.cssText += `display:flex;align-items:center;gap:14px;direction:rtl;padding:10px 26px;border-radius:999px;border:2px dashed ${Y}88;background:rgba(255,210,63,.06);color:${Y};font-size:30px;font-weight:700;white-space:nowrap`
      el('span', '', '🎯 تلميح:', this.hint)
      this.hintF = tex('u_n = u_0 + n\\,r', 'mm'); this.hintF.style.fontSize = '42px'; this.hint.appendChild(this.hintF)

      // ================= L1 =================
      this.row1 = tex(`\\htmlId{${ID}-f0}{u_n = \\htmlId{${ID}-u0}{${col(Y, 'u_0')}} + n\\,\\htmlId{${ID}-r}{${col(Y, 'r')}}} \\htmlId{${ID}-f1}{{}= 1 + n}`, 'ml'); root.appendChild(this.row1)
      place(this.row1, 960, 400, { anchor: 'c' })
      this.f0 = $('f0'); this.f1 = $('f1'); this.f0.style.display = 'inline-block'; this.f1.style.display = 'inline-block'
      this.flash = el('div', '', null, root)
      this.flash.style.cssText = `position:absolute;border-radius:18px;border:3px solid ${Y};box-shadow:0 0 34px ${Y}88;pointer-events:none`
      this.flashTag = el('div', '', '🎯 من درس المتتالية الحسابيّة', root)
      this.flashTag.style.cssText = `position:absolute;padding:5px 18px;border-radius:999px;font-size:26px;font-weight:800;color:#0b1020;background:${Y};white-space:nowrap`
      // u0 → 1 and r → 1 notes (from the rail)
      this.n0 = tex(`u_0 = 1`, 'ms'); this.nr = tex(`r = 1`, 'ms')
      ;[this.n0, this.nr].forEach(e => { root.appendChild(e); e.style.cssText += `color:${B};font-size:34px` })
      this.kb = keyBox(root, `v_n = \\dfrac{1}{u_n} = \\dfrac{1}{n+1}`, 960, 712, { color: P, label: 'النتيجة' })
      this.kb.el.style.background = 'rgba(167,139,250,.08)'

      // ================= L2: the check =================
      const kt2 = s => { const e = tex(s, 'mm'); e.style.fontSize = '50px'; return e }
      const lab = (html, c) => { const e = rich(html, 's'); e.style.cssText += `color:${c};font-size:30px;font-weight:800;white-space:nowrap;line-height:1.35`; return e }
      const rows = [
        [lab('الدليل&nbsp; $n$', P), ...[0, 1, 2, 3].map(v => kt2(String(v)))],
        [lab('من العلاقة التدريجيّة', B), ...['1', '\\dfrac12', '\\dfrac13', '\\dfrac14'].map(kt2)],
        [lab('من الصيغة&nbsp; $\\dfrac{1}{n+1}$', P), ...['1', '\\dfrac12', '\\dfrac13', '\\dfrac14'].map(kt2)],
      ]
      this.tb = table(root, rows, 1800, 316, { anchor: 'tr', headRow: true, headCol: true })
      this.tb.el.style.direction = 'rtl'
      this.tb.el.style.background = 'rgba(20,29,56,.85)'
      this.tb.el.style.borderRadius = '18px'
      this.tb.el.style.overflow = 'hidden'
      this.tb.cells.forEach((r, i) => r.forEach((c, j) => {
        c.style.padding = j === 0 ? '16px 28px' : '14px 22px'
        c.style.minWidth = j === 0 ? '320px' : '150px'
        c.style.height = i === 0 ? '84px' : '128px'
        if (i === 0 && j > 0) c.style.color = B
        if (j === 0) c.style.textAlign = 'right'
      }))
      this.tb.cells[0][0].firstChild.style.color = P
      this.colHL = el('div', '', null, root)
      this.colHL.style.cssText = `position:absolute;border-radius:16px;border:3px solid ${Y};box-shadow:0 0 26px ${Y}55;pointer-events:none`
      this.ticks = [0, 1, 2, 3].map(() => {
        const t = el('div', '', '✓', root)
        t.style.cssText = `position:absolute;width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:#0b1020;background:${G};box-shadow:0 0 22px ${G}88`
        return t
      })
      this.same = rich('<span class="grn b">النتيجتان متطابقتان</span>', 'p'); root.appendChild(this.same)
      this.same.style.whiteSpace = 'nowrap'
      // example (left column)
      this.ex = el('div', '', null, root)
      place(this.ex, 430, 690, { anchor: 'c' })
      this.ex.style.cssText += `padding:24px 34px 20px;border-radius:24px;border:2.5px solid ${B}88;background:rgba(56,189,248,.07);direction:rtl;text-align:center`
      const exT = rich('مثلاً، من العلاقة التدريجيّة:', 's'); exT.style.cssText += `color:${B};font-size:28px;font-weight:700;white-space:nowrap`; this.ex.appendChild(exT)
      const exF = tex(`v_2 = \\dfrac{\\frac12}{1+\\frac12} = ${col(Y, '\\dfrac13')}`, 'mm'); exF.style.cssText += 'font-size:46px;margin-top:6px'; this.ex.appendChild(exF)
      this.tip = chip(root, '💡 انظر إلى المقلوب', 430, 900, { anchor: 'c', color: Y })
      this.tip.style.cssText += 'font-size:36px;padding:12px 34px'

      this._layout()
    },

    _sigNow() { return [this.row1, this.kb.el, this.tb.el, this.it3, this.rail].map(e => e.offsetWidth + 'x' + e.offsetHeight).join('|') },
    _layout() {
      this._sig = this._sigNow()
      const root = this.root
      root.querySelectorAll('*').forEach(e => { if (e.style && e.style.transform) e.style.transform = '' })
      const R = e => rectIn(e, root)
      // card → rail chip 3
      const c0 = R(this.card0), g3 = R(this.rThree)
      this.fly0 = { dx: g3.cx - c0.cx, dy: g3.cy - c0.cy, s: g3.w / c0.w }
      // hint → above row 1
      const f0 = inkBox(this.f0, root), hf = R(this.hintF), hb = R(this.hint)
      this.hintFly = { dx: f0.cx - hf.cx, dy: f0.cy - hf.cy, s: f0.w / hf.w }
      this.hintBox = hb
      place(this.flash, f0.x - 22, f0.y - 16, { w: f0.w + 44, h: f0.h + 32 })
      place(this.flashTag, f0.cx, f0.y - 30, { anchor: 'bc' })
      // u0 / r notes under the yellow letters
      const u0 = inkBox(document.getElementById(`${ID}-u0`), root), rr = inkBox(document.getElementById(`${ID}-r`), root)
      place(this.n0, u0.cx, f0.y + f0.h + 34, { anchor: 'c' })
      place(this.nr, rr.cx + 6, f0.y + f0.h + 34, { anchor: 'c' })
      // key box: center → left column
      const kb = R(this.kb.el)
      this.kbTo = { dx: 430 - kb.cx, dy: 420 - kb.cy, s: Math.min(.8, 600 / kb.w) }
      // table columns
      const cells = this.tb.cells
      this.colR = [1, 2, 3, 4].map(j => { const a = R(cells[0][j]), b = R(cells[2][j]); return { x: a.x, y: a.y, w: a.w, h: b.y + b.h - a.y, cx: a.cx } })
      const tbR = R(this.tb.el)
      this.ticks.forEach((t, k) => place(t, this.colR[k].cx, tbR.y + tbR.h + 46, { anchor: 'c' }))
      place(this.same, tbR.x + tbR.w, tbR.y + tbR.h + 120, { anchor: 'cr' })
      this.rowEls = cells
    },

    render(lt, S) {
      if (this._sig !== this._sigNow()) this._layout()
      const F = (i, f) => S.at(i) + f * (S.end(i) - S.at(i))
      this.head.set(S.p(lt, 0, 0, .8))
      // rail: carried over from s23; chip 3 arrives when item 3 is answered
      const r3 = prog(lt, Math.max(F(2, 0), S.at(2)) + .2, .5)
      op(this.rGiven, 1); op(this.rTwo, 1)
      ;[this.rGiven, this.rTwo].forEach(e => (e.style.transform = ''))
      pop(this.rThree, r3)

      // ================= L0 =================
      const out0 = S.p(lt, 1, 0, .75)
      const cIn = S.p(lt, 0, .1, .7)
      op(this.card0, Math.min(cIn, 1 - out0))
      this.card0.style.transform = `translateY(${(1 - cIn) * 36 - out0 * 120}px) scale(${lerp(1, .9, out0)})`
      typeWords(this.it3, S.f(lt, 0, .05, .7))
      {
        const hs = S.end(0), he = Math.max(hs + .5, S.at(1) - .25)
        op(this.cdw, Math.min(prog(lt, F(0, .7), .5), 1 - S.p(lt, 1, 0, .4)))
        const q = clamp((lt - hs) / (he - hs))
        this.cd(Math.max(.001, q), 4 * (1 - q))
      }
      // hint: faded in the corner, then flies to row 1 and becomes it
      const hIn = S.p(lt, 0, .9, .8)
      const hFly = S.p(lt, 1, .1, .9)
      const hf = this.hintFly
      op(this.hint, Math.min(hIn * lerp(.5, 1, hFly), 1 - prog(lt, S.at(1) + .95, .25)))
      this.hint.style.transform = `translate(${hf.dx * E.io(hFly)}px, ${hf.dy * E.io(hFly)}px)`
      this.hint.style.transformOrigin = `${this.hintF.offsetLeft + this.hintF.offsetWidth / 2}px 50%`
      if (hFly > 0) this.hint.style.transform += ` scale(${lerp(1, hf.s, E.io(hFly))})`

      // ================= L1 =================
      const out1 = S.p(lt, 2, 0, .5)
      const f0In = prog(lt, S.at(1) + .95, .3)
      op(this.f0, f0In); op(this.row1, 1 - out1)
      const fl = env(lt, S.at(1) + 1.05, Math.max(F(1, .3), S.at(1) + 2.6), .25, .5)
      op(this.flash, fl * (.75 + .25 * Math.sin(lt * 9))); this.flash.style.transform = `scale(${lerp(1.12, 1, E.out(clamp(fl)))})`
      op(this.flashTag, fl); this.flashTag.style.transform = `translateY(${(1 - E.out(clamp(fl))) * 10}px)`
      const nP = prog(lt, Math.max(F(1, .3), S.at(1) + 2.2), .5)
      ;[this.n0, this.nr].forEach((e, k) => rise(e, Math.min(prog(lt, Math.max(F(1, .3), S.at(1) + 2.2) + k * .2, .5), 1 - out1), 10))
      const f1In = prog(lt, Math.max(F(1, .38), S.at(1) + 2.8), .7)
      wipe(this.f1, f1In, 'ltr')
      const kbIn = prog(lt, Math.max(F(1, .58), S.at(1) + 3.8), .7)
      const kbMove = S.p(lt, 2, 0, .9)
      this.kb.set(kbIn)
      const k = this.kbTo
      if (kbIn >= 1) this.kb.el.style.transform = `translate(${k.dx * kbMove}px, ${k.dy * kbMove}px) scale(${lerp(1, k.s, kbMove)})`
      this.kb.el.style.boxShadow = `0 0 ${40 + 16 * Math.sin(lt * 2)}px rgba(167,139,250,${.3 * clamp(kbIn)})`

      // ================= L2 =================
      const tIn = S.p(lt, 2, .35, .7)
      rise(this.tb.el, tIn, 30)
      const cells = this.rowEls
      // recursion row fills one column at a time (as the narrator computes), then the formula row
      const tR = [Math.max(F(2, .06), S.at(2) + .7), Math.max(F(2, .2), S.at(2) + 1.3), Math.max(F(2, .36), S.at(2) + 1.9), Math.max(F(2, .46), S.at(2) + 2.5)]
      const tF0 = Math.max(F(2, .56), tR[3] + .6)
      const tFm = [0, 1, 2, 3].map(j => tF0 + j * .3)
      const tT = [0, 1, 2, 3].map(j => Math.max(F(2, .66), tFm[3] + .5) + j * .22)
      for (let j = 1; j <= 4; j++) {
        op(cells[0][j].firstChild, 1)
        const a = prog(lt, tR[j - 1], .45), b = prog(lt, tFm[j - 1], .45)
        const ca = cells[1][j].firstChild, cb = cells[2][j].firstChild
        op(ca, a); ca.style.transform = `translateY(${(1 - a) * 16}px)`
        op(cb, b); cb.style.transform = `translateY(${(1 - b) * 16}px)`
      }
      op(cells[1][0].firstChild, prog(lt, tR[0] - .4, .45)); op(cells[2][0].firstChild, prog(lt, tF0 - .4, .45))
      // a moving yellow frame on the column being computed
      let cur = -1
      for (let j = 0; j < 4; j++) if (lt >= tR[j]) cur = j
      const hlOn = Math.min(prog(lt, tR[0], .3), 1 - prog(lt, tF0 - .1, .4))
      if (cur >= 0) {
        const pj = cur > 0 ? E.io(prog(lt, tR[cur], .4)) : 1
        const a = this.colR[Math.max(0, cur - 1)], b = this.colR[cur]
        place(this.colHL, lerp(a.x, b.x, pj) + 4, a.y + 4, { w: b.w - 8, h: b.h - 8 })
      }
      op(this.colHL, cur >= 0 ? hlOn : 0)
      this.ticks.forEach((t, j) => pop(t, prog(lt, tT[j], .5)))
      rise(this.same, prog(lt, tT[3] + .3, .5), 14)
      // example v2 next to the table (appears with column n = 2)
      const exP = prog(lt, tR[2] + .2, .6)
      rise(this.ex, exP, 24)
      const tipP = prog(lt, Math.max(F(2, .8), tT[3] + .4), .6)
      pop(this.tip, tipP)
      this.tip.style.boxShadow = tipP >= 1 ? `0 0 ${24 + 14 * Math.sin(lt * 2.4)}px rgba(255,210,63,.35)` : ''
    },
  })
})()

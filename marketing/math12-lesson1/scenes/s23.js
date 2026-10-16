// s23 · تدرّب: التمرين ③ — positivity passes from each term to the next (machine + dominoes), then the reciprocal trick.
// L0: the exercise card (statement + item 1), pause ring in the hold.
// L1: v0 = 1 > 0; if v_n > 0 then (one LTR chain) 1 + v_n > 0 ⇒ v_{n+1} = v_n / (1 + v_n) > 0 (numerator & denominator tagged green «> 0»).
// Cue fractions follow the real narration (word timings of voice/sections/L01_s6).
// L2: the machine f(x) = x/(1+x) sends positive to positive (callback to the «بوجه عام» card); dominoes topple → lesson 2.
// L3: item 2 (u_n = 1/v_n), why it is defined, pause ring in the hold.
// L4: u_{n+1} = 1/v_{n+1}: the fraction flips, then splits.
// L5: u_{n+1} = u_n + 1 (boxed), r = 1, u0 = 1, +1 hops on a number line.
(() => {
  const ID = 's23'
  const Y = C.yel, P = C.pur, G = C.grn, B = C.blu, R = C.red
  const col = (c, s) => `\\textcolor{${c}}{${s}}`
  const kt = s => `<bdi class="m">${katex.renderToString(s, KOPT)}</bdi>`
  const badge = (n, c = R) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:1.22em;height:1.22em;border-radius:50%;background:${c};color:#0b1020;font-weight:900;font-size:.78em;line-height:1;vertical-align:.1em;margin-inline-end:.3em">${n}</span>`
  let uid = 0

  // ---------- the «function machine» (same look as s03/s05) ----------
  function machine(root, cx, cy, o = {}) {
    const w = o.w ?? 460, h = o.h ?? 260
    const g = el('div', '', null, root)
    g.style.cssText += `position:absolute;left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;z-index:5`
    const hs = svg(g, w / 2 - 90, -54, 180, 58)
    const gid = `${ID}-mg${++uid}`
    const lg = sv(sv(hs, 'defs'), 'linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 })
    sv(lg, 'stop', { offset: 0, 'stop-color': '#3d2d86' }); sv(lg, 'stop', { offset: 1, 'stop-color': '#2a1f63' })
    const hop = sv(hs, 'path', { d: 'M6,3 L174,3 L132,58 L48,58 Z', fill: `url(#${gid})`, stroke: C.pur, 'stroke-width': 3, 'stroke-linejoin': 'round' })
    sv(hs, 'ellipse', { cx: 90, cy: 8, rx: 74, ry: 5, fill: '#060a17', opacity: .9 })
    const chute = el('div', '', null, g)
    chute.style.cssText = `position:absolute;left:${w / 2 - 60}px;top:${h - 8}px;width:120px;height:34px;border-radius:0 0 16px 16px;background:linear-gradient(180deg,#2a1f63,#1d1648);border:3px solid ${C.pur};border-top:none`
    const mouth = el('div', '', null, chute)
    mouth.style.cssText = 'position:absolute;left:16px;right:16px;bottom:7px;height:7px;border-radius:4px;background:#060a17'
    const body = el('div', '', null, g)
    body.style.cssText = `position:absolute;inset:0;border-radius:34px;border:3px solid ${C.pur};background:linear-gradient(180deg,#31246f 0%,#1c1648 100%)`
    const win = el('div', '', null, body)
    win.style.cssText = `position:absolute;left:26px;right:26px;top:22px;bottom:46px;border-radius:18px;background:linear-gradient(180deg,rgba(6,10,26,.94),rgba(14,20,44,.94));border:2px solid rgba(167,139,250,.55);box-shadow:inset 0 0 26px rgba(56,189,248,.12);overflow:hidden`
    const sheen = el('div', '', null, win)
    sheen.style.cssText = 'position:absolute;top:-30%;bottom:-30%;width:46%;background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.04) 30%,rgba(255,255,255,.085) 50%,rgba(255,255,255,.04) 70%,rgba(255,255,255,0) 100%);transform:skewX(-18deg);pointer-events:none;z-index:2'
    const tag = el('div', '', o.tag ?? 'تابع', g)
    tag.style.cssText = `position:absolute;top:-20px;right:26px;padding:4px 18px;border-radius:999px;font-size:24px;font-weight:800;color:#0b1020;background:${C.pur};z-index:3;white-space:nowrap`
    const lights = [0, 1, 2].map(i => {
      const d = el('div', '', null, body)
      d.style.cssText = `position:absolute;left:${30 + i * 24}px;bottom:16px;width:12px;height:12px;border-radius:50%;background:#43397a`
      return d
    })
    const v = tex(o.latex, 'mm'); win.appendChild(v)
    v.style.cssText += 'position:absolute;left:50%;top:50%;translate:-50% -50%'
    return {
      g, win, v,
      set(lt, st = {}) {
        const work = clamp(st.work || 0)
        const glowA = .28 + .3 * work
        body.style.boxShadow = `0 0 ${46 + 40 * work}px rgba(167,139,250,${glowA}),inset 0 2px 0 rgba(255,255,255,.14),inset 0 -14px 30px rgba(0,0,0,.35)`
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
  function card2(root, latex, c) {
    const e = el('div', '', null, root)
    e.style.cssText = `position:absolute;left:0;top:0;translate:-50% -50%;padding:8px 22px;border-radius:16px;border:2.5px solid ${c};background:rgba(20,24,44,.92);box-shadow:0 0 24px ${c}55;z-index:6;color:${c};white-space:nowrap`
    e.appendChild(tex(latex, 'mm'))
    return e
  }
  const pill = (root, html, c, fs = 30) => {
    const e = el('div', '', html, root)
    e.style.cssText = `position:absolute;padding:4px 16px;border-radius:999px;border:2px solid ${c};background:${c}22;color:${c};font-size:${fs}px;font-weight:800;white-space:nowrap;direction:ltr;box-shadow:0 0 18px ${c}44`
    return e
  }
  // visible extent of a KaTeX piece (union of its glyph leaves and fraction bars), relative to `ref`
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
  const marker = (root, c = C.yel) => {
    const e = el('div', '', null, root)
    e.style.cssText = `position:absolute;border-radius:14px;border:3px solid ${c};background:rgba(255,210,63,.07);box-shadow:0 0 26px rgba(255,210,63,.3);pointer-events:none;transform-origin:100% 50%`
    op(e, 0)
    return e
  }

  scene(ID, {
    build(root, S) {
      this.root = root
      root.style.isolation = 'isolate'
      const $ = k => document.getElementById(`${ID}-${k}`)
      this.head = heading(root, 'التمرين ③')

      // ================= rail (top-left): what is settled so far =================
      this.rail = el('div', '', null, root); place(this.rail, 1420, 194, { anchor: 'cr' })
      this.rail.style.cssText += 'display:flex;gap:16px;direction:rtl;align-items:center'
      const rchip = (html, c, ink) => { const e = el('div', 'chip', html, this.rail); e.style.cssText += `border-color:${c}88;background:${c}1c;color:${ink || c};font-size:28px;padding:6px 22px;white-space:nowrap`; return e }
      this.rGiven = rchip(`${kt('v_0 = 1')} &nbsp;،&nbsp; ${kt('v_{n+1} = \\dfrac{v_n}{1+v_n}')}`, P, C.ink)
      this.rOne = rchip(`${badge(1, G)}${kt('v_n > 0')} ✓`, G)
      this.rTwo = rchip(`${badge(2, B)}${kt('u_n = \\dfrac{1}{v_n}')}<span id="${ID}-r2x" style="display:inline-block;flex:none;overflow:hidden;white-space:nowrap;vertical-align:middle">&nbsp;&nbsp;،&nbsp;&nbsp;${kt('u_0 = 1')}&nbsp;&nbsp;،&nbsp;&nbsp;${kt('r = 1')}</span>`, B)
      // the ❷ chip later grows to «u_0 = 1 ، r = 1» (as s24 opens with it)
      this.r2x = document.getElementById(`${ID}-r2x`); this.r2x.style.maxWidth = '0px'

      // ================= L0: the exercise =================
      const c0 = card(root, 'ex', 960, 318, 1680, { anchor: 'tc', tag: '✏️ تدرَّبْ · التمرين ③ · ص 11' })
      this.card0 = c0.el
      c0.el.style.padding = '46px 56px 38px'
      this.st = rich(`$(\\htmlId{${ID}-vl}{v}_n)_{n\\ge0}$ متتالية معرّفة تدريجيّاً وفق $\\htmlId{${ID}-v0}{v_0 = 1}$ و $\\htmlId{${ID}-rec}{v_{n+1} = \\dfrac{v_n}{1+v_n}}$`, 'h3')
      this.st.style.fontSize = '50px'
      c0.body.appendChild(this.st); splitWords(this.st)
      this.it1 = rich(`${badge(1)}تحقّق أنّ $v_n > 0$ أيّاً كان العدد الطبيعي $n$`, 'p')
      this.it1.style.cssText += 'margin-top:22px;font-size:44px'
      c0.body.appendChild(this.it1); splitWords(this.it1)
      this.mkV0 = marker(c0.el); this.mkRec = marker(c0.el)
      this.vl = $('vl'); this.vl.style.display = 'inline-block'
      this.cdw = el('div', '', null, root); place(this.cdw, 0, 0, { w: W, h: H })
      this.cd = countdown(this.cdw, 960, 806, 70, 'أوقف وفكّر')

      // ================= L1: the argument =================
      this.rowA = rich(`<b class="blu">البداية:</b>&nbsp; $v_0 = 1 ${col(G, '> 0')}$`, 'h3'); root.appendChild(this.rowA)
      place(this.rowA, 960, 300, { anchor: 'tc' }); this.rowA.style.whiteSpace = 'nowrap'
      this.ckA = el('div', '', '✓', root)
      this.ckA.style.cssText = `position:absolute;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:#0b1020;background:${G};box-shadow:0 0 24px ${G}88`
      this.rowB = rich(`<b class="blu">الانتقال:</b>&nbsp; إذا كان $v_n > 0$ <span id="${ID}-then">فإنّ</span>`, 'h3'); root.appendChild(this.rowB)
      place(this.rowB, 960, 408, { anchor: 'tc' }); this.rowB.style.whiteSpace = 'nowrap'
      this.thenB = $('then'); this.thenB.style.display = 'inline-block'
      // the chain after «فإنّ» is one LTR KaTeX block (the Arabic stays outside it)
      this.rowC = tex(`1 + v_n ${col(G, '> 0')} \\;\\Rightarrow\\; v_{n+1} = \\dfrac{\\htmlId{${ID}-num}{v_n}}{\\htmlId{${ID}-den}{1+v_n}} \\htmlId{${ID}-gt}{{} ${col(G, '> 0')}}`, 'ml'); root.appendChild(this.rowC)
      this.rowC.style.fontSize = '74px'
      place(this.rowC, 960, 690, { anchor: 'c' })
      this.gt = $('gt'); this.gt.style.display = 'inline-block'
      this.pNum = pill(root, `${kt('> 0')}`, G); this.pDen = pill(root, `${kt('> 0')}`, G)
      this.tNum = rich('البسط موجب', 's'); this.tDen = rich('المقام موجب', 's')
      ;[this.tNum, this.tDen].forEach(e => { root.appendChild(e); e.style.cssText += `white-space:nowrap;color:${G};font-size:28px` })

      // ================= L2: machine + dominoes =================
      this.MX = 470; this.MY = 490
      this.mach = machine(root, this.MX, this.MY, { w: 420, h: 196, latex: 'f(x) = \\dfrac{x}{1+x}', tag: 'f' })
      this.inC = card2(root, 'x > 0', Y)
      this.outC = card2(root, 'f(x) > 0', G)
      const tc = card(root, 'tip', 1800, 320, 820, { anchor: 'tr', tag: '💡 بوجه عام · ص 7' })
      this.tip = tc.el
      tc.el.style.padding = '40px 44px 30px'
      const t1 = rich(`$\\htmlId{${ID}-D}{D = \\left]0,+\\infty\\right[}$ &nbsp;و&nbsp; $f(x) = \\dfrac{x}{1+x}$`, 'p'); tc.body.appendChild(t1)
      t1.style.cssText += 'white-space:nowrap;font-size:40px'
      const t2 = rich(`مهما يكن $x$ من $D$ يكن $f(x)$ من $D$`, 'p'); tc.body.appendChild(t2)
      t2.style.cssText += `white-space:nowrap;margin-top:10px;color:${Y};font-weight:700`
      const t3 = rich(`<span class="grn b">مُدخَلٌ موجب ← مُخرَجٌ موجب</span>`, 's'); tc.body.appendChild(t3)
      t3.style.cssText += 'white-space:nowrap;margin-top:6px'
      this.tipRows = [t1, t2, t3]
      this.Dpart = $('D'); this.Dpart.style.color = P

      // dominoes (SVG, toppling left → right as in s08)
      this.GY = 896; this.DW = 78; this.DH = 176; this.X0 = 200; this.SP = 150
      const ds = svg(root, 0, 0, W, H); ds.style.direction = 'ltr'
      this.ds = ds
      this.ground = sv(ds, 'path', { d: `M150,${this.GY + 2} L1300,${this.GY + 2}`, stroke: 'rgba(154,168,201,.35)', 'stroke-width': 3 })
      const tile = (x, txt, c, fill) => {
        const g = sv(ds, 'g')
        const r = sv(g, 'rect', { x, y: this.GY - this.DH, width: this.DW, height: this.DH, rx: 11, fill, stroke: c, 'stroke-width': 3 })
        sv(g, 'path', { d: `M${x + 10},${this.GY - this.DH / 2} L${x + this.DW - 10},${this.GY - this.DH / 2}`, stroke: c, 'stroke-width': 2, opacity: .45 })
        const t = sv(g, 'text', { x: x + this.DW / 2, y: this.GY - this.DH * .75 + 13, 'text-anchor': 'middle', 'font-family': 'KaTeX_Main', 'font-size': 33, 'font-weight': 700, fill: c })
        t.textContent = txt
        return { g, r, t, cx: x + this.DW / 2, cy: this.GY - this.DH * .75 }
      }
      this.ghost = tile(this.X0 + 6 * this.SP, '>0', 'rgba(110,224,90,.35)', 'rgba(26,35,80,.35)')
      this.ghost.r.setAttribute('stroke-dasharray', '10 8')
      this.doms = [0, 1, 2, 3, 4, 5].map(k => tile(this.X0 + k * this.SP, '>0', C.dim, '#1a2350'))
      const vals = ['1', '\\tfrac12', '\\tfrac13', '\\tfrac14', '\\tfrac15', '\\tfrac16']
      this.dl = vals.map((v, k) => {
        const e = tex(`${col(B, `v_${k}`)} = ${v}`, 'ms'); root.appendChild(e)
        place(e, this.X0 + k * this.SP + this.DW / 2, this.GY + 40, { anchor: 'c' }); e.style.fontSize = '34px'
        return e
      })
      this.dmore = tex('\\cdots', 'mx'); root.appendChild(this.dmore); place(this.dmore, this.X0 + 6 * this.SP + this.DW + 50, this.GY - 40, { anchor: 'c' })
      this.dmore.style.color = C.mut
      // lesson-2 tag at the end of the row
      this.l2 = el('div', '', null, root)
      place(this.l2, 1800, 800, { anchor: 'cr', w: 470 })
      this.l2.style.cssText += `padding:22px 30px;border-radius:22px;border:2.5px solid ${P};background:rgba(124,58,237,.16);box-shadow:0 0 40px rgba(124,58,237,.35);direction:rtl;text-align:right`
      el('div', 's', 'الصياغة الكاملة:', this.l2).style.cssText += 'font-size:30px;color:' + C.mut
      el('div', 'h3', 'البرهان بالتدريج', this.l2).style.cssText += `color:${P};font-size:46px;font-weight:900;line-height:1.25`
      const l2c = el('div', 'chip', 'الدرس 2 ←', this.l2); l2c.style.cssText += `margin-top:12px;font-size:26px;padding:6px 18px;color:#0b1020;background:${P};border-color:${P}`

      // ================= L3: item 2 =================
      const c3 = card(root, 'ex', 960, 318, 1680, { anchor: 'tc', tag: '✏️ التمرين ③ · السؤال الثاني' })
      this.card3 = c3.el
      c3.el.style.padding = '46px 56px 38px'
      this.it2 = rich(`${badge(2)}أثبت أنّ المتتالية $\\htmlId{${ID}-un}{(u_n)_{n\\ge0}}$ المعرّفة بالعلاقة $\\htmlId{${ID}-udef}{u_n = \\dfrac{1}{v_n}}$ <span id="${ID}-ar" style="white-space:nowrap">متتالية حسابيّة</span>`, 'h3')
      this.it2.style.fontSize = '47px'
      c3.body.appendChild(this.it2)
      this.arSpan = $('ar')
      this.mkU = marker(c3.el); this.ulAr = el('div', 'uline', null, c3.el); op(this.ulAr, 0)
      // «نعرّف متتاليةً جديدة»: a small purple tag points at (u_n)
      this.mkNew = marker(c3.el, P); this.mkNew.style.background = 'rgba(167,139,250,.1)'; this.mkNew.style.boxShadow = `0 0 22px ${P}55`
      this.newTag = el('div', '', null, root)
      this.newTag.style.cssText = `position:absolute;display:flex;flex-direction:column;align-items:center;color:${P};z-index:3`
      el('div', '', '▲', this.newTag).style.cssText = 'font-size:22px;line-height:1;margin-bottom:-2px'
      const nt = el('div', '', 'متتالية جديدة', this.newTag)
      nt.style.cssText = `padding:4px 20px;border-radius:999px;border:2.5px solid ${P};background:rgba(30,24,70,.96);font-size:28px;font-weight:800;white-space:nowrap;direction:rtl;box-shadow:0 0 20px ${P}55`
      this.note = rich(`$v_n > 0 \\;\\Rightarrow\\; v_n \\ne 0$ &nbsp;بحسب ${badge(1, B)}&nbsp; فالكسر $\\dfrac{1}{v_n}$ معرّف`, 'p'); root.appendChild(this.note)
      place(this.note, 960, 676, { anchor: 'c' })
      this.note.style.cssText += `white-space:nowrap;padding:12px 36px;border-radius:26px;border:2.5px solid ${B}99;background:${B}14`
      this.cdw2 = el('div', '', null, root); place(this.cdw2, 0, 0, { w: W, h: H })
      this.cd2 = countdown(this.cdw2, 960, 866, 60, 'أوقف وفكّر')

      // ================= L4: flip and split =================
      const inner = `\\dfrac{${col(Y, 'v_n')}}{${col(B, '1+v_n')}}`
      this.chain = tex(`\\begin{aligned}
        \\htmlId{${ID}-a0}{u_{n+1}} &\\htmlId{${ID}-a1}{{}= \\dfrac{1}{v_{n+1}}} \\htmlId{${ID}-a2}{{}= \\dfrac{1}{\\;\\htmlId{${ID}-inner}{${inner}}\\;}} \\htmlId{${ID}-a3}{{}= \\dfrac{${col(B, '1+v_n')}}{${col(Y, 'v_n')}}} \\\\[12pt]
        &\\htmlId{${ID}-b1}{{}= \\dfrac{\\htmlId{${ID}-b1a}{1}}{v_n} + \\htmlId{${ID}-vv}{\\dfrac{${col(Y, 'v_n')}}{${col(Y, 'v_n')}}}} \\htmlId{${ID}-b2}{{}= \\htmlId{${ID}-inv}{\\dfrac{1}{v_n}} + ${col(Y, '1')}}
      \\end{aligned}`, 'mx'); root.appendChild(this.chain)
      this.chain.style.fontSize = '70px'
      place(this.chain, 960, 624, { anchor: 'c' })
      this.ch = {}
      for (const k of ['a0', 'a1', 'a2', 'a3', 'b1', 'b2', 'inner', 'vv', 'inv']) { this.ch[k] = $(k); this.ch[k].style.display = 'inline-block' }
      this.capFlip = rich('نقلب الكسر', 's'); this.capSplit = rich('نجزّئ الكسر', 's')
      ;[this.capFlip, this.capSplit].forEach(e => { root.appendChild(e); e.style.cssText += `white-space:nowrap;color:${Y};font-weight:800;font-size:30px` })
      this.flipSvg = svg(root, 0, 0, W, H)
      this.flipArc = sv(this.flipSvg, 'path', { d: '', fill: 'none', stroke: Y, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': '2 0' })
      this.flipHead = sv(this.flipSvg, 'path', { d: '', fill: Y })
      this.strikes = [0, 1].map(() => { const s = el('div', '', null, root); s.style.cssText = `position:absolute;height:4px;border-radius:2px;background:${Y};box-shadow:0 0 10px ${Y}aa;transform-origin:0 50%`; op(s, 0); return s })
      // L5 bridge: 1/v_n is u_n
      this.uTag = el('div', '', null, root)
      this.uTag.style.cssText = `position:absolute;display:flex;flex-direction:column;align-items:center;color:${Y}`
      const ar = el('div', '', '▲', this.uTag); ar.style.cssText = 'font-size:22px;line-height:1'
      const ut = tex(`= u_n`, 'mm'); ut.style.cssText += `padding:2px 16px;border-radius:14px;border:2.5px solid ${Y};background:rgba(255,210,63,.12)`; this.uTag.appendChild(ut)

      // ================= L5: arithmetic =================
      this.kb = keyBox(root, 'u_{n+1} = u_n + 1', 960, 372, { color: G, label: '✓ حسابيّة' })
      this.kb.el.style.background = 'rgba(110,224,90,.07)'
      this.diff = rich(`أي &nbsp;$u_{n+1} - u_n = 1$&nbsp; <span class="grn b">ثابت</span>`, 'h3'); root.appendChild(this.diff)
      place(this.diff, 960, 498, { anchor: 'tc' }); this.diff.style.whiteSpace = 'nowrap'
      this.row5 = el('div', '', null, root); place(this.row5, 960, 640, { anchor: 'c' })
      this.row5.style.cssText += 'display:flex;gap:44px;direction:rtl;align-items:center'
      this.ar5 = rich(`متتالية حسابيّة أساسها $${col(G, 'r = 1')}$`, 'p'); this.row5.appendChild(this.ar5)
      this.ar5.style.cssText += `white-space:nowrap;padding:10px 32px;border-radius:24px;border:2.5px solid ${G}99;background:${G}14;font-weight:700`
      this.u05 = rich(`حدّها الأوّل $u_0 = \\dfrac{1}{v_0} = ${col(Y, '1')}$`, 'p'); this.row5.appendChild(this.u05)
      this.u05.style.cssText += `white-space:nowrap;padding:6px 32px;border-radius:24px;border:2.5px solid ${Y}88;background:${Y}12`
      // number line with +1 hops
      this.NY = 846; this.NX = v => 440 + v * 220
      const ns = svg(root, 0, 0, W, H); ns.style.direction = 'ltr'
      this.axis = sv(ns, 'path', { d: `M${this.NX(-.4)},${this.NY} L${this.NX(5.3)},${this.NY}`, stroke: C.mut, 'stroke-width': 3, fill: 'none' })
      this.axHead = sv(ns, 'path', { d: `M${this.NX(5.3) + 16},${this.NY} L${this.NX(5.3) - 4},${this.NY - 10} L${this.NX(5.3) - 4},${this.NY + 10} Z`, fill: C.mut })
      this.ticks = [0, 1, 2, 3, 4, 5].map(v => {
        const t = sv(ns, 'path', { d: `M${this.NX(v)},${this.NY - 10} L${this.NX(v)},${this.NY + 10}`, stroke: C.mut, 'stroke-width': 3 })
        const l = tex(String(v), 'ms'); root.appendChild(l); place(l, this.NX(v), this.NY + 36, { anchor: 'c' }); l.style.color = v >= 1 && v <= 4 ? C.ink : C.dim
        return { t, l }
      })
      this.hops = [1, 2, 3].map(k => {
        const x1 = this.NX(k) + 10, x2 = this.NX(k + 1) - 12
        const p = sv(ns, 'path', { d: `M${x1},${this.NY - 8} Q${(x1 + x2) / 2},${this.NY - 110} ${x2},${this.NY - 10}`, fill: 'none', stroke: G, 'stroke-width': 5, 'stroke-linecap': 'round' })
        const h = sv(ns, 'path', { d: `M${x2 + 2},${this.NY - 6} L${x2 - 16},${this.NY - 14} L${x2 - 6},${this.NY - 28} Z`, fill: G })
        const l = tex('+1', 'mm'); root.appendChild(l); place(l, (x1 + x2) / 2, this.NY - 60, { anchor: 'bc' }); l.style.color = G
        return { p, h, l }
      })
      this.pts = [1, 2, 3, 4].map((v, k) => {
        const c = sv(ns, 'circle', { cx: this.NX(v), cy: this.NY, r: 13, fill: Y })
        c.style.transformOrigin = `${this.NX(v)}px ${this.NY}px`
        const l = tex(`u_${k}`, 'ms'); root.appendChild(l); place(l, this.NX(v), this.NY + 84, { anchor: 'c' }); l.style.color = B
        return { c, l }
      })
      this.nmore = tex('\\cdots', 'mm'); root.appendChild(this.nmore); place(this.nmore, this.NX(4.62), this.NY - 40, { anchor: 'c' }); this.nmore.style.color = G

      this._layout()
    },

    _sigNow() { return [this.rowC, this.chain, this.st, this.it2, this.rGiven, this.note].map(e => e.offsetWidth + 'x' + e.offsetHeight).join('|') },
    _layout() {
      this._sig = this._sigNow()
      const root = this.root
      root.querySelectorAll('*').forEach(e => { if (e.style && e.style.transform) e.style.transform = '' })
      const R = e => rectIn(e, root)
      const inCard = (cardEl, e) => { const a = R(cardEl), b = R(e); return { x: b.x - a.x, y: b.y - a.y, w: b.w, h: b.h } }
      const putMark = (m, r, pad = 8) => place(m, r.x - pad, r.y - pad, { w: r.w + 2 * pad, h: r.h + 2 * pad })
      // L0 markers
      putMark(this.mkV0, inkBox(document.getElementById(`${ID}-v0`), this.card0), 10)
      putMark(this.mkRec, inkBox(document.getElementById(`${ID}-rec`), this.card0), 10)
      // card → rail chip
      const c0 = R(this.card0), g0 = R(this.rGiven)
      this.fly0 = { dx: g0.cx - c0.cx, dy: g0.cy - c0.cy, s: g0.w / c0.w }
      const c3 = R(this.card3), g3 = R(this.rTwo)
      this.fly3 = { dx: g3.cx - c3.cx, dy: g3.cy - c3.cy, s: g3.w / c3.w }
      // L1
      const ra = R(this.rowA)
      place(this.ckA, ra.x - 76, ra.cy, { anchor: 'cl' })
      const rn = inkBox(document.getElementById(`${ID}-num`), root), rd = inkBox(document.getElementById(`${ID}-den`), root)
      place(this.pNum, rn.cx + 150, rn.y - 54, { anchor: 'c' })
      place(this.pDen, rd.cx + 150, rd.y + rd.h + 54, { anchor: 'c' })
      this.pNumR = R(this.pNum); this.pDenR = R(this.pDen)
      place(this.tNum, this.pNumR.x + this.pNumR.w + 18, this.pNumR.cy, { anchor: 'cl' })
      place(this.tDen, this.pDenR.x + this.pDenR.w + 18, this.pDenR.cy, { anchor: 'cl' })
      // little connectors from the pills to their parts
      if (!this.conn) {
        this.conn = svg(root, 0, 0, W, H)
        this.cN = sv(this.conn, 'path', { d: '', fill: 'none', stroke: G, 'stroke-width': 3, 'stroke-dasharray': '6 6' })
        this.cD = sv(this.conn, 'path', { d: '', fill: 'none', stroke: G, 'stroke-width': 3, 'stroke-dasharray': '6 6' })
      }
      this.cN.setAttribute('d', `M${this.pNumR.x - 4},${this.pNumR.cy} Q${rn.cx},${this.pNumR.cy} ${rn.cx},${rn.y - 8}`)
      this.cD.setAttribute('d', `M${this.pDenR.x - 4},${this.pDenR.cy} Q${rd.cx},${this.pDenR.cy} ${rd.cx},${rd.y + rd.h + 8}`)
      // L3 markers
      putMark(this.mkU, inkBox(document.getElementById(`${ID}-udef`), this.card3), 10)
      putMark(this.mkNew, inkBox(document.getElementById(`${ID}-un`), this.card3), 8)
      { const un = inkBox(document.getElementById(`${ID}-un`), root); place(this.newTag, un.cx, c3.y + c3.h + 6, { anchor: 'tc' }) }
      const ua = inCard(this.card3, this.arSpan)
      place(this.ulAr, ua.x - 4, ua.y + ua.h + 2, { w: ua.w + 8 })
      // L4 captions, flip arc, strikes
      const a2 = R(this.ch.a2), a3 = R(this.ch.a3), b1 = R(this.ch.b1), vv = R(this.ch.vv), inr = R(this.ch.inner)
      const top = Math.min(a2.y, a3.y)
      const fx1 = inr.cx, fx2 = a3.cx + 20
      this.flipArc.setAttribute('d', `M${fx1},${top - 8} Q${(fx1 + fx2) / 2},${top - 92} ${fx2},${top - 12}`); this.flipArc._len = 0
      this.flipHead.setAttribute('d', `M${fx2 + 4},${top - 4} L${fx2 - 16},${top - 16} L${fx2 - 2},${top - 30} Z`)
      place(this.capFlip, (fx1 + fx2) / 2, top - 70, { anchor: 'bc' })
      place(this.capSplit, b1.cx, b1.y + b1.h + 14, { anchor: 'tc' })
      const setStrike = (s, cx, cy, len, ang) => { const a = ang * Math.PI / 180; place(s, cx - len / 2 * Math.cos(a), cy - len / 2 * Math.sin(a), { w: len }); s.style.rotate = ang + 'deg'; s.style.translate = '0 -50%' }
      setStrike(this.strikes[0], vv.cx, vv.y + vv.h * .28, vv.w + 10, -28)
      setStrike(this.strikes[1], vv.cx, vv.y + vv.h * .74, vv.w + 10, -28)
      const iv = R(this.ch.inv)
      place(this.uTag, iv.cx, iv.y + iv.h + 6, { anchor: 'tc' })
    },

    contact(phi) {
      const { DW, DH, SP } = this, r = Math.PI / 180
      const px = SP + DW, c = Math.cos(phi * r), s = Math.sin(phi * r)
      const P0 = [px - DW * c, DW * s]
      const d = [s, c]
      const side = th => { const x = DW + DH * Math.sin(th * r) - P0[0], y = DH * Math.cos(th * r) - P0[1]; return x * d[1] - y * d[0] }
      let lo = 0, hi = 89
      if (side(hi) < 0) return 89
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (side(m) < 0) lo = m; else hi = m }
      return lo
    },

    render(lt, S) {
      if (this._sig !== this._sigNow()) this._layout()
      const F = (i, f) => S.at(i) + f * (S.end(i) - S.at(i))
      this.head.set(S.p(lt, 0, 0, .8))

      // ================= rail =================
      const gIn = S.p(lt, 1, .35, .5), oneIn = S.p(lt, 2, 0, .5), twoIn = S.p(lt, 4, .3, .5)
      pop(this.rGiven, gIn); pop(this.rOne, oneIn); pop(this.rTwo, twoIn)

      // ================= L0 =================
      const out0 = S.p(lt, 1, 0, .75)
      const cIn = S.p(lt, 0, .15, .7)
      op(this.card0, Math.min(cIn, 1 - clamp(out0 * 1.25 - .2)))
      const f0 = this.fly0
      this.card0.style.transform = `translate(${f0.dx * out0}px, ${f0.dy * out0 + (1 - cIn) * 36}px) scale(${lerp(1, f0.s, out0)})`
      // the statement is typed in step with the narration: «(v_n) … وفق» (متتاليةٌ) → «v_0 = 1» (حدُّها الأوّل في صفر
      // يساوي واحداً, .30–.44) → «و» → «v_{n+1} = …» (وكلّ حدٍّ يساوي سابقه…, .50–.78)
      const fl0 = S.f(lt, 0)
      const pw = [[0, 0], [.02, 0], [.17, .5], [.3, .5], [.37, .6], [.45, .6], [.49, .7], [.56, .8]]
      let pst = 1
      for (let k = 1; k < pw.length; k++) if (fl0 < pw[k][0]) { const [a, va] = pw[k - 1], [b, vb] = pw[k]; pst = lerp(va, vb, (fl0 - a) / (b - a)); break }
      typeWords(this.st, lt < S.at(0) ? 0 : pst)
      // «نرمز لحدودها بالحرف في» (.15–.30): the letter v glows
      const vg = env(lt, F(0, .16), F(0, .36), .3, .5)
      this.vl.style.color = vg > 0 ? mixColor(C.ink, Y, vg) : ''
      this.vl.style.textShadow = vg > 0 ? `0 0 ${20 * vg}px rgba(255,210,63,.85)` : ''
      this.vl.style.transform = `scale(${1 + .25 * vg})`
      const it1p = prog(lt, F(0, .78), .5)                 // «أوّلاً، تحقّق أنّ حدودها موجبةٌ تماماً»
      op(this.it1, it1p > 0 ? 1 : 0); typeWords(this.it1, S.f(lt, 0, .78, .97))
      const mk = (m, p) => { op(m, clamp(p * 2.5)); m.style.transform = `scaleX(${E.out(clamp(p))})` }
      mk(this.mkV0, Math.min(prog(lt, F(0, .31), .5), 1 - prog(lt, F(0, .48), .4)))
      mk(this.mkRec, Math.min(prog(lt, F(0, .53), .5), 1 - prog(lt, F(0, .78), .4)))
      {
        const hs = S.end(0), he = Math.max(hs + .5, S.at(1) - .25)
        op(this.cdw, Math.min(prog(lt, Math.max(F(0, .9), S.end(0) - .8), .5), 1 - S.p(lt, 1, 0, .4)))
        const q = clamp((lt - hs) / (he - hs))
        this.cd(Math.max(.001, q), 5 * (1 - q))
      }

      // ================= L1 =================
      const out1 = S.p(lt, 2, 0, .5)
      const v1 = p => p * (1 - out1)
      // «الحدّ الأوّل واحد، فهو موجبٌ تماماً» (0–.3) → «وإذا كان حدٌّ موجباً تماماً» (.33) → «فالبسط والمقام موجبان»
      // (.53–.7): «فإنّ» + the chain, numerator / denominator tagged → «فالحدّ التالي موجبٌ تماماً» (.79): «> 0»
      const pA = prog(lt, F(1, .01), .55)
      rise(this.rowA, v1(pA), 24)
      pop(this.ckA, v1(prog(lt, F(1, .15), .5)))
      rise(this.rowB, v1(prog(lt, Math.max(F(1, .31), S.at(1) + .8), .55)), 24)
      const tC = Math.max(F(1, .49), S.at(1) + 1.6)
      const thenP = prog(lt, tC, .45)
      op(this.thenB, thenP); this.thenB.style.transform = `translateX(${(1 - thenP) * -24}px)`
      const cP = prog(lt, tC + .15, 1.1)
      wipe(this.rowC, cP, 'ltr'); op(this.rowC, 1 - out1)
      if (out1 >= 1) this.rowC.style.visibility = 'hidden'
      const tP = [prog(lt, Math.max(F(1, .55), tC + .9), .5), prog(lt, Math.max(F(1, .61), tC + 1.3), .5)]
      ;[[this.pNum, this.tNum, this.cN], [this.pDen, this.tDen, this.cD]].forEach(([p, t, c], k) => {
        pop(p, v1(tP[k])); op(t, v1(tP[k])); c.style.opacity = v1(tP[k])
      })
      const gtP = prog(lt, Math.max(F(1, .82), tC + 2), .5)
      op(this.gt, gtP); this.gt.style.transform = `scale(${lerp(1.5, 1, E.out(gtP))})`
      this.gt.style.textShadow = gtP > 0 ? `0 0 ${18 * (.6 + .4 * Math.sin(lt * 2.4))}px rgba(110,224,90,.6)` : ''

      // ================= L2 =================
      const out2 = S.p(lt, 3, 0, .55)
      const v2 = p => p * (1 - out2)
      const mIn = S.p(lt, 2, .25, .7)
      const tIn = Math.max(F(2, .04), S.at(2) + .6)       // the input card drops into the funnel
      const pDrop = prog(lt, tIn, .8, E.in)
      const pOut = prog(lt, tIn + 1.1, .7, E.out)
      const work = env(lt, tIn + .7, tIn + 1.6, .2, .3)
      this.mach.set(lt, { a: v2(mIn), s: lerp(.9, 1, E.out(mIn)), work })
      {
        const x = this.MX, y0 = 286, y1 = this.MY - 98 - 30
        const a = Math.min(prog(lt, tIn - .5, .4), 1 - prog(lt, tIn + .55, .25)) * (1 - out2)
        op(this.inC, a); this.inC.style.transform = `translate(${x}px, ${lerp(y0, y1, pDrop)}px) scale(${lerp(1, .7, pDrop)})`
        const yo0 = this.MY + 98 + 6, yo1 = this.MY + 98 + 66
        op(this.outC, (pOut > 0 ? clamp(pOut * 3) : 0) * (1 - out2))
        this.outC.style.transform = `translate(${x}px, ${lerp(yo0, yo1, pOut)}px) scale(${lerp(.6, 1, pOut)})`
        this.outC.style.boxShadow = `0 0 ${24 + 10 * Math.sin(lt * 2.2)}px ${G}66`
      }
      rise(this.tip, v2(S.p(lt, 2, .5, .6)), 30)
      this.tipRows.forEach((r, k) => rise(r, v2(S.p(lt, 2, .6 + k * .22, .5)), 14))
      // dominoes: stand up, then topple left → right
      const T0 = Math.max(F(2, .14), tIn + 1.2), dt = .32, D = .55
      const free = this.doms.map((d, k) => 90 * E.in(clamp((lt - T0 - k * dt) / D)))
      const ang = new Array(6)
      for (let k = 5; k >= 0; k--) ang[k] = Math.min(free[k], this.contact(k === 5 ? 0 : ang[k + 1]))
      this.ground.style.opacity = v2(S.p(lt, 2, .4, .6))
      this.doms.forEach((d, k) => {
        const x = this.X0 + k * this.SP
        const st = prog(lt, S.at(2) + .55 + k * .09, .45)
        d.g.style.opacity = v2(st)
        d.g.setAttribute('transform', `translate(0 ${(1 - E.out(st)) * 26}) rotate(${ang[k]} ${x + this.DW} ${this.GY})`)
        const lit = clamp(ang[k] / 22)
        const c = mixColor(C.dim, G, lit)
        d.t.setAttribute('fill', c); d.r.setAttribute('stroke', k === 0 ? G : c)
        if (k === 0) d.t.setAttribute('fill', G)
        d.t.style.filter = lit > .5 || k === 0 ? `drop-shadow(0 0 6px ${G})` : ''
        d.t.setAttribute('transform', `rotate(${-ang[k]} ${d.cx} ${d.cy})`)
        rise(this.dl[k], v2(st), 10)
      })
      const gp = v2(prog(lt, S.at(2) + 1.2, .5))
      this.ghost.g.style.opacity = gp; op(this.dmore, gp)
      const l2p = prog(lt, Math.max(F(2, .6), T0 + 5 * dt + .3), .6)
      op(this.l2, v2(l2p)); this.l2.style.transform = `translateX(${(1 - E.out(l2p)) * 40}px) scale(${lerp(.92, 1, E.out(l2p))})`
      this.l2.style.boxShadow = `0 0 ${40 + 16 * Math.sin(lt * 2)}px rgba(124,58,237,.38)`

      // ================= L3 =================
      const out3 = S.p(lt, 4, 0, .75)
      const c3In = S.p(lt, 3, .25, .7)
      op(this.card3, Math.min(c3In, 1 - clamp(out3 * 1.25 - .2)))
      const f3 = this.fly3
      this.card3.style.transform = `translate(${f3.dx * out3}px, ${f3.dy * out3 + (1 - c3In) * 36}px) scale(${lerp(1, f3.s, out3)})`
      const tNew = Math.max(F(3, .07), S.at(3) + .8), tU = Math.max(F(3, .18), tNew + .9)
      mk(this.mkNew, Math.min(prog(lt, tNew, .5), 1 - prog(lt, tU, .4)))
      const ntP = Math.min(prog(lt, tNew + .15, .5), 1 - out3)
      op(this.newTag, ntP); this.newTag.style.transform = `translateY(${(1 - E.out(clamp(ntP))) * 14}px)`
      mk(this.mkU, Math.min(prog(lt, tU, .5), 1 - prog(lt, Math.max(F(3, .42), tU + 1.2), .5)))
      const ulP = prog(lt, F(3, .88), .6)
      op(this.ulAr, ulP > 0 ? 1 : 0); this.ulAr.style.transform = `scaleX(${E.out(ulP)})`
      this.arSpan.style.color = mixColor(C.ink, Y, ulP)
      const nP = prog(lt, Math.max(F(3, .42), tU + 1), .6)
      op(this.note, nP * (1 - S.p(lt, 4, 0, .45))); this.note.style.transform = `translateY(${(1 - nP) * 24}px)`
      {
        const hs = S.end(3), he = Math.max(hs + .5, S.at(4) - .25)
        op(this.cdw2, Math.min(prog(lt, F(3, .88), .5), 1 - S.p(lt, 4, 0, .4)))
        const q = clamp((lt - hs) / (he - hs))
        this.cd2(Math.max(.001, q), 5 * (1 - q))
      }

      // ================= L4 =================
      const tOut5 = Math.max(F(5, .19), S.at(5) + 1.6)
      const chOut = prog(lt, tOut5, .6)
      const pc = (t, d = .6) => prog(lt, t, d)
      // «نقلب الكسر: u_{n+1} يساوي» (0–.34) → «واحداً زائد في إنْ، على في إنْ» (.44–.66): flip → «أي مقلوبَ في إنْ» (.72): split
      // → «مضافاً إليه واحد» (.86): cancel, + 1
      const t4 = [Math.max(F(4, .02), S.at(4) + .5), Math.max(F(4, .14), S.at(4) + 1.4), Math.max(F(4, .42), S.at(4) + 2.6), Math.max(F(4, .68), S.at(4) + 4), Math.max(F(4, .85), S.at(4) + 5.4)]
      op(this.chain, (lt >= t4[0] ? 1 : 0) * (1 - chOut))
      this.chain.style.transform = `translateY(${-30 * E.io(chOut)}px)`
      const pa01 = pc(t4[0], .7)
      ;['a0', 'a1'].forEach(k => wipe(this.ch[k], pa01, 'ltr'))
      wipe(this.ch.a2, pc(t4[1], .7), 'ltr')
      // inner fraction glows (it is about to flip)
      const ig = env(lt, t4[1] + .6, t4[2] + .6, .3, .4)
      this.ch.inner.style.textShadow = ig > 0 ? `0 0 ${16 * ig}px rgba(255,210,63,.7)` : ''
      // a3 flips in (rotateX)
      const fl = pc(t4[2], .9)
      this.ch.a3.style.opacity = fl > 0 ? clamp(fl * 2) : 0
      this.ch.a3.style.transform = `perspective(600px) rotateX(${(1 - E.out(fl)) * -110}deg)`
      this.ch.a3.style.transformOrigin = '50% 50%'
      draw(this.flipArc, pc(t4[2] - .15, .6)); this.flipHead.style.opacity = (pc(t4[2] - .15, .6) > .95 ? 1 : 0) * (1 - chOut)
      this.flipArc.style.opacity = 1 - chOut
      op(this.capFlip, pc(t4[2] - .1, .5) * (1 - chOut))
      // split
      const sp = pc(t4[3], .7)
      wipe(this.ch.b1, sp, 'ltr')
      op(this.capSplit, Math.min(pc(t4[3] + .2, .5), 1 - pc(t4[4] + 1.2, .5)) * (1 - chOut))
      this.strikes.forEach((s, k) => { const p = pc(t4[4] + k * .2, .35); op(s, (p > 0 ? 1 : 0) * (1 - chOut)); s.style.transform = `scaleX(${p})` })
      wipe(this.ch.b2, pc(t4[4] + .55, .7), 'ltr')

      // ================= L5 =================
      const uP = S.p(lt, 5, .15, .5)
      op(this.uTag, uP * (1 - chOut)); this.uTag.style.transform = `translateY(${(1 - E.out(uP)) * 16}px)`
      this.ch.inv.style.color = uP > 0 ? mixColor(C.ink, Y, uP) : ''
      const kbP = prog(lt, tOut5 + .35, .7)
      this.kb.set(kbP)
      this.kb.el.style.boxShadow = `0 0 ${40 + 18 * Math.sin(lt * 2)}px rgba(110,224,90,${.25 * clamp(kbP)})`
      // «مضافاً إليه واحد» (.35) → «حسابيّة أساسها واحد» (.49) → «وحدُّها الأوّل يو صفر يساوي واحداً» (.68)
      const dP = prog(lt, Math.max(F(5, .34), tOut5 + 1), .6)
      rise(this.diff, dP, 20)
      rise(this.ar5, prog(lt, Math.max(F(5, .48), tOut5 + 1.6), .6), 20)
      rise(this.u05, prog(lt, Math.max(F(5, .67), tOut5 + 2.2), .6), 20)
      // number line
      const tN = Math.min(Math.max(F(5, .74), tOut5 + 2.6), S.dur - 3.2)
      const axP = prog(lt, tN, .7)
      draw(this.axis, axP); this.axHead.style.opacity = axP > .95 ? 1 : 0
      this.ticks.forEach(({ t, l }, v) => { const p = prog(lt, tN + .1 + v * .06, .4); t.style.opacity = p; op(l, p) })
      this.pts.forEach(({ c, l }, k) => {
        const p = prog(lt, tN + .45 + k * .48, .4, E.back)
        c.style.opacity = clamp(p * 3); c.style.transform = `scale(${Math.max(0, p)})`
        op(l, clamp(p * 2))
      })
      this.hops.forEach(({ p, h, l }, k) => {
        const q = prog(lt, tN + .55 + k * .48, .45)
        draw(p, q); h.style.opacity = q > .95 ? 1 : 0; op(l, q)
      })
      op(this.nmore, prog(lt, tN + 2, .5))
      // file the result in the rail: ❷ grows to «u_0 = 1 ، r = 1»
      const gx = E.io(prog(lt, Math.min(Math.max(F(5, .92), tN + 2.4), S.dur - 1.4), .7))
      this.r2x.style.maxWidth = (this.r2x.scrollWidth * gx) + 'px'; this.r2x.style.opacity = gx   // scrollWidth = full width (fonts settled)
    },
  })
})()

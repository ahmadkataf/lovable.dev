// s26 · الدرس القادم — the two open questions come back from the corner pins.
// L0: card ① is closed with the lesson's own tool: chips r = 2, a = 1, ℓ = 2n − 1, then S = n(a+ℓ)/2 = … = n² ✓.
// L1: card ② keeps its yellow «؟» and gets a pink chip «لا قانون جاهز».
// L2: the step n → n+1 for both: n×n purple square + yellow L of 2n+1 dots = (n+1)²; units-digit loop …7 → …9 → …7.
// L3: an endless row of dominoes topples into the lesson-2 title; ②'s «؟» → grey ✓ «قريباً»; ① gets «برهانٌ ثانٍ بالتدريج — الدرس 2».
// L4: outro card (solutions video, try first), end card, fade to navy.
(() => {
  const ID = 's26'
  const Y = C.yel, P = C.pur, G = C.grn, B = C.blu, R = C.red
  const col = (c, s) => `\\textcolor{${c}}{${s}}`
  const kt = s => `<bdi class="m">${katex.renderToString(s, KOPT)}</bdi>`
  const PIN = { x: 120, y: 174 }, PS = .5          // pinned corner cards (as in s01–s08)
  const CY = 300, CW = 800, X1 = 1000, X2 = 120     // card ① (right, read first), card ② (left)
  const M1 = X1 + CW / 2, M2 = X2 + CW / 2          // their centres: 1400, 520

  // The script has 5 lines. An older 4-line timeline merged lines 0 and 1: split that line so the scene still plays.
  function timing(S) {
    if (S.lines.length >= 5) return S
    const a0 = S.at(0), e0 = S.end(0), m = a0 + .62 * (e0 - a0)
    const at = i => (i === 0 ? a0 : i === 1 ? m : S.at(i - 1))
    const end = i => (i === 0 ? m - .2 : i === 1 ? e0 : S.end(i - 1))
    return {
      dur: S.dur, lines: S.lines, at, end,
      p: (lt, i, d = 0, du = .6, ease = E.io) => prog(lt, at(i) + d, du, ease),
      f: (lt, i, a = 0, b = 1) => clamp(((lt - at(i)) / Math.max(.01, end(i) - at(i)) - a) / (b - a)),
    }
  }
  // status sticker (sits on a card's bottom edge once docked)
  const sticker = (root, html, c, fs = 26) => {
    const e = el('div', '', html, root)
    e.style.cssText = `position:absolute;display:flex;align-items:center;gap:10px;padding:6px 22px;border-radius:999px;border:2.5px solid ${c};background:rgba(16,22,46,.97);color:${c};font-size:${fs}px;font-weight:800;white-space:nowrap;direction:rtl;box-shadow:0 0 22px ${c}44;z-index:4`
    op(e, 0)
    return e
  }
  const badge = (parent, txt, bg) => {
    const b = el('div', '', txt, parent)
    b.style.cssText = `position:absolute;left:28px;top:-32px;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:900;color:#0b1020;background:${bg};box-shadow:0 0 26px ${bg}99;z-index:2`
    return b
  }

  scene(ID, {
    build(root, S) {
      this.root = root
      this.T = timing(S)
      root.style.isolation = 'isolate'
      const $ = k => document.getElementById(`${ID}-${k}`)
      this.head = heading(root, 'سؤالان مفتوحان')
      this.head2 = heading(root, 'إلى اللقاء')

      // ================= the two open-question cards =================
      const mkCard = (x, tag, l1, l2) => {
        const c = card(root, 'def', x, CY, CW, { tag })
        c.el.style.padding = '46px 46px 32px'
        c.el.style.transformOrigin = '0 0'
        const f = tex(l1, 'mx'); f.style.cssText += 'font-size:50px;display:block;text-align:center'; c.body.appendChild(f)
        const t = rich(l2, 'h3'); t.style.cssText += 'text-align:center;margin-top:8px;white-space:nowrap;font-size:40px'; c.body.appendChild(t)
        const bq = badge(c.el, '؟', Y)                     // open: yellow «؟»
        const pin = el('div', '', '📌', root)
        pin.style.cssText += 'font-size:40px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))'
        return { el: c.el, x, bq, pin }
      }
      this.c1 = mkCard(X1, '🤔 سؤال مفتوح ①', `1+3+5+\\cdots+(2n-1) = \\htmlId{${ID}-n2}{n^2}`, `مهما يكن $n \\ge 1$ <span id="${ID}-q1" style="display:inline-block">؟</span>`)
      this.c2 = mkCard(X2, '🔒 سؤال مفتوح ②', 'u_0 = 3,\\quad u_{n+1} = u_n^2-2', `آحاد $u_n$ تساوي <b id="${ID}-seven" style="display:inline-block;color:${Y}">7</b> مهما يكن $n\\ge1$ ؟`)
      this.n2q = $('n2'); this.n2q.style.display = 'inline-block'
      this.q1 = $('q1'); this.seven = $('seven')
      this.ok1 = badge(this.c1.el, '✓', G); op(this.ok1, 0)  // ① closed: green ✓
      // ② later: grey ✓ outline «قريباً»
      {
        const c = this.c2
        c.ck = svg(c.el, 28, -32, 64, 64); c.ck.style.zIndex = 3
        c.ring = sv(c.ck, 'circle', { cx: 32, cy: 32, r: 29, fill: 'rgba(20,29,56,.97)', stroke: C.mut, 'stroke-width': 3, 'stroke-dasharray': '5 5' })
        c.tick = sv(c.ck, 'path', { d: 'M18,33 L28,43 L46,22', fill: 'none', stroke: C.mut, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
        c.soon = el('div', '', 'قريباً', c.el)
        c.soon.style.cssText = `position:absolute;left:104px;top:-20px;padding:4px 16px;border-radius:999px;font-size:24px;font-weight:800;color:${C.ink};background:#2e3657;border:1.5px solid ${C.mut};white-space:nowrap`
      }

      // ================= L0: card ① closed by the arithmetic-sum law =================
      this.row0 = el('div', '', null, root)
      place(this.row0, M1, 588, { anchor: 'c' })
      this.row0.style.cssText += 'display:flex;align-items:center;gap:18px;direction:rtl;white-space:nowrap'
      this.cap0 = rich('الأعداد الفرديّة حسابيّة:', 's'); this.cap0.style.cssText += `font-size:30px;font-weight:700;color:${C.mut}`
      this.row0.appendChild(this.cap0)
      const bchip = l => { const e = el('div', 'chip', kt(l), this.row0); e.style.cssText += `border-color:${B}88;background:${B}1f;color:${B};font-size:34px;padding:4px 22px`; return e }
      this.chR = bchip('r = 2'); this.chA = bchip('a = 1'); this.chL = bchip('\\ell = 2n-1')
      this.der = tex(`\\htmlId{${ID}-d1}{S = \\dfrac{n(\\htmlId{${ID}-da}{a}+\\htmlId{${ID}-dl}{\\ell})}{2}} \\htmlId{${ID}-d2}{{}= \\dfrac{n\\big(${col(B, '1')}+${col(B, '(2n-1)')}\\big)}{2}} \\htmlId{${ID}-d3}{{}= ${col(G, 'n^2')}}`, 'mx')
      root.appendChild(this.der); this.der.style.fontSize = '50px'; place(this.der, M1, 714, { anchor: 'c' })
      this.d = {}
      for (const k of ['d1', 'd2', 'd3', 'da', 'dl']) { this.d[k] = $(k); this.d[k].style.display = 'inline-block' }
      this.okS = sticker(root, '✓ بقانون المجموع الحسابي', G, 28)
      // ================= L1: card ② — no ready-made law =================
      this.noS = sticker(root, 'لا قانون جاهز', R, 28)
      // ================= L3: card ① gets its lesson-2 tag =================
      this.l2S = sticker(root, 'برهانٌ ثانٍ بالتدريج — الدرس 2', P, 25)

      // ================= L2, under card ①: n×n square + yellow L = (n+1)×(n+1) =================
      const ds = svg(root, 0, 0, W, H); ds.style.direction = 'ltr'
      const SPD = 44, OX = M1 - 2 * SPD, OY = 824
      this.SPD = SPD; this.OX = OX; this.OY = OY
      this.dots = []
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        const L = i === 4 || j === 4
        const cx = OX + i * SPD, cy = OY - j * SPD
        const c = sv(ds, 'circle', { cx, cy, r: 14, fill: L ? Y : P })
        c.style.transformOrigin = `${cx}px ${cy}px`
        this.dots.push({ c, L, k: L ? (i === 4 ? 4 - j : 4 + (4 - i)) : i + j })
      }
      this.sqOut = sv(ds, 'rect', { x: 0, y: 0, width: 0, height: 0, rx: 16, fill: 'none', stroke: C.ink, 'stroke-width': 3, 'stroke-dasharray': '12 10' })
      this.brace = sv(ds, 'path', { d: '', fill: 'none', stroke: B, 'stroke-width': 3, 'stroke-linecap': 'round' })
      const lab = (latex, c, fs) => { const e = tex(col(c, latex), 'mm'); e.style.fontSize = fs + 'px'; root.appendChild(e); return e }
      this.n2 = lab('n^2', P, 40); place(this.n2, OX - 38, OY - 1.5 * SPD, { anchor: 'cr' })
      this.lL = lab('2n+1', Y, 36); place(this.lL, OX + 4 * SPD + 40, OY - 2 * SPD, { anchor: 'cl' })
      this.lN = lab('n', B, 36); place(this.lN, OX + 1.5 * SPD, OY + 50, { anchor: 'c' })
      this.lN1 = lab('n+1', B, 36); place(this.lN1, OX + 2 * SPD, OY + 50, { anchor: 'c' })
      this.f1 = tex(`${col(P, 'n^2')} + ${col(Y, '(2n+1)')} = (n+1)^2`, 'mx'); root.appendChild(this.f1)
      place(this.f1, M1, 934, { anchor: 'c' }); this.f1.style.fontSize = '52px'
      const stepChip = x => { const e = chip(root, `خطوة &nbsp;${kt('n \\to n+1')}`, x, 572, { anchor: 'c', color: B }); e.style.cssText += 'font-size:28px;padding:6px 22px;direction:rtl'; return e }
      this.st1 = stepChip(M1)

      // ================= L2, under card ②: units-digit loop …7 → …9 → …7 =================
      const A = [M2 - 130, 758], Bn = [M2 + 130, 758], RR = 50
      this.A = A; this.Bn = Bn
      const node = (p, c) => {
        const g = sv(ds, 'g')
        sv(g, 'circle', { cx: p[0], cy: p[1], r: RR + 10, fill: c, opacity: .12 })
        sv(g, 'circle', { cx: p[0], cy: p[1], r: RR, fill: '#121a3a', stroke: c, 'stroke-width': 4 })
        g.style.transformOrigin = `${p[0]}px ${p[1]}px`
        return g
      }
      this.arcT = sv(ds, 'path', { d: `M${A[0] + 40},${A[1] - 34} Q${(A[0] + Bn[0]) / 2},${A[1] - 146} ${Bn[0] - 40},${Bn[1] - 34}`, fill: 'none', stroke: Y, 'stroke-width': 5, 'stroke-linecap': 'round' })
      this.arcB = sv(ds, 'path', { d: `M${Bn[0] - 40},${Bn[1] + 34} Q${(A[0] + Bn[0]) / 2},${A[1] + 146} ${A[0] + 40},${A[1] + 34}`, fill: 'none', stroke: B, 'stroke-width': 5, 'stroke-linecap': 'round' })
      this.hT = sv(ds, 'path', { d: 'M8,0 L-12,-10 L-12,10 Z', fill: Y }); this.hB = sv(ds, 'path', { d: 'M8,0 L-12,-10 L-12,10 Z', fill: B })
      this.nA = node(A, Y); this.nB = node(Bn, B)
      this.runner = sv(ds, 'circle', { cx: 0, cy: 0, r: 10, fill: '#fff' })
      this.runner.style.filter = `drop-shadow(0 0 10px ${Y})`
      const nl = (latex, p, c) => { const e = tex(latex, 'mm'); e.style.cssText += `font-size:44px;color:${c}`; root.appendChild(e); place(e, p[0], p[1], { anchor: 'c' }); return e }
      this.lA = nl('\\ldots 7', A, Y); this.lB = nl('\\ldots 9', Bn, B)
      this.labT = rich(`<b style="color:${Y}">تربيع</b>&nbsp; $7^2 = 4${col(Y, '9')}$`, 's'); root.appendChild(this.labT); this.labT.style.cssText += 'font-size:30px;white-space:nowrap'
      place(this.labT, (A[0] + Bn[0]) / 2, A[1] - 98, { anchor: 'bc' })
      this.labB = tex(col(B, '-2'), 'mm'); root.appendChild(this.labB); this.labB.style.fontSize = '38px'
      place(this.labB, (A[0] + Bn[0]) / 2, A[1] + 100, { anchor: 'tc' })
      this.cap2 = rich(`إذا انتهى $u_n$ بـ <b class="yel">7</b> انتهى $u_{n+1}$ بـ <b class="yel">7</b>`, 'p'); root.appendChild(this.cap2)
      place(this.cap2, M2, 944, { anchor: 'c' }); this.cap2.style.cssText += 'white-space:nowrap;font-size:36px;line-height:1.4'
      this.st2 = stepChip(M2)

      // ================= L3: endless dominoes → lesson 2 =================
      const dw = el('div', '', null, root); place(dw, 0, 0, { w: W, h: H })
      dw.style.cssText += '-webkit-mask-image:linear-gradient(90deg,transparent 0px,#000 220px,#000 1700px,transparent 1860px);mask-image:linear-gradient(90deg,transparent 0px,#000 220px,#000 1700px,transparent 1860px)'
      const dsv = svg(dw, 0, 0, W, H); dsv.style.direction = 'ltr'
      this.GY = 790; this.DW = 34; this.DH = 140; this.SP = 104; this.X0 = 60; this.ND = 18
      this.ground = sv(dsv, 'path', { d: `M60,${this.GY + 2} L1880,${this.GY + 2}`, stroke: 'rgba(154,168,201,.3)', 'stroke-width': 3 })
      this.doms = Array.from({ length: this.ND }, (_, k) => {
        const x = this.X0 + k * this.SP
        const g = sv(dsv, 'g')
        const r = sv(g, 'rect', { x, y: this.GY - this.DH, width: this.DW, height: this.DH, rx: 8, fill: '#1d1850', stroke: P, 'stroke-width': 3 })
        sv(g, 'circle', { cx: x + this.DW / 2, cy: this.GY - this.DH * .74, r: 5, fill: P, opacity: .8 })
        sv(g, 'circle', { cx: x + this.DW / 2, cy: this.GY - this.DH * .28, r: 5, fill: P, opacity: .8 })
        return { g, r, x }
      })
      this.l2 = el('div', '', null, root)
      place(this.l2, 960, 916, { anchor: 'c' })
      this.l2.style.cssText += 'display:flex;align-items:center;gap:22px;direction:rtl;white-space:nowrap'
      const b2 = el('div', '', '2', this.l2)
      b2.style.cssText = `width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:50px;font-weight:900;color:#0b1020;background:${P};box-shadow:0 0 40px ${P}aa`
      const l2t = el('div', '', 'البرهان بالتدريج <span style="color:#9aa8c9;font-weight:700">أو</span> بالاستقراء الرياضي', this.l2)
      l2t.style.cssText = `font-size:58px;font-weight:900;color:${P};text-shadow:0 0 30px rgba(167,139,250,.35)`
      this.l2tag = el('div', '', 'الدرس القادم', root)
      this.l2tag.style.cssText = `position:absolute;padding:4px 18px;border-radius:999px;font-size:24px;font-weight:800;color:#0b1020;background:${P};white-space:nowrap`
      place(this.l2tag, 960, 840, { anchor: 'c' })

      // ================= L4: outro =================
      this.out = el('div', '', null, root)
      place(this.out, 960, 300, { anchor: 'tc', w: 1500 })
      this.out.style.cssText += `padding:48px 60px 44px;border-radius:32px;border:2.5px solid ${P}99;background:linear-gradient(180deg,rgba(40,32,96,.92),rgba(20,29,56,.94));box-shadow:0 30px 90px rgba(0,0,0,.45),0 0 60px rgba(124,58,237,.25);direction:rtl;text-align:right`
      this.o1 = rich(`<span class="pur b">الفيديو التالي:</span> حلّ جميع تمارين <span class="yel b">«تدرَّبْ»</span> (ص 11) خطوةً خطوة`, 'h3')
      this.o1.style.cssText += 'font-size:46px;white-space:nowrap'
      this.out.appendChild(this.o1); splitWords(this.o1)
      const sep = el('div', '', null, this.out); sep.style.cssText = 'height:2px;margin:30px 0 26px;background:linear-gradient(270deg,rgba(167,139,250,.5),rgba(167,139,250,0))'
      this.sep = sep
      const row = el('div', '', null, this.out)
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:40px;direction:rtl'
      this.o2 = rich(`<span class="grn b">جرّب أوّلاً:</span> ②-2 … ②-8 <span class="mute">و</span> ④`, 'h3')
      this.o2.style.cssText += 'font-size:50px;white-space:nowrap'
      row.appendChild(this.o2)
      this.o3 = rich('بنفسك على المنصّة، ثمّ قارن بالحلّ', 's'); this.o3.style.cssText += 'font-size:32px;white-space:nowrap'
      this.o2.appendChild(this.o3)
      // pencil-and-paper icon (drawn on)
      const icW = 210, icH = 170
      const ic = el('div', '', null, row); ic.style.cssText = `position:relative;width:${icW}px;height:${icH}px;flex:none`
      const is = svg(ic, 0, 0, icW, icH)
      this.icPaper = sv(is, 'path', { d: 'M30,14 L130,14 L156,40 L156,156 L30,156 Z', fill: 'rgba(238,242,255,.06)', stroke: C.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' })
      this.icFold = sv(is, 'path', { d: 'M130,14 L130,40 L156,40', fill: 'none', stroke: C.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' })
      this.icLines = [52, 76, 100, 124].map((y, k) => sv(is, 'path', { d: `M48,${y} L${k === 3 ? 100 : 138},${y}`, fill: 'none', stroke: k === 3 ? Y : C.mut, 'stroke-width': 4, 'stroke-linecap': 'round' }))
      this.pen = sv(is, 'g')
      sv(this.pen, 'path', { d: 'M0,0 L-14,-6 L-62,-54 L-50,-66 L-2,-18 Z', fill: Y, stroke: '#b8860b', 'stroke-width': 2, 'stroke-linejoin': 'round' })
      sv(this.pen, 'path', { d: 'M0,0 L-14,-6 L-6,-14 Z', fill: '#2a2a2a' })
      sv(this.pen, 'path', { d: 'M-62,-54 L-50,-66 L-56,-72 L-68,-60 Z', fill: C.red })
      this.end = el('div', '', null, root)
      place(this.end, 960, 846, { anchor: 'c' })
      this.end.style.cssText += `display:flex;align-items:center;gap:16px;direction:rtl;padding:14px 34px 14px 20px;border-radius:999px;border:2.5px solid ${P};background:rgba(124,58,237,.18);box-shadow:0 0 40px rgba(124,58,237,.3);white-space:nowrap`
      const eb = el('div', '', '2', this.end); eb.style.cssText = `width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;color:#0b1020;background:${P}`
      const et = el('div', '', `<span style="color:${C.mut}">الدرس التالي:</span> <span style="color:${P}">البرهان بالتدريج</span>`, this.end); et.style.cssText = 'font-size:40px;font-weight:900'

      this._layout()
    },

    _sigNow() { return [this.c1.el, this.c2.el, this.okS, this.noS, this.l2S, this.out, this.l2, this.der].map(e => e.offsetWidth + 'x' + e.offsetHeight).join('|') },
    _layout() {
      // both cards get the same height
      this.c1.el.style.minHeight = this.c2.el.style.minHeight = ''
      const h = Math.max(this.c1.el.offsetHeight, this.c2.el.offsetHeight)
      this.c1.el.style.minHeight = this.c2.el.style.minHeight = h + 'px'
      this.h = h
      // pinned (start) positions, like the corner cards of s01–s08
      this.pin1 = { dx: PIN.x - X1, dy: PIN.y - CY }
      this.pin2 = { dx: PIN.x - X2, dy: PIN.y + h * PS + 26 - CY }
      place(this.c1.pin, PIN.x + 12, PIN.y + 2, { anchor: 'c' })
      place(this.c2.pin, PIN.x + 12, PIN.y + h * PS + 28, { anchor: 'c' })
      // stickers: free position (where they are first said) → docked on the card's bottom edge
      const yB = CY + h
      const dock = (e, fx, fy, x, y) => { place(e, x, y, { anchor: 'c' }); return { dx: fx - x, dy: fy - y } }
      this.okD = dock(this.okS, M1, 838, X1 + CW - 40 - this.okS.offsetWidth / 2, yB)
      this.noD = dock(this.noS, M2, 588, X2 + CW - 40 - this.noS.offsetWidth / 2, yB)
      place(this.l2S, M1, yB + 62, { anchor: 'c' })      // hangs under card ① (its bottom edge carries the green sticker)
      this._sig = this._sigNow()
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
      const T = this.T
      const F = (i, f) => T.at(i) + f * (T.end(i) - T.at(i))
      const out4 = T.p(lt, 4, 0, .6)                       // the outro clears the board
      const fadeAll = prog(lt, S.dur - 1.5, 1.2, E.io)      // last scene: fade to navy ourselves
      this.head.set(Math.min(T.p(lt, 0, 0, .8), 1 - out4))
      this.head2.set(T.p(lt, 4, .65, .8))
      this.head2.el.style.opacity = 1 - fadeAll

      // ================= cards: pinned → centre; focus ① (L0), ② (L1), both (L2+) =================
      const tA1 = T.at(0) + .35, tA2 = tA1 + .45
      const f0 = prog(lt, Math.max(F(0, .15), tA2 + 1.1), .6), f1 = T.p(lt, 1, 0, .6), f2 = T.p(lt, 2, 0, .6)
      const dim1 = lerp(1, .55, f1 * (1 - f2)), dim2 = lerp(1, .55, f0 * (1 - f1))
      const cardT = (c, pin, t, k, dim) => {
        const appear = prog(lt, t - .55, .4)
        const go = prog(lt, t, 1, E.io)
        c.el.style.transform = `translate(${pin.dx * (1 - go)}px, ${pin.dy * (1 - go)}px) scale(${lerp(PS, 1, go)})`
        op(c.el, Math.min(appear, 1 - out4) * dim)
        c.el.style.boxShadow = go >= 1 ? `0 30px 80px rgba(0,0,0,.35),0 0 ${30 + 14 * Math.sin(lt * 1.8 + k * 2)}px rgba(167,139,250,${.24 * dim})` : ''
        const pp = prog(lt, t - .2, .45)
        op(c.pin, Math.min(appear, 1 - pp))
        c.pin.style.transform = `translateY(${-30 * E.in(pp)}px) rotate(${-25 * pp}deg)`
      }
      cardT(this.c1, this.pin1, tA1, 0, dim1); cardT(this.c2, this.pin2, tA2, 1, dim2)

      // ================= L0: r, a, ℓ → S = n(a+ℓ)/2 = n² =================
      const tTool = Math.max(F(0, .28), tA2 + 1.3)
      const tR = Math.max(F(0, .5), tTool + 1), tA = Math.max(F(0, .6), tR + .5), tL = Math.max(F(0, .7), tA + .5)
      const tSub = Math.max(F(0, .8), tL + .8), tRes = Math.max(F(0, .9), tSub + .9), tOk = tRes + .5
      const out0 = T.p(lt, 2, 0, .6)                      // the derivation leaves when the step begins
      const dimD = lerp(1, .45, f1)                        // and steps back while ② is discussed
      op(this.row0, (1 - out0) * dimD); op(this.der, (1 - out0) * dimD)
      rise(this.cap0, prog(lt, tR - .15, .5), 12)
      pop(this.chR, prog(lt, tR, .5)); pop(this.chA, prog(lt, tA, .5)); pop(this.chL, prog(lt, tL, .5))
      wipe(this.d.d1, prog(lt, tTool, .8), 'ltr')
      this.d.da.style.color = mixColor(C.ink, B, prog(lt, tA + .1, .4))
      this.d.dl.style.color = mixColor(C.ink, B, prog(lt, tL + .1, .4))
      wipe(this.d.d2, prog(lt, tSub, .8), 'ltr')
      const pRes = prog(lt, tRes, .5)
      op(this.d.d3, clamp(pRes * 2.5)); this.d.d3.style.transform = `scale(${pRes <= 0 ? .6 : lerp(.6, 1, E.back(pRes))})`
      this.d.d3.style.textShadow = pRes > 0 ? `0 0 ${14 + 8 * Math.sin(lt * 2.4)}px rgba(110,224,90,.55)` : ''
      // card ① closes: «؟» → green ✓, n² turns green
      const cl = prog(lt, tOk, .6)
      op(this.c1.bq, Math.min(1 - cl, 1)); this.c1.bq.style.transform = `scale(${lerp(1, .4, E.in(cl))}) rotate(${-90 * cl}deg)`
      if (cl <= 0) this.c1.bq.style.boxShadow = `0 0 ${20 + 14 * Math.sin(lt * 2.4)}px ${Y}99`
      pop(this.ok1, prog(lt, tOk + .25, .5))
      this.ok1.style.boxShadow = `0 0 ${20 + 12 * Math.sin(lt * 2)}px ${G}99`
      op(this.q1, 1 - cl)
      this.n2q.style.color = mixColor(Y, G, cl)
      // green sticker: under the derivation, then docked on card ①'s bottom edge
      const okIn = prog(lt, tOk, .5), dk1 = E.io(T.p(lt, 2, 0, .7))
      op(this.okS, Math.min(clamp(okIn * 2.5), 1 - out4) * lerp(dimD, 1, dk1))
      this.okS.style.transform = `translate(${this.okD.dx * (1 - dk1)}px, ${this.okD.dy * (1 - dk1)}px) scale(${(okIn <= 0 ? .6 : lerp(.6, 1, E.back(okIn))) * lerp(1.15, 1, dk1)})`

      // ================= L1: card ② keeps its «؟» — no ready-made law =================
      const g7 = Math.sin(clamp((lt - Math.max(F(1, .2), T.at(1) + .4)) / 1.6) * Math.PI)
      this.seven.style.textShadow = g7 > 0 ? `0 0 ${22 * g7}px rgba(255,210,63,.9)` : ''
      this.seven.style.transform = `scale(${1 + .3 * Math.max(0, g7)})`
      const tNo = Math.max(F(1, .68), T.at(1) + 1.2)
      const noIn = prog(lt, tNo, .5), dk2 = E.io(T.p(lt, 2, .1, .7))
      op(this.noS, Math.min(clamp(noIn * 2.5), 1 - out4))
      this.noS.style.transform = `translate(${this.noD.dx * (1 - dk2)}px, ${this.noD.dy * (1 - dk2)}px) scale(${(noIn <= 0 ? .6 : lerp(.6, 1, E.back(noIn))) * lerp(1.15, 1, dk2)})`
      // ②'s badge: yellow «؟» breathes (stronger while ② is discussed), then → grey ✓ outline «قريباً» (L3)
      const tTitleBase = Math.max(F(3, .3), Math.max(F(3, .1), T.at(3) + .6) + 1.0)
      const tM = Math.max(F(3, .55), tTitleBase + .7)
      const mq = prog(lt, tM, .7)
      const c2 = this.c2
      const talk = env(lt, T.at(1), T.end(1) + .3, .4, .6)
      op(c2.bq, 1 - mq)
      c2.bq.style.transform = `scale(${lerp(1, .4, E.in(mq)) * (1 + .1 * talk * (.5 + .5 * Math.sin(lt * 5)))}) rotate(${-90 * mq}deg)`
      if (mq <= 0) c2.bq.style.boxShadow = `0 0 ${20 + 14 * Math.sin(lt * 2.4 + 2) + 18 * talk}px ${Y}aa`
      c2.ck.style.opacity = mq > 0 ? 1 : 0
      c2.ring.style.opacity = clamp(mq * 2)
      draw(c2.tick, prog(lt, tM + .3, .5))
      rise(c2.soon, prog(lt, tM + .5, .5), 10)

      // ================= L2: the step n → n+1, twice =================
      const out2 = T.p(lt, 3, 0, .5)
      const v2 = p => p * (1 - out2)
      pop(this.st1, v2(T.p(lt, 2, .75, .5))); pop(this.st2, v2(T.p(lt, 2, .9, .5)))
      // «تنتقل الخاصّة من خطوةٍ إلى التالية»: both step chips pulse until the pictures start
      const sg = env(lt, T.at(2) + 1.3, Math.max(F(2, .3), T.at(2) + 1) + 1.2, .4, .6)
      ;[this.st1, this.st2].forEach((c, k) => { c.style.boxShadow = sg > 0 ? `0 0 ${(18 + 10 * Math.sin(lt * 4 + k * 1.5)) * sg}px ${B}aa` : '' })
      const tSq = Math.max(F(2, .3), T.at(2) + 1), tL2 = Math.max(F(2, .44), tSq + 1.2), tBig = Math.max(F(2, .56), tL2 + 1.2)
      this.dots.forEach(d => {
        const p = d.L ? prog(lt, tL2 + d.k * .08, .45, E.back) : prog(lt, tSq + d.k * .06, .4, E.back)
        d.c.style.opacity = v2(clamp(p * 3)); d.c.style.transform = `scale(${Math.max(0, p)})`
      })
      const { SPD, OX, OY } = this
      op(this.n2, v2(prog(lt, tSq + .6, .5)))
      op(this.lL, v2(prog(lt, tL2 + .7, .5)))
      const big = prog(lt, tBig, .6)
      op(this.lN, v2(Math.min(prog(lt, tSq + .8, .5), 1 - big))); op(this.lN1, v2(big))
      const bx1 = OX - 14, bx2 = lerp(OX + 3 * SPD + 14, OX + 4 * SPD + 14, E.io(big)), by = OY + 24
      this.brace.setAttribute('d', `M${bx1},${by} L${bx1},${by + 8} L${bx2},${by + 8} L${bx2},${by}`)
      this.brace.style.opacity = v2(prog(lt, tSq + .8, .5))
      const side = lerp(3, 4, E.io(big)) * SPD
      this.sqOut.setAttribute('x', OX - 28); this.sqOut.setAttribute('y', OY - side - 28)
      this.sqOut.setAttribute('width', side + 56); this.sqOut.setAttribute('height', side + 56)
      this.sqOut.style.opacity = v2(prog(lt, tSq + .4, .5)) * (.55 + .45 * big)
      this.sqOut.setAttribute('stroke', big > 0 ? mixColor(C.ink, Y, Math.sin(Math.PI * big)) : C.ink)
      wipe(this.f1, prog(lt, Math.max(F(2, .62), tBig + .5), .9), 'ltr'); op(this.f1, 1 - out2)
      // the loop (drawn as «والسبعة في الآحاد» approaches, then the runner spins once)
      const tLoop = Math.max(F(2, .68), tBig + 1.1)
      const pNA = prog(lt, tLoop, .45), pT = prog(lt, tLoop + .3, .6), pNB = prog(lt, tLoop + .6, .45), pB = prog(lt, tLoop + .95, .6)
      const nodeSet = (g, lb, p) => { g.style.opacity = v2(clamp(p * 2)); g.style.transform = `scale(${p <= 0 ? .3 : lerp(.3, 1, E.back(p))})`; op(lb, v2(clamp(p * 2))) }
      nodeSet(this.nA, this.lA, pNA); nodeSet(this.nB, this.lB, pNB)
      const arcHead = (path, head, p) => {
        draw(path, p); path.style.opacity = 1 - out2
        const L = path.getTotalLength(), a = path.getPointAtLength(L * p), b = path.getPointAtLength(Math.max(0, L * p - 3))
        head.setAttribute('transform', `translate(${a.x},${a.y}) rotate(${Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI})`)
        head.style.opacity = (p > .05 ? 1 : 0) * (1 - out2)
      }
      arcHead(this.arcT, this.hT, pT); arcHead(this.arcB, this.hB, pB)
      op(this.labT, v2(prog(lt, tLoop + .45, .5))); op(this.labB, v2(prog(lt, tLoop + 1.1, .5)))
      const tRun = Math.max(F(2, .8), tLoop + 1.6), runD = 2
      const run = prog(lt, tRun, runD, E.io)
      if (run > 0 && run < 1) {
        const onT = run < .5, path = onT ? this.arcT : this.arcB, L = path.getTotalLength()
        const pt = path.getPointAtLength(L * ((run % .5) * 2))
        this.runner.setAttribute('cx', pt.x); this.runner.setAttribute('cy', pt.y); this.runner.style.opacity = 1 - out2
      } else this.runner.style.opacity = 0
      const hit = prog(lt, tRun + runD - .1, .6)
      this.nA.style.filter = hit > 0 && hit < 1 ? `drop-shadow(0 0 ${28 * Math.sin(hit * Math.PI)}px ${Y})` : ''
      rise(this.cap2, v2(prog(lt, tLoop + 1.3, .6)), 14)

      // ================= L3: dominoes → lesson 2; ② «قريباً», ① gets its tag =================
      const dIn = Math.min(T.p(lt, 3, .2, .6), 1 - out4)
      this.ground.style.opacity = dIn
      const T0 = Math.max(F(3, .1), T.at(3) + .6), dt = .13, D = .5
      const free = this.doms.map((d, k) => 90 * E.in(clamp((lt - T0 - k * dt) / D)))
      const ang = new Array(this.ND)
      for (let k = this.ND - 1; k >= 0; k--) ang[k] = Math.min(free[k], this.contact(k === this.ND - 1 ? 0 : ang[k + 1]))
      this.doms.forEach((d, k) => {
        const st = T.p(lt, 3, .2 + k * .025, .4)
        d.g.style.opacity = Math.min(st, 1 - out4)
        d.g.setAttribute('transform', `translate(0 ${(1 - E.out(st)) * 20}) rotate(${ang[k]} ${d.x + this.DW} ${this.GY})`)
        const lit = clamp(ang[k] / 20)
        d.r.setAttribute('fill', mixColor('#1d1850', '#3b2a8c', lit))
        d.r.style.filter = lit > .3 ? `drop-shadow(0 0 ${8 * lit}px ${P})` : ''
      })
      const tp = prog(lt, tTitleBase, .7)
      op(this.l2, Math.min(tp, 1 - out4)); this.l2.style.transform = `scale(${lerp(.86, 1, E.back(tp))})`
      rise(this.l2tag, Math.min(prog(lt, tTitleBase + .3, .5), 1 - out4), 10)
      const tagP = prog(lt, tM + .6, .5)
      op(this.l2S, Math.min(clamp(tagP * 2.5), 1 - out4)); this.l2S.style.transform = `translateY(${(1 - E.out(tagP)) * -26}px) scale(${tagP <= 0 ? .7 : lerp(.7, 1, E.back(tagP))})`
      this.l2S.style.boxShadow = `0 0 ${18 + 12 * Math.sin(lt * 2.2)}px rgba(167,139,250,${.35 * clamp(tagP)})`

      // ================= L4: outro =================
      const oIn = T.p(lt, 4, .35, .8)
      op(this.out, oIn * (1 - fadeAll)); this.out.style.transform = `translateY(${(1 - E.out(oIn)) * 40}px)`
      typeWords(this.o1, T.f(lt, 4, .03, .42))
      const o2p = prog(lt, Math.max(F(4, .46), T.at(4) + 2), .6)
      rise(this.o2, o2p, 16)
      op(this.sep, o2p)
      // pencil-and-paper: the sheet, its lines written one by one, the pencil following the pen tip
      draw(this.icPaper, o2p); draw(this.icFold, prog(lt, Math.max(F(4, .46), T.at(4) + 2) + .3, .4))
      const w0 = Math.max(F(4, .5), T.at(4) + 2.4)
      let tipX = 48, tipY = 52
      this.icLines.forEach((l, k) => {
        const p = prog(lt, w0 + k * .55, .5, E.io)
        draw(l, p)
        if (p > 0) { tipX = 48 + p * ((k === 3 ? 100 : 138) - 48); tipY = [52, 76, 100, 124][k] }
      })
      this.pen.setAttribute('transform', `translate(${tipX + 4},${tipY - 2 + Math.sin(lt * 14) * (lt > w0 && lt < w0 + 2.2 ? 1.5 : 0)})`)
      this.pen.style.opacity = prog(lt, w0 - .3, .4)
      const eP = prog(lt, Math.max(F(4, .76), T.at(4) + 4), .7)
      op(this.end, eP * (1 - fadeAll)); this.end.style.transform = `scale(${lerp(.9, 1, E.back(eP))})`
      this.end.style.boxShadow = `0 0 ${40 + 16 * Math.sin(lt * 2)}px rgba(124,58,237,${.3 * eP})`
    },
  })
})()

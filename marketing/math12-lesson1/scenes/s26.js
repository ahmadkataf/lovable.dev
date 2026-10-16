// s26 · الدرس القادم — the two open questions come back from the corner pins.
// L0: card ① — «أوّل n عدداً فرديّاً» are terms of an arithmetic sequence: chips r = 2, a = 1.
// L1: ℓ = 1 + (n−1)×2 = 2n−1 (by u_m = u_p + (m−p) r) joins the chips; S = n(a+ℓ)/2 = … = n² ✓ «بقانون المجموع الحسابي».
// L2: card ② keeps its yellow «؟» and gets a pink chip «لا قانون جاهز».
// L3: the step n → n+1 for both: n×n purple square + yellow L of 2n+1 dots = (n+1)²; units-digit loop …7 → …9 → …7.
// L4: an endless row of dominoes topples into the lesson-2 title + «برهانٌ كامل — لا مجرّد ملاحظة»;
//     ②'s «؟» → grey ✓ «قريباً»; ① gets «برهانٌ ثانٍ بالتدريج — الدرس 2».
// L5: outro card (solutions video, try first), end card, fade to navy.
(() => {
  const ID = 's26'
  const Y = C.yel, P = C.pur, G = C.grn, B = C.blu, R = C.red
  const col = (c, s) => `\\textcolor{${c}}{${s}}`
  const kt = s => `<bdi class="m">${katex.renderToString(s, KOPT)}</bdi>`
  const PIN = { x: 120, y: 174 }, PS = .5          // pinned corner cards (as in s01–s08)
  const CY = 300, CW = 800, X1 = 1000, X2 = 120     // card ① (right, read first), card ② (left)
  const M1 = X1 + CW / 2, M2 = X2 + CW / 2          // their centres: 1400, 520

  // The script has 6 lines (beats). Older timelines merged the first beats into fewer lines:
  // split those lines so the scene still plays (5 lines: L0 = beats 0+1; 4 lines: L0 = beats 0+1+2).
  function timing(S) {
    const N = S.lines.length
    if (N >= 6) return S
    const map = N === 5 ? [[0, 0, .55], [0, .55, 1], [1], [2], [3], [4]] : [[0, 0, .36], [0, .36, .72], [0, .72, 1], [1], [2], [3]]
    const seg = k => {
      const m = map[k]; if (!m) return [Infinity, Infinity]
      const a = S.at(m[0]), e = S.end(m[0])
      return m.length === 1 ? [a, e] : [a + m[1] * (e - a) + (m[1] > 0 ? .2 : 0), a + m[2] * (e - a) - (m[2] < 1 ? .2 : 0)]
    }
    const at = k => seg(k)[0], end = k => seg(k)[1]
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
  // visible extent of a KaTeX piece (glyph leaves + fraction bars), relative to `ref`
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
      this.c1 = mkCard(X1, '🤔 سؤال مفتوح ①', `\\htmlId{${ID}-lhs}{1+3+5+\\cdots+(2n-1)} = \\htmlId{${ID}-n2}{n^2}`, `مهما يكن $n \\ge 1$ <span id="${ID}-q1" style="display:inline-block">؟</span>`)
      this.c2 = mkCard(X2, '🔒 سؤال مفتوح ②', 'u_0 = 3,\\quad u_{n+1} = u_n^2-2', `آحاد $u_n$ تساوي <b id="${ID}-seven" style="display:inline-block;color:${Y}">7</b> مهما يكن $n\\ge1$ ؟`)
      this.n2q = $('n2'); this.n2q.style.display = 'inline-block'
      this.lhs = $('lhs')
      this.q1 = $('q1'); this.seven = $('seven')
      this.ok1 = badge(this.c1.el, '✓', G); op(this.ok1, 0)  // ① closed: green ✓
      this.mkL = el('div', '', null, root)                   // yellow frame on «1+3+5+⋯+(2n−1)»
      this.mkL.style.cssText = `position:absolute;border-radius:14px;border:3px solid ${Y};background:rgba(255,210,63,.07);box-shadow:0 0 24px rgba(255,210,63,.3);pointer-events:none;transform-origin:100% 50%`
      op(this.mkL, 0)
      // ② later: grey ✓ outline «قريباً»
      {
        const c = this.c2
        c.ck = svg(c.el, 28, -32, 64, 64); c.ck.style.zIndex = 3
        c.ring = sv(c.ck, 'circle', { cx: 32, cy: 32, r: 29, fill: 'rgba(20,29,56,.97)', stroke: C.mut, 'stroke-width': 3, 'stroke-dasharray': '5 5' })
        c.tick = sv(c.ck, 'path', { d: 'M18,33 L28,43 L46,22', fill: 'none', stroke: C.mut, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
        c.soon = el('div', '', 'قريباً', c.el)
        c.soon.style.cssText = `position:absolute;left:104px;top:-20px;padding:4px 16px;border-radius:999px;font-size:24px;font-weight:800;color:${C.ink};background:#2e3657;border:1.5px solid ${C.mut};white-space:nowrap`
      }

      // ================= L0: the odd numbers are an arithmetic sequence =================
      this.cap = rich(`<span class="yel b">أوّل $n$ عدداً فرديّاً</span><span id="${ID}-cap2" style="display:inline-block">&nbsp;— حدودٌ متتالية من متتالية حسابيّة</span>`, 's')
      root.appendChild(this.cap); this.cap.style.cssText += `font-size:30px;font-weight:700;color:${C.ink};white-space:nowrap`
      place(this.cap, M1, 576, { anchor: 'c' })
      this.cap2 = $('cap2'); this.cap2.style.color = C.mut
      this.chips = el('div', '', null, root)
      place(this.chips, M1, 642, { anchor: 'c' })
      this.chips.style.cssText += 'display:flex;align-items:center;gap:18px;direction:rtl;white-space:nowrap'
      const bchip = l => { const e = el('div', 'chip', kt(l), this.chips); e.style.cssText += `border-color:${B}88;background:rgba(18,40,66,.96);color:${B};font-size:34px;padding:4px 24px`; return e }
      this.chR = bchip('r = 2'); this.chA = bchip('a = 1'); this.chL = bchip('\\ell = 2n-1')
      // ================= L1: the last term, then the sum =================
      this.useTag = el('div', '', `<span style="color:${C.mut};font-weight:700">من</span>&nbsp; ${kt('u_m = u_p + (m-p)\\,r')}`, root)
      this.useTag.style.cssText = `position:absolute;display:flex;align-items:center;direction:rtl;padding:4px 18px;border-radius:999px;border:1.5px solid ${P}77;background:${P}14;color:${P};font-size:26px;white-space:nowrap`
      place(this.useTag, M1, 702, { anchor: 'c' })
      this.step = tex(`${col(B, `\\ell = 1 + (n-1)\\times 2`)} \\htmlId{${ID}-sr}{{}= ${col(B, '2n-1')}}`, 'mx')
      root.appendChild(this.step); this.step.style.fontSize = '48px'; place(this.step, M1, 764, { anchor: 'c' })
      this.sr = $('sr'); this.sr.style.display = 'inline-block'
      this.der = tex(`\\htmlId{${ID}-d1}{S = \\dfrac{n(\\htmlId{${ID}-da}{a}+\\htmlId{${ID}-dl}{\\ell})}{2}} \\htmlId{${ID}-d2}{{}= \\dfrac{n\\big(${col(B, '1')}+${col(B, '(2n-1)')}\\big)}{2}} \\htmlId{${ID}-d3}{{}= ${col(G, 'n^2')}}`, 'mx')
      root.appendChild(this.der); this.der.style.fontSize = '50px'; place(this.der, M1, 750, { anchor: 'c' })
      this.d = {}
      for (const k of ['d1', 'd2', 'd3', 'da', 'dl']) { this.d[k] = $(k); this.d[k].style.display = 'inline-block' }
      this.okS = sticker(root, '✓ بقانون المجموع الحسابي', G, 28)
      // ================= L2: card ② — no ready-made law =================
      this.noS = sticker(root, 'لا قانون جاهز', R, 28)
      // ================= L4: card ① gets its lesson-2 tag =================
      this.l2S = sticker(root, 'برهانٌ ثانٍ بالتدريج — الدرس 2', P, 25)

      // ================= L3, under card ①: n×n square + yellow L = (n+1)×(n+1) =================
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

      // ================= L3, under card ②: units-digit loop …7 → …9 → …7 =================
      const A = [M2 - 130, 758], Bn = [M2 + 130, 758], RR = 50
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
      this.cap2b = rich(`إذا انتهى $u_n$ بـ <b class="yel">7</b> انتهى $u_{n+1}$ بـ <b class="yel">7</b>`, 'p'); root.appendChild(this.cap2b)
      place(this.cap2b, M2, 944, { anchor: 'c' }); this.cap2b.style.cssText += 'white-space:nowrap;font-size:36px;line-height:1.4'
      this.st2 = stepChip(M2)

      // ================= L4: endless dominoes → lesson 2 =================
      const dw = el('div', '', null, root); place(dw, 0, 0, { w: W, h: H })
      dw.style.cssText += '-webkit-mask-image:linear-gradient(90deg,transparent 0px,#000 220px,#000 1700px,transparent 1860px);mask-image:linear-gradient(90deg,transparent 0px,#000 220px,#000 1700px,transparent 1860px)'
      const dsv = svg(dw, 0, 0, W, H); dsv.style.direction = 'ltr'
      this.GY = 744; this.DW = 32; this.DH = 128; this.SP = 100; this.X0 = 60; this.ND = 19
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
      place(this.l2, 960, 858, { anchor: 'c' })
      this.l2.style.cssText += 'display:flex;align-items:center;gap:22px;direction:rtl;white-space:nowrap'
      const b2 = el('div', '', '2', this.l2)
      b2.style.cssText = `width:78px;height:78px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:900;color:#0b1020;background:${P};box-shadow:0 0 40px ${P}aa`
      const l2t = el('div', '', 'البرهان بالتدريج <span style="color:#9aa8c9;font-weight:700">أو</span> بالاستقراء الرياضي', this.l2)
      l2t.style.cssText = `font-size:58px;font-weight:900;color:${P};text-shadow:0 0 30px rgba(167,139,250,.35)`
      this.l2tag = el('div', '', 'الدرس القادم', root)
      this.l2tag.style.cssText = `position:absolute;padding:4px 18px;border-radius:999px;font-size:24px;font-weight:800;color:#0b1020;background:${P};white-space:nowrap`
      place(this.l2tag, 960, 790, { anchor: 'c' })
      this.full = chip(root, 'برهانٌ كامل — لا مجرّد ملاحظة', 960, 946, { anchor: 'c', color: P })
      this.full.style.cssText += 'font-size:28px;padding:6px 26px;direction:rtl;white-space:nowrap'

      // ================= L5: outro =================
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

    _sigNow() { return [this.c1.el, this.c2.el, this.okS, this.noS, this.l2S, this.out, this.l2, this.der, this.step, this.chips, this.cap].map(e => e.offsetWidth + 'x' + e.offsetHeight).join('|') },
    _layout() {
      const root = this.root
      // measure untransformed
      const keep = [this.c1.el, this.c2.el, this.chL].map(e => [e, e.style.transform])
      keep.forEach(([e]) => (e.style.transform = 'none'))
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
      // yellow frame on the sum inside card ①
      const lr = inkBox(this.lhs, root)
      place(this.mkL, lr.x - 12, lr.y - 10, { w: lr.w + 24, h: lr.h + 20 })
      // ℓ chip flies from the result of the step into its slot
      const a = inkBox(this.sr, root), b = rectIn(this.chL, root)
      this.flyL = { dx: a.x + a.w * .62 - b.cx, dy: a.cy - b.cy }
      // stickers: free position (where they are first said) → docked on the card's bottom edge
      const yB = CY + h
      const dock = (e, fx, fy, x, y) => { place(e, x, y, { anchor: 'c' }); return { dx: fx - x, dy: fy - y } }
      this.okD = dock(this.okS, M1, 858, X1 + CW - 40 - this.okS.offsetWidth / 2, yB)
      this.noD = dock(this.noS, M2, 588, X2 + CW - 40 - this.noS.offsetWidth / 2, yB)
      place(this.l2S, M1, yB + 62, { anchor: 'c' })      // hangs under card ① (its bottom edge carries the green sticker)
      keep.forEach(([e, t]) => (e.style.transform = t))
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
      const out5 = T.p(lt, 5, 0, .6)                       // the outro clears the board
      const fadeAll = prog(lt, S.dur - 1.5, 1.2, E.io)      // last scene: fade to navy ourselves
      this.head.set(Math.min(T.p(lt, 0, 0, .8), 1 - out5))
      this.head2.set(T.p(lt, 5, .65, .8))
      this.head2.el.style.opacity = 1 - fadeAll

      // ================= cards: pinned → centre; focus ① (L0–L1), ② (L2), both (L3+) =================
      const tA1 = T.at(0) + .35, tA2 = tA1 + .45
      const f0 = prog(lt, Math.max(F(0, .15), tA2 + 1.1), .6), f2 = T.p(lt, 2, 0, .6), f3 = T.p(lt, 3, 0, .6)
      const dim1 = lerp(1, .55, f2 * (1 - f3)), dim2 = lerp(1, .55, f0 * (1 - f2))
      const cardT = (c, pin, t, k, dim) => {
        const appear = prog(lt, t - .55, .4)
        const go = prog(lt, t, 1, E.io)
        c.el.style.transform = `translate(${pin.dx * (1 - go)}px, ${pin.dy * (1 - go)}px) scale(${lerp(PS, 1, go)})`
        op(c.el, Math.min(appear, 1 - out5) * dim)
        c.el.style.boxShadow = go >= 1 ? `0 30px 80px rgba(0,0,0,.35),0 0 ${30 + 14 * Math.sin(lt * 1.8 + k * 2)}px rgba(167,139,250,${.24 * dim})` : ''
        const pp = prog(lt, t - .2, .45)
        op(c.pin, Math.min(appear, 1 - pp))
        c.pin.style.transform = `translateY(${-30 * E.in(pp)}px) rotate(${-25 * pp}deg)`
      }
      cardT(this.c1, this.pin1, tA1, 0, dim1); cardT(this.c2, this.pin2, tA2, 1, dim2)

      // ================= L0: «أوّل n عدداً فرديّاً» — arithmetic, r = 2, a = 1 =================
      const tMk = Math.max(F(0, .24), tA2 + 1.3)
      const tCap = Math.max(F(0, .4), tMk + .7), tCap2 = Math.max(F(0, .54), tCap + .7)
      const tR = Math.max(F(0, .78), tCap2 + .8), tA = Math.max(F(0, .9), tR + .5)
      // ================= L1 timings =================
      const tUse = Math.max(F(1, .02), T.at(1) + .3)
      const tS0 = Math.max(F(1, .05), tUse + .3), tS1 = Math.max(F(1, .46), tS0 + 1.2)
      const tSr = Math.max(F(1, .5), tS1 + .1), tFly = Math.max(F(1, .62), tSr + .7)
      const tSwap = Math.max(F(1, .72), tFly + .8)
      const tD1 = tSwap + .35, tD2 = Math.max(F(1, .82), tD1 + .9), tRes = Math.max(F(1, .92), tD2 + .9), tOk = tRes + .5
      const out1 = T.p(lt, 3, 0, .6)                      // everything under card ① leaves when the step begins
      const dimD = lerp(1, .45, f2)                        // and steps back while ② is discussed
      // frame on the sum: from «بقانون المجموع» until the sum is settled
      const mkP = Math.min(prog(lt, tMk, .5), 1 - prog(lt, tOk, .5))
      op(this.mkL, mkP > 0 ? mkP : 0); this.mkL.style.transform = `scaleX(${E.out(clamp(prog(lt, tMk, .5)))})`
      this.mkL.style.boxShadow = `0 0 ${18 + 10 * Math.sin(lt * 2.6)}px rgba(255,210,63,.35)`
      rise(this.cap, Math.min(prog(lt, tCap, .6), 1 - out1) * dimD, 14)
      op(this.cap2, prog(lt, tCap2, .6))
      op(this.chips, (1 - out1) * dimD)
      pop(this.chR, prog(lt, tR, .5)); pop(this.chA, prog(lt, tA, .5))
      // L1: «من u_m = u_p + (m−p) r»: ℓ = 1 + (n−1)×2 = 2n−1, the chip ℓ joins, then the sum
      const stOut = prog(lt, tSwap, .5)
      rise(this.useTag, Math.min(prog(lt, tUse, .5), 1 - stOut), 10)
      op(this.step, 1 - stOut); this.step.style.transform = `translateY(${-14 * E.io(stOut)}px)`
      const sP = clamp((lt - tS0) / (tS1 - tS0))
      this.step.style.clipPath = sP >= 1 ? '' : `inset(-20% ${(1 - sP) * 100}% -20% -5%)`
      this.step.style.visibility = sP <= 0 ? 'hidden' : 'visible'
      const srP = prog(lt, tSr, .5)
      op(this.sr, srP); this.sr.style.transform = `translateX(${(1 - E.out(srP)) * -20}px)`
      this.sr.style.textShadow = srP > 0 ? `0 0 ${16 * (1 - prog(lt, tFly + .6, .6))}px rgba(56,189,248,.8)` : ''
      const fl = prog(lt, tFly, .8, E.io), fly = this.flyL
      op(this.chL, clamp(fl * 3))
      this.chL.style.transform = `translate(${fly.dx * (1 - fl)}px, ${fly.dy * (1 - fl)}px) scale(${lerp(.75, 1, fl)})`
      // S = n(a+ℓ)/2 = n(1+(2n−1))/2 = n²
      op(this.der, (1 - out1) * dimD)
      wipe(this.d.d1, prog(lt, tD1, .8), 'ltr')
      this.d.da.style.color = mixColor(C.ink, B, prog(lt, tD1 + .5, .4))
      this.d.dl.style.color = mixColor(C.ink, B, prog(lt, tD1 + .7, .4))
      wipe(this.d.d2, prog(lt, tD2, .8), 'ltr')
      const pRes = prog(lt, tRes, .5)
      op(this.d.d3, clamp(pRes * 2.5)); this.d.d3.style.transform = `scale(${pRes <= 0 ? .6 : lerp(.6, 1, E.back(pRes))})`
      this.d.d3.style.textShadow = pRes > 0 ? `0 0 ${14 + 8 * Math.sin(lt * 2.4)}px rgba(110,224,90,.55)` : ''
      // card ① closes: «؟» → green ✓, n² turns green
      const cl = prog(lt, tOk, .6)
      op(this.c1.bq, 1 - cl); this.c1.bq.style.transform = `scale(${lerp(1, .4, E.in(cl))}) rotate(${-90 * cl}deg)`
      if (cl <= 0) this.c1.bq.style.boxShadow = `0 0 ${20 + 14 * Math.sin(lt * 2.4)}px ${Y}99`
      pop(this.ok1, prog(lt, tOk + .25, .5))
      this.ok1.style.boxShadow = `0 0 ${20 + 12 * Math.sin(lt * 2)}px ${G}99`
      op(this.q1, 1 - cl)
      this.n2q.style.color = mixColor(Y, G, cl)
      // green sticker: under the derivation, then docked on card ①'s bottom edge
      const okIn = prog(lt, tOk, .5), dk1 = E.io(T.p(lt, 3, 0, .7))
      op(this.okS, Math.min(clamp(okIn * 2.5), 1 - out5) * lerp(dimD, 1, dk1))
      this.okS.style.transform = `translate(${this.okD.dx * (1 - dk1)}px, ${this.okD.dy * (1 - dk1)}px) scale(${(okIn <= 0 ? .6 : lerp(.6, 1, E.back(okIn))) * lerp(1.15, 1, dk1)})`

      // ================= L2: card ② keeps its «؟» — no ready-made law =================
      const g7 = Math.sin(clamp((lt - Math.max(F(2, .2), T.at(2) + .4)) / 1.6) * Math.PI)
      this.seven.style.textShadow = g7 > 0 ? `0 0 ${22 * g7}px rgba(255,210,63,.9)` : ''
      this.seven.style.transform = `scale(${1 + .3 * Math.max(0, g7)})`
      const tNo = Math.max(F(2, .68), T.at(2) + 1.2)
      const noIn = prog(lt, tNo, .5), dk2 = E.io(T.p(lt, 3, .1, .7))
      op(this.noS, Math.min(clamp(noIn * 2.5), 1 - out5))
      this.noS.style.transform = `translate(${this.noD.dx * (1 - dk2)}px, ${this.noD.dy * (1 - dk2)}px) scale(${(noIn <= 0 ? .6 : lerp(.6, 1, E.back(noIn))) * lerp(1.15, 1, dk2)})`

      // ================= L3: the step n → n+1, twice =================
      const out3 = T.p(lt, 4, 0, .5)
      const v3 = p => p * (1 - out3)
      pop(this.st1, v3(T.p(lt, 3, .75, .5))); pop(this.st2, v3(T.p(lt, 3, .9, .5)))
      // «تنتقل الخاصّة من خطوةٍ إلى التالية»: both step chips pulse until the pictures start
      const tSq = Math.max(F(3, .3), T.at(3) + 1.4), tL2 = Math.max(F(3, .44), tSq + 1.2), tBig = Math.max(F(3, .56), tL2 + 1.2)
      const sg = env(lt, T.at(3) + 1.3, tSq + .4, .4, .6)
      ;[this.st1, this.st2].forEach((c, k) => { c.style.boxShadow = sg > 0 ? `0 0 ${(18 + 10 * Math.sin(lt * 4 + k * 1.5)) * sg}px ${B}aa` : '' })
      this.dots.forEach(d => {
        const p = d.L ? prog(lt, tL2 + d.k * .08, .45, E.back) : prog(lt, tSq + d.k * .06, .4, E.back)
        d.c.style.opacity = v3(clamp(p * 3)); d.c.style.transform = `scale(${Math.max(0, p)})`
      })
      const { SPD, OX, OY } = this
      op(this.n2, v3(prog(lt, tSq + .6, .5)))
      op(this.lL, v3(prog(lt, tL2 + .7, .5)))
      const big = prog(lt, tBig, .6)
      op(this.lN, v3(Math.min(prog(lt, tSq + .8, .5), 1 - big))); op(this.lN1, v3(big))
      const bx1 = OX - 14, bx2 = lerp(OX + 3 * SPD + 14, OX + 4 * SPD + 14, E.io(big)), by = OY + 24
      this.brace.setAttribute('d', `M${bx1},${by} L${bx1},${by + 8} L${bx2},${by + 8} L${bx2},${by}`)
      this.brace.style.opacity = v3(prog(lt, tSq + .8, .5))
      const side = lerp(3, 4, E.io(big)) * SPD
      this.sqOut.setAttribute('x', OX - 28); this.sqOut.setAttribute('y', OY - side - 28)
      this.sqOut.setAttribute('width', side + 56); this.sqOut.setAttribute('height', side + 56)
      this.sqOut.style.opacity = v3(prog(lt, tSq + .4, .5)) * (.55 + .45 * big)
      this.sqOut.setAttribute('stroke', big > 0 ? mixColor(C.ink, Y, Math.sin(Math.PI * big)) : C.ink)
      wipe(this.f1, prog(lt, Math.max(F(3, .62), tBig + .5), .9), 'ltr'); op(this.f1, 1 - out3)
      // the loop (drawn as «والسبعة في الآحاد» approaches, then the runner spins once)
      const tLoop = Math.max(F(3, .68), tBig + 1.1)
      const pNA = prog(lt, tLoop, .45), pT = prog(lt, tLoop + .3, .6), pNB = prog(lt, tLoop + .6, .45), pB = prog(lt, tLoop + .95, .6)
      const nodeSet = (g, lb, p) => { g.style.opacity = v3(clamp(p * 2)); g.style.transform = `scale(${p <= 0 ? .3 : lerp(.3, 1, E.back(p))})`; op(lb, v3(clamp(p * 2))) }
      nodeSet(this.nA, this.lA, pNA); nodeSet(this.nB, this.lB, pNB)
      const arcHead = (path, head, p) => {
        draw(path, p); path.style.opacity = 1 - out3
        const L = path.getTotalLength(), a = path.getPointAtLength(L * p), b = path.getPointAtLength(Math.max(0, L * p - 3))
        head.setAttribute('transform', `translate(${a.x},${a.y}) rotate(${Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI})`)
        head.style.opacity = (p > .05 ? 1 : 0) * (1 - out3)
      }
      arcHead(this.arcT, this.hT, pT); arcHead(this.arcB, this.hB, pB)
      op(this.labT, v3(prog(lt, tLoop + .45, .5))); op(this.labB, v3(prog(lt, tLoop + 1.1, .5)))
      const tRun = Math.max(F(3, .8), tLoop + 1.6), runD = 2
      const run = prog(lt, tRun, runD, E.io)
      if (run > 0 && run < 1) {
        const onT = run < .5, path = onT ? this.arcT : this.arcB, L = path.getTotalLength()
        const pt = path.getPointAtLength(L * ((run % .5) * 2))
        this.runner.setAttribute('cx', pt.x); this.runner.setAttribute('cy', pt.y); this.runner.style.opacity = 1 - out3
      } else this.runner.style.opacity = 0
      const hit = prog(lt, tRun + runD - .1, .6)
      this.nA.style.filter = hit > 0 && hit < 1 ? `drop-shadow(0 0 ${28 * Math.sin(hit * Math.PI)}px ${Y})` : ''
      rise(this.cap2b, v3(prog(lt, tLoop + 1.3, .6)), 14)

      // ================= L4: dominoes → lesson 2; «برهانٌ كامل»; ② «قريباً»; ① gets its tag =================
      const dIn = Math.min(T.p(lt, 4, .2, .6), 1 - out5)
      this.ground.style.opacity = dIn
      const T0 = Math.max(F(4, .03), T.at(4) + .5), dt = .13, D = .5
      const free = this.doms.map((d, k) => 90 * E.in(clamp((lt - T0 - k * dt) / D)))
      const ang = new Array(this.ND)
      for (let k = this.ND - 1; k >= 0; k--) ang[k] = Math.min(free[k], this.contact(k === this.ND - 1 ? 0 : ang[k + 1]))
      this.doms.forEach((d, k) => {
        const st = T.p(lt, 4, .1 + k * .02, .4)
        d.g.style.opacity = Math.min(st, 1 - out5)
        d.g.setAttribute('transform', `translate(0 ${(1 - E.out(st)) * 20}) rotate(${ang[k]} ${d.x + this.DW} ${this.GY})`)
        const lit = clamp(ang[k] / 20)
        d.r.setAttribute('fill', mixColor('#1d1850', '#3b2a8c', lit))
        d.r.style.filter = lit > .3 ? `drop-shadow(0 0 ${8 * lit}px ${P})` : ''
      })
      const tTitle = Math.max(F(4, .14), T0 + .9)
      const tp = prog(lt, tTitle, .7)
      op(this.l2, Math.min(tp, 1 - out5)); this.l2.style.transform = `scale(${lerp(.86, 1, E.back(tp))})`
      rise(this.l2tag, Math.min(prog(lt, tTitle + .3, .5), 1 - out5), 10)
      const tFull = Math.max(F(4, .4), tTitle + 1)
      const fuP = prog(lt, tFull, .55)
      rise(this.full, Math.min(fuP, 1 - out5), 12)
      this.full.style.boxShadow = fuP > 0 ? `0 0 ${18 + 10 * Math.sin(lt * 2.2)}px rgba(167,139,250,.35)` : ''
      // ②'s badge: yellow «؟» breathes (stronger while ② is discussed), then → grey ✓ outline «قريباً»
      const tM = Math.max(F(4, .62), tFull + 1)
      const mq = prog(lt, tM, .7)
      const c2 = this.c2
      const talk = env(lt, T.at(2), T.end(2) + .3, .4, .6)
      op(c2.bq, 1 - mq)
      c2.bq.style.transform = `scale(${lerp(1, .4, E.in(mq)) * (1 + .1 * talk * (.5 + .5 * Math.sin(lt * 5)))}) rotate(${-90 * mq}deg)`
      if (mq <= 0) c2.bq.style.boxShadow = `0 0 ${20 + 14 * Math.sin(lt * 2.4 + 2) + 18 * talk}px ${Y}aa`
      c2.ck.style.opacity = mq > 0 ? 1 : 0
      c2.ring.style.opacity = clamp(mq * 2)
      draw(c2.tick, prog(lt, tM + .3, .5))
      rise(c2.soon, prog(lt, tM + .5, .5), 10)
      const tTag = Math.max(F(4, .8), tM + 1)
      const tagP = prog(lt, tTag, .5)
      op(this.l2S, Math.min(clamp(tagP * 2.5), 1 - out5)); this.l2S.style.transform = `translateY(${(1 - E.out(tagP)) * -26}px) scale(${tagP <= 0 ? .7 : lerp(.7, 1, E.back(tagP))})`
      this.l2S.style.boxShadow = `0 0 ${18 + 12 * Math.sin(lt * 2.2)}px rgba(167,139,250,${.35 * clamp(tagP)})`

      // ================= L5: outro =================
      const oIn = T.p(lt, 5, .35, .8)
      op(this.out, oIn * (1 - fadeAll)); this.out.style.transform = `translateY(${(1 - E.out(oIn)) * 40}px)`
      typeWords(this.o1, T.f(lt, 5, .03, .42))
      const o2p = prog(lt, Math.max(F(5, .46), T.at(5) + 2), .6)
      rise(this.o2, o2p, 16)
      op(this.sep, o2p)
      // pencil-and-paper: the sheet, its lines written one by one, the pencil following the pen tip
      draw(this.icPaper, o2p); draw(this.icFold, prog(lt, Math.max(F(5, .46), T.at(5) + 2) + .3, .4))
      const w0 = Math.max(F(5, .5), T.at(5) + 2.4)
      let tipX = 48, tipY = 52
      this.icLines.forEach((l, k) => {
        const p = prog(lt, w0 + k * .55, .5, E.io)
        draw(l, p)
        if (p > 0) { tipX = 48 + p * ((k === 3 ? 100 : 138) - 48); tipY = [52, 76, 100, 124][k] }
      })
      this.pen.setAttribute('transform', `translate(${tipX + 4},${tipY - 2 + Math.sin(lt * 14) * (lt > w0 && lt < w0 + 2.2 ? 1.5 : 0)})`)
      this.pen.style.opacity = prog(lt, w0 - .3, .4)
      const eP = prog(lt, Math.max(F(5, .76), T.at(5) + 4), .7)
      op(this.end, eP * (1 - fadeAll)); this.end.style.transform = `scale(${lerp(.9, 1, E.back(eP))})`
      this.end.style.boxShadow = `0 0 ${40 + 16 * Math.sin(lt * 2)}px rgba(124,58,237,${.3 * eP})`
    },
  })
})()

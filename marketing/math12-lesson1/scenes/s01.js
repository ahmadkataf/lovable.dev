// s01 — cold open: odd numbers as L-shaped layers of dots building squares; conjecture S_n = n^2; open question ①;
// last line (the bridge, still page 6): the field settles back into a small 7×7 square, the book's definition of
// «الاستقراء», three chips, pencil and paper, «الإثبات؟ ← هذه الوحدة».
// LIB (card ①, the bridge UI, cue) is reused by s02 when an older timeline still carries the bridge as s02's line 0.
scene('s01', (() => {
  const SP = 100, R = 34, NL = 7          // world lattice spacing, dot radius, number of layers
  const PS = .56, PIN = { x: 120, y: 174 }  // pinned open-question card: scale and top-left corner
  const SQ = { x: 265, y: 602, s: .37 }   // the small 7×7 square during the bridge (centre, scale)
  const TH = { x0: 1580, y0: 664, w0: 220, x1: 430, y1: 430, w1: 260 }   // page-6 thumbnail: corner → beside the square
  const strip = s => s.replace(/[ً-ْٰـ]/g, '')
  // scene-local time at which the narrator reaches the first of `needles` found in line i (char-proportional
  // estimate). Not found → fraction `def` of the line (or null when def is null).
  function cue(S, i, needles, def = 0, lead = .15) {
    const L = S.lines[i]
    if (!L) return Infinity
    const txt = strip(L.text || '')
    let k = -1
    for (const n of [].concat(needles || [])) { k = txt.indexOf(strip(n)); if (k >= 0) break }
    if (k < 0 && def == null) return null
    const f = k >= 0 ? k / Math.max(1, txt.length) : def
    return Math.max(S.at(i), S.at(i) + f * (S.end(i) - S.at(i)) - lead)
  }
  // dots of layer k (1-based), ordered along the L: top-left end → corner → bottom-right end
  function layerDots(k) {
    const out = []
    for (let i = 0; i < k; i++) out.push([i, k - 1])
    for (let j = k - 2; j >= 0; j--) out.push([k - 1, j])
    return out
  }
  const fontsOK = () => document.fonts.check('48px KaTeX_Main') && document.fonts.check('italic 48px KaTeX_Math')
  // the bridge is the line that names «الاستقراء» (s01 line 3 in the current script; s02 line 0 in older timelines)
  const bridgeLine = S => S.lines.findIndex(l => /اسمه الاستقراء|ما فعلته الآن/.test(strip(l.text || '')))

  // ---------- open question ① (built large; pinned = scale PS at PIN) ----------
  function card1(root) {
    const c = card(root, 'def', 410, 196, 1180, { tag: '🤔 سؤال مفتوح ①' })
    c.el.style.transformOrigin = '0 0'
    c.el.style.padding = '42px 50px 32px'
    const q = rich('كيف تُثبت صحّة استقرائك إثباتاً رياضياً؟', 'h3'); c.body.appendChild(q)
    const fr = el('div', '', null, c.body)
    fr.style.cssText = 'direction:rtl;display:flex;align-items:baseline;gap:26px;margin-top:14px;white-space:nowrap'
    const ff = tex('1+3+5+\\cdots+(2n-1) = \\textcolor{#ffd23f}{n^2}', 'mx'); ff.style.fontSize = '56px'; fr.appendChild(ff)
    const fq = rich('مهما يكن $n \\ge 1$', 'p'); fq.style.whiteSpace = 'nowrap'; fr.appendChild(fq)
    const nt = rich('العدد الفردي ذو الترتيب $n$ هو $2n-1$', 's'); c.body.appendChild(nt)
    nt.style.color = C.blu; nt.style.fontSize = '38px'; nt.style.marginTop = '10px'
    const pin = el('div', '', '📌', root)
    pin.style.cssText += 'font-size:40px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))'
    place(pin, PIN.x + 12, PIN.y + 2, { anchor: 'c' })
    return { el: c.el, parts: [q, fr, nt], pin, pinned: `translate(${PIN.x - 410}px, ${PIN.y - 196}px) scale(${PS})` }
  }

  // ---------- the bridge (right column): heading, definition card, three chips, pencil & paper, proof tag ----------
  function bridgeUI(root, S, li, o = {}) {
    const T = {}
    T.h0 = o.h0 ?? S.at(li) + .3
    T.def = Math.max(S.at(li) + (o.defMin ?? 1.2), cue(S, li, ['استخلاص'], .16))
    T.defEnd = Math.max(T.def + 1.5, cue(S, li, ['فالرياضيات'], .52))
    T.c1 = Math.max(T.defEnd + .2, cue(S, li, ['ملاحظة'], .62))
    T.c2 = Math.max(T.c1 + .45, cue(S, li, ['وتجربة'], .66))
    T.c3 = Math.max(T.c2 + .45, cue(S, li, ['واستقراء'], null) ?? T.c2 + .6)
    T.pen = Math.max(T.c3 + .3, cue(S, li, ['يكفيها'], .7))
    T.tag = Math.max(T.pen + 1.2, cue(S, li, ['أما الإثبات'], .82))

    const h0 = heading(root, 'التجربة والملاحظة والاستقراء')
    const dc = card(root, 'def', 1800, 330, 1000, { anchor: 'tr' })
    const defTxt = rich('<span class="pur b">الاستقراء:</span> استخلاص نتائج عامة من النظر في حالات خاصة', 'h3')
    dc.body.appendChild(defTxt); splitWords(defTxt)

    const chips = el('div', '', null, root)
    place(chips, 1800, 584, { anchor: 'tr' })
    chips.style.cssText += 'display:flex;direction:rtl;align-items:center;gap:22px;white-space:nowrap;width:max-content'
    const dots = []
    const chipEls = ['ملاحظة', 'تجربة', 'استقراء'].map((t, i) => {
      if (i) { const d = el('div', '', '·', chips); d.style.cssText = `font-size:44px;font-weight:900;color:${C.dim}`; dots[i] = d }
      const c = el('div', 'chip', t, chips)
      c.style.cssText += 'font-size:36px;padding:12px 34px'
      return c
    })

    const penRow = el('div', '', null, root)
    place(penRow, 1800, 700, { anchor: 'tr' })
    penRow.style.cssText += 'display:flex;direction:rtl;align-items:center;gap:30px;width:max-content'
    const ps = document.createElementNS(NS, 'svg')
    ps.setAttribute('width', 128); ps.setAttribute('height', 128); ps.setAttribute('viewBox', '0 0 128 128'); ps.style.flex = 'none'
    penRow.appendChild(ps)
    const paper = sv(ps, 'path', { d: 'M22,14 L84,14 L104,34 L104,114 L22,114 Z M84,14 L84,34 L104,34', fill: 'rgba(238,242,255,.06)', stroke: C.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' })
    const plines = [44, 60, 76, 92].map((y, i) => sv(ps, 'path', { d: `M36,${y} L${i === 3 ? 66 : 90},${y}`, stroke: C.mut, 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' }))
    const pencil = sv(ps, 'g', {})
    sv(pencil, 'path', { d: 'M70,98 L112,56 L122,66 L80,108 Z', fill: C.yel, stroke: '#0b1020', 'stroke-width': 2.5, 'stroke-linejoin': 'round' })
    sv(pencil, 'path', { d: 'M112,56 L117,51 Q120,48 124,52 L127,55 Q130,59 127,62 L122,66 Z', fill: C.red, stroke: '#0b1020', 'stroke-width': 2.5, 'stroke-linejoin': 'round' })
    sv(pencil, 'path', { d: 'M70,98 L64,114 L80,108 Z', fill: '#f5d7a1', stroke: '#0b1020', 'stroke-width': 2.5, 'stroke-linejoin': 'round' })
    sv(pencil, 'path', { d: 'M64,114 L66.5,107.5 L70.5,111.5 Z', fill: '#0b1020' })
    const penCap = rich('لا تتطلّب تجهيزات مكلفة… بل مجرّد <span class="yel b">قلم وورقة</span>', 'p')
    penCap.style.whiteSpace = 'nowrap'
    penRow.appendChild(penCap)

    const proof = chip(root, 'الإثبات؟ ← <span>هذه الوحدة</span>', 1800, 876, { anchor: 'tr', color: C.yel })
    proof.style.cssText += 'font-size:36px;padding:12px 32px;white-space:nowrap;background:rgba(255,210,63,.16)'
    proof.querySelector('span').style.cssText = `color:#0b1020;background:${C.yel};padding:2px 16px;border-radius:999px`

    return {
      T,
      // clr: 0 → 1 clears the column (used when the title follows in the same scene)
      render(lt, clr = 0) {
        h0.set(prog(lt, T.h0, .7) * (1 - clr))
        {
          const a = prog(lt, T.def, .6) * (1 - clr)
          rise(dc.el, a, 30)
          typeWords(defTxt, prog(lt, T.def + .2, Math.max(1.2, T.defEnd - T.def - .4), E.lin))
          dc.el.style.boxShadow = `0 30px 80px rgba(0,0,0,.35), 0 0 ${26 + 14 * Math.sin(lt * 1.4)}px rgba(167,139,250,${(.12 * a).toFixed(3)})`
        }
        ;[T.c1, T.c2, T.c3].forEach((t, i) => {
          const c = chipEls[i]
          const a = prog(lt, t, .5, E.out) * (1 - clr)
          op(c, a); c.style.transform = `scale(${lerp(.7, 1, E.back(clamp(prog(lt, t, .5))))})`
          const now = env(lt, t, (i < 2 ? [T.c2, T.c3][i] : T.pen) + .1, .2, .4)
          c.style.color = mixColor(i === 2 ? C.pur : '#eef2ff', C.yel, now)
          c.style.borderColor = i === 2 ? `rgba(167,139,250,${(.5 + .5 * now).toFixed(2)})` : `rgba(255,210,63,${(.15 + .7 * now).toFixed(2)})`
          c.style.background = i === 2 ? 'rgba(167,139,250,.14)' : `rgba(255,210,63,${(.05 + .1 * now).toFixed(3)})`
          if (i) op(dots[i], a)
        })
        {
          const a = prog(lt, T.pen, .5) * (1 - clr)
          op(penRow, a)
          penRow.style.transform = `translateY(${(1 - a) * 20}px)`
          draw(paper, prog(lt, T.pen, .8))
          paper.style.fillOpacity = prog(lt, T.pen + .5, .4)
          plines.forEach((l, i) => draw(l, prog(lt, T.pen + .5 + i * .18, .35)))
          const pp = prog(lt, T.pen + .3, .7, E.out)
          const wig = Math.sin(lt * 7) * 2 * clamp(prog(lt, T.pen + .5, .2)) * (1 - prog(lt, T.pen + 1.3, .3))
          pencil.setAttribute('transform', `translate(${(1 - pp) * 40 + wig} ${(1 - pp) * -40})`)
          pencil.style.opacity = pp
        }
        {
          const a = prog(lt, T.tag, .6) * (1 - clr)
          op(proof, a)
          const gl = .5 + .5 * Math.sin(lt * 2.6)
          proof.style.transform = `translateX(${(1 - E.out(clamp(prog(lt, T.tag, .6)))) * 40}px)`
          proof.style.boxShadow = `0 0 ${18 + 16 * gl * a}px rgba(255,210,63,${(.25 * a).toFixed(2)})`
        }
      },
    }
  }

  const LIB = { PS, PIN, SQ, TH, SP, R, strip, cue, fontsOK, bridgeLine, card1, bridgeUI }

  return {
    LIB,
    build(root, S) {
      this.root = root
      const BR = this.BR = S.lines.length >= 4 ? Math.max(3, bridgeLine(S)) : -1
      const T = this.T = { arr: [], set: [] }
      T.arr[1] = S.at(0) + .05
      T.arr[2] = cue(S, 0, ['ثلاثا', 'أضف'], .14)
      T.set[2] = cue(S, 0, ['أربع'], .4)
      T.arr[3] = Math.max(T.set[2] + .7, cue(S, 0, ['ثم خمسا'], .5))
      T.set[3] = Math.max(T.arr[3] + .7, cue(S, 0, ['تسع'], .63))
      T.arr[4] = Math.max(T.set[3] + .7, cue(S, 0, ['ثم سبعا'], .72))
      T.set[4] = Math.max(T.arr[4] + .7, cue(S, 0, ['ست عشرة', 'ستة عشر'], .85))
      T.set[1] = T.arr[2]
      T.arr[5] = S.at(1) + .25
      T.arr[6] = Math.max(T.arr[5] + .75, cue(S, 1, ['فست', 'وستة', 'ستا'], .17))
      T.arr[7] = Math.max(T.arr[6] + .75, cue(S, 1, ['فتسع', 'وتسعة', 'تسعا'], .3))
      for (let k = 5; k <= 7; k++) T.set[k] = Math.min(T.arr[k] + .85, k < 7 ? T.arr[k + 1] : Infinity)
      T.conj = Math.max(T.set[7] + .3, cue(S, 1, ['فمجموع'], .46))
      T.nLab = Math.max(T.conj + .8, cue(S, 1, ['أول إن'], .55))
      T.q = Math.max(S.at(2) + 1.2, cue(S, 2, ['فكيف', 'كيف'], .37))
      // card ①: big while the question is asked; pinned when the bridge starts (or near the end of line 2)
      T.pin = BR >= 0 ? Math.max(T.q + 1.8, S.end(2) - .3)
        : Math.min(Math.max(cue(S, 2, ['حتى لو'], .78) + .3, T.q + 2.4), S.end(2) - .3)
      this.cx0 = 540; this.cy0 = 590            // square centre during the build-up
      this.cx1 = 960; this.cy1 = 718            // square centre after the zoom-out
      this.sEnd = .32

      // ---------- endless field (pattern that follows the camera) ----------
      const fs = svg(root, 0, 0, W, H)
      const defs = sv(fs, 'defs')
      this.pat = sv(defs, 'pattern', { id: 's01-field', patternUnits: 'userSpaceOnUse', width: SP, height: SP, x: -SP / 2, y: -SP / 2 })
      sv(this.pat, 'circle', { cx: SP / 2, cy: SP / 2, r: R * .55, fill: '#8f9cd8' })
      const rg = sv(defs, 'radialGradient', { id: 's01-fade', cx: this.cx1, cy: this.cy1, r: 1150, gradientUnits: 'userSpaceOnUse' })
      sv(rg, 'stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 1 })
      sv(rg, 'stop', { offset: .5, 'stop-color': '#fff', 'stop-opacity': .5 })
      sv(rg, 'stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })
      const hg = sv(defs, 'radialGradient', { id: 's01-halo' })
      sv(hg, 'stop', { offset: .45, 'stop-color': C.yel, 'stop-opacity': .55 })
      sv(hg, 'stop', { offset: 1, 'stop-color': C.yel, 'stop-opacity': 0 })
      const mask = sv(defs, 'mask', { id: 's01-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H })
      sv(mask, 'rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#s01-fade)' })
      this.field = sv(fs, 'rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#s01-field)', mask: 'url(#s01-mask)' })
      op(this.field, 0)

      // ---------- the dot square (world coords, camera group) ----------
      const s = svg(root, 0, 0, W, H)
      this.g = sv(s, 'g')
      this.outline = sv(this.g, 'rect', { rx: 30, fill: 'none', stroke: C.ink, 'stroke-width': 3, 'stroke-dasharray': '12 10', 'vector-effect': 'non-scaling-stroke' })
      this.sqGlow = sv(this.g, 'rect', { x: -R - 22, y: -6 * SP - R - 22, width: 6 * SP + 2 * R + 44, height: 6 * SP + 2 * R + 44, rx: 40, fill: 'none', stroke: C.yel, 'stroke-width': 3, 'vector-effect': 'non-scaling-stroke', opacity: 0 })
      this.layers = []
      for (let k = 1; k <= NL; k++) {
        const L = layerDots(k).map(([i, j]) => {
          const halo = sv(this.g, 'circle', { cx: i * SP, cy: -j * SP, r: R * 1.9, fill: 'url(#s01-halo)', opacity: 0 })
          const dot = sv(this.g, 'circle', { cx: i * SP, cy: -j * SP, r: 0, fill: C.yel })
          return { dot, halo, i, j }
        })
        this.layers.push(L)
      }
      // screen-space overlay: side-length bracket + label
      this.ov = svg(root, 0, 0, W, H)
      this.brk = sv(this.ov, 'path', { fill: 'none', stroke: C.blu, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      this.side = el('div', 'h3 blu b', '', root); this.side.style.direction = 'ltr'
      this.sideN = tex('n', 'mx'); this.sideN.style.color = C.blu; root.appendChild(this.sideN)
      // "+3", "+5"… flashes at the corner of each new L
      this.flash = []
      for (let k = 2; k <= NL; k++) {
        const e = el('div', 'h3 b', '+' + (2 * k - 1), root)
        e.style.cssText += `direction:ltr;white-space:nowrap;color:${C.yel};text-shadow:0 0 24px rgba(255,210,63,.55)`
        this.flash[k] = e
      }

      // ---------- strip of odd numbers (top-left) ----------
      this.stripBox = el('div', '', null, root)
      place(this.stripBox, 0, 0, { w: W, h: H })
      const lab = rich('الأعداد الطبيعيّة الفرديّة', 's'); lab.style.whiteSpace = 'nowrap'
      this.stripBox.appendChild(lab); place(lab, 975, 205, { anchor: 'cr' })
      const row = el('div', '', null, this.stripBox)
      place(row, 140, 205, { anchor: 'cl' })
      row.style.cssText += 'direction:ltr;display:flex;align-items:baseline;white-space:nowrap'
      const T0 = t => { const e = tex(t, 'mm'); e.style.fontSize = '42px'; e.style.color = C.mut; return e }
      const comma = () => { const e = T0(','); e.style.paddingRight = '12px'; return e }
      this.numTok = {}
      this.ins = {}
      row.appendChild(T0('\\{'))
      for (let k = 1; k <= NL; k++) {
        const v = T0(String(2 * k - 1)); this.numTok[k] = v
        if (k <= 5) { row.appendChild(v); row.appendChild(comma()) } else {
          const wrap = el('div', '', null, row)
          wrap.style.cssText = 'display:flex;align-items:baseline;overflow:hidden;white-space:nowrap'
          wrap.appendChild(v); wrap.appendChild(comma())
          this.ins[k] = wrap
        }
      }
      row.appendChild(T0('\\ldots')); row.appendChild(T0('\\}'))

      // ---------- running sums (right panel, line 0) ----------
      const sums = ['S_1', 'S_2 = 1+\\htmlClass{s01-nw}{3}', 'S_3 = 1+3+\\htmlClass{s01-nw}{5}', 'S_4 = 1+3+5+\\htmlClass{s01-nw}{7}']
      const res = [1, 4, 9, 16]
      this.rows = sums.map((x, i) => {
        const r0 = el('div', '', null, root)
        place(r0, 1080, 340 + i * 124, { anchor: 'cl' })
        r0.style.cssText += 'direction:ltr;display:flex;align-items:baseline;gap:22px;white-space:nowrap'
        const lhs = tex(x, 'mx'); r0.appendChild(lhs)
        const eq = tex('=', 'mx'); r0.appendChild(eq)
        const r = tex(String(res[i]), 'mx'); r0.appendChild(r)
        return { row: r0, lhs, eq, r, nw: i ? lhs.querySelector('.s01-nw') : r }
      })

      // ---------- the book's table (line 1) ----------
      const rowsN = [[tex('n', 'mm')], [tex('S_n', 'mm')]]
      for (let n = 1; n <= 7; n++) { rowsN[0].push(tex(String(n), 'mm')); rowsN[1].push(tex(String(n * n), 'mm')) }
      const tb = table(root, rowsN, 1780, 250, { anchor: 'tr', headCol: true })
      this.tb = tb
      tb.el.style.fontSize = '44px'
      tb.cells.forEach((r, i) => r.forEach((c, j) => {
        const w = (j === 0 ? 110 : 92) + 'px'
        c.style.padding = '12px 0'; c.style.minWidth = w; c.style.width = w
        if (i === 0) c.style.background = j === 0 ? 'rgba(167,139,250,.2)' : 'rgba(167,139,250,.08)'
      }))
      this.tbTag = chip(root, 'استكمل الجدول', 0, 0, { color: C.yel })
      this.tbTag.style.cssText += 'font-size:24px;padding:6px 18px;white-space:nowrap'
      this.conj = tex('S_n = n^2\\ ?', 'mxl')
      this.conj.style.color = C.yel
      root.appendChild(this.conj); place(this.conj, 1406, 610, { anchor: 'c' })

      // ---------- open question ① (big, then pinned top-left) ----------
      const c1 = card1(root)
      this.card = c1.el
      this.cardParts = c1.parts
      this.pinIcon = c1.pin
      this.pinD = { dx: PIN.x - 410, dy: PIN.y - 196 }

      // ---------- book thumbnail (bottom-right; moves beside the square for the bridge) ----------
      const th = bookThumb(root, 6, TH.x0, TH.y0, TH.w0, { x: .11, y: .715, w: .8, h: .1 })
      this.thumb = th.el; this.thumbMark = th.mark
      this.thumb.style.transformOrigin = '0 0'
      this.thumbCap = chip(root, '📖 الكتاب ص 6 — انطلاقة نشطة', 1800, 646, { anchor: 'br' })
      this.thumbCap.style.cssText += 'font-size:24px;white-space:nowrap'

      // ---------- the bridge (last line) ----------
      if (BR >= 0) {
        this.thumbCap2 = chip(root, '📖 الكتاب ص 6', TH.x1 + TH.w1 / 2, TH.y1 + TH.w1 * 1.366 + 14, { anchor: 'tc' })
        this.thumbCap2.style.cssText += 'font-size:24px;white-space:nowrap'
        this.br = bridgeUI(root, S, BR, { h0: T.pin + .8, defMin: 1.6 })
      }
    },

    // measurements that depend on KaTeX glyph metrics (fonts load lazily, so not in build)
    measure() {
      const root = this.root
      this.rows.forEach(r => { r.r.style.transform = '' })
      this.tb.el.style.transform = ''
      this.fly = this.rows.map((r, i) => {
        const a = rectIn(r.r, root), b = rectIn(this.tb.cells[1][i + 1], root)
        return { dx: b.cx - a.cx, dy: b.cy - a.cy }
      })
      const a = rectIn(this.tb.cells[0][7], root), b = rectIn(this.tb.cells[0][5], root)
      place(this.tbTag, (a.x + b.x + b.w) / 2, a.y - 14, { anchor: 'bc' })
      this.insW = {}
      for (const k in this.ins) this.insW[k] = this.ins[k].scrollWidth
      this._ok = fontsOK()
    },

    render(lt, S) {
      if (!this._ok) this.measure()
      const T = this.T, BR = this.BR
      const back = BR >= 0 ? S.p(lt, BR, .1, 1.4, E.io) : 0     // bridge: field → small square on the left
      // ----- camera -----
      let kc = 1
      for (let k = 2; k <= NL; k++) kc += prog(lt, T.arr[k] - .3, .9, E.io)
      const z = S.p(lt, 2, 0, 2.6, E.io)                  // zoom-out progress
      const s0 = Math.min(1.4, 600 / (kc * SP))
      const drift = Math.exp(-.012 * Math.max(0, lt - S.at(2) - 2.6))   // endless field keeps receding
      const sc = lerp(s0 * Math.pow(this.sEnd / s0, z) * drift, SQ.s, back) * (1 + .006 * Math.sin(lt * .9))
      const mx = (kc - 1) * SP / 2, my = -(kc - 1) * SP / 2
      const cx = lerp(lerp(this.cx0, this.cx1, z), SQ.x, back), cy = lerp(lerp(this.cy0, this.cy1, z), SQ.y, back)
      const tr = `translate(${cx} ${cy}) scale(${sc}) translate(${-mx} ${-my})`
      this.g.setAttribute('transform', tr)
      this.pat.setAttribute('patternTransform', tr)
      const X = wx => cx + (wx - mx) * sc, Y = wy => cy + (wy - my) * sc
      op(this.field, .34 * clamp(z * 1.5) * (1 - back))

      // ----- dots -----
      let kSet = 0
      const pulse = BR >= 0 ? env(lt, S.at(BR) + .1, S.at(BR) + 2.4, .4, .8) : 0   // «ما فعلتَه الآن…»
      for (let k = 1; k <= NL; k++) {
        const L = this.layers[k - 1], n = L.length
        const stag = k <= 4 ? Math.min(.09, .55 / n) : Math.min(.05, .4 / n)
        const settle = prog(lt, T.set[k] ?? Infinity, .4, E.io)
        if (lt >= (T.set[k] ?? Infinity)) kSet = k
        L.forEach((d, idx) => {
          const p = prog(lt, T.arr[k] + idx * stag, .5, E.back)
          const pp = clamp(p)
          d.dot.setAttribute('r', p <= 0 ? 0 : R * lerp(.2, 1, p))
          d.dot.style.opacity = clamp(pp * 3)
          const wave = .5 + .5 * Math.sin(lt * 1.7 - (d.i + d.j) * .55)
          const pur = mixColor(C.pur, '#c9bcff', .3 * wave + .5 * pulse)
          d.dot.setAttribute('fill', settle >= 1 ? pur : settle <= 0 ? C.yel : settle < .5 ? mixColor(C.yel, '#fff4d6', settle * 2) : mixColor('#fff4d6', C.pur, settle * 2 - 1))
          d.halo.setAttribute('opacity', clamp(pp * 3) * .8 * (1 - settle))
        })
      }
      this.sqGlow.setAttribute('opacity', pulse * (.6 + .4 * Math.sin(lt * 6)))
      // settle outline flash
      {
        let ko = 0, a = 0
        for (let k = 2; k <= NL; k++) {
          const e = env(lt, T.set[k], T.set[k] + 1.1, .25, .5)
          if (e > a) { a = e; ko = k }
        }
        if (ko) {
          const m = R + 18
          this.outline.setAttribute('x', -m); this.outline.setAttribute('y', -(ko - 1) * SP - m)
          this.outline.setAttribute('width', (ko - 1) * SP + 2 * m); this.outline.setAttribute('height', (ko - 1) * SP + 2 * m)
        }
        this.outline.style.opacity = a * .85 * (1 - z)
      }
      // corner flashes "+3", "+5", …
      for (let k = 2; k <= NL; k++) {
        const e = this.flash[k]
        const pin = prog(lt, T.arr[k] + .1, .45)
        const a = Math.min(pin, 1 - prog(lt, (T.set[k] ?? Infinity) + .3, .4))
        place(e, X((k - 1) * SP) + (R + 18) * sc + 26, Y(-(k - 1) * SP), { anchor: 'cl' })
        op(e, a)
        e.style.transform = `scale(${lerp(.6, 1, E.back(pin))})`
      }
      // side-length bracket + label
      {
        const kb = Math.max(2, kSet)
        const xl = X(0) - R * sc * .9, xr = X((kb - 1) * SP) + R * sc * .9
        const yb = Y(0) + (R + 18) * sc + 18
        this.brk.setAttribute('d', `M${xl},${yb - 10} L${xl},${yb} L${xr},${yb} L${xr},${yb - 10}`)
        const vis = (kSet >= 2 ? 1 : 0) * prog(lt, T.set[2], .4) * (1 - prog(lt, S.at(2), .5))
        this.brk.style.opacity = vis
        const lastSet = T.set[kSet] ?? 0
        this.side.textContent = String(kb)
        place(this.side, (xl + xr) / 2, yb + 36, { anchor: 'c' })
        place(this.sideN, (xl + xr) / 2, yb + 38, { anchor: 'c' })
        const toN = prog(lt, T.nLab, .6)
        op(this.side, vis * (1 - toN))
        this.side.style.transform = `scale(${lerp(1.35, 1, E.out(prog(lt, lastSet, .45)))})`
        op(this.sideN, vis * toN)
        this.sideN.style.transform = `scale(${lerp(.6, 1, E.back(toN))})`
      }

      // ----- strip of odd numbers -----
      {
        const a = prog(lt, S.at(0) + .25, .6), b = S.p(lt, 2, 0, .6)
        op(this.stripBox, a * (1 - b))
        this.stripBox.style.transform = `translateY(${(1 - a) * 16 - b * 20}px)`
        for (const k in this.ins) {
          const w = prog(lt, T.arr[k] - .35, .55)
          this.ins[k].style.width = (this.insW[k] * w) + 'px'
          op(this.ins[k], w)
        }
        for (let k = 1; k <= NL; k++) {
          const o = this.numTok[k]
          const on = prog(lt, T.arr[k], .3), st = prog(lt, (T.set[k] ?? Infinity), .5)
          o.style.color = on <= 0 ? C.mut : st > 0 ? mixColor(C.yel, C.pur, st) : mixColor('#9aa8c9', C.yel, on)
          o.style.textShadow = on > 0 && st < 1 ? `0 0 ${18 * (1 - st)}px rgba(255,210,63,.8)` : 'none'
          o.style.transform = `scale(${1 + .18 * on * (1 - st)})`
        }
      }

      // ----- running sums (line 0) → table (line 1) -----
      const flyP = i => S.p(lt, 1, .15 + i * .12, .8, E.io)
      this.rows.forEach((r, i) => {
        const k = i + 1
        const pin = prog(lt, k === 1 ? T.arr[1] + .3 : T.arr[k] + .15, .55)
        const pres = k === 1 ? pin : prog(lt, T.set[k], .5)
        const out = S.p(lt, 1, 0, .5)
        op(r.lhs, pin * (1 - out)); r.lhs.style.transform = `translateY(${(1 - pin) * 26}px)`
        op(r.eq, pres * (1 - out)); r.eq.style.transform = `translateY(${(1 - pin) * 26}px)`
        const fp = flyP(i)
        op(r.r, fp >= 1 ? 0 : pres)
        r.r.style.transform = `translate(${this.fly[i].dx * fp + (1 - pres) * -24}px, ${this.fly[i].dy * fp + (1 - pin) * 26}px) scale(${lerp(1, 48 / 64, fp)})`
        const st = prog(lt, T.set[k], .5)
        r.nw.style.color = mixColor(C.yel, C.ink, st)
      })
      {
        const tbIn = S.p(lt, 1, 0, .6), tbOut = S.p(lt, 2, 0, .6)
        op(this.tb.el, tbIn * (1 - tbOut))
        this.tb.el.style.transform = `translateY(${(1 - tbIn) * 20 - tbOut * 24}px)`
        const cells = this.tb.cells
        for (let n = 1; n <= 7; n++) {
          const top = cells[0][n], bot = cells[1][n]
          if (n <= 4) {
            top.style.color = C.ink
            bot.style.color = flyP(n - 1) >= 1 ? C.ink : 'transparent'
          } else {
            const p = prog(lt, T.set[n] - .1, .45)
            top.style.color = bot.style.color = C.yel
            top.style.opacity = bot.style.opacity = p
            bot.style.background = `rgba(255,210,63,${(.15 * p).toFixed(3)})`
            bot.style.transform = top.style.transform = `scale(${lerp(1.3, 1, E.out(p))})`
          }
        }
        const tg = prog(lt, T.set[5] - .1, .45) * (1 - tbOut)
        op(this.tbTag, tg); this.tbTag.style.transform = `translateY(${(1 - tg) * 10}px)`
        const cp = prog(lt, T.conj, 1.1, E.io), cOut = S.p(lt, 2, .1, .6)
        wipe(this.conj, cp, 'ltr')
        op(this.conj, 1 - cOut)
        const qm = .5 + .5 * Math.sin(lt * 3)
        this.conj.style.transform = `translateY(${-cOut * 20}px) scale(${1 + .012 * qm * clamp(cp)})`
        this.conj.style.textShadow = `0 0 ${30 + 20 * qm}px rgba(255,210,63,.45)`
      }

      // ----- open question card -----
      {
        const a = prog(lt, T.q, .7, E.out)
        const pp = prog(lt, T.pin, .9, E.io)
        const sc2 = lerp(1, PS, pp)
        this.card.style.transform = `translate(${this.pinD.dx * pp}px, ${this.pinD.dy * pp + (1 - a) * 40}px) scale(${sc2 * lerp(.94, 1, a)})`
        op(this.card, a)
        this.cardParts.forEach((e, i) => op(e, prog(lt, T.q + .25 + i * .35, .5)))
        const glow = (1 - pp) * (.5 + .5 * Math.sin(lt * 2.2))
        const hold = pp * (.5 + .5 * Math.sin(lt * 1.3))
        this.card.style.boxShadow = `0 30px 80px rgba(0,0,0,.35), 0 0 ${40 + 30 * glow - 10 * hold}px rgba(167,139,250,${(.18 + .15 * glow).toFixed(3)})`
        const pi = prog(lt, T.pin + .75, .45)
        op(this.pinIcon, pi)
        this.pinIcon.style.transform = `translateY(${(1 - E.back(pi)) * -30}px) rotate(${(1 - pi) * -30}deg)`
      }
      // ----- thumbnail: bottom-right; for the bridge it moves beside the square and marks the definition paragraph -----
      {
        const a = prog(lt, Math.max(S.at(2) + 1, T.q - .6), .7, E.out)
        const m = BR >= 0 ? S.p(lt, BR, .25, 1.3, E.io) : 0
        op(this.thumb, a)
        this.thumb.style.transform = `translate(${(TH.x1 - TH.x0) * m}px, ${(TH.y1 - TH.y0) * m + (1 - a) * 40}px) scale(${lerp(1, TH.w1 / TH.w0, m)})`
        const c1 = a * (1 - (BR >= 0 ? S.p(lt, BR, 0, .4) : 0))
        op(this.thumbCap, c1); this.thumbCap.style.transform = `translateY(${(1 - a) * 30}px)`
        if (BR >= 0) {
          const hm = S.p(lt, BR, 1.1, .8, E.io)
          this.thumbMark.style.top = (lerp(.715, .37, hm) * 100) + '%'
          this.thumbMark.style.height = (lerp(.1, .115, hm) * 100) + '%'
          const fl = env(lt, this.br.T.def, this.br.T.defEnd + .6, .3, .6)
          this.thumbMark.style.boxShadow = `0 0 ${24 * fl}px rgba(255,210,63,${(.8 * fl).toFixed(2)})`
          this.thumbMark.style.background = `rgba(255,210,63,${(.18 + .17 * fl).toFixed(3)})`
          const c2 = S.p(lt, BR, 1.2, .5)
          op(this.thumbCap2, c2); this.thumbCap2.style.transform = `translateY(${(1 - c2) * 12}px)`
          this.br.render(lt, 0)
        }
      }
    },
  }
})())

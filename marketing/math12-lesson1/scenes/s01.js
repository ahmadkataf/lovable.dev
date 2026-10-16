// s01 — cold open: odd numbers as L-shaped layers of dots building squares; conjecture S_n = n^2; open question ①
scene('s01', (() => {
  const SP = 100, R = 34, NL = 7          // world lattice spacing, dot radius, number of layers
  const strip = s => s.replace(/[ً-ْٰـ]/g, '')
  // scene-local time at which the narrator reaches `needle` in line i (char-proportional estimate)
  function cue(S, i, needle, def = 0, lead = .15) {
    const L = S.lines[i]
    if (!L) return Infinity
    const txt = strip(L.text || ''), k = needle ? txt.indexOf(strip(needle)) : -1
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

  return {
    build(root, S) {
      this.root = root
      const T = this.T = { arr: [], set: [] }
      T.arr[1] = S.at(0) + .05
      T.arr[2] = cue(S, 0, 'أضف', .12)
      T.set[2] = cue(S, 0, 'فتصير أربعا', .4)
      T.arr[3] = Math.max(T.set[2] + .7, cue(S, 0, 'ثم خمسا', .5))
      T.set[3] = Math.max(T.arr[3] + .7, cue(S, 0, 'فتصير تسعا', .63))
      T.arr[4] = Math.max(T.set[3] + .7, cue(S, 0, 'ثم سبعا', .72))
      T.set[4] = Math.max(T.arr[4] + .7, cue(S, 0, 'فتصير ست', .85))
      T.set[1] = T.arr[2]
      T.arr[5] = S.at(1) + .25
      T.arr[6] = Math.max(T.arr[5] + .75, cue(S, 1, 'وستة', .17))
      T.arr[7] = Math.max(T.arr[6] + .75, cue(S, 1, 'وتسعة', .3))
      for (let k = 5; k <= 7; k++) T.set[k] = Math.min(T.arr[k] + .85, k < 7 ? T.arr[k + 1] : Infinity)
      T.conj = Math.max(T.set[7] + .3, cue(S, 1, 'فمجموع', .46))
      T.nLab = Math.max(T.conj + .8, cue(S, 1, 'أول إن', .55))
      T.q = Math.max(S.at(2) + 1.4, cue(S, 2, 'فكيف', .37))
      T.pin = Math.min(Math.max(cue(S, 2, 'حتى لو', .78) + .3, T.q + 2.4), S.end(2) - .3)
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
      const cw = 1100, cx = 410, cy = 196
      const c = card(root, 'def', cx, cy, cw, { tag: '🤔 سؤال مفتوح ①' })
      this.card = c.el
      c.el.style.transformOrigin = '0 0'
      c.el.style.padding = '42px 50px 32px'
      const q = rich('كيف تُثبت صحّة استقرائك إثباتاً رياضياً؟', 'h3'); c.body.appendChild(q)
      const fr = el('div', '', null, c.body)
      fr.style.cssText = 'direction:rtl;display:flex;align-items:baseline;gap:28px;margin-top:14px;white-space:nowrap'
      const ff = tex('1+3+5+\\cdots+(2n-1) = \\textcolor{#ffd23f}{n^2}', 'mx'); ff.style.fontSize = '58px'; fr.appendChild(ff)
      const fq = rich('مهما يكن $n$', 'p'); fq.style.whiteSpace = 'nowrap'; fr.appendChild(fq)
      const nt = rich('العدد الفردي ذو الترتيب $n$ هو $2n-1$', 's'); c.body.appendChild(nt)
      nt.style.color = C.blu; nt.style.fontSize = '38px'; nt.style.marginTop = '10px'
      this.cardParts = [q, fr, nt]
      this.PS = .56
      this.pinD = { dx: 120 - cx, dy: 174 - cy }
      this.pinIcon = el('div', '', '📌', root)
      this.pinIcon.style.cssText += 'font-size:40px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))'
      place(this.pinIcon, 132, 176, { anchor: 'c' })

      // ---------- book thumbnail (bottom-right) ----------
      const th = bookThumb(root, 6, 1580, 664, 220, { x: .11, y: .715, w: .8, h: .1 })
      this.thumb = th.el
      this.thumbCap = chip(root, '📖 الكتاب ص 6 — انطلاقة نشطة', 1800, 646, { anchor: 'br' })
      this.thumbCap.style.cssText += 'font-size:24px;white-space:nowrap'
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
      const T = this.T
      // ----- camera -----
      let kc = 1
      for (let k = 2; k <= NL; k++) kc += prog(lt, T.arr[k] - .3, .9, E.io)
      const z = S.p(lt, 2, 0, 2.6, E.io)                  // zoom-out progress
      const s0 = Math.min(1.4, 600 / (kc * SP))
      const drift = Math.exp(-.012 * Math.max(0, lt - S.at(2) - 2.6))   // endless field keeps receding
      const sc = s0 * Math.pow(this.sEnd / s0, z) * drift * (1 + .006 * Math.sin(lt * .9))
      const mx = (kc - 1) * SP / 2, my = -(kc - 1) * SP / 2
      const cx = lerp(this.cx0, this.cx1, z), cy = lerp(this.cy0, this.cy1, z)
      const tr = `translate(${cx} ${cy}) scale(${sc}) translate(${-mx} ${-my})`
      this.g.setAttribute('transform', tr)
      this.pat.setAttribute('patternTransform', tr)
      const X = wx => cx + (wx - mx) * sc, Y = wy => cy + (wy - my) * sc
      op(this.field, .34 * clamp(z * 1.5))

      // ----- dots -----
      let kSet = 0
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
          const pur = mixColor(C.pur, '#c9bcff', .3 * wave)
          d.dot.setAttribute('fill', settle >= 1 ? pur : settle <= 0 ? C.yel : settle < .5 ? mixColor(C.yel, '#fff4d6', settle * 2) : mixColor('#fff4d6', C.pur, settle * 2 - 1))
          d.halo.setAttribute('opacity', clamp(pp * 3) * .8 * (1 - settle))
        })
      }
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
        const sc2 = lerp(1, this.PS, pp)
        this.card.style.transform = `translate(${this.pinD.dx * pp}px, ${this.pinD.dy * pp + (1 - a) * 40}px) scale(${sc2 * lerp(.94, 1, a)})`
        op(this.card, a)
        this.cardParts.forEach((e, i) => op(e, prog(lt, T.q + .25 + i * .35, .5)))
        const glow = (1 - pp) * (.5 + .5 * Math.sin(lt * 2.2))
        this.card.style.boxShadow = `0 30px 80px rgba(0,0,0,.35), 0 0 ${40 + 30 * glow}px rgba(167,139,250,${(.18 + .15 * glow).toFixed(3)})`
        const pi = prog(lt, T.pin + .75, .45)
        op(this.pinIcon, pi)
        this.pinIcon.style.transform = `translateY(${(1 - E.back(pi)) * -30}px) rotate(${(1 - pi) * -30}deg)`
      }
      // ----- thumbnail -----
      {
        const a = prog(lt, Math.max(S.at(2) + 1, T.q - .6), .7, E.out)
        op(this.thumb, a); this.thumb.style.transform = `translateY(${(1 - a) * 40}px)`
        op(this.thumbCap, a); this.thumbCap.style.transform = `translateY(${(1 - a) * 30}px)`
      }
    },
  }
})())

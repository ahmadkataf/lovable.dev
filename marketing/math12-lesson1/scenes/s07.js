// s07 · بوجه عام — the general recursive definition u_{n+1} = f(u_n) and why f must map D into D
(() => {
  // ---------- local helpers (no globals) ----------
  // scene time at which a phrase of line i is spoken (character position in the narration ≈ time); def = fallback fraction
  const strip = t => t.replace(/[\u064B-\u0652\u0640]/g, '')
  function cue(S, i, needles, def = 0, lead = .15) {
    const L = S.lines[i]
    if (!L) return Infinity
    const txt = strip(L.text || '')
    let k = -1
    for (const n of [].concat(needles || [])) { k = txt.indexOf(strip(n)); if (k >= 0) break }
    const f = k >= 0 ? k / Math.max(1, txt.length) : def
    return Math.max(S.at(i), S.at(i) + f * (S.end(i) - S.at(i)) - lead)
  }
  // smooth closed blob around (cx, cy); t makes it breathe
  function blobPath(cx, cy, rx, ry, t) {
    const n = 14, pts = []
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2
      const k = 1 + .045 * Math.sin(3 * a + 1.3 + t * .3) + .03 * Math.cos(2 * a - .7 - t * .22) + .015 * Math.sin(5 * a + t * .18)
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k])
    }
    const f = v => v.toFixed(1)
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
      d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`
    }
    return d + 'Z'
  }
  // curved arrow between two dot centres; its head rides the drawing tip
  function hop(s, a, b, o = {}) {
    const c = o.color || C.ink, bend = o.bend ?? -.35, w = o.width || 4, gap = o.gap ?? 22
    const [x1, y1] = a, [x2, y2] = b
    const qx = (x1 + x2) / 2 - (y2 - y1) * bend, qy = (y1 + y2) / 2 + (x2 - x1) * bend
    const sh = (px, py, d) => { const dx = qx - px, dy = qy - py, l = Math.hypot(dx, dy) || 1; return [px + dx / l * d, py + dy / l * d] }
    const [sx, sy] = sh(x1, y1, gap), [ex, ey] = sh(x2, y2, gap + 4)
    const g = sv(s, 'g')
    const p = sv(g, 'path', { d: `M${sx},${sy} Q${qx},${qy} ${ex},${ey}`, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round' })
    const h = sv(g, 'path', { d: 'M6,0 L-13,-9 L-13,9 Z', fill: c })
    const L = p.getTotalLength()
    p.style.strokeDasharray = L
    return {
      mid: [(sx + 2 * qx + ex) / 4, (sy + 2 * qy + ey) / 4],
      set(q, alpha = 1) {
        q = clamp(q)
        p.style.strokeDashoffset = L * (1 - q)
        g.style.opacity = q > 0 ? alpha : 0
        const pt = p.getPointAtLength(L * q), pb = p.getPointAtLength(Math.max(0, L * q - 3))
        h.setAttribute('transform', `translate(${pt.x},${pt.y}) rotate(${Math.atan2(pt.y - pb.y, pt.x - pb.x) * 180 / Math.PI})`)
        h.style.opacity = q > .04 ? 1 : 0
      },
    }
  }
  const dot = (s, x, y, r, fill) => sv(s, 'circle', { cx: x, cy: y, r, fill })
  const setDot = (c, p, x, y) => { c.style.opacity = clamp(p * 2); c.style.transformOrigin = `${x}px ${y}px`; c.style.transform = `scale(${p <= 0 ? 0 : lerp(.2, 1, E.back(clamp(p)))})` }
  const lab = (root, latex, x, y, cls, anchor = 'c') => { const e = tex(latex, cls); root.appendChild(e); place(e, x, y, { anchor }); return e }
  // highlight frame that follows its target through layout (no build-time measuring: KaTeX fonts may not be loaded yet)
  function frame(target, o = {}) {
    const pad = o.pad ?? 14
    const wrap = document.createElement('span')
    wrap.style.cssText = 'position:relative;display:inline-block'
    target.parentNode.insertBefore(wrap, target); wrap.appendChild(target)
    const b = el('div', 'hlbox', null, wrap)
    b.style.cssText += `left:${-pad}px;top:${-pad}px;right:${-pad}px;bottom:${-pad}px`
    op(b, 0)
    return p => { op(b, clamp(p * 1.5)); b.style.transform = `scale(${lerp(1.15, 1, E.out(clamp(p)))})` }
  }

  scene('s07', {
    build(root, S) {
      this.F = (i, fr) => S.at(i) + fr * (S.end(i) - S.at(i))   // scene time at a fraction of line i
      // beats of lines 2–3, cued to the words of the final narration
      this.T = {
        take: cue(S, 2, 'خذ التابع', .38), root: cue(S, 2, 'جذر إكس', .47), minus: cue(S, 2, 'منه واحد', .62),
        let0: cue(S, 2, 'وليكن', .71), start: cue(S, 2, 'حد البدء', .76), u0: cue(S, 2, ['يو صفر يساوي', 'يو صفر'], .84), zero: cue(S, 2, 'يساوي صفرا', .9),
        neg: cue(S, 3, 'سالب واحد', .14), out: cue(S, 3, 'وهو خارج', .31), noRoot: cue(S, 3, 'فلا جذر', .51), real: cue(S, 3, 'حقيقيا', .63),
        jam: cue(S, 3, 'وتتعطل', .8),
      }
      this.head = heading(root, 'العلاقة التدريجيّة $u_{n+1} = f(u_n)$')

      // ================= phase 1: the general statement (lines 0–1) =================
      const c = card(root, 'tip', 1800, 300, 920, { anchor: 'tr' })
      this.card = c.el
      this.t1 = rich('<span class="pur b">بوجه عام،</span> إذا كان $f$ تابعاً معرّفاً على المجموعة $D$، وتحقّق الشرط:', 'p')
      c.body.appendChild(this.t1); splitWords(this.t1)
      this.cond = rich('مهما يكن العدد $x$ من $D$ يكن $f(x)$ عنصراً من $D$ أيضاً', 'h3 yel b')
      this.cond.style.cssText += `font-size:42px;padding:12px 24px;border-radius:14px;background:rgba(255,210,63,.08);border-right:6px solid ${C.yel}`
      this.cw = el('div', '', null, c.body); this.cw.style.overflow = 'hidden'
      this.cwIn = el('div', '', null, this.cw); this.cwIn.style.paddingTop = '16px'
      this.cwIn.appendChild(this.cond); splitWords(this.cond)
      this.more = el('div', '', null, c.body); this.more.style.overflow = 'hidden'
      this.moreIn = el('div', '', null, this.more); this.moreIn.style.paddingTop = '20px'
      this.t2 = rich('أمكننا تعريف متتالية $(u_n)_{n\\ge0}$، بإعطاء حدّ البدء $u_0$ من المجموعة $D$، والعلاقة التدريجيّة', 'p')
      this.moreIn.appendChild(this.t2); splitWords(this.t2)
      const relRow = el('div', 'ctr', null, this.moreIn); relRow.style.padding = '18px 0 16px'
      this.rel = tex('u_{n+1} = f(u_n)', 'mx'); relRow.appendChild(this.rel)
      this.rel.style.color = C.yel
      this.relBox = frame(this.rel, { pad: 14 })

      // region D (left)
      const s = svg(root, 0, 0, W, H)
      this.blobGlow = sv(s, 'path', { d: blobPath(480, 620, 330, 270, 0), fill: 'none', stroke: C.pur, 'stroke-width': 18 })
      this.blob = sv(s, 'path', { d: blobPath(480, 620, 330, 270, 0), fill: 'rgba(167,139,250,.13)', stroke: C.pur, 'stroke-width': 4 })
      this.Dlab = lab(root, 'D', 182, 366, 'ml pur')

      // line 0: x ↦ f(x) inside D, then faint arrows for "whatever x"
      this.px = [330, 690]; this.pfx = [600, 520]
      this.ghosts = [[[250, 560], [410, 450]], [[450, 815], [660, 790]], [[700, 720], [730, 520]]].map(([a, b]) => ({
        h: hop(s, a, b, { color: C.mut, width: 3, bend: -.3, gap: 13 }), da: dot(s, a[0], a[1], 7, C.mut), db: dot(s, b[0], b[1], 7, C.mut),
      }))
      this.hx = hop(s, this.px, this.pfx, { color: C.yel, width: 5, bend: -.38 })
      this.dx = dot(s, ...this.px, 13, C.ink)
      this.dfx = dot(s, ...this.pfx, 13, C.yel)
      this.lx = lab(root, 'x', this.px[0], this.px[1] + 48, 'mm')
      this.lfx = lab(root, 'f(x)', this.pfx[0] + 18, this.pfx[1] - 52, 'mm yel')
      this.lf = lab(root, 'f', this.hx.mid[0] - 30, this.hx.mid[1] - 26, 'ms mute')

      // line 1: u0 → u1 → u2 → u3 → u4 → … spiralling, never leaving D
      this.U = [[302, 700], [385, 498], [602, 478], [705, 685], [497, 782]]
      const LO = [[0, 50], [-6, -50], [10, -50], [52, 4], [0, 50]]
      this.ud = this.U.map(([x, y]) => dot(s, x, y, 13, C.yel))
      this.ul = this.U.map(([x, y], k) => lab(root, `u_${k}`, x + LO[k][0], y + LO[k][1], 'mm yel'))
      this.uh = [0, 1, 2, 3].map(k => hop(s, this.U[k], this.U[k + 1], { color: C.yel, width: 4, bend: -.28 }))
      const FO = [[-32, -14], [0, -30], [32, 0], [8, 32]]
      this.uf = this.uh.map((h, k) => lab(root, 'f', h.mid[0] + FO[k][0], h.mid[1] + FO[k][1], 'ms mute'))
      this.dots3 = lab(root, '\\cdots', 410, 690, 'mm yel')
      this.ring = sv(s, 'circle', { cx: 0, cy: 0, r: 13, fill: 'none', stroke: C.yel, 'stroke-width': 3 })
      this.never = chip(root, '', 480, 945, { anchor: 'c', color: C.pur })
      this.never.appendChild(rich('كلّ الحدود تبقى داخل $D$', ''))
      this.never.style.fontSize = '30px'

      // ================= phase 2: why the condition? (lines 2–3) =================
      const s2 = svg(root, 0, 0, W, H)
      s2.style.direction = 'ltr'
      // number line with D = [0, +∞[
      const nx = v => 420 + v * 105, NY = 856
      this.nx = nx; this.NY = NY
      this.nl = sv(s2, 'g')
      sv(this.nl, 'path', { d: `M150,${NY} L980,${NY}`, stroke: C.mut, 'stroke-width': 3, fill: 'none' })
      sv(this.nl, 'path', { d: `M972,${NY - 9} L988,${NY} L972,${NY + 9}`, stroke: C.mut, 'stroke-width': 3, fill: 'none', 'stroke-linejoin': 'round' })
      for (let v = -2; v <= 5; v++) sv(this.nl, 'path', { d: `M${nx(v)},${NY - 10} L${nx(v)},${NY + 10}`, stroke: C.mut, 'stroke-width': 3 })
      this.outside = sv(s2, 'rect', { x: 150, y: NY - 16, width: nx(0) - 150 - 8, height: 32, rx: 6, fill: C.red, opacity: 0 })
      this.band = sv(s2, 'g')
      sv(this.band, 'rect', { x: nx(0), y: NY - 16, width: 975 - nx(0), height: 32, rx: 6, fill: 'rgba(167,139,250,.28)' })
      sv(this.band, 'path', { d: `M${nx(0) + 12},${NY - 26} L${nx(0)},${NY - 26} L${nx(0)},${NY + 26} L${nx(0) + 12},${NY + 26}`, stroke: C.pur, 'stroke-width': 6, fill: 'none', 'stroke-linejoin': 'round' })
      this.nlab = [-2, -1, 0, 1, 2, 3, 4, 5].map(v => lab(root, String(v), nx(v), NY + 42, 'ms mute'))
      this.nlab.forEach(e => (e.style.fontSize = '30px'))
      this.bandLab = lab(root, 'D = [0,+\\infty[', 770, NY - 60, 'mm pur')
      this.n0 = dot(s2, nx(0), NY, 13, C.yel)
      this.n1 = dot(s2, nx(-1), NY, 13, C.red)
      this.nh = hop(s2, [nx(0), NY], [nx(-1), NY], { color: C.red, width: 5, bend: .55, gap: 14 })
      this.nu0 = lab(root, 'u_0', nx(0), NY + 88, 'mm yel')
      this.nu1 = lab(root, 'u_1', nx(-1), NY + 88, 'mm red')
      // «outside D» sits above the pink part of the line, clear of the u-labels
      this.outLab = el('div', 's red b', null, root)
      this.outLab.appendChild(rich('خارج $D$', ''))
      place(this.outLab, 232, NY - 50, { anchor: 'c' }); this.outLab.style.whiteSpace = 'nowrap'; this.outLab.style.fontSize = '30px'

      // the machine and its output → input loop pipe
      const MX = 520, MY = 520
      this.M = { x: MX, y: MY }
      const pipeD = `M${MX},675 L${MX},700 Q${MX},740 ${MX + 40},740 L${MX + 300},740 Q${MX + 340},740 ${MX + 340},700 L${MX + 340},345 Q${MX + 340},305 ${MX + 300},305 L${MX + 40},305 Q${MX},305 ${MX},345 L${MX},372`
      this.pipes = [
        sv(s2, 'path', { d: pipeD, fill: 'none', stroke: 'rgba(167,139,250,.55)', 'stroke-width': 30, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
        sv(s2, 'path', { d: pipeD, fill: 'none', stroke: '#131a3a', 'stroke-width': 24, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      ]
      this.pipeIn = sv(s2, 'path', { d: pipeD, fill: 'none', stroke: 'rgba(167,139,250,.22)', 'stroke-width': 8, 'stroke-linecap': 'round' })
      this.pipes.push(this.pipeIn)
      this.pipeGlow = sv(s2, 'path', { d: pipeD, fill: 'none', stroke: C.yel, 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-dasharray': '46 150', opacity: 0 })
      this.pipeLen = this.pipeIn.getTotalLength()
      this.pipeLab = el('div', 's', 'كلّ مخرَجٍ يعود مُدخَلاً', root)
      place(this.pipeLab, MX + 170, 250, { anchor: 'c' }); this.pipeLab.style.whiteSpace = 'nowrap'; this.pipeLab.style.fontSize = '30px'
      // value cards (drawn under the machine so they disappear into it)
      const mkCard = (txt, fill) => {
        const g = sv(s2, 'g')
        sv(g, 'rect', { x: -42, y: -27, width: 84, height: 54, rx: 12, fill, stroke: 'rgba(0,0,0,.25)', 'stroke-width': 2 })
        const t = sv(g, 'text', { x: 0, y: 12, 'text-anchor': 'middle', fill: '#0b1020', 'font-size': 34, 'font-family': 'KaTeX_Main', 'font-weight': 700 })
        t.textContent = txt
        return g
      }
      this.card0 = mkCard('0', C.yel)
      this.cardM = mkCard('−1', C.red)
      // machine body
      this.mach = sv(s2, 'g')
      const defs = sv(this.mach, 'defs')
      const gr = sv(defs, 'linearGradient', { id: 's07-mg', x1: 0, y1: 0, x2: 0, y2: 1 })
      sv(gr, 'stop', { offset: 0, 'stop-color': '#3b2d86' }); sv(gr, 'stop', { offset: 1, 'stop-color': '#21184f' })
      sv(this.mach, 'path', { d: `M${MX - 72},372 L${MX + 72},372 L${MX + 30},432 L${MX - 30},432 Z`, fill: '#2c2268', stroke: C.pur, 'stroke-width': 3, 'stroke-linejoin': 'round' })
      sv(this.mach, 'rect', { x: MX - 26, y: 600, width: 52, height: 75, rx: 6, fill: '#2c2268', stroke: C.pur, 'stroke-width': 3 })
      sv(this.mach, 'rect', { x: MX - 210, y: 430, width: 420, height: 180, rx: 30, fill: 'url(#s07-mg)', stroke: C.pur, 'stroke-width': 4 })
      sv(this.mach, 'rect', { x: MX - 180, y: 462, width: 360, height: 116, rx: 18, fill: 'rgba(8,12,28,.85)', stroke: 'rgba(167,139,250,.55)', 'stroke-width': 2 })
      this.redWin = sv(this.mach, 'rect', { x: MX - 180, y: 462, width: 360, height: 116, rx: 18, fill: C.red, opacity: 0 })
      this.mach.style.filter = 'drop-shadow(0 0 26px rgba(124,58,237,.45))'
      this.winF = lab(root, 'f', MX, MY, 'ml pur')
      this.winX = lab(root, 'f(x) = \\sqrt{x} - 1', MX, MY + 2, 'mm')
      this.xBadge = el('div', '', '✗', root)
      place(this.xBadge, MX + 210, 440, { anchor: 'c', w: 84, h: 84 })
      this.xBadge.style.cssText += `border-radius:50%;background:${C.red};color:#0b1020;font-size:54px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 0 40px ${C.red}aa`
      this.jam = el('div', 'h3 red b', 'تعطّلت الآلة!', root)
      place(this.jam, 320, 690, { anchor: 'c' }); this.jam.style.whiteSpace = 'nowrap'

      // right column: warning card, the two computations, the take-away
      const w = card(root, 'warn', 1800, 300, 740, { anchor: 'tr', tag: '⚠️ مثال توضيحي (من خارج الكتاب)' })
      this.warn = w.el
      this.wf = tex('f(x) = \\sqrt{x} - 1', 'mx')
      const r1 = el('div', 'ctr', null, w.body); r1.appendChild(this.wf)
      this.wD = rich('معرّف على $D = [0,+\\infty[$', 'p ctr'); w.body.appendChild(this.wD)
      this.wD.style.marginTop = '4px'
      this.wu = rich('حدّ البدء: $u_0 = 0$', 'p ctr'); w.body.appendChild(this.wu)
      this.wu.querySelector('bdi').style.color = C.yel

      this.st1w = el('div', '', null, root)
      place(this.st1w, 1430, 642, { anchor: 'c' })
      this.st1w.style.cssText += 'direction:ltr;display:flex;align-items:baseline;white-space:nowrap'
      this.st1 = tex(`u_1 = \\sqrt{0} - 1 = \\textcolor{${C.red}}{-1}`, 'mx'); this.st1w.appendChild(this.st1)
      this.st1b = tex(`\\textcolor{${C.red}}{\\;\\notin D}`, 'mx'); this.st1w.appendChild(this.st1b)
      this.st2w = el('div', '', null, root)
      place(this.st2w, 1430, 738, { anchor: 'c' })
      this.st2w.style.position = 'absolute'
      this.st2 = tex('u_2 = \\sqrt{-1} - 1', 'mx'); this.st2w.appendChild(this.st2)
      this.strike = el('div', '', null, this.st2w)
      this.strike.style.cssText = `position:absolute;left:-16px;right:-16px;top:50%;height:7px;margin-top:-3px;background:${C.red};border-radius:4px;transform-origin:0 50%;box-shadow:0 0 14px ${C.red}`
      this.st2x = rich('✗ لا جذر لعددٍ سالب', 's red b')
      root.appendChild(this.st2x); place(this.st2x, 1430, 806, { anchor: 'c' }); this.st2x.style.whiteSpace = 'nowrap'

      this.cap = el('div', '', null, root)
      place(this.cap, 1800, 962, { anchor: 'br' })
      this.cap.style.cssText += `white-space:nowrap;padding:14px 34px;border-radius:22px;border:3px solid ${C.yel};background:rgba(255,210,63,.08);box-shadow:0 0 40px ${C.yel}33`
      this.cap.appendChild(rich('الشرط يضمن أن يبقى كلّ حدٍّ في $D$', 'h3 ctr'))
      this.cap.firstChild.style.fontSize = '40px'
    },

    render(lt, S) {
      const F = this.F
      this.head.set(S.p(lt, 0, 0, .7))

      // ---------- phase 1 ----------
      const out1 = 1 - S.p(lt, 2, 0, .6)              // phase 1 leaves when line 2 starts
      rise(this.card, S.p(lt, 0, .15, .6) * out1)
      typeWords(this.t1, S.f(lt, 0, .02, .36))
      this.t1.style.opacity = lerp(1, .5, S.p(lt, 1, 0, .6))
      const cg = prog(lt, F(0, .38), .6)
      this.cw.style.height = (cg * this.cwIn.offsetHeight) + 'px'
      this.cw.style.overflow = cg >= 1 ? 'visible' : 'hidden'
      this.cond.style.opacity = cg
      typeWords(this.cond, S.f(lt, 0, .4, .92))
      // the card grows with the text: first the sentence, then the room for the framed relation
      const grow = S.p(lt, 1, 0, .8), grow2 = prog(lt, F(1, .46), .7)
      const hT = this.t2.offsetHeight + 20, hAll = this.moreIn.offsetHeight
      this.more.style.height = (grow * hT + grow2 * (hAll - hT)) + 'px'
      this.more.style.overflow = grow2 >= 1 ? 'visible' : 'hidden'   // so the framed relation's glow is not clipped
      typeWords(this.t2, S.f(lt, 1, .03, .5))
      wipe(this.rel, prog(lt, F(1, .5), .9), 'ltr')
      this.relBox(prog(lt, F(1, .78), .5))

      // region D breathes gently
      const bp = prog(lt, F(0, .28), .9, E.out) * out1
      const dB = blobPath(480, 620, 330, 270, lt)
      this.blob.setAttribute('d', dB); this.blobGlow.setAttribute('d', dB)
      this.blob.style.opacity = bp
      this.blob.style.transformOrigin = '480px 620px'; this.blob.style.transform = `scale(${lerp(.85, 1, bp)})`
      this.blobGlow.style.transformOrigin = '480px 620px'; this.blobGlow.style.transform = `scale(${lerp(.85, 1, bp)})`
      this.blobGlow.style.opacity = bp * (.1 + .06 * Math.sin(lt * 1.3))
      pop(this.Dlab, prog(lt, F(0, .34), .6) * out1)

      // line 0: x ↦ f(x) inside D, then "whatever x"
      const out0 = 1 - S.p(lt, 1, 0, .5)
      const px = prog(lt, F(0, .5), .5) * out0, pfx = prog(lt, F(0, .8), .45) * out0
      setDot(this.dx, px, ...this.px); op(this.lx, px)
      this.hx.set(prog(lt, F(0, .6), .7), out0)
      setDot(this.dfx, pfx, ...this.pfx); rise(this.lfx, pfx, 14)
      op(this.lf, prog(lt, F(0, .7), .5) * out0)
      this.ghosts.forEach((g, k) => {
        const t0 = F(0, .9) + k * .3
        g.da.style.opacity = prog(lt, t0, .35) * out0 * .8
        g.h.set(prog(lt, t0 + .15, .55), .7 * out0)
        g.db.style.opacity = prog(lt, t0 + .6, .3) * out0 * .8
      })

      // line 1: u0 → u1 → u2 → u3 → u4 → … (hops follow the words «يو إنْ زائد واحد يساوي…»)
      const ht = [F(1, .2), F(1, .5), F(1, .63), F(1, .76), F(1, .88)]
      this.ud.forEach((d, k) => setDot(d, (k === 0 ? prog(lt, ht[0], .5) : prog(lt, ht[k] + .45, .35)) * out1, ...this.U[k]))
      this.ul.forEach((e, k) => rise(e, (k === 0 ? prog(lt, ht[0] + .1, .5) : prog(lt, ht[k] + .5, .4)) * out1, 12))
      this.uh.forEach((h, k) => h.set(prog(lt, ht[k + 1] - .1, .6), out1))
      this.uf.forEach((e, k) => op(e, prog(lt, ht[k + 1] + .2, .4) * out1))
      op(this.dots3, prog(lt, ht[4] + .8, .5) * out1)
      // the newest term pulses (gentle life during holds)
      const k = lt < ht[1] + .5 ? 0 : lt < ht[2] + .5 ? 1 : lt < ht[3] + .5 ? 2 : lt < ht[4] + .5 ? 3 : 4
      const ph = (lt * .8) % 1
      this.ring.setAttribute('cx', this.U[k][0]); this.ring.setAttribute('cy', this.U[k][1])
      this.ring.setAttribute('r', 13 + ph * 26); this.ring.style.opacity = prog(lt, ht[0] + .3, .3) * out1 * (1 - ph) * .9
      rise(this.never, prog(lt, ht[4] + 1, .6) * out1, 16)

      // ---------- phase 2 ----------
      const T = this.T
      const mIn = S.p(lt, 2, .35, .7)                     // «ولماذا هذا الشرط؟» the machine
      this.mach.style.opacity = mIn
      const tj = T.jam                                    // «وتتعطّل الآلة»: the machine jams
      const sk = lt > tj ? Math.exp(-(lt - tj) * 3.2) * Math.sin((lt - tj) * 55) * 12 * (1 - prog(lt, tj + 1.4, .1)) : 0
      this.mach.style.transformOrigin = `${this.M.x}px ${this.M.y}px`
      this.mach.style.transform = `translate(${sk}px, 0) scale(${lerp(.9, 1, E.out(mIn))})`
      // «لأنّ كلّ مُخرَجٍ يعود مُدخَلاً»: the output → input pipe is drawn, then glows
      const tPipe = Math.max(S.at(2) + .6, cue(S, 2, 'كل مخرج', .2, .3))
      const pd = prog(lt, tPipe, 1.1)
      this.pipes.forEach(p => draw(p, pd))
      const gOn = prog(lt, tPipe + .8, .6)
      this.pipeGlow.style.opacity = gOn * (.8 + .2 * Math.sin(lt * 3))
      this.pipeGlow.style.strokeDashoffset = -lt * 150
      const bad = prog(lt, S.at(3) + .2, .4)
      this.pipeGlow.style.stroke = mixColor(C.yel, C.red, bad)
      this.pipeGlow.style.filter = `drop-shadow(0 0 8px ${bad > .5 ? 'rgba(255,92,138,.9)' : 'rgba(255,210,63,.9)'})`
      rise(this.pipeLab, prog(lt, tPipe + .3, .6) * (1 - prog(lt, T.out, .4)), 12)

      // window: f → f(x) = √x − 1 («جذر إكس، مطروحاً منه واحد»), then red when jammed
      const wsw = prog(lt, T.root + .4, .6)
      op(this.winF, mIn * (1 - wsw))
      op(this.winX, mIn * wsw)
      this.redWin.style.opacity = prog(lt, tj, .35) * (.28 + .1 * Math.sin(lt * 6))
      this.winX.style.transform = `translate(${sk}px,0)`
      pop(this.xBadge, prog(lt, tj + .1, .5))
      this.xBadge.style.translate = `calc(-50% + ${sk}px) -50%`
      rise(this.jam, prog(lt, tj + .3, .5), 14)

      // u0 = 0 («وليكن حدّ البدء يو صفر يساوي صفراً») rides the last stretch of the pipe into the funnel and sinks in
      const L = this.pipeLen
      const c0s = Math.min(T.u0, S.at(3) - 1.5)
      const c0t = prog(lt, c0s + .1, .9, E.io)
      const c0in = prog(lt, c0s + 1, .5, E.in)
      if (lt < c0s || c0in >= 1) this.card0.style.opacity = 0
      else {
        const p = this.pipeIn.getPointAtLength(lerp(L - 300, L, c0t))
        this.card0.style.opacity = prog(lt, c0s, .3)
        this.card0.setAttribute('transform', `translate(${p.x},${p.y + c0in * 110})`)
      }
      // −1 comes out («تحصل على سالب واحد»), rides the pipe all the way round and gets stuck in the input («فلا جذر…»)
      const r0 = S.at(3) + .55, r1 = Math.max(r0 + .8, T.noRoot - .1)
      const cOut = prog(lt, S.at(3), .5, E.out)
      const cRide = prog(lt, r0, r1 - r0, E.io)
      const cIn = prog(lt, r1, .4, E.in)
      if (lt < S.at(3)) this.cardM.style.opacity = 0
      else {
        let x, y
        if (cRide <= 0) { x = this.M.x; y = lerp(560, 690, cOut) }
        else { const p = this.pipeIn.getPointAtLength(lerp(15, L - 40, cRide)); x = p.x; y = p.y + cIn * 6 }
        this.cardM.style.opacity = 1
        this.cardM.setAttribute('transform', `translate(${x + sk},${y})`)
      }

      // number line D = [0,+∞[ and the escaping hop
      const nlp = prog(lt, T.let0, .7)
      this.nl.style.opacity = nlp
      this.nlab.forEach(e => op(e, nlp))
      this.band.style.opacity = prog(lt, T.let0 + .3, .6)
      rise(this.bandLab, prog(lt, T.let0 + .3, .6), 12)
      setDot(this.n0, prog(lt, T.zero, .5), this.nx(0), this.NY)
      rise(this.nu0, prog(lt, T.zero + .1, .5), 10)
      const th = T.neg                                    // «سالب واحد»: the hop lands on −1
      this.nh.set(prog(lt, th, .7))
      setDot(this.n1, prog(lt, th + .6, .4), this.nx(-1), this.NY)
      rise(this.nu1, prog(lt, th + .7, .4), 10)
      rise(this.outLab, prog(lt, T.out, .4), 10)          // «وهو خارج دي»
      this.outside.setAttribute('opacity', prog(lt, T.out, .4) * (.22 + .1 * Math.sin(lt * 5)))

      // right column
      rise(this.warn, prog(lt, T.take, .6))               // «خذ التابع»
      wipe(this.wf, prog(lt, T.root, .9), 'ltr')
      rise(this.wD, prog(lt, T.minus + .4, .5), 12)
      rise(this.wu, prog(lt, T.start, .5), 12)            // «وليكن حدّ البدء يو صفر يساوي صفراً»
      wipe(this.st1, prog(lt, S.at(3) + .05, .9), 'ltr')
      pop(this.st1b, prog(lt, T.out, .5))
      wipe(this.st2, prog(lt, T.noRoot, .7), 'ltr')       // «فلا جذرَ حقيقيّاً له»
      const stP = prog(lt, T.real, .45)
      op(this.strike, stP > 0 ? 1 : 0); this.strike.style.transform = `scaleX(${stP})`
      rise(this.st2x, prog(lt, T.real + .3, .5), 14)
      pop(this.cap, prog(lt, tj + .6, .6))
    },
  })
})()

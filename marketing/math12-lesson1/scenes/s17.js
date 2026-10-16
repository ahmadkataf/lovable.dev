// s17 · برهان المطابقة — the proof as a short algebra animation.
// L0: the two easy cases (x = a, x = 0) checked in two boxes.
// L1: q = a/x substituted into 1 + q + … + q^{n-1} = (1-q^n)/(1-q): every q morphs into a yellow a/x; why it is allowed.
// L2: left side becomes powers a^k/x^k; right side simplified step by step (the steps the book skips) → the book's line.
// L3: both sides × x^{n-1}(x-a): every term flies down and loses its denominator; the sides swap into the boxed identity.
// Formula states are full KaTeX formulas cut into \htmlId pieces; a "FLIP" morph moves each piece from its place in one
// state to its place in the next while cross-fading the content (positions are measured in _layout()).
scene('s17', {
  build(root, S) {
    const Y = C.yel, P = C.pur, G = C.grn, B = C.blu
    const col = (c, s) => `\\textcolor{${c}}{${s}}`
    const $ = k => document.getElementById('s17-' + k)
    const kt = s => katex.renderToString(s, KOPT)
    const pcs = (pf, parts) => parts.map((s, k) => `\\htmlId{s17-${pf}${k}}{${s}}`).join('')
    const getP = (pf, n) => Array.from({ length: n }, (_, k) => { const e = $(pf + k); e.style.display = 'inline-block'; return e })
    const mk = (src, parent, x, y, fs, anchor = 'c') => { const e = tex(src, 'mx'); e.style.fontSize = fs + 'px'; parent.appendChild(e); place(e, x, y, { anchor }); return e }
    const quote = (html, y) => {
      const t = rich(html, 'p'); root.appendChild(t); place(t, 1770, y, { anchor: 'tr', w: 1600 })
      const bar = el('div', '', null, root)
      bar.style.cssText += `position:absolute;left:1794px;width:6px;border-radius:3px;background:${Y}88;transform-origin:50% 0`
      return { t, bar, y }
    }
    this.root = root
    this.head = heading(root, 'برهان المطابقة')

    // ================= L0: the goal and the two easy cases =================
    this.goal = mk('x^n - a^n \\overset{?}{=} (x-a)\\left(x^{n-1} + x^{n-2}a + \\cdots + a^{n-1}\\right)', root, 960, 336, 54)
    const mkCase = (x, anchor, cond, rows) => {
      const c = card(root, 'exam', x, 436, 800, { anchor, tag: `الحالة&nbsp; ${kt(cond)}`, h: 372 })
      c.el.querySelector('.tag').style.fontSize = '30px'
      const rs = rows.map(([html, cls]) => { const r = rich(html, cls || 'p'); c.body.appendChild(r); r.style.lineHeight = 1.45; r.style.marginBottom = '6px'; return r })
      const box = el('div', '', '✓', c.el)
      box.style.cssText = `position:absolute;left:30px;top:-24px;width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:900;color:#0b1020;background:${G};box-shadow:0 0 24px ${G}88`
      return { el: c.el, rows: rs, box }
    }
    this.caseA = mkCase(1800, 'tr', 'x = a', [
      ['اليسار: $a^n - a^n = 0$'],
      ['اليمين: $(a-a)\\,(\\cdots) = 0 \\times (\\cdots) = 0$'],
      ['<span class="grn b">الطرفان معدومان ⇐ متساويان</span>'],
    ])
    this.caseB = mkCase(120, 'tl', 'x = 0', [
      ['اليسار: $0 - a^n = -a^n$'],
      [`اليمين: $(0-a)\\,(0 + 0 + \\cdots + ${col(Y, 'a^{n-1}')})$`],
      ['$= (-a)\\cdot a^{n-1} = -a^n$'],
      [`لا يبقى في القوس إلّا الحدّ الأخير $${col(Y, 'a^{n-1}')}$`, 's'],
      ['<span class="grn b">الطرفان متساويان</span>'],
    ])
    this.caseB.rows[3].style.color = C.mut
    this.q0 = quote('المساواة واضحة في حالة $x = a$ أو $x = 0$', 870)

    // ================= L1: substitution =================
    // rail (top-left, filled right → left): what is already settled
    this.rail = el('div', '', null, root); place(this.rail, 1250, 192, { anchor: 'cr' })
    this.rail.style.cssText += 'display:flex;gap:14px;direction:rtl;align-items:center'
    const rchip = (html, c) => { const e = el('div', 'chip', html, this.rail); e.style.cssText += `border-color:${c}88;background:${c}1c;color:${c};font-size:28px;padding:7px 20px`; return e }
    this.rc = [rchip(`✓ ${kt('x = a')}`, G), rchip(`✓ ${kt('x = 0')}`, G), rchip(kt('x \\ne 0'), B), rchip(kt('x \\ne a'), Y)]
    this.sub = rich(`نعوّض &nbsp;$q = ${col(Y, '\\dfrac{a}{x}')}$`, 'h3'); root.appendChild(this.sub)
    place(this.sub, 960, 296, { anchor: 'c' })
    this.sub.style.cssText += `padding:6px 34px;border-radius:999px;border:2.5px solid ${Y}99;background:rgba(255,210,63,.08);white-space:nowrap`

    // Row 1: the main equation, in four states (A: q · B: a/x · C: powers · D: the book's line)
    this.R1Y = 452; this.R1UP = -92
    this.r1 = el('div', '', null, root); place(this.r1, 0, 0, { w: W, h: H })
    const Yf = col(Y, '\\frac{a}{x}')
    const sA = ['1', '{}+{}', 'q', '{}+{}', 'q^2', '{}+{}', '\\cdots', '{}+{}', 'q^{n-1}', '{}={}', '\\dfrac{1-q^n}{1-q}']
    const sB = ['1', '{}+{}', Yf, '{}+{}', `\\left(${Yf}\\right)^2`, '{}+{}', '\\cdots', '{}+{}', `\\left(${Yf}\\right)^{n-1}`, '{}={}', `\\dfrac{1-\\left(${Yf}\\right)^n}{1-${Yf}}`]
    const sC = ['1', '{}+{}', '\\dfrac{a}{x}', '{}+{}', '\\dfrac{a^2}{x^2}', '{}+{}', '\\cdots', '{}+{}', '\\dfrac{a^{n-1}}{x^{n-1}}', '{}={}', '\\dfrac{1-\\left(\\frac{a}{x}\\right)^n}{1-\\frac{a}{x}}']
    const sD = [...sC.slice(0, 10), '\\dfrac{x^n-a^n}{\\htmlId{s17-dden}{x^{n-1}(x-a)}}']
    const sD2 = [...sC.slice(0, 10), '\\dfrac{x^n-a^n}{x^{n-1}(x-a)}']
    this.rows1 = [['A', sA], ['B', sB], ['C', sC], ['D', sD], ['G', sD2]].map(([pf, s]) => {
      const e = mk(pcs(pf, s), this.r1, 960, this.R1Y, 60); op(e, 0)
      return { el: e, p: getP(pf, s.length) }
    })
    this.qs = [2, 4, 8].map(k => this.rows1[0].p[k]).concat([$('A10')])
    this.dden = $('dden')
    // why it is allowed
    this.notes = el('div', '', null, root); place(this.notes, 960, 676, { anchor: 'c' })
    this.notes.style.cssText += 'display:flex;gap:40px;direction:rtl;align-items:center'
    const pill = (html, c) => { const e = rich(html, 'p'); this.notes.appendChild(e); e.style.cssText += `white-space:nowrap;padding:12px 34px;border-radius:26px;border:2.5px solid ${c}99;background:${c}14`; return e }
    this.noteB = pill(`$${col(B, 'x \\ne 0')}$ ← الكسر $\\dfrac{a}{x}$ معرّف`, B)
    this.noteY = pill(`$${col(Y, 'x \\ne a')} \\Rightarrow q = \\dfrac{a}{x} \\ne 1$`, Y)

    // ================= L2: the right side, step by step =================
    const sK = ['\\dfrac{1-\\left(\\frac{a}{x}\\right)^n}{1-\\frac{a}{x}}', '{}={}', '\\dfrac{\\;\\dfrac{x^n-a^n}{x^n}\\;}{\\dfrac{x-a}{x}}', '{}={}',
      '\\dfrac{x^n-a^n}{\\htmlId{s17-kxn}{x^n}}\\times\\dfrac{\\htmlId{s17-kx}{x}}{x-a}', '{}={}', '\\dfrac{x^n-a^n}{x^{n-1}(x-a)}']
    this.chain = mk(pcs('K', sK), root, 960, 604, 54)
    this.kp = getP('K', sK.length)
    this.kxn = $('kxn'); this.kx = $('kx')
    this.steps = el('div', 's', 'خطوات لم يكتبها الكتاب', root); this.steps.style.cssText += `white-space:nowrap;color:${C.mut}`
    const strike = (c = Y) => { const s = el('div', '', null, root); s.style.cssText = `position:absolute;height:4px;border-radius:2px;background:${c};box-shadow:0 0 10px ${c}aa;transform-origin:0 50%`; op(s, 0); return s }
    this.sk = [strike(), strike()]
    this.kNew = mk(col(Y, 'x^{n-1}'), root, 0, 0, 34)
    // the book's line: frame + thumbnail of p.10
    this.frame = el('div', '', null, this.r1)
    this.frame.style.cssText = `position:absolute;border-radius:22px;border:2px solid ${Y}66;background:rgba(255,210,63,.04)`
    this.thumb = bookThumb(root, 10, 176, 268, 150, { x: .3, y: .095, w: .42, h: .065 })
    const cap = el('div', '', 'الكتاب ص 10', this.thumb.el)
    cap.style.cssText = 'position:absolute;left:0;right:0;bottom:0;padding:4px 0 6px;text-align:center;font-size:22px;font-weight:800;color:#fff;background:rgba(11,16,32,.82)'

    // ================= L3: × x^{n-1}(x-a) =================
    const pchip = () => { const e = el('div', 'chip', `× &nbsp;${kt(col(P, 'x^{n-1}(x-a)'))}`, this.r1); e.style.cssText += `position:absolute;direction:ltr;border-color:${P}99;background:${P}1f;color:${P};font-size:34px;padding:6px 22px`; return e }
    this.pcL = pchip(); this.pcR = pchip()
    this.skR = [strike(), strike()]
    this.rule = rich(`لأنّ &nbsp;$${col(P, 'x^{n-1}')}\\cdot\\dfrac{a^k}{x^k} = x^{n-1-k}\\,a^k$`, 'p'); root.appendChild(this.rule)
    place(this.rule, 960, 806, { anchor: 'c' }); this.rule.style.whiteSpace = 'nowrap'
    const sF = ['(x-a)', '(', 'x^{n-1}', '{}+{}', 'x^{n-2}a', '{}+{}', 'x^{n-3}a^2', '{}+{}', '\\cdots', '{}+{}', 'a^{n-1}', ')', '{}={}', 'x^n-a^n']
    this.rowF = mk(pcs('F', sF), root, 960, 660, 60); op(this.rowF, 0)
    this.fp = getP('F', sF.length)
    const sQ = ['x^n-a^n', '{}={}', '(x-a)', '(', 'x^{n-1}', '{}+{}', 'x^{n-2}a', '{}+{}', 'x^{n-3}a^2', '{}+{}', '\\cdots', '{}+{}', 'a^{n-1}', ')']
    this.kb = keyBox(root, pcs('Q', sQ), 960, 560, { cls: 'mx', color: G, label: '✓ تمّ البرهان' })
    this.kb.f.style.fontSize = '60px'
    this.qp = getP('Q', sQ.length)
    this.kbTag = this.kb.el.querySelector('.tag')
    op(this.kb.el, 0)
    this.q3 = quote('ونجد المطابقة المرجوّة عندما نضرب طرفي المساواة الأخيرة بالعدد $x^{n-1}(x-a)$', 870)

    // FLIP morphs
    const pairs = (a, b, map) => map.map(([i, j]) => ({ a: a[i], b: b[j] }))
    const id11 = Array.from({ length: 11 }, (_, k) => [k, k])
    const r = this.rows1
    this.mAB = { pairs: pairs(r[0].p, r[1].p, id11) }
    this.mBC = { pairs: pairs(r[1].p, r[2].p, id11) }
    this.mCD = { pairs: pairs(r[2].p, r[3].p, id11) }
    // ghost copy of the book's line → final row: term k of the sum becomes term k of the bracket
    this.mGF = { pairs: [...pairs(r[4].p, this.fp, [[0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 8], [7, 9], [8, 10], [9, 12], [10, 13]]), { a: this.pcL, b: this.fp[0] }], bOnly: [this.fp[1], this.fp[11]] }
    // final row → boxed identity (the two sides swap)
    this.mFQ = { pairs: pairs(this.fp, this.qp, [...Array.from({ length: 12 }, (_, k) => [k, k + 2]), [12, 1], [13, 0]]) }
    this.flips = [this.mAB, this.mBC, this.mCD, this.mGF, this.mFQ]
    this._layout()
  },

  // ---------- measuring (KaTeX fonts may still be loading during build(), so render() re-runs this when sizes change)
  _sigNow() { return this.rows1[0].el.offsetWidth + '|' + this.rowF.offsetWidth + '|' + this.chain.offsetWidth + '|' + this.q3.t.offsetHeight },
  _layout() {
    this._sig = this._sigNow()
    const R = e => e.getBoundingClientRect()
    const all = []
    for (const m of this.flips) for (const q of m.pairs) all.push(q.a, q.b)
    for (const e of [...all, ...this.fp, this.r1, this.kb.el, this.pcL, this.pcR]) e.style.transform = ''
    const rr = R(this.root), loc = e => { const q = R(e); return { x: q.left - rr.left, y: q.top - rr.top, w: q.width, h: q.height, r: q.right - rr.left, b: q.bottom - rr.top, cx: q.left - rr.left + q.width / 2, cy: q.top - rr.top + q.height / 2 } }
    // purple chips under both sides of the book's line, and its frame
    const D = this.rows1[3].p
    const l0 = loc(D[0]), l8 = loc(D[8]), rh = loc(D[10]), dr = loc(this.rows1[3].el)
    const chipY = Math.max(l8.b, rh.b) + 36
    place(this.pcL, (l0.x + l8.r) / 2, chipY, { anchor: 'tc' })
    place(this.pcR, rh.cx, chipY, { anchor: 'tc' })
    place(this.frame, dr.x - 36, dr.y - 18, { w: dr.w + 72, h: dr.h + 36 })
    // strikes: chain (x and x^n cancel) and, later, the denominator of the book's line
    const setStrike = (s, t, ang = -24) => { const q = loc(t); const len = Math.hypot(q.w, q.h) * .78; place(s, q.cx - len / 2 * Math.cos(ang * Math.PI / 180), q.cy - len / 2 * Math.sin(ang * Math.PI / 180), { w: len }); s.style.rotate = ang + 'deg'; s.style.translate = '0 -50%' }
    setStrike(this.sk[0], this.kx); setStrike(this.sk[1], this.kxn)
    const xn = loc(this.kxn); place(this.kNew, xn.cx + 4, xn.b + 30, { anchor: 'c' })
    place(this.steps, loc(this.chain).r, loc(this.chain).b + 26, { anchor: 'tr' })
    this.ddenR = loc(this.dden)
    // FLIP offsets (b relative to a)
    for (const m of this.flips) for (const q of m.pairs) { const a = loc(q.a), b = loc(q.b); q.dx = b.cx - a.cx; q.dy = b.cy - a.cy }
    for (const q of [this.q0, this.q3]) place(q.bar, 1794, q.y + 8, { w: 6, h: q.t.offsetHeight - 16 })
  },
  // apply a FLIP morph: pos(k) = travel progress of pair k, fade(k) = content cross-fade of pair k
  _flip(m, pos, fade, aOp = 1) {
    m.pairs.forEach((q, k) => {
      const t = pos(k), f = fade(k)
      q.a.style.transform = `translate(${(q.dx * t).toFixed(2)}px, ${(q.dy * t).toFixed(2)}px)`
      q.b.style.transform = `translate(${(-q.dx * (1 - t)).toFixed(2)}px, ${(-q.dy * (1 - t)).toFixed(2)}px)`
      q.a.style.opacity = (1 - f) * aOp; q.b.style.opacity = f
    })
    if (m.bOnly) m.bOnly.forEach(e => { e.style.opacity = fade(m.pairs.length); e.style.transform = '' })
  },

  render(lt, S) {
    if (this._sig !== this._sigNow()) this._layout()
    const T = i => S.at(i), D = i => S.end(i) - S.at(i)
    const at = (i, f) => S.at(i) + f * D(i)
    this.head.set(S.p(lt, 0, 0, .8))

    // ================= L0 =================
    const out0 = S.p(lt, 1, 0, .7)
    wipe(this.goal, S.p(lt, 0, .2, 1), 'ltr'); op(this.goal, 1 - S.p(lt, 1, 0, .5))
    const caseIn = [prog(lt, at(0, .14), .6), prog(lt, at(0, .42), .6)]
    ;[this.caseA, this.caseB].forEach((c, i) => {
      const p = caseIn[i]
      // collapse into the rail chips at the start of L1
      const dx = i === 0 ? -(1250 - 1800 + 400) : (1250 - 150 - 120 - 400 - 140)
      op(c.el, Math.min(p, 1 - out0))
      c.el.style.transform = `translate(${out0 * (i === 0 ? -300 : 560)}px, ${(1 - p) * 30 - out0 * 330}px) scale(${1 - out0 * .7})`
      c.el.style.transformOrigin = '50% 0'
      const t0 = i === 0 ? [.24, .32, .44] : [.5, .56, .62, .68, .78]
      c.rows.forEach((r, k) => rise(r, prog(lt, at(0, t0[k]), .45), 18))
      const ck = prog(lt, at(0, i === 0 ? .44 : .78), .5)
      pop(c.box, ck)
    })
    op(this.q0.t, Math.min(prog(lt, at(0, .84), .6), 1 - S.p(lt, 1, 0, .5)))
    op(this.q0.bar, +this.q0.t.style.opacity); this.q0.bar.style.transform = `scaleY(${E.out(prog(lt, at(0, .84), .6))})`

    // ================= rail =================
    const railIn = [S.p(lt, 1, .4, .5), S.p(lt, 1, .55, .5), S.p(lt, 2, .35, .5), S.p(lt, 2, .5, .5)]
    this.rc.forEach((c, k) => pop(c, railIn[k]))
    const railOut = 0
    op(this.rail, 1 - railOut)

    // ================= L1 =================
    const subIn = prog(lt, at(1, .05), .6), subOut = S.p(lt, 2, 0, .4)
    pop(this.sub, Math.min(subIn, 1 - subOut))
    const rIn = prog(lt, at(1, .13), 1)
    const up = S.p(lt, 2, 0, .9)
    this.r1.style.transform = `translateY(${up * this.R1UP}px)`
    // q's light up, then morph into a/x one by one
    const qHi = prog(lt, at(1, .23), .5)
    this.qs.forEach(e => (e.style.color = mixColor(C.ink, C.yel, qHi)))
    const tAB = at(1, .29)
    const pAB = prog(lt, tAB, 1.6, E.lin)
    const order = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]          // stagger: q, q², …, then the right side
    const pBC = prog(lt, at(2, 0) + .3, 1.2, E.lin)
    const tK6 = at(2, .86), tCD = Math.max(at(2, .93), tK6 + .7)
    const pCD = prog(lt, tCD, .9, E.lin)
    const s1 = pAB + pBC + pCD
    const st = Math.min(Math.floor(s1), 2), p1 = s1 - st
    const fl = [this.mAB, this.mBC, this.mCD][st]
    const stag = (p, k, n, w = .55) => E.io(clamp((p - k / n * (1 - w)) / w))
    this.rows1.forEach((r, j) => op(r.el, j === st || j === st + 1 ? 1 : 0))
    if (st === 0) this._flip(fl, k => stag(p1, order[k], 6), k => stag(p1, order[k], 6))
    else this._flip(fl, () => E.io(p1), k => E.io(clamp(p1 * 1.6 - (k === 10 ? .3 : 0))))
    wipe(this.rows1[0].el, rIn, 'ltr')
    // breathing glow on the yellow a/x after the substitution (L1 hold)
    const glow = st === 1 && p1 < .01 ? .5 + .5 * Math.sin(lt * 2.4) : 0
    this.rows1[1].p.forEach((e, k) => { if ([2, 4, 8, 10].includes(k)) e.style.textShadow = glow > 0 ? `0 0 ${8 + 10 * glow}px rgba(255,210,63,.55)` : '' })
    // notes
    const nOut = S.p(lt, 2, 0, .7)
    ;[this.noteB, this.noteY].forEach((n, k) => {
      const p = prog(lt, at(1, k ? .72 : .45), .6)
      op(n, Math.min(p, 1 - nOut)); n.style.transform = `translateY(${(1 - p) * 24 - nOut * 120}px) scale(${1 - nOut * .4})`
    })

    // ================= L2 =================
    const kT = [at(2, .4), at(2, .52), at(2, .52), at(2, .64), at(2, .64), tK6, tK6]
    const chainOut = prog(lt, tCD + .2, .5)
    this.kp.forEach((e, k) => { const p = prog(lt, kT[k] + (k % 2 ? 0 : .12), .55); e.style.opacity = Math.min(p, 1 - chainOut); e.style.transform = `translateY(${(1 - p) * 20}px)` })
    op(this.chain, prog(lt, kT[0], .01) > 0 ? 1 : 0)
    op(this.steps, Math.min(prog(lt, at(2, .52), .6), 1 - chainOut))
    const tS = at(2, .74)
    this.sk.forEach((s, k) => { const p = prog(lt, tS + k * .25, .35); op(s, Math.min(p > 0 ? 1 : 0, 1 - chainOut)); s.style.transform = `scaleX(${p})` })
    pop(this.kNew, Math.min(prog(lt, tS + .55, .5), 1 - chainOut))
    // the last step glows before it replaces the right side of row 1
    this.kp[6].style.textShadow = env(lt, tK6 + .3, tCD + .4, .3, .3) > 0 ? `0 0 ${16 * env(lt, tK6 + .3, tCD + .4, .3, .3)}px rgba(255,210,63,.7)` : ''
    const fr = Math.min(prog(lt, tCD + .7, .6), 1 - S.p(lt, 3, .2, .5))
    op(this.frame, fr)
    const th = Math.min(prog(lt, tCD + .8, .7), 1 - prog(lt, at(3, .8), .5))
    op(this.thumb.el, th); this.thumb.el.style.transform = `translateY(${(1 - th) * 20}px)`

    // ================= L3 =================
    const pc = S.p(lt, 3, .35, .6)
    const tStrike = at(3, .48), tFly = Math.max(at(3, .54), tStrike + .6)
    const pFly = prog(lt, tFly, 1.7, E.lin)
    const tFin = Math.max(at(3, .8), tFly + 2.1)
    const finOut = prog(lt, tFin, .5)
    pop(this.pcL, Math.min(pc, pFly > 0 ? 1 : 1 - finOut)); pop(this.pcR, Math.min(pc, 1 - prog(lt, tFly + .3, .5)))
    // right side: x^{n-1}(x-a) cancels with the denominator
    const rs = [this.skR[0], this.skR[1]]
    {
      const dd = this.ddenR, cR = this.pcR.getBoundingClientRect(), rr = this.root.getBoundingClientRect()
      const yUp = this.R1UP * up
      const put = (s, x, y, w) => { place(s, x, y, { w }); s.style.rotate = '-14deg'; s.style.translate = '0 -50%' }
      put(rs[0], dd.x - 6, dd.cy + yUp + 14, dd.w + 12)
      put(rs[1], cR.left - rr.left + 50, cR.top - rr.top + cR.height / 2 + 12, cR.width - 66)
      rs.forEach((s, k) => { const p = prog(lt, tStrike + k * .2, .35); op(s, Math.min(p > 0 ? 1 : 0, 1 - prog(lt, tFly + .3, .5))); s.style.transform = `scaleX(${p})` })
    }
    // ghost of the book's line flies down: each term loses its denominator
    const fOrder = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, -1, -.5]       // pairs: 0..10 terms/ops, 11 = (x-a) chip; right side first
    const fStag = k => stag(pFly, fOrder[k] + 1, 6, .5)
    const gOn = pFly > 0 && lt < tFin + 1.4
    op(this.rows1[4].el, gOn ? 1 : 0)
    op(this.rowF, pFly > 0 ? 1 : 0)
    if (pFly > 0) this._flip(this.mGF, fStag, k => (k === this.mGF.pairs.length ? prog(lt, tFly + .3, .6) : fStag(k)))
    else { this.rows1[4].p.forEach(e => (e.style.opacity = 0)); this.fp.forEach(e => (e.style.opacity = 0)) }
    // the book's line dims while its copy flies, then everything above leaves
    const dim = prog(lt, tFly, .6)
    this.r1.style.opacity = 1 - finOut
    this.rows1[3].el.style.opacity = this.rows1[3].el.style.visibility === 'hidden' ? 0 : lerp(1, .4, dim)
    // freshly multiplied terms arrive purple and settle to white
    const settle = prog(lt, tFly + 1.4, .8)
    ;[2, 4, 6, 10, 0].forEach(k => (this.fp[k].style.color = mixColor(C.pur, C.ink, settle)))
    op(this.rule, Math.min(prog(lt, at(3, .36), .6), 1 - finOut))
    this.rule.style.transform = `translateY(${(1 - prog(lt, at(3, .36), .6)) * 20}px)`
    // final: the two sides swap into the boxed identity
    const pSw = prog(lt, tFin + .25, 1.1, E.io)
    if (pSw > 0) {
      op(this.kb.el, 1)
      this._flip(this.mFQ, () => pSw, () => (pSw >= 1 ? 1 : 0))
      op(this.rowF, pSw >= 1 ? 0 : 1)
    } else { op(this.kb.el, 0) }
    const fa = prog(lt, tFin + 1.3, .6)
    const b = this.kb.el
    b.style.borderColor = `rgba(110,224,90,${fa})`
    b.style.background = `rgba(110,224,90,${.07 * fa})`
    b.style.boxShadow = `0 0 ${40 + 14 * Math.sin(lt * 2)}px rgba(110,224,90,${.22 * fa})`
    op(this.kbTag, fa); this.kbTag.style.transform = `scale(${lerp(.7, 1, E.back(fa))})`
    // book line (L3)
    const q3 = prog(lt, at(3, .1), .6)
    op(this.q3.t, q3); op(this.q3.bar, q3); this.q3.bar.style.transform = `scaleY(${E.out(q3)})`
  },
})

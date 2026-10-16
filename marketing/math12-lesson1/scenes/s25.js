// s25 · الخلاصة — one screenshot-ready board, four colour-coded blocks, all visible from the start but dim.
// L0: block 1 (purple, what a sequence is: explicit / recursive) lights, then block 2 (monotonicity: the five cases of
//     «تعريف 1» + the three methods) with its rows ticking in.
// L1: block 3 (arithmetic, blue) and block 4 (geometric + identity, yellow) light up as named; term and sum laws pulse;
//     the identity lights last; «صوّر هذه الشاشة»: the whole board glows once, a camera flash and a 📸 chip.
(() => {
  const ID = 's25'
  const Y = C.yel, P = C.pur, G = C.grn, B = C.blu, R = C.red
  const col = (c, s) => `\\textcolor{${c}}{${s}}`
  const rgba = (hex, a) => { const h = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return `rgba(${h.join(',')},${a})` }
  const DIM = .27

  scene(ID, {
    build(root, S) {
      this.root = root
      this.head = heading(root, 'الخلاصة')

      // ---------- block factory ----------
      const block = (x, w, c, num, title, extra = '') => {
        const b = el('div', '', null, root)
        place(b, x, 0, { w })
        b.style.cssText += `padding:20px 30px 22px;border-radius:26px;border:2.5px solid ${rgba(c, .75)};background:linear-gradient(180deg,${rgba(c, .1)},rgba(20,29,56,.88) 60%);direction:rtl;text-align:right;transform-origin:50% 50%`
        const t = el('div', '', null, b)
        t.style.cssText = `display:flex;align-items:center;gap:14px;direction:rtl;margin-bottom:10px`
        const n = el('span', '', String(num), t)
        n.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:${c};color:#0b1020;font-weight:900;font-size:26px`
        const tt = el('span', '', title, t); tt.style.cssText = `font-size:36px;font-weight:900;color:${c};white-space:nowrap`
        if (extra) { const e = rich(extra, 's'); t.appendChild(e); e.style.cssText += 'font-size:26px;font-weight:700;color:' + C.mut + ';white-space:nowrap;margin-inline-start:auto' }
        return { el: b, c }
      }
      // a line of rich text (Arabic + $math$)
      const line = (parent, html, o = {}) => {
        const e = rich(html, 's')
        e.style.cssText += `color:${o.color || C.ink};font-size:${o.fs || 28}px;font-weight:${o.fw || 600};line-height:${o.lh || 1.48};white-space:nowrap;${o.css || ''}`
        e.querySelectorAll('bdi.m').forEach(m => (m.style.fontSize = (o.mfs || 1.08) + 'em'))
        parent.appendChild(e)
        return e
      }
      // a grid row of cells
      const grid = (parent, cols, gap = 28, css = '') => {
        const g = el('div', '', null, parent)
        g.style.cssText = `display:grid;grid-template-columns:${cols};column-gap:${gap}px;row-gap:4px;direction:rtl;align-items:center;${css}`
        return g
      }
      const sub = (parent, html, c = C.mut) => line(parent, html, { color: c, fs: 25, fw: 800, css: 'margin-top:6px;letter-spacing:.2px' })

      // ================= block 1: what a sequence is (purple) =================
      this.b1 = block(940, 860, P, 1, 'المتتالية')
      const r1a = line(this.b1.el, 'تابعٌ على $\\mathbb{N}$ أو على $\\{n_0,\\, n_0+1,\\, \\dots\\}$')
      const r1b = line(this.b1.el, `<b style="color:${P}">صريح:</b> $u_n = f(n)$`)
      const c1 = el('div', '', null, this.b1.el)
      line(c1, `<b style="color:${P}">تدريجي:</b> حدّ البدء $u_0$ وعلاقة تدريجيّة تحسب كلّ حدّ بدلالة ما سبقه`, { fs: 26 })
      line(c1, `مثلاً $u_{n+1} = f(u_n)$ مع $u_0\\in D$ و $f(x)\\in D$ مهما يكن $x\\in D$`, { fs: 26, color: C.mut, css: 'margin-inline-start:26px' })
      this.r1 = [r1a, r1b, c1]

      // ================= block 2: monotonicity (green / pink) =================
      this.b2 = block(940, 860, G, 2, 'الاطّراد', `<span style="color:${C.ink}">تعريف 1</span>`)
      { const ar = tex(`${col(G, '\\nearrow')}\\,${col(R, '\\searrow')}`, 'mm'); ar.style.fontSize = '34px'; this.b2.el.firstChild.insertBefore(ar, this.b2.el.firstChild.children[2]) }
      const g2 = grid(this.b2.el, '1fr 1fr', 34)
      const cell = (html, c) => line(g2, `<b style="color:${c}">${html.split('|')[0]}</b> ${html.split('|')[1]}`, { fs: 28 })
      this.r2 = [
        cell('متزايدة تماماً:|$u_n < u_{n+1}$', G), cell('متناقصة تماماً:|$u_n > u_{n+1}$', R),
        cell('متزايدة:|$u_n \\le u_{n+1}$', G), cell('متناقصة:|$u_n \\ge u_{n+1}$', R),
        cell('ثابتة:|$u_n = u_{n+1}$', B),
      ]
      // «تعريف 1» as five labelled rows, followed by «مهما تكن n_0 ≤ n — وتسمّى مطّردة»
      this.r2.push(line(g2, `<span style="color:${C.mut}">مهما تكن</span> $n_0 \\le n$ <span style="color:${C.mut}">— وتسمّى</span> <b style="color:${Y}">مطّردة</b>`, { fs: 25 }))
      const gm = grid(this.b2.el, 'auto 1fr', 26, 'align-items:center;margin-top:10px;padding-top:10px;border-top:1.5px solid rgba(255,255,255,.08)')
      const ml = el('div', '', 'ثلاث طرائق<br>لدراسة<br>الاطّراد', gm)
      ml.style.cssText = `font-size:25px;font-weight:800;line-height:1.35;color:${C.mut};padding-inline-end:20px;border-inline-end:2px solid ${rgba(Y, .35)}`
      const mc = el('div', '', null, gm)
      this.m2 = [
        line(mc, `<b style="color:${Y}">①</b> إشارة $u_{n+1}-u_n$`, { fs: 28 }),
        line(mc, `<b style="color:${Y}">②</b> $u_n = f(n)$ ودراسة $f$ على $[n_0,+\\infty[$`, { fs: 28 }),
        line(mc, `<b style="color:${Y}">③</b> $\\dfrac{u_{n+1}}{u_n}$ مقابل $1$ <span style="color:${C.mut}">(حدود موجبة تماماً)</span>`, { fs: 28, lh: 1.2, css: 'margin-top:2px' }),
      ]
      this.mLab = ml

      // ================= block 3: arithmetic (blue) =================
      const mt = (parent, latex, fs = 33) => { const e = tex(latex, 'mm'); e.style.fontSize = fs + 'px'; parent.appendChild(e); return e }
      this.b3 = block(120, 800, B, 3, 'المتتالية الحسابيّة')
      const g3 = grid(this.b3.el, 'auto auto', 40, 'justify-content:space-between;row-gap:14px;margin-top:4px;flex:1;align-content:space-evenly')
      this.f3 = [
        mt(g3, `u_{n+1} = u_n \\htmlId{${ID}-plr}{+ r}`), mt(g3, 'u_m = u_p + (m-p)\\,r'),
        mt(g3, 'S = \\dfrac{n(a+\\ell)}{2}'), mt(g3, '1+2+\\cdots+n = \\dfrac{n(n+1)}{2}'),
      ]
      // ================= block 4: geometric + identity (yellow) =================
      this.b4 = block(120, 800, Y, 4, 'المتتالية الهندسيّة')
      const g4 = grid(this.b4.el, 'auto auto', 40, 'justify-content:space-between;row-gap:14px;margin-top:4px;flex:1;align-content:space-evenly')
      this.f4 = [
        mt(g4, `u_{n+1} = \\htmlId{${ID}-tq}{q\\,} u_n`), mt(g4, 'u_m = u_p\\,q^{m-p}'),
        mt(g4, 'S = a\\,\\dfrac{1-q^n}{1-q}\\ \\ (q\\ne1)'), mt(g4, '1+q+\\cdots+q^{n-1} = \\dfrac{1-q^n}{1-q}\\ \\ (q\\ne1)'),
      ]
      // both sums carry (q ≠ 1): too wide to sit side by side, so each takes its own full-width row
      ;[this.f4[2], this.f4[3]].forEach(e => { e.style.gridColumn = '1 / -1'; e.style.justifySelf = 'start' })
      this.idRow = el('div', '', null, this.b4.el)
      this.idRow.style.cssText = `display:flex;align-items:center;gap:12px;direction:rtl;margin-top:16px;padding:8px 16px;border-radius:16px;border:2px dashed ${rgba(Y, .45)};background:rgba(255,210,63,.05)`
      const il = el('span', '', '💡 مطابقة:', this.idRow); il.style.cssText = `font-size:26px;font-weight:800;color:${Y};white-space:nowrap`
      this.idF = mt(this.idRow, 'x^n - a^n = (x-a)\\left(x^{n-1} + x^{n-2}a + \\cdots + a^{n-1}\\right)', 27)
      ;[this.b3, this.b4].forEach(b => (b.el.style.cssText += 'display:flex;flex-direction:column'))
      this.plr = document.getElementById(`${ID}-plr`); this.tq = document.getElementById(`${ID}-tq`)
      ;[this.plr, this.tq].forEach(e => (e.style.display = 'inline-block'))

      // ---------- corner: 📸 ----------
      this.cam = el('div', '', '📸 صوّر الشاشة', root)
      this.cam.style.cssText += `position:absolute;padding:10px 26px;border-radius:999px;border:2px solid ${rgba(Y, .6)};background:rgba(255,210,63,.1);color:${Y};font-size:30px;font-weight:800;white-space:nowrap;direction:rtl`
      this.flash = el('div', '', null, root)
      this.flash.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;background:#fff;pointer-events:none'
      op(this.flash, 0)
      this.sweep = el('div', '', null, root)
      this.sweep.style.cssText = 'position:absolute;top:240px;height:780px;width:360px;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.07),rgba(255,255,255,0));transform:skewX(-14deg);pointer-events:none'
      op(this.sweep, 0)

      this._layout()
    },

    _sigNow() { return [this.b1, this.b2, this.b3, this.b4].map(b => b.el.offsetWidth + 'x' + b.el.offsetHeight).join('|') },
    _layout() {
      const top = 262, gap = 18
      ;[this.b3, this.b4].forEach(b => (b.el.style.minHeight = ''))
      const h1 = this.b1.el.offsetHeight, h2 = this.b2.el.offsetHeight
      let h3 = this.b3.el.offsetHeight, h4 = this.b4.el.offsetHeight
      // right column: 1 then 2; left column: 3 then 4, stretched so both columns end at the same height
      this.b1.el.style.top = top + 'px'
      this.b2.el.style.top = (top + h1 + gap) + 'px'
      const rightBottom = top + h1 + gap + h2
      const extra = rightBottom - (top + h3 + gap + h4)
      if (extra > 0) { h3 += extra / 2; h4 += extra / 2; this.b3.el.style.minHeight = h3 + 'px'; this.b4.el.style.minHeight = h4 + 'px' }
      this.b3.el.style.top = top + 'px'
      this.b4.el.style.top = (top + h3 + gap) + 'px'
      const lb = top + h3 + gap + h4
      // 📸 «صوّر الشاشة»: small chip in the free top-left corner, level with the title
      place(this.cam, 120, 196, { anchor: 'cl' })
      this.leftBottom = lb; this.rightBottom = rightBottom
      this.sweep.style.top = (top - 20) + 'px'
      this.sweep.style.height = (Math.max(lb, rightBottom) - top + 40) + 'px'
      this._sig = this._sigNow()
    },

    render(lt, S) {
      if (this._sig !== this._sigNow()) this._layout()
      const F = (i, f) => S.at(i) + f * (S.end(i) - S.at(i))
      this.head.set(S.p(lt, 0, 0, .8))
      const boardIn = S.p(lt, 0, 0, .9)
      // light-up times, on the words of the narration (real voice): L0 «المتتالية» .22 · «صريحاً» .42 · «بالتدريج» .54 ·
      // «ثمّ حالات الاطّراد الخمس» .62 · «وثلاث طرائق» .79; L1 «الحسابيّة» .05 · «آر» .18 · «والهندسيّة» .22 · «كيو» .42 ·
      // «قانونا الحدّ» .55 · «والمجموع» .64 · «المطابقة» .76 · «صوّر هذه الشاشة» .82
      const t1 = Math.max(F(0, .21), S.at(0) + .9)
      const t1b = Math.max(F(0, .41), t1 + .8), t1c = Math.max(F(0, .52), t1b + .7)
      const t2 = Math.max(F(0, .62), t1c + .7)
      const t3 = S.at(1) + .15
      const t4 = Math.max(F(1, .21), t3 + 1.2)
      const tTerm = Math.max(F(1, .55), t4 + 1.2), tSum = Math.max(F(1, .64), tTerm + .9)
      const tId = Math.max(F(1, .75), tSum + 1)
      const tShot = Math.max(F(1, .83), tId + .9)
      const setBlock = (b, lit, k) => {
        const a = boardIn * lerp(DIM, 1, lit)
        op(b.el, a)
        b.el.style.filter = lit < 1 ? `saturate(${lerp(.15, 1, lit)})` : ''
        const breathe = lit >= 1 ? .5 + .5 * Math.sin(lt * 1.6 + k * 1.3) : 0
        b.el.style.boxShadow = `0 0 ${lerp(0, 46, lit) + 10 * breathe}px ${rgba(b.c, .22 * lit)}, 0 24px 60px rgba(0,0,0,.35)`
        b.el.style.transform = `translateY(${(1 - boardIn) * 24}px) scale(${1 + .012 * Math.sin(Math.PI * clamp((lit - .0) * 1))})`
      }
      const L = [prog(lt, t1, .7), prog(lt, t2, .7), prog(lt, t3, .7), prog(lt, t4, .7)]
      ;[this.b1, this.b2, this.b3, this.b4].forEach((b, k) => setBlock(b, L[k], k))
      // block 1 rows
      const rowLit = (e, t) => { const p = prog(lt, t, .5); e.style.opacity = lerp(.35, 1, p); e.style.transform = `translateX(${(1 - E.out(p)) * 14}px)` }
      rowLit(this.r1[0], t1); rowLit(this.r1[1], t1b); rowLit(this.r1[2], t1c)
      // block 2 rows tick in
      const st = Math.min(.22, Math.max(.12, (S.end(0) + 1.4 - t2) / 10))
      this.r2.forEach((e, k) => rowLit(e, t2 + .3 + k * st))
      const tM = Math.max(F(0, .79), t2 + .3 + 6 * st + .2)          // «وثلاث طرائق لدراسته»
      rowLit(this.mLab, tM - .1)
      this.m2.forEach((e, k) => rowLit(e, tM + k * (st + .08)))
      // blocks 3 / 4 formulas
      const fLit = (e, t) => { const p = prog(lt, t, .5); e.style.opacity = lerp(.35, 1, p) }
      this.f3.forEach((e, k) => fLit(e, t3 + .2 + k * .15))
      this.f4.forEach((e, k) => fLit(e, t4 + .2 + k * .15))
      // +r / ×q accents
      const acc = (e, t, c) => { const g = env(lt, t, t + 2.2, .3, .6); e.style.color = g > 0 ? mixColor(C.ink, c, g) : ''; e.style.textShadow = g > 0 ? `0 0 ${18 * g}px ${rgba(c, .8)}` : '' }
      acc(this.plr, Math.max(F(1, .14), t3 + .4), Y)
      acc(this.tq, Math.max(F(1, .38), t4 + .5), Y)
      // term laws, then sum laws, pulse (both blocks)
      const pulse = (e, t) => { const g = env(lt, t, t + 1.4, .25, .5); if (g > 0) { e.style.textShadow = `0 0 ${16 * g}px rgba(255,210,63,.75)`; e.style.transform = `scale(${1 + .05 * g})` } else if (!e._keep) { e.style.textShadow = ''; e.style.transform = '' } }
      ;[this.f3[1], this.f4[1]].forEach(e => pulse(e, tTerm))
      ;[this.f3[2], this.f3[3], this.f4[2], this.f4[3]].forEach(e => pulse(e, tSum))
      ;[this.f3[0], this.f3[1], this.f3[2], this.f3[3], this.f4[0], this.f4[1], this.f4[2], this.f4[3]].forEach(e => (e.style.transformOrigin = '50% 50%', e.style.display = 'inline-block'))
      // identity: dim until named
      const idP = prog(lt, tId, .6)
      this.idRow.style.opacity = lerp(.3, 1, idP)
      this.idRow.style.borderColor = rgba(Y, lerp(.25, .75, idP))
      this.idRow.style.boxShadow = idP > 0 ? `0 0 ${30 * env(lt, tId, tId + 2, .3, .8)}px rgba(255,210,63,.45)` : ''
      // screenshot moment
      const fl = env(lt, tShot, tShot + .5, .06, .4)
      op(this.flash, .22 * fl)
      const sw = prog(lt, tShot + .1, 1.4, E.io)
      op(this.sweep, sw > 0 && sw < 1 ? 1 : 0)
      this.sweep.style.left = lerp(80, 1820, sw) + 'px'
      const camP = prog(lt, tShot - .2, .6)
      pop(this.cam, camP)
      this.cam.style.boxShadow = camP >= 1 ? `0 0 ${22 + 12 * Math.sin(lt * 2.2)}px rgba(255,210,63,.35)` : ''
      // the whole board glows once
      const glow = env(lt, tShot + .1, tShot + 1.6, .4, .8)
      if (glow > 0) [this.b1, this.b2, this.b3, this.b4].forEach(b => (b.el.style.boxShadow = `0 0 ${46 + 50 * glow}px ${rgba(b.c, .22 + .3 * glow)}, 0 24px 60px rgba(0,0,0,.35)`))
    },
  })
})()

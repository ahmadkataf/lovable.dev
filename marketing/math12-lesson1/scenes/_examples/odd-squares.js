scene('s01', {
  build(root, S) {
    const cols = [C.yel, C.pur, C.blu, C.grn]
    const sp = 118, ox = 300, oy = 860
    const s = svg(root, 0, 0, W, H)
    this.dots = []
    for (let k = 1; k <= 4; k++) {
      const layer = []
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
        if (Math.max(i, j) !== k - 1) continue
        const c = sv(s, 'circle', { cx: ox + i * sp, cy: oy - j * sp, r: 34, fill: cols[k - 1] })
        c.style.transformOrigin = `${ox + i * sp}px ${oy - j * sp}px`
        layer.push(c)
      }
      this.dots.push(layer)
    }
    this.sq = []
    for (let k = 1; k <= 4; k++) {
      const r = sv(s, 'rect', { x: ox - 60, y: oy - (k - 1) * sp - 60, width: (k - 1) * sp + 120, height: (k - 1) * sp + 120, rx: 22, fill: 'none', stroke: C.ink, 'stroke-width': 4, 'stroke-dasharray': '14 12' })
      this.sq.push(r)
    }
    this.lab = [1, 3, 5, 7].map((v, k) => {
      const e = el('div', 'h3', String(v), root)
      place(e, ox + k * sp + 70, oy - k * sp - 92, { anchor: 'c' })
      e.style.color = cols[k]; e.style.fontWeight = 900
      return e
    })
    const sums = ['1', '1+3', '1+3+5', '1+3+5+7'], res = [1, 4, 9, 16]
    this.eq = sums.map((x, k) => {
      const row = el('div', '', null, root)
      place(row, 1120, 250 + k * 130)
      row.style.direction = 'ltr'; row.style.display = 'flex'; row.style.alignItems = 'center'; row.style.gap = '24px'
      const a = tex(`${x} = ${res[k]}`, 'ml'); row.appendChild(a)
      const b = tex(`= \\textcolor{${C.yel}}{${k + 1}^2}`, 'ml'); row.appendChild(b)
      return { row, a, b }
    })
    this.q = tex('1+3+5+\\cdots+(2n-1) \\overset{?}{=} n^2', 'mxl')
    root.appendChild(this.q); place(this.q, W / 2, 520, { anchor: 'c' })
    this.ask = rich('كيف نُثبت ذلك <span class="yel b">لكلّ</span> $n$ ؟', 'h2 ctr')
    root.appendChild(this.ask); place(this.ask, W / 2, 700, { anchor: 'c' })
  },
  render(lt, S) {
    // line 0: odd numbers appear as layers of dots
    this.dots.forEach((layer, k) => {
      layer.forEach((c, i) => {
        const p = S.p(lt, 0, .2 + k * .75 + i * .06, .5, E.back)
        c.style.opacity = clamp(p * 3); c.style.transform = `scale(${Math.max(0, p)})`
      })
      rise(this.lab[k], S.p(lt, 0, .3 + k * .75, .5))
    })
    // line 1: running sums, square outline grows
    const f1 = S.f(lt, 1)
    this.eq.forEach((e, k) => {
      rise(e.row, S.p(lt, 1, k * (S.end(1) - S.at(1)) / 4.2, .5))
      op(e.b, S.p(lt, 2, .3 + k * .35, .5))
      e.b.style.transform = `translateX(${(1 - S.p(lt, 2, .3 + k * .35, .5)) * -30}px)`
    })
    const ks = clamp(Math.floor(f1 * 4.2), 0, 3)
    this.sq.forEach((r, k) => { r.style.opacity = lt >= S.at(1) && k === ks && lt < S.at(3) ? 1 : 0 })
    // line 3: everything recedes, the conjecture takes the stage
    const p3 = S.p(lt, 3, 0, .8)
    const dim = 1 - p3
    this.dots.flat().forEach(c => { c.style.opacity = Math.min(+c.style.opacity, dim) })
    this.lab.forEach(e => op(e, Math.min(+e.style.opacity, dim)))
    this.eq.forEach(e => op(e.row, Math.min(+e.row.style.opacity, dim)))
    pop(this.q, S.p(lt, 3, .3, .7))
    rise(this.ask, S.p(lt, 3, 1.4, .6))
  },
})

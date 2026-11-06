scene('s01', {
  build(root, S) {
    this.h = heading(root, 'حلول <span class="yel">تدرَّبْ</span> — الدرس الأول: عموميّات عن المتتاليات')
    this.book = bookThumb(root, 11, 150, 260, 520)
    // the four exercise blocks on page 11 (fractions of the page)
    this.blocks = [[.13, .205, '①'], [.23, .485, '②'], [.49, .64, '③'], [.645, .82, '④']].map(([a, b, n]) => {
      const m = el('div', '', null, this.book.el)
      m.style.cssText = `position:absolute;left:4%;right:4%;top:${a * 100}%;height:${(b - a) * 100}%;border:4px solid ${C.yel};border-radius:10px;background:rgba(255,210,63,.12)`
      const t = el('div', '', n, m); t.style.cssText = `position:absolute;right:-56px;top:50%;transform:translateY(-50%);font-size:40px;font-weight:900;color:${C.yel}`
      return m
    })
    this.count = el('div', 'h1 yel', '0', root); place(this.count, 1260, 470, { anchor: 'c' })
    this.count.style.fontSize = '200px'; this.count.style.direction = 'ltr'
    this.lab = rich('سؤالاً = ① + ② (8) + ③ (3) + ④ (9)', 'h3'); root.appendChild(this.lab); place(this.lab, 1260, 640, { anchor: 'c' })
    this.lab.style.whiteSpace = 'nowrap'
    this.chips = ['⏸ أوقف', '✍️ حاول', '✓ قارن'].map((t, i) => chip(root, t, 1580 - i * 320, 820, { anchor: 'c', color: [C.yel, C.blu, C.grn][i] }))
    this.chips.forEach(c => { c.style.fontSize = '40px'; c.style.padding = '16px 34px' })
    this.arrows = [0, 1].map(i => { const a = el('div', 'h2 mute', '←', root); place(a, 1580 - i * 320 - 160, 820, { anchor: 'c' }); return a })
    this.ring = countdown(root, 1260, 470, 90, '⏸ عند كلّ عدّاد')
  },
  render(lt, S) {
    this.h.set(S.p(lt, 0, 0, .7))
    rise(this.book.el, S.p(lt, 0, .3, .7))
    const d0 = S.end(0) - S.at(0)
    this.blocks.forEach((m, i) => op(m, S.p(lt, 0, .8 + i * d0 * .18, .4)))
    const pc = S.p(lt, 0, .8, d0 * .8, E.out)
    op(this.count, Math.min(S.p(lt, 0, .6), 1 - S.p(lt, 1, 0, .4))); counter(this.count, 0, 21, pc)
    op(this.lab, Math.min(S.p(lt, 0, 1.2), 1 - S.p(lt, 1, 0, .4)))
    const d1 = S.end(1) - S.at(1)
    this.chips.forEach((c, i) => pop(c, S.p(lt, 1, .3 + i * d1 * .28, .6)))
    this.arrows.forEach((a, i) => op(a, S.p(lt, 1, .6 + i * d1 * .28, .4)))
    const pr = S.p(lt, 1, .2, .5)
    if (pr > 0) this.ring(clamp((lt - S.at(1) - .2) / Math.max(1, d1 - .5)), Math.max(0, 4 * (1 - (lt - S.at(1)) / Math.max(1, d1))))
    else this.ring(0, 0)
  },
})
